/* Schulcockpit V0.33.33 – explicit class-level competency evidence. */
'use strict';
const SC_COMPETENCY_EVIDENCE_V3333=(function(){
 const txt=(v,n=1200)=>String(v??'').trim().slice(0,n);
 function validate(e,lessons=[]){
  const errors=[];
  if(!e?.id||!e.classId||!e.competencyId)errors.push('Nachweis-ID, Kurs und Kompetenz fehlen.');
  if(!txt(e.task))errors.push('Ein konkreter Arbeitsauftrag fehlt.');
  if(!e.lessonId)errors.push('Bitte einen Fachtermin auswählen.');
  const l=lessons.find(x=>x.id===e.lessonId);
  if(e.lessonId&&!l)errors.push('Der verknüpfte Fachtermin existiert nicht mehr.');
  if(l&&l.classId!==e.classId)errors.push('Der Fachtermin gehört zu einem anderen Kurs.');
  if(e.status==='done'&&!(l?.actualV270?.savedAt||l?.status==='done'||l?.heldAtV182))
   errors.push('Durchgeführt darf erst nach bestätigtem Ist-Unterricht gewählt werden.');
  return errors;
 }
 function make(input,lessons=[]){
  const e={schema:1,id:input.id,classId:input.classId,competencyId:input.competencyId,
   lessonId:input.lessonId,status:input.status||'planned',task:txt(input.task),
   socialForm:txt(input.socialForm,120),duration:txt(input.duration,80),
   evidenceForm:txt(input.evidenceForm,180),scope:txt(input.scope,500),
   criteria:{E:txt(input.criteria?.E,400),TE:txt(input.criteria?.TE,400),NNE:txt(input.criteria?.NNE,400)},
   createdAt:input.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  const errors=validate(e,lessons);if(errors.length)throw Error(errors.join('\n'));return e;
 }
 function coverage(catalog=[],evidence=[]){return catalog.map(c=>{const rows=evidence.filter(e=>e.competencyId===c.id),done=rows.filter(e=>e.status==='done'),planned=rows.filter(e=>e.status==='planned'),review=rows.filter(e=>e.status==='review_required');return {id:c.id,planned:planned.length>0||done.length>0,verified:done.length>0,review:review.length,count:rows.length};});}
 function markSelectionReview(evidence=[],lessonId,newCompetencyIds=[]){const allowed=new Set(newCompetencyIds);let changed=0;for(const e of evidence)if(e.lessonId===lessonId&&e.status!=='done'&&!allowed.has(e.competencyId)){e.status='review_required';e.reviewReason='Stundenauswahl geändert; Nachweis fachlich neu zuordnen oder bestätigen.';e.reviewedAt='';changed++;}return changed;}
 return {validate,make,coverage,markSelectionReview};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_COMPETENCY_EVIDENCE_V3333;
