'use strict';
const assert=require('assert');
const {buildMatchAnalytics,buildHistoryAnalytics,trendLabel}=require('../src/anna-analytics');
const {createMatchFromDraft}=require('../src/match-factory');
const {MatchEngine}=require('../src/match-engine');
const {buildMatchReport}=require('../src/match-report');
const draft=require('../fixtures/draft.json');
function make(id,date,serveVals){const d=JSON.parse(JSON.stringify(draft));d.date=date;const {state,actionLog}=createMatchFromDraft(d,{matchId:id,now:date+'T10:00:00Z'});const e=new MatchEngine(state,actionLog);for(const v of serveVals){e.ratePlayer('4',v); if(v===0||v===3){/* point closes */} else {e.ratePlayer('3',2);e.ratePlayer('4',2);e.ratePlayer('3',3);} } e.finishSet();e.finishMatch();return buildMatchReport(e.state,e.log);}
const r1=make('a','2026-10-01',[1,2,2]);
const r2=make('b','2026-10-02',[2,3,3]);
const a=buildMatchAnalytics(r1);assert(a.actions>0);assert(a.teamFoundations.some(x=>x.type==='DEFENSA'));assert(a.bestSet);
const h=buildHistoryAnalytics([r1,r2],{teamId:r1.metadata.teamId});assert.equal(h.matches,2);assert(h.players.length>0);assert.equal(h.teamFoundationEvolution.length,5);assert(['Millora','Baixa','Estable','Sense dades'].includes(h.players[0].trend));
assert.equal(trendLabel(0.031),'Millora');assert.equal(trendLabel(-0.031),'Baixa');assert.equal(trendLabel(0.02),'Estable');
console.log('PASS analytics 044: informe Anna, evolució històrica i llindar ±3%');
