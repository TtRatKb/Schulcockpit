/* Schulcockpit V0.28.9 – canonical weekly lesson type and per-course excursion.
 * Makes assessment/substitution/excursion visible in all existing weekly views.
 * Never changes held lessons, full lesson plans or source sequence dates.
 */
(function(){
'use strict';
const CORE=SC_LESSON_CONTEXT_V289;
const relevant=new Set(['focus','prep','week','tasks','improve','lessonDayV182']);
function liveRange(r){return r?.impactV262==='substitution'&&
 (state.schoolCalendarsV190?.[v190YearFromDate(r.start)]?.customRanges||[]).some(x=>x.id===r.id)||
 r?.impactV262==='substitution'&&
 (state.schoolCalendarsV190?.[v190YearFromDate(r.start)]?.imports||[]).some(x=>x.id===r.id);}
function rangesFor(date){
 const y=v190YearFromDate(date),cal=v190Calendar(y);
 return [...(cal.customRanges||[]),...(cal.imports||[])];
}
function participating(date,cid){
 return rangesFor(date).some(r=>CORE.included(r,date)&&
  r.impactV262==='substitution'&&(r.attendingClassIdsV289||[]).includes(cid));
}
const originalSlots=v190CourseSlots;
v190CourseSlots=function(cid,year=v190PlanningYear()){
 return originalSlots(cid,year).filter(s=>!participating(s.date,cid));
};
function context(l){
 if(!l||!l.classId||!l.date||l.kind==='group'||l.groupId)return {type:'group'};
 const date=l.date,year=v190YearFromDate(date),units=[];
 for(const q of v190PlanningSequences(l.classId,year))
  for(const unit of q.plan||[])if(!v201UnitSkipped(unit))
   units.push({classId:l.classId,sequenceId:q.id,sequenceTitle:q.title,unit});
 return CORE.classify({date,classId:l.classId,
  assessments:state.assessments||[],calendar:rangesFor(date),
  courseRanges:v261CourseRanges(year,l.classId),units});
}
function sync(){
 if(!v186Ready||!relevant.has(view))return;
 // V0.28.8 adds genuinely missing timetable cards before we resolve their
 // curriculum topic or special session type.
 window.SchulcockpitWeekfillV288?.fill();
 const monday=iso(activeMonday()),end=activeWeekEnd(),today=iso(new Date());
 let modified=false;
 for(const l of state.lessons||[]){
  if(!l?.classId||!l.date||l.date<monday||l.date>end||l.date<today||
   v182IsHeld(l)||v182IsCanceled(l))continue;
  const x=context(l);if(x.type==='group')continue;
  const replace=CORE.canReplaceTitle(l);
  if(replace&&l.title!==x.title){
   l.title=x.title;l.v289AutoTitle=x.title;modified=true;
  }
  if(x.unit&&(!l.planReference||l.planReference?.autoMatched)&&
   (!l.planReference||l.planReference.unitId!==x.unit.id)){
   // Only adjust incomplete or auto-associated lesson cards; a deliberately
   // authored phase plan, paper or PPT must never be replaced.
   if(!concretePlanReadyV12(l)){
    const u=x.unit;
    l.planReference={plannedDate:u.plannedDate,title:u.title,content:u.content,
     objective:u.objective,material:u.material,notes:u.notes,unitId:u.id,autoMatched:true};
    l.sequenceId=u.sequenceId;l.unit=u.sequenceTitle;
    if(!l.objective&&u.objective)l.objective=u.objective;
    modified=true;
   }
  }
  if(x.type==='exam'&&l.assessmentId!==x.exam.id){
   l.assessmentId=x.exam.id;modified=true;
  }
 }
 if(modified)Promise.resolve(saveState()).catch(err=>console.error('Stundentyp-Zuordnung nicht gespeichert',err));
}
function examModal(l,x){
 const a=x.exam,info=a.preparationV289||{},c=cls(l.classId);
 const fileCount=(a.files||[]).length,returned=!!a.correctionV203?.returnedAt;
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide v289-special-modal" data-modal-stop>'+
 '<header class="modal-header"><div><span class="eyebrow">FESTER LEISTUNGSNACHWEIS · '+esc(fmtDate(l.date))+'</span>'+
 '<h2>'+esc((c?.subject||'')+' '+(c?.name||'')+' · '+(a.title||'Klassenarbeit'))+'</h2>'+
 '<p>Keine normale Unterrichtsplanung oder PowerPoint notwendig.</p></div>'+
 '<button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">'+
 '<div class="v289-checklist">'+
 '<label><input type="checkbox" data-v289-exam-check="prepared" '+(info.prepared?'checked':'')+'> Klassenarbeit vorbereitet</label>'+
 '<label><input type="checkbox" data-v289-exam-check="classtimeUploaded" '+(info.classtimeUploaded?'checked':'')+'> In Classtime hochgeladen / eingerichtet</label>'+
 '<label><input type="checkbox" data-v289-exam-check="copiesReady" '+(info.copiesReady?'checked':'')+'> Ausdrucke oder Geräte vorbereitet</label>'+
 '</div><p class="microcopy">'+fileCount+' Prüfungsdatei'+(fileCount===1?'':'en')+
 ' lokal hinterlegt · '+(returned?'Bereits zurückgegeben':'Rückgabe noch nicht dokumentiert')+
 '. Die Häkchen sind deine eigene Vorbereitungsliste, keine automatische Classtime-Verbindung.</p>'+
 '<div class="v289-special-actions"><button class="primary" data-v289-exam-edit="'+esc(a.id)+'">Klassenarbeit vorbereiten / Dateien</button>'+
 '<button class="secondary" data-v289-exam-eval="'+esc(a.id)+'">Auswertung & Rückgabe</button>'+
 '<button class="secondary" data-v289-exam-status="'+esc(a.id)+'">Korrekturstatus</button></div>'+
 '</div></section></div>';
}
function excursionModal(l,x){
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal v289-special-modal" data-modal-stop>'+
 '<header class="modal-header"><div><span class="eyebrow">AUSSERSCHULISCHER LERNORT</span>'+
 '<h2>'+esc(x.event?.name||'Ausflug')+'</h2><p>'+esc((cls(l.classId)?.subject||'')+
 ' '+(cls(l.classId)?.name||'')+' · '+fmtDate(l.date))+'</p></div>'+
 '<button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">'+
 '<p>Diese Lerngruppe nimmt an deinem Termin teil. Es wird <strong>kein Vertretungsmaterial</strong> und keine normale Unterrichts-PowerPoint benötigt.</p>'+
 '<button class="secondary" data-v289-go-calendar>Im Schulkalender bearbeiten</button></div></section></div>';
}
const oldModal=modalHtml;
modalHtml=function(){
 if(modal?.type==='lesson'){
  const l=lesson(modal.id),x=context(l);
  if(x.type==='exam')return examModal(l,x);
  if(x.type==='excursion')return excursionModal(l,x);
 }
 return oldModal();
};
function openRelevant(l){
 const x=context(l);
 if(x.type==='substitution'){
  const opened=window.SchulcockpitSubstitutionV262?.open?.(l.date,l.classId,lessonSlot(l));
  if(opened)return;
 }
 modal={type:'lesson',id:l.id};render();
}
const oldWire=wire;
wire=function(){
 oldWire();
 document.querySelectorAll('[data-lesson]').forEach(el=>{
  const l=lesson(el.dataset.lesson);if(!l)return;
  if(!['exam','substitution','excursion'].includes(context(l).type))return;
  el.onclick=e=>{e.preventDefault();e.stopPropagation();openRelevant(l);};
 });
 document.querySelectorAll('[data-v182-open]').forEach(el=>{
  const l=lesson(el.dataset.v182Open);if(!l||!['exam','substitution','excursion'].includes(context(l).type))return;
  el.onclick=e=>{e.preventDefault();e.stopPropagation();openRelevant(l);};
 });
 if(modal?.type==='lesson'){
  document.querySelectorAll('[data-v289-exam-check]').forEach(el=>el.onchange=async()=>{
   const l=lesson(modal.id),a=context(l).exam;if(!a)return;
   const prev=structuredClone(a.preparationV289||{});
   a.preparationV289={...prev,[el.dataset.v289ExamCheck]:el.checked};
   try{await saveState();render();}catch(err){a.preparationV289=prev;alert('Prüfungsvorbereitung konnte nicht gespeichert werden.');render();}
  });
  document.querySelector('[data-v289-exam-edit]')?.addEventListener('click',e=>v188OpenAssessment(e.currentTarget.dataset.v289ExamEdit));
  document.querySelector('[data-v289-exam-eval]')?.addEventListener('click',e=>v200OpenEval(e.currentTarget.dataset.v289ExamEval));
  document.querySelector('[data-v289-exam-status]')?.addEventListener('click',e=>{
   const id=e.currentTarget.dataset.v289ExamStatus;
   const a=state.assessments?.find(x=>x.id===id);if(!a)return;
   v203Workflow(a,true);modal={type:'assessmentProgressV203',id};saveState();render();
  });
  document.querySelector('[data-v289-go-calendar]')?.addEventListener('click',()=>{modal=null;view='school-calendar';render();});
 }
 // Calendar-specific selection of the class attending the trip instead
 // of requiring supervision. Defaults remain substitution for other courses.
 if(view==='school-calendar')for(const select of document.querySelectorAll('[data-v262-range-impact]')){
  const year=v190NormYear(v190CalendarDraft?.year||state.settings.schoolYear),cal=v190Calendar(year);
  const entry=[...(cal.customRanges||[]),...(cal.imports||[])].find(x=>x.id===select.dataset.v262RangeImpact);
  if(!entry||entry.impactV262!=='substitution')continue;
  const row=select.closest('.v190-range-row');
  if(!row||row.querySelector('.v289-attending'))continue;
  const options=(state.timetable||[]).filter(t=>t.classId).filter(t=>{
   for(let d=entry.start;d<=entry.end;d=v190AddDays(d,1)){
    if((new Date(d+'T12:00:00').getDay()||7)===Number(t.weekday))return true;
    if(d>=entry.end)break;
   }
   return false;
  });
  const unique=[...new Set(options.map(t=>t.classId))];
  if(!unique.length)continue;
  const details=document.createElement('details');
  details.className='v289-attending';
  const summary=document.createElement('summary');
  summary.textContent='Welche Klasse ist mit mir unterwegs? · '+(entry.attendingClassIdsV289||[]).length+' ausgewählt';
  details.append(summary);
  const info=document.createElement('p');
  info.textContent='Mitfahrende Klassen brauchen keine Vertretung. Für alle anderen betroffenen Stunden gilt weiterhin „Vertretung nötig“.';
  details.append(info);
  for(const id of unique){
   const c=cls(id),label=document.createElement('label'),checkbox=document.createElement('input');
   checkbox.type='checkbox';checkbox.checked=(entry.attendingClassIdsV289||[]).includes(id);
   label.append(checkbox,document.createTextNode(' '+(c?.subject||'')+' '+(c?.name||'')));
   checkbox.onchange=async()=>{
    const prev=[...(entry.attendingClassIdsV289||[])];
    entry.attendingClassIdsV289=checkbox.checked?[...new Set([...prev,id])]:prev.filter(x=>x!==id);
    try{await saveState();render();}
    catch(err){entry.attendingClassIdsV289=prev;alert('Mitfahrende Klasse konnte nicht gespeichert werden.');render();}
   };
   details.append(label);
  }
  row.append(details);
 }
};
const priorRender=render;
render=function(){
 sync();
 priorRender();
 const badge=document.querySelector('.brand small');
 if(badge)badge.textContent=state.settings.schoolYear+' · V0.28.9';
};
window.SchulcockpitLessonContextV289={context,participating,sync};
})();