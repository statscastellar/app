
/* Informació comuna dels passos 2, 3 i 4: dades originals del Pas 1. */
(function(){
 const KEY='statsCastellar_c9_1_partit_demo';
 let match={};try{match=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){}
 const formatDate=value=>{
  const s=String(value??'').trim();
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if(m)return `${m[3]}/${m[2]}/${m[1]}`;
  m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if(m)return `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3]}`;
  return s||'—';
 };
 const target=document.querySelector('.info, .match-summary');if(!target)return;
 const team=match.team||match.equip||document.getElementById('summaryTeam')?.textContent||'Infantil Femení A';
 const rival=match.opponent||match.rival||match.rivalName||match.nomRival||'—';
 const date=formatDate(match.date||match.data||match.matchDate);
 target.replaceChildren();
 for(const [label,value] of [['EQUIP',team],['RIVAL',rival],['DATA',date]]){
  const caption=document.createElement('span');caption.className='match-info-label';caption.textContent=label;
  const content=document.createElement('strong');content.className='match-info-value';content.textContent=value;
  target.append(caption,content);
 }
})();
