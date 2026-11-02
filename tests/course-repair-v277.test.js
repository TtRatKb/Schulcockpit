// Regression tests: run with "node tests/course-repair-v277.test.js".
const assert=require('node:assert/strict');
const {prepareRepair}=require('../schulcockpit-kursreparatur-v277.js');
const seq=[{id:'q',classId:'c',title:'Reihe',plan:[{id:'u',plannedDate:'',skippedThisYearV201:true}]}];
const lessons=[{id:'l',classId:'c',date:'2026-11-04',timetableId:'t',status:'open',title:''},
 {id:'other',classId:'other',date:'2026-11-04',timetableId:'other',title:'Untouched'}];
const patch={schema:'schulcockpit.course-repair.v1',operations:[
 {kind:'unit',id:'u',unitId:'u',sequenceId:'q',classId:'c',
  expect:{plannedDate:'',skippedThisYearV201:true},
  set:{plannedDate:'2026-11-04'},unset:['skippedThisYearV201']},
 {kind:'lesson',id:'l',classId:'c',expect:{title:''},
  set:{title:'Zurückgeholte Stunde'},unset:[]}
]};
const after=prepareRepair(patch,lessons,seq);
assert.equal(after.lessons[0].title,'Zurückgeholte Stunde');
assert.equal(after.lessons[1].title,'Untouched');
assert.equal(after.sequences[0].plan[0].plannedDate,'2026-11-04');
assert.equal('skippedThisYearV201' in after.sequences[0].plan[0],false);
assert.equal(seq[0].plan[0].plannedDate,'');
assert.equal(lessons[0].title,'');
assert.throws(()=>prepareRepair(patch,after.lessons,after.sequences),/geändert/);
const unsafe=JSON.parse(JSON.stringify(patch));unsafe.operations[1].set.classId='other';
assert.throws(()=>prepareRepair(unsafe,lessons,seq),/nicht erlaubtes/);
const changedInput=JSON.parse(JSON.stringify(lessons));changedInput[0].title='User edited';
assert.throws(()=>prepareRepair(patch,changedInput,seq),/geändert/);
const colliding=JSON.parse(JSON.stringify(patch));
colliding.operations[1].set.date='2026-11-05';colliding.operations[1].expect.date='2026-11-04';
assert.throws(()=>prepareRepair(colliding,[...lessons,{id:'collision',classId:'c',date:'2026-11-05',timetableId:'t'}],seq),/denselben Fachtermin/);
console.log('course repair: guarded merge tests passed');
