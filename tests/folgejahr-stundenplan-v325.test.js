'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../schulcockpit-folgejahr-stundenplan-v325-core.js');
const OLD='2026/27',NEW='2027/28';
function fixture(){
 return {settings:{schoolYear:OLD,periods:['GA','1. Block','2. Block','3. Block']},
 classes:[{id:'old-m',subject:'Mathematik',name:'5a',students:26,roster:['Private Person']},
  {id:'new-m',subject:'Mathematik',name:'6a',students:0,schoolYearV324:NEW,originClassIdV324:'old-m'}],
 sequences:[{id:'old-seq',classId:'old-m',schoolYearV190:OLD,title:'Brüche'},
  {id:'new-seq',classId:'new-m',schoolYearV190:NEW,title:'Brüche',originSequenceIdV324:'old-seq',
   plan:[{id:'new-u',title:'Brüche',plannedDate:''}]}],
 lessons:[{id:'held',classId:'old-m',date:'2026-11-16',status:'done',reflectionV182:{note:'Private Person'}}],
 timetable:[{id:'tt-1',classId:'old-m',weekday:1,slot:1,period:'1. Block',kind:'course'},
  {id:'tt-ga',weekday:1,slot:0,groupId:'old-group',kind:'group'},
  {id:'tt-2',classId:'old-m',weekday:3,slot:2,period:'2. Block',kind:'course'}],
 assessments:[{id:'old-exam',classId:'old-m',date:'2026-12-01',results:['private']}],
 schoolYearTimetablesV325:{}};
}
const draft=()=>({year:NEW,periods:['GA','1. Block','2. Block','3. Block'],
 entries:[{weekday:1,slot:1,classId:'new-m'},{weekday:3,slot:2,classId:'new-m'}],
 newCourses:[]});
function make(s=fixture(),d=draft()){
 let n=0;return C.prepare(s,d,type=>type+'-'+(++n));
}
test('correct next year and year boundaries',()=>{
 assert.equal(C.next(OLD),NEW);
 assert.equal(C.dateYear('2028-01-01'),NEW);
 assert(C.validYear(NEW));assert(!C.validYear('2027/29'));
});
test('target classes only include the future course',()=>{
 assert.deepEqual(C.targetCourses(fixture(),NEW).map(c=>c.id),['new-m']);
});
test('initial draft copies period labels but does not mutate the state',()=>{
 const s=fixture(),before=JSON.stringify(s),d=C.newDraft(s,NEW);
 d.periods[1]='Updated';d.entries.push({weekday:1,slot:2,classId:'new-m'});
 assert.equal(JSON.stringify(s),before);
});
test('future plan validation never requires changing the current timetable',()=>{
 assert.deepEqual(C.check(fixture(),draft(),OLD).errors,[]);
});
test('duplicate same weekly cell is blocked even for different courses',()=>{
 const d=draft();d.entries.push({weekday:1,slot:1,classId:'new-m'});
 assert(C.check(fixture(),d,OLD).errors.some(x=>x.includes('Doppelt')));
});
test('old class IDs cannot appear in future timetable',()=>{
 const d=draft();d.entries[0].classId='old-m';
 assert(C.check(fixture(),d,OLD).errors.some(x=>x.includes('alter Fachkurs')));
});
test('weekends, invalid weekdays and slots are rejected',()=>{
 const d=draft();d.entries[0].weekday=6;d.entries[1].slot=20;
 assert(C.check(fixture(),d,OLD).errors.some(x=>x.includes('Ungültiger Wochentag')));
});
test('new courses require subject and name; duplicate names rejected',()=>{
 const d=draft();d.newCourses=[{key:'new:x',subject:'Mathematik',name:'6a'}];
 assert(C.check(fixture(),d,OLD).errors.some(x=>x.includes('bereits vorhanden')));
});
test('creating a new course creates no roster and does not touch the old class',()=>{
 const s=fixture(),d=draft();d.newCourses=[{key:'new:x',subject:'Religion',name:'8b'}];
 d.entries.push({weekday:5,slot:3,classId:'new:x'});
 const r=make(s,d);assert.equal(r.created.length,1);
 assert.equal(r.created[0].students,0);assert(!('roster' in r.created[0]));
 assert.deepEqual(r.classes[0],s.classes[0]);
 assert(r.records.some(x=>x.classId===r.created[0].id));
});
test('saving stores target timetable without replacing live timetable',()=>{
 const s=fixture(),r=make(s);
 assert.deepEqual(s.timetable,fixture().timetable);
 assert.deepEqual(r.timetables[NEW].entries,r.records);
 assert(!Object.hasOwn(r,'timetable'));
});
test('same target slot keeps the previous stable timetable ID on resave',()=>{
 const s=fixture();s.schoolYearTimetablesV325={[NEW]:{
  periods:draft().periods,entries:[{id:'stable-tt',classId:'new-m',weekday:1,slot:1}]}};
 const r=make(s);assert.equal(r.records.find(x=>x.weekday===1).id,'stable-tt');
});
test('changing target class of a cell creates a new timetable ID',()=>{
 const s=fixture();s.schoolYearTimetablesV325={[NEW]:{
  periods:draft().periods,entries:[{id:'stable-tt',classId:'new-m',weekday:1,slot:1}]}};
 const d=draft();d.newCourses=[{key:'new:x',subject:'Religion',name:'7b'}];d.entries[0].classId='new:x';
 const r=make(s,d);assert.notEqual(r.records.find(x=>x.weekday===1).id,'stable-tt');
});
test('old timetable can be offered as non-mutating proposal',()=>{
 const s=fixture(),d=C.newDraft(s,NEW),before=JSON.stringify(s);
 const x=C.suggest(s,d,s.timetable);
 assert.equal(x.entries.length,2);
 assert(x.entries.every(x=>x.classId==='new-m'));
 assert.equal(JSON.stringify(s),before);
});
test('suggestion never copies old group/GA slots or teacher notes',()=>{
 const s=fixture(),x=C.suggest(s,C.newDraft(s,NEW),s.timetable);
 assert(x.entries.every(x=>!x.groupId&&x.kind==='course'));
 assert(!JSON.stringify(x).includes('Private Person'));
});
test('ambiguous inherited course matching will not guess',()=>{
 const s=fixture();s.classes.push({id:'other-old',subject:'Mathematik',name:'5b'});
 s.sequences.push({id:'other-seq',classId:'other-old',schoolYearV190:OLD,title:'Addition'});
 s.sequences.push({id:'another-future-seq',classId:'new-m',schoolYearV190:NEW,originSequenceIdV324:'other-seq'});
 const x=C.suggest(s,C.newDraft(s,NEW),s.timetable);
 assert(x.ambiguous.includes('Mathematik 6a'));
 assert.equal(x.entries.length,0);
});
test('schedule uses saved year timetable, date bounds and weekday, not old class',()=>{
 const rows=make().records;
 const x=C.schedule(NEW,rows,'new-m',{start:'2027-08-19',end:'2027-09-03'},()=>false,[]);
 assert(x.every(x=>x.date>='2027-08-19'&&x.date<='2027-09-03'));
 assert(x.some(x=>x.date==='2027-08-23'&&x.slot===1));
 assert.equal(C.schedule(NEW,rows,'old-m',{start:'2027-08-19',end:'2027-09-03'},()=>false,[]).length,0);
});
test('schedule skips school closures and fixed exam dates',()=>{
 const rows=make().records;
 const x=C.schedule(NEW,rows,'new-m',{start:'2027-08-19',end:'2027-08-31'},
  d=>d==='2027-08-25',['2027-08-23']);
 assert(!x.some(x=>['2027-08-23','2027-08-25'].includes(x.date)));
 assert(x.some(x=>x.date==='2027-08-30'));
});
test('activation before first day of school blocked',()=>{
 const s=fixture(),r=make(s);s.schoolYearTimetablesV325=r.timetables;
 assert.throws(()=>C.activation(s,NEW,{start:'2027-08-19'},'2026-11-14'),/noch nicht begonnen/);
});
test('activation is only possible for immediate next year with saved plan',()=>{
 const s=fixture();assert.throws(()=>C.activation(s,'2028/29',{start:'2028-09-01'},'2028-09-01'));
});
test('activation archives original timetable and switches without altering old data',()=>{
 const s=fixture(),before=JSON.stringify(s),r=make(s);
 s.schoolYearTimetablesV325=r.timetables;
 const x=C.activation(s,NEW,{start:'2027-08-19'},'2027-08-19');
 assert.equal(x.activeYear,NEW);
 assert.deepEqual(x.timetables[OLD].entries,s.timetable);
 assert.equal(x.timetable.length,2);
 assert(x.timetable.every(x=>x.classId==='new-m'));
 assert.equal(x.week,'2027-08-16');
 assert.notDeepEqual(x.timetable,s.timetable);
 assert.deepEqual(s.lessons[0],fixture().lessons[0]);
});
test('invalid period labels and too many block rows rejected',()=>{
 const d=draft();d.periods[0]='';
 assert(C.check(fixture(),d,OLD).errors.some(x=>x.includes('Bezeichnung')));
 d.periods=Array(17).fill('Block');
 assert(C.check(fixture(),d,OLD).errors.some(x=>x.includes('16')));
});
test('rollover itself leaves original classes, exam scores and student data unchanged',()=>{
 const s=fixture(),before=JSON.stringify(s);
 make(s);C.suggest(s,draft(),s.timetable);
 assert.equal(JSON.stringify(s),before);
});
