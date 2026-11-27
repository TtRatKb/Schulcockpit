/* Schulcockpit V0.33.34 – pure private LEB competency ratings. */
'use strict';
const SC_LEB_COMPETENCIES_V3334=(function(){
 const ALLOWED=new Set(['E','TE','NNE','open','absent','not_assessable']);
 function blank(classId){return {assessmentId:'__sc_leb_comp_v3334__:'+classId,
  schema:'schulcockpit.private-leb-competencies.v1',classId,activated:false,
  approval:{confirmedAt:'',deviceApproved:false},ratings:{},updatedAt:''};}
 function validate(rec,roster=[],evidence=[]){
  if(rec?.schema!=='schulcockpit.private-leb-competencies.v1'||!rec.classId)throw Error('Ungültiger privater LEB-Datensatz.');
  const students=new Set(roster.map(s=>s.id)),proofs=new Set(evidence.map(e=>e.id));
  for(const [eid,rows] of Object.entries(rec.ratings||{})){
   if(!proofs.has(eid))throw Error('Bewertung verweist auf unbekannten Nachweis.');
   for(const [sid,r] of Object.entries(rows||{})){
    if(!students.has(sid))throw Error('Bewertung verweist auf unbekannte Schüler-ID.');
    if(!ALLOWED.has(r?.status))throw Error('Ungültiger Kompetenzstatus.');
   }
  }
  return true;
 }
 function setRating(rec,evidenceId,studentId,status,note='',date=''){
  if(!rec?.activated)throw Error('Private Kompetenzbewertung ist noch nicht aktiviert.');
  if(!evidenceId||!studentId||!ALLOWED.has(status))throw Error('Nachweis, Schüler-ID oder Status ist ungültig.');
  rec.ratings=rec.ratings||{};rec.ratings[evidenceId]=rec.ratings[evidenceId]||{};
  const old=rec.ratings[evidenceId][studentId],history=[...(old?.history||[])];
  if(old?.status&&old.status!==status)history.push({status:old.status,note:old.note||'',date:old.date||'',changedAt:new Date().toISOString()});
  rec.ratings[evidenceId][studentId]={status,note:String(note||'').trim().slice(0,400),
   date:String(date||'').slice(0,10),updatedAt:new Date().toISOString(),history};return rec;
 }
 function summary(rec,evidence,studentIds=[]){
  const rows=studentIds.map(id=>rec?.ratings?.[evidence.id]?.[id]?.status||'open');
  const counts={E:0,TE:0,NNE:0,open:0,absent:0,not_assessable:0};rows.forEach(x=>counts[x]++);
  return {...counts,total:studentIds.length,allAssessed:studentIds.length>0&&rows.every(x=>['E','TE','NNE'].includes(x))};
 }
 function latestForCompetency(rec,evidence=[],studentId,competencyId){
  return evidence.filter(e=>e.competencyId===competencyId&&e.status==='done').map(e=>({e,r:rec?.ratings?.[e.id]?.[studentId]})).filter(x=>x.r).sort((a,b)=>String(b.r.date||b.r.updatedAt).localeCompare(String(a.r.date||a.r.updatedAt)))[0]||null;
 }
 return {ALLOWED,blank,validate,setRating,summary,latestForCompetency};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_LEB_COMPETENCIES_V3334;
