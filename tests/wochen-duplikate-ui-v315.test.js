'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),
 vm=require('node:vm'),path=require('node:path');
const C=require('../schulcockpit-wochen-duplikate-v315-core.js');
const state={settings:{schoolYear:'2026/27'},
 classes:[{id:'r9',subject:'Religion',name:'9'}],
 lessons:[
  {id:'real',date:'2026-11-10',classId:'r9',slot:2,period:'3. Block',
   status:'open',sequenceId:'seq',title:'Wie können wir trauernden Menschen helfen?',
   planReference:{unitId:'u1',title:'Wie können wir trauernden Menschen helfen?'},
   materials:['ab-12'],phasePlan:[{title:'Erarbeiten'}],slides:[],printPlan:[]},
  {id:'extra',date:'2026-11-10',classId:'r9',slot:2,period:'3. Block',
   status:'open',sequenceId:'seq',title:'Wie können wir trauernden Menschen helfen?',
   planReference:{unitId:'u1',title:'Wie können wir trauernden Menschen helfen?'},
   materials:[],phasePlan:[],slides:[],printPlan:[]}
 ]};
let replaced=0,normal=0,renders=0,alerts=[];
const context={state,SC_WEEK_DUPLICATES_V315:C,window:{},document:{querySelector:()=>null},
 cls:id=>state.classes.find(c=>c.id===id),fmtDate:v=>v,esc:String,
 alert:x=>alerts.push(x),
 currentWeekLessons:()=>[...state.lessons],
 weekPrepViewV14:()=>'<main><div class="course-prep-list-v14">'+
  context.currentWeekLessons().map(l=>'<article class="course-prep-card-v14">'+l.title+'</article>').join('')+'</div></main>',
 weekView:()=>'<main><section class="v182-week-grid">'+
  context.currentWeekLessons().map(l=>'<article class="v182-week-card">'+l.title+'</article>').join('')+'</section></main>',
 rebuildActiveWeek:(replace)=>{if(replace)replaced++;else normal++;},
 syncWeek:()=>{},render:()=>{renders++;}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,
 '../schulcockpit-wochen-duplikate-v315.js'),'utf8'),context);
const api=context.window.SchulcockpitWeekDuplicatesV315;
assert(api);
assert.equal(context.currentWeekLessons().length,1);
assert.equal(state.lessons.length,2,'the hidden original must still be stored');
assert.equal(context.weekPrepViewV14().match(/class="course-prep-card-v14"/g).length,1);
assert.match(context.weekPrepViewV14(),/zusätzliche Karte/);
assert.match(context.weekPrepViewV14(),/data-v182-open="extra"/);
assert.equal(context.weekView().match(/class="v182-week-card"/g).length,1);
assert.match(context.weekView(),/zusätzliche Karte/);
context.rebuildActiveWeek(true);
assert.equal(replaced,0,'replacing week must not erase the hidden original');
assert.match(alerts[0],/nicht ausgeführt/);
context.syncWeek();
assert.equal(normal,1);
state.lessons[1].printPlan=[{id:'own-print',materialId:'m2',alreadyPrinted:true}];
assert.equal(context.currentWeekLessons().length,2,'unique print evidence must not be hidden');
assert.equal(context.weekPrepViewV14().match(/class="course-prep-card-v14"/g).length,2);
assert.match(context.weekPrepViewV14(),/mit unterschiedlichen Daten/);
assert.equal(state.lessons[1].printPlan[0].id,'own-print');
console.log('V315 integrated: one Monday and one week card for redundant data, originals retained, unique print evidence visible, week replacement blocked OK');
