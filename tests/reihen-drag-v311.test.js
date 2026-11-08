'use strict';
const assert=require('node:assert/strict');
const C=require('../schulcockpit-reihen-drag-v311-core.js');
const original=[
 {id:'held-10',title:'Ausgeteiltes Blatt / tatsächlich gehalten',
  date:'2026-11-10',slot:2,held:true},
 {id:'afterlife',title:'Jenseitsvorstellungen',date:'2026-11-17',slot:2},
 {id:'farewell',title:'Bestattung & Erinnerung',date:'2026-11-24',slot:2},
 {id:'comfort',title:'Trost',date:'2026-12-08',slot:2},
 {id:'memory',title:'Erinnern',date:'2026-12-15',slot:2},
 {id:'ethics',title:'Sterbehilfe',date:'2027-01-12',slot:2},
 {id:'review',title:'Rückblick',date:'2027-01-19',slot:2},
 {id:'optional',title:'Nicht mehr in diesem Schuljahr',date:'',skipped:true}
];
const ids=original.map(x=>x.id);
const fixed=['held-10'];
assert.throws(()=>C.reorder(ids,'held-10','ethics',false,fixed),/gehalten/);
assert.deepEqual(C.reorder(ids,'afterlife','afterlife',false,fixed),ids);
const order=C.reorder(ids,'ethics','afterlife',false,fixed);
assert.deepEqual(order,[
 'held-10','ethics','afterlife','farewell','comfort','memory','review','optional'
]);
const p=C.calculate(original,order);
assert.equal(p.orderChanged,true);
assert.equal(p.rows[0].id,'held-10');
assert.equal(p.rows[0].date,'2026-11-10');
assert.equal(p.rows[1].id,'ethics');
assert.equal(p.rows[1].date,'2026-11-17');
assert.equal(p.rows[1].slot,2);
assert.equal(p.rows[5].id,'memory');
assert.equal(p.rows[5].date,'2027-01-12');
assert.equal(p.rows[7].date,'');
assert.equal(p.rows[7].skipped,true);
assert.equal(p.changed,5);
assert.deepEqual(original.map(x=>x.id),ids,'preview never mutates original');
assert.equal(original.find(x=>x.id==='ethics').date,'2027-01-12');
const undated=[{id:'a',date:'2026-11-10',slot:2},
 {id:'b',date:'2026-11-17',slot:2},
 {id:'c',date:'',slot:null}];
const moved=C.calculate(undated,['c','a','b']);
assert.deepEqual(moved.rows.map(x=>x.date),['2026-11-10','2026-11-17','']);
const pastUnheld=[{id:'old',date:'2026-10-21',slot:2},
 {id:'next',date:'2026-11-21',slot:2}];
assert.equal(C.calculate(pastUnheld,['next','old']).rows[0].date,'2026-10-21',
 'past but NOT held remains freely reorderable');
const withPinnedMiddle=[
 {id:'a',date:'2026-10-20',slot:2},
 {id:'h',date:'2026-11-03',slot:2,held:true},
 {id:'b',date:'2026-11-10',slot:2}
];
const cross=C.reorder(withPinnedMiddle.map(x=>x.id),'a','b',true,['h']);
assert.deepEqual(cross,['b','h','a'],'held row retains index while open rows cross it');
assert.equal(C.calculate(withPinnedMiddle,cross).rows[1].date,'2026-11-03');
assert.throws(()=>C.calculate(withPinnedMiddle,['h','a','b']),/gehalten/);
assert.throws(()=>C.calculate(original,[...ids.slice(0,6),ids[6],ids[6]]),/doppelt|verändert|ID/);
assert.throws(()=>C.calculate([
 {id:'one',date:'2026-11-10'},{id:'two',date:'2026-11-10'}
],['two','one']),/Mehrdeutige Fachtermine/);
assert.deepEqual(C.calculate([
 {id:'a',date:'2026-11-10',slot:0},
 {id:'b',date:'2026-11-10',slot:2}
],['b','a']).rows.map(x=>x.slot),[0,2]);
assert.deepEqual(C.calculate(original,ids).changes,[]);
console.log('V311 pure drag: locked held, movable past/prepared lessons, skipped rows, specific slots, date preview, no mutations OK.');
