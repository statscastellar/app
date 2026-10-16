'use strict';

const { clone, assert } = require('./utils');
const { ACTION } = require('./constants');
const { buildMatchReport, reportFromCompletedRecord } = require('./match-report');
const { makeIntegrity, valueDigest } = require('./session-integrity');
const { makeReportIntegrity } = require('./report-integrity');
const { isLegacyImportRecord, normalizeLegacyMatchDocument } = require('./legacy-import');

function resultSets(report) {
  const declared = String(report.metadata?.legacyResult || '').match(/^\s*(\d+)\s*[-–]\s*(\d+)\s*$/);
  const count = Math.max(1, Number(report.result.currentSet) || 1,
    ...(report.result.sets || []).map(s => Number(s.set) || 1),
    declared ? Number(declared[1]) + Number(declared[2]) : 0);
  assert(Number.isSafeInteger(count) && count <= 5, 'Nombre de sets invàlid');
  return Array.from({ length: count }, (_, i) => {
    const set = i + 1, row = (report.result.sets || []).find(s => Number(s.set) === set);
    const score = row?.score || row || (set === count ? report.result.currentScore : null);
    return { set, team: score?.team ?? 0, rival: score?.rival ?? 0 };
  });
}

function replaceFinalResult(record, values) {
  const before = reportFromCompletedRecord(record);
  assert(before && (isLegacyImportRecord(record) || record.finalState?.lifecycle.status === 'finished'), 'Cal un partit finalitzat');
  const expected = resultSets(before);
  assert(Array.isArray(values) && values.length === expected.length && values.length <= 5, 'Cal indicar tots els sets del partit');
  const sets = values.map((s, i) => {
    assert(s && s.set === i + 1 && Number.isSafeInteger(s.team) && s.team >= 0 && Number.isSafeInteger(s.rival) && s.rival >= 0, 'Marcador de set invàlid');
    return { set: s.set, team: s.team, rival: s.rival, score: { team: s.team, rival: s.rival },
      winner: s.team > s.rival ? 'team' : s.team < s.rival ? 'rival' : 'tie' };
  });
  const next = clone(record), last = sets[sets.length - 1];
  if (isLegacyImportRecord(next)) {
    const match = next.legacySource.match;
    for (const set of match.completedSets || []) {
      const score = sets.find(s => s.set === Number(set.set));
      assert(score, 'Set desconegut');
      set.score = clone(score.score);
      set.scores = { ...set.scores, castellar: score.team, rival: score.rival };
    }
    match.scores = { ...match.scores, castellar: last.team, rival: last.rival };
    match.result = { sets: clone(sets), currentSet: sets.length, currentScore: clone(last.score) };
    match.legacyResult = `${sets.filter(s => s.winner === 'team').length}-${sets.filter(s => s.winner === 'rival').length}`;
    next.report = normalizeLegacyMatchDocument(next.legacySource).report;
    next.metadata = clone(next.report.metadata);
    next.legacyIntegrity.sourceDigest = valueDigest(next.legacySource);
    next.legacyIntegrity.reportDigest = valueDigest(next.report);
  } else {
    next.finalState.game.sets = clone(sets);
    next.finalState.game.score = clone(last.score);
    for (const action of next.actionLog.actions) {
      if (action.active === false) continue;
      if (action.type === ACTION.SET_END) action.data = clone(sets.find(s => s.set === action.set));
      if (action.type === ACTION.MATCH_END) {
        action.data.sets = clone(sets);
        action.data.score = clone(last.score);
      }
    }
    next.integrity = makeIntegrity(next.finalState, next.actionLog);
    next.report = buildMatchReport(next.finalState, next.actionLog);
    next.reportIntegrity = makeReportIntegrity(next.report, next.finalState, next.actionLog);
  }
  assert(JSON.stringify(reportFromCompletedRecord(next).stats) === JSON.stringify(before.stats), 'La correcció no pot modificar les estadístiques');
  return next;
}

module.exports = { resultSets, replaceFinalResult };
