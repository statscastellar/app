'use strict';
const { ACTION } = require('./constants');

function calculateParticipation(actionLog) {
  const actions=(actionLog.actions||[]).filter(a=>a.active!==false).slice().sort((a,b)=>a.sequence-b.sequence);
  const sets={}; let currentSet=1; let lineup=new Set();
  function ensureSet(n){if(!sets[n])sets[n]={set:n,points:[],lineupStart:[]};return sets[n];}
  function setCourt(court){lineup=new Set(Object.values(court||{}).filter(Boolean));}
  for(const a of actions){const d=a.data||{};currentSet=a.set||currentSet;const s=ensureSet(currentSet);
    if(a.type===ACTION.MATCH_START){setCourt(d.court);s.lineupStart=[...lineup];continue;}
    if(a.type===ACTION.SET_START){currentSet=d.set||a.set||currentSet;const ns=ensureSet(currentSet);setCourt(d.court);ns.lineupStart=[...lineup];continue;}
    if(a.type===ACTION.SUBSTITUTION){if(d.playerOutId)lineup.delete(d.playerOutId);if(d.playerInId)lineup.add(d.playerInId);continue;}
    if(a.type===ACTION.POINT){s.points.push({side:d.side||null,players:[...lineup],sequence:a.sequence,removed:false});continue;}
    if(a.type===ACTION.SCORE_CORRECTION){if(d.delta===-1){for(let i=s.points.length-1;i>=0;i--){const p=s.points[i];if(!p.removed&&(!d.side||p.side===d.side)){p.removed=true;break;}}}else if(d.delta===1){s.points.push({side:d.side||null,players:[...lineup],sequence:a.sequence,removed:false,correction:true});}continue;}
  }
  const byPlayer={}; let globalPoints=0;
  for(const s of Object.values(sets)){const effective=s.points.filter(p=>!p.removed),total=effective.length;globalPoints+=total;const counts={};for(const p of effective)for(const id of p.players)counts[id]=(counts[id]||0)+1;s.totalPoints=total;s.playerPoints=counts;for(const [id,n] of Object.entries(counts)){if(!byPlayer[id])byPlayer[id]={playerId:id,sets:{},points:0,totalPoints:0,participation:null,setsPlayed:0};byPlayer[id].sets[s.set]={points:n,totalPoints:total,participation:total?n/total:null};byPlayer[id].points+=n;byPlayer[id].setsPlayed++;}}
  for(const p of Object.values(byPlayer)){p.totalPoints=globalPoints;p.participation=globalPoints?p.points/globalPoints:null;}
  return {sets,byPlayer,totalPoints:globalPoints};
}
module.exports={calculateParticipation};
