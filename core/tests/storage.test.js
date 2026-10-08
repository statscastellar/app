'use strict';

const fs=require('fs'); const path=require('path'); const assert=require('assert');
const { createMatchFromDraft }=require('../src/match-factory');
const { MatchEngine }=require('../src/match-engine');
const { MemoryStorageAdapter }=require('../src/storage-memory');
const { Pro2Storage }=require('../src/storage-service');
const { ACTION, PHASE }=require('../src/constants');

const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
function fresh(id='persist-test') { const {state,actionLog}=createMatchFromDraft(draft,{matchId:id,now:'2026-10-05T11:00:00Z'}); return new MatchEngine(state,actionLog); }
async function test(name,fn){try{await fn();console.log('PASS',name);}catch(e){console.error('FAIL',name,'\n ',e.stack||e);process.exitCode=1;}}

(async()=>{
await test('desa i carrega MatchState + ActionLog amb el mateix matchId',async()=>{
 const storage=new Pro2Storage(new MemoryStorageAdapter()); const e=fresh();
 e.ratePlayer('6',2); e.ratePlayer('3',2);
 await storage.saveActive(e); const r=await storage.loadActive('persist-test');
 assert(r); assert.deepEqual(r.state,e.state); assert.deepEqual(r.log,e.log);
});

await test('persistència conserva Desfer després de recarregar',async()=>{
 const storage=new Pro2Storage(new MemoryStorageAdapter()); const e=fresh('undo-persist');
 const before=e.snapshot(); e.ratePlayer('6',2); await storage.saveActive(e);
 const r=await storage.loadActive('undo-persist'); assert(r.undoStack.length>0); r.undo();
 assert.deepEqual(r.state,before.state); assert.deepEqual(r.log,before.actionLog);
});

await test('Recuperar conserva SOS disponible',async()=>{
 const storage=new Pro2Storage(new MemoryStorageAdapter()); const e=fresh('sos-persist');
 e.ratePlayer('6',0); await storage.saveActive(e);
 const r=await storage.loadActive('sos-persist'); assert.equal(r.state.flow.sos.status,'available');
 r.activateSOS(); r.ratePlayer('5',3); assert.equal(r.state.game.phase,PHASE.COLLOCACIO);
});

await test('Recuperar conserva SOS actiu',async()=>{
 const storage=new Pro2Storage(new MemoryStorageAdapter()); const e=fresh('sos-active');
 e.ratePlayer('6',0); e.activateSOS(); await storage.saveActive(e);
 const r=await storage.loadActive('sos-active'); assert.equal(r.state.flow.sos.status,'active');
 r.ratePlayer('5',2); assert(r.getStatActions().some(a=>a.type===ACTION.SALVADA&&a.data.value===2));
});

await test('getCurrentActive recupera el més recent sense crear un partit nou',async()=>{
 const a=new MemoryStorageAdapter(); const storage=new Pro2Storage(a); const e=fresh('current-one');
 await storage.saveActive(e); const got=await storage.getCurrentActive();
 assert.equal(got.engine.state.identity.matchId,'current-one'); assert.equal(got.extraActiveCount,0);
});

await test('no es pot crear un segon partit actiu amb un matchId diferent',async()=>{
 const a=new MemoryStorageAdapter(); const storage=new Pro2Storage(a);
 await storage.saveActive(fresh('active-a'));
 await assert.rejects(()=>storage.saveActive(fresh('active-b')),e=>e&&e.code==='ACTIVE_MATCH_EXISTS');
 const cur=await storage.getCurrentActive();
 assert.equal(cur.engine.state.identity.matchId,'active-a'); assert.equal(cur.extraActiveCount,0);
});

await test('el mateix partit actiu es pot anar actualitzant sense crear duplicats',async()=>{
 const a=new MemoryStorageAdapter(); const storage=new Pro2Storage(a); const e=fresh('active-update');
 await storage.saveActive(e); e.ratePlayer('6',2); await storage.saveActive(e);
 const entries=await a.listEntries('activeMatches'); assert.equal(entries.length,1);
 const loaded=await storage.loadActive('active-update'); assert.equal(loaded.log.actions.length,e.log.actions.length);
});

await test('finalització arxiva una entrada i elimina actiu',async()=>{
 const a=new MemoryStorageAdapter(); const storage=new Pro2Storage(a); const e=fresh('final-one');
 await storage.saveActive(e); e.finishMatch(); const archived=await storage.finalize(e);
 assert.equal(archived.matchId,'final-one'); assert.equal((await storage.listHistory()).length,1);
 assert.equal(await storage.loadActive('final-one'),null);
});

await test('finalització és idempotent per matchId',async()=>{
 const a=new MemoryStorageAdapter(); const storage=new Pro2Storage(a); const e=fresh('same-id');
 e.finishMatch(); await storage.finalize(e); await storage.finalize(e);
 const rows=await storage.listHistory(); assert.equal(rows.length,1); assert.equal(rows[0].matchId,'same-id');
});

await test('finalització rebutja una col·lisió divergent i conserva el partit actiu',async()=>{
 const a=new MemoryStorageAdapter(); const storage=new Pro2Storage(a); const e=fresh('finalize-conflict');
 await storage.saveActive(e); e.finishMatch();
 const session=e.exportSession();
 const divergent={
   schemaVersion:1,matchId:'finalize-conflict',metadata:{},
   finalState:JSON.parse(JSON.stringify(session.state)),
   actionLog:JSON.parse(JSON.stringify(session.actionLog)),
   report:{matchId:'finalize-conflict',divergent:true},
   integrity:{version:2,algorithm:'fnv1a32-stable-json',stateDigest:'bad',actionLogDigest:'bad',digest:'different'},
   reportIntegrity:{version:1,algorithm:'fnv1a32-stable-json',reportDigest:'different',sourceSessionDigest:'different'},
   completedAt:'2026-10-05T00:00:00Z'
 };
 await a.put('completedMatches','finalize-conflict',divergent);
 await assert.rejects(()=>storage.finalize(e),err=>err&&err.code==='FINALIZE_CONFLICT');
 const active=await a.get('activeMatches','finalize-conflict');
 assert(active,"el partit actiu s'ha de conservar si hi ha conflicte");
 const archived=await a.get('completedMatches','finalize-conflict');
 assert.equal(archived.report.divergent,true,"l'historial existent no s'ha de sobreescriure");
});

await test('Historial guarda ActionLog i MatchReport',async()=>{
 const storage=new Pro2Storage(new MemoryStorageAdapter()); const e=fresh('report-persist');
 e.ratePlayer('6',2); e.ratePlayer('3',3); e.ratePlayer('4',3); e.finishMatch(); await storage.finalize(e);
 const row=await storage.getHistory('report-persist');
 assert(row.actionLog.actions.length>1); assert(row.report); assert.equal(row.report.matchId,'report-persist');
});

await test('listHistory públic repara informe derivat abans de retornar-lo',async()=>{
 const a=new MemoryStorageAdapter(); const storage=new Pro2Storage(a); const e=fresh('history-list-heal');
 e.ratePlayer('6',2); e.finishMatch(); await storage.finalize(e);
 const raw=await a.get('completedMatches','history-list-heal'); raw.report={broken:true}; await a.put('completedMatches','history-list-heal',raw);
 const rows=await storage.listHistory();
 assert.equal(rows.length,1); assert(rows[0].report&&!rows[0].report.broken);
 const healed=await a.get('completedMatches','history-list-heal'); assert(healed.reportIntegrity);
});

await test('listHistory públic rebutja un ActionLog manipulat',async()=>{
 const a=new MemoryStorageAdapter(); const storage=new Pro2Storage(a); const e=fresh('history-list-badlog');
 e.finishMatch(); await storage.finalize(e);
 const raw=await a.get('completedMatches','history-list-badlog'); raw.actionLog.actions[0].data.tampered=true; await a.put('completedMatches','history-list-badlog',raw);
 await assert.rejects(()=>storage.listHistory(),/Historial no verificable|Integritat/);
});

await test('registre actiu inconsistent és rebutjat',async()=>{
 const a=new MemoryStorageAdapter(); const storage=new Pro2Storage(a);
 await a.put('activeMatches','bad',{schemaVersion:1,matchId:'bad',session:{matchId:'other',state:{identity:{matchId:'bad'}},actionLog:{matchId:'bad'}}});
 await assert.rejects(()=>storage.loadActive('bad'),/inconsistent/);
});



await test('si l\'arxivament falla es pot reintentar sense perdre ni duplicar el partit',async()=>{
 class FailOnceAdapter extends MemoryStorageAdapter {
   constructor(){ super(); this.fail=true; }
   async atomicFinalize(matchId,record){
     if(this.fail){ this.fail=false; throw new Error('fallada simulada d arxiu'); }
     return super.atomicFinalize(matchId,record);
   }
 }
 const a=new FailOnceAdapter(); const storage=new Pro2Storage(a); const e=fresh('retry-final');
 await storage.saveActive(e); e.finishMatch();
 await assert.rejects(()=>storage.finalize(e),/fallada simulada/);
 assert(await storage.loadActive('retry-final'),'el partit actiu ha de continuar guardat després de la fallada');
 assert.equal((await storage.listHistory()).length,0);
 const archived=await storage.finalize(e);
 assert.equal(archived.matchId,'retry-final');
 assert.equal((await storage.listHistory()).length,1);
 assert.equal(await storage.loadActive('retry-final'),null);
 await storage.finalize(e);
 assert.equal((await storage.listHistory()).length,1,'el reintent posterior no ha de duplicar');
});

if(!process.exitCode) console.log('\nRESULTAT FINAL: PASS — PERSISTÈNCIA PRO.2 002');
})();

(async()=>{
await test('Recuperar entre sets conserva awaitingNextSet i permet iniciar el següent',async()=>{
 const storage=new Pro2Storage(new MemoryStorageAdapter()); const e=fresh('between-sets');
 e.manualPoint('team'); e.finishSet(); await storage.saveActive(e);
 const r=await storage.loadActive('between-sets');
 assert.equal(r.state.flow.awaitingNextSet,true); assert.equal(r.state.game.currentSet,1);
 const court=JSON.parse(JSON.stringify(r.state.game.court));
 r.startNextSet({court,servingSide:'rival'});
 assert.equal(r.state.game.currentSet,2); assert.equal(r.state.flow.awaitingNextSet,false);
});
})();

(async()=>{
await test('025 neteja un actiu residual si és exactament el precursor del partit finalitzat',async()=>{
 const a=new MemoryStorageAdapter(); const storage=new Pro2Storage(a); const e=fresh('residue-safe');
 await storage.saveActive(e);
 const residual=await a.get('activeMatches','residue-safe');
 e.finishMatch(); await storage.finalize(e);
 await a.put('activeMatches','residue-safe',residual); // simula estat residual antic/interromput
 const current=await storage.getCurrentActive();
 assert.equal(current,null);
 assert.equal(await a.get('activeMatches','residue-safe'),null);
 assert(await a.get('completedMatches','residue-safe'));
});

await test('025 conserva i denuncia un residu actiu divergent davant del mateix matchId finalitzat',async()=>{
 const a=new MemoryStorageAdapter(); const storage=new Pro2Storage(a); const e=fresh('residue-conflict');
 await storage.saveActive(e); const residual=await a.get('activeMatches','residue-conflict');
 e.finishMatch(); await storage.finalize(e);
 residual.session.actionLog.actions[0].data.tampered=true;
 await a.put('activeMatches','residue-conflict',residual);
 await assert.rejects(()=>storage.getCurrentActive(),err=>err&&err.code==='FINALIZATION_RESIDUE_CONFLICT');
 assert(await a.get('activeMatches','residue-conflict'),'un conflicte no pot esborrar el residu actiu');
 assert(await a.get('completedMatches','residue-conflict'),'un conflicte no pot tocar l\'Historial');
});

await test('025 no permet reactivar un matchId que ja és a Historial',async()=>{
 const a=new MemoryStorageAdapter(); const storage=new Pro2Storage(a); const e=fresh('already-done');
 e.finishMatch(); await storage.finalize(e);
 const freshAgain=fresh('already-done');
 await assert.rejects(()=>storage.saveActive(freshAgain),err=>err&&err.code==='MATCH_ALREADY_FINALIZED');
 assert.equal(await a.get('activeMatches','already-done'),null);
 assert(await a.get('completedMatches','already-done'));
});
})();
