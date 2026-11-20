/* Schulcockpit V0.33.5 – private-only roster reconciliation for later exam results.
 * Never infer attendance from an absent Excel row, change existing marks, or fuzzy-match names.
 */
(function(root){
'use strict';
const REASONS=['unknown','makeup','not_participating','paper_pending'];
function norm(value){
 return String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE');
}
function hasMarks(priv,studentId){
 if(!studentId)return false;
 return ['scores','paperScores','bonusScores'].some(field=>
  Object.values(priv?.[field]?.[studentId]||{}).some(value=>
   value!==null&&value!==undefined&&value!==''));
}
function reconcile(members,priv){
 const enrolled=Array.isArray(members)?members:[],exam=priv?.roster||[];
 const memberIds=new Set(enrolled.map(s=>s.id));
 const byName=new Map(),examNames=new Map(),links=new Map();
 for(const m of enrolled){
  const key=norm(m.name);
  if(!byName.has(key))byName.set(key,[]);
  byName.get(key).push(m);
 }
 for(const s of exam){
  const key=norm(s.name);
  examNames.set(key,(examNames.get(key)||0)+1);
 }
 let unmatchedExam=0;
 for(const s of exam){
  let member=null;
  if(s.classStudentId){
   member=memberIds.has(s.classStudentId)?enrolled.find(m=>m.id===s.classStudentId):null;
  }else{
   const candidates=byName.get(norm(s.name))||[];
   if(candidates.length===1&&examNames.get(norm(s.name))===1)member=candidates[0];
  }
  if(!member){unmatchedExam++;continue;}
  if(!links.has(member.id))links.set(member.id,[]);
  links.get(member.id).push(s);
 }
 const reasons=priv?.pendingReasonsV335||{};
 const result={enrolled:enrolled.length,active:0,recorded:0,excluded:0,
  unknown:0,makeup:0,paper_pending:0,ambiguous:0,unmatchedExam,missing:[]};
 for(const member of enrolled){
  if(member.participatesV258===false){result.excluded++;continue;}
  result.active++;
  const matches=links.get(member.id)||[];
  if(matches.length>1){
   result.ambiguous++;
   result.missing.push({id:member.id,name:member.name,reason:'unknown',
    examId:'',ambiguous:true,linked:false});
   continue;
  }
  const student=matches[0];
  if(student&&hasMarks(priv,student.id)){
   result.recorded++;continue;
  }
  const raw=reasons[member.id];
  const reason=REASONS.includes(raw)?raw:
   (student&&priv?.participationV210?.[student.id]==='makeup'?'makeup':'unknown');
  if(reason==='not_participating')result.excluded++;
  else result[reason]++;
  result.missing.push({id:member.id,name:member.name,reason,
   examId:student?.id||'',ambiguous:false,linked:!!student});
 }
 result.pending=result.unknown+result.makeup+result.paper_pending+result.ambiguous;
 return result;
}
// Pure presentation grouping: LE is a hint, not proof of which paper was written.
// Only explicitly assigned file keys count as confirmed exam versions.
function reviewGroups(members,priv,overview,versions){
 const people=Array.isArray(members)?members:[];
 const available=(versions||[]).filter(f=>f?.fileKey&&
  ['inclusion','inclusion_makeup','alternative'].includes(f.role));
 const byId=new Map(people.map(p=>[p.id,p]));
 const assignments=priv?.examFileAssignmentsV316||{};
 const fileFor=new Map();
 for(const person of people){
  const files=available.filter(f=>(assignments[f.fileKey]||[]).includes(person.id));
  fileFor.set(person.id,files);
 }
 const standardMissing=[],specialMissing=[],byClassId={};
 for(const row of overview?.missing||[]){
  const member=byId.get(row.id);
  const assigned=fileFor.get(row.id)||[];
  const le=!!member?.learningSupport;
  const entry={...row,le,assigned:assigned.length===1?assigned[0]:null,
   conflictingAssignment:assigned.length>1};
  byClassId[row.id]=entry;
  if(le||assigned.length)specialMissing.push(entry);
  else standardMissing.push(entry);
 }
 const activeStandard=people.filter(p=>p.participatesV258!==false&&
  !p.learningSupport&&!(fileFor.get(p.id)||[]).length);
 const notRecorded=new Set(standardMissing.map(s=>s.id));
 const regularRecorded=activeStandard.filter(p=>!notRecorded.has(p.id)).length;
 const pendingStandard=standardMissing.filter(s=>s.reason!=='not_participating').length;
 return {standardMissing,specialMissing,byClassId,regularActive:activeStandard.length,
  regularRecorded,pendingStandard,versions:available.filter(f=>
   f.role==='inclusion'||f.role==='inclusion_makeup')};
}
function normalizeReason(value){
 if(!REASONS.includes(value))throw Error('Unbekannter Teilnahme-Status.');
 return value;
}
function prepareEntries(summary){
 if(!summary||!Array.isArray(summary.missing))return [];
 return summary.missing.filter(s=>!s.linked&&!s.ambiguous&&
   ['makeup','paper_pending'].includes(s.reason));
}
function newOnlyLinks(proposals,priv){
 return Object.fromEntries((proposals||[]).map(row=>
  [row.rowIndex,row.studentId&&!hasMarks(priv,row.studentId)?row.studentId:'']));
}
const api={REASONS,norm,hasMarks,reconcile,reviewGroups,normalizeReason,prepareEntries,newOnlyLinks};
root.SchulcockpitMakeupRosterV335=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
