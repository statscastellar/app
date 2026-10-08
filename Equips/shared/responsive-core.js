(function(global){
  function all(selector){
    if(!selector) return [];
    return Array.from(document.querySelectorAll(selector));
  }
  function mark(selector,className){
    all(selector).forEach(el=>el.classList.add(className));
  }
  function buildStage(config){
    const title = document.querySelector(config.title || '');
    const contents = all(config.content);
    if(!title || !contents.length) return null;

    let stage = title.closest('.sc-r-stage');
    if(!stage){
      stage = document.createElement('div');
      stage.className = 'sc-r-stage';
      title.parentNode.insertBefore(stage,title);
      stage.appendChild(title);
      contents.forEach(el=>stage.appendChild(el));
    }
    return stage;
  }

  const StatsResponsive = {
    mount(config={}){
      document.documentElement.classList.add('sc-responsive-ready');
      const root = document.querySelector(config.root || '.screen');
      if(root) root.classList.add('sc-r-root');
      mark(config.header,'sc-r-header');
      mark(config.title,'sc-r-title');
      mark(config.content,'sc-r-content');
      const stage = buildStage(config);

      const update=()=>{
        const vv=window.visualViewport;
        const w=vv?vv.width:window.innerWidth;
        const h=vv?vv.height:window.innerHeight;
        const doc=document.documentElement;
        doc.style.setProperty('--sc-vw',w+'px');
        doc.style.setProperty('--sc-vh',h+'px');
        doc.dataset.scOrientation=w>=h?'landscape':'portrait';
        doc.dataset.scDevice=w<601?'mobile':(w<1200?'tablet':'desktop');
      };
      update();
      window.addEventListener('resize',update,{passive:true});
      window.addEventListener('orientationchange',update,{passive:true});
      if(window.visualViewport){
        window.visualViewport.addEventListener('resize',update,{passive:true});
        window.visualViewport.addEventListener('scroll',update,{passive:true});
      }
      return {stage,refresh:update};
    }
  };
  global.StatsResponsive=StatsResponsive;
})(window);
