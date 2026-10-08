'use strict';
const { assert, clone } = require('./utils');
const { buildMatchReport } = require('./match-report');
const { applyPostMatchEditsToReport, verifyPostMatchEdits } = require('./post-match-edits');
const { verifyIntegrity, sessionDigest, valueDigest } = require('./session-integrity');
const { verifyReportIntegrity } = require('./report-integrity');
const { assertReportConsistency } = require('./report-consistency');
const { isLegacyImportRecord, verifyLegacyImportRecord } = require('./legacy-import');

function prepareVerifiedExport(record){
  assert(record && record.matchId,'Registre finalitzat absent o invàlid');
  if(isLegacyImportRecord(record)){
    const v=verifyLegacyImportRecord(record);
    verifyPostMatchEdits(record.postMatchEdits||null,v.report);
    const edited=applyPostMatchEditsToReport(v.report,record.postMatchEdits||null);
    return {report:clone(edited),audit:{verified:true,sourceKind:'legacy-import',matchId:record.matchId,sourceDigest:v.sourceDigest,reportDigest:valueDigest(edited),postMatchEditDigest:record.postMatchEdits?.digest||null,postMatchEditCount:record.postMatchEdits?.edits?.length||0,completedAt:record.completedAt||null,preparedAt:new Date().toISOString()}};
  }
  assert(record.finalState && record.actionLog,'Font del partit absent');
  verifyIntegrity(record.integrity,record.finalState,record.actionLog);
  const expectedBase=buildMatchReport(record.finalState,record.actionLog);
  verifyReportIntegrity(record.reportIntegrity,record.report,record.finalState,record.actionLog,expectedBase);
  verifyPostMatchEdits(record.postMatchEdits||null,expectedBase);
  const expected=applyPostMatchEditsToReport(expectedBase,record.postMatchEdits||null);
  assertReportConsistency(expected);
  return {
    report: clone(expected),
    audit:{
      verified:true,
      matchId:record.matchId,
      sessionDigest:sessionDigest(record.finalState,record.actionLog),
      reportDigest:valueDigest(expected),
      postMatchEditDigest:record.postMatchEdits?.digest||null,
      postMatchEditCount:record.postMatchEdits?.edits?.length||0,
      completedAt:record.completedAt||null,
      preparedAt:new Date().toISOString()
    }
  };
}
module.exports={prepareVerifiedExport};
