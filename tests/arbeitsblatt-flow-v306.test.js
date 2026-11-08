'use strict';
const assert=require('node:assert/strict');
global.SC_WORKSHEET_ACTUAL_V305=require('../schulcockpit-arbeitsblatt-ist-v305-core.js');
const F=require('../schulcockpit-arbeitsblatt-flow-v306-core.js');
const C=SC_WORKSHEET_ACTUAL_V305;
const source=C.rows([{hint:'Division',type:'print',items:[
 {materialId:'m',variantId:'terms',fileName:'6 Fachbegriffe Division.pdf'},
 {materialId:'m',variantId:'half',fileName:'Halbschriftliche Division.pdf'}]},
 {hint:'Schriftliche Division',type:'print',items:[
 {materialId:'n',variantId:'one',fileName:'Schriftliche Division.pdf'}]}],[
 {materialId:'m',variantId:'terms',alreadyPrinted:true},
 {materialId:'m',variantId:'half',alreadyPrinted:true},
 {materialId:'n',variantId:'one',alreadyPrinted:true}
]);
const prev={id:'p',date:'2026-11-05',printPlan:[],worksheetActualV305:C.refine({items:{
 [source[0].id]:{status:'complete',printed:'yes'},
 [source[1].id]:{status:'partial',printed:'yes',follow:'continue'},
 [source[2].id]:{status:'unused',printed:'yes',follow:'stop'}
}},null,source)};
const outcomes=F.outcomes(prev,source);
assert.deepEqual(outcomes.map(x=>x.mode),['done','carry','done']);
assert.deepEqual(outcomes.map(F.noNewPrint),[true,true,true]);
assert.deepEqual(outcomes.map(F.suppressInPlanning),[true,false,true]);
assert.equal(F.simpleStatus(outcomes[0]),'Bereits vollständig bearbeitet');
assert.match(F.simpleStatus(outcomes[1]),/nur Rest bearbeiten/);
const prompt=F.prompt(prev,outcomes);
assert.match(prompt,/6 Fachbegriffe Division.pdf.*Nicht erneut/);
assert.match(prompt,/Halbschriftliche Division.pdf.*KEINE neue Kopie/);
assert.match(prompt,/Schriftliche Division.pdf.*Nicht erneut/);
assert(!prompt.includes('pupil'));
assert.equal(F.policy('partial','continue','no'),'carry','handed-out partial work cannot need copies');
assert.equal(F.policy('unused','continue','yes'),'distribute');
assert.equal(F.policy('unused','continue','no'),'newPrint');
assert.equal(F.policy('unused','undecided','yes'),'open');
assert.equal(F.policy('partial','stop','yes'),'done');
assert.equal(F.policy('skipped','continue','yes'),'done');
assert.equal(F.policy('unknown','stop','yes'),'open');
const repeat=F.outcomes(prev,source,[source[0].id]);
assert.deepEqual(repeat.map(x=>x.mode),['repeat','carry','done']);
assert.deepEqual(repeat.map(F.noNewPrint),[false,true,true]);
assert.equal(F.prompt(prev,[repeat[0]]),'');
assert.equal(C.equals(source[0],source[1]),false,'inclusion/standard variants never conflated');
assert.equal(prev.worksheetActualV305.items[source[0].id].status,'complete');
console.log('Worksheet flow: completed auto-filtered, partial carried with no copies, printed-but-unused reused, manual repeat and historical records safe.');
