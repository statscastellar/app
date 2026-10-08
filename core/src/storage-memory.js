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
    const foreign=[...this.active.keys()].filter(k=>String(k)!==id);
    if(foreign.length) {
      const e=new Error('Ja hi ha un altre partit actiu. Recupera o finalitza el partit en curs abans de crear-ne un de nou.');
      e.code='ACTIVE_MATCH_EXISTS'; e.activeMatchIds=foreign;
      throw e;
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
