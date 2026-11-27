'use strict';
const assert=require('node:assert/strict');
require('../../shared/pro2-core.bundle.js');
const P=globalThis.StatsPro2;
(async()=>{
 assert.deepEqual(P.ANNA_SCORE,{0:0,1:2,2:8,3:10});
 const doc={format:'Stats Castellar Match',version:'legacy',match:{id:'migration-fixture',teamId:'test',teamName:'Test',players:[{id:'p1',number:1,name:'Test'}],completedSets:[{set:1,actions:[0,1,2,3].map(value=>({action:'Atac',playerId:'p1',value}))}]}};
 const record=P.makeLegacyImportRecord(doc);
 const current=record.report;
 assert.equal(current.stats.teamAnnaTotal.efficiency,.5);
 const old=JSON.parse(JSON.stringify(record));
 function oldScores(node,total){
   if(!node||typeof node!=='object')return;
   if(node.counts && typeof node.annaPoints==='number'){
     node.annaPoints+=3*node.counts[1];
     node.efficiency=node.actions?node.annaPoints/(10*node.actions):null;
   }
   if(node.annaTotal && 'impact' in node && total)node.impact=(node.annaTotal.annaPoints+3*node.annaTotal.counts[1])/(10*total);
   for(const v of Object.values(node))oldScores(v,node.teamAnnaActions||total);
 }
 oldScores(old.report,4);
 old.legacyIntegrity.reportDigest=P.valueDigest(old.report);
 const adapter=new P.MemoryStorageAdapter(), storage=new P.Pro2Storage(adapter), backup=new P.Pro2BackupService(adapter);
 await adapter.put('completedMatches',old.matchId,old);
 const snapshot=await backup.exportAll();
 const migrated=await storage.getHistory(old.matchId);
 assert.deepEqual(migrated.legacySource,old.legacySource);
 assert.deepEqual(migrated.report,current);
 assert.deepEqual(await storage.getHistory(old.matchId),migrated);
 const checked=await backup.verifyBackup(snapshot);
 assert.deepEqual(checked.backup.stores.completedMatches[0].value.report,current);
 assert.deepEqual(checked.backup.stores.completedMatches[0].value.legacySource,old.legacySource);
 const draft=require('../fixtures/draft.json');
 const {state,actionLog}=P.createMatchFromDraft(draft,{matchId:'native-migration-fixture',now:'2026-10-05T12:00:00Z'});
 const engine=new P.MatchEngine(state,actionLog);
 engine.ratePlayer('4',1);engine.finishSet();engine.finishMatch();
 const report=P.buildMatchReport(engine.state,engine.log);
 assert.equal(report.stats.teamAnnaTotal.efficiency,.2);
 const native={schemaVersion:2,matchId:engine.state.identity.matchId,metadata:engine.state.metadata,finalState:engine.state,actionLog:engine.log,integrity:P.makeIntegrity(engine.state,engine.log),report:JSON.parse(JSON.stringify(report))};
 oldScores(native.report,native.report.stats.teamAnnaActions);
 native.reportIntegrity=P.makeReportIntegrity(native.report,native.finalState,native.actionLog);
 await adapter.put('completedMatches',native.matchId,native);
 const nativeSnapshot=await backup.exportAll();
 const checkedNative=await backup.verifyBackup(nativeSnapshot);
 assert.deepEqual(checkedNative.backup.stores.completedMatches.find(x=>x.id===native.matchId).value.report,report);
 const migratedNative=await storage.getHistory(native.matchId);
 assert.deepEqual(migratedNative.finalState,native.finalState);
 assert.deepEqual(migratedNative.actionLog,native.actionLog);
 assert.deepEqual(migratedNative.report,report);
 assert.deepEqual(await storage.getHistory(native.matchId),migratedNative);
 assert.equal(P.prepareVerifiedExport(migratedNative).report.stats.teamAnnaTotal.efficiency,.2);
 console.log('PASS native migration, verified export, source preservation');
 console.log('PASS scoring, legacy history migration, backup compatibility and idempotence');
})().catch(e=>{console.error(e);process.exitCode=1;});
