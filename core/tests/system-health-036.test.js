'use strict';
const assert=require('assert').strict;
const {MemoryStorageAdapter}=require('../src/storage-memory');
const {Pro2Storage}=require('../src/storage-service');
const {Pro2SystemHealth}=require('../src/system-health');
const fs=require('fs'); const path=require('path');
const {MatchEngine}=require('../src/match-engine');
const {createMatchFromDraft}=require('../src/match-factory');
let pass=0; async function t(n,f){await f();pass++;console.log('PASS',n)}
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
function engine(id='h036'){const {state,actionLog}=createMatchFromDraft(draft,{matchId:id,now:'2026-10-05T16:30:00Z'});return new MatchEngine(state,actionLog);}
(async()=>{
 await t('036 salut buida es healthy',async()=>{const h=await new Pro2SystemHealth(new MemoryStorageAdapter()).run({now:'2026-10-05T16:30:00Z'});assert.equal(h.status,'healthy');assert.equal(h.ok,true);});
 await t('036 compta i verifica partit actiu',async()=>{const a=new MemoryStorageAdapter(),s=new Pro2Storage(a),e=engine('h036-active');await s.saveActive(e);const h=await new Pro2SystemHealth(a).run();assert.equal(h.counts.activeMatches,1);assert.equal(h.ok,true);});
 await t('036 detecta multiples actius',async()=>{const a=new MemoryStorageAdapter();const s1=new Pro2Storage(a),e1=engine('h036-a');await s1.saveActive(e1);const r=await a.get('activeMatches','h036-a');r.matchId='h036-b';r.session.matchId='h036-b';r.session.actionLog.matchId='h036-b';await a.put('activeMatches','h036-b',r);const h=await new Pro2SystemHealth(a).run();assert.equal(h.status,'error');assert(h.errors.some(x=>x.code==='MULTIPLE_ACTIVE_MATCHES'));});
 await t('036 detecta equip corrupte',async()=>{const a=new MemoryStorageAdapter();await a.put('teams','bad',{schemaVersion:1,teamId:'bad',name:'',players:[]});const h=await new Pro2SystemHealth(a).run();assert.equal(h.status,'error');assert(h.errors.some(x=>x.scope==='team'));});
 await t('036 verifica historial finalitzat',async()=>{const a=new MemoryStorageAdapter(),s=new Pro2Storage(a),e=engine('h036-f');await s.saveActive(e);e.finishMatch();await s.finalize(e);const h=await new Pro2SystemHealth(a).run();assert.equal(h.counts.completedMatches,1);assert.equal(h.ok,true);});
 await t('036 exposa conflictes pendents com attention',async()=>{const a=new MemoryStorageAdapter(),seed=new Pro2Storage(a),e=engine('h036-c');await seed.saveActive(e);const s1=new Pro2Storage(a),s2=new Pro2Storage(a),e1=await s1.loadActive('h036-c'),e2=await s2.loadActive('h036-c');e1.manualPoint('team');await s1.saveActive(e1);e2.manualPoint('rival');try{await s2.saveActive(e2)}catch{}const rr=await s2.reconcileStaleActive(e2);assert.equal(rr.status,'conflict');const h=await new Pro2SystemHealth(a).run();assert.equal(h.status,'attention');assert.equal(h.counts.pendingConflicts,1);});
 console.log(`system-health-036: ${pass} PASS`);
})().catch(e=>{console.error(e);process.exit(1)});
