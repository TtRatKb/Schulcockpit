/* Schulcockpit V0.27.2 – targeted move from any planned lesson (also older KW)
 * to a chosen future course lesson. Preview before save; no blanket replan.
 * Existing past/held/prepared lessons, exam dates and their data stay intact. */
(function(){
'use strict';
const core=SC_LESSON_SWITCH_V272;
let draft=null,busy=false;
const today=()=>iso(new Date());
const sameSlot=(l,s)=>l.date===s.date&&
 (s.timetableId&&l.timetableId===s.timetableId||
  Number(lessonSlot(l))===Number(s.slot));
const courseLabel=cid=>{const c=cls(cid);return [c?.subject||'Fach',c?.name||''].join(' · ').trim();};
const identity=(q,u)=>core.key(q.id,u.id);
function isGuarded(l){
 return !!l&&(v182IsHeld(l)||concretePlanReadyV12(l)||l.manualPinnedV272||
   !!l.actualV270?.savedAt||!!l.presentationReady||!!l.v180MovedFrom||
   (l.printPlan||[]).length>0||(l.materials||[]).length>0||
   (l.slides||[]).length>0||(l.phasePlan||[]).length>0||
   (l.prepTasks||[]).length>0||l.source==='manual'||
   (l.planReference&&!l.planReference.autoMatched)||
   !!l.executionV180?.type);
}
function getData(cid,y){
 const seqs=v190PlanningSequences(cid,y);
 const examDates=new Set((state.assessments||[]).filter(a=>a.classId===cid&&v190YearFromDate(a.date)===y).map(a=>a.date));
 const units=seqs.flatMap(q=>(q.plan||[]).map(u=>({key:identity(q,u),q,u,
    title:u.title||'Soll-Stunde',date:u.plannedDate||'',slot:Number(u.plannedSlotV272)||0,
    skipped:!!v201UnitSkipped(u)})));
 const slots=v190CourseSlots(cid,y).map(s=>({...s,slot:Number(s.slot)}))
   .sort((a,b)=>a.date.localeCompare(b.date)||a.slot-b.slot);
 const selected=units.filter(x=>!x.skipped&&!examDates.has(x.date));
 return {seqs,units,selected,slots,examDates};
}
function lessonFor(cid,s){
 return (state.lessons||[]).find(l=>l.classId===cid&&sameSlot(l,s));
}
function determine(cid,y,unitKey,targetKey){
 const data=getData(cid,y);
 const source=data.units.find(x=>x.key===unitKey);
 if(!source)throw Error('Die gewählte Reihenstunde existiert nicht mehr.');
 if(source.date&&data.examDates.has(source.date))
   throw Error('Dieser Soll-Eintrag liegt auf einem fest eingetragenen Leistungsnachweis. Der Prüfungstermin bleibt unverändert.');
 const targetIndex=data.slots.findIndex(s=>s.date+'|'+s.slot+'|'+(s.timetableId||'')===targetKey);
 if(targetIndex<0)throw Error('Der ausgewählte Fachtermin steht nicht mehr zur Verfügung.');
 const blocked=[],protectedKeys=new Set(),kept=[];
 data.slots.forEach((s,i)=>{
  const l=lessonFor(cid,s);
  if(isGuarded(l))blocked.push(i);
 });
 for(const x of data.units){
  const linked=(state.lessons||[]).filter(l=>l.classId===cid&&
    l.planReference?.unitId===x.u.id);
  if(linked.some(l=>v182IsHeld(l)||l.manualPinnedV272||
      (l.date>=today()&&isGuarded(l)))){
    protectedKeys.add(x.key);
  }
  // Ein früherer Ausfall bleibt ein dokumentierter Ausfall, auch wenn ein
  // damals kopiertes Arbeitsblatt schon in der alten Stunde vorhanden war.
  if(x.date<today()&&linked.some(l=>v182IsHeld(l)))protectedKeys.add(x.key);
 }
 // If the source is already marked held/prepared, DO NOT move its historic
 // plan unit. Instead offer a new instance of the same topic for the target
 // day. This is an explicit re-use, not a rewrite of teaching history.
 const repeat=protectedKeys.has(source.key);
 const repeatKey='v273:repeat:'+source.key;
 const movable=data.selected.map(x=>({key:x.key,date:x.date,slot:x.slot,title:x.title}));
 if(repeat){
   movable.push({key:repeatKey,date:'',slot:0,title:source.title});
 }else if(!movable.some(x=>x.key===source.key)){
   movable.push({key:source.key,date:source.date,slot:source.slot,title:source.title});
 }
 const p=core.plan({units:movable,slots:data.slots,
   sourceKey:repeat?repeatKey:source.key,targetIndex,today:today(),
   protectedKeys:repeat?[...protectedKeys].filter(k=>k!==repeatKey):[...protectedKeys],
   blockedSlots:blocked});
 const impacted=p.moves.map(m=>({...m,unit:m.key===repeatKey?
   {...source,key:repeatKey,repeatOfV273:source.u.id}:data.units.find(x=>x.key===m.key)}));
 return {...data,source,repeat,preview:p,moves:impacted};
}
function candidates(cid,y){
 return getData(cid,y).slots.map((s,i)=>({...s,i})).filter(s=>s.date>=today()).slice(0,35);
}
function openUnit(value){
 const [qid,uid]=String(value||'').split('|'),q=seq(qid),u=q?.plan?.find(x=>x.id===uid);
 if(!q||!u)return alert('Diese Soll-Stunde ist nicht mehr vorhanden.');
 const y=v190SeqYear(q),slots=candidates(q.classId,y);
 if(!slots.length)return alert('Keine kommenden Fachtermine für diesen Kurs. Bitte Stundenplan und Kalender überprüfen.');
 const preferred=slots.find(s=>s.date===u.plannedDate)||slots[0];
 draft={cid:q.classId,y,unitKey:identity(q,u),targetKey:preferred.date+'|'+preferred.slot+'|'+(preferred.timetableId||''),fingerprint:fingerprint()};
 modal={type:'lessonSwitchV272'};render();
}
function openTarget(id){
 const l=(state.lessons||[]).find(x=>x.id===id);if(!l)return;
 const y=v190YearFromDate(l.date),data=getData(l.classId,y),matches=data.units.filter(x=>!x.skipped);
 if(!matches.length)return alert('Dieser Kurs hat noch keine Soll-Stunden in der Reihenplanung.');
 const preferred=matches.find(x=>x.u.id===l.planReference?.unitId)||
   matches.filter(x=>x.date&&x.date<today()).sort((a,b)=>b.date.localeCompare(a.date))[0]||
   matches[0];
 const match=data.slots.find(s=>s.date===l.date&&s.slot===Number(lessonSlot(l)));
 draft={cid:l.classId,y,unitKey:preferred.key,
   targetKey:l.date+'|'+Number(lessonSlot(l))+'|'+(match?.timetableId||l.timetableId||''),
   fingerprint:fingerprint()};
 modal={type:'lessonSwitchV272'};render();
}
function fingerprint(){
 return JSON.stringify([state.sequences,state.lessons,state.assessments,state.timetable,
   state.schoolCalendarsV190,state.settings.schoolYear]);
}
function modalPage(){
 if(!draft)return '';
 const data=getData(draft.cid,draft.y),slots=candidates(draft.cid,draft.y);
 const topics=data.units;
 const source=topics.find(x=>x.key===draft.unitKey);
 let preview,err='';
 try{preview=determine(draft.cid,draft.y,draft.unitKey,draft.targetKey);}
 catch(e){err=e.message||String(e);}
 const target=slots.find(s=>s.date+'|'+s.slot+'|'+(s.timetableId||'')===draft.targetKey);
 const affected=(preview?.moves||[]);
 const examLike=affected.filter(m=>/klassenarbeit|klausur|lernkontrolle/i.test(m.title));
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide v272-modal" data-modal-stop>'+
 '<header class="modal-header"><div><span class="eyebrow">REIHENPLANUNG · '+esc(courseLabel(draft.cid))+'</span>'+
 '<h2>Stunde auf anderen Termin legen</h2></div><button class="icon-button" data-action="modal-close">×</button></header>'+
 '<div class="modal-body"><p>Du bestimmst, <strong>welches Thema</strong> an <strong>welchem Fachtermin</strong> unterrichtet wird. Bereits gehaltene oder ausgearbeitete Stunden und echte Klassenarbeitstermine bleiben unangetastet. Verdrängte offene Themen rücken auf den nächsten freien Fachtermin.</p>'+
 '<div class="v272-fields"><label>Welche Soll-Stunde?<select data-v272-topic>'+
  topics.map(x=>'<option value="'+esc(x.key)+'" '+(x.key===draft.unitKey?'selected':'')+'>'+
   esc((x.date?fmtDate(x.date)+' · ':'ohne Termin · ')+x.q.title+' / '+x.title+(x.skipped?' (ausgelassen)':''))+'</option>').join('')+'</select></label>'+
 '<label>Wann soll sie stattfinden?<select data-v272-target>'+slots.map(s=>{
   const k=s.date+'|'+s.slot+'|'+(s.timetableId||'');
   const l=lessonFor(draft.cid,s);
   const existing=data.units.find(x=>x.date===s.date&&(!x.slot||x.slot===s.slot));
   const name=l?.title&&l.title!=='Thema noch festlegen'?l.title:existing?.title||'noch offen';
   return '<option value="'+esc(k)+'" '+(draft.targetKey===k?'selected':'')+'>'+esc(fmtDate(s.date)+' · Stunde '+s.slot+' · '+name)+'</option>';
 }).join('')+'</select></label></div>'+
 (preview?.repeat?'<p class="v272-info"><strong>Thema erneut einplanen:</strong> Die alte Stunde ist bereits als gehalten oder vorbereitet markiert. Deshalb wird eine <strong>neue Soll-Stunde</strong> für den gewählten Termin angelegt. Die alte Stunde, ihre Materialien und ihr Status bleiben unverändert.</p>':
 (source&&source.date<today()?'<p class="v272-info">Das Thema stammt aus einem vergangenen Soll-Termin ('+esc(fmtDate(source.date))+'). Die damalige Unterrichts- oder Ausfallhistorie wird nicht gelöscht.</p>':''))+
 (err?'<p class="warnbox" role="alert">'+esc(err)+'</p>':
 preview?.preview.unchanged?'<p>Das Thema liegt bereits auf diesem Termin. Es ist keine Verschiebung nötig.</p>':
 '<section class="v272-preview"><h3>Vorschau · '+affected.length+' Themen betroffen</h3>'+
 '<table><thead><tr><th>Stunde</th><th>Bisher</th><th>Neu</th></tr></thead><tbody>'+
 affected.map(m=>'<tr><td>'+esc(m.title)+(m.first?' <strong>(gewählt)</strong>':'')+'</td>'+
 '<td>'+esc(m.from?fmtDate(m.from):'Ohne Termin')+'</td>'+
 '<td>'+esc(fmtDate(m.to)+' · Stunde '+m.toSlot)+'</td></tr>').join('')+'</tbody></table></section>')+
 (preview?.preview.warnings?.length?'<div class="warnbox"><strong>Weitere alte Soll-Einträge unverändert:</strong><ul>'+preview.preview.warnings.slice(0,8).map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></div>':'')+
 (examLike.length?'<p class="warnbox">Achtung: '+examLike.length+' Soll-Eintrag/Einträge heißen „Klassenarbeit“ oder ähnlich. Es werden keine echten Leistungsnachweise geändert und keine doppelten Prüfungen automatisch gelöscht. Bitte vor dem Bestätigen die Verschiebungen kontrollieren.</p>':'')+
 '<div class="v272-actions"><button class="secondary" data-action="modal-close">Abbrechen</button>'+
 '<button class="primary" data-v272-apply '+(err||preview?.preview.unchanged||!affected.length?'disabled':'')+'>'+(preview?.repeat?'Thema erneut einplanen':'Diese Stundenverschiebung übernehmen')+'</button></div>'+
 '<p class="microcopy">Nur bestätigte Änderungen werden gespeichert. Bereits gedruckte Arbeitsblätter und historische Unterrichtseinträge bleiben erhalten. Für die neue Stunde kannst du anschließend den normalen PowerPoint-Planungsassistenten öffnen.</p>'+
 '</div></section></div>';
}
function assign(l,q,u,manual){
 l.sequenceId=q.id;l.unit=q.title;l.title=u.title||'Thema noch festlegen';
 l.objective=u.objective||'';
 l.planReference={plannedDate:u.plannedDate,title:u.title,content:u.content,
  objective:u.objective,material:u.material,notes:u.notes,unitId:u.id,
  autoMatched:!manual};
 if(manual)l.manualPinnedV272={unitId:u.id,chosenAt:new Date().toISOString()};
 else delete l.manualPinnedV272;
 if(l.status!=='done')l.status='open';
}
function resetIfLinked(l,changedIds){
 if(!l||isGuarded(l))return;
 if(l.planReference&&changedIds.has(l.planReference.unitId)&&l.planReference.autoMatched){
   l.title='Thema noch festlegen';l.objective='';l.sequenceId='';l.unit='';l.planReference=null;
 }
}
async function apply(){
 if(!draft||busy)return;busy=true;
 const button=document.querySelector('[data-v272-apply]');if(button)button.disabled=true;
 const current=fingerprint();
 const backup={seqs:structuredClone(state.sequences),lessons:structuredClone(state.lessons),activeWeek:state.settings.activeWeekStart};
 try{
  if(current!==draft.fingerprint)throw Error('Der Plan hat sich seit dem Öffnen geändert. Bitte Vorschau neu öffnen.');
  const calc=determine(draft.cid,draft.y,draft.unitKey,draft.targetKey);
  if(calc.preview.unchanged||!calc.moves.length)return;
  // A protected source is duplicated as a NEW planning unit. The original
  // unit and any old held lesson must not be modified.
  if(calc.repeat){
    const first=calc.moves.find(m=>m.first);
    if(!first)throw Error('Keine neue Unterrichtsstunde zur Wiederholung gefunden.');
    const copy=structuredClone(calc.source.u);
    copy.id=uid('repeat-unit');
    copy.repeatedFromV273=calc.source.u.id;
    copy.plannedDate=first.to;
    copy.plannedSlotV272=first.toSlot;
    copy.skippedThisYearV201=false;
    delete copy.skippedPreviousDateV201;
    const q=calc.source.q, plan=q.plan||[];
    const next=plan.findIndex(u=>u!==calc.source.u&&
      !v201UnitSkipped(u)&&u.plannedDate&&u.plannedDate>=first.to);
    plan.splice(next>=0?next:plan.length,0,copy);
    first.unit={...first.unit,u:copy,key:core.key(q.id,copy.id)};
  }
  const changedIds=new Set(calc.moves.map(m=>m.unit.u.id));
  for(const m of calc.moves){
   if(!m.unit)throw Error('Verschobene Soll-Stunde nicht mehr vorhanden.');
   if(m.unit.u.skippedThisYearV201){
     m.unit.u.skippedThisYearV201=false;delete m.unit.u.skippedPreviousDateV201;
   }
   m.unit.u.plannedDate=m.to;m.unit.u.plannedSlotV272=m.toSlot;
  }
  // Keep the displayed range of affected sequences in sync with their unit
  // dates while retaining genuinely held earlier lessons as history anchors.
  const changedSequences=new Set(calc.moves.map(m=>m.unit.q.id));
  for(const q of state.sequences||[]){
   if(!changedSequences.has(q.id))continue;
   const dates=[...(q.plan||[]).filter(u=>!v201UnitSkipped(u)).map(u=>u.plannedDate).filter(Boolean),
    ...(state.lessons||[]).filter(l=>l.sequenceId===q.id&&v182IsHeld(l)).map(l=>l.date)];
   if(dates.length){dates.sort();q.startDate=dates[0];q.endDate=dates[dates.length-1];}
  }
  // All changes are restricted to the same course, current/future slots.
  // Do not mutate historical canceled lessons or the other courses.
  const target=calc.preview.target;
  // Clear every old, automatically linked future occurrence of the moved
  // units, even if its old slot is unknown in the legacy date-only plan.
  for(const row of state.lessons||[]){
   if(row.classId===draft.cid&&row.date>=today()&&
      row.planReference?.autoMatched&&changedIds.has(row.planReference.unitId)){
     if(isGuarded(row))throw Error('Eine vorbereitete Stunde würde überschrieben.');
     resetIfLinked(row,changedIds);
   }
  }
  let targetLesson=null;
  for(const slot of calc.slots){
   if(slot.date<today()||!calc.moves.some(m=>m.to===slot.date&&m.toSlot===slot.slot))continue;
   const l=lessonFor(draft.cid,slot);
   if(l&&isGuarded(l))throw Error('Eine Zielstunde wurde inzwischen vorbereitet. Bitte erneut prüfen.');
   if(l)resetIfLinked(l,changedIds);
   const next=calc.moves.find(x=>x.to===slot.date&&x.toSlot===slot.slot);
   if(!next)continue;
   let row=l;
   if(!row){
     row=createBlankLessonFromTimetable({id:slot.timetableId,classId:draft.cid,
       weekday:new Date(slot.date+'T12:00:00').getDay()||7,
       slot:slot.slot,period:slot.period||''});
     row.date=slot.date;row.kind='course';state.lessons.push(row);
   }
   assign(row,next.unit.q,next.unit.u,!!next.first);
   if(next.first)targetLesson=row;
  }
  await saveState();
  draft=null;modal=null;
  if(targetLesson){
   const d=new Date(targetLesson.date+'T12:00:00'),wd=(d.getDay()||7);
   // Activate the exact target week so the Monday preparation shows the
   // newly assigned topic and its normal PowerPoint workflow.
   state.settings.activeWeekStart=iso(mondayOf(d));
   view='prep';render();
   openWizardV14(targetLesson.id,1);
  }else render();
 }catch(e){
  state.sequences=backup.seqs;state.lessons=backup.lessons;state.settings.activeWeekStart=backup.activeWeek;
  alert('Keine Verschiebung gespeichert: '+(e.message||e));render();
 }finally{busy=false;if(button)button.disabled=false;}
}
const oldSequencePanel=sequencePanel;
sequencePanel=function(q){
 const h=oldSequencePanel(q);
 return h.replace(/data-use-plan-unit="([^"]+)"/g,'data-v272-unit="$1"')
  .replace(/In nächste Stunde übernehmen →/g,'Termin wählen / verschieben →');
};
const oldRow=coursePrepRowV14;
coursePrepRowV14=function(l){
 const h=oldRow(l);if(!l?.classId||l.kind==='group'||l.groupId||v182IsHeld(l))return h;
 return h.replace('</article>','<div class="v272-switch-button"><button type="button" class="secondary" data-v272-target="'+esc(l.id)+'">Anderes Stundenthema wählen</button></div></article>');
};
const oldDay=v182LessonDayHtml;
v182LessonDayHtml=function(l){
 const h=oldDay(l);if(!l?.classId||l.kind==='group'||l.groupId||v182IsHeld(l))return h;
 return h.replace('<section class="v182-day-top">','<section class="v182-day-top"><button type="button" class="secondary" data-v272-target="'+esc(l.id)+'">Stundenthema wechseln</button>');
};
const oldModal=modalHtml;
modalHtml=function(){return modal?.type==='lessonSwitchV272'?modalPage():oldModal();};
const oldProtected=v191LessonProtected;
v191LessonProtected=function(l){return oldProtected(l)||!!l?.manualPinnedV272;};
const oldWire=wire;
wire=function(){
 oldWire();
 document.querySelectorAll('[data-v272-unit]').forEach(b=>b.onclick=()=>openUnit(b.dataset.v272Unit));
 document.querySelectorAll('button[data-v272-target]').forEach(b=>b.onclick=()=>openTarget(b.dataset.v272Target));
 document.querySelector('[data-v272-topic]')?.addEventListener('change',e=>{
  if(!draft)return;draft.unitKey=e.target.value;render();
 });
 document.querySelector('select[data-v272-target]')?.addEventListener('change',e=>{
  if(!draft)return;draft.targetKey=e.target.value;render();
 });
 document.querySelector('[data-v272-apply]')?.addEventListener('click',()=>void apply());
};
window.SchulcockpitLessonSwitchV272={openUnit,openTarget,determine};
})();
