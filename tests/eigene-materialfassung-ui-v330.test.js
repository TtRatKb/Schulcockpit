'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),
 fs=require('node:fs'),path=require('node:path');
const Core=require('../schulcockpit-eigene-materialfassung-v330-core.js');
const Reality=require('../schulcockpit-material-realitaet-v308-core.js');
const main={id:'own',title:'Bestattungsarten & Grabsymbole – mein AB',
 evolutionV296:{kind:'merged',note:'Schön zusammengefügt',
  sources:[{names:['RIC_Bestattungsarten_E.pdf']},{names:['RIC_Grabsymbole_G.pdf']}]},
 variants:[{id:'std',type:'standard',fileName:'Mein_AB.pdf',fileKey:'blob1',available:true},
  {id:'support',type:'support',fileName:'Mein_AB_inkl.pdf',fileKey:'blob2',available:true}]};
const l={id:'r11',classId:'rel11',status:'open',date:'2026-11-18',
 planReference:{title:'Religion 11'},
 worksheetChoicesV276:{'6 bestattungsarten recherceauftrag':{
  hint:'6. Bestattungsarten Rechercheauftrag',
  originalNames:['RIC_Bestattungsarten_E.pdf'],
  chosenNames:['Mein_AB.pdf','Mein_AB_inkl.pdf'],
  extraHiddenHints:['7. Symbole Grabsteine'],improvementKindV296:'merged'}},
 resourceBundlesV176:{'6 bestattungsarten recherceauftrag':{
  items:[{materialId:'own',variantId:'std'}]}},
 printPlan:[{id:'job',materialId:'own',variantId:'std',needed:true,count:26,alreadyPrinted:false}]};
let renders=0;
const rows=[
 {hint:'6. Bestattungsarten Rechercheauftrag',type:'print',
  bundleItemsV176:[{materialId:'own',variantId:'std',m:main,v:main.variants[0]}]},
 {hint:'7. Symbole Grabsteine',type:'ignore'},
 {hint:'Buch S. 20 Nr. 1',type:'reference'}
];
const state={settings:{schoolYear:'2026/27'},materials:[main],lessons:[l]};
const context={state,window:{},document:{querySelectorAll:()=>[],querySelector:()=>null},view:'assistant',
 SC_TEACHER_MATERIAL_PRIORITY_V330:Core,
 SC_MATERIAL_REALITY_V308:Reality,
 resourceRowV14:(l,r)=>'<div class="resource-row-v176"><strong>ALT: '+
  r.hint+'</strong><button data-v296-lesson="x">Überarbeiten</button></div>',
 v182LessonDayHtml:l=>'<p class="v308-current-note">ALT: 6. Bestattungsarten</p>',
 concretePlanningPromptV12:l=>'## Verbindliche Materialauswahl – IST dieser Stunde, nicht historische Soll-Liste\n'+
  'ALT: zwei alte ABs\n\nDie obige Liste ist die EINZIGE aktuelle Materialgrundlage.',
 makeBrief:()=>'',render:()=>{renders++;},
 allResourceRowsV176:()=>rows,resourceKeyV14:Core.key,
 resourceIsEditorV176:()=>false,
 v183IsActive:(l,h)=>h!=='7. Symbole Grabsteine',
 v182IsHeld:l=>l.status==='done',
 lesson:id=>state.lessons.find(l=>l.id===id),
 mat:id=>state.materials.find(m=>m.id===id),
 hasStoredFile:v=>!!v.fileKey,
 esc:x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;'),
 console};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,
 '../schulcockpit-eigene-materialfassung-v330.js'),'utf8'),context);
const primary=context.resourceRowV14(l,rows[0]);
assert.match(primary,/Deine Fassung ist aktiv/);
assert.match(primary,/Bestattungsarten &amp; Grabsymbole – mein AB/);
assert.match(primary,/Mein_AB.pdf/);
assert.match(primary,/Mein_AB_inkl.pdf/);
assert.match(primary,/26 Exemplare eingeplant/);
assert.match(primary,/data-v177-file="own\|std"/);
assert.match(primary,/data-v177-file="own\\|support"/,
 'the support file opens its own variant, never the standard PDF');
assert.match(primary,/Frühere Arbeitsblätter ansehen \(2\)/);
assert.match(primary,/<details class="v330-technical">/);
assert(primary.indexOf('Deine Fassung ist aktiv')<primary.indexOf('ALT:'),
 'original is below the main chosen card and hidden inside details');
assert.equal(context.resourceRowV14(l,rows[1]),'',
 'the second source must not stay as its own big active row');
assert.match(context.resourceRowV14(l,rows[2]),/ALT: Buch S. 20/,
 'unrelated book material stays visible');
const day=context.v182LessonDayHtml(l);
assert.match(day,/Für diese Stunde ausgewählt/);
assert.match(day,/mein AB/);
assert(!day.includes('ALT: 6.'),'day view follows selected material');
const prompt=context.concretePlanningPromptV12(l);
assert.match(prompt,/EIGENE FASSUNG DER LEHRKRAFT/);
assert.match(prompt,/Mein_AB.pdf/);
assert(!prompt.includes('ALT: zwei alte ABs'));
l.printPlan[0].alreadyPrinted=true;
assert.match(context.resourceRowV14(l,rows[0]),/Bereits kopiert/);
l.status='done';
assert(!context.resourceRowV14(l,rows[0]).includes('Weitere eigene Fassung hinterlegen'),
 'historical lesson is immutable in edition controls');
l.status='open';
rows[0].type='ignore';
assert(!context.resourceRowV14(l,rows[0]).includes('Deine Fassung ist aktiv'),
 'a deliberately removed own worksheet must not be promoted as active');
console.log('V330 UI: chosen material card primary, two originals behind disclosure, one archived row hidden, prompt/day consistent, copied and held status respected.');
