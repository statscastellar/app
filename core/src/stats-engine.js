'use strict';

const { ACTION, STAT_ACTIONS_ANNA } = require('./constants');

const ANNA_SCORE = Object.freeze({0:0,1:5,2:8,3:10});
const ANNA_TYPES = [ACTION.SERVEI, ACTION.RECEPCIO, ACTION.COLLOCACIO, ACTION.ATAC, ACTION.DEFENSA];

function blankAnnaBucket() {
  return { counts:{0:0,1:0,2:0,3:0}, actions:0, annaPoints:0, efficiency:null, percentages:{0:null,1:null,2:null,3:null} };
}
function finalizeAnna(b) {
  b.actions = b.counts[0]+b.counts[1]+b.counts[2]+b.counts[3];
  b.annaPoints = b.counts[1]*5+b.counts[2]*8+b.counts[3]*10;
  b.efficiency = b.actions ? b.annaPoints/(b.actions*10) : null;
  for(const k of [0,1,2,3]) b.percentages[k] = b.actions ? b.counts[k]/b.actions : null;
  return b;
}
function ensurePlayer(map, playerId) {
  if(!map[playerId]) {
    map[playerId] = {
      playerId,
      anna: Object.fromEntries(ANNA_TYPES.map(t=>[t,blankAnnaBucket()])),
      annaTotal: blankAnnaBucket(),
      saves:{counts:{1:0,2:0,3:0},total:0,details:[]},
      blocks:{counts:{0:0,1:0,2:0},total:0,details:[]}
    };
  }
  return map[playerId];
}

function calculateStats(actionLog) {
  const actions=(actionLog.actions||[]).filter(a=>a.active!==false);
  const players={};
  let teamAnnaActions=0;
  const teamAnna=Object.fromEntries(ANNA_TYPES.map(t=>[t,blankAnnaBucket()]));
  const teamSaves={counts:{1:0,2:0,3:0},total:0,details:[]};
  const teamBlocks={counts:{0:0,1:0,2:0},total:0,details:[]};

  for(const a of actions) {
    const d=a.data||{};
    if(STAT_ACTIONS_ANNA.has(a.type)) {
      if(!d.playerId || !Number.isInteger(d.value) || d.value<0 || d.value>3) continue;
      const p=ensurePlayer(players,d.playerId);
      p.anna[a.type].counts[d.value]++;
      p.annaTotal.counts[d.value]++;
      teamAnna[a.type].counts[d.value]++;
      teamAnnaActions++;
    } else if(a.type===ACTION.SALVADA) {
      if(!d.playerId || ![1,2,3].includes(d.value)) continue;
      const p=ensurePlayer(players,d.playerId);
      p.saves.counts[d.value]++; p.saves.total++;
      p.saves.details.push({actionId:a.actionId,set:a.set,value:d.value,sequence:a.sequence});
      teamSaves.counts[d.value]++; teamSaves.total++;
      teamSaves.details.push({actionId:a.actionId,set:a.set,value:d.value,sequence:a.sequence,playerId:d.playerId});
    } else if(a.type===ACTION.BLOQUEIG) {
      if(!d.playerId || ![0,1,2].includes(d.value)) continue;
      const p=ensurePlayer(players,d.playerId);
      p.blocks.counts[d.value]++; p.blocks.total++;
      p.blocks.details.push({actionId:a.actionId,set:a.set,value:d.value,sequence:a.sequence});
      teamBlocks.counts[d.value]++; teamBlocks.total++;
      teamBlocks.details.push({actionId:a.actionId,set:a.set,value:d.value,sequence:a.sequence,playerId:d.playerId});
    }
  }

  for(const p of Object.values(players)) {
    for(const t of ANNA_TYPES) finalizeAnna(p.anna[t]);
    finalizeAnna(p.annaTotal);
    p.impact = teamAnnaActions ? p.annaTotal.annaPoints/(teamAnnaActions*10) : null;
  }
  for(const t of ANNA_TYPES) finalizeAnna(teamAnna[t]);
  const teamAnnaTotal=blankAnnaBucket();
  for(const t of ANNA_TYPES) for(const k of [0,1,2,3]) teamAnnaTotal.counts[k]+=teamAnna[t].counts[k];
  finalizeAnna(teamAnnaTotal);

  return { teamAnnaActions, teamAnna, teamAnnaTotal, teamSaves, teamBlocks, players };
}

module.exports = { ANNA_SCORE, ANNA_TYPES, calculateStats };
