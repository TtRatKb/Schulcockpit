/* V0.33.13 – synthetic inclusion version only; no real pupil data. */
'use strict';
const assert=require('node:assert/strict');
const core=require('../schulcockpit-inklusion-bonus-v3313-core.js');
const grading=require('../schulcockpit-bewertung-v267-core.js');
const initial={schema:'schulcockpit.assessment-analysis.v1',taskOnlyV260:true,
 competencies:[{id:'T',text:'Tasks'}],thresholds:{},
 items:[
  {id:'Q1',label:'Frage 1 – Lücken',source:'classtime',regularMax:9,bonusMax:0,competencyId:'T'},
  {id:'Q2',label:'Frage 2',source:'classtime',regularMax:4,bonusMax:0,competencyId:'T'},
  {id:'Q3',label:'Bonus',source:'classtime_bonus',regularMax:0,bonusMax:3,competencyId:'T'}]};
const priv={roster:[{id:'regular',name:'Fictional Regular'},
 {id:'inclusion',name:'Fictional Inclusion'}],
 scores:{regular:{Q1:6},inclusion:{}},
 bonusScores:{regular:{Q3:1}},
 gradingOverridesV267:{regular:{Q1:{bonusEarned:0}}},
 examFileV317:{inclusion:'file-special'},activeVariantV300:{inclusion:'file:file-special'},
 examAttemptsV300:{inclusion:[{data:{scores:{Q1:2}},fromFileV317:'standard'}]}};
const original=structuredClone(priv);
const originalRubric=structuredClone(initial);
const rules=core.updateRules(initial,{
 Q1:{mode:'partial',bonusMax:'3',description:'Lücken 2, 6, 9'},
 Q2:{mode:'regular'},Q3:{mode:'bonus'}
},priv,'file-special');
assert.deepEqual(rules.changed,['Frage 1 – Lücken']);
assert.equal(rules.regular,10);
assert.equal(rules.analysis.items[0].regularMax,9,'keep original Q maximum');
assert.deepEqual(rules.analysis.items[0].partialBonusV267,
 {max:3,description:'Lücken 2, 6, 9'});
assert.deepEqual(initial,originalRubric,'never change original rubric by reference');
assert.throws(()=>core.updateRules(initial,
 {Q1:{mode:'partial',bonusMax:'9'}},priv,'file-special'),/Bonusanteil/);
assert.throws(()=>core.updateRules(initial,
 {Q1:{mode:'bonus'},Q2:{mode:'bonus'}},priv,'file-special'),/regulär/);
const saved=core.applyMarks(priv,'inclusion',rules.analysis.items,
 {Q1:'7',Q2:'4',Q3:'2'},{Q1:'2'});
assert.deepEqual(priv,original,'never mutate private original');
assert.equal(saved.scores.inclusion.Q1,7);
assert.equal(saved.bonusScores.inclusion.Q3,2);
assert.equal(saved.gradingOverridesV267.inclusion.Q1.bonusEarned,2);
assert.equal(saved.gradingOverridesV267.regular.Q1.bonusEarned,0);
assert.equal(saved.scores.regular.Q1,6,'regular pupil untouched');
assert.equal(saved.examAttemptsV300.inclusion[0].data.scores.Q1,2,
 'archived earlier regular attempt remains untouched');
const report=grading.compute(rules.analysis.items,rules.analysis.competencies,
 item=>item.source==='classtime_bonus'?
 saved.bonusScores.inclusion?.[item.id]:saved.scores.inclusion?.[item.id],
 saved.gradingOverridesV267.inclusion,false,{},()=>null);
assert.equal(report.complete,true);
assert.equal(report.totalMax,10);
assert.equal(report.totalReg,9);
assert.equal(report.totalBonusEarned,4);
assert.equal(report.totalAdjusted,10);
assert.throws(()=>core.applyMarks(priv,'inclusion',rules.analysis.items,
 {Q1:'2',Q2:'4',Q3:'2'},{Q1:'3'}),/Bon_lücken|Bonuslücken/);
assert.throws(()=>core.applyMarks(priv,'inclusion',rules.analysis.items,
 {Q1:'10',Q2:'2',Q3:'0'},{Q1:'2'}),/außerhalb/);
assert.throws(()=>core.applyMarks(priv,'inclusion',rules.analysis.items,
 {Q1:'7',Q2:'4',Q3:'1'},{Q2:'1'}),/keinen freigegebenen/);
assert.throws(()=>core.updateRules(rules.analysis,{
 Q1:{mode:'partial',bonusMax:'2',description:'Lücken 2, 6'}
},saved,'file-special'),/Bereits korrigierte/);
const zero=core.applyMarks(saved,'inclusion',rules.analysis.items,
 {Q1:'0',Q2:'0',Q3:'0'},{Q1:'0'});
assert.equal(zero.gradingOverridesV267.inclusion.Q1.bonusEarned,0);
assert.equal(zero.scores.inclusion.Q1,0,'0 points must stay valid');
const reset=core.applyMarks(zero,'inclusion',rules.analysis.items,
 {Q1:'',Q2:'0',Q3:'0'},{Q1:''});
assert.equal(reset.scores.inclusion.Q1,undefined);
assert.equal(reset.gradingOverridesV267.inclusion?.Q1?.bonusEarned,undefined);
console.log('OK V0.33.13: independent inclusion task bonus, individual split, complete score and old attempt preserved.');
