/* V0.33.15 – no personal data; all marks and tasks fictional. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const grade=require('../schulcockpit-notenbogen-v3315-core.js');
const source=[
 {id:'Q1::regularV267',label:'Frage 1 · regulär',source:'classtime',bonus:false,
  earned:5,max:6},
 {id:'Q1::bonusV267',label:'Frage 1 · Bonus (Lücken 2, 6, 9)',
  source:'classtime_bonus',bonus:true,earned:2,max:3},
 {id:'Q2',label:'Frage 2 – Die fünf Säulen',source:'classtime',bonus:false,earned:3,max:5},
 {id:'Q3b',label:'Frage 3b – Bonus',source:'classtime',bonus:true,earned:2,max:4},
 {id:'Q4b',label:'Bonusfrage 4b',source:'classtime_bonus',bonus:true,earned:0,max:3},
 {id:'Q5',label:'Frage 5 – nicht gewertet',source:'classtime',bonus:false,
  excluded:true,earned:0,max:0},
 {id:'Q6',label:'Frage 6',source:'classtime',bonus:false,earned:0,max:6}
];
test('split gap counts stay as one task with separate possible/earned bonus',()=>{
 const original=structuredClone(source);
 const rows=grade.taskRows(source);
 assert.equal(rows.length,6);
 assert.deepEqual(rows[0],{
  id:'Q1',label:'Frage 1',regularMax:6,regularEarned:5,bonusMax:3,
  bonusEarned:2,hasRegular:true,hasBonus:true,excluded:false,
  open:false,note:'Bonus: Lücken 2, 6, 9'
 });
 assert.equal(rows[2].hasRegular,false);
 assert.equal(rows[2].bonusMax,4);
 assert.equal(rows[2].bonusEarned,2);
 assert.equal(rows[3].bonusEarned,0,'0 bonus is an achieved score, not missing');
 assert.equal(rows[4].excluded,true);
 assert.equal(rows[5].regularEarned,0,'0 regular points is a valid result');
 assert.deepEqual(source,original,'PDF view never changes any score');
});
test('notenschluessel shows percentages and mathematically correct point minima',()=>{
 const keys=grade.gradeBoundaries(37,[91,81,66,50,25]);
 assert.equal(keys.length,6);
 assert.deepEqual(keys.map(x=>x.grade),['1','2','3','4','5','6']);
 assert.deepEqual(keys.map(x=>x.points),[33.67,29.97,24.42,18.5,9.25,9.25]);
 assert.equal(keys[0].label,'ab 91 %');
 assert.equal(keys[5].label,'unter 25 %');
 assert.equal(grade.gradeBoundaries(37,[91,81,81,50,25]).length,0);
 assert.equal(grade.gradeBoundaries(37,undefined).length,0);
 assert.equal(grade.gradeBoundaries(0,[91,81,66,50,25]).length,0);
});
test('grade key belongs to actual scored file, not the currently open tab',()=>{
 const assessment={gradeScaleV260:[91,81,66,50,25]};
 const privateScores={variantGradeScalesV3310:{'inclusive-file':[95,85,70,55,30]}};
 assert.deepEqual(grade.scaleForReport({},assessment,privateScores),assessment.gradeScaleV260);
 assert.deepEqual(grade.scaleForReport({examFileV317:'inclusive-file'},
  assessment,privateScores),[95,85,70,55,30]);
 assert.equal(grade.scaleForReport({examFileV317:'new-file'},
  assessment,privateScores),null,'never inherit regular scale for inclusion');
});
test('ungraded answers are not formatted as zero points',()=>{
 const rows=grade.taskRows([{id:'x',label:'Aufgabe X',bonus:false,max:5,earned:null},
 {id:'y',label:'Aufgabe Y',bonus:true,max:2,earned:null}]);
 assert.equal(rows[0].open,true);
 assert.equal(rows[1].open,true);
});
