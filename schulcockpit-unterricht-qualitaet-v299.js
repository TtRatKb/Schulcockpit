/* V0.29.9 – image research brief and didactic import audit without changing
 * the existing JSON schema or PowerPoint master interface. */
(function(){
'use strict';
const core=SC_LESSON_QUALITY_V299;
const oldNormalize=normalizeAiPackage;
normalizeAiPackage=function(raw){
 return core.enrich(raw,oldNormalize(raw));
};
function qualityNotes(pkg){
 const issues=core.inspect(pkg);
 const imageCount=(pkg?.slides||[]).filter(s=>String(s.notes||'').includes('[BILDVORSCHLAG')).length;
 if(!issues.length&&!imageCount)return '';
 return '<aside class="v299-quality"><strong>Didaktischer Kurzcheck für deinen Import</strong>'+
 (issues.length?'<ul>'+issues.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>':'')+
 (imageCount?'<p>'+imageCount+' Bildvorschlag/-vorschläge sind in den Foliennotizen gespeichert. '+
  'Für die automatische Platzierung im Momiji-Master musst du ein echtes PNG/JPG im Materialhub zuordnen. '+
  'Ein Link allein ist keine lokal verfügbare Bilddatei.</p>':'')+
 '<small>Der Hinweis ist eine Qualitätskontrolle, keine automatische Änderung deiner Unterrichtsphasen.</small></aside>';
}
const oldWizardImport=wizardImportStepV14;
wizardImportStepV14=function(l){
 const html=oldWizardImport(l);
 const notes=wizardV14?.parsed?qualityNotes(wizardV14.parsed):'';
 return notes?html.replace('<div class="wizard-footer-v14">',notes+'<div class="wizard-footer-v14">'):html;
};
const oldAiImport=aiImportPanel;
aiImportPanel=function(l,pkg,raw){
 const html=oldAiImport(l,pkg,raw),notes=qualityNotes(pkg);
 return notes?html.replace('<div class="import-options">',notes+'<div class="import-options">'):html;
};
if(typeof window!=='undefined')window.SchulcockpitLessonQualityV299={qualityNotes,inspect:core.inspect};
})();