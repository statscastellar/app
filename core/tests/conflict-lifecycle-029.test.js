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
 const r=await s2.reconcileStaleActive(e2);assert.equal(r.status,'conflict');
 return {a,s1,s2,e1,e2,r};
}
(async()=>{
 await test('029 un conflicte nou és pendent i no apareix a l’auditoria arxivada',async()=>{
   const {s2}=await makeConflict('t029-pending');
   const p=await s2.listStaleConflicts('t029-pending');assert.equal(p.length,1);assert.equal(p[0].lifecycle.status,'pending');
   const all=await s2.listStaleConflictAudit('t029-pending');assert.equal(all.length,1);assert.equal(all[0].lifecycle.status,'pending');
 });
 await test('029 una resolució nova queda segellada i visible com a resolta però no arxivada',async()=>{
   const {s2,r}=await makeConflict('t029-resolved');await s2.resolveStaleConflict(r.conflictId,'latest');
   assert.equal((await s2.listStaleConflicts('t029-resolved')).length,0);
   const resolved=await s2.listStaleConflicts('t029-resolved',{includeResolved:true});
   assert.equal(resolved.length,1);assert.equal(resolved[0].lifecycle.status,'resolved');assert(resolved[0].auditIntegrity?.digest);
 });
 await test('029 arxivar un conflicte resolt el treu de les llistes normals però conserva auditoria',async()=>{
   const {s2,r}=await makeConflict('t029-archive');await s2.resolveStaleConflict(r.conflictId,'latest');
   const out=await s2.archiveResolvedStaleConflicts({matchId:'t029-archive',now:'2026-10-06T12:00:00Z'});assert.equal(out.archived,1);
   assert.equal((await s2.listStaleConflicts('t029-archive',{includeResolved:true})).length,0);
   const audit=await s2.listStaleConflictAudit('t029-archive');assert.equal(audit.length,1);assert.equal(audit[0].lifecycle.status,'archived');assert(audit[0].lifecycle.archivedAt);
 });
 await test('029 la compactació respecta l’antiguitat mínima i no arxiva pendents',async()=>{
   const a=await makeConflict('t029-age-resolved');await a.s2.resolveStaleConflict(a.r.conflictId,'latest');
   const b=await makeConflict('t029-age-pending');
   let out=await a.s2.archiveResolvedStaleConflicts({matchId:'t029-age-resolved',olderThanMs:48*3600*1000,now:'2026-10-06T12:00:00Z'});assert.equal(out.archived,0);
   out=await a.s2.archiveResolvedStaleConflicts({matchId:'t029-age-resolved',olderThanMs:0,now:'2026-10-06T12:00:00Z'});assert.equal(out.archived,1);
   assert.equal((await b.s2.listStaleConflicts('t029-age-pending')).length,1);
 });
 await test('029 manipular la resolució després de segellar-la invalida l’auditoria',async()=>{
   const {a,s2,r}=await makeConflict('t029-tamper-resolution');await s2.resolveStaleConflict(r.conflictId,'latest');
   const raw=await a.get('settings',r.conflictId);raw.resolution.choice='local';await a.put('settings',r.conflictId,raw);
   await assert.rejects(()=>s2.listStaleConflictAudit('t029-tamper-resolution'),/auditoria|Integritat/i);
 });
 await test('029 manipular archivedAt després d’arxivar invalida l’auditoria',async()=>{
   const {a,s2,r}=await makeConflict('t029-tamper-archive');await s2.resolveStaleConflict(r.conflictId,'latest');
   await s2.archiveResolvedStaleConflicts({matchId:'t029-tamper-archive',now:'2026-10-06T12:00:00Z'});
   const raw=await a.get('settings',r.conflictId);raw.lifecycle.archivedAt='2020-01-01T00:00:00Z';await a.put('settings',r.conflictId,raw);
   await assert.rejects(()=>s2.listStaleConflictAudit('t029-tamper-archive'),/auditoria|Integritat/i);
 });
 await test('029 clear sobre un conflicte resolt no l’esborra: l’arxiva',async()=>{
   const {a,s2,r}=await makeConflict('t029-clear');await s2.resolveStaleConflict(r.conflictId,'latest');
   const result=await s2.clearStaleConflict(r.conflictId);assert.equal(result.status,'archived');assert(await a.get('settings',r.conflictId));
   const audit=await s2.listStaleConflictAudit('t029-clear');assert.equal(audit[0].lifecycle.status,'archived');
 });
 await test('029 arxivar dues vegades és idempotent i no canvia archivedAt',async()=>{
   const {s2,r}=await makeConflict('t029-idempotent');await s2.resolveStaleConflict(r.conflictId,'latest');
   await s2.archiveResolvedStaleConflicts({matchId:'t029-idempotent',now:'2026-10-06T12:00:00Z'});
   const first=(await s2.listStaleConflictAudit('t029-idempotent'))[0].lifecycle.archivedAt;
   const again=await s2.archiveResolvedStaleConflicts({matchId:'t029-idempotent',now:'2026-10-07T12:00:00Z'});assert.equal(again.archived,0);
   const second=(await s2.listStaleConflictAudit('t029-idempotent'))[0].lifecycle.archivedAt;assert.equal(first,second);
 });
 if(!process.exitCode) console.log('\nRESULTAT FINAL: PASS — CICLE DE VIDA CONFLICTES PRO.2 029');
})();
