/* V0.23.6: synthetic, anonymized tests; node tests/restjahr-v236.test.cjs */
'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const mod=require('../schulcockpit-restjahr-v236.js');
const {nextInstructionalDelta,parseAnnual,datePlus,clean}=mod;
function sample(){return {schema:'schulcockpit.year.v1',courseId:'math-5f',schoolYear:'2026/27',sequences:[
  {sequenceId:'s1',title:'Grundrechenarten',units:[{unitId:'u1',title:'Addieren',materials:[],competencyIds:['mathe-5-15-all-k01'],methodIds:[]}]},
  {sequenceId:'s2',title:'Wir teilen auf',units:[{title:'Bruchteile',materials:[{title:'Buch S. 12',kind:'book'}]}]}
]};}
test('Ferien überspringen: zwei freie Wochen führen zur nächsten regulären Woche',()=>{
  const isFree=d=>d>='2026-10-12'&&d<='2026-10-23';
  assert.equal(nextInstructionalDelta('2026-10-05',1,[{weekday:1},{weekday:4}],isFree),3);
  assert.equal(nextInstructionalDelta('2026-10-26',-1,[{weekday:1},{weekday:4}],isFree),-3);
});
test('Nur Montag frei: Woche mit Dienstagunterricht bleibt erhalten',()=>{
  assert.equal(nextInstructionalDelta('2026-10-05',1,[{weekday:1},{weekday:2}],d=>d==='2026-10-12'),1);
  assert.equal(nextInstructionalDelta('2026-10-05',2,[{weekday:1},{weekday:2}],d=>d==='2026-10-12'),2);
});
test('Nur ein Unterrichtsfach an freiem Tag: ganze Woche überspringen',()=>{
  assert.equal(nextInstructionalDelta('2026-10-05',1,[{weekday:1}],d=>d==='2026-10-12'),2);
});
test('Stundenplan ohne Daten: ursprüngliche Kalendernavigation beibehalten',()=>{
  assert.equal(nextInstructionalDelta('2026-10-05',1,[],()=>true),1);
});
test('Keine verfügbare Unterrichtswoche liefert null',()=>{
  assert.equal(nextInstructionalDelta('2026-10-05',1,[{weekday:1}],()=>true),null);
});
test('Lokales Datum um Monats- und Jahreswechsel',()=>{
  assert.equal(datePlus('2026-12-28',7),'2027-01-04');
  assert.equal(datePlus('2026-10-05',21),'2026-10-26');
});
test('Ganzjahresimport: getrennte Reihen mit übermittelten IDs',()=>{
  const p=sample();
  const raw='Einleitung\n<SCHULCOCKPIT_YEAR_IMPORT>\n'+JSON.stringify(p)+'\n</SCHULCOCKPIT_YEAR_IMPORT>';
  assert.equal(parseAnnual(raw,p.courseId,p.schoolYear).sequences.length,2);
  assert.equal(parseAnnual(JSON.stringify(p),p.courseId,p.schoolYear).sequences[1].sequenceId,'s2');
});
test('Falscher Kurs/Jahr, Schema und ungültige JSON-Antwort abweisen',()=>{
  const p=sample();
  assert.throws(()=>parseAnnual(JSON.stringify(p),'rel-7',p.schoolYear),/Schema, Kurs oder Schuljahr/);
  assert.throws(()=>parseAnnual(JSON.stringify(p),p.courseId,'2027/28'),/Schema, Kurs oder Schuljahr/);
  assert.throws(()=>parseAnnual('gar kein JSON',p.courseId,p.schoolYear),/Ungültiges JSON/);
});
test('Import erfordert pro Unterrichtsstunde Titel und Materialliste',()=>{
  const p=sample();p.sequences[0].units[0].materials=null;
  assert.throws(()=>parseAnnual(JSON.stringify(p),p.courseId,p.schoolYear),/Jede Stunde/);
});
test('Kein übergroßer Import',()=>{
  const p=sample();p.sequences=Array.from({length:26},(_,i)=>({title:'Reihe'+i,units:[]}));
  assert.throws(()=>parseAnnual(JSON.stringify(p),p.courseId,p.schoolYear),/1–25/);
});
test('Dateinamen werden pfadsicher',()=>assert.equal(clean('../stufe/Planung.pdf'),'.._stufe_Planung.pdf'));
