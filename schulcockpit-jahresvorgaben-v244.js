/* V0.24.4 – assessment instances and curriculum coverage checks. */
(function(root){
'use strict';
const KINDS=['klassenarbeit','klausur','ersatzleistung','fachleistung','test'];
const STATUSES=['offen','vorschlag','fest','erledigt'];
function isoValid(x){
 if(!x)return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;
 const d=new Date(x+'T12:00:00');
 return Number.isFinite(d.getTime())&&
  [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')===x;
}
function tidy(row){
 const o=row||{},type=KINDS.includes(o.type)?o.type:'klassenarbeit';
 return {id:String(o.id||''),half:Number(o.half)||1,type,
  topic:String(o.topic||'').trim().slice(0,420),
  note:String(o.note||'').trim().slice(0,700),
  autoTopicV245:String(o.autoTopicV245||'').slice(0,420),
  status:STATUSES.includes(o.status)?o.status:'offen',
  proposedDate:String(o.proposedDate||''),alternativeDate:String(o.alternativeDate||''),
  confirmedDate:String(o.confirmedDate||''),assessmentId:String(o.assessmentId||''),
  sequenceIds:Array.isArray(o.sequenceIds)?[...new Set(o.sequenceIds.map(String))]:[],
  primaryTopicIds:Array.isArray(o.primaryTopicIds)?[...new Set(o.primaryTopicIds.filter(x=>typeof x==='string'))]:[],
  supplementaryTopicIds:Array.isArray(o.supplementaryTopicIds)?[...new Set(o.supplementaryTopicIds.filter(x=>typeof x==='string'))]:[],
  mode:['offen','classtime','papier','praesentation','sonstiges'].includes(o.mode)?o.mode:'offen'
 };
}
function checkRows(rows,year){
 const errors=[],ids=new Set();
 if(!Array.isArray(rows)||rows.length>20)return ['Maximal 20 einzelne Leistungsnachweise pro Kurs/Jahr.'];
 const yearStart=Number(String(year).slice(0,4));
 for(const [idx,raw] of rows.entries()){
  const r=tidy(raw),label='Nachweis '+(idx+1);
  if(!r.id||ids.has(r.id))errors.push(label+': ID fehlt oder kommt mehrfach vor.');ids.add(r.id);
  if(![1,2].includes(r.half))errors.push(label+': Halbjahr muss 1 oder 2 sein.');
  if(!r.topic&&r.status==='fest')errors.push(label+': Für einen verbindlichen Nachweis fehlt der Prüfungsstoff.');
  for(const key of ['proposedDate','alternativeDate','confirmedDate']){
   if(!isoValid(r[key]))errors.push(label+': ungültiger '+key+'-Termin.');
   else if(r[key]&&yearStart&&(Number(r[key].slice(0,4))<yearStart||Number(r[key].slice(0,4))>yearStart+1))
    errors.push(label+': Termin liegt außerhalb des Schuljahres.');
  }
  if(r.status==='fest'&&(!r.confirmedDate||!r.assessmentId))errors.push(label+': Fester Termin braucht Datum und Prüfungsdatensatz.');
  if(r.status!=='fest'&&r.confirmedDate&&r.assessmentId)errors.push(label+': Mit festem Termin verknüpft, aber als Entwurf markiert.');
  if(r.alternativeDate&&r.proposedDate===r.alternativeDate)errors.push(label+': Alternativtermin ist identisch.');
  if(r.supplementaryTopicIds.some(id=>r.primaryTopicIds.includes(id)))errors.push(label+': Hauptthema und Zusatzthema dürfen nicht identisch sein.');
 }
 return errors;
}
function auditPlan({sequences=[],assessments=[],topics=[],methods=[],currentSequences=[],plannedExams=[]}={}){
 const incoming=Array.isArray(sequences)?sequences:[],rows=incoming.flatMap(q=>(q.units||[]).map(u=>({unit:u,seq:q})));
 const base=Array.isArray(currentSequences)?currentSequences:[],topicById=new Map(topics.map(t=>[t.id,t]));
 const topicMap=new Map(),methodMap=new Map(methods.filter(m=>m.sourceComplete!==false).map(m=>[m.id,m]));
 for(const t of topics)for(const c of t.competencies||[])topicMap.set(c.id,t.id);
 const foundMethods=new Set(),foundContent=new Set(),wrongIds=[],missingTopics=[],resourceNeeds=[];
 for(const pair of [...rows,...base.flatMap(q=>(q.units||q.plan||[]).map(u=>({unit:u,seq:q}))) ]){
  const q=pair.seq,u=pair.unit;
  const ids=[...(u.competencyIds||[]),...(u.competencyIdsV202||[])];
  const mids=[...(u.methodIds||[])];
  for(const id of ids){
   if(methodMap.has(id))foundMethods.add(id);
   else if(topicMap.has(id))foundContent.add(id);
   else if(!wrongIds.includes(id))wrongIds.push(id);
  }
  for(const id of mids)if(methodMap.has(id))foundMethods.add(id);else if(!wrongIds.includes(id))wrongIds.push(id);
  const needs=String(u.resourcesNeeded||'').trim();
  if(needs)resourceNeeds.push({sequence:q.title,unit:u.title,needs});
 }
 for(const q of incoming)if(q.topicId&&!topicById.has(q.topicId))missingTopics.push(q.title+': '+q.topicId);
 const target=plannedExams.filter(x=>x.status!=='fest'&&x.status!=='erledigt');
 const proposed=new Map((assessments||[]).map(x=>[x.planId,x]));
 const unmatchedExams=target.filter(r=>!proposed.has(r.id)).map(r=>r.topic||r.id);
 const unknownExams=(assessments||[]).filter(r=>!plannedExams.some(p=>p.id===r.planId)).map(r=>r.planId);
 return {missingMethods:[...methodMap.values()].filter(m=>!foundMethods.has(m.id)),
  methodTotal:methodMap.size,methodScheduled:foundMethods.size,
  mappedContent:foundContent.size,missingTopics,invalidIds:wrongIds,
  unmatchedExams,unknownExams,resourcesNeeded:resourceNeeds};
}
function deriveTopicId(ids,topics){
 const values=[...new Set(ids||[])].filter(Boolean);
 if(!values.length)return '';
 const mapped=topics.filter(t=>(t.competencies||[]).some(c=>values.includes(c.id)));
 return mapped.length===1?mapped[0].id:'';
}
function conflictOnFixedDate(date,cid,assessments=[],lessons=[],isProtected=()=>false){
 return {existing:assessments.filter(a=>a.classId===cid&&a.date===date),
  protectedLessons:lessons.filter(l=>l.classId===cid&&l.date===date&&isProtected(l))};
}
const api={KINDS,STATUSES,isoValid,tidy,checkRows,auditPlan,deriveTopicId,conflictOnFixedDate};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.SC_YEAR_RULES_V244=api;
})(typeof globalThis!=='undefined'?globalThis:this);
