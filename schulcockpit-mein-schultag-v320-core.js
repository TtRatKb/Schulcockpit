/* Schulcockpit V0.32.0 – reine Tagesübersicht (ohne Datenmutation).
 * Keine eigene Unterrichts-/Materialliste: liest unverändert aus dem vorhandenen
 * State und nutzt bestehende Unterrichts-/Druckstatusfelder.
 * Dieses Modul ist bewusst unabhängig von DOM/IndexedDB, damit es testbar ist.
 */
(function(root){
'use strict';
const ISO=/^\d{4}-\d{2}-\d{2}$/;
function validDate(s){return typeof s==='string'&&ISO.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00'));}
function addDays(date,days){
 if(!validDate(date))return '';
 const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+days);
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function weekday(date){return validDate(date)?new Date(date+'T12:00:00').getDay():-1;}
function schoolDay(date,direction=1){
 if(!validDate(date))return '';
 const step=direction<0?-1:1;
 let day=addDays(date,step);
 for(let i=0;i<7&&[0,6].includes(weekday(day));i++)day=addDays(day,step);
 return day;
}
function initialDay(today){
 if(!validDate(today))return '';
 let day=today;
 for(let i=0;i<7&&[0,6].includes(weekday(day));i++)day=addDays(day,1);
 return day;
}
function lessonSlot(l){
 if(l?.slot!==null&&l?.slot!==undefined&&l?.slot!==''&&Number.isFinite(Number(l.slot)))
  return Number(l.slot);
 const m=String(l?.period||'').match(/\b(\d+)(?:\.|\s+)(?:Stunde|Block)\b/i);
 return m?Number(m[1]):99;
}
function isCanceled(l){return l?.executionV180?.type==='cancelled';}
function isHeld(l){return !isCanceled(l)&&(l?.status==='done'||l?.executionV180?.type==='substitute');}
function isActualLesson(l){return !!(l?.id&&l?.classId&&validDate(l.date)&&!l.groupId&&l.kind!=='group');}
function planned(l){
 return !!(l?.aiImportAt||((l?.phasePlan||[]).length&&(l?.slides||[]).length));
}
function activePrint(p){
 return !!(p?.needed&&!p._v183removed&&!p._v183obsolete&&(Number(p.count)||0)>0);
}
function copySummary(l,materialById,stored){
 const rows=(l?.printPlan||[]).filter(activePrint);
 const open=rows.filter(p=>!p.alreadyPrinted);
 const files=rows.map(p=>{
  const m=materialById.get(String(p.materialId)),v=(m?.variants||[]).find(v=>String(v.id)===String(p.variantId));
  const key=v?.fileKey||'';
  return {name:v?.fileName||m?.title||'Material prüfen',key,
   available:!!(key&&stored.has(key)),copies:Number(p.count)||0,printed:!!p.alreadyPrinted,
   materialId:p.materialId,variantId:p.variantId};
 });
 return {total:rows.length,open:open.length,missing:files.filter(f=>!f.available&&!f.printed).length,
  files};
}
function summarize(source,date){
 const input=source||{},all=Array.isArray(input.lessons)?input.lessons:[],
  classes=new Map((input.classes||[]).map(c=>[String(c.id),c])),
  materialById=new Map((input.materials||[]).map(m=>[String(m.id),m])),
  stored=new Set(input.storedKeys||[]);
 const substitution=input.substitutionPlans||{},
  types=input.lessonTypes||{};
 const rows=all.filter(isActualLesson).filter(l=>l.date===date)
  .map(l=>{
   const type=types[l.id]||'ordinary',c=classes.get(String(l.classId)),
    hour=lessonSlot(l),key=l.date+'|'+l.classId+'|'+hour;
   const isSub=type==='substitution',cancelled=isCanceled(l),held=isHeld(l);
   const copies=copySummary(l,materialById,stored);
   const pptKey=l.presentationBlobKeyV180||'lesson-ppt-'+l.id;
   const pptStored=!!(l.presentationReady&&stored.has(pptKey));
   const isPlanned=planned(l),sub=substitution[key]||{};
   const subReady=!!(sub.prepared&&String(sub.instructions||'').trim());
   let status='open',statusText='Planung offen';
   if(cancelled){status='canceled';statusText='Unterricht ausgefallen';}
   else if(held){status='held';statusText='Gehalten';}
   else if(type==='exam'){status='special';statusText='Klassenarbeit · eigene Vorbereitung';}
   else if(type==='excursion'){status='special';statusText='Außerschulischer Termin';}
   else if(isSub){status=subReady?'ready':'warning';statusText=subReady?'Vertretung vorbereitet':'Vertretungsmaterial offen';}
   else if(!isPlanned){status='warning';statusText='Konkrete Planung offen';}
   else if(!pptStored){status='warning';statusText='Präsentation offen / lokal nicht gefunden';}
   else if(copies.open){status='warning';statusText='Kopien noch offen';}
   else{status='ready';statusText='Vorbereitet';}
   const file=copies.files.find(f=>f.available&&!f.printed)||copies.files.find(f=>f.available)||null;
   return {id:l.id,date:l.date,classId:l.classId,slot:hour,
    course:[c?.subject||'',c?.name||''].filter(Boolean).join(' ').trim()||'Fachkurs',
    period:l.period||((hour!==99?hour+'. Stunde':'Zeit offen')),
    title:l.planReference?.title||l.title||'Thema noch offen',type,status,statusText,
    held,canceled,planned:isPlanned,hasPresentation:pptStored,
    presentationDeclared:!!l.presentationReady,copyOpen:copies.open,
    copyTotal:copies.total,copyMissing:copies.missing,
    files:copies.files,firstFile:file?{name:file.name,key:file.key}:null,
    substitutionReady:subReady};
  }).sort((a,b)=>a.slot-b.slot||a.course.localeCompare(b.course,'de')||String(a.id).localeCompare(String(b.id)));
 const summary={date,total:rows.length,ready:rows.filter(x=>x.status==='ready').length,
  open:rows.filter(x=>x.status==='warning').length,
  held:rows.filter(x=>x.held).length,
  printOpen:rows.reduce((sum,x)=>sum+(x.canceled||x.held||x.type==='exam'||x.type==='excursion'?0:x.copyOpen),0),
  missingFiles:rows.reduce((sum,x)=>sum+(x.canceled||x.held?0:x.copyMissing),0),
  substitutionOpen:rows.filter(x=>x.type==='substitution'&&!x.held&&!x.substitutionReady).length,
  rows};
 return summary;
}
const api={addDays,weekday,schoolDay,initialDay,lessonSlot,isActualLesson,isCanceled,isHeld,planned,activePrint,summarize};
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.SchulcockpitDayCoreV320=api;
})(typeof window!=='undefined'?window:null);
