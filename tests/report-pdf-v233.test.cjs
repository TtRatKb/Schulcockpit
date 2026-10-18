/* node tests/report-pdf-v233.test.cjs — all reports are synthetic */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const file=path.join(__dirname,'..','schulcockpit-report-pdf-v233.js');
const data=fs.readFileSync(file,'utf8');
const ctx={
  v204PdfBytes:null,v213PreflightPdf:()=>true,
  v200Step5:()=>'<section class="detail-section v224-print"><h3>Drucken, wenn die Rückmeldungen passen</h3></section>',
  v200Feedback:()=>({
    strength:'Klasse, du hast beim Runden von Zahlen gute Ergebnisse erreicht. Toll!',
    next:'Übe das Runden und das Verwenden mathematischer Fachbegriffe. Schau dir deine Aufgaben noch einmal an.'
  }),
  v204BytesBinary:bytes=>String.fromCharCode(...bytes),
  v200Assessment:()=>null,v200Eval:null,
  state:{settings:{schoolYear:'2026/2027'}},
  wire:()=>{},render:()=>{},
  esc:x=>String(x).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'),
  saveState:async()=>{},
  Uint8Array
};
vm.runInNewContext(data,ctx,{filename:file});
const a={title:'Klassenarbeit Nr. 1',scope:'Grundrechenarten I',
  date:'2026-09-30',parentSignatureRequiredV204:true,
  printSettingsV233:{correctedAt:'2026-10-18',mode:'color'}};
const labels=[
 'Du kannst den Zahlenstrahl und die Stellenwerttafel zum Bestimmen und Ordnen von Zahlen nutzen. (A 1–3)',
 'Du kannst Zahlen runden. (A 4)',
 'Du kannst Fachbegriffe zur Addition und Subtraktion verwenden. (A 5)',
 'Du beherrschst das schriftliche Additionsverfahren. (A 6)',
 'Du beherrschst das schriftliche Subtraktionsverfahren. (A 7)'
];
const groups=[
 [7,3,10,'erreicht'],[1,0,9,'noch nicht erreicht'],
 [6,0,10,'teilweise erreicht'],[8,1,10,'erreicht'],[9,0,10,'erreicht']
];
const report={student:{id:'synthetic',name:'Testkind'},complete:true,
  competencies:labels.map((text,i)=>({text,regularEarned:groups[i][0],
    bonusEarned:groups[i][1],regularMax:groups[i][2],status:groups[i][3]})),
  totalReg:31,totalBonusEarned:4,totalAdjusted:35,totalMax:49};
const baseline=JSON.stringify(report);
function make(assessment,r=report){
  return Buffer.from(ctx.v204PdfBytes([r],assessment,null)).toString('latin1');
}
const color=make(a);
assert.match(color,/^%PDF-1\.4/);
assert.match(color,/\/Type \/Catalog \/Pages/);
assert.match(color,/\/BaseFont \/Helvetica/);
assert.match(color,/\/BaseFont \/Times-Bold/);
assert.match(color,/\/Encoding \/WinAnsiEncoding/);
assert.match(color,/Grundrechenarten I/);
assert.match(color,/Klassenarbeit Nr\. 1/i);
assert.match(color,/2026\/2027/);
assert.match(color,/30\.09\.2026/);
assert.match(color,/18\.10\.2026/);
assert.doesNotMatch(color,/Beurteilung Klassenarbeit|Moeglich|Rueckmeldung/);
assert.match(color,/M\\366gliche/);
assert.match(color,/Deine R\\374ckmeldung/);
assert.match(color,/K\\374rzel/);
assert.match(color,/\(7 \+ 3\) Tj/);
assert.match(color,/\(10\) Tj/);
assert.match(color,/\(E\) Tj/);
assert.match(color,/\(TE\) Tj/);
assert.match(color,/\(NNE\) Tj/);
assert.match(color,/GESAMTPUNKTE/);
assert.match(color,/ANRECHENBAR/);
assert.match(color,/Bonuspunkte|Bonus z\\344hlt|Bonus  \/  regul\\344r m\\366glich/);
assert.match(color,/Unterschrift eines Erziehungsberechtigten/);
assert.match(color,/K\\374rzel \/ Unterschrift der Fachlehrkraft/);
assert.equal((color.match(/\/Type \/Page \/Parent/g)||[]).length,1,'normal five-competency sheet should fit A4');
assert.equal(JSON.stringify(report),baseline,'generating PDF does not mutate student data');
const mono=make({...a,printSettingsV233:{...a.printSettingsV233,mode:'mono'}});
assert.notEqual(color,mono,'color and grayscale pdfs differ');
assert.doesNotMatch(mono,/0\.03 0\.48 0\.58 rg/,'mono must not use colored accents');
assert.equal((mono.match(/\/Type \/Page \/Parent/g)||[]).length,1);
const noParent=make({...a,parentSignatureRequiredV204:false});
assert.doesNotMatch(noParent,/Unterschrift eines Erziehungsberechtigten/);
assert.match(noParent,/Unterschrift der Fachlehrkraft/);
const ext={...report,competencies:Array.from({length:19},(_,i)=>
  ({...report.competencies[i%5],text:report.competencies[i%5].text+' Erweiterte Übung.'}))};
const multipage=make(a,ext);
assert.ok((multipage.match(/\/Type \/Page \/Parent/g)||[]).length>1,'long table uses additional pages');
const longFeedback='Bitte wiederhole diese wichtigen mathematischen Aufgaben gründlich. '.repeat(14);
ctx.v200Feedback=()=>({strength:longFeedback,next:longFeedback});
const longPdf=make(a);
assert.ok((longPdf.match(/\/Type \/Page \/Parent/g)||[]).length>=2,'long authored feedback can continue');
assert.match(longPdf,/Unterschrift der Fachlehrkraft/);
assert.ok(ctx.v213PreflightPdf(report,a));
const view=ctx.v200Step5(a,{});
assert.match(view,/data-v233-setting="examLabel"/);
assert.match(view,/data-v233-setting="topic"/);
assert.match(view,/data-v233-setting="correctedAt"/);
assert.match(view,/Farbig/);
assert.match(view,/Schwarz-Wei/);
console.log('PASS: report PDF V0.23.3 – typography, German glyphs, E/TE/NNE, bonus, A4, long pages, B/W, signature, local inputs');
