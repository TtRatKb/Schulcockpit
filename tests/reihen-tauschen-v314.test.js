'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),
 path=require('node:path');
const core=require('../schulcockpit-reihen-drag-v311-core.js');
const q={id:'r9',plan:[
 {id:'held',title:'Schon gehalten'},
 {id:'traurigkeit',title:'Umgang mit Trauer'},
 {id:'ethik',title:'Sterbehilfe'},
 {id:'unplanned',title:'Später als Reserve'}]};
const rows=[
 {id:'held',title:'Schon gehalten',date:'2026-11-10',slot:2,held:true},
 {id:'traurigkeit',title:'Umgang mit Trauer',date:'2026-11-17',slot:2},
 {id:'ethik',title:'Sterbehilfe',date:'2026-12-08',slot:2},
 {id:'unplanned',title:'Später als Reserve',date:'',slot:null}
];
let draft=null,alerts=[],renders=0;
const api={
 getDraft:()=>draft,
 getRows:()=>rows,
 reorder:core.reorder,
 stageOrder:(qid,wanted)=>{
  assert.equal(qid,q.id);
  core.calculate(rows,wanted); // all slot validation before a visible change
  draft={qid,order:[...wanted]};
  return true;
 }
};
const html=()=>{
 const current=draft?.order||q.plan.map(u=>u.id);
 return '<div data-v312-direct><div class="v312-actual-list">'+
 current.map(id=>'<article class="v312-actual-row v311-row" data-v311-row="'+id+'">'+
 '<strong>'+id+'</strong></article>').join('')+'</div>'+
 '<small class="v311-live v312-live">Noch keine Änderungen.</small></div>';
};
const doc={
 addEventListener:()=>{},
 querySelector:()=>null
};
const context={
 window:{SchulcockpitSequenceDragV311:api},document:doc,modal:{type:'sequence',id:q.id},
 seq:id=>id===q.id?q:null,
 sequencePanel:()=>html(),
 render:()=>{renders++;},
 state:{settings:{schoolYear:'2026/27'}},esc:String,alert:x=>alerts.push(x)
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,
 '../schulcockpit-stunden-tauschen-v314.js'),'utf8'),context);
const ui=context.window.SchulcockpitSafeReorderV314;
assert(ui);
assert.match(context.sequencePanel(q),/data-v314-choose="ethik"/);
ui.choose(q,'ethik');
assert.match(context.sequencePanel(q),/data-v314-swap="traurigkeit"/);
assert.match(context.sequencePanel(q),/data-v314-before="traurigkeit"/);
assert.match(context.sequencePanel(q),/data-v314-after="traurigkeit"/);
ui.stage(q,'traurigkeit','swap');
assert.deepEqual(draft.order,['held','ethik','traurigkeit','unplanned']);
assert.equal(ui.getSelected(),'');
let calculated=core.calculate(rows,draft.order);
assert.equal(calculated.rows.find(x=>x.id==='ethik').date,'2026-11-17');
assert.equal(calculated.rows.find(x=>x.id==='traurigkeit').date,'2026-12-08');
assert.equal(calculated.rows.find(x=>x.id==='unplanned').date,'');
ui.choose(q,'unplanned');
ui.stage(q,'held','before');
assert(!alerts.length,'moving around held anchor may move an unplanned row without changing held slots');
assert.equal(core.calculate(rows,draft.order).rows.find(x=>x.id==='unplanned').date,'');
ui.choose(q,'ethik');
const prior=[...draft.order];
ui.stage(q,'held','swap');
assert.deepEqual(draft.order,prior,'held rows cannot be swapped');
assert(alerts.some(s=>s.includes('gehalten')));
assert(renders>=4);
console.log('V314 direct card controls: swap, choose/insert, held slot lock, unscheduled rows retain no date OK');
