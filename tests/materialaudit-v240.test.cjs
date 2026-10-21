'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const h=require('../schulcockpit-materialaudit-v240.js');
test('Path classification separates classroom worksheet, workshop and exam solutions',()=>{
 const list=[
 [{fileName:'Fachbegriffe Addition Lo╠êsungen.docx',sourcePath:'Mathe 5/Grundrechenarten I/Fachbegriffe Addition Lo╠êsungen.docx'},'arbeitsblattloesung'],
 [{fileName:'3 G Schriftliche Addition Lo╠êsungen.docx',sourcePath:'Mathe 5/Mathematische Werkstatt/Lo╠êsungen/3 G Schriftliche Addition Lo╠êsungen.docx'},'werkstattloesung'],
 [{fileName:'Musterlösung KA1.pdf',sourcePath:'Mathematik/5/Grundrechenarten I Arbeit/Musterlösung KA1.pdf'},'klausurloesung'],
 [{fileName:'Klassenarbeit Nr1 2026 2027 Inkl..docx',sourcePath:'Mathe 5/Grundrechenarten I Arbeit/Klassenarbeit Nr1 2026 2027 Inkl..docx'},'inklusion'],
 [{fileName:'Klassenarbeit Nr1 A-Version.pdf',sourcePath:'Mathe 5/Grundrechenarten I Arbeit/Klassenarbeit Nr1 A-Version.pdf'},'referenzarbeit'],
 [{fileName:'Themenkarte Grundrechenarten I & II 2026-27.docx'},'reihenplanung'],
 [{fileName:'Mathewerkstatt E Ziffern und Zahlen.pdf'},'werkstatt'],
 [{fileName:'Grundaufgaben Division.pdf'},'arbeitsblatt'],
 [{fileName:'3 Das altorientalische Weltbild.pdf',courseLabel:'Religion 11',sequenceTitle:'Weltbilder'},'quelle']
 ];
 for(const [e,result] of list)assert.equal(h.classify(e),result,e.fileName);
});
test('Religion 11 Weltbilder from backlog can be finished without creating a fake teaching unit',()=>{
 const e={fileName:'3 Das altorientalische Weltbild.pdf',scope:'backlog',courseLabel:'Religion 11',sequenceTitle:'Weltbilder'};
 const r=h.recommendation(e);assert.equal(r.subject,'Religion');assert.equal(r.grade,11);
 assert.equal(r.oldStatus,'unassigned');assert.equal(r.newStatus,'pool');
 assert.equal(r.confident,true);assert.equal(r.statusChanged,true);
});
test('Counts add to exact number of material objects, including other kinds',()=>{
 const xs=[
  {fileName:'Mathewerkstatt G 1.pdf'},
  {fileName:'Grundaufgaben 3.pdf'},
  {fileName:'Random datei.file'},
  {fileName:'Erwartungshorizont Klassenarbeit.pdf'},
  {fileName:'Klassenarbeit B.pdf'}
 ];
 const c=h.counts(xs);
 assert.equal(c.total,xs.length);
 assert.equal(Object.values(c.by).reduce((a,b)=>a+b,0),c.total);
 assert.equal(c.by.klausurloesung,1);
 assert.equal(c.by.sonstiges,1);
});
test('Already manually confirmed type preserved, while status can be repaired',()=>{
 const e={fileName:'3 Das altorientalische Weltbild.pdf',courseLabel:'Religion 11',scope:'backlog',
   hubV237:{kind:'arbeitsblatt',status:'unassigned',subject:'Religion',grade:11,reviewedAt:'2026-10-21'}};
 const r=h.recommendation(e);assert.equal(r.kind,'arbeitsblatt');
 assert.equal(r.statusChanged,true);assert.equal(r.manual,true);
});
test('Never claim grade or content without file path evidence',()=>{
 const e={fileName:'Aufgabe 7.pdf',sourceArchive:'alte dateien'};
 assert.deepEqual(h.loc(e),{subject:'',grade:0});
 assert.equal(h.recommendation(e).confident,false);
});
function fixture(){
 const catalog=[
  {catalogId:'rel11',fileName:'3 Das altorientalische Weltbild.pdf',courseLabel:'Religion 11',sequenceTitle:'Weltbilder',scope:'backlog'},
  {catalogId:'matwork',fileName:'G Schriftliche Division.pdf',sourcePath:'Mathe/Klasse 05/Mathematische Werkstatt/6 Division/G Schriftliche Division.pdf',
    hubV237:{subject:'Mathematik',grade:5,kind:'sonstiges',status:'pool'},scope:'sequence_pool'},
  {catalogId:'mathka',fileName:'Klassenarbeit Nr1 Inkl..docx',sourcePath:'Mathe 5/Grundrechenarten I Arbeit/Klassenarbeit Nr1 Inkl..docx',
    hubV237:{subject:'Mathematik',grade:5,kind:'sonstiges',status:'pool'},scope:'sequence_pool'},
  {catalogId:'unknown',fileName:'Dokument 7.unknown',scope:'backlog'}
 ];
 const classes=[{id:'r11',subject:'Religion',name:'11'},{id:'m5',subject:'Mathematik',name:'5f'}];
 const state={materialCatalog:catalog,materials:[],classes,settings:{schoolYear:'2026/27'}};
 let modal=null;const listeners={};let savedCatalog=0,savedState=0;
 const doc={getElementById:id=>id==='v240-fix-reviewed'?{checked:true}:null,querySelector:(key)=>{
   if(key==='[data-v240-review]')return {addEventListener(_k,cb){listeners.open=cb;}};
   if(key==='[data-v240-apply]')return {addEventListener(_k,cb){listeners.apply=cb;}};
   if(key==='[data-v237-folder].active')return {dataset:{v237Folder:'Mathematik|5'}};
   if(key==='#v240-fix-reviewed')return {checked:true};
   return null;
  },querySelectorAll:()=>[]};
 const ctx={state,document:doc,console,Date,Set,Map,Promise,modal,
  cls:id=>classes.find(c=>c.id===id),uid:()=>1,
  clone:x=>JSON.parse(JSON.stringify(x)),downloadText:()=>{},
  esc:x=>String(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  materialsView:()=>'<div><button>Material ohne Datei anlegen</button><section class="panel v237-list">list</section></div>',
  modalHtml:()=>'',wire:()=>{},render:()=>{},
  alert:()=>{},persistCatalogV171:async()=>{savedCatalog++;},saveState:async()=>{savedState++;}
 };
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','schulcockpit-materialaudit-v240.js'),'utf8'),ctx);
 return {ctx,listeners,state,get savedCatalog(){return savedCatalog},get savedState(){return savedState}};
}
test('Bulk preview and apply repairs backlog and reclassifies workshop/exam; no file keys changed',async()=>{
 const t=fixture(),oldIds=t.state.materialCatalog.map(x=>x.catalogId);
 assert.match(t.ctx.materialsView(),/Dateien automatisch nachsortieren/);
 assert.match(t.ctx.materialsView(),/Alle 2 Einträge nach Materialart/);
 t.ctx.wire();t.listeners.open();assert.match(t.ctx.modalHtml(),/BESTAND AUTOMATISCH AUFRÄUMEN/);
 t.ctx.wire();t.listeners.apply({currentTarget:{disabled:false}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.savedCatalog,1);
 assert.deepEqual(t.state.materialCatalog.map(x=>x.catalogId),oldIds);
 const r=t.state.materialCatalog[0];assert.equal(r.hubV237.status,'pool');assert.equal(r.scope,'sequence_pool');
 assert.equal(r.sequenceTitle,'Weltbilder');assert.equal(r.hubV237.grade,11);
 assert.equal(t.state.materialCatalog[1].hubV237.kind,'werkstatt');
 assert.equal(t.state.materialCatalog[2].hubV237.kind,'inklusion');
 assert.equal(t.state.materialCatalog[3].scope,'backlog');
});
