/* Regression: LE pending does not equal missing points, and individual bonus remains intact. */
const assert=require('node:assert/strict');
const LE=require('../schulcockpit-le-status-v283-core.js');
const source={
 student:{id:'dummy'},learningSupportV235:true,complete:true,missing:[],
 totalMax:5,totalReg:4,totalBonusEarned:2,totalEarned:6,totalAdjusted:5,
 totalPct:100,gradeV260:'1',gradeAutoV260:'1',gradeIsManualV260:false,
 competencies:[
  {id:'a',regularMax:5,regularEarned:4,bonusEarned:0,pct:80,status:'erreicht'},
  {id:'b',regularMax:0,regularEarned:0,bonusEarned:2,bonusOnly:true,pct:null,status:''}
 ]
};
const original=structuredClone(source);
const gated=LE.clarify(source);
assert.equal(gated.complete,false,'LE must not receive regular competence PDF');
assert.equal(gated.learningSupportV235,true);
assert.equal(gated.scoreCompleteV283,true,'LE can have all marks recorded');
assert.deepEqual(gated.scoreMissingV283,[]);
assert.match(gated.missing.join(' '),/LE: zieldifferente Bewertung/);
assert.equal(gated.totalReg,4);assert.equal(gated.totalBonusEarned,2);
assert.equal(gated.totalEarned,6);assert.equal(gated.totalAdjusted,5);
assert.equal(gated.totalMax,5);
assert.equal(gated.totalPct,null,'no regular percentage treated as LE decision');
assert.equal(gated.gradeV260,'','no regular grade inferred for LE');
assert(gated.competencies.every(c=>c.pct===null&&c.status==='noch nicht zieldifferent bewertet'));
assert.deepEqual(source,original,'raw report and score inputs remain unchanged');
const partial=LE.clarify({...source,complete:false,missing:['Frage 8']});
assert.equal(partial.scoreCompleteV283,false);
assert.deepEqual(partial.scoreMissingV283,['Frage 8']);
assert.deepEqual(partial.missing,['Frage 8','LE: zieldifferente Bewertung separat ausstehend']);
const another={...source,learningSupportV235:false};
assert.equal(LE.clarify(another),another,'regular children untouched');
console.log('LE status: score completeness vs separate zieldifferente decision; PDF gate and bonus preserved');
