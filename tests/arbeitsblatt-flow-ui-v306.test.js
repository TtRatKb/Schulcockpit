'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const C=require('../schulcockpit-arbeitsblatt-ist-v305-core.js');
global.SC_WORKSHEET_ACTUAL_V305=C;
const F=require('../schulcockpit-arbeitsblatt-flow-v306-core.js');
const names={a:'6 Fachbegriffe Division.pdf',b:'Halbschriftliche Division.pdf',c:'Schriftliche Division.pdf'};
const pairs=[['a','m1'],['b','m1'],['c','m2']];
function printPlan(){return pairs.map(([v,m])=>({id:'job-'+v,materialId:m,variantId:v,
 needed:true,alreadyPrinted:false,count:25}));}
function makeLesson(id,date,status){
 return {id,date,classId:'m5',slot:1,status,printPlan:printPlan(),
 materials:['m1','m2'],resourceBundlesV176:{},reflectionV182:null};
}
const prev=makeLesson('prev','2026-11-05','done'),next=makeLesson('next','2026-11-06','open');
prev.printPlan.forEach(x=>x.alreadyPrinted=true);
const makeItems=()=>[
 {id:'bundle-a',materialId:'m1',variantId:'a',m:{id:'m1'},v:{id:'a',fileName:names.a}},
 {id:'bundle-b',materialId:'m1',variantId:'b',m:{id:'m1'},v:{id:'b',fileName:names.b}}
];
function sourceRows(l){
 const items=makeItems();
 return [
 {hint:'Division Blätter',type:'print',fileReady:true,bundleV176:{title:'Division',items:items.map(({id,materialId,variantId})=>({id,materialId,variantId}))},bundleItemsV176:items,
  material:null,variant:null},
 {hint:'Schriftliche Division',type:'print',fileReady:true,bundleV176:{title:'Schriftliche Division',items:[{materialId:'m2',variantId:'c'}]},
  bundleItemsV176:[{materialId:'m2',variantId:'c',m:{id:'m2'},v:{id:'c',fileName:names.c}}],material:null,variant:null}
 ];
}
function coreRows(l){
 const rs=sourceRows(l).map(r=>({hint:r.hint,type:r.type,items:r.bundleItemsV176.map(x=>({...x,fileName:names[x.variantId]}))}));
 return C.rows(rs,l.printPlan);
}
const src=coreRows(prev),ids=src.map(x=>x.id);
prev.worksheetActualV305=C.refine({items:{
 [ids[0]]:{status:'complete',printed:'yes'},
 [ids[1]]:{status:'partial',printed:'yes',follow:'continue'},
 [ids[2]]:{status:'unused',printed:'yes',follow:'stop',note:'Nicht ausgeteilt'}
}},null,src);
let rendered=0,saved=0,completed=0;
const ctx={
 SC_WORKSHEET_ACTUAL_V305:C,SC_WORKSHEET_FLOW_V306:F,
 state:{lessons:[prev,next],settings:{schoolYear:'2026/27',activeWeekStart:'2026-11-09'}},
 window:{SchulcockpitWorksheetActualV305:{rows:coreRows},scrollBy:()=>{}},
 document:{querySelectorAll:()=>[],querySelector:()=>null},console,Date,structuredClone,
 view:'lessonDayV182',modal:null,v182LessonId:'prev',
 V182_OVERALL:[['fine','Gut']],V182_TIMING:[['fit','Passt']],V182_LEARNING:[['achieved','Erreicht']],
 cls:()=>({subject:'Mathematik',name:'5f'}),lesson:id=>[prev,next].find(x=>x.id===id),
 mat:mid=>({id:mid,title:mid==='m1'?'Division Blätter':'Schriftliche Division',variants:[]}),
 variant:(m,v)=>({id:v,fileName:names[v]}),
 lessonResourcesV14:sourceRows,
 printItems:()=>next.printPlan.map(p=>({lesson:next,plan:p,variant:{fileName:names[p.variantId]}})),
 openPrintItems:()=>[],missingPrintFilesForLesson:()=>next.printPlan,
 v182RelevantMaterials:()=>['m1','m2'].map(id=>({id,title:id,variants:[]})),
 resourceRowV14:(l,r)=>'<div>'+r.hint+'</div>',
 resourceStatusV176:()=>'',resourceTypeV14:()=> 'print',
 v183IsActive:()=>true,resourceKeyV14:h=>String(h).toLowerCase(),
 displayResourceTitleV176:(l,h)=>h,
 v182IsHeld:l=>l?.status==='done',v182IsCanceled:()=>false,
 v182GetReflection:l=>(l.reflectionV182||(l.reflectionV182={overall:'',timing:'',learning:'',
  lessonFlags:[],pptFlags:[],materialIssues:{},note:'',completedAt:''})),
 v182Choices:(l,k)=>'<div class="v182-answer">'+k+'</div>',
 v182FlagGroup:(l,kind)=>'<div>'+kind+'</div>',
 v182FileButton:()=>'<button>Datei</button>',
 v182ReflectionHtml:()=>'<div>old</div>',
 v182LessonDayHtml:()=>'<div><section class="panel v305-next">old v305 duplicate</section><section class="panel v182-end-panel">Ist-Stand</section></div>',
 wizardPlanStepV14:()=>'<section><section class="panel v305-next">old v305 warning</section><h3>Material in dieser Stunde</h3></section>',
 concretePlanningPromptV12:()=>'<head>\n\n## Tatsächlich bearbeitete Materialien aus der letzten Unterrichtsstunde\nOLD TEMPLATE\nFreitext-Reflexionsnotizen bleiben aus Datenschutzgründen ausschließlich lokal im Cockpit.\nDanach hänge GENAU EINEN maschinenlesbaren Block an:',
 makeBrief:()=>'',render:()=>{rendered++;},wire:()=>{},saveState:()=>{saved++;},
 v182CommitBacklog:l=>{completed++;l.reflectionV182.completedAt='2026-11-08T09:30:00Z';},
 v182Labels:()=>[],iso:date=>date.toISOString().slice(0,10),
 mondayOf:date=>{const d=new Date(date);const diff=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-diff);return d;},
 esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
 confirm:()=>true,alert:x=>{throw Error(x)}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-arbeitsblatt-flow-v306.js'),'utf8'),ctx);
const api=ctx.window.SchulcockpitWorksheetFlowV306;
assert(api);
const info=api.effective(next);
assert.deepEqual(info.hits.map(x=>x.mode),['done','carry','done']);
assert.deepEqual(ctx.lessonResourcesV14(next).map(r=>r.hint),['Division Blätter']);
assert.equal(ctx.lessonResourcesV14(next)[0].v306AlreadyDistributed,true);
assert.deepEqual(ctx.lessonResourcesV14(next)[0].bundleItemsV176.map(x=>x.variantId),['b']);
assert.equal(ctx.printItems().length,0,'all 3 old copies automatically excluded');
assert.equal(ctx.missingPrintFilesForLesson(next).length,0,'no false missing print files');
assert.deepEqual(ctx.v182RelevantMaterials(next).map(x=>x.id),['m1'],'old references do not leak through source material list');
const prompt=ctx.concretePlanningPromptV12(next);
assert.match(prompt,/6 Fachbegriffe Division.pdf.*Nicht erneut/);
assert.match(prompt,/Halbschriftliche Division.pdf.*KEINE neue Kopie/);
assert(!prompt.includes('OLD TEMPLATE'));
assert.match(ctx.v182LessonDayHtml(next),/Materialien automatisch abgeglichen/);
assert(!ctx.v182LessonDayHtml(next).includes('old v305 duplicate'));
assert.match(ctx.wizardPlanStepV14(next),/Materialien automatisch abgeglichen/);
assert(!ctx.wizardPlanStepV14(next).includes('old v305 warning'));
const form=ctx.v182ReflectionHtml(prev);
assert.match(form,/Reflexion · kurz und übersichtlich/);
assert.match(form,/1<\/span> Wie lief die Stunde/);
assert.match(form,/2<\/span> Welche Arbeitsblätter/);
assert.match(form,/Verbesserungen & Notizen/);
assert.match(form,/data-v306-actual/);
assert.match(form,/data-v182-save-reflection/);
assert.match(form,/zurück zur Woche/);
(async()=>{
 await api.finish(prev,false);
 assert.equal(ctx.view,'week','finish goes back to Meine Woche');
 assert.equal(ctx.state.settings.activeWeekStart,'2026-11-02','return to the correct historical week');
 assert(prev.reflectionV182.completedAt,'reflection saved');
 assert(saved>0);
 assert.equal(completed,1);
 assert.equal(next.printPlan[0].needed,true,'original copy plan preserved, only effective print filtered');
 assert.equal(prev.printPlan[0].alreadyPrinted,true,'previous real print status preserved');
 assert.equal(rendered>0,true);
 next.worksheetReuseV305={repeat:[ids[0]]};
 assert.equal(ctx.printItems().length,1,'teacher can explicitly reprint finished worksheet');
 console.log('V306 UI integration: 3 worksheets auto-resolved in lesson + print, no second click, historical data safe, compact reflection returns to original week.');
})().catch(e=>{console.error(e);process.exitCode=1;});
