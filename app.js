const STORAGE_KEY = 'schulcockpit-state-v1';
const DB_NAME = 'schulcockpit-files-v1';
const DB_STORE = 'files';

function clone(v){ return JSON.parse(JSON.stringify(v)); }
function uid(prefix='id'){ return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
function iso(d){ return d.toISOString().slice(0,10); }
function mondayOf(date=new Date()){
  const d=new Date(date); d.setHours(12,0,0,0); const day=d.getDay()||7; d.setDate(d.getDate()-day+1); return d;
}
function dateForWeekday(day){ const d=mondayOf(); d.setDate(d.getDate()+day-1); return iso(d); }
function kw(date=new Date()){
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const day=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()+4-day);
  const start=new Date(Date.UTC(d.getUTCFullYear(),0,1)); return Math.ceil((((d-start)/86400000)+1)/7);
}

const sampleState = {
  settings:{ schoolYear:'2026/27', weeklyPrintDay:1 },
  classes:[], timetable:[], sequences:[], materials:[], lessons:[], backlog:[]
};

const statusMeta={ready:['Bereit','status-ready'],planned:['Geplant','status-planned'],'needs-material':['Material fehlt','status-warning'],open:['Offen','status-open'],done:['Gehalten','status-done']};
const variantLabels={standard:'Standard',challenge:'Forderung',support:'Förderung',daz:'DaZ / einfache Sprache',solution:'Lösung'};
const dayNames=['','Montag','Dienstag','Mittwoch','Donnerstag','Freitag'];

let state=loadState();
let view='focus';
let modal=null;
let storedFileKeys=new Set();

function migrate(s){
  const out=s||clone(sampleState);
  out.settings=out.settings||clone(sampleState.settings);
  out.classes=out.classes||[]; out.materials=out.materials||[]; out.lessons=out.lessons||[]; out.backlog=out.backlog||[]; out.tasks=out.tasks||[];
  out.tasks=out.tasks.map(t=>({id:t.id||uid('task'),title:t.title||'',category:t.category||'Organisation',dueDate:t.dueDate||'',effort:Number(t.effort)||15,priority:t.priority||'normal',notes:t.notes||'',classId:t.classId||'',done:!!t.done,createdAt:t.createdAt||new Date().toISOString()}));
  if(!Array.isArray(out.timetable)) out.timetable=clone(sampleState.timetable);
  if(!Array.isArray(out.sequences)) out.sequences=[];
  if(!out.sequences.length){
    const grouped=new Map();
    out.lessons.filter(l=>l.unit&&l.classId).forEach(l=>{
      const key=`${l.classId}|${l.unit}`;
      if(!grouped.has(key)) grouped.set(key,[]);
      grouped.get(key).push(l);
    });
    grouped.forEach((ls,key)=>{
      const [classId,title]=key.split('|'); const dates=ls.map(x=>x.date).filter(Boolean).sort();
      out.sequences.push({id:uid('seq'),classId,title,startDate:dates[0]||'',endDate:dates[dates.length-1]||'',goal:'',assessmentDate:'',notes:''});
    });
  }
  out.materials.forEach(m=>{
    m.variants=m.variants||[]; m.improvementFlags=m.improvementFlags||[];
    m.variants.forEach(v=>{ if(v.fileKey===undefined) v.fileKey=null; });
  });
  out.lessons.forEach(l=>{
    if(!l.materials) l.materials=[]; if(!l.plannedSteps) l.plannedSteps=[]; if(!l.completedSteps) l.completedSteps=[];
    if(!Array.isArray(l.phasePlan)) l.phasePlan=l.plannedSteps.map((title,i)=>({id:uid('phase'),phase:['Einstieg','Erarbeitung','Sicherung','Transfer'][Math.min(i,3)]||'Sonstiges',minutes:'',title,details:'',done:l.completedSteps.includes(title)}));
    l.phasePlan.forEach(ph=>{ if(ph.done===undefined) ph.done=false; if(ph.details===undefined) ph.details=''; if(ph.minutes===undefined) ph.minutes=''; if(!ph.id) ph.id=uid('phase'); });
    if(!Array.isArray(l.slides)) l.slides=[];
    l.slides=l.slides.map(sl=>({id:sl.id||uid('slide'),type:sl.type||'text',title:sl.title||'',content:Array.isArray(sl.content)?sl.content:(sl.content?[String(sl.content)]:[]),notes:sl.notes||'',statement:sl.statement||'',answer:sl.answer||'',correction:sl.correction||'',socialForm:sl.socialForm||'',time:sl.time||'',material:sl.material||'',steps:Array.isArray(sl.steps)?sl.steps:[],secondary:Array.isArray(sl.secondary)?sl.secondary:[],tertiary:Array.isArray(sl.tertiary)?sl.tertiary:[],imageMaterial:sl.imageMaterial||'',solutionA:Array.isArray(sl.solutionA)?sl.solutionA:[],solutionB:Array.isArray(sl.solutionB)?sl.solutionB:[],comparison:Array.isArray(sl.comparison)?sl.comparison:[],takeaway:Array.isArray(sl.takeaway)?sl.takeaway:[]}));
    if(l.footerTopic===undefined) l.footerTopic='';
    if(!Array.isArray(l.prepTasks)) l.prepTasks=[];
    l.prepTasks=l.prepTasks.map(t=>({id:t.id||uid('prep'),title:t.title||'',category:t.category||'Sonstiges',done:!!t.done,note:t.note||''}));
    if(!l.sequenceId&&l.unit){ const match=out.sequences.find(q=>q.classId===l.classId&&q.title===l.unit); if(match)l.sequenceId=match.id; }
    if(!Array.isArray(l.printPlan)){
      l.printPlan=[];
      l.materials.map(id=>out.materials.find(m=>m.id===id)).filter(Boolean).forEach(m=>m.variants.forEach(v=>{
        if(v.available&&v.fileName&&(v.printCount||0)>0) l.printPlan.push({id:uid('pp'),materialId:m.id,variantId:v.id,count:v.printCount,mode:v.printMode||'bw',alreadyPrinted:!!v.alreadyPrinted,needed:true});
      }));
    }
  });
  return out;
}
function loadState(){ try{return migrate(JSON.parse(localStorage.getItem(STORAGE_KEY))||clone(sampleState));}catch{return clone(sampleState);} }
function saveState(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
function persist(){ saveState(); render(); }
function cls(id){ return state.classes.find(x=>x.id===id); }
function mat(id){ return state.materials.find(x=>x.id===id); }
function lesson(id){ return state.lessons.find(x=>x.id===id); }
function seq(id){ return state.sequences.find(x=>x.id===id); }
function classSequences(classId){ return state.sequences.filter(s=>s.classId===classId).sort((a,b)=>(a.startDate||'').localeCompare(b.startDate||'')); }
function previousLesson(l){ return state.lessons.filter(x=>x.classId===l.classId&&x.id!==l.id&&x.date<l.date).sort((a,b)=>b.date.localeCompare(a.date))[0]||null; }
function linkedLessons(sequenceId){ return state.lessons.filter(l=>l.sequenceId===sequenceId).sort((a,b)=>a.date.localeCompare(b.date)); }
function syncLegacyPlan(l){ l.plannedSteps=(l.phasePlan||[]).map(p=>p.title).filter(Boolean); l.completedSteps=(l.phasePlan||[]).filter(p=>p.done&&p.title).map(p=>p.title); }
function variant(mid,vid){ return mat(mid)?.variants.find(v=>v.id===vid); }
function esc(s=''){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDate(d){ return new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(d+'T12:00:00')); }
function downloadBlob(name,blob){ const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),800); }
function downloadText(name,content,type='text/plain'){ downloadBlob(name,new Blob([content],{type})); }
function currentWeekLessons(){ const m=iso(mondayOf()); const f=new Date(mondayOf());f.setDate(f.getDate()+4);const fs=iso(f); return state.lessons.filter(l=>l.date>=m&&l.date<=fs).sort((a,b)=>a.date.localeCompare(b.date)||String(a.period).localeCompare(String(b.period))); }

// ---- Local file storage (IndexedDB) ----
function dbOpen(){ return new Promise((resolve,reject)=>{ const req=indexedDB.open(DB_NAME,1); req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE,{keyPath:'key'}); }; req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); }); }
async function fileStorePut(key,file){ const db=await dbOpen(); return new Promise((resolve,reject)=>{ const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put({key,name:file.name,type:file.type,size:file.size,blob:file,updatedAt:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error); }); }
async function fileStoreGet(key){ if(!key)return null; const db=await dbOpen(); return new Promise((resolve,reject)=>{ const req=db.transaction(DB_STORE).objectStore(DB_STORE).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error); }); }
async function fileStoreDelete(key){ if(!key)return; const db=await dbOpen(); return new Promise((resolve,reject)=>{ const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error); }); }
async function refreshStoredFileKeys(){ try{ const db=await dbOpen(); const keys=await new Promise((resolve,reject)=>{ const req=db.transaction(DB_STORE).objectStore(DB_STORE).getAllKeys();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error); }); storedFileKeys=new Set(keys); render(); }catch(e){ console.warn('Dateispeicher nicht verfügbar',e); } }
function hasStoredFile(v){ return !!(v?.fileKey&&storedFileKeys.has(v.fileKey)); }

function printItems(){
  return currentWeekLessons().flatMap(l=>(l.printPlan||[]).filter(p=>p.needed&&(Number(p.count)||0)>0).map(p=>{
    const m=mat(p.materialId),v=variant(p.materialId,p.variantId),c=cls(l.classId); if(!m||!v)return null;
    return {lesson:l,cls:c,material:m,variant:v,plan:p,fileReady:hasStoredFile(v)};
  }).filter(Boolean));
}
function openPrintItems(){ return printItems().filter(i=>!i.plan.alreadyPrinted); }
function missingPrintFilesForLesson(l){ return (l.printPlan||[]).filter(p=>p.needed&&!p.alreadyPrinted&&(Number(p.count)||0)>0).filter(p=>{ const v=variant(p.materialId,p.variantId); return !v||!hasStoredFile(v); }); }

function workflowTasks(){
  const lessons=currentWeekLessons(); const tasks=[];
  lessons.forEach(l=>{
    const c=cls(l.classId); const who=`${c?.subject||''} ${c?.name||''}`.trim();
    if(l.status==='open') tasks.push({id:`plan-${l.id}`,stage:1,date:l.date,type:'plan',lessonId:l.id,title:`${who}: Stunde planen`,detail:`${fmtDate(l.date)} · ${l.title||'Thema noch festlegen'}`,why:'Erst die Planung klären, damit Material und Kopierbedarf feststehen.'});
    const missing=missingPrintFilesForLesson(l);
    if(l.status==='needs-material'||missing.length) tasks.push({id:`material-${l.id}`,stage:2,date:l.date,type:'material',lessonId:l.id,title:`${who}: Material fertigstellen`,detail:missing.length?`${missing.length} geplante Druckdatei${missing.length===1?' fehlt':'en fehlen'} noch`:`${fmtDate(l.date)} · ${l.title}`,why:'Vor dem Kopierlauf müssen die tatsächlich benötigten Dateien vorhanden sein.'});
  });
  const openPrint=openPrintItems().filter(i=>i.fileReady);
  if(openPrint.length) tasks.push({id:'print-week',stage:3,date:dateForWeekday(1),type:'print',title:'Wochenkopien erledigen',detail:`${openPrint.length} druckbereite Position${openPrint.length===1?'':'en'} · Farbe und S/W gesammelt`,why:'Alles in einem Kopierlauf erledigen, statt morgens vor dem Unterricht.'});
  lessons.forEach(l=>{
    if(l.status==='planned'){
      const c=cls(l.classId);tasks.push({id:`final-${l.id}`,stage:4,date:l.date,type:'final',lessonId:l.id,title:`${c?.subject||''} ${c?.name||''}: Feinschliff abschließen`,detail:`${fmtDate(l.date)} · Präsentation/Details prüfen`,why:'Die Grobplanung steht; jetzt nur noch so viel fertigstellen, dass die Stunde bereit ist.'});
    }
    if(l.status==='done' && !(l.reflection&&Object.keys(l.reflection).length)){
      const c=cls(l.classId);tasks.push({id:`reflect-${l.id}`,stage:5,date:l.date,type:'reflect',lessonId:l.id,title:`${c?.subject||''} ${c?.name||''}: kurz reflektieren`,detail:'10-Sekunden-Reflexion · Klicks reichen',why:'Damit das nächste Durchlaufen der Einheit automatisch besser wird.'});
    }
  });
  return tasks.sort((a,b)=>a.stage-b.stage||a.date.localeCompare(b.date));
}
function stageLabel(stage){ return ({1:'1 · Planung klären',2:'2 · Material fertigstellen',3:'3 · Wochenkopien',4:'4 · Feinschliff',5:'5 · Reflexion'})[stage]||'Später'; }

function render(){
  const app=document.getElementById('app');
  app.innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">SC</div><div><strong>Schulcockpit</strong><small>2026/27 · V0.3</small></div></div><nav>${navBtn('focus','✦','Was jetzt?')}${navBtn('week','▦','Meine Woche')}${navBtn('timetable','⌗','Stundenplan & Klassen')}${navBtn('print','⎙','Kopierzentrum')}${navBtn('materials','▤','Materialbibliothek')}${navBtn('improve','↗','Unterricht verbessern')}</nav><div class="sidebar-footer"><button data-action="brief-picker">ChatGPT-Brief</button><button data-action="backup">Backup</button><button data-action="reset">Demo zurücksetzen</button></div></aside><main><header class="topbar"><div><span class="eyebrow">KW ${kw()} · ${state.settings.schoolYear}</span><h1>${pageTitle()}</h1></div><div class="top-actions"><span class="storage-pill">Dateien: ${storedFileKeys.size} lokal gespeichert</span><button class="primary" data-action="sync-week">Woche synchronisieren</button></div></header><div class="page">${viewHtml()}</div></main></div>${modal?modalHtml():''}`;
  wire();
}
function navBtn(key,icon,label){ return `<button class="${view===key?'active':''}" data-view="${key}"><span>${icon}</span>${label}</button>`; }
function pageTitle(){ return ({focus:'Was mache ich als Nächstes?',week:'Meine Woche',timetable:'Stundenplan & Klassen',print:'Kopierzentrum',materials:'Materialbibliothek',improve:'Unterricht verbessern'})[view]; }
function viewHtml(){ return view==='focus'?focusView():view==='week'?weekView():view==='timetable'?timetableView():view==='print'?printView():view==='materials'?materialsView():improveView(); }

function focusView(){
  const tasks=workflowTasks(),next=tasks[0];
  return `<div class="content-grid"><section class="focus-hero ${!next?'all-done':''}"><div>${next?`<span class="eyebrow">DEIN NÄCHSTER SCHRITT</span><h2>${esc(next.title)}</h2><p>${esc(next.why)}</p><span class="next-meta">${esc(next.detail)}</span>`:`<span class="eyebrow">ALLES WICHTIGE ERLEDIGT</span><h2>Für diese Woche ist gerade nichts Akutes offen.</h2><p>Wenn du Zeit hast, kannst du im Verbesserungs-Backlog weiterarbeiten.</p>`}</div>${next?`<button class="primary big" data-task="${next.id}">Jetzt erledigen →</button>`:'<div class="done-badge">✓</div>'}</section><section class="workflow-strip">${[1,2,3,4,5].map(s=>{const has=tasks.some(t=>t.stage===s),done=tasks.every(t=>t.stage>s);return `<div class="workflow-step ${has?'active-step':''} ${done?'complete-step':''}"><span>${s}</span><div><strong>${stageLabel(s).replace(/^\d · /,'')}</strong><small>${tasks.filter(t=>t.stage===s).length} offen</small></div></div>`}).join('')}</section><section class="panel"><div class="section-head"><div><span class="eyebrow">ARBEITSREIHENFOLGE</span><h2>Nicht nachdenken – einfach von oben nach unten.</h2></div><span class="muted">${tasks.length} Aufgaben</span></div><div class="task-queue">${tasks.map(taskCard).join('')||'<div class="empty-state">Alles erledigt. ✦</div>'}</div></section><div class="tip-card"><strong>Neu in V0.3</strong><p>Druckmengen hängen jetzt an der konkreten Stunde. Materialien können echte Dateien lokal im Browser speichern und das Kopierzentrum kann daraus ein ZIP-Druckpaket bauen.</p></div></div>`;
}
function taskCard(t,i){ return `<button class="task-card" data-task="${t.id}"><span class="task-number">${i+1}</span><span class="task-main"><small>${stageLabel(t.stage)}</small><strong>${esc(t.title)}</strong><span>${esc(t.detail)}</span></span><span class="task-arrow">→</span></button>`; }

function weekView(){
  const ls=currentWeekLessons(),tasks=workflowTasks(),prints=openPrintItems();
  return `<div class="content-grid"><section class="stats-row">${stat('Unterrichtsstunden',ls.length,'diese Woche')}${stat('Arbeitsaufgaben',tasks.length,'priorisiert offen')}${stat('Druckpositionen',prints.length,'noch nicht kopiert')}${stat('Materialdateien',storedFileKeys.size,'lokal gespeichert')}</section><section class="panel"><div class="section-head"><div><span class="eyebrow">KW ${kw()}</span><h2>Unterricht diese Woche</h2></div></div><div class="lesson-list">${ls.map(lessonCard).join('')||'<p class="muted">Noch keine Stunden. Lege zuerst deinen Stundenplan an und synchronisiere die Woche.</p>'}</div></section></div>`;
}
function stat(label,value,detail){ return `<div class="stat-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`; }
function lessonCard(l){ const c=cls(l.classId),meta=statusMeta[l.status]||statusMeta.open; const copies=(l.printPlan||[]).filter(p=>p.needed&&(Number(p.count)||0)>0); const printed=copies.filter(p=>p.alreadyPrinted).length; return `<button class="lesson-card" data-lesson="${l.id}"><div class="lesson-date"><strong>${fmtDate(l.date)}</strong><span>${esc(l.period)}</span></div><div class="class-pill" style="--class-color:${c?.color||'#999'}">${esc(c?.subject||'')} ${esc(c?.name||'')}</div><div class="lesson-main"><strong>${esc(l.title||'Thema noch festlegen')}</strong><span>${esc(l.unit||'Sequenz noch nicht eingetragen')}</span></div><div class="lesson-meta"><span class="status ${meta[1]}">${meta[0]}</span><span class="copy-mini">⎙ ${printed}/${copies.length}</span></div></button>`; }

function timetableView(){
  return `<div class="content-grid"><section class="panel"><div class="section-head"><div><span class="eyebrow">KLASSEN</span><h2>Deine Lerngruppen</h2></div></div><div class="class-editor">${state.classes.map(c=>`<div class="class-edit-row"><input value="${esc(c.subject)}" data-class-field="${c.id}|subject"><input value="${esc(c.name)}" data-class-field="${c.id}|name"><input class="small-input" type="number" min="1" value="${c.students}" data-class-field="${c.id}|students"><button class="danger-lite" data-delete-class="${c.id}">×</button></div>`).join('')}</div><div class="add-class-row"><input id="new-subject" placeholder="Fach"><input id="new-class" placeholder="Klasse"><input id="new-students" type="number" value="25" min="1"><button data-action="add-class">+ Klasse</button></div></section><section class="panel"><div class="section-head"><div><span class="eyebrow">WOCHENRHYTHMUS</span><h2>Stundenplan</h2></div><button class="primary" data-action="sync-week">Aktuelle Woche erzeugen</button></div><div class="timetable-grid">${[1,2,3,4,5].map(d=>`<div class="day-column"><div class="day-head">${dayNames[d]}</div><div class="day-slots">${state.timetable.filter(t=>t.weekday===d).sort((a,b)=>a.order-b.order).map(timetableCard).join('')||'<div class="empty-slot">frei / noch leer</div>'}</div></div>`).join('')}</div><div class="add-timetable-row"><select id="tt-day">${[1,2,3,4,5].map(d=>`<option value="${d}">${dayNames[d]}</option>`).join('')}</select><select id="tt-class">${state.classes.map(c=>`<option value="${c.id}">${esc(c.subject)} ${esc(c.name)}</option>`).join('')}</select><input id="tt-period" placeholder="z. B. 2. Block"><button data-action="add-timetable">+ Stunde</button></div></section></div>`;
}
function timetableCard(t){ const c=cls(t.classId); return `<div class="tt-card" style="--class-color:${c?.color||'#999'}"><strong>${esc(t.period)}</strong><span>${esc(c?.subject||'Unbekannt')} ${esc(c?.name||'')}</span><button data-delete-tt="${t.id}" title="Löschen">×</button></div>`; }

function printView(){
  const items=printItems(),open=items.filter(i=>!i.plan.alreadyPrinted),missing=open.filter(i=>!i.fileReady);
  return `<div class="content-grid"><section class="hero-card print-hero"><div><span class="eyebrow">MONTAGS-WORKFLOW</span><h2>Einmal sammeln. Einmal kopieren.</h2><p>${missing.length?`${missing.length} Druckposition${missing.length===1?' hat':'en haben'} noch keine gespeicherte Datei. Lade sie zuerst beim Material hoch.`:'Alle offenen Druckpositionen haben eine Datei. Dein ZIP-Paket ist bereit.'}</p></div><div class="hero-actions"><button class="secondary" data-action="download-print">Druckliste</button><button class="primary" data-action="download-print-zip">ZIP-Druckpaket</button></div></section>${['color','bw'].map(mode=>`<section class="panel"><div class="section-head"><div><span class="eyebrow">${mode==='color'?'FARBKOPIERER':'SCHWARZ-WEISS'}</span><h2>${mode==='color'?'Farbe':'S/W'}</h2></div></div><div class="print-list">${items.filter(i=>i.plan.mode===mode).map(i=>`<label class="print-row ${i.plan.alreadyPrinted?'done':''} ${!i.fileReady?'missing-file':''}"><input type="checkbox" data-print="${i.lesson.id}|${i.plan.id}" ${i.plan.alreadyPrinted?'checked':''}><span class="copies">${String(i.plan.count).padStart(2,'0')}×</span><span class="print-content"><strong>${esc(i.material.title)} · ${esc(i.variant.label)}</strong><small>${esc(i.cls?.subject||'')} ${esc(i.cls?.name||'')} · ${fmtDate(i.lesson.date)} · ${esc(i.variant.fileName||'keine Datei')}</small></span><span class="file-state ${i.fileReady?'ok':''}">${i.plan.alreadyPrinted?'bereits da':i.fileReady?'druckbereit':'Datei fehlt'}</span></label>`).join('')||'<p class="muted">Keine Einträge.</p>'}</div></section>`).join('')}<section class="tip-card"><strong>Hinweis zu Dateien</strong><p>Die hochgeladenen PDFs werden nicht in GitHub gespeichert, sondern lokal im Browser (IndexedDB). Dadurch bleiben deine Unterrichtsdateien privat auf diesem Gerät und überleben normale Code-Updates derselben GitHub-Pages-Adresse.</p></section></div>`;
}

function materialsView(){ return `<div class="content-grid"><section class="hero-card"><div><span class="eyebrow">MATERIALBIBLIOTHEK</span><h2>Nicht nur Dateien – sondern Unterrichtsressourcen.</h2><p>Standard, Forderung, Förderung, DaZ und Lösungen können gemeinsam zu einem Material gehören. Buch- und Arbeitsheftseiten funktionieren auch ohne Datei.</p></div><button class="primary" data-action="new-material">+ Neues Material</button></section><section class="materials-grid">${state.materials.map(materialCard).join('')}</section></div>`; }
function materialCard(m){ const types=['standard','challenge','support','daz']; const stored=m.variants.filter(v=>hasStoredFile(v)).length; return `<button class="material-card" data-material="${m.id}"><div class="material-icon">${m.kind==='book'?'▥':'▤'}</div><div><span class="eyebrow">${m.kind==='book'?'BUCH / ARBEITSHEFT':'DATEI / ARBEITSBLATT'}</span><h3>${esc(m.title)}</h3>${m.pages?`<p>${esc(m.pages)} · ${esc(m.tasks||'')}</p>`:''}<div class="variant-strip">${types.map(t=>{const v=m.variants.find(x=>x.type===t);return `<span class="${v?.available?'available':''}">${variantLabels[t]}</span>`}).join('')}</div><div class="material-meta">${stored} Datei${stored===1?'':'en'} lokal gespeichert</div>${m.improvementFlags?.length?`<div class="notice">✦ ${m.improvementFlags.length} Verbesserung${m.improvementFlags.length>1?'en':''} offen</div>`:''}</div></button>`; }

function improveView(){ const open=state.backlog.filter(b=>!b.done); return `<div class="content-grid"><section class="hero-card improve-hero"><div><span class="eyebrow">QUALITÄTSENTWICKLUNG</span><h2>Ideen festhalten, ohne sie sofort erledigen zu müssen.</h2><p>Wenn später Zeit frei ist, zeigt dir das Cockpit passende kleine Verbesserungen.</p></div></section>${['10','30','60'].map(e=>`<section class="panel"><div class="section-head"><div><span class="eyebrow">ZEITFENSTER</span><h2>${e==='10'?'Bis 10 Minuten':e==='30'?'10–30 Minuten':'30–60 Minuten'}</h2></div><span class="muted">${open.filter(b=>b.effort===e).length} offen</span></div><div class="backlog-list">${state.backlog.filter(b=>b.effort===e).map(b=>`<label class="backlog-row ${b.done?'done':''}"><input type="checkbox" data-backlog="${b.id}" ${b.done?'checked':''}><span><strong>${esc(b.title)}</strong><small>${esc(b.detail)}</small></span></label>`).join('')||'<p class="muted">Keine Einträge.</p>'}</div></section>`).join('')}</div>`; }

function modalHtml(){
  let title='',body='';
  if(modal.type==='lesson'){const l=lesson(modal.id),c=cls(l.classId);title=`${c?.subject||''} ${c?.name||''} · ${l.title||'Stunde'}`;body=lessonPanel(l);}
  if(modal.type==='material'){const m=mat(modal.id);title=m.title;body=materialPanel(m);}
  if(modal.type==='new-material'){title='Neues Material';body=newMaterialPanel();}
  if(modal.type==='brief'){title='ChatGPT-Brief erstellen';body=briefPicker();}
  return `<div class="modal-backdrop" data-action="modal-close"><section class="modal" data-modal-stop><header class="modal-header"><div><span class="eyebrow">SCHULCOCKPIT</span><h2>${esc(title)}</h2></div><button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">${body}</div></section></div>`;
}

function lessonPanel(l){
  const materials=l.materials.map(mat).filter(Boolean),r=l.reflection||{},c=cls(l.classId);
  return `<div class="detail-stack"><div class="detail-summary"><div><span class="eyebrow">STUNDENZIEL</span><p>${esc(l.objective||'Noch nicht festgelegt.')}</p></div><select data-status="${l.id}">${[['open','Offen'],['planned','Geplant'],['needs-material','Material fehlt'],['ready','Bereit'],['done','Gehalten']].map(([v,t])=>`<option value="${v}" ${l.status===v?'selected':''}>${t}</option>`).join('')}</select></div>
  <section class="detail-section"><h3>Planung</h3><div class="lesson-edit-grid"><label>Sequenz<input data-lesson-field="${l.id}|unit" value="${esc(l.unit||'')}"></label><label>Thema<input data-lesson-field="${l.id}|title" value="${esc(l.title||'')}"></label><label class="full">Stundenziel<input data-lesson-field="${l.id}|objective" value="${esc(l.objective||'')}"></label></div><div class="quick-status-row"><button data-quick-status="${l.id}|planned">✓ Planung steht</button><button data-quick-status="${l.id}|needs-material">Material fehlt</button><button data-quick-status="${l.id}|ready">Stunde bereit</button><button data-quick-status="${l.id}|done">Unterricht gehalten</button></div></section>
  <section class="detail-section"><h3>Verlauf</h3><div class="step-list">${l.plannedSteps.length?l.plannedSteps.map((s,i)=>`<label class="${l.completedSteps.includes(s)?'checked':''}"><input type="checkbox" data-step="${l.id}|${i}" ${l.completedSteps.includes(s)?'checked':''}><span>${esc(s)}</span></label>`).join(''):'<p class="muted">Noch keine Schritte hinterlegt.</p>'}</div></section>
  <section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">MATERIAL FÜR DIESE STUNDE</span><h3>Verknüpfen & Druckmengen festlegen</h3></div></div>${materials.length?materials.map(m=>lessonMaterialBlock(l,m)).join(''):'<p class="muted">Noch kein Material verknüpft.</p>'}<div class="attach-material-row"><select id="attach-material-${l.id}">${state.materials.filter(m=>!l.materials.includes(m.id)).map(m=>`<option value="${m.id}">${esc(m.title)}</option>`).join('')}</select><button data-action="attach-material" data-id="${l.id}" ${state.materials.every(m=>l.materials.includes(m.id))?'disabled':''}>+ Material verknüpfen</button></div><p class="microcopy">Tipp: Bei einer Datei wird die Standardversion beim Verknüpfen automatisch mit ${c?.students||'?'} Exemplaren vorgeschlagen. Du kannst die Menge sofort ändern.</p></section>
  <section class="detail-section"><h3>10-Sekunden-Reflexion</h3><div class="reflection-grid">${quickChoice('Wie lief es?','mood',l.id,[['great','😄 sehr gut'],['good','🙂 gut'],['okay','😐 okay'],['hard','😬 schwierig']],r.mood)}${quickChoice('Zeitplanung','timing',l.id,[['fit','✓ passend'],['unfinished','⏩ nicht fertig'],['short','⏱ zu wenig geplant']],r.timing)}${quickChoice('Lernstand','learning',l.id,[['understood','✓ verstanden'],['partial','~ teilweise'],['hard','⚠ schwierig'],['easy','🚀 zu leicht']],r.learning)}</div><textarea data-note="${l.id}" placeholder="Optionale Notiz …">${esc(r.note||'')}</textarea></section></div>`;
}
function lessonMaterialBlock(l,m){
  const plans=(l.printPlan||[]).filter(p=>p.materialId===m.id);
  return `<div class="lesson-material-block"><div class="lesson-material-head"><div><strong>${esc(m.title)}</strong>${m.kind==='book'?`<small>${esc(m.source||'Buch/Arbeitsheft')} · ${esc(m.pages||'')} ${esc(m.tasks||'')}</small>`:'<small>Arbeitsmaterial mit Varianten</small>'}</div><button class="text-button" data-unlink-material="${l.id}|${m.id}">entfernen</button></div><div class="lesson-variant-list">${m.variants.filter(v=>v.available).map(v=>{const p=plans.find(x=>x.variantId===v.id);return lessonVariantPlanRow(l,m,v,p)}).join('')||'<p class="muted">Noch keine verfügbare Variante.</p>'}</div></div>`;
}
function lessonVariantPlanRow(l,m,v,p){
  const fileReady=hasStoredFile(v),fileCapable=!!(v.fileName||v.fileKey||m.kind==='file');
  return `<div class="lesson-variant-plan ${p?.needed?'selected':''}"><label class="need-toggle"><input type="checkbox" data-plan-toggle="${l.id}|${m.id}|${v.id}" ${p?.needed?'checked':''}><span>${esc(v.label)}</span></label><span class="mini-file ${fileReady?'ok':''}">${fileReady?'Datei ✓':v.fileName?'Datei noch hochladen':m.kind==='book'?'nur Referenz':'keine Datei'}</span>${fileCapable?`<label class="inline-field">Anzahl<input type="number" min="0" value="${p?.count??0}" data-plan-count="${l.id}|${m.id}|${v.id}"></label><select data-plan-mode="${l.id}|${m.id}|${v.id}"><option value="bw" ${p?.mode!=='color'?'selected':''}>S/W</option><option value="color" ${p?.mode==='color'?'selected':''}>Farbe</option></select><label class="printed-mini"><input type="checkbox" data-plan-printed="${l.id}|${m.id}|${v.id}" ${p?.alreadyPrinted?'checked':''}> schon kopiert</label>`:'<span class="book-ref">kein Druckauftrag</span>'}</div>`;
}
function quickChoice(title,key,lid,options,value){ return `<div><span class="field-label">${title}</span><div class="choice-row">${options.map(([v,t])=>`<button class="${value===v?'selected':''}" data-reflection="${lid}|${key}|${v}">${t}</button>`).join('')}</div></div>`; }

function materialPanel(m){
  const missing=['challenge','support','daz','solution'].filter(t=>!m.variants.some(v=>v.type===t));
  return `<div class="detail-stack"><section class="detail-section"><span class="eyebrow">MATERIALDATEN</span><div class="lesson-edit-grid"><label class="full">Titel<input data-material-field="${m.id}|title" value="${esc(m.title)}"></label><label>Typ<select data-material-field="${m.id}|kind"><option value="file" ${m.kind==='file'?'selected':''}>Datei / Arbeitsblatt</option><option value="book" ${m.kind==='book'?'selected':''}>Buch / Arbeitsheft</option></select></label><label>Quelle<input data-material-field="${m.id}|source" value="${esc(m.source||'')}" placeholder="z. B. Klett Arbeitsheft"></label><label>Seite<input data-material-field="${m.id}|pages" value="${esc(m.pages||'')}" placeholder="S. 28"></label><label>Aufgaben<input data-material-field="${m.id}|tasks" value="${esc(m.tasks||'')}" placeholder="Nr. 1–5"></label></div></section><section class="detail-section"><span class="eyebrow">VARIANTEN & DATEIEN</span><div class="variant-list">${m.variants.map(v=>variantEditorRow(m,v)).join('')}</div><div class="add-variant-row">${missing.map(t=>`<button data-add-variant="${m.id}|${t}">+ ${variantLabels[t]}</button>`).join('')}</div></section><section class="detail-section"><h3>Schnell markieren: fürs nächste Mal verbessern</h3><div class="improvement-buttons">${['Fehler enthalten','zu schwer','zu leicht','mehr Schreibplatz','unübersichtlich','nicht motivierend','Aufgabe unklar','Lösung ergänzen','Differenzierung fehlt'].map(t=>`<button data-improve="${m.id}|${encodeURIComponent(t)}">${t}</button>`).join('')}</div><div class="custom-improvement"><input id="custom-improve" placeholder="Eigene Notiz …"><button data-action="custom-improve" data-id="${m.id}">Hinzufügen</button></div></section><section class="detail-section"><h3>Offene Hinweise</h3>${m.improvementFlags?.length?`<ul class="notes-list">${m.improvementFlags.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:'<p class="muted">Keine offenen Hinweise.</p>'}</section></div>`;
}
function variantEditorRow(m,v){
  const stored=hasStoredFile(v);
  return `<div class="variant-editor"><button class="availability-dot ${v.available?'on':''}" data-variant-toggle="${m.id}|${v.id}">${v.available?'✓':'+'}</button><div class="variant-info"><strong>${esc(v.label)}</strong><small>${stored?`${esc(v.fileName)} · lokal gespeichert`:v.fileName?`${esc(v.fileName)} · Datei noch nicht im Browser gespeichert`:v.available?'Ressource vorhanden, noch ohne Datei':'noch nicht vorhanden'}</small></div><div class="variant-file-actions"><label class="upload-button">${stored?'Datei ersetzen':'Datei hochladen'}<input type="file" data-upload-variant="${m.id}|${v.id}" hidden></label>${stored?`<button data-download-variant="${m.id}|${v.id}">Öffnen</button><button class="danger-lite small" data-remove-variant-file="${m.id}|${v.id}">×</button>`:''}</div></div>`;
}
function newMaterialPanel(){ return `<div class="detail-stack"><section class="detail-section"><p class="muted">Du brauchst zunächst nur Titel und Typ. Varianten und Dateien kannst du danach ergänzen.</p><div class="lesson-edit-grid"><label class="full">Titel<input id="nm-title" placeholder="z. B. Brüche vergleichen – Arbeitsblatt"></label><label>Typ<select id="nm-kind"><option value="file">Datei / Arbeitsblatt</option><option value="book">Buch / Arbeitsheft</option></select></label><label>Quelle<input id="nm-source" placeholder="optional"></label><label>Seite<input id="nm-pages" placeholder="optional"></label><label>Aufgaben<input id="nm-tasks" placeholder="optional"></label></div><button class="primary full-button" data-action="create-material">Material anlegen</button></section></div>`; }

function briefPicker(){ return `<div class="brief-list"><p class="muted">Wähle die Stunde, deren aktuellen Stand du für ChatGPT exportieren möchtest.</p>${currentWeekLessons().map(l=>{const c=cls(l.classId);return `<button class="brief-row" data-action="brief-download" data-id="${l.id}"><span><strong>${esc(c?.subject||'')} ${esc(c?.name||'')}</strong><small>${esc(l.title||'Thema noch festlegen')}</small></span><span>↓ .md</span></button>`}).join('')}</div>`; }
function makeBrief(l){ const c=cls(l.classId),materials=l.materials.map(mat).filter(Boolean),r=l.reflection||{}; return `# Schulcockpit – ChatGPT-Brief\n\n## Klasse\n${c?.subject||''} ${c?.name||''} · ${c?.students||'?'} Schüler:innen\n\n## Sequenz\n${l.unit||'noch nicht eingetragen'}\n\n## Nächste / aktuelle Stunde\n${l.title||'noch festzulegen'}\nZiel: ${l.objective||'noch nicht festgelegt'}\nDatum: ${l.date}\n\n## Geplanter Verlauf\n${l.plannedSteps.length?l.plannedSteps.map((s,i)=>`${i+1}. ${s}`).join('\n'):'- noch nicht hinterlegt'}\n\n## Tatsächlich bereits geschafft\n${l.completedSteps.length?l.completedSteps.map(s=>`- ${s}`).join('\n'):'- noch keine Angaben'}\n\n## Reflexion / letzter Stand\n- Stimmung: ${r.mood||'nicht angegeben'}\n- Zeit: ${r.timing||'nicht angegeben'}\n- Lernstand: ${r.learning||'nicht angegeben'}\n- Notiz: ${r.note||'keine'}\n\n## Materialien\n${materials.length?materials.map(m=>`- ${m.title}${m.pages?` · ${m.pages}`:''}${m.tasks?` · ${m.tasks}`:''}\n  Varianten: ${m.variants.map(v=>`${v.label}: ${v.available?'vorhanden':'fehlt'}${hasStoredFile(v)?' (Datei lokal gespeichert)':''}`).join(', ')}\n  Überarbeitung: ${m.improvementFlags?.length?m.improvementFlags.join('; '):'keine offenen Hinweise'}`).join('\n'):'- noch keine Materialien verknüpft'}\n\n## Druckplanung für diese Stunde\n${(l.printPlan||[]).filter(p=>p.needed).map(p=>{const m=mat(p.materialId),v=variant(p.materialId,p.variantId);return `- ${m?.title||''} · ${v?.label||''}: ${p.count}× ${p.mode==='color'?'Farbe':'S/W'}${p.alreadyPrinted?' · bereits kopiert':''}`}).join('\n')||'- nichts geplant'}\n\n## Auftrag an ChatGPT\nPlane die nächste sinnvolle Unterrichtsstunde auf Grundlage des tatsächlichen Lernstands. Verwende vorhandenes Material bevorzugt. Gib einen klaren Verlauf, konkrete Folieninhalte, Arbeitsaufträge, benötigte Materialien und ggf. sinnvolle Differenzierung aus. Berücksichtige, welche Materialien bereits vorhanden bzw. bereits kopiert sind.\n`; }

function syncWeek(){
  let added=0;
  state.timetable.forEach(t=>{ const date=dateForWeekday(t.weekday); const exists=state.lessons.some(l=>l.date===date&&l.classId===t.classId&&l.period===t.period); if(!exists){state.lessons.push({id:uid('lesson'),classId:t.classId,date,period:t.period,unit:'',title:'Thema noch festlegen',objective:'',status:'open',plannedSteps:[],completedSteps:[],materials:[],printPlan:[]});added++;} });
  saveState(); alert(added?`${added} fehlende Wochenstunde${added===1?'':'n'} angelegt.`:'Die aktuelle Woche ist bereits vollständig synchronisiert.'); render();
}
function handleTask(id){ const t=workflowTasks().find(x=>x.id===id); if(!t)return; if(t.type==='print'){view='print';render();return;} if(t.lessonId){modal={type:'lesson',id:t.lessonId};render();} }
function addImprovement(mid,detail){ const m=mat(mid);m.improvementFlags=m.improvementFlags||[];if(!m.improvementFlags.includes(detail))m.improvementFlags.push(detail);state.backlog.push({id:uid('backlog'),materialId:mid,title:m.title,detail,effort:'30',done:false});saveState();modal={type:'material',id:mid};render(); }
function ensurePlan(l,mid,vid){ let p=(l.printPlan||[]).find(p=>p.materialId===mid&&p.variantId===vid); if(!p){p={id:uid('pp'),materialId:mid,variantId:vid,count:0,mode:'bw',alreadyPrinted:false,needed:false};l.printPlan.push(p);} return p; }
function safeName(s){ return String(s||'Datei').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim(); }

// ---- Tiny uncompressed ZIP writer (no external library needed) ----
const crcTable=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function u16(n){return [n&255,(n>>>8)&255];} function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];}
async function buildZip(entries){
  const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;
  for(const e of entries){const name=enc.encode(e.name),data=new Uint8Array(await e.blob.arrayBuffer()),crc=crc32(data);const local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...name,...data]);locals.push(local);const central=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]);centrals.push(central);offset+=local.length;}
  const centralSize=centrals.reduce((a,b)=>a+b.length,0),end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(centralSize),...u32(offset),...u16(0)]);return new Blob([...locals,...centrals,end],{type:'application/zip'});
}
async function downloadPrintZip(){
  const items=openPrintItems(); const missing=items.filter(i=>!i.fileReady); if(missing.length){alert(`Für ${missing.length} offene Druckposition${missing.length===1?'':'en'} fehlt noch die echte Datei. Lade sie zuerst in der Materialbibliothek hoch.`);return;}
  if(!items.length){alert('Es gibt keine offenen druckbereiten Positionen.');return;}
  const entries=[];
  for(const i of items){const rec=await fileStoreGet(i.variant.fileKey);if(!rec)continue;const folder=i.plan.mode==='color'?'FARBE':'SW';const ext=(rec.name.match(/\.[^.]+$/)||[''])[0];const base=safeName(`${String(i.plan.count).padStart(2,'0')}x_${i.cls?.subject||''}_${i.cls?.name||''}_${i.material.title}_${i.variant.label}`);entries.push({name:`${folder}/${base}${ext}`,blob:rec.blob});}
  const list=printListText(items);entries.push({name:'Druckliste.txt',blob:new Blob([list],{type:'text/plain;charset=utf-8'})});downloadBlob(`KW${kw()}_Druckpaket.zip`,await buildZip(entries));
}
function printListText(items=printItems()){ return items.map(i=>`${i.plan.count}x · ${i.plan.mode==='color'?'FARBE':'S/W'} · ${i.cls?.subject||''} ${i.cls?.name||''} · ${i.material.title} · ${i.variant.label} · ${i.variant.fileName||'keine Datei'}${i.plan.alreadyPrinted?' · BEREITS KOPIERT':''}`).join('\n')||'Keine Druckaufträge.'; }

function wireBase(){
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;modal=null;render();});
  document.querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>handleTask(b.dataset.task));
  document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>{modal={type:'lesson',id:b.dataset.lesson};render();});
  document.querySelectorAll('[data-material]').forEach(b=>b.onclick=e=>{e.stopPropagation();modal={type:'material',id:b.dataset.material};render();});
  document.querySelectorAll('[data-action="modal-close"]').forEach(b=>b.onclick=e=>{if(e.target.closest('[data-modal-stop]'))return;modal=null;render();});
  document.querySelectorAll('[data-modal-stop]').forEach(x=>x.onclick=e=>e.stopPropagation());
  document.querySelector('[data-action="backup"]')?.addEventListener('click',()=>downloadText('schulcockpit-backup.json',JSON.stringify(state,null,2),'application/json'));
  document.querySelector('[data-action="reset"]')?.addEventListener('click',()=>{if(confirm('Demo-Daten wirklich zurücksetzen? Gespeicherte Materialdateien bleiben dabei erhalten.')){localStorage.removeItem(STORAGE_KEY);state=clone(sampleState);render();}});
  document.querySelector('[data-action="brief-picker"]')?.addEventListener('click',()=>{modal={type:'brief'};render();});
  document.querySelector('[data-action="sync-week"]')?.addEventListener('click',syncWeek);
  document.querySelector('[data-action="new-material"]')?.addEventListener('click',()=>{modal={type:'new-material'};render();});
  document.querySelector('[data-action="create-material"]')?.addEventListener('click',()=>{const title=document.getElementById('nm-title').value.trim(),kind=document.getElementById('nm-kind').value;if(!title)return alert('Bitte einen Titel eintragen.');const m={id:uid('mat'),title,kind,source:document.getElementById('nm-source').value.trim(),pages:document.getElementById('nm-pages').value.trim(),tasks:document.getElementById('nm-tasks').value.trim(),variants:[{id:uid('var'),type:'standard',label:'Standard',available:true,fileName:null,fileKey:null}],improvementFlags:[]};state.materials.push(m);saveState();modal={type:'material',id:m.id};render();});

  document.querySelector('[data-action="add-class"]')?.addEventListener('click',()=>{const subject=document.getElementById('new-subject').value.trim(),name=document.getElementById('new-class').value.trim(),students=Number(document.getElementById('new-students').value)||25;if(!subject||!name)return alert('Bitte Fach und Klasse eintragen.');state.classes.push({id:uid('class'),subject,name,students,color:['#6d5f9b','#b86f8b','#557b78','#8b684c','#8a6b88'][state.classes.length%5]});persist();});
  document.querySelectorAll('[data-class-field]').forEach(i=>i.onchange=()=>{const [id,key]=i.dataset.classField.split('|');const c=cls(id);c[key]=key==='students'?Number(i.value)||1:i.value;saveState();});
  document.querySelectorAll('[data-delete-class]').forEach(b=>b.onclick=()=>{const id=b.dataset.deleteClass;if(state.timetable.some(t=>t.classId===id)||state.lessons.some(l=>l.classId===id))return alert('Diese Klasse wird noch im Stundenplan oder in Unterrichtsstunden verwendet. Lösche dort zuerst die Verknüpfungen.');state.classes=state.classes.filter(c=>c.id!==id);persist();});
  document.querySelector('[data-action="add-timetable"]')?.addEventListener('click',()=>{const weekday=Number(document.getElementById('tt-day').value),period=document.getElementById('tt-period').value.trim(),classId=document.getElementById('tt-class').value;if(!period||!classId)return alert('Bitte Block/Stunde und Klasse auswählen.');const order=state.timetable.filter(t=>t.weekday===weekday).length+1;state.timetable.push({id:uid('tt'),weekday,period,classId,order});persist();});
  document.querySelectorAll('[data-delete-tt]').forEach(b=>b.onclick=()=>{state.timetable=state.timetable.filter(t=>t.id!==b.dataset.deleteTt);persist();});

  document.querySelector('[data-action="download-print"]')?.addEventListener('click',()=>downloadText(`KW${kw()}_Druckliste.txt`,printListText()));
  document.querySelector('[data-action="download-print-zip"]')?.addEventListener('click',downloadPrintZip);
  document.querySelectorAll('[data-print]').forEach(x=>x.onchange=()=>{const [lid,pid]=x.dataset.print.split('|'),p=lesson(lid).printPlan.find(p=>p.id===pid);p.alreadyPrinted=x.checked;persist();});
  document.querySelectorAll('[data-backlog]').forEach(x=>x.onchange=()=>{const b=state.backlog.find(b=>b.id===x.dataset.backlog);b.done=x.checked;persist();});

  document.querySelectorAll('[data-status]').forEach(x=>x.onchange=()=>{lesson(x.dataset.status).status=x.value;saveState();modal={type:'lesson',id:x.dataset.status};render();});
  document.querySelectorAll('[data-quick-status]').forEach(b=>b.onclick=()=>{const [lid,status]=b.dataset.quickStatus.split('|');lesson(lid).status=status;saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-lesson-field]').forEach(i=>i.onchange=()=>{const [lid,key]=i.dataset.lessonField.split('|');lesson(lid)[key]=i.value;saveState();});
  document.querySelectorAll('[data-step]').forEach(x=>x.onchange=()=>{const [lid,idx]=x.dataset.step.split('|'),l=lesson(lid),s=l.plannedSteps[Number(idx)];l.completedSteps=x.checked?[...new Set([...l.completedSteps,s])]:l.completedSteps.filter(y=>y!==s);saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-reflection]').forEach(b=>b.onclick=()=>{const [lid,key,val]=b.dataset.reflection.split('|'),l=lesson(lid);l.reflection=l.reflection||{};l.reflection[key]=val;saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-note]').forEach(t=>t.onchange=()=>{const l=lesson(t.dataset.note);l.reflection=l.reflection||{};l.reflection.note=t.value;saveState();});
  document.querySelectorAll('[data-action="brief-download"]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.id),c=cls(l.classId);downloadText(`${l.date}_${c?.name||'Klasse'}_ChatGPT-Brief.md`,makeBrief(l));});

  document.querySelector('[data-action="attach-material"]')?.addEventListener('click',e=>{const l=lesson(e.currentTarget.dataset.id),sel=document.getElementById(`attach-material-${l.id}`),mid=sel?.value;if(!mid)return; l.materials.push(mid);const m=mat(mid),std=m?.variants.find(v=>v.type==='standard'&&v.available);if(std&&m.kind==='file'){l.printPlan.push({id:uid('pp'),materialId:mid,variantId:std.id,count:cls(l.classId)?.students||0,mode:'bw',alreadyPrinted:false,needed:true});}saveState();modal={type:'lesson',id:l.id};render();});
  document.querySelectorAll('[data-unlink-material]').forEach(b=>b.onclick=()=>{const [lid,mid]=b.dataset.unlinkMaterial.split('|'),l=lesson(lid);l.materials=l.materials.filter(id=>id!==mid);l.printPlan=(l.printPlan||[]).filter(p=>p.materialId!==mid);saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-plan-toggle]').forEach(x=>x.onchange=()=>{const [lid,mid,vid]=x.dataset.planToggle.split('|'),l=lesson(lid),p=ensurePlan(l,mid,vid);p.needed=x.checked;if(x.checked&&p.count===0){const m=mat(mid);p.count=m.kind==='file'?(cls(l.classId)?.students||0):0;}saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-plan-count]').forEach(x=>x.onchange=()=>{const [lid,mid,vid]=x.dataset.planCount.split('|'),l=lesson(lid),p=ensurePlan(l,mid,vid);p.count=Math.max(0,Number(x.value)||0);p.needed=p.count>0;saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-plan-mode]').forEach(x=>x.onchange=()=>{const [lid,mid,vid]=x.dataset.planMode.split('|'),p=ensurePlan(lesson(lid),mid,vid);p.mode=x.value;saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-plan-printed]').forEach(x=>x.onchange=()=>{const [lid,mid,vid]=x.dataset.planPrinted.split('|'),p=ensurePlan(lesson(lid),mid,vid);p.alreadyPrinted=x.checked;saveState();modal={type:'lesson',id:lid};render();});

  document.querySelectorAll('[data-material-field]').forEach(i=>i.onchange=()=>{const [mid,key]=i.dataset.materialField.split('|');mat(mid)[key]=i.value;saveState();modal={type:'material',id:mid};render();});
  document.querySelectorAll('[data-variant-toggle]').forEach(b=>b.onclick=()=>{const [mid,vid]=b.dataset.variantToggle.split('|'),v=variant(mid,vid);v.available=!v.available;saveState();modal={type:'material',id:mid};render();});
  document.querySelectorAll('[data-add-variant]').forEach(b=>b.onclick=()=>{const [mid,type]=b.dataset.addVariant.split('|');mat(mid).variants.push({id:uid('var'),type,label:variantLabels[type],available:false,fileName:null,fileKey:null});saveState();modal={type:'material',id:mid};render();});
  document.querySelectorAll('[data-upload-variant]').forEach(inp=>inp.onchange=async()=>{const file=inp.files?.[0];if(!file)return;const [mid,vid]=inp.dataset.uploadVariant.split('|'),v=variant(mid,vid);const key=v.fileKey||uid('file');await fileStorePut(key,file);v.fileKey=key;v.fileName=file.name;v.available=true;storedFileKeys.add(key);saveState();modal={type:'material',id:mid};render();});
  document.querySelectorAll('[data-download-variant]').forEach(b=>b.onclick=async()=>{const [mid,vid]=b.dataset.downloadVariant.split('|'),v=variant(mid,vid),rec=await fileStoreGet(v.fileKey);if(rec)downloadBlob(rec.name,rec.blob);});
  document.querySelectorAll('[data-remove-variant-file]').forEach(b=>b.onclick=async()=>{const [mid,vid]=b.dataset.removeVariantFile.split('|'),v=variant(mid,vid);if(!confirm('Gespeicherte Datei wirklich aus diesem Browser entfernen?'))return;await fileStoreDelete(v.fileKey);storedFileKeys.delete(v.fileKey);v.fileKey=null;saveState();modal={type:'material',id:mid};render();});
  document.querySelectorAll('[data-improve]').forEach(b=>b.onclick=()=>{const [mid,enc]=b.dataset.improve.split('|');addImprovement(mid,decodeURIComponent(enc));});
  document.querySelector('[data-action="custom-improve"]')?.addEventListener('click',e=>{const input=document.getElementById('custom-improve'),val=input.value.trim();if(val)addImprovement(e.currentTarget.dataset.id,val);});
}


// ---- V0.4: Sequenzen, Jahresplanung & echte Phasenplanung ----
function workflowTasks(){
  const lessons=currentWeekLessons(); const tasks=[];
  lessons.forEach(l=>{
    const c=cls(l.classId),who=`${c?.subject||''} ${c?.name||''}`.trim();
    const hasPlan=(l.phasePlan||[]).some(p=>p.title?.trim());
    if(l.status==='open'||!hasPlan) tasks.push({id:`plan-${l.id}`,stage:1,date:l.date,type:'plan',lessonId:l.id,title:`${who}: Stunde planen`,detail:`${fmtDate(l.date)} · ${l.title||'Thema noch festlegen'}`,why:previousLesson(l)?'Der Stand der letzten Stunde ist schon hinterlegt. Jetzt daraus die nächste Stunde planen.':'Erst die Planung klären, damit Material und Kopierbedarf feststehen.'});
    const missing=missingPrintFilesForLesson(l);
    if(l.status==='needs-material'||missing.length) tasks.push({id:`material-${l.id}`,stage:2,date:l.date,type:'material',lessonId:l.id,title:`${who}: Material fertigstellen`,detail:missing.length?`${missing.length} geplante Druckdatei${missing.length===1?' fehlt':'en fehlen'} noch`:`${fmtDate(l.date)} · ${l.title}`,why:'Vor dem Kopierlauf müssen die tatsächlich benötigten Dateien vorhanden sein.'});
    (l.prepTasks||[]).filter(t=>!t.done&&t.title).forEach(t=>tasks.push({id:`prep-${l.id}-${t.id}`,stage:2,date:l.date,type:'prep',lessonId:l.id,title:`${who}: ${t.title}`,detail:`${t.category||'Vorbereitung'} · ${fmtDate(l.date)}`,why:t.note||'Diese Vorbereitung wurde bei der Stundenplanung als noch offen markiert.'}));
  });
  const openPrint=openPrintItems().filter(i=>i.fileReady);
  if(openPrint.length) tasks.push({id:'print-week',stage:3,date:dateForWeekday(1),type:'print',title:'Wochenkopien erledigen',detail:`${openPrint.length} druckbereite Position${openPrint.length===1?'':'en'} · Farbe und S/W gesammelt`,why:'Alles in einem Kopierlauf erledigen, statt morgens vor dem Unterricht.'});
  lessons.forEach(l=>{
    if(l.status==='planned'){
      const c=cls(l.classId);tasks.push({id:`final-${l.id}`,stage:4,date:l.date,type:'final',lessonId:l.id,title:`${c?.subject||''} ${c?.name||''}: Feinschliff abschließen`,detail:`${fmtDate(l.date)} · Präsentation/Details prüfen`,why:'Die Grobplanung steht; jetzt nur noch so viel fertigstellen, dass die Stunde bereit ist.'});
    }
    if(l.status==='done' && !(l.reflection&&Object.keys(l.reflection).length)){
      const c=cls(l.classId);tasks.push({id:`reflect-${l.id}`,stage:5,date:l.date,type:'reflect',lessonId:l.id,title:`${c?.subject||''} ${c?.name||''}: kurz reflektieren`,detail:'10-Sekunden-Reflexion · Klicks reichen',why:'Damit die nächste Stunde und der nächste Durchlauf automatisch auf deinem echten Unterrichtsstand aufbauen.'});
    }
  });
  return tasks.sort((a,b)=>a.stage-b.stage||a.date.localeCompare(b.date));
}

function render(){
  const app=document.getElementById('app');
  app.innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">SC</div><div><strong>Schulcockpit</strong><small>2026/27 · V0.5</small></div></div><nav>${navBtn('focus','✦','Was jetzt?')}${navBtn('week','▦','Meine Woche')}${navBtn('sequences','≋','Sequenzen & Jahr')}${navBtn('timetable','⌗','Stundenplan & Klassen')}${navBtn('print','⎙','Kopierzentrum')}${navBtn('materials','▤','Materialbibliothek')}${navBtn('improve','↗','Unterricht verbessern')}</nav><div class="sidebar-footer"><button data-action="brief-picker">ChatGPT-Brief</button><button data-action="backup">Backup</button><button data-action="reset">Demo zurücksetzen</button></div></aside><main><header class="topbar"><div><span class="eyebrow">KW ${kw()} · ${state.settings.schoolYear}</span><h1>${pageTitle()}</h1></div><div class="top-actions"><span class="storage-pill">Dateien: ${storedFileKeys.size} lokal gespeichert</span><button class="primary" data-action="sync-week">Woche synchronisieren</button></div></header><div class="page">${viewHtml()}</div></main></div>${modal?modalHtml():''}`;
  wire();
}
function pageTitle(){ return ({focus:'Was mache ich als Nächstes?',week:'Meine Woche',sequences:'Sequenzen & Schuljahr',timetable:'Stundenplan & Klassen',print:'Kopierzentrum',materials:'Materialbibliothek',improve:'Unterricht verbessern'})[view]; }
function viewHtml(){ return view==='focus'?focusView():view==='week'?weekView():view==='sequences'?sequencesView():view==='timetable'?timetableView():view==='print'?printView():view==='materials'?materialsView():improveView(); }
function focusView(){
  const tasks=workflowTasks(),next=tasks[0];
  return `<div class="content-grid"><section class="focus-hero ${!next?'all-done':''}"><div>${next?`<span class="eyebrow">DEIN NÄCHSTER SCHRITT</span><h2>${esc(next.title)}</h2><p>${esc(next.why)}</p><span class="next-meta">${esc(next.detail)}</span>`:`<span class="eyebrow">ALLES WICHTIGE ERLEDIGT</span><h2>Für diese Woche ist gerade nichts Akutes offen.</h2><p>Wenn du Zeit hast, kannst du im Verbesserungs-Backlog weiterarbeiten.</p>`}</div>${next?`<button class="primary big" data-task="${next.id}">Jetzt erledigen →</button>`:'<div class="done-badge">✓</div>'}</section><section class="workflow-strip">${[1,2,3,4,5].map(s=>{const has=tasks.some(t=>t.stage===s),done=tasks.every(t=>t.stage>s);return `<div class="workflow-step ${has?'active-step':''} ${done?'complete-step':''}"><span>${s}</span><div><strong>${stageLabel(s).replace(/^\d · /,'')}</strong><small>${tasks.filter(t=>t.stage===s).length} offen</small></div></div>`}).join('')}</section><section class="panel"><div class="section-head"><div><span class="eyebrow">ARBEITSREIHENFOLGE</span><h2>Nicht nachdenken – einfach von oben nach unten.</h2></div><span class="muted">${tasks.length} Aufgaben</span></div><div class="task-queue">${tasks.map(taskCard).join('')||'<div class="empty-state">Alles erledigt. ✦</div>'}</div></section><div class="tip-card"><strong>Neu in V0.5</strong><p>Der ChatGPT-Workflow funktioniert jetzt in beide Richtungen: Brief raus, normal im Chat planen, komplette Antwort wieder ins Cockpit einfügen. Phasen, Folienideen, Vorbereitung und Materialbedarf werden nach einer Vorschau strukturiert übernommen.</p></div></div>`;
}
function weekView(){
  const ls=currentWeekLessons(),tasks=workflowTasks(),prints=openPrintItems();
  return `<div class="content-grid"><section class="stats-row">${stat('Unterrichtsstunden',ls.length,'diese Woche')}${stat('Arbeitsaufgaben',tasks.length,'priorisiert offen')}${stat('Druckpositionen',prints.length,'noch nicht kopiert')}${stat('Sequenzen',state.sequences.length,'im Schuljahr angelegt')}</section><section class="panel"><div class="section-head"><div><span class="eyebrow">KW ${kw()}</span><h2>Unterricht diese Woche</h2></div></div><div class="lesson-list">${ls.map(lessonCardV04).join('')||'<p class="muted">Noch keine Stunden. Lege zuerst deinen Stundenplan an und synchronisiere die Woche.</p>'}</div></section></div>`;
}
function lessonCardV04(l){ const c=cls(l.classId),meta=statusMeta[l.status]||statusMeta.open,q=seq(l.sequenceId); const copies=(l.printPlan||[]).filter(p=>p.needed&&(Number(p.count)||0)>0),printed=copies.filter(p=>p.alreadyPrinted).length; const phases=(l.phasePlan||[]),done=phases.filter(p=>p.done).length; return `<button class="lesson-card" data-lesson="${l.id}"><div class="lesson-date"><strong>${fmtDate(l.date)}</strong><span>${esc(l.period)}</span></div><div class="class-pill" style="--class-color:${c?.color||'#999'}">${esc(c?.subject||'')} ${esc(c?.name||'')}</div><div class="lesson-main"><strong>${esc(l.title||'Thema noch festlegen')}</strong><span>${esc(q?.title||l.unit||'Sequenz noch nicht eingetragen')} · ${phases.length?`${done}/${phases.length} Phasen geschafft`:'noch kein Verlauf'}</span></div><div class="lesson-meta"><span class="status ${meta[1]}">${meta[0]}</span><span class="copy-mini">⎙ ${printed}/${copies.length}</span></div></button>`; }

function sequencesView(){
  return `<div class="content-grid"><section class="hero-card sequence-hero"><div><span class="eyebrow">JAHRES- & SEQUENZPLANUNG</span><h2>Der rote Faden hinter deinen einzelnen Stunden.</h2><p>Lege Einheiten grob an. Das Cockpit verknüpft Wochenstunden damit und trägt den tatsächlichen Unterrichtsstand von Stunde zu Stunde weiter.</p></div><button class="primary" data-action="new-sequence">+ Neue Sequenz</button></section>${state.classes.map(c=>{const qs=classSequences(c.id);return `<section class="panel"><div class="section-head"><div><span class="eyebrow">${esc(c.subject)}</span><h2>${esc(c.name)}</h2></div><span class="muted">${qs.length} Sequenz${qs.length===1?'':'en'}</span></div><div class="sequence-list">${qs.map(sequenceCard).join('')||'<p class="muted">Noch keine Sequenz angelegt.</p>'}</div></section>`}).join('')}</div>`;
}
function sequenceCard(q){ const ls=linkedLessons(q.id),done=ls.filter(l=>l.status==='done').length; const pct=ls.length?Math.round(done/ls.length*100):0; return `<button class="sequence-card" data-sequence="${q.id}"><div class="sequence-main"><div class="sequence-title-row"><strong>${esc(q.title)}</strong>${q.assessmentDate?`<span class="assessment-chip">Leistung · ${fmtDate(q.assessmentDate)}</span>`:''}</div><span>${q.startDate?fmtDate(q.startDate):'Start offen'} ${q.endDate?`→ ${fmtDate(q.endDate)}`:''}</span><p>${esc(q.goal||'Ziel noch nicht eingetragen.')}</p></div><div class="sequence-progress"><strong>${pct}%</strong><small>${done}/${ls.length} verknüpfte Stunden gehalten</small><div class="progress-track"><i style="width:${pct}%"></i></div></div></button>`; }

function modalHtml(){
  let title='',body='';
  if(modal.type==='lesson'){const l=lesson(modal.id),c=cls(l.classId);title=`${c?.subject||''} ${c?.name||''} · ${l.title||'Stunde'}`;body=lessonPanel(l);}
  if(modal.type==='material'){const m=mat(modal.id);title=m.title;body=materialPanel(m);}
  if(modal.type==='new-material'){title='Neues Material';body=newMaterialPanel();}
  if(modal.type==='brief'){title='ChatGPT-Brief erstellen';body=briefPicker();}
  if(modal.type==='sequence'){const q=seq(modal.id);title=q?.title||'Sequenz';body=sequencePanel(q);}
  if(modal.type==='new-sequence'){title='Neue Sequenz';body=newSequencePanel();}
  if(modal.type==='ai-import'){const l=lesson(modal.id),c=cls(l?.classId);title=`ChatGPT → ${c?.subject||''} ${c?.name||''}`;body=aiImportPanel(l,modal.parsed||null,modal.raw||'');}
  return `<div class="modal-backdrop" data-action="modal-close"><section class="modal ${modal.type==='ai-import'?'modal-wide':''}" data-modal-stop><header class="modal-header"><div><span class="eyebrow">SCHULCOCKPIT</span><h2>${esc(title)}</h2></div><button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">${body}</div></section></div>`;
}

function lessonPanel(l){
  const materials=l.materials.map(mat).filter(Boolean),r=l.reflection||{},c=cls(l.classId),q=seq(l.sequenceId),prev=previousLesson(l),unfinished=prev?(prev.phasePlan||[]).filter(p=>!p.done&&p.title):[];
  const total=(l.phasePlan||[]).reduce((n,p)=>n+(Number(p.minutes)||0),0);
  return `<div class="detail-stack">
  ${prev?`<section class="previous-lesson-card"><div><span class="eyebrow">LETZTER ECHTER STAND · ${fmtDate(prev.date)}</span><h3>${esc(prev.title||'Vorherige Stunde')}</h3><p>${unfinished.length?`Offen geblieben: <strong>${unfinished.map(p=>esc(p.title)).join(', ')}</strong>`:'Alle geplanten Phasen wurden als geschafft markiert.'}</p>${prev.reflection?.note?`<small>${esc(prev.reflection.note)}</small>`:''}</div>${unfinished.length?`<button data-action="carry-over" data-id="${l.id}">Offenes übernehmen →</button>`:''}</section>`:''}
  <div class="detail-summary"><div><span class="eyebrow">STUNDENZIEL</span><p>${esc(l.objective||'Noch nicht festgelegt.')}</p></div><select data-status="${l.id}">${[['open','Offen'],['planned','Geplant'],['needs-material','Material fehlt'],['ready','Bereit'],['done','Gehalten']].map(([v,t])=>`<option value="${v}" ${l.status===v?'selected':''}>${t}</option>`).join('')}</select></div>
  <section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">EINORDNUNG</span><h3>Sequenz & Ziel</h3></div><button class="text-button" data-action="new-sequence-for-lesson" data-id="${l.id}">+ Sequenz</button></div><div class="lesson-edit-grid"><label>Sequenz<select data-sequence-select="${l.id}"><option value="">— keine —</option>${classSequences(l.classId).map(x=>`<option value="${x.id}" ${l.sequenceId===x.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select></label><label>Thema<input data-lesson-field="${l.id}|title" value="${esc(l.title||'')}"></label><label class="full">Stundenziel<input data-lesson-field="${l.id}|objective" value="${esc(l.objective||'')}"></label></div>${q?`<div class="sequence-context"><strong>${esc(q.title)}</strong><span>${esc(q.goal||'Noch kein Sequenzziel')} ${q.assessmentDate?`· Leistung am ${fmtDate(q.assessmentDate)}`:''}</span></div>`:''}<div class="quick-status-row"><button data-quick-status="${l.id}|planned">✓ Planung steht</button><button data-quick-status="${l.id}|needs-material">Material fehlt</button><button data-quick-status="${l.id}|ready">Stunde bereit</button><button data-quick-status="${l.id}|done">Unterricht gehalten</button></div></section>
  <section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">UNTERRICHTSVERLAUF</span><h3>Phasen planen <span class="time-sum">${total?`· ${total} Min.`:''}</span></h3></div><button data-add-phase="${l.id}">+ Phase</button></div><div class="phase-planner">${(l.phasePlan||[]).map((p,i)=>phaseRow(l,p,i)).join('')||'<div class="empty-phase">Noch kein Verlauf. Füge Phasen hinzu oder übernimm offene Punkte aus der letzten Stunde.</div>'}</div></section>
  <section class="ai-bridge"><div><span class="eyebrow">MIT CHATGPT PLANEN</span><h3>Brief raus. Planung wieder rein.</h3><p>Der Brief enthält deinen echten Unterrichtsstand und fordert am Ende einen strukturierten Schulcockpit-Block an. Du kannst danach meine komplette Antwort wieder importieren.</p></div><div><button class="secondary" data-action="copy-brief" data-id="${l.id}">1 · Brief kopieren</button><button class="secondary" data-action="brief-download" data-id="${l.id}">.md</button><button class="primary" data-action="open-ai-import" data-id="${l.id}">2 · Planung importieren</button></div></section>
  <section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">FOLIEN & PRÄSENTATION</span><h3>${(l.slides||[]).length?`${l.slides.length} Folienideen`:'Noch keine Folienideen'}</h3></div></div>${slidesPanel(l)}</section>
  <section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">VORBEREITUNG</span><h3>Noch zu erledigen</h3></div><span class="muted">${(l.prepTasks||[]).filter(t=>!t.done).length} offen</span></div>${prepTasksPanel(l)}</section>
  <section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">MATERIAL FÜR DIESE STUNDE</span><h3>Verknüpfen & Druckmengen festlegen</h3></div></div>${materials.length?materials.map(m=>lessonMaterialBlock(l,m)).join(''):'<p class="muted">Noch kein Material verknüpft.</p>'}<div class="attach-material-row"><select id="attach-material-${l.id}">${state.materials.filter(m=>!l.materials.includes(m.id)).map(m=>`<option value="${m.id}">${esc(m.title)}</option>`).join('')}</select><button data-action="attach-material" data-id="${l.id}" ${state.materials.every(m=>l.materials.includes(m.id))?'disabled':''}>+ Material verknüpfen</button></div><p class="microcopy">Bei einer Datei wird die Standardversion beim Verknüpfen automatisch mit ${c?.students||'?'} Exemplaren vorgeschlagen.</p></section>
  <section class="detail-section"><h3>10-Sekunden-Reflexion</h3><div class="reflection-grid">${quickChoice('Wie lief es?','mood',l.id,[['great','😄 sehr gut'],['good','🙂 gut'],['okay','😐 okay'],['hard','😬 schwierig']],r.mood)}${quickChoice('Zeitplanung','timing',l.id,[['fit','✓ passend'],['unfinished','⏩ nicht fertig'],['short','⏱ zu wenig geplant']],r.timing)}${quickChoice('Lernstand','learning',l.id,[['understood','✓ verstanden'],['partial','~ teilweise'],['hard','⚠ schwierig'],['easy','🚀 zu leicht']],r.learning)}</div><textarea data-note="${l.id}" placeholder="Optionale Notiz …">${esc(r.note||'')}</textarea></section></div>`;
}
function phaseRow(l,p,i){ const phases=['Einstieg','Aktivierung','Erarbeitung','Übung','Sicherung','Transfer','Reflexion','Sonstiges']; return `<div class="phase-row ${p.done?'done':''}"><label class="phase-done"><input type="checkbox" data-phase-done="${l.id}|${p.id}" ${p.done?'checked':''}><span>✓</span></label><select data-phase-field="${l.id}|${p.id}|phase">${phases.map(x=>`<option ${p.phase===x?'selected':''}>${x}</option>`).join('')}</select><label class="phase-min"><input type="number" min="0" step="1" value="${esc(p.minutes||'')}" placeholder="Min" data-phase-field="${l.id}|${p.id}|minutes"><span>min</span></label><div class="phase-text"><input value="${esc(p.title||'')}" placeholder="Was passiert in dieser Phase?" data-phase-field="${l.id}|${p.id}|title"><input class="phase-detail" value="${esc(p.details||'')}" placeholder="Optional: Arbeitsauftrag, Folienidee, Hinweis …" data-phase-field="${l.id}|${p.id}|details"></div><button class="danger-lite small" data-delete-phase="${l.id}|${p.id}">×</button></div>`; }

function slidesPanel(l){
  const slides=l.slides||[];
  if(!slides.length)return '<p class="muted">Beim ChatGPT-Import können Folientyp, Titel, Stichpunkte und Notizen automatisch hier landen.</p>';
  return `<div class="slide-plan-list">${slides.map((sl,i)=>`<div class="slide-plan-card"><span class="slide-number">${i+1}</span><div><small>${esc(sl.type||'Folie')}</small><strong>${esc(sl.title||'Ohne Titel')}</strong>${(sl.content||[]).length?`<ul>${sl.content.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${sl.notes?`<p>${esc(sl.notes)}</p>`:''}</div><button class="danger-lite small" data-delete-slide="${l.id}|${sl.id}">×</button></div>`).join('')}</div>`;
}
function prepTasksPanel(l){
  const tasks=l.prepTasks||[];
  if(!tasks.length)return '<p class="muted">Noch keine zusätzlichen Vorbereitungsschritte. Importierte Material-/Präsentationsaufgaben erscheinen hier und automatisch in „Was jetzt?“.</p>';
  return `<div class="prep-task-list">${tasks.map(t=>`<label class="prep-task ${t.done?'done':''}"><input type="checkbox" data-prep-done="${l.id}|${t.id}" ${t.done?'checked':''}><span><strong>${esc(t.title)}</strong><small>${esc(t.category||'Vorbereitung')}${t.note?` · ${esc(t.note)}`:''}</small></span><button type="button" class="danger-lite small" data-delete-prep="${l.id}|${t.id}">×</button></label>`).join('')}</div>`;
}
function cleanString(v,max=4000){ return String(v??'').trim().slice(0,max); }
function cleanArray(v,max=30){ return Array.isArray(v)?v.slice(0,max):[]; }
function normalizeMaterialTitle(s){ return cleanString(s,300).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9äöüß]+/g,' ').trim(); }
function parseAiImport(raw){
  const text=String(raw||'').replace(/^\uFEFF/,'').trim();
  if(!text)throw new Error('Füge zuerst die ChatGPT-Antwort ein.');
  const candidates=[text];
  const marker=text.match(/<SCHULCOCKPIT_IMPORT>([\s\S]*?)<\/SCHULCOCKPIT_IMPORT>/i); if(marker)candidates.unshift(marker[1].trim());
  const fence=/```(?:json|schulcockpit)?\s*([\s\S]*?)```/gi; let m; while((m=fence.exec(text)))candidates.unshift(m[1].trim());
  const first=text.indexOf('{'),last=text.lastIndexOf('}'); if(first>=0&&last>first)candidates.push(text.slice(first,last+1));
  let parsed=null;
  for(const c of candidates){
    try{ const x=JSON.parse(c); const root=x?.schulcockpit||x; if(root&&(root.schema||root.lesson||root.phases||root.slides)){parsed=root;break;} }catch{}
  }
  if(!parsed)throw new Error('Kein lesbarer Schulcockpit-Datenblock gefunden. Prüfe, ob die Antwort vollständig kopiert wurde.');
  return normalizeAiPackage(parsed);
}
function normalizeAiPackage(x){
  const lessonData=x.lesson||{};
  const allowedPhases=new Set(['Einstieg','Aktivierung','Erarbeitung','Übung','Sicherung','Transfer','Reflexion','Sonstiges']);
  const allowedVariants=new Set(['standard','challenge','support','daz','solution']);
  const phases=cleanArray(x.phases,20).map(p=>({phase:allowedPhases.has(cleanString(p.phase,40))?cleanString(p.phase,40):'Sonstiges',minutes:Math.max(0,Math.min(180,Number(p.minutes)||0)),title:cleanString(p.title,500),details:cleanString(p.details||p.task||'',2000)})).filter(p=>p.title||p.details);
  const slides=cleanArray(x.slides,50).map(sl=>({type:cleanString(sl.type||'text',80).toLowerCase(),title:cleanString(sl.title,500),content:cleanArray(sl.content||sl.bullets,20).map(v=>cleanString(v,1000)).filter(Boolean),notes:cleanString(sl.notes||'',2000),statement:cleanString(sl.statement||'',1200),answer:cleanString(sl.answer||'',20).toLowerCase(),correction:cleanString(sl.correction||'',1500),socialForm:cleanString(sl.socialForm||sl.socialform||'',200),time:cleanString(sl.time||'',100),material:cleanString(sl.material||'',400),steps:cleanArray(sl.steps,4).map(v=>cleanString(v,1200)).filter(Boolean),secondary:cleanArray(sl.secondary||sl.important,10).map(v=>cleanString(v,1000)).filter(Boolean),tertiary:cleanArray(sl.tertiary||sl.openQuestions||sl.nextTime,10).map(v=>cleanString(v,1000)).filter(Boolean),imageMaterial:cleanString(sl.imageMaterial||sl.image||'',400),solutionA:cleanArray(sl.solutionA,10).map(v=>cleanString(v,1000)).filter(Boolean),solutionB:cleanArray(sl.solutionB,10).map(v=>cleanString(v,1000)).filter(Boolean),comparison:cleanArray(sl.comparison,10).map(v=>cleanString(v,1000)).filter(Boolean),takeaway:cleanArray(sl.takeaway,10).map(v=>cleanString(v,1000)).filter(Boolean)})).filter(sl=>sl.title||sl.content.length||sl.notes||sl.statement||sl.steps.length||sl.imageMaterial||sl.solutionA.length||sl.solutionB.length);
  const materials=cleanArray(x.materials,30).map(it=>({title:cleanString(it.title,400),kind:it.kind==='book'?'book':'file',source:cleanString(it.source||'',300),pages:cleanString(it.pages||'',120),tasks:cleanString(it.tasks||'',300),variant:allowedVariants.has(it.variant)?it.variant:'standard',copies:Math.max(0,Math.min(200,Number(it.copies)||0)),printMode:it.printMode==='color'?'color':it.printMode==='none'?'none':'bw',alreadyPrinted:!!it.alreadyPrinted,note:cleanString(it.note||'',1000)})).filter(it=>it.title);
  const prepTasks=cleanArray(x.prepTasks||x.todos,30).map(t=>({title:cleanString(t.title||t.task,500),category:cleanString(t.category||'Vorbereitung',120),note:cleanString(t.note||'',1000)})).filter(t=>t.title);
  return {schema:cleanString(x.schema||'schulcockpit.lesson.v2',100),lesson:{title:cleanString(lessonData.title||'',500),objective:cleanString(lessonData.objective||'',1500),footer:cleanString(lessonData.footer||lessonData.footerTopic||'',160)},phases,slides,materials,prepTasks};
}
function aiImportPanel(l,pkg,raw){
  if(!l)return '<p>Stunde nicht gefunden.</p>';
  const preview=pkg?`<section class="import-preview"><div class="section-head compact"><div><span class="eyebrow">VORSCHAU</span><h3>Das würde übernommen</h3></div><span class="import-ok">✓ Datenblock erkannt</span></div><div class="import-stats"><div><strong>${pkg.phases.length}</strong><span>Phasen</span></div><div><strong>${pkg.slides.length}</strong><span>Folien</span></div><div><strong>${pkg.materials.length}</strong><span>Materialien</span></div><div><strong>${pkg.prepTasks.length}</strong><span>To-dos</span></div></div><div class="import-preview-content">${pkg.lesson.title?`<p><strong>Thema:</strong> ${esc(pkg.lesson.title)}</p>`:''}${pkg.lesson.objective?`<p><strong>Ziel:</strong> ${esc(pkg.lesson.objective)}</p>`:''}${pkg.phases.length?`<ol>${pkg.phases.map(p=>`<li><strong>${esc(p.phase)} · ${p.minutes||'?'} Min.</strong> ${esc(p.title)}</li>`).join('')}</ol>`:''}</div><div class="import-options"><label><input type="checkbox" id="imp-lesson" checked> Thema & Ziel übernehmen</label><label><input type="checkbox" id="imp-phases" checked> bisherigen Phasenplan ersetzen</label><label><input type="checkbox" id="imp-slides" checked> Folienideen ersetzen</label><label><input type="checkbox" id="imp-materials" checked> Materialien & Druckbedarf übernehmen</label><label><input type="checkbox" id="imp-prep" checked> Vorbereitungs-To-dos übernehmen</label><label><input type="checkbox" id="imp-status" checked> Stunde auf „Geplant“ setzen</label></div><button class="primary full-button" data-action="apply-ai-import" data-id="${l.id}">Planung jetzt übernehmen →</button></section>`:'';
  return `<div class="detail-stack"><section class="detail-section import-intro"><span class="eyebrow">CHATGPT → SCHULCOCKPIT</span><h3>Komplette Antwort einfügen</h3><p>Du musst den technischen Block nicht heraussuchen. Kopiere einfach meine gesamte Antwort hier hinein. Das Cockpit findet den markierten JSON-Block automatisch und zeigt dir vor dem Import eine Vorschau.</p><textarea id="ai-import-text" class="ai-import-text" placeholder="Hier die komplette ChatGPT-Antwort einfügen …">${esc(raw)}</textarea><div class="import-actions"><label class="upload-button">Antwort als .json/.txt öffnen<input type="file" id="ai-import-file" accept=".json,.txt,.md,application/json,text/plain,text/markdown" hidden></label><button class="primary" data-action="parse-ai-import" data-id="${l.id}">Antwort prüfen</button></div><p class="microcopy">Nichts wird übernommen, bevor du die Vorschau bestätigst.</p></section>${preview}<section class="tip-card"><strong>Warum der Datenblock?</strong><p>ChatGPT bleibt für die didaktische Planung zuständig. Der Datenblock ist nur eine maschinenlesbare Kopie derselben Planung, damit du sie nicht manuell in Phasen, Folien und Materiallisten übertragen musst.</p></section></div>`;
}
function findMaterialForImport(item){ const n=normalizeMaterialTitle(item.title); return state.materials.find(m=>normalizeMaterialTitle(m.title)===n)||null; }
function applyImportedMaterial(l,item){
  let m=findMaterialForImport(item);
  if(!m){ m={id:uid('mat'),title:item.title,kind:item.kind,source:item.source||'',pages:item.pages||'',tasks:item.tasks||'',variants:[],improvementFlags:[]}; state.materials.push(m); }
  if(item.kind==='book'){ m.kind='book'; if(item.source)m.source=item.source;if(item.pages)m.pages=item.pages;if(item.tasks)m.tasks=item.tasks; }
  let v=m.variants.find(v=>v.type===item.variant);
  if(!v){ v={id:uid('var'),type:item.variant,label:variantLabels[item.variant]||'Standard',available:false,fileName:null,fileKey:null}; m.variants.push(v); }
  if(!l.materials.includes(m.id))l.materials.push(m.id);
  if(item.copies>0&&item.printMode!=='none'){ const p=ensurePlan(l,m.id,v.id);p.needed=true;p.count=item.copies;p.mode=item.printMode||'bw';p.alreadyPrinted=p.alreadyPrinted||item.alreadyPrinted; }
  return m;
}
function applyAiPackage(l,pkg,opts){
  if(opts.lesson){ if(pkg.lesson.title)l.title=pkg.lesson.title; if(pkg.lesson.objective)l.objective=pkg.lesson.objective; if(pkg.lesson.footer)l.footerTopic=pkg.lesson.footer; }
  if(opts.phases){ l.phasePlan=pkg.phases.map(p=>({id:uid('phase'),phase:p.phase,minutes:p.minutes||'',title:p.title,details:p.details,done:false})); syncLegacyPlan(l); }
  if(opts.slides)l.slides=pkg.slides.map(sl=>({id:uid('slide'),...sl}));
  if(opts.materials)pkg.materials.forEach(it=>applyImportedMaterial(l,it));
  if(opts.prep){l.prepTasks=l.prepTasks||[];pkg.prepTasks.forEach(t=>{const key=normalizeMaterialTitle(t.title);if(!l.prepTasks.some(x=>normalizeMaterialTitle(x.title)===key))l.prepTasks.push({id:uid('prep'),title:t.title,category:t.category,done:false,note:t.note});});}
  if(opts.status&&l.status!=='done')l.status='planned';
  l.aiImportAt=new Date().toISOString();
}

function sequencePanel(q){
  if(!q)return '<p>Sequenz nicht gefunden.</p>'; const c=cls(q.classId),ls=linkedLessons(q.id);
  return `<div class="detail-stack"><section class="detail-section"><span class="eyebrow">${esc(c?.subject||'')} ${esc(c?.name||'')}</span><div class="lesson-edit-grid"><label class="full">Titel<input data-sequence-field="${q.id}|title" value="${esc(q.title)}"></label><label>Start<input type="date" data-sequence-field="${q.id}|startDate" value="${esc(q.startDate||'')}"></label><label>Geplantes Ende<input type="date" data-sequence-field="${q.id}|endDate" value="${esc(q.endDate||'')}"></label><label class="full">Sequenzziel<textarea data-sequence-field="${q.id}|goal" placeholder="Was sollen die Schüler:innen am Ende können / verstanden haben?">${esc(q.goal||'')}</textarea></label><label>Klassenarbeit / Leistung<input type="date" data-sequence-field="${q.id}|assessmentDate" value="${esc(q.assessmentDate||'')}"></label><label>Notiz<input data-sequence-field="${q.id}|notes" value="${esc(q.notes||'')}" placeholder="optional"></label></div></section><section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">VERKNÜPFTE STUNDEN</span><h3>Tatsächlicher Verlauf</h3></div><span class="muted">${ls.length} Stunden</span></div><div class="linked-lessons">${ls.map(l=>`<button data-lesson="${l.id}"><span>${fmtDate(l.date)}</span><strong>${esc(l.title)}</strong><small>${statusMeta[l.status]?.[0]||l.status}</small></button>`).join('')||'<p class="muted">Noch keine Stunden mit dieser Sequenz verknüpft.</p>'}</div></section></div>`;
}
function newSequencePanel(prefillClassId=(modal?.classId||'')){ return `<div class="detail-stack"><section class="detail-section"><p class="muted">Nur die grobe Einheit reicht zunächst. Einzelstunden entstehen später aus deinem Stundenplan.</p><div class="lesson-edit-grid"><label>Klasse<select id="ns-class">${state.classes.map(c=>`<option value="${c.id}" ${prefillClassId===c.id?'selected':''}>${esc(c.subject)} ${esc(c.name)}</option>`).join('')}</select></label><label>Titel<input id="ns-title" placeholder="z. B. Islam"></label><label>Start<input type="date" id="ns-start"></label><label>Geplantes Ende<input type="date" id="ns-end"></label><label class="full">Sequenzziel<textarea id="ns-goal" placeholder="optional"></textarea></label><label>Klassenarbeit / Leistung<input type="date" id="ns-assessment"></label></div><button class="primary full-button" data-action="create-sequence">Sequenz anlegen</button></section></div>`; }

function makeBrief(l){
  const c=cls(l.classId),q=seq(l.sequenceId),prev=previousLesson(l),materials=l.materials.map(mat).filter(Boolean),r=l.reflection||{};
  const prevR=prev?.reflection||{},prevPlan=prev?.phasePlan||[],unfinished=prevPlan.filter(p=>!p.done&&p.title);
  const currentPlan=l.phasePlan||[];
  return `# Schulcockpit – ChatGPT-Brief\n\n## Lerngruppe\n${c?.subject||''} ${c?.name||''} · ${c?.students||'?'} Schüler:innen\n\n## Sequenz / roter Faden\n${q?.title||l.unit||'noch nicht zugeordnet'}\n- Sequenzziel: ${q?.goal||'noch nicht eingetragen'}\n- Zeitraum: ${q?.startDate||'?'} bis ${q?.endDate||'?'}\n- Klassenarbeit / Leistung: ${q?.assessmentDate||'keine eingetragen'}\n- Notiz: ${q?.notes||'keine'}\n\n## Letzte tatsächlich gehaltene Stunde\n${prev?`${prev.date} · ${prev.title||'ohne Titel'}\nGeplant:\n${prevPlan.length?prevPlan.map(p=>`- [${p.done?'x':' '}] ${p.phase||''}${p.minutes?` (${p.minutes} Min.)`:''}: ${p.title}${p.details?` — ${p.details}`:''}`).join('\n'):'- kein Phasenplan hinterlegt'}\n\nOffen geblieben:\n${unfinished.length?unfinished.map(p=>`- ${p.title}`).join('\n'):'- nichts als offen markiert'}\n\nReflexion:\n- Verlauf: ${prevR.mood||'nicht angegeben'}\n- Zeit: ${prevR.timing||'nicht angegeben'}\n- Lernstand: ${prevR.learning||'nicht angegeben'}\n- Notiz: ${prevR.note||'keine'}`:'Noch keine vorherige Stunde im Schulcockpit vorhanden.'}\n\n## Zu planende / aktuelle Stunde\n- Datum: ${l.date}\n- Thema: ${l.title||'noch festzulegen'}\n- Stundenziel: ${l.objective||'noch nicht festgelegt'}\n- Status: ${statusMeta[l.status]?.[0]||l.status}\n\nBisheriger Entwurf:\n${currentPlan.length?currentPlan.map((p,i)=>`${i+1}. ${p.phase||'Phase'}${p.minutes?` (${p.minutes} Min.)`:''}: ${p.title||'noch offen'}${p.details?` — ${p.details}`:''}`).join('\n'):'- noch kein Verlauf angelegt'}\n\n## Vorhandene Materialien\n${materials.length?materials.map(m=>`- ${m.title}${m.pages?` · ${m.pages}`:''}${m.tasks?` · ${m.tasks}`:''}\n  Varianten: ${m.variants.map(v=>`${v.label}: ${v.available?'vorhanden':'fehlt'}${hasStoredFile(v)?' (Datei lokal gespeichert)':''}`).join(', ')}\n  Offene Überarbeitung: ${m.improvementFlags?.length?m.improvementFlags.join('; '):'keine'}`).join('\n'):'- noch keine Materialien verknüpft'}\n\n## Druckstatus\n${(l.printPlan||[]).filter(p=>p.needed).map(p=>{const m=mat(p.materialId),v=variant(p.materialId,p.variantId);return `- ${m?.title||''} · ${v?.label||''}: ${p.count}× ${p.mode==='color'?'Farbe':'S/W'}${p.alreadyPrinted?' · bereits kopiert':' · noch zu kopieren'}`}).join('\n')||'- nichts geplant'}\n\n## Bereits geplante Folienideen\n${(l.slides||[]).length?(l.slides||[]).map((sl,i)=>`- ${i+1}. ${sl.type||'Folie'}: ${sl.title||''}${(sl.content||[]).length?` — ${(sl.content||[]).join(' | ')}`:''}`).join('\n'):'- noch keine'}\n\n## Offene Vorbereitung\n${(l.prepTasks||[]).filter(t=>!t.done).length?(l.prepTasks||[]).filter(t=>!t.done).map(t=>`- ${t.title}${t.note?` — ${t.note}`:''}`).join('\n'):'- nichts offen'}\n\n## Auftrag an ChatGPT\nPlane bzw. überarbeite die nächste Unterrichtsstunde auf Grundlage des tatsächlichen Lernstands und der Sequenz. Übernimm offene Inhalte aus der letzten Stunde nur, wenn sie didaktisch sinnvoll weitergeführt werden müssen. Verwende vorhandenes Material bevorzugt und berücksichtige, was bereits kopiert ist. Gib aus:\n1. einen klaren Phasenverlauf mit realistischen Minutenangaben,\n2. konkrete Folieninhalte,\n3. exakte Arbeitsaufträge,\n4. benötigte Materialien und Druckbedarf,\n5. sinnvolle Förder-/Forder-/DaZ-Differenzierung nur dort, wo sie wirklich nötig ist,\n6. eine kurze Idee für Sicherung/Reflexion.\n\nWICHTIG FÜR DEN RÜCKIMPORT INS SCHULCOCKPIT:\nAntworte zuerst normal und gut lesbar. Hänge danach zusätzlich GENAU EINEN markierten JSON-Datenblock an. Verwende valides JSON, keine Kommentare und keine zusätzlichen Felder außerhalb dieses Schemas:\n\n<SCHULCOCKPIT_IMPORT>\n{\n  \"schema\": \"schulcockpit.lesson.v1\",\n  \"lesson\": {\"title\": \"...\", \"objective\": \"...\"},\n  \"phases\": [\n    {\"phase\": \"Einstieg\", \"minutes\": 10, \"title\": \"...\", \"details\": \"konkreter Arbeitsauftrag / Ablauf\"}\n  ],\n  \"slides\": [\n    {\"type\": \"Einstieg\", \"title\": \"...\", \"content\": [\"Stichpunkt 1\", \"Stichpunkt 2\"], \"notes\": \"optional\"}\n  ],\n  \"materials\": [\n    {\"title\": \"...\", \"kind\": \"file\", \"variant\": \"standard\", \"copies\": 27, \"printMode\": \"bw\", \"alreadyPrinted\": false, \"note\": \"\"},\n    {\"title\": \"Klett Arbeitsheft Mathematik 5\", \"kind\": \"book\", \"source\": \"Arbeitsheft\", \"pages\": \"S. 28\", \"tasks\": \"Nr. 1–5\", \"variant\": \"standard\", \"copies\": 0, \"printMode\": \"none\", \"alreadyPrinted\": false, \"note\": \"\"}\n  ],\n  \"prepTasks\": [\n    {\"title\": \"...\", \"category\": \"Präsentation\", \"note\": \"optional\"}\n  ]\n}\n</SCHULCOCKPIT_IMPORT>\n\nErlaubte Werte: phase = Einstieg | Aktivierung | Erarbeitung | Übung | Sicherung | Transfer | Reflexion | Sonstiges; variant = standard | challenge | support | daz | solution; printMode = bw | color | none. Bei vorhandenen Materialien den vorhandenen Titel möglichst exakt wiederverwenden. Nur echte noch offene Vorbereitungsschritte in prepTasks aufnehmen; das Kopieren selbst wird über materials/copies gesteuert.\n`;
}

function syncWeek(){
  let added=0;
  state.timetable.forEach(t=>{ const date=dateForWeekday(t.weekday); const exists=state.lessons.some(l=>l.date===date&&l.classId===t.classId&&l.period===t.period); if(!exists){
    const active=classSequences(t.classId).find(q=>(!q.startDate||q.startDate<=date)&&(!q.endDate||q.endDate>=date))||null;
    state.lessons.push({id:uid('lesson'),classId:t.classId,date,period:t.period,sequenceId:active?.id||'',unit:active?.title||'',title:'Thema noch festlegen',objective:'',status:'open',plannedSteps:[],completedSteps:[],phasePlan:[],slides:[],prepTasks:[],materials:[],printPlan:[]});added++;
  }});
  saveState(); alert(added?`${added} fehlende Wochenstunde${added===1?'':'n'} angelegt. Aktive Sequenzen wurden automatisch zugeordnet.`:'Die aktuelle Woche ist bereits vollständig synchronisiert.'); render();
}

function wire(){
  wireBase();
  document.querySelectorAll('[data-view="sequences"]').forEach(()=>{});
  document.querySelectorAll('[data-sequence]').forEach(b=>b.onclick=()=>{modal={type:'sequence',id:b.dataset.sequence};render();});
  document.querySelector('[data-action="new-sequence"]')?.addEventListener('click',()=>{modal={type:'new-sequence',classId:''};render();});
  document.querySelectorAll('[data-action="new-sequence-for-lesson"]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.id);modal={type:'new-sequence',classId:l.classId,returnLessonId:l.id};render();});
  if(modal?.type==='new-sequence'){
    const holder=document.querySelector('.modal-body'); if(holder&&modal.classId){ const sel=holder.querySelector('#ns-class'); if(sel)sel.value=modal.classId; }
  }
  document.querySelector('[data-action="create-sequence"]')?.addEventListener('click',()=>{const classId=document.getElementById('ns-class').value,title=document.getElementById('ns-title').value.trim();if(!title)return alert('Bitte einen Titel für die Sequenz eintragen.');const q={id:uid('seq'),classId,title,startDate:document.getElementById('ns-start').value,endDate:document.getElementById('ns-end').value,goal:document.getElementById('ns-goal').value.trim(),assessmentDate:document.getElementById('ns-assessment').value,notes:''};state.sequences.push(q);if(modal?.returnLessonId){const l=lesson(modal.returnLessonId);l.sequenceId=q.id;l.unit=q.title;}saveState();modal={type:'sequence',id:q.id};render();});
  document.querySelectorAll('[data-sequence-field]').forEach(i=>i.onchange=()=>{const [qid,key]=i.dataset.sequenceField.split('|'),q=seq(qid);q[key]=i.value;if(key==='title')state.lessons.filter(l=>l.sequenceId===qid).forEach(l=>l.unit=i.value);saveState();modal={type:'sequence',id:qid};render();});
  document.querySelectorAll('[data-sequence-select]').forEach(s=>s.onchange=()=>{const l=lesson(s.dataset.sequenceSelect);l.sequenceId=s.value;const q=seq(s.value);l.unit=q?.title||'';saveState();modal={type:'lesson',id:l.id};render();});
  document.querySelectorAll('[data-add-phase]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.addPhase);l.phasePlan=l.phasePlan||[];l.phasePlan.push({id:uid('phase'),phase:l.phasePlan.length?'Erarbeitung':'Einstieg',minutes:'',title:'',details:'',done:false});syncLegacyPlan(l);saveState();modal={type:'lesson',id:l.id};render();});
  document.querySelectorAll('[data-phase-field]').forEach(i=>i.onchange=()=>{const [lid,pid,key]=i.dataset.phaseField.split('|'),l=lesson(lid),p=(l.phasePlan||[]).find(x=>x.id===pid);if(!p)return;p[key]=i.value;syncLegacyPlan(l);saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-phase-done]').forEach(i=>i.onchange=()=>{const [lid,pid]=i.dataset.phaseDone.split('|'),l=lesson(lid),p=(l.phasePlan||[]).find(x=>x.id===pid);if(!p)return;p.done=i.checked;syncLegacyPlan(l);saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-delete-phase]').forEach(b=>b.onclick=()=>{const [lid,pid]=b.dataset.deletePhase.split('|'),l=lesson(lid);l.phasePlan=(l.phasePlan||[]).filter(x=>x.id!==pid);syncLegacyPlan(l);saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-action="carry-over"]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.id),prev=previousLesson(l);if(!prev)return;const open=(prev.phasePlan||[]).filter(p=>!p.done&&p.title);l.phasePlan=l.phasePlan||[];open.forEach(p=>{if(!l.phasePlan.some(x=>x.title===p.title))l.phasePlan.push({id:uid('phase'),phase:p.phase||'Erarbeitung',minutes:p.minutes||'',title:p.title,details:[p.details,'aus letzter Stunde übernommen'].filter(Boolean).join(' · '),done:false});});syncLegacyPlan(l);saveState();modal={type:'lesson',id:l.id};render();});
  document.querySelectorAll('[data-action="copy-brief"]').forEach(b=>b.onclick=async()=>{const text=makeBrief(lesson(b.dataset.id));try{await navigator.clipboard.writeText(text);const old=b.textContent;b.textContent='Kopiert ✓';setTimeout(()=>{b.textContent=old},1200);}catch{downloadText('ChatGPT-Brief.md',text);}});
  document.querySelectorAll('[data-action="open-ai-import"]').forEach(b=>b.onclick=()=>{modal={type:'ai-import',id:b.dataset.id,raw:'',parsed:null};render();});
  document.querySelector('[data-action="parse-ai-import"]')?.addEventListener('click',e=>{const raw=document.getElementById('ai-import-text')?.value||'';try{const parsed=parseAiImport(raw);modal={type:'ai-import',id:e.currentTarget.dataset.id,raw,parsed};render();}catch(err){alert(err.message||'Import konnte nicht gelesen werden.');}});
  document.querySelector('#ai-import-file')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;const raw=await f.text();try{const parsed=parseAiImport(raw);modal={type:'ai-import',id:modal.id,raw,parsed};render();}catch(err){modal={type:'ai-import',id:modal.id,raw,parsed:null};render();alert(err.message||'Datei konnte nicht gelesen werden.');}});
  document.querySelector('[data-action="apply-ai-import"]')?.addEventListener('click',e=>{if(!modal?.parsed)return;const l=lesson(e.currentTarget.dataset.id);const opts={lesson:!!document.getElementById('imp-lesson')?.checked,phases:!!document.getElementById('imp-phases')?.checked,slides:!!document.getElementById('imp-slides')?.checked,materials:!!document.getElementById('imp-materials')?.checked,prep:!!document.getElementById('imp-prep')?.checked,status:!!document.getElementById('imp-status')?.checked};applyAiPackage(l,modal.parsed,opts);saveState();modal={type:'lesson',id:l.id};render();});
  document.querySelectorAll('[data-prep-done]').forEach(x=>x.onchange=()=>{const [lid,tid]=x.dataset.prepDone.split('|'),l=lesson(lid),t=(l.prepTasks||[]).find(t=>t.id===tid);if(t)t.done=x.checked;saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-delete-prep]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const [lid,tid]=b.dataset.deletePrep.split('|'),l=lesson(lid);l.prepTasks=(l.prepTasks||[]).filter(t=>t.id!==tid);saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-delete-slide]').forEach(b=>b.onclick=()=>{const [lid,sid]=b.dataset.deleteSlide.split('|'),l=lesson(lid);l.slides=(l.slides||[]).filter(sl=>sl.id!==sid);saveState();modal={type:'lesson',id:lid};render();});
  // Re-wire lesson links inside sequence modals because wireBase bound them before this content-specific override.
  document.querySelectorAll('.linked-lessons [data-lesson]').forEach(b=>b.onclick=()=>{modal={type:'lesson',id:b.dataset.lesson};render();});
}

render();
refreshStoredFileKeys();

// ---- V0.6: echter Nullstart, Wochenraster, aktive Planungswoche & Setup-Import ----
function defaultPeriods(){ return ['GA / Tutorat','1. Block','2. Block','3. Block','4. Block','5. Block']; }
function defaultPlanningWeekStart(){
  const now=new Date(); now.setHours(12,0,0,0); const m=mondayOf(now);
  if(now.getDay()===0||now.getDay()===6)m.setDate(m.getDate()+7);
  return iso(m);
}
function makeEmptyState(){
  return {settings:{schoolYear:'2026/27',weeklyPrintDay:1,activeWeekStart:defaultPlanningWeekStart(),periods:defaultPeriods(),demoCleanV06:true},classes:[],timetable:[],sequences:[],materials:[],lessons:[],backlog:[]};
}
function inferSlotFromPeriod(period,fallback=1){
  const p=String(period||'').toLowerCase(); if(p.includes('ga')||p.includes('tutor'))return 0;
  const m=p.match(/(\d+)/); return m?Math.max(0,Number(m[1])):Math.max(0,Number(fallback)||0);
}
function periodLabelForState(s,slot){ return s.settings?.periods?.[slot]||`${slot}. Block`; }
function cleanUntouchedDemoData(out){
  if(out.settings?.demoCleanV06)return out;
  const demoClassFingerprints={m5a:['Mathematik','5a'],r5b:['Religion','5b'],r8a:['Religion','8a'],r11:['Religion','11']};
  const removeClassIds=new Set(out.classes.filter(c=>demoClassFingerprints[c.id]&&c.subject===demoClassFingerprints[c.id][0]&&c.name===demoClassFingerprints[c.id][1]).map(c=>c.id));
  const demoTimetable={tt1:['m5a',1,'1. Block'],tt2:['r8a',2,'1./2. Block'],tt3:['r5b',3,'2. Block'],tt4:['r11',4,'3./4. Block']};
  out.timetable=out.timetable.filter(t=>{const f=demoTimetable[t.id];return !(f&&t.classId===f[0]&&Number(t.weekday)===f[1]&&String(t.period)===f[2])&&!removeClassIds.has(t.classId);});
  const demoLessons={l1:'Schriftliche Addition und Subtraktion vertiefen',l2:'Der Koran – Aufbau und Orientierung',l3:'Orientierung in der Bibel',l4:'Menschenbilder vergleichen'};
  out.lessons=out.lessons.filter(l=>!(demoLessons[l.id]&&l.title===demoLessons[l.id])&&!removeClassIds.has(l.classId));
  const demoSeq={'seq-m5-rechnen':'Schriftliche Rechenverfahren','seq-r5-bibel':'Die Bibel kennenlernen','seq-r8-islam':'Islam','seq-r11-anthro':'Anthropologie'};
  out.sequences=out.sequences.filter(q=>!(demoSeq[q.id]&&q.title===demoSeq[q.id])&&!removeClassIds.has(q.classId));
  const demoMat={'mat-addition':'Fehlerdetektiv – schriftliche Addition','mat-ah':'Klett Arbeitsheft Mathematik 5','mat-koran':'Koran – Aufbau und Orientierung','mat-bibel':'Bibel-Rätsel'};
  const removedMaterials=new Set(out.materials.filter(m=>demoMat[m.id]&&m.title===demoMat[m.id]).map(m=>m.id));
  out.materials=out.materials.filter(m=>!removedMaterials.has(m.id));
  out.lessons.forEach(l=>{l.materials=(l.materials||[]).filter(id=>!removedMaterials.has(id));l.printPlan=(l.printPlan||[]).filter(p=>!removedMaterials.has(p.materialId));});
  out.backlog=out.backlog.filter(b=>!['b1','b2','b3','b4'].includes(b.id)&&!removedMaterials.has(b.materialId));
  out.classes=out.classes.filter(c=>!removeClassIds.has(c.id));
  out.settings.demoCleanV06=true;
  return out;
}
function migrateV06(out){
  out.settings=out.settings||{};
  if(!Array.isArray(out.settings.periods)||!out.settings.periods.length)out.settings.periods=defaultPeriods();
  if(!out.settings.activeWeekStart)out.settings.activeWeekStart=defaultPlanningWeekStart();
  out=cleanUntouchedDemoData(out);
  out.timetable=(out.timetable||[]).map(t=>{const slot=Number.isFinite(Number(t.slot))?Number(t.slot):inferSlotFromPeriod(t.period,t.order);return {...t,slot,order:slot,period:periodLabelForState(out,slot)};});
  out.lessons=(out.lessons||[]).map(l=>{let slot=Number.isFinite(Number(l.slot))?Number(l.slot):inferSlotFromPeriod(l.period,1);const tt=out.timetable.find(t=>t.classId===l.classId&&t.weekday===new Date(l.date+'T12:00:00').getDay()&&t.slot===slot);return {...l,slot,period:tt?tt.period:(l.period||periodLabelForState(out,slot))};});
  return out;
}
function loadState(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return migrateV06(migrate(raw||makeEmptyState()));
  }catch{return migrateV06(migrate(makeEmptyState()));}
}
function activeMonday(){ return new Date((state.settings.activeWeekStart||defaultPlanningWeekStart())+'T12:00:00'); }
function activeWeekDate(day){ const d=activeMonday();d.setDate(d.getDate()+day-1);return iso(d); }
function activeWeekNumber(){ return kw(activeMonday()); }
function activeWeekEnd(){ const d=activeMonday();d.setDate(d.getDate()+4);return iso(d); }
function lessonSlot(l){ if(Number.isFinite(Number(l.slot)))return Number(l.slot);return inferSlotFromPeriod(l.period,99); }
function currentWeekLessons(){ const m=iso(activeMonday()),f=activeWeekEnd();return state.lessons.filter(l=>l.date>=m&&l.date<=f).sort((a,b)=>a.date.localeCompare(b.date)||lessonSlot(a)-lessonSlot(b)); }
function shiftActiveWeek(delta){const d=activeMonday();d.setDate(d.getDate()+delta*7);state.settings.activeWeekStart=iso(d);saveState();render();}
function activeWeekLabel(){const m=activeMonday(),f=new Date(m);f.setDate(f.getDate()+4);const fmt=new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit'});return `${fmt.format(m)}–${fmt.format(f)}`;}

function timetableEntry(day,slot){return state.timetable.find(t=>Number(t.weekday)===Number(day)&&Number(t.slot)===Number(slot));}
function setTimetableCell(day,slot,classId){
  const existing=timetableEntry(day,slot),label=state.settings.periods[slot]||`${slot}. Block`;
  if(!classId){if(existing)state.timetable=state.timetable.filter(t=>t.id!==existing.id);}
  else if(existing){existing.classId=classId;existing.period=label;existing.order=slot;existing.slot=slot;}
  else state.timetable.push({id:uid('tt'),weekday:Number(day),slot:Number(slot),order:Number(slot),period:label,classId});
  saveState();render();
}
function updatePeriodLabel(slot,label){
  state.settings.periods[slot]=label||`Block ${slot+1}`;
  state.timetable.filter(t=>Number(t.slot)===Number(slot)).forEach(t=>t.period=state.settings.periods[slot]);
  currentWeekLessons().filter(l=>Number(l.slot)===Number(slot)&&l.source==='timetable').forEach(l=>l.period=state.settings.periods[slot]);
  saveState();render();
}
function addPeriod(){state.settings.periods.push(`${state.settings.periods.length}. Block`);saveState();render();}
function removePeriod(slot){
  if(state.timetable.some(t=>Number(t.slot)===Number(slot)))return alert('In diesem Block stehen noch Unterrichtsstunden. Leere zuerst die Zellen im Stundenplan.');
  state.settings.periods.splice(slot,1);
  state.timetable.forEach(t=>{if(t.slot>slot){t.slot--;t.order=t.slot;t.period=state.settings.periods[t.slot];}});
  saveState();render();
}

function createBlankLessonFromTimetable(t){
  const date=activeWeekDate(t.weekday),active=classSequences(t.classId).find(q=>(!q.startDate||q.startDate<=date)&&(!q.endDate||q.endDate>=date))||null;
  return {id:uid('lesson'),classId:t.classId,date,period:t.period,slot:t.slot,timetableId:t.id,source:'timetable',sequenceId:active?.id||'',unit:active?.title||'',title:'Thema noch festlegen',objective:'',status:'open',plannedSteps:[],completedSteps:[],phasePlan:[],slides:[],prepTasks:[],materials:[],printPlan:[]};
}
function rebuildActiveWeek(replace=false){
  if(!state.timetable.length)return alert('Dein Stundenplan ist noch leer. Trage zuerst deine Wochenstunden ein.');
  const existingWeek=currentWeekLessons(),matched=new Set();let added=0,kept=0,removed=0;
  state.timetable.forEach(t=>{
    const date=activeWeekDate(t.weekday);
    let l=existingWeek.find(x=>x.timetableId===t.id)||existingWeek.find(x=>x.date===date&&x.classId===t.classId&&lessonSlot(x)===Number(t.slot));
    if(l){l.date=date;l.period=t.period;l.slot=t.slot;l.timetableId=t.id;l.source='timetable';matched.add(l.id);kept++;}
    else{l=createBlankLessonFromTimetable(t);state.lessons.push(l);matched.add(l.id);added++;}
  });
  if(replace){
    const start=iso(activeMonday()),end=activeWeekEnd();
    state.lessons=state.lessons.filter(l=>{
      if(l.date<start||l.date>end)return true;
      if(matched.has(l.id)||l.status==='done'||l.source==='manual')return true;
      removed++;return false;
    });
  }
  saveState();
  alert(`${added} Stunde${added===1?'':'n'} neu angelegt · ${kept} vorhandene Planung${kept===1?'':'en'} weiterverwendet${replace?` · ${removed} veraltete Stunde${removed===1?'':'n'} entfernt`:''}.`);
  render();
}
function syncWeek(){rebuildActiveWeek(false);}

function workflowTasks(){
  const lessons=currentWeekLessons(),tasks=[];
  lessons.forEach(l=>{
    const c=cls(l.classId),who=`${c?.subject||''} ${c?.name||''}`.trim(),slot=lessonSlot(l),hasPlan=(l.phasePlan||[]).some(p=>p.title?.trim());
    if(l.status==='open'||!hasPlan)tasks.push({id:`plan-${l.id}`,stage:1,date:l.date,slot,type:'plan',lessonId:l.id,title:`${who}: Stunde planen`,detail:`${fmtDate(l.date)} · ${l.period} · ${l.title||'Thema noch festlegen'}`,why:previousLesson(l)?'Der Stand der letzten Stunde ist hinterlegt. Plane jetzt nur den nächsten sinnvollen Schritt.':'Erst die Planung klären, damit Material und Kopierbedarf feststehen.'});
    const missing=missingPrintFilesForLesson(l);
    if(l.status==='needs-material'||missing.length)tasks.push({id:`material-${l.id}`,stage:2,date:l.date,slot,type:'material',lessonId:l.id,title:`${who}: Material fertigstellen`,detail:missing.length?`${missing.length} Druckdatei${missing.length===1?' fehlt':'en fehlen'} · ${l.period}`:`${fmtDate(l.date)} · ${l.title}`,why:'Vor dem Kopierlauf müssen die tatsächlich benötigten Dateien vorhanden sein.'});
    (l.prepTasks||[]).filter(t=>!t.done&&t.title).forEach(t=>tasks.push({id:`prep-${l.id}-${t.id}`,stage:2,date:l.date,slot,type:'prep',lessonId:l.id,title:`${who}: ${t.title}`,detail:`${t.category||'Vorbereitung'} · ${fmtDate(l.date)} · ${l.period}`,why:t.note||'Diese Vorbereitung ist noch offen.'}));
  });
  const openPrint=openPrintItems().filter(i=>i.fileReady);if(openPrint.length)tasks.push({id:'print-week',stage:3,date:activeWeekDate(1),slot:99,type:'print',title:'Wochenkopien erledigen',detail:`${openPrint.length} druckbereite Position${openPrint.length===1?'':'en'} · Farbe und S/W gesammelt`,why:'Alles gesammelt kopieren, statt morgens vor dem Unterricht.'});
  lessons.forEach(l=>{const c=cls(l.classId),slot=lessonSlot(l);if(l.status==='planned')tasks.push({id:`final-${l.id}`,stage:4,date:l.date,slot,type:'final',lessonId:l.id,title:`${c?.subject||''} ${c?.name||''}: Feinschliff abschließen`,detail:`${fmtDate(l.date)} · ${l.period}`,why:'Die Grobplanung steht; jetzt nur noch das wirklich Nötige fertigstellen.'});if(l.status==='done'&&!(l.reflection&&Object.keys(l.reflection).length))tasks.push({id:`reflect-${l.id}`,stage:5,date:l.date,slot,type:'reflect',lessonId:l.id,title:`${c?.subject||''} ${c?.name||''}: kurz reflektieren`,detail:'10-Sekunden-Reflexion · Klicks reichen',why:'Damit die nächste Stunde auf dem tatsächlichen Stand aufbaut.'});});
  return tasks.sort((a,b)=>a.stage-b.stage||a.date.localeCompare(b.date)||(a.slot??99)-(b.slot??99));
}

function render(){
  const app=document.getElementById('app'),weekNo=activeWeekNumber();
  app.innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">SC</div><div><strong>Schulcockpit</strong><small>${esc(state.settings.schoolYear)} · V0.6</small></div></div><nav>${navBtn('focus','✦','Was jetzt?')}${navBtn('week','▦','Meine Woche')}${navBtn('sequences','≋','Sequenzen & Jahr')}${navBtn('timetable','⌗','Stundenplan & Klassen')}${navBtn('print','⎙','Kopierzentrum')}${navBtn('materials','▤','Materialbibliothek')}${navBtn('improve','↗','Unterricht verbessern')}</nav><div class="sidebar-footer"><button data-action="setup-import">Setup importieren</button><button data-action="brief-picker">ChatGPT-Brief</button><button data-action="backup">Backup</button></div></aside><main><header class="topbar"><div><span class="eyebrow">KW ${weekNo} · ${activeWeekLabel()}</span><h1>${pageTitle()}</h1></div><div class="top-actions"><div class="week-switcher"><button data-action="prev-week" title="Vorherige Woche">←</button><button data-action="planning-week" title="Zur aktuellen Planungswoche">KW ${weekNo}</button><button data-action="next-week" title="Nächste Woche">→</button></div><span class="storage-pill">Dateien: ${storedFileKeys.size} lokal</span><button class="primary" data-action="rebuild-week">Woche aufbauen</button></div></header><div class="page">${viewHtml()}</div></main></div>${modal?modalHtml():''}`;
  wire();
}
function focusView(){
  const tasks=workflowTasks(),next=tasks[0],noTimetable=!state.timetable.length,noWeek=!currentWeekLessons().length;
  if(noTimetable)return `<div class="content-grid"><section class="focus-hero onboarding-hero"><div><span class="eyebrow">ERST EINMAL DEINE ECHTEN DATEN</span><h2>Das Cockpit startet jetzt ohne erfundene Stunden.</h2><p>Importiere deine vorhandenen Daten oder trage deinen Stundenplan einmal im Wochenraster ein. Danach baut das Cockpit die Woche automatisch in der richtigen Reihenfolge.</p></div><div class="hero-actions"><button class="secondary" data-action="setup-import">Vorhandenes importieren</button><button class="primary" data-view="timetable">Stundenplan öffnen →</button></div></section>${setupHelpCard()}</div>`;
  if(noWeek)return `<div class="content-grid"><section class="focus-hero"><div><span class="eyebrow">STUNDENPLAN IST DA</span><h2>Baue jetzt KW ${activeWeekNumber()} aus deinem Stundenplan auf.</h2><p>Vorhandene Planungen für passende Stunden bleiben erhalten; falsche Alt-Einträge können beim Neuaufbau entfernt werden.</p></div><button class="primary big" data-action="rebuild-week">Woche aufbauen →</button></section></div>`;
  return `<div class="content-grid"><section class="focus-hero ${!next?'all-done':''}"><div>${next?`<span class="eyebrow">DEIN NÄCHSTER SCHRITT</span><h2>${esc(next.title)}</h2><p>${esc(next.why)}</p><span class="next-meta">${esc(next.detail)}</span>`:`<span class="eyebrow">ALLES WICHTIGE ERLEDIGT</span><h2>Für diese Planungswoche ist gerade nichts Akutes offen.</h2><p>Wenn du Zeit hast, kannst du im Verbesserungs-Backlog weiterarbeiten.</p>`}</div>${next?`<button class="primary big" data-task="${next.id}">Jetzt erledigen →</button>`:'<div class="done-badge">✓</div>'}</section><section class="workflow-strip">${[1,2,3,4,5].map(s=>{const has=tasks.some(t=>t.stage===s),done=tasks.every(t=>t.stage>s);return `<div class="workflow-step ${has?'active-step':''} ${done?'complete-step':''}"><span>${s}</span><div><strong>${stageLabel(s).replace(/^\d · /,'')}</strong><small>${tasks.filter(t=>t.stage===s).length} offen</small></div></div>`}).join('')}</section><section class="panel"><div class="section-head"><div><span class="eyebrow">ARBEITSREIHENFOLGE</span><h2>Von oben nach unten.</h2></div><span class="muted">${tasks.length} Aufgaben</span></div><div class="task-queue">${tasks.map(taskCard).join('')||'<div class="empty-state">Alles erledigt. ✦</div>'}</div></section></div>`;
}
function setupHelpCard(){return `<section class="tip-card"><strong>Du musst nicht alles neu eintippen.</strong><p>Wenn dein Stundenplan, Reihen oder Stunden schon in „Mein Schulplan“ oder in unseren bisherigen Chats stehen, kannst du mir Screenshots bzw. einen Export geben. Ich kann daraus einen einzigen Schulcockpit-Setup-Block erzeugen, den du hier importierst.</p></section>`;}
function weekView(){
  const ls=currentWeekLessons(),tasks=workflowTasks(),prints=openPrintItems();
  return `<div class="content-grid"><section class="week-toolbar panel"><div><span class="eyebrow">PLANUNGSWOCHE</span><h2>KW ${activeWeekNumber()} · ${activeWeekLabel()}</h2></div><div class="hero-actions"><button class="secondary" data-action="sync-week">Nur fehlende Stunden ergänzen</button><button class="primary" data-action="rebuild-week">Neu aus Stundenplan aufbauen</button></div></section><section class="stats-row">${stat('Unterrichtsstunden',ls.length,'in dieser Planungswoche')}${stat('Arbeitsaufgaben',tasks.length,'priorisiert offen')}${stat('Druckpositionen',prints.length,'noch nicht kopiert')}${stat('Sequenzen',state.sequences.length,'angelegt')}</section><section class="panel"><div class="section-head"><div><span class="eyebrow">KW ${activeWeekNumber()}</span><h2>Unterricht in Reihenfolge</h2></div></div><div class="lesson-list">${ls.map(lessonCardV04).join('')||'<p class="muted">Noch keine Stunden für diese Woche. Nutze „Neu aus Stundenplan aufbauen“.</p>'}</div></section></div>`;
}
function timetableView(){
  const periods=state.settings.periods||defaultPeriods();
  return `<div class="content-grid"><section class="hero-card timetable-hero"><div><span class="eyebrow">EINMAL EINRICHTEN</span><h2>Dein echter Stundenplan ist die Grundlage.</h2><p>Du wählst pro Feld nur die Klasse aus. Wochentag und Block ergeben sich automatisch aus dem Raster – kein „1. Block“ mehr händisch tippen.</p></div><button class="secondary" data-action="setup-import">Aus vorhandenen Daten importieren</button></section><section class="panel"><div class="section-head"><div><span class="eyebrow">KLASSEN</span><h2>Deine Lerngruppen</h2></div></div><div class="class-editor">${state.classes.map(c=>`<div class="class-edit-row"><input value="${esc(c.subject)}" data-class-field="${c.id}|subject"><input value="${esc(c.name)}" data-class-field="${c.id}|name"><input class="small-input" type="number" min="1" value="${c.students}" data-class-field="${c.id}|students"><button class="danger-lite" data-delete-class="${c.id}">×</button></div>`).join('')||'<p class="muted">Noch keine Klassen. Du kannst sie hier anlegen oder gesammelt importieren.</p>'}</div><div class="add-class-row"><input id="new-subject" placeholder="Fach"><input id="new-class" placeholder="Klasse / Kurs"><input id="new-students" type="number" value="25" min="1"><button data-action="add-class">+ Klasse</button></div></section><section class="panel"><div class="section-head"><div><span class="eyebrow">WOCHENRASTER</span><h2>Stundenplan</h2></div><div class="hero-actions"><button class="secondary" data-action="sync-week">Fehlende ergänzen</button><button class="primary" data-action="rebuild-week">Woche neu aufbauen</button></div></div><div class="timetable-matrix"><div class="tt-corner">Block</div>${[1,2,3,4,5].map(d=>`<div class="tt-day-head">${dayNames[d]}</div>`).join('')}${periods.map((label,slot)=>`<div class="tt-period-label"><input value="${esc(label)}" data-period-label="${slot}" aria-label="Blockbezeichnung"><button class="danger-lite tiny" data-remove-period="${slot}" title="Blockzeile entfernen">×</button></div>${[1,2,3,4,5].map(day=>{const t=timetableEntry(day,slot);return `<div class="tt-cell"><select data-tt-cell="${day}|${slot}"><option value="">— frei —</option>${state.classes.map(c=>`<option value="${c.id}" ${t?.classId===c.id?'selected':''}>${esc(c.subject)} ${esc(c.name)}</option>`).join('')}</select></div>`}).join('')}`).join('')}</div><button class="text-button add-period" data-action="add-period">+ weitere Blockzeile</button><p class="microcopy">Die Reihenfolge ist fest durch das Raster definiert. Änderungen am Stundenplan wirken erst auf eine Woche, wenn du sie synchronisierst bzw. neu aufbaust.</p></section>${setupHelpCard()}</div>`;
}

function parseSetupImport(raw){
  const text=String(raw||'').replace(/^\uFEFF/,'').trim();if(!text)throw new Error('Füge zuerst den Setup-Block ein.');
  const candidates=[text],marker=text.match(/<SCHULCOCKPIT_SETUP>([\s\S]*?)<\/SCHULCOCKPIT_SETUP>/i);if(marker)candidates.unshift(marker[1].trim());
  const fence=/```(?:json|schulcockpit)?\s*([\s\S]*?)```/gi;let m;while((m=fence.exec(text)))candidates.unshift(m[1].trim());
  let x=null;for(const c of candidates){try{const p=JSON.parse(c);const r=p?.schulcockpitSetup||p;if(r&&(r.schema==='schulcockpit.setup.v1'||r.classes||r.timetable)){x=r;break;}}catch{}}
  if(!x)throw new Error('Kein lesbarer Schulcockpit-Setup-Block gefunden.');
  return {schema:'schulcockpit.setup.v1',schoolYear:cleanString(x.schoolYear||'',30),periods:cleanArray(x.periods,12).map(v=>cleanString(v,60)).filter(Boolean),classes:cleanArray(x.classes,50).map((c,i)=>({key:cleanString(c.key||`class${i+1}`,80),subject:cleanString(c.subject,120),name:cleanString(c.name||c.className,120),students:Math.max(1,Math.min(60,Number(c.students)||25))})).filter(c=>c.subject&&c.name),timetable:cleanArray(x.timetable,100).map(t=>({weekday:Math.max(1,Math.min(5,Number(t.weekday)||1)),slot:Math.max(0,Math.min(20,Number(t.slot)||0)),classKey:cleanString(t.classKey,80)})).filter(t=>t.classKey),sequences:cleanArray(x.sequences,100).map(q=>({classKey:cleanString(q.classKey,80),title:cleanString(q.title,300),startDate:cleanString(q.startDate,20),endDate:cleanString(q.endDate,20),goal:cleanString(q.goal,2000),assessmentDate:cleanString(q.assessmentDate,20),notes:cleanString(q.notes,2000)})).filter(q=>q.classKey&&q.title),lessons:cleanArray(x.lessons,200).map(l=>({classKey:cleanString(l.classKey,80),date:cleanString(l.date,20),slot:Math.max(0,Math.min(20,Number(l.slot)||0)),title:cleanString(l.title,500),objective:cleanString(l.objective,1500),sequenceTitle:cleanString(l.sequenceTitle,300),status:['open','planned','needs-material','ready','done'].includes(l.status)?l.status:'open'})).filter(l=>l.classKey&&l.date)};
}
function setupImportPanel(pkg,raw=''){
  const preview=pkg?`<section class="import-preview"><div class="section-head compact"><div><span class="eyebrow">VORSCHAU</span><h3>Gefundene Daten</h3></div><span class="import-ok">✓ lesbar</span></div><div class="import-stats"><div><strong>${pkg.classes.length}</strong><span>Klassen</span></div><div><strong>${pkg.timetable.length}</strong><span>Wochenstunden</span></div><div><strong>${pkg.sequences.length}</strong><span>Sequenzen</span></div><div><strong>${pkg.lessons.length}</strong><span>konkrete Stunden</span></div></div><div class="import-options"><label><input type="checkbox" id="setup-classes" checked> Klassen übernehmen / zusammenführen</label><label><input type="checkbox" id="setup-timetable" checked> Stundenplan durch Import ersetzen</label><label><input type="checkbox" id="setup-sequences" checked> Sequenzen übernehmen</label><label><input type="checkbox" id="setup-lessons" checked> konkrete Stunden übernehmen</label></div><button class="primary full-button" data-action="apply-setup-import">Setup übernehmen →</button></section>`:'';
  return `<div class="detail-stack"><section class="detail-section import-intro"><span class="eyebrow">EINMALIGER IMPORT</span><h3>Vorhandenes statt neu eintippen</h3><p>Schick mir in ChatGPT Screenshots oder einen Export aus „Mein Schulplan“ sowie die Reihen, die wir bereits geplant haben. Ich kann daraus einen einzigen <strong>SCHULCOCKPIT_SETUP</strong>-Block erzeugen. Den fügst du hier komplett ein.</p><textarea id="setup-import-text" class="ai-import-text" placeholder="Hier den <SCHULCOCKPIT_SETUP>-Block einfügen …">${esc(raw)}</textarea><div class="import-actions"><label class="upload-button">Setup-Datei öffnen<input type="file" id="setup-import-file" accept=".json,.txt,.md,application/json,text/plain,text/markdown" hidden></label><button class="primary" data-action="parse-setup-import">Setup prüfen</button></div><p class="microcopy">Nichts wird übernommen, bevor du die Vorschau bestätigst.</p></section>${preview}<section class="danger-zone"><strong>Falsche Testdaten im Cockpit?</strong><p>V0.6 entfernt die ursprünglichen unveränderten Demo-Daten automatisch. Falls du darüber hinaus komplett neu beginnen möchtest, kannst du nach einem Backup alle Planungsdaten leeren.</p><button class="danger-lite" data-action="clear-planning-data">Planungsdaten komplett leeren</button></section></div>`;
}
function applySetupPackage(pkg,opts){
  if(pkg.schoolYear)state.settings.schoolYear=pkg.schoolYear;if(pkg.periods.length)state.settings.periods=pkg.periods;
  const keyMap=new Map();
  if(opts.classes){pkg.classes.forEach((c,i)=>{let found=state.classes.find(x=>x.subject.toLowerCase()===c.subject.toLowerCase()&&x.name.toLowerCase()===c.name.toLowerCase());if(!found){found={id:uid('class'),subject:c.subject,name:c.name,students:c.students,color:['#6d5f9b','#b86f8b','#557b78','#8b684c','#8a6b88'][state.classes.length%5]};state.classes.push(found);}else found.students=c.students;keyMap.set(c.key,found.id);});}
  pkg.classes.forEach(c=>{if(!keyMap.has(c.key)){const found=state.classes.find(x=>x.subject.toLowerCase()===c.subject.toLowerCase()&&x.name.toLowerCase()===c.name.toLowerCase());if(found)keyMap.set(c.key,found.id);}});
  if(opts.timetable){state.timetable=[];pkg.timetable.forEach(t=>{const classId=keyMap.get(t.classKey);if(!classId)return;while(state.settings.periods.length<=t.slot)state.settings.periods.push(`${state.settings.periods.length}. Block`);state.timetable.push({id:uid('tt'),weekday:t.weekday,slot:t.slot,order:t.slot,period:state.settings.periods[t.slot],classId});});}
  if(opts.sequences){pkg.sequences.forEach(q=>{const classId=keyMap.get(q.classKey);if(!classId)return;let found=state.sequences.find(x=>x.classId===classId&&x.title.toLowerCase()===q.title.toLowerCase());if(!found){found={id:uid('seq'),classId,title:q.title,startDate:q.startDate,endDate:q.endDate,goal:q.goal,assessmentDate:q.assessmentDate,notes:q.notes};state.sequences.push(found);}else Object.assign(found,{startDate:q.startDate||found.startDate,endDate:q.endDate||found.endDate,goal:q.goal||found.goal,assessmentDate:q.assessmentDate||found.assessmentDate,notes:q.notes||found.notes});});}
  if(opts.lessons){pkg.lessons.forEach(i=>{const classId=keyMap.get(i.classKey);if(!classId)return;let l=state.lessons.find(x=>x.classId===classId&&x.date===i.date&&lessonSlot(x)===i.slot);const q=state.sequences.find(x=>x.classId===classId&&x.title.toLowerCase()===i.sequenceTitle.toLowerCase());if(!l){l={id:uid('lesson'),classId,date:i.date,slot:i.slot,period:state.settings.periods[i.slot]||`${i.slot}. Block`,source:'import',sequenceId:q?.id||'',unit:q?.title||i.sequenceTitle||'',title:i.title||'Thema noch festlegen',objective:i.objective||'',status:i.status,plannedSteps:[],completedSteps:[],phasePlan:[],slides:[],prepTasks:[],materials:[],printPlan:[]};state.lessons.push(l);}else{if(i.title)l.title=i.title;if(i.objective)l.objective=i.objective;if(q){l.sequenceId=q.id;l.unit=q.title;}l.status=i.status||l.status;}});}
  state.settings.demoCleanV06=true;saveState();
}
function clearPlanningData(){state=makeEmptyState();saveState();modal=null;view='focus';render();}

function modalHtml(){
  let title='',body='';
  if(modal.type==='lesson'){const l=lesson(modal.id),c=cls(l.classId);title=`${c?.subject||''} ${c?.name||''} · ${l.title||'Stunde'}`;body=lessonPanel(l);}
  if(modal.type==='material'){const m=mat(modal.id);title=m.title;body=materialPanel(m);}
  if(modal.type==='new-material'){title='Neues Material';body=newMaterialPanel();}
  if(modal.type==='brief'){title='ChatGPT-Brief erstellen';body=briefPicker();}
  if(modal.type==='sequence'){const q=seq(modal.id);title=q?.title||'Sequenz';body=sequencePanel(q);}
  if(modal.type==='new-sequence'){title='Neue Sequenz';body=newSequencePanel();}
  if(modal.type==='ai-import'){const l=lesson(modal.id),c=cls(l?.classId);title=`ChatGPT → ${c?.subject||''} ${c?.name||''}`;body=aiImportPanel(l,modal.parsed||null,modal.raw||'');}
  if(modal.type==='setup-import'){title='Vorhandene Planung importieren';body=setupImportPanel(modal.parsed||null,modal.raw||'');}
  return `<div class="modal-backdrop" data-action="modal-close"><section class="modal ${(modal.type==='ai-import'||modal.type==='setup-import')?'modal-wide':''}" data-modal-stop><header class="modal-header"><div><span class="eyebrow">SCHULCOCKPIT</span><h2>${esc(title)}</h2></div><button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">${body}</div></section></div>`;
}

function wireV06(){
  wireBase();
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;modal=null;render();});
  document.querySelectorAll('[data-action="setup-import"]').forEach(b=>b.onclick=()=>{modal={type:'setup-import',raw:'',parsed:null};render();});
  document.querySelector('[data-action="prev-week"]')?.addEventListener('click',()=>shiftActiveWeek(-1));
  document.querySelector('[data-action="next-week"]')?.addEventListener('click',()=>shiftActiveWeek(1));
  document.querySelector('[data-action="planning-week"]')?.addEventListener('click',()=>{state.settings.activeWeekStart=defaultPlanningWeekStart();saveState();render();});
  document.querySelectorAll('[data-action="rebuild-week"]').forEach(b=>b.onclick=()=>{if(confirm(`KW ${activeWeekNumber()} wirklich neu aus dem Stundenplan aufbauen? Vorhandene Planungen passender Stunden bleiben erhalten; veraltete ungehaltene Einträge werden entfernt.`))rebuildActiveWeek(true);});
  document.querySelectorAll('[data-tt-cell]').forEach(s=>s.onchange=()=>{const [day,slot]=s.dataset.ttCell.split('|').map(Number);setTimetableCell(day,slot,s.value);});
  document.querySelectorAll('[data-period-label]').forEach(i=>i.onchange=()=>updatePeriodLabel(Number(i.dataset.periodLabel),i.value.trim()));
  document.querySelector('[data-action="add-period"]')?.addEventListener('click',addPeriod);
  document.querySelectorAll('[data-remove-period]').forEach(b=>b.onclick=()=>removePeriod(Number(b.dataset.removePeriod)));
  document.querySelector('[data-action="parse-setup-import"]')?.addEventListener('click',()=>{const raw=document.getElementById('setup-import-text')?.value||'';try{modal={type:'setup-import',raw,parsed:parseSetupImport(raw)};render();}catch(err){alert(err.message||'Setup konnte nicht gelesen werden.');}});
  document.querySelector('#setup-import-file')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;const raw=await f.text();try{modal={type:'setup-import',raw,parsed:parseSetupImport(raw)};render();}catch(err){modal={type:'setup-import',raw,parsed:null};render();alert(err.message||'Setup-Datei konnte nicht gelesen werden.');}});
  document.querySelector('[data-action="apply-setup-import"]')?.addEventListener('click',()=>{if(!modal?.parsed)return;applySetupPackage(modal.parsed,{classes:!!document.getElementById('setup-classes')?.checked,timetable:!!document.getElementById('setup-timetable')?.checked,sequences:!!document.getElementById('setup-sequences')?.checked,lessons:!!document.getElementById('setup-lessons')?.checked});modal=null;view='timetable';render();});
  document.querySelector('[data-action="clear-planning-data"]')?.addEventListener('click',()=>{if(confirm('Wirklich alle Klassen, Stundenpläne, Sequenzen, Stunden und Material-Metadaten leeren? Lokale hochgeladene Dateien bleiben technisch im Browser, sind danach aber nicht mehr verknüpft.'))clearPlanningData();});

  document.querySelectorAll('[data-sequence]').forEach(b=>b.onclick=()=>{modal={type:'sequence',id:b.dataset.sequence};render();});
  document.querySelector('[data-action="new-sequence"]')?.addEventListener('click',()=>{modal={type:'new-sequence',classId:''};render();});
  document.querySelectorAll('[data-action="new-sequence-for-lesson"]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.id);modal={type:'new-sequence',classId:l.classId,returnLessonId:l.id};render();});
  if(modal?.type==='new-sequence'){const holder=document.querySelector('.modal-body');if(holder&&modal.classId){const sel=holder.querySelector('#ns-class');if(sel)sel.value=modal.classId;}}
  document.querySelector('[data-action="create-sequence"]')?.addEventListener('click',()=>{const classId=document.getElementById('ns-class').value,title=document.getElementById('ns-title').value.trim();if(!title)return alert('Bitte einen Titel für die Sequenz eintragen.');const q={id:uid('seq'),classId,title,startDate:document.getElementById('ns-start').value,endDate:document.getElementById('ns-end').value,goal:document.getElementById('ns-goal').value.trim(),assessmentDate:document.getElementById('ns-assessment').value,notes:''};state.sequences.push(q);if(modal?.returnLessonId){const l=lesson(modal.returnLessonId);l.sequenceId=q.id;l.unit=q.title;}saveState();modal={type:'sequence',id:q.id};render();});
  document.querySelectorAll('[data-sequence-field]').forEach(i=>i.onchange=()=>{const [qid,key]=i.dataset.sequenceField.split('|'),q=seq(qid);q[key]=i.value;if(key==='title')state.lessons.filter(l=>l.sequenceId===qid).forEach(l=>l.unit=i.value);saveState();modal={type:'sequence',id:qid};render();});
  document.querySelectorAll('[data-sequence-select]').forEach(s=>s.onchange=()=>{const l=lesson(s.dataset.sequenceSelect);l.sequenceId=s.value;const q=seq(s.value);l.unit=q?.title||'';saveState();modal={type:'lesson',id:l.id};render();});
  document.querySelectorAll('[data-add-phase]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.addPhase);l.phasePlan=l.phasePlan||[];l.phasePlan.push({id:uid('phase'),phase:l.phasePlan.length?'Erarbeitung':'Einstieg',minutes:'',title:'',details:'',done:false});syncLegacyPlan(l);saveState();modal={type:'lesson',id:l.id};render();});
  document.querySelectorAll('[data-phase-field]').forEach(i=>i.onchange=()=>{const [lid,pid,key]=i.dataset.phaseField.split('|'),l=lesson(lid),p=(l.phasePlan||[]).find(x=>x.id===pid);if(!p)return;p[key]=i.value;syncLegacyPlan(l);saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-phase-done]').forEach(i=>i.onchange=()=>{const [lid,pid]=i.dataset.phaseDone.split('|'),l=lesson(lid),p=(l.phasePlan||[]).find(x=>x.id===pid);if(!p)return;p.done=i.checked;syncLegacyPlan(l);saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-delete-phase]').forEach(b=>b.onclick=()=>{const [lid,pid]=b.dataset.deletePhase.split('|'),l=lesson(lid);l.phasePlan=(l.phasePlan||[]).filter(x=>x.id!==pid);syncLegacyPlan(l);saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-action="carry-over"]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.id),prev=previousLesson(l);if(!prev)return;const open=(prev.phasePlan||[]).filter(p=>!p.done&&p.title);l.phasePlan=l.phasePlan||[];open.forEach(p=>{if(!l.phasePlan.some(x=>x.title===p.title))l.phasePlan.push({id:uid('phase'),phase:p.phase||'Erarbeitung',minutes:p.minutes||'',title:p.title,details:[p.details,'aus letzter Stunde übernommen'].filter(Boolean).join(' · '),done:false});});syncLegacyPlan(l);saveState();modal={type:'lesson',id:l.id};render();});
  document.querySelectorAll('[data-action="copy-brief"]').forEach(b=>b.onclick=async()=>{const text=makeBrief(lesson(b.dataset.id));try{await navigator.clipboard.writeText(text);const old=b.textContent;b.textContent='Kopiert ✓';setTimeout(()=>{b.textContent=old},1200);}catch{downloadText('ChatGPT-Brief.md',text);}});
  document.querySelectorAll('[data-action="open-ai-import"]').forEach(b=>b.onclick=()=>{modal={type:'ai-import',id:b.dataset.id,raw:'',parsed:null};render();});
  document.querySelector('[data-action="parse-ai-import"]')?.addEventListener('click',e=>{const raw=document.getElementById('ai-import-text')?.value||'';try{modal={type:'ai-import',id:e.currentTarget.dataset.id,raw,parsed:parseAiImport(raw)};render();}catch(err){alert(err.message||'Import konnte nicht gelesen werden.');}});
  document.querySelector('#ai-import-file')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;const raw=await f.text();try{modal={type:'ai-import',id:modal.id,raw,parsed:parseAiImport(raw)};render();}catch(err){modal={type:'ai-import',id:modal.id,raw,parsed:null};render();alert(err.message||'Datei konnte nicht gelesen werden.');}});
  document.querySelector('[data-action="apply-ai-import"]')?.addEventListener('click',e=>{if(!modal?.parsed)return;const l=lesson(e.currentTarget.dataset.id),opts={lesson:!!document.getElementById('imp-lesson')?.checked,phases:!!document.getElementById('imp-phases')?.checked,slides:!!document.getElementById('imp-slides')?.checked,materials:!!document.getElementById('imp-materials')?.checked,prep:!!document.getElementById('imp-prep')?.checked,status:!!document.getElementById('imp-status')?.checked};applyAiPackage(l,modal.parsed,opts);saveState();modal={type:'lesson',id:l.id};render();});
  document.querySelectorAll('[data-prep-done]').forEach(x=>x.onchange=()=>{const [lid,tid]=x.dataset.prepDone.split('|'),l=lesson(lid),t=(l.prepTasks||[]).find(t=>t.id===tid);if(t)t.done=x.checked;saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-delete-prep]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const [lid,tid]=b.dataset.deletePrep.split('|'),l=lesson(lid);l.prepTasks=(l.prepTasks||[]).filter(t=>t.id!==tid);saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-delete-slide]').forEach(b=>b.onclick=()=>{const [lid,sid]=b.dataset.deleteSlide.split('|'),l=lesson(lid);l.slides=(l.slides||[]).filter(sl=>sl.id!==sid);saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('.linked-lessons [data-lesson]').forEach(b=>b.onclick=()=>{modal={type:'lesson',id:b.dataset.lesson};render();});
}


/* V0.7 – geführtes Setup & sichere Datenübernahme */
function setupChecks(){
  const week=currentWeekLessons();
  const checks=[
    {key:'classes',label:'Klassen & Kurse',done:state.classes.length>0,detail:state.classes.length?`${state.classes.length} Lerngruppe${state.classes.length===1?'':'n'} hinterlegt`:'Noch keine Lerngruppen hinterlegt',view:'timetable'},
    {key:'timetable',label:'Stundenplan',done:state.timetable.length>0,detail:state.timetable.length?`${state.timetable.length} Wochenstunde${state.timetable.length===1?'':'n'} im Raster`:'Noch kein Wochenrhythmus hinterlegt',view:'timetable'},
    {key:'sequences',label:'Unterrichtsreihen',done:state.sequences.length>0,detail:state.sequences.length?`${state.sequences.length} Sequenz${state.sequences.length===1?'':'en'} übernommen`:'Kann später aus deinen vorhandenen Planungen importiert werden',view:'sequences'},
    {key:'week',label:'Planungswoche',done:week.length>0,detail:week.length?`${week.length} Stunde${week.length===1?'':'n'} für KW ${activeWeekNumber()} angelegt`:'Wird erst aus deinem echten Stundenplan erzeugt',action:'rebuild-week'}
  ];
  return checks;
}
function setupIssues(){
  const issues=[];
  const seen=new Map();
  state.timetable.forEach(t=>{const k=`${t.weekday}|${t.slot}`;if(seen.has(k))issues.push(`Stundenplan-Konflikt: ${dayNames[t.weekday]}, ${periodLabelForState(state,t.slot)}`);else seen.set(k,t.id);if(!cls(t.classId))issues.push('Eine Stundenplan-Zelle verweist auf eine nicht mehr vorhandene Klasse.');});
  state.lessons.forEach(l=>{if(!cls(l.classId))issues.push(`Stunde am ${fmtDate(l.date)} hat keine gültige Klasse.`);});
  return [...new Set(issues)];
}
function migrationRequestText(){
  return `Ich möchte meine vorhandenen Daten aus „Mein Schulplan“ in mein Schulcockpit übernehmen. Ich lade dir gleich die exportierten Dateien/Screenshots hoch.\n\nBitte extrahiere nur Informationen, die in den Dateien eindeutig belegt sind. Nichts ergänzen oder erraten. Erstelle danach einen SCHULCOCKPIT_SETUP-Block für den Import mit:\n- Schuljahr\n- Klassen/Kurse mit Fach und Schülerzahl, soweit vorhanden\n- Stundenplan mit Wochentag und Block\n- vorhandenen Unterrichtsreihen/Sequenzen\n- bereits geplanten bzw. dokumentierten Einzelstunden, soweit eindeutig zuordenbar\n\nWenn etwas unklar ist, lasse das Feld leer bzw. führe es vor dem Datenblock als „unklar“ auf. Keine Demo-Inhalte erzeugen.`;
}
function setupView(){
  const checks=setupChecks(),done=checks.filter(x=>x.done).length,issues=setupIssues();
  const pct=Math.round(done/checks.length*100);
  return `<div class="content-grid"><section class="setup-hero"><div><span class="eyebrow">EINMAL SAUBER EINRICHTEN</span><h2>Erst echte Daten. Dann Automatisierung.</h2><p>Das Schulcockpit füllt ab jetzt keine Unterrichtsinhalte selbst vor. Alles hier stammt entweder von dir, aus deinem Stundenplan oder aus einem bestätigten Import.</p></div><div class="setup-progress"><strong>${pct}%</strong><span>${done}/${checks.length} Grundschritte</span><div class="progress-track"><i style="width:${pct}%"></i></div></div></section><section class="setup-steps">${checks.map((x,i)=>`<article class="setup-step ${x.done?'done':''}"><div class="setup-step-no">${x.done?'✓':i+1}</div><div><span class="eyebrow">${x.done?'ERLEDIGT':'OFFEN'}</span><h3>${esc(x.label)}</h3><p>${esc(x.detail)}</p></div><button class="${x.done?'secondary':'primary'}" ${x.view?`data-view="${x.view}"`:`data-action="${x.action}"`}>${x.done?'Ansehen':'Einrichten'} →</button></article>`).join('')}</section><section class="panel migration-panel"><div class="section-head"><div><span class="eyebrow">VORHANDENES ÜBERNEHMEN</span><h2>Du musst „Mein Schulplan“ nicht neu abtippen.</h2></div><span class="safe-chip">keine KI in der App nötig</span></div><div class="migration-grid"><article><div class="migration-icon">1</div><h3>Aus „Mein Schulplan“ exportieren</h3><p>Für den Kalender kannst du dort den Wochen-/Tagesplan herunterladen; vorhandene Stoff-/Sequenzpläne lassen sich ebenfalls exportieren. Word oder PDF reicht für die Übernahme über ChatGPT.</p><ol><li>Wochenplan bzw. relevante Wochen exportieren</li><li>Stoff-/Sequenzpläne der Fächer exportieren</li><li>Dateien hier im Chat hochladen</li></ol></article><article><div class="migration-icon">2</div><h3>ChatGPT nur extrahieren lassen</h3><p>Ich soll dabei ausdrücklich nichts ergänzen. Der fertige Setup-Block enthält nur Daten, die in deinen Unterlagen wirklich stehen.</p><button class="secondary" data-action="copy-migration-request">Anfrage kopieren</button></article><article><div class="migration-icon">3</div><h3>Einmal ins Cockpit importieren</h3><p>Der Setup-Import zeigt zuerst eine Vorschau. Du entscheidest danach selbst, ob Klassen, Stundenplan, Reihen und konkrete Stunden übernommen werden.</p><button class="primary" data-action="setup-import">Setup-Block importieren</button></article></div></section>${issues.length?`<section class="panel warning-panel"><div class="section-head"><div><span class="eyebrow">DATENPRÜFUNG</span><h2>${issues.length} Unstimmigkeit${issues.length===1?'':'en'} gefunden</h2></div></div><ul>${issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`:`<section class="tip-card"><strong>Keine widersprüchlichen Daten gefunden.</strong><p>Fehlende Angaben werden nicht automatisch erfunden. Du kannst die Einrichtung deshalb Stück für Stück vervollständigen.</p></section>`}</div>`;
}
function pageTitle(){ return ({setup:'Einrichten & übernehmen',focus:'Was mache ich als Nächstes?',week:'Meine Woche',timetable:'Stundenplan & Klassen',sequences:'Sequenzen & Jahr',print:'Kopierzentrum',materials:'Materialbibliothek',improve:'Unterricht verbessern'})[view]||'Schulcockpit'; }
function viewHtml(){ return view==='setup'?setupView():view==='focus'?focusView():view==='week'?weekView():view==='timetable'?timetableView():view==='sequences'?sequencesView():view==='print'?printView():view==='materials'?materialsView():improveView(); }
function render(){
  const app=document.getElementById('app'),weekNo=activeWeekNumber();
  app.innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">SC</div><div><strong>Schulcockpit</strong><small>${esc(state.settings.schoolYear)} · V0.7</small></div></div><nav>${navBtn('setup','◎','Einrichten')}${navBtn('focus','✦','Was jetzt?')}${navBtn('week','▦','Meine Woche')}${navBtn('sequences','≋','Sequenzen & Jahr')}${navBtn('timetable','⌗','Stundenplan & Klassen')}${navBtn('print','⎙','Kopierzentrum')}${navBtn('materials','▤','Materialbibliothek')}${navBtn('improve','↗','Unterricht verbessern')}</nav><div class="sidebar-footer"><button data-action="setup-import">Setup importieren</button><button data-action="brief-picker">ChatGPT-Brief</button><button data-action="backup">Backup</button></div></aside><main><header class="topbar"><div><span class="eyebrow">KW ${weekNo} · ${activeWeekLabel()}</span><h1>${pageTitle()}</h1></div><div class="top-actions"><div class="week-switcher"><button data-action="prev-week" title="Vorherige Woche">←</button><button data-action="planning-week" title="Zur aktuellen Planungswoche">KW ${weekNo}</button><button data-action="next-week" title="Nächste Woche">→</button></div><span class="storage-pill">Dateien: ${storedFileKeys.size} lokal</span><button class="primary" data-action="rebuild-week">Woche aufbauen</button></div></header><div class="page">${viewHtml()}</div></main></div>${modal?modalHtml():''}`;
  wire();
}
function wire(){
  wireV06();
  document.querySelectorAll('[data-action="copy-migration-request"]').forEach(b=>b.onclick=async()=>{const t=migrationRequestText();try{await navigator.clipboard.writeText(t);const old=b.textContent;b.textContent='Kopiert ✓';setTimeout(()=>b.textContent=old,1400);}catch{downloadText('Schulcockpit_Import-Anfrage.txt',t);}});
}

/* V0.8 – geführter Wochenstart & echte Vorbereitungspipeline */
function lessonPlanReadyV08(l){
  return ['planned','needs-material','ready','done'].includes(l.status) || (l.phasePlan||[]).some(p=>String(p.title||'').trim());
}
function materialDecisionReadyV08(l){
  return !!l.materialsReviewed || (l.materials||[]).length>0 || ['ready','done'].includes(l.status);
}
function printNeedsV08(l){
  return (l.printPlan||[]).filter(p=>p.needed&&(Number(p.count)||0)>0);
}
function prepReadyV08(l){
  return !(l.prepTasks||[]).some(t=>!t.done&&t.title) && missingPrintFilesForLesson(l).length===0;
}
function copiesReadyV08(l){
  const needs=printNeedsV08(l);
  return !needs.length || needs.every(p=>p.alreadyPrinted);
}
function lessonReadyV08(l){ return ['ready','done'].includes(l.status); }
function sortedWeekV08(){ return currentWeekLessons().slice().sort((a,b)=>a.date.localeCompare(b.date)||lessonSlot(a)-lessonSlot(b)); }
function weekPrepMetricsV08(){
  const ls=sortedWeekV08(),n=ls.length||1;
  const planned=ls.filter(lessonPlanReadyV08).length;
  const material=ls.filter(l=>lessonPlanReadyV08(l)&&materialDecisionReadyV08(l)).length;
  const files=ls.filter(l=>lessonPlanReadyV08(l)&&materialDecisionReadyV08(l)&&prepReadyV08(l)).length;
  const copied=ls.filter(l=>lessonPlanReadyV08(l)&&materialDecisionReadyV08(l)&&prepReadyV08(l)&&copiesReadyV08(l)).length;
  const ready=ls.filter(lessonReadyV08).length;
  return {total:ls.length,planned,material,files,copied,ready,pct:ls.length?Math.round(((planned+material+files+copied+ready)/(ls.length*5))*100):0};
}
function workflowTasks(){
  const lessons=sortedWeekV08(),tasks=[];
  lessons.forEach(l=>{
    const c=cls(l.classId),who=`${c?.subject||''} ${c?.name||''}`.trim(),slot=lessonSlot(l);
    if(!lessonPlanReadyV08(l)){
      tasks.push({id:`plan-${l.id}`,stage:1,date:l.date,slot,type:'plan',lessonId:l.id,title:`${who}: Stunde planen`,detail:`${fmtDate(l.date)} · ${l.period||periodLabelForState(state,slot)}`,why:previousLesson(l)?'Der Stand der letzten Stunde ist hinterlegt. Plane jetzt nur den nächsten sinnvollen Schritt.':'Zuerst die Grobplanung klären, damit Material und Kopierbedarf feststehen.'});
      return;
    }
    if(!materialDecisionReadyV08(l)){
      tasks.push({id:`material-check-${l.id}`,stage:2,date:l.date,slot,type:'material-check',lessonId:l.id,title:`${who}: Materialbedarf klären`,detail:`${fmtDate(l.date)} · ${l.title||'Stunde'}`,why:'Entscheide einmal bewusst: vorhandenes Material verknüpfen oder „kein zusätzliches Material“ markieren.'});
    }
    const missing=missingPrintFilesForLesson(l);
    if(materialDecisionReadyV08(l)&&(l.status==='needs-material'||missing.length)){
      tasks.push({id:`material-${l.id}`,stage:2,date:l.date,slot,type:'material',lessonId:l.id,title:`${who}: Material fertigstellen`,detail:missing.length?`${missing.length} Druckdatei${missing.length===1?' fehlt':'en fehlen'} · ${l.period||''}`:`${fmtDate(l.date)} · ${l.title}`,why:'Vor dem Kopierlauf müssen die tatsächlich benötigten Dateien vorhanden sein.'});
    }
    (l.prepTasks||[]).filter(t=>!t.done&&t.title).forEach(t=>tasks.push({id:`prep-${l.id}-${t.id}`,stage:2,date:l.date,slot,type:'prep',lessonId:l.id,title:`${who}: ${t.title}`,detail:`${t.category||'Vorbereitung'} · ${fmtDate(l.date)} · ${l.period||''}`,why:t.note||'Diese Vorbereitung ist noch offen.'}));
  });
  const openPrint=openPrintItems().filter(i=>i.fileReady);
  if(openPrint.length)tasks.push({id:'print-week',stage:3,date:activeWeekDate(1),slot:99,type:'print',title:'Wochenkopien gesammelt erledigen',detail:`${openPrint.length} druckbereite Position${openPrint.length===1?'':'en'} · Farbe und S/W gesammelt`,why:'Jetzt lohnt sich der Gang zum Kopierer: Die benötigten Dateien sind bereits vorhanden.'});
  lessons.forEach(l=>{
    const c=cls(l.classId),slot=lessonSlot(l);
    if(lessonPlanReadyV08(l)&&materialDecisionReadyV08(l)&&prepReadyV08(l)&&copiesReadyV08(l)&&!lessonReadyV08(l)){
      tasks.push({id:`final-${l.id}`,stage:4,date:l.date,slot,type:'final',lessonId:l.id,title:`${c?.subject||''} ${c?.name||''}: als bereit markieren`,detail:`${fmtDate(l.date)} · ${l.period||''}`,why:'Planung, Material und Kopien sind erledigt. Ein letzter Check – dann ist die Stunde aus deinem Kopf.'});
    }
    if(l.status==='done'&&!(l.reflection&&Object.keys(l.reflection).length))tasks.push({id:`reflect-${l.id}`,stage:5,date:l.date,slot,type:'reflect',lessonId:l.id,title:`${c?.subject||''} ${c?.name||''}: kurz reflektieren`,detail:'10-Sekunden-Reflexion · Klicks reichen',why:'Damit die nächste Stunde auf dem tatsächlichen Stand aufbaut.'});
  });
  return tasks.sort((a,b)=>a.stage-b.stage||a.date.localeCompare(b.date)||(a.slot??99)-(b.slot??99));
}
function prepStageCardV08(num,title,done,total,desc,active){
  const complete=total>0&&done>=total;
  return `<article class="prep-stage-card ${complete?'complete':''} ${active?'active':''}"><div class="prep-stage-num">${complete?'✓':num}</div><div class="prep-stage-copy"><strong>${esc(title)}</strong><span>${done}/${total} erledigt</span><small>${esc(desc)}</small></div><div class="prep-stage-bar"><i style="width:${total?Math.round(done/total*100):0}%"></i></div></article>`;
}
function weekPrepViewV08(){
  const ls=sortedWeekV08(),m=weekPrepMetricsV08(),tasks=workflowTasks(),next=tasks.find(t=>t.stage<=4),firstOpenStage=next?.stage||5;
  if(!state.timetable.length)return `<div class="content-grid"><section class="focus-hero onboarding-hero"><div><span class="eyebrow">NOCH NICHT EINGERICHTET</span><h2>Erst dein echter Stundenplan.</h2><p>Danach kann der Wochenstart die Arbeit automatisch in die richtige Reihenfolge bringen.</p></div><button class="primary" data-view="setup">Einrichten →</button></section></div>`;
  if(!ls.length)return `<div class="content-grid"><section class="focus-hero"><div><span class="eyebrow">KW ${activeWeekNumber()}</span><h2>Die Woche ist noch nicht aufgebaut.</h2><p>Erzeuge sie einmal aus deinem Stundenplan. Danach führt dich das Cockpit Schritt für Schritt durch die Vorbereitung.</p></div><button class="primary big" data-action="rebuild-week">Woche aufbauen →</button></section></div>`;
  return `<div class="content-grid"><section class="weekly-prep-hero"><div><span class="eyebrow">WOCHENSTART · KW ${activeWeekNumber()}</span><h2>${next?'Du musst gerade nur eine Sache wissen.':'Die Woche ist abgesichert.'}</h2><p>${next?`Arbeite die Vorbereitung von links nach rechts ab. Das Cockpit springt automatisch zur nächsten sinnvollen Aufgabe.`:'Planung, Material und Kopierstatus sind für diese Woche geklärt.'}</p></div><div class="weekly-score"><strong>${m.pct}%</strong><span>vorbereitet</span></div></section>
  <section class="prep-stage-grid">${prepStageCardV08(1,'Grob planen',m.planned,m.total,'Thema, Ziel und Ablauf stehen.',firstOpenStage===1)}${prepStageCardV08(2,'Material klären',m.material,m.total,'Bewusst entscheiden, was wirklich gebraucht wird.',firstOpenStage===2)}${prepStageCardV08(3,'Dateien fertig',m.files,m.total,'Druckdateien und offene Vorbereitung sind vorhanden.',firstOpenStage===2&&m.material===m.total)}${prepStageCardV08(4,'Kopieren',m.copied,m.total,'Alles Nötige ist kopiert – oder es gibt bewusst nichts zu kopieren.',firstOpenStage===3)}${prepStageCardV08(5,'Abgesichert',m.ready,m.total,'Stunde kann aus dem Kopf.',firstOpenStage===4)}</section>
  ${next?`<section class="next-action-card"><div><span class="eyebrow">JETZT</span><h2>${esc(next.title)}</h2><p>${esc(next.why)}</p><span>${esc(next.detail)}</span></div><button class="primary big" data-task="${next.id}">Diese Aufgabe öffnen →</button></section>`:`<section class="next-action-card done"><div><span class="eyebrow">FERTIG</span><h2>Für die Vorbereitung ist nichts Akutes offen.</h2><p>Nach den Stunden reichen kurze Reflexionen; Verbesserungen können später in Ruhe in den Backlog.</p></div><div class="done-badge">✓</div></section>`}
  <section class="panel"><div class="section-head"><div><span class="eyebrow">DIE WOCHE AUF EINEN BLICK</span><h2>Jede Stunde hat ihre eigene Pipeline.</h2></div><span class="muted">${ls.length} Stunden</span></div><div class="prep-lesson-table">${ls.map(l=>prepLessonRowV08(l)).join('')}</div></section></div>`;
}
function prepLessonRowV08(l){
  const c=cls(l.classId),needs=printNeedsV08(l),printed=copiesReadyV08(l),plan=lessonPlanReadyV08(l),material=materialDecisionReadyV08(l),files=prepReadyV08(l),ready=lessonReadyV08(l);
  const chip=(ok,label,cls2='')=>`<span class="pipeline-chip ${ok?'ok':'open'} ${cls2}">${ok?'✓':'○'} ${label}</span>`;
  return `<div class="prep-lesson-row"><button class="prep-lesson-main" data-lesson="${l.id}"><span class="prep-date">${esc(fmtDate(l.date))}<small>${esc(l.period||periodLabelForState(state,lessonSlot(l)))}</small></span><span><strong>${esc(c?.subject||'')} ${esc(c?.name||'')}</strong><small>${esc(l.title||'Thema noch festlegen')}</small></span></button><div class="pipeline-chips">${chip(plan,'Plan')}${chip(material,'Material')}${chip(files,'Dateien')}${chip(printed,needs.length?'Kopiert':'kein Druck')}${chip(ready,'Bereit')}</div>${plan&&!material?`<button class="secondary small-action" data-no-material="${l.id}">Kein Extra-Material</button>`:''}${plan&&material&&files&&printed&&!ready?`<button class="primary small-action" data-mark-ready="${l.id}">Bereit ✓</button>`:''}</div>`;
}
function pageTitle(){ return ({setup:'Einrichten & übernehmen',prep:'Wochenstart',focus:'Was mache ich als Nächstes?',week:'Meine Woche',timetable:'Stundenplan & Klassen',sequences:'Sequenzen & Jahr',print:'Kopierzentrum',materials:'Materialbibliothek',improve:'Unterricht verbessern'})[view]||'Schulcockpit'; }
function viewHtml(){ return view==='setup'?setupView():view==='prep'?weekPrepViewV08():view==='focus'?focusView():view==='week'?weekView():view==='timetable'?timetableView():view==='sequences'?sequencesView():view==='print'?printView():view==='materials'?materialsView():improveView(); }
function render(){
  const app=document.getElementById('app'),weekNo=activeWeekNumber();
  app.innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">SC</div><div><strong>Schulcockpit</strong><small>${esc(state.settings.schoolYear)} · V0.8</small></div></div><nav>${navBtn('setup','◎','Einrichten')}${navBtn('prep','↠','Wochenstart')}${navBtn('focus','✦','Was jetzt?')}${navBtn('week','▦','Meine Woche')}${navBtn('sequences','≋','Sequenzen & Jahr')}${navBtn('timetable','⌗','Stundenplan & Klassen')}${navBtn('print','⎙','Kopierzentrum')}${navBtn('materials','▤','Materialbibliothek')}${navBtn('improve','↗','Unterricht verbessern')}</nav><div class="sidebar-footer"><button data-action="setup-import">Setup importieren</button><button data-action="brief-picker">ChatGPT-Brief</button><button data-action="backup">Backup</button></div></aside><main><header class="topbar"><div><span class="eyebrow">KW ${weekNo} · ${activeWeekLabel()}</span><h1>${pageTitle()}</h1></div><div class="top-actions"><div class="week-switcher"><button data-action="prev-week" title="Vorherige Woche">←</button><button data-action="planning-week" title="Zur aktuellen Planungswoche">KW ${weekNo}</button><button data-action="next-week" title="Nächste Woche">→</button></div><span class="storage-pill">Dateien: ${storedFileKeys.size} lokal</span><button class="primary" data-action="rebuild-week">Woche aufbauen</button></div></header><div class="page">${viewHtml()}</div></main></div>${modal?modalHtml():''}`;
  wire();
}
function wire(){
  wireV06();
  document.querySelectorAll('[data-action="copy-migration-request"]').forEach(b=>b.onclick=async()=>{const t=migrationRequestText();try{await navigator.clipboard.writeText(t);const old=b.textContent;b.textContent='Kopiert ✓';setTimeout(()=>b.textContent=old,1400);}catch{downloadText('Schulcockpit_Import-Anfrage.txt',t);}});
  document.querySelectorAll('[data-no-material]').forEach(b=>b.onclick=e=>{e.stopPropagation();const l=lesson(b.dataset.noMaterial);if(!l)return;l.materialsReviewed=true;if(l.status==='open')l.status='planned';saveState();render();});
  document.querySelectorAll('[data-mark-ready]').forEach(b=>b.onclick=e=>{e.stopPropagation();const l=lesson(b.dataset.markReady);if(!l)return;l.materialsReviewed=true;l.status='ready';saveState();render();});
}


/* V0.9 – Aufgaben, Orga & Zeitfenster */
let timeWindowV09=30;
const taskCategoriesV09=['Korrektur','Tutorat','Eltern / Kommunikation','Klassenarbeit / Leistung','Organisation','Weiterbildung','Unterrichtsentwicklung','Sonstiges'];
function todayIsoV09(){ return iso(new Date()); }
function dayDiffV09(dateStr){ if(!dateStr)return 999; const a=new Date(todayIsoV09()+'T12:00:00'),b=new Date(dateStr+'T12:00:00'); return Math.round((b-a)/86400000); }
function generalTaskPriorityV09(t){
  const d=dayDiffV09(t.dueDate); let score=500;
  if(d<0)score=-1100+d*10; else if(d===0)score=-1000; else if(d===1)score=-820; else if(d<=3)score=-600+d*20; else if(d<=7)score=-250+d*10;
  if(t.priority==='high')score-=140; if(t.priority==='low')score+=120;
  return score;
}
function lessonTaskEffortV09(t){ return ({plan:45,'material-check':10,material:30,prep:20,print:30,final:10,reflect:5})[t.type]||20; }
function lessonTaskPriorityV09(t){
  const d=dayDiffV09(t.date); let score=(Math.max(d,-2))*130+(t.stage||5)*15;
  if(d<=0&&t.stage<=4)score-=650; else if(d===1)score-=500; else if(d===2)score-=280;
  if(t.type==='print')score-=120;
  return score;
}
function generalTasksV09(){
  return (state.tasks||[]).filter(t=>!t.done&&t.title).map(t=>({
    id:`general-${t.id}`,source:'general',generalId:t.id,type:'general',title:t.title,
    detail:[t.category,t.dueDate?`fällig ${fmtDate(t.dueDate)}`:'ohne feste Deadline',`${t.effort} Min.`].join(' · '),
    why:t.notes||((dayDiffV09(t.dueDate)<0)?'Diese Aufgabe ist überfällig.':(dayDiffV09(t.dueDate)<=1?'Diese Aufgabe hat eine sehr nahe Deadline.':'Allgemeine Schulaufgabe außerhalb der Unterrichtsvorbereitung.')),
    estimate:Number(t.effort)||15,sortScore:generalTaskPriorityV09(t),date:t.dueDate||'9999-12-31'
  })).sort((a,b)=>a.sortScore-b.sortScore||a.title.localeCompare(b.title));
}
function unifiedTasksV09(){
  const lessonTasks=workflowTasks().map(t=>({...t,source:'lesson',estimate:lessonTaskEffortV09(t),sortScore:lessonTaskPriorityV09(t)}));
  return [...lessonTasks,...generalTasksV09()].sort((a,b)=>a.sortScore-b.sortScore||String(a.date||'').localeCompare(String(b.date||'')));
}
function dueBadgeV09(t){
  if(!t.dueDate)return '<span class="task-due neutral">ohne Deadline</span>';
  const d=dayDiffV09(t.dueDate); if(d<0)return `<span class="task-due overdue">${Math.abs(d)} Tg. überfällig</span>`; if(d===0)return '<span class="task-due urgent">heute</span>'; if(d===1)return '<span class="task-due soon">morgen</span>'; return `<span class="task-due">${esc(fmtDate(t.dueDate))}</span>`;
}
function tasksViewV09(){
  const open=(state.tasks||[]).filter(t=>!t.done),done=(state.tasks||[]).filter(t=>t.done).slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,8);
  const fit=unifiedTasksV09().filter(t=>(t.estimate||999)<=timeWindowV09).slice(0,8);
  return `<div class="content-grid"><section class="taskhub-hero"><div><span class="eyebrow">ALLES AUSSER UNTERRICHT</span><h2>Auch unsichtbare Arbeit ist echte Arbeit.</h2><p>Korrekturen, Elternkommunikation, Tutorat, Klassenarbeiten, Organisation und Weiterbildung landen hier und fließen in „Was jetzt?“ ein.</p></div><button class="primary" data-action="focus-new-task">+ Aufgabe erfassen</button></section>
  <section class="panel"><div class="section-head"><div><span class="eyebrow">SCHNELL ERFASSEN</span><h2>Was musst du noch erledigen?</h2></div></div><div class="task-add-grid"><label class="full">Aufgabe<input id="task-title" placeholder="z. B. Elternmail wegen Ausflug beantworten"></label><label>Kategorie<select id="task-category">${taskCategoriesV09.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><label>Deadline<input id="task-due" type="date"></label><label>Dauer<select id="task-effort">${[5,10,15,20,30,45,60,90,120].map(n=>`<option value="${n}" ${n===15?'selected':''}>ca. ${n} Min.</option>`).join('')}</select></label><label>Priorität<select id="task-priority"><option value="normal">normal</option><option value="high">hoch</option><option value="low">kann warten</option></select></label><label>Klasse / Kurs<select id="task-class"><option value="">— allgemein —</option>${state.classes.map(c=>`<option value="${c.id}">${esc(c.subject)} ${esc(c.name)}</option>`).join('')}</select></label><label class="full">Notiz <span class="muted">optional</span><input id="task-notes" placeholder="Nur falls du später noch Kontext brauchst"></label><button class="primary full-button" data-action="add-general-task">Aufgabe hinzufügen</button></div></section>
  <section class="panel"><div class="section-head"><div><span class="eyebrow">ICH HABE GERADE ZEIT</span><h2>Was passt in mein Zeitfenster?</h2></div><div class="time-pills">${[10,30,60].map(n=>`<button class="${timeWindowV09===n?'active':''}" data-time-window="${n}">${n} Min.</button>`).join('')}</div></div><div class="time-task-list">${fit.length?fit.map((t,i)=>unifiedTaskCardV09(t,i,true)).join(''):'<div class="empty-state">Für dieses Zeitfenster ist gerade nichts Passendes offen.</div>'}</div></section>
  <section class="panel"><div class="section-head"><div><span class="eyebrow">OFFEN</span><h2>${open.length} Aufgabe${open.length===1?'':'n'} außerhalb des Unterrichts</h2></div></div><div class="general-task-list">${open.slice().sort((a,b)=>generalTaskPriorityV09(a)-generalTaskPriorityV09(b)).map(t=>generalTaskRowV09(t)).join('')||'<div class="empty-state">Keine zusätzlichen Aufgaben offen.</div>'}</div></section>
  ${done.length?`<section class="panel compact-panel"><div class="section-head"><div><span class="eyebrow">ERLEDIGT</span><h2>Zuletzt abgeschlossen</h2></div></div><div class="done-task-list">${done.map(t=>`<div class="done-task"><span>✓</span><div><strong>${esc(t.title)}</strong><small>${esc(t.category)}</small></div><button class="text-button" data-reopen-task="${t.id}">wieder öffnen</button></div>`).join('')}</div></section>`:''}</div>`;
}
function generalTaskRowV09(t){ const c=t.classId?cls(t.classId):null; return `<article class="general-task-row"><button class="task-check" data-complete-general="${t.id}" title="Erledigen">○</button><div class="general-task-copy"><div class="task-row-top"><strong>${esc(t.title)}</strong>${dueBadgeV09(t)}</div><span>${esc(t.category)} · ca. ${t.effort} Min.${c?` · ${esc(c.subject)} ${esc(c.name)}`:''}${t.priority==='high'?' · hohe Priorität':''}</span>${t.notes?`<small>${esc(t.notes)}</small>`:''}</div><button class="danger-lite" data-delete-general="${t.id}" title="Löschen">×</button></article>`; }
function unifiedTaskCardV09(t,i,compact=false){
  if(t.source==='general')return `<div class="task-card unified-general"><span class="task-number">${i+1}</span><span class="task-main"><small>${esc(t.detail)}</small><strong>${esc(t.title)}</strong><span>${esc(t.why)}</span></span><span class="task-estimate">~${t.estimate}m</span><button class="task-check inline" data-complete-general="${t.generalId}" title="Erledigen">✓</button></div>`;
  return `<button class="task-card" data-task="${t.id}"><span class="task-number">${i+1}</span><span class="task-main"><small>Unterricht · ~${t.estimate} Min.</small><strong>${esc(t.title)}</strong><span>${esc(t.detail)}</span></span><span class="task-arrow">→</span></button>`;
}
function focusView(){
  const tasks=unifiedTasksV09(),next=tasks[0],noTimetable=!state.timetable.length,noWeek=!currentWeekLessons().length;
  if(noTimetable)return `<div class="content-grid"><section class="focus-hero onboarding-hero"><div><span class="eyebrow">ERST EINMAL DEINE ECHTEN DATEN</span><h2>Das Cockpit startet ohne erfundene Stunden.</h2><p>Importiere deine vorhandenen Daten oder trage deinen Stundenplan einmal im Wochenraster ein.</p></div><div class="hero-actions"><button class="secondary" data-action="setup-import">Vorhandenes importieren</button><button class="primary" data-view="timetable">Stundenplan öffnen →</button></div></section>${setupHelpCard()}</div>`;
  if(noWeek)return `<div class="content-grid"><section class="focus-hero"><div><span class="eyebrow">STUNDENPLAN IST DA</span><h2>Baue jetzt KW ${activeWeekNumber()} aus deinem Stundenplan auf.</h2><p>Danach fließen Unterricht und sonstige Schulaufgaben gemeinsam in deine Prioritäten.</p></div><button class="primary big" data-action="rebuild-week">Woche aufbauen →</button></section></div>`;
  return `<div class="content-grid"><section class="focus-hero ${!next?'all-done':''}"><div>${next?`<span class="eyebrow">DEIN NÄCHSTER SCHRITT</span><h2>${esc(next.title)}</h2><p>${esc(next.why)}</p><span class="next-meta">${esc(next.detail)} · ca. ${next.estimate||'?'} Min.</span>`:`<span class="eyebrow">NICHTS AKUTES</span><h2>Die wichtige Arbeit ist gerade abgesichert.</h2><p>Du kannst jetzt bewusst aufhören oder ein kleines Zeitfenster für Verbesserungen nutzen.</p>`}</div>${next?(next.source==='general'?`<button class="primary big" data-complete-general="${next.generalId}">Als erledigt abhaken ✓</button>`:`<button class="primary big" data-task="${next.id}">Jetzt erledigen →</button>`):'<div class="done-badge">✓</div>'}</section><section class="focus-shortcuts"><button data-view="prep"><strong>Wochenvorbereitung</strong><span>Unterricht Schritt für Schritt →</span></button><button data-view="tasks"><strong>10 / 30 / 60 Minuten frei?</strong><span>Passende Aufgabe finden →</span></button></section><section class="panel"><div class="section-head"><div><span class="eyebrow">GESAMTE PRIORITÄTSLISTE</span><h2>Unterricht + Orga in einer Reihenfolge.</h2></div><span class="muted">${tasks.length} offen</span></div><div class="task-queue">${tasks.slice(0,14).map((t,i)=>unifiedTaskCardV09(t,i)).join('')||'<div class="empty-state">Alles erledigt. ✦</div>'}</div></section></div>`;
}
function pageTitle(){ return ({setup:'Einrichten & übernehmen',prep:'Wochenstart',focus:'Was mache ich als Nächstes?',tasks:'Aufgaben & Orga',week:'Meine Woche',timetable:'Stundenplan & Klassen',sequences:'Sequenzen & Jahr',print:'Kopierzentrum',materials:'Materialbibliothek',improve:'Unterricht verbessern'})[view]||'Schulcockpit'; }
function viewHtml(){ return view==='setup'?setupView():view==='prep'?weekPrepViewV08():view==='focus'?focusView():view==='tasks'?tasksViewV09():view==='week'?weekView():view==='timetable'?timetableView():view==='sequences'?sequencesView():view==='print'?printView():view==='materials'?materialsView():improveView(); }
function render(){
  const app=document.getElementById('app'),weekNo=activeWeekNumber();
  app.innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">SC</div><div><strong>Schulcockpit</strong><small>${esc(state.settings.schoolYear)} · V0.10</small></div></div><nav>${navBtn('setup','◎','Einrichten')}${navBtn('prep','↠','Wochenstart')}${navBtn('focus','✦','Was jetzt?')}${navBtn('tasks','✓','Aufgaben & Orga')}${navBtn('week','▦','Meine Woche')}${navBtn('sequences','≋','Sequenzen & Jahr')}${navBtn('timetable','⌗','Stundenplan & Klassen')}${navBtn('print','⎙','Kopierzentrum')}${navBtn('materials','▤','Materialbibliothek')}${navBtn('improve','↗','Unterricht verbessern')}</nav><div class="sidebar-footer"><button data-action="setup-import">Setup importieren</button><button data-action="brief-picker">ChatGPT-Brief</button><button data-action="backup">Backup</button></div></aside><main><header class="topbar"><div><span class="eyebrow">KW ${weekNo} · ${activeWeekLabel()}</span><h1>${pageTitle()}</h1></div><div class="top-actions"><div class="week-switcher"><button data-action="prev-week" title="Vorherige Woche">←</button><button data-action="planning-week" title="Zur aktuellen Planungswoche">KW ${weekNo}</button><button data-action="next-week" title="Nächste Woche">→</button></div><span class="storage-pill">Dateien: ${storedFileKeys.size} lokal</span><button class="primary" data-action="rebuild-week">Woche aufbauen</button></div></header><div class="page">${viewHtml()}</div></main></div>${modal?modalHtml():''}`;
  wire();
}
function wire(){
  wireV06();
  document.querySelectorAll('[data-action="copy-migration-request"]').forEach(b=>b.onclick=async()=>{const t=migrationRequestText();try{await navigator.clipboard.writeText(t);const old=b.textContent;b.textContent='Kopiert ✓';setTimeout(()=>b.textContent=old,1400);}catch{downloadText('Schulcockpit_Import-Anfrage.txt',t);}});
  document.querySelectorAll('[data-no-material]').forEach(b=>b.onclick=e=>{e.stopPropagation();const l=lesson(b.dataset.noMaterial);if(!l)return;l.materialsReviewed=true;if(l.status==='open')l.status='planned';saveState();render();});
  document.querySelectorAll('[data-mark-ready]').forEach(b=>b.onclick=e=>{e.stopPropagation();const l=lesson(b.dataset.markReady);if(!l)return;l.materialsReviewed=true;l.status='ready';saveState();render();});
  document.querySelectorAll('[data-time-window]').forEach(b=>b.onclick=()=>{timeWindowV09=Number(b.dataset.timeWindow);render();});
  document.querySelector('[data-action="focus-new-task"]')?.addEventListener('click',()=>{document.getElementById('task-title')?.focus();});
  document.querySelector('[data-action="add-general-task"]')?.addEventListener('click',()=>{const title=document.getElementById('task-title')?.value.trim();if(!title){alert('Gib der Aufgabe kurz einen Namen.');return;}state.tasks=state.tasks||[];state.tasks.push({id:uid('task'),title,category:document.getElementById('task-category')?.value||'Organisation',dueDate:document.getElementById('task-due')?.value||'',effort:Number(document.getElementById('task-effort')?.value)||15,priority:document.getElementById('task-priority')?.value||'normal',classId:document.getElementById('task-class')?.value||'',notes:document.getElementById('task-notes')?.value.trim()||'',done:false,createdAt:new Date().toISOString()});saveState();render();});
  document.querySelectorAll('[data-complete-general]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const t=(state.tasks||[]).find(x=>x.id===b.dataset.completeGeneral);if(t){t.done=true;t.completedAt=new Date().toISOString();saveState();render();}});
  document.querySelectorAll('[data-reopen-task]').forEach(b=>b.onclick=()=>{const t=(state.tasks||[]).find(x=>x.id===b.dataset.reopenTask);if(t){t.done=false;delete t.completedAt;saveState();render();}});
  document.querySelectorAll('[data-delete-general]').forEach(b=>b.onclick=()=>{if(!confirm('Aufgabe wirklich löschen?'))return;state.tasks=(state.tasks||[]).filter(t=>t.id!==b.dataset.deleteGeneral);saveState();render();});
}


/* V0.10 – importierte Reihenplanung aus „Mein Schulplan“ */
state.sequences=(state.sequences||[]).map(q=>({...q,plan:Array.isArray(q.plan)?q.plan:[]}));

function cleanPlanUnitV10(u={}){
  return {
    id:u.id||uid('unit'),
    plannedDate:cleanString(u.plannedDate||'',20),
    title:cleanString(u.title||'',500),
    hours:cleanString(u.hours||'',30),
    content:cleanString(u.content||'',12000),
    competencies:cleanString(u.competencies||'',4000),
    objective:cleanString(u.objective||'',4000),
    material:cleanString(u.material||'',5000),
    homework:cleanString(u.homework||'',3000),
    notes:cleanString(u.notes||'',3000)
  };
}
function parseSetupImportV10(raw){
  const text=String(raw||'').trim(); if(!text)throw new Error('Noch kein Setup eingefügt.');
  const markerMatch=text.match(/<SCHULCOCKPIT_SETUP>\s*([\s\S]*?)\s*<\/SCHULCOCKPIT_SETUP>/i);
  const fenced=[...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(m=>m[1].trim());
  const candidates=[markerMatch?.[1],...fenced,text].filter(Boolean);
  let x=null;
  for(const c of candidates){try{const p=JSON.parse(c);const r=p?.schulcockpitSetup||p;if(r&&(r.schema==='schulcockpit.setup.v1'||r.schema==='schulcockpit.setup.v2'||r.classes||r.sequences)){x=r;break;}}catch{}}
  if(!x)throw new Error('Kein lesbarer Schulcockpit-Setup-Block gefunden.');
  const classes=cleanArray(x.classes,80).map((c,i)=>{
    const n=Number(c.students);
    return {key:cleanString(c.key||`class${i+1}`,80),subject:cleanString(c.subject,120),name:cleanString(c.name||c.className,120),students:Number.isFinite(n)&&n>0?Math.min(60,n):null};
  }).filter(c=>c.subject&&c.name);
  return {
    schema:'schulcockpit.setup.v2',
    schoolYear:cleanString(x.schoolYear||'',30),
    periods:cleanArray(x.periods,12).map(v=>cleanString(v,60)).filter(Boolean),
    classes,
    timetable:cleanArray(x.timetable,120).map(t=>({weekday:Math.max(1,Math.min(5,Number(t.weekday)||1)),slot:Math.max(0,Math.min(20,Number(t.slot)||0)),classKey:cleanString(t.classKey,80)})).filter(t=>t.classKey),
    sequences:cleanArray(x.sequences,150).map(q=>({
      classKey:cleanString(q.classKey,80),
      title:cleanString(q.title,300),
      startDate:cleanString(q.startDate,20),
      endDate:cleanString(q.endDate,20),
      hours:cleanString(q.hours||'',30),
      goal:cleanString(q.goal,4000),
      assessmentDate:cleanString(q.assessmentDate,20),
      notes:cleanString(q.notes,4000),
      units:cleanArray(q.units||q.plan,300).map(cleanPlanUnitV10).filter(u=>u.title)
    })).filter(q=>q.classKey&&q.title),
    lessons:cleanArray(x.lessons,300).map(l=>({classKey:cleanString(l.classKey,80),date:cleanString(l.date,20),slot:Math.max(0,Math.min(20,Number(l.slot)||0)),title:cleanString(l.title,500),objective:cleanString(l.objective,1500),sequenceTitle:cleanString(l.sequenceTitle,300),status:['open','planned','needs-material','ready','done'].includes(l.status)?l.status:'open'})).filter(l=>l.classKey&&l.date)
  };
}
parseSetupImport=parseSetupImportV10;

function setupImportPanelV10(pkg,raw=''){
  const units=pkg?pkg.sequences.reduce((n,q)=>n+(q.units?.length||0),0):0;
  const cb=(id,label,count,checked=true)=>`<label class="${count?'':'disabled-option'}"><input type="checkbox" id="${id}" ${count&&checked?'checked':''} ${count?'':'disabled'}> ${label}${count?` <small>(${count})</small>`:' <small>(keine Daten im Import)</small>'}</label>`;
  const preview=pkg?`<section class="import-preview"><div class="section-head compact"><div><span class="eyebrow">VORSCHAU</span><h3>Gefundene Daten</h3></div><span class="import-ok">✓ lesbar</span></div><div class="import-stats"><div><strong>${pkg.classes.length}</strong><span>Klassen/Kurse</span></div><div><strong>${pkg.timetable.length}</strong><span>Wochenstunden</span></div><div><strong>${pkg.sequences.length}</strong><span>Sequenzen</span></div><div><strong>${units}</strong><span>geplante Reihenstunden</span></div></div><div class="import-note"><strong>Wichtig:</strong> Geplante Reihenstunden werden nicht als „bereits gehalten“ eingetragen. Sie bleiben als Soll-Plan in der Sequenz und können später in die echte Wochenstunde übernommen werden.</div><div class="import-options">${cb('setup-classes','Klassen übernehmen / zusammenführen',pkg.classes.length)}${cb('setup-timetable','Stundenplan durch Import ersetzen',pkg.timetable.length)}${cb('setup-sequences','Sequenzen + Reihenplanung übernehmen',pkg.sequences.length)}${cb('setup-lessons','konkrete tatsächliche Stunden übernehmen',pkg.lessons.length,false)}</div><button class="primary full-button" data-action="apply-setup-import">Setup übernehmen →</button></section>`:'';
  return `<div class="detail-stack"><section class="detail-section import-intro"><span class="eyebrow">EINMALIGER IMPORT</span><h3>Vorhandenes statt neu eintippen</h3><p>Hier können jetzt auch vollständige Reihenplanungen aus „Mein Schulplan“ hinein. Fehlende Angaben bleiben leer; der Import ergänzt nichts selbst.</p><textarea id="setup-import-text" class="ai-import-text" placeholder="Hier den SCHULCOCKPIT_SETUP-Block einfügen …">${esc(raw)}</textarea><div class="import-actions"><label class="upload-button">Setup-Datei öffnen<input type="file" id="setup-import-file" accept=".json,.txt,.md,application/json,text/plain,text/markdown" hidden></label><button class="primary" data-action="parse-setup-import">Setup prüfen</button></div><p class="microcopy">Nichts wird übernommen, bevor du die Vorschau bestätigst. Ein Import ohne Stundenplandaten löscht deinen vorhandenen Stundenplan nicht.</p></section>${preview}</div>`;
}
setupImportPanel=setupImportPanelV10;

function applySetupPackageV10(pkg,opts){
  if(pkg.schoolYear)state.settings.schoolYear=pkg.schoolYear;
  if(pkg.periods.length)state.settings.periods=pkg.periods;
  const keyMap=new Map();
  pkg.classes.forEach(c=>{
    let found=state.classes.find(x=>x.subject.toLowerCase()===c.subject.toLowerCase()&&x.name.toLowerCase()===c.name.toLowerCase());
    if(opts.classes&&!found){
      found={id:uid('class'),subject:c.subject,name:c.name,students:c.students||0,color:['#6d5f9b','#b86f8b','#557b78','#8b684c','#8a6b88'][state.classes.length%5]};
      state.classes.push(found);
    }else if(opts.classes&&found&&c.students){ found.students=c.students; }
    if(found)keyMap.set(c.key,found.id);
  });
  if(opts.timetable&&pkg.timetable.length){
    state.timetable=[];
    pkg.timetable.forEach(t=>{const classId=keyMap.get(t.classKey);if(!classId)return;while(state.settings.periods.length<=t.slot)state.settings.periods.push(`${state.settings.periods.length}. Block`);state.timetable.push({id:uid('tt'),weekday:t.weekday,slot:t.slot,order:t.slot,period:state.settings.periods[t.slot],classId});});
  }
  if(opts.sequences){
    pkg.sequences.forEach(q=>{
      const classId=keyMap.get(q.classKey);if(!classId)return;
      let found=state.sequences.find(x=>x.classId===classId&&x.title.toLowerCase()===q.title.toLowerCase());
      if(!found){
        found={id:uid('seq'),classId,title:q.title,startDate:q.startDate,endDate:q.endDate,goal:q.goal,assessmentDate:q.assessmentDate,notes:q.notes,hours:q.hours||'',plan:[]};
        state.sequences.push(found);
      }else{
        found.plan=Array.isArray(found.plan)?found.plan:[];
        if(q.startDate)found.startDate=q.startDate;if(q.endDate)found.endDate=q.endDate;if(q.goal)found.goal=q.goal;if(q.assessmentDate)found.assessmentDate=q.assessmentDate;if(q.notes)found.notes=q.notes;if(q.hours)found.hours=q.hours;
      }
      (q.units||[]).forEach(u=>{
        const key=`${u.plannedDate||''}|${u.title.toLowerCase()}`;
        let target=found.plan.find(x=>`${x.plannedDate||''}|${String(x.title||'').toLowerCase()}`===key);
        if(!target){target=cleanPlanUnitV10(u);found.plan.push(target);}
        else Object.assign(target,{...cleanPlanUnitV10(u),id:target.id});
      });
      found.plan.sort((a,b)=>(a.plannedDate||'9999').localeCompare(b.plannedDate||'9999')||a.title.localeCompare(b.title,'de'));
    });
  }
  if(opts.lessons&&pkg.lessons.length){
    pkg.lessons.forEach(i=>{
      const classId=keyMap.get(i.classKey);if(!classId)return;
      let l=state.lessons.find(x=>x.classId===classId&&x.date===i.date&&lessonSlot(x)===i.slot);
      const q=state.sequences.find(x=>x.classId===classId&&x.title.toLowerCase()===i.sequenceTitle.toLowerCase());
      if(!l){l={id:uid('lesson'),classId,date:i.date,slot:i.slot,period:state.settings.periods[i.slot]||`${i.slot}. Block`,source:'import',sequenceId:q?.id||'',unit:q?.title||i.sequenceTitle||'',title:i.title||'Thema noch festlegen',objective:i.objective||'',status:i.status,plannedSteps:[],completedSteps:[],phasePlan:[],slides:[],prepTasks:[],materials:[],printPlan:[]};state.lessons.push(l);}
      else{if(i.title)l.title=i.title;if(i.objective)l.objective=i.objective;if(q){l.sequenceId=q.id;l.unit=q.title;}l.status=i.status||l.status;}
    });
  }
  state.settings.demoCleanV06=true;saveState();
}
applySetupPackage=applySetupPackageV10;

function planUnitCardV10(q,u,i){
  const bits=[u.plannedDate?fmtDate(u.plannedDate):'Datum offen',u.hours?`${esc(u.hours)} Std.`:''].filter(Boolean).join(' · ');
  return `<article class="sequence-plan-unit"><div class="sequence-plan-date"><span>${esc(bits)}</span><strong>${i+1}</strong></div><div class="sequence-plan-copy"><h4>${esc(u.title)}</h4>${u.objective?`<p><strong>Ziel:</strong> ${esc(u.objective)}</p>`:''}${u.content?`<p>${esc(u.content)}</p>`:''}${u.material?`<small><strong>Material:</strong> ${esc(u.material)}</small>`:''}${u.notes?`<small><strong>Bemerkung:</strong> ${esc(u.notes)}</small>`:''}</div><button class="secondary" data-use-plan-unit="${q.id}|${u.id}">In nächste Stunde übernehmen →</button></article>`;
}
sequencePanel=function(q){
  if(!q)return '<p>Sequenz nicht gefunden.</p>'; const c=cls(q.classId),ls=linkedLessons(q.id),plan=Array.isArray(q.plan)?q.plan:[];
  return `<div class="detail-stack"><section class="detail-section"><span class="eyebrow">${esc(c?.subject||'')} ${esc(c?.name||'')}</span><div class="lesson-edit-grid"><label class="full">Titel<input data-sequence-field="${q.id}|title" value="${esc(q.title)}"></label><label>Start<input type="date" data-sequence-field="${q.id}|startDate" value="${esc(q.startDate||'')}"></label><label>Geplantes Ende<input type="date" data-sequence-field="${q.id}|endDate" value="${esc(q.endDate||'')}"></label><label class="full">Sequenzziel<textarea data-sequence-field="${q.id}|goal" placeholder="Was sollen die Schüler:innen am Ende können / verstanden haben?">${esc(q.goal||'')}</textarea></label><label>Klassenarbeit / Leistung<input type="date" data-sequence-field="${q.id}|assessmentDate" value="${esc(q.assessmentDate||'')}"></label><label>Notiz<input data-sequence-field="${q.id}|notes" value="${esc(q.notes||'')}" placeholder="optional"></label></div></section><section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">REIHENPLANUNG · SOLL</span><h3>${plan.length?`${plan.length} geplante Stunde${plan.length===1?'':'n'}`:'Noch keine Einzelstunden hinterlegt'}</h3></div><span class="safe-chip">nicht automatisch „gehalten“</span></div><div class="sequence-plan-list">${plan.map((u,i)=>planUnitCardV10(q,u,i)).join('')||'<p class="muted">Hier können die geplanten Einzelstunden aus „Mein Schulplan“ liegen, auch wenn die Reihe später zeitlich verrutscht.</p>'}</div></section><section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">TATSÄCHLICHER VERLAUF · IST</span><h3>Verknüpfte Wochenstunden</h3></div><span class="muted">${ls.length} Stunden</span></div><div class="linked-lessons">${ls.map(l=>`<button data-lesson="${l.id}"><span>${fmtDate(l.date)}</span><strong>${esc(l.title)}</strong><small>${statusMeta[l.status]?.[0]||l.status}</small></button>`).join('')||'<p class="muted">Noch keine tatsächlichen Stunden mit dieser Sequenz verknüpft.</p>'}</div></section></div>`;
};


const lessonPanelBeforeV10=lessonPanel;
lessonPanel=function(l){
  let html=lessonPanelBeforeV10(l),ref=l.planReference;
  if(!ref)return html;
  const block=`<section class="detail-section imported-plan-reference"><div class="section-head compact"><div><span class="eyebrow">AUS DER REIHENPLANUNG · SOLL</span><h3>${esc(ref.title||'Geplante Stunde')}</h3></div><span class="safe-chip">${ref.plannedDate?`urspr. ${fmtDate(ref.plannedDate)}`:'Datum offen'}</span></div>${ref.content?`<p>${esc(ref.content)}</p>`:''}${ref.material?`<p><strong>Materialhinweis:</strong> ${esc(ref.material)}</p>`:''}${ref.notes?`<small>${esc(ref.notes)}</small>`:''}<p class="microcopy">Das ist nur die ursprüngliche Reihenplanung. Der tatsächliche Stand aus den gehaltenen Stunden hat Vorrang.</p></section>`;
  return html.replace('<section class="ai-bridge">',block+'<section class="ai-bridge">');
};

const makeBriefBeforeV10=makeBrief;
makeBrief=function(l){
  let base=makeBriefBeforeV10(l);
  const ref=l.planReference;
  if(!ref)return base;
  const block=`\n\n## Bezug aus der importierten Reihenplanung\n- Geplantes Thema: ${ref.title||''}\n- Ursprünglich vorgesehenes Datum: ${ref.plannedDate||'offen'}\n- Inhalt / Idee: ${ref.content||'nicht eingetragen'}\n- Lernziel: ${ref.objective||'nicht eingetragen'}\n- Materialhinweise: ${ref.material||'keine'}\n- Bemerkungen: ${ref.notes||'keine'}\n\nWichtig: Diese Angaben sind der Soll-Plan aus der Reihenplanung, nicht automatisch der tatsächlich erreichte Lernstand. Passe sie an den echten Stand an.\n`;
  return base.replace('\n## Auftrag an ChatGPT',block+'\n## Auftrag an ChatGPT');
};

const setupIssuesBeforeV10=setupIssues;
setupIssues=function(){
  const issues=setupIssuesBeforeV10();
  state.classes.filter(c=>!Number(c.students)).forEach(c=>issues.push(`Schülerzahl fehlt: ${c.subject} ${c.name}. Die Stoffpläne enthalten dazu keine Angabe.`));
  return issues;
};

const wireBeforeV10=wire;
wire=function(){
  wireBeforeV10();
  document.querySelectorAll('[data-use-plan-unit]').forEach(b=>b.onclick=()=>{
    const [qid,uidx]=b.dataset.usePlanUnit.split('|'),q=seq(qid),u=(q?.plan||[]).find(x=>x.id===uidx);if(!q||!u)return;
    const candidates=state.lessons.filter(l=>l.classId===q.classId&&l.status!=='done').sort((a,b)=>a.date.localeCompare(b.date)||lessonSlot(a)-lessonSlot(b));
    let l=candidates.find(x=>x.date===u.plannedDate)||candidates.find(x=>x.sequenceId===q.id)||candidates.find(x=>(!q.startDate||x.date>=q.startDate)&&(!q.endDate||x.date<=q.endDate));
    if(!l){alert('Für diese Lerngruppe ist noch keine offene Wochenstunde angelegt. Baue zuerst die betreffende Woche auf.');return;}
    l.sequenceId=q.id;l.unit=q.title;l.title=u.title||l.title;if(u.objective)l.objective=u.objective;
    l.planReference={plannedDate:u.plannedDate,title:u.title,content:u.content,objective:u.objective,material:u.material,notes:u.notes,unitId:u.id};
    saveState();modal={type:'lesson',id:l.id};render();
  });
};

if(state.timetable.length) view='prep';
render();

/* V0.11 – klare Startseite + Klasse getrennt von Fachkurs + GA/Klassenzeit */
function normalizeGroupNameV11(name=''){return String(name).trim().replace(/^klasse\s*/i,'');}
function ensureGroupsV11(){
  state.groups=Array.isArray(state.groups)?state.groups:[];
  const counts=new Map();
  (state.classes||[]).forEach(c=>{const n=normalizeGroupNameV11(c.name);if(!n)return;const k=n.toLowerCase();if(!counts.has(k))counts.set(k,[]);counts.get(k).push(c);});
  counts.forEach((courses,k)=>{
    if(courses.length<2)return;
    if(state.groups.some(g=>normalizeGroupNameV11(g.name).toLowerCase()===k))return;
    const students=Math.max(...courses.map(c=>Number(c.students)||0));
    state.groups.push({id:uid('group'),name:normalizeGroupNameV11(courses[0].name),students:students||0,color:'#7b6f96'});
  });
  (state.timetable||[]).forEach(t=>{if(!t.kind)t.kind=t.groupId?'group':'course';});
  (state.lessons||[]).forEach(l=>{if(!l.kind)l.kind=l.groupId?'group':'course';});
}
ensureGroupsV11();saveState();
function grp(id){return (state.groups||[]).find(g=>g.id===id);}
function scheduleEntityV11(x){
  if(x?.kind==='group'||x?.groupId){const g=grp(x.groupId);return {kind:'group',title:`GA ${g?.name||''}`.trim(),subtitle:'Gemeinsamer Anfang / Klassenzeit',color:g?.color||'#7b6f96'};}
  const c=cls(x?.classId);return {kind:'course',title:`${c?.subject||''} ${c?.name||''}`.trim(),subtitle:'Unterricht',color:c?.color||'#999'};
}
function timetableEntryValueV11(t){if(!t)return '';return (t.kind==='group'||t.groupId)?`group:${t.groupId}`:`course:${t.classId}`;}
function setTimetableCellV11(day,slot,value){
  const existing=timetableEntry(day,slot),label=state.settings.periods[slot]||`${slot}. Block`;
  if(!value){if(existing)state.timetable=state.timetable.filter(t=>t.id!==existing.id);saveState();render();return;}
  const [kind,id]=String(value).split(':');
  const next={weekday:Number(day),slot:Number(slot),order:Number(slot),period:label,kind};
  if(kind==='group')next.groupId=id;else next.classId=id;
  if(existing){Object.keys(existing).forEach(k=>{if(['id','weekday','slot','order','period'].includes(k))return;delete existing[k];});Object.assign(existing,next);}
  else state.timetable.push({id:uid('tt'),...next});
  saveState();render();
}
function createBlankLessonFromTimetableV11(t){
  const date=activeWeekDate(t.weekday);
  if(t.kind==='group'||t.groupId){
    return {id:uid('lesson'),kind:'group',groupId:t.groupId,date,period:t.period,slot:t.slot,timetableId:t.id,source:'timetable',title:'Gemeinsamer Anfang',objective:'',status:'open',plannedSteps:[],completedSteps:[],phasePlan:[],slides:[],prepTasks:[],materials:[],printPlan:[],materialsReviewed:true};
  }
  const active=classSequences(t.classId).find(q=>(!q.startDate||q.startDate<=date)&&(!q.endDate||q.endDate>=date))||null;
  return {id:uid('lesson'),kind:'course',classId:t.classId,date,period:t.period,slot:t.slot,timetableId:t.id,source:'timetable',sequenceId:active?.id||'',unit:active?.title||'',title:'Thema noch festlegen',objective:'',status:'open',plannedSteps:[],completedSteps:[],phasePlan:[],slides:[],prepTasks:[],materials:[],printPlan:[]};
}
function rebuildActiveWeekV11(replace=false){
  if(!state.timetable.length)return alert('Dein Stundenplan ist noch leer. Trage zuerst deine Wochenstunden ein.');
  const existingWeek=currentWeekLessons(),matched=new Set();let added=0,kept=0,removed=0;
  state.timetable.forEach(t=>{
    const date=activeWeekDate(t.weekday),isGroup=t.kind==='group'||t.groupId;
    let l=existingWeek.find(x=>x.timetableId===t.id)||existingWeek.find(x=>x.date===date&&lessonSlot(x)===Number(t.slot)&&(isGroup?(x.groupId===t.groupId):(x.classId===t.classId)));
    if(l){l.date=date;l.period=t.period;l.slot=t.slot;l.timetableId=t.id;l.source='timetable';l.kind=isGroup?'group':'course';if(isGroup){l.groupId=t.groupId;delete l.classId;}else{l.classId=t.classId;delete l.groupId;}matched.add(l.id);kept++;}
    else{l=createBlankLessonFromTimetableV11(t);state.lessons.push(l);matched.add(l.id);added++;}
  });
  if(replace){const start=iso(activeMonday()),end=activeWeekEnd();state.lessons=state.lessons.filter(l=>{if(l.date<start||l.date>end)return true;if(matched.has(l.id)||l.status==='done'||l.source==='manual')return true;removed++;return false;});}
  saveState();alert(`${added} neu · ${kept} weiterverwendet${replace?` · ${removed} veraltet entfernt`:''}.`);render();
}
createBlankLessonFromTimetable=createBlankLessonFromTimetableV11;
rebuildActiveWeek=rebuildActiveWeekV11;
syncWeek=()=>rebuildActiveWeekV11(false);

function groupLessonPlanReadyV11(l){return !!((l.phasePlan||[]).some(p=>p.title?.trim())||l.objective?.trim()||l.title?.trim()&&l.title!=='Gemeinsamer Anfang');}
function lessonWhoV11(l){return scheduleEntityV11(l).title;}
function workflowTasksV11(){
  const lessons=currentWeekLessons(),tasks=[];
  lessons.forEach(l=>{
    const who=lessonWhoV11(l),slot=lessonSlot(l),isGroup=l.kind==='group'||l.groupId;
    const hasPlan=isGroup?groupLessonPlanReadyV11(l):lessonPlanReadyV08(l);
    if(l.status==='open'||!hasPlan)tasks.push({id:`plan-${l.id}`,stage:1,date:l.date,slot,type:'plan',lessonId:l.id,title:`${who}: ${isGroup?'kurz planen':'Stunde planen'}`,detail:`${fmtDate(l.date)} · ${l.period||''}`,why:isGroup?'Nur kurz festlegen, was im gemeinsamen Anfang ansteht.':'Zuerst diese Stunde absichern; danach ergibt sich der Materialbedarf.',estimate:isGroup?5:25,source:'lesson'});
    if(!isGroup){
      const missing=missingPrintFilesForLesson(l);
      if(l.status==='needs-material'||missing.length)tasks.push({id:`material-${l.id}`,stage:2,date:l.date,slot,type:'material',lessonId:l.id,title:`${who}: Material fertigstellen`,detail:missing.length?`${missing.length} Druckdatei${missing.length===1?' fehlt':'en fehlen'}`:`${fmtDate(l.date)} · ${l.period||''}`,why:'Die Stunde ist geplant; jetzt nur das tatsächlich benötigte Material fertigstellen.',estimate:20,source:'lesson'});
      (l.prepTasks||[]).filter(t=>!t.done&&t.title).forEach(t=>tasks.push({id:`prep-${l.id}-${t.id}`,stage:2,date:l.date,slot,type:'prep',lessonId:l.id,title:`${who}: ${t.title}`,detail:t.category||'Vorbereitung',why:t.note||'Noch offener Vorbereitungsschritt.',estimate:15,source:'lesson'}));
    }
  });
  const openPrint=openPrintItems().filter(i=>i.fileReady);if(openPrint.length)tasks.push({id:'print-week',stage:3,date:activeWeekDate(1),slot:99,type:'print',title:'Wochenkopien erledigen',detail:`${openPrint.length} druckbereite Position${openPrint.length===1?'':'en'}`,why:'Alles gesammelt kopieren, statt morgens vor dem Unterricht.',estimate:20,source:'lesson'});
  lessons.forEach(l=>{const isGroup=l.kind==='group'||l.groupId;if(!isGroup&&lessonPlanReadyV08(l)&&materialDecisionReadyV08(l)&&prepReadyV08(l)&&copiesReadyV08(l)&&!lessonReadyV08(l))tasks.push({id:`final-${l.id}`,stage:4,date:l.date,slot:lessonSlot(l),type:'final',lessonId:l.id,title:`${lessonWhoV11(l)}: als bereit markieren`,detail:`${fmtDate(l.date)} · ${l.period||''}`,why:'Alles Wesentliche steht. Ein letzter Check reicht.',estimate:5,source:'lesson'});if(isGroup&&hasSimpleReadyV11(l)===false&&groupLessonPlanReadyV11(l))tasks.push({id:`group-final-${l.id}`,stage:4,date:l.date,slot:lessonSlot(l),type:'final',lessonId:l.id,title:`${lessonWhoV11(l)}: abhaken`,detail:`${fmtDate(l.date)} · ${l.period||''}`,why:'Die kurze Planung steht.',estimate:1,source:'lesson'});});
  return tasks.sort((a,b)=>a.stage-b.stage||a.date.localeCompare(b.date)||(a.slot??99)-(b.slot??99));
}
function hasSimpleReadyV11(l){return l.status==='ready'||l.status==='done';}
workflowTasks=workflowTasksV11;

function focusViewV11(){
  const lessonTasks=workflowTasksV11();
  const general=(state.tasks||[]).filter(t=>!t.done).map(t=>({id:`general-${t.id}`,source:'general',generalId:t.id,title:t.title,detail:`${t.category}${t.dueDate?` · fällig ${fmtShortDateV09(t.dueDate)}`:''}`,why:t.notes||'Zusätzliche Schulaufgabe.',estimate:Number(t.effort)||15,date:t.dueDate||'9999-12-31',stage:generalTaskPriorityV09(t)<0?0:6}));
  const tasks=[...lessonTasks,...general].sort((a,b)=>a.stage-b.stage||String(a.date).localeCompare(String(b.date))||(a.slot??99)-(b.slot??99));
  const next=tasks[0],after=tasks.slice(1,4);
  if(!state.timetable.length)return `<div class="content-grid"><section class="focus-hero onboarding-hero"><div><span class="eyebrow">START</span><h2>Erst Stundenplan und Klassenstruktur sauber setzen.</h2><p>Unterrichtskurse und deine eigene Klasse sind getrennt. Danach zeigt dir die Startseite nur noch den nächsten Schritt.</p></div><button class="primary" data-view="timetable">Stundenplan einrichten →</button></section></div>`;
  if(!currentWeekLessons().length)return `<div class="content-grid"><section class="focus-hero"><div><span class="eyebrow">KW ${activeWeekNumber()}</span><h2>Woche noch nicht aufgebaut.</h2><p>Ein Klick erzeugt die echte Woche aus deinem Stundenplan.</p></div><button class="primary big" data-action="rebuild-week">Woche aufbauen →</button></section></div>`;
  return `<div class="content-grid simplified-focus"><section class="focus-hero ${!next?'all-done':''}"><div>${next?`<span class="eyebrow">JETZT NUR DAS</span><h2>${esc(next.title)}</h2><p>${esc(next.why)}</p><span class="next-meta">${esc(next.detail)} · ca. ${next.estimate||'?'} Min.</span>`:`<span class="eyebrow">FÜR JETZT FERTIG</span><h2>Es ist nichts Akutes offen.</h2><p>Du kannst aufhören oder bewusst in den Verbesserungsbereich wechseln.</p>`}</div>${next?(next.source==='general'?`<button class="primary big" data-complete-general="${next.generalId}">Erledigt ✓</button>`:`<button class="primary big" data-task="${next.id}">Öffnen →</button>`):'<div class="done-badge">✓</div>'}</section>${after.length?`<section class="panel quiet-next"><div class="section-head"><div><span class="eyebrow">DANACH</span><h2>Nur die nächsten drei</h2></div><button class="text-button" data-view="prep">ganze Wochenvorbereitung</button></div><div class="mini-next-list">${after.map((t,i)=>`<div class="mini-next"><span>${i+2}</span><div><strong>${esc(t.title)}</strong><small>${esc(t.detail)}</small></div></div>`).join('')}</div></section>`:''}<section class="focus-shortcuts"><button data-view="prep"><strong>Wochenvorbereitung</strong><span>alle Unterrichtsstunden sehen →</span></button><button data-view="tasks"><strong>Aufgaben & Orga</strong><span>Korrekturen, Eltern, Tutorat →</span></button></section></div>`;
}
focusView=focusViewV11;

function timetableViewV11(){
  const periods=state.settings.periods||defaultPeriods();
  const options=`<option value="">— frei —</option><optgroup label="Unterricht">${state.classes.map(c=>`<option value="course:${c.id}">${esc(c.subject)} ${esc(c.name)}</option>`).join('')}</optgroup><optgroup label="Klassenzeit / GA">${(state.groups||[]).map(g=>`<option value="group:${g.id}">GA ${esc(g.name)}</option>`).join('')}</optgroup>`;
  return `<div class="content-grid"><section class="hero-card timetable-hero"><div><span class="eyebrow">ZWEI EBENEN</span><h2>Klasse ist nicht dasselbe wie Fachkurs.</h2><p><strong>5f</strong> ist deine Klasse. <strong>Mathematik 5f</strong>, <strong>Religion 5f</strong> und <strong>Methoden 5f</strong> sind Unterrichtskurse. Gemeinsamer Anfang wird deshalb separat als <strong>GA 5f</strong> geplant.</p></div></section><section class="panel"><div class="section-head"><div><span class="eyebrow">KLASSENZEIT</span><h2>Eigene Klassen / Gruppen</h2></div></div><div class="group-editor">${(state.groups||[]).map(g=>`<div class="group-edit-row"><input value="${esc(g.name)}" data-group-field="${g.id}|name"><input class="small-input" type="number" min="0" value="${Number(g.students)||''}" data-group-field="${g.id}|students" placeholder="SuS"><button class="danger-lite" data-delete-group="${g.id}">×</button></div>`).join('')||'<p class="muted">Noch keine Klasse für GA/Klassenzeit hinterlegt.</p>'}</div><div class="add-class-row"><input id="new-group-name" placeholder="z. B. 5f"><input id="new-group-students" type="number" min="0" placeholder="Schülerzahl"><button data-action="add-group">+ Klasse / Gruppe</button></div></section><section class="panel"><div class="section-head"><div><span class="eyebrow">UNTERRICHT</span><h2>Fachkurse</h2></div></div><div class="class-editor">${state.classes.map(c=>`<div class="class-edit-row"><input value="${esc(c.subject)}" data-class-field="${c.id}|subject"><input value="${esc(c.name)}" data-class-field="${c.id}|name"><input class="small-input" type="number" min="0" value="${Number(c.students)||''}" data-class-field="${c.id}|students"><button class="danger-lite" data-delete-class="${c.id}">×</button></div>`).join('')}</div><div class="add-class-row"><input id="new-subject" placeholder="Fach"><input id="new-class" placeholder="Klasse/Kurs"><input id="new-students" type="number" min="0" placeholder="SuS"><button data-action="add-class">+ Fachkurs</button></div></section><section class="panel"><div class="section-head"><div><span class="eyebrow">WOCHENRASTER</span><h2>Stundenplan</h2></div><button class="primary" data-action="rebuild-week">Woche neu aufbauen</button></div><div class="schedule-grid v11"><div class="schedule-corner">Block</div>${[1,2,3,4,5].map(d=>`<div class="schedule-day">${dayNames[d]}</div>`).join('')}${periods.map((p,slot)=>`<div class="schedule-period"><input value="${esc(p)}" data-period-label="${slot}"></div>${[1,2,3,4,5].map(day=>{const t=timetableEntry(day,slot);return `<div class="schedule-cell"><select data-tt-cell-v11="${day}|${slot}">${options.replace(`value="${timetableEntryValueV11(t)}"`,`value="${timetableEntryValueV11(t)}" selected`)}</select></div>`}).join('')}`).join('')}</div><div class="period-actions"><button data-action="add-period">+ Block hinzufügen</button></div></section></div>`;
}
timetableView=timetableViewV11;

function groupLessonPanelV11(l){const g=grp(l.groupId);return `<div class="detail-stack"><section class="detail-section"><span class="eyebrow">GA / KLASSENZEIT · ${esc(g?.name||'')}</span><h3>${fmtDate(l.date)} · ${esc(l.period||'')}</h3><p class="muted">Hier reicht eine kurze Planung. Kein Fachziel, keine Sequenz, kein Materialzwang.</p><div class="lesson-edit-grid"><label class="full">Was steht an?<input data-group-lesson-field="${l.id}|title" value="${esc(l.title==='Gemeinsamer Anfang'?'':l.title||'')}" placeholder="z. B. Wochenchallenge auswerten, Organisatorisches, Klassenrat"></label><label class="full">Kurze Notiz / Ziel<textarea data-group-lesson-field="${l.id}|objective" placeholder="optional">${esc(l.objective||'')}</textarea></label></div></section><section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">ABLAUF</span><h3>Falls du mehr als einen Punkt brauchst</h3></div><button data-add-phase="${l.id}">+ Punkt</button></div><div class="phase-editor-list">${(l.phasePlan||[]).map((p,i)=>`<div class="phase-editor-row"><input class="phase-minutes" value="${esc(p.minutes||'')}" placeholder="Min" data-phase-field="${l.id}|${p.id}|minutes"><input value="${esc(p.title||'')}" placeholder="Punkt ${i+1}" data-phase-field="${l.id}|${p.id}|title"><button class="danger-lite" data-delete-phase="${l.id}|${p.id}">×</button></div>`).join('')||'<p class="muted">Ein einzelner Eintrag oben reicht oft völlig.</p>'}</div></section><section class="detail-section"><div class="quick-status-row"><button data-quick-status="${l.id}|planned">✓ Planung steht</button><button data-quick-status="${l.id}|ready">Bereit</button><button data-quick-status="${l.id}|done">Gehalten</button></div></section></div>`;}
const lessonPanelCourseV11=lessonPanel;
lessonPanel=function(l){return (l.kind==='group'||l.groupId)?groupLessonPanelV11(l):lessonPanelCourseV11(l);};
const modalHtmlBeforeV11=modalHtml;
modalHtml=function(){if(modal?.type==='lesson'){const l=lesson(modal.id);if(l&&(l.kind==='group'||l.groupId)){const g=grp(l.groupId);return `<div class="modal-backdrop" data-action="modal-close"><section class="modal" data-modal-stop><header class="modal-header"><div><span class="eyebrow">SCHULCOCKPIT</span><h2>GA ${esc(g?.name||'')} · ${esc(l.period||'')}</h2></div><button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">${groupLessonPanelV11(l)}</div></section></div>`;}}return modalHtmlBeforeV11();};

function lessonCardV11(l){const e=scheduleEntityV11(l),sm=statusMeta[l.status]||statusMeta.open;return `<button class="lesson-card" data-lesson="${l.id}" style="--class-color:${e.color}"><div class="lesson-date"><span>${fmtDate(l.date)}</span><strong>${esc(l.period||'')}</strong></div><div class="lesson-main"><span class="eyebrow">${e.kind==='group'?'KLASSENZEIT':'UNTERRICHT'}</span><h3>${esc(e.title)}</h3><p>${esc(l.title|| (e.kind==='group'?'Gemeinsamer Anfang':'Thema noch festlegen'))}</p></div><span class="status ${sm[1]}">${sm[0]}</span></button>`;}
weekView=function(){const ls=currentWeekLessons();return `<div class="content-grid"><section class="week-toolbar panel"><div><span class="eyebrow">PLANUNGSWOCHE</span><h2>KW ${activeWeekNumber()} · ${activeWeekLabel()}</h2></div><div class="hero-actions"><button class="secondary" data-action="sync-week">Nur fehlende ergänzen</button><button class="primary" data-action="rebuild-week">Neu aus Stundenplan</button></div></section><section class="panel"><div class="section-head"><div><span class="eyebrow">CHRONOLOGISCH</span><h2>Deine Woche</h2></div></div><div class="lesson-list">${ls.map(lessonCardV11).join('')||'<p class="muted">Noch keine Stunden.</p>'}</div></section></div>`;};

const renderBeforeV11=render;
render=function(){
  const app=document.getElementById('app'),weekNo=activeWeekNumber();
  app.innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">SC</div><div><strong>Schulcockpit</strong><small>${esc(state.settings.schoolYear)} · V0.11</small></div></div><nav>${navBtn('focus','✦','Start')}${navBtn('prep','↠','Wochenstart')}${navBtn('week','▦','Meine Woche')}${navBtn('tasks','✓','Aufgaben & Orga')}${navBtn('sequences','≋','Reihenplanung')}${navBtn('timetable','⌗','Stundenplan')}${navBtn('print','⎙','Kopieren')}${navBtn('materials','▤','Material')}${navBtn('improve','↗','Verbessern')}${navBtn('setup','◎','Einrichten')}</nav><div class="sidebar-footer"><button data-action="setup-import">Setup importieren</button><button data-action="backup">Backup</button></div></aside><main><header class="topbar"><div><span class="eyebrow">KW ${weekNo} · ${activeWeekLabel()}</span><h1>${pageTitle()}</h1></div><div class="top-actions"><div class="week-switcher"><button data-action="prev-week">←</button><button data-action="planning-week">KW ${weekNo}</button><button data-action="next-week">→</button></div><button class="secondary" data-view="prep">Wochenstart</button></div></header><div class="page">${viewHtml()}</div></main></div>${modal?modalHtml():''}`;
  wire();
};
pageTitle=function(){return ({focus:'Start',prep:'Wochenstart',week:'Meine Woche',tasks:'Aufgaben & Orga',sequences:'Reihenplanung',timetable:'Stundenplan',print:'Kopieren',materials:'Material',improve:'Verbessern',setup:'Einrichten'})[view]||'Schulcockpit';};

const wireBeforeV11=wire;
wire=function(){
  wireBeforeV11();
  document.querySelectorAll('[data-tt-cell-v11]').forEach(s=>s.onchange=()=>{const [d,slot]=s.dataset.ttCellV11.split('|').map(Number);setTimetableCellV11(d,slot,s.value);});
  document.querySelector('[data-action="add-group"]')?.addEventListener('click',()=>{const name=document.getElementById('new-group-name')?.value.trim(),students=Number(document.getElementById('new-group-students')?.value)||0;if(!name)return alert('Bitte einen Klassennamen eintragen.');state.groups=state.groups||[];state.groups.push({id:uid('group'),name,students,color:'#7b6f96'});saveState();render();});
  document.querySelectorAll('[data-group-field]').forEach(i=>i.onchange=()=>{const [id,key]=i.dataset.groupField.split('|'),g=grp(id);if(!g)return;g[key]=key==='students'?Number(i.value)||0:i.value.trim();saveState();render();});
  document.querySelectorAll('[data-delete-group]').forEach(b=>b.onclick=()=>{const id=b.dataset.deleteGroup;if(state.timetable.some(t=>t.groupId===id)||state.lessons.some(l=>l.groupId===id))return alert('Diese Klasse wird noch im Stundenplan oder in GA-Stunden verwendet.');state.groups=state.groups.filter(g=>g.id!==id);saveState();render();});
  document.querySelectorAll('[data-group-lesson-field]').forEach(i=>i.onchange=()=>{const [id,key]=i.dataset.groupLessonField.split('|'),l=lesson(id);if(!l)return;l[key]=i.value.trim();if(l.title||l.objective)l.status='planned';saveState();modal={type:'lesson',id};render();});
};
view='focus';render();

/* V0.11.1 – GA-Migration, Reihen-Vorschlag und getrennte Wochenvorbereitung */
(function migrateExistingGAV11(){
  let changed=false;
  (state.timetable||[]).forEach(t=>{
    if(t.kind==='group'||t.groupId)return;
    if(!/^(ga\b|gemeinsamer anfang)/i.test(String(t.period||'').trim()))return;
    const c=cls(t.classId);if(!c)return;
    const g=(state.groups||[]).find(x=>normalizeGroupNameV11(x.name).toLowerCase()===normalizeGroupNameV11(c.name).toLowerCase());
    if(g){t.kind='group';t.groupId=g.id;delete t.classId;changed=true;}
  });
  if(changed)saveState();
})();
function exactPlanUnitV11(classId,date){
  for(const q of classSequences(classId)){const u=(q.plan||[]).find(x=>x.plannedDate===date);if(u)return {q,u};}
  return null;
}
function attachExactPlanV11(l){
  if(!l||l.kind==='group'||l.groupId||!l.classId)return l;
  const hit=exactPlanUnitV11(l.classId,l.date);if(!hit)return l;
  const {q,u}=hit;l.sequenceId=q.id;l.unit=q.title;
  if(!l.title||l.title==='Thema noch festlegen')l.title=u.title||l.title;
  if(!l.objective&&u.objective)l.objective=u.objective;
  if(!l.planReference)l.planReference={plannedDate:u.plannedDate,title:u.title,content:u.content,objective:u.objective,material:u.material,notes:u.notes,unitId:u.id,autoMatched:true};
  return l;
}
const createBlankLessonFromTimetableBeforeV111=createBlankLessonFromTimetable;
createBlankLessonFromTimetable=function(t){return attachExactPlanV11(createBlankLessonFromTimetableBeforeV111(t));};
const rebuildActiveWeekBeforeV111=rebuildActiveWeek;
rebuildActiveWeek=function(replace=false){
  rebuildActiveWeekBeforeV111(replace);
  currentWeekLessons().forEach(attachExactPlanV11);saveState();render();
};
syncWeek=()=>rebuildActiveWeek(false);

function coursePrepMetricsV11(){
  const ls=sortedWeekV08().filter(l=>!(l.kind==='group'||l.groupId));
  const planned=ls.filter(lessonPlanReadyV08).length,material=ls.filter(l=>lessonPlanReadyV08(l)&&materialDecisionReadyV08(l)).length,files=ls.filter(l=>lessonPlanReadyV08(l)&&materialDecisionReadyV08(l)&&prepReadyV08(l)).length,copied=ls.filter(l=>lessonPlanReadyV08(l)&&materialDecisionReadyV08(l)&&prepReadyV08(l)&&copiesReadyV08(l)).length,ready=ls.filter(lessonReadyV08).length;
  return {ls,total:ls.length,planned,material,files,copied,ready,pct:ls.length?Math.round(((planned+material+files+copied+ready)/(ls.length*5))*100):100};
}
function prepCourseRowV11(l){
  const e=scheduleEntityV11(l),needs=printNeedsV08(l),printed=copiesReadyV08(l),plan=lessonPlanReadyV08(l),material=materialDecisionReadyV08(l),files=prepReadyV08(l),ready=lessonReadyV08(l);
  const chip=(ok,label)=>`<span class="pipeline-chip ${ok?'ok':'open'}">${ok?'✓':'○'} ${label}</span>`;
  return `<div class="prep-lesson-row"><button class="prep-lesson-main" data-lesson="${l.id}"><span class="prep-date">${esc(fmtDate(l.date))}<small>${esc(l.period||'')}</small></span><span><strong>${esc(e.title)}</strong><small>${esc(l.title||'Thema noch festlegen')}</small></span></button><div class="pipeline-chips">${chip(plan,'Plan')}${chip(material,'Material')}${chip(files,'Dateien')}${chip(printed,needs.length?'Kopiert':'kein Druck')}${chip(ready,'Bereit')}</div>${plan&&!material?`<button class="secondary small-action" data-no-material="${l.id}">Kein Extra-Material</button>`:''}${plan&&material&&files&&printed&&!ready?`<button class="primary small-action" data-mark-ready="${l.id}">Bereit ✓</button>`:''}</div>`;
}
function prepGroupRowV11(l){const g=grp(l.groupId),planned=groupLessonPlanReadyV11(l),ready=hasSimpleReadyV11(l);return `<div class="prep-lesson-row group-prep-row"><button class="prep-lesson-main" data-lesson="${l.id}"><span class="prep-date">${esc(fmtDate(l.date))}<small>${esc(l.period||'')}</small></span><span><strong>GA ${esc(g?.name||'')}</strong><small>${esc(l.title==='Gemeinsamer Anfang'?'noch kurz planen':l.title||'noch kurz planen')}</small></span></button><div class="pipeline-chips"><span class="pipeline-chip ${planned?'ok':'open'}">${planned?'✓':'○'} Kurzplan</span><span class="pipeline-chip ${ready?'ok':'open'}">${ready?'✓':'○'} Bereit</span></div>${planned&&!ready?`<button class="primary small-action" data-mark-ready="${l.id}">Bereit ✓</button>`:''}</div>`;}
function weekPrepViewV11(){
  const all=sortedWeekV08(),groups=all.filter(l=>l.kind==='group'||l.groupId),m=coursePrepMetricsV11(),tasks=workflowTasksV11(),next=tasks.find(t=>t.stage<=4),first=next?.stage||5;
  if(!state.timetable.length)return `<div class="content-grid"><section class="focus-hero"><div><span class="eyebrow">NOCH NICHT EINGERICHTET</span><h2>Erst den Stundenplan sauber setzen.</h2></div><button class="primary" data-view="timetable">Stundenplan →</button></section></div>`;
  if(!all.length)return `<div class="content-grid"><section class="focus-hero"><div><span class="eyebrow">KW ${activeWeekNumber()}</span><h2>Woche noch nicht aufgebaut.</h2></div><button class="primary big" data-action="rebuild-week">Woche aufbauen →</button></section></div>`;
  return `<div class="content-grid"><section class="weekly-prep-hero"><div><span class="eyebrow">WOCHENSTART · KW ${activeWeekNumber()}</span><h2>${next?'Eine Sache nach der anderen.':'Unterricht ist abgesichert.'}</h2><p>${next?'Oben ist immer die nächste sinnvolle Aufgabe. GA/Klassenzeit läuft separat und braucht nur eine Kurzplanung.':'Für die Unterrichtsvorbereitung ist gerade nichts Akutes offen.'}</p></div><div class="weekly-score"><strong>${m.pct}%</strong><span>Fachunterricht</span></div></section>${next?`<section class="next-action-card"><div><span class="eyebrow">JETZT</span><h2>${esc(next.title)}</h2><p>${esc(next.why)}</p><span>${esc(next.detail)}</span></div><button class="primary big" data-task="${next.id}">Öffnen →</button></section>`:''}<section class="panel"><div class="section-head"><div><span class="eyebrow">FACHUNTERRICHT</span><h2>Plan → Material → Kopieren → Bereit</h2></div><span class="muted">${m.total} Stunden</span></div>${m.total?`<div class="prep-stage-grid compact-stages">${prepStageCardV08(1,'Plan',m.planned,m.total,'Thema und Ablauf',first===1)}${prepStageCardV08(2,'Material',m.material,m.total,'Bedarf geklärt',first===2)}${prepStageCardV08(3,'Dateien',m.files,m.total,'alles vorhanden',first===2&&m.material===m.total)}${prepStageCardV08(4,'Kopiert',m.copied,m.total,'Druck erledigt',first===3)}${prepStageCardV08(5,'Bereit',m.ready,m.total,'aus dem Kopf',first===4)}</div><div class="prep-lesson-table">${m.ls.map(prepCourseRowV11).join('')}</div>`:'<p class="muted">Keine Fachstunden in dieser Woche.</p>'}</section>${groups.length?`<section class="panel group-week-panel"><div class="section-head"><div><span class="eyebrow">GEMEINSAMER ANFANG / KLASSENZEIT</span><h2>Nur kurz planen</h2></div><span class="muted">${groups.length} Termin${groups.length===1?'':'e'}</span></div><p class="muted">Kein Fachziel, keine Materialpipeline. Ein kurzer Punkt reicht normalerweise.</p><div class="prep-lesson-table">${groups.map(prepGroupRowV11).join('')}</div></section>`:''}</div>`;
}
weekPrepViewV08=weekPrepViewV11;

/* einmalig vorhandene Wochenstunden mit exakt passender importierter Planung anreichern */
currentWeekLessons().forEach(attachExactPlanV11);saveState();render();

/* V0.12 – Montagsmodus: Sollplan -> Material -> ChatGPT -> Präsentation -> Reflexion */
function coarsePlanReadyV12(l){
  if(!l || l.kind==='group'||l.groupId) return true;
  return !!(l.planReference || (l.title&&l.title!=='Thema noch festlegen') || (l.unit&&l.sequenceId));
}
function concretePlanReadyV12(l){
  return !!(l?.aiImportAt || ((l?.phasePlan||[]).length && (l?.slides||[]).length));
}
function normalizeHintV12(s){return normalizeMaterialTitle(String(s||'').replace(/\.(pdf|docx?|pptx?|xlsx?)$/i,''));}
function materialHintLinesV12(l){
  const raw=l?.planReference?.material||'';
  return String(raw).split(/\r?\n|\s+\+\s+/).map(x=>x.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
}
function guessPrintableV12(h){
  const s=String(h||'').toLowerCase();
  if(/pptx?|powerpoint|präsentation|folie|tafelbild|video|film|bild$/.test(s)) return false;
  if(/arbeitsheft|buch\b|s\.\s*\d|seite\s*\d/.test(s) && !/pdf|docx?|ab\b|arbeitsblatt|förder|karte|mindmap/.test(s)) return false;
  return /pdf|docx?|ab\b|arbeitsblatt|förder|karte|mindmap|blatt|text|interview|zeitstrahl|quiz|rätsel|aufgaben/.test(s);
}
function bestMaterialMatchV12(hint){
  const n=normalizeHintV12(hint); if(!n)return null;
  let exact=state.materials.find(m=>normalizeHintV12(m.title)===n); if(exact)return exact;
  const toks=n.split(/\s+/).filter(x=>x.length>2);
  let best=null,bestScore=0;
  state.materials.forEach(m=>{const mn=normalizeHintV12(m.title),mt=new Set(mn.split(/\s+/).filter(x=>x.length>2)); if(!mn)return;let hit=toks.filter(t=>mt.has(t)).length;let score=toks.length?hit/toks.length:0;if((mn.includes(n)||n.includes(mn))&&Math.min(n.length,mn.length)>5)score=Math.max(score,.9);if(score>bestScore){bestScore=score;best=m;}});
  return bestScore>=.72?best:null;
}
function standardVariantV12(m){
  if(!m)return null; let v=(m.variants||[]).find(v=>v.type==='standard');
  if(!v){v={id:uid('var'),type:'standard',label:'Standard',available:false,fileName:null,fileKey:null};m.variants=m.variants||[];m.variants.unshift(v);}
  return v;
}
function hydrateCoarseMaterialsV12(l){
  if(!l||l.kind==='group'||l.groupId)return;
  const hints=materialHintLinesV12(l); l.coarseMaterialHints=hints;
  hints.forEach(h=>{
    const m=bestMaterialMatchV12(h); if(!m)return;
    const v=standardVariantV12(m); if(!l.materials.includes(m.id))l.materials.push(m.id);
    const shouldPrint=guessPrintableV12(h); if(!shouldPrint)return;
    const c=cls(l.classId),p=ensurePlan(l,m.id,v.id);
    if(!p._coarseInitialized){p.needed=true;p.count=Number(c?.students)||0;p.mode='bw';p._coarseInitialized=true;}
  });
}
function hydrateWeekCoarseMaterialsV12(){currentWeekLessons().forEach(hydrateCoarseMaterialsV12);saveState();}
function materialHintStatusV12(l,h){
  const m=bestMaterialMatchV12(h); if(!m)return {hint:h,material:null,variant:null,fileReady:false,printable:guessPrintableV12(h)};
  const v=standardVariantV12(m); return {hint:h,material:m,variant:v,fileReady:hasStoredFile(v),printable:guessPrintableV12(h)};
}
function courseMaterialRowsV12(){
  return sortedWeekV08().filter(l=>!(l.kind==='group'||l.groupId)).flatMap(l=>materialHintLinesV12(l).map(h=>({l,...materialHintStatusV12(l,h)})));
}
function unresolvedMaterialHintsV12(){return courseMaterialRowsV12().filter(x=>!x.material || (x.printable&&!x.fileReady));}
function weekMaterialSummaryV12(){
  const rows=courseMaterialRowsV12();return {rows,total:rows.length,resolved:rows.filter(x=>x.material).length,files:rows.filter(x=>!x.printable||x.fileReady).length,unresolved:rows.filter(x=>!x.material || (x.printable&&!x.fileReady)).length};
}
function concretePlanningPromptV12(l){
  const c=cls(l.classId),q=seq(l.sequenceId),prev=previousLesson(l),pr=l.planReference||{},prevR=prev?.reflection||{};
  const prevOpen=(prev?.phasePlan||[]).filter(p=>!p.done&&p.title).map(p=>p.title);
  const matRows=materialHintLinesV12(l).map(h=>{const st=materialHintStatusV12(l,h);return `- ${h}${st.material?` → Hub: ${st.material.title}${st.fileReady?' (Datei vorhanden)':' (Datei fehlt)'}`:' → noch nicht im Hub zugeordnet'}`;}).join('\n')||'- keine Hauptmaterialien eingetragen';
  return `# Schulcockpit – konkrete Stundenplanung\n\n## Wichtig\nDie GROBE Reihenplanung steht bereits fest. Plane NICHT die Reihe neu. Konkretisiere nur diese eine Stunde so, dass ich sie anschließend direkt in mein Schulcockpit importieren und daraus eine Präsentation erzeugen kann.\n\n## Lerngruppe\n${c?.subject||''} ${c?.name||''} · ${c?.students||'?'} Schüler:innen\n\n## Reihe\n${q?.title||l.unit||'nicht zugeordnet'}\n${q?.goal?`Reihenziel: ${q.goal}\n`:''}${q?.assessmentDate?`Leistungsnachweis: ${q.assessmentDate}\n`:''}\n## Grob geplante Stunde (Soll)\nDatum: ${l.date}\nThema: ${pr.title||l.title||'nicht eingetragen'}\n${pr.content?`Vorgesehener Inhalt: ${pr.content}\n`:''}${pr.objective?`Vorgesehenes Ziel: ${pr.objective}\n`:''}${pr.notes?`Planungsnotiz: ${pr.notes}\n`:''}\n## Hauptmaterial aus der Reihenplanung\n${matRows}\n\n## Letzter tatsächlicher Stand\n${prev?`Letzte Stunde: ${prev.date} · ${prev.title||''}\nNicht geschafft: ${prevOpen.length?prevOpen.join('; '):'nichts markiert'}\nZeit: ${prevR.timing||'nicht angegeben'}\nLernstand: ${prevR.learning||'nicht angegeben'}\nVerlauf: ${prevR.mood||'nicht angegeben'}\nOptionale Notiz: ${prevR.note||'keine'}`:'Noch keine vorherige Stunde dokumentiert.'}\n\n## Auftrag\nErstelle eine konkrete, realistische Unterrichtsplanung für diese Stunde. Nutze das vorhandene Hauptmaterial als Ausgangspunkt und erfinde nur dann neues Material, wenn es didaktisch wirklich nötig ist. Ich möchte möglichst wenig Nacharbeit. Gib mir:\n1. Phasen mit realistischen Minuten,\n2. genaue Folieninhalte (inkl. Top/Flop-Fragen, Impulse, Arbeitsaufträge, Sicherungsfolie etc., wo passend),\n3. genaue Arbeitsaufträge in schülergerechter Form,\n4. notwendige zusätzliche Materialien/Differenzierung nur falls nötig,\n5. kurze Hinweise für Lehrkraft nur wenn wirklich hilfreich.\n\nDanach hänge GENAU EINEN maschinenlesbaren Block an:\n<SCHULCOCKPIT_IMPORT>\n{\n  "schema":"schulcockpit.lesson.v2",\n  "lesson":{"title":"...","objective":"..."},\n  "phases":[{"phase":"Einstieg","minutes":10,"title":"...","details":"..."}],\n  "slides":[{"type":"Titel|Einstieg|Top oder Flop|Arbeitsauftrag|Inhalt|Sicherung|Reflexion|Sonstiges","title":"...","content":["..."],"notes":""}],\n  "materials":[{"title":"...","kind":"file","variant":"standard","copies":${Number(c?.students)||0},"printMode":"bw","alreadyPrinted":false,"note":""}],\n  "prepTasks":[]\n}\n</SCHULCOCKPIT_IMPORT>\n\nBestehende Materialtitel möglichst exakt wiederverwenden. Wenn das bereits eingeplante Material genügt, keine künstlichen Zusatzmaterialien erzeugen.`;
}
makeBrief=concretePlanningPromptV12;

function materialStageCardV12(x){
  const c=cls(x.l.classId),e=scheduleEntityV11(x.l);
  return `<div class="material-week-row ${x.material&&(!x.printable||x.fileReady)?'resolved':'needs-attention'}"><div class="material-week-lesson"><span>${esc(fmtDate(x.l.date))}</span><strong>${esc(e.title)}</strong><small>${esc(x.l.title||'')}</small></div><div class="material-week-hint"><strong>${esc(x.hint)}</strong>${x.material?`<small>Hub: ${esc(x.material.title)}${x.printable?(x.fileReady?' · Datei ✓':' · Datei fehlt'):' · kein Druck nötig'}</small>`:'<small>Noch nicht im Material-Hub</small>'}</div><div class="material-week-actions">${!x.material?`<button class="secondary" data-create-hint-material="${x.l.id}|${encodeURIComponent(x.hint)}">Im Hub anlegen</button>`:`<button class="text-button" data-material="${x.material.id}">öffnen</button>`}</div></div>`;
}
function lessonProductionRowV12(l){
  const e=scheduleEntityV11(l),coarse=coarsePlanReadyV12(l),concrete=concretePlanReadyV12(l),slides=(l.slides||[]).length,master=!!state.settings.powerPointMasterName;
  return `<div class="production-lesson"><div class="production-main"><span class="prep-date">${esc(fmtDate(l.date))}<small>${esc(l.period||'')}</small></span><div><strong>${esc(e.title)}</strong><small>${esc(l.title||'Thema noch festlegen')}</small></div></div><div class="production-state"><span class="pipeline-chip ${coarse?'ok':'open'}">${coarse?'✓':'○'} Sollplan</span><span class="pipeline-chip ${concrete?'ok':'open'}">${concrete?'✓':'○'} konkret</span><span class="pipeline-chip ${slides?'ok':'open'}">${slides?'✓':'○'} Folienplan</span><span class="pipeline-chip ${l.presentationReady?'ok':'open'}">${l.presentationReady?'✓':'○'} PPT</span></div><div class="production-actions">${!concrete?`<button class="primary" data-copy-concrete-prompt="${l.id}">Prompt kopieren</button><button class="secondary" data-open-import-v12="${l.id}">Antwort importieren</button>`:`<button class="secondary" data-open-import-v12="${l.id}">Planung aktualisieren</button>`}${concrete&&!l.presentationReady?`<button class="${master?'primary':'secondary'}" data-ppt-placeholder="${l.id}">${master?'PowerPoint erzeugen':'PPT-Master fehlt'}</button>`:''}</div></div>`;
}
function weekPrepViewV12(){
  hydrateWeekCoarseMaterialsV12();
  const all=sortedWeekV08(),courses=all.filter(l=>!(l.kind==='group'||l.groupId)),groups=all.filter(l=>l.kind==='group'||l.groupId),ms=weekMaterialSummaryV12();
  const printable=openPrintItems().filter(i=>i.fileReady),concrete=courses.filter(concretePlanReadyV12).length,ppt=courses.filter(l=>l.presentationReady).length;
  if(!state.timetable.length)return `<div class="content-grid"><section class="focus-hero"><div><span class="eyebrow">NOCH NICHT EINGERICHTET</span><h2>Erst den Stundenplan einrichten.</h2></div><button class="primary" data-view="timetable">Stundenplan →</button></section></div>`;
  if(!all.length)return `<div class="content-grid"><section class="focus-hero"><div><span class="eyebrow">KW ${activeWeekNumber()}</span><h2>Woche noch nicht aufgebaut.</h2></div><button class="primary big" data-action="rebuild-week">Woche aufbauen →</button></section></div>`;
  return `<div class="content-grid monday-mode"><section class="weekly-prep-hero"><div><span class="eyebrow">MONTAGSMODUS · KW ${activeWeekNumber()}</span><h2>Erst Material, dann die Stunden konkretisieren.</h2><p>Die Reihenplanung ist dein Soll. Du musst die Themen nicht neu erfinden.</p></div><div class="weekly-score"><strong>${courses.length}</strong><span>Fachstunden</span></div></section>
  <section class="panel monday-step"><div class="section-head"><div><span class="step-number">1</span><span class="eyebrow">WOCHENMATERIAL</span><h2>Was du diese Woche brauchst</h2></div><div><span class="status-counter">${ms.total-ms.unresolved}/${ms.total} geklärt</span></div></div><p class="muted">Diese Liste kommt direkt aus deinen importierten Reihenplanungen. Noch nicht im Hub vorhandene Dateien legst du nur einmal an; danach findet das Cockpit sie wieder.</p><div class="material-week-list">${ms.rows.map(materialStageCardV12).join('')||'<p class="muted">In den Reihenplanungen dieser Woche sind keine Materialhinweise hinterlegt.</p>'}</div><div class="step-actions"><label class="upload-button">Materialordner einlesen<input type="file" id="bulk-material-folder" multiple webkitdirectory directory hidden></label><button class="secondary" data-view="materials">Material-Hub öffnen</button>${printable.length?`<button class="primary" data-action="download-print-zip">Druckpaket (${printable.length}) herunterladen</button>`:''}</div></section>
  <section class="panel monday-step"><div class="section-head"><div><span class="step-number">2</span><span class="eyebrow">KONKRETE PLANUNG</span><h2>ChatGPT plant die einzelnen Stunden</h2></div><span class="status-counter">${concrete}/${courses.length} importiert</span></div><p class="muted">Prompt kopieren → hier im Chat einfügen → meine komplette Antwort zurück ins Cockpit kopieren. Die letzte Reflexion und der Sollplan sind schon im Prompt enthalten.</p><div class="production-list">${courses.map(lessonProductionRowV12).join('')}</div></section>
  <section class="panel monday-step"><div class="section-head"><div><span class="step-number">3</span><span class="eyebrow">POWERPOINT</span><h2>Aus dem Folienplan eine Präsentation machen</h2></div><span class="status-counter">${ppt}/${courses.length} fertig</span></div><div class="ppt-master-box"><div><strong>${state.settings.powerPointMasterName?`Master: ${esc(state.settings.powerPointMasterName)}`:'Noch kein PowerPoint-Master hinterlegt'}</strong><p>${state.settings.powerPointMasterName?'Der Master ist lokal im Browser hinterlegt. Momiji-Regeln und Folientypen sind gemappt.':'Lege deinen Master einmal lokal ab. Er wird nicht zu GitHub hochgeladen.'}</p></div><label class="upload-button">${state.settings.powerPointMasterName?'Master ersetzen':'Master auswählen'}<input type="file" id="ppt-master-upload" accept=".potx,.pptx,application/vnd.openxmlformats-officedocument.presentationml.template,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden></label></div></section>
  ${groups.length?`<section class="panel"><div class="section-head"><div><span class="eyebrow">GA / KLASSENZEIT</span><h2>Separat und kurz</h2></div></div><div class="prep-lesson-table">${groups.map(prepGroupRowV11).join('')}</div></section>`:''}</div>`;
}
weekPrepViewV08=weekPrepViewV12;

function workflowTasksV12(){
  const tasks=[],courses=sortedWeekV08().filter(l=>!(l.kind==='group'||l.groupId)),groups=sortedWeekV08().filter(l=>l.kind==='group'||l.groupId);
  const unresolved=unresolvedMaterialHintsV12();
  if(unresolved.length)tasks.push({id:'week-materials',stage:1,date:activeWeekDate(1),slot:0,type:'materials-week',title:'Wochenmaterial klären',detail:`${unresolved.length} Materialhinweis${unresolved.length===1?'':'e'} noch offen`,why:'Die Themen stehen schon. Kläre zuerst nur die Dateien, die du diese Woche wirklich brauchst.',estimate:15,source:'lesson'});
  const readyPrint=openPrintItems().filter(i=>i.fileReady); if(readyPrint.length)tasks.push({id:'print-week',stage:2,date:activeWeekDate(1),slot:1,type:'print',title:'Wochenkopien erledigen',detail:`${readyPrint.length} druckbereite Position${readyPrint.length===1?'':'en'}`,why:'Alles gesammelt kopieren, bevor du die Stunden im Detail planst.',estimate:20,source:'lesson'});
  courses.forEach(l=>{if(!coarsePlanReadyV12(l))tasks.push({id:`coarse-${l.id}`,stage:0,date:l.date,slot:lessonSlot(l),type:'plan',lessonId:l.id,title:`${lessonWhoV11(l)}: Sollplan fehlt`,detail:fmtDate(l.date),why:'Für diese Stunde fehlt noch die grobe Reihenplanung.',estimate:10,source:'lesson'});else if(!concretePlanReadyV12(l))tasks.push({id:`concrete-${l.id}`,stage:3,date:l.date,slot:lessonSlot(l),type:'concrete',lessonId:l.id,title:`${lessonWhoV11(l)}: konkret planen`,detail:`${fmtDate(l.date)} · ${l.title||''}`,why:'Thema und Hauptmaterial stehen. Jetzt nur noch den ChatGPT-Prompt durchlaufen lassen.',estimate:5,source:'lesson'});else if(!l.presentationReady)tasks.push({id:`ppt-${l.id}`,stage:4,date:l.date,slot:lessonSlot(l),type:'ppt',lessonId:l.id,title:`${lessonWhoV11(l)}: Präsentation erzeugen`,detail:`${(l.slides||[]).length} geplante Folien`,why:'Die konkrete Planung ist importiert. Als Nächstes entsteht daraus die Präsentation.',estimate:5,source:'lesson'});});
  groups.forEach(l=>{if(!groupLessonPlanReadyV11(l))tasks.push({id:`plan-${l.id}`,stage:3,date:l.date,slot:lessonSlot(l),type:'plan',lessonId:l.id,title:`${lessonWhoV11(l)}: kurz planen`,detail:fmtDate(l.date),why:'Für GA reicht ein kurzer Punkt.',estimate:5,source:'lesson'});});
  state.tasks?.filter(t=>!t.done).forEach(t=>tasks.push({id:`general-${t.id}`,stage:generalTaskPriorityV09(t)<0?0:6,date:t.dueDate||'9999-12-31',slot:99,source:'general',generalId:t.id,title:t.title,detail:t.category,why:t.notes||'Zusätzliche Schulaufgabe.',estimate:Number(t.effort)||15}));
  return tasks.sort((a,b)=>a.stage-b.stage||String(a.date).localeCompare(String(b.date))||(a.slot??99)-(b.slot??99));
}
workflowTasks=workflowTasksV12;

function focusViewV12(){
  const tasks=workflowTasksV12(),next=tasks[0],after=tasks.slice(1,4);
  if(!state.timetable.length)return `<div class="content-grid"><section class="focus-hero onboarding-hero"><div><span class="eyebrow">START</span><h2>Einmal sauber einrichten.</h2><p>Danach musst du hier im Normalfall nur noch die eine nächste Aufgabe abarbeiten.</p></div><button class="primary" data-view="timetable">Stundenplan →</button></section></div>`;
  if(!currentWeekLessons().length)return `<div class="content-grid"><section class="focus-hero"><div><span class="eyebrow">KW ${activeWeekNumber()}</span><h2>Woche aufbauen.</h2><p>Die Themen werden aus deiner Reihenplanung vorgeschlagen.</p></div><button class="primary big" data-action="rebuild-week">Woche aufbauen →</button></section></div>`;
  return `<div class="content-grid simplified-focus"><section class="focus-hero ${!next?'all-done':''}"><div>${next?`<span class="eyebrow">JETZT NUR DAS</span><h2>${esc(next.title)}</h2><p>${esc(next.why)}</p><span class="next-meta">${esc(next.detail)} · ca. ${next.estimate||'?'} Min.</span>`:`<span class="eyebrow">FÜR JETZT FERTIG</span><h2>Die Vorbereitung ist abgesichert.</h2><p>Nach dem Unterricht reichen deine kurzen Klick-Reflexionen.</p>`}</div>${next?(next.source==='general'?`<button class="primary big" data-complete-general="${next.generalId}">Erledigt ✓</button>`:`<button class="primary big" data-task="${next.id}">Öffnen →</button>`):'<div class="done-badge">✓</div>'}</section>${after.length?`<section class="panel quiet-next"><div class="section-head"><div><span class="eyebrow">DANACH</span><h2>Nur die nächsten drei</h2></div><button class="text-button" data-view="prep">Montagsmodus</button></div><div class="mini-next-list">${after.map((t,i)=>`<div class="mini-next"><span>${i+2}</span><div><strong>${esc(t.title)}</strong><small>${esc(t.detail)}</small></div></div>`).join('')}</div></section>`:''}</div>`;
}
focusView=focusViewV12;

const handleTaskBeforeV12=handleTask;
handleTask=function(id){const t=workflowTasksV12().find(x=>x.id===id);if(!t)return handleTaskBeforeV12(id);if(t.type==='materials-week'){view='prep';render();return;}if(t.type==='print'){view='print';render();return;}if(t.type==='concrete'){const l=lesson(t.lessonId);navigator.clipboard?.writeText(concretePlanningPromptV12(l));modal={type:'lesson',id:l.id};render();setTimeout(()=>alert('Prompt wurde kopiert. Füge ihn jetzt in ChatGPT ein.'),50);return;}if(t.type==='ppt'){view='prep';render();return;}return handleTaskBeforeV12(id);};

const renderBeforeV12=render;
render=function(){
  const app=document.getElementById('app'),weekNo=activeWeekNumber();
  app.innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">SC</div><div><strong>Schulcockpit</strong><small>${esc(state.settings.schoolYear)} · V0.12.1</small></div></div><nav>${navBtn('focus','✦','Start')}${navBtn('prep','↠','Montagsmodus')}${navBtn('week','▦','Meine Woche')}${navBtn('tasks','✓','Aufgaben & Orga')}${navBtn('sequences','≋','Reihenplanung')}${navBtn('timetable','⌗','Stundenplan')}${navBtn('print','⎙','Kopieren')}${navBtn('materials','▤','Material-Hub')}${navBtn('improve','↗','Verbessern')}${navBtn('setup','◎','Einrichten')}</nav><div class="sidebar-footer"><button data-action="setup-import">Setup importieren</button><button data-action="backup">Backup</button></div></aside><main><header class="topbar"><div><span class="eyebrow">KW ${weekNo} · ${activeWeekLabel()}</span><h1>${pageTitle()}</h1></div><div class="top-actions"><div class="week-switcher"><button data-action="prev-week">←</button><button data-action="planning-week">KW ${weekNo}</button><button data-action="next-week">→</button></div><button class="secondary" data-view="prep">Montagsmodus</button></div></header><div class="page">${viewHtml()}</div></main></div>${modal?modalHtml():''}`;
  wire();
};
pageTitle=function(){return ({focus:'Start',prep:'Montagsmodus',week:'Meine Woche',tasks:'Aufgaben & Orga',sequences:'Reihenplanung',timetable:'Stundenplan',print:'Kopieren',materials:'Material-Hub',improve:'Verbessern',setup:'Einrichten'})[view]||'Schulcockpit';};

const wireBeforeV12=wire;
wire=function(){
  wireBeforeV12();
  document.querySelectorAll('[data-copy-concrete-prompt]').forEach(b=>b.onclick=async()=>{const l=lesson(b.dataset.copyConcretePrompt);const txt=concretePlanningPromptV12(l);try{await navigator.clipboard.writeText(txt);alert('Prompt kopiert. Füge ihn jetzt in ChatGPT ein.');}catch{downloadText(`${l.date}_${lessonWhoV11(l)}_Prompt.md`,txt);alert('Zwischenablage war nicht verfügbar; der Prompt wurde als Datei heruntergeladen.');}});
  document.querySelectorAll('[data-open-import-v12]').forEach(b=>b.onclick=()=>{modal={type:'ai-import',id:b.dataset.openImportV12};render();});
  document.querySelectorAll('[data-create-hint-material]').forEach(b=>b.onclick=()=>{const [lid,enc]=b.dataset.createHintMaterial.split('|'),hint=decodeURIComponent(enc);let m=bestMaterialMatchV12(hint);if(!m){m={id:uid('mat'),title:hint,kind:'file',source:'Reihenplanung',pages:'',tasks:'',variants:[],improvementFlags:[]};state.materials.push(m);standardVariantV12(m);}const l=lesson(lid);if(l&&!l.materials.includes(m.id))l.materials.push(m.id);saveState();modal={type:'material',id:m.id};render();});
  document.getElementById('bulk-material-folder')?.addEventListener('change',async e=>{const files=[...e.target.files];if(!files.length)return;let count=0;for(const file of files){if(file.name.startsWith('.'))continue;const title=file.name.replace(/\.[^.]+$/,'');let m=bestMaterialMatchV12(title);if(!m){m={id:uid('mat'),title,kind:'file',source:file.webkitRelativePath?file.webkitRelativePath.split('/').slice(0,-1).join('/'):'Ordnerimport',pages:'',tasks:'',variants:[],improvementFlags:[]};state.materials.push(m);}const v=standardVariantV12(m);v.available=true;v.fileName=file.name;if(!v.fileKey)v.fileKey=`material-${m.id}-${v.id}`;await fileStorePut(v.fileKey,file);count++;}await refreshStoredFileKeys();hydrateWeekCoarseMaterialsV12();saveState();render();alert(`${count} Datei${count===1?'':'en'} in den Material-Hub übernommen.`);});
  document.getElementById('ppt-master-upload')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;await fileStorePut('__ppt_master__',f);state.settings.powerPointMasterName=f.name;saveState();render();});
  document.querySelectorAll('[data-ppt-placeholder]').forEach(b=>b.onclick=()=>{if(!state.settings.powerPointMasterName)alert('Lege zuerst deinen PowerPoint-Master ab. Der Momiji-Master wird lokal verwendet und nicht zu GitHub hochgeladen.');else alert('Der Master ist hinterlegt. Im nächsten Schritt verdrahte ich seine Folientypen mit dem importierten Folienplan, damit hier eine echte .pptx heruntergeladen wird.');});
};

hydrateWeekCoarseMaterialsV12();view='focus';render();

// ===== V0.12.2: reliable modal closing + honest onboarding/status =====
function importedPlanCountV122(){
  return (state.sequences||[]).reduce((n,q)=>n+(Array.isArray(q.plan)?q.plan.length:0),0);
}
function materialFileCountV122(){
  return [...storedFileKeys].filter(k=>k!=='__ppt_master__').length;
}
function startupStateV122(){
  const timetable=!!(state.timetable||[]).length;
  const plans=importedPlanCountV122()>0;
  const week=currentWeekLessons().length>0;
  const hints=typeof unresolvedMaterialHintsV12==='function'?unresolvedMaterialHintsV12():[];
  const hub=materialFileCountV122()>0 || hints.length===0;
  return {timetable,plans,week,hints,hub};
}
function setupStepV122(done,title,text,buttonHtml=''){
  return `<article class="startup-step ${done?'done':''}"><span class="startup-icon">${done?'✓':'○'}</span><div><strong>${esc(title)}</strong><p>${esc(text)}</p></div>${buttonHtml}</article>`;
}
function focusViewV122(){
  const s=startupStateV122();
  const foundations=s.timetable&&s.plans&&s.week;
  if(!foundations){
    return `<div class="content-grid startup-view">
      <section class="focus-hero onboarding-hero"><div><span class="eyebrow">NOCH EINMALIG EINRICHTEN</span><h2>Das Cockpit ist noch nicht im normalen Arbeitsmodus.</h2><p>Arbeite nur diese Punkte ab. Danach verschwindet diese Ansicht und Start zeigt dir jeweils nur die nächste echte Aufgabe.</p></div></section>
      <section class="panel"><div class="section-head"><div><span class="eyebrow">GRUNDLAGE</span><h2>Was noch fehlt</h2></div></div><div class="startup-list">
        ${setupStepV122(s.timetable,'Stundenplan','Deine echten Wochenstunden müssen hinterlegt sein.',`<button class="secondary" data-view="timetable">Stundenplan</button>`)}
        ${setupStepV122(s.plans,'Reihenplanung','Die groben Soll-Stunden mit Thema und Hauptmaterial müssen importiert sein.',`<button class="secondary" data-view="sequences">Reihenplanung</button>`)}
        ${setupStepV122(s.week,'Aktuelle Woche','Die Wochenstunden werden einmal aus deinem Stundenplan erzeugt und mit der Reihenplanung verknüpft.',`<button class="secondary" data-action="rebuild-week">Woche aufbauen</button>`)}
      </div></section>
      <section class="panel development-status"><div class="section-head"><div><span class="eyebrow">PROJEKTSTATUS</span><h2>Was ich noch fertig bauen muss</h2></div></div><div class="dev-status-list"><div><span>◐</span><div><strong>PowerPoint-Automatik</strong><p>Der echte .pptx-Generator nach deinem Master fehlt noch. Dafür brauche ich einmal deinen PowerPoint-Master hier im Chat.</p></div></div><div><span>◐</span><div><strong>Material-Automatik</strong><p>Material-Hub und Druckpaket existieren, aber die automatische Zuordnung aller vorhandenen Dateien und Druckeinstellungen wird noch verbessert.</p></div></div></div></section>
    </div>`;
  }
  if(!s.hub){
    return `<div class="content-grid startup-view"><section class="focus-hero"><div><span class="eyebrow">NÄCHSTER EINMALIGER SCHRITT</span><h2>Material-Hub füllen</h2><p>Deine Themen stehen bereits. Jetzt müssen die vorhandenen Dateien nur einmal in den lokalen Hub, damit du sie danach nie wieder suchen musst.</p><span class="next-meta">${s.hints.length} Materialhinweis${s.hints.length===1?'':'e'} dieser Woche noch offen</span></div><button class="primary big" data-view="prep">Montagsmodus öffnen →</button></section><section class="tip-card"><strong>Danach</strong><p>Erst wenn die vorhandenen Materialien zugeordnet sind, beginnt der normale Montagsablauf: Kopieren → konkrete Stundenplanung mit ChatGPT → Präsentation.</p></section></div>`;
  }
  return focusViewV12();
}
focusView=focusViewV122;

const renderBeforeV122=render;
render=function(){
  renderBeforeV122();
  const version=document.querySelector('.brand small');
  if(version) version.textContent=`${state.settings.schoolYear} · V0.12.2`;
};

const wireBeforeV122=wire;
wire=function(){
  wireBeforeV122();
  // The previous handler treated the close button as if it were a click inside the modal.
  // Bind a final, explicit close handler after all legacy handlers.
  document.querySelectorAll('[data-action="modal-close"]').forEach(el=>{
    el.onclick=e=>{
      e.preventDefault();
      e.stopPropagation();
      if(el.classList.contains('modal-backdrop') && e.target!==el) return;
      modal=null;
      render();
    };
  });
  document.querySelectorAll('[data-modal-stop]').forEach(el=>{
    el.onclick=e=>e.stopPropagation();
  });
  document.onkeydown=e=>{
    if(e.key==='Escape' && modal){ modal=null; render(); }
  };
};

// Re-render once so the new startup logic and event handlers are active.
render();

// ===== V0.13 – Momiji PowerPoint generator =====
const MOMIJI_V13={
  backgrounds:{
    thema:['H02','H04','H11'],
    topflopTitle:['H01','H02','H05','H06','H07','H11'],
    topflop:['H01','H02','H04','H05','H06','H07'],
    fehler:['H01','H02','H03','H04','H05','H06','H07'],
    text:['H01','H02','H03','H04','H05','H06','H07','H08','H09','H10','H11'],
    bild:['H01','H02','H03','H04','H05','H06','H07','H08','H10','H11'],
    task:['H01','H02','H03','H04','H05','H06','H07','H08','H09','H10','H11'],
    taskSteps:['H01','H02','H04','H05','H06','H07','H08','H09','H10','H11'],
    sicherung:['H01','H02','H03','H04','H05','H06','H07','H08','H09','H10','H11'],
    diskursiv:['H01','H02','H04','H05','H06','H07','H08','H09','H11'],
    exit:['H01','H02','H03','H04','H05','H06','H07','H08','H09','H10','H11']
  }
};
function v13Text(v){return String(v??'');}
function v13Xml(s){return v13Text(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function v13Hash(s){let h=2166136261;for(const ch of v13Text(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function v13Picker(seed){let x=v13Hash(seed)||123456789,prev='';return {pick(list,locked=''){if(locked){prev=locked;return locked;}let pool=list.filter(v=>v!==prev);if(!pool.length)pool=list.slice();x=(Math.imul(x,1664525)+1013904223)>>>0;const v=pool[x%pool.length];prev=v;return v;},previous(){return prev;}};}
function v13NormLayoutName(s){return v13Text(s).replace(/[–—]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();}
function v13SlideKind(sl){
  const t=v13NormLayoutName(sl.type||'');
  if(['moin','start','title slide'].includes(t))return 'moin';
  if(t.includes('thema'))return 'thema';
  if(t.includes('top')&&t.includes('flop'))return 'topflop';
  if(t.includes('fehler'))return 'fehler';
  if(t.includes('bild'))return 'bild';
  if(t.includes('arbeitsauftrag')&&t.includes('schritt'))return 'taskSteps';
  if(t.includes('arbeitsauftrag'))return 'task';
  if(t.includes('diskurs'))return 'diskursiv';
  if(t.includes('sicherung'))return 'sicherung';
  if(t.includes('exit')||t.includes('reflexion'))return 'exit';
  return 'text';
}
function v13DateShort(date){const d=new Date((date||iso(new Date()))+'T12:00:00');return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'}).format(d);}
function v13ShortFooter(l){return (l.footerTopic||l.title||'Unterricht').trim().slice(0,55);}
function v13Lines(a){if(Array.isArray(a))return a.map(v=>v13Text(v).trim()).filter(Boolean);const s=v13Text(a).trim();return s?[s]:[];}
function v13JoinMain(sl){const a=[];if(sl.title)a.push(sl.title);a.push(...v13Lines(sl.content));return a.filter(Boolean);}
function v13Bytes(s){return new TextEncoder().encode(s);}
function v13String(u8){return new TextDecoder('utf-8').decode(u8);}
function v13U16(d,o){return d.getUint16(o,true);} function v13U32(d,o){return d.getUint32(o,true);}
async function v13InflateRaw(data){if(!data?.length)return new Uint8Array();if(!('DecompressionStream' in window))throw new Error('Dieser Browser unterstützt die ZIP-Dekomprimierung nicht. Bitte Safari/Chrome aktuell verwenden.');const ds=new DecompressionStream('deflate-raw');return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer());}
async function v13DeflateRaw(data){if(!data?.length)return new Uint8Array();if(!('CompressionStream' in window))return null;const cs=new CompressionStream('deflate-raw');return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(cs)).arrayBuffer());}
async function v13ZipRead(buf){
  const u=new Uint8Array(buf),dv=new DataView(buf);let e=-1;
  for(let i=u.length-22;i>=Math.max(0,u.length-65557);i--){if(v13U32(dv,i)===0x06054b50){e=i;break;}}
  if(e<0)throw new Error('PowerPoint-Datei ist kein lesbares ZIP/POTX.');
  const count=v13U16(dv,e+10),cdOff=v13U32(dv,e+16);let p=cdOff;const out=new Map();
  for(let i=0;i<count;i++){
    if(v13U32(dv,p)!==0x02014b50)throw new Error('ZIP-Verzeichnis ist beschädigt.');
    const method=v13U16(dv,p+10),csize=v13U32(dv,p+20),usize=v13U32(dv,p+24),nl=v13U16(dv,p+28),xl=v13U16(dv,p+30),cl=v13U16(dv,p+32),local=v13U32(dv,p+42);
    const name=v13String(u.slice(p+46,p+46+nl));const lnl=v13U16(dv,local+26),lxl=v13U16(dv,local+28),start=local+30+lnl+lxl,comp=u.slice(start,start+csize);let data;
    if(method===0)data=comp;else if(method===8)data=await v13InflateRaw(comp);else throw new Error(`ZIP-Kompressionsart ${method} wird nicht unterstützt.`);
    if(usize && data.length!==usize)console.warn('ZIP-Größe abweichend',name,usize,data.length);
    out.set(name,data);p+=46+nl+xl+cl;
  }
  return out;
}
const V13_CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
function v13Crc(data){let c=0xffffffff;for(const b of data)c=V13_CRC_TABLE[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function v13Concat(parts){const len=parts.reduce((n,p)=>n+p.length,0),o=new Uint8Array(len);let at=0;for(const p of parts){o.set(p,at);at+=p.length;}return o;}
function v13Dos(){const d=new Date(),year=Math.max(1980,d.getFullYear());return {date:((year-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate(),time:(d.getHours()<<11)|(d.getMinutes()<<5)|Math.floor(d.getSeconds()/2)};}
function v13WriteU16(a,o,v){a[o]=v&255;a[o+1]=(v>>>8)&255;}function v13WriteU32(a,o,v){a[o]=v&255;a[o+1]=(v>>>8)&255;a[o+2]=(v>>>16)&255;a[o+3]=(v>>>24)&255;}
async function v13ZipWrite(entries){
  const locals=[],centrals=[];let offset=0;const dt=v13Dos();
  for(const [name,data0] of entries){const nameB=v13Bytes(name),data=data0 instanceof Uint8Array?data0:new Uint8Array(data0);let method=0,body=data;const comp=await v13DeflateRaw(data);if(comp&&comp.length<data.length){method=8;body=comp;}const crc=v13Crc(data);
    const lh=new Uint8Array(30+nameB.length);v13WriteU32(lh,0,0x04034b50);v13WriteU16(lh,4,20);v13WriteU16(lh,6,0x0800);v13WriteU16(lh,8,method);v13WriteU16(lh,10,dt.time);v13WriteU16(lh,12,dt.date);v13WriteU32(lh,14,crc);v13WriteU32(lh,18,body.length);v13WriteU32(lh,22,data.length);v13WriteU16(lh,26,nameB.length);lh.set(nameB,30);locals.push(lh,body);
    const ch=new Uint8Array(46+nameB.length);v13WriteU32(ch,0,0x02014b50);v13WriteU16(ch,4,20);v13WriteU16(ch,6,20);v13WriteU16(ch,8,0x0800);v13WriteU16(ch,10,method);v13WriteU16(ch,12,dt.time);v13WriteU16(ch,14,dt.date);v13WriteU32(ch,16,crc);v13WriteU32(ch,20,body.length);v13WriteU32(ch,24,data.length);v13WriteU16(ch,28,nameB.length);v13WriteU32(ch,42,offset);ch.set(nameB,46);centrals.push(ch);offset+=lh.length+body.length;
  }
  const central=v13Concat(centrals),local=v13Concat(locals),e=new Uint8Array(22);v13WriteU32(e,0,0x06054b50);v13WriteU16(e,8,entries.length);v13WriteU16(e,10,entries.length);v13WriteU32(e,12,central.length);v13WriteU32(e,16,local.length);return new Blob([local,central,e],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
}
function v13LayoutMap(entries){const map=new Map();for(const [name,data] of entries){const m=name.match(/^ppt\/slideLayouts\/slideLayout(\d+)\.xml$/);if(!m)continue;const xml=v13String(data),nm=(xml.match(/<p:cSld[^>]*\bname="([^"]+)"/)||[])[1];if(nm)map.set(v13NormLayoutName(nm),Number(m[1]));}return map;}
function v13FindLayout(map,label){const key=v13NormLayoutName(label);if(map.has(key))return map.get(key);for(const [k,v] of map)if(k===key||k.startsWith(key))return v;throw new Error(`Layout fehlt im Master: ${label}`);}
function v13Ph(idx,text,type=''){return {idx:Number(idx),text:v13Lines(text),type};}
function v13Paras(lines){const a=v13Lines(lines);return (a.length?a:['']).map(t=>`<a:p>${t?`<a:r><a:rPr lang="de-DE"/><a:t>${v13Xml(t)}</a:t></a:r>`:''}<a:endParaRPr lang="de-DE"/></a:p>`).join('');}
function v13PlaceholderXml(id,ph){return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Placeholder ${id}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph${ph.type?` type="${v13Xml(ph.type)}"`:''} idx="${ph.idx}"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${v13Paras(ph.text)}</p:txBody></p:sp>`;}
function v13ManualTextXml(id,box,lines,size=1800){const [x,y,cx,cy]=box;return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Generated Text ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${v13Lines(lines).map(t=>`<a:p><a:r><a:rPr lang="de-DE" sz="${size}"/><a:t>${v13Xml(t)}</a:t></a:r><a:endParaRPr lang="de-DE" sz="${size}"/></a:p>`).join('')}</p:txBody></p:sp>`;}
function v13PicXml(id,rid,idx=13){return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Bildimpuls"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr><p:ph type="pic" idx="${idx}"/></p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;}
function v13SlideXml(placeholders=[],manual=[],picRid=''){let id=2,shapes='';for(const ph of placeholders)shapes+=v13PlaceholderXml(id++,ph);for(const m of manual)shapes+=v13ManualTextXml(id++,m.box,m.text,m.size);if(picRid)shapes+=v13PicXml(id++,picRid,13);return v13Bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);}
function v13SlideRels(layoutNum,imageTarget=''){let rel=`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${layoutNum}.xml"/>`;if(imageTarget)rel+=`<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${v13Xml(imageTarget)}"/>`;return v13Bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel}</Relationships>`);}
function v13BasePh(l,n){return [v13Ph(3,v13ShortFooter(l),'ftr'),v13Ph(10,v13DateShort(l.date),'dt'),v13Ph(4,String(n),'sldNum')];}
async function v13ResolveImage(sl){if(!sl.imageMaterial)return null;const m=bestMaterialMatchV12(sl.imageMaterial);if(!m)return null;const v=(m.variants||[]).find(x=>x.fileKey&&hasStoredFile(x));if(!v)return null;const rec=await fileStoreGet(v.fileKey);if(!rec)return null;const ext=(rec.name.match(/\.([A-Za-z0-9]+)$/)||[])[1]?.toLowerCase();if(!['png','jpg','jpeg'].includes(ext))return null;return {bytes:new Uint8Array(await rec.blob.arrayBuffer()),ext:ext==='jpeg'?'jpg':ext,name:rec.name};}
function v13LayoutLabel(kind,h){return ({thema:'Thema',topflopTitle:'Top/Flop Titel',topflopTask:'Top/Flop Aufgabe',topflopTop:'Top/Flop Top',topflopFlop:'Top/Flop Flop',fehler:'Fehlerdetektiv',text:'Textfeld',bild:'Bildimpuls',task:'Arbeitsauftrag',taskSteps:'Arbeitsauftrag Schritte',sicherung:'Sicherung',diskursiv:'Sicherung diskursiv',exit:'Exit'})[kind]+` - ${h}`;}
function v13ManualDisk(sl){return [
  {box:[1250000,1350000,4300000,2700000],text:sl.solutionA||[]},
  {box:[6900000,1350000,4200000,2700000],text:sl.solutionB||[]},
  {box:[1000000,5000000,3900000,900000],text:sl.comparison||[] ,size:1500},
  {box:[6900000,4800000,3900000,1100000],text:sl.takeaway||[] ,size:1500}
].filter(x=>v13Lines(x.text).length);}
async function v13PhysicalSlides(l,layoutMap){
  const picker=v13Picker(`${l.id}|${l.date}|${l.title}`),out=[];let prevTF=false;
  out.push({layout:v13FindLayout(layoutMap,'Title Slide'),ph:[v13Ph(1,l.title||v13ShortFooter(l),'subTitle')]});
  for(const sl of (l.slides||[])){
    const kind=v13SlideKind(sl);if(kind==='moin')continue;
    if(kind==='topflop'){
      if(!prevTF){const h=picker.pick(MOMIJI_V13.backgrounds.topflopTitle);out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('topflopTitle',h)),ph:[]});}
      const h=picker.pick(MOMIJI_V13.backgrounds.topflop);const statement=sl.statement||sl.title||v13Lines(sl.content)[0]||'';if(!statement)continue;
      out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('topflopTask',h)),ph:[v13Ph(11,statement)]});
      const top=(sl.answer||sl.notes||'').toLowerCase().includes('top')||['richtig','true','wahr'].includes((sl.answer||'').toLowerCase());
      out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel(top?'topflopTop':'topflopFlop',h)),ph:[v13Ph(11,statement),...(!top&&sl.correction?[v13Ph(12,sl.correction)]:[])]});prevTF=true;continue;
    }
    prevTF=false;
    if(kind==='thema'){const h=picker.pick(MOMIJI_V13.backgrounds.thema),main=v13JoinMain(sl);out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('thema',h)),ph:[v13Ph(11,sl.title||l.title),v13Ph(13,main.slice(1))]});continue;}
    if(kind==='fehler'){const h=picker.pick(MOMIJI_V13.backgrounds.fehler);out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('fehler',h)),ph:[v13Ph(11,v13JoinMain(sl))]});continue;}
    if(kind==='bild'){const h=picker.pick(MOMIJI_V13.backgrounds.bild),img=await v13ResolveImage(sl);if(!img)throw new Error(`Bildimpuls „${sl.title||sl.imageMaterial||'ohne Titel'}“ braucht ein PNG/JPG im Material-Hub. Verknüpfter Name: ${sl.imageMaterial||'fehlt'}`);out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('bild',h)),ph:[],image:img});continue;}
    if(kind==='task'){const h=picker.pick(MOMIJI_V13.backgrounds.task),task=v13JoinMain(sl);out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('task',h)),ph:[v13Ph(13,task,'body'),v13Ph(14,sl.socialForm),v13Ph(15,sl.time),v13Ph(16,sl.material)]});continue;}
    if(kind==='taskSteps'){const h=picker.pick(MOMIJI_V13.backgrounds.taskSteps),steps=(sl.steps?.length?sl.steps:v13JoinMain(sl)).slice(0,4),ph=[];steps.forEach((x,i)=>ph.push(v13Ph(13+i,x,'body')));ph.push(v13Ph(17,sl.socialForm),v13Ph(18,sl.time),v13Ph(19,sl.material));out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('taskSteps',h)),ph});continue;}
    if(kind==='sicherung'){const h=picker.pick(MOMIJI_V13.backgrounds.sicherung);out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('sicherung',h)),ph:[v13Ph(13,v13JoinMain(sl),'body'),v13Ph(14,sl.secondary,'body'),v13Ph(15,sl.tertiary,'body')]});continue;}
    if(kind==='diskursiv'){const h=picker.pick(MOMIJI_V13.backgrounds.diskursiv);out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('diskursiv',h)),ph:[],manual:v13ManualDisk(sl)});continue;}
    if(kind==='exit'){const h=picker.pick(MOMIJI_V13.backgrounds.exit);out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('exit',h)),ph:[v13Ph(13,v13JoinMain(sl),'body'),v13Ph(14,sl.tertiary,'body')]});continue;}
    const h=picker.pick(MOMIJI_V13.backgrounds.text);out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('text',h)),ph:[v13Ph(11,v13JoinMain(sl))]});
  }
  out.forEach((s,i)=>{if(i===0)return;s.ph=[...v13BasePh(l,i+1),...(s.ph||[])];});return out;
}
function v13ReplacePresentation(entries,count){
  const parser=new DOMParser(),ser=new XMLSerializer();
  const pDoc=parser.parseFromString(v13String(entries.get('ppt/presentation.xml')),'application/xml'),ns='http://schemas.openxmlformats.org/presentationml/2006/main',rns='http://schemas.openxmlformats.org/officeDocument/2006/relationships';let lst=pDoc.getElementsByTagNameNS(ns,'sldIdLst')[0];if(!lst){lst=pDoc.createElementNS(ns,'p:sldIdLst');pDoc.documentElement.appendChild(lst);}while(lst.firstChild)lst.removeChild(lst.firstChild);for(let i=0;i<count;i++){const el=pDoc.createElementNS(ns,'p:sldId');el.setAttribute('id',String(256+i));el.setAttributeNS(rns,'r:id',`rIdSlide${i+1}`);lst.appendChild(el);}entries.set('ppt/presentation.xml',v13Bytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+ser.serializeToString(pDoc)));
  const relDoc=parser.parseFromString(v13String(entries.get('ppt/_rels/presentation.xml.rels')),'application/xml'),rels='http://schemas.openxmlformats.org/package/2006/relationships';[...relDoc.getElementsByTagNameNS(rels,'Relationship')].forEach(el=>{if((el.getAttribute('Type')||'').endsWith('/slide'))el.remove();});for(let i=0;i<count;i++){const el=relDoc.createElementNS(rels,'Relationship');el.setAttribute('Id',`rIdSlide${i+1}`);el.setAttribute('Type','http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide');el.setAttribute('Target',`slides/slide${i+1}.xml`);relDoc.documentElement.appendChild(el);}entries.set('ppt/_rels/presentation.xml.rels',v13Bytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+ser.serializeToString(relDoc)));
  const ctDoc=parser.parseFromString(v13String(entries.get('[Content_Types].xml')),'application/xml'),ct='http://schemas.openxmlformats.org/package/2006/content-types';[...ctDoc.getElementsByTagNameNS(ct,'Override')].forEach(el=>{const part=el.getAttribute('PartName')||'';if(part.startsWith('/ppt/slides/slide'))el.remove();if(part==='/ppt/presentation.xml')el.setAttribute('ContentType','application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml');});for(let i=0;i<count;i++){const el=ctDoc.createElementNS(ct,'Override');el.setAttribute('PartName',`/ppt/slides/slide${i+1}.xml`);el.setAttribute('ContentType','application/vnd.openxmlformats-officedocument.presentationml.slide+xml');ctDoc.documentElement.appendChild(el);}entries.set('[Content_Types].xml',v13Bytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+ser.serializeToString(ctDoc)));
}
async function generateMomijiPptV13(l){
  const rec=await fileStoreGet('__ppt_master__');if(!rec?.blob)throw new Error('PowerPoint-Master fehlt. Im Montagsmodus einmal „Master auswählen“ anklicken.');
  const entries=await v13ZipRead(await rec.blob.arrayBuffer()),layoutMap=v13LayoutMap(entries);if(layoutMap.size<100)throw new Error(`Im Master wurden nur ${layoutMap.size} Layouts gefunden. Erwartet wird dein Momiji-Master mit über 100 Layouts.`);
  const physical=await v13PhysicalSlides(l,layoutMap);if(physical.length<1)throw new Error('Keine Folien zum Erzeugen vorhanden.');
  for(const key of [...entries.keys()])if(/^ppt\/slides\//.test(key))entries.delete(key);
  let imageCounter=1;
  for(let i=0;i<physical.length;i++){
    const s=physical[i];let imageTarget='';if(s.image){imageTarget=`sc_generated_${imageCounter++}.${s.image.ext}`;entries.set(`ppt/media/${imageTarget}`,s.image.bytes);}
    entries.set(`ppt/slides/slide${i+1}.xml`,v13SlideXml(s.ph||[],s.manual||[],imageTarget?'rId2':''));entries.set(`ppt/slides/_rels/slide${i+1}.xml.rels`,v13SlideRels(s.layout,imageTarget));
  }
  v13ReplacePresentation(entries,physical.length);
  const blob=await v13ZipWrite([...entries.entries()]);const c=cls(l.classId),name=safeName(`${l.date}_${c?.subject||''}_${c?.name||''}_${l.footerTopic||l.title||'Unterricht'}`)+'.pptx';downloadBlob(name,blob);l.presentationReady=true;l.presentationFileName=name;l.presentationGeneratedAt=new Date().toISOString();saveState();render();return name;
}
function v13PowerPointRuleSummary(){return `<div class="ppt-rule-grid"><span>✓ Moin-Folie automatisch zuerst</span><span>✓ Footer = Kurzthema</span><span>✓ Hintergründe gemischt</span><span>✓ Top/Flop: Titel vor jedem Block</span><span>✓ Aufgabe + Ergebnis gleicher Hintergrund</span><span>✓ Arbeitsauftrag vs. Schritte getrennt</span></div>`;}

const concretePlanningPromptV12BeforeV13=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
  const base=concretePlanningPromptV12BeforeV13(l).split('Danach hänge GENAU EINEN maschinenlesbaren Block an:')[0];
  return `${base}## PowerPoint-Regeln für den Rückimport\nDas Schulcockpit erzeugt die Präsentation direkt aus meinem Momiji-Master. Verwende deshalb semantische Folientypen. Die Moin-Folie wird automatisch erzeugt. Top/Flop-Titelfolie und die Ergebnisfolie werden ebenfalls automatisch aus jeder Top/Flop-Aussage erzeugt.\n- \"text\": allgemeine Frage / einzelner Impuls / freier Text\n- \"topflop\": Aussage mit answer=\"top\" oder \"flop\"; bei flop zusätzlich correction\n- \"bildimpuls\": benötigt imageMaterial = exakter Materialtitel eines PNG/JPG im Material-Hub\n- \"fehlerdetektiv\": Fehleraufgabe\n- \"arbeitsauftrag\": einfacher Auftrag; socialForm, time, material ausfüllen\n- \"arbeitsauftrag_schritte\": bis zu vier getrennte steps; socialForm, time, material ausfüllen\n- \"sicherung\": Hauptinhalt in content; Besonders wichtig in secondary; offene Fragen in tertiary\n- \"sicherung_diskursiv\": solutionA, solutionB, comparison, takeaway\n- \"exit\": Exit Ticket in content; Ausblick/Nächstes Mal in tertiary\n- \"thema\": nur wenn eine zusätzliche Themenfolie didaktisch sinnvoll ist; nicht standardmäßig\n\nDer lesson.footer soll das heutige Thema in sehr kurzer Form (ca. 2–6 Wörter) enthalten.\n\nDanach hänge GENAU EINEN maschinenlesbaren Block an:\n<SCHULCOCKPIT_IMPORT>\n{\n  \"schema\":\"schulcockpit.lesson.v3\",\n  \"lesson\":{\"title\":\"...\",\"objective\":\"...\",\"footer\":\"kurzes heutiges Thema\"},\n  \"phases\":[{\"phase\":\"Einstieg\",\"minutes\":10,\"title\":\"...\",\"details\":\"...\"}],\n  \"slides\":[\n    {\"type\":\"text\",\"title\":\"Impulsfrage\",\"content\":[]},\n    {\"type\":\"topflop\",\"statement\":\"...\",\"answer\":\"top\",\"correction\":\"\"},\n    {\"type\":\"arbeitsauftrag\",\"title\":\"...\",\"content\":[\"...\"],\"socialForm\":\"EA\",\"time\":\"15 Min.\",\"material\":\"AB ...\"},\n    {\"type\":\"arbeitsauftrag_schritte\",\"steps\":[\"1. ...\",\"2. ...\"],\"socialForm\":\"EA\",\"time\":\"20 Min.\",\"material\":\"AH / Buch / Zusatz\"},\n    {\"type\":\"sicherung\",\"content\":[\"...\"],\"secondary\":[\"...\"],\"tertiary\":[]},\n    {\"type\":\"exit\",\"content\":[\"...\"],\"tertiary\":[\"...\"]}\n  ],\n  \"materials\":[{\"title\":\"...\",\"kind\":\"file\",\"variant\":\"standard\",\"copies\":${Number(cls(l.classId)?.students)||0},\"printMode\":\"bw\",\"alreadyPrinted\":false,\"note\":\"\"}],\n  \"prepTasks\":[]\n}\n</SCHULCOCKPIT_IMPORT>\n\nBestehende Materialtitel möglichst exakt wiederverwenden. Keine künstlichen Zusatzfolien erzeugen. Für normale Fragen/Impulse reicht \"text\".`;
};

const weekPrepViewV12BeforeV13=weekPrepViewV12;
weekPrepViewV12=function(){let html=weekPrepViewV12BeforeV13();html=html.replace(/Der Master ist lokal im Browser hinterlegt\.[^<]*/g,'Der Master ist lokal im Browser hinterlegt. Die Momiji-Regeln sind aktiv.');html=html.replace('</div></section>\n  </div>`','</div></section></div>`');return html;};

const wireBeforeV13=wire;
wire=function(){
  wireBeforeV13();
  const master=document.getElementById('ppt-master-upload');if(master){master.accept='.potx,.pptx,application/vnd.openxmlformats-officedocument.presentationml.template,application/vnd.openxmlformats-officedocument.presentationml.presentation';}
  document.querySelectorAll('[data-ppt-placeholder]').forEach(b=>{b.onclick=async()=>{const l=lesson(b.dataset.pptPlaceholder);if(!state.settings.powerPointMasterName){alert('Lege zuerst deinen Momiji-PowerPoint-Master im Montagsmodus ab.');return;}if(!(l?.slides||[]).length){alert('Für diese Stunde gibt es noch keinen importierten Folienplan. Erst ChatGPT-Planung importieren.');return;}const old=b.textContent;b.disabled=true;b.textContent='PowerPoint wird erzeugt …';try{const name=await generateMomijiPptV13(l);alert(`Fertig: ${name}`);}catch(err){console.error(err);alert(`PowerPoint konnte nicht erzeugt werden:\n${err.message||err}`);b.disabled=false;b.textContent=old;}};});
};

const renderBeforeV13=render;
render=function(){renderBeforeV13();const version=document.querySelector('.brand small');if(version)version.textContent=`${state.settings.schoolYear} · V0.13.0`;const masterBox=document.querySelector('.ppt-master-box');if(masterBox&&!masterBox.querySelector('.ppt-rule-grid'))masterBox.insertAdjacentHTML('afterend',v13PowerPointRuleSummary());};

render();

// ===== V0.14 – guided weekly workflow + sane resource model =====
let wizardV14={lessonId:null,step:1,raw:'',parsed:null};

function resourceKeyV14(h){return normalizeHintV12(h);}
function cleanResourceHintV14(s){
  return String(s||'').replace(/^[-•]\s*/,'').replace(/^\(+/,'').replace(/\)+$/,'').trim();
}
function rawResourceLinesV14(l){
  const raw=String(l?.planReference?.material||'');
  const lines=raw.split(/\r?\n|\s+\+\s+/).map(cleanResourceHintV14).filter(Boolean);
  return lines.filter(x=>{
    const s=x.toLowerCase().replace(/\s+/g,' ').trim();
    if(!s)return false;
    if(/^material\s*:\s*(auswahl aus|auswahl|)?\s*\.?…?$/i.test(x))return false;
    if(/^auswahl aus\s*\.?…?$/i.test(x))return false;
    if(/^(ku|ea|pa|ug|ga)(\s*[/,+→-]\s*(ku|ea|pa|ug|ga))*$/i.test(x.replace(/\s+/g,'')))return false;
    if(/^(ku|ea|pa|ug|ga)\s*\/\s*(ku|ea|pa|ug|ga)/i.test(x))return false;
    return true;
  });
}
function inferredResourceTypeV14(h){
  const s=String(h||'').toLowerCase();
  if(!s)return 'ignore';
  if(/^(ku|ea|pa|ug|ga)(\s*[/,+→-]\s*(ku|ea|pa|ug|ga))*$/i.test(String(h).replace(/\s+/g,'')))return 'ignore';
  if(/powerpoint|pptx?|präsentation|praesentation|video|film|youtube|bildimpuls|audio|genially|kahoot/.test(s))return 'digital';
  if(/^(ab\b|arbeitsblatt\b|förderblatt\b|foerderblatt\b|hilfekarte\b|karten?\b|mind[- ]?map\b|lerntempoduett\b|interview\b|zeitstrahl\b|rätsel\b|raetsel\b|quiz\b)/i.test(String(h)) || /\b(pdf|docx?|arbeitsblatt|förderblatt|foerderblatt)\b/.test(s))return 'print';
  if(/\barbeitsheft\b|^ah\b|\bbuch\b|schnittpunkt\s*\d|mathe live|\bs\.\s*\d|\bseite\s*\d|\bs,\s*\d/.test(s))return 'reference';
  if(/folie|tafelbild/.test(s))return 'digital';
  return 'print';
}
function resourceTypeV14(l,h){
  const k=resourceKeyV14(h);return l?.resourceOverrides?.[k]||inferredResourceTypeV14(h);
}
function setResourceTypeV14(l,h,type){l.resourceOverrides=l.resourceOverrides||{};l.resourceOverrides[resourceKeyV14(h)]=type;}
function lessonResourcesV14(l){
  return rawResourceLinesV14(l).map(h=>{
    const type=resourceTypeV14(l,h),m=bestMaterialMatchV12(h),v=m?standardVariantV12(m):null;
    return {hint:h,type,material:m,variant:v,fileReady:!!(v&&hasStoredFile(v))};
  }).filter(r=>r.type!=='ignore');
}
function printableResourcesV14(l){return lessonResourcesV14(l).filter(r=>r.type==='print');}
function missingPrintableResourcesV14(l){return printableResourcesV14(l).filter(r=>!r.material||!r.fileReady);}
function allWeekPrintResourcesV14(){return sortedWeekV08().filter(l=>!(l.kind==='group'||l.groupId)).flatMap(l=>printableResourcesV14(l).map(r=>({l,...r})));}
function missingWeekPrintResourcesV14(){return allWeekPrintResourcesV14().filter(r=>!r.material||!r.fileReady);}
function lessonPrintReadyV14(l){return missingPrintableResourcesV14(l).length===0;}
function courseLessonsV14(){return sortedWeekV08().filter(l=>!(l.kind==='group'||l.groupId));}
function fmtDayV14(date){const d=new Date(date+'T12:00:00');return new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'}).format(d);}
function whoV14(l){const c=cls(l.classId);return `${c?.subject||''} ${c?.name||''}`.trim();}
function ensureCoarsePrintPlansV14(l){
  printableResourcesV14(l).forEach(r=>{
    if(!r.material||!r.variant)return;
    if(!l.materials.includes(r.material.id))l.materials.push(r.material.id);
    const p=ensurePlan(l,r.material.id,r.variant.id);
    if(!p._v14init){p.needed=true;p.count=Number(cls(l.classId)?.students)||0;p.mode=p.mode||'bw';p._v14init=true;}
  });
}
function hydrateWeekResourcesV14(){
  courseLessonsV14().forEach(l=>{
    // Remove only old automatically-created coarse print jobs that are now correctly
    // recognized as book/workbook/digital references. Explicit AI-imported print jobs stay intact.
    const nonPrint=lessonResourcesV14(l).filter(r=>r.type!=='print').map(r=>normalizeHintV12(r.hint));
    (l.printPlan||[]).forEach(p=>{
      if(!p._coarseInitialized)return;
      const m=mat(p.materialId);if(!m)return;
      const mn=normalizeHintV12(m.title);
      if(nonPrint.some(n=>n===mn || (n.includes(mn)&&mn.length>5) || (mn.includes(n)&&n.length>5)))p.needed=false;
    });
    ensureCoarsePrintPlansV14(l);
  });
  saveState();
}

function resourceBadgeV14(r){
  const labels={print:'Druckdatei',reference:'Buch / Arbeitsheft',digital:'digital'};
  return `<span class="resource-type ${r.type}">${labels[r.type]||r.type}</span>`;
}
function resourceRowV14(l,r,compact=false){
  const key=encodeURIComponent(r.hint);
  const stateText=r.type==='print'?(r.fileReady?'Datei ✓':r.material?'Datei fehlt':'noch nicht zugeordnet'):(r.type==='reference'?'kein Upload / kein Kopieren':'kein Ausdruck nötig');
  const action=r.type==='print'&&!r.fileReady?`<label class="upload-button small-upload">Datei zuordnen<input type="file" data-v14-resource-upload="${l.id}|${key}" hidden></label>`:'';
  return `<div class="resource-row-v14 ${r.type} ${r.type==='print'&&!r.fileReady?'needs':''}"><div>${resourceBadgeV14(r)}<strong>${esc(r.hint)}</strong><small>${esc(stateText)}</small></div><div class="resource-actions-v14">${action}<select data-v14-resource-type="${l.id}|${key}" aria-label="Materialtyp"><option value="print" ${r.type==='print'?'selected':''}>Druckdatei</option><option value="reference" ${r.type==='reference'?'selected':''}>Buch / AH</option><option value="digital" ${r.type==='digital'?'selected':''}>digital</option><option value="ignore">ignorieren</option></select></div></div>`;
}
function lessonMaterialCardV14(l){
  const rs=lessonResourcesV14(l),print=rs.filter(r=>r.type==='print'),refs=rs.filter(r=>r.type==='reference'),digital=rs.filter(r=>r.type==='digital'),missing=print.filter(r=>!r.fileReady);
  return `<article class="lesson-material-card-v14 ${missing.length?'needs':'ready'}"><header><div><span>${esc(fmtDayV14(l.date))}</span><strong>${esc(whoV14(l))}</strong><small>${esc(l.title||l.planReference?.title||'')}</small></div><span class="material-card-state">${missing.length?`${missing.length} Druckdatei${missing.length===1?'':'en'} offen`:'✓ Druckmaterial geklärt'}</span></header>${print.length?`<div class="resource-group-v14"><h4>Zum Kopieren</h4>${print.map(r=>resourceRowV14(l,r,true)).join('')}</div>`:''}${refs.length?`<div class="resource-group-v14 references"><h4>Die Schüler:innen verwenden</h4>${refs.map(r=>`<div class="reference-line-v14">${resourceBadgeV14(r)}<span>${esc(r.hint)}</span></div>`).join('')}</div>`:''}${digital.length?`<div class="resource-group-v14 references"><h4>Digital / anzeigen</h4>${digital.map(r=>`<div class="reference-line-v14">${resourceBadgeV14(r)}<span>${esc(r.hint)}</span></div>`).join('')}</div>`:''}${!rs.length?'<p class="muted">Kein zusätzliches Material in der Reihenplanung eingetragen.</p>':''}</article>`;
}
function weekPreparationStageV14(){
  hydrateWeekResourcesV14();
  const courses=courseLessonsV14();
  const missing=missingWeekPrintResourcesV14();
  const openPrint=openPrintItems().filter(i=>i.fileReady&&!i.plan.alreadyPrinted);
  const unfinished=courses.find(l=>!concretePlanReadyV12(l)||!l.presentationReady);
  if(missing.length)return {step:1,title:'Druckmaterial zuordnen',detail:`${missing.length} Datei${missing.length===1?'':'en'} fehlen noch`,action:'prep'};
  if(openPrint.length)return {step:2,title:'Wochenkopien drucken',detail:`${openPrint.length} Position${openPrint.length===1?'':'en'} sind druckbereit`,action:'prep'};
  if(unfinished)return {step:3,title:`${whoV14(unfinished)} vorbereiten`,detail:`${fmtDayV14(unfinished.date)} · ${unfinished.title||''}`,action:'assistant',lessonId:unfinished.id};
  return {step:4,title:'Wochenvorbereitung fertig',detail:'Material, Planung und PowerPoints sind erledigt.',action:'done'};
}
function focusViewV14(){
  if(!state.timetable.length)return `<div class="content-grid"><section class="focus-hero"><div><span class="eyebrow">NOCH EINMALIG</span><h2>Stundenplan einrichten</h2><p>Danach führt dich das Cockpit durch die Wochenvorbereitung.</p></div><button class="primary big" data-view="timetable">Stundenplan →</button></section></div>`;
  if(!currentWeekLessons().length)return `<div class="content-grid"><section class="focus-hero"><div><span class="eyebrow">DIESE WOCHE</span><h2>Woche aus Stundenplan aufbauen</h2></div><button class="primary big" data-action="rebuild-week">Woche aufbauen →</button></section></div>`;
  const s=weekPreparationStageV14(),courses=courseLessonsV14(),planned=courses.filter(concretePlanReadyV12).length,ppts=courses.filter(l=>l.presentationReady).length,printed=openPrintItems().filter(i=>!i.plan.alreadyPrinted).length===0;
  const button=s.action==='prep'?`<button class="primary big" data-view="prep">Weiter →</button>`:s.action==='assistant'?`<button class="primary big" data-start-wizard="${s.lessonId}">Stunde vorbereiten →</button>`:'';
  return `<div class="content-grid focus-v14"><section class="focus-hero"><div><span class="eyebrow">DEIN NÄCHSTER SCHRITT · ${s.step}/3</span><h2>${esc(s.title)}</h2><p>${esc(s.detail)}</p></div>${button||'<div class="done-badge">✓</div>'}</section><section class="panel workflow-map-v14"><div class="section-head"><div><span class="eyebrow">WOCHENABLAUF</span><h2>Du musst dir die Reihenfolge nicht merken.</h2></div></div><div class="workflow-steps-v14"><div class="${s.step>1?'done':s.step===1?'active':''}"><span>1</span><strong>Material & Kopien</strong><small>${missingWeekPrintResourcesV14().length?'Dateien zuordnen':printed?'fertig':'drucken'}</small></div><div class="${s.step>2?'done':s.step===2||s.step===3?'active':''}"><span>2</span><strong>Stunden mit ChatGPT planen</strong><small>${planned}/${courses.length} importiert</small></div><div class="${s.step>3?'done':s.step===3?'active':''}"><span>3</span><strong>PowerPoints erzeugen</strong><small>${ppts}/${courses.length} fertig</small></div></div></section>${state.tasks?.filter(t=>!t.done).length?`<section class="tip-card"><strong>${state.tasks.filter(t=>!t.done).length} andere Schulaufgaben offen</strong><p>Die bleiben unter „Aufgaben & Orga“. Sie ändern diesen Unterrichts-Workflow nicht.</p></section>`:''}</div>`;
}
focusView=focusViewV14;

function coursePrepRowV14(l){
  const concrete=concretePlanReadyV12(l),ppt=!!l.presentationReady,rs=lessonResourcesV14(l),missing=rs.filter(r=>r.type==='print'&&!r.fileReady).length;
  return `<article class="course-prep-card-v14"><div class="course-prep-info-v14"><span>${esc(fmtDayV14(l.date))} · ${esc(l.period||'')}</span><strong>${esc(whoV14(l))}</strong><small>${esc(l.title||l.planReference?.title||'Thema aus Reihenplanung')}</small></div><div class="course-prep-status-v14"><span class="${missing?'warn':'ok'}">${missing?`${missing} Material offen`:'Material ✓'}</span><span class="${concrete?'ok':''}">${concrete?'Planung ✓':'konkret planen'}</span><span class="${ppt?'ok':''}">${ppt?'PPT ✓':'PPT offen'}</span></div><button class="primary" data-start-wizard="${l.id}">${esc(whoV14(l))} · ${esc(fmtDayV14(l.date))} vorbereiten →</button></article>`;
}
function weekPrepViewV14(){
  hydrateWeekResourcesV14();const all=sortedWeekV08(),courses=courseLessonsV14(),groups=all.filter(l=>l.kind==='group'||l.groupId),missing=missingWeekPrintResourcesV14(),readyOpen=openPrintItems().filter(i=>i.fileReady&&!i.plan.alreadyPrinted);
  if(!all.length)return `<div class="content-grid"><section class="focus-hero"><div><span class="eyebrow">KW ${activeWeekNumber()}</span><h2>Woche noch nicht aufgebaut.</h2></div><button class="primary big" data-action="rebuild-week">Woche aufbauen →</button></section></div>`;
  return `<div class="content-grid weekly-assistant-v14"><section class="weekly-prep-hero"><div><span class="eyebrow">WOCHENVORBEREITUNG · KW ${activeWeekNumber()}</span><h2>Erst kopieren. Dann Stunde für Stunde fertigstellen.</h2><p>Die Themen und Hauptmaterialien stammen bereits aus deiner Reihenplanung.</p></div><div class="weekly-score"><strong>${courses.length}</strong><span>Fachstunden</span></div></section><section class="panel"><div class="section-head"><div><span class="step-number">1</span><span class="eyebrow">MATERIAL & KOPIEN</span><h2>Nur das, was du wirklich vorbereiten musst</h2></div><span class="status-counter">${missing.length?`${missing.length} offen`:'Druckdateien geklärt'}</span></div><p class="muted">Buch- und Arbeitsheftseiten werden nur als Unterrichtsreferenz angezeigt. Sie blockieren den Workflow nicht und müssen nicht in den Material-Hub.</p><div class="lesson-material-grid-v14">${courses.map(lessonMaterialCardV14).join('')}</div><div class="step-actions"><label class="upload-button">Materialordner einlesen<input type="file" id="bulk-material-folder" multiple webkitdirectory directory hidden></label>${readyOpen.length?`<button class="primary" data-action="download-print-zip">Druckpaket (${readyOpen.length}) herunterladen</button><button class="secondary" data-v14-mark-printed>Nach dem Drucken: alles als kopiert markieren ✓</button>`:''}</div></section><section class="panel"><div class="section-head"><div><span class="step-number">2</span><span class="eyebrow">STUNDEN FERTIGSTELLEN</span><h2>Eine Stunde anklicken – das Cockpit führt dich durch alles Weitere</h2></div></div><div class="course-prep-list-v14">${courses.map(coursePrepRowV14).join('')}</div></section>${groups.length?`<section class="panel"><div class="section-head"><div><span class="eyebrow">GA / KLASSENZEIT</span><h2>Separat kurz planen</h2></div></div><div class="prep-lesson-table">${groups.map(prepGroupRowV11).join('')}</div></section>`:''}</div>`;
}
weekPrepViewV08=weekPrepViewV14;weekPrepViewV12=weekPrepViewV14;

function wizardLessonV14(){return lesson(wizardV14.lessonId);}
function wizardStepsV14(step){const labels=['Sollplan','ChatGPT','Antwort','PowerPoint'];return `<div class="wizard-steps-v14">${labels.map((x,i)=>`<div class="${i+1<step?'done':i+1===step?'active':''}"><span>${i+1<step?'✓':i+1}</span><strong>${x}</strong></div>`).join('')}</div>`;}
function wizardPlanStepV14(l){
  const pr=l.planReference||{},rs=lessonResourcesV14(l),prev=previousLesson(l),prevR=prev?.reflection||{};
  return `<section class="wizard-panel-v14"><span class="eyebrow">SCHRITT 1</span><h2>Die grobe Stunde steht schon.</h2><p>Du musst hier nichts neu erfinden. Prüfe nur kurz, ob das noch zum tatsächlichen Stand passt.</p><div class="wizard-plan-summary-v14"><div><small>Thema</small><strong>${esc(pr.title||l.title||'')}</strong></div>${pr.content?`<div><small>Vorgesehener Inhalt</small><p>${esc(pr.content)}</p></div>`:''}${prev?`<div><small>Letzte Stunde / Rückmeldung</small><p>${esc(prev.title||'')} · Zeit: ${esc(prevR.timing||'nicht markiert')} · Lernstand: ${esc(prevR.learning||'nicht markiert')}</p></div>`:''}</div><h3>Material in dieser Stunde</h3><div class="wizard-resources-v14">${rs.map(r=>resourceRowV14(l,r)).join('')||'<p class="muted">Kein Materialhinweis vorhanden.</p>'}</div><div class="wizard-footer-v14"><button class="primary big" data-v14-wizard-next="2">Passt – weiter zu ChatGPT →</button></div></section>`;
}
function wizardPromptStepV14(l){const prompt=concretePlanningPromptV12(l);return `<section class="wizard-panel-v14"><span class="eyebrow">SCHRITT 2</span><h2>Jetzt ChatGPT planen lassen</h2><div class="instruction-steps-v14"><div><span>1</span><p><strong>Prompt kopieren.</strong> Er enthält Reihenplanung, Material und die letzte Reflexion.</p></div><div><span>2</span><p><strong>Hier in ChatGPT einfügen.</strong> Ich erstelle die konkrete Stunde und den Schulcockpit-Datenblock.</p></div><div><span>3</span><p><strong>Meine komplette Antwort kopieren.</strong> Danach hier auf „Antwort einfügen“ gehen.</p></div></div><textarea class="prompt-box-v14" readonly>${esc(prompt)}</textarea><div class="wizard-footer-v14"><button class="secondary" data-v14-wizard-back="1">← Zurück</button><button class="primary" data-v14-copy-prompt>Prompt kopieren</button><button class="primary big" data-v14-wizard-next="3">Ich habe die ChatGPT-Antwort →</button></div></section>`;}
function wizardImportStepV14(l){
  const p=wizardV14.parsed,raw=wizardV14.raw||'';const preview=p?`<div class="wizard-import-preview-v14"><strong>✓ Antwort erkannt</strong><span>${p.phases.length} Phasen · ${p.slides.length} Folien · ${p.materials.length} Materialeinträge</span>${p.lesson.title?`<p>${esc(p.lesson.title)}</p>`:''}</div>`:'';
  return `<section class="wizard-panel-v14"><span class="eyebrow">SCHRITT 3</span><h2>ChatGPT-Antwort hier einfügen</h2><p>Kopiere einfach die komplette Antwort. Du musst den JSON-Block nicht suchen.</p><textarea id="v14-answer" class="ai-import-text" placeholder="Komplette ChatGPT-Antwort hier einfügen …">${esc(raw)}</textarea>${preview}<div class="wizard-footer-v14"><button class="secondary" data-v14-wizard-back="2">← Zurück</button>${!p?`<button class="primary" data-v14-parse-answer>Antwort prüfen →</button>`:`<button class="primary big" data-v14-apply-answer>Übernehmen & zur PowerPoint →</button>`}</div></section>`;
}
function wizardPptStepV14(l){
  const master=!!state.settings.powerPointMasterName,slides=(l.slides||[]).length;
  return `<section class="wizard-panel-v14"><span class="eyebrow">SCHRITT 4</span><h2>PowerPoint erzeugen</h2><p>Die konkrete Planung ist jetzt im Cockpit. Der Momiji-Master baut daraus die Präsentation.</p><div class="ppt-ready-card-v14"><div><small>Master</small><strong>${master?esc(state.settings.powerPointMasterName):'noch nicht hinterlegt'}</strong></div><div><small>Folienplan</small><strong>${slides} Folienbausteine</strong></div><div><small>Status</small><strong>${l.presentationReady?'✓ PowerPoint bereits erzeugt':'bereit zum Erzeugen'}</strong></div></div>${!master?`<label class="upload-button big-upload">Momiji-Master auswählen<input type="file" id="v14-master-upload" accept=".potx,.pptx" hidden></label>`:''}<div class="wizard-footer-v14"><button class="secondary" data-v14-wizard-back="3">← Zurück</button>${master&&slides?`<button class="primary big" data-v14-generate-ppt>${l.presentationReady?'PowerPoint erneut erzeugen':'PowerPoint erstellen & herunterladen'}</button>`:''}${l.presentationReady?`<button class="secondary" data-v14-next-lesson>Nächste Stunde vorbereiten →</button>`:''}</div></section>`;
}
function lessonAssistantViewV14(){
  const l=wizardLessonV14();if(!l)return `<div class="content-grid"><section class="focus-hero"><div><h2>Keine Stunde ausgewählt.</h2></div><button data-view="prep" class="primary">Zur Wochenvorbereitung</button></section></div>`;
  const c=cls(l.classId);let body=wizardV14.step===1?wizardPlanStepV14(l):wizardV14.step===2?wizardPromptStepV14(l):wizardV14.step===3?wizardImportStepV14(l):wizardPptStepV14(l);
  return `<div class="content-grid lesson-wizard-v14"><section class="wizard-head-v14"><button class="text-button" data-view="prep">← Wochenvorbereitung</button><div><span class="eyebrow">${esc(fmtDayV14(l.date))} · ${esc(l.period||'')}</span><h1>${esc(c?.subject||'')} ${esc(c?.name||'')}</h1><p>${esc(l.title||l.planReference?.title||'')}</p></div>${wizardStepsV14(wizardV14.step)}</section>${body}</div>`;
}
const viewHtmlBeforeV14=viewHtml;viewHtml=function(){if(view==='assistant')return lessonAssistantViewV14();return viewHtmlBeforeV14();};
const pageTitleBeforeV14=pageTitle;pageTitle=function(){if(view==='assistant')return 'Stunde vorbereiten';if(view==='prep')return 'Wochenvorbereitung';return pageTitleBeforeV14();};

function openWizardV14(lid,step){wizardV14={lessonId:lid,step:step||1,raw:'',parsed:null};view='assistant';render();}
function nextUnfinishedLessonV14(current){const courses=courseLessonsV14(),idx=courses.findIndex(x=>x.id===current.id);return courses.slice(idx+1).find(l=>!l.presentationReady)||courses.find(l=>!l.presentationReady&&l.id!==current.id)||null;}

// Replace old material text inside the ChatGPT prompt with classified resources.
const promptV13BeforeV14=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
  let txt=promptV13BeforeV14(l);const rs=lessonResourcesV14(l);const block=rs.length?rs.map(r=>{if(r.type==='reference')return `- Schüler:innenmaterial (kein Upload/Kopieren): ${r.hint}`;if(r.type==='digital')return `- Digital/Anzeige: ${r.hint}`;return `- Druckmaterial: ${r.hint}${r.fileReady?' (Datei im Hub vorhanden)':' (Datei noch nicht zugeordnet)'}`;}).join('\n'):'- keine Hauptmaterialien eingetragen';
  txt=txt.replace(/## Hauptmaterial aus der Reihenplanung\n[\s\S]*?\n\n## Letzter tatsächlicher Stand/,`## Hauptmaterial aus der Reihenplanung\n${block}\n\n## Letzter tatsächlicher Stand`);
  return txt;
};
makeBrief=concretePlanningPromptV12;

const wireBeforeV14=wire;wire=function(){
  wireBeforeV14();
  document.querySelectorAll('[data-start-wizard]').forEach(b=>b.onclick=()=>openWizardV14(b.dataset.startWizard,1));
  document.querySelectorAll('[data-v14-wizard-next]').forEach(b=>b.onclick=()=>{wizardV14.step=Number(b.dataset.v14WizardNext)||1;wizardV14.parsed=null;render();});
  document.querySelectorAll('[data-v14-wizard-back]').forEach(b=>b.onclick=()=>{wizardV14.step=Number(b.dataset.v14WizardBack)||1;render();});
  document.querySelector('[data-v14-copy-prompt]')?.addEventListener('click',async()=>{const l=wizardLessonV14(),txt=concretePlanningPromptV12(l);try{await navigator.clipboard.writeText(txt);alert('Prompt kopiert. Jetzt in ChatGPT einfügen.');}catch{downloadText(`${l.date}_${safeName(whoV14(l))}_Prompt.md`,txt);alert('Prompt als Datei heruntergeladen.');}});
  document.querySelector('[data-v14-parse-answer]')?.addEventListener('click',()=>{const raw=document.getElementById('v14-answer')?.value||'';try{wizardV14.raw=raw;wizardV14.parsed=parseAiImport(raw);render();}catch(err){alert(err.message||'Antwort konnte nicht gelesen werden.');}});
  document.querySelector('[data-v14-apply-answer]')?.addEventListener('click',()=>{const l=wizardLessonV14();if(!l||!wizardV14.parsed)return;applyAiPackage(l,wizardV14.parsed,{lesson:true,phases:true,slides:true,materials:true,prep:true,status:true});saveState();wizardV14.step=4;wizardV14.parsed=null;render();});
  document.querySelector('[data-v14-generate-ppt]')?.addEventListener('click',async e=>{const l=wizardLessonV14(),btn=e.currentTarget,old=btn.textContent;btn.disabled=true;btn.textContent='PowerPoint wird erzeugt …';try{await generateMomijiPptV13(l);wizardV14.step=4;render();}catch(err){console.error(err);alert(`PowerPoint konnte nicht erzeugt werden:\n${err.message||err}`);btn.disabled=false;btn.textContent=old;}});
  document.querySelector('#v14-master-upload')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;await fileStorePut('__ppt_master__',f);state.settings.powerPointMasterName=f.name;saveState();render();});
  document.querySelector('[data-v14-next-lesson]')?.addEventListener('click',()=>{const l=wizardLessonV14(),n=nextUnfinishedLessonV14(l);if(n)openWizardV14(n.id,1);else{view='prep';render();}});
  document.querySelectorAll('[data-v14-resource-type]').forEach(sel=>sel.onchange=()=>{const [lid,enc]=sel.dataset.v14ResourceType.split('|'),l=lesson(lid),hint=decodeURIComponent(enc);setResourceTypeV14(l,hint,sel.value);saveState();render();});
  document.querySelectorAll('[data-v14-resource-upload]').forEach(inp=>inp.onchange=async()=>{const [lid,enc]=inp.dataset.v14ResourceUpload.split('|'),l=lesson(lid),hint=decodeURIComponent(enc),f=inp.files?.[0];if(!l||!f)return;let m=bestMaterialMatchV12(hint);if(!m){m={id:uid('mat'),title:hint,kind:'file',source:'Reihenplanung',pages:'',tasks:'',variants:[],improvementFlags:[]};state.materials.push(m);}const v=standardVariantV12(m);v.available=true;v.fileName=f.name;if(!v.fileKey)v.fileKey=`material-${m.id}-${v.id}`;await fileStorePut(v.fileKey,f);if(!l.materials.includes(m.id))l.materials.push(m.id);setResourceTypeV14(l,hint,'print');await refreshStoredFileKeys();ensureCoarsePrintPlansV14(l);saveState();render();});
  document.querySelector('[data-v14-mark-printed]')?.addEventListener('click',()=>{openPrintItems().filter(i=>i.fileReady).forEach(i=>i.plan.alreadyPrinted=true);saveState();render();});
};

const renderBeforeV14=render;render=function(){renderBeforeV14();const version=document.querySelector('.brand small');if(version)version.textContent=`${state.settings.schoolYear} · V0.14.0`;document.querySelectorAll('.sidebar nav button,.top-actions button').forEach(b=>{if(b.textContent.trim()==='Montagsmodus')b.childNodes[b.childNodes.length-1].textContent=' Wochenvorbereitung';});};

hydrateWeekResourcesV14();view='focus';render();
