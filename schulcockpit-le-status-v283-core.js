/* V0.28.3 – LE scores are independent of zieldifferente Beurteilung.
 * Pure report transformation; no mutation of raw scores, overrides or roster. */
const SC_LE_STATUS_V283=(function(){
'use strict';
const isLeMessage=s=>/^\s*LE\s*[:·–-]/i.test(String(s||''));
function clarify(report){
 if(!report?.learningSupportV235)return report;
 const scoreMissing=(report.missing||[]).filter(s=>!isLeMessage(s));
 const scoreComplete=!!report.complete&&!scoreMissing.length;
 return {
  ...report,
  learningSupportV235:true,
  scoreCompleteV283:scoreComplete,
  scoreMissingV283:scoreMissing,
  // Class-wide regular E/TE/NNE sheets are not substitutes for a separately
  // decided zieldifferente Beurteilung. This must remain true after v260/v267.
  complete:false,
  missing:[...scoreMissing,'LE: zieldifferente Bewertung separat ausstehend'],
  totalPct:null,
  gradeV260:'',
  gradeAutoV260:'',
  gradeIsManualV260:false,
  competencies:(report.competencies||[]).map(c=>({
   ...c,pct:null,status:'noch nicht zieldifferent bewertet'
  }))
 };
}
return {clarify};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_LE_STATUS_V283;
