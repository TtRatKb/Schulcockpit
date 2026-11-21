/* V0.33.20 – private, grade-neutral exam statistics and task-rule previews.
 * Never writes individual marks, percentages or inferred grades to storage.
 */
(function(root){
'use strict';
const base=typeof module!=='undefined'&&module.exports?
 require('./schulcockpit-bewertung-v260-core.js'):SC_GRADING_V260;
const grading=typeof module!=='undefined'&&module.exports?
 require('./schulcockpit-bewertung-v267-core.js'):SC_GRADING_V267;
const DEFAULT_SCALE=[91,81,66,50,25];
function fmt(n){
 return Number(n).toLocaleString('de-DE',{maximumFractionDigits:2});
}
function mode(item){
 return String(item?.source||'').endsWith('_bonus')||item?.bonusInsteadV260?'bonus':
  Number(item?.partialBonusV267?.max)>0?'partial':'regular';
}
function max(item){return base.max(item);}
function rule(analysis,id,choice,priv,belongs){
 if(!Array.isArray(analysis?.items)||!analysis.items.length)throw Error('Aufgabenraster fehlt.');
 const index=analysis.items.findIndex(it=>it.id===id);
 if(index<0)throw Error('Die Aufgabe gehört nicht zur aktuellen Prüfungsfassung.');
 const prior=analysis.items[index],newMode=String(choice?.mode||'');
 if(String(prior.source||'').endsWith('_bonus'))
  throw Error('Diese ursprünglich eigenständige Bonusfrage bleibt Bonus.');
 if(!['regular','bonus','partial'].includes(newMode))
  throw Error('Bitte eine gültige Aufgabenwertung wählen.');
 const updated={...prior};
 delete updated.bonusInsteadV260;delete updated.partialBonusV267;
 if(newMode==='bonus')updated.bonusInsteadV260=true;
 if(newMode==='partial'){
  const text=String(choice?.bonusMax??'').replace(',','.').trim();
  const part=text===''?NaN:Number(text);
  const maximum=Number(prior.regularMax);
  if(!Number.isFinite(part)||part<=0||part>=maximum||
    !Number.isInteger(Math.round(part*4))||Math.abs(part*4-Math.round(part*4))>1e-8)
   throw Error('Bonusanteil: 0,25-Punkte-Schritte, größer 0 und kleiner als '+fmt(maximum)+' P.');
  const description=String(choice?.description||'').trim();
  if(description.length>150)throw Error('Die Bonuslücken-Bezeichnung ist zu lang.');
  updated.partialBonusV267={max:part,description};
 }
 const oldSplit=JSON.stringify(prior.partialBonusV267||null);
 const newSplit=JSON.stringify(updated.partialBonusV267||null);
 if(oldSplit!==newSplit&&(priv?.roster||[]).some(st=>
  (typeof belongs!=='function'||belongs(st))&&
  priv.gradingOverridesV267?.[st.id]?.[id]?.bonusEarned!==undefined))
  throw Error('Bei dieser Aufgabe sind bereits individuelle Bonuslücken bewertet. Diese zuerst überprüfen; die gespeicherten Aufteilungen werden nicht überschrieben.');
 const items=analysis.items.map((it,i)=>i===index?updated:it);
 const total=items.reduce((sum,it)=>sum+(mode(it)==='bonus'?0:
  max(it)-(mode(it)==='partial'?Number(it.partialBonusV267.max):0)),0);
 if(!(total>0))throw Error('Mindestens eine regulär gewertete Aufgabe muss übrig bleiben.');
 return {analysis:{...analysis,items},changed:JSON.stringify(updated)!==JSON.stringify(prior),
  previous:prior,item:updated,regularMax:total};
}
function effectiveScale(scale){
 return base.validateScale(scale)?scale.map(Number):[...DEFAULT_SCALE];
}
function summary({reports,analysis,priv,scale,scoreFor,grade,variant='standard'}){
 const histogram=[0,0,0,0,0,0],near=[],students=[],included=new Set();
 const selected=effectiveScale(scale);
 const actualScale=base.validateScale(scale);
 let pending=0,excluded=0,total=0,percentSum=0,close=0;
 for(const report of reports||[]){
  const st=report?.student,id=st?.id;
  if(!id||included.has(id))continue;
  included.add(id);
  const status=String(priv?.participationV210?.[id]||'present');
  const noParticipation=['absent','makeup','not_participating','not-participating'].includes(status)||
   (variant==='standard'&&status==='variant');
  if(noParticipation||report?.assessmentVariantProblemV317){
   excluded++;continue;
  }
  // Preview rules can complete (or reopen) a previously incomplete report;
  // always calculate on the proposed rubric rather than trusting old flags.
  if(report.learningSupportV235&&variant==='standard'){excluded++;continue;}
  const computed=grading.compute(analysis?.items||[],analysis?.competencies||[],
    item=>scoreFor(priv,id,item),priv?.gradingOverridesV267?.[id]||{},
    Number(grade)<8,analysis?.thresholds||{},()=>null);
  if(!computed.complete||!(computed.totalMax>0)||
    !Number.isFinite(Number(computed.totalAdjusted))){pending++;continue;}
  const points=Math.min(computed.totalMax,computed.totalAdjusted);
  const n=Number(base.grade(computed.totalPct,selected,points,computed.totalMax));
  if(!Number.isInteger(n)||n<1||n>6){pending++;continue;}
  histogram[n-1]++;total++;
  percentSum+=Number(computed.totalPct)||0;
  let next=null;
  if(n>1){
   const cutoff=base.cutoffPoints(computed.totalMax,selected[n-2]);
   const difference=Math.round((cutoff-points)*100)/100;
   if(difference>0&&difference<=1){
    next={grade:n-1,points:difference};
    near.push({id,grade:n,nextGrade:n-1,points:difference});
    close++;
   }
  }
  students.push({id,grade:n,points,maximum:computed.totalMax,
   pct:Number(computed.totalPct)||0,next});
 }
 return {histogram,done:total,pending,excluded,near,students,
  average:total?percentSum/total:null,bad:histogram[4]+histogram[5],
  scale:selected,scaleStored:actualScale,close};
}
const api={DEFAULT_SCALE,mode,max,rule,effectiveScale,summary,fmt};
root.SchulcockpitGradeMirrorV3320Core=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
