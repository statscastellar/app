const {test}=require('node:test'),assert=require('node:assert/strict');
const O=require('../../Informe/player-order');
const {canonicalPlayerId}=require('../../core/src/anna-analytics');
const row=(id,n,eff)=>({playerId:id,number:n,name:id,total:{actions:eff==null?0:1,annaPoints:0,efficiency:eff},matches:[]});
test('PJ prioritza convocatòria, inclou convocades sense accions i no altera les fonts',()=>{
 const players=[row('a',3,.7),row('b',4,.8),row('c',6,null)],roster={snapshot:players,calledPlayerIds:['a','c','d']};roster.snapshot=[...players,row('d',7,null)];
 const pairs=[{record:{finalState:{roster}},report:{metadata:{teamId:'qa'}}},{record:{},report:{metadata:{teamId:'qa'},stats:{players:[{...players[0],annaTotal:{actions:1}},{...players[1],blocks:{total:1}},players[2]]}}}];
 const before=JSON.stringify({players,pairs});const rows=O.tablePlayers(players,pairs,canonicalPlayerId);
 assert.deepEqual(Object.fromEntries(rows.map(p=>[p.playerId,p.pj])),{a:2,b:1,c:1,d:1});assert.equal(JSON.stringify({players,pairs}),before);
});
test('ordre PJ descendent, eficiència descendent i dorsal ascendent; nul al final',()=>{
 const ps=[{...row('b',4,.8),pj:1},{...row('a',3,.8),pj:1},{...row('c',6,.1),pj:2},{...row('d',7,null),pj:1}];
 assert.deepEqual(O.sorted(ps).map(p=>p.playerId),['c','a','b','d']);
 assert.deepEqual(O.sorted(ps,p=>p.total.efficiency,1).map(p=>p.playerId),['c','a','b','d']);
 assert.deepEqual(O.sorted(ps,p=>p.total.efficiency,-1).map(p=>p.playerId),['a','b','c','d']);
});
test('sense dades ni participació compta zero; salvades i bloqueigs compten com estadístiques històriques',()=>{
 const ps=[row('a',3,null),row('b',4,null)];
 assert.deepEqual(O.tablePlayers(ps,[],canonicalPlayerId).map(p=>p.pj),[0,0]);
 const pairs=[{report:{stats:{players:[{...ps[0],saves:{total:1}},ps[1]]}}}];
 assert.deepEqual(O.tablePlayers(ps,pairs,canonicalPlayerId).map(p=>p.pj),[1,0]);
});
