'use strict';

const { clone } = require('./utils');
const { ACTION } = require('./constants');

function actionsOfActive(activeRecord) {
  return activeRecord?.session?.actionLog?.actions || [];
}
function actionsOfCompleted(completedRecord) {
  return completedRecord?.actionLog?.actions || [];
}

function sameAction(a,b) { return JSON.stringify(a)===JSON.stringify(b); }

function assessFinalizationResidue(activeRecord, completedRecord) {
  if(!activeRecord || !completedRecord) return {status:'none'};
  const activeId=String(activeRecord.matchId||activeRecord?.session?.matchId||'');
  const completedId=String(completedRecord.matchId||'');
  if(!activeId || activeId!==completedId) return {status:'conflict',reason:'matchId'};
  const a=actionsOfActive(activeRecord), c=actionsOfCompleted(completedRecord);
  if(c.length!==a.length+1) return {status:'conflict',reason:'action-count'};
  for(let i=0;i<a.length;i++) if(!sameAction(a[i],c[i])) return {status:'conflict',reason:'action-prefix',index:i};
  const tail=c[c.length-1];
  if(!tail || tail.type!==ACTION.MATCH_END || tail.active===false) return {status:'conflict',reason:'missing-match-end'};
  const activeState=activeRecord?.session?.state;
  const finalState=completedRecord?.finalState;
  if(activeState?.lifecycle?.status!=='active' || finalState?.lifecycle?.status!=='finished') return {status:'conflict',reason:'lifecycle'};
  return {status:'safe-residue',matchId:completedId,completed:clone(completedRecord)};
}

function finalizationResidueConflict(matchId, reason) {
  const e=new Error('Conflicte de reconciliació: el mateix matchId existeix com a actiu i finalitzat però les dades no formen una finalització compatible.');
  e.code='FINALIZATION_RESIDUE_CONFLICT'; e.matchId=String(matchId); e.reason=reason||'divergent'; return e;
}


function staleActiveWriteError(matchId, expectedRevision, actualRevision) {
  const e=new Error('Conflicte de desament: aquesta còpia del partit és més antiga que la versió ja desada. Recupera la versió més recent abans de continuar.');
  e.code='STALE_ACTIVE_WRITE'; e.matchId=String(matchId); e.expectedRevision=expectedRevision; e.actualRevision=actualRevision; return e;
}

function alreadyFinalizedError(matchId) {
  const e=new Error('Aquest partit ja està finalitzat i no es pot tornar a desar com a actiu.');
  e.code='MATCH_ALREADY_FINALIZED'; e.matchId=String(matchId); return e;
}

module.exports={ assessFinalizationResidue, finalizationResidueConflict, alreadyFinalizedError, staleActiveWriteError };
