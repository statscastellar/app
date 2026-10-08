'use strict';

const { clone, assert, unique } = require('./utils');
const { PHASE, ACTION } = require('./constants');

const ZONES = ['1','2','3','4','5','6'];

class MatchEngine {
  constructor(state, actionLog, undoStack = []) {
    this.state = clone(state);
    this.log = clone(actionLog);
    this.undoStack = clone(undoStack);
    this._validate();
  }

  static fromSession(session) {
    assert(session && session.state && session.actionLog, 'Sessió de partit invàlida');
    return new MatchEngine(session.state, session.actionLog, session.undoStack || []);
  }

  exportSession() {
    return {
      schemaVersion: 1,
      matchId: this.state.identity.matchId,
      state: clone(this.state),
      actionLog: clone(this.log),
      undoStack: clone(this.undoStack)
    };
  }

  snapshot() {
    return { state: clone(this.state), actionLog: clone(this.log) };
  }

  _checkpoint(label) {
    this.undoStack.push({ label, ...this.snapshot() });
    if (this.undoStack.length > 100) this.undoStack.shift();
  }

  _nextOccurredAt() {
    const now = Date.now();
    const previous = Date.parse(this.state.identity?.updatedAt || '') || 0;
    return new Date(Math.max(now, previous)).toISOString();
  }

  _append(type, data = {}, meta = {}) {
    const sequence = this.log.nextSequence++;
    const occurredAt = meta.occurredAt || this._nextOccurredAt();
    const action = {
      actionId: `${this.state.identity.matchId}:${sequence}`,
      sequence,
      set: this.state.game.currentSet,
      type,
      active: meta.active !== false,
      provisional: !!meta.provisional,
      revertedBy: null,
      occurredAt,
      data: clone(data)
    };
    this.log.actions.push(action);
    this.state.lastActionId = action.actionId;
    this.state.identity.updatedAt = occurredAt;
    return action;
  }

  _findAction(actionId) {
    return this.log.actions.find(a => a.actionId === actionId) || null;
  }

  _revertAction(actionId, reason) {
    const a = this._findAction(actionId);
    if (a && a.active) {
      a.active = false;
      a.revertedBy = reason;
    }
  }

  _phaseAfterPoint() {
    this.state.flow.rivalTransit = false;
    this.state.flow.rivalCourtAvailable = false;
    this.state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
    this.state.game.phase = this.state.game.servingSide === 'team' ? PHASE.SERVEI : PHASE.RECEPCIO;
  }

  _rotateTeam() {
    const c = this.state.game.court;
    const before = clone(c);
    this.state.game.court = {
      '1': c['2'],
      '2': c['3'],
      '3': c['4'],
      '4': c['5'],
      '5': c['6'],
      '6': c['1']
    };
    this._append(ACTION.ROTATION, { before, after: clone(this.state.game.court) });
  }

  _awardPoint(side, source, { provisional = false, manual = false } = {}) {
    assert(['team','rival'].includes(side), 'Costat de punt invàlid');
    const before = clone(this.state.game.score);
    this.state.game.score[side]++;

    if (side === 'team') {
      if (this.state.game.servingSide === 'rival') {
        this.state.game.servingSide = 'team';
        this._rotateTeam();
      }
    } else if (this.state.game.servingSide === 'team') {
      this.state.game.servingSide = 'rival';
    }

    const point = this._append(ACTION.POINT, {
      side, source, manual, scoreBefore: before, scoreAfter: clone(this.state.game.score)
    }, { provisional });
    this._phaseAfterPoint();
    return point;
  }

  ratePlayer(zone, value) {
    zone = String(zone);
    assert(ZONES.includes(zone), 'Zona invàlida');
    assert(Number.isInteger(value) && value >= 0 && value <= 3, 'Valor invàlid');
    assert(this.state.lifecycle.status === 'active', 'Partit finalitzat');
    assert(!this.state.flow.temporaryMode, 'Hi ha un mode temporal actiu');

    const playerId = this.state.game.court[zone];
    assert(playerId, 'Zona sense jugadora');

    if (this.state.flow.sos.status === 'active') {
      assert([1,2,3].includes(value), 'Salvada només admet 1, 2 o 3');
      this._checkpoint(`SALVADA ${playerId} ${value}`);
      this._append(ACTION.SALVADA, { playerId, zone, value });
      this.state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
      this.state.game.phase = PHASE.COLLOCACIO;
      this.state.flow.rivalTransit = false;
      this.state.flow.rivalCourtAvailable = false;
      this._validate();
      return this.snapshot();
    }

    const phase = this.state.game.phase;
    assert([PHASE.SERVEI,PHASE.RECEPCIO,PHASE.DEFENSA,PHASE.COLLOCACIO,PHASE.ATAC].includes(phase), 'Fase no valorable');
    if (phase === PHASE.SERVEI) assert(zone === '1', 'Durant el servei només es pot valorar zona 1');

    this._checkpoint(`${phase} ${playerId} ${value}`);
    this.state.flow.rivalCourtAvailable = false;
    this.state.flow.rivalTransit = false;
    this._append(phase, { playerId, zone, value });

    if (phase === PHASE.SERVEI) {
      if (value === 0) this._awardPoint('rival', 'SERVEI_0');
      else if (value === 3) this._awardPoint('team', 'SERVEI_3');
      else {
        this.state.game.phase = PHASE.DEFENSA;
        this.state.flow.rivalTransit = true;
      }
    } else if (phase === PHASE.RECEPCIO || phase === PHASE.DEFENSA) {
      if (value === 0) {
        const origin = { phase, playerId, zone };
        const point = this._awardPoint('rival', `${phase}_0`, { provisional: true });
        this.state.flow.sos = { status: 'available', origin, provisionalPointActionId: point.actionId };
        this._append(ACTION.SOS_AVAILABLE, { origin, provisionalPointActionId: point.actionId });
      } else {
        this.state.game.phase = PHASE.COLLOCACIO;
        this.state.flow.rivalCourtAvailable = true;
      }
    } else if (phase === PHASE.COLLOCACIO) {
      if (value === 0) this._awardPoint('rival', 'COLLOCACIO_0');
      else {
        this.state.game.phase = PHASE.ATAC;
        this.state.flow.rivalCourtAvailable = true;
      }
    } else if (phase === PHASE.ATAC) {
      if (value === 0) this._awardPoint('rival', 'ATAC_0');
      else if (value === 3) this._awardPoint('team', 'ATAC_3');
      else {
        this.state.game.phase = PHASE.DEFENSA;
        this.state.flow.rivalTransit = true;
      }
    }

    this._validate();
    return this.snapshot();
  }

  activateSOS() {
    assert(this.state.flow.sos.status === 'available', 'SOS no disponible');
    this._checkpoint('SOS ACTIVAR');
    const sos = clone(this.state.flow.sos);
    const point = this._findAction(sos.provisionalPointActionId);
    assert(point && point.active && point.provisional, 'Punt provisional de SOS no trobat');

    // Restaurar marcador i servei/rotació des del checkpoint anterior al 0 seria massa ampli:
    // el 0 s'ha de conservar. Per això desfem només els efectes del punt provisional.
    this.state.game.score = clone(point.data.scoreBefore);

    // El punt provisional pot haver canviat servei i rotació. Recuperem aquests camps del
    // checkpoint creat just abans de la valoració 0, però conservem l'acció 0 al log.
    const preZero = this.undoStack[this.undoStack.length - 2];
    if (preZero && preZero.state) {
      this.state.game.servingSide = preZero.state.game.servingSide;
      this.state.game.court = clone(preZero.state.game.court);
    }

    this._revertAction(point.actionId, 'SOS');
    // També s'ha pogut registrar una rotació automàtica com a conseqüència del punt provisional.
    for (const a of this.log.actions) {
      if (a.sequence > point.sequence - 2 && a.sequence < point.sequence && a.type === ACTION.ROTATION && a.active) {
        a.active = false;
        a.revertedBy = 'SOS';
      }
    }

    this.state.flow.sos = { status: 'active', origin: sos.origin, provisionalPointActionId: point.actionId };
    this.state.game.phase = sos.origin.phase;
    this.state.flow.rivalTransit = false;
    this.state.flow.rivalCourtAvailable = false;
    this._append(ACTION.SOS_ACTIVATE, { origin: sos.origin, provisionalPointActionId: point.actionId });
    this._validate();
    return this.snapshot();
  }

  rivalCourt() {
    assert(this.state.flow.rivalCourtAvailable, 'Camp rival no disponible');
    assert(!this.state.flow.temporaryMode, 'Mode temporal actiu');
    this._checkpoint('CAMP RIVAL');
    const from = this.state.lastActionId;
    this._append(ACTION.CAMP_RIVAL, { fromActionId: from });
    this.state.flow.rivalCourtAvailable = false;
    this.state.flow.rivalTransit = true;
    this.state.game.phase = PHASE.DEFENSA;
    this._validate();
    return this.snapshot();
  }

  block(zone, value) {
    zone = String(zone);
    assert(['2','3','4'].includes(zone), 'Bloqueig només a zones davanteres 2, 3 i 4');
    assert([0,1,2].includes(value), 'Bloqueig només admet 0, 1 o 2');
    assert(!this.state.flow.temporaryMode, 'Mode temporal actiu');
    const playerId = this.state.game.court[zone];
    this._checkpoint(`BLOQUEIG ${playerId} ${value}`);
    this._append(ACTION.BLOQUEIG, { playerId, zone, value });
    this.state.game.phase = PHASE.BLOQUEIG;
    this.state.flow.rivalTransit = false;
    this.state.flow.rivalCourtAvailable = false;
    if (value === 0) this._awardPoint('rival', 'BLOQUEIG_0');
    else if (value === 2) this._awardPoint('team', 'BLOQUEIG_2');
    else {
      this.state.game.phase = PHASE.DEFENSA;
      this.state.flow.rivalCourtAvailable = true;
    }
    this._validate();
    return this.snapshot();
  }

  changePositions(newCourt) {
    assert(newCourt && ZONES.every(z => newCourt[z]), 'Calen sis zones');
    const ids = ZONES.map(z => newCourt[z]);
    assert(unique(ids), 'Les sis jugadores han de ser diferents');
    for (const id of ids) assert(this.state.roster.calledPlayerIds.includes(id), 'Jugadora no convocada a posicions');
    this._checkpoint('POSICIONS');
    const before = clone(this.state.game.court);
    this.state.game.court = clone(newCourt);
    this._append(ACTION.POSITION_CHANGE, { before, after: clone(newCourt) });
    this._validate();
    return this.snapshot();
  }

  substitute(playerOutId, playerInId) {
    const zone = ZONES.find(z => this.state.game.court[z] === playerOutId);
    assert(zone, 'La jugadora que surt no és a pista');
    assert(this.state.roster.calledPlayerIds.includes(playerInId), 'La jugadora que entra no està convocada');
    assert(!Object.values(this.state.game.court).includes(playerInId), 'La jugadora que entra ja és a pista');
    this._checkpoint(`CANVI ${playerOutId} -> ${playerInId}`);
    this.state.game.court[zone] = playerInId;
    this._append(ACTION.SUBSTITUTION, { playerOutId, playerInId, zone, score: clone(this.state.game.score) });
    this._validate();
    return this.snapshot();
  }

  manualPoint(side) {
    assert(['team','rival'].includes(side), 'Costat invàlid');
    this.state.scoreCorrection = this.state.scoreCorrection || { team:0, rival:0 };
    this._checkpoint(`PUNT MANUAL ${side}`);
    if (this.state.scoreCorrection[side] > 0) {
      const before = clone(this.state.game.score);
      this.state.game.score[side]++;
      this.state.scoreCorrection[side]--;
      this._append(ACTION.SCORE_CORRECTION,{ side, delta:+1, scoreBefore:before, scoreAfter:clone(this.state.game.score) });
    } else {
      this._awardPoint(side, 'MARCADOR', { manual: true });
    }
    this._validate();
    return this.snapshot();
  }

  manualMinus(side) {
    assert(['team','rival'].includes(side), 'Costat invàlid');
    assert(this.state.game.score[side] > 0, 'No es pot baixar de zero');
    const other = side === 'team' ? 'rival' : 'team';
    this.state.scoreCorrection = this.state.scoreCorrection || { team:0, rival:0 };

    // Mateixa filosofia de la Capa 7: si l'últim checkpoint correspon inequívocament
    // a l'últim punt d'aquest costat, restaurem el paquet complet (servei/rotació/fase).
    const last = this.undoStack[this.undoStack.length - 1];
    if (last && last.state &&
        this.state.game.score[side] === last.state.game.score[side] + 1 &&
        this.state.game.score[other] === last.state.game.score[other]) {
      this.undoStack.pop();
      this.state = clone(last.state);
      this.log = clone(last.actionLog);
      this._validate();
      return this.snapshot();
    }

    this._checkpoint(`CORRECCIÓ - ${side}`);
    const before = clone(this.state.game.score);
    this.state.game.score[side]--;
    this.state.scoreCorrection[side]++;
    this._append(ACTION.SCORE_CORRECTION,{ side, delta:-1, scoreBefore:before, scoreAfter:clone(this.state.game.score) });
    this._validate();
    return this.snapshot();
  }


  getSetWins() {
    const wins = { team: 0, rival: 0 };
    for (const set of this.state.game.sets || []) {
      if (set && (set.winner === 'team' || set.winner === 'rival')) wins[set.winner]++;
    }
    return wins;
  }

  isMatchDecided() {
    const wins = this.getSetWins();
    return wins.team >= 3 || wins.rival >= 3 || this.state.game.currentSet >= 5;
  }

  canStartNextSet() {
    return this.state.lifecycle.status === 'active' &&
      !!this.state.flow.awaitingNextSet &&
      !this.isMatchDecided() &&
      this.state.game.currentSet < 5;
  }

  finishSet() {
    assert(this.state.lifecycle.status === 'active', 'Partit finalitzat');
    assert(!this.state.flow.awaitingNextSet, 'El set ja està tancat');
    this._checkpoint(`FINAL SET ${this.state.game.currentSet}`);
    const result = {
      set: this.state.game.currentSet,
      team: this.state.game.score.team,
      rival: this.state.game.score.rival,
      winner: this.state.game.score.team > this.state.game.score.rival ? 'team' : (this.state.game.score.rival > this.state.game.score.team ? 'rival' : 'tie')
    };
    this.state.game.sets.push(result);
    this._append(ACTION.SET_END, clone(result));
    this.state.flow.awaitingNextSet = true;
    this.state.flow.rivalCourtAvailable = false;
    this.state.flow.rivalTransit = false;
    this.state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
    this._validate();
    return this.snapshot();
  }

  startNextSet({ court, servingSide }) {
    assert(this.state.lifecycle.status === 'active', 'Partit finalitzat');
    assert(this.state.flow.awaitingNextSet, 'No hi ha cap set pendent d\'iniciar');
    assert(!this.isMatchDecided(), 'El partit ja està decidit');
    assert(this.state.game.currentSet < 5, 'No es poden iniciar més de 5 sets');
    assert(court && ZONES.every(z => court[z]), 'Calen sis zones per iniciar el set');
    const ids = ZONES.map(z => court[z]);
    assert(unique(ids), 'Les sis jugadores del set han de ser diferents');
    for (const id of ids) assert(this.state.roster.calledPlayerIds.includes(id), 'Jugadora no convocada al nou set');
    assert(['team','rival'].includes(servingSide), 'Servei inicial del set invàlid');

    this._checkpoint(`INICI SET ${this.state.game.currentSet + 1}`);
    this.state.game.currentSet++;
    this.state.game.score = { team: 0, rival: 0 };
    this.state.game.court = clone(court);
    this.state.game.servingSide = servingSide;
    this.state.game.phase = servingSide === 'team' ? PHASE.SERVEI : PHASE.RECEPCIO;
    this.state.flow.awaitingNextSet = false;
    this.state.flow.rivalCourtAvailable = false;
    this.state.flow.rivalTransit = false;
    this.state.flow.sos = { status: 'unavailable', origin: null, provisionalPointActionId: null };
    this._append(ACTION.SET_START, { set: this.state.game.currentSet, court: clone(court), servingSide });
    this._validate();
    return this.snapshot();
  }

  finishMatch() {
    assert(this.state.lifecycle.status === 'active', 'Partit ja finalitzat');
    this._checkpoint('FINAL PARTIT');
    this.state.lifecycle.status = 'finished';
    const finishedAt = this._nextOccurredAt();
    this.state.lifecycle.finishedAt = finishedAt;
    this._append(ACTION.MATCH_END, {
      sets: clone(this.state.game.sets),
      currentSet: this.state.game.currentSet,
      score: clone(this.state.game.score),
      finishedAt
    }, { occurredAt: finishedAt });
    this._validate();
    return this.snapshot();
  }

  undo() {
    assert(this.undoStack.length, 'No hi ha res per desfer');
    const previous = this.undoStack.pop();
    this.state = clone(previous.state);
    this.log = clone(previous.actionLog);
    this._validate();
    return this.snapshot();
  }

  getActiveActions() {
    return this.log.actions.filter(a => a.active);
  }

  getStatActions() {
    return this.getActiveActions().filter(a => [ACTION.SERVEI,ACTION.RECEPCIO,ACTION.DEFENSA,ACTION.COLLOCACIO,ACTION.ATAC,ACTION.BLOQUEIG,ACTION.SALVADA].includes(a.type));
  }

  _validate() {
    const s = this.state;
    assert(s && s.identity && s.identity.matchId, 'MatchState sense matchId');
    assert(this.log && this.log.matchId === s.identity.matchId, 'ActionLog i MatchState no coincideixen');
    assert(s.lifecycle.status === 'active' || s.lifecycle.status === 'finished', 'Estat de cicle invàlid');
    assert(s.game.score.team >= 0 && s.game.score.rival >= 0, 'Marcador negatiu');
    const ids = ZONES.map(z => s.game.court[z]);
    assert(ids.every(Boolean) && unique(ids), 'Pista invàlida');
    for (const id of ids) assert(s.roster.calledPlayerIds.includes(id), 'Jugadora a pista no convocada');
    if (s.flow.sos.status === 'active') assert([PHASE.RECEPCIO,PHASE.DEFENSA].includes(s.game.phase), 'SOS actiu fora de R/D');
  }
}

module.exports = { MatchEngine };
