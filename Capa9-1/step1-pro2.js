(async()=>{'use strict';
await Pro2TeamStore.ready;
const draft=Pro2DraftStore.current(),teams=Pro2TeamStore.listTeams(),sel=document.getElementById('team');
const sexLabel={female:'Femení',male:'Masculí',mixed:'Mixt'};sel.replaceChildren(...teams.map(t=>{const o=document.createElement('option');o.value=t.teamId;o.textContent=`${t.name} · ${sexLabel[t.sex]||t.sex||''}`;return o;}));
if(draft.team?.teamId&&teams.some(t=>t.teamId===draft.team.teamId))sel.value=draft.team.teamId;
if(draft.match?.opponent)document.getElementById('opponent').value=draft.match.opponent;
if(draft.match?.date){document.getElementById('match-date').value=draft.match.date;const [y,m,d]=draft.match.date.split('-');document.getElementById('date-label').textContent=`${d}/${m}/${y}`;}
if(draft.match?.venue){document.querySelectorAll('.venue button').forEach(b=>{const v=b.textContent.includes('VISITANT')?'away':'home';b.classList.toggle('selected',v===draft.match.venue);b.setAttribute('aria-pressed',String(v===draft.match.venue));});}
const wrap=document.createElement('div');wrap.className='c9-next-wrap';const err=document.createElement('div');err.id='c9-error';err.setAttribute('role','alert');const next=document.createElement('button');next.id='c9-next';next.type='button';next.textContent='Desa i continua ›';wrap.append(err,next);document.body.append(wrap);
next.onclick=()=>{const opponent=document.getElementById('opponent').value.trim(),date=document.getElementById('match-date').value,vb=document.querySelector('.venue button.selected');if(!opponent){err.textContent='Introdueix el nom de l’equip rival.';return}if(!date||!vb){err.textContent='Selecciona la data i on es juga.';return}const team=Pro2TeamStore.getTeam(sel.value);const visualProfile=Pro2VisualProfiles.resolve(team);draft.team={teamId:team.teamId,name:team.name,category:team.category,sex:visualProfile.sex,visualProfile,gameFormat:team.gameFormat||{format:'volleyball-6x6',playersOnCourt:6,minivolleyEnabled:false}};draft.match={opponent,date,venue:vb.textContent.includes('VISITANT')?'away':'home'};draft.completedSteps.step1=true;Pro2DraftStore.save(draft);location.href='../Capa9-2/index.html';};
})();
