'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../schulcockpit-blitzreflexion-v323-core.js');
const from=()=>({overall:'',timing:'',learning:'',lessonFlags:[],pptFlags:[],
  materialIssues:{},note:'',completedAt:'2026-11-13T10:00:00Z'});
test('gut gelaufen only stores overall, not assumed learning achievement',()=>{
 const x=C.apply(from(),'works');
 assert.equal(x.overall,'fine');assert.equal(x.learning,'');
 assert.equal(x.timing,'');
});
test('knappe Zeit does not imply poor learning results',()=>{
 const x=C.apply(from(),'tight');
 assert.equal(x.timing,'tight');assert.equal(x.learning,'');assert.equal(x.overall,'');
});
test('repeat observation only stores repeat learning indicator',()=>{
 const x=C.apply(from(),'repeat');assert.equal(x.learning,'repeat');
 assert.equal(x.timing,'');
});
test('differentiation is one existing V182 lesson flag',()=>{
 const x=C.apply(from(),'differentiate');
 assert.deepEqual(x.lessonFlags,['differentiation']);
});
test('choosing the same answer again removes that answer',()=>{
 const x=C.apply(C.apply(from(),'tight'),'tight');
 assert.equal(x.timing,'');
 assert(!C.active(x,'tight'));
});
test('multiple quick choices can coexist',()=>{
 const x=C.apply(C.apply(from(),'tight'),'repeat');
 assert.equal(x.timing,'tight');assert.equal(x.learning,'repeat');
});
test('quick choice does not erase note, material issues or previous flags',()=>{
 const old={...from(),note:'Wichtige Beobachtung',pptFlags:['typo'],
  materialIssues:{mat1:['hard']},lessonFlags:['flow']};
 const x=C.apply(old,'works');
 assert.equal(x.note,old.note);assert.deepEqual(x.materialIssues,old.materialIssues);
 assert.deepEqual(x.lessonFlags,old.lessonFlags);
 assert.deepEqual(x.pptFlags,old.pptFlags);
});
test('a quick choice is not mistaken for completing the reflection',()=>{
 const x=C.apply(from(),'tight');assert.equal(x.completedAt,'');
});
test('pure preset application never changes the original reflection',()=>{
 const old=from(),before=JSON.stringify(old);
 C.apply(old,'works');assert.equal(JSON.stringify(old),before);
});
test('unknown choices cannot silently overwrite data',()=>{
 assert.throws(()=>C.apply(from(),'made-up'));
});
test('reflection takeaways prioritize timing and necessary practice',()=>{
 const x=C.takeaways({...from(),timing:'tight',learning:'repeat'});
 assert(x.includes('Mehr Zeit einplanen oder Stoff kürzen'));
 assert(x.includes('Mehr Übung / Wiederholung einplanen'));
});
test('good teaching with no concerns advises retaining successful methods',()=>{
 const x=C.takeaways({...from(),overall:'fine'});
 assert.deepEqual(x,['Bewährten Ablauf beibehalten']);
});
test('V182 flags for differentiation, teaching phases and slides have explicit hints',()=>{
 const x=C.takeaways({...from(),lessonFlags:['differentiation','too_dense'],pptFlags:['layout']});
 assert(x.some(h=>h.includes('differenzieren')));
 assert(x.some(h=>h.includes('Inhalt reduzieren')));
 assert(x.some(h=>h.includes('Präsentation')));
});
test('V182 material concerns get a neutral hint, no invented affected lesson',()=>{
 const x=C.takeaways({...from(),materialIssues:{m1:['hard']}});
 assert(x.some(h=>h.includes('Materialfassungen')));
});
test('neither student details nor teacher free-text notes go into ChatGPT prompt',()=>{
 const current={...from(),date:'2026-10-05',note:'Schülerin Testname war heute krank',
  actual:'Schülerin Testname fand Aufgabe 4 schwer',learning:'repeat',timing:'tight'};
 const s=C.promptHints([current]);
 assert(s.includes('Mehr Zeit einplanen'));
 assert(!s.includes('Testname'));assert(!s.includes(current.note));
 assert(!s.includes(current.actual));
});
test('an empty or unreviewed history does not add invented prompt hints',()=>{
 assert.equal(C.promptHints([]),'');
 assert.equal(C.promptHints([{date:'2026-09-01'}]),'');
});
test('old reflections remain read-only when building evidence cards',()=>{
 const input=[{date:'2026-10-12',timing:'tight',note:'Nur lokal'}];
 const before=JSON.stringify(input);const x=C.evidence(input);
 assert.equal(JSON.stringify(input),before);assert.notEqual(x[0],input[0]);
 assert.equal(x[0].note,'Nur lokal');
});
