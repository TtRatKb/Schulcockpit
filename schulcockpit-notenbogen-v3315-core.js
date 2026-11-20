/* V0.33.15 – Grade 8+ A4 task and point-sheet layout model.
 * Pure functions, no names and no changes to original/student marks.
 */
(function(root){
'use strict';
function n(value){return Number.isFinite(Number(value))?Number(value):0;}
function showPoints(value){
 return value===null||value===undefined?'–':
  (Math.round(Number(value)*100)/100).toLocaleString('de-DE',{maximumFractionDigits:2});
}
function taskRows(items){
 const rows=[],bySplit=new Map();
 for(const it of items||[]){
  const id=String(it.id||''),match=id.match(/^(.*)::(regular|bonus)V267$/);
  const key=match?match[1]:null;
  let row=key?bySplit.get(key):null;
  if(!row){
   let label=String(it.label||it.id||'Aufgabe');
   if(match)label=label.replace(/\s*·\s*(?:regulär|Bonus(?:\s*\(.*\))?)\s*$/i,'');
   row={id:key||id,label,regularMax:0,regularEarned:0,
    bonusMax:0,bonusEarned:0,hasRegular:false,hasBonus:false,
    excluded:false,open:false,note:''};
   rows.push(row);
   if(key)bySplit.set(key,row);
  }
  if(it.excluded){
   row.excluded=true;
   row.note='nicht gewertet';
   continue;
  }
  const max=n(it.max),valid=it.earned!==undefined&&it.earned!==null&&
    String(it.earned).trim()!==''&&Number.isFinite(Number(it.earned));
  if(it.bonus){
   row.hasBonus=true;row.bonusMax+=max;
   if(valid)row.bonusEarned+=n(it.earned);else row.open=true;
   if(match){
    const tail=String(it.label||'').match(/·\s*Bonus\s*\(([^)]+)\)\s*$/i);
    if(tail)row.note='Bonus: '+tail[1];
   }
  }else{
   row.hasRegular=true;row.regularMax+=max;
   if(valid)row.regularEarned+=n(it.earned);else row.open=true;
  }
 }
 return rows;
}
function cutoffPoints(totalMax,percent){
 const threshold=Number(totalMax)*Number(percent)/100;
 return Math.ceil((threshold-1e-10)*100)/100;
}
function gradeBoundaries(totalMax,scale){
 const values=scale?.map(Number);
 if(!Array.isArray(values)||values.length!==5||!Number(totalMax)||
   values.some((x,i)=>!Number.isFinite(x)||x<0||x>100||
   i>0&&x>=values[i-1]))return [];
 return values.map((percentage,i)=>({
  grade:String(i+1),percent:percentage,
  points:cutoffPoints(totalMax,percentage),
  label:'ab '+showPoints(percentage)+' %',
  pointsLabel:'ab '+showPoints(cutoffPoints(totalMax,percentage))+' P.'
 })).concat({
  grade:'6',percent:values[4],points:cutoffPoints(totalMax,values[4]),
  label:'unter '+showPoints(values[4])+' %',
  pointsLabel:'unter '+showPoints(cutoffPoints(totalMax,values[4]))+' P.'
 });
}
function scaleForReport(report,exam,priv){
 const key=String(report?.examFileV317||'');
 return key?(priv?.variantGradeScalesV3310?.[key]||null):
   exam?.gradeScaleV260||null;
}
const api={taskRows,gradeBoundaries,scaleForReport,cutoffPoints,showPoints};
root.SchulcockpitGradeSheetV3315=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
