'use strict';
const assert=require('assert');
const fs=require('fs'); const path=require('path');
const { MemoryStorageAdapter }=require('../src/storage-memory');
const { Pro2Storage }=require('../src/storage-service');
const { Pro2BackupService }=require('../src/backup-service');
const { createMatchFromDraft }=require('../src/match-factory');
const { MatchEngine }=require('../src/match-engine');
const { migrateBackup }=require('../src/schema-migrations');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
function engine(id){const {state,actionLog}=createMatchFromDraft(draft,{matchId:id,now:'2026-10-05T12:00:00Z'});return new MatchEngine(state,actionLog);}
async function t(name,fn){try{await fn();console.log('PASS',name)}catch(e){console.error('FAIL',name,'\n ',e.stack||e);process.exitCode=1}}
(async()=>{
 await t('exporta els quatre magatzems preservant les claus',async()=>{
   const a=new MemoryStorageAdapter(); const s=new Pro2Storage(a); const b=new Pro2BackupService(a);
   await a.put('teams','team-a',{schemaVersion:1,teamId:'team-a',name:'Equip A',players:[]});
   await a.put('settings','app-settings-v1',{simulate:true});
   const e=engine('active-a'); await s.saveActive(e);
   const backup=await b.exportAll('2026-10-05T12:30:00Z');
   assert.equal(backup.schemaVersion,2); assert.equal(backup.schemaMigration.migrationVersion,1); assert.equal(backup.stores.teams[0].id,'team-a');
   assert.equal(backup.stores.settings[0].id,'app-settings-v1'); assert.equal(backup.stores.activeMatches[0].id,'active-a');
 });
 await t('importació segura crea només registres absents',async()=>{
   const src=new MemoryStorageAdapter(); const sb=new Pro2BackupService(src);
   await src.put('teams','team-a',{schemaVersion:1,teamId:'team-a',name:'Equip A',players:[]});
   const backup=await sb.exportAll();
   const dst=new MemoryStorageAdapter(); const db=new Pro2BackupService(dst); const r=await db.importBackup(backup);
   assert.equal(r.inserted,1); assert.equal((await dst.list('teams')).length,1);
 });
 await t('reimportar exactament el mateix backup no duplica',async()=>{
   const a=new MemoryStorageAdapter(); const b=new Pro2BackupService(a);
   await a.put('teams','team-a',{schemaVersion:1,teamId:'team-a',name:'Equip A',players:[]}); const backup=await b.exportAll();
   const r=await b.importBackup(backup); assert.equal(r.inserted,0); assert(r.skipped>=1); assert.equal((await a.list('teams')).length,1);
 });
 await t('conflicte de mateix id amb contingut diferent cancel·la tota la importació',async()=>{
   const a=new MemoryStorageAdapter(); const b=new Pro2BackupService(a);
   await a.put('teams','existing',{schemaVersion:1,teamId:'existing',name:'Original',players:[]});
   const backup={schemaVersion:1,app:'Stats Castellar Pro.2',exportedAt:'x',stores:{teams:[{id:'new',value:{schemaVersion:1,teamId:'new',name:'Nou',players:[]}},{id:'existing',value:{schemaVersion:1,teamId:'existing',name:'Canviat',players:[]}}],activeMatches:[],completedMatches:[],settings:[]}};
   await assert.rejects(()=>b.importBackup(backup),/Conflicte/);
   assert.equal(await a.get('teams','new'),null); assert.equal((await a.get('teams','existing')).name,'Original');
 });
 await t('backup corrupte o d’una altra app és rebutjat',async()=>{
   const bad={schemaVersion:1,app:'Una altra app',stores:{teams:[],activeMatches:[],completedMatches:[],settings:[]}};
   assert.throws(()=>migrateBackup(bad),/aplicació desconeguda/);
 });
 await t('esquema futur és rebutjat en lloc d’interpretar-lo silenciosament',async()=>{
   const bad={schemaVersion:99,app:'Stats Castellar Pro.2',stores:{teams:[],activeMatches:[],completedMatches:[],settings:[]}};
   assert.throws(()=>migrateBackup(bad),/més nou/);
 });
 if(!process.exitCode) console.log('\nRESULTAT FINAL: PASS — BACKUP I MIGRACIONS PRO.2');
})();
