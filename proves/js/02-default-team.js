(() => {
  const KEY='statsCastellarTeamsV1';
  const infantilA={
    id:'infantil-a',
    name:'Infantil A',
    protected:true,
    players:[
      {id:'ia-3',number:'3',name:'Nora'},
      {id:'ia-4',number:'4',name:'Aran'},
      {id:'ia-6',number:'6',name:'Avril'},
      {id:'ia-7',number:'7',name:'Emma'},
      {id:'ia-8',number:'8',name:'Isona'},
      {id:'ia-10',number:'10',name:'Thais'},
      {id:'ia-11',number:'11',name:'Yveth'},
      {id:'ia-13',number:'13',name:'Maria'},
      {id:'ia-16',number:'16',name:'Ainhoa'},
      {id:'ia-18',number:'18',name:'Ària'},
      {id:'ia-28',number:'28',name:'Mariona'},
      {id:'ia-66',number:'66',name:'Núria'}
    ]
  };

  function normalizePlayer(p){
    return {
      id:String(p.id || ('p-'+String(p.number||'')+'-'+String(p.name||'').toLowerCase().replace(/\s+/g,'-'))),
      number:String(p.number ?? p.num ?? p.dorsal ?? ''),
      name:String(p.name ?? p.nom ?? '')
    };
  }

  let teams=[];
  try{
    const parsed=JSON.parse(localStorage.getItem(KEY)||'[]');
    if(Array.isArray(parsed)) teams=parsed;
  }catch(_){ teams=[]; }

  const existingIndex=teams.findIndex(t=>t && (t.id==='infantil-a' || String(t.name||'').trim().toLowerCase()==='infantil a'));

  if(existingIndex<0){
    teams.unshift(infantilA);
  }else{
    const existing=teams[existingIndex]||{};
    /* Infantil A és obligatori. Conservem possibles dades vàlides existents,
       però si la plantilla és buida/incompleta recuperem la plantilla base. */
    const existingPlayers=Array.isArray(existing.players) ? existing.players.map(normalizePlayer).filter(p=>p.name&&p.number) : [];
    teams[existingIndex]={
      ...existing,
      id:'infantil-a',
      name:'Infantil A',
      protected:true,
      players: existingPlayers.length ? existingPlayers : infantilA.players
    };
  }

  try{ localStorage.setItem(KEY,JSON.stringify(teams)); }catch(_){}
})();
