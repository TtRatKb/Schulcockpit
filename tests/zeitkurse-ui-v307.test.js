'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const C=require('../schulcockpit-zeitkurse-v307-core.js');
const permanent=[{id:'tt-math-5',classId:'class-math-5',weekday:1,slot:2,period:'3. Stunde'}];
const one={id:'lesson-math-5',classId:'class-math-5',date:'2026-11-09',slot:2,
 source:'timetable',title:'Halbschriftliche Division',status:'open',printPlan:[]};
const g={id:'temp-9',title:'Elternzeitvertretung',subject:'Mathematik',grade:'9b',sessions:[],
 temporaryV307:C.config({startDate:'2026-11-09',endDate:'2026-12-06',
  slots:[{weekday:1,slot:2},{weekday:4,slot:4}],examDate:'2026-11-26',
  topic:'Lineare Funktionen',
  workMode:'Kurzer Einstieg, die Klasse löst eigenständig Aufgaben.',
  courseMaterials:['m:work-9','c:archive-9']})};
const legacy={id:'old-short',type:'temporary',title:'Alte Kurznotizen',subject:'Religion',
 grade:'7',sessions:[{date:'2026-11-10',topic:'Material wiederholen',independent:'Text lesen'}]};
const state={settings:{schoolYear:'2026/27',activeWeekStart:'2026-11-09',
 periods:['1. Stunde','2. Stunde','3. Stunde','4. Stunde','5. Stunde']},
 classes:[{id:'class-math-5',subject:'Mathematik',name:'5f',students:25}],
 timetable:structuredClone(permanent),lessons:[one],quickTeachingV304:[g,legacy],
 materials:[{id:'work-9',title:'Lineare Funktionen Übungsblatt.pdf',resourceType:'print',
 hubV237:{subject:'Mathematik',grade:9,kind:'arbeitsblatt'},
 variants:[{id:'standard',type:'standard',fileName:'Lineare Funktionen Übungsblatt.pdf',fileKey:'test'}]}],
 materialCatalog:[{catalogId:'archive-9',fileName:'Mathematik 9 Funktionen.pdf',
 hubV237:{subject:'Mathematik',grade:9,kind:'arbeitsblatt'},localFileKey:'fake'}]};
let saves=0,renders=0;
const ctx={
 state,SC_TEMP_COURSE_V307:C,view:'quickTeachingV304',modal:null,window:{},
 document:{querySelector:()=>null,querySelectorAll:()=>[]},navigator:{clipboard:{writeText:async()=>{}}},
 Date,structuredClone,console,
 uid:p=>p+'-unique',esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
 hasStoredFile:()=>true,catalogAvailableV17:()=>true,
 cls:id=>state.classes.find(c=>c.id===id),
 lesson:id=>state.lessons.find(l=>l.id===id),
 mat:id=>state.materials.find(m=>m.id===id),
 variant:(mid,vid)=>state.materials.find(x=>x.id===mid)?.variants.find(v=>v.id===vid),
 currentWeekLessons:()=>state.lessons.filter(l=>l.date>='2026-11-09'&&l.date<='2026-11-13'),
 activeMonday:()=>new Date(state.settings.activeWeekStart+'T12:00:00'),
 iso:d=>d.toISOString().slice(0,10),
 mondayOf:d=>{const x=new Date(d),n=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()-n+1);return x;},
 v190NoSchoolInfo:()=>null,
 v182IsHeld:l=>l?.status==='done',v182IsCanceled:()=>false,
 v182WeekCard:l=>'<article><div class="v182-week-meta">'+l.title+'</div></article>',
 v182RelevantMaterials:l=>(l.materials||[]).map(id=>{
  const m=state.materials.find(m=>m.id===id);return {id,title:m.title,material:m,variants:m.variants};
 }),
 timetableView:()=>'<div class="content-grid"><section class="panel"><h2>Permanent</h2></section></div>',
 resourceBundleV176:(l,h,create)=>{
  l.resourceBundlesV176=l.resourceBundlesV176||{};
  if(create&&!l.resourceBundlesV176[h])l.resourceBundlesV176[h]={items:[]};
  return l.resourceBundlesV176[h];
 },
 setResourceTypeV14:(l,h,t)=>{l.resourceOverrides=l.resourceOverrides||{};l.resourceOverrides[h]=t;},
 resourceKeyV14:s=>s,
 workflowTasks:()=>[],workflowTasksV11:()=>[],
 pageTitle:()=>'other',viewHtml:()=>'base',wire:()=>{},render:()=>{renders++;},
 saveState:()=>{saves++;},
 alert:s=>{throw Error(s)},confirm:()=>true,downloadText:()=>{}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-zeitkurse-v307.js'),'utf8'),ctx);
const api=ctx.window.SchulcockpitTemporaryCoursesV307;
assert(api);
const timetableBefore=JSON.stringify(state.timetable),classesBefore=JSON.stringify(state.classes);
const total=api.sync(g,{start:'2026-11-09',end:'2026-12-06'});
assert.equal(total,8,'two temporary weekly meetings appear in four weeks');
assert.equal(state.timetable.length,1);
assert.equal(JSON.stringify(state.timetable),timetableBefore,'permanent timetable immutable');
assert.equal(JSON.stringify(state.classes),classesBefore,'no permanent class record created');
assert.equal(ctx.cls(C.courseId(g.id)).name,'9b');
const monday=ctx.currentWeekLessons();
assert.equal(monday.length,3,'permanent Monday plus temporary Monday/Thursday in the selected week');
assert.equal(monday.filter(l=>l.temporaryV307).length,2);
const temp=state.lessons.find(l=>l.id===C.lessonId(g.id,'2026-11-09',2));
assert(temp&&temp.source==='manual');
assert.deepEqual(temp.materials,[]);
const exam=state.lessons.find(l=>l.id===C.lessonId(g.id,'2026-11-26',4));
assert(exam?.quickExamV307&&exam?.title.includes('Klassenarbeit'));
const m=api.materialOptions(g);
assert(m.some(x=>x.ref==='m:work-9'));
assert(m.some(x=>x.ref==='c:archive-9'));
api.addRef(temp,'m:work-9');
assert.deepEqual(Array.from(temp.materials),['work-9']);
assert.equal(temp.printPlan.length,0,'Hub resource link is NOT a copy job');
assert.equal(temp.resourceOverrides['Lineare Funktionen Übungsblatt.pdf'],'reference');
api.addRef(temp,'c:archive-9');
assert(ctx.v182RelevantMaterials(temp).some(m=>m.id==='catalog:archive-9'));
assert.equal(temp.quickMaterialRefsV307.length,2);
assert.match(ctx.viewHtml(),/Material aus dem vorhandenen Hub/);
assert.match(ctx.viewHtml(),/Klausurtermin/);
assert.match(ctx.timetableView(),/Befristete Stundenplan-Ergänzungen/);
assert.match(ctx.v182WeekCard(temp),/BEFRISTET · UNTERRICHTSÜBERNAHME/);
api.removeRef(temp,'m:work-9');
assert.equal(temp.materials.length,0);
assert.equal(temp.quickMaterialRefsV307.length,1);
api.addRef(temp,'m:work-9');
temp.status='done';temp.title='Eigene Durchführung gespeichert';
g.temporaryV307={...g.temporaryV307,endDate:'2026-12-20'};
const extra=api.sync(g,{start:'2026-12-07',end:'2026-12-20'});
assert.equal(extra,4,'two more weeks add four appointments');
assert.equal(temp.title,'Eigene Durchführung gespeichert');
assert.equal(temp.status,'done');
assert.equal(state.lessons.length,1+12,'no duplicate generated lesson objects');
assert.equal(legacy.sessions[0].topic,'Material wiederholen','earlier V304 notes preserved');
assert.equal(state.timetable.length,1);
assert(saves>0);
console.log('Temporary class UI: normal week + shadow timetable, unchanged permanent classes, Material Hub including catalog, unique lesson IDs, held lessons preserved on extension.');
