const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const JSZip=require('../jszip.min.js');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'../schulcockpit-vertretung-v262.js'),'utf8');
function segment(from,to){const i=app.indexOf(from),j=app.indexOf(to,i+from.length);if(i<0||j<0)throw Error('Missing '+from);return app.slice(i,j);}
const model=[
  segment('function v261CourseRanges(','function v190YearBounds('),
  segment('function v190NoSchoolInfo(','function v190EnsureState('),
  segment('function v190CourseSlots(','function v190SequenceNeed(')
].join('\n');
function harness(){
  const cal={customRanges:[
    {id:'old',start:'2026-10-26',end:'2026-10-26',name:'Alter Schließtag'},
    {id:'schilf',start:'2026-10-28',end:'2026-10-28',name:'SchILF',impactV262:'substitution'}
  ],imports:[],courseRangesV261:[
    {id:'away',classId:'math',start:'2026-10-29',end:'2026-10-29',name:'Krank',impactV262:'substitution'},
    {id:'exc',classId:'rel',start:'2026-10-29',end:'2026-10-29',name:'Exkursion'}
  ],useCurrentTimetable:true};
  const state={settings:{schoolYear:'2026/27'},schoolCalendarsV190:{'2026/27':cal},
    classes:[{id:'math',name:'5f',subject:'Mathematik',students:26},{id:'rel',name:'8a',subject:'Religion',students:25}],
    timetable:[{id:'mt',classId:'math',weekday:2,slot:1},{id:'mw',classId:'math',weekday:3,slot:3},
      {id:'mr',classId:'math',weekday:4,slot:4},{id:'rr',classId:'rel',weekday:4,slot:2},
      {id:'rw',classId:'rel',weekday:3,slot:2}],
    sequences:[],lessons:[],assessments:[]};
  const c={state,Date,JSZip,view:'school-calendar',modal:null,v190CalendarDraft:{year:'2026/27'},
    v190NormYear:y=>y,v190PlanningYear:()=>state.settings.schoolYear,v190YearFromDate:()=>state.settings.schoolYear,
    v190Calendar:y=>state.schoolCalendarsV190[y],v190CalendarRanges:y=>state.schoolCalendarsV190[y].customRanges,
    v190OfficialRanges:()=>[],v190YearBounds:()=>({start:'2026-10-26',end:'2026-10-30'}),
    v190PublicHolidaysForYear:()=>[],v190YearStartNum:()=>2026,
    pageTitle:()=>'',viewHtml:()=>'<section class="panel"><div class="section-head"><div><span class="eyebrow">PLANUNGSMARKEN</span></div></div></section>',
    modalHtml:()=>'',wire:()=>{},render:()=>{},v190YearOptions:()=>['2026/27'],
    fmtDate:s=>s,esc:s=>String(s),lessonSlot:l=>l.slot,seq:()=>null,v182IsHeld:()=>false,
    iso:d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),
    document:{querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null},window:{},
    fileStoreGet:async()=>null,saveState:async()=>{},downloadBlob:()=>{},alert:()=>{},uid:x=>x+'1'};
  vm.runInNewContext(model,c);
  vm.runInNewContext(ui,c);
  c.SchulcockpitSubstitutionV262=c.window.SchulcockpitSubstitutionV262;
  return c;
}
test('legacy school closure stays blocked, SchILF substitute day keeps slots',()=>{
  const c=harness();
  assert.equal(c.v190NoSchoolInfo('2026-10-26','math').name,'Alter Schließtag');
  assert.equal(c.v190NoSchoolInfo('2026-10-28','math'),null);
  assert.equal(c.v190NoSchoolInfo('2026-10-29','math'),null);
  assert.equal(c.v190NoSchoolInfo('2026-10-29','rel').name,'Exkursion');
  assert.deepEqual(Array.from(c.v190CourseSlots('math').map(x=>x.date)),['2026-10-27','2026-10-28','2026-10-29']);
  const entries=Array.from(c.SchulcockpitSubstitutionV262.candidates('2026/27'));
  assert.deepEqual(entries.map(e=>[e.date,e.classId,e.slot]),[
    ['2026-10-28','rel',2],['2026-10-28','math',3],['2026-10-29','math',4]]);
});
test('real school closure supersedes an overlapping substitution entry',()=>{
  const c=harness(),cal=c.state.schoolCalendarsV190['2026/27'];
  cal.imports.push({id:'closed',start:'2026-10-28',end:'2026-10-28',name:'Schule geschlossen'});
  c.v190CalendarRanges=y=>[...cal.customRanges,...cal.imports];
  assert.equal(c.v190NoSchoolInfo('2026-10-28','math').name,'Schule geschlossen');
  assert.deepEqual(Array.from(c.SchulcockpitSubstitutionV262.candidates('2026/27').map(x=>x.date)),['2026-10-29']);
});
test('substitute prompt never asks for slides and includes real lesson context',()=>{
  const c=harness(),e=c.SchulcockpitSubstitutionV262.candidates('2026/27')[0];
  const p=c.SchulcockpitSubstitutionV262.prompt(e,{topic:'Brüche',minutes:45,instructions:'Aufgaben 1–4',materialNote:'AB',teacherNote:'Stillarbeit'});
  assert.match(p,/KEINE PowerPoint/);
  assert.match(p,/DOCX\/PDF/);
  assert.match(p,/Aufgaben 1–4/);
  assert.match(p,/mit Dank/i);
});
test('Word cover is a real DOCX and never silently includes unavailable attachments',async()=>{
  const c=harness(),api=c.SchulcockpitSubstitutionV262,e=api.candidates('2026/27')[0];
  const p={topic:'Addition',minutes:90,instructions:'Arbeite 20 Minuten an den Aufgaben.',materialNote:'Buch S. 21',teacherNote:'Partnerarbeit',files:[]};
  const blob=await api.docx(e,p),zip=await JSZip.loadAsync(blob);
  assert.ok(zip.file('word/document.xml'));
  const doc=await zip.file('word/document.xml').async('string');
  assert.match(doc,/vielen Dank/);
  assert.match(doc,/Arbeite 20 Minuten/);
  const total=await api.bundle(e,p),pack=await JSZip.loadAsync(await total.arrayBuffer());
  assert.ok(pack.file('01_Vertretungszettel.docx'));
  await assert.rejects(api.bundle(e,{...p,files:[{id:'a',fileKey:'missing',name:'Arbeitsblatt.pdf'}]}),/Materialien fehlen/);
});
