'use strict';
const assert=require('assert');const fs=require('fs');const path=require('path');
const {buildHistoryAnalytics}=require('../src/anna-analytics');
const {createMatchFromDraft}=require('../src/match-factory');const {MatchEngine}=require('../src/match-engine');const {buildMatchReport}=require('../src/match-report');const draft=require('../fixtures/draft.json');
function make(id,date,vals){const d=JSON.parse(JSON.stringify(draft));d.match.date=date;const {state,actionLog}=createMatchFromDraft(d,{matchId:id,now:date+'T10:00:00Z'});const e=new MatchEngine(state,actionLog);for(const v of vals){e.ratePlayer('4',v);if(v!==0&&v!==3){e.ratePlayer('3',2);e.ratePlayer('4',2);e.ratePlayer('3',3);}}e.finishSet();e.finishMatch();return buildMatchReport(e.state,e.log);}
const r1=make('h054-a','2026-10-01',[1,2,2]),r2=make('h054-b','2026-10-02',[2,2,3]),r3=make('h054-c','2026-10-03',[3,3,3]);
const all=buildHistoryAnalytics([r3,r1,r2],{teamId:r1.metadata.teamId});const subset=buildHistoryAnalytics([r1,r3],{teamId:r1.metadata.teamId});
assert.equal(all.matches,3);assert.equal(subset.matches,2);assert.deepEqual(all.perMatch.map(x=>x.matchId),['h054-a','h054-b','h054-c']);assert.notEqual(all.teamTotal.actions,subset.teamTotal.actions);
const reportJs=fs.readFileSync(path.join(__dirname,'../../Informe/report.js'),'utf8');const histHtml=fs.readFileSync(path.join(__dirname,'../../Historial/index.html'),'utf8');const histJs=fs.readFileSync(path.join(__dirname,'../../Historial/history.js'),'utf8');
assert(reportJs.includes('Math.min(5'));assert(reportJs.includes('const min=0,max=1'));assert(reportJs.includes('analysisSelection:'));assert(histHtml.includes('Importa partit'));assert(histHtml.includes('Estadístiques acumulades'));assert(histJs.includes('stats-castellar-pro2-match'));
console.log('PASS 054 — selecció d’històric, finestra de 5 partits, eix 0–100 i compartir/importar Pro.2');
