/* V0.33.16 – invented class, variant-only matrix and bonus/grade summary. */
'use strict';
const assert=require('node:assert/strict');
const {taskMode,taskDisplay,ensureTarget,eligibleRows,summary}=
 require('../schulcockpit-variantenmatrix-v3316-core.js');
const grade=require('../schulcockpit-bewertung-v267-core.js');
const file={fileKey:'inclusion-file',key:'file:inclusion-file'};
const items=[
 {id:'A1',label:'Aufgabe 1 – Lückentext',source:'classtime',regularMax:9,bonusMax:0,
  partialBonusV267:{max:3,description:'Lücken 2, 6, 9'},competencyId:'k'},
 {id:'A2',label:'Aufgabe 2 – freiwilliger Bonus',source:'classtime',regularMax:4,
  bonusMax:0,bonusInsteadV260:true,competencyId:'k'},
 {id:'A3',label:'Aufgabe 3',source:'classtime',regularMax:5,bonusMax:0,competencyId:'k'}];
const rubric={items,competencies:[{id:'k',text:'Fiktives Wissen'}],thresholds:{}};
const p={roster:[
 {id:'e1',name:'Leon Fiktiv',classStudentId:'c1'},
 {id:'e2',name:'Leon Beispiel',classStudentId:'c2'},
 {id:'e3',name:'Fiktives Standardkind',classStudentId:'c3'}],
 examFileV317:{e1:file.fileKey,e2:file.fileKey},
 activeVariantV300:{e1:file.key,e2:file.key},
 scores:{e1:{A1:7,A2:4,A3:3},e2:{A1:3,A2:0,A3:5},e3:{A1:5}},
 gradingOverridesV267:{e1:{A1:{bonusEarned:2}},e2:{A1:{bonusEarned:0}}},
 variantAnalysesV317:{[file.fileKey]:rubric}};
const ready={status:'ready',file:{fileKey:file.fileKey},rubric};
assert.equal(taskMode(items[0]),'partial');
assert.equal(taskMode(items[1]),'bonus','whole bonus flag must be read from saved rubric');
assert.deepEqual(taskDisplay(items[0]),{
 mode:'partial',original:9,regularMax:6,bonusMax:3,
 label:'davon 3 Bonus (reg. 6)'});
assert.equal(taskDisplay(items[1]).label,'★ Bonus: 4 P.');
assert.equal(taskDisplay({source:'classtime_bonus',bonusMax:3}).mode,'bonus');
assert.equal(taskDisplay(items[2]).mode,'regular');
const before=structuredClone(p);
const choice=(priv,st)=>st.id==='e3'?{status:'standard'}:ready;
const assigned=[{id:'e1',name:'Leon Fiktiv',ready:true},
 {id:'e2',name:'Leon Beispiel',ready:true},
 {id:'e3',name:'Fiktives Standardkind',ready:true},
 {id:'e1',name:'Leon Fiktiv',ready:true}];
const rows=eligibleRows(file,p,assigned,choice);
assert.deepEqual(rows.map(x=>x.id),['e1','e2'],'both identically named pupils stay separate');
assert.equal(ensureTarget(p,'e1',file.fileKey,ready),rubric);
assert.throws(()=>ensureTarget(p,'e3',file.fileKey,ready),/aktive Prüfungsfassung/);
assert.throws(()=>ensureTarget(p,'e1','another-file',ready),/nicht mehr/);
assert.throws(()=>ensureTarget(p,'e1',file.fileKey,{status:'switch'}),/nicht mehr/);
const compute=id=>grade.compute(items,rubric.competencies,
 it=>p.scores[id]?.[it.id]??null,p.gradingOverridesV267[id],false,{},()=>null);
const first=compute('e1');
const second=compute('e2');
assert.equal(first.totalMax,11,'9 original points split into 6 regular and 3 bonus');
assert.equal(first.totalReg,8);
assert.equal(first.totalBonusEarned,6);
assert.equal(first.totalAdjusted,11);
assert.equal(second.totalReg,8);
assert.equal(second.totalBonusEarned,0);
assert.equal(second.totalAdjusted,8);
assert.ok(summary({...first,student:p.roster[0],gradeV260:'1'})
 .includes('Note 1'));
assert.ok(summary({...second,student:p.roster[1],gradeV260:'3'})
 .includes('Note 3'));
assert.ok(summary({...first,complete:false,missing:['Bonuspunkte'],gradeV260:'1'})
 .includes('Wertung(en) offen'),'an unfinished mark may not show a final grade');
assert.deepEqual(p,before,'the summary/matrix model never changes original points');
console.log('OK V0.33.16: both inclusion pupils, bonus source and split, grade rows and immutable data.');
