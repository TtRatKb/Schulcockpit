/* V0.23.9: only selected blobs stored, never an entire 1.28GB class folder */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const h=require('../schulcockpit-materialfolder-v239.js');
function item(relativePath,megabytes=1){
 const name=relativePath.split('/').pop();
 return {name,webkitRelativePath:relativePath,size:Math.floor(megabytes*1024*1024)};
}
const root='Klasse 05/';
function sample(){
 return [
  item(root+'1 Grundrechenarten I und II/Schuljahr 2024-2025/Mathematische Werkstatt/AB1.docx',3),
  item(root+'1 Grundrechenarten I und II/Schuljahr 2026-2027/Mathematische Werkstatt/AB1.docx',1),
  item(root+'1 Grundrechenarten I und II/Schuljahr 2026-2027/Mathematische Werkstatt/Lo╠êsungen/AB1 Lo╠êsung.docx',0.2),
  item(root+'1 Grundrechenarten I und II/Schuljahr 2026-2027/Klassenarbeit Nr1 Inkl..docx',1),
  item(root+'1 Grundrechenarten I und II/Schuljahr 2025-2026/Klassenarbeit Nr1.docx',2),
  item(root+'1 Grundrechenarten I und II/Schuljahr 2026-2027/Themenkarte Grundrechenarten I & II.docx',0.1),
  item(root+'2 Brüche als Anteile/Schuljahr 2022-2023/AB Brüche.pdf',4),
  item(root+'2 Brüche als Anteile/Schuljahr 2025-2026/AB Brüche.pdf',0.5),
  item(root+'00 Hintergrundbibliothek/Methodenkarten.pdf',0.1),
  item(root+'2 Brüche als Anteile/2 Brüche als Anteile.zip',900),
  item(root+'1 Grundrechenarten I und II/.DS_Store',0.01),
  item(root+'2 Brüche als Anteile/Schuljahr 2024-2025/._AB Brüche.pdf',0.01)
 ];
}
test('year and topic grouping use latest year per theme rather than global latest',()=>{
 const data=h.analyze(sample());
 assert.equal(data.topics.length,3);
 assert.equal(data.newestByTopic['1 Grundrechenarten I und II'],'2026/27');
 assert.equal(data.newestByTopic['2 Brüche als Anteile'],'2025/26');
 assert.equal(data.ignored,3);
 assert.equal(data.rows.length,9);
 const chosen=data.rows.filter(x=>h.proposed(x,{topics:data.topics,includeOlder:false,includeExams:false,includeTimeless:true}));
 assert.equal(chosen.length,6,'latest teaching files plus current inclusion-reference, Brüche and background');
 assert.equal(chosen.filter(x=>x.reference).length,1,'latest available reference exam included');
 assert.ok(chosen.every(x=>x.latest));
 assert.ok(h.stats(chosen).bytes<5*1024*1024);
});
test('older archives and exams are opt-in, and deselected topics are skipped',()=>{
 const a=h.analyze(sample());
 const all=h.stats(a.rows.filter(x=>h.proposed(x,{topics:a.topics,includeOlder:true,includeExams:true,includeTimeless:true})));
 assert.equal(all.count,9);
 const withoutBrueche=a.rows.filter(x=>h.proposed(x,{topics:['1 Grundrechenarten I und II'],includeOlder:false,includeExams:true,includeTimeless:false}));
 assert.equal(withoutBrueche.length,4);
});
test('file classifications respect solutions, reference tests and topic plans',()=>{
 assert.equal(h.typeOf(root+'Mathematische Werkstatt/Lo╠êsungen/AB 1 Lo╠êsung.docx'),'loesung');
 assert.equal(h.typeOf(root+'1 Grundrechenarten I und II/Schuljahr 2026-2027/Klassenarbeit Nr1 Inkl..docx'),'inklusion');
 assert.equal(h.typeOf(root+'1 Grundrechenarten I und II/Schuljahr 2026-2027/Klassenarbeit Nr1.pdf'),'referenzarbeit');
 assert.equal(h.typeOf(root+'1 Grundrechenarten I und II/Schuljahr 2026-2027/Themenkarte.docx'),'reihenplanung');
 assert.equal(h.typeOf(root+'Mathematische Werkstatt/1 Station-G.pdf'),'werkstatt');
});
test('does not interpret task numbers as grade and ignores unwanted bulk ZIPs',()=>{
 assert.equal(h.yearIn(root+'Grundrechenarten/Schuljahr 2015 2016/AB 4.pdf'),'2015/16');
 assert.equal(h.yearIn(root+'Grundrechenarten/Klassenarbeit 2024_2025.pdf'),'');
 assert.equal(h.topicOf(root+'4 Erlebniswelt Geometrie/Schuljahr 2024-2025/Dreiecke.pdf'),'4 Erlebniswelt Geometrie');
 assert.equal(h.reject(root+'4 Erlebniswelt Geometrie/backup.zip'),true);
 assert.equal(h.reject(root+'4 Erlebniswelt Geometrie/Foto.jpg'),false);
});
function fakeBrowser(){
 const events={},stored=[],deleted=[],alerted=[];
 const input={addEventListener(name,fn){events[name]=fn;}};
 const saveButton={disabled:false,addEventListener(name,fn){events['save']=fn;}};
 const doc={
  getElementById:id=>id==='v239-folder-upload'?input:null,
  querySelector:q=>q==='[data-v237-folder].active'?{dataset:{v237Folder:'Mathematik|5'}}:
   q==='[data-v239-save]'?saveButton:null,
  querySelectorAll:()=>[]
 };
 const state={settings:{schoolYear:'2026/27'},materialCatalog:[],materialCatalogArchives:{}};
 let serial=0,commits=0;
 const ctx={module:undefined,state,modal:null,document:doc,console,Date,Set,Map,Promise,
  uid:(prefix)=>prefix+'-'+(++serial),clone:x=>JSON.parse(JSON.stringify(x)),
  esc:x=>String(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  catalogAvailableV17:x=>stored.some(r=>r.key===x.localFileKey),
  storedFileKeys:new Set(),
  fileStorePut:async(key,file)=>{stored.push({key,file});},
  fileStoreDelete:async(key)=>{deleted.push(key);},
  persistCatalogV171:async()=>{commits++;},
  saveState:async()=>{},alert:s=>alerted.push(s),
  materialsView:()=>'<label class="upload-button big-upload">+ Themen-ZIPs automatisch einsortieren<input type="file" id="v238-smart-upload"></label>',
  modalHtml:()=>'',wire:()=>{},render:()=>{},
 };
 const src=fs.readFileSync(path.join(__dirname,'..','schulcockpit-materialfolder-v239.js'),'utf8');
 vm.runInNewContext(src,ctx,{filename:'materialfolder-v239.js'});
 return {ctx,events,stored,deleted,alerted,state,get commits(){return commits;}};
}
test('selective folder import stores only latest non-test files; leaves 900MB nested ZIP untouched',async()=>{
 const b=fakeBrowser();
 const html=b.ctx.materialsView();
 assert.match(html,/Klassenordner auswählen/);
 assert.match(html,/Themen-ZIP komplett speichern/);
 b.ctx.wire();b.events.change({target:{files:sample()}});
 assert.match(b.ctx.modalHtml(),/tatsächliche Kopiermenge/);
 assert.match(b.ctx.modalHtml(),/ausgewählt/);
 b.ctx.wire();b.events.save({currentTarget:{disabled:false}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(b.stored.length,6);
 assert.equal(b.state.materialCatalog.length,6);
 assert.ok(b.stored.every(x=>!x.file.name.endsWith('.zip')));
 assert.equal(b.stored.filter(x=>x.file.name.includes('Klassenarbeit')).length,1,'reference exam intentionally imported');
 assert.ok(b.state.materialCatalog.every(x=>x.hubV237.grade===5));
 assert.ok(b.state.materialCatalog.every(x=>x.hubV237.subject==='Mathematik'));
 assert.ok(b.state.materialCatalog.every(x=>x.hubV238.selectivelySaved===true));
 assert.ok(b.alerted[0].includes('erfolgreich'));
});
test('reselecting same directory does not duplicate confirmed catalog entries or overwrite blobs',async()=>{
 const b=fakeBrowser();
 b.ctx.wire();b.events.change({target:{files:sample()}});b.ctx.wire();b.events.save({currentTarget:{disabled:false}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(b.stored.length,6);
 b.ctx.wire();b.events.change({target:{files:sample()}});b.ctx.wire();b.events.save({currentTarget:{disabled:false}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(b.state.materialCatalog.length,6);
 assert.equal(b.stored.length,6);
 assert.equal(b.commits,2);
});
