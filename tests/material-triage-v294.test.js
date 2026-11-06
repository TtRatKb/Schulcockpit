/* V0.29.4 – material triage, cautious duplicate suggestions and prompt precedence. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../schulcockpit-material-triage-v294-core.js');
const a={catalogId:'one',fileName:'AB Fachbegriffe Division.pdf',
 hubV237:{subject:'Mathematik',grade:5,kind:'arbeitsblatt',sha256:'ab'}};
const b={catalogId:'two',fileName:'AB Fachbegriffe Division.docx',
 hubV237:{subject:'Mathematik',grade:5,kind:'arbeitsblatt',sha256:'cd'}};
const c={catalogId:'other',fileName:'AB Fachbegriffe Division.docx',
 hubV237:{subject:'Religion',grade:5,kind:'arbeitsblatt',sha256:'ef'}};
const d={catalogId:'identical',fileName:'irgendwas.pdf',
 hubV237:{subject:'Mathematik',grade:5,kind:'arbeitsblatt',sha256:'ab'}};
const e={catalogId:'different',fileName:'AB Fachbegriffe Multiplikation.pdf',
 hubV237:{subject:'Mathematik',grade:5,kind:'arbeitsblatt',sha256:'gg'}};
assert.equal(core.duplicates([a,b,c,d,e],a).length,2);
assert(core.duplicates([a,b,c,d,e],a).some(x=>x.reason==='Mögliches PDF-/Word-Paar'));
assert(core.duplicates([a,b,c,d,e],a).some(x=>x.reason==='Identischer Datei-Hash'));
assert.equal(core.duplicates([a,b,c,d,e],a).some(x=>x.name===e.fileName),false);
assert.equal(core.duplicates([a,b,c,d,e],a).some(x=>x.key==='c:other'),false);
assert.equal(core.stem('AB Division.pdf'),core.stem('AB Division.DOCX'));
assert.throws(()=>core.validated('arbeitsblatt',''),/Verwendung auswählen/);
assert.deepEqual(core.validated('hilfekarte','supplement'),{kind:'hilfekarte',usage:'supplement'});
b.hubV295={usage:'supplement',reviewedAt:'2026-11-06T00:00:00Z'};
const counts=core.counters([a,b,c,d,e]);
assert.equal(counts.done,1);assert.equal(counts.pending,4);
assert.equal(counts.supplementary,1);

let baseCalls=0,saveCalls=0,storedCalls=0,shown='';
const ctx={
 SC_MATERIAL_TRIAGE_V294:core,
 state:{materialCatalog:[a,b,c,d,e],materials:[],classes:[],settings:{schoolYear:'2026/27'}},
 materialsView:()=>'<div class="content-grid v237-hub">Alt</div>',
 concretePlanningPromptV12:()=>'<original>Materialauswahl</original>',
 v184CatalogPromptEntries:()=>'- ID one | Original\n- ID two | Extra\n- ID archive | Alt',
 v184DefaultChoice:(item,candidates)=>candidates[0]?.key||'unresolved',
 wire:()=>{},render:()=>{baseCalls++;},
 document:{addEventListener:()=>{},querySelector:()=>null,querySelectorAll:()=>[]},
 window:{SchulcockpitWorksheetChoiceV276:{activeFiles:()=>[]}},
 view:'materials',modal:null,esc:x=>String(x),
 cls:()=>null,mat:()=>null,
 catalogAvailableV17:()=>false,hasStoredFile:()=>false,
 catalogEntryFileV17:async()=>null,
 persistCatalogV171:async()=>{storedCalls++;},
 saveState:async()=>{saveCalls++;},
 importCatalogManifestV17:async()=>{ctx.state.materialCatalog=[
  {catalogId:'one',fileName:'AB Fachbegriffe Division.pdf'},
  {catalogId:'two',fileName:'AB Fachbegriffe Division.docx'},
  {catalogId:'archive',fileName:'Alte Quelle.pdf'}];},
 console,structuredClone
};
vm.createContext(ctx);
const filename=require('node:path').join(__dirname,'../schulcockpit-material-triage-v294.js');
vm.runInContext(fs.readFileSync(filename,'utf8'),ctx);
assert.match(ctx.materialsView(),/Sortiermodus starten/);
assert.match(ctx.concretePlanningPromptV12({}),/Zusatzmaterial ist optional/);
assert.match(ctx.v184CatalogPromptEntries('course','topic'),/Verwendung: Zusatzmaterial/);
assert.equal(ctx.v184DefaultChoice({},[{key:'c:two',e:b}],''),'unresolved');
assert.equal(ctx.v184DefaultChoice({},[{key:'c:one',e:a}],''),'c:one');
const archived={catalogId:'archive',hubV295:{usage:'archive',reviewedAt:'x'}};
ctx.state.materialCatalog.push(archived);
assert.doesNotMatch(ctx.v184CatalogPromptEntries('course','topic'),/ID archive/);
(async()=>{
 await ctx.importCatalogManifestV17({name:'new-manifest.json'});
 const reimported=ctx.state.materialCatalog.find(x=>x.catalogId==='two');
 assert.equal(reimported.hubV295.usage,'supplement');
 assert.equal(reimported.hubV237.grade,5);
 assert(storedCalls>0&&saveCalls>0,'restored classifications must be persisted');
 assert(ctx.window.SchulcockpitMaterialTriageV294,'controller present');
 // Make sure original document is still present; no delete/write-to-file call.
 assert.match(fs.readFileSync(filename,'utf8'),/Originale und bereits verwendeten Stundenmaterialien bleiben unverändert/);
 console.log('Material-Triage: duplicate hints, workflow priorities, manifest re-import and progress OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
