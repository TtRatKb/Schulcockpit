/* V0.33.4 – synthetic regression for the single task editor.
 * No real names, exam scores or IDs are stored in Git.
 */
'use strict';
const assert=require('node:assert/strict');
const core=require('../schulcockpit-aufgabeneditor-v334-core.js');
const calc=require('../schulcockpit-bewertung-v267-core.js');
const items=[
 {id:'Q1',label:'Question 1',source:'classtime',regularMax:6,bonusMax:0,
  partialBonusV267:{max:3,description:'Lücken 2, 6, 9'},competencyId:'c'},
 {id:'Q3b',label:'Question 3b',source:'classtime',regularMax:6,bonusMax:0,competencyId:'c'},
 {id:'Q5',label:'Question 5',source:'classtime',regularMax:3,bonusMax:0,competencyId:'c'},
 {id:'Q6',label:'Question 6',source:'classtime',regularMax:10,bonusMax:0,competencyId:'c'}
];
const original=JSON.stringify(items);
const draft={regularRaw:'6',bonusRaw:'3',source:'classtime',competencyId:'c'};
const recovered=core.row(items[0],draft);
assert.equal(recovered.original,9,'6 regular + 3 bonus implies 9 ORIGINAL points');
assert.equal(recovered.mode,'partial');
assert.equal(recovered.bonus,3);
assert.deepEqual(core.effective(recovered),{regular:6,bonus:3,total:9});
const planned=items.map((it,i)=>i===0?recovered:
 ({...core.row(it),mode:i===1||i===2?'bonus':'regular'}));
const results=core.verify(items,planned,{scores:{synthetic:{Q1:8,Q3b:4,Q5:2,Q6:9}}},[
 {id:'Q1',max:9},{id:'Q3b',max:6},{id:'Q5',max:3},{id:'Q6',max:10}
]);
assert.equal(results.items[0].regularMax,9);
assert.equal(results.items[0].bonusMax,0);
assert.equal(results.items[0].partialBonusV267.max,3);
assert.equal(results.items[0].partialBonusV267.description,'Lücken 2, 6, 9');
assert.equal(results.items[1].bonusInsteadV260,true);
assert.equal(results.items[2].bonusInsteadV260,true);
assert.equal(results.items[1].source,'classtime','full bonus retains Classtime source');
assert.equal(results.items[1].regularMax,6,'full bonus retains raw question max for import');
assert.equal(results.regular,16);
assert.equal(results.bonus,12);
assert.equal(JSON.stringify(items),original,'task source not mutated in preview');
assert.equal(calc.validateSplit(results.items[0],3),true);
const out=calc.compute(results.items,[{id:'c',text:'Synthetic'}],it=>
 ({Q1:8,Q3b:4,Q5:2,Q6:9})[it.id],{Q1:{bonusEarned:2}},false,{},null);
assert.equal(out.totalMax,16);
assert.equal(out.totalBonusEarned,8);
assert.equal(out.totalReg,15);
assert.equal(out.totalAdjusted,16,'total capped at 100 percent');
const less=planned.map(x=>x.id==='Q6'?{...x,original:'6'}:x);
assert.throws(()=>core.verify(items,less,{scores:{synthetic:{Q6:9}}}),/vorhandenes Ergebnis ist größer/);
const noScores=core.verify(items,less,{scores:{}},[{id:'Q6',max:10}]);
assert.equal(noScores.items[3].regularMax,6);
assert.equal(noScores.warnings.length,1,'existing Classtime max mismatch must be explicit');
assert.throws(()=>core.verify(items,less,{scores:{synthetic:{Q6:5}}},[{id:'Q6',max:10}]),/dürfen nicht still umgerechnet/);
const badSplit=planned.map(x=>x.id==='Q1'?{...x,bonus:'9'}:x);
assert.throws(()=>core.verify(items,badSplit,{}),/Bonuspunkte müssen/);
const inconsistent=core.row({...items[0],bonusMax:3},null);
assert.equal(inconsistent.original,9,'legacy inconsistent 6+3 is offered as total 9');
assert.equal(inconsistent.bonus,3);
const nativeBonus={id:'B',label:'Original bonus',source:'paper_bonus',regularMax:0,bonusMax:2,competencyId:'c'};
const n=core.verify([...items,nativeBonus],[...items.map(it=>core.row(it)),core.row(nativeBonus)],{});
assert.equal(n.items.at(-1).source,'paper_bonus');
assert.equal(n.items.at(-1).regularMax,0);
assert.equal(n.items.at(-1).bonusMax,2);
console.log('OK V0.33.4: 9 total/3 bonus, combined legacy draft, full bonus source, max correction guard and original data.');
