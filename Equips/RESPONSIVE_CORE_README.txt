STATS CASTELLAR · RESPONSIVE CORE 002

ORIGEN DEL PATRÓ
----------------
Aquest core NO parteix de la pantalla Equips.
Parteix del comportament real de Capa 9.1 / Pas 1 validat a Stats Castellar Pro.2.

CANVI CLAU RESPECTE 001
-----------------------
001 intentava reproduir Pas 1 amb coordenades left/top i breakpoints nous.
002 reutilitza el principi real de Pas 1:
- pantalla vertical en flex
- capçalera en flux
- stage central de màxim 1040 px
- padding amb safe-area
- títol i contingut dins del mateix stage
- adaptació específica a mòbil vertical i mòbil horitzontal/notch
- visualViewport per detectar l'àrea visible real

Això evita que una pantalla sembli correcta al mòbil però canviï de proporció al PC.

ÚS
---
Incloure després del CSS propi:
  <link rel="stylesheet" href="shared/responsive-core.css">

Abans de </body>:
  <script src="shared/responsive-core.js"></script>
  <script>
    StatsResponsive.mount({
      root: '.screen',
      header: '.header',
      title: '.title-card',
      content: '.teams-panel, .roster-panel'
    });
  </script>

PROVA PILOT
-----------
La pantalla Equips d'aquest paquet ja utilitza el core 002.
La geometria principal queda governada pel mateix patró que Pas 1.


004: Equips finalització: header clonat de Pas 1 real; escut oficial SVG separat a header i paret central; posicionament de paret compensant background-size:cover; correcció d'edició de jugadores amb IDs robustos.

005: escut SVG de la paret/vitrina reposicionat a la zona baixa visible perquè no quedi ocult pels blocs d'Equips.

007: correcció funcional definitiva d'edició de jugadores (s'elimina modal estàtic Nora, addPlayer real, IDs normalitzats) i manté escut SVG de paret en zona visible.

007: escut de fons reposicionat al centre visual de la vitrina segons la captura de referència de l'usuari; resta sense canvis.
