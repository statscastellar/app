'use strict';

const { clone, assert } = require('./utils');

const MIGRATION_VERSION = 1;
const CURRENT = Object.freeze({
  activeMatch: 2,
  completedMatch: 2,
  team: 1,
  backup: 2,
  staleConflict: 1,
  migrationVersion: MIGRATION_VERSION
});

function asVersion(value, label) {
  const v = Number(value?.schemaVersion);
  assert(Number.isInteger(v) && v >= 1, `${label}: schemaVersion invàlid`);
  return v;
}

function migrationStamp(from, to, invariants=[]) {
  return { migrationVersion:MIGRATION_VERSION, fromSchemaVersion:from, toSchemaVersion:to, invariants:[...invariants] };
}

function nativeStamp(to, invariants=[]) {
  return { migrationVersion:MIGRATION_VERSION, fromSchemaVersion:null, toSchemaVersion:to, invariants:[...invariants] };
}

function migrateLoop(value, current, migrations, label) {
  let out = clone(value);
  let v = asVersion(out, label);
  assert(v <= current, `${label}: esquema ${v} més nou que el suportat (${current})`);
  while (v < current) {
    const fn = migrations[v];
    assert(typeof fn === 'function', `${label}: no hi ha migració ${v}→${v + 1}`);
    out = fn(out);
    const next = asVersion(out, label);
    assert(next === v + 1, `${label}: la migració ${v} no ha produït esquema ${v + 1}`);
    v = next;
  }
  return out;
}

function validateSessionMatchIds(session, matchId, label) {
  assert(session && session.matchId === matchId, `${label}: session.matchId inconsistent`);
  assert(session.actionLog?.matchId === matchId, `${label}: ActionLog inconsistent`);
}

function active1to2(record) {
  const out=clone(record);
  assert(out.matchId, 'Partit actiu: matchId obligatori');
  validateSessionMatchIds(out.session,out.matchId,'Partit actiu');
  out.schemaVersion=2;
  out.schemaMigration=migrationStamp(1,2,['matchId','session.matchId','actionLog.matchId','integrity']);
  return out;
}

function completed1to2(record) {
  const out=clone(record);
  assert(out.matchId, 'Partit finalitzat: matchId obligatori');
  assert(out.actionLog?.matchId===out.matchId,'Partit finalitzat: ActionLog inconsistent');
  out.schemaVersion=2;
  out.schemaMigration=migrationStamp(1,2,['matchId','actionLog.matchId','integrity','reportIntegrity']);
  return out;
}

function migrateActiveRecord(record) {
  const out = migrateLoop(record, CURRENT.activeMatch, {1:active1to2}, 'Partit actiu');
  assert(out.matchId, 'Partit actiu: matchId obligatori');
  validateSessionMatchIds(out.session, out.matchId, 'Partit actiu');
  assert(Number(out.schemaMigration?.migrationVersion||MIGRATION_VERSION) <= MIGRATION_VERSION,'Partit actiu: migrationVersion més nova que la suportada');
  return out;
}

function migrateCompletedRecord(record) {
  const out = migrateLoop(record, CURRENT.completedMatch, {1:completed1to2}, 'Partit finalitzat');
  assert(out.matchId, 'Partit finalitzat: matchId obligatori');
  if(out.sourceKind==='legacy-import'){
    assert(out.report && out.legacySource && out.legacyIntegrity,'Partit importat incomplet');
  } else {
    assert(out.actionLog?.matchId === out.matchId, 'Partit finalitzat: ActionLog inconsistent');
  }
  assert(Number(out.schemaMigration?.migrationVersion||MIGRATION_VERSION) <= MIGRATION_VERSION,'Partit finalitzat: migrationVersion més nova que la suportada');
  return out;
}

function migrateTeam(team) {
  const out = migrateLoop(team, CURRENT.team, {}, 'Equip');
  assert(out.teamId, 'Equip: teamId obligatori');
  assert(String(out.name || '').trim(), 'Equip: nom obligatori');
  assert(Array.isArray(out.players), 'Equip: players invàlid');
  const ids = new Set();
  for (const p of out.players) {
    assert(p && p.playerId, 'Equip: playerId obligatori');
    assert(!ids.has(p.playerId), 'Equip: playerId duplicat');
    ids.add(p.playerId);
  }
  return out;
}

function backup1to2(backup) {
  const out=clone(backup);
  assert(out.stores && typeof out.stores==='object','Backup: stores absent');
  for(const entry of out.stores.activeMatches||[]) entry.value=migrateActiveRecord(entry.value);
  for(const entry of out.stores.completedMatches||[]) entry.value=migrateCompletedRecord(entry.value);
  out.schemaVersion=2;
  out.schemaMigration=migrationStamp(1,2,['store-ids','activeMatches','completedMatches']);
  return out;
}

function migrateBackup(backup) {
  const out = migrateLoop(backup, CURRENT.backup, {1:backup1to2}, 'Backup');
  assert(out.app === 'Stats Castellar Pro.2', 'Backup: aplicació desconeguda');
  assert(out.stores && typeof out.stores === 'object', 'Backup: stores absent');
  for (const name of ['teams', 'activeMatches', 'completedMatches', 'settings']) {
    assert(Array.isArray(out.stores[name]), `Backup: ${name} invàlid`);
    const ids = new Set();
    for (const entry of out.stores[name]) {
      assert(entry && typeof entry.id === 'string' && entry.id, `Backup: ${name} té id invàlid`);
      assert(!ids.has(entry.id), `Backup: ${name} conté id duplicat: ${entry.id}`);
      ids.add(entry.id);
      assert(Object.prototype.hasOwnProperty.call(entry, 'value'), `Backup: ${name}/${entry.id} sense value`);
      if (name === 'teams') migrateTeam(entry.value);
      if (name === 'activeMatches') entry.value=migrateActiveRecord(entry.value);
      if (name === 'completedMatches') entry.value=migrateCompletedRecord(entry.value);
    }
  }
  return out;
}

function newActiveEnvelope(fields) { return {schemaVersion:CURRENT.activeMatch,schemaMigration:nativeStamp(CURRENT.activeMatch,['matchId','session.matchId','actionLog.matchId','integrity']),...fields}; }
function newCompletedEnvelope(fields) { return {schemaVersion:CURRENT.completedMatch,schemaMigration:nativeStamp(CURRENT.completedMatch,['matchId','actionLog.matchId','integrity','reportIntegrity']),...fields}; }
function normalizeStaleConflict(conflict) {
  const out=clone(conflict); assert(out && out.schemaVersion===CURRENT.staleConflict,'Conflicte stale amb esquema invàlid');
  if(out.migrationVersion==null) out.migrationVersion=MIGRATION_VERSION;
  assert(Number(out.migrationVersion)<=MIGRATION_VERSION,'Conflicte stale amb migrationVersion més nova que la suportada');
  return out;
}

module.exports = { CURRENT, MIGRATION_VERSION, migrateActiveRecord, migrateCompletedRecord, migrateTeam, migrateBackup, newActiveEnvelope, newCompletedEnvelope, normalizeStaleConflict };
