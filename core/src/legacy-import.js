'use strict';
const { clone, assert } = require('./utils');
const { ACTION } = require('./constants');
const { ANNA_TYPES, calculateStats } = require('./stats-engine');
const { valueDigest, stableStringify } = require('./session-integrity');

const SOURCE_KIND='legacy-import';
const ACTION_MAP=Object.freeze({
  'Servei':ACTION.SERVEI,
  'Recepció':ACTION.RECEPCIO,
  'Recepcio':ACTION.RECEPCIO,
  'Defensa':ACTION.DEFENSA,
  'Col·locació':ACTION.COLLOCACIO,
  'Col.locació':ACTION.COLLOCACIO,
  'Colocació':ACTION.COLLOCACIO,
  'Atac':ACTION.ATAC,
  'Bloqueig':ACTION.BLOQUEIG,
  'Salvada':ACTION.SALVADA
});
function bucket(){return {counts:{0:0,1:0,2:0,3:0},actions:0,annaPoints:0,efficiency:null,percentages:{0:null,1:null,2:null,3:null}};}
function canonicalPlayerId(teamId,p){
  const n=String(p?.number??'').trim();
  if(String(teamId)==='infantil-a' && n) return `ia-${n}`;
  return `${String(teamId||'team').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()}-${n||String(p?.name||'player').toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
}
function parseLegacyResult(v){const m=String(v||'').match(/^\s*(\d+)\s*[-–]\s*(\d+)\s*$/);return m?{team:Number(m[1]),rival:Number(m[2])}:null;}
function allLegacyActions(match){
  const rows=[];let seq=1;
  const sets=Array.isArray(match.completedSets)?match.completedSets:[];
  const reliableBySet=sets.filter(s=>Array.isArray(s.actions)&&s.actions.length).length>1 || !match.legacy;
  for(const s of sets){
    for(const a of s.actions||[]){
      const t=ACTION_MAP[a.action]; if(!t) continue;
      const value=Number(a.value); if(!Number.isInteger(value)) continue;
      const set=reliableBySet?Number(s.set||a.set||1):null;
      rows.push({sequence:seq++,set,type:t,playerId:a.playerId,value,raw:clone(a)});
    }
  }
  if(!sets.length && Array.isArray(match.actions)){
    for(const a of match.actions){const t=ACTION_MAP[a.action];if(!t)continue;const value=Number(a.value);if(!Number.isInteger(value))continue;rows.push({sequence:seq++,set:Number(match.set||1),type:t,playerId:a.playerId,value,raw:clone(a)});}
  }
  return {rows,reliableBySet};
}
function normalizeLegacyMatchDocument(doc){
  assert(doc && doc.format==='Stats Castellar Match','Format de partit antic no reconegut');
  assert(doc.match && doc.match.id,'Partit antic sense id');
  const m=clone(doc.match), teamId=m.teamId||'infantil-a';
  const playerMap={}; const players=[];
  for(const p of m.players||[]){const id=canonicalPlayerId(teamId,p);playerMap[p.id]=id;players.push({playerId:id,number:p.number??'',name:p.name||''});}
  const aa=allLegacyActions(m);
  const pseudo={actions:aa.rows.map((a,i)=>({sequence:i+1,actionId:`legacy-stat:${i+1}`,set:a.set||1,type:a.type,active:true,data:{playerId:playerMap[a.playerId]||a.playerId,value:a.value}}))};
  const stats=calculateStats(pseudo);
  const setList=(m.completedSets||[]).map(s=>Number(s.set)).filter(Number.isInteger).sort((a,b)=>a-b);
  const legacyResult=parseLegacyResult(m.legacyResult);
  const actualScores=(m.completedSets||[]).some(s=>Number(s?.scores?.castellar||0)!==0||Number(s?.scores?.rival||0)!==0);
  const resultSets=(m.completedSets||[]).map(s=>{
    const c=actualScores?Number(s?.scores?.castellar??0):null, r=actualScores?Number(s?.scores?.rival??0):null;
    const winner=actualScores?(c>r?'team':r>c?'rival':null):null;
    return {set:Number(s.set),score:{team:c,rival:r},winner};
  });
  const participationByPlayer={};
  for(const p of players) participationByPlayer[p.playerId]={playerId:p.playerId,sets:{},points:0,totalPoints:setList.length,participation:null,setsPlayed:0};
  for(const s of m.completedSets||[]){
    const setNo=Number(s.set);
    for(const [oldId,part] of Object.entries(s.participation||{})){
      const id=playerMap[oldId]||canonicalPlayerId(teamId,part||{});
      if(!participationByPlayer[id]) participationByPlayer[id]={playerId:id,sets:{},points:0,totalPoints:setList.length,participation:null,setsPlayed:0};
      const pct=Number(part?.percentage); const fraction=Number.isFinite(pct)?Math.max(0,Math.min(1,pct/100)):null;
      participationByPlayer[id].sets[setNo]={set:setNo,participation:fraction,points:fraction,totalPoints:1};
      if(fraction!=null){participationByPlayer[id].points+=fraction;if(fraction>0)participationByPlayer[id].setsPlayed++;}
    }
  }
  for(const p of Object.values(participationByPlayer)) p.participation=p.totalPoints?p.points/p.totalPoints:null;
  const emptyForPlayer=(id)=>({playerId:id,anna:Object.fromEntries(ANNA_TYPES.map(t=>[t,bucket()])),annaTotal:bucket(),impact:null,saves:{counts:{1:0,2:0,3:0},total:0,details:[]},blocks:{counts:{0:0,1:0,2:0},total:0,details:[]}});
  const reportPlayers=players.map(p=>{const st=stats.players[p.playerId]||emptyForPlayer(p.playerId);return {...p,...clone(st),participation:clone(participationByPlayer[p.playerId]||{playerId:p.playerId,sets:{},points:0,totalPoints:setList.length,participation:null,setsPlayed:0})};}).sort((a,b)=>(Number(a.number)||999)-(Number(b.number)||999));
  const bySet={};
  for(const s of m.completedSets||[]){
    const n=Number(s.set), part={byPlayer:{},totalPoints:1};
    for(const p of reportPlayers){const ps=p.participation?.sets?.[n];if(ps)part.byPlayer[p.playerId]={playerId:p.playerId,sets:{[n]:clone(ps)},points:ps.points??ps.participation??0,totalPoints:1,participation:ps.participation,setsPlayed:ps.participation>0?1:0};}
    let setStats={teamAnnaActions:0,teamAnna:Object.fromEntries(ANNA_TYPES.map(t=>[t,bucket()])),teamAnnaTotal:bucket(),teamSaves:{counts:{1:0,2:0,3:0},total:0,details:[]},teamBlocks:{counts:{0:0,1:0,2:0},total:0,details:[]},players:[]};
    if(aa.reliableBySet){const sub={actions:pseudo.actions.filter((x,i)=>aa.rows[i]?.set===n)};const st=calculateStats(sub);setStats={...st,players:reportPlayers.map(p=>({...p,...clone(st.players[p.playerId]||emptyForPlayer(p.playerId)),participation:clone(part.byPlayer[p.playerId]||{playerId:p.playerId,sets:{},points:0,totalPoints:1,participation:0,setsPlayed:0})}))};}
    bySet[n]={set:n,teamAnnaActions:setStats.teamAnnaActions,teamAnna:clone(setStats.teamAnna),teamAnnaTotal:clone(setStats.teamAnnaTotal),teamSaves:clone(setStats.teamSaves),teamBlocks:clone(setStats.teamBlocks),participation:part,players:setStats.players};
  }
  const report={
    schemaVersion:4, matchId:String(m.id),
    metadata:{teamId,teamName:m.teamName||'Infantil A',opponent:m.opponent||'Rival',date:m.date||'',venue:m.venue||'',legacyResult:m.legacyResult||null,sourceKind:SOURCE_KIND},
    result:{sets:resultSets,currentSet:setList.at(-1)||1,currentScore:actualScores?{team:Number(m.scores?.castellar??0),rival:Number(m.scores?.rival??0)}:{team:null,rival:null}},
    stats:{teamAnnaActions:stats.teamAnnaActions,teamAnna:clone(stats.teamAnna),teamAnnaTotal:clone(stats.teamAnnaTotal),teamSaves:clone(stats.teamSaves),teamBlocks:clone(stats.teamBlocks),participation:{byPlayer:clone(participationByPlayer),totalPoints:setList.length},players:reportPlayers,bySet},
    actions:aa.rows.map(a=>({sequence:a.sequence,actionId:`legacy:${a.sequence}`,set:a.set,type:a.type,label:a.raw?.action||a.type,playerId:playerMap[a.playerId]||a.playerId,number:players.find(p=>p.playerId===(playerMap[a.playerId]||a.playerId))?.number??null,playerName:players.find(p=>p.playerId===(playerMap[a.playerId]||a.playerId))?.name||null,value:a.value,teamScore:null,rivalScore:null,detail:'',provisional:false})),
    audit:{activeActions:aa.rows.length,revertedActions:0,sourceKind:SOURCE_KIND,setActionBreakdownAvailable:aa.reliableBySet},
    generatedFrom:{sourceKind:SOURCE_KIND,format:doc.format,version:doc.version||null,exportedAt:doc.exportedAt||null}
  };
  return {match:m,report,reliableBySet:aa.reliableBySet};
}
function makeLegacyImportRecord(doc){
  const {match,report}=normalizeLegacyMatchDocument(doc);
  const source=clone(doc); const completedAt=match.finishedAt||match.date||new Date().toISOString();
  return {schemaVersion:2,schemaMigration:{migrationVersion:1,fromSchemaVersion:null,toSchemaVersion:2,migratedAt:new Date().toISOString(),invariants:['legacySource','legacyIntegrity','report']},sourceKind:SOURCE_KIND,matchId:String(match.id),metadata:clone(report.metadata),legacySource:source,report:clone(report),legacyIntegrity:{version:1,algorithm:'fnv1a32-stable-json',sourceDigest:valueDigest(source),reportDigest:valueDigest(report)},completedAt,importedAt:new Date().toISOString()};
}
function isLegacyImportRecord(rec){return rec?.sourceKind===SOURCE_KIND;}
function verifyLegacyImportRecord(rec){
  assert(isLegacyImportRecord(rec),'No és un partit importat');
  assert(rec.legacyIntegrity?.version===1 && rec.legacyIntegrity?.algorithm==='fnv1a32-stable-json','Integritat de partit importat desconeguda');
  assert(valueDigest(rec.legacySource)===rec.legacyIntegrity.sourceDigest,'Font del partit importat modificada');
  const expected=normalizeLegacyMatchDocument(rec.legacySource).report;
  assert(valueDigest(rec.report)===rec.legacyIntegrity.reportDigest,'Informe importat modificat');
  assert(stableStringify(expected)===stableStringify(rec.report),'Informe importat no coincideix amb la font antiga');
  return {ok:true,sourceDigest:rec.legacyIntegrity.sourceDigest,reportDigest:rec.legacyIntegrity.reportDigest,report:clone(expected)};
}
function repairLegacyImportRecord(rec){
  assert(isLegacyImportRecord(rec),'No és un partit importat');
  const expected=normalizeLegacyMatchDocument(rec.legacySource).report;
  const out=clone(rec); out.report=clone(expected); out.metadata=clone(expected.metadata); out.legacyIntegrity={version:1,algorithm:'fnv1a32-stable-json',sourceDigest:valueDigest(out.legacySource),reportDigest:valueDigest(expected)}; out.reportRecoveredAt=new Date().toISOString(); out.reportRecoverySource='legacy-source'; return out;
}
module.exports={SOURCE_KIND,isLegacyImportRecord,normalizeLegacyMatchDocument,makeLegacyImportRecord,verifyLegacyImportRecord,repairLegacyImportRecord};
