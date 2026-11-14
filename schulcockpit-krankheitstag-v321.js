/* Schulcockpit V0.32.1 – ein Krankheitstag, ein Materialpaket.
 * Reuses V262 Word/handouts and V319 marks. Original lesson data untouched.
 */
(function(){
'use strict';
const C=window.SchulcockpitSickDayCoreV321;
const dayCore=window.SchulcockpitDayCoreV320;
const api=window.SchulcockpitSubstitutionV262;
if(!C||!api)throw Error('Krankheitsmodus: Grundlage nicht geladen.');
let day='',chosen=new Set(),edits={},initialized='';
function todayLocal(){
 const d=new Date();
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function initial(){return dayCore?.initialDay(todayLocal())||todayLocal();}
function pickDate(d){
 if(!C.valid(d))return;
 day=d;initialized='';chosen=new Set();edits={};render();
}
function type(l){
 try{return window.SchulcockpitLessonContextV289?.context(l)?.type||'ordinary';}
 catch(err){console.warn('Krankheitstag Stundentyp',err);return 'ordinary';}
}
function listing(){
 const date=C.valid(day)?day:initial();
 const lessons=(state.lessons||[]).filter(l=>l.date===date);
 const courseIds=new Set([...(state.timetable||[]).map(t=>t.classId),...lessons.map(l=>l.classId)].filter(Boolean));
 const closed=[],attending=[];
 for(const cid of courseIds){
  try{if(v190NoSchoolInfo(date,cid))closed.push(cid);}catch(err){console.warn('Schulkalenderstatus',err);}
  try{if(window.SchulcockpitLessonContextV289?.participating?.(date,cid))attending.push(cid);}catch(err){console.warn('Exkursionsteilnahme',err);}
 }
 return C.candidates({date,
  classes:state.classes||[],timetable:state.timetable||[],lessons,
  assessments:state.assessments||[],attendingClassIds:attending,closedClassIds:closed,
  lessonTypes:Object.fromEntries(lessons.filter(x=>x.id).map(l=>[l.id,type(l)]))});
}
function ensureChosen(m){
 if(initialized===m.date)return;
 chosen=new Set(m.eligible.map(e=>e.key));
 initialized=m.date;
}
function filesFor(r){
 return api.linkedLessonFiles(r.event).map(f=>({...f,available:!!(f.fileKey&&storedFileKeys.has(f.fileKey))}));
}
function current(r){
 const old=(state.substitutionPlansV262||{})[r.key]||{};
 const draft=C.proposed(r.lesson||{title:r.topic,period:r.period},filesFor(r));
 return {...C.normalizePlan(old,draft),...(edits[r.key]||{})};
}
function pathSegment(s){
 return String(s||'Stunde').normalize('NFKC').replace(/[\/\\:*?"<>|\u0000-\u001f]/g,'_').replace(/\s+/g,'_').slice(0,78)||'Stunde';
}
function folder(r){
 return String(r.slot).padStart(2,'0')+'_'+pathSegment(r.course)+'_'+pathSegment(r.classId);
}
function row(r){
 const p=current(r),files=filesFor(r),selectedFiles=api.selectedLinked(r.event,p);
 const total=selectedFiles.length+(p.files||[]).length;
 const missing=selectedFiles.filter(f=>!storedFileKeys.has(f.fileKey)).length+
  (p.files||[]).filter(f=>!storedFileKeys.has(f.fileKey)).length;
 return '<article class="v321-row" data-v321-row="'+esc(r.key)+'">'+
  '<label class="v321-choose"><input type="checkbox" data-v321-pick="'+esc(r.key)+'" '+(chosen.has(r.key)?'checked':'')+'><span class="v321-title"><strong>'+
  esc(r.slot+'. Stunde · '+r.course)+'</strong><small>'+esc(r.fallback?'Nur im Stundenplan – keine ausgearbeitete Stunde vorhanden':r.topic)+'</small></span></label>'+
  '<div class="v321-fields">'+
  '<label>Thema<input data-v321-field="topic" data-v321-key="'+esc(r.key)+'" maxlength="200" value="'+esc(p.topic||'')+'"></label>'+
  '<label>Die Kinder sollen …<textarea data-v321-field="instructions" data-v321-key="'+esc(r.key)+'" rows="3" maxlength="6000" placeholder="Einfacher eigenständiger Arbeitsauftrag – Buchseiten nicht erfinden">'+esc(p.instructions||'')+'</textarea></label>'+
  '<label>Buchseiten / Materialhinweis<input data-v321-field="materialNote" data-v321-key="'+esc(r.key)+'" maxlength="2500" placeholder="Nur tatsächlich bekannte Buchseiten oder vorhandene ABs" value="'+esc(p.materialNote||'')+'"></label></div>'+
  '<div class="v321-meta"><span>'+total+' ausgewählte Materialdatei'+(total===1?'':'en')+'</span>'+
  (missing?'<span class="v321-warn">'+missing+' Datei(en) lokal nicht verfügbar</span>':'')+
  (!p.instructions?.trim()?'<span class="v321-warn">Arbeitsauftrag fehlt</span>':'')+
  (p.prepared?'<span>✓ Material als vorbereitet markiert</span>':'')+
  '<button class="text-button" type="button" data-v321-edit="'+esc(r.key)+'">ABs auswählen / einzelne Stunde öffnen</button></div></article>';
}
function page(){
 const m=listing();ensureChosen(m);
 const dateLabel=C.valid(m.date)?new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long'})
   .format(new Date(m.date+'T12:00:00')):'Datum offen';
 return '<div class="content-grid v321-sick">'+
  '<section class="panel v321-hero"><div><span class="eyebrow">WENN DU NICHT IN DIE SCHULE KANNST</span><h2>Ich bin krank · Vertretung für den ganzen Tag</h2>'+
  '<p>Alle Stunden mit einem Mal vorbereiten. Keine PowerPoints, keine Unterrichtsgespräche – nur klare Aufgaben und vorhandene Arbeitsblätter.</p></div>'+
  '<label>Betroffener Tag<input type="date" id="v321-date" value="'+esc(m.date)+'"></label></section>'+
  '<section class="panel"><div class="v321-heading"><div><h3>'+esc(dateLabel)+'</h3><p>'+
  m.eligible.length+' mögliche Vertretungsstunde'+(m.eligible.length===1?'':'n')+' · '+chosen.size+' ausgewählt</p></div>'+
  (m.eligible.length?'<div class="v321-select-actions"><button class="secondary" data-v321-all type="button">Alle auswählen</button><button class="text-button" data-v321-none type="button">Keine</button></div>':'')+
  '</div>'+
  (m.error?'<p class="v321-warn">'+esc(m.error)+'</p>':'')+
  (m.eligible.length?'<div class="v321-list">'+m.eligible.map(row).join('')+'</div>':
    '<p>Für dieses Datum gibt es keine auswählbaren Fachstunden. Das bedeutet nicht automatisch, dass dein Stundenplan vollständig angelegt ist.</p>')+
  (m.excluded.length?'<details class="v321-excluded"><summary>'+m.excluded.length+' nicht auswählbare Termine anzeigen</summary>'+
    m.excluded.map(r=>'<p><strong>'+esc(r.slot+'. Stunde · '+r.course)+'</strong> – '+esc(r.reason)+'</p>').join('')+
    '</details>':'')+
  '</section><section class="panel v321-export">'+
  '<div><h3>Einmal speichern, alles herunterladen</h3>'+
  '<p>Die ZIP enthält pro Stunde einen Word-Zettel und die ausgewählten Original-ABs. Fehlende Aufgaben kannst du mit einem separaten Quellenpaket in ChatGPT erstellen lassen.</p></div>'+
  '<div class="v321-buttons"><button type="button" class="secondary" data-v321-save>Ausgewählte Stunden speichern</button>'+
  '<button type="button" class="secondary" data-v321-sources>Quellen für ChatGPT (ZIP)</button>'+
  '<button type="button" class="primary" data-v321-zip>Word-Zettel + ABs herunterladen (ZIP)</button></div>'+
  '<p class="microcopy" id="v321-status">Dateien und Schülerdaten bleiben lokal, solange du sie nicht selbst exportierst. Die reguläre Unterrichtsplanung wird nicht verändert. Eine echte Krankmeldung an die Schule ersetzt das nicht.</p>'+
  '</section></div>';
}
function chosenRows(){
 const m=listing();return m.eligible.filter(r=>chosen.has(r.key));
}
async function store(){
 const rows=chosenRows();if(!rows.length)throw Error('Bitte mindestens eine Stunde auswählen.');
 const beforeMarks=state.manualSubstitutionHoursV319;
 const beforePlans=state.substitutionPlansV262;
 const marks={...(beforeMarks||{})},plans={...(beforePlans||{})};
 for(const r of rows){
  if(!marks[r.key])marks[r.key]={...r.event};
  plans[r.key]={...current(r),files:[...(current(r).files||[])]};
 }
 state.manualSubstitutionHoursV319=marks;
 state.substitutionPlansV262=plans;
 try{await saveState();}
 catch(err){
  if(beforeMarks===undefined)delete state.manualSubstitutionHoursV319;else state.manualSubstitutionHoursV319=beforeMarks;
  if(beforePlans===undefined)delete state.substitutionPlansV262;else state.substitutionPlansV262=beforePlans;
  throw err;
 }
 return rows;
}
async function packet(kind){
 const rows=chosenRows();if(!rows.length)throw Error('Bitte mindestens eine Stunde auswählen.');
 const payload=rows.map(r=>({r,p:current(r)}));
 if(kind==='final'){
  const without=payload.filter(x=>!String(x.p.instructions||'').trim());
  if(without.length)throw Error('Hier fehlt noch ein Arbeitsauftrag: '+without.map(x=>x.r.course+' · '+x.r.slot+'. Stunde').join(', ')+'. Nutze sonst zuerst das ChatGPT-Quellenpaket.');
 }
 if(typeof JSZip==='undefined')throw Error('ZIP-Export nicht verfügbar. Bitte neu laden.');
 // Preflight every selected original before writing the final package.
 const prepared=[],missing=[],cache=new Map();
 let sum=0;
 for(const {r,p} of payload){
  const files=[...(p.files||[]),...api.selectedLinked(r.event,p)];
  const seen=new Set(),included=[];let index=0;
  for(const f of files){
   if(!f.fileKey||seen.has(f.fileKey))continue;
   seen.add(f.fileKey);
   let stored=cache.get(f.fileKey);
   if(!stored){stored=await fileStoreGet(f.fileKey);if(stored?.blob)cache.set(f.fileKey,stored);}
   if(!stored?.blob){missing.push(r.course+': '+(f.name||'Datei'));continue;}
   const name=String(++index).padStart(2,'0')+'_'+pathSegment(f.name||stored.name||'Arbeitsblatt');
   included.push({name,blob:stored.blob});
   sum+=stored.blob.size||0;
   if(sum>190*1024*1024)throw Error('Das Materialpaket ist größer als 190 MB. Bitte weniger Dateien auswählen.');
  }
  prepared.push({r,p,included});
 }
 if(kind==='final'&&missing.length)throw Error('Folgende Materialien fehlen lokal: '+missing.join('; ')+'. Bitte entfernen oder neu hinzufügen.');
 const z=new JSZip();
 const names=[];
 for(const {r,p,included} of prepared){
  const f=folder(r),prefix='Stunden/'+f+'/';
  names.push(r.slot+'. Stunde – '+r.course+' – '+(p.topic||r.topic));
  if(kind==='final')z.file(prefix+'01_Vertretungszettel.docx',await api.docx(r.event,p));
  else z.file(prefix+'00_AUFTRAG_FUER_CHATGPT.txt',api.prompt(r.event,p));
  for(const file of included)z.file(prefix+'Materialien/'+file.name,await file.blob.arrayBuffer());
 }
 z.file('BITTE_LESEN.txt',kind==='final'?
  'Vertretungsmaterial für '+day+'\n\n'+names.join('\n')+
  '\n\nJeder Stundenordner enthält einen Word-Zettel und die ausgewählten Materialien. Vor dem Weitergeben bitte kurz prüfen, ob alle Arbeitsaufträge passen. Fehlende Buchseiten werden nicht erfunden.':
  'Quellenpaket für '+day+'\n\n'+names.join('\n')+
  '\n\nJede Stunde enthält einen Prompt und vorhandene Originalmaterialien. Nicht automatisch generiert. Bitte keine Schülernamen, Leistungsdaten oder sensiblen Schülerlisten an ChatGPT hochladen.'+
  (missing.length?'\n\nNicht lokal verfügbare Materialdateien (NICHT beigefügt):\n'+missing.join('\n'):''));
 const blob=await z.generateAsync({type:'blob',compression:'DEFLATE'});
 await store();
 downloadBlob((kind==='final'?'Vertretungsmaterial_':'ChatGPT_Quellen_')+day+'.zip',blob);
 return {count:payload.length,missing};
}
function feedback(text){
 const el=document.getElementById('v321-status');
 if(el)el.textContent=text;
}
async function act(button,func){
 if(button.disabled)return;
 button.disabled=true;
 try{feedback('Prüfe die Stunden und die lokalen Materialien …');await func();}
 catch(err){feedback('Nicht abgeschlossen: '+(err.message||err));alert('Krankheitsmodus: '+(err.message||err));}
 finally{button.disabled=false;}
}
const oldView=viewHtml;
viewHtml=function(){return view==='sickDayV321'?page():oldView();};
const oldTitle=pageTitle;
pageTitle=function(){return view==='sickDayV321'?'Krankheitstag · Vertretung':oldTitle();};
const oldWire=wire;
wire=function(){
 oldWire();
 if(view!=='sickDayV321')return;
 document.getElementById('v321-date')?.addEventListener('change',e=>pickDate(e.target.value));
 document.querySelector('[data-v321-all]')?.addEventListener('click',()=>{chosen=new Set(listing().eligible.map(x=>x.key));render();});
 document.querySelector('[data-v321-none]')?.addEventListener('click',()=>{chosen.clear();render();});
 document.querySelectorAll('[data-v321-pick]').forEach(el=>el.addEventListener('change',()=>{
  if(el.checked)chosen.add(el.dataset.v321Pick);else chosen.delete(el.dataset.v321Pick);
  const note=document.querySelector('.v321-heading p');
  if(note)note.textContent=listing().eligible.length+' mögliche Vertretungsstunden · '+chosen.size+' ausgewählt';
 }));
 document.querySelectorAll('[data-v321-field]').forEach(el=>el.addEventListener('input',()=>{
  edits[el.dataset.v321Key]={...(edits[el.dataset.v321Key]||{}),[el.dataset.v321Field]:el.value};
 }));
 document.querySelectorAll('[data-v321-edit]').forEach(b=>b.addEventListener('click',()=>void act(b,async()=>{
  const r=listing().eligible.find(x=>x.key===b.dataset.v321Edit);
  if(!r)throw Error('Stunde wurde nicht gefunden.');
  chosen.add(r.key);await store();
  if(!api.open(r.date,r.classId,r.slot))throw Error('Stunde konnte nicht geöffnet werden.');
 })));
 document.querySelector('[data-v321-save]')?.addEventListener('click',e=>void act(e.currentTarget,async()=>{
  const rows=await store();feedback(rows.length+' Stunden gespeichert. Die ursprüngliche Unterrichtsplanung bleibt erhalten.');
 }));
 document.querySelector('[data-v321-zip]')?.addEventListener('click',e=>void act(e.currentTarget,async()=>{
  const out=await packet('final');feedback('Materialpaket für '+out.count+' Unterrichtsstunden erstellt.');
 }));
 document.querySelector('[data-v321-sources]')?.addEventListener('click',e=>void act(e.currentTarget,async()=>{
  const out=await packet('sources');feedback('Quellenpaket für '+out.count+' Stunden erstellt.'+(out.missing.length?' Fehlende Originale: '+out.missing.length:''));
 }));
};
function open(date){
 day=C.valid(date)?date:initial();initialized='';chosen.clear();edits={};
 view='sickDayV321';modal=null;render();
}
const oldRender=render;
render=function(){
 oldRender();
 const nav=document.querySelector('.sidebar nav');
 if(nav&&!nav.querySelector('[data-v321-nav]')){
  const btn=document.createElement('button');btn.type='button';btn.dataset.v321Nav='1';
  btn.innerHTML='<span>☂</span> Ich bin krank';
  const anchor=nav.querySelector('[data-v262-nav]')||nav.querySelector('[data-view="dayV320"]');
  if(anchor)anchor.after(btn);else nav.append(btn);
  btn.addEventListener('click',()=>open(day||initial()));
 }
 const b=nav?.querySelector('[data-v321-nav]');
 if(b)b.classList.toggle('active',view==='sickDayV321');
 if(view==='dayV320'){
  const head=document.querySelector('.v320-head .v320-nav')||document.querySelector('.v320-head');
  if(head&&!head.querySelector('[data-v321-from-day]')){
   const btn=document.createElement('button');btn.type='button';btn.className='secondary';btn.dataset.v321FromDay='1';
   btn.textContent='☂ Für diesen Tag vertreten lassen';
   btn.addEventListener('click',()=>open(window.SchulcockpitDayV320?.model()?.date||initial()));
   head.append(btn);
  }
 }
 const badge=document.querySelector('.brand small');
 if(badge)badge.textContent=(state.settings?.schoolYear||'')+' · V0.32.1';
};
window.SchulcockpitSickDayV321={open,listing,current,chosenRows,store,packet};
})();
