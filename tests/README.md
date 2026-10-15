# Stats Castellar 1.1.0 · proves conservades

Branca independent `qa/proves-1.1.0`, basada en `dc54ab9a749467b246d2f1600d32ec19c52ba200`. Conté només proves, fixtures artificials, captures de referència, configuració i documentació. Cap canvi funcional ni visual a l’aplicació.

```sh
cd tests
npm ci --ignore-scripts
npm test
```

L’executor executa els 39 fitxers recuperats, les 18 proves complementàries, els 48 casos Playwright i les 9 comprovacions d’investigació. Continua després de les fallades i escriu `reports/summary.json`. Retorna 1 quan hi ha fallades, inclosos els defectes coneguts: no s’han corregit ni silenciat.

## Entorn i aïllament

Referència: Node 24.19.0, Playwright 1.57.0, Chromium 154.0.8037.57, Debian 13. Els perfils són escriptori 1440×900, iPhone 13 390×664 i Pixel 7 412×839. L’iPhone s’emula amb Chromium; Safari/WebKit no està validat. `QA_CHROMIUM` selecciona un executable alternatiu; els píxels poden variar en altres entorns.

Cada prova disposa d’un context efímer, IndexedDB i sessionStorage independents. El servidor escolta només a 127.0.0.1:4173, rebutja escriptures i la càrrega d’importacions històriques. Es bloquegen els orígens externs i els service workers. No s’utilitza l’aplicació publicada. Els rellotges de prova són fixos; no depenen de l’hora real.

## Inventari

- `audit/`: 39 fitxers recuperats, inclòs `tactical-locks-055.test.js`.
- `unit/`: 18 casos complementaris, inclosa una regressió que falla mentre el motor admeti punts després de finalitzar.
- `e2e/`: vuit recorreguts funcionals i vuit comprovacions visuals per perfil; 24 referències PNG inicials, pendents d’aprovació humana.
- `investigation/`: tres comprovacions observacionals per perfil; que passin confirma la presència i els límits dels defectes descrits, no la seva correcció.
- `fixtures/`: dades artificials, rellotges fixos, inventari d’origen i versions de referència.
- `records/`: resultats històrics i resum de la conservació, sense traces voluminoses.

Els exemples personals heretats s’han substituït per noms QA. El manifest `fixtures/app-sha256.json` identifica els fitxers originals mitjançant SHA-256 de la ruta i de les dades: manté la comprovació d’integritat sense publicar noms de fitxers de partits. Les proves no llegeixen aquests partits com a fixtures.

## Ordres parcials

```sh
npm run test:audit
npm run test:unit
npm run test:e2e
npm run test:visual
npx playwright test -c investigation/playwright.config.cjs
```

La comparació visual habitual no actualitza les referències. Cal una revisió explícita abans de regenerar-les. No hi ha workflows de desplegament afegits. `node_modules/` i `reports/` estan exclosos de Git.

Vegeu `records/CONSERVACIO.md` per als resultats de l’execució de conservació i els defectes pendents.
