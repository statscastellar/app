(function(global){'use strict';
const modules={}; const cache={};
function normalize(id){ if(!id.startsWith('./')) id='./'+id; return id.replace(/\.js$/,''); }
function req(id){ id=normalize(id); if(cache[id]) return cache[id].exports; const fn=modules[id]; if(!fn) throw new Error('Mòdul no trobat: '+id); const module={exports:{}}; cache[id]=module; fn(module,module.exports,req); return module.exports; }
modules['./action-replay']=function(module,exports,require){
'use strict';

const { clone, assert } = require('./utils');
const { PHASE, ACTION } = require('./constants');

function resetPointFlow(state) {
  state.flow.rivalTransit = false;
  state.flow.rivalCourtAvailable = false;
  state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
  state.game.phase = state.game.servingSide === 'team' ? PHASE.SERVEI : PHASE.RECEPCIO;
}

function applyStatAction(state, action) {
  const d = action.data || {};
  const type = action.type;
  if (type === ACTION.SERVEI) {
    if (d.value === 1 || d.value === 2) {
      state.game.phase = PHASE.DEFENSA;
      state.flow.rivalTransit = true;
      state.flow.rivalCourtAvailable = false;
    }
    return;
  }
  if (type === ACTION.RECEPCIO || type === ACTION.DEFENSA) {
    state.flow.rivalTransit = false;
    if (d.value === 0) {
      state.flow.sos = {
        status: 'available',
        origin: { phase: type, playerId: d.playerId, zone: String(d.zone) },
        provisionalPointActionId: null
      };
      state.flow.rivalCourtAvailable = false;
    } else {
      state.game.phase = PHASE.COLLOCACIO;
      state.flow.rivalCourtAvailable = true;
    }
    return;
  }
  if (type === ACTION.COLLOCACIO) {
    state.flow.rivalTransit = false;
    state.flow.rivalCourtAvailable = false;
    if (d.value > 0) {
      state.game.phase = PHASE.ATAC;
      state.flow.rivalCourtAvailable = true;
    }
    return;
  }
  if (type === ACTION.ATAC) {
    state.flow.rivalCourtAvailable = false;
    if (d.value === 1 || d.value === 2) {
      state.game.phase = PHASE.DEFENSA;
      state.flow.rivalTransit = true;
    } else {
      state.flow.rivalTransit = false;
    }
    return;
  }
  if (type === ACTION.BLOQUEIG) {
    state.game.phase = PHASE.BLOQUEIG;
    state.flow.rivalTransit = false;
    state.flow.rivalCourtAvailable = false;
    if (d.value === 1) {
      state.game.phase = PHASE.DEFENSA;
      state.flow.rivalCourtAvailable = true;
    }
    return;
  }
  if (type === ACTION.SALVADA) {
    state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
    state.game.phase = PHASE.COLLOCACIO;
    state.flow.rivalTransit = false;
    state.flow.rivalCourtAvailable = false;
  }
}

function applyAction(state, action) {
  const d = action.data || {};
  switch (action.type) {
    case ACTION.MATCH_START:
      return;
    case ACTION.SERVEI:
    case ACTION.RECEPCIO:
    case ACTION.DEFENSA:
    case ACTION.COLLOCACIO:
    case ACTION.ATAC:
    case ACTION.BLOQUEIG:
    case ACTION.SALVADA:
      applyStatAction(state, action);
      break;
    case ACTION.ROTATION:
      state.game.court = clone(d.after);
      break;
    case ACTION.POINT: {
      state.game.score = clone(d.scoreAfter);
      if (d.side === 'team' && state.game.servingSide === 'rival') state.game.servingSide = 'team';
      else if (d.side === 'rival' && state.game.servingSide === 'team') state.game.servingSide = 'rival';
      resetPointFlow(state);
      break;
    }
    case ACTION.SOS_AVAILABLE:
      state.flow.sos = { status: 'available', origin: clone(d.origin), provisionalPointActionId: d.provisionalPointActionId };
      state.game.phase = d.origin.phase;
      state.flow.rivalTransit = false;
      state.flow.rivalCourtAvailable = false;
      break;
    case ACTION.SOS_ACTIVATE:
      state.flow.sos = { status: 'active', origin: clone(d.origin), provisionalPointActionId: d.provisionalPointActionId };
      state.game.phase = d.origin.phase;
      state.flow.rivalTransit = false;
      state.flow.rivalCourtAvailable = false;
      break;
    case ACTION.CAMP_RIVAL:
      state.flow.rivalCourtAvailable = false;
      state.flow.rivalTransit = true;
      state.game.phase = PHASE.DEFENSA;
      break;
    case ACTION.POSITION_CHANGE:
      state.game.court = clone(d.after);
      break;
    case ACTION.SUBSTITUTION:
      state.game.court[String(d.zone)] = d.playerInId;
      break;
    case ACTION.SCORE_CORRECTION:
      state.scoreCorrection = state.scoreCorrection || { team: 0, rival: 0 };
      state.game.score = clone(d.scoreAfter);
      if (d.delta === -1) state.scoreCorrection[d.side]++;
      else if (d.delta === 1) state.scoreCorrection[d.side] = Math.max(0, state.scoreCorrection[d.side] - 1);
      break;
    case ACTION.SET_END:
      state.game.sets.push(clone(d));
      state.flow.awaitingNextSet = true;
      state.flow.rivalCourtAvailable = false;
      state.flow.rivalTransit = false;
      state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
      break;
    case ACTION.SET_START:
      state.game.currentSet = d.set;
      state.game.score = { team: 0, rival: 0 };
      state.game.court = clone(d.court);
      state.game.servingSide = d.servingSide;
      state.game.phase = d.servingSide === 'team' ? PHASE.SERVEI : PHASE.RECEPCIO;
      state.flow.awaitingNextSet = false;
      state.flow.rivalCourtAvailable = false;
      state.flow.rivalTransit = false;
      state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
      break;
    case ACTION.MATCH_END:
      state.lifecycle.status = 'finished';
      state.lifecycle.finishedAt = d.finishedAt || null;
      break;
    default:
      throw new Error('Tipus d’acció no reproduïble: ' + action.type);
  }
  state.lastActionId = action.actionId;
  if (action.occurredAt && state.identity) state.identity.updatedAt = action.occurredAt;
}

function canReplayActionLog(actionLog) {
  const first = actionLog?.actions?.[0];
  return !!(first && first.type === ACTION.MATCH_START && first.data && first.data.genesis);
}

function replayActionLog(actionLog) {
  assert(actionLog && Array.isArray(actionLog.actions) && actionLog.actions.length, 'ActionLog absent');
  const first = actionLog.actions[0];
  assert(first.type === ACTION.MATCH_START, 'ActionLog sense MATCH_START inicial');
  assert(first.data && first.data.genesis, 'ActionLog antic: no conté genesis reproduïble');
  const state = clone(first.data.genesis);
  assert(state.identity?.matchId === actionLog.matchId, 'Genesis i ActionLog no coincideixen');
  state.lastActionId = first.actionId;
  if (first.occurredAt && state.identity) state.identity.updatedAt = first.occurredAt;
  for (const action of actionLog.actions.slice(1)) {
    if (action.active === false) continue;
    applyAction(state, action);
  }
  return state;
}

module.exports = { canReplayActionLog, replayActionLog };

};
modules['./anna-analytics']=function(module,exports,require){
'use strict';
const { ANNA_TYPES } = require('./stats-engine');

const LABELS=Object.freeze({SERVEI:'Servei',RECEPCIO:'Recepció',DEFENSA:'Defensa',COLLOCACIO:'Col·locació',ATAC:'Atac',BLOQUEIG:'Bloqueig',SALVADA:'Salvada'});
const TREND_THRESHOLD=0.03;
const round=(n,d=3)=>n==null?null:Math.round(Number(n)*10**d)/10**d;
function pct0(bucket){return bucket?.percentages?.[0]??null}
function pct3(bucket){return bucket?.percentages?.[3]??null}
function trendLabel(delta){if(delta==null)return 'Sense dades';if(delta>TREND_THRESHOLD)return 'Millora';if(delta<-TREND_THRESHOLD)return 'Baixa';return 'Estable';}
function scoreText(report){if(report?.metadata?.legacyResult)return String(report.metadata.legacyResult).replace('–','-');let t=0,r=0;for(const s of report?.result?.sets||[]){if(s.winner==='team')t++;else if(s.winner==='rival')r++;}return `${t}-${r}`;}
function setEfficiencyRows(report){return Object.keys(report?.stats?.bySet||{}).map(Number).sort((a,b)=>a-b).map(n=>({set:n,actions:report.stats.bySet[n]?.teamAnnaTotal?.actions||0,efficiency:report.stats.bySet[n]?.teamAnnaTotal?.efficiency??null,pct0:pct0(report.stats.bySet[n]?.teamAnnaTotal),pct3:pct3(report.stats.bySet[n]?.teamAnnaTotal)}));}
function playerMatchInsight(p){
  const foundations=ANNA_TYPES.map(t=>({type:t,label:LABELS[t]||t,actions:p?.anna?.[t]?.actions||0,efficiency:p?.anna?.[t]?.efficiency??null,pct0:pct0(p?.anna?.[t]),pct3:pct3(p?.anna?.[t])}));
  const withData=foundations.filter(x=>x.actions>0&&x.efficiency!=null);
  const strength=withData.length?[...withData].sort((a,b)=>b.efficiency-a.efficiency||b.actions-a.actions)[0]:null;
  const priority=withData.length?[...withData].sort((a,b)=>a.efficiency-b.efficiency||b.actions-a.actions)[0]:null;
  return {playerId:p.playerId,number:p.number??'',name:p.name||'',actions:p.annaTotal?.actions||0,efficiency:p.annaTotal?.efficiency??null,impact:p.impact??null,pct0:pct0(p.annaTotal),pct3:pct3(p.annaTotal),strength,priority,sampleSmall:(p.annaTotal?.actions||0)<5,foundations};
}
function buildMatchAnalytics(report){
  const players=(report?.stats?.players||[]).map(playerMatchInsight);
  const sets=setEfficiencyRows(report);
  const teamFoundations=ANNA_TYPES.map(t=>({type:t,label:LABELS[t]||t,actions:report?.stats?.teamAnna?.[t]?.actions||0,efficiency:report?.stats?.teamAnna?.[t]?.efficiency??null,pct0:pct0(report?.stats?.teamAnna?.[t]),pct3:pct3(report?.stats?.teamAnna?.[t])}));
  const bestSet=sets.filter(x=>x.efficiency!=null).sort((a,b)=>b.efficiency-a.efficiency)[0]||null;
  const bestEfficiency=players.filter(x=>x.actions>0&&x.efficiency!=null).sort((a,b)=>b.efficiency-a.efficiency||b.actions-a.actions)[0]||null;
  const mostImpact=players.filter(x=>x.actions>0&&x.impact!=null).sort((a,b)=>b.impact-a.impact)[0]||null;
  const strengths=[...teamFoundations].filter(x=>x.actions>0).sort((a,b)=>(b.efficiency??-1)-(a.efficiency??-1)).slice(0,3);
  const priorities=[...teamFoundations].filter(x=>x.actions>0).sort((a,b)=>(a.efficiency??2)-(b.efficiency??2)).slice(0,2);
  const ranking=[...players].sort((a,b)=>(b.efficiency??-1)-(a.efficiency??-1)||(b.impact??-1)-(a.impact??-1)||(b.actions??0)-(a.actions??0));
  return {
    matchId:report?.matchId||null,opponent:report?.metadata?.opponent||'Rival',date:report?.metadata?.date||'',score:scoreText(report),
    actions:report?.stats?.teamAnnaTotal?.actions||0,efficiency:report?.stats?.teamAnnaTotal?.efficiency??null,pct0:pct0(report?.stats?.teamAnnaTotal),pct3:pct3(report?.stats?.teamAnnaTotal),
    sets,bestSet,bestEfficiency,mostImpact,teamFoundations,players,ranking,strengths,priorities,
    saves:report?.stats?.teamSaves||{counts:{1:0,2:0,3:0},total:0},blocks:report?.stats?.teamBlocks||{counts:{0:0,1:0,2:0},total:0}
  };
}
function mergeBucket(target,b){if(!b)return;for(const k of [0,1,2,3])target.counts[k]+=Number(b.counts?.[k]||0);}
function finalizeBucket(b){b.actions=[0,1,2,3].reduce((s,k)=>s+b.counts[k],0);b.annaPoints=b.counts[1]*5+b.counts[2]*8+b.counts[3]*10;b.efficiency=b.actions?b.annaPoints/(b.actions*10):null;b.percentages={};for(const k of [0,1,2,3])b.percentages[k]=b.actions?b.counts[k]/b.actions:null;return b;}
function newBucket(){return {counts:{0:0,1:0,2:0,3:0},actions:0,annaPoints:0,efficiency:null,percentages:{0:null,1:null,2:null,3:null}};}
function reportDateKey(r,i){const d=r?.metadata?.date||'';return `${d}|${String(i).padStart(5,'0')}`;}
function buildHistoryAnalytics(reports,options={}){
  let arr=(reports||[]).filter(Boolean);
  const teamId=options.teamId||null;if(teamId)arr=arr.filter(r=>r?.metadata?.teamId===teamId);
  arr=arr.map((r,i)=>({r,i})).sort((a,b)=>reportDateKey(a.r,a.i).localeCompare(reportDateKey(b.r,b.i))).map(x=>x.r);
  const perMatch=arr.map(r=>buildMatchAnalytics(r));
  const playerMap={};
  const teamFoundations=Object.fromEntries(ANNA_TYPES.map(t=>[t,newBucket()]));
  for(const report of arr){
    const match=buildMatchAnalytics(report);
    for(const t of ANNA_TYPES)mergeBucket(teamFoundations[t],report?.stats?.teamAnna?.[t]);
    for(const p of report?.stats?.players||[]){
      const x=playerMap[p.playerId]||(playerMap[p.playerId]={playerId:p.playerId,number:p.number??'',name:p.name||'',matches:[],foundations:Object.fromEntries(ANNA_TYPES.map(t=>[t,newBucket()])),total:newBucket(),saves:{counts:{1:0,2:0,3:0},total:0},blocks:{counts:{0:0,1:0,2:0},total:0}});
      x.number=p.number??x.number;x.name=p.name||x.name;
      const pi=match.players.find(y=>y.playerId===p.playerId)||playerMatchInsight(p);
      x.matches.push({matchId:report.matchId,date:report.metadata?.date||'',opponent:report.metadata?.opponent||'Rival',actions:pi.actions,efficiency:pi.efficiency,impact:pi.impact,pct0:pi.pct0,pct3:pi.pct3,foundations:pi.foundations});
      for(const t of ANNA_TYPES)mergeBucket(x.foundations[t],p?.anna?.[t]);
      mergeBucket(x.total,p?.annaTotal);
      for(const k of [1,2,3])x.saves.counts[k]+=Number(p?.saves?.counts?.[k]||0);x.saves.total+=Number(p?.saves?.total||0);
      for(const k of [0,1,2])x.blocks.counts[k]+=Number(p?.blocks?.counts?.[k]||0);x.blocks.total+=Number(p?.blocks?.total||0);
    }
  }
  for(const t of ANNA_TYPES)finalizeBucket(teamFoundations[t]);
  const players=Object.values(playerMap).map(x=>{
    for(const t of ANNA_TYPES)finalizeBucket(x.foundations[t]);finalizeBucket(x.total);
    const valid=x.matches.filter(m=>m.efficiency!=null&&m.actions>0);const first=valid[0]||null,last=valid[valid.length-1]||null;const delta=first&&last&&valid.length>1?last.efficiency-first.efficiency:null;
    const foundationEvolution=ANNA_TYPES.map(t=>{const rows=x.matches.map(m=>{const f=m.foundations.find(z=>z.type===t);return {date:m.date,opponent:m.opponent,actions:f?.actions||0,efficiency:f?.efficiency??null,pct0:f?.pct0??null,pct3:f?.pct3??null};});const vv=rows.filter(r=>r.efficiency!=null&&r.actions>0);const a=vv[0]||null,b=vv[vv.length-1]||null;const d=a&&b&&vv.length>1?b.efficiency-a.efficiency:null;const e0=a&&b&&vv.length>1?(a.pct0??0)-(b.pct0??0):null;return {type:t,label:LABELS[t]||t,rows,delta:d,errorReduction:e0,trend:trendLabel(d)};});
    return {...x,delta,trend:trendLabel(delta),pct0:pct0(x.total),pct3:pct3(x.total),foundationEvolution};
  }).sort((a,b)=>(a.number??999)-(b.number??999));
  const teamFoundationEvolution=ANNA_TYPES.map(t=>{const rows=perMatch.map((m,idx)=>{const f=m.teamFoundations.find(z=>z.type===t);return {matchId:m.matchId,date:m.date,opponent:m.opponent,actions:f?.actions||0,efficiency:f?.efficiency??null,pct0:f?.pct0??null,pct3:f?.pct3??null,index:idx+1};});const vv=rows.filter(r=>r.actions>0&&r.efficiency!=null),a=vv[0]||null,b=vv[vv.length-1]||null;const d=a&&b&&vv.length>1?b.efficiency-a.efficiency:null;return {type:t,label:LABELS[t]||t,rows,delta:d,errorReduction:a&&b&&vv.length>1?(a.pct0??0)-(b.pct0??0):null,trend:trendLabel(d)};});
  const total=newBucket();for(const t of ANNA_TYPES)mergeBucket(total,teamFoundations[t]);finalizeBucket(total);
  return {teamId:teamId||arr[0]?.metadata?.teamId||null,teamName:arr[0]?.metadata?.teamName||'',matches:arr.length,perMatch,players,teamFoundations:Object.entries(teamFoundations).map(([type,b])=>({type,label:LABELS[type]||type,...b})),teamTotal:total,teamFoundationEvolution};
}
module.exports={LABELS,TREND_THRESHOLD,trendLabel,scoreText,buildMatchAnalytics,buildHistoryAnalytics};

};
modules['./backup-service']=function(module,exports,require){
'use strict';

const { clone, assert } = require('./utils');
const { CURRENT, MIGRATION_VERSION, migrateBackup, migrateTeam, migrateActiveRecord, migrateCompletedRecord, normalizeStaleConflict } = require('./schema-migrations');
const { valueDigest, verifyIntegrity } = require('./session-integrity');
const { verifyReportIntegrity } = require('./report-integrity');
const { buildMatchReport } = require('./match-report');
const { MAINTENANCE_JOURNAL_KEY, makeMaintenanceJournal, classifyMaintenanceRecovery, transitionMaintenanceJournal, verifyMaintenanceJournal, maintenanceStatus, canCompactMaintenanceJournal, DEFAULT_MAINTENANCE_RETENTION_MS } = require('./maintenance-journal');

const BACKUP_STORES = Object.freeze(['teams', 'activeMatches', 'completedMatches', 'settings']);
const BACKUP_INTEGRITY_VERSION = 1;
const BACKUP_INTEGRITY_ALGORITHM = 'fnv1a32-stable-json';

function stable(value) { return JSON.stringify(value); }
function backupPayload(backup) {
  return {
    schemaVersion: backup.schemaVersion,
    schemaMigration: clone(backup.schemaMigration || null),
    app: backup.app,
    exportedAt: backup.exportedAt,
    stores: clone(backup.stores)
  };
}
function makeBackupIntegrity(backup) {
  return { version:BACKUP_INTEGRITY_VERSION, algorithm:BACKUP_INTEGRITY_ALGORITHM, digest:valueDigest(backupPayload(backup)) };
}
function verifyBackupIntegrity(backup, options={}) {
  if(!backup?.backupIntegrity) {
    assert(options.allowLegacy===true, 'Backup sense empremta global d’integritat');
    return {ok:true,legacy:true};
  }
  const i=backup.backupIntegrity;
  assert(i.version===BACKUP_INTEGRITY_VERSION,'Versió d’integritat de backup desconeguda');
  assert(i.algorithm===BACKUP_INTEGRITY_ALGORITHM,'Algoritme d’integritat de backup desconegut');
  assert(i.digest===valueDigest(backupPayload(backup)),'Integritat global del backup no vàlida');
  return {ok:true,legacy:false,digest:i.digest};
}

function validateRestorableStores(stores) {
  assert(stores && typeof stores==='object','Backup sense stores restaurables');
  for(const name of BACKUP_STORES) assert(Array.isArray(stores[name]),`Backup: ${name} invàlid`);
  for(const {value} of stores.teams) migrateTeam(value);
  for(const {value} of stores.activeMatches) {
    const rec=migrateActiveRecord(value);
    verifyIntegrity(rec.integrity,rec.session.state,rec.session.actionLog);
  }
  for(const {value} of stores.completedMatches) {
    const rec=migrateCompletedRecord(value);
    verifyIntegrity(rec.integrity,rec.finalState,rec.actionLog);
    const expected=buildMatchReport(rec.finalState,rec.actionLog);
    verifyReportIntegrity(rec.reportIntegrity,rec.report,rec.finalState,rec.actionLog,expected);
  }
  for(const {id,value} of stores.settings) {
    if(String(id).startsWith('__staleConflict__:')) normalizeStaleConflict(value);
  }
  return true;
}

class Pro2BackupService {
  constructor(adapter) { assert(adapter, 'Cal adaptador de persistència'); this.adapter = adapter; }

  async _readStores() {
    const stores={};
    for(const name of BACKUP_STORES) {
      assert(typeof this.adapter.listEntries==='function','L\'adaptador no suporta listEntries');
      stores[name]=await this.adapter.listEntries(name);
    }
    return stores;
  }

  async recoverInterruptedMaintenance(options={}) {
    if(typeof this.adapter.readMaintenanceJournal!=='function') return {status:'unsupported'};
    const journal=await this.adapter.readMaintenanceJournal(MAINTENANCE_JOURNAL_KEY);
    if(!journal) return {status:'none'};
    const verified=verifyMaintenanceJournal(journal);
    if(!verified.legacy && journal.phase==='cleared') return {status:'cleared',operation:journal.operation,operationId:journal.operationId,recovered:false};
    const current=await this._readStores();
    const assessment=classifyMaintenanceRecovery(journal,current);
    assert(typeof this.adapter.writeMaintenanceJournal==='function','L\'adaptador no pot actualitzar el journal de manteniment');
    const now=options.now||new Date().toISOString();
    if(verified.legacy) {
      // Compatibilitat 033: es pot netejar el marcador antic un cop classificat.
      assert(typeof this.adapter.clearMaintenanceJournal==='function','L\'adaptador no pot netejar el journal de manteniment');
      await this.adapter.clearMaintenanceJournal(MAINTENANCE_JOURNAL_KEY);
      return {...assessment,operation:journal.operation,operationId:null,recovered:true,legacy:true,phase:'cleared'};
    }
    let next=journal;
    if(assessment.status==='committed' && next.phase==='prepared') {
      next=transitionMaintenanceJournal(next,'committed',now);
      await this.adapter.writeMaintenanceJournal(next);
    }
    next=transitionMaintenanceJournal(next,'cleared',now);
    await this.adapter.writeMaintenanceJournal(next);
    return {...assessment,operation:journal.operation,operationId:journal.operationId,recovered:true,legacy:false,phase:'cleared'};
  }

  async getMaintenanceStatus(options={}) {
    if(typeof this.adapter.readMaintenanceJournal!=='function') return {status:'unsupported',recoveryRequired:false,compactable:false};
    const journal=await this.adapter.readMaintenanceJournal(MAINTENANCE_JOURNAL_KEY,{includeCleared:true});
    return maintenanceStatus(journal,options.now||new Date().toISOString());
  }

  async compactMaintenanceJournal(options={}) {
    if(typeof this.adapter.readMaintenanceJournal!=='function' || typeof this.adapter.clearMaintenanceJournal!=='function') return {status:'unsupported',compacted:false};
    const journal=await this.adapter.readMaintenanceJournal(MAINTENANCE_JOURNAL_KEY,{includeCleared:true});
    if(!journal) return {status:'none',compacted:false};
    const eligibility=canCompactMaintenanceJournal(journal,{now:options.now||new Date().toISOString(),minAgeMs:options.minAgeMs==null?DEFAULT_MAINTENANCE_RETENTION_MS:options.minAgeMs});
    if(!eligibility.ok) return {status:'retained',compacted:false,reason:eligibility.reason,maintenance:eligibility.status};
    await this.adapter.clearMaintenanceJournal(MAINTENANCE_JOURNAL_KEY);
    return {status:'compacted',compacted:true,operationId:journal.operationId||null,operation:journal.operation||null,ageMs:eligibility.status.ageMs};
  }

  async exportAll(now = new Date().toISOString()) {
    const stores = await this._readStores();
    const backup={
      schemaVersion: CURRENT.backup,
      schemaMigration:{migrationVersion:MIGRATION_VERSION,fromSchemaVersion:null,toSchemaVersion:CURRENT.backup,invariants:['store-ids','activeMatches','completedMatches']},
      app: 'Stats Castellar Pro.2',
      exportedAt: now,
      stores
    };
    backup.backupIntegrity=makeBackupIntegrity(backup);
    return backup;
  }

  async verifyBackup(raw, options={}) {
    verifyBackupIntegrity(raw,options);
    const backup=migrateBackup(raw);
    validateRestorableStores(backup.stores);
    return {ok:true,schemaVersion:backup.schemaVersion,legacy:!raw?.backupIntegrity,backup:clone(backup)};
  }

  async importBackup(raw, options = {}) {
    const mode = options.mode || 'merge-safe';
    assert(mode === 'merge-safe', 'Mode d’importació no suportat');
    // Compatibilitat explícita amb backups 031 i anteriors: es poden fusionar, però igualment es validen internament.
    const checked=await this.verifyBackup(raw,{allowLegacy:options.allowLegacy!==false});
    assert(typeof this.adapter.atomicImportBackup === 'function', 'L\'adaptador no suporta importació atòmica');
    return this.adapter.atomicImportBackup(checked.backup.stores, { compare: stable });
  }

  async restoreBackup(raw, options={}) {
    // Restauració completa: per defecte exigeix backup segellat 032+.
    const checked=await this.verifyBackup(raw,{allowLegacy:options.allowLegacy===true});
    assert(typeof this.adapter.atomicReplaceBackup === 'function','L\'adaptador no suporta restauració atòmica completa');
    assert(typeof this.adapter.writeMaintenanceJournal === 'function','L\'adaptador no suporta journal de manteniment');
    assert(typeof this.adapter.clearMaintenanceJournal === 'function','L\'adaptador no suporta journal de manteniment');

    // Abans d'una operació nova, resol qualsevol marcador residual d'una execució anterior.
    await this.recoverInterruptedMaintenance();
    const sourceStores=await this._readStores();
    const journal=makeMaintenanceJournal({
      sourceStores,
      targetStores:checked.backup.stores,
      targetBackupIntegrityDigest:raw?.backupIntegrity?.digest||null,
      targetBackupSchemaVersion:checked.backup.schemaVersion,
      now:options.now||new Date().toISOString()
    });
    await this.adapter.writeMaintenanceJournal(journal);
    try {
      const result=await this.adapter.atomicReplaceBackup(checked.backup.stores);
      const committed=transitionMaintenanceJournal(journal,'committed',options.committedAt||new Date().toISOString());
      await this.adapter.writeMaintenanceJournal(committed);
      const cleared=transitionMaintenanceJournal(committed,'cleared',options.clearedAt||new Date().toISOString());
      await this.adapter.writeMaintenanceJournal(cleared);
      return {...result,schemaVersion:checked.backup.schemaVersion,legacy:checked.legacy,integrityDigest:raw?.backupIntegrity?.digest||null,maintenanceJournal:'cleared',maintenanceOperationId:journal.operationId};
    } catch(error) {
      // Si l'operació ha fallat de manera normal, IndexedDB ha revertit la transacció.
      // Classifiquem l'estat abans de netejar el marcador; si no és origen/objectiu, el journal es conserva.
      try { await this.recoverInterruptedMaintenance(); } catch(recoveryError) { throw recoveryError; }
      throw error;
    }
  }
}

module.exports = { Pro2BackupService, BACKUP_STORES, BACKUP_INTEGRITY_VERSION, BACKUP_INTEGRITY_ALGORITHM, backupPayload, makeBackupIntegrity, verifyBackupIntegrity, validateRestorableStores };

};
modules['./capa7-ui-state']=function(module,exports,require){
'use strict';

const { PHASE } = require('./constants');
const { assert } = require('./utils');

const RATEABLE_PHASES = Object.freeze([
  PHASE.SERVEI,
  PHASE.RECEPCIO,
  PHASE.DEFENSA,
  PHASE.COLLOCACIO,
  PHASE.ATAC
]);

const PHASE_LABELS = Object.freeze({
  [PHASE.RECEPCIO]: 'RECEPCIÓ',
  [PHASE.COLLOCACIO]: 'COL·LOCACIÓ'
});

function buildCapa7UiState(engine, options = {}) {
  assert(engine && engine.state, 'Motor de partit no disponible');
  const localMode = options.localMode || null;
  const state = engine.state;
  const phase = state.game.phase;
  const sosStatus = state.flow.sos.status;
  const sosActive = sosStatus === 'active';
  const temporaryUiMode = !!localMode;
  const undoStack = Array.isArray(engine.undoStack) ? engine.undoStack : [];

  const ui = {
    version: 1,
    phase,
    phaseLabel: sosActive ? 'SALVADA' : (PHASE_LABELS[phase] || phase),
    localMode,
    ratingPhaseAllowed: RATEABLE_PHASES.includes(phase),
    serverBallVisible: !temporaryUiMode && state.game.servingSide === 'team' && phase === PHASE.SERVEI,
    rivalCourtEnabled: !temporaryUiMode && !!state.flow.rivalCourtAvailable,
    sosEnabled: !temporaryUiMode && (sosStatus === 'available' || sosStatus === 'active'),
    sosActive,
    blocksEnabled: !temporaryUiMode,
    undoEnabled: undoStack.length > 0,
    undoLabel: undoStack.length ? (undoStack[undoStack.length - 1].label || '') : ''
  };

  ui.canRate = (zone, value) => {
    zone = String(zone);
    value = Number(value);
    if (temporaryUiMode) return false;
    if (!ui.ratingPhaseAllowed) return false;
    if (sosActive && value === 0) return false;
    if (phase === PHASE.SERVEI && zone !== '1') return false;
    return Number.isInteger(value) && value >= 0 && value <= 3;
  };

  return ui;
}

module.exports = { RATEABLE_PHASES, PHASE_LABELS, buildCapa7UiState };

};
modules['./constants']=function(module,exports,require){
'use strict';

const PHASE = Object.freeze({
  SERVEI: 'SERVEI',
  RECEPCIO: 'RECEPCIO',
  DEFENSA: 'DEFENSA',
  COLLOCACIO: 'COLLOCACIO',
  ATAC: 'ATAC',
  BLOQUEIG: 'BLOQUEIG'
});

const ACTION = Object.freeze({
  MATCH_START: 'MATCH_START',
  SERVEI: 'SERVEI',
  RECEPCIO: 'RECEPCIO',
  DEFENSA: 'DEFENSA',
  COLLOCACIO: 'COLLOCACIO',
  ATAC: 'ATAC',
  BLOQUEIG: 'BLOQUEIG',
  SALVADA: 'SALVADA',
  POINT: 'POINT',
  SOS_AVAILABLE: 'SOS_AVAILABLE',
  SOS_ACTIVATE: 'SOS_ACTIVATE',
  CAMP_RIVAL: 'CAMP_RIVAL',
  ROTATION: 'ROTATION',
  POSITION_CHANGE: 'POSITION_CHANGE',
  SUBSTITUTION: 'SUBSTITUTION',
  SCORE_CORRECTION: 'SCORE_CORRECTION',
  SET_END: 'SET_END',
  SET_START: 'SET_START',
  MATCH_END: 'MATCH_END'
});

const STAT_ACTIONS_ANNA = new Set([
  ACTION.SERVEI,
  ACTION.RECEPCIO,
  ACTION.DEFENSA,
  ACTION.COLLOCACIO,
  ACTION.ATAC
]);

module.exports = { PHASE, ACTION, STAT_ACTIONS_ANNA };

};
modules['./cumulative-stats']=function(module,exports,require){
'use strict';
const { ANNA_TYPES }=require('./stats-engine');
const { reportFromCompletedRecord, buildMatchReport }=require('./match-report');
const { verifyIntegrity, sessionDigest, valueDigest }=require('./session-integrity');
const { verifyReportIntegrity }=require('./report-integrity');
const { assert, clone }=require('./utils');
const { isLegacyImportRecord, verifyLegacyImportRecord }=require('./legacy-import');
const { verifyPostMatchEdits, applyPostMatchEditsToReport }=require('./post-match-edits');
function bucket(){return {counts:{0:0,1:0,2:0,3:0},actions:0,annaPoints:0,efficiency:null,percentages:{0:null,1:null,2:null,3:null}}}
function finalize(b){b.actions=b.counts[0]+b.counts[1]+b.counts[2]+b.counts[3];b.annaPoints=b.counts[1]*5+b.counts[2]*8+b.counts[3]*10;b.efficiency=b.actions?b.annaPoints/(b.actions*10):null;for(const k of [0,1,2,3])b.percentages[k]=b.actions?b.counts[k]/b.actions:null;return b;}
function emptyPlayer(p){return {playerId:p.playerId,number:p.number??'',name:p.name??'',matches:0,anna:Object.fromEntries(ANNA_TYPES.map(t=>[t,bucket()])),annaTotal:bucket(),impact:null,saves:{counts:{1:0,2:0,3:0},total:0},blocks:{counts:{0:0,1:0,2:0},total:0},participation:{points:0,totalPoints:0,participation:null}}}
function teamIdOfRecord(rec){const r=reportFromCompletedRecord(rec);return r?.metadata?.teamId || rec?.metadata?.teamId || null;}
function groupCompletedByTeam(records){const groups={};for(const rec of records||[]){const id=teamIdOfRecord(rec)||'__unknown__';(groups[id]||(groups[id]=[])).push(rec);}return groups;}
function calculateCumulative(records,options={}){let input=records||[];const teamId=options.teamId||null;if(teamId) input=input.filter(r=>teamIdOfRecord(r)===teamId);else {const ids=[...new Set(input.map(teamIdOfRecord).filter(Boolean))];if(ids.length>1) throw new Error('Hi ha partits de més d’un equip: cal indicar teamId per calcular acumulats sense barrejar equips.');}
 const players={};const teamAnna=Object.fromEntries(ANNA_TYPES.map(t=>[t,bucket()]));let matches=0,totalParticipationPoints=0;let resolvedTeamId=teamId||null;let teamName='';
 for(const rec of input){const r=reportFromCompletedRecord(rec);if(!r||!r.stats)continue;resolvedTeamId=resolvedTeamId||r.metadata?.teamId||null;teamName=teamName||r.metadata?.teamName||'';matches++;totalParticipationPoints+=r.stats.participation?.totalPoints||0;for(const p of r.stats.players||[]){const x=players[p.playerId]||(players[p.playerId]=emptyPlayer(p));x.number=p.number??x.number;x.name=p.name??x.name;x.matches++;for(const t of ANNA_TYPES){for(const k of [0,1,2,3]){const n=p.anna?.[t]?.counts?.[k]||0;x.anna[t].counts[k]+=n;teamAnna[t].counts[k]+=n;}}for(const k of [1,2,3])x.saves.counts[k]+=p.saves?.counts?.[k]||0;x.saves.total+=p.saves?.total||0;for(const k of [0,1,2])x.blocks.counts[k]+=p.blocks?.counts?.[k]||0;x.blocks.total+=p.blocks?.total||0;x.participation.points+=p.participation?.points||0;x.participation.totalPoints+=p.participation?.totalPoints||0;}}
 for(const t of ANNA_TYPES)finalize(teamAnna[t]);const teamAnnaTotal=bucket();for(const t of ANNA_TYPES)for(const k of [0,1,2,3])teamAnnaTotal.counts[k]+=teamAnna[t].counts[k];finalize(teamAnnaTotal);
 for(const x of Object.values(players)){for(const t of ANNA_TYPES){finalize(x.anna[t]);for(const k of [0,1,2,3])x.annaTotal.counts[k]+=x.anna[t].counts[k];}finalize(x.annaTotal);x.impact=teamAnnaTotal.actions?x.annaTotal.annaPoints/(teamAnnaTotal.actions*10):null;x.participation.participation=x.participation.totalPoints?x.participation.points/x.participation.totalPoints:null;}
 return {schemaVersion:2,teamId:resolvedTeamId,teamName,matches,teamAnna,teamAnnaTotal,totalParticipationPoints,players:Object.values(players).sort((a,b)=>(a.number??999)-(b.number??999))};}
function calculateCumulativeByTeam(records){const groups=groupCompletedByTeam(records);const out={};for(const [id,rows] of Object.entries(groups)){if(id==='__unknown__')continue;out[id]=calculateCumulative(rows,{teamId:id});}return out;}

function verifyCompletedSource(rec) {
 assert(rec && rec.matchId, 'Partit finalitzat sense matchId');
 if(isLegacyImportRecord(rec)){
   const v=verifyLegacyImportRecord(rec);
   verifyPostMatchEdits(rec.postMatchEdits||null,v.report);
   const edited=applyPostMatchEditsToReport(v.report,rec.postMatchEdits||null);
   return {matchId:rec.matchId,teamId:edited.metadata?.teamId||null,completedAt:rec.completedAt||null,sourceKind:'legacy-import',sourceDigest:v.sourceDigest,reportDigest:valueDigest(edited),postMatchEditDigest:rec.postMatchEdits?.digest||null};
 }
 assert(rec.finalState && rec.actionLog, `Partit ${rec.matchId} sense font reproduïble`);
 verifyIntegrity(rec.integrity,rec.finalState,rec.actionLog);
 const base=buildMatchReport(rec.finalState,rec.actionLog);
 verifyReportIntegrity(rec.reportIntegrity,rec.report,rec.finalState,rec.actionLog,base);
 verifyPostMatchEdits(rec.postMatchEdits||null,base);
 const expected=applyPostMatchEditsToReport(base,rec.postMatchEdits||null);
 return {
   matchId:rec.matchId,
   teamId:expected.metadata?.teamId||null,
   completedAt:rec.completedAt||null,
   sessionDigest:sessionDigest(rec.finalState,rec.actionLog),
   reportDigest:valueDigest(expected),
   postMatchEditDigest:rec.postMatchEdits?.digest||null
 };
}
function calculateVerifiedCumulative(records,options={}) {
 const input=records||[];
 const sources=input.map(verifyCompletedSource);
 const cumulative=calculateCumulative(input,options);
 const sourceAudit=sources
   .filter(s=>!options.teamId||s.teamId===options.teamId)
   .sort((a,b)=>String(a.matchId).localeCompare(String(b.matchId)));
 const aggregateCore=clone(cumulative);
 const aggregateDigest=valueDigest({sources:sourceAudit,cumulative:aggregateCore});
 return {...cumulative,verification:{verified:true,sourceCount:sourceAudit.length,sources:sourceAudit,aggregateDigest}};
}
function calculateVerifiedCumulativeByTeam(records){
 const input=records||[];
 input.forEach(verifyCompletedSource);
 const groups=groupCompletedByTeam(input);const out={};
 for(const [id,rows] of Object.entries(groups)){if(id==='__unknown__')continue;out[id]=calculateVerifiedCumulative(rows,{teamId:id});}
 return out;
}
module.exports={calculateCumulative,calculateCumulativeByTeam,groupCompletedByTeam,teamIdOfRecord,verifyCompletedSource,calculateVerifiedCumulative,calculateVerifiedCumulativeByTeam};

};
modules['./export-service']=function(module,exports,require){
'use strict';
const { assert, clone } = require('./utils');
const { buildMatchReport } = require('./match-report');
const { applyPostMatchEditsToReport, verifyPostMatchEdits } = require('./post-match-edits');
const { verifyIntegrity, sessionDigest, valueDigest } = require('./session-integrity');
const { verifyReportIntegrity } = require('./report-integrity');
const { assertReportConsistency } = require('./report-consistency');
const { isLegacyImportRecord, verifyLegacyImportRecord } = require('./legacy-import');

function prepareVerifiedExport(record){
  assert(record && record.matchId,'Registre finalitzat absent o invàlid');
  if(isLegacyImportRecord(record)){
    const v=verifyLegacyImportRecord(record);
    verifyPostMatchEdits(record.postMatchEdits||null,v.report);
    const edited=applyPostMatchEditsToReport(v.report,record.postMatchEdits||null);
    return {report:clone(edited),audit:{verified:true,sourceKind:'legacy-import',matchId:record.matchId,sourceDigest:v.sourceDigest,reportDigest:valueDigest(edited),postMatchEditDigest:record.postMatchEdits?.digest||null,postMatchEditCount:record.postMatchEdits?.edits?.length||0,completedAt:record.completedAt||null,preparedAt:new Date().toISOString()}};
  }
  assert(record.finalState && record.actionLog,'Font del partit absent');
  verifyIntegrity(record.integrity,record.finalState,record.actionLog);
  const expectedBase=buildMatchReport(record.finalState,record.actionLog);
  verifyReportIntegrity(record.reportIntegrity,record.report,record.finalState,record.actionLog,expectedBase);
  verifyPostMatchEdits(record.postMatchEdits||null,expectedBase);
  const expected=applyPostMatchEditsToReport(expectedBase,record.postMatchEdits||null);
  assertReportConsistency(expected);
  return {
    report: clone(expected),
    audit:{
      verified:true,
      matchId:record.matchId,
      sessionDigest:sessionDigest(record.finalState,record.actionLog),
      reportDigest:valueDigest(expected),
      postMatchEditDigest:record.postMatchEdits?.digest||null,
      postMatchEditCount:record.postMatchEdits?.edits?.length||0,
      completedAt:record.completedAt||null,
      preparedAt:new Date().toISOString()
    }
  };
}
module.exports={prepareVerifiedExport};

};
modules['./finalization-consistency']=function(module,exports,require){
'use strict';

const { clone } = require('./utils');
const { ACTION } = require('./constants');

function actionsOfActive(activeRecord) {
  return activeRecord?.session?.actionLog?.actions || [];
}
function actionsOfCompleted(completedRecord) {
  return completedRecord?.actionLog?.actions || [];
}

function sameAction(a,b) { return JSON.stringify(a)===JSON.stringify(b); }

function assessFinalizationResidue(activeRecord, completedRecord) {
  if(!activeRecord || !completedRecord) return {status:'none'};
  const activeId=String(activeRecord.matchId||activeRecord?.session?.matchId||'');
  const completedId=String(completedRecord.matchId||'');
  if(!activeId || activeId!==completedId) return {status:'conflict',reason:'matchId'};
  const a=actionsOfActive(activeRecord), c=actionsOfCompleted(completedRecord);
  if(c.length!==a.length+1) return {status:'conflict',reason:'action-count'};
  for(let i=0;i<a.length;i++) if(!sameAction(a[i],c[i])) return {status:'conflict',reason:'action-prefix',index:i};
  const tail=c[c.length-1];
  if(!tail || tail.type!==ACTION.MATCH_END || tail.active===false) return {status:'conflict',reason:'missing-match-end'};
  const activeState=activeRecord?.session?.state;
  const finalState=completedRecord?.finalState;
  if(activeState?.lifecycle?.status!=='active' || finalState?.lifecycle?.status!=='finished') return {status:'conflict',reason:'lifecycle'};
  return {status:'safe-residue',matchId:completedId,completed:clone(completedRecord)};
}

function finalizationResidueConflict(matchId, reason) {
  const e=new Error('Conflicte de reconciliació: el mateix matchId existeix com a actiu i finalitzat però les dades no formen una finalització compatible.');
  e.code='FINALIZATION_RESIDUE_CONFLICT'; e.matchId=String(matchId); e.reason=reason||'divergent'; return e;
}


function staleActiveWriteError(matchId, expectedRevision, actualRevision) {
  const e=new Error('Conflicte de desament: aquesta còpia del partit és més antiga que la versió ja desada. Recupera la versió més recent abans de continuar.');
  e.code='STALE_ACTIVE_WRITE'; e.matchId=String(matchId); e.expectedRevision=expectedRevision; e.actualRevision=actualRevision; return e;
}

function alreadyFinalizedError(matchId) {
  const e=new Error('Aquest partit ja està finalitzat i no es pot tornar a desar com a actiu.');
  e.code='MATCH_ALREADY_FINALIZED'; e.matchId=String(matchId); return e;
}

module.exports={ assessFinalizationResidue, finalizationResidueConflict, alreadyFinalizedError, staleActiveWriteError };

};
modules['./legacy-import']=function(module,exports,require){
'use strict';
const { clone, assert } = require('./utils');
const { ACTION } = require('./constants');
const { ANNA_TYPES, calculateStats } = require('./stats-engine');
const { valueDigest, stableStringify } = require('./session-integrity');

const SOURCE_KIND='legacy-import';
const ACTION_MAP=Object.freeze({
  'Servei':ACTION.SERVEI,
  'Recepció':ACTION.RECEPCIO,
  'Recepcio':ACTION.RECEPCIO,
  'Defensa':ACTION.DEFENSA,
  'Col·locació':ACTION.COLLOCACIO,
  'Col.locació':ACTION.COLLOCACIO,
  'Colocació':ACTION.COLLOCACIO,
  'Atac':ACTION.ATAC,
  'Bloqueig':ACTION.BLOQUEIG,
  'Salvada':ACTION.SALVADA
});
function bucket(){return {counts:{0:0,1:0,2:0,3:0},actions:0,annaPoints:0,efficiency:null,percentages:{0:null,1:null,2:null,3:null}};}
function canonicalPlayerId(teamId,p){
  const n=String(p?.number??'').trim();
  if(String(teamId)==='infantil-a' && n) return `ia-${n}`;
  return `${String(teamId||'team').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()}-${n||String(p?.name||'player').toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
}
function parseLegacyResult(v){const m=String(v||'').match(/^\s*(\d+)\s*[-–]\s*(\d+)\s*$/);return m?{team:Number(m[1]),rival:Number(m[2])}:null;}
function allLegacyActions(match){
  const rows=[];let seq=1;
  const sets=Array.isArray(match.completedSets)?match.completedSets:[];
  const reliableBySet=sets.filter(s=>Array.isArray(s.actions)&&s.actions.length).length>1 || !match.legacy;
  for(const s of sets){
    for(const a of s.actions||[]){
      const t=ACTION_MAP[a.action]; if(!t) continue;
      const value=Number(a.value); if(!Number.isInteger(value)) continue;
      const set=reliableBySet?Number(s.set||a.set||1):null;
      rows.push({sequence:seq++,set,type:t,playerId:a.playerId,value,raw:clone(a)});
    }
  }
  if(!sets.length && Array.isArray(match.actions)){
    for(const a of match.actions){const t=ACTION_MAP[a.action];if(!t)continue;const value=Number(a.value);if(!Number.isInteger(value))continue;rows.push({sequence:seq++,set:Number(match.set||1),type:t,playerId:a.playerId,value,raw:clone(a)});}
  }
  return {rows,reliableBySet};
}
function normalizeLegacyMatchDocument(doc){
  assert(doc && doc.format==='Stats Castellar Match','Format de partit antic no reconegut');
  assert(doc.match && doc.match.id,'Partit antic sense id');
  const m=clone(doc.match), teamId=m.teamId||'infantil-a';
  const playerMap={}; const players=[];
  for(const p of m.players||[]){const id=canonicalPlayerId(teamId,p);playerMap[p.id]=id;players.push({playerId:id,number:p.number??'',name:p.name||''});}
  const aa=allLegacyActions(m);
  const pseudo={actions:aa.rows.map((a,i)=>({sequence:i+1,actionId:`legacy-stat:${i+1}`,set:a.set||1,type:a.type,active:true,data:{playerId:playerMap[a.playerId]||a.playerId,value:a.value}}))};
  const stats=calculateStats(pseudo);
  const setList=(m.completedSets||[]).map(s=>Number(s.set)).filter(Number.isInteger).sort((a,b)=>a-b);
  const legacyResult=parseLegacyResult(m.legacyResult);
  const actualScores=(m.completedSets||[]).some(s=>Number(s?.scores?.castellar||0)!==0||Number(s?.scores?.rival||0)!==0);
  const resultSets=(m.completedSets||[]).map(s=>{
    const c=actualScores?Number(s?.scores?.castellar??0):null, r=actualScores?Number(s?.scores?.rival??0):null;
    const winner=actualScores?(c>r?'team':r>c?'rival':null):null;
    return {set:Number(s.set),score:{team:c,rival:r},winner};
  });
  const participationByPlayer={};
  for(const p of players) participationByPlayer[p.playerId]={playerId:p.playerId,sets:{},points:0,totalPoints:setList.length,participation:null,setsPlayed:0};
  for(const s of m.completedSets||[]){
    const setNo=Number(s.set);
    for(const [oldId,part] of Object.entries(s.participation||{})){
      const id=playerMap[oldId]||canonicalPlayerId(teamId,part||{});
      if(!participationByPlayer[id]) participationByPlayer[id]={playerId:id,sets:{},points:0,totalPoints:setList.length,participation:null,setsPlayed:0};
      const pct=Number(part?.percentage); const fraction=Number.isFinite(pct)?Math.max(0,Math.min(1,pct/100)):null;
      participationByPlayer[id].sets[setNo]={set:setNo,participation:fraction,points:fraction,totalPoints:1};
      if(fraction!=null){participationByPlayer[id].points+=fraction;if(fraction>0)participationByPlayer[id].setsPlayed++;}
    }
  }
  for(const p of Object.values(participationByPlayer)) p.participation=p.totalPoints?p.points/p.totalPoints:null;
  const emptyForPlayer=(id)=>({playerId:id,anna:Object.fromEntries(ANNA_TYPES.map(t=>[t,bucket()])),annaTotal:bucket(),impact:null,saves:{counts:{1:0,2:0,3:0},total:0,details:[]},blocks:{counts:{0:0,1:0,2:0},total:0,details:[]}});
  const reportPlayers=players.map(p=>{const st=stats.players[p.playerId]||emptyForPlayer(p.playerId);return {...p,...clone(st),participation:clone(participationByPlayer[p.playerId]||{playerId:p.playerId,sets:{},points:0,totalPoints:setList.length,participation:null,setsPlayed:0})};}).sort((a,b)=>(Number(a.number)||999)-(Number(b.number)||999));
  const bySet={};
  for(const s of m.completedSets||[]){
    const n=Number(s.set), part={byPlayer:{},totalPoints:1};
    for(const p of reportPlayers){const ps=p.participation?.sets?.[n];if(ps)part.byPlayer[p.playerId]={playerId:p.playerId,sets:{[n]:clone(ps)},points:ps.points??ps.participation??0,totalPoints:1,participation:ps.participation,setsPlayed:ps.participation>0?1:0};}
    let setStats={teamAnnaActions:0,teamAnna:Object.fromEntries(ANNA_TYPES.map(t=>[t,bucket()])),teamAnnaTotal:bucket(),teamSaves:{counts:{1:0,2:0,3:0},total:0,details:[]},teamBlocks:{counts:{0:0,1:0,2:0},total:0,details:[]},players:[]};
    if(aa.reliableBySet){const sub={actions:pseudo.actions.filter((x,i)=>aa.rows[i]?.set===n)};const st=calculateStats(sub);setStats={...st,players:reportPlayers.map(p=>({...p,...clone(st.players[p.playerId]||emptyForPlayer(p.playerId)),participation:clone(part.byPlayer[p.playerId]||{playerId:p.playerId,sets:{},points:0,totalPoints:1,participation:0,setsPlayed:0})}))};}
    bySet[n]={set:n,teamAnnaActions:setStats.teamAnnaActions,teamAnna:clone(setStats.teamAnna),teamAnnaTotal:clone(setStats.teamAnnaTotal),teamSaves:clone(setStats.teamSaves),teamBlocks:clone(setStats.teamBlocks),participation:part,players:setStats.players};
  }
  const report={
    schemaVersion:4, matchId:String(m.id),
    metadata:{teamId,teamName:m.teamName||'Infantil A',opponent:m.opponent||'Rival',date:m.date||'',venue:m.venue||'',legacyResult:m.legacyResult||null,sourceKind:SOURCE_KIND},
    result:{sets:resultSets,currentSet:setList.at(-1)||1,currentScore:actualScores?{team:Number(m.scores?.castellar??0),rival:Number(m.scores?.rival??0)}:{team:null,rival:null}},
    stats:{teamAnnaActions:stats.teamAnnaActions,teamAnna:clone(stats.teamAnna),teamAnnaTotal:clone(stats.teamAnnaTotal),teamSaves:clone(stats.teamSaves),teamBlocks:clone(stats.teamBlocks),participation:{byPlayer:clone(participationByPlayer),totalPoints:setList.length},players:reportPlayers,bySet},
    actions:aa.rows.map(a=>({sequence:a.sequence,actionId:`legacy:${a.sequence}`,set:a.set,type:a.type,label:a.raw?.action||a.type,playerId:playerMap[a.playerId]||a.playerId,number:players.find(p=>p.playerId===(playerMap[a.playerId]||a.playerId))?.number??null,playerName:players.find(p=>p.playerId===(playerMap[a.playerId]||a.playerId))?.name||null,value:a.value,teamScore:null,rivalScore:null,detail:'',provisional:false})),
    audit:{activeActions:aa.rows.length,revertedActions:0,sourceKind:SOURCE_KIND,setActionBreakdownAvailable:aa.reliableBySet},
    generatedFrom:{sourceKind:SOURCE_KIND,format:doc.format,version:doc.version||null,exportedAt:doc.exportedAt||null}
  };
  return {match:m,report,reliableBySet:aa.reliableBySet};
}
function makeLegacyImportRecord(doc){
  const {match,report}=normalizeLegacyMatchDocument(doc);
  const source=clone(doc); const completedAt=match.finishedAt||match.date||new Date().toISOString();
  return {schemaVersion:2,schemaMigration:{migrationVersion:1,fromSchemaVersion:null,toSchemaVersion:2,migratedAt:new Date().toISOString(),invariants:['legacySource','legacyIntegrity','report']},sourceKind:SOURCE_KIND,matchId:String(match.id),metadata:clone(report.metadata),legacySource:source,report:clone(report),legacyIntegrity:{version:1,algorithm:'fnv1a32-stable-json',sourceDigest:valueDigest(source),reportDigest:valueDigest(report)},completedAt,importedAt:new Date().toISOString()};
}
function isLegacyImportRecord(rec){return rec?.sourceKind===SOURCE_KIND;}
function verifyLegacyImportRecord(rec){
  assert(isLegacyImportRecord(rec),'No és un partit importat');
  assert(rec.legacyIntegrity?.version===1 && rec.legacyIntegrity?.algorithm==='fnv1a32-stable-json','Integritat de partit importat desconeguda');
  assert(valueDigest(rec.legacySource)===rec.legacyIntegrity.sourceDigest,'Font del partit importat modificada');
  const expected=normalizeLegacyMatchDocument(rec.legacySource).report;
  assert(valueDigest(rec.report)===rec.legacyIntegrity.reportDigest,'Informe importat modificat');
  assert(stableStringify(expected)===stableStringify(rec.report),'Informe importat no coincideix amb la font antiga');
  return {ok:true,sourceDigest:rec.legacyIntegrity.sourceDigest,reportDigest:rec.legacyIntegrity.reportDigest,report:clone(expected)};
}
function repairLegacyImportRecord(rec){
  assert(isLegacyImportRecord(rec),'No és un partit importat');
  const expected=normalizeLegacyMatchDocument(rec.legacySource).report;
  const out=clone(rec); out.report=clone(expected); out.metadata=clone(expected.metadata); out.legacyIntegrity={version:1,algorithm:'fnv1a32-stable-json',sourceDigest:valueDigest(out.legacySource),reportDigest:valueDigest(expected)}; out.reportRecoveredAt=new Date().toISOString(); out.reportRecoverySource='legacy-source'; return out;
}
module.exports={SOURCE_KIND,isLegacyImportRecord,normalizeLegacyMatchDocument,makeLegacyImportRecord,verifyLegacyImportRecord,repairLegacyImportRecord};

};
modules['./maintenance-journal']=function(module,exports,require){
'use strict';

const { clone, assert } = require('./utils');
const { valueDigest } = require('./session-integrity');

const MAINTENANCE_JOURNAL_KEY='__maintenanceJournal__:v1';
const MAINTENANCE_JOURNAL_VERSION=2;
const LEGACY_MAINTENANCE_JOURNAL_VERSION=1;
const MAINTENANCE_JOURNAL_ALGORITHM='fnv1a32-stable-json';
const MAINTENANCE_DATA_STORES=Object.freeze(['teams','activeMatches','completedMatches','settings']);
const MAINTENANCE_PHASES=Object.freeze(['prepared','committed','cleared']);

const DEFAULT_MAINTENANCE_RETENTION_MS=7*24*60*60*1000;

function maintenanceStatus(journal, now=new Date().toISOString()) {
  if(!journal) return {status:'none',phase:null,operationId:null,operation:null,ageMs:null,recoveryRequired:false,compactable:false};
  const verified=verifyMaintenanceJournal(journal);
  const ref=Date.parse(journal.updatedAt||journal.createdAt||'');
  const cur=Date.parse(now);
  const ageMs=Number.isFinite(ref)&&Number.isFinite(cur)?Math.max(0,cur-ref):null;
  if(verified.legacy) return {status:'recovery-pending',phase:'prepared',operationId:null,operation:journal.operation,ageMs,recoveryRequired:true,compactable:false,legacy:true};
  if(journal.phase==='cleared') return {status:'resolved',phase:'cleared',operationId:journal.operationId,operation:journal.operation,ageMs,recoveryRequired:false,compactable:true,legacy:false};
  return {status:'recovery-pending',phase:journal.phase,operationId:journal.operationId,operation:journal.operation,ageMs,recoveryRequired:true,compactable:false,legacy:false};
}

function canCompactMaintenanceJournal(journal,{now=new Date().toISOString(),minAgeMs=DEFAULT_MAINTENANCE_RETENTION_MS}={}) {
  const status=maintenanceStatus(journal,now);
  if(status.status!=='resolved') return {ok:false,reason:status.status,status};
  if(status.ageMs==null) return {ok:false,reason:'invalid-timestamp',status};
  if(status.ageMs<Math.max(0,Number(minAgeMs)||0)) return {ok:false,reason:'recent',status};
  return {ok:true,reason:'eligible',status};
}

function canonicalStores(stores) {
  const out={};
  for(const name of MAINTENANCE_DATA_STORES) {
    const entries=Array.isArray(stores?.[name]) ? stores[name] : [];
    out[name]=entries.map(entry=>({id:String(entry.id),value:clone(entry.value)})).sort((a,b)=>a.id.localeCompare(b.id));
  }
  return out;
}

function maintenanceStoresDigest(stores) { return valueDigest(canonicalStores(stores)); }

function operationIdFor({operation,now,sourceStoresDigest,targetStoresDigest}) {
  return `${operation}:${now}:${valueDigest({operation,now,sourceStoresDigest,targetStoresDigest})}`;
}

function journalPayload(journal) {
  const payload={
    schemaVersion:journal.schemaVersion,
    journalId:journal.journalId,
    operation:journal.operation,
    phase:journal.phase,
    createdAt:journal.createdAt,
    updatedAt:journal.updatedAt,
    sourceStoresDigest:journal.sourceStoresDigest,
    targetStoresDigest:journal.targetStoresDigest,
    targetBackupIntegrityDigest:journal.targetBackupIntegrityDigest||null,
    targetBackupSchemaVersion:journal.targetBackupSchemaVersion||null
  };
  if(Number(journal.schemaVersion)>=2) payload.operationId=journal.operationId;
  return payload;
}

function sealMaintenanceJournal(journal) {
  const copy=clone(journal);
  copy.integrity={version:Number(copy.schemaVersion),algorithm:MAINTENANCE_JOURNAL_ALGORITHM,digest:valueDigest(journalPayload(copy))};
  return copy;
}

function makeMaintenanceJournal({operation='restore-backup',sourceStores,targetStores,targetBackupIntegrityDigest=null,targetBackupSchemaVersion=null,now=new Date().toISOString(),operationId=null}={}) {
  assert(operation==='restore-backup','Operació de manteniment no suportada');
  const sourceStoresDigest=maintenanceStoresDigest(sourceStores);
  const targetStoresDigest=maintenanceStoresDigest(targetStores);
  const journal={
    schemaVersion:MAINTENANCE_JOURNAL_VERSION,
    journalId:MAINTENANCE_JOURNAL_KEY,
    operationId:operationId||operationIdFor({operation,now,sourceStoresDigest,targetStoresDigest}),
    operation,
    phase:'prepared',
    createdAt:now,
    updatedAt:now,
    sourceStoresDigest,
    targetStoresDigest,
    targetBackupIntegrityDigest:targetBackupIntegrityDigest||null,
    targetBackupSchemaVersion:targetBackupSchemaVersion||null
  };
  return sealMaintenanceJournal(journal);
}

function verifyMaintenanceJournal(journal) {
  assert(journal && typeof journal==='object','Journal de manteniment invàlid');
  const version=Number(journal.schemaVersion);
  assert(version===LEGACY_MAINTENANCE_JOURNAL_VERSION || version===MAINTENANCE_JOURNAL_VERSION,'Versió de journal de manteniment desconeguda');
  assert(journal.journalId===MAINTENANCE_JOURNAL_KEY,'Identitat de journal de manteniment invàlida');
  assert(journal.operation==='restore-backup','Operació de journal de manteniment desconeguda');
  if(version===LEGACY_MAINTENANCE_JOURNAL_VERSION) assert(journal.phase==='prepared','Fase de journal de manteniment desconeguda');
  else {
    assert(MAINTENANCE_PHASES.includes(journal.phase),'Fase de journal de manteniment desconeguda');
    assert(typeof journal.operationId==='string' && journal.operationId.length>0,'operationId de manteniment obligatori');
  }
  const i=journal.integrity||{};
  assert(Number(i.version)===version,'Versió d’integritat del journal desconeguda');
  assert(i.algorithm===MAINTENANCE_JOURNAL_ALGORITHM,'Algoritme d’integritat del journal desconegut');
  assert(i.digest===valueDigest(journalPayload(journal)),'Integritat del journal de manteniment no vàlida');
  assert(journal.sourceStoresDigest && journal.targetStoresDigest,'Journal de manteniment incomplet');
  return {ok:true,digest:i.digest,legacy:version===LEGACY_MAINTENANCE_JOURNAL_VERSION,phase:journal.phase,operationId:journal.operationId||null};
}

function transitionMaintenanceJournal(journal,phase,now=new Date().toISOString()) {
  const verified=verifyMaintenanceJournal(journal);
  assert(!verified.legacy,'Un journal antic no admet transicions de fase');
  assert(MAINTENANCE_PHASES.includes(phase),'Fase de manteniment desconeguda');
  const order={prepared:0,committed:1,cleared:2};
  assert(order[phase]>=order[journal.phase],'No es pot retrocedir la fase del manteniment');
  const next={...clone(journal),phase,updatedAt:now};
  return sealMaintenanceJournal(next);
}

function maintenanceBusy(existing,incoming=null) {
  const e=new Error('Ja hi ha una operació de manteniment activa. Cal recuperar-la o completar-la abans d’iniciar-ne una altra.');
  e.code='MAINTENANCE_BUSY';
  e.activeOperationId=existing?.operationId||null;
  e.requestedOperationId=incoming?.operationId||null;
  e.phase=existing?.phase||null;
  return e;
}


function maintenancePhaseRegression(existing,incoming) {
  const e=new Error('No es pot retrocedir una operació de manteniment a una fase anterior.');
  e.code='MAINTENANCE_PHASE_REGRESSION';
  e.operationId=existing?.operationId||incoming?.operationId||null;
  e.currentPhase=existing?.phase||null;
  e.requestedPhase=incoming?.phase||null;
  return e;
}

function maintenanceConflict(journal,currentDigest) {
  const e=new Error('Conflicte de recuperació de manteniment: l’estat actual no coincideix ni amb l’origen ni amb l’objectiu de la restauració.');
  e.code='MAINTENANCE_RECOVERY_CONFLICT';
  e.operation=journal?.operation||null;
  e.operationId=journal?.operationId||null;
  e.phase=journal?.phase||null;
  e.sourceStoresDigest=journal?.sourceStoresDigest||null;
  e.targetStoresDigest=journal?.targetStoresDigest||null;
  e.currentStoresDigest=currentDigest||null;
  return e;
}

function classifyMaintenanceRecovery(journal,currentStores) {
  const verified=verifyMaintenanceJournal(journal);
  if(!verified.legacy && journal.phase==='cleared') return {status:'cleared',currentStoresDigest:maintenanceStoresDigest(currentStores)};
  const currentStoresDigest=maintenanceStoresDigest(currentStores);
  if(currentStoresDigest===journal.targetStoresDigest) return {status:'committed',currentStoresDigest};
  if(journal.phase!=='committed' && currentStoresDigest===journal.sourceStoresDigest) return {status:'rolled-back',currentStoresDigest};
  throw maintenanceConflict(journal,currentStoresDigest);
}

module.exports={
  MAINTENANCE_JOURNAL_KEY,MAINTENANCE_JOURNAL_VERSION,LEGACY_MAINTENANCE_JOURNAL_VERSION,MAINTENANCE_JOURNAL_ALGORITHM,MAINTENANCE_DATA_STORES,MAINTENANCE_PHASES,
  canonicalStores,maintenanceStoresDigest,journalPayload,makeMaintenanceJournal,verifyMaintenanceJournal,transitionMaintenanceJournal,maintenanceBusy,maintenancePhaseRegression,classifyMaintenanceRecovery,maintenanceConflict,
  DEFAULT_MAINTENANCE_RETENTION_MS,maintenanceStatus,canCompactMaintenanceJournal
};

};
modules['./match-engine']=function(module,exports,require){
'use strict';

const { clone, assert, unique } = require('./utils');
const { PHASE, ACTION } = require('./constants');

const ZONES = ['1','2','3','4','5','6'];

class MatchEngine {
  constructor(state, actionLog, undoStack = []) {
    this.state = clone(state);
    this.log = clone(actionLog);
    this.undoStack = clone(undoStack);
    this._validate();
  }

  static fromSession(session) {
    assert(session && session.state && session.actionLog, 'Sessió de partit invàlida');
    return new MatchEngine(session.state, session.actionLog, session.undoStack || []);
  }

  exportSession() {
    return {
      schemaVersion: 1,
      matchId: this.state.identity.matchId,
      state: clone(this.state),
      actionLog: clone(this.log),
      undoStack: clone(this.undoStack)
    };
  }

  snapshot() {
    return { state: clone(this.state), actionLog: clone(this.log) };
  }

  _checkpoint(label) {
    this.undoStack.push({ label, ...this.snapshot() });
    if (this.undoStack.length > 100) this.undoStack.shift();
  }

  _nextOccurredAt() {
    const now = Date.now();
    const previous = Date.parse(this.state.identity?.updatedAt || '') || 0;
    return new Date(Math.max(now, previous)).toISOString();
  }

  _append(type, data = {}, meta = {}) {
    const sequence = this.log.nextSequence++;
    const occurredAt = meta.occurredAt || this._nextOccurredAt();
    const action = {
      actionId: `${this.state.identity.matchId}:${sequence}`,
      sequence,
      set: this.state.game.currentSet,
      type,
      active: meta.active !== false,
      provisional: !!meta.provisional,
      revertedBy: null,
      occurredAt,
      data: clone(data)
    };
    this.log.actions.push(action);
    this.state.lastActionId = action.actionId;
    this.state.identity.updatedAt = occurredAt;
    return action;
  }

  _findAction(actionId) {
    return this.log.actions.find(a => a.actionId === actionId) || null;
  }

  _revertAction(actionId, reason) {
    const a = this._findAction(actionId);
    if (a && a.active) {
      a.active = false;
      a.revertedBy = reason;
    }
  }

  _phaseAfterPoint() {
    this.state.flow.rivalTransit = false;
    this.state.flow.rivalCourtAvailable = false;
    this.state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
    this.state.game.phase = this.state.game.servingSide === 'team' ? PHASE.SERVEI : PHASE.RECEPCIO;
  }

  _rotateTeam() {
    const c = this.state.game.court;
    const before = clone(c);
    this.state.game.court = {
      '1': c['2'],
      '2': c['3'],
      '3': c['4'],
      '4': c['5'],
      '5': c['6'],
      '6': c['1']
    };
    this._append(ACTION.ROTATION, { before, after: clone(this.state.game.court) });
  }

  _awardPoint(side, source, { provisional = false, manual = false } = {}) {
    assert(['team','rival'].includes(side), 'Costat de punt invàlid');
    const before = clone(this.state.game.score);
    this.state.game.score[side]++;

    if (side === 'team') {
      if (this.state.game.servingSide === 'rival') {
        this.state.game.servingSide = 'team';
        this._rotateTeam();
      }
    } else if (this.state.game.servingSide === 'team') {
      this.state.game.servingSide = 'rival';
    }

    const point = this._append(ACTION.POINT, {
      side, source, manual, scoreBefore: before, scoreAfter: clone(this.state.game.score)
    }, { provisional });
    this._phaseAfterPoint();
    return point;
  }

  ratePlayer(zone, value) {
    zone = String(zone);
    assert(ZONES.includes(zone), 'Zona invàlida');
    assert(Number.isInteger(value) && value >= 0 && value <= 3, 'Valor invàlid');
    assert(this.state.lifecycle.status === 'active', 'Partit finalitzat');
    assert(!this.state.flow.temporaryMode, 'Hi ha un mode temporal actiu');

    const playerId = this.state.game.court[zone];
    assert(playerId, 'Zona sense jugadora');

    if (this.state.flow.sos.status === 'active') {
      assert([1,2,3].includes(value), 'Salvada només admet 1, 2 o 3');
      this._checkpoint(`SALVADA ${playerId} ${value}`);
      this._append(ACTION.SALVADA, { playerId, zone, value });
      this.state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
      this.state.game.phase = PHASE.COLLOCACIO;
      this.state.flow.rivalTransit = false;
      this.state.flow.rivalCourtAvailable = false;
      this._validate();
      return this.snapshot();
    }

    const phase = this.state.game.phase;
    assert([PHASE.SERVEI,PHASE.RECEPCIO,PHASE.DEFENSA,PHASE.COLLOCACIO,PHASE.ATAC].includes(phase), 'Fase no valorable');
    if (phase === PHASE.SERVEI) assert(zone === '1', 'Durant el servei només es pot valorar zona 1');

    this._checkpoint(`${phase} ${playerId} ${value}`);
    this.state.flow.rivalCourtAvailable = false;
    this.state.flow.rivalTransit = false;
    this._append(phase, { playerId, zone, value });

    if (phase === PHASE.SERVEI) {
      if (value === 0) this._awardPoint('rival', 'SERVEI_0');
      else if (value === 3) this._awardPoint('team', 'SERVEI_3');
      else {
        this.state.game.phase = PHASE.DEFENSA;
        this.state.flow.rivalTransit = true;
      }
    } else if (phase === PHASE.RECEPCIO || phase === PHASE.DEFENSA) {
      if (value === 0) {
        const origin = { phase, playerId, zone };
        const point = this._awardPoint('rival', `${phase}_0`, { provisional: true });
        this.state.flow.sos = { status: 'available', origin, provisionalPointActionId: point.actionId };
        this._append(ACTION.SOS_AVAILABLE, { origin, provisionalPointActionId: point.actionId });
      } else {
        this.state.game.phase = PHASE.COLLOCACIO;
        this.state.flow.rivalCourtAvailable = true;
      }
    } else if (phase === PHASE.COLLOCACIO) {
      if (value === 0) this._awardPoint('rival', 'COLLOCACIO_0');
      else {
        this.state.game.phase = PHASE.ATAC;
        this.state.flow.rivalCourtAvailable = true;
      }
    } else if (phase === PHASE.ATAC) {
      if (value === 0) this._awardPoint('rival', 'ATAC_0');
      else if (value === 3) this._awardPoint('team', 'ATAC_3');
      else {
        this.state.game.phase = PHASE.DEFENSA;
        this.state.flow.rivalTransit = true;
      }
    }

    this._validate();
    return this.snapshot();
  }

  activateSOS() {
    assert(this.state.flow.sos.status === 'available', 'SOS no disponible');
    this._checkpoint('SOS ACTIVAR');
    const sos = clone(this.state.flow.sos);
    const point = this._findAction(sos.provisionalPointActionId);
    assert(point && point.active && point.provisional, 'Punt provisional de SOS no trobat');

    // Restaurar marcador i servei/rotació des del checkpoint anterior al 0 seria massa ampli:
    // el 0 s'ha de conservar. Per això desfem només els efectes del punt provisional.
    this.state.game.score = clone(point.data.scoreBefore);

    // El punt provisional pot haver canviat servei i rotació. Recuperem aquests camps del
    // checkpoint creat just abans de la valoració 0, però conservem l'acció 0 al log.
    const preZero = this.undoStack[this.undoStack.length - 2];
    if (preZero && preZero.state) {
      this.state.game.servingSide = preZero.state.game.servingSide;
      this.state.game.court = clone(preZero.state.game.court);
    }

    this._revertAction(point.actionId, 'SOS');
    // També s'ha pogut registrar una rotació automàtica com a conseqüència del punt provisional.
    for (const a of this.log.actions) {
      if (a.sequence > point.sequence - 2 && a.sequence < point.sequence && a.type === ACTION.ROTATION && a.active) {
        a.active = false;
        a.revertedBy = 'SOS';
      }
    }

    this.state.flow.sos = { status: 'active', origin: sos.origin, provisionalPointActionId: point.actionId };
    this.state.game.phase = sos.origin.phase;
    this.state.flow.rivalTransit = false;
    this.state.flow.rivalCourtAvailable = false;
    this._append(ACTION.SOS_ACTIVATE, { origin: sos.origin, provisionalPointActionId: point.actionId });
    this._validate();
    return this.snapshot();
  }

  rivalCourt() {
    assert(this.state.flow.rivalCourtAvailable, 'Camp rival no disponible');
    assert(!this.state.flow.temporaryMode, 'Mode temporal actiu');
    this._checkpoint('CAMP RIVAL');
    const from = this.state.lastActionId;
    this._append(ACTION.CAMP_RIVAL, { fromActionId: from });
    this.state.flow.rivalCourtAvailable = false;
    this.state.flow.rivalTransit = true;
    this.state.game.phase = PHASE.DEFENSA;
    this._validate();
    return this.snapshot();
  }

  block(zone, value) {
    zone = String(zone);
    assert(['2','3','4'].includes(zone), 'Bloqueig només a zones davanteres 2, 3 i 4');
    assert([0,1,2].includes(value), 'Bloqueig només admet 0, 1 o 2');
    assert(!this.state.flow.temporaryMode, 'Mode temporal actiu');
    const playerId = this.state.game.court[zone];
    this._checkpoint(`BLOQUEIG ${playerId} ${value}`);
    this._append(ACTION.BLOQUEIG, { playerId, zone, value });
    this.state.game.phase = PHASE.BLOQUEIG;
    this.state.flow.rivalTransit = false;
    this.state.flow.rivalCourtAvailable = false;
    if (value === 0) this._awardPoint('rival', 'BLOQUEIG_0');
    else if (value === 2) this._awardPoint('team', 'BLOQUEIG_2');
    else {
      this.state.game.phase = PHASE.DEFENSA;
      this.state.flow.rivalCourtAvailable = true;
    }
    this._validate();
    return this.snapshot();
  }

  changePositions(newCourt) {
    assert(newCourt && ZONES.every(z => newCourt[z]), 'Calen sis zones');
    const ids = ZONES.map(z => newCourt[z]);
    assert(unique(ids), 'Les sis jugadores han de ser diferents');
    for (const id of ids) assert(this.state.roster.calledPlayerIds.includes(id), 'Jugadora no convocada a posicions');
    this._checkpoint('POSICIONS');
    const before = clone(this.state.game.court);
    this.state.game.court = clone(newCourt);
    this._append(ACTION.POSITION_CHANGE, { before, after: clone(newCourt) });
    this._validate();
    return this.snapshot();
  }

  substitute(playerOutId, playerInId) {
    const zone = ZONES.find(z => this.state.game.court[z] === playerOutId);
    assert(zone, 'La jugadora que surt no és a pista');
    assert(this.state.roster.calledPlayerIds.includes(playerInId), 'La jugadora que entra no està convocada');
    assert(!Object.values(this.state.game.court).includes(playerInId), 'La jugadora que entra ja és a pista');
    this._checkpoint(`CANVI ${playerOutId} -> ${playerInId}`);
    this.state.game.court[zone] = playerInId;
    this._append(ACTION.SUBSTITUTION, { playerOutId, playerInId, zone, score: clone(this.state.game.score) });
    this._validate();
    return this.snapshot();
  }

  manualPoint(side) {
    assert(['team','rival'].includes(side), 'Costat invàlid');
    this.state.scoreCorrection = this.state.scoreCorrection || { team:0, rival:0 };
    this._checkpoint(`PUNT MANUAL ${side}`);
    if (this.state.scoreCorrection[side] > 0) {
      const before = clone(this.state.game.score);
      this.state.game.score[side]++;
      this.state.scoreCorrection[side]--;
      this._append(ACTION.SCORE_CORRECTION,{ side, delta:+1, scoreBefore:before, scoreAfter:clone(this.state.game.score) });
    } else {
      this._awardPoint(side, 'MARCADOR', { manual: true });
    }
    this._validate();
    return this.snapshot();
  }

  manualMinus(side) {
    assert(['team','rival'].includes(side), 'Costat invàlid');
    assert(this.state.game.score[side] > 0, 'No es pot baixar de zero');
    const other = side === 'team' ? 'rival' : 'team';
    this.state.scoreCorrection = this.state.scoreCorrection || { team:0, rival:0 };

    // Mateixa filosofia de la Capa 7: si l'últim checkpoint correspon inequívocament
    // a l'últim punt d'aquest costat, restaurem el paquet complet (servei/rotació/fase).
    const last = this.undoStack[this.undoStack.length - 1];
    if (last && last.state &&
        this.state.game.score[side] === last.state.game.score[side] + 1 &&
        this.state.game.score[other] === last.state.game.score[other]) {
      this.undoStack.pop();
      this.state = clone(last.state);
      this.log = clone(last.actionLog);
      this._validate();
      return this.snapshot();
    }

    this._checkpoint(`CORRECCIÓ - ${side}`);
    const before = clone(this.state.game.score);
    this.state.game.score[side]--;
    this.state.scoreCorrection[side]++;
    this._append(ACTION.SCORE_CORRECTION,{ side, delta:-1, scoreBefore:before, scoreAfter:clone(this.state.game.score) });
    this._validate();
    return this.snapshot();
  }


  getSetWins() {
    const wins = { team: 0, rival: 0 };
    for (const set of this.state.game.sets || []) {
      if (set && (set.winner === 'team' || set.winner === 'rival')) wins[set.winner]++;
    }
    return wins;
  }

  isMatchDecided() {
    const wins = this.getSetWins();
    return wins.team >= 3 || wins.rival >= 3 || this.state.game.currentSet >= 5;
  }

  canStartNextSet() {
    return this.state.lifecycle.status === 'active' &&
      !!this.state.flow.awaitingNextSet &&
      !this.isMatchDecided() &&
      this.state.game.currentSet < 5;
  }

  finishSet() {
    assert(this.state.lifecycle.status === 'active', 'Partit finalitzat');
    assert(!this.state.flow.awaitingNextSet, 'El set ja està tancat');
    this._checkpoint(`FINAL SET ${this.state.game.currentSet}`);
    const result = {
      set: this.state.game.currentSet,
      team: this.state.game.score.team,
      rival: this.state.game.score.rival,
      winner: this.state.game.score.team > this.state.game.score.rival ? 'team' : (this.state.game.score.rival > this.state.game.score.team ? 'rival' : 'tie')
    };
    this.state.game.sets.push(result);
    this._append(ACTION.SET_END, clone(result));
    this.state.flow.awaitingNextSet = true;
    this.state.flow.rivalCourtAvailable = false;
    this.state.flow.rivalTransit = false;
    this.state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
    this._validate();
    return this.snapshot();
  }

  startNextSet({ court, servingSide }) {
    assert(this.state.lifecycle.status === 'active', 'Partit finalitzat');
    assert(this.state.flow.awaitingNextSet, 'No hi ha cap set pendent d\'iniciar');
    assert(!this.isMatchDecided(), 'El partit ja està decidit');
    assert(this.state.game.currentSet < 5, 'No es poden iniciar més de 5 sets');
    assert(court && ZONES.every(z => court[z]), 'Calen sis zones per iniciar el set');
    const ids = ZONES.map(z => court[z]);
    assert(unique(ids), 'Les sis jugadores del set han de ser diferents');
    for (const id of ids) assert(this.state.roster.calledPlayerIds.includes(id), 'Jugadora no convocada al nou set');
    assert(['team','rival'].includes(servingSide), 'Servei inicial del set invàlid');

    this._checkpoint(`INICI SET ${this.state.game.currentSet + 1}`);
    this.state.game.currentSet++;
    this.state.game.score = { team: 0, rival: 0 };
    this.state.game.court = clone(court);
    this.state.game.servingSide = servingSide;
    this.state.game.phase = servingSide === 'team' ? PHASE.SERVEI : PHASE.RECEPCIO;
    this.state.flow.awaitingNextSet = false;
    this.state.flow.rivalCourtAvailable = false;
    this.state.flow.rivalTransit = false;
    this.state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
    this._append(ACTION.SET_START, { set: this.state.game.currentSet, court: clone(court), servingSide });
    this._validate();
    return this.snapshot();
  }

  finishMatch() {
    assert(this.state.lifecycle.status === 'active', 'Partit ja finalitzat');
    this._checkpoint('FINAL PARTIT');
    this.state.lifecycle.status = 'finished';
    const finishedAt = this._nextOccurredAt();
    this.state.lifecycle.finishedAt = finishedAt;
    this._append(ACTION.MATCH_END, {
      sets: clone(this.state.game.sets),
      currentSet: this.state.game.currentSet,
      score: clone(this.state.game.score),
      finishedAt
    }, { occurredAt: finishedAt });
    this._validate();
    return this.snapshot();
  }

  undo() {
    assert(this.undoStack.length, 'No hi ha res per desfer');
    const previous = this.undoStack.pop();
    this.state = clone(previous.state);
    this.log = clone(previous.actionLog);
    this._validate();
    return this.snapshot();
  }

  getActiveActions() {
    return this.log.actions.filter(a => a.active);
  }

  getStatActions() {
    return this.getActiveActions().filter(a => [ACTION.SERVEI,ACTION.RECEPCIO,ACTION.DEFENSA,ACTION.COLLOCACIO,ACTION.ATAC,ACTION.BLOQUEIG,ACTION.SALVADA].includes(a.type));
  }

  _validate() {
    const s = this.state;
    assert(s && s.identity && s.identity.matchId, 'MatchState sense matchId');
    assert(this.log && this.log.matchId === s.identity.matchId, 'ActionLog i MatchState no coincideixen');
    assert(s.lifecycle.status === 'active' || s.lifecycle.status === 'finished', 'Estat de cicle invàlid');
    assert(s.game.score.team >= 0 && s.game.score.rival >= 0, 'Marcador negatiu');
    const ids = ZONES.map(z => s.game.court[z]);
    assert(ids.every(Boolean) && unique(ids), 'Pista invàlida');
    for (const id of ids) assert(s.roster.calledPlayerIds.includes(id), 'Jugadora a pista no convocada');
    if (s.flow.sos.status === 'active') assert([PHASE.RECEPCIO,PHASE.DEFENSA].includes(s.game.phase), 'SOS actiu fora de R/D');
  }
}

module.exports = { MatchEngine };

};
modules['./match-factory']=function(module,exports,require){
'use strict';

const { clone, assert, unique } = require('./utils');
const { PHASE, ACTION } = require('./constants');

function validateDraft(draft) {
  assert(draft && typeof draft === 'object', 'DraftMatch absent');
  assert(draft.match && String(draft.match.opponent || '').trim(), 'Rival obligatori');
  assert(draft.team && draft.team.teamId, 'teamId obligatori');
  assert(Array.isArray(draft.rosterSnapshot), 'rosterSnapshot obligatori');
  assert(Array.isArray(draft.calledPlayerIds) && draft.calledPlayerIds.length >= 6, 'Calen com a mínim 6 convocades');
  assert(Array.isArray(draft.startingSixIds) && draft.startingSixIds.length === 6, 'Calen exactament 6 titulars');
  assert(unique(draft.startingSixIds), 'Les 6 titulars han de ser diferents');
  for (const id of draft.startingSixIds) assert(draft.calledPlayerIds.includes(id), 'Titular no convocada: ' + id);

  const zones = ['1','2','3','4','5','6'];
  assert(draft.positions && zones.every(z => draft.positions[z]), 'Calen les 6 posicions');
  const ids = zones.map(z => draft.positions[z]);
  assert(unique(ids), 'Les 6 posicions han de contenir jugadores diferents');
  for (const id of ids) assert(draft.startingSixIds.includes(id), 'Posició amb jugadora fora del sis inicial: ' + id);

  assert(draft.initialServe && ['team','rival'].includes(draft.initialServe.side), 'Servei inicial invàlid');
  if (draft.initialServe.side === 'team') {
    assert(draft.initialServe.serverPlayerId === draft.positions['1'], 'La servidora inicial ha de ser la jugadora de zona 1');
  } else {
    assert(draft.initialServe.serverPlayerId == null, 'Si serveix el rival no hi ha servidora pròpia');
  }
}

function createMatchFromDraft(draft, options = {}) {
  validateDraft(draft);
  const now = options.now || new Date().toISOString();
  const matchId = options.matchId || `match-${Date.now()}`;

  const state = {
    schemaVersion: 1,
    identity: { matchId, createdAt: now, updatedAt: now },
    metadata: {
      teamId: draft.team.teamId,
      teamName: draft.team.name,
      opponent: draft.match.opponent,
      date: draft.match.date,
      venue: draft.match.venue
    },
    roster: {
      snapshot: clone(draft.rosterSnapshot),
      calledPlayerIds: clone(draft.calledPlayerIds)
    },
    game: {
      currentSet: 1,
      score: { team: 0, rival: 0 },
      sets: [],
      servingSide: draft.initialServe.side,
      phase: draft.initialServe.side === 'team' ? PHASE.SERVEI : PHASE.RECEPCIO,
      court: clone(draft.positions)
    },
    flow: {
      rivalCourtAvailable: false,
      rivalTransit: false,
      sos: { status: 'unavailable', origin: null, provisionalPointActionId: null },
      temporaryMode: null,
      awaitingNextSet: false
    },
    scoreCorrection: { team: 0, rival: 0 },
    lifecycle: { status: 'active', finishedAt: null },
    lastActionId: null
  };

  const actionLog = {
    schemaVersion: 3,
    matchId,
    nextSequence: 2,
    actions: [{
      actionId: `${matchId}:1`, sequence: 1, set: 1, type: ACTION.MATCH_START,
      active: true, provisional: false, revertedBy: null, occurredAt: now, data: { servingSide: state.game.servingSide, court: clone(state.game.court), genesis: clone(state) }
    }]
  };
  state.lastActionId = actionLog.actions[0].actionId;

  return { state, actionLog };
}

module.exports = { validateDraft, createMatchFromDraft };

};
modules['./match-report']=function(module,exports,require){
'use strict';

const { clone } = require('./utils');
const { calculateStats, ANNA_TYPES } = require('./stats-engine');
const { calculateParticipation } = require('./participation-engine');
const { ACTION } = require('./constants');
const { assertReportConsistency } = require('./report-consistency');
const { applyPostMatchEditsToReport } = require('./post-match-edits');

const ACTION_LABEL = Object.freeze({
  [ACTION.MATCH_START]:'Inici partit',
  [ACTION.SERVEI]:'Servei',
  [ACTION.RECEPCIO]:'Recepció',
  [ACTION.DEFENSA]:'Defensa',
  [ACTION.COLLOCACIO]:'Col·locació',
  [ACTION.ATAC]:'Atac',
  [ACTION.BLOQUEIG]:'Bloqueig',
  [ACTION.SALVADA]:'Salvada',
  [ACTION.POINT]:'Punt',
  [ACTION.SOS_ACTIVATE]:'SOS',
  [ACTION.CAMP_RIVAL]:'Camp rival',
  [ACTION.ROTATION]:'Rotació',
  [ACTION.POSITION_CHANGE]:'Posicions',
  [ACTION.SUBSTITUTION]:'Canvi',
  [ACTION.SCORE_CORRECTION]:'Correcció marcador',
  [ACTION.SET_END]:'Final set',
  [ACTION.SET_START]:'Inici set',
  [ACTION.MATCH_END]:'Final partit'
});

function normalizeActionRows(actionLog, playersById) {
  const out=[];
  for(const a of (actionLog.actions||[]).slice().sort((x,y)=>x.sequence-y.sequence)) {
    if(a.active===false) continue;
    const d=a.data||{};
    const p=d.playerId ? playersById[d.playerId] : null;
    const pOut=d.playerOutId ? playersById[d.playerOutId] : null;
    const pIn=d.playerInId ? playersById[d.playerInId] : null;
    const scoreAfter=d.scoreAfter||d.score||null;
    let detail='';
    if(a.type===ACTION.SUBSTITUTION) detail=`${pOut?.name||d.playerOutId||''} → ${pIn?.name||d.playerInId||''}`;
    else if(a.type===ACTION.POSITION_CHANGE) detail='Recol·locació de les sis jugadores';
    else if(a.type===ACTION.ROTATION) detail='Rotació automàtica';
    else if(a.type===ACTION.POINT) detail=d.side==='team'?'Punt Castellar':'Punt rival';
    else if(a.type===ACTION.SCORE_CORRECTION) detail=`${d.delta>0?'+':'−'} ${d.side==='team'?'Castellar':'Rival'}`;
    else if(a.type===ACTION.CAMP_RIVAL) detail='Pilota a camp rival';
    else if(a.type===ACTION.SOS_ACTIVATE) detail='Activació de salvada';
    else if(a.type===ACTION.SET_END) detail='Tancament de set';
    else if(a.type===ACTION.SET_START) detail='Preparació del set';
    else if(a.type===ACTION.MATCH_END) detail='Partit finalitzat';
    out.push({
      sequence:a.sequence,
      actionId:a.actionId,
      set:a.set,
      type:a.type,
      label:ACTION_LABEL[a.type]||a.type,
      playerId:d.playerId||null,
      number:p?.number??null,
      playerName:p?.name||null,
      zone:d.zone??null,
      value:Number.isInteger(d.value)?d.value:null,
      teamScore:scoreAfter?.team??null,
      rivalScore:scoreAfter?.rival??null,
      detail,
      provisional:!!a.provisional
    });
  }
  return out;
}

function buildStatsRows(stats, participation, playersById) {
  const involved=new Set([...Object.keys(stats.players||{}),...Object.keys(participation.byPlayer||{})]);
  const emptyBucket=()=>({counts:{0:0,1:0,2:0,3:0},actions:0,annaPoints:0,efficiency:null,percentages:{0:null,1:null,2:null,3:null}});
  return [...involved].map(playerId=>{
    const p=stats.players[playerId]||{playerId,anna:Object.fromEntries(ANNA_TYPES.map(t=>[t,emptyBucket()])),annaTotal:emptyBucket(),impact:null,saves:{counts:{1:0,2:0,3:0},total:0,details:[]},blocks:{counts:{0:0,1:0,2:0},total:0,details:[]}};
    return {...playersById[playerId],...p,participation:clone(participation.byPlayer[playerId]||{playerId,sets:{},points:0,totalPoints:participation.totalPoints,participation:null,setsPlayed:0})};
  }).sort((a,b)=>(a.number??999)-(b.number??999));
}

function calculateSetBreakdown(state, actionLog, playersById) {
  const active=(actionLog.actions||[]).filter(a=>a.active!==false);
  const setNumbers=[...new Set([
    ...(state.game.sets||[]).map(s=>s.set),
    ...active.map(a=>a.set).filter(Number.isInteger)
  ])].sort((a,b)=>a-b);
  const out={};
  for(const setNo of setNumbers) {
    const subLog={schemaVersion:actionLog.schemaVersion,matchId:actionLog.matchId,actions:active.filter(a=>a.set===setNo)};
    const stats=calculateStats(subLog);
    const participation=calculateParticipation(subLog);
    out[setNo]={
      set:setNo,
      teamAnnaActions:stats.teamAnnaActions,
      teamAnna:clone(stats.teamAnna),
      teamAnnaTotal:clone(stats.teamAnnaTotal),
      teamSaves:clone(stats.teamSaves),
      teamBlocks:clone(stats.teamBlocks),
      participation:clone(participation),
      players:buildStatsRows(stats,participation,playersById)
    };
  }
  return out;
}

function buildMatchReport(state, actionLog) {
  const stats=calculateStats(actionLog);
  const participation=calculateParticipation(actionLog);
  const playersById=Object.fromEntries((state.roster.snapshot||[]).map(p=>[p.playerId,p]));
  const rows=buildStatsRows(stats,participation,playersById);
  const bySet=calculateSetBreakdown(state,actionLog,playersById);
  const actions=normalizeActionRows(actionLog,playersById);
  const inactive=(actionLog.actions||[]).filter(a=>a.active===false).length;

  const report = {
    schemaVersion:4,
    matchId:state.identity.matchId,
    metadata:clone(state.metadata),
    result:{sets:clone(state.game.sets),currentSet:state.game.currentSet,currentScore:clone(state.game.score)},
    stats:{
      teamAnnaActions:stats.teamAnnaActions,
      teamAnna:clone(stats.teamAnna),
      teamAnnaTotal:clone(stats.teamAnnaTotal),
      teamSaves:clone(stats.teamSaves),
      teamBlocks:clone(stats.teamBlocks),
      participation:clone(participation),
      players:rows,
      bySet
    },
    actions,
    audit:{activeActions:actions.length,revertedActions:inactive},
    generatedFrom:{actionLogVersion:actionLog.schemaVersion,lastActionId:state.lastActionId}
  };
  assertReportConsistency(report);
  return report;
}

function reportFromCompletedRecord(record) {
  let base=null;
  if(record?.finalState && record?.actionLog) base=buildMatchReport(record.finalState,record.actionLog);
  else if(record?.report) base=clone(record.report);
  return base ? applyPostMatchEditsToReport(base,record?.postMatchEdits||null) : null;
}


module.exports = { buildMatchReport, reportFromCompletedRecord, normalizeActionRows, ACTION_LABEL };

};
modules['./participation-engine']=function(module,exports,require){
'use strict';
const { ACTION } = require('./constants');

function calculateParticipation(actionLog) {
  const actions=(actionLog.actions||[]).filter(a=>a.active!==false).slice().sort((a,b)=>a.sequence-b.sequence);
  const sets={}; let currentSet=1; let lineup=new Set();
  function ensureSet(n){if(!sets[n])sets[n]={set:n,points:[],lineupStart:[]};return sets[n];}
  function setCourt(court){lineup=new Set(Object.values(court||{}).filter(Boolean));}
  for(const a of actions){const d=a.data||{};currentSet=a.set||currentSet;const s=ensureSet(currentSet);
    if(a.type===ACTION.MATCH_START){setCourt(d.court);s.lineupStart=[...lineup];continue;}
    if(a.type===ACTION.SET_START){currentSet=d.set||a.set||currentSet;const ns=ensureSet(currentSet);setCourt(d.court);ns.lineupStart=[...lineup];continue;}
    if(a.type===ACTION.SUBSTITUTION){if(d.playerOutId)lineup.delete(d.playerOutId);if(d.playerInId)lineup.add(d.playerInId);continue;}
    if(a.type===ACTION.POINT){s.points.push({side:d.side||null,players:[...lineup],sequence:a.sequence,removed:false});continue;}
    if(a.type===ACTION.SCORE_CORRECTION){if(d.delta===-1){for(let i=s.points.length-1;i>=0;i--){const p=s.points[i];if(!p.removed&&(!d.side||p.side===d.side)){p.removed=true;break;}}}else if(d.delta===1){s.points.push({side:d.side||null,players:[...lineup],sequence:a.sequence,removed:false,correction:true});}continue;}
  }
  const byPlayer={}; let globalPoints=0;
  for(const s of Object.values(sets)){const effective=s.points.filter(p=>!p.removed),total=effective.length;globalPoints+=total;const counts={};for(const p of effective)for(const id of p.players)counts[id]=(counts[id]||0)+1;s.totalPoints=total;s.playerPoints=counts;for(const [id,n] of Object.entries(counts)){if(!byPlayer[id])byPlayer[id]={playerId:id,sets:{},points:0,totalPoints:0,participation:null,setsPlayed:0};byPlayer[id].sets[s.set]={points:n,totalPoints:total,participation:total?n/total:null};byPlayer[id].points+=n;byPlayer[id].setsPlayed++;}}
  for(const p of Object.values(byPlayer)){p.totalPoints=globalPoints;p.participation=globalPoints?p.points/globalPoints:null;}
  return {sets,byPlayer,totalPoints:globalPoints};
}
module.exports={calculateParticipation};

};
modules['./post-match-edits']=function(module,exports,require){
'use strict';
const { clone, assert } = require('./utils');
const { ACTION } = require('./constants');
const { ANNA_TYPES, calculateStats } = require('./stats-engine');
const { valueDigest } = require('./session-integrity');

const EDITABLE_TYPES=new Set([...ANNA_TYPES,ACTION.BLOQUEIG,ACTION.SALVADA]);
function allowedValues(type){
  if(ANNA_TYPES.includes(type)) return [0,1,2,3];
  if(type===ACTION.BLOQUEIG) return [0,1,2];
  if(type===ACTION.SALVADA) return [1,2,3];
  return [];
}
function payload(edits){return {version:1,edits:clone(edits||[])};}
function sealPostMatchEdits(edits){const p=payload(edits);return {...p,algorithm:'fnv1a32-stable-json',digest:valueDigest(p)};}
function verifyPostMatchEdits(envelope,baseReport){
  if(!envelope) return {ok:true,count:0,digest:null};
  assert(envelope.version===1 && envelope.algorithm==='fnv1a32-stable-json','Integritat d’edicions postpartit desconeguda');
  assert(envelope.digest===valueDigest(payload(envelope.edits)),'Edicions postpartit manipulades');
  const values=new Map((baseReport?.actions||[]).filter(a=>EDITABLE_TYPES.has(a.type)&&Number.isInteger(a.value)).map(a=>[a.actionId,a.value]));
  for(const e of envelope.edits||[]){
    assert(values.has(e.actionId),'Edició postpartit sobre una acció inexistent');
    const row=(baseReport.actions||[]).find(a=>a.actionId===e.actionId);
    assert(allowedValues(row.type).includes(e.newValue),'Valor postpartit invàlid');
    assert(values.get(e.actionId)===e.previousValue,'Cadena d’edicions postpartit inconsistent');
    values.set(e.actionId,e.newValue);
  }
  return {ok:true,count:(envelope.edits||[]).length,digest:envelope.digest};
}
function emptyBucket(){return {counts:{0:0,1:0,2:0,3:0},actions:0,annaPoints:0,efficiency:null,percentages:{0:null,1:null,2:null,3:null}};}
function emptyPlayer(playerId){return {playerId,anna:Object.fromEntries(ANNA_TYPES.map(t=>[t,emptyBucket()])),annaTotal:emptyBucket(),impact:null,saves:{counts:{1:0,2:0,3:0},total:0,details:[]},blocks:{counts:{0:0,1:0,2:0},total:0,details:[]}};}
function statsRows(stats,basePlayers,participation){
  const byId=Object.fromEntries((basePlayers||[]).map(p=>[p.playerId,p]));
  const ids=new Set([...Object.keys(byId),...Object.keys(stats.players||{})]);
  return [...ids].map(id=>{
    const base=byId[id]||{playerId:id,number:null,name:id};
    const st=stats.players[id]||emptyPlayer(id);
    return {...clone(base),...clone(st),participation:clone(participation?.byPlayer?.[id]||base.participation||{playerId:id,sets:{},points:0,totalPoints:0,participation:null,setsPlayed:0})};
  }).sort((a,b)=>(Number(a.number)||999)-(Number(b.number)||999));
}
function applyPostMatchEditsToReport(baseReport,envelope){
  if(!envelope || !(envelope.edits||[]).length) return clone(baseReport);
  verifyPostMatchEdits(envelope,baseReport);
  const out=clone(baseReport), editsByAction=new Map();
  for(const e of envelope.edits) editsByAction.set(e.actionId,e);
  for(const a of out.actions||[]){
    const e=editsByAction.get(a.actionId); if(!e) continue;
    if(a.originalValue==null) a.originalValue=a.value;
    a.value=e.newValue; a.editedPostMatch=true; a.lastEditedAt=e.editedAt||null;
  }
  const pseudo={schemaVersion:1,matchId:out.matchId,actions:(out.actions||[]).filter(a=>EDITABLE_TYPES.has(a.type)&&Number.isInteger(a.value)).map((a,i)=>({sequence:a.sequence??i+1,actionId:a.actionId,set:a.set,type:a.type,active:true,data:{playerId:a.playerId,value:a.value}}))};
  const stats=calculateStats(pseudo), participation=clone(baseReport.stats?.participation||{byPlayer:{},totalPoints:0});
  out.stats.teamAnnaActions=stats.teamAnnaActions;out.stats.teamAnna=clone(stats.teamAnna);out.stats.teamAnnaTotal=clone(stats.teamAnnaTotal);out.stats.teamSaves=clone(stats.teamSaves);out.stats.teamBlocks=clone(stats.teamBlocks);out.stats.players=statsRows(stats,baseReport.stats?.players||[],participation);
  const setNos=Object.keys(baseReport.stats?.bySet||{}).map(Number);
  out.stats.bySet={};
  for(const n of setNos){
    const sub={actions:pseudo.actions.filter(a=>Number(a.set)===n)}, st=calculateStats(sub), old=baseReport.stats.bySet[n]||{};
    out.stats.bySet[n]={...clone(old),teamAnnaActions:st.teamAnnaActions,teamAnna:clone(st.teamAnna),teamAnnaTotal:clone(st.teamAnnaTotal),teamSaves:clone(st.teamSaves),teamBlocks:clone(st.teamBlocks),players:statsRows(st,old.players||baseReport.stats?.players||[],old.participation||participation)};
  }
  out.audit={...(out.audit||{}),postMatchEdits:(envelope.edits||[]).length,postMatchEditDigest:envelope.digest};
  out.generatedFrom={...(out.generatedFrom||{}),postMatchEditDigest:envelope.digest};
  return out;
}
function appendPostMatchEdit(baseReport,envelope,actionId,newValue,editedAt=new Date().toISOString()){
  const current=applyPostMatchEditsToReport(baseReport,envelope), row=(current.actions||[]).find(a=>a.actionId===actionId);
  assert(row && EDITABLE_TYPES.has(row.type),'Aquesta acció no es pot editar');
  const v=Number(newValue); assert(Number.isInteger(v)&&allowedValues(row.type).includes(v),'Valor nou no permès per a aquesta acció');
  assert(row.value!==v,'El valor nou és igual que l’actual');
  const edits=clone(envelope?.edits||[]);edits.push({editId:`post:${Date.now()}:${edits.length+1}`,actionId,rowType:row.type,playerId:row.playerId||null,set:row.set??null,previousValue:row.value,newValue:v,editedAt});
  return sealPostMatchEdits(edits);
}
module.exports={EDITABLE_TYPES,allowedValues,sealPostMatchEdits,verifyPostMatchEdits,applyPostMatchEditsToReport,appendPostMatchEdit};

};
modules['./report-consistency']=function(module,exports,require){
'use strict';
const { ANNA_TYPES } = require('./stats-engine');

function sumCounts(target, source, keys) {
  for (const k of keys) target[k] = (target[k] || 0) + Number(source?.[k] || 0);
  return target;
}
function sameCounts(a,b,keys){return keys.every(k=>Number(a?.[k]||0)===Number(b?.[k]||0));}

function validateReportConsistency(report) {
  const errors=[];
  const players=report?.stats?.players||[];
  const teamAnna=report?.stats?.teamAnna||{};
  const keys=[0,1,2,3];

  for(const t of ANNA_TYPES){
    const sum={0:0,1:0,2:0,3:0};
    for(const p of players) sumCounts(sum,p?.anna?.[t]?.counts,keys);
    if(!sameCounts(sum,teamAnna?.[t]?.counts,keys)) errors.push(`Fonament ${t}: els totals d'equip no coincideixen amb la suma de jugadores`);
  }

  const total={0:0,1:0,2:0,3:0};
  for(const t of ANNA_TYPES) sumCounts(total,teamAnna?.[t]?.counts,keys);
  if(!sameCounts(total,report?.stats?.teamAnnaTotal?.counts,keys)) errors.push('Anna total: no coincideix amb la suma dels cinc fonaments');

  const saves={1:0,2:0,3:0};
  for(const p of players) sumCounts(saves,p?.saves?.counts,[1,2,3]);
  if(!sameCounts(saves,report?.stats?.teamSaves?.counts,[1,2,3])) errors.push('Salvades: els totals d’equip no coincideixen amb la suma de jugadores');

  const blocks={0:0,1:0,2:0};
  for(const p of players) sumCounts(blocks,p?.blocks?.counts,[0,1,2]);
  if(!sameCounts(blocks,report?.stats?.teamBlocks?.counts,[0,1,2])) errors.push('Bloqueig: els totals d’equip no coincideixen amb la suma de jugadores');

  const actionRows=report?.actions||[];
  if(Number(report?.audit?.activeActions??actionRows.length)!==actionRows.length) errors.push('Audit: activeActions no coincideix amb les files d’accions actives');

  return { ok: errors.length===0, errors };
}

function assertReportConsistency(report){
  const r=validateReportConsistency(report);
  if(!r.ok) throw new Error('MatchReport inconsistent: '+r.errors.join(' | '));
  return true;
}

module.exports={validateReportConsistency,assertReportConsistency};

};
modules['./report-integrity']=function(module,exports,require){
'use strict';

const { assert, clone } = require('./utils');
const { valueDigest, sessionDigest, stableStringify } = require('./session-integrity');

const REPORT_INTEGRITY_VERSION = 1;
const REPORT_INTEGRITY_ALGORITHM = 'fnv1a32-stable-json';

function makeReportIntegrity(report, state, actionLog) {
  assert(report && typeof report === 'object', 'MatchReport absent');
  assert(state && actionLog, 'Font del MatchReport absent');
  return {
    version: REPORT_INTEGRITY_VERSION,
    algorithm: REPORT_INTEGRITY_ALGORITHM,
    reportDigest: valueDigest(report),
    sourceSessionDigest: sessionDigest(state, actionLog)
  };
}

function assessReportIntegrity(integrity, report, state, actionLog, expectedReport = null) {
  const sourceSessionDigest = sessionDigest(state, actionLog);
  const reportDigest = report && typeof report === 'object' ? valueDigest(report) : null;
  const expectedReportDigest = expectedReport && typeof expectedReport === 'object' ? valueDigest(expectedReport) : null;
  const derivationMatches = expectedReportDigest == null ? null : reportDigest === expectedReportDigest && stableStringify(report) === stableStringify(expectedReport);

  if (!integrity) {
    return {
      ok: false,
      legacy: true,
      reportTrusted: false,
      sourceTrusted: false,
      derivationMatches,
      reportDigest,
      expectedReportDigest,
      sourceSessionDigest
    };
  }

  assert(integrity.version === REPORT_INTEGRITY_VERSION, 'Versió d’integritat del MatchReport desconeguda');
  assert(integrity.algorithm === REPORT_INTEGRITY_ALGORITHM, 'Algoritme d’integritat del MatchReport desconegut');
  const reportTrusted = reportDigest === integrity.reportDigest;
  const sourceTrusted = sourceSessionDigest === integrity.sourceSessionDigest;
  return {
    ok: reportTrusted && sourceTrusted && derivationMatches !== false,
    legacy: false,
    reportTrusted,
    sourceTrusted,
    derivationMatches,
    reportDigest,
    expectedReportDigest,
    sourceSessionDigest
  };
}

function verifyReportIntegrity(integrity, report, state, actionLog, expectedReport = null) {
  const r = assessReportIntegrity(integrity, report, state, actionLog, expectedReport);
  assert(integrity, 'Integritat del MatchReport absent');
  assert(r.reportTrusted, 'Integritat del MatchReport no vàlida');
  assert(r.sourceTrusted, 'MatchReport vinculat a una sessió diferent');
  if (expectedReport) assert(r.derivationMatches, 'MatchReport no coincideix amb les dades derivades del partit');
  return r;
}

function repairReport(integrity, report, state, actionLog, expectedReport) {
  assert(expectedReport && typeof expectedReport === 'object', 'Cal MatchReport derivat per reparar');
  const assessment = assessReportIntegrity(integrity, report, state, actionLog, expectedReport);
  if (assessment.ok) return { repaired: false, reason: 'not-needed', assessment };
  return {
    repaired: true,
    report: clone(expectedReport),
    integrity: makeReportIntegrity(expectedReport, state, actionLog),
    assessment
  };
}

module.exports = { REPORT_INTEGRITY_VERSION, REPORT_INTEGRITY_ALGORITHM, makeReportIntegrity, assessReportIntegrity, verifyReportIntegrity, repairReport };

};
modules['./schema-migrations']=function(module,exports,require){
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

};
modules['./session-integrity']=function(module,exports,require){
'use strict';

const { assert, clone } = require('./utils');
const { ACTION } = require('./constants');
const { canReplayActionLog, replayActionLog } = require('./action-replay');

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

// FNV-1a 32-bit: no és criptogràfic; serveix per detectar corrupció accidental/incoherència.
function fnv1a32(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function valueDigest(value) { return fnv1a32(stableStringify(value)); }

function sessionDigest(state, actionLog) {
  return valueDigest({ state, actionLog });
}

function validateActionLog(actionLog, state = null) {
  assert(actionLog && typeof actionLog === 'object', 'ActionLog absent');
  assert(actionLog.matchId, 'ActionLog sense matchId');
  assert(Array.isArray(actionLog.actions) && actionLog.actions.length >= 1, 'ActionLog sense accions');
  assert(Number.isInteger(actionLog.nextSequence) && actionLog.nextSequence >= 2, 'nextSequence invàlid');

  let expected = 1;
  let previousOccurredAt = null;
  const ids = new Set();
  for (const a of actionLog.actions) {
    assert(a && typeof a === 'object', 'Acció invàlida');
    assert(a.sequence === expected, `Seqüència ActionLog trencada a ${expected}`);
    assert(a.actionId === `${actionLog.matchId}:${a.sequence}`, `actionId inconsistent a seqüència ${a.sequence}`);
    assert(!ids.has(a.actionId), `actionId duplicat: ${a.actionId}`);
    ids.add(a.actionId);
    assert(Number.isInteger(a.set) && a.set >= 1 && a.set <= 5, `Set invàlid a ${a.actionId}`);
    assert(typeof a.type === 'string' && a.type.length > 0, `Tipus absent a ${a.actionId}`);
    assert(typeof a.active === 'boolean', `Camp active invàlid a ${a.actionId}`);
    if (a.occurredAt != null) {
      assert(typeof a.occurredAt === 'string' && !Number.isNaN(Date.parse(a.occurredAt)), `occurredAt invàlid a ${a.actionId}`);
      if (previousOccurredAt != null) assert(Date.parse(a.occurredAt) >= Date.parse(previousOccurredAt), `Ordre temporal trencat a ${a.actionId}`);
      previousOccurredAt = a.occurredAt;
    } else if (actionLog.schemaVersion >= 3) {
      assert(false, `occurredAt absent a ${a.actionId}`);
    }

    const d = a.data || {};
    if ([ACTION.SERVEI,ACTION.RECEPCIO,ACTION.DEFENSA,ACTION.COLLOCACIO,ACTION.ATAC].includes(a.type)) {
      assert(Number.isInteger(d.value) && d.value >= 0 && d.value <= 3, `Valor 0–3 invàlid a ${a.actionId}`);
      assert(d.playerId, `playerId absent a ${a.actionId}`);
    }
    if (a.type === ACTION.SOS_AVAILABLE || a.type === ACTION.SOS_ACTIVATE) {
      assert(d.origin && [ACTION.RECEPCIO,ACTION.DEFENSA].includes(d.origin.phase), `Origen SOS invàlid a ${a.actionId}`);
      assert(d.provisionalPointActionId, `Punt provisional SOS absent a ${a.actionId}`);
    }
    if (a.type === ACTION.SALVADA) {
      assert([1,2,3].includes(d.value), `Salvada només admet 1/2/3 a ${a.actionId}`);
      assert(d.playerId, `playerId absent a ${a.actionId}`);
    }
    if (a.type === ACTION.BLOQUEIG) assert([0,1,2].includes(d.value), `Bloqueig només admet 0/1/2 a ${a.actionId}`);
    if (a.type === ACTION.POINT) {
      assert(['team','rival'].includes(d.side), `Costat de punt invàlid a ${a.actionId}`);
      assert(d.scoreBefore && d.scoreAfter, `Marcador absent a ${a.actionId}`);
    }
    expected++;
  }

  assert(actionLog.nextSequence === expected, 'nextSequence no coincideix amb l’ActionLog');

  if (state) {
    assert(state.identity && state.identity.matchId === actionLog.matchId, 'MatchState i ActionLog no coincideixen');
    const active = actionLog.actions.filter(a => a.active);
    const expectedLast = active.length ? active[active.length - 1].actionId : null;
    // lastActionId pot apuntar a la darrera acció afegida encara que després quedi revertida per SOS.
    if (state.lastActionId != null) assert(ids.has(state.lastActionId), 'lastActionId no existeix a ActionLog');
    assert(state.game && state.game.currentSet >= 1 && state.game.currentSet <= 5, 'currentSet fora de rang');
    assert(state.game.score && state.game.score.team >= 0 && state.game.score.rival >= 0, 'Marcador invàlid');
    if (state.identity?.updatedAt) assert(!Number.isNaN(Date.parse(state.identity.updatedAt)), 'updatedAt invàlid');
    if (actionLog.schemaVersion >= 3) {
      const last = actionLog.actions[actionLog.actions.length - 1];
      assert(state.identity?.updatedAt === last.occurredAt, 'updatedAt no coincideix amb la darrera acció');
      if (state.lifecycle?.status === 'finished') {
        const end = [...actionLog.actions].reverse().find(a => a.type === ACTION.MATCH_END && a.active !== false);
        assert(end && state.lifecycle.finishedAt === end.data?.finishedAt, 'finishedAt no coincideix amb MATCH_END');
        assert(state.lifecycle.finishedAt === end.occurredAt, 'finishedAt i occurredAt de MATCH_END divergeixen');
      }
    }
    void expectedLast;
  }
  return true;
}


function verifyReplayConsistency(state, actionLog) {
  if (!canReplayActionLog(actionLog)) return { ok: true, legacy: true };
  const rebuilt = replayActionLog(actionLog);
  assert(stableStringify(rebuilt) === stableStringify(state), 'Integritat: MatchState no coincideix amb la reproducció de l’ActionLog');
  return { ok: true, legacy: false };
}

function makeIntegrity(state, actionLog) {
  validateActionLog(actionLog, state);
  verifyReplayConsistency(state, actionLog);
  return {
    version: 2,
    algorithm: 'fnv1a32-stable-json',
    stateDigest: valueDigest(state),
    actionLogDigest: valueDigest(actionLog),
    digest: sessionDigest(state, actionLog)
  };
}

function assessIntegrity(integrity, state, actionLog) {
  validateActionLog(actionLog, null);
  const replayable = canReplayActionLog(actionLog);
  let rebuilt = null;
  if (replayable) rebuilt = replayActionLog(actionLog);

  if (!integrity) return { ok: true, legacy: true, replayable, rebuilt, stateTrusted: false, actionLogTrusted: false };
  assert(integrity.algorithm === 'fnv1a32-stable-json', 'Algoritme d’integritat desconegut');

  if (integrity.version === 1) {
    const digest = sessionDigest(state, actionLog);
    const ok = digest === integrity.digest;
    return {
      ok, legacy: true, replayable, rebuilt,
      stateTrusted: ok, actionLogTrusted: ok,
      replayMatchesState: replayable ? stableStringify(rebuilt) === stableStringify(state) : null,
      digest
    };
  }

  assert(integrity.version === 2, 'Versió d’integritat desconeguda');
  const stateDigest = valueDigest(state);
  const actionLogDigest = valueDigest(actionLog);
  const digest = sessionDigest(state, actionLog);
  const stateTrusted = stateDigest === integrity.stateDigest;
  const actionLogTrusted = actionLogDigest === integrity.actionLogDigest;
  const combinedTrusted = digest === integrity.digest;
  const replayMatchesState = replayable ? stableStringify(rebuilt) === stableStringify(state) : null;
  return {
    ok: stateTrusted && actionLogTrusted && combinedTrusted && (replayMatchesState !== false),
    legacy: false, replayable, rebuilt, stateTrusted, actionLogTrusted, combinedTrusted, replayMatchesState,
    stateDigest, actionLogDigest, digest
  };
}

function verifyIntegrity(integrity, state, actionLog) {
  validateActionLog(actionLog, state);
  const result = assessIntegrity(integrity, state, actionLog);
  if (!integrity) { verifyReplayConsistency(state, actionLog); return result; }
  assert(result.stateTrusted, 'Integritat de MatchState no vàlida');
  assert(result.actionLogTrusted, 'Integritat de l’ActionLog no vàlida');
  if (integrity.version === 2) assert(result.combinedTrusted, 'Integritat conjunta de dades no vàlida');
  if (result.replayable) assert(result.replayMatchesState, 'Integritat: MatchState no coincideix amb la reproducció de l’ActionLog');
  return result;
}

function recoverStateFromActionLog(integrity, state, actionLog) {
  const result = assessIntegrity(integrity, state, actionLog);
  if (!integrity || integrity.version !== 2) return { recovered: false, reason: 'legacy', assessment: result };
  if (!result.actionLogTrusted) return { recovered: false, reason: 'action-log-untrusted', assessment: result };
  if (!result.replayable || !result.rebuilt) return { recovered: false, reason: 'not-replayable', assessment: result };
  if (result.stateTrusted && result.replayMatchesState) return { recovered: false, reason: 'not-needed', assessment: result };
  const rebuilt = clone(result.rebuilt);
  validateActionLog(actionLog, rebuilt);
  return { recovered: true, state: rebuilt, integrity: makeIntegrity(rebuilt, actionLog), assessment: result };
}

module.exports = { stableStringify, fnv1a32, valueDigest, sessionDigest, validateActionLog, verifyReplayConsistency, assessIntegrity, recoverStateFromActionLog, makeIntegrity, verifyIntegrity };

};
modules['./simulator']=function(module,exports,require){
'use strict';

const { clone, assert } = require('./utils');
const { createMatchFromDraft } = require('./match-factory');
const { MatchEngine } = require('./match-engine');
const { PHASE } = require('./constants');

const ZONES=['1','2','3','4','5','6'];

function lineup(ids) {
  assert(ids.length===6,'El simulador necessita sis jugadores per set');
  return {'1':ids[0],'2':ids[1],'3':ids[2],'4':ids[3],'5':ids[4],'6':ids[5]};
}

function statPattern(engine) {
  // Patró deliberadament variat per alimentar Servei, Recepció/Defensa,
  // Col·locació, Atac i Salvada sense saltar-se la màquina d'estats.
  if(engine.state.game.phase===PHASE.RECEPCIO) {
    engine.ratePlayer('5',2);
    engine.ratePlayer('3',3);
    engine.ratePlayer('4',3);
  }
  if(engine.state.game.phase===PHASE.SERVEI) engine.ratePlayer('1',2);
  if(engine.state.game.phase===PHASE.DEFENSA) engine.ratePlayer('6',2);
  if(engine.state.game.phase===PHASE.COLLOCACIO) engine.ratePlayer('3',2);
  if(engine.state.game.phase===PHASE.ATAC) engine.ratePlayer('2',2);
  if(engine.state.game.phase===PHASE.DEFENSA) {
    engine.ratePlayer('5',0);
    if(engine.state.flow.sos.status==='available') {
      engine.activateSOS();
      engine.ratePlayer('4',3);
    }
  }
  if(engine.state.game.phase===PHASE.COLLOCACIO) engine.ratePlayer('3',2);
  if(engine.state.game.phase===PHASE.ATAC) engine.ratePlayer('4',3);
  if(engine.state.game.phase===PHASE.SERVEI) engine.ratePlayer('1',3);
}

function fillScore(engine, teamTarget=25, rivalTarget=20) {
  while(engine.state.game.score.team<teamTarget) engine.manualPoint('team');
  while(engine.state.game.score.rival<rivalTarget) engine.manualPoint('rival');
}

function simulateMatchFromDraft(draft, options={}) {
  const made=createMatchFromDraft(draft,{matchId:options.matchId,now:options.now});
  const engine=new MatchEngine(made.state,made.actionLog);
  const called=[...draft.calledPlayerIds];
  assert(called.length>=6,'El simulador necessita almenys sis convocades');

  const lineups=[];
  lineups.push(ZONES.map(z=>draft.positions[z]));
  if(called.length>=12) lineups.push(called.slice(6,12));
  else lineups.push(called.slice(0,6).reverse());
  if(called.length>=10) lineups.push([called[0],called[7]||called[1],called[2],called[9]||called[3],called[4],called[5]]);
  else lineups.push([called[1],called[2],called[3],called[4],called[5],called[0]]);

  for(let set=1; set<=3; set++) {
    if(set>1) engine.startNextSet({court:lineup(lineups[set-1]),servingSide:'rival'});
    statPattern(engine);
    fillScore(engine,25,20);
    engine.finishSet();
  }
  engine.finishMatch();
  return engine;
}

function buildSimulationDraft(team, options={}) {
  assert(team && team.teamId,'Cal un equip per simular');
  const players=(team.players||[]).filter(p=>p.active!==false);
  assert(players.length>=6,'Calen almenys sis jugadores actives per simular');
  const called=players.map(p=>p.playerId);
  const six=called.slice(0,6);
  const today=options.date || new Date().toISOString().slice(0,10);
  return {
    schemaVersion:1,
    draftId:'simulation-'+(options.matchId||Date.now()),
    team:clone(team),
    match:{opponent:options.opponent||'Rival de simulació',date:today,venue:options.venue||'home'},
    rosterSnapshot:clone(players),
    calledPlayerIds:called,
    startingSixIds:six,
    positions:lineup(six),
    initialServe:{side:'rival',serverPlayerId:null},
    completedSteps:{step1:true,step2:true,step3:true,step4:true},
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
}

module.exports={simulateMatchFromDraft,buildSimulationDraft};

};
modules['./stats-engine']=function(module,exports,require){
'use strict';

const { ACTION, STAT_ACTIONS_ANNA } = require('./constants');

const ANNA_SCORE = Object.freeze({0:0,1:5,2:8,3:10});
const ANNA_TYPES = [ACTION.SERVEI, ACTION.RECEPCIO, ACTION.COLLOCACIO, ACTION.ATAC, ACTION.DEFENSA];

function blankAnnaBucket() {
  return { counts:{0:0,1:0,2:0,3:0}, actions:0, annaPoints:0, efficiency:null, percentages:{0:null,1:null,2:null,3:null} };
}
function finalizeAnna(b) {
  b.actions = b.counts[0]+b.counts[1]+b.counts[2]+b.counts[3];
  b.annaPoints = b.counts[1]*5+b.counts[2]*8+b.counts[3]*10;
  b.efficiency = b.actions ? b.annaPoints/(b.actions*10) : null;
  for(const k of [0,1,2,3]) b.percentages[k] = b.actions ? b.counts[k]/b.actions : null;
  return b;
}
function ensurePlayer(map, playerId) {
  if(!map[playerId]) {
    map[playerId] = {
      playerId,
      anna: Object.fromEntries(ANNA_TYPES.map(t=>[t,blankAnnaBucket()])),
      annaTotal: blankAnnaBucket(),
      saves:{counts:{1:0,2:0,3:0},total:0,details:[]},
      blocks:{counts:{0:0,1:0,2:0},total:0,details:[]}
    };
  }
  return map[playerId];
}

function calculateStats(actionLog) {
  const actions=(actionLog.actions||[]).filter(a=>a.active!==false);
  const players={};
  let teamAnnaActions=0;
  const teamAnna=Object.fromEntries(ANNA_TYPES.map(t=>[t,blankAnnaBucket()]));
  const teamSaves={counts:{1:0,2:0,3:0},total:0,details:[]};
  const teamBlocks={counts:{0:0,1:0,2:0},total:0,details:[]};

  for(const a of actions) {
    const d=a.data||{};
    if(STAT_ACTIONS_ANNA.has(a.type)) {
      if(!d.playerId || !Number.isInteger(d.value) || d.value<0 || d.value>3) continue;
      const p=ensurePlayer(players,d.playerId);
      p.anna[a.type].counts[d.value]++;
      p.annaTotal.counts[d.value]++;
      teamAnna[a.type].counts[d.value]++;
      teamAnnaActions++;
    } else if(a.type===ACTION.SALVADA) {
      if(!d.playerId || ![1,2,3].includes(d.value)) continue;
      const p=ensurePlayer(players,d.playerId);
      p.saves.counts[d.value]++; p.saves.total++;
      p.saves.details.push({actionId:a.actionId,set:a.set,value:d.value,sequence:a.sequence});
      teamSaves.counts[d.value]++; teamSaves.total++;
      teamSaves.details.push({actionId:a.actionId,set:a.set,value:d.value,sequence:a.sequence,playerId:d.playerId});
    } else if(a.type===ACTION.BLOQUEIG) {
      if(!d.playerId || ![0,1,2].includes(d.value)) continue;
      const p=ensurePlayer(players,d.playerId);
      p.blocks.counts[d.value]++; p.blocks.total++;
      p.blocks.details.push({actionId:a.actionId,set:a.set,value:d.value,sequence:a.sequence});
      teamBlocks.counts[d.value]++; teamBlocks.total++;
      teamBlocks.details.push({actionId:a.actionId,set:a.set,value:d.value,sequence:a.sequence,playerId:d.playerId});
    }
  }

  for(const p of Object.values(players)) {
    for(const t of ANNA_TYPES) finalizeAnna(p.anna[t]);
    finalizeAnna(p.annaTotal);
    p.impact = teamAnnaActions ? p.annaTotal.annaPoints/(teamAnnaActions*10) : null;
  }
  for(const t of ANNA_TYPES) finalizeAnna(teamAnna[t]);
  const teamAnnaTotal=blankAnnaBucket();
  for(const t of ANNA_TYPES) for(const k of [0,1,2,3]) teamAnnaTotal.counts[k]+=teamAnna[t].counts[k];
  finalizeAnna(teamAnnaTotal);

  return { teamAnnaActions, teamAnna, teamAnnaTotal, teamSaves, teamBlocks, players };
}

module.exports = { ANNA_SCORE, ANNA_TYPES, calculateStats };

};
modules['./storage-indexeddb']=function(module,exports,require){
'use strict';

const { clone, assert } = require('./utils');
const { assessFinalizationResidue, finalizationResidueConflict, alreadyFinalizedError, staleActiveWriteError } = require('./finalization-consistency');
const { MAINTENANCE_JOURNAL_KEY, MAINTENANCE_DATA_STORES, classifyMaintenanceRecovery, verifyMaintenanceJournal, maintenanceBusy, maintenancePhaseRegression, transitionMaintenanceJournal } = require('./maintenance-journal');

function sameCompletedRecord(existing, incoming) {
  if(!existing || !incoming) return false;
  if(String(existing.matchId||'') !== String(incoming.matchId||'')) return false;
  const ei=existing.integrity||{}, ii=incoming.integrity||{};
  const er=existing.reportIntegrity||{}, ir=incoming.reportIntegrity||{};
  if(ei.digest && ii.digest && er.reportDigest && ir.reportDigest) {
    return ei.digest===ii.digest && er.reportDigest===ir.reportDigest &&
      (!er.sourceSessionDigest || !ir.sourceSessionDigest || er.sourceSessionDigest===ir.sourceSessionDigest);
  }
  // Compatibilitat amb registres antics sense empremtes separades.
  return JSON.stringify({finalState:existing.finalState,actionLog:existing.actionLog,report:existing.report}) ===
    JSON.stringify({finalState:incoming.finalState,actionLog:incoming.actionLog,report:incoming.report});
}

function finalizeConflict(matchId) {
  const e=new Error('Conflicte de finalització: ja existeix un partit diferent amb el mateix matchId.');
  e.code='FINALIZE_CONFLICT'; e.matchId=String(matchId); return e;
}

const DB_NAME='StatsCastellarPro2DB';
const DB_VERSION=2;
const STORES=['activeMatches','completedMatches','teams','settings'];
const MAINTENANCE_STORE='maintenance';
const ALL_STORES=[...STORES,MAINTENANCE_STORE];

class IndexedDBStorageAdapter {
  constructor(indexedDBImpl) {
    this.indexedDB=indexedDBImpl || (typeof indexedDB!=='undefined' ? indexedDB : null);
    assert(this.indexedDB,'IndexedDB no disponible');
    this._dbPromise=null;
  }

  _open() {
    if(this._dbPromise) return this._dbPromise;
    this._dbPromise=new Promise((resolve,reject)=>{
      const req=this.indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        for(const s of ALL_STORES) if(!db.objectStoreNames.contains(s)) db.createObjectStore(s,{keyPath:'id'});
      };
      req.onsuccess=()=>{ const db=req.result; this._recoverMaintenanceOnOpen(db).then(()=>resolve(db),err=>{try{db.close()}catch{};reject(err);}); };
      req.onerror=()=>reject(req.error || new Error('No es pot obrir IndexedDB'));
    });
    return this._dbPromise;
  }

  async _recoverMaintenanceOnOpen(db) {
    if(!db.objectStoreNames.contains(MAINTENANCE_STORE)) return {status:'none'};
    const journal=await new Promise((resolve,reject)=>{
      const tx=db.transaction(MAINTENANCE_STORE,'readonly'), req=tx.objectStore(MAINTENANCE_STORE).get(MAINTENANCE_JOURNAL_KEY);
      req.onsuccess=()=>resolve(req.result?clone(req.result.value):null); req.onerror=()=>reject(req.error||new Error('No es pot llegir el journal de manteniment'));
    });
    if(!journal) return {status:'none'};
    const verified=verifyMaintenanceJournal(journal);
    if(!verified.legacy && journal.phase==='cleared') {
      this.lastMaintenanceRecovery={status:'cleared',operation:journal.operation,operationId:journal.operationId,recovered:false};
      return this.lastMaintenanceRecovery;
    }
    const current={};
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(MAINTENANCE_DATA_STORES,'readonly'); let pending=MAINTENANCE_DATA_STORES.length,failed=false;
      for(const name of MAINTENANCE_DATA_STORES){const req=tx.objectStore(name).getAll();req.onerror=()=>{if(!failed){failed=true;reject(req.error||new Error('No es pot verificar el manteniment'));}};req.onsuccess=()=>{current[name]=(req.result||[]).map(x=>({id:String(x.id),value:clone(x.value)}));if(--pending===0&&!failed)resolve();};}
    });
    const assessment=classifyMaintenanceRecovery(journal,current);
    if(verified.legacy) {
      await new Promise((resolve,reject)=>{const tx=db.transaction(MAINTENANCE_STORE,'readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('No es pot netejar el journal'));tx.objectStore(MAINTENANCE_STORE).delete(MAINTENANCE_JOURNAL_KEY);});
      this.lastMaintenanceRecovery={...assessment,operation:journal.operation,operationId:null,legacy:true,recoveredAt:new Date().toISOString(),phase:'cleared'};
      return this.lastMaintenanceRecovery;
    }
    let next=journal, recoveredAt=new Date().toISOString();
    if(assessment.status==='committed' && next.phase==='prepared') next=transitionMaintenanceJournal(next,'committed',recoveredAt);
    next=transitionMaintenanceJournal(next,'cleared',recoveredAt);
    await new Promise((resolve,reject)=>{const tx=db.transaction(MAINTENANCE_STORE,'readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('No es pot tancar el journal'));tx.objectStore(MAINTENANCE_STORE).put({id:MAINTENANCE_JOURNAL_KEY,value:clone(next)});});
    this.lastMaintenanceRecovery={...assessment,operation:journal.operation,operationId:journal.operationId,recoveredAt,phase:'cleared'};
    return this.lastMaintenanceRecovery;
  }

  async writeMaintenanceJournal(record) {
    verifyMaintenanceJournal(record);
    const db=await this._open(), id=String(record.journalId||MAINTENANCE_JOURNAL_KEY);
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(MAINTENANCE_STORE,'readwrite'), os=tx.objectStore(MAINTENANCE_STORE), req=os.get(id);
      let result=clone(record), failed=false;
      const fail=(err)=>{if(failed)return;failed=true;try{tx.abort()}catch{};reject(err instanceof Error?err:new Error(String(err)));};
      req.onerror=()=>fail(req.error||new Error('No es pot comprovar el journal de manteniment'));
      req.onsuccess=()=>{
        try {
          const existing=req.result?.value||null;
          if(existing) {
            verifyMaintenanceJournal(existing);
            const sameOp=existing.operationId && record.operationId && existing.operationId===record.operationId;
            const inactive=existing.phase==='cleared';
            if(!sameOp && !inactive) return fail(maintenanceBusy(existing,record));
            if(sameOp) {
              const order={prepared:0,committed:1,cleared:2};
              if(order[record.phase] < order[existing.phase]) return fail(maintenancePhaseRegression(existing,record));
              if(existing.integrity?.digest===record.integrity?.digest) { result=clone(existing); return; }
            }
          }
          os.put({id,value:clone(record)});
        } catch(e){ fail(e); }
      };
      tx.oncomplete=()=>{if(!failed)resolve(result)}; tx.onerror=()=>{if(!failed){failed=true;reject(tx.error||new Error('No es pot desar el journal de manteniment'));}};
    });
  }
  async readMaintenanceJournal(journalId=MAINTENANCE_JOURNAL_KEY, options={}) {
    const db=await this._open();
    return new Promise((resolve,reject)=>{const tx=db.transaction(MAINTENANCE_STORE,'readonly'),req=tx.objectStore(MAINTENANCE_STORE).get(String(journalId));req.onsuccess=()=>{const v=req.result?clone(req.result.value):null;resolve(v && v.phase==='cleared' && options.includeCleared!==true ? null : v);};req.onerror=()=>reject(req.error||new Error('No es pot llegir el journal de manteniment'));});
  }
  async clearMaintenanceJournal(journalId=MAINTENANCE_JOURNAL_KEY) {
    const db=await this._open();
    return new Promise((resolve,reject)=>{const tx=db.transaction(MAINTENANCE_STORE,'readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('No es pot netejar el journal de manteniment'));tx.objectStore(MAINTENANCE_STORE).delete(String(journalId));});
  }

  async put(store,key,value) {
    const db=await this._open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readwrite');
      tx.oncomplete=()=>resolve(clone(value));
      tx.onerror=()=>reject(tx.error);
      tx.objectStore(store).put({id:String(key),value:clone(value)});
    });
  }

  async get(store,key) {
    const db=await this._open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readonly');
      const req=tx.objectStore(store).get(String(key));
      req.onsuccess=()=>resolve(req.result ? clone(req.result.value) : null);
      req.onerror=()=>reject(req.error);
    });
  }

  async delete(store,key) {
    const db=await this._open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readwrite');
      tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error);
      tx.objectStore(store).delete(String(key));
    });
  }

  async list(store) {
    const rows=await this.listEntries(store);
    return rows.map(x=>clone(x.value));
  }

  async listEntries(store) {
    const db=await this._open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readonly');
      const req=tx.objectStore(store).getAll();
      req.onsuccess=()=>resolve((req.result||[]).map(x=>({id:String(x.id),value:clone(x.value)})));
      req.onerror=()=>reject(req.error);
    });
  }

  async atomicSaveActive(matchId,record,expectedRevision=null) {
    if(expectedRevision==null && Object.prototype.hasOwnProperty.call(record||{},'parentStorageRevision')) expectedRevision=record.parentStorageRevision;
    const db=await this._open();
    const id=String(matchId);
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['activeMatches','completedMatches'],'readwrite');
      const os=tx.objectStore('activeMatches');
      const completed=tx.objectStore('completedMatches');
      const doneReq=completed.get(id);
      let result=null, failed=false;
      const fail=(err)=>{
        if(failed) return; failed=true;
        try{tx.abort()}catch{}
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      doneReq.onerror=()=>fail(doneReq.error||new Error('No es pot comprovar si el partit ja està finalitzat'));
      doneReq.onsuccess=()=>{
        if(doneReq.result) return fail(alreadyFinalizedError(id));
        const existingReq=os.get(id);
        existingReq.onerror=()=>fail(existingReq.error||new Error('No es pot llegir la versió activa'));
        existingReq.onsuccess=()=>{
          const existing=existingReq.result?.value||null;
          if(existing){
            const actualRevision=Number(existing.storageRevision||0);
            if(expectedRevision==null || actualRevision!==expectedRevision) return fail(staleActiveWriteError(id,expectedRevision,actualRevision));
          } else if(expectedRevision!=null && expectedRevision!==0) return fail(staleActiveWriteError(id,expectedRevision,null));
          result=clone(record);
          os.put({id,value:clone(record)});
        };
      };
      tx.oncomplete=()=>{if(!failed)resolve(result)};
      tx.onerror=()=>{if(!failed){failed=true;reject(tx.error||new Error('No s\'ha pogut desar el partit actiu'));}};
      tx.onabort=()=>{if(!failed){failed=true;reject(tx.error||new Error('Desament del partit actiu avortat'));}};
    });
  }


  async atomicReconcileFinalizedActive(matchId) {
    const db=await this._open(); const id=String(matchId);
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['activeMatches','completedMatches'],'readwrite');
      const active=tx.objectStore('activeMatches'), completed=tx.objectStore('completedMatches');
      const ar=active.get(id), cr=completed.get(id); let av=null,cv=null,ready=0,failed=false,result={status:'none'};
      const fail=(err)=>{if(failed)return;failed=true;try{tx.abort()}catch{};reject(err instanceof Error?err:new Error(String(err)));};
      const check=()=>{if(++ready<2)return;if(!av||!cv)return;const assessment=assessFinalizationResidue(av,cv);if(assessment.status!=='safe-residue')return fail(finalizationResidueConflict(id,assessment.reason));active.delete(id);result={status:'cleared',matchId:id,completed:clone(cv)};};
      ar.onerror=()=>fail(ar.error||new Error('No es pot llegir el partit actiu')); cr.onerror=()=>fail(cr.error||new Error('No es pot llegir el partit finalitzat'));
      ar.onsuccess=()=>{av=ar.result?ar.result.value:null;check();}; cr.onsuccess=()=>{cv=cr.result?cr.result.value:null;check();};
      tx.oncomplete=()=>{if(!failed)resolve(result)}; tx.onerror=()=>{if(!failed){failed=true;reject(tx.error||new Error('Reconciliació fallida'));}}; tx.onabort=()=>{if(!failed){failed=true;reject(tx.error||new Error('Reconciliació avortada'));}};
    });
  }

  async atomicImportBackup(stores, options={}) {
    const db=await this._open();
    const compare=options.compare || (x=>JSON.stringify(x));
    const names=Object.keys(stores||{});
    for(const name of names) assert(STORES.includes(name),'Magatzem de backup desconegut: '+name);
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(names,'readwrite');
      const summary={inserted:0,skipped:0,byStore:{}};
      let pending=0,failed=false;
      const abort=e=>{ if(failed)return; failed=true; try{tx.abort()}catch{}; reject(e instanceof Error?e:new Error(String(e))); };
      for(const name of names){
        const os=tx.objectStore(name), entries=stores[name]||[], part={inserted:0,skipped:0}; summary.byStore[name]=part;
        for(const entry of entries){
          pending++; const id=String(entry.id); const req=os.get(id);
          req.onerror=()=>abort(req.error||new Error('No es pot comprovar '+name+'/'+id));
          req.onsuccess=()=>{
            try {
              if(req.result){
                if(compare(req.result.value)!==compare(entry.value)) return abort(new Error('Conflicte de backup a '+name+'/'+id));
                part.skipped++; summary.skipped++;
              } else { os.put({id,value:clone(entry.value)}); part.inserted++; summary.inserted++; }
              pending--;
            } catch(e){ abort(e); }
          };
        }
      }
      tx.oncomplete=()=>{ if(!failed) resolve(summary); };
      tx.onerror=()=>{ if(!failed){failed=true;reject(tx.error||new Error('Importació de backup fallida'));} };
      tx.onabort=()=>{ if(!failed){failed=true;reject(tx.error||new Error('Importació de backup avortada'));} };
    });
  }


  async atomicReplaceBackup(stores) {
    const db=await this._open();
    for(const name of STORES) assert(Array.isArray(stores?.[name]),'Backup incomplet: '+name);
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORES,'readwrite'); let failed=false;
      const fail=(err)=>{if(failed)return;failed=true;try{tx.abort()}catch{};reject(err instanceof Error?err:new Error(String(err)));};
      const counts={};
      for(const name of STORES){
        const os=tx.objectStore(name), entries=stores[name]||[]; counts[name]=entries.length;
        const seen=new Set();
        for(const entry of entries){const id=String(entry.id);if(seen.has(id)) return fail(new Error('Backup amb id duplicat: '+name+'/'+id));seen.add(id);}
        const clear=os.clear(); clear.onerror=()=>fail(clear.error||new Error('No es pot buidar '+name));
        for(const entry of entries){const req=os.put({id:String(entry.id),value:clone(entry.value)});req.onerror=()=>fail(req.error||new Error('No es pot restaurar '+name+'/'+entry.id));}
      }
      tx.oncomplete=()=>{if(!failed)resolve({status:'restored',replaced:true,counts})};
      tx.onerror=()=>{if(!failed){failed=true;reject(tx.error||new Error('Restauració completa fallida'));}};
      tx.onabort=()=>{if(!failed){failed=true;reject(tx.error||new Error('Restauració completa avortada'));}};
    });
  }

  async atomicFinalize(matchId,completedRecord,expectedRevision=null) {
    if(expectedRevision==null && completedRecord?.sourceStorageRevision!=null) expectedRevision=completedRecord.sourceStorageRevision;
    const db=await this._open();
    const id=String(matchId);
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['activeMatches','completedMatches'],'readwrite');
      const active=tx.objectStore('activeMatches');
      const completed=tx.objectStore('completedMatches');
      const activeLookup=active.get(id);
      let result=clone(completedRecord);
      let failed=false;
      const fail=(err)=>{
        if(failed) return; failed=true;
        try{tx.abort()}catch{}
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      activeLookup.onerror=()=>fail(activeLookup.error||new Error('No es pot comprovar la versió del partit actiu'));
      activeLookup.onsuccess=()=>{
        const activeRecord=activeLookup.result?.value||null;
        if(activeRecord){
          const actualRevision=Number(activeRecord.storageRevision||0);
          if(expectedRevision==null || actualRevision!==expectedRevision) return fail(staleActiveWriteError(id,expectedRevision,actualRevision));
        }
        const lookup=completed.get(id);
        lookup.onerror=()=>fail(lookup.error||new Error('No es pot comprovar si el partit ja està arxivat'));
        lookup.onsuccess=()=>{
          if(lookup.result) {
            const existing=lookup.result.value;
            if(!sameCompletedRecord(existing,completedRecord)) return fail(finalizeConflict(id));
            result=clone(existing);
          } else completed.put({id,value:clone(completedRecord)});
          active.delete(id);
        };
      };
      tx.oncomplete=()=>{if(!failed)resolve(result)};
      tx.onerror=()=>{if(!failed){failed=true;reject(tx.error || new Error('No s\'ha pogut arxivar el partit'));}};
      tx.onabort=()=>{if(!failed){failed=true;reject(tx.error || new Error('Transacció d\'arxiu avortada'));}};
    });
  }
}

module.exports={ IndexedDBStorageAdapter, DB_NAME, DB_VERSION, STORES, MAINTENANCE_STORE, ALL_STORES };

};
modules['./storage-memory']=function(module,exports,require){
'use strict';

const { clone, assert } = require('./utils');
const { assessFinalizationResidue, finalizationResidueConflict, alreadyFinalizedError, staleActiveWriteError } = require('./finalization-consistency');
const { verifyMaintenanceJournal, maintenanceBusy, maintenancePhaseRegression } = require('./maintenance-journal');

function sameCompletedRecord(existing, incoming) {
  if(!existing || !incoming) return false;
  if(String(existing.matchId||'') !== String(incoming.matchId||'')) return false;
  const ei=existing.integrity||{}, ii=incoming.integrity||{};
  const er=existing.reportIntegrity||{}, ir=incoming.reportIntegrity||{};
  if(ei.digest && ii.digest && er.reportDigest && ir.reportDigest) {
    return ei.digest===ii.digest && er.reportDigest===ir.reportDigest &&
      (!er.sourceSessionDigest || !ir.sourceSessionDigest || er.sourceSessionDigest===ir.sourceSessionDigest);
  }
  // Compatibilitat amb registres antics sense empremtes separades.
  return JSON.stringify({finalState:existing.finalState,actionLog:existing.actionLog,report:existing.report}) ===
    JSON.stringify({finalState:incoming.finalState,actionLog:incoming.actionLog,report:incoming.report});
}

function finalizeConflict(matchId) {
  const e=new Error('Conflicte de finalització: ja existeix un partit diferent amb el mateix matchId.');
  e.code='FINALIZE_CONFLICT'; e.matchId=String(matchId); return e;
}

class MemoryStorageAdapter {
  constructor(seed = {}) {
    this.active = new Map(Object.entries(seed.active || {}));
    this.completed = new Map(Object.entries(seed.completed || {}));
    this.teams = new Map(Object.entries(seed.teams || {}));
    this.settings = new Map(Object.entries(seed.settings || {}));
    this.maintenance = new Map(Object.entries(seed.maintenance || {}));
  }

  async put(store, key, value) {
    const m=this._store(store); m.set(String(key),clone(value)); return clone(value);
  }
  async get(store, key) {
    const v=this._store(store).get(String(key)); return v == null ? null : clone(v);
  }
  async delete(store, key) { this._store(store).delete(String(key)); }
  async list(store) { return [...this._store(store).values()].map(clone); }
  async listEntries(store) { return [...this._store(store).entries()].map(([id,value])=>({id:String(id),value:clone(value)})); }

  async atomicSaveActive(matchId, record, expectedRevision=null) {
    assert(matchId, 'matchId obligatori');
    if(expectedRevision==null && Object.prototype.hasOwnProperty.call(record||{},'parentStorageRevision')) expectedRevision=record.parentStorageRevision;
    const id=String(matchId);
    if(this.completed.has(id)) throw alreadyFinalizedError(id);
    const existing=this.active.get(id);
    if(existing) {
      const actualRevision=Number(existing.storageRevision||0);
      if(expectedRevision==null || actualRevision!==expectedRevision) throw staleActiveWriteError(id,expectedRevision,actualRevision);
    } else if(expectedRevision!=null && expectedRevision!==0) {
      throw staleActiveWriteError(id,expectedRevision,null);
    }
    this.active.set(id,clone(record));
    return clone(record);
  }


  async atomicReconcileFinalizedActive(matchId) {
    const id=String(matchId);
    const active=this.active.get(id), completed=this.completed.get(id);
    if(!active || !completed) return {status:'none'};
    const assessment=assessFinalizationResidue(active,completed);
    if(assessment.status!=='safe-residue') throw finalizationResidueConflict(id,assessment.reason);
    this.active.delete(id);
    return {status:'cleared',matchId:id,completed:clone(completed)};
  }

  async atomicImportBackup(stores, options={}) {
    const compare=options.compare || (x=>JSON.stringify(x));
    const snapshots={active:new Map(this.active),completed:new Map(this.completed),teams:new Map(this.teams),settings:new Map(this.settings)};
    const summary={inserted:0,skipped:0,byStore:{}};
    try {
      for(const [store,entries] of Object.entries(stores||{})) {
        const m=this._store(store); const part={inserted:0,skipped:0}; summary.byStore[store]=part;
        for(const entry of entries||[]) {
          const id=String(entry.id); const existing=m.get(id);
          if(existing!=null) {
            if(compare(existing)!==compare(entry.value)) throw new Error('Conflicte de backup a '+store+'/'+id);
            part.skipped++; summary.skipped++; continue;
          }
          m.set(id,clone(entry.value)); part.inserted++; summary.inserted++;
        }
      }
      return summary;
    } catch(e) {
      this.active=snapshots.active; this.completed=snapshots.completed; this.teams=snapshots.teams; this.settings=snapshots.settings;
      throw e;
    }
  }


  async atomicReplaceBackup(stores) {
    for(const name of ['teams','activeMatches','completedMatches','settings']) assert(Array.isArray(stores?.[name]),'Backup incomplet: '+name);
    const build=(entries)=>{const m=new Map();for(const entry of entries){const id=String(entry.id);if(m.has(id)) throw new Error('Backup amb id duplicat: '+id);m.set(id,clone(entry.value));}return m;};
    const next={teams:build(stores.teams),active:build(stores.activeMatches),completed:build(stores.completedMatches),settings:build(stores.settings)};
    this.teams=next.teams; this.active=next.active; this.completed=next.completed; this.settings=next.settings;
    return {status:'restored',replaced:true,counts:{teams:this.teams.size,activeMatches:this.active.size,completedMatches:this.completed.size,settings:this.settings.size}};
  }


  async writeMaintenanceJournal(record) {
    assert(record?.journalId,'journalId obligatori');
    verifyMaintenanceJournal(record);
    const id=String(record.journalId), existing=this.maintenance.get(id);
    if(existing) {
      verifyMaintenanceJournal(existing);
      const sameOp=existing.operationId && record.operationId && existing.operationId===record.operationId;
      const inactive=existing.phase==='cleared';
      if(!sameOp && !inactive) throw maintenanceBusy(existing,record);
      if(sameOp) {
        const order={prepared:0,committed:1,cleared:2};
        if(order[record.phase] < order[existing.phase]) throw maintenancePhaseRegression(existing,record);
        if(existing.integrity?.digest===record.integrity?.digest) return clone(existing);
      }
    }
    this.maintenance.set(id,clone(record));
    return clone(record);
  }
  async readMaintenanceJournal(journalId='__maintenanceJournal__:v1', options={}) {
    const v=this.maintenance.get(String(journalId));
    if(v==null) return null;
    if(v.phase==='cleared' && options.includeCleared!==true) return null;
    return clone(v);
  }
  async clearMaintenanceJournal(journalId='__maintenanceJournal__:v1') { this.maintenance.delete(String(journalId)); }

  async atomicFinalize(matchId, completedRecord, expectedRevision=null) {
    assert(matchId, 'matchId obligatori');
    if(expectedRevision==null && completedRecord?.sourceStorageRevision!=null) expectedRevision=completedRecord.sourceStorageRevision;
    const id=String(matchId);
    const active=this.active.get(id);
    if(active) {
      const actualRevision=Number(active.storageRevision||0);
      if(expectedRevision==null || actualRevision!==expectedRevision) throw staleActiveWriteError(id,expectedRevision,actualRevision);
    }
    const existing=this.completed.get(id);
    if(existing) {
      // Idempotència estricta: només és el mateix arxiu si les empremtes coincideixen.
      if(!sameCompletedRecord(existing,completedRecord)) throw finalizeConflict(id);
      this.active.delete(id);
      return clone(existing);
    }
    this.completed.set(id,clone(completedRecord));
    this.active.delete(id);
    return clone(completedRecord);
  }

  _store(name) {
    if(name==='activeMatches') return this.active;
    if(name==='completedMatches') return this.completed;
    if(name==='teams') return this.teams;
    if(name==='settings') return this.settings;
    throw new Error('Magatzem desconegut: '+name);
  }
}

module.exports = { MemoryStorageAdapter };

};
modules['./storage-service']=function(module,exports,require){
'use strict';

const { clone, assert } = require('./utils');
const { MatchEngine } = require('./match-engine');
const { buildMatchReport } = require('./match-report');
const { applyPostMatchEditsToReport, appendPostMatchEdit, verifyPostMatchEdits } = require('./post-match-edits');
const { CURRENT, MIGRATION_VERSION, migrateActiveRecord, migrateCompletedRecord, newActiveEnvelope, newCompletedEnvelope, normalizeStaleConflict } = require('./schema-migrations');
const { makeIntegrity, verifyIntegrity, recoverStateFromActionLog, valueDigest } = require('./session-integrity');
const { makeReportIntegrity, repairReport } = require('./report-integrity');
const { assessFinalizationResidue, finalizationResidueConflict, alreadyFinalizedError, staleActiveWriteError } = require('./finalization-consistency');
const { isLegacyImportRecord, makeLegacyImportRecord, verifyLegacyImportRecord, repairLegacyImportRecord } = require('./legacy-import');

function actionKey(action) { return JSON.stringify(action); }
function actionsOf(session) { return session?.actionLog?.actions || []; }
function sameActions(a,b) { const x=actionsOf(a),y=actionsOf(b); return x.length===y.length && x.every((v,i)=>actionKey(v)===actionKey(y[i])); }
function isActionPrefix(prefixSession, fullSession) {
  const p=actionsOf(prefixSession),f=actionsOf(fullSession);
  return p.length<=f.length && p.every((v,i)=>actionKey(v)===actionKey(f[i]));
}
function deltaAfter(prefixSession, fullSession) { return actionsOf(fullSession).slice(actionsOf(prefixSession).length).map(clone); }

function conflictSealPayload(conflict) {
  return {
    schemaVersion: conflict.schemaVersion,
    type: conflict.type,
    matchId: conflict.matchId,
    createdAt: conflict.createdAt,
    baseRevision: conflict.baseRevision ?? null,
    latestRevision: conflict.latestRevision ?? null,
    baseSession: clone(conflict.baseSession ?? null),
    localSession: clone(conflict.localSession ?? null),
    latestSession: clone(conflict.latestSession ?? null),
    localDelta: clone(conflict.localDelta || []),
    remoteDelta: clone(conflict.remoteDelta || [])
  };
}
function makeConflictIntegrity(conflict) {
  return {version:1,algorithm:'fnv1a32-stable-json',digest:valueDigest(conflictSealPayload(conflict))};
}
function conflictAuditPayload(conflict) {
  return {
    conflictIntegrityDigest: conflict?.conflictIntegrity?.digest || null,
    resolution: clone(conflict?.resolution || null),
    lifecycle: clone(conflict?.lifecycle || {status: conflict?.resolution?.status==='resolved' ? 'resolved' : 'pending'})
  };
}
function makeConflictAuditIntegrity(conflict) {
  return {version:1,algorithm:'fnv1a32-stable-json',digest:valueDigest(conflictAuditPayload(conflict))};
}
function makeResolutionProvenance(session, source, revision=null, conflictDigest=null) {
  assert(session && session.state && session.actionLog,'Sessió resultant absent a la resolució');
  const integrity=makeIntegrity(session.state,session.actionLog);
  const payload={
    version:1, source:String(source||'unknown'), storageRevision:revision==null?null:Number(revision),
    conflictIntegrityDigest:conflictDigest||null, session:clone(session),
    stateDigest:integrity.stateDigest, actionLogDigest:integrity.actionLogDigest, sessionDigest:integrity.digest
  };
  payload.chainDigest=valueDigest({version:payload.version,source:payload.source,storageRevision:payload.storageRevision,conflictIntegrityDigest:payload.conflictIntegrityDigest,stateDigest:payload.stateDigest,actionLogDigest:payload.actionLogDigest,sessionDigest:payload.sessionDigest,session:payload.session});
  return payload;
}
function validateResolutionProvenance(conflict) {
  const p=conflict?.resolution?.provenance;
  if(!p) return true; // compatibilitat 028/029
  assert(p.version===1,'Versió de procedència de resolució desconeguda');
  assert(['active','completed','adopted-local'].includes(p.source),'Origen de procedència de resolució invàlid');
  assert(p.conflictIntegrityDigest===conflict?.conflictIntegrity?.digest,'Procedència desconnectada del conflicte original');
  assert(p.session?.matchId===conflict.matchId,'Procedència de resolució amb matchId inconsistent');
  const integ=makeIntegrity(p.session.state,p.session.actionLog);
  assert(p.stateDigest===integ.stateDigest,'Procedència: stateDigest no vàlid');
  assert(p.actionLogDigest===integ.actionLogDigest,'Procedència: actionLogDigest no vàlid');
  assert(p.sessionDigest===integ.digest,'Procedència: sessionDigest no vàlid');
  const expected=valueDigest({version:p.version,source:p.source,storageRevision:p.storageRevision??null,conflictIntegrityDigest:p.conflictIntegrityDigest,stateDigest:p.stateDigest,actionLogDigest:p.actionLogDigest,sessionDigest:p.sessionDigest,session:p.session});
  assert(p.chainDigest===expected,'Cadena de procedència de resolució no vàlida');
  return true;
}
function conflictResolutionError(code,message,extra={}) { const e=new Error(message); e.code=code; Object.assign(e,extra); return e; }

class Pro2Storage {
  constructor(adapter) {
    assert(adapter,'Cal un adaptador de persistència');
    this.adapter=adapter;
    this._activeVersions=new WeakMap();
    this._activeBaselines=new WeakMap();
  }

  _trackActive(engine, revision, session) {
    this._activeVersions.set(engine,Number(revision||0));
    this._activeBaselines.set(engine,{revision:Number(revision||0),session:clone(session||engine.exportSession())});
  }

  _validateStaleConflict(conflict) {
    conflict=normalizeStaleConflict(conflict); assert(conflict && conflict.schemaVersion===CURRENT.staleConflict,'Conflicte stale amb esquema invàlid');
    assert(['STALE_ACTIVE_BRANCH','STALE_ACTIVE_UNRELATED'].includes(conflict.type),'Tipus de conflicte stale invàlid');
    assert(conflict.matchId,'Conflicte stale sense matchId');
    for(const [label,session] of [['base',conflict.baseSession],['local',conflict.localSession],['latest',conflict.latestSession]]) {
      if(!session) continue;
      assert(String(session.matchId)===String(conflict.matchId),`Conflicte stale: ${label}Session.matchId inconsistent`);
      makeIntegrity(session.state,session.actionLog);
    }
    if(conflict.conflictIntegrity) {
      assert(conflict.conflictIntegrity.algorithm==='fnv1a32-stable-json','Algoritme d’integritat de conflicte desconegut');
      assert(conflict.conflictIntegrity.version===1,'Versió d’integritat de conflicte desconeguda');
      assert(conflict.conflictIntegrity.digest===valueDigest(conflictSealPayload(conflict)),'Integritat del conflicte stale no vàlida');
    }
    const inferredLifecycle=conflict.lifecycle || {status:conflict.resolution?.status==='resolved'?'resolved':'pending'};
    assert(['pending','resolved','archived'].includes(inferredLifecycle.status),'Cicle de vida del conflicte stale invàlid');
    if(inferredLifecycle.status==='pending') assert(!conflict.resolution || conflict.resolution.status!=='resolved','Conflicte pendent amb resolució final');
    if(['resolved','archived'].includes(inferredLifecycle.status)) assert(conflict.resolution?.status==='resolved','Conflicte resolt/arxivat sense resolució');
    if(inferredLifecycle.status==='archived') assert(inferredLifecycle.archivedAt,'Conflicte arxivat sense archivedAt');
    if(conflict.resolution?.status==='resolved') {
      assert(['latest','local'].includes(conflict.resolution.choice),'Resolució de conflicte stale invàlida');
      assert(conflict.resolution.resolvedAt,'Resolució de conflicte stale sense resolvedAt');
      validateResolutionProvenance(conflict);
      if(conflict.auditIntegrity) {
        assert(conflict.auditIntegrity.algorithm==='fnv1a32-stable-json','Algoritme d’auditoria de conflicte desconegut');
        assert(conflict.auditIntegrity.version===1,'Versió d’auditoria de conflicte desconeguda');
        assert(conflict.auditIntegrity.digest===valueDigest(conflictAuditPayload({...conflict,lifecycle:inferredLifecycle})),'Integritat d’auditoria del conflicte stale no vàlida');
      }
    }
    if(conflict.baseSession && conflict.localSession && conflict.latestSession && conflict.type==='STALE_ACTIVE_BRANCH') {
      assert(isActionPrefix(conflict.baseSession,conflict.localSession),'Conflicte stale: branca local no deriva de la base');
      assert(isActionPrefix(conflict.baseSession,conflict.latestSession),'Conflicte stale: branca vigent no deriva de la base');
      assert(JSON.stringify(deltaAfter(conflict.baseSession,conflict.localSession))===JSON.stringify(conflict.localDelta||[]),'Conflicte stale: localDelta inconsistent');
      assert(JSON.stringify(deltaAfter(conflict.baseSession,conflict.latestSession))===JSON.stringify(conflict.remoteDelta||[]),'Conflicte stale: remoteDelta inconsistent');
    }
    return true;
  }

  async _storeStaleConflict(conflict) {
    const key='__staleConflict__:'+conflict.matchId+':'+Date.now();
    const sealed={...clone(conflict),migrationVersion:MIGRATION_VERSION,conflictId:key,lifecycle:{status:'pending'}};
    sealed.conflictIntegrity=makeConflictIntegrity(sealed);
    await this.adapter.put('settings',key,sealed);
    return key;
  }

  async listStaleConflicts(matchId=null, options={}) {
    const includeResolved=Boolean(options?.includeResolved);
    const includeArchived=Boolean(options?.includeArchived);
    const rows=await this.adapter.listEntries('settings');
    const out=[];
    for(const row of rows.filter(r=>String(r.id).startsWith('__staleConflict__:'))) {
      const conflict=clone(row.value); this._validateStaleConflict(conflict);
      const lifecycle=conflict.lifecycle || {status:conflict.resolution?.status==='resolved'?'resolved':'pending'};
      if(matchId && String(conflict.matchId)!==String(matchId)) continue;
      if(lifecycle.status==='archived' && !includeArchived) continue;
      if(lifecycle.status!=='pending' && !includeResolved) continue;
      out.push({...conflict,lifecycle:clone(lifecycle)});
    }
    return out.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  }

  async listStaleConflictAudit(matchId=null) {
    return this.listStaleConflicts(matchId,{includeResolved:true,includeArchived:true});
  }

  async archiveResolvedStaleConflicts(options={}) {
    const matchId=options?.matchId ?? null;
    const olderThanMs=Math.max(0,Number(options?.olderThanMs||0));
    const now=options?.now ? new Date(options.now) : new Date();
    assert(!Number.isNaN(now.getTime()),'Data now invàlida per arxivar conflictes');
    const rows=await this.adapter.listEntries('settings');
    let archived=0, skipped=0; const conflictIds=[];
    for(const row of rows.filter(r=>String(r.id).startsWith('__staleConflict__:'))) {
      const conflict=clone(row.value); this._validateStaleConflict(conflict);
      if(matchId && String(conflict.matchId)!==String(matchId)) {skipped++; continue;}
      const lifecycle=conflict.lifecycle || {status:conflict.resolution?.status==='resolved'?'resolved':'pending'};
      if(lifecycle.status==='archived' || conflict.resolution?.status!=='resolved') {skipped++; continue;}
      const resolvedAt=new Date(conflict.resolution.resolvedAt);
      if(Number.isNaN(resolvedAt.getTime()) || now.getTime()-resolvedAt.getTime()<olderThanMs) {skipped++; continue;}
      conflict.lifecycle={status:'archived',archivedAt:now.toISOString(),previousStatus:'resolved'};
      conflict.auditIntegrity=makeConflictAuditIntegrity(conflict);
      await this.adapter.put('settings',row.id,conflict); archived++; conflictIds.push(String(row.id));
    }
    return {archived,skipped,conflictIds};
  }

  async resolveStaleConflict(conflictId, choice) {
    assert(String(conflictId||'').startsWith('__staleConflict__:'),'conflictId invàlid');
    assert(['latest','local'].includes(choice),'Resolució de conflicte invàlida');
    const raw=await this.adapter.get('settings',conflictId);
    if(!raw) throw conflictResolutionError('STALE_CONFLICT_NOT_FOUND','Conflicte stale no trobat',{conflictId});
    const conflict=clone(raw); this._validateStaleConflict(conflict);
    if(conflict.resolution?.status==='resolved') return clone(conflict);

    const completed=await this.adapter.get('completedMatches',conflict.matchId);
    const activeRaw=await this.adapter.get('activeMatches',conflict.matchId);
    if(choice==='latest') {
      if(completed) {
        const completedSession={matchId:conflict.matchId,state:clone(completed.finalState),actionLog:clone(completed.actionLog)};
        conflict.resolution={status:'resolved',choice:'latest',resolvedAt:new Date().toISOString(),outcome:'already-finalized',provenance:makeResolutionProvenance(completedSession,'completed',completed.sourceStorageRevision??null,conflict.conflictIntegrity?.digest||null)};
      } else {
        if(!activeRaw) throw conflictResolutionError('STALE_CONFLICT_STATE_CHANGED','La branca vigent ja no existeix',{conflictId});
        const active=migrateActiveRecord(activeRaw); this._validateActiveRecord(active); const verified=await this._verifyOrRepairActive(active);
        if(!isActionPrefix(conflict.latestSession,verified.session)) throw conflictResolutionError('STALE_CONFLICT_STATE_CHANGED','La branca vigent ha canviat de línia des que es va crear el conflicte',{conflictId});
        conflict.resolution={status:'resolved',choice:'latest',resolvedAt:new Date().toISOString(),outcome:'kept-current',resolvedStorageRevision:Number(verified.storageRevision||0),provenance:makeResolutionProvenance(verified.session,'active',Number(verified.storageRevision||0),conflict.conflictIntegrity?.digest||null)};
      }
      conflict.lifecycle={status:'resolved'}; conflict.auditIntegrity=makeConflictAuditIntegrity(conflict);
      await this.adapter.put('settings',conflictId,conflict); return clone(conflict);
    }

    if(completed) throw conflictResolutionError('MATCH_ALREADY_FINALIZED','El partit ja està finalitzat i no es pot adoptar la branca local',{conflictId,matchId:conflict.matchId});
    if(!activeRaw) throw conflictResolutionError('STALE_CONFLICT_STATE_CHANGED','La branca vigent ja no existeix',{conflictId});
    const active=migrateActiveRecord(activeRaw); this._validateActiveRecord(active); const verified=await this._verifyOrRepairActive(active);
    if(Number(verified.storageRevision||0)!==Number(conflict.latestRevision||0) || !sameActions({actionLog:conflict.latestSession.actionLog},verified.session)) {
      throw conflictResolutionError('STALE_CONFLICT_STATE_CHANGED','La branca vigent ha avançat des que es va crear el conflicte',{conflictId,expectedRevision:conflict.latestRevision,actualRevision:Number(verified.storageRevision||0)});
    }
    const localEngine=MatchEngine.fromSession(conflict.localSession);
    this._trackActive(localEngine,Number(verified.storageRevision||0),verified.session);
    const adopted=await this.saveActive(localEngine);
    conflict.resolution={status:'resolved',choice:'local',resolvedAt:new Date().toISOString(),outcome:'adopted-local',resolvedStorageRevision:Number(adopted.storageRevision||0),provenance:makeResolutionProvenance(adopted.session,'adopted-local',Number(adopted.storageRevision||0),conflict.conflictIntegrity?.digest||null)};
    conflict.lifecycle={status:'resolved'}; conflict.auditIntegrity=makeConflictAuditIntegrity(conflict);
    await this.adapter.put('settings',conflictId,conflict);
    return {...clone(conflict),engine:localEngine,record:clone(adopted)};
  }

  async verifyStaleConflictAuditTrail(conflictId) {
    assert(String(conflictId||'').startsWith('__staleConflict__:'),'conflictId invàlid');
    const raw=await this.adapter.get('settings',conflictId);
    if(!raw) throw conflictResolutionError('STALE_CONFLICT_NOT_FOUND','Conflicte stale no trobat',{conflictId});
    const conflict=clone(raw); this._validateStaleConflict(conflict);
    if(conflict.resolution?.status!=='resolved') return {ok:true,status:'pending',conflictId};
    validateResolutionProvenance(conflict);
    return {ok:true,status:conflict.lifecycle?.status||'resolved',conflictId,choice:conflict.resolution.choice,source:conflict.resolution.provenance?.source||'legacy',sessionDigest:conflict.resolution.provenance?.sessionDigest||null,chainDigest:conflict.resolution.provenance?.chainDigest||null};
  }

  async clearStaleConflict(conflictId) {
    assert(String(conflictId||'').startsWith('__staleConflict__:'),'conflictId invàlid');
    const raw=await this.adapter.get('settings',conflictId);
    if(!raw) return {status:'missing',conflictId};
    const conflict=clone(raw); this._validateStaleConflict(conflict);
    if(conflict.resolution?.status==='resolved') {
      const lifecycle=conflict.lifecycle || {status:'resolved'};
      if(lifecycle.status!=='archived') {
        conflict.lifecycle={status:'archived',archivedAt:new Date().toISOString(),previousStatus:'resolved'};
        conflict.auditIntegrity=makeConflictAuditIntegrity(conflict);
        await this.adapter.put('settings',conflictId,conflict);
      }
      return {status:'archived',conflictId};
    }
    await this.adapter.delete('settings',conflictId);
    return {status:'deleted-pending',conflictId};
  }

  async reconcileStaleActive(engine) {
    assert(engine && typeof engine.exportSession==='function','Motor invàlid');
    const localSession=engine.exportSession(), matchId=localSession.matchId;
    const baseline=this._activeBaselines.get(engine)||null;
    const latestRaw=await this.adapter.get('activeMatches',matchId);
    if(!latestRaw) {
      const completed=await this.adapter.get('completedMatches',matchId);
      if(completed) return {status:'finalized',matchId,completed:clone(completed),localSession:clone(localSession)};
      return {status:'missing',matchId,localSession:clone(localSession)};
    }
    const latestRec=migrateActiveRecord(latestRaw);
    this._validateActiveRecord(latestRec);
    const latest=await this._verifyOrRepairActive(latestRec);
    const latestEngine=MatchEngine.fromSession(latest.session);
    this._trackActive(latestEngine,latest.storageRevision,latest.session);

    // Mateixa sessió, revisió administrativa diferent: només rehidrata el token de versió.
    if(sameActions(localSession,latest.session)) {
      this._trackActive(engine,latest.storageRevision,latest.session);
      return {status:'refreshed',matchId,engine,record:clone(latest),reason:'same-session'};
    }

    if(baseline && sameActions(localSession,baseline.session)) {
      return {status:'refreshed',matchId,engine:latestEngine,record:clone(latest),reason:'no-local-delta'};
    }

    if(baseline && isActionPrefix(baseline.session,localSession) && isActionPrefix(baseline.session,latest.session)) {
      const localDelta=deltaAfter(baseline.session,localSession), remoteDelta=deltaAfter(baseline.session,latest.session);
      if(localDelta.length && remoteDelta.length===0) {
        // La revisió remota ha canviat sense canvis de joc. Rebase segur.
        this._trackActive(engine,latest.storageRevision,latest.session);
        if(localSession.state?.lifecycle?.status==='active') {
          const record=await this.saveActive(engine);
          return {status:'rebased-saved',matchId,engine,record,localDelta:clone(localDelta)};
        }
        // Si la còpia local ja està finalitzada, no la tornem a desar com a activa: el caller pot reintentar finalize().
        return {status:'rebased',matchId,engine,record:clone(latest),localDelta:clone(localDelta)};
      }
      const conflict={schemaVersion:CURRENT.staleConflict,migrationVersion:MIGRATION_VERSION,type:'STALE_ACTIVE_BRANCH',matchId,createdAt:new Date().toISOString(),baseRevision:baseline.revision,latestRevision:Number(latest.storageRevision||0),baseSession:clone(baseline.session),localSession:clone(localSession),latestSession:clone(latest.session),localDelta:clone(localDelta),remoteDelta:clone(remoteDelta)};
      conflict.conflictId=await this._storeStaleConflict(conflict);
      return {status:'conflict',matchId,conflictId:conflict.conflictId,localDelta:clone(localDelta),remoteDelta:clone(remoteDelta),latestEngine,latestRecord:clone(latest)};
    }

    const conflict={schemaVersion:CURRENT.staleConflict,migrationVersion:MIGRATION_VERSION,type:'STALE_ACTIVE_UNRELATED',matchId,createdAt:new Date().toISOString(),baseRevision:baseline?.revision??null,latestRevision:Number(latest.storageRevision||0),baseSession:clone(baseline?.session||null),localSession:clone(localSession),latestSession:clone(latest.session),localDelta:[],remoteDelta:[]};
    conflict.conflictId=await this._storeStaleConflict(conflict);
    return {status:'conflict',matchId,conflictId:conflict.conflictId,localDelta:[],remoteDelta:[],latestEngine,latestRecord:clone(latest)};
  }

  async saveActive(engine) {
    assert(engine && typeof engine.exportSession==='function','Motor invàlid');
    const session=engine.exportSession();
    const expectedRevision=this._activeVersions.has(engine)?this._activeVersions.get(engine):null;
    const nextRevision=(expectedRevision==null?1:expectedRevision+1);
    const record=newActiveEnvelope({matchId:session.matchId,session,integrity:makeIntegrity(session.state,session.actionLog),savedAt:new Date().toISOString(),storageRevision:nextRevision,parentStorageRevision:expectedRevision});
    if(typeof this.adapter.atomicSaveActive==='function') {
      await this.adapter.atomicSaveActive(session.matchId,record,expectedRevision);
    } else {
      // Compatibilitat amb adaptadors antics: cada matchId es desa de manera independent.
      const completed=await this.adapter.get('completedMatches',session.matchId);
      if(completed) throw alreadyFinalizedError(session.matchId);
      const rows=await this.adapter.list('activeMatches');
      const existing=rows.find(r=>String(r?.matchId||r?.session?.matchId||'')===String(session.matchId));
      if(existing) {
        const actualRevision=Number(existing.storageRevision||0);
        if(expectedRevision==null || actualRevision!==expectedRevision) throw staleActiveWriteError(session.matchId,expectedRevision,actualRevision);
      }
      await this.adapter.put('activeMatches',session.matchId,record);
    }
    this._trackActive(engine,nextRevision,session);
    return clone(record);
  }

  async loadActive(matchId) {
    const reconciliation=await this._reconcileFinalizedActive(matchId);
    if(reconciliation.status==='cleared') return null;
    const raw=await this.adapter.get('activeMatches',matchId);
    if(!raw) return null;
    const rec=migrateActiveRecord(raw);
    this._validateActiveRecord(rec);
    const repaired=await this._verifyOrRepairActive(rec);
    if(Number(raw.schemaVersion)!==Number(repaired.schemaVersion)) await this.adapter.put('activeMatches',repaired.matchId,repaired);
    const engine=MatchEngine.fromSession(repaired.session);
    this._trackActive(engine,Number(repaired.storageRevision||0),repaired.session);
    return engine;
  }

  async listActive() {
    let rows=await this.adapter.list('activeMatches');
    for(const row of rows) await this._reconcileFinalizedActive(row?.matchId||row?.session?.matchId);
    rows=await this.adapter.list('activeMatches');
    const out=[];
    for(const raw of rows) {
      const rec=migrateActiveRecord(raw);
      this._validateActiveRecord(rec);
      const repaired=await this._verifyOrRepairActive(rec);
      if(Number(raw.schemaVersion)!==Number(repaired.schemaVersion)) await this.adapter.put('activeMatches',repaired.matchId,repaired);
      out.push(clone(repaired));
    }
    return out.sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||'')));
  }

  async getCurrentActive() {
    let list=await this.adapter.list('activeMatches');
    if(!list.length) return null;
    for(const row of list) await this._reconcileFinalizedActive(row?.matchId||row?.session?.matchId);
    list=await this.adapter.list('activeMatches');
    if(!list.length) return null;
    // Retorna el partit pendent desat més recent; els altres continuen disponibles a Recuperar partit.
    list.sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||'')));
    const rawCurrent=list[0];
    const current=migrateActiveRecord(rawCurrent);
    this._validateActiveRecord(current);
    const repaired=await this._verifyOrRepairActive(current);
    if(Number(rawCurrent.schemaVersion)!==Number(repaired.schemaVersion)) await this.adapter.put('activeMatches',repaired.matchId,repaired);
    const engine=MatchEngine.fromSession(repaired.session);
    this._trackActive(engine,Number(repaired.storageRevision||0),repaired.session);
    return { record:clone(repaired), engine, extraActiveCount:Math.max(0,list.length-1) };
  }

  async finalize(engine) {
    assert(engine.state.lifecycle.status==='finished','El partit s\'ha de finalitzar al motor abans d\'arxivar-lo');
    const session=engine.exportSession();
    const report=buildMatchReport(session.state,session.actionLog);
    const expectedRevision=this._activeVersions.has(engine)?this._activeVersions.get(engine):null;
    const record=newCompletedEnvelope({
      matchId:session.matchId,
      metadata:clone(session.state.metadata),
      finalState:clone(session.state),
      actionLog:clone(session.actionLog),
      report,
      integrity:makeIntegrity(session.state,session.actionLog),
      reportIntegrity:makeReportIntegrity(report,session.state,session.actionLog),
      sourceStorageRevision:expectedRevision,
      completedAt:session.state.lifecycle.finishedAt || new Date().toISOString()
    });
    const archived=await this.adapter.atomicFinalize(session.matchId,record,expectedRevision);
    this._activeVersions.delete(engine);
    this._activeBaselines.delete(engine);
    return archived;
  }

  async _listHistoryRaw() {
    const rows=await this.adapter.list('completedMatches');
    return rows.map(migrateCompletedRecord).sort((a,b)=>String(b.completedAt||'').localeCompare(String(a.completedAt||'')));
  }

  // Des de la 022, tota lectura pública de l'Historial passa per la cadena canònica
  // de verificació/reparació. La lectura sense verificar queda només com a detall intern.
  async listHistory() { return this.listHistoryVerified(); }

  async listHistoryVerified() {
    const rows=await this._listHistoryRaw();
    const verified=[];
    for(const row of rows) {
      try {
        const rec=await this.getHistory(row.matchId);
        if(rec) verified.push(rec);
      } catch (error) {
        const e=new Error(`Historial no verificable (${row.matchId}): ${error.message||error}`);
        e.matchId=row.matchId; e.cause=error;
        throw e;
      }
    }
    return verified;
  }

  async getHistory(matchId) {
    const r=await this.adapter.get('completedMatches',matchId);
    if(!r) return null;
    let rec=migrateCompletedRecord(r);
    let changed=Number(r.schemaVersion)!==Number(rec.schemaVersion);
    if(isLegacyImportRecord(rec)) {
      try { verifyLegacyImportRecord(rec); }
      catch(error) {
        // Només es repara l'informe derivat; una font antiga manipulada continua sent error.
        if(rec.legacyIntegrity?.sourceDigest!==valueDigest(rec.legacySource)) throw error;
        rec=repairLegacyImportRecord(rec); changed=true;
      }
      verifyPostMatchEdits(rec.postMatchEdits||null,rec.report);
      if(changed) await this.adapter.put('completedMatches',rec.matchId,rec);
      return clone(rec);
    }
    try {
      verifyIntegrity(rec.integrity,rec.finalState,rec.actionLog);
    } catch (error) {
      const recovery=recoverStateFromActionLog(rec.integrity,rec.finalState,rec.actionLog);
      if(!recovery.recovered) throw error;
      rec.finalState=clone(recovery.state);
      rec.integrity=clone(recovery.integrity);
      rec.recoveredAt=new Date().toISOString();
      rec.recoverySource='actionLog';
      changed=true;
    }

    const expectedReport=buildMatchReport(rec.finalState,rec.actionLog);
    const reportRepair=repairReport(rec.reportIntegrity,rec.report,rec.finalState,rec.actionLog,expectedReport);
    if(reportRepair.repaired) {
      rec.report=clone(reportRepair.report);
      rec.reportIntegrity=clone(reportRepair.integrity);
      rec.reportRecoveredAt=new Date().toISOString();
      rec.reportRecoverySource=rec.reportIntegrity ? 'derived-state-actionLog' : 'derived';
      changed=true;
    }

    verifyPostMatchEdits(rec.postMatchEdits||null,expectedReport);
    if(changed) await this.adapter.put('completedMatches',rec.matchId,rec);
    return clone(rec);
  }

  async editHistoryActionValue(matchId,actionId,newValue) {
    const rec=await this.getHistory(matchId);
    assert(rec,'Partit finalitzat inexistent');
    let baseReport;
    if(isLegacyImportRecord(rec)) baseReport=rec.report;
    else baseReport=buildMatchReport(rec.finalState,rec.actionLog);
    rec.postMatchEdits=appendPostMatchEdit(baseReport,rec.postMatchEdits||null,String(actionId),Number(newValue));
    // La font segellada original no es modifica. L’edició és una capa auditada i segellada.
    await this.adapter.put('completedMatches',rec.matchId,rec);
    return clone(rec);
  }

  async importLegacyMatch(document) {
    const incoming=makeLegacyImportRecord(document);
    const existing=await this.adapter.get('completedMatches',incoming.matchId);
    if(existing){
      const migrated=migrateCompletedRecord(existing);
      if(isLegacyImportRecord(migrated) && migrated.legacyIntegrity?.sourceDigest===incoming.legacyIntegrity.sourceDigest)
        return {status:'already-imported',matchId:incoming.matchId,record:clone(migrated)};
      const e=new Error('Ja existeix un partit diferent amb el mateix identificador.');e.code='LEGACY_IMPORT_CONFLICT';e.matchId=incoming.matchId;throw e;
    }
    await this.adapter.put('completedMatches',incoming.matchId,incoming);
    return {status:'imported',matchId:incoming.matchId,record:clone(incoming)};
  }
  async deleteHistory(matchId) { return this.adapter.delete('completedMatches',matchId); }

  async deleteActive(matchId) {
    assert(matchId,'matchId obligatori');
    const id=String(matchId);
    const completed=await this.adapter.get('completedMatches',id);
    if(completed) throw alreadyFinalizedError(id);
    const active=await this.adapter.get('activeMatches',id);
    if(!active) return {deleted:false,matchId:id};
    await this.adapter.delete('activeMatches',id);
    return {deleted:true,matchId:id};
  }


  async _reconcileFinalizedActive(matchId) {
    if(!matchId) return {status:'none'};
    if(typeof this.adapter.atomicReconcileFinalizedActive==='function') return this.adapter.atomicReconcileFinalizedActive(matchId);
    const active=await this.adapter.get('activeMatches',matchId);
    const completed=await this.adapter.get('completedMatches',matchId);
    if(!active || !completed) return {status:'none'};
    const assessment=assessFinalizationResidue(active,completed);
    if(assessment.status!=='safe-residue') throw finalizationResidueConflict(matchId,assessment.reason);
    await this.adapter.delete('activeMatches',matchId);
    return {status:'cleared',matchId:String(matchId),completed:clone(completed)};
  }

  async _verifyOrRepairActive(rec) {
    try {
      verifyIntegrity(rec.integrity,rec.session.state,rec.session.actionLog);
      return rec;
    } catch (error) {
      const recovery=recoverStateFromActionLog(rec.integrity,rec.session.state,rec.session.actionLog);
      if(!recovery.recovered) throw error;
      rec.session.state=clone(recovery.state);
      rec.integrity=clone(recovery.integrity);
      rec.savedAt=new Date().toISOString();
      rec.recoveredAt=rec.savedAt;
      rec.recoverySource='actionLog';
      await this.adapter.put('activeMatches',rec.matchId,rec);
      return rec;
    }
  }

  _validateActiveRecord(rec) {
    assert(rec && rec.schemaVersion===CURRENT.activeMatch,'Registre actiu amb esquema invàlid');
    assert(rec.matchId && rec.session && rec.session.matchId===rec.matchId,'Registre actiu inconsistent');
    assert(rec.session.actionLog && rec.session.actionLog.matchId===rec.matchId,'ActionLog inconsistent');
    // MatchState es valida després. Si està malmès però l’ActionLog és íntegre, la 018 el pot reconstruir.
  }
}

module.exports={ Pro2Storage };

};
modules['./system-health']=function(module,exports,require){
'use strict';
const { clone } = require('./utils');
const { Pro2Storage } = require('./storage-service');
const { Pro2BackupService } = require('./backup-service');
const { migrateTeam, migrateActiveRecord, migrateCompletedRecord } = require('./schema-migrations');

function issue(scope, error, id=null) {
  return {scope,id,code:error?.code||null,message:error?.message||String(error)};
}

class Pro2SystemHealth {
  constructor(adapter){ this.adapter=adapter; }

  async run(options={}) {
    const now=options.now||new Date().toISOString();
    const storage=new Pro2Storage(this.adapter);
    const backup=new Pro2BackupService(this.adapter);
    const errors=[]; const warnings=[];
    const counts={teams:0,activeMatches:0,completedMatches:0,staleConflicts:0,pendingConflicts:0};
    let maintenance={status:'unsupported',recoveryRequired:false};

    try { maintenance=await backup.getMaintenanceStatus({now}); }
    catch(e){ errors.push(issue('maintenance',e)); }
    if(maintenance.recoveryRequired) warnings.push({scope:'maintenance',code:'RECOVERY_PENDING',message:'Hi ha una operació de manteniment pendent de reconciliació.'});

    try {
      const rows=await this.adapter.listEntries('teams'); counts.teams=rows.length;
      for(const row of rows) { try { migrateTeam(row.value); } catch(e){ errors.push(issue('team',e,row.id)); } }
    } catch(e){ errors.push(issue('teams-store',e)); }

    try {
      const rows=await this.adapter.listEntries('activeMatches'); counts.activeMatches=rows.length;
      if(rows.length>1) errors.push({scope:'activeMatches',code:'MULTIPLE_ACTIVE_MATCHES',message:'Hi ha més d’un partit actiu.',count:rows.length});
      for(const row of rows) {
        try { migrateActiveRecord(row.value); await storage.loadActive(row.id); }
        catch(e){ errors.push(issue('activeMatch',e,row.id)); }
      }
    } catch(e){ errors.push(issue('active-store',e)); }

    try {
      const rows=await this.adapter.listEntries('completedMatches'); counts.completedMatches=rows.length;
      for(const row of rows) {
        try { migrateCompletedRecord(row.value); await storage.getHistory(row.id); }
        catch(e){ errors.push(issue('completedMatch',e,row.id)); }
      }
    } catch(e){ errors.push(issue('completed-store',e)); }

    try {
      const conflicts=await storage.listStaleConflictAudit();
      counts.staleConflicts=conflicts.length;
      counts.pendingConflicts=conflicts.filter(c=>(c.lifecycle?.status||'pending')==='pending').length;
      if(counts.pendingConflicts) warnings.push({scope:'staleConflicts',code:'PENDING_CONFLICTS',message:`Hi ha ${counts.pendingConflicts} conflicte(s) pendent(s) de resolució.`});
      for(const c of conflicts) if(c.resolution?.status==='resolved') {
        try { await storage.verifyStaleConflictAuditTrail(c.conflictId); }
        catch(e){ errors.push(issue('staleConflictAudit',e,c.conflictId)); }
      }
    } catch(e){ errors.push(issue('staleConflicts',e)); }

    const status=errors.length?'error':warnings.length?'attention':'healthy';
    return {version:1,checkedAt:now,status,ok:errors.length===0,counts,maintenance:clone(maintenance),warnings,errors};
  }
}

module.exports={Pro2SystemHealth};

};
modules['./utils']=function(module,exports,require){
'use strict';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function unique(values) {
  return new Set(values).size === values.length;
}

module.exports = { clone, assert, unique };

};
const action_replay=req('./action-replay');
const anna_analytics=req('./anna-analytics');
const backup_service=req('./backup-service');
const capa7_ui_state=req('./capa7-ui-state');
const constants=req('./constants');
const cumulative_stats=req('./cumulative-stats');
const export_service=req('./export-service');
const finalization_consistency=req('./finalization-consistency');
const legacy_import=req('./legacy-import');
const maintenance_journal=req('./maintenance-journal');
const match_engine=req('./match-engine');
const match_factory=req('./match-factory');
const match_report=req('./match-report');
const participation_engine=req('./participation-engine');
const post_match_edits=req('./post-match-edits');
const report_consistency=req('./report-consistency');
const report_integrity=req('./report-integrity');
const schema_migrations=req('./schema-migrations');
const session_integrity=req('./session-integrity');
const simulator=req('./simulator');
const stats_engine=req('./stats-engine');
const storage_indexeddb=req('./storage-indexeddb');
const storage_memory=req('./storage-memory');
const storage_service=req('./storage-service');
const system_health=req('./system-health');
const utils=req('./utils');
global.StatsPro2={...action_replay,...anna_analytics,...backup_service,...capa7_ui_state,...constants,...cumulative_stats,...export_service,...finalization_consistency,...legacy_import,...maintenance_journal,...match_engine,...match_factory,...match_report,...participation_engine,...post_match_edits,...report_consistency,...report_integrity,...schema_migrations,...session_integrity,...simulator,...stats_engine,...storage_indexeddb,...storage_memory,...storage_service,...system_health,...utils};
})(typeof window!=='undefined'?window:globalThis);
