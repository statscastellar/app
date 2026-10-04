
(function(){
 // Restore the complete saved step, not just the calendar's date.
 try {
  const saved=JSON.parse(localStorage.getItem('statsCastellar_c9_1_partit_demo')||'null');
  if(saved && typeof saved==='object'){
   if(typeof saved.opponent==='string')document.getElementById('opponent').value=saved.opponent;
   const wanted=String(saved.venue||'').trim().toLocaleUpperCase('ca');
   const venueButton=[...document.querySelectorAll('.venue button')].find(b=>b.textContent.trim().toLocaleUpperCase('ca')===wanted);
   if(venueButton && typeof setVenue==='function')setVenue(venueButton);
  }
 }catch(err){ /* A malformed old draft must not block a new match. */ }
 const wrap=document.createElement('div');wrap.className='c9-next-wrap';
 const err=document.createElement('div');err.id='c9-error';err.setAttribute('role','alert');
 const next=document.createElement('button');next.id='c9-next';next.type='button';next.textContent='Desa i continua ›';
 wrap.append(err,next);document.body.append(wrap);
 next.onclick=function(){
  const opponent=document.getElementById('opponent').value.trim();
  const date=document.getElementById('match-date').value;
  const venue=document.querySelector('.venue button.selected');
  if(!opponent){err.textContent='Introdueix el nom de l’equip rival.';document.getElementById('opponent').focus();return}
  if(!date||!venue){err.textContent='Selecciona la data i on es juga.';return}
  const details={schemaVersion:2,team:'Infantil Femení A',opponent,date,venue:venue.textContent.trim(),savedAt:new Date().toISOString()};
  localStorage.setItem('statsCastellar_c9_1_partit_demo',JSON.stringify(details));
  location.href='../Capa9-2/index.html';
 };
})();
