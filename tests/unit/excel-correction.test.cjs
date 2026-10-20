'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const ROOT=path.join(__dirname,'../..');
const oracle=require('../fixtures/excel-expected.json');
const modules=['constants','utils','stats-engine','legacy-import','session-integrity','storage-memory','storage-indexeddb','storage-service','export-service','anna-analytics','backup-service'];
const P=Object.assign({},...modules.map(m=>require('../../core/src/'+m)));
const createCorrection=require('../../shared/excel-correction');
const corrected=JSON.parse(fs.readFileSync(path.join(ROOT,oracle.matches[1].path)));
function original(){return JSON.parse(process.env.STATS_EXCEL_BASELINE?fs.readFileSync(process.env.STATS_EXCEL_BASELINE,'utf8'):cp.execFileSync('git',['show','fb222c511705d08fdc7313ae4c1bb17a9dccdee0:'+oracle.matches[1].path],{cwd:ROOT,maxBuffer:4*1024*1024,encoding:'utf8'}));}
function expectedRows(m){return m.expectedCounts.flatMap(c=>Array.from({length:c.count},()=>c));}
function checkBucket(bucket,rows){
 const counts=Object.fromEntries([0,1,2,3].map(v=>[v,rows.filter(a=>a.value===v).length]));
 const points=counts[1]*5+counts[2]*8+counts[3]*10;
 assert.deepEqual(JSON.parse(JSON.stringify(bucket.counts)),counts);assert.equal(bucket.actions,rows.length);assert.equal(bucket.annaPoints,points);assert.equal(bucket.efficiency,rows.length?points/(rows.length*10):null);
 for(const v of [0,1,2,3])assert.equal(bucket.percentages[v],rows.length?counts[v]/rows.length:null);
}
function checkReport(api,report,m){
 const rows=expectedRows(m),map={'Servei':'SERVEI','Recepció':'RECEPCIO','Col·locació':'COLLOCACIO','Atac':'ATAC','Defensa':'DEFENSA'};
 const toCanonical=id=>{const p=report.players?.find(x=>x.playerId===id);return p?.playerId||'ia-'+id.split('-').at(-1)};
 function checkStats(st,sub){
  checkBucket(st.teamAnnaTotal,sub);assert.equal(st.teamAnnaActions,sub.length);
  for(const [label,type] of Object.entries(map))checkBucket(st.teamAnna[type],sub.filter(a=>a.action===label));
  for(const p of st.players){const pr=sub.filter(a=>toCanonical(a.playerId)===p.playerId);checkBucket(p.annaTotal,pr);assert.equal(p.impact,pr.length&&sub.length?p.annaTotal.annaPoints/(sub.length*10):null);for(const [label,type] of Object.entries(map))checkBucket(p.anna[type],pr.filter(a=>a.action===label));assert.equal(p.blocks.total,0);assert.equal(p.saves.total,0);}
  assert.equal(st.teamBlocks.total,0);assert.equal(st.teamSaves.total,0);
 }
 checkStats(report.stats,rows);for(const set of [1,2,3])checkStats(report.stats.bySet[set],rows.filter(a=>a.set===set));
 assert(report.actions.every(a=>Number.isInteger(a.value)));
}
test('Excel: all players, sets, ratings, weights, efficiency, impact and exports match the independent oracle',()=>{
 const context={};vm.runInNewContext(fs.readFileSync(path.join(ROOT,'shared/pro2-core.bundle.js'),'utf8'),context);
 for(const api of [P,context.StatsPro2])for(const m of oracle.matches){const doc=JSON.parse(fs.readFileSync(path.join(ROOT,m.path)));const rec=api.makeLegacyImportRecord(doc);checkReport(api,rec.report,m);const exp=api.prepareVerifiedExport(rec);assert.equal(exp.audit.verified,true);assert.equal(exp.report.stats.teamAnnaTotal.actions,expectedRows(m).length);}
});
test('Excel migration: original backup, atomic replacement, idempotency, unrelated match and Alpicat unchanged; no duplicate accumulation',async()=>{
 const C=createCorrection(P),old=original(),adapter=new P.MemoryStorageAdapter(),store=new P.Pro2Storage(adapter);
 await store.importLegacyMatch(old);const alpicat=JSON.parse(fs.readFileSync(path.join(ROOT,oracle.matches[0].path)));await store.importLegacyMatch(alpicat);
 const other=P.clone(alpicat);other.match.id='qa-unrelated';other.match.opponent='QA other';await store.importLegacyMatch(other);
 const untouched=JSON.stringify(await adapter.get('completedMatches',alpicat.match.id)),unrelated=JSON.stringify(await adapter.get('completedMatches','qa-unrelated'));
 const before=await adapter.get('completedMatches',C.MATCH_ID);assert.equal(P.valueDigest(old),C.OLD_DIGEST);
 assert.equal((await C.migrate(store,corrected)).status,'corrected');
 const after=await store.getHistory(C.MATCH_ID);checkReport(P,after.report,oracle.matches[1]);assert.deepEqual((await adapter.get('settings',C.BACKUP_KEY)).record,before);
 assert.equal(after.importedAt,before.importedAt);assert.equal(after.completedAt,before.completedAt);assert.deepEqual(after.report.result,before.report.result);assert.deepEqual(after.report.metadata,before.report.metadata);
 assert.equal(JSON.stringify(await adapter.get('completedMatches',alpicat.match.id)),untouched);assert.equal(JSON.stringify(await adapter.get('completedMatches','qa-unrelated')),unrelated);
 const saved=JSON.stringify(after),backup=JSON.stringify(await adapter.get('settings',C.BACKUP_KEY));assert.equal((await C.migrate(store,corrected)).status,'already-correct');assert.equal(JSON.stringify(await adapter.get('completedMatches',C.MATCH_ID)),saved);assert.equal(JSON.stringify(await adapter.get('settings',C.BACKUP_KEY)),backup);
 const records=await store.listHistoryVerified();assert.equal(records.length,3);const two=records.filter(r=>r.matchId!=='qa-unrelated');const history=P.buildHistoryAnalytics(two.map(r=>r.report),{teamId:'infantil-a'});assert.equal(history.matches,2);assert.equal(history.teamTotal.actions,580);
 const audit=await C.exportAudit(store);assert.equal(audit.records.length,2);assert(audit.checks.every(c=>c.verified));assert.deepEqual(audit.backup.record,before);
 const bk=await new P.Pro2BackupService(adapter).exportAll();assert(bk.stores.settings.some(e=>e.id===C.BACKUP_KEY));
});
test('Excel migration refuses local source edits, post-match edits, duplicates, tampering, races and backup collisions',async()=>{
 const C=createCorrection(P);
 for(const kind of ['source','edits','duplicate','tamper','race','backup']){
  const adapter=new P.MemoryStorageAdapter(),store=new P.Pro2Storage(adapter);await store.importLegacyMatch(original());let r=await adapter.get('completedMatches',C.MATCH_ID);
  if(kind==='source'){r.legacySource.match.venue='away';r=P.makeLegacyImportRecord(r.legacySource);}
  if(kind==='edits')r.postMatchEdits={version:1};
  if(kind==='tamper')r.legacySource.match.venue='away';
  await adapter.put('completedMatches',r.matchId,r);
  if(kind==='duplicate'){const d=P.clone(r);d.matchId='qa-duplicate';await adapter.put('completedMatches',d.matchId,d);}
  if(kind==='backup')await adapter.put('settings',C.BACKUP_KEY,{record:{must:'survive'}});
  if(kind==='race'){const atomic=adapter.atomicReplaceCompleted.bind(adapter);adapter.atomicReplaceCompleted=async(id,expected,next,backup)=>{const changed=P.clone(expected);changed.note='concurrent write';await adapter.put('completedMatches',id,changed);return atomic(id,expected,next,backup);};}
  const snapshot=JSON.stringify(await adapter.list('completedMatches'));
  if(['source','edits','duplicate'].includes(kind))assert.equal((await C.migrate(store,corrected)).status,'blocked');else await assert.rejects(()=>C.migrate(store,corrected));
  if(kind!=='race')assert.equal(JSON.stringify(await adapter.list('completedMatches')),snapshot);
  if(kind==='race')assert.equal((await adapter.get('completedMatches',C.MATCH_ID)).note,'concurrent write');
  assert.notEqual(P.valueDigest((await adapter.get('completedMatches',C.MATCH_ID)).legacySource),C.NEW_DIGEST);
 }
});
test('Excel correction backup can be restored and will not be automatically reapplied',async()=>{
 const C=createCorrection(P),adapter=new P.MemoryStorageAdapter(),store=new P.Pro2Storage(adapter);
 await store.importLegacyMatch(original());const before=await adapter.get('completedMatches',C.MATCH_ID);
 await C.migrate(store,corrected);assert.equal((await C.restoreBackup(store)).status,'restored');
 const after=await adapter.get('completedMatches',C.MATCH_ID);assert.deepEqual(after.legacySource,before.legacySource);assert.deepEqual(after.report,before.report);
 assert.equal((await C.migrate(store,corrected)).status,'blocked');assert.deepEqual((await adapter.get('settings',C.BACKUP_KEY)).record,before);
});
