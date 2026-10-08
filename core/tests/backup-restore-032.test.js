'use strict';
const assert=require('assert');
const fs=require('fs'); const path=require('path');
const {MemoryStorageAdapter}=require('../src/storage-memory');
const {Pro2Storage}=require('../src/storage-service');
const {Pro2BackupService,verifyBackupIntegrity}=require('../src/backup-service');
const {createMatchFromDraft}=require('../src/match-factory');
const {MatchEngine}=require('../src/match-engine');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
function fresh(id){const {state,actionLog}=createMatchFromDraft(draft,{matchId:id,now:'2026-10-05T15:00:00Z'});return new MatchEngine(state,actionLog)}
async function test(name,fn){try{await fn();console.log('PASS',name)}catch(e){console.error('FAIL',name,'\n ',e.stack||e);process.exitCode=1}}
(async()=>{
 await test('032 exporta backup amb empremta global verificable',async()=>{
   const a=new MemoryStorageAdapter(), b=new Pro2BackupService(a); await a.put('teams','t',{schemaVersion:1,teamId:'t',name:'T',players:[]});
   const backup=await b.exportAll('2026-10-05T15:01:00Z'); assert.equal(backup.backupIntegrity.version,1); assert(backup.backupIntegrity.digest); assert.equal(verifyBackupIntegrity(backup).ok,true);
 });
 await test('032 detecta qualsevol manipulació del backup abans de restaurar',async()=>{
   const a=new MemoryStorageAdapter(), b=new Pro2BackupService(a); await a.put('teams','t',{schemaVersion:1,teamId:'t',name:'T',players:[]}); const backup=await b.exportAll();
   backup.stores.teams[0].value.name='Manipulat'; await assert.rejects(()=>b.restoreBackup(backup),/Integritat global/);
 });
 await test('032 restore-all substitueix atòmicament els quatre magatzems',async()=>{
   const src=new MemoryStorageAdapter(), ss=new Pro2Storage(src), sb=new Pro2BackupService(src);
   await src.put('teams','src-team',{schemaVersion:1,teamId:'src-team',name:'Origen',players:[]}); await src.put('settings','src-setting',{ok:true});
   const active=fresh('src-active'); await ss.saveActive(active);
   const done=fresh('src-done'); done.finishMatch(); await ss.finalize(done);
   const backup=await sb.exportAll();
   const dst=new MemoryStorageAdapter(), db=new Pro2BackupService(dst);
   await dst.put('teams','old-team',{schemaVersion:1,teamId:'old-team',name:'Antic',players:[]}); await dst.put('settings','old-setting',{old:true});
   const r=await db.restoreBackup(backup); assert.equal(r.status,'restored'); assert.equal(await dst.get('teams','old-team'),null); assert.equal(await dst.get('settings','old-setting'),null);
   assert((await dst.get('teams','src-team')).name==='Origen'); assert(await dst.get('activeMatches','src-active')); assert(await dst.get('completedMatches','src-done')); assert(await dst.get('settings','src-setting'));
 });
 await test('032 una restauració invàlida no modifica el destí',async()=>{
   const src=new MemoryStorageAdapter(), sb=new Pro2BackupService(src); await src.put('teams','new',{schemaVersion:1,teamId:'new',name:'Nou',players:[]}); const backup=await sb.exportAll();
   backup.stores.teams.push({id:'broken',value:{schemaVersion:1,teamId:'broken',name:'',players:[]}});
   // resegellat per simular backup estructuralment corrupte però amb digest global coherent
   const {makeBackupIntegrity}=require('../src/backup-service'); backup.backupIntegrity=makeBackupIntegrity(backup);
   const dst=new MemoryStorageAdapter(); await dst.put('teams','keep',{schemaVersion:1,teamId:'keep',name:'Conserva',players:[]}); const db=new Pro2BackupService(dst);
   await assert.rejects(()=>db.restoreBackup(backup),/nom obligatori/); assert((await dst.get('teams','keep')).name==='Conserva'); assert.equal(await dst.get('teams','new'),null);
 });
 await test('032 restore rebutja backup legacy per defecte però permet opt-in explícit',async()=>{
   const src=new MemoryStorageAdapter(), sb=new Pro2BackupService(src); await src.put('teams','t',{schemaVersion:1,teamId:'t',name:'T',players:[]}); const backup=await sb.exportAll(); delete backup.backupIntegrity;
   const dst=new MemoryStorageAdapter(), db=new Pro2BackupService(dst); await assert.rejects(()=>db.restoreBackup(backup),/sense empremta/); const r=await db.restoreBackup(backup,{allowLegacy:true}); assert.equal(r.legacy,true); assert(await dst.get('teams','t'));
 });
 await test('032 valida integritat interna de partits abans de restaurar encara que el backup es resegelli',async()=>{
   const src=new MemoryStorageAdapter(), st=new Pro2Storage(src), sb=new Pro2BackupService(src); const e=fresh('tampered-active'); await st.saveActive(e); const backup=await sb.exportAll();
   backup.stores.activeMatches[0].value.session.state.game.score.team=99; const {makeBackupIntegrity}=require('../src/backup-service'); backup.backupIntegrity=makeBackupIntegrity(backup);
   const dst=new MemoryStorageAdapter(), db=new Pro2BackupService(dst); await assert.rejects(()=>db.restoreBackup(backup),/Integritat|replay|no vàlida/); assert.equal((await dst.list('activeMatches')).length,0);
 });
 if(!process.exitCode) console.log('\nRESULTAT FINAL: PASS — BACKUP/RESTORE PRO.2 032');
})();
