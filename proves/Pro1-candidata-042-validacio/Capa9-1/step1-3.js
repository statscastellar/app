
(function(){
 const field=document.getElementById('opponent'),btn=document.getElementById('c9-hide-keyboard');
 function hide(){field.blur();document.body.classList.remove('c9-typing')}
 field.addEventListener('focus',()=>document.body.classList.add('c9-typing'));
 field.addEventListener('blur',()=>document.body.classList.remove('c9-typing'));
 field.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();hide()}});
 btn.addEventListener('click',hide);
 document.addEventListener('pointerdown',e=>{if(document.activeElement===field && e.target!==field && e.target!==btn)hide()});
})();
