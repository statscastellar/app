'use strict';

const { clone } = require('./utils');
const { calculateStats, ANNA_TYPES } = require('./stats-engine');
const { calculateParticipation } = require('./participation-engine');
const { ACTION } = require('./constants');
const { assertReportConsistency } = require('./report-consistency');
const { applyPostMatchEditsToReport } = require('./post-match-edits');

const ACTION_LABEL = Object.freeze({
  [ACTION.MATCH_START]:'Inici partit',
  [ACTION.SERVEI]:'Servei',
  [ACTION.RECEPCIO]:'Recepció',
  [ACTION.DEFENSA]:'Defensa',
  [ACTION.COLLOCACIO]:'Col·locació',
  [ACTION.ATAC]:'Atac',
  [ACTION.BLOQUEIG]:'Bloqueig',
  [ACTION.SALVADA]:'Salvada',
  [ACTION.POINT]:'Punt',
  [ACTION.SOS_ACTIVATE]:'SOS',
  [ACTION.CAMP_RIVAL]:'Camp rival',
  [ACTION.ROTATION]:'Rotació',
  [ACTION.POSITION_CHANGE]:'Posicions',
  [ACTION.SUBSTITUTION]:'Canvi',
  [ACTION.SCORE_CORRECTION]:'Correcció marcador',
  [ACTION.SET_END]:'Final set',
  [ACTION.SET_START]:'Inici set',
  [ACTION.MATCH_END]:'Final partit'
});

function normalizeActionRows(actionLog, playersById) {
  const out=[];
  for(const a of (actionLog.actions||[]).slice().sort((x,y)=>x.sequence-y.sequence)) {
    if(a.active===false) continue;
    const d=a.data||{};
    const p=d.playerId ? playersById[d.playerId] : null;
    const pOut=d.playerOutId ? playersById[d.playerOutId] : null;
    const pIn=d.playerInId ? playersById[d.playerInId] : null;
    const scoreAfter=d.scoreAfter||d.score||null;
    let detail='';
    if(a.type===ACTION.SUBSTITUTION) detail=`${pOut?.name||d.playerOutId||''} → ${pIn?.name||d.playerInId||''}`;
    else if(a.type===ACTION.POSITION_CHANGE) detail='Recol·locació de les sis jugadores';
    else if(a.type===ACTION.ROTATION) detail='Rotació automàtica';
    else if(a.type===ACTION.POINT) detail=d.side==='team'?'Punt Castellar':'Punt rival';
    else if(a.type===ACTION.SCORE_CORRECTION) detail=`${d.delta>0?'+':'−'} ${d.side==='team'?'Castellar':'Rival'}`;
    else if(a.type===ACTION.CAMP_RIVAL) detail='Pilota a camp rival';
    else if(a.type===ACTION.SOS_ACTIVATE) detail='Activació de salvada';
    else if(a.type===ACTION.SET_END) detail='Tancament de set';
    else if(a.type===ACTION.SET_START) detail='Preparació del set';
    else if(a.type===ACTION.MATCH_END) detail='Partit finalitzat';
    out.push({
      sequence:a.sequence,
      actionId:a.actionId,
      set:a.set,
      type:a.type,
      label:ACTION_LABEL[a.type]||a.type,
      playerId:d.playerId||null,
      number:p?.number??null,
      playerName:p?.name||null,
      zone:d.zone??null,
      value:Number.isInteger(d.value)?d.value:null,
      teamScore:scoreAfter?.team??null,
      rivalScore:scoreAfter?.rival??null,
      detail,
      provisional:!!a.provisional
    });
  }
  return out;
}

function buildStatsRows(stats, participation, playersById) {
  const involved=new Set([...Object.keys(stats.players||{}),...Object.keys(participation.byPlayer||{})]);
  const emptyBucket=()=>({counts:{0:0,1:0,2:0,3:0},actions:0,annaPoints:0,efficiency:null,percentages:{0:null,1:null,2:null,3:null}});
  return [...involved].map(playerId=>{
    const p=stats.players[playerId]||{playerId,anna:Object.fromEntries(ANNA_TYPES.map(t=>[t,emptyBucket()])),annaTotal:emptyBucket(),impact:null,saves:{counts:{1:0,2:0,3:0},total:0,details:[]},blocks:{counts:{0:0,1:0,2:0},total:0,details:[]}};
    return {...playersById[playerId],...p,participation:clone(participation.byPlayer[playerId]||{playerId,sets:{},points:0,totalPoints:participation.totalPoints,participation:null,setsPlayed:0})};
  }).sort((a,b)=>(a.number??999)-(b.number??999));
}

function calculateSetBreakdown(state, actionLog, playersById) {
  const active=(actionLog.actions||[]).filter(a=>a.active!==false);
  const setNumbers=[...new Set([
    ...(state.game.sets||[]).map(s=>s.set),
    ...active.map(a=>a.set).filter(Number.isInteger)
  ])].sort((a,b)=>a-b);
  const out={};
  for(const setNo of setNumbers) {
    const subLog={schemaVersion:actionLog.schemaVersion,matchId:actionLog.matchId,actions:active.filter(a=>a.set===setNo)};
    const stats=calculateStats(subLog);
    const participation=calculateParticipation(subLog);
    out[setNo]={
      set:setNo,
      teamAnnaActions:stats.teamAnnaActions,
      teamAnna:clone(stats.teamAnna),
      teamAnnaTotal:clone(stats.teamAnnaTotal),
      teamSaves:clone(stats.teamSaves),
      teamBlocks:clone(stats.teamBlocks),
      participation:clone(participation),
      players:buildStatsRows(stats,participation,playersById)
    };
  }
  return out;
}

function buildMatchReport(state, actionLog) {
  const stats=calculateStats(actionLog);
  const participation=calculateParticipation(actionLog);
  const playersById=Object.fromEntries((state.roster.snapshot||[]).map(p=>[p.playerId,p]));
  const rows=buildStatsRows(stats,participation,playersById);
  const bySet=calculateSetBreakdown(state,actionLog,playersById);
  const actions=normalizeActionRows(actionLog,playersById);
  const inactive=(actionLog.actions||[]).filter(a=>a.active===false).length;

  const report = {
    schemaVersion:4,
    matchId:state.identity.matchId,
    metadata:clone(state.metadata),
    result:{sets:clone(state.game.sets),currentSet:state.game.currentSet,currentScore:clone(state.game.score)},
    stats:{
      teamAnnaActions:stats.teamAnnaActions,
      teamAnna:clone(stats.teamAnna),
      teamAnnaTotal:clone(stats.teamAnnaTotal),
      teamSaves:clone(stats.teamSaves),
      teamBlocks:clone(stats.teamBlocks),
      participation:clone(participation),
      players:rows,
      bySet
    },
    actions,
    audit:{activeActions:actions.length,revertedActions:inactive},
    generatedFrom:{actionLogVersion:actionLog.schemaVersion,lastActionId:state.lastActionId}
  };
  assertReportConsistency(report);
  return report;
}

function reportFromCompletedRecord(record) {
  let base=null;
  if(record?.finalState && record?.actionLog) base=buildMatchReport(record.finalState,record.actionLog);
  else if(record?.report) base=clone(record.report);
  return base ? applyPostMatchEditsToReport(base,record?.postMatchEdits||null) : null;
}


module.exports = { buildMatchReport, reportFromCompletedRecord, normalizeActionRows, ACTION_LABEL };
