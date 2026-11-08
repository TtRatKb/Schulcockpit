'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),
 path=require('node:path');
const C=require('../schulcockpit-teilreihenplanung-v313-core.js');
let flow,view='sequences',modal=null,saves=0,fail=false;
const dates=['2026-10-20','2026-10-27','2026-11-17','2026-12-08'];
const q={id:'q-tod',classId:'r9',title:'Tod und Trauer',
 schoolYearV190:'2026/27',startDate:dates[0],endDate:dates[3],
 sourceFilesV190:[{id:'rubric',name:'Bewertungskriterien Trauerglas.pdf',
  fileKey:'rubric-file',size:15}],
 plan:['held1','held2','after','deadline'].map((id,i)=>({
  id,title:id,plannedDate:dates[i],content:'Bisherige Planung '+id,
  objective:'Alt '+id,notes:'Vorschlag',
  materialLinksV184:i===2?[{materialId:'oldmat',variantId:'v1',
    canonical:'Ungeeignetes Blatt.pdf'}]:[],
  resourcesNeededV244:'',pendingMaterialReferencesV184:[]}))};
const ls=q.plan.map((u,i)=>({id:'l-'+u.id,classId:'r9',sequenceId:q.id,
 date:u.plannedDate,slot:2,period:'2.',status:i<2?'done':'open',
 title:u.title,objective:'Voriges Ziel',
 planReference:{unitId:u.id,title:u.title,plannedDate:u.plannedDate,
  material:'Ungeeignetes Blatt.pdf'},
 materials:i===2?['oldmat']:[],
 printPlan:i===2?[{materialId:'oldmat',alreadyPrinted:false,needed:true}]:[],
 phasePlan:i===2?[{title:'Alte Phase'}]:[],
 slides:i===2?[{title:'Alte Folie'}]:[],
 presentationReady:i===2,presentationNotRequiredV177:false}));
const state={
 settings:{schoolYear:'2026/27'},
 classes:[{id:'r9',subject:'Religion',name:'9',students:25}],
 timetable:[{id:'tt',classId:'r9',weekday:2,slot:2}],
 schoolCalendarsV190:{},assessments:[],
 materials:[{id:'oldmat',title:'Ungeeignetes Blatt.pdf',
  variants:[{id:'v1',fileKey:'old-file',fileName:'Ungeeignetes Blatt.pdf'}],
  assignments:[{classId:'r9',sequenceId:q.id,unitId:'after'}]}],
 materialCatalog:[],sequences:[q],lessons:ls
};
const zipFiles=new Map(),downloads=[];
class ZipMock{
 file(n,c){zipFiles.set(n,c);return this;}
 async generateAsync(){return new Blob(['zip-bytes']);}
}
class FixedDate extends Date{
 constructor(...args){super(...(args.length?args:['2026-11-08T10:00:00Z']));}
 static now(){return Date.parse('2026-11-08T10:00:00Z');}
}
const document={querySelector:()=>null,querySelectorAll:()=>[],
 getElementById:()=>null};
const ctx={state,window:{},modal,view,document,Date:FixedDate,JSZip:ZipMock,
 Blob,console,structuredClone,
 SC_PARTIAL_SEQUENCE_V313:C,
 seq:id=>state.sequences.find(x=>x.id===id),
 cls:id=>state.classes.find(x=>x.id===id),
 mat:id=>state.materials.find(x=>x.id===id),
 v190SeqYear:()=> '2026/27',
 v202Grade:()=>9,
 v182IsHeld:l=>l.status==='done',
 v182IsCanceled:()=>false,v201UnitSkipped:u=>!!u.skippedThisYearV201,
 v190CalendarRanges:()=>[],
 catalogCourseV17:()=>null,
 catalogAvailableV17:()=>false,
 catalogArchiveRecordV17:()=>null,catalogEntryFileV17:async()=>null,
 v182RelevantMaterials:l=>(l.materials||[]).map(id=>({id})),
 concretePlanningPromptV12:()=> 'Basis-Prompt',
 v184Prompt:()=> 'Original Reihenprompt',
 v184Normalize:x=>x,
 v184Decision:()=>({item:{}}),
 v184Apply:async()=>({qid:q.id}),
 v184Flow:{sequenceId:q.id,pkg:null},
 sequencePanel:()=>'<div class="detail-stack"><section class="detail-section v312-direct-section" data-v312-direct>'+
  '<div class="v312-head">Sortieren</div></section></div>',
 modalHtml:()=>'<div>Legacy</div>',wire:()=>{},
 render:()=>{},
 saveState:async()=>{saves++;if(fail)throw Error('IndexedDB failed');},
 hasStoredFile:v=>!!v.fileKey,
 fileStoreGet:async key=>({blob:new Blob(['original '+key]),name:key}),
 downloadBlob:(n,b)=>downloads.push({n,b}),
 esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
 uid:p=>p+'-123',alert:()=>{}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-teilreihenplanung-v313.js'),'utf8'),ctx);
const api=ctx.window.SchulcockpitPartialReplanV313;
assert(api);
assert.match(ctx.sequencePanel(q),/Nur den Rest der Reihe neu planen/);
assert.equal(api.held(q,q.plan[0]),true);
assert.equal(api.held(q,q.plan[2]),false);
api.open(q.id);
flow=api.getFlow();
assert.equal(flow.delivery.title,'Trauerglas');
assert.equal(flow.delivery.deadline,'2026-12-08');
assert.equal(flow.delivery.type,'Kreative Ersatzleistung');
assert.equal(ctx.modal.type,'v313PartialReplan');
assert.match(ctx.modalHtml(),/ZIP mit Ist-Unterricht/);
(async()=>{
 await api.exportZip();
 assert.equal(downloads.length,1);
 assert.match(downloads[0].n,/\.zip$/);
 for(const name of ['00_START_HIER.md','01_CHATGPT_PROMPT.md',
  '02_IST_UND_SOLL.json','03_MATERIALMANIFEST.json','04_LEISTUNGSABGABE.json'])
  assert(zipFiles.has(name),'ZIP missing '+name);
 assert([...zipFiles.keys()].some(x=>/originale\/s_rubric/.test(x)));
 assert([...zipFiles.keys()].some(x=>/originale\/m_oldmat/.test(x)));
 const manifest=JSON.parse(zipFiles.get('03_MATERIALMANIFEST.json'));
 assert(manifest.materials.some(m=>m.name.includes('Trauerglas')&&m.teacherOnly));
 assert.equal(flow.ctx.heldUnits.length,2);
 assert.equal(flow.ctx.openUnits.length,2);
 assert.equal(flow.ctx.heldUnits[0].actual[0].status,'done');
 assert(flow.ctx.openUnits[0].previouslyPrepared[0].materialUsed.some(x=>x.id==='oldmat'));
 const pp=zipFiles.get('01_CHATGPT_PROMPT.md');
 assert.match(pp,/08|2026-12-08/);
 assert.match(pp,/Bewertungskriterien/);
 assert.match(pp,/offenen Rest/i);
 assert.equal(flow.step,'import');
 const response={schema:C.SCHEMA,courseId:'r9',sequenceId:q.id,
  deliverable:{title:'Trauerglas',deadline:'2026-12-08',
   type:'Kreative Ersatzleistung',description:flow.delivery.description},
  materialAudit:flow.ctx.materials.map(m=>({
   ref:m.ref,verdict:m.teacherOnly?'teacher_only':'unsuitable',
   reason:m.teacherOnly?'Nur Lehrkraft':'Nicht sinnvoll für Lernende',
   suggestedUse:''})),
  units:flow.ctx.openUnits.map(u=>({
   unitId:u.id,plannedDate:u.plannedDate,
   title:u.id==='after'?'Neue Reflexion über Abschied':'Trauerglas abgeben und reflektieren',
   content:u.id==='after'?'Quellenvergleich und begründete Positionen':'Trauerglas abgeben, Ergebnisse sichten',
   objective:'Eigene begründete Position mit Quellen',
   notes:'Erprobte Diskussion',studentMaterialRefs:[],bookTasks:[],
   needsNewWorksheet:u.id==='after',
   worksheetBrief:u.id==='after'?'Neues AB mit Quellen, AFB I–III, Differenzierung und Bearbeitungszeit':'',
   additionalPreparation:'Textauswahl',teachingReason:'Sinnvolle Vertiefung'}))
 };
 flow.parsed=C.validate(response,flow.ctx);
 flow.step='preview';
 assert.match(ctx.modalHtml(),/Neues AB ERSTELLEN/);
 const beforeHeld=structuredClone(state.lessons.filter(l=>l.status==='done'));
 const n=await api.apply();
 assert.equal(n,2);
 assert.deepEqual(state.lessons.filter(l=>l.status==='done'),beforeHeld,
  'held lessons never changed');
 assert.equal(q.plan[2].title,'Neue Reflexion über Abschied');
 assert.equal(q.plan[2].plannedDate,'2026-11-17');
 assert(q.plan[2].newWorksheetV313?.required);
 assert.match(q.plan[2].resourcesNeededV244,/Eigenes Arbeitsblatt/);
 assert.equal(q.plan[2].previousPartialReplanV313.length,1);
 assert.equal(q.plan[2].materialLinksV184.length,0);
 assert.equal(state.lessons.find(x=>x.id==='l-after').printPlan[0].needed,false,
  'unprinted obsolete copy tasks not active');
 assert.equal(state.lessons.find(x=>x.id==='l-after').materials[0],'oldmat',
  'historic material stays in original record');
 assert.equal(state.lessons.find(x=>x.id==='l-after').replanSuppressedMaterialIdsV313[0],'oldmat');
 assert.equal(ctx.v182RelevantMaterials(state.lessons.find(x=>x.id==='l-after')).length,0,
  'unfit old material not active');
 assert.equal(state.lessons.find(x=>x.id==='l-after').slides[0].title,'Alte Folie',
  'original slides retained for historical access');
 assert.equal(state.lessons.find(x=>x.id==='l-after').presentationReady,false);
 assert.match(ctx.concretePlanningPromptV12(state.lessons.find(x=>x.id==='l-after')),
  /Eigenes Arbeitsblatt ist NOCH NICHT erstellt/);
 assert.equal(q.partialReplanV313.deliverable.deadline,'2026-12-08');
 assert.match(ctx.sequencePanel(q),/neue Arbeitsblätter zu erstellen/);
 assert.match(ctx.sequencePanel(q),/data-v313-worksheet-ready/);
 assert.equal(state.sequences.length,1);
 api.open(q.id);const selected=api.getFlow();
 selected.selectedUnitIds=['deadline'];
 await api.exportZip();
 assert.deepEqual(selected.ctx.openUnits.map(u=>u.id),['deadline']);
 assert.deepEqual(selected.ctx.retainedUnits.map(u=>u.id),['after']);
 assert.match(zipFiles.get('01_CHATGPT_PROMPT.md'),/retainedUnits/);
 assert(saves>=1);
 console.log('V313 UI: original ZIP, two held hours, fixed 08 Dec hand-in, teacher-only rubric, unfit source retired, new worksheet required, safe prompt and historic files OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
