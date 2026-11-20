/* V0.33.10: synthetic per-file grade scales and no regular-score mutation. */
'use strict';
const assert=require('node:assert/strict');
const scope=require('../schulcockpit-notenschluessel-v3310-core.js');
const grading=require('../schulcockpit-bewertung-v260-core.js');
const a={id:'synthetic-exam',gradeScaleV260:[91,81,66,50,25]};
const priv={assessmentId:a.id,variantGradeScalesV3310:{
  'file-inclusion':[95,85,70,55,30]},
  scores:{regular:{a:6},inclusion:{b:9}},
  gradesV260:{regular:'2',inclusion:'3'},
  bonusScores:{inclusion:{bonus:2}}};
const copy=structuredClone(priv);
const inclusion={id:'inclusion'},regular={id:'regular'};
const choose=(p,st)=>st.id==='inclusion'?
 {status:'ready',file:{fileKey:'file-inclusion'}}:{status:'standard'};
assert.equal(scope.fileKey('standard'),'');
assert.equal(scope.fileKey('file:file-inclusion'),'file-inclusion');
assert.deepEqual(scope.forTab(a,priv,'standard'),a.gradeScaleV260);
assert.deepEqual(scope.forTab(a,priv,'file:file-inclusion'),[95,85,70,55,30]);
assert.deepEqual(scope.forStudent(a,priv,regular,choose),[91,81,66,50,25]);
assert.deepEqual(scope.forStudent(a,priv,inclusion,choose),[95,85,70,55,30]);
assert.equal(grading.grade(92,scope.forStudent(a,priv,regular,choose)),'1');
assert.equal(grading.grade(92,scope.forStudent(a,priv,inclusion,choose)),'2');
assert.equal(scope.forTab(a,priv,'file:new-file'),undefined,
 'new inclusion scale intentionally has no default grade');
assert.equal(grading.grade(92,scope.forTab(a,priv,'file:new-file')),'',
 'never inherit a regular grade threshold for an unconfigured inclusion rubric');
const changed=scope.withScale(priv,'file-inclusion',[96,86,71,56,31]);
assert.deepEqual(changed.variantGradeScalesV3310['file-inclusion'],[96,86,71,56,31]);
assert.deepEqual(changed.scores,priv.scores);
assert.deepEqual(changed.bonusScores,priv.bonusScores);
assert.deepEqual(changed.gradesV260,priv.gradesV260);
assert.deepEqual(a.gradeScaleV260,[91,81,66,50,25]);
assert.deepEqual(priv,copy,'source private data never mutated');
const cleared=scope.withScale(changed,'file-inclusion',null);
assert.equal(scope.forTab(a,cleared,'file:file-inclusion'),undefined);
assert.equal(cleared.gradesV260.inclusion,'3');
assert.throws(()=>scope.withScale(priv,'',[]),/Keine private/);
assert.throws(()=>scope.withScale(priv,'file-inclusion',[90,80]),/fünf gültige/);
console.log('OK V0.33.10: grade 8 file-specific scale, independent of regular assessment and stored marks.');
