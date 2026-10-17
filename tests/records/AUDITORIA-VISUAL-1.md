# Auditoria visual automàtica · Stats Castellar 1.1.0 · issue #1

Execució: 17/10/2026. Branca `qa/auditoria-visual-issue-1`, creada des de l'últim `main` consultat: `fb222c511705d08fdc7313ae4c1bb17a9dccdee0`. El commit de QA es proporciona al lliurament i al comentari preparat per a la issue. Només s'afegeixen proves observacionals i documentació; cap canvi funcional, visual, de baseline ni de dades històriques. Cap merge ni desplegament.

## Resultat

La geometria automatitzada cobreix els 24 escenaris (24/24 execucions observacionals completades; no equival a 24 dissenys aprovats). Després de descartar descendents buits/invisibles, es revalida específicament Partit als tres perfils (3/3); queden exactament 9 controls amb retall confirmat en cada mòbil i cap a desktop. La incidència prioritària és el text retallat dels nou controls de bloqueig en cadascun dels dos perfils mòbils. És un problema present també a les captures originals, no una regressió introduïda per aquest lot. No s'han aplicat correccions.

La suite original retorna **1**, amb 39/39 scripts d'auditoria, 59/59 unitàries, 36/36 recorreguts funcionals, **23/24 comparacions visuals** i 9/9 comprovacions d'investigació correctes. La fallada visual és l'historial iPhone: 155 píxels segons Playwright. No s'ha canviat `maxDiffPixels:0`, ni desactivat cap prova.

## Matriu per pantalla i perfil

«OK» significa que les comprovacions executades no detecten incidències, dins dels límits descrits més avall. «Limitació» conserva una diferència intermitent o una validació incompleta; no exigeix revisar totes les imatges.

| Pantalla | Desktop 1440×900 | iPhone Chromium 390×664 | Android Chromium 412×839 |
| --- | --- | --- | --- |
| Pas 1 | OK | OK | OK |
| Pas 2 | OK; caixa tipogràfica de fletxa explicada | OK; mateixa excepció | OK; mateixa excepció |
| Pas 3 | OK | OK | OK |
| Pas 4 | OK | OK | OK |
| Partit | OK; diferència RGB mínima | **Incidència: 9 bloqueigs retallats** | **Incidència: 9 bloqueigs retallats** |
| Historial | OK | **Limitació: selector intermitent** | **Limitació: selector intermitent** |
| Informe | OK | OK | OK |
| Acumulat | OK | OK; soroll RGB d'1 píxel | OK; soroll RGB d'1 píxel |

## Evidències i prioritats

**P2 · Llegibilitat dels bloqueigs mòbils.** En iPhone l'espai útil és de 32 px, mentre els textos mesuren aproximadament 39,23–61,56 px; el botó fa 36 px d'amplada i 17,20 px d'alçada. En Android l'espai útil és de 34 px, amb botons d'uns 38,28×23,33 px. Els nou botons de cada perfil superen l'espai útil; el CSS computat confirma retall. Les etiquetes accessibles continuen presents: això no resol la llegibilitat visual. Les mides petites també mereixen revisió tàctil humana. Cal decidir en una tasca separada com preservar el disseny validat i fer llegibles les etiquetes.

**Selector natiu · variació intermitent, no regressió estable demostrada.** La fallada original iPhone afecta únicament el rectangle `(43,211)–(107,226)`, dins del text del selector. La diferència RGB exacta és de 396 píxels; Playwright en considera 155, perquè les mètriques de comparació no són equivalents. Les tres captures observacionals posteriors d'aquest historial coincideixen exactament amb la baseline. El selector conserva el text «Equip QA», la geometria, el nom i l'operativitat; no s'ha augmentat cap tolerància. Android passa la comparació original i les captures observacionals, tot i els antecedents documentats a `records/visual-failures.json`. La repetició independent amb `--repeat-each=3` retorna 1: desktop 3/3, iPhone 2/3 i Android 0/3. Les quatre fallades continuen confinades al text del selector: iPhone al rectangle ja indicat i Android a `(43,215)–(107,230)`. Això confirma una variació entre contextos/execucions; no permet prometre estabilitat visual del control natiu. No s'ha ocultat cap resultat.

**Diferències RGB mínimes conservades.** La comparació RGB exacta inicial troba 34 píxels de diferència, amb delta màxim d'1/255, al marge superior de Partit desktop; i 1 píxel amb delta d'1/255 a Acumulat mòbil. Les comparacions originals Playwright d'aquestes pantalles passen sense canviar la configuració. No s'interpreta aquest soroll de rasterització com un canvi de disseny. Els recomptes i rectangles complets es conserven en JSON.

**Falsos positius controlats.** Al Pas 2, la caixa tipogràfica de la fletxa fa 32 px d'alçada dins d'un botó de 29 px; `overflow:visible`, absència de retall en descendents i comparació visual exacta no acrediten text retallat. S'inventaria com a candidat geomètric, sense declarar-lo incidència. Els descendents buits o invisibles tampoc es classifiquen com a text retallat.

## Geometria i accessibilitat funcional bàsica

En els 24 escenaris no es detecten overflow horitzontal del document, controls fora de l'amplada o alçada visibles, superposicions al punt central dels controls habilitats, controls sense nom segons l'heurística DOM ni controls habilitats exclosos del focus per `tabindex` negatiu. El primer Tab real arriba a un control en tots els casos. Els recorreguts funcionals originals comproven interaccions reals.

Es registren els ancestres amb scroll horitzontal i no es penalitza el desplaçament intencionat de les taules. Les comprovacions no alteren amplades, estils, dades reals ni el viewport per forçar resultats. Les captures no es revisen manualment una a una: el resum prioritza els problemes automàticament detectats.

## Reproducció i artefactes

Vegeu [instruccions de l'auditoria](../visual-audit/README.md). Entorn: Node 24.19.0, Playwright 1.57.0 i Chromium local 154.0.8037.57. La instal·lació inicial falla per la memòria cau npm inaccessible; `npm ci --ignore-scripts --cache /tmp/statscastellar-npm-cache` funciona. S'han contrastat els SHA-512 dels paquets amb el registre oficial sense desactivar verificació ni alterar el lockfile.

- `reports/original-suite/`: log, JSON Playwright i resum de la suite inicial.
- `reports/visual-audit/`: 72 captures observacionals (tres frames per escenari), mesures de controls, comparacions exactes, procedència i hashes de les 24 baselines.
- `reports/artifacts/`: expected/actual/diff i traces de la fallada original.
- `reports/visual-audit/history-repeat.json`: repeticions independents de l'historial.
- `reports/issue-1-visual-audit.zip`: paquet local de les evidències; els artefactes continuen ignorats per Git.

`reports/summary.json` hereta camps de procedència estàtics del runner antic (`sourceCommit` i `branch`); no són la identificació d'aquesta execució. La base real és el SHA indicat al principi i a `reports/visual-audit/provenance.json`. El manifest funcional existent es verifica correctament. L'aplicació i totes les baselines es comparen amb `origin/main` abans del commit de QA.

## Límits i decisions pendents

No es valida Safari/WebKit ni dispositius físics: iPhone és Chromium emulat. No és una certificació WCAG, ni una prova amb VoiceOver/TalkBack, zoom o totes les dades possibles. Els noms accessibles són una aproximació DOM; només es prova l'entrada de focus amb Tab, no tot l'ordre de tabulació. El hit testing central no detecta totes les interseccions perifèriques. Les mides reals de glifs de select/input/textarea natius no es poden establir amb rangs DOM; no es declara validació exhaustiva de la seva llegibilitat ni del contrast sobre fons fotogràfics.

Cal criteri humà per aprovar les referències inicials i decidir la correcció dels bloqueigs; no cal revisar manualment les 24 captures per entendre aquest informe. Aquest lot no corregeix ni aprova dissenys. La publicació d'un comentari a GitHub requereix accés a `api.github.com`, bloquejat inicialment pel proxy; la proposta de xarxa s'ha desat separadament, sense publicar cap versió de l'aplicació.
