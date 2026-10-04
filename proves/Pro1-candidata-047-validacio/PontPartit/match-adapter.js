/* Adaptador pur: preparació Pro.1 -> contracte d'entrada del motor antic. */
(function(root,factory){const api=factory(root.StatsPreparation || (typeof require==='function'?require('./validate.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;root.StatsMatchAdapter=api;})(typeof globalThis!=='undefined'?globalThis:this,function(preparation){
'use strict';
function build(match,selection,court,convocation,serving){
 const check=preparation.validate(match,selection,court,convocation);
 const errors=[...check.errors];
 if(!['castellar','rival'].includes(serving))errors.push('Cal seleccionar el primer servei');
 const called=convocation?.called||selection?.called;
 if(!Array.isArray(called)||called.length<6)errors.push('Falta la plantilla convocada per iniciar el motor');
 if(errors.length)return {ok:false,errors,detail:null};
 const players=called.map(p=>({id:String(p.id),number:String(p.num),name:String(p.name),team:p.team||selection.team}));
 const ids=new Set(players.map(p=>p.id));
 if(ids.size!==players.length||players.some(p=>!p.id||p.id==='undefined'||!p.name||!p.number))errors.push('La convocatòria conté jugadores repetides o incompletes');
 if(selection.startingSix.some(p=>!ids.has(String(p.id))))errors.push('Una titular no figura a la plantilla del motor');
 if(errors.length)return {ok:false,errors,detail:null};
 const positions={};court.positions.forEach(x=>positions[String(x.zone)]=String(x.player.id));
 const detail={teamId:String(match.teamId||selection.teamId||'infantil-a'),opponent:match.opponent,date:match.date,venue:['LOCAL','home'].includes(match.venue)?'home':'away',starting:selection.startingSix.map(x=>String(x.id)),positions,players,serving,set:1};
 return {ok:true,errors:[],detail};
}
return {build};
});
