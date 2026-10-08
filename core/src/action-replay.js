'use strict';

const { clone, assert } = require('./utils');
const { PHASE, ACTION } = require('./constants');

function resetPointFlow(state) {
  state.flow.rivalTransit = false;
  state.flow.rivalCourtAvailable = false;
  state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
  state.game.phase = state.game.servingSide === 'team' ? PHASE.SERVEI : PHASE.RECEPCIO;
}

function applyStatAction(state, action) {
  const d = action.data || {};
  const type = action.type;
  if (type === ACTION.SERVEI) {
    if (d.value === 1 || d.value === 2) {
      state.game.phase = PHASE.DEFENSA;
      state.flow.rivalTransit = true;
      state.flow.rivalCourtAvailable = false;
    }
    return;
  }
  if (type === ACTION.RECEPCIO || type === ACTION.DEFENSA) {
    state.flow.rivalTransit = false;
    if (d.value === 0) {
      state.flow.sos = {
        status: 'available',
        origin: { phase: type, playerId: d.playerId, zone: String(d.zone) },
        provisionalPointActionId: null
      };
      state.flow.rivalCourtAvailable = false;
    } else {
      state.game.phase = PHASE.COLLOCACIO;
      state.flow.rivalCourtAvailable = true;
    }
    return;
  }
  if (type === ACTION.COLLOCACIO) {
    state.flow.rivalTransit = false;
    state.flow.rivalCourtAvailable = false;
    if (d.value > 0) {
      state.game.phase = PHASE.ATAC;
      state.flow.rivalCourtAvailable = true;
    }
    return;
  }
  if (type === ACTION.ATAC) {
    state.flow.rivalCourtAvailable = false;
    if (d.value === 1 || d.value === 2) {
      state.game.phase = PHASE.DEFENSA;
      state.flow.rivalTransit = true;
    } else {
      state.flow.rivalTransit = false;
    }
    return;
  }
  if (type === ACTION.BLOQUEIG) {
    state.game.phase = PHASE.BLOQUEIG;
    state.flow.rivalTransit = false;
    state.flow.rivalCourtAvailable = false;
    if (d.value === 1) {
      state.game.phase = PHASE.DEFENSA;
      state.flow.rivalCourtAvailable = true;
    }
    return;
  }
  if (type === ACTION.SALVADA) {
    state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
    state.game.phase = PHASE.COLLOCACIO;
    state.flow.rivalTransit = false;
    state.flow.rivalCourtAvailable = false;
  }
}

function applyAction(state, action) {
  const d = action.data || {};
  switch (action.type) {
    case ACTION.MATCH_START:
      return;
    case ACTION.SERVEI:
    case ACTION.RECEPCIO:
    case ACTION.DEFENSA:
    case ACTION.COLLOCACIO:
    case ACTION.ATAC:
    case ACTION.BLOQUEIG:
    case ACTION.SALVADA:
      applyStatAction(state, action);
      break;
    case ACTION.ROTATION:
      state.game.court = clone(d.after);
      break;
    case ACTION.POINT: {
      state.game.score = clone(d.scoreAfter);
      if (d.side === 'team' && state.game.servingSide === 'rival') state.game.servingSide = 'team';
      else if (d.side === 'rival' && state.game.servingSide === 'team') state.game.servingSide = 'rival';
      resetPointFlow(state);
      break;
    }
    case ACTION.SOS_AVAILABLE:
      state.flow.sos = { status: 'available', origin: clone(d.origin), provisionalPointActionId: d.provisionalPointActionId };
      state.game.phase = d.origin.phase;
      state.flow.rivalTransit = false;
      state.flow.rivalCourtAvailable = false;
      break;
    case ACTION.SOS_ACTIVATE:
      state.flow.sos = { status: 'active', origin: clone(d.origin), provisionalPointActionId: d.provisionalPointActionId };
      state.game.phase = d.origin.phase;
      state.flow.rivalTransit = false;
      state.flow.rivalCourtAvailable = false;
      break;
    case ACTION.CAMP_RIVAL:
      state.flow.rivalCourtAvailable = false;
      state.flow.rivalTransit = true;
      state.game.phase = PHASE.DEFENSA;
      break;
    case ACTION.POSITION_CHANGE:
      state.game.court = clone(d.after);
      break;
    case ACTION.SUBSTITUTION:
      state.game.court[String(d.zone)] = d.playerInId;
      break;
    case ACTION.SCORE_CORRECTION:
      state.scoreCorrection = state.scoreCorrection || { team: 0, rival: 0 };
      state.game.score = clone(d.scoreAfter);
      if (d.delta === -1) state.scoreCorrection[d.side]++;
      else if (d.delta === 1) state.scoreCorrection[d.side] = Math.max(0, state.scoreCorrection[d.side] - 1);
      break;
    case ACTION.SET_END:
      state.game.sets.push(clone(d));
      state.flow.awaitingNextSet = true;
      state.flow.rivalCourtAvailable = false;
      state.flow.rivalTransit = false;
      state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
      break;
    case ACTION.SET_START:
      state.game.currentSet = d.set;
      state.game.score = { team: 0, rival: 0 };
      state.game.court = clone(d.court);
      state.game.servingSide = d.servingSide;
      state.game.phase = d.servingSide === 'team' ? PHASE.SERVEI : PHASE.RECEPCIO;
      state.flow.awaitingNextSet = false;
      state.flow.rivalCourtAvailable = false;
      state.flow.rivalTransit = false;
      state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
      break;
    case ACTION.MATCH_END:
      state.lifecycle.status = 'finished';
      state.lifecycle.finishedAt = d.finishedAt || null;
      break;
    default:
      throw new Error('Tipus d’acció no reproduïble: ' + action.type);
  }
  state.lastActionId = action.actionId;
  if (action.occurredAt && state.identity) state.identity.updatedAt = action.occurredAt;
}

function canReplayActionLog(actionLog) {
  const first = actionLog?.actions?.[0];
  return !!(first && first.type === ACTION.MATCH_START && first.data && first.data.genesis);
}

function replayActionLog(actionLog) {
  assert(actionLog && Array.isArray(actionLog.actions) && actionLog.actions.length, 'ActionLog absent');
  const first = actionLog.actions[0];
  assert(first.type === ACTION.MATCH_START, 'ActionLog sense MATCH_START inicial');
  assert(first.data && first.data.genesis, 'ActionLog antic: no conté genesis reproduïble');
  const state = clone(first.data.genesis);
  assert(state.identity?.matchId === actionLog.matchId, 'Genesis i ActionLog no coincideixen');
  state.lastActionId = first.actionId;
  if (first.occurredAt && state.identity) state.identity.updatedAt = first.occurredAt;
  for (const action of actionLog.actions.slice(1)) {
    if (action.active === false) continue;
    applyAction(state, action);
  }
  return state;
}

module.exports = { canReplayActionLog, replayActionLog };
