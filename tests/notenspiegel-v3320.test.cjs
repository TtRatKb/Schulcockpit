/* V0.33.20 – entirely fictional children, no personal grades or Excel data. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mirror=require('../schulcockpit-notenspiegel-v3320-core.js');
const scale=[91,81,66,50,25];
function setup(){
 const rubric={schema:'schulcockpit.assessment-analysis.v1',
  competencies:[{id:'K',text:'Fiktiv'}],thresholds:{},items:[
   {id:'Q1',label:'Aufgabe 1',source:'classtime',regularMax:9,bonusMax:0,competencyId:'K'},
   {id:'Q2',label:'Aufgabe 2',source:'classtime',regularMax:5,bonusMax:0,competencyId:'K'},
   {id:'Q3',label:'Bonus original',source:'classtime_bonus',regularMax:0,bonusMax:3,competencyId:'K'}
  ]};
 const students=[
  {id:'s1',name:'Leon Erfunden'},
  {id:'s2',name:'Leon Ausgedacht'},
  {id:'s3',name:'Fiktive Nachschrift'},
  {id:'s4',name:'Fiktives offenes Ergebnis'}];
 const priv={roster:students,
  scores:{s1:{Q1:9,Q2:5},s2:{Q1:5,Q2:0},s3:{Q1:8,Q2:5},s4:{Q1:6}},
  bonusScores:{s1:{Q3:3},s2:{Q3:0},s3:{Q3:1},s4:{}},
  gradingOverridesV267:{},participationV210:{s3:'makeup'}};
 return {rubric,students,priv};
}
const scoreFor=(p,id,it)=>
 it.source==='classtime_bonus'?p.bonusScores[id]?.[it.id]:
 p.scores[id]?.[it.id];
const source=(env,analysis=env.rubric,opts={})=>mirror.summary({
 reports:env.students.map(student=>({student,complete:false})),
 analysis,priv:env.priv,scale:opts.scale,scoreFor,grade:opts.grade||8,
 variant:opts.variant||'standard'
});
test('a six-grade histogram excludes unfinished and makeup pupils rather than treating them as 6',()=>{
 const x=setup(),stat=source(x,x.rubric,{scale});
 assert.deepEqual(stat.histogram,[1,0,0,0,1,0]);
 assert.equal(stat.done,2);assert.equal(stat.pending,1);
 assert.equal(stat.excluded,1);assert.equal(stat.bad,1);
 assert.deepEqual(stat.students.map(s=>s.id),['s1','s2']);
 assert.equal(stat.close,0);
 assert.equal(stat.scaleStored,true);
});
test('grade 5–7 statistical scale is only a default preview, never a saved note',()=>{
 const x=setup(),original=structuredClone(x);
 const stat=source(x,x.rubric,{grade:7});
 assert.deepEqual(stat.scale,scale);
 assert.equal(stat.scaleStored,false);
 assert.equal(stat.done,2);
 assert.deepEqual(x,original);
});
test('selecting a task as full bonus updates histogram live without changing original marks',()=>{
 const x=setup(),original=structuredClone(x);
 const changed=mirror.rule(x.rubric,'Q2',{mode:'bonus'},x.priv);
 assert.equal(changed.changed,true);
 assert.equal(changed.regularMax,9);
 assert.equal(mirror.mode(changed.item),'bonus');
 const before=source(x,x.rubric,{scale}),after=source(x,changed.analysis,{scale});
 assert.notDeepEqual(after.histogram,before.histogram);
 assert.equal(after.done,before.done);
 assert.deepEqual(x,original,'preview must not mutate either the original rubric or scores');
 assert.throws(()=>mirror.rule(changed.analysis,'Q1',{mode:'bonus'},x.priv),/Mindestens eine regulär/);
});
test('newly declared bonus gaps remain open until manually split, then reappear in statistics',()=>{
 const x=setup();
 const plan=mirror.rule(x.rubric,'Q1',{
  mode:'partial',bonusMax:'3',description:'Lücken 2, 6, 9'},x.priv);
 assert.equal(plan.regularMax,11);
 const first=source(x,plan.analysis,{scale});
 assert.equal(first.done,0);
 assert.equal(first.pending,3); // s1, s2 and s4 still open, s3 absent
});
test('existing bonus gap allocations are protected from silent overwrite',()=>{
 const x=setup();
 x.priv.gradingOverridesV267.s1={Q1:{bonusEarned:2}};
 assert.throws(()=>mirror.rule(x.rubric,'Q1',{
  mode:'partial',bonusMax:3,description:'2, 6, 9'},x.priv),/bereits individuelle Bonuslücken/);
});
test('within one point of better grade highlights only the next attainable threshold',()=>{
 const x=setup();
 x.priv.scores.s2={Q1:4,Q2:0};
 x.priv.bonusScores.s2={Q3:0};
 const stat=source(x,x.rubric,{scale});
 assert.equal(stat.students.find(s=>s.id==='s2').grade,5);
 // With 14 regular max, note 4 threshold is 7 P -> no one-point flag.
 assert.equal(stat.students.find(s=>s.id==='s2').next,null);
 const r={schema:'schulcockpit.assessment-analysis.v1',
  competencies:[{id:'K',text:'Fiktiv'}],thresholds:{},
  items:[{id:'T',label:'Einzige Aufgabe',source:'classtime',
   regularMax:34,competencyId:'K'}]};
 const p={roster:[{id:'s1'}],scores:{s1:{T:22}},bonusScores:{},
  gradingOverridesV267:{},participationV210:{}};
 const opts={reports:[{student:{id:'s1'},complete:true}],analysis:r,
  priv:p,scale,scoreFor,grade:8};
 const low=mirror.summary(opts);
 assert.equal(low.students[0].grade,4);
 assert.deepEqual(low.students[0].next,{grade:3,points:0.25});
 p.scores.s1.T=22.25;
 const high=mirror.summary(opts);
 assert.equal(high.students[0].grade,3);
 assert.equal(high.students[0].next,null);
});
test('inclusion file uses only its own report list and separate approved percentage scale',()=>{
 const x=setup(),other={student:{id:'outside'},complete:true};
 const stat=mirror.summary({reports:[{student:x.students[0],complete:true}],
  analysis:x.rubric,priv:{...x.priv,examFileV317:{s1:'fake'}},scale:[95,85,70,55,30],scoreFor,
  grade:8,variant:'file:fake'});
 assert.equal(stat.done,1);
 assert.equal(stat.scaleStored,true);
 assert.equal(stat.students[0].grade,1);
 assert.ok(!stat.students.some(s=>s.id===other.student.id));
});
test('source bonus tasks cannot be reclassified and all rules are confined to file rubric',()=>{
 const x=setup();
 assert.throws(()=>mirror.rule(x.rubric,'Q3',{mode:'regular'},x.priv),
  /ursprünglich eigenständige Bonusfrage/);
 assert.throws(()=>mirror.rule(x.rubric,'Q1',{mode:'partial',bonusMax:'9'},x.priv),
  /größer 0 und kleiner/);
 assert.throws(()=>mirror.rule(x.rubric,'Q1',{mode:'partial',bonusMax:'1.3'},x.priv),
  /0,25-Punkte-Schritte/);
 assert.throws(()=>mirror.rule(x.rubric,'MISSING',{mode:'bonus'},x.priv),
  /nicht zur aktuellen/);
});
