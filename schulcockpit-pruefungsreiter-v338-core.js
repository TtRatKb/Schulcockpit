/* V0.33.8 – pure, privacy-safe exam-version workspace selectors.
 * A version is the original fileKey of the actual exam. No synthetic exam duplicates.
 */
(function(root){
'use strict';
const SPECIAL=new Set(['alternative','inclusion','inclusion_makeup']);
function available(exam,kindFor){
 return (exam?.files||[]).filter(file=>
  !!file.fileKey&&SPECIAL.has(kindFor?kindFor(exam,file):file.roleV316))
  .map(file=>({key:'file:'+file.fileKey,fileKey:file.fileKey,
    role:kindFor?kindFor(exam,file):file.roleV316,name:file.name||''}));
}
function allowed(exam,kind,kindFor){
 return kind==='standard'||available(exam,kindFor).some(row=>row.key===kind);
}
function keyForStudent(priv,student){
 const id=student?.id;
 return String(priv?.examFileV317?.[id]||'')||
  (String(priv?.activeVariantV300?.[id]||'').startsWith('file:')?
   String(priv.activeVariantV300[id]).slice(5):'');
}
function matchingReports(reports,kind){
 if(kind==='standard')return (reports||[]).filter(r=>
  !r.examFileV317&&!String(r.examVariantV300||'standard').startsWith('file:')&&
   (r.examVariantV300||'standard')==='standard');
 if(!String(kind).startsWith('file:'))return [];
 const key=kind.slice(5);
 return (reports||[]).filter(r=>r.examFileV317===key);
}
function assignedClassIds(priv,key){
 if(!String(key).startsWith('file:'))return [];
 return priv?.examFileAssignmentsV316?.[key.slice(5)]||[];
}
function assignedStudents(classRoster,priv,kind,select){
 const allowedIds=new Set(assignedClassIds(priv,kind));
 const matches=[];
 for(const student of priv?.roster||[]){
  const classId=student.classStudentId||
    (classRoster?.roster?.filter(p=>p.name?.trim().toLowerCase()===
      student.name?.trim().toLowerCase()).length===1?
      classRoster.roster.find(p=>p.name?.trim().toLowerCase()===
      student.name?.trim().toLowerCase()).id:'');
  if(!allowedIds.has(classId))continue;
  const status=typeof select==='function'?select(priv,student):null;
  matches.push({id:student.id,name:student.name,status:status?.status||'unknown',
    variant:status?.file?.fileKey||'',ready:status?.status==='ready'&&status?.file?.fileKey===kind.slice(5)});
 }
 return matches;
}
function batchesFor(batches,kind){
 return (batches||[]).filter(b=>b.variantV300===kind);
}
const api={available,allowed,keyForStudent,matchingReports,assignedClassIds,assignedStudents,batchesFor};
root.SchulcockpitExamTabsV338Core=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
