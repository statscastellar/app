'use strict';
const assert=require('assert');
const {calculateCumulative,calculateCumulativeByTeam}=require('../src/cumulative-stats');
function report(teamId,teamName,playerId,name,n){return {report:{metadata:{teamId,teamName},stats:{participation:{totalPoints:10},players:[{playerId,number:n,name,anna:{SERVEI:{counts:{0:0,1:0,2:0,3:1}},RECEPCIO:{counts:{0:0,1:0,2:0,3:0}},COLLOCACIO:{counts:{0:0,1:0,2:0,3:0}},ATAC:{counts:{0:0,1:0,2:0,3:0}},DEFENSA:{counts:{0:0,1:0,2:0,3:0}}},saves:{counts:{1:0,2:0,3:0},total:0},blocks:{counts:{0:0,1:0,2:0},total:0},participation:{points:10,totalPoints:10}}]}}};}
const rows=[report('A','Infantil A','a1','Nora',3),report('B','Aleví','b1','Laia',4)];
assert.throws(()=>calculateCumulative(rows),/més d’un equip/);
const by=calculateCumulativeByTeam(rows);assert.equal(Object.keys(by).length,2);assert.equal(by.A.matches,1);assert.equal(by.B.matches,1);assert.equal(by.A.players[0].name,'Nora');assert.equal(by.B.players[0].name,'Laia');
console.log('PASS acumulats separats per teamId; mai barregen equips');
