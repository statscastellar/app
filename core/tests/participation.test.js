'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {createMatchFromDraft}=require('../src/match-factory');
const {MatchEngine}=require('../src/match-engine');
const {calculateParticipation}=require('../src/participation-engine');
const {buildMatchReport}=require('../src/match-report');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
function fresh(){const x=createMatchFromDraft(draft,{matchId:'m-part',now:'2026-10-05T12:20:00Z'});return new MatchEngine(x.state,x.actionLog)}
function test(n,f){try{f();console.log('PASS',n)}catch(e){console.error('FAIL',n,'\n ',e.stack||e);process.exitCode=1}}
test('participació per punts abans/després d’un canvi',()=>{const e=fresh();const out=e.state.game.court['4'];e.manualPoint('rival');e.manualPoint('rival');e.substitute(out,'p11');e.manualPoint('rival');e.manualPoint('rival');const p=calculateParticipation(e.log);assert.equal(p.totalPoints,4);assert.equal(p.byPlayer[out].sets[1].points,2);assert.equal(p.byPlayer[out].sets[1].participation,.5);assert.equal(p.byPlayer.p11.sets[1].points,2);assert.equal(p.byPlayer.p11.sets[1].participation,.5);});
test('correcció - elimina un punt del denominador',()=>{const e=fresh();e.manualPoint('rival');e.ratePlayer('6',2);e.manualMinus('rival');const p=calculateParticipation(e.log);assert.equal(p.totalPoints,0);});
test('MatchReport inclou jugadores que han jugat encara que no tinguin accions Anna',()=>{const e=fresh();e.manualPoint('rival');const r=buildMatchReport(e.state,e.log);assert.equal(r.stats.players.length,6);assert(r.stats.players.every(p=>p.participation&&p.participation.sets[1].participation===1));});
if(!process.exitCode)console.log('\nRESULTAT FINAL: PASS — PARTICIPACIÓ PRO.2');
