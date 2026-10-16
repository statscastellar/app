# Correcció local de finalització i resultat definitiu

Base funcional: 1.1.0 `dc54ab9a749467b246d2f1600d32ec19c52ba200`. Proves heretades: `634f3fd551e472e3cd86be99b7f50db125534c45`. Branca independent: `fix/finalitzacio-partit`. Pendent de validació manual i integració; no desplegada.

## Comportament

El motor i els controls de joc impedeixen modificar un partit finalitzat. L’arxivament es pot reintentar si falla; es rebutgen escriptures de còpies desfasades. A Informe → Editar estadístiques → Editar resultat es poden substituir els punts dels sets existents, sempre amb confirmació. Cancel·lar no desa.

El resultat nou substitueix el definitiu, recalcula guanyadors i es reflecteix a historial, informes i exportacions. No s’afegeixen registres, dates ni indicadors específics de correcció del marcador. Les accions tècniques originals i les estadístiques individuals i col·lectives es mantenen. L’edició estadística preexistent continua disponible i conserva el seu mecanisme propi.

## Verificació conservada

Execució completa del 15 d’octubre de 2026: 39/39 scripts recuperats (inclòs tactical-locks-055), 59/59 proves unitàries, 60/60 Playwright, 9/9 investigació. Escriptori, iPhone i Android emulats amb Chromium. Els fitxers funcionals coincideixen amb fixtures/fix-app-sha256.json. No s’han regenerat les captures de referència. El selector mòbil ha tingut diferències visuals intermitents en execucions anteriors; l’última passada és correcta. Safari real i validació manual pendents. La impressió s’ha verificat mitjançant el controlador, no mitjançant un PDF final renderitzat.

## Provar a Windows després de descarregar el ZIP

1. Extreu completament el ZIP de la branca. No executis ordres dins del ZIP.
2. Cal tenir Node.js instal·lat. Si no el tens, consulta abans de continuar.
3. Obre la carpeta extreta que conté index.html i tests. A la barra d’adreces de l’Explorador escriu cmd i prem Retorn.
4. Executa només: node tests/server.cjs
5. Mantén la terminal oberta i visita http://127.0.0.1:4173/ en una finestra privada, amb dades fictícies. El servidor usa només la còpia extreta i bloqueja /imports/.
6. Crea un partit fictici, registra accions, anota estadístiques i finalitza. Els controls de joc han de quedar bloquejats.
7. A l’informe prova cancel·lar l’edició, rebutjar la confirmació i després confirmar un marcador que canviï el guanyador. Recarrega i comprova persistència, historial, estadístiques intactes i absència de marques de correcció.
8. Revisa ODS, XLSX i impressió, i comprova que una edició estadística explícita continua funcionant sense canviar el marcador.
9. Per aturar el servidor, prem Ctrl+C a la terminal.

No obris index.html directament ni utilitzis la web publicada per validar aquesta branca. Descarregar el ZIP no modifica main ni desplega res. La branca hereta els fitxers originals del repositori; els partits històrics no són fixtures i no s’han afegit ni modificat en aquesta correcció.
