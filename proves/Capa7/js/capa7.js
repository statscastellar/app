(() => {
'use strict';

const ROSTER = [
 {n:3,name:'NORA'},{n:4,name:'ARAN'},{n:6,name:'AVRIL'},{n:7,name:'EMMA'},
 {n:8,name:'ISONA'},{n:10,name:'THAIS'},{n:11,name:'YVETH'},{n:13,name:'MARIA'},
 {n:16,name:'AINHOA'},{n:18,name:'ÀRIA'},{n:28,name:'MARIONA'},{n:66,name:'NÚRIA'}
];
const byNum = n => ROSTER.find(p=>p.n===Number(n));
const deep = x => JSON.parse(JSON.stringify(x));

const initial = {
 version:'7.0.0', rival:'SANT CUGAT', score:{home:0,away:0}, set:1,
 setResults:[null,null,null,null,null], serving:'away', phase:'RECEPCIÓ', temp:null,
 court:[3,4,6,28,13,18], // zones visuals 4,3,2 / 5,6,1
 history:[], actions:[], sos:null, rivalTransit:false, finished:false
};
let S = loadRecovery() || deep(initial);
let positionsStart = null;
let dragIndex = null;
let changeOut = null;

const $ = q => document.querySelector(q);
const $$ = q => [...document.querySelectorAll(q)];
const phaseLabel = () => S.temp || S.phase;

function snapshot(label){
 const c=deep(S); delete c.history;
 S.history.push({label,state:c});
 if(S.history.length>100) S.history.shift();
}
function restore(st){
 const hist=S.history;
 S=deep(st); S.history=hist;
 persist(); render();
}
function pushAction(type, data={}){
 S.actions.push({ts:Date.now(),set:S.set,type,...data});
}
function persist(){
 try{ localStorage.setItem('statsCastellarC7Recovery',JSON.stringify(S)); }catch(_){}
}
function loadRecovery(){
 try{
  const x=JSON.parse(localStorage.getItem('statsCastellarC7Recovery')||'null');
  return x && x.version==='7.0.0' && !x.finished ? x : null;
 }catch(_){ return null; }
}
function toast(msg){
 let t=$('.toast'); if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t);}
 t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,1500);
}
function phaseAfterPoint(){
 S.rivalTransit=false; S.sos=null;
 S.phase = S.serving==='home' ? 'SERVEI' : 'RECEPCIÓ';
}
function rotateHome(){
 // Rotation zones: 1→6→5→4→3→2→1.
 // visual indices represent [4,3,2,5,6,1].
 const z=S.court.slice();
 S.court=[z[3],z[0],z[1],z[4],z[5],z[2]];
}
function award(team, source, manual=false){
 if(team==='home'){
   S.score.home++;
   if(S.serving==='away'){ S.serving='home'; rotateHome(); }
 } else {
   S.score.away++;
   if(S.serving==='home') S.serving='away';
 }
 pushAction(manual?'PUNT_MANUAL':'PUNT_AUTOMÀTIC',{team,source});
 phaseAfterPoint();
}
function manualPlus(team){
 snapshot(`PUNT + ${team==='home'?'CASTELLAR':'RIVAL'}`);
 award(team,'MARCADOR',true); persist(); render();
}
function manualMinus(team){
 const key=team==='home'?'home':'away';
 if(S.score[key]<=0) return;
 // If the immediately previous registered action is a point, undo the whole unit.
 const last=S.history[S.history.length-1];
 if(last && /^PUNT|SERVEI|ATAC|BLOQUEIG|COL·LOCACIÓ|RECEPCIÓ|DEFENSA/.test(last.label)){
   S.history.pop(); restore(last.state); return;
 }
 snapshot(`CORRECCIÓ − ${team==='home'?'CASTELLAR':'RIVAL'}`);
 S.score[key]--; pushAction('CORRECCIÓ_MARCADOR',{team,delta:-1}); persist(); render();
}
function actionNameForPhase(){
 if(S.sos?.active) return 'SALVADA';
 return S.phase;
}
function ratePlayer(index, value){
 if(S.temp) return;
 const p=byNum(S.court[index]); if(!p) return;
 if(S.sos?.active){
   if(value===0) return;
   snapshot(`SALVADA · ${p.name} · ${value}`);
   pushAction('SALVADA',{player:p.n,value});
   S.sos=null; S.phase='COL·LOCACIÓ'; S.rivalTransit=false;
   persist(); render(); return;
 }
 const ph=S.phase;
 if(!['SERVEI','RECEPCIÓ','DEFENSA','COL·LOCACIÓ','ATAC'].includes(ph)) return;
 if(ph==='SERVEI' && index!==5) return; // zone 1 only
 snapshot(`${ph} · ${p.name} · ${value}`);
 pushAction(ph,{player:p.n,value});
 S.rivalTransit=false;
 if(ph==='SERVEI'){
   if(value===0){ award('away','SERVEI 0'); }
   else if(value===3){ award('home','SERVEI 3'); }
   else { S.phase='DEFENSA'; S.rivalTransit=true; }
 } else if(ph==='RECEPCIÓ' || ph==='DEFENSA'){
   if(value===0){
     // provisional rival point, retaining a marker that SOS can reopen.
     const beforePoint=deep(S); delete beforePoint.history;
     award('away',`${ph} 0`);
     S.sos={available:true,active:false,origin:{phase:ph,player:p.n},beforePoint};
   } else S.phase='COL·LOCACIÓ';
 } else if(ph==='COL·LOCACIÓ'){
   if(value===0) award('away','COL·LOCACIÓ 0');
   else S.phase='ATAC';
 } else if(ph==='ATAC'){
   if(value===0) award('away','ATAC 0');
   else if(value===3) award('home','ATAC 3');
   else { S.phase='DEFENSA'; S.rivalTransit=true; }
 }
 persist(); render();
}
function rivalCourt(){
 if(S.temp || !['RECEPCIÓ','DEFENSA','COL·LOCACIÓ','BLOQUEIG'].includes(S.phase)) return;
 snapshot(`CAMP RIVAL · ${S.phase}`);
 pushAction('CAMP_RIVAL',{from:S.phase});
 S.rivalTransit=true;
 S.phase='DEFENSA';
 persist(); render();
}
function block(index, value){
 if(S.temp) return;
 const p=byNum(S.court[index]); if(!p) return;
 snapshot(`BLOQUEIG · ${p.name} · ${value}`);
 pushAction('BLOQUEIG',{player:p.n,value});
 S.phase='BLOQUEIG'; S.rivalTransit=false;
 if(value===0) award('away','BLOQUEIG FORA');
 else if(value===2) award('home','BLOQUEIG + PUNT');
 else S.phase='DEFENSA';
 persist(); render();
}
function toggleSOS(){
 if(S.sos?.active){
   snapshot('SOS · CANCEL·LAR');
   const origin=deep(S.sos);
   S=deep(origin.pointState || S);
   S.history = [...(S.history||[])];
   persist(); render(); return;
 }
 if(!S.sos?.available){ toast('SOS només està disponible després d’un 0 de recepció o defensa.'); return; }
 // Reopen from the state immediately before provisional rival point, but keep original 0 action.
 snapshot('SOS · ACTIVAR');
 const keepHistory=S.history;
 const keepActions=S.actions;
 const origin=deep(S.sos.origin);
 const before=deep(S.sos.beforePoint);
 S={...before,history:keepHistory,actions:keepActions,sos:{active:true,available:true,origin,pointState:deep(S)}};
 S.phase=origin.phase;
 persist(); render();
}
function undo(){
 if(!S.history.length) return;
 const x=S.history.pop(); restore(x.state);
}
function setTemp(v){S.temp=v;persist();render();}

function togglePositions(){
 if(S.temp==='POSICIONS'){
   const changed=positionsStart && JSON.stringify(positionsStart.court)!==JSON.stringify(S.court);
   if(!changed){
     S.temp=null; positionsStart=null; persist(); render(); return;
   }
   // snapshot of the whole operation must be the pre-mode state.
   const current=deep(S.court);
   const hist=S.history;
   S=deep(positionsStart); S.history=hist;
   snapshot('POSICIONS');
   S.court=current; S.temp=null; pushAction('POSICIONS',{court:deep(current)});
   positionsStart=null; persist(); render(); return;
 }
 if(S.temp) return;
 positionsStart=deep(S); delete positionsStart.history;
 S.temp='POSICIONS'; persist(); render();
}
function swapPositions(a,b){
 if(S.temp!=='POSICIONS'||a===b||a==null||b==null) return;
 [S.court[a],S.court[b]]=[S.court[b],S.court[a]]; render();
}
function startChange(){
 if(S.temp==='CANVI DE JUGADORA'){ S.temp=null;changeOut=null;persist();render();return; }
 if(S.temp) return;
 changeOut=null; S.temp='CANVI DE JUGADORA'; persist();render();
}
function chooseCourtForChange(i){
 if(S.temp!=='CANVI DE JUGADORA') return;
 changeOut=i; render(); openBench();
}
function openBench(){
 const bench=ROSTER.filter(p=>!S.court.includes(p.n));
 const out=byNum(S.court[changeOut]);
 modal(`Canvi · surt ${out.name}`,
   `<p>Selecciona la jugadora que entra.</p><div class="bench-grid">${bench.map(p=>`<button class="bench-card" data-in="${p.n}"><strong>${p.name}</strong><small>#${p.n}</small></button>`).join('')}</div>`,
   [{text:'Cancel·lar',action:closeModal}]
 );
 $$('#modalBody [data-in]').forEach(b=>b.onclick=()=>confirmChange(Number(b.dataset.in)));
}
function confirmChange(inNum){
 const out=byNum(S.court[changeOut]), inc=byNum(inNum);
 modal('Confirmar canvi',`<p><strong>${out.name} → ${inc.name}</strong></p><p>La jugadora entrant ocuparà exactament la mateixa zona.</p>`,[
  {text:'Cancel·lar',action:()=>{closeModal(); S.temp=null;changeOut=null;persist();render();}},
  {text:'Confirmar',cls:'primary',action:()=>{
    const i=changeOut; snapshot(`CANVI · ${out.name} → ${inc.name}`);
    S.court[i]=inc.n; pushAction('CANVI',{out:out.n,in:inc.n,zone:i});
    S.temp=null;changeOut=null;closeModal();persist();render();
  }}
 ]);
}
function home(){
 modal('Tornar a Inici','<p>El partit es guardarà automàticament com a partit en curs i es podrà recuperar.</p>',[
  {text:'Cancel·lar',action:closeModal},
  {text:'Guardar i anar a Inici',cls:'primary',action:()=>{persist();closeModal();toast('Partit guardat per recuperar.');}}
 ]);
}
function finishSet(){
 modal('Finalitzar set',`<p>Vols tancar el set ${S.set} amb el marcador <strong>${S.score.home}–${S.score.away}</strong>?</p>`,[
  {text:'Cancel·lar',action:closeModal},
  {text:'Finalitzar set',cls:'primary',action:()=>{
    snapshot(`FINALITZAR SET ${S.set}`);
    S.setResults[S.set-1]=S.score.home>S.score.away?'home':'away';
    pushAction('FINAL_SET',{set:S.set,home:S.score.home,away:S.score.away});
    S.set=Math.min(5,S.set+1); S.score={home:0,away:0}; closeModal(); setupSet();
  }}
 ]);
}
function setupSet(){
 const options=ROSTER.map(p=>`<option value="${p.n}">#${p.n} ${p.name}</option>`).join('');
 const zoneNames=['4','3','2','5','6','1'];
 modal(`Preparar set ${S.set}`,
  `<p>Selecciona les sis jugadores, situa-les a les zones 1–6 i indica qui serveix.</p>
   <div class="setup-zones">${zoneNames.map((z,i)=>`<div class="setup-zone">Zona ${z}<select data-setup="${i}">${options}</select></div>`).join('')}</div>
   <div class="serve-choice"><label><input type="radio" name="serve" value="home"> Serveix Castellar</label><label><input type="radio" name="serve" value="away" checked> Serveix rival</label></div>`,
  [{text:'Confirmar inici del set',cls:'primary',action:()=>{
    const vals=$$('[data-setup]').map(x=>Number(x.value));
    if(new Set(vals).size!==6){toast('Calen sis jugadores diferents.');return;}
    S.court=vals; S.serving=$('input[name="serve"]:checked').value;
    S.phase=S.serving==='home'?'SERVEI':'RECEPCIÓ'; S.temp=null;S.sos=null;S.rivalTransit=false;
    pushAction('INICI_SET',{set:S.set,court:deep(vals),serving:S.serving});
    closeModal();persist();render();
  }}]
 );
 $$('[data-setup]').forEach((x,i)=>x.value=String(S.court[i]||ROSTER[i].n));
}
function finishMatch(){
 modal('Finalitzar partit','<p>Aquesta acció tancarà definitivament el partit i l’eliminarà de Recuperar partit.</p>',[
  {text:'Cancel·lar',action:closeModal},
  {text:'Finalitzar partit',cls:'danger',action:()=>{
    snapshot('FINALITZAR PARTIT'); pushAction('FINAL_PARTIT');
    S.finished=true;
    try{
      const history=JSON.parse(localStorage.getItem('statsCastellarC7History')||'[]');
      history.push(deep(S)); localStorage.setItem('statsCastellarC7History',JSON.stringify(history));
      localStorage.removeItem('statsCastellarC7Recovery');
    }catch(_){}
    closeModal(); finalSummary();
  }}
 ]);
}
function finalSummary(){
 modal('Partit finalitzat',`<div class="final-summary"><p>Partit desat a l’historial de la Capa 7.</p><p><strong>Sets registrats:</strong> ${S.setResults.filter(Boolean).length}</p><p>La pantalla final definitiva es definirà en una capa posterior.</p></div>`,[
  {text:'Tancar',cls:'primary',action:closeModal}
 ]);
}
function modal(title,body,actions=[]){
 $('#modalTitle').textContent=title; $('#modalBody').innerHTML=body;
 const box=$('#modalActions');box.innerHTML='';
 actions.forEach(a=>{const b=document.createElement('button');b.textContent=a.text;b.className=a.cls||'';b.onclick=a.action;box.appendChild(b);});
 $('#modalLayer').hidden=false;
}
function closeModal(){ $('#modalLayer').hidden=true; }

function renderPlayers(){
 const g=$('#playerGrid'); g.innerHTML='';
 S.court.forEach((num,i)=>{
  const p=byNum(num), slot=document.createElement('div');
  slot.className='player-slot'+(i===5?' zone-one':'')+(S.serving==='home'&&S.phase==='SERVEI'&&i===5?'':' no-serve')+(S.temp==='POSICIONS'?' position-mode':'')+(changeOut===i?' change-selected':'');
  slot.dataset.index=i; slot.draggable=S.temp==='POSICIONS';
  const rg=document.createElement('div');rg.className='rating-grid';
  [0,1,2,3].forEach(v=>{
    const b=document.createElement('button');b.className='r'+v;b.textContent=v;b.type='button';
    const disabled=!!S.temp || (S.sos?.active&&v===0) || (S.phase==='SERVEI'&&i!==5) || !['SERVEI','RECEPCIÓ','DEFENSA','COL·LOCACIÓ','ATAC'].includes(S.phase);
    b.disabled=disabled;b.onclick=e=>{e.stopPropagation();ratePlayer(i,v)};rg.appendChild(b);
  });
  slot.appendChild(rg);
  if(i===5){const ball=document.createElement('div');ball.className='server-ball';ball.hidden=!(S.serving==='home'&&S.phase==='SERVEI'&&!S.temp);slot.appendChild(ball);}
  const id=document.createElement('div');id.className='player-id';id.innerHTML=`<strong>${p.name}</strong><small>#${p.n}</small>`;slot.appendChild(id);
  slot.onclick=()=>chooseCourtForChange(i);
  slot.ondragstart=e=>{if(S.temp!=='POSICIONS')return;dragIndex=i;slot.classList.add('dragging');e.dataTransfer.effectAllowed='move';};
  slot.ondragend=()=>{slot.classList.remove('dragging');dragIndex=null};
  slot.ondragover=e=>{if(S.temp==='POSICIONS')e.preventDefault()};
  slot.ondrop=e=>{e.preventDefault();swapPositions(dragIndex,i)};
  // touch swap: tap first, tap destination
  if(S.temp==='POSICIONS') slot.onclick=()=>{if(dragIndex==null){dragIndex=i;slot.classList.add('change-selected')}else{swapPositions(dragIndex,i);dragIndex=null}};
  g.appendChild(slot);
 });
}
function renderBlocks(){
 const g=$('#blockGrid');g.innerHTML='';
 [0,1,2].forEach(i=>{
  const slot=document.createElement('div');slot.className='block-slot';
  [['crimson',0,'0 · BLOQUEIG FORA'],['petrol',1,'1 · BLOQUEIG'],['emerald',2,'2 · BLOQUEIG + PUNT']].forEach(([c,v,t])=>{
    const b=document.createElement('button');b.className=c;b.textContent=t;b.disabled=!!S.temp;b.onclick=()=>block(i,v);slot.appendChild(b);
  });g.appendChild(slot);
 });
}
function render(){
 $('#scoreHome').textContent=S.score.home; $('#scoreAway').textContent=S.score.away;
 $('#setNumber').textContent=S.set; $('#rivalName').textContent=S.rival;
 $('#actionValue').textContent=phaseLabel();
 const dots=$('#setDots');dots.innerHTML='';
 for(let i=0;i<5;i++){const d=document.createElement('i');if(S.setResults[i]==='home')d.className='won';else if(S.setResults[i]==='away')d.className='lost';else if(i===S.set-1)d.className='active';dots.appendChild(d);}
 const u=$('#undoBtn');u.disabled=!S.history.length;$('#undoLabel').textContent=S.history.length?S.history[S.history.length-1].label:'';
 const camp=$('#rivalCourtBtn');camp.disabled=!!S.temp||!['RECEPCIÓ','DEFENSA','COL·LOCACIÓ','BLOQUEIG'].includes(S.phase);camp.classList.toggle('enabled',!camp.disabled);
 $('#sosBtn').disabled=!(S.sos?.available||S.sos?.active)||!!S.temp;$('#sosBtn').classList.toggle('active-mode',!!S.sos?.active);
 $('#positionsBtn').classList.toggle('active-mode',S.temp==='POSICIONS');
 $('#changeBtn').classList.toggle('active-mode',S.temp==='CANVI DE JUGADORA');
 renderPlayers();renderBlocks();
}
$$('[data-score-team]').forEach(b=>b.onclick=()=>Number(b.dataset.delta)>0?manualPlus(b.dataset.scoreTeam):manualMinus(b.dataset.scoreTeam));
$('#undoBtn').onclick=undo;$('#rivalCourtBtn').onclick=rivalCourt;$('#sosBtn').onclick=toggleSOS;
$('#positionsBtn').onclick=togglePositions;$('#changeBtn').onclick=startChange;$('#homeBtn').onclick=home;
$('#finishSetBtn').onclick=finishSet;$('#finishMatchBtn').onclick=finishMatch;
$('#modalLayer').onclick=e=>{if(e.target===$('#modalLayer')) closeModal();};

render(); persist();
})();