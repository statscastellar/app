'use strict';
const assert=require('assert'); const fs=require('fs'); const path=require('path');
const {createMatchFromDraft}=require('../src/match-factory'); const {MatchEngine}=require('../src/match-engine');
const {MemoryStorageAdapter}=require('../src/storage-memory'); const {Pro2Storage}=require('../src/storage-service');
const {makeIntegrity}=require('../src/session-integrity'); const {buildMatchReport}=require('../src/match-report'); const {makeReportIntegrity}=require('../src/report-integrity');
const {CURRENT,MIGRATION_VERSION,migrateActiveRecord,migrateCompletedRecord,migrateBackup,normalizeStaleConflict}=require('../src/schema-migrations');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
function session(id){const x=createMatchFromDraft(draft,{matchId:id,now:'2026-10-05T15:00:00Z'}); return new MatchEngine(x.state,x.actionLog).exportSession();}
async function t(name,fn){try{await fn();console.log('PASS',name)}catch(e){console.error('FAIL',name,'\n ',e.stack||e);process.exitCode=1}}
(async()=>{
 await t('031 migra registre actiu v1→v2 sense alterar sessió ni integritat',async()=>{
   const se=session('m031-active'); const integrity=makeIntegrity(se.state,se.actionLog); const old={schemaVersion:1,matchId:se.matchId,session:se,integrity,savedAt:'x',storageRevision:1};
   const m=migrateActiveRecord(old); assert.equal(m.schemaVersion,CURRENT.activeMatch); assert.equal(m.schemaMigration.fromSchemaVersion,1); assert.equal(m.schemaMigration.toSchemaVersion,2); assert.deepEqual(m.session,old.session); assert.deepEqual(m.integrity,old.integrity);
 });
 await t('031 migra registre finalitzat v1→v2 preservant informe i segells',async()=>{
   const se=session('m031-done'); const eng=MatchEngine.fromSession(se); eng.finishMatch(); const done=eng.exportSession(); const report=buildMatchReport(done.state,done.actionLog); const integrity=makeIntegrity(done.state,done.actionLog); const reportIntegrity=makeReportIntegrity(report,done.state,done.actionLog);
   const old={schemaVersion:1,matchId:done.matchId,metadata:done.state.metadata,finalState:done.state,actionLog:done.actionLog,report,integrity,reportIntegrity,completedAt:'x'};
   const m=migrateCompletedRecord(old); assert.equal(m.schemaVersion,2); assert.deepEqual(m.integrity,integrity); assert.deepEqual(m.reportIntegrity,reportIntegrity);
 });
 await t('031 rebutja esquemes de registre futurs',async()=>{
   assert.throws(()=>migrateActiveRecord({schemaVersion:99}),/més nou/); assert.throws(()=>migrateCompletedRecord({schemaVersion:99}),/més nou/);
 });
 await t('031 els registres nous ja neixen en esquema actual',async()=>{
   const a=new MemoryStorageAdapter(), s=new Pro2Storage(a); const se=session('m031-native'); const e=MatchEngine.fromSession(se); const active=await s.saveActive(e); assert.equal(active.schemaVersion,2); assert.equal(active.schemaMigration.fromSchemaVersion,null); assert.equal(active.schemaMigration.migrationVersion,MIGRATION_VERSION);
   e.finishMatch(); const done=await s.finalize(e); assert.equal(done.schemaVersion,2); assert.equal(done.schemaMigration.toSchemaVersion,2);
 });
 await t('031 backup v1 migra a v2 i normalitza registres interns',async()=>{
   const se=session('m031-backup'); const oldActive={schemaVersion:1,matchId:se.matchId,session:se,integrity:makeIntegrity(se.state,se.actionLog),savedAt:'x',storageRevision:1};
   const old={schemaVersion:1,app:'Stats Castellar Pro.2',stores:{teams:[],activeMatches:[{id:se.matchId,value:oldActive}],completedMatches:[],settings:[]}};
   const b=migrateBackup(old); assert.equal(b.schemaVersion,2); assert.equal(b.stores.activeMatches[0].value.schemaVersion,2); assert.equal(b.schemaMigration.fromSchemaVersion,1);
 });
 await t('031 conflictes antics obtenen migrationVersion sense canviar el schema segellat',async()=>{
   const c=normalizeStaleConflict({schemaVersion:1,type:'STALE_ACTIVE_UNRELATED',matchId:'c',createdAt:'x',localDelta:[],remoteDelta:[]}); assert.equal(c.schemaVersion,1); assert.equal(c.migrationVersion,MIGRATION_VERSION);
 });
 if(!process.exitCode) console.log('\nRESULTAT FINAL: PASS — MIGRACIONS D’ESQUEMA PRO.2 031');
})();
