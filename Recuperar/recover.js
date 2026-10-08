(async()=>{'use strict';
const $=id=>document.getElementById(id),store=new StatsPro2.Pro2Storage(new StatsPro2.IndexedDBStorageAdapter());
const RESUME_KEY='StatsCastellarPro2_ResumeMatchId_v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function render(){
  try{
    const rows=await store.listActive();
    if(!rows.length){$('content').innerHTML='<p>No hi ha cap partit per recuperar.</p>';return;}
    $('content').innerHTML=rows.map(rec=>{
      const s=rec.session.state,m=s.metadata,g=s.game,id=rec.matchId;
      return `<article class="recover-match" data-match-id="${esc(id)}"><p><strong>${esc(m.teamName)}</strong> vs <strong>${esc(m.opponent)}</strong></p><p>Set ${Number(g.currentSet)||1} · ${Number(g.score?.team)||0}–${Number(g.score?.rival)||0}</p><p class="muted">Desat: ${new Date(rec.savedAt).toLocaleString()}</p><div class="row"><button type="button" class="btn primary" data-action="resume">Continua el partit</button><button type="button" class="btn danger" data-action="delete">Eliminar partit</button></div></article>`;
    }).join('');
    $('content').querySelectorAll('[data-action="resume"]').forEach(b=>b.onclick=()=>{
      const id=b.closest('[data-match-id]').dataset.matchId;
      sessionStorage.setItem(RESUME_KEY,id);
      location.href='../Capa7/index.html';
    });
    $('content').querySelectorAll('[data-action="delete"]').forEach(b=>b.onclick=async()=>{
      const id=b.closest('[data-match-id]').dataset.matchId;
      if(!confirm('Vols eliminar aquest partit a mitges? Aquesta acció no es pot desfer.'))return;
      try{await store.deleteActive(id);if(sessionStorage.getItem(RESUME_KEY)===id)sessionStorage.removeItem(RESUME_KEY);await render();}
      catch(e){alert('No s’ha pogut eliminar: '+String(e.message||e));}
    });
  }catch(e){$('content').textContent='No s’han pogut carregar els partits: '+e.message}
}
await render();
})();
