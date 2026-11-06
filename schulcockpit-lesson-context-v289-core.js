/* Schulcockpit V0.28.9 – pure canonical lesson-context resolver.
 * Assessment and excursion/substitution types win over ordinary topics.
 * No state mutation, no guessed syllabus content. */
const SC_LESSON_CONTEXT_V289=(function(){
'use strict';
function included(range,date){return !!range&&!!date&&
 typeof range.start==='string'&&typeof range.end==='string'&&
 range.start<=date&&date<=range.end;}
function classify({date,classId,assessments=[],calendar=[],courseRanges=[],units=[]}={}){
 if(!date||!classId)return {type:'ordinary',unit:null};
 const exam=assessments.find(a=>a?.classId===classId&&a.date===date);
 if(exam)return {type:'exam',exam,unit:null,title:'Klassenarbeit · '+(exam.title||exam.type||'Leistungsnachweis')};
 const trip=calendar.find(r=>included(r,date)&&r.impactV262==='substitution'&&
  Array.isArray(r.attendingClassIdsV289)&&r.attendingClassIdsV289.includes(classId));
 if(trip)return {type:'excursion',event:trip,unit:null,title:'Außerschulischer Lernort · '+(trip.name||'Klassenfahrt')};
 const sub=[...courseRanges.filter(r=>r?.classId===classId),...calendar]
  .find(r=>included(r,date)&&r.impactV262==='substitution');
 const matches=units.filter(r=>r?.classId===classId&&r.unit?.plannedDate===date);
 const hit=matches[0]||null;
 const unit=hit?{...hit.unit,sequenceId:hit.sequenceId,sequenceTitle:hit.sequenceTitle}:null;
 if(sub)return {type:'substitution',event:sub,unit,
  title:'Vertretung · '+(unit?.title||'Sollthema aus Reihenplanung zuordnen')};
 return {type:'ordinary',unit,
  title:unit?.title||'Kein Sollthema für diesen Termin zugeordnet'};
}
function canReplaceTitle(lesson){
 const title=String(lesson?.title||'').trim();
 return !title||/^(?:thema noch festlegen|noch kein thema|kein thema)$/i.test(title)||
  !!lesson?.v289AutoTitle&&title===lesson.v289AutoTitle;
}
return {classify,included,canReplaceTitle};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_LESSON_CONTEXT_V289;
