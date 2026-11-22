'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const source=f=>fs.readFileSync(path.join(root,f),'utf8');
const C=require('../schulcockpit-physisches-archiv-v3323-core.js');
function copy(id,refKey,quantity,extra={}){
 return {id,type:'copies',refKey,quantity,locationId:'fach-07',
  title:'Arbeitsblatt',archived:false,...extra};
}
test('26 numbered folder slots and optional separate storage spots start without student data',()=>{
 const d=C.initial();
 assert.equal(d.locations.length,26);
 assert.deepEqual(d.locations.map(l=>l.name).slice(0,2),['F01','F02']);
 assert.equal(d.locations[25].id,'fach-26');
 assert.deepEqual(d.entries,[]);
 assert.equal(JSON.stringify(d).includes('students'),false);
});
test('counts must be integers, nonnegative, and refer to an existing storage location',()=>{
 const d=C.initial(),p={type:'copies',title:'Übung',locationId:'fach-02',quantity:3,
  detail:'Mappe 2',refKey:'m:mat1:v1',note:''};
 assert.equal(C.checked(p,d,'p1').quantity,3);
 assert.throws(()=>C.checked({...p,quantity:-1},d),/ganze Zahl/);
 assert.throws(()=>C.checked({...p,quantity:1.4},d),/ganze Zahl/);
 assert.throws(()=>C.checked({...p,locationId:'ungültig'},d),/Aufbewahrungsort/);
 assert.throws(()=>C.checked({...p,refKey:'m:mat1'},d),/Materialverknüpfung/);
 assert.throws(()=>C.checked({...p,title:' '},d),/Bezeichnung/);
});
test('reusable objects and keepsakes are never counted as consumable copies',()=>{
 const d=C.initial();
 d.entries=[
  copy('1','m:mat1:v1',3),copy('2','m:mat1:v1',2,{locationId:'fach-03'}),
  copy('3','m:mat1:v2',40),copy('4','m:mat1:v1',11,{archived:true}),
  copy('5','c:cat1',6),copy('6','m:mat1:v1',9,{type:'reusable'})
 ];
 assert.equal(C.available(d,'mat1','v1'),5);
 assert.equal(C.available(d,'mat1','v2'),40);
 assert.equal(C.available(d,'mat2','v1'),0);
 assert.deepEqual(C.proposal(25,3),{required:25,stock:3,fromArchive:3,toPrint:22});
 assert.deepEqual(C.proposal(1,15),{required:1,stock:15,fromArchive:1,toPrint:0});
 assert.equal(C.updateQuantity(d,'1',-3),0);
 assert.throws(()=>C.updateQuantity(d,'1',-4),/nicht negativ/);
 assert.throws(()=>C.updateQuantity(d,'missing',-1),/nicht gefunden/);
});
test('keepsakes trigger only when date arrives, and only while present',()=>{
 const d=C.initial();
 d.entries=[
  {id:'a',type:'memory',title:'Kiste',locationId:'fach-01',quantity:1,reminderDate:'2031-06-01',archived:false},
  {id:'b',type:'memory',title:'Ohne Datum',locationId:'fach-01',reminderDate:'',archived:false},
  {id:'c',type:'memory',title:'Erledigt',reminderDate:'2026-01-01',archived:true},
  copy('d','m:m:v',2)
 ];
 assert.equal(C.due(d,'2026-11-22').length,0);
 assert.deepEqual(C.due(d,'2031-06-01').map(x=>x.id),['a']);
 assert.equal(C.checked({type:'memory',title:'Für die Klasse',locationId:'fach-01',
   quantity:80,reminderDate:'2031-07-12'},d,'x').quantity,1);
});
function harness(){
 const sandbox={
  console,Date,Map,Set,Number,String,JSON,structuredClone,Error,
  window:{},uid:()=> 'test-id',esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  state:{settings:{schoolYear:'2026/27'},
   materialCatalog:[{catalogId:'c1',fileName:'Brüche – Einstiegsblatt.pdf'}],
   materials:[{id:'m1',title:'Brüche darstellen',variants:[{id:'v1',type:'standard',fileName:'AB Brüche.pdf'}]}]},
  view:'materials',modal:null,wire:()=>{},render:()=>{},
  saveState:async()=>{},
  materialsView:()=>'<div class="v237-import-buttons"><button class="secondary" data-v237-edit="c:c1">Einordnen</button></div>',
  focusView:()=>'<div class="content-grid">Start</div>',
  wizardPlanStepV14:()=>'<div class="v332-copies-body">'+
   '<label><input type="number" min="0" max="500" step="1" value="25" data-v332-count="lesson1|m1|v1"></label></div>'
 };
 sandbox.window.SchulcockpitPhysicalArchiveV3323Core=C;
 vm.createContext(sandbox);
 vm.runInContext(source('schulcockpit-physisches-archiv-v3323.js'),sandbox);
 return sandbox;
}
test('physical-archive page is optional, leaves existing material-hub and connects catalog rows',()=>{
 const s=harness();
 const hub=s.materialsView();
 assert.match(hub,/data-v3323-open/);
 assert.match(hub,/data-v3323-from-hub="c:c1"/);
 assert.match(hub,/data-v237-edit="c:c1"/);
 s.window.SchulcockpitPhysicalArchiveV3323.open('c:c1');
 const archive=s.materialsView();
 assert.match(archive,/data-v3323-save/);
 assert.match(archive,/F26/);
 assert.match(archive,/Brüche – Einstiegsblatt/);
 assert.match(archive,/Erinnerungsstück · Wiedervorlage/);
});
test('print advisory is linked to exact material variant and is never an automatic deduction',()=>{
 const s=harness(),before={
  entries:[copy('a','m:m1:v1',3)],locations:C.initial().locations,schema:1
 };
 s.state.physicalArchiveV3323=structuredClone(before);
 const lesson={id:'lesson1',printPlan:[{materialId:'m1',variantId:'v1',count:25}]};
 const html=s.wizardPlanStepV14(lesson);
 assert.match(html,/3 im Archiv, 25 benötigt, Vorschlag: 22 kopieren/);
 assert.match(html,/data-v3323-next="22"/);
 assert.equal(s.state.physicalArchiveV3323.entries[0].quantity,3);
 assert.equal(lesson.printPlan[0].count,25);
});
test('due-memory dashboard notice is read-only and opens the same archive',()=>{
 const s=harness();
 s.state.physicalArchiveV3323={schema:1,locations:C.initial().locations,
  entries:[{id:'k1',type:'memory',title:'Für die Tutorenklasse',locationId:'fach-01',
   reminderDate:'2020-08-01',archived:false}]};
 const html=s.focusView();
 assert.match(html,/Für die Tutorenklasse/);
 assert.match(html,/data-v3323-open/);
});
