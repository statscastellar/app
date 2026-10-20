(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory;
  else root.StatsExcelCorrection=factory(root.StatsPro2);
})(typeof window==='undefined'?globalThis:window,function(P){
  'use strict';
  const REVISION='excel-20261020-v1';
  const MATCH_ID='df5606f0-8d73-4ba8-ba8f-872b8780ea72';
  const OLD_DIGEST='fc321190',NEW_DIGEST='c74835fb';
  const ALPICAT_DIGEST='6246d13c';
  const BACKUP_KEY='excelCorrectionBackup:'+REVISION+':'+MATCH_ID;
  const isTeam=id=>['infantil-a','castellar-infantil-a'].includes(id);
  const sameIdentity=r=>isTeam(r?.metadata?.teamId)&&r.metadata.date==='2026-09-26'&&r.metadata.opponent==='Sant Cugat Negre';
  async function migrate(store,document){
    if(P.valueDigest(document)!==NEW_DIGEST) throw new Error('La correcció Excel no coincideix amb la font verificada.');
    const rows=await store.adapter.list('completedMatches');
    const related=rows.filter(r=>r.matchId===MATCH_ID||sameIdentity(r));
    if(related.length>1||related.some(r=>r.matchId!==MATCH_ID)) return {status:'blocked',reason:'duplicate-or-alternate-id'};
    const current=await store.adapter.get('completedMatches',MATCH_ID);
    if(!current)return {status:'absent'};
    if(!P.isLegacyImportRecord(current))return {status:'blocked',reason:'different-record-kind'};
    P.verifyLegacyImportRecord(current);
    const digest=P.valueDigest(current.legacySource);
    if(current.postMatchEdits||current.excelCorrectionRollback)return {status:'blocked',reason:'local-changes'};
    if(digest===NEW_DIGEST)return {status:'already-correct',matchId:MATCH_ID};
    if(digest!==OLD_DIGEST)return {status:'blocked',reason:'local-changes'};
    if(typeof store.adapter.atomicReplaceCompleted!=='function')throw new Error('No es pot garantir una còpia i substitució atòmiques.');
    const rebuilt=P.makeLegacyImportRecord(document);
    const next={...P.clone(current),legacySource:rebuilt.legacySource,report:rebuilt.report,metadata:rebuilt.metadata,legacyIntegrity:rebuilt.legacyIntegrity,
      excelCorrection:{revision:REVISION,backupKey:BACKUP_KEY,sourceSha256:document.match.normalization.sourceSha256,previousSourceDigest:OLD_DIGEST,sourceDigest:NEW_DIGEST,appliedAt:new Date().toISOString()}};
    P.verifyLegacyImportRecord(next);
    const backup={revision:REVISION,matchId:MATCH_ID,record:P.clone(current),recordDigest:P.valueDigest(current),createdAt:new Date().toISOString()};
    await store.adapter.atomicReplaceCompleted(MATCH_ID,current,next,{key:BACKUP_KEY,value:backup});
    const saved=await store.adapter.get('completedMatches',MATCH_ID),savedBackup=await store.adapter.get('settings',BACKUP_KEY);
    if(P.valueDigest(saved)!==P.valueDigest(next)||P.valueDigest(savedBackup?.record)!==backup.recordDigest)throw new Error('No s’ha pogut verificar la substitució i la còpia.');
    P.verifyLegacyImportRecord(saved);
    return {status:'corrected',matchId:MATCH_ID,backupKey:BACKUP_KEY,sourceDigest:NEW_DIGEST};
  }
  async function exportAudit(store){
    const rows=await store.adapter.list('completedMatches');
    const records=rows.filter(r=>r.matchId===MATCH_ID||sameIdentity(r)||(isTeam(r.metadata?.teamId)&&r.metadata?.date==='2026-10-03'&&r.metadata?.opponent==='Alpicat'));
    const checks=records.map(r=>{try{const verified=P.prepareVerifiedExport(r),sourceDigest=r.legacySource?P.valueDigest(r.legacySource):null,expectedDigest=r.matchId===MATCH_ID?NEW_DIGEST:ALPICAT_DIGEST;return {matchId:r.matchId,verified:verified.audit.verified,sourceDigest,matchesExcel:sourceDigest===expectedDigest&&!r.postMatchEdits};}catch(e){return {matchId:r.matchId,verified:false,matchesExcel:false,error:e.message};}});
    return {format:'Stats Castellar Excel Audit',revision:REVISION,exportedAt:new Date().toISOString(),records,backup:await store.adapter.get('settings',BACKUP_KEY),checks};
  }
  async function restoreBackup(store){
    const backup=await store.adapter.get('settings',BACKUP_KEY),current=await store.adapter.get('completedMatches',MATCH_ID);
    if(!backup?.record||P.valueDigest(backup.record)!==backup.recordDigest)throw new Error('La còpia anterior no és vàlida.');
    P.verifyLegacyImportRecord(backup.record);P.verifyLegacyImportRecord(current);
    if(P.valueDigest(current.legacySource)!==NEW_DIGEST||current.postMatchEdits)throw new Error('El partit ha canviat després de la correcció.');
    const restored={...P.clone(backup.record),excelCorrectionRollback:{revision:REVISION,restoredAt:new Date().toISOString()}};
    await store.adapter.atomicReplaceCompleted(MATCH_ID,current,restored);
    return {status:'restored',matchId:MATCH_ID};
  }
  return {migrate,exportAudit,restoreBackup,REVISION,MATCH_ID,BACKUP_KEY,OLD_DIGEST,NEW_DIGEST,ALPICAT_DIGEST};
});
