'use strict';
// Proves de regressió independents de l'aplicació publicada.
// Execució: node tests/tactics-z1-6-2.test.js
const assert=require('node:assert/strict');
const L=require('../Capa7/js/tactics-layout.js');
const base={1:'p1',2:'p2',3:'p3',4:'p4',5:'p5',6:'p6'};
const receipt=id=>[{type:'RECEPCIO',data:{playerId:id,zone:'5',value:2}}];
const defense=id=>[{type:'DEFENSA',data:{playerId:id,zone:'6',value:2}}];
let total=0;
function equal(actual,expected,label){assert.equal(actual,expected,label);total++;}
function state(key,phase,court=base,setters=[],actions=[]){return L.effectiveLayout(key,phase,{court,setters,actions});}
equal(state('penetration-z1','RECEPCIO'), '3-3','Z1 en recepció');
equal(state('penetration-z1','DEFENSA'), '3-3','Z1 en defensa');
equal(state('penetration-z1','SERVEI'), '3-3','Z1 en servei');
equal(state('penetration-z1','COLLOCACIO',base,[],receipt('p5')),'penetration-z1','Z1 col·loca quan no rep');
equal(state('penetration-z1','COLLOCACIO',base,[],receipt('p1')),'3-3','Z1 no col·loca després de rebre');
equal(state('penetration-z1','COLLOCACIO',base,[],defense('p1')),'3-3','Z1 no col·loca després de defensar');
equal(state('penetration-z1','ATAC'),'3-3','Z1 torna després de col·locar');
equal(state('3-3','COLLOCACIO'),'3-3','Habitual sense penetració');
const zones=['1','6','5','4','3','2'];
for(let k=0;k<6;k++){
 const z=zones[k],opp=String(((Number(z)+2)%6)+1);
 const court={...base,[z]:'colA',[opp]:'colB'};
 const active=['1','5','6'].includes(z)?z:opp;
 const activeId=court[active];
 const setters=['colA','colB'];
 equal(L.activeSetterZone(court,setters),active,'Rotació '+(k+1)+' identifica col·locadora');
 equal(state('6-2','RECEPCIO',court,setters),'3-3','Rotació '+(k+1)+' recepció');
 equal(state('6-2','DEFENSA',court,setters),'3-3','Rotació '+(k+1)+' defensa');
 equal(state('6-2','COLLOCACIO',court,setters,receipt('p3')),'penetration-z'+active,'Rotació '+(k+1)+' penetració');
 equal(state('6-2','COLLOCACIO',court,setters,receipt(activeId)),'3-3','Rotació '+(k+1)+' primer toc col·locadora');
 equal(state('6-2','COLLOCACIO',court,setters,defense(activeId)),'3-3','Rotació '+(k+1)+' primera defensa col·locadora');
 equal(state('6-2','ATAC',court,setters),'3-3','Rotació '+(k+1)+' retorn');
}
equal(state('6-2','COLLOCACIO',base,['p1','p3']),'3-3','No acceptar col·locadores no oposades');
equal(state('6-2','COLLOCACIO',base,['p1','p1']),'3-3','No acceptar duplicats');
equal(state('6-2','COLLOCACIO',base,['p1','p4'],[{type:'POINT'},...receipt('p1')]),'3-3','Respectar primera recepció');
for(const z of ['1','5','6']){
 const model=L.describe('penetration-z'+z,base);
 equal(L.validate(model),true,'Sense jugadores duplicades Z'+z);
 equal(model.slots.filter(x=>x.row==='front').length,4,'4 visuals davant Z'+z);
 equal(model.slots.filter(x=>x.row==='behind').length,2,'2 visuals darrere Z'+z);
 equal(model.slots.find(x=>x.zone===z).regulatoryZone,z,'La identitat reglamentària no canvia Z'+z);
 equal(L.canBlock(model.slots.find(x=>x.zone===z)),false,'La col·locadora del darrere no pot bloquejar Z'+z);
}
console.log('OK: '+total+' comprovacions tàctiques.');
