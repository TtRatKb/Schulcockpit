/* V0.28.8 – show all planned weekly timetable lessons, not just cards
 * previously created by "Aus Stundenplan übernehmen". Safe, additive only.
 * Never recreates past lessons, holiday closures, course cancellations or
 * already occupied slots; never rewrites prepared lessons, exam results or files.
 */
(function(){
'use strict';
let latest={monday:'',excluded:[],added:0};
const eligible=new Set(['focus','prep','week','tasks','improve','lessonDayV182']);
function allowedYear(monday){
 const year=v190YearFromDate(monday),current=v190NormYear(state.settings.schoolYear);
 return year===current||!!state.schoolCalendarsV190?.[year]?.useCurrentTimetable;
}
function findUndatedPrepared(blank){
 const uid=blank.planReference?.unitId;
 if(!uid||blank.kind==='group')return null;
 return (state.lessons||[]).find(l=>!l.date&&l.classId===blank.classId&&
  l.planReference?.unitId===uid&&!v182IsHeld(l)&&!v182IsCanceled(l))||null;
}
function fill(){
 if(!v186Ready||!eligible.has(view)||!state.timetable?.length)return null;
 const monday=iso(activeMonday());
 const result=SC_WEEKFILL_V288.plan({
  monday,today:iso(new Date()),timetable:state.timetable,
  lessons:(state.lessons||[]).map(l=>({...l,slot:lessonSlot(l)})),
  noSchool:(date,cid)=>v190NoSchoolInfo(date,cid),
  allowedYear
 });
 latest={monday,excluded:result.excluded,added:0};
 if(!result.missing.length)return result;
 for(const entry of result.missing){
  const {t,date}=entry;
  // Recheck after previous additions; protect manually scheduled and moved
  // lessons even if they are not tied to this timetable row.
  if(state.lessons.some(l=>l.date===date&&lessonSlot(l)===Number(t.slot)))continue;
  const blank=createBlankLessonFromTimetable(t);
  if(!blank||blank.date!==date)continue;
  const exam=t.classId&&(state.assessments||[]).find(a=>a.classId===t.classId&&a.date===date);
  if(exam){
   blank.title=exam.title||exam.type||'Klassenarbeit';
   blank.assessmentId=exam.id;
   blank.sequenceId='';
   blank.unit='';
   blank.planReference=null;
  }
  const reuse=!exam&&findUndatedPrepared(blank);
  if(reuse){
   reuse.date=date;reuse.slot=Number(t.slot);reuse.period=t.period;
   reuse.timetableId=t.id;reuse.source='timetable';reuse.kind=blank.kind;
   if(reuse.planReference)reuse.planReference.plannedDate=date;
   delete reuse.scheduleParkedV275;
  }else{
   state.lessons.push(blank);
  }
  latest.added++;
 }
 if(latest.added){
  // Save once, after the whole week has been reconciled. This is a derived,
  // additive step: all original lesson objects and files remain untouched.
  Promise.resolve(saveState()).catch(err=>{
   console.error('Wochenstunden konnten nicht gespeichert werden',err);
  });
 }
 return result;
}
const previousRender=render;
render=function(){
 // Ensure cards exist before old week/prep/reflection render reads the list.
 fill();
 previousRender();
 const version=document.querySelector('.brand small');
 if(version)version.textContent=state.settings.schoolYear+' · V0.28.8';
};
const previousViewHtml=viewHtml;
viewHtml=function(){
 const html=previousViewHtml();
 if(!['week','prep'].includes(view)||latest.monday!==iso(activeMonday())||
  !latest.excluded.length)return html;
 const byDate=new Map();
 for(const e of latest.excluded){
  if(!e.t.classId)continue;
  const name=cls(e.t.classId);
  const k=e.date+'|'+e.t.classId;
  if(!byDate.has(k))byDate.set(k,{date:e.date,
   who:(name?.subject||'')+' '+(name?.name||''),
   reason:e.absence?.name||'Schulkalender'});
 }
 if(!byDate.size)return html;
 const rows=[...byDate.values()];
 return html+'<details class="v288-week-closures"><summary>'+
  rows.length+' Fachtermin'+(rows.length===1?'':'e')+
  ' laut Schulkalender ausgefallen oder unterrichtsfrei</summary><p>'+
  rows.map(e=>esc(fmtDate(e.date)+' · '+e.who+' · '+e.reason)).join('<br>')+
  '</p><small>Der Termin bleibt im Stundenplan bestehen. Für diesen Tag wird '+
  'keine normale Unterrichtsstunde automatisch angelegt.</small></details>';
};
window.SchulcockpitWeekfillV288={fill,last:()=>latest};
})();
