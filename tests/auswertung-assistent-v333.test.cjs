/* V0.33.3: Pure, anonymized regression tests for assessment guide. */
'use strict';
const assert=require('node:assert/strict');
const core=require('../schulcockpit-auswertung-assistent-v333-core.js');
function task(id,regular,source='classtime'){
 return {id,label:id,source,regularMax:source.endsWith('_bonus')?0:regular,
  bonusMax:source.endsWith('_bonus')?regular:0,competencyId:'k'};
}
const original=[task('Q1',9),task('Q3b',6),task('Q5',3),task('Q6',10),task('Qextra',2,'classtime_bonus')];
const initial=JSON.stringify(original);
const split=core.adjust(original,'Q1','partial',3,'Lücken 2, 6, 9');
assert.deepEqual(core.effective(split[0]),{
 regular:6,bonus:3,original:9,mode:'partial',description:'Lücken 2, 6, 9'
});
assert.equal(core.totals(split).regular,25);
assert.equal(core.totals(split).bonus,5);
const bonus=core.adjust(core.adjust(split,'Q3b','bonus'),'Q5','bonus');
assert.equal(core.mode(bonus[1]),'bonus');
assert.equal(core.effective(bonus[1]).regular,0);
assert.equal(core.effective(bonus[1]).bonus,6);
assert.deepEqual(core.totals(bonus),{regular:16,bonus:14});
assert.equal(bonus[1].source,'classtime','original Classtime source must not be rewritten');
assert.equal(bonus[1].regularMax,6,'original maximum remains available for raw scores');
assert.equal(JSON.stringify(original),initial,'original tasks never mutated');
const restored=core.adjust(bonus,'Q3b','regular');
assert.equal(core.mode(restored[1]),'regular');
assert.equal(restored[1].bonusInsteadV260,undefined);
const originalBonus=core.effective(original[4]);
assert.equal(originalBonus.regular,0);
assert.equal(originalBonus.bonus,2);
assert.throws(()=>core.adjust(original,'Qextra','regular'),/ursprünglich als Bonus/);
for(const wrong of [0,9,-1,9.25,1.2,'']){
 assert.throws(()=>core.adjust(original,'Q1','partial',wrong),/Bonuspunkte/);
}
assert.throws(()=>core.adjust([task('only',2)],'only','bonus'),/Mindestens eine regulär/);
assert.equal(core.returned({}),false);
assert.equal(core.returned({evaluationUXV333:{returnedAt:'2026-11-19T00:00:00Z'}}),true);
console.log('OK: bonusluecken, vollstaendige Bonusfragen, Originalwerte, Grenzen und Archivstatus.');
