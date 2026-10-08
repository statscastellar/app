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
      // Compatibilitat amb adaptadors antics: aplica igualment la invariant d'un únic partit actiu i control de versió.
      const completed=await this.adapter.get('completedMatches',session.matchId);
      if(completed) throw alreadyFinalizedError(session.matchId);
      const rows=await this.adapter.list('activeMatches');
      const existing=rows.find(r=>String(r?.matchId||r?.session?.matchId||'')===String(session.matchId));
      if(existing) {
        const actualRevision=Number(existing.storageRevision||0);
        if(expectedRevision==null || actualRevision!==expectedRevision) throw staleActiveWriteError(session.matchId,expectedRevision,actualRevision);
      }
      const foreign=rows.filter(r=>String(r?.matchId||'')!==String(session.matchId));
      if(foreign.length) {
        const e=new Error('Ja hi ha un altre partit actiu. Recupera o finalitza el partit en curs abans de crear-ne un de nou.');
        e.code='ACTIVE_MATCH_EXISTS';
        throw e;
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

  async getCurrentActive() {
    let list=await this.adapter.list('activeMatches');
    if(!list.length) return null;
    for(const row of list) await this._reconcileFinalizedActive(row?.matchId||row?.session?.matchId);
    list=await this.adapter.list('activeMatches');
    if(!list.length) return null;
    // V1 admet un únic partit actiu; si n'hi ha més, escull el més recent però ho considera situació anòmala.
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
