'use strict';
const assert=require('node:assert/strict');
const C=require('../schulcockpit-arbeitsblatt-ist-v305-core.js');
const r=C.rows([
 {hint:'Arbeitsblätter Division',type:'print',items:[
  {materialId:'division',variantId:'a',fileName:'6 Fachbegriffe Division.pdf'},
  {materialId:'division',variantId:'b',fileName:'Halbschriftliche Division.pdf'}
 ]},
 {hint:'Schriftliche Division',type:'print',items:[
  {materialId:'written',variantId:'standard',fileName:'Schriftliche Division.pdf'}
 ]},
 {hint:'Arbeitsheft S. 23',type:'reference',items:[]},
 {hint:'PowerPoint',type:'digital',items:[]},
 {hint:'Altes PDF',type:'print',items:[],active:false}
],[
 {materialId:'division',variantId:'a',alreadyPrinted:true},
 {materialId:'division',variantId:'b',alreadyPrinted:true},
 {materialId:'written',variantId:'standard',alreadyPrinted:true}
]);
assert.equal(r.length,4);
assert(r.slice(0,3).every(x=>x.printedFromPlan),'printing is not completion');
assert.equal(C.tidy({}).status,'unknown');
assert.equal(C.tidy({}).printed,'unknown');
assert(C.equals(r[0],r[0]));
assert.equal(C.equals(r[0],r[1]),false,'two worksheet variants in one bundle remain distinct');
const prev={id:'before',classId:'math',date:'2026-11-05',slot:1,worksheetActualV305:{
 snapshot:r.map(x=>({id:x.id,materialId:x.materialId,variantId:x.variantId,
  hint:x.hint,title:x.title})),
 items:{
  [r[0].id]:{status:'complete',printed:'yes'},
  [r[1].id]:{status:'partial',printed:'yes',follow:'continue',
   note:'Aufgabe 4–6 noch offen'},
  [r[2].id]:{status:'unused',printed:'yes',follow:'stop',
   note:'Nicht ausgeteilt, kein Pflichtinhalt'},
  [r[3].id]:{status:'skipped',printed:'no'}
 }}};
const next={id:'after',classId:'math',date:'2026-11-06',slot:1};
const same={...next,id:'same',date:'2026-11-05',slot:2};
assert.equal(C.nextLesson(prev,[prev,next,same]).id,'same');
const due=C.dueItems(prev,r);
assert.equal(due.length,4);
assert.equal(due[0].shouldSuppress,true);
assert.equal(due[1].shouldRepeat,true);
assert.equal(due[1].shouldSuppress,false);
assert.equal(due[2].shouldSuppress,true);
assert.equal(due[3].shouldSuppress,true);
const brief=C.noteForPrompt(prev,r);
assert.match(brief,/6 Fachbegriffe Division.pdf.*vollständig bearbeitet.*NICHT nochmal/);
assert.match(brief,/Halbschriftliche Division.pdf.*gezielt weiterführen/);
assert.match(brief,/Schriftliche Division.pdf.*nicht mehr nötig/);
assert(!brief.includes('Schülername'));
const keep=C.noteForPrompt(prev,r,[r[0].id]);
assert(!keep.includes('6 Fachbegriffe Division.pdf'));
const grouped=C.refine({items:prev.worksheetActualV305.items},null,r);
assert.equal(grouped.items[r[0].id].follow,'stop');
assert.equal(grouped.items[r[2].id].printed,'yes');
assert.equal(prev.worksheetActualV305.items[r[0].id].follow,undefined,'do not mutate historical reflection');
assert.equal(grouped.snapshot.length,4);
console.log('Worksheet reality: 3 separately printed ABs, completed/partly/not distributed, variant safety and next-lesson notes OK.');
