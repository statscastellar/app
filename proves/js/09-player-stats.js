(()=>{
 const ACTIONS=['Servei','Recepció','Col·locació','Atac','Bloqueig'];
 const DB='StatsCastellarDB',STORE='matches';
 let ctx=null, matches=[];
 const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
 function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'})}})}
 async function all(){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
 function playerInMatch(m,p){return (m.players||[]).find(x=>String(x.number)===String(p.number))||(m.players||[]).find(x=>String(x.name||'').toLowerCase()===String(p.name||'').toLowerCase())}
 function sets(m){return (m.completedSets||[]).slice().sort((a,b)=>Number(a.set)-Number(b.set))}
 function actionsFor(m,p){const mp=playerInMatch(m,p);if(!mp)return[];return sets(m).flatMap(s=>(s.actions||[]).filter(a=>a.playerId===mp.id))}
 function counts(acts,action){const max=action==='Bloqueig'?2:3,out=Array(max+1).fill(0);acts.filter(a=>a.action===action).forEach(a=>{const v=Number(a.value);if(v>=0&&v<=max)out[v]++});return out}
 function avgPct(c){const n=c.reduce((a,b)=>a+b,0);if(!n)return null;const max=c.length-1;return c.reduce((s,n,i)=>s+n*i,0)/(n*max)*100}
 function playedSets(m,p){const mp=playerInMatch(m,p);if(!mp)return 0;let total=0;sets(m).forEach(s=>{const r=s.participation&&s.participation[mp.id];if(r&&Number(r.percentage)>0)total+=Number(r.percentage)/100});return total}
 function fmtDate(d){const x=String(d||'').split('-');return x.length===3?x[2]+'/'+x[1]+'/'+x[0]:d||''}
 async function render(){
   if(!ctx)return; matches=(await all()).filter(m=>m&&m.finished&&m.teamId===ctx.teamId&&playerInMatch(m,ctx.player)).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
   document.getElementById('playerStatsTitle').textContent=ctx.player.number+' · '+ctx.player.name;
   const totalSets=matches.reduce((s,m)=>s+playedSets(m,ctx.player),0);
   const allActs=matches.flatMap(m=>actionsFor(m,ctx.player));
   document.getElementById('playerStatsSummary').innerHTML='<h2>'+esc(ctx.player.number)+' · '+esc(ctx.player.name)+'</h2><div class="player-stats-kpis"><div class="player-stats-kpi"><strong>'+matches.length+'</strong><small>Partits</small></div><div class="player-stats-kpi"><strong>'+totalSets.toFixed(1).replace('.',',')+'</strong><small>Sets equivalents</small></div><div class="player-stats-kpi"><strong>'+allActs.length+'</strong><small>Accions registrades</small></div></div>';
   const host=document.getElementById('playerStatsActions');
   if(!matches.length){host.innerHTML='<div class="stats-empty">Encara no hi ha partits d’aquesta jugadora a l’historial.</div>';document.getElementById('playerStatsTrend').innerHTML='';document.getElementById('playerStatsMatches').innerHTML='';return}
   host.innerHTML=ACTIONS.map(a=>{const c=counts(allActs,a),n=c.reduce((x,y)=>x+y,0),avg=avgPct(c);return '<div class="global-action"><div class="global-action-head"><span>'+a+'</span><span>'+(avg===null?'—':Math.round(avg)+'%')+' · '+n+' acc.</span></div><div class="rating-dist '+(c.length===3?'three':'')+'">'+c.map((v,i)=>'<div class="rating-chip">'+i+': '+(n?Math.round(v/n*100):0)+'%</div>').join('')+'</div></div>'}).join('');
   document.getElementById('playerStatsMatches').innerHTML=matches.slice().reverse().map(m=>'<div class="stats-match-row"><span><b>'+esc(m.opponent||'Rival')+'</b><br><small>'+fmtDate(m.date)+'</small></span><span>'+actionsFor(m,ctx.player).length+' acc.</span></div>').join('');
   renderTrend();
 }
 function renderTrend(){const action=document.getElementById('playerStatsAction').value,host=document.getElementById('playerStatsTrend');const rows=matches.map(m=>{const c=counts(actionsFor(m,ctx.player),action);return {m,v:avgPct(c),n:c.reduce((a,b)=>a+b,0)}}).filter(x=>x.n);host.innerHTML=rows.length?rows.map(x=>'<div class="trend-row"><span>'+fmtDate(x.m.date)+'</span><div class="trend-bar"><span style="width:'+Math.max(0,Math.min(100,x.v))+'%"></span></div><b>'+Math.round(x.v)+'%</b></div>').join(''):'<div class="stats-empty">No hi ha dades de '+esc(action.toLowerCase())+'.</div>'}
 window.openPlayerSeasonStats=async(teamId,player)=>{
   ctx={teamId,player};
   if(typeof window.statsNavigate==='function') window.statsNavigate('player-stats',true);
   else {
     document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
     document.getElementById('player-stats')?.classList.add('active');
     window.scrollTo(0,0);
   }
   try{await render()}catch(err){
     console.error('Estadístiques jugadora:',err);
     const title=document.getElementById('playerStatsTitle');
     const summary=document.getElementById('playerStatsSummary');
     const actions=document.getElementById('playerStatsActions');
     if(title) title.textContent=player.number+' · '+player.name;
     if(summary) summary.innerHTML='<h2>'+esc(player.number)+' · '+esc(player.name)+'</h2><div class="player-stats-kpis"><div class="player-stats-kpi"><strong>0</strong><small>Partits</small></div><div class="player-stats-kpi"><strong>0</strong><small>Sets equivalents</small></div><div class="player-stats-kpi"><strong>0</strong><small>Accions registrades</small></div></div>';
     if(actions) actions.innerHTML='<div class="stats-empty">Encara no hi ha estadístiques disponibles. Les dades apareixeran automàticament quan hi hagi partits desats d’aquest equip.</div>';
   }
 };
 document.getElementById('playerStatsAction')?.addEventListener('change',renderTrend);
})();
