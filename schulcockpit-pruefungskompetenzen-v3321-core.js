/* V0.33.21 – explicit, exam-specific topic and competency boundaries.
 * Pure: no UI and no student/personal data; no default to a whole grade.
 */
(function(root){
'use strict';
function unique(ids){return [...new Set((Array.isArray(ids)?ids:[]).filter(x=>typeof x==='string'&&x.trim()))];}
function groups(pool){
 const found=new Map();
 for(const item of pool||[]){
  if(!item?.id||!item?.topicId)continue;
  const key=String(item.topicId),entry=found.get(key)||
   {id:key,title:item.topicTitle||'Curriculumthema',competencies:[]};
  if(!entry.competencies.some(c=>c.id===item.id))
   entry.competencies.push({id:item.id,text:item.text||'',category:item.category||'',
    level:item.level||''});
  found.set(key,entry);
 }
 return [...found.values()];
}
function selection(pool,scope){
 const available=new Map((pool||[]).map(c=>[c.id,c]));
 const validTopics=new Set(groups(pool).map(g=>g.id));
 const topics=unique(scope?.topicIds),ids=unique(scope?.competencyIds);
 const errors=[];
 if(!scope||scope.confirmed!==true)errors.push('Themen und Kompetenzen dieser Klassenarbeit bitte zunächst bestätigen.');
 if(!topics.length)errors.push('Mindestens ein geprüftes Thema auswählen.');
 if(!ids.length)errors.push('Mindestens eine tatsächlich geprüfte Kompetenz auswählen.');
 for(const topic of topics)if(!validTopics.has(topic))errors.push('Ein gespeichertes Prüfungsthema gehört nicht mehr zum aktuellen Fach-/Jahrgangscurriculum: '+topic);
 for(const id of ids){
  const item=available.get(id);
  if(!item||!topics.includes(String(item.topicId)))
   errors.push('Die Kompetenz ist nicht in den ausgewählten Prüfungsthemen enthalten: '+id);
 }
 return {ready:errors.length===0,errors,topicIds:topics,competencyIds:ids,
  competencies:ids.map(id=>available.get(id)).filter(Boolean)};
}
function create(pool,topics,ids){
 const scope={schema:1,topicIds:unique(topics),competencyIds:unique(ids),confirmed:true};
 const result=selection(pool,scope);
 if(!result.ready)throw Error(result.errors.join(' '));
 return scope;
}
function checkImport(analysis,allowed){
 const ids=new Set(allowed||[]);
 if(!ids.size)throw Error('Zuerst die Prüfkompetenzen bestätigen.');
 for(const c of analysis?.competencies||[]){
  const id=String(c.curriculumCompetencyId||'').trim();
  if(id&&!ids.has(id))
   throw Error('Kompetenz '+id+' gehört nicht zu den bestätigten Prüfungsthemen. Das Raster wurde nicht übernommen.');
 }
 return true;
}
const api={groups,selection,create,checkImport,unique};
root.SchulcockpitExamScopeV3321Core=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
