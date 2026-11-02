/* Privacy-safe per-child bonus regression. No actual school data. */
const assert=require('node:assert/strict');
const base=require('../schulcockpit-bewertung-v260-core.js');
const calc=require('../schulcockpit-bewertung-v267-core.js');
const competencies=[
 {id:'c1',text:'Alltag einordnen'},
 {id:'c2',text:'Bräuche benennen'}
];
const tasks=[
 {id:'A',label:'Teilaufgabe A',source:'classtime',regularMax:3,bonusMax:0,competencyId:'c1'},
 {id:'B',label:'Teilaufgabe B',source:'classtime',regularMax:3,bonusMax:0,competencyId:'c1'},
 {id:'C',label:'Teilaufgabe C',source:'paper',regularMax:4,bonusMax:0,competencyId:'c2'}
];
const scores={A:0,B:3,C:0};
const st=p=>p===null?'':p>=70?'erreicht':p>=60?'teilweise erreicht':'noch nicht erreicht';
const run=(override={})=>calc.compute(tasks,competencies,it=>scores[it.id],override,true,
 {reachedMinPct:70,partialMinPct:60},st);
const original=run();
assert.equal(original.totalMax,10);
assert.equal(original.competencies[0].status,'noch nicht erreicht');
assert.equal(original.competencies[1].status,'noch nicht erreicht');
const personal=run({A:{mode:'bonus'},C:{mode:'bonus'}});
assert.equal(personal.totalMax,3);
assert.equal(personal.totalReg,3);
assert.equal(personal.totalBonusEarned,0,'0-point bonus stays 0, no invented marks');
assert.equal(personal.totalAdjusted,3);
assert.equal(personal.competencies[0].status,'erreicht');
assert.equal(personal.competencies[1].status,'');
assert.equal(personal.competencies[1].bonusOnly,true);
assert.equal(personal.competencies[1].bonusMax,4);
assert.equal(personal.competencies[1].bonusEarned,0);
assert.equal(original.totalMax,10,'other children remain unchanged');
assert.equal(run({A:{mode:'bonus'}}).totalMax,7);
assert.equal(run({A:{mode:'default'}}).totalMax,10);
assert.equal(tasks[0].regularMax,3);
assert.equal(scores.A,0);
const noGrade=run({A:{mode:'bonus'},B:{mode:'bonus'},C:{mode:'bonus'}});
assert.equal(noGrade.totalMax,0);
assert.equal(noGrade.complete,false,'no entirely bonus-based graded paper');
const zeroEarnedBonus=calc.compute(tasks,competencies,it=>it.id==='A'?3:scores[it.id],
 {A:{mode:'bonus'}},true,{reachedMinPct:70,partialMinPct:50},st);
assert.equal(zeroEarnedBonus.competencies[0].status,'erreicht');
assert.equal(zeroEarnedBonus.competencies[0].bonusEarned,3);
assert.equal(zeroEarnedBonus.totalBonusUsed,0,'bonus cannot exceed max of its regular competence');
const grade8=calc.compute(tasks,competencies,it=>it.id==='A'?3:0,
 {A:{mode:'bonus'}},false,{},null);
assert.equal(grade8.totalMax,7);
assert.equal(grade8.totalAdjusted,3,'grade 8 bonus can be applied globally');
console.log('Individual bonus/exclude: zero marks, competency E/NNE, bonus-only, totals and original data pass');
