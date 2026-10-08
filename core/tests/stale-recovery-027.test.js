'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {createMatchFromDraft}=require('../src/match-factory');
const {MatchEngine}=require('../src/match-engine');
const {MemoryStorageAdapter}=require('../src/storage-memory');
const {Pro2Storage}=require('../src/storage-service');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
function fresh(id,now='2026-10-05T12:00:00Z'){const made=createMatchFromDraft(draft,{matchId:id,now});return new MatchEngine(made.state,made.actionLog)}
async function test(name,fn){try{await fn();console.log('PASS',name)}catch(e){console.error('FAIL',name,'\n ',e.stack||e);process.exitCode=1}}
(async()=>{
 await test('027 sense canvis locals una còpia stale es rehidrata a la revisió vigent',async()=>{
   const a=new MemoryStorageAdapter(), seed=new Pro2Storage(a), e=fresh('t027-refresh');await seed.saveActive(e);
   const s1=new Pro2Storage(a),s2=new Pro2Storage(a),e1=await s1.loadActive('t027-refresh'),e2=await s2.loadActive('t027-refresh');
   e1.ratePlayer('6',2);await s1.saveActive(e1);
   const r=await s2.reconcileStaleActive(e2);
   assert.equal(r.status,'refreshed'); assert.equal(r.reason,'no-local-delta');
   assert.deepStrictEqual(r.engine.state,e1.state);
 });
 await test('027 revisió remota sense canvi de joc permet rebase segur del delta local',async()=>{
   const a=new MemoryStorageAdapter(), seed=new Pro2Storage(a), e=fresh('t027-rebase');await seed.saveActive(e);
   const s1=new Pro2Storage(a),s2=new Pro2Storage(a),e1=await s1.loadActive('t027-rebase'),e2=await s2.loadActive('t027-rebase');
   await s1.saveActive(e1); // rev 2, mateixa sessió
   e2.ratePlayer('6',2);
   await assert.rejects(()=>s2.saveActive(e2),x=>x?.code==='STALE_ACTIVE_WRITE');
   const r=await s2.reconcileStaleActive(e2);
   assert.equal(r.status,'rebased-saved'); assert.equal(r.record.storageRevision,3);
   const raw=await a.get('activeMatches','t027-rebase'); assert.deepStrictEqual(raw.session.state,e2.state);
 });
 await test('027 dues branques de joc creen conflicte persistent i no fusionen a cegues',async()=>{
   const a=new MemoryStorageAdapter(), seed=new Pro2Storage(a), e=fresh('t027-conflict');await seed.saveActive(e);
   const s1=new Pro2Storage(a),s2=new Pro2Storage(a),e1=await s1.loadActive('t027-conflict'),e2=await s2.loadActive('t027-conflict');
   e1.ratePlayer('6',2);await s1.saveActive(e1);
   e2.ratePlayer('6',1);await assert.rejects(()=>s2.saveActive(e2),x=>x?.code==='STALE_ACTIVE_WRITE');
   const r=await s2.reconcileStaleActive(e2);
   assert.equal(r.status,'conflict'); assert.equal(r.localDelta.length,1); assert.equal(r.remoteDelta.length,1);
   const conflicts=await s2.listStaleConflicts('t027-conflict'); assert.equal(conflicts.length,1);
   assert.equal(conflicts[0].conflictId,r.conflictId); assert.deepStrictEqual(conflicts[0].localSession.state,e2.state); assert.deepStrictEqual(conflicts[0].latestSession.state,e1.state);
   const raw=await a.get('activeMatches','t027-conflict'); assert.deepStrictEqual(raw.session.state,e1.state);
 });
 await test('027 el conflicte persistent es pot netejar explícitament',async()=>{
   const a=new MemoryStorageAdapter(), seed=new Pro2Storage(a), e=fresh('t027-clear');await seed.saveActive(e);
   const s1=new Pro2Storage(a),s2=new Pro2Storage(a),e1=await s1.loadActive('t027-clear'),e2=await s2.loadActive('t027-clear');
   e1.ratePlayer('6',2);await s1.saveActive(e1);e2.ratePlayer('6',1);
   const r=await s2.reconcileStaleActive(e2);assert.equal(r.status,'conflict');
   await s2.clearStaleConflict(r.conflictId);assert.equal((await s2.listStaleConflicts('t027-clear')).length,0);
 });
 await test('027 mateixa sessió amb token de revisió antic refresca el mateix motor',async()=>{
   const a=new MemoryStorageAdapter(), seed=new Pro2Storage(a), e=fresh('t027-token');await seed.saveActive(e);
   const s1=new Pro2Storage(a),s2=new Pro2Storage(a),e1=await s1.loadActive('t027-token'),e2=await s2.loadActive('t027-token');
   await s1.saveActive(e1);const r=await s2.reconcileStaleActive(e2);assert.equal(r.status,'refreshed');assert.equal(r.reason,'same-session');
   e2.ratePlayer('6',2);const saved=await s2.saveActive(e2);assert.equal(saved.storageRevision,3);
 });
 await test('027 si una altra còpia ja ha finalitzat el partit no es recrea l’actiu',async()=>{
   const a=new MemoryStorageAdapter(), seed=new Pro2Storage(a), e=fresh('t027-finished');await seed.saveActive(e);
   const s1=new Pro2Storage(a),s2=new Pro2Storage(a),e1=await s1.loadActive('t027-finished'),e2=await s2.loadActive('t027-finished');
   e1.finishMatch();await s1.finalize(e1);e2.ratePlayer('6',1);
   const r=await s2.reconcileStaleActive(e2);assert.equal(r.status,'finalized');assert(r.completed);assert.equal(await a.get('activeMatches','t027-finished'),null);
 });

 await test('027 finalització local es pot rebasar si la revisió remota no ha canviat el joc',async()=>{
   const a=new MemoryStorageAdapter(), seed=new Pro2Storage(a), e=fresh('t027-final-rebase');await seed.saveActive(e);
   const s1=new Pro2Storage(a),s2=new Pro2Storage(a),e1=await s1.loadActive('t027-final-rebase'),e2=await s2.loadActive('t027-final-rebase');
   await s1.saveActive(e1); // rev 2 sense canvi de joc
   e2.finishMatch();await assert.rejects(()=>s2.finalize(e2),x=>x?.code==='STALE_ACTIVE_WRITE');
   const r=await s2.reconcileStaleActive(e2);assert.equal(r.status,'rebased');
   const archived=await s2.finalize(e2);assert.equal(archived.matchId,'t027-final-rebase');assert.equal(await a.get('activeMatches','t027-final-rebase'),null);
 });
 if(!process.exitCode) console.log('\nRESULTAT FINAL: PASS — RECUPERACIÓ STALE PRO.2 027');
})();
