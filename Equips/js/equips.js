(async()=>{
  'use strict';
  await Pro2TeamStore.ready;
  const $=s=>document.querySelector(s);
  const categoryRank={'Sènior':100,'Júnior':90,'Juvenil':80,'Cadet':70,'Infantil':60,'Màster':10};
  const categoryCodes={'Sènior':'SENIOR','Júnior':'JUNIOR','Juvenil':'JUVENIL','Cadet':'CADET','Infantil':'INFANTIL','Màster':'MASTER'};
  const ageGroups={'Sènior':'SENIOR','Júnior':'U20','Juvenil':'U18','Cadet':'U16','Infantil':'U14','Màster':'MASTER'};
  const sexToStore={'Femení':'female','Masculí':'male','Mixt':'mixed'};
  const sexFromStore={female:'Femení',male:'Masculí',mixed:'Mixt'};
  const teamsList=$('#teamsList'),teamModal=$('#teamModal');
  let editingTeamId=null;
  const categoryLabel=t=>t?.category?.label||t?.category||'';
  const seasonOf=t=>t?.season||'2026-27';
  const orderedTeams=()=>[...Pro2TeamStore.listTeams()].sort((a,b)=>{const ra=categoryRank[categoryLabel(a)]??0,rb=categoryRank[categoryLabel(b)]??0;return rb!==ra?rb-ra:a.name.localeCompare(b.name,'ca')});
  function openModal(el){el.classList.add('open');el.setAttribute('aria-hidden','false')}
  function closeModal(el){el.classList.remove('open');el.setAttribute('aria-hidden','true')}
  function rebuildSexOptions(){
    const cat=$('#teamCategoryInput').value,sex=$('#teamSexInput');
    const previous=sex.value;
    sex.replaceChildren();
    if(cat==='Màster'){
      const o=document.createElement('option');o.value='Mixt';o.textContent='Mixt';sex.append(o);sex.value='Mixt';sex.disabled=true;
    }else{
      for(const label of ['Femení','Masculí']){const o=document.createElement('option');o.value=label;o.textContent=label;sex.append(o)}
      sex.disabled=false;sex.value=(previous==='Masculí')?'Masculí':'Femení';
    }
  }
  function renderTeams(){
    teamsList.innerHTML='';
    const teams=orderedTeams();
    if(!teams.length){teamsList.innerHTML='<div class="empty-state">Encara no hi ha cap equip creat.</div>';return}
    teams.forEach(team=>{
      const row=document.createElement('div');row.className='team-row';row.dataset.teamId=team.teamId;
      const sex=sexFromStore[team.sex]||team.sex||'';
      row.innerHTML=`<a class="team-link" href="plantilla.html?team=${encodeURIComponent(team.teamId)}" aria-label="Obrir ${team.name}"><div class="team-main"><div class="team-name">${team.name}</div><div class="team-meta">${categoryLabel(team)} · ${sex} · Temporada ${seasonOf(team)}</div></div></a><div class="team-actions"><button class="icon-btn edit" type="button" aria-label="Editar equip">✎</button><button class="delete-team" type="button" aria-label="Eliminar equip">×</button></div>`;
      row.querySelector('.edit').onclick=e=>{e.preventDefault();e.stopPropagation();openTeamModal(team.teamId)};
      row.querySelector('.delete-team').onclick=e=>{e.preventDefault();e.stopPropagation();deleteTeam(team.teamId)};
      teamsList.append(row);
    });
  }
  function openTeamModal(teamId=null){
    editingTeamId=teamId;const team=teamId?Pro2TeamStore.getTeam(teamId):null;
    $('#teamModalTitle').textContent=team?'Editar equip':'Afegir equip';
    $('#teamNameInput').value=team?.name||'';
    $('#teamCategoryInput').value=categoryLabel(team)||'Infantil';
    rebuildSexOptions();
    if(team?.sex==='male'&&$('#teamCategoryInput').value!=='Màster')$('#teamSexInput').value='Masculí';
    $('#teamSeasonInput').value=seasonOf(team);openModal(teamModal);setTimeout(()=>$('#teamNameInput').focus(),0);
  }
  async function saveTeam(){
    try{
      const name=$('#teamNameInput').value.trim(),category=$('#teamCategoryInput').value,sexLabel=category==='Màster'?'Mixt':$('#teamSexInput').value,season=$('#teamSeasonInput').value.trim();
      if(!name){alert('Escriu el nom de l’equip.');return}if(!season){alert('Escriu la temporada.');return}
      const patch={name,category:{code:categoryCodes[category],label:category,ageGroup:ageGroups[category]},sex:sexToStore[sexLabel],season,gameFormat:{format:'volleyball-6x6',playersOnCourt:6,minivolleyEnabled:false}};
      patch.visualProfile=Pro2VisualProfiles.resolve({...patch,teamId:editingTeamId||undefined});
      if(editingTeamId)await Pro2TeamStore.updateTeam(editingTeamId,patch);else await Pro2TeamStore.createTeam(patch);
      renderTeams();closeModal(teamModal);
    }catch(e){alert(e.message||String(e))}
  }
  async function deleteTeam(teamId){
    const team=Pro2TeamStore.getTeam(teamId);if(!team)return;
    if(!confirm(`Vols eliminar l’equip ${team.name}?`))return;
    if(!confirm(`Segona confirmació: s’eliminarà ${team.name} de les opcions actives. Els partits històrics conservaran la referència a aquest equip. Continuar?`))return;
    try{await Pro2TeamStore.setTeamActive(teamId,false);renderTeams()}catch(e){alert(e.message||String(e))}
  }
  $('#teamCategoryInput')?.addEventListener('change',rebuildSexOptions);
  $('#addTeam')?.addEventListener('click',e=>{e.preventDefault();openTeamModal()});
  $('#cancelTeam')?.addEventListener('click',()=>closeModal(teamModal));
  $('#saveTeam')?.addEventListener('click',saveTeam);
  teamModal?.addEventListener('click',e=>{if(e.target===teamModal)closeModal(teamModal)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal(teamModal)});
  function positionWallCrest(){
    const crest=document.getElementById('wallCrest'),bg=document.querySelector('.bg');if(!crest||!bg)return;
    const naturalW=1672,naturalH=941,rect=bg.getBoundingClientRect(),w=rect.width,h=rect.height,scale=Math.max(w/naturalW,h/naturalH),renderedW=naturalW*scale,renderedH=naturalH*scale;
    const sourceX=naturalW*0.5064,sourceY=naturalH*0.282;let offsetX=(w-renderedW)/2,offsetY=(h-renderedH)/2;
    if(matchMedia('(orientation:portrait)').matches)offsetX=(w-renderedW)*0.40;if(matchMedia('(orientation:landscape) and (max-height:500px)').matches)offsetY=(h-renderedH)*0.55;
    const centerX=offsetX+sourceX*scale,centerY=offsetY+sourceY*scale,desired=Math.max(82,Math.min(150,136*scale));crest.style.width=desired+'px';const r=crest.getBoundingClientRect();crest.style.left=(centerX-(r.width||desired)/2)+'px';crest.style.top=(centerY-(r.height||desired*1.28)/2)+'px';crest.style.transform='none';
  }
  addEventListener('resize',positionWallCrest,{passive:true});addEventListener('orientationchange',positionWallCrest,{passive:true});if(window.visualViewport)visualViewport.addEventListener('resize',positionWallCrest,{passive:true});
  rebuildSexOptions();renderTeams();positionWallCrest();
})();
