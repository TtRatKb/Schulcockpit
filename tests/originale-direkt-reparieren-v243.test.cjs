'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const lib=require('../schulcockpit-restjahr-v236.js');
test('repair identity uses material+variant IDs, even for identical material names',()=>{
 const state={materials:[{id:'m1',title:'AB Multiplikation',variants:[{id:'v1',fileKey:'old1'}, {id:'v2',fileKey:'old2'}]},
  {id:'m2',title:'AB Multiplikation',variants:[{id:'v3',fileKey:'old3'}]}],materialCatalog:[],sequences:[],assessments:[]};
 assert.equal(lib.repairTargetV243(state,{kind:'material',id:'m1',variantId:'v2',name:'AB Multiplikation'}).record.id,'v2');
 assert.equal(lib.repairTargetV243(state,{kind:'material',id:'m2',variantId:'v3',name:'AB Multiplikation'}).record.id,'v3');
 assert.equal(lib.repairTargetV243(state,{kind:'material',id:'m1',variantId:'not-there'}),null);
 assert.equal(lib.repairTargetV243(state,{kind:'katalog',id:'invented'}),null);
});
test('other file attachment types resolve against their original file record only',()=>{
 const state={materials:[],materialCatalog:[{catalogId:'c1',fileName:'Alt.pdf',sourcePath:'Klasse 5/Alt.pdf',sourceArchive:'A.zip'}],
  sequences:[{id:'q1',sourceFilesV190:[{id:'sf1',name:'Übung.pdf'}]}],
  assessments:[{id:'a1',files:[{id:'af1',name:'Klassenarbeit.docx'}]}]};
 assert.equal(lib.repairTargetV243(state,{kind:'katalog',id:'c1',name:'Alt.pdf',sourcePath:'Klasse 5/Alt.pdf',sourceArchive:'A.zip'}).property,'localFileKey');
 assert.equal(lib.repairTargetV243(state,{kind:'reihe',id:'q1',fileId:'sf1',name:'Übung.pdf'}).record.id,'sf1');
 assert.equal(lib.repairTargetV243(state,{kind:'pruefung',id:'a1',fileId:'af1',name:'Klassenarbeit.docx'}).record.id,'af1');
 assert.equal(lib.repairTargetV243(state,{kind:'katalog',id:'c1',sourcePath:'ANDERE/Alt.pdf'}),null);
});
test('filename check accepts a missing extension, but not a different document',()=>{
 assert.equal(lib.repairNameV243('AB Fachbegriffe Multiplikation'),lib.repairNameV243('AB Fachbegriffe Multiplikation.docx'));
 assert.equal(lib.repairNameV243('Standpunkt_Multiplizieren_und_Dividieren.pdf'),lib.repairNameV243('Standpunkt Multiplizieren und Dividieren.PDF'));
 assert.notEqual(lib.repairNameV243('AB Fachbegriffe Multiplikation'),lib.repairNameV243('AB Grundaufgaben Multiplikation.docx'));
});
function browser({badSave=false,badReadback=false}={}){
 let serial=0,commits=0,rejected=0,acceptMismatch=true;
 const events={},zipArchives=[],downloaded=[],blobs=new Map(),keys=new Set();
 const uploadInputs=Array.from({length:3},(_,i)=>({
   dataset:{v243File:String(i)},disabled:false,value:'',addEventListener(type,callback){if(type==='change')this.change=callback;}
 }));
 const open={dataset:{v236Open:'m5'}};
 const exportButton={disabled:false,addEventListener(_,cb){events.export=cb;}};
 const recheckButton={disabled:false,addEventListener(_,cb){events.recheck=cb;}};
 const document={
  querySelectorAll(selector){
    if(selector==='[data-v236-open]')return [open];
    if(selector==='[data-v243-file]')return uploadInputs;
    return [];
  },querySelector(selector){
    if(selector==='[data-v236-export]')return exportButton;
    if(selector==='[data-v243-recheck]')return recheckButton;
    return null;
  },getElementById:()=>null
 };
 class FakeZip{
  constructor(){this.files=new Map();}
  file(name,data){this.files.set(name,data);}
  async generateAsync(){zipArchives.push(new Map(this.files));return new Blob(['fake zip']);}
 }
 const names=['Standpunkt_Multiplizieren_und_Dividieren.pdf','AB Fachbegriffe Multiplikation','AB Grundaufgaben Multiplikation'];
 const state={
  settings:{schoolYear:'2026/27',activeWeekStart:'2026-10-05'},classes:[{id:'m5',subject:'Mathematik',name:'5f'}],
  timetable:[],lessons:[],sequences:[],assessments:[],materialCatalog:[],materials:names.map((title,i)=>({
    id:'m'+i,title,kind:'file',assignments:[{classId:'m5',sequenceId:'q1',unitId:'u1'}],
    variants:[{id:'v'+i,fileName:title,fileKey:'lost-'+i,available:true}]
  })),yearRequirementsV236:{}
 };
 const ctx={
  document,state,modal:null,Blob,Date,Map,Set,Promise,console,JSZip:FakeZip,storedFileKeys:keys,
  SC_YEAR_PARTS_V241:require('../schulcockpit-jahreszip-v241.js'),
  esc:x=>String(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  iso:x=>x.toISOString().slice(0,10),activeMonday:()=>new Date('2026-10-05T12:00:00'),
  v190NoSchoolInfo:()=>false,visitWeekV177:()=>{},shiftActiveWeek:()=>{},
  weekStartDateV177:()=>'',activeWeekDate:()=>'',activeWeekEnd:()=>'',weekWorkflowV177:()=>({}),
  lessonSlot:()=>0,createBlankLessonFromTimetable:()=>({}),attachExactPlanV11:x=>x,
  v191LessonProtected:()=>false,saveState:async()=>{commits++;if(badSave)throw Error('State save denied');},render:()=>{},
  view:'prep',expandedLessonV176:new Set(),resourceEditorV176:{},sequencesView:()=>'',modalHtml:()=>'',wire:()=>{},
  v190PlanningYear:()=> '2026/27',v190YearBounds:()=>({start:'2026-08-01',end:'2027-07-31'}),
  v190CourseSlots:()=>[],v190CalendarRanges:()=>[],v190YearStartNum:()=>2026,
  v190PublicHolidaysForYear:()=>[],v190PlanningSequences:()=>[],v190YearFromDate:()=> '2026/27',
  v202Grade:c=>Number(String(c?.name).match(/\d+/)?.[0])||0,
  v202SubjectKey:c=>c?.subject==='Mathematik'?'mathematik':'religion',
  v202Source:()=>'',v202Topics:()=>[],v202MethodsForGrade:()=>[],
  cls:id=>state.classes.find(c=>c.id===id),seq:()=>null,uid:(p)=>p+'-'+(++serial),
  catalogAvailableV17:()=>true,catalogArchiveRecordV17:()=>null,
  catalogEntryFileV17:async()=>null,
  fileStorePut:async(key,file)=>{blobs.set(key,{key,blob:file});},
  fileStoreGet:async(key)=>badReadback?null:blobs.get(key)||null,
  fileStoreDelete:async(key)=>{blobs.delete(key);},
  hasStoredFile:v=>!!v.fileKey&&keys.has(v.fileKey),
  v184CurrentCourseCatalog:()=>[],downloadBlob:(name,data)=>downloaded.push({name,data}),
  confirm:()=>acceptMismatch,alert:()=>{rejected++;}
 };
 const src=fs.readFileSync(path.join(__dirname,'..','schulcockpit-restjahr-v236.js'),'utf8');
 vm.runInNewContext(src,ctx,{filename:'restjahr-v236.js'});
 async function start(){
   ctx.wire();open.onclick();ctx.wire();await events.export({currentTarget:exportButton});
   assert.match(ctx.modalHtml(),/Originaldatei auswählen/);ctx.wire();
 }
 return {ctx,state,keys,blobs,events,uploadInputs,start,zipArchives,downloaded,
  setMismatchConfirmation(v){acceptMismatch=v;},get rejected(){return rejected},get commits(){return commits}};
}
test('3 missing variants are repaired in-place, no duplicate materials, and regenerated export contains every file',async()=>{
 const t=browser();await t.start();
 assert.equal(t.state.materials.length,3);
 assert.equal(t.zipArchives.length,0);
 const names=['Standpunkt_Multiplizieren_und_Dividieren.pdf','AB Fachbegriffe Multiplikation.docx','AB Grundaufgaben Multiplikation.docx'];
 for(let i=0;i<names.length;i++){
   await t.uploadInputs[i].change({target:{files:[{name:names[i],size:250+i*100}]}});
   assert.equal(t.state.materials[i].variants[0].fileKey.startsWith('repair-original-'),true);
   assert.equal(t.keys.has(t.state.materials[i].variants[0].fileKey),true);
   assert.equal(t.state.materials[i].title,i===0?'Standpunkt_Multiplizieren_und_Dividieren.pdf':
     ['','AB Fachbegriffe Multiplikation','AB Grundaufgaben Multiplikation'][i]);
   t.ctx.wire();
 }
 assert.equal(t.state.materials.length,3);
 assert.match(t.ctx.modalHtml(),/3 davon hast du inzwischen neu verknüpft/);
 await t.events.recheck({currentTarget:{disabled:false}});
 assert.equal(t.zipArchives.length,1);
 const manifest=JSON.parse(t.zipArchives[0].get('09_MATERIALPRUEFUNG.json'));
 assert.equal(manifest.missingCount,0);
 assert.equal(manifest.filesIncluded,3);
 assert.equal(manifest.status,'VOLLSTAENDIG_IN_ALLEN_TEILEN');
 assert.match(t.ctx.modalHtml(),/vollständige Teil-ZIPs/);
});
test('wrong document name requires explicit confirmation and never overwrites the old attachment',async()=>{
 const t=browser();await t.start();t.setMismatchConfirmation(false);
 const old=t.state.materials[0].variants[0].fileKey;
 await t.uploadInputs[0].change({target:{files:[{name:'Andere Datei.pdf',size:128}]}});
 assert.equal(t.state.materials[0].variants[0].fileKey,old);
 assert.equal(t.blobs.size,0);
 assert.equal(t.uploadInputs[0].disabled,false);
 assert.equal(t.state.materials.length,3);
});
test('failed IndexedDB readback rolls back links and removes temporary blob',async()=>{
 const t=browser({badReadback:true});await t.start();
 const old=t.state.materials[1].variants[0].fileKey;
 await t.uploadInputs[1].change({target:{files:[{name:'AB Fachbegriffe Multiplikation.pdf',size:222}]}});
 assert.equal(t.state.materials[1].variants[0].fileKey,old);
 assert.equal(t.blobs.size,0);
 assert.equal(t.keys.size,0);
 assert.ok(t.rejected>=1);
});
