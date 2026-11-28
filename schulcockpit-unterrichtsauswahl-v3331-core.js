/* Schulcockpit V0.33.31 – pure canonical lesson selection and competency gap model. */
'use strict';
const SC_TEACHING_CHOICE_V3331=(function(){
 const text=v=>String(v??'');
 const uniq=a=>[...new Set(a||[])];
 function slotKey(l,schoolYear=''){
  if(!l?.classId||!l?.date||!Number.isFinite(Number(l?.slot)))return '';
  return [text(schoolYear),text(l.classId),text(l.date),Number(l.slot)].join('|');
 }
 function isHistory(l){return !!l&&(l.status==='done'||l.status==='cancelled'||
  !!l.heldAtV182||!!l.actualV270?.savedAt||!!l.reflectionV182?.completedAt||
  !!l.executionV180?.type);}
 function isPrepared(l){return !!(l&&((l.materials||[]).length||(l.printPlan||[]).length||
  (l.phasePlan||[]).length||(l.slides||[]).length||(l.prepTasks||[]).length||
  l.presentationReady||l.aiImportAt||l.manualPlanReadyV177));}
 function previewSelection({lesson,sequence,unit,schoolYear,lessons=[]}={}){
  const issues=[];
  if(!lesson||!sequence||!unit)issues.push('Stunde, Reihe oder Vorschlag fehlt.');
  if(lesson&&sequence&&lesson.classId!==sequence.classId)
   issues.push('Der Vorschlag gehört zu einem anderen Fachkurs.');
  if(isHistory(lesson))issues.push('Bereits gehaltener oder dokumentierter Unterricht ist geschützt.');
  const key=slotKey(lesson,schoolYear);
  const collisions=lessons.filter(x=>x?.id!==lesson?.id&&slotKey(x,schoolYear)===key&&
   !x.scheduleParkedV275);
  if(collisions.length)issues.push('Der Fachtermin enthält bereits eine weitere aktive Stundenkarte.');
  const oldUnitId=lesson?.planReference?.unitId||'';
  const confirmed=!!lesson?.teacherChoiceV3331?.chosenAt&&lesson.teacherChoiceV3331.unitId===unit?.id;
  return {ok:!issues.length,issues,key,oldUnitId,newUnitId:unit?.id||'',confirmed,
   changes:oldUnitId===unit?.id?0:1,prepared:isPrepared(lesson)};
 }
 function applySelection(input){
  const p=previewSelection(input);if(!p.ok)throw Error(p.issues.join('\n'));
  const {lesson,sequence,unit,now=new Date().toISOString()}=input;
  const before=JSON.parse(JSON.stringify({title:lesson.title||'',objective:lesson.objective||'',
   sequenceId:lesson.sequenceId||'',unit:lesson.unit||'',planReference:lesson.planReference||null,
   teacherChoiceV3331:lesson.teacherChoiceV3331||null}));
  lesson.sequenceId=sequence.id;lesson.unit=sequence.title||'';
  lesson.title=unit.title||'Thema noch festlegen';lesson.objective=unit.objective||'';
  lesson.planReference={...(lesson.planReference||{}),unitId:unit.id,title:unit.title||'',
   plannedDate:lesson.date,content:unit.content||'',objective:unit.objective||'',
   material:unit.material||'',notes:unit.notes||'',autoMatched:false};
  lesson.manualPinnedV272={unitId:unit.id,chosenAt:now};
  lesson.teacherChoiceV3331={schema:1,slotKey:p.key,chosenAt:now,unitId:unit.id,
   previousUnitId:p.oldUnitId,status:'confirmed',history:[
    ...(lesson.teacherChoiceV3331?.history||[]),{at:now,before,unitId:unit.id}]};
  if(lesson.status!=='done')lesson.status='open';
  return {preview:p,before};
 }
 function undoSelection(lesson){
  const history=lesson?.teacherChoiceV3331?.history||[],last=history.at(-1);
  if(!last?.before)throw Error('Für diese Auswahl ist kein vorheriger Stand gespeichert.');
  if(isHistory(lesson))throw Error('Dokumentierter Ist-Unterricht kann hier nicht zurückgesetzt werden.');
  for(const k of ['title','objective','sequenceId','unit'])lesson[k]=last.before[k]||'';
  lesson.planReference=last.before.planReference?JSON.parse(JSON.stringify(last.before.planReference)):null;
  if(last.before.teacherChoiceV3331)lesson.teacherChoiceV3331={...last.before.teacherChoiceV3331,
   history:history.slice(0,-1)};
  else delete lesson.teacherChoiceV3331;
  if(lesson.planReference?.unitId)lesson.manualPinnedV272={unitId:lesson.planReference.unitId,
   chosenAt:new Date().toISOString()};else delete lesson.manualPinnedV272;
  return lesson;
 }
 function competencyRows({catalog=[],sequences=[],lessons=[]}={}){
  const units=sequences.flatMap(q=>(q.plan||[]).map(u=>({q,u})));
  return uniq(catalog.map(c=>c.id)).map(id=>{
   const c=catalog.find(x=>x.id===id)||{id,text:id};
   const plannedUnits=units.filter(({u})=>uniq([...(u.competencyIdsV202||[]),
    ...(u.competencyIds||[]),...(u.methodIds||[])]).includes(id));
   const actual=lessons.filter(l=>l.actualV270?.savedAt&&
    (l.actualV270.coveredIds||[]).includes(id));
   const secured=lessons.filter(l=>l.actualV270?.savedAt&&
    (l.actualV270.securedIds||[]).includes(id));
   return {id,text:c.text||id,category:c.category||c.kind||'Kompetenz',source:c.source||
    c.sourceId||c.topicTitle||'Curriculum',planned:plannedUnits.length>0,
    taught:actual.length>0||secured.length>0,verified:false,individuallyAssessed:false,
    plannedCount:plannedUnits.length,taughtCount:uniq([...actual,...secured].map(l=>l.id)).length};
  });
 }
 return {slotKey,isHistory,isPrepared,previewSelection,applySelection,undoSelection,competencyRows};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_TEACHING_CHOICE_V3331;
