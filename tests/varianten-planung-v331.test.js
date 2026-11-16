'use strict';
const assert=require('node:assert/strict');
const C=require('../schulcockpit-varianten-planung-v331-core.js');
const Priority=require('../schulcockpit-eigene-materialfassung-v330-core.js');
const materials=[{id:'merged',title:'Bestattungsarten & Grabsymbole – meine Fassung',
 evolutionV296:{kind:'merged'},
 variants:[
  {id:'e',type:'standard',fileName:'RIC_Bestattungsarten_Grabsymbole_E.pdf',fileKey:'e'},
  {id:'g',type:'support',fileName:'RIC_Bestattungsarten_Grabsymbole_G.pdf',fileKey:'g'}
 ]}];
const l={id:'r9',title:'Was brauchen Menschen am Lebensende wirklich?',
 planReference:{title:'Was brauchen Menschen am Lebensende wirklich?',material:'6. Bestattungsarten\n7. Grabsymbole'},
 worksheetChoicesV276:{'6 bestattungsarten':{
  hint:'6. Bestattungsarten',chosenNames:materials[0].variants.map(v=>v.fileName),
  originalNames:['altes Blatt 1.pdf'],extraHiddenHints:['7. Grabsymbole']}},
 resourceBundlesV176:{'6 bestattungsarten':{items:[{materialId:'merged',variantId:'e'}]}}};
const es=C.activeEntries(l,materials,Priority);
assert.equal(es.length,1);
assert.equal(es[0].variants.length,2);
assert.match(C.levelFromName(es[0].variants[0].fileName),/E-Fassung/);
assert.match(C.levelFromName(es[0].variants[1].fileName),/G-Fassung/);
const base='# Schulcockpit – konkrete Stundenplanung\n## Auftrag\n'+
 'Nutze vorhandene Materialien und erfinde nur dann neues Material, wenn es didaktisch wirklich nötig ist.\n'+
 'Danach hänge GENAU EINEN maschinenlesbaren Block an:\n'+
 '<SCHULCOCKPIT_IMPORT>{"materials":[{"title":"Neue PDF"}]}</SCHULCOCKPIT_IMPORT>';
const prompt=C.contract(base,l,es);
assert.match(prompt,/RIC_Bestattungsarten_Grabsymbole_E.pdf/);
assert.match(prompt,/RIC_Bestattungsarten_Grabsymbole_G.pdf/);
assert.match(prompt,/Erstelle KEINE neuen Arbeitsblätter/);
assert.match(prompt,/späteren Reihenthemen/);
assert.match(prompt,/materials.*\[\]/);
assert(!prompt.includes('erfinde nur dann neues Material'),'outdated general authorization removed');
assert.equal(C.contract('Never changed',{id:'no'},[]).includes('Verbindlicher Auftrag'),true,
 'contract is invoked only for explicit teacher editions by caller');
const pkg={lesson:{title:'Hospiz und Sterbebegleitung',objective:'x'},
 materials:[{title:'KI-erfundenes Hospiz-Arbeitsblatt',kind:'file',copies:27}],
 slides:[{title:'Einfügen'}],phases:[{title:'Textarbeit'}]};
const original=structuredClone(pkg);
const decision=C.importDecision(l,pkg,es);
assert.equal(decision.protected,true);
assert.deepEqual(decision.suppressed,['KI-erfundenes Hospiz-Arbeitsblatt']);
assert.deepEqual(decision.pkg.materials,[]);
assert.deepEqual(decision.pkg.slides,pkg.slides);
assert.deepEqual(pkg,original,'AI package remains unchanged');
l.lessonFocusV331={title:'Bestattungsarten und Grabsymbole'};
const protectedTitle=C.importDecision(l,pkg,es);
assert.equal(protectedTitle.pkg.lesson.title,'Bestattungsarten und Grabsymbole');
assert.match(C.contract(base,l,es),/ausdrücklich auf „Bestattungsarten und Grabsymbole“ geändert/);
assert.equal(C.importDecision(l,pkg,[]).protected,false,'without own material generic import unchanged');
console.log('V331 E/G contract: both named, no new worksheets, old Soll title retained as provenance, AI materials ignored, teacher focus persistent.');
