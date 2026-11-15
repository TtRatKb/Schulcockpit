/* Regression of Nov 11 Religion 11: the Soll timetable and real weekly cards
 * must agree even when old cards carry a date before "today". */
'use strict';
const assert=require('node:assert/strict');
const Sync=require('../schulcockpit-plan-karten-abgleich-v329-core.js');
const Trash=require('../schulcockpit-doppelkarten-bereinigen-v328-core.js');
const slots=['2026-11-04','2026-11-11','2026-12-02','2026-12-09']
 .map(date=>({date,slot:1,timetableId:'wed-1',period:'1. Block'}));
const q={id:'r11-q',classId:'r11',title:'Glaube und Naturwissenschaft',
 plan:[
 {id:'held',plannedDate:'2026-11-04',plannedSlotV272:1,title:'Ohlig und Kreationismus'},
 {id:'insert',plannedDate:'2026-11-11',plannedSlotV272:1,title:'Kreationismus + AFB III'},
 {id:'world',plannedDate:'2026-12-02',plannedSlotV272:1,title:'Weltbilder im Rückblick'},
 {id:'after',plannedDate:'2026-12-09',plannedSlotV272:1,title:'Nächste Reihe'}]};
const classes=[{id:'r11',subject:'Religion',name:'11'}];
const state={classes,sequences:[q],lessons:[
 {id:'held-lesson',classId:'r11',date:'2026-11-04',slot:1,status:'done',
  planReference:{unitId:'held'},title:'Gehaltener Unterricht'},
 {id:'world-old',classId:'r11',date:'2026-11-11',slot:1,status:'open',
  title:'Weltbilder im Rückblick',
  planReference:{unitId:'world',title:'Weltbilder im Rückblick'},
  slides:[{title:'Folie 3'}],materials:['world-worksheet'],
  printPlan:[{id:'p',count:27,alreadyPrinted:true}],
  presentationReady:true,presentationSourceV177:'generated'},
 {id:'world-double',classId:'r11',date:'2026-12-02',slot:1,status:'open',
  title:'Weltbilder im Rückblick',
  planReference:{unitId:'world',title:'Weltbilder im Rückblick'},
  slides:[],materials:[]}
],materials:[{id:'world-worksheet',fileKey:'original-blob'}]};
const original=structuredClone(state);
const p=Sync.propose({state,classId:'r11',sequences:[q],slots,today:'2026-11-15'});
assert.equal(p.issues.length,0);
assert.equal(p.changed,3,'one card is moved, one is added, one parked');
assert.deepEqual(state,original,'preview cannot mutate actual classroom data');
let held=p.lessons.find(l=>l.id==='held-lesson');
let world=p.lessons.find(l=>l.id==='world-old');
let double=p.lessons.find(l=>l.id==='world-double');
let insert=p.lessons.find(l=>l.planReference?.unitId==='insert');
assert.equal(held.date,'2026-11-04','held history never changes');
assert.equal(world.date,'2026-12-02','Weltbilder uses the NEW planned date');
assert.equal(world.slides[0].title,'Folie 3','PowerPoint slides travel');
assert.equal(world.materials[0],'world-worksheet','worksheet reference travels');
assert.equal(world.printPlan[0].alreadyPrinted,true,'print settings travel');
assert.equal(world.presentationReady,false,'generated PPT with outdated date needs review');
assert(world.pptNeedsDateRefreshV311,'original PPT is retained, but date must be refreshed');
assert.equal(double.date,'','second linked card is preserved but does not occupy physical slot');
assert.equal(double.scheduleParkedV275.reason,'Zusätzliche Karte zur selben Soll-Stunde');
assert.equal(insert.date,'2026-11-11','inserted topic is now the real Monday card');
assert.equal(p.lessons.filter(l=>l.date==='2026-11-11'&&l.classId==='r11').length,1);
assert.equal(p.lessons.filter(l=>l.date==='2026-12-02'&&l.classId==='r11').length,1);
const after=Sync.propose({state:{...state,lessons:p.lessons},
 classId:'r11',sequences:[q],slots,today:'2026-11-15'});
assert.equal(after.changed,0,'repeated synchronization is idempotent');
const withTrash={...state,lessons:p.lessons};
assert.equal(Trash.evaluate(withTrash,'world-double').allowed,true,
 'parked duplicate may be removed by user');
assert.equal(Trash.evaluate(withTrash,'world-old').allowed,false,
 'the only active canonical Worldviews card cannot be removed');
Trash.remove(withTrash,'world-double');
assert.equal(withTrash.duplicateCardTrashV328.length,1);
assert.equal(withTrash.lessons.find(l=>l.id==='world-old').date,'2026-12-02');
Trash.restore(withTrash,'world-double');
assert.equal(withTrash.lessons.find(l=>l.id==='world-double').date,'');
assert.equal(withTrash.materials[0].fileKey,'original-blob','materials not deleted');
{
 const conflict=structuredClone(state);
 conflict.lessons.push({id:'recorded-other',classId:'r11',date:'2026-12-02',
  slot:1,status:'done',title:'Ist-Unterricht',planReference:{unitId:'other'}});
 const result=Sync.propose({state:conflict,classId:'r11',sequences:[q],slots,
  today:'2026-11-15'});
 assert(result.issues.length>0,'held collision is detected');
 assert.equal(result.changed,0,'a conflict never produces partial changes');
 assert.deepEqual(conflict.lessons.at(-1).date,'2026-12-02');
}
{
 const limited=Sync.propose({state:{lessons:[{id:'extra',classId:'r11',date:'2026-11-11',
  slot:1,status:'open',planReference:{unitId:'world'},slides:[{title:'Keep'}]}]},
  classId:'r11',sequences:[{...q,plan:q.plan.slice(0,3).map(u=>({...u,
   ...(u.id==='world'?{plannedDate:''}:{} )}))}],slots,today:'2026-11-15'});
 assert.equal(limited.issues.length,0);
 assert.equal(limited.lessons.find(l=>l.id==='extra').date,'','overflow is parked');
 assert.equal(limited.lessons.find(l=>l.id==='extra').slides[0].title,'Keep');
}
{
 const twoSlots=[{date:'2026-11-18',slot:1,timetableId:'m1'},
 {date:'2026-11-18',slot:2,timetableId:'m2'}];
 const qs=[{id:'q',classId:'r11',plan:[{id:'a',title:'A',plannedDate:'2026-11-18',
  plannedSlotV272:1},{id:'b',title:'B',plannedDate:'2026-11-18',plannedSlotV272:2}]}];
 const result=Sync.propose({state:{lessons:[]},classId:'r11',sequences:qs,
  slots:twoSlots,today:'2026-11-15'});
 assert.equal(result.issues.length,0);
 assert.deepEqual(result.lessons.map(l=>l.slot),[1,2],
  'two same-day blocks receive distinct cards');
}
console.log('V329: Nov 11/Dec 2 cards, held history, PPT/files, reversible duplicates, conflicts, overflow, multiple blocks, idempotence OK');
