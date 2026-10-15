# Informe històric de la primera bateria (anterior a la conservació)

Aquest document descriu aquella execució. Vegeu `CONSERVACIO.md` per a l’estat actual de la branca.

# Stats Castellar 1.1.0 · resultats per revisar

Execució final: 15 d’octubre de 2026, 11:56–11:58, Europe/Madrid. Estat global: FALLA, amb tres incidències obertes; no s’autoritza ni es realitza cap integració.

| Bloc | Resultat final |
|---|---|
| Proves JavaScript recuperades | 39/39 fitxers correctes, inclosa tactical-locks-055 |
| Proves complementàries | 17/18 correctes; un defecte funcional reproduït |
| Playwright funcional | 24/24 correctes: 8 recorreguts × 3 perfils |
| Comparacions visuals | 22/24 correctes; diferències a l’historial iPhone i Android |
| Total Playwright | 46/48 correctes; cap prova omesa ni reintentada |
| Integritat de l’aplicació | Empremtes SHA-256 intactes abans i després; git diff i git status sense canvis |

Comanda final: `node tests/run-all.cjs`, després de `npm ci --prefix tests --ignore-scripts`. Codi de sortida 1, coherent amb les fallades detectades. S’han executat tots els blocs malgrat la regressió funcional. Cap modificació temporal del codi de l’aplicació.

## 1. Recuperació i consolidació

Les 39 proves originals s’han recuperat de l’historial local de Git, commit `35334f841c4863f482813f43b0a8d6e1d8e852e7`, anterior a l’eliminació del directori `core/tests`. L’executor antic només enumerava 38 fitxers i abandonava l’execució al primer error. El nou inventari inclou explícitament tactical-locks-055 i verifica el recompte de 39.

`fixtures/audit-manifest.json` conserva origen, commit i empremtes dels originals i de les versions adaptades; `reports/recovered-tests.patch` permet revisar els canvis. Hi ha fixtures pròpies de draft, estadístiques amb resultats coneguts i cinc documents legacy artificials. Els identificadors antics de jugadores s’han substituït per `qa_pN` i els equips de prova per `qa-team`. Les assertions estadístiques i d’integritat continuen actives.

Els rellotges són fixos: 2026-10-05 12:00 UTC per als casos recuperats de compactació temporal i 2030-01-15 12:00 UTC per a les proves noves. Les dades històriques incloses a l’aplicació no són entrada de cap prova.

## 2. Playwright

Perfils Chromium: escriptori 1440×900, iPhone 13 390×664, Pixel 7 412×839. S’han verificat preparació i inici; convocatòria, titulars i posicions; rotació, puntuació, persistència i desfer; transició al segon set passant pels passos 3 i 4; finalització i historial; edició postpartit persistent; canvi de jugadora i bloqueig tàctic persistent; acumulats; context nou sense partits previs.

Cada prova té el seu context efímer, IndexedDB i sessionStorage. El servidor de proves escolta a 127.0.0.1, rebutja escriptures i bloqueja `/imports/`. Playwright bloqueja tots els orígens externs i els service workers. No es connecta amb l’aplicació publicada ni amb les seves dades.

Limitació: el perfil iPhone és emulació Chromium amb dimensions i interacció tàctil de dispositiu. WebKit no està instal·lat i Safari/dispositius físics no s’han validat. La configuració inclou una execució opcional WebKit separada.

## 3. Defecte funcional F-01: punt manual després de finalitzar

A `core/src/match-engine.js`, `manualPoint()` admet un punt amb `lifecycle.status === 'finished'`. Reproducció mínima en memòria: crear motor de prova, executar `finishMatch()` i després `manualPoint('team')`; el marcador passa de 0 a 1 i no es produeix cap excepció.

La prova `regressió: un partit finalitzat rebutja punts manuals` falla amb `Missing expected exception`. La comprovació no està marcada com a esperada ni omesa. No s’ha modificat el motor. L’impacte confirmat és a l’API del motor; aquesta evidència no demostra una alteració dels partits ja arxivats des de la interfície.

## 4. Problemes visuals

**V-01 · Truncament dels botons de bloqueig.** Confirmat als nou botons dels perfils iPhone i Android. A l’iPhone, cada botó té aproximadament 36 px d’amplada i 32 px útils. Els textos requereixen 57,30 px (`0 · BLOQUEIG FORA`), 39,23 px (`1 · BLOQUEIG`) i 61,56 px (`2 · BLOQUEIG + PUNT`). El CSS aplica `white-space: nowrap`, `overflow: hidden` i lletra de 6 px. A Android l’espai útil és de 34 px i el problema també es reprodueix. A escriptori no es detecta aquest truncament. Evidències: `e2e/baselines/*/partit.png` i `reports/visual-measurements.json`.

**V-02 · Diferències al selector natiu de l’historial mòbil.** La comparació estricta detecta 155 píxels diferents a l’iPhone i 172 a Android, concentrats al text del selector d’equip. S’han observat variacions entre execucions; l’origen exacte resta pendent de diagnòstic. No s’han ampliat les toleràncies, emmascarat el selector ni substituït les referències per fer passar les proves. L’execució final compara totes les pantalles de manera independent. Captures actuals, esperades, diff i traces: `reports/artifacts/visual--visual-historial-*`. Una execució anterior també queda conservada a `reports/investigation`.

**V-03 · Text contextual fix al peu del partit.** Amb l’equip artificial `Equip QA`, el peu continua mostrant `INFANTIL FEMENÍ A · 2a DIV. · 2026–27`, literal del HTML. És una etiqueta que no reflecteix el partit de prova. No s’ha modificat.

Les taules de l’informe mòbil mostren inicialment només la part esquerra i requereixen desplaçament horitzontal. Les captures documenten aquesta vista inicial; no són captures de totes les columnes desplegades simultàniament.

Hi ha 24 referències inicials: passos 1–4, partit, historial, informe i acumulat en tres perfils. Conserven els dissenys actuals, inclosos els defectes coneguts, i requereixen revisió humana abans d’adoptar-les com a criteri d’integració.

## 5. Fitxers de revisió i reproducció

- `README.md`: instal·lació, execució, rellotges, perfils i limitacions.
- `package-lock.json`: versions npm bloquejades; instal·lació amb npm ci verificada.
- `run-audit.cjs`, `run-all.cjs`: execució sense abandonament al primer error i resum global.
- `audit/`: els 39 fitxers recuperats i adaptats.
- `unit/`, `fixtures/`, `e2e/`: regressions noves, dades artificials, recorreguts i captures.
- `reports/summary.json`, `audit.json`, `playwright.json`: resultats estructurats finals.
- `reports/html/index.html`: informe navegable Playwright.
- `reports/audit/`, `*.log`, `artifacts/`: logs, captures, diffs i traces.

Entorn de referència: Node 24.19.0, Playwright 1.57.0, Chromium 154.0.8037.57, Debian 13. Les versions i perfils detallats consten a `fixtures/runtime-reference.json`. Les diferències estrictes de renderització del selector continuen sent una limitació oberta de reproduïbilitat visual.

La còpia de l’aplicació es manté al commit `dc54ab9a749467b246d2f1600d32ec19c52ba200`. El paquet conté només proves, fixtures, configuració i evidències; no inclou l’aplicació ni els partits històrics. S’ha de descomprimir al costat de la còpia local `app/`.

No s’ha modificat codi funcional, disseny, dades reals ni repositori remot. No s’ha fet cap commit, branca remota ni desplegament. La ruta de lliurament `/codex/browser/projectless/.../output` no és accessible en aquesta màquina; el paquet queda a `/workspace/tests/reports/`.
