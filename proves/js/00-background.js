document.addEventListener('DOMContentLoaded',()=>{
  const home=document.getElementById('home');
  const bg=getComputedStyle(home).backgroundImage;
  document.documentElement.style.setProperty('--app-bg-image',bg);
});
