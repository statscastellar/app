(()=>{'use strict';
const d=Pro2DraftStore.current(),P=StatsPro2,$=x=>document.getElementById(x);
if(!d.completedSteps.step3||d.startingSixIds?.length!==6){$('app').innerHTML='<div class="message">No hi ha sis titulars vàlides desades al Pas 3.</div>';return;}
const six=d.rosterSnapshot.filter(p=>d.startingSixIds.includes(p.playerId)).map(p=>({id:p.playerId,name:p.name,num:p.number})),id=p=>String(p.id),byId=x=>six.find(p=>id(p)===x);
$('back').onclick=()=>location.href='../Capa9-3/index.html';
$('team').textContent=d.team.name;$('summaryTeam').textContent=d.team.name;$('summaryMatch').textContent=[d.match.opponent,d.match.date].filter(Boolean).join(' · ');
const masks={"1":"../assets/0c7896ba99c6a3e2.png","2":"../assets/1e6f9edd37042508.png","3":"../assets/800e03bc947924ec.png","4":"../assets/d09bec0e65fc33d5.png","5":"../assets/1485dbf42ccfe776.png","6":"../assets/bc1f1288f729904a.png"},centers={4:[29,38],3:[48,38],2:[68,38],5:[23,59],6:[49,59],1:[74,59]},order=[4,3,2,5,6,1];
let selected=null;
const spots={1:null,2:null,3:null,4:null,5:null,6:null};
if(d.positions&&Object.keys(d.positions).length===6)for(const z of Object.keys(spots))spots[z]=d.positions[z]||null;
const maskContexts={};
Promise.all(order.map(z=>new Promise(resolve=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=1448;c.height=1086;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);maskContexts[z]=ctx;resolve()};im.onerror=resolve;im.src=masks[z]}))).then(()=>{wireCourt();render()});
function zoneAt(x,y){
 const r=$('photo').getBoundingClientRect();
 if(x<r.left||x>r.right||y<r.top||y>r.bottom)return null;
 const px=Math.round((x-r.left)/r.width*1448),py=Math.round((y-r.top)/r.height*1086),hits=[];
 for(const z of order){const c=maskContexts[z];if(c&&px>=0&&py>=0&&px<1448&&py<1086&&c.getImageData(px,py,1,1).data[3]>50){const cx=r.left+r.width*centers[z][0]/100,cy=r.top+r.height*centers[z][1]/100;hits.push({z,d:Math.hypot(x-cx,y-cy)})}}
 hits.sort((a,b)=>a.d-b.d);return hits[0]?.z||null;
}
function place(z,pid=selected){
 if(!pid||!Object.prototype.hasOwnProperty.call(spots,z))return false;
 const prev=Object.keys(spots).find(k=>spots[k]===pid),disp=spots[z];
 if(prev===z){selected=null;render();return true;}
 spots[z]=pid;
 if(prev)spots[prev]=disp||null;
 selected=null;render();return true;
}
function ghostFor(pid){const p=byId(pid);if(!p)return null;const g=document.createElement('div');g.className='drag';g.textContent=p.num+' · '+p.name;document.body.append(g);return g}
function moveGhost(g,e){if(!g)return;g.style.left=e.clientX+'px';g.style.top=e.clientY+'px'}
function wirePoolDrag(el,pid){
 if(!pid)return;
 let start=null,ghost=null,dragging=false;
 const cleanup=()=>{ghost?.remove();ghost=null;start=null;dragging=false};
 el.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;e.preventDefault();start={x:e.clientX,y:e.clientY,p:e.pointerId};el.setPointerCapture?.(e.pointerId)});
 el.addEventListener('pointermove',e=>{if(!start||e.pointerId!==start.p)return;if(!dragging&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<9)return;if(!dragging){dragging=true;ghost=ghostFor(pid)}moveGhost(ghost,e)});
 el.addEventListener('pointerup',e=>{if(!start||e.pointerId!==start.p)return;const wasDragging=dragging,z=wasDragging?zoneAt(e.clientX,e.clientY):null;cleanup();if(wasDragging){if(z)place(z,pid);return}selected=selected===pid?null:pid;render()});
 el.addEventListener('pointercancel',cleanup);
}
function wireCourt(){
 const court=$('court');let start=null,ghost=null,dragging=false,sourcePid=null,sourceZone=null;
 const cleanup=()=>{ghost?.remove();ghost=null;start=null;dragging=false;sourcePid=null;sourceZone=null};
 court.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;const z=zoneAt(e.clientX,e.clientY);if(!z)return;e.preventDefault();sourceZone=z;sourcePid=spots[z]||null;start={x:e.clientX,y:e.clientY,p:e.pointerId};court.setPointerCapture?.(e.pointerId)});
 court.addEventListener('pointermove',e=>{if(!start||e.pointerId!==start.p||!sourcePid)return;if(!dragging&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<9)return;if(!dragging){dragging=true;ghost=ghostFor(sourcePid)}moveGhost(ghost,e)});
 court.addEventListener('pointerup',e=>{if(!start||e.pointerId!==start.p)return;const wasDragging=dragging,pid=sourcePid,z0=sourceZone,target=zoneAt(e.clientX,e.clientY);cleanup();if(wasDragging){if(pid&&target)place(target,pid);return}if(!z0)return;if(selected)place(z0,selected);else if(pid){selected=pid;render()}});
 court.addEventListener('pointercancel',cleanup);
}
function render(){
 const court=$('court');court.replaceChildren();
 for(const z of order){const p=byId(spots[z]),b=document.createElement('div');b.className='zone'+(p?' filled':'')+(selected&&p&&selected===id(p)?' selected':'');b.dataset.zone=z;b.style.setProperty('--mask',`url("${masks[z]}")`);b.style.setProperty('--x',centers[z][0]+'%');b.style.setProperty('--y',centers[z][1]+'%');const hit=document.createElement('span');hit.className='hit';const tag=document.createElement('span');tag.className='tag';if(p){const num=document.createElement('strong'),name=document.createElement('em');num.textContent=p.num;name.textContent=p.name;tag.append(num,name)}b.append(hit,tag);court.append(b)}
 const list=$('players');list.replaceChildren();
 for(const p of six){const pid=id(p),b=document.createElement('button');b.type='button';b.className='player'+(selected===pid?' active':'')+(Object.values(spots).includes(pid)?' placed':'');const a=document.createElement('strong'),n=document.createElement('span');a.textContent=p.num;n.textContent=p.name;b.append(a,n);wirePoolDrag(b,pid);list.append(b)}
 const count=Object.values(spots).filter(Boolean).length;$('status').textContent=count+' de 6 col·locades';$('save').disabled=count!==6;$('selectedInfo').textContent=selected?'Seleccionada: '+byId(selected).name+'. Toca una zona.':'Arrossega una jugadora o toca-la i després toca una zona.';
}
$('reset').onclick=()=>{for(const z of Object.keys(spots))spots[z]=null;selected=null;render()};
const serveDialog=$('serveDialog'),serveDialogInfo=$('serveDialogInfo'),serveChoices=$('serveChoices'),serveAccept=$('serveAccept'),serveConfirmStep=$('serveConfirmStep'),serveConfirmText=$('serveConfirmText');
let selectedServeSide=null;
function setServeSelection(side){
 selectedServeSide=side;
 serveDialog.querySelectorAll('[data-side]').forEach(b=>b.classList.toggle('selected',b.dataset.side===side));
 serveAccept.disabled=!side;
}
function resetServeDialog(){
 setServeSelection(null);
 serveChoices.hidden=false;
 serveAccept.parentElement.hidden=false;
 serveConfirmStep.hidden=true;
}
function openServeDialog(){
 if(Object.values(spots).filter(Boolean).length!==6)return;
 resetServeDialog();
 const server=spots['1']?byId(spots['1']):null;
 serveDialogInfo.textContent=server?'Si serveix Castellar, començarà #'+server.num+' '+server.name+' des de zona 1.':'Tria qui començarà servint.';
 serveDialog.hidden=false;
 requestAnimationFrame(()=>serveDialog.classList.add('open'));
}
function closeServeDialog(){serveDialog.classList.remove('open');setTimeout(()=>{serveDialog.hidden=true;resetServeDialog()},120)}
function showServeConfirmation(){
 if(!selectedServeSide)return;
 const server=spots['1']?byId(spots['1']):null;
 const who=selectedServeSide==='team'?'CASTELLAR':'RIVAL';
 serveConfirmText.textContent=selectedServeSide==='team'&&server?'Has indicat que comença servint CASTELLAR, amb #'+server.num+' '+server.name+' a zona 1. Ho confirmes?':'Has indicat que comença servint '+who+'. Ho confirmes?';
 serveChoices.hidden=true;
 serveAccept.parentElement.hidden=true;
 serveConfirmStep.hidden=false;
}
async function startMatch(serveSide){
 closeServeDialog();
 d.positions=Object.fromEntries(Object.entries(spots));
 d.initialServe={side:serveSide,serverPlayerId:serveSide==='team'?spots['1']:null};
 d.completedSteps.step4=true;
 Pro2DraftStore.save(d);
 try{
  const storage=new P.Pro2Storage(new P.IndexedDBStorageAdapter());
  if(d.flowMode==='nextSet'){
   if(!d.activeMatchId) throw new Error('Falta l’identificador del partit actiu.');
   const engine=await storage.loadActive(d.activeMatchId);
   if(!engine) throw new Error('No s’ha trobat el partit actiu que s’estava preparant.');
   if(!engine.canStartNextSet()) throw new Error('El partit no té cap set pendent d’iniciar.');
   engine.startNextSet({court:d.positions,servingSide:serveSide});
   await storage.saveActive(engine);
   sessionStorage.setItem('StatsCastellarPro2_ResumeMatchId_v1',engine.state.identity.matchId);
   Pro2DraftStore.clear();
   location.href='../Capa7/index.html';
   return;
  }
  const made=P.createMatchFromDraft(d,{matchId:crypto.randomUUID()});
  const engine=new P.MatchEngine(made.state,made.actionLog);
  await storage.saveActive(engine);
  sessionStorage.setItem('StatsCastellarPro2_ResumeMatchId_v1',made.state.identity.matchId);
  Pro2DraftStore.clear();
  location.href='../Capa7/index.html';
 }catch(e){$('done').textContent=(d.flowMode==='nextSet'?'No s’ha pogut iniciar el set següent: ':'No s’ha pogut crear el partit: ')+e.message;$('done').hidden=false;}
}
$('save').onclick=openServeDialog;
serveDialog.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>setServeSelection(b.dataset.side));
serveAccept.onclick=showServeConfirmation;
$('serveConfirm').onclick=()=>{if(selectedServeSide)startMatch(selectedServeSide)};
$('serveBack').onclick=()=>{serveConfirmStep.hidden=true;serveChoices.hidden=false;serveAccept.parentElement.hidden=false};
$('serveCancel').onclick=closeServeDialog;
serveDialog.addEventListener('click',e=>{if(e.target===serveDialog)closeServeDialog()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!serveDialog.hidden)closeServeDialog()});
})();
