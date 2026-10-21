# Z1 4+2 a l'aplicació oficial

Base: statscastellar/app, commit 548459f37af7c13cd51a9fc4ef0a3310e56ee785.
Origen validat al LAB: castatslab/app, PR #1 (integrada), amb confirmació manual de l'usuari.
Branca: feat/z1-4-2-official. Proposta pendent d'autorització d'integració i publicació.

## Compatibilitat i abast

L'oficial no tenia el selector de tàctica del LAB. Es porta la geometria i la selecció per partit, mantenint Habitual 3+3 com a opció predeterminada. Els partits existents sense preferència continuen en 3+3: no hi ha migració de dades ni canvis al seu registre d'accions.

S'afegeix el botó TÀCTIQUES en lloc del text informatiu del peu. No s'afegeixen columnes al peu ni es redistribueixen els altres controls. El CSS de 4+2 només afecta els elements amb la classe tactics-penetration: no s'importen els ajustos generals del peu ni de la capçalera del LAB.

Es conserva el controlador oficial i les seves proteccions de finalització, concurrència, multiset i arxiu. El camí dels bloqueigs de Habitual 3+3 continua utilitzant el codi anterior. Amb 4+2, els bloqueigs es vinculen a les davanteres reglamentàries, mai a Z1 per ser visualment a la xarxa.

No es modifiquen core/src, el bundle del motor, les fórmules estadístiques, els informes, les exportacions ni els imports històrics. Al Pas 4 es simplifica la confirmació de servei segons el canvi demanat: triar costat i confirmar una sola vegada. La preferència de tàctica s'emmagatzema en settings, clau pro2:tactics:<matchId>, separada de l'estat del partit.

## Màquina d'estats

Tal com va confirmar l'usuari abans de corregir el LAB, RECEPCIO significa servei rival ja executat; el motor no té un esdeveniment separat per a aquest servei.

- RECEPCIO i COLLOCACIO: Z1 a la xarxa.
- SERVEI, ATAC, DEFENSA i BLOQUEIG: Z1 al darrere.
- Després de cada recuperació jugable, el motor torna a COLLOCACIO i Z1 torna a penetrar.
- La col·locadora es deriva sempre de court['1']; les rotacions i substitucions canvien automàticament la seva identitat.
- Desfer conserva els checkpoints existents: la geometria es recalcula de la fase recuperada.

## Actualització de l'aplicació

Es versionen els dos scripts i el CSS i s'actualitza la versió de la cache del service worker, incloent-hi els recursos nous. No es canvia IndexedDB ni es netegen dades de partits.

## Verificació

Les ordres específiques es poden executar dins tests:

- npm run test:z1
- npm run test:z1:browser
- npm run test:z1:default
- npm run test:z1:offline (amb node server.cjs en execució dins tests)

La comparació default-regression confronta la base oficial amb la branca en 1440×900, 844×390 i 390×844: mateixa geometria dels controls, mateix estat del partit i mateixos píxels de la pista. El nou botó del peu és el canvi visual intencionat.

Les captures històriques completes de partit conserven els PNG de referència. Durant aquesta captura únicament es restitueix el text informatiu original al lloc del nou botó; abans s'asserta que el botó TÀCTIQUES existeix. Això manté estricta la comparació de tota la resta de pantalla. Els tests de Z1 comproven el botó real, l'activació, la persistència i la geometria de la tàctica.

El llançador històric tests/run-all.cjs comprova hashes d'una altra branca abans d'executar res i rebutja aquest codi modificat. No s'actualitza ni es relaxa aquest inventari: s'executen directament els quatre grups que conté (auditoria, unitàries, navegador i investigació) i es documenten els resultats.

## Resultats de la revisió

Entorn: Node 24.19.0, Playwright 1.57.0 i Chromium local. Només perfils de navegador aïllats i dades sintètiques per a les proves d'interfície. Les proves unitàries existents també llegeixen les fixtures històriques del repositori; no les modifiquen.

| Grup | Resultat |
| --- | --- |
| Auditoria original | 39/39 correctes |
| Unitàries existents | 66/66 correctes |
| Lògica Z1 4+2 | 7/7 correctes |
| Navegador Z1 4+2 | Correcte en 1440×900, 844×390 i 390×844 |
| Habitual contra base oficial | Coincidència exacta dels píxels de pista, geometria dels controls i estat del partit en les tres mides; captura estabilitzada i rellotge fix |
| Service worker i ús fora de línia | Correctes; la tàctica persisteix i la jugada funciona fora de línia |
| Investigació/finalització | 9/9 correctes en els tres dispositius |
| Captures de partit | 3/3 correctes en el recontrol amb el nou control del peu normalitzat segons s'explica més amunt |
| Integritat | git diff --check correcte; cap canvi als fitxers de core, bundle del motor, imports, informes o acumulats |

La primera passada dels 66 casos de navegador va donar 59 correctes i 7 incidències: tres captures de partit pel canvi del control del peu, tres captures d'historial i una comprovació de resultat a iPhone. Després d'adaptar exclusivament la captura del peu, les tres captures de partit passen. La comprovació de resultat a iPhone passa en la repetició. La repetició també va patir un timeout a Android amb diversos navegadors concurrents, per la qual cosa s'ha repetit aquest cas seqüencialment amb un límit de 90 segons.

Les tres captures d'historial també fallen en una còpia intacta de 548459f, en els mateixos dispositius. Les captures de partit originals passen en aquesta còpia intacta. No s'han substituït els PNG històrics ni s'ha relaxat la tolerància visual: els desajustos d'historial queden documentats com a previs i fora de l'abast de Z1.

El mateix bloqueig del llançador run-all per hashes antics també es reprodueix a la còpia intacta de l'oficial. S'han executat directament tots els grups de proves i no s'afirma que run-all sigui verd.

La comparació exacta de píxels va tenir una discrepància transitòria amb navegadors concurrents; el test ara espera dues captures consecutives idèntiques i passa en les tres mides. La condició final continua sent coincidència exacta, sense tolerància afegida.

No s'ha detectat cap regressió nova en els comportaments comprovats. Això no equival a garantir risc zero; les tres referències visuals d'historial continuen pendents de revisió com a incidència prèvia. La branca és per revisar: no s'ha integrat a main ni publicat l'oficial.

Recontrol final Android: 1/1 correcte, en 37 segons de test (40,6 segons totals). Els 42 casos funcionals de la bateria de navegador han passat entre la passada completa i els recontrols; les úniques discrepàncies visuals que continuen pendents són les tres captures d'historial, reproduïdes també a la base intacta.


## Confirmació única i selecció per color

Al Pas 4 es conserven la selecció de servei, la identificació de Z1 i la cancel·lació. Una sola pulsació de CONFIRMA inicia el partit o el nou set; s’elimina la pantalla addicional. El bloqueig de creació en curs evita dos partits per un doble clic. No es canvia el model de posicions ni el motor.

Al diàleg de tàctiques, Habitual 3+3 és l’opció inicial amb fons taronja. La classe de selecció i aria-pressed reflecteixen la preferència actual; en seleccionar Z1 4+2, aquesta passa a taronja i Habitual passa a negre. S’eliminen les marques ✓. Es conserva la preferència per partit en recarregar.

Es versionen de nou el controlador, el CSS de tàctiques i el script del Pas 4 i s’incrementa la versió de la cache. Les proves del flux antic s’actualitzen perquè confirmin una sola vegada. S’afegeixen proves dels dos serveis, cancel·lació, doble clic, colors i persistència; es revisen també la preparació completa, el multiset i la captura del Pas 4.

Validació d’aquests ajustos: 18/18 proves de navegador correctes (escriptori, iPhone i Android), incloent els dos serveis, cancel·lació, absència de duplicats amb clics repetits, preparació completa, inici del set següent, captura del Pas 4 i colors/persistència del selector. També passen les 7 proves de lògica Z1, el test real de service worker fora de línia amb cache v2 i git diff --check. No s’ha integrat ni publicat la proposta.
