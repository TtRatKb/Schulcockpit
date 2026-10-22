/* V0.24.5 – curriculum-supported selectable exam topics, holiday-oriented tentative dates. */
(function(root){
'use strict';
function tidyIds(x){return Array.isArray(x)?[...new Set(x.filter(v=>typeof v==='string'&&v.trim()))]:[];}
function topicsForCourse(sequences=[],topics=[]){
 const found=new Map();
 for(const q of sequences)found.set('seq:'+q.id,{id:'seq:'+q.id,title:q.title||'Reihe',origin:'Unterrichtsreihe',
  sequenceId:q.id,topicId:q.curriculumV202?.topicId||'',hours:(q.plan||[]).length,
  readiness:latestDate((q.plan||[]).map(u=>u.plannedDate))||q.endDate||''});
 const mapped=new Set([...found.values()].map(x=>x.topicId).filter(Boolean));
 for(const t of topics)if(!mapped.has(t.id))
   found.set('kc:'+t.id,{id:'kc:'+t.id,title:t.title,origin:'Curriculumthema',
    sequenceId:'',topicId:t.id,hours:0,readiness:''});
 return [...found.values()];
}
function dateShift(s,n){const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function days(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000);}
function latestDate(arr){return [...(arr||[])].filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')).sort().at(-1)||'';}
function isBreak(r){return /ferien|ferienzeit|semesterferien|holiday/i.test(String(r?.name||''));}
function semesterOK(date,half,year){
 const first=Number(String(year).slice(0,4));if(!first)return true;
 const boundary=String(first+1)+'-02-01';
 return Number(half)===1?date<boundary:date>=boundary;
}
function candidateDates({slots=[],ranges=[],sequences=[],topics=[],row={},rows=[],confirmed=[],today='',year='',free=()=>false}){
 const remaining=topicsForCourse(sequences,topics),byId=new Map(remaining.map(x=>[x.id,x]));
 const selected=[...tidyIds(row.primaryTopicIds),...tidyIds(row.supplementaryTopicIds)].map(id=>byId.get(id)).filter(Boolean);
 const readiness=latestDate(selected.map(x=>x.readiness));
 const breaks=ranges.filter(isBreak).map(r=>r.start).filter(Boolean);
 const reserved=new Set(confirmed.filter(Boolean));
 const other=(rows||[]).filter(r=>r.id!==row.id&&r.status!=='erledigt')
  .map(r=>r.confirmedDate||r.proposedDate).filter(Boolean);
 const candidates=[...new Set(slots.map(s=>s.date))].filter(date=>date>=(today||'0000-01-01')&&semesterOK(date,row.half,year)
    &&!reserved.has(date)&&!free(date)&&(!readiness||date>readiness));
 const scored=candidates.map(date=>{
   if(other.some(d=>Math.abs(days(date,d))<7))return null;
   const before=breaks.filter(b=>b>date).map(b=>days(date,b)).sort((a,b)=>a-b)[0];
   const gap=readiness?days(readiness,date):null;
   // A week or two before the break is preferred, NEVER an obligation.
   let score=0;
   if(Number.isFinite(before)){
     score+=before>=7&&before<=17?130-Math.abs(before-11)*4:
       before>=3&&before<=21?62-Math.abs(before-11)*2:0;
   }
   if(gap!==null)score+=gap>=7&&gap<=35?35:gap>=3?10:-25;
   else score-=12; // No dated teaching evidence: proposal is less certain.
   score-=Math.max(0,days(today||date,date))*0.03;
   if(row.proposedDate===date)score+=4; // prefer a manually entered date if still suitable
   return {date,score,untilBreak:before===undefined?null:before,
     readiness:readiness||'',needsReview:!readiness&&selected.length>0,
     reason:before>=7&&before<=17?'ca. 1–2 Wochen vor den Ferien':
       before>=3&&before<=21?'vor den nächsten Ferien':'regulärer freier Fachtermin'};
 }).filter(Boolean).sort((a,b)=>b.score-a.score||a.date.localeCompare(b.date));
 return scored.slice(0,12);
}
function selectedCoverage(row,topics){
 const available=new Set(topics.map(t=>t.id));
 const primary=tidyIds(row.primaryTopicIds),extra=tidyIds(row.supplementaryTopicIds);
 return {primary,extra,invalid:[...primary,...extra].filter(id=>!available.has(id)),
  duplicated:extra.filter(id=>primary.includes(id))};
}
function swapProposals(row){return {...row,proposedDate:row.alternativeDate||'',alternativeDate:row.proposedDate||'',
 status:row.status==='fest'?'fest':row.alternativeDate?'vorschlag':'offen'};}
const api={tidyIds,topicsForCourse,dateShift,days,latestDate,semesterOK,isBreak,candidateDates,selectedCoverage,swapProposals};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.SC_EXAM_TOPICS_V245=api;
})(typeof globalThis!=='undefined'?globalThis:this);
