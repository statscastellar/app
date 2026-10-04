/* Capa 7 presentation controls are delegations to the real engine DOM, not a second match state. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const scoring=$('#scoring');if(!scoring)return;
const court=$('#scoring .live-court-card');if(!court)return;
// Three original Capa 7 blocking grades per attacking position, delegated to
// the live engine's existing rating buttons (never a separate score state).
const blocks=document.createElement('div');blocks.className='pro1-c7-blocks';blocks.setAttribute('aria-label','Bloqueig de les jugadores atacants');
const blockZones=['4','3','2'];
const blockLabels=[['0','BLOQUEIG FORA','c7-block-out'],['1','BLOQUEIG','c7-block-touch'],['2','BLOQUEIG + PUNT','c7-block-point']];
blockZones.forEach(pos=>{
 const group=document.createElement('div');group.className='c7-block-group';group.dataset.pos=pos;
 blockLabels.forEach(([grade,label,cls])=>{
  const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=grade+' '+label;
  b.setAttribute('aria-label','Zona '+pos+' bloqueig '+grade+' '+label);
  b.addEventListener('click',()=>{
   const cell=$('#liveCourt .live-player-cell[data-pos="'+pos+'"]');
   const choice=[...(cell?.querySelectorAll('.live-actions button')||[])].find(x=>x.textContent.trim()==='Bloqueig');
   if(!choice)return;
   choice.click(); // Opens the engine's own grade selector.
   const rating=[...(cell.querySelectorAll('.inline-ratings button')||[])].find(x=>x.querySelector('strong')?.textContent.trim()===grade);
   rating?.click(); // Uses record(), save(), renderAll() and universal undo.
  });group.append(b);
 });blocks.append(group);
});court.append(blocks);
// Original Capa 7 rival court: a full-width upper-court target delegates to the
// engine's existing transition action; disabled state is mirrored, never bypassed.
const rivalTarget=document.createElement('button');rivalTarget.type='button';
rivalTarget.className='c7-rival-target';
rivalTarget.innerHTML='<strong>CAMP RIVAL</strong><small>↻ Toca si la pilota passa directament al rival</small>';
rivalTarget.setAttribute('aria-label','Camp rival');
rivalTarget.onclick=()=>{const source=$('#sendToRival');if(source&&!source.disabled)source.click();};
court.append(rivalTarget);
// Official service ball belongs exclusively to zone 1 during a Castellar serve.
// It is presentation only; the motor owns the serving state.
const syncCourt=()=>{
 const source=$('#sendToRival');const disabled=!source||source.disabled;if(rivalTarget.disabled!==disabled)rivalTarget.disabled=disabled;
 const zone=$('#liveCourt .live-player-cell[data-pos="1"]');
 court.classList.toggle('c7-own-serve',!!zone?.classList.contains('serving-now'));
};
const footer=document.createElement('div');footer.className='pro1-c7-footer';
function add(label,cl,handler){const b=document.createElement('button');b.type='button';b.className=cl;b.textContent=label;b.onclick=handler;footer.append(b);return b}
add('⌂ INICI','c7-home',()=>$('#liveBackBtn')?.click());
const sos=add('SOS','c7-sos',()=>$('#sosRescue')?.click());
const info=document.createElement('div');info.className='pro1-footer-label';info.textContent='STATS CASTELLAR · PRO.1 · CAPA 7 · 0.4.7';footer.append(info);
// Delegate every modification to the original motor's own buttons so snapshots,
// participation, substitutions and undo remain in its single source of truth.
const picker=document.createElement('div');picker.className='c7-picker';picker.hidden=true;
picker.setAttribute('role','dialog');picker.setAttribute('aria-modal','true');
picker.setAttribute('aria-label','Selecciona una jugadora');
const pickerCard=document.createElement('div');pickerCard.className='c7-picker-card';picker.append(pickerCard);scoring.append(picker);
let pendingSwapSource=null;
const closePicker=(cancel=false)=>{
 picker.hidden=true;pickerCard.replaceChildren();
 // If the first player was selected in the real engine, cancel that selection
 // through the engine's own button rather than leaving a stale swapSource.
 if(cancel && pendingSwapSource?.isConnected){pendingSwapSource.click();}
 pendingSwapSource=null;
};
picker.addEventListener('click',e=>{if(e.target===picker)closePicker(true)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!picker.hidden){e.preventDefault();closePicker(true);}});
function pick(title,buttonClass,callback){
 pickerCard.replaceChildren();const h=document.createElement('h2');h.textContent=title;pickerCard.append(h);
 const choices=document.createElement('div');choices.className='c7-picker-choices';
 [...document.querySelectorAll('#liveCourt .live-player-cell')].forEach(cell=>{
  const source=cell.querySelector(buttonClass);if(!source)return;
  const head=cell.querySelector('.live-player-head');
  const b=document.createElement('button');b.type='button';b.textContent=(head?.textContent||'Zona '+cell.dataset.pos).trim();
  b.onclick=()=>callback(cell,source);choices.append(b);
 });pickerCard.append(choices);
 const cancel=document.createElement('button');cancel.type='button';cancel.className='c7-picker-close';cancel.textContent='Cancel·lar';cancel.onclick=()=>closePicker(true);pickerCard.append(cancel);
 picker.hidden=false;
}
const positions=add('✥ POSICIONS','c7-positions',()=>pick('Tria la primera jugadora per intercanviar posicions','.swap-btn',(cell,source)=>{
 const first=cell.dataset.pos;closePicker();source.click();
 pendingSwapSource=$('#liveCourt .live-player-cell[data-pos="'+first+'"] .swap-btn');
 pick('Tria la segona jugadora (primera: zona '+first+')','.swap-btn',(second,button)=>{
  if(second.dataset.pos===first)return;
  pendingSwapSource=null;closePicker();button.click();
 });
 [...pickerCard.querySelectorAll('.c7-picker-choices button')].forEach(b=>{if(b.textContent.trim()===(cell.querySelector('.live-player-head')?.textContent||'').trim()){b.disabled=true;b.title='Tria una altra jugadora';}});
}));
const change=add('⇄ CANVI JUG.','c7-change',()=>pick('Tria la jugadora que surt','.sub-btn',(cell,source)=>{closePicker();source.click();}));
add('⚑ FINALITZAR SET','c7-set',()=>$('#finishSetBtn')?.click());
add('FINALITZAR PARTIT','c7-end',()=>$('#finishMatchBtn')?.click());
scoring.append(footer);
// Original Capa 7 header: action, two score boxes, central set, universal undo.
// Delegate clicks to the existing engine buttons and observe only engine-owned labels.
const scorebar=$('#scoring .live-score');
if(scorebar){
  const action=document.createElement('div');action.className='c7-header-action';
 action.innerHTML='<span>ACCIÓ ACTUAL</span><strong id="c7HeaderPhase">—</strong><small id="c7HeaderServe">—</small>';
 scorebar.prepend(action);
 const u=document.createElement('button');u.type='button';u.className='c7-header-undo';u.innerHTML='<strong>↶</strong><span>DESFER</span><small id="c7HeaderUndoLabel"></small>';
 u.onclick=()=>$('#undoAction')?.click();scorebar.append(u);
 const rotate=$('#manualRotateBtn');if(rotate){rotate.classList.add('c7-header-rotate');action.append(rotate);}
 const set=$('#liveSet');if(set){const dots=document.createElement('div');dots.className='c7-set-dots';dots.setAttribute('aria-label','Indicadors de cinc sets');scorebar.append(dots);
  for(let i=0;i<5;i++){const dot=document.createElement('span');dots.append(dot);}
 }
 const syncHeader=()=>{
  const p=$('#currentPhase')?.textContent||'—', serving=$('#serveStatus')?.textContent||'—';
  const phaseLabel=$('#c7HeaderPhase');if(phaseLabel&&phaseLabel.textContent!==p.replace(/^ACCIÓ ACTUAL:\s*/i,''))phaseLabel.textContent=p.replace(/^ACCIÓ ACTUAL:\s*/i,'');
  const serveLabel=$('#c7HeaderServe');if(serveLabel&&serveLabel.textContent!==serving)serveLabel.textContent=serving;
  u.disabled=!!$('#undoAction')?.disabled;
  const undoLabel=$('#lastActionText')?.textContent||'';const small=$('#c7HeaderUndoLabel');if(small&&small.textContent!==undoLabel)small.textContent=undoLabel;
  // The original five markers represent the actual order of completed sets.
  // Read-only mirror of the engine's persisted match; no additional scoring state.
  let finished=[];
  try {const saved=JSON.parse(localStorage.getItem('statsCastellarCurrentMatchV1')||'null');finished=Array.isArray(saved?.completedSets)?saved.completedSets:[];}catch(_){}
  const ordered=[...finished].sort((a,b)=>Number(a.set)-Number(b.set));
  const currentSet=Number($('#liveSet')?.textContent?.match(/\d+/)?.[0]) || 1;
  scorebar.querySelectorAll('.c7-set-dots span').forEach((dot,i)=>{
   const scores=ordered[i]?.scores;
   const home=Number(scores?.castellar),away=Number(scores?.rival);
   const cls=!scores||!Number.isFinite(home)||!Number.isFinite(away)||home===away?'':home>away?'home':'away';
   const next=cls || (i+1===currentSet ? 'active' : '');
   if(dot.className!==next)dot.className=next;
  });
 };
 const watched=['currentPhase','serveStatus','undoAction','lastActionText','setsScore','liveSet'];
 const headerObserver=new MutationObserver(syncHeader);
 watched.forEach(id=>{const el=$('#'+id);if(el)headerObserver.observe(el,{subtree:true,childList:true,characterData:true,attributes:id==='undoAction',attributeFilter:id==='undoAction'?['disabled']:undefined});});
 syncHeader();
}

// The original footer's Finish Match delegates to the guarded motor confirmation.
// It is available only after the current set was closed, never during a live set.
const end=footer.querySelector('.c7-end');end.disabled=true;end.title='Disponible després de finalitzar el set';
const sync=()=>{
 let ready=false;
 try {const m=JSON.parse(localStorage.getItem('statsCastellarCurrentMatchV1')||'null');ready=!!m&&!m.finished&&(m.completedSets||[]).some(s=>Number(s.set)===Number(m.set));}catch(_){}
 if(end.disabled===ready)end.disabled=!ready;
 end.title=ready?'Confirmar la finalització del partit':'Disponible després de finalitzar el set';
 syncCourt();const hasPlayers=!!$('#liveCourt .live-player-cell .live-player-head');if(positions.disabled===hasPlayers)positions.disabled=!hasPlayers;if(change.disabled===hasPlayers)change.disabled=!hasPlayers;if(sos.disabled!==!!$('#sosRescue')?.disabled)sos.disabled=!!$('#sosRescue')?.disabled;blocks.querySelectorAll('.c7-block-group').forEach(group=>{
 const cell=$('#liveCourt .live-player-cell[data-pos="'+group.dataset.pos+'"]');
 const available=!![...(cell?.querySelectorAll('.live-actions button')||[])].find(x=>x.textContent.trim()==='Bloqueig');
 group.querySelectorAll('button').forEach(b=>{if(b.disabled===available)b.disabled=!available;});
});};
const observer=new MutationObserver(sync);observer.observe(scoring,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});sync();
})();
