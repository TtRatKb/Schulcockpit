'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../schulcockpit-physisches-archiv-extras-v3327-core.js');
const C=require('../schulcockpit-physisches-archiv-v3323-core.js');
test('real class names and explicit grades give a clear year without inventing pupils',()=>{
 assert.equal(E.classGrade({name:'5b',subject:'Mathematik'}),5);
 assert.equal(E.classGrade({name:'Religion 7',subject:'Religion'}),7);
 assert.equal(E.classGrade({name:'11',subject:'Religion'}),11);
 assert.equal(E.classGrade({name:'Tutorengruppe',grade:5}),5);
 assert.equal(E.classGrade({name:'Tutorengruppe'}),null);
 assert.equal(E.classLabel({name:'5b',subject:'Mathematik'},'2026/27'),'Klasse 5b · 2026/27');
});
test('from fifth grade in 2026/27, end-of-grade-ten reminder is 1 June 2032, not an invented holiday date',()=>{
 assert.deepEqual(E.reminder('end10',{name:'5b'},'2026/27','2026-11-22'),{
  date:'2032-06-01',label:'Vor Ende von Jahrgang 10 erinnern'
 });
 assert.equal(E.reminder('end13',{grade:5},'2026/27','2026-11-22').date,'2035-06-01');
 assert.equal(E.reminder('endSchoolYear',null,'2026/27','2026-11-22').date,'2027-06-01');
 assert.equal(E.reminder('year',null,'2026/27','2026-11-22').date,'2027-11-22');
 assert.equal(E.reminder('none',null,'2026/27','2026-11-22').date,'');
 assert.equal(E.reminder('custom',null,'2026/27','2026-11-22').date,'');
});
test('invalid or already-completed grade reminder never silently claims a date',()=>{
 assert.match(E.reminder('end10',null,'2026/27','2026-11-22').error,/Klasse/);
 assert.match(E.reminder('end10',{name:'Tutorengruppe'},'2026/27','2026-11-22').error,/Jahrgang/);
 assert.match(E.reminder('end10',{grade:11},'2026/27','2026-11-22').error,/bereits/);
 assert.match(E.reminder('end10',{grade:5},'unbekannt','2026-11-22').error,/Schuljahr/);
 assert.equal(E.reminder('year',null,'2026/27','2027-02-28').date,'2028-02-28');
 assert.equal(E.reminder('year',null,'2026/27','2028-02-29').date,'2029-02-28');
});
test('ordinary original files can be added but not executables, empty files or >80 MB',()=>{
 for(const name of ['Arbeitsblatt.pdf','Test.DOCX','Folien.pptx','Foto.jpeg','Karte.PNG','Hinweis.txt','Mappe.odt'])
  assert.equal(E.validFile({name,size:512}),name);
 assert.throws(()=>E.validFile({name:'setup.exe',size:200}),/Bitte PDF/);
 assert.throws(()=>E.validFile({name:'kein.ext',size:200}),/Bitte PDF/);
 assert.throws(()=>E.validFile({name:'leer.pdf',size:0}),/nicht leer/);
 assert.throws(()=>E.validFile({name:'zu-gross.pdf',size:81*1024*1024}),/80 MB/);
});
test('original archive entries keep their location, count and reminders on the new optional fields',()=>{
 const d=C.initial();
 const old={type:'memory',title:'Zeitkapsel 5b',locationId:'fach-07',quantity:1,
  cohort:'5b · Schuljahr 2026/27',reminderDate:'2032-06-01',
  reminderLabel:'Briefe zurückgeben'};
 const v=C.checked(old,d,'old-id');
 assert.equal(v.locationId,'fach-07');
 assert.equal(v.reminderDate,'2032-06-01');
 assert.equal(v.cohort,old.cohort);
 assert.equal(v.classIdV3327,'');
 assert.equal(v.reminderModeV3327,'');
 const next=C.checked({...old,classIdV3327:'course5b',
   startingGradeV3327:'5',reminderModeV3327:'end10'},d,'old-id');
 assert.equal(next.classIdV3327,'course5b');
 assert.equal(next.startingGradeV3327,'5');
 assert.equal(next.reminderModeV3327,'end10');
});
