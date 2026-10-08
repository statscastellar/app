'use strict';

const { assert, clone } = require('./utils');
const { valueDigest, sessionDigest, stableStringify } = require('./session-integrity');

const REPORT_INTEGRITY_VERSION = 1;
const REPORT_INTEGRITY_ALGORITHM = 'fnv1a32-stable-json';

function makeReportIntegrity(report, state, actionLog) {
  assert(report && typeof report === 'object', 'MatchReport absent');
  assert(state && actionLog, 'Font del MatchReport absent');
  return {
    version: REPORT_INTEGRITY_VERSION,
    algorithm: REPORT_INTEGRITY_ALGORITHM,
    reportDigest: valueDigest(report),
    sourceSessionDigest: sessionDigest(state, actionLog)
  };
}

function assessReportIntegrity(integrity, report, state, actionLog, expectedReport = null) {
  const sourceSessionDigest = sessionDigest(state, actionLog);
  const reportDigest = report && typeof report === 'object' ? valueDigest(report) : null;
  const expectedReportDigest = expectedReport && typeof expectedReport === 'object' ? valueDigest(expectedReport) : null;
  const derivationMatches = expectedReportDigest == null ? null : reportDigest === expectedReportDigest && stableStringify(report) === stableStringify(expectedReport);

  if (!integrity) {
    return {
      ok: false,
      legacy: true,
      reportTrusted: false,
      sourceTrusted: false,
      derivationMatches,
      reportDigest,
      expectedReportDigest,
      sourceSessionDigest
    };
  }

  assert(integrity.version === REPORT_INTEGRITY_VERSION, 'Versió d’integritat del MatchReport desconeguda');
  assert(integrity.algorithm === REPORT_INTEGRITY_ALGORITHM, 'Algoritme d’integritat del MatchReport desconegut');
  const reportTrusted = reportDigest === integrity.reportDigest;
  const sourceTrusted = sourceSessionDigest === integrity.sourceSessionDigest;
  return {
    ok: reportTrusted && sourceTrusted && derivationMatches !== false,
    legacy: false,
    reportTrusted,
    sourceTrusted,
    derivationMatches,
    reportDigest,
    expectedReportDigest,
    sourceSessionDigest
  };
}

function verifyReportIntegrity(integrity, report, state, actionLog, expectedReport = null) {
  const r = assessReportIntegrity(integrity, report, state, actionLog, expectedReport);
  assert(integrity, 'Integritat del MatchReport absent');
  assert(r.reportTrusted, 'Integritat del MatchReport no vàlida');
  assert(r.sourceTrusted, 'MatchReport vinculat a una sessió diferent');
  if (expectedReport) assert(r.derivationMatches, 'MatchReport no coincideix amb les dades derivades del partit');
  return r;
}

function repairReport(integrity, report, state, actionLog, expectedReport) {
  assert(expectedReport && typeof expectedReport === 'object', 'Cal MatchReport derivat per reparar');
  const assessment = assessReportIntegrity(integrity, report, state, actionLog, expectedReport);
  if (assessment.ok) return { repaired: false, reason: 'not-needed', assessment };
  return {
    repaired: true,
    report: clone(expectedReport),
    integrity: makeReportIntegrity(expectedReport, state, actionLog),
    assessment
  };
}

module.exports = { REPORT_INTEGRITY_VERSION, REPORT_INTEGRITY_ALGORITHM, makeReportIntegrity, assessReportIntegrity, verifyReportIntegrity, repairReport };
