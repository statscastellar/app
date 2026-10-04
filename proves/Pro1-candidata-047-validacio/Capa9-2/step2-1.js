
const roster=[['Nora',3],['Aran',4],['Avril',6],['Emma',7],['Isona',8],['Thais',10],['Yveth',11],['Maria',13],['Ainhoa',16],['Ària',18],['Mariona',28],['Núria',66]].map(([name,num])=>({id:'infA-'+num,name,num,team:'Infantil Femení A',fixed:true}));
let guests=[],selected=new Set(roster.map(p=>p.id));
const $=id=>document.getElementById(id);
function all(){return roster.concat(guests)}
function render(){
 const list=$('list');list.replaceChildren();
 all().forEach(p=>{
   const slot=document.createElement('div');slot.className='slot'+(p.fixed?'':' guest-slot');
   const b=document.createElement('button');b.type='button';b.className='player'+(selected.has(p.id)?' selected':'')+(!p.fixed?' guest':'');
   b.textContent=p.num+' - '+p.name;b.title=p.num+' - '+p.name+' · '+p.team;b.setAttribute('aria-pressed',String(selected.has(p.id)));
   b.onclick=()=>{selected.has(p.id)?selected.delete(p.id):selected.add(p.id);render()};
   slot.append(b);
   if(!p.fixed){const remove=document.createElement('button');remove.type='button';remove.className='remove-guest';remove.textContent='×';remove.title='Elimina '+p.name+' de la convocatòria';remove.setAttribute('aria-label',remove.title);remove.onclick=()=>{guests=guests.filter(g=>g.id!==p.id);selected.delete(p.id);render()};slot.append(remove)}
   list.append(slot);
 });
 /* Empty additional-player slots are intentionally not rendered. */
 $('counter').textContent=selected.size+' de '+all().length+' convocades';
 $('all').textContent=selected.size===all().length?'Desmarca totes':'Marca totes';
 $('add').disabled=guests.length>=6;$('add').title=guests.length>=6?'Les sis places addicionals estan ocupades':'Afegeix jugadora';
}
$('all').onclick=()=>{if(selected.size===all().length)selected.clear();else all().forEach(p=>selected.add(p.id));render()};
$('add').onclick=()=>{$('error').textContent='';$('dialog').classList.add('open');$('team').focus()};
$('cancel').onclick=()=>{$('dialog').classList.remove('open')};
$('dialog').onclick=e=>{if(e.target===$('dialog'))$('cancel').click()};
$('guestform').onsubmit=e=>{
 e.preventDefault();const team=$('team').value,name=$('guestname').value.trim(),num=Number($('guestnum').value);
 if(guests.length>=6){$('error').textContent='Les sis places addicionals estan ocupades.';return}
 if(!team||!name||!Number.isInteger(num)||num<0||num>99){$('error').textContent='Introdueix equip, nom i dorsal vàlid (0–99).';return}
 if(all().some(p=>p.num===num)){$('error').textContent='Aquest dorsal ja figura a la convocatòria.';return}
 const p={id:'guest-'+Date.now()+'-'+num,team,name,num,fixed:false};guests.push(p);selected.add(p.id);
 $('dialog').classList.remove('open');$('guestform').reset();render();
};
$('next').onclick=()=>{
 if(selected.size<6){$('toast').textContent='Cal convocar almenys 6 jugadores per continuar.';$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',2600);return}
 const payload={team:'Infantil Femení A',roster:all(),called:all().filter(p=>selected.has(p.id))};
 localStorage.setItem('statsCastellar_c9_2_convocatoria_demo',JSON.stringify(payload));
 $('toast').textContent='Convocatòria desada en aquest navegador (prototip).';$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',2800)
};
$('back').onclick=()=>{if(history.length>1)history.back();else location.href='../capa9-1/index.html'};
render();
