/* node --test tests/jahreszip-v241.test.cjs */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const lib=require('../schulcockpit-jahreszip-v241.js');
const f=(i,size=1024)=>({path:'materialien/c'+i+'_AB'+i+'.pdf',blob:{size}});
test('479 available files become multiple packages rather than 79 silent omissions',()=>{
 const files=Array.from({length:479},(_,i)=>f(i,256*1024));
 const parts=lib.splitFiles(files);
 assert.equal(parts.length,2);
 assert.equal(parts[0].files.length,400);
 assert.equal(parts[1].files.length,79);
 assert.equal(parts.reduce((s,p)=>s+p.files.length,0),479);
 assert.equal(lib.mapParts(parts).size,479);
 assert.equal(lib.mapParts(parts).get(files[478].path),2);
});
test('the 140 MB limit becomes a new part, without omitting documents',()=>{
 const files=Array.from({length:4},(_,i)=>f(i,80*1024*1024));
 const parts=lib.splitFiles(files);
 assert.equal(parts.length,4);
 assert.equal(parts.reduce((s,p)=>s+p.files.length,0),4);
 assert.ok(parts.every(p=>p.bytes<=140*1024*1024));
});
test('large but uploadable original gets a clearly marked dedicated package',()=>{
 const files=[f(0,4*1024*1024),f(1,190*1024*1024),f(2,2*1024*1024)];
 const parts=lib.splitFiles(files);
 assert.equal(parts.length,3);
 assert.equal(parts[1].oversized,true);
 assert.equal(parts.reduce((s,p)=>s+p.files.length,0),3);
});
test('files too large to send as a single package give an error, never disappear',()=>{
 assert.throws(()=>lib.splitFiles([f(4,500*1024*1024)]),/480 MB/);
});
test('duplicate output paths cannot overwrite or silently remove files',()=>{
 assert.throws(()=>lib.splitFiles([f(1),f(1)]),/Doppelter Dateipfad/);
});
test('reserve metadata size in part one and handle an empty material set',()=>{
 assert.equal(lib.splitFiles([]).length,1);
 const p=lib.splitFiles([f(1,135*1024*1024)],{coreBytes:6*1024*1024});
 assert.equal(p.length,2);
 assert.equal(p[1].files.length,1);
});
test('numbered ZIP names remain stable and distinguishable',()=>{
 assert.equal(lib.partName('Mathematik 5f/2026-27',1,2),'Mathematik_5f_2026-27_Teil_01_von_02.zip');
 assert.equal(lib.partName('Kurs',2,2),'Kurs_Teil_02_von_02.zip');
});
test('annual export exposes complete manifest and explicit download actions',()=>{
 const js=fs.readFileSync(path.join(__dirname,'..','schulcockpit-restjahr-v236.js'),'utf8');
 assert.match(js,/SC_YEAR_PARTS_V241\.splitFiles\(candidates/);
 assert.match(js,/10_TEILPAKETE\.json/);
 assert.match(js,/09_MATERIALPRUEFUNG\.json/);
 assert.match(js,/data-v241-download/);
 assert.match(js,/data-v241-response/);
 assert.match(js,/Alle nummerierten Teil-ZIPs/);
 assert.doesNotMatch(js,/paths\.size>=400\|\|bytes/);
});
