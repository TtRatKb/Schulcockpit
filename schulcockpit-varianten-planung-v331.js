/* V0.33.1 – Material editions drive the lesson prompt and import, not AI guesses.
 * Existing sequence units, original worksheet blobs, and other lessons are preserved.
 */
(function(){
'use strict';
const C=SC_TEACHER_SOURCE_CONTRACT_V331;
const editions=l=>l?C.activeEntries(l,state.materials||[],SC_TEACHER_MATERIAL_PRIORITY_V330)
 .filter(e=>v183IsActive(l,e.hint)&&resourceTypeV14(l,e.hint)!=='ignore'):[];
const label=e=>e.variants.map(v=>v.fileName+
 (C.levelFromName(v.fileName)?' · '+C.levelFromName(v.fileName):'')).join(' · ');
let changing=false;
function focusPanel(l){
 const own=editions(l);
 if(!own.length||v182IsHeld(l))return '';
 const current=l.lessonFocusV331?.title||l.title||l.planReference?.title||'';
 const suggested=own.map(e=>e.title).join(' / ');
 return '<section class="v331-focus"><span class="eyebrow">LEHRKRAFTENTSCHEIDUNG · MATERIAL HAT VORRANG</span>'+
  '<h3>Passt der Stundentitel zu deinen Arbeitsblättern?</h3>'+
  '<p>Der Sollplan heißt <strong>'+esc(l.planReference?.title||l.title||'')+
  '</strong>. Tatsächlich ausgewählt: <strong>'+own.map(e=>esc(e.title)).join(' · ')+
  '</strong>. Falls das nicht zusammenpasst, kannst du den Schwerpunkt dieser '+
  'Stunde direkt korrigieren. Nachfolgende Stunden und Reihen bleiben unverändert.</p>'+
  '<div class="v331-focus-edit"><label>Schwerpunkt dieser konkreten Stunde'+
  '<input type="text" maxlength="160" data-v331-focus-input="'+esc(l.id)+'" value="'+
  esc(current||suggested)+'" placeholder="'+esc(suggested)+'"></label>'+
  '<button type="button" class="secondary" data-v331-focus-save="'+esc(l.id)+
  '">Als Stundenthema übernehmen</button></div>'+
  '<small>Deine hochgeladenen Fassungen: '+own.map(e=>esc(label(e))).join(' · ')+
  '. Dieser Button ändert keine Arbeitsblätter oder weiteren Reihentermine.</small>'+
  (l.aiImportAt?'<p class="v331-older-plan">Für diese Stunde wurde bereits eine ChatGPT-Planung '+
  'importiert. Der bisherige Folienplan wird durch die Titelkorrektur nicht '+
  'automatisch ersetzt. Bitte bei Bedarf anschließend neu planen.</p>':'')+
  '</section>';
}
const oldWizard=wizardPlanStepV14;
wizardPlanStepV14=function(l){
 const h=oldWizard(l),panel=l&&focusPanel(l);
 return panel?h.replace('<h3>Material in dieser Stunde</h3>',
  panel+'<h3>Material in dieser Stunde</h3>'):h;
};
const oldPrompt=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
 const base=oldPrompt(l),chosen=editions(l);
 return chosen.length?C.contract(base,l,chosen):base;
};
makeBrief=concretePlanningPromptV12;
const oldPromptStep=wizardPromptStepV14;
wizardPromptStepV14=function(l){
 const h=oldPromptStep(l),chosen=editions(l);
 if(!chosen.length)return h;
 const text='<p class="v331-prompt-status"><strong>Materialauswahl verbindlich:</strong> '+
  chosen.map(e=>esc(label(e))).join(' · ')+
  '<br>Das ChatGPT-Paket enthält alle ausgewählten Fassungen, nicht nur '+
  'die kopierte Standardversion. Bei fehlenden Dateien bricht der Export ab. '+
  'Es sollen keine neuen Arbeitsblätter erstellt werden.</p>';
 return h.replace('<div class="wizard-footer-v14">',text+
  '<div class="wizard-footer-v14">');
};
const oldImport=wizardImportStepV14;
wizardImportStepV14=function(l){
 const h=oldImport(l),chosen=editions(l);
 if(!chosen.length)return h;
 const proposed=wizardV14.parsed?.materials||[];
 const notice='<div class="v331-import-guard" role="status"><strong>'+
  '✓ Eigene Arbeitsblätter geschützt</strong><p>'+
  (proposed.length?'ChatGPT hat '+proposed.length+' Materialeinträge vorgeschlagen. '+
  'Diese werden bei der Übernahme ausdrücklich ignoriert. ':
  'Alle bereits hochgeladenen Arbeitsblätter bleiben unverändert. ')+
  'Nur Phasen, Folien und sonstige Planungsbestandteile werden übernommen. '+
  'E-/G-Fassungen und bestehende Druckaufträge behalten ihre Zuordnung.</p></div>';
 return h.replace('<div class="wizard-footer-v14">',notice+
  '<div class="wizard-footer-v14">');
};
const oldApply=applyAiPackage;
applyAiPackage=function(l,pkg,opts){
 const chosen=editions(l);
 if(!chosen.length)return oldApply(l,pkg,opts);
 const decision=C.importDecision(l,pkg,chosen);
 const out=oldApply(l,decision.pkg,opts);
 if(decision.suppressed.length){
  l.teacherMaterialImportV331={ignoredTitles:decision.suppressed,
   checkedAt:new Date().toISOString(),reason:'own-worksheets-protected'};
 }
 return out;
};
const oldWire=wire;
wire=function(){
 oldWire();
 document.querySelectorAll('[data-v331-focus-save]').forEach(b=>b.addEventListener('click',async()=>{
  if(changing)return;
  const l=lesson(b.dataset.v331FocusSave),input=document.querySelector(
   '[data-v331-focus-input="'+b.dataset.v331FocusSave+'"]');
  if(!l||!input||v182IsHeld(l))return;
  const title=String(input.value||'').trim();
  if(!title||title.length>160){alert('Bitte einen kurzen Stundenschwerpunkt eingeben.');return;}
  changing=true;b.disabled=true;
  const before={title:l.title,focus:l.lessonFocusV331};
  try{
   l.title=title;
   l.lessonFocusV331={title,previousTitle:before.focus?.previousTitle||
    l.planReference?.title||before.title||'',changedAt:new Date().toISOString()};
   await saveState();
   render();
  }catch(error){
   l.title=before.title;
   if(before.focus)l.lessonFocusV331=before.focus;
   else delete l.lessonFocusV331;
   alert('Stundentitel nicht gespeichert: '+(error.message||error));
   render();
  }finally{changing=false;}
 }));
};
const oldRender=render;
render=function(){
 oldRender();
 const node=document.querySelector('.brand small');
 if(node)node.textContent=state.settings.schoolYear+' · V0.33.1';
};
window.SchulcockpitTeacherSourceContractV331={editions,focusPanel};
})();
