(() => {
  const TEAM_KEY='statsCastellarTeamsV1';
  const state={step:1,teamId:'infantil-a',opponent:'',date:'',venue:'home',available:[],guests:[],starting:[],positions:{},firstServe:null,nextSetMode:false,currentSet:1};

  const $=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function teams(){
    try{
      const list=JSON.parse(localStorage.getItem(TEAM_KEY)||'[]');
      return Array.isArray(list)?list:[];
    }catch(e){return[]}
  }
  function selectedTeam(){return teams().find(t=>t.id===state.teamId)}
  function allPlayers(){
    const t=selectedTeam();
    return [...((t&&t.players)||[]),...state.guests].sort((a,b)=>(Number(a.number)||999)-(Number(b.number)||999));
  }
  function showStep(n){
    state.step=n;
    [1,2,3,4].forEach(i=>{const el=$('matchStep'+i);if(el)el.hidden=i!==n});
    if(n===2)renderAvailable();
    if(n===3){
      if($('startingSixTitle'))$('startingSixTitle').textContent='Sis inicial · Set '+state.currentSet;
      renderStarting();
    }
    if(n===4){
      if($('positionsTitle'))$('positionsTitle').textContent='Posicions a pista · Set '+state.currentSet;
      renderCourt();updateFirstServeButtons();
      if($('readyForSet'))$('readyForSet').textContent='Preparat per començar el Set '+state.currentSet;
    }
    window.scrollTo(0,0);
  }
  function prepare(){
    const sel=$('matchTeam'); if(!sel)return;
    const list=teams(); sel.innerHTML='';
    list.forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.name;sel.appendChild(o)});
    if(list.length && !list.some(t=>t.id===state.teamId))state.teamId=list[0].id;
    sel.value=state.teamId;
    if(!$('matchDate').value){
      const d=new Date(), local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
      $('matchDate').value=local; state.date=local;
    }
  }
  document.querySelector('[data-go="new-match"]').addEventListener('click',()=>{prepare();showStep(1)});

  $('matchTeam').addEventListener('change',e=>{
    state.teamId=e.target.value;state.available=[];state.guests=[];state.starting=[];state.positions={}
  });
  document.querySelectorAll('[data-venue]').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('[data-venue]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');state.venue=b.dataset.venue;
  });
  $('step1Next').onclick=()=>{
    state.opponent=$('matchOpponent').value.trim();state.date=$('matchDate').value;
    if(!state.opponent)return alert('Indica el nom del rival.');
    if(!state.date)return alert('Indica la data del partit.');
    state.teamId=$('matchTeam').value; showStep(2);
  };

  function renderAvailable(){
    const host=$('availablePlayers');host.innerHTML='';
    const players=allPlayers();
    if(!state.available.length)state.available=players.map(p=>p.id);
    players.forEach(p=>{
      const b=document.createElement('button');b.type='button';
      b.className='available-player'+(state.available.includes(p.id)?' selected':'');
      b.innerHTML='<span class="num">'+esc(p.number)+'</span><span class="name">'+esc(p.name)+(p.guest?' · convidada':'')+'</span><span class="check">'+(state.available.includes(p.id)?'✓':'')+'</span>';
      b.onclick=()=>{
        state.available=state.available.includes(p.id)?state.available.filter(x=>x!==p.id):[...state.available,p.id];
        state.starting=state.starting.filter(x=>state.available.includes(x));renderAvailable();
      };
      host.appendChild(b);
    });
  }
  $('guestPlayerBtn').onclick=()=>{
    const number=prompt('Dorsal de la convidada:');if(number===null)return;
    const name=prompt('Nom de la convidada:');if(name===null||!name.trim()||!number.trim())return;
    const p={id:'guest-'+Date.now().toString(36),number:number.trim(),name:name.trim(),guest:true};
    state.guests.push(p);state.available.push(p.id);renderAvailable();
  };
  document.querySelector('[data-match-prev="1"]').onclick=()=>showStep(1);
  $('step2Next').onclick=()=>{
    if(state.available.length<6)return alert('Cal tenir com a mínim 6 jugadores disponibles.');
    showStep(3);
  };

  function renderStarting(){
    const host=$('startingSixList');host.innerHTML='';
    const players=allPlayers().filter(p=>state.available.includes(p.id));
    players.forEach(p=>{
      const selected=state.starting.includes(p.id);
      const b=document.createElement('button');b.type='button';b.className='available-player'+(selected?' selected':'');
      b.innerHTML='<span class="num">'+esc(p.number)+'</span><span class="name">'+esc(p.name)+'</span><span class="check">'+(selected?'✓':'')+'</span>';
      b.onclick=()=>{
        if(selected)state.starting=state.starting.filter(x=>x!==p.id);
        else{
          if(state.starting.length>=6)return alert('Ja has seleccionat les 6 jugadores.');
          state.starting.push(p.id);
        }
        renderStarting();
      };
      host.appendChild(b);
    });
    $('sixCounter').textContent=state.starting.length+' / 6 seleccionades';
  }
  document.querySelector('[data-match-prev="2"]').onclick=()=>showStep(2);
  $('step3Next').onclick=()=>{
    if(state.starting.length!==6)return alert('Has de seleccionar exactament 6 jugadores.');
    state.positions={};showStep(4);
  };

  function playerById(id){return allPlayers().find(p=>p.id===id)}
  function renderCourt(){
    document.querySelectorAll('.court-slot').forEach(slot=>{
      const id=state.positions[slot.dataset.pos],p=id&&playerById(id);
      slot.querySelector('.court-player').textContent=p?(p.number+' · '+p.name):'—';
      if(id) slot.dataset.playerId=id; else delete slot.dataset.playerId;
      slot.classList.toggle('filled',!!p);
    });
    const pool=$('positionPool');pool.innerHTML='';
    state.starting.map(playerById).filter(Boolean).forEach(p=>{
      const b=document.createElement('button');b.type='button';b.className='position-chip';
      const assigned=Object.values(state.positions).includes(p.id);
      if(assigned)b.classList.add('assigned');
      b.textContent=p.number+' · '+p.name;
      b.dataset.playerId=p.id;
      b.dataset.playerLabel=p.number+' · '+p.name;
      pool.appendChild(b);
    });
  }
  document.querySelectorAll('.court-slot').forEach(slot=>slot.onclick=()=>{
    const pos=slot.dataset.pos;
    const candidates=state.starting.map(playerById).filter(Boolean);
    const current=state.positions[pos];
    let text='Posició '+pos+'. Escriu el dorsal de la jugadora:\n\n'+candidates.map(p=>p.number+' · '+p.name).join('\n');
    const answer=prompt(text,current?(playerById(current)||{}).number||'':'');
    if(answer===null)return;
    const p=candidates.find(x=>String(x.number)===answer.trim());
    if(!p)return alert('No he trobat cap jugadora del sis inicial amb aquest dorsal.');
    const oldPos=Object.keys(state.positions).find(k=>state.positions[k]===p.id);
    if(oldPos&&oldPos!==pos){
      const displaced=state.positions[pos];
      state.positions[pos]=p.id;
      if(displaced)state.positions[oldPos]=displaced; else delete state.positions[oldPos];
    }else state.positions[pos]=p.id;
    renderCourt();
  });
  
  document.addEventListener('stats-court-assign',e=>{
    const {playerId,pos}=e.detail||{};
    if(!playerId||!pos||!state.starting.includes(playerId))return;

    const oldPos=Object.keys(state.positions).find(k=>state.positions[k]===playerId);
    const displaced=state.positions[pos];

    if(oldPos && oldPos!==pos){
      state.positions[pos]=playerId;
      if(displaced) state.positions[oldPos]=displaced;
      else delete state.positions[oldPos];
    }else{
      state.positions[pos]=playerId;
    }
    renderCourt();
  });

document.querySelector('[data-match-prev="3"]').onclick=()=>showStep(3);
  
  function updateFirstServeButtons(){
    const rival=$('firstServeRival'), cast=$('firstServeCastellar');
    if(rival)rival.textContent='🏐 '+(state.opponent||'RIVAL').toUpperCase();
    if(cast)cast.classList.toggle('selected',state.firstServe==='castellar');
    if(rival)rival.classList.toggle('selected',state.firstServe==='rival');
    const ready=$('readyForSet');
    if(ready)ready.disabled=(Object.keys(state.positions).length!==6 || !state.firstServe);
  }
  document.querySelectorAll('[data-first-serve]').forEach(b=>b.onclick=()=>{
    state.firstServe=b.dataset.firstServe;
    updateFirstServeButtons();
  });

$('readyForSet').onclick=()=>{
    if(Object.keys(state.positions).length!==6)return alert('Cal col·locar les 6 jugadores a pista.');
    if(!state.firstServe)return alert('Indica qui comença servint.');
    const detail={
      teamId:state.teamId,
      opponent:state.opponent,
      date:state.date,
      venue:state.venue,
      starting:[...state.starting],
      positions:{...state.positions},
      players:allPlayers().map(p=>({...p})),
      serving:state.firstServe,
      set:state.currentSet
    };
    document.dispatchEvent(new CustomEvent('stats-start-scoring',{detail}));
    const bridge=document.createElement('button');
    bridge.type='button';bridge.dataset.go='scoring';bridge.style.display='none';
    document.body.appendChild(bridge);bridge.click();bridge.remove();
  };
  window.statsPrepareNextSet=function(detail){
    state.nextSetMode=true;
    state.currentSet=Number(detail.set)||2;
    state.teamId=detail.teamId;
    state.opponent=detail.opponent;
    state.date=detail.date;
    state.venue=detail.venue;
    state.guests=(detail.players||[]).filter(p=>p.guest);
    state.available=(detail.available||detail.players||[]).map(p=>typeof p==='string'?p:p.id);
    state.starting=[];
    state.positions={};
    state.firstServe=null;

    const bridge=document.createElement('button');
    bridge.type='button';bridge.dataset.go='new-match';bridge.style.display='none';
    document.body.appendChild(bridge);bridge.click();bridge.remove();
    showStep(3);
  };

})();
