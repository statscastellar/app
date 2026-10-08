(async()=>{'use strict';
const P=window.StatsPro2,$=q=>document.querySelector(q);const store=new P.Pro2Storage(new P.IndexedDBStorageAdapter());
const BUNDLED=[
 '../imports/legacy/Stats_Castellar_Partit_2026-09-13_Sant_Celoni.json',
 '../imports/legacy/Stats_Castellar_Partit_2026-09-20_Gadex.json',
 '../imports/legacy/Stats_Castellar_Partit_2026-09-20_Sant_Cugat_Vermell.json',
 '../imports/legacy/Stats_Castellar_Partit_2026-09-26_Sant_Cugat_Negre(2)(1).json',
 '../imports/legacy/Stats_Castellar_Partit_2026-10-03_Alpicat.json'
];
let selectionMode=false,rowsCache=[],selected=new Set(),activeTeamFilter=null;
const SELECTION_PREFIX='analysisSelection:';
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2400)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function reportOf(r){return P.reportFromCompletedRecord(r)}
function teamIdOf(r){return reportOf(r)?.metadata?.teamId||r.metadata?.teamId||'default'}
function score(r){const report=reportOf(r);if(report?.metadata?.legacyResult)return String(report.metadata.legacyResult).replace('-', '–');let a=0,b=0;for(const s of report?.result?.sets||[]){if(s.winner==='team')a++;else if(s.winner==='rival')b++;}return `${a}–${b}`}
function outcome(r){const report=reportOf(r);const sets=report?.result?.sets||[];const decided=sets.filter(s=>s.winner==='team'||s.winner==='rival');if(decided.length){let t=0,o=0;for(const s of decided){if(s.winner==='team')t++;else o++;}return t>o?'win':t<o?'loss':'neutral';}const raw=score(r).replace('–','-'),m=raw.match(/(\d+)\s*-\s*(\d+)/);if(!m)return 'neutral';const left=Number(m[1]),right=Number(m[2]),away=report?.metadata?.venue==='away';const team=away?right:left,opp=away?left:right;return team>opp?'win':team<opp?'loss':'neutral'}
function setText(r){const report=reportOf(r);return (report?.result?.sets||[]).map(x=>{const a=x.score?.team??x.team??x.home,b=x.score?.rival??x.rival??x.away;return a==null||b==null?`S${x.set} —`:`S${x.set} ${a}–${b}`}).join(' · ')||'Sense sets tancats'}
function dateKey(r){const rep=reportOf(r);return String(rep?.metadata?.date||r.metadata?.date||'')+'|'+String(r.matchId||'')}
function visibleRows(){return activeTeamFilter&&activeTeamFilter!=='all'?rowsCache.filter(r=>teamIdOf(r)===activeTeamFilter):rowsCache}
function currentTeamId(){const rows=visibleRows();return rows[0]?teamIdOf(rows[0]):(activeTeamFilter&&activeTeamFilter!=='all'?activeTeamFilter:'default')}
async function loadSelection(rows){if(!rows.length){selected=new Set();return;}const teamId=teamIdOf(rows[0]),key=SELECTION_PREFIX+teamId,stored=await store.adapter.get('settings',key);const ids=new Set(rows.filter(r=>teamIdOf(r)===teamId).map(r=>String(r.matchId)));const hasSaved=Array.isArray(stored?.matchIds),saved=hasSaved?stored.matchIds.map(String).filter(x=>ids.has(x)):[];selected=new Set(hasSaved?saved:[...ids]);}
async function saveSelection(){if(!rowsCache.length)return;const teamId=currentTeamId();await store.adapter.put('settings',SELECTION_PREFIX+teamId,{schemaVersion:1,teamId,matchIds:[...selected],updatedAt:new Date().toISOString()});updateSelectionStatus();}
function updateSelectionStatus(){const rows=visibleRows(),valid=new Set(rows.map(r=>String(r.matchId))),total=rows.length,n=[...selected].filter(id=>valid.has(String(id))).length;$('#selectionStatus').textContent=`${n} de ${total} partit(s) inclosos a l'anàlisi.`;$('#analyzeSelectedBtn').disabled=n<1;}
async function bootstrapBundled(){const key='legacyBootstrap056';if(await store.adapter.get('settings',key))return {imported:0,skipped:0};let imported=0,skipped=0;const importedIds=[];for(const url of BUNDLED){try{const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw new Error(String(res.status));const doc=await res.json();const out=await store.importLegacyMatch(doc);if(out.status==='imported'){imported++;importedIds.push(String(out.matchId));}else skipped++;}catch(e){console.warn('Importació antiga',url,e);}}if(importedIds.length){const selectionKey=SELECTION_PREFIX+'infantil-a',saved=await store.adapter.get('settings',selectionKey);if(Array.isArray(saved?.matchIds)){const matchIds=[...new Set([...saved.matchIds.map(String),...importedIds])];await store.adapter.put('settings',selectionKey,{...saved,matchIds,updatedAt:new Date().toISOString()});}}await store.adapter.put('settings',key,{version:1,doneAt:new Date().toISOString()});return {imported,skipped};}
async function importPortable(doc){if(!doc||doc.format!=='stats-castellar-pro2-match'||!doc.record)throw new Error('No és un fitxer de partit Pro.2 compatible.');const rec=doc.record;P.prepareVerifiedExport(rec);const existing=await store.getHistory(rec.matchId);if(existing){try{const a=P.prepareVerifiedExport(existing),b=P.prepareVerifiedExport(rec);if(a.audit.reportDigest===b.audit.reportDigest)return {status:'already-imported',matchId:rec.matchId};}catch(_){}throw new Error('Ja existeix un partit diferent amb el mateix identificador.');}await store.adapter.put('completedMatches',rec.matchId,rec);await store.getHistory(rec.matchId);return {status:'imported',matchId:rec.matchId};}
async function importOne(doc){if(doc?.format==='stats-castellar-pro2-match')return importPortable(doc);return store.importLegacyMatch(doc);}
async function importFiles(files){let ok=0,skip=0;for(const f of files){const doc=JSON.parse(await f.text());const out=await importOne(doc);out.status==='imported'?ok++:skip++;}toast(ok?`${ok} partit(s) importat(s).`:skip?'Aquests partits ja eren a l’Historial.':'No s’ha importat cap partit.');await render(true);}
function downloadJson(name,obj){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);}
async function shareMatch(r){const rec=await store.getHistory(r.matchId);P.prepareVerifiedExport(rec);const rep=reportOf(rec),safe=(rep?.metadata?.opponent||'partit').replace(/[^a-z0-9à-ÿ_-]+/gi,'_');downloadJson(`Stats_Castellar_${rep?.metadata?.date||''}_${safe}.json`,{format:'stats-castellar-pro2-match',version:1,exportedAt:new Date().toISOString(),record:rec});toast('Partit preparat per compartir.');}
function latestSelectedId(ids){const rows=rowsCache.filter(r=>ids.has(String(r.matchId))).sort((a,b)=>dateKey(a).localeCompare(dateKey(b)));return rows.at(-1)?.matchId||null;}
async function openAnalysis(ids,mode='selected'){if(!ids.size){toast('Selecciona almenys un partit.');return;}selected=new Set(ids);await saveSelection();const id=latestSelectedId(selected);if(!id){toast('No s’ha trobat cap partit seleccionat.');return;}location.href='../Informe/index.html?id='+encodeURIComponent(id)+'&analysis='+encodeURIComponent(mode)+'#advanced';}
function teamLabelFor(id,rows){
 const fromRows=rows.find(r=>teamIdOf(r)===id);const raw=reportOf(fromRows)?.metadata?.teamName||fromRows?.metadata?.teamName||'';
 if(id==='infantil-a'||id==='castellar-infantil-a')return 'Infantil A';
 return raw||id;
}
async function setupTeamFilter(rows){
 const sel=$('#teamFilter');if(!sel)return;
 const ids=[...new Set(rows.map(teamIdOf))];
 sel.innerHTML='';
 for(const id of ids){const o=document.createElement('option');o.value=id;o.textContent=teamLabelFor(id,rows);sel.appendChild(o);}
 if(ids.includes('infantil-a'))activeTeamFilter='infantil-a';
 else if(ids.includes('castellar-infantil-a'))activeTeamFilter='castellar-infantil-a';
 else activeTeamFilter=ids[0]||'all';
 if(!ids.length){const o=document.createElement('option');o.value='all';o.textContent='Tots els equips';sel.appendChild(o);activeTeamFilter='all';}
 sel.value=activeTeamFilter;
 sel.onchange=async()=>{activeTeamFilter=sel.value;await loadSelection(visibleRows());await render(true,true);};
}
async function render(preserve=false,keepEmptySelection=false){const rows=await store.listHistoryVerified();rowsCache=rows;if(!activeTeamFilter)await setupTeamFilter(rows);const shown=visibleRows();if(!preserve)await loadSelection(shown);else{const valid=new Set(shown.map(r=>String(r.matchId)));selected=new Set([...selected].filter(x=>valid.has(x)));if(!selected.size&&!keepEmptySelection)await loadSelection(shown);}$('#empty').hidden=shown.length>0;document.body.classList.toggle('selection-mode',selectionMode);const l=$('#list');l.innerHTML='';for(const r of shown){const imported=r.sourceKind==='legacy-import'||r.metadata?.sourceKind==='legacy-import',sid=String(r.matchId),checked=selected.has(sid);const c=document.createElement('article');c.className='match-card'+(checked?' selected':'');c.innerHTML=`<label class="match-select" title="Incloure a l'anàlisi"><input type="checkbox" ${checked?'checked':''} aria-label="Incloure ${esc(r.metadata?.opponent||'partit')} a l'anàlisi"></label><div><div class="opponent">${esc(r.metadata?.opponent||'Rival')} ${imported?'<span class="badge">Importat</span>':''}</div><div class="meta"><span>${esc(r.metadata?.date||'')}</span><span>${r.metadata?.venue==='home'?'Local':r.metadata?.venue==='away'?'Visitant':esc(r.metadata?.venue||'')}</span><span>${esc(r.metadata?.teamName||'')}</span></div><div class="sets">${esc(setText(r))}</div></div><div><div class="result ${outcome(r)}">${esc(score(r))}</div><div class="actions"><button class="view">Veure informe</button><button class="share">Compartir</button><button class="delete">Eliminar</button></div></div>`;const cb=c.querySelector('input[type=checkbox]');cb.onchange=async()=>{cb.checked?selected.add(sid):selected.delete(sid);c.classList.toggle('selected',cb.checked);await saveSelection();};c.querySelector('.view').onclick=()=>location.href='../Informe/index.html?id='+encodeURIComponent(r.matchId);c.querySelector('.share').onclick=()=>shareMatch(r).catch(e=>toast(e.message||String(e)));c.querySelector('.delete').onclick=async()=>{if(!confirm('Vols eliminar aquest partit de l\'Historial?'))return;await store.deleteHistory(r.matchId);selected.delete(sid);await saveSelection();toast('Partit eliminat.');render(true);};l.appendChild(c);}updateSelectionStatus();}
$('#backBtn').onclick=()=>location.href='../index.html';
$('#selectModeBtn').onclick=()=>{selectionMode=!selectionMode;document.body.classList.toggle('selection-mode',selectionMode);$('#selectModeBtn').textContent=selectionMode?'Tanca selecció':'Seleccionar partits';for(const id of ['selectAllBtn','selectNoneBtn','analyzeSelectedBtn'])$('#'+id).hidden=!selectionMode;};
$('#selectAllBtn').onclick=async()=>{selected=new Set(visibleRows().map(r=>String(r.matchId)));await saveSelection();render(true,true);};
$('#selectNoneBtn').onclick=async()=>{selected.clear();await saveSelection();render(true,true);};
$('#analyzeSelectedBtn').onclick=()=>openAnalysis(selected,'selected');
$('#cumulativeBtn').onclick=async()=>{const allIds=new Set(visibleRows().map(r=>String(r.matchId)));await openAnalysis(allIds,'all');};
const importBtn=$('#importBtn'),fileInput=$('#importFile');if(importBtn&&fileInput){importBtn.onclick=()=>fileInput.click();fileInput.onchange=async()=>{try{await importFiles([...fileInput.files]);}catch(e){console.error(e);toast(e.message||String(e));}finally{fileInput.value='';}};}
try{const b=await bootstrapBundled();await render();if(b.imported)toast(`${b.imported} partits antics incorporats a l’Historial.`);}catch(e){console.error(e);toast(e.message||String(e));await render();}
})();
