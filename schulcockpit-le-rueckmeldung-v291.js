/* V0.29.1 – Completed LE scores are printable as a points-only report.
 * A separate zieldifferente Beurteilung remains pending; no E/TE/NNE
 * judgement is inferred and neither raw points nor private overrides change. */
(function(){
'use strict';
function ready(report){
  return !!report&&(report.complete===true||
    (report.learningSupportV235===true&&report.scoreCompleteV283===true));
}
const statusBefore=v224Status;
v224Status=function(report){
  if(!report?.learningSupportV235)return statusBefore(report);
  return report.scoreCompleteV283?'LE · Punkte vollständig':'LE · Punkte noch offen';
};
const step5Before=v200Step5;
v200Step5=function(a,priv){
  let html=step5Before(a,priv);
  const reports=v200ReportList(),le=reports.filter(r=>r.learningSupportV235);
  if(!le.length)return html;
  const leReady=le.filter(ready).length,normalReady=reports.filter(r=>!r.learningSupportV235&&r.complete).length;
  const pending=reports.length-normalReady-leReady;
  const notice='<section class="detail-section v235-pending"><strong>LE · Punkte und Beurteilung getrennt</strong>'+
    '<p>Für '+leReady+' von '+le.length+' LE-Kind(ern) sind alle Punkte erfasst. '+
    'Dafür kann eine <strong>Punkteübersicht mit persönlicher Rückmeldung</strong> gedruckt werden. '+
    'Die zieldifferente Kompetenzbeurteilung erfolgt separat; es werden keine E/TE/NNE-Stufen abgeleitet.'+
    '</p></section>';
  html=html.replace(/<section class="detail-section v235-pending">[\s\S]*?<\/section>/,notice);
  const printText='<p>'+normalReady+' reguläre Kompetenzbögen und '+leReady+' LE-Punkteübersicht(en) druckbereit.'+
    (pending?' '+pending+' Rückmeldung(en) wegen fehlender Punkte noch nicht druckbereit.':'')+
    ' Die persönlichen Texte werden vor dem Druck gespeichert.</p>';
  html=html.replace(/<p>\d+ von \d+ Kompetenzbögen vollständig\.[\s\S]*?Die persönlichen Texte werden vor dem Druck noch einmal mitgenommen\.<\/p>/,printText);
  html=html.replace('Einzelne Kompetenzbögen als PDF-ZIP','Rückmeldungen als PDF-ZIP (inkl. LE-Punkteübersichten)');
  const selected=reports[v224Index(reports.length)];
  if(selected?.learningSupportV235){
    const scoreText=selected.scoreCompleteV283
      ?'Punkte vollständig: '+esc(v233Number(selected.totalAdjusted))+' / '+esc(v233Number(selected.totalMax))+
        ' anrechenbar'+(Number(selected.totalBonusEarned)>0?' · '+esc(v233Number(selected.totalBonusEarned))+' Bonuspunkte erzielt':'')
      :'Punkte noch offen: '+esc((selected.scoreMissingV283||[]).join(', ')||'Bitte die Teilwertungen prüfen');
    const summary='<div class="v224-review-summary"><strong>'+esc(selected.student.name)+'</strong> · '+
      scoreText+' · zieldifferente Beurteilung separat</div>';
    html=html.replace(/<div class="v224-review-summary">[\s\S]*?<\/div>/,summary);
    html=html.replace('<h4>Kompetenzen auf einen Blick</h4>',
      '<h4>Erfasste Punkte nach Lernbereichen (ohne Kompetenzstufen)</h4>');
    html=html.replace(/noch nicht zieldifferent bewertet · offen/g,
      'Kompetenzbeurteilung separat · keine Einstufung');
    html=html.replace('Die beiden Texte werden im PDF verwendet, sobald du sie speicherst.',
      'Deine Texte erscheinen auf der LE-Punkteübersicht, sobald du sie speicherst.');
  }
  return html;
};
function getPrintData(){
  const assessment=v200Assessment(v200Eval?.assessmentId);
  if(!assessment)throw Error('Keine Klassenarbeit geöffnet.');
  const reports=v200ReportList(),printable=reports.filter(ready);
  if(!printable.length)throw Error('Noch keine Rückmeldung mit vollständig erfassten Punkten druckbereit.');
  const skipped=reports.length-printable.length;
  return {assessment,reports,printable,skipped};
}
function confirmSkipped(n){
  return !n||confirm(n+' Kind(er) haben noch unvollständige Punktwerte und werden beim Druck ausgelassen. Fortfahren?');
}
v200DownloadPdfZip=async function(){
  const {assessment,printable,skipped}=getPrintData();
  if(!confirmSkipped(skipped))return;
  const sig=await v204SignatureJpeg(assessment),z=new JSZip();
  for(const r of printable){
    const bytes=v204PdfBytes([r],assessment,sig);
    const title=r.learningSupportV235?'LE_Punkteuebersicht':(assessment.title||'Kompetenzbogen');
    const filename=v200SafeName(r.student.name)+'_'+v200SafeName(title)+'.pdf';
    z.file(filename,bytes);
  }
  z.file('HINWEIS_DATENSCHUTZ.txt',
    'Dieses ZIP enthaelt personenbezogene Leistungsdaten. Nicht in ChatGPT oder andere nicht freigegebene Dienste hochladen.\n'+
    'LE-Punkteuebersichten dokumentieren ausschliesslich erfasste Punkte und persoenliches Feedback, keine zieldifferente Kompetenzbeurteilung.');
  downloadBlob(v200SafeName(cls(assessment.classId)?.name||'Klasse')+'_'+
    v200SafeName(assessment.title||'Rueckmeldungen')+'_PDF.zip',
    await z.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}}));
};
v200DownloadCombinedPdf=async function(){
  const {assessment,printable,skipped}=getPrintData();
  if(!confirmSkipped(skipped))return;
  const sig=await v204SignatureJpeg(assessment);
  downloadBlob(v200SafeName(cls(assessment.classId)?.name||'Klasse')+'_'+
    v200SafeName(assessment.title||'Rueckmeldungen')+'_gesamt.pdf',
    new Blob([v204PdfBytes(printable,assessment,sig)],{type:'application/pdf'}));
};
const renderBefore=render;
render=function(){
  renderBefore();
  if(typeof document==='undefined')return;
  const version=document.querySelector('.brand small');
  if(version)version.textContent=state.settings.schoolYear+' · V0.29.1';
};
if(typeof window!=='undefined')window.SchulcockpitLEPrintV291={ready};
})();