(async()=>{'use strict';
const slots=[...document.querySelectorAll('.menu .slot')];
function toast(msg){let t=document.querySelector('.pro2-toast');if(!t){t=document.createElement('div');t.className='pro2-toast';Object.assign(t.style,{position:'fixed',left:'50%',bottom:'20px',transform:'translateX(-50%)',zIndex:99,background:'#111e',color:'#fff',padding:'10px 14px',border:'1px solid #ee781c',borderRadius:'9px'});document.body.appendChild(t);}t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2200)}
async function simulateMatch(){
  try{
    const P=StatsPro2,store=new P.Pro2Storage(new P.IndexedDBStorageAdapter());
    const cur=await store.getCurrentActive();
    if(cur){toast('Hi ha un partit en curs. Recupera’l o elimina’l abans de simular.');return;}
    if(!confirm('Crear un partit complet de simulació i generar-ne les estadístiques finals?'))return;
    toast('Generant partit de simulació…');
    await Pro2TeamStore.ready;
    const teams=Pro2TeamStore.listTeams();
    const team=teams.find(t=>(t.players||[]).filter(p=>p.active!==false).length>=6);
    if(!team)throw new Error('Cal un equip amb almenys sis jugadores actives.');
    const matchId='simulation-'+crypto.randomUUID();
    const draft=P.buildSimulationDraft(team,{matchId,opponent:'Rival de simulació'});
    const engine=P.simulateMatchFromDraft(draft,{matchId});
    const archived=await store.finalize(engine);
    location.href='Informe/index.html?id='+encodeURIComponent(archived.matchId);
  }catch(e){console.error(e);toast('No s’ha pogut simular: '+(e.message||e));}
}
slots.forEach((s,i)=>{s.style.cursor='pointer';s.tabIndex=0;s.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();s.click();}});if(i===0)s.onclick=async()=>{try{sessionStorage.removeItem('StatsCastellarPro2_ResumeMatchId_v1');Pro2DraftStore.reset();location.href='Capa9-1/index.html';}catch(e){toast(e.message||String(e));}};else if(i===1)s.onclick=async()=>{try{const store=new StatsPro2.Pro2Storage(new StatsPro2.IndexedDBStorageAdapter());const pending=await store.listActive();if(pending.length)location.href='Recuperar/index.html';else toast('No hi ha cap partit per recuperar.');}catch(e){toast(e.message)}};else if(i===2)s.onclick=()=>location.href='Historial/index.html';else if(i===3)s.onclick=()=>location.href='Equips/index.html';else if(i===4)s.onclick=()=>location.href='Configuracio/index.html';else s.onclick=simulateMatch;});
})();
