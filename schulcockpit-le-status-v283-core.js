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
  // Keep the separate pedagogical zieldifferente Beurteilung pending.
  // But do not erase E/TE/NNE that v267 already computed using this child's
  // individual bonus/exclusion/split rules and the resulting regular maxima.
  complete:false,
  missing:[...scoreMissing,'LE: zieldifferente Beurteilung separat'],
  totalPct:null,
  gradeV260:'',
  gradeAutoV260:'',
  gradeIsManualV260:false,
  competencies:(report.competencies||[]).map(c=>{
   if(!scoreComplete&&!c.bonusOnly)return {...c,pct:null,status:'noch offen'};
   // Bonus-only competencies have no regular denominator and may not be
   // labelled E/TE/NNE. Neither source report nor stored scores are mutated.
   if(c.bonusOnly||!(Number(c.regularMax)>0))return {...c,pct:null,status:''};
   return {...c};
  })
 };
}
return {clarify};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_LE_STATUS_V283;
