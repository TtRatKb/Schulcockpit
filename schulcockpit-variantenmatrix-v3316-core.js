/* V0.33.16 – a shared score-matrix view model, independently scoped to exam file.
 * No new student records: existing file rubric, scores, bonus and grade fields.
 */
(function(root){
'use strict';
function taskMode(item){
 if(!item)return 'regular';
 if(String(item.source||'').endsWith('_bonus')||item.bonusInsteadV260)return 'bonus';
 return Number(item.partialBonusV267?.max)>0?'partial':'regular';
}
function taskDisplay(item){
 const mode=taskMode(item);
 const original=Number(String(item.source||'').endsWith('_bonus')?item.bonusMax:item.regularMax);
 const part=mode==='partial'?Number(item.partialBonusV267.max):0;
 return {mode,original,regularMax:mode==='bonus'?0:original-part,
  bonusMax:mode==='bonus'?original:part,
  label:mode==='bonus'?'★ Bonus: '+original+' P.':
   mode==='partial'?'davon '+part+' Bonus (reg. '+(original-part)+')':
    original+' P.'};
}
function ensureTarget(priv,studentId,fileKey,selection){
 if(!priv||!fileKey||!studentId)throw Error('Keine eindeutige Prüfungsfassung ausgewählt.');
 if((priv.roster||[]).filter(st=>st.id===studentId).length!==1)
  throw Error('Prüfungs-Teilnehmer-ID ist nicht eindeutig.');
 if(!selection||selection.status!=='ready'||selection.file?.fileKey!==fileKey||
  !Array.isArray(selection.rubric?.items)||!selection.rubric.items.length)
  throw Error('Die Prüfungsfassung ist nicht mehr für dieses Kind freigegeben. Bitte zuerst Schritt 1 prüfen.');
 if(priv.examFileV317?.[studentId]!==fileKey||
  priv.activeVariantV300?.[studentId]!=='file:'+fileKey)
  throw Error('Die aktive Prüfungsfassung hat sich geändert. Es wurden keine Punkte gespeichert.');
 return selection.rubric;
}
function summary(report){
 if(!report)return 'Bewertung noch nicht verfügbar';
 const reg=Number(report.totalReg)||0,bonus=Number(report.totalBonusEarned)||0,
  credited=Number(report.totalAdjusted)||0,max=Number(report.totalMax)||0;
 const fmt=x=>(Math.round(x*100)/100).toLocaleString('de-DE',{maximumFractionDigits:2});
 const lines=fmt(reg)+' regulär + '+fmt(bonus)+' Bonus · '+
  fmt(credited)+' / '+fmt(max)+' P.';
 if(!report.complete){
  const n=(report.missing||[]).length;
  return lines+' · '+(n?n+' Wertung(en) offen':'Bewertung noch unvollständig');
 }
 return lines+(report.totalPct===null?'':' · '+Math.round(Number(report.totalPct)*10)/10+' %')+
  ' · Note '+(report.gradeV260||'noch offen');
}
function eligibleRows(file,p,assigned,select){
 const byId=new Map((p?.roster||[]).map(st=>[st.id,st])),seen=new Set(),rows=[];
 for(const row of assigned||[]){
  if(!row?.ready||seen.has(row.id))continue;
  const student=byId.get(row.id);
  if(!student)continue;
  const choice=select(p,student);
  if(choice?.status!=='ready'||choice.file?.fileKey!==file?.fileKey)continue;
  seen.add(row.id);rows.push(student);
 }
 return rows;
}
const api={taskMode,taskDisplay,ensureTarget,summary,eligibleRows};
root.SchulcockpitVariantMatrixV3316Core=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
