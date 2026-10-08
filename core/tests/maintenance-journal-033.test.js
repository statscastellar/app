'use strict';
const assert=require('assert').strict;
const {MemoryStorageAdapter}=require('../src/storage-memory');
const {Pro2BackupService}=require('../src/backup-service');
const {makeMaintenanceJournal,verifyMaintenanceJournal,MAINTENANCE_JOURNAL_KEY}=require('../src/maintenance-journal');

let pass=0;
async function t(name,fn){await fn();pass++;console.log('PASS',name);}
async function stores(adapter){const out={};for(const n of ['teams','activeMatches','completedMatches','settings'])out[n]=await adapter.listEntries(n);return out;}

(async()=>{
 await t('033 journal de restauració té integritat pròpia',async()=>{
   const a=new MemoryStorageAdapter(); await a.put('teams','a',{schemaVersion:1,teamId:'a',name:'A',players:[]});
   const source=await stores(a), target={teams:[{id:'b',value:{schemaVersion:1,teamId:'b',name:'B',players:[]}}],activeMatches:[],completedMatches:[],settings:[]};
   const j=makeMaintenanceJournal({sourceStores:source,targetStores:target,now:'2026-10-05T16:30:00Z'}); assert.equal(verifyMaintenanceJournal(j).ok,true); assert(j.integrity.digest);
 });
 await t('033 recupera journal preparat si restore no havia començat',async()=>{
   const a=new MemoryStorageAdapter(); await a.put('teams','a',{schemaVersion:1,teamId:'a',name:'A',players:[]});
   const source=await stores(a), target={teams:[],activeMatches:[],completedMatches:[],settings:[]};
   await a.writeMaintenanceJournal(makeMaintenanceJournal({sourceStores:source,targetStores:target}));
   const r=await new Pro2BackupService(a).recoverInterruptedMaintenance(); assert.equal(r.status,'rolled-back'); assert.equal(await a.readMaintenanceJournal(),null); assert(await a.get('teams','a'));
 });
 await t('033 recupera journal residual si restore ja havia fet commit',async()=>{
   const a=new MemoryStorageAdapter(); await a.put('teams','a',{schemaVersion:1,teamId:'a',name:'A',players:[]});
   const source=await stores(a), target={teams:[{id:'b',value:{schemaVersion:1,teamId:'b',name:'B',players:[]}}],activeMatches:[],completedMatches:[],settings:[]};
   await a.writeMaintenanceJournal(makeMaintenanceJournal({sourceStores:source,targetStores:target})); await a.atomicReplaceBackup(target);
   const r=await new Pro2BackupService(a).recoverInterruptedMaintenance(); assert.equal(r.status,'committed'); assert.equal(await a.readMaintenanceJournal(),null); assert(await a.get('teams','b'));
 });
 await t('033 estat diferent de origen/objectiu genera conflicte i conserva journal',async()=>{
   const a=new MemoryStorageAdapter(); await a.put('teams','a',{schemaVersion:1,teamId:'a',name:'A',players:[]});
   const source=await stores(a), target={teams:[{id:'b',value:{schemaVersion:1,teamId:'b',name:'B',players:[]}}],activeMatches:[],completedMatches:[],settings:[]};
   await a.writeMaintenanceJournal(makeMaintenanceJournal({sourceStores:source,targetStores:target})); await a.put('teams','c',{schemaVersion:1,teamId:'c',name:'C',players:[]});
   await assert.rejects(()=>new Pro2BackupService(a).recoverInterruptedMaintenance(),e=>e.code==='MAINTENANCE_RECOVERY_CONFLICT'); assert(await a.readMaintenanceJournal());
 });
 await t('033 journal manipulat és rebutjat i no es neteja',async()=>{
   const a=new MemoryStorageAdapter(); const source=await stores(a),target={teams:[],activeMatches:[],completedMatches:[],settings:[]};
   const j=makeMaintenanceJournal({sourceStores:source,targetStores:target}); j.targetStoresDigest='manipulat'; a.maintenance.set(MAINTENANCE_JOURNAL_KEY,j);
   await assert.rejects(()=>new Pro2BackupService(a).recoverInterruptedMaintenance(),/Integritat del journal/); assert(await a.readMaintenanceJournal(MAINTENANCE_JOURNAL_KEY));
 });
 await t('033 restore normal neteja el journal després del commit',async()=>{
   const src=new MemoryStorageAdapter(); await src.put('teams','b',{schemaVersion:1,teamId:'b',name:'B',players:[]}); const backup=await new Pro2BackupService(src).exportAll();
   const dst=new MemoryStorageAdapter(); await dst.put('teams','a',{schemaVersion:1,teamId:'a',name:'A',players:[]}); const r=await new Pro2BackupService(dst).restoreBackup(backup,{now:'2026-10-05T16:31:00Z'});
   assert.equal(r.maintenanceJournal,'cleared'); assert.equal(await dst.readMaintenanceJournal(),null); assert.equal(await dst.get('teams','a'),null); assert(await dst.get('teams','b'));
 });
 console.log(`maintenance-journal-033: ${pass} PASS`);
})().catch(e=>{console.error(e);process.exit(1)});
