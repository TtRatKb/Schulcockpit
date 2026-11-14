/* Schulcockpit V0.32.2 – reine, überprüfbare Gruppierung der offenen Druckaufträge.
 * Ein Originalblob + identischer Druckmodus ergeben einen ZIP-Druckjob.
 * Verteilliste bleibt pro Unterrichtsstunde erhalten. Keine Datenmutation.
 */
(function(root){
'use strict';
const str=v=>String(v??'');
function mode(p){return p?.mode==='color'?'color':'bw';}
function safe(s){return str(s).normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/\s+/g,' ').trim();}
function ext(name){return str(name).match(/\.[a-z0-9]{1,8}$/i)?.[0]||'';}
function base(name){
 const n=safe(name||'Arbeitsblatt');
 return n.replace(/\.[a-z0-9]{1,8}$/i,'').slice(0,95)||'Arbeitsblatt';
}
function normalize(report){
 const list=[],invalid=[],sets=new Map();
 for(const row of report?.available||[]){
  const fileKey=str(row.variant?.fileKey);
  const copies=Number(row.copies);
  const lessonId=str(row.lesson?.id);
  const id=str(row.plan?.id||row.plan?.materialId+'|'+row.plan?.variantId);
  const key=mode(row.plan)+'|'+fileKey;
  if(!fileKey||!Number.isInteger(copies)||copies<1||copies>500||!lessonId||!row.variant?.fileName){
   invalid.push({row,reason:'Druckauftrag hat keine gültige lokale Datei, Kopienzahl oder Stunde'});
   continue;
  }
  // One physical print-plan row must never be counted twice in a batch.
  const rowKey=lessonId+'|'+id;
  if(sets.has(rowKey)){invalid.push({row,reason:'Druckauftrag doppelt erfasst'});continue;}
  sets.set(rowKey,true);
  list.push({row,key,lessonId,copies,rowKey});
 }
 const grouped=new Map();
 for(const item of list){
  const {row,key,copies,rowKey}=item;
  let g=grouped.get(key);
  if(!g){
   g={id:key,mode:mode(row.plan),fileKey:row.variant.fileKey,
    title:row.variant.fileName||row.material?.title||'Arbeitsblatt',
    variantLabel:row.variant?.label||'',
    copies:0,rows:[],sourceFileName:row.variant?.fileName||''};
   grouped.set(key,g);
  }
  g.copies+=copies;
  g.rows.push({lessonId:item.lessonId,planId:row.plan?.id||'',
   materialId:row.plan?.materialId,variantId:row.plan?.variantId,
   classId:row.lesson?.classId,date:row.lesson?.date||'',
   period:row.lesson?.period||'',course:[row.cls?.subject,row.cls?.name].filter(Boolean).join(' ').trim()||'Fachkurs',
   copies,mode:g.mode,planRef:row.plan,lessonRef:row.lesson,
   title:row.material?.title||'',rowKey});
 }
 const names=new Set();
 const groups=[...grouped.values()].sort((a,b)=>{
  const first=a.rows[0],other=b.rows[0];
  return Number(b.mode==='color')-Number(a.mode==='color')||
   first.date.localeCompare(other.date)||a.title.localeCompare(b.title,'de');
 }).map((g,i)=>{
  const sub=g.mode==='color'?'FARBE':'SW';
  const ending=ext(g.sourceFileName);
  let filename=sub+'/'+String(g.copies).padStart(3,'0')+'x_'+base(g.sourceFileName)+ending;
  let n=2;while(names.has(filename)){filename=sub+'/'+String(g.copies).padStart(3,'0')+'x_'+base(g.sourceFileName)+'_'+n+++ending;}
  names.add(filename);
  return {...g,name:filename,number:i+1};
 });
 return {groups,invalid,sourceCount:list.length,totalCopies:groups.reduce((n,g)=>n+g.copies,0),
  savedFiles:list.length-groups.length};
}
function printableManifest(report,meta={}){
 const normalized=normalize(report);
 const distribution=normalized.groups.flatMap(g=>g.rows.map(r=>({
  file:g.sourceFileName,entry:g.name,mode:g.mode==='color'?'Farbe':'S/W',
  count:r.copies,lessonId:r.lessonId,classId:r.classId,
  date:r.date,period:r.period,course:r.course,materialId:r.materialId,variantId:r.variantId
 })));
 const missing=(report?.missing||[]).map(r=>({file:r.variant?.fileName||r.material?.title||'Datei fehlt',
  date:r.lesson?.date||'',course:[r.cls?.subject,r.cls?.name].filter(Boolean).join(' '),count:r.copies,lessonId:r.lesson?.id||''}));
 const excluded=(report?.excluded||[]).map(r=>({
  lessonId:r.lessonId||r.lesson?.id||'',reason:r.reason||'Ausgeschlossen',file:r.file||''}));
 return {schema:'schulcockpit.smart-print.v1',weekStart:meta.weekStart||'',
  generatedAt:meta.generatedAt||'',groups:normalized.groups.map(g=>({
   fileKey:g.fileKey,entry:g.name,mode:g.mode,copies:g.copies,
   distribution:g.rows.map(({lessonId,date,period,course,copies,materialId,variantId})=>({
    lessonId,date,period,course,copies,materialId,variantId}))
  })),distribution,missing,excluded};
}
function printList(manifest){
 const lines=['WOCHEN-DRUCKLISTE',manifest.weekStart?'Woche ab '+manifest.weekStart:'',
  'Ein ZIP-Original pro identischer Druckdatei und Druckmodus.',
  'Kopien für verschiedene Klassen werden zusammengezählt; Aufteilung siehe unten.',''];
 for(const g of manifest.groups){
  lines.push(g.copies+'x '+(g.mode==='color'?'FARBE':'S/W')+' · '+g.entry);
  for(const r of g.distribution)
   lines.push('    '+r.copies+'x für '+r.course+' · '+r.date+(r.period?' · '+r.period:''));
 }
 if(!manifest.groups.length)lines.push('Keine offenen Druckaufträge.');
 if(manifest.missing.length){
  lines.push('','ACHTUNG – FEHLENDE ORIGINALDATEIEN (nicht exportiert):');
  for(const r of manifest.missing)lines.push('- '+r.file+' · '+r.course+' · '+r.date);
 }
 if(manifest.excluded.length){
  lines.push('','NICHT ERNEUT ZU KOPIEREN / BITTE PRÜFEN:');
  for(const r of manifest.excluded)lines.push('- '+r.reason+(r.lessonId?' · Stunde '+r.lessonId:''));
 }
 lines.push('','WICHTIG: Der ZIP-Download markiert nichts automatisch als kopiert.');
 return lines.filter((v,i)=>i!==1||!!v).join('\n');
}
const api={mode,safe,normalize,printableManifest,printList};
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.SchulcockpitSmartPrintCoreV322=api;
})(typeof window!=='undefined'?window:null);
