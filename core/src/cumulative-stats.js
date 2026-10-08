'use strict';
const { ANNA_TYPES }=require('./stats-engine');
const { reportFromCompletedRecord, buildMatchReport }=require('./match-report');
const { verifyIntegrity, sessionDigest, valueDigest }=require('./session-integrity');
const { verifyReportIntegrity }=require('./report-integrity');
const { assert, clone }=require('./utils');
const { isLegacyImportRecord, verifyLegacyImportRecord }=require('./legacy-import');
const { verifyPostMatchEdits, applyPostMatchEditsToReport }=require('./post-match-edits');
function bucket(){return {counts:{0:0,1:0,2:0,3:0},actions:0,annaPoints:0,efficiency:null,percentages:{0:null,1:null,2:null,3:null}}}
function finalize(b){b.actions=b.counts[0]+b.counts[1]+b.counts[2]+b.counts[3];b.annaPoints=b.counts[1]*5+b.counts[2]*8+b.counts[3]*10;b.efficiency=b.actions?b.annaPoints/(b.actions*10):null;for(const k of [0,1,2,3])b.percentages[k]=b.actions?b.counts[k]/b.actions:null;return b;}
function emptyPlayer(p){return {playerId:p.playerId,number:p.number??'',name:p.name??'',matches:0,anna:Object.fromEntries(ANNA_TYPES.map(t=>[t,bucket()])),annaTotal:bucket(),impact:null,saves:{counts:{1:0,2:0,3:0},total:0},blocks:{counts:{0:0,1:0,2:0},total:0},participation:{points:0,totalPoints:0,participation:null}}}
function teamIdOfRecord(rec){const r=reportFromCompletedRecord(rec);return r?.metadata?.teamId || rec?.metadata?.teamId || null;}
function groupCompletedByTeam(records){const groups={};for(const rec of records||[]){const id=teamIdOfRecord(rec)||'__unknown__';(groups[id]||(groups[id]=[])).push(rec);}return groups;}
function calculateCumulative(records,options={}){let input=records||[];const teamId=options.teamId||null;if(teamId) input=input.filter(r=>teamIdOfRecord(r)===teamId);else {const ids=[...new Set(input.map(teamIdOfRecord).filter(Boolean))];if(ids.length>1) throw new Error('Hi ha partits de més d’un equip: cal indicar teamId per calcular acumulats sense barrejar equips.');}
 const players={};const teamAnna=Object.fromEntries(ANNA_TYPES.map(t=>[t,bucket()]));let matches=0,totalParticipationPoints=0;let resolvedTeamId=teamId||null;let teamName='';
 for(const rec of input){const r=reportFromCompletedRecord(rec);if(!r||!r.stats)continue;resolvedTeamId=resolvedTeamId||r.metadata?.teamId||null;teamName=teamName||r.metadata?.teamName||'';matches++;totalParticipationPoints+=r.stats.participation?.totalPoints||0;for(const p of r.stats.players||[]){const x=players[p.playerId]||(players[p.playerId]=emptyPlayer(p));x.number=p.number??x.number;x.name=p.name??x.name;x.matches++;for(const t of ANNA_TYPES){for(const k of [0,1,2,3]){const n=p.anna?.[t]?.counts?.[k]||0;x.anna[t].counts[k]+=n;teamAnna[t].counts[k]+=n;}}for(const k of [1,2,3])x.saves.counts[k]+=p.saves?.counts?.[k]||0;x.saves.total+=p.saves?.total||0;for(const k of [0,1,2])x.blocks.counts[k]+=p.blocks?.counts?.[k]||0;x.blocks.total+=p.blocks?.total||0;x.participation.points+=p.participation?.points||0;x.participation.totalPoints+=p.participation?.totalPoints||0;}}
 for(const t of ANNA_TYPES)finalize(teamAnna[t]);const teamAnnaTotal=bucket();for(const t of ANNA_TYPES)for(const k of [0,1,2,3])teamAnnaTotal.counts[k]+=teamAnna[t].counts[k];finalize(teamAnnaTotal);
 for(const x of Object.values(players)){for(const t of ANNA_TYPES){finalize(x.anna[t]);for(const k of [0,1,2,3])x.annaTotal.counts[k]+=x.anna[t].counts[k];}finalize(x.annaTotal);x.impact=teamAnnaTotal.actions?x.annaTotal.annaPoints/(teamAnnaTotal.actions*10):null;x.participation.participation=x.participation.totalPoints?x.participation.points/x.participation.totalPoints:null;}
 return {schemaVersion:2,teamId:resolvedTeamId,teamName,matches,teamAnna,teamAnnaTotal,totalParticipationPoints,players:Object.values(players).sort((a,b)=>(a.number??999)-(b.number??999))};}
function calculateCumulativeByTeam(records){const groups=groupCompletedByTeam(records);const out={};for(const [id,rows] of Object.entries(groups)){if(id==='__unknown__')continue;out[id]=calculateCumulative(rows,{teamId:id});}return out;}

function verifyCompletedSource(rec) {
 assert(rec && rec.matchId, 'Partit finalitzat sense matchId');
 if(isLegacyImportRecord(rec)){
   const v=verifyLegacyImportRecord(rec);
   verifyPostMatchEdits(rec.postMatchEdits||null,v.report);
   const edited=applyPostMatchEditsToReport(v.report,rec.postMatchEdits||null);
   return {matchId:rec.matchId,teamId:edited.metadata?.teamId||null,completedAt:rec.completedAt||null,sourceKind:'legacy-import',sourceDigest:v.sourceDigest,reportDigest:valueDigest(edited),postMatchEditDigest:rec.postMatchEdits?.digest||null};
 }
 assert(rec.finalState && rec.actionLog, `Partit ${rec.matchId} sense font reproduïble`);
 verifyIntegrity(rec.integrity,rec.finalState,rec.actionLog);
 const base=buildMatchReport(rec.finalState,rec.actionLog);
 verifyReportIntegrity(rec.reportIntegrity,rec.report,rec.finalState,rec.actionLog,base);
 verifyPostMatchEdits(rec.postMatchEdits||null,base);
 const expected=applyPostMatchEditsToReport(base,rec.postMatchEdits||null);
 return {
   matchId:rec.matchId,
   teamId:expected.metadata?.teamId||null,
   completedAt:rec.completedAt||null,
   sessionDigest:sessionDigest(rec.finalState,rec.actionLog),
   reportDigest:valueDigest(expected),
   postMatchEditDigest:rec.postMatchEdits?.digest||null
 };
}
function calculateVerifiedCumulative(records,options={}) {
 const input=records||[];
 const sources=input.map(verifyCompletedSource);
 const cumulative=calculateCumulative(input,options);
 const sourceAudit=sources
   .filter(s=>!options.teamId||s.teamId===options.teamId)
   .sort((a,b)=>String(a.matchId).localeCompare(String(b.matchId)));
 const aggregateCore=clone(cumulative);
 const aggregateDigest=valueDigest({sources:sourceAudit,cumulative:aggregateCore});
 return {...cumulative,verification:{verified:true,sourceCount:sourceAudit.length,sources:sourceAudit,aggregateDigest}};
}
function calculateVerifiedCumulativeByTeam(records){
 const input=records||[];
 input.forEach(verifyCompletedSource);
 const groups=groupCompletedByTeam(input);const out={};
 for(const [id,rows] of Object.entries(groups)){if(id==='__unknown__')continue;out[id]=calculateVerifiedCumulative(rows,{teamId:id});}
 return out;
}
module.exports={calculateCumulative,calculateCumulativeByTeam,groupCompletedByTeam,teamIdOfRecord,verifyCompletedSource,calculateVerifiedCumulative,calculateVerifiedCumulativeByTeam};
