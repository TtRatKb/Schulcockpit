/* Reine, personenbezugsfreie Berechnung: nachträglich als Bonus gewertete Aufgaben.
 * Die ursprüngliche Quelle und die ursprünglichen Ergebnisse bleiben unverändert. */
const SC_GRADING_V260=(function(){
'use strict';
function bonus(item){return !!item.bonusInsteadV260||String(item.source||'').endsWith('_bonus');}
function max(item){return Number(String(item.source||'').endsWith('_bonus')?item.bonusMax:item.regularMax)||0;}
function calculate(items,competencies,scoreFor,isLower,thresholds,statusFor){
  const groups=new Map((competencies||[]).map(c=>[c.id,{...c,regularMax:0,regularEarned:0,bonusMax:0,bonusEarned:0,itemLabels:[],auditV210:[]}]));
  const missing=[],itemRows=[];let totalMax=0,totalReg=0,totalBonusEarned=0;
  for(const it of items||[]){
    const c=groups.get(it.competencyId),isBonus=bonus(it),mx=max(it),raw=scoreFor(it);
    if(raw===null||raw===undefined||raw==='')missing.push(it.label||it.id);
    const valid=raw!==null&&raw!==undefined&&raw!==''&&Number.isFinite(Number(raw));
    const earned=valid?Math.min(mx,Math.max(0,Number(raw))):0;
    itemRows.push({id:it.id,label:it.label||it.id,source:it.source,bonus:isBonus,earned:valid?earned:null,max:mx});
    if(c){
      c.itemLabels.push(it.label||it.id);
      c.auditV210.push({label:it.label||it.id,source:isBonus?'classtime_bonus':it.source,earned:valid?earned:null,max:mx});
      if(isBonus){c.bonusEarned+=earned;c.bonusMax+=mx;}
      else{c.regularEarned+=earned;c.regularMax+=mx;}
    }
    if(isBonus)totalBonusEarned+=earned;
    else{totalReg+=earned;totalMax+=mx;}
  }
  const competenceRows=[...groups.values()].map(c=>{
    const adjusted=Math.min(c.regularMax,c.regularEarned+c.bonusEarned);
    const pct=c.regularMax?adjusted/c.regularMax*100:null;
    return {...c,adjusted,pct,bonusOnly:c.regularMax===0&&c.bonusMax>0,
      status:statusFor?statusFor(pct,thresholds):''};
  });
  // Kompetenzen werden weiterhin nur anhand ihrer EIGENEN Aufgaben bewertet
  // (kein fremder Bonus darf eine andere Kompetenz von NNE auf E heben).
  // Die Gesamtpunkte sind jedoch die tatsächlich erworbenen REGULÄREN + BONUS-
  // Punkte bei unverändertem, ausschließlich regulärem Nenner. Eine rein über
  // Bonus geprüfte Unterkompetenz darf keine bereits erzielten Punkte verlieren.
  // Über 100 % hinausgehende Zusatzpunkte bleiben als erzielt sichtbar.
  const totalEarned=totalReg+totalBonusEarned;
  const adjusted=Math.min(totalMax,totalEarned);
  const totalBonusUsed=Math.max(0,adjusted-totalReg);
  const totalBonusUnused=Math.max(0,totalBonusEarned-totalBonusUsed);
  return {competencies:competenceRows,itemsV260:itemRows,totalMax,totalReg,totalBonus:totalBonusUsed,
    totalBonusEarned,totalEarned,totalBonusUnused,totalAdjusted:adjusted,totalBonusUsed,
    totalPct:totalMax?100*adjusted/totalMax:null,
    missing,complete:missing.length===0};
}
function validateScale(scale){
  if(!Array.isArray(scale)||scale.length!==5||scale.some(x=>x===''||x===null||x===undefined||!Number.isFinite(Number(x))))return false;
  const n=scale.map(Number);
  return n.every(x=>x>=0&&x<=100)&&n.every((x,i)=>i===0||n[i-1]>x);
}
// Teacher-facing grade boundaries must be achievable quarter-point values.
 // Round DOWN to the next 0.25 point (e.g. 22.44 -> 22.25).
 // All grade calculation and PDF cutoffs use this same pure function.
const POINT_STEP_V3317=0.25;
function cutoffPoints(totalMax,percent){
 const maxPoints=Number(totalMax),percentage=Number(percent);
 if(!(maxPoints>0)||!Number.isFinite(percentage)||percentage<0||percentage>100)return null;
 const scaled=maxPoints*percentage/100/POINT_STEP_V3317;
 return Math.max(0,Math.floor(scaled+1e-9)*POINT_STEP_V3317);
}
function grade(pct,scale,earnedPoints,totalMax){
  if(!validateScale(scale)||pct===null||!Number.isFinite(Number(pct)))return '';
  const hasPoints=earnedPoints!==null&&earnedPoints!==undefined&&earnedPoints!==''&&
    Number.isFinite(Number(earnedPoints))&&Number.isFinite(Number(totalMax))&&Number(totalMax)>0;
  // The third and fourth args are supplied by all actual classwork report
  // paths. Keep two-argument support for older percentage-only call sites.
  if(hasPoints){
    for(let i=0;i<5;i++){
      const cutoff=cutoffPoints(totalMax,scale[i]);
      if(Number(earnedPoints)+1e-9>=cutoff)return String(i+1);
    }
  }else{
    for(let i=0;i<5;i++)if(Number(pct)+1e-9>=Number(scale[i]))return String(i+1);
  }
  return '6';
}
return {bonus,max,calculate,validateScale,grade,cutoffPoints,POINT_STEP_V3317};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_GRADING_V260;
