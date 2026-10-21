/* Stats Castellar — gestor declaratiu de geometria tàctica.
 * Prova aïllada: no altera motor, rotació, desfer ni persistència.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.StatsTacticsLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const REG_ZONES=Object.freeze(['1','2','3','4','5','6']);
const layouts=Object.freeze({
  '3-3':Object.freeze({label:'Habitual · 3+3',visualOrder:['4','3','2','5','6','1'],front:['4','3','2'],behind:['5','6','1'],vertical:[]}),
  'penetration-z1':Object.freeze({label:'Penetració Z1 · 4+2',visualOrder:['4','3','1','2','5','6'],front:['4','3','1','2'],behind:['5','6'],vertical:['4','2']})
});
function assertLayout(key){if(!Object.prototype.hasOwnProperty.call(layouts,key))throw new Error('Disposició no permesa: '+key);return layouts[key];}
// The selected tactic persists; its geometry follows the current rally phase.
function effectiveLayout(key,phase){
 assertLayout(key);
 // RECEPCIO represents an opponent serve already executed (no separate serve event).
 // Once the set is rated the engine advances to ATAC: Z1 returns to defend.
 return key==='penetration-z1'&&['RECEPCIO','COLLOCACIO'].includes(phase)?'penetration-z1':'3-3';
}
function placeZ1(court,visual){
 const out={...visual},id=court?.['1'];
 const from=REG_ZONES.find(z=>out[z]===id);
 if(id&&from&&from!=='1'){out[from]=out['1'];out['1']=id;}
 return out;
}
function describe(key,court,visual){const spec=assertLayout(key);const pos=visual||court||{};return {key,label:spec.label,slots:spec.visualOrder.map(zone=>({zone,playerId:pos[zone]||null,regulatoryZone:REG_ZONES.find(z=>court?.[z]===pos[zone])||null,row:spec.front.includes(zone)?'front':'behind',orientation:spec.vertical.includes(zone)?'vertical':'square'}))};}
function validate(descriptor){const zones=descriptor.slots.map(x=>x.zone);if(zones.length!==6||new Set(zones).size!==6||!REG_ZONES.every(z=>zones.includes(z)))throw new Error('Calen les sis zones sense duplicats');const ids=descriptor.slots.map(x=>x.playerId).filter(Boolean);if(new Set(ids).size!==ids.length)throw new Error('Jugadora duplicada');return true;}
function canBlock(slot){return ['2','3','4'].includes(slot.regulatoryZone);}
return Object.freeze({layouts,assertLayout,effectiveLayout,placeZ1,describe,validate,canBlock});
});
