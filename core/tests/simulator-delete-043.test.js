'use strict';
const assert=require('assert');
const fs=require('fs');const path=require('path');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
const {buildSimulationDraft,simulateMatchFromDraft}=require('../src/simulator');
const {MemoryStorageAdapter}=require('../src/storage-memory');
const {Pro2Storage}=require('../src/storage-service');
const {createMatchFromDraft}=require('../src/match-factory');
const {MatchEngine}=require('../src/match-engine');
const {buildMatchReport}=require('../src/match-report');

(async()=>{
  const team={schemaVersion:1,teamId:draft.team.teamId,name:draft.team.name,players:draft.rosterSnapshot.map(p=>({...p,active:true}))};
  const simDraft=buildSimulationDraft(team,{matchId:'sim-043',date:'2026-10-05',opponent:'Rival simulació'});
  const engine=simulateMatchFromDraft(simDraft,{matchId:'sim-043',now:'2026-10-05T12:00:00Z'});
  assert.equal(engine.state.lifecycle.status,'finished');
  assert.equal(engine.state.game.sets.length,3);
  assert.deepEqual(engine.state.game.sets.map(s=>[s.team,s.rival,s.winner]),[[25,20,'team'],[25,20,'team'],[25,20,'team']]);
  const report=buildMatchReport(engine.state,engine.log);
  assert(report.stats.teamAnnaActions>0,'La simulació ha de generar accions Anna');
  assert((report.stats.teamSaves?.total||0)>0,'La simulació ha de generar com a mínim una salvada');

  const adapter=new MemoryStorageAdapter();const store=new Pro2Storage(adapter);
  const made=createMatchFromDraft(draft,{matchId:'delete-active-043',now:'2026-10-05T12:00:00Z'});
  const activeEngine=new MatchEngine(made.state,made.actionLog);
  await store.saveActive(activeEngine);
  let cur=await store.getCurrentActive(); assert(cur && cur.engine.state.identity.matchId==='delete-active-043');
  const deleted=await store.deleteActive('delete-active-043'); assert.equal(deleted.deleted,true);
  cur=await store.getCurrentActive(); assert.equal(cur,null);

  const finished=simulateMatchFromDraft(simDraft,{matchId:'finished-043',now:'2026-10-05T12:00:00Z'});
  await store.finalize(finished);
  let blocked=false; try{await store.deleteActive('finished-043');}catch(e){blocked=e.code==='MATCH_ALREADY_FINALIZED'||/finalitzat/i.test(e.message)}
  assert(blocked,'deleteActive no pot eliminar un partit finalitzat');
  assert(await store.getHistory('finished-043'),'Historial ha de continuar intacte');
  console.log('PASS 043 — simulador complet + eliminació segura de partit actiu');
})().catch(e=>{console.error(e);process.exit(1)});
