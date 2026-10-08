'use strict';

const { clone, assert } = require('./utils');
const { createMatchFromDraft } = require('./match-factory');
const { MatchEngine } = require('./match-engine');
const { PHASE } = require('./constants');

const ZONES=['1','2','3','4','5','6'];

function lineup(ids) {
  assert(ids.length===6,'El simulador necessita sis jugadores per set');
  return {'1':ids[0],'2':ids[1],'3':ids[2],'4':ids[3],'5':ids[4],'6':ids[5]};
}

function statPattern(engine) {
  // Patró deliberadament variat per alimentar Servei, Recepció/Defensa,
  // Col·locació, Atac i Salvada sense saltar-se la màquina d'estats.
  if(engine.state.game.phase===PHASE.RECEPCIO) {
    engine.ratePlayer('5',2);
    engine.ratePlayer('3',3);
    engine.ratePlayer('4',3);
  }
  if(engine.state.game.phase===PHASE.SERVEI) engine.ratePlayer('1',2);
  if(engine.state.game.phase===PHASE.DEFENSA) engine.ratePlayer('6',2);
  if(engine.state.game.phase===PHASE.COLLOCACIO) engine.ratePlayer('3',2);
  if(engine.state.game.phase===PHASE.ATAC) engine.ratePlayer('2',2);
  if(engine.state.game.phase===PHASE.DEFENSA) {
    engine.ratePlayer('5',0);
    if(engine.state.flow.sos.status==='available') {
      engine.activateSOS();
      engine.ratePlayer('4',3);
    }
  }
  if(engine.state.game.phase===PHASE.COLLOCACIO) engine.ratePlayer('3',2);
  if(engine.state.game.phase===PHASE.ATAC) engine.ratePlayer('4',3);
  if(engine.state.game.phase===PHASE.SERVEI) engine.ratePlayer('1',3);
}

function fillScore(engine, teamTarget=25, rivalTarget=20) {
  while(engine.state.game.score.team<teamTarget) engine.manualPoint('team');
  while(engine.state.game.score.rival<rivalTarget) engine.manualPoint('rival');
}

function simulateMatchFromDraft(draft, options={}) {
  const made=createMatchFromDraft(draft,{matchId:options.matchId,now:options.now});
  const engine=new MatchEngine(made.state,made.actionLog);
  const called=[...draft.calledPlayerIds];
  assert(called.length>=6,'El simulador necessita almenys sis convocades');

  const lineups=[];
  lineups.push(ZONES.map(z=>draft.positions[z]));
  if(called.length>=12) lineups.push(called.slice(6,12));
  else lineups.push(called.slice(0,6).reverse());
  if(called.length>=10) lineups.push([called[0],called[7]||called[1],called[2],called[9]||called[3],called[4],called[5]]);
  else lineups.push([called[1],called[2],called[3],called[4],called[5],called[0]]);

  for(let set=1; set<=3; set++) {
    if(set>1) engine.startNextSet({court:lineup(lineups[set-1]),servingSide:'rival'});
    statPattern(engine);
    fillScore(engine,25,20);
    engine.finishSet();
  }
  engine.finishMatch();
  return engine;
}

function buildSimulationDraft(team, options={}) {
  assert(team && team.teamId,'Cal un equip per simular');
  const players=(team.players||[]).filter(p=>p.active!==false);
  assert(players.length>=6,'Calen almenys sis jugadores actives per simular');
  const called=players.map(p=>p.playerId);
  const six=called.slice(0,6);
  const today=options.date || new Date().toISOString().slice(0,10);
  return {
    schemaVersion:1,
    draftId:'simulation-'+(options.matchId||Date.now()),
    team:clone(team),
    match:{opponent:options.opponent||'Rival de simulació',date:today,venue:options.venue||'home'},
    rosterSnapshot:clone(players),
    calledPlayerIds:called,
    startingSixIds:six,
    positions:lineup(six),
    initialServe:{side:'rival',serverPlayerId:null},
    completedSteps:{step1:true,step2:true,step3:true,step4:true},
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
}

module.exports={simulateMatchFromDraft,buildSimulationDraft};
