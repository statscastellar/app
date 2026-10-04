
(()=>{'use strict';
const KEY='statsCastellar_c9_2_convocatoria_demo', SIX='statsCastellar_c9_3_sis_inicial_demo', MATCH='statsCastellar_c9_1_partit_demo';
const original=[['Nora',3],['Aran',4],['Avril',6],['Emma',7],['Isona',8],['Thais',10],['Yveth',11],['Maria',13],['Ainhoa',16],['Ària',18],['Mariona',28],['Núria',66]];
const regions=[[115,145,245,425],[350,140,235,430],[598,130,237,435],[839,132,238,435],[1070,140,230,428],[1300,140,240,425],[188,410,255,420],[430,410,250,420],[680,414,250,420],[925,414,245,420],[1150,414,245,420],[1390,412,245,420]];
const $=id=>document.getElementById(id);const svg=$('photo-overlay'),grid=$('grid'),ns='http://www.w3.org/2000/svg';
let data;try{data=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){}
if(!data||!Array.isArray(data.called)||data.called.length<6){
 $('count').textContent='Falta la convocatòria';$('clear').disabled=true;
 const msg=document.createElement('div');msg.className='c9-warning';msg.textContent='Cal completar el Pas 2 abans de seleccionar el sis inicial.';
 const b=document.createElement('button');b.type='button';b.textContent='Torna a la convocatòria ›';b.onclick=()=>location.href='../Capa9-2/index.html';msg.append(b);grid.replaceWith(msg);return;
}
const players=data.called.map((p,i)=>({id:String(p.id??('num-'+p.num+'-'+i)),name:String(p.name??''),num:Number(p.num),team:String(p.team??data.team??''),visualProfile:p.visualProfile||'pendent',ageCategory:p.ageCategory||p.team||data.team}));
const chosen=new Set();const count=$('count'),go=document.createElement('button');go.id='c9-go';go.type='button';go.textContent='Col·locar a pista ›';go.disabled=true;
$('clear').after(go);
let match;try{match=JSON.parse(localStorage.getItem(MATCH)||'null')}catch(e){}
const info=document.querySelector('.info');if(info){info.replaceChildren();info.append('Equip',document.createElement('br'));const strong=document.createElement('strong');strong.textContent=data.team||match?.team||'Infantil Femení A';info.append(strong,document.createElement('br'),'Partit',document.createElement('br'));const val=document.createElement('strong');val.textContent=[match?.date||'',match?.venue||''].filter(Boolean).join(' · ')||'Dades desades al Pas 1';info.append(val)}
const normalizeName=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('ca');const calledByFigure=new Map();original.forEach(([name,num],i)=>{const p=players.find(p=>p.num===num&&normalizeName(p.name)===normalizeName(name));if(p)calledByFigure.set(i,p)});
original.forEach(([name,num],i)=>{const player=calledByFigure.get(i);if(!player)return;const [x,y,w,h]=regions[i],hit=document.createElementNS(ns,'rect');Object.entries({x,y,width:w,height:h,rx:35,class:'hit',role:'button',tabindex:'0','aria-label':'Seleccionar '+name+' dorsal '+num}).forEach(([k,v])=>hit.setAttribute(k,v));svg.append(hit);hit.addEventListener('click',()=>toggle(player.id));hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(player.id)}})});
function toggle(id){if(!players.some(p=>p.id===id))return;if(chosen.has(id))chosen.delete(id);else if(chosen.size<6)chosen.add(id);render()}
function render(){grid.replaceChildren();players.forEach(p=>{const b=document.createElement('button');b.type='button';b.className='tile'+(chosen.has(p.id)?' selected':'');b.setAttribute('aria-pressed',String(chosen.has(p.id)));const a=document.createElement('div');a.className='inline-player';const n=document.createElement('div');n.className='num';n.textContent=p.num+' - '+p.name;a.append(n);b.append(a);b.onclick=()=>toggle(p.id);grid.append(b)});count.textContent=chosen.size+' de 6 titulars';go.disabled=chosen.size!==6;go.textContent=chosen.size===6?'Col·locar a pista ›':'Selecciona 6 titulars'}
$('clear').onclick=()=>{chosen.clear();render()};go.onclick=()=>{if(chosen.size!==6)return;const startingSix=players.filter(p=>chosen.has(p.id));localStorage.setItem(SIX,JSON.stringify({schemaVersion:2,team:data.team,called:players,startingSix,savedAt:new Date().toISOString()}));location.href='../Capa9-4/index.html'};
const back=document.querySelector('.back');if(back){back.onclick=()=>location.href='../Capa9-2/index.html'}
function align(){svg.setAttribute('preserveAspectRatio',getComputedStyle(document.querySelector('.scene')).backgroundSize==='contain'?'xMidYMid meet':'xMidYMid slice')}addEventListener('resize',align);align();render();
})();
