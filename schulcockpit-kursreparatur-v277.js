/* Schulcockpit V0.27.7 – safe date rendering and guarded, lesson-only course repair.
 * Repair files are local and contain no student names or private evaluation data.
 * No changed lesson, sequence or material may be overwritten without a preview. */
(function(root){
'use strict';
const SCHEMA='schulcockpit.course-repair.v1';
const lessonFields=new Set(['date','status','title','sequenceId','unit','planReference','materials','executionV180','actualV270','v180MovedFrom']);
const unitFields=new Set(['plannedDate','plannedSlotV272','parkedFromV275','skippedThisYearV201']);
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const eq=(a,b)=>JSON.stringify(a===undefined?null:a)===JSON.stringify(b===undefined?null:b);
const copy=x=>JSON.parse(JSON.stringify(x));
function prepareRepair(source,lessonRows,sequenceRows){
 if(!source||source.schema!==SCHEMA||!Array.isArray(source.operations)||!source.operations.length||source.operations.length>60)
   throw Error('Keine gültige Schulcockpit-Kursreparaturdatei.');
 if(!Array.isArray(lessonRows)||!Array.isArray(sequenceRows))throw Error('Die Unterrichtsplanung fehlt.');
 const lessons=copy(lessonRows),sequences=copy(sequenceRows),seen=new Set();
 for(const change of source.operations){
  if(!change||!['lesson','unit'].includes(change.kind)||typeof change.id!=='string'||
    typeof change.classId!=='string'||!change.classId||!change.set||typeof change.set!=='object'||Array.isArray(change.set)||
    !change.expect||typeof change.expect!=='object'||Array.isArray(change.expect)||
    !Array.isArray(change.unset))throw Error('Reparatur enthält einen ungültigen Änderungseintrag.');
  let target,fields;
  if(change.kind==='lesson'){
   target=lessons.find(l=>l.id===change.id&&l.classId===change.classId);
   fields=lessonFields;
  }else{
   const q=sequences.find(q=>q.id===change.sequenceId&&q.classId===change.classId);
   if(change.unitId!==change.id||!q)throw Error('Die Reihenverknüpfung passt nicht zum Fachkurs.');
   target=(q.plan||[]).find(u=>u.id===change.unitId);
   fields=unitFields;
  }
  if(!target)throw Error('Stunde/Reiheneintrag nicht gefunden: '+change.id);
  const keys=[...Object.keys(change.set),...change.unset];
  if(!keys.length||new Set(keys).size!==keys.length||keys.some(k=>!fields.has(k)||!own(change.expect,k)))
    throw Error('Ein nicht erlaubtes Datenfeld wurde angefordert: '+change.id);
  for(const k of keys){
   const unique=change.kind+'|'+change.id+'|'+k;
   if(seen.has(unique))throw Error('Doppelte Änderung an '+change.id);
   seen.add(unique);
   if(!eq(target[k],change.expect[k]))throw Error('Die gespeicherte Planung wurde seit dem Backup geändert ('+change.id+', '+k+'). Nichts wurde überschrieben.');
  }
  for(const [key,value] of Object.entries(change.set))target[key]=copy(value);
  for(const key of change.unset)delete target[key];
 }
 const conflicts=rows=>{const x=new Map(),hits=new Set();for(const l of rows){
   if(!l.classId||!l.date||!l.timetableId)continue;
   const key=l.classId+'|'+l.date+'|'+l.timetableId;
   if(x.has(key))hits.add(key);else x.set(key,l.id);
  }return hits;};
 const before=conflicts(lessonRows),after=conflicts(lessons);
 if([...after].some(key=>!before.has(key)))throw Error('Durch die Reparatur würden zwei Stunden denselben Fachtermin belegen.');
 return {lessons,sequences};
}
if(typeof module!=='undefined'&&module.exports)module.exports={prepareRepair};
if(typeof window==='undefined'||typeof fmtDate!=='function'||typeof viewHtml!=='function'||typeof wire!=='function')return;
const oldFormat=fmtDate;
fmtDate=function(d){
 if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(new Date(d+'T12:00:00').getTime()))return 'Ohne Termin';
 return oldFormat(d);
};
if(typeof SC_HOURLY_V275!=='undefined'&&typeof SC_HOURLY_V275.plan==='function'){
 const originalPlan=SC_HOURLY_V275.plan;
 SC_HOURLY_V275.plan=function(input){
  if(input?.action!=='replace'||!input?.sourceKey)return originalPlan(input);
  const source=(input.units||[]).find(u=>u.key===input.sourceKey);
  if(!source||source.held)return originalPlan(input);
  const anchors=(input.anchorKeys||[]).filter(k=>k!==input.sourceKey);
  return originalPlan({...input,anchorKeys:anchors});
 };
}
let pending=null,working=false,message='';
const oldView=viewHtml;
viewHtml=function(){
 const h=oldView();if(view!=='sequences')return h;
 const preview=pending?'<div class="panel"><strong>'+esc(pending.title||'Kursreparatur')+'</strong><p>'+pending.operations.length+' gezielte Änderungen, keine vollständige Backup-Wiederherstellung.</p>'+
   (Array.isArray(pending.notes)?pending.notes:[]).slice(0,12).map(x=>'<p class="microcopy">• '+esc(x)+'</p>').join('')+
   '<button type="button" class="primary" data-v277-apply>Geprüfte Änderungen übernehmen</button> <button type="button" class="secondary" data-v277-cancel>Abbrechen</button></div>':'';
 return '<details class="panel" style="margin-bottom:16px"><summary><strong>Planung gezielt reparieren (Reparaturdatei)</strong></summary><p>Nur zuvor geprüfte Stunden- und Reihenverknüpfungen werden geändert. Andere Kurse, Dateien und Klassenarbeiten bleiben erhalten. Vor dem Speichern wird automatisch ein aktuelles JSON-Backup heruntergeladen.</p>'+
 '<label>Reparaturdatei auswählen <input type="file" accept=".json,application/json" data-v277-file></label>'+ (message?'<p role="status">'+esc(message)+'</p>':'')+preview+'</details>'+h;
};
const oldWire=wire;
wire=function(){
 oldWire();
 document.querySelector('[data-v277-file]')?.addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
   if(file.size>250000)throw Error('Diese Reparaturdatei ist ungewöhnlich groß.');
   const next=JSON.parse(await file.text());prepareRepair(next,state.lessons,state.sequences);
   pending=next;message='Änderungen geprüft. Bitte Vorschau lesen und ausdrücklich bestätigen.';
  }catch(err){pending=null;message='Nicht übernommen: '+(err.message||String(err));}
  render();
  const d=document.querySelector('[data-v277-file]')?.closest('details');if(d)d.open=true;
 });
 document.querySelector('[data-v277-cancel]')?.addEventListener('click',()=>{pending=null;message='Abgebrochen, nichts verändert.';render();});
 document.querySelector('[data-v277-apply]')?.addEventListener('click',async()=>{
  if(!pending||working)return;
  working=true;const beforeLessons=state.lessons,beforeSequences=state.sequences;
  try{
   const next=prepareRepair(pending,state.lessons,state.sequences);
   if(!confirm('Diese '+pending.operations.length+' geprüften Änderungen jetzt lokal übernehmen? Vorher wird automatisch eine Sicherung heruntergeladen.'))return;
   downloadText('Schulcockpit_vor_Kursreparatur_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(state,null,2),'application/json');
   state.lessons=next.lessons;state.sequences=next.sequences;
   await saveState();
   pending=null;message='Kursreparatur gespeichert. Originaldateien und andere Kurse unverändert.';
   render();alert('Kursreparatur erfolgreich gespeichert.');
  }catch(err){
   state.lessons=beforeLessons;state.sequences=beforeSequences;
   message='Reparatur abgebrochen: '+(err.message||String(err));render();
   alert(message);
  }finally{working=false;}
 });
};
const beforeRender=render;
render=function(){beforeRender();const version=document.querySelector('.brand small');if(version)version.textContent=state.settings.schoolYear+' · V0.27.7';};
root.SchulcockpitCourseRepairV277={prepareRepair};
})(typeof window!=='undefined'?window:globalThis);
