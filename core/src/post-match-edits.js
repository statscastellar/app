'use strict';
const { clone, assert } = require('./utils');
const { ACTION } = require('./constants');
const { ANNA_TYPES, calculateStats } = require('./stats-engine');
const { valueDigest } = require('./session-integrity');

const EDITABLE_TYPES=new Set([...ANNA_TYPES,ACTION.BLOQUEIG,ACTION.SALVADA]);
function allowedValues(type){
  if(ANNA_TYPES.includes(type)) return [0,1,2,3];
  if(type===ACTION.BLOQUEIG) return [0,1,2];
  if(type===ACTION.SALVADA) return [1,2,3];
  return [];
}
function payload(edits){return {version:1,edits:clone(edits||[])};}
function sealPostMatchEdits(edits){const p=payload(edits);return {...p,algorithm:'fnv1a32-stable-json',digest:valueDigest(p)};}
function verifyPostMatchEdits(envelope,baseReport){
  if(!envelope) return {ok:true,count:0,digest:null};
  assert(envelope.version===1 && envelope.algorithm==='fnv1a32-stable-json','Integritat d’edicions postpartit desconeguda');
  assert(envelope.digest===valueDigest(payload(envelope.edits)),'Edicions postpartit manipulades');
  const values=new Map((baseReport?.actions||[]).filter(a=>EDITABLE_TYPES.has(a.type)&&Number.isInteger(a.value)).map(a=>[a.actionId,a.value]));
  for(const e of envelope.edits||[]){
    assert(values.has(e.actionId),'Edició postpartit sobre una acció inexistent');
    const row=(baseReport.actions||[]).find(a=>a.actionId===e.actionId);
    assert(allowedValues(row.type).includes(e.newValue),'Valor postpartit invàlid');
    assert(values.get(e.actionId)===e.previousValue,'Cadena d’edicions postpartit inconsistent');
    values.set(e.actionId,e.newValue);
  }
  return {ok:true,count:(envelope.edits||[]).length,digest:envelope.digest};
}
function emptyBucket(){return {counts:{0:0,1:0,2:0,3:0},actions:0,annaPoints:0,efficiency:null,percentages:{0:null,1:null,2:null,3:null}};}
function emptyPlayer(playerId){return {playerId,anna:Object.fromEntries(ANNA_TYPES.map(t=>[t,emptyBucket()])),annaTotal:emptyBucket(),impact:null,saves:{counts:{1:0,2:0,3:0},total:0,details:[]},blocks:{counts:{0:0,1:0,2:0},total:0,details:[]}};}
function statsRows(stats,basePlayers,participation){
  const byId=Object.fromEntries((basePlayers||[]).map(p=>[p.playerId,p]));
  const ids=new Set([...Object.keys(byId),...Object.keys(stats.players||{})]);
  return [...ids].map(id=>{
    const base=byId[id]||{playerId:id,number:null,name:id};
    const st=stats.players[id]||emptyPlayer(id);
    return {...clone(base),...clone(st),participation:clone(participation?.byPlayer?.[id]||base.participation||{playerId:id,sets:{},points:0,totalPoints:0,participation:null,setsPlayed:0})};
  }).sort((a,b)=>(Number(a.number)||999)-(Number(b.number)||999));
}
function applyPostMatchEditsToReport(baseReport,envelope){
  if(!envelope || !(envelope.edits||[]).length) return clone(baseReport);
  verifyPostMatchEdits(envelope,baseReport);
  const out=clone(baseReport), editsByAction=new Map();
  for(const e of envelope.edits) editsByAction.set(e.actionId,e);
  for(const a of out.actions||[]){
    const e=editsByAction.get(a.actionId); if(!e) continue;
    if(a.originalValue==null) a.originalValue=a.value;
    a.value=e.newValue; a.editedPostMatch=true; a.lastEditedAt=e.editedAt||null;
  }
  const pseudo={schemaVersion:1,matchId:out.matchId,actions:(out.actions||[]).filter(a=>EDITABLE_TYPES.has(a.type)&&Number.isInteger(a.value)).map((a,i)=>({sequence:a.sequence??i+1,actionId:a.actionId,set:a.set,type:a.type,active:true,data:{playerId:a.playerId,value:a.value}}))};
  const stats=calculateStats(pseudo), participation=clone(baseReport.stats?.participation||{byPlayer:{},totalPoints:0});
  out.stats.teamAnnaActions=stats.teamAnnaActions;out.stats.teamAnna=clone(stats.teamAnna);out.stats.teamAnnaTotal=clone(stats.teamAnnaTotal);out.stats.teamSaves=clone(stats.teamSaves);out.stats.teamBlocks=clone(stats.teamBlocks);out.stats.players=statsRows(stats,baseReport.stats?.players||[],participation);
  const setNos=Object.keys(baseReport.stats?.bySet||{}).map(Number);
  out.stats.bySet={};
  for(const n of setNos){
    const sub={actions:pseudo.actions.filter(a=>Number(a.set)===n)}, st=calculateStats(sub), old=baseReport.stats.bySet[n]||{};
    out.stats.bySet[n]={...clone(old),teamAnnaActions:st.teamAnnaActions,teamAnna:clone(st.teamAnna),teamAnnaTotal:clone(st.teamAnnaTotal),teamSaves:clone(st.teamSaves),teamBlocks:clone(st.teamBlocks),players:statsRows(st,old.players||baseReport.stats?.players||[],old.participation||participation)};
  }
  out.audit={...(out.audit||{}),postMatchEdits:(envelope.edits||[]).length,postMatchEditDigest:envelope.digest};
  out.generatedFrom={...(out.generatedFrom||{}),postMatchEditDigest:envelope.digest};
  return out;
}
function appendPostMatchEdit(baseReport,envelope,actionId,newValue,editedAt=new Date().toISOString()){
  const current=applyPostMatchEditsToReport(baseReport,envelope), row=(current.actions||[]).find(a=>a.actionId===actionId);
  assert(row && EDITABLE_TYPES.has(row.type),'Aquesta acció no es pot editar');
  const v=Number(newValue); assert(Number.isInteger(v)&&allowedValues(row.type).includes(v),'Valor nou no permès per a aquesta acció');
  assert(row.value!==v,'El valor nou és igual que l’actual');
  const edits=clone(envelope?.edits||[]);edits.push({editId:`post:${Date.now()}:${edits.length+1}`,actionId,rowType:row.type,playerId:row.playerId||null,set:row.set??null,previousValue:row.value,newValue:v,editedAt});
  return sealPostMatchEdits(edits);
}
module.exports={EDITABLE_TYPES,allowedValues,sealPostMatchEdits,verifyPostMatchEdits,applyPostMatchEditsToReport,appendPostMatchEdit};
