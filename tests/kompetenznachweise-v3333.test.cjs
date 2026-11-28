'use strict';const assert=require('node:assert/strict'),C=require('../schulcockpit-kompetenznachweise-v3333-core.js');
const lessons=[{id:'l1',classId:'r5',status:'open'},{id:'l2',classId:'r5',status:'done',actualV270:{savedAt:'x'}}];
assert.throws(()=>C.make({id:'e',classId:'r5',competencyId:'c1',lessonId:'l1',status:'done',task:'Auftrag'},lessons),/Ist-Unterricht/);
const planned=C.make({id:'e1',classId:'r5',competencyId:'c1',lessonId:'l1',status:'planned',task:'Erkläre den Aufbau.',criteria:{E:'vollständig'}},lessons),done=C.make({id:'e2',classId:'r5',competencyId:'c2',lessonId:'l2',status:'done',coverageScope:'full',task:'Vergleiche zwei Texte.'},lessons);
assert.deepEqual(C.coverage([{id:'c1'},{id:'c2'},{id:'c3'}],[planned,done]).map(x=>[x.id,x.planned,x.verified]),[['c1',true,false],['c2',true,true],['c3',false,false]]);
assert.equal(C.markSelectionReview([planned],'l1',[]),1);assert.equal(planned.status,'review_required');assert.match(planned.reviewReason,/neu zuordnen/);
console.log('kompetenznachweise-v3333: ok');
