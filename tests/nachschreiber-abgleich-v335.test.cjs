/* V0.33.5: all data synthetic, no actual student identities or exam marks. */
'use strict';
const assert=require('node:assert/strict');
const core=require('../schulcockpit-nachschreiber-abgleich-v335-core.js');
const makeup=require('../schulcockpit-nachschreiben-v300-core.js');
const members=[
 {id:'class-a',name:'Synthetic A'},
 {id:'class-b',name:'Synthetic B'},
 {id:'class-c',name:'Synthetic C'},
 {id:'class-d',name:'Synthetic D'},
 {id:'class-e',name:'Synthetic E',participatesV258:false}
];
const priv={
 assessmentId:'test-exam',
 roster:[{id:'exam-a',name:'Synthetic A',classStudentId:'class-a'},
  {id:'exam-b',name:'Synthetic B',classStudentId:'class-b',rowIndex:2}],
 scores:{'exam-a':{Q1:0},'exam-b':{Q1:3}},
 paperScores:{},bonusScores:{},
 pendingReasonsV335:{'class-c':'makeup','class-d':'paper_pending'}
};
let status=core.reconcile(members,priv);
assert.equal(status.enrolled,5);
assert.equal(status.active,4);
assert.equal(status.recorded,2,'zero points must count as a recorded result');
assert.equal(status.pending,2);
assert.equal(status.excluded,1,'non-participating children are not treated as missing');
assert.equal(status.makeup,1);
assert.equal(status.paper_pending,1);
assert.deepEqual(core.prepareEntries(status).map(x=>x.id),['class-c','class-d']);
assert.deepEqual(core.newOnlyLinks([
 {rowIndex:4,studentId:'exam-a'},
 {rowIndex:5,studentId:'exam-b'},
 {rowIndex:6,studentId:'exam-c'},
 {rowIndex:7,studentId:''}
],priv),{'4':'','5':'','6':'exam-c','7':''},'new Excel must skip already-scored children');
assert.equal(core.hasMarks(priv,'exam-a'),true);
const prepared=structuredClone(priv);
prepared.roster.push({id:'exam-c',name:'Synthetic C',classStudentId:'class-c',rowIndex:null});
prepared.participationV210={'exam-c':'makeup'};
status=core.reconcile(members,prepared);
assert.equal(status.makeup,1);
assert.equal(status.missing.find(x=>x.id==='class-c').linked,true);
assert.deepEqual(core.prepareEntries(status).map(x=>x.id),['class-d']);
const before=JSON.stringify(prepared.scores);
const batch={id:'batch-test',importedAt:null};
prepared.makeupBatchesV300=[batch];
const later=makeup.apply(prepared,{chosen:[{studentId:'exam-c',name:'Synthetic C',
 marks:{Q1:4},variant:'standard',replace:false,valid:1,rowIndex:8}]},batch);
assert.equal(later.scores['exam-c'].Q1,4);
assert.equal(later.scores['exam-a'].Q1,0);
assert.equal(later.scores['exam-b'].Q1,3);
assert.equal(JSON.stringify(prepared.scores),before,'import uses a copy and does not rewrite the original input');
status=core.reconcile(members,later);
assert.equal(status.recorded,3);
assert.equal(status.makeup,0,'successful import resolves previously flagged missing result automatically');
assert.equal(status.paper_pending,1);
assert.throws(()=>core.normalizeReason('absent'),/Unbekannter/);
const duplicate=structuredClone(later);
duplicate.roster.push({id:'exam-c2',name:'Synthetic C',classStudentId:'class-c'});
const mismatch=core.reconcile(members,duplicate);
assert.equal(mismatch.ambiguous,1);
assert.equal(mismatch.recorded,2,'ambiguous link must not be counted as a confirmed result');
const mismatchName=structuredClone(later);
mismatchName.roster.push({id:'exam-unlinked',name:'Someone Else'});
assert.equal(core.reconcile(members,mismatchName).unmatchedExam,1);

const leMembers=[
 {id:'regular-ready',name:'Fictional Regular Ready'},
 {id:'regular-open',name:'Fictional Regular Open'},
 {id:'le-unassigned',name:'Fictional Learning',learningSupport:true},
 {id:'le-assigned',name:'Fictional Inclusion',learningSupport:true},
 {id:'alt-assigned',name:'Fictional Alternate'},
 {id:'inactive',name:'Fictional Inactive',participatesV258:false}
];
const lePriv={roster:[
 {id:'ex-regular-ready',name:'Fictional Regular Ready',classStudentId:'regular-ready'},
 {id:'ex-regular-open',name:'Fictional Regular Open',classStudentId:'regular-open'},
 {id:'ex-le-unassigned',name:'Fictional Learning',classStudentId:'le-unassigned'},
 {id:'ex-le-assigned',name:'Fictional Inclusion',classStudentId:'le-assigned'},
 {id:'ex-alt-assigned',name:'Fictional Alternate',classStudentId:'alt-assigned'}
],scores:{'ex-regular-ready':{q:0}},examFileAssignmentsV316:{
 inclusionFile:['le-assigned'],alternativeFile:['alt-assigned']
},pendingReasonsV335:{'regular-open':'makeup'}};
const fakeFiles=[
 {fileKey:'inclusionFile',key:'file:inclusionFile',role:'inclusion',name:'Fictional inclusion'},
 {fileKey:'alternativeFile',key:'file:alternativeFile',role:'alternative',name:'Fictional makeup'}
];
const leBefore=structuredClone(lePriv);
const leRecon=core.reconcile(leMembers,lePriv);
const grouped=core.reviewGroups(leMembers,lePriv,leRecon,fakeFiles);
assert.equal(leRecon.recorded,1,'0 points is already a real result');
assert.equal(grouped.regularActive,2,'LE and alternate assignees are not regular pending');
assert.equal(grouped.regularRecorded,1);
assert.equal(grouped.pendingStandard,1);
assert.deepEqual(grouped.standardMissing.map(x=>x.id),['regular-open']);
assert.deepEqual(grouped.specialMissing.map(x=>x.id),
 ['le-unassigned','le-assigned','alt-assigned']);
assert.equal(grouped.byClassId['le-unassigned'].le,true,'LE is recognized from class roster');
assert.equal(grouped.byClassId['le-unassigned'].assigned,null,'LE is only a suggestion');
assert.equal(grouped.byClassId['le-assigned'].assigned.fileKey,'inclusionFile');
assert.equal(grouped.byClassId['alt-assigned'].assigned.role,'alternative');
assert.deepEqual(grouped.versions.map(x=>x.fileKey),['inclusionFile'],
 'only actual inclusion files appear as quick-select options');
assert.deepEqual(lePriv,leBefore,'display never writes private student data');
const ambiguousPriv={...lePriv,examFileAssignmentsV316:{
 inclusionFile:['le-assigned'],alternativeFile:['alt-assigned','le-assigned']}};
const conflict=core.reviewGroups(leMembers,ambiguousPriv,
 core.reconcile(leMembers,ambiguousPriv),fakeFiles);
assert.equal(conflict.byClassId['le-assigned'].conflictingAssignment,true,
 'a student assigned to multiple special versions must not be silently classified');

console.log('OK V0.33.5: missing roster pupils, safe unique matches, later import, zero marks and no overwrite.');
