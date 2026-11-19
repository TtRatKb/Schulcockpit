/* Schulcockpit V0.33.7 – pure per-pupil bonus-gap helpers.
 * "Originalpunkte" are immutable; a bonus gap is a subset of those points.
 */
(function(root){
'use strict';
function validNumber(v){
 if(v===null||v===undefined||v==='')return null;
 if(typeof v==='string'&&!/^\d+(?:[,.]\d+)?$/.test(v.trim()))return null;
 const n=Number(String(v).replace(',','.'));
 return Number.isFinite(n)?n:null;
}
function isSplit(item,personal={}){
 return item&&['classtime','paper'].includes(item.source)&&
  !item.bonusInsteadV260&&
  validNumber(item.partialBonusV267?.max)>0&&
  !['bonus','exclude'].includes(personal?.mode);
}
function bounds(item,raw,personal={}){
 if(!isSplit(item,personal))return {active:false,reason:'no-split'};
 const total=validNumber(item.regularMax);
 const part=validNumber(item.partialBonusV267?.max);
 const points=validNumber(raw);
 if(total===null||part===null||total<=0||part<=0||part>=total)
  return {active:true,ready:false,reason:'invalid-maximum'};
 if(points===null||points<0||points>total)
  return {active:true,ready:false,reason:'missing-raw',total,part,raw:points};
 const min=Math.max(0,points-(total-part));
 const max=Math.min(part,points);
 return {active:true,ready:true,total,part,raw:points,
  min:Math.round(min*100)/100,max:Math.round(max*100)/100};
}
function eligible(item,raw,entered,personal={}){
 const b=bounds(item,raw,personal),n=validNumber(entered);
 return b.ready&&n!==null&&n>=b.min-1e-9&&n<=b.max+1e-9&&
  Math.abs(n*4-Math.round(n*4))<1e-6;
}
function options(boundsData,step=0.25){
 if(!boundsData?.ready)return [];
 const values=[];
 for(let n=Math.ceil(boundsData.min/step-1e-9);n<=Math.floor(boundsData.max/step+1e-9);n++){
  values.push(Math.round(n*step*100)/100);
 }
 return values;
}
function view(item,raw,entered,personal={}){
 const b=bounds(item,raw,personal);
 if(!b.active)return {state:'inactive',bounds:b};
 if(!b.ready)return {state:'need-raw',bounds:b};
 if(entered===null||entered===undefined||entered==='')return {state:'missing',bounds:b};
 if(!eligible(item,raw,entered,personal))return {state:'invalid',bounds:b};
 const bonus=validNumber(entered);
 return {state:'complete',bounds:b,bonus,regular:Math.round((b.raw-bonus)*100)/100};
}
function count(items,students,priv,readScore){
 const eligibleItems=(items||[]).filter(it=>isSplit(it));
 let total=0,complete=0,invalid=0,awaitingRaw=0;
 for(const student of students||[]){
  if((priv?.participationV210?.[student.id]||'present')!=='present')continue;
  const personal=priv?.gradingOverridesV267?.[student.id]||{};
  for(const it of eligibleItems){
   const ch=personal[it.id]||{};
   if(!isSplit(it,ch))continue;
   const state=view(it,readScore(priv,student.id,it),ch.bonusEarned,ch).state;
   if(state==='need-raw'){awaitingRaw++;continue;}
   total++;
   if(state==='complete')complete++;
   else if(state==='invalid')invalid++;
  }
 }
 return {total,complete,invalid,awaitingRaw,open:total-complete};
}
const api={validNumber,isSplit,bounds,eligible,options,view,count};
root.SchulcockpitBonusGapsV337=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
