# Auditoria observacional · issue #1

No modifica l'aplicació ni les referències PNG. Reutilitza les fixtures artificials i l'aïllament de `e2e/helpers.cjs` (context nou, rellotge fix, orígens externs bloquejats, service workers desactivats). No llegeix partits reals. Les observacions no es declaren correctes només perquè el runner acabi amb codi 0: cal consultar l'informe.

Des de `tests/`:

```sh
npm ci --ignore-scripts --cache /tmp/statscastellar-npm-cache
npm test
npx playwright test -c visual-audit/playwright.config.cjs
python3 visual-audit/summarize.py
```

Cal Chromium local (`QA_CHROMIUM` opcional), Node compatible amb les proves existents i Python amb Pillow per al resum. No executar simultàniament amb les altres suites: comparteixen el servidor local a 4173. No usar `--update-snapshots`.

Es mesuren els vuit escenaris per als tres perfils existents. Per cada escenari es registren overflow del document, controls fora del viewport, ancestres amb scroll horitzontal, rectangles de text, el·lipsi, superposició al punt central mitjançant hit testing, nom accessible aproximat, tabindex i el primer moviment real de focus amb Tab. Es desen tres captures en frames diferents i es comparen amb la mateixa baseline i entre elles, sense alterar toleràncies. `summarize.py` compara RGB exactes, una mètrica més estricta que el comparador Playwright (que discrimina color/antialiasing). Les dues mètriques s'han de distingir.

Límits: no substitueix axe ni lector de pantalla; els noms accessibles són una heurística DOM, no l'algorisme ARIA complet. Un control fora de l'alçada inicial però accessible amb scroll vertical no és una incidència per si sol. Els elements dins un contenidor amb scroll horitzontal s'inventarien separadament; no es penalitza el scroll intencionat de taules. El hit test central detecta candidats a superposició, no totes les interseccions possibles. Els rangs DOM no mesuren text dels controls natius select/input/textarea; la llegibilitat d'aquests controls es documenta com a limitació. No s'avalua contrast sobre imatges, totes les combinacions de dades, zoom, VoiceOver/TalkBack ni Safari/WebKit físic. Les captures originals continuen pendents d'aprovació humana.

Resultats generats (ignorats per Git): `reports/visual-audit/`, amb 72 captures recents, mesures JSON i informe Playwright; `observations.json` resumeix evidències. L'informe versionat de la passada és `records/AUDITORIA-VISUAL-1.md`.
