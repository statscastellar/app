# Conservació de les proves · Stats Castellar 1.1.0

Branca `qa/proves-1.1.0`, basada exclusivament en `dc54ab9a749467b246d2f1600d32ec19c52ba200`. La referència estable anterior és `17bfe321272cd991ae69978b6718ce2fe511a991`. El canvi afegeix exclusivament `tests/` i no altera fitxers funcionals, dissenys ni configuració de desplegament.

## Execució de conservació

15 d’octubre de 2026, worktree independent. Node 24.19.0, Playwright 1.57.0 i Chromium 154.0.8037.57. Instal·lació amb `npm ci --ignore-scripts`; execució conjunta amb `npm test`.

| Bloc | Resultat |
|---|---|
| JavaScript recuperat | 39/39 fitxers correctes; inclou tactical-locks-055 |
| Complementàries | 17/18 correctes; un defecte conegut reproduït |
| Playwright funcional | 24/24 correctes en tres perfils |
| Comparacions visuals | 23/24 correctes; diferència coneguda a l’historial Android |
| Playwright total | 47/48 correctes; cap cas omès ni reintentat |
| Investigació | 9/9 comprovacions observacionals correctes |
| Aplicació original | Empremtes intactes; cap canvi respecte de la base |

El codi de sortida global és 1. La conservació no representa una declaració que tota la bateria sigui verda. Es conserven les fallades sense corregir-les, emmascarar-les, reduir assertions, ampliar toleràncies ni regenerar captures. Les captures iPhone coincideixen en aquesta execució, però la primera bateria havia detectat també variabilitat en aquest perfil.

## Defectes pendents

- El motor admet punts manuals després de finalitzar. Amb clics normals es pot tancar el resum i canviar el marcador visible; l’arxiu completat no canvia en el recorregut comprovat. Si el punt s’afegeix abans de l’arxivament, pot entrar al registre. La prova complementària continua fallant.
- El text del selector natiu de l’historial Android presenta una diferència estricta de renderització respecte de la referència inicial. La geometria i la llegibilitat són correctes; la causa exacta de la variació entre execucions continua oberta.
- Els nou botons de bloqueig dels perfils mòbils tenen textos retallats. Les referències inicials conserven aquest disseny; cap correcció s’ha aplicat.
- Safari/WebKit i dispositius físics encara no estan validats. Les 24 captures de referència requereixen revisió humana abans de servir de criteri d’integració.

## Dades i revisió

Les fixtures són artificials. Els noms heretats s’han substituït per identificadors QA. El manifest de l’aplicació usa empremtes de ruta i contingut per comprovar la integritat sense incloure noms identificatius d’importacions històriques. No s’afegeix cap partida real. Els fitxers ja existents a la base del repositori no s’han modificat ni duplicat dins de les proves.

El commit no inclou node_modules, logs, traces, ZIP, credencials ni fitxers temporals. Les captures PNG no contenen metadades personals. L’inventari amb empremtes SHA-256 consta a `FILES.json`. Els registres històrics de `records/` es distingeixen del resultat actual `conservation-results.json`.

## Publicació limitada

L’usuari ha verificat manualment: GitHub Pages desplega només `main`, carpeta arrel; no hi ha webhooks. La base no conté `.github/workflows`. No s’afegeix cap workflow ni es modifica cap configuració de desplegament. La conservació autoritzada publica només aquesta branca: sense merge, pull request ni desplegament. Qualsevol correcció necessita una autorització nova.

Per recuperar les proves a Windows, es pot descarregar el ZIP de la branca des de GitHub (`Code` → `Download ZIP`) o clonar seleccionant `qa/proves-1.1.0`. El ZIP de GitHub inclou també els fitxers originals heretats del repositori; el directori afegit per aquesta conservació és únicament `tests/`.
