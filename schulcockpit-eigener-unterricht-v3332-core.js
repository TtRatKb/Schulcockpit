/* Schulcockpit V0.33.32 – pure own-lesson and actual-teaching records. */
'use strict';
const SC_OWN_TEACHING_V3332=(function(){
 const txt=(v,n=2500)=>String(v??'').trim().slice(0,n);
 const clone=v=>JSON.parse(JSON.stringify(v));
 function ownUnit({id,title,intention,competencyIds=[],date,slot,actual=false}={}){
  if(!id||!date)throw Error('Stabile Stunden-ID und Fachtermin fehlen.');
  if(!txt(title)&&!txt(intention))throw Error('Bitte Thema oder kurze Absicht angeben.');
  return {id,title:txt(title,160)||'Eigener Unterricht',objective:txt(intention,600),
   content:txt(intention,1200),material:'Eigene vorhandene Materialien',notes:'',
   plannedDate:date,plannedSlotV272:Number(slot)||0,competencyIdsV202:[...new Set(competencyIds)],
   ownLessonV3332:{schema:1,createdAt:new Date().toISOString(),actual:!!actual}};
 }
 function actualRecord({previous,title,summary,competencyIds=[],files=[],now=new Date().toISOString(),replacedPlanReference=null}={}){
  if(!txt(title)&&!txt(summary))throw Error('Bitte tatsächliches Thema oder einen kurzen Ablauf angeben.');
  const history=previous?.savedAt?[...(previous.correctionHistoryV3332||[]),{
   correctedAt:now,previous:clone({...previous,correctionHistoryV3332:undefined})}]:[];
  return {...(previous||{}),mode:'changed',title:txt(title,160),summary:txt(summary,2500),
   securing:previous?.securing||'',materialVerdict:'unused',coveredIds:[...new Set(competencyIds)],
   securedIds:previous?.securedIds||[],files:[...(previous?.files||[]),...files],savedAt:now,
   replacedPlanReference:replacedPlanReference?clone(replacedPlanReference):previous?.replacedPlanReference||null,
   correctionHistoryV3332:history};
 }
 function attachOwnLesson({lesson,sequence,unit,actual=null,now=new Date().toISOString()}={}){
  if(!lesson||!sequence||!unit)throw Error('Stundenkarte, Reihe oder eigener Entwurf fehlt.');
  if(lesson.classId!==sequence.classId)throw Error('Die Reihe gehört zu einem anderen Fachkurs.');
  const previous=clone({title:lesson.title,objective:lesson.objective,sequenceId:lesson.sequenceId,
   unit:lesson.unit,planReference:lesson.planReference||null,status:lesson.status,actualV270:lesson.actualV270||null});
  lesson.sequenceId=sequence.id;lesson.unit=sequence.title;
  lesson.title=unit.title;lesson.objective=unit.objective;
  lesson.planReference={unitId:unit.id,title:unit.title,plannedDate:lesson.date,
   content:unit.content,objective:unit.objective,material:unit.material,notes:'',autoMatched:false};
  lesson.manualPinnedV272={unitId:unit.id,chosenAt:now};
  lesson.ownLessonV3332={schema:1,unitId:unit.id,createdAt:now,previous};
  if(actual){lesson.actualV270=actual;lesson.status='done';}else if(lesson.status!=='done')lesson.status='open';
  return previous;
 }
 return {ownUnit,actualRecord,attachOwnLesson};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_OWN_TEACHING_V3332;
