/* V0.33.14 – exact, full-name Excel identity and stable exam student IDs.
 * Pure transformations; students and their marks never migrate automatically.
 */
(function(root){
'use strict';
function normal(value){
 return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function reportAt(reports,index){
 const list=Array.isArray(reports)?reports:[];
 if(!list.length)return null;
 const n=Math.min(Math.max(0,Number(index)||0),list.length-1);
 return list[n]||null;
}
function marksExist(p,id){
 return ['scores','paperScores','bonusScores'].some(field=>
  Object.values(p?.[field]?.[id]||{}).some(v=>v!==undefined&&v!==null&&v!==''));
}
function mergeRoster(priv,detection,normalize=normal){
 const input=Array.isArray(detection?.studentRows)?detection.studentRows:[];
 if(!input.length)throw Error('In der Classtime-Excel gibt es keine eindeutigen Teilnehmerzeilen.');
 const existing=Array.isArray(priv?.roster)?priv.roster:[];
 const byName=new Map(),oldIds=new Set(),seen=new Set(),rowNumbers=new Set();
 for(const person of existing){
  const id=String(person?.id||''),name=normalize(person?.name);
  if(!id||oldIds.has(id))throw Error('Vorhandene Prüfungs-IDs sind mehrfach vergeben. Nicht importieren; Zuordnung zuerst prüfen.');
  oldIds.add(id);
  if(name){
   if(byName.has(name))throw Error('In der bestehenden Prüfungs-Teilnehmerliste sind vollständige Namen doppelt. Bitte vor dem Import klären.');
   byName.set(name,person);
  }
 }
 const used=new Set(oldIds),taken=new Set();
 let serial=1;
 const allocate=()=>{
  let candidate;
  do{candidate='S'+String(serial++).padStart(3,'0');}while(used.has(candidate));
  used.add(candidate);return candidate;
 };
 const roster=input.map(row=>{
  const normalized=normalize(row?.name),rowIndex=Number(row?.rowIndex);
  if(!normalized||seen.has(normalized))
   throw Error('Classtime enthält gleiche oder leere vollständige Namen. Bitte die betroffenen Excel-Zeilen eindeutig prüfen; keine automatische Verknüpfung.');
  if(!Number.isInteger(rowIndex)||rowIndex<0||rowNumbers.has(rowIndex))
   throw Error('Classtime-Teilnehmerzeilen sind nicht eindeutig. Keine Punkte übernommen.');
  seen.add(normalized);rowNumbers.add(rowIndex);
  const prior=byName.get(normalized);
  if(prior)taken.add(prior.id);
  // Reuse EXACT matched person's ID, classStudentId and all private metadata.
  return {...(prior||{}),id:prior?.id||allocate(),
   name:String(row.name).trim(),rowIndex};
 });
 // Retain students added for another exam version or later makeup session.
 // Deleting a child from the primary Excel never silently erases their points.
 for(const old of existing)if(!taken.has(old.id))roster.push({...old,rowIndex:null});
 return roster;
}
function audit(classRoster,priv,normalize=normal){
 const classMembers=Array.isArray(classRoster?.roster)?classRoster.roster:[];
 const examMembers=Array.isArray(priv?.roster)?priv.roster:[];
 const byClass=new Map(classMembers.map(s=>[s.id,s]));
 const linked=new Map(),examIds=new Set(),issues=[];
 for(const person of examMembers){
  const id=String(person.id||'');
  if(!id||examIds.has(id))issues.push({kind:'duplicate-exam-id',examId:id,
   student:person.name||'',message:'Prüfungs-ID ist doppelt.'});
  examIds.add(id);
  if(!person.classStudentId)continue;
  const assigned=byClass.get(person.classStudentId);
  if(!assigned)issues.push({kind:'unknown-class-id',examId:id,
   student:person.name||'',message:'Verknüpfte Klassenperson ist nicht mehr vorhanden.'});
  else if(normalize(person.name)!==normalize(assigned.name))
   issues.push({kind:'name-mismatch',examId:id,student:person.name||'',
    className:assigned.name||'',message:'Excel-Name und Klassenlisten-Name unterscheiden sich.'});
  if(linked.has(person.classStudentId))
   issues.push({kind:'duplicate-link',examId:id,student:person.name||'',
    message:'Zwei Prüfungseinträge sind derselben Klassenperson zugeordnet.'});
  linked.set(person.classStudentId,id);
 }
 return issues;
}
function reassign(priv,classRoster,choices,exam=null){
 const examList=Array.isArray(priv?.roster)?priv.roster:[],
  classList=Array.isArray(classRoster?.roster)?classRoster.roster:[];
 const memberIds=new Set(classList.map(x=>x.id)),examIds=new Set(examList.map(x=>x.id));
 for(const id of Object.keys(choices||{}))if(!examIds.has(id))
  throw Error('Unbekannte Prüfungs-ID. Zuordnung nicht gespeichert.');
 const next=structuredClone(priv),used=new Set(),changes=[];
 for(const st of next.roster){
  const old=String(st.classStudentId||'');
  const proposed=Object.prototype.hasOwnProperty.call(choices||{},st.id)?
   String(choices[st.id]||''):old;
  if(proposed&&!memberIds.has(proposed))throw Error('Klassenperson existiert nicht.');
  if(proposed&&used.has(proposed))throw Error('Zwei Prüfungszeilen dürfen nicht mit demselben Kind verknüpft sein.');
  if(proposed)used.add(proposed);
  if(old===proposed)continue;
  const variant=String(next.examFileV317?.[st.id]||
    (next.activeVariantV300?.[st.id]?.startsWith('file:')?
     next.activeVariantV300[st.id].slice(5):''));
  if(variant&&!(next.examFileAssignmentsV316?.[variant]||[]).includes(proposed))
   throw Error('Die korrigierte Klassenperson ist nicht der bisher aktiven Sonderfassung zugeordnet. Zuerst die Prüfungsfassung prüfen.');
  st.classStudentId=proposed||undefined;
  changes.push({examId:st.id,oldClassId:old,newClassId:proposed});
 }
 if(changes.length){
  next.studentLinkHistoryV3314=[...(next.studentLinkHistoryV3314||[]),
   {changedAt:new Date().toISOString(),changes}];
 }
 return {next,changes};
}
const api={normal,reportAt,marksExist,mergeRoster,audit,reassign};
root.SchulcockpitStudentIdentityV3314=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
