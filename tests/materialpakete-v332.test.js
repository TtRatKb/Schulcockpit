'use strict';
const assert=require('node:assert/strict');
const P=require('../schulcockpit-materialpakete-v332-core.js');
const Audit=require('../schulcockpit-print-audit-v297-core.js');
const files=[
{id:'old1',title:'Lebenslauf-Martin-Luther.pdf',variants:[{id:'a',fileName:'Lebenslauf-Martin-Luther.pdf',fileKey:'old-a'}]},
{id:'old6',title:'Material 6 Luther wird geächtet.pdf',variants:[{id:'b',fileName:'Material 6 Luther wird geächtet.pdf',fileKey:'old-b'}]},
{id:'old7',title:'Material 7 Übersetzung der Bibel.pdf',variants:[{id:'c',fileName:'Material 7 Übersetzung der Bibel.pdf',fileKey:'old-c'}]},
{id:'own',title:'Luther: Lebenslauf, Konflikt und Bibelübersetzung',
 variants:[{id:'std',type:'standard',fileName:'Luther_E.docx',fileKey:'own-e'},
 {id:'g',type:'support',fileName:'Luther_G.docx',fileKey:'own-g'},
 {id:'solution',type:'solution',fileName:'Luther_EH.pdf',fileKey:'own-eh'}]}];
const rows=[
{hint:'Lebenslauf-Martin-Luther.pdf',type:'print',bundleItemsV176:[{materialId:'own',variantId:'std'}]},
{hint:'Material 6 Luther wird geächtet.pdf',type:'ignore',
 bundleItemsV176:[{materialId:'old6',variantId:'b'}]},
{hint:'Material 7 Übersetzung der Bibel.pdf',type:'ignore',
 bundleItemsV176:[{materialId:'old7',variantId:'c'}]}];
const lesson={id:'religion7',classId:'r7',date:'2026-11-20',
 materials:files.map(m=>m.id),
 resourceBundlesV176:{
  'lebenslauf martin luther pdf':{items:[{materialId:'own',variantId:'std'}]},
  'material 6 luther wird geachtet pdf':{items:[{materialId:'old6',variantId:'b'}]},
  'material 7 ubersetzung der bibel pdf':{items:[{materialId:'old7',variantId:'c'}]}},
 worksheetChoicesV276:{'lebenslauf martin luther pdf':{
  hint:'Lebenslauf-Martin-Luther.pdf',
  chosenNames:['Luther_E.docx','Luther_G.docx','Luther_EH.pdf'],
  extraHiddenHints:['Material 6 Luther wird geächtet.pdf',
   'Material 7 Übersetzung der Bibel.pdf']}},
 printPlan:[
  {id:'old6plan',materialId:'old6',variantId:'b',needed:true,count:27},
  {id:'old7plan',materialId:'old7',variantId:'c',needed:true,count:27},
  {id:'e',materialId:'own',variantId:'std',needed:true,count:20},
  {id:'g',materialId:'own',variantId:'g',needed:true,count:10}
 ]};
const digitalCourse={id:'r7',allIpadsV179:true};
assert.equal(P.digital(digitalCourse,lesson),true,'existing iPad flag is inherited');
assert.equal(P.excludeReason(lesson,lesson.printPlan[0],digitalCourse,files,rows)
 .includes('digital'),true);
const paper={id:'r7',allIpadsV179:true,materialDeliveryV332:'print'};
assert.equal(P.digital(paper,lesson),false,'teacher may explicitly turn paper back on');
for(const id of ['old6plan','old7plan']){
 const job=lesson.printPlan.find(p=>p.id===id);
 assert.match(P.excludeReason(lesson,job,paper,files,rows),/ersetzt/);
}
for(const id of ['e','g']){
 assert.equal(P.excludeReason(lesson,lesson.printPlan.find(p=>p.id===id),paper,files,rows),'');
}
const lookup={resources:()=>rows,material:id=>files.find(m=>m.id===id),
 variant:(id,vid)=>files.find(m=>m.id===id)?.variants.find(v=>v.id===vid),
 course:()=>paper,hasFile:()=>true,isActive:(l,h)=>!P.hidden(l,files).has(P.key(h)),
 excludeReason:(l,p)=>P.excludeReason(l,p,paper,files,rows)};
const audit=Audit.resolveJobs([lesson],lookup);
assert.deepEqual(audit.open.map(x=>x.plan.id),['e','g']);
assert.equal(audit.open.reduce((n,x)=>n+x.copies,0),30);
assert.equal(audit.excluded.length,2);
const reportDigital=Audit.resolveJobs([lesson],{...lookup,excludeReason:(l,p)=>
 P.excludeReason(l,p,digitalCourse,files,rows)});
assert.equal(reportDigital.open.length,0,'digital Religion 7 should have no 164-copy leak');
const variants=files.find(m=>m.id==='own').variants;
assert.deepEqual(P.defaults(variants,30),{std:20,g:10,solution:0});
assert.equal(P.groupCount(27,4),7);
assert.deepEqual(P.desiredCopies({numbers:{std:20,g:10,solution:0},variants}).counts,
 {std:20,g:10,solution:0});
assert(P.desiredCopies({numbers:{std:27,g:-3},variants}).errors.length>0);
assert(P.desiredCopies({numbers:{solution:25},variants}).errors.length>0);
assert.equal(P.proposalForMerge(['Lebenslauf','Material 6','Material 7'],'Lebenslauf').others.length,2);
lesson.materialDeliveryV332='digital';
assert.equal(P.digital(paper,lesson),true,'lesson exception supersedes course print');
console.log('V332 core: full 3→1 replacement, old print excluded, 20/10 quantities, group sizes, digital iPad inherited and teacher override OK');
