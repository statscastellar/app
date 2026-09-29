(() => {
 let match=null, swapSource=null;
 const history=[];
 const $=id=>document.getElementById(id);
 const ratings={
  Servei:[{v:0,l:'Error',c:'rating-0',p:'rival'},{v:1,l:'Fàcil',c:'rating-1'},{v:2,l:'Correcte',c:'rating-2'},{v:3,l:'Ace',c:'rating-3',p:'castellar'}],
  Recepció:[{v:0,l:'Error',c:'rating-0',p:'rival'},{v:1,l:'Dolenta',c:'rating-1'},{v:2,l:'Correcta',c:'rating-2'},{v:3,l:'Perfecta',c:'rating-3'}],
  Defensa:[{v:0,l:'Error',c:'rating-0',p:'rival'},{v:1,l:'Dolenta',c:'rating-1'},{v:2,l:'Correcta',c:'rating-2'},{v:3,l:'Perfecta',c:'rating-3'}],
  Salvada:[{v:0,l:'No recuperada',c:'rating-0'},{v:1,l:'Compromesa',c:'rating-1'},{v:2,l:'Bona',c:'rating-2'},{v:3,l:'Perfecta',c:'rating-3'}],
  'Col·locació':[{v:0,l:'Error',c:'rating-0',p:'rival'},{v:1,l:'Dolenta',c:'rating-1'},{v:2,l:'Correcta',c:'rating-2'},{v:3,l:'Perfecta',c:'rating-3'}],
  Atac:[{v:0,l:'Error',c:'rating-0',p:'rival'},{v:1,l:'Dolent',c:'rating-1'},{v:2,l:'Correcte',c:'rating-2'},{v:3,l:'Punt',c:'rating-3',p:'castellar'}],
  Bloqueig:[{v:0,l:'Error / fora',c:'rating-0',p:'rival'},{v:1,l:'Bloqueig',c:'rating-block-1'},{v:2,l:'Bloq. + punt',c:'rating-block-2',p:'castellar'}]
 };
 const actions=['Servei','Recepció','Defensa','Col·locació','Atac','Bloqueig','Salvada'];
 const p=id=>match&&match.players.find(x=>x.id===id);
 const snap=()=>JSON.parse(JSON.stringify({scores:match.scores,serving:match.serving,positions:match.positions,actions:match.actions,pinned:match.pinned,participation:match.participation,substitutions:match.substitutions}));
 function save(){
   if(!match)return;
   match.undoHistory=history.slice(-30);
   match.savedAt=Date.now();
   localStorage.setItem(CURRENT_MATCH_KEY,JSON.stringify(match));
   updateRecoverHome();
 }
 function rotate(){
   const cycle=['1','6','5','4','3','2'];
   const old={...match.positions};
   const fixedPositions=cycle.filter(pos=>match.pinned.includes(old[pos]));
   const movablePositions=cycle.filter(pos=>!fixedPositions.includes(pos));
   if(movablePositions.length<2)return;

   const next={...old};
   /* Les jugadores fixades no es mouen. Les altres avancen a la següent
      posició disponible seguint l'ordre normal de rotació. */
   movablePositions.forEach((pos,i)=>{
     const nextPos=movablePositions[(i+1)%movablePositions.length];
     next[nextPos]=old[pos];
   });
   match.positions=next;
 }
 function award(side){
   if(!side)return;
   if(side==='castellar'){match.scores.castellar++;if(match.serving==='rival'){match.serving='castellar';rotate()}}
   else{match.scores.rival++;if(match.serving==='castellar')match.serving='rival'}
 }
 function names(){
   const rival=match.opponent||'Rival';
   return match.venue==='home'
    ?{l:'Castellar',r:rival,lk:'castellar',rk:'rival'}
    :{l:rival,r:'Castellar',lk:'rival',rk:'castellar'};
 }
 function renderScore(){
   const n=names();
   $('leftTeamName').textContent=n.l;$('rightTeamName').textContent=n.r;
   $('leftScore').textContent=match.scores[n.lk];$('rightScore').textContent=match.scores[n.rk];
   $('serveStatus').textContent='🏐 Servei: '+(match.serving==='castellar'?'Castellar':match.opponent);
 }
 function renderCourt(){
   document.querySelectorAll('#liveCourt .live-player-cell').forEach(cell=>{
     const pos=cell.dataset.pos,id=match.positions[pos],pl=p(id);
     cell.classList.remove('swap-target');cell.innerHTML='';
     if(!pl)return;
     const head=document.createElement('div');head.className='live-player-head';
     head.innerHTML='<span class="live-pos">'+pos+'</span>'+pl.number+' · '+pl.name;
     const box=document.createElement('div');box.className='live-actions';
     actions.forEach(a=>{
       const b=document.createElement('button');b.type='button';b.textContent=a;
       b.onclick=()=>showRatings(cell,pl,a);box.appendChild(b);
     });

     const tools=document.createElement('div');tools.className='player-tools';
     const pin=document.createElement('button');pin.type='button';pin.className='pin-btn';
     const isPinned=match.pinned.includes(pl.id);
     pin.classList.toggle('pinned',isPinned);
     pin.textContent=isPinned?'🔒 Fixada':'🔓 Fixar';
     pin.onclick=()=>{
       const i=match.pinned.indexOf(pl.id);
       if(i>=0)match.pinned.splice(i,1);else match.pinned.push(pl.id);
       save();renderCourt();
     };

     const swap=document.createElement('button');swap.type='button';swap.className='swap-btn';
     swap.textContent='⇄ Posició';
     if(swapSource===pl.id)swap.classList.add('swap-source');
     swap.onclick=()=>beginOrCompleteSwap(pl.id);

     const sub=document.createElement('button');sub.type='button';sub.className='sub-btn';
     sub.textContent='⇆ Substituir';
     sub.onclick=()=>openSubstitution(pl.id);

     tools.append(pin,swap,sub);
     if(swapSource){
       const help=document.createElement('div');help.className='swap-help';
       help.textContent=swapSource===pl.id?'Tria una altra jugadora':'Toca “Canviar” per intercanviar';
       tools.appendChild(help);
       if(swapSource!==pl.id)cell.classList.add('swap-target');
     }
     cell.append(head,box,tools);
   });
 }

 function totalPointsNow(){
   return Math.max(0,(Number(match?.scores?.castellar)||0)+(Number(match?.scores?.rival)||0));
 }
 function ensureParticipation(){
   match.participation=match.participation||{};
   const pointNow=totalPointsNow();
   const courtIds=new Set(Object.values(match.positions||{}));
   (match.players||[]).forEach(pl=>{
     if(!match.participation[pl.id]){
       match.participation[pl.id]={playedPoints:0,onCourt:courtIds.has(pl.id),lastInPoint:courtIds.has(pl.id)?pointNow:null};
     }else{
       const rec=match.participation[pl.id];
       if(!Number.isFinite(Number(rec.playedPoints)))rec.playedPoints=0;
       rec.onCourt=courtIds.has(pl.id);
       if(rec.onCourt && !Number.isFinite(Number(rec.lastInPoint)))rec.lastInPoint=pointNow;
       if(!rec.onCourt)rec.lastInPoint=null;
     }
   });
   match.substitutions=Array.isArray(match.substitutions)?match.substitutions:[];
 }
 function bench(){
   const courtIds=new Set(Object.values(match.positions||{}));
   return (match.players||[]).filter(pl=>!courtIds.has(pl.id));
 }
 function closeParticipationInterval(playerId,pointNow=totalPointsNow()){
   ensureParticipation();
   const rec=match.participation[playerId];
   if(rec && rec.onCourt){
     const start=Number.isFinite(Number(rec.lastInPoint))?Number(rec.lastInPoint):pointNow;
     rec.playedPoints=(Number(rec.playedPoints)||0)+Math.max(0,pointNow-start);
     rec.lastInPoint=null;rec.onCourt=false;
   }
 }
 function openParticipationInterval(playerId,pointNow=totalPointsNow()){
   ensureParticipation();
   const rec=match.participation[playerId];
   if(rec){
     rec.onCourt=true;rec.lastInPoint=pointNow;
   }
 }
 function currentPlayedPoints(playerId,pointNow=totalPointsNow()){
   ensureParticipation();
   const rec=match.participation[playerId];
   if(!rec)return 0;
   const start=Number.isFinite(Number(rec.lastInPoint))?Number(rec.lastInPoint):pointNow;
   return (Number(rec.playedPoints)||0)+(rec.onCourt?Math.max(0,pointNow-start):0);
 }
 function participationSnapshot(){
   /* Font de veritat: marcador.
      Cada punt del set és una unitat de participació.
      El marcador anotat al canvi tanca la participació de qui surt;
      qui entra comença a comptar a partir del punt següent. */
   const total=Math.max(0,totalPointsNow());
   const players=match.players||[];
   const out={};
   const activeStart={};
   const played={};
   players.forEach(pl=>{played[pl.id]=0;activeStart[pl.id]=null;});
   (match.starting||[]).forEach(id=>{if(id in activeStart)activeStart[id]=0;});

   const changes=(match.substitutions||[]).slice().sort((a,b)=>{
     const pa=Number.isFinite(Number(a.pointIndex))?Number(a.pointIndex):
       ((Number(a.score&&a.score.castellar)||0)+(Number(a.score&&a.score.rival)||0));
     const pb=Number.isFinite(Number(b.pointIndex))?Number(b.pointIndex):
       ((Number(b.score&&b.score.castellar)||0)+(Number(b.score&&b.score.rival)||0));
     return pa-pb || (Number(a.time)||0)-(Number(b.time)||0);
   });

   changes.forEach(ch=>{
     let p=Number.isFinite(Number(ch.pointIndex))?Number(ch.pointIndex):
       ((Number(ch.score&&ch.score.castellar)||0)+(Number(ch.score&&ch.score.rival)||0));
     p=Math.max(0,Math.min(total,p));
     if(ch.outId && activeStart[ch.outId]!==null && activeStart[ch.outId]!==undefined){
       played[ch.outId]+=Math.max(0,p-activeStart[ch.outId]);
       activeStart[ch.outId]=null;
     }
     if(ch.inId){
       activeStart[ch.inId]=p;
     }
   });

   players.forEach(pl=>{
     if(activeStart[pl.id]!==null && activeStart[pl.id]!==undefined){
       played[pl.id]+=Math.max(0,total-activeStart[pl.id]);
     }
     const points=Math.max(0,played[pl.id]||0);
     out[pl.id]={
       playerId:pl.id,number:pl.number,name:pl.name,
       playedPoints:points,
       percentage:total?Math.max(0,Math.min(100,Math.round(points/total*1000)/10)):0
     };
   });
   return out;
 }
 function openSubstitution(outId){
   if(!match)return;
   ensureParticipation();
   const out=p(outId), available=bench();
   if(!out)return;
   $('substitutionTitle').textContent='Substituir '+out.number+' · '+out.name;
   $('substitutionOut').textContent='Tria la jugadora que entra a pista.';
   const host=$('benchPlayers');host.innerHTML='';
   if(!available.length){
     host.innerHTML='<div style="text-align:center;color:#667085;padding:10px">No hi ha jugadores disponibles a la banqueta.</div>';
   }else{
     available.forEach(pl=>{
       const b=document.createElement('button');b.type='button';
       b.innerHTML='<strong>'+pl.number+'</strong> '+pl.name;
       b.onclick=()=>completeSubstitution(outId,pl.id);
       host.appendChild(b);
     });
   }
   $('substitutionModal').hidden=false;
 }
 function completeSubstitution(outId,inId){
   const pos=Object.keys(match.positions).find(k=>match.positions[k]===outId);
   if(!pos)return;
   const now=Date.now();
   const pointNow=totalPointsNow();

   history.push(snap());
   ensureParticipation();

   closeParticipationInterval(outId,pointNow);
   openParticipationInterval(inId,pointNow);

   match.positions[pos]=inId;

   /* Si la jugadora que surt estava fixada, la fixació no passa
      automàticament a la substituta. */
   match.pinned=match.pinned.filter(id=>id!==outId);

   const out=p(outId), incoming=p(inId);
   match.substitutions.push({
     time:now,set:match.set,position:pos,
     score:{castellar:Number(match.scores.castellar)||0,rival:Number(match.scores.rival)||0},
     pointIndex:pointNow,
     outId,inId,
     outNumber:out?out.number:'',outName:out?out.name:'',
     inNumber:incoming?incoming.number:'',inName:incoming?incoming.name:''
   });

   $('substitutionModal').hidden=true;
   save();renderAll();
   document.dispatchEvent(new CustomEvent('stats-substitution-completed',{detail:{outId,inId,position:pos}}));
 }
 function beginOrCompleteSwap(playerId){
   if(!swapSource){
     swapSource=playerId;renderCourt();return;
   }
   if(swapSource===playerId){
     swapSource=null;renderCourt();return;
   }
   const posA=Object.keys(match.positions).find(k=>match.positions[k]===swapSource);
   const posB=Object.keys(match.positions).find(k=>match.positions[k]===playerId);
   if(posA&&posB){
     const tmp=match.positions[posA];
     match.positions[posA]=match.positions[posB];
     match.positions[posB]=tmp;
     save();
   }
   swapSource=null;renderCourt();
 }
 function showRatings(cell,pl,action){
   const box=cell.querySelector('.live-actions');box.innerHTML='';
   const rs=ratings[action];
   box.className='inline-ratings'+(rs.length===3?' three':'');
   rs.forEach(r=>{
     const b=document.createElement('button');b.type='button';b.className=r.c;
     b.innerHTML='<strong>'+r.v+'</strong><small>'+r.l+'</small>';
     b.onclick=()=>record(pl,action,r);box.appendChild(b);
   });
   const back=document.createElement('button');back.type='button';back.className='inline-back';
   back.textContent='← Accions';back.onclick=renderCourt;box.appendChild(back);
 }
 function record(pl,action,r){
   history.push(snap());
   match.actions.push({time:Date.now(),playerId:pl.id,playerNumber:pl.number,playerName:pl.name,action,value:r.v,label:r.l});
   const suppressAward=!!window.__statsProvaSuppressAward;
   if(!suppressAward)award(r.p);
   save();renderAll();
 }
 function renderLast(){
   const a=match.actions[match.actions.length-1];
   $('lastActionText').textContent=a?`${a.playerNumber} ${a.playerName} · ${a.action} · ${a.value} (${a.label})`:'Encara no hi ha cap acció.';
   $('undoAction').disabled=!history.length;
 }
 function renderAll(){
   renderScore();renderCourt();renderLast();
   if($('liveSet'))$('liveSet').textContent='SET '+match.set;
   if($('finishSetBtn'))$('finishSetBtn').textContent='FINALITZAR SET '+match.set;
   const won=(match.completedSets||[]).reduce((a,s)=>{
     if((s.scores.castellar||0)>(s.scores.rival||0))a.castellar++;
     else if((s.scores.rival||0)>(s.scores.castellar||0))a.rival++;
     return a;
   },{castellar:0,rival:0});
   if($('setsScore'))$('setsScore').textContent='Sets: Castellar '+won.castellar+' – '+won.rival+' '+(match.opponent||'Rival');
   /* v0.3.7: la Capa 7 s'ha de repintar després de QUALSEVOL canvi del motor
      (especialment substitucions, rotacions, punts manuals i DESFER). */
   document.dispatchEvent(new CustomEvent('stats-prova-state-changed'));
 }
 function provaOpenHome(){
   if(!match)return false;
   save();
   const modal=$('leaveMatchModal');
   if(modal){modal.hidden=false;return true}
   return false;
 }
 function provaOpenFinishSet(){
   if(!match)return false;
   const already=(match.completedSets||[]).some(s=>Number(s.set)===Number(match.set));
   if(already)return false;
   const n=names();
   $('finishSetTitle').textContent='Finalitzar el Set '+match.set+'?';
   $('finishSetScore').textContent=n.l+' '+match.scores[n.lk]+' – '+match.scores[n.rk]+' '+n.r;
   $('finishSetConfirmActions').hidden=false;
   $('finishSetConfirmActions').style.display='grid';
   $('afterSetActions').hidden=true;
   $('afterSetActions').style.display='none';
   $('finishSetModal').hidden=false;
   return true;
 }
 function ensureCurrentSetStored(){
   if(!match)return;
   match.completedSets=match.completedSets||[];
   if(match.completedSets.some(x=>Number(x.set)===Number(match.set)))return;
   match.completedSets.push({set:match.set,scores:{...match.scores},actions:JSON.parse(JSON.stringify(match.actions||[])),finalPositions:{...match.positions},pinned:[...(match.pinned||[])],starting:[...(match.starting||[])],serving:match.serving,participation:participationSnapshot(),substitutions:JSON.parse(JSON.stringify(match.substitutions||[]))});
 }
 async function provaFinishMatch(){
   if(!match)return false;
   ensureCurrentSetStored();
   match.finished=true;
   match.finishedAt=Date.now();
   save();
   localStorage.setItem(LAST_COMPLETED_MATCH_KEY,JSON.stringify(match));
   try{
     await archiveMatch(match);
     const stored=await idbAll();
     if(!stored.some(m=>m&&m.id===match.id))throw new Error('No s’ha pogut verificar el partit a l’Historial.');
     localStorage.removeItem(CURRENT_MATCH_KEY);
     updateRecoverHome();
     $('finishSetModal').hidden=true;
     renderFinalReport(match);
     if(typeof window.statsNavigate==='function')window.statsNavigate('final-report',true);
     return true;
   }catch(err){
     match.finished=false;delete match.finishedAt;save();updateRecoverHome();
     alert('No s’ha pogut guardar el partit a l’Historial.\n\nNO s’ha perdut: continua desat com a partit recuperable. Torna-ho a provar.\n\nDetall: '+(err&&err.message?err.message:String(err)));
     return false;
   }
 }
 function provaManualPoint(side,delta){
   if(!match)return false;
   history.push(snap());
   if(delta>0)award(side);else match.scores[side]=Math.max(0,match.scores[side]+delta);
   save();renderAll();return true;
 }
 window.__statsProvaEngine={
   recordByPosition(pos,action,value){
     if(!match)return false;
     const id=match.positions&&match.positions[String(pos)];
     const pl=id&&p(id); const rs=ratings[action];
     const r=Array.isArray(rs)?rs.find(x=>Number(x.v)===Number(value)):null;
     if(!pl||!r)return false;
     record(pl,action,r); return true;
   },
   recordSalvadaZero(pos){
     if(!match)return false;
     const id=match.positions&&match.positions[String(pos)],pl=id&&p(id);
     const r=ratings.Salvada.find(x=>Number(x.v)===0);
     if(!pl||!r)return false;
     history.push(snap());
     match.actions.push({time:Date.now(),playerId:pl.id,playerNumber:pl.number,playerName:pl.name,action:'Salvada',value:0,label:r.l});
     award('rival');
     save();renderAll();return true;
   },
   state(){
     if(!match)return null;
     return {id:match.id,scores:{...match.scores},serving:match.serving,set:match.set,opponent:match.opponent||'Rival',venue:match.venue,positions:{...match.positions},players:(match.players||[]).map(x=>({id:x.id,number:x.number,name:x.name}))};
   },
   undo(){ if(!history.length||!match)return false; const st=history.pop();match.scores=st.scores;match.serving=st.serving;match.positions=st.positions;match.actions=st.actions;match.pinned=st.pinned||[];match.participation=st.participation||{};match.substitutions=st.substitutions||[];save();renderAll();return true; },
   rotateManual(){ if(!match)return false; history.push(snap());rotate();save();renderAll();return true; },
   manualPoint(side,delta){return provaManualPoint(side,delta);},
   goHome(){return provaOpenHome();},
   finishSet(){return provaOpenFinishSet();},
   finishMatch(){return provaFinishMatch();},
   substituteByPosition(pos){ if(!match)return false;const id=match.positions&&match.positions[String(pos)];if(!id)return false;openSubstitution(id);return true; }
 };
 document.addEventListener('stats-start-scoring',e=>{
   const d=e.detail;
   let saved=null;
   try{saved=JSON.parse(localStorage.getItem(CURRENT_MATCH_KEY)||'null')}catch(_){}
   const continuing=Number(d.set)>1 && saved && !saved.finished;
   match={
     id:continuing&&saved&&saved.id?saved.id:((window.crypto&&crypto.randomUUID)?crypto.randomUUID():('match-'+Date.now()+'-'+Math.random().toString(36).slice(2))),
     teamId:d.teamId,opponent:d.opponent,date:d.date,venue:d.venue,set:Number(d.set)||1,players:d.players,
     positions:{...d.positions},starting:[...d.starting],serving:d.serving,
     scores:{castellar:0,rival:0},actions:[],pinned:[],
     participation:{},substitutions:[],
     completedSets:continuing&&Array.isArray(saved.completedSets)?saved.completedSets:[]
   };
   (match.players||[]).forEach(pl=>{
     match.participation[pl.id]={playedPoints:0,onCourt:false,lastInPoint:null};
   });
   Object.values(match.positions||{}).forEach(id=>{
     if(match.participation[id]){
       match.participation[id].onCourt=true;
       match.participation[id].lastInPoint=0;
     }
   });
   history.length=0;swapSource=null;save();renderAll();
 });
 function manualPoint(visualSide,delta){
   if(!match)return;
   const n=names();
   const side=visualSide==='left'?n.lk:n.rk;
   history.push(snap());
   if(delta>0){
     /* Un punt manual representa una jugada real: aplica també el canvi
        de servei i, si Castellar recupera el servei, la rotació. */
     award(side);
   }else{
     /* El botó − és només una correcció de marcador. No altera
        ni el servei ni la rotació. */
     match.scores[side]=Math.max(0,match.scores[side]+delta);
   }
   save();renderAll();
 }
 $('leftMinus').onclick=()=>manualPoint('left',-1);
 $('leftPlus').onclick=()=>manualPoint('left',1);
 $('rightMinus').onclick=()=>manualPoint('right',-1);
 $('rightPlus').onclick=()=>manualPoint('right',1);
 $('manualRotateBtn').onclick=()=>{
   if(!match)return;
   history.push(snap());
   rotate();
   save();renderAll();
 };

 $('finishSetBtn').onclick=()=>{
   return provaOpenFinishSet();
   /* legacy fallback disabled
   if(!match)return;
   const already=(match.completedSets||[]).some(s=>Number(s.set)===Number(match.set));
   if(already)return;
   const n=names();
   $('finishSetTitle').textContent='Finalitzar el Set '+match.set+'?';
   $('finishSetScore').textContent=n.l+' '+match.scores[n.lk]+' – '+match.scores[n.rk]+' '+n.r;
   $('finishSetConfirmActions').hidden=false;
   $('finishSetConfirmActions').style.display='grid';
   $('afterSetActions').hidden=true;
   $('afterSetActions').style.display='none';
   $('finishSetModal').hidden=false;
   */
 };
 $('cancelFinishSet').onclick=()=>{$('finishSetModal').hidden=true};
 $('finishSetModal').querySelector('.app-modal-backdrop').onclick=()=>{$('finishSetModal').hidden=true};

 $('confirmFinishSet').onclick=()=>{
   if(!match)return;
   match.completedSets=match.completedSets||[];
   const already=match.completedSets.some(s=>Number(s.set)===Number(match.set));
   if(!already){
     match.completedSets.push({
       set:match.set,
       scores:{...match.scores},
       actions:JSON.parse(JSON.stringify(match.actions)),
       finalPositions:{...match.positions},
       pinned:[...match.pinned],
       starting:[...match.starting],
       serving:match.serving,
       participation:participationSnapshot(),
       substitutions:JSON.parse(JSON.stringify(match.substitutions||[])),
     });
   }
   save();renderAll();
   $('finishSetTitle').textContent='Set '+match.set+' finalitzat';
   const n=names();
   $('finishSetScore').textContent=n.l+' '+match.scores[n.lk]+' – '+match.scores[n.rk]+' '+n.r;
   const nextBtn=$('nextSetBtn');
   if(nextBtn)nextBtn.textContent='Preparar Set '+(Number(match.set)+1);
   const returnBtn=$('returnToSetBtn');
   if(returnBtn)returnBtn.textContent='Tornar al Set '+match.set;
   $('finishSetConfirmActions').hidden=true;
   $('finishSetConfirmActions').style.display='none';
   $('afterSetActions').hidden=false;
   $('afterSetActions').style.display='grid';
 };



 $('returnToSetBtn').onclick=()=>{
   if(!match)return;
   match.completedSets=match.completedSets||[];

   const idx=match.completedSets.findIndex(s=>Number(s.set)===Number(match.set));
   if(idx<0)return;

   const closed=match.completedSets[idx];

   /* Reobrim exactament el set que acabem de tancar.
      En eliminar-lo de completedSets deixa de considerar-se finalitzat
      fins que l'usuari torni a prémer FINALITZAR SET. */
   match.completedSets.splice(idx,1);
   match.scores={...closed.scores};
   match.actions=JSON.parse(JSON.stringify(closed.actions||[]));
   match.positions={...(closed.finalPositions||match.positions)};
   match.pinned=[...(closed.pinned||[])];
   match.starting=[...(closed.starting||match.starting)];
   match.serving=closed.serving||match.serving;
   match.substitutions=JSON.parse(JSON.stringify(closed.substitutions||[]));
   match.participation={};
   const savedPart=closed.participation||{};
   const pointNow=Math.max(0,(Number(match.scores.castellar)||0)+(Number(match.scores.rival)||0));
   (match.players||[]).forEach(pl=>{
     const rec=savedPart[pl.id]||{};
     const onCourt=Object.values(match.positions||{}).includes(pl.id);
     match.participation[pl.id]={
       playedPoints:Number(rec.playedPoints)||0,
       onCourt,
       lastInPoint:onCourt?pointNow:null
     };
   });
   match.finished=false;

   history.length=0;
   swapSource=null;
   save();

   $('finishSetModal').hidden=true;
   $('finishSetConfirmActions').hidden=false;
   $('finishSetConfirmActions').style.display='grid';
   $('afterSetActions').hidden=true;
   $('afterSetActions').style.display='none';

   renderAll();
 };
 $('nextSetBtn').onclick=()=>{
   if(!match)return;
   const next=Number(match.set)+1;
   const detail={
     set:next,teamId:match.teamId,opponent:match.opponent,date:match.date,venue:match.venue,
     players:match.players,available:match.players
   };
   save();
   $('finishSetModal').hidden=true;
   $('finishSetConfirmActions').style.display='grid';
   $('afterSetActions').style.display='none';
   if(window.statsPrepareNextSet)window.statsPrepareNextSet(detail);
 };

 $('finishMatchBtn').onclick=async()=>{
   if(!match)return;
   ensureCurrentSetStored();
   match.finished=true;
   match.finishedAt=Date.now();
   save();
   localStorage.setItem(LAST_COMPLETED_MATCH_KEY,JSON.stringify(match));
   try{
     await archiveMatch(match);
     const stored=await idbAll();
     if(!stored.some(m=>m&&m.id===match.id))throw new Error('No s’ha pogut verificar el partit a l’Historial.');
     localStorage.removeItem(CURRENT_MATCH_KEY);
     updateRecoverHome();
     $('finishSetModal').hidden=true;
     renderFinalReport(match);
     if(typeof window.statsNavigate==='function')window.statsNavigate('final-report',true);
   }catch(err){
     match.finished=false;
     delete match.finishedAt;
     save();
     updateRecoverHome();
     alert('No s’ha pogut guardar el partit a l’Historial.\n\nNO s’ha perdut: continua desat com a partit recuperable. Torna-ho a provar.\n\nDetall: '+(err&&err.message?err.message:String(err)));
   }
 };

 $('cancelSubstitution').onclick=()=>{$('substitutionModal').hidden=true};
 $('substitutionModal').querySelector('.app-modal-backdrop').onclick=()=>{$('substitutionModal').hidden=true};
 $('undoAction').onclick=()=>{
   if(!history.length||!match)return;
   const s=history.pop();match.scores=s.scores;match.serving=s.serving;match.positions=s.positions;match.actions=s.actions;match.pinned=s.pinned||[];
   match.participation=s.participation||match.participation||{};
   match.substitutions=s.substitutions||match.substitutions||[];
   swapSource=null;save();renderAll();
 };


 function allReportSets(m){return (Array.isArray(m.completedSets)?m.completedSets.slice():[]).sort((a,b)=>Number(a.set)-Number(b.set))}
 function reportActionsFor(m,f){const ss=allReportSets(m);if(f==='all')return ss.flatMap(s=>Array.isArray(s.actions)?s.actions:[]);const s=ss.find(x=>String(x.set)===String(f));return s&&Array.isArray(s.actions)?s.actions:[]}
 function actionCounts(actions,id,action){const out=action==='Bloqueig'?[0,0,0]:[0,0,0,0];actions.forEach(a=>{if(a.playerId===id&&a.action===action){const v=Number(a.value);if(v>=0&&v<out.length)out[v]++}});return out}
 function reportParticipation(m,id,f){
   const ss=allReportSets(m);
   if(f!=='all'){const s=ss.find(x=>String(x.set)===String(f)),r=s&&s.participation&&s.participation[id];return r?Number(r.percentage||0):0}
   let played=0,total=0;
   ss.forEach(s=>{
     const r=s.participation&&s.participation[id];
     const setPoints=Math.max(0,(Number(s.scores?.castellar)||0)+(Number(s.scores?.rival)||0));
     if(r && Number.isFinite(Number(r.playedPoints))){
       played+=Number(r.playedPoints)||0;
       total+=setPoints;
     }else{
       if(r)played+=Number(r.playedMs)||0;
       const vals=Object.values(s.participation||{}).map(x=>Number(x.playedMs)||0);
       total+=vals.length?Math.max(...vals):0;
     }
   });
   return total?Math.round(played/total*1000)/10:0;
 }
 function reportSetPct(m,id,setNo){
   const s=allReportSets(m).find(x=>Number(x.set)===Number(setNo));
   const r=s&&s.participation&&s.participation[id];
   if(!r)return null;
   if(Number.isFinite(Number(r.playedPoints)))return Number(r.playedPoints)>0?Number(r.percentage||0):null;
   return Number(r.playedMs)>0?Number(r.percentage||0):null;
 }
 function ratingClass(action,value){
   value=Number(value);
   if(value===0)return 'rating-red';
   if(action==='Bloqueig')return value===1?'rating-blue':'rating-green';
   if(value===1)return 'rating-yellow';
   if(value===2)return 'rating-blue';
   return 'rating-green';
 }

 let directEditMode=false;
 let directEditDraft=null;

 function currentEditMatch(){ return directEditMode && directEditDraft ? directEditDraft : match; }

 function editableActionsContainer(m,setFilter){
   if(m.legacy) return m.completedSets && m.completedSets[0];
   const n=Number(setFilter);
   return (m.completedSets||[]).find(s=>Number(s.set)===n);
 }

 function adjustDirectStat(playerId,action,value,delta){
   const f=$('reportSetFilter');
   const filter=f?f.value:'all';
   const m=directEditDraft;
   if(!m)return;
   const setObj=editableActionsContainer(m,filter);
   if(!setObj)return;
   setObj.actions=setObj.actions||[];
   if(delta>0){
     setObj.actions.push({playerId,action,value:Number(value),set:Number(setObj.set)||1,time:Date.now(),corrected:true});
   }else{
     for(let i=setObj.actions.length-1;i>=0;i--){
       const a=setObj.actions[i];
       if(a.playerId===playerId && a.action===action && Number(a.value)===Number(value)){
         setObj.actions.splice(i,1);break;
       }
     }
   }
   renderReportTable(m,filter);
   renderPlayerEvaluations(m);
 }

 function setupDirectEdit(m){
   const card=$('directEditCard'),btn=$('directEditBtn'),actions=$('directEditActions');
   if(!card)return;
   card.hidden=!viewingHistory;
   if(!viewingHistory)return;

   btn.onclick=()=>{
     const f=$('reportSetFilter');
     if(!m.legacy && (!f || f.value==='all')){
       alert('Per editar un partit nou, selecciona primer el Set 1, Set 2, etc. El Total partit es calcula automàticament a partir dels sets.');
       return;
     }
     directEditMode=true;
     directEditDraft=JSON.parse(JSON.stringify(m));
     btn.hidden=true; actions.hidden=false;
     renderReportTable(directEditDraft,f.value);
   };

   $('cancelDirectEdit').onclick=()=>{
     directEditMode=false;directEditDraft=null;btn.hidden=false;actions.hidden=true;
     renderReportTable(m,$('reportSetFilter').value);renderPlayerEvaluations(m);
   };

   $('saveDirectEdit').onclick=async()=>{
     if(!directEditDraft)return;
     await idbPut(directEditDraft);await refreshHistoryCache();
     match=JSON.parse(JSON.stringify(directEditDraft));
     m=match;
     directEditMode=false;directEditDraft=null;btn.hidden=false;actions.hidden=true;
     renderFinalReport(match);
   };
 }
 function renderReportTable(m,f='all'){
   const table=$('reportTable'),acts=reportActionsFor(m,f),allMode=f==='all';
   let top='<tr><th rowspan="2" class="sticky-number">Dorsal</th><th rowspan="2" class="sticky-name">Jugadora</th>';
   if(allMode)top+='<th colspan="6" class="group-head">SETS</th>';
   else top+='<th colspan="1" class="group-head">PARTICIPACIÓ</th>';
   top+='<th colspan="4" class="group-head">SERVEI</th><th colspan="4" class="group-head">RECEPCIÓ</th><th colspan="4" class="group-head">COL·LOCACIÓ</th><th colspan="4" class="group-head">ATAC</th><th colspan="3" class="group-head">BLOQUEIG</th></tr>';
   let sub='<tr>';
   if(allMode)sub+=['S1','S2','S3','S4','S5','Total'].map(x=>'<th class="sub-neutral">'+x+'</th>').join('');
   else sub+='<th class="sub-neutral">Set '+f+'</th>';
   const sub4=['sub-red','sub-yellow','sub-blue','sub-green'];
   for(let g=0;g<4;g++)sub+=sub4.map((c,i)=>'<th class="'+c+'">'+i+'</th>').join('');
   sub+=['sub-red','sub-blue','sub-green'].map((c,i)=>'<th class="'+c+'">'+i+'</th>').join('');
   sub+='</tr>';
   table.tHead.innerHTML=top+sub;

   const body=table.tBodies[0];body.innerHTML='';
   (m.players||[]).slice().sort((a,b)=>Number(a.number)-Number(b.number)).forEach(pl=>{
     const tr=document.createElement('tr');
     const add=(txt,cls='')=>{const td=document.createElement('td');td.className=cls;td.textContent=txt;tr.appendChild(td)};
     add(pl.number,'sticky-number');add(pl.name,'sticky-name');
     if(allMode){
       let total=0;
       for(let s=1;s<=5;s++){const p=reportSetPct(m,pl.id,s);if(p!==null)total+=p/100;add(p===null?'':Math.round(p)+'%','set-cell')}
       add(total?total.toFixed(2).replace(/\.00$/,''):'','set-cell');
     }else{
       const p=reportSetPct(m,pl.id,Number(f));add(p===null?'':Math.round(p)+'%','set-cell');
     }
     ['Servei','Recepció','Col·locació','Atac','Bloqueig'].forEach(action=>{
       const vals=(m.legacy && !allMode)
         ? Array(action==='Bloqueig'?3:4).fill('')
         : actionCounts(acts,pl.id,action);
       vals.forEach((n,v)=>{
         if(directEditMode && m===directEditDraft && (m.legacy || !allMode)){
           const td=document.createElement('td');td.className=ratingClass(action,v)+' editing-cell';
           const wrap=document.createElement('div');wrap.className='edit-stat';
           const minus=document.createElement('button');minus.type='button';minus.textContent='−';minus.disabled=Number(n)<=0;
           const span=document.createElement('span');span.textContent=n;
           const plus=document.createElement('button');plus.type='button';plus.textContent='+';
           minus.onclick=()=>adjustDirectStat(pl.id,action,v,-1);
           plus.onclick=()=>adjustDirectStat(pl.id,action,v,1);
           wrap.append(minus,span,plus);td.appendChild(wrap);tr.appendChild(td);
         }else add(n,ratingClass(action,v));
       });
     });
     body.appendChild(tr);
   });
 }

 function reportSubstitutions(m){
   return allReportSets(m).flatMap(setObj=>(setObj.substitutions||[]).map(ch=>{
     const sc=ch.score||{};
     const hasScore=Number.isFinite(Number(sc.castellar))&&Number.isFinite(Number(sc.rival));
     return {
       set:Number(ch.set||setObj.set)||Number(setObj.set)||1,
       outNumber:ch.outNumber||'',outName:ch.outName||'',
       inNumber:ch.inNumber||'',inName:ch.inName||'',
       castellar:hasScore?Number(sc.castellar):null,
       rival:hasScore?Number(sc.rival):null
     };
   }));
 }
 function substitutionText(ch){
   const score=(ch.castellar===null||ch.rival===null)?'marcador no disponible':('Castellar '+ch.castellar+' - '+ch.rival+' rival');
   return 'Set '+ch.set+' · '+score+' · surt '+ch.outNumber+' '+ch.outName+' · entra '+ch.inNumber+' '+ch.inName;
 }
 function renderReportSubstitutions(m){
   const root=$('reportSubstitutions'),card=$('reportSubstitutionsCard');
   if(!root||!card)return;
   const rows=reportSubstitutions(m);
   card.hidden=!rows.length;
   root.innerHTML=rows.length?rows.map(ch=>'<div style="padding:7px 0;border-bottom:1px solid #e5e7eb">'+substitutionText(ch)+'</div>').join(''):'';
 }

 function playerAssessment(m,pl){
   const acts=reportActionsFor(m,'all');
   const totalParticipation=[1,2,3,4,5].reduce((sum,s)=>{
     const p=reportSetPct(m,pl.id,s); return sum+(p===null?0:p/100);
   },0);

   function metric(action){
     const c=actionCounts(acts,pl.id,action),n=c.reduce((a,b)=>a+b,0);
     const pct=i=>n?(c[i]||0)/n:0;
     if(action==='Servei'){
       return {action,c,n,error:pct(0),low:pct(0)+pct(1),positive:pct(2)+pct(3),top:pct(3)};
     }
     if(action==='Bloqueig'){
       return {action,c,n,error:pct(0),low:pct(0),positive:pct(1)+pct(2),top:pct(2)};
     }
     return {action,c,n,error:pct(0),low:pct(0)+pct(1),positive:pct(2)+pct(3),top:pct(3)};
   }

   const ms=['Servei','Recepció','Col·locació','Atac','Bloqueig'].map(metric);
   const observations=[];
   const priorities=[];

   function enough(x){return x.n>=4}
   function strongSample(x){return x.n>=7}
   function pc(x){return Math.round(x*100)}
   function add(kind,action,text,weight){observations.push({kind,action,text,weight})}

   ms.forEach(x=>{
     if(!x.n)return;

     if(x.action==='Recepció'){
       if(strongSample(x) && x.low>=0.50){
         add('work',x.action,`Recepció — aspecte clar a treballar: ${x.c[0]+x.c[1]} de ${x.n} recepcions (${pc(x.low)}%) han estat 0–1. La primera pilota està dificultant massa la continuïtat del joc.`,x.low*100+x.n);
         priorities.push({action:x.action,score:x.low*100+x.n});
       } else if(enough(x) && x.positive>=0.70 && x.error<=0.15){
         add('strong',x.action,`Recepció — fiable: ${x.c[2]+x.c[3]} de ${x.n} recepcions (${pc(x.positive)}%) han estat 2–3${x.c[0]===0?', sense errors directes':''}. Dona continuïtat i facilita la construcció de la jugada.`,x.positive*100+x.n);
       } else if(enough(x) && x.low>=0.35){
         add('watch',x.action,`Recepció — irregular: el ${pc(x.low)}% de les ${x.n} recepcions són 0–1. Hi ha marge per estabilitzar la primera pilota.`,x.low*80+x.n);
         priorities.push({action:x.action,score:x.low*80+x.n});
       }
     }

     if(x.action==='Col·locació'){
       if(enough(x) && x.positive>=0.75){
         add('strong',x.action,`Col·locació — molt consistent: ${x.c[2]+x.c[3]} de ${x.n} accions (${pc(x.positive)}%) són 2–3. Quan intervé, construeix el joc amb molta fiabilitat.`,x.positive*95+x.n);
       } else if(strongSample(x) && x.low>=0.45){
         add('work',x.action,`Col·locació — a estabilitzar: ${pc(x.low)}% de ${x.n} accions han estat 0–1. Cal millorar la qualitat de la segona pilota per donar més opcions a l’atac.`,x.low*90+x.n);
         priorities.push({action:x.action,score:x.low*90+x.n});
       }
     }

     if(x.action==='Atac'){
       if(strongSample(x) && x.positive>=0.65){
         add('strong',x.action,`Atac — genera perill: ${x.c[2]+x.c[3]} de ${x.n} atacs (${pc(x.positive)}%) són 2–3, amb ${x.c[3]||0} de màxima valoració. Manté una aportació ofensiva alta.`,x.positive*105+x.top*20+x.n);
       } else if(enough(x) && x.error>=0.30){
         add('work',x.action,`Atac — massa error: ${x.c[0]} de ${x.n} atacs (${pc(x.error)}%) acaben en 0. La prioritat és reduir l’error sense perdre iniciativa ofensiva.`,x.error*100+x.n);
         priorities.push({action:x.action,score:x.error*100+x.n});
       } else if(enough(x) && x.positive<0.45){
         add('watch',x.action,`Atac — poca incidència: només el ${pc(x.positive)}% de ${x.n} atacs arriben a 2–3. Pot treballar per convertir més pilotes en accions ofensives de qualitat.`,(1-x.positive)*65+x.n);
         priorities.push({action:x.action,score:(1-x.positive)*65+x.n});
       }
     }

     if(x.action==='Servei'){
       if(strongSample(x) && x.top>=0.25 && x.error<=0.20){
         add('strong',x.action,`Servei — pressiona el rival: ${x.c[3]||0} de ${x.n} serveis (${pc(x.top)}%) són ace i l’error es manté en ${pc(x.error)}%. Combina agressivitat i control.`,x.top*100-x.error*30+x.n);
       } else if(enough(x) && x.error>=0.25){
         const tail=x.top>=0.20?' Tot i generar perill, el cost en error és elevat.':'';
         add('work',x.action,`Servei — risc elevat: ${x.c[0]} errors en ${x.n} serveis (${pc(x.error)}%).${tail} Convindria mantenir la pressió reduint el servei perdut.`,x.error*95+x.n);
         priorities.push({action:x.action,score:x.error*95+x.n});
       } else if(enough(x) && x.positive>=0.65){
         add('strong',x.action,`Servei — segur i exigent: ${pc(x.positive)}% dels ${x.n} serveis són 2–3 i només ${pc(x.error)}% acaben en error.`,x.positive*80-x.error*20+x.n);
       }
     }

     if(x.action==='Bloqueig'){
       if(x.n>=4 && x.top>=0.30){
         add('strong',x.action,`Bloqueig — impacte real: ${x.c[2]||0} de ${x.n} accions (${pc(x.top)}%) acaben directament en punt.`,x.top*70+x.n);
       } else if(x.n>=5 && x.error>=0.40){
         add('work',x.action,`Bloqueig — marge de millora: ${x.c[0]} de ${x.n} intents (${pc(x.error)}%) acaben fora. Cal ajustar lectura i timing.`,x.error*65+x.n);
         priorities.push({action:x.action,score:x.error*65+x.n});
       }
     }
   });

   observations.sort((a,b)=>b.weight-a.weight);
   const strongs=observations.filter(x=>x.kind==='strong').slice(0,2);
   const works=observations.filter(x=>x.kind!=='strong').slice(0,2);
   priorities.sort((a,b)=>b.score-a.score);

   const total=ms.reduce((s,x)=>s+x.n,0);
   let context='';
   if(total<10) context=`Mostra petita (${total} accions): les tendències són orientatives.`;
   else if(totalParticipation<1.5) context=`Ha participat aproximadament ${totalParticipation.toFixed(1).replace('.',',')} sets; tot i jugar poc, hi ha ${total} accions registrades per detectar tendències.`;
   else context=`Lectura basada en ${total} accions i aproximadament ${totalParticipation.toFixed(1).replace('.',',')} sets de participació.`;

   let summary;
   if(strongs.length && works.length) summary=`Perfil amb una aportació positiva en ${strongs.map(x=>x.action.toLowerCase()).join(' i ')}, però amb marge especialment en ${works[0].action.toLowerCase()}.`;
   else if(strongs.length) summary=`Partit sòlid en ${strongs.map(x=>x.action.toLowerCase()).join(' i ')}; amb les dades disponibles no apareix cap debilitat clara.`;
   else if(works.length) summary=`Les dades assenyalen marge de millora sobretot en ${works.map(x=>x.action.toLowerCase()).join(' i ')}.`;
   else summary='Partit sense una tendència prou marcada per destacar una fortalesa o una debilitat concreta.';

   const priority=priorities.length
     ? `Prioritat d’entrenament: ${priorities[0].action}. És l’àrea on les dades d’aquest partit mostren més marge de millora.`
     : `Prioritat d’entrenament: mantenir la regularitat i ampliar la mostra abans de fixar un aspecte prioritari.`;

   return {strongs,works,context,summary,priority,total};
 }
 function renderPlayerEvaluations(m){
   const root=$('playerEvaluations');if(!root)return;root.innerHTML='';
   (m.players||[]).slice().sort((a,b)=>Number(a.number)-Number(b.number)).forEach(pl=>{
     const played=[1,2,3,4,5].some(s=>reportSetPct(m,pl.id,s)!==null);
     if(!played)return;
     const a=playerAssessment(m,pl),box=document.createElement('div');box.className='player-eval';
     const strengths=a.strongs.length
       ? a.strongs.map(x=>'<div class="eval-observation eval-positive">'+x.text+'</div>').join('')
       : '<div class="eval-observation">No hi ha cap fortalesa prou marcada amb la mostra disponible.</div>';
     const work=a.works.length
       ? a.works.map(x=>'<div class="eval-observation eval-work">'+x.text+'</div>').join('')
       : '<div class="eval-observation">No apareix cap aspecte clarament deficitari en aquest partit.</div>';
     box.innerHTML=
       '<div class="player-eval-title">'+pl.number+' · '+pl.name+'</div>'+
       '<div class="eval-context">'+a.context+'</div>'+
       '<div class="eval-section"><b>Lectura tècnica</b>'+strengths+work+'</div>'+
       '<div class="eval-summary"><b>Síntesi</b> '+a.summary+'</div>'+
       '<div class="eval-priority"><b>'+a.priority+'</b></div>';
     root.appendChild(box);
   });
 }
 function renderFinalReport(m){
   const ss=allReportSets(m),won=ss.reduce((a,s)=>{if(+s.scores.castellar>+s.scores.rival)a.c++;else if(+s.scores.rival>+s.scores.castellar)a.r++;return a},{c:0,r:0});
   $('reportMatchTitle').textContent='Castellar – '+(m.opponent||'Rival');$('reportFinalResult').textContent=m.legacyResult||((won.c)+' – '+(won.r));
   $('reportSetsLine').textContent=ss.map(s=>'Set '+s.set+': '+s.scores.castellar+'–'+s.scores.rival).join(' · ');
   const f=$('reportSetFilter');f.innerHTML='<option value="all">Total partit</option>';ss.forEach(s=>{const o=document.createElement('option');o.value=s.set;o.textContent='Set '+s.set;f.appendChild(o)});
   if(m.legacy){
     const legacySets=allReportSets(m).map(s=>Number(s.set)).filter(Boolean);
     f.innerHTML='<option value="all">Total partit</option>'+legacySets.map(n=>'<option value="'+n+'">Set '+n+'</option>').join('');
     f.disabled=false;
     $('reportSetsLine').textContent='Partit importat de l’ODS original · per set es conserva la participació; les accions de l’ODS són totals del partit';
   }else f.disabled=false;
   f.onchange=()=>{
     if(directEditMode){directEditMode=false;directEditDraft=null;const a=$('directEditActions'),b=$('directEditBtn');if(a)a.hidden=true;if(b)b.hidden=false;}
     renderReportTable(m,f.value);
   };
   renderReportTable(m,'all');renderPlayerEvaluations(m);renderReportSubstitutions(m);setupDirectEdit(m);
   const delCard=$('historyDeleteCard'),delBtn=$('deleteHistoryMatchBtn');
   if(delCard)delCard.hidden=!viewingHistory;
   if(delBtn&&viewingHistory)delBtn.onclick=async()=>{
     if(!confirm('Vols eliminar aquest partit de l’historial?\n\nAquest partit deixarà de comptar en les estadístiques globals i en l’evolució de les jugadores.'))return;
     if(!confirm('SEGONA CONFIRMACIÓ\n\nAquesta acció és definitiva i no es pot desfer. Eliminar el partit?'))return;
     await deleteArchivedMatch(m.id);
     viewingHistory=false;match=null;
     if(typeof window.statsNavigate==='function')window.statsNavigate('history',true);
     setTimeout(renderHistory,0);
   };
 }
 const reportBack=$('reportBackBtn');
 if(reportBack)reportBack.onclick=()=>{directEditMode=false;directEditDraft=null;const dest=viewingHistory?'history':'home';viewingHistory=false;if(typeof window.statsNavigate==='function')window.statsNavigate(dest,true);if(dest==='history')setTimeout(renderHistory,0)};


 const EXPORT_COLORS={
   red:'F4CCCC', yellow:'FFF2CC', blue:'CFE2F3', green:'D9EAD3',
   navy:'1F4E78', navy2:'17283F', lightBlue:'D9EAF7', pale:'F8FAFC',
   border:'A6A6A6', white:'FFFFFF'
 };
 function ratingColor(action,value){
   value=Number(value);
   if(value===0)return EXPORT_COLORS.red;
   if(action==='Bloqueig')return value===1?EXPORT_COLORS.blue:EXPORT_COLORS.green;
   if(value===1)return EXPORT_COLORS.yellow;
   if(value===2)return EXPORT_COLORS.blue;
   return EXPORT_COLORS.green;
 }
 function cleanExportText(s){return String(s??'').replace(/[–—]/g,'-');}
 function safeFileName(s){return String(s||'partit').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')}
 function dateDMY(s){if(!s)return '';const p=String(s).split('-');return p.length===3?p[2]+'-'+p[1]+'-'+p[0]:String(s)}
 function downloadBlob(blob,name){
   const u=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=u;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(u),2500);
 }
 function exportBaseName(m){return safeFileName('Stats_Castellar_'+dateDMY(m.date)+'_'+(m.opponent||'Rival'))}
 function exportSets(m){return allReportSets(m)}
 function finalScore(m){
   return exportSets(m).reduce((a,s)=>{if(+s.scores.castellar>+s.scores.rival)a[0]++;else if(+s.scores.rival>+s.scores.castellar)a[1]++;return a},[0,0]);
 }
 function playersSorted(m){return (m.players||[]).slice().sort((a,b)=>Number(a.number)-Number(b.number))}
 function actionGroups(){
   return [
     {name:'Servei',values:[0,1,2,3]},
     {name:'Recepció',values:[0,1,2,3]},
     {name:'Col·locació',values:[0,1,2,3]},
     {name:'Atac',values:[0,1,2,3]},
     {name:'Bloqueig',values:[0,1,2]}
   ];
 }
 function allActions(m){return exportSets(m).flatMap(s=>Array.isArray(s.actions)?s.actions:[])}
 function countsFor(actions,id,action,values){
   const out=values.map(()=>0);
   actions.forEach(a=>{if(a.playerId===id&&a.action===action){const k=values.indexOf(Number(a.value));if(k>=0)out[k]++}});
   return out;
 }
 function setParticipation(m,id,setNo){
   const s=exportSets(m).find(x=>Number(x.set)===Number(setNo));
   const r=s&&s.participation&&s.participation[id];
   if(!r)return null;
   const played=Number.isFinite(Number(r.playedPoints))?Number(r.playedPoints):Number(r.playedMs);
   if(!(played>0))return null;
   return Math.max(0,Math.min(100,Number(r.percentage)||0));
 }
 function totalSetsPlayed(m,id){
   let sum=0;
   for(let s=1;s<=5;s++){const p=setParticipation(m,id,s);if(p!==null)sum+=p/100}
   return Math.round(sum*100)/100;
 }
 function fullHeaders(){
   const h=['DORSAL','NOM','S1','S2','S3','S4','S5','TOTAL SETS'];
   actionGroups().forEach(g=>g.values.forEach(v=>h.push(g.name+' '+v)));
   return h;
 }
 function fullRows(m){
   const acts=allActions(m);
   return playersSorted(m).map(pl=>{
     const row=[pl.number,pl.name];
     for(let s=1;s<=5;s++)row.push(setParticipation(m,pl.id,s));
     row.push(totalSetsPlayed(m,pl.id));
     actionGroups().forEach(g=>row.push(...countsFor(acts,pl.id,g.name,g.values)));
     return row;
   });
 }
 function percentageRows(m){
   const acts=allActions(m);
   return playersSorted(m).map(pl=>{
     const row=[pl.number,pl.name,totalSetsPlayed(m,pl.id)];
     actionGroups().forEach(g=>{
       const c=countsFor(acts,pl.id,g.name,g.values), total=c.reduce((a,b)=>a+b,0);
       c.forEach(n=>row.push(total?n/total:null));
     });
     return row;
   });
 }
 const GLOBAL_PERFORMANCE_K=10;
 function rawActionPerformance(actions,playerId,g){
   const vals=actions.filter(a=>(playerId===null||a.playerId===playerId)&&a.action===g.name)
                     .map(a=>Number(a.value)).filter(Number.isFinite);
   const max=Math.max(...g.values);
   return {count:vals.length,value:vals.length&&max>0?vals.reduce((a,b)=>a+b,0)/(vals.length*max):null};
 }
 function globalPerformanceRows(m){
   const acts=allActions(m);
   const teamMeans={};
   actionGroups().forEach(g=>{teamMeans[g.name]=rawActionPerformance(acts,null,g).value;});
   return playersSorted(m).map(pl=>{
     const row=[pl.number,pl.name,totalSetsPlayed(m,pl.id)];
     actionGroups().forEach(g=>{
       const own=rawActionPerformance(acts,pl.id,g);
       const team=teamMeans[g.name];
       row.push(own.count&&team!==null
         ? ((own.value*own.count)+(team*GLOBAL_PERFORMANCE_K))/(own.count+GLOBAL_PERFORMANCE_K)
         : null);
     });
     return row;
   });
 }
 function teamGlobalPerformanceRow(m){
   const acts=allActions(m),row=['','TOTAL EQUIP',exportSets(m).length];
   actionGroups().forEach(g=>row.push(rawActionPerformance(acts,null,g).value));
   return row;
 }
 function globalPerformanceHeaders(){return ['DORSAL','NOM','SETS',...actionGroups().map(g=>g.name.toUpperCase())]}
 function performanceBand(v){
   if(v===null||v===undefined||!Number.isFinite(Number(v)))return null;
   v=Number(v);
   if(v>=0.80)return 'green';
   if(v>=0.65)return 'blue';
   if(v>=0.50)return 'yellow';
   return 'red';
 }
 function performanceHex(v){
   const b=performanceBand(v);
   return b==='green'?EXPORT_COLORS.green:b==='blue'?EXPORT_COLORS.blue:b==='yellow'?EXPORT_COLORS.yellow:b==='red'?EXPORT_COLORS.red:null;
 }
 function performanceLegend(){
   return [
     'Rendiment corregit = ((rendiment brut × accions) + (mitjana equip × K)) / (accions + K), amb K=10.',
     'La mitjana de l’equip es calcula per separat per a cada tipus d’acció.',
     'Verd: 80–100% · Blau: 65–79% · Groc: 50–64% · Vermell: menys del 50%.',
     'Cel·la buida = la jugadora no ha registrat cap acció d’aquell tipus.'
   ];
 }

 function percentageHeaders(){
   const h=['DORSAL','NOM','SETS'];
   actionGroups().forEach(g=>g.values.forEach(v=>h.push(g.name+' '+v)));
   return h;
 }
 function teamPercentageRow(m){
   const acts=allActions(m), row=['','TOTAL EQUIP',exportSets(m).length];
   actionGroups().forEach(g=>{
     const c=g.values.map(()=>0);
     playersSorted(m).forEach(pl=>countsFor(acts,pl.id,g.name,g.values).forEach((n,i)=>c[i]+=n));
     const total=c.reduce((a,b)=>a+b,0);
     c.forEach(n=>row.push(total?n/total:null));
   });
   return row;
 }
 function xmlEsc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
 function colName(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s}
 function legendLines(){
   return [
     'Servei: 0 = Error · 1 = Fàcil · 2 = Correcte · 3 = Ace',
     'Recepció, Col·locació i Atac: 0 = Error · 1 = Dolenta · 2 = Correcte · 3 = Perfecta',
     'Bloqueig: 0 = Bloqueig fora · 1 = Bloqueig · 2 = Bloqueig punt',
     'Participació per set: 100% = tots els punts del set a pista; percentatge inferior = ha entrat o sortit; cel·la buida = no ha jugat.'
   ];
 }

 // ---------- PDF: 2 pàgines, mateix esquema lògic que l'ODS ----------
 async function exportPDF(m,mode='save'){
   if(!window.jspdf||!window.jspdf.jsPDF)throw new Error('No s’ha pogut carregar el generador PDF.');
   const {jsPDF}=window.jspdf, doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
   const score=finalScore(m), rival=m.opponent||'Rival', ss=exportSets(m);
   const meta=()=>{
     doc.setFontSize(16);doc.text('FULL D’ESTADÍSTIQUES DE PARTIT',12,12);
     doc.setFontSize(9);
     doc.text('Equip: F.S. Castellar Volei',12,18);
     doc.text('Rival: '+rival,75,18);
     doc.text('Data: '+dateDMY(m.date),145,18);
     doc.text('Lloc: '+(m.venue==='home'?'Casa':'Fora'),205,18);
     doc.text('Resultat: '+score[0]+'-'+score[1],12,23);
     doc.text(ss.map(s=>'S'+s.set+' '+s.scores.castellar+'-'+s.scores.rival).join('   '),75,23);
   };
   meta();
   const headers=fullHeaders(), body=fullRows(m).map(r=>r.map((v,i)=>i>=2&&i<=6?(v===null?'':Math.round(v)+'%'):v));
   const pdfHead=[
     [
       {content:'DORSAL',rowSpan:2},{content:'NOM',rowSpan:2},
       {content:'SETS',colSpan:6,styles:{fillColor:[207,226,243],textColor:[0,0,0]}},
       {content:'SERVEI',colSpan:4,styles:{fillColor:[207,226,243],textColor:[0,0,0]}},
       {content:'RECEPCIÓ',colSpan:4,styles:{fillColor:[207,226,243],textColor:[0,0,0]}},
       {content:'COL·LOCACIÓ',colSpan:4,styles:{fillColor:[207,226,243],textColor:[0,0,0]}},
       {content:'ATAC',colSpan:4,styles:{fillColor:[207,226,243],textColor:[0,0,0]}},
       {content:'BLOQUEIG',colSpan:3,styles:{fillColor:[207,226,243],textColor:[0,0,0]}}
     ],
     ['S1','S2','S3','S4','S5','TOTAL','0','1','2','3','0','1','2','3','0','1','2','3','0','1','2','3','0','1','2']
   ];
   const styles={0:{cellWidth:10},1:{cellWidth:22}};
   for(let i=2;i<=6;i++)styles[i]={cellWidth:10};
   styles[7]={cellWidth:12};
   let idx=8;
   actionGroups().forEach(g=>g.values.forEach(v=>{
     const hex=ratingColor(g.name,v);
     styles[idx++]={cellWidth:8,fillColor:'#'+hex};
   }));
   doc.autoTable({
     startY:28,head:pdfHead,body,
     styles:{fontSize:5.7,cellPadding:1.0,lineWidth:.08,lineColor:[166,166,166],halign:'center'},
     headStyles:{fillColor:[31,78,120],textColor:[255,255,255],fontStyle:'bold'},
     columnStyles:styles,margin:{left:5,right:5}
   });
   let y=doc.lastAutoTable.finalY+5; doc.setFontSize(7.2);
   legendLines().forEach(line=>{doc.text(line,10,y);y+=4});
   const subsPdf=reportSubstitutions(m);
   if(subsPdf.length){
     y+=2;
     if(y+5+subsPdf.length*4>195){doc.addPage();y=14;}
     doc.setFont(undefined,'bold');doc.text('CANVIS',10,y);y+=4;doc.setFont(undefined,'normal');
     subsPdf.forEach(ch=>{doc.text(cleanExportText(substitutionText(ch)),10,y);y+=4;});
   }

   doc.addPage();
   doc.setFontSize(16);doc.text('PERCENTATGES PER JUGADORA',12,12);
   const pb=percentageRows(m).map(r=>r.map((v,i)=>i>=3?(v===null?'':Math.round(v*100)+'%'):v));
   const percentagePdfHead=[
     [
       {content:'DORSAL',rowSpan:2},{content:'NOM',rowSpan:2},{content:'SETS',rowSpan:2},
       {content:'SERVEI',colSpan:4,styles:{fillColor:[207,226,243],textColor:[0,0,0]}},
       {content:'RECEPCIÓ',colSpan:4,styles:{fillColor:[207,226,243],textColor:[0,0,0]}},
       {content:'COL·LOCACIÓ',colSpan:4,styles:{fillColor:[207,226,243],textColor:[0,0,0]}},
       {content:'ATAC',colSpan:4,styles:{fillColor:[207,226,243],textColor:[0,0,0]}},
       {content:'BLOQUEIG',colSpan:3,styles:{fillColor:[207,226,243],textColor:[0,0,0]}}
     ],
     ['0','1','2','3','0','1','2','3','0','1','2','3','0','1','2','3','0','1','2']
   ];
   const ps={0:{cellWidth:10},1:{cellWidth:22},2:{cellWidth:11}};
   idx=3;
   actionGroups().forEach(g=>g.values.forEach(v=>{ps[idx++]={cellWidth:9,fillColor:'#'+ratingColor(g.name,v)}}));
   const team=teamPercentageRow(m).map((v,i)=>i>=3?(v===null?'':Math.round(v*100)+'%'):v);
   doc.autoTable({
     startY:18,head:percentagePdfHead,body:[...pb,team],
     styles:{fontSize:6,cellPadding:1.1,lineWidth:.08,lineColor:[166,166,166],halign:'center'},
     headStyles:{fillColor:[31,78,120],textColor:[255,255,255],fontStyle:'bold'},
     columnStyles:ps,margin:{left:7,right:7}
   });
   y=doc.lastAutoTable.finalY+5;doc.setFontSize(7.2);
   legendLines().slice(0,3).forEach(line=>{doc.text(line,10,y);y+=4});

   const gpHeaders=globalPerformanceHeaders();
   const gpRows=globalPerformanceRows(m),gpTeam=teamGlobalPerformanceRow(m);
   y+=3;
   if(y>115){doc.addPage();y=14;}
   doc.setFontSize(11);doc.setFont(undefined,'bold');doc.text('RENDIMENT CORREGIT PER ACCIÓ',12,y);doc.setFont(undefined,'normal');y+=4;
   doc.autoTable({
     startY:y,head:[gpHeaders],
     body:[...gpRows,gpTeam].map(r=>r.map((v,i)=>i>=3?(v===null?'':Math.round(v*100)+'%'):v)),
     styles:{fontSize:7,cellPadding:1.4,lineWidth:.08,lineColor:[166,166,166],halign:'center'},
     headStyles:{fillColor:[31,78,120],textColor:[255,255,255],fontStyle:'bold'},
     columnStyles:{0:{cellWidth:14},1:{cellWidth:30},2:{cellWidth:14}},
     didParseCell:function(h){
       if(h.section==='body' && h.column.index>=3){
         const raw=(h.row.index<gpRows.length?gpRows[h.row.index]:gpTeam)[h.column.index];
         const hex=performanceHex(raw);
         if(hex)h.cell.styles.fillColor='#'+hex;
       }
     },
     margin:{left:20,right:20}
   });
   y=doc.lastAutoTable.finalY+5;doc.setFontSize(7.2);
   performanceLegend().forEach(line=>{doc.text(line,12,y);y+=4});
   const fileName=exportBaseName(m)+'.pdf';
   if(mode==='blob') return {blob:doc.output('blob'),fileName};
   doc.save(fileName);
 }

 // ---------- XLSX ----------
 function xlsxStylesXml(){
   const fills=['FFFFFF',EXPORT_COLORS.navy,EXPORT_COLORS.red,EXPORT_COLORS.yellow,EXPORT_COLORS.blue,EXPORT_COLORS.green,EXPORT_COLORS.lightBlue];
   return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts>
<fills count="${fills.length+2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.map(x=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${x}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills>
<borders count="2"><border/><border><left style="thin"><color rgb="FFA6A6A6"/></left><right style="thin"><color rgb="FFA6A6A6"/></right><top style="thin"><color rgb="FFA6A6A6"/></top><bottom style="thin"><color rgb="FFA6A6A6"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="8" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="10" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
 }
 function xlsxCell(v,r,c,style){
   const ref=colName(c+1)+r;
   if(v===null||v===undefined||v==='')return `<c r="${ref}" s="${style}"/>`;
   if(typeof v==='number')return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
   return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${xmlEsc(v)}</t></is></c>`;
 }
 function styleForActionCol(ci,start){
   let k=ci-start;
   for(const g of actionGroups()){
     if(k<g.values.length){const c=ratingColor(g.name,g.values[k]);return c===EXPORT_COLORS.red?2:c===EXPORT_COLORS.yellow?3:c===EXPORT_COLORS.blue?4:5}
     k-=g.values.length;
   }
   return 8;
 }
 function xlsxPerformanceStyle(v){
   const b=performanceBand(v);
   return b==='red'?2:b==='yellow'?3:b==='blue'?4:b==='green'?5:8;
 }
 function xlsxFullSheet(m){
   const score=finalScore(m),rival=m.opponent||'Rival',headers=fullHeaders(),rows=fullRows(m);
   const top=[
     ['FULL D’ESTADÍSTIQUES DE PARTIT'],[],
     ['Equip','F.S. Castellar Volei','','','','','','Rival',rival,'','','','','','Data',dateDMY(m.date),'','','Lloc',m.venue==='home'?'Casa':'Fora'],
     ['Resultat',score[0]+'-'+score[1]]
   ];
   let xml='',r=1;
   top.forEach(row=>{xml+=`<row r="${r}">${row.map((v,c)=>xlsxCell(v,r,c,r===1?1:0)).join('')}</row>`;r++});
   r++;
   const groupRow=r;
   const groups=['DORSAL','NOM','SETS','','','','','','SERVEI','','','','RECEPCIÓ','','','','COL·LOCACIÓ','','','','ATAC','','','','BLOQUEIG','',''];
   xml+=`<row r="${r}">${groups.map((v,c)=>xlsxCell(v,r,c,1)).join('')}</row>`;r++;
   xml+=`<row r="${r}">${['','', 'S1','S2','S3','S4','S5','TOTAL','0','1','2','3','0','1','2','3','0','1','2','3','0','1','2','3','0','1','2'].map((v,c)=>xlsxCell(v,r,c,1)).join('')}</row>`;r++;
   rows.forEach(row=>{
     xml+=`<row r="${r}">`+row.map((v,c)=>{
       if(c>=2&&c<=6)return xlsxCell(v===null?null:v/100,r,c,9);
       if(c>=8)return xlsxCell(v,r,c,styleForActionCol(c,8));
       return xlsxCell(v,r,c,8);
     }).join('')+`</row>`;r++;
   });
   r+=2;
   legendLines().forEach((line,i)=>{xml+=`<row r="${r}">${xlsxCell(i===0?'LLEGENDA':'',r,0,7)}${xlsxCell(line,r,1,0)}</row>`;r++});
   const subs=reportSubstitutions(m);
   if(subs.length){
     r+=1;
     xml+=`<row r="${r}">${xlsxCell('CANVIS',r,0,7)}${xlsxCell('SET',r,1,1)}${xlsxCell('MARCADOR CASTELLAR-RIVAL',r,2,1)}${xlsxCell('SURT',r,3,1)}${xlsxCell('ENTRA',r,4,1)}</row>`;r++;
     subs.forEach(ch=>{
       const marcador=(ch.castellar===null||ch.rival===null)?'No disponible':(ch.castellar+'-'+ch.rival);
       xml+=`<row r="${r}">${xlsxCell('',r,0,8)}${xlsxCell(ch.set,r,1,8)}${xlsxCell(marcador,r,2,8)}${xlsxCell((ch.outNumber+' '+ch.outName).trim(),r,3,8)}${xlsxCell((ch.inNumber+' '+ch.inName).trim(),r,4,8)}</row>`;r++;
     });
   }
   const widths=headers.map((_,i)=>`<col min="${i+1}" max="${i+1}" width="${i===1?18:(i>=2&&i<=7?11:9)}" customWidth="1"/>`).join('');
   return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths}</cols><sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="6" topLeftCell="C7" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetData>${xml}</sheetData><mergeCells count="8"><mergeCell ref="A6:A7"/><mergeCell ref="B6:B7"/><mergeCell ref="C6:H6"/><mergeCell ref="I6:L6"/><mergeCell ref="M6:P6"/><mergeCell ref="Q6:T6"/><mergeCell ref="U6:X6"/><mergeCell ref="Y6:AA6"/></mergeCells></worksheet>`;
 }
 function xlsxPercentSheet(m){
   const headers=percentageHeaders(),rows=percentageRows(m),team=teamPercentageRow(m);
   let xml=`<row r="1">${xlsxCell('PERCENTATGES PER JUGADORA',1,0,1)}</row><row r="2"></row>`,r=3;
   xml+=`<row r="${r}">${headers.map((v,c)=>xlsxCell(v,r,c,1)).join('')}</row>`;r++;
   rows.forEach(row=>{
     xml+=`<row r="${r}">`+row.map((v,c)=>xlsxCell(v,r,c,c>=3?(v===null?8:styleForActionCol(c,3)):8)).join('')+`</row>`;r++;
   });
   r+=2;xml+=`<row r="${r}">${headers.map((v,c)=>xlsxCell(v,r,c,1)).join('')}</row>`;r++;
   xml+=`<row r="${r}">`+team.map((v,c)=>xlsxCell(v,r,c,c>=3?(v===null?8:styleForActionCol(c,3)):8)).join('')+`</row>`;r+=3;
   legendLines().slice(0,3).forEach((line,i)=>{xml+=`<row r="${r}">${xlsxCell(i===0?'LECTURA DEL FULL':'',r,0,7)}${xlsxCell(line,r,1,0)}</row>`;r++});

   const gh=globalPerformanceHeaders(),gr=globalPerformanceRows(m),gt=teamGlobalPerformanceRow(m);
   r+=2;xml+=`<row r="${r}">${xlsxCell('RENDIMENT CORREGIT PER ACCIÓ',r,0,1)}</row>`;r++;
   xml+=`<row r="${r}">${gh.map((v,c)=>xlsxCell(v,r,c,1)).join('')}</row>`;r++;
   gr.forEach(row=>{
     xml+=`<row r="${r}">`+row.map((v,c)=>xlsxCell(c>=3&&v!==null?v:null,r,c,c>=3?xlsxPerformanceStyle(v):8)).join('')+`</row>`;r++;
   });
   r++;
   xml+=`<row r="${r}">`+gt.map((v,c)=>xlsxCell(c>=3&&v!==null?v:null,r,c,c>=3?xlsxPerformanceStyle(v):8)).join('')+`</row>`;r+=2;
   performanceLegend().forEach((line,i)=>{xml+=`<row r="${r}">${xlsxCell(i===0?'LECTURA RENDIMENT':'',r,0,7)}${xlsxCell(line,r,1,0)}</row>`;r++});
   const widths=headers.map((_,i)=>`<col min="${i+1}" max="${i+1}" width="${i===1?18:10}" customWidth="1"/>`).join('');
   return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths}</cols><sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="3" topLeftCell="C4" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetData>${xml}</sheetData></worksheet>`;
 }
 async function exportXLSX(m){
   if(!window.JSZip)throw new Error('JSZip no disponible');
   const zip=new JSZip();
   zip.folder('docProps').file('core.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Stats Castellar</dc:creator><cp:lastModifiedBy>Stats Castellar</cp:lastModifiedBy></cp:coreProperties>`);
   zip.folder('docProps').file('app.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Stats Castellar</Application></Properties>`);
   zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
   zip.folder('_rels').file('.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
   zip.folder('xl').file('workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView/></bookViews><sheets><sheet name="Full de partit" sheetId="1" r:id="rId1"/><sheet name="Percentatges" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029"/></workbook>`);
   zip.folder('xl').folder('_rels').file('workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
   zip.folder('xl').file('styles.xml',xlsxStylesXml());
   const ws=zip.folder('xl').folder('worksheets');ws.file('sheet1.xml',xlsxFullSheet(m));ws.file('sheet2.xml',xlsxPercentSheet(m));
   const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
   downloadBlob(blob,exportBaseName(m)+'.xlsx');
 }

 // ---------- ODS: exactament 2 fulls ----------
 function odsStyles(){
   return `<style:style style:name="Header" style:family="table-cell"><style:table-cell-properties fo:background-color="#${EXPORT_COLORS.navy}" fo:border="0.5pt solid #${EXPORT_COLORS.border}"/><style:text-properties fo:color="#FFFFFF" fo:font-weight="bold"/></style:style>
<style:style style:name="Cell" style:family="table-cell"><style:table-cell-properties fo:border="0.5pt solid #${EXPORT_COLORS.border}"/></style:style>
<style:style style:name="Pct" style:family="table-cell" style:data-style-name="P0"><style:table-cell-properties fo:border="0.5pt solid #${EXPORT_COLORS.border}"/></style:style>
<style:style style:name="Red" style:family="table-cell"><style:table-cell-properties fo:background-color="#${EXPORT_COLORS.red}" fo:border="0.5pt solid #${EXPORT_COLORS.border}"/></style:style>
<style:style style:name="Yellow" style:family="table-cell"><style:table-cell-properties fo:background-color="#${EXPORT_COLORS.yellow}" fo:border="0.5pt solid #${EXPORT_COLORS.border}"/></style:style>
<style:style style:name="Blue" style:family="table-cell"><style:table-cell-properties fo:background-color="#${EXPORT_COLORS.blue}" fo:border="0.5pt solid #${EXPORT_COLORS.border}"/></style:style>
<style:style style:name="Green" style:family="table-cell"><style:table-cell-properties fo:background-color="#${EXPORT_COLORS.green}" fo:border="0.5pt solid #${EXPORT_COLORS.border}"/></style:style>
<number:percentage-style style:name="P0"><number:number number:decimal-places="0"/><number:text>%</number:text></number:percentage-style>`;
 }
 function odsActionStyle(ci,start){
   let k=ci-start;
   for(const g of actionGroups()){
     if(k<g.values.length){const c=ratingColor(g.name,g.values[k]);return c===EXPORT_COLORS.red?'Red':c===EXPORT_COLORS.yellow?'Yellow':c===EXPORT_COLORS.blue?'Blue':'Green'}
     k-=g.values.length;
   }return 'Cell';
 }
 function odsPerformanceStyle(v){
   const b=performanceBand(v);
   return b==='red'?'Red':b==='yellow'?'Yellow':b==='blue'?'Blue':b==='green'?'Green':'Cell';
 }
 function odsCell(v,style='Cell',percentage=false){
   if(v===null||v===undefined||v==='')return `<table:table-cell table:style-name="${style}"/>`;
   if(typeof v==='number')return `<table:table-cell table:style-name="${style}" office:value-type="${percentage?'percentage':'float'}" office:value="${v}"><text:p>${percentage?Math.round(v*100)+'%':v}</text:p></table:table-cell>`;
   return `<table:table-cell table:style-name="${style}" office:value-type="string"><text:p>${xmlEsc(v)}</text:p></table:table-cell>`;
 }
 function odsRow(vals,styles=[],pcts=[]){return `<table:table-row>${vals.map((v,i)=>odsCell(v,styles[i]||'Cell',!!pcts[i])).join('')}</table:table-row>`}
 function odsFullTable(m){
   const score=finalScore(m),rival=m.opponent||'Rival',headers=fullHeaders(),rows=fullRows(m);
   let x=`<table:table table:name="Full de partit">`;
   x+=odsRow(['FULL D’ESTADÍSTIQUES DE PARTIT'],['Header'])+odsRow([]);
   x+=odsRow(['Equip','F.S. Castellar Volei','','','','','','Rival',rival,'','','','','','Data',dateDMY(m.date),'','','Lloc',m.venue==='home'?'Casa':'Fora']);
   x+=odsRow(['Resultat',score[0]+'-'+score[1]])+odsRow([]);
   x+=`<table:table-row><table:table-cell table:style-name="Header" office:value-type="string" table:number-rows-spanned="2"><text:p>DORSAL</text:p></table:table-cell><table:table-cell table:style-name="Header" office:value-type="string" table:number-rows-spanned="2"><text:p>NOM</text:p></table:table-cell><table:table-cell table:style-name="Header" office:value-type="string" table:number-columns-spanned="6"><text:p>SETS</text:p></table:table-cell>${'<table:covered-table-cell/>'.repeat(5)}<table:table-cell table:style-name="Header" office:value-type="string" table:number-columns-spanned="4"><text:p>SERVEI</text:p></table:table-cell>${'<table:covered-table-cell/>'.repeat(3)}<table:table-cell table:style-name="Header" office:value-type="string" table:number-columns-spanned="4"><text:p>RECEPCIÓ</text:p></table:table-cell>${'<table:covered-table-cell/>'.repeat(3)}<table:table-cell table:style-name="Header" office:value-type="string" table:number-columns-spanned="4"><text:p>COL·LOCACIÓ</text:p></table:table-cell>${'<table:covered-table-cell/>'.repeat(3)}<table:table-cell table:style-name="Header" office:value-type="string" table:number-columns-spanned="4"><text:p>ATAC</text:p></table:table-cell>${'<table:covered-table-cell/>'.repeat(3)}<table:table-cell table:style-name="Header" office:value-type="string" table:number-columns-spanned="3"><text:p>BLOQUEIG</text:p></table:table-cell>${'<table:covered-table-cell/>'.repeat(2)}</table:table-row>`;
   x+=`<table:table-row><table:covered-table-cell/><table:covered-table-cell/>${['S1','S2','S3','S4','S5','TOTAL','0','1','2','3','0','1','2','3','0','1','2','3','0','1','2','3','0','1','2'].map(v=>odsCell(v,'Header')).join('')}</table:table-row>`;
   rows.forEach(row=>{
     const styles=row.map((_,i)=>i>=8?odsActionStyle(i,8):(i>=2&&i<=6?'Pct':'Cell'));
     const pcts=row.map((_,i)=>i>=2&&i<=6);
     const vals=row.map((v,i)=>i>=2&&i<=6&&v!==null?v/100:v);
     x+=odsRow(vals,styles,pcts);
   });
   x+=odsRow([])+odsRow([]);
   legendLines().forEach((line,i)=>x+=odsRow([i===0?'COM ANOTAR LES ACCIONS':'',line],[i===0?'Header':'Cell','Cell']));
   const subs=reportSubstitutions(m);
   if(subs.length){
     x+=odsRow([])+odsRow(['CANVIS','SET','MARCADOR CASTELLAR-RIVAL','SURT','ENTRA'],['Header','Header','Header','Header','Header']);
     subs.forEach(ch=>{
       const marcador=(ch.castellar===null||ch.rival===null)?'No disponible':(ch.castellar+'-'+ch.rival);
       x+=odsRow(['',ch.set,marcador,(ch.outNumber+' '+ch.outName).trim(),(ch.inNumber+' '+ch.inName).trim()]);
     });
   }
   return x+'</table:table>';
 }
 function odsPercentTable(m){
   const headers=percentageHeaders(),rows=percentageRows(m),team=teamPercentageRow(m);
   let x=`<table:table table:name="Percentatges">`;
   x+=odsRow(['PERCENTATGES PER JUGADORA'],['Header'])+odsRow([])+odsRow(headers,headers.map(()=> 'Header'));
   rows.forEach(row=>{
     const styles=row.map((_,i)=>i>=3?odsActionStyle(i,3):'Cell'), pcts=row.map((_,i)=>i>=3);
     x+=odsRow(row,styles,pcts);
   });
   x+=odsRow([])+odsRow([])+odsRow(['EQUIP','TOTAL','SETS*',...headers.slice(3)],headers.map(()=> 'Header'));
   const team2=['','TOTAL EQUIP',team[2],...team.slice(3)];
   x+=odsRow(team2,team2.map((_,i)=>i>=3?odsActionStyle(i,3):'Cell'),team2.map((_,i)=>i>=3));
   x+=odsRow([])+odsRow([]);
   legendLines().slice(0,3).forEach((line,i)=>x+=odsRow([i===0?'LECTURA DEL FULL':'',line],[i===0?'Header':'Cell','Cell']));

   const gh=globalPerformanceHeaders(),gr=globalPerformanceRows(m),gt=teamGlobalPerformanceRow(m);
   x+=odsRow([])+odsRow([])+odsRow(['RENDIMENT CORREGIT PER ACCIÓ'],['Header'])+odsRow(gh,gh.map(()=> 'Header'));
   gr.forEach(row=>{
     const styles=row.map((v,i)=>i>=3?odsPerformanceStyle(v):'Cell');
     const pcts=row.map((_,i)=>i>=3);
     x+=odsRow(row,styles,pcts);
   });
   x+=odsRow([])+odsRow(gt,gt.map((v,i)=>i>=3?odsPerformanceStyle(v):'Cell'),gt.map((_,i)=>i>=3));
   x+=odsRow([])+odsRow([]);
   performanceLegend().forEach((line,i)=>x+=odsRow([i===0?'LECTURA RENDIMENT':'',line],[i===0?'Header':'Cell','Cell']));
   return x+'</table:table>';
 }
 async function exportODS(m){
   if(!window.JSZip)throw new Error('JSZip no disponible');
   const zip=new JSZip();
   zip.file('mimetype','application/vnd.oasis.opendocument.spreadsheet',{compression:'STORE'});
   zip.folder('META-INF').file('manifest.xml',`<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`);
   const content=`<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2"><office:automatic-styles>${odsStyles()}</office:automatic-styles><office:body><office:spreadsheet>${odsFullTable(m)}${odsPercentTable(m)}</office:spreadsheet></office:body></office:document-content>`;
   zip.file('content.xml',content);
   const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.oasis.opendocument.spreadsheet'});
   downloadBlob(blob,exportBaseName(m)+'.ods');
 }


 async function exportAssessmentPDF(m){
   if(!window.jspdf||!window.jspdf.jsPDF)throw new Error('No s’ha pogut carregar el generador PDF.');
   const {jsPDF}=window.jspdf;
   const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
   const W=210, margin=14, usable=W-margin*2;
   let y=15;

   const clean=s=>String(s??'').replace(/[–—]/g,'-');
   const dateText=(()=>{
     const p=String(m.date||'').split('-');
     return p.length===3?p[2]+'-'+p[1]+'-'+p[0]:(m.date||'');
   })();
   const score=m.legacyResult || (()=>{
     try{const s=finalScore(m);return s[0]+'-'+s[1]}catch(e){return ''}
   })();

   function pageHeader(first=false){
     if(!first){doc.addPage();y=15}
     doc.setFont('helvetica','bold');doc.setFontSize(16);
     doc.text('VALORACIÓ INDIVIDUAL - INFANTIL FEMENÍ A',margin,y); y+=7;
     doc.setFontSize(11);
     doc.text(clean('F.S. Castellar Volei - '+(m.opponent||'Rival')),margin,y); y+=5;
     doc.setFont('helvetica','normal');doc.setFontSize(9);
     doc.text(clean('Data: '+dateText+'   Resultat: '+score+'   '+(m.venue==='home'?'Casa':'Fora')),margin,y); y+=5;
     doc.setDrawColor(180);doc.line(margin,y,W-margin,y);y+=7;
   }
   function wrapped(text,x,width,size=9,style='normal'){
     doc.setFont('helvetica',style);doc.setFontSize(size);
     const lines=doc.splitTextToSize(clean(text),width);
     doc.text(lines,x,y); y+=lines.length*(size*0.42)+2;
   }
   function ensure(space){if(y+space>282)pageHeader(false)}
   pageHeader(true);
   const assessmentSubs=reportSubstitutions(m);
   if(assessmentSubs.length){
     wrapped('CANVIS',margin,usable,9,'bold');
     assessmentSubs.forEach(ch=>wrapped(substitutionText(ch),margin+3,usable-3,8,'normal'));
     y+=3;
   }

   const players=(m.players||[]).slice().sort((a,b)=>Number(a.number)-Number(b.number));
   players.forEach(pl=>{
     const played=[1,2,3,4,5].some(s=>reportSetPct(m,pl.id,s)!==null);
     if(!played)return;
     const a=playerAssessment(m,pl);
     ensure(48);
     doc.setFillColor(238,243,247);doc.roundedRect(margin,y-4,usable,9,2,2,'F');
     doc.setFont('helvetica','bold');doc.setFontSize(12);
     doc.text(clean(pl.number+' · '+pl.name),margin+3,y+2);y+=10;

     wrapped(a.context,margin,usable,8,'normal');
     if(a.strongs.length){
       wrapped('FORTALESES',margin,usable,9,'bold');
       a.strongs.forEach(x=>wrapped('• '+x.text,margin+3,usable-3,9,'normal'));
     }
     if(a.works.length){
       wrapped('ASPECTES A TREBALLAR',margin,usable,9,'bold');
       a.works.forEach(x=>wrapped('• '+x.text,margin+3,usable-3,9,'normal'));
     }
     wrapped('SÍNTESI',margin,usable,9,'bold');
     wrapped(a.summary,margin+3,usable-3,9,'normal');
     doc.setFillColor(245,247,250);
     const pr=doc.splitTextToSize(clean(a.priority),usable-8);
     const bh=Math.max(10,pr.length*4.2+5);
     ensure(bh+5);doc.roundedRect(margin,y-3,usable,bh,2,2,'F');
     doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(pr,margin+4,y+2);
     y+=bh+6;
   });

   const pages=doc.getNumberOfPages();
   for(let i=1;i<=pages;i++){
     doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(7);
     doc.text('Stats Castellar · Valoració generada a partir de les estadístiques desades',margin,291);
     doc.text(i+' / '+pages,W-margin,291,{align:'right'});
   }
   doc.save(exportBaseName(m)+'_valoracions.pdf');
 }
 async function runExport(kind){
   if(!match||!match.finished)return;
   const status=$('exportStatus'),btns=[$('exportPdfBtn'),$('exportOdsBtn'),$('exportXlsxBtn'),$('exportAssessPdfBtn')];
   btns.forEach(b=>b.disabled=true);status.textContent='Generant '+kind.toUpperCase()+'...';
   try{
     if(kind==='pdf')await exportPDF(match);
     else if(kind==='ods')await exportODS(match);
     else if(kind==='xlsx')await exportXLSX(match);
     else if(kind==='valoracions')await exportAssessmentPDF(match);
     status.textContent=(kind==='valoracions'?'PDF VALORACIONS':kind.toUpperCase())+' generat correctament.';
   }catch(e){
     console.error(e);status.textContent='Error generant '+kind.toUpperCase()+': '+(e&&e.message?e.message:'error desconegut');
   }finally{btns.forEach(b=>b.disabled=false)}
 }
 $('exportPdfBtn').onclick=()=>runExport('pdf');
 $('exportOdsBtn').onclick=()=>runExport('ods');
 $('exportXlsxBtn').onclick=()=>runExport('xlsx');
 $('exportAssessPdfBtn').onclick=()=>runExport('valoracions');
 const sharePdfBtn=$('sharePdfBtn');
 if(sharePdfBtn) sharePdfBtn.onclick=async()=>{
   if(!match||!match.finished)return;
   const status=$('exportStatus');
   try{
     status.textContent='Preparant PDF per compartir...';
     const out=await exportPDF(match,'blob');
     const file=new File([out.blob],out.fileName,{type:'application/pdf'});
     if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
       await navigator.share({title:'Stats Castellar',text:'Informe del partit',files:[file]});
       status.textContent='PDF compartit.';
     }else{
       downloadBlob(out.blob,out.fileName);
       status.textContent='Aquest dispositiu no permet compartir directament. S’ha descarregat el PDF.';
     }
   }catch(e){
     if(e&&e.name==='AbortError'){status.textContent='Compartició cancel·lada.';return;}
     console.error(e);status.textContent='No s’ha pogut compartir el PDF.';
   }
 };


 // COMPARTIR / IMPORTAR PARTIT — intercanvi de dades entre dispositius
 function safeFilePart(v){
   return String(v||'partit').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');
 }
 function sharedMatchPayload(m){
   return {
     format:'Stats Castellar Match',
     version:'1.0',
     exportedAt:new Date().toISOString(),
     match:JSON.parse(JSON.stringify(m))
   };
 }
 function sharedMatchFile(m){
   const payload=sharedMatchPayload(m);
   const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
   const name='Stats_Castellar_Partit_'+safeFilePart(m.date)+'_'+safeFilePart(m.opponent)+'.json';
   return new File([blob],name,{type:'application/json'});
 }
 const shareMatchBtn=$('shareMatchBtn');
 if(shareMatchBtn) shareMatchBtn.onclick=async()=>{
   if(!match||!match.finished)return;
   const status=$('exportStatus');
   try{
     status.textContent='Preparant partit per compartir...';
     const file=sharedMatchFile(match);
     if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
       await navigator.share({title:'Stats Castellar · '+(match.opponent||'Partit'),text:'Partit complet de Stats Castellar per importar a l’historial.',files:[file]});
       status.textContent='Partit compartit.';
     }else{
       downloadBlob(file,file.name);
       status.textContent='Aquest dispositiu no permet compartir directament. S’ha descarregat el fitxer del partit.';
     }
   }catch(e){
     if(e&&e.name==='AbortError'){status.textContent='Compartició cancel·lada.';return;}
     console.error(e);status.textContent='No s’ha pogut compartir el partit.';
   }
 };
 function validImportedMatch(m){
   return !!(m && typeof m==='object' && m.id && m.opponent && m.date && Array.isArray(m.players) && Array.isArray(m.completedSets) && m.finished);
 }
 async function importSharedMatchFile(file){
   let payload;
   try{payload=JSON.parse(await file.text())}catch(_){throw new Error('El fitxer no és un partit vàlid de Stats Castellar.');}
   const m=(payload && payload.format==='Stats Castellar Match')?payload.match:null;
   if(!validImportedMatch(m))throw new Error('El fitxer no conté un partit complet de Stats Castellar.');
   await refreshHistoryCache();
   if(historyCache.some(x=>String(x.id)===String(m.id))){
     alert('Aquest partit ja existeix a l’Historial i no s’ha importat de nou.');
     return false;
   }
   const d=String(m.date||'').split('-');
   const date=d.length===3?d[2]+'/'+d[1]+'/'+d[0]:m.date;
   const score=historyScoreText(m);
   const ok=confirm('IMPORTAR PARTIT\n\n'+(m.opponent||'Rival')+'\n'+date+' · '+score+'\n'+m.players.length+' jugadores · '+m.completedSets.length+' sets\n\nAfegir aquest partit a l’Historial?');
   if(!ok)return false;
   const copy=JSON.parse(JSON.stringify(m));
   copy.imported=true;
   copy.importedAt=Date.now();
   await idbPut(copy);
   await refreshHistoryCache();
   await renderHistory();
   alert('Partit importat correctament. Ja forma part de l’Historial i de les estadístiques globals.');
   return true;
 }
 const importMatchBtn=$('importMatchBtn'),importMatchFile=$('importMatchFile');
 if(importMatchBtn&&importMatchFile){
   importMatchBtn.onclick=()=>{importMatchFile.value='';importMatchFile.click();};
   importMatchFile.onchange=async()=>{
     const file=importMatchFile.files&&importMatchFile.files[0];if(!file)return;
     try{await importSharedMatchFile(file)}catch(e){console.error(e);alert(e&&e.message?e.message:'No s’ha pogut importar el partit.');}
     finally{importMatchFile.value='';}
   };
 }


 function buildTestMatch(){
   const roster=[
     {id:'test-3',number:3,name:'Nora'},
     {id:'test-4',number:4,name:'Aran'},
     {id:'test-6',number:6,name:'Avril'},
     {id:'test-7',number:7,name:'Emma'},
     {id:'test-8',number:8,name:'Isona'},
     {id:'test-10',number:10,name:'Thais'},
     {id:'test-11',number:11,name:'Yveth'},
     {id:'test-13',number:13,name:'Maria'},
     {id:'test-16',number:16,name:'Ainhoa'},
     {id:'test-18',number:18,name:'Ària'},
     {id:'test-28',number:28,name:'Mariona'},
     {id:'test-66',number:66,name:'Núria'}
   ];
   const m={
     id:'TEST-'+Date.now(),teamId:'infantil-a',teamName:'Infantil A',
     opponent:'Rival de prova',date:new Date().toISOString().slice(0,10),venue:'home',
     players:roster,set:3,scores:{castellar:25,rival:19},actions:[],
     pinned:[],substitutions:[],participation:{},completedSets:[],
     finished:true,finishedAt:Date.now()
   };
   const defs=[
     {score:[25,18],parts:[100,100,100,100,100,100,42,0,0,0,0,0]},
     {score:[21,25],parts:[100,100,100,76,64,100,24,36,0,0,0,0]},
     {score:[25,19],parts:[100,82,100,100,55,68,18,45,32,0,0,0]}
   ];
   const names=['Servei','Recepció','Col·locació','Atac','Bloqueig'];
   defs.forEach((d,si)=>{
     const participation={},actions=[];
     roster.forEach((pl,pi)=>{
       const pct=d.parts[pi]||0;
       if(!pct)return;
       participation[pl.id]={
         playerId:pl.id,number:pl.number,name:pl.name,
         playedMs:pct*600,percentage:pct
       };
       names.forEach((act,ai)=>{
         const max=act==='Bloqueig'?2:3;
         const count=1+((pi+ai+si)%3);
         for(let n=0;n<count;n++){
           actions.push({
             playerId:pl.id,action:act,
             value:(pi+ai+n+si)%(max+1),
             set:si+1,time:Date.now()+actions.length
           });
         }
       });
     });
     const positions={};
     ['1','2','3','4','5','6'].forEach((p,i)=>positions[p]=roster[i].id);
     m.completedSets.push({
       set:si+1,
       scores:{castellar:d.score[0],rival:d.score[1]},
       actions,participation,substitutions:[],
       finalPositions:positions,pinned:[],
       starting:roster.slice(0,6).map(p=>p.id),
       serving:si%2?'rival':'castellar',
       setStartedAt:Date.now()-60000
     });
   });
   return m;
 }
 function loadTestMatch(){
   try{
     match=buildTestMatch();
     renderFinalReport(match);
     if(typeof window.statsNavigate==='function')window.statsNavigate('final-report',true);
   }catch(e){
     console.error(e);
     alert('No s’ha pogut crear el partit de prova: '+(e&&e.message?e.message:String(e)));
   }
 }

 const HISTORY_KEY='statsCastellar_PROVA_HistoryV2'; // clau antiga: només per migració
 const HISTORY_DB='StatsCastellarDB';
 const HISTORY_STORE='matches';
 let viewingHistory=false;
 let historyCache=[];
 let historyVisibleCount=20;

 function legacyToMatch(rec){
   const players=rec.players.map(p=>({id:'legacy-'+rec.id+'-'+p.number,number:p.number,name:p.name}));
   let sets=[1,2,3,4,5].map(n=>{const participation={};rec.players.forEach((rp,i)=>{const q=rp.parts[n-1];if(q!=null)participation[players[i].id]={playerId:players[i].id,number:rp.number,name:rp.name,playedMs:q*600,percentage:q}});return {set:n,scores:{castellar:0,rival:0},actions:[],participation,substitutions:[]}}).filter(s=>Object.keys(s.participation).length);
   if(!sets.length)sets=[{set:1,scores:{castellar:0,rival:0},actions:[],participation:{},substitutions:[]}];
   rec.players.forEach((rp,i)=>Object.entries(rp.counts).forEach(([a,cs])=>cs.forEach((n,v)=>{for(let k=0;k<n;k++)sets[0].actions.push({playerId:players[i].id,action:a,value:v,set:sets[0].set,time:k})})));
   return {id:rec.id,teamId:'infantil-a',teamName:'Infantil A',opponent:rec.opponent,date:rec.date,venue:rec.venue,players,completedSets:sets,finished:true,finishedAt:new Date(rec.date+'T12:00:00').getTime(),legacy:true,legacyResult:rec.legacyResult};
 }
 function openHistoryDB(){
   return new Promise((resolve,reject)=>{
     const req=indexedDB.open(HISTORY_DB,1);
     req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(HISTORY_STORE)){const s=db.createObjectStore(HISTORY_STORE,{keyPath:'id'});s.createIndex('date','date',{unique:false});s.createIndex('finishedAt','finishedAt',{unique:false})}};
     req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
 }
 async function idbAll(){
   const db=await openHistoryDB();
   return new Promise((resolve,reject)=>{const tx=db.transaction(HISTORY_STORE,'readonly'),r=tx.objectStore(HISTORY_STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)});
 }
 async function idbPut(m){
   const db=await openHistoryDB();
   return new Promise((resolve,reject)=>{const tx=db.transaction(HISTORY_STORE,'readwrite');tx.objectStore(HISTORY_STORE).put(JSON.parse(JSON.stringify(m)));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
 }
 async function idbDelete(id){
   const db=await openHistoryDB();
   return new Promise((resolve,reject)=>{const tx=db.transaction(HISTORY_STORE,'readwrite');tx.objectStore(HISTORY_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
 }
 async function ensureHistoryMigrated(){
   let current=await idbAll(),ids=new Set(current.map(x=>x.id));
   try{
     const old=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
     for(const m of old||[])if(m&&m.id&&!ids.has(m.id)){await idbPut(m);ids.add(m.id)}
   }catch(_){}
    // No esborrem immediatament l'antic localStorage: queda com a xarxa de seguretat
   // durant aquesta versió de migració.
 }
 async function refreshHistoryCache(){
   await ensureHistoryMigrated();
   historyCache=await idbAll();
   historyCache.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||((b.finishedAt||0)-(a.finishedAt||0)));
   return historyCache;
 }
 async function archiveMatch(m){
   if(!m)return;
   if(String(m.id||'').startsWith('TEST-'))return;
   if(!m.id)throw new Error('El partit no té identificador únic.');
   await idbPut(m);
   await refreshHistoryCache();
 }
 async function deleteArchivedMatch(id){await idbDelete(id);await refreshHistoryCache()}
 function historyScoreText(m){if(m.legacyResult)return m.legacyResult;const s=finalScore(m);return s[0]+'-'+s[1]}
 function historyScoreClass(m){
   let s;
   if(m.legacyResult){
     const nums=String(m.legacyResult).match(/\d+/g);
     if(!nums||nums.length<2)return '';
     s=[Number(nums[0]),Number(nums[1])];
   }else s=finalScore(m);
   const castellar=m.venue==='away'?s[1]:s[0];
   const rival=m.venue==='away'?s[0]:s[1];
   return castellar>rival?'win':rival>castellar?'loss':'';
 }
 async function renderHistory(){
   const root=$('historyList'),empty=$('historyEmpty'),more=$('historyLoadMore');if(!root)return;
   const list=await refreshHistoryCache();root.innerHTML='';empty.hidden=!!list.length;
   list.slice(0,historyVisibleCount).forEach(m=>{
     const d=(m.date||'').split('-'),el=document.createElement('div');el.className='card history-item';
     el.innerHTML='<div class="history-date">'+(d[2]||'')+'/'+(d[1]||'')+'<small>'+(d[0]||'')+'</small></div><div class="history-rival">'+(m.opponent||'Rival')+'<small>'+(m.venue==='home'?'Casa':'Fora')+(m.legacy?' · Importat':'')+'</small></div><div class="history-score '+historyScoreClass(m)+'">'+historyScoreText(m)+'</div>';
     el.onclick=()=>openHistoryMatch(m.id);root.appendChild(el);
   });
   if(more){more.hidden=list.length<=historyVisibleCount;more.onclick=()=>{historyVisibleCount+=20;renderHistory()}}
 }
 async function openHistoryMatch(id){
   await refreshHistoryCache();const m=historyCache.find(x=>x.id===id);if(!m)return;
   match=JSON.parse(JSON.stringify(m));viewingHistory=true;renderFinalReport(match);
   if(typeof window.statsNavigate==='function')window.statsNavigate('final-report',true);
 }
 function setupCorrection(m){
   const card=$('historyCorrectionCard');if(!card)return;card.hidden=!viewingHistory;if(!viewingHistory)return;
   const pp=$('corrPlayer'),aa=$('corrAction'),vv=$('corrValue'),panel=$('correctionPanel'),toggle=$('toggleCorrectionBtn');
   pp.innerHTML=playersSorted(m).map(p=>'<option value="'+p.id+'">'+p.number+' · '+p.name+'</option>').join('');
   aa.innerHTML=['Servei','Recepció','Col·locació','Atac','Bloqueig'].map(a=>'<option>'+a+'</option>').join('');
   const fill=()=>{const max=aa.value==='Bloqueig'?2:3;vv.innerHTML=Array.from({length:max+1},(_,i)=>'<option value="'+i+'">'+i+'</option>').join('')};aa.onchange=fill;fill();
   const log=()=>{$('correctionLogView').innerHTML=(m.correctionLog||[]).slice().reverse().map(x=>'• '+x.when+' — '+x.text).join('<br>')};log();
   toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.textContent=panel.hidden?'🔒 Corregir estadístiques':'🔓 Tancar mode correcció'};
   const change=delta=>{
     if(!confirm(delta>0?'Afegir aquesta valoració al partit?':'Treure una valoració igual del partit?'))return;
     const pid=pp.value,a=aa.value,v=Number(vv.value),pl=m.players.find(x=>x.id===pid);
     if(delta>0){const s=m.completedSets[m.completedSets.length-1];s.actions=s.actions||[];s.actions.push({playerId:pid,action:a,value:v,set:s.set,time:Date.now(),corrected:true})}
     else{let ok=false;for(let si=m.completedSets.length-1;si>=0&&!ok;si--){const ar=m.completedSets[si].actions||[];for(let i=ar.length-1;i>=0;i--)if(ar[i].playerId===pid&&ar[i].action===a&&Number(ar[i].value)===v){ar.splice(i,1);ok=true;break}}if(!ok){alert('No hi ha cap valoració igual per treure.');return}}
     m.correctionLog=m.correctionLog||[];m.correctionLog.push({when:new Date().toLocaleString('ca-ES'),text:(delta>0?'Afegit ':'Eliminat ')+a+' '+v+' a '+pl.name});
     const list=loadHistory(),i=list.findIndex(x=>x.id===m.id);if(i>=0)list[i]=JSON.parse(JSON.stringify(m));saveHistory(list);match=m;renderFinalReport(m);
   };
   $('corrPlus').onclick=()=>change(1);$('corrMinus').onclick=()=>change(-1);
 }
 document.addEventListener('click',e=>{if(e.target.closest('[data-go="history"]'))setTimeout(renderHistory,0)},true);

 const CURRENT_MATCH_KEY='statsCastellar_PROVA_CurrentMatchV1';
 const LAST_COMPLETED_MATCH_KEY='statsCastellar_PROVA_LastCompletedMatchV1';

 function getRecoverableMatch(){
   try{
     const saved=JSON.parse(localStorage.getItem(CURRENT_MATCH_KEY)||'null');
     return saved && saved.players && saved.positions && saved.scores && !saved.finished ? saved : null;
   }catch(_){return null}
 }
 function recoverSummary(saved){
   if(!saved)return null;
   const d=String(saved.date||'').split('-');
   const date=d.length===3?d[2]+'/'+d[1]+'/'+d[0]:(saved.date||'');
   return {
     title:'Castellar – '+(saved.opponent||'Rival'),
     meta:'Set '+(Number(saved.set)||1)+' · '+(saved.scores?.castellar||0)+'–'+(saved.scores?.rival||0)+' · '+date
   };
 }
 function renderRecoverScreen(){
   const saved=getRecoverableMatch(),title=$('recoverMatchTitle'),meta=$('recoverMatchMeta'),
         go=$('recoverMatchNow'),discard=$('discardRecoverMatch');
   if(!title)return;
   if(!saved){
     title.textContent='No hi ha cap partit pendent';
     meta.textContent='Quan un partit quedi interromput, apareixerà aquí per continuar-lo.';
     go.hidden=true;discard.hidden=true;return;
   }
   const s=recoverSummary(saved);
   title.textContent=s.title;meta.textContent=s.meta;
   go.hidden=false;discard.hidden=false;
 }
 function updateRecoverHome(){
   const b=document.querySelector('[data-go="recover"]');
   if(!b)return;
   const saved=getRecoverableMatch(),span=b.querySelector('span:nth-child(2)');
   if(span)span.textContent=saved?'RECUPERAR · '+(saved.opponent||'PARTIT'):'RECUPERAR PARTIT';
 }
 function hasRecoverableMatch(){return !!getRecoverableMatch()}

 function restoreSavedMatch(){
   let saved=null;
   try{saved=JSON.parse(localStorage.getItem('statsCastellar_PROVA_CurrentMatchV1')||'null')}catch(_){}
   if(!saved || !saved.players || !saved.positions || !saved.scores)return false;

   match=saved;
   match.actions=Array.isArray(match.actions)?match.actions:[];
   match.pinned=Array.isArray(match.pinned)?match.pinned:[];
   match.completedSets=Array.isArray(match.completedSets)?match.completedSets:[];
   match.substitutions=Array.isArray(match.substitutions)?match.substitutions:[];
   match.participation=match.participation||{};
   match.set=Number(match.set)||1;
   match.serving=match.serving||'castellar';

   const pointNow=Math.max(0,(Number(match.scores.castellar)||0)+(Number(match.scores.rival)||0));
   const courtNow=new Set(Object.values(match.positions||{}));
   (match.players||[]).forEach(pl=>{
     let rec=match.participation[pl.id];
     if(!rec || !Number.isFinite(Number(rec.playedPoints))){
       rec={playedPoints:0,onCourt:courtNow.has(pl.id),lastInPoint:courtNow.has(pl.id)?pointNow:null};
       match.participation[pl.id]=rec;
     }else{
       rec.onCourt=courtNow.has(pl.id);
       if(rec.onCourt && !Number.isFinite(Number(rec.lastInPoint)))rec.lastInPoint=pointNow;
       if(!rec.onCourt)rec.lastInPoint=null;
     }
   });
   ensureParticipation();

   history.length=0;
   if(Array.isArray(match.undoHistory)){
     match.undoHistory.slice(-30).forEach(x=>history.push(x));
   }
   swapSource=null;
   renderAll();
   return true;
 }

 function openLiveScreen(){
   if(typeof window.statsNavigate==='function')window.statsNavigate('scoring',true);
 }

 const liveBack=$('liveBackBtn');
 if(liveBack)liveBack.onclick=e=>{
   e.preventDefault();e.stopPropagation();
   if(match){
     save();
     $('leaveMatchModal').hidden=false;
   }else{
     history.back();
   }
 };
 $('stayInMatch').onclick=()=>{$('leaveMatchModal').hidden=true};
 $('leaveMatchModal').querySelector('.app-modal-backdrop').onclick=()=>{$('leaveMatchModal').hidden=true};
 $('leaveMatch').onclick=()=>{
   if(match)save();
   history.length=0;swapSource=null;
   const leaveModal=$('leaveMatchModal');leaveModal.hidden=true;leaveModal.style.display='';leaveModal.setAttribute('aria-hidden','true');
   if(typeof window.statsNavigate==='function')window.statsNavigate('home',true);
   document.body.classList.remove('scoring-active','scoring-live');
   updateRecoverHome();
 };

 /* Botó de portada Recuperar partit:
    interceptem el clic abans de la navegació provisional antiga. */
 const recoverBtn=document.querySelector('[data-go="recover"]');
 if(recoverBtn){
   recoverBtn.addEventListener('click',e=>{
     e.preventDefault();
     e.stopImmediatePropagation();
     if(!hasRecoverableMatch()){
       alert('No hi ha cap partit pendent de recuperar.');
       return;
     }
     /* Obrim primer la pantalla Recuperar. Des d'allà l'usuari
        pot continuar el partit o descartar-lo amb doble confirmació. */
     if(typeof window.statsNavigate==='function')window.statsNavigate('recover',true);
     setTimeout(renderRecoverScreen,0);
   },true);
 }
 const recoverNow=$('recoverMatchNow');
 if(recoverNow)recoverNow.onclick=()=>{if(restoreSavedMatch()){document.dispatchEvent(new CustomEvent('stats-recovered-scoring',{detail:{serving:match.serving||'castellar',set:match.set||1}}));openLiveScreen()}};
 const discardRecover=$('discardRecoverMatch');
 if(discardRecover)discardRecover.onclick=()=>{
   if(!hasRecoverableMatch())return;
   if(!confirm('Vols descartar aquest partit pendent?'))return;
   if(!confirm('SEGONA CONFIRMACIÓ\n\nEl partit pendent s’eliminarà definitivament i no es podrà recuperar. Descartar-lo?'))return;
   localStorage.removeItem(CURRENT_MATCH_KEY);
   match=null;
   renderRecoverScreen();updateRecoverHome();
 };
 document.addEventListener('click',e=>{
   if(e.target.closest('[data-go="recover"]'))setTimeout(renderRecoverScreen,0);
 },true);


 /* Guardat extra quan l'app queda en segon pla o es tanca/recarrega. */
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&match&&!match.finished)save()});
 window.addEventListener('pagehide',()=>{if(match&&!match.finished)save()});
 setInterval(()=>{if(match&&!match.finished)save()},5000);

 /* Si el navegador intenta sortir/recarregar durant un partit,
    demanem confirmació nativa com a segona xarxa de seguretat. */
 window.addEventListener('beforeunload',e=>{
   if(!match||match.finished)return;
   save();
   e.preventDefault();
   e.returnValue='';
 });

 updateRecoverHome();

 // CONFIGURACIÓ — versió pública 1.0.4
 const SETTINGS_KEY='statsCastellarSettingsV1';
 function getSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}catch(_){return {}}}
 function saveSettingsObj(s){localStorage.setItem(SETTINGS_KEY,JSON.stringify(s))}
 async function exportStatsBackup(){
   const data={format:'Stats Castellar Backup',version:'1.0.6',createdAt:new Date().toISOString(),localStorage:{}};
   for(let i=0;i<localStorage.length;i++){
     const k=localStorage.key(i);
     if(k && (k.startsWith('statsCastellar') || k.startsWith('stats_')))data.localStorage[k]=localStorage.getItem(k);
   }
   try{data.history=await idbAll()}catch(_){data.history=[]}
   const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
   const a=document.createElement('a');a.href=URL.createObjectURL(blob);
   a.download='Stats_Castellar_copia_'+new Date().toISOString().slice(0,10)+'.json';a.click();
   setTimeout(()=>URL.revokeObjectURL(a.href),1000);
   const s=document.getElementById('backupStatus');if(s)s.textContent='Còpia de seguretat creada correctament.';
 }
 async function importStatsBackup(file){
   const text=await file.text(),data=JSON.parse(text);
   if(!data || data.format!=='Stats Castellar Backup' || !data.localStorage)throw new Error('El fitxer no és una còpia vàlida de Stats Castellar.');
   if(!confirm('Restaurar aquesta còpia substituirà les dades locals de Stats Castellar d’aquest dispositiu. Continuar?'))return;
   Object.keys(localStorage).filter(k=>k.startsWith('statsCastellar')||k.startsWith('stats_')).forEach(k=>localStorage.removeItem(k));
   Object.entries(data.localStorage).forEach(([k,v])=>localStorage.setItem(k,v));
   if(Array.isArray(data.history)){
     const db=await openHistoryDB();
     await new Promise((resolve,reject)=>{const tx=db.transaction(HISTORY_STORE,'readwrite'),st=tx.objectStore(HISTORY_STORE);st.clear();data.history.forEach(m=>st.put(m));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
   }
   alert('Còpia restaurada correctament. L’app es tornarà a carregar.');
   location.reload();
 }
 const backupExportBtn=document.getElementById('backupExportBtn');
 if(backupExportBtn)backupExportBtn.onclick=exportStatsBackup;
 const backupImportBtn=document.getElementById('backupImportBtn'),backupImportFile=document.getElementById('backupImportFile');
 if(backupImportBtn&&backupImportFile){
   backupImportBtn.onclick=()=>backupImportFile.click();
   backupImportFile.onchange=async()=>{try{if(backupImportFile.files[0])await importStatsBackup(backupImportFile.files[0])}catch(e){alert(e.message||'No s’ha pogut restaurar la còpia.')}finally{backupImportFile.value=''}};
 }

 // APARENÇA — es desa al dispositiu.
 function applyStatsTheme(theme){
   const dark=theme==='dark';
   document.body.classList.toggle('stats-dark',dark);
   const l=document.getElementById('themeLightBtn'),d=document.getElementById('themeDarkBtn');
   if(l){l.classList.toggle('active',!dark);const m=l.querySelector('.theme-mark');if(m)m.textContent=!dark?'✓':''}
   if(d){d.classList.toggle('active',dark);const m=d.querySelector('.theme-mark');if(m)m.textContent=dark?'✓':''}
 }
 const initialSettings=getSettings();
 applyStatsTheme(initialSettings.theme==='dark'?'dark':'light');
 const themeLightBtn=document.getElementById('themeLightBtn'),themeDarkBtn=document.getElementById('themeDarkBtn');
 if(themeLightBtn)themeLightBtn.onclick=()=>{const x=getSettings();x.theme='light';saveSettingsObj(x);applyStatsTheme('light')};
 if(themeDarkBtn)themeDarkBtn.onclick=()=>{const x=getSettings();x.theme='dark';saveSettingsObj(x);applyStatsTheme('dark')};

 // ELIMINAR TOTES LES DADES — triple barrera per evitar tocs accidentals.
 async function deleteAllStatsData(){
   if(!confirm('ATENCIÓ: s’eliminaran tots els partits, estadístiques, partits pendents i configuracions d’aquest dispositiu. Aquesta acció no es pot desfer. Vols continuar?'))return;
   const typed=prompt('Segona confirmació. Escriu ELIMINAR en majúscules per continuar:','');
   if(typed!=='ELIMINAR'){if(typed!==null)alert('No s’ha eliminat res.');return;}
   if(!confirm('ÚLTIMA CONFIRMACIÓ: segur que vols eliminar definitivament TOTES les dades de Stats Castellar d’aquest dispositiu?'))return;
   try{
     Object.keys(localStorage).filter(k=>k.startsWith('statsCastellar')||k.startsWith('stats_')).forEach(k=>localStorage.removeItem(k));
     const db=await openHistoryDB();
     await new Promise((resolve,reject)=>{const tx=db.transaction(HISTORY_STORE,'readwrite');tx.objectStore(HISTORY_STORE).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
     alert('S’han eliminat totes les dades locals de Stats Castellar.');
     location.reload();
   }catch(e){alert('No s’han pogut eliminar totes les dades. '+(e&&e.message?e.message:''));}
 }
 const deleteAllDataBtn=document.getElementById('deleteAllDataBtn');
 if(deleteAllDataBtn)deleteAllDataBtn.onclick=deleteAllStatsData;
})();
