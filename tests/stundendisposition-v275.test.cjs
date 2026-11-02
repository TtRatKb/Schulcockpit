const test=require('node:test');
const assert=require('node:assert/strict');
const {plan,slotId}=require('../schulcockpit-stundendisposition-v275-core.js');
const slots=[
 {date:'2026-11-02',slot:1,timetableId:'m1'},
 {date:'2026-11-05',slot:2,timetableId:'t2'},
 {date:'2026-11-09',slot:1,timetableId:'m1'},
 {date:'2026-11-12',slot:2,timetableId:'t2'},
 {date:'2026-11-16',slot:1,timetableId:'m1'},
 {date:'2026-11-19',slot:2,timetableId:'t2'}
];
const day='2026-11-02';
const unit=(key,date,slot=0,opts={})=>({key,title:key,date,slot,...opts});
const go=(action,units,sourceKey,target=0,opts={})=>plan({slots,units,sourceKey,
 targetId:slotId(slots[target]),today:day,action,...opts});
test('swap two future lessons instead of moving a chain',()=>{
 const p=go('swap',[unit('a',day,1),unit('b','2026-11-09',1)],'a',2);
 assert.deepEqual(p.moves.map(x=>[x.key,x.to]),[['a','2026-11-09'],['b',day]]);
 assert.deepEqual(p.parked,[]);
});
test('remove one future lesson from the schedule but keep its identity',()=>{
 const p=go('park',[unit('old',day,1),unit('next','2026-11-05',2)],'old');
 assert.deepEqual(p.moves.map(x=>[x.key,x.to]),[['old','']]);
});
test('replace only chosen Monday and park another open theme without touching prepared Religion 11',()=>{
 const p=go('replace',[unit('old','2026-10-05'),unit('review',day,1),
  unit('religion-prepared','2026-11-05',2)],'old',0,{anchorKeys:['religion-prepared']});
 assert.deepEqual(p.moves.map(x=>[x.key,x.to]),[['old',day]]);
 assert.deepEqual(p.parked.map(x=>x.key),['review']);
});
test('insert next unit shifts following lessons and sequences but skips protected anchor',()=>{
 const units=[unit('continuation',''),unit('review',day,1),
 unit('protected','2026-11-05',2),unit('nextSeries','2026-11-09',1),
 unit('seriesAfter','2026-11-12',2)];
 const p=go('continue',units,'continuation',0,{anchorKeys:['protected'],
  blockedIds:[slotId(slots[1])]});
 assert.deepEqual(p.moves.map(x=>[x.key,x.to]),[
  ['NEW:continuation',day],['review','2026-11-09'],
  ['nextSeries','2026-11-12'],['seriesAfter','2026-11-16']]);
 assert(!p.moves.some(m=>m.key==='protected'));
});
test('partly completed held original is copied, never moved',()=>{
 const units=[unit('held','2026-10-26',0,{held:true}),unit('next',day,1)];
 const p=go('continue',units,'held');
 assert.equal(p.moves[0].key,'NEW:held');
 assert.equal(p.moves[0].repeatOf,'held');
 assert.equal(p.moves[0].to,day);
});
test('explicit future swap may exchange prepared lessons while cascade preserves anchors',()=>{
 const units=[unit('a',day,1),unit('prepared','2026-11-05',2)];
 const swapped=go('swap',units,'a',1,{anchorKeys:['prepared']});
 assert.equal(swapped.moves.length,2);
 assert.throws(()=>go('insert',units,'a',1,{anchorKeys:['prepared']}),/geschützte/);
});
test('past completed hour cannot be deleted from history',()=>{
 assert.throws(()=>go('park',[unit('done','2026-10-29',0,{held:true})],'done'),/gehaltene/);
});
test('blocked target such as held substitute or canceled lesson is not overwritten',()=>{
 assert.throws(()=>go('replace',[unit('next',day)],'next',0,
  {blockedIds:[slotId(slots[0])]}),/gesperrt/);
});
test('no overflow if the end of the timetable is fully assigned',()=>{
 const all=slots.map((s,i)=>unit('u'+i,s.date,s.slot));
 assert.throws(()=>go('insert',[unit('new','2026-10-05'),...all],'new',0),/nicht genügend/);
});
test('earlier series remains unchanged if inserting into later series',()=>{
 const units=[unit('old','2026-10-26'),unit('target',day,1),unit('b','2026-11-05',2)];
 const p=go('insert',units,'old');
 assert(!p.moves.some(m=>m.from==='2026-10-26'&&m.key!=='old'));
 assert.deepEqual(p.moves.map(m=>m.key),['old','target','b']);
});

test('short partial carryover shares the next lesson and leaves the topic and series dates intact',()=>{
 const units=[unit('held','2026-10-29',0,{held:true}),unit('newTopic','2026-11-09',1)];
 const p=go('carry_inline',units,'held',2);
 assert.deepEqual(p.moves,[]);
 assert.deepEqual(p.parked,[]);
 assert.equal(p.inline.topicKey,'newTopic');
 assert.equal(p.inline.targetDate,'2026-11-09');
});
