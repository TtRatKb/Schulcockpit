/* Schulcockpit V0.26.3 – Soll-Themen nur nach Vorschau nachrücken lassen. */
(function(){
'use strict';
let chosenYear='',chosenCourse='all',preview=null;
const MAX_ROWS=100;

function year(){return v190NormYear(chosenYear||(view==='school-calendar'?v190CalendarDraft?.year:'')||state.settings.schoolYear);}
function courses(y){return (state.classes||[]).filter(c=>
  v190PlanningSequences(c.id,y).some(q=>(q.plan||[]).some(u=>!v201UnitSkipped(u))) &&
  (state.timetable||[]).some(t=>t.classId===c.id&&!(t.kind==='group'||t.groupId)));
}
function courseLabel(cid){const c=(state.classes||[]).find(x=>x.id===cid);return [c?.subject,c?.name].filter(Boolean).join(' · ')||cid;}
function fingerprint(){return JSON.stringify([
  state.sequences,state.lessons,state.schoolCalendarsV190,state.timetable,
  state.assessments,state.classes,state.settings?.schoolYear
]);}
function indexUnits(list){const map=new Map();for(const q of list||[])for(const u of q.plan||[])
  map.set(q.id+'|'+u.id,{...u,courseId:q.classId,sequence:q.title});return map;}

// Der vorhandene Fachterminierer arbeitet auf einer isolierten Kopie. Auch der
// Kalender wird kopiert, denn dessen Getter kann fehlende Jahre initialisieren.
// Vergangene Fachtermine werden während dieser Rechnung nie erneut belegt.

// Fachstunden im Montagsmodus tragen oft eine ältere automatisch erzeugte
// Themenverknüpfung. Diese bei einer bestätigten Neuverteilung aktualisieren,
// ohne echte Ausarbeitungen, Ist-Verlauf oder manuell verschobene Stunden anzufassen.
function reconcileWeek(shadow,selected,y,today){
  const selectedIds=new Set(selected.map(c=>c.id));
  const prepared=l=>v191LessonProtected(l)||!!l.v180MovedFrom||
    !!l.executionV180?.mode||l.source==='manual';
  const byDate=new Map();
  for(const q of shadow.sequences||[])if(selectedIds.has(q.classId)&&v190NormYear(q.schoolYearV190||y)===y)
    for(const u of q.plan||[])if(u.plannedDate&&!v201UnitSkipped(u)){
      const key=q.classId+'|'+u.plannedDate;
      if(!byDate.has(key))byDate.set(key,{q,u});
    }
  for(const l of shadow.lessons||[]){
    if(!selectedIds.has(l.classId)||l.date<today||prepared(l))continue;
    const originalAuto=!!l.planReference?.autoMatched;
    const placeholder=!l.planReference&&(!l.title||l.title==='Thema noch festlegen');
    if(!originalAuto&&!placeholder)continue;
    const found=byDate.get(l.classId+'|'+l.date);
    if(!found){
      if(originalAuto){
        l.planReference=null;l.sequenceId='';l.unit='';
        l.title='Thema noch festlegen';l.objective='';
      }
      continue;
    }
    const {q,u}=found;
    l.sequenceId=q.id;l.unit=q.title;l.title=u.title||'Thema noch festlegen';
    l.objective=u.objective||'';
    l.planReference={plannedDate:u.plannedDate,title:u.title,content:u.content,
      objective:u.objective,material:u.material,notes:u.notes,unitId:u.id,autoMatched:true};
  }
  // Falls ein Vertretungstag bisher als unterrichtsfrei galt, wurde seine
  // Fachstunde möglicherweise noch gar nicht in der aktiven Woche erzeugt.
  if(typeof activeWeekDate!=='function')return;
  for(const t of shadow.timetable||[]){
    if(!selectedIds.has(t.classId)||t.kind==='group'||t.groupId)continue;
    const date=activeWeekDate(Number(t.weekday));
    if(date<today||v190YearFromDate(date)!==y||v190NoSchoolInfo(date,t.classId))continue;
    const found=byDate.get(t.classId+'|'+date);
    if(!found)continue;
    if(shadow.lessons.some(l=>l.date===date&&l.classId===t.classId&&
       (l.timetableId===t.id||Number(lessonSlot(l))===Number(t.slot))))continue;
    const {q,u}=found;
    shadow.lessons.push({
      id:uid('lesson'),classId:t.classId,date,slot:t.slot,period:t.period,
      timetableId:t.id,source:'timetable',kind:'course',sequenceId:q.id,unit:q.title,
      title:u.title||'Thema noch festlegen',objective:u.objective||'',status:'open',
      plannedSteps:[],completedSteps:[],phasePlan:[],slides:[],prepTasks:[],
      materials:[],printPlan:[],planReference:{plannedDate:u.plannedDate,
      title:u.title,content:u.content,objective:u.objective,material:u.material,
      notes:u.notes,unitId:u.id,autoMatched:true}
    });
  }
}

function calculate(y=year(),cid=chosenCourse){
  const initial=fingerprint(),original=state,originalSlots=v190CourseSlots;
  const today=iso(new Date()),eligible=courses(y),selected=eligible.filter(c=>cid==='all'||c.id===cid);
  const shadow={...state,sequences:structuredClone(state.sequences||[]),lessons:structuredClone(state.lessons||[]),
    schoolCalendarsV190:structuredClone(state.schoolCalendarsV190||{})};
  const feedback=[];
  try{
    state=shadow;
    v190CourseSlots=function(courseId,schoolYear){
      return originalSlots(courseId,schoolYear).filter(slot=>slot.date>=today);
    };
    for(const c of selected){
      const result=v190RescheduleCourseYear(c.id,y,true);
      if(result.warning)feedback.push(courseLabel(c.id)+': '+result.warning);
    }
    reconcileWeek(shadow,selected,y,today);
  }finally{
    v190CourseSlots=originalSlots;
    state=original;
  }
  if(fingerprint()!==initial)throw Error('Die Vorschau hat unerwartet Originaldaten verändert. Es wurde nichts übernommen.');
  const old=indexUnits(original.sequences),next=indexUnits(shadow.sequences);
  const changes=[];
  for(const [key,u] of old){
    const n=next.get(key);
    if(!n||u.plannedDate===n.plannedDate)continue;
    if(u.plannedDate&&u.plannedDate<today)throw Error('Ein bereits vergangener Soll-Termin würde verändert. Abbruch.');
    changes.push({key,courseId:u.courseId,sequence:u.sequence,title:u.title||'Ohne Titel',before:u.plannedDate||'',after:n.plannedDate||''});
  }
  // Gehaltene, ausgearbeitete und bewusst manuell verschobene Stunden sind tabu.
  const afterLessons=new Map(shadow.lessons.map(l=>[l.id,l]));
  for(const l of original.lessons||[]){
    if(l.date>=today&&!v191LessonProtected(l)&&!l.v180MovedFrom)continue;
    if(JSON.stringify(l)!==JSON.stringify(afterLessons.get(l.id)))
      throw Error('Eine vergangene, bereits ausgearbeitete oder manuell verschobene Stunde würde verändert. Abbruch.');
  }
  const lessonChanges=shadow.lessons.filter(l=>{const prev=(original.lessons||[]).find(x=>x.id===l.id);return !prev||JSON.stringify(prev)!==JSON.stringify(l);}).length;
  changes.sort((a,b)=>a.courseId.localeCompare(b.courseId)||a.before.localeCompare(b.before)||a.after.localeCompare(b.after));
  return {y,cid,today,changes,lessonChanges,feedback,eligible:selected.length,original:initial,
    sequences:shadow.sequences,lessons:shadow.lessons};
}

function panel(){return '<section class="panel v263-panel"><div class="section-head"><div><span class="eyebrow">NACH KALENDERÄNDERUNGEN</span><h2>Themen nachrücken lassen</h2></div>'+ 
  '<button class="primary" type="button" data-v263-open>Verschiebungen prüfen →</button></div>'+ 
  '<p>Wenn durch SchILF oder eine andere Vertretung wieder Fachstunden verfügbar sind, kannst du offene Soll-Themen neu verteilen. Du siehst vorher genau, was sich ändern würde. Gehaltene und fertig vorbereitete Stunden bleiben erhalten.</p></section>';}
function previewPage(){
  const y=year(),available=courses(y),p=preview;
  const options='<option value="all" '+(chosenCourse==='all'?'selected':'')+'>Alle Kurse</option>'+available.map(c=>
    '<option value="'+esc(c.id)+'" '+(chosenCourse===c.id?'selected':'')+'>'+esc(courseLabel(c.id))+'</option>').join('');
  return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide v263-modal" data-modal-stop>'+ 
    '<header class="modal-header"><div><span class="eyebrow">REIHENPLANUNG · '+esc(y)+'</span><h2>Themen nachrücken</h2></div>'+ 
    '<button type="button" class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">'+
    '<p>Die Berechnung beginnt frühestens heute. Vergangene Termine, bereits gehaltene oder konkret vorbereitete Stunden und feste Leistungsnachweise bleiben geschützt. Auch bei einer SchILF bleibt die Fachstunde im Plan.</p>'+ 
    '<label>Welche Kurse sollen neu terminiert werden?<select id="v263-course">'+options+'</select></label>'+ 
    (!available.length?'<p class="v263-warning">Für dieses Schuljahr wurden keine Kurse mit Soll-Themen und gültigem Stundenplan gefunden.</p>':'')+
    (p?'<div class="v263-summary"><strong>'+p.changes.length+' Soll-Termin'+(p.changes.length===1?'':'e')+' würden verändert</strong><span> · '+p.lessonChanges+' Wochenstunden aktualisiert/ergänzt</span><span> · '+p.eligible+' Kurs'+(p.eligible===1?'':'e')+' geprüft</span></div>'+ 
      (p.changes.length?'<div class="v263-movements"><table><thead><tr><th>Kurs / Thema</th><th>Bisher</th><th>Neu</th></tr></thead><tbody>'+ 
        p.changes.slice(0,MAX_ROWS).map(m=>'<tr><td><strong>'+esc(courseLabel(m.courseId))+'</strong><small>'+esc(m.sequence)+' · '+esc(m.title)+'</small></td>'+ 
          '<td>'+esc(m.before?fmtDate(m.before):'Ohne Termin')+'</td><td>'+esc(m.after?fmtDate(m.after):'Ohne Termin')+'</td></tr>').join('')+'</tbody></table></div>':
        '<p>Aktuell müssen keine noch offenen Soll-Termine verschoben werden.</p>')+
      (p.changes.length>MAX_ROWS?'<p class="v263-warning">Es werden die ersten '+MAX_ROWS+' Änderungen angezeigt. Insgesamt sind '+p.changes.length+' betroffen. Bitte gegebenenfalls einzelne Kurse wählen.</p>':'')+
      p.feedback.map(w=>'<p class="v263-warning">'+esc(w)+'</p>').join(''):'<p>Noch keine Vorschau berechnet.</p>')+
    '<div class="v263-actions"><button class="secondary" type="button" data-action="modal-close">Abbrechen</button>'+ 
      '<button class="secondary" type="button" data-v263-refresh>Vorschau aktualisieren</button>'+ 
      '<button class="primary" type="button" data-v263-apply '+(!p||(p.changes.length===0&&!p.lessonChanges)||p.changes.length>MAX_ROWS?'disabled':'')+'>Änderungen übernehmen</button></div>'+ 
    '<p class="microcopy">Erst mit „Änderungen übernehmen“ werden die neuen Soll-Termine lokal gespeichert. Es werden keine Unterrichtsmaterialien gelöscht.</p>'+ 
    '</div></section></div>';
}
function open(){chosenYear=v190NormYear((view==='school-calendar'?v190CalendarDraft?.year:'')||state.settings.schoolYear);chosenCourse='all';
  try{preview=calculate();modal={type:'rescheduleV263'};render();}
  catch(e){alert('Nachrücken: '+(e.message||e));}
}
function update(){try{preview=calculate();render();}catch(e){preview=null;alert('Nachrücken: '+(e.message||e));render();}}
async function apply(){
  if(!preview||(!preview.changes.length&&!preview.lessonChanges)||preview.changes.length>MAX_ROWS)return;
  if(fingerprint()!==preview.original){alert('Die Planungsdaten haben sich seit der Vorschau geändert. Bitte zuerst neu berechnen.');update();return;}
  const beforeSequences=state.sequences,beforeLessons=state.lessons;
  try{
    state.sequences=preview.sequences;state.lessons=preview.lessons;
    await saveState();
    const count=preview.changes.length,previewLessonCount=preview.lessonChanges;
    preview=null;modal=null;render();
    alert(count+' Soll-Termin'+(count===1?' wurde':'e wurden')+' aktualisiert; '+previewLessonCount+' Wochenstunden abgeglichen.');
  }catch(e){state.sequences=beforeSequences;state.lessons=beforeLessons;alert('Änderungen konnten nicht gespeichert werden: '+(e.message||e));render();}
}
const priorView=viewHtml;
viewHtml=function(){const html=priorView();return view==='school-calendar'||view==='substitution-v262'?html+panel():html;};
const priorModal=modalHtml;
modalHtml=function(){return modal?.type==='rescheduleV263'?previewPage():priorModal();};
const priorWire=wire;
wire=function(){
  priorWire();
  // Der alte Kalenderknopf speicherte sofort ALLE Termine. Listener sicher entfernen.
  document.querySelectorAll('[data-v190-calendar-recalc]').forEach(b=>{const replacement=b.cloneNode(true);
    replacement.textContent='Themen nachrücken · Vorschau';b.replaceWith(replacement);replacement.addEventListener('click',open);});
  document.querySelectorAll('[data-v263-open]').forEach(b=>b.addEventListener('click',open));
  if(modal?.type!=='rescheduleV263')return;
  document.getElementById('v263-course')?.addEventListener('change',e=>{chosenCourse=e.target.value;update();});
  document.querySelector('[data-v263-refresh]')?.addEventListener('click',update);
  document.querySelector('[data-v263-apply]')?.addEventListener('click',apply);
};
const priorRender=render;
render=function(){priorRender();const version=document.querySelector('.brand small');if(version)version.textContent=state.settings.schoolYear+' · V0.26.3';};
window.SchulcockpitNachrueckenV263={calculate,open,apply};
})();
