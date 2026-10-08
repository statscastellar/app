'use strict';
const assert=require('assert').strict;
const {MemoryStorageAdapter}=require('../src/storage-memory');
const {Pro2BackupService}=require('../src/backup-service');
const {makeMaintenanceJournal,verifyMaintenanceJournal,transitionMaintenanceJournal,MAINTENANCE_JOURNAL_KEY}=require('../src/maintenance-journal');

let pass=0;
async function t(name,fn){await fn();pass++;console.log('PASS',name);}
async function stores(adapter){const out={};for(const n of ['teams','activeMatches','completedMatches','settings'])out[n]=await adapter.listEntries(n);return out;}

(async()=>{
 await t('034 journal nou té operationId únic i fase prepared',async()=>{
   const a=new MemoryStorageAdapter(), source=await stores(a), target={teams:[],activeMatches:[],completedMatches:[],settings:[]};
   const j=makeMaintenanceJournal({sourceStores:source,targetStores:target,now:'2026-10-05T17:00:00Z'});
   assert.equal(j.phase,'prepared'); assert(j.operationId); assert.equal(verifyMaintenanceJournal(j).legacy,false);
 });
 await t('034 reescriure exactament la mateixa operació és idempotent',async()=>{
   const a=new MemoryStorageAdapter(), source=await stores(a), target={teams:[],activeMatches:[],completedMatches:[],settings:[]};
   const j=makeMaintenanceJournal({sourceStores:source,targetStores:target,now:'2026-10-05T17:01:00Z'});
   const x=await a.writeMaintenanceJournal(j), y=await a.writeMaintenanceJournal(j); assert.equal(x.integrity.digest,y.integrity.digest);
 });
 await t('034 una segona operació no pot trepitjar un manteniment actiu',async()=>{
   const a=new MemoryStorageAdapter(), source=await stores(a), target={teams:[],activeMatches:[],completedMatches:[],settings:[]};
   const a1=makeMaintenanceJournal({sourceStores:source,targetStores:target,now:'2026-10-05T17:02:00Z'});
   const a2=makeMaintenanceJournal({sourceStores:source,targetStores:target,now:'2026-10-05T17:02:01Z'});
   await a.writeMaintenanceJournal(a1); await assert.rejects(()=>a.writeMaintenanceJournal(a2),e=>e.code==='MAINTENANCE_BUSY' && e.activeOperationId===a1.operationId);
 });
 await t('034 transicions prepared committed cleared queden resegellades',async()=>{
   const a=new MemoryStorageAdapter(), source=await stores(a), target={teams:[],activeMatches:[],completedMatches:[],settings:[]};
   const j=makeMaintenanceJournal({sourceStores:source,targetStores:target,now:'2026-10-05T17:03:00Z'});
   const c=transitionMaintenanceJournal(j,'committed','2026-10-05T17:03:01Z');
   const z=transitionMaintenanceJournal(c,'cleared','2026-10-05T17:03:02Z');
   assert.equal(verifyMaintenanceJournal(c).phase,'committed'); assert.equal(verifyMaintenanceJournal(z).phase,'cleared'); assert.notEqual(j.integrity.digest,c.integrity.digest); assert.notEqual(c.integrity.digest,z.integrity.digest);
 });
 await t('034 una operació no pot retrocedir de committed a prepared',async()=>{
   const a=new MemoryStorageAdapter(), source=await stores(a), target={teams:[],activeMatches:[],completedMatches:[],settings:[]};
   const j=makeMaintenanceJournal({sourceStores:source,targetStores:target,now:'2026-10-05T17:03:30Z'}); const c=transitionMaintenanceJournal(j,'committed','2026-10-05T17:03:31Z');
   await a.writeMaintenanceJournal(c); await assert.rejects(()=>a.writeMaintenanceJournal(j),e=>e.code==='MAINTENANCE_PHASE_REGRESSION');
 });
 await t('034 recuperació de commit residual tanca el journal com a cleared',async()=>{
   const a=new MemoryStorageAdapter(); await a.put('teams','a',{schemaVersion:1,teamId:'a',name:'A',players:[]});
   const source=await stores(a), target={teams:[{id:'b',value:{schemaVersion:1,teamId:'b',name:'B',players:[]}}],activeMatches:[],completedMatches:[],settings:[]};
   const j=makeMaintenanceJournal({sourceStores:source,targetStores:target,now:'2026-10-05T17:04:00Z'}); await a.writeMaintenanceJournal(j); await a.atomicReplaceBackup(target);
   const r=await new Pro2BackupService(a).recoverInterruptedMaintenance({now:'2026-10-05T17:04:01Z'}); assert.equal(r.status,'committed'); assert.equal(await a.readMaintenanceJournal(),null);
   const tomb=await a.readMaintenanceJournal(MAINTENANCE_JOURNAL_KEY,{includeCleared:true}); assert.equal(tomb.phase,'cleared'); assert.equal(tomb.operationId,j.operationId);
 });
 await t('034 restore normal deixa tombstone cleared i permet una operació posterior',async()=>{
   const src1=new MemoryStorageAdapter(); await src1.put('teams','b',{schemaVersion:1,teamId:'b',name:'B',players:[]}); const b1=await new Pro2BackupService(src1).exportAll();
   const src2=new MemoryStorageAdapter(); await src2.put('teams','c',{schemaVersion:1,teamId:'c',name:'C',players:[]}); const b2=await new Pro2BackupService(src2).exportAll();
   const dst=new MemoryStorageAdapter(); const s=new Pro2BackupService(dst);
   const r1=await s.restoreBackup(b1,{now:'2026-10-05T17:05:00Z',committedAt:'2026-10-05T17:05:01Z',clearedAt:'2026-10-05T17:05:02Z'}); const t1=await dst.readMaintenanceJournal(MAINTENANCE_JOURNAL_KEY,{includeCleared:true});
   const r2=await s.restoreBackup(b2,{now:'2026-10-05T17:06:00Z',committedAt:'2026-10-05T17:06:01Z',clearedAt:'2026-10-05T17:06:02Z'}); const t2=await dst.readMaintenanceJournal(MAINTENANCE_JOURNAL_KEY,{includeCleared:true});
   assert.equal(r1.maintenanceJournal,'cleared'); assert.equal(r2.maintenanceJournal,'cleared'); assert.notEqual(t1.operationId,t2.operationId); assert(await dst.get('teams','c')); assert.equal(await dst.get('teams','b'),null);
 });
 await t('034 un journal committed no pot considerar-se rollback si les dades tornen a origen',async()=>{
   const a=new MemoryStorageAdapter(); await a.put('teams','a',{schemaVersion:1,teamId:'a',name:'A',players:[]});
   const source=await stores(a), target={teams:[{id:'b',value:{schemaVersion:1,teamId:'b',name:'B',players:[]}}],activeMatches:[],completedMatches:[],settings:[]};
   let j=makeMaintenanceJournal({sourceStores:source,targetStores:target,now:'2026-10-05T17:07:00Z'}); j=transitionMaintenanceJournal(j,'committed','2026-10-05T17:07:01Z'); await a.writeMaintenanceJournal(j);
   await assert.rejects(()=>new Pro2BackupService(a).recoverInterruptedMaintenance(),e=>e.code==='MAINTENANCE_RECOVERY_CONFLICT');
 });
 console.log(`maintenance-journal-034: ${pass} PASS`);
})().catch(e=>{console.error(e);process.exit(1)});
