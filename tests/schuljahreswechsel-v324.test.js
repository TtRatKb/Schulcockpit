'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../schulcockpit-schuljahreswechsel-v324-core.js');
const state=()=>{
 const q={id:'seq-old',classId:'class-old',schoolYearV190:'2026/27',
  title:'Brüche addieren',goal:'Brüche sicher addieren',notes:'VERTRAULICHE_LEHRER_NOTIZ',
  startDate:'2026-09-01',endDate:'2026-11-16',assessmentDate:'2026-11-20',
  sourceFilesV190:[{id:'f1',name:'Handreichung.pdf',fileKey:'available',size:34},
   {id:'f2',name:'Verloren.pdf',fileKey:'missing',size:34}],
  plan:[{id:'u1',plannedDate:'2026-09-01',title:'Gleichnamige Brüche',
   hours:'1',content:'Brüche mit gleichem Nenner',competencies:'Brüche addieren',
   objective:'Addieren',material:'Buch S. 34',notes:'STUDIERENDEN_NAME_SENSIBEL',
   materials:[{title:'Buch',kind:'book',copies:26,note:'PRIVATE_NOTIZ'}]},
   {id:'u2',plannedDate:'2026-09-08',title:'Ungleichnamige Brüche',
   hours:'1',content:'Übungen',material:'AB A',notes:'NOTIZ_VERTRAULICH'}]};
 return {settings:{schoolYear:'2026/27',sequencePlanningYearV190:'2026/27'},
  classes:[{id:'class-old',name:'5a',subject:'Mathematik',students:26,color:'#abc',
   privateRoster:['Schüler A']}],
  sequences:[q],
  lessons:[{id:'lesson-old',date:'2026-09-01',classId:'class-old',sequenceId:'seq-old',
   planReference:{unitId:'u1'},status:'done',
   phasePlan:[{phase:'Erarbeitung',minutes:15,title:'AB bearbeiten',details:'Einzelarbeit'}],
   slides:[{type:'text',title:'Addition von Brüchen',content:['Beispiel 1'],notes:'PRIVATE_TEXT'}],
   reflectionV182:{note:'SCHUELERNAME_GEHEIM'}}],
  materials:[{id:'material1',title:'Arbeitsblatt Brüche',variants:[{id:'v1',fileKey:'available'}],
   assignments:[{classId:'class-old',sequenceId:'seq-old',unitId:'u1'}]},
   {id:'teacher1',title:'Musterlösung',resourceType:'teacher',
   assignments:[{classId:'class-old',sequenceId:'seq-old',unitId:'u1'}]}],
  assessments:[{id:'ass',classId:'class-old',date:'2026-11-20',scores:{secret:1}}],
  timetable:[{id:'t',classId:'class-old',weekday:1,slot:2}]};
};
const input=()=>({sourceYear:'2026/27',targetYear:'2027/28',selectedIds:['seq-old'],
 routes:{'class-old':{mode:'new',name:'6a (2027/28)'}}});
function build(s=state(),data=input()){
 let seq=0;return C.transfer(s,data,kind=>kind+'-'+(++seq),new Set(['available']));
}
test('academic year strict and next-year calculation',()=>{
 assert(C.year('2026/27'));assert(!C.year('2026/28'));
 assert.equal(C.next('2026/27'),'2027/28');
 assert.equal(C.dateYear('2027-02-20'),'2026/27');
});
test('preview names exactly one course, one sequence, two units and available template',()=>{
 const p=C.preview(state(),input());assert.deepEqual(p.errors,[]);
 assert.equal(p.selected.length,1);assert.equal(p.unitCount,2);
 assert.equal(p.templateCount,1);assert.equal(p.materialCount,2);
});
test('source state is byte-identical after a successful pure transfer',()=>{
 const s=state(),prior=JSON.stringify(s);build(s);
 assert.equal(JSON.stringify(s),prior);
});
test('fresh class has new ID and no private roster or old student count',()=>{
 const s=state(),r=build(s),c=r.createdClasses[0];
 assert.notEqual(c.id,'class-old');assert.equal(c.students,0);
 assert(!Object.hasOwn(c,'privateRoster'));
 assert.equal(c.schoolYearV324,'2027/28');
});
test('future sequence has new ID, provenance, zero old dates and no assessment date',()=>{
 const r=build(),q=r.createdSequences[0];
 assert.notEqual(q.id,'seq-old');assert.equal(q.schoolYearV190,'2027/28');
 assert.equal(q.originSequenceIdV324,'seq-old');
 assert.equal(q.startDate,'');assert.equal(q.endDate,'');assert.equal(q.assessmentDate,'');
 assert(q.plan.every(u=>!u.plannedDate));
 assert.equal(q.plan[0].title,'Gleichnamige Brüche');
});
test('future unit IDs and original curriculum content are preserved',()=>{
 const q=build().createdSequences[0];
 assert.notEqual(q.plan[0].id,'u1');
 assert.equal(q.plan[0].content,'Brüche mit gleichem Nenner');
 assert.equal(q.plan[0].competencies,'Brüche addieren');
 assert.equal(q.plan[0].material,'Buch S. 34');
});
test('old course data and dates are preserved in returned arrays',()=>{
 const s=state(),r=build(s);
 assert.deepEqual(r.classes[0],s.classes[0]);
 assert.deepEqual(r.sequences[0],s.sequences[0]);
 assert.deepEqual(r.materials[0].assignments[0],s.materials[0].assignments[0]);
});
test('next-year materials are linked without duplicating library records',()=>{
 const r=build();
 assert.equal(r.materials.length,2);
 assert.equal(r.linkedMaterials.length,1);
 assert.equal(r.materials[0].assignments.length,2);
 assert.equal(r.materials[1].assignments.length,1);
});
test('unsafe teacher-only solutions are not assigned as student print material',()=>{
 const r=build();
 assert(!r.linkedMaterials.some(x=>x.materialId==='teacher1'));
});
test('missing locally stored original references are not claimed available',()=>{
 const r=build(),files=r.createdSequences[0].sourceFilesV190;
 assert.equal(files.length,1);assert.equal(files[0].fileKey,'available');
});
test('private notes, assessments, completed flags and reflection data are not copied',()=>{
 const r=build();const extra=JSON.stringify(r.createdSequences);
 for(const sensitive of ['STUDIERENDEN_NAME_SENSIBEL','VERTRAULICHE_LEHRER_NOTIZ','PRIVATE_NOTIZ','SCHUELERNAME_GEHEIM'])
 assert(!extra.includes(sensitive));
 assert(!Object.hasOwn(r,'assessments'));assert(!Object.hasOwn(r,'lessons'));
});
test('source lesson is only referenced as a template and does not create held lessons',()=>{
 const r=build(),unit=r.createdSequences[0].plan[0];
 assert.equal(unit.reuseV324.sourceLessonId,'lesson-old');
 assert.equal(unit.reuseV324.hadSlides,true);
 assert.equal(unit.reuseV324.hadPhases,true);
});
test('manual template copies teaching content but not speaker notes or result flags',()=>{
 const original=state().lessons[0],before=JSON.stringify(original);
 const t=C.lessonContent(original);
 assert.equal(t.phasePlan.length,1);assert.equal(t.slides[0].title,'Addition von Brüchen');
 assert.equal(t.slides[0].notes,'');assert(!Object.hasOwn(t,'status'));
 assert(!JSON.stringify(t).includes('PRIVATE_TEXT'));
 assert.equal(JSON.stringify(original),before);
});
test('unsupported future year cannot be selected',()=>{
 const i=input();i.targetYear='2028/29';assert(C.preview(state(),i).errors.length);
});
test('bad target class and old year class as existing target cannot pass validation',()=>{
 const i=input();i.routes['class-old']={mode:'existing',targetId:'class-old'};
 assert(C.preview(state(),i).errors.length);
});
test('repeating the same new target course after transfer is blocked',()=>{
 const s=state(),r=build(s);s.classes=r.classes;s.sequences=r.sequences;
 assert(C.preview(s,input()).errors.some(x=>x.includes('existiert bereits')));
});
test('repeating a sequence into an existing target course is blocked',()=>{
 const s=state();s.classes.push({id:'future',name:'6b',subject:'Mathematik',schoolYearV324:'2027/28'});
 const i=input();i.routes['class-old']={mode:'existing',targetId:'future'};
 const first=build(s,i);s.sequences=first.sequences;
 assert(C.preview(s,i).errors.some(x=>x.includes('Reihe existiert')));
});
test('source and target can remain untouched if no selection has been made',()=>{
 const i=input();i.selectedIds=[];assert(C.preview(state(),i).errors.length);
});
test('old class roster in same global state remains associated only with old ID',()=>{
 const s=state(),r=build(s);
 assert.equal(r.classes[0].privateRoster[0],'Schüler A');
 assert.equal(r.createdClasses[0].students,0);
});
test('teacher can move different source sequences into separate new-year course',()=>{
 const s=state();s.sequences.push({...s.sequences[0],id:'seq-second',title:'Geometrie',
  plan:[{id:'u-second',title:'Rechteck',plannedDate:'2026-10-01'}]});
 const i=input();i.selectedIds=['seq-second'];
 const r=build(s,i);
 assert.equal(r.createdSequences.length,1);assert.equal(r.createdSequences[0].title,'Geometrie');
});
