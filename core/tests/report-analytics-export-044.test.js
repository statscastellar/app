'use strict';
const assert=require('assert');
const draft=require('../fixtures/draft.json');
const {simulateMatchFromDraft}=require('../src/simulator');
const {buildMatchReport}=require('../src/match-report');
const {buildMatchAnalytics,buildHistoryAnalytics}=require('../src/anna-analytics');
const E=require('../../shared/export-pro2.js');
function make(id,date){const d=JSON.parse(JSON.stringify(draft));d.match.opponent=id;d.match.date=date;const e=simulateMatchFromDraft(d,{matchId:id,now:date+'T10:00:00Z'});return buildMatchReport(e.state,e.log)}
const r1=make('Rival A','2026-10-01'),r2=make('Rival B','2026-10-02');const h=buildHistoryAnalytics([r1,r2],{teamId:r2.metadata.teamId}),a=buildMatchAnalytics(r2);
const full=E.fullRows(r2);assert(full.rows[4].some(x=>String(x).includes('DEFENSA')));assert(full.rows[4].some(x=>String(x).includes('SALVADES')));assert.equal(E.percentageRows(r2).length,r2.stats.players.length+5);
const x=Buffer.from(E.buildXlsxBytes(r2,null,{reports:[r1,r2],history:h,matchAnalytics:a}));const o=Buffer.from(E.buildOdsBytes(r2,null,{reports:[r1,r2],history:h,matchAnalytics:a}));
for(const token of ['Full partit','Percentatges','Informe tècnic','Acumulat','Evolució jugadores','Per set']){assert(x.includes(Buffer.from(token)),`XLSX sense ${token}`);assert(o.includes(Buffer.from(token)),`ODS sense ${token}`)}
assert(x.includes(Buffer.from('chart1.xml')),'XLSX sense gràfics');assert(o.includes(Buffer.from('Pictures/evolucio_equip.svg')),'ODS sense gràfics');
console.log('PASS 044 informe antic + tècnic + històric + gràfics XLSX/ODS');
