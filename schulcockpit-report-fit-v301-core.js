/* Schulcockpit V0.30.1 – one A4 page per complete assessment report.
 * Pure geometry/wording helpers: do not read or mutate student records.
 * A legible minimum is deliberate: if text cannot fit, stop with a clear
 * error rather than silently clipping or generating a second sheet.
 */
const SC_REPORT_FIT_V301=(function(){
'use strict';
const PROFILES=[
 {id:'original',legendGap:27,headHeight:43,rowFont:10.1,refFont:8.6,
  rowLeading:14,minRow:47,rowBaseline:18,rowBottom:11,refLeading:12,
  totalGap:10,totalHeight:53,afterTotal:8,noteGap:17,
  feedbackHeadingGap:16,cardFont:10.2,cardTitleFont:10.7,
  cardFirst:34,cardLeading:14.4,cardGap:9,bottomLimit:94},
 {id:'balanced',legendGap:23,headHeight:39,rowFont:9.65,refFont:8.35,
  rowLeading:12.9,minRow:44,rowBaseline:17,rowBottom:10,refLeading:11.2,
  totalGap:8,totalHeight:48,afterTotal:6,noteGap:15,
  feedbackHeadingGap:14,cardFont:10,cardTitleFont:10.4,
  cardFirst:31,cardLeading:13.2,cardGap:7,bottomLimit:94},
 {id:'compact',legendGap:20,headHeight:36,rowFont:9.2,refFont:8.05,
  rowLeading:11.8,minRow:41,rowBaseline:16,rowBottom:9,refLeading:10.6,
  totalGap:7,totalHeight:45,afterTotal:5,noteGap:13,
  feedbackHeadingGap:13,cardFont:9.7,cardTitleFont:10.1,
  cardFirst:28,cardLeading:12.3,cardGap:6,bottomLimit:94},
 {id:'fitted',legendGap:18,headHeight:34,rowFont:8.75,refFont:7.75,
  rowLeading:11.1,minRow:38,rowBaseline:15,rowBottom:8,refLeading:10,
  totalGap:6,totalHeight:43,afterTotal:4,noteGap:12,
  feedbackHeadingGap:12,cardFont:9.35,cardTitleFont:9.8,
  cardFirst:26,cardLeading:11.6,cardGap:5,bottomLimit:92}
];
function separateTaskRefs(text){
 const original=String(text||'').trim();
 // "(A6, A8, A11)" and "(A 1–3)" must stay together; the old expression
 // accidentally treated the second A as ordinary curriculum text.
 const match=original.match(/\s*(\(\s*A(?:ufgabe)?\s*\d+[a-z]?(?:\s*(?:,|;|[-–])\s*(?:A(?:ufgabe)?\s*)?\d+[a-z]?)*\s*\))([.!?])?\s*$/i);
 if(!match)return {main:original,task:''};
 return {main:original.slice(0,match.index).trim(),task:match[1]+(match[2]||'')};
}
function choose({startY,rows,feedback,measureRow,wrap}){
 if(!Number.isFinite(startY)||!Array.isArray(rows)||!rows.length)
  throw Error('Für diesen Kompetenzbogen fehlen gültige Seiten- oder Kompetenzdaten.');
 const attempts=[];
 for(const profile of PROFILES){
  const layouts=rows.map(c=>measureRow(c,profile));
  const strength=wrap(feedback?.strength||'–',477,profile.cardFont);
  const next=wrap(feedback?.next||'–',477,profile.cardFont);
  const table=layouts.reduce((sum,l)=>sum+l.height,0);
  const afterRows=startY-profile.legendGap-profile.headHeight-table;
  const afterTotal=afterRows-profile.totalGap-profile.totalHeight-profile.afterTotal;
  const afterNote=afterTotal-profile.noteGap;
  const feedbackStart=afterNote-profile.feedbackHeadingGap;
  const strengthHeight=profile.cardFirst+strength.length*profile.cardLeading;
  const nextHeight=profile.cardFirst+next.length*profile.cardLeading;
  const bottom=feedbackStart-strengthHeight-profile.cardGap-nextHeight-profile.cardGap;
  const result={profile,layouts,strength,next,afterRows,afterTotal,afterNote,
   feedbackStart,strengthHeight,nextHeight,bottom};
  if(bottom>=profile.bottomLimit)return result;
  attempts.push(result);
 }
 const last=attempts.at(-1);
 const overflow=Math.ceil(last.profile.bottomLimit-last.bottom);
 const error=new Error('Einseitiger Kompetenzbogen nicht lesbar möglich: '+
  rows.length+' Kompetenzen und die vollständigen Rückmeldungstexte benötigen '+
  'mindestens '+overflow+' zusätzliche Druckpunkte. Bitte die Texte bzw. '+
  'Kompetenzzahl fachlich prüfen; es wurde nichts abgeschnitten oder auf Seite 2 verschoben.');
 error.code='SC_REPORT_ONE_PAGE_TOO_LONG';
 error.overflow=overflow;
 throw error;
}
return {PROFILES,separateTaskRefs,choose};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_REPORT_FIT_V301;