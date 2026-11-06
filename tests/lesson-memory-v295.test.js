const assert=require('node:assert/strict');
const core=require('../schulcockpit-lesson-memory-v295-core.js');
const courses=[
 {id:'m5old',subject:'Mathematik',name:'5a'},
 {id:'m5now',subject:'Mathematik',name:'5f'},
 {id:'m6',subject:'Mathematik',name:'6a'},
 {id:'r5',subject:'Religion',name:'5a'}];
const current={id:'new',classId:'m5now',date:'2026-11-10',
 planReference:{title:'Halbschriftliche Division'}};
const past=[
 {id:'old1',classId:'m5old',date:'2025-11-05',status:'done',
  planReference:{title:'Halbschriftliche Division'},
  reflectionV182:{completedAt:'2025-11-05T16:00:00Z',overall:'fine',
    timing:'tight',learning:'partly',note:'Für die nächste Durchführung Material vereinfachen.',
    materialIssues:{mat1:['hard']},lessonFlags:['structure']}},
 {id:'old2',classId:'m5now',date:'2026-01-14',status:'done',
  title:'Halbschriftliche Division',reflection:{note:'Zusätzliches AB weglassen.'}},
 {id:'wronggrade',classId:'m6',date:'2025-05-01',status:'done',title:'Halbschriftliche Division',
  reflection:{note:'Soll nicht angezeigt werden.'}},
 {id:'wrongsubject',classId:'r5',date:'2025-05-01',status:'done',title:'Halbschriftliche Division',
  reflection:{note:'Soll nicht angezeigt werden.'}},
 {id:'nomemo',classId:'m5now',date:'2025-09-04',status:'done',title:'Halbschriftliche Division'},
 {id:'cancel',classId:'m5old',date:'2025-10-01',status:'done',title:'Halbschriftliche Division',
  executionV180:{type:'cancelled'},reflection:{note:'Nicht durchgeführt.'}},
 {id:'future',classId:'m5now',date:'2027-10-01',status:'done',title:'Halbschriftliche Division',
  reflection:{note:'Aus der Zukunft.'}}];
const found=core.findings(current,past,courses);
assert.deepEqual(found.map(x=>x.id),['old2','old1']);
assert.equal(found[1].note,'Für die nächste Durchführung Material vereinfachen.');
assert.deepEqual(found[1].materialIssues,{mat1:['hard']});
assert.equal(core.findings({...current,id:'test',planReference:{title:'Klassenarbeit'}},past,courses).length,0);
assert.equal(core.findings({...current,title:'Subtraktion',planReference:null},past,courses).length,0);
assert.equal(core.normalized('Fachbegriffe: Division!'),'fachbegriffe division');
console.log('Historical reflections: exact teaching topic/grade, real past lessons, legacy notes and exclusion safeguards OK.');