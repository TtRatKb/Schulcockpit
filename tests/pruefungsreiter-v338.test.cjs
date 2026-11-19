/* V0.33.8 – synthetic file-scoped exam versions; never store real pupil data. */
'use strict';
const assert=require('node:assert/strict');
const core=require('../schulcockpit-pruefungsreiter-v338-core.js');
const a={id:'EXAM',files:[
 {fileKey:'regular-file',roleV316:'standard',name:'Reguläre Arbeit'},
 {fileKey:'special-file',roleV316:'inclusion',name:'Inklusion'},
 {fileKey:'makeup-file',roleV316:'inclusion_makeup',name:'Andere Nachschrift'},
 {fileKey:'reference',roleV316:'reference',name:'Vorlage'}]};
const versions=core.available(a);
assert.deepEqual(versions.map(f=>f.key),['file:special-file','file:makeup-file']);
assert.equal(core.allowed(a,'standard'),true);
assert.equal(core.allowed(a,'file:special-file'),true);
assert.equal(core.allowed(a,'file:regular-file'),false);
assert.equal(core.allowed(a,'file:missing'),false);
const reports=[
 {student:{id:'s1'},examFileV317:'special-file',complete:true,competencies:[{id:'X'}]},
 {student:{id:'s2'},examFileV317:'',complete:true},
 {student:{id:'s3'},examFileV317:'makeup-file',complete:false},
 {student:{id:'s4'},examVariantV300:'inclusion',complete:true}
];
assert.deepEqual(core.matchingReports(reports,'file:special-file').map(r=>r.student.id),['s1']);
assert.deepEqual(core.matchingReports(reports,'standard').map(r=>r.student.id),['s2']);
assert.deepEqual(core.matchingReports(reports,'file:makeup-file').map(r=>r.student.id),['s3']);
assert.deepEqual(core.matchingReports(reports,'file:unknown'),[]);
const priv={roster:[
 {id:'s1',name:'Test Kind A',classStudentId:'c1'},
 {id:'s2',name:'Test Kind B',classStudentId:'c2'},
 {id:'s3',name:'Test Kind C',classStudentId:'c3'}],
 examFileAssignmentsV316:{'special-file':['c1','c3'],'makeup-file':['c2']},
 examFileV317:{s1:'special-file',s3:'special-file'},
 activeVariantV300:{s1:'file:special-file',s3:'file:special-file'}};
const students=core.assignedStudents({roster:priv.roster.map(s=>({id:s.classStudentId,name:s.name}))},
 priv,'file:special-file',(doc,stu)=>({status:stu.id==='s1'?'ready':'missingRubric',
 file:{fileKey:'special-file'}}));
assert.deepEqual(students.map(s=>s.id),['s1','s3']);
assert.deepEqual(students.map(s=>s.ready),[true,false]);
assert.deepEqual(core.assignedClassIds(priv,'file:special-file'),['c1','c3']);
assert.equal(core.keyForStudent(priv,priv.roster[0]),'special-file');
const batches=[
 {id:'b1',variantV300:'standard'},
 {id:'b2',variantV300:'file:special-file'},
 {id:'b3',variantV300:'file:makeup-file'}
];
assert.deepEqual(core.batchesFor(batches,'file:special-file').map(x=>x.id),['b2']);
const missingPriv={roster:[{id:'s1',name:'Synthetic First',classStudentId:'c1'}],
 examFileAssignmentsV316:{'special-file':['c2']},scores:{s1:{Q:2}}};
const missingRoster={classId:'8-course',roster:[
 {id:'c1',name:'Synthetic First'},{id:'c2',name:'Synthetic Missing'}]};
const missingPlan=core.prepareParticipants(missingRoster,missingPriv,'file:special-file',
 (doc,id)=>!!doc.scores?.[id], '8-course');
assert.deepEqual(missingPlan.add,[{classId:'c2',name:'Synthetic Missing'}]);
assert.deepEqual(missingPlan.activate,[]);
assert.deepEqual(missingPlan.problems,[]);
assert.equal(core.prepareParticipants(missingRoster,missingPriv,'file:special-file',
 ()=>false,'other-class').problems.length,1);
const badName={...missingPriv,roster:[
 ...missingPriv.roster,{id:'unlinked',name:'Synthetic Missing'}]};
assert.equal(core.prepareParticipants(missingRoster,badName,'file:special-file',
 ()=>false,'8-course').add.length,0);
assert.equal(core.prepareParticipants(missingRoster,badName,'file:special-file',
 ()=>false,'8-course').problems.length,1);
const oldNoScores={...missingPriv,roster:[
 ...missingPriv.roster,{id:'linked',name:'Synthetic Missing',classStudentId:'c2'}]};
assert.deepEqual(core.prepareParticipants(missingRoster,oldNoScores,'file:special-file',
 ()=>false,'8-course').activate,['linked']);
assert.deepEqual(core.prepareParticipants(missingRoster,oldNoScores,'file:special-file',
 (doc,id)=>id==='linked','8-course').activate,[]);
const before=JSON.stringify([a,priv,reports,batches]);
core.matchingReports(reports,'file:special-file');
core.assignedStudents({roster:[]},priv,'file:special-file',()=>null);
assert.equal(JSON.stringify([a,priv,reports,batches]),before,'switching versions does not mutate source data');
console.log('OK V0.33.8: file-specific rubrics, roster, batches and reports without mixing marks.');
