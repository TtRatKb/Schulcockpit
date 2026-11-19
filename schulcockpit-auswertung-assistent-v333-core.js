/* Schulcockpit V0.33.3 – pure assessment view/bonus decisions.
 * No student records or original Classtime scores are changed here. */
(function(root){
'use strict';
function number(value){
  if(value===null||value===undefined||value==='')return NaN;
  return Number(String(value).replace(',','.'));
}
function max(item){
  const source=String(item?.source||'');
  return number(source.endsWith('_bonus')?item?.bonusMax:item?.regularMax);
}
function mode(item){
  if(String(item?.source||'').endsWith('_bonus'))return 'original_bonus';
  if(item?.bonusInsteadV260)return 'bonus';
  if(number(item?.partialBonusV267?.max)>0)return 'partial';
  return 'regular';
}
function effective(item){
  const total=max(item),m=mode(item);
  const split=m==='partial'?number(item.partialBonusV267.max):0;
  const bonus=m==='original_bonus'||m==='bonus'?total:m==='partial'?split:0;
  return {regular:Math.max(0,total-bonus),bonus,original:total,mode:m,
    description:item?.partialBonusV267?.description||''};
}
function totals(items){
  return (items||[]).reduce((sum,item)=>{
    const x=effective(item);
    sum.regular+=x.regular;sum.bonus+=x.bonus;
    return sum;
  },{regular:0,bonus:0});
}
function adjust(items,id,nextMode,bonusMax,description){
  if(!Array.isArray(items)||!['regular','bonus','partial'].includes(nextMode))
    throw Error('Ungültige Bonusentscheidung.');
  const next=structuredClone(items);
  const item=next.find(it=>it.id===id);
  if(!item)throw Error('Die ausgewählte Aufgabe wurde nicht gefunden.');
  if(mode(item)==='original_bonus')
    throw Error('Eine ursprünglich als Bonus angelegte Aufgabe bleibt im ursprünglichen Aufgabenplan.');
  const amount=max(item);
  if(!Number.isFinite(amount)||amount<=0)throw Error('Für die Aufgabe fehlen gültige Originalpunkte.');
  delete item.bonusInsteadV260;
  delete item.partialBonusV267;
  if(nextMode==='bonus')item.bonusInsteadV260=true;
  if(nextMode==='partial'){
    const points=number(bonusMax);
    if(!Number.isFinite(points)||points<=0||points>=amount||!Number.isInteger(points*4))
      throw Error('Bonuspunkte müssen größer 0 und kleiner als die ursprüngliche Punktzahl sein (Schrittweite 0,25).');
    const label=String(description||'').trim();
    if(label.length>150)throw Error('Die Lückenbezeichnung ist zu lang.');
    item.partialBonusV267={max:points,description:label};
  }
  if(totals(next).regular<=0)throw Error('Mindestens eine regulär bewertete Aufgabe muss übrig bleiben.');
  return next;
}
function returned(exam){return !!exam?.evaluationUXV333?.returnedAt;}
const api={number,max,mode,effective,totals,adjust,returned};
root.SchulcockpitEvalGuideCoreV333=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
