/* Schulcockpit V0.30.9 – provenance review of imported AI units.
 * A source named by ChatGPT is not automatically verified. Review is an
 * explicit teacher action and does not rewrite already-taught lessons.
 */
(function(){
'use strict';
const C=SC_PLAN_SOURCES_V309;
const beforePrompt=v184Prompt;
v184Prompt=function(){
 const q=seq(v184Flow.sequenceId),c=cls(v184Flow.courseId);
 return C.prompt(beforePrompt(),q,q?.sourceFilesV190||[],c);
};
const beforeNormalize=v184Normalize;
v184Normalize=function(raw){
 const pkg=beforeNormalize(raw);
 pkg.units.forEach((u,i)=>u.sourceEvidenceV309=C.evidence(raw?.units?.[i]?.sourceEvidence||
  raw?.units?.[i]?.sourceEvidenceV309));
 return pkg;
};
const beforePreview=v184ImportPreview;
v184ImportPreview=function(){
 let i=0;
 return beforePreview().replace(/<article class="v184-unit">/g,()=>{
  const u=v184Flow.pkg?.units?.[i++],e=u?.sourceEvidenceV309||C.evidence(null);
  const stated=e.type!=='unspecified'&&e.document;
  return '<article class="v184-unit">'+
   '<div class="v309-import-source '+(stated?'v309-claimed':'v309-unverified')+'">'+
   '<strong>'+(stated?'KI nennt eine Quelle – Inhalt NICHT automatisch geprüft':
    '⚠ Keine belastbare Quellenangabe')+'</strong>'+
   '<small>'+esc(stated?e.document+(e.passage?' · Beleg laut KI: '+e.passage:''):
    'Prüfe Curriculum, Themenkarte und Originalmaterial vor einer Übernahme.')+'</small>'+
   '</div>';
 });
};
const beforeApply=v184Apply;
v184Apply=async function(){
 const original=v184Flow.pkg?.units?.map(x=>({...x}))||[];
 const previous=seq(v184Flow.sequenceId),
  before=new Map((previous?.plan||[]).map(u=>[u.id,{title:u.title,content:u.content,
   objective:u.objective,competencies:u.competencies,review:u.sourceReviewV309}]));
 const result=await beforeApply();
 const q=seq(result.qid);if(!q)return result;
 let changed=false;
 for(const input of original){
  const candidates=(q.plan||[]).filter(u=>
   input.plannedDate&&u.plannedDate===input.plannedDate);
  const matching=candidates.length===1?candidates[0]:
   (q.plan||[]).filter(u=>C.norm(u.title)===C.norm(input.title)).length===1?
    q.plan.find(u=>C.norm(u.title)===C.norm(input.title)):null;
  if(!matching)continue;
  const old=before.get(matching.id);
  if(old?.review?.status==='accepted'&&
   [old.title,old.content,old.objective,old.competencies].some((v,i)=>
    v!==[matching.title,matching.content,matching.objective,matching.competencies][i])){
   matching.sourceReviewV309={status:'unreviewed',note:old.review.note||'',
    changedAt:new Date().toISOString(),previouslyAccepted:true};
  }
  matching.sourceEvidenceV309=C.evidence(input.sourceEvidenceV309);
  changed=true;
 }
 if(changed)await Promise.resolve(saveState());
 return result;
};
function reviewRows(q){
 const units=q?.plan||[];if(!units.length)return '';
 const total=C.tally([q]);
 return '<section class="v309-audit"><div class="section-head compact"><div>'+
 '<span class="eyebrow">QUELLENKONTROLLE · THEMENKARTE / CURRICULUM / MATERIAL</span>'+
 '<h3>Was begründet die einzelnen Stunden?</h3>'+
 '<p class="microcopy">Ein Inhalt kann irgendwo im Curriculum stehen und trotzdem für genau diese Stunde '+
 'unpassend sein. Die App kann den tatsächlichen Inhalt lokaler Themenkarten/PDFs NICHT selbst '+
 'prüfen. Du bestätigst nach Sichtung der Originalquelle.</p></div>'+
 '<span>'+total.unverified+' ungeprüfte KI-Stunden</span></div>'+
 '<details><summary>Quellen und vorgesehene Inhalte aller '+units.length+
 ' Stunden prüfen (auch ältere Reihen)</summary>'+
 '<div class="v309-unit-list">'+units.map((u,i)=>{
  const e=u.sourceEvidenceV309||C.evidence(null),st=C.status(u),
   old=u.sourceReviewV309||{},id=esc(q.id+'|'+u.id);
  return '<article class="v309-unit '+(st==='revision'?'needs-work':'')+'">'+
   '<div class="v309-unit-title"><strong>'+(i+1)+'. '+esc(u.title||'Stunde')+'</strong>'+
    '<span>'+esc(C.unitLabel(u))+'</span></div>'+
   '<p>'+esc(u.content||'Kein genauer Inhalt angegeben')+'</p>'+
   (e.document?'<p class="microcopy">Von ChatGPT genannte Quelle: '+esc(e.document)+
    (e.passage?' · angeblicher Beleg: '+esc(e.passage):'')+
    '. <strong>Diese Angabe ist nicht automatisch verifiziert.</strong></p>':'')+
   '<label>Welche Originalquelle hast du überprüft?'+
    '<input data-v309-source="'+id+'" maxlength="170" placeholder="z. B. Themenkarte Klasse 5 · Division" value="'+
      esc(old.document||'')+'"></label>'+
   '<label>Dein kurzer Hinweis / Abweichung'+
    '<textarea data-v309-note="'+id+'" rows="2" maxlength="450" placeholder="z. B. Teiler/Vielfache gehören nicht in diese Stunde">'+
     esc(old.note||'')+'</textarea></label>'+
   '<div class="v309-actions">'+
    '<button class="secondary" data-v309-review="'+id+'|accepted">Nach Quellenabgleich okay ✓</button>'+
    '<button class="secondary" data-v309-review="'+id+'|revision">Überarbeiten / nicht passend</button>'+
    (old.status?'<button class="text-button" data-v309-review="'+id+'|unreviewed">Prüfstatus zurücksetzen</button>':'')+
   '</div></article>';
 }).join('')+'</div></details></section>';
}
const beforePanel=sequencePanel;
sequencePanel=function(q){
 const h=beforePanel(q);
 if(!q)return h;
 const review=reviewRows(q);
 const end=h.lastIndexOf('</div>');
 return end<0?h+review:h.slice(0,end)+review+h.slice(end);
};
const beforeSequences=sequencesView;
sequencesView=function(){
 const h=beforeSequences(),sum=C.tally(state.sequences||[]);
 if(!sum.unverified&&!sum.revision)return h;
 const banner='<section class="panel v309-audit-banner"><strong>Quellenprüfung für bestehende Reihen</strong>'+
 '<p>'+sum.unverified+' KI-Stunden ohne dokumentierten Quellenabgleich'+
 (sum.revision?' · '+sum.revision+' Stunden zur Überarbeitung markiert':'')+
 '. Diese Angaben werden nicht automatisch verändert. Öffne eine Reihe, '+
 'um den Inhalt mit Themenkarte, Curriculum und Material abzugleichen.</p></section>';
 const i=h.indexOf('<section');
 return i>=0?h.slice(0,i)+banner+h.slice(i):banner+h;
};
const beforeModal=v184ModalHtml;
v184ModalHtml=function(){
 let h=beforeModal();
 if(v184Flow.step===0)h=h.replace('<div class="v184-setup">',
  '<div class="v184-setup"><p class="v309-source-warning">⚠ Für inhaltlich '+
  'verlässliche Planung die konkrete Themenkarte, das Schulcurriculum und die '+
  'benötigten Arbeitsblätter im Chat tatsächlich hochladen. Dateinamen allein reichen nicht.</p>');
 if(v184Flow.step===2){
  const unmatched=(v184Flow.pkg?.units||[]).filter(u=>u.sourceEvidenceV309?.type==='unspecified').length;
  if(unmatched)h=h.replace('Reihenplanung verbindlich übernehmen →',
   'Ungeprüfte Planung übernehmen →');
 }
 return h;
};
const beforeLessonPrompt=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
 let p=beforeLessonPrompt(l);
 const u=seq(l?.sequenceId)?.plan?.find(x=>x.id===l.planReference?.unitId);
 if(!u)return p;
 const status=C.status(u);
 const caution=status==='revision'?'ACHTUNG: Die Lehrkraft hat diese Soll-Stunde als fraglich markiert. '+
  'Weder erfundene Aufgaben noch neue Kompetenzen aus dem beanstandeten Planinhalt ableiten. '+
  'Zuerst mit der Lehrkraft klären, welche Quellen und Inhalte korrekt sind. '+
  (u.sourceReviewV309?.note?' Hinweis: '+u.sourceReviewV309.note:''):
  status==='unverified'?'Die KI-Herkunft dieser groben Soll-Stunde ist NICHT überprüft. '+
  'Curriculum und Themenkarte in der konkreten Stunde nicht durch freie Stoffergänzungen '+
  'erweitern. Nur ausdrücklich bestätigte Materialien und Lehrkraftangaben sind verbindlich.':'';
 if(!caution)return p;
 const note='\n\n## Status der Quellenprüfung (verbindlicher Vorbehalt)\n'+caution+'\n';
 const marker='Danach hänge GENAU EINEN maschinenlesbaren Block an:',i=p.indexOf(marker);
 return i<0?p+note:p.slice(0,i)+note+'\n'+p.slice(i);
};
makeBrief=concretePlanningPromptV12;
const beforeWizard=wizardPlanStepV14;
wizardPlanStepV14=function(l){
 const h=beforeWizard(l);
 const u=seq(l?.sequenceId)?.plan?.find(x=>x.id===l.planReference?.unitId);
 if(!u||!['unverified','revision'].includes(C.status(u)))return h;
 const warning='<p class="v309-lesson-warning">'+
  (C.status(u)==='revision'?'⚠ Diese Soll-Stunde wurde zur Überarbeitung markiert. ':
   'Quelle dieser KI-geplanten Stunde ist noch nicht geprüft. ')+
  'Vor der PowerPoint den Inhalt mit Themenkarte und Material abgleichen.</p>';
 return h.replace('<h3>Material in dieser Stunde</h3>',
  warning+'<h3>Material in dieser Stunde</h3>');
};
const beforeWire=wire;
wire=function(){
 beforeWire();
 document.querySelectorAll('[data-v309-review]').forEach(btn=>btn.onclick=async()=>{
  const raw=btn.dataset.v309Review||'',parts=raw.split('|');
  if(parts.length!==3)return;
  const q=seq(parts[0]),u=q?.plan?.find(x=>x.id===parts[1]),decision=parts[2];
  if(!u||!['accepted','revision','unreviewed'].includes(decision))return;
  const id=CSS.escape(parts[0]+'|'+parts[1]),
   doc=document.querySelector('[data-v309-source="'+id+'"]')?.value?.trim()||'',
   note=document.querySelector('[data-v309-note="'+id+'"]')?.value?.trim()||'';
  if(decision==='accepted'&&doc.length<3)
   return alert('Bitte erst angeben, welche Themenkarte, Curriculumstelle oder Materialquelle du geprüft hast.');
  if(decision==='revision'&&!note)
   return alert('Bitte kurz notieren, was in dieser Stunde geändert werden muss.');
  const previous=u.sourceReviewV309?structuredClone(u.sourceReviewV309):null;
  try{
   u.sourceReviewV309={status:decision,document:doc.slice(0,170),
    note:note.slice(0,450),reviewedAt:new Date().toISOString()};
   await Promise.resolve(saveState());render();
  }catch(e){
   if(previous)u.sourceReviewV309=previous;else delete u.sourceReviewV309;
   alert('Quellenprüfung konnte nicht gespeichert werden: '+(e.message||e));
  }
 });
 const apply=document.querySelector('[data-v184-apply]');
 if(apply)apply.addEventListener('click',e=>{
  const unresolved=(v184Flow.pkg?.units||[]).filter(u=>
   u.sourceEvidenceV309?.type==='unspecified'||!u.sourceEvidenceV309?.document).length;
  if(unresolved&&!confirm(unresolved+' geplante Stunde(n) haben keine nachprüfbar '+
   'angegebene Quelle. Trotzdem als UNGEPRÜFTE KI-Vorschläge importieren? '+
   'Die Inhalte sind anschließend in der Reihenansicht zur Prüfung markiert.')){
   e.preventDefault();e.stopImmediatePropagation();
  }
 },true);
};
const beforeRender=render;
render=function(){beforeRender();const el=document.querySelector('.brand small');
 if(el)el.textContent=state.settings.schoolYear+' · V0.30.9';};
if(typeof window!=='undefined')window.SchulcockpitPlanSourcesV309={
 core:C,reviewRows
};
})();