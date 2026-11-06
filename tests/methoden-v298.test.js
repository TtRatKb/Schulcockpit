const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../schulcockpit-methoden-v298-core.js');
const all=core.defaults();
assert(all.length>=15);
assert(all.some(m=>m.title==='Fehlerdetektiv'&&m.subjects.includes('math')));
assert(all.some(m=>m.title==='Positionen begründet vergleichen'&&m.subjects.includes('religion')));
assert(all.some(m=>m.id==='built:exppuzzle'&&/Mindestens drei/.test(m.when)));
assert(all.some(m=>m.id==='built:topflop'&&/nicht/.test(m.avoid.toLowerCase())));
assert.equal(core.subject('Evangelische Religion'),'religion');
assert.equal(core.subject('Mathe'),'math');
const c={subject:'Religion',name:'8a'},l={id:'l',classId:'rel',date:'2026-11-10',
 methodPreferencesV298:{entry:'built:bild'}};
const recommended=core.recommended(l,c,all,['built:topflop']);
assert.equal(recommended.entry[0].id,'built:bild');
assert(!recommended.work.some(m=>m.id==='built:tandem'),'no math-only tandem in Religion');
assert(recommended.work.some(m=>m.id==='built:exppuzzle'),'puzzle available with caveat');
assert(!recommended.entry.some(m=>m.id==='built:fehler'),'math-only error detector excluded');
assert(!recommended.entry.some(m=>m.phase!=='entry'));
assert.throws(()=>core.valid({title:'',description:'a',subjects:['religion']}),/Titel/);
assert.throws(()=>core.valid({title:'Beispiel',description:'kurz',subjects:[]}),/mindestens ein Fach/);
assert.equal(core.valid({title:'Eigene Frage',phase:'entry',subjects:['religion'],description:'Ein Impuls.'}).id,'');
const previous={id:'p',classId:'rel',date:'2026-11-01',status:'done',
 phasePlan:[{title:'Top oder Flop',details:'Aktivierung'}]};
assert.deepEqual(core.recent(l,[previous],all),['built:topflop']);
const state={teachingMethodsV298:all,classes:[{id:'rel',subject:'Religion',name:'8a'}],
 lessons:[previous,l],settings:{schoolYear:'2026/27'}};
const ctx={SC_METHOD_BANK_V298:core,console,window:{},document:{querySelector:()=>null,querySelectorAll:()=>[]},
 state,view:'methods',modal:null,
 pageTitle:()=>'',viewHtml:()=>'',render:()=>{},wire:()=>{},
 wizardPlanStepV14:()=>'<div><h3>Material in dieser Stunde</h3></div>',
 concretePlanningPromptV12:()=>'<header>\\nDanach hänge GENAU EINEN maschinenlesbaren Block an: <data>',
 makeBrief:()=>'',cls:id=>state.classes.find(x=>x.id===id),uid:x=>x+'-123',
 lesson:id=>state.lessons.find(x=>x.id===id),
 saveState:()=>{},esc:x=>String(x),
 structuredClone,alert:x=>{throw Error(x)}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-methoden-v298.js'),'utf8'),ctx);
assert.equal(ctx.pageTitle(),'Methodenbibliothek');
const page=ctx.viewHtml();
assert.match(page,/Methoden statt Einheitsstunden/);
assert.match(page,/Eher nicht:/); // negative suitability guidance on method cards
assert.match(ctx.wizardPlanStepV14(l),/data-v298-prefer/);
const prompt=ctx.concretePlanningPromptV12(l);
assert.match(prompt,/Methodenbibliothek/);
assert.match(prompt,/Top\/Flop ist OPTIONAL/);
assert.match(prompt,/GENAU EINE zusammenhängende Arbeitsauftrag-Folie/);
assert.match(prompt,/Dschihad/);
assert.match(prompt,/bildimpuls/);
assert.match(prompt,/imageSuggestion/);
assert.match(prompt,/Fehlt die Datei/);
assert.match(prompt,/Lehrkraftwunsch: Bildimpuls \/ Karikatur/);
assert.match(prompt,/Mindestens drei wirklich unterschiedliche/);
assert(!prompt.includes('Lerntempoduett'),'no math-only methods in Religion prompt');
console.log('Methods: editable library, subject/phase recommendations, recent methods and lesson prompt rules OK');