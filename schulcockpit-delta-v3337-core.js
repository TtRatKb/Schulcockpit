/* Schulcockpit V0.33.37 – validated, preview-only AI delta imports. */
'use strict';
const SC_DELTA_V3337=(function(){
 const clone=x=>JSON.parse(JSON.stringify(x)),text=(x,n=2500)=>String(x??'').trim().slice(0,n);
 function hash(x){let h=2166136261,s=JSON.stringify(x);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
 function lessonToken(l){return hash({id:l?.id,classId:l?.classId,date:l?.date,slot:l?.slot,unitId:l?.planReference?.unitId||'',choice:l?.teacherChoiceV3331?.chosenAt||'',actual:l?.actualV270?.savedAt||''});}
 function courseToken({courseId,schoolYear,sequences=[],evidence=[]}={}){return hash({courseId,schoolYear,sequences:sequences.map(q=>({id:q.id,plan:(q.plan||[]).map(u=>({id:u.id,c:[...(u.competencyIdsV202||[])]}))})),evidence:evidence.map(e=>({id:e.id,status:e.status,lessonId:e.lessonId,competencyId:e.competencyId,updatedAt:e.updatedAt||''}))});}
 function block(raw,tag){const m=String(raw||'').match(new RegExp('<'+tag+'>\\s*([\\s\\S]*?)\\s*</'+tag+'>','i'));if(!m)throw Error('Datenblock <'+tag+'> fehlt.');let x;try{x=JSON.parse(m[1]);}catch{throw Error('Der Delta-Datenblock ist kein gültiges JSON.');}return x;}
 function lessonPreview(raw,lesson,catalog=[]){const x=block(raw,'SCHULCOCKPIT_LESSON_DELTA'),errors=[];
  if(x.schema!=='schulcockpit.lesson-delta.v1')errors.push('Falsches Delta-Format.');
  if(x.lessonId!==lesson?.id||x.classId!==lesson?.classId)errors.push('Die Antwort gehört zu einem anderen Fachtermin.');
  if(x.baseToken!==lessonToken(lesson))errors.push('Die Stunde wurde seit Erstellung des Prompts verändert. Bitte neuen Prompt erzeugen.');
  const allowed=new Set(catalog.map(c=>c.id)),c=x.changes||{},ids=[...new Set(c.competencyIds||[])];
  if(ids.some(id=>!allowed.has(id)))errors.push('Delta enthält unbekannte oder fachfremde Kompetenz-ID.');
  const changes={title:text(c.title,160),summary:text(c.summary,2500),competencyIds:ids};
  if(!changes.title&&!changes.summary&&!ids.length)errors.push('Das Delta enthält keine nutzbare Ergänzung.');
  return {ready:!errors.length,errors,changes,raw:x};
 }
 function competencyPreview(raw,input){const x=block(raw,'SCHULCOCKPIT_COMPETENCY_DELTA'),errors=[],catalog=new Set((input.catalog||[]).map(c=>c.id));
  if(x.schema!=='schulcockpit.competency-delta.v1')errors.push('Falsches Delta-Format.');
  if(x.courseId!==input.courseId||x.schoolYear!==input.schoolYear)errors.push('Delta gehört zu einem anderen Kurs oder Schuljahr.');
  if(x.baseToken!==courseToken(input))errors.push('Planung oder Nachweise wurden seit Erstellung des Prompts verändert. Bitte neuen Prompt erzeugen.');
  const seqs=new Map((input.sequences||[]).map(q=>[q.id,q])),lessons=new Map((input.lessons||[]).map(l=>[l.id,l])),ops=[];
  for(const a of x.additions||[]){const q=seqs.get(a.sequenceId),u=q?.plan?.find(u=>u.id===a.unitId);if(!q||!u){errors.push('Ziel-Reihe oder Ziel-Stunde existiert nicht mehr.');continue;}const ids=[...new Set(a.competencyIds||[])];if(ids.some(id=>!catalog.has(id)))errors.push('Unbekannte Kompetenz-ID in Ergänzung.');const evidence=[];for(const e of a.evidence||[]){const l=lessons.get(e.lessonId);if(!l||l.classId!==input.courseId){errors.push('Nachweis verweist auf einen unzulässigen Fachtermin.');continue;}if(!ids.includes(e.competencyId)||!text(e.task))errors.push('Nachweis braucht eine ergänzte Kompetenz-ID und einen konkreten Arbeitsauftrag.');evidence.push({competencyId:e.competencyId,lessonId:e.lessonId,task:text(e.task,1200),socialForm:text(e.socialForm,120),duration:text(e.duration,80),evidenceForm:text(e.evidenceForm,180),scope:text(e.scope,500),coverageScope:e.coverageScope==='full'?'full':'partial'});}ops.push({q,u,ids,evidence});}
  if(!ops.length)errors.push('Keine gültige Ergänzung enthalten.');return {ready:!errors.length,errors,ops,raw:x};
 }
 function applyCompetency(preview,input,uid,now=new Date().toISOString()){if(!preview?.ready)throw Error((preview?.errors||['Delta nicht freigegeben.']).join('\n'));const sequences=clone(input.sequences),evidence=clone(input.evidence||[]),map=new Map(sequences.map(q=>[q.id,q]));for(const op of preview.ops){const u=map.get(op.q.id).plan.find(x=>x.id===op.u.id);u.competencyIdsV202=[...new Set([...(u.competencyIdsV202||[]),...op.ids])];for(const e of op.evidence)evidence.push({schema:1,id:uid('evidence'),classId:input.courseId,schoolYear:input.schoolYear,status:'planned',criteria:{E:'',TE:'',NNE:''},createdAt:now,updatedAt:now,...e});}return {sequences,evidence};}
 return {hash,lessonToken,courseToken,block,lessonPreview,competencyPreview,applyCompetency};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_DELTA_V3337;
