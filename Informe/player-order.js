/* View-only PJ calculation: a call-up implies at least one set under the competition rules. */
(function(root){
'use strict';
function tablePlayers(players,pairs,canonicalId){
 const rows=new Map(players.map(p=>[String(p.playerId),{...p,pj:0}]));
 for(const {record,report} of pairs){
  const roster=record?.finalState?.roster,called=roster?.calledPlayerIds;
  const explicit=Array.isArray(called);
  const candidates=explicit?(roster.snapshot||[]).filter(p=>called.includes(p.playerId)):(report?.stats?.players||[]).filter(p=>{
   // Historical fallback agreed with the owner: recorded statistics imply a call-up.
   return (p.annaTotal?.actions||0)>0||(p.blocks?.total||0)>0||(p.saves?.total||0)>0;
  });
  const seen=new Set();
  for(const p of candidates){const id=String(canonicalId(p,report?.metadata?.teamId)||p.playerId);if(seen.has(id))continue;seen.add(id);
   if(!rows.has(id))rows.set(id,{playerId:id,number:p.number??'',name:p.name||'',total:{actions:0,annaPoints:0,efficiency:null},matches:[],delta:null,pct0:null,pct3:null,trend:'Sense dades',pj:0});
   rows.get(id).pj++;
  }
 }
 return [...rows.values()];
}
function compareValue(a,b,direction){
 const missing=v=>v==null||(typeof v==='number'&&!Number.isFinite(v));
 if(missing(a)||missing(b))return missing(a)===missing(b)?0:missing(a)?1:-1;
 return (typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),'ca',{numeric:true}))*direction;
}
function defaultOrder(a,b){return compareValue(a.pj,b.pj,-1)||compareValue(a.total.efficiency,b.total.efficiency,-1)||compareValue(a.number===''?null:Number(a.number),b.number===''?null:Number(b.number),1)||String(a.playerId).localeCompare(String(b.playerId));}
function sorted(players,value,direction){return [...players].sort((a,b)=>(value?compareValue(value(a),value(b),direction):0)||defaultOrder(a,b));}
const api={tablePlayers,compareValue,defaultOrder,sorted};
if(typeof module==='object'&&module.exports)module.exports=api;else root.HistoryPlayerOrder=api;
})(typeof window==='object'?window:globalThis);
