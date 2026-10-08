'use strict';

const { assert, clone } = require('./utils');
const { ACTION } = require('./constants');
const { canReplayActionLog, replayActionLog } = require('./action-replay');

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

// FNV-1a 32-bit: no és criptogràfic; serveix per detectar corrupció accidental/incoherència.
function fnv1a32(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function valueDigest(value) { return fnv1a32(stableStringify(value)); }

function sessionDigest(state, actionLog) {
  return valueDigest({ state, actionLog });
}

function validateActionLog(actionLog, state = null) {
  assert(actionLog && typeof actionLog === 'object', 'ActionLog absent');
  assert(actionLog.matchId, 'ActionLog sense matchId');
  assert(Array.isArray(actionLog.actions) && actionLog.actions.length >= 1, 'ActionLog sense accions');
  assert(Number.isInteger(actionLog.nextSequence) && actionLog.nextSequence >= 2, 'nextSequence invàlid');

  let expected = 1;
  let previousOccurredAt = null;
  const ids = new Set();
  for (const a of actionLog.actions) {
    assert(a && typeof a === 'object', 'Acció invàlida');
    assert(a.sequence === expected, `Seqüència ActionLog trencada a ${expected}`);
    assert(a.actionId === `${actionLog.matchId}:${a.sequence}`, `actionId inconsistent a seqüència ${a.sequence}`);
    assert(!ids.has(a.actionId), `actionId duplicat: ${a.actionId}`);
    ids.add(a.actionId);
    assert(Number.isInteger(a.set) && a.set >= 1 && a.set <= 5, `Set invàlid a ${a.actionId}`);
    assert(typeof a.type === 'string' && a.type.length > 0, `Tipus absent a ${a.actionId}`);
    assert(typeof a.active === 'boolean', `Camp active invàlid a ${a.actionId}`);
    if (a.occurredAt != null) {
      assert(typeof a.occurredAt === 'string' && !Number.isNaN(Date.parse(a.occurredAt)), `occurredAt invàlid a ${a.actionId}`);
      if (previousOccurredAt != null) assert(Date.parse(a.occurredAt) >= Date.parse(previousOccurredAt), `Ordre temporal trencat a ${a.actionId}`);
      previousOccurredAt = a.occurredAt;
    } else if (actionLog.schemaVersion >= 3) {
      assert(false, `occurredAt absent a ${a.actionId}`);
    }

    const d = a.data || {};
    if ([ACTION.SERVEI,ACTION.RECEPCIO,ACTION.DEFENSA,ACTION.COLLOCACIO,ACTION.ATAC].includes(a.type)) {
      assert(Number.isInteger(d.value) && d.value >= 0 && d.value <= 3, `Valor 0–3 invàlid a ${a.actionId}`);
      assert(d.playerId, `playerId absent a ${a.actionId}`);
    }
    if (a.type === ACTION.SOS_AVAILABLE || a.type === ACTION.SOS_ACTIVATE) {
      assert(d.origin && [ACTION.RECEPCIO,ACTION.DEFENSA].includes(d.origin.phase), `Origen SOS invàlid a ${a.actionId}`);
      assert(d.provisionalPointActionId, `Punt provisional SOS absent a ${a.actionId}`);
    }
    if (a.type === ACTION.SALVADA) {
      assert([1,2,3].includes(d.value), `Salvada només admet 1/2/3 a ${a.actionId}`);
      assert(d.playerId, `playerId absent a ${a.actionId}`);
    }
    if (a.type === ACTION.BLOQUEIG) assert([0,1,2].includes(d.value), `Bloqueig només admet 0/1/2 a ${a.actionId}`);
    if (a.type === ACTION.POINT) {
      assert(['team','rival'].includes(d.side), `Costat de punt invàlid a ${a.actionId}`);
      assert(d.scoreBefore && d.scoreAfter, `Marcador absent a ${a.actionId}`);
    }
    expected++;
  }

  assert(actionLog.nextSequence === expected, 'nextSequence no coincideix amb l’ActionLog');

  if (state) {
    assert(state.identity && state.identity.matchId === actionLog.matchId, 'MatchState i ActionLog no coincideixen');
    const active = actionLog.actions.filter(a => a.active);
    const expectedLast = active.length ? active[active.length - 1].actionId : null;
    // lastActionId pot apuntar a la darrera acció afegida encara que després quedi revertida per SOS.
    if (state.lastActionId != null) assert(ids.has(state.lastActionId), 'lastActionId no existeix a ActionLog');
    assert(state.game && state.game.currentSet >= 1 && state.game.currentSet <= 5, 'currentSet fora de rang');
    assert(state.game.score && state.game.score.team >= 0 && state.game.score.rival >= 0, 'Marcador invàlid');
    if (state.identity?.updatedAt) assert(!Number.isNaN(Date.parse(state.identity.updatedAt)), 'updatedAt invàlid');
    if (actionLog.schemaVersion >= 3) {
      const last = actionLog.actions[actionLog.actions.length - 1];
      assert(state.identity?.updatedAt === last.occurredAt, 'updatedAt no coincideix amb la darrera acció');
      if (state.lifecycle?.status === 'finished') {
        const end = [...actionLog.actions].reverse().find(a => a.type === ACTION.MATCH_END && a.active !== false);
        assert(end && state.lifecycle.finishedAt === end.data?.finishedAt, 'finishedAt no coincideix amb MATCH_END');
        assert(state.lifecycle.finishedAt === end.occurredAt, 'finishedAt i occurredAt de MATCH_END divergeixen');
      }
    }
    void expectedLast;
  }
  return true;
}


function verifyReplayConsistency(state, actionLog) {
  if (!canReplayActionLog(actionLog)) return { ok: true, legacy: true };
  const rebuilt = replayActionLog(actionLog);
  assert(stableStringify(rebuilt) === stableStringify(state), 'Integritat: MatchState no coincideix amb la reproducció de l’ActionLog');
  return { ok: true, legacy: false };
}

function makeIntegrity(state, actionLog) {
  validateActionLog(actionLog, state);
  verifyReplayConsistency(state, actionLog);
  return {
    version: 2,
    algorithm: 'fnv1a32-stable-json',
    stateDigest: valueDigest(state),
    actionLogDigest: valueDigest(actionLog),
    digest: sessionDigest(state, actionLog)
  };
}

function assessIntegrity(integrity, state, actionLog) {
  validateActionLog(actionLog, null);
  const replayable = canReplayActionLog(actionLog);
  let rebuilt = null;
  if (replayable) rebuilt = replayActionLog(actionLog);

  if (!integrity) return { ok: true, legacy: true, replayable, rebuilt, stateTrusted: false, actionLogTrusted: false };
  assert(integrity.algorithm === 'fnv1a32-stable-json', 'Algoritme d’integritat desconegut');

  if (integrity.version === 1) {
    const digest = sessionDigest(state, actionLog);
    const ok = digest === integrity.digest;
    return {
      ok, legacy: true, replayable, rebuilt,
      stateTrusted: ok, actionLogTrusted: ok,
      replayMatchesState: replayable ? stableStringify(rebuilt) === stableStringify(state) : null,
      digest
    };
  }

  assert(integrity.version === 2, 'Versió d’integritat desconeguda');
  const stateDigest = valueDigest(state);
  const actionLogDigest = valueDigest(actionLog);
  const digest = sessionDigest(state, actionLog);
  const stateTrusted = stateDigest === integrity.stateDigest;
  const actionLogTrusted = actionLogDigest === integrity.actionLogDigest;
  const combinedTrusted = digest === integrity.digest;
  const replayMatchesState = replayable ? stableStringify(rebuilt) === stableStringify(state) : null;
  return {
    ok: stateTrusted && actionLogTrusted && combinedTrusted && (replayMatchesState !== false),
    legacy: false, replayable, rebuilt, stateTrusted, actionLogTrusted, combinedTrusted, replayMatchesState,
    stateDigest, actionLogDigest, digest
  };
}

function verifyIntegrity(integrity, state, actionLog) {
  validateActionLog(actionLog, state);
  const result = assessIntegrity(integrity, state, actionLog);
  if (!integrity) { verifyReplayConsistency(state, actionLog); return result; }
  assert(result.stateTrusted, 'Integritat de MatchState no vàlida');
  assert(result.actionLogTrusted, 'Integritat de l’ActionLog no vàlida');
  if (integrity.version === 2) assert(result.combinedTrusted, 'Integritat conjunta de dades no vàlida');
  if (result.replayable) assert(result.replayMatchesState, 'Integritat: MatchState no coincideix amb la reproducció de l’ActionLog');
  return result;
}

function recoverStateFromActionLog(integrity, state, actionLog) {
  const result = assessIntegrity(integrity, state, actionLog);
  if (!integrity || integrity.version !== 2) return { recovered: false, reason: 'legacy', assessment: result };
  if (!result.actionLogTrusted) return { recovered: false, reason: 'action-log-untrusted', assessment: result };
  if (!result.replayable || !result.rebuilt) return { recovered: false, reason: 'not-replayable', assessment: result };
  if (result.stateTrusted && result.replayMatchesState) return { recovered: false, reason: 'not-needed', assessment: result };
  const rebuilt = clone(result.rebuilt);
  validateActionLog(actionLog, rebuilt);
  return { recovered: true, state: rebuilt, integrity: makeIntegrity(rebuilt, actionLog), assessment: result };
}

module.exports = { stableStringify, fnv1a32, valueDigest, sessionDigest, validateActionLog, verifyReplayConsistency, assessIntegrity, recoverStateFromActionLog, makeIntegrity, verifyIntegrity };
