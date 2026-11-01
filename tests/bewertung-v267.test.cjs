const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../schulcockpit-bewertung-v267-core.js');
const items=[
 {id:'a',label:'Aufgabe 1',source:'classtime',regularMax:8,bonusMax:0,competencyId:'c1'},
 {id:'b',label:'Aufgabe 2',source:'classtime',regularMax:6,bonusMax:0,competencyId:'c1'},
 {id:'c',label:'Aufgabe 3',source:'paper',regularMax:4,bonusMax:0,competencyId:'c2'}
];
const comps=[{id:'c1',text:'Wissen'},{id:'c2',text:'Anwendung'}];
const raw={a:6,b:4,c:3};
const run=(i=items,change={},lower=false,scores=raw)=>core.compute(i,comps,it=>scores[it.id]??null,change,lower,{reachedMinPct:70,partialMinPct:50},()=> '');
test('per student bonus changes denominator without modifying raw scores or class rule',()=>{
 const before=JSON.stringify(items),r=run(items,{b:{mode:'bonus'}});
 assert.equal(r.totalMax,12);
 assert.equal(r.totalReg,9);
 assert.equal(r.totalBonusEarned,4);
 assert.equal(r.totalAdjusted,12);
 assert.equal(r.totalPct,100);
 assert.equal(run().totalMax,18);
 assert.equal(JSON.stringify(items),before);
 assert.deepEqual(raw,{a:6,b:4,c:3});
});
test('individual omit requires no individual score and prints a non-valued row',()=>{
 const r=run(items,{b:{mode:'exclude'}},false,{a:6,c:3});
 assert.equal(r.complete,true);
 assert.equal(r.totalMax,12);
 assert.equal(r.totalAdjusted,9);
 assert.equal(r.itemsV260.find(it=>it.id==='b').excluded,true);
});
test('split a Classtime total into 4 normal and 2 bonus with checked child-specific bonus credit',()=>{
 const split=structuredClone(items);split[1].partialBonusV267={max:2,description:'Lücken 3 + 5'};
 const r=run(split,{b:{bonusEarned:2}});
 assert.equal(r.totalMax,16);
 assert.equal(r.totalReg,11);
 assert.equal(r.totalBonusEarned,2);
 assert.equal(r.totalAdjusted,13);
 assert.equal(r.itemsV260.length,4);
 assert.ok(r.itemsV260.some(it=>it.label.includes('Lücken 3 + 5')&&it.bonus&&it.earned===2));
 assert.equal(raw.b,4);
});
test('missing or mathematically impossible bonus split keeps result incomplete',()=>{
 const split=structuredClone(items);split[1].partialBonusV267={max:2};
 assert.equal(run(split).complete,false);
 assert.equal(run(split,{b:{bonusEarned:5}}).complete,false);
 assert.equal(run(split,{b:{bonusEarned:2}},false,{a:6,b:1,c:3}).complete,false);
 assert.equal(run(split,{b:{bonusEarned:0}},false,{a:6,b:6,c:3}).complete,false);
});
test('grade 5-7 bonus points remain within competence even for individual exception',()=>{
 const r=run(items,{b:{mode:'bonus'}},true,{a:8,b:6,c:1});
 assert.equal(r.totalMax,12);
 assert.equal(r.totalAdjusted,9);
});
test('learning areas expose earned/max without E/TE/NNE status',()=>{
 const split=structuredClone(items);
 split[0].learningAreaV267='Deuten';
 split[1].learningAreaV267='Deuten';
 split[1].partialBonusV267={max:2};
 const r=run(split,{b:{bonusEarned:2}});
 assert.deepEqual(r.learningAreasV267,[{label:'Deuten',regularMax:12,regularEarned:8,bonusEarned:2}]);
});
test('quarter-point splits are valid, no zero/max split allowed',()=>{
 assert.equal(core.validateSplit(items[1],1.25),true);
 assert.equal(core.validateSplit(items[1],6),false);
 assert.equal(core.validateSplit(items[1],0),false);
 assert.equal(core.validateSplit(items[1],1.3),false);
});
