'use strict';

const { clone, assert } = require('./utils');
const { assessFinalizationResidue, finalizationResidueConflict, alreadyFinalizedError, staleActiveWriteError } = require('./finalization-consistency');
const { MAINTENANCE_JOURNAL_KEY, MAINTENANCE_DATA_STORES, classifyMaintenanceRecovery, verifyMaintenanceJournal, maintenanceBusy, maintenancePhaseRegression, transitionMaintenanceJournal } = require('./maintenance-journal');

function sameCompletedRecord(existing, incoming) {
  if(!existing || !incoming) return false;
  if(String(existing.matchId||'') !== String(incoming.matchId||'')) return false;
  const ei=existing.integrity||{}, ii=incoming.integrity||{};
  const er=existing.reportIntegrity||{}, ir=incoming.reportIntegrity||{};
  if(ei.digest && ii.digest && er.reportDigest && ir.reportDigest) {
    return ei.digest===ii.digest && er.reportDigest===ir.reportDigest &&
      (!er.sourceSessionDigest || !ir.sourceSessionDigest || er.sourceSessionDigest===ir.sourceSessionDigest);
  }
  // Compatibilitat amb registres antics sense empremtes separades.
  return JSON.stringify({finalState:existing.finalState,actionLog:existing.actionLog,report:existing.report}) ===
    JSON.stringify({finalState:incoming.finalState,actionLog:incoming.actionLog,report:incoming.report});
}

function finalizeConflict(matchId) {
  const e=new Error('Conflicte de finalització: ja existeix un partit diferent amb el mateix matchId.');
  e.code='FINALIZE_CONFLICT'; e.matchId=String(matchId); return e;
}

const DB_NAME='StatsCastellarPro2DB';
const DB_VERSION=2;
const STORES=['activeMatches','completedMatches','teams','settings'];
const MAINTENANCE_STORE='maintenance';
const ALL_STORES=[...STORES,MAINTENANCE_STORE];

class IndexedDBStorageAdapter {
  constructor(indexedDBImpl) {
    this.indexedDB=indexedDBImpl || (typeof indexedDB!=='undefined' ? indexedDB : null);
    assert(this.indexedDB,'IndexedDB no disponible');
    this._dbPromise=null;
  }

  _open() {
    if(this._dbPromise) return this._dbPromise;
    this._dbPromise=new Promise((resolve,reject)=>{
      const req=this.indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        for(const s of ALL_STORES) if(!db.objectStoreNames.contains(s)) db.createObjectStore(s,{keyPath:'id'});
      };
      req.onsuccess=()=>{ const db=req.result; this._recoverMaintenanceOnOpen(db).then(()=>resolve(db),err=>{try{db.close()}catch{};reject(err);}); };
      req.onerror=()=>reject(req.error || new Error('No es pot obrir IndexedDB'));
    });
    return this._dbPromise;
  }

  async _recoverMaintenanceOnOpen(db) {
    if(!db.objectStoreNames.contains(MAINTENANCE_STORE)) return {status:'none'};
    const journal=await new Promise((resolve,reject)=>{
      const tx=db.transaction(MAINTENANCE_STORE,'readonly'), req=tx.objectStore(MAINTENANCE_STORE).get(MAINTENANCE_JOURNAL_KEY);
      req.onsuccess=()=>resolve(req.result?clone(req.result.value):null); req.onerror=()=>reject(req.error||new Error('No es pot llegir el journal de manteniment'));
    });
    if(!journal) return {status:'none'};
    const verified=verifyMaintenanceJournal(journal);
    if(!verified.legacy && journal.phase==='cleared') {
      this.lastMaintenanceRecovery={status:'cleared',operation:journal.operation,operationId:journal.operationId,recovered:false};
      return this.lastMaintenanceRecovery;
    }
    const current={};
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(MAINTENANCE_DATA_STORES,'readonly'); let pending=MAINTENANCE_DATA_STORES.length,failed=false;
      for(const name of MAINTENANCE_DATA_STORES){const req=tx.objectStore(name).getAll();req.onerror=()=>{if(!failed){failed=true;reject(req.error||new Error('No es pot verificar el manteniment'));}};req.onsuccess=()=>{current[name]=(req.result||[]).map(x=>({id:String(x.id),value:clone(x.value)}));if(--pending===0&&!failed)resolve();};}
    });
    const assessment=classifyMaintenanceRecovery(journal,current);
    if(verified.legacy) {
      await new Promise((resolve,reject)=>{const tx=db.transaction(MAINTENANCE_STORE,'readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('No es pot netejar el journal'));tx.objectStore(MAINTENANCE_STORE).delete(MAINTENANCE_JOURNAL_KEY);});
      this.lastMaintenanceRecovery={...assessment,operation:journal.operation,operationId:null,legacy:true,recoveredAt:new Date().toISOString(),phase:'cleared'};
      return this.lastMaintenanceRecovery;
    }
    let next=journal, recoveredAt=new Date().toISOString();
    if(assessment.status==='committed' && next.phase==='prepared') next=transitionMaintenanceJournal(next,'committed',recoveredAt);
    next=transitionMaintenanceJournal(next,'cleared',recoveredAt);
    await new Promise((resolve,reject)=>{const tx=db.transaction(MAINTENANCE_STORE,'readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('No es pot tancar el journal'));tx.objectStore(MAINTENANCE_STORE).put({id:MAINTENANCE_JOURNAL_KEY,value:clone(next)});});
    this.lastMaintenanceRecovery={...assessment,operation:journal.operation,operationId:journal.operationId,recoveredAt,phase:'cleared'};
    return this.lastMaintenanceRecovery;
  }

  async writeMaintenanceJournal(record) {
    verifyMaintenanceJournal(record);
    const db=await this._open(), id=String(record.journalId||MAINTENANCE_JOURNAL_KEY);
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(MAINTENANCE_STORE,'readwrite'), os=tx.objectStore(MAINTENANCE_STORE), req=os.get(id);
      let result=clone(record), failed=false;
      const fail=(err)=>{if(failed)return;failed=true;try{tx.abort()}catch{};reject(err instanceof Error?err:new Error(String(err)));};
      req.onerror=()=>fail(req.error||new Error('No es pot comprovar el journal de manteniment'));
      req.onsuccess=()=>{
        try {
          const existing=req.result?.value||null;
          if(existing) {
            verifyMaintenanceJournal(existing);
            const sameOp=existing.operationId && record.operationId && existing.operationId===record.operationId;
            const inactive=existing.phase==='cleared';
            if(!sameOp && !inactive) return fail(maintenanceBusy(existing,record));
            if(sameOp) {
              const order={prepared:0,committed:1,cleared:2};
              if(order[record.phase] < order[existing.phase]) return fail(maintenancePhaseRegression(existing,record));
              if(existing.integrity?.digest===record.integrity?.digest) { result=clone(existing); return; }
            }
          }
          os.put({id,value:clone(record)});
        } catch(e){ fail(e); }
      };
      tx.oncomplete=()=>{if(!failed)resolve(result)}; tx.onerror=()=>{if(!failed){failed=true;reject(tx.error||new Error('No es pot desar el journal de manteniment'));}};
    });
  }
  async readMaintenanceJournal(journalId=MAINTENANCE_JOURNAL_KEY, options={}) {
    const db=await this._open();
    return new Promise((resolve,reject)=>{const tx=db.transaction(MAINTENANCE_STORE,'readonly'),req=tx.objectStore(MAINTENANCE_STORE).get(String(journalId));req.onsuccess=()=>{const v=req.result?clone(req.result.value):null;resolve(v && v.phase==='cleared' && options.includeCleared!==true ? null : v);};req.onerror=()=>reject(req.error||new Error('No es pot llegir el journal de manteniment'));});
  }
  async clearMaintenanceJournal(journalId=MAINTENANCE_JOURNAL_KEY) {
    const db=await this._open();
    return new Promise((resolve,reject)=>{const tx=db.transaction(MAINTENANCE_STORE,'readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('No es pot netejar el journal de manteniment'));tx.objectStore(MAINTENANCE_STORE).delete(String(journalId));});
  }

  async put(store,key,value) {
    const db=await this._open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readwrite');
      tx.oncomplete=()=>resolve(clone(value));
      tx.onerror=()=>reject(tx.error);
      tx.objectStore(store).put({id:String(key),value:clone(value)});
    });
  }

  async get(store,key) {
    const db=await this._open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readonly');
      const req=tx.objectStore(store).get(String(key));
      req.onsuccess=()=>resolve(req.result ? clone(req.result.value) : null);
      req.onerror=()=>reject(req.error);
    });
  }

  async delete(store,key) {
    const db=await this._open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readwrite');
      tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error);
      tx.objectStore(store).delete(String(key));
    });
  }

  async list(store) {
    const rows=await this.listEntries(store);
    return rows.map(x=>clone(x.value));
  }

  async listEntries(store) {
    const db=await this._open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readonly');
      const req=tx.objectStore(store).getAll();
      req.onsuccess=()=>resolve((req.result||[]).map(x=>({id:String(x.id),value:clone(x.value)})));
      req.onerror=()=>reject(req.error);
    });
  }

  async atomicSaveActive(matchId,record,expectedRevision=null) {
    if(expectedRevision==null && Object.prototype.hasOwnProperty.call(record||{},'parentStorageRevision')) expectedRevision=record.parentStorageRevision;
    const db=await this._open();
    const id=String(matchId);
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['activeMatches','completedMatches'],'readwrite');
      const os=tx.objectStore('activeMatches');
      const completed=tx.objectStore('completedMatches');
      const doneReq=completed.get(id);
      let result=null, failed=false;
      const fail=(err)=>{
        if(failed) return; failed=true;
        try{tx.abort()}catch{}
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      doneReq.onerror=()=>fail(doneReq.error||new Error('No es pot comprovar si el partit ja està finalitzat'));
      doneReq.onsuccess=()=>{
        if(doneReq.result) return fail(alreadyFinalizedError(id));
        const existingReq=os.get(id);
        existingReq.onerror=()=>fail(existingReq.error||new Error('No es pot llegir la versió activa'));
        existingReq.onsuccess=()=>{
          const existing=existingReq.result?.value||null;
          if(existing){
            const actualRevision=Number(existing.storageRevision||0);
            if(expectedRevision==null || actualRevision!==expectedRevision) return fail(staleActiveWriteError(id,expectedRevision,actualRevision));
          } else if(expectedRevision!=null && expectedRevision!==0) return fail(staleActiveWriteError(id,expectedRevision,null));
          const keysReq=os.getAllKeys();
          keysReq.onerror=()=>fail(keysReq.error||new Error('No es pot comprovar el partit actiu'));
          keysReq.onsuccess=()=>{
            const foreign=(keysReq.result||[]).map(String).filter(k=>k!==id);
            if(foreign.length){
              const e=new Error('Ja hi ha un altre partit actiu. Recupera o finalitza el partit en curs abans de crear-ne un de nou.');
              e.code='ACTIVE_MATCH_EXISTS'; e.activeMatchIds=foreign;
              return fail(e);
            }
            result=clone(record);
            os.put({id,value:clone(record)});
          };
        };
      };
      tx.oncomplete=()=>{if(!failed)resolve(result)};
      tx.onerror=()=>{if(!failed){failed=true;reject(tx.error||new Error('No s\'ha pogut desar el partit actiu'));}};
      tx.onabort=()=>{if(!failed){failed=true;reject(tx.error||new Error('Desament del partit actiu avortat'));}};
    });
  }


  async atomicReconcileFinalizedActive(matchId) {
    const db=await this._open(); const id=String(matchId);
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['activeMatches','completedMatches'],'readwrite');
      const active=tx.objectStore('activeMatches'), completed=tx.objectStore('completedMatches');
      const ar=active.get(id), cr=completed.get(id); let av=null,cv=null,ready=0,failed=false,result={status:'none'};
      const fail=(err)=>{if(failed)return;failed=true;try{tx.abort()}catch{};reject(err instanceof Error?err:new Error(String(err)));};
      const check=()=>{if(++ready<2)return;if(!av||!cv)return;const assessment=assessFinalizationResidue(av,cv);if(assessment.status!=='safe-residue')return fail(finalizationResidueConflict(id,assessment.reason));active.delete(id);result={status:'cleared',matchId:id,completed:clone(cv)};};
      ar.onerror=()=>fail(ar.error||new Error('No es pot llegir el partit actiu')); cr.onerror=()=>fail(cr.error||new Error('No es pot llegir el partit finalitzat'));
      ar.onsuccess=()=>{av=ar.result?ar.result.value:null;check();}; cr.onsuccess=()=>{cv=cr.result?cr.result.value:null;check();};
      tx.oncomplete=()=>{if(!failed)resolve(result)}; tx.onerror=()=>{if(!failed){failed=true;reject(tx.error||new Error('Reconciliació fallida'));}}; tx.onabort=()=>{if(!failed){failed=true;reject(tx.error||new Error('Reconciliació avortada'));}};
    });
  }

  async atomicImportBackup(stores, options={}) {
    const db=await this._open();
    const compare=options.compare || (x=>JSON.stringify(x));
    const names=Object.keys(stores||{});
    for(const name of names) assert(STORES.includes(name),'Magatzem de backup desconegut: '+name);
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(names,'readwrite');
      const summary={inserted:0,skipped:0,byStore:{}};
      let pending=0,failed=false;
      const abort=e=>{ if(failed)return; failed=true; try{tx.abort()}catch{}; reject(e instanceof Error?e:new Error(String(e))); };
      for(const name of names){
        const os=tx.objectStore(name), entries=stores[name]||[], part={inserted:0,skipped:0}; summary.byStore[name]=part;
        for(const entry of entries){
          pending++; const id=String(entry.id); const req=os.get(id);
          req.onerror=()=>abort(req.error||new Error('No es pot comprovar '+name+'/'+id));
          req.onsuccess=()=>{
            try {
              if(req.result){
                if(compare(req.result.value)!==compare(entry.value)) return abort(new Error('Conflicte de backup a '+name+'/'+id));
                part.skipped++; summary.skipped++;
              } else { os.put({id,value:clone(entry.value)}); part.inserted++; summary.inserted++; }
              pending--;
            } catch(e){ abort(e); }
          };
        }
      }
      tx.oncomplete=()=>{ if(!failed) resolve(summary); };
      tx.onerror=()=>{ if(!failed){failed=true;reject(tx.error||new Error('Importació de backup fallida'));} };
      tx.onabort=()=>{ if(!failed){failed=true;reject(tx.error||new Error('Importació de backup avortada'));} };
    });
  }


  async atomicReplaceBackup(stores) {
    const db=await this._open();
    for(const name of STORES) assert(Array.isArray(stores?.[name]),'Backup incomplet: '+name);
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORES,'readwrite'); let failed=false;
      const fail=(err)=>{if(failed)return;failed=true;try{tx.abort()}catch{};reject(err instanceof Error?err:new Error(String(err)));};
      const counts={};
      for(const name of STORES){
        const os=tx.objectStore(name), entries=stores[name]||[]; counts[name]=entries.length;
        const seen=new Set();
        for(const entry of entries){const id=String(entry.id);if(seen.has(id)) return fail(new Error('Backup amb id duplicat: '+name+'/'+id));seen.add(id);}
        const clear=os.clear(); clear.onerror=()=>fail(clear.error||new Error('No es pot buidar '+name));
        for(const entry of entries){const req=os.put({id:String(entry.id),value:clone(entry.value)});req.onerror=()=>fail(req.error||new Error('No es pot restaurar '+name+'/'+entry.id));}
      }
      tx.oncomplete=()=>{if(!failed)resolve({status:'restored',replaced:true,counts})};
      tx.onerror=()=>{if(!failed){failed=true;reject(tx.error||new Error('Restauració completa fallida'));}};
      tx.onabort=()=>{if(!failed){failed=true;reject(tx.error||new Error('Restauració completa avortada'));}};
    });
  }

  async atomicFinalize(matchId,completedRecord,expectedRevision=null) {
    if(expectedRevision==null && completedRecord?.sourceStorageRevision!=null) expectedRevision=completedRecord.sourceStorageRevision;
    const db=await this._open();
    const id=String(matchId);
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['activeMatches','completedMatches'],'readwrite');
      const active=tx.objectStore('activeMatches');
      const completed=tx.objectStore('completedMatches');
      const activeLookup=active.get(id);
      let result=clone(completedRecord);
      let failed=false;
      const fail=(err)=>{
        if(failed) return; failed=true;
        try{tx.abort()}catch{}
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      activeLookup.onerror=()=>fail(activeLookup.error||new Error('No es pot comprovar la versió del partit actiu'));
      activeLookup.onsuccess=()=>{
        const activeRecord=activeLookup.result?.value||null;
        if(activeRecord){
          const actualRevision=Number(activeRecord.storageRevision||0);
          if(expectedRevision==null || actualRevision!==expectedRevision) return fail(staleActiveWriteError(id,expectedRevision,actualRevision));
        }
        const lookup=completed.get(id);
        lookup.onerror=()=>fail(lookup.error||new Error('No es pot comprovar si el partit ja està arxivat'));
        lookup.onsuccess=()=>{
          if(lookup.result) {
            const existing=lookup.result.value;
            if(!sameCompletedRecord(existing,completedRecord)) return fail(finalizeConflict(id));
            result=clone(existing);
          } else completed.put({id,value:clone(completedRecord)});
          active.delete(id);
        };
      };
      tx.oncomplete=()=>{if(!failed)resolve(result)};
      tx.onerror=()=>{if(!failed){failed=true;reject(tx.error || new Error('No s\'ha pogut arxivar el partit'));}};
      tx.onabort=()=>{if(!failed){failed=true;reject(tx.error || new Error('Transacció d\'arxiu avortada'));}};
    });
  }
}

module.exports={ IndexedDBStorageAdapter, DB_NAME, DB_VERSION, STORES, MAINTENANCE_STORE, ALL_STORES };
