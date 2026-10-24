/* Reine, personenbezugsfreie Berechnung: nachträglich als Bonus gewertete Aufgaben.
 * Die ursprüngliche Quelle und die ursprünglichen Ergebnisse bleiben unverändert. */
const SC_GRADING_V260=(function(){
'use strict';
function bonus(item){return !!item.bonusInsteadV260||String(item.source||'').endsWith('_bonus');}
function max(item){return Number(String(item.source||'').endsWith('_bonus')?item.bonusMax:item.regularMax)||0;}
function calculate(items,competencies,scoreFor,isLower,thresholds,statusFor){
  const groups=new Map((competencies||[]).map(c=>[c.id,{...c,regularMax:0,regularEarned:0,bonusEarned:0,itemLabels:[],auditV210:[]}]));
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
      if(isBonus)c.bonusEarned+=earned;
      else{c.regularEarned+=earned;c.regularMax+=mx;}
    }
    if(isBonus)totalBonusEarned+=earned;
    else{totalReg+=earned;totalMax+=mx;}
  }
  const competenceRows=[...groups.values()].map(c=>{
    const adjusted=Math.min(c.regularMax,c.regularEarned+c.bonusEarned);
    const pct=c.regularMax?adjusted/c.regularMax*100:null;
    return {...c,adjusted,pct,status:statusFor?statusFor(pct,thresholds):''};
  });
  // Klassen 5–7: Bonus nur innerhalb der betreffenden Kompetenz verrechnen.
  // Ab Klasse 8: Prüfung wird insgesamt benotet, Bonus gleicht global aus.
  const adjusted=isLower?competenceRows.reduce((s,c)=>s+c.adjusted,0):Math.min(totalMax,totalReg+totalBonusEarned);
  const totalBonusUsed=Math.max(0,adjusted-totalReg);
  return {competencies:competenceRows,itemsV260:itemRows,totalMax,totalReg,totalBonus:totalBonusUsed,
    totalBonusEarned,totalAdjusted:adjusted,totalBonusUsed,totalPct:totalMax?100*adjusted/totalMax:null,
    missing,complete:missing.length===0};
}
function validateScale(scale){
  if(!Array.isArray(scale)||scale.length!==5||scale.some(x=>x===''||x===null||x===undefined||!Number.isFinite(Number(x))))return false;
  const n=scale.map(Number);
  return n.every(x=>x>=0&&x<=100)&&n.every((x,i)=>i===0||n[i-1]>x);
}
function grade(pct,scale){
  if(!validateScale(scale)||pct===null||!Number.isFinite(Number(pct)))return '';
  for(let i=0;i<5;i++)if(Number(pct)+1e-9>=Number(scale[i]))return String(i+1);
  return '6';
}
return {bonus,max,calculate,validateScale,grade};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_GRADING_V260;
