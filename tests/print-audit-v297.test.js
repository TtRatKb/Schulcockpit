const assert=require('node:assert/strict');
const core=require('../schulcockpit-print-audit-v297-core.js');
const materials=[
 {id:'m1',title:'Fachbegriffe Division',variants:[{id:'v1',fileName:'Fachbegriffe.pdf',fileKey:'a'}]},
 {id:'m2',title:'Halbschriftliche Division',variants:[{id:'v2',fileName:'Division.pdf',fileKey:'b'}]},
 {id:'mold',title:'Altes Arbeitsblatt',variants:[{id:'oldv',fileName:'Altes AB.docx',fileKey:'c',_v183obsolete:true}]}
];
const records=Object.fromEntries(materials.map(m=>[m.id,m]));
const course={id:'c',subject:'Mathematik',name:'5f'};
const p=(materialId,variantId,id,other={})=>({id,materialId,variantId,count:28,needed:true,mode:'bw',alreadyPrinted:false,...other});
const l1={id:'l1',classId:'c',date:'2026-11-09',materials:['m1','m2','mold'],
 printPlan:[p('m1','v1','p1'),p('m2','v2','p2'),p('mold','oldv','p3'),
  p('m1','v1','p4',{_v183removed:true}),p('m1','v1','p5',{alreadyPrinted:true})]};
const l2={id:'l2',classId:'c',date:'2026-11-10',materials:['m1'],
 printPlan:[p('m1','v1','p6',{count:12,mode:'color'})]};
const cancelled={id:'cancel',classId:'c',date:'2026-11-11',materials:['m1'],
 executionV180:{type:'cancelled'},printPlan:[p('m1','v1','p7')]};
const resource=(l)=>l.id==='l1'?[{hint:'Fachbegriffe',type:'print',
 bundleItemsV176:[{materialId:'m1',variantId:'v1'}],bundleV176:{}},
 {hint:'Halbschriftlich',type:'print',
 bundleItemsV176:[{materialId:'m2',variantId:'v2'}],bundleV176:{}}]:[];
const resolve={material:id=>records[id],variant:(id,vid)=>records[id]?.variants.find(v=>v.id===vid),
 course:()=>course,hasFile:v=>v.fileKey!=='b',isActive:()=>true,resources:resource};
const audit=core.resolveJobs([l1,l2,cancelled],resolve);
assert.deepEqual(audit.available.map(x=>x.plan.id),['p1','p6']);
assert.deepEqual(audit.missing.map(x=>x.plan.id),['p2']);
assert.equal(audit.excluded.filter(x=>x.reason.includes('Alte Materialfassung')).length,1);
assert(!audit.open.some(x=>x.plan.id==='p3'),'obsolete must not be advertised in ZIP');
assert(!audit.open.some(x=>x.plan.id==='p4'),'marked removed should not be printed');
assert(!audit.open.some(x=>x.plan.id==='p5'),'already printed excluded');
assert(!audit.open.some(x=>x.plan.id==='p7'),'cancelled lesson excluded');
const hidden={...l1,id:'hidden',printPlan:[p('m1','v1','hidden')]};
const a2=core.resolveJobs([hidden],{...resolve,isActive:()=>false});
assert.equal(a2.open.length,0);
assert.equal(a2.excluded.length,1);
const duplicates=core.uniqueNames([audit.available[0],audit.available[0],audit.available[1]]);
assert.equal(new Set(duplicates.map(x=>x.name)).size,3);
assert(duplicates[0].name.startsWith('SW/2026-11-09_5f/'));
assert(duplicates[2].name.startsWith('FARBE/2026-11-10_5f/'));
assert(duplicates[0].name.endsWith('.pdf'));
const nextWeek={id:'next',classId:'c',date:'2026-11-16',materials:['m1'],
 printPlan:[p('m1','v1','next')]};
assert.equal(core.resolveJobs([l1],resolve).available.length,1,'only supplied selected week evaluated');
assert.equal(core.resolveJobs([nextWeek],resolve).available.length,1,'other selected week independent');
console.log('Selected-week print ZIP: source identity, missing files, hidden, obsolete, duplicates and file names OK.');