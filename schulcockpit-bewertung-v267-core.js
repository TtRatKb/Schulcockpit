/* V0.26.7 – reine Bewertungsanpassungen auf Grundlage unveränderter Rohpunkte.
 * Keine Schülerdaten in öffentlichen Planungsdaten oder ChatGPT-Prompts. */
const SC_GRADING_V267=(function(){
'use strict';
const base=SC_GRADING_V260;
const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
function compute(items,competencies,scoreFor,changes={},isLower=false,thresholds={},statusFor=null){
 const expanded=[],values=new Map(),excluded=[],invalid=[];
 const areas=new Map();const originalItems=items||[];
 function push(it,value,area){
   expanded.push(it);values.set(it.id,value);
   if(area&&numeric(value)){
     const key=String(area).trim(),entry=areas.get(key)||{label:key,regularMax:0,regularEarned:0,bonusEarned:0};
     const maximum=base.max(it),earned=Math.max(0,Math.min(maximum,Number(value)));
     if(base.bonus(it))entry.bonusEarned+=earned;
     else{entry.regularMax+=maximum;entry.regularEarned+=earned;}
     areas.set(key,entry);
   }else if(area){
     const key=String(area).trim(),entry=areas.get(key)||{label:key,regularMax:0,regularEarned:0,bonusEarned:0};
     if(!base.bonus(it))entry.regularMax+=base.max(it);
     areas.set(key,entry);
   }
 }
 for(const it of originalItems){
   const change=changes[it.id]||{},mode=change.mode||'default',raw=scoreFor(it);
   const area=it.learningAreaV267||'';
   if(mode==='exclude'){
     excluded.push({id:it.id,label:(it.label||it.id)+' · nicht gewertet',source:it.source,
       bonus:false,earned:0,max:0,excluded:true});
     continue;
   }
   const fullBonus=base.bonus(it)||mode==='bonus';
   const split=it.partialBonusV267;
   if(!fullBonus&&split&&Number(split.max)>0){
     const max=base.max(it),part=Number(split.max),entered=change.bonusEarned;
     const valid=numeric(raw)&&numeric(entered)&&Number(raw)>=0&&Number(raw)<=max&&
       Number(entered)>=0&&Number(entered)<=part&&Number(entered)<=Number(raw)&&
       Number(raw)-Number(entered)<=max-part;
     if(!valid&&numeric(entered))invalid.push(it.label||it.id);
     const label=it.label||it.id;
     const regular={...it,id:it.id+'::regularV267',label:label+' · regulär',
       regularMax:max-part,bonusMax:0,bonusInsteadV260:false};
     const bonus={...it,id:it.id+'::bonusV267',
       label:label+' · Bonus'+(split.description?' ('+split.description+')':''),
       source:it.source==='paper'?'paper_bonus':'classtime_bonus',
       regularMax:0,bonusMax:part,bonusInsteadV260:false};
     push(regular,valid?Number(raw)-Number(entered):null,area);
     push(bonus,valid?Number(entered):null,area);
   }else{
     const effective=mode==='bonus'?{...it,bonusInsteadV260:true}:it;
     push(effective,raw,area);
   }
 }
 const result=base.calculate(expanded,competencies,it=>values.get(it.id),isLower,thresholds,statusFor);
 const originalOrder=new Map(originalItems.map((it,i)=>[it.id,i]));
 const order=id=>originalOrder.get(String(id).replace(/::(?:regular|bonus)V267$/,''))??9999;
 result.itemsV260=[...result.itemsV260,...excluded].sort((a,b)=>order(a.id)-order(b.id));
 result.learningAreasV267=[...areas.values()].filter(a=>a.label);
 result.invalidV267=invalid;
 result.complete=result.complete&&!invalid.length&&result.totalMax>0;
 return result;
}
function validateSplit(item,max){
 const p=Number(max),total=base.max(item);
 return Number.isFinite(p)&&p>0&&p<total&&Number.isInteger(p*4);
}
return {compute,validateSplit,numeric};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_GRADING_V267;
