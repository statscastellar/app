'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {MemoryStorageAdapter}=require('../src/storage-memory');
const {Pro2Storage}=require('../src/storage-service');
const {prepareVerifiedExport}=require('../src/export-service');
const {buildHistoryAnalytics}=require('../src/anna-analytics');
(async()=>{
 const adapter=new MemoryStorageAdapter(),store=new Pro2Storage(adapter);
 const dir=path.join(__dirname,'../../imports/legacy');
 const files=fs.readdirSync(dir).filter(x=>x.endsWith('.json')).sort();assert.strictEqual(files.length,5);
 for(const f of files){const out=await store.importLegacyMatch(JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));assert.strictEqual(out.status,'imported');}
 let rows=await store.listHistoryVerified();assert.strictEqual(rows.length,5);assert(rows.every(r=>r.sourceKind==='legacy-import'));
 const names=rows.map(r=>r.metadata.opponent);for(const n of ['Sant Celoni','Gadex','Sant Cugat Vermell','Sant Cugat Negre','Alpicat'])assert(names.includes(n));
 const gadex=rows.find(r=>r.metadata.opponent==='Gadex');assert.strictEqual(gadex.metadata.legacyResult,'3-0');assert(gadex.report.stats.teamAnnaTotal.actions>0);assert(gadex.report.stats.players.some(p=>p.playerId==='ia-18'));
 const scn=rows.find(r=>r.metadata.opponent==='Sant Cugat Negre');assert.strictEqual(scn.report.audit.setActionBreakdownAvailable,true);assert.strictEqual(Object.keys(scn.report.stats.bySet).length,3);
 assert.strictEqual(gadex.report.stats.teamAnna.DEFENSA.actions,0);assert.strictEqual(gadex.report.stats.teamSaves.total,0);
 const exp=prepareVerifiedExport(gadex);assert.strictEqual(exp.audit.verified,true);assert.strictEqual(exp.audit.sourceKind,'legacy-import');
 const h=buildHistoryAnalytics(rows.map(r=>r.report),{teamId:'infantil-a'});assert.strictEqual(h.matches,5);assert(h.players.find(p=>String(p.number)==='18').matches.length===5);
 const doc=JSON.parse(fs.readFileSync(path.join(dir,files.find(x=>x.includes('Gadex'))),'utf8'));const again=await store.importLegacyMatch(doc);assert.strictEqual(again.status,'already-imported');assert.strictEqual((await store.listHistoryVerified()).length,5);
 // informe derivat manipulable es repara des de la font antiga intacta
 let raw=await adapter.get('completedMatches',gadex.matchId);raw.report.stats.teamAnnaActions=999;await adapter.put('completedMatches',gadex.matchId,raw);const repaired=await store.getHistory(gadex.matchId);assert.notStrictEqual(repaired.report.stats.teamAnnaActions,999);assert.strictEqual(repaired.reportRecoverySource,'legacy-source');
 // la font importada no es repara ni es confia si ha estat alterada
 raw=await adapter.get('completedMatches',gadex.matchId);raw.legacySource.match.opponent='Manipulat';await adapter.put('completedMatches',gadex.matchId,raw);let failed=false;try{await store.getHistory(gadex.matchId)}catch(e){failed=true}assert.strictEqual(failed,true);
 console.log('PASS legacy import 046: 5 partits, idempotència, informe tècnic, històric i integritat');
})().catch(e=>{console.error(e);process.exit(1)});
