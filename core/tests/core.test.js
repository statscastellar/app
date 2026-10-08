'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { createMatchFromDraft } = require('../src/match-factory');
const { MatchEngine } = require('../src/match-engine');
const { PHASE, ACTION } = require('../src/constants');

const draft = JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));

function fresh(overrides = {}) {
  const d = JSON.parse(JSON.stringify(draft));
  Object.assign(d, overrides);
  const {state, actionLog} = createMatchFromDraft(d, { matchId:'m-test', now:'2026-10-05T10:00:00Z' });
  return new MatchEngine(state, actionLog);
}

function test(name, fn) {
  try { fn(); console.log('PASS', name); }
  catch (e) { console.error('FAIL', name, '\n ', e.stack || e); process.exitCode = 1; }
}

// 1
test('creació des de DraftMatch rival serveix -> RECEPCIO', () => {
  const e=fresh();
  assert.equal(e.state.game.phase, PHASE.RECEPCIO);
  assert.deepEqual(e.state.game.score,{team:0,rival:0});
  assert.equal(e.getActiveActions()[0].type,ACTION.MATCH_START);
});

// 2
test('R2 -> C3 -> A3 dona punt propi i recupera servei amb rotació', () => {
  const e=fresh();
  e.ratePlayer('6',2);
  assert.equal(e.state.game.phase,PHASE.COLLOCACIO);
  e.ratePlayer('3',3);
  assert.equal(e.state.game.phase,PHASE.ATAC);
  const before=JSON.parse(JSON.stringify(e.state.game.court));
  e.ratePlayer('4',3);
  assert.equal(e.state.game.score.team,1);
  assert.equal(e.state.game.servingSide,'team');
  assert.equal(e.state.game.phase,PHASE.SERVEI);
  assert.equal(e.state.game.court['1'],before['2']);
  assert.equal(e.state.game.court['6'],before['1']);
});

// 3
test('servei propi només accepta zona 1', () => {
  const d=JSON.parse(JSON.stringify(draft));
  d.initialServe={side:'team',serverPlayerId:d.positions['1']};
  const {state,actionLog}=createMatchFromDraft(d,{matchId:'m-test',now:'2026-10-05T10:00:00Z'});
  const e=new MatchEngine(state,actionLog);
  assert.throws(()=>e.ratePlayer('2',2),/zona 1/);
  e.ratePlayer('1',3);
  assert.equal(e.state.game.score.team,1);
});

// 4
test('R0 + SOS conserva el 0, anul·la el punt provisional i activa SALVADA', () => {
  const e=fresh();
  const player=e.state.game.court['6'];
  e.ratePlayer('6',0);
  assert.equal(e.state.game.score.rival,1);
  assert.equal(e.state.flow.sos.status,'available');
  const r0=e.getStatActions().find(a=>a.type===ACTION.RECEPCIO && a.data.playerId===player && a.data.value===0);
  assert(r0);
  const provisional=e.log.actions.find(a=>a.type===ACTION.POINT && a.provisional);
  assert(provisional && provisional.active);
  e.activateSOS();
  assert.equal(e.state.game.score.rival,0);
  assert.equal(e.state.flow.sos.status,'active');
  assert.equal(e._findAction(provisional.actionId).active,false);
  assert(e.getStatActions().some(a=>a.actionId===r0.actionId));
});

// 5
test('Salvada només 1-3, queda registrada i passa a COLLOCACIO', () => {
  const e=fresh();
  e.ratePlayer('6',0); e.activateSOS();
  assert.throws(()=>e.ratePlayer('5',0),/Salvada només admet/);
  e.ratePlayer('5',3);
  assert.equal(e.state.game.phase,PHASE.COLLOCACIO);
  const saves=e.getStatActions().filter(a=>a.type===ACTION.SALVADA);
  assert.equal(saves.length,1); assert.equal(saves[0].data.value,3);
});

// 6
test('Desfer Salvada torna al mode SOS actiu sense eliminar el 0 original', () => {
  const e=fresh();
  e.ratePlayer('6',0); e.activateSOS(); e.ratePlayer('5',2);
  e.undo();
  assert.equal(e.state.flow.sos.status,'active');
  assert.equal(e.state.game.phase,PHASE.RECEPCIO);
  assert.equal(e.getStatActions().filter(a=>a.type===ACTION.SALVADA).length,0);
  assert.equal(e.getStatActions().filter(a=>a.type===ACTION.RECEPCIO && a.data.value===0).length,1);
});

// 7
test('Bloqueig 2 dona punt propi', () => {
  const e=fresh();
  e.block('2',2);
  assert.equal(e.state.game.score.team,1);
  assert(e.getStatActions().some(a=>a.type===ACTION.BLOQUEIG && a.data.value===2));
});

// 8
test('Bloqueig no permet zones del darrere', () => {
  const e=fresh();
  assert.throws(()=>e.block('5',1),/davanteres/);
});

// 9
test('Camp rival després de recepció positiva porta a DEFENSA', () => {
  const e=fresh();
  e.ratePlayer('6',2);
  assert.equal(e.state.flow.rivalCourtAvailable,true);
  e.rivalCourt();
  assert.equal(e.state.game.phase,PHASE.DEFENSA);
  assert.equal(e.state.flow.rivalTransit,true);
});

// 10
test('Canvi conserva zona i és reversible', () => {
  const e=fresh();
  const out=e.state.game.court['4'];
  e.substitute(out,'p11');
  assert.equal(e.state.game.court['4'],'p11');
  e.undo();
  assert.equal(e.state.game.court['4'],out);
});

// 11
test('Canvi de posicions és una sola operació reversible', () => {
  const e=fresh();
  const before=JSON.parse(JSON.stringify(e.state.game.court));
  const after=JSON.parse(JSON.stringify(before));
  [after['1'],after['6']]=[after['6'],after['1']];
  e.changePositions(after);
  assert.deepEqual(e.state.game.court,after);
  assert.equal(e.getActiveActions().filter(a=>a.type===ACTION.POSITION_CHANGE).length,1);
  e.undo();
  assert.deepEqual(e.state.game.court,before);
});

// 12
test('Punt manual aplica la mateixa regla de servei/rotació', () => {
  const e=fresh();
  const before=JSON.parse(JSON.stringify(e.state.game.court));
  e.manualPoint('team');
  assert.equal(e.state.game.score.team,1);
  assert.equal(e.state.game.servingSide,'team');
  assert.equal(e.state.game.court['1'],before['2']);
});

// 13
test('Undo d’una acció amb punt restaura estat i log', () => {
  const e=fresh();
  const before=e.snapshot();
  e.ratePlayer('6',0);
  e.undo();
  assert.deepEqual(e.state,before.state);
  assert.deepEqual(e.log,before.actionLog);
});

// 14
test('ActionLog no conté cap pes 0.5', () => {
  const e=fresh();
  e.ratePlayer('6',2); e.ratePlayer('3',2); e.ratePlayer('4',1);
  for(const a of e.log.actions) assert.notEqual(a.data && a.data.weight,0.5);
});

if (!process.exitCode) console.log('\nRESULTAT FINAL: PASS — NUCLI PRO.2 001');

// 15
test('Final de set + inici de set nou conserva lineup explícit i servei', () => {
  const e=fresh();
  e.manualPoint('team'); e.manualPoint('rival'); e.manualPoint('team');
  const court=JSON.parse(JSON.stringify(e.state.game.court));
  e.finishSet();
  assert.equal(e.state.flow.awaitingNextSet,true);
  assert.equal(e.state.game.sets.length,1);
  e.startNextSet({court,servingSide:'rival'});
  assert.equal(e.state.game.currentSet,2);
  assert.deepEqual(e.state.game.score,{team:0,rival:0});
  assert.equal(e.state.game.phase,PHASE.RECEPCIO);
});

// 16
test('Final de partit és únic a nivell de motor', () => {
  const e=fresh();
  e.finishMatch();
  assert.equal(e.state.lifecycle.status,'finished');
  assert.equal(e.getActiveActions().filter(a=>a.type===ACTION.MATCH_END).length,1);
  assert.throws(()=>e.finishMatch(),/ja finalitzat/);
});

// 17
test('Marcador − desfà el paquet de l’últim punt inequívoc',()=>{
  const e=fresh(); const before=e.snapshot();
  e.manualPoint('team');
  assert.equal(e.state.game.score.team,1);
  e.manualMinus('team');
  assert.deepEqual(e.state,before.state);
  assert.deepEqual(e.log,before.actionLog);
});

// 18
test('Marcador − de correcció no altera servei i + el recupera sense rotar',()=>{
  const e=fresh();
  e.manualPoint('team');
  // afegim una acció posterior perquè el menys ja no pugui restaurar el checkpoint del punt
  e.ratePlayer('1',1);
  const serving=e.state.game.servingSide; const court=JSON.stringify(e.state.game.court); const phase=e.state.game.phase;
  e.manualMinus('team');
  assert.equal(e.state.game.score.team,0);
  assert.equal(e.state.game.servingSide,serving); assert.equal(JSON.stringify(e.state.game.court),court); assert.equal(e.state.game.phase,phase);
  e.manualPoint('team');
  assert.equal(e.state.game.score.team,1);
  assert.equal(e.state.game.servingSide,serving); assert.equal(JSON.stringify(e.state.game.court),court); assert.equal(e.state.game.phase,phase);
});

// 19
test('després de 3 sets guanyats no es pot iniciar un quart set',()=>{
  const e=fresh();
  for(let s=1;s<=3;s++){
    e.manualPoint('team');
    e.finishSet();
    if(s<3){assert.equal(e.isMatchDecided(),false);const court=JSON.parse(JSON.stringify(e.state.game.court));e.startNextSet({court,servingSide:s%2?'rival':'team'});}
  }
  assert.equal(e.getSetWins().team,3);
  assert.equal(e.isMatchDecided(),true);
  assert.equal(e.canStartNextSet(),false);
  const court=JSON.parse(JSON.stringify(e.state.game.court));
  assert.throws(()=>e.startNextSet({court,servingSide:'rival'}),/partit ja està decidit/i);
});

// 20
test('amb 2-2 es pot iniciar el cinquè set però mai un sisè',()=>{
  const e=fresh();
  const winners=['team','rival','team','rival'];
  for(let i=0;i<4;i++){
    e.manualPoint(winners[i]); e.finishSet();
    assert.equal(e.isMatchDecided(),false);
    const court=JSON.parse(JSON.stringify(e.state.game.court));
    e.startNextSet({court,servingSide:i%2?'team':'rival'});
  }
  assert.equal(e.state.game.currentSet,5);
  e.manualPoint('team');e.finishSet();
  assert.equal(e.isMatchDecided(),true);
  assert.equal(e.canStartNextSet(),false);
});
