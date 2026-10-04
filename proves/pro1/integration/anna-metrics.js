/* Escala contrastada amb Castellar-santCugat(2).xlsx, full 'Detall estadístiques'.
   Els cinc fonaments originals són comparables amb l'Excel de l'Anna.
   Bloqueig i Salvada es conserven als informes, però no s'inclouen a aquest indicador. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.StatsAnnaMetrics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const FOUNDATIONS=['Servei','Recepció','Col·locació','Atac','Defensa'];
  const POINTS=[0,5,8,10];
  function grade(counts){
    const c=Array.from({length:4},(_,i)=>Number(counts?.[i]||0));
    if(c.some(v=>!Number.isFinite(v)||v<0))throw new Error('Recompte invàlid');
    const volume=c.reduce((a,v)=>a+v,0);
    const points=c.reduce((a,v,i)=>a+v*POINTS[i],0);
    return {volume,points,efficiency:volume?points/(volume*10):null};
  }
  function aggregate(detail){
    const rows=(detail||[]).filter(d=>FOUNDATIONS.includes(d.action)).map(d=>({
      playerId:String(d.playerId),action:d.action,...grade(d.counts)
    }));
    const team=rows.reduce((o,r)=>({volume:o.volume+r.volume,points:o.points+r.points}),{volume:0,points:0});
    team.efficiency=team.volume?team.points/(team.volume*10):null;
    const players={};
    rows.forEach(r=>{const v=players[r.playerId]||(players[r.playerId]={volume:0,points:0});v.volume+=r.volume;v.points+=r.points;});
    Object.values(players).forEach(r=>{r.efficiency=r.volume?r.points/(r.volume*10):null;r.impact=team.volume?r.points/(team.volume*10):null;});
    return {team,players,foundations:FOUNDATIONS.slice()};
  }
  function fromActions(actions,players){
    const by=new Map();
    (players||[]).forEach(p=>FOUNDATIONS.forEach(action=>by.set(String(p.id)+'|'+action,{playerId:String(p.id),action,counts:[0,0,0,0]})));
    (actions||[]).forEach(a=>{
      if(!FOUNDATIONS.includes(a.action))return;
      const v=Number(a.value), weight=a.weight===undefined?1:Number(a.weight);
      if(!Number.isInteger(v)||v<0||v>3||!Number.isFinite(weight)||weight<=0)throw new Error('Acció invàlida');
      const key=String(a.playerId)+'|'+a.action;
      if(!by.has(key))by.set(key,{playerId:String(a.playerId),action:a.action,counts:[0,0,0,0]});
      by.get(key).counts[v]+=weight;
    });
    return aggregate([...by.values()]);
  }
  return Object.freeze({FOUNDATIONS,POINTS,grade,aggregate,fromActions});
});
