const assert=require('node:assert/strict');
const {test}=require('node:test');
const S=require('../schulcockpit-notenspiegel-v3320-core.js');
test('grade mean, bad rate, missing split, task diagnosis and zero is a score',()=>{
 const analysis={items:[{id:'x',label:'Aufgabe X',source:'paper',regularMax:4,competencyId:'K'},{id:'y',label:'Aufgabe Y',source:'paper',regularMax:2,competencyId:'K',partialBonusV267:{max:1}}],competencies:[{id:'K',text:'Synthetisch'}]};
 const roster=['s1','s2','s3','s4'].map(id=>({id}));
 const priv={roster,paperScores:{s1:{x:4,y:2},s2:{x:0,y:0},s3:{x:3,y:1}},gradingOverridesV267:{s1:{y:{bonusEarned:1}},s2:{y:{bonusEarned:0}}},participationV210:{s4:'makeup'}};
 const r=S.summary({reports:roster.map(student=>({student})),analysis,priv,scale:[91,81,66,50,25],scoreFor:(p,id,it)=>p.paperScores[id]?.[it.id],grade:7});
 assert.equal(r.done,2);assert.equal(r.pending,1);assert.equal(r.bad,1);assert.equal(r.badPct,50);assert.equal(r.averageGrade,3.5);assert.equal(r.awaiting,1);assert.equal(r.provisional,true);assert.equal(r.pendingRows[0].issues[0].itemId,'y');assert.match(r.pendingRows[0].issues[0].reason,/Bonusanteil fehlt/);
 assert.equal(r.tasks.find(t=>t.id==='x').zero,1);assert.equal(r.tasks.find(t=>t.id==='y').open,1);
});
test('other exam file never enters standard statistics, invalid raw is not 0',()=>{
 const analysis={items:[{id:'x',source:'classtime',regularMax:2,competencyId:'K'}],competencies:[{id:'K'}]};
 const roster=['s1','s2','s3'].map(id=>({id}));const priv={roster,scores:{s1:{x:0},s2:{x:99},s3:{x:2}},examFileV317:{s3:'separate'}};
 const r=S.summary({reports:roster.map(student=>({student})),analysis,priv,scoreFor:(p,id,it)=>p.scores[id]?.[it.id],grade:7});
 assert.equal(r.done,1);assert.equal(r.pending,1);assert.equal(r.excluded,1);assert.match(r.pendingRows[0].issues[0].reason,/ungültig/);assert.equal(r.tasks[0].zero,1);
});
