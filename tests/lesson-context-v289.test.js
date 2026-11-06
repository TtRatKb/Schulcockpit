const assert=require('node:assert/strict');
const C=require('../schulcockpit-lesson-context-v289-core.js');
const date='2026-11-10';
const a={id:'exam7',classId:'rel7',date:'2026-11-13',title:'Martin Luther',type:'Klassenarbeit'};
const trip={id:'trip',start:date,end:date,impactV262:'substitution',
 attendingClassIdsV289:['rel6'],name:'Besuch des ESJ'};
const unit={classId:'rel9',sequenceId:'q',sequenceTitle:'Tod und Trauer',
 unit:{id:'u',plannedDate:date,title:'Trauer und Trost',content:'',objective:''}};
const input={calendar:[trip],assessments:[a],units:[unit],courseRanges:[]};
const t=C.classify({...input,date,classId:'rel6'});
assert.equal(t.type,'excursion');assert.match(t.title,/Besuch des ESJ/);
assert.equal(C.classify({...input,date,classId:'rel9'}).type,'substitution');
assert.match(C.classify({...input,date,classId:'rel9'}).title,/Trauer und Trost/);
assert.equal(C.classify({...input,date,classId:'rel9'}).unit.id,'u');
assert.match(C.classify({...input,date,classId:'rel11'}).title,/Sollthema aus Reihenplanung/);
assert.equal(C.classify({...input,date:'2026-11-13',classId:'rel7'}).type,'exam');
assert.match(C.classify({...input,date:'2026-11-13',classId:'rel7'}).title,/Martin Luther/);
assert.equal(C.classify({...input,date:'2026-11-17',classId:'rel9'}).type,'ordinary');
assert.equal(C.classify({...input,date:'2026-11-17',classId:'rel9'}).title,'Kein Sollthema für diesen Termin zugeordnet');
assert.equal(C.classify({...input,date:'2026-11-10',classId:'rel6',assessments:[
 {id:'emergency-exam',classId:'rel6',date,title:'Prüfung'}
]}).type,'exam','exam wins over field trip');
assert.equal(C.canReplaceTitle({title:'Thema noch festlegen'}),true);
assert.equal(C.canReplaceTitle({title:'Dividieren sichern',phasePlan:[{title:'Sicherung'}]}),false);
assert.equal(C.canReplaceTitle({title:'Vertretung · alt',v289AutoTitle:'Vertretung · alt'}),true);
assert.equal(C.included(trip,date),true);assert.equal(C.included(trip,'2026-11-11'),false);
console.log('Canonical weekly context: excursion only for traveling class; other courses substitution, fixed exams and exact lesson topic');
