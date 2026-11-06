/* New material groups must preserve source files and safe print separation. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const core=require('../schulcockpit-material-evolution-v296-core.js');
const files=[
 {name:'Division - Standard.pdf',size:200,type:'application/pdf'},
 {name:'Division - Inklusion.pdf',size:180,type:'application/pdf'}];
const roles=['standard','support'],choices={kind:'merged',effort:'high',roles};
assert(core.validate(files,choices));
assert.throws(()=>core.validate(files,{...choices,roles:['support','support']}),/mindestens eine/);
assert.throws(()=>core.validate(files,{...choices,kind:'unknown'}),/Art deiner Weiterentwicklung/);
assert.equal(core.guessRole('Einfache Fassung LE.pdf',1),'support');
assert.equal(core.guessRole('Musterlösung.pdf',1),'solution');
const source=core.sourceRecords([{id:'a',title:'AB Division'}],[{catalogId:'b',fileName:'AB Fachbegriffe.pdf'}],['m:a','c:b','m:a']);
assert.deepEqual(source.map(x=>x.name),['AB Division','AB Fachbegriffe.pdf']);
assert.equal(core.badge({evolutionV296:{kind:'merged',effort:'high'},
 variants:[{type:'standard'},{type:'support'}]}).variants.length,2);

let writes=[],deleted=[],saved=0,rendered=0;
const lesson={id:'lesson',classId:'course',date:'2026-11-06',title:'Division',
 materials:['old','extra'],status:'planned',printPlan:[],
 resourceBundlesV176:{original:{items:[{materialId:'old',variantId:'oldv'}]},
 extra:{items:[{materialId:'extra',variantId:'extrav'}]}}};
const baseMat=[
 {id:'old',title:'Fachbegriffe Division',variants:[{id:'oldv',fileName:'Original 1.pdf'}]},
 {id:'extra',title:'Halbschriftliche Division',variants:[{id:'extrav',fileName:'Original 2.pdf'}]}];
const state={materials:baseMat.slice(),classes:[{id:'course',subject:'Mathematik',name:'5f',students:27}],lessons:[lesson]};
let seq=0;const ctx={
 state,storedFileKeys:new Set(),uid:(prefix)=>prefix+(++seq),structuredClone,
 cls:id=>state.classes.find(c=>c.id===id),
 mat:id=>state.materials.find(m=>m.id===id),
 variant:(mid,vid)=>state.materials.find(m=>m.id===mid)?.variants.find(v=>v.id===vid),
 lesson:id=>state.lessons.find(l=>l.id===id),
 resourceKeyV14:x=>x,
 resourceBundleV176:(l,h)=>l.resourceBundlesV176[h],
 allResourceRowsV176:l=>Object.entries(l.resourceBundlesV176).map(([h,b])=>({hint:h,type:'print',
   bundleItemsV176:b.items})),
 lessonResourcesV14:l=>Object.entries(l.resourceBundlesV176).map(([h,b])=>({hint:h,
   material:state.materials.find(m=>m.id===b.items?.[0]?.materialId),
   variant:state.materials.find(m=>m.id===b.items?.[0]?.materialId)?.variants?.[0]})),
 v183IsActive:(l,h)=>!(l.hiddenResourceKeysV183||[]).includes(h),
 v183DisconnectHint:()=>{},
 v183DeleteFromLesson:(l,h)=>{(l.hiddenResourceKeysV183||=([])).push(h);},
 v183RestoreToLesson:(l,h)=>{l.hiddenResourceKeysV183=(l.hiddenResourceKeysV183||[]).filter(x=>x!==h);},
 setResourceTypeV14:()=>{},
 ensurePlan:(l,mid,vid)=>{let p=l.printPlan.find(p=>p.materialId===mid&&p.variantId===vid);
  if(!p){p={materialId:mid,variantId:vid};l.printPlan.push(p);}return p;},
 isPrintVariantV176:(v,m)=>v.type==='standard',
 variantLabelV15:v=>v==='support'?'Förderung':'Standard',
 resourceFileRoleV176:()=> 'standard',
 fileStorePut:async(k,f)=>{writes.push({key:k,name:f.name});},
 fileStoreDelete:async k=>{deleted.push(k);},
 hasStoredFile:()=>true,
 fileStoreGet:async()=>null,
 v183DisablePlan:p=>{p.needed=false;p._v183removed=true;},
 saveState:async()=>{saved++;},render:()=>{rendered++;},
 resourceRowV14:()=>'',wizardPromptStepV14:()=>'<div class="wizard-footer-v14"></div>',
 concretePlanningPromptV12:()=>'',wire:()=>{},window:{},document:{querySelectorAll:()=>[]},
 console,alert:()=>{},esc:s=>String(s),v182IsHeld:()=>false
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-arbeitsblaetter-v276.js'),'utf8'),ctx);
(async()=>{
 await ctx.window.SchulcockpitWorksheetChoiceV276.replace(lesson,'original',files,{
  groupedV296:true,title:'Division – zusammengefasst',kind:'merged',effort:'high',
  roles,extraHints:['extra'],note:'Zwei ABs kombiniert'});
 assert.equal(state.materials.length,3,'both files are variants of exactly one new material');
 const added=state.materials[2];
 assert.equal(added.variants.length,2);
 assert.equal(added.variants[0].type,'standard');
 assert.equal(added.variants[1].type,'support');
 assert.equal(added.evolutionV296.kind,'merged');
 assert.equal(added.evolutionV296.sources.length,2);
 assert.equal(added.evolutionV296.sources[1].names[0],'Original 2.pdf');
 assert(lesson.hiddenResourceKeysV183.includes('extra'),'extra source hidden only in this lesson');
 assert.equal(lesson.resourceBundlesV176.original.items.length,1,'only standard variant is in regular lesson material bundle');
 assert.equal(lesson.printPlan.find(p=>p.variantId===added.variants[0].id).needed,true);
 assert.equal(lesson.printPlan.find(p=>p.variantId===added.variants[1].id).needed,false);
 assert.equal(lesson.printPlan.find(p=>p.variantId===added.variants[1].id).count,0);
 assert.deepEqual(writes.map(x=>x.name),files.map(x=>x.name),'both original uploads stored');
 assert.equal(baseMat[0].variants[0].fileName,'Original 1.pdf','original not overwritten');
 assert.equal(baseMat[1].variants[0].fileName,'Original 2.pdf','second original untouched');
 assert.equal(lesson.worksheetChoicesV276.original.extraHiddenHints[0],'extra');
 assert(saved>0,'saved to local state');
 console.log('Multi-variant worksheets: one material, original provenance, support not classwide, existing sources safe.');
})().catch(e=>{console.error(e);process.exitCode=1;});
