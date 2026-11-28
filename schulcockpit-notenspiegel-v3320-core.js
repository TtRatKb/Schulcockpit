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
function scoreNumber(value){
 if(value===null||value===undefined||String(value).trim()==='')return null;
 const s=String(value).trim();if(!/^\d+(?:[.,]\d+)?$/.test(s))return NaN;
 return Number(s.replace(',','.'));
}
function issuesFor(analysis,priv,id,scoreFor){
 const issues=[],changes=priv?.gradingOverridesV267?.[id]||{};
 for(const item of analysis?.items||[]){
  const c=changes[item.id]||{},label=item.label||item.id,mx=max(item),raw=scoreNumber(scoreFor(priv,id,item));
  if(c.mode==='exclude')continue;
  const add=(reason,field='score')=>issues.push({itemId:item.id,label,reason,field});
  if(!(mx>0)){add('Maximalpunkte fehlen oder sind ungültig.');continue;}
  if(raw===null){
   const grouped=priv?.groupReviewV3338?.[id]?.[item.id];
   add(grouped?'Sammelfrage '+grouped.question+': '+grouped.message:'Punktwert fehlt (auch 0 muss ausdrücklich gespeichert sein).');continue;
  }
  if(!Number.isFinite(raw)||raw<0||raw>mx+1e-9){add('Punktwert ungültig; erlaubt sind 0 bis '+fmt(mx)+' Punkte.');continue;}
  if(mode(item)==='partial'&&c.mode!=='bonus'){
   const part=Number(item.partialBonusV267.max),entered=scoreNumber(c.bonusEarned);
   const lo=Math.max(0,raw-(mx-part)),hi=Math.min(raw,part);
   if(entered===null)add('Bonusanteil fehlt; bei '+fmt(raw)+' Gesamtpunkten sind '+fmt(lo)+'–'+fmt(hi)+' Bonuspunkte möglich.','bonus');
   else if(!Number.isFinite(entered)||entered<lo-1e-9||entered>hi+1e-9||Math.abs(entered*4-Math.round(entered*4))>1e-8)
    add('Bonusanteil passt nicht zur Gesamtpunktzahl (zulässig: '+fmt(lo)+'–'+fmt(hi)+' P.).','bonus');
  }
 }
 return issues;
}
function taskAnalysis(analysis,priv,ids,scoreFor){
 return (analysis?.items||[]).filter(it=>mode(it)!=='bonus').map(it=>{
  const original=max(it),part=mode(it)==='partial'?Number(it.partialBonusV267.max):0,reg=original-part;
  let count=0,zero=0,sum=0,open=0,ignored=0;
  for(const id of ids){
   const c=priv?.gradingOverridesV267?.[id]?.[it.id]||{};
   if(['exclude','bonus'].includes(c.mode)){ignored++;continue;}
   const v=scoreNumber(scoreFor(priv,id,it));
   if(v===null||!Number.isFinite(v)||v<0||v>original+1e-9){open++;continue;}
   let value=v;
   if(part){const b=scoreNumber(c.bonusEarned);if(b===null||!Number.isFinite(b)||b<Math.max(0,v-reg)||b>Math.min(v,part)){open++;continue;}value-=b;}
   count++;if(value===0)zero++;sum+=value;
  }
  const remaining=(analysis.items||[]).filter(x=>x.id!==it.id&&x.competencyId===it.competencyId&&mode(x)!=='bonus');
  return {id:it.id,label:it.label||it.id,taskText:it.taskText||'',count,open,ignored,zero,zeroPct:count?100*zero/count:null,averagePct:count&&reg>0?100*sum/count/reg:null,remaining:remaining.length,remainingMax:remaining.reduce((s,x)=>s+max(x)-(mode(x)==='partial'?Number(x.partialBonusV267.max):0),0),competency:(analysis.competencies||[]).find(c=>c.id===it.competencyId)?.text||it.competencyId||'Unzugeordnet'};
 }).sort((a,b)=>(b.zeroPct??-1)-(a.zeroPct??-1));
}
function summary({reports,analysis,priv,scale,scoreFor,grade,variant='standard'}){
 const histogram=[0,0,0,0,0,0],near=[],students=[],included=new Set(),pendingRows=[],excludedRows=[],eligibleIds=[];
 const selected=effectiveScale(scale);
 const actualScale=base.validateScale(scale);
 let pending=0,excluded=0,total=0,percentSum=0,gradeSum=0,close=0,awaiting=0,unassigned=0;
 for(const report of reports||[]){
  const st=report?.student,id=st?.id;
  if(!id||included.has(id))continue;
  included.add(id);
  const status=String(priv?.participationV210?.[id]||'present');
  const active=priv?.activeVariantV300?.[id]||'standard',file=priv?.examFileV317?.[id]||report.examFileV317||'';
  const other=variant==='standard'?(status==='variant'||!!file||active!=='standard'||report.learningSupportV235):
   (file?'file:'+file!==variant:active!=='standard'&&active!==variant);
  if(other){excluded++;excludedRows.push({id,reason:'Andere / zieldifferente Prüfungsfassung'});continue;}
  if(report?.assessmentVariantProblemV317){excluded++;unassigned++;excludedRows.push({id,reason:'Prüfungszuordnung klären: '+report.assessmentVariantProblemV317});continue;}
  if(['absent','makeup','not_participating','not-participating'].includes(status)){
   excluded++;if(status==='makeup')awaiting++;
   excludedRows.push({id,reason:status==='makeup'?'Schreibt nach':status==='absent'?'Nicht mitgeschrieben / abwesend':'Nimmt nicht teil'});continue;
  }
  eligibleIds.push(id);
  const computed=grading.compute(analysis?.items||[],analysis?.competencies||[],
    item=>scoreFor(priv,id,item),priv?.gradingOverridesV267?.[id]||{},
    Number(grade)<8,analysis?.thresholds||{},()=>null);
  const issues=issuesFor(analysis,priv,id,scoreFor);
  if(!computed.complete||issues.length||!(computed.totalMax>0)||
    !Number.isFinite(Number(computed.totalAdjusted))){
   if(!issues.length)issues.push({reason:!(computed.totalMax>0)?'Keine regulären Maximalpunkte vorhanden.':'Bewertung noch nicht vollständig berechenbar.',field:'review'});
   pending++;pendingRows.push({id,issues});continue;
  }
  const points=Math.min(computed.totalMax,computed.totalAdjusted);
  const n=Number(base.grade(computed.totalPct,selected,points,computed.totalMax));
  if(!Number.isInteger(n)||n<1||n>6){pending++;pendingRows.push({id,issues:[{reason:'Notenschlüssel prüfen.',field:'review'}]});continue;}
  histogram[n-1]++;total++;gradeSum+=n;
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
  average:total?percentSum/total:null,averageGrade:total?gradeSum/total:null,bad:histogram[4]+histogram[5],
  badPct:total?100*(histogram[4]+histogram[5])/total:null,expected:total+pending+awaiting,
  provisional:!!(pending||awaiting||unassigned),awaiting,unassigned,pendingRows,excludedRows,
  tasks:taskAnalysis(analysis,priv,eligibleIds,scoreFor),scale:selected,scaleStored:actualScale,close};
}
const api={DEFAULT_SCALE,mode,max,rule,effectiveScale,summary,fmt};
root.SchulcockpitGradeMirrorV3320Core=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
