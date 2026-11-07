/* Synthetic-only regression. Print all 27 reports on exactly 27 pages, with
 * complete point tables, bonus statuses, and TWO visible narrative cards.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const fit=require('../schulcockpit-report-fit-v301-core.js');
assert.deepEqual(fit.separateTaskRefs('Feste zuordnen (A6, A8, A11)'),
 {main:'Feste zuordnen',task:'(A6, A8, A11)'});
assert.deepEqual(fit.separateTaskRefs('Feste zuordnen (A6, A8, A11).'),
 {main:'Feste zuordnen',task:'(A6, A8, A11).'});
assert.deepEqual(fit.separateTaskRefs('Zahlen runden (A 1–3)'),
 {main:'Zahlen runden',task:'(A 1–3)'});
assert.deepEqual(fit.separateTaskRefs('Fachbegriffe erklären (A 6, A 8, A 11)'),
 {main:'Fachbegriffe erklären',task:'(A 6, A 8, A 11)'});
assert.deepEqual(fit.separateTaskRefs('Werturteil fällen (Ethik)'),
 {main:'Werturteil fällen (Ethik)',task:''});
const base=fs.readFileSync(path.join(__dirname,'..','schulcockpit-report-pdf-v233.js'),'utf8');
const ctx={
 v204PdfBytes:null,v213PreflightPdf:()=>true,
 v200Step5:()=>'<section class="detail-section v224-print"><div class="v200-actions"><button class="secondary" data-v200-step="4">Back</button></div></section>',
 v200Feedback:()=>({strength:'Du kannst jüdische Regeln und Begriffe bereits gut erklären und auf bekannte Beispiele beziehen.',
 next:'Schau dir die Speisevorschriften noch einmal an. Versuche, ihre Bedeutung für den Alltag in eigenen Worten zu erklären.'}),
 v204BytesBinary:bytes=>String.fromCharCode(...bytes),
 v200Assessment:()=>null,v200Eval:null,v224Report:()=>[],v224Index:()=>0,
 v224Serialized:fn=>Promise.resolve().then(fn),v200PrivatePut:async()=>{},
 state:{settings:{schoolYear:'2026/27'}},wire:()=>{},render:()=>{},saveState:async()=>{},
 esc:x=>String(x),Uint8Array,console,window:{}
};
vm.createContext(ctx);
vm.runInContext(base,ctx);
vm.runInContext(read('schulcockpit-report-fit-v301-core.js'),ctx);
vm.runInContext(read('schulcockpit-report-onepage-v301.js'),ctx);
const exam={title:'Klassenarbeit',scope:'Judentum',date:'2026-10-23',
 printSettingsV233:{correctedAt:'2026-11-07',mode:'color'},
 parentSignatureRequiredV204:true};
const labels=[
 'Du kannst Aussagen über den jüdischen Alltag und gelebten Glauben auf ihre Richtigkeit prüfen (A5, A12).',
 'Du kannst jüdische Speisevorschriften erklären und auf Mahlzeiten anwenden (A2, A9, A14).',
 'Du kannst wichtige religiöse Orte, Gegenstände und Fachbegriffe des Judentums benennen und zuordnen (A6, A8, A11).',
 'Du kannst religiöse Regeln in einer Alltagssituation erklären, respektvolles Verhalten begründen und Verallgemeinerungen hinterfragen (A10).',
 'Du kannst die Bedeutung eines jüdischen Symbols aus einem Informationstext erschließen (A13).',
 'Die Schülerinnen und Schüler können wichtige Feste im Judentum beschreiben und erklären (A1, A3, A4).'
];
const categories=['erreicht','teilweise erreicht','noch nicht erreicht'];
function makeReport(i){
 return {student:{id:'synthetic-'+i,name:'Testkind '+String(i+1).padStart(2,'0')},
  complete:true,totalMax:39,totalReg:28,totalBonusEarned:3,totalAdjusted:31,
  competencies:labels.map((text,j)=>({
   id:'K'+j,text,regularMax:j===2?15:6,regularEarned:j===2?10:4,
   bonusEarned:j===5?1:0,status:categories[j%3]}))};
}
const one=makeReport(0);
const copy=JSON.stringify(one);
const pages=ctx.v233ReportPages(one,exam,null);
assert.equal(pages.length,1,'six long Religion competencies and two comments fit on one A4');
const stream=pages[0];
assert.match(stream,/A6, A8, A11/,'task references stay together, no dangling A11');
assert.match(stream,/Was dir schon gut gelingt/);
assert.match(stream,/Dein n\\344chster Lernschritt/);
assert.match(stream,/Unterschrift eines Erziehungsberechtigten/);
assert.match(stream,/GESAMTPUNKTE/);
assert.match(stream,/ANRECHENBAR/);
assert.match(stream,/\(TE\) Tj/);
assert.match(stream,/\(E\) Tj/);
const positions=[...stream.matchAll(/(?:^| )(\d+(?:\.\d+)?) (\d+(?:\.\d+)?) Td/g)].map(x=>Number(x[2]));
const drawn=[...stream.matchAll(/ ([\d.]+) Tm \(/g)];
assert(stream.includes(' 69 m ')||stream.includes(' 69 '),'signature is on page 1');
assert.equal(JSON.stringify(one),copy,'render must not mutate marks or reports');
const profile=ctx.window.SchulcockpitReportOnePageV301.plan(one,exam);
assert(['balanced','compact','fitted'].includes(profile.profile.id),
 'scenario that previously made a second page should use adaptive A4 fitting');
assert(profile.bottom>=profile.profile.bottomLimit,'no feedback or signature overlap');
const batch=Array.from({length:27},(_,i)=>makeReport(i));
const pdf=Buffer.from(ctx.v204PdfBytes(batch,exam,null)).toString('latin1');
assert.match(pdf,/^%PDF-1\.4/);
assert.match(pdf,/\/Count 27/,'27 children produce 27 physical pages, not 54');
assert.equal((pdf.match(/\/Type \/Page \/Parent/g)||[]).length,27);
assert.equal((pdf.match(/Was dir schon gut gelingt/g)||[]).length,27);
assert.equal((pdf.match(/Dein n\\344chster Lernschritt/g)||[]).length,27);
const byteCopy=Buffer.from(ctx.v204PdfBytes([one],exam,null)).toString('latin1');
for(const m of byteCopy.matchAll(/(\d+) 0 obj\n/g))
 assert(new RegExp('^'+String(m.index).padStart(10,'0')+' 00000 n ','m').test(byteCopy),
  'every PDF xref offset is correct');
const le={...one,complete:false,learningSupportV235:true,scoreCompleteV283:true};
assert.equal(ctx.v233ReportPages(le,exam,null).length,1);
assert.match(ctx.v233ReportPages(le,exam,null)[0],/individuelle Punktebasis/);
assert.throws(()=>ctx.v233ReportPages({...le,scoreCompleteV283:false},exam,null),/Punkteerfassung/);
const extreme={...one,competencies:Array.from({length:19},(_,i)=>
 ({...one.competencies[i%6],text:labels[i%6]+' Noch mehr ausführlich formulierte Teilfähigkeiten.'}))};
assert.throws(()=>ctx.v233ReportPages(extreme,exam,null),
 /Einseitiger Kompetenzbogen nicht lesbar möglich/,
 'impossible cases must fail clearly instead of clipping or generating multiple sheets');
const longText='Diese sprachliche Rückmeldung ist bewusst außergewöhnlich lang und wird ohne Kürzung übernommen. '.repeat(20);
ctx.v200Feedback=()=>({strength:longText,next:longText});
assert.throws(()=>ctx.v233ReportPages(one,exam,null),/Einseitiger Kompetenzbogen nicht lesbar möglich/);
const view=ctx.v200Step5(exam,{});
assert.match(view,/eine A4-Seite je Kind/);
console.log('One-page competency PDF: six long Religion competencies, orphan-free refs, 27/27 pages, LE, bonus, footer, exact xref and overflow guard OK');