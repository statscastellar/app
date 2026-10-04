/* Contracte de preparació Pro.1: funció pura, sense accés al navegador. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.StatsPreparation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function validate(match,selection,court,convocation){
 const errors=[];const arr=Array.isArray;const id=p=>String(p?.id??'');
 if(!match||typeof match!=='object'||!String(match.opponent||'').trim()||!/^\d{4}-\d{2}-\d{2}$/.test(match.date||''))errors.push('Dades de partit incompletes (rival o data)');
 if(!selection||!arr(selection.startingSix)||selection.startingSix.length!==6)errors.push('Calen sis titulars al Pas 3');
 if(!court||!arr(court.positions)||court.positions.length!==6)errors.push('Calen sis posicions al Pas 4');
 const six=arr(selection?.startingSix)?selection.startingSix:[],pos=arr(court?.positions)?court.positions:[];
 const sixIds=six.map(id),ids=pos.map(x=>id(x?.player)),zones=pos.map(x=>Number(x?.zone));
 if(sixIds.some(x=>!x)||new Set(sixIds).size!==6)errors.push('Titulars repetides o sense identificador');
 if(zones.length!==6||new Set(zones).size!==6||zones.some(x=>!Number.isInteger(x)||x<1||x>6))errors.push('Les zones han de ser 1–6, sense repetir');
 if(ids.length!==6||new Set(ids).size!==6||ids.some(x=>!x||!sixIds.includes(x)))errors.push('Les jugadores de pista no coincideixen amb les sis titulars');
 if(match?.team&&selection?.team&&match.team!==selection.team)errors.push('Equip diferent entre els passos 1 i 3');
 if(court?.team&&selection?.team&&court.team!==selection.team)errors.push('Equip diferent entre els passos 3 i 4');
 if(convocation){const called=convocation.called;if(!arr(called)||sixIds.some(x=>!called.some(p=>id(p)===x)))errors.push('Les titulars no coincideixen amb la convocatòria del Pas 2');if(convocation.team&&selection?.team&&convocation.team!==selection.team)errors.push('Equip diferent al Pas 2');}
 return {ok:errors.length===0,errors,payload:errors.length?null:{schemaVersion:1,match,selection,positions:pos}};
}
return {validate};
});
