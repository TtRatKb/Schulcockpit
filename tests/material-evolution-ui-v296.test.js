const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const evo=require('../schulcockpit-material-evolution-v296-core.js');
const triage=require('../schulcockpit-material-triage-v294-core.js');
const own={id:'own',title:'Halbschriftliche Division – eigene Version',
 source:'Eigenes Ersatzarbeitsblatt · Halbschriftliche Division',
 hubV237:{kind:'arbeitsblatt',subject:'Mathematik',grade:5},
 variants:[{id:'v1',type:'standard',fileName:'Halbschriftliche Division.pdf',available:true}]};
const old={id:'original',title:'Originalblatt',
 hubV237:{kind:'arbeitsblatt',subject:'Mathematik',grade:5},variants:[]};
const l={id:'lesson',classId:'course',date:'2026-11-06',title:'Halbschriftliche Division',
 status:'planned'};
const ctx={
 SC_MATERIAL_EVOLUTION_V296:evo,SC_MATERIAL_TRIAGE_V294:triage,
 state:{materials:[own,old],materialCatalog:[],lessons:[l],classes:[{id:'course',subject:'Mathematik',name:'5f'}],
 settings:{schoolYear:'2026/27'}},
 modal:null,view:'lessonDayV182',render(){},wire(){},
 resourceRowV14:()=>'<div>Material</div>',modalHtml:()=>'<div>Previous modal</div>',
 document:{querySelector:()=>null,querySelectorAll:()=>[]},window:{},
 mat:id=>id==='own'?own:id==='original'?old:null,lesson:id=>id==='lesson'?l:null,
 cls:()=>({subject:'Mathematik',name:'5f'}),
 resourceKeyV14:x=>x,allResourceRowsV176:()=>[
  {hint:'Fachbegriffe Division',type:'print'},
  {hint:'Halbschriftliche Division',type:'print'}],
 v183IsActive:()=>true,v182IsHeld:l=>l?.status==='done',esc:x=>String(x),console
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-material-evolution-v296.js'),'utf8'),ctx);
ctx.window.SchulcockpitMaterialEvolutionV296.begin('tag',{sourceKey:'m:own'});
const tag=ctx.modalHtml();
assert.match(tag,/Eigene Arbeit nachträglich kennzeichnen/);
assert.match(tag,/Halbschriftliche Division.pdf/);
assert.doesNotMatch(tag,/data-v296-files/,'tag-only mode must not demand a re-upload');
assert.match(tag,/Einordnung speichern/);
assert.match(tag,/data-v296-material-kind/);
ctx.window.SchulcockpitMaterialEvolutionV296.begin('new');
const fresh=ctx.modalHtml();
assert.match(fresh,/data-v296-files/);
assert.match(fresh,/multiple/);
assert.match(fresh,/data-v296-subject/);
ctx.window.SchulcockpitMaterialEvolutionV296.begin('lesson',
 {lessonId:'lesson',hint:'Fachbegriffe Division'});
const lessonHtml=ctx.modalHtml();
assert.match(lessonHtml,/data-v296-source="Halbschriftliche Division"/);
assert.match(lessonHtml,/Zusätzliche ausgewählte ABs werden ausschließlich in dieser Stunde ausgeblendet/);
const row=ctx.resourceRowV14(l,{hint:'Fachbegriffe Division',type:'print'});
assert.match(row,/data-v296-lesson/);
assert.equal(ctx.resourceRowV14({...l,status:'done'},{hint:'Fachbegriffe Division',type:'print'}),'<div>Material</div>');
console.log('Material UX: posthoc classification, multiple files, source merge and held-lesson safeguard OK');