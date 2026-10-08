'use strict';
const fs=require('fs'); const path=require('path'); const assert=require('assert');
const {createMatchFromDraft}=require('../src/match-factory');
const {MatchEngine}=require('../src/match-engine');
const {calculateStats}=require('../src/stats-engine');
const {buildMatchReport}=require('../src/match-report');
const {ACTION}=require('../src/constants');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
function engine(){const x=createMatchFromDraft(draft,{matchId:'m-stats',now:'2026-10-05T10:00:00Z'});return new MatchEngine(x.state,x.actionLog);}
function test(n,f){try{f();console.log('PASS',n)}catch(e){console.error('FAIL',n,'\n ',e.stack||e);process.exitCode=1}}

test('Anna 0-1-2-3 calcula 0-5-8-10 sense pesos',()=>{
 const e=engine();
 // Generem accions Anna sintètiques directament al log per provar la fórmula aïllada.
 for(const value of [0,1,2,3]) e._append(ACTION.RECEPCIO,{playerId:'p3',zone:'4',value});
 const s=calculateStats(e.log); const r=s.players.p3.anna.RECEPCIO;
 assert.deepEqual(r.counts,{0:1,1:1,2:1,3:1});
 assert.equal(r.actions,4); assert.equal(r.annaPoints,23); assert.equal(r.efficiency,23/40);
 assert.equal(r.percentages[0],0.25); assert.equal(r.percentages[3],0.25);
});

test('Salvades 1-3 es compten però no entren a Anna',()=>{
 const e=engine();
 e._append(ACTION.RECEPCIO,{playerId:'p3',zone:'4',value:0});
 e._append(ACTION.SALVADA,{playerId:'p4',zone:'3',value:1});
 e._append(ACTION.SALVADA,{playerId:'p4',zone:'3',value:2});
 e._append(ACTION.SALVADA,{playerId:'p4',zone:'3',value:3});
 const s=calculateStats(e.log);
 assert.equal(s.teamAnnaActions,1);
 assert.deepEqual(s.players.p4.saves.counts,{1:1,2:1,3:1});
 assert.equal(s.players.p4.saves.total,3);
 assert.equal(s.players.p4.annaTotal.actions,0);
});

test('Impacte = punts Anna jugadora / (accions Anna equip * 10)',()=>{
 const e=engine();
 e._append(ACTION.ATAC,{playerId:'p3',zone:'4',value:3}); // 10
 e._append(ACTION.ATAC,{playerId:'p4',zone:'3',value:2}); // 8
 const s=calculateStats(e.log);
 assert.equal(s.teamAnnaActions,2);
 assert.equal(s.players.p3.impact,10/20);
 assert.equal(s.players.p4.impact,8/20);
});

test('Bloqueig queda separat de la fórmula Anna',()=>{
 const e=engine();
 e._append(ACTION.BLOQUEIG,{playerId:'p3',zone:'4',value:2});
 const s=calculateStats(e.log);
 assert.equal(s.teamAnnaActions,0);
 assert.equal(s.players.p3.blocks.total,1);
 assert.equal(s.players.p3.annaTotal.actions,0);
});

test('MatchReport deriva de MatchState + ActionLog',()=>{
 const e=engine();
 e._append(ACTION.SERVEI,{playerId:'p10',zone:'1',value:3});
 e._append(ACTION.SALVADA,{playerId:'p3',zone:'4',value:2});
 const report=buildMatchReport(e.state,e.log);
 assert.equal(report.matchId,'m-stats');
 assert.equal(report.stats.teamAnnaActions,1);
 assert(report.stats.players.find(p=>p.playerId==='p3').saves.total===1);
 assert(report.stats.players.find(p=>p.playerId==='p10').anna.SERVEI.actions===1);
});

if(!process.exitCode) console.log('\nRESULTAT FINAL: PASS — STATSENGINE PRO.2 001');
