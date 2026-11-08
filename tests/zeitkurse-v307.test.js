'use strict';
const assert=require('node:assert/strict');
const C=require('../schulcockpit-zeitkurse-v307-core.js');
const cf=C.config({startDate:'2026-11-09',endDate:'2026-12-06',
 slots:[{weekday:1,slot:2},{weekday:4,slot:4},{weekday:1,slot:2}],
 examDate:'2026-11-26',examTitle:'Klassenarbeit · Lineare Funktionen',
 topic:'Lineare Funktionen',
 workMode:'Kurzer Einstieg, viel eigenständiges Arbeiten an den Aufgaben im Buch.',
 courseMaterials:['m:math-9','c:archive-9','m:math-9']});
assert.deepEqual(cf.slots,[{weekday:1,slot:2},{weekday:4,slot:4}]);
assert.deepEqual(cf.courseMaterials,['m:math-9','c:archive-9']);
const all=C.plannedDates(cf,'2026-11-09','2026-12-06');
assert.equal(all.length,8,'four weeks × two appointments');
assert(all.some(e=>e.date==='2026-11-26'&&e.exam));
assert(all.filter(e=>e.exam).every(e=>e.examTitle.includes('Lineare Funktionen')));
assert.deepEqual(all.slice(0,3).map(x=>x.date),['2026-11-09','2026-11-12','2026-11-16']);
assert.equal(C.weekday('2026-11-09'),1);
const afterHoliday=C.plannedDates(cf,'2026-11-09','2026-12-06',
 d=>d==='2026-11-12');assert.equal(afterHoliday.length,7);
const g={id:'quick-1',title:'Mathe 9 · Elternzeit',subject:'Mathematik',grade:'9b',
 temporaryV307:cf,sessions:[{date:'2026-11-09',topic:'Alte Notiz'}]};
const out=C.applySlots(g,{start:'2026-11-09',end:'2026-12-06'},
 d=>d==='2026-11-12',index=>['1. Block','2. Block','3. Block','4. Block','5. Block'][index]);
assert.equal(out.length,7);
assert(out.every(x=>x.record.source==='manual'&&x.record.temporaryV307===true));
assert(out.every(x=>x.record.printPlan.length===0));
assert.equal(out[0].record.period,'3. Block');
assert.equal(out[0].record.id,'temp-v307:quick-1:2026-11-09:2');
assert.equal(out.find(x=>x.spec.exam).record.quickExamV307,true);
assert.equal(C.metadata(g).id,'temporary-v307:quick-1');
assert.equal(C.currentDateSpan('2026-11-09',4).end,'2026-12-06');
const more=C.config({...cf,endDate:'2026-12-20'});
assert.equal(C.plannedDates(more,'2026-11-09','2026-12-20').length,12);
const noEnd=C.config({...cf,endDate:'',examDate:''});
assert.equal(noEnd.endDate,'');
assert.equal(C.plannedDates(noEnd,'2027-02-01','2027-02-14').length,4);
assert.throws(()=>C.config({...cf,endDate:'2026-11-08'}),/Enddatum/);
assert.throws(()=>C.config({...cf,slots:[]}),/mindestens/);
assert.throws(()=>C.config({...cf,slots:[{weekday:7,slot:2}]}),/Wochentag/);
assert.throws(()=>C.config({...cf,examDate:'2026-12-24'}),/Klausurtermin/);
const lessons=out.map(x=>x.record);
lessons[0].title='Arbeitsheft S. 34';
lessons[0].materials=['math-9'];
const materials=[{ref:'m:math-9',name:'Terme Übungsblatt.pdf',kind:'Arbeitsblatt',ready:true},
 {ref:'c:archive-9',name:'Lineare Funktionen 9.pdf',kind:'Arbeitsblatt',ready:false}];
const prompt=C.coursePrompt(g,lessons,materials,{start:'2026-11-09',end:'2026-12-06'});
assert.match(prompt,/Montag · Block 3; Donnerstag · Block 5/);
assert.match(prompt,/Klausurtermin: 2026-11-26/);
assert.match(prompt,/Lineare Funktionen/);
assert.match(prompt,/Terme Übungsblatt.pdf/);
assert.match(prompt,/vier Wochen/);
assert.match(prompt,/keine Buchseiten oder Aufgaben/);
assert.match(prompt,/überwiegend selbstständige Arbeit/);
assert.match(prompt,/keine PPT/i);
assert.match(prompt,/Arbeitsheft S. 34/);
assert(!prompt.includes('Musterlösung wurde bereits gelesen'));
assert.equal(g.sessions[0].topic,'Alte Notiz','legacy short-planning notes remain intact');
console.log('Temporary course: two weekly slots, 4 weeks, holidays, exam, course Hub files, teacher-driven extension, compact prompt and no permanent timetable changes OK.');
