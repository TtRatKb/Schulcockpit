/* Schulcockpit V0.33.4 – one canonical task editor, no private-data mutation.
 * Historical 6 regular + 3 bonus drafts are only suggested, never silently applied.
 */
(function(root){
'use strict';
const TYPES=['classtime','paper','classtime_bonus','paper_bonus'];
const number=v=>{
 if(v===null||v===undefined||String(v).trim()==='')return NaN;
 const raw=String(v).trim().replace(',','.');
 if(!/^\d+(?:\.\d+)?$/.test(raw))return NaN;
 return Number(raw);
};
const mode=item=>String(item.source||'').endsWith('_bonus')?'bonus':
 item.bonusInsteadV260?'bonus':
 number(item.partialBonusV267?.max)>0?'partial':'regular';
const family=source=>String(source||'').startsWith('paper')?'paper':'classtime';
const rawMax=item=>Number(String(item.source||'').endsWith('_bonus')?item.bonusMax:item.regularMax)||0;
function row(item,oldDraft=null){
 const old=oldDraft||{},isBonus=String(item.source||'').endsWith('_bonus');
 let maximum=rawMax(item),selected=mode(item),bonus=selected==='partial'?number(item.partialBonusV267.max):0;
 let proposed=false;
 const dr=number(old.regularRaw),db=number(old.bonusRaw);
 const draftSource=String(old.source||item.source);
 if(oldDraft){
   proposed=true;
   if(String(draftSource).endsWith('_bonus')){
     maximum=Number.isFinite(db)&&db>0?db:maximum;
     selected='bonus';bonus=maximum;
   }else if(Number.isFinite(dr)&&Number.isFinite(db)&&dr>0&&db>0){
     // Invalid V216 split draft: user meant 6 regular + 3 bonus = 9 original.
     maximum=dr+db;selected='partial';bonus=db;
   }else if(Number.isFinite(dr)&&dr>0){
     maximum=dr;
     if(selected==='bonus')bonus=maximum;
   }
 }else if(!isBonus&&Number(item.bonusMax)>0&&maximum>0){
   // Legacy mixed-schema data, also never silently migrated.
   bonus=Number(item.bonusMax);maximum+=bonus;selected='partial';proposed=true;
 }
 if(selected==='bonus')bonus=maximum;
 const result={id:item.id,label:item.label||item.id,source:family(draftSource),
  original:maximum,mode:selected,bonus:selected==='partial'?bonus:selected==='bonus'?maximum:0,
  description:item.partialBonusV267?.description||'',competencyId:old.competencyId||item.competencyId,
  legacySuggested:proposed,previousSource:item.source};
 return result;
}
function effective(row){
 const total=number(row.original),part=row.mode==='bonus'?total:row.mode==='partial'?number(row.bonus):0;
 return {
  regular:Number.isFinite(total)&&Number.isFinite(part)?Math.max(0,total-part):NaN,
  bonus:part,total
 };
}
function verify(items,changes,priv,columns=[]){
 if(!Array.isArray(items)||!items.length)throw Error('Keine Aufgaben vorhanden.');
 if(!Array.isArray(changes)||changes.length!==items.length)throw Error('Nicht alle Aufgaben wurden erfasst.');
 const byId=new Map(changes.map(c=>[c.id,c]));
 const next=structuredClone(items),warnings=[],changed=[];
 let regularTotal=0,bonusTotal=0;
 for(const item of next){
  const c=byId.get(item.id);
  if(!c)throw Error('Aufgabe '+(item.label||item.id)+' fehlt.');
  const label=item.label||item.id;
  if(!['paper','classtime'].includes(c.source))throw Error(label+': Quelle fehlt.');
  if(!['regular','bonus','partial'].includes(c.mode))throw Error(label+': Wertung fehlt.');
  const original=number(c.original);
  if(!Number.isFinite(original)||original<=0||original>10000)
   throw Error(label+': Bitte die ursprüngliche Gesamtpunktzahl größer 0 eintragen.');
  const part=c.mode==='bonus'?original:c.mode==='partial'?number(c.bonus):0;
  if(c.mode==='partial'&&(!Number.isFinite(part)||part<=0||part>=original||!Number.isInteger(part*4)))
   throw Error(label+': Die Bonuspunkte müssen größer 0 und kleiner als die Gesamtpunktzahl sein (Viertelpunkte möglich).');
  const description=String(c.description||'').trim();
  if(description.length>150)throw Error(label+': Die Lückenbezeichnung ist zu lang.');
  if(c.competencyId) item.competencyId=c.competencyId;
  const source=c.mode==='bonus'&&String(item.source||'').endsWith('_bonus')?
    c.source+'_bonus':c.source;
  const existing=Object.values(priv||{}).filter(Boolean); // Only explicit score dictionaries below are inspected.
  const saved=Object.keys(priv?.scores||{}).map(id=>priv.scores[id]?.[item.id])
    .concat(Object.keys(priv?.paperScores||{}).map(id=>priv.paperScores[id]?.[item.id]))
    .concat(Object.keys(priv?.bonusScores||{}).map(id=>priv.bonusScores[id]?.[item.id]))
    .filter(v=>v!==null&&v!==undefined&&v!=='');
  if(source!==item.source&&saved.length)
   throw Error(label+': Classtime-/Papierquelle kann wegen vorhandener Ergebnisse nicht geändert werden.');
  if(saved.some(v=>!Number.isFinite(number(v))||number(v)>original+1e-9))
   throw Error(label+': Ein vorhandenes Ergebnis ist größer als das neue Maximum von '+original+' Punkten. Bitte zuerst die konkrete Bewertung prüfen.');
  if(source.startsWith('classtime')){
   const linked=columns.find(col=>String(col.id)===String(item.id));
   if(linked&&Number.isFinite(Number(linked.max))&&Math.abs(Number(linked.max)-original)>1e-8){
    warnings.push(label+': Classtime-Excel enthält '+linked.max+' mögliche Punkte, deine neue Wertung '+original+
      '. Die Excel-Zuordnung muss vor einer erneuten Übernahme fachlich geklärt werden.');
    if(saved.length)throw Error(label+': Classtime liefert '+linked.max+
      ' Maximalpunkte, aber du möchtest '+original+' vergeben. Die vorhandenen Rohpunkte dürfen nicht still umgerechnet werden.');
   }
  }
  item.source=source;
  item.regularMax=source.endsWith('_bonus')?0:original;
  item.bonusMax=source.endsWith('_bonus')?original:0;
  delete item.bonusInsteadV260;
  delete item.partialBonusV267;
  if(c.mode==='bonus'&&!source.endsWith('_bonus'))item.bonusInsteadV260=true;
  if(c.mode==='partial')item.partialBonusV267={max:part,description};
  regularTotal+=c.mode==='bonus'?0:original-part;
  bonusTotal+=part;
  if(JSON.stringify(item)!==JSON.stringify(items.find(x=>x.id===item.id)))changed.push(label);
 }
 if(regularTotal<=0)throw Error('Die Arbeit braucht mindestens eine regulär bewertete Aufgabe.');
 return {items:next,regular:regularTotal,bonus:bonusTotal,changed,warnings};
}
const api={row,effective,verify,number,mode,family,rawMax};
root.SchulcockpitAssessmentEditorV334=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);