/* node --test tests/jahreszip-v241-integration.test.cjs */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const helper=require('../schulcockpit-jahreszip-v241.js');
test('479 locally present course originals export as 2 required downloads, audit reports all present',async()=>{
 const generated=[],downloads=[],listeners={};
 class FakeZip{
  constructor(){this.files=new Map();}
  file(path,content){this.files.set(path,content);return this;}
  async generateAsync(){generated.push(new Map(this.files));return new Blob([JSON.stringify([...this.files.keys()])],{type:'application/zip'});}
  static async loadAsync(){return new FakeZip();}
 }
 const catalog=Array.from({length:479},(_,i)=>({
  catalogId:'c'+i,fileName:'AB_'+i+'.pdf',
  sourceArchive:'',sourcePath:'Mathe/5/AB_'+i+'.pdf',scope:'sequence_pool',
  resourceType:'print',hubV237:{subject:'Mathematik',grade:5,kind:'arbeitsblatt'}
 }));
 const st={settings:{schoolYear:'2026/27',activeWeekStart:'2026-10-05'},classes:[{id:'m5',subject:'Mathematik',name:'5f'}],
  timetable:[],lessons:[],sequences:[],assessments:[],materials:[],materialCatalog:catalog,yearRequirementsV236:{}};
 const openBtn={dataset:{v236Open:'m5'}};
 const downloadBtns=Array.from({length:3},(_,i)=>({dataset:{v241Download:String(i)}}));
 const exportBtn={disabled:false,addEventListener(_event,cb){listeners.export=cb;}};
 const responseBtn={disabled:false,addEventListener(_event,cb){listeners.response=cb;}};
 const doc={
  querySelectorAll(s){if(s==='[data-v236-open]')return [openBtn];
   if(s==='[data-v241-download]')return downloadBtns.slice(0,generated.length);
   return [];},
  querySelector(s){if(s==='[data-v236-export]')return exportBtn;
   if(s==='[data-v241-response]')return responseBtn;
   return null;},
  getElementById(){return null;}
 };
 const ctx={
  state:st,modal:null,document:doc,Blob,Date,Promise,Set,Map,console,JSZip:FakeZip,
  SC_YEAR_PARTS_V241:helper,
  esc:s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  iso:d=>d.toISOString().slice(0,10),activeMonday:()=>new Date('2026-10-05T12:00:00'),
  v190NoSchoolInfo:()=>null,visitWeekV177:()=>{},shiftActiveWeek:()=>{},
  weekStartDateV177:()=>'',activeWeekDate:()=>'',activeWeekEnd:()=>'',weekWorkflowV177:()=>({}),
  lessonSlot:()=>0,createBlankLessonFromTimetable:()=>({}),attachExactPlanV11:x=>x,
  v191LessonProtected:()=>false,saveState:()=>{},render:()=>{},view:'prep',
  expandedLessonV176:new Set(),resourceEditorV176:{},sequencesView:()=>'',modalHtml:()=>'',wire:()=>{},
  v190PlanningYear:()=> '2026/27',
  v190YearBounds:()=>({start:'2026-08-01',end:'2027-07-31'}),
  v190CourseSlots:()=>[],v190CalendarRanges:()=>[],v190YearStartNum:()=>2026,
  v190PublicHolidaysForYear:()=>[],v190PlanningSequences:()=>[],v190YearFromDate:()=> '2026/27',
  v202Grade:c=>Number(String(c?.name).match(/\d+/)?.[0])||0,
  v202SubjectKey:c=>c?.subject==='Mathematik'?'mathematik':'religion',
  v202Source:()=>'',v202Topics:()=>[],v202MethodsForGrade:()=>[],
  cls:id=>st.classes.find(c=>c.id===id),seq:()=>null,uid:()=> 'uid',
  catalogAvailableV17:()=>true,catalogArchiveRecordV17:()=>null,
  catalogEntryFileV17:async()=>({size:256*1024}),
  fileStoreGet:async()=>null,hasStoredFile:()=>false,
  v184CurrentCourseCatalog:()=>catalog,
  downloadBlob:(name,blob)=>downloads.push({name,blob}),
  confirm:()=>true,alert:s=>{throw Error('Unexpected UI alert: '+s)}
 };
 const js=fs.readFileSync(path.join(__dirname,'..','schulcockpit-restjahr-v236.js'),'utf8');
 vm.runInNewContext(js,ctx,{filename:'restjahr-v236.js'});
 ctx.wire();
 assert.equal(typeof openBtn.onclick,'function');openBtn.onclick();
 ctx.wire();
 assert.equal(typeof listeners.export,'function');
 await listeners.export({currentTarget:exportBtn});
 assert.equal(generated.length,2);
 const first=[...generated[0].keys()],second=[...generated[1].keys()];
 assert.equal(first.filter(k=>k.startsWith('materialien/')).length,400);
 assert.equal(second.filter(k=>k.startsWith('materialien/')).length,79);
 assert.ok(first.includes('01_PLANUNGSAUFTRAG.txt'));
 assert.ok(first.includes('09_MATERIALPRUEFUNG.json'));
 assert.ok(first.includes('10_TEILPAKETE.json'));
 assert.ok(!second.includes('01_PLANUNGSAUFTRAG.txt'));
 assert.ok(second.includes('11_DATEIEN_DIESES_TEILS.json'));
 const audit=JSON.parse(generated[0].get('09_MATERIALPRUEFUNG.json'));
 assert.equal(audit.status,'VOLLSTAENDIG_IN_ALLEN_TEILEN');
 assert.equal(audit.catalogTotal,479);
 assert.equal(audit.catalogIncluded,479);
 assert.equal(audit.skippedCount,0);
 assert.equal(audit.parts.length,2);
 assert.equal(audit.catalog.filter(x=>x.part===2).length,79);
 assert.match(ctx.modalHtml(),/2 vollständige Teil-ZIPs/);
 ctx.wire();
 downloadBtns[0].onclick();downloadBtns[1].onclick();
 assert.equal(downloads.length,2);
 assert.match(downloads[0].name,/_Teil_01_von_02\.zip/);
 assert.match(downloads[1].name,/_Teil_02_von_02\.zip/);
 assert.equal(typeof listeners.response,'function');
 listeners.response();
 assert.match(ctx.modalHtml(),/ChatGPT-Antwort/);
});
