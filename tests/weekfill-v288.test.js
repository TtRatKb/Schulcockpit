/* V0.28.8 – missing future week cards must be created without replanning.
 * Synthetic fixtures mirror 9 course slots with 3 previously created cards. */
const assert=require('node:assert/strict');
const {plan,mondayOf,dayAt}=require('../schulcockpit-weekfill-v288-core.js');
assert.equal(mondayOf('2026-11-06'),'2026-11-02');
assert.equal(dayAt('2026-11-16',5),'2026-11-20');
const timetable=[
 ['math','2026-11-16',1,1],['religion6','2026-11-17',2,1],
 ['method','2026-11-17',2,2],['religion9','2026-11-17',2,3],
 ['math2','2026-11-18',3,2],['religion11','2026-11-18',3,1],
 ['religion8','2026-11-19',4,3],['religion5','2026-11-19',4,4],
 ['religion7','2026-11-20',5,2]
].map(([id,date,weekday,slot])=>({id,classId:id,weekday,slot,period:''+slot+'. Block',date}));
const lessons=[
 {id:'old-method',date:'2026-11-17',slot:2,classId:'method',phasePlan:[{title:'Sorgfältig vorbereitet'}]},
 {id:'old-religion5',date:'2026-11-19',slot:4,classId:'religion5'},
 {id:'old-religion7',date:'2026-11-20',slot:2,classId:'religion7'}
];
const before=structuredClone(lessons);
const noSchool=(date,cl)=>date==='2026-11-18'&&cl==='religion11'?{name:'Fachunterricht entfällt'}:null;
let p=plan({monday:'2026-11-16',today:'2026-11-06',timetable,lessons,noSchool});
assert.equal(p.missing.length,5);
assert.deepEqual(p.missing.map(x=>x.t.id),['math','religion6','religion9','math2','religion8']);
assert.equal(p.excluded.length,1);
assert.equal(p.excluded[0].t.classId,'religion11');
assert.deepEqual(lessons,before,'existing lesson entries are unchanged');
const complete=[...lessons,...p.missing.map((x,i)=>({id:'new-'+i,date:x.date,slot:x.slot,classId:x.t.classId}))];
assert.equal(plan({monday:'2026-11-16',today:'2026-11-06',
 timetable,lessons:complete,noSchool}).missing.length,0,'idempotence');
const manuallyBooked=[...lessons,{id:'manual',date:'2026-11-16',slot:1,classId:'different',source:'manual'}];
const booked=plan({monday:'2026-11-16',today:'2026-11-06',timetable,lessons:manuallyBooked,noSchool});
assert(!booked.missing.some(x=>x.t.id==='math'),'never overwrite an occupied timetable slot');
const past=plan({monday:'2026-11-02',today:'2026-11-18',timetable,lessons:[],noSchool});
assert.equal(past.missing.length,0,'historic week is not recreated');
const partial=plan({monday:'2026-11-16',today:'2026-11-19',timetable,lessons:[],noSchool});
assert(partial.missing.every(x=>x.date>='2026-11-19'),'earlier days in same week remain historical');
assert.equal(plan({monday:'2027-09-13',today:'2026-11-06',timetable,lessons:[],
 allowedYear:()=>false}).missing.length,0,'no spontaneous planning for unapproved new year');
const clashes=plan({monday:'2026-11-16',today:'2026-11-06',
 timetable:[timetable[0],{...timetable[0],id:'dupe'}],lessons:[]});
assert.equal(clashes.missing.length,1);assert.equal(clashes.conflicts.length,1);
console.log('V0.28.8: KW47 filled 5 genuinely missing subjects, respects cancellation, manual bookings, past lessons, conflicts & idempotence');
