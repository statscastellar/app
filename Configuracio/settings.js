(async()=>{
  'use strict';
  const P=window.StatsPro2;
  const $=id=>document.getElementById(id);
  const adapter=new P.IndexedDBStorageAdapter();
  const backupService=new P.Pro2BackupService(adapter);
  const backupStatus=$('backupStatus');
  const deleteStatus=$('deleteStatus');

  function show(el,msg,error=false){
    if(!el)return;
    el.textContent=msg;
    el.hidden=false;
    el.classList.toggle('error',!!error);
  }
  function hide(el){if(el){el.hidden=true;el.classList.remove('error');}}
  function safeDate(){return new Date().toISOString().slice(0,10)}
  function downloadJson(data,name){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  $('backupExportBtn').onclick=async()=>{
    hide(backupStatus);
    try{
      const backup=await backupService.exportAll();
      downloadJson(backup,'Stats_Castellar_copia_'+safeDate()+'.json');
      show(backupStatus,'Còpia de seguretat creada correctament.');
    }catch(err){show(backupStatus,'No s’ha pogut crear la còpia: '+(err?.message||err),true)}
  };

  $('backupImportBtn').onclick=()=>$('backupImportFile').click();
  $('backupImportFile').onchange=async e=>{
    hide(backupStatus);
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    try{
      const raw=JSON.parse(await file.text());
      await backupService.verifyBackup(raw,{allowLegacy:true});
      if(!confirm('Restaurar aquesta còpia substituirà totes les dades actuals de Stats Castellar en aquest dispositiu. Continuar?'))return;
      if(!confirm('Última confirmació: vols restaurar la còpia de seguretat?'))return;
      await backupService.restoreBackup(raw,{allowLegacy:true});
      show(backupStatus,'Còpia restaurada correctament. Recarregant l’app…');
      setTimeout(()=>location.reload(),700);
    }catch(err){show(backupStatus,'No s’ha pogut restaurar la còpia: '+(err?.message||err),true)}
  };

  $('deleteAllDataBtn').onclick=async()=>{
    hide(deleteStatus);
    if(!confirm('Vols eliminar TOTES les dades locals de Stats Castellar d’aquest dispositiu?'))return;
    if(!confirm('Aquesta acció no es pot desfer. Si no tens una còpia de seguretat, les dades es perdran. Continuar?'))return;
    if(!confirm('Última confirmació: eliminar definitivament totes les dades?'))return;
    try{
      const empty={teams:[],activeMatches:[],completedMatches:[],settings:[]};
      await adapter.atomicReplaceBackup(empty);
      try{Object.keys(localStorage).filter(k=>k.startsWith('statsCastellar')||k.startsWith('stats_')).forEach(k=>localStorage.removeItem(k))}catch(_){}
      show(deleteStatus,'Totes les dades s’han eliminat. Recarregant l’app…');
      setTimeout(()=>location.reload(),700);
    }catch(err){show(deleteStatus,'No s’han pogut eliminar les dades: '+(err?.message||err),true)}
  };
})();
