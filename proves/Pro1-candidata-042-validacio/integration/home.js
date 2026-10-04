/* Navegació única de Pro.1: l'entrada pública antiga queda intacta. */
(()=>{'use strict';
const slots=[...document.querySelectorAll('.menu .slot')];
const paths=[
 '../Capa9-1/index.html',
 '../PontPartit/motor-prova.html?screen=recover',
 '../PontPartit/motor-prova.html?screen=history',
 '../PontPartit/motor-prova.html?screen=teams',
 '../PontPartit/motor-prova.html?screen=settings',
 '../PontPartit/motor-prova.html?screen=simulation'
];
const developmentMode=new URLSearchParams(location.search).get('dev')==='1';
slots.forEach((el,i)=>{if(i===5&&!developmentMode){el.hidden=true;el.style.display='none';el.setAttribute('aria-hidden','true');return;}
 el.setAttribute('role','button');el.tabIndex=0;
 const act=()=>{if(i===5){alert('La simulació automàtica és una eina de desenvolupament. Utilitza Nou partit per provar el recorregut complet.');return;}
 if(paths[i])location.href=new URL(paths[i],document.baseURI).href;};
 el.addEventListener('click',act);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act();}});
});
})();
