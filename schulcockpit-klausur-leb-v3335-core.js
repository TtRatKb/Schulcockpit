/* Schulcockpit V0.33.35 – pure confirmed exam-to-LEB linkage preview. */
'use strict';
const SC_EXAM_LEB_V3335=(function(){
 const mapStatus=s=>({'erreicht':'E','teilweise erreicht':'TE','noch nicht erreicht':'NNE'}[String(s||'').toLowerCase()]||'open');
 function preview({analysis,reports=[],participants=[],classRoster=[],selected=[]}={}){
  const errors=[],warnings=[],ids=new Set(selected),members=new Set(classRoster.map(s=>s.id));
  const rubrics=(analysis?.competencies||[]).filter(c=>ids.has(c.id));
  if(!rubrics.length)errors.push('Mindestens eine Rasterzeile auswählen.');
  const linked=new Map(),personByExam=new Map();
  for(const p of participants){
   const cid=String(p.classStudentId||'');
   if(!cid||!members.has(cid)){errors.push('Prüfungsteilnehmer ohne bestätigte Klassenlisten-ID: '+(p.id||'?'));continue;}
   if(linked.has(cid)){errors.push('Mehrere Prüfungszeilen verweisen auf dieselbe Klassenperson: '+cid);continue;}
   linked.set(cid,p.id);personByExam.set(p.id,{...p,classStudentId:cid});
  }
  const rows=[];
  for(const r of rubrics){
   const curriculumId=String(r.curriculumCompetencyId||'').trim();
   if(!curriculumId){errors.push('Rasterzeile '+r.id+' hat keine bestätigte Curriculum-ID.');continue;}
   const ratings=[];
   for(const report of reports){
    const p=personByExam.get(report.student?.id);if(!p)continue;
    const attendance=p.attendance||report.participationV210||'present';
    if(attendance!=='present'){ratings.push({studentId:p.classStudentId,status:attendance==='absent'?'absent':'open'});continue;}
    const cr=(report.competencies||[]).find(c=>c.id===r.id);
    ratings.push({studentId:p.classStudentId,status:report.complete&&cr?mapStatus(cr.status):'open',pct:cr?.pct??null});
   }
   rows.push({rubricId:r.id,curriculumId,text:r.text||curriculumId,ratings});
  }
  const duplicateIds=new Set();for(const row of rows)if(rows.filter(x=>x.curriculumId===row.curriculumId).length>1)duplicateIds.add(row.curriculumId);
  if(duplicateIds.size)warnings.push('Mehrere getrennte Rasterzeilen verwenden dieselbe Curriculum-ID. Sie bleiben getrennte Nachweise: '+[...duplicateIds].join(', '));
  return {ready:!errors.length,errors,warnings,rows};
 }
 return {mapStatus,preview};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_EXAM_LEB_V3335;
