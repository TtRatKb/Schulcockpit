/* V0.27.8 regression: occupied Friday insert, exam exclusion, prepared
 * lesson data preservation, legacy shifted empty cards, and historical anchors. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../schulcockpit-flexplan-v278-core.js');
const dates=['2026-11-06','2026-11-20','2026-11-27','2026-12-04'];
const slots=dates.map((date,i)=>({date,slot:2,timetableId:'fri',period:'2. Block'}));
const slotId=core.slotId;
const target=slotId(slots[0]);
function unit(key,date,linked=true){return {key,title:key,date,slot:2,held:false,linked};}
{
 const units=[unit('new','2026-11-06',false),unit('luther','2026-11-06'),unit('next','2026-11-20')];
 const p=core.plan({slots,units,sourceKey:'new',targetId:target,action:'insert',today:'2026-11-02'});
 assert.deepEqual(p.moves.map(x=>[x.key,x.to]),[['luther','2026-11-20'],['next','2026-11-27']]);
 // The newly created source is already on Friday; it must not be copied twice.
 assert(!p.moves.some(x=>x.to==='2026-11-13'),'exam date must be excluded');
 assert(!p.moves.some(x=>x.repeatOf),'do not copy an already planned future unit');
}
{
 const p=core.plan({slots,units:[unit('ready','2026-11-20'),unit('target','2026-11-06'),unit('other','2026-11-27')],
  sourceKey:'ready',targetId:target,action:'insert',today:'2026-11-02'});
 assert.deepEqual(p.moves.map(x=>[x.key,x.to]),[['ready','2026-11-06'],['target','2026-11-20']]);
}
{
 const p=core.plan({slots,units:[unit('ready','2026-11-20'),unit('target','2026-11-06')],
  sourceKey:'ready',targetId:target,action:'swap',today:'2026-11-02'});
 assert.equal(p.moves.length,2);assert.equal(p.moves[0].to,'2026-11-06');
 assert.equal(p.moves[1].to,'2026-11-20');
}
assert.throws(()=>core.plan({slots,units:[unit('new',''),unit('target','2026-11-06')],
 sourceKey:'new',targetId:target,action:'insert',today:'2026-11-02',blockedIds:[target]}),/durchgeführt/);
assert.throws(()=>core.plan({slots:slots.slice(0,2),units:[unit('new',''),unit('target','2026-11-06'),unit('third','2026-11-20')],
 sourceKey:'new',targetId:target,action:'insert',today:'2026-11-02'}),/nicht genügend/);
{
 const p=core.plan({slots,units:[unit('held','2026-10-30')],sourceKey:'held',
  targetId:target,action:'continue',today:'2026-11-02'});
 assert.equal(p.moves[0].repeatOf,'held');
 assert.equal(p.moves[0].to,'2026-11-06');
}
const course='religion7';
const q={id:'q',classId:course,title:'Luther',plan:[
 {id:'past',title:'Vorherige Stunde',plannedDate:'2026-10-30'},
 {id:'new',title:'Klassenarbeit vorbereiten',plannedDate:'2026-11-06'},
 {id:'next',title:'Luther gegen Papst',plannedDate:'2026-11-06'},
 {id:'later',title:'Reformation und Kirche',plannedDate:'2026-11-20'}]};
const prev={id:'previous',classId:course,date:'2026-10-30',status:'done',title:'Luthers Entdeckung',
 planReference:{unitId:'past'}};
const ready={id:'ready',classId:course,date:'2026-11-06',slot:2,timetableId:'fri',
 status:'open',title:'Luther gegen Papst',planReference:{unitId:'next',title:'Luther gegen Papst',autoMatched:true},
 phasePlan:[{title:'Einstieg'}],slides:[{title:'Impuls'}],materials:['material-1'],
 printPlan:[{materialId:'material-1',needed:true,count:27}],presentationBlobKeyV180:'ppt-key'};
const ghost={id:'ghost',classId:course,date:'2026-11-20',slot:2,timetableId:'fri',
 status:'open',title:'',v180MovedFrom:{id:'previous',date:'2026-10-30'},phasePlan:[],printPlan:[]};
const unrelated={id:'other',classId:'mathe5',date:'2026-11-06',status:'open',title:'Mathematik',printPlan:[{count:25}]};
const state={lessons:[prev,ready,ghost,unrelated],sequences:[q]};
let counter=0;
const ctx={
 console,structuredClone,Date,Intl,state,SC_HOURLY_V275:{plan:()=>{throw Error('old core should be replaced');}},
 v191LessonProtected:()=>true,
 iso:d=>{const x=d instanceof Date?d:new Date(d);return x.toISOString().slice(0,10);},
 v190PlanningYear:()=> '2026/27',
 v190NormYear:y=>y,
 v190PlanningSequences:cid=>state.sequences.filter(q=>q.classId===cid),
 v190CourseSlots:()=>slots,
 v201UnitSkipped:u=>!!u.skippedThisYearV201,
 v190YearFromDate:d=>d?.slice(0,4)==='2026'?'2026/27':'',
 lessonSlot:l=>l.slot||0,
 v182IsHeld:l=>l.status==='done',
 v182IsCanceled:l=>l.status==='cancelled',
 fmtDate:d=>d,
 render:()=>{},
 uid:(prefix)=>prefix+'-'+(++counter),
};
ctx.window=ctx;
ctx.v190RescheduleCourseYear=(cid)=>{
 // Minimal double of the existing scheduler's behavior after removing its
 // old "prepared lessons are fixed" guard. Assessment 2026-11-13 is absent.
 const units=state.sequences.find(q=>q.classId===cid).plan.filter(u=>u.plannedDate>='2026-11-02');
 units.forEach((u,i)=>u.plannedDate=slots[i].date);
 // The old attach-on-date behavior could attach the WRONG unit.
 const row=state.lessons.find(l=>l.id==='ready');
 row.title='WRONG NEXT TOPIC';row.planReference={unitId:'new'};
 return {changed:3,warning:''};
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-flexplan-v278-core.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-flexplan-v278.js'),'utf8'),ctx);
assert.equal(ctx.SC_HOURLY_V275.plan.name,'plan');
const result=ctx.v190RescheduleCourseYear(course);
assert.equal(result.changed,3);
const kept=state.lessons.find(l=>l.id==='ready');
assert.equal(kept.title,'Luther gegen Papst');
assert.equal(kept.date,'2026-11-20');
assert.equal(kept.presentationBlobKeyV180,'ppt-key');
assert.equal(kept.printPlan[0].count,27);
assert.equal(kept.phasePlan[0].title,'Einstieg');
assert.equal(kept.planReference.unitId,'next');
assert.equal(q.plan[1].plannedDate,'2026-11-06');
assert.equal(q.plan[2].plannedDate,'2026-11-20');
assert.equal(q.plan[3].plannedDate,'2026-11-27');
assert.equal(state.lessons.find(l=>l.id==='previous').date,'2026-10-30');
assert.equal(state.lessons.find(l=>l.id==='other').title,'Mathematik');
assert.equal(state.lessons.find(l=>l.id==='ghost').date,'');
const added=state.lessons.find(l=>l.planReference?.unitId==='new');
assert(added);assert.equal(added.date,'2026-11-06');
assert(!added.v180MovedFrom);
const allDateSlots=state.lessons.filter(l=>l.classId===course&&l.date>='2026-11-02')
 .map(l=>l.date+'|'+l.slot);
assert.equal(new Set(allDateSlots).size,allDateSlots.length,'no duplicate course slots');
console.log('V0.27.8: occupied exam-prep insertion, preserved materials and cascade tests passed');
