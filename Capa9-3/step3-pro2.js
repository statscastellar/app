(()=>{'use strict';
const d=Pro2DraftStore.current();
const $=id=>document.getElementById(id);
const scene=document.querySelector('.scene');
const overlay=$('player-overlay');
const grid=$('grid');
const count=$('count');
if(!d.completedSteps.step2||!Array.isArray(d.calledPlayerIds)||d.calledPlayerIds.length<6){count.textContent='Falta la convocatòria';return;}
const players=d.rosterSnapshot
  .filter(p=>d.calledPlayerIds.includes(p.playerId))
  .map(p=>({id:p.playerId,name:p.name,num:p.number}))
  .sort((a,b)=>a.num-b.num||String(a.name).localeCompare(String(b.name),'ca'));
const chosen=new Set((d.flowMode==='nextSet'?[]:(d.startingSixIds||[])).filter(id=>d.calledPlayerIds.includes(id)));
const visual=Pro2VisualProfiles.resolve(d.team||{});
d.team.visualProfile=visual;
d.team.gameFormat=d.team.gameFormat||{format:'volleyball-6x6',playersOnCourt:6,minivolleyEnabled:false};
Pro2DraftStore.save(d);
document.documentElement.dataset.visualProfile=visual.profileId;
document.documentElement.dataset.visualAssetStatus=visual.assetStatus||'ready';
document.querySelector('.scene').style.backgroundImage=`linear-gradient(rgba(7,11,15,.12),rgba(7,11,15,.13)),url("../assets/${visual.backgroundKey}")`;
const SLOT_REGIONS=[
  {x:115,y:145,w:245,h:425,row:'top'},{x:350,y:140,w:235,h:430,row:'top'},{x:598,y:130,w:237,h:435,row:'top'},{x:839,y:132,w:238,h:435,row:'top'},{x:1070,y:140,w:230,h:428,row:'top'},{x:1300,y:140,w:240,h:425,row:'top'},
  {x:188,y:410,w:255,h:420,row:'bottom'},{x:430,y:410,w:250,h:420,row:'bottom'},{x:680,y:414,w:250,h:420,row:'bottom'},{x:925,y:414,w:245,h:420,row:'bottom'},{x:1150,y:414,w:245,h:420,row:'bottom'},{x:1390,y:412,w:245,h:420,row:'bottom'}
];
const LABEL_POINTS=[
  {x:225,y:350,row:'top'},{x:462,y:350,row:'top'},{x:716,y:350,row:'top'},{x:958,y:350,row:'top'},{x:1186,y:350,row:'top'},{x:1416,y:350,row:'top'},
  {x:320,y:612,row:'bottom'},{x:560,y:612,row:'bottom'},{x:805,y:612,row:'bottom'},{x:1047,y:612,row:'bottom'},{x:1270,y:612,row:'bottom'},{x:1510,y:612,row:'bottom'}
];
const IMAGE_W=1672, IMAGE_H=941;
const slots=[];
function imageBox(){
  const rect=scene.getBoundingClientRect();
  const fit=(matchMedia('(orientation:portrait)').matches)?'contain':'cover';
  const scale=fit==='contain'?Math.min(rect.width/IMAGE_W,rect.height/IMAGE_H):Math.max(rect.width/IMAGE_W,rect.height/IMAGE_H);
  const drawW=IMAGE_W*scale, drawH=IMAGE_H*scale;
  const left=(rect.width-drawW)/2, top=(rect.height-drawH)/2;
  return {left,top,width:drawW,height:drawH,scale};
}
function fitText(el,minPx,maxPx){
  if(!el) return;
  el.style.fontSize=maxPx+'px';
  while(el.scrollWidth>el.clientWidth && maxPx>minPx){maxPx-=1;el.style.fontSize=maxPx+'px';}
}
function renderOverlay(){
  overlay.innerHTML='';
  const dynamic=visual.overlayMode==='dynamic';
  players.slice(0,SLOT_REGIONS.length).forEach((p,i)=>{
    const slot=document.createElement('button');
    const region=SLOT_REGIONS[i], point=LABEL_POINTS[i];
    slot.type='button';
    slot.className=`slot-hit row-${region.row}`+(chosen.has(p.id)?' selected':'');
    slot.dataset.playerId=p.id;slot.dataset.slotIndex=String(i);
    slot.setAttribute('aria-label',`Seleccionar ${p.name}`);
    slot.onclick=()=>toggle(p.id);
    if(dynamic){
      const label=document.createElement('span');label.className='slot-label';
      const name=document.createElement('span');name.className='slot-name';name.textContent=p.name;
      const num=document.createElement('span');num.className='slot-num';num.textContent=p.num;
      label.append(name,num);slot.append(label);
    }
    overlay.append(slot);
    slots[i]={el:slot,region,point,player:p};
  });
  layoutSlots();
}
function layoutSlots(){
  const box=imageBox();
  slots.forEach((slotObj,i)=>{
    if(!slotObj) return;
    const {el,region,point}=slotObj;
    const left=box.left + region.x*box.scale;
    const top=box.top + region.y*box.scale;
    const width=region.w*box.scale;
    const height=region.h*box.scale;
    el.style.left=left+'px';
    el.style.top=top+'px';
    el.style.width=width+'px';
    el.style.height=height+'px';
    const label=el.querySelector('.slot-label');
    if(label){
      label.style.left=(box.left + point.x*box.scale)+'px';
      label.style.top=(box.top + point.y*box.scale)+'px';
      label.style.width=((region.row==='top'?90:96)*box.scale)+'px';
      const name=label.querySelector('.slot-name');
      const num=label.querySelector('.slot-num');
      const topRow=region.row==='top';
      name.style.maxWidth='100%';
      name.style.height='1.2em';
      num.style.fontSize=(topRow?40:36)*box.scale+'px';
      name.style.fontSize=(topRow?15:14)*box.scale+'px';
      fitText(name,Math.max(9,10*box.scale),Math.max(11,(topRow?15:14)*box.scale));
    }
  });
}
function toggle(id){if(chosen.has(id))chosen.delete(id);else if(chosen.size<6)chosen.add(id);render();}
const go=document.createElement('button');go.id='c9-go';go.type='button';$('clear').after(go);
function render(){
  grid.replaceChildren();
  for(const p of players){
    const b=document.createElement('button');b.type='button';b.className='tile'+(chosen.has(p.id)?' selected':'');b.setAttribute('aria-pressed',String(chosen.has(p.id)));
    const a=document.createElement('div');a.className='inline-player';
    const n=document.createElement('div');n.className='num';n.textContent=p.num+' - '+p.name;a.append(n);b.append(a);b.onclick=()=>toggle(p.id);grid.append(b)
  }
  slots.forEach(s=>{if(s?.el)s.el.classList.toggle('selected',chosen.has(s.player.id));});
  count.textContent=`${chosen.size} de 6 titulars`;
  go.disabled=chosen.size!==6;
  go.textContent=chosen.size===6?'Col·locar a pista ›':'Selecciona 6 titulars';
}
$('clear').onclick=()=>{chosen.clear();render()};
go.onclick=()=>{if(chosen.size!==6)return;d.startingSixIds=players.filter(p=>chosen.has(p.id)).map(p=>p.id);d.positions={};d.initialServe={side:'rival',serverPlayerId:null};d.completedSteps.step3=true;d.completedSteps.step4=false;Pro2DraftStore.save(d);location.href='../Capa9-4/index.html';};
document.querySelector('.back').onclick=()=>{if(d.flowMode==='nextSet'){sessionStorage.setItem('StatsCastellarPro2_ResumeMatchId_v1',d.activeMatchId||'');location.href='../Capa7/index.html';}else location.href='../Capa9-2/index.html';};
Pro2RenderMatchInfo(document.querySelector('.info'),d);
const stageTitle=document.querySelector('.stage-subtitle');if(stageTitle)stageTitle.textContent='PAS 3 · SIS INICIAL';
const strong=document.querySelector('.instruction strong'),small=document.querySelector('.instruction small');
if(strong)strong.textContent='Selecciona el sis inicial';
if(small)small.textContent='Marca les 6 jugadores o jugadors';
addEventListener('resize',layoutSlots);
renderOverlay();
render();
})();
