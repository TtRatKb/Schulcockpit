'use strict';
const assert=require('node:assert/strict'),test=require('node:test');
const C=require('../schulcockpit-wochen-druck-v322-core.js');
function row({lesson='l1',course='5a',name='Brueche.pdf',key='blob',mode='bw',copies=26,plan='p',date='2026-11-16',id='m'}={}){
 const p={id:plan,materialId:id,variantId:'v',mode,needed:true,count:copies,alreadyPrinted:false};
 return {lesson:{id:lesson,classId:course,date,period:'2. Block',printPlan:[p]},
 cls:{subject:'Mathe',name:course},plan:p,variant:{fileKey:key,fileName:name,label:'Standard'},
 material:{title:'AB Brüche'},copies,fileReady:true};
}
test('same local file in two courses is only one ZIP entry but 50 copies',()=>{
 const data=C.normalize({available:[row(),row({lesson:'l2',course:'5b',copies:24})]});
 assert.equal(data.groups.length,1);assert.equal(data.groups[0].copies,50);
 assert.equal(data.groups[0].rows.length,2);
});
test('same file in different color modes stays separate',()=>{
 const data=C.normalize({available:[row(),row({lesson:'l2',mode:'color'})]});
 assert.equal(data.groups.length,2);
 assert(data.groups.some(x=>x.name.startsWith('FARBE/')));
 assert(data.groups.some(x=>x.name.startsWith('SW/')));
});
test('identical names with different actual fileKey are not merged',()=>{
 const data=C.normalize({available:[row(),row({lesson:'l2',key:'other'})]});
 assert.equal(data.groups.length,2);
});
test('different editions with different source files remain independent',()=>{
 const data=C.normalize({available:[row({name:'Standard.pdf'}),row({lesson:'l2',name:'Inklusion.pdf',key:'incl'})]});
 assert.equal(data.groups.length,2);
 assert(data.groups.some(x=>x.sourceFileName==='Inklusion.pdf'));
});
test('duplicates of a lesson and physical print row are flagged',()=>{
 const r=row();const data=C.normalize({available:[r,r]});
 assert.equal(data.groups.length,1);assert.equal(data.invalid.length,1);
});
test('unsafe file names do not escape ZIP folders',()=>{
 const data=C.normalize({available:[row({name:'../Muster?Brüche.pdf'})]});
 assert(!data.groups[0].name.includes('../'));
 assert(!data.groups[0].name.includes('?'));
});
test('manifest retains exact per-course allocations and no private roster',()=>{
 const r={available:[row(),row({lesson:'l2',course:'5b',copies:24})],missing:[],excluded:[]};
 const m=C.printableManifest(r,{weekStart:'2026-11-16',generatedAt:'2026-11-14'});
 assert.equal(m.groups.length,1);
 assert.equal(m.groups[0].copies,50);
 assert.deepEqual(m.groups[0].distribution.map(x=>x.copies),[26,24]);
 assert(!JSON.stringify(m).includes('studentName'));
});
test('manifest shows missing originals and excluded stale entries',()=>{
 const m=C.printableManifest({available:[row()],missing:[row({lesson:'l2',name:'Fehlt.pdf',key:'no'})],
 excluded:[{lessonId:'old',reason:'Bereits ausgeteilt'}]},{weekStart:'2026-11-16'});
 const txt=C.printList(m);
 assert(txt.includes('Fehlt.pdf'));
 assert(txt.includes('Bereits ausgeteilt'));
 assert(txt.includes('nichts automatisch'));
});
test('grouping is pure, original print flags remain unchanged',()=>{
 const r=row(),raw={available:[r]};const before=JSON.stringify(raw);
 C.normalize(raw);C.printableManifest(raw);
 assert.equal(JSON.stringify(raw),before);
 assert.equal(r.plan.alreadyPrinted,false);
});
test('zero and implausible counts are not silently exported',()=>{
 const out=C.normalize({available:[row({copies:0}),row({lesson:'l2',copies:700})]});
 assert.equal(out.groups.length,0);assert.equal(out.invalid.length,2);
});
test('no open jobs means no phantom files',()=>{
 const out=C.normalize({available:[],missing:[],excluded:[]});
 assert.equal(out.groups.length,0);assert.equal(out.totalCopies,0);
});
test('ZIP entry gets distinct names if different local files share same basename',()=>{
 const out=C.normalize({available:[row({key:'first'}),row({key:'second',lesson:'l2'})]});
 assert.notEqual(out.groups[0].name,out.groups[1].name);
});
