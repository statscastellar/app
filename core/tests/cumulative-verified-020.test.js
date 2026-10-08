'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {createMatchFromDraft}=require('../src/match-factory');
const {MatchEngine}=require('../src/match-engine');
const {MemoryStorageAdapter}=require('../src/storage-memory');
const {Pro2Storage}=require('../src/storage-service');
const {calculateVerifiedCumulative,calculateVerifiedCumulativeByTeam}=require('../src/cumulative-stats');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/draft.json'),'utf8'));
function fresh(id,teamId='team-a'){const d=JSON.parse(JSON.stringify(draft));d.team.teamId=teamId;d.team.name=teamId==='team-b'?'Equip B':'Equip A';const {state,actionLog}=createMatchFromDraft(d,{matchId:id,now:'2026-10-05T19:00:00Z'});return new MatchEngine(state,actionLog)}
async function test(name,fn){try{await fn();console.log('PASS',name)}catch(e){console.error('FAIL',name,'\n ',e.stack||e);process.exitCode=1}}
(async()=>{
 await test('listHistoryVerified repara report abans d’agregar',async()=>{const a=new MemoryStorageAdapter(),st=new Pro2Storage(a),e=fresh('cv020-heal');e.ratePlayer('6',2);e.finishMatch();await st.finalize(e);const raw=await a.get('completedMatches','cv020-heal');raw.report.stats.teamAnnaActions=999;await a.put('completedMatches','cv020-heal',raw);const rows=await st.listHistoryVerified();assert.equal(rows.length,1);assert.notEqual(rows[0].report.stats.teamAnnaActions,999);assert(rows[0].reportIntegrity?.reportDigest)});
 await test('listHistoryVerified rebutja un ActionLog no fiable',async()=>{const a=new MemoryStorageAdapter(),st=new Pro2Storage(a),e=fresh('cv020-badlog');e.finishMatch();await st.finalize(e);const raw=await a.get('completedMatches','cv020-badlog');raw.actionLog.actions[0].data.tampered=true;await a.put('completedMatches','cv020-badlog',raw);await assert.rejects(()=>st.listHistoryVerified(),/Historial no verificable/)});
 await test('acumulat verificat inclou traça i digest de fonts',async()=>{const a=new MemoryStorageAdapter(),st=new Pro2Storage(a);for(const id of ['cv020-a1','cv020-a2']){const e=fresh(id);e.ratePlayer('6',2);e.finishMatch();await st.finalize(e);}const rows=await st.listHistoryVerified();const c=calculateVerifiedCumulative(rows,{teamId:'team-a'});assert.equal(c.matches,2);assert.equal(c.verification.verified,true);assert.equal(c.verification.sourceCount,2);assert.equal(c.verification.sources.length,2);assert(c.verification.aggregateDigest)});
 await test('acumulat verificat per equip no barreja fonts',async()=>{const a=new MemoryStorageAdapter(),st=new Pro2Storage(a);for(const [id,team] of [['cv020-a','team-a'],['cv020-b','team-b']]){const e=fresh(id,team);e.finishMatch();await st.finalize(e);}const rows=await st.listHistoryVerified();const g=calculateVerifiedCumulativeByTeam(rows);assert.deepEqual(Object.keys(g).sort(),['team-a','team-b']);assert.equal(g['team-a'].verification.sourceCount,1);assert.equal(g['team-b'].verification.sourceCount,1)});
 await test('càlcul verificat rebutja report manipulat si no passa per reparació',async()=>{const a=new MemoryStorageAdapter(),st=new Pro2Storage(a),e=fresh('cv020-direct');e.finishMatch();await st.finalize(e);const raw=await a.get('completedMatches','cv020-direct');raw.report.audit.activeActions+=1;assert.throws(()=>calculateVerifiedCumulative([raw],{teamId:'team-a'}),/MatchReport/)});
 if(!process.exitCode) console.log('\nRESULTAT FINAL: PASS — ACUMULATS VERIFICATS PRO.2 020');
})();
