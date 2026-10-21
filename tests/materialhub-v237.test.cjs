/* node --test tests/materialhub-v237.test.cjs — synthetic course and file data */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const mod=require('../schulcockpit-materialhub-v237.js');
test('Existing Religion 5f/6 catalog and Mathe year folder are recognized',()=>{
  assert.deepEqual(mod.locate({courseLabel:'Religion 5F'}),{subject:'Religion',grade:5});
  assert.deepEqual(mod.locate({courseLabel:'Religion 6 Gottesvorstellungen / Psalmen'}),{subject:'Religion',grade:6});
  assert.deepEqual(mod.locate({sourcePath:'Mathematik/7/Werkstatt/AB 3.pdf'}),{subject:'Mathematik',grade:7});
  assert.deepEqual(mod.locate({sourcePath:'Mathe/5f/Stationen.docx'}),{subject:'Mathematik',grade:5});
});
test('Grade inferred from file folders, not archive title or assignment number',()=>{
  assert.equal(mod.locate({sourceArchive:'Mathe 5-11.zip',sourcePath:'Mathe/8/Station 7.pdf'}).grade,8);
  assert.equal(mod.locate({sourceArchive:'MatheMaterial.zip',sourcePath:'Werkstatt/Aufgabe 7.pdf'}).grade,0);
  assert.equal(mod.locate({fileName:'Klausur 2 2026.pdf'}).grade,0);
});
test('File types recognize tasks, LE tests, rubrics and Ersatzleistung products',()=>{
  const samples=[
    ['Mathewerkstatt/Stationenlernen 3.pdf','werkstatt'],
    ['Klassenarbeit LE 5f.pdf','inklusion'],
    ['Inklusionsarbeit Nr 1.docx','inklusion'],
    ['Klausur Lernkontrolle.pdf','klassenarbeit'],
    ['Erwartungshorizont KA1.docx','loesung'],
    ['Musterlösung.pdf','loesung'],
    ['Ersatzleistung Trauerglas.pdf','ersatzleistung'],
    ['Lapbook Diakonie.docx','ersatzleistung'],
    ['Themenkarte Grundrechenarten I.docx','reihenplanung'],
    ['AB 01.pdf','arbeitsblatt'],
    ['Wichtige Hintergrundquellen.docx','quelle']
  ];
  for(const [file,type] of samples)assert.equal(mod.detectType(file),type,file);
});
test('Backlog, year pool and excluded documents are distinct statuses',()=>{
  assert.equal(mod.statusOf({scope:'backlog'}),'unassigned');
  assert.equal(mod.statusOf({scope:'sequence_pool'}),'pool');
  assert.equal(mod.statusOf({scope:'backlog',hubV237:{status:'pool'}}),'pool');
  assert.equal(mod.statusOf({scope:'backlog',hubV237:{status:'assigned'}}),'assigned');
  assert.equal(mod.statusOf({scope:'backlog',disposition:'excluded'}),'excluded');
});
test('Valid dates and safe name sanitization',()=>{
  assert.equal(mod.dateValid('2027-02-28'),true);
  assert.equal(mod.dateValid('2027-02-29'),false);
  assert.equal(mod.dateValid('2026-13-01'),false);
  assert.equal(mod.dateValid(''),true);
  assert.equal(mod.safeFileName('../Klassenarbeit/LE 5f.pdf'),'LE_5f.pdf');
});
test('Grade deadlines flag late submission, marking and return',()=>{
  const w=mod.deadlineAdvice({handoutDate:'2027-01-20',dueDate:'2027-01-15',
    correctionDate:'2027-01-21',returnDate:'2027-01-25',gradeDeadline:'2027-01-20'});
  assert.ok(w.length>=3);
  assert.deepEqual(mod.deadlineAdvice({handoutDate:'2026-12-10',dueDate:'2027-01-09',
    correctionDate:'2027-01-12',returnDate:'2027-01-15',gradeDeadline:'2027-01-20'}),[]);
});
test('Identical content in same grade/name is deduped, cross-grade copies are retained',()=>{
  const e={fileName:'Arbeitsblatt Brüche.pdf',hubV237:{sha256:'a'.repeat(64),subject:'Mathematik',grade:5}};
  assert.equal(mod.sameLibraryFile(e,'a'.repeat(64),'Mathematik',5,'Arbeitsblatt Brüche.pdf'),true);
  assert.equal(mod.sameLibraryFile(e,'a'.repeat(64),'Mathematik',6,'Arbeitsblatt Brüche.pdf'),false);
  assert.equal(mod.sameLibraryFile(e,'b'.repeat(64),'Mathematik',5,'Arbeitsblatt Brüche.pdf'),false);
});
test('Course year / semester metadata is stable',()=>{
  assert.equal(mod.gradeKey('Religion',9,'2026/27',1),'Religion|9|2026/27|1');
});
function sandbox(){
 const docs=[
  {catalogId:'religion5',fileName:'Religion 5 Gottesbilder.pdf',scope:'backlog',
    courseLabel:'Religion 5F',sourceArchive:'religion.zip',sourcePath:'Religion 5/Quelle.pdf'},
  {catalogId:'mathe5',fileName:'Mathewerkstatt Station 1.pdf',scope:'sequence_pool',
    courseLabel:'Mathematik 5',localFileKey:'mat5',sourcePath:'Mathe/5/Station1.pdf',
    hubV237:{subject:'Mathematik',grade:5,kind:'werkstatt',status:'pool'}}
 ];
 const state={settings:{schoolYear:'2026/27'},materialCatalog:docs,materials:[],materialInbox:[],classes:[
  {id:'math-5f',subject:'Mathematik',name:'5f'},
  {id:'rel-5f',subject:'Religion',name:'5f'}
 ],sequences:[],lessons:[]};
 const events={};const editorButton={dataset:{v237Edit:'c:religion5'}};
 const draftFields=[
  {dataset:{v237EditField:'kind'},value:'arbeitsblatt'},
  {dataset:{v237EditField:'status'},value:'pool'}
 ];
 const button={disabled:false,addEventListener:(event,callback)=>{events['commit']=callback;}};
 const doc={querySelectorAll:sel=>{
   if(sel==='[data-v237-edit]')return [editorButton];
   if(sel==='[data-v237-edit-field]')return draftFields;
   return [];
  },querySelector:sel=>sel==='[data-v237-commit]'?button:null,
  getElementById:()=>null};
 const ctx={
  state,modal:null,document:doc,console,Date,Set,Map,Promise,clearTimeout,setTimeout,
  cls:id=>state.classes.find(c=>c.id===id),seq:()=>null,clone:x=>JSON.parse(JSON.stringify(x)),
  uid:(prefix='id')=>prefix+'-generated',
  esc:s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  v190PlanningYear:()=> '2026/27',v190SeqYear:()=> '2026/27',v190PlanningSequences:()=>[],
  v202Grade:c=>Number(String(c?.name||'').match(/\d+/)?.[0])||null,
  v202SubjectKey:c=>c?.subject==='Mathematik'?'mathematik':'religion',
  ensureMaterialCatalogV17:()=>{},ensureMaterialInboxV15:()=>{},
  catalogAvailableV17:e=>!!e.localFileKey,
  catalogAssignmentV17:()=>({}),catalogCourseV17:()=>null,
  v184CurrentCourseCatalog:()=>[],v184CourseMatchCatalog:()=>false,
  materialsView:()=>'',modalHtml:()=>'',wire:()=>{},render:()=>{},saveState:async()=>{},
  persistCatalogV171:async()=>{},storedFileKeys:new Set(['mat5']),
  V206_EXAM_NOTES:{'religion-5':'Fachkonferenzthema offen'},
  alert:msg=>{throw Error(msg)},confirm:()=>true
 };
 const js=fs.readFileSync(path.join(__dirname,'..','schulcockpit-materialhub-v237.js'),'utf8');
 vm.runInNewContext(js,ctx,{filename:'schulcockpit-materialhub-v237.js'});
 return {ctx,state,editorButton,draftFields,events};
}
test('Material-Hub renders future subject folders with no teaching classes',()=>{
 const {ctx}=sandbox();const html=ctx.materialsView();
 assert.match(html,/Mathematik/);assert.match(html,/Religion/);
 assert.match(html,/Klasse 11/);assert.match(html,/Klasse 5/);
 assert.match(html,/Mathewerkstatt Station 1.pdf/);
 assert.match(html,/Religion 5 Gottesbilder.pdf/);
 assert.match(html,/Zu prüfen/);
 assert.match(html,/Originale lokal verfügbar/);
});
test('Saving manual catalog categorization clears backlog without removing original',async()=>{
 const {ctx,state,editorButton,draftFields,events}=sandbox();
 const old=JSON.parse(JSON.stringify(state.materialCatalog));
 ctx.wire();assert.equal(typeof editorButton.onclick,'function');
 editorButton.onclick();
 assert.match(ctx.modalHtml(),/MATERIAL EINORDNEN/);
 ctx.wire();
 for(const f of draftFields){assert.equal(typeof f.onchange,'function');f.onchange();}
 assert.equal(typeof events.commit,'function');
 events.commit({currentTarget:{disabled:false}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(state.materialCatalog.length,2);
 assert.equal(state.materialCatalog[0].hubV237.status,'pool');
 assert.equal(state.materialCatalog[0].hubV237.kind,'arbeitsblatt');
 assert.equal(mod.statusOf(state.materialCatalog[0]),'pool');
 assert.deepEqual(state.materialCatalog[0].sourcePath,old[0].sourcePath);
 assert.equal(state.materialCatalog[0].localFileKey,undefined,'local file link unchanged');
});
test('Mathe 5 library pool becomes available to the year-plan catalog',()=>{
 const {ctx}=sandbox();
 const xs=ctx.v184CurrentCourseCatalog('math-5f');
 assert.equal(xs.length,1);
 assert.equal(xs[0].catalogId,'mathe5');
 assert.equal(ctx.v184CourseMatchCatalog(xs[0],'math-5f'),true);
});
