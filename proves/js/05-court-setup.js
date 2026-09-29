document.addEventListener('DOMContentLoaded', () => {
  let draggedId=null, ghost=null, pointerId=null;

  function allChips(){ return [...document.querySelectorAll('#positionPool .position-chip')]; }
  function slots(){ return [...document.querySelectorAll('#court .court-slot')]; }

  function playerIdFromChip(chip){
    return chip && chip.dataset.playerId;
  }

  function playerData(id){
    const chip=allChips().find(c=>c.dataset.playerId===id);
    return chip ? {id, label:chip.dataset.playerLabel || chip.textContent.replace(/^⠿\s*/,'')} : null;
  }

  function refreshReady(){
    const btn=document.getElementById('readyForSet');
    if(btn) btn.disabled = slots().filter(s=>s.dataset.playerId).length !== 6;
  }

  function refreshSlots(){
    slots().forEach(slot=>{
      const id=slot.dataset.playerId || '';
      const label=slot.querySelector('.court-player');
      if(id){
        const p=playerData(id);
        if(label && p) label.textContent=p.label;
        slot.classList.add('filled');
      }else{
        if(label) label.textContent='—';
        slot.classList.remove('filled');
      }
      if(!slot.querySelector('.drop-hint')){
        const h=document.createElement('span');
        h.className='drop-hint';
        h.textContent='Arrossega aquí';
        slot.appendChild(h);
      }
    });
    allChips().forEach(ch=>{
      ch.classList.toggle('assigned', slots().some(s=>s.dataset.playerId===ch.dataset.playerId));
    });
    refreshReady();
  }

  function assignToSlot(playerId, targetSlot){
    if(!playerId || !targetSlot) return;

    const oldSlot=slots().find(s=>s.dataset.playerId===playerId);
    const displaced=targetSlot.dataset.playerId || '';

    if(oldSlot && oldSlot!==targetSlot){
      if(displaced) oldSlot.dataset.playerId=displaced;
      else delete oldSlot.dataset.playerId;
    }
    targetSlot.dataset.playerId=playerId;

    /* Actualitza l'estat REAL del partit. Això és el que comprova
       "Preparat per començar el Set 1". */
    document.dispatchEvent(new CustomEvent('stats-court-assign',{
      detail:{playerId:playerId,pos:targetSlot.dataset.pos}
    }));
    refreshSlots();
  }

  function slotAt(x,y){
    const el=document.elementFromPoint(x,y);
    return el && el.closest ? el.closest('#court .court-slot') : null;
  }

  function startGhost(chip,x,y){
    draggedId=playerIdFromChip(chip);
    if(!draggedId)return;
    chip.classList.add('dragging');
    ghost=document.createElement('div');
    ghost.className='drag-ghost';
    ghost.textContent=chip.dataset.playerLabel || chip.textContent.replace(/^⠿\s*/,'');
    document.body.appendChild(ghost);
    moveGhost(x,y);
  }
  function moveGhost(x,y){
    if(ghost){ghost.style.left=x+'px';ghost.style.top=y+'px'}
    slots().forEach(s=>s.classList.remove('drag-over'));
    const s=slotAt(x,y); if(s)s.classList.add('drag-over');
  }
  function finishGhost(x,y){
    const target=slotAt(x,y);
    if(target && draggedId)assignToSlot(draggedId,target);
    allChips().forEach(c=>c.classList.remove('dragging'));
    slots().forEach(s=>s.classList.remove('drag-over'));
    if(ghost)ghost.remove();
    ghost=null;draggedId=null;pointerId=null;
  }

  /* Observem quan el PAS 4 crea les fitxes i les preparem.
     Això evita tocar la lògica aprovada dels passos 1–3. */
  const pool=document.getElementById('positionPool');
  if(!pool)return;

  const prepareChips=()=>{
    allChips().forEach((chip,i)=>{
      if(chip.dataset.dragReady)return;
      chip.dataset.dragReady='1';

      /* La Base 0.8 ja posa l'ID real de la jugadora a la fitxa. */
      const label=chip.textContent.trim();
      chip.dataset.playerLabel=chip.dataset.playerLabel || label;

      chip.addEventListener('pointerdown',e=>{
        if(e.pointerType==='mouse' && e.button!==0)return;
        pointerId=e.pointerId;
        try{chip.setPointerCapture(pointerId)}catch(_){}
        startGhost(chip,e.clientX,e.clientY);
        e.preventDefault();
      });
      chip.addEventListener('pointermove',e=>{
        if(pointerId===e.pointerId && draggedId){
          moveGhost(e.clientX,e.clientY); e.preventDefault();
        }
      });
      chip.addEventListener('pointerup',e=>{
        if(pointerId===e.pointerId && draggedId){
          finishGhost(e.clientX,e.clientY); e.preventDefault();
        }
      });
      chip.addEventListener('pointercancel',e=>{
        if(pointerId===e.pointerId && draggedId)finishGhost(-999,-999);
      });
    });
    refreshSlots();
  };

  new MutationObserver(prepareChips).observe(pool,{childList:true,subtree:true});
  prepareChips();

  /* També permet moure directament una jugadora ja situada:
     mantenir premuda la seva casella i arrossegar-la a una altra. */
  slots().forEach(slot=>{
    slot.addEventListener('pointerdown',e=>{
      if(e.target.closest('.position-chip'))return;
      const id=slot.dataset.playerId;
      if(!id)return; // el clic normal de la Base 0.8 continua disponible si és buida
      const chip=allChips().find(c=>c.dataset.playerId===id);
      if(!chip)return;
      pointerId=e.pointerId;
      startGhost(chip,e.clientX,e.clientY);
      e.preventDefault();
      e.stopPropagation();
    });
    slot.addEventListener('pointermove',e=>{
      if(pointerId===e.pointerId && draggedId){moveGhost(e.clientX,e.clientY);e.preventDefault()}
    });
    slot.addEventListener('pointerup',e=>{
      if(pointerId===e.pointerId && draggedId){finishGhost(e.clientX,e.clientY);e.preventDefault();e.stopPropagation()}
    });
  });
});
