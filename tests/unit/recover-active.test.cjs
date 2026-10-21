const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {draft,NOW}=require('../fixtures/synthetic.cjs');
const core={...require('../../core/src/match-factory'),...require('../../core/src/match-engine'),...require('../../core/src/storage-service'),...require('../../core/src/storage-memory')};
const context={};vm.runInNewContext(fs.readFileSync(require.resolve('../../shared/pro2-core.bundle.js'),'utf8'),context);
for(const [name,P] of [['core',core],['browser bundle',context.StatsPro2]]){
 test(name+': listActive llista buit i retorna el partit sense modificar-lo',async()=>{
  const adapter=new P.MemoryStorageAdapter(),store=new P.Pro2Storage(adapter);
  a.equal((await store.listActive()).length,0);
  const made=P.createMatchFromDraft(draft(),{matchId:'recover-qa',now:NOW}),engine=new P.MatchEngine(made.state,made.actionLog);
  engine.manualPoint('team');await store.saveActive(engine);
  const before=JSON.stringify(await adapter.list('activeMatches')),records=await store.listActive();
  a.equal(records.length,1);a.equal(records[0].matchId,'recover-qa');a.equal(records[0].session.state.game.score.team,1);
  a.equal(JSON.stringify(await adapter.list('activeMatches')),before);
  records[0].session.state.game.score.team=99;
  a.equal(JSON.stringify(await adapter.list('activeMatches')),before);
 });
 test(name+': listActive no ofereix residus de partits ja arxivats',async()=>{
  const adapter=new P.MemoryStorageAdapter(),store=new P.Pro2Storage(adapter),made=P.createMatchFromDraft(draft(),{matchId:'finished-qa',now:NOW}),engine=new P.MatchEngine(made.state,made.actionLog);
  const old=await store.saveActive(engine);engine.finishMatch();await store.finalize(engine);
  const completed=JSON.stringify(await adapter.list('completedMatches'));await adapter.put('activeMatches','finished-qa',old);
  a.equal((await store.listActive()).length,0);a.equal(JSON.stringify(await adapter.list('completedMatches')),completed);
 });
}
