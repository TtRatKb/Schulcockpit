/* V0.27.0 – Soll/Ist nach der Stunde und Kompetenzcheck vor der Klassenarbeit.
   Erst bestätigte Unterrichtsnachweise zählen als "gesichert"; Originalplanung bleibt erhalten. */
(function(){
'use strict';
const core=SC_EXAM_COVERAGE_V270;
let active=null,working=false;
function text(v,max=2000){return String(v??'').trim().slice(0,max);}
function realLesson(l){return !!l&&!!l.classId&&!l.groupId&&l.kind!=='group';}
function relevantComps(l){
 const course=cls(l.classId),a=(state.assessments||[]).filter(x=>x.classId===l.classId&&x.date>=l.date&&x.date<=v190AddDays(l.date,80))
   .sort((x,y)=>x.date.localeCompare(y.date))[0];
 const ids=new Set(a?v204SelectedIds(a):[]);
 const q=seq(l.sequenceId);
 const unit=q?.plan?.find(u=>u.id===l.planReference?.unitId);
 for(const id of unit?.competencyIdsV202||[])ids.add(id);
 if(!ids.size&&q)for(const c of v202SequenceCompetencies(q))ids.add(c.id);
 return [...ids].map(id=>v204CurriculumComp(id)).filter(Boolean).slice(0,65);
}
function fileHtml(f){
 return '<span class="v270-evidence-file"><strong>'+esc(f.name)+'</strong> · gespeichert</span>';
}
function actualPanel(l){
 const a=l.actualV270||{},comps=relevantComps(l),covered=new Set(a.coveredIds||[]),secured=new Set(a.securedIds||[]);
 const already=(a.files||[]).map(fileHtml).join(' · ');
 return '<section class="panel v270-actual"><div class="section-head"><div>'+
 '<span class="eyebrow">SOLL / IST · UNTERRICHTSDOKUMENTATION</span><h2>Was haben wir tatsächlich gemacht?</h2>'+
 '<p>Der ursprüngliche Stundenplan bleibt erhalten. Halte nur die Abweichung und die wichtigen Sicherungen fest – auch nachträglich.</p></div>'+
 (a.savedAt?'<span class="safe-chip">Ist-Stand dokumentiert ✓</span>':'')+'</div>'+
 '<div class="v270-grid"><label>Verlauf<select data-v270-mode>'+
 [['asplanned','Wie geplant'],['changed','Andere Inhalte / anderes Material'],['partial','Nur teilweise durchgeführt']].map(([k,v])=>'<option value="'+k+'" '+((a.mode||'changed')===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+
 '<label>Tatsächliches Thema (optional)<input data-v270-title maxlength="160" value="'+esc(a.title||'')+'" placeholder="z. B. Luther und die vier Soli"></label></div>'+
 '<label>Was wurde gemacht?<textarea data-v270-actual rows="3" maxlength="2500" placeholder="z. B. Kahoot; Checker-Tobi-Video zu Luther; vier Soli zuordnen">'+esc(a.summary||'')+'</textarea></label>'+
 '<label>Was wurde wirklich gesichert?<textarea data-v270-securing rows="3" maxlength="1800" placeholder="z. B. Tafelbild mit Kernpunkten; Bedeutung der vier Soli">'+esc(a.securing||'')+'</textarea></label>'+
 '<div class="v270-grid"><label>Video-/Materiallink (optional)<input data-v270-link type="url" value="'+esc(a.link||'')+'" placeholder="https://…"></label>'+
 '<label>Vorher vorgesehenes Material<select data-v270-material>'+
 [['unknown','Noch nicht bewertet'],['used','Verwendet und geeignet'],['unused','Nicht verwendet'],['unsuitable','Ungeeignet / künftig kritisch prüfen']].map(([k,v])=>'<option value="'+k+'" '+((a.materialVerdict||'unknown')===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label></div>'+
 '<label>Ergebnisse, Tafelbild oder neues Arbeitsblatt hinterlegen <input type="file" multiple data-v270-files accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.ppt,.pptx,.txt,.md"></label>'+
 (already?'<p class="v270-evidence-list">Bereits hinterlegt: '+already+'</p>':'')+
 '<details class="v270-competencies"><summary>Kompetenzen bestätigen ('+secured.size+' gesichert)</summary>'+
 '<p>Eine gehaltene Stunde allein beweist keine gesicherte Kompetenz. Wähle deshalb ausdrücklich, was die Klasse tatsächlich bearbeitet und was du gesichert hast.</p>'+
 (comps.length?comps.map(c=>{
   const level=secured.has(c.id)?'secured':covered.has(c.id)?'covered':'open';
   return '<div class="v270-comp"><span>'+esc(c.text)+'<small>'+esc(c.category||c.topicTitle||'Curriculum')+'</small></span>'+
   '<select data-v270-comp="'+esc(c.id)+'">'+[['open','Nicht bestätigt'],['covered','Behandelt'],['secured','Behandelt und gesichert']].map(([v,label])=>
   '<option value="'+v+'" '+(level===v?'selected':'')+'>'+label+'</option>').join('')+'</select></div>';
 }).join(''):'<p class="muted">Hier sind noch keine passenden Curriculum-Kompetenzen zugeordnet. Wähle zuerst die Kompetenzen beim Klassenarbeitstermin oder in der Reihe aus.</p>')+
 '</details><div class="v270-actions"><button type="button" class="primary" data-v270-save="'+esc(l.id)+'">Ist-Unterricht speichern</button><small>Speichern markiert die Stunde als gehalten. Die geplanten Materialien bleiben erhalten.</small></div><p class="v270-status" role="status"></p></section>';
}
const oldDay=v182LessonDayHtml;
v182LessonDayHtml=function(l){
 const html=oldDay(l);
 if(!realLesson(l)||v182IsCanceled(l))return html;
 const i=html.lastIndexOf('</div>');
 return i<0?html+actualPanel(l):html.slice(0,i)+actualPanel(l)+html.slice(i);
};
function examRows(a){
 const c=cls(a.classId),ids=v204SelectedIds(a),year=v190YearFromDate(a.date);
 const seqs=v190PlanningSequences(a.classId,year);
 const units=seqs.flatMap(q=>(q.plan||[]).map(u=>({...u,sequenceId:q.id})));
 const lessons=(state.lessons||[]).filter(l=>l.classId===a.classId&&l.date<a.date).map(l=>({...l,heldV270:v182IsHeld(l)}));
 return {a,c,ids,rows:core.assess(ids,units,lessons,a.date),seqs,lessons};
}
function examPage(){
 const a=(state.assessments||[]).find(x=>x.id===active?.assessmentId);
 if(!a)return '';
 const {c,ids,rows,lessons}=examRows(a),s=core.briefing(rows);
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-xwide v270-modal" data-modal-stop>'+
 '<header class="modal-header"><div><span class="eyebrow">VOR DER KLASSENARBEIT · '+esc(c?.subject||'')+' '+esc(c?.name||'')+'</span>'+
 '<h2>Kompetenz- und Sicherungscheck</h2></div><button class="icon-button" data-action="modal-close">×</button></header>'+
 '<div class="modal-body"><p><strong>'+esc(a.title||'Klassenarbeit')+'</strong> · '+esc(fmtDate(a.date))+
 '. Grundlage ist deine bestehende Kompetenzwahl aus dem Hauscurriculum. Die Zuordnung zu Sollstunden ist keine Bestätigung des Ist-Unterrichts.</p>'+
 '<div class="v270-tally"><span>'+s.counts.secured+' gesichert</span><span>'+s.counts.covered+' behandelt</span>'+
 '<span>'+s.counts.planned+' geplant</span><span>'+s.counts.unconfirmed+' ungeprüft</span>'+
 '<span>'+s.counts.missing+' ohne Zuordnung</span></div>'+
 (!a.competencySelectionV204?.confirmed?'<p class="warnbox">Die Prüfungs-Kompetenzen sind noch nicht ausdrücklich bestätigt. Bitte unter „Bearbeiten“ die Auswahl aus dem Curriculum prüfen.</p>':'')+
 '<p>„Gesichert“ bedeutet hier nur, dass du es für eine Ist-Stunde ausdrücklich bestätigt hast – nicht, dass alle Kinder es beherrschen. Prüfe diese Übersicht vor der Aufgabenerstellung und nach den letzten Stunden erneut.</p>'+
 (rows.length?'<div class="v270-checklist">'+rows.map(r=>{
  const comp=v204CurriculumComp(r.id),e=r.evidence||[];
  return '<article><div><strong>'+esc(comp?.text||r.id)+'</strong><small>'+esc(comp?.category||comp?.topicTitle||'')+
   (r.plannedDates.length?' · Soll: '+r.plannedDates.map(fmtDate).join(', '):'')+'</small>'+
   (e.length?'<small>Ist-Eintrag: '+e.map(x=>fmtDate(x.date)+(x.actualV270?.title?' · '+x.actualV270.title:'')).join('; ')+'</small>':'')+
   '</div><span class="v270-state v270-'+r.status+'">'+core.statusLabel(r.status)+'</span></article>';
 }).join('')+'</div>':'<p class="warnbox">Noch keine Prüfungs-Kompetenzen ausgewählt. Bitte den Klassenarbeitstermin bearbeiten.</p>')+
 '<details><summary>Unterrichtsstunden vor der Arbeit prüfen ('+lessons.length+')</summary>'+
 (lessons.slice().sort((x,y)=>x.date.localeCompare(y.date)).map(l=>
  '<div class="v270-lesson-link"><strong>'+esc(fmtDate(l.date))+' · '+esc(l.actualV270?.title||l.title||'Stunde')+'</strong>'+
  '<small>'+(l.actualV270?.savedAt?'Ist-Dokumentation vorhanden':v182IsHeld(l)?'Gehalten, Ist-Inhalte nicht dokumentiert':'Noch offen / nur Soll')+'</small>'+
  '<button type="button" class="secondary" data-v270-lesson="'+esc(l.id)+'">Stunde öffnen</button></div>'
 ).join('')||'<p>Keine Stunden gespeichert.</p>')+'</details>'+
 '<div class="v270-actions"><button class="secondary" data-v270-edit-exam="'+esc(a.id)+'">Prüfungs-Kompetenzen bearbeiten</button>'+
 '<button class="primary" data-v270-create-exam="'+esc(a.id)+'">Klassenarbeit erstellen</button></div></div></section></div>';
}
function readLink(input){
 if(!input)return '';
 const s=text(input,600);
 const u=new URL(s);if(!['https:','http:'].includes(u.protocol))throw Error('Bitte nur https:// oder http:// für Materiallinks verwenden.');
 return u.href;
}
async function saveActual(lid){
 if(working)return;const l=lesson(lid);if(!realLesson(l))throw Error('Stunde nicht gefunden.');
 working=true;
 const button=document.querySelector('[data-v270-save]'),status=document.querySelector('.v270-status');
 if(button)button.disabled=true;
 const prev=l.actualV270?structuredClone(l.actualV270):null,prevStatus=l.status,keys=[];
 try{
  const files=[...document.querySelector('[data-v270-files]')?.files||[]];
  if(files.length>12||files.some(f=>f.size>25*1024*1024))throw Error('Bitte maximal 12 Dateien zu je 25 MB auswählen.');
  const old=l.actualV270||{};
  const next={...old,mode:document.querySelector('[data-v270-mode]').value,
    title:text(document.querySelector('[data-v270-title]').value,160),
    summary:text(document.querySelector('[data-v270-actual]').value,2500),
    securing:text(document.querySelector('[data-v270-securing]').value,1800),
    materialVerdict:document.querySelector('[data-v270-material]').value,
    link:readLink(document.querySelector('[data-v270-link]').value),
    coveredIds:[],securedIds:[],files:[...(old.files||[])],
    savedAt:new Date().toISOString()};
  document.querySelectorAll('[data-v270-comp]').forEach(el=>{
   if(el.value==='covered')next.coveredIds.push(el.dataset.v270Comp);
   if(el.value==='secured')next.securedIds.push(el.dataset.v270Comp);
  });
  for(const f of files){
   const key='lesson-actual-v270-'+l.id+'-'+uid('f');
   await fileStorePut(key,f);keys.push(key);
   next.files.push({name:f.name,fileKey:key,size:f.size,type:f.type});
   storedFileKeys.add(key);
  }
  l.actualV270=next;l.status='done';
  await saveState();render();
 }catch(e){
  if(prev)l.actualV270=prev;else delete l.actualV270;
  l.status=prevStatus;
  for(const key of keys){try{await fileStoreDelete(key);}catch{}storedFileKeys.delete(key);}
  if(status)status.textContent='Fehler: '+(e.message||e);
  throw e;
 }finally{working=false;if(button)button.disabled=false;}
}
const beforePanel=v190AssessmentPanelYear;
v190AssessmentPanelYear=function(y){
 const h=beforePanel(y);
 return h.replace(/(<button class="primary" data-v269-open="([^"]+)">Klassenarbeit erstellen<\/button>)/g,
  (_m,button,id)=>'<button class="secondary" data-v270-exam="'+esc(id)+'">Kompetenzcheck</button>'+button);
};
const beforeAll=v188AssessmentPanel;
v188AssessmentPanel=function(){
 const h=beforeAll();
 return h.replace(/(<button class="primary" data-v269-open="([^"]+)">Klassenarbeit erstellen<\/button>)/g,
  (_m,button,id)=>'<button class="secondary" data-v270-exam="'+esc(id)+'">Kompetenzcheck</button>'+button);
};
const previousModal=modalHtml;
modalHtml=function(){return modal?.type==='v270ExamCheck'?examPage():previousModal();};
// Die bisherige Curriculum-Anzeige darf eine ausdrücklich ersetzte/gekürzte
// Stunde nicht mehr allein aufgrund von "gehalten" als planmäßig erledigt zählen.
const oldUnitHeld=v202UnitHeld;
v202UnitHeld=function(q,u){
 const hasDeviation=(state.lessons||[]).some(l=>v182IsHeld(l)&&
  (l.planReference?.unitId===u.id||
   l.sequenceId===q.id&&v202Norm(l.title)===v202Norm(u.title))&&
  l.actualV270?.savedAt&&l.actualV270.mode!=='asplanned');
 if(!hasDeviation)return oldUnitHeld(q,u);
 return (state.lessons||[]).some(l=>v182IsHeld(l)&&
  (l.planReference?.unitId===u.id||
   l.sequenceId===q.id&&v202Norm(l.title)===v202Norm(u.title))&&
  (!l.actualV270?.savedAt||l.actualV270.mode==='asplanned'));
};
const originalPrompt=SC_EXAM_BRIEF_V269.makePrompt;
SC_EXAM_BRIEF_V269.makePrompt=function(input){
 let out=originalPrompt(input);
 const a=(state.assessments||[]).find(x=>x.id===input.exam?.id);
 if(!a)return out;
 const {rows}=examRows(a);
 out+='\n\n## Prüfungsrelevante Kompetenzen – verbindliche Ist-Prüfung\n';
 for(const row of rows){
  const c=v204CurriculumComp(row.id);
  out+='- ['+core.statusLabel(row.status)+'] '+(c?.text||row.id)+'\n';
 }
 out+='Diese Liste ist kein Nachweis des Lernstands. Nicht gesicherte oder ungeprüfte Kompetenzen NICHT ohne ausdrückliche Bestätigung als bereits vermittelt behandeln. Schlage ggf. gezielte Sicherung oder einen kleineren Prüfungsumfang vor.\n';
 for(const unit of input.selected||[]){
  const matches=(state.lessons||[]).filter(l=>l.classId===a.classId&&l.date<a.date&&
   ((unit.unitId&&l.planReference?.unitId===unit.unitId)||(unit.key==='l:'+l.id)));
  for(const l of matches){
   const actual=l.actualV270;
   if(!actual?.savedAt)continue;
   out+='\nIST-STUNDE '+l.date+' – ABWEICHUNG VOM SOLL: '+(actual.mode||'')+
    '\nTatsächliches Thema: '+(actual.title||'nicht extra benannt')+
    '\nTatsächlicher Verlauf: '+(actual.summary||'nicht eingetragen')+
    '\nSicherung: '+(actual.securing||'nicht dokumentiert')+
    '\nLink: '+(actual.link||'kein Link')+
    '\nVorheriges Material: '+(actual.materialVerdict||'unbewertet')+'.\n';
  }
 }
 return out;
};
const oldConcrete=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
 const out=oldConcrete(l);
 const flagged=(state.lessons||[]).filter(x=>x.classId===l?.classId&&
   x.actualV270?.materialVerdict==='unsuitable'&&x.date<=l.date).slice(-8);
 const warning=flagged.length?'\nBereits als problematisch markierte Materialien in diesem Fachkurs (keine automatische Wiederverwendung):\n'+
   flagged.map(x=>'- '+x.date+' · '+(x.title||'Unterrichtsstunde')+
     ' · '+(x.planReference?.material||'Materialbezug nicht dokumentiert')+
     ' · tatsächlicher Verlauf: '+(x.actualV270?.summary||'nicht beschrieben')).join('\n')+'\n':'';
 return out+'\n\n## Verbindlicher Material-Qualitätscheck vor dem Stundenimport\nPrüfe alle ausgewählten Arbeitsblätter inhaltlich und didaktisch, nicht nur ihre Dateinamen. Quelle aus „Zusatzmaterial“, „Ergänzungen“ oder ähnlichen Ordnern ist KEIN automatischer Favorit. Prüfe explizit, ob jeder Arbeitsauftrag anhand des vorhandenen Stoffs und der mitgelieferten Texte lösbar ist, ob die Textmenge altersangemessen ist und ob Materialien überhaupt zum Stundenziel passen. Wenn dir Originaldateien oder relevante Vorkenntnisse fehlen, kennzeichne die Unsicherheit und frage nach, statt eine geeignete Arbeitsgrundlage vorzutäuschen. Ungeeignete Materialien nicht auswählen; schlage eine kurze Alternative vor.\n'+warning;
};
makeBrief=concretePlanningPromptV12;
const prevWire=wire;
wire=function(){
 prevWire();
 document.querySelector('[data-v270-save]')?.addEventListener('click',e=>void saveActual(e.currentTarget.dataset.v270Save).catch(err=>alert(err.message||err)));
 document.querySelectorAll('[data-v270-exam]').forEach(b=>b.addEventListener('click',()=>{
  active={assessmentId:b.dataset.v270Exam};modal={type:'v270ExamCheck'};render();
 }));
 document.querySelectorAll('[data-v270-lesson]').forEach(b=>b.addEventListener('click',()=>{
  const l=lesson(b.dataset.v270Lesson);if(!l)return;
  modal=null;v182LessonId=l.id;view='lessonDayV182';render();
 }));
 document.querySelector('[data-v270-edit-exam]')?.addEventListener('click',e=>v188OpenAssessment(e.currentTarget.dataset.v270EditExam));
 document.querySelector('[data-v270-create-exam]')?.addEventListener('click',e=>SchulcockpitExamBriefV269.open(e.currentTarget.dataset.v270CreateExam));
};
window.SchulcockpitActualV270={examRows,actualPanel};
})();