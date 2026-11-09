'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),
 fs=require('node:fs'),path=require('node:path');
const C=require('../schulcockpit-reihen-drag-v311-core.js');
const dates=['2026-10-27','2026-11-10','2026-11-17','2026-11-24',
 '2026-12-08','2026-12-15','2027-01-12','2027-01-19'];
let q={id:'religion9-q',classId:'religion9',title:'Tod und Trauer',
 schoolYearV190:'2026/27',startDate:dates[0],endDate:dates.at(-1),
 plan:['held','end-of-life','afterlife','farewell','comfort','memory','ethics','review']
 .map((id,i)=>({id,title:id,plannedDate:dates[i],plannedSlotV272:2,
  material:id==='ethics'?'Sterbehilfe-Material':'',
  competencyIdsV202:id==='ethics'?['ethics']:[]}))};
const lessons=q.plan.map((u,i)=>({
 id:'lesson-'+u.id,classId:'religion9',sequenceId:q.id,unit:q.title,
 date:dates[i],slot:2,timetableId:'tt-r9',period:'3. Stunde',
 title:u.title,objective:'Original '+u.title,
 planReference:{...(i===0?{}:{unitId:u.id}),title:u.title,plannedDate:dates[i],autoMatched:false,
  material:i===6?'MANUELL: AH S. 42 Nr. 2–5':'',notes:i===6?'Kursbesonderheit':''},
 status:i===0?'done':'open',source:'timetable',kind:'course',
 phasePlan:i===6?[{title:'Ethik-Fallanalyse',minutes:30}]:[],
 slides:i===6?[{type:'text',title:'Moralische Positionen'}]:[],
 printPlan:i===6?[{materialId:'m1',alreadyPrinted:true,needed:true}]:[],
 prepTasks:[],materials:i===6?['m1']:[],
 presentationReady:i===6,presentationSourceV177:i===6?'generated':'',
 presentationBlobKeyV180:i===6?'ppt-ethics':undefined
}));
const state={settings:{schoolYear:'2026/27'},sequences:[q],
 lessons,materials:[{id:'m1',title:'Sterbehilfe-Material'}],
 timetable:[{id:'tt-r9',classId:'religion9',weekday:2,slot:2,period:'3. Stunde'}]};
let saves=0,renders=0,failed=false,alerts=[];
const doc={querySelectorAll:()=>[],querySelector:()=>null};
const context={
 state,window:{},document:doc,modal:{type:'sequence',id:q.id},
 seq:id=>state.sequences.find(x=>x.id===id),
 lesson:id=>state.lessons.find(x=>x.id===id),
 SC_SEQUENCE_DRAG_V311:C,Date,console,structuredClone,
 v182IsHeld:l=>l?.status==='done',
 v182IsCanceled:l=>l?.executionV180?.type==='cancelled',
 v201UnitSkipped:u=>!!u?.skippedThisYearV201,
 v190CourseSlots:()=>dates.map(d=>({date:d,slot:2,period:'3. Stunde',timetableId:'tt-r9'})),
 v190SeqYear:()=> '2026/27',
 lessonSlot:l=>l.slot,
 iso:d=>d.toISOString().slice(0,10),
 fmtDate:s=>s,
 esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
 planUnitCardV10:(q,u,i)=>'<article class="sequence-plan-unit "><div class="sequence-plan-date"><span>'+
  u.plannedDate+'</span><strong>'+(i+1)+'</strong></div><div class="sequence-plan-copy"><h4>'+
  u.title+'</h4></div><button class="secondary" data-use-plan-unit="'+q.id+'|'+u.id+'">Planen</button></article>',
 sequencePanel:()=>'<div class="detail-stack"><section><div class="sequence-plan-list">'+
  '</div></section><section class="detail-section v182-plan-edit v201-plan-edit">'+
  'old arrows</section></div>',
 v182PptAction:()=>'<small>Präsentation hinterlegt</small>',
 generateMomijiPptV13:async()=>{},
 saveState:()=>{saves++;if(failed)throw Error('IndexedDB-Speicherung fehlgeschlagen');},
 render:()=>{renders++;},wire:()=>{},alert:m=>alerts.push(m)
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-reihen-drag-v311.js'),'utf8'),context);
const api=context.window.SchulcockpitSequenceDragV311;
assert(api);
const beforeOrder=q.plan.map(u=>u.id);
const visible=context.sequencePanel(q);
assert.match(visible,/data-v311-handle="ethics"/);
assert.match(visible,/data-v311-row="ethics"/);
assert.match(visible,/data-v311-save/);
assert.match(visible,/data-v311-list="summary"/);
assert.match(visible,/data-v311-list="editor"/);
assert(!visible.includes('data-v201-unit-move'),'broken arrows replaced by drag grips');
assert(!visible.includes('data-v311-handle="held"'),'completed lesson cannot be dragged');
assert(!lessons[0].planReference.unitId,'legacy held record deliberately lacks unitId');
api.move(q.id,'ethics','afterlife',false);
assert(api.getDraft(),'drag stages the order');
assert.deepEqual(q.plan.map(u=>u.id),beforeOrder,'state untouched before explicit save');
assert.equal(lessons.find(x=>x.id==='lesson-ethics').date,'2027-01-12');
(async()=>{
 const count=await api.commit(q);
 assert(count>=1);
 assert.equal(saves,1,'save once after commit');
 assert(renders>=1);
 assert.equal(q.plan[2].id,'ethics');
 assert.equal(q.plan[2].plannedDate,'2026-11-17');
 assert.equal(q.plan[0].id,'held');
 assert.equal(state.lessons.find(x=>x.id==='lesson-held').date,'2026-10-27');
 const moved=state.lessons.find(x=>x.id==='lesson-ethics');
 assert.equal(moved.date,'2026-11-17');
 assert.equal(moved.planReference.unitId,'ethics');
 assert.equal(moved.planReference.plannedDate,'2026-11-17');
 assert.equal(moved.planReference.material,'MANUELL: AH S. 42 Nr. 2–5');
 assert.equal(moved.planReference.notes,'Kursbesonderheit');
 assert.equal(q.startDate,dates[0]);
 assert.equal(q.endDate,dates.at(-1));
 assert.deepEqual(moved.materials,['m1']);
 assert.equal(moved.printPlan[0].alreadyPrinted,true);
 assert.equal(moved.slides[0].title,'Moralische Positionen');
 assert.equal(moved.phasePlan[0].title,'Ethik-Fallanalyse');
 assert.equal(moved.presentationBlobKeyV180,'ppt-ethics','original retained');
 assert.equal(moved.presentationReady,false,'dated PPT must be re-generated');
 assert.equal(moved.pptNeedsDateRefreshV311.oldDate,'2027-01-12');
 assert.match(context.v182PptAction(moved),/PowerPoint für neuen Termin/);
 const pastOpen=state.lessons.find(x=>x.id==='lesson-end-of-life');
 assert.equal(pastOpen.date,'2026-11-10');
 assert.match(context.sequencePanel(q),/Reihenfolge gespeichert/);
 // Other courses and fixed assessments are untouched.
 assert.equal(state.timetable.length,1);
 assert.equal(state.materials[0].id,'m1');
 assert.equal(q.plan.find(x=>x.id==='ethics').competencyIdsV202[0],'ethics');
 // Fail safely on a source collision with a prepared, unlinked week lesson.
 state.lessons.push({
  id:'unrelated-prepared',classId:q.classId,date:'2026-11-17',slot:2,
  title:'Unterricht eines anderen Plans',status:'open',
  phasePlan:[{title:'Persönliche Notizen'}],materials:[],printPlan:[],slides:[]
 });
 const intact=q.plan.map(u=>[u.id,u.plannedDate]);
 api.move(q.id,'review','ethics',false);
 await assert.rejects(()=>api.commit(q),/bereits mit/);
 assert.deepEqual(q.plan.map(u=>[u.id,u.plannedDate]),intact);
 state.lessons.pop(); // remove only synthetic conflicting fixture
 state.lessons.push({id:'empty-week-card',classId:q.classId,
  date:'2026-11-17',slot:2,status:'open',source:'timetable',
  title:'Thema noch festlegen',materials:[],printPlan:[],slides:[],phasePlan:[],prepTasks:[]});
 const originalCount=state.lessons.length;
 const emptyDate=state.lessons.find(l=>l.id==='empty-week-card').date;
 await api.commit(q);
 assert.equal(state.lessons.length,originalCount,'nothing deleted, even the empty timetable card');
 assert.equal(state.lessons.find(l=>l.id==='empty-week-card').date,emptyDate,
  'a blank unrelated card is never parked by emptying its date');
 assert.equal(q.startDate,dates[0]);
 assert.equal(q.endDate,dates.at(-1));
 state.lessons.pop(); // remove the synthetic blank after checking preservation
 // Failed IndexedDB write restores exact untouched plan and lesson data.
 api.move(q.id,'memory','ethics',false);
 const originalState=structuredClone(state);
 failed=true;
 await assert.rejects(()=>api.commit(q),/IndexedDB/);
 failed=false;
 assert.deepEqual(state.sequences,originalState.sequences);
 assert.deepEqual(state.lessons,originalState.lessons);
 console.log('V311 UI and data flow: stage/save, actual held lock, original materials, linked lesson moved, stale PPT refreshed, collisions and rollback OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
