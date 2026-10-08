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
 e1.ratePlayer('6',2);await s1.saveActive(e1);e2.ratePlayer('6',1);
 await assert.rejects(()=>s2.saveActive(e2),x=>x?.code==='STALE_ACTIVE_WRITE');
 const r=await s2.reconcileStaleActive(e2);assert.equal(r.status,'conflict');return {a,s1,s2,e1,e2,r};
}
(async()=>{
 await test('030 conservar vigent crea una procedència segellada i verificable',async()=>{
   const {s2,r}=await makeConflict('t030-latest'); const c=await s2.resolveStaleConflict(r.conflictId,'latest');
   assert.equal(c.resolution.provenance.source,'active'); assert(c.resolution.provenance.sessionDigest); assert(c.resolution.provenance.chainDigest);
   const v=await s2.verifyStaleConflictAuditTrail(r.conflictId); assert.equal(v.ok,true); assert.equal(v.choice,'latest'); assert.equal(v.source,'active');
 });
 await test('030 adoptar local encadena exactament la sessió adoptada',async()=>{
   const {s2,r}=await makeConflict('t030-local'); const c=await s2.resolveStaleConflict(r.conflictId,'local');
   assert.equal(c.resolution.provenance.source,'adopted-local'); assert.equal(c.resolution.provenance.storageRevision,c.record.storageRevision);
   assert.deepEqual(c.resolution.provenance.session,c.record.session); assert.equal((await s2.verifyStaleConflictAuditTrail(r.conflictId)).ok,true);
 });
 await test('030 l’auditoria continua verificable encara que la sessió activa avanci després',async()=>{
   const {s2,r}=await makeConflict('t030-advance'); await s2.resolveStaleConflict(r.conflictId,'latest');
   const active=await s2.loadActive('t030-advance'); active.ratePlayer('6',3); await s2.saveActive(active);
   const v=await s2.verifyStaleConflictAuditTrail(r.conflictId); assert.equal(v.ok,true); assert.equal(v.source,'active');
 });
 await test('030 l’arxiu del conflicte conserva intacta la cadena de procedència',async()=>{
   const {s2,r}=await makeConflict('t030-archive'); const c=await s2.resolveStaleConflict(r.conflictId,'latest'); const before=c.resolution.provenance.chainDigest;
   await s2.archiveResolvedStaleConflicts({matchId:'t030-archive',now:'2026-10-06T12:00:00Z'});
   const audit=(await s2.listStaleConflictAudit('t030-archive'))[0]; assert.equal(audit.lifecycle.status,'archived'); assert.equal(audit.resolution.provenance.chainDigest,before);
   assert.equal((await s2.verifyStaleConflictAuditTrail(r.conflictId)).ok,true);
 });
 await test('030 manipular la sessió resultant invalida la cadena encara que no toquis la resolució visible',async()=>{
   const {a,s2,r}=await makeConflict('t030-tamper-session'); await s2.resolveStaleConflict(r.conflictId,'latest');
   const raw=await a.get('settings',r.conflictId); raw.resolution.provenance.session.state.game.score.team+=1; await a.put('settings',r.conflictId,raw);
   await assert.rejects(()=>s2.verifyStaleConflictAuditTrail(r.conflictId),/Procedència|Cadena|Integritat/i);
 });
 await test('030 manipular l’origen de procedència invalida la cadena',async()=>{
   const {a,s2,r}=await makeConflict('t030-tamper-source'); await s2.resolveStaleConflict(r.conflictId,'latest');
   const raw=await a.get('settings',r.conflictId); raw.resolution.provenance.source='completed'; await a.put('settings',r.conflictId,raw);
   await assert.rejects(()=>s2.listStaleConflictAudit('t030-tamper-source'),/Cadena|auditoria|procedència/i);
 });
 if(!process.exitCode) console.log('\nRESULTAT FINAL: PASS — CADENA AUDITORIA CONFLICTES PRO.2 030');
})();
