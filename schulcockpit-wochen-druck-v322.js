/* Schulcockpit V0.32.2 – konsolidiertes Druckpaket auf der bestehenden
 * Wochen-Druckverwaltung, ohne neue Druckdaten oder ungefragte Statuswechsel.
 */
(function(){
'use strict';
const C=window.SchulcockpitSmartPrintCoreV322;
if(!C)throw Error('Wochen-Druckpaket: Kernmodul fehlt.');
const priorPrintItems=printItems;
function token(row){
 return String(row.lesson?.id||'')+'|'+String(row.plan?.id||row.plan?.materialId+'|'+row.plan?.variantId);
}
function report(){
 const old=window.SchulcockpitPrintAuditV297?.audit?.();
 if(!old)throw Error('Die bestehende Druckprüfung konnte nicht geladen werden.');
 const allowed=new Set(priorPrintItems().map(token));
 const duplicate=window.SchulcockpitWeekDuplicatesV315?.inspect?.()||{};
 const hiddenIds=new Set((duplicate.hidden||[]).map(x=>x.extraId));
 const conflictIds=new Set((duplicate.collisions||[]).flatMap(x=>x.ids||[]));
 const excluded=[...(old.excluded||[])];
 const available=[],missing=[];
 for(const row of [...(old.available||[]),...(old.missing||[])]){
  const l=row.lesson,reason=
   hiddenIds.has(l.id)?'Zusätzliche Stundenkarte wird nicht doppelt gedruckt':
   conflictIds.has(l.id)?'Mehrere unterschiedliche Stundenkarten für denselben Termin – bitte erst prüfen':
   (v182IsHeld(l)||v182IsCanceled(l))?'Stunde bereits gehalten oder ausgefallen':
   (()=>{const type=window.SchulcockpitLessonContextV289?.context?.(l)?.type;
      return type==='exam'?'Klassenarbeit – keine normalen Arbeitsblätter drucken':
       type==='excursion'?'Exkursion – kein normaler Kopierauftrag':
       type==='substitution'?'Vertretungsstunde – eigenes Materialpaket verwenden':'';})()||
   !allowed.has(token(row))?'Arbeitsblatt laut dokumentiertem Unterrichts-Ist schon vorhanden, verteilt oder abgeschlossen':'';
  if(reason){excluded.push({lessonId:l.id,materialId:row.plan.materialId,
    variantId:row.plan.variantId,reason});continue;}
  (row.fileReady?available:missing).push(row);
 }
 return {available,missing,excluded,open:[...available,...missing]};
}
function normalized(){return C.normalize(report());}
function meta(){
 return {weekStart:state.settings?.activeWeekStart||'',generatedAt:new Date().toISOString()};
}
function message(report,parsed){
 if(!parsed.groups.length){
  if(report.missing.length)return 'Noch kein vollständiger Druckauftrag: '+report.missing.length+
   ' Datei(en) fehlen lokal. Bitte im Materialhub prüfen.';
  return 'Für diese Woche sind keine neuen Kopien erforderlich.';
 }
 return parsed.groups.length+' unterschiedliche Druckdatei'+(parsed.groups.length===1?'':'en')+
  ' · '+parsed.totalCopies+' Kopien · '+parsed.sourceCount+' Druckpositionen aus dem Stundenplan.';
}
function groupHtml(g){
 const courses=g.rows.map(r=>'<li>'+r.copies+'× '+esc(r.course)+' · '+esc(r.date)+
  (r.period?' · '+esc(r.period):'')+'</li>').join('');
 return '<article class="v322-group"><div class="v322-group-main">'+
  '<div class="v322-mode">'+(g.mode==='color'?'FARBE':'S/W')+'</div>'+
  '<div class="v322-file"><strong>'+esc(g.sourceFileName)+'</strong>'+
  (g.variantLabel?'<small>Fassung: '+esc(g.variantLabel)+'</small>':'')+
  '<details><summary>Für welche Stunden?</summary><ul>'+courses+'</ul></details></div>'+
  '<strong class="v322-count">'+g.copies+'×</strong></div>'+
  '<div class="v322-group-actions"><button type="button" class="text-button" data-v322-printed="'+esc(g.id)+'">Diese Kopien sind erledigt</button></div></article>';
}
function panel(compact=false){
 const r=report(),x=C.normalize(r);
 const old=(r.excluded||[]).length,missing=r.missing.length;
 const notes='<div class="v322-stats">'+
  '<span><strong>'+x.groups.length+'</strong> Datei'+(x.groups.length===1?'':'en')+'</span>'+
  '<span><strong>'+x.totalCopies+'</strong> Kopien</span>'+
  '<span><strong>'+x.sourceCount+'</strong> Unterrichts-Druckpositionen</span>'+
  (missing?'<span class="v322-warning"><strong>'+missing+'</strong> fehlende Dateien</span>':'')+
  '</div>';
 return '<section class="panel v322-week" aria-label="Intelligentes Wochen-Druckpaket">'+
  '<div class="section-head"><div><span class="eyebrow">AUSGEWÄHLTE PLANUNGSWOCHE · DRUCKÜBERSICHT</span>'+
  '<h2>Intelligentes Druckpaket</h2></div></div>'+
  '<p>'+esc(message(r,x))+'</p>'+notes+
  (x.groups.length?'<div class="v322-groups">'+x.groups.map(groupHtml).join('')+'</div>':'')+
  (missing?'<details class="v322-errors" open><summary>Fehlende Druckdateien – bitte vor dem ZIP-Export klären</summary>'+
    '<ul>'+r.missing.map(i=>'<li>'+esc(i.variant?.fileName||i.material?.title||'Datei fehlt')+
     ' · '+esc(i.cls?.subject||'')+' '+esc(i.cls?.name||'')+' · '+esc(i.lesson.date)+'</li>').join('')+
    '</ul></details>':'')+
  (old?'<details class="v322-excluded"><summary>'+old+' bereits erledigte, veraltete oder unklare Druckaufträge nicht berücksichtigt</summary>'+
    '<ul>'+r.excluded.slice(0,100).map(i=>'<li>'+esc(i.reason)+'</li>').join('')+'</ul>'+
    (old>100?'<small>Weitere '+(old-100)+' Positionen ausgeschlossen.</small>':'')+'</details>':'')+
  '<div class="v322-actions">'+
   '<button type="button" class="primary" data-v322-download'+(x.groups.length?'':' disabled')+'>Druckpaket herunterladen (ZIP)</button>'+
   '<button type="button" class="secondary" data-v322-list>Druckliste herunterladen</button>'+
   (x.groups.length?'<button type="button" class="secondary" data-v322-done>Alles als kopiert markieren</button>':'')+
  '</div><p class="microcopy">Identische Dateien mit gleichem Druckmodus werden nur einmal ins ZIP gelegt; die Kopienzahlen werden addiert. Die Druckliste zeigt die Verteilung pro Klasse. Das Herunterladen setzt keine Kopierhäkchen.</p></section>';
}
function insert(html){
 const m=html.match(/<div class="content-grid[^"]*">/);
 if(!m)return panel()+html;
 return html.replace(m[0],m[0]+panel());
}
const oldPrep=weekPrepViewV14;
weekPrepViewV14=function(){return insert(oldPrep());};
weekPrepViewV08=weekPrepViewV14;
weekPrepViewV12=weekPrepViewV14;
const oldPrint=printView;
printView=function(){return insert(oldPrint());};
// Unify regular print controls and downstream status readers with the audited,
// V306-effective queue; V297 alone does not know previous-hour reuse decisions.
printItems=function(){return report().open;};
openPrintItems=function(){return printItems();};
printListText=function(){
 const r=report();return C.printList(C.printableManifest(r,meta()));
};
async function download(){
 const r=report(),x=C.normalize(r);
 if(!x.groups.length)throw Error('Keine druckbaren Dateien vorhanden.');
 if(r.missing.length)throw Error('Es fehlen '+r.missing.length+' Originaldatei(en) im lokalen Speicher. Druckpaket nicht erstellt. Bitte fehlende Dateien prüfen.');
 if(x.invalid.length)throw Error('Einige Druckaufträge sind unvollständig oder doppelt. Bitte die Druckliste prüfen.');
 const manifest=C.printableManifest(r,meta());
 const z=new JSZip();
 for(const g of x.groups){
  const file=await fileStoreGet(g.fileKey);
  if(!file?.blob||file.blob.size===0)throw Error('Original nicht im lokalen Speicher: '+g.sourceFileName);
  z.file(g.name,await file.blob.arrayBuffer());
 }
 // Do not include class-wide personal roster or hidden private fields.
 z.file('Druckliste.txt',C.printList(manifest));
 z.file('Druckkontrolle.json',JSON.stringify(manifest,null,2));
 const bytes=await z.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});
 downloadBlob('KW'+(typeof activeWeekNumber==='function'?activeWeekNumber():kw())+
  '_Druckpaket_konsolidiert.zip',bytes);
 return {groups:x.groups.length,copies:x.totalCopies};
}
downloadPrintZip=async function(){
 try{return await download();}
 catch(err){alert('Wochen-Druckpaket: '+(err.message||err));return null;}
};
async function done(id){
 const x=C.normalize(report()),g=x.groups.find(g=>g.id===id);
 if(!g)throw Error('Dieser Druckauftrag ist nicht mehr aktuell.');
 const text=g.copies+' Exemplare von „'+g.sourceFileName+'“ für '+g.rows.length+
  ' Unterrichtsposition(en) wirklich kopiert? Die Kopierhäkchen der betroffenen Stunden werden gesetzt.';
 if(!confirm(text))return;
 await mark(g.rows);
}
async function mark(rows){
 // Only the existing alreadyPrinted property changes; no new material state.
 const previous=rows.map(row=>({p:row.planRef,before:row.planRef.alreadyPrinted}));
 try{
  for(const {p} of previous)p.alreadyPrinted=true;
  await saveState();render();
 }catch(err){
  for(const {p,before} of previous)p.alreadyPrinted=before;
  render();throw err;
 }
}
async function doneAll(){
 const r=report(),x=C.normalize(r);
 if(r.missing.length||x.invalid.length)throw Error('Es fehlen Dateien oder es gibt unklare Druckaufträge. Bitte zuerst prüfen.');
 if(!x.groups.length)throw Error('Keine offenen Druckaufträge vorhanden.');
 if(!confirm('Wirklich ALLE '+x.totalCopies+' Kopien ('+x.groups.length+
   ' Druckdateien) bereits ausgedruckt? Erst nach dem tatsächlichen Kopieren bestätigen.'))return;
 await mark(x.groups.flatMap(g=>g.rows));
}
const oldWire=wire;
wire=function(){
 oldWire();
 for(const b of document.querySelectorAll('[data-v322-download]'))b.addEventListener('click',()=>void downloadPrintZip());
 for(const b of document.querySelectorAll('[data-v322-list]'))b.addEventListener('click',()=>{
  downloadText('KW'+(typeof activeWeekNumber==='function'?activeWeekNumber():kw())+'_Druckliste_konsolidiert.txt',printListText());
 });
 for(const b of document.querySelectorAll('[data-v322-printed]'))b.addEventListener('click',()=>void done(b.dataset.v322Printed).catch(err=>alert('Kopierstatus: '+(err.message||err))));
 for(const b of document.querySelectorAll('[data-v322-done]'))b.addEventListener('click',()=>void doneAll().catch(err=>alert('Kopierstatus: '+(err.message||err))));
};
const oldRender=render;
render=function(){
 oldRender();
 const badge=document.querySelector('.brand small');
 if(badge)badge.textContent=(state.settings?.schoolYear||'')+' · V0.32.2';
};
window.SchulcockpitSmartPrintV322={report,normalized,download,done,doneAll,printListText};
})();
