const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../schulcockpit-klassenarbeit-erstellen-v269-core.js');
const a={id:'exam',classId:'religion-7',date:'2026-11-13',title:'Klassenarbeit Religion 7',scope:'Weltreligionen'};
const q={id:'q',classId:'religion-7',title:'Islam',plan:[
 {id:'u1',title:'Grundlagen',plannedDate:'2026-10-28',content:'Die fünf Säulen',objective:'benennen'},
 {id:'u2',title:'Alltag',plannedDate:'2026-11-04',content:'Religiöse Feste'},
 {id:'u3',title:'Doppelstunde davor',plannedDate:'2026-11-11',content:'Gemeinsamkeiten'},
 {id:'u4',title:'Zu spät',plannedDate:'2026-11-18',content:'Projekt'},
 {id:'u5',title:'Übersprungen',plannedDate:'2026-10-29',skippedThisYearV201:true}
]};
const lessons=[{id:'l1',classId:'religion-7',date:'2026-10-28',sequenceId:'q',title:'Grundlagen',planReference:{unitId:'u1'},heldV269:true},
{id:'l3',classId:'religion-7',date:'2026-11-11',sequenceId:'q',title:'Doppelstunde davor',planReference:{unitId:'u3'},heldV269:false}];
test('pre-exam topics distinguish held, unconfirmed past and upcoming without inventing teaching',()=>{
 const r=core.optionsForExam(a,[q],lessons,'2026-11-01');
 assert.deepEqual(r.map(x=>x.unitId),['u1','u2','u3']);
 assert.deepEqual(r.map(x=>x.stage),['held','upcoming','upcoming']);
 assert.deepEqual(r.map(x=>x.defaultChecked),[true,false,false]);
});
test('teacher may include last double lesson and prompt explicitly flags future instruction',()=>{
 const r=core.optionsForExam(a,[q],lessons,'2026-11-01');
 const prompt=core.makePrompt({exam:a,course:{name:'7a',subject:'Religion'},selected:r,
  files:[{name:'Kollegenarbeit_Islam.pdf',colleague:true}],rules:{format:'papier',duration:'45 Minuten'}});
 assert.match(prompt,/Doppelstunde davor/);
 assert.match(prompt,/NOCH NICHT GEHALTEN/);
 assert.match(prompt,/Kolleg\*innenarbeit/);
 assert.match(prompt,/Förderschullehrkraft/);
 assert.doesNotMatch(prompt,/Schülerliste|Klassenliste von/);
});
test('no selected teaching content is an explicit error',()=>{
 assert.throws(()=>core.makePrompt({exam:a,course:{name:'7a',subject:'Religion'}}),/mindestens/);
});
test('unconfirmed past is not represented as taught',()=>{
 const r=core.optionsForExam(a,[q],[], '2026-11-01');
 assert.equal(r[0].stage,'unconfirmed');
 assert.match(core.makePrompt({exam:a,course:{subject:'Religion',name:'7a'},selected:[r[0]]}),/DURCHFÜHRUNG NICHT BESTÄTIGT/);
});
