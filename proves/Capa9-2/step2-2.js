
/* C9.2 → C9.3 bridge; keep validated selection UI unchanged. */
(function(){
const KEY='statsCastellar_c9_2_convocatoria_demo';
const next=document.getElementById('next');
next.addEventListener('click',function(){
 const raw=localStorage.getItem(KEY);if(!raw)return;
 try{const d=JSON.parse(raw);if(Array.isArray(d.called)&&d.called.length>=6){
 d.schemaVersion=2;d.savedAt=new Date().toISOString();
 d.called=d.called.map(p=>({...p,visualProfile:p.visualProfile||'pendent',ageCategory:p.ageCategory||p.team||d.team}));
 localStorage.setItem(KEY,JSON.stringify(d));
 location.href='../Capa9-3/index.html';
 }}catch(e){console.error('Convocatòria no llegible',e)}
});
})();
