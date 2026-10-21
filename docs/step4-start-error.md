# Pas 4: inici de partit sense bucle silenciós

S'ha reportat a Firefox en PC que confirmar el servei d'un partit nou retorna aparentment al Pas 4 i torna a preguntar qui serveix. No es veu cap missatge d'error. Encara no s'ha pogut confirmar el motiu concret del bloqueig al dispositiu de l'usuari, ni si hi ha un altre partit actiu.

S'ha reproduït un defecte que produeix aquest comportament: el diàleg es tancava abans de completar el desament. Si saveActive rebutjava l'operació, el missatge només s'escrivia al node done de la pantalla de fons, sense tornar a obrir el diàleg ni oferir una acció útil. La prova de fallada de desament falla abans de la correcció i passa amb ella.

La correcció manté el diàleg visible durant l'inici, mostra INICIANT… i bloqueja els clics repetits. Només es navega a Capa7 després del desament correcte. Si hi ha un error, es mostra dins el mateix diàleg, es conserva el costat seleccionat i es permet reintentar o cancel·lar. També es capturen els errors de desament de l'esborrany, que abans quedaven fora del try.

Un cas real reproduït amb dades sintètiques és ACTIVE_MATCH_EXISTS: hi ha un altre partit en curs. Es manté la protecció existent i es mostra l'enllaç Recupera el partit en curs. No es finalitza, esborra ni substitueix cap partit automàticament. La prova comprova que el registre original és idèntic abans i després del conflicte.

No s'atribueix encara a aquesta causa el cas concret de l'usuari: el nou avís permetrà obtenir el motiu exacte si persisteix. Les proves de navegador s'executen en Chromium; Firefox no està instal·lat en aquest entorn i no s'afirma que s'hagi reproduït el perfil real del PC.

Es versionen els recursos del Pas 4 i la cache v3. No es modifica el motor, les estadístiques, la tàctica ni el model de dades. La publicació de la correcció queda pendent d'autorització.

Resultats: 15/15 proves correctes en escriptori, iPhone i Android. Inclou fallada de desament simulada i reintent, conflicte real amb un altre partit actiu i preservació del registre original, confirmació de servei propi/rival, absència de duplicats i selector de tàctica. git diff --check i la comprovació sintàctica del script també passen.
