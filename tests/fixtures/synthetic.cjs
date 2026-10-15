const path = require('node:path');
const APP = path.resolve(__dirname, '../..');
const NOW = '2030-01-15T12:00:00.000Z';
function draft() {
  const players = Array.from({length:8}, (_,i)=>({playerId:`qa-player-${i+1}`,number:i+1,name:`Prova ${i+1}`,active:true,sourceTeamId:'qa-team',sourceTeamName:'Equip QA',createdAt:NOW,updatedAt:NOW}));
  return {schemaVersion:1,draftId:'qa-draft',team:{teamId:'qa-team',name:'Equip QA',category:{code:'INFANTIL',label:'Infantil',ageGroup:'U14'},sex:'female',visualProfile:{profileId:'infantil-female',backgroundKey:'bg-infantil-female.png'}},match:{opponent:'Rival QA',date:'2030-01-15',venue:'home'},rosterSnapshot:players,calledPlayerIds:players.map(p=>p.playerId),startingSixIds:players.slice(0,6).map(p=>p.playerId),positions:Object.fromEntries(players.slice(0,6).map((p,i)=>[String(i+1),p.playerId])),initialServe:{side:'rival',serverPlayerId:null},completedSteps:{step1:true,step2:true,step3:true,step4:true},createdAt:NOW,updatedAt:NOW};
}
function engine() {
  const {createMatchFromDraft}=require(path.join(APP,'core/src/match-factory'));
  const {MatchEngine}=require(path.join(APP,'core/src/match-engine'));
  const made=createMatchFromDraft(draft(),{matchId:'qa-match',now:NOW});
  return new MatchEngine(made.state,made.actionLog);
}
module.exports={APP,NOW,draft,engine};
