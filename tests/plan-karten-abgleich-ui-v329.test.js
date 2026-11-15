'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../schulcockpit-plan-karten-abgleich-v329-core.js');
const Trash=require('../schulcockpit-doppelkarten-bereinigen-v328-core.js');
const file=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
class Today extends Date{
 constructor(...args){super(...(args.length?args:['2026-11-15T12:00:00Z']));}
 static now(){return Date.parse('2026-11-15T12:00:00Z');}
}
const q={id:'q',classId:'r11',schoolYearV190:'2026/27',
 title:'Glaube und Naturwissenschaft',
 plan:[{id:'held',title:'Ohlig',plannedDate:'2026-11-04',plannedSlotV272:1},
 {id:'inserted',title:'Kreationismus + AFB III',plannedDate:'2026-11-11',plannedSlotV272:1},
 {id:'world',title:'Weltbilder im Rückblick',plannedDate:'2026-12-02',plannedSlotV272:1}]};
const state={settings:{schoolYear:'2026/27'},classes:[{id:'r11',subject:'Religion',name:'11'}],
 sequences:[q],lessons:[
 {id:'old-held',classId:'r11',date:'2026-11-04',slot:1,status:'done',planReference:{unitId:'held'}},
 {id:'oldworld',classId:'r11',date:'2026-11-11',slot:1,status:'open',
  title:'Weltbilder im Rückblick',planReference:{unitId:'world',title:'Weltbilder im Rückblick'},
  materials:['m'],slides:[{title:'Alte Folie'}]},
 {id:'double',classId:'r11',date:'2026-12-02',slot:1,status:'open',
  title:'Weltbilder im Rückblick',planReference:{unitId:'world'},materials:[],slides:[]}]};
const slots=['2026-11-04','2026-11-11','2026-12-02'].map(date=>({date,slot:1,timetableId:'weds',period:'1. Block'}));
let saves=0,renders=0,delegated=null;
const document={addEventListener:(type,cb)=>{if(type==='click')delegated=cb;},
 querySelector:()=>null,querySelectorAll:()=>[]};
const context={state,window:{},document,Date:Today,console,structuredClone,
 SC_PLAN_CARD_SYNC_V329:C,SC_DUPLICATE_CLEANUP_V328:Trash,
 v186Ready:true,view:'prep',modal:null,v182LessonId:'',
 v190PlanningYear:()=> '2026/27',
 v190PlanningSequences:()=>[q],v190CourseSlots:()=>slots,
 v190YearFromDate:()=> '2026/27',v190SeqYear:()=> '2026/27',
 activeMonday:()=>new Today('2026-11-09T12:00:00Z'),activeWeekEnd:()=> '2026-11-13',
 iso:date=>date.toISOString().slice(0,10),fmtDate:x=>x,esc:String,
 cls:id=>state.classes.find(c=>c.id===id),
 lesson:id=>state.lessons.find(l=>l.id===id),
 viewHtml:()=>'<div class="content-grid"><p>Alter Montagsmodus</p></div>',
 sequencePanel:()=>'<div class="detail-stack"><p>Alte Reihenansicht</p></div>',
 modalHtml:()=>'<div>Vorheriger Dialog</div>',
 v190RescheduleCourseYear:()=>({changed:0,warning:''}),
 saveState:async()=>{saves++;},
 render:()=>{renders++;},
 alert:x=>{throw Error('Unexpected alert: '+x)}
};
vm.createContext(context);
vm.runInContext(file('schulcockpit-plan-karten-abgleich-v329.js'),context);
assert.match(context.viewHtml(),/data-v329-preview="r11"/,
 'Monday mode must show mismatched lesson cards visibly');
assert.match(context.sequencePanel(q),/data-v329-preview="r11"/);
context.modal={type:'planCardSyncV329',cid:'r11',year:'2026/27'};
const html=context.modalHtml();
assert.match(html,/Diese 3 Änderungen übernehmen/);
assert.match(html,/Weltbilder im Rückblick/);
assert.match(html,/Kreationismus/);
(async()=>{
 await context.window.SchulcockpitPlanCardSyncV329.apply('r11','2026/27');
 assert.equal(saves,1,'all moved cards are saved in one transaction');
 assert.equal(state.lessons.find(l=>l.id==='oldworld').date,'2026-12-02');
 assert.equal(state.lessons.find(l=>l.id==='double').date,'');
 assert.equal(state.lessons.find(l=>l.planReference?.unitId==='inserted').date,'2026-11-11');
 assert.equal(state.lessons.find(l=>l.id==='old-held').date,'2026-11-04');
 assert(!context.viewHtml().includes('data-v329-preview="r11"'),
  'after repair Monday shows no obsolete schedule warning');
 assert(delegated,'delegated click handler survives replacements of the modal');
 const open={dataset:{v329Open:'oldworld'}};
 let prevented=false;
 delegated({target:{closest:selector=>selector==='[data-v329-open]'?open:null},
  preventDefault:()=>{prevented=true;},stopImmediatePropagation:()=>{}});
 assert(prevented);
 assert.equal(context.view,'lessonDayV182');
 assert.equal(context.v182LessonId,'oldworld');
 // Real V312 renderer must expose both the correct and the parked extra card.
 const d={addEventListener:()=>{},querySelector:()=>null};
 const s={state,window:{SchulcockpitSequenceDragV311:{
  getDraft:()=>null,preview:(_q,ids)=>({rows:ids.map(id=>{
   const u=q.plan.find(x=>x.id===id);
   return {id,date:u.plannedDate};
  })})}},document:d,
  modal:{type:'sequence',id:q.id},seq:id=>q,render:()=>{},
  statusMeta:{open:['Offen']},v182IsHeld:l=>l.status==='done',
  v182IsCanceled:()=>false,v201UnitSkipped:()=>false,
  fmtDate:x=>x,esc:String};
 s.sequencePanel=()=>'<div class="detail-stack"><section class="detail-section">'+
   '<div class="linked-lessons"></div></section></div>';
 vm.createContext(s);
 vm.runInContext(file('schulcockpit-direct-reihen-drag-v312.js'),s);
 const v=s.sequencePanel(q);
 assert.match(v,/Stundenkarten ansehen \(2\)/);
 assert.match(v,/data-v329-open="oldworld"/);
 assert.match(v,/data-v329-open="double"/,
  'a parked extra card can be opened from the sequence view');
 console.log('V329 UI: Monday banner and preview, transactional repair, stable lesson click, parked duplicate linked and accessible OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
