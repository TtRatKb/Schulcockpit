/* V0.33.0 – Own worksheet editions first, provenance collapsed beneath.
 * Wraps existing worksheet actions without changing the stored original files.
 */
(function(){
'use strict';
const C=SC_TEACHER_MATERIAL_PRIORITY_V330;
const replacements=l=>C.entries(l,state.materials||[]);
const lookups=l=>replacements(l);
function escapeText(v){return esc(String(v??''));}
function active(entry,lesson){
 const variants=entry.variants?.length?entry.variants:
  entry.chosen.map(name=>({fileName:name,type:'standard',id:''}));
 return variants.map(v=>{
  const item=entry.activeItems.find(x=>x.variantId===v.id)||
   entry.activeItems.find(x=>x.material?.variants?.some(a=>a.fileName===v.fileName));
  const plan=(lesson.printPlan||[]).find(p=>p.materialId===entry.materialId&&p.variantId===v.id&&
   !p._v183removed&&!p._v183obsolete);
  const label=({standard:'Standardfassung',support:'Förderfassung',
   challenge:'Forderfassung',daz:'Sprachsensible Fassung',solution:'Lösung'})[v.type]||'Fassung';
  const ready=v.fileKey&&typeof hasStoredFile==='function'&&hasStoredFile(v);
  const copied=!!plan?.alreadyPrinted;
  let actions='';
  if(item&&ready){
   actions='<button type="button" class="secondary v330-file-action" data-v177-file="'+
    escapeText(item.materialId+'|'+item.variantId)+'">Datei öffnen ↗</button>';
  }
  if(plan?.needed&&!v182IsHeld(lesson)&&plan.id){
   actions+='<button type="button" class="text-button" data-v177-file-printed="'+
    escapeText(lesson.id+'|'+plan.id)+'">'+
    (copied?'✓ Kopiert · Status ändern':'Als kopiert markieren ✓')+'</button>';
  }
  const stage=plan?.needed?
   (copied?'✓ Bereits kopiert':String(plan.count||0)+' Exemplare eingeplant'):
   v.type==='solution'?'Nur für Lehrkräfte':'Keine automatischen Kopien';
  return '<div class="v330-own-file"><div><strong>'+escapeText(v.fileName)+
   '</strong><small>'+escapeText(label)+' · '+escapeText(stage)+
   (ready?'':' · Dateiverfügbarkeit prüfen')+'</small></div><div class="v330-file-actions">'+actions+
   '</div></div>';
 }).join('');
}
function mainRow(l,r,base,e){
 const src=C.description(e),sourceNames=e.sources.length?e.sources:e.replacedHints,
   id=l.id+'|'+encodeURIComponent(r.hint),isEditing=resourceIsEditorV176(l,r.hint);
 const old='<details class="v330-history"><summary>Frühere Arbeitsblätter ansehen ('+
  sourceNames.length+')</summary><p>Diese Vorlagen sind nicht zusätzlich für '+
  'die Stunde eingeplant. Sie bleiben als Herkunft nachvollziehbar und können '+
  'bei Bedarf wiederhergestellt werden.</p>'+
  '<div class="v330-prior">'+sourceNames.map(n=>'<span>'+escapeText(n)+'</span>').join('')+
  '</div>'+(isEditing?'':'<details class="v330-technical"><summary>Materialzuordnung und weitere Optionen</summary>'+
  base+'</details>')+'</details>';
 const intro='<div class="v330-primary"><span class="v330-priority">✓ Deine Fassung ist aktiv</span>'+
  '<h4>'+escapeText(e.title)+'</h4><p>'+escapeText(src)+
  (e.note?' · '+escapeText(e.note):'')+'</p>'+
  '<div class="v330-own-files">'+active(e,l)+'</div>'+
  (!v182IsHeld(l)?'<div class="v330-primary-actions">'+
    '<button type="button" class="secondary" data-v176-edit="'+escapeText(id)+
      '">Dateien / Kopien bearbeiten →</button>'+
    '<button type="button" class="text-button" data-v296-lesson="'+escapeText(id)+
      '">Weitere eigene Fassung hinterlegen ↗</button>'+
  '</div>':'')+'</div>';
 return '<div class="resource-row-v330" data-v330-primary="'+escapeText(e.key)+'">'+intro+
  (isEditing?'<div class="v330-editor-open">'+base+'</div>':'')+old+'</div>';
}
const oldResourceRow=resourceRowV14;
resourceRowV14=function(l,r,...args){
 if(!l||!r)return oldResourceRow(l,r,...args);
 const choices=lookups(l);
 if(C.secondary(choices,r.hint))return '';
 const base=oldResourceRow(l,r,...args);
 const entry=choices.find(e=>C.primary(e,r.hint));
 if(!entry||r.type==='ignore'||!v183IsActive(l,r.hint))return base;
 return mainRow(l,r,base,entry);
};
function overview(l){
 const choices=lookups(l);
 if(!choices.length)return null;
 const rows=C.effectiveRows(allResourceRowsV176(l),choices,
  r=>v183IsActive(l,r.hint));
 return '<p class="v330-current"><strong>Für diese Stunde ausgewählt:</strong> '+
  rows.map(r=>{
   const own=choices.find(e=>C.primary(e,r.hint));
   return own?'<span class="v330-own-label">✓ '+escapeText(own.title)+' · eigene Fassung</span>':
    escapeText(r.hint);
  }).join(' · ')+'</p>';
}
const oldDay=v182LessonDayHtml;
v182LessonDayHtml=function(l){
 const h=oldDay(l),intro=l&&overview(l);
 if(!intro)return h;
 // V308 already writes a generic status paragraph; replace, don't duplicate it.
 if(/<p class="v308-current-note">[\s\S]*?<\/p>/.test(h))
  return h.replace(/<p class="v308-current-note">[\s\S]*?<\/p>/,intro);
 const marker='<section class="panel v182-end-panel">';
 return h.includes(marker)?h.replace(marker,intro+marker):h;
};
const oldPrompt=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
 const txt=oldPrompt(l),choices=lookups(l);
 if(!choices.length)return txt;
 return C.promptSection(txt,allResourceRowsV176(l),choices,
  rows=>SC_MATERIAL_REALITY_V308.materialBlock(rows),
  r=>v183IsActive(l,r.hint));
};
makeBrief=concretePlanningPromptV12;
const oldRender=render;
render=function(){
 oldRender();
 // One clear visible signal in the main Monday course card, not hidden in a
 // subordinate material hint. Never alter lesson title or course planning.
 for(const row of document.querySelectorAll('.course-prep-card-v14')){
  const trigger=row.querySelector('[data-start-wizard]');
  const l=trigger?lesson(trigger.dataset.startWizard):null;
  const own=l&&lookups(l);
  if(!own?.length)continue;
  const info=row.querySelector('.course-prep-info-v14');
  if(!info||info.querySelector('.v330-monday-badge'))continue;
  const b=document.createElement('span');b.className='v330-monday-badge';
  b.textContent='✓ Eigene Materialfassung aktiv: '+own.map(e=>e.title).join(' · ');
  info.append(b);
 }
 const version=document.querySelector('.brand small');
 if(version)version.textContent=state.settings.schoolYear+' · V0.33.0';
};
window.SchulcockpitTeacherMaterialV330={replacements,overview};
})();
