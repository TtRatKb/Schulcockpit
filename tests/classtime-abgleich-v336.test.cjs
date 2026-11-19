/* V0.33.6 – all inputs synthetic, no real examination or pupil data. */
'use strict';
const assert=require('node:assert/strict');
const mod=require('../schulcockpit-classtime-abgleich-v336-core.js');
const item=(id,label,source,max,extra={})=>({id,label,source,
 regularMax:source==='classtime'?max:0,bonusMax:source==='classtime_bonus'?max:0,...extra});
const items=[
 item('i1','Frage 1 · Mohammed und die Entstehung des Islam (9 Freitextlücken)','classtime',9,
  {partialBonusV267:{max:3,description:'Lücken 2, 6, 9'}}),
 item('i2','Frage 2 · Fünf Säulen zuordnen','classtime',5),
 item('i3a','Frage 3a · Der Koran','classtime',5),
 item('i3b','Frage 3b · Die Moschee','classtime',6,{bonusInsteadV260:true}),
 item('i4','Frage 4 · Vier Säulen erläutern','classtime',12),
 item('i4b','Bonusfrage 4b · Die fünfte Säule','classtime_bonus',3),
 item('i5','Frage 5 · Bedeutung Jahr 622','classtime',3,{bonusInsteadV260:true}),
 item('i6','Frage 6 · Sure 4','classtime',6)
];
const cols=[
 {index:1,label:'Q1',max:9,description:'Frage 1 - Lückentext: Mohammed'},
 {index:2,label:'Q2',max:5,description:'Frage 2 - Kategorisieren: Fünf Säulen'},
 {index:3,label:'Q3',max:5,description:'Frage 3a - Lückentext: Der Koran'},
 {index:4,label:'Q4',max:6,description:'Frage 3b - Lückentext: Moschee'},
 {index:5,label:'Q5',max:12,description:'Frage 4 - Freier Text: Vier Säulen'},
 {index:6,label:'Q6',max:3,description:'Bonusfrage 4b - Freier Text: Die fünfte Säule'},
 {index:7,label:'Q7',max:3,description:'Frage 5 - Freier Text: Das Jahr 622'},
 {index:8,label:'Q8',max:10,description:'Frage 6 - Freier Text: Sure 4'}
];
assert.equal(mod.taskCode('Frage 3b - Moschee'),'3b');
assert.equal(mod.taskCode('Bonusfrage 4b – Fünfte Säule'),'4b');
const suggestion=mod.recommend(items,cols);
assert.deepEqual(Object.values(suggestion),[1,2,3,4,5,6,7,8],
 'Every task including the numeric bonus and changed-max task is matched');
assert.equal(mod.taskLabel(items[0]),'9 Originalpunkte · davon 3 Bonus');
assert.equal(mod.taskLabel(items[3]),'6 Originalpunkte · vollständig Bonus');
assert.equal(mod.taskLabel(items[5]),'3 Originalpunkte · vollständig Bonus');
assert.deepEqual(mod.classify(items[7],cols[7],''),
 {ok:false,issue:'Die Excel hat 10 Punkte, die Bewertung 6. Bitte „manuell neu bewerten“ oder „proportional umrechnen“ wählen.'});
assert.deepEqual(mod.classify(items[7],cols[7],'manual'),{ok:true,mode:'manual'});
assert.deepEqual(mod.classify(items[7],cols[7],'scale'),{ok:true,mode:'scale'});
assert.equal(mod.safeScale(8,10,6),4.75);
assert.equal(mod.safeScale(10,10,6),6);
assert.equal(mod.safeScale(0,10,6),0);
assert.equal(mod.safeScale(12,10,6),null);
const ready=mod.validateMapping(items,cols,suggestion,{i6:'manual'});
assert.equal(ready.ok,true);
assert.equal(mod.validateMapping(items,cols,suggestion,{}).ok,false);
const duplicate={...suggestion,i4b:4};
assert.equal(mod.validateMapping(items,cols,duplicate,{i6:'manual'}).ok,false);
const shifted=mod.recommend(items,cols,{i1:1,i2:2});
assert.deepEqual(shifted,suggestion);
const priv={classtime:{parsed:{sheets:[{rows:[[],[],[],[],[null,null,null,null,null,null,3],
  [null,null,null,null,null,null,0],[null,null,null,null,null,null,4],
  [null,null,null,null,null,null,'']] }]},detection:{sheetIndex:0}},
 roster:[{id:'a',rowIndex:4},{id:'b',rowIndex:5},{id:'c',rowIndex:6},{id:'d',rowIndex:7}]};
const bonus=mod.numericBonusRows(priv,items,ready.selectedById,n=>{
 if(n===null||n===undefined||n==='')return null;return Number(n);
});
assert.equal(bonus.rows.length,4);
assert.deepEqual(bonus.rows.map(x=>x.score),[3,0,null,null]);
assert.equal(bonus.warnings.length,1,'Invalid points must remain ungraded');
assert(!JSON.stringify(suggestion).includes('Synthetic'));
console.log('OK V0.33.6: Q1-Q8 match including 3-point Q6 bonus; Q8 manual or explicit scale; no double map.');
