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
function prepareParticipants(classRoster,priv,kind,hasScores){
 const assigned=assignedClassIds(priv,kind),members=new Map((classRoster?.roster||[]).map(st=>[st.id,st]));
 const usedNames=new Map();
 const norm=x=>String(x||'').normalize('NFKC').trim().replace(/\\s+/g,' ').toLocaleLowerCase('de-DE');
 for(const st of priv?.roster||[]){
  const n=norm(st.name),list=usedNames.get(n)||[];list.push(st);usedNames.set(n,list);
 }
 const add=[],activate=[],problems=[];
 if(!classRoster||classRoster.classId!==priv?.examClassIdV338&&
   priv?.examClassIdV338&&priv.examClassIdV338!==classRoster.classId)
  problems.push('Die Klassenliste gehört nicht zur Prüfung.');
 const seen=new Set();
 for(const classId of assigned){
  if(seen.has(classId)){problems.push('Ein Kind ist mehrfach derselben Fassung zugeordnet.');continue;}
  seen.add(classId);
  const member=members.get(classId);
  if(!member){problems.push('Ein zugeordnetes Kind fehlt in der Klassenliste.');continue;}
  const linked=(priv.roster||[]).filter(st=>st.classStudentId===classId);
  if(linked.length>1){problems.push('Ein Kind ist mehrfach in der Prüfungs-Teilnehmerliste verknüpft.');continue;}
  if(linked.length===1){
   const person=linked[0];
   const active=String(priv.activeVariantV300?.[person.id]||'standard'),
    explicit=String(priv.examFileV317?.[person.id]||'');
   if(!hasScores(priv,person.id)&&active==='standard'&&!explicit)activate.push(person.id);
   continue;
  }
  if(usedNames.has(norm(member.name))){
   problems.push('Ein Name ist bereits ohne eindeutige Klassen-ID vorhanden: '+member.name);continue;
  }
  add.push({classId,name:member.name});
 }
 return {assigned:assigned.length,add,activate,problems};
}
function batchesFor(batches,kind){
 return (batches||[]).filter(b=>b.variantV300===kind);
}
const api={available,allowed,keyForStudent,matchingReports,assignedClassIds,assignedStudents,prepareParticipants,batchesFor};
root.SchulcockpitExamTabsV338Core=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
