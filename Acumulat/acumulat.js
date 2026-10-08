(async()=>{'use strict';
const P=window.StatsPro2,$=q=>document.querySelector(q),store=new P.Pro2Storage(new P.IndexedDBStorageAdapter());
const fmt=v=>v==null?'—':(v*100).toFixed(1)+'%';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={SERVEI:'Servei',RECEPCIO:'Recepció',COLLOCACIO:'Col·locació',ATAC:'Atac',DEFENSA:'Defensa'};
$('#backBtn').onclick=()=>location.href='../Historial/index.html';
function ensureTeamSelect(groups){let sel=document.querySelector('#teamFilter');if(sel)return sel;const meta=$('#meta');sel=document.createElement('select');sel.id='teamFilter';sel.setAttribute('aria-label','Equip dels acumulats');sel.style.marginLeft='12px';for(const [id,c] of Object.entries(groups)){const o=document.createElement('option');o.value=id;o.textContent=c.teamName||id;sel.appendChild(o);}meta.after(sel);return sel;}
function renderCumulative(c){
  $('#empty').hidden=!!c.matches;$('#content').hidden=!c.matches;if(!c.matches)return;
  $('#meta').textContent=`${c.teamName?c.teamName+' · ':''}${c.matches} partit${c.matches===1?'':'s'}`;
  $('#matches').textContent=c.matches;$('#actions').textContent=c.teamAnnaTotal.actions;$('#eff').textContent=fmt(c.teamAnnaTotal.efficiency);
  const tb=$('#players');tb.innerHTML='';for(const p of c.players){const tr=document.createElement('tr');tr.innerHTML=`<td>${esc(p.number)}</td><td class="name">${esc(p.name)}</td><td>${p.matches}</td><td>${fmt(p.participation.participation)}</td><td>${p.annaTotal.actions}</td><td>${fmt(p.annaTotal.efficiency)}</td><td>${fmt(p.impact)}</td><td>${p.saves.counts[1]}</td><td>${p.saves.counts[2]}</td><td>${p.saves.counts[3]}</td><td><strong>${p.saves.total}</strong></td><td>${p.blocks.total}</td>`;tb.appendChild(tr);}
  const g=$('#foundations');g.innerHTML='';for(const [k,b] of Object.entries(c.teamAnna)){const d=document.createElement('div');d.className='foundation';d.innerHTML=`<h3>${labels[k]||k}</h3><div class="ratings">${[0,1,2,3].map(v=>`<div class="r r${v}">${v}<br><small>${b.counts[v]}</small></div>`).join('')}</div><p>${b.actions} accions · <strong>${fmt(b.efficiency)}</strong></p>`;g.appendChild(d);}
}
try{
  const rows=await store.listHistoryVerified();if(!rows.length){$('#empty').hidden=false;return;}
  const groups=P.calculateVerifiedCumulativeByTeam(rows);const ids=Object.keys(groups);
  if(!ids.length){$('#empty').hidden=false;return;}
  if(ids.length===1){renderCumulative(groups[ids[0]]);return;}
  const sel=ensureTeamSelect(groups);sel.onchange=()=>renderCumulative(groups[sel.value]);renderCumulative(groups[sel.value]);
}catch(e){console.error(e);$('#empty').hidden=false;$('#empty').textContent=e.message||String(e);}
})();
