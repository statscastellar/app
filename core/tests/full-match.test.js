'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {createMatchFromDraft}=require('../src/match-factory');
const {MatchEngine}=require('../src/match-engine');
const {MemoryStorageAdapter}=require('../src/storage-memory');
const {Pro2Storage}=require('../src/storage-service');
const {ACTION,PHASE}=require('../src/constants');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
function make(id='full-match'){const {state,actionLog}=createMatchFromDraft(draft,{matchId:id,now:'2026-10-05T12:00:00Z'});return new MatchEngine(state,actionLog);}
(async()=>{
 try{
  const storage=new Pro2Storage(new MemoryStorageAdapter()); let e=make();
  // Set 1: seqüència normal + punt propi
  e.ratePlayer('6',2); e.ratePlayer('3',3); e.ratePlayer('4',3);
  assert.equal(e.state.game.score.team,1); assert.equal(e.state.game.phase,PHASE.SERVEI);
  // Servei 1, després jugada rival; R0 + SOS + salvada
  e.ratePlayer('1',1); assert.equal(e.state.game.phase,PHASE.DEFENSA);
  e.ratePlayer('6',0); assert.equal(e.state.flow.sos.status,'available');
  e.activateSOS(); e.ratePlayer('5',3); assert.equal(e.state.game.phase,PHASE.COLLOCACIO);
  // canvi + posicions + undo posicions
  const out=e.state.game.court['4']; e.substitute(out,'p11'); assert.equal(e.state.game.court['4'],'p11');
  const before=JSON.parse(JSON.stringify(e.state.game.court)),after=JSON.parse(JSON.stringify(before)); [after['1'],after['6']]=[after['6'],after['1']];
  e.changePositions(after); e.undo(); assert.deepEqual(e.state.game.court,before);
  // Persistència enmig del set
  await storage.saveActive(e); e=await storage.loadActive('full-match'); assert.equal(e.state.game.court['4'],'p11');
  // tanca set 1
  e.manualPoint('team'); e.finishSet(); assert.equal(e.state.flow.awaitingNextSet,true);
  await storage.saveActive(e); e=await storage.loadActive('full-match'); assert.equal(e.state.flow.awaitingNextSet,true);
  // Set 2
  let court=JSON.parse(JSON.stringify(e.state.game.court)); e.startNextSet({court,servingSide:'rival'});
  e.manualPoint('team'); e.finishSet();
  // Set 3 i decisió 3-0
  court=JSON.parse(JSON.stringify(e.state.game.court)); e.startNextSet({court,servingSide:'team'});
  e.manualPoint('team'); e.finishSet(); assert.equal(e.getSetWins().team,3); assert.equal(e.isMatchDecided(),true);
  assert.throws(()=>e.startNextSet({court,servingSide:'rival'}),/decidit/);
  e.finishMatch(); const archived=await storage.finalize(e);
  assert.equal(archived.report.result.sets.length,3);
  assert.equal(archived.report.stats.teamSaves.total,1);
  assert(archived.actionLog.actions.some(a=>a.type===ACTION.SALVADA&&a.active));
  assert.equal((await storage.listHistory()).length,1);
  assert.equal(await storage.loadActive('full-match'),null);
  console.log('PASS partit complet 3-0: seqüències, SOS, canvi, posicions, persistència, sets, informe i arxiu');
  console.log('\nRESULTAT FINAL: PASS — PARTIT COMPLET PRO.2 007');
 }catch(e){console.error('FAIL partit complet\n ',e.stack||e);process.exitCode=1;}
})();
