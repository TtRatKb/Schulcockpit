'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../schulcockpit-unterricht-verbessern-v326-core.js');
function fixture(){
 return {classes:[
  {id:'c5',name:'5a',subject:'Mathematik',students:26,roster:['SCHUELERNAME_PRIVAT']},
  {id:'c8',name:'8',subject:'Religion',students:25}],
  lessons:[
   {id:'l5',classId:'c5',date:'2026-11-13',title:'Brüche addieren',status:'done',
    planReference:{title:'Brüche addieren'},printPlan:[{id:'p',materialId:'m5',variantId:'v1',needed:true}],
    reflectionV182:{note:'SCHUELERNAME_PRIVAT war sehr müde'}},
   {id:'l8',classId:'c8',date:'2026-11-12',title:'Die fünf Säulen',status:'done',
    presentationReady:true,presentationBlobKeyV180:'lesson-ppt-l8',presentationFileName:'Islam.pptx'}],
  materials:[{id:'m5',title:'Arbeitsblatt Brüche',variants:[
    {id:'v1',type:'standard',fileName:'AB_Original.pdf',fileKey:'blob-1'},
    {id:'v2',type:'support',fileName:'AB_Leichter.pdf',fileKey:'blob-2'}],
    improvementFlags:['zu schwer']}],
  backlog:[
   {id:'b-lesson',type:'reflectionV182',lessonId:'l5',classId:'c5',
    title:'Stundenablauf überarbeiten',kind:'lesson',sourceDate:'2026-11-13',
    detail:'SCHUELERNAME_PRIVAT braucht Hilfe',note:'SCHUELERNAME_PRIVAT',
    flags:['active_students','thinking'],done:false},
   {id:'b-mat',type:'reflectionV182',lessonId:'l5',classId:'c5',materialId:'m5',
    title:'Material überarbeiten',kind:'material',sourceDate:'2026-11-13',
    detail:'Schülername SCHUELERNAME_PRIVAT aus Freitext',
    flags:['hard','support'],done:false},
   {id:'b-ppt',type:'reflectionV182',lessonId:'l8',classId:'c8',
    title:'PowerPoint überarbeiten',kind:'ppt',sourceDate:'2026-11-12',
    flags:['too_much','task'],done:true},
   {id:'b-old',materialId:'m5',title:'Mehr Schreibplatz',
    detail:'Nur eine manuelle Freitextnotiz mit SCHUELERNAME_PRIVAT',effort:'30',done:false}
  ]};
}
const items=()=>C.collect(fixture(),['blob-1','lesson-ppt-l8']);
test('all existing V182 and legacy tasks share one backlog, no duplicate task model',()=>{
 const x=items();assert.equal(x.length,4);
 assert.deepEqual(x.map(x=>x.id),['b-lesson','b-mat','b-ppt','b-old']);
});
test('status counts are based on actual documented tasks, not inferred lesson quality',()=>{
 const s=C.summarize(items());assert.equal(s.all,4);assert.equal(s.open,3);
 assert.equal(s.done,1);assert.equal(s.lesson,1);assert.equal(s.material,2);
});
test('filter by status, type and subject',()=>{
 const x=C.filter(items(),{status:'open',kind:'material',subject:'Mathematik'});
 assert.equal(x.length,1);assert(x.every(x=>x.kind==='material'&&!x.done));
 // Alte Aufgaben ohne bekannte Fachzuordnung werden nicht willkürlich zugeordnet.
 assert.equal(C.collect(fixture(),[]).find(i=>i.id==='b-old').subject,'');
});
test('strong original material priority over less urgent improvement ideas',()=>{
 const x=C.filter(items(),{status:'open'});
 assert.equal(x[0].id,'b-mat');assert.equal(x[0].priority,2);
});
test('completed reflection tasks can be inspected without changing completion state',()=>{
 const x=C.filter(items(),{status:'done'});
 assert.deepEqual(x.map(x=>x.id),['b-ppt']);
});
test('unknown old task details are not treated as reliable structured flags',()=>{
 const x=items().find(x=>x.id==='b-old');
 assert.deepEqual(x.issues,[]);assert.equal(x.kind,'material');
});
test('old class labels such as 5a and Jahrgang 11 are interpreted as grades only',()=>{
 assert.equal(C.grade('5a'),'5');assert.equal(C.grade('11.1'),'11');
 assert.equal(C.grade('E-Kurs'),'');
});
test('student worksheet source is the actually selected local variant',()=>{
 const x=items().find(x=>x.id==='b-mat');
 assert.equal(x.source.fileKey,'blob-1');
 assert.equal(x.source.name,'AB_Original.pdf');
 assert.equal(x.hasOriginal,true);
});
test('source stays unavailable when stored file bytes are absent',()=>{
 const x=C.collect(fixture(),[]).find(x=>x.id==='b-mat');
 assert.equal(x.hasOriginal,false);
 assert.equal(x.source.fileKey,'');
});
test('PPT source only appears when its local blob is stored',()=>{
 const x=items().find(x=>x.id==='b-ppt');
 assert.equal(x.source.fileKey,'lesson-ppt-l8');
 assert.equal(x.source.name,'Islam.pptx');
});
test('prompt never copies reflective free text or pupil information',()=>{
 const i=items().find(x=>x.id==='b-lesson'),prompt=C.brief(i,'active');
 assert(!prompt.includes('SCHUELERNAME_PRIVAT'));
 assert(!prompt.includes('brauch Hilfe'));
 assert(prompt.includes('Mehr Schüleraktivität'));
 assert(prompt.includes('Kognitiv aktivieren'));
});
test('different pedagogical focuses result in meaningfully different tasks',()=>{
 const i=items()[0];
 const a=C.brief(i,'active'),b=C.brief(i,'differentiate'),c=C.brief(i,'check');
 assert.notEqual(a,b);assert.notEqual(b,c);
 assert(a.includes('Lernenden selbst'));assert(b.includes('gestuften Hilfen'));
 assert(c.includes('formative Überprüfung'));
});
test('prompt expects genuine student action instead of arbitrary digital gimmicks',()=>{
 const s=C.brief(items()[0],'thinking');
 assert(s.includes('kognitive Aktivierung'));assert(s.includes('Digitale Tools nur dort'));
 assert(s.includes('maximal 5 Minuten Zusatzvorbereitung'));
});
test('prompt does not invent unseen worksheet details',()=>{
 const s=C.brief(C.collect(fixture(),[])[1],'clarity');
 assert(s.includes('erfinde keine vorhandenen Aufgaben'));
 assert(s.includes('Ohne Originaldatei'));
});
test('invalid focus is rejected explicitly',()=>{
 assert.throws(()=>C.brief(items()[0],'unknown'),/Unbekannter/);
});
test('proposed focus is based only on chosen flags, not hidden learner data',()=>{
 const x=items();
 assert.equal(C.focusFor(x.find(i=>i.id==='b-mat')),'differentiate');
 assert.equal(C.focusFor(x.find(i=>i.id==='b-lesson')),'active');
});
test('source and task IDs are never mutated by rendering or prompt drafting',()=>{
 const data=fixture(),before=JSON.stringify(data);
 C.summarize(C.collect(data,['blob-1']));
 C.brief(C.collect(data,['blob-1'])[0],'check');
 assert.equal(JSON.stringify(data),before);
});
test('filesystem-safe filenames do not encode unsafe path separators',()=>{
 const s=C.bundleName({kind:'material',title:'../AB \u0000 Brüche/ Lösung?.pdf'});
 assert(!s.includes('../'));assert(!s.includes('/'));assert(!s.includes('?'));
});
test('legacy tasks remain filterable after being marked done in current state',()=>{
 const f=fixture();f.backlog[3].done=true;
 const x=C.filter(C.collect(f,[]),{status:'done'});
 assert.equal(x.length,2);
});
