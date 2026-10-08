(async()=>{
'use strict';
const P=window.StatsPro2;
const T=window.StatsPro2Tactical;
if(!P) throw new Error('StatsPro2 no carregat');
if(!T) throw new Error('StatsPro2Tactical no carregat');
const VISUAL_ZONES=['4','3','2','5','6','1'];
const $=q=>document.querySelector(q), $$=q=>[...document.querySelectorAll(q)];
let engine=null, storage=null, adapter=null, localMode=null, positionsDraft=null, dragIndex=null, changeOutZone=null, tacticalLocks={};

function deep(x){return JSON.parse(JSON.stringify(x));}
function player(id){return engine.state.roster.snapshot.find(p=>p.playerId===id)||{playerId:id,name:id,number:''};}
function toast(msg){let t=$('.toast');if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t);}t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,1600);}
function modal(title,body,actions=[]){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;const box=$('#modalActions');box.innerHTML='';for(const a of actions){const b=document.createElement('button');b.textContent=a.text;b.className=a.cls||'';b.onclick=a.action;box.appendChild(b);}$('#modalLayer').hidden=false;}
function closeModal(){$('#modalLayer').hidden=true;}
function tacticalKey(){return engine?'pro2:tactical-locks:'+engine.state.identity.matchId:null;}
async function loadTacticalLocks(){const key=tacticalKey();if(!key||!adapter){tacticalLocks={};return;}const row=await adapter.get('settings',key);tacticalLocks=T.sanitizeLocks(row?.locks||{},engine.state.game.court);}
async function persistTacticalLocks(){const key=tacticalKey();if(!key||!adapter)return; tacticalLocks=T.sanitizeLocks(tacticalLocks,engine.state.game.court);await adapter.put('settings',key,{schemaVersion:1,matchId:engine.state.identity.matchId,locks:deep(tacticalLocks),updatedAt:new Date().toISOString()});}
async function clearTacticalLocks(){const key=tacticalKey();if(key&&adapter)await adapter.delete('settings',key);tacticalLocks={};}
async function persist(){if(storage&&engine.state.lifecycle.status==='active') await storage.saveActive(engine);}
function visualCourt(){return T.deriveVisualCourt(engine.state.game.court,tacticalLocks,{servingSide:engine.state.game.servingSide,phase:engine.state.game.phase});}
function regZoneOfPlayer(pid){return T.regulatoryZoneOf(engine.state.game.court,pid);}
async function toggleLockFor(pid,zone){if(tacticalLocks[pid]){delete tacticalLocks[pid];await persistTacticalLocks();render();toast('Fixació eliminada.');return;}const r=T.setLock(tacticalLocks,pid,zone,engine.state.game.court);if(!r.ok){toast('Aquesta zona ja està fixada per una altra jugadora.');return;}tacticalLocks=r.locks;await persistTacticalLocks();render();toast('Jugadora fixada a la zona '+zone+'.');}
async function reconcileStale(error,{forFinalize=false}={}){
 if(!error||error.code!=='STALE_ACTIVE_WRITE'||!storage||!engine) return false;
 try{
   const r=await storage.reconcileStaleActive(engine);
   if(r.status==='rebased-saved'){render();toast('Canvis desats sobre la revisió més nova.');return true;}
   if(r.status==='rebased'&&forFinalize){const archived=await storage.finalize(engine);await clearTacticalLocks();closeModal();render();finalSummary(archived);return true;}
   if(r.status==='refreshed'){engine=r.engine;render();toast('S’ha carregat la revisió més nova del partit.');return true;}
   if(r.status==='conflict'){
     engine=r.latestEngine;render();
     modal('Partit actualitzat en una altra còpia',`<p>Hi havia canvis més nous del mateix partit.</p><p>La teva branca local s’ha conservat com a conflicte <strong>${r.conflictId}</strong> i s’ha carregat la versió vigent. No s’han fusionat jugades automàticament.</p>`,[{text:'Continuar amb la versió vigent',cls:'primary',action:closeModal}]);
     return true;
   }
   if(r.status==='finalized'){modal('Partit ja finalitzat','<p>Aquest partit ja s’ha finalitzat des d’una altra còpia. No es crearà cap altre partit actiu.</p>',[{text:'Anar a Historial',cls:'primary',action:()=>location.href='../Historial/index.html'}]);return true;}
   return false;
 }catch(syncError){console.error(syncError);return false;}
}
async function run(fn){try{fn();render();await persist();}catch(e){if(await reconcileStale(e))return;toast(e.message||String(e));console.error(e);}}

function renderPlayers(ui){
 const g=$('#playerGrid');g.innerHTML='';
 const shown=(localMode==='POSITIONS'&&positionsDraft)?positionsDraft:visualCourt();
 VISUAL_ZONES.forEach((zone,i)=>{
   const pid=shown[zone]; const p=player(pid); const regZone=regZoneOfPlayer(pid)||zone;
   const lockZone=tacticalLocks[pid]||null; const isLocked=!!lockZone;
   const slot=document.createElement('div');slot.className='player-slot'+(localMode==='CANVI'?' change-mode':'')+(zone==='1'?' zone-one':'')+(localMode==='POSITIONS'?' position-mode':'')+(changeOutZone===regZone?' change-selected':'')+(isLocked?' tactical-locked':'');slot.dataset.index=i;slot.dataset.zone=zone;slot.dataset.regZone=regZone;slot.dataset.playerId=pid||'';
   const rg=document.createElement('div');rg.className='rating-grid';
   [0,1,2,3].forEach(v=>{const b=document.createElement('button');b.className='r'+v;b.textContent=v;b.type='button';
     b.disabled=!ui.canRate(regZone,v);
     b.onclick=e=>{e.stopPropagation();run(()=>engine.ratePlayer(regZone,v));};rg.appendChild(b);
   }); slot.appendChild(rg);
   if(zone==='1'){const ball=document.createElement('div');ball.className='server-ball';ball.hidden=!ui.serverBallVisible;slot.appendChild(ball);}
   const id=document.createElement('div');id.className='player-id';id.innerHTML=`<strong>${p.name}</strong><small>#${p.number??''}</small>`;slot.appendChild(id);
   if(isLocked&&localMode!=='POSITIONS'){const mark=document.createElement('span');mark.className='lock-mark';mark.textContent='🔒';mark.setAttribute('aria-label','Posició tàctica fixada');slot.appendChild(mark);}
   if(localMode==='CANVI'){const overlay=document.createElement('button');overlay.type='button';overlay.className='change-hit-area';overlay.setAttribute('aria-label','Canviar '+p.name);overlay.onclick=e=>{e.stopPropagation();chooseCourtForChange(regZone)};slot.appendChild(overlay);}
   if(localMode==='POSITIONS'){
      const lock=document.createElement('button');lock.type='button';lock.className='lock-toggle'+(isLocked?' active':'');lock.textContent=isLocked?'🔒':'🔓';lock.setAttribute('aria-label',isLocked?('Desfixar '+p.name+' (fixada a zona '+lockZone+')'):('Fixar '+p.name+' a zona '+zone));lock.onclick=async e=>{e.stopPropagation();await toggleLockFor(pid,zone);};slot.appendChild(lock);
      slot.onpointerdown=e=>{if(e.target.closest('.lock-toggle'))return;e.preventDefault();dragIndex=i;slot.setPointerCapture?.(e.pointerId);slot.classList.add('dragging');document.body.classList.add('position-dragging');};
      slot.onpointermove=e=>{if(dragIndex!==i)return;e.preventDefault();$$('.player-slot').forEach(x=>x.classList.remove('drop-target'));const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('.player-slot');if(el&&Number(el.dataset.index)!==i)el.classList.add('drop-target');};
      slot.onpointerup=e=>{if(dragIndex!==i)return;e.preventDefault();const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('.player-slot');const target=el?Number(el.dataset.index):i;$$('.player-slot').forEach(x=>x.classList.remove('dragging','drop-target'));document.body.classList.remove('position-dragging');dragIndex=null;if(Number.isInteger(target)&&target!==i){const za=VISUAL_ZONES[i],zb=VISUAL_ZONES[target];[positionsDraft[za],positionsDraft[zb]]=[positionsDraft[zb],positionsDraft[za]];render();}};
      slot.onpointercancel=()=>{dragIndex=null;$$('.player-slot').forEach(x=>x.classList.remove('dragging','drop-target'));document.body.classList.remove('position-dragging');};
   }
   g.appendChild(slot);
 });
}
function renderBlocks(ui){
 const g=$('#blockGrid');g.innerHTML='';const shown=visualCourt();
 ['4','3','2'].forEach(zone=>{const slot=document.createElement('div');slot.className='block-slot';const regZone=T.blockRegZoneForVisual(engine.state.game.court,shown,zone);const enabled=!!regZone&&ui.blocksEnabled;[['crimson',0,'0 · BLOQUEIG FORA'],['petrol',1,'1 · BLOQUEIG'],['emerald',2,'2 · BLOQUEIG + PUNT']].forEach(([c,v,t])=>{const b=document.createElement('button');b.className=c;b.textContent=t;b.disabled=!enabled;if(!regZone)b.title='La jugadora és reglamentàriament de segona línia';b.onclick=()=>run(()=>engine.block(regZone,v));slot.appendChild(b);});g.appendChild(slot);});
}
function render(){
 const s=engine.state, venue=s.metadata.venue, ui=P.buildCapa7UiState(engine,{localMode});
 $('#ownScoreZone').style.order=venue==='away'?'4':'2';$('#rivalScoreZone').style.order=venue==='away'?'2':'4';
 const vt=$('#venueTest');if(vt){vt.value=venue==='away'?'visitant':'local';vt.disabled=true;}
 $('#scoreHome').textContent=s.game.score.team;$('#scoreAway').textContent=s.game.score.rival;$('#setNumber').textContent=s.game.currentSet;$('#rivalName').textContent=s.metadata.opponent;$('#actionValue').textContent=ui.phaseLabel;$('#actionBox').disabled=!ui.phaseSkipEnabled;$('#actionBox').classList.toggle('skip-enabled',ui.phaseSkipEnabled);
 const dots=$('#setDots');dots.innerHTML='';for(let i=0;i<5;i++){const d=document.createElement('i'),r=s.game.sets[i];if(r?.winner==='team')d.className='won';else if(r?.winner==='rival')d.className='lost';else if(i===s.game.currentSet-1)d.className='active';dots.appendChild(d);}
 $('#undoBtn').disabled=!ui.undoEnabled;$('#undoLabel').textContent=ui.undoLabel;
 const camp=$('#rivalCourtBtn');camp.disabled=!ui.rivalCourtEnabled;camp.classList.toggle('enabled',ui.rivalCourtEnabled);
 $('#sosBtn').disabled=!ui.sosEnabled;$('#sosBtn').classList.toggle('active-mode',ui.sosActive);
 $('#positionsBtn').classList.toggle('active-mode',localMode==='POSITIONS');$('#changeBtn').classList.toggle('active-mode',localMode==='CANVI');
 renderPlayers(ui);renderBlocks(ui);
}
function togglePositions(){if(localMode==='POSITIONS'){const next=deep(positionsDraft);localMode=null;positionsDraft=null;run(()=>engine.changePositions(next));return;}if(localMode)return;localMode='POSITIONS';positionsDraft=deep(engine.state.game.court);render();}
function startChange(){if(localMode==='CANVI'){localMode=null;changeOutZone=null;render();return;}if(localMode)return;localMode='CANVI';changeOutZone=null;render();}
function chooseCourtForChange(zone){if(localMode!=='CANVI')return;changeOutZone=zone;openBench();}
function openBench(){const courtIds=Object.values(engine.state.game.court);const bench=engine.state.roster.snapshot.filter(p=>engine.state.roster.calledPlayerIds.includes(p.playerId)&&!courtIds.includes(p.playerId));const out=player(engine.state.game.court[changeOutZone]);modal(`Canvi · surt ${out.name}`,`<p>Selecciona la jugadora que entra.</p><div class="bench-grid">${bench.map(p=>`<button class="bench-card" data-in="${p.playerId}"><strong>${p.name}</strong><small>#${p.number}</small></button>`).join('')}</div>`,[{text:'Cancel·lar',action:closeModal}]);$$('#modalBody [data-in]').forEach(b=>b.onclick=()=>confirmChange(b.dataset.in));}
function confirmChange(inId){const outId=engine.state.game.court[changeOutZone],out=player(outId),inc=player(inId);modal('Confirmar canvi',`<p><strong>${out.name} → ${inc.name}</strong></p><p>La jugadora entrant ocuparà exactament la mateixa zona.</p>`,[{text:'Cancel·lar',action:()=>{closeModal();localMode=null;changeOutZone=null;render();}},{text:'Confirmar',cls:'primary',action:async()=>{closeModal();localMode=null;changeOutZone=null;await run(()=>engine.substitute(outId,inId));tacticalLocks=T.pruneInactive(tacticalLocks,engine.state.game.court);await persistTacticalLocks();render();}}]);}
function toggleSOS(){if(engine.state.flow.sos.status==='active'){run(()=>engine.undo());return;}run(()=>engine.activateSOS());}
function finishSet(){const s=engine.state;modal('Finalitzar set',`<p>Vols tancar el set ${s.game.currentSet} amb el marcador <strong>${s.game.score.team}–${s.game.score.rival}</strong>?</p>`,[{text:'Cancel·lar',action:closeModal},{text:'Finalitzar set',cls:'primary',action:async()=>{closeModal();await run(()=>engine.finishSet());if(engine.isMatchDecided()) offerFinishAfterDecidingSet();else setupSet();}}]);}
function offerFinishAfterDecidingSet(){const wins=engine.getSetWins();modal('Partit decidit',`<p>El partit ja té un guanyador per sets (<strong>${wins.team}–${wins.rival}</strong>).</p><p>Pots finalitzar-lo ara. No es prepararà cap set addicional.</p>`,[{text:'Desfer final de set',action:()=>{closeModal();run(()=>engine.undo());}},{text:'Finalitzar partit',cls:'danger',action:()=>{closeModal();finishMatch();}}]);}
function setupSet(){const called=engine.state.roster.snapshot.filter(p=>engine.state.roster.calledPlayerIds.includes(p.playerId));const opts=called.map(p=>`<option value="${p.playerId}">#${p.number} ${p.name}</option>`).join('');modal(`Preparar set ${engine.state.game.currentSet+1}`,`<p>Selecciona les sis jugadores, situa-les a les zones 1–6 i indica qui serveix.</p><div class="setup-zones">${VISUAL_ZONES.map((z,i)=>`<div class="setup-zone">Zona ${z}<select data-setup="${z}">${opts}</select></div>`).join('')}</div><div class="serve-choice"><label><input type="radio" name="serve" value="team"> Serveix Castellar</label><label><input type="radio" name="serve" value="rival" checked> Serveix rival</label></div>`,[{text:'Confirmar inici del set',cls:'primary',action:()=>{const court={};$$('[data-setup]').forEach(x=>court[x.dataset.setup]=x.value);if(new Set(Object.values(court)).size!==6){toast('Calen sis jugadores diferents.');return;}const servingSide=$('input[name="serve"]:checked').value;closeModal();run(()=>engine.startNextSet({court,servingSide}));}}]);$$('[data-setup]').forEach(x=>x.value=engine.state.game.court[x.dataset.setup]||called[0]?.playerId||'');}
function finishMatch(){modal('Finalitzar partit','<p>Aquesta acció tancarà definitivament el partit i l’eliminarà de Recuperar partit.</p>',[{text:'Cancel·lar',action:closeModal},{text:'Finalitzar partit',cls:'danger',action:async()=>{try{if(engine.state.lifecycle.status!=='finished') engine.finishMatch();const archived=await storage.finalize(engine);await clearTacticalLocks();closeModal();render();finalSummary(archived);}catch(e){if(await reconcileStale(e,{forFinalize:true}))return;toast('No s’ha pogut arxivar. El partit continua segur i pots tornar-ho a provar.');console.error(e);}}}]);}
function finalSummary(archived){modal('Partit finalitzat',`<div class="final-summary"><p>Partit arxivat pel motor Pro.2.</p><p><strong>Accions:</strong> ${archived.actionLog.actions.length}</p><p><strong>Jugadores amb estadística:</strong> ${archived.report.stats.players.length}</p></div>`,[{text:'Veure informe',cls:'primary',action:()=>location.href='../Informe/index.html?id='+encodeURIComponent(archived.matchId)},{text:'Inici',action:()=>location.href='../index.html'}]);}
function home(){
 modal('Tornar a Inici','<p>El partit es guardarà automàticament com a partit en curs i es podrà recuperar.</p>',[
  {text:'Cancel·lar',action:closeModal},
  {text:'Guardar i anar a Inici',cls:'primary',action:async()=>{try{await persist();closeModal();location.href='../index.html';}catch(e){toast(e.message||String(e));}}}
 ]);
}

async function boot(){
 adapter=new P.IndexedDBStorageAdapter();storage=new P.Pro2Storage(adapter);
 const resumeKey='StatsCastellarPro2_ResumeMatchId_v1';
 const resumeId=sessionStorage.getItem(resumeKey);
 if(resumeId){
   engine=await storage.loadActive(resumeId);
   if(!engine) sessionStorage.removeItem(resumeKey);
 }
 if(!engine){
   const current=await storage.getCurrentActive();
   if(!current) throw new Error('No hi ha cap partit actiu. Torna a Inici i crea un Nou partit.');
   engine=current.engine;
 }
 sessionStorage.removeItem(resumeKey);
 await loadTacticalLocks();
 $$('[data-score-team]').forEach(b=>b.onclick=()=>run(()=>Number(b.dataset.delta)>0?engine.manualPoint(b.dataset.scoreTeam==='home'?'team':'rival'):engine.manualMinus(b.dataset.scoreTeam==='home'?'team':'rival')));
 $('#actionBox').onclick=()=>run(()=>engine.advancePhase());$('#undoBtn').onclick=()=>run(()=>engine.undo());$('#rivalCourtBtn').onclick=()=>run(()=>engine.rivalCourt());$('#sosBtn').onclick=toggleSOS;$('#positionsBtn').onclick=togglePositions;$('#changeBtn').onclick=startChange;$('#homeBtn').onclick=home;$('#finishSetBtn').onclick=finishSet;$('#finishMatchBtn').onclick=finishMatch;$('#modalLayer').onclick=e=>{if(e.target===$('#modalLayer'))closeModal();};
 render();
}
boot().catch(e=>{console.error(e);alert('Error iniciant Pro.2: '+e.message);});
})();
