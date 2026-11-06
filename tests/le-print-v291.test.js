/* V0.29.2 regression: individually adapted LE competence stages, not final pastoral assessment. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=name=>fs.readFileSync(require('node:path').join(__dirname,'..',name),'utf8');
const normal={
  student:{id:'regular',name:'Testkind A'},complete:true,learningSupportV235:false,
  totalMax:10,totalReg:7,totalBonusEarned:1,totalAdjusted:8,
  competencies:[{id:'c',text:'Zahlen zuordnen',regularMax:10,regularEarned:7,bonusEarned:1,status:'teilweise erreicht',pct:80}]
};
const le={
  student:{id:'le',name:'Testkind B'},complete:false,learningSupportV235:true,
  scoreCompleteV283:true,scoreMissingV283:[],missing:['LE: zieldifferente Bewertung separat ausstehend'],
  totalMax:10,totalReg:7,totalBonusEarned:1,totalAdjusted:8,
  competencies:[{id:'c',text:'Zahlen zuordnen',regularMax:10,regularEarned:7,bonusEarned:1,
    status:'erreicht',pct:80}]
};
const assessment={title:'Test',date:'2026-11-06',classId:'class',printSettingsV233:{mode:'mono',topic:'Zahlen'}};
const ctx={
  v204PdfBytes:()=>{},v200Step5:()=>'',v200Eval:{assessmentId:'test',privateData:{}},
  v200Feedback:()=>({strength:'Ein guter Anfang.',next:'Weiter ueben.'}),
  v200Assessment:()=>assessment,v200SafeName:x=>x,cls:()=>({name:'Klasse'}),
  wire:()=>{},render:()=>{},state:{settings:{schoolYear:'2026/27'}},
  Blob,Uint8Array,console
};
vm.createContext(ctx);
vm.runInContext(read('schulcockpit-report-pdf-v233.js'),ctx);
const scored=ctx.v233ReportPages(le,assessment,null).join('');
assert.match(scored,/Deine Kompetenz/); // PDF WinAnsi escapes umlauts
assert.match(scored,/individuelle Punktebasis/);
assert.match(scored,/E\/TE\/NNE aus individuell geltenden Aufgabenpunkten/);
assert.match(scored,/teilweise erreicht/,'stage legend is included');
assert.match(scored,/\(E\) Tj/,'LE regular competence has E level');
assert.match(ctx.v233ReportPages(normal,assessment,null).join(''),/teilweise erreicht/);
assert.throws(()=>ctx.v233ReportPages({...le,scoreCompleteV283:false},assessment,null),/Punkteerfassung/);
const mixed=ctx.v204PdfBytes([normal,le],assessment,null);
assert.equal(Buffer.from(mixed).subarray(0,8).toString(),'%PDF-1.4');
assert(Buffer.from(mixed).includes(Buffer.from('/Count 2')),'both pages should be generated');

let reports=[normal,le],exported=null,printCalls=[];
ctx.v224Status=r=>r.complete?'regulär fertig':'offen';
ctx.v200Step5=()=>'<section class="detail-section v235-pending">alte Sperre</section>'+
  '<div class="v224-review-summary">Noch unvollständig: LE</div>'+
  '<h4>Kompetenzen auf einen Blick</h4>'+
  'noch nicht zieldifferent bewertet · offen'+
  '<p>1 von 2 Kompetenzbögen vollständig. 1 Bögen haben noch offene Bewertungen und können beim ZIP-Export ausgelassen werden. Die persönlichen Texte werden vor dem Druck noch einmal mitgenommen.</p>'+
  'Einzelne Kompetenzbögen als PDF-ZIP';
ctx.v200ReportList=()=>reports;
ctx.v224Index=()=>1;
ctx.esc=s=>String(s);
ctx.v233Number=n=>String(n);
ctx.v204SignatureJpeg=async()=>null;
ctx.v204PdfBytes=rs=>{printCalls.push(rs.map(r=>r.student.id));return new Uint8Array([37,80,68,70]);};
ctx.downloadBlob=(name,blob)=>{exported={name,blob};};
ctx.confirm=()=>true;
ctx.alert=()=>{throw Error('Unexpected alert');};
ctx.JSZip=class {constructor(){this.files=[];}file(name,content){this.files.push(name);}async generateAsync(){return new Blob(['ZIP']);}};
ctx.window={};
vm.runInContext(read('schulcockpit-le-rueckmeldung-v291.js'),ctx);
assert.equal(ctx.window.SchulcockpitLEPrintV291.ready(le),true);
assert.equal(ctx.window.SchulcockpitLEPrintV291.ready({...le,scoreCompleteV283:false}),false);
assert.equal(ctx.v224Status(le),'LE · Punkte vollständig');
const html=ctx.v200Step5(assessment,{});
assert.match(html,/Punkte vollständig: 8 \/ 10/);
assert.match(html,/1 LE-Kompetenzbogen\/\-bögen auf individueller Punktebasis druckbereit/);
assert.match(html,/individuell berechnet/);
assert.doesNotMatch(html,/Noch unvollständig: LE/);
(async()=>{
  await ctx.v200DownloadCombinedPdf();
  assert.deepEqual(printCalls.at(-1),['regular','le']);
  assert.match(exported.name,/gesamt.pdf$/);
  await ctx.v200DownloadPdfZip();
  assert.match(exported.name,/PDF.zip$/);
  reports=[normal,{...le,scoreCompleteV283:false}];
  printCalls=[];
  await ctx.v200DownloadCombinedPdf();
  assert.deepEqual(printCalls.at(-1),['regular']);
  console.log('LE scores, feedback UI, safe PDF forms and both exports OK');
})().catch(e=>{console.error(e);process.exitCode=1;});