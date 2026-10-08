'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {createMatchFromDraft}=require('../src/match-factory');
const {MatchEngine}=require('../src/match-engine');
const {buildCapa7UiState}=require('../src/capa7-ui-state');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
function make(d=draft,id='ui041'){const x=JSON.parse(JSON.stringify(d));const {state,actionLog}=createMatchFromDraft(x,{matchId:id,now:'2026-10-05T16:00:00Z'});return new MatchEngine(state,actionLog);}
function test(name,fn){try{fn();console.log('PASS',name);}catch(e){console.error('FAIL',name,'\n ',e.stack||e);process.exitCode=1;}}

test('fase visible canònica tradueix RECEPCIO',()=>{
 const e=make(); const ui=buildCapa7UiState(e); assert.equal(ui.phaseLabel,'RECEPCIÓ'); assert(ui.canRate('6',2));
});

test('servei propi només habilita valoració a zona 1 i mostra pilota',()=>{
 const d=JSON.parse(JSON.stringify(draft)); d.initialServe={side:'team',serverPlayerId:d.positions['1']}; const e=make(d,'ui041-serve'); const ui=buildCapa7UiState(e);
 assert.equal(ui.phaseLabel,'SERVEI'); assert.equal(ui.serverBallVisible,true); assert.equal(ui.canRate('1',2),true); assert.equal(ui.canRate('2',2),false);
});

test('mode local desactiva interaccions de pista sense canviar fase',()=>{
 const e=make(); const ui=buildCapa7UiState(e,{localMode:'POSITIONS'}); assert.equal(ui.phaseLabel,'RECEPCIÓ'); assert.equal(ui.canRate('6',2),false); assert.equal(ui.blocksEnabled,false); assert.equal(ui.serverBallVisible,false);
});

test('R0 deixa SOS disponible i impedeix valorar 0 només quan SOS és actiu',()=>{
 const e=make(); e.ratePlayer('6',0); let ui=buildCapa7UiState(e); assert.equal(ui.sosEnabled,true); assert.equal(ui.sosActive,false);
 e.activateSOS(); ui=buildCapa7UiState(e); assert.equal(ui.phaseLabel,'SALVADA'); assert.equal(ui.canRate('5',0),false); assert.equal(ui.canRate('5',3),true);
});

test('Camp rival reflecteix exactament rivalCourtAvailable',()=>{
 const e=make(); let ui=buildCapa7UiState(e); assert.equal(ui.rivalCourtEnabled,false); e.ratePlayer('6',2); ui=buildCapa7UiState(e); assert.equal(ui.rivalCourtEnabled,true);
});

test('Desfer deriva etiqueta i disponibilitat de undoStack',()=>{
 const e=make(); let ui=buildCapa7UiState(e); assert.equal(ui.undoEnabled,false); e.ratePlayer('6',2); ui=buildCapa7UiState(e); assert.equal(ui.undoEnabled,true); assert(ui.undoLabel.includes('RECEPCIO'));
});

if(!process.exitCode) console.log('\nRESULTAT FINAL: PASS — CAPA7 UI STATE 041');
