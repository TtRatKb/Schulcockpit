'use strict';
const assert=require('node:assert/strict');
const C=require('../schulcockpit-quellenpruefung-v309-core.js');
const old={id:'q',title:'Division natürlicher Zahlen',plan:[
 {id:'u1',title:'Schriftlich dividieren, Teiler und Vielfache erkennen',content:'Teiler und Vielfache',
  importedFromV184:'2026-11-01'},
 {id:'u2',title:'Halbschriftliche Division',content:'Division mit Rest'},
 {id:'u3',title:'Fachbegriffe Division',importedFromV184:'2026-11-01',
  sourceEvidenceV309:C.evidence({type:'themenkarte',document:'Themenkarte Mathe 5',
   passage:'Division von natürlichen Zahlen, Zerlegung, Rest, Fachbegriffe'})}
]};
assert.equal(C.status(old.plan[0]),'unverified','existing AI work has no automatic proof');
assert.equal(C.status(old.plan[1]),'other','manual/old work is not falsely tagged hallucinated');
assert.equal(C.status(old.plan[2]),'unverified','AI-provided citation is not verified by software');
assert.equal(C.tally([old]).unverified,2);
const q=C.prompt('# Reihenplan\n\n## Auftrag\nPlane die Reihe. JSON: "notes": "", "materials": [',old,
 [{name:'Themenkarte Division.pdf'}],{subject:'Mathematik',name:'5f'});
assert.match(q,/enger Themenkartenrahmen/);
assert.match(q,/Teiler und Vielfache/);
assert.match(q,/ein Dateiname/i);
assert.match(q,/sourceEvidence/);
assert.match(q,/"sourceEvidence": \{"type":"unspecified"/);
assert.match(q,/Themenkarte Division.pdf/);
assert.match(q,/nicht automatisch überprüfter Nachweis/);
const religion=C.prompt('## Auftrag\n',old,[],{subject:'Religion',name:'8'});
assert(!religion.includes('„Teiler und Vielfache“'),'math-specific example excluded in religion');
old.plan[0].sourceReviewV309={status:'revision',note:'Themenkarte enthält hier keine Teiler/Vielfache'};
assert.equal(C.status(old.plan[0]),'revision');
const flag=C.prompt('## Auftrag\n',old,[],{subject:'Mathematik',name:'5f'});
assert.match(flag,/beanstandete Stunden/);
assert.match(flag,/Themenkarte enthält hier keine Teiler\/Vielfache/);
old.plan[0].sourceReviewV309={status:'accepted',document:'Quelle im Kollegium geprüft'};
assert.equal(C.status(old.plan[0]),'teacher-accepted');
assert.equal(C.tally([old]).teacherAccepted,1);
const e=C.evidence({type:'curriculum',document:'Hauscurriculum',quote:'Kern: Grundrechenarten',
 references:['S. 1'],comment:'Mit Original abgleichen'});
assert.equal(e.type,'curriculum');
assert.equal(e.declaredBy,'ai-unverified');
assert.equal(e.passage,'Kern: Grundrechenarten');
assert.equal(C.evidence({type:'invented',document:'Wolken'}).type,'unspecified');
console.log('Curriculum provenance: unverified AI is not a false claim, source filename not proof, teacher controls accepted/revision and math-only examples.');
