const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'schulcockpit-nachruecken-v263.js'),'utf8');
const start=app.indexOf('v190RescheduleCourseYear=function(',app.indexOf('// V0.19.1-Terminierer'));
const end=app.indexOf('\nasync function v201SetUnitSkipped',start);
if(start<0||end<0)throw Error('Final reschedule implementation not found');
function setup(){
  const state={settings:{schoolYear:'2026/27'},classes:[{id:'m',subject:'Mathematik',name:'5f'}],
    timetable:[{id:'t',classId:'m',weekday:1,slot:1}],schoolCalendarsV190:{},assessments:[],lessons:[],
    sequences:[{id:'q',classId:'m',schoolYearV190:'2026/27',title:'Rechnen',orderV190:0,
      plan:[{id:'p',title:'Vergangen',plannedDate:'2026-10-23'},
        {id:'a',title:'Addition',plannedDate:'2026-10-29'},
        {id:'b',title:'Subtraktion',plannedDate:'2026-10-30'},
        {id:'c',title:'Multiplikation',plannedDate:'2026-11-02'}]}]};
  const slots=['2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-11-02'].map(date=>({date,slot:1,timetableId:'t'}));
  let saves=0;
  const c={state,window:{},view:'school-calendar',v190CalendarDraft:{year:'2026/27'},modal:null,
    viewHtml:()=>'<main>Kalender</main>',modalHtml:()=>'',wire:()=>{},render:()=>{},
    pageTitle:()=>'',structuredClone,alert:()=>{},
    document:{querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null},
    iso:()=> '2026-10-24',fmtDate:x=>x,esc:x=>String(x),
    v190NormYear:x=>x,v190YearFromDate:()=> '2026/27',
    v190PlanningSequences:(id,y)=>c.state.sequences.filter(q=>q.classId===id&&q.schoolYearV190===y),
    v190CourseSlots:()=>slots,
    lessonSlot:l=>l.slot||1,
    v191SlotIndex:(all,date)=>all.findIndex(s=>s.date===date),
    v201ActiveUnits:q=>q.plan.filter(u=>!u.skippedThisYearV201),
    v201UnitSkipped:u=>!!u.skippedThisYearV201,
    v191LessonProtected:l=>!!(l.held||l.ready),
    v191ClearAutoLesson:l=>{l.planReference=null;},
    attachExactPlanV11:()=>{},
    seq:id=>c.state.sequences.find(q=>q.id===id),
    saveState:()=>{saves++;},
  };
  vm.runInNewContext('var v190RescheduleCourseYear;'+app.slice(start,end),c);
  vm.runInNewContext(ui,c);
  return {c,api:c.window.SchulcockpitNachrueckenV263,get saves(){return saves;}};
}
test('preview advances future topics into newly freed dates, never the past',()=>{
  const {c,api}=setup(),before=JSON.stringify(c.state);
  const p=api.calculate('2026/27','m');
  assert.equal(JSON.stringify(c.state),before,'preview must not mutate real data');
  assert.deepEqual(Array.from(p.changes.map(x=>[x.title,x.before,x.after])),[
    ['Addition','2026-10-29','2026-10-26'],
    ['Subtraktion','2026-10-30','2026-10-27'],
    ['Multiplikation','2026-11-02','2026-10-28']]);
  assert.equal(p.sequences[0].plan[0].plannedDate,'2026-10-23');
  assert.equal(c.v190CourseSlots('m','2026/27').length,7,'temporary course slot filter restored');
});
test('prepared lessons remain at their fixed date while other topics may move',()=>{
  const {c,api}=setup();
  c.state.lessons.push({id:'l',classId:'m',date:'2026-10-30',ready:true,planReference:{unitId:'b'}});
  const p=api.calculate('2026/27','m');
  assert.equal(p.sequences[0].plan[2].plannedDate,'2026-10-30');
  assert.equal(p.lessons.find(x=>x.id==='l').date,'2026-10-30');
});
test('apply only after preview, persists exactly the reviewed dates',async()=>{
  const h=setup();
  h.api.open();
  assert.equal(h.saves,0);
  assert.equal(h.c.modal.type,'rescheduleV263');
  assert.match(h.c.modalHtml(),/Änderungen übernehmen/);
  await h.api.apply();
  assert.equal(h.saves,1);
  assert.equal(h.c.state.sequences[0].plan[1].plannedDate,'2026-10-26');
  assert.equal(h.c.modal,null);
});
test('stale preview does not overwrite any course edit made since preview',async()=>{
  const h=setup();let notice='';h.c.alert=x=>{notice=x;};
  h.api.open();h.c.state.sequences[0].plan[1].title='Von Luca geändert';
  await h.api.apply();
  assert.equal(h.saves,0);
  assert.match(notice,/seit der Vorschau geändert/);
  assert.equal(h.c.state.sequences[0].plan[1].title,'Von Luca geändert');
});
test('failed save restores original lessons and sequences',async()=>{
  const h=setup();h.api.open();
  const before=JSON.stringify(h.c.state);
  h.c.saveState=()=>{throw Error('Speicher voll');};
  await h.api.apply();
  assert.equal(JSON.stringify(h.c.state),before);
});
