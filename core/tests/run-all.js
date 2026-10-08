'use strict';
const {spawnSync}=require('child_process'); const path=require('path');
for(const file of ['core.test.js','stats.test.js','golden-stats.test.js','storage.test.js','report-export.test.js','export-verified-021.test.js','report-regeneration.test.js','report-consistency.test.js','participation.test.js','cumulative.test.js','cumulative-teams.test.js','cumulative-verified-020.test.js','full-match.test.js','backup.test.js','integrity.test.js','report-integrity-019.test.js','replay.test.js','temporal-concurrency-026.test.js','stale-recovery-027.test.js','conflict-resolution-028.test.js','conflict-lifecycle-029.test.js','conflict-audit-chain-030.test.js','schema-migrations-031.test.js','backup-restore-032.test.js','maintenance-journal-033.test.js','maintenance-journal-034.test.js','maintenance-diagnostics-035.test.js','system-health-036.test.js','capa7-ui-state-041.test.js','simulator-delete-043.test.js','anna-analytics-044.test.js','report-analytics-export-044.test.js','legacy-import-046.test.js','post-match-edits-047.test.js','report-polish-048.test.js','efficiency-gradient-052.test.js','report-preservation-053.test.js','history-analysis-054.test.js']){
 const r=spawnSync(process.execPath,[path.join(__dirname,file)],{stdio:'inherit'});
 if(r.status!==0) process.exit(r.status||1);
}
console.log('\nRESULTAT GLOBAL: PASS — PRO2 INTEGRACIÓ 054');
