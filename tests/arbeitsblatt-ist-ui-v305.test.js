'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const C=require('../schulcockpit-arbeitsblatt-ist-v305-core.js');
const filenames={a:'6 Fachbegriffe Division.pdf',b:'Halbschriftliche Division.pdf',c:'Schriftliche Division.pdf'};
const bundle=()=>[
 {hint:'Division Blätter',type:'print',items:[{materialId:'m1',variantId:'a'},{materialId:'m1',variantId:'b'}]},
 {hint:'Schriftliche Division',type:'print',items:[{materialId:'m2',variantId:'c'}]}];
const printPlan=[
 {id:'p1',materialId:'m1',variantId:'a',needed:true,alreadyPrinted:true},
 {id:'p2',materialId:'m1',variantId:'b',needed:true,alreadyPrinted:true},
 {id:'p3',materialId:'m2',variantId:'c',needed:true,alreadyPrinted:true}
];
const prev={id:'prev',classId:'m5',date:'2026-11-05',slot:1,status:'done',printPlan:structuredClone(printPlan)};
const next={id:'next',classId:'m5',date:'2026-11-06',slot:1,status:'open',printPlan:structuredClone(printPlan)};
const bundles={prev:bundle(),next:bundle()};
const plainRows=C.rows(bundle().map(r=>({...r,items:r.items.map(x=>({...x,fileName:filenames[x.variantId]}))})),printPlan);
prev.worksheetActualV305=C.refine({items:{
 [plainRows[0].id]:{status:'complete',printed:'yes'},
 [plainRows[1].id]:{status:'partial',printed:'yes',follow:'continue'},
 [plainRows[2].id]:{status:'unused',printed:'yes',follow:'stop',note:'Nicht ausgeteilt'}
}},null,plainRows);
let renders=0;
const key=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const ctx={
 SC_WORKSHEET_ACTUAL_V305:C,
 state:{lessons:[prev,next],settings:{schoolYear:'2026/27'}},
 document:{querySelector:()=>null,querySelectorAll:()=>[]},window:{},
 CSS:{escape:x=>x},structuredClone,Date,console,
 lesson:id=>[prev,next].find(x=>x.id===id),
 mat:id=>({id,title:id==='m1'?'Division Blätter':'Schriftliche Division',
  variants:Object.keys(filenames).map(i=>({id:i,fileName:filenames[i]}))}),
 variant:(m,id)=>({id,fileName:filenames[id]}),
 allResourceRowsV176:l=>bundles[l.id].map(r=>({...r,
  bundleItemsV176:r.items.map(x=>({...x}))})),
 resourceBundleV176:(l,h)=>bundles[l.id].find(x=>x.hint===h),
 v183IsActive:(l,h)=>!(l.hiddenResourceKeysV183||[]).includes(key(h))&&
  l.resourceOverrides?.[key(h)]!=='ignore',
 resourceKeyV14:key,
 resourceTypeV14:(l,h)=>l.resourceOverrides?.[key(h)]||'print',
 setResourceTypeV14:(l,h,v)=>{l.resourceOverrides=l.resourceOverrides||{};l.resourceOverrides[key(h)]=v;},
 v182IsHeld:l=>l?.status==='done',v182IsCanceled:()=>false,
 v182ReflectionHtml:()=>'<section><label class="v182-note-label">Notiz</label></section>',
 v182LessonDayHtml:()=>'<section class="panel v182-end-panel">Ist-Stand</section>',
 wizardPlanStepV14:()=>'<section><h3>Material in dieser Stunde</h3></section>',
 concretePlanningPromptV12:()=>'<base>\nDanach hänge GENAU EINEN maschinenlesbaren Block an:',
 makeBrief:()=>'',wire:()=>{},render:()=>{renders++;},
 saveState:async()=>{},confirm:()=>true,alert:x=>{throw Error(x)},
 esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
 v182OpenMaterial:async()=>{}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-arbeitsblatt-ist-v305.js'),'utf8'),ctx);
assert.equal(ctx.window.SchulcockpitWorksheetActualV305.rows(prev).length,3);
assert.match(ctx.v182ReflectionHtml(prev),/Materialeinsatz & Bearbeitungsstand/);
assert.match(ctx.v182LessonDayHtml(next),/aus dieser Stunde ausblenden/i);
assert.match(ctx.v182LessonDayHtml(next),/Halbschriftliche Division.pdf/);
assert.match(ctx.wizardPlanStepV14(next),/IST-STAND STATT DOPPELTER SOLL-AUFGABEN/);
assert.match(ctx.concretePlanningPromptV12(next),/NICHT nochmal/);
assert.match(ctx.concretePlanningPromptV12(next),/gezielt weiterführen/);
let handler;
ctx.document.querySelectorAll=q=>q==='[data-v305-hide]'?[{
 getAttribute:()=>('next|'+plainRows[0].id),addEventListener:(_,fn)=>{handler=fn;}
}]:[];
ctx.wire();
(async()=>{
 handler();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(bundles.next[0].items.length,1,'keep unfinished worksheet from same material bundle');
 assert.equal(bundles.next[0].items[0].variantId,'b');
 assert.equal(next.printPlan[0].needed,false);
 assert.equal(next.printPlan[1].needed,true);
 assert.equal(prev.printPlan[0].needed,true,'old lesson printing unchanged');
 assert.match(ctx.v182LessonDayHtml(next),/Wieder einplanen/);
 let undo;
 ctx.document.querySelectorAll=q=>q==='[data-v305-restore]'?[{
  getAttribute:()=>('next|'+plainRows[0].id),addEventListener:(_,fn)=>{undo=fn;}
 }]:[];
 ctx.wire();undo();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(bundles.next[0].items.length,2,'full bundle restored');
 assert.equal(next.printPlan[0].needed,true);
 assert.equal(next.printPlan[1].needed,true);
 assert(renders>=2);
 console.log('Worksheet Ist UI: used vs printed, exact-variant suppression, undo, next-hour prompt OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
