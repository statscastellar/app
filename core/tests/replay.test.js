'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {createMatchFromDraft}=require('../src/match-factory');
const {MatchEngine}=require('../src/match-engine');
const {replayActionLog,canReplayActionLog}=require('../src/action-replay');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
function fresh(id){const made=createMatchFromDraft(draft,{matchId:id,now:'2026-10-05T12:00:00Z'});return new MatchEngine(made.state,made.actionLog)}
function same(e,label){const rebuilt=replayActionLog(e.log);assert.deepStrictEqual(rebuilt,e.state,label)}
function test(name,fn){try{fn();console.log('PASS',name)}catch(e){console.error('FAIL',name,'\n ',e.stack||e);process.exitCode=1}}

test('MATCH_START 017 conté genesis i és reproduïble',()=>{const e=fresh('replay-start');assert.equal(e.log.schemaVersion,3);assert.equal(canReplayActionLog(e.log),true);same(e,'estat inicial')});
test('replay seqüència tècnica normal i punt',()=>{const e=fresh('replay-play');e.ratePlayer('6',2);same(e,'recepció');e.ratePlayer('3',2);same(e,'col·locació');e.ratePlayer('4',3);same(e,'atac-punt')});
test('replay punt amb canvi de servei i rotació',()=>{const e=fresh('replay-rotation');e.state.game.servingSide='rival';e.state.game.phase='RECEPCIO';e.log.actions[0].data.genesis=JSON.parse(JSON.stringify(e.state));e.ratePlayer('6',3);e.ratePlayer('3',2);e.ratePlayer('4',3);same(e,'rotació')});
test('replay conserva exactament l’estat SOS disponible després de R/D 0',()=>{const e=fresh('replay-sos-available');e.state.game.servingSide='rival';e.state.game.phase='RECEPCIO';e.log.actions[0].data.genesis=JSON.parse(JSON.stringify(e.state));e.ratePlayer('6',0);assert.equal(e.state.flow.sos.status,'available');same(e,'SOS disponible')});
test('replay R0 + SOS + Salvada 1/2/3',()=>{for(const v of [1,2,3]){const e=fresh('replay-save-'+v);e.state.game.servingSide='rival';e.state.game.phase='RECEPCIO';e.log.actions[0].data.genesis=JSON.parse(JSON.stringify(e.state));e.ratePlayer('6',0);e.activateSOS();e.ratePlayer('5',v);same(e,'salvada '+v)}});
test('replay bloqueig 1 i Camp rival',()=>{const e=fresh('replay-block');e.block('3',1);same(e,'bloc1');e.rivalCourt();same(e,'camp rival')});
test('replay canvi i posicions',()=>{const e=fresh('replay-sub');const out=e.state.game.court['4'];e.substitute(out,'p11');same(e,'substitució');const c=JSON.parse(JSON.stringify(e.state.game.court));[c['1'],c['6']]=[c['6'],c['1']];e.changePositions(c);same(e,'posicions')});
test('replay correcció manual - i +',()=>{const e=fresh('replay-correction');e.manualPoint('team');same(e,'punt manual');const c=JSON.parse(JSON.stringify(e.state.game.court));[c['1'],c['6']]=[c['6'],c['1']];e.changePositions(c);e.manualMinus('team');same(e,'correcció -');assert.equal(e.state.scoreCorrection.team,1);e.manualPoint('team');same(e,'correcció +');assert.equal(e.state.scoreCorrection.team,0);});
test('replay tancament/inici de set i final de partit',()=>{const e=fresh('replay-sets');e.manualPoint('team');e.finishSet();same(e,'set end');e.startNextSet({court:JSON.parse(JSON.stringify(e.state.game.court)),servingSide:'rival'});same(e,'set start');e.finishMatch();same(e,'match end');assert(e.log.actions.at(-1).data.finishedAt)});
test('ActionLog 016 sense genesis es detecta com a legacy',()=>{const e=fresh('replay-legacy');const l=JSON.parse(JSON.stringify(e.log));delete l.actions[0].data.genesis;l.schemaVersion=1;assert.equal(canReplayActionLog(l),false);assert.throws(()=>replayActionLog(l),/antic/)});
if(!process.exitCode) console.log('\nRESULTAT FINAL: PASS — REPLAY PRO.2 026');
