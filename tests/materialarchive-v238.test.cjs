'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const h=require('../schulcockpit-materialarchive-v238.js');
const root='1 Grundrechenarten I und II/';
function entry(year,part,crc,size=120){return {path:root+'Schuljahr '+year+'/'+part,crc,size,dir:false};}
test('macOS technical wrappers and dotfiles never become material',()=>{
 const rows=[{path:'__MACOSX/a/._foo.docx',dir:false},{path:root+'Schuljahr 2026-2027/._Werkstatt.doc',dir:false},
  entry('2026-2027','Grundrechenarten I/Arbeitsblatt 1.pdf',1)];
 const a=h.summarize(rows);
 assert.equal(a.entries.length,1);assert.equal(a.technical,2);
});
test('newest year prioritized; exact repeated old documents collapse to one suggested extra',()=>{
 const a=h.summarize([
  entry('2024-2025','Grundrechenarten I/Mathematische Werkstatt/AB1.doc',1),
  entry('2026-2027','Grundrechenarten I/Mathematische Werkstatt/AB1.doc',1),
  entry('2025-2026','Grundrechenarten I/Mathematische Werkstatt/AB1.doc',1),
  entry('2025-2026','Grundrechenarten I/Mathematische Werkstatt/AB2.doc',2),
  entry('2024-2025','Grundrechenarten I/Mathematische Werkstatt/AB2.doc',2),
  entry('2024-2025','Grundrechenarten I/Mathematische Werkstatt/AB3.doc',3)
 ]);
 assert.equal(a.newest,'2026/27');assert.equal(a.preferred,1);
 assert.equal(a.repetitions,3);
 assert.equal(a.extras,2);
 assert.equal(a.entries.filter(x=>x.preferred).length,1);
 assert.deepEqual(a.years.map(x=>x.year),['2026/27','2025/26','2024/25']);
});
test('archive paths preserve I, II, workshop, levels and solution vs work assignments',()=>{
 const samples=[
  ['Grundrechenarten I/Mathematische Werkstatt/Lo╠êsungen/3 G Schriftliche Addition Lo╠êsungen.docx','loesung','G'],
  ['Grundrechenarten I/Mathematische Werkstatt/1 Gro├ƒe Zahlen/G + E Gro├ƒe Zahlen.pdf','werkstatt','G + E'],
  ['Grundrechenarten II/Mathematische Werkstatt/7 Rechenregeln/7_Rechenregeln-G.pdf','werkstatt','G'],
  ['Grundrechenarten I Arbeit/Klassenarbeit Nr1 2026 2027 Inkl..docx','inklusion','Inklusion'],
  ['Grundrechenarten I Arbeit/Klassenarbeit Nr1 2026 2027 A-Version.pdf','referenzarbeit',''],
  ['Themenkarte Grundrechenarten I & II 2026-27.docx','reihenplanung','']
 ];
 for(const [part,kind,level] of samples){const p=root+'Schuljahr 2026-2027/'+part;
   assert.equal(h.fileType(p),kind,part);assert.equal(h.level(p),level,part);}
 assert.match(h.folderTopic(root+'Schuljahr 2026-2027/Grundrechenarten II/Mathematische Werkstatt/6 Division/E Division.doc'),
   /Grundrechenarten II.*Mathematische Werkstatt.*6 Division/);
});
test('infer Mathematics grade 5 from screenshot archive and prefer explicit folder',()=>{
 assert.deepEqual(h.infer('1 Grundrechenarten I und II.zip',root+'Schuljahr 2026-2027/file.pdf'),{subject:'Mathematik',grade:5});
 assert.deepEqual(h.infer('1 Grundrechenarten I und II.zip',root+'Schuljahr 2026-2027/file.pdf','Mathematik|6'),{subject:'Mathematik',grade:6});
 assert.deepEqual(h.infer('My Archive.zip','Klasse 08/Mathewerkstatt/AB1.doc'),{subject:'Mathematik',grade:8});
});
test('year detection ignores years in filenames when older school-year folder exists',()=>{
 assert.equal(h.schoolYear(root+'Schuljahr 2024-2025/Klassenarbeit 2026 2027.docx'),'2024/25');
 assert.equal(h.schoolYear(root+'Schuljahr 2025 2026/Mathewerkstatt/AB1.pdf'),'2025/26');
 assert.equal(h.schoolYear(root+'Rechenspiele.pdf'),'');
});
function browser(){
 let added=[],notices=[],catalogWrites=0,stateWrites=0;
 const input={addEventListener(k,fn){if(k==='change')this.change=fn;}};
 const commit={disabled:false,addEventListener(k,fn){if(k==='click')this.click=fn;}};
 const doc={
  getElementById(id){return id==='v238-smart-upload'?input:null;},
  querySelector(k){if(k==='[data-v237-folder].active')return {dataset:{v237Folder:'Mathematik|5'}};if(k==='[data-v238-commit]')return commit;return null;},
  querySelectorAll(){return []}
 };
 const filename='1 Grundrechenarten I und II.zip';
 const zip={files:{
  [root+'Schuljahr 2025-2026/Grundrechenarten I/Mathematische Werkstatt/AB1.doc']:{dir:false,_data:{crc32:111,uncompressedSize:40}},
  [root+'Schuljahr 2026-2027/Grundrechenarten I/Mathematische Werkstatt/AB1.doc']:{dir:false,_data:{crc32:111,uncompressedSize:40}},
  [root+'Schuljahr 2026-2027/Grundrechenarten I Arbeit/Klassenarbeit Nr1 Inkl..docx']:{dir:false,_data:{crc32:222,uncompressedSize:40}},
  [root+'Schuljahr 2017 2018/Grundrechenarten II/Mathematische Werkstatt/AB2.doc']:{dir:false,_data:{crc32:333,uncompressedSize:40}},
  '__MACOSX/._metadata':{dir:false,_data:{crc32:444,uncompressedSize:10}}
 }};
 const state={materialCatalog:[],materialCatalogArchives:{},settings:{schoolYear:'2026/27'}};
 const ctx={state,modal:null,document:doc,console,Date,Map,Set,Promise,uid:n=>n+'-'+(++added.length),
   esc:x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
   clone:x=>JSON.parse(JSON.stringify(x)),JSZip:{loadAsync:async()=>zip},
   fileStorePut:async(k,file)=>{added.push({key:k,file});},fileStoreDelete:async()=>{},
   persistCatalogV171:async()=>{catalogWrites++;},saveState:async()=>{stateWrites++;},
   v184CurrentCourseCatalog:()=>state.materialCatalog,
   v184CourseMatchCatalog:()=>true,
   wire:()=>{},render:()=>{},modalHtml:()=>'',alert:s=>notices.push(s)};
 const src=fs.readFileSync(path.join(__dirname,'..','schulcockpit-materialarchive-v238.js'),'utf8');
 vm.runInNewContext(src,ctx,{filename:'schulcockpit-materialarchive-v238.js'});
 return {ctx,input,commit,state,added,notices,get catalogWrites(){return catalogWrites},get stateWrites(){return stateWrites},filename};
}
test('whole ZIP persisted exactly once; old classworks remain reference-only',async()=>{
 const b=browser();b.ctx.wire();
 assert.equal(typeof b.input.change,'function');
 const file={name:b.filename,size:9000};
 b.input.change({target:{files:[file]}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(b.ctx.modalHtml(),/Schuljahresfassungen automatisch erkennen/);
 assert.match(b.ctx.modalHtml(),/4 echte Dateien/);
 b.ctx.wire();b.commit.click({currentTarget:b.commit});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(b.added.filter(x=>x&&typeof x==='object').length,1,'only the whole ZIP stored');
 assert.equal(b.state.materialCatalog.length,4,'all real entries indexed');
 assert.equal(b.state.materialCatalogArchives[b.filename].smartV238,true);
 assert.equal(b.catalogWrites,1);
 const rows=b.ctx.v184CurrentCourseCatalog('math5');
 assert.equal(rows.length,1,'only current year non-exam file gets exported by default');
 assert.ok(rows[0].sourcePath.includes('2026-2027'));
 const historic=b.state.materialCatalog.find(x=>x.sourcePath.includes('2017 2018'));
 assert.equal(historic.hubV238.extraFromOlder,true);
 const exam=b.state.materialCatalog.find(x=>x.fileName.includes('Inkl.'));
 assert.equal(exam.hubV238.referenceExam,true);
 assert.ok(b.notices.some(x=>x.includes('Themen-ZIPs einsortiert')));
});
