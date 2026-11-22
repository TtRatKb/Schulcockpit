'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../schulcockpit-physisches-archiv-vorschau-v3326-core.js');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('preview classifies supported file types by extension without guessing unknown types',()=>{
 for(const name of ['A.pdf','A.PDF'])assert.equal(P.kind(name),'pdf');
 for(const name of ['A.png','A.jpg','A.jpeg','A.webp','A.gif','A.bmp'])assert.equal(P.kind(name),'image');
 for(const name of ['A.txt','A.md','A.csv','A.json'])assert.equal(P.kind(name),'text');
 assert.equal(P.kind('Unterricht.docx'),'docx');
 assert.equal(P.kind('Folien.pptx'),'pptx');
 for(const name of ['Alt.doc','Alt.ppt','Tabelle.xlsx','Verzeichnis.zip','unsicher.svg',''])
  assert.equal(P.kind(name),'unsupported');
});
test('slides are extracted in numeric order, never in arbitrary ZIP order',()=>{
 assert.deepEqual(P.slideNames(['ppt/slides/slide12.xml','ppt/slides/slide2.xml',
  'ppt/slides/_rels/slide1.xml.rels','ppt/slides/slide1.xml',
  'ppt/slides/notesSlide3.xml','ppt/slideMasters/slideMaster1.xml']),
 ['ppt/slides/slide1.xml','ppt/slides/slide2.xml','ppt/slides/slide12.xml']);
});
test('a very long text preview is capped while the original remains untouched',()=>{
 const s='123456789'.repeat(7000),before=s;
 assert.deepEqual(P.limitText(s,120),{text:s.slice(0,120),truncated:true});
 assert.deepEqual(P.limitText('Text',120),{text:'Text',truncated:false});
 assert.equal(s,before);
});
test('the UI offers preview independent from linking and still requires an explicit pick',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../schulcockpit-physisches-archiv-v3323.js'),'utf8');
 const C=require('../schulcockpit-physisches-archiv-v3323-core.js'),
 S=require('../schulcockpit-physisches-archiv-suche-v3324-core.js');
 const sandbox={console,Date,Map,Set,JSON,String,Number,structuredClone,Error,
  window:{SchulcockpitPhysicalArchiveV3323Core:C,SchulcockpitPhysicalArchiveSearchV3324:S,
   SchulcockpitPhysicalArchivePreviewV3326Core:P},
  document:{querySelector:()=>null},
  state:{settings:{schoolYear:'2026/27'},materialCatalog:[
    {catalogId:'ambiguous',fileName:'AB_123.pdf',sourcePath:'Ungeordnet/AB_123.pdf',
     hubV237:{subject:'Religion',grade:5}}],
   materials:[],classes:[],sequences:[]},
  esc:v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  uid:()=> 'test-id',view:'materials',modal:null,render:()=>{},wire:()=>{},
  saveState:async()=>{},materialsView:()=>'<div class="v237-import-buttons"></div>',
  focusView:()=>'<div class="content-grid"></div>',wizardPlanStepV14:()=>'<div class="v332-copies-body"></div>'
 };
 vm.createContext(sandbox);vm.runInContext(code,sandbox);
 sandbox.window.SchulcockpitPhysicalArchiveV3323.open();
 const index=sandbox.materialsView();
 assert.match(index,/Digitales Material verknüpfen/);
 assert.match(index,/id="v3324-file-query"/);
 // Nothing is selected just by displaying the query or opening a preview.
 assert.match(index,/Kein digitales Material ausgewählt/);
 assert.doesNotMatch(index,/Katalogeintrag verknüpfen/);
});
