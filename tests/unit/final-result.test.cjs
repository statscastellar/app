const {test}=require('node:test');
const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {APP,draft,NOW}=require('../fixtures/synthetic.cjs');
const core=Object.assign({},...['match-engine','match-factory','storage-memory','storage-service','match-report','export-service','match-result','capa7-ui-state','anna-analytics'].map(n=>require(APP+'/core/src/'+n)));
const context={};vm.runInNewContext(fs.readFileSync(APP+'/shared/pro2-core.bundle.js','utf8'),context);
const json=x=>JSON.stringify(x),copy=x=>JSON.parse(json(x));
for(const [name,P] of [['Node',core],['navegador',context.StatsPro2]]){
 function fresh(){const m=P.createMatchFromDraft(draft(),{matchId:'qa-result',now:NOW});return new P.MatchEngine(m.state,m.actionLog)}
 const operations={sumar:e=>e.manualPoint('team'),restar:e=>e.manualMinus('team'),desfer:e=>e.undo(),rotar:e=>e._rotateTeam(),puntIntern:e=>e._awardPoint('team','QA'),valoracio:e=>e.ratePlayer('1',2),bloqueig:e=>e.block('2',2),posicions:e=>e.changePositions(draft().positions),canvi:e=>e.substitute(e.state.game.court['1'],'qa-player-7'),finalSet:e=>e.finishSet(),iniciSet:e=>e.startNextSet({court:draft().positions,servingSide:'rival'}),finalRepetit:e=>e.finishMatch(),anotacio:e=>e._append('POINT',{side:'team'})};
 if(P.MatchEngine.prototype.advancePhase)operations.saltFase=e=>e.advancePhase();
 for(const [operation,mutate] of Object.entries(operations))test(`${name}: ${operation} no modifica un partit finalitzat`,()=>{const e=fresh();e.manualPoint('team');e.finishMatch();const before=json(e.exportSession());a.throws(()=>mutate(e),/finalitzat/);a.equal(json(e.exportSession()),before)});
 for(const [operation,setup,mutate] of [['SOS',e=>e.ratePlayer('1',0),e=>e.activateSOS()],['camp rival',e=>e.ratePlayer('1',2),e=>e.rivalCourt()]])test(`${name}: ${operation} pendent també queda bloquejat`,()=>{const e=fresh();setup(e);e.finishMatch();const before=json(e.exportSession());a.throws(()=>mutate(e),/finalitzat/);a.equal(json(e.exportSession()),before)});
 test(`${name}: pantalla finalitzada sense controls de joc`,()=>{const e=fresh();e.ratePlayer('1',0);e.finishMatch();const ui=P.buildCapa7UiState(e,{localMode:'POSITIONS'});for(const key of ['matchActive','scoreEnabled','undoEnabled','sosEnabled','blocksEnabled','rivalCourtEnabled','ratingPhaseAllowed'])a.equal(ui[key],false,key);for(let z=1;z<=6;z++)for(let v=0;v<=3;v++)a.equal(ui.canRate(z,v),false)});
 async function archived(){const s=new P.Pro2Storage(new P.MemoryStorageAdapter()),e=fresh();e.ratePlayer('1',2);e.ratePlayer('2',2);e.ratePlayer('3',3);e.finishSet();await s.saveActive(e);e.finishMatch();await s.finalize(e);return s;}
 test(`${name}: substitució definitiva, confirmació i estadístiques intactes`,async()=>{
  const s=await archived(),before=await s.getHistory('qa-result'),stats=json(P.prepareVerifiedExport(before).report.stats);
  await a.rejects(()=>s.editHistoryResult('qa-result',[{set:1,team:20,rival:25}]),/confirmar/);a.equal(json(await s.getHistory('qa-result')),json(before));
  const action=before.report.actions.find(x=>x.type==='RECEPCIO');await s.editHistoryActionValue('qa-result',action.actionId,3);
  const edited=await s.getHistory('qa-result'),editedStats=json(P.prepareVerifiedExport(edited).report.stats);
  a.notEqual(editedStats,stats);
  for(const score of [[20,25],[25,9],[0,0]]){
   const rec=await s.editHistoryResult('qa-result',[{set:1,team:score[0],rival:score[1]}],{confirmed:true});
   a.equal(json(P.prepareVerifiedExport(rec).report.stats),editedStats);a.equal(json(rec.postMatchEdits),json(edited.postMatchEdits));
   a.equal(rec.actionLog.actions.length,before.actionLog.actions.length);a.deepEqual(Object.keys(rec).sort(),Object.keys(edited).sort());
   a.equal(rec.completedAt,before.completedAt);a.equal(json(rec.finalState.identity),json(before.finalState.identity));
   a.equal(json(rec.actionLog.actions.map(x=>[x.actionId,x.type,x.occurredAt])),json(before.actionLog.actions.map(x=>[x.actionId,x.type,x.occurredAt])));
   const loaded=await s.getHistory('qa-result');a.equal(loaded.finalState.game.score.team,score[0]);a.equal(loaded.report.result.sets[0].rival,score[1]);
  }
  const current=await s.getHistory('qa-result');await s.editHistoryActionValue('qa-result',action.actionId,1);a.equal((await s.getHistory('qa-result')).finalState.game.score.team,0);
  // Rebuilding a damaged derived report or state must retain the current result.
  const raw=await s.adapter.get('completedMatches','qa-result');raw.report.result.currentScore.team=777;raw.finalState.game.score.team=777;await s.adapter.put('completedMatches','qa-result',raw);
  const repaired=await s.getHistory('qa-result');a.equal(repaired.finalState.game.score.team,0);a.equal(P.prepareVerifiedExport(repaired).report.result.currentScore.team,0);
 });
 test(`${name}: marcador invàlid i escriptura desfasada no sobreescriuen dades`,async()=>{
  const s=await archived(),before=await s.getHistory('qa-result');
  for(const sets of [[],[{set:1,team:-1,rival:0}],[{set:1,team:1.5,rival:2}],[{set:2,team:1,rival:0}],[{set:1,team:NaN,rival:0}]])await a.rejects(()=>s.editHistoryResult('qa-result',sets,{confirmed:true}));
  a.equal(json(await s.getHistory('qa-result')),json(before));
  await s.editHistoryResult('qa-result',[{set:1,team:12,rival:25}],{confirmed:true});
  await a.rejects(()=>s.adapter.atomicReplaceCompleted('qa-result',before,before),/canviat/);a.equal((await s.getHistory('qa-result')).finalState.game.score.team,12);
 });
 test(`${name}: importació legacy, guanyadors i estadístiques es conserven`,async()=>{
  const s=new P.Pro2Storage(new P.MemoryStorageAdapter()),doc=JSON.parse(fs.readFileSync(__dirname+'/../fixtures/legacy/qa-B.json','utf8'));const imported=await s.importLegacyMatch(doc),before=await s.getHistory(imported.matchId),stats=json(P.prepareVerifiedExport(before).report.stats);
  const sets=[1,2,3].map(set=>({set,team:10,rival:25}));const rec=await s.editHistoryResult(imported.matchId,sets,{confirmed:true});
  a.equal(P.scoreText(P.prepareVerifiedExport(rec).report),'0-3');a.equal(json(P.prepareVerifiedExport(rec).report.stats),stats);a.equal(rec.importedAt,before.importedAt);a.deepEqual(Object.keys(rec).sort(),Object.keys(before).sort());
  const zero=await s.editHistoryResult(imported.matchId,sets.map(x=>({...x,team:0,rival:0})),{confirmed:true});a.equal(zero.report.result.sets[0].score.team,0);a.equal(json(P.prepareVerifiedExport(zero).report.stats),stats);
 });
 test(`${name}: resultat legacy sense desglossament de sets preserva totes les estadístiques`,async()=>{
  const s=new P.Pro2Storage(new P.MemoryStorageAdapter()),doc={format:'Stats Castellar Match',version:1,match:{id:'qa-no-sets',teamId:'qa-team',opponent:'Rival QA',legacy:true,legacyResult:'3-0',players:[{id:'old',number:1,name:'Jugadora QA'}],actions:[{playerId:'old',action:'Servei',value:2}]}};
  const imported=await s.importLegacyMatch(doc),before=await s.getHistory(imported.matchId),stats=json(P.prepareVerifiedExport(before).report.stats);
  const rec=await s.editHistoryResult(imported.matchId,[1,2,3].map(set=>({set,team:18,rival:25})),{confirmed:true});
  const report=P.prepareVerifiedExport(rec).report;a.equal(P.scoreText(report),'0-3');a.equal(report.result.sets[2].score.team,18);a.equal(json(report.stats),stats);
 });

}
