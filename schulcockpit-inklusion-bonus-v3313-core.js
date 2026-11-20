/* V0.33.13 – private, file-specific bonus rules and atomic manual score edits.
 * Existing regular analysis, original Excel marks and class roster stay untouched.
 */
(function(root){
'use strict';
const gap=typeof module!=='undefined'&&module.exports?
 require('./schulcockpit-bonusluecken-v337-core.js'):root.SchulcockpitBonusGapsV337;
const makeup=typeof module!=='undefined'&&module.exports?
 require('./schulcockpit-nachschreiben-v300-core.js'):SC_MAKEUP_BATCH_V300;
function number(value){
 if(value===undefined||value===null||String(value).trim()==='')return NaN;
 const text=String(value).trim().replace(',','.');
 return /^\d+(?:\.\d+)?$/.test(text)?Number(text):NaN;
}
function mode(item){
 return String(item?.source||'').endsWith('_bonus')||item?.bonusInsteadV260?'bonus':
 Number(item?.partialBonusV267?.max)>0?'partial':'regular';
}
function max(item){
 return Number(String(item.source||'').endsWith('_bonus')?item.bonusMax:item.regularMax);
}
function updateRules(analysis,changes,priv,fileKey){
 if(!fileKey)throw Error('Keine eindeutige Inklusions-Prüfungsdatei.');
 if(!Array.isArray(analysis?.items)||!analysis.items.length)
  throw Error('Für diese Inklusionsarbeit fehlt das eigene Aufgabenraster.');
 const changed=[],updated=analysis.items.map(item=>{
  const input=changes?.[item.id];
  if(!input)return {...item};
  if(String(item.source||'').endsWith('_bonus')){
   if(input.mode!=='bonus')throw Error((item.label||item.id)+': Bonusfrage bleibt eine reine Bonusfrage.');
   return {...item};
  }
  if(!['classtime','paper'].includes(item.source))throw Error('Unbekannte Aufgabenquelle.');
  if(!['regular','bonus','partial'].includes(input.mode))throw Error('Bitte die Wertung auswählen.');
  const next={...item},previous=JSON.stringify(item),part=number(input.bonusMax);
  delete next.bonusInsteadV260;
  delete next.partialBonusV267;
  if(input.mode==='bonus')next.bonusInsteadV260=true;
  if(input.mode==='partial'){
   const total=Number(item.regularMax);
   if(!Number.isFinite(part)||part<=0||part>=total||!Number.isInteger(part*4))
    throw Error((item.label||item.id)+': Bonusanteil muss zwischen 0 und '+total+' Punkten liegen (Viertelpunkte möglich).');
   const description=String(input.description||'').trim();
   if(description.length>150)throw Error('Bonuslücken-Bezeichnung zu lang.');
   next.partialBonusV267={max:part,description};
  }
  if(JSON.stringify(next)!==previous){
   // A changed split must never silently invalidate already graded bonus gaps.
   const oldPart=JSON.stringify(item.partialBonusV267||null);
   const newPart=JSON.stringify(next.partialBonusV267||null);
   if(oldPart!==newPart&&(priv?.roster||[]).some(st=>
    (priv.examFileV317?.[st.id]===fileKey||priv.activeVariantV300?.[st.id]==='file:'+fileKey)&&
    priv.gradingOverridesV267?.[st.id]?.[item.id]?.bonusEarned!==undefined))
    throw Error((item.label||item.id)+': Bereits korrigierte Bonuslücken vorhanden. Erst die individuellen Wertungen prüfen.');
   changed.push(item.label||item.id);
  }
  return next;
 });
 const regular=updated.reduce((sum,it)=>sum+(mode(it)==='bonus'?0:
  Number(it.regularMax)-(mode(it)==='partial'?Number(it.partialBonusV267.max):0)),0);
 if(!(regular>0))throw Error('Mindestens eine regulär bewertete Aufgabe muss erhalten bleiben.');
 return {analysis:{...analysis,items:updated},changed,regular};
}
function applyMarks(priv,studentId,items,scores,bonuses){
 if(!priv||(priv.roster||[]).filter(st=>st.id===studentId).length!==1)
  throw Error('Teilnehmendes Kind ist nicht eindeutig.');
 if(!Array.isArray(items)||!items.length)throw Error('Bewertungsraster fehlt.');
 const next=structuredClone(priv);
 const personal=structuredClone(next.gradingOverridesV267?.[studentId]||{});
 const marks=[];
 for(const item of items){
  if(!Object.prototype.hasOwnProperty.call(scores||{},item.id))
   throw Error('Eingabefeld für '+(item.label||item.id)+' fehlt.');
  const earned=makeup.isScore(scores[item.id],max(item));
  const individual={...(personal[item.id]||{})};
  const rawBonus=bonuses?.[item.id];
  if(gap.isSplit(item,individual)){
   if(rawBonus!==undefined&&rawBonus!==null&&String(rawBonus).trim()!==''){
    const value=gap.validNumber(rawBonus);
    if(!gap.eligible(item,earned,value,individual))
     throw Error((item.label||item.id)+': Bonuslücken passen nicht zu den Gesamtpunkten.');
    individual.bonusEarned=value;
   }else delete individual.bonusEarned;
   if(Object.keys(individual).length)personal[item.id]=individual;
   else delete personal[item.id];
  }else if(rawBonus!==undefined&&String(rawBonus).trim()!=='')
   throw Error((item.label||item.id)+': Diese Aufgabe enthält keinen freigegebenen Bonusanteil.');
  marks.push({item,earned});
 }
 next.gradingOverridesV267={...(next.gradingOverridesV267||{})};
 if(Object.keys(personal).length)next.gradingOverridesV267[studentId]=personal;
 else delete next.gradingOverridesV267[studentId];
 for(const {item,earned} of marks){
  const field=item.source==='classtime'?'scores':item.source==='paper'?'paperScores':'bonusScores';
  next[field]={...(next[field]||{})};
  const current={...(next[field][studentId]||{})};
  if(earned===null)delete current[item.id];else current[item.id]=earned;
  next[field][studentId]=current;
  const provenance=String(item.source).endsWith('_bonus')?'bonusOriginsV213':'scoreSourcesV211';
  next[provenance]={...(next[provenance]||{})};
  next[provenance][studentId]={...(next[provenance][studentId]||{}),[item.id]:
   earned===null?'unresolved':'manual'};
 }
 return next;
}
const api={mode,max,number,updateRules,applyMarks};
root.SchulcockpitInclusionBonusV3313Core=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
