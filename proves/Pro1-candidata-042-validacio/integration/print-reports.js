/* Stats Castellar Pro.1 — format d'impressió natiu, sense dependències externes.
   No calcula estadístiques: només presenta els valors lliurats pel motor. */
(function (root) {
  'use strict';
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function table(headers, rows, emptyMessage) {
    if (!rows.length) return '<p class="print-muted">' + esc(emptyMessage || 'Sense dades') + '</p>';
    return '<table><thead><tr>' + headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  }
  function section(heading, content, className) { return '<section class="print-section ' + (className || '') + '"><h2>' + esc(heading) + '</h2>' + content + '</section>'; }
  function markup(payload, mode) {
    const header = '<header class="print-head"><div class="print-brand">STATS CASTELLAR · PRO.1</div><h1>' +
      esc(mode === 'assessment' ? 'Valoració individual' : 'Estadístiques del partit') + '</h1><p>' +
      esc(payload.team) + ' — ' + esc(payload.opponent) + ' · ' + esc(payload.date) + ' · ' + esc(payload.venue) +
      '</p><p class="print-score">' + esc(payload.score) + ' · ' + esc(payload.sets) + '</p></header>';
    if (mode === 'assessment') {
      return header + '<p class="print-muted">Valoració orientativa basada en les accions registrades i el volum disponible.</p>' +
        payload.assessments.map(a => section(a.player,
          '<p>' + esc(a.context) + '</p><h3>Fortaleses</h3><ul>' + (a.strongs.length ? a.strongs.map(v => '<li>' + esc(v) + '</li>').join('') : '<li>No hi ha prou dades per destacar-ne cap.</li>') +
          '</ul><h3>Aspectes a treballar</h3><ul>' + (a.works.length ? a.works.map(v => '<li>' + esc(v) + '</li>').join('') : '<li>Sense un dèficit clar amb la mostra disponible.</li>') +
          '</ul><h3>Síntesi</h3><p>' + esc(a.summary) + '</p><p class="print-priority">' + esc(a.priority) + '</p>', 'assessment-card')).join('') +
        '<footer>Informe generat amb les dades desades del partit.</footer>';
    }
    let output = header;
    output += section('Participació per set', table(['Dorsal','Jugadora','S1','S2','S3','S4','S5','Sets jugats'], payload.participation));
    for (const group of payload.groups) {
      output += section(group.name, table(['Dorsal','Jugadora',...group.ratings.map(x => 'Valor ' + x),'Total'],group.rows));
    }
    output += section('Eficiència i impacte · Fórmula Anna',
      '<p class="print-muted">Servei, Recepció, Col·locació, Atac i Defensa; escala 0=0, 1=5, 2=8, 3=10. Bloqueig i Salvada exclosos d’aquest indicador.</p>' +
      table(['Dorsal','Jugadora','Accions','Eficiència','Impacte equip'], payload.anna));
    output += section('Rendiment per fonament',table(payload.performance.headers,payload.performance.rows));
    if (payload.substitutions.length) output += section('Canvis', '<ul>' + payload.substitutions.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>');
    output += '<footer>Informe generat amb les dades desades del partit. Les caselles buides indiquen absència de dades.</footer>';
    return output;
  }
  const css = `
    #pro1-print-root{display:none}
    @media print {
      @page{size:A4 landscape;margin:12mm}
      html,body{height:auto!important;overflow:visible!important;background:white!important}
      body > :not(#pro1-print-root){display:none!important}
      #pro1-print-root{display:block!important;position:static!important;visibility:visible!important;width:100%;height:auto!important;overflow:visible!important;color:#162337;font:10pt Arial,sans-serif;background:#fff}
      #pro1-print-root *{box-sizing:border-box;visibility:visible!important}
      #pro1-print-root .print-brand{font-size:9pt;font-weight:bold;color:#c95b19;letter-spacing:.1em}
      #pro1-print-root h1{font-size:20pt;margin:5mm 0 2mm}
      #pro1-print-root .print-score{font-weight:bold;font-size:11pt}
      #pro1-print-root .print-head{border-bottom:2px solid #17283f;margin-bottom:5mm;padding-bottom:3mm}
      #pro1-print-root .print-head p{margin:1mm 0}
      #pro1-print-root h2{font-size:12pt;background:#17283f;color:white;padding:2mm 3mm;margin:0 0 2mm}
      #pro1-print-root h3{font-size:9pt;margin:3mm 0 1mm}
      #pro1-print-root .print-section{break-inside:avoid-page;margin:0 0 5mm}
      #pro1-print-root table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.3pt}
      #pro1-print-root th,#pro1-print-root td{border:1px solid #c9d1d9;padding:1mm 1.6mm;text-align:center;word-wrap:break-word}
      #pro1-print-root td:nth-child(2),#pro1-print-root th:nth-child(2){text-align:left;width:23%}
      #pro1-print-root th{background:#e7edf4;font-weight:bold}
      #pro1-print-root tr{break-inside:avoid}
      #pro1-print-root .print-muted{font-size:8pt;color:#596777;margin:2mm 0}
      #pro1-print-root .print-priority{font-weight:bold;background:#edf1f6;padding:2mm}
      #pro1-print-root .assessment-card{break-inside:avoid-page;border:1px solid #bdc9d4;padding:3mm;margin-bottom:3mm}
      #pro1-print-root .assessment-card h2{margin:-3mm -3mm 3mm}
      #pro1-print-root .assessment-card p,#pro1-print-root .assessment-card ul{margin:2mm 0;font-size:9pt}
      #pro1-print-root footer{border-top:1px solid #cad3dc;margin-top:5mm;padding-top:2mm;color:#667085;font-size:8pt}
    }`;
  function printMatch(payload, mode) {
    if (!payload || !Array.isArray(payload.groups)) throw new Error('Falten les dades de l’informe.');
    let sheet = document.getElementById('pro1-print-root');
    if (!sheet) { sheet = document.createElement('div'); sheet.id = 'pro1-print-root'; document.body.appendChild(sheet); }
    if (!document.getElementById('pro1-print-style')) { const style = document.createElement('style'); style.id='pro1-print-style'; style.textContent = css; document.head.appendChild(style); }
    sheet.innerHTML = markup(payload, mode || 'stats');
    window.print();
    return true;
  }
  root.StatsProPrint = {printMatch, markup};
})(window);
