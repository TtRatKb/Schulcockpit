'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../schulcockpit-arbeitsblaetter-v276.js'),'utf8');
const E={id:'e',type:'standard',fileName:'RIC_Bestattungsarten_E.pdf',fileKey:'e-file'};
const G={id:'g',type:'support',fileName:'RIC_Bestattungsarten_G.pdf',fileKey:'g-file'};
const m={id:'merged',title:'Eigene gemeinsame Fassung',variants:[E,G],resourceType:'print'};
const l={id:'l',classId:'religion9',date:'2026-11-18',title:'Bestattungsarten',
 materials:['merged'],printPlan:[{materialId:'merged',variantId:'e',needed:true,count:25},
  {materialId:'merged',variantId:'g',needed:false,count:0}],
 worksheetChoicesV276:{bestattungsarten:{
  hint:'Bestattungsarten',chosenNames:[E.fileName,G.fileName],
  originalNames:['Original_E.pdf','Original_G.pdf']}}};
const bundled=[{materialId:'merged',variantId:'e',m,v:E}];
const ctx={state:{materials:[m],classes:[{id:'religion9',subject:'Religion',name:'9'}],settings:{schoolYear:'2026/27'}},
 window:{},document:{querySelectorAll:()=>[]},console,
 allResourceRowsV176:()=>[{hint:'Bestattungsarten',type:'print',bundleItemsV176:bundled}],
 resourceKeyV14:s=>String(s).toLowerCase(),v183IsActive:()=>true,
 hasStoredFile:v=>v.fileKey!=='missing',
 mat:id=>id==='merged'?m:null,variant:(id,vid)=>m.variants.find(x=>x.id===vid),
 lesson:()=>l,cls:()=>({subject:'Religion',name:'9'}),whoV14:()=> 'Religion 9',
 resourceRowV14:()=>'',wizardPromptStepV14:()=>'<div class="wizard-footer-v14"></div>',
 concretePlanningPromptV12:()=>'',wire:()=>{},esc:s=>String(s),
 v182IsHeld:()=>false,saveState:async()=>{},render:()=>{},alert:()=>{},
 JSZip:class{constructor(){this.files={};}folder(){return {file:()=>{}};}file(){}async generateAsync(){return {size:1};}},
 fileStoreGet:async key=>({blob:new Blob(['content']),name:key,size:7}),
 downloadBlob:()=>{},File,structuredClone};
vm.createContext(ctx);vm.runInContext(src,ctx);
const api=ctx.window.SchulcockpitWorksheetChoiceV276;
assert(api,'export API exists');
const active=api.activeFiles(l);
assert.deepEqual(active.map(x=>x.name),[E.fileName,G.fileName],
 'both E and G must be sources although only E is in print bundle');
assert.deepEqual(active.map(x=>x.role),['standard','support']);
assert.equal(l.printPlan[1].needed,false,'choosing ChatGPT sources must not add G-class print job');
assert.deepEqual(api.missingSelectedFiles(l,active),[]);
assert.match(api.sourceBlock(l),/Grundniveau \/ unterstützende Fassung/);
assert.match(api.sourceBlock(l),/Erstelle keine neuen Ersatzarbeitsblätter/);
const missing=structuredClone(l);
missing.worksheetChoicesV276.bestattungsarten.chosenNames.push('RIC_Grabsymbole_extra.pdf');
assert.deepEqual(api.missingSelectedFiles(missing,api.activeFiles(missing)),['RIC_Grabsymbole_extra.pdf']);
(async()=>{
 await assert.rejects(api.exportSources(missing),/NICHT unvollständig erstellt/);
 console.log('V331 ZIP source selection: E and G (including no-print support) exported; missing chosen edition rejects entire ZIP without touching print assignments.');
})().catch(e=>{console.error(e);process.exitCode=1;});
