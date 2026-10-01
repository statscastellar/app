
const IDENTITAT_CLUB = {
 nomLinia1: 'STATS',
 nomLinia2: 'CASTELLAR',
 lema: 'Castellar és Volei',
 sublema: 'DES DE 2013',
 escut: 'assets/escut-club.png',
 fonsHoritzontal: 'assets/fons-horitzontal.png',
 fonsVertical: 'assets/fons-vertical.png',
 colorPrincipal: '#ee781c',
 colorSecundari: '#171717'
};
function aplicarIdentitatClub(){
 const c=IDENTITAT_CLUB;
 document.documentElement.style.setProperty('--fons-horitzontal', 'url("'+c.fonsHoritzontal+'")');
 document.documentElement.style.setProperty('--fons-vertical', 'url("'+c.fonsVertical+'")');
 document.documentElement.style.setProperty('--color-club-principal', c.colorPrincipal);
 document.documentElement.style.setProperty('--color-club-secundari', c.colorSecundari);
 document.getElementById('escut-club').src=c.escut;
 document.getElementById('nom-app-1').textContent=c.nomLinia1;
 document.getElementById('nom-app-2').textContent=c.nomLinia2;
 document.getElementById('lema-club').textContent=c.lema;
 document.getElementById('sublema-club').textContent=c.sublema;
}
aplicarIdentitatClub();
