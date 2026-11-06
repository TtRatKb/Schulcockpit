/* V0.29.7 – print exactly the *selected* planning week. Fail visibly on
 * missing bytes; never silently omit an advertised file from a ZIP.
 */
(function(){
'use strict';
const core=SC_PRINT_AUDIT_V297;
function audit(){
 const lessons=typeof courseLessonsV14==='function'?courseLessonsV14():currentWeekLessons();
 return core.resolveJobs(lessons,{
  material:id=>mat(id),variant:(id,vid)=>variant(id,vid),
  course:id=>cls(id),hasFile:v=>hasStoredFile(v),
  isActive:(l,h)=>typeof v183IsActive==='function'?v183IsActive(l,h):true,
  resources:l=>typeof allResourceRowsV176==='function'?allResourceRowsV176(l):[]
 });
}
const previousPrintItems=printItems;
printItems=function(){return audit().open;};
downloadPrintZip=async function(){
 const report=audit(),open=report.open;
 if(!open.length){alert('Für diese Planungswoche gibt es keine offenen, noch zu kopierenden Dateien.');return;}
 const zipEntries=core.uniqueNames(report.available);
 const issues=[...report.missing.map(x=>'Original fehlt: '+(x.variant.fileName||x.material.title)),
  ...report.excluded.map(x=>'Nicht im ZIP: '+x.reason)];
 if(!zipEntries.length){
  alert('Es gibt keine lokal verfügbaren, aktiven Druckdateien in dieser Planungswoche. '+issues.join('; '));return;
 }
 if(issues.length&&!confirm(zipEntries.length+' verfügbare Datei(en) könnten in das ZIP aufgenommen werden. '+
    issues.length+' Druckauftrag/Datei(en) sind noch offen oder ausgeschlossen:\n'+
    issues.slice(0,12).join('\n')+'\n\nNur die verfügbaren Dateien herunterladen?'))return;
 const entries=[],manifest=[],errors=[];
 for(const {row,name} of zipEntries){
  try{
   const record=await fileStoreGet(row.variant.fileKey);
   if(!record?.blob||record.blob.size===0){
    errors.push(row.variant.fileName||row.material.title);continue;
   }
   entries.push({name,blob:record.blob});
   manifest.push({date:row.lesson.date,lessonId:row.lesson.id,
    className:(row.cls?.subject||'')+' '+(row.cls?.name||''),
    file:row.variant.fileName||record.name,entry:name,count:row.copies,
    mode:row.plan.mode==='color'?'FARBE':'S/W'});
  }catch(e){errors.push((row.variant.fileName||row.material.title)+': '+(e?.message||e));}
 }
 if(errors.length){
  alert('Das Druckpaket wurde NICHT heruntergeladen, weil Dateien beim tatsächlichen Lesen fehlen:\n'+
   errors.join('\n')+'\n\nBitte die Originale im Materialhub erneut verbinden.');return;
 }
 if(entries.length!==zipEntries.length){
  alert('Druck-ZIP abgebrochen: Dateianzahl und Druckaufträge stimmen nicht überein.');return;
 }
 const readme=['DRUCKPAKET – AUSGEWÄHLTE PLANUNGSWOCHE',
  'KW '+(typeof activeWeekNumber==='function'?activeWeekNumber():''),
  'Im ZIP enthalten: '+entries.length+' Datei(en) für '+new Set(manifest.map(x=>x.lessonId)).size+' Stunde(n)',
  '',...manifest.map(m=>m.count+'x · '+m.mode+' · '+m.className+' · '+m.date+' · '+m.file),
  ...(report.missing.length?['','NICHT ENTHALTEN – Originaldateien fehlen',
   ...report.missing.map(x=>x.variant.fileName||x.material.title)]:[]),
  ...(report.excluded.length?['','AUSGESCHLOSSENE ALTE / INAKTIVE DRUCKAUFTRÄGE',
   ...report.excluded.map(x=>x.reason+' (Stunde: '+x.lessonId+')')]:[])].join('\n');
 entries.push({name:'Druckliste.txt',blob:new Blob([readme],{type:'text/plain;charset=utf-8'})});
 entries.push({name:'Druckkontrolle.json',
  blob:new Blob([JSON.stringify({schema:'schulcockpit.print-audit.v1',weekStart:state.settings.activeWeekStart||'',
   entries:manifest,missing:report.missing.map(x=>({lessonId:x.lesson.id,file:x.variant.fileName})),
   excluded:report.excluded},null,2)],{type:'application/json'})});
 const result=await buildZip(entries);
 downloadBlob('KW'+(typeof activeWeekNumber==='function'?activeWeekNumber():kw())+
  '_Druckpaket_geprueft.zip',result);
};
const prevWeekPrep=weekPrepViewV14;
weekPrepViewV14=function(){
 const html=prevWeekPrep(),report=audit();
 const excluded=report.excluded.length,missing=report.missing.length,ready=report.available.length;
 const total=ready+missing;
 const note='<div class="v297-print-audit"><strong>Druck-ZIP-Prüfung: '+
  ready+' lokale Druckdatei(en) · '+missing+' Datei(en) fehlen'+
  (excluded?' · '+excluded+' veraltete/ausgeblendete Aufträge nicht berücksichtigt':'')+'</strong>'+
  '<p>Gezählt werden nur offene Dateien der ausgewählten Woche. Eine Datei je ZIP-Eintrag; '+
  'Kopiermengen stehen im Dateinamen und in der Druckliste. '+
  'Ausgeblendete und ersetzte Materialien zählen nicht als aktuelle Druckposition.</p>'+
  (missing?'<p class="v297-warning">Bei fehlenden Dateien fragt das Cockpit vor einem unvollständigen ZIP ausdrücklich nach.</p>':'')+'</div>';
 let out=html.replace('<div class="lesson-material-grid-v176">',note+'<div class="lesson-material-grid-v176">');
 // The pre-existing week UI used a count from the calendar week, so update
 // only the label, not historic print status or actual lesson data.
 out=out.replace(/Druck-ZIP \(\d+ Positionen\)/,'Druck-ZIP ('+ready+' Dateien)');
 if(!out.includes('v297-print-audit')&&total+excluded)out=out.replace('</section>',note+'</section>');
 return out;
};
weekPrepViewV08=weekPrepViewV14;
weekPrepViewV12=weekPrepViewV14;
const prevPrintView=printView;
printView=function(){
 const html=prevPrintView(),report=audit();
 return html.replace('</section>',
   '<p class="microcopy">Druckaufträge der ausgewählten Planungswoche: '+report.available.length+
    ' Dateien vorhanden · '+report.missing.length+' fehlen · '+report.excluded.length+
    ' veraltete Einträge ausgeschlossen. Kein stilles Überspringen im ZIP.</p></section>');
};
if(typeof window!=='undefined')window.SchulcockpitPrintAuditV297={audit,downloadPrintZip};
})();