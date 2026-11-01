const test=require('node:test');
const assert=require('node:assert/strict');
const {plan}=require('../schulcockpit-stundenwechsel-v272-core.js');
const slots=[
 {date:'2026-11-02',slot:2,timetableId:'mon'},
 {date:'2026-11-05',slot:3,timetableId:'thu'},
 {date:'2026-11-09',slot:2,timetableId:'mon'},
 {date:'2026-11-12',slot:3,timetableId:'thu'},
 {date:'2026-11-16',slot:2,timetableId:'mon'}
];
const old={key:'old',title:'Multiplizieren 1',date:'2026-10-05'};
const testDate='2026-11-01';
test('lost lesson from KW 41 moves to Monday and displaces two open future lessons, not exam',()=>{
 const units=[old,{key:'classwork',title:'Klassenarbeit (Soll-Eintrag)',date:'2026-11-02'},
   {key:'after',title:'Multiplizieren 2',date:'2026-11-05'}];
 const before=JSON.stringify(units);
 const result=plan({units,slots,sourceKey:'old',targetIndex:0,today:testDate});
 assert.deepEqual(result.moves.map(x=>[x.key,x.to]),[
  ['old','2026-11-02'],['classwork','2026-11-05'],['after','2026-11-09']]);
 assert.equal(JSON.stringify(units),before,'preview must be pure');
});
test('protect prepared future lesson from being overwritten',()=>{
 const units=[old,{key:'prepared',date:'2026-11-02',title:'Already prepared'}];
 assert.throws(()=>plan({units,slots,sourceKey:'old',targetIndex:0,today:testDate,
    protectedKeys:['prepared']}),/vorbereitet/);
});
test('protect a target lesson without any matching planned unit',()=>{
 assert.throws(()=>plan({units:[old],slots,sourceKey:'old',targetIndex:0,today:testDate,
    blockedSlots:[0]}),/Zielstunde/);
});
test('do not allow targeting dates in the past',()=>{
 assert.throws(()=>plan({units:[old],slots,sourceKey:'old',targetIndex:0,today:'2026-11-06'}),
 /bevorstehenden/);
});
test('when moving a later topic earlier, its former future slot ends the displacement chain',()=>{
 const u=[{key:'a',date:'2026-11-02',title:'a'},{key:'b',date:'2026-11-05',title:'b'},
    {key:'c',date:'2026-11-09',title:'c'}];
 const res=plan({units:u,slots,sourceKey:'c',targetIndex:0,today:testDate});
 assert.deepEqual(res.moves.map(x=>[x.key,x.to]),[
  ['c','2026-11-02'],['a','2026-11-05'],['b','2026-11-09']]);
});
test('move a future topic later without changing the earlier topics',()=>{
 const units=[{key:'a',date:'2026-11-02',title:'a'},
  {key:'b',date:'2026-11-05',title:'b'}, {key:'c',date:'2026-11-09',title:'c'}];
 const p=plan({units,slots,sourceKey:'a',targetIndex:2,today:testDate});
 assert.deepEqual(p.moves.map(x=>x.key),['a','c']);
 assert.deepEqual(p.moves.map(x=>x.to),['2026-11-09','2026-11-12']);
});
test('prevent silently dropping a topic if no free future slot',()=>{
 const two=slots.slice(0,2);
 assert.throws(()=>plan({units:[old,{key:'a',date:two[0].date},{key:'b',date:two[1].date}],
   slots:two,sourceKey:'old',targetIndex:0,today:testDate}),/Kein weiterer freier Fachtermin/);
});
test('multiple periods on a day can be shifted independently',()=>{
 const periods=[{date:'2026-11-02',slot:1},{date:'2026-11-02',slot:2},
 {date:'2026-11-03',slot:2}];
 const units=[old,{key:'one',date:'2026-11-02',slot:1},{key:'two',date:'2026-11-02',slot:2}];
 const p=plan({units,slots:periods,sourceKey:'old',targetIndex:1,today:testDate});
 assert.deepEqual(p.moves.map(x=>[x.key,x.toSlot]),[['old',2],['two',2]]);
});
