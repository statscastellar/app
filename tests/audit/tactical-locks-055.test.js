'use strict';
const assert=require('assert');
const T=require('../../Capa7/js/tactical-locks.js');

const court={'1':'A','2':'B','3':'C','4':'D','5':'E','6':'F'};

// múltiples candaus i cap duplicació
let r=T.setLock({},'D','2',court); assert(r.ok); let locks=r.locks;
r=T.setLock(locks,'F','4',court); assert(r.ok); locks=r.locks;
r=T.setLock(locks,'B','2',court); assert(!r.ok && r.reason==='zone-occupied');
let visual=T.deriveVisualCourt(court,locks,{});
assert.equal(visual['2'],'D'); assert.equal(visual['4'],'F');
assert.equal(new Set(Object.values(visual)).size,6);

// la rotació reglamentària no mou les jugadores fixades visualment
const rotated={'1':'B','2':'C','3':'D','4':'E','5':'F','6':'A'};
visual=T.deriveVisualCourt(rotated,locks,{});
assert.equal(visual['2'],'D'); assert.equal(visual['4'],'F');
assert.equal(T.regulatoryZoneOf(rotated,'D'),'3');
assert.equal(T.regulatoryZoneOf(rotated,'F'),'5');

// jugadora visualment davantera però reglamentàriament de darrere: no pot bloquejar
assert.equal(T.blockRegZoneForVisual(rotated,visual,'4'),null); // F és reglamentàriament zona 5
assert.equal(T.blockRegZoneForVisual(rotated,visual,'2'),'3');  // D és reglamentàriament zona 3

// servei: la servidora real va temporalment a zona 1 i després torna a la seva fixació
r=T.setLock({},'A','3',court); assert(r.ok); locks=r.locks;
const beforeServe=T.deriveVisualCourt(court,locks,{servingSide:'team',phase:'DEFENSA'});
assert.equal(beforeServe['3'],'A');
const duringServe=T.deriveVisualCourt(court,locks,{servingSide:'team',phase:'SERVEI'});
assert.equal(duringServe['1'],'A');
const afterServe=T.deriveVisualCourt(court,locks,{servingSide:'team',phase:'DEFENSA'});
assert.equal(afterServe['3'],'A');

// toggle i poda en una substitució
r=T.toggleLock({},'D','4',court); assert(r.ok && r.locks.D==='4');
r=T.toggleLock(r.locks,'D','4',court); assert(r.ok && r.unlocked && !r.locks.D);
const substituted={...court,'4':'G'};
assert.deepEqual(T.pruneInactive({D:'4',F:'6'},substituted),{F:'6'});

console.log('PASS 055 tactical locks: múltiples, rotació, servei temporal, bloqueig reglamentari i poda');
