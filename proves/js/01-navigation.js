(()=>{
  const scoring=document.getElementById('scoring');
  if(!scoring)return;
  const syncScoringMode=()=>document.body.classList.toggle('scoring-live',scoring.classList.contains('active'));
  syncScoringMode();
  new MutationObserver(syncScoringMode).observe(scoring,{attributes:true,attributeFilter:['class']});
  document.addEventListener('stats-start-scoring',()=>{document.body.classList.add('scoring-live');setTimeout(syncScoringMode,0)});
})();
