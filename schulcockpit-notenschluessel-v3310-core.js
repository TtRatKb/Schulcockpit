/* V0.33.10 – pure, optional private grade scales for file-based exam variants.
 * The regular assessment gradeScaleV260 remains untouched and authoritative
 * only for standard students. No migration of existing records is necessary.
 */
(function(root){
'use strict';
function fileKey(kind){
 const value=String(kind||'');
 return value.startsWith('file:')&&value.length>5?value.slice(5):'';
}
function forTab(exam,priv,kind){
 const key=fileKey(kind);
 return key?priv?.variantGradeScalesV3310?.[key]:exam?.gradeScaleV260;
}
function forStudent(exam,priv,student,selection){
 const selected=typeof selection==='function'?selection(priv,student,exam):null;
 if(selected?.status==='ready'&&selected.file?.fileKey)
  return priv?.variantGradeScalesV3310?.[selected.file.fileKey];
 return exam?.gradeScaleV260;
}
function withScale(priv,key,scale){
 if(!priv||!key)throw Error('Keine private Prüfungsfassung ausgewählt.');
 const next=structuredClone(priv);
 next.variantGradeScalesV3310={...(next.variantGradeScalesV3310||{})};
 if(scale===null)delete next.variantGradeScalesV3310[key];
 else{
  if(!Array.isArray(scale)||scale.length!==5||scale.some(n=>!Number.isFinite(Number(n))))
   throw Error('Notenschlüssel muss fünf gültige Grenzen enthalten.');
  next.variantGradeScalesV3310[key]=scale.map(Number);
 }
 return next;
}
const api={fileKey,forTab,forStudent,withScale};
root.SchulcockpitGradeScopeV3310=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
