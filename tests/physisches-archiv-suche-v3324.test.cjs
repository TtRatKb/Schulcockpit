'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const P=require('../schulcockpit-physisches-archiv-suche-v3324-core.js');
const C=require('../schulcockpit-physisches-archiv-v3323-core.js');
const PV=require('../schulcockpit-physisches-archiv-vorschau-v3326-core.js');

function fixture(){
 const catalog=Array.from({length:900},(_,i)=>({
  catalogId:'cat-'+i,fileName:'Übungsblatt '+i+'.pdf',
  hubV237:{subject:i%2?'Religion':'Mathematik',grade:i%2?6:5},
  hubV238:{archiveTopic:i%2?'Ethik':'Brüche'},
  sourcePath:'Schuljahr2026/'+(i%2?'Religion/6/Ethik':'Mathe/5/Brüche')+'/AB_'+i+'.pdf'
 }));
 catalog[899]={catalogId:'cat-last',fileName:'Japanische Feste – Shinto.pdf',
  hubV237:{subject:'Religion',grade:7},hubV238:{topicPath:'Japanische Religionen'},
  sourceArchive:'ReligionArchiv.zip',
  sourcePath:'Jahrgang7/Japanische Religionen/Japanische_Feste.pdf'};
 const materials=[
  {id:'mat-4',title:'Material zum Thema Prozentrechnung',
   variants:[{id:'standard',type:'standard',fileName:'Prozente_AB.pdf'},
    {id:'help',type:'support',fileName:'Prozente_Hilfe.pdf'}],
   assignments:[{classId:'class-6',sequenceId:'seq-prozente'},
     {classId:'class-5',sequenceId:'seq-prozente'}]},
  {id:'mat-5',title:'Originalarbeit',variants:[{id:'v',type:'standard',fileName:'Eigene Fassung.pdf'}],
   hubV237:{subject:'Mathematik',grade:8}}
 ];
 const classes=[
  {id:'class-6',name:'6a',subject:'Mathematik'},
  {id:'class-5',name:'5b',subject:'Mathematik'}
 ];
 const sequences=[{id:'seq-prozente',title:'Prozentrechnung'}];
 return {catalog,materials,classes,sequences};
}
test('complete catalog including the 900th file is searchable without the old 350-item cut',()=>{
 const f=fixture();
 const snapshot=JSON.stringify(f),rows=P.build(f.materials,f.catalog,f.classes,f.sequences);
 assert.equal(rows.length,903);
 assert.equal(P.filter(rows,{search:'Shinto'}).length,1);
 assert.equal(P.filter(rows,{search:'Shinto'})[0].id,'c:cat-last');
 assert.deepEqual(P.filter(rows,{search:'Japanische Feste',subject:'Religion',grade:'7',topic:'Japanische Religionen'}).map(x=>x.id),['c:cat-last']);
 assert.equal(JSON.stringify(f),snapshot);
});
test('topic filter includes both catalog and material metadata with correct subject and year',()=>{
 const f=fixture(),rows=P.build(f.materials,f.catalog,f.classes,f.sequences);
 assert.equal(P.filter(rows,{subject:'Mathematik',grade:5,topic:'Brüche'}).length,450);
 assert.equal(P.filter(rows,{subject:'Religion',grade:6,topic:'Ethik'}).length,449);
 const facets=P.facets(rows,{subject:'Mathematik',grade:'5'});
 assert.ok(facets.topics.includes('Brüche'));
 assert.ok(facets.topics.includes('Prozentrechnung'));
 assert.ok(!facets.topics.includes('Ethik'));
 assert.ok(facets.grades.includes(5)&&facets.grades.includes(6)&&facets.grades.includes(8));
 const variants=P.filter(rows,{search:'Prozente',subject:'Mathematik',grade:6,topic:'Prozentrechnung'});
 assert.deepEqual(variants.map(x=>x.id).sort(),['m:mat-4:help','m:mat-4:standard']);
});
test('missing known topic or subject does not invent assignments and remains searchable',()=>{
 const docs=[
  {catalogId:'catalog-1',fileName:'Individuelle_Betrachtung.pdf',sourcePath:'Neutral/Ordner/Individuelle_Betrachtung.pdf'},
  {catalogId:'catalog-2',fileName:'AB Differenzierung.pdf',sourcePath:'Mathe/7/Geometrie/AB.pdf'}
 ];
 const rows=P.build([],docs,[],[]);
 const unknown=rows.find(x=>x.id==='c:catalog-1');
 assert.deepEqual(unknown.subjects,[]);assert.deepEqual(unknown.grades,[]);
 assert.equal(P.filter(rows,{search:'Individuelle'}).length,1);
 const known=P.filter(rows,{subject:'Mathematik',grade:7,topic:'Geometrie'});
 assert.deepEqual(known.map(x=>x.id),['c:catalog-2']);
});
test('no item is lost when 800 materials have multiple distinct variants and old catalog entries',()=>{
 const materials=Array.from({length:800},(_,i)=>({
  id:'m'+i,title:'Lernblatt '+i,
  variants:[{id:'standard',fileName:'Datei '+i+'.pdf'},
    {id:'support',fileName:'Unterstützung '+i+'.pdf'}]
 }));
 const rows=P.build(materials,[],[],[]);
 assert.equal(rows.length,1600);
 assert.equal(P.filter(rows,{search:'Lernblatt 799'}).length,2);
 assert.deepEqual(P.filter(rows,{search:'Unterstützung 799'}).map(x=>x.id),['m:m799:support']);
});
test('UI uses filtering and bounded result list instead of one enormous select',()=>{
 const f=fixture(),sandbox={
  console,Date,Map,Set,JSON,String,Number,structuredClone,Error,
  window:{SchulcockpitPhysicalArchiveSearchV3324:P,SchulcockpitPhysicalArchiveV3323Core:C,
   SchulcockpitPhysicalArchivePreviewV3326Core:PV},
  document:{querySelector:()=>null},
  uid:()=> 'mock-id',
  state:{settings:{schoolYear:'2026/27'},materials:f.materials,materialCatalog:f.catalog,
   classes:f.classes,sequences:f.sequences},
  esc:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  materialsView:()=>'<div class="v237-import-buttons"></div>',
  focusView:()=>'<div class="content-grid"></div>',
  wizardPlanStepV14:()=>'<div class="v332-copies-body"></div>',
  view:'materials',modal:null,render:()=>{},wire:()=>{},saveState:async()=>{}
 };
 vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-physisches-archiv-v3323.js'),'utf8'),sandbox);
 sandbox.window.SchulcockpitPhysicalArchiveV3323.open();
 const html=sandbox.materialsView();
 assert.match(html,/id="v3324-file-query"/);
 assert.match(html,/id="v3324-subject"/);
 assert.match(html,/id="v3324-grade"/);
 assert.match(html,/id="v3324-topic"/);
 assert.match(html,/903 Dateien und Fassungen sind insgesamt durchsuchbar/);
 assert.doesNotMatch(html,/data-v3323-field="refKey"><option/);
 assert.match(html,/Kein digitales Material ausgewählt/);
});
