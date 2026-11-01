/* V0.27.0 – Prüfungssicherheit: Nachweise nur aus expliziter Ist-Dokumentation.
   Reine Berechnung, ohne personenbezogene Daten. */
const SC_EXAM_COVERAGE_V270=(function(){
'use strict';
function assess(targetIds,units,lessons,examDate){
 const rows=[];
 for(const id of [...new Set(targetIds||[])]){
  const relatedUnits=(units||[]).filter(x=>(x.competencyIdsV202||[]).includes(id)&&!x.skippedThisYearV201);
  const relatedLessons=(lessons||[]).filter(l=>l.date&&l.date<examDate&&l.classId&&
    (l.actualV270?.securedIds?.includes(id)||l.actualV270?.coveredIds?.includes(id)));
  const secured=relatedLessons.filter(l=>l.actualV270?.securedIds?.includes(id));
  const covered=relatedLessons.filter(l=>l.actualV270?.coveredIds?.includes(id));
  const scheduled=relatedUnits.filter(x=>x.plannedDate&&x.plannedDate<examDate);
  const heldUnconfirmed=(lessons||[]).filter(l=>l.date&&l.date<examDate&&l.heldV270&&
    !l.actualV270?.securedIds?.includes(id)&&!l.actualV270?.coveredIds?.includes(id)&&
    relatedUnits.some(u=>u.id===l.planReference?.unitId||
      (u.id===l.unitId&&u.id)));
  let status='missing';
  if(secured.length)status='secured';
  else if(covered.length)status='covered';
  else if(heldUnconfirmed.length)status='unconfirmed';
  else if(scheduled.length)status='planned';
  rows.push({id,status,evidence:secured.length?secured:covered.length?covered:heldUnconfirmed,
   plannedDates:scheduled.map(x=>x.plannedDate),needsTeacherCheck:status!=='secured'});
 }
 return rows;
}
function briefing(rows){
 const counts={secured:0,covered:0,unconfirmed:0,planned:0,missing:0};
 for(const r of rows||[])if(Object.hasOwn(counts,r.status))counts[r.status]++;
 return {counts,ready:!!rows?.length&&counts.secured===rows.length,
   issues:(rows||[]).filter(r=>r.needsTeacherCheck)};
}
function statusLabel(s){return ({secured:'Gesichert ✓',covered:'Behandelt – Sicherung offen',
  unconfirmed:'Soll/Ist noch nicht geprüft',planned:'Bis zur Arbeit geplant',
  missing:'Nicht zugeordnet'})[s]||'Offen';}
return {assess,briefing,statusLabel};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_EXAM_COVERAGE_V270;