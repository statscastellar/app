(() => {
  const screens = new Map([...document.querySelectorAll('.screen')].map(s => [s.id,s]));
  const stack = [];

  function currentId(){
    const active = document.querySelector('.screen.active');
    return active ? active.id : 'home';
  }

  function render(id, push=true){
    if(!screens.has(id)) return;
    const current = currentId();
    if(push && current !== id) stack.push(current);
    screens.forEach(s => s.classList.remove('active'));
    screens.get(id).classList.add('active');
    window.scrollTo(0,0);
  }

  window.statsNavigate=(id,push=true)=>render(id,push);

  function back(){
    let destination = 'home';
    while(stack.length){
      const candidate = stack.pop();
      if(candidate !== currentId() && screens.has(candidate)){
        destination = candidate;
        break;
      }
    }
    render(destination,false);
  }

  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if(go){ render(go.dataset.go,true); return; }
    if(e.target.closest('[data-back]')) back();
  });

  window.addEventListener('popstate', () => back());
})();
