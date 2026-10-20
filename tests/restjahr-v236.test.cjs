/* V0.23.6: synthetic, anonymized tests; node tests/restjahr-v236.test.cjs */
'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const mod=require('../schulcockpit-restjahr-v236.js');
const {nextInstructionalDelta,parseAnnual,datePlus,clean}=mod;
function sample(){return {schema:'schulcockpit.year.v1',courseId:'math-5f',schoolYear:'2026/27',sequences:[
  {sequenceId:'s1',title:'Grundrechenarten',units:[{unitId:'u1',title:'Addieren',materials:[],competencyIds:['mathe-5-15-all-k01'],methodIds:[]}]},
  {sequenceId:'s2',title:'Wir teilen auf',units:[{title:'Bruchteile',materials:[{title:'Buch S. 12',kind:'book'}]}]}
]};}
test('Ferien überspringen: zwei freie Wochen führen zur nächsten regulären Woche',()=>{
  const isFree=d=>d>='2026-10-12'&&d<='2026-10-23';
  assert.equal(nextInstructionalDelta('2026-10-05',1,[{weekday:1},{weekday:4}],isFree),3);
  assert.equal(nextInstructionalDelta('2026-10-26',-1,[{weekday:1},{weekday:4}],isFree),-3);
});
test('Nur Montag frei: Woche mit Dienstagunterricht bleibt erhalten',()=>{
  assert.equal(nextInstructionalDelta('2026-10-05',1,[{weekday:1},{weekday:2}],d=>d==='2026-10-12'),1);
  assert.equal(nextInstructionalDelta('2026-10-05',2,[{weekday:1},{weekday:2}],d=>d==='2026-10-12'),2);
});
test('Nur ein Unterrichtsfach an freiem Tag: ganze Woche überspringen',()=>{
  assert.equal(nextInstructionalDelta('2026-10-05',1,[{weekday:1}],d=>d==='2026-10-12'),2);
});
test('Stundenplan ohne Daten: ursprüngliche Kalendernavigation beibehalten',()=>{
  assert.equal(nextInstructionalDelta('2026-10-05',1,[],()=>true),1);
});
test('Keine verfügbare Unterrichtswoche liefert null',()=>{
  assert.equal(nextInstructionalDelta('2026-10-05',1,[{weekday:1}],()=>true),null);
});
test('Lokales Datum um Monats- und Jahreswechsel',()=>{
  assert.equal(datePlus('2026-12-28',7),'2027-01-04');
  assert.equal(datePlus('2026-10-05',21),'2026-10-26');
});
test('Ganzjahresimport: getrennte Reihen mit übermittelten IDs',()=>{
  const p=sample();
  const raw='Einleitung\n<SCHULCOCKPIT_YEAR_IMPORT>\n'+JSON.stringify(p)+'\n</SCHULCOCKPIT_YEAR_IMPORT>';
  assert.equal(parseAnnual(raw,p.courseId,p.schoolYear).sequences.length,2);
  assert.equal(parseAnnual(JSON.stringify(p),p.courseId,p.schoolYear).sequences[1].sequenceId,'s2');
});
test('Falscher Kurs/Jahr, Schema und ungültige JSON-Antwort abweisen',()=>{
  const p=sample();
  assert.throws(()=>parseAnnual(JSON.stringify(p),'rel-7',p.schoolYear),/Schema, Kurs oder Schuljahr/);
  assert.throws(()=>parseAnnual(JSON.stringify(p),p.courseId,'2027/28'),/Schema, Kurs oder Schuljahr/);
  assert.throws(()=>parseAnnual('gar kein JSON',p.courseId,p.schoolYear),/Ungültiges JSON/);
});
test('Import erfordert pro Unterrichtsstunde Titel und Materialliste',()=>{
  const p=sample();p.sequences[0].units[0].materials=null;
  assert.throws(()=>parseAnnual(JSON.stringify(p),p.courseId,p.schoolYear),/Jede Stunde/);
});
test('Kein übergroßer Import',()=>{
  const p=sample();p.sequences=Array.from({length:26},(_,i)=>({title:'Reihe'+i,units:[]}));
  assert.throws(()=>parseAnnual(JSON.stringify(p),p.courseId,p.schoolYear),/1–25/);
});
test('Dateinamen werden pfadsicher',()=>assert.equal(clean('../stufe/Planung.pdf'),'.._stufe_Planung.pdf'));

test('Import weist fehlerhafte Kompetenzlisten zurück',()=>{
  const p=sample();p.sequences[0].units[0].competencyIds='mathe-5-k1';
  assert.throws(()=>parseAnnual(JSON.stringify(p),p.courseId,p.schoolYear),/Kompetenz-IDs/);
});
test('Integrierte Wochensteuerung legt in Ferienwochen keine Stunden an',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const js=fs.readFileSync(path.join(__dirname,'..','schulcockpit-restjahr-v236.js'),'utf8');
  const st={settings:{schoolYear:'2026/27',activeWeekStart:'2026-10-05'},timetable:[
    {id:'mo',classId:'c1',weekday:1,slot:1,period:'1'},
    {id:'di',classId:'c1',weekday:2,slot:1,period:'2'}
  ],lessons:[]};
  const cal={state:st,Date,Promise,Set,console,alert:()=>{},view:'prep',modal:null,
    resourceEditorV176:{},expandedLessonV176:new Set(),document:{querySelector:()=>null},
    iso:d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),
    activeMonday:()=>new Date(st.settings.activeWeekStart+'T12:00:00'),
    weekStartDateV177:d=>datePlus(st.settings.activeWeekStart,d*7),
    activeWeekDate:d=>datePlus(st.settings.activeWeekStart,d-1),
    activeWeekEnd:()=>datePlus(st.settings.activeWeekStart,4),
    weekWorkflowV177:()=>({}),
    v190NoSchoolInfo:d=>d>='2026-10-12'&&d<='2026-10-23'?{name:'Herbstferien'}:null,
    v191LessonProtected:()=>false,lessonSlot:l=>Number(l.slot),
    createBlankLessonFromTimetable:t=>({id:t.id+'-'+st.settings.activeWeekStart,source:'timetable',classId:t.classId,
      timetableId:t.id,date:datePlus(st.settings.activeWeekStart,t.weekday-1),slot:t.slot}),
    attachExactPlanV11:l=>l,saveState:async()=>{},render:()=>{},
    visitWeekV177:()=>{throw Error('Old visit should be overridden');},
    shiftActiveWeek:()=>{},sequencesView:()=>'<button class="secondary" data-v184-open-course="c1">Mit ChatGPT planen</button>',
    modalHtml:()=>'',wire:()=>{},
    v190PlanningYear:()=> '2026/27'
  };
  vm.runInNewContext(js,cal,{filename:'schulcockpit-restjahr-v236.js'});
  assert.match(cal.sequencesView(),/Restjahr mit ChatGPT planen/);
  cal.visitWeekV177(1,true);
  assert.equal(st.settings.activeWeekStart,'2026-10-26');
  assert.deepEqual(st.lessons.map(l=>l.date),['2026-10-26','2026-10-27']);
  cal.visitWeekV177(-1,true);
  assert.equal(st.settings.activeWeekStart,'2026-10-05');
  assert.equal(st.lessons.length,4);
  cal.visitWeekV177(1,true);
  assert.equal(st.lessons.length,4,'No duplication when revisiting already created week');
});
