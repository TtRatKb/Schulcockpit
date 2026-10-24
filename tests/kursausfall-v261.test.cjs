const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'../schulcockpit-kursausfall-v261.js'),'utf8');
function segment(from,to){const i=app.indexOf(from),j=app.indexOf(to,i+from.length);if(i<0||j<0)throw Error('Code-Segment nicht gefunden: '+from);return app.slice(i,j);}
const functions=[
  segment('function v261CourseRanges(','function v190YearBounds('),
  segment('function v190NoSchoolInfo(','function v190EnsureState('),
  segment('function v190CourseSlots(','function v190SequenceNeed('),
  segment('function v190CalendarPromptBlock(','const v190OldV184Open=')
].join('\n');
function harness(){
  const state={settings:{schoolYear:'2026/27'},schoolCalendarsV190:{'2026/27':{
    customRanges:[],imports:[],useCurrentTimetable:true,courseRangesV261:[
      {id:'abs1',classId:'cA',start:'2026-10-26',end:'2026-10-26',name:'Exkursion'}]}},
    timetable:[{id:'aM',classId:'cA',weekday:1,slot:1},{id:'aT',classId:'cA',weekday:2,slot:1},
      {id:'bM',classId:'cB',weekday:1,slot:2},{id:'bT',classId:'cB',weekday:2,slot:2}],assessments:[]};
  const c={state,Date,
    v190Calendar:y=>state.schoolCalendarsV190[y],v190NormYear:x=>x,
    v190OfficialRanges:()=>[],v190YearBounds:()=>({start:'2026-10-26',end:'2026-10-27'}),
    v190YearFromDate:()=> '2026/27',v190PlanningYear:()=> '2026/27',
    v190CalendarRanges:y=>state.schoolCalendarsV190[y].customRanges,
    v190PublicHolidaysForYear:()=>[],v190YearStartNum:()=>2026,
    iso:d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  vm.runInNewContext(functions,c);
  return c;
}
test('a course absence blocks only that course; school closures still block everyone',()=>{
  const c=harness();
  assert.equal(c.v190NoSchoolInfo('2026-10-26'),null);
  assert.equal(c.v190NoSchoolInfo('2026-10-26','cA').name,'Exkursion');
  assert.equal(c.v190NoSchoolInfo('2026-10-26','cB'),null);
  assert.deepEqual(Array.from(c.v190CourseSlots('cA').map(s=>s.date)),['2026-10-27']);
  assert.deepEqual(Array.from(c.v190CourseSlots('cB').map(s=>s.date)),['2026-10-26','2026-10-27']);
  c.state.schoolCalendarsV190['2026/27'].customRanges.push({start:'2026-10-27',end:'2026-10-27',name:'SchILF',type:'custom'});
  assert.deepEqual(Array.from(c.v190CourseSlots('cA').map(s=>s.date)),[]);
  assert.deepEqual(Array.from(c.v190CourseSlots('cB').map(s=>s.date)),['2026-10-26']);
});
test('course planning prompt includes only its own absences and not others',()=>{
  const c=harness();
  const a=c.v190CalendarPromptBlock('2026/27','','','cA');
  const b=c.v190CalendarPromptBlock('2026/27','','','cB');
  assert.match(a,/2026-10-26 Exkursion/);
  assert.doesNotMatch(b,/Exkursion/);
  assert.match(a,/NUR die Stunden dieses Kurses/);
});
test('calendar offers an independently selectable course absence form',()=>{
  const st={classes:[{id:'cA',subject:'Mathematik',name:'5f'},{id:'cB',subject:'Religion',name:'8a'}],
    settings:{schoolYear:'2026/27'},schoolCalendarsV190:{'2026/27':{courseRangesV261:[
      {id:'absence',classId:'cA',name:'Exkursion',start:'2026-10-26',end:'2026-10-26'}]}}};
  const c={state:st,view:'school-calendar',v190CalendarDraft:{year:'2026/27'},
    viewHtml:()=>'<div><section class="panel"><div class="section-head"><div><span class="eyebrow">PLANUNGSMARKEN</span></div></div></section></div>',
    wire:()=>{},v190NormYear:x=>x,v190Calendar:y=>st.schoolCalendarsV190[y],
    v261CourseRanges:y=>st.schoolCalendarsV190[y].courseRangesV261,
    fmtDate:x=>x,esc:x=>String(x),document:{querySelector:()=>null,querySelectorAll:()=>[]}};
  vm.runInNewContext(ui,c);
  const html=c.viewHtml();
  assert.match(html,/Unterrichtsausfälle einzelner Kurse/);
  assert.match(html,/Mathematik · 5f/);
  assert.match(html,/Religion · 8a/);
  assert.match(html,/data-v261-remove="absence"/);
  assert.match(html,/data-v261-add/);
});
test('saving one course absence changes only that calendar range, not lessons or other courses',async()=>{
  const cal={courseRangesV261:[]},state={classes:[{id:'a',subject:'Mathematik',name:'5f'},
    {id:'b',subject:'Religion',name:'8a'}],settings:{schoolYear:'2026/27'},
    lessons:[{id:'lesson',classId:'b',date:'2026-11-02',status:'open'}],assessments:[]};
  const inputs={'v261-course':'a','v261-start':'2026-11-02','v261-end':'',
    'v261-reason':'Projektwoche'};
  let click,updates=0;
  const c={state,view:'school-calendar',v190CalendarDraft:{year:'2026/27'},
    viewHtml:()=>'',wire:()=>{},v190NormYear:x=>x,v190Calendar:()=>cal,
    v261CourseRanges:()=>cal.courseRangesV261,
    v190YearBounds:()=>({start:'2026-08-01',end:'2027-07-31'}),
    v182IsHeld:()=>false,uid:()=> 'new-id',structuredClone,
    saveState:async()=>{updates++;},render:()=>{},confirm:()=>true,alert:msg=>{throw Error(msg);},
    esc:x=>x,fmtDate:x=>x,
    document:{getElementById:id=>({value:inputs[id]}),
      querySelector:selector=>selector==='[data-v261-add]'?{addEventListener:(_,fn)=>{click=fn;}}:null,
      querySelectorAll:()=>[]}};
  vm.runInNewContext(ui,c);
  c.wire();await click();
  assert.equal(updates,1);
  assert.equal(cal.courseRangesV261.length,1);
  assert.equal(cal.courseRangesV261[0].classId,'a');
  assert.equal(cal.courseRangesV261[0].end,'2026-11-02');
  assert.equal(state.lessons[0].classId,'b');
  assert.equal(state.lessons[0].date,'2026-11-02');
});
