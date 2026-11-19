/* V0.33.7 – synthetic-only bonus gap regression; no pupil data in source. */
'use strict';
const assert=require('node:assert/strict');
const core=require('../schulcockpit-bonusluecken-v337-core.js');
const grading=require('../schulcockpit-bewertung-v267-core.js');
const item={id:'A',label:'Frage 1: neun Lücken',source:'classtime',regularMax:9,bonusMax:0,
 competencyId:'W',partialBonusV267:{max:3,description:'Lücken 2, 6, 9'}};
const other={id:'B',label:'Aufgabe 2',source:'classtime',regularMax:5,bonusMax:0,competencyId:'W'};
const competencies=[{id:'W',text:'Fiktive Kompetenz'}];
assert.equal(core.stepFor(item),1);
assert.deepEqual(core.options(core.bounds(item,7),core.stepFor(item)),[1,2,3]);
assert.deepEqual(core.bounds(item,9),{active:true,ready:true,total:9,part:3,raw:9,min:3,max:3});
assert.deepEqual(core.bounds(item,0),{active:true,ready:true,total:9,part:3,raw:0,min:0,max:0});
assert.equal(core.eligible(item,7,2),true);
assert.equal(core.eligible(item,7,0),false,'seven from nine cannot have zero of three bonus gaps');
assert.equal(core.eligible(item,9,2),false,'nine total requires all three bonus gaps');
assert.equal(core.eligible(item,9,3),true);
assert.equal(core.eligible(item,7,4),false);
assert.equal(core.eligible(item,6,0),true);
assert.equal(core.view(item,7,2).state,'complete');
assert.equal(core.view(item,7,2).regular,5);
assert.equal(core.view(item,7,2).bonus,2);
assert.equal(core.view(item,7,null).state,'missing');
assert.equal(core.view(item,7,0).state,'invalid');
assert.equal(core.view(item,null,null).state,'need-raw');
assert.equal(core.isSplit(item,{mode:'bonus'}),false);
assert.equal(core.isSplit(item,{mode:'exclude'}),false);
const quarter={...item,regularMax:5,partialBonusV267:{max:1.5,description:'Teilbereich'}};
assert.equal(core.stepFor(quarter),0.25);
assert.deepEqual(core.options(core.bounds(quarter,4.5),core.stepFor(quarter)),[1,1.25,1.5]);
const priv={scores:{s1:{A:7,B:3},s2:{A:9,B:4},s3:{A:0,B:0}},
 participationV210:{s3:'makeup'},
 gradingOverridesV267:{s1:{A:{bonusEarned:2}},s2:{A:{bonusEarned:2}}}};
const roster=[{id:'s1',name:'Fiktiv A'},{id:'s2',name:'Fiktiv B'},{id:'s3',name:'Fiktiv C'}];
const get=(p,sid,it)=>p.scores?.[sid]?.[it.id]??null;
assert.deepEqual(core.count([item,other],roster,priv,get),
 {total:2,complete:1,invalid:1,awaitingRaw:0,open:1});
const privateSnapshot=JSON.stringify(priv);
const r1=grading.compute([item,other],competencies,it=>get(priv,'s1',it),
  priv.gradingOverridesV267.s1,false,{},null);
assert.equal(r1.totalMax,11,'6 regular from first question plus five from second');
assert.equal(r1.totalReg,8,'seven raw with two bonus = five regular + three from question B');
assert.equal(r1.totalBonusEarned,2);
assert.equal(r1.totalAdjusted,10);
assert.equal(r1.complete,true);
const r2=grading.compute([item,other],competencies,it=>get(priv,'s2',it),
  priv.gradingOverridesV267.s2,false,{},null);
assert.equal(r2.complete,false,'invalid stored gap combination keeps result incomplete');
assert.equal(r2.invalidV267.length,1);
assert.equal(JSON.stringify(priv),privateSnapshot,'pure helpers never change original marks');
console.log('OK V0.33.7: nine raw/three gaps, math guards, partial breakdown, makeups and private-data isolation.');
