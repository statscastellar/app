
(function(){
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
