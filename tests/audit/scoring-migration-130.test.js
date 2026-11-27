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
 console.log('PASS scoring, legacy history migration, backup compatibility and idempotence');
})().catch(e=>{console.error(e);process.exitCode=1;});
