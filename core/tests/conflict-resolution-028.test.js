'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {createMatchFromDraft}=require('../src/match-factory');
const {MatchEngine}=require('../src/match-engine');
const {MemoryStorageAdapter}=require('../src/storage-memory');
const {Pro2Storage}=require('../src/storage-service');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
function fresh(id,now='2026-10-05T12:00:00Z'){const made=createMatchFromDraft(draft,{matchId:id,now});return new MatchEngine(made.state,made.actionLog)}
async function test(name,fn){try{await fn();console.log('PASS',name)}catch(e){console.error('FAIL',name,'\n ',e.stack||e);process.exitCode=1}}
async function makeConflict(id){
 const a=new MemoryStorageAdapter(), seed=new Pro2Storage(a), e=fresh(id);await seed.saveActive(e);
 const s1=new Pro2Storage(a),s2=new Pro2Storage(a),e1=await s1.loadActive(id),e2=await s2.loadActive(id);
 e1.ratePlayer('6',2);await s1.saveActive(e1); e2.ratePlayer('6',1);
 await assert.rejects(()=>s2.saveActive(e2),x=>x?.code==='STALE_ACTIVE_WRITE');
 const r=await s2.reconcileStaleActive(e2); assert.equal(r.status,'conflict');
 return {a,s1,s2,e1,e2,r};
}
(async()=>{
 await test('028 els conflictes nous queden segellats i catalogats com a pendents',async()=>{
   const {s2,r}=await makeConflict('t028-seal'); const rows=await s2.listStaleConflicts('t028-seal');
   assert.equal(rows.length,1); assert.equal(rows[0].conflictId,r.conflictId); assert(rows[0].conflictIntegrity?.digest); assert(!rows[0].resolution);
 });
 await test('028 conservar la branca vigent resol el conflicte sense alterar el partit actiu',async()=>{
   const {a,s2,e1,r}=await makeConflict('t028-latest');
   const resolved=await s2.resolveStaleConflict(r.conflictId,'latest'); assert.equal(resolved.resolution.choice,'latest');
   const raw=await a.get('activeMatches','t028-latest'); assert.deepStrictEqual(raw.session.state,e1.state);
   assert.equal((await s2.listStaleConflicts('t028-latest')).length,0);
   const audit=await s2.listStaleConflicts('t028-latest',{includeResolved:true}); assert.equal(audit.length,1); assert.equal(audit[0].resolution.status,'resolved');
 });
 await test('028 adoptar explícitament la branca local substitueix la vigent amb nova revisió',async()=>{
   const {a,s2,e2,r}=await makeConflict('t028-local');
   const resolved=await s2.resolveStaleConflict(r.conflictId,'local'); assert.equal(resolved.resolution.choice,'local'); assert(resolved.engine);
   const raw=await a.get('activeMatches','t028-local'); assert.deepStrictEqual(raw.session.state,e2.state); assert.equal(raw.storageRevision,3);
   const audit=await s2.listStaleConflicts('t028-local',{includeResolved:true}); assert.equal(audit[0].resolution.resolvedStorageRevision,3);
 });
 await test('028 no adopta una branca local si la sessió vigent ha avançat després del conflicte',async()=>{
   const {s1,s2,e1,r}=await makeConflict('t028-advanced'); e1.ratePlayer('6',3); await s1.saveActive(e1);
   await assert.rejects(()=>s2.resolveStaleConflict(r.conflictId,'local'),x=>x?.code==='STALE_CONFLICT_STATE_CHANGED');
   assert.equal((await s2.listStaleConflicts('t028-advanced')).length,1);
 });
 await test('028 conservar vigent accepta que la mateixa branca hagi avançat',async()=>{
   const {s1,s2,e1,r}=await makeConflict('t028-latest-advanced'); e1.ratePlayer('6',3); await s1.saveActive(e1);
   const resolved=await s2.resolveStaleConflict(r.conflictId,'latest'); assert.equal(resolved.resolution.choice,'latest'); assert.equal(resolved.resolution.resolvedStorageRevision,3);
 });
 await test('028 una instantània de conflicte manipulada és rebutjada abans de resoldre-la',async()=>{
   const {a,s2,r}=await makeConflict('t028-tamper'); const row=await a.get('settings',r.conflictId);
   row.localSession.actionLog.actions[row.localSession.actionLog.actions.length-1].data.value=3; await a.put('settings',r.conflictId,row);
   await assert.rejects(()=>s2.listStaleConflicts('t028-tamper'),/Integritat|ActionLog|MatchState/);
   await assert.rejects(()=>s2.resolveStaleConflict(r.conflictId,'latest'),/Integritat|ActionLog|MatchState/);
 });
 await test('028 resoldre dues vegades el mateix conflicte és idempotent',async()=>{
   const {s2,r}=await makeConflict('t028-idempotent'); const a=await s2.resolveStaleConflict(r.conflictId,'latest'); const b=await s2.resolveStaleConflict(r.conflictId,'latest');
   assert.equal(a.resolution.resolvedAt,b.resolution.resolvedAt);
 });
 if(!process.exitCode) console.log('\nRESULTAT FINAL: PASS — RESOLUCIÓ CONFLICTES PRO.2 028');
})();
