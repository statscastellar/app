# Auditoria Excel de Sant Cugat Negre i Alpicat

Font exclusiva: `Estadistiques-Castellar-infantilA(1)(1).xlsx`. L'adjunt `(1)(3)` té el mateix SHA-256: `f1151486068ae222e3c3a940783e6bd594ae0e824b614261c402337f3b716037`.

S'han llegit les set pestanyes, incloent fórmules i valors guardats. Els resums guardats a l'Excel inclouen les mitges accions: 341 per Sant Cugat i 241 per Alpicat, 582 acumulades. La reconstrucció exigida n'exclou quatre termes `0.5` i dona 340 + 240 = 580. `Dades partit Alpicat!F20 =0.5+1` conserva l'acció entera; no s'omet la cel·la. No hi ha altres fraccions independents a les taules d'accions. El resultat 1.5 d'aquesta suma no és una valoració nova.

Alpicat coincideix en totes les combinacions de jugadora, set, fonament i valoració: no es modifica el seu fitxer ni el registre existent. Sant Cugat té 210 combinacions amb discrepàncies: la font anterior inclou 357 accions (344 ANNA i 13 bloquejos), en lloc de les 340 ANNA reconstruïdes. L'eficàcia passa de 71,7732558% a 62,3823529%. L'Excel no té recompte numèric de bloquejos o salvades; no es reconstrueixen a partir de comentaris. Els 13 bloquejos de la importació anterior s'exclouen perquè no procedeixen de la font autoritzada.

Fórmules generals intactes: pesos 0, 5, 8, 10; eficàcia = punts/(accions*10); impacte = punts individuals/(accions de l'equip*10). Bloqueig i salvades fora d'aquests denominadors. Les dades no permeten reconstruir l'ordre temporal, els punts intermedis o les zones: les noves accions només afirmen jugadora, set, fonament, valoració i cel·la d'origen. Metadades, marcadors, participació i substitucions originals conservats.

## Migració

La importació inicial de l'Historial és única (`legacyBootstrap056`), i no actualitza registres existents. Les dades reals són a `StatsCastellarPro2DB/completedMatches` del navegador, sense base de dades remota. La migració s'executa en obrir Historial. Només accepta l'identificador original i l'empremta anterior `fc321190`. El document corregit té empremta `c74835fb`. Les edicions locals, fonts diferents, integritat incorrecta o identificadors duplicats impedeixen la substitució.

Una transacció IndexedDB única comprova la versió exacta del registre, crea una còpia completa a `settings/excelCorrectionBackup:excel-20261020-v1:df5606f0-8d73-4ba8-ba8f-872b8780ea72` i substitueix el registre mantenint el mateix ID. Un conflicte, còpia ja existent o error de transacció avorta la substitució. La còpia queda inclosa en les còpies globals. `StatsExcelCorrection.restoreBackup(store)` permet recuperar-la amb comprovació d'integritat i de canvis posteriors; la recuperació impedeix que la migració es reapliqui automàticament.

El botó «Exporta auditoria Excel» descarrega només els registres afectats, les comprovacions d'integritat i la còpia anterior. Cal examinar aquest fitxer del navegador habitual per confirmar la substitució real; un desplegament correcte o un navegador de proves no en són prova.

## Validació

`tests/fixtures/excel-expected.json` conté l'oracle reconstruït de l'Excel per jugadora, set, fonament i valoració, amb l'empremta de la font i les quatre exclusions.

```
cd tests
node --require ./fixtures/clock.cjs --test --test-isolation=none unit/*.test.cjs
```

La prova de migració obté el JSON anterior del commit `fb222c511705d08fdc7313ae4c1bb17a9dccdee0` amb `git show`; en un checkout superficial cal recuperar aquest commit o indicar `STATS_EXCEL_BASELINE=/ruta/al/json/original.json`.

Resultat: 63/63 proves unitàries. Oracle contrastat amb Node i el bundle del navegador executat en VM (no és una prova amb navegador real). Còpia, idempotència, restauració, conflictes, concurrència, altres partits intactes i acumulat de dos partits/580 accions comprovats. Exportacions XLSX generades pel codi de l'app i rellegides independentment: totes les accions per jugadora/set/fonament/valoració coincideixen; l'acumulat exportat conté dos partits i 580 accions.

37/39 fitxers d'auditoria anteriors passen. Les fallades de `conflict-lifecycle-029` i `conflict-audit-chain-030` es reprodueixen amb els adaptadors originals: discrepàncies entre estat resolt/arxivat i filtratge d'arxius. No es modifica codi aliè per fer-les passar. El primer intent d'execució necessitava fixtures encara no recuperades; després de recuperar-les queden només aquestes fallades anteriors.

La validació addicional de navegador s'executa a GitHub Actions amb Chromium i IndexedDB reals, sobre un origen artificial i dades aïllades. Inclou usuari existent, primera visita, edicions locals, descàrrega d'auditoria, avortament de transacció, concurrència, fallada de xarxa, conservació d'un partit actiu i renderitzat PDF/exportació XLSX des de la interfície. La primera execució de sis casos i les 63 proves unitàries ha passat a https://github.com/statscastellar/app/actions/runs/39384376579 ; el cas d'exportacions i la comprovació del partit actiu s'afegeixen a la mateixa suite abans d'integrar-la a main.

L'Historial mostra una comprovació permanent de les empremtes de les dues fonts i de la integritat dels informes. Només indica «Excel verificat» si els dos registres coincideixen amb les fonts reconstruïdes i no tenen edicions posteriors. Cada navegador/dispositiu té les seves pròpies dades: cal obrir l'Historial amb connexió per aplicar-hi la migració, sense esborrar dades del navegador ni reinstal·lar. La comprovació externa dels registres locals reals queda pendent de rebre l'exportació d'auditoria del navegador habitual.

Les referències de versions estables es conserven; aquesta correcció no altera la branca `archive/stable-1.0.15`.
