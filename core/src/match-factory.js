'use strict';

const { clone, assert, unique } = require('./utils');
const { PHASE, ACTION } = require('./constants');

function validateDraft(draft) {
  assert(draft && typeof draft === 'object', 'DraftMatch absent');
  assert(draft.match && String(draft.match.opponent || '').trim(), 'Rival obligatori');
  assert(draft.team && draft.team.teamId, 'teamId obligatori');
  assert(Array.isArray(draft.rosterSnapshot), 'rosterSnapshot obligatori');
  assert(Array.isArray(draft.calledPlayerIds) && draft.calledPlayerIds.length >= 6, 'Calen com a mínim 6 convocades');
  assert(Array.isArray(draft.startingSixIds) && draft.startingSixIds.length === 6, 'Calen exactament 6 titulars');
  assert(unique(draft.startingSixIds), 'Les 6 titulars han de ser diferents');
  for (const id of draft.startingSixIds) assert(draft.calledPlayerIds.includes(id), 'Titular no convocada: ' + id);

  const zones = ['1','2','3','4','5','6'];
  assert(draft.positions && zones.every(z => draft.positions[z]), 'Calen les 6 posicions');
  const ids = zones.map(z => draft.positions[z]);
  assert(unique(ids), 'Les 6 posicions han de contenir jugadores diferents');
  for (const id of ids) assert(draft.startingSixIds.includes(id), 'Posició amb jugadora fora del sis inicial: ' + id);

  assert(draft.initialServe && ['team','rival'].includes(draft.initialServe.side), 'Servei inicial invàlid');
  if (draft.initialServe.side === 'team') {
    assert(draft.initialServe.serverPlayerId === draft.positions['1'], 'La servidora inicial ha de ser la jugadora de zona 1');
  } else {
    assert(draft.initialServe.serverPlayerId == null, 'Si serveix el rival no hi ha servidora pròpia');
  }
}

function createMatchFromDraft(draft, options = {}) {
  validateDraft(draft);
  const now = options.now || new Date().toISOString();
  const matchId = options.matchId || `match-${Date.now()}`;

  const state = {
    schemaVersion: 1,
    identity: { matchId, createdAt: now, updatedAt: now },
    metadata: {
      teamId: draft.team.teamId,
      teamName: draft.team.name,
      opponent: draft.match.opponent,
      date: draft.match.date,
      venue: draft.match.venue
    },
    roster: {
      snapshot: clone(draft.rosterSnapshot),
      calledPlayerIds: clone(draft.calledPlayerIds)
    },
    game: {
      currentSet: 1,
      score: { team: 0, rival: 0 },
      sets: [],
      servingSide: draft.initialServe.side,
      phase: draft.initialServe.side === 'team' ? PHASE.SERVEI : PHASE.RECEPCIO,
      court: clone(draft.positions)
    },
    flow: {
      rivalCourtAvailable: false,
      rivalTransit: false,
      sos: { status: 'unavailable', origin: null, provisionalPointActionId: null },
      temporaryMode: null,
      awaitingNextSet: false
    },
    scoreCorrection: { team: 0, rival: 0 },
    lifecycle: { status: 'active', finishedAt: null },
    lastActionId: null
  };

  const actionLog = {
    schemaVersion: 3,
    matchId,
    nextSequence: 2,
    actions: [{
      actionId: `${matchId}:1`, sequence: 1, set: 1, type: ACTION.MATCH_START,
      active: true, provisional: false, revertedBy: null, occurredAt: now, data: { servingSide: state.game.servingSide, court: clone(state.game.court), genesis: clone(state) }
    }]
  };
  state.lastActionId = actionLog.actions[0].actionId;

  return { state, actionLog };
}

module.exports = { validateDraft, createMatchFromDraft };
