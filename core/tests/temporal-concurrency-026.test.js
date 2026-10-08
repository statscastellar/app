'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {createMatchFromDraft}=require('../src/match-factory');
const {MatchEngine}=require('../src/match-engine');
const {MemoryStorageAdapter}=require('../src/storage-memory');
const {Pro2Storage}=require('../src/storage-service');
const {validateActionLog}=require('../src/session-integrity');
const {replayActionLog}=require('../src/action-replay');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
function fresh(id,now='2026-10-05T12:00:00Z'){const made=createMatchFromDraft(draft,{matchId:id,now});return new MatchEngine(made.state,made.actionLog)}
async function test(name,fn){try{await fn();console.log('PASS',name)}catch(e){console.error('FAIL',name,'\\n ',e.stack||e);process.exitCode=1}}
(async()=>{
 await test('026 cada acció nova porta occurredAt ordenat i actualitza updatedAt',async()=>{
   const e=fresh('t026-time','2026-10-05T19:00:00Z');
   e.ratePlayer('6',2);e.ratePlayer('3',2);e.ratePlayer('4',3);
   assert.equal(e.log.schemaVersion,3);
   const times=e.log.actions.map(a=>a.occurredAt);
   assert(times.every(t=>!Number.isNaN(Date.parse(t))));
   for(let i=1;i<times.length;i++) assert(Date.parse(times[i])>=Date.parse(times[i-1]));
   assert.equal(e.state.identity.updatedAt,times.at(-1));
   validateActionLog(e.log,e.state);
 });
 await test('026 replay reconstrueix també el rellotge temporal canònic',async()=>{
   const e=fresh('t026-replay');e.ratePlayer('6',2);e.ratePlayer('3',2);e.ratePlayer('4',1);
   const rebuilt=replayActionLog(e.log);
   assert.deepStrictEqual(rebuilt,e.state);
   assert.equal(rebuilt.identity.updatedAt,e.log.actions.at(-1).occurredAt);
 });
 await test('026 MATCH_END comparteix finishedAt, occurredAt i updatedAt',async()=>{
   const e=fresh('t026-end');e.finishMatch();const end=e.log.actions.at(-1);
   assert.equal(end.type,'MATCH_END');
   assert.equal(end.occurredAt,end.data.finishedAt);
   assert.equal(e.state.lifecycle.finishedAt,end.occurredAt);
   assert.equal(e.state.identity.updatedAt,end.occurredAt);
 });
 await test('026 validador rebutja un ActionLog amb temps que retrocedeix',async()=>{
   const e=fresh('t026-badtime');e.ratePlayer('6',2);
   e.log.actions[1].occurredAt='2000-01-01T00:00:00.000Z';
   assert.throws(()=>validateActionLog(e.log,e.state),/Ordre temporal trencat/);
 });
 await test('026 una còpia antiga no pot sobreescriure una sessió més nova',async()=>{
   const a=new MemoryStorageAdapter(), seedStore=new Pro2Storage(a), e=fresh('t026-stale');
   await seedStore.saveActive(e);
   const s1=new Pro2Storage(a),s2=new Pro2Storage(a),e1=await s1.loadActive('t026-stale'),e2=await s2.loadActive('t026-stale');
   e1.ratePlayer('6',2);const r2=await s1.saveActive(e1);assert.equal(r2.storageRevision,2);
   e2.ratePlayer('6',1);
   await assert.rejects(()=>s2.saveActive(e2),err=>err&&err.code==='STALE_ACTIVE_WRITE');
   const raw=await a.get('activeMatches','t026-stale');assert.equal(raw.storageRevision,2);assert.deepStrictEqual(raw.session.state,e1.state);
 });
 await test('026 una còpia antiga tampoc pot finalitzar per sobre d’una versió nova',async()=>{
   const a=new MemoryStorageAdapter(), seedStore=new Pro2Storage(a), e=fresh('t026-stale-final');await seedStore.saveActive(e);
   const s1=new Pro2Storage(a),s2=new Pro2Storage(a),e1=await s1.loadActive('t026-stale-final'),e2=await s2.loadActive('t026-stale-final');
   e1.ratePlayer('6',2);await s1.saveActive(e1);
   e2.finishMatch();await assert.rejects(()=>s2.finalize(e2),err=>err&&err.code==='STALE_ACTIVE_WRITE');
   assert(await a.get('activeMatches','t026-stale-final'));assert.equal(await a.get('completedMatches','t026-stale-final'),null);
 });
 if(!process.exitCode) console.log('\\nRESULTAT FINAL: PASS — TEMPS I CONCURRÈNCIA PRO.2 026');
})();
