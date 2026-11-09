'use strict';
const assert=require('node:assert/strict');
const C=require('../schulcockpit-wochen-duplikate-v315-core.js');
function one(id,more={}){
 return {id,date:'2026-11-10',classId:'religion9',slot:2,
  period:'3. Block',source:'timetable',timetableId:'tt-r9',
  status:'open',title:'Wie können wir trauernden Menschen helfen?',
  sequenceId:'q9',unit:'Tod und Trauer',
  planReference:{unitId:'trost',title:'Wie können wir trauernden Menschen helfen?',
   plannedDate:'2026-11-10',autoMatched:true},
  materials:[],printPlan:[],prepTasks:[],slides:[],phasePlan:[],
  ...more};
}
const original=one('primary',{slides:[{title:'Aktivierung'}],
  materials:['ab-1'],printPlan:[{materialId:'ab-1',alreadyPrinted:true}]});
const duplicate=one('dupe');
const sample=[original,duplicate,
 {...one('other-course'),classId:'mathematik5'},
 {...one('other-date'),date:'2026-11-17'},
 {...one('other-slot'),slot:3}];
const snapshot=JSON.stringify(sample);
const grouped=C.analyze(sample);
assert.equal(grouped.originalCount,5);
assert.equal(grouped.visible.length,4);
assert.equal(grouped.hidden.length,1);
assert.equal(grouped.collisions.length,0);
assert.equal(grouped.hidden[0].extraId,'dupe');
assert.equal(grouped.hidden[0].primaryId,'primary');
assert.deepEqual(grouped.visible.map(l=>l.id),
 ['primary','other-course','other-date','other-slot']);
assert.equal(JSON.stringify(sample),snapshot,'never mutate or delete original content');
assert.equal(C.analyze(sample).visible.length,4,'idempotent on re-render');
const alreadyHeld=one('already-held',{status:'done',heldAtV182:'2026-11-10T13:00Z'});
assert.equal(C.analyze([alreadyHeld,duplicate]).visible.length,1,
 'held existing lesson is canonical, redundant open shadow not duplicated');
assert.equal(C.analyze([alreadyHeld,duplicate]).visible[0].id,'already-held');
assert.equal(C.analyze([one('other-topic',{planReference:{unitId:'ethics'}}),
 one('still-trost')]).visible.length,2,
 'different unitIds on same slot are conflicting and never hidden');
assert.equal(C.analyze([one('a',{title:'Eigene Diskussion'}),
 one('b',{title:'Anderer Unterricht'})]).collisions.length,1);
assert.equal(C.analyze([one('a',{slides:[{title:'Ein anderer Folieninhalt'}]}),
 one('b',{slides:[{title:'Unabhängige Präsentation'}]})]).collisions.length,1,
 'independent prepared work must not disappear');
assert.equal(C.analyze([one('a',{printPlan:[{materialId:'mat1',alreadyPrinted:true}]}),
 one('b',{printPlan:[{materialId:'mat2',needed:true}]})]).visible.length,2,
 'independent printing records must not disappear');
assert.equal(C.analyze([one('a',{status:'done'}),one('b',{status:'done'})]).visible.length,2,
 'two historical held records must never be hidden');
assert.equal(C.analyze([one('a',{executionV180:{type:'cancelled'}}),
 one('b',{status:'done'})]).visible.length,2,
 'a documented cancelled lesson remains accessible');
assert.equal(C.analyze([one('a',{actualV270:{note:'Geschafft'}}),
 one('b',{actualV270:{note:'Andere Ergebnisse'}})]).visible.length,2);
assert.equal(C.analyze([one('a',{manualPlanReadyV177:true}),
 one('b',{manualPlanReadyV177:false})]).visible.length,1);
assert.equal(C.analyze([one('a',{status:'ready',slides:[]}),
 one('b',{status:'open'})]).visible.length,1);
assert.equal(C.analyze([one('a',{objective:'Kognitiv reflektieren'}),
 one('b',{objective:'Ganz anderes Lernziel'})]).visible.length,2);
assert.equal(C.analyze([one('a',{resourceDecisionV305:{important:true}}),
 one('b',{resourceDecisionV305:{important:false}})]).visible.length,2,
 'unknown distinct planning data must remain visible');
assert.equal(C.analyze([one('missing-slot',{slot:null}),
 one('also-missing',{slot:null})]).visible.length,2,
 'do not guess a slot when it is missing');
assert.equal(C.analyze([one('a',{groupId:'g1',classId:undefined}),
 one('b',{groupId:'g2',classId:undefined})]).visible.length,2);
console.log('V315 pure: redundant Monday cards hidden without mutation; independent lesson, print, actual, held & group records remain visible OK');
