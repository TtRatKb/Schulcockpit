/* V0.33.28 – inserting a teacher-created hour must not be blocked by an
 * unrelated duplicate prepared card, and must not lose either lesson draft. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const Sync=require('../schulcockpit-plan-karten-abgleich-v329-core.js');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'schulcockpit-flexplan-v278.js'),'utf8');
const dates=['2026-11-24','2026-12-01','2026-12-08','2026-12-15'];
const slots=dates.map(date=>({date,slot:2,timetableId:'tuesday',period:'2. Block'}));
const q={id:'sequence',classId:'religion8',title:'Reihe',plan:[
 {id:'new',title:'Neue Idee von Kollegin',plannedDate:dates[0]},
 {id:'topic-a',title:'Vorbereitete Stunde',plannedDate:dates[0]},
 {id:'topic-b',title:'Weiteres Thema',plannedDate:dates[1]}
]};
function card(id,unitId,date,title,slide){
 return {id,classId:'religion8',date,slot:2,timetableId:'tuesday',
  status:'open',title,planReference:{unitId,title,plannedDate:date},
  slides:[{title:slide}],materials:['material-'+id],
  printPlan:[{materialId:'material-'+id,count:27,alreadyPrinted:true}],
  presentationReady:true,presentationBlobKeyV180:'ppt-'+id};
}
const state={settings:{schoolYear:'2026/27'},sequences:[q],lessons:[
 card('canonical','topic-a',dates[0],'Vorbereitete Stunde','Beamerfolie'),
 card('duplicate','topic-a',dates[0],'Alternative Ausarbeitung','Alternative Folie'),
 card('following','topic-b',dates[1],'Weiteres Thema','Folgestunde'),
 {id:'history',classId:'religion8',date:'2026-11-17',slot:2,status:'done',
  title:'Bereits gehalten',planReference:{unitId:'historical'}}
]};
const original=structuredClone(state.lessons);
class FixtureDate extends Date{
 constructor(...args){super(...(args.length?args:['2026-11-23T12:00:00Z']));}
 static now(){return Date.parse('2026-11-23T12:00:00Z');}
}
let idCounter=0;
const context={state,window:{},console,structuredClone,Date:FixtureDate,
 SC_HOURLY_V275:{},SC_HOURLY_V278:{plan:()=>{}},
 v191LessonProtected:()=>false,
 iso:d=>d.toISOString().slice(0,10),v190PlanningYear:()=> '2026/27',
 v190NormYear:y=>y,v190PlanningSequences:()=>[q],v190CourseSlots:()=>slots,
 v201UnitSkipped:()=>false,lessonSlot:l=>l.slot||0,
 v182IsHeld:l=>l.status==='done',v182IsCanceled:l=>l.status==='cancelled',
 fmtDate:x=>x,render:()=>{},uid:p=>p+'-'+(++idCounter)};
context.v190RescheduleCourseYear=()=>{
 // The older scheduler knows actual school/assessment dates but briefly
 // places topics on the wrong card; the flexible mover must restore the bytes.
 q.plan.forEach((u,i)=>u.plannedDate=slots[i].date);
 state.lessons[0].title='WRONG AUTO-MATCH';
 return {changed:3,warning:''};
};
vm.createContext(context);
vm.runInContext(source,context);
const result=context.v190RescheduleCourseYear('religion8','2026/27',true,{
 insertedUnitId:'new',insertedDate:dates[0]});
const l=id=>state.lessons.find(x=>x.id===id);
assert.equal(state.lessons.find(x=>x.planReference?.unitId==='new').date,dates[0],
 'new independent idea gets the requested actual course date');
assert.equal(l('canonical').date,dates[1],'prepared future card is shifted');
assert.equal(l('canonical').title,'Vorbereitete Stunde','temporary auto-match undone');
assert.deepEqual(l('canonical').slides,original[0].slides);
assert.deepEqual(l('canonical').printPlan,original[0].printPlan);
assert.equal(l('canonical').presentationBlobKeyV180,'ppt-canonical');
assert.equal(l('following').date,dates[2],'following open topic shifts again');
assert.equal(l('history').date,'2026-11-17','held lesson remains historical');
assert.equal(l('duplicate').date,'','additional prepared card parks without deletion');
assert.equal(l('duplicate').scheduleParkedV275.planDuplicateDraftV3328,true);
assert.equal(l('duplicate').scheduleParkedV275.previousDate,dates[0]);
assert.deepEqual(l('duplicate').slides,original[1].slides);
assert.deepEqual(l('duplicate').materials,original[1].materials);
assert.deepEqual(l('duplicate').printPlan,original[1].printPlan);
assert.equal(l('duplicate').presentationBlobKeyV180,'ppt-duplicate');
assert.match(result.warning,/Stundenkarten ansehen/,'teacher sees where to find it');
const finalSlots=state.lessons.filter(l=>l.classId==='religion8'&&l.date>=dates[0])
 .map(l=>l.date+'|'+l.slot);
assert.equal(new Set(finalSlots).size,finalSlots.length,'no double physical slots');
const proposal=Sync.propose({state,classId:'religion8',sequences:[q],slots,
 today:'2026-11-23'});
assert.deepEqual(proposal.issues,[],'later reconciliation remains possible');
assert.equal(proposal.lessons.find(l=>l.id==='duplicate').date,'',
 'canonical card cannot be replaced by the more elaborate parked draft');
assert.equal(proposal.changed,0,'subsequent sync does not undo successful insertion');
console.log('V0.33.28: free insertion, prepared duplicates retained, PPT/material continuity, history and idempotent reconciliation OK');
