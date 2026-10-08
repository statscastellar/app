'use strict';
const { ANNA_TYPES } = require('./stats-engine');

function sumCounts(target, source, keys) {
  for (const k of keys) target[k] = (target[k] || 0) + Number(source?.[k] || 0);
  return target;
}
function sameCounts(a,b,keys){return keys.every(k=>Number(a?.[k]||0)===Number(b?.[k]||0));}

function validateReportConsistency(report) {
  const errors=[];
  const players=report?.stats?.players||[];
  const teamAnna=report?.stats?.teamAnna||{};
  const keys=[0,1,2,3];

  for(const t of ANNA_TYPES){
    const sum={0:0,1:0,2:0,3:0};
    for(const p of players) sumCounts(sum,p?.anna?.[t]?.counts,keys);
    if(!sameCounts(sum,teamAnna?.[t]?.counts,keys)) errors.push(`Fonament ${t}: els totals d'equip no coincideixen amb la suma de jugadores`);
  }

  const total={0:0,1:0,2:0,3:0};
  for(const t of ANNA_TYPES) sumCounts(total,teamAnna?.[t]?.counts,keys);
  if(!sameCounts(total,report?.stats?.teamAnnaTotal?.counts,keys)) errors.push('Anna total: no coincideix amb la suma dels cinc fonaments');

  const saves={1:0,2:0,3:0};
  for(const p of players) sumCounts(saves,p?.saves?.counts,[1,2,3]);
  if(!sameCounts(saves,report?.stats?.teamSaves?.counts,[1,2,3])) errors.push('Salvades: els totals d’equip no coincideixen amb la suma de jugadores');

  const blocks={0:0,1:0,2:0};
  for(const p of players) sumCounts(blocks,p?.blocks?.counts,[0,1,2]);
  if(!sameCounts(blocks,report?.stats?.teamBlocks?.counts,[0,1,2])) errors.push('Bloqueig: els totals d’equip no coincideixen amb la suma de jugadores');

  const actionRows=report?.actions||[];
  if(Number(report?.audit?.activeActions??actionRows.length)!==actionRows.length) errors.push('Audit: activeActions no coincideix amb les files d’accions actives');

  return { ok: errors.length===0, errors };
}

function assertReportConsistency(report){
  const r=validateReportConsistency(report);
  if(!r.ok) throw new Error('MatchReport inconsistent: '+r.errors.join(' | '));
  return true;
}

module.exports={validateReportConsistency,assertReportConsistency};
