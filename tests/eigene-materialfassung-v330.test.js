'use strict';
const assert=require('node:assert/strict');
const C=require('../schulcockpit-eigene-materialfassung-v330-core.js');
const materials=[
 {id:'orig-E',title:'Bestattungsarten',variants:[{id:'a',fileName:'RIC_Bestattungsarten_E.pdf'}]},
 {id:'orig-G',title:'Grabsymbole',variants:[{id:'b',fileName:'RIC_Grabsymbole_G.pdf'}]},
 {id:'own',title:'Bestattungsarten und Grabsymbole – mein AB',
  evolutionV296:{kind:'merged',note:'Beide Aufträge übersichtlich zusammengefasst',
   sources:[{hint:'Bestattungsarten',names:['RIC_Bestattungsarten_E.pdf']},
    {hint:'Grabsymbole',names:['RIC_Grabsymbole_G.pdf']}]},
  variants:[{id:'standard',type:'standard',fileName:'Bestattungsarten_und_Grabsymbole.pdf',
   fileKey:'own-blob',available:true},
   {id:'support',type:'support',fileName:'Bestattungsarten_Foerderung.pdf',
    fileKey:'own-support-blob',available:true}]}];
const lesson={id:'r11',classId:'religion11',date:'2026-11-18',
 worksheetChoicesV276:{'6 bestattungsarten rechercheauftrag':{
  hint:'6. Bestattungsarten – Rechercheauftrag',
  chosenNames:['Bestattungsarten_und_Grabsymbole.pdf','Bestattungsarten_Foerderung.pdf'],
  originalNames:['RIC_Bestattungsarten_E.pdf'],
  originalPairs:[{materialId:'orig-E',variantId:'a'}],
  extraHiddenHints:['7. Symbole Grabsteine'],improvementKindV296:'merged'}},
 resourceBundlesV176:{'6 bestattungsarten rechercheauftrag':{
  title:'6. Bestattungsarten – Rechercheauftrag',complete:true,
  items:[{materialId:'own',variantId:'standard'}]}}};
const records=C.entries(lesson,materials);
assert.equal(records.length,1);
const e=records[0];
assert.equal(e.title,'Bestattungsarten und Grabsymbole – mein AB');
assert.equal(e.variants.length,2,'standard and support belong to one chosen material');
assert.equal(e.sources.length,2,'both real originals are preserved as provenance');
assert.equal(e.merged,true);
assert.match(C.description(e),/Zusammengeführt aus 2 früheren Dateien/);
const rows=[
 {hint:'6. Bestattungsarten – Rechercheauftrag',type:'print'},
 {hint:'7. Symbole Grabsteine',type:'print'},
 {hint:'Buch S. 20 Nr. 1',type:'reference'}];
const active=C.effectiveRows(rows,records);
assert.deepEqual(active.map(r=>r.title||r.hint),[
 'Bestattungsarten und Grabsymbole – mein AB','Buch S. 20 Nr. 1']);
const source='## Verbindliche Materialauswahl – IST dieser Stunde, nicht historische Soll-Liste\n'+
 'ALT: Bestattungsarten und Grabsymbole einzeln drucken'+
 '\n\nDie obige Liste ist die EINZIGE aktuelle Materialgrundlage.\nWeitere Hinweise.';
const prompt=C.promptSection(source,rows,records,rs=>rs.map(r=>r.hint).join('; '));
assert(!prompt.includes('ALT:'));
assert.match(prompt,/VERBINDLICH · EIGENE FASSUNG DER LEHRKRAFT/);
assert.match(prompt,/Bestattungsarten_und_Grabsymbole.pdf/);
assert.match(prompt,/Bestattungsarten_Foerderung.pdf/);
assert.match(prompt,/RIC_Grabsymbole_G.pdf \(nicht zusätzlich bearbeiten oder drucken\)/);
assert(!prompt.includes('[AKTIVES ARBEITSBLATT] 7.'));
assert(prompt.includes('Buch S. 20 Nr. 1'),'unrelated schoolbook remains active');
assert(source.includes('ALT:'),'source value not mutated');
assert.equal(C.promptSection('Unchanged',rows,[],()=>''),'Unchanged');
assert.equal(C.entries({id:'x'},materials).length,0);
console.log('V330: personal material wins over two original rows, source history intact, prompt uses chosen standard/support editions, other sources retained.');
