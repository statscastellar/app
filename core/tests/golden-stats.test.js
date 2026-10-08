'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {createMatchFromDraft}=require('../src/match-factory');
const {MatchEngine}=require('../src/match-engine');
const {calculateStats}=require('../src/stats-engine');
const {buildMatchReport}=require('../src/match-report');
const E=require('../../shared/export-pro2.js');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/stats-golden-normalized.json'),'utf8'));
function near(a,b,eps=1e-12){assert(Math.abs(a-b)<=eps,`Esperat ${b}, rebut ${a}`)}
const {state,actionLog}=createMatchFromDraft(draft,{matchId:'golden-stats-pro2',now:'2026-10-05T13:00:00Z'});
const e=new MatchEngine(state,actionLog);
for(const a of fixture.actions)e._append(a.type,{playerId:a.playerId,zone:a.zone,value:a.value});
const s=calculateStats(e.log),x=fixture.expected;
assert.equal(s.teamAnnaActions,x.teamAnnaActions);
assert.equal(s.teamAnnaTotal.annaPoints,x.teamAnnaPoints);
near(s.teamAnnaTotal.efficiency,x.teamAnnaEfficiency);
assert.deepEqual(s.teamSaves.counts,{1:x.teamSaves['1'],2:x.teamSaves['2'],3:x.teamSaves['3']});
assert.equal(s.teamSaves.total,x.teamSaves.total);
assert.deepEqual(s.teamBlocks.counts,{0:x.teamBlocks['0'],1:x.teamBlocks['1'],2:x.teamBlocks['2']});
assert.equal(s.teamBlocks.total,x.teamBlocks.total);
for(const id of ['p3','p4']){
 const p=s.players[id],q=x.players[id];
 assert.equal(p.annaTotal.actions,q.annaActions);assert.equal(p.annaTotal.annaPoints,q.annaPoints);
 near(p.annaTotal.efficiency,q.efficiency);near(p.impact,q.impact);
 assert.deepEqual(p.saves.counts,{1:q.saves['1'],2:q.saves['2'],3:q.saves['3']});assert.equal(p.saves.total,q.saves.total);
 assert.deepEqual(p.blocks.counts,{0:q.blocks['0'],1:q.blocks['1'],2:q.blocks['2']});assert.equal(p.blocks.total,q.blocks.total);
}
// Salvades i Bloqueig NO poden alterar el volum Anna.
assert.equal(fixture.actions.filter(a=>['SERVEI','RECEPCIO','DEFENSA','COLLOCACIO','ATAC'].includes(a.type)).length,s.teamAnnaActions);
const report=buildMatchReport(e.state,e.log);
assert.equal(report.stats.teamAnnaActions,14);assert.equal(report.stats.teamSaves.total,3);assert.equal(report.stats.teamBlocks.total,2);
assert.equal(E.saveRows(report).length,3);
const xlsx=E.buildXlsxBytes(report),ods=E.buildOdsBytes(report);
for(const token of ['Informe','Estadístiques','Dades partit','Salvades','Partit']){
 assert(Buffer.from(xlsx).includes(Buffer.from(token)),`XLSX sense ${token}`);
 assert(Buffer.from(ods).includes(Buffer.from(token)),`ODS sense ${token}`);
}
console.log('PASS golden stats Pro.2: 14 accions Anna, 97 punts, Salvades/Bloqueig separats i exports coherents');
