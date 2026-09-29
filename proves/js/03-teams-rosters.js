(() => {
  const STORAGE_KEY='statsCastellarTeamsV1';
  const DEFAULT_PLAYERS=[
    {id:'ia-3',number:'3',name:'Nora'},
    {id:'ia-4',number:'4',name:'Aran'},
    {id:'ia-6',number:'6',name:'Avril'},
    {id:'ia-7',number:'7',name:'Emma'},
    {id:'ia-8',number:'8',name:'Isona'},
    {id:'ia-10',number:'10',name:'Thais'},
    {id:'ia-11',number:'11',name:'Yveth'},
    {id:'ia-13',number:'13',name:'Maria'},
    {id:'ia-16',number:'16',name:'Ainhoa'},
    {id:'ia-18',number:'18',name:'Ària'},
    {id:'ia-28',number:'28',name:'Mariona'},
    {id:'ia-66',number:'66',name:'Núria'}
  ];
  const DEFAULT_TEAM={id:'infantil-a',name:'Infantil A',protected:true,players:DEFAULT_PLAYERS};
  let selectedTeamId='infantil-a';

  function clone(x){return JSON.parse(JSON.stringify(x))}
  function loadTeams(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(Array.isArray(saved)){
        const base=saved.find(t=>t.id==='infantil-a');
        if(!base) saved.unshift(clone(DEFAULT_TEAM));
        else base.protected=true;
        return saved;
      }
    }catch(e){}
    return [clone(DEFAULT_TEAM)];
  }
  let teams=loadTeams();
  function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(teams))}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function uid(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)}
  function team(){return teams.find(t=>t.id===selectedTeamId)||teams[0]}

  function renderTeams(){
    const host=document.getElementById('teamList'); if(!host)return;
    host.innerHTML='';
    teams.forEach(t=>{
      const row=document.createElement('div'); row.className='team-row';
      const open=document.createElement('button'); open.type='button'; open.className='team-open';
      open.innerHTML='<span>'+esc(t.name)+'</span><span class="arrow">›</span>';
      open.onclick=()=>{
        selectedTeamId=t.id;
        renderRoster();
        const bridge=document.createElement('button');
        bridge.type='button';
        bridge.dataset.go='roster';
        bridge.style.display='none';
        document.body.appendChild(bridge);
        bridge.click();
        bridge.remove();
      };
      row.appendChild(open);
      if(!t.protected){
        const del=document.createElement('button'); del.type='button'; del.className='team-delete';
        del.setAttribute('aria-label','Eliminar '+t.name); del.textContent='×';
        del.onclick=()=>confirmDeleteTeam(t.id);
        row.appendChild(del);
      }
      host.appendChild(row);
    });
  }

  function renderRoster(){
    const t=team(); if(!t)return;
    document.getElementById('rosterTeamName').textContent=t.name; document.getElementById('roster').dataset.teamId=t.id;
    const host=document.getElementById('playerList'); host.innerHTML='';
    const players=[...(t.players||[])].sort((a,b)=>(Number(a.number)||999)-(Number(b.number)||999));
    if(!players.length){host.innerHTML='<div class="empty-roster">Encara no hi ha jugadores en aquesta plantilla.</div>';return}
    players.forEach(p=>{
      const row=document.createElement('div');row.className='player-row';
      row.dataset.playerId=p.id; row.dataset.playerNumber=p.number; row.dataset.playerName=p.name; row.style.cursor='pointer'; row.innerHTML='<div class="player-number">'+esc(p.number)+'</div><div class="player-name">'+esc(p.name)+'</div>'; row.onclick=(e)=>{if(e.target.closest('.player-edit'))return; window.openPlayerSeasonStats&&window.openPlayerSeasonStats(t.id,p);};
      const edit=document.createElement('button');edit.type='button';edit.className='player-edit';edit.textContent='Editar';
      edit.onclick=()=>openPlayerEditor(p.id);
      row.appendChild(edit);host.appendChild(row);
    });
  }

  const modal=document.getElementById('appModal'), body=document.getElementById('modalBody');
  function closeModal(){modal.hidden=true;body.innerHTML=''}
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});

  document.getElementById('addTeamBtn').onclick=()=>{
    body.innerHTML='<h2>Afegir equip</h2><div class="field"><label>Nom de l’equip</label><input id="newTeamName" maxlength="40" autocomplete="off"></div><div class="modal-actions"><button class="btn-cancel" id="cancelModal">Cancel·lar</button><button class="btn-save" id="saveTeam">Crear equip</button></div>';
    modal.hidden=false; document.getElementById('newTeamName').focus();
    document.getElementById('cancelModal').onclick=closeModal;
    document.getElementById('saveTeam').onclick=()=>{
      const name=document.getElementById('newTeamName').value.trim();
      if(!name)return;
      if(teams.some(t=>t.name.toLowerCase()===name.toLowerCase()))return alert('Ja existeix un equip amb aquest nom.');
      teams.push({id:uid('team'),name,protected:false,players:[]});save();renderTeams();closeModal();
    };
  };

  function confirmDeleteTeam(id){
    const t=teams.find(x=>x.id===id); if(!t||t.protected)return;
    body.innerHTML='<h2>Eliminar equip</h2><p class="confirm-warning">Segur que vols eliminar <span class="confirm-name">'+esc(t.name)+'</span>? Aquesta acció elimina la seva plantilla actual. Els partits històrics, quan els incorporem, es guardaran separadament i no dependran de la plantilla actual.</p><div class="modal-actions"><button class="btn-cancel" id="cancelModal">Cancel·lar</button><button class="btn-danger" id="deleteTeamConfirm">Eliminar definitivament</button></div>';
    modal.hidden=false;
    document.getElementById('cancelModal').onclick=closeModal;
    document.getElementById('deleteTeamConfirm').onclick=()=>{teams=teams.filter(x=>x.id!==id);save();renderTeams();closeModal()};
  }

  document.getElementById('addPlayerBtn').onclick=()=>openPlayerEditor(null);

  function openPlayerEditor(playerId){
    const t=team(), existing=playerId?(t.players||[]).find(p=>p.id===playerId):null;
    body.innerHTML='<h2>'+(existing?'Editar jugadora':'Afegir jugadora')+'</h2>'+
      '<div class="field"><label>Dorsal</label><input id="playerNumber" inputmode="numeric" maxlength="3" value="'+esc(existing?existing.number:'')+'"></div>'+
      '<div class="field"><label>Nom</label><input id="playerName" maxlength="40" value="'+esc(existing?existing.name:'')+'"></div>'+
      '<div class="modal-actions"><button class="btn-cancel" id="cancelModal">Cancel·lar</button><button class="btn-save" id="savePlayer">Desar</button></div>'+
      (existing?'<div class="danger-zone"><button class="btn-danger" id="askDeletePlayer">Eliminar jugadora…</button></div>':'');
    modal.hidden=false;
    document.getElementById(existing?'playerName':'playerNumber').focus();
    document.getElementById('cancelModal').onclick=closeModal;
    document.getElementById('savePlayer').onclick=()=>{
      const number=document.getElementById('playerNumber').value.trim();
      const name=document.getElementById('playerName').value.trim();
      if(!number||!name)return alert('Cal indicar dorsal i nom.');
      if((t.players||[]).some(p=>p.id!==playerId && String(p.number)===number))return alert('Ja hi ha una jugadora amb aquest dorsal.');
      if(existing){existing.number=number;existing.name=name}
      else{t.players=t.players||[];t.players.push({id:uid('player'),number,name})}
      save();renderRoster();closeModal();
    };
    if(existing) document.getElementById('askDeletePlayer').onclick=()=>confirmDeletePlayer(existing.id);
  }

  function confirmDeletePlayer(id){
    const t=team(), p=(t.players||[]).find(x=>x.id===id); if(!p)return;
    body.innerHTML='<h2>Eliminar jugadora</h2><p class="confirm-warning">Segur que vols eliminar <span class="confirm-name">'+esc(p.name)+' ('+esc(p.number)+')</span> de la plantilla de '+esc(t.name)+'?</p><p class="confirm-warning">Aquesta acció només afecta la plantilla actual. Les estadístiques de partits antics no s’eliminaran quan incorporem l’historial.</p><div class="modal-actions"><button class="btn-cancel" id="cancelModal">Cancel·lar</button><button class="btn-danger" id="deletePlayerConfirm">Eliminar definitivament</button></div>';
    modal.hidden=false;
    document.getElementById('cancelModal').onclick=closeModal;
    document.getElementById('deletePlayerConfirm').onclick=()=>{t.players=t.players.filter(x=>x.id!==id);save();renderRoster();closeModal()};
  }

  renderTeams();
})();
