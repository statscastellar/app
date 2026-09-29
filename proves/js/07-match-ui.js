(()=>{
 const root=document.querySelector('#scoring .prototype'); if(!root)return;
 const slots=[...root.querySelectorAll('.player-slot')];
 const cur=root.querySelector('#provaCurrentAction')||root.querySelector('.action-final strong');
 const last=root.querySelector('#provaLastAction');
 const rescue=root.querySelector('#rescueBtn'); const note=root.querySelector('#rescueNote');
 let action='Servei', server='castellar', rescueMode=false, pendingZero=null, rescueSnapshot=null, swapMode=false, pendingSwapUI=null;
 const uiHistory=[]; const pushUI=(description='Última operació',extra={})=>{uiHistory.push({action,server,pendingZero:pendingZero?{...pendingZero}:null,rescueMode,description,...extra});updateUndoLabel();persistUI();};
 const posOrder=['4','3','2','5','6','1'];
 const txt=(el,t)=>{if(el)el.textContent=t};
const UI_STATE_KEY='statsCastellar_PROVA_MatchUIStateV2';
 function uiSnapshot(){const st=window.__statsProvaEngine?.state?.();return {matchId:st?.id||null,action,server,pendingZero,rescueMode,rescueSnapshot,uiHistory:uiHistory.slice(-100)}}
 function persistUI(){try{localStorage.setItem(UI_STATE_KEY,JSON.stringify(uiSnapshot()))}catch(_){}}
 function clearUIState(){try{localStorage.removeItem(UI_STATE_KEY)}catch(_){}}
 function restoreUI(){let x=null;try{x=JSON.parse(localStorage.getItem(UI_STATE_KEY)||'null')}catch(_){}const st=window.__statsProvaEngine?.state?.();if(!x||!st||x.matchId!==st.id)return false;action=x.action||action;server=x.server||server;pendingZero=x.pendingZero||null;rescueMode=!!x.rescueMode;rescueSnapshot=x.rescueSnapshot||null;uiHistory.length=0;if(Array.isArray(x.uiHistory))x.uiHistory.slice(-100).forEach(v=>uiHistory.push(v));return true}
 const undoWhat=root.querySelector('#provaUndoWhat');
 function updateUndoLabel(){const item=uiHistory[uiHistory.length-1];txt(undoWhat,item?.description||'res per desfer');root.querySelector('.undo-final')?.classList.toggle('no-undo',!item);}
 function playerLabel(i){const id=slots[i]?.querySelector('.player-id');const n=id?.querySelector('strong')?.textContent?.trim()||'jugadora';return n;}
 function syncPlayers(){
   const st=window.__statsProvaEngine?.state?.();
   if(!st)return;
   const byId=new Map((st.players||[]).map(pl=>[String(pl.id),pl]));
   slots.forEach((slot,i)=>{
     const id=st.positions&&st.positions[posOrder[i]], pl=byId.get(String(id));
     if(!pl)return;
     const strong=slot.querySelector('.player-id strong'), small=slot.querySelector('.player-id small');
     txt(strong,String(pl.name||'').toUpperCase()); txt(small,'#'+String(pl.number??''));
   });
 }
 function scores(){const st=window.__statsProvaEngine?.state?.();if(st)return [Number(st.scores.castellar)||0,Number(st.scores.rival)||0];const l=document.getElementById('leftScore'),r=document.getElementById('rightScore'),ln=document.getElementById('leftTeamName'); const castLeft=(ln&&ln.textContent.trim()==='Castellar'); return castLeft?[Number(l?.textContent)||0,Number(r?.textContent)||0]:[Number(r?.textContent)||0,Number(l?.textContent)||0]}
 function sync(){
   syncPlayers(); const st=window.__statsProvaEngine?.state?.(); if(st){server=st.serving||server;}
   const sc=scores(); const boxes=root.querySelectorAll('.scorebox .score'); if(boxes[0])boxes[0].textContent=sc[0];if(boxes[1])boxes[1].textContent=sc[1];
   const rivalLabel=root.querySelector('.scorebox.rival .eyebrow'); if(rivalLabel)rivalLabel.textContent=(st&&st.opponent)?st.opponent:'RIVAL';
   const set=document.getElementById('liveSet'); const n=(st&&Number(st.set))||Number((set?.textContent||'1').replace(/\D/g,''))||1; const se=root.querySelector('.setbox strong');if(se)se.textContent=n;
   txt(cur,rescueMode?'🆘 SALVADA':action.toUpperCase());
   rescue?.classList.toggle('active',rescueMode); rescue?.setAttribute('aria-pressed',String(rescueMode)); note?.classList.toggle('show',rescueMode);
   slots.forEach((s,i)=>{s.classList.toggle('serving',server==='castellar'&&action==='Servei'&&posOrder[i]==='1'); let b=s.querySelector('.server-ball');if(server==='castellar'&&action==='Servei'&&posOrder[i]==='1'){if(!b){b=document.createElement('div');b.className='server-ball';s.prepend(b)}}else if(b)b.remove()});
   persistUI();
 }
 function clickLegacy(i,a,v){
   const eng=window.__statsProvaEngine;
   if(!eng||typeof eng.recordByPosition!=='function')return false;
   return !!eng.recordByPosition(posOrder[i],a,v);
 }
 function next(a,v){
   if(a==='Servei'){if(v===0){server='rival';action='Recepció'}else if(v===3){server='castellar';action='Servei'}else action='Defensa'}
   else if(a==='Recepció'||a==='Defensa'){if(v===0){server='rival';action='Recepció'}else action='Col·locació'}
   else if(a==='Col·locació'){action=v===0?'Recepció':'Atac';if(v===0)server='rival'}
   else if(a==='Atac'){if(v===0){server='rival';action='Recepció'}else if(v===3){server='castellar';action='Servei'}else action='Defensa'}
 }
 slots.forEach((slot,i)=>slot.querySelectorAll('.rating').forEach(r=>r.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const v=Number(r.textContent.trim());if(rescueMode){pushUI('Salvada · '+playerLabel(i)+' · '+v,{kind:'salvada'});const saved=v===0?window.__statsProvaEngine?.recordSalvadaZero?.(posOrder[i]):clickLegacy(i,'Salvada',v);if(!saved){uiHistory.pop();updateUndoLabel();return;}rescueMode=false;pendingZero=null;if(v===0){const st=window.__statsProvaEngine?.state?.();server=st?.serving||'rival';action=server==='castellar'?'Servei':'Recepció';}else{action='Col·locació';}txt(last,'Salvada '+v+' registrada'+(v===0?' · punt rival':' · continua → Col·locació'));setTimeout(sync,10);return} const a=action;pushUI(a+' · '+playerLabel(i)+' · '+v);if(!clickLegacy(i,a,v)){uiHistory.pop();updateUndoLabel();return;} if((a==='Recepció'||a==='Defensa')&&v===0)pendingZero={i,a};else pendingZero=null;next(a,v);txt(last,a+' '+v);setTimeout(sync,10)})));
 slots.slice(0,3).forEach((slot,i)=>slot.querySelectorAll('.block-control .b').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const v=Number(b.querySelector('strong')?.textContent);pushUI('Bloqueig · '+playerLabel(i)+' · '+v);clickLegacy(i,'Bloqueig',v);action=v===1?'Defensa':(v===2?'Servei':'Recepció');server=v===2?'castellar':(v===0?'rival':server);txt(last,'Bloqueig '+v);setTimeout(sync,10)})));
 rescue?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(rescueMode){
 const sos=uiHistory[uiHistory.length-1];
 if(sos?.kind==='sos'&&sos.zero){
   window.__statsProvaEngine?.undo?.();
   clickLegacy(sos.zero.i,sos.zero.a,0);
   uiHistory.pop();
   action=sos.action;server=sos.server;pendingZero=sos.pendingZero;rescueMode=sos.rescueMode;
   updateUndoLabel();txt(last,'🆘 cancel·lat · estat anterior restaurat');setTimeout(sync,10);return;
 }
 rescueMode=false;pendingZero=null;sync();return
}if(!pendingZero){if(note){note.textContent='🆘 només disponible després d’una Recepció 0 o Defensa 0';note.classList.add('show');setTimeout(()=>{if(!rescueMode)note.classList.remove('show')},1300)}return}const sosZero={...pendingZero};pushUI('SOS · activar salvada',{kind:'sos',zero:sosZero});window.__statsProvaEngine?.undo?.();window.__statsProvaSuppressAward=true;clickLegacy(sosZero.i,sosZero.a,0);window.__statsProvaSuppressAward=false;rescueSnapshot={...sosZero};pendingZero={...sosZero};rescueMode=true;txt(last,'🆘 actiu · 0 conservat i punt rival anul·lat · selecciona la salvadora');setTimeout(sync,10)});
 const campRival=()=>{pushUI('Camp rival',{kind:'ui-only'});action='Defensa';pendingZero=null;rescueMode=false;txt(last,'CAMP RIVAL → Defensa');sync()};
 root.querySelector('.rival-touch-zone')?.addEventListener('click',campRival);
 root.querySelector('.rival-label')?.addEventListener('click',campRival);

 const visualScores=root.querySelectorAll('.scorebox');visualScores.forEach((box,idx)=>{
   box.querySelector('.plus')?.addEventListener('click',e=>{
     e.preventDefault();e.stopPropagation();
     const side=idx===0?'castellar':'rival';
     pushUI('Punt '+(side==='castellar'?'Castellar':'rival'));
     const ok=window.__statsProvaEngine?.manualPoint?.(side,1);
     if(!ok){uiHistory.pop();updateUndoLabel();return;}
     /* Un + és el final real del rally. El motor decide servei/rotació;
        la Capa 7 només deriva la següent acció del servei resultant. */
     const st=window.__statsProvaEngine?.state?.();
     if(st){server=st.serving;action=server==='castellar'?'Servei':'Recepció';}
     pendingZero=null;rescueMode=false;
     txt(last,'PUNT MANUAL '+(side==='castellar'?'CASTELLAR':'RIVAL')+' · '+(server==='castellar'?'servei Castellar':'servei rival'));
     setTimeout(sync,10);
   });
   box.querySelector('.minus')?.addEventListener('click',e=>{
     e.preventDefault();e.stopPropagation();const side=idx===0?'castellar':'rival';pushUI('Correcció marcador · −1 '+(side==='castellar'?'Castellar':'rival'));
     const ok=window.__statsProvaEngine?.manualPoint?.(side,-1);
     if(!ok){uiHistory.pop();updateUndoLabel();}
     setTimeout(sync,10);
   });
 });


 slots.forEach((slot,i)=>slot.querySelector('.player-id')?.addEventListener('click',e=>{if(!swapMode)return;e.preventDefault();e.stopPropagation();swapMode=false;root.querySelector('.swap')?.classList.remove('active');pendingSwapUI={action,server,pendingZero:pendingZero?{...pendingZero}:null,rescueMode,description:'Canvi · surt '+playerLabel(i)};const ok=window.__statsProvaEngine?.substituteByPosition?.(posOrder[i]);if(!ok)pendingSwapUI=null;}));
 document.addEventListener('stats-substitution-completed',()=>{if(!pendingSwapUI)return;uiHistory.push(pendingSwapUI);pendingSwapUI=null;updateUndoLabel();persistUI();});
 const cancelSub=document.getElementById('cancelSubstitution');if(cancelSub)cancelSub.addEventListener('click',()=>{pendingSwapUI=null});
 const subModal=document.getElementById('substitutionModal');subModal?.querySelector('.app-modal-backdrop')?.addEventListener('click',()=>{pendingSwapUI=null});
 /* v0.3.7: els diàlegs funcionals no poden quedar dins .legacy-scoring-engine,
    perquè aquesta capa està amagada. Els traiem al body mantenint els mateixos IDs
    i els handlers originals del motor. */
 ['substitutionModal','leaveMatchModal','finishSetModal'].forEach(id=>{
   const m=document.getElementById(id); if(m && m.parentElement!==document.body) document.body.appendChild(m);
 });

 /* v0.3.7: qualsevol canvi del motor (inclosa una substitució confirmada al modal)
    obliga a rellegir positions/players i repintar nom+dorsal a la pista nova. */
 document.addEventListener('stats-prova-state-changed',()=>setTimeout(sync,0));

 function confirmFinishMatch(){
   let modal=document.getElementById('provaFinishMatchConfirm');
   if(!modal){
     modal=document.createElement('div');modal.id='provaFinishMatchConfirm';
     modal.style.cssText='position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.58);display:grid;place-items:center;padding:20px';
     modal.innerHTML='<div style="width:min(430px,92vw);background:#fff;border-radius:18px;padding:22px;box-shadow:0 20px 70px rgba(0,0,0,.35);font-family:system-ui;color:#111"><h2 style="margin:0 0 10px;font-size:22px">Finalitzar partit?</h2><p style="margin:0 0 18px;line-height:1.4;color:#475467">Estàs segur que vols finalitzar el partit? Es tancarà i es guardarà a l’historial.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button type="button" data-cancel style="padding:13px;border-radius:12px;border:1px solid #d0d5dd;background:#fff;font-weight:800">CANCEL·LAR</button><button type="button" data-confirm style="padding:13px;border-radius:12px;border:0;background:#111;color:#fff;font-weight:900">FINALITZAR PARTIT</button></div></div>';
     document.body.appendChild(modal);
     modal.querySelector('[data-cancel]').onclick=()=>modal.remove();
     modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
     modal.querySelector('[data-confirm]').onclick=async()=>{
       const b=modal.querySelector('[data-confirm]');b.disabled=true;b.textContent='GUARDANT…';
       const ok=await window.__statsProvaEngine?.finishMatch?.();
       if(ok)modal.remove();else{b.disabled=false;b.textContent='FINALITZAR PARTIT';}
     };
   }
 }

 /* v0.3.7: controls visibles connectats directament al motor. Capture evita que
    cap capa visual/interfície antiga intercepti el toc abans d'arribar aquí. */
 const directHome=root.querySelector('#provaHomeBtn');
 directHome?.addEventListener('click',e=>{
   e.preventDefault();e.stopImmediatePropagation();
   const modal=document.getElementById('leaveMatchModal');
   if(modal){modal.hidden=false;modal.style.display='grid';modal.setAttribute('aria-hidden','false');}
 });
 root.addEventListener('click',e=>{
   const t=e.target;
   const undo=t.closest('.undo-final');
   const home=null;
   const rot=t.closest('#provaRotateBtn');
   const sw=t.closest('#provaSwapBtn');
   const end=t.closest('#provaEndSetBtn');
   const fin=t.closest('#provaFinishBtn');
   if(!(undo||home||rot||sw||end||fin))return;
   e.preventDefault();e.stopPropagation();
   if(undo){
     const u=uiHistory[uiHistory.length-1];
     if(u?.kind==='ui-only'){uiHistory.pop();action=u.action;server=u.server;pendingZero=u.pendingZero;rescueMode=u.rescueMode;txt(last,'DESFET · '+(u.description||'operació'));updateUndoLabel();sync();return}
     if(u?.kind==='sos' && u.zero){
       const ok=window.__statsProvaEngine?.undo?.();
       if(ok){
         clickLegacy(u.zero.i,u.zero.a,0);
         uiHistory.pop();
         action=u.action;server=u.server;pendingZero=u.pendingZero;rescueMode=u.rescueMode;
         txt(last,'DESFET · SOS');
         updateUndoLabel();
       }
       setTimeout(sync,10);return;
     }
     const ok=window.__statsProvaEngine?.undo?.();
     if(ok){const done=uiHistory.pop();if(done){action=done.action;server=done.server;pendingZero=done.pendingZero;rescueMode=done.rescueMode}else{pendingZero=null;rescueMode=false}txt(last,'DESFET · '+(done?.description||'última operació'));updateUndoLabel();}
     setTimeout(sync,10);return;
   }
   if(home){window.__statsProvaEngine?.goHome?.();return;}
   if(rot){pushUI('Rotació manual');const ok=window.__statsProvaEngine?.rotateManual?.();if(!ok){uiHistory.pop();updateUndoLabel();}else txt(last,'ROTACIÓ manual');setTimeout(sync,10);return;}
   if(sw){swapMode=!swapMode;txt(last,swapMode?'CANVI JUG. · toca el nom de la jugadora que surt':'CANVI JUG. cancel·lat');sw.classList.toggle('active',swapMode);return;}
   if(end){window.__statsProvaEngine?.finishSet?.();return;}
   if(fin){confirmFinishMatch();return;}
 },true);



 document.addEventListener('stats-start-scoring',e=>{server=e.detail.serving||'castellar';action=server==='castellar'?'Servei':'Recepció';rescueMode=false;pendingZero=null;swapMode=false;uiHistory.length=0;clearUIState();updateUndoLabel();persistUI();setTimeout(sync,30)});
 document.addEventListener('stats-recovered-scoring',e=>{server=e.detail.serving||'castellar';action=server==='castellar'?'Servei':'Recepció';rescueMode=false;pendingZero=null;swapMode=false;uiHistory.length=0;restoreUI();updateUndoLabel();persistUI();setTimeout(sync,30)});
 /* v0.3.1: no MutationObserver here. sync() itself changes the scoring DOM; observing that subtree caused a feedback loop when entering a set. All scoring actions already call sync() explicitly. */
 updateUndoLabel();
 setTimeout(sync,50);
})();
