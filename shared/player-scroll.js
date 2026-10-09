/* Stats Castellar 1.1.0
   Millora purament visual: fixa Dorsal/Jugadora quan existeixen i deixa la resta amb scroll horitzontal. */
(()=>{
  'use strict';
  const TABLE_SELECTOR='table';
  const norm=s=>String(s||'').trim().toLocaleLowerCase('ca').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const isDorsal=s=>['dorsal','#','num','numero','número'].includes(norm(s));
  const isPlayer=s=>['jugadora','jugador','player'].includes(norm(s));
  const processed=new WeakMap();
  let raf=0;

  function leafHeaders(table){
    const rows=[...(table.tHead?.rows||[])];
    if(!rows.length)return [];
    const last=rows[rows.length-1];
    // Si la darrera fila és la segona línia d'un header agrupat, les columnes identitàries
    // solen estar a la primera fila amb rowspan. Reconstruïm només l'inici útil.
    const first=rows[0];
    const firstCells=[...first.cells];
    if(firstCells.length>=2 && isDorsal(firstCells[0].textContent) && isPlayer(firstCells[1].textContent)) return firstCells;
    if(firstCells.length>=1 && isPlayer(firstCells[0].textContent)) return firstCells;
    return [...last.cells];
  }

  function frozenCount(table){
    const h=leafHeaders(table);
    if(h.length>=2 && isDorsal(h[0].textContent) && isPlayer(h[1].textContent))return 2;
    if(h.length>=1 && isPlayer(h[0].textContent))return 1;
    return 0;
  }

  function ensureWrapper(table){
    let wrap=table.parentElement;
    if(wrap && (wrap.classList.contains('table-wrap')||wrap.classList.contains('sc-player-scroll'))){
      wrap.classList.add('sc-player-scroll');
      return wrap;
    }
    wrap=document.createElement('div');
    wrap.className='sc-player-scroll sc-player-scroll-auto';
    table.parentNode.insertBefore(wrap,table);
    wrap.appendChild(table);
    return wrap;
  }

  function originalBackground(cell,row){
    const cellBg=getComputedStyle(cell).backgroundColor;
    if(cellBg && cellBg!=='rgba(0, 0, 0, 0)')return cellBg;
    const rowBg=getComputedStyle(row).backgroundColor;
    if(rowBg && rowBg!=='rgba(0, 0, 0, 0)')return rowBg;
    return '#fff';
  }

  function markCells(table,count){
    // Capturem el color abans d'afegir la classe sticky; així conservem files de valoració
    // vermell/taronja/groc/verd i els colors de capçalera originals.
    const rows=[...table.rows];
    for(const row of rows){
      for(let i=0;i<count;i++){
        const cell=row.cells[i];
        if(cell)cell.style.setProperty('--sc-sticky-bg',originalBackground(cell,row));
      }
    }
    table.classList.add('sc-player-freeze');
    table.querySelectorAll('.sc-freeze-col').forEach(c=>c.classList.remove('sc-freeze-col','sc-freeze-col-1','sc-freeze-col-2','sc-freeze-last'));
    for(const row of rows){
      for(let i=0;i<count;i++){
        const cell=row.cells[i];
        if(!cell)continue;
        cell.classList.add('sc-freeze-col',`sc-freeze-col-${i+1}`);
        if(i===count-1)cell.classList.add('sc-freeze-last');
      }
    }
  }

  function paintStickyBackgrounds(table,count){
    // Les files noves encara no marcades es processen a markCells. Aquí només mantenim
    // un fallback per a canvis de mida sense recalcular dades ni classes de l'informe.
    for(const row of table.rows){
      for(let i=0;i<count;i++){
        const cell=row.cells[i];
        if(cell && !cell.style.getPropertyValue('--sc-sticky-bg'))cell.style.setProperty('--sc-sticky-bg',originalBackground(cell,row));
      }
    }
  }

  function measure(table,wrap,count){
    if(count===2){
      const row=table.tHead?.rows?.[0]||table.rows[0];
      const first=row?.cells?.[0];
      if(first)table.style.setProperty('--sc-freeze-first-width',`${Math.ceil(first.getBoundingClientRect().width)}px`);
    }else table.style.setProperty('--sc-freeze-first-width','0px');
    paintStickyBackgrounds(table,count);
    wrap.classList.toggle('sc-has-overflow',wrap.scrollWidth>wrap.clientWidth+2);
  }

  function enhance(table){
    const count=frozenCount(table);
    if(!count)return;
    const wrap=ensureWrapper(table);
    const prev=processed.get(table);
    if(prev!==count){markCells(table,count);processed.set(table,count);}
    measure(table,wrap,count);
  }

  function scan(root=document){
    const tables=root.matches?.(TABLE_SELECTOR)?[root]:[...root.querySelectorAll?.(TABLE_SELECTOR)||[]];
    for(const table of tables)enhance(table);
  }

  function schedule(root=document){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>scan(root));
  }

  const observer=new MutationObserver(muts=>{
    // Les taules d'Informe es construeixen després de carregar dades. Observem només
    // insercions/eliminacions per no reaccionar als nostres propis canvis de classe/estil.
    if(muts.some(m=>m.type==='childList'))schedule(document);
  });

  function init(){
    scan(document);
    observer.observe(document.body,{subtree:true,childList:true});
    window.addEventListener('resize',()=>schedule(document),{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(()=>schedule(document),80),{passive:true});
    document.addEventListener('sc:tables-updated',()=>schedule(document));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
