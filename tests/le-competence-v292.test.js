/* LE-specific point and stage regression without student-identifying data. */
const assert=require('node:assert/strict');
const grading=require('../schulcockpit-bewertung-v267-core.js');
const le=require('../schulcockpit-le-status-v283-core.js');
const stages=(pct)=>pct===null?'':pct>=70?'erreicht':pct>=50?'teilweise erreicht':'noch nicht erreicht';
const competencies=[
 {id:'c1',text:'Erstes Lernziel'}, {id:'c2',text:'Zweites Lernziel'},
 {id:'c3',text:'Drittes Lernziel'}, {id:'c4',text:'Nur Bonus'}];
const items=[
 {id:'A1',label:'A1',competencyId:'c1',source:'classtime',regularMax:9,bonusMax:0},
 {id:'A2',label:'A2',competencyId:'c1',source:'classtime',regularMax:8,bonusMax:0},
 {id:'A3',label:'A3',competencyId:'c2',source:'classtime',regularMax:13,bonusMax:0},
 {id:'A4',label:'A4',competencyId:'c2',source:'classtime',regularMax:5,bonusMax:0},
 {id:'A5',label:'A5',competencyId:'c3',source:'paper',regularMax:4,bonusMax:0,partialBonusV267:{max:2}},
 {id:'A6',label:'A6',competencyId:'c4',source:'paper_bonus',regularMax:0,bonusMax:7}
];
const values={A1:6.5,A2:7,A3:3,A4:3,A5:3,A6:0};
const individual={A2:{mode:'bonus'},A4:{mode:'exclude'},A5:{bonusEarned:1}};
const snapshot=structuredClone({items,values,individual});
const computed=grading.compute(items,competencies,it=>values[it.id],individual,true,
  {reachedMinPct:70,partialMinPct:50},stages);
assert(computed.complete,'all required values were entered');
assert.equal(computed.totalMax,24,'individual bonus, exclusion and split reduce regular maximum');
assert.equal(computed.totalReg,11.5);
assert.equal(computed.totalBonusEarned,8);
assert.equal(computed.totalAdjusted,19.5);
const r=le.clarify({...computed,learningSupportV235:true,student:{id:'anonymous'}});
assert.equal(r.complete,false,'separate educational assessment remains undecided');
assert.equal(r.scoreCompleteV283,true);
assert.deepEqual(r.scoreMissingV283,[]);
const byId=Object.fromEntries(r.competencies.map(x=>[x.id,x]));
assert.equal(byId.c1.regularMax,9,'reclassified task does not inflate regular denominator');
assert.equal(byId.c1.bonusMax,8);
assert.equal(byId.c1.bonusEarned,7);
assert.equal(byId.c1.adjusted,9);
assert.equal(byId.c1.status,'erreicht');
assert.equal(byId.c1.pct,100);
assert.equal(byId.c2.regularMax,13,'excluded task removed');
assert.equal(byId.c2.pct,3/13*100);
assert.equal(byId.c2.status,'noch nicht erreicht');
assert.equal(byId.c3.regularMax,2,'partial bonus split retained');
assert.equal(byId.c3.bonusEarned,1);
assert.equal(byId.c3.status,'erreicht');
assert.equal(byId.c4.bonusOnly,true);
assert.equal(byId.c4.regularMax,0);
assert.equal(byId.c4.status,'');
assert.equal(byId.c4.pct,null);
assert.deepEqual({items,values,individual},snapshot,'stored inputs unchanged');

const rMissing=grading.compute(items,competencies,it=>it.id==='A3'?null:values[it.id],
  individual,true,{},stages);
const gated=le.clarify({...rMissing,learningSupportV235:true});
assert.equal(gated.scoreCompleteV283,false,'truly missing values still block PDF');
assert(gated.scoreMissingV283.includes('A3'));
assert.equal(gated.competencies.find(c=>c.id==='c1').status,'noch offen');
assert.equal(gated.competencies.find(c=>c.id==='c4').status,'');
console.log('LE stages respect individual bonus/exclusion/split and keep raw points unchanged.');