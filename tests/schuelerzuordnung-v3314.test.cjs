/* V0.33.14: entirely fictional pupils, shared first name with distinct last names. */
'use strict';
const assert=require('node:assert/strict');
const core=require('../schulcockpit-schuelerzuordnung-v3314-core.js');
const cls={classId:'fictional-c8',roster:[
 {id:'class-alpha',name:'Leon Albrecht',learningSupport:true},
 {id:'class-beta',name:'Leon Bergmann'},
 {id:'class-mira',name:'Mira Fischer'}]};
const base={assessmentId:'fictional-exam',roster:[
 {id:'exam-alpha',name:'Leon Albrecht',classStudentId:'class-alpha',rowIndex:4},
 {id:'exam-beta',name:'Leon Bergmann',classStudentId:'class-beta',rowIndex:5},
 {id:'exam-extra',name:'Mira Fischer',classStudentId:'class-mira',rowIndex:null}],
 scores:{'exam-alpha':{Q1:1},'exam-beta':{Q1:6}},
 bonusScores:{'exam-alpha':{QBonus:2}},
 examFileV317:{'exam-alpha':'inclusion-file'},
 examFileAssignmentsV316:{'inclusion-file':['class-alpha']},
 activeVariantV300:{'exam-alpha':'file:inclusion-file'},
 participationV210:{'exam-alpha':'variant','exam-beta':'present'},
 examAttemptsV300:{'exam-alpha':[{data:{scores:{Q1:0}},fromVariant:'standard'}]}};
const before=structuredClone(base);
const detection={studentRows:[
 {rowIndex:8,name:'Leon Bergmann'},
 {rowIndex:9,name:'Leon Albrecht'}]};
const merged=core.mergeRoster(base,detection);
assert.deepEqual(merged.map(s=>s.id),['exam-beta','exam-alpha','exam-extra']);
assert.deepEqual(merged.map(s=>s.classStudentId),['class-beta','class-alpha','class-mira']);
assert.deepEqual(merged.map(s=>s.rowIndex),[8,9,null]);
assert.deepEqual(base,before,'preview must never alter existing private data');
assert.deepEqual(core.audit(cls,{...base,roster:merged}),[]);
assert.equal(core.reportAt([{student:{id:'exam-beta'}}],0).student.id,'exam-beta');
assert.equal(core.reportAt([{student:{id:'exam-beta'}}],99).student.id,'exam-beta');
assert.equal(core.reportAt([],0),null);
assert.throws(()=>core.mergeRoster(base,{studentRows:[
 {rowIndex:4,name:'Leon Albrecht'},{rowIndex:5,name:'Leon Albrecht'}
]}),/gleiche oder leere vollständige Namen/,'never conflate identical Excel names');
const extended=core.mergeRoster(base,{studentRows:[
 {rowIndex:10,name:'Leon Bergmann'},{rowIndex:11,name:'Leonie Brandt'}]});
assert.equal(extended[0].id,'exam-beta');
assert.ok(!new Set(base.roster.map(s=>s.id)).has(extended[1].id),
 'new participant cannot reuse an existing pupil ID');
assert.equal(extended[2].id,'exam-alpha','other version and its attempt survive new main import');
const wrong={...base,roster:base.roster.map(s=>({...s,
 classStudentId:s.id==='exam-beta'?'class-alpha':s.id==='exam-alpha'?'class-beta':s.classStudentId})),
 examFileV317:{},activeVariantV300:{}};
const issues=core.audit(cls,wrong);
assert.equal(issues.filter(x=>x.kind==='name-mismatch').length,2,
 'same given name with crossed surnames must be highlighted');
const fixed=core.reassign(wrong,cls,{'exam-alpha':'class-alpha','exam-beta':'class-beta'});
assert.equal(fixed.changes.length,2);
assert.deepEqual(fixed.next.scores,base.scores);
assert.deepEqual(fixed.next.bonusScores,base.bonusScores);
assert.deepEqual(fixed.next.examAttemptsV300,base.examAttemptsV300);
assert.equal(fixed.next.roster[0].classStudentId,'class-alpha');
assert.equal(fixed.next.roster[1].classStudentId,'class-beta');
assert.equal(fixed.next.studentLinkHistoryV3314.length,1,'correction audit stays local');
assert.deepEqual(wrong.roster[0].classStudentId,'class-beta','original linkage remains unchanged');
assert.throws(()=>core.reassign(base,cls,{'exam-beta':'class-alpha'}),/derselben Kind|demselben Kind/);
assert.throws(()=>core.reassign(base,cls,{'exam-beta':'unknown-class'}),/existiert nicht/);
assert.throws(()=>core.reassign(base,cls,{'exam-alpha':'class-beta','exam-beta':'class-alpha'}),
 /bisher aktiven Sonderfassung|bisher aktiven Sonderfassung/);
console.log('OK V0.33.14: distinct Leon surnames, stable Excel IDs, local audit and protected correction.');
