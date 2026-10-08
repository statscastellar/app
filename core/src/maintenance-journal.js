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
