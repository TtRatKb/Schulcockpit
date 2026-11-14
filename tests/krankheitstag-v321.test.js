'use strict';
const assert=require('node:assert/strict'),test=require('node:test');
const C=require('../schulcockpit-krankheitstag-v321-core.js');
const date='2026-11-16';
const base={date,classes:[{id:'m',subject:'Mathe',name:'5a'},{id:'r',subject:'Religion',name:'8'}],
 timetable:[{id:'a',classId:'m',weekday:1,slot:1},{id:'b',classId:'r',weekday:1,slot:2},
 {id:'c',classId:'m',weekday:1,slot:3},{id:'d',classId:'r',weekday:1,slot:4}],
 lessons:[{id:'m1',date,classId:'m',slot:1,title:'Brüche'},
 {id:'r2',date,classId:'r',slot:2,title:'Islam',planReference:{material:'Buch S. 42 Nr. 1–4'}},
 {id:'m3',date,classId:'m',slot:3,status:'done'},
 {id:'r4',date,classId:'r',slot:4,executionV180:{type:'cancelled'}}]};
test('original lessons and excluded held/canceled states',()=>{const a=C.candidates(base);
 assert.equal(a.eligible.length,2);assert.equal(a.excluded.length,2);});
test('future timetable without a lesson stays selectable but clearly a fallback',()=>{const a=C.candidates({...base,lessons:base.lessons.filter(l=>l.id!=='r2')});
 assert(a.eligible.find(x=>x.slot===2).fallback);});
test('skip school closures and participating trips',()=>{const a=C.candidates({...base,closedClassIds:['m'],attendingClassIds:['r']});
 assert.equal(a.eligible.length,0);});
test('skip exam appointments and type classifications',()=>{const a=C.candidates({...base,assessments:[{classId:'m',date}],lessonTypes:{r2:'exam'}});
 assert.equal(a.eligible.length,0);});
test('duplicates never silently pick an original',()=>{const a=C.candidates({...base,lessons:[...base.lessons,{...base.lessons[0],id:'other'}]});
 assert(a.excluded.some(x=>/Mehrere/.test(x.reason)));});
test('invalid dates and weekends',()=>{assert(!C.valid('2026-02-31'));assert(C.candidates({...base,date:'2026-11-14'}).error);});
test('not inventing missing textbook details',()=>{const p=C.proposed({title:'Test',planReference:{material:'Buch anschauen'}},[]);
 assert.equal(p.instructions,'');assert.equal(p.materialNote,'');});
test('uses only real stated book references',()=>{const p=C.proposed({planReference:{material:'Buch S. 42 Nr. 1–4'}},[]);
 assert(p.instructions.includes('Buchaufgaben'));});
test('only available worksheets are proposed',()=>{const p=C.proposed({},[{fileKey:'a',name:'AB.pdf',available:true,fromPrint:true},
 {fileKey:'b',name:'PPP.pptx',available:true},{fileKey:'c',name:'Fehlt.pdf',available:false},
 {fileKey:'d',name:'Lösungen.pdf',available:true}]);
 assert.deepEqual(p.linkedFileKeysV319,['a']);});
test('previous user edits and file choices are preserved',()=>{const old={instructions:'Buch S. 9',linkedFileKeysV319:['f'],files:[{fileKey:'x',name:'AB.pdf'}]};
 const p=C.normalizePlan(old,C.proposed({},[]));assert.equal(p.instructions,'Buch S. 9');assert.deepEqual(p.linkedFileKeysV319,['f']);});
test('course state remains unchanged',()=>{const copy=structuredClone(base),before=JSON.stringify(copy);C.candidates(copy);
 assert.equal(JSON.stringify(copy),before);});
test('excluded group lessons',()=>{const a=C.candidates({...base,lessons:[...base.lessons,{id:'group',date,classId:'m',slot:9,kind:'group'}]});
 assert(!a.eligible.some(x=>x.slot===9));});
