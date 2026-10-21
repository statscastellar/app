# Recuperar partit: listActive absent

La pantalla Recuperar/recover.js i el botó Recuperar d'Inici criden Pro2Storage.listActive(), però el mètode no existia ni a core/src/storage-service.js ni al bundle del navegador. La captura de l'usuari a Firefox mostra el TypeError corresponent. Es tracta d'una API absent, no d'una dada de partit que s'hagi d'esborrar.

S'afegeix listActive als dos fitxers, amb la mateixa implementació. El mètode llista els actius, crida loadActive per reutilitzar la reconciliació, migració i verificació d'integritat ja existents i retorna còpies dels registres ordenades per data. Els residus verificats de partits ja arxivats es tracten amb la lògica existent i no es mostren com a recuperables.

No es modifiquen les regles del motor, les estadístiques, el model de dades ni les proteccions d'eliminació. Les proves comproven que llistar i continuar un partit vàlid no alteren el registre original. L'eliminació només es prova amb partits sintètics i continua exigint la confirmació explícita.

Es versiona el bundle carregat per Recuperar i s'actualitza la cache del service worker per distribuir la funció nova. La prova anterior del camí de recuperació només comprovava la URL d'arribada; ara es comproven la llista real, l'obertura del partit i l'accés a TÀCTIQUES, també entrant des del menú d'Inici.

Proves unitàries afegides tant per al core com per al bundle: llista buida, lectura sense modificacions, còpia independent del registre retornat i exclusió de residus ja arxivats. Proves de navegador afegides: buit sense error; Inici → Recuperar → Continua → TÀCTIQUES amb dades intactes; cancel·lació i confirmació de l'eliminació d'un partit sintètic.

No s'ha accedit a la base de dades real del navegador de l'usuari. La correcció queda en una branca independent pendent d'autorització d'integració i publicació.

Resultats: auditoria 39/39, unitàries 70/70 i navegador 15/15 correctes. El service worker actualitzat i l'ús fora de línia també passen. git diff --check correcte. Les proves de navegador utilitzen Chromium, sense afirmar una execució nativa de Firefox.
