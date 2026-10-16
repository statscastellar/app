'use strict';

const { PHASE } = require('./constants');
const { assert } = require('./utils');

const RATEABLE_PHASES = Object.freeze([
  PHASE.SERVEI,
  PHASE.RECEPCIO,
  PHASE.DEFENSA,
  PHASE.COLLOCACIO,
  PHASE.ATAC
]);

const PHASE_LABELS = Object.freeze({
  [PHASE.RECEPCIO]: 'RECEPCIÓ',
  [PHASE.COLLOCACIO]: 'COL·LOCACIÓ'
});

function buildCapa7UiState(engine, options = {}) {
  assert(engine && engine.state, 'Motor de partit no disponible');
  const localMode = options.localMode || null;
  const state = engine.state;
  const matchActive = state.lifecycle.status === 'active';
  const phase = state.game.phase;
  const sosStatus = state.flow.sos.status;
  const sosActive = matchActive && sosStatus === 'active';
  const temporaryUiMode = !!localMode;
  const undoStack = Array.isArray(engine.undoStack) ? engine.undoStack : [];

  const ui = {
    version: 1,
    matchActive,
    scoreEnabled: matchActive,
    phase,
    phaseLabel: sosActive ? 'SALVADA' : (PHASE_LABELS[phase] || phase),
    localMode,
    ratingPhaseAllowed: matchActive && RATEABLE_PHASES.includes(phase),
    serverBallVisible: matchActive && !temporaryUiMode && state.game.servingSide === 'team' && phase === PHASE.SERVEI,
    rivalCourtEnabled: matchActive && !temporaryUiMode && !!state.flow.rivalCourtAvailable,
    sosEnabled: matchActive && !temporaryUiMode && (sosStatus === 'available' || sosStatus === 'active'),
    sosActive,
    blocksEnabled: matchActive && !temporaryUiMode,
    undoEnabled: matchActive && undoStack.length > 0,
    undoLabel: matchActive && undoStack.length ? (undoStack[undoStack.length - 1].label || '') : ''
  };

  ui.canRate = (zone, value) => {
    zone = String(zone);
    value = Number(value);
    if (temporaryUiMode) return false;
    if (!ui.ratingPhaseAllowed) return false;
    if (sosActive && value === 0) return false;
    if (phase === PHASE.SERVEI && zone !== '1') return false;
    return Number.isInteger(value) && value >= 0 && value <= 3;
  };

  return ui;
}

module.exports = { RATEABLE_PHASES, PHASE_LABELS, buildCapa7UiState };
