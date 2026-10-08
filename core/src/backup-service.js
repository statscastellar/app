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
