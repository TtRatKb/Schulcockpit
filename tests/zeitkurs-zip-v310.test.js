'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const T=require('../schulcockpit-zeitkurse-v307-core.js');
global.SC_TEMP_COURSE_V307=T;
const C=require('../schulcockpit-zeitkurs-zip-v310-core.js');
const group={id:'sub-9b',grade:'9b',subject:'Mathematik',title:'Vier Wochen Vertretung',
 temporaryV307:T.config({startDate:'2026-11-09',endDate:'2026-12-06',
  slots:[{weekday:1,slot:2}],topic:'Lineare Funktionen',
  courseMaterials:['m:worksheet','c:old-archive'],
  workMode:'Kurzer Einstieg und Aufgaben im Arbeitsheft.',note:'Klassenarbeit am Monatsende'})};
const lesson=T.draftLesson(group,{date:'2026-11-09',weekday:1,slot:2,exam:false},'3. Stunde');
lesson.quickDraftV307={topic:'Vorbereitung auf Terme',entry:'Fehler finden',
 work:'Arbeitsheft S. 34 Aufgaben 1–4',end:'Ergebnisse vergleichen'};
lesson.quickMaterialRefsV307=['m:worksheet'];
const materials=[{ref:'m:worksheet',name:'Funktionen AB.pdf',kind:'Arbeitsblatt',ready:true},
 {ref:'c:old-archive',name:'Aufgabensammlung.pdf',kind:'Archiv',ready:false}];
const span={start:'2026-11-09',end:'2026-12-06'};
const pay={schema:C.SCHEMA,groupId:group.id,period:span,
 settings:group.temporaryV307,lessons:[lesson],materials};
assert.equal(T.draftLesson(group,{date:'2026-11-09',weekday:1,slot:2,exam:false}).presentationReady,false,
 'A course lesson must never be declared PPT-complete by default');
assert.equal(lesson.title,'Thema noch nicht konkretisiert','course-wide unit topic is not a lesson');
const prompt=C.prompt(group,pay);
assert.match(prompt,/Arbeitsheft S\. 34 Aufgaben 1–4/);
assert.match(prompt,/keine selbst erfundenen/i);
assert.match(prompt,/Präsentation|PowerPoint/);
assert.match(prompt,/2–6/);
assert.match(prompt,/Stundenthema statt Reihentitel/);
assert.match(prompt,/SCHULCOCKPIT_COURSE_IMPORT/);
assert.match(prompt,/sicherung/);
const valid={schema:C.SCHEMA,groupId:group.id,lessons:[{
 id:lesson.id,date:lesson.date,slot:lesson.slot,title:'Funktionen aus Tabellen',
 objective:'Tabellen auswerten',entry:'Zwei typische Fehlannahmen',
 work:'Arbeitsheft S. 34 Aufgaben 1–4',end:'Rechenwege vergleichen',
 materialRefs:['m:worksheet'],presentationRequired:true,
 phases:[{phase:'Einstieg',minutes:6,title:'Fehlerdetektiv',details:'Zwei Beispiele analysieren'}],
 slides:[{type:'arbeitsauftrag',title:'Arbeitsauftrag',content:['AH S. 34 Nr. 1–4']}]
}]};
const tagged='<SCHULCOCKPIT_COURSE_IMPORT>\n'+JSON.stringify(valid)+'\n</SCHULCOCKPIT_COURSE_IMPORT>';
const out=C.parse('Überblick\n'+tagged,group,[lesson],['m:worksheet','c:old-archive']);
assert.equal(out[0].title,'Funktionen aus Tabellen');
assert.equal(out[0].presentationRequired,true);
assert.deepEqual(out[0].materialRefs,['m:worksheet']);
for(const [change,match] of [
 [x=>{x.groupId='other-course'},/ander/i],
 [x=>{x.lessons[0].id='other-id'},/ID/i],
 [x=>{x.lessons[0].date='2026-11-10'},/Datum/i],
 [x=>{x.lessons[0].materialRefs=['m:unknown']},/Material-ID/i],
 [x=>{x.lessons[0].slides=[]},/PowerPoint/i],
 [x=>{delete x.lessons[0].presentationRequired},/PowerPoint/i],
 [x=>{x.lessons.push({...x.lessons[0]})},/Doppelte/i]
]){
 const x=structuredClone(valid);change(x);
 assert.throws(()=>C.parse(x,group,[lesson],['m:worksheet','c:old-archive']),match);
}
assert.throws(()=>C.parse('no marker',group,[lesson],['m:worksheet']),/SCHULCOCKPIT/);
const captured=new Map(),downloads=[];
class ZipMock{
 file(name,value){captured.set(name,value);return this;}
 async generateAsync(){return new Blob(['synthetic-zip']);}
}
const state={settings:{activeWeekStart:'2026-11-09',schoolYear:'2026/27'},
 lessons:[lesson],quickTeachingV304:[group],materials:[{
 id:'worksheet',title:'Funktionen AB.pdf',variants:[{
 id:'v1',type:'standard',fileName:'Funktionen AB.pdf',fileKey:'blob1'}]}],
 materialCatalog:[{catalogId:'old-archive',fileName:'Archivdatei.pdf'}]};
let saved=0;
const ctx={
 state,window:{SchulcockpitTemporaryCoursesV307:{
  selected:()=>group,sync:()=>0,findRef:ref=>materials.find(m=>m.ref===ref),
  addRef:(l,ref)=>{l.quickMaterialRefsV307=[...(l.quickMaterialRefsV307||[]),ref];}
 }},
 SC_TEMP_PACKAGE_V310:C,SC_TEMP_COURSE_V307:T,
 JSZip:ZipMock,Blob,Date,console,structuredClone,
 view:'quickTeachingV304',viewHtml:()=>'<div><section class="panel v307-pool"></section><button data-v307-prompt>Prompt</button></div>',
 wire:()=>{},render:()=>{},esc:s=>String(s??''),uid:x=>x+'-1',
 document:{querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null},
 mat:id=>state.materials.find(m=>m.id===id),
 v182IsHeld:l=>l?.status==='done',
 hasStoredFile:v=>!!v.fileKey,
 fileStoreGet:async k=>k==='blob1'?{blob:new Blob(['worksheet-original']),name:'Funktionen AB.pdf'}:null,
 catalogAvailableV17:()=>false,
 catalogArchiveRecordV17:()=>null,
 catalogEntryFileV17:async()=>null,
 downloadBlob:(name,blob)=>downloads.push({name,blob}),
 saveState:()=>{saved++;},
 alert:()=>{},navigator:{clipboard:{}},
 mondayOf:()=>new Date('2026-11-09T12:00:00'),iso:d=>d.toISOString().slice(0,10),
 normalizeAiPackage:obj=>({phases:obj.phases,slides:obj.slides})
};
class FixedDate extends Date{
 constructor(...args){super(...(args.length?args:['2026-11-08T10:00:00Z']));}
 static now(){return Date.parse('2026-11-08T10:00:00Z');}
}
ctx.Date=FixedDate;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-zeitkurs-zip-v310.js'),'utf8'),ctx);
(async()=>{
 const api=ctx.window.SchulcockpitTemporaryCourseZipV310;
 assert(api);
 assert.match(ctx.viewHtml(),/ZIP mit Originalen/);
 assert.doesNotMatch(ctx.viewHtml(),/data-v307-prompt/);
 await api.exportPackage();
 assert.equal(downloads.length,1);
 assert.match(downloads[0].name,/\.zip$/);
 assert(captured.has('00_START_HIER.md'));
 assert(captured.has('01_CHATGPT_PROMPT.md'));
 assert(captured.has('02_KURSPLAN.json'));
 assert(captured.has('03_MATERIALMANIFEST.json'));
 assert([...captured.keys()].some(x=>/materialien\/hub_worksheet_v1_Funktionen_AB.pdf/.test(x)));
 const manifest=JSON.parse(captured.get('03_MATERIALMANIFEST.json'));
 assert.deepEqual(manifest.missing,['c:old-archive']);
 assert.equal(manifest.materials.find(x=>x.ref==='m:worksheet').ready,true);
 assert.match(captured.get('01_CHATGPT_PROMPT.md'),/Arbeitsheft S\. 34/);
 assert.match(ctx.viewHtml(),/ChatGPT-Antwort/);
 const count=await api.applyPlans(group,out);
 assert.equal(count,1);
 assert.equal(lesson.title,'Funktionen aus Tabellen');
 assert.equal(lesson.quickDraftV307.work,'Arbeitsheft S. 34 Aufgaben 1–4');
 assert.equal(lesson.presentationReady,false);
 assert.equal(lesson.presentationNotRequiredV177,false);
 assert.equal(lesson.slides.length,1);
 assert.equal(lesson.manualPlanReadyV177,true);
 assert.match(ctx.viewHtml(),/data-v310-ppt/,'after import a direct PowerPoint shortcut must appear');
 assert.equal(lesson.quickMaterialRefsV307[0],'m:worksheet');
 assert(saved>=2);
 // Historical lesson must never be replaced.
 lesson.status='done';
 assert.rejects(()=>api.applyPlans(group,out),/Keine offenen Stunden/);
 assert.equal(lesson.title,'Funktionen aus Tabellen');
 console.log('Temporary course V310 ZIP and import: real local blob, missing manifest, strict prompt, preview schema, PPT required, held lesson protected OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
