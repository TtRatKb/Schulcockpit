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
      const h=picker.pick(MOMIJI_V13.backgrounds.topflop);const statement=v175Statement(sl);if(!statement)continue;
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
  document.querySelector('[data-v14-apply-answer]')?.addEventListener('click',v185ApplyWizardAnswer);
  document.querySelector('[data-v14-generate-ppt]')?.addEventListener('click',async e=>{const l=wizardLessonV14(),btn=e.currentTarget,old=btn.textContent;btn.disabled=true;btn.textContent='PowerPoint wird erzeugt …';try{await generateMomijiPptV13(l);wizardV14.step=4;render();}catch(err){console.error(err);alert(`PowerPoint konnte nicht erzeugt werden:\n${err.message||err}`);btn.disabled=false;btn.textContent=old;}});
  document.querySelector('#v14-master-upload')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;await fileStorePut('__ppt_master__',f);state.settings.powerPointMasterName=f.name;saveState();render();});
  document.querySelector('[data-v14-next-lesson]')?.addEventListener('click',()=>{const l=wizardLessonV14(),n=nextUnfinishedLessonV14(l);if(n)openWizardV14(n.id,1);else{view='prep';render();}});
  document.querySelectorAll('[data-v14-resource-type]').forEach(sel=>sel.onchange=()=>{const [lid,enc]=sel.dataset.v14ResourceType.split('|'),l=lesson(lid),hint=decodeURIComponent(enc);setResourceTypeV14(l,hint,sel.value);saveState();render();});
  document.querySelectorAll('[data-v14-resource-upload]').forEach(inp=>inp.onchange=async()=>{const [lid,enc]=inp.dataset.v14ResourceUpload.split('|'),l=lesson(lid),hint=decodeURIComponent(enc),f=inp.files?.[0];if(!l||!f)return;let m=bestMaterialMatchV12(hint);if(!m){m={id:uid('mat'),title:hint,kind:'file',source:'Reihenplanung',pages:'',tasks:'',variants:[],improvementFlags:[]};state.materials.push(m);}const v=standardVariantV12(m);v.available=true;v.fileName=f.name;if(!v.fileKey)v.fileKey=`material-${m.id}-${v.id}`;await fileStorePut(v.fileKey,f);if(!l.materials.includes(m.id))l.materials.push(m.id);setResourceTypeV14(l,hint,'print');await refreshStoredFileKeys();ensureCoarsePrintPlansV14(l);saveState();render();});
  document.querySelector('[data-v14-mark-printed]')?.addEventListener('click',()=>{openPrintItems().filter(i=>i.fileReady).forEach(i=>i.plan.alreadyPrinted=true);saveState();render();});
};

const renderBeforeV14=render;render=function(){renderBeforeV14();const version=document.querySelector('.brand small');if(version)version.textContent=`${state.settings.schoolYear} · V0.14.0`;document.querySelectorAll('.sidebar nav button,.top-actions button').forEach(b=>{if(b.textContent.trim()==='Montagsmodus')b.childNodes[b.childNodes.length-1].textContent=' Wochenvorbereitung';});};

hydrateWeekResourcesV14();view='focus';render();

/* ===== V0.15 – Material-Eingang & strukturierte Zuordnung ===== */
function ensureMaterialInboxV15(){
  state.materialInbox=Array.isArray(state.materialInbox)?state.materialInbox:[];
  state.materials=(state.materials||[]).map(m=>{m.assignments=Array.isArray(m.assignments)?m.assignments:[];return m;});
}
ensureMaterialInboxV15();

function sequencesForClassV15(classId){return (state.sequences||[]).filter(q=>q.classId===classId).sort((a,b)=>(a.startDate||'9999').localeCompare(b.startDate||'9999')||a.title.localeCompare(b.title,'de'));}
function sequenceV15(id){return (state.sequences||[]).find(q=>q.id===id);}
function unitsForSequenceV15(seqId){return (sequenceV15(seqId)?.plan||[]).slice().sort((a,b)=>(a.plannedDate||'9999').localeCompare(b.plannedDate||'9999')||String(a.title||'').localeCompare(String(b.title||''),'de'));}
function variantLabelV15(t){return ({standard:'Standard',challenge:'Forderung',support:'Förderung',daz:'DaZ / einfache Sprache',solution:'Lösung'})[t]||'Standard';}
function resourceLabelV15(t){return ({print:'Druckmaterial',digital:'Digital / anzeigen',teacher:'Nur Lehrkraft'})[t]||'Druckmaterial';}
function inboxEntryV15(id){return (state.materialInbox||[]).find(x=>x.id===id);}
function materialAssignmentTextV15(m){
  const a=(m.assignments||[])[0];if(!a)return 'noch keiner Klasse/Reihe zugeordnet';
  const c=cls(a.classId),q=sequenceV15(a.sequenceId),u=(q?.plan||[]).find(x=>x.id===a.unitId);
  return [c?`${c.subject} ${c.name}`:'',q?.title||'',u?.title||''].filter(Boolean).join(' · ');
}
function inboxCourseOptionsV15(selected=''){return `<option value="">Klasse / Kurs wählen …</option>${(state.classes||[]).map(c=>`<option value="${c.id}" ${selected===c.id?'selected':''}>${esc(c.subject)} ${esc(c.name)}</option>`).join('')}`;}
function inboxSequenceOptionsV15(classId,selected=''){const qs=sequencesForClassV15(classId);return `<option value="">${classId?'Reihe wählen …':'erst Klasse wählen'}</option>${qs.map(q=>`<option value="${q.id}" ${selected===q.id?'selected':''}>${esc(q.title)}</option>`).join('')}`;}
function inboxUnitOptionsV15(seqId,selected=''){const us=unitsForSequenceV15(seqId);return `<option value="">${seqId?'ganze Reihe / allgemein':'optional: konkrete Stunde'}</option>${us.map(u=>`<option value="${u.id}" ${selected===u.id?'selected':''}>${u.plannedDate?esc(fmtDate(u.plannedDate))+' · ':''}${esc(u.title)}</option>`).join('')}`;}
function materialInboxRowV15(x){
  return `<article class="material-inbox-row-v15"><div class="inbox-file-v15"><span class="file-pill-v15">${esc((x.fileName||'Datei').split('.').pop().toUpperCase())}</span><div><input class="inbox-title-v15" value="${esc(x.title||'')}" data-inbox-field="${x.id}|title"><small>${esc(x.fileName||'')} · lokal gespeichert</small></div></div><div class="inbox-assign-grid-v15"><select data-inbox-field="${x.id}|classId">${inboxCourseOptionsV15(x.classId)}</select><select data-inbox-field="${x.id}|sequenceId">${inboxSequenceOptionsV15(x.classId,x.sequenceId)}</select><select data-inbox-field="${x.id}|unitId">${inboxUnitOptionsV15(x.sequenceId,x.unitId)}</select><select data-inbox-field="${x.id}|variantType"><option value="standard" ${x.variantType==='standard'?'selected':''}>Standard</option><option value="challenge" ${x.variantType==='challenge'?'selected':''}>Forderung</option><option value="support" ${x.variantType==='support'?'selected':''}>Förderung</option><option value="daz" ${x.variantType==='daz'?'selected':''}>DaZ / einfache Sprache</option><option value="solution" ${x.variantType==='solution'?'selected':''}>Lösung</option></select><select data-inbox-field="${x.id}|resourceType"><option value="print" ${x.resourceType==='print'?'selected':''}>Druckmaterial</option><option value="digital" ${x.resourceType==='digital'?'selected':''}>Digital / anzeigen</option><option value="teacher" ${x.resourceType==='teacher'?'selected':''}>Nur Lehrkraft</option></select></div><div class="inbox-actions-v15"><button class="primary" data-inbox-assign="${x.id}" ${!x.classId?'disabled':''}>Zuordnen →</button><button class="danger-lite" data-inbox-delete="${x.id}" title="Aus Eingang entfernen">×</button></div></article>`;
}
function materialCardV15(m){
  const stored=(m.variants||[]).filter(v=>hasStoredFile(v)).length;
  const variantText=(m.variants||[]).filter(v=>v.available).map(v=>variantLabelV15(v.type)).join(' · ')||'keine Variante';
  return `<button class="material-card material-card-v15" data-material="${m.id}"><div class="material-icon">${m.kind==='book'?'▥':'▤'}</div><div><span class="eyebrow">${m.kind==='book'?'BUCH / ARBEITSHEFT':resourceLabelV15(m.resourceType||'print').toUpperCase()}</span><h3>${esc(m.title)}</h3><p class="material-assignment-v15">${esc(materialAssignmentTextV15(m))}</p><div class="variant-strip"><span class="available">${esc(variantText)}</span></div><div class="material-meta">${stored} Datei${stored===1?'':'en'} lokal gespeichert</div></div></button>`;
}
function materialsViewV15(){
  ensureMaterialInboxV15();
  const inbox=state.materialInbox||[];
  return `<div class="content-grid materials-v15"><section class="hero-card material-drop-hero-v15"><div><span class="eyebrow">MATERIAL-EINGANG</span><h2>Dateien einmal hochladen. Danach nur noch zuordnen.</h2><p>Du kannst viele Dateien gleichzeitig hineinwerfen. Erst danach entscheidest du, zu welcher Klasse, Reihe und konkreten Stunde sie gehören und ob es Standard-, Förder-, Forder-, DaZ- oder Lösungsmaterial ist.</p></div><div class="hero-actions"><label class="upload-button big-upload">Dateien auswählen<input type="file" id="material-inbox-upload-v15" multiple hidden></label><label class="upload-button">ganzen Ordner auswählen<input type="file" id="material-inbox-folder-v15" multiple webkitdirectory directory hidden></label></div></section>${inbox.length?`<section class="panel material-inbox-v15"><div class="section-head"><div><span class="eyebrow">NOCH ZUORDNEN</span><h2>${inbox.length} Datei${inbox.length===1?'':'en'} im Eingang</h2></div><span class="status-counter">Dropdowns → Zuordnen</span></div><p class="muted">Eine Datei muss mindestens einer Klasse/einem Kurs zugeordnet werden. Reihe und konkrete Stunde sind optional – für allgemeines Material kannst du sie leer lassen.</p><div class="material-inbox-list-v15">${inbox.map(materialInboxRowV15).join('')}</div></section>`:''}<section class="panel"><div class="section-head"><div><span class="eyebrow">MATERIAL-HUB</span><h2>Bereits zugeordnete Materialien</h2></div><button class="secondary" data-action="new-material">+ Material ohne Datei anlegen</button></div><div class="materials-grid">${state.materials.map(materialCardV15).join('')||'<p class="muted">Noch keine Materialien zugeordnet.</p>'}</div></section></div>`;
}
materialsView=materialsViewV15;

async function addFilesToInboxV15(files){
  ensureMaterialInboxV15();let n=0;
  for(const file of files){
    if(!file||file.name.startsWith('.'))continue;
    const id=uid('inbox'),key=`inbox-${id}`;
    await fileStorePut(key,file);
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    let resourceType=/^(pptx?|potx|png|jpe?g|gif|webp|mp4|mov|mp3|wav)$/.test(ext)?'digital':'print';
    let variantType=/lösung|loesung|answer|solution/i.test(file.name)?'solution':/förder|foerder|grundlage|leicht/i.test(file.name)?'support':/forderung|forder|challenge|vertief/i.test(file.name)?'challenge':/daz|einfache.?sprache/i.test(file.name)?'daz':'standard';
    if(variantType==='solution')resourceType='teacher';
    state.materialInbox.push({id,fileKey:key,fileName:file.name,title:file.name.replace(/\.[^.]+$/,''),classId:'',sequenceId:'',unitId:'',variantType,resourceType,sourcePath:file.webkitRelativePath||''});n++;
  }
  await refreshStoredFileKeys();saveState();return n;
}
async function assignInboxFileV15(id){
  const x=inboxEntryV15(id);if(!x)return;if(!x.classId)return alert('Bitte zuerst Klasse/Kurs auswählen.');
  const rec=await fileStoreGet(x.fileKey);if(!rec)return alert('Die hochgeladene Datei wurde im lokalen Speicher nicht gefunden. Bitte erneut hochladen.');
  const keyTitle=normalizeHintV12(x.title);
  let m=(state.materials||[]).find(mm=>normalizeHintV12(mm.title)===keyTitle && (mm.assignments||[]).some(a=>a.classId===x.classId&&a.sequenceId===x.sequenceId&&a.unitId===x.unitId));
  if(!m){m={id:uid('mat'),title:x.title,kind:'file',resourceType:x.resourceType,source:x.sourcePath?'Material-Eingang · '+x.sourcePath:'Material-Eingang',pages:'',tasks:'',variants:[],improvementFlags:[],assignments:[]};state.materials.push(m);}
  m.resourceType=x.resourceType;m.assignments=Array.isArray(m.assignments)?m.assignments:[];
  if(!m.assignments.some(a=>a.classId===x.classId&&a.sequenceId===x.sequenceId&&a.unitId===x.unitId))m.assignments.push({classId:x.classId,sequenceId:x.sequenceId||'',unitId:x.unitId||''});
  let v=(m.variants||[]).find(v=>v.type===x.variantType);
  if(!v){v={id:uid('var'),type:x.variantType,label:variantLabelV15(x.variantType),available:true,fileName:null,fileKey:null};m.variants.push(v);}
  v.available=true;v.fileName=x.fileName;if(!v.fileKey)v.fileKey=`material-${m.id}-${v.id}`;
  const sourceBlob=rec.blob||rec;const storedFile=new File([sourceBlob],rec.name||x.fileName,{type:sourceBlob.type||''});await fileStorePut(v.fileKey,storedFile);
  await fileStoreDelete(x.fileKey);storedFileKeys.delete(x.fileKey);
  // Attach to already-created actual lessons when this assignment matches them.
  (state.lessons||[]).filter(l=>l.classId===x.classId).forEach(l=>{
    const unitMatch=x.unitId && l.planReference?.unitId===x.unitId;
    const seqMatch=!x.unitId && x.sequenceId && l.sequenceId===x.sequenceId;
    const classMatch=!x.sequenceId && !x.unitId;
    if(unitMatch||seqMatch||classMatch){l.materials=Array.isArray(l.materials)?l.materials:[];if(!l.materials.includes(m.id))l.materials.push(m.id);}
  });
  state.materialInbox=state.materialInbox.filter(y=>y.id!==id);
  await refreshStoredFileKeys();hydrateWeekResourcesV14();saveState();render();
}
function assignedMaterialsForLessonV15(l){
  return (state.materials||[]).filter(m=>(m.assignments||[]).some(a=>{
    if(a.classId!==l.classId)return false;
    if(a.unitId)return a.unitId===l.planReference?.unitId;
    if(a.sequenceId)return a.sequenceId===l.sequenceId;
    return false; // class-only = library material, not automatically every lesson
  }));
}
const lessonResourcesBeforeV15=lessonResourcesV14;
lessonResourcesV14=function(l){
  const base=lessonResourcesBeforeV15(l),seen=new Set(base.map(r=>normalizeHintV12(r.material?.title||r.hint)));
  assignedMaterialsForLessonV15(l).forEach(m=>{
    const vs=(m.variants||[]).filter(v=>v.available && v.type!=='solution');
    vs.forEach(v=>{const key=normalizeHintV12(m.title);if(seen.has(key))return;seen.add(key);const type=m.resourceType==='digital'?'digital':m.resourceType==='teacher'?'digital':'print';base.push({hint:m.title,type,material:m,variant:v,fileReady:hasStoredFile(v),assigned:true});});
  });
  return base;
};

const materialPanelBeforeV15=materialPanel;
materialPanel=function(m){
  let html=materialPanelBeforeV15(m);const ass=(m.assignments||[]).map(a=>{const c=cls(a.classId),q=sequenceV15(a.sequenceId),u=(q?.plan||[]).find(x=>x.id===a.unitId);return `<li>${esc([c?`${c.subject} ${c.name}`:'',q?.title||'',u?.title||''].filter(Boolean).join(' · ')||'allgemein')}</li>`}).join('');
  const block=`<section class="detail-section"><span class="eyebrow">ZUORDNUNG</span><h3>Wo gehört dieses Material hin?</h3>${ass?`<ul class="notes-list">${ass}</ul>`:'<p class="muted">Noch keiner Klasse/Reihe zugeordnet.</p>'}<p class="microcopy">Neue Dateien lassen sich am schnellsten über den Material-Eingang zuordnen.</p></section>`;
  return html.replace('<section class="detail-section"><span class="eyebrow">VARIANTEN & DATEIEN</span>',block+'<section class="detail-section"><span class="eyebrow">VARIANTEN & DATEIEN</span>');
};

const wireBeforeV15=wire;wire=function(){
  wireBeforeV15();
  const upload=async e=>{const n=await addFilesToInboxV15([...e.target.files]);render();if(n)alert(`${n} Datei${n===1?'':'en'} im Material-Eingang. Jetzt kannst du sie zuordnen.`);};
  document.querySelector('#material-inbox-upload-v15')?.addEventListener('change',upload);
  document.querySelector('#material-inbox-folder-v15')?.addEventListener('change',upload);
  document.querySelectorAll('[data-inbox-field]').forEach(el=>el.onchange=()=>{const [id,key]=el.dataset.inboxField.split('|'),x=inboxEntryV15(id);if(!x)return;x[key]=el.value;if(key==='classId'){x.sequenceId='';x.unitId='';}if(key==='sequenceId')x.unitId='';saveState();render();});
  document.querySelectorAll('.inbox-title-v15[data-inbox-field]').forEach(el=>el.oninput=()=>{const [id,key]=el.dataset.inboxField.split('|'),x=inboxEntryV15(id);if(x){x[key]=el.value;saveState();}});
  document.querySelectorAll('[data-inbox-assign]').forEach(b=>b.onclick=()=>assignInboxFileV15(b.dataset.inboxAssign));
  document.querySelectorAll('[data-inbox-delete]').forEach(b=>b.onclick=async()=>{const x=inboxEntryV15(b.dataset.inboxDelete);if(!x)return;if(!confirm(`„${x.fileName}“ aus dem Material-Eingang entfernen?`))return;await fileStoreDelete(x.fileKey);state.materialInbox=state.materialInbox.filter(y=>y.id!==x.id);saveState();render();});
};

const renderBeforeV15=render;render=function(){renderBeforeV15();const version=document.querySelector('.brand small');if(version)version.textContent=`${state.settings.schoolYear} · V0.15.0`;};
ensureMaterialInboxV15();render();

/* ===== V0.16 – Drag & Drop + automatische Zuordnung aus Reihenplanung ===== */
let lastMaterialImportV16=null;

function matchNormV16(s){
  return String(s||'').toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i,'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/ß/g,'ss')
    .replace(/\b(arbeitsblatt)\b/g,'ab')
    .replace(/\b(foerder|forderung)\b/g,m=>m==='foerder'?'foerder':'forderung')
    .replace(/[_–—-]+/g,' ')
    .replace(/[^a-z0-9äöü]+/g,' ')
    .replace(/\s+/g,' ').trim();
}
function matchTokensV16(s){return new Set(matchNormV16(s).split(' ').filter(t=>t.length>1));}
function similarityV16(a,b){
  a=matchNormV16(a);b=matchNormV16(b);if(!a||!b)return 0;if(a===b)return 1;
  if((a.includes(b)&&b.length>=6)||(b.includes(a)&&a.length>=6))return .96;
  const A=matchTokensV16(a),B=matchTokensV16(b);if(!A.size||!B.size)return 0;
  let inter=0;A.forEach(t=>{if(B.has(t))inter++;});const union=new Set([...A,...B]).size;
  let s=union?inter/union:0;
  const numsA=[...A].filter(t=>/^\d+$/.test(t)),numsB=[...B].filter(t=>/^\d+$/.test(t));
  if(numsA.length&&numsB.length&&!numsA.some(n=>numsB.includes(n)))s*=.55;
  return s;
}
function expectedMaterialCandidatesV16(){
  const out=[];
  (state.sequences||[]).forEach(q=>(q.plan||[]).forEach(u=>{
    rawResourceLinesV14({planReference:u}).forEach(h=>{
      const type=inferredResourceTypeV14(h);if(type==='reference'||type==='ignore')return;
      out.push({classId:q.classId,sequenceId:q.id,unitId:u.id,hint:h,type,unitTitle:u.title||'',seqTitle:q.title||''});
    });
  }));
  return out;
}
function bestExpectedMatchV16(fileName){
  const stem=String(fileName||'').replace(/\.[^.]+$/,'');
  const ranked=expectedMaterialCandidatesV16().map(c=>({...c,score:similarityV16(stem,c.hint)})).sort((a,b)=>b.score-a.score);
  const best=ranked[0]||null,second=ranked[1]?.score||0;
  if(!best||best.score<.42)return null;
  return {...best,margin:best.score-second,auto:best.score>=.93 && (best.margin>=.08 || best.score===1)};
}
function assignmentPreviewV16(m){
  if(!m)return '';
  const c=cls(m.classId),q=sequenceV15(m.sequenceId),u=(q?.plan||[]).find(x=>x.id===m.unitId);
  return [c?`${c.subject} ${c.name}`:'',q?.title||'',u?.title||''].filter(Boolean).join(' → ');
}

async function autoAssignInboxEntryV16(x){
  if(!x?.classId)return false;
  const rec=await fileStoreGet(x.fileKey);if(!rec)return false;
  const keyTitle=normalizeHintV12(x.title);
  let m=(state.materials||[]).find(mm=>normalizeHintV12(mm.title)===keyTitle && (mm.assignments||[]).some(a=>a.classId===x.classId&&a.sequenceId===x.sequenceId&&a.unitId===x.unitId));
  if(!m){m={id:uid('mat'),title:x.title,kind:'file',resourceType:x.resourceType,source:x.sourcePath?'Automatisch aus Material-Eingang · '+x.sourcePath:'Automatisch aus Material-Eingang',pages:'',tasks:'',variants:[],improvementFlags:[],assignments:[]};state.materials.push(m);}
  m.resourceType=x.resourceType;m.assignments=Array.isArray(m.assignments)?m.assignments:[];
  if(!m.assignments.some(a=>a.classId===x.classId&&a.sequenceId===x.sequenceId&&a.unitId===x.unitId))m.assignments.push({classId:x.classId,sequenceId:x.sequenceId||'',unitId:x.unitId||''});
  let v=(m.variants||[]).find(v=>v.type===x.variantType);
  if(!v){v={id:uid('var'),type:x.variantType,label:variantLabelV15(x.variantType),available:true,fileName:null,fileKey:null};m.variants.push(v);}
  v.available=true;v.fileName=x.fileName;if(!v.fileKey)v.fileKey=`material-${m.id}-${v.id}`;
  const sourceBlob=rec.blob||rec;const storedFile=new File([sourceBlob],rec.name||x.fileName,{type:sourceBlob.type||''});await fileStorePut(v.fileKey,storedFile);
  await fileStoreDelete(x.fileKey);storedFileKeys.delete(x.fileKey);
  (state.lessons||[]).filter(l=>l.classId===x.classId).forEach(l=>{
    const unitMatch=x.unitId && l.planReference?.unitId===x.unitId;
    const seqMatch=!x.unitId && x.sequenceId && l.sequenceId===x.sequenceId;
    if(unitMatch||seqMatch){l.materials=Array.isArray(l.materials)?l.materials:[];if(!l.materials.includes(m.id))l.materials.push(m.id);}
  });
  state.materialInbox=state.materialInbox.filter(y=>y.id!==x.id);return true;
}

addFilesToInboxV15=async function(files){
  ensureMaterialInboxV15();let n=0,autoCount=0,suggested=0,unmatched=0;const added=[];
  for(const file of files){
    if(!file||file.name.startsWith('.'))continue;
    const id=uid('inbox'),key=`inbox-${id}`;await fileStorePut(key,file);
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    let resourceType=/^(pptx?|potx|png|jpe?g|gif|webp|mp4|mov|mp3|wav)$/.test(ext)?'digital':'print';
    let variantType=/lösung|loesung|answer|solution/i.test(file.name)?'solution':/förder|foerder|grundlage|leicht/i.test(file.name)?'support':/forderung|forder|challenge|vertief/i.test(file.name)?'challenge':/daz|einfache.?sprache/i.test(file.name)?'daz':'standard';
    if(variantType==='solution')resourceType='teacher';
    const match=bestExpectedMatchV16(file.name);
    if(match&&match.type==='digital'&&variantType!=='solution')resourceType='digital';
    const x={id,fileKey:key,fileName:file.name,title:file.name.replace(/\.[^.]+$/,''),classId:match?.classId||'',sequenceId:match?.sequenceId||'',unitId:match?.unitId||'',variantType,resourceType,sourcePath:file.webkitRelativePath||'',matchScore:match?.score||0,matchHint:match?.hint||'',matchAuto:!!match?.auto};
    state.materialInbox.push(x);added.push(x);n++;
    if(match?.auto)autoCount++;else if(match)suggested++;else unmatched++;
  }
  for(const x of [...added])if(x.matchAuto)await autoAssignInboxEntryV16(x);
  await refreshStoredFileKeys();hydrateWeekResourcesV14();saveState();
  lastMaterialImportV16={total:n,auto:autoCount,suggested,unmatched};return n;
};

const inboxRowBeforeV16=materialInboxRowV15;
materialInboxRowV15=function(x){
  let html=inboxRowBeforeV16(x);
  const badge=x.matchHint?`<div class="match-note-v16 ${x.matchScore>=.75?'good':'maybe'}"><strong>${x.matchScore>=.75?'Vorschlag gefunden':'Möglicher Treffer'}</strong><span>${esc(x.matchHint)}</span><small>${esc(assignmentPreviewV16(x))}</small></div>`:`<div class="match-note-v16 no"><strong>Noch unklar</strong><span>Nur diese Datei musst du noch selbst zuordnen.</span></div>`;
  return html.replace('</div></div><div class="inbox-assign-grid-v15">',`${badge}</div></div><div class="inbox-assign-grid-v15">`);
};

materialsView=function(){
  ensureMaterialInboxV15();const inbox=state.materialInbox||[];const stat=lastMaterialImportV16;
  return `<div class="content-grid materials-v15"><section class="hero-card material-drop-hero-v16" id="material-drop-zone-v16"><div class="drop-copy-v16"><span class="eyebrow">MATERIAL-EINGANG</span><h2>Dateien einfach hier hineinziehen</h2><p>Das Cockpit vergleicht die Dateinamen automatisch mit den Materialangaben aus deinen importierten Reihenplanungen. Sichere Treffer werden direkt einsortiert. Nur unklare Dateien bleiben zum Prüfen übrig.</p><div class="drop-hint-v16">⇣ PDF, DOCX, PPTX, Bilder – auch viele Dateien gleichzeitig</div></div><div class="hero-actions"><label class="upload-button big-upload">Dateien auswählen<input type="file" id="material-inbox-upload-v15" multiple hidden></label><label class="upload-button">ganzen Ordner auswählen<input type="file" id="material-inbox-folder-v15" multiple webkitdirectory directory hidden></label></div></section>${stat?`<section class="match-summary-v16"><strong>${stat.auto} automatisch zugeordnet</strong><span>${stat.suggested} Vorschläge zum Prüfen</span><span>${stat.unmatched} ohne Treffer</span></section>`:''}${inbox.length?`<section class="panel material-inbox-v15"><div class="section-head"><div><span class="eyebrow">NUR NOCH PRÜFEN</span><h2>${inbox.length} unklare Datei${inbox.length===1?'':'en'}</h2></div><span class="status-counter">Vorschläge sind schon vorausgefüllt</span></div><p class="muted">Du musst nicht alles neu zuordnen. Wo das Cockpit einen Treffer aus „Mein Schulplan“ erkennt, sind Klasse, Reihe und Stunde bereits ausgewählt. Prüfe nur die verbleibenden Fälle.</p><div class="material-inbox-list-v15">${inbox.map(materialInboxRowV15).join('')}</div></section>`:`<section class="panel empty-success-v16"><strong>✓ Im Eingang ist nichts offen.</strong><span>Alle bisher hochgeladenen Dateien sind zugeordnet.</span></section>`}<section class="panel"><div class="section-head"><div><span class="eyebrow">MATERIAL-HUB</span><h2>Bereits zugeordnete Materialien</h2></div><button class="secondary" data-action="new-material">+ Material ohne Datei anlegen</button></div><div class="materials-grid">${state.materials.map(materialCardV15).join('')||'<p class="muted">Noch keine Materialien zugeordnet.</p>'}</div></section></div>`;
};

const wireBeforeV16=wire;wire=function(){
  wireBeforeV16();
  // Replace file inputs to remove the older V0.15 upload listener, then attach the smarter one.
  ['material-inbox-upload-v15','material-inbox-folder-v15'].forEach(id=>{const old=document.getElementById(id);if(!old)return;const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.addEventListener('change',async e=>{const n=await addFilesToInboxV15([...e.target.files]);render();if(n&&lastMaterialImportV16){const s=lastMaterialImportV16;alert(`${n} Datei${n===1?'':'en'} eingelesen.\n${s.auto} automatisch zugeordnet.\n${s.suggested+s.unmatched} nur noch prüfen.`);}});});
  const zone=document.getElementById('material-drop-zone-v16');
  if(zone){
    let depth=0;const on=e=>{e.preventDefault();e.stopPropagation();};
    zone.addEventListener('dragenter',e=>{on(e);depth++;zone.classList.add('dragging');});
    zone.addEventListener('dragover',on);
    zone.addEventListener('dragleave',e=>{on(e);depth=Math.max(0,depth-1);if(!depth)zone.classList.remove('dragging');});
    zone.addEventListener('drop',async e=>{on(e);depth=0;zone.classList.remove('dragging');const files=[...(e.dataTransfer?.files||[])];if(!files.length)return;await addFilesToInboxV15(files);render();});
  }
};

const renderBeforeV16=render;render=function(){renderBeforeV16();const version=document.querySelector('.brand small');if(version)version.textContent=`${state.settings.schoolYear} · V0.16.0`;};
render();


/* ===== V0.17 – konsolidierter Materialkatalog + Archiv-Verknüpfung ===== */
function ensureMaterialCatalogV17(){
  if(!Array.isArray(state.materialCatalog))state.materialCatalog=[];
  if(!state.materialCatalogMeta||typeof state.materialCatalogMeta!=='object')state.materialCatalogMeta={};
  if(!state.materialCatalogArchives||typeof state.materialCatalogArchives!=='object')state.materialCatalogArchives={};
  state.settings=state.settings||{};
  if(!state.settings.catalogFilterV17)state.settings.catalogFilterV17='backlog';
}
ensureMaterialCatalogV17();

function catalogNormV17(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/ß/g,'ss').replace(/\\/g,'/').replace(/[_–—-]+/g,' ')
    .replace(/[^a-z0-9./ ]+/g,' ').replace(/\s+/g,' ').trim();
}
function catalogBaseV17(s){return catalogNormV17(String(s||'').split('/').pop());}
function catalogStemV17(s){return catalogNormV17(String(s||'').split('/').pop().replace(/\.[^.]+$/,''));}
function catalogEntryV17(id){return (state.materialCatalog||[]).find(x=>x.catalogId===id);}
function catalogArchiveRecordV17(name){
  const n=catalogNormV17(name);
  return Object.entries(state.materialCatalogArchives||{}).find(([k])=>catalogNormV17(k)===n)?.[1]||null;
}
function catalogScopeLabelV17(s){
  return ({direct_lesson:'direkte Stunde',lesson_variant:'Stunden-Variante',lesson_support:'Ergänzung / Lösung',lesson_candidate:'Alternative / Kandidat',sequence_pool:'Reihenpool',future_sequence:'spätere Reihe',backlog:'noch nicht eingeplant',teacher_reference:'Lehrkraft / Quelle',assessment:'Leistungsnachweis',cross_grade_reuse:'wiederverwendbar',archive:'Quellenarchiv',exclude:'nicht übernehmen'})[s]||s;
}
function catalogCourseV17(e){
  const wanted=catalogNormV17(String(e.courseLabel||'').replace(/^religion\s*/i,''));
  return (state.classes||[]).find(c=>catalogNormV17(c.subject).startsWith('religion')&&catalogNormV17(c.name)===wanted)
    ||(state.classes||[]).find(c=>catalogNormV17(`${c.subject} ${c.name}`)===catalogNormV17(e.courseLabel));
}
function catalogSequenceV17(e,c){
  if(!c||!e.sequenceTitle)return null;
  const qs=(state.sequences||[]).filter(q=>q.classId===c.id);
  if(!qs.length)return null;
  const exact=qs.find(q=>catalogNormV17(q.title)===catalogNormV17(e.sequenceTitle));if(exact)return exact;
  const ranked=qs.map(q=>({q,score:similarityV16(q.title,e.sequenceTitle)})).sort((a,b)=>b.score-a.score);
  return ranked[0]?.score>=.35?ranked[0].q:null;
}
function shortDateV17(v){
  if(!v)return '';
  const s=String(v);
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(m)return `${m[3]}.${m[2]}.`;
  m=s.match(/^(\d{1,2})\.(\d{1,2})\./);if(m)return `${String(m[1]).padStart(2,'0')}.${String(m[2]).padStart(2,'0')}.`;
  return s;
}
function catalogUnitV17(e,q){
  if(!q)return null;const us=q.plan||[];if(!us.length)return null;
  const ds=(e.lessonDates||[]).map(shortDateV17).filter(Boolean);
  const matches=us.filter(u=>ds.includes(shortDateV17(u.plannedDate)));
  if(matches.length===1)return matches[0];
  if(e.lessonTitle){
    const ranked=us.map(u=>({u,score:similarityV16(u.title,e.lessonTitle)})).sort((a,b)=>b.score-a.score);
    if(ranked[0]?.score>=.5&&(ranked[0].score-(ranked[1]?.score||0)>.08))return ranked[0].u;
  }
  return null;
}
function catalogAssignmentV17(e){
  const c=catalogCourseV17(e),q=catalogSequenceV17(e,c),u=catalogUnitV17(e,q);
  return {classId:c?.id||'',sequenceId:q?.id||'',unitId:u?.id||'',course:c,sequence:q,unit:u};
}
function catalogAvailableV17(e){
  return !!(e.localFileKey&&storedFileKeys.has(e.localFileKey))||!!catalogArchiveRecordV17(e.sourceArchive);
}
function archiveKeyV17(name){return `catalog-archive-${catalogNormV17(name).replace(/[^a-z0-9]+/g,'-').slice(0,90)}`;}
function catalogFileKeyV17(e){return `catalog-file-${e.catalogId}`;}

async function importCatalogManifestV17(file){
  const data=JSON.parse(await file.text());
  if(data.kind!=='schulcockpit-material-catalog'||!Array.isArray(data.entries))throw new Error('Das ist kein Schulcockpit-Materialbestand.');
  const old=new Map((state.materialCatalog||[]).map(x=>[x.catalogId,x]));
  state.materialCatalog=data.entries.map(e=>({...e,disposition:old.get(e.catalogId)?.disposition||'',localFileKey:old.get(e.catalogId)?.localFileKey||'',activatedMaterialId:old.get(e.catalogId)?.activatedMaterialId||''}));
  state.materialCatalogMeta={schemaVersion:data.schemaVersion||'',schoolYear:data.schoolYear||'',stats:data.stats||{},importedAt:new Date().toISOString(),fileName:file.name};
  ensureMaterialCatalogV17();saveState();render();
}
function findCatalogForLocalFileV17(file){
  const catalog=(state.materialCatalog||[]).filter(e=>e.scope!=='exclude'&&e.disposition!=='excluded');
  const rel=catalogNormV17(file.webkitRelativePath||file.name),base=catalogBaseV17(file.name);
  let exact=catalog.filter(e=>catalogNormV17(e.sourcePath)===rel||catalogNormV17(e.sourcePath).endsWith('/'+rel));
  if(exact.length===1)return exact[0];
  exact=catalog.filter(e=>catalogBaseV17(e.fileName)===base);
  if(exact.length===1)return exact[0];
  if(exact.length>1&&file.webkitRelativePath){
    const scored=exact.map(e=>({e,score:similarityV16(file.webkitRelativePath,e.sourcePath)})).sort((a,b)=>b.score-a.score);
    if(scored[0]?.score>.55&&(scored[0].score-(scored[1]?.score||0)>.08))return scored[0].e;
  }
  return null;
}
function zipEntryForCatalogV17(zip,e){
  const keys=Object.keys(zip.files).filter(k=>!zip.files[k].dir);
  const target=catalogNormV17(e.sourcePath),base=catalogBaseV17(e.fileName);
  let k=keys.find(x=>catalogNormV17(x)===target);if(k)return zip.files[k];
  k=keys.find(x=>target.endsWith('/'+catalogNormV17(x))||catalogNormV17(x).endsWith('/'+target));if(k)return zip.files[k];
  const byBase=keys.filter(x=>catalogBaseV17(x)===base);if(byBase.length===1)return zip.files[byBase[0]];
  if(byBase.length>1){
    const ranked=byBase.map(x=>({x,score:similarityV16(x,e.sourcePath)})).sort((a,b)=>b.score-a.score);
    if(ranked[0])return zip.files[ranked[0].x];
  }
  return null;
}
async function fileFromZipEntryV17(z,e){
  const blob=await z.async('blob');return new File([blob],e.fileName,{type:blob.type||''});
}
async function catalogEntryFileV17(e,preloadedZip=null){
  if(e.localFileKey){
    const r=await fileStoreGet(e.localFileKey);if(r){const b=r.blob||r;return new File([b],r.name||e.fileName,{type:r.type||b.type||''});}
  }
  const ar=catalogArchiveRecordV17(e.sourceArchive);if(!ar?.fileKey)return null;
  const rr=await fileStoreGet(ar.fileKey);if(!rr)return null;
  const zip=preloadedZip||await JSZip.loadAsync(rr.blob||rr);
  const ze=zipEntryForCatalogV17(zip,e);if(!ze)return null;
  return fileFromZipEntryV17(ze,e);
}
async function activateCatalogEntryV17(e,preloadedZip=null,directFile=null){
  if(!['direct_lesson','lesson_variant','lesson_support'].includes(e.scope)||e.preferredForActivation===false)return false;
  const a=catalogAssignmentV17(e);if(!a.classId||!a.sequenceId||!a.unitId)return false;
  const f=directFile||await catalogEntryFileV17(e,preloadedZip);if(!f)return false;
  let m=(state.materials||[]).find(x=>x.catalogId===e.catalogId);
  if(!m){
    m={id:uid('mat'),catalogId:e.catalogId,title:String(e.fileName||'Material').replace(/\.[^.]+$/,''),kind:'file',resourceType:e.resourceType==='digital'?'digital':e.resourceType==='teacher'?'teacher':'print',source:`Materialkatalog · ${e.sourceArchive||''}`,pages:'',tasks:'',variants:[],improvementFlags:[],assignments:[]};
    state.materials.push(m);
  }
  m.assignments=Array.isArray(m.assignments)?m.assignments:[];
  if(!m.assignments.some(x=>x.classId===a.classId&&x.sequenceId===a.sequenceId&&x.unitId===a.unitId))m.assignments.push({classId:a.classId,sequenceId:a.sequenceId,unitId:a.unitId});
  const vt=e.variantType||'standard';let v=(m.variants||[]).find(x=>x.type===vt);
  if(!v){v={id:uid('var'),type:vt,label:variantLabelV15(vt),available:true,fileName:e.fileName,fileKey:null};m.variants.push(v);}
  v.available=true;v.fileName=e.fileName;if(!v.fileKey)v.fileKey=`material-${m.id}-${v.id}`;
  await fileStorePut(v.fileKey,f);e.activatedMaterialId=m.id;
  (state.lessons||[]).filter(l=>l.classId===a.classId&&l.planReference?.unitId===a.unitId).forEach(l=>{l.materials=Array.isArray(l.materials)?l.materials:[];if(!l.materials.includes(m.id))l.materials.push(m.id);});
  return true;
}
async function importCatalogArchiveV17(file){
  if(typeof JSZip==='undefined')throw new Error('ZIP-Unterstützung konnte nicht geladen werden.');
  const matches=(state.materialCatalog||[]).filter(e=>catalogNormV17(e.sourceArchive)===catalogNormV17(file.name));
  if(!matches.length)throw new Error(`Für „${file.name}“ gibt es im Materialkatalog keinen passenden Quellbestand.`);
  const key=archiveKeyV17(file.name);await fileStorePut(key,file);
  const zip=await JSZip.loadAsync(file);let activated=0,found=0;
  for(const e of matches){
    if(e.scope==='exclude')continue;
    const ze=zipEntryForCatalogV17(zip,e);if(ze)found++;
    if(ze&&await activateCatalogEntryV17(e,zip,null))activated++;
  }
  state.materialCatalogArchives[file.name]={fileKey:key,size:file.size,linkedAt:new Date().toISOString(),matched:found,total:matches.length,activated};
  await refreshStoredFileKeys();hydrateWeekResourcesV14();saveState();
  return {found,total:matches.length,activated};
}
async function sendCatalogEntryToInboxV17(e){
  const f=await catalogEntryFileV17(e);if(!f)return alert('Die Datei ist lokal noch nicht verfügbar. Verbinde zuerst das zugehörige ZIP bzw. ziehe den Materialordner ins Cockpit.');
  const a=catalogAssignmentV17(e),id=uid('inbox'),key=`inbox-${id}`;await fileStorePut(key,f);
  state.materialInbox=state.materialInbox||[];
  state.materialInbox.push({id,fileKey:key,fileName:e.fileName,title:String(e.fileName).replace(/\.[^.]+$/,''),classId:a.classId,sequenceId:a.sequenceId,unitId:a.unitId,variantType:e.variantType||'standard',resourceType:e.resourceType==='digital'?'digital':e.resourceType==='teacher'?'teacher':'print',sourcePath:e.sourcePath||'',catalogId:e.catalogId,matchScore:1,matchHint:e.sequenceTitle||'',matchAuto:false});
  saveState();render();
}

const addFilesToInboxBeforeV17=addFilesToInboxV15;
addFilesToInboxV15=async function(files){
  ensureMaterialCatalogV17();
  if(!(state.materialCatalog||[]).length)return addFilesToInboxBeforeV17(files);
  let linked=0,activated=0;const rest=[];
  for(const file of files){
    if(!file||file.name.startsWith('.'))continue;
    if(/\.zip$/i.test(file.name)){rest.push(file);continue;}
    const e=findCatalogForLocalFileV17(file);
    if(!e){rest.push(file);continue;}
    const key=catalogFileKeyV17(e);await fileStorePut(key,file);e.localFileKey=key;linked++;
    if(await activateCatalogEntryV17(e,null,file))activated++;
  }
  let oldCount=0;if(rest.length)oldCount=await addFilesToInboxBeforeV17(rest);
  await refreshStoredFileKeys();hydrateWeekResourcesV14();saveState();
  lastMaterialImportV16={total:linked+oldCount,auto:activated,suggested:linked-activated,unmatched:oldCount};
  return linked+oldCount;
};

function catalogStatsV17(){
  const xs=state.materialCatalog||[],active=xs.filter(e=>e.disposition!=='excluded');
  return {total:xs.length,direct:active.filter(e=>e.scope==='direct_lesson').length,pool:active.filter(e=>['sequence_pool','future_sequence'].includes(e.scope)).length,backlog:active.filter(e=>e.scope==='backlog').length,candidates:active.filter(e=>e.scope==='lesson_candidate').length,archives:Object.keys(state.materialCatalogArchives||{}).length,sources:new Set(xs.map(e=>e.sourceArchive).filter(Boolean)).size};
}
function catalogRowV17(e){
  const a=catalogAssignmentV17(e),available=catalogAvailableV17(e),where=[e.courseLabel,e.sequenceTitle,e.lessonTitle].filter(Boolean).join(' → ');
  return `<article class="catalog-row-v17" data-catalog-search="${esc(catalogNormV17(`${e.fileName} ${where} ${e.note||''}`))}"><div class="catalog-main-v17"><span class="catalog-scope-v17 ${esc(e.scope)}">${esc(catalogScopeLabelV17(e.scope))}</span><strong>${esc(e.fileName)}</strong><small>${esc(where||'noch ohne konkrete Zuordnung')}</small>${e.note?`<p>${esc(e.note)}</p>`:''}</div><div class="catalog-state-v17"><span class="${available?'local':'remote'}">${available?'lokal verfügbar':'nur katalogisiert'}</span>${a.unit?`<small>Plan-Treffer: ${esc(a.unit.title)}</small>`:''}</div><div class="catalog-actions-v17">${available?`<button class="secondary" data-catalog-open="${e.catalogId}">Öffnen</button>`:''}<button class="secondary" data-catalog-inbox="${e.catalogId}">Zuordnen / Alternative</button><button class="danger-lite" data-catalog-exclude="${e.catalogId}">aussortieren</button></div></article>`;
}
function catalogPanelV17(){
  ensureMaterialCatalogV17();const s=catalogStatsV17();
  if(!s.total)return `<section class="panel catalog-setup-v17"><div class="section-head"><div><span class="eyebrow">DEIN MATERIALBESTAND</span><h2>Einmal den gemeinsamen Katalog importieren</h2></div></div><p>Der Katalog enthält die Zuordnungen aus deinen bereits abgeglichenen Jahrgängen 5–11 – keine Unterrichtsdateien selbst. Dadurch bleibt GitHub frei von Materialien.</p><label class="upload-button big-upload">Gesamtbestand importieren<input type="file" id="material-catalog-upload-v17" accept=".json,application/json" hidden></label></section>`;
  const filter=state.settings.catalogFilterV17||'backlog';
  const xs=(state.materialCatalog||[]).filter(e=>e.disposition!=='excluded'&&e.scope===filter).slice(0,120);
  return `<section class="panel catalog-overview-v17"><div class="section-head"><div><span class="eyebrow">MATERIALKATALOG · RELIGION 5–11</span><h2>${s.total} Dateien sind bereits vorsortiert</h2></div><label class="upload-button">Katalog aktualisieren<input type="file" id="material-catalog-upload-v17" accept=".json,application/json" hidden></label></div><div class="catalog-stats-v17"><div><strong>${s.direct}</strong><span>direkte Stundentreffer</span></div><div><strong>${s.pool}</strong><span>Reihenmaterial</span></div><div><strong>${s.backlog}</strong><span>noch nicht eingeplant</span></div><div><strong>${s.archives}/${s.sources}</strong><span>Quellarchive lokal verbunden</span></div></div><div class="catalog-archive-box-v17"><div><strong>Original-ZIPs einmal lokal verbinden</strong><p>Danach kann das Cockpit konkrete Stundenmaterialien automatisch aktivieren und Backlog-Dateien bei Bedarf öffnen. Die ZIPs bleiben im Browser und werden nicht zu GitHub hochgeladen.</p></div><label class="upload-button big-upload">Material-ZIPs auswählen<input type="file" id="material-archive-upload-v17" accept=".zip,application/zip" multiple hidden></label></div><div class="catalog-browser-head-v17"><div><strong>Material durchsuchen</strong><small>„Nicht eingeplant“ ist kein Fehler – oft ist es einfach Material für spätere Reihen.</small></div><select id="catalog-filter-v17"><option value="backlog" ${filter==='backlog'?'selected':''}>Noch nicht eingeplant (${s.backlog})</option><option value="lesson_candidate" ${filter==='lesson_candidate'?'selected':''}>Alternativen / Kandidaten (${s.candidates})</option><option value="sequence_pool" ${filter==='sequence_pool'?'selected':''}>Aktueller Reihenpool</option><option value="future_sequence" ${filter==='future_sequence'?'selected':''}>Spätere geplante Reihen</option><option value="teacher_reference" ${filter==='teacher_reference'?'selected':''}>Lehrkraft / Quellen</option></select><input id="catalog-search-v17" placeholder="Dateiname, Reihe, Thema …"></div><div id="catalog-list-v17" class="catalog-list-v17">${xs.map(catalogRowV17).join('')||'<p class="muted">In dieser Kategorie gibt es keine offenen Dateien.</p>'}</div>${(state.materialCatalog||[]).filter(e=>e.disposition!=='excluded'&&e.scope===filter).length>120?'<p class="microcopy">Es werden die ersten 120 Treffer angezeigt. Nutze die Suche oder einen anderen Filter.</p>':''}</section>`;
}
const materialsViewBeforeV17=materialsView;
materialsView=function(){
  let html=materialsViewBeforeV17();
  return html.replace('<div class="content-grid materials-v15">','<div class="content-grid materials-v15">'+catalogPanelV17());
};

const focusViewBeforeV17=focusView;
focusView=function(){
  ensureMaterialCatalogV17();
  if((state.sequences||[]).length && !(state.materialCatalog||[]).length){
    return `<div class="content-grid"><section class="focus-hero"><div><span class="eyebrow">NÄCHSTER EINMALIGER SCHRITT</span><h2>Deinen abgeglichenen Materialbestand importieren</h2><p>Die Jahrgänge 5–11 sind bereits ausgewertet. Jetzt kommt nur noch der gemeinsame Katalog ins Cockpit – danach musst du die Zuordnungen nicht noch einmal machen.</p></div><button class="primary big" data-view="materials">Materialbestand importieren →</button></section></div>`;
  }
  return focusViewBeforeV17();
};

const wireBeforeV17=wire;wire=function(){
  wireBeforeV17();
  document.getElementById('material-catalog-upload-v17')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{await importCatalogManifestV17(f);alert(`${state.materialCatalog.length} Materialeinträge übernommen.`);}catch(err){alert(err.message||'Materialbestand konnte nicht importiert werden.');}});
  document.getElementById('material-archive-upload-v17')?.addEventListener('change',async e=>{
    const fs=[...(e.target.files||[])];if(!fs.length)return;
    let ok=0,activated=0,problems=[];
    for(const f of fs){try{const r=await importCatalogArchiveV17(f);ok++;activated+=r.activated;}catch(err){problems.push(`${f.name}: ${err.message||err}`);}}
    saveState();render();alert(`${ok} Archiv${ok===1?'':'e'} verbunden.\n${activated} konkrete Stundenmaterialien automatisch aktiviert.${problems.length?`\n\nNicht verarbeitet:\n${problems.join('\n')}`:''}`);
  });
  document.getElementById('catalog-filter-v17')?.addEventListener('change',e=>{state.settings.catalogFilterV17=e.target.value;saveState();render();});
  document.getElementById('catalog-search-v17')?.addEventListener('input',e=>{const q=catalogNormV17(e.target.value);document.querySelectorAll('.catalog-row-v17').forEach(row=>{row.style.display=!q||String(row.dataset.catalogSearch||'').includes(q)?'':'none';});});
  document.querySelectorAll('[data-catalog-open]').forEach(b=>b.onclick=async()=>{const e=catalogEntryV17(b.dataset.catalogOpen);if(!e)return;const f=await catalogEntryFileV17(e);if(!f)return alert('Datei nicht lokal verfügbar. Verbinde zuerst das zugehörige Archiv.');const ext=(e.extension||'').toLowerCase();if(['.pdf','.png','.jpg','.jpeg','.gif','.webp','.txt'].includes(ext)){const u=URL.createObjectURL(f);window.open(u,'_blank');setTimeout(()=>URL.revokeObjectURL(u),60000);}else downloadBlob(e.fileName,f);});
  document.querySelectorAll('[data-catalog-inbox]').forEach(b=>b.onclick=()=>{const e=catalogEntryV17(b.dataset.catalogInbox);if(e)sendCatalogEntryToInboxV17(e);});
  document.querySelectorAll('[data-catalog-exclude]').forEach(b=>b.onclick=()=>{const e=catalogEntryV17(b.dataset.catalogExclude);if(!e)return;if(!confirm(`„${e.fileName}“ aus dem aktiven Backlog aussortieren? Die Datei wird nicht gelöscht.`))return;e.disposition='excluded';saveState();render();});
};

const renderBeforeV17=render;render=function(){renderBeforeV17();const version=document.querySelector('.brand small');if(version)version.textContent=`${state.settings.schoolYear} · V0.17.0`;};
render();


/* ===== V0.17.1 – Materialkatalog aus localStorage auslagern ===== */
const CATALOG_RECORD_KEY_V171='__material_catalog_manifest_v171__';
let catalogPersistTimerV171=null;
let catalogLoadStartedV171=false;

async function persistCatalogV171(){
  ensureMaterialCatalogV17();
  const payload={
    kind:'schulcockpit-material-catalog-local',
    schemaVersion:'1.0',
    entries:state.materialCatalog||[],
    meta:state.materialCatalogMeta||{},
    savedAt:new Date().toISOString()
  };
  const file=new File([JSON.stringify(payload)],'materialkatalog-local.json',{type:'application/json'});
  await fileStorePut(CATALOG_RECORD_KEY_V171,file);
  storedFileKeys.add(CATALOG_RECORD_KEY_V171);
}

function scheduleCatalogPersistV171(){
  clearTimeout(catalogPersistTimerV171);
  catalogPersistTimerV171=setTimeout(()=>{
    if((state.materialCatalog||[]).length)persistCatalogV171().catch(err=>console.error('Materialkatalog konnte nicht gespeichert werden',err));
  },120);
}

// Große Katalogdaten gehören nicht in localStorage. Alle übrigen Cockpit-Daten bleiben dort.
saveState=function(){
  const slim={...state};
  delete slim.materialCatalog;
  // During the one-time V0.18.6 migration the legacy localStorage record can
  // already be at quota. Never interrupt startup before IndexedDB can rescue it.
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(slim));}
  catch(error){if(error?.name!=='QuotaExceededError')throw error;console.warn('Legacy localStorage full; awaiting IndexedDB state migration.');}
  if((state.materialCatalog||[]).length)scheduleCatalogPersistV171();
};

async function loadCatalogV171(){
  if(catalogLoadStartedV171)return;
  catalogLoadStartedV171=true;
  ensureMaterialCatalogV17();

  // Migration für den Fall, dass V0.17 den Katalog doch schon in localStorage ablegen konnte.
  if((state.materialCatalog||[]).length){
    try{await persistCatalogV171();saveState();}catch(err){console.error('Katalog-Migration fehlgeschlagen',err);}
    render();
    return;
  }

  try{
    const rec=await fileStoreGet(CATALOG_RECORD_KEY_V171);
    if(!rec?.blob)return;
    const data=JSON.parse(await rec.blob.text());
    if(!Array.isArray(data.entries))return;
    state.materialCatalog=data.entries;
    state.materialCatalogMeta=data.meta||state.materialCatalogMeta||{};
    render();
  }catch(err){
    console.error('Materialkatalog konnte nicht geladen werden',err);
  }
}

importCatalogManifestV17=async function(file){
  const data=JSON.parse(await file.text());
  if(data.kind!=='schulcockpit-material-catalog'||!Array.isArray(data.entries))throw new Error('Das ist kein Schulcockpit-Materialbestand.');
  const old=new Map((state.materialCatalog||[]).map(x=>[x.catalogId,x]));
  state.materialCatalog=data.entries.map(e=>({...e,disposition:old.get(e.catalogId)?.disposition||'',localFileKey:old.get(e.catalogId)?.localFileKey||'',activatedMaterialId:old.get(e.catalogId)?.activatedMaterialId||''}));
  state.materialCatalogMeta={schemaVersion:data.schemaVersion||'',schoolYear:data.schoolYear||'',stats:data.stats||{},importedAt:new Date().toISOString(),fileName:file.name};
  ensureMaterialCatalogV17();
  await persistCatalogV171();
  saveState();
  render();
};

const renderBeforeV171=render;
render=function(){
  renderBeforeV171();
  const version=document.querySelector('.brand small');
  if(version)version.textContent=`${state.settings.schoolYear} · V0.17.1`;
};

// Nach dem normalen App-Start den großen Katalog asynchron aus IndexedDB nachladen.
loadCatalogV171();
render();

/* ===== V0.17.2 – automatische Aktivierung aus bereits verbundenen ZIPs reparieren ===== */
const catalogEntryFileBeforeV172=catalogEntryFileV17;
catalogEntryFileV17=async function(e,preloadedZip=null){
  if(e.localFileKey){
    const r=await fileStoreGet(e.localFileKey);
    if(r){const b=r.blob||r;return new File([b],r.name||e.fileName,{type:r.type||b.type||''});}
  }
  // Beim erstmaligen Verbinden ist das ZIP bereits im Speicher, aber der Archiv-Datensatz
  // wird erst NACH der Aktivierung angelegt. V0.17.1 hat hier zu früh abgebrochen.
  if(preloadedZip){
    const ze=zipEntryForCatalogV17(preloadedZip,e);
    if(!ze)return null;
    return fileFromZipEntryV17(ze,e);
  }
  return catalogEntryFileBeforeV172(e,null);
};

function retryableCatalogArchivesV172(){
  return Object.entries(state.materialCatalogArchives||{}).filter(([name,rec])=>{
    if(!rec?.fileKey)return false;
    return (state.materialCatalog||[]).some(e=>
      catalogNormV17(e.sourceArchive)===catalogNormV17(name)&&
      ['direct_lesson','lesson_variant','lesson_support'].includes(e.scope)&&
      e.preferredForActivation!==false
    );
  }).map(([name])=>name);
}

async function retryCatalogArchiveActivationV172(name){
  const rec=(state.materialCatalogArchives||{})[name]||catalogArchiveRecordV17(name);
  if(!rec?.fileKey)throw new Error(`„${name}“ ist nicht mehr lokal verfügbar.`);
  const stored=await fileStoreGet(rec.fileKey);
  if(!stored)throw new Error(`„${name}“ ist nicht mehr lokal verfügbar.`);
  const zip=await JSZip.loadAsync(stored.blob||stored);
  const matches=(state.materialCatalog||[]).filter(e=>
    catalogNormV17(e.sourceArchive)===catalogNormV17(name)&&e.scope!=='exclude'&&e.disposition!=='excluded'
  );
  let found=0,activated=0;
  for(const e of matches){
    const ze=zipEntryForCatalogV17(zip,e);
    if(ze)found++;
    if(ze&&await activateCatalogEntryV17(e,zip,null))activated++;
  }
  rec.matched=found;
  rec.total=matches.length;
  rec.activated=activated;
  rec.activationCheckedAt=new Date().toISOString();
  await refreshStoredFileKeys();
  hydrateWeekResourcesV14();
  saveState();
  return {found,total:matches.length,activated};
}

async function retryAllCatalogArchivesV172(){
  const names=retryableCatalogArchivesV172();
  let archives=0,activated=0,problems=[];
  for(const name of names){
    try{
      const r=await retryCatalogArchiveActivationV172(name);
      archives++;activated+=r.activated;
    }catch(err){problems.push(`${name}: ${err.message||err}`);}
  }
  render();
  return {archives,activated,problems};
}

const catalogPanelBeforeV172=catalogPanelV17;
catalogPanelV17=function(){
  let html=catalogPanelBeforeV172();
  const retry=retryableCatalogArchivesV172().filter(name=>{
    const rec=(state.materialCatalogArchives||{})[name]||{};
    return !rec.activationCheckedAt || Number(rec.activated||0)===0;
  });
  if(!retry.length)return html;
  const button=`<button class="secondary" data-retry-catalog-archives-v172>Bereits verbundene ZIPs prüfen (${retry.length})</button>`;
  return html.replace('<label class="upload-button big-upload">Material-ZIPs auswählen',button+'<label class="upload-button big-upload">Material-ZIPs auswählen');
};

const wireBeforeV172=wire;
wire=function(){
  wireBeforeV172();
  document.querySelector('[data-retry-catalog-archives-v172]')?.addEventListener('click',async b=>{
    b.currentTarget.disabled=true;
    b.currentTarget.textContent='Prüfe verbundene ZIPs …';
    try{
      const r=await retryAllCatalogArchivesV172();
      alert(`${r.archives} verbundene${r.archives===1?'s Archiv':' Archive'} geprüft.\n${r.activated} konkrete Stundenmaterialien aktiviert.${r.problems.length?`\n\nProbleme:\n${r.problems.join('\n')}`:''}`);
    }catch(err){
      alert(err.message||'Die verbundenen ZIPs konnten nicht erneut geprüft werden.');
      render();
    }
  });
};

const renderBeforeV172=render;
render=function(){
  renderBeforeV172();
  const version=document.querySelector('.brand small');
  if(version)version.textContent=`${state.settings.schoolYear} · V0.17.2`;
};

render();

/* ===== V0.17.3 – PowerPoint-Paketierung auf JSZip umgestellt =====
   Safari/macOS kann bei dem bisherigen handgebauten ZIP-Writer PPTX-Dateien
   erzeugen, deren ZIP-Container von PowerPoint als beschädigt bewertet wird.
   Die OOXML-Folien bleiben unverändert; nur Lesen/Schreiben des Office-ZIPs
   läuft jetzt über das bereits gebündelte JSZip. */

v13ZipRead = async function(buf){
  if(typeof JSZip==='undefined') throw new Error('JSZip wurde nicht geladen. Bitte die Datei jszip.min.js zusammen mit dem Cockpit hochladen.');
  let zip;
  try{ zip=await JSZip.loadAsync(buf,{checkCRC32:true}); }
  catch(err){ throw new Error(`PowerPoint-Master konnte nicht als Office-ZIP gelesen werden: ${err?.message||err}`); }
  const out=new Map();
  for(const [name,obj] of Object.entries(zip.files)){
    if(obj.dir) continue;
    out.set(name,await obj.async('uint8array'));
  }
  return out;
};

async function v173ValidatePptPackage(blob){
  const zip=await JSZip.loadAsync(await blob.arrayBuffer(),{checkCRC32:true});
  const must=['[Content_Types].xml','_rels/.rels','ppt/presentation.xml','ppt/_rels/presentation.xml.rels'];
  for(const name of must) if(!zip.file(name)) throw new Error(`PowerPoint-Paket unvollständig: ${name} fehlt.`);
  const pres=await zip.file('ppt/presentation.xml').async('string');
  const rels=await zip.file('ppt/_rels/presentation.xml.rels').async('string');
  const ids=[...pres.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].map(m=>m[1]);
  if(!ids.length) throw new Error('PowerPoint-Paket enthält keine Folienreferenzen.');
  const relMap=new Map([...rels.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bType="[^"]*\/slide"[^>]*\bTarget="([^"]+)"[^>]*\/?\s*>/g)].map(m=>[m[1],m[2]]));
  for(const id of ids){
    const target=relMap.get(id);
    if(!target) throw new Error(`PowerPoint-Paket: Folienbeziehung ${id} fehlt.`);
    const path=target.startsWith('/')?target.slice(1):`ppt/${target.replace(/^\.\//,'')}`;
    if(!zip.file(path)) throw new Error(`PowerPoint-Paket: referenzierte Folie ${path} fehlt.`);
  }
  return true;
}

v13ZipWrite = async function(entries){
  if(typeof JSZip==='undefined') throw new Error('JSZip wurde nicht geladen.');
  const zip=new JSZip();
  for(const [name,data0] of entries){
    const data=data0 instanceof Uint8Array?data0:new Uint8Array(data0);
    zip.file(name,data,{binary:true,date:new Date()});
  }
  const blob=await zip.generateAsync({
    type:'blob',
    mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    compression:'DEFLATE',
    compressionOptions:{level:6},
    platform:'DOS'
  });
  await v173ValidatePptPackage(blob);
  return blob;
};

const generateMomijiPptV13BeforeV173=generateMomijiPptV13;
generateMomijiPptV13=async function(l){
  try{
    return await generateMomijiPptV13BeforeV173(l);
  }catch(err){
    console.error('PPTX generation failed',err);
    throw err;
  }
};

const renderBeforeV173=render;
render=function(){
  renderBeforeV173();
  const version=document.querySelector('.brand small');
  if(version)version.textContent=`${state.settings.schoolYear} · V0.17.3`;
};

/* ===== V0.17.4 – Safari XML-Prolog-Fix für PowerPoint =====
   Safari XMLSerializer kann die XML-Deklaration bereits mit ausgeben.
   V0.17.x hat bei drei zentralen Office-Parts zusätzlich selbst eine Deklaration
   vorangestellt. Das erzeugte z.B. "?><?xml ...?>" und PowerPoint verweigerte
   die Datei. Wir normalisieren jetzt auf GENAU eine XML-Deklaration und prüfen
   alle XML/RELS-Parts vor dem Download. */

function v174SerializeXmlDocument(doc){
  let xml=new XMLSerializer().serializeToString(doc);
  // Browser-unabhängig: 0, 1 oder mehrere vorhandene Prologe entfernen.
  xml=xml.replace(/^\s*(?:<\?xml\s+[^?]*\?>\s*)+/i,'');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xml}`;
}

v13ReplacePresentation=function(entries,count){
  const parser=new DOMParser();
  const ns='http://schemas.openxmlformats.org/presentationml/2006/main';
  const rns='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const rels='http://schemas.openxmlformats.org/package/2006/relationships';
  const ct='http://schemas.openxmlformats.org/package/2006/content-types';

  const pDoc=parser.parseFromString(v13String(entries.get('ppt/presentation.xml')),'application/xml');
  let lst=pDoc.getElementsByTagNameNS(ns,'sldIdLst')[0];
  if(!lst){lst=pDoc.createElementNS(ns,'p:sldIdLst');pDoc.documentElement.appendChild(lst);}
  while(lst.firstChild)lst.removeChild(lst.firstChild);
  for(let i=0;i<count;i++){
    const el=pDoc.createElementNS(ns,'p:sldId');
    el.setAttribute('id',String(256+i));
    el.setAttributeNS(rns,'r:id',`rIdSlide${i+1}`);
    lst.appendChild(el);
  }
  entries.set('ppt/presentation.xml',v13Bytes(v174SerializeXmlDocument(pDoc)));

  const relDoc=parser.parseFromString(v13String(entries.get('ppt/_rels/presentation.xml.rels')),'application/xml');
  [...relDoc.getElementsByTagNameNS(rels,'Relationship')].forEach(el=>{
    if((el.getAttribute('Type')||'').endsWith('/slide'))el.remove();
  });
  for(let i=0;i<count;i++){
    const el=relDoc.createElementNS(rels,'Relationship');
    el.setAttribute('Id',`rIdSlide${i+1}`);
    el.setAttribute('Type','http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide');
    el.setAttribute('Target',`slides/slide${i+1}.xml`);
    relDoc.documentElement.appendChild(el);
  }
  entries.set('ppt/_rels/presentation.xml.rels',v13Bytes(v174SerializeXmlDocument(relDoc)));

  const ctDoc=parser.parseFromString(v13String(entries.get('[Content_Types].xml')),'application/xml');
  [...ctDoc.getElementsByTagNameNS(ct,'Override')].forEach(el=>{
    const part=el.getAttribute('PartName')||'';
    if(part.startsWith('/ppt/slides/slide'))el.remove();
    if(part==='/ppt/presentation.xml')el.setAttribute('ContentType','application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml');
  });
  for(let i=0;i<count;i++){
    const el=ctDoc.createElementNS(ct,'Override');
    el.setAttribute('PartName',`/ppt/slides/slide${i+1}.xml`);
    el.setAttribute('ContentType','application/vnd.openxmlformats-officedocument.presentationml.slide+xml');
    ctDoc.documentElement.appendChild(el);
  }
  entries.set('[Content_Types].xml',v13Bytes(v174SerializeXmlDocument(ctDoc)));
};

const v173ValidatePptPackageBeforeV174=v173ValidatePptPackage;
v173ValidatePptPackage=async function(blob){
  await v173ValidatePptPackageBeforeV174(blob);
  const zip=await JSZip.loadAsync(await blob.arrayBuffer(),{checkCRC32:true});
  const parser=new DOMParser();
  for(const [name,obj] of Object.entries(zip.files)){
    if(obj.dir || !(name.endsWith('.xml') || name.endsWith('.rels'))) continue;
    const xml=await obj.async('string');
    const decls=(xml.match(/<\?xml\b/gi)||[]).length;
    if(decls>1) throw new Error(`PowerPoint-Paket ungültig: ${name} enthält ${decls} XML-Deklarationen.`);
    const doc=parser.parseFromString(xml,'application/xml');
    const errors=doc.getElementsByTagName('parsererror');
    if(errors?.length) throw new Error(`PowerPoint-Paket ungültig: XML-Fehler in ${name}.`);
  }
  return true;
};

const renderBeforeV174=render;
render=function(){
  renderBeforeV174();
  const version=document.querySelector('.brand small');
  if(version)version.textContent=`${state.settings.schoolYear} · V0.17.4`;
};

/* ===== V0.17.5 – kognitive Einstiege und gemeinsam erarbeitete Sicherung =====
   Didaktik und Generator stimmen überein: Top/Flop und Fehlerdetektiv gehören
   direkt nach Moin; das antizipierte Sicherungsergebnis bleibt Lehrkraftnotiz.
   Bereits importierte Stunden benötigen keinen erneuten ChatGPT-Import. */

function v175IsCognitive(sl){
  const kind=v13SlideKind(sl);
  return kind==='topflop'||kind==='fehler';
}
function v175Statement(sl){
  const explicit=v13Text(sl.statement).trim();if(explicit)return explicit;
  const content=v13Lines(sl.content)[0];if(content)return content;
  const title=v13Text(sl.title).trim();
  return /^(?:top\s*(?:oder|\/)\s*flop|topflop)$/i.test(title)?'':title;
}
function v175HasStatement(sl){return !!v175Statement(sl);}
function v175IsWorkPhase(sl){
  return ['task','taskSteps','bild','sicherung','diskursiv','exit'].includes(v13SlideKind(sl));
}
function v175CognitiveSplit(l){
  const original=(l.slides||[]).filter(sl=>v13SlideKind(sl)!=='moin');
  const entry=[],main=[],deferred=[];
  let workStarted=false;
  for(const sl of original){
    if(v175IsCognitive(sl)){
      if(v13SlideKind(sl)==='topflop'&&!v175HasStatement(sl))continue;
      // Alte importierte Pläne benutzten Top/Flop häufig NACH dem neuen Arbeitsblatt
      // als Verständnischeck. Diese Aussagen sind noch kein Vorwissen und dürfen
      // didaktisch nicht einfach vor die Erarbeitung gezogen werden.
      (workStarted?deferred:entry).push(sl);
    }else{
      main.push(sl);
      if(v175IsWorkPhase(sl))workStarted=true;
    }
  }
  return {entry,main,deferred};
}
function v175OrderedSlides(l){
  const split=v175CognitiveSplit(l);
  return [...split.entry,...split.main];
}
function v175DeferredNotes(l){
  const checks=v175CognitiveSplit(l).deferred;
  if(!checks.length)return '';
  const out=['OPTIONALE VERSTÄNDNISKONTROLLE AUS EINEM ÄLTEREN FOLIENPLAN – NUR LEHRKRAFTNOTIZEN',
    'Diese Aussagen standen erst NACH der Erarbeitung. Sie sind kein geeigneter Rückblick vor der neuen Stunde und werden daher nicht als Top/Flop-/Fehlerdetektiv-Einstiegsfolien ausgegeben. Bei Bedarf nach der Erarbeitung mündlich nutzen.'];
  for(const sl of checks){
    if(v13SlideKind(sl)==='topflop'){
      out.push(`Top/Flop: ${v175Statement(sl)} – ${v175IsTop(sl)?'TOP':'FLOP'}${sl.correction?` – Korrektur: ${sl.correction}`:''}`);
    }else{
      out.push(`Fehlerdetektiv: ${v13JoinMain(sl).join(' · ')}${sl.correction?` – Korrektur: ${sl.correction}`:''}`);
    }
  }
  return out.join('\n\n');
}
function v175ListLines(lines){return v13Lines(lines).map(t=>`• ${t}`).join('\n');}
function v175NoteText(sl,kind){
  const text=v13Text(sl.notes||'').trim();
  const out=[];
  if(kind==='sicherung'){
    out.push('ERWARTUNGSHORIZONT / ANTIZIPIERTES TAFELBILD – NUR FÜR DIE LEHRKRAFT');
    out.push('Die sichtbare Sicherungsfolie bleibt zunächst leer. Die Ergebnisse im Unterricht mit den Schüler:innen sammeln, prüfen und formulieren.');
    if(sl.title && !/^sicherung$/i.test(sl.title.trim()))out.push(`Leitfrage/Schwerpunkt: ${sl.title}`);
    if(v13Lines(sl.content).length)out.push(`Was halten wir fest?\n${v175ListLines(sl.content)}`);
    if(v13Lines(sl.secondary).length)out.push(`Besonders wichtig:\n${v175ListLines(sl.secondary)}`);
    if(v13Lines(sl.tertiary).length)out.push(`Mögliche offene Fragen:\n${v175ListLines(sl.tertiary)}`);
    if(text)out.push(`Didaktische Hinweise:\n${text}`);
    return out.join('\n\n');
  }
  if(kind==='diskursiv'){
    out.push('DISKURSIVE SICHERUNG – NUR LEHRKRAFTNOTIZEN');
    out.push('Die tatsächlichen Schülerlösungen im Unterricht gegenüberstellen. Erwartete Lösungen und Vergleiche nicht vorab auf die Folie schreiben.');
    if(v13Lines(sl.solutionA).length)out.push(`Erwartete Lösung A:\n${v175ListLines(sl.solutionA)}`);
    if(v13Lines(sl.solutionB).length)out.push(`Erwartete Lösung B:\n${v175ListLines(sl.solutionB)}`);
    if(v13Lines(sl.comparison).length)out.push(`Vergleichspunkte:\n${v175ListLines(sl.comparison)}`);
    if(v13Lines(sl.takeaway).length)out.push(`Gemeinsame Erkenntnis:\n${v175ListLines(sl.takeaway)}`);
    if(text)out.push(`Didaktische Hinweise:\n${text}`);
    return out.join('\n\n');
  }
  if(kind==='fehler'){
    if(sl.correction)out.push(`Erwartete Korrektur:\n${sl.correction}`);
    if(text)out.push(text);
    return out.join('\n\n');
  }
  return text;
}
function v175IsTop(sl){
  const answer=v13Text(sl.answer).trim().toLowerCase();
  if(answer)return ['top','richtig','true','wahr'].includes(answer);
  // Historische Importe ohne answer: nur eindeutige Notiz, nicht „Top oder Flop“.
  return /(?:^|\n)\s*(?:antwort\s*:\s*|ergebnis\s*:\s*)?top\b/i.test(v13Text(sl.notes));
}
function v175TopFlopNotes(sl,answerSlide){
  const top=v175IsTop(sl);
  const out=[`Kognitiver Einstieg – Rückgriff auf bereits erarbeitete Inhalte.\nErwartete Einordnung: ${top?'TOP':'FLOP'}.`];
  if(!top&&sl.correction)out.push(`Korrektur: ${sl.correction}`);
  if(sl.notes)out.push(`Lehrkrafthinweis: ${sl.notes}`);
  if(!answerSlide)out.push('Erst begründen lassen; Ergebnis erst auf der folgenden Folie zeigen.');
  return out.join('\n\n');
}

v13PhysicalSlides=async function(l,layoutMap){
  const picker=v13Picker(`${l.id}|${l.date}|${l.title}`),out=[];
  let prevTF=false;
  out.push({layout:v13FindLayout(layoutMap,'Title Slide'),ph:[v13Ph(1,l.title||v13ShortFooter(l),'subTitle')],notes:''});
  for(const sl of v175OrderedSlides(l)){
    const kind=v13SlideKind(sl);
    if(kind==='topflop'){
      const statement=sl.statement||sl.title||v13Lines(sl.content)[0]||'';
      if(!statement.trim())continue;
      if(!prevTF){
        const h=picker.pick(MOMIJI_V13.backgrounds.topflopTitle);
        out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('topflopTitle',h)),ph:[],notes:'Kognitiver Einstieg: Vorwissen aus den letzten Stunden aktivieren; Aussagen begründen lassen.'});
      }
      const h=picker.pick(MOMIJI_V13.backgrounds.topflop);
      out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('topflopTask',h)),ph:[v13Ph(11,statement)],notes:v175TopFlopNotes(sl,false)});
      const top=v175IsTop(sl);
      out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel(top?'topflopTop':'topflopFlop',h)),
        ph:[v13Ph(11,statement),...(!top&&sl.correction?[v13Ph(12,sl.correction)]:[])],notes:v175TopFlopNotes(sl,true)});
      prevTF=true;continue;
    }
    prevTF=false;
    if(kind==='thema'){
      const h=picker.pick(MOMIJI_V13.backgrounds.thema),main=v13JoinMain(sl);
      out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('thema',h)),ph:[v13Ph(11,sl.title||l.title),v13Ph(13,main.slice(1))],notes:v175NoteText(sl,kind)});continue;
    }
    if(kind==='fehler'){
      const h=picker.pick(MOMIJI_V13.backgrounds.fehler);
      out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('fehler',h)),ph:[v13Ph(11,v13JoinMain(sl))],notes:v175NoteText(sl,kind)});continue;
    }
    if(kind==='bild'){
      const h=picker.pick(MOMIJI_V13.backgrounds.bild),img=await v13ResolveImage(sl);
      if(!img)throw new Error(`Bildimpuls „${sl.title||sl.imageMaterial||'ohne Titel'}“ braucht ein PNG/JPG im Material-Hub. Verknüpfter Name: ${sl.imageMaterial||'fehlt'}`);
      out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('bild',h)),ph:[],image:img,notes:v175NoteText(sl,kind)});continue;
    }
    if(kind==='task'){
      const h=picker.pick(MOMIJI_V13.backgrounds.task),task=v13JoinMain(sl);
      out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('task',h)),ph:[v13Ph(13,task,'body'),v13Ph(14,sl.socialForm),v13Ph(15,sl.time),v13Ph(16,sl.material)],notes:v175NoteText(sl,kind)});continue;
    }
    if(kind==='taskSteps'){
      const h=picker.pick(MOMIJI_V13.backgrounds.taskSteps),steps=(sl.steps?.length?sl.steps:v13JoinMain(sl)).slice(0,4),ph=[];
      steps.forEach((x,i)=>ph.push(v13Ph(13+i,x,'body')));
      ph.push(v13Ph(17,sl.socialForm),v13Ph(18,sl.time),v13Ph(19,sl.material));
      out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('taskSteps',h)),ph,notes:v175NoteText(sl,kind)});continue;
    }
    if(kind==='sicherung'){
      const h=picker.pick(MOMIJI_V13.backgrounds.sicherung);
      // Master liefert bereits „Was halten wir fest?“, „Besonders wichtig“ und „Offene Fragen“.
      // Keine fertigen Erkenntnisse/Begriffe vorwegnehmen – weder bei alten noch neuen Importen.
      out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('sicherung',h)),
        ph:[v13Ph(13,[],'body'),v13Ph(14,[],'body'),v13Ph(15,[],'body')],notes:v175NoteText(sl,kind)});continue;
    }
    if(kind==='diskursiv'){
      const h=picker.pick(MOMIJI_V13.backgrounds.diskursiv);
      out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('diskursiv',h)),ph:[],manual:[],notes:v175NoteText(sl,kind)});continue;
    }
    if(kind==='exit'){
      const h=picker.pick(MOMIJI_V13.backgrounds.exit);
      out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('exit',h)),ph:[v13Ph(13,v13JoinMain(sl),'body'),v13Ph(14,sl.tertiary,'body')],notes:v175NoteText(sl,kind)});continue;
    }
    const h=picker.pick(MOMIJI_V13.backgrounds.text);
    out.push({layout:v13FindLayout(layoutMap,v13LayoutLabel('text',h)),ph:[v13Ph(11,v13JoinMain(sl))],notes:v175NoteText(sl,kind)});
  }
  const deferred=v175DeferredNotes(l);
  if(deferred){
    const target=[...out].reverse().find(s=>v13Text(s.notes).includes('ERWARTUNGSHORIZONT / ANTIZIPIERTES TAFELBILD')) || out[out.length-1];
    target.notes=[v13Text(target.notes).trim(),deferred].filter(Boolean).join('\n\n');
  }
  out.forEach((s,i)=>{if(i>0)s.ph=[...v13BasePh(l,i+1),...(s.ph||[])];});
  return out;
};

function v175NotesParas(note){
  return v13Text(note).replace(/\r\n?/g,'\n').split('\n').map(t=>
    `<a:p>${t?`<a:r><a:rPr lang="de-DE"/><a:t>${v13Xml(t)}</a:t></a:r>`:''}<a:endParaRPr lang="de-DE"/></a:p>`).join('');
}
function v175NotesSlideXml(slideNo,note){
  return v13Bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
    `<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`+
    `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`+
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`+
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>`+
    `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="3" sz="quarter"/></p:nvPr></p:nvSpPr><p:spPr/>`+
    `<p:txBody><a:bodyPr/><a:lstStyle/>${v175NotesParas(note)}</p:txBody></p:sp>`+
    `<p:sp><p:nvSpPr><p:cNvPr id="4" name="Slide Number Placeholder 3"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldNum" idx="5" sz="quarter"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>`+
    `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`);
}
function v175NotesRels(slideNo){
  return v13Bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`+
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/>`+
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${slideNo}.xml"/>`+
    `</Relationships>`);
}
function v175SlideRels(layoutNum,imageTarget='',notesNum=0){
  const rel=[`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${layoutNum}.xml"/>`];
  if(imageTarget)rel.push(`<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${v13Xml(imageTarget)}"/>`);
  if(notesNum)rel.push(`<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${notesNum}.xml"/>`);
  return v13Bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel.join('')}</Relationships>`);
}
function v175AddNotesContentTypes(entries,noteNumbers){
  if(!noteNumbers.length)return;
  const parser=new DOMParser(),ns='http://schemas.openxmlformats.org/package/2006/content-types';
  const doc=parser.parseFromString(v13String(entries.get('[Content_Types].xml')),'application/xml');
  const overrides=[...doc.getElementsByTagNameNS(ns,'Override')];
  for(const el of overrides)if((el.getAttribute('PartName')||'').startsWith('/ppt/notesSlides/notesSlide'))el.remove();
  for(const number of noteNumbers){
    const el=doc.createElementNS(ns,'Override');
    el.setAttribute('PartName',`/ppt/notesSlides/notesSlide${number}.xml`);
    el.setAttribute('ContentType','application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml');
    doc.documentElement.appendChild(el);
  }
  entries.set('[Content_Types].xml',v13Bytes(v174SerializeXmlDocument(doc)));
}
async function v175ValidateNotes(blob,noteNumbers){
  if(!noteNumbers.length)return;
  const zip=await JSZip.loadAsync(await blob.arrayBuffer(),{checkCRC32:true});
  const types=await zip.file('[Content_Types].xml').async('string');
  for(const n of noteNumbers){
    const name=`ppt/notesSlides/notesSlide${n}.xml`;
    if(!zip.file(name)||!zip.file(`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`))throw new Error(`PowerPoint-Notizen fehlen: Folie ${n}.`);
    if(!types.includes(`/ppt/notesSlides/notesSlide${n}.xml`))throw new Error(`PowerPoint-Notizen fehlen in Content Types: Folie ${n}.`);
    const sr=await zip.file(`ppt/slides/_rels/slide${n}.xml.rels`).async('string');
    if(!sr.includes(`../notesSlides/notesSlide${n}.xml`))throw new Error(`Notizen nicht mit Folie ${n} verknüpft.`);
  }
}

generateMomijiPptV13=async function(l){
  const rec=await fileStoreGet('__ppt_master__');
  if(!rec?.blob)throw new Error('PowerPoint-Master fehlt. Im Montagsmodus einmal „Master auswählen“ anklicken.');
  const entries=await v13ZipRead(await rec.blob.arrayBuffer()),layoutMap=v13LayoutMap(entries);
  if(layoutMap.size<100)throw new Error(`Im Master wurden nur ${layoutMap.size} Layouts gefunden. Erwartet wird dein Momiji-Master mit über 100 Layouts.`);
  if(!entries.has('ppt/notesMasters/notesMaster1.xml'))throw new Error('Notizenmaster fehlt im ausgewählten Momiji-Master. Bitte den aktuellen Originalmaster erneut hinterlegen.');
  const physical=await v13PhysicalSlides(l,layoutMap);
  if(!physical.length)throw new Error('Keine Folien zum Erzeugen vorhanden.');
  for(const key of [...entries.keys()])if(/^ppt\/(slides|notesSlides)\//.test(key))entries.delete(key);
  let imageCounter=1;
  const noteNumbers=[];
  for(let i=0;i<physical.length;i++){
    const s=physical[i],n=i+1;
    let imageTarget='';
    if(s.image){imageTarget=`sc_generated_${imageCounter++}.${s.image.ext}`;entries.set(`ppt/media/${imageTarget}`,s.image.bytes);}
    const hasNotes=!!v13Text(s.notes).trim();
    entries.set(`ppt/slides/slide${n}.xml`,v13SlideXml(s.ph||[],s.manual||[],imageTarget?'rId2':''));
    entries.set(`ppt/slides/_rels/slide${n}.xml.rels`,v175SlideRels(s.layout,imageTarget,hasNotes?n:0));
    if(hasNotes){
      noteNumbers.push(n);
      entries.set(`ppt/notesSlides/notesSlide${n}.xml`,v175NotesSlideXml(n,s.notes));
      entries.set(`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`,v175NotesRels(n));
    }
  }
  v13ReplacePresentation(entries,physical.length); // V0.17.4: Safari-Prolog-Normalisierung bleibt aktiv.
  v175AddNotesContentTypes(entries,noteNumbers);
  const blob=await v13ZipWrite([...entries.entries()]); // XML/RELS-Prüfung bleibt aktiv.
  await v175ValidateNotes(blob,noteNumbers);
  const c=cls(l.classId);
  const name=safeName(`${l.date}_${c?.subject||''}_${c?.name||''}_${l.footerTopic||l.title||'Unterricht'}`)+'.pptx';
  const pptKey=`lesson-ppt-${l.id}`;
  try{await fileStorePut(pptKey,new File([blob],name,{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}));storedFileKeys.add(pptKey);l.presentationBlobKeyV180=pptKey;l.presentationSourceV177='generated';}catch(err){console.warn('PPTX konnte nicht lokal archiviert werden',err);}
  downloadBlob(name,blob);
  l.presentationReady=true;l.presentationFileName=name;l.presentationGeneratedAt=new Date().toISOString();
  saveState();render();return name;
};

// Künftige ChatGPT-Importe sollen dieselbe didaktische Regel verwenden.
const v175PromptBefore=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
  let prompt=v175PromptBefore(l);
  const rules=`## PowerPoint-Regeln für den Rückimport (verbindlich)\nDer Momiji-Master wird für die Präsentation verwendet. „Moin!“ kommt automatisch zuerst; Footer (Kurzthema), Datum und Seitenzahl werden vom Cockpit gesetzt und dürfen erhalten bleiben.\n\n**Kognitiver Einstieg:** „topflop“ und „fehlerdetektiv“ sind ausschließlich kurze Wiederholungs-/Aktivierungsformate für bereits eingeführte Inhalte aus der vorherigen bzw. früheren Stunden. Wenn sinnvoll, platziere sie unmittelbar nach Moin und vor dem Einstieg ins neue Thema. Keine Top/Flop-Aussagen mitten in der Erarbeitung. Auch Aussagen über Inhalte, die erst im heutigen Arbeitsblatt eingeführt werden, gehören NICHT als Wiederholung an den Stundenanfang; diese ggf. als optionale mündliche Verständnisfragen in den Sicherungsnotizen aufführen. Ist noch kein geeignetes Vorwissen vorhanden, erfinde keinen künstlichen Rückblick. Bei Top/Flop je Aussage answer="top" oder "flop" angeben; bei flop zusätzlich correction. Der Generator erzeugt Titelfolie, Aufgabenfolie und direkt anschließend die Ergebnisfolie automatisch.\n\n**Sicherung wird gemeinsam mit der Lerngruppe erarbeitet:** In „sicherung“ sind content und secondary ausschließlich antizipierte Ergebnisse/erwartetes Tafelbild für meine REFERENTENNOTIZEN; niemals als fertige sichtbare Folieninhalte! notes enthält Gesprächsführung, Nachfragen oder didaktische Hinweise. Die sichtbare Masterfolie zeigt nur die leeren Bereiche „Was halten wir fest?“, „Besonders wichtig“ und „Offene Fragen“. Bei „sicherung_diskursiv“ sind solutionA, solutionB, comparison und takeaway ebenfalls nur Lehrkraftnotizen; echte Schülerlösungen werden im Unterricht verglichen. So können die Kinder die Ergebnisse selbst formulieren.\n\nWeitere Typen: „text“ = allgemeiner Impuls; „bildimpuls“ benötigt imageMaterial (exakter PNG/JPG-Materialtitel); „arbeitsauftrag“ = einfacher Arbeitsauftrag; „arbeitsauftrag_schritte“ = bis zu vier steps; „exit“ = Exit-Ticket/Ausblick; „thema“ nur bei didaktischem Mehrwert. Schreibe keine künstlichen Zusatzfolien. Nutze „notes“ für Lehrerhinweise und Erwartungshorizonte, nicht für Schülertext.\nDer lesson.footer ist ein kurzes heutiges Thema (ca. 2–6 Wörter).\n\n`;
  prompt=prompt.replace(/## PowerPoint-Regeln für den Rückimport[\s\S]*?(?=Danach hänge GENAU EINEN maschinenlesbaren Block an:)/,rules);
  prompt=prompt.replace(
    '{"type":"sicherung","content":["..."],"secondary":["..."],"tertiary":[]}',
    '{"type":"sicherung","title":"Gemeinsam sichern","content":["erwartetes Ergebnis – NUR NOTIZEN"],"secondary":["besonders wichtiger Merksatz – NUR NOTIZEN"],"tertiary":[],"notes":"Leitfragen für die gemeinsame Sicherung"}'
  );
  return prompt;
};
makeBrief=concretePlanningPromptV12;

const v175RuleSummaryBefore=v13PowerPointRuleSummary;
v13PowerPointRuleSummary=function(){return `<div class="ppt-rule-grid"><span>✓ Moin → kognitiver Einstieg → Hauptteil</span><span>✓ Top/Flop & Fehlerdetektiv nur zur Wiederholung</span><span>✓ Sicherung gemeinsam erarbeiten</span><span>✓ Erwartungshorizont in Referentennotizen</span><span>✓ Footer, Datum & Seitenzahl unverändert</span><span>✓ Top/Flop Aufgabe + Ergebnis gleiches Motiv</span></div>`;};

const v175RenderBefore=render;
render=function(){
  v175RenderBefore();
  const version=document.querySelector('.brand small');if(version)version.textContent=`${state.settings.schoolYear} · V0.17.5`;
  const grid=document.querySelector('.ppt-rule-grid');if(grid)grid.outerHTML=v13PowerPointRuleSummary();
};
render();

/* ===== V0.17.6 – editierbare Materialpakete & klare Wochenführung =====
   Ein Reihenplan-Hinweis ist keine einzelne Datei. Ein Materialpaket kann
   mehrere unabhängige Ausdrucke, digitale Ressourcen oder Referenzen enthalten.
   Bestehende Katalogdateien werden verknüpft; große Blobs bleiben in IndexedDB. */
let resourceEditorV176={lessonId:'',key:''};
let materialCardOpenV176=new Set();
function resourceBundleKeyV176(h){return resourceKeyV14(h);}
function resourceBundlesV176(l){if(!l.resourceBundlesV176||typeof l.resourceBundlesV176!=='object')l.resourceBundlesV176={};return l.resourceBundlesV176;}
function resourceBundleV176(l,h,create=false){const k=resourceBundleKeyV176(h),all=resourceBundlesV176(l);if(!all[k]&&create)all[k]={title:h,items:[],complete:false,deferred:false,note:''};return all[k]||null;}
function bundleItemsV176(l,h){return (resourceBundleV176(l,h)?.items||[]).map(x=>({...x,m:mat(x.materialId),v:variant(x.materialId,x.variantId)}));}
function resourceIsEditorV176(l,h){return resourceEditorV176.lessonId===l.id&&resourceEditorV176.key===resourceBundleKeyV176(h);}
function resourceEditorIdV176(l,h){return `${l.id}|${encodeURIComponent(h)}`;}
function displayResourceTitleV176(l,h){return resourceBundleV176(l,h)?.title||h;}
function resourceFileRoleV176(filename){const raw=String(filename||'').toLowerCase(),n=catalogNormV17(filename);if(/lösung|loesung|solution|answer/.test(raw))return 'solution';if(/förder|foerder|grundlag|leicht/.test(raw))return 'support';if(/forderung|challenge|vertief|knobel/.test(raw))return 'challenge';if(/daz|einfache sprache/.test(raw))return 'daz';return 'standard';}
function isPrintVariantV176(v,m){return m?.resourceType!=='digital'&&m?.resourceType!=='teacher'&&v?.type!=='solution';}
function selectedPrintItemsV176(l,h){return bundleItemsV176(l,h).filter(x=>x.m&&x.v&&isPrintVariantV176(x.v,x.m));}
function removeGhostPlanV176(l,h){
  const b=resourceBundleV176(l,h);if(!b?.items?.length)return;
  const ids=new Set(b.items.map(x=>x.materialId));const normalized=normalizeHintV12(h);
  (l.printPlan||[]).forEach(p=>{if(ids.has(p.materialId))return;const m=mat(p.materialId);if(m&&normalizeHintV12(m.title)===normalized&&(!m.catalogId||m.source==='Reihenplanung'))p.needed=false;});
}
const rawResourcesBeforeV176=rawResourceLinesV14;
rawResourceLinesV14=function(l){return [...new Set([...rawResourcesBeforeV176(l),...(l.customResourceHintsV176||[])])];};
const lessonResourcesBeforeV176=lessonResourcesV14;
lessonResourcesV14=function(l){
  return lessonResourcesBeforeV176(l).map(r=>{
    const b=resourceBundleV176(l,r.hint);r.bundleV176=b;
    if(b){
      const items=bundleItemsV176(l,r.hint);r.bundleItemsV176=items;
      if(items.length){
        const readyPrint=items.some(x=>x.m&&x.v&&isPrintVariantV176(x.v,x.m)&&hasStoredFile(x.v));
        r.fileReady=!!(b.complete&&readyPrint);r.material=null;r.variant=null;
      }else if(b.complete)r.fileReady=false;
      r.deferredV176=!!b.deferred;
    }
    // Eine unspezifische Werkstatt-Angabe darf nicht durch einen einzigen zufälligen Treffer als vollständig gelten.
    if(!b&&/mathematische werkstatt|mathe werkstatt|materialpaket|arbeitsblatt.?sammlung/i.test(r.hint))r.fileReady=false;
    return r;
  });
};
missingPrintableResourcesV14=function(l){return lessonResourcesV14(l).filter(r=>r.type==='print'&&!r.deferredV176&&!r.fileReady);};
missingWeekPrintResourcesV14=function(){return courseLessonsV14().flatMap(l=>missingPrintableResourcesV14(l).map(r=>({l,...r})));};
const ensureCoarseBeforeV176=ensureCoarsePrintPlansV14;
ensureCoarsePrintPlansV14=function(l){ensureCoarseBeforeV176(l);for(const h of rawResourceLinesV14(l))removeGhostPlanV176(l,h);};
function allResourceRowsV176(l){const a=lessonResourcesV14(l);const missing=new Set(a.map(x=>resourceBundleKeyV176(x.hint)));return [...a,...rawResourceLinesV14(l).filter(h=>resourceTypeV14(l,h)==='ignore'&&!missing.has(resourceBundleKeyV176(h))).map(h=>({hint:h,type:'ignore',fileReady:false,bundleV176:resourceBundleV176(l,h),bundleItemsV176:bundleItemsV176(l,h)}))];}
function resourceStatusV176(r){
  if(r.type==='ignore')return 'Aus der Vorbereitung ausgeblendet';
  if(r.type==='reference')return 'Buch / AH – keine Datei nötig';
  if(r.type==='digital')return 'Digital – kein Ausdruck';
  const b=r.bundleV176;if(b?.deferred)return 'Für später vorgemerkt';
  if(b?.items?.length)return `${b.items.length} Datei${b.items.length===1?'':'en'} im Paket · ${r.fileReady?'vollständig':'Umfang noch bestätigen'}`;
  return r.fileReady?'Datei lokal vorhanden':'Noch nicht vollständig zugeordnet';
}
function resourceTypeOptionsV176(type){return [['print','Druckmaterial'],['reference','Buch / Arbeitsheft'],['digital','Digital / anzeigen'],['ignore','Nicht für diese Stunde']].map(([v,t])=>`<option value="${v}" ${type===v?'selected':''}>${t}</option>`).join('');}
function resourceEditorV176Html(l,r){
  const id=resourceEditorIdV176(l,r.hint),b=r.bundleV176,items=r.bundleItemsV176||[],existing=[];
  for(const mid of (l.materials||[])){
    const m=mat(mid);if(!m)continue;
    for(const v of m.variants||[]){if(!hasStoredFile(v))continue;if(items.some(x=>x.materialId===m.id&&x.variantId===v.id))continue;
      existing.push({m,v});
    }
  }
  return `<div class="resource-editor-v176"><div class="resource-editor-grid-v176"><label class="full">Titel des Materialpakets<input data-v176-title="${id}" value="${esc(b?.title||r.hint)}"></label><label>Art des Hinweises<select data-v176-type="${id}">${resourceTypeOptionsV176(r.type)}</select></label><label>Notiz (optional)<input data-v176-note="${id}" value="${esc(b?.note||'')}" placeholder="z. B. je Unterthema ein Arbeitsblatt"></label></div>
  <div class="resource-package-head-v176"><strong>Dateien dieses Pakets</strong><small>Jede Datei erhält einen eigenen Druckauftrag. Nichts zusammenführen nötig.</small></div>
  ${items.length?`<div class="package-items-v176">${items.map(x=>{const p=(l.printPlan||[]).find(p=>p.materialId===x.materialId&&p.variantId===x.variantId),print=isPrintVariantV176(x.v,x.m);return `<div class="package-file-v176"><div><strong>${esc(x.v?.fileName||x.m?.title||'Datei')}</strong><small>${esc(variantLabelV15(x.v?.type||'standard'))} · ${hasStoredFile(x.v)?'lokal gespeichert':'Datei nicht verfügbar'}${!print?' · kein Kopierauftrag':''}</small></div>${print?`<label>Exemplare<input type="number" min="0" max="500" data-v176-count="${id}|${x.id}" value="${Number(p?.count??x.count??cls(l.classId)?.students??0)}"></label><label>Modus<select data-v176-mode="${id}|${x.id}"><option value="bw" ${p?.mode!=='color'?'selected':''}>S/W</option><option value="color" ${p?.mode==='color'?'selected':''}>Farbe</option></select></label>`:''}<button class="text-button" data-v176-remove="${id}|${x.id}">Aus Paket lösen</button></div>`;}).join('')}</div>`:'<p class="muted">Noch keine Einzeldateien in diesem Paket.</p>'}
  <div class="resource-package-actions-v176"><label class="upload-button">+ Mehrere Dateien hinzufügen<input type="file" data-v176-upload="${id}" multiple hidden></label>${existing.length?`<select data-v176-existing="${id}"><option value="">Bereits verknüpfte Datei auswählen …</option>${existing.map(x=>`<option value="${x.m.id}|${x.v.id}">${esc(x.v.fileName||x.m.title)} · ${esc(variantLabelV15(x.v.type))}</option>`).join('')}</select><button class="secondary" data-v176-link="${id}">Übernehmen</button>`:''}</div>
  <div class="resource-package-bottom-v176"><label><input type="checkbox" data-v176-complete="${id}" ${b?.complete?'checked':''}> Paket vollständig – alle benötigten Dateien sind erfasst</label><label><input type="checkbox" data-v176-defer="${id}" ${b?.deferred?'checked':''}> Später klären (blockiert nicht die Stundenplanung)</label><button class="secondary" data-v176-close="${id}">Fertig</button></div></div>`;
}
resourceRowV14=function(l,r){
 const id=resourceEditorIdV176(l,r.hint),edit=resourceIsEditorV176(l,r.hint);
 return `<div class="resource-row-v176 ${r.type==='print'&&!r.fileReady&&!r.deferredV176?'needs':''} ${edit?'editing':''}"><div class="resource-row-summary-v176"><span class="resource-type ${r.type}">${esc(({print:'Druck',reference:'Buch / AH',digital:'Digital',ignore:'Ignoriert'})[r.type]||r.type)}</span><div class="resource-description-v176"><strong>${esc(displayResourceTitleV176(l,r.hint))}</strong><small>${esc(resourceStatusV176(r))}</small></div><button class="secondary resource-edit-button-v176" data-v176-edit="${id}">${edit?'Bearbeitung offen':'Bearbeiten · Dateien'} →</button></div>${edit?resourceEditorV176Html(l,r):''}</div>`;
};
function resourceNewHintV176(l){return `<div class="resource-new-v176"><input data-v176-new-title="${l.id}" placeholder="Weiteres Materialpaket, z. B. Werkstatt: Subtraktion"><button data-v176-new="${l.id}" class="secondary">+ Eintrag hinzufügen</button></div>`;}
function resourceUnmatchedLinkedV176(l){
  const ids=new Set(allResourceRowsV176(l).flatMap(r=>(r.bundleItemsV176||[]).map(x=>x.materialId)));
  const matched=(l.materials||[]).map(mat).filter(m=>m&&!ids.has(m.id)&&(m.variants||[]).some(v=>hasStoredFile(v)));
  if(!matched.length)return '';
  return `<div class="linked-resource-v176"><strong>Bereits der Stunde zugeordnete Dateien</strong><p>Diese Dateien sind schon lokal vorhanden. Über „Bearbeiten → Übernehmen“ kannst du sie einem Materialpaket zuweisen – ohne erneuten Upload.</p><div>${matched.map(m=>`<span>${esc(m.title)}</span>`).join('')}</div></div>`;
}
let expandedLessonV176=new Set();
lessonMaterialCardV14=function(l){
  const rs=allResourceRowsV176(l),missing=missingPrintableResourcesV14(l),hasEditor=resourceEditorV176.lessonId===l.id,opened=hasEditor||expandedLessonV176.has(l.id);
  return `<article class="lesson-material-card-v176 ${missing.length?'needs':''}" id="v176-lesson-${l.id}"><button class="lesson-material-summary-v176" data-v176-expand="${l.id}" aria-expanded="${opened?'true':'false'}"><span class="summary-date-v176">${esc(fmtDayV14(l.date))}</span><div><strong>${esc(whoV14(l))}</strong><small>${esc(l.title||l.planReference?.title||'')}</small></div><span class="summary-state-v176 ${missing.length?'pending':'ok'}">${missing.length?`${missing.length} Materialpaket${missing.length===1?'':'e'} prüfen`:'Druckmaterial geklärt'}</span><span class="chevron-v176">${opened?'▴':'▾'}</span></button>${opened?`<div class="lesson-material-body-v176">${rs.map(r=>resourceRowV14(l,r)).join('')||'<p class="muted">Keine Materialhinweise aus der Reihenplanung.</p>'}${resourceNewHintV176(l)}${resourceUnmatchedLinkedV176(l)}</div>`:''}</article>`;
};
coursePrepRowV14=function(l){
 const missing=missingPrintableResourcesV14(l).length,concrete=concretePlanReadyV12(l),ppt=!!l.presentationReady;
 return `<article class="course-prep-card-v14 course-prep-v176"><div class="course-prep-info-v14"><span>${esc(fmtDayV14(l.date))} · ${esc(l.period||'')}</span><strong>${esc(whoV14(l))}</strong><small>${esc(l.title||l.planReference?.title||'')}</small></div><div class="course-prep-status-v14"><span class="${missing?'warn':'ok'}">${missing?`${missing} Material offen`:'Material ✓'}</span><span class="${concrete?'ok':''}">${concrete?'Planung ✓':'Planung offen'}</span><span class="${ppt?'ok':''}">${ppt?'PPT ✓':'PPT offen'}</span></div><div class="course-actions-v176"><button class="secondary" data-v176-to-material="${l.id}">Material bearbeiten</button><button class="primary" data-start-wizard="${l.id}">Stunde vorbereiten →</button></div></article>`;
};
weekPrepViewV14=function(){
 hydrateWeekResourcesV14();const all=sortedWeekV08(),courses=courseLessonsV14(),groups=all.filter(l=>l.kind==='group'||l.groupId),missing=missingWeekPrintResourcesV14(),readyOpen=openPrintItems().filter(i=>i.fileReady&&!i.plan.alreadyPrinted);
 if(!all.length)return `<div class="content-grid"><section class="focus-hero"><div><span class="eyebrow">KW ${activeWeekNumber()}</span><h2>Woche noch nicht aufgebaut</h2></div><button class="primary big" data-action="rebuild-week">Woche aufbauen →</button></section></div>`;
 return `<div class="content-grid weekly-assistant-v14 weekly-assistant-v176"><section class="weekly-prep-hero"><div><span class="eyebrow">DEINE WOCHE · KW ${activeWeekNumber()}</span><h2>Alles an einem Ort. Stunde für Stunde.</h2><p>Du hast ${courses.length} Fachstunden in dieser Woche. Material klären und konkrete Planung können unabhängig voneinander erledigt werden.</p></div><div class="weekly-score"><strong>${courses.length}</strong><span>Fachstunden</span></div></section><section class="panel"><div class="section-head"><div><span class="step-number">1</span><span class="eyebrow">MATERIALPAKETE</span><h2>Aufklappen, bearbeiten und Dateien anhängen</h2></div><span class="status-counter">${missing.length?`${missing.length} Paket${missing.length===1?'':'e'} zu prüfen`:'Keine offenen Druckpakete'}</span></div><p class="muted">Ein Hinweis kann mehrere Arbeitsblätter enthalten. Buchseiten und digitale Medien brauchen keinen Druckdatei-Upload. Fehlende Dateien blockieren nicht die Planung mit ChatGPT.</p><div class="lesson-material-grid-v176">${courses.map(lessonMaterialCardV14).join('')}</div><div class="step-actions">${readyOpen.length?`<button class="primary" data-action="download-print-zip">Druckpaket (${readyOpen.length}) herunterladen</button><button class="secondary" data-v14-mark-printed>Gedruckte Positionen als kopiert markieren ✓</button>`:''}<button class="secondary" data-view="materials">Material-Hub öffnen</button></div></section><section class="panel"><div class="section-head"><div><span class="step-number">2</span><span class="eyebrow">KONKRETE STUNDEN</span><h2>Jetzt die nächste Stunde vorbereiten</h2></div></div><div class="course-prep-list-v14">${courses.map(coursePrepRowV14).join('')}</div></section>${groups.length?`<section class="panel"><div class="section-head"><div><span class="eyebrow">GA / KLASSENZEIT</span><h2>Separat kurz planen</h2></div></div><div class="prep-lesson-table">${groups.map(prepGroupRowV11).join('')}</div></section>`:''}</div>`;
};
weekPrepViewV08=weekPrepViewV14;weekPrepViewV12=weekPrepViewV14;
const focusBeforeV176=focusView;
focusView=function(){
 if(!state.timetable.length||!currentWeekLessons().length||!state.materialCatalog?.length)return focusBeforeV176();
 const courses=courseLessonsV14(),missing=missingWeekPrintResourcesV14(),planned=courses.filter(concretePlanReadyV12).length,ppts=courses.filter(l=>l.presentationReady).length;
 const next=courses.find(l=>!l.presentationReady)||courses.find(l=>!concretePlanReadyV12(l));
 return `<div class="content-grid focus-v176"><section class="focus-hero focus-hero-v176"><div><span class="eyebrow">DEIN START · KW ${activeWeekNumber()}</span><h2>${next?`Als Nächstes: ${esc(whoV14(next))}`:'Deine Wochenpräsentationen sind erstellt'}</h2><p>${next?`${esc(fmtDayV14(next.date))} · ${esc(next.title||next.planReference?.title||'')}`:'Du kannst Material, Druck und Reflexion unabhängig weiterbearbeiten.'}</p></div><div class="focus-actions-v176">${next?`<button class="primary big" data-start-wizard="${next.id}">Stunde vorbereiten →</button>`:''}<button class="secondary" data-view="prep">Wochenübersicht & Material →</button></div></section><section class="focus-metrics-v176"><div><strong>${courses.length}</strong><span>Fachstunden diese Woche</span></div><div><strong>${planned}/${courses.length}</strong><span>konkret geplant</span></div><div><strong>${ppts}/${courses.length}</strong><span>Präsentationen</span></div><div><strong>${missing.length}</strong><span>Materialpakete zu prüfen</span></div></section>${missing.length?`<section class="focus-material-v176"><div><strong>Material in Ruhe vervollständigen</strong><p>${missing.length} Druckhinweis${missing.length===1?' ist':'e sind'} noch nicht vollständig geklärt. Ein Werkstatt-Eintrag kann viele Einzeldateien enthalten – du kannst sie über „Bearbeiten“ hinzufügen oder später klären.</p></div><button class="secondary" data-view="prep">Materialpakete bearbeiten →</button></section>`:''}<section class="tip-card"><strong>Hinweis zu Mathematik</strong><p>Der große automatische Dateiabgleich wurde bisher für Religion 5–11 durchgeführt. Die Mathe-Werkstattdateien sind dadurch nicht automatisch vorhanden; du kannst ihre Einzelblätter jetzt direkt an das Materialpaket hängen.</p></section></div>`;
};
const wizardPlanBeforeV176=wizardPlanStepV14;
wizardPlanStepV14=function(l){return wizardPlanBeforeV176(l).replace('<div class="wizard-footer-v14">',resourceNewHintV176(l)+resourceUnmatchedLinkedV176(l)+'<div class="wizard-footer-v14">');};
const promptBeforeV176=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
 let p=promptBeforeV176(l),rs=lessonResourcesV14(l);const b=rs.map(r=>{
  const name=displayResourceTitleV176(l,r.hint),items=r.bundleItemsV176||[];
  if(r.type==='reference')return `- Buch/AH (kein Upload): ${name}`;
  if(r.type==='digital')return `- Digital: ${name}`;
  if(r.type!=='print')return '';
  const ls=items.map(x=>`    • ${x.v?.fileName||x.m?.title||'Datei'} [${variantLabelV15(x.v?.type||'standard')}]${isPrintVariantV176(x.v,x.m)?`, Kopien: ${(l.printPlan||[]).find(p=>p.materialId===x.materialId&&p.variantId===x.variantId)?.count??'offen'}`:', kein Ausdruck'}`).join('\n');
  return `- Materialpaket: ${name} (${r.fileReady?'vollständig':r.deferredV176?'für später vorgemerkt':'noch zu prüfen'})${ls?'\n'+ls:r.fileReady?'':'\n    • Einzeldateien noch nicht hinterlegt'}${r.bundleV176?.note?'\n    • Hinweis: '+r.bundleV176.note:''}`;
 }).filter(Boolean).join('\n');
 p=p.replace(/## Hauptmaterial aus der Reihenplanung\n[\s\S]*?\n\n## Letzter tatsächlicher Stand/,`## Hauptmaterial aus der Reihenplanung\n${b||'- keine Materialhinweise'}\n\n## Letzter tatsächlicher Stand`);return p;
};makeBrief=concretePlanningPromptV12;
// Die Präsentation soll aus der Folienmasteransicht heraus in Normalansicht starten.
const replacePresentationBeforeV176=v13ReplacePresentation;
v13ReplacePresentation=function(entries,count){
 replacePresentationBeforeV176(entries,count);
 const key='ppt/viewProps.xml';if(!entries.has(key))return;
 const parser=new DOMParser(),doc=parser.parseFromString(v13String(entries.get(key)),'application/xml');
 if(doc.getElementsByTagName('parsererror').length)return;
 doc.documentElement.setAttribute('lastView','sldThumbnailView');
 entries.set(key,v13Bytes(v174SerializeXmlDocument(doc)));
};
const wireBeforeV176=wire;
wire=function(){
 wireBeforeV176();
 const parseId=(encoded)=>{const i=encoded.indexOf('|');return [lesson(encoded.slice(0,i)),decodeURIComponent(encoded.slice(i+1))];};
 function redrawFor(l,h){resourceEditorV176={lessonId:l.id,key:resourceBundleKeyV176(h)};expandedLessonV176.add(l.id);saveState();render();}
 function itemOf(l,h,id){return resourceBundleV176(l,h)?.items.find(x=>x.id===id);}
 function attachExisting(l,h,mid,vid){
  const m=mat(mid),v=variant(mid,vid),b=resourceBundleV176(l,h,true);if(!m||!v||!hasStoredFile(v))return false;
  if(b.items.some(x=>x.materialId===mid&&x.variantId===vid))return false;
  b.items.push({id:uid('bundle'),materialId:mid,variantId:vid});
  l.materials=l.materials||[];if(!l.materials.includes(mid))l.materials.push(mid);
  const p=ensurePlan(l,mid,vid);if(isPrintVariantV176(v,m)){p.needed=true;if(!(p.count>0))p.count=Number(cls(l.classId)?.students)||0;p.mode=p.mode||'bw';}else p.needed=false;
  removeGhostPlanV176(l,h);return true;
 }
 document.querySelectorAll('[data-v176-expand]').forEach(b=>b.onclick=()=>{const id=b.dataset.v176Expand;if(expandedLessonV176.has(id))expandedLessonV176.delete(id);else expandedLessonV176.add(id);render();});
 document.querySelectorAll('[data-v176-to-material]').forEach(b=>b.onclick=()=>{expandedLessonV176.add(b.dataset.v176ToMaterial);view='prep';render();document.getElementById(`v176-lesson-${b.dataset.v176ToMaterial}`)?.scrollIntoView({block:'start'});});
 document.querySelectorAll('[data-v176-edit]').forEach(b=>b.onclick=()=>{const [l,h]=parseId(b.dataset.v176Edit);if(!l)return;if(resourceIsEditorV176(l,h))resourceEditorV176={lessonId:'',key:''};else{resourceBundleV176(l,h,true);resourceEditorV176={lessonId:l.id,key:resourceBundleKeyV176(h)};expandedLessonV176.add(l.id);}render();});
 document.querySelectorAll('[data-v176-close]').forEach(b=>b.onclick=()=>{resourceEditorV176={lessonId:'',key:''};render();});
 document.querySelectorAll('[data-v176-type]').forEach(el=>el.onchange=()=>{const [l,h]=parseId(el.dataset.v176Type);if(!l)return;setResourceTypeV14(l,h,el.value);for(const x of bundleItemsV176(l,h)){const p=(l.printPlan||[]).find(p=>p.materialId===x.materialId&&p.variantId===x.variantId);if(p)p.needed=el.value==='print'&&isPrintVariantV176(x.v,x.m);}saveState();render();});
 document.querySelectorAll('[data-v176-title]').forEach(el=>el.onchange=()=>{const [l,h]=parseId(el.dataset.v176Title);if(!l)return;resourceBundleV176(l,h,true).title=el.value.trim()||h;saveState();render();});
 document.querySelectorAll('[data-v176-note]').forEach(el=>el.onchange=()=>{const [l,h]=parseId(el.dataset.v176Note);if(!l)return;resourceBundleV176(l,h,true).note=el.value;saveState();});
 document.querySelectorAll('[data-v176-complete]').forEach(el=>el.onchange=()=>{const [l,h]=parseId(el.dataset.v176Complete);if(!l)return;const b=resourceBundleV176(l,h,true);b.complete=!!el.checked;saveState();render();});
 document.querySelectorAll('[data-v176-defer]').forEach(el=>el.onchange=()=>{const [l,h]=parseId(el.dataset.v176Defer);if(!l)return;resourceBundleV176(l,h,true).deferred=!!el.checked;saveState();render();});
 document.querySelectorAll('[data-v176-upload]').forEach(el=>el.onchange=async()=>{const [l,h]=parseId(el.dataset.v176Upload);if(!l)return;const fs=[...(el.files||[])].filter(f=>f.name&&!f.name.startsWith('.'));if(!fs.length)return;const b=resourceBundleV176(l,h,true);let done=0;
  try{for(const f of fs){const m={id:uid('mat'),title:f.name.replace(/\.[^.]+$/,''),kind:'file',resourceType:/\.(png|jpe?g|gif|webp|mp[34]|wav|pptx?)$/i.test(f.name)?'digital':'print',source:`Materialpaket · ${h}`,pages:'',tasks:'',variants:[],improvementFlags:[],assignments:[{classId:l.classId,sequenceId:l.sequenceId||'',unitId:l.planReference?.unitId||''}]};const vt=resourceFileRoleV176(f.name),v={id:uid('var'),type:vt,label:variantLabelV15(vt),available:true,fileName:f.name,fileKey:`material-${m.id}-file`};if(vt==='solution')m.resourceType='teacher';m.variants.push(v);await fileStorePut(v.fileKey,f);storedFileKeys.add(v.fileKey);state.materials.push(m);b.items.push({id:uid('bundle'),materialId:m.id,variantId:v.id});l.materials=l.materials||[];if(!l.materials.includes(m.id))l.materials.push(m.id);const p=ensurePlan(l,m.id,v.id);p.needed=resourceTypeV14(l,h)==='print'&&isPrintVariantV176(v,m);p.count=p.needed?Number(cls(l.classId)?.students)||0:0;p.mode='bw';done++;}
    if(fs.length===1&&!/werkstatt|paket|sammlung|materialien|auswahl/i.test(h))b.complete=true;
    removeGhostPlanV176(l,h);saveState();render();alert(`${done} Datei${done===1?'':'en'} zum Paket „${displayResourceTitleV176(l,h)}“ hinzugefügt. ${b.complete?'Paket als vollständig markiert.':'Weitere Dateien sind möglich; bestätige anschließend „Paket vollständig“.'}`);
  }catch(err){saveState();render();alert(`Nur ${done} Datei(en) konnten gespeichert werden. ${err.message||err}`);}
 });
 document.querySelectorAll('[data-v176-link]').forEach(b=>b.onclick=()=>{const [l,h]=parseId(b.dataset.v176Link),v=document.querySelector(`[data-v176-existing="${b.dataset.v176Link}"]`)?.value;if(!l||!v)return;const [mid,vid]=v.split('|');if(attachExisting(l,h,mid,vid)){saveState();render();}});
 document.querySelectorAll('[data-v176-count]').forEach(el=>el.onchange=()=>{const vals=el.dataset.v176Count.split('|'),[l,h]=parseId(vals.slice(0,2).join('|')),x=itemOf(l,h,vals[2]);if(!x)return;const p=ensurePlan(l,x.materialId,x.variantId);p.count=Math.max(0,Math.min(500,Number(el.value)||0));p.needed=p.count>0;saveState();});
 document.querySelectorAll('[data-v176-mode]').forEach(el=>el.onchange=()=>{const vals=el.dataset.v176Mode.split('|'),[l,h]=parseId(vals.slice(0,2).join('|')),x=itemOf(l,h,vals[2]);if(!x)return;ensurePlan(l,x.materialId,x.variantId).mode=el.value;saveState();});
 document.querySelectorAll('[data-v176-remove]').forEach(btn=>btn.onclick=()=>{const vals=btn.dataset.v176Remove.split('|'),[l,h]=parseId(vals.slice(0,2).join('|')),b=resourceBundleV176(l,h),x=itemOf(l,h,vals[2]);if(!x)return;b.items=b.items.filter(a=>a.id!==x.id);const p=(l.printPlan||[]).find(p=>p.materialId===x.materialId&&p.variantId===x.variantId);if(p)p.needed=false;b.complete=false;saveState();render();});
 document.querySelectorAll('[data-v176-new]').forEach(btn=>btn.onclick=()=>{const l=lesson(btn.dataset.v176New),el=document.querySelector(`[data-v176-new-title="${btn.dataset.v176New}"]`),title=el?.value.trim();if(!l||!title)return;l.customResourceHintsV176=l.customResourceHintsV176||[];if(!rawResourceLinesV14(l).some(h=>resourceBundleKeyV176(h)===resourceBundleKeyV176(title)))l.customResourceHintsV176.push(title);resourceBundleV176(l,title,true);resourceEditorV176={lessonId:l.id,key:resourceBundleKeyV176(title)};expandedLessonV176.add(l.id);saveState();render();});
};
const renderBeforeV176=render;
render=function(){renderBeforeV176();const v=document.querySelector('.brand small');if(v)v.textContent=`${state.settings.schoolYear} · V0.17.6`;};
render();

/* ===== V0.17.7 – getrennte Planung/Druckvorbereitung, Material-Aktionen ===== */
function weekWorkflowV177(start=state.settings.activeWeekStart||iso(activeMonday())){
  state.weekWorkflowV177=state.weekWorkflowV177||{};
  return state.weekWorkflowV177[start]||(state.weekWorkflowV177[start]={printClosed:false,printPanelOpen:false,planningOnly:false});
}
function weekPrintJobsV177(){return printItems().filter(i=>i.plan.needed&&Number(i.plan.count)>0);}
function weekPrintDoneV177(){
  const w=weekWorkflowV177(),jobs=weekPrintJobsV177(),missing=missingWeekPrintResourcesV14();
  // While planning ahead, printing remains a separate explicit task, even if no files are known yet.
  if(w.planningOnly&&!w.printClosed)return false;
  // An external copy run can be confirmed even when its digital originals are not in the Hub.
  return jobs.every(i=>i.plan.alreadyPrinted)&&(w.printClosed||missing.length===0);
}
const concretePlanBeforeV177=concretePlanReadyV12;
concretePlanReadyV12=function(l){return !!(l?.manualPlanReadyV177||concretePlanBeforeV177(l));};
function isPptReadyV177(l){return !!l?.presentationReady;}
function weekCountsV177(){
  const courses=courseLessonsV14();return {courses,planned:courses.filter(concretePlanReadyV12).length,ppts:courses.filter(isPptReadyV177).length,printDone:weekPrintDoneV177()};
}
function weekFullyReadyV177(){const x=weekCountsV177();return x.courses.length>0&&x.planned===x.courses.length&&x.ppts===x.courses.length&&x.printDone;}
function weekStartDateV177(delta){const d=activeMonday();d.setDate(d.getDate()+delta*7);return iso(d);}
function visitWeekV177(delta,planningOnly){
  const newStart=weekStartDateV177(delta);state.settings.activeWeekStart=newStart;
  const w=weekWorkflowV177(newStart);if(planningOnly){w.planningOnly=true;w.printPanelOpen=false;}else{w.planningOnly=false;w.printPanelOpen=false;}
  // Only add missing timetable entries. Do not rebuild or replace existing actual/planned lessons.
  let added=0;
  for(const t of state.timetable||[]){
    const date=activeWeekDate(t.weekday);
    if(state.lessons.some(l=>l.date===date&&(l.timetableId===t.id||(l.classId===t.classId&&lessonSlot(l)===Number(t.slot)))))continue;
    const newLesson=createBlankLessonFromTimetable(t);state.lessons.push(newLesson);added++;
  }
  state.lessons.filter(l=>l.date>=newStart&&l.date<=activeWeekEnd()).forEach(attachExactPlanV11);
  saveState();view='prep';modal=null;expandedLessonV176.clear();resourceEditorV176={lessonId:'',key:''};render();
}
function markWeekPrintedV177(){
  const pending=weekPrintJobsV177().filter(i=>!i.plan.alreadyPrinted),unknown=missingWeekPrintResourcesV14();
  if((pending.length||unknown.length)&&!confirm(`Bestätigst du, dass die Kopien für diese Woche bereits erledigt sind (auch ggf. außerhalb des Cockpits)?\n\n${pending.length} offene Druckposition(en), ${unknown.length} Datei-Hinweis(e) im Hub noch ungeklärt. Diese Dateien werden nicht gelöscht.`))return;
  for(const i of pending)i.plan.alreadyPrinted=true;
  const w=weekWorkflowV177();w.printClosed=true;w.printPanelOpen=false;saveState();render();
}
function skipResourcePrintV177(l,h,type){
  setResourceTypeV14(l,h,type);const b=resourceBundleV176(l,h,true);b.deferred=false;
  for(const x of bundleItemsV176(l,h)){const p=(l.printPlan||[]).find(p=>p.materialId===x.materialId&&p.variantId===x.variantId);if(p)p.needed=false;}
  const target=normalizeHintV12(h);
  for(const p of (l.printPlan||[])){
    const m=mat(p.materialId);if(m&&normalizeHintV12(m.title)===target)p.needed=false;
  }
  saveState();render();
}
const inferredResourceBeforeV177=inferredResourceTypeV14;
inferredResourceTypeV14=function(h){
  const s=String(h||'').trim();
  if(!/\.(pdf|docx?|pptx?|xlsx?)\b/i.test(s)&&/(?:zeitschrift|plakat|poster|heft)\s+(?:anfertigen|erstellen|gestalten)\s*$/i.test(s))return 'activity';
  return inferredResourceBeforeV177(h);
};
const typeOptionsBeforeV177=resourceTypeOptionsV176;
resourceTypeOptionsV176=function(type){
  return [['print','Druckdatei / Materialpaket'],['reference','Buch / Arbeitsheft'],['digital','Digital / anzeigen'],['activity','Tätigkeit · kein Druck'],['ignore','Ignorieren · nicht benötigt']].map(([v,t])=>`<option value="${v}" ${type===v?'selected':''}>${t}</option>`).join('');
};
const printVariantBeforeV177=isPrintVariantV176;
isPrintVariantV176=function(v,m){return !['reference','activity','ignore','digital','teacher'].includes(m?.resourceType)&&printVariantBeforeV177(v,m);};
const resourceStatusBeforeV177=resourceStatusV176;
resourceStatusV176=function(r){
  if(r.type==='activity')return 'Arbeitsauftrag / Tätigkeit – keine Datei, kein Ausdruck';
  if(r.type==='reference'){const n=r.bundleItemsV176?.filter(x=>x.v&&hasStoredFile(x.v)).length||0;return n?`Buch / AH · ${n} Scan${n===1?'':'s'} hinterlegt (optional)`:'Buch / AH · Scan kann optional hinterlegt werden';}
  return resourceStatusBeforeV177(r);
};
const resourceEditorBeforeV177=resourceEditorV176Html;
resourceEditorV176Html=function(l,r){
  let html=resourceEditorBeforeV177(l,r),id=resourceEditorIdV176(l,r.hint);
  if(r.type==='reference'){
    html=html.replace('Jede Datei erhält einen eigenen Druckauftrag. Nichts zusammenführen nötig.','Scans/Seiten optional verknüpfen – daraus entsteht kein Kopierauftrag.');
    html=html.replace(/<label class="upload-button">\+ Mehrere Dateien hinzufügen<input type="file" data-v176-upload="[^"]*" multiple hidden><\/label>/,
      `<label class="upload-button">+ Scan / Buchseiten hinterlegen<input type="file" data-v177-scan="${id}" accept=".pdf,.png,.jpg,.jpeg,.webp" multiple hidden></label>`);
    html=html.replace('Paket vollständig – alle benötigten Dateien sind erfasst','Buch-/AH-Referenz geklärt');
  }
  const available=(r.bundleItemsV176||[]).filter(x=>x.v&&hasStoredFile(x.v));
  const actions=available.length?`<div class="package-reprint-v177"><strong>Einzeldateien erneut öffnen / ausdrucken</strong><div>${available.map(x=>{
    const p=(l.printPlan||[]).find(p=>p.materialId===x.materialId&&p.variantId===x.variantId);
    return `<div><span>${esc(x.v.fileName||x.m?.title||'Datei')}</span><button class="secondary" data-v177-file="${x.materialId}|${x.variantId}">Datei herunterladen ↗</button>${r.type==='print'&&p?.needed?`<button class="text-button" data-v177-file-printed="${l.id}|${p.id}">${p.alreadyPrinted?'✓ Kopiert · zurücksetzen':'Als kopiert markieren ✓'}</button>`:''}</div>`;
  }).join('')}</div></div>`:'';
  return html.replace('<div class="resource-package-bottom-v176">',actions+'<div class="resource-package-bottom-v176">');
};
const resourceRowBeforeV177=resourceRowV14;
resourceRowV14=function(l,r){
  let html=resourceRowBeforeV177(l,r),actions='';
  if(r.type==='print')actions+=`<button class="text-button" data-v177-no-print="${resourceEditorIdV176(l,r.hint)}" title="Materialhinweis ist eine Tätigkeit, keine Datei">Kein Druck · Tätigkeit</button>`;
  if(r.type==='activity')actions+=`<button class="text-button" data-v177-back-print="${resourceEditorIdV176(l,r.hint)}">Doch Druckmaterial</button>`;
  if(r.type==='ignore')actions+=`<button class="text-button" data-v177-back-print="${resourceEditorIdV176(l,r.hint)}">Wieder aufnehmen</button>`;
  if(r.type==='reference')actions+=`<label class="upload-button small-upload">+ Scan hinterlegen<input data-v177-scan="${resourceEditorIdV176(l,r.hint)}" accept=".pdf,.png,.jpg,.jpeg,.webp" type="file" multiple hidden></label>`;
  const files=r.bundleItemsV176?.filter(x=>x.v&&hasStoredFile(x.v))||[];
  if(r.type==='print'&&files.length===1)actions+=`<button class="secondary" data-v177-file="${files[0].materialId}|${files[0].variantId}">Einzeldruck ↗</button>`;
  if(r.type==='print'&&!files.length&&r.material&&r.variant&&hasStoredFile(r.variant))actions+=`<button class="secondary" data-v177-file="${r.material.id}|${r.variant.id}">Einzeldruck ↗</button>`;
  if(r.type==='reference'&&files.length===1)actions+=`<button class="text-button" data-v177-file="${files[0].materialId}|${files[0].variantId}">Scan öffnen ↗</button>`;
  if(r.type==='print'){
    const target=files.length===1?files[0]:(files.length===0&&r.material&&r.variant?{materialId:r.material.id,variantId:r.variant.id}:null);
    const pp=target?(l.printPlan||[]).find(p=>p.materialId===target.materialId&&p.variantId===target.variantId):null;
    if(pp?.needed)actions+=`<button class="text-button" data-v177-file-printed="${l.id}|${pp.id}">${pp.alreadyPrinted?'✓ Kopiert · zurücksetzen':'Als kopiert markieren ✓'}</button>`;
  }
  if(r.type==='activity')html=html.replace('>activity</span>','>Tätigkeit</span>');
  if(actions)html=html.replace(/(<button class="secondary resource-edit-button-v176"[^>]*>[\s\S]*?<\/button>)(<\/div>)/,`$1<span class="resource-quick-v177">${actions}</span>$2`);
  return html;
};
function planLabelV177(l){return l.manualPlanReadyV177&&!l.aiImportAt?'Vorhandene Planung ✓':concretePlanReadyV12(l)?'Planung ✓':'Planung offen';}
function pptLabelV177(l){return !l.presentationReady?'PPT offen':l.presentationNotRequiredV177?'Keine PPT nötig ✓':l.presentationSourceV177==='uploaded'?'PPT hinterlegt ✓':l.presentationSourceV177==='external'?'PPT vorhanden ✓':'PPT ✓';}
coursePrepRowV14=function(l){
  const ready=concretePlanReadyV12(l),ppt=!!l.presentationReady;
  return `<article class="course-prep-card-v14 course-prep-v176 course-prep-v177"><div class="course-prep-info-v14"><span>${esc(fmtDayV14(l.date))} · ${esc(l.period||'')}</span><strong>${esc(whoV14(l))}</strong><small>${esc(l.title||l.planReference?.title||'')}</small></div><div class="course-prep-status-v14"><span class="${ready?'ok':'warn'}">${esc(planLabelV177(l))}</span><span class="${ppt?'ok':'warn'}">${esc(pptLabelV177(l))}</span><span class="${ready&&ppt?'ok':''}">${ready&&ppt?'Stunde fertig ✓':'Noch vorzubereiten'}</span></div><div class="course-actions-v176 course-actions-v177">${!ready?`<button class="secondary" data-v177-plan="${l.id}">Schon geplant ✓</button>`:l.manualPlanReadyV177&&!l.aiImportAt?`<button class="text-button" data-v177-plan-reset="${l.id}">Planung wieder öffnen</button>`:''}${!ppt?`<button class="secondary" data-v177-ppt-external="${l.id}">PPT schon vorhanden ✓</button><label class="upload-button small-upload">PPT hinterlegen<input type="file" accept=".pptx,.ppt" data-v177-ppt-upload="${l.id}" hidden></label><button class="text-button" data-v177-ppt-none="${l.id}">Keine PPT nötig</button>`:`<button class="text-button" data-v177-ppt-reset="${l.id}">PPT-Status ändern</button>${l.presentationSourceV177==='uploaded'?`<button class="secondary" data-v177-ppt-download="${l.id}">PPT öffnen ↗</button>`:''}${l.presentationSourceV177==='external'?`<label class="upload-button small-upload">PPT nachträglich hinterlegen<input type="file" accept=".pptx,.ppt" data-v177-ppt-upload="${l.id}" hidden></label>`:''}`}<button class="primary" data-start-wizard="${l.id}">${ready?'Planung ansehen / ändern':'Stunde vorbereiten →'}</button></div></article>`;
};
const weekPrepBeforeV177=weekPrepViewV14;
weekPrepViewV14=function(){
  hydrateWeekResourcesV14();const all=sortedWeekV08(),courses=courseLessonsV14(),groups=all.filter(l=>l.kind==='group'||l.groupId),w=weekWorkflowV177();
  if(!all.length)return `<div class="content-grid"><section class="focus-hero"><div><span class="eyebrow">KW ${activeWeekNumber()}</span><h2>Diese Woche ist noch nicht aufgebaut.</h2><p>Du kannst auch zukünftige Wochen aus deinem Stundenplan anlegen, ohne frühzeitig zu kopieren.</p></div><button data-action="rebuild-week" class="primary big">Woche aufbauen →</button></section><button class="secondary" data-v177-plan-next>Folgewoche nur planen →</button></div>`;
  const missing=missingWeekPrintResourcesV14(),jobs=weekPrintJobsV177(),open=jobs.filter(i=>!i.plan.alreadyPrinted),readyOpen=open.filter(i=>i.fileReady),isDone=weekPrintDoneV177();
  const printCollapsed=!w.printPanelOpen&&(isDone||w.planningOnly),planned=courses.filter(concretePlanReadyV12).length,ppts=courses.filter(isPptReadyV177).length,allComplete=weekFullyReadyV177();
  return `<div class="content-grid weekly-assistant-v14 weekly-assistant-v176 weekly-assistant-v177">
  <section class="weekly-prep-hero"><div><span class="eyebrow">DEINE PLANUNGSWOCHE · KW ${activeWeekNumber()} · ${esc(activeWeekLabel())}</span><h2>${w.planningOnly?'Vorausplanen – Kopieren kann warten.':'Planen und Kopieren getrennt abhaken.'}</h2><p>Die ausgewählte Woche bleibt gespeichert. Der Wechsel zur nächsten Woche überschreibt keine bestehenden Stunden.</p></div><div class="weekly-progress-v177"><strong>${planned}/${courses.length}</strong><span>Stunden geplant</span><strong>${ppts}/${courses.length}</strong><span>Präsentationsstatus</span></div></section>
  <section class="panel print-panel-v177 ${printCollapsed?'collapsed':''}"><div class="section-head"><div><span class="step-number">1</span><span class="eyebrow">DRUCKVORBEREITUNG · EIGENER FORTSCHRITT</span><h2>${isDone?'Kopieren für diese Woche erledigt ✓':w.planningOnly?'Drucken später – jetzt nur planen':'Material & Kopien'}</h2></div><div class="print-panel-actions-v177"><span class="status-counter">${jobs.filter(i=>i.plan.alreadyPrinted).length}/${jobs.length} Positionen kopiert · ${missing.length} Hinweise zu prüfen</span><button class="secondary" data-v177-print-toggle>${printCollapsed?'Bei Bedarf aufklappen':'Einklappen'} ${printCollapsed?'▾':'▴'}</button></div></div>
  ${printCollapsed?`<p class="muted">${w.planningOnly&&!isDone?'Die Druckliste kannst du z. B. Donnerstag/Freitag vor der Unterrichtswoche bearbeiten.':'Bereits kopiert bleibt dokumentiert. Du kannst einzelne Dateien jederzeit erneut herunterladen.'}</p>`:`<p class="muted">„Tätigkeit“ und „Ignorieren“ sind eigene Optionen: Nicht jeder Materialhinweis bezeichnet eine Datei. Bei Bedarf gibt es pro Datei einen erneuten Download.</p><div class="lesson-material-grid-v176">${courses.map(lessonMaterialCardV14).join('')}</div><div class="step-actions">${readyOpen.length?`<button class="primary" data-action="download-print-zip">Druck-ZIP (${readyOpen.length} Positionen)</button><button class="secondary" data-v177-mark-printed>Vorhandene Positionen als kopiert markieren ✓</button>`:''}<button class="secondary" data-v177-week-printed>Diese Woche ist bereits kopiert ✓</button><button class="secondary" data-view="materials">Material-Hub</button></div>`}</section>
  <section class="panel"><div class="section-head"><div><span class="step-number">2</span><span class="eyebrow">KONKRETE STUNDEN · UNABHÄNGIG VOM KOPIEREN</span><h2>Planungen & Präsentationen</h2></div><span class="status-counter">${planned}/${courses.length} geplant · ${ppts}/${courses.length} PPT geklärt</span></div><p class="muted">Eine übernommene Kollegiums-Stunde kannst du als geplant markieren; eine vorhandene Präsentation hinterlegen oder „Keine PPT nötig“ wählen.</p><div class="course-prep-list-v14">${courses.map(coursePrepRowV14).join('')}</div></section>
  ${groups.length?`<section class="panel"><div class="section-head"><div><span class="eyebrow">GA / KLASSENZEIT</span><h2>Separat kurz planen</h2></div></div><div class="prep-lesson-table">${groups.map(prepGroupRowV11).join('')}</div></section>`:''}
  <section class="panel next-week-v177"><div><span class="eyebrow">WOCHENWECHSEL</span><h2>${allComplete?'Alles vorbereitet – die nächste Woche kann starten.':'Du kannst trotzdem schon weiterplanen.'}</h2><p>${allComplete?'Druck, Stundenplanung und Präsentationsstatus dieser Woche sind erledigt.':'Noch offen: '+[planned<courses.length?`${courses.length-planned} Stunden planen`:'',ppts<courses.length?`${courses.length-ppts} Präsentationen klären`:'',!isDone?'Druckvorbereitung abschließen':''].filter(Boolean).join(' · ')+'. Die Planung der Folgewoche ist davon unabhängig.'}</p></div><div class="next-week-actions-v177"><button class="secondary" data-v177-plan-next>Nächste Woche nur planen →</button><button class="primary" data-v177-start-next ${allComplete?'':'disabled'}>Nächste Woche starten →</button><button class="text-button" data-v177-calendar-week>Zur aktuellen Kalenderwoche</button></div></section></div>`;
};
weekPrepViewV08=weekPrepViewV14;weekPrepViewV12=weekPrepViewV14;
const focusBeforeV177=focusView;
focusView=function(){
  if(!state.timetable.length||!currentWeekLessons().length||!state.materialCatalog?.length)return focusBeforeV177();
  const s=weekCountsV177(),next=s.courses.find(l=>!concretePlanReadyV12(l)||!l.presentationReady),w=weekWorkflowV177();
  return `<div class="content-grid focus-v176"><section class="focus-hero focus-hero-v176"><div><span class="eyebrow">DEIN START · KW ${activeWeekNumber()}</span><h2>${next?`Als Nächstes: ${esc(whoV14(next))}`:'Alle Fachstunden dieser Woche sind geplant ✓'}</h2><p>${next?`${esc(fmtDayV14(next.date))} · ${esc(next.title||next.planReference?.title||'')}`:'Druckstatus und Planung der Folgewoche sind separat verfügbar.'}</p></div><div class="focus-actions-v176">${next?`<button class="primary big" data-start-wizard="${next.id}">Stunde vorbereiten →</button>`:''}<button class="secondary" data-view="prep">Wochenvorbereitung →</button><button class="text-button" data-v177-plan-next>Folgewoche planen →</button></div></section><section class="focus-metrics-v176"><div><strong>${s.courses.length}</strong><span>Fachstunden</span></div><div><strong>${s.planned}/${s.courses.length}</strong><span>geplant</span></div><div><strong>${s.ppts}/${s.courses.length}</strong><span>Präsentationsstatus</span></div><div><strong>${s.printDone?'✓':'○'}</strong><span>Kopierstatus</span></div></section>${w.planningOnly?'<section class="tip-card"><strong>Vorausplanung</strong><p>Druckdateien werden nicht vorausgesetzt. Sie können später unabhängig nachgetragen und kopiert werden.</p></section>':''}</div>`;
};
async function downloadPrintZipV177(){
  const items=openPrintItems(),ready=items.filter(i=>i.fileReady),notReady=items.filter(i=>!i.fileReady);
  if(!ready.length)return alert('Keine noch offenen druckbereiten Dateien vorhanden. Bereits kopierte Dateien kannst du einzeln herunterladen.');
  const entries=[];
  for(const i of ready){const rec=await fileStoreGet(i.variant.fileKey);if(!rec?.blob)continue;
    const folder=i.plan.mode==='color'?'FARBE':'SW',ext=(rec.name.match(/\.[^.]+$/)||[''])[0];
    const base=safeName(`${String(i.plan.count).padStart(2,'0')}x_${i.cls?.subject||''}_${i.cls?.name||''}_${i.material.title}_${i.variant.label}`);entries.push({name:`${folder}/${base}${ext}`,blob:rec.blob});
  }
  entries.push({name:'Druckliste.txt',blob:new Blob([printListText(ready)+(notReady.length?`\n\nNICHT ENTHALTEN (Originaldatei fehlt):\n${printListText(notReady)}`:'')],{type:'text/plain;charset=utf-8'})});
  downloadBlob(`KW${activeWeekNumber()}_Druckpaket.zip`,await buildZip(entries));
  if(notReady.length)alert(`${notReady.length} Position(en) ohne lokal verfügbare Datei wurden nicht in die ZIP aufgenommen und stehen in der Druckliste.`);
}
downloadPrintZip=downloadPrintZipV177;
const wireBeforeV177=wire;
wire=function(){
  wireBeforeV177();
  const parse=(str)=>{const i=str.indexOf('|');return [lesson(str.slice(0,i)),decodeURIComponent(str.slice(i+1))];};
  document.querySelectorAll('[data-v177-no-print]').forEach(b=>b.onclick=()=>{const [l,h]=parse(b.dataset.v177NoPrint);if(l)skipResourcePrintV177(l,h,'activity');});
  document.querySelectorAll('[data-v177-back-print]').forEach(b=>b.onclick=()=>{const [l,h]=parse(b.dataset.v177BackPrint);if(!l)return;setResourceTypeV14(l,h,'print');const bnd=resourceBundleV176(l,h);if(bnd)bnd.deferred=false;for(const x of bundleItemsV176(l,h)){const p=ensurePlan(l,x.materialId,x.variantId);p.needed=isPrintVariantV176(x.v,x.m);if(p.needed&&!(p.count>0))p.count=Number(cls(l.classId)?.students)||0;}if(!bnd?.items?.length){const m=bestMaterialMatchV12(h);if(m){const v=standardVariantV12(m),p=ensurePlan(l,m.id,v.id);p.needed=true;if(!(p.count>0))p.count=Number(cls(l.classId)?.students)||0;}}saveState();render();});
  // Override V0.17.6 type change: all non-print types must disable their print jobs.
  document.querySelectorAll('[data-v176-type]').forEach(el=>el.onchange=()=>{const [l,h]=parse(el.dataset.v176Type);if(!l)return;const t=el.value;setResourceTypeV14(l,h,t);for(const x of bundleItemsV176(l,h)){const p=(l.printPlan||[]).find(p=>p.materialId===x.materialId&&p.variantId===x.variantId);if(p)p.needed=t==='print'&&isPrintVariantV176(x.v,x.m);}if(t!=='print')skipResourcePrintV177(l,h,t);else{saveState();render();}});
  document.querySelectorAll('[data-v176-defer]').forEach(el=>el.onchange=()=>{const [l,h]=parse(el.dataset.v176Defer);if(!l)return;const b=resourceBundleV176(l,h,true);b.deferred=!!el.checked;for(const x of bundleItemsV176(l,h)){const p=(l.printPlan||[]).find(p=>p.materialId===x.materialId&&p.variantId===x.variantId);if(p)p.needed=!b.deferred&&resourceTypeV14(l,h)==='print'&&isPrintVariantV176(x.v,x.m);}saveState();render();});
  document.querySelectorAll('[data-v177-scan]').forEach(el=>el.onchange=async()=>{const [l,h]=parse(el.dataset.v177Scan);if(!l)return;const files=[...(el.files||[])].filter(f=>/\.(pdf|png|jpe?g|webp)$/i.test(f.name));if(!files.length)return;
    const b=resourceBundleV176(l,h,true);let done=0;try{for(const f of files){const m={id:uid('mat'),title:f.name.replace(/\.[^.]+$/,''),kind:'file',resourceType:'reference',source:`Scan · ${h}`,pages:'',tasks:'',variants:[],improvementFlags:[],assignments:[{classId:l.classId,sequenceId:l.sequenceId||'',unitId:l.planReference?.unitId||''}]},v={id:uid('var'),type:'standard',label:'Scan / Buchseite',available:true,fileName:f.name,fileKey:`material-${m.id}-scan`};m.variants.push(v);await fileStorePut(v.fileKey,f);storedFileKeys.add(v.fileKey);state.materials.push(m);b.items.push({id:uid('bundle'),materialId:m.id,variantId:v.id});l.materials=l.materials||[];l.materials.push(m.id);done++;}saveState();render();alert(`${done} Scan${done===1?'':'s'} lokal hinterlegt – ohne Kopierauftrag.`);}catch(err){saveState();render();alert(`Scans nicht vollständig gespeichert: ${err.message||err}`);}
  });
  document.querySelectorAll('[data-v177-file]').forEach(b=>b.onclick=async()=>{const [mid,vid]=b.dataset.v177File.split('|'),v=variant(mid,vid);const rec=await fileStoreGet(v?.fileKey);if(!rec?.blob)return alert('Die Datei ist hier nicht lokal verfügbar. Verbinde ggf. die Material-ZIP erneut.');downloadBlob(rec.name||v.fileName||'Material',rec.blob);});
  document.querySelectorAll('[data-v177-file-printed]').forEach(b=>b.onclick=()=>{const [lid,pid]=b.dataset.v177FilePrinted.split('|'),p=lesson(lid)?.printPlan?.find(x=>x.id===pid);if(!p)return;p.alreadyPrinted=!p.alreadyPrinted;saveState();render();});
  document.querySelector('[data-v177-mark-printed]')?.addEventListener('click',()=>{for(const i of weekPrintJobsV177().filter(i=>i.fileReady))i.plan.alreadyPrinted=true;if(weekPrintJobsV177().every(i=>i.plan.alreadyPrinted)&&!missingWeekPrintResourcesV14().length){weekWorkflowV177().printClosed=true;weekWorkflowV177().printPanelOpen=false;}saveState();render();});
  document.querySelector('[data-v177-week-printed]')?.addEventListener('click',markWeekPrintedV177);
  document.querySelector('[data-v177-print-toggle]')?.addEventListener('click',()=>{const w=weekWorkflowV177();w.printPanelOpen=!w.printPanelOpen;saveState();render();});
  document.querySelectorAll('[data-v177-plan]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.v177Plan);if(!l)return;l.manualPlanReadyV177=true;l.manualPlanAtV177=new Date().toISOString();saveState();render();});
  document.querySelectorAll('[data-v177-plan-reset]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.v177PlanReset);if(!l)return;l.manualPlanReadyV177=false;saveState();render();});
  document.querySelectorAll('[data-v177-ppt-external]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.v177PptExternal);if(!l)return;l.presentationReady=true;l.presentationSourceV177='external';l.presentationNotRequiredV177=false;l.presentationFileName=l.presentationFileName||'extern vorhanden';saveState();render();});
  document.querySelectorAll('[data-v177-ppt-none]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.v177PptNone);if(!l)return;l.presentationReady=true;l.presentationNotRequiredV177=true;l.presentationSourceV177='none';l.presentationFileName='';saveState();render();});
  document.querySelectorAll('[data-v177-ppt-upload]').forEach(el=>el.onchange=async()=>{const l=lesson(el.dataset.v177PptUpload),f=el.files?.[0];if(!l||!f)return;try{await fileStorePut(`lesson-ppt-${l.id}`,f);storedFileKeys.add(`lesson-ppt-${l.id}`);l.presentationReady=true;l.presentationNotRequiredV177=false;l.presentationSourceV177='uploaded';l.presentationFileName=f.name;saveState();render();}catch(err){alert(`PowerPoint konnte nicht lokal gespeichert werden: ${err.message||err}`);}});
  document.querySelectorAll('[data-v177-ppt-download]').forEach(b=>b.onclick=async()=>{const l=lesson(b.dataset.v177PptDownload),rec=await fileStoreGet(`lesson-ppt-${l?.id}`);if(!rec?.blob)return alert('Diese Präsentation ist nicht mehr lokal verfügbar. Bitte erneut hinterlegen.');downloadBlob(rec.name,rec.blob);});
  document.querySelectorAll('[data-v177-ppt-reset]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.v177PptReset);if(!l)return;l.presentationReady=false;l.presentationNotRequiredV177=false;l.presentationSourceV177='';saveState();render();});
  document.querySelectorAll('[data-v177-plan-next]').forEach(b=>b.onclick=()=>visitWeekV177(1,true));
  document.querySelector('[data-v177-start-next]')?.addEventListener('click',()=>{if(!weekFullyReadyV177())return;visitWeekV177(1,false);});
  document.querySelector('[data-v177-calendar-week]')?.addEventListener('click',()=>{state.settings.activeWeekStart=defaultPlanningWeekStart();saveState();view='prep';render();});
};
const renderBeforeV177=render;
render=function(){renderBeforeV177();const b=document.querySelector('.brand small');if(b)b.textContent=`${state.settings.schoolYear} · V0.17.7`;};
render();


/* ===== V0.17.8 – zuverlässiger ChatGPT-Rückimport =====
   Defekte/verkürzte JSON-Blöcke dürfen weder stillschweigend übernommen
   noch als Kopierfehler der Lehrkraft dargestellt werden.
   Die Datei ist optional; sämtlicher Zustand bleibt wie bisher bestehen. */
const v178ParserBefore = parseAiImport;
parseAiImport = function(raw){
  const text = String(raw||'').replace(/^\uFEFF/,'').replace(/\u00a0/g,' ')
    .replace(/\\(<\/?SCHULCOCKPIT_IMPORT>)/gi,'$1').trim();
  if(!text) throw new Error('Bitte zuerst die ChatGPT-Antwort oder die JSON-Datei einfügen.');
  const openTag = /<SCHULCOCKPIT_IMPORT>/i.test(text);
  const marker = text.match(/<SCHULCOCKPIT_IMPORT>\s*([\s\S]*?)\s*<\/SCHULCOCKPIT_IMPORT>/i);
  if(openTag && !marker) throw new Error('Der Schulcockpit-Datenblock ist unvollständig: Das schließende </SCHULCOCKPIT_IMPORT> fehlt. Bitte den Block vollständig neu erzeugen lassen.');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let json = marker ? marker[1].trim() : fenced ? fenced[1].trim() : text;
  json = json.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  let parsed;
  try { parsed = JSON.parse(json); }
  catch(error){
    if(!marker && !fenced && !/^\s*\{/.test(text)) return v178ParserBefore(text);
    throw new Error('Der JSON-Datenblock aus ChatGPT ist beschädigt und kann nicht importiert werden. '+
      String(error.message||'Syntaxfehler')+' — Bitte einen neuen gültigen JSON-Block erzeugen lassen oder eine korrigierte .json-Datei öffnen.');
  }
  const root = parsed?.schulcockpit || parsed;
  const object = x => x && typeof x==='object' && !Array.isArray(x);
  if(!object(root)||!object(root.lesson)) throw new Error('Der Datenblock benötigt ein lesson-Objekt mit Thema und Ziel.');
  for(const key of ['phases','slides','materials','prepTasks']){
    if(!Array.isArray(root[key]))throw new Error(`Das Feld „${key}“ fehlt oder ist keine JSON-Liste. Bitte die vollständige JSON-Struktur erneut erzeugen lassen.`);
  }
  if(!root.phases.length || !root.slides.length) throw new Error('Der Datenblock enthält keine vollständigen Phasen/Folien. Bitte den JSON-Block erneut erzeugen lassen.');
  for(const sl of root.slides){
    if(!object(sl))throw new Error('Mindestens ein Folieneintrag ist kein JSON-Objekt.');
    for(const key of ['content','steps','secondary','tertiary','solutionA','solutionB','comparison','takeaway']){
      if(key in sl && !Array.isArray(sl[key]))throw new Error(`Folienfeld „${key}“ muss eine Liste in eckigen Klammern [ ] sein.`);
    }
  }
  for(const phase of root.phases){
    if(!object(phase)||typeof phase.title!=='string'||!Number.isFinite(Number(phase.minutes)))throw new Error('Eine Phase hat keinen gültigen Titel oder Minutenwert.');
  }
  return v178ParserBefore(JSON.stringify(root));
};

const v178PromptBefore = concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
  const old=v178PromptBefore(l);
  return old+`\n\n## TECHNISCHE AUSGABEPRÜFUNG – WICHTIG\nDer markierte SCHULCOCKPIT_IMPORT-Block wird von einer Software mit JSON.parse gelesen. Schreibe den JSON-Block ausführlich und mit normalen Leerzeichen, nicht als zusammengepresste Pseudocode-Fragmente. JSON ist KEINE Markdown-Tabelle.\n- Alle vier Felder phases, slides, materials und prepTasks sind immer echte Arrays: [ { ... }, { ... } ] oder [].\n- Jeder Eintrag in phases, slides und materials ist ein eigenes vollständiges Objekt in { }. Trenne Objekte durch Kommas.\n- content, steps, secondary, tertiary, solutionA, solutionB, comparison und takeaway sind – wenn verwendet – immer Arrays, nie lose Strings.\n- Escape Anführungszeichen innerhalb von Strings korrekt. Keine JSON-Kommentare, keine Auslassungspunkte als alleinige Arrayeinträge, keine nicht geschlossenen Klammern. Akzente/Umlaute und Wortabstände in Strings erhalten.\n- Ein einzelner markierter Block mit den unveränderten Tags <SCHULCOCKPIT_IMPORT> und </SCHULCOCKPIT_IMPORT>. Verwende keine Backslashes vor den Tags.\n- Stelle dir vor dem Ausgeben vor, du führtest JSON.parse über das Objekt aus. Prüfe dabei Arrays, Kommas, Anführungszeichen und schließende Klammern.\n- Nach dem normalen Stundenentwurf bitte nach Möglichkeit auch die identischen Daten als herunterladbare UTF-8-Datei Schulcockpit_Import.json bereitstellen. Ein valider JSON-Block in der Antwort bleibt trotzdem erforderlich.\n- Wenn der Datenblock zu lang wird, kürze die erläuternde Prosa, NICHT die JSON-Struktur. Die erwarteten Sicherungsergebnisse bleiben in content/secondary und werden nur in Referentennotizen gezeigt.\n`;
};
makeBrief=concretePlanningPromptV12;

const v178WizardImportBefore=wizardImportStepV14;
wizardImportStepV14=function(l){
  const base=v178WizardImportBefore(l);
  const extra=`<div class="import-file-help-v178"><label class="upload-button">Gültige .json / .txt / .md öffnen<input type="file" id="v178-import-file" accept=".json,.txt,.md,application/json,text/plain,text/markdown" hidden></label><small>Alternativ zur Zwischenablage: Datei auswählen. Deine bisherige Planung wird erst nach der Vorschau geändert.</small></div>${wizardV14.error?`<div class="import-error-v178" role="alert"><strong>${wizardV14.errorKind==='save'?'Übernahme abgebrochen – die Antwort wurde erkannt.':'Diese Antwort ist nicht importierbar.'}</strong><p>${esc(wizardV14.error)}</p><small>${wizardV14.errorKind==='save'?'Dein Text bleibt im Eingabefeld erhalten. Du kannst es nach der Korrektur erneut versuchen.':'Du kannst die fehlerhafte Antwort hier im Chat korrigieren lassen und anschließend die gültige JSON-Datei auswählen.'}</small></div>`:''}`;
  return base.replace('</textarea>', '</textarea>'+extra);
};
const v178WireBefore=wire;
wire=function(){
  v178WireBefore();
  // Capture handler ersetzt das alte generische Fehler-Popup für Schritt 3.
  document.querySelector('[data-v14-parse-answer]')?.addEventListener('click',event=>{
    event.stopImmediatePropagation();event.preventDefault();
    wizardV14.raw=document.getElementById('v14-answer')?.value||'';
    try{wizardV14.parsed=parseAiImport(wizardV14.raw);wizardV14.error='';}
    catch(error){wizardV14.parsed=null;wizardV14.error=String(error.message||error);}
    render();
  },true);
  document.querySelector('#v178-import-file')?.addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      wizardV14.raw=await file.text();
      wizardV14.parsed=parseAiImport(wizardV14.raw);
      wizardV14.error='';
    }catch(error){wizardV14.parsed=null;wizardV14.error=String(error.message||error);}
    render();
  });
};
const v178RenderBefore=render;
render=function(){v178RenderBefore();const b=document.querySelector('.brand small');if(b)b.textContent=`${state.settings.schoolYear} · V0.17.8`;};
render();

/* ===== V0.17.9 – Master-Typografie, echtes dynamisches Datum, Kahoot-Workflow =====
   Unverändert bleiben localStorage-Key, IndexedDB-Dateien, Reihenplanung und
   bisherige PPTX-Notizen. Für Kahoot wird ausschließlich bestätigter früherer
   Stoff als Kontext verwendet. Es gibt keinen KI-/Kahoot-API-Aufruf im Browser. */

function v179Uuid(){return '{'+ 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return (c==='x'?r:((r&3)|8)).toString(16).toUpperCase();}) +'}';}
function v179CleanStep(x){return String(x||'').replace(/^\s*(?:[1-9][0-9]?[.):\-]\s*|[①②③④]\s*)/u,'').trim();}
function v179NoBulletPara(value,size=0,heading=false){
  const text=v13Xml(value),font=heading?'<a:latin typeface="Coming Soon"/>':'';
  const attrs=` lang="de-DE"${size?` sz="${size}"`:''}${heading?' b="1"':''}`;
  return `<a:p><a:pPr marL="0" indent="0"><a:buNone/></a:pPr>${text?`<a:r><a:rPr${attrs}>${font}</a:rPr><a:t>${text}</a:t></a:r>`:''}<a:endParaRPr${size?` sz="${size}"`:''}>${font}</a:endParaRPr></a:p>`;
}
function v179PlaceholderBody(ph){
  if(ph.type==='dt'){
    // PowerPoint verwendet ein dynamisches a:fld-Datumsfeld. Ein normaler
    // a:r-Text würde daraus ein FIXES Unterrichtsdatum machen.
    const preview=new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'}).format(new Date());
    return `<a:p><a:fld id="${v179Uuid()}" type="datetime"><a:rPr lang="de-DE" sz="1200" smtClean="0"/><a:pPr/><a:t>${v13Xml(preview)}</a:t></a:fld><a:endParaRPr lang="de-DE"/></a:p>`;
  }
  if(ph.isStep)return v179NoBulletPara(v179CleanStep(v13Lines(ph.text)[0]||''),0,false);
  if(ph.richTitle){
    const lines=v13Lines(ph.text);
    return [v179NoBulletPara(lines[0]||'',3000,true),...lines.slice(1).map(x=>v179NoBulletPara(x,0,false))].join('');
  }
  return v13Paras(ph.text);
}
const v179OldPlaceholderXml=v13PlaceholderXml;
v13PlaceholderXml=function(id,ph){
  const extra=ph.type==='dt'?' sz="half"':ph.type==='sldNum'?' sz="quarter"':'';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Placeholder ${id}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph${ph.type?` type="${v13Xml(ph.type)}"`:''}${extra} idx="${ph.idx}"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr${ph.type==='dt'?' wrap="none"':''}/><a:lstStyle/>${v179PlaceholderBody(ph)}</p:txBody></p:sp>`;
};
const v179OldPhysicalSlides=v13PhysicalSlides;
v13PhysicalSlides=async function(l,layoutMap){
  const out=await v179OldPhysicalSlides(l,layoutMap);
  const nameById=new Map([...layoutMap.entries()].map(([name,id])=>[id,name]));
  const titles=new Set(v175OrderedSlides(l).map(sl=>String(sl.title||'').trim()).filter(Boolean));
  for(const s of out){
    const layout=nameById.get(s.layout)||'';
    for(const ph of s.ph||[]){
      if(layout.startsWith('arbeitsauftrag schritte') && ph.idx>=13 && ph.idx<=16){
        ph.text=v13Lines(ph.text).map(v179CleanStep);ph.isStep=true;
      }
      const headingPlace=(layout.startsWith('textfeld')&&ph.idx===11) ||
        (layout.startsWith('arbeitsauftrag -')&&ph.idx===13) ||
        (layout.startsWith('exit -')&&ph.idx===13) ||
        (layout.startsWith('fehlerdetektiv -')&&ph.idx===11) ||
        (layout.startsWith('thema -')&&ph.idx===11);
      if(headingPlace && ph.text?.length && titles.has(String(ph.text[0]).trim()))ph.richTitle=true;
    }
  }
  return out;
};

function v179IsDigital(c){return !!c?.allIpadsV179;}
const v179TtBefore=timetableView;
timetableView=function(){
  const base=v179TtBefore();
  const rows=(state.classes||[]).map(c=>`<label class="kahoot-class-v179"><input type="checkbox" data-v179-digital="${esc(c.id)}" ${v179IsDigital(c)?'checked':''}><span><strong>${esc(c.subject)} ${esc(c.name)}</strong><small>Alle Schüler:innen können im Unterricht mit einem iPad/Gerät teilnehmen</small></span><span class="kahoot-digital-state-v179">${v179IsDigital(c)?'Digital ✓':'Optional'}</span></label>`).join('');
  const section=`<section class="panel kahoot-class-panel-v179"><div class="section-head"><div><span class="eyebrow">DIGITALE LERNGRUPPEN</span><h2>Kahoot als optionale Wiederholung</h2></div></div><p class="muted">Pro Fachkurs aktivieren. Für eine so markierte Klasse erscheint bei jeder Unterrichtsstunde „Kahoot vorbereiten“. Das Quiz fragt nur bestätigten Stoff früherer Stunden ab.</p><div class="kahoot-class-list-v179">${rows}</div><div class="kahoot-template-v179"><div><strong>Offizielle Kahoot-Excelvorlage</strong><p class="muted">Einmal lokal hinterlegen; die Fragen werden später in diese Vorlage geschrieben. Keine Vorlagendatei wird auf GitHub geladen.</p><small>${esc(state.settings.kahootTemplateNameV179||'Noch keine Vorlage hinterlegt')}</small></div><label class="upload-button">${state.settings.kahootTemplateNameV179?'Vorlage ersetzen':'Vorlage auswählen'}<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" id="v179-kahoot-template" hidden></label></div><p class="microcopy">Die offizielle Vorlage findest du unter <a href="https://support.kahoot.com/hc/de/articles/115002812547-So-importierst-du-Fragen-aus-einem-Arbeitsblatt-in-dein-Kahoot" target="_blank" rel="noopener">Kahoot: Spreadsheet-Import</a>.</p></section>`;
  const i=base.lastIndexOf('</div>');return i>=0?base.slice(0,i)+section+base.slice(i):base+section;
};

const v179PrepRowBefore=coursePrepRowV14;
coursePrepRowV14=function(l){
  const base=v179PrepRowBefore(l);if(!v179IsDigital(cls(l.classId)))return base;
  const status=l.kahootV179?.questions?.length?`Kahoot (${l.kahootV179.questions.length}) ansehen`:'Optional: Kahoot';
  return base.replace('</div></article>',`<button class="secondary" data-v179-kahoot="${l.id}">${esc(status)} ↗</button></div></article>`);
};
const v179PptStepBefore=wizardPptStepV14;
wizardPptStepV14=function(l){
  const base=v179PptStepBefore(l);if(!v179IsDigital(cls(l.classId)))return base;
  const box=`<div class="kahoot-wizard-cta-v179"><div><span class="eyebrow">OPTIONAL · DIGITALE KLASSE</span><strong>Kahoot-Wiederholung</strong><p>15 Multiple-Choice-Fragen zum bereits behandelten Stoff, nicht zur neuen Stunde. Ein eigener Prompt und Excel-Export.</p></div><button class="secondary" data-v179-kahoot="${l.id}">${l.kahootV179?.questions?.length?'Kahoot ansehen':'Kahoot vorbereiten →'}</button></div>`;
  return base.replace('</section>',box+'</section>');
};

let kahootDraftV179={lessonId:'',raw:'',error:'',parsed:null};
function v179Candidates(l){
  const all=(state.lessons||[]).filter(x=>x.classId===l.classId && x.id!==l.id && x.date<l.date && x.kind!=='group');
  const current=all.filter(x=>l.sequenceId?x.sequenceId===l.sequenceId:(x.unit&&x.unit===l.unit));
  return current.sort((a,b)=>a.date.localeCompare(b.date)).slice(-16);
}
function v179IsDocumentedDone(x){return x.status==='done'||!!x.reflection?.note?.trim()||(x.completedSteps||[]).length>0;}
function v179ReviewState(l){
  if(!l.kahootV179)l.kahootV179={selectedLessonIds:[],questionCount:15,extraTopics:'',questions:[]};
  if(!Array.isArray(l.kahootV179.selectedLessonIds))l.kahootV179.selectedLessonIds=[];
  if(l.kahootV179.selectionInitialized!==true){
    l.kahootV179.selectedLessonIds=v179Candidates(l).filter(v179IsDocumentedDone).map(x=>x.id);
    l.kahootV179.selectionInitialized=true;
  }
  return l.kahootV179;
}
function v179OpenKahoot(id){
  const l=lesson(id);if(!l)return;
  v179ReviewState(l);kahootDraftV179={lessonId:id,raw:'',error:'',parsed:null};view='kahoot';render();
}
function v179Prompt(l){
  const c=cls(l.classId),k=v179ReviewState(l);
  const selected=v179Candidates(l).filter(x=>k.selectedLessonIds.includes(x.id));
  if(!selected.length&&!String(k.extraTopics||'').trim())throw new Error('Bitte zunächst behandelte frühere Stunden auswählen oder ein bestätigtes früheres Thema eintragen.');
  const source=selected.map((x,i)=>{
    const p=x.planReference||{},r=x.reflection||{};
    return `${i+1}. ${x.date} – ${x.title||p.title||'Ohne Titel'}\n   AUSGEWÄHLT ALS BEREITS BEHANDELT (von der Lehrkraft bestätigt)\n   Material/Schwerpunkte des Sollplans (nicht automatisch als vollständig geschafft behaupten): ${String(p.content||'nicht hinterlegt').slice(0,520)}\n   Tatsächlich erledigte Schritte: ${(x.completedSteps||[]).join('; ')||'nicht dokumentiert'}\n   Reflexion: ${r.note||'keine'} ${r.learning?`(Lernstand: ${r.learning})`:''}`;
  }).join('\n');
  const count=Math.max(5,Math.min(30,Number(k.questionCount)||15));
  return `# Schulcockpit – Kahoot-Wiederholung für eine zukünftige Unterrichtsstunde\n\nKlasse/Fach: ${c?.subject||''} ${c?.name||''} (Jahrgang ${c?.name||''}; ${c?.students||'?'} Schüler:innen).\nZielstunde: ${l.date} – ${l.title||l.planReference?.title||''}.\nWICHTIG: Das Zielstundenthema ist NUR Datums-/Planungskontext. NICHT den neuen Stoff dieser Zielstunde abfragen.\n\n## Verbindlich von der Lehrkraft als zuvor behandelt ausgewählt\n${source||'- keine Einzelstunde ausgewählt'}\n${String(k.extraTopics||'').trim()?`\nWeitere von der Lehrkraft ausdrücklich als bereits behandelt bestätigte Inhalte: ${k.extraTopics.trim()}\n`:''}\n## Auftrag\nErstelle GENAU ${count} inhaltlich korrekte Multiple-Choice-Fragen als spielerischen Wiederholungs-Kahoot für diese Lerngruppe. Nur gesicherte Inhalte der oben ausgewählten vorherigen Stunden verwenden. Wenn die Quellen für ${count} wirklich verschiedene tragfähige Fragen nicht reichen, sage das vor dem Importblock und erfinde NICHTS. Wähle sinnvolle Mischung aus Grundwissen und Verständnis; keine neuen Begriffe oder Details aus der heutigen noch nicht gehaltenen Stunde. Eine offensichtlich humorvolle, harmlose falsche Antwortmöglichkeit hier und da, an wechselnden Positionen, ohne Religionen oder Menschen lächerlich zu machen. Die richtige Antwort auf die Positionen 1–4 verteilen; nicht immer A.\n\nVorgaben je Frage: maximal 95 Zeichen für den offiziellen Excel-Import (damit innerhalb der gewünschten 120 Zeichen), jede der VIER Antworten maximal 50 Zeichen, genau EINE richtige Antwort, Zeit immer 30 Sekunden. Korrekte Antwort ist als Zahl 1 (=A), 2 (=B), 3 (=C), 4 (=D) anzugeben. Antworten sollen eindeutig und nicht überlappend sein.\n\nAntworte möglichst als EINE normale, kopierbare Textantwort ohne interaktive Kästen/Buttons. Gib den vollständigen Datenblock in einem JSON-Codeblock aus, keine Markdown-Tabelle. Er darf mit der normalen Kopierfunktion zusammen mit kurzem erläuterndem Text kopiert werden. Verwende echte JSON-Arrays und normale Zeichen/Umlaute; prüfe die Syntax wie mit JSON.parse. Format:\n<SCHULCOCKPIT_KAHOOT>\n{\n  "schema": "schulcockpit.kahoot.v1",\n  "title": "Wiederholung – ${String(c?.subject||'Unterricht')} ${String(c?.name||'')}",\n  "questions": [\n    {"question":"Fragetext?","answers":["Antwort A","Antwort B","Antwort C","Antwort D"],"time":30,"correctAnswer":1}\n  ]\n}\n</SCHULCOCKPIT_KAHOOT>\n\nKeine Zahl vor die Fragetexte schreiben. Die spätere Excel-Vorlage enthält die Spalten Frage, Antwort 1–4, Zeitlimit und Nummer der richtigen Antwort. Falls möglich, biete die identischen JSON-Daten zusätzlich als UTF-8-Datei an.\n`;
}
function v179ParseKahoot(raw){
  const text=String(raw||'').replace(/^\uFEFF/,'').replace(/\u00a0/g,' ').replace(/\\(<\/?SCHULCOCKPIT_KAHOOT>)/gi,'$1').trim();
  if(!text)throw new Error('Bitte die ChatGPT-Antwort oder eine JSON-Datei einfügen.');
  const tagged=text.match(/<SCHULCOCKPIT_KAHOOT>\s*([\s\S]*?)\s*<\/SCHULCOCKPIT_KAHOOT>/i);
  if(/<SCHULCOCKPIT_KAHOOT>/i.test(text)&&!tagged)throw new Error('Der Kahoot-Block ist unvollständig; das schließende Tag fehlt.');
  const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let payload=(tagged?.[1]||fenced?.[1]||text).trim();payload=payload.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let o;try{o=JSON.parse(payload);}catch(e){throw new Error(`Kein gültiges Kahoot-JSON: ${e.message}`);}
  if(o?.schulcockpit)o=o.schulcockpit;
  if(!Array.isArray(o.questions)||!o.questions.length)throw new Error('Das Kahoot braucht ein questions-Array mit Fragen.');
  const out=o.questions.map((q,i)=>{
    const question=String(q.question||'').trim();
    const answers=Array.isArray(q.answers)?q.answers.map(a=>String(a||'').trim()):[];
    const correct=Number(q.correctAnswer??q.correct??q.correctAnswerIndex);
    const time=Number(q.time??q.timeLimit??30);
    if(!question||question.length>95)throw new Error(`Frage ${i+1}: Bitte 1–95 Zeichen einhalten (Kahoot-Excelvorlage).`);
    if(answers.length!==4||answers.some(a=>!a||a.length>50))throw new Error(`Frage ${i+1}: Genau 4 nichtleere Antworten mit jeweils maximal 50 Zeichen.`);
    if(new Set(answers.map(a=>a.toLocaleLowerCase('de-DE'))).size!==4)throw new Error(`Frage ${i+1}: Antwortmöglichkeiten dürfen nicht identisch sein.`);
    if(![1,2,3,4].includes(correct))throw new Error(`Frage ${i+1}: correctAnswer muss 1, 2, 3 oder 4 sein.`);
    if(time!==30)throw new Error(`Frage ${i+1}: Zeitlimit muss 30 Sekunden sein.`);
    return {question,answers,correctAnswer:correct,time:30};
  });
  return {schema:'schulcockpit.kahoot.v1',title:String(o.title||'Wiederholung').slice(0,120),questions:out};
}
function v179KahootView(){
  const l=lesson(kahootDraftV179.lessonId);if(!l)return '<section class="panel">Keine Stunde ausgewählt. <button data-view="prep">Zurück</button></section>';
  const k=v179ReviewState(l),c=cls(l.classId),prior=v179Candidates(l);
  const questionCount=k.questions?.length||0;
  const checks=prior.length?prior.map(x=>`<label class="kahoot-prior-row-v179"><input type="checkbox" data-v179-prior="${x.id}" ${k.selectedLessonIds.includes(x.id)?'checked':''}><span><strong>${esc(fmtDate(x.date))} · ${esc(x.title||x.planReference?.title||'Stunde')}</strong><small>${v179IsDocumentedDone(x)?'✓ Als gehalten / bearbeitet dokumentiert':'○ Nur Sollplan – bitte nur wählen, wenn tatsächlich behandelt'}</small></span></label>`).join(''):'<p class="muted">Noch keine früheren Stunden dieser Reihe im Cockpit. Du kannst unten ausdrücklich bestätigte frühere Themen eingeben.</p>';
  const preview=k.questions?.length?`<section class="panel kahoot-preview-v179"><div class="section-head"><div><span class="eyebrow">BEREITS IMPORTIERT</span><h2>${questionCount} Fragen</h2></div><button class="secondary" data-v179-clear-quiz>Fragen ersetzen</button></div><div class="kahoot-quiz-list-v179">${k.questions.map((q,i)=>`<details><summary><strong>${i+1}. ${esc(q.question)}</strong><small>✓ ${'ABCD'[q.correctAnswer-1]} · 30 Sek.</small></summary><div>${q.answers.map((a,n)=>`<p class="${q.correctAnswer===n+1?'correct':''}">${'ABCD'[n]}: ${esc(a)} ${q.correctAnswer===n+1?'✓':''}</p>`).join('')}</div></details>`).join('')}</div><div class="kahoot-export-v179"><button class="primary" data-v179-export-xlsx ${!state.settings.kahootTemplateNameV179?'disabled':''}>Kahoot als Excel-Vorlage herunterladen ↓</button><button class="secondary" data-v179-export-json>JSON sichern ↓</button>${!state.settings.kahootTemplateNameV179?'<p class="muted">Bitte in „Stundenplan & Klassen“ zuerst die offizielle Kahoot-Vorlage hinterlegen.</p>':''}</div></section>`:'';
  return `<div class="content-grid kahoot-page-v179"><section class="wizard-head-v14"><button class="text-button" data-view="prep">← Wochenvorbereitung</button><div><span class="eyebrow">DIGITALE KLASSE · OPTIONAL</span><h1>Kahoot-Wiederholung · ${esc(c?.subject||'')} ${esc(c?.name||'')}</h1><p>${esc(l.date)} · ${esc(l.title||l.planReference?.title||'')}</p></div></section><section class="panel"><div class="section-head"><div><span class="eyebrow">SCHRITT 1</span><h2>Was haben die Kinder bereits behandelt?</h2></div></div><p class="muted">Nur ausgewählte frühere Stunden gelangen in den Prompt. Ein Sollplan gilt nicht automatisch als unterrichtet. Die neue Stunde bleibt ausgeschlossen.</p><div class="kahoot-prior-list-v179">${checks}</div><label class="kahoot-extra-v179">Weitere tatsächlich behandelte Inhalte (optional)<textarea id="v179-extra-topics" rows="3" placeholder="Nur Dinge ergänzen, die im Unterricht wirklich behandelt wurden …">${esc(k.extraTopics||'')}</textarea></label><label class="kahoot-count-v179">Fragenanzahl <input id="v179-count" type="number" min="5" max="30" value="${Number(k.questionCount)||15}"></label><div class="wizard-footer-v14"><button class="primary" data-v179-copy-prompt>Kahoot-Prompt kopieren</button></div></section><section class="panel"><span class="eyebrow">SCHRITT 2</span><h2>Antwort einfügen oder JSON öffnen</h2><p>Du kannst eine vollständige kopierte Textantwort einfügen. Bei interaktiven ChatGPT-Karten alternativ den JSON-Block bzw. eine heruntergeladene .json-Datei verwenden.</p><textarea class="ai-import-text" id="v179-kahoot-answer" placeholder="ChatGPT-Antwort mit SCHULCOCKPIT_KAHOOT-Block …">${esc(kahootDraftV179.raw)}</textarea><div class="kahoot-upload-row-v179"><label class="upload-button">JSON / Textdatei öffnen<input type="file" id="v179-kahoot-import-file" accept=".json,.txt,.md" hidden></label><button class="primary" data-v179-parse>Kahoot prüfen & übernehmen →</button></div>${kahootDraftV179.error?`<div class="import-error-v178" role="alert">${esc(kahootDraftV179.error)}</div>`:''}<p class="microcopy">Max. 95 Zeichen Frage (Excel-Import), max. 50 je Antwort; 4 Antworten, 1 richtige Antwort, immer 30 Sekunden.</p></section>${preview}</div>`;
}
const v179ViewBefore=viewHtml;
viewHtml=function(){if(view==='kahoot')return v179KahootView();return v179ViewBefore();};
const v179TitleBefore=pageTitle;
pageTitle=function(){return view==='kahoot'?'Kahoot vorbereiten':v179TitleBefore();};

/* XLSX-Export: offizielle, von der Lehrkraft hochgeladene Vorlage behalten und
   lediglich Zellen der Quiz-Tabelle ersetzen. styles, sharedStrings, Tabellen-
   validierung und Arbeitsmappen-Metadaten bleiben erhalten. */
function v179CellText(cell,shared){
  const type=cell.getAttribute('t')||'';
  if(type==='s'){const i=Number(cell.getElementsByTagName('v')[0]?.textContent||-1);return shared[i]||'';}
  if(type==='inlineStr')return [...cell.getElementsByTagName('t')].map(t=>t.textContent||'').join('');
  return cell.getElementsByTagName('v')[0]?.textContent||'';
}
function v179ColRef(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
function v179ColIndex(ref){let n=0;for(const c of String(ref).replace(/[^A-Z]/g,''))n=n*26+c.charCodeAt(0)-64;return n;}
function v179SetCell(doc,row,col,rowNo,value,isNum=false){
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',ref=`${col}${rowNo}`;
  let cell=[...row.getElementsByTagNameNS(ns,'c')].find(c=>c.getAttribute('r')===ref);
  if(!cell){cell=doc.createElementNS(ns,'c');cell.setAttribute('r',ref);const existing=[...row.getElementsByTagNameNS(ns,'c')];const next=existing.find(c=>v179ColIndex(c.getAttribute('r'))>v179ColIndex(ref));if(next)row.insertBefore(cell,next);else row.appendChild(cell);}
  for(const ch of [...cell.childNodes])if(['v','is','f'].includes(ch.localName))cell.removeChild(ch);
  if(isNum){cell.removeAttribute('t');const v=doc.createElementNS(ns,'v');v.textContent=String(value);cell.appendChild(v);}
  else{cell.setAttribute('t','inlineStr');const inline=doc.createElementNS(ns,'is'),t=doc.createElementNS(ns,'t');t.textContent=String(value);inline.appendChild(t);cell.appendChild(inline);}
}
async function v179ExportKahootXlsx(l){
  const rec=await fileStoreGet('__kahoot_template_v179__');if(!rec?.blob)throw new Error('Bitte unter „Stundenplan & Klassen“ zuerst die offizielle Kahoot-Excelvorlage hinterlegen.');
  const zip=await JSZip.loadAsync(await rec.blob.arrayBuffer(),{checkCRC32:true});
  const parser=new DOMParser(),xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const ssFile=zip.file('xl/sharedStrings.xml');let shared=[];
  if(ssFile){const ss=parser.parseFromString(await ssFile.async('string'),'application/xml');shared=[...ss.getElementsByTagNameNS(xmlns,'si')].map(si=>[...si.getElementsByTagNameNS(xmlns,'t')].map(t=>t.textContent||'').join(''));}
  const sheetNames=Object.keys(zip.files).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(n));
  if(!sheetNames.length)throw new Error('Die Vorlage enthält kein Arbeitsblatt. Bitte originale Kahoot-Vorlage verwenden.');
  let sheetName=null,doc=null,sheetData=null,rows=[],header=null,cols=null;
  // Kahoot-Vorlagen können ein separates Hinweisblatt vor dem Frageblatt haben.
  // Die richtige Tabelle wird anhand ihrer Spalten ermittelt, nicht anhand der Blattnummer.
  for(const candidate of sheetNames){
    const candidateDoc=parser.parseFromString(await zip.file(candidate).async('string'),'application/xml');
    if(candidateDoc.getElementsByTagName('parsererror').length)continue;
    const candidateData=candidateDoc.getElementsByTagNameNS(xmlns,'sheetData')[0];if(!candidateData)continue;
    const candidateRows=[...candidateData.getElementsByTagNameNS(xmlns,'row')];
    for(const row of candidateRows){
    const cells=[...row.getElementsByTagNameNS(xmlns,'c')].map(c=>({col:c.getAttribute('r').match(/^[A-Z]+/)?.[0],label:v179CellText(c,shared).toLowerCase().replace(/\s+/g,' ').trim()}));
    const question=cells.find(c=>/^(question|frage)(\s|\b)/.test(c.label));
    const answers=[1,2,3,4].map(n=>cells.find(c=>new RegExp(`(?:answer|antwort)\\s*${n}(?:\\b|\\s|[-–])`).test(c.label)));
    const time=cells.find(c=>/time|zeit/.test(c.label));const correct=cells.find(c=>/correct|richtig/.test(c.label));
    if(question&&answers.every(Boolean)&&time&&correct){header=Number(row.getAttribute('r'));cols={question:question.col,answers:answers.map(a=>a.col),time:time.col,correct:correct.col};sheetName=candidate;doc=candidateDoc;sheetData=candidateData;rows=candidateRows;break;}
    }
    if(header)break;
  }
  if(!header)throw new Error('Die erwarteten Spalten (Frage, Antwort 1–4, Zeit, richtige Antwort) wurden in der Vorlage nicht gefunden. Bitte die originale Quiz-Import-Vorlage hinterlegen.');
  const h=[...rows.find(r=>Number(r.getAttribute('r'))===header).getElementsByTagNameNS(xmlns,'c')].map(c=>v179CellText(c,shared));
  const qHeader=h.find(x=>/^(question|frage)/i.test(x))||'';const cap=Number((qHeader.match(/(?:max(?:imum)?|up to|bis zu|höchstens)\s*(\d+)/i)||[])[1])||95;
  for(const [i,q] of l.kahootV179.questions.entries())if(q.question.length>Math.min(95,cap))throw new Error(`Frage ${i+1} hat ${q.question.length} Zeichen; deine hinterlegte Kahoot-Vorlage erlaubt maximal ${Math.min(95,cap)}. Bitte kürzen und erneut importieren.`);
  const styleRow=rows.find(r=>Number(r.getAttribute('r'))>header)||null;
  const list=l.kahootV179.questions;
  for(let i=0;i<list.length;i++){
    const rowNo=header+1+i,q=list[i];let row=rows.find(r=>Number(r.getAttribute('r'))===rowNo);
    if(!row){row=doc.createElementNS(xmlns,'row');row.setAttribute('r',String(rowNo));const later=[...sheetData.getElementsByTagNameNS(xmlns,'row')].find(r=>Number(r.getAttribute('r'))>rowNo);if(later)sheetData.insertBefore(row,later);else sheetData.appendChild(row);}
    if(styleRow&&row!==styleRow){for(const col of [cols.question,...cols.answers,cols.time,cols.correct]){let cell=[...row.getElementsByTagNameNS(xmlns,'c')].find(c=>c.getAttribute('r')===`${col}${rowNo}`);if(!cell){const prototype=[...styleRow.getElementsByTagNameNS(xmlns,'c')].find(c=>c.getAttribute('r')?.startsWith(col));if(prototype&&prototype.hasAttribute('s')){cell=doc.createElementNS(xmlns,'c');cell.setAttribute('r',`${col}${rowNo}`);cell.setAttribute('s',prototype.getAttribute('s'));row.appendChild(cell);}}}}
    v179SetCell(doc,row,cols.question,rowNo,q.question);q.answers.forEach((x,n)=>v179SetCell(doc,row,cols.answers[n],rowNo,x));v179SetCell(doc,row,cols.time,rowNo,30,true);v179SetCell(doc,row,cols.correct,rowNo,q.correctAnswer,true);
  }
  // Eventuell in der Vorlage stehende alte Beispiel-Fragen dürfen nicht als
  // zusätzliche, unerwünschte Fragen mit importiert werden.
  const end=header+list.length;
  for(const row of [...sheetData.getElementsByTagNameNS(xmlns,'row')]){
    const n=Number(row.getAttribute('r'));if(n<=end||n<=header)continue;
    if(n>end+100)break;
    for(const col of [cols.question,...cols.answers,cols.time,cols.correct]){
      const c=[...row.getElementsByTagNameNS(xmlns,'c')].find(x=>x.getAttribute('r')===`${col}${n}`);
      if(c)for(const ch of [...c.childNodes])if(['v','is','f'].includes(ch.localName))c.removeChild(ch);
    }
  }
  const xml=new XMLSerializer().serializeToString(doc);zip.file(sheetName,xml);
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6},mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const c=cls(l.classId);downloadBlob(safeName(`${l.date}_${c?.subject||''}_${c?.name||''}_Kahoot_Wiederholung`)+'.xlsx',blob);return list.length;
}

const v179WireBefore=wire;
wire=function(){
  v179WireBefore();
  document.querySelectorAll('[data-v179-digital]').forEach(el=>el.addEventListener('change',()=>{const c=cls(el.dataset.v179Digital);if(!c)return;c.allIpadsV179=el.checked;saveState();render();}));
  document.querySelector('#v179-kahoot-template')?.addEventListener('change',async e=>{
    const f=e.target.files?.[0];if(!f)return;
    if(!/\.xlsx$/i.test(f.name))return alert('Bitte die offizielle .xlsx-Vorlage auswählen.');
    try{await JSZip.loadAsync(await f.arrayBuffer(),{checkCRC32:true});await fileStorePut('__kahoot_template_v179__',f);storedFileKeys.add('__kahoot_template_v179__');state.settings.kahootTemplateNameV179=f.name;saveState();render();}
    catch(err){alert(`Kahoot-Vorlage konnte nicht gespeichert werden: ${err.message||err}`);}
  });
  document.querySelectorAll('[data-v179-kahoot]').forEach(b=>b.onclick=()=>v179OpenKahoot(b.dataset.v179Kahoot));
  document.querySelectorAll('[data-v179-prior]').forEach(e=>e.onchange=()=>{const l=lesson(kahootDraftV179.lessonId),k=v179ReviewState(l);k.selectedLessonIds=e.checked?[...new Set([...k.selectedLessonIds,e.dataset.v179Prior])]:k.selectedLessonIds.filter(id=>id!==e.dataset.v179Prior);saveState();});
  const extra=document.querySelector('#v179-extra-topics');if(extra)extra.onchange=()=>{const k=v179ReviewState(lesson(kahootDraftV179.lessonId));k.extraTopics=extra.value;saveState();};
  const count=document.querySelector('#v179-count');if(count)count.onchange=()=>{const k=v179ReviewState(lesson(kahootDraftV179.lessonId));k.questionCount=Math.max(5,Math.min(30,Number(count.value)||15));saveState();};
  document.querySelector('[data-v179-copy-prompt]')?.addEventListener('click',async e=>{
    const l=lesson(kahootDraftV179.lessonId),k=v179ReviewState(l);
    k.extraTopics=document.querySelector('#v179-extra-topics')?.value||'';k.questionCount=Math.max(5,Math.min(30,Number(document.querySelector('#v179-count')?.value)||15));saveState();
    try{const prompt=v179Prompt(l);await navigator.clipboard.writeText(prompt);e.currentTarget.textContent='Prompt kopiert ✓';}
    catch(err){if(err.message?.includes('Bitte zunächst'))return alert(err.message);downloadText('Kahoot_Prompt.txt',v179Prompt(l));}
  });
  document.querySelector('[data-v179-parse]')?.addEventListener('click',()=>{
    const l=lesson(kahootDraftV179.lessonId);kahootDraftV179.raw=document.querySelector('#v179-kahoot-answer')?.value||'';
    try{const parsed=v179ParseKahoot(kahootDraftV179.raw);kahootDraftV179.parsed=parsed;kahootDraftV179.error='';const k=v179ReviewState(l);k.questions=parsed.questions;k.title=parsed.title;k.importedAt=new Date().toISOString();saveState();render();}
    catch(err){kahootDraftV179.error=String(err.message||err);render();}
  });
  document.querySelector('#v179-kahoot-import-file')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;kahootDraftV179.raw=await f.text();try{const parsed=v179ParseKahoot(kahootDraftV179.raw),l=lesson(kahootDraftV179.lessonId),k=v179ReviewState(l);k.questions=parsed.questions;k.title=parsed.title;k.importedAt=new Date().toISOString();kahootDraftV179.error='';saveState();}catch(err){kahootDraftV179.error=String(err.message||err);}render();});
  document.querySelector('[data-v179-export-json]')?.addEventListener('click',()=>{const l=lesson(kahootDraftV179.lessonId),c=cls(l.classId);downloadText(safeName(`${l.date}_${c?.subject||''}_${c?.name||''}_Kahoot`)+'.json',JSON.stringify({schema:'schulcockpit.kahoot.v1',title:l.kahootV179.title,questions:l.kahootV179.questions},null,2),'application/json');});
  document.querySelector('[data-v179-export-xlsx]')?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;b.textContent='Excel-Vorlage wird erstellt …';try{await v179ExportKahootXlsx(lesson(kahootDraftV179.lessonId));}catch(err){alert(err.message||err);}finally{b.disabled=false;b.textContent='Kahoot als Excel-Vorlage herunterladen ↓';}});
  document.querySelector('[data-v179-clear-quiz]')?.addEventListener('click',()=>{const l=lesson(kahootDraftV179.lessonId);l.kahootV179.questions=[];saveState();render();});
};
const v179RenderBefore=render;
render=function(){v179RenderBefore();const b=document.querySelector('.brand small');if(b)b.textContent=`${state.settings.schoolYear} · V0.17.9`;};
render();
/* ===== V0.18.0 – Ausfall / Vertretung / Soll-Ist-Verschiebung =====
   Stundenplan-Slot (Datum, Block, Kurs, ID) bleibt stabil. Unterrichtsinhalt wird
   separat fortgeschrieben. Reihenplan-Daten werden nicht verändert. */
const v180FixedKeys=new Set(['id','classId','groupId','kind','date','period','slot','timetableId','source','executionV180','v180MovedFrom']);
function v180Canceled(l){return l?.executionV180?.type==='cancelled';}
function v180Payload(l){const p={};for(const [k,v] of Object.entries(l||{}))if(!v180FixedKeys.has(k))p[k]=clone(v);return p;}
function v180AssignPayload(l,p){for(const k of Object.keys(l))if(!v180FixedKeys.has(k))delete l[k];for(const [k,v] of Object.entries(p))l[k]=clone(v);}
function v180EmptyPayload(p){return !p?.planReference&&(!p?.title||p.title==='Thema noch festlegen')&&!p?.aiImportAt&&!p?.manualPlanReadyV177&&!(p?.slides?.length)&&!(p?.phasePlan?.length)&&!(p?.materials?.length)&&!(p?.printPlan?.length);}
function v180CourseSlots(source){
  const classId=source.classId,existing=(state.lessons||[]).filter(l=>l.classId===classId&&l.date>source.date).sort((a,b)=>a.date.localeCompare(b.date)||lessonSlot(a)-lessonSlot(b));
  const slots=new Map();for(const l of existing)slots.set(`${l.date}|${lessonSlot(l)}`,{date:l.date,slot:lessonSlot(l),timetableId:l.timetableId||'',lesson:l,planned:!!l.planReference});
  for(const q of classSequences(classId))for(const u of q.plan||[]){if(!u.plannedDate||u.plannedDate<=source.date)continue;const date=u.plannedDate;
    if(existing.some(l=>l.date===date&&l.planReference?.unitId===u.id))continue;
    const wd=new Date(date+'T12:00:00').getDay()||7,ts=(state.timetable||[]).filter(t=>t.classId===classId&&Number(t.weekday)===wd).sort((a,b)=>Number(a.slot)-Number(b.slot));
    if(!ts.length)continue;
    const t=ts.find(t=>!slots.has(`${date}|${Number(t.slot)}`))||ts[0],key=`${date}|${Number(t.slot)}`;
    if(!slots.has(key))slots.set(key,{date,slot:Number(t.slot),timetableId:t.id,lesson:null,planned:true});
  }
  return [...slots.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.slot-b.slot);
}
function v180NewSlotAfter(date,classId,existing){
  const tt=(state.timetable||[]).filter(t=>t.classId===classId).sort((a,b)=>Number(a.weekday)-Number(b.weekday)||Number(a.slot)-Number(b.slot));
  if(!tt.length)return null;const d=new Date(date+'T12:00:00');
  for(let n=1;n<=28;n++){d.setDate(d.getDate()+1);const dateStr=iso(d),weekday=d.getDay()||7;
    for(const t of tt.filter(t=>Number(t.weekday)===weekday)){const key=`${dateStr}|${Number(t.slot)}`;if(!existing.some(s=>`${s.date}|${s.slot}`===key))return {date:dateStr,slot:Number(t.slot),timetableId:t.id,lesson:null,planned:false,extra:true};}
  }
  return null;
}
function v180SuggestedTitle(slot){const l=slot.lesson;if(l)return l.title||l.planReference?.title||'Offene Stunde';const hit=exactPlanUnitV11(state.timetable.find(t=>t.id===slot.timetableId)?.classId,slot.date);return hit?.u?.title||'Noch kein Thema';}
function v180PlanShift(source){
  if(!source||!source.classId)return {error:'Nur Fachunterricht kann auf die nächste Fachstunde verschoben werden.'};
  if(v180Canceled(source))return {error:'Dieser Termin ist bereits als ausgefallen gekennzeichnet.'};
  if(source.status==='done')return {error:'Die Stunde ist bereits als gehalten markiert. Bitte zuerst den tatsächlichen Unterrichtsstand korrigieren.'};
  const slots=v180CourseSlots(source),moves=[],crossed=new Set(),fixedAssessments=[];let carry=v180Payload(source),previous=source;
  if(!slots.length){const extra=v180NewSlotAfter(source.date,source.classId,[]);if(extra)slots.push(extra);}
  for(let i=0;i<slots.length&&i<150;i++){
    const slot=slots[i],old=slot.lesson?v180Payload(slot.lesson):v180CreatePlanPayload(slot),title=old.title||old.planReference?.title||'Thema noch festlegen';
    const q=seq(old.sequenceId),assessment=q?.assessmentDate===slot.date||/\b(klassenarbeit|klausur|prüfung|leistungsnachweis|abschlussprüfung)\b/i.test(String(title));
    if(slot.lesson?.status==='done'||slot.lesson?.executionV180?.type==='substitute')return {error:`${fmtDate(slot.date)} ist bereits gehalten. Automatische Verschiebung würde eine gehaltene Stunde verändern. Bitte manuell klären.`};
    if(v180Canceled(slot.lesson))return {error:`${fmtDate(slot.date)} ist bereits als ausgefallen vermerkt. Bitte zuerst diese Verschiebung klären.`};
    if(assessment){fixedAssessments.push({date:slot.date,title});if(i===slots.length-1){const extra=v180NewSlotAfter(slot.date,source.classId,slots);if(extra)slots.push(extra);}continue;}
    if(old.sequenceId&&carry.sequenceId&&old.sequenceId!==carry.sequenceId)crossed.add(title);
    moves.push({slot,fromTitle:carry.title||carry.planReference?.title||'Geplante Stunde',toTitle:title,fromDate:previous.date,oldPayload:old,newPayload:carry});
    if(v180EmptyPayload(old))return {moves,extra:!!slot.extra,crossesSequences:crossed.size>0,fixedAssessments};
    carry=old;previous=slot;
    if(i===slots.length-1){const extra=v180NewSlotAfter(slot.date,source.classId,slots);if(!extra)break;slots.push(extra);}
  }
  return {error:'Für die Verschiebung ist kein freier Folgetermin innerhalb der bekannten Planung erreichbar. Bitte Terminierung manuell klären.'};
}
function v180CreatePlanPayload(slot){
  const t=state.timetable.find(t=>t.id===slot.timetableId),q=exactPlanUnitV11(t?.classId,slot.date),p={title:'Thema noch festlegen',objective:'',status:'open',plannedSteps:[],completedSteps:[],phasePlan:[],slides:[],prepTasks:[],materials:[],printPlan:[]};
  if(q){p.sequenceId=q.q.id;p.unit=q.q.title;p.title=q.u.title||p.title;p.objective=q.u.objective||'';p.planReference={plannedDate:q.u.plannedDate,title:q.u.title,content:q.u.content,objective:q.u.objective,material:q.u.material,notes:q.u.notes,unitId:q.u.id,autoMatched:true};}
  else {const active=classSequences(t?.classId).find(q=>(!q.startDate||q.startDate<=slot.date)&&(!q.endDate||q.endDate>=slot.date));if(active){p.sequenceId=active.id;p.unit=active.title;}}
  return p;
}
function v180CreateLesson(slot){const t=state.timetable.find(t=>t.id===slot.timetableId),p=v180CreatePlanPayload(slot);if(!t)throw Error('Der Stundenplan-Eintrag für den Zieltermin fehlt.');return {id:uid('lesson'),kind:'course',classId:t.classId,date:slot.date,period:t.period||periodLabelForState(state,slot.slot),slot:slot.slot,timetableId:t.id,source:'timetable',...p};}
function v180Open(l){if(!l)return;modal={type:'cancelV180',id:l.id,mode:'shift',note:''};render();}
function v180PreviewHtml(l,mode){
 if(mode!=='shift')return mode==='drop'?'<p class="v180-hint">Der Inhalt entfällt für diese Lerngruppe. Der Sollplan bleibt als historische Vorlage erhalten, es wird nichts in die Folgewoche kopiert.</p>':'<p class="v180-hint">Die Stunde hat mit Vertretung stattgefunden. Trage unten kurz ein, was tatsächlich bearbeitet wurde. Es erfolgt keine Themenverschiebung.</p>';
 const plan=v180PlanShift(l);if(plan.error)return `<div class="v180-error" role="alert">${esc(plan.error)}</div>`;
 return `<div class="v180-preview"><strong>Vorschau · ${plan.moves.length} Themenzuordnung${plan.moves.length===1?'':'en'} ändern sich</strong><p>Der ausgefallene Termin bleibt erhalten. Der Inhalt rückt auf den nächsten Fachtermin; bereits geplante Folgethemen rücken mit. Der Sollplan bleibt unverändert.</p><div class="v180-moves">${plan.moves.slice(0,8).map(m=>`<div><span>${esc(fmtDate(m.slot.date))}</span><strong>${esc(m.fromTitle)}</strong><small>${esc(m.toTitle)} wird weitergeschoben</small></div>`).join('')}${plan.moves.length>8?`<p>… und ${plan.moves.length-8} weitere Zuordnungen. Letzter Termin: ${esc(fmtDate(plan.moves.at(-1).slot.date))}.</p>`:''}</div>${plan.extra?'<p class="v180-warning">Am Ende ist ein zusätzlicher Folgetermin nötig. Bitte prüfe das Datum anhand von Ferien/Feiertagen.</p>':''}${plan.fixedAssessments?.length?`<p class="v180-warning">${plan.fixedAssessments.length} Klassenarbeits-/Prüfungstermin(e) bleiben unverändert: ${plan.fixedAssessments.map(x=>fmtDate(x.date)).join(', ')}.</p>`:''}${plan.crossesSequences?'<p class="v180-warning">Die Verschiebung reicht in eine folgende Unterrichtsreihe hinein. Bitte die Jahresplanung anschließend prüfen.</p>':''}</div>`;
}
const v180ModalBefore=modalHtml;
modalHtml=function(){if(modal?.type!=='cancelV180')return v180ModalBefore();const l=lesson(modal.id);if(!l)return '';const mode=modal.mode||'shift';const p=mode==='shift'?v180PlanShift(l):null;
 return `<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide" data-modal-stop><header class="modal-header"><div><span class="eyebrow">TATSÄCHLICHER UNTERRICHT · SOLL / IST</span><h2>${esc(whoV14(l))} · ${esc(fmtDate(l.date))}</h2></div><button class="icon-button" data-action="modal-close" aria-label="Schließen">×</button></header><div class="modal-body v180-modal"><h3>Was ist mit dieser Stunde passiert?</h3><p class="muted">Ein Ausfall ist nicht dasselbe wie eine gehaltene Vertretungsstunde. Wähle, was tatsächlich passiert ist.</p><div class="v180-options"><button class="${mode==='shift'?'selected':''}" data-v180-mode="shift"><strong>Ausgefallen → Inhalt verschieben</strong><small>Zur nächsten Fachstunde, folgende Themen bei Bedarf mitverschieben.</small></button><button class="${mode==='drop'?'selected':''}" data-v180-mode="drop"><strong>Ausgefallen → Inhalt entfällt</strong><small>Kein Nachholen; im Ist-Verlauf als ausgefallen dokumentieren.</small></button><button class="${mode==='substitute'?'selected':''}" data-v180-mode="substitute"><strong>Vertretung hat stattgefunden</strong><small>Z. B. Arbeitsblatt bearbeitet; Inhalt nicht automatisch verschieben.</small></button></div>${v180PreviewHtml(l,mode)}<label class="v180-note">${mode==='substitute'?'Was haben die Kinder tatsächlich geschafft?':'Notiz / Grund (optional)'}<textarea rows="3" id="v180-note" placeholder="${mode==='substitute'?'z. B. Interview ausgeteilt und Aufgaben 1–2 bearbeitet':'z. B. Nachmittagsunterricht krankheitsbedingt entfallen'}">${esc(modal.note||'')}</textarea></label><div class="v180-actions"><button class="secondary" data-action="modal-close">Abbrechen</button><button class="primary" data-v180-confirm ${p?.error?'disabled':''}>${mode==='shift'?'Verschiebung verbindlich übernehmen →':mode==='drop'?'Als ausgefallen festhalten':'Vertretung dokumentieren ✓'}</button></div></div></section></div>`;
};
async function v180Commit(l,mode,note){
 if(!l||v180Canceled(l))return;
 const previous=clone(l.executionV180||null),beforeStatus=l.status,now=new Date().toISOString();
 if(mode==='substitute'){l.executionV180={type:'substitute',note,recordedAt:now,previous,beforeStatus,previousReflection:clone(l.reflection||null)};l.status='done';l.reflection=l.reflection||{};if(note)l.reflection.note=[l.reflection.note,note].filter(Boolean).join('\n');saveState();return {message:'Die Vertretungsstunde ist als stattgefunden dokumentiert. Keine Verschiebung.'};}
 if(mode==='drop'){l.executionV180={type:'cancelled',mode:'drop',note,recordedAt:now,originalTitle:l.title,beforeStatus,previous};l.status='cancelled';saveState();return {message:'Der Termin bleibt als ausgefallen im Ist-Verlauf. Das Thema wird nicht automatisch nachgeholt.'};}
 const plan=v180PlanShift(l);if(plan.error)throw Error(plan.error);
 const backup={sourceId:l.id,createdIds:[],before:[{id:l.id,lesson:clone(l)}],at:now};
 for(const m of plan.moves)if(m.slot.lesson)backup.before.push({id:m.slot.lesson.id,lesson:clone(m.slot.lesson)});
 // An existing linked PPT belongs to the planned CONTENT, not to the calendar slot.
 // Preserve an IndexedDB pointer so moving it doesn't require copying large blobs.
 const keyOf=(target,payload)=>payload.presentationSourceV177==='uploaded'?(payload.presentationBlobKeyV180||`lesson-ppt-${target.id}`):'';
 let fromKey=keyOf(l,v180Payload(l));
 for(const m of plan.moves){
   const target=m.slot.lesson||v180CreateLesson(m.slot);if(!m.slot.lesson){state.lessons.push(target);backup.createdIds.push(target.id);}
   const payload=clone(m.newPayload);
   if(fromKey&&payload.presentationSourceV177==='uploaded')payload.presentationBlobKeyV180=fromKey;
   else delete payload.presentationBlobKeyV180;
   v180AssignPayload(target,payload);target.v180MovedFrom={id:l.id,date:m.fromDate,at:now};
   fromKey=keyOf(m.slot.lesson||target,m.oldPayload);
 }
 l.status='cancelled';l.executionV180={type:'cancelled',mode:'shift',note,recordedAt:now,originalTitle:l.title,beforeStatus,previous,targetId:plan.moves[0]?.slot.lesson?.id||backup.createdIds[0]||'',targetDate:plan.moves[0].slot.date,count:plan.moves.length};
 state.v180LastShift={...backup};
 try{saveState();}catch(err){for(const x of backup.before){const target=lesson(x.id);if(target)Object.assign(target,clone(x.lesson));}state.lessons=state.lessons.filter(x=>!backup.createdIds.includes(x.id));delete state.v180LastShift;throw err;}
 return {message:`Der Inhalt wurde auf ${fmtDate(plan.moves[0].slot.date)} verschoben. ${plan.moves.length} Zuordnung(en) wurden angepasst. Die ursprünglichen Soll-Daten bleiben erhalten.`};
}
function v180Undo(l){
 if(!l?.executionV180)return;
 const x=l.executionV180;if(x.mode==='shift'){
  const h=state.v180LastShift;if(h?.sourceId!==l.id)return alert('Die automatische Rücknahme der älteren Verschiebung ist nicht mehr verfügbar. Die gespeicherten Stunden bleiben erhalten.');
  if(!confirm(`Verschiebung wirklich rückgängig machen? ${h.before.length} bisherige Stunden werden auf den Stand vor der Verschiebung zurückgesetzt. Nachträgliche Änderungen an diesen Stunden gingen verloren.`))return;
  for(const b of h.before){const target=lesson(b.id);if(target){for(const k of Object.keys(target))delete target[k];Object.assign(target,clone(b.lesson));}}
  state.lessons=state.lessons.filter(x=>!h.createdIds.includes(x.id));delete state.v180LastShift;
 }else{l.status=x.beforeStatus||'open';if(x.type==='substitute'){if(x.previousReflection)l.reflection=x.previousReflection;else delete l.reflection;}if(x.previous)l.executionV180=x.previous;else delete l.executionV180;}
 saveState();render();
}
statusMeta.cancelled=['Ausgefallen','status-warning'];
const v180WeekReadyBefore=weekFullyReadyV177;
weekFullyReadyV177=function(){const m=weekCountsV177();if(m.courses.length)return v180WeekReadyBefore();return currentWeekLessons().some(v180Canceled)&&m.printDone;};
const v180CourseBefore=courseLessonsV14;
courseLessonsV14=function(){return v180CourseBefore().filter(l=>!v180Canceled(l));};
const v180PrintBefore=printItems;
printItems=function(){return v180PrintBefore().filter(i=>!v180Canceled(i.lesson));};
const v180PreviousBefore=previousLesson;
previousLesson=function(l){return state.lessons.filter(x=>x.classId===l.classId&&x.id!==l.id&&x.date<l.date&&!v180Canceled(x)).sort((a,b)=>b.date.localeCompare(a.date)||lessonSlot(b)-lessonSlot(a))[0]||null;};
const v180AttachBefore=attachExactPlanV11;
attachExactPlanV11=function(l){if(v180Canceled(l)||l?.v180MovedFrom)return l;return v180AttachBefore(l);};
const v180PrepRowBefore=coursePrepRowV14;
coursePrepRowV14=function(l){if(v180Canceled(l))return `<article class="course-prep-card-v14 v180-cancel-row"><div class="course-prep-info-v14"><span>${esc(fmtDayV14(l.date))} · ${esc(l.period||'')}</span><strong>${esc(whoV14(l))}</strong><small>${esc(l.title||'')}</small></div><span class="v180-tag">Ausgefallen</span><button class="secondary" data-v180-undo="${l.id}">Rückgängig</button></article>`;
 return v180PrepRowBefore(l).replace('</div></article>',`<button class="text-button v180-cancel-action" data-v180-open="${l.id}">Ausfall / Vertretung erfassen</button></div></article>`);
};
const v180WeekBefore=weekPrepViewV14;
weekPrepViewV14=function(){let html=v180WeekBefore();const canceled=currentWeekLessons().filter(v180Canceled);if(!canceled.length)return html;
 const block=`<section class="panel v180-history"><div class="section-head"><div><span class="eyebrow">IST-VERLAUF</span><h2>Ausgefallene Termine</h2></div><span class="status-counter">${canceled.length} dokumentiert</span></div><p class="muted">Diese Termine zählen nicht als gehaltene oder noch vorzubereitende Stunden. Material und die ursprüngliche Planung bleiben erhalten.</p>${canceled.map(l=>`<article class="v180-history-row"><div><strong>${esc(fmtDate(l.date))} · ${esc(whoV14(l))}</strong><small>${esc(l.title||'')} · ${l.executionV180.mode==='shift'?`Inhalt → ${esc(fmtDate(l.executionV180.targetDate))}`:'Inhalt entfällt'}${l.executionV180.note?' · '+esc(l.executionV180.note):''}</small></div><button class="secondary" data-v180-undo="${l.id}">Rückgängig</button><button class="text-button" data-lesson="${l.id}">Details</button></article>`).join('')}</section>`;
 return html.replace('<section class="panel next-week-v177">',block+'<section class="panel next-week-v177">');
};
weekPrepViewV08=weekPrepViewV14;weekPrepViewV12=weekPrepViewV14;
const v180LessonPanelBefore=lessonPanel;
lessonPanel=function(l){let html=v180LessonPanelBefore(l);const canceled=v180Canceled(l),note=l.executionV180?.note||'',markup=`<section class="detail-section v180-lesson-status"><span class="eyebrow">TATSÄCHLICHER STUNDENVERLAUF</span><h3>${canceled?'Ausgefallen':'Durchführung dokumentieren'}</h3>${canceled?`<p>${esc(l.executionV180.mode==='shift'?`Inhalt auf ${fmtDate(l.executionV180.targetDate)} verschoben.`:'Inhalt entfällt ohne Verschiebung.')}${note?' · '+esc(note):''}</p><button class="secondary" data-v180-undo="${l.id}">Ausfall rückgängig machen</button>`:l.executionV180?.type==='substitute'?`<p>Vertretung durchgeführt${note?' · '+esc(note):''}.</p><button class="secondary" data-v180-open="${l.id}">Status korrigieren</button>`:`<p class="muted">Bei Krankheit: ausgefallen und verschieben, ausgefallen und entfallen oder tatsächlich durch Vertretung durchgeführt.</p><button class="secondary" data-v180-open="${l.id}">Ausfall / Vertretung eintragen →</button>`}</section>`;
 return '<div class="detail-stack"'.test(html)?html.replace('<div class="detail-stack">','<div class="detail-stack">'+markup):markup+html;
};
const v180LessonCardBefore=lessonCardV11;
lessonCardV11=function(l){let html=v180LessonCardBefore(l);if(v180Canceled(l))html=html.replace('lesson-card"','lesson-card v180-cancel-card"').replace('class="status status-warning"','class="status status-warning"');return html;};
const v180PromptBefore=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){let p=v180PromptBefore(l);const canceled=(state.lessons||[]).filter(x=>x.classId===l.classId&&x.date<l.date&&v180Canceled(x)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,2);if(canceled.length)p+=`\n## Tatsächliche Terminausfälle – verbindlicher Ist-Stand\n${canceled.map(x=>`- ${x.date}: ${x.title||''} fiel aus. ${x.executionV180.mode==='shift'?`Inhalt wurde auf ${x.executionV180.targetDate} verschoben.`:'Inhalt entfällt.'} ${x.executionV180.note||''}`).join('\n')}\nDiese Termine nicht als gehalten oder erarbeitet darstellen. Nutze die aktuelle verschobene PlanReference der Zielstunde, nicht das ursprüngliche Datum.\n`;
 return p;
};makeBrief=concretePlanningPromptV12;
const v180CandidatesBefore=v179Candidates;
v179Candidates=function(l){return v180CandidatesBefore(l).filter(x=>!v180Canceled(x));};
const v180WireBefore=wire;
wire=function(){v180WireBefore();
 document.querySelectorAll('[data-v180-open]').forEach(b=>b.onclick=e=>{e.stopPropagation();v180Open(lesson(b.dataset.v180Open));});
 document.querySelectorAll('[data-v180-undo]').forEach(b=>b.onclick=e=>{e.stopPropagation();v180Undo(lesson(b.dataset.v180Undo));});
 document.querySelectorAll('[data-v180-mode]').forEach(b=>b.onclick=()=>{modal.note=document.querySelector('#v180-note')?.value||'';modal.mode=b.dataset.v180Mode;render();});
 document.querySelector('[data-v180-confirm]')?.addEventListener('click',async e=>{const l=lesson(modal?.id),mode=modal?.mode||'shift',note=document.querySelector('#v180-note')?.value?.trim()||'';if(!l)return;e.currentTarget.disabled=true;try{const r=await v180Commit(l,mode,note);modal=null;saveState();render();alert(r.message);}catch(err){e.currentTarget.disabled=false;alert(`Konnte den Stundenstand nicht ändern: ${err.message||err}`);}});
 // Attached presentation is a content asset: after moving lessons retain its original blob key.
 document.querySelectorAll('[data-v177-ppt-download]').forEach(b=>b.onclick=async()=>{const l=lesson(b.dataset.v177PptDownload),rec=await fileStoreGet(l?.presentationBlobKeyV180||`lesson-ppt-${l?.id}`);if(!rec?.blob)return alert('Die Präsentation ist lokal nicht verfügbar. Bitte erneut hinterlegen.');downloadBlob(rec.name||l.presentationFileName||'Präsentation.pptx',rec.blob);});
 document.querySelectorAll('[data-v177-ppt-upload]').forEach(el=>el.onchange=async()=>{const l=lesson(el.dataset.v177PptUpload),f=el.files?.[0];if(!l||!f)return;const key=`lesson-ppt-${l.id}`;try{await fileStorePut(key,f);storedFileKeys.add(key);l.presentationBlobKeyV180=key;l.presentationReady=true;l.presentationNotRequiredV177=false;l.presentationSourceV177='uploaded';l.presentationFileName=f.name;saveState();render();}catch(err){alert(`PowerPoint konnte nicht lokal gespeichert werden: ${err.message||err}`);}});
};
const v180RenderBefore=render;
render=function(){v180RenderBefore();const b=document.querySelector('.brand small');if(b)b.textContent=`${state.settings.schoolYear} · V0.18.0`;};
render();
/* ===== V0.18.1 – vollständige Soll-/Ist-Verschiebung und sichere Altfall-Reparatur =====
   Stammdatum/Stundenplan-Slot bleiben beim Termin; vollständige Unterrichtsinhalte
   (Reihenbezug, Materialpakete, Print-Plan, Phasen, Folien, PPT-Zeiger) wandern mit.
   Repariert V0.18.0-Zielstunden ausschließlich aus der eindeutig bezeichneten
   ausgefallenen Quelle. Fremde/neue Inhalte werden niemals still überschrieben. */
function v181MeaningfulTitle(s){
  const t=String(s||'').trim();return !!t&&!/^(thema noch festlegen|noch kein thema|offene stunde|geplante stunde)$/i.test(t);
}
function v181ReferenceFromUnit(hit){
  const {u}=hit;return {plannedDate:u.plannedDate,title:u.title,content:u.content||'',objective:u.objective||'',material:u.material||'',notes:u.notes||'',unitId:u.id,autoMatched:true};
}
function v181SourcePayload(raw){
  const p=v180PayloadOriginalV181(raw);
  if(!raw?.classId)return p;
  // Plan dates and identifiers are copied from the actual OLD slot, not looked up at the destination.
  if(!p.planReference){
    let hit=exactPlanUnitV11(raw.classId,raw.date);
    if(!hit&&v181MeaningfulTitle(p.title)){
      const candidates=classSequences(raw.classId).flatMap(q=>(q.plan||[]).filter(u=>
        normalizeHintV12(u.title)===normalizeHintV12(p.title)).map(u=>({q,u})));
      if(candidates.length===1)hit=candidates[0];
    }
    if(hit){p.planReference=v181ReferenceFromUnit(hit);if(!v181MeaningfulTitle(p.title))p.title=hit.u.title;if(!p.objective)p.objective=hit.u.objective||'';p.sequenceId=hit.q.id;p.unit=hit.q.title;}
  }
  if(!v181MeaningfulTitle(p.title)&&v181MeaningfulTitle(p.planReference?.title))p.title=p.planReference.title;
  if(!p.sequenceId&&p.planReference?.unitId){const q=classSequences(raw.classId).find(x=>(x.plan||[]).some(u=>u.id===p.planReference.unitId));if(q){p.sequenceId=q.id;p.unit=p.unit||q.title;}}
  return p;
}
const v180PayloadOriginalV181=v180Payload;
v180Payload=function(raw){
  const p=v180PayloadOriginalV181(raw);
  // A previously moved lesson already owns a different date than its source plan. Never
  // attach the planned unit for its destination date merely because a reference is missing.
  if(!raw||raw.v180MovedFrom||v180Canceled(raw))return p;
  return v181SourcePayload(raw);
};
function v181HasTopic(p){return v181MeaningfulTitle(p?.title)||v181MeaningfulTitle(p?.planReference?.title);}
function v181HasPrintContent(p){
  return !!(p?.printPlan?.length||p?.materials?.length||p?.customResourceHintsV176?.length||
    (p?.resourceBundlesV176&&Object.keys(p.resourceBundlesV176).length)||p?.planReference?.material?.trim());
}
// A readiness flag without content must NOT make an empty timetable slot a lesson.
v180EmptyPayload=function(p){return !v181HasTopic(p)&&!v181HasPrintContent(p)&&
  !p?.aiImportAt&&!(p?.slides?.length)&&!(p?.phasePlan?.length)&&!(p?.prepTasks?.length)&&!p?.objective?.trim();};
const v180PlanShiftBeforeV181=v180PlanShift;
v180PlanShift=function(source){
  if(source&&!v181HasTopic(v180Payload(source))){return {error:'Für diesen Termin ist kein verlässliches Unterrichtsthema gespeichert. Bitte die Stunde bzw. den passenden Reihenplan-Eintrag zuerst festlegen. Ein bloßes „Schon geplant“-Häkchen reicht zum Verschieben nicht aus.'};}
  return v180PlanShiftBeforeV181(source);
};
// A moved lesson without teaching content cannot count as finished even if it inherited flags.
const v181PlanReadyBefore=concretePlanReadyV12;
concretePlanReadyV12=function(l){return l?.v180MovedFrom&&!v181HasTopic(l)?false:v181PlanReadyBefore(l);};
const v181PlanLabelBefore=planLabelV177;
planLabelV177=function(l){return l?.v180MovedFrom&&!v181HasTopic(l)?'Inhalt prüfen':v181PlanLabelBefore(l);};
function v181SourceFor(target,source){
  // An explicit teacher correction has precedence over a historical backup snapshot.
  if(source.executionV180?.originalContentV181)return {...source,...source.executionV180.originalContentV181};
  const h=state.v180LastShift;
  if(h?.sourceId===source.id){const snap=(h.before||[]).find(x=>x.id===source.id)?.lesson;if(snap)return snap;}
  // V0.18.0 never deleted the original lesson content; the canceled entry is a fallback.
  return source;
}
function v181FindShiftTarget(source){
  const x=source?.executionV180;if(x?.mode!=='shift')return null;
  const byId=lesson(x.targetId);
  if(byId?.classId===source.classId && byId?.v180MovedFrom?.id===source.id)return byId;
  return (state.lessons||[]).find(l=>l.classId===source.classId&&l.v180MovedFrom?.id===source.id&&l.date===x.targetDate)||null;
}
function v181RecoverSource(source){return v181SourcePayload(v181SourceFor(null,source));}
function v181MergeMissing(target,origin){
  if(!v181HasTopic(origin))return {changed:false,reason:'Quellthema fehlt'};
  let changed=false;
  const set=(key,value,when)=>{if(value!==undefined&&value!==null&&when&&!(typeof value==='string'&&!value.trim())){target[key]=clone(value);changed=true;}};
  const emptyText=x=>!x||!String(x).trim();
  const emptyArray=x=>!Array.isArray(x)||!x.length;
  const emptyObj=x=>!x||typeof x!=='object'||!Object.keys(x).length;
  const wasBlank=!v181HasTopic(target);
  // The originally planned topic and its real planned date belong together.
  set('title',origin.title||origin.planReference?.title,!v181MeaningfulTitle(target.title));
  set('planReference',origin.planReference,!target.planReference||(wasBlank&&!!origin.planReference&&(target.planReference.unitId!==origin.planReference.unitId||target.planReference.plannedDate!==origin.planReference.plannedDate||(!target.planReference.material&&!!origin.planReference.material))));
  for(const key of ['sequenceId','unit','objective','footerTopic','aiImportAt','aiImportSource','manualPlanReadyV177','manualPlanAtV177','presentationReady','presentationNotRequiredV177','presentationSourceV177','presentationFileName','presentationBlobKeyV180']){
    const value=origin[key];if(value===undefined)continue;
    const empty=typeof value==='boolean'?target[key]===undefined:(wasBlank&&['sequenceId','unit','objective','footerTopic'].includes(key))||emptyText(target[key]);
    set(key,value,empty);
  }
  for(const key of ['phasePlan','slides','plannedSteps','completedSteps','prepTasks','materials','printPlan','customResourceHintsV176','coarseMaterialHints']){
    set(key,origin[key],Array.isArray(origin[key])&&origin[key].length&&emptyArray(target[key]));
  }
  for(const key of ['resourceOverrides','resourceBundlesV176','materialDecisionsV14','kahootV179']){
    if(emptyObj(origin[key]))continue;
    if(emptyObj(target[key]))set(key,origin[key],true);
    else if(key==='resourceOverrides'||key==='resourceBundlesV176'){
      for(const [k,v] of Object.entries(origin[key]))if(target[key][k]===undefined){target[key][k]=clone(v);changed=true;}
    }
  }
  // V0.18.0 stored uploaded PowerPoints under the OLD lesson id. Preserve that
  // IndexedDB key rather than treating the new timetable id as the physical file key.
  if(origin.presentationSourceV177==='uploaded'&&target.presentationSourceV177==='uploaded'&&!target.presentationBlobKeyV180){
    target.presentationBlobKeyV180=origin.presentationBlobKeyV180||`lesson-ppt-${target.v180MovedFrom?.id||''}`;
    changed=true;
  }
  // A render of an empty week might have already added generic print jobs. Restore any
  // missing original material jobs without wiping a user's later copy status.
  if(origin.printPlan?.length){target.printPlan=target.printPlan||[];for(const p of origin.printPlan){
    const current=target.printPlan.find(x=>x.materialId===p.materialId&&x.variantId===p.variantId);
    if(!current){target.printPlan.push(clone(p));changed=true;}
  }}
  if(origin.materials?.length){target.materials=target.materials||[];for(const id of origin.materials)if(!target.materials.includes(id)){target.materials.push(id);changed=true;}}
  if(origin.customResourceHintsV176?.length){target.customResourceHintsV176=target.customResourceHintsV176||[];for(const h of origin.customResourceHintsV176)if(!target.customResourceHintsV176.includes(h)){target.customResourceHintsV176.push(h);changed=true;}}
  if(changed){target.v181RestoredFrom={id:target.v180MovedFrom?.id||'',date:target.v180MovedFrom?.date||'',at:new Date().toISOString()};}
  return {changed,reason:changed?'Inhalte ergänzt':'Bereits vollständig'};
}
function v181RepairOne(source){
  if(!v180Canceled(source)||source.executionV180?.mode!=='shift')return {changed:false,reason:'Kein verschobener Ausfall'};
  const target=v181FindShiftTarget(source);if(!target)return {changed:false,reason:'Zieltermin nicht eindeutig vorhanden'};
  if(target.v180MovedFrom?.id!==source.id)return {changed:false,reason:'Ziel wurde inzwischen weiter verschoben'};
  const original=v181RecoverSource(source);
  if(v181MeaningfulTitle(target.title)&&v181HasTopic(original)&&normalizeHintV12(target.title)!==normalizeHintV12(original.title||original.planReference?.title))
    return {changed:false,reason:'Die Zielstunde hat inzwischen ein anderes Thema. Keine automatische Überschreibung.',source,target,original};
  const result=v181MergeMissing(target,original);
  if(result.changed){source.executionV180.v181Recovered=true;source.executionV180.v181RecoveredAt=new Date().toISOString();
    // A destination week previously marked printed cannot silently stay complete when
    // newly recovered print jobs have appeared. Do not reset any per-file printed flags.
    const start=iso(mondayOf(new Date(target.date+'T12:00:00'))),flow=state.weekWorkflowV177?.[start];
    if(flow&&target.printPlan?.some(p=>p.needed&&!p.alreadyPrinted&&Number(p.count)>0)){flow.printClosed=false;flow.printPanelOpen=!flow.planningOnly;}
  }
  return {...result,source,target,original};
}
function v181RepairExistingShifts(){let repaired=0;for(const l of state.lessons||[]){
  if(l?.executionV180?.mode!=='shift')continue;
  const result=v181RepairOne(l);if(result.changed)repaired++;
}if(repaired)try{saveState();}catch(err){console.error('Verschiebungs-Reparatur konnte nicht gespeichert werden',err);}
return repaired;}
const v181CommitBefore=v180Commit;
v180Commit=async function(l,mode,note){
  const source=mode==='shift'?v181SourcePayload(l):null;
  const result=await v181CommitBefore(l,mode,note);
  if(mode==='shift'&&l.executionV180){
    l.executionV180.originalContentV181=clone(source);
    const target=v181FindShiftTarget(l);
    if(target){const r=v181MergeMissing(target,source);if(r.changed)l.executionV180.v181Recovered=true;
      const week=iso(mondayOf(new Date(target.date+'T12:00:00'))),flow=state.weekWorkflowV177?.[week];
      if(flow&&target.printPlan?.some(p=>p.needed&&!p.alreadyPrinted&&Number(p.count)>0)){flow.printClosed=false;flow.printPanelOpen=!flow.planningOnly;}
    }
    saveState();
  }
  return result;
};
// Render the original topic/date even when the active target has been moved; never present
// a placeholder as if it were a completed lesson.
const v181CourseRowBefore=coursePrepRowV14;
coursePrepRowV14=function(l){let html=v181CourseRowBefore(l);
  if(!l?.v180MovedFrom)return html;
  const bad=!v181HasTopic(l),src=lesson(l.v180MovedFrom.id);
  const strip=`<p class="v181-origin ${bad?'v181-broken':''}">${bad?'⚠ Verschobener Inhalt fehlt':'↪ Verschoben von '+esc(fmtDate(l.v180MovedFrom.date))}${src?' · '+esc(src.title||''):''}</p>`;
  html=html.replace('</small></div><div class="course-prep-status-v14">',`</small>${strip}</div><div class="course-prep-status-v14">`);
  if(bad&&src)html=html.replace('</div></article>',`<button class="secondary" data-v181-repair="${src.id}">Originalinhalt wiederherstellen</button></div></article>`);
  return html;
};
const v181LessonPanelBefore=lessonPanel;
lessonPanel=function(l){let html=v181LessonPanelBefore(l);if(!l?.v180MovedFrom)return html;
  const original=lesson(l.v180MovedFrom.id),warn=!v181HasTopic(l);
  const detail=`<section class="detail-section v181-context"><span class="eyebrow">VERSCHOBENER UNTERRICHT · SOLL / IST</span><h3>${warn?'⚠ Ursprüngliches Thema fehlt':'Übernommen aus '+esc(fmtDate(l.v180MovedFrom.date))}</h3><p>${esc(l.title||l.planReference?.title||'Thema noch festlegen')}. Die Materialien, Druckpositionen und Planung gehören zu diesem Inhalt und nicht zum ursprünglichen Wochentermin.</p>${warn&&original?`<button class="secondary" data-v181-repair="${original.id}">Originalinhalt wiederherstellen →</button>`:''}</section>`;
  return html.includes('<div class="detail-stack">')?html.replace('<div class="detail-stack">','<div class="detail-stack">'+detail):detail+html;
};
const v181WeekBefore=weekPrepViewV14;
weekPrepViewV14=function(){let html=v181WeekBefore();const broken=(state.lessons||[]).filter(l=>l.v180MovedFrom&&!v181HasTopic(l));
  if(!broken.length)return html;
  const note=`<section class="panel v181-repair-panel"><div class="section-head"><div><span class="eyebrow">VERSCHIEBUNG PRÜFEN</span><h2>${broken.length} verschobene Stunde${broken.length===1?'':'n'} mit unvollständigem Inhalt</h2></div></div><p>Ein Status-Häkchen allein bedeutet nicht, dass das Thema übertragen wurde. Der Originaltermin bleibt erhalten. Wähle gegebenenfalls den passenden Eintrag aus deiner Reihenplanung.</p>${broken.map(l=>{const s=lesson(l.v180MovedFrom.id);return `<div class="v181-repair-row"><span>${esc(fmtDate(l.date))} · ${esc(whoV14(l))}</span><button class="secondary" data-v181-repair="${s?.id||''}" ${s?'':'disabled'}>Inhalt wiederherstellen</button></div>`;}).join('')}</section>`;
  return html.replace('<section class="panel next-week-v177">',note+'<section class="panel next-week-v177">');
};
weekPrepViewV08=weekPrepViewV14;weekPrepViewV12=weekPrepViewV14;
function v181PlanChoices(source){
  const d=Date.parse(source.date+'T12:00:00');
  return classSequences(source.classId).flatMap(q=>(q.plan||[]).filter(u=>u.plannedDate&&Math.abs(Date.parse(u.plannedDate+'T12:00:00')-d)<=21*86400000)
    .map(u=>({q,u,distance:Math.abs(Date.parse(u.plannedDate+'T12:00:00')-d)})))
    .sort((a,b)=>a.distance-b.distance).slice(0,10);
}
function v181RecoveryModal(source){const target=v181FindShiftTarget(source),orig=v181RecoverSource(source),choices=v181PlanChoices(source);
  return `<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide" data-modal-stop><header class="modal-header"><div><span class="eyebrow">STUNDENVERSCHIEBUNG REPARIEREN</span><h2>${esc(whoV14(source))} · ${esc(fmtDate(source.date))} → ${esc(target?fmtDate(target.date):'Ziel fehlt')}</h2></div><button class="icon-button" data-action="modal-close" aria-label="Schließen">×</button></header><div class="modal-body v181-repair-modal"><p>Die ursprüngliche Stunde wird nicht gelöscht. Bereits nachträglich bearbeitete Angaben im Ziel bleiben erhalten; nur fehlende Inhalte werden ergänzt.</p><div class="v181-compare"><div><strong>Originalinhalt</strong><p>${esc(orig.title||orig.planReference?.title||'Nicht im alten Datensatz vorhanden')}</p><small>${esc(orig.planReference?.material||'Kein Materialhinweis in der alten Stunde')}</small></div><div><strong>Aktueller Zieltermin</strong><p>${esc(target?.title||'Nicht vorhanden')}</p><small>${esc(target?.planReference?.material||'Kein Materialhinweis')}</small></div></div>${v181HasTopic(orig)&&target?`<button class="primary" data-v181-restore="${source.id}">Fehlende Originalangaben übernehmen →</button>`:''}${!v181HasTopic(orig)?`<h3>Der alte Datensatz enthält selbst kein Thema</h3><p>Wähle hier bewusst den ursprünglich vorgesehenen Reihenplan-Eintrag. Es wird nichts anhand des Folgetermins geraten.</p><div class="v181-options">${choices.map(x=>`<button class="secondary" data-v181-pick="${source.id}|${x.q.id}|${x.u.id}"><strong>${esc(fmtDate(x.u.plannedDate))} · ${esc(x.u.title)}</strong><small>${esc(x.q.title)} · ${esc((x.u.material||'').slice(0,160))}</small></button>`).join('')||'<p>Für diesen Kurs sind keine nahen Reihenplan-Einträge vorhanden. Bitte die ausgefallene Stunde zuerst im Verlauf inhaltlich ergänzen.</p>'}</div>`:''}<button class="text-button" data-action="modal-close">Schließen</button></div></section></div>`;
}
const v181ModalBefore=modalHtml;
modalHtml=function(){if(modal?.type==='repairV181'){const s=lesson(modal.id);return s?v181RecoveryModal(s):'';}return v181ModalBefore();};
const v181WireBefore=wire;
wire=function(){v181WireBefore();
  document.querySelectorAll('[data-v181-repair]').forEach(b=>b.onclick=()=>{if(!lesson(b.dataset.v181Repair))return;modal={type:'repairV181',id:b.dataset.v181Repair};render();});
  document.querySelectorAll('[data-v181-restore]').forEach(b=>b.onclick=()=>{const s=lesson(b.dataset.v181Restore);const result=v181RepairOne(s);if(result.changed){saveState();modal=null;render();alert('Der fehlende Originalinhalt wurde übertragen. Bitte Thema, Materialpakete und noch offene Druckpositionen kurz prüfen.');}else alert(result.reason||'Es wurde nichts verändert.');});
  document.querySelectorAll('[data-v181-pick]').forEach(b=>b.onclick=()=>{const [sid,qid,uid]=b.dataset.v181Pick.split('|'),s=lesson(sid),q=seq(qid),u=q?.plan?.find(x=>x.id===uid);if(!s||!u)return;
    if(!confirm(`Soll „${u.title}“ als ursprünglich vorgesehene Stunde vom ${fmtDate(s.date)} verwendet werden?`))return;
    const reference=v181ReferenceFromUnit({q,u});s.planReference=clone(reference);s.sequenceId=q.id;s.unit=q.title;if(!v181MeaningfulTitle(s.title))s.title=u.title;
    if(!s.objective)s.objective=u.objective||'';
    // Older backup may have a placeholder. Retain the user's explicit correction for later repair.
    s.executionV180.originalContentV181=v180PayloadOriginalV181(s);
    const result=v181RepairOne(s);saveState();modal=null;render();alert(result.changed?'Reihenplan-Inhalt auf den Zieltermin übernommen. Bitte die Druckpositionen prüfen.':'Reihenplan-Inhalt hinterlegt. Prüfe den Zieltermin.');
  });
};
// Deterministic, non-destructive migration for previous V0.18.0 moves.
try{v181RepairExistingShifts();}catch(err){console.error('Reparaturprüfung',err);}
const v181RenderBefore=render;
render=function(){v181RenderBefore();const el=document.querySelector('.brand small');if(el)el.textContent=`${state.settings.schoolYear} · V0.18.1`;};
render();

/* ===== V0.18.2 – Wochenalltag, echte Reflexion, gezielter Reihenimport ===== */
const V182_FLAGS={
  lesson:[['too_dense','Zu viel Inhalt'],['not_enough','Zu wenig Inhalt'],['flow','Ablauf unklar'],['motivation','Motivation fehlte'],['play','Spielerischer gestalten'],['hands_on','Handlungsorientierter arbeiten'],['discussion','Gespräch/Sicherung verbessern'],['differentiation','Mehr Differenzierung']],
  ppt:[['error','Inhaltlicher Fehler'],['typo','Schreibfehler'],['layout','Layout/Lesbarkeit'],['too_much','Zu viel Text'],['task','Arbeitsauftrag unklar'],['image','Passendes Bild fehlt'],['flow','Folienfolge passt nicht']],
  material:[['error','Fehler im Material'],['hard','Zu schwer'],['easy','Zu leicht'],['support','Leichtere/Förder-Version fehlt'],['challenge','Forder-Version fehlt'],['daz','Sprachhilfe/DaZ fehlt'],['space','Mehr Schreibplatz'],['structure','Unübersichtlich'],['task','Aufgabe unklar'],['boring','Nicht motivierend'],['quantity','Mehr Aufgaben nötig'],['solution','Lösung ergänzen']]
};
const V182_OVERALL=[['great','Sehr gut'],['fine','Gut'],['mixed','Teils/teils'],['revise','Überarbeiten']];
const V182_TIMING=[['fit','Hat gepasst'],['tight','Etwas knapp'],['unfinished','Nicht fertig'],['leftover','Zeit übrig']];
const V182_LEARNING=[['achieved','Ziel erreicht'],['partly','Teilweise erreicht'],['repeat','Wiederholung nötig'],['easy','Zu leicht']];
let v182LessonId='',v182BacklogFilter='open',v182PlanPackage=null;
function v182IsCanceled(l){return !!l?.executionV180?.type&&l.executionV180.type==='cancelled';}
function v182IsSub(l){return l?.executionV180?.type==='substitute';}
function v182IsHeld(l){return !!l&&(l.status==='done'||v182IsSub(l))&&!v182IsCanceled(l);}
function v182StateLabel(l){if(v182IsCanceled(l))return 'Ausgefallen';if(v182IsHeld(l))return l.reflectionV182?.completedAt?'Gehalten · reflektiert':'Gehalten · Reflexion offen';if(concretePlanReadyV12(l)&&l.presentationReady)return 'Bereit';if(concretePlanReadyV12(l))return 'Geplant · PPT offen';return 'Planung offen';}
function v182GetReflection(l){if(!l.reflectionV182)l.reflectionV182={overall:'',timing:'',learning:'',lessonFlags:[],pptFlags:[],materialIssues:{},note:'',completedAt:''};const r=l.reflectionV182;r.lessonFlags=Array.isArray(r.lessonFlags)?r.lessonFlags:[];r.pptFlags=Array.isArray(r.pptFlags)?r.pptFlags:[];r.materialIssues=r.materialIssues&&typeof r.materialIssues==='object'?r.materialIssues:{};return r;}
function v182RelevantMaterials(l){const ids=new Set([...(l.materials||[]),...(l.printPlan||[]).map(p=>p.materialId)]);(state.materials||[]).forEach(m=>{if((m.assignments||[]).some(a=>a.classId===l.classId&&(a.unitId&&a.unitId===l.planReference?.unitId)))ids.add(m.id);});
  const list=[...ids].map(id=>mat(id)).filter(Boolean).map(m=>({id:m.id,title:m.title,variants:m.variants||[],material:m}));
  for(const e of state.materialCatalog||[]){if(!['direct_lesson','lesson_variant','lesson_support'].includes(e.scope)||e.scope==='exclude'||e.disposition==='excluded')continue;const a=catalogAssignmentV17(e);if(!a.classId||a.classId!==l.classId||!a.unitId||a.unitId!==l.planReference?.unitId)continue;if(list.some(x=>x.material?.catalogId===e.catalogId))continue;list.push({id:'catalog:'+e.catalogId,title:e.fileName,variants:[],catalog:e});}
  for(const hint of rawResourceLinesV14(l)){const type=resourceTypeV14(l,hint);if(['activity','ignore'].includes(type))continue;if(!list.some(x=>normalizeHintV12(x.title)===normalizeHintV12(hint)))list.push({id:'hint:'+encodeURIComponent(hint),title:hint,variants:[],hint});}
  return list;
}
function v182FileButton(m){let v=(m.variants||[]).find(v=>hasStoredFile(v))||null;
  if(v)return `<button class="secondary" data-v182-material-file="${esc(m.id)}|${esc(v.id)}">Datei öffnen ↗</button>`;
  if(m.catalog&&catalogAvailableV17(m.catalog))return `<button class="secondary" data-v182-catalog="${esc(m.catalog.catalogId)}">Archivdatei öffnen ↗</button>`;
  if(m.material?.catalogId){const e=catalogEntryV17(m.material.catalogId);if(e&&catalogAvailableV17(e))return `<button class="secondary" data-v182-catalog="${esc(e.catalogId)}">Archivdatei öffnen ↗</button>`;}
  return '<small class="v182-file-missing">Datei hier nicht lokal verfügbar</small>';
}
async function v182OpenMaterial(m){let f=null;if(m.catalog)f=await catalogEntryFileV17(m.catalog);else{const v=(m.variants||[]).find(v=>hasStoredFile(v));if(v){const rec=await fileStoreGet(v.fileKey);if(rec?.blob)f=new File([rec.blob],rec.name||v.fileName||m.title,{type:rec.type||rec.blob.type||''});}if(!f&&m.material?.catalogId){const e=catalogEntryV17(m.material.catalogId);if(e)f=await catalogEntryFileV17(e);}}
  if(!f)return alert('Die Datei ist lokal noch nicht verfügbar. Bitte das zugehörige Archiv erneut verbinden oder die Datei hinterlegen.');
  if(/\.(pdf|png|jpe?g|webp|txt)$/i.test(f.name)){const u=URL.createObjectURL(f);window.open(u,'_blank');setTimeout(()=>URL.revokeObjectURL(u),60000);}else downloadBlob(f.name,f);
}
function v182MarkHeld(l){if(!l||v182IsCanceled(l))return;if(!v182IsHeld(l)){l.status='done';l.heldAtV182=new Date().toISOString();}v182GetReflection(l);v182LessonId=l.id;view='lessonDayV182';saveState();render();}
function v182Toggle(arr,value){const i=arr.indexOf(value);if(i>=0)arr.splice(i,1);else arr.push(value);}
function v182Labels(kind,flags){return (flags||[]).map(id=>V182_FLAGS[kind]?.find(f=>f[0]===id)?.[1]||id);}
function v182BacklogId(l,kind,target=''){return `v182-${l.id}-${kind}-${target}`;}
function v182CommitBacklog(l){const r=v182GetReflection(l),wanted=[];
  const add=(kind,mid,flags)=>{if(!flags?.length)return;const mm=v182RelevantMaterials(l).find(x=>x.id===mid);const sourceTitle=mm?.title||mat(mid)?.title||(String(mid).startsWith('hint:')?decodeURIComponent(String(mid).slice(5)):'Material');const title=kind==='ppt'?'PowerPoint überarbeiten':kind==='lesson'?'Stundenablauf überarbeiten':`Material überarbeiten: ${sourceTitle}`;
    const labels=v182Labels(kind==='material'?'material':kind,flags);
    wanted.push({id:v182BacklogId(l,kind,mid),type:'reflectionV182',kind,lessonId:l.id,materialId:kind==='material'&&!String(mid).startsWith('catalog:')?mid:'',catalogId:String(mid).startsWith('catalog:')?String(mid).slice(8):'',title,detail:labels.join(' · '),flags:[...flags],materialTitle:sourceTitle,note:r.note||'',effort:kind==='material'?'60':'30',done:false,sourceDate:l.date,classId:l.classId,sequenceId:l.sequenceId||'',updatedAt:new Date().toISOString()});};
  add('lesson','',r.lessonFlags);add('ppt','',r.pptFlags);Object.entries(r.materialIssues).forEach(([id,flags])=>add('material',id,flags));
  const existing=new Map((state.backlog||[]).filter(b=>b.type==='reflectionV182'&&b.lessonId===l.id).map(b=>[b.id,b]));
  state.backlog=state.backlog.filter(b=>b.type!=='reflectionV182'||b.lessonId!==l.id);
  for(const b of wanted){const old=existing.get(b.id);if(old&&JSON.stringify(old.flags)===JSON.stringify(b.flags)&&old.note===b.note)b.done=old.done;state.backlog.push(b);}
  const old=l.reflection||{};l.reflection={...old,mood:r.overall||old.mood,timing:r.timing||old.timing,learning:r.learning||old.learning,note:r.note||old.note};
  r.completedAt=new Date().toISOString();saveState();
}
function v182Choices(l,key,items){const r=v182GetReflection(l);return `<div class="v182-answer"><strong>${key==='overall'?'Wie lief die Stunde?':key==='timing'?'Zeitplanung':'Lernstand'}</strong><div class="v182-chip-row">${items.map(([val,text])=>`<button class="v182-chip ${r[key]===val?'active':''}" data-v182-single="${l.id}|${key}|${val}">${text}</button>`).join('')}</div></div>`;}
function v182FlagGroup(l,kind,target,head){const r=v182GetReflection(l),flags=kind==='lesson'?r.lessonFlags:kind==='ppt'?r.pptFlags:r.materialIssues[target]||[];
  return `<div class="v182-flag-group"><strong>${esc(head)}</strong><div class="v182-chip-row">${V182_FLAGS[kind].map(([key,label])=>`<button class="v182-chip ${flags.includes(key)?'active':''}" data-v182-flag="${l.id}|${kind}|${encodeURIComponent(target)}|${key}">${esc(label)}</button>`).join('')}</div></div>`;
}
function v182ReflectionHtml(l){const r=v182GetReflection(l),materials=v182RelevantMaterials(l);
  return `<section class="v182-reflection" id="reflection-v182"><div class="section-head"><div><span class="eyebrow">NACH DEM UNTERRICHT</span><h2>Kurze Reflexion – Klicks reichen</h2></div>${r.completedAt?'<span class="safe-chip">Bereits festgehalten ✓</span>':''}</div><p class="muted">Nur ankreuzen, was zutrifft. Die Überarbeitungswünsche landen automatisch unter „Verbessern“. Nichts muss sofort erledigt werden.</p>
  ${v182Choices(l,'overall',V182_OVERALL)}${v182Choices(l,'timing',V182_TIMING)}${v182Choices(l,'learning',V182_LEARNING)}
  ${r.overall&&r.overall!=='great'||r.timing==='unfinished'||r.learning==='repeat'?v182FlagGroup(l,'lesson','','Was würde ich an dieser Stunde ändern?'):''}
  <details class="v182-disclosure" ${r.pptFlags.length?'open':''}><summary>PowerPoint beurteilen ${r.pptFlags.length?'· '+r.pptFlags.length+' Hinweise':''}</summary>${v182FlagGroup(l,'ppt','','Welche PPT-Probleme gab es?')}</details>
  <details class="v182-disclosure" ${Object.values(r.materialIssues).some(x=>x.length)?'open':''}><summary>Materialien beurteilen ${Object.values(r.materialIssues).reduce((n,x)=>n+x.length,0)?'· Hinweise markiert':''}</summary>${materials.map(m=>`<div class="v182-material-review">${v182FlagGroup(l,'material',m.id,m.title)}${v182FileButton(m)}</div>`).join('')||'<p class="muted">Für diese Stunde sind keine konkreten Materialdateien verknüpft. Hinterlege sie bei der Stundenplanung oder im Material-Hub.</p>'}</details>
  <label class="v182-note-label">Optional: genaue Fehlerstelle oder Merkhilfe<textarea id="v182-reflection-note" rows="3" placeholder="z. B. AB S. 2, Aufgabe 3 hat einen Fehler …">${esc(r.note||'')}</textarea></label>
  <div class="v182-actions"><button class="primary" data-v182-save-reflection="${l.id}">Reflexion abschließen ✓</button><button class="secondary" data-v182-no-change="${l.id}">Alles okay · ohne Überarbeitungsbedarf</button></div></section>`;
}
function v182PptAction(l){if(!l.presentationReady)return '<small class="muted">Noch keine PowerPoint hinterlegt.</small>';
  if(l.presentationNotRequiredV177)return '<small class="muted">Für diese Stunde ist keine PowerPoint nötig.</small>';
  const key=l.presentationBlobKeyV180||`lesson-ppt-${l.id}`;
  if(storedFileKeys.has(key))return `<button class="secondary" data-v182-ppt="${l.id}">PowerPoint öffnen ↗</button>`;
  return `<button class="secondary" data-v182-regenerate="${l.id}">PowerPoint erneut erzeugen ↗</button><small class="muted">Die erzeugte Präsentation wurde früher nur heruntergeladen und ist noch nicht im lokalen Cockpit gespeichert.</small><label class="upload-button small-upload">Vorhandene PPT hinterlegen<input type="file" accept=".pptx,.ppt" data-v177-ppt-upload="${l.id}" hidden></label>`;
}
function v182LessonDayHtml(l){if(!l)return '<p>Stunde nicht gefunden.</p>';const c=cls(l.classId),materials=v182RelevantMaterials(l),q=seq(l.sequenceId),cancel=v182IsCanceled(l),held=v182IsHeld(l);
  return `<div class="content-grid v182-day-page"><section class="v182-day-top"><button class="text-button" data-view="week">← Meine Woche</button><span class="v182-day-badge">${esc(v182StateLabel(l))}</span><h2>${esc(whoV14(l))} · ${esc(fmtDayV14(l.date))}</h2><h3>${esc(l.title||l.planReference?.title||'Thema noch festlegen')}</h3><p>${esc(q?.title||l.unit||'Keine Reihe verknüpft')}</p>${l.v180MovedFrom?`<small>Verschoben vom ${esc(fmtDate(l.v180MovedFrom.date))}</small>`:''}</section>
  <div class="v182-day-columns"><section class="panel"><div class="section-head"><h2>Unterricht auf einen Blick</h2><button class="secondary" data-v182-wizard="${l.id}">Planung ansehen / ändern ↗</button></div>${l.objective?`<p><strong>Ziel:</strong> ${esc(l.objective)}</p>`:''}<div class="v182-mini-phases">${(l.phasePlan||[]).map(p=>`<div><span>${esc(String(p.minutes||''))} Min.</span><strong>${esc(p.title||p.phase||'Phase')}</strong><small>${esc(p.details||'')}</small></div>`).join('')||'<p class="muted">Noch kein konkreter Stundenverlauf eingetragen. Der grobe Reihenplan bleibt separat erhalten.</p>'}</div>${l.planReference?.material?`<p class="v182-plan-hint"><strong>Material aus dem Sollplan:</strong> ${esc(l.planReference.material)}</p>`:''}</section>
  <section class="panel"><h2>Für diese Stunde griffbereit</h2><div class="v182-file-row"><strong>Präsentation</strong>${v182PptAction(l)}</div><div class="v182-material-list">${materials.map(m=>`<div class="v182-file-row"><strong>${esc(m.title)}</strong>${v182FileButton(m)}</div>`).join('')||'<p class="muted">Keine konkrete Materialdatei verknüpft. Materialhinweise findest du im Sollplan und kannst Dateien über den Montagsmodus hinzufügen.</p>'}</div><button class="secondary" data-v182-prep="${l.id}">Material/Druckauftrag prüfen ↗</button></section></div>
  <section class="panel v182-end-panel"><div><span class="eyebrow">IST-STAND</span><h2>${cancel?'Dieser Unterrichtstermin ist ausgefallen.':held?'Stunde gehalten':'Wie ist die Stunde tatsächlich gelaufen?'}</h2><p>${cancel?'Der Ausfall ist dokumentiert und zählt nicht als durchgeführte Stunde.':held?'Du kannst die Reflexion jetzt ergänzen oder später noch ändern.':'Bei Vertretung wird „stattgefunden“ separat erfasst. Bei regulärem Unterricht öffnet „Gehalten“ die kurze Reflexion.'}</p></div><div class="v182-actions">${!cancel&&!held?`<button class="primary" data-v182-held="${l.id}">✓ Unterricht gehalten → Reflexion</button>`:''}${!cancel?`<button class="secondary" data-v182-execution="${l.id}">Ausfall / Vertretung erfassen</button>${held?`<button class="text-button" data-v182-unhold="${l.id}">Markierung „gehalten“ korrigieren</button>`:''}`:''}</div></section>
  ${held?v182ReflectionHtml(l):''}</div>`;
}
function v182WeekCard(l){const group=l.kind==='group'||!!l.groupId,c=cls(l.classId),name=group?`GA ${grp(l.groupId)?.name||''}`:whoV14(l),label=group?'Klassenzeit':v182StateLabel(l),held=v182IsHeld(l),cancel=v182IsCanceled(l),prep=concretePlanReadyV12(l);
  return `<article class="v182-week-card ${cancel?'is-canceled':''} ${held?'is-held':''}" style="--accent:${esc(c?.color||'#816784')}"><div class="v182-week-meta"><span>${esc(l.period||'')}</span><span class="v182-mini-status">${esc(label)}</span></div><strong>${esc(name)}</strong><p>${esc(l.title||l.planReference?.title||'Thema noch festlegen')}</p><small>${esc(seq(l.sequenceId)?.title||l.unit||'')}</small><div class="v182-card-actions"><button class="secondary" ${group?`data-lesson="${l.id}"`:`data-v182-open="${l.id}"`}>Stunde öffnen ↗</button>${!group&&!cancel&&!held?`<button class="primary" data-v182-held="${l.id}">Gehalten ✓</button>`:''}${held?`<button class="text-button" data-v182-open="${l.id}">${l.reflectionV182?.completedAt?'Reflexion ändern':'Reflexion →'}</button>`:''}</div>${!group&&!cancel&&!held?`<small class="v182-lesson-state">${prep?'Planung vorhanden':'Planung noch offen'} · ${l.presentationReady?'PPT-Status geklärt':'PPT offen'}</small>`:''}</article>`;
}
weekView=function(){const ls=currentWeekLessons(),days=[1,2,3,4,5].map(day=>({day,date:activeWeekDate(day),items:ls.filter(l=>l.date===activeWeekDate(day))})),n=ls.filter(l=>v182IsHeld(l)&&!(l.kind==='group'||l.groupId)).length,ready=ls.filter(l=>concretePlanReadyV12(l)&&l.presentationReady&&!v182IsCanceled(l)).length,refOpen=ls.filter(l=>!(l.kind==='group'||l.groupId)&&v182IsHeld(l)&&!l.reflectionV182?.completedAt).length;
  return `<div class="content-grid v182-week"><section class="v182-week-hero"><div><span class="eyebrow">DEIN UNTERRICHT · KW ${activeWeekNumber()}</span><h2>Meine Woche</h2><p>Die Wochenvorbereitung ist fürs Planen und Kopieren da. Hier findest du im Unterricht die Stunde, PPT und Materialien und hältst hinterher kurz fest, wie es lief.</p></div><div class="v182-week-toolbar"><button class="secondary" data-view="prep">Zur Wochenvorbereitung ↗</button><button class="secondary" data-v177-plan-next>Folgewoche planen →</button></div></section><section class="v182-week-stats"><div><strong>${ls.length}</strong><small>Termine</small></div><div><strong>${ready}</strong><small>Vorbereitet</small></div><div><strong>${n}</strong><small>Gehalten</small></div><div><strong>${refOpen}</strong><small>Reflexion offen</small></div></section><section class="v182-week-grid">${days.map(({day,date,items})=>`<div class="v182-week-day"><header><span>${dayNames[day]}</span><strong>${esc(fmtDayV14(date))}</strong></header>${items.map(v182WeekCard).join('')||'<p class="v182-empty-day">Keine Fachstunde</p>'}</div>`).join('')}</section></div>`;
};
function v182BacklogCard(b){const l=lesson(b.lessonId),m=mat(b.materialId),c=cls(l?.classId||b.classId),when=l?.date||b.sourceDate||'',prefix=c?`${c.subject} ${c.name}`:'Material';return `<article class="v182-backlog-card ${b.done?'done':''}"><div class="v182-backlog-info"><small>${esc(prefix)}${when?' · '+esc(fmtDate(when)):''} · ${esc(b.kind==='ppt'?'PowerPoint':b.kind==='material'?'Material':'Unterricht')}</small><h3>${esc(b.title||'Überarbeitung')}</h3><p>${esc(b.detail||'')}${b.note?' · '+esc(b.note):''}</p></div><div class="v182-backlog-actions"><button class="secondary" data-v182-backlog-toggle="${b.id}">${b.done?'Wieder öffnen':'Erledigt ✓'}</button>${l?`<button class="text-button" data-v182-open="${l.id}">Stunde ↗</button><button class="text-button" data-v182-backlog-prompt="${b.id}">ChatGPT-Prompt kopieren</button>`:''}${m&&m.variants?.some(v=>hasStoredFile(v))?`<button class="text-button" data-v182-material-file="${m.id}|${m.variants.find(v=>hasStoredFile(v)).id}">Datei ↗</button>`:b.catalogId&&catalogEntryV17(b.catalogId)&&catalogAvailableV17(catalogEntryV17(b.catalogId))?`<button class="text-button" data-v182-catalog="${b.catalogId}">Datei ↗</button>`:''}</div></article>`;}
improveView=function(){const all=state.backlog||[],shown=all.filter(b=>v182BacklogFilter==='all'||(v182BacklogFilter==='done'?b.done:!b.done)),open=all.filter(b=>!b.done);return `<div class="content-grid v182-improve"><section class="v182-week-hero"><div><span class="eyebrow">SPÄTER IST AUCH GUT</span><h2>Unterricht verbessern</h2><p>Hier erscheinen Überarbeitungsaufgaben aus deinen Stundenreflexionen automatisch. Du musst sie nicht in derselben Woche erledigen. Für die Ferien kannst du sie gezielt wieder aufrufen.</p></div><span class="v182-backlog-count">${open.length} offen</span></section><section class="panel"><div class="v182-filters"><button class="${v182BacklogFilter==='open'?'active':''}" data-v182-backlog-filter="open">Offen (${open.length})</button><button class="${v182BacklogFilter==='all'?'active':''}" data-v182-backlog-filter="all">Alle (${all.length})</button><button class="${v182BacklogFilter==='done'?'active':''}" data-v182-backlog-filter="done">Erledigt (${all.length-open.length})</button></div><div class="v182-backlog-list">${shown.sort((a,b)=>(a.done===b.done?0:a.done?1:-1)||(b.sourceDate||'').localeCompare(a.sourceDate||'')).map(v182BacklogCard).join('')||'<p class="v182-empty-backlog">Noch keine Einträge. Nach einer gehaltenen Stunde einfach die Reflexion öffnen und Verbesserungsvorschläge anklicken – der Rest geschieht automatisch.</p>'}</div></section></div>`;};
function v182BacklogPrompt(b){const l=lesson(b.lessonId),m=mat(b.materialId),c=cls(l?.classId||b.classId),e=b.catalogId?catalogEntryV17(b.catalogId):null;return `# Unterrichtsmaterial später verbessern\n\nKlasse: ${c?.subject||''} ${c?.name||''}\nStunde: ${l?.title||''} (${l?.date||b.sourceDate||''})\nReihe: ${seq(l?.sequenceId)?.title||l?.unit||''}\nBereich: ${b.kind==='ppt'?'PowerPoint':b.kind==='material'?'Unterrichtsmaterial':'Stundenablauf'}\nMaterialdatei: ${m?.title||e?.fileName||b.materialTitle||'kein bestimmtes Material'}\nBeobachtete Probleme: ${b.detail||''}\nZusätzliche Notiz: ${b.note||'keine'}\n\nBitte überarbeite den Bereich gezielt. Frage mich nach der Originaldatei, falls du sie zur Bearbeitung benötigst. Behalte bewährte Inhalte und den tatsächlichen Lernstand bei. Erstelle kein neues Material auf Grundlage nur des Dateinamens. Gib mir, soweit möglich, eine direkt verwendbare überarbeitete Datei.\n`;}
// Selective, non-destructive Mein-Schulplan import: NEVER replace timetable/actual lessons.
function v182NormalizePlanImport(raw){const x=typeof raw==='string'?JSON.parse(raw):raw;if(!x||!Array.isArray(x.classes)||!Array.isArray(x.sequences))throw Error('Diese Datei enthält keinen Schulcockpit-Reihenimport mit classes und sequences.');
  const classes=x.classes.map(c=>({key:c.key,subject:String(c.subject||''),name:String(c.name||'')})).filter(c=>c.key&&c.subject&&c.name),keys=new Set(classes.map(c=>c.key));
  const sequences=x.sequences.filter(q=>keys.has(q.classKey)&&q.title).map(q=>({...q,units:(q.units||q.plan||[]).map(cleanPlanUnitV10).filter(u=>u.title)}));
  if(!sequences.length)throw Error('Keine Reihen in dieser Datei gefunden.');return {classes,sequences,schoolYear:x.schoolYear||''};
}
async function v182MergePlan(pkg,keys){const selected=new Set(keys);let created=0,updated=0,addedUnits=0,attached=0,linked=0,activated=0;const courseMap=new Map();
  for(const c of pkg.classes.filter(c=>selected.has(c.key))){let target=state.classes.find(x=>catalogNormV17(x.subject)===catalogNormV17(c.subject)&&catalogNormV17(x.name)===catalogNormV17(c.name));if(!target){target={id:uid('class'),subject:c.subject,name:c.name,students:0,color:'#806688'};state.classes.push(target);}courseMap.set(c.key,target.id);}
  for(const incoming of pkg.sequences.filter(q=>selected.has(q.classKey))){const cid=courseMap.get(incoming.classKey);if(!cid)continue;let q=state.sequences.find(x=>x.classId===cid&&catalogNormV17(x.title)===catalogNormV17(incoming.title));if(!q){q={id:uid('seq'),classId:cid,title:incoming.title,startDate:incoming.startDate||'',endDate:incoming.endDate||'',goal:incoming.goal||'',assessmentDate:incoming.assessmentDate||'',notes:incoming.notes||'',hours:incoming.hours||'',plan:[]};state.sequences.push(q);created++;}else{q.plan=q.plan||[];for(const k of ['startDate','endDate','goal','assessmentDate','notes','hours'])if(!q[k]&&incoming[k])q[k]=incoming[k];updated++;}
    for(const u of incoming.units){const n=catalogNormV17(u.title),existing=q.plan.find(v=>v.plannedDate===u.plannedDate&&catalogNormV17(v.title)===n);if(!existing){q.plan.push(u);addedUnits++;}else{for(const k of ['content','competencies','objective','material','homework','notes','hours'])if(!existing[k]&&u[k])existing[k]=u[k];}}
    q.plan.sort((a,b)=>(a.plannedDate||'9999').localeCompare(b.plannedDate||'9999'));}
  for(const l of state.lessons){if(![...courseMap.values()].includes(l.classId)||v182IsCanceled(l)||l.v180MovedFrom||l.planReference?.unitId)continue;const old=l.planReference?.title||l.title||'';if(old&&old!=='Thema noch festlegen')continue;const hit=exactPlanUnitV11(l.classId,l.date);if(hit){attachExactPlanV11(l);attached++;}}
  // Direct lesson matches from the already connected archives can be activated after the
  // missing plan has been imported. ZIP contents are not copied to GitHub or guessed.
  const chosenIds=new Set(courseMap.values()),zipCache=new Map();
  for(const e of state.materialCatalog||[]){
    if(!['direct_lesson','lesson_variant','lesson_support'].includes(e.scope)||e.disposition==='excluded'||e.preferredForActivation===false)continue;
    const a=catalogAssignmentV17(e);if(!a.classId||!chosenIds.has(a.classId)||!a.unitId)continue;
    let m=state.materials.find(m=>m.catalogId===e.catalogId);
    if(!m&&catalogAvailableV17(e)){
      try{
        let zip=null;const ar=catalogArchiveRecordV17(e.sourceArchive);
        if(ar?.fileKey){const key=catalogNormV17(e.sourceArchive);if(!zipCache.has(key)){const rec=await fileStoreGet(ar.fileKey);zipCache.set(key,rec?.blob?await JSZip.loadAsync(rec.blob):null);}zip=zipCache.get(key);}
        if(await activateCatalogEntryV17(e,zip,null)){activated++;m=state.materials.find(m=>m.catalogId===e.catalogId);const v=m?.variants?.find(v=>v.fileKey);if(v)storedFileKeys.add(v.fileKey);}
      }catch(err){console.warn('Katalogdatei nicht automatisch aktivierbar',e.fileName,err);}
    }
    if(m){m.assignments=m.assignments||[];if(!m.assignments.some(x=>x.classId===a.classId&&x.unitId===a.unitId)){m.assignments.push({classId:a.classId,sequenceId:a.sequenceId,unitId:a.unitId});linked++;}
      for(const l of state.lessons.filter(l=>l.classId===a.classId&&l.planReference?.unitId===a.unitId)){l.materials=l.materials||[];if(!l.materials.includes(m.id))l.materials.push(m.id);}
    }
  }
  // Existing content and copy flags remain untouched; only missing print positions are added.
  for(const l of state.lessons.filter(l=>chosenIds.has(l.classId)&&!v182IsCanceled(l)&&!l.v180MovedFrom&&l.planReference))ensureCoarsePrintPlansV14(l);
  saveState();return {created,updated,addedUnits,attached,linked,activated};
}
function v182ImportModal(){const pkg=v182PlanPackage;return `<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide" data-modal-stop><header class="modal-header"><h2>Reihenplanung gezielt importieren</h2><button class="icon-button" data-action="modal-close" aria-label="Schließen">×</button></header><div class="modal-body"><p>Importiert ausschließlich ausgewählte Unterrichtsreihen. Stundenplan, gehaltene Stunden, Verschiebungen, importierte Folien und Kopierstatus bleiben unverändert. Bestehende Planangaben werden nur ergänzt, nicht überschrieben.</p><label class="upload-button">Mein-Schulplan-/Schulcockpit-JSON auswählen<input id="v182-plan-file" type="file" accept=".json,application/json" hidden></label>${pkg?`<div class="v182-import-choices"><h3>Welche Fachkurse sollen ergänzt werden?</h3>${pkg.classes.filter(c=>pkg.sequences.some(q=>q.classKey===c.key)).map(c=>`<label><input type="checkbox" data-v182-import-class="${esc(c.key)}" checked><span><strong>${esc(c.subject)} ${esc(c.name)}</strong><small>${pkg.sequences.filter(q=>q.classKey===c.key).length} Reihen · ${pkg.sequences.filter(q=>q.classKey===c.key).reduce((s,q)=>s+q.units.length,0)} Stunden im Sollplan</small></span></label>`).join('')}<button class="primary" data-v182-plan-apply>Nur ausgewählte Reihen ergänzen →</button></div>`:'<p class="muted">Die bereits vorhandene Gesamtdatei kannst du hier wieder verwenden und nur Klasse 5f auswählen. Andere Fachkurse bleiben unberührt.</p>'}</div></section></div>`;}
const v182OldModal=modalHtml;modalHtml=function(){if(modal?.type==='planV182')return v182ImportModal();if(modal?.type==='unitV182'){const q=seq(modal.qid),u=q?.plan?.find(x=>x.id===modal.uid),item=u||{plannedDate:'',title:'',objective:'',content:'',material:'',notes:''};return `<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide" data-modal-stop><header class="modal-header"><h2>${u?'Geplante Stunde bearbeiten':'Geplante Stunde ergänzen'}</h2><button class="icon-button" data-action="modal-close" aria-label="Schließen">×</button></header><div class="modal-body v182-unit-editor"><p>Änderungen am Sollplan überschreiben keine bereits gehaltene oder verschobene Stunde.</p><label>Datum<input id="v182-unit-date" type="date" value="${esc(item.plannedDate||'')}"></label><label>Thema<input id="v182-unit-title" value="${esc(item.title||'')}"></label><label>Ziel<textarea id="v182-unit-objective">${esc(item.objective||'')}</textarea></label><label>Inhalt / grobe Idee<textarea id="v182-unit-content">${esc(item.content||'')}</textarea></label><label>Materialhinweise – jede Datei/Referenz in eine neue Zeile<textarea id="v182-unit-material">${esc(item.material||'')}</textarea></label><label>Notizen<textarea id="v182-unit-notes">${esc(item.notes||'')}</textarea></label><button class="primary" data-v182-unit-save="${q?.id||''}|${u?.id||''}">Sollplan speichern ✓</button></div></section></div>`;}return v182OldModal();};
const v182OldSequence=sequencePanel;sequencePanel=function(q){let html=v182OldSequence(q);if(!q)return html;const htmlExtra=`<section class="detail-section v182-plan-edit"><div class="section-head"><h3>Einzelstunden im Sollplan bearbeiten</h3><button class="primary" data-v182-unit-new="${q.id}">+ Stunde ergänzen</button></div><div class="v182-plan-edit-list">${(q.plan||[]).map(u=>`<div><span>${esc(u.plannedDate?fmtDate(u.plannedDate):'Datum offen')}</span><strong>${esc(u.title)}</strong><button class="secondary" data-v182-unit-edit="${q.id}|${u.id}">Bearbeiten</button></div>`).join('')||'<p class="muted">Noch keine datierten Stunden eingetragen.</p>'}</div></section>`;const i=html.lastIndexOf('</div>');return i>=0?html.slice(0,i)+htmlExtra+html.slice(i):html+htmlExtra;};
const v182OldSequences=sequencesView;sequencesView=function(){let html=v182OldSequences();const lead=`<section class="panel v182-plan-help"><div><span class="eyebrow">REIHENPLANUNG: ZWEI WEGE</span><h2>Bestehende Reihe importieren oder im Cockpit bearbeiten</h2><p>Eine größere Reihenplanung erstellen wir hier mit ChatGPT und importieren nur den ausgewählten Fachkurs. Die Einträge kannst du danach einzeln bearbeiten. Bekannte Materialien aus deinem Archiv werden über Klasse, Reihe und ursprünglichen Stundenbezug wiedererkannt.</p></div><button class="primary" data-v182-plan-import>Reihenplanung importieren ↗</button></section>`;return html.replace('<div class="content-grid">','<div class="content-grid">'+lead);};
const v182OldView=viewHtml;viewHtml=function(){if(view==='lessonDayV182')return v182LessonDayHtml(lesson(v182LessonId));return v182OldView();};
const v182OldPageTitle=pageTitle;pageTitle=function(){if(view==='lessonDayV182')return 'Deine Unterrichtsstunde';return v182OldPageTitle();};
const v182OldWire=wire;wire=function(){v182OldWire();
  document.querySelectorAll('[data-v182-open]').forEach(b=>b.onclick=()=>{v182LessonId=b.dataset.v182Open;view='lessonDayV182';render();});
  document.querySelectorAll('[data-v182-held]').forEach(b=>b.onclick=()=>v182MarkHeld(lesson(b.dataset.v182Held)));
  document.querySelectorAll('[data-v182-unhold]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.v182Unhold);if(!l||!confirm('Markierung „gehalten“ zurücknehmen? Die aus dieser Reflexion erzeugten automatischen Verbesserungsaufgaben werden dabei ebenfalls zurückgenommen.'))return;l.status=concretePlanReadyV12(l)&&l.presentationReady?'ready':'open';l.heldAtV182='';if(l.reflectionV182)l.reflectionV182.completedAt='';state.backlog=state.backlog.filter(x=>!(x.type==='reflectionV182'&&x.lessonId===l.id));saveState();render();});
  document.querySelector('#v182-reflection-note')?.addEventListener('input',e=>{const l=lesson(v182LessonId);if(l)v182GetReflection(l).note=e.currentTarget.value;});
  document.querySelectorAll('[data-v182-single]').forEach(b=>b.onclick=()=>{const [id,key,val]=b.dataset.v182Single.split('|'),l=lesson(id);if(!l)return;const r=v182GetReflection(l);r[key]=r[key]===val?'':val;r.completedAt='';saveState();render();});
  document.querySelectorAll('[data-v182-flag]').forEach(b=>b.onclick=()=>{const [id,kind,enc,val]=b.dataset.v182Flag.split('|'),l=lesson(id);if(!l)return;const r=v182GetReflection(l),target=decodeURIComponent(enc),arr=kind==='lesson'?r.lessonFlags:kind==='ppt'?r.pptFlags:(r.materialIssues[target]=r.materialIssues[target]||[]);v182Toggle(arr,val);r.completedAt='';saveState();render();});
  document.querySelectorAll('[data-v182-save-reflection]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.v182SaveReflection);if(!l)return;v182GetReflection(l).note=document.getElementById('v182-reflection-note')?.value?.trim()||'';v182CommitBacklog(l);render();});
  document.querySelectorAll('[data-v182-no-change]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.v182NoChange);if(!l)return;const r=v182GetReflection(l);r.overall='fine';r.timing=r.timing||'fit';r.learning=r.learning||'achieved';r.lessonFlags=[];r.pptFlags=[];r.materialIssues={};r.note='';v182CommitBacklog(l);render();});
  document.querySelectorAll('[data-v182-material-file]').forEach(b=>b.onclick=async()=>{const [mid]=b.dataset.v182MaterialFile.split('|');const m=mat(mid);if(m)try{await v182OpenMaterial({id:m.id,title:m.title,variants:m.variants,material:m});}catch(e){alert(e.message||e);}});
  document.querySelectorAll('[data-v182-catalog]').forEach(b=>b.onclick=async()=>{const e=catalogEntryV17(b.dataset.v182Catalog);if(e)try{await v182OpenMaterial({id:'catalog:'+e.catalogId,title:e.fileName,catalog:e});}catch(err){alert(err.message||err);}});
  document.querySelectorAll('[data-v182-ppt]').forEach(b=>b.onclick=async()=>{const l=lesson(b.dataset.v182Ppt),rec=await fileStoreGet(l?.presentationBlobKeyV180||`lesson-ppt-${l?.id}`);if(rec?.blob)downloadBlob(rec.name||l.presentationFileName||'Unterricht.pptx',rec.blob);else alert('Die Präsentation ist hier nicht gespeichert. Du kannst sie erneut erzeugen oder nachträglich hinterlegen.');});
  document.querySelectorAll('[data-v182-regenerate]').forEach(b=>b.onclick=async()=>{const l=lesson(b.dataset.v182Regenerate);if(!l)return;try{await generateMomijiPptV13(l);}catch(err){alert('Erneutes Erzeugen nicht möglich: '+(err.message||err));}});
  document.querySelectorAll('[data-v182-wizard]').forEach(b=>b.onclick=()=>openWizardV14(b.dataset.v182Wizard,1));
  document.querySelectorAll('[data-v182-prep]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.v182Prep),w=iso(mondayOf(new Date(l.date+'T12:00:00')));state.settings.activeWeekStart=w;weekWorkflowV177(w).printPanelOpen=true;expandedLessonV176.add(l.id);saveState();view='prep';render();});
  document.querySelectorAll('[data-v182-execution]').forEach(b=>b.onclick=()=>v180Open(lesson(b.dataset.v182Execution)));
  document.querySelectorAll('[data-v182-backlog-filter]').forEach(b=>b.onclick=()=>{v182BacklogFilter=b.dataset.v182BacklogFilter;render();});
  document.querySelectorAll('[data-v182-backlog-toggle]').forEach(b=>b.onclick=()=>{const x=state.backlog.find(x=>x.id===b.dataset.v182BacklogToggle);if(!x)return;x.done=!x.done;x.doneAt=x.done?new Date().toISOString():'';saveState();render();});
  document.querySelectorAll('[data-v182-backlog-prompt]').forEach(b=>b.onclick=async()=>{const x=state.backlog.find(x=>x.id===b.dataset.v182BacklogPrompt);if(!x)return;const txt=v182BacklogPrompt(x);try{await navigator.clipboard.writeText(txt);alert('Prompt kopiert. Bitte Originalmaterial hier im Chat zusätzlich hochladen.');}catch{downloadText('Unterricht_ueberarbeiten.md',txt);}});
  document.querySelector('[data-v182-plan-import]')?.addEventListener('click',()=>{v182PlanPackage=null;modal={type:'planV182'};render();});
  document.querySelector('#v182-plan-file')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{v182PlanPackage=v182NormalizePlanImport(await f.text());render();}catch(err){alert(err.message||err);}});
  document.querySelector('[data-v182-plan-apply]')?.addEventListener('click',async event=>{if(!v182PlanPackage)return;const keys=[...document.querySelectorAll('[data-v182-import-class]:checked')].map(x=>x.dataset.v182ImportClass);if(!keys.length)return alert('Bitte mindestens einen Fachkurs auswählen.');const count=v182PlanPackage.sequences.filter(q=>keys.includes(q.classKey)).length;if(!confirm(`${count} Reihen in ausgewählten Fachkursen ergänzen? Der Stundenplan und vorhandene Unterrichtsplanungen bleiben unverändert.`))return;const button=event.currentTarget;button.disabled=true;button.textContent='Reihen und vorhandene Materialarchive verknüpfen …';try{const r=await v182MergePlan(v182PlanPackage,keys);v182PlanPackage=null;modal=null;view='sequences';render();alert(`${r.created} neue Reihen, ${r.updated} bestehende Reihen ergänzt, ${r.addedUnits} neue Soll-Stunden. ${r.attached} bisher leere Wochenstunden mit dem Sollplan verbunden. ${r.activated} lokale Katalogdateien aktiviert, ${r.linked} Materialverknüpfungen ergänzt. Unklare Dateien bleiben im Reihenpool.`);}catch(err){console.error(err);button.disabled=false;button.textContent='Nur ausgewählte Reihen ergänzen →';alert('Import nicht vollständig: '+(err.message||err));}});
  document.querySelectorAll('[data-v182-unit-new]').forEach(b=>b.onclick=()=>{modal={type:'unitV182',qid:b.dataset.v182UnitNew,uid:''};render();});
  document.querySelectorAll('[data-v182-unit-edit]').forEach(b=>b.onclick=()=>{const [qid,uidx]=b.dataset.v182UnitEdit.split('|');modal={type:'unitV182',qid,uid:uidx};render();});
  document.querySelector('[data-v182-unit-save]')?.addEventListener('click',e=>{const [qid,uidx]=e.currentTarget.dataset.v182UnitSave.split('|'),q=seq(qid);if(!q)return;const title=document.getElementById('v182-unit-title')?.value.trim(),date=document.getElementById('v182-unit-date')?.value||'';if(!title)return alert('Bitte ein Thema eintragen.');let u=q.plan.find(x=>x.id===uidx);if(!u){u=cleanPlanUnitV10({title,plannedDate:date});q.plan.push(u);}for(const [field,id] of [['title','title'],['plannedDate','date'],['objective','objective'],['content','content'],['material','material'],['notes','notes']])u[field]=document.getElementById('v182-unit-'+id)?.value?.trim()||'';q.plan.sort((a,b)=>(a.plannedDate||'9999').localeCompare(b.plannedDate||'9999'));saveState();modal={type:'sequence',id:qid};render();});
};
// Preserve freshly generated PPTX in IndexedDB so the classroom view can retrieve it later.
const v182OldGeneratePpt=generateMomijiPptV13;
const v182OldRender=render;render=function(){v182OldRender();const ver=document.querySelector('.brand small');if(ver)ver.textContent=`${state.settings.schoolYear} · V0.18.2`;};
render();
/* ===== V0.18.3 – Material decisions, versions, and clean weekly print list =====
   The lesson owns an explicit use of a resource. A plan hint is NOT a print job.
   Soft-hiding never deletes local bytes or mutates the source sequence plan. */
const V183_VERSION='V0.18.3';
const v183IsHeld=v182IsHeld;
let v183ShowArchived=new Set();
function v183Hidden(l){return l.hiddenResourceKeysV183||(l.hiddenResourceKeysV183=[]);}
function v183HiddenHint(l,h){return v183Hidden(l).includes(resourceKeyV14(h));}
function v183IsActive(l,h){return !v183HiddenHint(l,h)&&resourceTypeV14(l,h)!=='ignore';}
function v183LivePlan(l,p){return !!(p?.needed&&!p._v183removed&&!p._v183obsolete);}
function v183DisablePlan(p,why='removed'){p.needed=false;p._v183removed=true;p._v183Reason=why;}
function v183DeleteFromLesson(l,h,{custom=false}={}){
  const oldR=lessonResourcesV14(l).find(r=>resourceKeyV14(r.hint)===resourceKeyV14(h));
  const key=resourceKeyV14(h),b=resourceBundleV176(l,h);
  if(!v183Hidden(l).includes(key))v183Hidden(l).push(key);
  setResourceTypeV14(l,h,'ignore');
  const ids=new Set([...(b?.items||[]).map(x=>x.materialId),...(oldR?.material?[oldR.material.id]:[])]);
  (l.printPlan||[]).forEach(p=>{
    const m=mat(p.materialId);
    if(ids.has(p.materialId)||m&&normalizeHintV12(m.title)===normalizeHintV12(h)||v183LikelyWrongAuto(h,p))v183DisablePlan(p,'resource-hidden');
  });
  if(custom){l.customResourceHintsV176=(l.customResourceHintsV176||[]).filter(x=>resourceKeyV14(x)!==key);}
  l.resourceManualV183=l.resourceManualV183||{};
  l.resourceManualV183[key]={cleared:true};
  if(b){b.deferred=false;b.complete=true;b.archivedV183=true;}
}
function v183RestoreToLesson(l,h){
  l.hiddenResourceKeysV183=v183Hidden(l).filter(k=>k!==resourceKeyV14(h));
  setResourceTypeV14(l,h,'print');
  const b=resourceBundleV176(l,h);if(b)b.archivedV183=false;
  if(l.resourceManualV183)delete l.resourceManualV183[resourceKeyV14(h)];
  if(b?.items?.length){for(const x of b.items){const m=mat(x.materialId),v=variant(x.materialId,x.variantId);if(!m||!v||v._v183obsolete)continue;
    const p=ensurePlan(l,x.materialId,x.variantId);p._v183removed=false;p._v183obsolete=false;p.needed=!b.reusedV183&&isPrintVariantV176(v,m);if(b.reusedV183){p.needed=true;p.alreadyPrinted=true;}
  }}
}
function v183PlanBelongs(l,p,h){const b=resourceBundleV176(l,h),m=mat(p.materialId);return !!(b?.items||[]).some(x=>x.materialId===p.materialId&&x.variantId===p.variantId)||!!(m&&normalizeHintV12(m.title)===normalizeHintV12(h));}
function v183LikelyWrongAuto(h,p){if(!(p._v14init||p._coarseInitialized))return false;const a=v183NumericPrefix(h),m=mat(p.materialId),b=v183NumericPrefix(m?.title);if(a===null||b===null||a===b)return false;const words=x=>new Set(normalizeHintV12(x).split(/\s+/).filter(t=>t.length>=4));const wa=words(h),wb=words(m?.title||'');return [...wa].some(w=>wb.has(w));}
function v183Neutralize(l,h){for(const p of (l.printPlan||[]))if(v183PlanBelongs(l,p,h)||v183LikelyWrongAuto(h,p))v183DisablePlan(p,'hint-disconnected');}
function v183DisconnectHint(l,h){const oldR=lessonResourcesV14(l).find(r=>resourceKeyV14(r.hint)===resourceKeyV14(h));if(oldR?.material){for(const p of l.printPlan||[])if(p.materialId===oldR.material.id)v183DisablePlan(p,'wrong-auto-match');}const b=resourceBundleV176(l,h,true);for(const x of b.items||[]){const p=(l.printPlan||[]).find(p=>p.materialId===x.materialId&&p.variantId===x.variantId);if(p)v183DisablePlan(p,'wrong-link');}b.items=[];b.complete=false;b.deferred=false;b.reusedV183=false;
  v183Neutralize(l,h);l.resourceManualV183=l.resourceManualV183||{};l.resourceManualV183[resourceKeyV14(h)]={cleared:true};
}
function v183Reuse(l,h){const b=resourceBundleV176(l,h,true);
  if(!b.items.length){const prior=(state.lessons||[]).filter(x=>x.id!==l.id&&x.classId===l.classId&&x.date<l.date).sort((a,z)=>z.date.localeCompare(a.date)).find(x=>resourceBundleV176(x,h)?.items?.length);
    if(prior){const previous=resourceBundleV176(prior,h);b.items=previous.items.filter(x=>mat(x.materialId)&&variant(x.materialId,x.variantId)&&!variant(x.materialId,x.variantId)._v183obsolete).map(x=>({...x,id:uid('bundle')}));
      l.materials=l.materials||[];for(const x of b.items){if(!l.materials.includes(x.materialId))l.materials.push(x.materialId);const p=ensurePlan(l,x.materialId,x.variantId),pp=(prior.printPlan||[]).find(p=>p.materialId===x.materialId&&p.variantId===x.variantId);p.count=pp?.count||Number(cls(l.classId)?.students)||0;p.mode=pp?.mode||'bw';}}
  }
  b.reusedV183=true;b.complete=true;b.deferred=false;b._v183Manual=true;
  l.resourceManualV183=l.resourceManualV183||{};delete l.resourceManualV183[resourceKeyV14(h)];
  for(const p of (l.printPlan||[]))if(v183PlanBelongs(l,p,h)){p.alreadyPrinted=true;p._v183removed=false;p.needed=true;}
}
function v183HideFuture(l,h){const key=resourceKeyV14(h);let count=0;for(const t of state.lessons||[]){if(t.classId!==l.classId||t.date<l.date||v183IsHeld(t)||l.sequenceId&&t.sequenceId!==l.sequenceId)continue;for(const hh of rawResourceLinesV14(t))if(resourceKeyV14(hh)===key){v183DeleteFromLesson(t,hh);count++;}}return count;}
function v183MergeResource(l,fromH,toH){
 const from=resourceBundleV176(l,fromH),to=resourceBundleV176(l,toH,true);if(!from?.items?.length||resourceKeyV14(fromH)===resourceKeyV14(toH))return false;
 const selected=from.items.filter(x=>mat(x.materialId)&&variant(x.materialId,x.variantId)&&!variant(x.materialId,x.variantId)._v183obsolete).map(x=>({...x,id:uid('bundle')}));if(!selected.length)return false;
 v183Neutralize(l,toH);for(const x of to.items||[]){const pp=(l.printPlan||[]).find(p=>p.materialId===x.materialId&&p.variantId===x.variantId);if(pp)v183DisablePlan(pp,'replaced-package');}
 to.items=selected;to.title=from.title||toH;to.complete=true;to.reusedV183=!!from.reusedV183;to.deferred=false;to.archivedV183=false;to._v183Manual=true;
 for(const x of selected){const p=ensurePlan(l,x.materialId,x.variantId),v=variant(x.materialId,x.variantId),m=mat(x.materialId);p._v183removed=false;p._v183obsolete=false;p.needed=isPrintVariantV176(v,m);if(!(p.count>0))p.count=Number(cls(l.classId)?.students)||0;if(to.reusedV183)p.alreadyPrinted=true;}
 from.items=[];from.archivedV183=true;from.complete=true;from.deferred=false;
 const key=resourceKeyV14(fromH);if(!v183Hidden(l).includes(key))v183Hidden(l).push(key);setResourceTypeV14(l,fromH,'ignore');
 l.hiddenResourceKeysV183=v183Hidden(l).filter(k=>k!==resourceKeyV14(toH));setResourceTypeV14(l,toH,'print');
 l.resourceManualV183=l.resourceManualV183||{};l.resourceManualV183[key]={cleared:true};l.resourceManualV183[resourceKeyV14(toH)]={materialId:selected[0].materialId,variantId:selected[0].variantId};
 if(selected.length===1)v183SetPreference(l,toH,selected[0].materialId,selected[0].variantId);
 return true;
}
function v183NeedNewCopies(l,h){const b=resourceBundleV176(l,h,true);b.reusedV183=false;b.complete=!!b.items?.length;
  for(const x of b.items||[]){const m=mat(x.materialId),v=variant(x.materialId,x.variantId),p=ensurePlan(l,x.materialId,x.variantId);if(v?._v183obsolete)continue;p._v183removed=false;p.needed=isPrintVariantV176(v,m);p.alreadyPrinted=false;if(p.needed&&!(p.count>0))p.count=Number(cls(l.classId)?.students)||0;}
}
function v183PreferredV(l,h){const arr=state.materialPreferencesV183||[];return arr.find(x=>x.classId===l.classId&&x.key===resourceKeyV14(h)&&(!x.sequenceId||x.sequenceId===l.sequenceId))||null;}
function v183SetPreference(l,h,mid,vid){state.materialPreferencesV183=state.materialPreferencesV183||[];const key=resourceKeyV14(h);
  state.materialPreferencesV183=state.materialPreferencesV183.filter(x=>!(x.classId===l.classId&&x.sequenceId===(l.sequenceId||'')&&x.key===key));
  state.materialPreferencesV183.push({classId:l.classId,sequenceId:l.sequenceId||'',key,materialId:mid,variantId:vid,createdAt:new Date().toISOString()});
}
function v183UsePreferred(l,h,pref){if(v183HiddenHint(l,h)||!pref||!mat(pref.materialId)||!variant(pref.materialId,pref.variantId))return false;
  const k=resourceKeyV14(h),b=resourceBundleV176(l,h,true),m=mat(pref.materialId),v=variant(pref.materialId,pref.variantId);
  if(b.reusedV183||b._v183Manual&&b.items?.length)return false;
  if(b.items?.length&&b.items[0].materialId===pref.materialId&&b.items[0].variantId===pref.variantId&&b._v183Preferred)return false;
  if(b.items?.length&&!b._v183Preferred)return false;
  const previous=new Set((b.items||[]).map(x=>x.materialId));
  b.items=[{id:uid('bundle'),materialId:m.id,variantId:v.id}];b.title=b.title||h;b.complete=true;b.deferred=false;b.reusedV183=false;b._v183Preferred=true;
  l.materials=l.materials||[];if(!l.materials.includes(m.id))l.materials.push(m.id);
  (l.printPlan||[]).forEach(p=>{if((p.materialId!==m.id||p.variantId!==v.id)&&(previous.has(p.materialId)||normalizeHintV12(mat(p.materialId)?.title||'')===normalizeHintV12(h)))v183DisablePlan(p,'superseded');});
  const p=ensurePlan(l,m.id,v.id);p._v183removed=false;p._v183obsolete=false;p.needed=isPrintVariantV176(v,m);if(!(p.count>0))p.count=Number(cls(l.classId)?.students)||0;p.alreadyPrinted=false;
  l.resourceManualV183=l.resourceManualV183||{};l.resourceManualV183[k]={materialId:m.id,variantId:v.id};return true;
}
const v183OriginalMatch=bestMaterialMatchV12;
function v183NumericPrefix(x){const s=String(x||'').replace(/^(?:s|ab|blatt)\s*/i,'').match(/^\s*0*(\d{1,2})(?=[ ._\-])/);return s?Number(s[1]):null;}
bestMaterialMatchV12=function(h){const m=v183OriginalMatch(h),a=v183NumericPrefix(h),b=v183NumericPrefix(m?.title);return a!==null&&b!==null&&a!==b?null:m;};
const v183BeforeResources=lessonResourcesV14;
lessonResourcesV14=function(l){const rows=v183BeforeResources(l);return rows.map(r=>{
  const b=resourceBundleV176(l,r.hint),k=resourceKeyV14(r.hint),manual=l.resourceManualV183?.[k];
  if(b?.reusedV183){r.fileReady=true;r.deferredV176=false;r.bundleV176=b;}
  if(manual?.cleared&&!b?.items?.length){r.material=null;r.variant=null;r.fileReady=!!b?.reusedV183;}
  if(b?.items?.length){r.bundleV176=b;r.bundleItemsV176=bundleItemsV176(l,r.hint);r.material=null;r.variant=null;
    r.fileReady=!!(b.complete&&(b.reusedV183||r.bundleItemsV176.some(x=>x.v&&hasStoredFile(x.v)&&!x.v._v183obsolete)));}
  return r;
});};
const v183BeforeEnsure=ensureCoarsePrintPlansV14;
ensureCoarsePrintPlansV14=function(l){v183BeforeEnsure(l);
  for(const h of rawResourceLinesV14(l)){
    if(v183HiddenHint(l,h)||['ignore','activity','reference','digital'].includes(resourceTypeV14(l,h))){v183Neutralize(l,h);continue;}
    const manual=l.resourceManualV183?.[resourceKeyV14(h)];
    if(manual?.cleared){v183Neutralize(l,h);continue;}
    const b=resourceBundleV176(l,h);if(b?.items?.length){
      const keep=new Set(b.items.map(x=>`${x.materialId}|${x.variantId}`));
      for(const p of (l.printPlan||[]))if(v183PlanBelongs(l,p,h)&&!keep.has(`${p.materialId}|${p.variantId}`))v183DisablePlan(p,'not-in-package');
    }
    if(b?.reusedV183)for(const p of (l.printPlan||[]))if(v183PlanBelongs(l,p,h)){p.needed=true;p.alreadyPrinted=true;p._v183removed=false;}
  }
  (l.printPlan||[]).forEach(p=>{if(p._v183removed||p._v183obsolete)p.needed=false;});
};
const v183BeforeHydrate=hydrateWeekResourcesV14;
hydrateWeekResourcesV14=function(){v183BeforeHydrate();for(const l of courseLessonsV14()){
  for(const h of rawResourceLinesV14(l)){
    if(v183HiddenHint(l,h)||['ignore','activity','reference','digital'].includes(resourceTypeV14(l,h))||l.resourceManualV183?.[resourceKeyV14(h)]?.cleared){v183Neutralize(l,h);continue;}
    const pref=v183PreferredV(l,h);if(pref&&!v183IsHeld(l)&&!resourceBundleV176(l,h)?._v183Manual)v183UsePreferred(l,h,pref);
  }
  (l.printPlan||[]).forEach(p=>{if(p._v183removed||p._v183obsolete)p.needed=false;});
}saveState();};
const v183BeforeAllRows=allResourceRowsV176;
allResourceRowsV176=function(l){return v183BeforeAllRows(l).filter(r=>v183IsActive(l,r.hint));};
missingPrintableResourcesV14=function(l){return lessonResourcesV14(l).filter(r=>v183IsActive(l,r.hint)&&r.type==='print'&&!r.deferredV176&&!r.bundleV176?.reusedV183&&!r.fileReady);};
missingWeekPrintResourcesV14=function(){return courseLessonsV14().flatMap(l=>missingPrintableResourcesV14(l).map(r=>({l,...r})));};
const v183BeforePrint=printItems;
printItems=function(){return v183BeforePrint().filter(i=>v183LivePlan(i.lesson,i.plan)&&!i.variant._v183obsolete);};
openPrintItems=function(){return printItems().filter(i=>!i.plan.alreadyPrinted);};
function v183OrphanPlans(l){const bundlePairs=new Set(Object.values(resourceBundlesV176(l)).filter(b=>!b.archivedV183).flatMap(b=>(b.items||[]).map(x=>`${x.materialId}|${x.variantId}`)));
 const visible=new Set(rawResourceLinesV14(l).filter(h=>v183IsActive(l,h)).map(normalizeHintV12));
 return (l.printPlan||[]).filter(p=>v183LivePlan(l,p)&&!bundlePairs.has(`${p.materialId}|${p.variantId}`)&&!visible.has(normalizeHintV12(mat(p.materialId)?.title||''))&&mat(p.materialId));}
function v183OrphanHtml(l){const list=v183OrphanPlans(l);if(!list.length)return '';
 return `<details class="v183-orphans"><summary>${list.length} weitere, bisher einzeln verknüpfte Druckposition${list.length===1?'':'en'} prüfen</summary><p class="muted">Ältere Importe können eigene Druckaufträge angelegt haben. Entferne hier nur die überflüssigen Verknüpfungen; keine Originaldatei wird gelöscht.</p>${list.map(p=>{const m=mat(p.materialId),v=variant(p.materialId,p.variantId);return `<div class="v183-orphan"><span>${esc(m?.title||'Material')} · ${esc(v?.fileName||'ohne verknüpfte Datei')} ${p.alreadyPrinted?'· bereits kopiert':''}</span><button class="text-button" data-v183-remove-job="${l.id}|${p.id}">Druckauftrag entfernen</button></div>`;}).join('')}</details>`;
}
const v183OldStatus=resourceStatusV176;
resourceStatusV176=function(r){if(r.bundleV176?.reusedV183)return r.bundleV176.items?.length?'Bereits kopiert · Dateien der Vorstunde übernommen':'Bereits kopiert · kein neuer Ausdruck nötig';return v183OldStatus(r);};
const v183OldRow=resourceRowV14;
resourceRowV14=function(l,r){let html=v183OldRow(l,r),id=resourceEditorIdV176(l,r.hint),b=r.bundleV176;
 const action=`<div class="v183-row-actions"><button class="text-button" data-v183-reuse="${id}">${b?.reusedV183?'✓ Bereits kopiert · erneut drucken?':'Schon kopiert · weiterverwenden'}</button><button class="text-button" data-v183-detach="${id}">Falsche Dateizuordnung lösen</button><button class="text-button danger" data-v183-hide="${id}">Aus dieser Stunde entfernen</button><button class="text-button" data-v183-hide-future="${id}">In dieser Reihe künftig ausblenden</button></div>`;
 // Insert after summary by replacing first summary closing using next editor boundary or final card end.
 if(html.includes('<div class="resource-editor-v176">'))html=html.replace('<div class="resource-editor-v176">',action+'<div class="resource-editor-v176">');
 else html=html.replace(/<\/div>\s*$/,action+'</div>');
 return html;
};
const v183OldEditor=resourceEditorV176Html;
resourceEditorV176Html=function(l,r){let html=v183OldEditor(l,r),id=resourceEditorIdV176(l,r.hint),b=r.bundleV176;
 const active=(r.bundleItemsV176||[]).filter(x=>!x.v?._v183obsolete),old=(r.bundleItemsV176||[]).filter(x=>x.v?._v183obsolete);
 const other=rawResourceLinesV14(l).filter(h=>resourceKeyV14(h)!==resourceKeyV14(r.hint));
 const merge=active.length&&other.length?`<div class="v183-merge"><strong>Statt eines doppelten Materialpakets verwenden</strong><p>Dieses Paket ersetzt einen Eintrag aus dem Sollplan. Der alte Eintrag verschwindet aus der aktiven Liste; die gewählte Datei bleibt dieselbe.</p><select data-v183-merge-target="${id}"><option value="">Welchen bisherigen Eintrag ersetzen? …</option>${other.map(h=>`<option value="${esc(encodeURIComponent(h))}">${esc(displayResourceTitleV176(l,h))}</option>`).join('')}</select><button class="secondary" data-v183-merge="${id}">Zusammenführen ✓</button></div>`:'';
 const opt=`<div class="v183-editor-help"><span>Der Paketname darf anders heißen als der Dateiname. Es entsteht nur ein Druckauftrag je aktiver Datei.</span>${active.length===1?`<button class="secondary" data-v183-prefer="${id}|${active[0].materialId}|${active[0].variantId}">Diese Datei als Standard für weitere Stunden nutzen</button>`:''}</div>`;
 html=html.replace('<div class="resource-package-bottom-v176">',merge+opt+'<div class="resource-package-bottom-v176">');
 // A variant replacement is attached to its resource, not a second independent print package.
 html=html.replace(/(<button class="text-button" data-v176-remove="[^"]+">Aus Paket lösen<\/button>)/g,(m,button)=>button); // leave original controls
 if(active.length)html=html.replace('<div class="resource-package-actions-v176">',`<div class="v183-replace"><strong>Arbeitsblatt überarbeitet?</strong><p>Neue Fassung ersetzt die aktive Datei; das Original bleibt im Versionsarchiv.</p><label class="upload-button">Neue Fassung hochladen<input data-v183-replace="${id}|${active[0].materialId}|${active[0].variantId}" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.pptx" hidden></label></div><div class="resource-package-actions-v176">`);
 if(old.length)html=html.replace('<div class="resource-package-bottom-v176">',`<details class="v183-old-files"><summary>${old.length} ältere Fassung${old.length>1?'en':''} (Archiv)</summary>${old.map(x=>`<p>${esc(x.v.fileName||x.m.title)} <button class="text-button" data-v177-file="${x.materialId}|${x.variantId}">Alte Datei öffnen ↗</button></p>`).join('')}</details><div class="resource-package-bottom-v176">`);
 return html;
};
resourceUnmatchedLinkedV176=function(l){
 const activeBundles=allResourceRowsV176(l).flatMap(r=>r.bundleItemsV176||[]);const activeIds=new Set(activeBundles.map(x=>x.materialId));
 const hiddenIds=new Set(rawResourceLinesV14(l).filter(h=>!v183IsActive(l,h)).flatMap(h=>(resourceBundleV176(l,h)?.items||[]).map(x=>x.materialId)));
 const matches=(l.materials||[]).map(mat).filter(m=>m&&!activeIds.has(m.id)&&!hiddenIds.has(m.id)&&
  ((l.printPlan||[]).some(p=>p.materialId===m.id&&v183LivePlan(l,p))||!(l.printPlan||[]).some(p=>p.materialId===m.id&&p._v183removed))&&
  (m.variants||[]).some(v=>hasStoredFile(v)&&!v._v183obsolete));
 if(!matches.length)return '';
 return `<details class="linked-resource-v176"><summary>${matches.length} weitere lokal vorhandene Datei${matches.length===1?'':'en'} (optional)</summary><p>Das sind noch keinem aktiven Paket zugewiesene Dateien. Nur tatsächlich benötigte Dateien gehören in die Druckvorbereitung.</p><div>${matches.map(m=>`<span>${esc(m.title)}</span>`).join('')}</div></details>`;
};
const v183OldLessonCard=lessonMaterialCardV14;
lessonMaterialCardV14=function(l){let html=v183OldLessonCard(l);
 const archived=rawResourceLinesV14(l).filter(h=>!v183IsActive(l,h)),show=v183ShowArchived.has(l.id);
 if(archived.length){const extra=`<div class="v183-archive"><button class="text-button" data-v183-archive-toggle="${l.id}">${archived.length} ausgeblendete${archived.length===1?'r Eintrag':' Einträge'} ${show?'▴':'▾'}</button>${show?archived.map(h=>`<div class="v183-archived-row"><span>${esc(displayResourceTitleV176(l,h))}</span><button class="secondary" data-v183-restore="${resourceEditorIdV176(l,h)}">Wiederherstellen</button></div>`).join(''):''}</div>`;
 html=html.replace('<div class="resource-new-v176">',extra+'<div class="resource-new-v176">');}
 html=html.replace('<div class="resource-new-v176">',v183OrphanHtml(l)+'<div class="resource-new-v176">');
 return html;
};
const v183BaseVariantRow=variantEditorRow;
variantEditorRow=function(m,v){let html=v183BaseVariantRow(m,v);if(v._v183obsolete){
  html=html.replace(/<label class="upload-button">[^<]*<input[^>]*data-upload-variant="[^"]+"[^>]*><\/label>/,'<span class="v183-version-tag">Ältere Fassung · Archiv</span>');
  html=html.replace('<div class="variant-editor">','<div class="variant-editor v183-archived-version">');
} else if(m.primaryVariantIdV183===v.id){html=html.replace('<div class="variant-editor">','<div class="variant-editor v183-current-version">');}
return html;};
const v183BaseMaterialCard=materialCardV15;
materialCardV15=function(m){let html=v183BaseMaterialCard(m),old=(m.variants||[]).filter(v=>v._v183obsolete);if(m.primaryVariantIdV183){const v=variant(m.id,m.primaryVariantIdV183);html=html.replace('</div></button>',`<small class="v183-version-summary">Aktuell: ${esc(v?.fileName||'neue Fassung')}${old.length?` · ${old.length} ältere Fassung${old.length===1?'':'en'} im Archiv`:''}</small></div></button>`);}return html;};
const v183OldApplyImported=applyImportedMaterial;
applyImportedMaterial=function(l,item){
  const norm=normalizeHintV12(item.title);const b=Object.values(resourceBundlesV176(l)).find(b=>normalizeHintV12(b.title)===norm&&b.items?.length||(b.items||[]).some(x=>normalizeHintV12(variant(x.materialId,x.variantId)?.fileName||'')===norm||normalizeHintV12(mat(x.materialId)?.title||'')===norm));
  if(b){const x=b.items.find(x=>normalizeHintV12(variant(x.materialId,x.variantId)?.fileName||'')===norm||normalizeHintV12(mat(x.materialId)?.title||'')===norm)||b.items[0],m=mat(x.materialId);if(m){const p=ensurePlan(l,x.materialId,x.variantId);if(item.copies>0&&item.printMode!=='none'){p.needed=true;p.count=item.copies;p.mode=item.printMode||'bw';p.alreadyPrinted=p.alreadyPrinted||!!item.alreadyPrinted;}return m;}}
  return v183OldApplyImported(l,item);
};
function v183ApplyVersion(l,h,oldMid,oldVid,newMid,newVid){if(!rawResourceLinesV14(l).some(x=>resourceKeyV14(x)===resourceKeyV14(h))){l.customResourceHintsV176=l.customResourceHintsV176||[];l.customResourceHintsV176.push(h);}const b=resourceBundleV176(l,h,true);b.items=(b.items||[]).filter(x=>!(x.materialId===oldMid&&x.variantId===oldVid));if(!b.items.some(x=>x.materialId===newMid&&x.variantId===newVid))b.items.push({id:uid('bundle'),materialId:newMid,variantId:newVid});b.complete=true;b.deferred=false;b.reusedV183=false;b._v183Manual=true;
 l.materials=l.materials||[];if(!l.materials.includes(newMid))l.materials.push(newMid);
 (l.printPlan||[]).forEach(p=>{if(p.materialId===oldMid&&p.variantId===oldVid)v183DisablePlan(p,'new-version');});
 const np=ensurePlan(l,newMid,newVid);np._v183removed=false;np._v183obsolete=false;np.needed=!v183IsHeld(l);np.count=np.count>0?np.count:Number(cls(l.classId)?.students)||0;np.mode=np.mode||'bw';np.alreadyPrinted=false;
 l.resourceManualV183=l.resourceManualV183||{};l.resourceManualV183[resourceKeyV14(h)]={materialId:newMid,variantId:newVid};
}
async function v183ReplaceFile(l,h,oldMid,oldVid,f){if(!l||!f)return;const m=mat(oldMid);if(!m)throw Error('Ausgangsmaterial nicht gefunden.');const old=variant(oldMid,oldVid);
 const nv={id:uid('var'),type:'standard',label:`Aktuelle Fassung · ${new Date().toLocaleDateString('de-DE')}`,available:true,fileName:f.name,fileKey:`material-${m.id}-v183-${uid('file')}`,createdAt:new Date().toISOString()};
 await fileStorePut(nv.fileKey,f);storedFileKeys.add(nv.fileKey);m.variants=m.variants||[];m.variants.push(nv);m.primaryVariantIdV183=nv.id;if(old){old._v183obsolete=true;old._v183ReplacedBy=nv.id;}
 v183ApplyVersion(l,h,oldMid,oldVid,m.id,nv.id);v183SetPreference(l,h,m.id,nv.id);m.improvementFlags=(m.improvementFlags||[]).filter(x=>x!=='replace');
 for(const t of state.lessons||[]){if(t.id===l.id||t.classId!==l.classId||v183IsHeld(t)||t.date<l.date)continue;for(const hh of rawResourceLinesV14(t))if(resourceKeyV14(hh)===resourceKeyV14(h)&&!v183HiddenHint(t,hh)&&(!l.sequenceId||t.sequenceId===l.sequenceId))v183UsePreferred(t,hh,v183PreferredV(t,hh));}
 return nv;
}
const v183OldStd=standardVariantV12;
standardVariantV12=function(m){return m?.primaryVariantIdV183&&(m.variants||[]).find(v=>v.id===m.primaryVariantIdV183)||v183OldStd(m);};
// The week view and lesson reflection should use the active materials, not obsolete/hidden file attachments.
const v183OldRelevant=v182RelevantMaterials;
v182RelevantMaterials=function(l){const hidden=new Set(v183Hidden(l)),retired=new Set((l.printPlan||[]).filter(p=>p._v183removed).map(p=>p.materialId));
 return v183OldRelevant(l).filter(m=>{if(m.material?.primaryVariantIdV183){m.variants=(m.variants||[]).filter(v=>!v._v183obsolete);}if(m.hint)return !hidden.has(resourceKeyV14(m.hint))&&resourceTypeV14(l,m.hint)!=='ignore';if(m.material&&retired.has(m.id)&&!(l.printPlan||[]).some(p=>p.materialId===m.id&&v183LivePlan(l,p))&&!Object.values(resourceBundlesV176(l)).some(b=>!b.archivedV183&&(b.items||[]).some(x=>x.materialId===m.id)))return false;return true;});
};
V182_FLAGS.material.push(['replace','Neues Arbeitsblatt statt dieser Fassung erstellen']);
const v183OldBacklog=v182BacklogCard;
v182BacklogCard=function(b){let html=v183OldBacklog(b);if(b.kind==='material'&&b.flags?.includes('replace')){html=html.replace('</div></article>',`<label class="upload-button v183-backlog-upload">Neue Fassung hinterlegen<input data-v183-backlog-upload="${b.id}" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" hidden></label></div></article>`);}return html;};
function v183HintForMaterial(l,mid,title){const b=Object.entries(resourceBundlesV176(l)).find(([k,x])=>(x.items||[]).some(a=>a.materialId===mid));if(b)return rawResourceLinesV14(l).find(h=>resourceKeyV14(h)===b[0])||b[1].title;
 return rawResourceLinesV14(l).find(h=>normalizeHintV12(h)===normalizeHintV12(title))||title;
}
const v183OldPrompt=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){let txt=v183OldPrompt(l);const active=allResourceRowsV176(l).filter(r=>r.type==='print').map(r=>displayResourceTitleV176(l,r.hint));txt+=`\n\n## Verbindliche Materialentscheidungen im Cockpit\nNur diese aktiven Materialpakete berücksichtigen: ${active.join('; ')||'keine'}. Ausgeblendete, entfernte oder ältere Fassungen nicht als benötigte neue Kopien interpretieren. Schon gedruckte Materialien aus der Vorstunde werden weiterverwendet und nicht erneut gedruckt. Neue Dateien dürfen nicht allein wegen eines anderen Dateinamens ein zweites Materialpaket erzeugen.\n`;return txt;};
const v183OldWire=wire;
wire=function(){v183OldWire();const parse=id=>{const i=id.indexOf('|');return [lesson(id.slice(0,i)),decodeURIComponent(id.slice(i+1))];};
  document.querySelectorAll('[data-v183-hide]').forEach(btn=>btn.onclick=()=>{const [l,h]=parse(btn.dataset.v183Hide);if(!l)return;v183DeleteFromLesson(l,h);resourceEditorV176={lessonId:'',key:''};saveState();render();});
  document.querySelectorAll('[data-v183-hide-future]').forEach(btn=>btn.onclick=()=>{const [l,h]=parse(btn.dataset.v183HideFuture);if(!l||!confirm('„'+h+'“ aus dieser und allen zukünftigen noch nicht gehaltenen Fachstunden dieser Reihe ausblenden? Originaldateien und Reihenplanung bleiben erhalten.'))return;const n=v183HideFuture(l,h);saveState();render();alert(n+' Stunden bereinigt.');});
  document.querySelectorAll('[data-v183-restore]').forEach(btn=>btn.onclick=()=>{const [l,h]=parse(btn.dataset.v183Restore);if(!l)return;v183RestoreToLesson(l,h);saveState();render();});
  document.querySelectorAll('[data-v183-archive-toggle]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.v183ArchiveToggle;v183ShowArchived.has(id)?v183ShowArchived.delete(id):v183ShowArchived.add(id);render();});
  document.querySelectorAll('[data-v183-detach]').forEach(btn=>btn.onclick=()=>{const [l,h]=parse(btn.dataset.v183Detach);if(!l)return;if(!confirm('Falsche Zuordnung zu „'+h+'“ lösen? Bereits lokal gespeicherte Originaldateien bleiben erhalten.'))return;v183DisconnectHint(l,h);saveState();render();});
  document.querySelectorAll('[data-v183-reuse]').forEach(btn=>btn.onclick=()=>{const [l,h]=parse(btn.dataset.v183Reuse);if(!l)return;const b=resourceBundleV176(l,h);if(b?.reusedV183){v183NeedNewCopies(l,h);}else v183Reuse(l,h);saveState();render();});
  document.querySelectorAll('[data-v183-remove-job]').forEach(btn=>btn.onclick=()=>{const [lid,pid]=btn.dataset.v183RemoveJob.split('|'),l=lesson(lid),p=l?.printPlan?.find(p=>p.id===pid);if(!p)return;v183DisablePlan(p,'manual-orphan-removal');saveState();render();});
  document.querySelectorAll('[data-v183-merge]').forEach(btn=>btn.onclick=()=>{const [l,fromH]=parse(btn.dataset.v183Merge),target=document.querySelector(`[data-v183-merge-target="${btn.dataset.v183Merge}"]`)?.value;if(!l||!target)return alert('Bitte erst den zu ersetzenden Eintrag auswählen.');const toH=decodeURIComponent(target);if(!confirm(`Materialpaket „${displayResourceTitleV176(l,fromH)}“ als Ersatz für „${toH}“ verwenden? Der alte Hinweis wird ausgeblendet, keine Originaldatei gelöscht.`))return;if(v183MergeResource(l,fromH,toH)){resourceEditorV176={lessonId:l.id,key:resourceKeyV14(toH)};saveState();render();}});
  document.querySelectorAll('[data-v183-prefer]').forEach(btn=>btn.onclick=()=>{const parts=btn.dataset.v183Prefer.split('|'),[l,h]=parse(parts.slice(0,2).join('|'));if(!l)return;const m=mat(parts[2]),v=variant(parts[2],parts[3]);if(!m||!v)return;v183SetPreference(l,h,m.id,v.id);const b=resourceBundleV176(l,h,true);b._v183Manual=true;for(const t of state.lessons||[]){if(t.id===l.id||t.classId!==l.classId||t.date<l.date||v183IsHeld(t))continue;for(const hh of rawResourceLinesV14(t))if(resourceKeyV14(hh)===resourceKeyV14(h)&&(!l.sequenceId||t.sequenceId===l.sequenceId))v183UsePreferred(t,hh,v183PreferredV(t,hh));}saveState();render();alert('Diese Datei ist für weitere noch nicht gehaltene Stunden mit demselben Materialhinweis bevorzugt. Alte ZIP-Dateien bleiben erhalten.');});
  document.querySelectorAll('[data-v183-replace]').forEach(el=>el.onchange=async()=>{const parts=el.dataset.v183Replace.split('|'),[l,h]=parse(parts.slice(0,2).join('|')),f=el.files?.[0];if(!l||!f)return;try{await v183ReplaceFile(l,h,parts[2],parts[3],f);saveState();render();alert('Neue Fassung gespeichert. Die frühere Fassung liegt im Versionsarchiv, künftige Kopieraufträge nutzen die neue Datei.');}catch(e){alert('Neue Fassung konnte nicht gespeichert werden: '+(e.message||e));}});
  document.querySelectorAll('[data-v183-backlog-upload]').forEach(el=>el.onchange=async()=>{const b=state.backlog.find(x=>x.id===el.dataset.v183BacklogUpload),l=lesson(b?.lessonId),f=el.files?.[0];if(!b||!l||!f)return;try{const old=mat(b.materialId),hint=v183HintForMaterial(l,b.materialId,b.materialTitle);if(old){const ov=standardVariantV12(old);await v183ReplaceFile(l,hint,old.id,ov.id,f);}else{const m={id:uid('mat'),title:b.materialTitle||f.name.replace(/\.[^.]+$/,''),kind:'file',resourceType:'print',source:'Überarbeitete Fassung · '+(b.materialTitle||''),variants:[],assignments:[{classId:l.classId,sequenceId:l.sequenceId||'',unitId:l.planReference?.unitId||''}],improvementFlags:[]};state.materials.push(m);const v={id:uid('var'),type:'standard',label:'Aktuelle Fassung',available:true,fileName:f.name,fileKey:`material-${m.id}-v183`};await fileStorePut(v.fileKey,f);storedFileKeys.add(v.fileKey);m.variants.push(v);m.primaryVariantIdV183=v.id;v183ApplyVersion(l,hint,b.materialId,'',m.id,v.id);v183SetPreference(l,hint,m.id,v.id);for(const t of state.lessons||[])if(t.id!==l.id&&t.classId===l.classId&&t.date>=l.date&&!v183IsHeld(t))for(const hh of rawResourceLinesV14(t))if(resourceKeyV14(hh)===resourceKeyV14(hint))v183UsePreferred(t,hh,v183PreferredV(t,hh));}
      b.done=true;b.doneAt=new Date().toISOString();saveState();render();alert('Neue Fassung gespeichert und Überarbeitungsaufgabe erledigt.');}catch(e){alert('Material konnte nicht ersetzt werden: '+(e.message||e));}});
  // A custom packet upload or type change is a manual decision: do not let an old automatic hint create a parallel print job.
  document.querySelectorAll('[data-v176-upload],[data-v176-link]').forEach(el=>{const old=el.onchange||el.onclick;if(!old)return;const name=el.hasAttribute('data-v176-upload')?'v176Upload':'v176Link';const [l,h]=parse(el.dataset[name]);if(!l)return;const before=old;const handler=async e=>{await before(e);const b=resourceBundleV176(l,h);if(b?.items?.length){b._v183Manual=true;l.resourceManualV183=l.resourceManualV183||{};l.resourceManualV183[resourceKeyV14(h)]={materialId:b.items[0].materialId,variantId:b.items[0].variantId};const keep=new Set(b.items.map(x=>`${x.materialId}|${x.variantId}`));for(const p of l.printPlan||[])if(!keep.has(`${p.materialId}|${p.variantId}`)&&v183PlanBelongs(l,p,h))v183DisablePlan(p,'package-file-chosen');saveState();}};if(el.hasAttribute('data-v176-upload'))el.onchange=handler;else el.onclick=handler;});
};
const v183OldRender=render;
render=function(){v183OldRender();const v=document.querySelector('.brand small');if(v)v.textContent=`${state.settings.schoolYear} · ${V183_VERSION}`;};
render();

/* ===== V0.18.4 – ChatGPT-Reihenplanung direkt im Schulcockpit =====
   Der Sollplan ist die führende Quelle. Nur bestätigte, belegte Dateitreffer
   werden verbunden. Weder fremde Klassen noch Ist-Stunden werden überschrieben. */
const V184_VERSION='V0.18.5';
let v184Flow={courseId:'',sequenceId:'',newTitle:'',startDate:'',endDate:'',hours:'',instructions:'',step:0,prompt:'',raw:'',pkg:null,choices:{},overwrite:true};
const V184_KIND={file:'Datei',book:'Buch / Arbeitsheft',digital:'Digitales Material',activity:'Tätigkeit / Material vor Ort',source:'Quelle / Lehrkraft'};
function v184Text(x,n=4000){return String(x??'').trim().slice(0,n);}
function v184IsoDate(s){s=String(s||'').trim();if(!s)return '';if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(new Date(s+'T12:00:00').getTime())||iso(new Date(s+'T12:00:00'))!==s)throw Error('Ungültiges Datum: '+s+'. Bitte YYYY-MM-DD verwenden.');return s;}
function v184NormName(s){return catalogStemV17(s).replace(/\b(pdf|doc|docx|pptx|png|jpg|jpeg)$/,'').trim();}
function v184NumbersMatch(a,b){let x=v183NumericPrefix(a),y=v183NumericPrefix(b);return x===null||y===null||x===y;}
function v184CurrentCourseCatalog(cid){return (state.materialCatalog||[]).filter(e=>e.disposition!=='excluded'&&e.scope!=='exclude'&&catalogCourseV17(e)?.id===cid);}
function v184CatalogPromptEntries(cid,qtitle){const all=v184CurrentCourseCatalog(cid);let list=all.map(e=>({e,score:Math.max(similarityV16(e.sequenceTitle||'',qtitle||''),similarityV16(e.fileName,qtitle||''))})).sort((a,b)=>b.score-a.score).slice(0,120);
 return list.map(({e})=>`- ID ${e.catalogId} | ${e.fileName} | Archiv: ${e.sourceArchive||'nicht bekannt'} | Pfad: ${e.sourcePath||'nicht bekannt'} | Reihe: ${e.sequenceTitle||'noch unbestimmt'} | ${catalogScopeLabelV17(e.scope)} | ${catalogAvailableV17(e)?'Archiv/Datei lokal vorhanden':'nur Katalogeintrag'}${e.variantType&&e.variantType!=='standard'?' | '+e.variantType:''}`).join('\n');}
function v184Prompt(){const c=cls(v184Flow.courseId),q=seq(v184Flow.sequenceId),title=q?.title||v184Flow.newTitle||'noch festzulegen';const old=(q?.plan||[]).slice().sort((a,b)=>(a.plannedDate||'').localeCompare(b.plannedDate||''));const actual=(state.lessons||[]).filter(l=>l.classId===c?.id&&v182IsHeld(l)).sort((a,b)=>a.date.localeCompare(b.date)).slice(-6);
 const back=(state.backlog||[]).filter(b=>!b.done&&(b.classId===c?.id||(b.lessonId&&lesson(b.lessonId)?.classId===c?.id))).slice(0,18);
 const tt=(state.timetable||[]).filter(t=>t.classId===c?.id).map(t=>`Wochentag ${['So','Mo','Di','Mi','Do','Fr','Sa'][Number(t.weekday)]||t.weekday}, ${t.period||t.slot||'Slot offen'}`).join('; ');
 return `# Schulcockpit – Unterrichtsreihe gemeinsam planen\n\nKlasse/Fach: ${c?.subject||''} ${c?.name||''} (Cockpit-Kurs-ID: ${c?.id||''})\nLerngröße: ${c?.students||'noch nicht hinterlegt'}\nSchuljahr: ${state.settings.schoolYear||''}\nReihe: ${title}\nZeitraum: ${v184Flow.startDate||q?.startDate||'offen'} bis ${v184Flow.endDate||q?.endDate||'offen'}\nUmfang: ${v184Flow.hours||q?.hours||'noch offen'} Fachstunden\nStundenplan: ${tt||'noch nicht vorhanden'}\nBereits bekannte Ziele/Notizen: ${q?.goal||'keine'}; ${q?.notes||'keine'}\n\n## Vorhandener Sollplan – ggf. konkretisieren, nicht duplizieren\n${old.map(u=>`- ${u.plannedDate||'Datum offen'} | ${u.title} | ${u.content||'Inhalt offen'} | Material: ${u.material||'nicht festgelegt'}`).join('\n')||'Noch keine Einzelstunden geplant.'}\n\n## Tatsächlich gehaltene frühere Stunden (Ist, nicht automatisch Soll)\n${actual.map(l=>`- ${l.date}: ${l.title}; ${l.reflectionV182?.note||'keine Reflexionsnotiz'}`).join('\n')||'Keine dokumentiert.'}\n\n## Offene spätere Überarbeitungen\n${back.map(b=>`- ${b.title}: ${b.detail||''}`).join('\n')||'Keine.'}\n\n## Bereits im Material-Hub katalogisierte Originaldateien dieser Lerngruppe\nDie folgenden IDs sind echte Katalog-IDs, aber ein Dateiname ist kein Beleg für einen didaktisch passenden Inhalt. Nutze nur sachlich plausible Dateien und bezeichne Alternativen als solche.\n${v184CatalogPromptEntries(c?.id,title)||'Kein Katalog für diese Lerngruppe. Fehlende Dateien als noch nicht vorhanden markieren.'}\n\n## Meine Ergänzungen\n${v184Flow.instructions||'Keine.'}\n\n## Auftrag\nKonkretisiere ausschließlich diese Reihe mit datierten Stunden, soweit Daten im Kontext bekannt sind. Grob bestehende Einträge und Reihenfolge berücksichtigen. Keine nicht belegten Materialien oder Unterrichtsinhalte erfinden. Gib pro Stunde Thema, groben Inhalt, Ziel und benötigte Materialien an; keine ausführliche Einzelstundenplanung/PowerPoint. Unterscheide Dateien, Buch-/AH-Stellen, digitale Inhalte und Tätigkeiten. Lege bei bereits vorhandenen Dateien die exakte oben gelistete ID und den Originaldateinamen fest; ist die Zuordnung unklar, lasse catalogId leer. Fehlende Datei nicht als vorhanden ausgeben. Eine Datei kann in mehreren Stunden verwendet werden; setze reuse=true, wenn bereits kopiertes Material weiterverwendet wird. Für Druckdateien printMode bw/color/none und copies als Zahl oder \"class\" angeben. Nur tatsächlich benötigte Dateien auflisten.\n\nGib zunächst eine knappe, normale Erläuterung ohne Tabelle oder interaktive Kästen. Danach GENAU EINEN unveränderten Datenblock, dessen Inhalt valides JSON ist (keine Kommentare, keine Markdown-Fence im Block, keine ausgelassenen Klammern):\n\n<SCHULCOCKPIT_SEQUENCE_IMPORT>\n{\n  \"schema\": \"schulcockpit.sequence.v1\",\n  \"courseId\": ${JSON.stringify(c?.id||'')},\n  \"sequence\": {\"title\": ${JSON.stringify(title)}, \"startDate\": ${JSON.stringify(v184Flow.startDate||q?.startDate||'')}, \"endDate\": ${JSON.stringify(v184Flow.endDate||q?.endDate||'')}, \"hours\": ${JSON.stringify(v184Flow.hours||q?.hours||'')}, \"goal\": \"...\", \"notes\": \"...\"},\n  \"units\": [\n    {\"plannedDate\": \"YYYY-MM-DD\", \"title\": \"...\", \"hours\": \"1\", \"content\": \"...\", \"objective\": \"...\", \"competencies\": \"\", \"notes\": \"\", \"materials\": [\n      {\"title\": \"exakter Dateiname aus obiger Liste\", \"kind\": \"file\", \"catalogId\": \"cat_...\", \"variant\": \"standard\", \"printMode\": \"bw\", \"copies\": \"class\", \"reuse\": false, \"note\": \"\"},\n      {\"title\": \"Arbeitsheft S. 12 Nr. 1–3\", \"kind\": \"book\", \"catalogId\": \"\", \"printMode\": \"none\", \"copies\": 0, \"reuse\": false, \"note\": \"\"}\n    ]}\n  ]\n}\n</SCHULCOCKPIT_SEQUENCE_IMPORT>\n\nKeine Dummy-Einträge übernehmen: Fülle alle Felder sinnvoll, sonst lasse sie als leeren String. Bei unbekannten Terminen plannedDate als \"\" angeben, kein Datum erfinden. Eine neue Reihe darf den bekannten groben Sollplan nicht duplizieren.\n`;}
function v184Extract(raw){const s=String(raw||'').trim();if(!s)throw Error('Bitte ChatGPT-Antwort oder JSON einfügen.');const marked=s.match(/<SCHULCOCKPIT_SEQUENCE_IMPORT>\s*([\s\S]*?)\s*<\/SCHULCOCKPIT_SEQUENCE_IMPORT>/i);const fenced=[...s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(x=>x[1]);let x=null,parseError=null;for(const candidate of [marked?.[1],...fenced,s].filter(Boolean)){try{const p=JSON.parse(candidate.trim());if(p?.schema==='schulcockpit.sequence.v1'){x=p;break;}}catch(e){parseError=e;}}if(!x)throw Error('Kein gültiger <SCHULCOCKPIT_SEQUENCE_IMPORT>-JSON-Block gefunden. Bitte die gesamte Antwort oder die ungekürzte JSON-Datei verwenden. '+(parseError?.message||''));return v184Normalize(x);}
function v184Normalize(x){const course=cls(v184Flow.courseId);if(!course)throw Error('Bitte zuerst einen vorhandenen Fachkurs wählen.');if(x.courseId&&x.courseId!==course.id)throw Error('Antwort gehört zu einem anderen Fachkurs. Bitte den richtigen Kurs wählen oder den Prompt erneut verwenden.');if(!x.sequence||!Array.isArray(x.units)||!x.units.length||x.units.length>65)throw Error('Die Antwort braucht eine Reihe und 1–65 vollständige Soll-Stunden.');const q=x.sequence;let title=v184Text(q.title,280);if(!title)throw Error('Reihentitel fehlt.');const units=x.units.map((u,i)=>{if(!u||!v184Text(u.title))throw Error('Stunde '+(i+1)+': Thema fehlt.');if(!Array.isArray(u.materials))throw Error('Stunde '+(i+1)+': materials muss ein Array sein, notfalls [].');if(u.materials.length>30)throw Error('Zu viele Materialeinträge in Stunde '+(i+1));return {...cleanPlanUnitV10({plannedDate:v184IsoDate(u.plannedDate||''),title:u.title,hours:u.hours||'1',content:u.content,competencies:u.competencies,objective:u.objective,notes:u.notes,homework:u.homework}),materials:u.materials.map((m,j)=>{if(!m?.title)throw Error('Stunde '+(i+1)+', Material '+(j+1)+': Name fehlt.');const kind=['file','book','digital','activity','source'].includes(m.kind)?m.kind:'file';return {title:v184Text(m.title,350),kind,catalogId:v184Text(m.catalogId,120),variant:v184Text(m.variant||'standard',40),printMode:['bw','color','none'].includes(m.printMode)?m.printMode:(kind==='file'?'bw':'none'),copies:m.copies==='class'?'class':Number.isFinite(Number(m.copies))?Math.max(0,Math.min(1000,Number(m.copies))):'class',reuse:!!m.reuse,note:v184Text(m.note,700)};})};});const dates=units.map(u=>u.plannedDate).filter(Boolean);if(new Set(dates).size!==dates.length)throw Error('Mehrere Stunden besitzen dasselbe Datum. Bitte Termine korrigieren bzw. Doppelstunden eindeutig beschreiben.');return {schema:x.schema,courseId:course.id,sequence:{title,startDate:v184IsoDate(q.startDate||''),endDate:v184IsoDate(q.endDate||''),hours:v184Text(q.hours||'',30),goal:v184Text(q.goal||'',3000),notes:v184Text(q.notes||'',2200)},units};}
function v184CourseMatchCatalog(e,cid){return e&&e.disposition!=='excluded'&&e.scope!=='exclude'&&catalogCourseV17(e)?.id===cid;}
function v184MaterialCandidates(item,cid){if(item.kind!=='file'&&item.kind!=='digital'&&item.kind!=='source')return [];let result=[];const want=v184NormName(item.title);const catalog=v184CurrentCourseCatalog(cid);for(const e of catalog){if(!v184NumbersMatch(item.title,e.fileName))continue;const score=v184NormName(e.fileName)===want?1:similarityV16(item.title,e.fileName);if(score>=.43||e.catalogId===item.catalogId){const m=state.materials.find(m=>m.catalogId===e.catalogId);result.push({key:m?'m:'+m.id:'c:'+e.catalogId,e,m,label:e.fileName+(m?.variants?.some(hasStoredFile)?' · lokal gespeichert':catalogAvailableV17(e)?' · Archiv verbunden':' · Archiv fehlt'),score:score+(e.catalogId===item.catalogId?.08:0)});}}
 for(const m of state.materials){if(m.catalogId||!(m.variants||[]).length||!v184NumbersMatch(item.title,m.title))continue;const scoped=(m.assignments||[]).some(a=>a.classId===cid);if(!scoped)continue;const score=v184NormName(m.title)===want?1:similarityV16(item.title,m.title);if(score>=.43)result.push({key:'m:'+m.id,m,label:m.title+((m.variants||[]).some(hasStoredFile)?' · lokal gespeichert':' · Datei fehlt'),score});}
 return result.sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label)).slice(0,12);}
function v184DefaultChoice(item,candidates,cid){if(item.kind!=='file'&&item.kind!=='digital'&&item.kind!=='source')return 'reference';const chosen=candidates.find(x=>x.e?.catalogId===item.catalogId);if(chosen&&chosen.score>=.9&&v184NormName(chosen.e.fileName)===v184NormName(item.title))return chosen.key;const exact=candidates.filter(x=>v184NormName(x.e?.fileName||x.m?.title)===v184NormName(item.title));const ids=new Set(exact.map(x=>x.e?.catalogId||x.m?.id));return ids.size===1?exact[0].key:'unresolved';}
function v184Decision(ui,mi){const key=ui+'|'+mi,unit=v184Flow.pkg.units[ui],item=unit.materials[mi],candidates=v184MaterialCandidates(item,v184Flow.courseId);const explicit=v184Flow.choices[key];const selected=explicit||v184DefaultChoice(item,candidates,v184Flow.courseId);return {item,candidates,selected};}
function v184FindTarget(q,u){if(!q)return null;let byDate=u.plannedDate?(q.plan||[]).filter(v=>v.plannedDate===u.plannedDate):[];if(byDate.length===1)return byDate[0];const matches=(q.plan||[]).filter(v=>catalogNormV17(v.title)===catalogNormV17(u.title));return matches.length===1?matches[0]:null;}
function v184ImportPreview(){const pkg=v184Flow.pkg,q=seq(v184Flow.sequenceId),rows=pkg.units.map((u,i)=>{const original=v184FindTarget(q,u);return `<article class="v184-unit"><div class="v184-unit-head"><span>${esc(u.plannedDate||'Datum offen')}</span><strong>${esc(u.title)}</strong><small>${original?'Bestehende Soll-Stunde ergänzen':'Neue Soll-Stunde'}</small></div><p>${esc(u.content||'Inhalt noch offen')}</p>${u.materials.length?u.materials.map((m,j)=>{const d=v184Decision(i,j),linked=d.selected!=='unresolved'&&d.selected!=='none';return `<div class="v184-material"><div><strong>${esc(m.title)}</strong><small>${esc(V184_KIND[m.kind]||'Datei')}${m.reuse?' · bereits kopiert / weiterverwenden':''}</small>${m.sourcePath?`<small>Quelle: ${esc(m.sourceArchive||'Archiv unbekannt')} · ${esc(m.sourcePath)}</small>`:''}</div>${m.kind==='book'||m.kind==='activity'?`<span class="v184-tag">${m.kind==='book'?'Referenz · keine Kopie':'Tätigkeit · keine Kopie'}</span>`:`<select data-v184-choice="${i}|${j}" aria-label="Materialzuordnung für ${esc(m.title)}"><option value="unresolved" ${d.selected==='unresolved'?'selected':''}>Noch nicht zugeordnet – keine automatische Druckdatei</option><option value="none" ${d.selected==='none'?'selected':''}>Nicht verwenden / auslassen</option>${d.candidates.map(c=>`<option value="${esc(c.key)}" ${d.selected===c.key?'selected':''}>${esc(c.score>=.99?'Exakt · ':'Prüfen · ')}${esc(c.label)}</option>`).join('')}</select>`}</div>`;}).join(''):'<small>Kein Material eingetragen.</small>'}</article>`;}).join('');const statuses=pkg.units.flatMap((u,i)=>u.materials.map((m,j)=>v184Decision(i,j))).filter(d=>d.item.kind==='file'||d.item.kind==='digital'||d.item.kind==='source');const resolved=statuses.filter(d=>d.selected.startsWith('m:')||d.selected.startsWith('c:')).length;const needs=statuses.filter(d=>d.selected==='unresolved').length;return `<div class="v184-preview"><section class="v184-info"><h3>Vorschau: ${esc(pkg.sequence.title)}</h3><p>${pkg.units.length} geplante Stunden · ${resolved} eindeutig ausgewählte Materialdateien · ${needs} noch ohne verbindliche Zuordnung.</p><p>Ungeklärte Dateinamen erzeugen <strong>keinen</strong> automatischen Druckauftrag. Andere Fachkurse und gehaltene oder fertig geplante Stunden bleiben unverändert.</p><label class="v184-toggle"><input id="v184-overwrite" type="checkbox" ${v184Flow.overwrite?'checked':''}> Bei Datumstreffern vorhandene <strong>Sollplan</strong>-Felder aktualisieren (Ist-Stunden geschützt)</label></section>${rows}<div class="v184-actions"><button class="secondary" data-v184-back>← Antwort bearbeiten</button><button class="primary" data-v184-apply>Reihenplanung verbindlich übernehmen →</button></div></div>`;}
function v184ModalHtml(){const f=v184Flow,c=cls(f.courseId),q=seq(f.sequenceId);return `<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide v184-modal" data-modal-stop><header class="modal-header"><div><span class="eyebrow">REIHENPLANUNG MIT CHATGPT · ${f.step+1}/3</span><h2>${f.step===0?'Reihe auswählen':f.step===1?'Prompt & Antwort':'Import prüfen'}</h2></div><button class="icon-button" data-action="modal-close" aria-label="Schließen">×</button></header><div class="modal-body">${f.step===0?`<div class="v184-setup"><p>Hier entsteht die eigentliche Reihenplanung – ohne Zwischenschritt über „Mein Schulplan“.</p><label>Fachkurs<select id="v184-course">${state.classes.filter(c=>c.subject&&c.subject.toLowerCase()!=='ga').map(c=>`<option value="${c.id}" ${c.id===f.courseId?'selected':''}>${esc(c.subject)} ${esc(c.name)} (${c.students||'?'} SuS)</option>`).join('')}</select></label><label>Reihe<select id="v184-sequence"><option value="">Neue Reihe planen</option>${classSequences(f.courseId).map(q=>`<option value="${q.id}" ${q.id===f.sequenceId?'selected':''}>${esc(q.title)} · ${(q.plan||[]).length} Soll-Stunden</option>`).join('')}</select></label><label>Reihentitel ${q?'(bestehende Reihe wird konkretisiert)':''}<input id="v184-title" value="${esc(q?.title||f.newTitle)}" ${q?'readonly':''} placeholder="z. B. Was ist Religion?"></label><div class="v184-grid"><label>Startdatum<input id="v184-start" type="date" value="${esc(f.startDate||q?.startDate||'')}"></label><label>Enddatum<input id="v184-end" type="date" value="${esc(f.endDate||q?.endDate||'')}"></label></div><label>Ungefährer Umfang (Fachstunden)<input id="v184-hours" type="number" min="1" max="65" value="${esc(f.hours||q?.hours||'')}"></label><label>Eigene Vorgaben / Anforderungen<textarea id="v184-instructions" rows="5" placeholder="Besondere Lernvoraussetzungen, Schwerpunkte, Wünsche für diese Reihe …">${esc(f.instructions)}</textarea></label><p class="v184-info">Im Material-Hub: ${v184CurrentCourseCatalog(f.courseId).length} Katalogdateien für diesen Fachkurs. Nur bestätigte Treffer werden übernommen.</p><button class="primary" data-v184-prompt>ChatGPT-Prompt erstellen →</button></div>`:f.step===1?`<div class="v184-step"><p>1. Prompt kopieren und im Chat verwenden. 2. Die ganze Antwort hier einfügen. Alternativ die Antwort als Datei öffnen.</p><label>Dein Prompt<textarea id="v184-prompt-text" rows="10" readonly>${esc(f.prompt)}</textarea></label><div class="v184-actions"><button class="secondary" data-v184-config>← Angaben ändern</button><button class="primary" data-v184-copy>Prompt kopieren</button><button class="secondary" data-v184-download-prompt>Prompt als .txt</button></div><label>ChatGPT-Antwort oder technischer JSON-Block<textarea id="v184-raw" rows="10" placeholder="Gesamte Antwort mit <SCHULCOCKPIT_SEQUENCE_IMPORT> …">${esc(f.raw)}</textarea></label><div class="v184-actions"><label class="upload-button">Antwortdatei öffnen<input type="file" id="v184-file" accept=".json,.txt,.md,application/json,text/plain,text/markdown" hidden></label><button class="primary" data-v184-parse>Antwort prüfen →</button></div></div>`:v184ImportPreview()}</div></section></div>`;}
function v184Open(courseId='',qid=''){const c=cls(courseId)||state.classes.find(c=>c.subject&&!/^ga$/i.test(c.subject));if(!c)return alert('Bitte zuerst unter Stundenplan & Klassen einen Fachkurs anlegen.');const q=seq(qid);v184Flow={courseId:c.id,sequenceId:q?.id||'',newTitle:'',startDate:q?.startDate||'',endDate:q?.endDate||'',hours:q?.hours||'',instructions:'',step:0,prompt:'',raw:'',pkg:null,choices:{},overwrite:true};modal={type:'sequenceAiV184'};render();}
function v184CaptureSetup(){const f=v184Flow;f.courseId=document.getElementById('v184-course')?.value||f.courseId;f.sequenceId=document.getElementById('v184-sequence')?.value||'';f.newTitle=document.getElementById('v184-title')?.value.trim()||'';f.startDate=document.getElementById('v184-start')?.value||'';f.endDate=document.getElementById('v184-end')?.value||'';f.hours=document.getElementById('v184-hours')?.value||'';f.instructions=document.getElementById('v184-instructions')?.value.trim()||'';}
async function v184Copy(s,name){try{await navigator.clipboard.writeText(s);alert('Prompt kopiert – hier im Chat einfügen.');}catch{downloadText(name||'Schulcockpit_Reihenprompt.txt',s);alert('Die Zwischenablage war nicht verfügbar. Der Prompt wurde als Textdatei bereitgestellt.');}}
function v184ChoiceResolved(key){const [type,id]=String(key).split(':');if(type==='m')return {m:mat(id),e:null};if(type==='c')return {m:null,e:catalogEntryV17(id)};return {m:null,e:null};}
async function v184EnsureSelectedMaterial(d,cid,qid,uid){const {m:existing,e}=v184ChoiceResolved(d.selected);if(!existing&&!e)return null;let m=existing;if(e){if(!v184CourseMatchCatalog(e,cid))throw Error('Material aus einer anderen Klasse: '+e.fileName);m=state.materials.find(x=>x.catalogId===e.catalogId);if(!m){m={id:uidFuncV184('mat'),catalogId:e.catalogId,title:String(e.fileName).replace(/\.[^.]+$/,''),kind:'file',resourceType:e.resourceType==='digital'?'digital':e.resourceType==='teacher'?'teacher':'print',source:'Materialkatalog · '+(e.sourceArchive||''),variants:[],assignments:[],improvementFlags:[]};state.materials.push(m);}let v=(m.variants||[]).find(x=>x.type===(e.variantType||'standard'));
 if(!v){v={id:uidFuncV184('var'),type:e.variantType||'standard',label:variantLabelV15(e.variantType||'standard'),available:false,fileName:e.fileName,fileKey:null};m.variants.push(v);}if(!hasStoredFile(v)&&catalogAvailableV17(e)){try{const file=await catalogEntryFileV17(e);if(file){v.fileKey=v.fileKey||`material-${m.id}-${v.id}`;await fileStorePut(v.fileKey,file);storedFileKeys.add(v.fileKey);v.fileName=e.fileName;v.available=true;e.activatedMaterialId=m.id;}}catch(err){console.warn('Archivdatei noch nicht lesbar:',e.fileName,err);}}
 }
 if(!m)throw Error('Gewählte Materialreferenz nicht mehr vorhanden. Bitte Vorschau neu prüfen.');m.assignments=m.assignments||[];if(!m.assignments.some(a=>a.classId===cid&&a.unitId===uid))m.assignments.push({classId:cid,sequenceId:qid,unitId:uid});let v=(m.variants||[]).find(x=>x.id===m.primaryVariantIdV183)||(m.variants||[]).find(x=>x.fileName===e?.fileName)||(m.variants||[]).find(x=>x.type==='standard')||(m.variants||[])[0];return {material:m,variant:v||null,canonical:e?.fileName||v?.fileName||m.title,catalogId:e?.catalogId||m.catalogId||''};}
function uidFuncV184(p){return uid(p);}
function v184UnitMaterialText(u,decisions){return decisions.filter(x=>x.selection&&x.selection.canonical).map(x=>x.selection.canonical).concat(decisions.filter(x=>x.key==='reference').map(x=>x.item.title)).filter((v,i,a)=>a.indexOf(v)===i).join('\n');}
function v184AttachUnitLinks(l){if(!l||v182IsHeld(l)||concretePlanReadyV12(l)||l.v180MovedFrom||l.kind==='group')return;const q=seq(l.sequenceId),u=q?.plan?.find(x=>x.id===l.planReference?.unitId);if(!u)return;if(!concretePlanReadyV12(l)&&l.planReference)l.planReference.material=u.material||'';for(const ref of u.referenceMaterialsV184||[])setResourceTypeV14(l,ref.title,ref.kind==='book'?'reference':'activity');if(!u.materialLinksV184?.length)return;l.materials=l.materials||[];l.printPlan=l.printPlan||[];for(const link of u.materialLinksV184){const m=mat(link.materialId),v=variant(link.materialId,link.variantId);if(!m||!v)continue;if(!l.materials.includes(m.id))l.materials.push(m.id);const hint=link.canonical||m.title;if(link.kind==='digital'||link.kind==='source')setResourceTypeV14(l,hint,'digital');const b=resourceBundleV176(l,hint,true);b.title=link.displayTitle||hint;b.items=b.items||[];if(!b.items.some(x=>x.materialId===m.id&&x.variantId===v.id))b.items.push({id:uid('bundle'),materialId:m.id,variantId:v.id});b.complete=!!hasStoredFile(v);b._v183Manual=true;if(link.printMode!=='none'&&m.resourceType==='print'&&v.type!=='solution'){const p=ensurePlan(l,m.id,v.id);if(!p._v184configured){p.needed=!link.reuse;p.count=link.copies==='class'?Number(cls(l.classId)?.students)||0:Number(link.copies)||0;p.mode=link.printMode;p.alreadyPrinted=!!link.reuse;p._v14init=true;p._v184configured=true;}}}}
const v184OldAttachExact=attachExactPlanV11;attachExactPlanV11=function(l){const out=v184OldAttachExact(l);v184AttachUnitLinks(out);return out;};
async function v184Apply(){const f=v184Flow,pkg=f.pkg,c=cls(f.courseId);if(!pkg||!c)throw Error('Keine geprüfte Reihenplanung.');const existing=seq(f.sequenceId);if(existing&&existing.classId!==c.id)throw Error('Die Reihe gehört zu einem anderen Fachkurs.');const old={sequences:clone(state.sequences),lessons:clone(state.lessons),materials:clone(state.materials)};let created=0,updated=0,linked=0,unresolved=0;try{let q=existing;if(!q){q={id:uid('seq'),classId:c.id,title:pkg.sequence.title,startDate:'',endDate:'',goal:'',assessmentDate:'',notes:'',hours:'',plan:[]};state.sequences.push(q);}q.plan=q.plan||[];for(const k of ['startDate','endDate','goal','notes','hours'])if((f.overwrite||!q[k])&&pkg.sequence[k])q[k]=pkg.sequence[k];if(!existing)q.title=pkg.sequence.title;
 const usedIds=new Set();for(let i=0;i<pkg.units.length;i++){const input=pkg.units[i],candidate=v184FindTarget(q,input),prev=candidate&&!usedIds.has(candidate.id)?candidate:null;let u=prev;if(!u){u=cleanPlanUnitV10(input);q.plan.push(u);created++;}else{updated++;for(const k of ['title','plannedDate','hours','content','competencies','objective','homework','notes'])if((f.overwrite||!u[k])&&input[k])u[k]=input[k];}
 usedIds.add(u.id);const resolved=[];for(let j=0;j<input.materials.length;j++){const d=v184Decision(i,j),item=d.item;if(d.selected==='none')continue;if(item.kind==='book'||item.kind==='activity'){resolved.push({key:'reference',item});continue;}if(d.selected==='unresolved'){unresolved++;resolved.push({key:'unresolved',item});continue;}const hit=await v184EnsureSelectedMaterial(d,c.id,q.id,u.id);if(hit){linked++;resolved.push({key:d.selected,item,selection:hit});}else{unresolved++;resolved.push({key:'unresolved',item});}}
 const materialText=v184UnitMaterialText(input,resolved);if(f.overwrite||!u.material)u.material=materialText;u.materialLinksV184=resolved.filter(x=>x.selection?.variant).map(x=>({materialId:x.selection.material.id,variantId:x.selection.variant.id,catalogId:x.selection.catalogId,canonical:x.selection.canonical,displayTitle:x.item.title,printMode:x.item.printMode,copies:x.item.copies,reuse:x.item.reuse,kind:x.item.kind}));u.pendingMaterialReferencesV184=resolved.filter(x=>x.key==='unresolved').map(x=>({title:x.item.title,kind:x.item.kind,note:x.item.note,status:'not-matched'}));u.referenceMaterialsV184=resolved.filter(x=>x.key==='reference').map(x=>({title:x.item.title,kind:x.item.kind,note:x.item.note}));u.importedFromV184=new Date().toISOString();
 // Only refresh empty/unprepared actual slots; never revise held, shifted or prepared hours.
 for(const l of state.lessons.filter(l=>l.classId===c.id&&!v182IsHeld(l)&&!l.v180MovedFrom&&!concretePlanReadyV12(l)&&(l.planReference?.unitId===u.id||(!l.planReference?.unitId&&u.plannedDate&&l.date===u.plannedDate)))){l.sequenceId=q.id;l.unit=q.title;if(!l.title||l.title==='Thema noch festlegen')l.title=u.title;if(!l.objective)l.objective=u.objective;l.planReference={plannedDate:u.plannedDate,title:u.title,content:u.content,objective:u.objective,material:u.material,notes:u.notes,unitId:u.id,autoMatched:true};v184AttachUnitLinks(l);}
 }
 q.plan.sort((a,b)=>(a.plannedDate||'9999').localeCompare(b.plannedDate||'9999'));await saveState();return {qid:q.id,created,updated,linked,unresolved};}catch(err){state.sequences=old.sequences;state.lessons=old.lessons;state.materials=old.materials;saveState();throw err;}}
const v184OldSequences=sequencesView;sequencesView=function(){let html=v184OldSequences();const lead=`<section class="panel v184-hero"><div><span class="eyebrow">REIHENPLANUNG MIT CHATGPT</span><h2>Reihe planen → Antwort importieren → Materialien verbinden</h2><p>Direkt aus dem Cockpit. Der Prompt kennt die Planung und den Dateikatalog. Die Originalmaterialien gibst du separat hier im Chat dazu; erst ihre Inhalte bilden die Grundlage der Reihe.</p></div><button class="primary" data-v184-open>Neue Reihe / bestehende Reihe konkretisieren →</button></section>`;return html.replace('<div class="content-grid">','<div class="content-grid">'+lead);};
const v184OldPanel=sequencePanel;sequencePanel=function(q){let h=v184OldPanel(q);if(!q)return h;const missing=(q.plan||[]).reduce((n,u)=>n+(u.pendingMaterialReferencesV184||[]).length,0);const add=`<section class="detail-section v184-sequence-action"><h3>Diese Reihe mit ChatGPT weiterplanen</h3><p>${(q.plan||[]).length} Soll-Stunden · ${missing?missing+' noch ungeklärte Materialbezüge':'Materialbezüge können beim Import geprüft werden'}. Vorhandene Stunden werden ergänzt, nicht dupliziert.</p><button class="primary" data-v184-open-q="${q.id}">ChatGPT-Reihenplanung starten →</button></section>${missing?v184PendingHtml(q):''}`;const pos=h.lastIndexOf('</div>');return pos>=0?h.slice(0,pos)+add+h.slice(pos):h+add;};
function v184PendingHtml(q){const units=(q.plan||[]).filter(u=>u.pendingMaterialReferencesV184?.length);return `<section class="detail-section v184-pending"><h3>Noch ungeklärte Materialzuordnungen (${units.reduce((n,u)=>n+u.pendingMaterialReferencesV184.length,0)})</h3><p>Diese Namen erzeugen noch keinen Kopierauftrag. Bestätige die passende Datei oder lass den Eintrag ausdrücklich weg.</p>${units.map(u=>`<article class="v184-pending-unit"><strong>${esc(u.plannedDate||'Ohne Datum')} · ${esc(u.title)}</strong>${u.pendingMaterialReferencesV184.map((it,j)=>{const cands=v184MaterialCandidates({...it,kind:it.kind||'file',catalogId:''},q.classId);const seen=new Set(cands.map(x=>x.key));const all=v184CurrentCourseCatalog(q.classId).map(e=>{const m=state.materials.find(x=>x.catalogId===e.catalogId);return {key:m?'m:'+m.id:'c:'+e.catalogId,label:e.fileName}}).filter(x=>!seen.has(x.key));return `<div class="v184-pending-row"><span>${esc(it.title)}</span><select data-v184-resolve-select="${q.id}|${u.id}|${j}"><option value="unresolved">Noch offen</option><option value="none">In dieser Stunde nicht verwenden</option>${cands.map(c=>`<option value="${esc(c.key)}">Vorschlag · ${esc(c.label)}</option>`).join('')}${all.length?`<optgroup label="Alle weiteren Dateien dieses Fachkurses">${all.map(c=>`<option value="${esc(c.key)}">${esc(c.label)}</option>`).join('')}</optgroup>`:''}</select><button class="secondary" data-v184-resolve="${q.id}|${u.id}|${j}">Übernehmen</button></div>`;}).join('')}</article>`).join('')}</section>`;}
async function v184ResolvePending(qid,uidx,index,selection){const q=seq(qid),u=q?.plan?.find(x=>x.id===uidx),it=u?.pendingMaterialReferencesV184?.[index];if(!q||!u||!it)throw Error('Eintrag wurde verändert, bitte Ansicht neu öffnen.');if(selection==='unresolved')throw Error('Bitte eine Datei auswählen oder „nicht verwenden“.');if(selection!=='none'){const hit=await v184EnsureSelectedMaterial({selected:selection},q.classId,q.id,u.id);if(!hit?.variant)throw Error('Die gewählte Datei ist nicht mehr verfügbar.');const item={...it,kind:it.kind||'file'};u.materialLinksV184=u.materialLinksV184||[];if(!u.materialLinksV184.some(x=>x.materialId===hit.material.id&&x.variantId===hit.variant.id))u.materialLinksV184.push({materialId:hit.material.id,variantId:hit.variant.id,catalogId:hit.catalogId,canonical:hit.canonical,displayTitle:item.title,printMode:item.kind==='file'?'bw':'none',copies:item.kind==='file'?'class':0,reuse:false,kind:item.kind});u.material=[...(u.material||'').split('\n').filter(Boolean),hit.canonical].filter((x,i,a)=>a.indexOf(x)===i).join('\n');}u.pendingMaterialReferencesV184.splice(index,1);u.importedFromV184=new Date().toISOString();for(const l of state.lessons.filter(l=>l.sequenceId===qid&&l.planReference?.unitId===uidx&&!v182IsHeld(l)&&!concretePlanReadyV12(l)))v184AttachUnitLinks(l);saveState();}
const v184OldModal=modalHtml;modalHtml=function(){if(modal?.type==='sequenceAiV184')return v184ModalHtml();return v184OldModal();};
const v184OldWire=wire;wire=function(){v184OldWire();document.querySelector('[data-v184-open]')?.addEventListener('click',()=>v184Open());document.querySelectorAll('[data-v184-open-q]').forEach(b=>b.onclick=()=>v184Open(seq(b.dataset.v184OpenQ)?.classId,b.dataset.v184OpenQ));
 document.getElementById('v184-course')?.addEventListener('change',e=>{v184CaptureSetup();v184Flow.courseId=e.target.value;v184Flow.sequenceId='';v184Flow.newTitle='';v184Flow.startDate='';v184Flow.endDate='';v184Flow.hours='';render();});
 document.getElementById('v184-sequence')?.addEventListener('change',e=>{v184CaptureSetup();v184Flow.sequenceId=e.target.value;const q=seq(v184Flow.sequenceId);v184Flow.startDate=q?.startDate||'';v184Flow.endDate=q?.endDate||'';v184Flow.hours=q?.hours||'';render();});
 document.querySelector('[data-v184-prompt]')?.addEventListener('click',()=>{v184CaptureSetup();const q=seq(v184Flow.sequenceId);if(!q&&!v184Flow.newTitle)return alert('Bitte einen Reihentitel eintragen.');try{v184IsoDate(v184Flow.startDate);v184IsoDate(v184Flow.endDate);v184Flow.prompt=v184Prompt();v184Flow.step=1;render();}catch(err){alert(err.message||err);}});
 document.querySelector('[data-v184-copy]')?.addEventListener('click',()=>v184Copy(v184Flow.prompt,'Reihenplanung_ChatGPT_Prompt.txt'));
 document.querySelector('[data-v184-download-prompt]')?.addEventListener('click',()=>downloadText('Schulcockpit_Reihenplanung_Prompt.txt',v184Flow.prompt));
 document.querySelector('[data-v184-config]')?.addEventListener('click',()=>{v184Flow.raw=document.getElementById('v184-raw')?.value||v184Flow.raw;v184Flow.step=0;render();});
 document.querySelector('#v184-raw')?.addEventListener('input',e=>{v184Flow.raw=e.target.value;});
 document.querySelector('#v184-file')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;v184Flow.raw=await file.text();const t=document.getElementById('v184-raw');if(t)t.value=v184Flow.raw;});
 document.querySelector('[data-v184-parse]')?.addEventListener('click',()=>{v184Flow.raw=document.getElementById('v184-raw')?.value||v184Flow.raw;try{v184Flow.pkg=v184Extract(v184Flow.raw);v184Flow.choices={};v184Flow.step=2;render();}catch(err){alert('Reihenimport nicht lesbar: '+(err.message||err));}});
 document.querySelectorAll('[data-v184-choice]').forEach(s=>s.addEventListener('change',e=>{v184Flow.choices[e.target.dataset.v184Choice]=e.target.value;}));
 document.querySelector('#v184-overwrite')?.addEventListener('change',e=>{v184Flow.overwrite=e.target.checked;});
 document.querySelector('[data-v184-back]')?.addEventListener('click',()=>{v184Flow.step=1;render();});
 document.querySelectorAll('[data-v184-resolve]').forEach(b=>b.onclick=async()=>{const [qid,uidx,j]=b.dataset.v184Resolve.split('|');const sel=document.querySelector(`[data-v184-resolve-select=\"${b.dataset.v184Resolve}\"]`)?.value||'unresolved';try{await v184ResolvePending(qid,uidx,Number(j),sel);render();}catch(err){alert(err.message||err);}});
 document.querySelector('[data-v184-apply]')?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;b.textContent='Sollplan und Materialbezüge speichern …';try{const r=await v184Apply();modal={type:'sequence',id:r.qid};render();alert(`${r.created} neue Soll-Stunden, ${r.updated} vorhandene ergänzt; ${r.linked} bestätigte Datei-Bezüge, ${r.unresolved} noch ungeklärte. Nur eindeutige Dateien wurden verbunden; bereits gehaltene und ausgearbeitete Stunden bleiben bestehen.`);}catch(err){console.error(err);b.disabled=false;b.textContent='Reihenplanung verbindlich übernehmen →';alert('Import abgebrochen: '+(err.message||err));}});
};
const v184OldRender=render;render=function(){v184OldRender();const v=document.querySelector('.brand small');if(v)v.textContent=`${state.settings.schoolYear} · ${V184_VERSION}`;};
render();


/* ===== V0.18.5 – fehlertolerante Übernahme des konkreten Stundenimports =====
   Ältere/verschobene Stunden können printPlan/materials als null enthalten.
   Das ursprüngliche Verfahren hat Teile des Imports verändert und dann ohne
   sichtbare Meldung beim Anlegen der Druckposition abgebrochen.
   Keine Änderung am Storage-Key oder an vorhandenen Unterrichtsdaten. */
const v185EnsurePlanPrevious=ensurePlan;
ensurePlan=function(l,mid,vid){
  if(!Array.isArray(l.printPlan))l.printPlan=[];
  return v185EnsurePlanPrevious(l,mid,vid);
};
const v185ApplyMaterialPrevious=applyImportedMaterial;
applyImportedMaterial=function(l,item){
  if(!Array.isArray(l.materials))l.materials=[];
  if(!Array.isArray(l.printPlan))l.printPlan=[];
  const existing=findMaterialForImport(item);
  if(existing&&!Array.isArray(existing.variants))existing.variants=[];
  return v185ApplyMaterialPrevious(l,item);
};
function v185RestoreObject(target,snapshot){
  for(const k of Object.keys(target))delete target[k];
  Object.assign(target,snapshot);
}
async function v185ApplyWizardAnswer(event){
  event.preventDefault();
  const btn=event.currentTarget,l=wizardLessonV14();
  if(!l){alert('Die ausgewählte Stunde existiert nicht mehr. Bitte die Stundenansicht erneut öffnen.');return;}
  // Immer das aktuelle Textfeld prüfen – eine nach der Vorschau bearbeitete Antwort
  // darf nicht versehentlich als ältere Vorschau gespeichert werden.
  const raw=document.getElementById('v14-answer')?.value||wizardV14.raw||'';
  let pkg;
  try{pkg=parseAiImport(raw);}catch(error){
    wizardV14.raw=raw;wizardV14.errorKind='parse';wizardV14.error=String(error.message||error);
    wizardV14.parsed=null;render();return;
  }
  if(btn.disabled)return;
  btn.disabled=true;
  btn.textContent='Stunde wird übernommen …';
  const beforeLesson=clone(l),beforeMaterials=clone(state.materials);
  let saved=false;
  try{
    l.materials=Array.isArray(l.materials)?l.materials:[];
    l.printPlan=Array.isArray(l.printPlan)?l.printPlan:[];
    l.prepTasks=Array.isArray(l.prepTasks)?l.prepTasks:[];
    applyAiPackage(l,pkg,{lesson:true,phases:true,slides:true,materials:true,prep:true,status:true});
    await saveState(); // Do not mark the lesson complete before IndexedDB confirms its transaction.
    saved=true;
  }catch(error){
    console.error('Schulcockpit: Stundenübernahme abgebrochen',error);
    v185RestoreObject(l,beforeLesson);state.materials=beforeMaterials;
    wizardV14.raw=raw;wizardV14.parsed=pkg;wizardV14.errorKind='save';
    wizardV14.error=error?.name==='QuotaExceededError'
      ?'Der lokale Browser-Speicher ist voll. Die Übernahme wurde zurückgesetzt. Bitte ein Backup herunterladen und die lokale Speicherkapazität prüfen.'
      :'Die Übernahme wurde abgebrochen und zurückgesetzt: '+String(error.message||error);
    try{render();}catch(renderError){console.error('Schulcockpit: Fehleransicht',renderError);alert(wizardV14.error);}
    return;
  }
  if(saved){
    wizardV14.raw=raw;wizardV14.parsed=null;wizardV14.error='';wizardV14.errorKind='';wizardV14.step=4;
    try{render();}catch(error){
      console.error('Schulcockpit: Stunde gespeichert, Ansicht konnte nicht aktualisiert werden',error);
      alert('Die Unterrichtsplanung wurde gespeichert, aber die PowerPoint-Ansicht konnte nicht angezeigt werden: '+String(error.message||error)+'\nBitte die Seite neu laden und die Stunde erneut öffnen.');
    }
  }
}


/* ===== V0.18.6 – durable browser state in IndexedDB =====
   The full lesson/sequence/material/backlog state no longer belongs in the
   ~5 MB localStorage record. Migrate *before* shortening that old record.
   Files and the existing catalog remain in their original IndexedDB database.
*/
const V186_VERSION='V0.18.6';
const V186_DB='schulcockpit-state-v2',V186_STORE='snapshots',V186_ID='main';
let v186Ready=false,v186Migrated=false,v186Writing=false,v186Pending=null,v186Waiters=[],v186StorageError=null;

function v186OpenDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(V186_DB,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(V186_STORE))req.result.createObjectStore(V186_STORE,{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('IndexedDB konnte nicht geöffnet werden.'));
    req.onblocked=()=>reject(new Error('Eine andere Schulcockpit-Seite blockiert die Aktualisierung des Datenspeichers. Bitte andere Tabs schließen.'));
  });
}
async function v186DbGet(){
  const db=await v186OpenDB();
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction(V186_STORE,'readonly');const req=tx.objectStore(V186_STORE).get(V186_ID);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}
  finally{db.close();}
}
async function v186DbPut(serialized){
  const db=await v186OpenDB();
  try{await new Promise((resolve,reject)=>{const tx=db.transaction(V186_STORE,'readwrite');tx.objectStore(V186_STORE).put({id:V186_ID,json:serialized,updatedAt:new Date().toISOString()});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('Die Datenbank-Transaktion wurde abgebrochen.'));tx.onerror=()=>reject(tx.error);});}
  finally{db.close();}
}
function v186Snapshot(){const slim={...state};delete slim.materialCatalog;return JSON.stringify(slim);}
function v186CompactPointer(){return JSON.stringify({__schulcockpitStorage:'indexeddb-v2',settings:{schoolYear:state.settings?.schoolYear||'2026/27',activeWeekStart:state.settings?.activeWeekStart||''},classes:[],timetable:[],sequences:[],materials:[],lessons:[],backlog:[],tasks:[]});}
function v186ShrinkLegacy(){
  // An IndexedDB commit is already complete whenever this is called. The old
  // localStorage copy is only replaced now, never before a verified commit.
  localStorage.setItem(STORAGE_KEY,v186CompactPointer());
}
function v186StorageAlert(err){
  v186StorageError=err;
  console.error('Schulcockpit: Planungsdaten konnten nicht dauerhaft gespeichert werden',err);
  let el=document.getElementById('v186-storage-warning');
  if(!el){el=document.createElement('div');el.id='v186-storage-warning';document.body.appendChild(el);}
  el.innerHTML='<strong>Speichern fehlgeschlagen.</strong> Die aktuelle Änderung ist möglicherweise nur im Arbeitsspeicher. Bitte nicht schließen, sondern sofort ein Backup herunterladen. <button type="button" id="v186-emergency-export">Backup herunterladen</button> <button type="button" id="v186-emergency-retry">Speichern erneut versuchen</button>';
  document.getElementById('v186-emergency-export').onclick=()=>downloadText('Schulcockpit_Notfallbackup_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(state,null,2),'application/json');
  document.getElementById('v186-emergency-retry').onclick=()=>saveState().then(()=>{el.remove();v186StorageError=null;}).catch(()=>{});
}
async function v186Flush(){
  if(v186Writing)return;
  v186Writing=true;
  try{
    while(v186Pending!==null){
      const raw=v186Pending,waiters=v186Waiters.splice(0);v186Pending=null;
      try{
        await v186DbPut(raw);
        if(!v186Migrated){
          try{v186ShrinkLegacy();}catch(error){console.warn('Legacy copy was kept after a successful IndexedDB commit.',error);}
          v186Migrated=true;
        }
        waiters.forEach(x=>x.resolve());
      }catch(err){waiters.forEach(x=>x.reject(err));}
    }
  }finally{v186Writing=false;}
}
// Returns an awaitable promise for sensitive imports. Existing synchronous
// UI handlers are compatible; unsaved changes trigger an unmistakable warning.
saveState=function(){
  if(!v186Ready)return Promise.resolve();
  let raw;try{raw=v186Snapshot();}catch(err){v186StorageAlert(err);return Promise.reject(err);}
  const result=new Promise((resolve,reject)=>{
    v186Pending=raw;v186Waiters.push({resolve,reject});
    if(!v186Writing)Promise.resolve().then(v186Flush);
  });
  result.catch(v186StorageAlert); // prevent silent data loss for older handlers
  if((state.materialCatalog||[]).length)scheduleCatalogPersistV171();
  return result;
};

// If hydration/migration fails, prevent usage of the temporary empty state.
function v186BootFailure(err){
  v186StorageError=err;
  console.error('Schulcockpit: sichere Datenmigration fehlgeschlagen',err);
  const overlay=document.getElementById('sc-v186-load');
  if(!overlay)return;
  overlay.innerHTML='<section class="sc-v186-loader-card"><h2>Planungsdaten konnten nicht geladen werden</h2><p>Deine vorhandenen Daten werden nicht gelöscht. Bitte weder Browserdaten löschen noch neue Stunden anlegen.</p><p id="sc-v186-error"></p><button id="sc-v186-retry">Erneut versuchen</button> <button id="sc-v186-export">Vorhandene Daten sichern</button></section>';
  document.getElementById('sc-v186-error').textContent=String(err?.message||err);
  document.getElementById('sc-v186-retry').onclick=()=>location.reload();
  document.getElementById('sc-v186-export').onclick=()=>{
    const legacy=localStorage.getItem(STORAGE_KEY);
    const hasLegacy=legacy&&!JSON.parse(legacy).__schulcockpitStorage;
    const payload=hasLegacy?legacy:JSON.stringify(state,null,2);
    downloadText('Schulcockpit_Rettung_vor_Migration.json',payload,'application/json');
  };
}
async function v186Boot(){
  try{
    const record=await v186DbGet();
    if(record?.json){
      const loaded=JSON.parse(record.json);
      if(!Array.isArray(loaded.lessons)||!Array.isArray(loaded.sequences))throw new Error('Die gespeicherten Planungsdaten haben ein unerwartetes Format.');
      state=migrateV06(migrate(loaded));
      v186Migrated=true;
      try{if((localStorage.getItem(STORAGE_KEY)||'').length>2000)v186ShrinkLegacy();}
      catch(error){console.warn('IndexedDB is authoritative; legacy storage could not be compacted.',error);}
    }else{
      // Upgrade from v0.18.5: keep the existing state and legacy storage intact
      // until the *whole* dataset has been committed to IndexedDB.
      const legacy=localStorage.getItem(STORAGE_KEY);
      const legacyObj=legacy?JSON.parse(legacy):null;
      if(legacyObj?.__schulcockpitStorage)throw new Error('Nur ein Speicherverweis gefunden, aber keine Planungsdaten in IndexedDB. Bitte ein vorhandenes Backup verwenden.');
      // `state` already contains the boot-time migration and in-memory changes
      // made by existing setup code; do not replace it with an older snapshot.
      await v186DbPut(v186Snapshot());
      try{v186ShrinkLegacy();}catch(error){console.warn('State safely migrated, but the old localStorage copy remains.',error);}
      v186Migrated=true;
    }
    window.LifeRPGSchoolBridge?.baseline?.(state);
    v186Ready=true;
    // The catalog lives in the OLD files DB. Reload after the state is hydrated.
    catalogLoadStartedV171=false;
    await loadCatalogV171();
    await refreshStoredFileKeys();
    const overlay=document.getElementById('sc-v186-load');if(overlay)overlay.remove();
    render();
  }catch(err){v186BootFailure(err);}
}
const v186PrevRender=render;
render=function(){v186PrevRender();const version=document.querySelector('.brand small');if(version)version.textContent=`${state.settings.schoolYear} · ${V186_VERSION}`;};


// V0.18.7: Source-based sequence planning (Chat uploads remain separate from the local catalog).
// Neither the material ZIP blobs nor private PDFs are copied into a generated prompt or GitHub.
const V187_VERSION='V0.18.7';
const v187OldOpen=v184Open;
v184Open=function(courseId='',qid=''){
  v187OldOpen(courseId,qid);
  v184Flow.materialSourceNames='';
};
const v187OldCapture=v184CaptureSetup;
v184CaptureSetup=function(){
  // The previous setup capturer intentionally ignores this new, optional field.
  const node=document.getElementById('v187-material-source-names');
  if(node)v184Flow.materialSourceNames=node.value.trim().slice(0,1800);
  v187OldCapture();
};
const v187OldPrompt=v184Prompt;
v184Prompt=function(){
  let text=v187OldPrompt();
  const sourceNames=v184Flow.materialSourceNames?.trim()||'Noch nicht benannt – ich werde die zu verwendenden ZIPs, Ordner oder Einzeldateien direkt an diese Chat-Nachricht anhängen.';
  const grounding=`## VERBINDLICHE MATERIALGRUNDLAGE – ANHÄNGE IN DIESEM CHAT\n
Die folgende Materialsammlung wird zusätzlich zu diesem Prompt im Chat hochgeladen: ${sourceNames}

WICHTIG: Das Schulcockpit kann ausschließlich seinen lokal katalogisierten Metadaten- und Dateibestand in diesen kopierten Prompt schreiben. Es überträgt KEINE Originaldateien an ChatGPT. Die von mir im Chat hochgeladenen ZIPs, PDFs, DOC/DOCX-Dateien, Präsentationen oder Bilder sind die tatsächliche Arbeitsgrundlage. Behandele Dateinamen im Katalog nur als Abgleichhilfe, nicht als Ersatz für das Lesen des Inhalts.

Wenn die angekündigten Materialien noch nicht in dieser Unterhaltung angekommen sind oder der Upload aus mehreren Nachrichten besteht, frage zunächst nach den Dateien bzw. warte auf meine Bestätigung „Materialien vollständig“. Erstelle vor dem Sichtungsabschluss KEINEN fertigen Reihenplan und KEINEN Importblock. Wenn ich ausdrücklich „Keine Dateien vorhanden“ angebe, plane nur auf Basis der belegten Vorgaben und kennzeichne neu zu erstellende Materialien als fehlend.

Nach vollständigem Upload:
1. Inventarisiere die tatsächlich verfügbaren Dateien anhand von Archiv-/Ordnerpfad und Originaldateiname. Ignoriere macOS-Metadaten. Lies die relevanten Arbeitsblätter und Texte inhaltlich, beurteile ihre Aufgaben und ordne Lösungen, Lehrkraftmaterial und verschiedene Versionen gesondert ein. Ein PDF und eine DOCX desselben Blatts sind Fassungen eines Materials, nicht zwei Pflichtarbeitsblätter.
2. Entwickle von diesen Materialien aus eine didaktisch nachvollziehbare Reihenfolge für die vorhandene Unterrichtszeit und Lerngruppe. Du darfst Materialien anders anordnen, bündeln, als Alternativen vorsehen oder bewusst nicht verwenden. Begründe Abweichungen von der bisherigen Grobplanung. Inhalte und Materialien nicht erfinden; Lücken, nötige Eigenentwicklungen und ungeeignete Blätter ausdrücklich kennzeichnen.
3. Weise jeder Stunde die konkret verwendeten Originaldateien zu. Für jeden Dateieintrag: exakten Originaldateinamen in title, wenn verfügbar exakten Archivnamen in sourceArchive und Originalpfad innerhalb des Archivs in sourcePath. Eine exakte katalogisierte ID nur übernehmen, wenn die Datei tatsächlich mit derselben Datei im untenstehenden Katalog identifiziert wurde; sonst catalogId als leeren String lassen. Keine unsichere Namensähnlichkeit als sichere Zuordnung ausgeben (insbesondere Nummern wie 03/04 dürfen nicht vertauscht werden).
4. Unterscheide aktiv verwendete Druckdateien, wiederverwendete/ bereits kopierte Dateien (reuse=true), Buch- oder Arbeitsheftaufgaben, digitale Medien, Lehrkraftquellen, Lösungen und Alternativen. Nicht verwendete Dateien nicht als Pflicht-Druckauftrag eintragen. Falls eine Datei nur im Chat vorliegt und noch nicht im lokalen Schulcockpit ist, bleibt ihre Verknüpfung dort zunächst offen; ich kann sie später hochladen.
5. Den Materialbezug im Import-JSON über units[].materials[] erhalten. Die bisherigen Felder und das Schema schulcockpit.sequence.v1 beibehalten. sourceArchive und sourcePath sind optionale zusätzliche Textfelder für die verlässliche Dateizuordnung; materials darf auch [] sein. Fasse Varianten in note zusammen, statt für jede Fassung einen identischen Pflichtdruckauftrag zu erzeugen.

Die Dateien werden in DIESEM Chat angehängt; die Prompt-Zeile allein beweist NICHT, dass sie vorliegen. Gib bei der Planung kurz an, welche hochgeladenen Materialien du tatsächlich auswerten konntest und welche eventuell fehlten.
`;
  text=text.replace('## Auftrag\n',grounding+'\n## Auftrag\n');
  text=text.replace('Keine nicht belegten Materialien oder Unterrichtsinhalte erfinden.','Die tatsächlichen hochgeladenen Materialien inhaltlich als primäre Quelle nutzen, den Katalog nur zur Identitätsprüfung heranziehen; keine nicht belegten Materialien oder Unterrichtsinhalte erfinden.');
  text=text.replace('"catalogId": "cat_...", "variant":','"catalogId": "cat_...", "sourceArchive": "Original.zip", "sourcePath": "Original.zip/Ordner/Originaldatei.pdf", "variant":');
  return text;
};
const v187OldModal=v184ModalHtml;
v184ModalHtml=function(){
  let h=v187OldModal();
  if(v184Flow.step===0){
    const match='<p>Hier entsteht die eigentliche Reihenplanung – ohne Zwischenschritt über „Mein Schulplan“.</p>';
    const insert=`<p>Hier entsteht deine materialgestützte Reihenplanung – ohne Zwischenschritt über „Mein Schulplan“.</p><div class="v187-source-guide"><strong>Materialien bilden die Grundlage</strong><p>Lege fest, welche Sammlungen du hier im Chat hochlädst. Das Cockpit kann deinen lokalen Materialkatalog nennen, aber nicht die Inhalte der Dateien automatisch an ChatGPT übertragen.</p><label>ZIPs / Ordner / Dateien, die ich im Chat beilege (optional)<textarea id="v187-material-source-names" rows="3" placeholder="z. B. 11. Jahrgang.zip oder einzelne Arbeitsblätter der Reihe">${esc(v184Flow.materialSourceNames||'')}</textarea></label><small>Bei großen Sammlungen mehrere Uploads sind okay. Nach dem letzten Upload „Materialien vollständig“ schreiben.</small></div>`;
    h=h.replace(match,insert);
  }
  if(v184Flow.step===1){
    const match='<div class="v184-step"><p>1. Prompt kopieren und im Chat verwenden. 2. Die ganze Antwort hier einfügen. Alternativ die Antwort als Datei öffnen.</p>';
    const insert=`<div class="v184-step"><div class="v187-source-guide"><strong>So planst du aus deinen echten Materialien</strong><ol><li>Prompt kopieren und hier an ChatGPT schicken.</li><li>Die tatsächlichen ZIPs / PDFs / DOCX / Präsentationen als Anhänge in diesem Chat hochladen – sie werden <strong>nicht</strong> durch den Prompt übertragen.</li><li>Bei mehreren Nachrichten zuletzt „Materialien vollständig“ schreiben. Erst dann aus den gelesenen Dateien eine Reihe erstellen lassen.</li><li>Die komplette Antwort oder die JSON-Datei unten ins Cockpit übernehmen.</li></ol><small>Der Katalog dient anschließend zur Wiedererkennung deiner Originaldateien. Nicht gefundene Dateien werden nicht als vorhandener Druckauftrag ausgegeben.</small></div>`;
    h=h.replace(match,insert);
  }
  return h;
};
// Preserve exact archive paths from ChatGPT's source-grounded import, while leaving
// existing v1 imports valid and preventing silent 03/04 filename mismatches.
const v187OldNormalize=v184Normalize;
v184Normalize=function(x){
  const pkg=v187OldNormalize(x);
  pkg.units.forEach((u,i)=>u.materials.forEach((m,j)=>{
    const src=x.units?.[i]?.materials?.[j]||{};
    m.sourceArchive=v184Text(src.sourceArchive||'',300);
    m.sourcePath=v184Text(src.sourcePath||'',850);
  }));
  return pkg;
};
function v187Path(s){return String(s||'').normalize('NFC').replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\/+|\/+$/g,'').toLocaleLowerCase('de-DE');}
const v187OldCandidates=v184MaterialCandidates;
v184MaterialCandidates=function(item,cid){
  const base=v187OldCandidates(item,cid);
  if(!item.sourcePath)return base;
  const wanted=v187Path(item.sourcePath),archive=v187Path(item.sourceArchive);
  const exact=v184CurrentCourseCatalog(cid).filter(e=>v187Path(e.sourcePath)===wanted&&(!archive||v187Path(e.sourceArchive)===archive)&&v184NumbersMatch(item.title,e.fileName));
  const extras=exact.map(e=>{const m=state.materials.find(x=>x.catalogId===e.catalogId);return {key:m?'m:'+m.id:'c:'+e.catalogId,e,m,label:e.fileName+(catalogAvailableV17(e)?' · Archiv verbunden':' · Archiv fehlt'),score:1.1};});
  return extras.concat(base.filter(a=>!extras.some(b=>b.key===a.key))).slice(0,12);
};
const v187OldDefaultChoice=v184DefaultChoice;
v184DefaultChoice=function(item,candidates,cid){
  if(item.sourcePath&&['file','digital','source'].includes(item.kind)){
    const wanted=v187Path(item.sourcePath),archive=v187Path(item.sourceArchive);
    const exact=candidates.filter(x=>x.e&&v187Path(x.e.sourcePath)===wanted&&(!archive||v187Path(x.e.sourceArchive)===archive)&&v184NumbersMatch(item.title,x.e.fileName));
    if(exact.length===1)return exact[0].key;
  }
  return v187OldDefaultChoice(item,candidates,cid);
};
const v187OldRender=render;
render=function(){v187OldRender();const v=document.querySelector('.brand small');if(v)v.textContent=`${state.settings.schoolYear} · ${V187_VERSION}`;};


/* ===== V0.18.8 – Reihen löschen + feste Leistungsnachweise =====
   Klassenarbeiten/Klausuren sind eigenständige, feste Kurstermine und keine
   Eigenschaft einer Unterrichtsreihe. Prüfungsdateien liegen lokal in IndexedDB.
   Planungs-Prompts kennen Termine und Dateinamen; Dateiinhalte müssen weiterhin
   explizit im Chat hochgeladen werden, bevor ChatGPT sie inhaltlich auswertet. */
const V188_VERSION='V0.18.8';
let v188AssessmentDraft=null;

function v188EnsureState(){
  if(!Array.isArray(state.assessments))state.assessments=[];
  if(!state.settings)v188Noop();
  // Alte reihengebundene Leistungstermine einmalig in den unabhängigen Bereich spiegeln.
  for(const q of state.sequences||[]){
    if(!q?.assessmentDate)continue;
    const exists=state.assessments.some(a=>a.classId===q.classId&&a.date===q.assessmentDate&&a.legacySequenceId===q.id);
    if(!exists)state.assessments.push({id:uid('assess'),classId:q.classId,date:q.assessmentDate,type:'Klassenarbeit',title:'Klassenarbeit',scope:'',notes:`Aus älterer Reihenplanung „${q.title||''}“ übernommen.`,files:[],legacySequenceId:q.id,createdAt:new Date().toISOString()});
    // Ab jetzt ist der Termin ausschließlich im unabhängigen Prüfungsbereich führend.
    q.assessmentDate='';
  }
}
function v188Noop(){}
function v188Assessments(cid=''){
  v188EnsureState();
  return (state.assessments||[]).filter(a=>!cid||a.classId===cid).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.title||'').localeCompare(b.title||''));
}
function v188DateShift(s,days){if(!s)return '';const d=new Date(s+'T12:00:00');if(!Number.isFinite(d.getTime()))return '';d.setDate(d.getDate()+days);return iso(d);}
function v188RelevantAssessments(cid,start='',end='',fromLesson=''){
  let arr=v188Assessments(cid);
  if(fromLesson){arr=arr.filter(a=>a.date>=fromLesson).slice(0,3);return arr;}
  if(start||end){const lo=start?v188DateShift(start,-7):'',hi=end?v188DateShift(end,28):'';arr=arr.filter(a=>(!lo||a.date>=lo)&&(!hi||a.date<=hi));}
  else {const today=iso(new Date());const future=arr.filter(a=>a.date>=today);arr=(future.length?future:arr.slice(-4)).slice(0,8);}
  return arr;
}
function v188AssessmentLabel(a){return `${a.type||'Leistungsnachweis'}${a.title&&a.title!==(a.type||'')?' · '+a.title:''}`;}
function v188AssessmentPromptLines(list){
  if(!list.length)return '- keine festen Leistungsnachweise im relevanten Zeitraum eingetragen';
  return list.map(a=>`- ${a.date} · ${v188AssessmentLabel(a)}${a.scope?`\n  Prüfungsstoff/Schwerpunkt: ${a.scope}`:''}${a.notes?`\n  Hinweis: ${a.notes}`:''}${(a.files||[]).length?`\n  Lokal hinterlegte Prüfungsdateien: ${(a.files||[]).map(f=>f.name).join(', ')} (Inhalt nur berücksichtigen, wenn diese Dateien zusätzlich in diesem Chat hochgeladen wurden.)`:'\n  Keine Prüfungsdatei hinterlegt.'}`).join('\n');
}
function v188AssessmentPanel(){
  const list=v188Assessments();
  const rows=list.map(a=>{const c=cls(a.classId),fc=(a.files||[]).length;return `<article class="v188-assessment-card"><div class="v188-assessment-date"><strong>${esc(fmtDate(a.date))}</strong><small>${esc(a.type||'Leistung')}</small></div><div class="v188-assessment-main"><span class="eyebrow">${esc(c?.subject||'')} ${esc(c?.name||'')}</span><h3>${esc(a.title||a.type||'Leistungsnachweis')}</h3><p>${esc(a.scope||'Prüfungsstoff noch nicht notiert.')}</p><small>${fc?`${fc} Prüfungsdatei${fc===1?'':'en'} lokal hinterlegt`:'Noch keine Prüfungsdatei hinterlegt'}</small></div><div class="v188-assessment-actions"><button class="secondary" data-v188-assessment-edit="${a.id}">Bearbeiten</button>${fc?`<button class="text-button" data-v188-assessment-bundle="${a.id}">Dateien für ChatGPT</button>`:''}<button class="danger-lite" data-v188-assessment-delete="${a.id}">Löschen</button></div></article>`;}).join('');
  return `<section class="panel v188-assessment-panel"><div class="section-head"><div><span class="eyebrow">FESTE TERMINE · UNABHÄNGIG VON REIHEN</span><h2>Klassenarbeiten & Klausuren</h2><p>Diese Termine bleiben bestehen, auch wenn Reihen verschoben, konkretisiert oder gelöscht werden. Sie werden automatisch in Reihen- und Stunden-Prompts berücksichtigt.</p></div><button class="primary" data-v188-assessment-new>+ Termin eintragen</button></div><div class="v188-assessment-list">${rows||'<p class="muted">Noch keine festen Leistungsnachweise eingetragen.</p>'}</div></section>`;
}
function v188OpenAssessment(id=''){
  v188EnsureState();
  const a=state.assessments.find(x=>x.id===id);
  const first=state.classes.find(c=>c.subject&&!/^ga$/i.test(c.subject));
  v188AssessmentDraft=a?{...a,files:(a.files||[]).map(x=>({...x})),pendingFiles:[],removeKeys:[]}:{id:'',classId:first?.id||'',date:'',type:'Klassenarbeit',title:'Klassenarbeit',scope:'',notes:'',files:[],pendingFiles:[],removeKeys:[]};
  modal={type:'assessmentV188'};render();
}
function v188AssessmentModal(){
  const a=v188AssessmentDraft||{};
  const current=(a.files||[]).map(f=>`<div class="v188-file-row"><span><strong>${esc(f.name)}</strong><small>lokal gespeichert</small></span><div><button class="text-button" data-v188-assessment-file-open="${esc(f.fileKey)}">Öffnen</button><button class="danger-lite small" data-v188-assessment-file-remove="${esc(f.id)}">×</button></div></div>`).join('');
  const pending=(a.pendingFiles||[]).map((f,i)=>`<div class="v188-file-row pending"><span><strong>${esc(f.name)}</strong><small>wird beim Speichern lokal hinterlegt</small></span><button class="danger-lite small" data-v188-assessment-pending-remove="${i}">×</button></div>`).join('');
  return `<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide" data-modal-stop><header class="modal-header"><div><span class="eyebrow">FESTER LEISTUNGSTERMIN</span><h2>${a.id?'Klassenarbeit / Klausur bearbeiten':'Klassenarbeit / Klausur eintragen'}</h2></div><button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body"><section class="detail-section"><div class="lesson-edit-grid"><label>Fachkurs<select id="v188-assessment-class">${state.classes.filter(c=>c.subject&&!/^ga$/i.test(c.subject)).map(c=>`<option value="${c.id}" ${c.id===a.classId?'selected':''}>${esc(c.subject)} ${esc(c.name)}</option>`).join('')}</select></label><label>Art<select id="v188-assessment-type">${['Klassenarbeit','Klausur','Test','Lernkontrolle','Ersatzleistung','Sonstiger Leistungsnachweis'].map(x=>`<option ${x===a.type?'selected':''}>${x}</option>`).join('')}</select></label><label>Festes Datum<input id="v188-assessment-date" type="date" value="${esc(a.date||'')}"></label><label>Titel<input id="v188-assessment-title" value="${esc(a.title||'')}"></label><label class="full">Prüfungsstoff / Schwerpunkt<textarea id="v188-assessment-scope" rows="4" placeholder="z. B. Vier Edle Wahrheiten, Achtfacher Pfad, Nirwana …">${esc(a.scope||'')}</textarea></label><label class="full">Hinweise<textarea id="v188-assessment-notes" rows="3" placeholder="optional, z. B. Wiederholungsstunde davor einplanen">${esc(a.notes||'')}</textarea></label></div></section><section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">PRÜFUNGSDATEIEN</span><h3>Eine oder mehrere Arbeiten hinterlegen</h3></div><label class="upload-button">Dateien hinzufügen<input id="v188-assessment-files" type="file" multiple hidden></label></div><p class="muted">Die Dateien bleiben lokal im Browser. Die Planungs-Prompts nennen sie; für eine inhaltliche Analyse lädst du sie zusammen mit dem Prompt hier im Chat hoch.</p><div class="v188-assessment-files">${current}${pending||(!current?'<p class="muted">Noch keine Datei ausgewählt.</p>':'')}</div></section><div class="v188-modal-actions"><button class="secondary" data-action="modal-close">Abbrechen</button><button class="primary" data-v188-assessment-save>Speichern</button></div></div></section></div>`;
}
function v188ReadAssessmentDraft(){
  const a=v188AssessmentDraft;if(!a)return;
  a.classId=document.getElementById('v188-assessment-class')?.value||a.classId;
  a.type=document.getElementById('v188-assessment-type')?.value||a.type;
  a.date=document.getElementById('v188-assessment-date')?.value||'';
  a.title=document.getElementById('v188-assessment-title')?.value.trim()||a.type||'Leistungsnachweis';
  a.scope=document.getElementById('v188-assessment-scope')?.value.trim()||'';
  a.notes=document.getElementById('v188-assessment-notes')?.value.trim()||'';
}
async function v188SaveAssessment(){
  v188ReadAssessmentDraft();const a=v188AssessmentDraft;if(!a?.classId)throw Error('Bitte einen Fachkurs auswählen.');if(!a.date)throw Error('Bitte das feste Datum eintragen.');v184IsoDate(a.date);
  const dup=(state.assessments||[]).find(x=>x.id!==a.id&&x.classId===a.classId&&x.date===a.date&&v187Path(x.title)===v187Path(a.title));if(dup&&!confirm('Für diesen Kurs existiert am selben Datum bereits ein gleichnamiger Leistungsnachweis. Trotzdem zusätzlich speichern?'))return false;
  const id=a.id||uid('assess');
  for(const key of a.removeKeys||[]){try{await fileStoreDelete(key);storedFileKeys.delete(key);}catch(e){console.warn(e);}}
  const files=(a.files||[]).map(x=>({...x}));
  for(const f of a.pendingFiles||[]){const fid=uid('afile'),key=`assessment-${id}-${fid}`;await fileStorePut(key,f);storedFileKeys.add(key);files.push({id:fid,name:f.name,type:f.type||'',size:f.size||0,fileKey:key,addedAt:new Date().toISOString()});}
  const out={id,classId:a.classId,date:a.date,type:a.type,title:a.title||a.type,scope:a.scope,notes:a.notes,files,createdAt:a.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),legacySequenceId:a.legacySequenceId||''};
  const i=state.assessments.findIndex(x=>x.id===id);if(i>=0)state.assessments[i]=out;else state.assessments.push(out);
  await saveState();v188AssessmentDraft=null;modal=null;view='sequences';render();return true;
}
async function v188DeleteAssessment(id){
  const a=(state.assessments||[]).find(x=>x.id===id);if(!a)return;if(!confirm(`${v188AssessmentLabel(a)} am ${fmtDate(a.date)} wirklich löschen? Hinterlegte lokale Prüfungsdateien werden ebenfalls aus dem Browser entfernt.`))return;
  for(const f of a.files||[]){try{await fileStoreDelete(f.fileKey);storedFileKeys.delete(f.fileKey);}catch(e){console.warn(e);}}
  state.assessments=state.assessments.filter(x=>x.id!==id);await saveState();render();
}
async function v188DownloadAssessmentFiles(list,name='Pruefungsdateien.zip'){
  const files=[];for(const a of list||[])for(const f of a.files||[]){const rec=await fileStoreGet(f.fileKey);if(rec?.blob)files.push({a,f,rec});}
  if(!files.length)return alert('Für diese Auswahl sind keine lokalen Prüfungsdateien hinterlegt.');
  const zipFile=new JSZip();const used=new Set();
  for(const {a,f,rec} of files){let base=`${a.date}_${(cls(a.classId)?.subject||'Fach').replace(/[^A-Za-z0-9ÄÖÜäöüß_-]+/g,'_')}_${f.name}`;let n=1,fn=base;while(used.has(fn))fn=`${n++}_${base}`;used.add(fn);zipFile.file(fn,rec.blob);}
  const blob=await zipFile.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});downloadBlob(name,blob);
}
async function v188DeleteSequence(qid){
  const q=seq(qid);if(!q)return;const linked=linkedLessons(qid).length;if(!confirm(`Reihe „${q.title}“ wirklich löschen? ${linked?linked+' verknüpfte Unterrichtsstunden bleiben erhalten; nur ihre Zuordnung zur Reihe wird gelöst.':'Die Reihe wird aus der Jahresplanung entfernt.'} Materialien und Originaldateien werden nicht gelöscht.`))return;
  for(const l of state.lessons||[]){if(l.sequenceId!==qid)continue;l.sequenceId='';if(l.unit===q.title)l.unit='';if(l.planReference?.autoMatched&&!v182IsHeld(l)&&!concretePlanReadyV12(l))l.planReference=null;}
  for(const m of state.materials||[])if(Array.isArray(m.assignments))m.assignments=m.assignments.filter(a=>a.sequenceId!==qid);
  state.sequences=state.sequences.filter(x=>x.id!==qid);modal=null;await saveState();render();
}
async function v188DeleteUnit(qid,unitId){
  const q=seq(qid),u=q?.plan?.find(x=>x.id===unitId);if(!q||!u)return;if(!confirm(`Soll-Stunde „${u.title}“ aus der Reihe löschen? Bereits konkret geplante oder gehaltene Wochenstunden werden nicht gelöscht.`))return;
  q.plan=(q.plan||[]).filter(x=>x.id!==unitId);
  for(const l of state.lessons||[]){if(l.planReference?.unitId!==unitId)continue;if(l.planReference?.autoMatched&&!v182IsHeld(l)&&!concretePlanReadyV12(l)){if(l.title===u.title)l.title='';if(l.objective===u.objective)l.objective='';l.planReference=null;}}
  await saveState();modal={type:'sequence',id:qid};render();
}

// Feste Leistungsnachweise in materialgestützte Reihenplanung einbauen.
const v188OldSequencePrompt=v184Prompt;
v184Prompt=function(){
  v188EnsureState();let text=v188OldSequencePrompt();const q=seq(v184Flow.sequenceId),cid=v184Flow.courseId,start=v184Flow.startDate||q?.startDate||'',end=v184Flow.endDate||q?.endDate||'';const exams=v188RelevantAssessments(cid,start,end);
  const block=`## Feste Klassenarbeiten / Klausuren – NICHT verschieben\n${v188AssessmentPromptLines(exams)}\n\nDiese Termine sind kalenderfix und existieren unabhängig von der Reihe. Ordne die Reihe zeitlich so, dass die benötigten Inhalte realistisch vor dem jeweiligen Termin behandelt und bei Bedarf wiederholt werden. Verändere keinen Prüfungstermin. Wenn Prüfungsdateien genannt sind, analysiere deren konkrete Aufgaben nur, wenn ich diese Dateien zusätzlich in diesem Chat hochgeladen habe; sonst Prüfungsinhalte ausschließlich aus dem eingetragenen Prüfungsstoff ableiten.\n\n`;
  return text.replace('## Meine Ergänzungen\n',block+'## Meine Ergänzungen\n');
};

// Feste Leistungsnachweise auch in jeden konkreten Stunden-Prompt aufnehmen.
const v188OldConcretePrompt=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
  v188EnsureState();let text=v188OldConcretePrompt(l);const exams=v188RelevantAssessments(l.classId,'','',l.date);
  if(exams.length){const todayExam=exams.find(a=>a.date===l.date);text+=`\n\n## Nächste feste Klassenarbeiten / Klausuren\n${v188AssessmentPromptLines(exams)}\n${todayExam?'ACHTUNG: Der aktuelle Unterrichtstermin ist selbst als '+v188AssessmentLabel(todayExam)+' eingetragen. Plane an diesem Termin keine normale neue Fachstunde, sondern behandle ihn als festen Leistungsnachweis. ':''}Diese Termine sind fix. Berücksichtige bei dieser Stunde, wie viel Stoff bis dahin noch sinnvoll bearbeitet oder wiederholt werden muss. Prüfungsaufgaben selbst nur dann inhaltlich auswerten, wenn die genannten Dateien in diesem Chat tatsächlich hochgeladen wurden.\n`;}
  return text;
};
makeBrief=concretePlanningPromptV12;

// Reihenansicht: unabhängiger Prüfungsbereich + sichere Löschmöglichkeiten.
const v188OldSequencesView=sequencesView;
sequencesView=function(){v188EnsureState();let h=v188OldSequencesView();const panel=v188AssessmentPanel();const close=h.indexOf('</section>');return close>=0?h.slice(0,close+10)+panel+h.slice(close+10):h+panel;};
const v188OldSequencePanel=sequencePanel;
sequencePanel=function(q){let h=v188OldSequencePanel(q);if(!q)return h;h=h.replace(`<label>Klassenarbeit / Leistung<input type="date" data-sequence-field="${q.id}|assessmentDate" value="${esc(q.assessmentDate||'')}"></label>`,'');h=h.replace(/<button class="secondary" data-v182-unit-edit="([^\"]+)">Bearbeiten<\/button>/g,(m,key)=>`${m}<button class="danger-lite small" data-v188-unit-delete="${key}">Löschen</button>`);const danger=`<section class="danger-zone v188-sequence-danger"><strong>Reihe aus der Jahresplanung löschen</strong><p>Unterrichtsstunden und Materialdateien bleiben erhalten; nur die Reihenstruktur und Zuordnung werden entfernt.</p><button class="danger-lite" data-v188-sequence-delete="${q.id}">Reihe löschen</button></section>`;const i=h.lastIndexOf('</div>');return i>=0?h.slice(0,i)+danger+h.slice(i):h+danger;};

// Im Reihenplan-Assistenten Prüfungsdateien bequem für den Chat bündeln.
const v188OldNewSequencePanel=newSequencePanel;
newSequencePanel=function(prefillClassId=(modal?.classId||'')){let h=v188OldNewSequencePanel(prefillClassId);return h.replace('<label>Klassenarbeit / Leistung<input type="date" id="ns-assessment"></label>','<input type="hidden" id="ns-assessment" value="">');};

const v188OldSequenceModal=v184ModalHtml;
v184ModalHtml=function(){let h=v188OldSequenceModal();if(v184Flow.step===1){const q=seq(v184Flow.sequenceId),exams=v188RelevantAssessments(v184Flow.courseId,v184Flow.startDate||q?.startDate||'',v184Flow.endDate||q?.endDate||''),count=exams.reduce((n,a)=>n+(a.files||[]).length,0);if(count){const target='<div class="v184-actions"><button class="secondary" data-v184-config>← Angaben ändern</button>';h=h.replace(target,`<div class="v188-assessment-chat-files"><strong>${count} Prüfungsdatei${count===1?'':'en'} für diesen Zeitraum</strong><span>Für die inhaltliche Berücksichtigung zusätzlich zusammen mit dem Prompt im Chat hochladen.</span><button class="secondary" data-v188-sequence-assessment-files>Prüfungsdateien herunterladen</button></div>`+target);}}return h;};

const v188OldModalHtml=modalHtml;
modalHtml=function(){if(modal?.type==='assessmentV188')return v188AssessmentModal();return v188OldModalHtml();};

const v188OldWire=wire;
wire=function(){
  v188OldWire();v188EnsureState();
  document.querySelector('[data-v188-assessment-new]')?.addEventListener('click',()=>v188OpenAssessment());
  document.querySelectorAll('[data-v188-assessment-edit]').forEach(b=>b.onclick=()=>v188OpenAssessment(b.dataset.v188AssessmentEdit));
  document.querySelectorAll('[data-v188-assessment-delete]').forEach(b=>b.onclick=()=>v188DeleteAssessment(b.dataset.v188AssessmentDelete));
  document.querySelectorAll('[data-v188-assessment-bundle]').forEach(b=>b.onclick=()=>{const a=state.assessments.find(x=>x.id===b.dataset.v188AssessmentBundle);if(a)v188DownloadAssessmentFiles([a],`${a.date}_${(cls(a.classId)?.subject||'Fach')}_Pruefungsdateien.zip`);});
  document.querySelector('[data-v188-assessment-save]')?.addEventListener('click',async()=>{try{await v188SaveAssessment();}catch(e){alert('Leistungsnachweis konnte nicht gespeichert werden: '+(e.message||e));}});
  document.getElementById('v188-assessment-files')?.addEventListener('change',e=>{v188ReadAssessmentDraft();v188AssessmentDraft.pendingFiles.push(...Array.from(e.target.files||[]));render();});
  document.querySelectorAll('[data-v188-assessment-pending-remove]').forEach(b=>b.onclick=()=>{v188ReadAssessmentDraft();v188AssessmentDraft.pendingFiles.splice(Number(b.dataset.v188AssessmentPendingRemove),1);render();});
  document.querySelectorAll('[data-v188-assessment-file-remove]').forEach(b=>b.onclick=()=>{v188ReadAssessmentDraft();const id=b.dataset.v188AssessmentFileRemove,f=v188AssessmentDraft.files.find(x=>x.id===id);if(f?.fileKey)v188AssessmentDraft.removeKeys.push(f.fileKey);v188AssessmentDraft.files=v188AssessmentDraft.files.filter(x=>x.id!==id);render();});
  document.querySelectorAll('[data-v188-assessment-file-open]').forEach(b=>b.onclick=async()=>{const rec=await fileStoreGet(b.dataset.v188AssessmentFileOpen);if(rec?.blob)downloadBlob(rec.name,rec.blob);});
  document.querySelectorAll('[data-v188-sequence-delete]').forEach(b=>b.onclick=()=>v188DeleteSequence(b.dataset.v188SequenceDelete));
  document.querySelectorAll('[data-v188-unit-delete]').forEach(b=>b.onclick=()=>{const [qid,uidx]=b.dataset.v188UnitDelete.split('|');v188DeleteUnit(qid,uidx);});
  document.querySelector('[data-v188-sequence-assessment-files]')?.addEventListener('click',()=>{const q=seq(v184Flow.sequenceId),arr=v188RelevantAssessments(v184Flow.courseId,v184Flow.startDate||q?.startDate||'',v184Flow.endDate||q?.endDate||'');v188DownloadAssessmentFiles(arr,'Schulcockpit_Pruefungsdateien_fuer_Reihenplanung.zip');});
};

const v188OldRender=render;
render=function(){v188EnsureState();v188OldRender();const v=document.querySelector('.brand small');if(v)v.textContent=`${state.settings.schoolYear} · ${V188_VERSION}`;};

v186Boot();

/* ===== V0.19.0 – Jahresplanung, Niedersachsen-Kalender & Drag/Drop-Reihen =====
   - Reihen sind einem Schuljahr zugeordnet und können für kommende Jahre vorgeplant werden.
   - Offizielle niedersächsische Ferientermine 2024/25–2029/30 sind lokal hinterlegt.
   - Gesetzliche Feiertage werden aus festen Daten + Osterdatum berechnet.
   - Eigene schulfreie Tage und .ics-Importe ergänzen den Kalender.
   - Ferien/Feiertage erzeugen keine Wochenstunden.
   - Reihen lassen sich per Drag & Drop umsortieren; künftige Soll-Termine werden neu berechnet,
     sofern für das Schuljahr ein Planungsrhythmus freigegeben ist.
   - Pro Reihe können Material-/Planungsdateien lokal hinterlegt und für ChatGPT gebündelt werden.
*/
const V190_VERSION='V0.19.0';
let v190Drag=null;
let v190CalendarDraft=null;

const V190_OFFICIAL={
  '2024/25':[
    {name:'Sommerferien 2024',start:'2024-06-24',end:'2024-08-02'},
    {name:'Herbstferien 2024',start:'2024-10-04',end:'2024-10-19'},
    {name:'Tag nach dem Reformationstag',start:'2024-11-01',end:'2024-11-01'},
    {name:'Weihnachtsferien 2024/25',start:'2024-12-23',end:'2025-01-04'},
    {name:'Halbjahresferien 2025',start:'2025-02-03',end:'2025-02-04'},
    {name:'Osterferien 2025',start:'2025-04-07',end:'2025-04-19'},
    {name:'Kirchentag 2025',start:'2025-04-30',end:'2025-04-30'},
    {name:'Tag nach dem 1. Mai',start:'2025-05-02',end:'2025-05-02'},
    {name:'Tag nach Himmelfahrt',start:'2025-05-30',end:'2025-05-30'},
    {name:'Pfingstferien',start:'2025-06-10',end:'2025-06-10'}
  ],
  '2025/26':[
    {name:'Sommerferien 2025',start:'2025-07-03',end:'2025-08-13'},
    {name:'Herbstferien 2025',start:'2025-10-13',end:'2025-10-25'},
    {name:'Weihnachtsferien 2025/26',start:'2025-12-22',end:'2026-01-05'},
    {name:'Halbjahresferien 2026',start:'2026-02-02',end:'2026-02-03'},
    {name:'Osterferien 2026',start:'2026-03-23',end:'2026-04-07'},
    {name:'Tag nach Himmelfahrt',start:'2026-05-15',end:'2026-05-15'},
    {name:'Pfingstferien',start:'2026-05-26',end:'2026-05-26'}
  ],
  '2026/27':[
    {name:'Sommerferien 2026',start:'2026-07-02',end:'2026-08-12'},
    {name:'Herbstferien 2026',start:'2026-10-12',end:'2026-10-24'},
    {name:'Weihnachtsferien 2026/27',start:'2026-12-23',end:'2027-01-09'},
    {name:'Halbjahresferien 2027',start:'2027-02-01',end:'2027-02-02'},
    {name:'Osterferien 2027',start:'2027-03-22',end:'2027-04-03'},
    {name:'Tag nach Himmelfahrt',start:'2027-05-07',end:'2027-05-07'},
    {name:'Pfingstferien',start:'2027-05-18',end:'2027-05-18'}
  ],
  '2027/28':[
    {name:'Sommerferien 2027',start:'2027-07-08',end:'2027-08-18'},
    {name:'Herbstferien 2027',start:'2027-10-16',end:'2027-10-30'},
    {name:'Weihnachtsferien 2027/28',start:'2027-12-23',end:'2028-01-08'},
    {name:'Halbjahresferien 2028',start:'2028-01-31',end:'2028-02-01'},
    {name:'Osterferien 2028',start:'2028-04-10',end:'2028-04-22'},
    {name:'Tag nach Himmelfahrt',start:'2028-05-26',end:'2028-05-26'},
    {name:'Pfingstferien',start:'2028-06-06',end:'2028-06-06'}
  ],
  '2028/29':[
    {name:'Sommerferien 2028',start:'2028-07-20',end:'2028-08-30'},
    {name:'Tag vor dem 3. Oktober',start:'2028-10-02',end:'2028-10-02'},
    {name:'Herbstferien 2028',start:'2028-10-23',end:'2028-11-04'},
    {name:'Weihnachtsferien 2028/29',start:'2028-12-27',end:'2029-01-06'},
    {name:'Halbjahresferien 2029',start:'2029-02-01',end:'2029-02-02'},
    {name:'Osterferien 2029',start:'2029-03-19',end:'2029-04-03'},
    {name:'Tag vor dem 1. Mai',start:'2029-04-30',end:'2029-04-30'},
    {name:'Tag nach Himmelfahrt',start:'2029-05-11',end:'2029-05-11'},
    {name:'Pfingstferien',start:'2029-05-22',end:'2029-05-22'}
  ],
  '2029/30':[
    {name:'Sommerferien 2029',start:'2029-07-19',end:'2029-08-29'},
    {name:'Tage nach dem 3. Oktober',start:'2029-10-04',end:'2029-10-05'},
    {name:'Herbstferien 2029',start:'2029-10-22',end:'2029-11-02'},
    {name:'Weihnachtsferien 2029/30',start:'2029-12-21',end:'2030-01-05'},
    {name:'Halbjahresferien 2030',start:'2030-01-31',end:'2030-02-01'},
    {name:'Osterferien 2030',start:'2030-04-08',end:'2030-04-23'},
    {name:'Tag nach Himmelfahrt',start:'2030-05-31',end:'2030-05-31'},
    {name:'Pfingstferien',start:'2030-06-11',end:'2030-06-11'}
  ],
  '2030/31':[
    {name:'Sommerferien 2030',start:'2030-07-11',end:'2030-08-21'}
  ]
};
function v190NormYear(y){const m=String(y||'').match(/(20\d{2})\s*\/\s*(?:20)?(\d{2})/);return m?`${m[1]}/${m[2]}`:String(y||'').trim();}
function v190YearStartNum(y){return Number(v190NormYear(y).slice(0,4))||new Date().getFullYear();}
function v190NextYear(y){const s=v190YearStartNum(y)+1;return `${s}/${String((s+1)%100).padStart(2,'0')}`;}
function v190YearFromDate(date){if(!date)return v190NormYear(state.settings?.schoolYear||'2026/27');const d=new Date(date+'T12:00:00');if(!Number.isFinite(d.getTime()))return v190NormYear(state.settings?.schoolYear||'2026/27');const y=d.getFullYear(),m=d.getMonth()+1,s=m>=8?y:y-1;return `${s}/${String((s+1)%100).padStart(2,'0')}`;}
function v190PlanningYear(){return v190NormYear(state.settings?.sequencePlanningYearV190||state.settings?.schoolYear||'2026/27');}
function v190YearOptions(){const base=v190YearStartNum(state.settings?.schoolYear||'2026/27'),set=new Set(Object.keys(V190_OFFICIAL));for(let i=-2;i<=7;i++){const s=base+i;set.add(`${s}/${String((s+1)%100).padStart(2,'0')}`);}for(const q of state.sequences||[])if(q.schoolYearV190)set.add(v190NormYear(q.schoolYearV190));for(const a of state.assessments||[])if(a.schoolYearV190)set.add(v190NormYear(a.schoolYearV190));return [...set].sort((a,b)=>v190YearStartNum(a)-v190YearStartNum(b));}
function v190AddDays(date,n){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return iso(d);}
function v190Easter(year){let a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
function v190PublicHolidaysForYear(year){const e=v190Easter(year);return [
  {name:'Neujahr',date:`${year}-01-01`},{name:'Karfreitag',date:v190AddDays(e,-2)},{name:'Ostermontag',date:v190AddDays(e,1)},{name:'Tag der Arbeit',date:`${year}-05-01`},{name:'Christi Himmelfahrt',date:v190AddDays(e,39)},{name:'Pfingstmontag',date:v190AddDays(e,50)},{name:'Tag der Deutschen Einheit',date:`${year}-10-03`},{name:'Reformationstag',date:`${year}-10-31`},{name:'1. Weihnachtstag',date:`${year}-12-25`},{name:'2. Weihnachtstag',date:`${year}-12-26`}
];}
function v190OfficialComplete(y){return ['2024/25','2025/26','2026/27','2027/28','2028/29','2029/30'].includes(v190NormYear(y));}
function v190Calendar(year=v190PlanningYear()){const y=v190NormYear(year);if(!state.schoolCalendarsV190||typeof state.schoolCalendarsV190!=='object')state.schoolCalendarsV190={};return state.schoolCalendarsV190[y]||(state.schoolCalendarsV190[y]={customRanges:[],imports:[],useCurrentTimetable:y===v190NormYear(state.settings.schoolYear),createdAt:new Date().toISOString()});}
function v190OfficialRanges(year=v190PlanningYear()){return (V190_OFFICIAL[v190NormYear(year)]||[]).map(x=>({...x,source:'Niedersachsen MK',type:'official'}));}
function v190CalendarRanges(year=v190PlanningYear()){const cal=v190Calendar(year);return [...v190OfficialRanges(year),...(cal.customRanges||[]).map(x=>({...x,type:x.type||'custom'})),...(cal.imports||[]).map(x=>({...x,type:'ics'}))].sort((a,b)=>a.start.localeCompare(b.start));}
function v190YearBounds(year=v190PlanningYear()){
  const y=v190NormYear(year),s=v190YearStartNum(y),summer=v190OfficialRanges(y).find(r=>r.name.startsWith('Sommerferien')&&r.start.startsWith(String(s))),next=V190_OFFICIAL[v190NextYear(y)]?.find(r=>r.name.startsWith('Sommerferien'));
  return {start:summer?v190AddDays(summer.end,1):`${s}-08-01`,end:next?v190AddDays(next.start,-1):`${s+1}-07-31`,official:v190OfficialComplete(y)};
}
function v190NoSchoolInfo(date){if(!date)return null;const y=v190YearFromDate(date),range=v190CalendarRanges(y).find(r=>date>=r.start&&date<=r.end);if(range)return {type:range.type,name:range.name||'unterrichtsfrei'};const year=Number(date.slice(0,4)),holiday=v190PublicHolidaysForYear(year).find(h=>h.date===date);return holiday?{type:'holiday',name:holiday.name}:null;}
function v190EnsureState(){
  if(!state.settings)state.settings={};state.settings.schoolYear=v190NormYear(state.settings.schoolYear||'2026/27');
  if(!state.settings.sequencePlanningYearV190)state.settings.sequencePlanningYearV190=state.settings.schoolYear;
  if(!state.schoolCalendarsV190||typeof state.schoolCalendarsV190!=='object')state.schoolCalendarsV190={};
  const byCourse={};for(const q of state.sequences||[]){if(!q.schoolYearV190)q.schoolYearV190=v190YearFromDate(q.startDate||q.plan?.find(u=>u.plannedDate)?.plannedDate||'');q.schoolYearV190=v190NormYear(q.schoolYearV190);(byCourse[q.classId+'|'+q.schoolYearV190]||(byCourse[q.classId+'|'+q.schoolYearV190]=[])).push(q);if(!Array.isArray(q.sourceFilesV190))q.sourceFilesV190=[];}
  for(const arr of Object.values(byCourse)){arr.sort((a,b)=>(a.orderV190??9999)-(b.orderV190??9999)||(a.startDate||'9999').localeCompare(b.startDate||'9999'));arr.forEach((q,i)=>{if(!Number.isFinite(Number(q.orderV190)))q.orderV190=i;});}
  for(const a of state.assessments||[]){if(!a.schoolYearV190)a.schoolYearV190=v190YearFromDate(a.date);a.schoolYearV190=v190NormYear(a.schoolYearV190);}
  v190Calendar(state.settings.schoolYear);
}
function v190SeqYear(q){return v190NormYear(q?.schoolYearV190||v190YearFromDate(q?.startDate||q?.plan?.find(u=>u.plannedDate)?.plannedDate||''));}
function v190PlanningSequences(cid,year=v190PlanningYear()){return (state.sequences||[]).filter(q=>q.classId===cid&&v190SeqYear(q)===v190NormYear(year)).sort((a,b)=>(Number(a.orderV190)||0)-(Number(b.orderV190)||0)||(a.startDate||'9999').localeCompare(b.startDate||'9999'));}
function v190SequenceLocked(q){if(!q)return true;if((state.lessons||[]).some(l=>l.sequenceId===q.id&&v182IsHeld(l)))return true;const current=v190NormYear(state.settings.schoolYear),today=iso(new Date());return v190SeqYear(q)===current&&q.startDate&&q.startDate<=today;}
function v190CourseSlots(cid,year=v190PlanningYear()){
  const y=v190NormYear(year),cal=v190Calendar(y);if(y!==v190NormYear(state.settings.schoolYear)&&!cal.useCurrentTimetable)return [];
  const tt=(state.timetable||[]).filter(t=>t.classId===cid&&!(t.kind==='group'||t.groupId)).sort((a,b)=>Number(a.weekday)-Number(b.weekday)||Number(a.slot)-Number(b.slot));if(!tt.length)return [];
  const {start,end}=v190YearBounds(y),exams=new Set((state.assessments||[]).filter(a=>a.classId===cid&&v190YearFromDate(a.date)===y).map(a=>a.date)),out=[];let d=new Date(start+'T12:00:00'),last=new Date(end+'T12:00:00');
  while(d<=last){const date=iso(d),wd=d.getDay()||7;if(!v190NoSchoolInfo(date)&&!exams.has(date))for(const t of tt.filter(x=>Number(x.weekday)===wd))out.push({date,slot:Number(t.slot),period:t.period,timetableId:t.id});d.setDate(d.getDate()+1);}return out;
}
function v190SequenceNeed(q){const n=(q.plan||[]).length;if(n)return n;const h=Number(q.hours);return Number.isFinite(h)&&h>0?Math.ceil(h):1;}
function v190RescheduleCourseYear(cid,year=v190PlanningYear(),silent=false){
  const y=v190NormYear(year),seqs=v190PlanningSequences(cid,y);if(!seqs.length)return {changed:0,warning:''};const slots=v190CourseSlots(cid,y);if(!slots.length)return {changed:0,warning:y===v190NormYear(state.settings.schoolYear)?'Für diesen Fachkurs ist kein Stundenplan-Rhythmus hinterlegt. Reihenfolge gespeichert, Termine bleiben unverändert.':'Für dieses zukünftige Schuljahr ist noch kein Planungsrhythmus freigegeben. Reihenfolge gespeichert; Termine werden erst berechnet, wenn du im Kalender „aktuellen Stundenplan als Planungsrhythmus“ aktivierst.'};
  let cursor=0,changed=0,insufficient=0;const lockedDates=seqs.filter(v190SequenceLocked).flatMap(q=>(q.plan||[]).map(u=>u.plannedDate).filter(Boolean).concat(q.endDate?[q.endDate]:[])).sort();const anchor=lockedDates.length?lockedDates[lockedDates.length-1]:'';if(anchor)while(cursor<slots.length&&slots[cursor].date<=anchor)cursor++;
  for(const q of seqs){if(v190SequenceLocked(q))continue;const need=v190SequenceNeed(q),slice=slots.slice(cursor,cursor+need);if(!slice.length){q.startDate='';q.endDate='';for(const u of q.plan||[])u.plannedDate='';insufficient++;continue;}q.startDate=slice[0].date;q.endDate=slice[slice.length-1].date;const units=q.plan||[];for(let i=0;i<units.length;i++){const old=units[i].plannedDate,newDate=slice[i]?.date||'';units[i].plannedDate=newDate;if(old!==newDate)changed++;for(const l of state.lessons||[]){if(l.classId!==cid||v182IsHeld(l)||l.planReference?.unitId!==units[i].id)continue;if(newDate){const slot=slice[i],t=state.timetable.find(x=>x.id===slot.timetableId);l.date=newDate;l.slot=slot.slot;l.period=t?.period||slot.period||l.period;l.timetableId=slot.timetableId;l.sequenceId=q.id;l.unit=q.title;if(l.planReference)l.planReference.plannedDate=newDate;}}}cursor+=need;if(slice.length<need)insufficient++;}
  return {changed,warning:insufficient?'Nicht für alle Reihen standen noch genügend reguläre Fachstunden im Schuljahr zur Verfügung. Die übrigen Termine bleiben offen.':''};
}
function v190Reorder(qid,targetId,after=false){const q=seq(qid),target=seq(targetId);if(!q||!target||q.classId!==target.classId||v190SeqYear(q)!==v190SeqYear(target))return;if(v190SequenceLocked(q))return alert('Diese Reihe hat bereits begonnen bzw. enthält gehaltene Stunden und bleibt deshalb an ihrer Position.');const list=v190PlanningSequences(q.classId,v190SeqYear(q));const moving=list.find(x=>x.id===qid);let rest=list.filter(x=>x.id!==qid),idx=rest.findIndex(x=>x.id===targetId);if(idx<0)return;if(after)idx++;rest.splice(idx,0,moving);rest.forEach((x,i)=>x.orderV190=i);const r=v190RescheduleCourseYear(q.classId,v190SeqYear(q));saveState();render();if(r.warning)alert(r.warning);}
function v190AssessmentPanelYear(year=v190PlanningYear()){const y=v190NormYear(year),list=v188Assessments().filter(a=>v190YearFromDate(a.date)===y);const rows=list.map(a=>{const c=cls(a.classId),fc=(a.files||[]).length;return `<article class="v188-assessment-card"><div class="v188-assessment-date"><strong>${esc(fmtDate(a.date))}</strong><small>${esc(a.type||'Leistung')}</small></div><div class="v188-assessment-main"><span class="eyebrow">${esc(c?.subject||'')} ${esc(c?.name||'')}</span><h3>${esc(a.title||a.type||'Leistungsnachweis')}</h3><p>${esc(a.scope||'Prüfungsstoff noch nicht notiert.')}</p><small>${fc?`${fc} Prüfungsdatei${fc===1?'':'en'} lokal hinterlegt`:'Noch keine Prüfungsdatei hinterlegt'}</small></div><div class="v188-assessment-actions"><button class="secondary" data-v188-assessment-edit="${a.id}">Bearbeiten</button>${fc?`<button class="text-button" data-v188-assessment-bundle="${a.id}">Dateien für ChatGPT</button>`:''}<button class="danger-lite" data-v188-assessment-delete="${a.id}">Löschen</button></div></article>`;}).join('');return `<section class="panel v188-assessment-panel"><div class="section-head"><div><span class="eyebrow">FESTE TERMINE · ${esc(y)}</span><h2>Klassenarbeiten & Klausuren</h2><p>Bleiben unabhängig von Reihen fix und blockieren bei der automatischen Terminierung den jeweiligen Fachtermin.</p></div><button class="primary" data-v188-assessment-new>+ Termin eintragen</button></div><div class="v188-assessment-list">${rows||'<p class="muted">In diesem Schuljahr noch keine festen Leistungsnachweise eingetragen.</p>'}</div></section>`;}
function v190SequenceCard(q){const locked=v190SequenceLocked(q),count=(q.plan||[]).length,files=(q.sourceFilesV190||[]).length,missing=(q.plan||[]).reduce((n,u)=>n+(u.pendingMaterialReferencesV184||[]).length,0);return `<article class="v190-sequence-card ${locked?'locked':''}" data-v190-drop="${q.id}"><div class="v190-drag ${locked?'disabled':''}" ${locked?'':`draggable="true" data-v190-drag="${q.id}"`} title="${locked?'Bereits begonnen – Reihenfolge gesperrt':'Ziehen zum Verschieben'}">⋮⋮</div><button class="v190-sequence-main" data-sequence="${q.id}"><div><span class="eyebrow">${q.startDate?fmtDate(q.startDate):'Start offen'}${q.endDate?` → ${fmtDate(q.endDate)}`:''}</span><h3>${esc(q.title)}</h3><p>${esc(q.goal||'Reihenziel noch offen')}</p></div><div class="v190-seq-meta"><span>${count||Number(q.hours)||'?'} Fachstunde${(count||Number(q.hours))===1?'':'n'}</span>${files?`<span>${files} Planungsdatei${files===1?'':'en'}</span>`:''}${missing?`<span class="warn">${missing} Material offen</span>`:''}${locked?'<span>🔒 begonnen</span>':''}</div></button></article>`;}
function v190CalendarSummary(year=v190PlanningYear()){const y=v190NormYear(year),b=v190YearBounds(y),cal=v190Calendar(y),official=v190OfficialComplete(y);return `<section class="panel v190-calendar-summary"><div><span class="eyebrow">SCHULKALENDER · NIEDERSACHSEN</span><h2>${esc(y)} · ${fmtDate(b.start)} bis ${fmtDate(b.end)}</h2><p>${official?'Offizielle niedersächsische Ferientermine sind hinterlegt. Gesetzliche Feiertage werden automatisch berechnet.':'Für dieses Jahr liegt im Cockpit keine vollständige amtliche Ferienordnung vor. Eigene/ICS-Termine können trotzdem hinterlegt werden.'}</p><div class="v190-calendar-chips"><span>${v190OfficialRanges(y).length} Ferien-/unterrichtsfreie Blöcke</span><span>${(cal.customRanges||[]).length+(cal.imports||[]).length} eigene/importierte Termine</span><span>${y===v190NormYear(state.settings.schoolYear)||cal.useCurrentTimetable?'Datierung aktiv':'Reihenfolge ohne automatische Datierung'}</span></div></div><button class="secondary" data-v190-calendar>Ferien & Kalender verwalten →</button></section>`;}
function v190SequencesView(){v190EnsureState();const y=v190PlanningYear(),years=v190YearOptions(),courses=(state.classes||[]).filter(c=>c.subject&&!/^ga$/i.test(c.subject));return `<div class="content-grid v190-year-plan"><section class="hero-card v190-year-hero"><div><span class="eyebrow">JAHRESPLANUNG</span><h2>Themen, Materialien und Termine für das ganze Schuljahr.</h2><p>Reihen lassen sich vorplanen, per Drag & Drop verschieben und – sobald ein Planungsrhythmus feststeht – automatisch auf echte Unterrichtstermine ohne Ferien und Feiertage verteilen.</p></div><div class="v190-year-actions"><label>Planungsjahr<select id="v190-year-select">${years.map(x=>`<option value="${x}" ${x===y?'selected':''}>${x}</option>`).join('')}</select></label><button class="primary" data-v184-open>Neue Reihe / Reihe mit ChatGPT planen →</button><button class="secondary" data-action="new-sequence">+ Grobe Reihe</button></div></section>${v190CalendarSummary(y)}${v190AssessmentPanelYear(y)}${courses.map(c=>{const qs=v190PlanningSequences(c.id,y),canDate=y===v190NormYear(state.settings.schoolYear)||v190Calendar(y).useCurrentTimetable;return `<section class="panel v190-course-plan"><div class="section-head"><div><span class="eyebrow">${esc(c.subject)} · ${esc(y)}</span><h2>${esc(c.name)}</h2><p>${qs.length?`${qs.length} Reihen · ${qs.reduce((n,q)=>n+v190SequenceNeed(q),0)} geplante Fachstunden`:'Noch keine Reihe angelegt.'}</p></div><div class="v190-course-actions"><button class="text-button" data-v190-reschedule="${c.id}">${canDate?'Termine neu berechnen':'Reihenfolge speichern'}</button><button class="secondary" data-v184-open-course="${c.id}">Mit ChatGPT planen</button></div></div><div class="v190-sequence-list">${qs.map(v190SequenceCard).join('')||'<p class="muted">Lege Themen grob an oder starte die ChatGPT-Reihenplanung. Materialdateien kannst du anschließend direkt an der Reihe hinterlegen.</p>'}</div></section>`;}).join('')}</div>`;}
const v190OldSequencesView=sequencesView;sequencesView=v190SequencesView;

function v190SourceFilesSection(q){const files=q?.sourceFilesV190||[];return `<section class="detail-section v190-source-files"><div class="section-head compact"><div><span class="eyebrow">MATERIALGRUNDLAGE DER REIHE</span><h3>Planungsdateien & Materialsammlungen</h3></div><label class="upload-button">Dateien hinterlegen<input type="file" multiple data-v190-source-upload="${q.id}" hidden></label></div><p class="muted">Hier kannst du Arbeitsblätter, PDFs, DOCX, Präsentationen oder ZIP-Sammlungen schon für kommende Schuljahre hinterlegen. Sie bleiben lokal. Für eine inhaltliche ChatGPT-Planung lädst du sie gebündelt zusammen mit dem Reihen-Prompt hier im Chat hoch.</p><div class="v190-source-list">${files.map(f=>`<div class="v190-source-row"><span><strong>${esc(f.name)}</strong><small>${Math.max(1,Math.round((f.size||0)/1024))} KB · lokal</small></span><div><button class="text-button" data-v190-source-open="${esc(f.fileKey)}">Öffnen</button><button class="danger-lite small" data-v190-source-remove="${q.id}|${f.id}">×</button></div></div>`).join('')||'<p class="muted">Noch keine zusätzlichen Planungsdateien hinterlegt.</p>'}</div>${files.length?`<button class="secondary" data-v190-source-bundle="${q.id}">Dateien für ChatGPT herunterladen</button>`:''}</section>`;}
const v190OldSequencePanel=sequencePanel;sequencePanel=function(q){let h=v190OldSequencePanel(q);if(!q)return h;const year=v190SeqYear(q);h=h.replace('<div class="lesson-edit-grid">',`<div class="lesson-edit-grid"><label>Schuljahr<select data-v190-sequence-year="${q.id}">${v190YearOptions().map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}</select></label>`);const add=v190SourceFilesSection(q);const pos=h.lastIndexOf('<section class="danger-zone');return pos>=0?h.slice(0,pos)+add+h.slice(pos):h.replace(/<\/div>\s*$/,'')+add+'</div>';};
const v190OldNewSequencePanel=newSequencePanel;newSequencePanel=function(prefillClassId=(modal?.classId||'')){let h=v190OldNewSequencePanel(prefillClassId);const y=v190PlanningYear();h=h.replace('<label>Titel<input id="ns-title"',`<label>Schuljahr<select id="ns-year">${v190YearOptions().map(x=>`<option value="${x}" ${x===y?'selected':''}>${x}</option>`).join('')}</select></label><label>Titel<input id="ns-title"`);return h;};

function v190CalendarModal(){const y=v190NormYear(v190CalendarDraft?.year||v190PlanningYear()),cal=v190Calendar(y),bounds=v190YearBounds(y),ranges=v190CalendarRanges(y),publics=[...v190PublicHolidaysForYear(v190YearStartNum(y)),...v190PublicHolidaysForYear(v190YearStartNum(y)+1)].filter(h=>h.date>=bounds.start&&h.date<=bounds.end&&new Date(h.date+'T12:00:00').getDay()>=1&&new Date(h.date+'T12:00:00').getDay()<=5);return `<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide v190-calendar-modal" data-modal-stop><header class="modal-header"><div><span class="eyebrow">SCHULKALENDER</span><h2>${esc(y)} · Niedersachsen</h2></div><button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body"><section class="detail-section"><div class="v190-cal-status"><div><strong>Unterrichtszeitraum</strong><span>${fmtDate(bounds.start)} – ${fmtDate(bounds.end)}</span></div><div><strong>Amtliche Ferienordnung</strong><span>${v190OfficialComplete(y)?'✓ vollständig im Cockpit':'⚠ nicht vollständig hinterlegt'}</span></div></div><label class="v184-toggle"><input id="v190-use-current-tt" type="checkbox" ${y===v190NormYear(state.settings.schoolYear)||cal.useCurrentTimetable?'checked':''} ${y===v190NormYear(state.settings.schoolYear)?'disabled':''}> ${y===v190NormYear(state.settings.schoolYear)?'Aktueller Stundenplan wird für dieses Schuljahr verwendet.':'Aktuellen Stundenplan als vorläufigen Planungsrhythmus für '+esc(y)+' verwenden'}</label><p class="muted">Für kommende Schuljahre kannst du Themen und Materialien auch ohne Stundenplan vorplanen. Erst wenn der Rhythmus aktiviert ist, werden beim Verschieben konkrete Termine berechnet.</p></section><section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">UNTERRICHTSFREI</span><h3>Ferien, schulfreie Tage & Importe</h3></div><label class="upload-button">.ics importieren<input id="v190-ics" type="file" accept=".ics,text/calendar" hidden></label></div><div class="v190-range-list">${ranges.map(r=>`<div class="v190-range-row"><span><strong>${esc(r.name||'Unterrichtsfrei')}</strong><small>${fmtDate(r.start)}${r.end!==r.start?' – '+fmtDate(r.end):''} · ${r.type==='official'?'amtlich':r.type==='ics'?'ICS-Import':'eigener Eintrag'}</small></span>${r.type==='official'?'':`<button class="danger-lite small" data-v190-range-remove="${r.id}">×</button>`}</div>`).join('')}</div><div class="v190-add-range"><input id="v190-range-name" placeholder="z. B. Pädagogischer Tag"><input id="v190-range-start" type="date"><input id="v190-range-end" type="date"><button class="secondary" data-v190-range-add>+ schulfreien Zeitraum</button></div></section><section class="detail-section"><span class="eyebrow">GESETZLICHE FEIERTAGE</span><h3>Automatisch berücksichtigt</h3><p class="muted">${publics.map(h=>`${fmtDate(h.date)} ${h.name}`).join(' · ')||'Keine zusätzlichen Werktags-Feiertage im Unterrichtszeitraum.'}</p></section><div class="v188-modal-actions"><button class="secondary" data-action="modal-close">Schließen</button><button class="primary" data-v190-calendar-recalc>Reihentermine dieses Schuljahres neu berechnen</button></div></div></section></div>`;}
const v190OldModalHtml=modalHtml;modalHtml=function(){if(modal?.type==='calendarV190')return v190CalendarModal();return v190OldModalHtml();};
function v190ParseIcs(text){const lines=String(text||'').replace(/\r\n/g,'\n').split('\n').reduce((a,l)=>{if(/^\s/.test(l)&&a.length)a[a.length-1]+=l.trim();else a.push(l.trim());return a;},[]);const out=[];let ev=null;for(const line of lines){if(line==='BEGIN:VEVENT')ev={};else if(line==='END:VEVENT'&&ev){const parse=v=>{const m=String(v||'').match(/(\d{4})(\d{2})(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:'';};const start=parse(ev.start),dtend=parse(ev.end);if(start){let end=dtend?v190AddDays(dtend,-1):start;if(end<start)end=start;out.push({id:uid('cal'),name:(ev.summary||'ICS-Termin').replace(/\\,/g,',').replace(/\\n/gi,' '),start,end,source:'ICS'});}ev=null;}else if(ev){if(/^DTSTART/i.test(line))ev.start=line.split(':').slice(1).join(':');if(/^DTEND/i.test(line))ev.end=line.split(':').slice(1).join(':');if(/^SUMMARY/i.test(line))ev.summary=line.split(':').slice(1).join(':');}}return out;}
async function v190UploadSourceFiles(q,files){q.sourceFilesV190=q.sourceFilesV190||[];for(const f of files||[]){const id=uid('src'),key=`sequence-source-${q.id}-${id}`;await fileStorePut(key,f);storedFileKeys.add(key);q.sourceFilesV190.push({id,name:f.name,type:f.type||'',size:f.size||0,fileKey:key,addedAt:new Date().toISOString()});}await saveState();}
async function v190DownloadSourceBundle(q){const arr=[];for(const f of q.sourceFilesV190||[]){const rec=await fileStoreGet(f.fileKey);if(rec?.blob)arr.push({f,rec});}if(!arr.length)return alert('Keine lokalen Planungsdateien verfügbar.');if(arr.length===1)return downloadBlob(arr[0].f.name,arr[0].rec.blob);const z=new JSZip();for(const {f,rec} of arr)z.file(f.name,rec.blob);downloadBlob(`Schulcockpit_${(q.title||'Reihe').replace(/[^A-Za-z0-9ÄÖÜäöüß_-]+/g,'_')}_Materialien.zip`,await z.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}}));}
function v190CalendarPromptBlock(year,start='',end=''){const y=v190NormYear(year),bounds=v190YearBounds(y),lo=start||bounds.start,hi=end||bounds.end,r=v190CalendarRanges(y).filter(x=>x.end>=lo&&x.start<=hi);const ph=[...v190PublicHolidaysForYear(v190YearStartNum(y)),...v190PublicHolidaysForYear(v190YearStartNum(y)+1)].filter(h=>h.date>=lo&&h.date<=hi&&new Date(h.date+'T12:00:00').getDay()>=1&&new Date(h.date+'T12:00:00').getDay()<=5);return `## Schulkalender ${y} – verbindlich\n- Regulärer Unterrichtszeitraum: ${bounds.start} bis ${bounds.end}\n- Ferien / schulfreie Zeiträume: ${r.length?r.map(x=>`${x.start}${x.end!==x.start?'–'+x.end:''} ${x.name}`).join('; '):'keine hinterlegt'}\n- Gesetzliche Feiertage an Werktagen: ${ph.length?ph.map(x=>`${x.date} ${x.name}`).join('; '):'keine im Zeitraum'}\nAn Ferien, schulfreien Tagen und Feiertagen dürfen keine Unterrichtsstunden geplant werden. Feste Klassenarbeiten/Klausuren bleiben unverändert.\n`;}
const v190OldV184Open=v184Open;v184Open=function(courseId='',qid=''){v190EnsureState();v190OldV184Open(courseId,qid);v184Flow.schoolYearV190=qid?v190SeqYear(seq(qid)):v190PlanningYear();const q=seq(qid);if(q?.sourceFilesV190?.length)v184Flow.materialSourceNames=q.sourceFilesV190.map(f=>f.name).join(', ');};
const v190OldV184Prompt=v184Prompt;v184Prompt=function(){let txt=v190OldV184Prompt();const q=seq(v184Flow.sequenceId),year=v190NormYear(v184Flow.schoolYearV190||q?.schoolYearV190||v190PlanningYear()),files=q?.sourceFilesV190||[];txt=txt.replace('## Auftrag\n',v190CalendarPromptBlock(year,v184Flow.startDate||q?.startDate||'',v184Flow.endDate||q?.endDate||'')+'\n## Auftrag\n');if(files.length)txt+=`\n\n## Im Schulcockpit lokal hinterlegte Material-/Planungsdateien dieser Reihe\n${files.map(f=>'- '+f.name).join('\n')}\nDiese Dateien werden NICHT automatisch mit dem kopierten Prompt übertragen. Lade das Materialpaket zusammen mit diesem Prompt in den Chat hoch und werte die tatsächlichen Inhalte aus.\n`;return txt;};
const v190OldV184Apply=v184Apply;v184Apply=async function(){const result=await v190OldV184Apply();const q=seq(result.qid);if(q){q.schoolYearV190=v190NormYear(v184Flow.schoolYearV190||v190PlanningYear());const list=v190PlanningSequences(q.classId,q.schoolYearV190);if(!Number.isFinite(Number(q.orderV190)))q.orderV190=list.length?Math.max(...list.map(x=>Number(x.orderV190)||0))+1:0;await saveState();}return result;};
const v190OldV184Modal=v184ModalHtml;v184ModalHtml=function(){let h=v190OldV184Modal();if(v184Flow.step===0){const q=seq(v184Flow.sequenceId),year=v190NormYear(v184Flow.schoolYearV190||q?.schoolYearV190||v190PlanningYear());h=h.replace('<label>Reihe<select id="v184-sequence">',`<label>Schuljahr<select id="v190-ai-year">${v190YearOptions().map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}</select></label><label>Reihe<select id="v184-sequence">`);const qs=v190PlanningSequences(v184Flow.courseId,year),opts='<option value="">Neue Reihe planen</option>'+qs.map(x=>`<option value="${x.id}" ${x.id===v184Flow.sequenceId?'selected':''}>${esc(x.title)} · ${(x.plan||[]).length} Soll-Stunden</option>`).join('');h=h.replace(/<select id="v184-sequence">[\s\S]*?<\/select>/,`<select id="v184-sequence">${opts}</select>`);}if(v184Flow.step===1){const q=seq(v184Flow.sequenceId),files=q?.sourceFilesV190||[];if(files.length){const marker='<div class="v184-actions"><button class="secondary" data-v184-config>';h=h.replace(marker,`<div class="v190-ai-source-files"><strong>${files.length} lokal hinterlegte Materialdatei${files.length===1?'':'en'}</strong><span>Für die inhaltliche Reihenplanung zusammen mit dem Prompt in ChatGPT hochladen.</span><button class="secondary" data-v190-ai-source-bundle="${q.id}">Materialpaket herunterladen</button></div>`+marker);}}return h;};

// Ferien und Feiertage beim Wochenaufbau tatsächlich auslassen.
function v190RebuildActiveWeek(replace=false){
  if(!state.timetable.length)return alert('Dein Stundenplan ist noch leer. Trage zuerst deine Wochenstunden ein.');const existingWeek=currentWeekLessons(),matched=new Set();let added=0,kept=0,removed=0,skipped=[];
  for(const t of state.timetable){const date=activeWeekDate(t.weekday),free=v190NoSchoolInfo(date);if(free){skipped.push(`${fmtDate(date)} · ${free.name}`);for(const old of existingWeek.filter(x=>x.date===date&&x.timetableId===t.id&&!v182IsHeld(x)&&x.source==='timetable')){state.lessons=state.lessons.filter(z=>z.id!==old.id);removed++;}continue;}const isGroup=t.kind==='group'||t.groupId;let l=existingWeek.find(x=>x.timetableId===t.id)||existingWeek.find(x=>x.date===date&&lessonSlot(x)===Number(t.slot)&&(isGroup?(x.groupId===t.groupId):(x.classId===t.classId)));if(l){l.date=date;l.period=t.period;l.slot=t.slot;l.timetableId=t.id;l.source='timetable';l.kind=isGroup?'group':'course';if(isGroup){l.groupId=t.groupId;delete l.classId;}else{l.classId=t.classId;delete l.groupId;}matched.add(l.id);attachExactPlanV11(l);kept++;}else{l=createBlankLessonFromTimetable(t);state.lessons.push(l);matched.add(l.id);added++;}}
  if(replace){const start=iso(activeMonday()),end=activeWeekEnd();state.lessons=state.lessons.filter(l=>{if(l.date<start||l.date>end)return true;if(matched.has(l.id)||l.status==='done'||l.source==='manual'||v190NoSchoolInfo(l.date)&&v182IsHeld(l))return true;if(l.source==='timetable'){removed++;return false;}return true;});}
  saveState();alert(`${added} neu · ${kept} weiterverwendet${removed?` · ${removed} veraltete/freie Termine entfernt`:''}${skipped.length?` · ${skipped.length} Stunden wegen Ferien/Feiertag ausgelassen`:''}.${skipped.length?'\n\n'+[...new Set(skipped)].join('\n'):''}`);render();
}
rebuildActiveWeek=v190RebuildActiveWeek;syncWeek=()=>v190RebuildActiveWeek(false);

const v190OldConcretePrompt=concretePlanningPromptV12;concretePlanningPromptV12=function(l){let txt=v190OldConcretePrompt(l);const y=v190YearFromDate(l.date),near=v190CalendarRanges(y).filter(r=>r.start>=l.date&&r.start<=v190AddDays(l.date,21)).slice(0,2);if(near.length)txt+=`\n\n## Schulkalender\nIn den nächsten drei Wochen liegen folgende unterrichtsfreie Zeiten: ${near.map(r=>`${r.start}${r.end!==r.start?'–'+r.end:''} ${r.name}`).join('; ')}. Berücksichtige das nur bei Hausaufgaben, offenen Fortsetzungen und dem zeitlichen Anschluss an die Folgestunde.\n`;return txt;};makeBrief=concretePlanningPromptV12;

const v190OldAssessmentSave=v188SaveAssessment;v188SaveAssessment=async function(){const ok=await v190OldAssessmentSave();if(ok){const a=(state.assessments||[]).slice().sort((x,y)=>(y.updatedAt||'').localeCompare(x.updatedAt||''))[0];if(a)a.schoolYearV190=v190YearFromDate(a.date);await saveState();}return ok;};

const v190OldModalClose=()=>{};
const v190OldWire=wire;wire=function(){v190EnsureState();v190OldWire();
  document.getElementById('v190-year-select')?.addEventListener('change',e=>{state.settings.sequencePlanningYearV190=v190NormYear(e.target.value);saveState();render();});
  document.querySelector('[data-v190-calendar]')?.addEventListener('click',()=>{v190CalendarDraft={year:v190PlanningYear()};modal={type:'calendarV190'};render();});
  document.querySelectorAll('[data-v190-reschedule]').forEach(b=>b.onclick=()=>{const r=v190RescheduleCourseYear(b.dataset.v190Reschedule,v190PlanningYear());saveState();render();if(r.warning)alert(r.warning);else alert(`${r.changed} Soll-Termin${r.changed===1?'':'e'} aktualisiert.`);});
  document.querySelectorAll('[data-v184-open-course]').forEach(b=>b.onclick=()=>v184Open(b.dataset.v184OpenCourse,''));
  document.querySelectorAll('[data-v190-drag]').forEach(h=>{h.ondragstart=e=>{v190Drag=h.dataset.v190Drag;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',v190Drag);};h.ondragend=()=>{v190Drag=null;document.querySelectorAll('.v190-sequence-card.drag-over').forEach(x=>x.classList.remove('drag-over'));};});
  document.querySelectorAll('[data-v190-drop]').forEach(card=>{card.ondragover=e=>{if(!v190Drag||v190Drag===card.dataset.v190Drop)return;e.preventDefault();card.classList.add('drag-over');};card.ondragleave=()=>card.classList.remove('drag-over');card.ondrop=e=>{e.preventDefault();card.classList.remove('drag-over');if(!v190Drag)return;const r=card.getBoundingClientRect(),after=e.clientY>r.top+r.height/2;v190Reorder(v190Drag,card.dataset.v190Drop,after);v190Drag=null;};});
  document.querySelectorAll('[data-v190-sequence-year]').forEach(s=>s.onchange=async()=>{const q=seq(s.dataset.v190SequenceYear);if(!q)return;q.schoolYearV190=v190NormYear(s.value);q.orderV190=v190PlanningSequences(q.classId,q.schoolYearV190).length;await saveState();render();});
  document.querySelectorAll('[data-v190-source-upload]').forEach(inp=>inp.onchange=async()=>{const q=seq(inp.dataset.v190SourceUpload);if(!q||!inp.files?.length)return;try{await v190UploadSourceFiles(q,[...inp.files]);modal={type:'sequence',id:q.id};render();}catch(e){alert('Dateien konnten nicht gespeichert werden: '+(e.message||e));}});
  document.querySelectorAll('[data-v190-source-open]').forEach(b=>b.onclick=async()=>{const rec=await fileStoreGet(b.dataset.v190SourceOpen);if(rec?.blob)downloadBlob(rec.name,rec.blob);});
  document.querySelectorAll('[data-v190-source-remove]').forEach(b=>b.onclick=async()=>{const [qid,id]=b.dataset.v190SourceRemove.split('|'),q=seq(qid),f=q?.sourceFilesV190?.find(x=>x.id===id);if(!q||!f)return;if(!confirm(`„${f.name}“ aus der Materialgrundlage dieser Reihe entfernen?`))return;try{await fileStoreDelete(f.fileKey);storedFileKeys.delete(f.fileKey);}catch(e){}q.sourceFilesV190=q.sourceFilesV190.filter(x=>x.id!==id);await saveState();modal={type:'sequence',id:q.id};render();});
  document.querySelectorAll('[data-v190-source-bundle]').forEach(b=>b.onclick=()=>{const q=seq(b.dataset.v190SourceBundle);if(q)v190DownloadSourceBundle(q);});
  document.getElementById('v190-use-current-tt')?.addEventListener('change',e=>{const y=v190CalendarDraft?.year||v190PlanningYear();v190Calendar(y).useCurrentTimetable=e.target.checked;saveState();});
  document.querySelector('[data-v190-range-add]')?.addEventListener('click',()=>{const y=v190CalendarDraft?.year||v190PlanningYear(),name=document.getElementById('v190-range-name')?.value.trim()||'Unterrichtsfrei',start=document.getElementById('v190-range-start')?.value,end=document.getElementById('v190-range-end')?.value||start;if(!start)return alert('Bitte ein Startdatum eintragen.');if(end<start)return alert('Das Enddatum liegt vor dem Startdatum.');v190Calendar(y).customRanges.push({id:uid('cal'),name,start,end,source:'manuell'});saveState();render();});
  document.querySelectorAll('[data-v190-range-remove]').forEach(b=>b.onclick=()=>{const y=v190CalendarDraft?.year||v190PlanningYear(),cal=v190Calendar(y),id=b.dataset.v190RangeRemove;cal.customRanges=(cal.customRanges||[]).filter(x=>x.id!==id);cal.imports=(cal.imports||[]).filter(x=>x.id!==id);saveState();render();});
  document.getElementById('v190-ics')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;const events=v190ParseIcs(await f.text()),y=v190CalendarDraft?.year||v190PlanningYear(),bounds=v190YearBounds(y),keep=events.filter(x=>x.end>=bounds.start&&x.start<=bounds.end);if(!keep.length)return alert('In der Datei wurden keine Kalendertermine für dieses Schuljahr gefunden.');if(!confirm(`${keep.length} Kalendertermin${keep.length===1?'':'e'} als unterrichtsfrei importieren? Nutze dafür am besten einen reinen Ferien-/Schulkalender.`))return;v190Calendar(y).imports.push(...keep);await saveState();render();});
  document.querySelector('[data-v190-calendar-recalc]')?.addEventListener('click',async()=>{const y=v190CalendarDraft?.year||v190PlanningYear();let total=0,w=[];for(const c of state.classes||[]){const r=v190RescheduleCourseYear(c.id,y,true);total+=r.changed;if(r.warning)w.push(`${c.subject} ${c.name}: ${r.warning}`);}await saveState();render();alert(`${total} Soll-Termine neu berechnet.${w.length?'\n\n'+w.join('\n'):''}`);});
  document.getElementById('v190-ai-year')?.addEventListener('change',e=>{v184CaptureSetup();v184Flow.schoolYearV190=v190NormYear(e.target.value);v184Flow.sequenceId='';v184Flow.startDate='';v184Flow.endDate='';v184Flow.hours='';render();});
  document.querySelectorAll('[data-v190-ai-source-bundle]').forEach(b=>b.onclick=()=>{const q=seq(b.dataset.v190AiSourceBundle);if(q)v190DownloadSourceBundle(q);});
  // Replace legacy new-sequence handler with a year-aware one by cloning the button.
  const create=document.querySelector('[data-action="create-sequence"]');if(create){const cloneBtn=create.cloneNode(true);create.replaceWith(cloneBtn);cloneBtn.onclick=async()=>{const classId=document.getElementById('ns-class')?.value,title=document.getElementById('ns-title')?.value.trim(),year=v190NormYear(document.getElementById('ns-year')?.value||v190PlanningYear());if(!title)return alert('Bitte einen Titel für die Reihe eintragen.');const qs=v190PlanningSequences(classId,year);const q={id:uid('seq'),classId,title,schoolYearV190:year,orderV190:qs.length,startDate:document.getElementById('ns-start')?.value||'',endDate:document.getElementById('ns-end')?.value||'',goal:document.getElementById('ns-goal')?.value.trim()||'',assessmentDate:'',notes:'',plan:[],sourceFilesV190:[]};state.sequences.push(q);if(modal?.returnLessonId){const l=lesson(modal.returnLessonId);l.sequenceId=q.id;l.unit=q.title;}await saveState();modal={type:'sequence',id:q.id};render();};}
};

const v190OldRender=render;render=function(){v190EnsureState();v190OldRender();const v=document.querySelector('.brand small');if(v)v.textContent=`${state.settings.schoolYear} · ${V190_VERSION}`;};

// V0.19.0 safety follow-up: future-year coarse sequences must never become the
// active sequence of a current week just because they have no dates yet.
const v190CreateBlankBeforeYearGuard=createBlankLessonFromTimetable;
createBlankLessonFromTimetable=function(t){const l=v190CreateBlankBeforeYearGuard(t);if(l?.sequenceId){const q=seq(l.sequenceId);if(q&&v190SeqYear(q)!==v190YearFromDate(l.date)){l.sequenceId='';l.unit='';if(!l.planReference)l.title='Thema noch festlegen';}}return attachExactPlanV11(l);};
const v190ReorderBeforeGuard=v190Reorder;
v190Reorder=function(qid,targetId,after=false){const target=seq(targetId);if(v190SequenceLocked(target))return alert('Bereits begonnene Reihen bleiben als fester Block stehen. Verschiebe eine zukünftige Reihe nur innerhalb des noch offenen Jahresabschnitts.');return v190ReorderBeforeGuard(qid,targetId,after);};

/* ===== V0.19.1 – Themengetriebene Terminierung ohne Leer-Stunden =====
   - Nur tatsächlich eingetragene Soll-Themen verbrauchen Fachtermine.
   - Löschen/Einfügen eines Themas zieht die folgenden offenen Themen automatisch nach.
   - Bereits gehaltene und konkret ausgearbeitete Stunden bleiben geschützt.
   - Start und Ende einer Reihe sind gekoppelte Anker: Änderung von Start verschiebt den
     Themenblock vorwärts, Änderung von Ende richtet den Themenblock rückwärts aus.
*/
const V191_VERSION='V0.19.1';

function v191SlotIndex(slots,date,slot=null,timetableId=''){
  if(!date)return -1;
  let i=-1;
  if(timetableId)i=slots.findIndex(s=>s.date===date&&s.timetableId===timetableId);
  if(i<0&&slot!==null&&slot!==undefined)i=slots.findIndex(s=>s.date===date&&Number(s.slot)===Number(slot));
  if(i<0)i=slots.findIndex(s=>s.date===date);
  return i;
}
function v191ClearAutoLesson(l){
  const pr=l?.planReference;if(!pr?.autoMatched)return;
  if(l.title===pr.title)l.title='';
  if(l.objective===pr.objective)l.objective='';
  l.planReference=null;
  l.sequenceId='';
  l.unit='';
}
function v191LessonProtected(l){return !!l&&(v182IsHeld(l)||concretePlanReadyV12(l));}

// Eine Reihe ist exakt so lang wie ihre eingetragenen Soll-Themen. Alte "hours"-Werte
// erzeugen keine künstlichen Platzhaltertermine mehr.
v190SequenceNeed=function(q){return Array.isArray(q?.plan)?q.plan.length:0;};

v190RescheduleCourseYear=function(cid,year=v190PlanningYear(),silent=false,options={}){
  const y=v190NormYear(year),seqs=v190PlanningSequences(cid,y);
  if(!seqs.length)return {changed:0,warning:''};
  const slots=v190CourseSlots(cid,y);
  if(!slots.length)return {changed:0,warning:y===v190NormYear(state.settings.schoolYear)?'Für diesen Fachkurs ist kein Stundenplan-Rhythmus hinterlegt. Reihenfolge gespeichert, Termine bleiben unverändert.':'Für dieses zukünftige Schuljahr ist noch kein Planungsrhythmus freigegeben. Reihenfolge gespeichert; Termine werden erst berechnet, wenn du im Kalender „aktuellen Stundenplan als Planungsrhythmus“ aktivierst.'};

  const today=iso(new Date()),occupied=new Set(),fixedByUnit=new Map(),warnings=[];
  let changed=0,protectedCount=0,unscheduled=0;

  // Gehaltene bzw. konkret ausgearbeitete Unterrichtsstunden sind echte Fixpunkte.
  for(const l of state.lessons||[]){
    if(l.classId!==cid||v190YearFromDate(l.date)!==y||!v191LessonProtected(l))continue;
    const idx=v191SlotIndex(slots,l.date,lessonSlot(l),l.timetableId||'');
    if(idx>=0)occupied.add(idx);
    const uid=l.planReference?.unitId;
    if(uid){fixedByUnit.set(uid,{date:l.date,idx});protectedCount++;}
  }
  // Vergangene Soll-Termine werden nicht rückwirkend umgeschrieben, auch wenn die
  // Unterrichtsstunde historisch noch nicht als "gehalten" markiert wurde.
  for(const q of seqs)for(const u of q.plan||[]){
    if(fixedByUnit.has(u.id)||!u.plannedDate||u.plannedDate>=today)continue;
    const idx=v191SlotIndex(slots,u.plannedDate);
    fixedByUnit.set(u.id,{date:u.plannedDate,idx});
    if(idx>=0)occupied.add(idx);
  }

  // Nur automatisch zugeordnete, noch nicht konkret geplante Zukunftsstunden lösen.
  // Die Stunden selbst bleiben als Stundenplantermine bestehen und bekommen danach
  // anhand des neuen Sollplans automatisch das passende Thema.
  for(const l of state.lessons||[]){
    if(l.classId!==cid||v190YearFromDate(l.date)!==y||l.date<today||v191LessonProtected(l))continue;
    if(l.planReference?.autoMatched)v191ClearAutoLesson(l);
  }

  const firstFree=(from=0,minDate='')=>{
    for(let i=Math.max(0,from);i<slots.length;i++)if(!occupied.has(i)&&(!minDate||slots[i].date>=minDate))return i;
    return -1;
  };
  const prevFree=(from,minIndex=0,maxDate='')=>{
    for(let i=Math.min(from,slots.length-1);i>=Math.max(0,minIndex);i--)if(!occupied.has(i)&&(!maxDate||slots[i].date<=maxDate))return i;
    return -1;
  };
  const nextFixedIndex=(units,from)=>{
    for(let j=from+1;j<units.length;j++){const f=fixedByUnit.get(units[j].id);if(f&&f.idx>=0)return f.idx;}
    return -1;
  };

  let cursor=0;
  for(const q of seqs){
    const units=q.plan||[];
    if(!units.length)continue; // grobe Reihen ohne Themen reservieren bewusst keine Fachstunden

    const isAnchor=q.id===options.anchorSequenceId&&options.anchorDate;
    const mode=isAnchor?options.anchorMode:'';
    const anchorDate=isAnchor?options.anchorDate:'';

    if(mode==='end'){
      // Ende-Anker: Themenblock rückwärts bis zum gewünschten Enddatum legen.
      const assigned=new Map();
      let endIdx=slots.length-1;
      while(endIdx>=cursor&&slots[endIdx].date>anchorDate)endIdx--;
      for(let i=units.length-1;i>=0;i--){
        const u=units[i],fixed=fixedByUnit.get(u.id);
        if(fixed){u.plannedDate=fixed.date;if(fixed.idx>=0)endIdx=Math.min(endIdx,fixed.idx-1);continue;}
        const p=prevFree(endIdx,cursor,anchorDate);
        if(p<0){if(u.plannedDate){u.plannedDate='';changed++;}unscheduled++;continue;}
        assigned.set(u.id,p);occupied.add(p);endIdx=p-1;
      }
      // Rückwärtsbelegung darf die Themenreihenfolge nicht umdrehen. Wenn ein geschützter
      // Fixpunkt dazwischen liegt, bleibt er bestehen; freie Themen liegen davor/danach.
      let maxIdx=cursor-1;
      for(const u of units){
        const fixed=fixedByUnit.get(u.id),idx=fixed?.idx??assigned.get(u.id)??-1;
        const nd=fixed?.date||(idx>=0?slots[idx].date:'');
        if(u.plannedDate!==nd){u.plannedDate=nd;changed++;}
        if(idx>=0)maxIdx=Math.max(maxIdx,idx);
      }
      cursor=Math.max(cursor,maxIdx+1);
    }else{
      if(mode==='start'){
        const a=firstFree(cursor,anchorDate);
        if(a>=0)cursor=a;else warnings.push(`Für „${q.title}“ gibt es ab ${fmtDate(anchorDate)} keinen freien Fachtermin mehr.`);
      }
      for(let i=0;i<units.length;i++){
        const u=units[i],fixed=fixedByUnit.get(u.id);
        if(fixed){
          if(u.plannedDate!==fixed.date){u.plannedDate=fixed.date;changed++;}
          if(fixed.idx>=0)cursor=Math.max(cursor,fixed.idx+1);
          continue;
        }
        const limit=nextFixedIndex(units,i);
        const p=firstFree(cursor);
        if(p<0||(limit>=0&&p>=limit)){
          if(u.plannedDate){u.plannedDate='';changed++;}
          unscheduled++;
          continue;
        }
        const nd=slots[p].date;
        if(u.plannedDate!==nd){u.plannedDate=nd;changed++;}
        occupied.add(p);cursor=p+1;
      }
    }

    const dates=units.map(u=>u.plannedDate).filter(Boolean).sort();
    if(dates.length){q.startDate=dates[0];q.endDate=dates[dates.length-1];}
    else{q.startDate='';q.endDate='';}
  }

  // Vorhandene Wochenstunden bekommen nach der Neuverteilung sofort wieder das exakte
  // Soll-Thema ihres Datums. So wird z. B. ein frei gewordener Montag direkt mit dem
  // ersten Thema der Folgereihe belegt statt als leere Stunde stehenzubleiben.
  for(const l of state.lessons||[]){
    if(l.classId!==cid||v190YearFromDate(l.date)!==y||l.date<today||v191LessonProtected(l)||l.v180MovedFrom)continue;
    attachExactPlanV11(l);
  }

  if(unscheduled)warnings.push(`${unscheduled} Soll-Thema${unscheduled===1?' konnte':'en konnten'} nicht mehr auf einen freien regulären Fachtermin gelegt werden.`);
  const anchorProtected=options.anchorSequenceId?((seq(options.anchorSequenceId)?.plan||[]).filter(u=>fixedByUnit.has(u.id)).length):0;
  if(options.anchorSequenceId&&options.anchorDate&&anchorProtected)warnings.push('Bereits gehaltene oder konkret ausgearbeitete Stunden dieser Reihe blieben an ihrem bestehenden Termin.');
  return {changed,warning:[...new Set(warnings)].join('\n')};
};

// Nach dem Löschen einer Soll-Stunde sofort neu packen: Das nächste vorhandene Thema
// (auch aus der Folgereihe) rückt auf den frei gewordenen Fachtermin nach.
const v191DeleteUnitBefore=v188DeleteUnit;
v188DeleteUnit=async function(qid,unitId){
  const before=seq(qid),count=before?.plan?.length||0,cid=before?.classId,year=before?v190SeqYear(before):v190PlanningYear();
  await v191DeleteUnitBefore(qid,unitId);
  const after=seq(qid);
  if(after&&after.plan.length<count){
    const r=v190RescheduleCourseYear(cid,year,true);
    await saveState();modal={type:'sequence',id:qid};render();if(r.warning)alert(r.warning);
  }
};

// In der Jahresübersicht zählen ausschließlich echte Themen, nie historische Stundenwerte.
v190SequenceCard=function(q){
  const locked=v190SequenceLocked(q),count=(q.plan||[]).length,files=(q.sourceFilesV190||[]).length,missing=(q.plan||[]).reduce((n,u)=>n+(u.pendingMaterialReferencesV184||[]).length,0);
  return `<article class="v190-sequence-card ${locked?'locked':''}" data-v190-drop="${q.id}"><div class="v190-drag ${locked?'disabled':''}" ${locked?'':`draggable="true" data-v190-drag="${q.id}"`} title="${locked?'Bereits begonnen – Reihenfolge gesperrt':'Ziehen zum Verschieben'}">⋮⋮</div><button class="v190-sequence-main" data-sequence="${q.id}"><div><span class="eyebrow">${q.startDate?fmtDate(q.startDate):'Start offen'}${q.endDate?` → ${fmtDate(q.endDate)}`:''}</span><h3>${esc(q.title)}</h3><p>${esc(q.goal||'Reihenziel noch offen')}</p></div><div class="v190-seq-meta"><span>${count} Soll-Thema${count===1?'':'en'}</span>${files?`<span>${files} Planungsdatei${files===1?'':'en'}</span>`:''}${missing?`<span class="warn">${missing} Material offen</span>`:''}${locked?'<span>🔒 begonnen</span>':''}</div></button></article>`;
};

// Hinweis in der Reihenbearbeitung: Start/Ende steuern den Themenblock, nicht dessen Länge.
const v191SequencePanelBefore=sequencePanel;
sequencePanel=function(q){
  let h=v191SequencePanelBefore(q);if(!q)return h;
  const marker='</div></section><section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">REIHENPLANUNG · SOLL</span>';
  const note='<p class="microcopy"><strong>Terminlogik:</strong> Die Anzahl der Stunden ergibt sich nur aus den unten eingetragenen Soll-Themen. Änderst du den Start, wandert der Themenblock nach hinten/vorn; änderst du das Ende, wird der Block rückwärts an diesem Termin ausgerichtet. Es werden keine leeren Platzhalterstunden erzeugt.</p>';
  return h.includes(marker)?h.replace(marker,note+marker):h;
};

const v191WireBefore=wire;
wire=function(){
  v191WireBefore();

  // Start/Ende sind aktive Terminanker statt bloßer Textfelder.
  document.querySelectorAll('[data-sequence-field]').forEach(i=>{
    const [qid,key]=i.dataset.sequenceField.split('|');if(!['startDate','endDate'].includes(key))return;
    i.onchange=async()=>{
      const q=seq(qid);if(!q)return;const date=i.value;
      if(!date){q[key]='';await saveState();modal={type:'sequence',id:qid};render();return;}
      const r=v190RescheduleCourseYear(q.classId,v190SeqYear(q),true,{anchorSequenceId:q.id,anchorMode:key==='startDate'?'start':'end',anchorDate:date});
      await saveState();modal={type:'sequence',id:qid};render();if(r.warning)alert(r.warning);
    };
  });

  // Soll-Thema ergänzen/bearbeiten: Reihenfolge aus dem Editor übernehmen und danach
  // alle noch offenen Themen wieder lückenlos auf reale Fachtermine verteilen.
  const saveBtn=document.querySelector('[data-v182-unit-save]');
  if(saveBtn){
    const b=saveBtn.cloneNode(true);saveBtn.replaceWith(b);
    b.onclick=async()=>{
      const [qid,uidx]=b.dataset.v182UnitSave.split('|'),q=seq(qid);if(!q)return;
      const title=document.getElementById('v182-unit-title')?.value.trim(),date=document.getElementById('v182-unit-date')?.value||'';
      if(!title)return alert('Bitte ein Thema eintragen.');
      let u=q.plan.find(x=>x.id===uidx);
      if(!u){u=cleanPlanUnitV10({title,plannedDate:date});q.plan.push(u);}
      for(const [field,id] of [['title','title'],['plannedDate','date'],['objective','objective'],['content','content'],['material','material'],['notes','notes']])u[field]=document.getElementById('v182-unit-'+id)?.value?.trim()||'';
      q.plan.sort((a,c)=>(a.plannedDate||'9999').localeCompare(c.plannedDate||'9999'));
      const r=v190RescheduleCourseYear(q.classId,v190SeqYear(q),true);
      await saveState();modal={type:'sequence',id:qid};render();if(r.warning)alert(r.warning);
    };
  }
};

const v191RenderBefore=render;
render=function(){v191RenderBefore();const v=document.querySelector('.brand small');if(v)v.textContent=`${state.settings.schoolYear} · ${V191_VERSION}`;};

/* ===== V0.20.0 – datenschutzfreundliche Prüfungs-Auswertung =====
   Ziel:
   - Schülernamen, Antworten und individuelle Leistungsdaten bleiben in einer separaten
     lokalen IndexedDB und werden weder in ChatGPT-Prompts noch in Standard-Backups geschrieben.
   - Classtime-Excel wird ausschließlich lokal im Browser gelesen. Für ChatGPT wird nur
     eine anonymisierte Struktur ohne Schülerzeilen erzeugt.
   - Prüfungsanalyse folgt einem strikten "nicht raten"-Prinzip: Bei fehlenden oder
     widersprüchlichen Angaben soll ChatGPT Rückfragen stellen und KEIN Import-JSON erzeugen.
   - Papierpunkte werden pro Schüler:in vollständig tastaturfähig erfasst.
   - Kompetenzstufen, Bonusausgleich und kurze Rückmeldungen werden lokal berechnet.
   - Einzelne Kompetenzbögen können als PDF-ZIP bzw. als Sammel-PDF ausgegeben werden.
*/
const V200_VERSION='V0.20.0';
const V200_PRIVATE_DB='schulcockpit-assessment-private-v1';
const V200_PRIVATE_STORE='records';
let v200Eval=null;

function v200EnsureState(){
  if(!Array.isArray(state.competencyCatalogsV200))state.competencyCatalogsV200=[];
  for(const a of state.assessments||[]){
    if(!a.evaluationV200||typeof a.evaluationV200!=='object')a.evaluationV200={schema:1,analysis:null,updatedAt:''};
  }
}
function v200Assessment(id){v200EnsureState();return (state.assessments||[]).find(a=>a.id===id)||null;}
function v200CatalogForClass(classId,create=false){
  v200EnsureState();let cat=state.competencyCatalogsV200.find(x=>x.classId===classId);
  if(!cat&&create){cat={id:uid('compcat'),classId,title:'Hauscurriculum / Kompetenzgrundlage',files:[],topics:[],thresholds:null,updatedAt:new Date().toISOString()};state.competencyCatalogsV200.push(cat);}
  return cat||null;
}
function v200PrivateOpen(){return new Promise((resolve,reject)=>{const req=indexedDB.open(V200_PRIVATE_DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(V200_PRIVATE_STORE))req.result.createObjectStore(V200_PRIVATE_STORE,{keyPath:'assessmentId'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Privater Auswertungsspeicher konnte nicht geöffnet werden.'));});}
async function v200PrivateGet(assessmentId){const db=await v200PrivateOpen();try{return await new Promise((resolve,reject)=>{const r=db.transaction(V200_PRIVATE_STORE,'readonly').objectStore(V200_PRIVATE_STORE).get(assessmentId);r.onsuccess=()=>resolve(r.result||{assessmentId,roster:[],classtime:null,scores:{},paperScores:{},bonusScores:{},updatedAt:''});r.onerror=()=>reject(r.error);});}finally{db.close();}}
async function v200PrivatePut(rec){rec.updatedAt=new Date().toISOString();const db=await v200PrivateOpen();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(V200_PRIVATE_STORE,'readwrite');tx.objectStore(V200_PRIVATE_STORE).put(rec);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Private Auswertungsdaten konnten nicht gespeichert werden.'));});}finally{db.close();}}
async function v200PrivateDelete(assessmentId){const db=await v200PrivateOpen();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(V200_PRIVATE_STORE,'readwrite');tx.objectStore(V200_PRIVATE_STORE).delete(assessmentId);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}}

function v200Norm(s=''){return String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function v200SafeName(s='Datei'){return String(s||'Datei').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,'_').slice(0,100)||'Datei';}
function v200Num(v){if(v===null||v===undefined||v==='')return null;if(typeof v==='number'&&Number.isFinite(v))return v;const m=String(v).replace(',','.').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null;}
function v200ColLetters(n){let s='';for(let x=n+1;x>0;x=Math.floor((x-1)/26))s=String.fromCharCode(65+(x-1)%26)+s;return s;}
function v200ColIndex(ref=''){const m=String(ref).match(/^([A-Z]+)/i);if(!m)return 0;let n=0;for(const ch of m[1].toUpperCase())n=n*26+(ch.charCodeAt(0)-64);return n-1;}
function v200XmlText(node){if(!node)return '';return Array.from(node.getElementsByTagName('t')).map(x=>x.textContent||'').join('');}
function v200ZipPath(base,target){target=String(target||'').replace(/^\/+/, '');if(target.startsWith('xl/'))return target;const parts=(base+'/'+target).split('/'),out=[];for(const p of parts){if(!p||p==='.')continue;if(p==='..')out.pop();else out.push(p);}return out.join('/');}

async function v200ParseXlsx(file){
  const zip=await JSZip.loadAsync(file),parser=new DOMParser();
  const wbFile=zip.file('xl/workbook.xml');if(!wbFile)throw new Error('Die Datei enthält keine lesbare Excel-Arbeitsmappe.');
  const wb=parser.parseFromString(await wbFile.async('text'),'application/xml');
  const relFile=zip.file('xl/_rels/workbook.xml.rels');if(!relFile)throw new Error('Excel-Beziehungen konnten nicht gelesen werden.');
  const rel=parser.parseFromString(await relFile.async('text'),'application/xml'),rels={};
  Array.from(rel.getElementsByTagName('Relationship')).forEach(x=>rels[x.getAttribute('Id')]=x.getAttribute('Target'));
  let shared=[];const ssFile=zip.file('xl/sharedStrings.xml');if(ssFile){const ss=parser.parseFromString(await ssFile.async('text'),'application/xml');shared=Array.from(ss.getElementsByTagName('si')).map(v200XmlText);}
  const sheetNodes=Array.from(wb.getElementsByTagName('sheet')),sheets=[];
  for(const sn of sheetNodes){
    const name=sn.getAttribute('name')||`Tabelle ${sheets.length+1}`,rid=sn.getAttribute('r:id')||sn.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'),target=rels[rid];if(!target)continue;
    const path=v200ZipPath('xl',target),entry=zip.file(path);if(!entry)continue;
    const doc=parser.parseFromString(await entry.async('text'),'application/xml'),rows=[];
    for(const rn of Array.from(doc.getElementsByTagName('row'))){const ri=Math.max(0,(Number(rn.getAttribute('r'))||rows.length+1)-1),row=[];for(const cn of Array.from(rn.getElementsByTagName('c'))){const ci=v200ColIndex(cn.getAttribute('r')||''),t=cn.getAttribute('t')||'',v=cn.getElementsByTagName('v')[0]?.textContent??'',inline=cn.getElementsByTagName('is')[0];let value='';if(t==='s')value=shared[Number(v)]??'';else if(t==='inlineStr')value=v200XmlText(inline);else if(t==='b')value=v==='1';else if(t==='str')value=v;else if(v!==''){const n=Number(v);value=Number.isFinite(n)?n:v;}row[ci]=value;}rows[ri]=row;}
    sheets.push({name,rows:rows.map(r=>Array.isArray(r)?r:[])});
  }
  if(!sheets.length)throw new Error('In der Excel-Datei wurden keine Tabellenblätter gefunden.');
  return {fileName:file.name,importedAt:new Date().toISOString(),sheets};
}
function v200DetectClasstime(parsed){
  const nameRx=/(^| )(name|vor und nachname|vorname nachname|schuler|schueler|lernende|teilnehmer|student)( |$)/i;
  const aggregateRx=/^(durchschnitt|mittelwert|median|klasse|gesamt|total|average|mean)$/i;
  let best=null;
  parsed.sheets.forEach((s,si)=>{for(let r=0;r<Math.min(30,s.rows.length);r++){const row=s.rows[r]||[];let nameCol=-1;for(let c=0;c<row.length;c++)if(nameRx.test(v200Norm(row[c]))){nameCol=c;break;}if(nameCol<0)continue;const filled=row.filter(x=>String(x??'').trim()).length,questionish=row.filter((x,c)=>c!==nameCol&&/(frage|question|aufgabe|q ?\d+|^\d+[a-z]?$)/i.test(String(x??'').trim())).length;const score=100+filled+questionish*5;if(!best||score>best.score)best={sheetIndex:si,headerRow:r,nameCol,score};}});
  if(!best)return {sheetIndex:0,headerRow:0,nameCol:0,warning:'Namensspalte nicht sicher erkannt. Bitte die Erkennung unten prüfen.'};
  const sheet=parsed.sheets[best.sheetIndex],header=sheet.rows[best.headerRow]||[],rows=[];
  for(let r=best.headerRow+1;r<sheet.rows.length;r++){const row=sheet.rows[r]||[],name=String(row[best.nameCol]??'').trim();if(!name||aggregateRx.test(v200Norm(name)))continue;const nonEmpty=row.filter(x=>String(x??'').trim()!=='').length;if(nonEmpty<2)continue;rows.push({rowIndex:r,name,row});}
  return {...best,studentRows:rows,header};
}
function v200QuestionColumns(ct){if(!ct?.parsed||!ct?.detection)return[];const s=ct.parsed.sheets[ct.detection.sheetIndex],h=s?.rows?.[ct.detection.headerRow]||[];return h.map((x,i)=>({index:i,label:String(x??'').trim()||v200ColLetters(i)})).filter(x=>x.index!==ct.detection.nameCol&&!/^(gesamt|total|summe|punkte|score|prozent|percentage|rang|rank|email|e mail|klasse|class)$/i.test(v200Norm(x.label)));}
function v200AnonymizedClasstimeStructure(ct){if(!ct?.parsed)return 'Kein Classtime-Excel importiert.';const d=ct.detection,s=ct.parsed.sheets[d.sheetIndex],headers=v200QuestionColumns(ct);return [`# Anonymisierte Classtime-Struktur`,`Dateiname: ${ct.parsed.fileName}`,`Erkanntes Tabellenblatt: ${s?.name||'unbekannt'}`,`Erkannte Anzahl Teilnehmende: ${(d.studentRows||[]).length}`,`WICHTIG: Es wurden absichtlich keine Namen, Antworten oder individuellen Punktwerte exportiert.`,``,`## Spalten / Fragen`,...headers.map((h,i)=>`- ${i+1}. Spalte ${v200ColLetters(h.index)}: ${h.label||'(ohne Überschrift)'}`)].join('\n');}
function v200AssertNoStudentLeak(text,priv){const hay=String(text||'').toLocaleLowerCase('de-DE');for(const s of priv?.roster||[]){const n=String(s.name||'').trim().toLocaleLowerCase('de-DE');if(n.length>=3&&hay.includes(n))throw new Error('Datenschutz-Sperre: Im erzeugten ChatGPT-Text wurde ein Schülername erkannt. Der Export wurde blockiert.');}return true;}

function v200DefaultPrivate(assessmentId){return {assessmentId,roster:[],classtime:null,scores:{},paperScores:{},bonusScores:{},updatedAt:''};}
function v200MergeRoster(priv,detection){const oldByName=new Map((priv.roster||[]).map(s=>[v200Norm(s.name),s])),roster=[];for(const row of detection.studentRows||[]){const old=oldByName.get(v200Norm(row.name));roster.push({id:old?.id||`S${String(roster.length+1).padStart(3,'0')}`,name:row.name,rowIndex:row.rowIndex});}priv.roster=roster;}
async function v200ImportClasstimeFile(file){if(!v200Eval)throw new Error('Keine Auswertung geöffnet.');const parsed=await v200ParseXlsx(file),detection=v200DetectClasstime(parsed),priv=v200Eval.privateData||v200DefaultPrivate(v200Eval.assessmentId);v200MergeRoster(priv,detection);priv.classtime={parsed,detection,mapping:priv.classtime?.mapping||{},importedAt:new Date().toISOString()};v200Eval.privateData=priv;await v200PrivatePut(priv);render();}
function v200SetRosterFromText(text){if(!v200Eval)return;const names=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),priv=v200Eval.privateData||v200DefaultPrivate(v200Eval.assessmentId),old=new Map((priv.roster||[]).map(s=>[v200Norm(s.name),s]));priv.roster=names.map((name,i)=>({id:old.get(v200Norm(name))?.id||`S${String(i+1).padStart(3,'0')}`,name,rowIndex:null}));v200Eval.privateData=priv;return v200PrivatePut(priv);}

async function v200OpenEval(id){const a=v200Assessment(id);if(!a)return;const priv=await v200PrivateGet(id);v200Eval={assessmentId:id,step:1,studentIndex:0,privateData:priv||v200DefaultPrivate(id),rawImport:'',busy:false};modal={type:'assessmentEvalV200'};render();}
function v200EvalMeta(){return v200Assessment(v200Eval?.assessmentId)?.evaluationV200||null;}
function v200EvalAnalysis(){return v200EvalMeta()?.analysis||null;}
function v200AnalysisReady(){const an=v200EvalAnalysis();return !!(an&&Array.isArray(an.competencies)&&an.competencies.length&&Array.isArray(an.items)&&an.items.length&&Number.isFinite(Number(an.thresholds?.reachedMinPct))&&Number.isFinite(Number(an.thresholds?.partialMinPct)));}
function v200StatusFor(pct,thresholds){if(pct===null||pct===undefined||!Number.isFinite(pct))return '';const reached=Number(thresholds?.reachedMinPct),partial=Number(thresholds?.partialMinPct);if(!Number.isFinite(reached)||!Number.isFinite(partial))return '';return pct>=reached?'erreicht':pct>=partial?'teilweise erreicht':'noch nicht erreicht';}
function v200ModeLabel(src){return ({classtime:'Classtime',paper:'Papier',classtime_bonus:'Classtime · Bonus',paper_bonus:'Papier · Bonus'}[src]||src||'offen');}
function v200AnalysisSummary(an){if(!an)return '<p class="muted">Noch keine verbindliche Prüfungsanalyse importiert.</p>';const threshold=Number.isFinite(Number(an.thresholds?.reachedMinPct))?`erreicht ab ${an.thresholds.reachedMinPct}% · teilweise ab ${an.thresholds.partialMinPct}%`:'Bewertungsgrenzen fehlen';return `<div class="v200-analysis-summary"><div><strong>${an.competencies?.length||0}</strong><span>Kompetenzen</span></div><div><strong>${an.items?.length||0}</strong><span>bewertete Teilaufgaben</span></div><div><strong>${esc(threshold)}</strong><span>Kompetenzstufen</span></div></div>${an.notes?`<p class="microcopy">${esc(an.notes)}</p>`:''}`;}

function v200AssessmentAnalysisPrompt(a,priv){
  const c=cls(a.classId),cat=v200CatalogForClass(a.classId,false),ct=v200AnonymizedClasstimeStructure(priv?.classtime);
  const prompt=`# Schulcockpit – Prüfungsanalyse ohne Schülerdaten\n\n## Kontext\n- Fachkurs: ${c?.subject||''} ${c?.name||''}\n- Leistungsnachweis: ${a.title||a.type||'Leistungsnachweis'}\n- Datum: ${a.date||''}\n- eingetragener Stoff/Schwerpunkt: ${a.scope||'nicht eingetragen'}\n- Prüfungsdateien im Paket: ${(a.files||[]).map(f=>f.name).join(', ')||'keine'}\n- Kompetenz-/Bewertungsgrundlagen im Paket: ${(cat?.files||[]).map(f=>f.name).join(', ')||'keine'}\n\n## Datenschutz\nDu erhältst bewusst KEINE Schülernamen und KEINE individuellen Ergebnisse. Fordere sie nicht an. Für diese Analyse werden ausschließlich die Aufgabenstruktur, Kompetenzgrundlagen und Bewertungsregeln benötigt.\n\n## Verbindliche Sicherheitsregel: NICHT RATEN\nDiese Analyse wird später automatisch zur Rückmeldung an Schüler:innen verwendet. Deshalb gilt:\n- Erfinde niemals Prozentgrenzen, Punkte, Bonusregeln, Kompetenzformulierungen, Aufgaben-Zuordnungen oder Quellen.\n- Verwende Kompetenzformulierungen aus dem Hauscurriculum / der bereitgestellten Kompetenzgrundlage möglichst wortgetreu.\n- Wenn mehrere Quellen widersprechen, nenne den Widerspruch und frage nach.\n- Wenn eine Punkteangabe rechnerisch nicht zu Teilpunkten passt, frage nach.\n- Wenn nicht eindeutig ist, ob eine Sternchen-/Zusatzaufgabe Bonus ist oder zur regulären Maximalpunktzahl gehört, frage nach.\n- Wenn nicht sicher erkennbar ist, welche Teilaufgabe in Classtime und welche auf Papier bearbeitet wurde, frage nach.\n- Wenn Bewertungsgrenzen für „erreicht / teilweise erreicht / noch nicht erreicht“ fehlen, frage nach. Nimm KEINE üblichen oder vermeintlich plausiblen Grenzen an.\n- Wenn eine Kompetenz nur aus dem Aufgabentext abgeleitet werden könnte, obwohl eine verbindliche Curriculum-Formulierung verlangt wird, frage nach bzw. bitte um die Kompetenzgrundlage.\n\nWenn auch nur EIN obligatorischer Punkt unklar ist, gib zunächst NUR eine kurze nummerierte Überschrift „RÜCKFRAGEN“ mit den wirklich nötigen Fragen aus. Erzeuge dann NOCH KEINEN Importblock. Erst nachdem die Fragen im Chat geklärt wurden, darfst du den finalen Importblock erzeugen.\n\n## Auftrag\n1. Zerlege die tatsächlich geschriebene Arbeit in bewertbare Teilaufgaben. Eine Teilaufgabe soll genau einer primären Kompetenz zugeordnet sein. Falls Punkte mehrere Kompetenzen getrennt messen, teile die Aufgabe entsprechend auf.\n2. Kennzeichne für jede Teilaufgabe die Quelle: classtime, paper, classtime_bonus oder paper_bonus.\n3. Erfasse reguläre Maximalpunkte und Bonus-Maximalpunkte getrennt. Reine Bonusaufgaben haben regularMax = 0. Bonuspunkte erhöhen niemals den Nenner; sie dürfen fehlende reguläre Punkte innerhalb der zugeordneten Kompetenz und in der Gesamtwertung ausgleichen, jeweils maximal bis zur regulären Maximalpunktzahl.\n4. Ordne Kompetenzen dem curricularen Thema / Inhaltsbereich zu.\n5. Übernimm die verbindlichen Prozentgrenzen aus der Quelle.\n6. Nutze die anonymisierte Classtime-Struktur unten nur, um Spalten/Fragen wiederzuerkennen. Sie enthält absichtlich keine Schülerdaten.\n\n## Anonymisierte Classtime-Struktur\n${ct}\n\n## Finales Importformat – NUR wenn alles geklärt ist\nAntworte zuerst mit einer knappen Zusammenfassung und hänge danach GENAU EINEN Block in diesem Format an:\n\n<SCHULCOCKPIT_ASSESSMENT_IMPORT>\n{\n  "schema": "schulcockpit.assessment-analysis.v1",\n  "thresholds": {\n    "reachedMinPct": 0,\n    "partialMinPct": 0,\n    "source": "exakte Quellenangabe / Dateiname / Abschnitt"\n  },\n  "competencies": [\n    {\n      "id": "K1",\n      "topic": "curriculares Thema / Inhaltsbereich",\n      "text": "exakte Kompetenzformulierung",\n      "source": "Quelle der Formulierung"\n    }\n  ],\n  "items": [\n    {\n      "id": "A1a",\n      "label": "Aufgabe 1a",\n      "source": "classtime",\n      "regularMax": 3,\n      "bonusMax": 0,\n      "competencyId": "K1",\n      "classtimeAliases": ["exakte oder erkennbare Spaltenüberschrift aus dem anonymisierten Export"]\n    }\n  ],\n  "curriculum": {\n    "sourceTitle": "Name der Kompetenzgrundlage",\n    "topics": [\n      {"title": "Thema", "competencyIds": ["K1"]}\n    ]\n  },\n  "notes": "nur bestätigte Besonderheiten"\n}\n</SCHULCOCKPIT_ASSESSMENT_IMPORT>\n\nValidierung:\n- reachedMinPct und partialMinPct sind echte Prozentwerte aus der bereitgestellten Quelle, nicht geraten.\n- reachedMinPct > partialMinPct.\n- Jede item.id ist eindeutig.\n- Jede Teilaufgabe hat genau eine competencyId.\n- Bonusaufgaben erhöhen regularMax nicht.\n- classtimeAliases enthalten nur Spalten-/Fragebezeichnungen, niemals Namen oder Antworten von Lernenden.\n`;
  v200AssertNoStudentLeak(prompt,priv);return prompt;
}
function v200ExtractAnalysis(text){const m=String(text||'').match(/<SCHULCOCKPIT_ASSESSMENT_IMPORT>\s*([\s\S]*?)\s*<\/SCHULCOCKPIT_ASSESSMENT_IMPORT>/);if(!m)throw new Error('Kein SCHULCOCKPIT_ASSESSMENT_IMPORT-Block gefunden. Wenn ChatGPT Rückfragen gestellt hat, beantworte diese zuerst und importiere erst die danach erzeugte finale Antwort.');let obj;try{obj=JSON.parse(m[1]);}catch(e){throw new Error('Der Prüfungsanalyse-Block enthält kein valides JSON.');}if(obj.schema!=='schulcockpit.assessment-analysis.v1')throw new Error('Unbekanntes Prüfungsanalyse-Schema.');if(!Array.isArray(obj.competencies)||!obj.competencies.length)throw new Error('Es wurden keine Kompetenzen geliefert.');if(!Array.isArray(obj.items)||!obj.items.length)throw new Error('Es wurden keine Teilaufgaben geliefert.');const r=Number(obj.thresholds?.reachedMinPct),p=Number(obj.thresholds?.partialMinPct);if(!Number.isFinite(r)||!Number.isFinite(p)||r<=p||p<0||r>100)throw new Error('Die Kompetenzgrenzen fehlen oder sind unplausibel. Bitte in ChatGPT klären statt Werte zu raten.');const ids=new Set(obj.competencies.map(x=>x.id));const itemIds=new Set();for(const it of obj.items){if(!it.id||itemIds.has(it.id))throw new Error('Teilaufgaben benötigen eindeutige IDs.');itemIds.add(it.id);if(!ids.has(it.competencyId))throw new Error(`Teilaufgabe ${it.id} verweist auf eine unbekannte Kompetenz.`);if(!['classtime','paper','classtime_bonus','paper_bonus'].includes(it.source))throw new Error(`Teilaufgabe ${it.id} hat eine unbekannte Quelle.`);const rm=Number(it.regularMax),bm=Number(it.bonusMax||0);if(!Number.isFinite(rm)||rm<0||!Number.isFinite(bm)||bm<0)throw new Error(`Punkteangaben bei ${it.id} sind ungültig.`);if((it.source.endsWith('_bonus')||bm>0)&&rm>0&&it.source.endsWith('_bonus'))throw new Error(`Reine Bonusaufgabe ${it.id} darf keine regulären Maximalpunkte haben.`);}return obj;}
async function v200ImportAnalysis(text){const a=v200Assessment(v200Eval.assessmentId),obj=v200ExtractAnalysis(text);a.evaluationV200={schema:1,analysis:obj,updatedAt:new Date().toISOString()};const cat=v200CatalogForClass(a.classId,true);if(obj.curriculum?.sourceTitle)cat.title=obj.curriculum.sourceTitle;if(Array.isArray(obj.curriculum?.topics))cat.topics=obj.curriculum.topics.map(t=>({title:t.title||'',competencyIds:Array.isArray(t.competencyIds)?t.competencyIds:[]}));cat.thresholds={...obj.thresholds};cat.competencies=obj.competencies.map(x=>({...x}));cat.updatedAt=new Date().toISOString();await saveState();v200Eval.rawImport='';render();}

async function v200UploadCatalogFiles(files){const a=v200Assessment(v200Eval.assessmentId),cat=v200CatalogForClass(a.classId,true);for(const f of files||[]){const id=uid('cfile'),key=`competency-${cat.id}-${id}`;await fileStorePut(key,f);storedFileKeys.add(key);cat.files.push({id,name:f.name,type:f.type||'',size:f.size||0,fileKey:key,addedAt:new Date().toISOString()});}cat.updatedAt=new Date().toISOString();await saveState();render();}
async function v200RemoveCatalogFile(id){const a=v200Assessment(v200Eval.assessmentId),cat=v200CatalogForClass(a.classId,false),f=cat?.files?.find(x=>x.id===id);if(!f)return;await fileStoreDelete(f.fileKey);storedFileKeys.delete(f.fileKey);cat.files=cat.files.filter(x=>x.id!==id);await saveState();render();}
async function v200DownloadAnalysisBundle(){const a=v200Assessment(v200Eval.assessmentId),priv=v200Eval.privateData,cat=v200CatalogForClass(a.classId,false),prompt=v200AssessmentAnalysisPrompt(a,priv);v200AssertNoStudentLeak(prompt,priv);const z=new JSZip();z.file('00_PROMPT_Pruefungsanalyse.txt',prompt);z.file('01_Classtime_Struktur_ANONYM.txt',v200AnonymizedClasstimeStructure(priv?.classtime));for(const f of a.files||[]){const rec=await fileStoreGet(f.fileKey);if(rec?.blob)z.file('Pruefung/'+f.name,rec.blob);}for(const f of cat?.files||[]){const rec=await fileStoreGet(f.fileKey);if(rec?.blob)z.file('Kompetenzgrundlage/'+f.name,rec.blob);}const blob=await z.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});downloadBlob(`Schulcockpit_${v200SafeName(a.title||'Pruefung')}_Analysepaket_OHNE_SCHUELERDATEN.zip`,blob);}

function v200ItemMapOptions(priv,it){const cols=v200QuestionColumns(priv?.classtime),mapped=priv?.classtime?.mapping?.[it.id];return `<select data-v200-map-item="${esc(it.id)}"><option value="">— nicht zugeordnet —</option>${cols.map(c=>`<option value="${c.index}" ${String(c.index)===String(mapped)?'selected':''}>${esc(v200ColLetters(c.index)+' · '+c.label)}</option>`).join('')}</select>`;}
function v200AutoMapItems(priv,an){if(!priv?.classtime||!an)return;priv.classtime.mapping=priv.classtime.mapping||{};const cols=v200QuestionColumns(priv.classtime);for(const it of an.items.filter(x=>x.source.startsWith('classtime'))){if(priv.classtime.mapping[it.id]!==undefined&&priv.classtime.mapping[it.id]!==null&&priv.classtime.mapping[it.id]!=='')continue;const aliases=(it.classtimeAliases||[]).map(v200Norm).filter(Boolean);let hit=cols.find(c=>aliases.includes(v200Norm(c.label)));if(!hit)hit=cols.find(c=>aliases.some(a=>a&&v200Norm(c.label).includes(a)));if(hit)priv.classtime.mapping[it.id]=hit.index;}}
function v200ApplyClasstimeScores(priv,an){if(!priv?.classtime||!an)return;v200AutoMapItems(priv,an);priv.scores=priv.scores||{};const d=priv.classtime.detection,s=priv.classtime.parsed.sheets[d.sheetIndex];for(const stu of priv.roster||[]){priv.scores[stu.id]=priv.scores[stu.id]||{};const row=s.rows[stu.rowIndex]||[];for(const it of an.items.filter(x=>x.source==='classtime')){const ci=priv.classtime.mapping?.[it.id];if(ci===undefined||ci===null||ci==='')continue;const n=v200Num(row[Number(ci)]);if(n===null)continue;priv.scores[stu.id][it.id]=Math.max(0,Math.min(Number(it.regularMax)||0,n));}}}
async function v200SaveMappingAndScores(){const an=v200EvalAnalysis(),priv=v200Eval.privateData;if(!an||!priv?.classtime)return;document.querySelectorAll('[data-v200-map-item]').forEach(sel=>{priv.classtime.mapping=priv.classtime.mapping||{};priv.classtime.mapping[sel.dataset.v200MapItem]=sel.value===''?'':Number(sel.value);});v200ApplyClasstimeScores(priv,an);await v200PrivatePut(priv);render();}

function v200GetScore(priv,stuId,it){if(it.source==='paper')return priv.paperScores?.[stuId]?.[it.id]??null;if(it.source==='classtime')return priv.scores?.[stuId]?.[it.id]??null;if(it.source==='paper_bonus'||it.source==='classtime_bonus')return priv.bonusScores?.[stuId]?.[it.id]??null;return null;}
async function v200SetScore(stuId,itId,value,kind){const priv=v200Eval.privateData,n=value===''?null:Number(String(value).replace(',','.'));if(kind==='paper'){priv.paperScores=priv.paperScores||{};priv.paperScores[stuId]=priv.paperScores[stuId]||{};priv.paperScores[stuId][itId]=Number.isFinite(n)?n:null;}else{priv.bonusScores=priv.bonusScores||{};priv.bonusScores[stuId]=priv.bonusScores[stuId]||{};priv.bonusScores[stuId][itId]=Number.isFinite(n)?n:null;}await v200PrivatePut(priv);}
function v200StudentCompleteness(priv,an,stu){let need=0,done=0;for(const it of an?.items||[]){need++;const v=v200GetScore(priv,stu.id,it);if(v!==null&&v!==undefined&&v!=='')done++;}return {need,done,complete:need===done};}
function v200StudentReport(priv,an,stu){
  const compMap=new Map((an.competencies||[]).map(c=>[c.id,{...c,regularMax:0,regularEarned:0,bonusEarned:0,itemLabels:[]}])) ;let totalMax=0,totalReg=0,totalBonus=0,missing=[];
  for(const it of an.items||[]){const c=compMap.get(it.competencyId);if(!c)continue;const raw=v200GetScore(priv,stu.id,it);if(raw===null||raw===undefined||raw===''){missing.push(it.label||it.id);continue;}const v=Math.max(0,Number(raw)||0);c.itemLabels.push(it.label||it.id);if(it.source.endsWith('_bonus')||Number(it.regularMax)===0){c.bonusEarned+=Math.min(Number(it.bonusMax)||0,v);totalBonus+=Math.min(Number(it.bonusMax)||0,v);}else{c.regularMax+=Number(it.regularMax)||0;c.regularEarned+=Math.min(Number(it.regularMax)||0,v);totalMax+=Number(it.regularMax)||0;totalReg+=Math.min(Number(it.regularMax)||0,v);}}
  const competencies=[...compMap.values()].map(c=>{const adjusted=Math.min(c.regularMax,c.regularEarned+c.bonusEarned),pct=c.regularMax?adjusted/c.regularMax*100:null;return {...c,adjusted,pct,status:v200StatusFor(pct,an.thresholds)};});const totalAdjusted=Math.min(totalMax,totalReg+totalBonus),totalPct=totalMax?totalAdjusted/totalMax*100:null;return {student:stu,competencies,totalMax,totalReg,totalBonus,totalAdjusted,totalPct,missing,complete:missing.length===0};
}
function v200Feedback(report,a){const subject=(cls(a.classId)?.subject||'').toLowerCase(),cs=report.competencies.filter(c=>c.regularMax>0&&c.pct!==null).sort((x,y)=>y.pct-x.pct);if(!cs.length)return {strength:'',next:''};const best=cs[0],low=cs[cs.length-1];let strength=best.status==='erreicht'?best.text:`Hier kannst du bereits anknüpfen: ${best.text}`;let next='';if(low.status==='erreicht')next=`Halte besonders diese Kompetenz weiter sicher: ${low.text}`;else{const tasks=[...new Set(low.itemLabels)].filter(Boolean).join(', ');next=`Dein nächster Schritt: ${low.text}${subject.includes('mathe')&&tasks?` Schau dir dafür besonders ${tasks} noch einmal an.`:''}`;}return {strength,next};}

function v200PdfEscape(s=''){return String(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[\u2013\u2014]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[^\x00-\xFF]/g,'?');}
function v200Wrap(s,max=60){const words=String(s||'').split(/\s+/).filter(Boolean),lines=[];let cur='';for(const w of words){if(!cur)cur=w;else if((cur+' '+w).length<=max)cur+=' '+w;else{lines.push(cur);cur=w;}}if(cur)lines.push(cur);return lines.length?lines:[''];}
function v200PdfText(x,y,size,text){return `BT /F1 ${size} Tf ${x} ${y} Td (${v200PdfEscape(text)}) Tj ET\n`;}
function v200PdfReportPage(report,a){
  const fb=v200Feedback(report,a),lines=[];let y=800;lines.push(v200PdfText(42,y,16,`Beurteilung ${a.title||a.type||'Leistungsnachweis'}`));y-=24;lines.push(v200PdfText(42,y,11,report.student.name));y-=17;lines.push(v200PdfText(42,y,9,`${a.date||''} · ${cls(a.classId)?.subject||''} ${cls(a.classId)?.name||''}`));y-=28;
  const xs=[42,332,392,452,553],headerH=28;lines.push(`${xs[0]} ${y-headerH} ${xs[4]-xs[0]} ${headerH} re S\n`);for(let i=1;i<xs.length-1;i++)lines.push(`${xs[i]} ${y-headerH} m ${xs[i]} ${y} l S\n`);lines.push(v200PdfText(48,y-18,9,'Kompetenz'));lines.push(v200PdfText(338,y-18,8,'Punkte'));lines.push(v200PdfText(398,y-18,8,'moegl.'));lines.push(v200PdfText(458,y-18,8,'Beurteilung'));y-=headerH;
  for(const c of report.competencies.filter(x=>x.regularMax>0)){const wrapped=v200Wrap(c.text,52),h=Math.max(34,16+wrapped.length*11);lines.push(`${xs[0]} ${y-h} ${xs[4]-xs[0]} ${h} re S\n`);for(let i=1;i<xs.length-1;i++)lines.push(`${xs[i]} ${y-h} m ${xs[i]} ${y} l S\n`);wrapped.forEach((t,i)=>lines.push(v200PdfText(48,y-15-i*11,8.5,t)));lines.push(v200PdfText(342,y-20,9,String(Math.round(c.adjusted*100)/100)));lines.push(v200PdfText(403,y-20,9,String(Math.round(c.regularMax*100)/100)));lines.push(v200PdfText(458,y-20,8.2,c.status||'-'));y-=h;if(y<220)break;}
  y-=18;lines.push(v200PdfText(42,y,10,'Deine Rueckmeldung'));y-=18;for(const t of v200Wrap(`Das gelingt dir bereits: ${fb.strength}`,88)){lines.push(v200PdfText(42,y,9,t));y-=12;}y-=5;for(const t of v200Wrap(fb.next,88)){lines.push(v200PdfText(42,y,9,t));y-=12;}y-=18;const bonus=report.totalBonus>0?` · Bonus angerechnet: ${Math.round(report.totalBonus*100)/100}`:'';lines.push(v200PdfText(42,y,9,`Gesamt: ${Math.round(report.totalAdjusted*100)/100} / ${Math.round(report.totalMax*100)/100} Punkte${bonus}`));y-=35;lines.push(v200PdfText(42,y,8,'e: erreicht · te: teilweise erreicht · nne: noch nicht erreicht'));y-=42;lines.push(v200PdfText(42,y,8,'Datum / Unterschrift der Fachlehrkraft'));lines.push(v200PdfText(338,y,8,'Unterschrift eines Erziehungsberechtigten'));return lines.join('');
}
function v200PdfBytes(reports,a){
  const objects=[];const fontId=3,pagesId=2;const pageIds=[],contentIds=[];let next=4;for(let i=0;i<reports.length;i++){pageIds.push(next++);contentIds.push(next++);}objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[2]=`<< /Type /Pages /Kids [${pageIds.map(x=>x+' 0 R').join(' ')}] /Count ${pageIds.length} >>`;objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';reports.forEach((r,i)=>{const content=v200PdfReportPage(r,a),cid=contentIds[i],pid=pageIds[i];objects[pid]=`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${cid} 0 R >>`;objects[cid]=`<< /Length ${content.length} >>\nstream\n${content}endstream`;});let pdf='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n',offsets=[0];for(let i=1;i<objects.length;i++){if(objects[i]===undefined)continue;offsets[i]=pdf.length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}const xref=pdf.length,max=objects.length-1;pdf+=`xref\n0 ${max+1}\n0000000000 65535 f \n`;for(let i=1;i<=max;i++)pdf+=(String(offsets[i]||0).padStart(10,'0')+' 00000 n \n');pdf+=`trailer\n<< /Size ${max+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;const out=new Uint8Array(pdf.length);for(let i=0;i<pdf.length;i++)out[i]=pdf.charCodeAt(i)&255;return out;
}
function v200ReportList(){const a=v200Assessment(v200Eval.assessmentId),an=v200EvalAnalysis(),priv=v200Eval.privateData;if(!a||!an)return[];return (priv.roster||[]).map(s=>v200StudentReport(priv,an,s));}
async function v200DownloadPdfZip(){const a=v200Assessment(v200Eval.assessmentId),reports=v200ReportList(),complete=reports.filter(r=>r.complete);if(!complete.length)return alert('Noch kein vollständiger Kompetenzbogen verfügbar.');if(complete.length<reports.length&&!confirm(`${reports.length-complete.length} Schüler:innen haben noch unvollständige Ergebnisse und werden ausgelassen. Fortfahren?`))return;const z=new JSZip();for(const r of complete){const bytes=v200PdfBytes([r],a),fn=`${v200SafeName(r.student.name)}_${v200SafeName(a.title||'Kompetenzbogen')}.pdf`;z.file(fn,bytes);}z.file('HINWEIS_DATENSCHUTZ.txt','Dieses ZIP enthaelt personenbezogene Leistungsdaten. Nicht in ChatGPT oder andere nicht freigegebene Dienste hochladen.');downloadBlob(`${v200SafeName(cls(a.classId)?.name||'Klasse')}_${v200SafeName(a.title||'Kompetenzboegen')}_PDF.zip`,await z.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}}));}
function v200DownloadCombinedPdf(){const a=v200Assessment(v200Eval.assessmentId),reports=v200ReportList(),complete=reports.filter(r=>r.complete);if(!complete.length)return alert('Noch kein vollständiger Kompetenzbogen verfügbar.');downloadBlob(`${v200SafeName(cls(a.classId)?.name||'Klasse')}_${v200SafeName(a.title||'Kompetenzboegen')}_gesamt.pdf`,new Blob([v200PdfBytes(complete,a)],{type:'application/pdf'}));}
function v200DownloadPrivateBackup(){const a=v200Assessment(v200Eval.assessmentId),priv=v200Eval.privateData;if(!confirm('Dieses Backup enthält Namen, Antworten bzw. Leistungsdaten. Es darf NICHT in ChatGPT hochgeladen werden. Jetzt lokal herunterladen?'))return;downloadText(`SENSIBEL_${v200SafeName(a.title||'Pruefung')}_Auswertungsbackup.json`,JSON.stringify({schema:'schulcockpit.private-assessment.v1',assessment:{id:a.id,title:a.title,date:a.date,classLabel:`${cls(a.classId)?.subject||''} ${cls(a.classId)?.name||''}`},data:priv},null,2),'application/json');}

function v200StepNav(step){const labels=['','1 · Grundlagen lokal','2 · ChatGPT-Analyse','3 · Classtime-Zuordnung','4 · Papier / Bonus','5 · Rückgabe'];return `<div class="v200-steps">${[1,2,3,4,5].map(n=>`<button class="${n===step?'active':''} ${n<step?'done':''}" data-v200-step="${n}">${labels[n]}</button>`).join('')}</div>`;}
function v200Step1(a,priv){const cat=v200CatalogForClass(a.classId,false),ct=priv?.classtime,d=ct?.detection;const catFiles=(cat?.files||[]).map(f=>`<div class="v188-file-row"><span><strong>${esc(f.name)}</strong><small>lokal als wiederverwendbare Kompetenzgrundlage</small></span><button class="danger-lite small" data-v200-cat-remove="${f.id}">×</button></div>`).join('');return `<section class="detail-section v200-privacy"><strong>🔒 Schülerdaten bleiben lokal.</strong><p>Namen, Antworten und individuelle Punkte werden in einem getrennten lokalen Browser-Speicher gehalten. Sie landen weder in ChatGPT-Prompts noch im normalen Schulcockpit-Backup. Die Classtime-Excel wird hier lokal gelesen – nicht zu ChatGPT hochgeladen.</p></section><section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">CLASSTIME · LOKAL</span><h3>Excel-Ergebnisse importieren</h3></div><label class="upload-button">Excel lokal auswählen<input id="v200-classtime-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label></div>${ct?`<div class="v200-detected"><strong>✓ ${esc(ct.parsed.fileName)}</strong><span>${esc(ct.parsed.sheets[d.sheetIndex]?.name||'Tabelle')} · ${d.studentRows?.length||0} Schüler:innen erkannt · Namensspalte ${v200ColLetters(d.nameCol)}</span>${d.warning?`<small class="warn">${esc(d.warning)}</small>`:''}</div>`:'<p class="muted">Noch keine Classtime-Excel importiert. Bei reinen Papierarbeiten kannst du stattdessen unten lokal eine Schülerliste einfügen.</p>'}<details><summary>Schülerliste lokal prüfen / Papierklasse ohne Classtime</summary><textarea id="v200-roster-text" rows="7" placeholder="Ein Name pro Zeile. Diese Liste bleibt ausschließlich lokal.">${esc((priv.roster||[]).map(s=>s.name).join('\n'))}</textarea><button class="secondary" data-v200-roster-save>Schülerliste lokal speichern</button></details></section><section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">KOMPETENZGRUNDLAGE</span><h3>Hauscurriculum / Bewertungsregeln</h3></div><label class="upload-button">Grundlage hinzufügen<input id="v200-cat-files" type="file" multiple hidden></label></div><p class="muted">Diese Dateien enthalten keine Schülerdaten und können für spätere Arbeiten desselben Kurses wiederverwendet werden. ChatGPT soll daraus die exakten Kompetenzformulierungen und Prozentgrenzen übernehmen – oder nachfragen, wenn etwas fehlt.</p><div class="v188-assessment-files">${catFiles||'<p class="muted">Noch keine Kompetenzgrundlage hinterlegt. Ohne verbindliche Quelle muss ChatGPT bei fehlenden Prozentgrenzen oder exakten Formulierungen nachfragen.</p>'}</div></section><div class="v200-actions"><button class="secondary" data-v200-private-backup>Optional: sensibles lokales Backup</button><button class="primary" data-v200-step="2">Weiter zur Prüfungsanalyse →</button></div>`;}
function v200Step2(a,priv){const prompt=v200AssessmentAnalysisPrompt(a,priv);return `<section class="detail-section"><span class="eyebrow">SCHRITT 2 · KEINE SCHÜLERDATEN</span><h3>Prüfung einmal mit ChatGPT strukturieren</h3><p>Das Paket enthält deinen Prüfungs-Prompt, die leeren Prüfungsdateien, die Kompetenzgrundlagen und – falls vorhanden – nur die <strong>anonymisierte Classtime-Spaltenstruktur</strong>. Keine Schülerzeile wird hineingepackt.</p><div class="v200-actions"><button class="secondary" data-v200-copy-prompt>Prompt kopieren</button><button class="primary" data-v200-analysis-bundle>Analysepaket ohne Schülerdaten herunterladen</button></div><textarea class="v200-prompt" rows="10" readonly>${esc(prompt)}</textarea></section><section class="detail-section"><span class="eyebrow">ANTWORT ZURÜCK INS COCKPIT</span><h3>Finale ChatGPT-Antwort importieren</h3><p class="muted">Wenn ChatGPT Rückfragen stellt: noch nichts importieren. Erst Fragen im Chat klären. Nur eine finale Antwort mit <code>SCHULCOCKPIT_ASSESSMENT_IMPORT</code> gehört hier hinein.</p>${v200AnalysisSummary(v200EvalAnalysis())}<textarea id="v200-analysis-import" rows="10" placeholder="Komplette finale ChatGPT-Antwort hier einfügen …">${esc(v200Eval.rawImport||'')}</textarea><div class="v200-actions"><button class="secondary" data-v200-step="1">← Grundlagen</button><button class="primary" data-v200-analysis-import>Analyse übernehmen</button><button class="primary" data-v200-step="3" ${v200AnalysisReady()?'':'disabled'}>Weiter zu Ergebnissen →</button></div></section>`;}
function v200Step3(a,priv){const an=v200EvalAnalysis();if(!an)return '<section class="detail-section"><p>Bitte zuerst Schritt 2 abschließen.</p></section>';v200AutoMapItems(priv,an);const digital=an.items.filter(x=>x.source==='classtime'),ct=priv.classtime;return `<section class="detail-section"><span class="eyebrow">SCHRITT 3 · CLASSTIME</span><h3>Digitale Fragen automatisch zuordnen</h3>${ct?`<p class="muted">Schulcockpit versucht die von ChatGPT erkannten Classtime-Fragen anhand der anonymisierten Spaltenüberschriften automatisch zuzuordnen. Prüfen musst du nur offene Treffer.</p><div class="v200-map-table"><div class="head">Teilaufgabe</div><div class="head">Punkte</div><div class="head">Classtime-Spalte</div>${digital.map(it=>`<div><strong>${esc(it.label||it.id)}</strong><small>${esc(v200ModeLabel(it.source))}</small></div><div>${Number(it.regularMax)||0}</div><div>${v200ItemMapOptions(priv,it)}</div>`).join('')}</div><div class="v200-actions"><button class="primary" data-v200-map-save>Zuordnung speichern & Punkte übernehmen</button></div>`:'<p class="warnbox">Für diese Auswertung wurde noch keine Classtime-Excel lokal importiert. Falls es eine gibt, gehe zurück zu Schritt 1.</p>'}</section><section class="detail-section"><span class="eyebrow">LOKALE TEILNEHMERLISTE</span><h3>${priv.roster?.length||0} Schüler:innen</h3><p class="muted">Die Namen werden nur lokal angezeigt. In Schritt 2 wurden sie technisch aus dem Prompt ausgeschlossen.</p><div class="v200-roster-chips">${(priv.roster||[]).map(s=>`<span>${esc(s.name)}</span>`).join('')}</div></section><div class="v200-actions"><button class="secondary" data-v200-step="2">← Analyse</button><button class="primary" data-v200-step="4" ${priv.roster?.length?'':'disabled'}>Weiter zur manuellen Eingabe →</button></div>`;}
function v200ScoreInput(stu,it,kind){const priv=v200Eval.privateData,v=v200GetScore(priv,stu.id,it),max=kind==='paper'?Number(it.regularMax)||0:Number(it.bonusMax)||0;return `<label class="v200-score-field"><span>${esc(it.label||it.id)}</span><small>${kind==='paper'?`0–${max} regulär`:`0–${max} Bonus`} · ${esc(v200ModeLabel(it.source))}</small><input inputmode="decimal" data-v200-score="${stu.id}|${it.id}|${kind}" min="0" max="${max}" step="0.25" value="${v===null||v===undefined?'':esc(v)}"></label>`;}
function v200Step4(a,priv){const an=v200EvalAnalysis(),roster=priv.roster||[];if(!an||!roster.length)return '<section class="detail-section"><p>Bitte zuerst Ergebnisse und Schülerliste vorbereiten.</p></section>';v200Eval.studentIndex=Math.max(0,Math.min(v200Eval.studentIndex||0,roster.length-1));const stu=roster[v200Eval.studentIndex],paper=an.items.filter(x=>x.source==='paper'),bonus=an.items.filter(x=>x.source==='paper_bonus'||x.source==='classtime_bonus'),comp=v200StudentCompleteness(priv,an,stu);return `<section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">SCHRITT 4 · SCHÜLER:IN ${v200Eval.studentIndex+1}/${roster.length}</span><h3>${esc(stu.name)}</h3><p>${comp.done}/${comp.need} Teilaufgaben erfasst</p></div><div class="v200-student-nav"><button class="secondary" data-v200-prev-student ${v200Eval.studentIndex===0?'disabled':''}>←</button><button class="secondary" data-v200-next-student ${v200Eval.studentIndex>=roster.length-1?'disabled':''}>→</button></div></div><div class="v200-score-grid">${paper.map(it=>v200ScoreInput(stu,it,'paper')).join('')||'<p class="muted">Keine regulären Papieraufgaben laut Analyse.</p>'}${bonus.map(it=>v200ScoreInput(stu,it,'bonus')).join('')}</div><p class="microcopy"><strong>Tastaturmodus:</strong> Zahl eingeben → Enter. Der Fokus springt direkt zur nächsten Aufgabe; nach dem letzten Feld automatisch zum nächsten Kind. Die Maus ist nicht nötig.</p></section><div class="v200-actions"><button class="secondary" data-v200-step="3">← Classtime</button><button class="primary" data-v200-step="5">Auswertung ansehen →</button></div>`;}
function v200Step5(a,priv){const an=v200EvalAnalysis(),reports=v200ReportList(),complete=reports.filter(r=>r.complete),missing=reports.filter(r=>!r.complete);const rows=reports.map(r=>{const fb=v200Feedback(r,a);return `<div class="v200-report-row ${r.complete?'':'incomplete'}"><div><strong>${esc(r.student.name)}</strong><small>${r.complete?`${Math.round(r.totalAdjusted*100)/100}/${Math.round(r.totalMax*100)/100} Punkte`:`Fehlt: ${esc(r.missing.join(', '))}`}</small></div><div>${r.complete?`<span>${esc(fb.strength)}</span><small>${esc(fb.next)}</small>`:'<span class="warn">noch nicht vollständig</span>'}</div></div>`;}).join('');const agg=(an.competencies||[]).map(c=>{const vals=complete.map(r=>r.competencies.find(x=>x.id===c.id)).filter(x=>x&&x.pct!==null),reached=vals.filter(x=>x.status==='erreicht').length,partial=vals.filter(x=>x.status==='teilweise erreicht').length,not=vals.filter(x=>x.status==='noch nicht erreicht').length;return `<div class="v200-agg-row"><strong>${esc(c.text)}</strong><span>${reached} erreicht · ${partial} teilweise · ${not} noch nicht</span></div>`;}).join('');return `<section class="detail-section"><span class="eyebrow">SCHRITT 5 · RÜCKGABE</span><h3>${complete.length}/${reports.length} Kompetenzbögen vollständig</h3>${missing.length?`<p class="warnbox">${missing.length} Schüler:innen haben noch fehlende Werte. Das ist z. B. bei Nachschreibenden okay; sie werden beim PDF-Export zunächst ausgelassen.</p>`:''}<div class="v200-report-list">${rows}</div></section><section class="detail-section"><span class="eyebrow">KLASSENBLICK</span><h3>Welche Kompetenzen müssen noch einmal aufgegriffen werden?</h3><div class="v200-aggregate">${agg}</div></section><div class="v200-actions"><button class="secondary" data-v200-step="4">← Punkte</button><button class="secondary" data-v200-combined-pdf ${complete.length?'':'disabled'}>Gesamt-PDF</button><button class="primary" data-v200-pdf-zip ${complete.length?'':'disabled'}>Alle Kompetenzbögen als PDF-ZIP</button></div>`;}
function v200EvaluationModal(){const a=v200Assessment(v200Eval?.assessmentId);if(!a)return '';const priv=v200Eval.privateData||v200DefaultPrivate(a.id),c=cls(a.classId),step=v200Eval.step||1;return `<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-xwide v200-modal" data-modal-stop><header class="modal-header"><div><span class="eyebrow">PRÜFUNG AUSWERTEN · ${esc(c?.subject||'')} ${esc(c?.name||'')}</span><h2>${esc(a.title||a.type||'Leistungsnachweis')}</h2></div><button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">${v200StepNav(step)}${step===1?v200Step1(a,priv):step===2?v200Step2(a,priv):step===3?v200Step3(a,priv):step===4?v200Step4(a,priv):v200Step5(a,priv)}</div></section></div>`;}

const v200ModalBefore=modalHtml;
modalHtml=function(){if(modal?.type==='assessmentEvalV200'&&v200Eval)return v200EvaluationModal();return v200ModalBefore();};

const v200PanelYearBefore=v190AssessmentPanelYear;
v190AssessmentPanelYear=function(year=v190PlanningYear()){let h=v200PanelYearBefore(year);return h.replace(/<button class="secondary" data-v188-assessment-edit="([^"]+)">Bearbeiten<\/button>/g,`<button class="v200-eval-button" data-v200-eval-open="$1">Auswertung & Rückgabe</button><button class="secondary" data-v188-assessment-edit="$1">Bearbeiten</button>`);};
const v200PanelBefore=v188AssessmentPanel;
v188AssessmentPanel=function(){let h=v200PanelBefore();return h.replace(/<button class="secondary" data-v188-assessment-edit="([^"]+)">Bearbeiten<\/button>/g,`<button class="v200-eval-button" data-v200-eval-open="$1">Auswertung & Rückgabe</button><button class="secondary" data-v188-assessment-edit="$1">Bearbeiten</button>`);};

const v200DeleteAssessmentBefore=v188DeleteAssessment;
v188DeleteAssessment=async function(id){const exists=v200Assessment(id);await v200DeleteAssessmentBefore(id);if(exists&&!v200Assessment(id)){try{await v200PrivateDelete(id);}catch(e){console.warn('Private Auswertungsdaten konnten beim Löschen nicht entfernt werden',e);}}};

const v200ConcretePromptBefore=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){let txt=v200ConcretePromptBefore(l);const q=seq(l.sequenceId),cat=v200CatalogForClass(l.classId,false);if(q&&cat?.topics?.length&&Array.isArray(cat.competencies)){const norm=v200Norm(q.title),topic=cat.topics.find(t=>v200Norm(t.title)===norm);if(topic){const comps=(topic.competencyIds||[]).map(id=>cat.competencies.find(c=>c.id===id)).filter(Boolean);if(comps.length)txt+=`\n\n## Curriculare Kompetenzen dieser Reihe\n${comps.map(c=>'- '+c.text).join('\n')}\nDiese Kompetenzen sind die curriculare Zielperspektive der Reihe. Berücksichtige sie bei der Planung, ohne zu behaupten, bereits nicht dokumentierte Kompetenzen seien erreicht.\n`;}}return txt;};
makeBrief=concretePlanningPromptV12;

const v200WireBefore=wire;
wire=function(){
  v200EnsureState();v200WireBefore();
  document.querySelectorAll('[data-v200-eval-open]').forEach(b=>b.onclick=()=>v200OpenEval(b.dataset.v200EvalOpen));
  document.querySelectorAll('[data-v200-step]').forEach(b=>b.onclick=async()=>{if(!v200Eval)return;const n=Number(b.dataset.v200Step)||1;if(n===3&&!v200AnalysisReady())return alert('Bitte zuerst eine vollständige, geklärte Prüfungsanalyse importieren.');v200Eval.step=n;render();});
  document.getElementById('v200-classtime-file')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{e.target.disabled=true;await v200ImportClasstimeFile(f);}catch(err){alert('Classtime-Excel konnte nicht lokal gelesen werden: '+(err.message||err));}finally{e.target.disabled=false;}});
  document.querySelector('[data-v200-roster-save]')?.addEventListener('click',async()=>{await v200SetRosterFromText(document.getElementById('v200-roster-text')?.value||'');render();});
  document.getElementById('v200-cat-files')?.addEventListener('change',async e=>{try{await v200UploadCatalogFiles(Array.from(e.target.files||[]));}catch(err){alert('Kompetenzgrundlage konnte nicht gespeichert werden: '+(err.message||err));}});
  document.querySelectorAll('[data-v200-cat-remove]').forEach(b=>b.onclick=()=>v200RemoveCatalogFile(b.dataset.v200CatRemove));
  document.querySelector('[data-v200-copy-prompt]')?.addEventListener('click',async()=>{try{const p=v200AssessmentAnalysisPrompt(v200Assessment(v200Eval.assessmentId),v200Eval.privateData);await navigator.clipboard.writeText(p);alert('Prüfungsanalyse-Prompt kopiert – ohne Schülernamen und individuelle Ergebnisse.');}catch(err){alert(err.message||err);}});
  document.querySelector('[data-v200-analysis-bundle]')?.addEventListener('click',()=>v200DownloadAnalysisBundle().catch(e=>alert(e.message||e)));
  document.getElementById('v200-analysis-import')?.addEventListener('input',e=>{v200Eval.rawImport=e.target.value;});
  document.querySelector('[data-v200-analysis-import]')?.addEventListener('click',async()=>{try{const raw=document.getElementById('v200-analysis-import')?.value||'';v200Eval.rawImport=raw;await v200ImportAnalysis(raw);alert('Prüfungsanalyse übernommen.');}catch(err){alert(err.message||err);}});
  document.querySelector('[data-v200-map-save]')?.addEventListener('click',()=>v200SaveMappingAndScores().then(()=>alert('Classtime-Zuordnung und digitale Punkte lokal übernommen.')).catch(e=>alert(e.message||e)));
  document.querySelectorAll('[data-v200-score]').forEach(input=>{input.onchange=async()=>{const [sid,iid,kind]=input.dataset.v200Score.split('|'),it=v200EvalAnalysis()?.items?.find(x=>x.id===iid),max=kind==='paper'?Number(it?.regularMax)||0:Number(it?.bonusMax)||0;let val=input.value===''?'':Number(String(input.value).replace(',','.'));if(val!==''&&(!Number.isFinite(val)||val<0||val>max)){alert(`Bitte einen Wert zwischen 0 und ${max} eingeben.`);input.focus();return;}await v200SetScore(sid,iid,input.value,kind);};input.onkeydown=async e=>{if(e.key!=='Enter')return;e.preventDefault();input.dispatchEvent(new Event('change'));const fields=[...document.querySelectorAll('[data-v200-score]')],i=fields.indexOf(input);if(i>=0&&i<fields.length-1){fields[i+1].focus();fields[i+1].select();}else if(v200Eval.studentIndex<(v200Eval.privateData.roster?.length||1)-1){v200Eval.studentIndex++;render();setTimeout(()=>{const n=document.querySelector('[data-v200-score]');n?.focus();n?.select();},0);}else{v200Eval.step=5;render();}};});
  document.querySelector('[data-v200-prev-student]')?.addEventListener('click',()=>{v200Eval.studentIndex=Math.max(0,v200Eval.studentIndex-1);render();});
  document.querySelector('[data-v200-next-student]')?.addEventListener('click',()=>{v200Eval.studentIndex=Math.min((v200Eval.privateData.roster?.length||1)-1,v200Eval.studentIndex+1);render();});
  document.querySelector('[data-v200-pdf-zip]')?.addEventListener('click',()=>v200DownloadPdfZip().catch(e=>alert(e.message||e)));
  document.querySelector('[data-v200-combined-pdf]')?.addEventListener('click',()=>{try{v200DownloadCombinedPdf();}catch(e){alert(e.message||e);}});
  document.querySelector('[data-v200-private-backup]')?.addEventListener('click',v200DownloadPrivateBackup);
};

const v200RenderBefore=render;
render=function(){v200EnsureState();v200RenderBefore();const v=document.querySelector('.brand small');if(v)v.textContent=`${state.settings.schoolYear} · ${V200_VERSION}`;};

/* ===== V0.20.1 – Sollstunden sauber einschieben + dieses Schuljahr ausgrauen =====
   - Neue Soll-Stunden werden in der Reihenfolge eingefügt, nicht nach dem Speichern
     wieder stumpf nach Datum sortiert. Bei gleichem/geplantem Datum kommt eine neue
     Stunde vor das dort bereits liegende Thema und schiebt die folgenden offenen Themen.
   - In der Reihenbearbeitung kann vor jeder vorhandenen Stunde explizit eingeschoben werden.
   - Soll-Stunden können für das aktuelle Planungsjahr "ausgegraut" werden. Sie bleiben
     als Teil der Reihe erhalten, verbrauchen aber keinen Fachtermin; alle folgenden offenen
     Soll-Stunden und Folgereihen rücken automatisch nach.
   - Gehaltene oder bereits konkret ausgearbeitete Stunden werden weiterhin nicht still
     überschrieben.
*/
const V201_VERSION='V0.20.1';

function v201UnitSkipped(u){return !!u?.skippedThisYearV201;}
function v201ActiveUnits(q){return (q?.plan||[]).filter(u=>!v201UnitSkipped(u));}
function v201UnitLabel(u){return `${u?.plannedDate?fmtDate(u.plannedDate)+' · ':''}${u?.title||'Soll-Stunde'}`;}

// Neue/erneut bereinigte Planobjekte behalten den Ausgrau-Status.
const v201CleanPlanUnitBefore=cleanPlanUnitV10;
cleanPlanUnitV10=function(u={}){
  const out=v201CleanPlanUnitBefore(u);
  if(u.skippedThisYearV201)out.skippedThisYearV201=true;
  if(u.skippedPreviousDateV201)out.skippedPreviousDateV201=cleanString(u.skippedPreviousDateV201,20);
  return out;
};

// Ausgegraute Soll-Stunden zählen nicht als benötigte Unterrichtstermine.
v190SequenceNeed=function(q){return v201ActiveUnits(q).length;};

// Eine ausgegraute Stunde darf beim Aufbau einer Wochenstunde nie automatisch wieder auftauchen.
exactPlanUnitV11=function(classId,date){
  for(const q of classSequences(classId)){
    const u=(q.plan||[]).find(x=>!v201UnitSkipped(x)&&x.plannedDate===date);
    if(u)return {q,u};
  }
  return null;
};

// V0.19.1-Terminierer mit zwei Ergänzungen:
// 1) ausgegraute Einträge werden vollständig aus der Terminbelegung herausgenommen;
// 2) die Reihenfolge in q.plan ist die verbindliche Reihenfolge, damit Einschieben wirklich schiebt.
v190RescheduleCourseYear=function(cid,year=v190PlanningYear(),silent=false,options={}){
  const y=v190NormYear(year),seqs=v190PlanningSequences(cid,y);
  if(!seqs.length)return {changed:0,warning:''};
  const slots=v190CourseSlots(cid,y);
  if(!slots.length)return {changed:0,warning:y===v190NormYear(state.settings.schoolYear)?'Für diesen Fachkurs ist kein Stundenplan-Rhythmus hinterlegt. Reihenfolge gespeichert, Termine bleiben unverändert.':'Für dieses zukünftige Schuljahr ist noch kein Planungsrhythmus freigegeben. Reihenfolge gespeichert; Termine werden erst berechnet, wenn du im Kalender „aktuellen Stundenplan als Planungsrhythmus“ aktivierst.'};

  const today=iso(new Date()),occupied=new Set(),fixedByUnit=new Map(),warnings=[];
  let changed=0,unscheduled=0;
  const skippedIds=new Set(seqs.flatMap(q=>(q.plan||[]).filter(v201UnitSkipped).map(u=>u.id)));

  // Ausgegraute Einträge besitzen absichtlich keinen Soll-Termin mehr.
  for(const q of seqs)for(const u of q.plan||[])if(v201UnitSkipped(u)&&u.plannedDate){
    if(!u.skippedPreviousDateV201)u.skippedPreviousDateV201=u.plannedDate;
    u.plannedDate='';changed++;
  }

  // Gehaltene bzw. konkret ausgearbeitete Unterrichtsstunden bleiben Fixpunkte.
  // Ist eine solche Stunde inzwischen ausgegraut, bleibt der konkrete Termin aus Sicherheitsgründen
  // belegt; der Toggle verhindert diesen Fall normalerweise schon vorher.
  for(const l of state.lessons||[]){
    if(l.classId!==cid||v190YearFromDate(l.date)!==y||!v191LessonProtected(l))continue;
    const idx=v191SlotIndex(slots,l.date,lessonSlot(l),l.timetableId||'');
    if(idx>=0)occupied.add(idx);
    const uid=l.planReference?.unitId;
    if(uid&&!skippedIds.has(uid))fixedByUnit.set(uid,{date:l.date,idx});
  }

  // Vergangene aktive Soll-Termine bleiben historisch fest.
  for(const q of seqs)for(const u of v201ActiveUnits(q)){
    if(fixedByUnit.has(u.id)||!u.plannedDate||u.plannedDate>=today)continue;
    const idx=v191SlotIndex(slots,u.plannedDate);
    fixedByUnit.set(u.id,{date:u.plannedDate,idx});
    if(idx>=0)occupied.add(idx);
  }

  // Automatische Zukunftszuordnungen lösen; anschließend wird anhand des neuen Sollplans neu zugeordnet.
  for(const l of state.lessons||[]){
    if(l.classId!==cid||v190YearFromDate(l.date)!==y||l.date<today||v191LessonProtected(l))continue;
    if(l.planReference?.autoMatched)v191ClearAutoLesson(l);
  }

  const firstFree=(from=0,minDate='')=>{
    for(let i=Math.max(0,from);i<slots.length;i++)if(!occupied.has(i)&&(!minDate||slots[i].date>=minDate))return i;
    return -1;
  };
  const prevFree=(from,minIndex=0,maxDate='')=>{
    for(let i=Math.min(from,slots.length-1);i>=Math.max(0,minIndex);i--)if(!occupied.has(i)&&(!maxDate||slots[i].date<=maxDate))return i;
    return -1;
  };
  const nextFixedIndex=(units,from)=>{
    for(let j=from+1;j<units.length;j++){const f=fixedByUnit.get(units[j].id);if(f&&f.idx>=0)return f.idx;}
    return -1;
  };

  let cursor=0;
  for(const q of seqs){
    const units=v201ActiveUnits(q);
    if(!units.length){q.startDate='';q.endDate='';continue;}

    const isAnchor=q.id===options.anchorSequenceId&&options.anchorDate;
    const mode=isAnchor?options.anchorMode:'';
    const anchorDate=isAnchor?options.anchorDate:'';

    if(mode==='end'){
      const assigned=new Map();
      let endIdx=slots.length-1;
      while(endIdx>=cursor&&slots[endIdx].date>anchorDate)endIdx--;
      for(let i=units.length-1;i>=0;i--){
        const u=units[i],fixed=fixedByUnit.get(u.id);
        if(fixed){u.plannedDate=fixed.date;if(fixed.idx>=0)endIdx=Math.min(endIdx,fixed.idx-1);continue;}
        const p=prevFree(endIdx,cursor,anchorDate);
        if(p<0){if(u.plannedDate){u.plannedDate='';changed++;}unscheduled++;continue;}
        assigned.set(u.id,p);occupied.add(p);endIdx=p-1;
      }
      let maxIdx=cursor-1;
      for(const u of units){
        const fixed=fixedByUnit.get(u.id),idx=fixed?.idx??assigned.get(u.id)??-1;
        const nd=fixed?.date||(idx>=0?slots[idx].date:'');
        if(u.plannedDate!==nd){u.plannedDate=nd;changed++;}
        if(idx>=0)maxIdx=Math.max(maxIdx,idx);
      }
      cursor=Math.max(cursor,maxIdx+1);
    }else{
      if(mode==='start'){
        const a=firstFree(cursor,anchorDate);
        if(a>=0)cursor=a;else warnings.push(`Für „${q.title}“ gibt es ab ${fmtDate(anchorDate)} keinen freien Fachtermin mehr.`);
      }
      for(let i=0;i<units.length;i++){
        const u=units[i],fixed=fixedByUnit.get(u.id);
        if(fixed){
          if(u.plannedDate!==fixed.date){u.plannedDate=fixed.date;changed++;}
          if(fixed.idx>=0)cursor=Math.max(cursor,fixed.idx+1);
          continue;
        }
        const limit=nextFixedIndex(units,i),p=firstFree(cursor);
        if(p<0||(limit>=0&&p>=limit)){
          if(u.plannedDate){u.plannedDate='';changed++;}
          unscheduled++;continue;
        }
        const nd=slots[p].date;
        if(u.plannedDate!==nd){u.plannedDate=nd;changed++;}
        occupied.add(p);cursor=p+1;
      }
    }

    const dates=units.map(u=>u.plannedDate).filter(Boolean).sort();
    if(dates.length){q.startDate=dates[0];q.endDate=dates[dates.length-1];}
    else{q.startDate='';q.endDate='';}
  }

  for(const l of state.lessons||[]){
    if(l.classId!==cid||v190YearFromDate(l.date)!==y||l.date<today||v191LessonProtected(l)||l.v180MovedFrom)continue;
    attachExactPlanV11(l);
  }

  if(unscheduled)warnings.push(`${unscheduled} Soll-Thema${unscheduled===1?' konnte':'en konnten'} nicht mehr auf einen freien regulären Fachtermin gelegt werden.`);
  const anchorProtected=options.anchorSequenceId?((seq(options.anchorSequenceId)?.plan||[]).filter(u=>!v201UnitSkipped(u)&&fixedByUnit.has(u.id)).length):0;
  if(options.anchorSequenceId&&options.anchorDate&&anchorProtected)warnings.push('Bereits gehaltene oder konkret ausgearbeitete Stunden dieser Reihe blieben an ihrem bestehenden Termin.');
  return {changed,warning:[...new Set(warnings)].join('\n')};
};

async function v201SetUnitSkipped(qid,unitId,skip){
  const q=seq(qid),u=q?.plan?.find(x=>x.id===unitId);if(!q||!u)return;
  if(skip){
    const linked=(state.lessons||[]).filter(l=>l.planReference?.unitId===unitId);
    if(linked.some(v182IsHeld))return alert('Diese Soll-Stunde wurde bereits gehalten und kann deshalb nicht für dieses Schuljahr ausgegraut werden.');
    const protectedFuture=linked.filter(l=>!v182IsHeld(l)&&concretePlanReadyV12(l));
    if(protectedFuture.length)return alert('Diese Soll-Stunde ist bereits konkret ausgearbeitet. Ich graue sie nicht automatisch aus, damit Planung, Materialien oder PowerPoint nicht verloren gehen. Bitte löse/verschiebe zuerst die konkrete Wochenstunde.');
    if(!confirm(`„${u.title}“ dieses Schuljahr auslassen?\n\nDie Stunde bleibt in der Reihe erhalten, wird grau dargestellt und verbraucht keinen Unterrichtstermin. Alle folgenden offenen Stunden und Folgereihen rücken automatisch nach.`))return;
    u.skippedPreviousDateV201=u.plannedDate||u.skippedPreviousDateV201||'';
    u.skippedThisYearV201=true;u.plannedDate='';
    for(const l of linked){
      if(v191LessonProtected(l))continue;
      if(l.planReference?.autoMatched)v191ClearAutoLesson(l);
      else{
        if(l.title===u.title)l.title='';if(l.objective===u.objective)l.objective='';
        l.planReference=null;l.sequenceId='';l.unit='';
      }
    }
  }else{
    u.skippedThisYearV201=false;u.plannedDate='';
  }
  const r=v190RescheduleCourseYear(q.classId,v190SeqYear(q),true);
  await saveState();modal={type:'sequence',id:qid};render();if(r.warning)alert(r.warning);
}

// Hauptdarstellung der Soll-Stunde: ausgegraut bleibt sie sichtbar, ist aber klar als nicht geplant markiert.
planUnitCardV10=function(q,u,i){
  const skipped=v201UnitSkipped(u),bits=skipped?'Dieses Schuljahr ausgelassen':[u.plannedDate?fmtDate(u.plannedDate):'Datum offen',u.hours?`${esc(u.hours)} Std.`:''].filter(Boolean).join(' · ');
  return `<article class="sequence-plan-unit ${skipped?'v201-skipped-unit':''}"><div class="sequence-plan-date"><span>${esc(bits)}</span><strong>${i+1}</strong></div><div class="sequence-plan-copy"><h4>${esc(u.title)}</h4>${skipped?'<span class="v201-skip-chip">ausgegraut · bleibt für spätere Durchläufe erhalten</span>':''}${u.objective?`<p><strong>Ziel:</strong> ${esc(u.objective)}</p>`:''}${u.content?`<p>${esc(u.content)}</p>`:''}${u.material?`<small><strong>Material:</strong> ${esc(u.material)}</small>`:''}${u.notes?`<small><strong>Bemerkung:</strong> ${esc(u.notes)}</small>`:''}</div>${skipped?'<span class="v201-skip-note">kein Termin</span>':`<button class="secondary" data-use-plan-unit="${q.id}|${u.id}">In nächste Stunde übernehmen →</button>`}</article>`;
};

// Jahreskarte zeigt aktive und für dieses Jahr ausgelassene Themen getrennt.
v190SequenceCard=function(q){
  const locked=v190SequenceLocked(q),active=v201ActiveUnits(q).length,skipped=(q.plan||[]).filter(v201UnitSkipped).length,files=(q.sourceFilesV190||[]).length,missing=(q.plan||[]).reduce((n,u)=>n+(u.pendingMaterialReferencesV184||[]).length,0);
  return `<article class="v190-sequence-card ${locked?'locked':''}" data-v190-drop="${q.id}"><div class="v190-drag ${locked?'disabled':''}" ${locked?'':`draggable="true" data-v190-drag="${q.id}"`} title="${locked?'Bereits begonnen – Reihenfolge gesperrt':'Ziehen zum Verschieben'}">⋮⋮</div><button class="v190-sequence-main" data-sequence="${q.id}"><div><span class="eyebrow">${q.startDate?fmtDate(q.startDate):'Start offen'}${q.endDate?` → ${fmtDate(q.endDate)}`:''}</span><h3>${esc(q.title)}</h3><p>${esc(q.goal||'Reihenziel noch offen')}</p></div><div class="v190-seq-meta"><span>${active} eingeplante Soll-Stunde${active===1?'':'n'}</span>${skipped?`<span class="v201-card-skipped">${skipped} ausgegraut</span>`:''}${files?`<span>${files} Planungsdatei${files===1?'':'en'}</span>`:''}${missing?`<span class="warn">${missing} Material offen</span>`:''}${locked?'<span>🔒 begonnen</span>':''}</div></button></article>`;
};

// Die bestehende Reihenansicht bekommt eine klarere Bearbeitungsliste mit explizitem Einschieben.
const v201SequencePanelBefore=sequencePanel;
sequencePanel=function(q){
  let h=v201SequencePanelBefore(q);if(!q)return h;
  const rows=(q.plan||[]).map((u,i)=>`<div class="v201-plan-edit-row ${v201UnitSkipped(u)?'v201-skipped-row':''}"><span>${v201UnitSkipped(u)?'—':esc(u.plannedDate?fmtDate(u.plannedDate):'Datum offen')}</span><strong>${esc(u.title)}</strong><small>${v201UnitSkipped(u)?'dieses Schuljahr ausgelassen':`Position ${i+1}`}</small><div class="v201-plan-row-actions"><button class="text-button" data-v201-unit-before="${q.id}|${u.id}" title="Neue Stunde direkt vor dieser Stunde einschieben">+ davor</button><button class="text-button v201-move-btn" data-v201-unit-move="${q.id}|${u.id}|-1" ${i===0?'disabled':''} title="Eine Position nach vorn">↑</button><button class="text-button v201-move-btn" data-v201-unit-move="${q.id}|${u.id}|1" ${i===(q.plan||[]).length-1?'disabled':''} title="Eine Position nach hinten">↓</button><button class="secondary" data-v182-unit-edit="${q.id}|${u.id}">Bearbeiten</button><button class="${v201UnitSkipped(u)?'secondary':'text-button'}" data-v201-unit-skip="${q.id}|${u.id}" data-v201-skip-value="${v201UnitSkipped(u)?'0':'1'}">${v201UnitSkipped(u)?'Wieder einplanen':'Dieses Jahr auslassen'}</button><button class="danger-lite small" data-v188-unit-delete="${q.id}|${u.id}">Löschen</button></div></div>`).join('')||'<p class="muted">Noch keine datierten Stunden eingetragen.</p>';
  const replacement=`<section class="detail-section v182-plan-edit v201-plan-edit"><div class="section-head"><div><h3>Einzelstunden im Sollplan bearbeiten</h3><p class="microcopy">Mit <strong>+ davor</strong> schiebst du eine Stunde exakt an dieser Stelle ein. „Dieses Jahr auslassen“ behält sie grau in der Reihe, gibt ihren Termin aber für die folgenden Stunden frei.</p></div><button class="primary" data-v182-unit-new="${q.id}">+ Stunde am Ende</button></div><div class="v182-plan-edit-list v201-plan-edit-list">${rows}</div></section>`;
  return h.replace(/<section class="detail-section v182-plan-edit">[\s\S]*?<\/section>/,replacement);
};

// Im Editor zeigen wir bei explizitem Einschieben an, vor welcher Stunde gespeichert wird.
const v201ModalBefore=modalHtml;
modalHtml=function(){
  let h=v201ModalBefore();
  if(modal?.type==='unitV182'&&!modal.uid&&modal.beforeUidV201){
    const q=seq(modal.qid),before=q?.plan?.find(x=>x.id===modal.beforeUidV201);
    if(before){
      h=h.replace('<div class="modal-body v182-unit-editor"><p>','<div class="modal-body v182-unit-editor"><div class="v201-insert-hint"><strong>Wird eingeschoben vor:</strong> '+esc(v201UnitLabel(before))+'</div><p>');
    }
  }
  return h;
};

const v201WireBefore=wire;
wire=function(){
  v201WireBefore();

  document.querySelectorAll('[data-v201-unit-before]').forEach(b=>b.onclick=()=>{
    const [qid,uid]=b.dataset.v201UnitBefore.split('|');modal={type:'unitV182',qid,uid:'',beforeUidV201:uid};render();
  });
  document.querySelectorAll('[data-v201-unit-skip]').forEach(b=>b.onclick=()=>{
    const [qid,uid]=b.dataset.v201UnitSkip.split('|');v201SetUnitSkipped(qid,uid,b.dataset.v201SkipValue==='1');
  });
  document.querySelectorAll('[data-v201-unit-move]').forEach(b=>b.onclick=async()=>{
    const [qid,uid,deltaRaw]=b.dataset.v201UnitMove.split('|'),q=seq(qid),delta=Number(deltaRaw)||0;if(!q||!delta)return;
    const from=(q.plan||[]).findIndex(x=>x.id===uid),to=Math.max(0,Math.min((q.plan||[]).length-1,from+delta));if(from<0||from===to)return;
    const [u]=q.plan.splice(from,1);q.plan.splice(to,0,u);
    const r=v190RescheduleCourseYear(q.classId,v190SeqYear(q),true);
    await saveState();modal={type:'sequence',id:qid};render();if(r.warning)alert(r.warning);
  });

  // Die alte Save-Logik sortierte nach Datum und stellte neue Einträge bei gleichem Datum
  // hinter das bereits vorhandene Thema. Diese Version speichert bewusst nach Reihenposition.
  const saveBtn=document.querySelector('[data-v182-unit-save]');
  if(saveBtn){
    const b=saveBtn.cloneNode(true);saveBtn.replaceWith(b);
    b.onclick=async()=>{
      const [qid,uidx]=b.dataset.v182UnitSave.split('|'),q=seq(qid);if(!q)return;
      const title=document.getElementById('v182-unit-title')?.value.trim(),date=document.getElementById('v182-unit-date')?.value||'';
      if(!title)return alert('Bitte ein Thema eintragen.');
      let u=q.plan.find(x=>x.id===uidx),isNew=!u,oldDate=u?.plannedDate||'';
      if(isNew){
        u=cleanPlanUnitV10({title,plannedDate:date});
        let insertAt=-1;
        if(modal?.type==='unitV182'&&modal.qid===qid&&modal.beforeUidV201)insertAt=q.plan.findIndex(x=>x.id===modal.beforeUidV201);
        // Ohne expliziten +davor-Klick reicht das gewählte Datum: Bei gleichem Datum kommt
        // die neue Stunde VOR das bisherige Thema und verdrängt es auf den nächsten Fachtermin.
        if(insertAt<0&&date)insertAt=q.plan.findIndex(x=>!v201UnitSkipped(x)&&x.plannedDate&&x.plannedDate>=date);
        if(insertAt<0)q.plan.push(u);else q.plan.splice(insertAt,0,u);
      }else if(date&&date!==oldDate){
        // Auch eine bereits falsch platzierte Stunde lässt sich reparieren: Datum ändern genügt.
        // Sie wird vor das erste noch offene Thema dieses Datums bzw. eines späteren Datums gesetzt.
        const oldIndex=q.plan.findIndex(x=>x.id===u.id);if(oldIndex>=0)q.plan.splice(oldIndex,1);
        let insertAt=q.plan.findIndex(x=>!v201UnitSkipped(x)&&x.plannedDate&&x.plannedDate>=date);
        if(insertAt<0)q.plan.push(u);else q.plan.splice(insertAt,0,u);
      }
      for(const [field,id] of [['title','title'],['plannedDate','date'],['objective','objective'],['content','content'],['material','material'],['notes','notes']])u[field]=document.getElementById('v182-unit-'+id)?.value?.trim()||'';
      if(v201UnitSkipped(u)){u.skippedThisYearV201=false;u.skippedPreviousDateV201='';}
      const r=v190RescheduleCourseYear(q.classId,v190SeqYear(q),true);
      await saveState();modal={type:'sequence',id:qid};render();if(r.warning)alert(r.warning);
    };
  }
};

const v201RenderBefore=render;
render=function(){v201RenderBefore();const v=document.querySelector('.brand small');if(v)v.textContent=`${state.settings.schoolYear} · ${V201_VERSION}`;};


const V202_CURRICULUM={"schema":"schulcockpit.curriculum.v1","version":"2026-10-06","sources":{"religion":{"title":"Schulcurriculum Evangelische Religion (Stand Juni 2019)","uploadedFile":"Schulcurriculum Ev. Religion 2021.pdf","grades":[5,6,7,8,9,10],"thresholds5to7":{"reachedMinPct":70,"partialMinPct":50,"labels":{"reached":"erreicht","partial":"teilweise erreicht","notReached":"noch nicht erreicht"}},"note":"Jahrgänge 5–7 werden nach Kompetenzen bewertet; Quelle nennt e 70–100 %, te 50–69 %, nne 0–49 %."},"mathematik":{"title":"Schulcurriculum Mathematik, Stand 02. April 2025","uploadedFile":"0_Schulcurriculum_Mathematik.pdf","grades":[5,6,7,8,9,10],"thresholds5to7":{"reachedMinPct":70,"partialMinPct":50,"labels":{"reached":"erreicht","partial":"teilweise erreicht","notReached":"noch nicht erreicht"}},"note":"Jahrgänge 5–7 werden nach Kompetenzen bewertet; Quelle nennt e 100–70 %, te 69–50 %, nne 49–0 %."},"methoden_mathematik":{"title":"Schulinternes Methodencurriculum der IGS Moormerland für das Fach Mathematik, Stand 28.03.2019","uploadedFile":"Schulinternes Methodencurriculum.docx","grades":[5,6,7,8,9,10]}},"topics":[{"id":"religion-5-8","subject":"religion","grades":[5],"title":"Was glaubst du denn? – Menschen suchen Halt im Leben","shortTitle":"Was glaubst du denn? – Menschen suchen Halt im Leben","level":"","aliases":["Was glaubst du denn?","Menschen suchen Halt im Leben","Religionen und Glauben"],"sourcePages":[8],"content":"","competencies":[{"category":"Sachkompetenz","text":"unterschiedliche Erscheinungsformen von Religion/en benennen (eigene Gewohnheiten, Riten und Gebräuche in Elternhaus und evtl. Kirche; Erfahrungen aus Kindergarten und kirchlichen Kindergruppen).","level":"grundlegend","media":false,"id":"religion-5-8-k01"},{"category":"Sachkompetenz","text":"benennen, dass es in ihrer Klasse unterschiedliche Glaubensrichtungen gibt, u.a. evangelische und katholische Christen, Muslime und MitschülerInnen, die nicht getauft sind.","level":"grundlegend","media":false,"id":"religion-5-8-k02"},{"category":"Sachkompetenz","text":"liturgische Gegenstände (z.B. Kanzel, Beichtstuhl) in der evangelischen und katholischen Kirche benennen und zuordnen.","level":"grundlegend","media":false,"id":"religion-5-8-k03"},{"category":"Sachkompetenz","text":"über ihre eigene Religion und auch über andere Religionen nachdenken und sie besser verstehen.","level":"erweitert","media":false,"id":"religion-5-8-k04"},{"category":"Sachkompetenz","text":"erkennen, dass es, obwohl in unserer Welt Religion immer unwichtiger zu werden scheint, es doch sehr viele Menschen gibt, die über Gott und Religion nachdenken.","level":"erweitert","media":false,"id":"religion-5-8-k05"},{"category":"Methoden","text":"Fragen für ein Experteninterview erarbeiten (z.B. Gespräch mit dem Kirchenältesten der zu besuchenden Gemeinde).","level":"grundlegend","media":false,"id":"religion-5-8-k06"},{"category":"Methoden","text":"einen Sachtext in seinen wesentlichen Inhalten erfassen.","level":"grundlegend","media":false,"id":"religion-5-8-k07"},{"category":"Methoden","text":"Aussagen in Wort und Bild erfassen und verbalisieren.","level":"grundlegend","media":false,"id":"religion-5-8-k08"},{"category":"Methoden","text":"ein Experteninterview durchführen.","level":"erweitert","media":false,"id":"religion-5-8-k09"},{"category":"Bewusstsein, Reflexion und Urteil","text":"sich bewusst machen und tolerieren, wie vielfältig das religiöse Leben in der Klasse ist.","level":"grundlegend","media":false,"id":"religion-5-8-k10"},{"category":"Bewusstsein, Reflexion und Urteil","text":"erkennen, dass alle unterschiedlichen Glaubensvorstellungen/Religionen gleichberechtigt nebeneinander stehen.","level":"grundlegend","media":false,"id":"religion-5-8-k11"},{"category":"Handlungs- und Problemlösung","text":"zuhören, wenn Mitschüler von ihren religiösen Erfahrungen erzählen.","level":"grundlegend","media":false,"id":"religion-5-8-k12"},{"category":"Handlungs- und Problemlösung","text":"den Besuch in der Kirche protokollieren (schriftlich oder mit medialer Unterstützung).","level":"grundlegend","media":true,"id":"religion-5-8-k13"},{"category":"Handlungs- und Problemlösung","text":"ihre Arbeitsergebnisse in angemessener Form präsentieren (z.B. selbst gemaltes Bild o.Ä.).","level":"grundlegend","media":false,"id":"religion-5-8-k14"}]},{"id":"religion-5-9","subject":"religion","grades":[5],"title":"Feste und Feiertage – Menschen brauchen Rituale","shortTitle":"Feste und Feiertage – Menschen brauchen Rituale","level":"","aliases":["Feste und Feiertage","Menschen brauchen Rituale"],"sourcePages":[9],"content":"","competencies":[{"category":"Sachkompetenz","text":"Hintergründe christlicher Feste, wie z.B. Halloween, Martinstag, Advent, Weihnachten, Ostern und Pfingsten benennen.","level":"grundlegend","media":false,"id":"religion-5-9-k01"},{"category":"Sachkompetenz","text":"erklären, weshalb und inwiefern sich die Schwerpunkte von Festen verschieben (z.B. Allerheiligen -> Halloween).","level":"grundlegend","media":false,"id":"religion-5-9-k02"},{"category":"Sachkompetenz","text":"die Verankerung (christlicher) Feste in ihrem eigenen Leben reflektieren.","level":"grundlegend","media":false,"id":"religion-5-9-k03"},{"category":"Sachkompetenz","text":"Feste anderer Religionen in ihrer Bedeutung erläutern (z.B. Zuckerfest).","level":"erweitert","media":false,"id":"religion-5-9-k04"},{"category":"Methoden","text":"einen Sachtext in seinen wesentlichen Inhalten erfassen und wiedergeben.","level":"grundlegend","media":false,"id":"religion-5-9-k05"},{"category":"Methoden","text":"Bilder beschreiben und in Ansätzen interpretieren.","level":"grundlegend","media":false,"id":"religion-5-9-k06"},{"category":"Methoden","text":"Zusammenhänge zwischen Bildern und Texten herstellen.","level":"grundlegend","media":false,"id":"religion-5-9-k07"},{"category":"Methoden","text":"ihre Erfahrungen im Umgang mit Festen in verschiedener Form ausdrücken (z.B. Standbild, Rollenspiel, Collagen).","level":"erweitert","media":false,"id":"religion-5-9-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"sich bewusst machen, weshalb und inwiefern sich die Schwerpunkte von Festen verschieben (z.B. Kommerzialisierung, „Spaß-Charakter“ von Festen).","level":"grundlegend","media":false,"id":"religion-5-9-k09"},{"category":"Bewusstsein, Reflexion und Urteil","text":"erkennen, inwieweit Feste das eigene Leben ritualisieren und ordnen.","level":"grundlegend","media":false,"id":"religion-5-9-k10"},{"category":"Handlungs- und Problemlösung","text":"zuhören, wenn Mitschüler von ihren Erfahrungen mit Festen erzählen.","level":"grundlegend","media":false,"id":"religion-5-9-k11"},{"category":"Handlungs- und Problemlösung","text":"ihre Arbeitsergebnisse in angemessener Form präsentieren (z.B. selbst gemaltes Bild o. Ä.).","level":"grundlegend","media":false,"id":"religion-5-9-k12"}]},{"id":"religion-5-10","subject":"religion","grades":[5],"title":"Schöpfung – Menschen fragen nach der Entstehung von Leben","shortTitle":"Schöpfung – Menschen fragen nach der Entstehung von Leben","level":"","aliases":["Schöpfung","Menschen fragen nach der Entstehung von Leben"],"sourcePages":[10],"content":"","competencies":[{"category":"Sachkompetenz","text":"die biblischen Schöpfungserzählungen als Glaubensaussagen über Gott als Schöpfer erkennen.","level":"grundlegend","media":false,"id":"religion-5-10-k01"},{"category":"Sachkompetenz","text":"die biblischen Schöpfungserzählungen gegen naturwissenschaftliche Evolutionsberichte abgrenzen.","level":"grundlegend","media":false,"id":"religion-5-10-k02"},{"category":"Sachkompetenz","text":"unterschiedliche Erzählungen vom Anfang der Welt miteinander vergleichen.","level":"grundlegend","media":false,"id":"religion-5-10-k03"},{"category":"Sachkompetenz","text":"ihre Verantwortung für den Umgang mit der Umwelt erkennen.","level":"erweitert","media":false,"id":"religion-5-10-k04"},{"category":"Sachkompetenz","text":"sich der besonderen Stellung des Menschen bewusst werden.","level":"erweitert","media":false,"id":"religion-5-10-k05"},{"category":"Methoden","text":"einen Sachtext in seinen wesentlichen Inhalten erfassen und wiedergeben.","level":"grundlegend","media":false,"id":"religion-5-10-k06"},{"category":"Methoden","text":"Bilder beschreiben und in Ansätzen interpretieren.","level":"grundlegend","media":false,"id":"religion-5-10-k07"},{"category":"Methoden","text":"Zusammenhänge zwischen Bildern und Texten herstellen.","level":"grundlegend","media":false,"id":"religion-5-10-k08"},{"category":"Methoden","text":"Texte in der Bibel auffinden.","level":"grundlegend","media":false,"id":"religion-5-10-k09"},{"category":"Methoden","text":"Sachinhalte tabellarisch einander gegenüber stellen.","level":"erweitert","media":false,"id":"religion-5-10-k10"},{"category":"Bewusstsein, Reflexion und Urteil","text":"sich bewusst werden, dass die biblischen Schöpfungserzählungen Glaubensaussagen über Gott als Schöpfer sind.","level":"grundlegend","media":false,"id":"religion-5-10-k11"},{"category":"Bewusstsein, Reflexion und Urteil","text":"sich bewusst werden, dass die naturwissenschaftlichen Aussagen über die Entstehung der Erde vorläufigen Charakter haben, da sich der Forschungsstand weiter entwickelt.","level":"grundlegend","media":false,"id":"religion-5-10-k12"},{"category":"Bewusstsein, Reflexion und Urteil","text":"sich bewusst werden, inwieweit sie in ihrem Leben/in ihrem Lebensstil dem Schöpfungsauftrag in Gen. 2, 15a gerecht werden.","level":"erweitert","media":false,"id":"religion-5-10-k13"},{"category":"Handlungs- und Problemlösung","text":"eigene Maßnahmen zum Schutz ihrer Umwelt festlegen und durchführen (z.B. Mülltrennung).","level":"grundlegend","media":false,"id":"religion-5-10-k14"},{"category":"Handlungs- und Problemlösung","text":"ihre Arbeitsergebnisse in angemessener Form präsentieren (z.B. Anlegen einer Tabelle).","level":"grundlegend","media":false,"id":"religion-5-10-k15"},{"category":"Handlungs- und Problemlösung","text":"eigenes Material zum Thema in der Mappe sammeln.","level":"erweitert","media":false,"id":"religion-5-10-k16"}]},{"id":"religion-5-11","subject":"religion","grades":[5],"title":"Umwelt Jesu","shortTitle":"Umwelt Jesu","level":"","aliases":["Umwelt Jesu","Jesus – seine Zeit und seine Umwelt","Gleichnisse Jesu"],"sourcePages":[11],"content":"","competencies":[{"category":"Sachkompetenz","text":"verschiedene Lebensstationen Jesu kennenlernen und im historisch-kulturellen Kontext einordnen können.","level":"grundlegend","media":false,"id":"religion-5-11-k01"},{"category":"Sachkompetenz","text":"verschiedene Gleichnisse kennenlernen und deuten können.","level":"grundlegend","media":false,"id":"religion-5-11-k02"},{"category":"Sachkompetenz","text":"die verschiedenen religiösen Gruppierungen zur Zeit Jesu kennenlernen (Gruppierungen, Besatzung durch die Römer, Berufe zur Zeit Jesu).","level":"grundlegend","media":false,"id":"religion-5-11-k03"},{"category":"Methoden","text":"Israelkarte mit verschiedenen Stationen aus dem Leben Jesu bearbeiten.","level":"grundlegend","media":false,"id":"religion-5-11-k04"},{"category":"Methoden","text":"kreative Gestaltung und Auseinandersetzung mit verschiedenen Gleichnissen (Textpuzzle, Rollenspiel, u.a.).","level":"grundlegend","media":false,"id":"religion-5-11-k05"},{"category":"Methoden","text":"Entwurf verschiedener Geheimzeichen für die Gruppen der Sadduzäer, Pharisäer und Zeloten.","level":"grundlegend","media":false,"id":"religion-5-11-k06"},{"category":"Methoden","text":"Vergleich von Jesusbildern.","level":"grundlegend","media":false,"id":"religion-5-11-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"die Botschaft Jesu in ihrem historischen Kontext verstehen lernen (Reich Gottes, Gleichnisse, Wunder etc.).","level":"grundlegend","media":false,"id":"religion-5-11-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"Jesu Botschaft für die heutige Gesellschaft herausarbeiten.","level":"erweitert","media":false,"id":"religion-5-11-k09"},{"category":"Handlungs- und Problemlösung","text":"zwischen dem historischen Jesus und dem bezeugten Jesus Christus unterscheiden können.","level":"grundlegend","media":false,"id":"religion-5-11-k10"}]},{"id":"religion-6-13","subject":"religion","grades":[6],"title":"Aufbau und Bedeutung der Bibel","shortTitle":"Aufbau und Bedeutung der Bibel","level":"","aliases":["Aufbau und Bedeutung der Bibel","Die Bibel"],"sourcePages":[13],"content":"","competencies":[{"category":"Sachkompetenz","text":"über die Relevanz der Bibel Bescheid wissen und den Aufbau der biblischen Bücher kennenlernen.","level":"grundlegend","media":false,"id":"religion-6-13-k01"},{"category":"Sachkompetenz","text":"die Unterscheidung zwischen Altem und Neuen Testament vornehmen können.","level":"grundlegend","media":false,"id":"religion-6-13-k02"},{"category":"Methoden","text":"Geschichte einer Bibel.","level":"grundlegend","media":false,"id":"religion-6-13-k03"},{"category":"Methoden","text":"Die Bibel als Bibliothek, Bauen eines Bibelregals.","level":"grundlegend","media":false,"id":"religion-6-13-k04"},{"category":"Methoden","text":"Einüben zum Finden einer biblischen Textstelle durch z.B. Bibelspiele, Bibelkuchen, Rätsel, Erstellung eines Bibelbuches oder Stationenlernen.","level":"grundlegend","media":false,"id":"religion-6-13-k05"},{"category":"Methoden","text":"Kreativer Zugang durch z.B. Gestaltung eines Werbeplakates für die Bibel.","level":"grundlegend","media":false,"id":"religion-6-13-k06"},{"category":"Methoden","text":"Bibelrap, Bibelcomic.","level":"grundlegend","media":false,"id":"religion-6-13-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"die Bedeutung der Bibel für das Leben von ChristInnen erfahren und mit dem Inhalt der wichtigsten Bücher vertraut werden.","level":"grundlegend","media":false,"id":"religion-6-13-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"die verschiedenen Gattungen der Bibel kennenlernen (Geschichtsbücher, Propheten, Evangelien und Briefe).","level":"grundlegend","media":false,"id":"religion-6-13-k09"},{"category":"Handlungs- und Problemlösung","text":"verstehen lernen, dass die Bibel im Zeitraum vieler Jahrhunderte entstanden ist und Teil der Glaubensgeschichte ist, die es immer wieder neu zu interpretieren gibt. Menschen haben in der Bibel ihren Glauben an Gott auf verschiedene Weise zum Ausdruck gebracht.","level":"grundlegend","media":false,"id":"religion-6-13-k10"}]},{"id":"religion-6-14","subject":"religion","grades":[6],"title":"Biblische Gottesbilder","shortTitle":"Biblische Gottesbilder","level":"","aliases":["Biblische Gottesbilder","Gottesbilder"],"sourcePages":[14],"content":"","competencies":[{"category":"Sachkompetenz","text":"Vorstellungen von Gott benennen und eigene Vorstellungen formulieren.","level":"grundlegend","media":false,"id":"religion-6-14-k01"},{"category":"Sachkompetenz","text":"biblische Vorstellungen von Gott ermitteln und diese Vorstellungen erläutern.","level":"grundlegend","media":false,"id":"religion-6-14-k02"},{"category":"Sachkompetenz","text":"angeben, warum diese Vorstellungen (z.B. Hirte, Fels, Burg, …) hilfreich für gläubige Menschen sein können.","level":"grundlegend","media":false,"id":"religion-6-14-k03"},{"category":"Methoden","text":"Kinderzeichnungen von Gott auswerten.","level":"grundlegend","media":false,"id":"religion-6-14-k04"},{"category":"Methoden","text":"ergebnisorientiert mit der Bibel arbeiten.","level":"grundlegend","media":false,"id":"religion-6-14-k05"},{"category":"Methoden","text":"aus Psalmen und anderen Bibeltexten Vorstellungen von Gott herausstellen.","level":"grundlegend","media":false,"id":"religion-6-14-k06"},{"category":"Bewusstsein, Reflexion und Urteil","text":"sich ihrer eigenen Vorstellungen bewusst werden und diese kommunizieren können.","level":"grundlegend","media":false,"id":"religion-6-14-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"die Bedeutung der Bibel für das Leben von ChristInnen erfahren und mit dem Inhalt der wichtigsten Bücher vertraut werden.","level":"grundlegend","media":false,"id":"religion-6-14-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"die verschiedenen Gattungen der Bibel kennenlernen (Geschichtsbücher, Propheten, Evangelien und Briefe).","level":"grundlegend","media":false,"id":"religion-6-14-k09"},{"category":"Handlungs- und Problemlösung","text":"angeben, dass durch die biblischen Gottesvorstellungen Möglichkeiten zur Rede mit Gott vorhanden sind.","level":"grundlegend","media":false,"id":"religion-6-14-k10"},{"category":"Handlungs- und Problemlösung","text":"anhand von Kinderzeichnungen und der Formulierung eigener Vorstellungen erkennen, dass jeder Mensch sich sein „Bild“ von Gott macht.","level":"grundlegend","media":false,"id":"religion-6-14-k11"}]},{"id":"religion-6-15","subject":"religion","grades":[6],"title":"Das Judentum – Abrahams Kinder","shortTitle":"Das Judentum – Abrahams Kinder","level":"","aliases":["Das Judentum – Abrahams Kinder","Judentum","Wurzel des christlichen Glaubens","Abraham"],"sourcePages":[15],"content":"","competencies":[{"category":"Sachkompetenz","text":"den Alltag eines gläubigen Juden kennenlernen.","level":"grundlegend","media":false,"id":"religion-6-15-k01"},{"category":"Sachkompetenz","text":"über die wichtigsten Feste im Judentum Bescheid wissen.","level":"grundlegend","media":false,"id":"religion-6-15-k02"},{"category":"Sachkompetenz","text":"erfahren, dass das Christentum seine Wurzeln im Judentum hat.","level":"erweitert","media":false,"id":"religion-6-15-k03"},{"category":"Methoden","text":"wichtige Gegenstände aus dem Judentum kennenlernen.","level":"grundlegend","media":false,"id":"religion-6-15-k04"},{"category":"Methoden","text":"Modell einer Synagoge erstellen.","level":"grundlegend","media":false,"id":"religion-6-15-k05"},{"category":"Methoden","text":"Bearbeitung von Erlebnisberichten.","level":"grundlegend","media":false,"id":"religion-6-15-k06"},{"category":"Methoden","text":"der jüdische Festkreis.","level":"grundlegend","media":false,"id":"religion-6-15-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"die Gemeinsamkeiten und die Unterschiede zwischen Juden- und Christentum herausarbeiten können.","level":"grundlegend","media":false,"id":"religion-6-15-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"Auseinandersetzung mit Antisemitismus.","level":"erweitert","media":false,"id":"religion-6-15-k09"},{"category":"Handlungs- und Problemlösung","text":"verstehen lernen, dass das Judentum die Grundlage für das Christentum ist und es nur einen Gott gibt, an den sowohl Juden als auch Christen glauben.","level":"grundlegend","media":false,"id":"religion-6-15-k10"}]},{"id":"religion-7-17","subject":"religion","grades":[7],"title":"Reformation","shortTitle":"Reformation","level":"","aliases":["Reformation","Martin Luther"],"sourcePages":[17],"content":"","competencies":[{"category":"Sachkompetenz","text":"einen Überblick über die kirchliche Situation der Menschen im Mittelalter bekommen und verstehen, welche religiösen Vorstellungen im Mittelalter vorherrschten.","level":"grundlegend","media":false,"id":"religion-7-17-k01"},{"category":"Sachkompetenz","text":"die Zeit der Reformation kennen und ihre Bedeutung für die Entstehung der Ev. Kirche einschätzen sowie sich einen Überblick über die Biographie und die Lehre der entscheidenden Reformatoren erarbeiten.","level":"grundlegend","media":false,"id":"religion-7-17-k02"},{"category":"Sachkompetenz","text":"zentrale theologische Begriffe der Reformation erklären (z.B. Rechtfertigung aus Gnade).","level":"grundlegend","media":false,"id":"religion-7-17-k03"},{"category":"Methoden","text":"Stationenarbeit zu verschiedenen Schwerpunkten der Reformation.","level":"grundlegend","media":false,"id":"religion-7-17-k04"},{"category":"Methoden","text":"Erarbeitung von Plakaten und Vorstellungen von Kurzreferaten.","level":"grundlegend","media":false,"id":"religion-7-17-k05"},{"category":"Methoden","text":"Textarbeit.","level":"grundlegend","media":false,"id":"religion-7-17-k06"},{"category":"Methoden","text":"Deutung und Beschreibung von Bildern.","level":"grundlegend","media":false,"id":"religion-7-17-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"ein Bewusstsein für die Ängste und Wünsche der Menschen im Mittelalter entwickeln und die befreiende Wirkung der reformatorischen Entdeckung in ihrer Entstehungszeit erkennen.","level":"grundlegend","media":false,"id":"religion-7-17-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"die Entstehung verschiedener Konfessionen in der Reformationszeit ermitteln und sich mit der theologischen Bedeutung der Rechtfertigungslehre auseinandersetzen.","level":"grundlegend","media":false,"id":"religion-7-17-k09"},{"category":"Handlungs- und Problemlösung","text":"verstehen, dass die Entwicklung der Reformation aus der historischen Situation heraus zu erklären ist und die Entstehung der Konfessionen bis in die heutige Zeit von entscheidender Bedeutung ist.","level":"grundlegend","media":false,"id":"religion-7-17-k10"},{"category":"Handlungs- und Problemlösung","text":"zentrale Begriffe der Reformation (z.B. sola scriptura, sola fide, …) ermitteln und ihre Bedeutungen für die damalige und heutige Zeit angeben.","level":"grundlegend","media":false,"id":"religion-7-17-k11"}]},{"id":"religion-7-18","subject":"religion","grades":[7],"title":"Gewissen, Schuld und Vergebung","shortTitle":"Gewissen, Schuld und Vergebung","level":"","aliases":["Gewissen, Schuld und Vergebung","Gewissen","Schuld","Vergebung"],"sourcePages":[18],"content":"","competencies":[{"category":"Sachkompetenz","text":"lernen, was die Aufgabe und die Bedeutung des Gewissens ist und zu verschiedenen Konfliktsituationen in Bezug auf Gewissensentscheidungen Stellung beziehen lernen.","level":"grundlegend","media":false,"id":"religion-7-18-k01"},{"category":"Sachkompetenz","text":"verschiedene biblische Situationen vorgestellt bekommen, in denen es um die Schuldfrage und die Möglichkeit der Vergebung geht.","level":"grundlegend","media":false,"id":"religion-7-18-k02"},{"category":"Methoden","text":"Textanalysen, offene Texte, für die die Schülerinnen und Schüler Lösungen finden sollen.","level":"grundlegend","media":false,"id":"religion-7-18-k03"},{"category":"Methoden","text":"Auseinandersetzung mit Liedtexten.","level":"grundlegend","media":false,"id":"religion-7-18-k04"},{"category":"Methoden","text":"Die Zehn Gebote als Orientierungshilfe für das Zusammenleben von Menschen.","level":"grundlegend","media":false,"id":"religion-7-18-k05"},{"category":"Methoden","text":"Übertragung von biblischen Texten auf die Erfahrungen von Menschen heute.","level":"grundlegend","media":false,"id":"religion-7-18-k06"},{"category":"Bewusstsein, Reflexion und Urteil","text":"lernen, selber Gewissensentscheidungen vorzunehmen und dazu verschiedene Positionen kritisch abwägen können.","level":"grundlegend","media":false,"id":"religion-7-18-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"das Verhältnis von Schuld und Vergebung kennenlernen und als Lösungsmöglichkeit für Konfliktsituationen verstehen lernen.","level":"grundlegend","media":false,"id":"religion-7-18-k08"},{"category":"Handlungs- und Problemlösung","text":"entdecken, dass es in Gewissensentscheidungen keine „einfache Lösung“ gibt, sondern verschiedene Aspekte zu berücksichtigen sind.","level":"grundlegend","media":false,"id":"religion-7-18-k09"},{"category":"Handlungs- und Problemlösung","text":"lernen, dass in einigen Situationen Kompromisse gefunden werden müssen.","level":"grundlegend","media":false,"id":"religion-7-18-k10"}]},{"id":"religion-7-19","subject":"religion","grades":[7],"title":"Freundschaft, Liebe und Sexualität","shortTitle":"Freundschaft, Liebe und Sexualität","level":"","aliases":["Freundschaft, Liebe und Sexualität","Freundschaft","Liebe"],"sourcePages":[19],"content":"","competencies":[{"category":"Sachkompetenz","text":"Unterschiede zwischen Jungen und Mädchen in ihren Lebensvorstellungen entdecken können.","level":"grundlegend","media":false,"id":"religion-7-19-k01"},{"category":"Sachkompetenz","text":"ihre Lebensträume benennen können und sich selbst in ihrer eigenen Identität wahrnehmen können.","level":"grundlegend","media":false,"id":"religion-7-19-k02"},{"category":"Sachkompetenz","text":"Freundschaft und Liebe als wichtige Merkmale menschlichen Zusammenlebens kennenlernen.","level":"grundlegend","media":false,"id":"religion-7-19-k03"},{"category":"Methoden","text":"z.T. geschlechtsspezifischer Unterricht.","level":"grundlegend","media":false,"id":"religion-7-19-k04"},{"category":"Methoden","text":"Erarbeitung von Collagen, Umfragen.","level":"grundlegend","media":false,"id":"religion-7-19-k05"},{"category":"Methoden","text":"Arbeiten zum Thema Liebe mit von den Schülern ausgewählten Liedern.","level":"grundlegend","media":false,"id":"religion-7-19-k06"},{"category":"Methoden","text":"Deutung und Beschreibung von Bildern.","level":"grundlegend","media":false,"id":"religion-7-19-k07"},{"category":"Methoden","text":"Erarbeitung eines Plakates „Liebe ist…“.","level":"grundlegend","media":false,"id":"religion-7-19-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"ein Bewusstsein dafür entwickeln, dass Jungen und Mädchen unterschiedliche Vorstellungen vom Leben haben.","level":"grundlegend","media":false,"id":"religion-7-19-k09"},{"category":"Bewusstsein, Reflexion und Urteil","text":"reflektieren können, dass Liebe einen Wert für das Zusammenleben von Menschen hat.","level":"grundlegend","media":false,"id":"religion-7-19-k10"},{"category":"Bewusstsein, Reflexion und Urteil","text":"ein Bewusstsein für Freundschaft entwickeln.","level":"grundlegend","media":false,"id":"religion-7-19-k11"},{"category":"Handlungs- und Problemlösung","text":"entdecken, dass man an Freundschaft immer wieder arbeiten muss.","level":"grundlegend","media":false,"id":"religion-7-19-k12"},{"category":"Handlungs- und Problemlösung","text":"einen Katalog dafür entwickeln, was für Jugendliche in der speziellen Lebensphase wichtig ist.","level":"grundlegend","media":false,"id":"religion-7-19-k13"}]},{"id":"religion-8-22","subject":"religion","grades":[8],"title":"Gottesbilder und Gottesvorstellungen","shortTitle":"Gottesbilder und Gottesvorstellungen","level":"","aliases":["Gottesbilder und Gottesvorstellungen","Gottesbilder"],"sourcePages":[22],"content":"","competencies":[{"category":"Sachkompetenz","text":"verschiedene Vorstellungen von Gott kennen und ermitteln, dass Menschen in verschiedenen Lebensphasen unterschiedliche Vorstellungen von Gott haben.","level":"grundlegend","media":false,"id":"religion-8-22-k01"},{"category":"Sachkompetenz","text":"biblische und theologische Vorstellungen sowie Bilder von Gott kennen, sich mit ihrer eigenen Vorstellung von Gott auseinandersetzen, künstlerische Darstellungen Gottes kennen und eine eigene Position zum Bilderverbot des Dekalogs entwickeln.","level":"grundlegend","media":false,"id":"religion-8-22-k02"},{"category":"Methoden","text":"Textanalysen (warum glauben die Menschen an Gott und was ist Gott eigentlich).","level":"grundlegend","media":false,"id":"religion-8-22-k03"},{"category":"Methoden","text":"Auseinandersetzung mit Liedtexten.","level":"grundlegend","media":false,"id":"religion-8-22-k04"},{"category":"Methoden","text":"Gott in der Kunst.","level":"grundlegend","media":false,"id":"religion-8-22-k05"},{"category":"Methoden","text":"Deutung von verschiedenen Gottesbildern (biblisch und eigene Gottesbilder).","level":"grundlegend","media":false,"id":"religion-8-22-k06"},{"category":"Bewusstsein, Reflexion und Urteil","text":"ihre eigenen Gottesvorstellungen formulieren und Stellung dazu beziehen.","level":"grundlegend","media":false,"id":"religion-8-22-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"verschiedene Positionen zu Gottesvorstellungen angeben und dazu ein eigenes Urteil formulieren.","level":"grundlegend","media":false,"id":"religion-8-22-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"erläutern, dass der Glaube an Gott für Christinnen und Christen ein tragendes Element ihres Lebens ist.","level":"grundlegend","media":false,"id":"religion-8-22-k09"},{"category":"Handlungs- und Problemlösung","text":"entdecken, dass die Vorstellungen von Gott problematisch sein können, wenn sie einseitig festgelegt sind, ihr eigenes Gottesbild reflektieren und erkennen, dass auch ihr eigenes Gottesbild einem Wandel unterliegt.","level":"grundlegend","media":false,"id":"religion-8-22-k10"},{"category":"Handlungs- und Problemlösung","text":"sich kritisch mit ihrem eigenen Kinderglauben auseinandersetzen.","level":"grundlegend","media":false,"id":"religion-8-22-k11"}]},{"id":"religion-8-23","subject":"religion","grades":[8],"title":"Der Islam","shortTitle":"Der Islam","level":"","aliases":["Der Islam","Islam"],"sourcePages":[23],"content":"","competencies":[{"category":"Sachkompetenz","text":"die Grundzüge des muslimischen Glaubens kennen.","level":"grundlegend","media":false,"id":"religion-8-23-k01"},{"category":"Sachkompetenz","text":"die Rolle Mohammeds und die Entstehung des Islam beschreiben können.","level":"grundlegend","media":false,"id":"religion-8-23-k02"},{"category":"Sachkompetenz","text":"Feste, Rituale und Symbole des Islam kennen und die Situation von Muslimen in westlich orientierten Gesellschaften wiedergeben können.","level":"grundlegend","media":false,"id":"religion-8-23-k03"},{"category":"Methoden / Medien","text":"eine eigenständige Recherche zu verschiedenen Aspekten des Islam durchführen.","level":"grundlegend","media":true,"id":"religion-8-23-k04"},{"category":"Methoden / Medien","text":"methodisch geleitet Inhalte aus audiovisuellen Medien entnehmen.","level":"grundlegend","media":true,"id":"religion-8-23-k05"},{"category":"Methoden","text":"religiöse Sprache identifizieren und ihre Eigenart benennen (Textanalyse).","level":"grundlegend","media":false,"id":"religion-8-23-k06"},{"category":"Methoden","text":"unter Anleitung und selbständig Diskussionen über die Situation des Islam in Deutschland führen.","level":"grundlegend","media":false,"id":"religion-8-23-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"auf der Grundlage ihres Wissens zur Bedeutung des muslimischen Glaubens für den Gläubigen Stellung beziehen.","level":"grundlegend","media":false,"id":"religion-8-23-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"sachgerecht die Situation der Muslime in westlich orientierten Gesellschaften erläutern.","level":"grundlegend","media":false,"id":"religion-8-23-k09"},{"category":"Bewusstsein, Reflexion und Urteil","text":"einzelne Aspekte des Islam mit Merkmalen des Christentums (und Judentum), z.B. Abraham, Jesus, Jerusalem, vergleichen.","level":"grundlegend","media":false,"id":"religion-8-23-k10"},{"category":"Handlungs- und Problemlösung","text":"im Dialog mit dem Islam sachgerecht eine eigene Position vertreten.","level":"grundlegend","media":false,"id":"religion-8-23-k11"},{"category":"Handlungs- und Problemlösung","text":"diskutieren, ob der Islam in Deutschland etwas „Fremdes“ ist bzw. ein „normaler“ Bestandteil der pluralen Gesellschaft in Deutschland.","level":"grundlegend","media":false,"id":"religion-8-23-k12"},{"category":"Handlungs- und Problemlösung","text":"eigene Sichtweisen zu Chancen und Grenzen toleranten Verhaltens entwickeln.","level":"grundlegend","media":false,"id":"religion-8-23-k13"}]},{"id":"religion-8-24","subject":"religion","grades":[8],"title":"Jesus und seiner Botschaft begegnen","shortTitle":"Jesus und seiner Botschaft begegnen","level":"","aliases":["Jesus und seiner Botschaft begegnen","Bergpredigt","Reich Gottes"],"sourcePages":[24],"content":"","competencies":[{"category":"Sachkompetenz","text":"die Entstehung der Evangelien kennen und sie zeitlich einordnen können.","level":"grundlegend","media":false,"id":"religion-8-24-k01"},{"category":"Sachkompetenz","text":"zentrale Aussagen Jesu in der Bergpredigt kennen und sie vor dem Hintergrund der damaligen Zeit deuten sowie ihre heutige Relevanz anhand beispielhafter Menschen benennen.","level":"grundlegend","media":false,"id":"religion-8-24-k02"},{"category":"Sachkompetenz","text":"anhand von Gleichnis- und Wundererzählungen die Botschaft des Reich Gottes erkennen und erläutern können, inwieweit diese Aussagen heutige Bedeutung besitzen.","level":"grundlegend","media":false,"id":"religion-8-24-k03"},{"category":"Methoden / Medien","text":"eine Internetrecherche durchführen.","level":"grundlegend","media":true,"id":"religion-8-24-k04"},{"category":"Methoden","text":"ihre Arbeitsergebnisse in angemessener zeitlicher und graphischer Form wiedergeben (Präsentation).","level":"grundlegend","media":false,"id":"religion-8-24-k05"},{"category":"Methoden","text":"religiöse Sprache identifizieren und die formalen sowie inhaltlichen Eigenarten erläutern (Textanalyse; metaphorische Rede; Gleichnisse, …).","level":"grundlegend","media":false,"id":"religion-8-24-k06"},{"category":"Methoden","text":"Stellung nehmen zu einzelnen Aussagen biblischer Texte (Textanalyse).","level":"grundlegend","media":false,"id":"religion-8-24-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"aufzeigen können, dass die ethischen Forderungen der Bergpredigt immer wieder maßgebend für die Handlungen der Menschen waren.","level":"grundlegend","media":false,"id":"religion-8-24-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"einen eigenen Standpunkt zu den Forderungen der Bergpredigt entwickeln.","level":"grundlegend","media":false,"id":"religion-8-24-k09"},{"category":"Bewusstsein, Reflexion und Urteil","text":"die Rede vom Reich Gottes als Spannung zwischen „schon da“ und „noch nicht“ wahrnehmen und Möglichkeiten beurteilen, um am Reich Gottes zu arbeiten.","level":"grundlegend","media":false,"id":"religion-8-24-k10"},{"category":"Handlungs- und Problemlösung","text":"sich mit den ethischen Forderungen der Bergpredigt auseinandersetzen, diese im Kontext der Reich-Gottes-Botschaft einordnen und Möglichkeiten der Umsetzung in der Gegenwart entwickeln bzw. benennen.","level":"grundlegend","media":false,"id":"religion-8-24-k11"}]},{"id":"religion-8-25","subject":"religion","grades":[8],"title":"Herausforderung Erwachsen werden – mit Ängsten, Anforderungen und Sinnangeboten umgehen","shortTitle":"Herausforderung Erwachsen werden – mit Ängsten, Anforderungen und Sinnangeboten umgehen","level":"","aliases":["Herausforderung Erwachsen werden","Erwachsen werden","Ängste","Sucht"],"sourcePages":[25],"content":"","competencies":[{"category":"Sachkompetenz","text":"sich mit verschiedenen Formen des Erwachsenwerdens auseinandersetzen, Erwartungen und Herausforderungen von Erwachsenen und Gleichaltrigen kennen und sich z.B. mit Süchten, Gruppenzwang und Idolen auseinandersetzen.","level":"grundlegend","media":false,"id":"religion-8-25-k01"},{"category":"Sachkompetenz","text":"sich mit fragwürdigen Sinnangeboten auseinandersetzen, die Gefahr für den Einzelnen und sich selbst beurteilen, das christliche Menschenbild beschreiben und Stellung zu Gott als sinnstiftender Lebensperspektive nehmen.","level":"grundlegend","media":false,"id":"religion-8-25-k02"},{"category":"Methoden / Medien","text":"Informationen zu Organisationen und ihrem gesellschaftlichen Kontext aus unterschiedlichen Quellen recherchieren.","level":"grundlegend","media":true,"id":"religion-8-25-k03"},{"category":"Methoden","text":"sachgemäß mit Selbst- und Fremddarstellungen umgehen.","level":"grundlegend","media":false,"id":"religion-8-25-k04"},{"category":"Methoden","text":"in Rollenspielen Herausforderungssituationen nachspielen.","level":"grundlegend","media":false,"id":"religion-8-25-k05"},{"category":"Methoden","text":"Präsentation.","level":"grundlegend","media":false,"id":"religion-8-25-k06"},{"category":"Methoden","text":"Textanalyse.","level":"grundlegend","media":false,"id":"religion-8-25-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"Erwartungen an sich selbst beschreiben.","level":"grundlegend","media":false,"id":"religion-8-25-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"Herausforderungen durch Gleichaltrige und Erwachsene erkennen und mögliche Gefahren einschätzen.","level":"grundlegend","media":false,"id":"religion-8-25-k09"},{"category":"Bewusstsein, Reflexion und Urteil","text":"das Verhältnis zwischen dem „Ich“ und der Gesellschaft angeben.","level":"grundlegend","media":false,"id":"religion-8-25-k10"},{"category":"Bewusstsein, Reflexion und Urteil","text":"das christliche Menschenbild kennen und sich zu den Eigenschaften eines christlichen Menschenbildes positionieren.","level":"grundlegend","media":false,"id":"religion-8-25-k11"},{"category":"Bewusstsein, Reflexion und Urteil","text":"über ihre mögliche Anfälligkeit für Süchte reflektieren und erklären, warum Sucht für sie ein Problem bzw. unproblematisch sein könnte.","level":"grundlegend","media":false,"id":"religion-8-25-k12"},{"category":"Handlungs- und Problemlösung","text":"sich mit Erwartungen und Herausforderungen der Gesellschaft auseinandersetzen und mögliche Gefahren einschätzen; Strategien entwickeln, um Gefährdungen selbstbewusst zu begegnen.","level":"grundlegend","media":false,"id":"religion-8-25-k13"},{"category":"Handlungs- und Problemlösung","text":"sich mit den ethischen Forderungen der Bergpredigt auseinandersetzen, diese im Kontext der Reich-Gottes-Botschaft einordnen und Möglichkeiten der Umsetzung in der Gegenwart entwickeln bzw. benennen.","level":"grundlegend","media":false,"id":"religion-8-25-k14"}]},{"id":"religion-9-27","subject":"religion","grades":[9],"title":"Leben mit dem Tod – Altern, Sterben und der Umgang mit dem Tod","shortTitle":"Leben mit dem Tod – Altern, Sterben und der Umgang mit dem Tod","level":"","aliases":["Leben mit dem Tod","Tod und Sterben","Sterben und Tod"],"sourcePages":[27],"content":"","competencies":[{"category":"Sachkompetenz","text":"eigene Erfahrungen mit dem Tod formulieren und verschiedene Formen der Trauer beschreiben; Trauerphasen, -anzeigen und -rituale der Hinterbliebenen kennen.","level":"grundlegend","media":false,"id":"religion-9-27-k01"},{"category":"Sachkompetenz","text":"sich mit Konfliktfeldern des Sterbens auseinandersetzen (z.B. Sterbehilfe) und verschiedene Positionen zu ethischen Fragestellungen wiedergeben.","level":"grundlegend","media":false,"id":"religion-9-27-k02"},{"category":"Sachkompetenz","text":"die christliche Hoffnung auf ein Leben nach dem Tod kennen.","level":"grundlegend","media":false,"id":"religion-9-27-k03"},{"category":"Methoden","text":"Traueranzeigen auswerten.","level":"grundlegend","media":false,"id":"religion-9-27-k04"},{"category":"Methoden","text":"Texte zu ethischen Problemen auswerten und ethische Stellungnahmen erarbeiten.","level":"grundlegend","media":false,"id":"religion-9-27-k05"},{"category":"Methoden","text":"eine Pro- und Kontra-Diskussion zu einem ethischen Thema führen.","level":"grundlegend","media":false,"id":"religion-9-27-k06"},{"category":"Bewusstsein, Reflexion und Urteil","text":"ihre eigenen Vorstellungen vom Tod wiedergeben.","level":"grundlegend","media":false,"id":"religion-9-27-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"ethische Probleme diskutieren und mögliche Konfliktlösungen entwickeln.","level":"grundlegend","media":false,"id":"religion-9-27-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"über die Bedeutung eines menschenwürdigen Tods reflektieren.","level":"grundlegend","media":false,"id":"religion-9-27-k09"},{"category":"Handlungs- und Problemlösung","text":"verschiedene Formen der Trauer kennen und eigene Handlungsmöglichkeiten für die Trauerbewältigung entwickeln.","level":"grundlegend","media":false,"id":"religion-9-27-k10"},{"category":"Handlungs- und Problemlösung","text":"sich zu ethischen Konfliktsituationen positionieren und eigene Möglichkeiten des Handelns angeben.","level":"grundlegend","media":false,"id":"religion-9-27-k11"},{"category":"Handlungs- und Problemlösung","text":"sich mit der Hoffnung auf Auferstehung im Christentum auseinandersetzen und die mögliche Bedeutung für Menschen in ihrem Umgang mit dem Tod ermitteln.","level":"grundlegend","media":false,"id":"religion-9-27-k12"}]},{"id":"religion-9-28","subject":"religion","grades":[9],"title":"Fernöstliche Religionen – Buddhismus und Hinduismus","shortTitle":"Fernöstliche Religionen – Buddhismus und Hinduismus","level":"","aliases":["Fernöstliche Religionen","Buddhismus","Hinduismus","Buddhismus / Hinduismus"],"sourcePages":[28],"content":"","competencies":[{"category":"Sachkompetenz","text":"die grundlegenden Rituale und Symbole des Buddhismus/Hinduismus benennen und erläutern.","level":"grundlegend","media":false,"id":"religion-9-28-k01"},{"category":"Sachkompetenz","text":"Grundzüge der Glaubenslehre des Buddhismus/Hinduismus und seiner Entstehung beschreiben.","level":"grundlegend","media":false,"id":"religion-9-28-k02"},{"category":"Methoden","text":"sich kreativ mit einer fernöstlichen Religion auseinandersetzen, indem sie z.B. Plakate gestalten.","level":"grundlegend","media":false,"id":"religion-9-28-k03"},{"category":"Bewusstsein, Reflexion und Urteil","text":"Stellung zur Bedeutung der Glaubensinhalte für den Glaubenden nehmen.","level":"grundlegend","media":false,"id":"religion-9-28-k04"},{"category":"Bewusstsein, Reflexion und Urteil","text":"dem Buddhismus respektvoll begegnen und ausgewählte Aspekte der Religion präsentieren.","level":"grundlegend","media":false,"id":"religion-9-28-k05"},{"category":"Bewusstsein, Reflexion und Urteil","text":"zentrale Glaubensinhalte und die Ethik der fernöstlichen Religion mit denen anderer Religionen vergleichen und beurteilen sowie begründet einen eigenen Standpunkt vertreten.","level":"grundlegend","media":false,"id":"religion-9-28-k06"},{"category":"Handlungs- und Problemlösung","text":"die Möglichkeiten zur Formulierung eines gemeinsamen ethischen Kerns von Christentum und Buddhismus/Hinduismus beurteilen.","level":"grundlegend","media":false,"id":"religion-9-28-k07"}]},{"id":"religion-9-29","subject":"religion","grades":[9],"title":"Die Gemeinsamkeiten der Weltreligionen","shortTitle":"Die Gemeinsamkeiten der Weltreligionen","level":"","aliases":["Gemeinsamkeiten der Weltreligionen","Weltreligionen"],"sourcePages":[29],"content":"","competencies":[{"category":"Sachkompetenz","text":"Kenntnisse zu den Weltreligionen wiederholen, Kerninhalte gegenüberstellen und Gemeinsamkeiten entdecken.","level":"grundlegend","media":false,"id":"religion-9-29-k01"},{"category":"Sachkompetenz","text":"auf Basis ihres Kenntnisstandes einen gemeinsamen Kern der Weltreligionen benennen und sich hauptsächlich an Kernprinzipien der Religionen (z.B. Menschlichkeit, Goldene Regel, Gerechtigkeit, …) orientieren sowie kritisch die Möglichkeit einer solchen Formulierung beurteilen.","level":"grundlegend","media":false,"id":"religion-9-29-k02"},{"category":"Methoden / Medien","text":"selbstständig fehlende Informationen ermitteln (Internetrecherche, versch. Schulbücher, …).","level":"grundlegend","media":true,"id":"religion-9-29-k03"},{"category":"Methoden","text":"Diskussionsrunden, Referate.","level":"grundlegend","media":false,"id":"religion-9-29-k04"},{"category":"Methoden","text":"ggf. Lernen an einem außerschulischen Lernort (Kirche, Moschee, …).","level":"grundlegend","media":false,"id":"religion-9-29-k05"},{"category":"Bewusstsein, Reflexion und Urteil","text":"zentrale Glaubensinhalte der Weltreligionen vergleichen und begründet einen eigenen Standpunkt vertreten.","level":"grundlegend","media":false,"id":"religion-9-29-k06"},{"category":"Bewusstsein, Reflexion und Urteil","text":"die Friedensabsicht als einen zentralen ethischen Kern der Religionen ermitteln.","level":"grundlegend","media":false,"id":"religion-9-29-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"Stellung zur Bedeutung der Glaubensinhalte für den Glaubenden nehmen.","level":"grundlegend","media":false,"id":"religion-9-29-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"den verschiedenen Religionen respektvoll begegnen und ausgewählte Aspekte der Religion präsentieren.","level":"grundlegend","media":false,"id":"religion-9-29-k09"},{"category":"Handlungs- und Problemlösung","text":"die Möglichkeiten zur Formulierung eines gemeinsamen ethischen Kerns der Weltreligionen beurteilen.","level":"grundlegend","media":false,"id":"religion-9-29-k10"},{"category":"Handlungs- und Problemlösung","text":"die Bedeutung von religiöser Bindung und den Anspruch einer solchen Prägung für das Zusammenarbeiten der Religionen erörtern.","level":"grundlegend","media":false,"id":"religion-9-29-k11"}]},{"id":"religion-9-30","subject":"religion","grades":[9],"title":"Christentum und Judentum – eine gemeinsame Geschichte","shortTitle":"Christentum und Judentum – eine gemeinsame Geschichte","level":"","aliases":["Christentum und Judentum","gemeinsame Geschichte","Antisemitismus"],"sourcePages":[30],"content":"","competencies":[{"category":"Sachkompetenz","text":"die Entwicklung des Christentums von der verfolgten Kirche der Antike zur staatstragenden und dominierenden Religion Europas im Mittelalter ermitteln.","level":"grundlegend","media":false,"id":"religion-9-30-k01"},{"category":"Sachkompetenz","text":"sich mit dem Verhältnis zwischen Christentum und Judentum seit dem Mittelalter auseinandersetzen, die Diskriminierung und Verfolgung der jüdischen Religion durch die christliche Kirche erkennen und die Entwicklung des Judentums zwischen Emanzipation und Verfolgung in Europa nachvollziehen.","level":"grundlegend","media":false,"id":"religion-9-30-k02"},{"category":"Sachkompetenz","text":"zwischen kirchlicher Verfolgung (Antijudaismus) und späterer säkularer Verfolgung (Antisemitismus) unterscheiden sowie Verfolgung und Vernichtung der Juden zur Zeit des Nationalsozialismus kennen.","level":"grundlegend","media":false,"id":"religion-9-30-k03"},{"category":"Methoden","text":"mit Quellen aus der Religionsgeschichte arbeiten und selbstständig Informationen entnehmen bzw. analysieren.","level":"grundlegend","media":false,"id":"religion-9-30-k04"},{"category":"Methoden / Medien","text":"weiterführende Informationen ermitteln (Internetrecherche u.a.).","level":"grundlegend","media":true,"id":"religion-9-30-k05"},{"category":"Bewusstsein, Reflexion und Urteil","text":"zur Macht der Kirche im Mittelalter Stellung beziehen.","level":"grundlegend","media":false,"id":"religion-9-30-k06"},{"category":"Bewusstsein, Reflexion und Urteil","text":"die Verfolgung der Christen mit dem Verhalten der Kirche gegenüber den Juden im Mittelalter vergleichen.","level":"grundlegend","media":false,"id":"religion-9-30-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"intolerantes Verhalten gegenüber Menschen anderer Religionen in Geschichte und Gegenwart erörtern.","level":"grundlegend","media":false,"id":"religion-9-30-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"sachgerecht die Verfolgung der Juden zur Zeit des Nationalsozialismus beurteilen.","level":"grundlegend","media":false,"id":"religion-9-30-k09"},{"category":"Bewusstsein, Reflexion und Urteil","text":"Judentum und Christentum miteinander in Beziehung setzen und Beispiele für die Nähe der Religionen anführen.","level":"grundlegend","media":false,"id":"religion-9-30-k10"},{"category":"Bewusstsein, Reflexion und Urteil","text":"sich mit der Aktualität des gesellschaftlichen Antisemitismus auseinandersetzen.","level":"grundlegend","media":false,"id":"religion-9-30-k11"},{"category":"Handlungs- und Problemlösung","text":"die Verfolgung der Christen zur Zeit der Antike und die Haltung der Christen gegenüber Andersgläubigen in Geschichte und Gegenwart erörtern.","level":"grundlegend","media":false,"id":"religion-9-30-k12"},{"category":"Handlungs- und Problemlösung","text":"zu Christenverfolgungen in der Gegenwart recherchieren.","level":"grundlegend","media":false,"id":"religion-9-30-k13"},{"category":"Handlungs- und Problemlösung","text":"nach Spuren des Judentums im Moormerland und Umgebung recherchieren.","level":"grundlegend","media":false,"id":"religion-9-30-k14"},{"category":"Handlungs- und Problemlösung","text":"der jüdischen Religion und ihrer Geschichte respektvoll und tolerant begegnen.","level":"grundlegend","media":false,"id":"religion-9-30-k15"}]},{"id":"religion-10-32","subject":"religion","grades":[10],"title":"Kirche und Nationalsozialismus","shortTitle":"Kirche und Nationalsozialismus","level":"","aliases":["Kirche und Nationalsozialismus","Nationalsozialismus"],"sourcePages":[32],"content":"","competencies":[{"category":"Sachkompetenz","text":"die Positionen der evangelischen und katholischen Kirche in der Auseinandersetzung mit dem Nationalsozialismus kennen.","level":"grundlegend","media":false,"id":"religion-10-32-k01"},{"category":"Sachkompetenz","text":"die Geschichte und Gegenwart des Judentums darstellen.","level":"grundlegend","media":false,"id":"religion-10-32-k02"},{"category":"Sachkompetenz","text":"Grundzüge des jüdischen Glaubens beschreiben, die besondere Beziehung des Christentums zum Judentum (gemeinsame Wurzel) darstellen und zur Bedeutung für den Glaubenden Stellung nehmen.","level":"grundlegend","media":false,"id":"religion-10-32-k03"},{"category":"Methoden","text":"Position beziehen.","level":"grundlegend","media":false,"id":"religion-10-32-k04"},{"category":"Methoden","text":"Lebenslauf zu einer Person der katholischen oder evangelischen Kirche zur Zeit des Nationalsozialismus vorstellen.","level":"grundlegend","media":false,"id":"religion-10-32-k05"},{"category":"Methoden","text":"Streitgespräch entwickeln.","level":"grundlegend","media":false,"id":"religion-10-32-k06"},{"category":"Methoden","text":"Kreatives Schreiben (Briefe, Tagebucheintrag).","level":"grundlegend","media":false,"id":"religion-10-32-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"gemäß ihrem bisherigen Kenntnisstand sachgerecht die Verfolgung im Nationalsozialismus beurteilen.","level":"grundlegend","media":false,"id":"religion-10-32-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"kritisch Stationen der Kirchengeschichte beurteilen und das Geschehen im historischen Zusammenhang interpretieren.","level":"grundlegend","media":false,"id":"religion-10-32-k09"},{"category":"Handlungs- und Problemlösung","text":"Gegenwartssituationen reflektieren, in denen freiheitliche Rechte sowie das Recht auf freie Religionsausübung gewährleistet bzw. nicht gewährleistet werden, und dabei mehrere verschiedene Religionen in den Blick nehmen.","level":"grundlegend","media":false,"id":"religion-10-32-k10"}]},{"id":"religion-10-33","subject":"religion","grades":[10],"title":"Leben, Tod und Auferstehung Jesu","shortTitle":"Leben, Tod und Auferstehung Jesu","level":"","aliases":["Leben, Tod und Auferstehung Jesu","Auferstehung Jesu"],"sourcePages":[33],"content":"","competencies":[{"category":"Sachkompetenz","text":"die Lebensgeschichte Jesu kennen und zentrale ethische Aussagen, z.B. die Bergpredigt, wiederholen.","level":"grundlegend","media":false,"id":"religion-10-33-k01"},{"category":"Sachkompetenz","text":"Tod und Auferstehung Jesu als zentralen Inhalt des christlichen Glaubens und Bekräftigung der Botschaft Jesu kennen.","level":"grundlegend","media":false,"id":"religion-10-33-k02"},{"category":"Methoden","text":"selbständige Themenplanerarbeitung.","level":"grundlegend","media":false,"id":"religion-10-33-k03"},{"category":"Methoden","text":"Position beziehen.","level":"grundlegend","media":false,"id":"religion-10-33-k04"},{"category":"Methoden","text":"die Symbolik der Darstellungen von Tod und Auferstehung Jesu erläutern und sie kreativ gestalten.","level":"grundlegend","media":false,"id":"religion-10-33-k05"},{"category":"Bewusstsein, Reflexion und Urteil","text":"gemäß ihrem bisherigen Kenntnisstand verschiedene Deutungen zum Tod Jesu beurteilen.","level":"grundlegend","media":false,"id":"religion-10-33-k06"},{"category":"Bewusstsein, Reflexion und Urteil","text":"die mögliche Beziehung zu Gott als einen lebenslangen Prozess interpretieren, der nach christlicher Hoffnung über den Tod hinausgeht, und daraus eigene Lebensperspektiven entwerfen.","level":"grundlegend","media":false,"id":"religion-10-33-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"die Auferstehungshoffnung als Chance für die Ausrichtung des eigenen Lebens erörtern.","level":"grundlegend","media":false,"id":"religion-10-33-k08"},{"category":"Handlungs- und Problemlösung","text":"christliche Antworten auf Sinnfragen sowie Möglichkeiten und Grenzen menschlichen Handelns reflektieren.","level":"grundlegend","media":false,"id":"religion-10-33-k09"}]},{"id":"religion-10-34","subject":"religion","grades":[10],"title":"Fragen des Lebens","shortTitle":"Fragen des Lebens","level":"","aliases":["Fragen des Lebens","Ethik","Sinnfragen"],"sourcePages":[34],"content":"","competencies":[{"category":"Sachkompetenz","text":"eine christliche Position zu einem ethischen Konfliktfall darstellen.","level":"grundlegend","media":false,"id":"religion-10-34-k01"},{"category":"Sachkompetenz","text":"verschiedene ethische Ansätze (z.B. Pflichtenethik, Utilitarismus) kennen.","level":"grundlegend","media":false,"id":"religion-10-34-k02"},{"category":"Sachkompetenz","text":"sachgerecht erklären, was unter einem Wertekonflikt zu verstehen ist, und mögliche Konfliktlösungen argumentativ vertreten.","level":"grundlegend","media":false,"id":"religion-10-34-k03"},{"category":"Methoden","text":"eine begründete Position beziehen und diese anhand eines ethischen Modells erklären.","level":"grundlegend","media":false,"id":"religion-10-34-k04"},{"category":"Methoden","text":"Streitgespräch.","level":"grundlegend","media":false,"id":"religion-10-34-k05"},{"category":"Methoden","text":"Plakate/Präsentationen.","level":"grundlegend","media":false,"id":"religion-10-34-k06"},{"category":"Bewusstsein, Reflexion und Urteil","text":"einen eigenen Standpunkt zu einem ethischen Konfliktfall einnehmen.","level":"grundlegend","media":false,"id":"religion-10-34-k07"},{"category":"Bewusstsein, Reflexion und Urteil","text":"erläutern, dass sie nach christlichem Verständnis als Teil einer Gemeinschaft zu verantwortlichem Handeln für sich und andere bestimmt sind.","level":"grundlegend","media":false,"id":"religion-10-34-k08"},{"category":"Bewusstsein, Reflexion und Urteil","text":"christliche Antworten auf Sinnfragen sowie Möglichkeiten und Grenzen menschlichen Handelns erörtern.","level":"grundlegend","media":false,"id":"religion-10-34-k09"},{"category":"Bewusstsein, Reflexion und Urteil","text":"die Wahrung der Menschenwürde in Konfliktfällen beurteilen.","level":"grundlegend","media":false,"id":"religion-10-34-k10"},{"category":"Handlungs- und Problemlösung","text":"erklären, dass Geschlechtlichkeit und Partnerschaft dem Menschen zum verantwortlichen Umgang anvertraut sind, und Möglichkeiten des Zusammenlebens entwerfen.","level":"grundlegend","media":false,"id":"religion-10-34-k11"}]},{"id":"mathe-5-13-all","subject":"mathematik","grades":[5],"title":"Unsere Klasse","shortTitle":"Daten und Größen","level":"","aliases":["Unsere Klasse"],"sourcePages":[13],"competencies":[{"category":"Kern","text":"statistische Erhebungen planen, Daten erheben und geeignet darstellen","media":false,"id":"mathe-5-13-all-k01"},{"category":"Kern","text":"graphische Darstellungen wie Säulendiagramme, Balkendiagramme und Piktogramme von statistischen Erhebungen anfertigen und auswerten","media":false,"id":"mathe-5-13-all-k02"},{"category":"Kern","text":"Strichlisten und Tabellen von statistischen Erhebungen anlegen und auswerten","media":false,"id":"mathe-5-13-all-k03"},{"category":"Kern","text":"Daten sortieren","media":false,"id":"mathe-5-13-all-k04"},{"category":"Kern","text":"Daten nach der Größe ordnen","media":false,"id":"mathe-5-13-all-k05"},{"category":"Kern (nur E-Niveau)","text":"Daten in Kreisdiagramm darstellen","media":false,"id":"mathe-5-13-all-k06"},{"category":"Kern (nur E-Niveau)","text":"Fachsprache benutzen","media":false,"id":"mathe-5-13-all-k07"}]},{"id":"mathe-5-14-all","subject":"mathematik","grades":[5],"title":"Klassenkameraden besuchen","shortTitle":"Koordinatensystem und Graphen","level":"","aliases":["Klassenkameraden besuchen"],"sourcePages":[14],"competencies":[{"category":"Kern","text":"Koordinaten im Kontext von Stadtplänen bzw. Landkarten nutzen","media":false,"id":"mathe-5-14-all-k01"},{"category":"Kern","text":"Punkte, Strecken und geometrische Figuren im ebenen kartesischen Koordinatensystem darstellen und Koordinaten ablesen","media":false,"id":"mathe-5-14-all-k02"},{"category":"Kern","text":"Zusammenhänge zwischen zwei Größen erkennen und beschreiben.","media":false,"id":"mathe-5-14-all-k03"},{"category":"Kern","text":"Graphen von Zuordnungen lesen und deuten.","media":false,"id":"mathe-5-14-all-k04"}]},{"id":"mathe-5-15-all","subject":"mathematik","grades":[5],"title":"Grundrechenarten I + II / Rund um die Haustiere","shortTitle":"Natürliche Zahlen","level":"","aliases":["Grundrechenarten I + II","Grundrechenarten","Rund um die Haustiere","Natürliche Zahlen"],"sourcePages":[15],"competencies":[{"category":"Kern","text":"Grundrechenarten zum Lösen von Problemen in Sachzusammenhängen nutzen","media":false,"id":"mathe-5-15-all-k01"},{"category":"Kern","text":"einfache Rechenaufgaben im Kopf lösen","media":false,"id":"mathe-5-15-all-k02"},{"category":"Kern","text":"natürliche Zahlen im Hinblick auf Teiler und Vielfache untersuchen","media":false,"id":"mathe-5-15-all-k03"},{"category":"Kern","text":"Rechenaufgaben mit halbschriftlichen und schriftlichen Verfahren lösen","media":false,"id":"mathe-5-15-all-k04"},{"category":"Kern","text":"Rechengesetze zum vorteilhaften Rechnen nutzen","media":false,"id":"mathe-5-15-all-k05"},{"category":"Kern","text":"Zahlen sachangemessen runden","media":false,"id":"mathe-5-15-all-k06"},{"category":"Kern","text":"Überschlagsrechnungen zur Lösung und zur Kontrolle von Ergebnissen nutzen","media":false,"id":"mathe-5-15-all-k07"},{"category":"Kern","text":"Platzhalter bei einfachen Berechnungen verwenden","media":false,"id":"mathe-5-15-all-k08"},{"category":"Kern","text":"in ihrer Umwelt Größen in vereinbarten Einheiten messen","media":false,"id":"mathe-5-15-all-k09"},{"category":"Kern","text":"alltagsnahe Größen in benachbarte Einheiten umrechnen","media":false,"id":"mathe-5-15-all-k10"},{"category":"Kern","text":"Einheiten von Größen situationsgerecht auswählen","media":false,"id":"mathe-5-15-all-k11"},{"category":"Kern","text":"Größen über geeignete Repräsentanten schätzen und vergleichen","media":false,"id":"mathe-5-15-all-k12"},{"category":"Kern (nur E-Niveau)","text":"Potenzen zur Darstellung einer Multiplikation nutzen","media":false,"id":"mathe-5-15-all-k13"},{"category":"Kern (nur E-Niveau)","text":"Fachsprache benutzen","media":false,"id":"mathe-5-15-all-k14"}]},{"id":"mathe-5-16-all","subject":"mathematik","grades":[5],"title":"Erlebniswelt Geometrie / Gut verpackt","shortTitle":"Figuren und Körper","level":"","aliases":["Erlebniswelt Geometrie","Gut verpackt","Figuren und Körper"],"sourcePages":[16],"competencies":[{"category":"Kern","text":"geometrische Strukturen in ihrer Umwelt erkennen und beschreiben","media":false,"id":"mathe-5-16-all-k01"},{"category":"Kern","text":"geometrische Objekte der Ebene und des Raumes charakterisieren und sie in ihrer Umwelt identifizieren","media":false,"id":"mathe-5-16-all-k02"},{"category":"Kern","text":"räumliche Strukturen mit den Begriffen Ecke, Kante, Fläche, Oberfläche, Volumen, Mantel beschreiben","media":false,"id":"mathe-5-16-all-k03"},{"category":"Kern","text":"Körper als Kantenmodelle herstellen","media":false,"id":"mathe-5-16-all-k04"},{"category":"Kern","text":"ebene Strukturen mit den Begriffen Punkt, Strecke, Gerade, Radius, Abstand, „parallel zu“ und „senkrecht zu“ beschreiben","media":false,"id":"mathe-5-16-all-k05"},{"category":"Kern","text":"Körpernetze von Würfeln und Quadern zeichnen, Modelle aus Papier herstellen","media":false,"id":"mathe-5-16-all-k06"},{"category":"Kern","text":"Körpernetze entwerfen und verifizieren","media":false,"id":"mathe-5-16-all-k07"},{"category":"Kern","text":"Quader und Würfel aus Körpernetzen herstellen","media":false,"id":"mathe-5-16-all-k08"},{"category":"Kern","text":"Schrägbilder und Körpernetze von Würfeln und Quadern zeichnen und deuten","media":false,"id":"mathe-5-16-all-k09"},{"category":"Kern","text":"geometrische Figuren unter Verwendung angemessener Hilfsmittel wie Zirkel, Lineal und Geodreieck skizzieren und zeichnen","media":false,"id":"mathe-5-16-all-k10"},{"category":"Kern (nur E-Niveau)","text":"geometrische Objekte mithilfe von dynamischer Geometriesoftware skizieren und zeichnen","media":false,"id":"mathe-5-16-all-k11"},{"category":"Kern (nur E-Niveau)","text":"Fachsprache benutzen","media":false,"id":"mathe-5-16-all-k12"}]},{"id":"mathe-5-17-all","subject":"mathematik","grades":[5],"title":"Wir teilen auf","shortTitle":"Brüche als Anteile","level":"","aliases":["Wir teilen auf","Brüche als Anteile"],"sourcePages":[17],"competencies":[{"category":"Kern","text":"Notwendigkeit von Bruchzahlen erkennen","media":false,"id":"mathe-5-17-all-k01"},{"category":"Kern","text":"Brüche herstellen, veranschaulichen und erkennen","media":false,"id":"mathe-5-17-all-k02"},{"category":"Kern","text":"Brüche als Anteile deuten","media":false,"id":"mathe-5-17-all-k03"},{"category":"Kern","text":"Brüche in unterschiedlichen Sinnkontexten deuten und mit ihnen umgehen","media":false,"id":"mathe-5-17-all-k04"},{"category":"Kern","text":"Anteile vergleichen","media":false,"id":"mathe-5-17-all-k05"},{"category":"Kern","text":"Brüche ordnen und das Vorgehen beim Vergleichen erklären","media":false,"id":"mathe-5-17-all-k06"},{"category":"Kern","text":"alltägliche Prozentangaben als Brüche deuten","media":false,"id":"mathe-5-17-all-k07"}]},{"id":"mathe-5-18-all","subject":"mathematik","grades":[5],"title":"Erlebniswelt Kreise, Spiegelung, Symmetrien","shortTitle":"Symmetrien entdecken","level":"","aliases":["Symmetrien entdecken","Erlebniswelt Kreise","Spiegelung","Symmetrien"],"sourcePages":[18],"competencies":[{"category":"Kern","text":"Symmetrien in der Umwelt entdecken","media":false,"id":"mathe-5-18-all-k01"},{"category":"Kern","text":"Symmetrien unterscheiden","media":false,"id":"mathe-5-18-all-k02"},{"category":"Kern","text":"achsensymmetrische Figuren durch Falten, Spiegeln und Zeichnen erzeugen","media":false,"id":"mathe-5-18-all-k03"},{"category":"Kern","text":"parallelverschobene Figuren durch Falten und Schneiden sowie durch Zeichnen erzeugen","media":false,"id":"mathe-5-18-all-k04"},{"category":"Kern","text":"Figuren in der Ebene spiegeln und verschieben und damit Muster erzeugen","media":false,"id":"mathe-5-18-all-k05"},{"category":"Kern","text":"Figuren auf Symmetrien untersuchen und Symmetrieeigenschaften erkennen und begründen","media":false,"id":"mathe-5-18-all-k06"},{"category":"Kern (nur E-Niveau)","text":"geometrische Objekte mithilfe von dynamischer Geometriesoftware skizieren und zeichnen","media":false,"id":"mathe-5-18-all-k07"}]},{"id":"mathe-6-20-all","subject":"mathematik","grades":[6],"title":"Dezimalzahlen","shortTitle":"Dezimalzahlen","level":"","aliases":["Dezimalzahlen"],"sourcePages":[20],"competencies":[{"category":"Kern","text":"die Notwendigkeit der Zahlbereichserweiterungen von natürlichen zu positiven rationalen Zahlen an Beispielen erläutern","media":false,"id":"mathe-6-20-all-k01"},{"category":"Kern","text":"die Stellenwerttafel zur Darstellung der Dezimalzahlen nutzen","media":false,"id":"mathe-6-20-all-k02"},{"category":"Kern","text":"positive rationale Zahlen ordnen und vergleichen","media":false,"id":"mathe-6-20-all-k03"},{"category":"Kern","text":"mit Dezimalzahlen rechnen","media":false,"id":"mathe-6-20-all-k04"},{"category":"Kern","text":"Platzhalter bei einfachen Berechnungen verwenden","media":false,"id":"mathe-6-20-all-k05"},{"category":"Kern","text":"Dezimalzahlen als Darstellungsform von Brüchen deuten und Umwandlungen durchführen","media":false,"id":"mathe-6-20-all-k06"},{"category":"Kern","text":"Sachsituationen durch Zahlenterme beschreiben und Zahlenterme in Sachsituationen deuten","media":false,"id":"mathe-6-20-all-k07"},{"category":"Kern","text":"den arithmetischen Mittelwert berechnen","media":false,"id":"mathe-6-20-all-k08"}]},{"id":"mathe-6-21-all","subject":"mathematik","grades":[6],"title":"Winkel","shortTitle":"Winkel","level":"","aliases":["Winkel","Orientierung mit Karte und Kompass"],"sourcePages":[21],"competencies":[{"category":"Kern","text":"Winkel in der Umwelt entdecken","media":false,"id":"mathe-6-21-all-k01"},{"category":"Kern","text":"beliebige Winkel mit dem rechten Winkel vergleichen","media":false,"id":"mathe-6-21-all-k02"},{"category":"Kern","text":"Winkel schätzen","media":false,"id":"mathe-6-21-all-k03"},{"category":"Kern","text":"spitze-, stumpfe und rechte Winkel unterscheiden","media":false,"id":"mathe-6-21-all-k04"},{"category":"Kern","text":"Winkel mit dem Geodreieck messen und zeichnen","media":false,"id":"mathe-6-21-all-k05"},{"category":"Kern","text":"Winkel nutzen, um ebene Strukturen zu beschreiben","media":false,"id":"mathe-6-21-all-k06"}]},{"id":"mathe-6-22-all","subject":"mathematik","grades":[6],"title":"Zufallsexperimente","shortTitle":"Zufallsexperimente","level":"","aliases":["Zufallsexperimente","Gewinnen und verlieren I","Gewinnen und verlieren II"],"sourcePages":[22],"competencies":[{"category":"Kern","text":"Zufälle und Wahrscheinlichkeiten im Alltag beschreiben","media":false,"id":"mathe-6-22-all-k01"},{"category":"Kern","text":"Zufallsexperimente (Laplace und Nicht-Laplace) durchführen und die Ergebnisse interpretieren","media":false,"id":"mathe-6-22-all-k02"},{"category":"Kern","text":"Wahrscheinlichkeiten bei einstufigen Zufallsexperimenten bestimmen","media":false,"id":"mathe-6-22-all-k03"}]},{"id":"mathe-6-23-all","subject":"mathematik","grades":[6],"title":"Brüche addieren und subtrahieren","shortTitle":"Brüche addieren und subtrahieren","level":"","aliases":["Brüche addieren und subtrahieren"],"sourcePages":[23],"competencies":[{"category":"Kern","text":"gleichwertige Brüche erkennen","media":false,"id":"mathe-6-23-all-k01"},{"category":"Kern","text":"gleichwertige Brüche erzeugen","media":false,"id":"mathe-6-23-all-k02"},{"category":"Kern","text":"Kürzen und Erweitern von einfachen Brüchen als Vergröbern bzw. Verfeinern der Einteilung deuten","media":false,"id":"mathe-6-23-all-k03"},{"category":"Kern","text":"Brüche in alltagsrelevanten Sachzusammenhängen addieren und subtrahieren","media":false,"id":"mathe-6-23-all-k04"}]},{"id":"mathe-6-24-all","subject":"mathematik","grades":[6],"title":"Kreis und symmetrische Figuren","shortTitle":"Kreis und symmetrische Figuren","level":"","aliases":["Kreis und symmetrische Figuren","Erlebniswelt Kreis und Symmetrie"],"sourcePages":[24],"competencies":[{"category":"Kern","text":"Kreise und Kreismuster mit dem Zirkel zeichnen","media":false,"id":"mathe-6-24-all-k01"},{"category":"Kern","text":"drehsymmetrische Figuren und Muster erkennen und zeichnerisch erzeugen","media":false,"id":"mathe-6-24-all-k02"},{"category":"Kern","text":"punktsymmetrische Figuren erkennen und zeichnerisch erzeugen","media":false,"id":"mathe-6-24-all-k03"},{"category":"Kern","text":"Punktspiegelungen als Drehung um 180° erkennen","media":false,"id":"mathe-6-24-all-k04"},{"category":"Kern","text":"Figuren in der Ebene spiegeln und drehen und damit Muster erzeugen","media":false,"id":"mathe-6-24-all-k05"},{"category":"Kern","text":"Figuren auf Symmetrien untersuchen und Symmetrieeigenschaften erkennen und begründen","media":false,"id":"mathe-6-24-all-k06"}]},{"id":"mathe-6-25-all","subject":"mathematik","grades":[6],"title":"Umfang, Flächeninhalte und Rauminhalte","shortTitle":"Umfang, Flächeninhalte und Rauminhalte","level":"","aliases":["Umfang, Flächeninhalte und Rauminhalte","Wie wir wohnen","Gut verpackt"],"sourcePages":[25],"competencies":[{"category":"Kern","text":"in ihrer Umwelt Größen in vereinbarten Einheiten messen","media":false,"id":"mathe-6-25-all-k01"},{"category":"Kern","text":"Einheiten von Größen situationsgerecht auswählen","media":false,"id":"mathe-6-25-all-k02"},{"category":"Kern","text":"Größen über geeignete Repräsentanten schätzen und vergleichen","media":false,"id":"mathe-6-25-all-k03"},{"category":"Kern","text":"alltagsnahe Größen in benachbarte Einheiten umrechnen","media":false,"id":"mathe-6-25-all-k04"},{"category":"Kern","text":"Maßangaben aus Skizzen und Texten entnehmen","media":false,"id":"mathe-6-25-all-k05"},{"category":"Kern","text":"mit Maßstäben umgehen und rechnen","media":false,"id":"mathe-6-25-all-k06"},{"category":"Kern","text":"Umfang und Flächeninhalt von Rechtecken und von aus Rechtecken zusammengesetzten Figuren schätzen und berechnen","media":false,"id":"mathe-6-25-all-k07"},{"category":"Kern","text":"Strategien für die Berechnung von Umfang und Flächeninhalt eines Rechtecks begründen","media":false,"id":"mathe-6-25-all-k08"},{"category":"Kern","text":"Oberflächeninhalt und Volumen von Quadern schätzen und berechnen","media":false,"id":"mathe-6-25-all-k09"},{"category":"Kern","text":"Strategien für die Berechnung von Oberflächeninhalt und Volumen von Quadern begründen","media":false,"id":"mathe-6-25-all-k10"}]},{"id":"mathe-7-27-all","subject":"mathematik","grades":[7],"title":"Brüche multiplizieren und dividieren","shortTitle":"Brüche multiplizieren und dividieren","level":"","aliases":["Brüche multiplizieren und dividieren","Bruchrechnung"],"sourcePages":[27],"competencies":[{"category":"Kern (G- und E-Niveau)","text":"Anteile von Anteilen herstellen","media":false,"id":"mathe-7-27-all-k01"},{"category":"Kern (G- und E-Niveau)","text":"Anteil vom Anteil zeichnerisch darstellen","media":false,"id":"mathe-7-27-all-k02"},{"category":"Kern (G- und E-Niveau)","text":"Multiplikation von Brüchen als Anteil vom Anteil deuten und in Sachsituationen nutzen","media":false,"id":"mathe-7-27-all-k03"},{"category":"Kern (G- und E-Niveau)","text":"rechnerisch Brüche multiplizieren, auch in alltagsrelevanten Sachsituationen","media":false,"id":"mathe-7-27-all-k04"},{"category":"Kern (G- und E-Niveau)","text":"Anteile verteilen und aufteilen","media":false,"id":"mathe-7-27-all-k05"},{"category":"Kern (G- und E-Niveau)","text":"rechnerisch Brüche dividieren, auch in Sachsituationen","media":false,"id":"mathe-7-27-all-k06"},{"category":"Kern (G- und E-Niveau)","text":"Brüche als Verhältnisse deuten","media":false,"id":"mathe-7-27-all-k07"},{"category":"Kern (G- und E-Niveau)","text":"Verhältnisschreibweise von der Bruchschreibweise abgrenzen","media":false,"id":"mathe-7-27-all-k08"},{"category":"Kern (nur E-Niveau)","text":"Es werden keine zusätzlichen Kompetenzen gefordert.","media":false,"id":"mathe-7-27-all-k09"}]},{"id":"mathe-7-28-all","subject":"mathematik","grades":[7],"title":"Winkel und Dreiecke","shortTitle":"Winkel und Dreiecke","level":"","aliases":["Winkel und Dreiecke","Ein Streifzug rund ums Dreieck"],"sourcePages":[28],"competencies":[{"category":"Kern (G- und E-Niveau)","text":"Dreiecke klassifizieren","media":false,"id":"mathe-7-28-all-k01"},{"category":"Kern (G- und E-Niveau)","text":"Skizzen anfertigen","media":false,"id":"mathe-7-28-all-k02"},{"category":"Kern (G- und E-Niveau)","text":"Winkelgrößen mithilfe von Neben-, Scheitel- und Stufenwinkel berechnen","media":false,"id":"mathe-7-28-all-k03"},{"category":"Kern (G- und E-Niveau)","text":"die Winkelsumme in Dreiecken zum Berechnen von Winkelgrößen nutzen","media":false,"id":"mathe-7-28-all-k04"},{"category":"Kern (G- und E-Niveau)","text":"mit Zirkel und Geodreieck Dreiecke zeichnen","media":false,"id":"mathe-7-28-all-k05"},{"category":"Kern (G- und E-Niveau)","text":"Höhen in Dreiecken und Körpern erkennen und ihre Bedeutung zur Lösung von Problemen nutzen","media":false,"id":"mathe-7-28-all-k06"},{"category":"GTR-Kompetenzen","text":"Dreiecke konstruieren (SSS)","media":true,"id":"mathe-7-28-all-k07"},{"category":"GTR-Kompetenzen","text":"Höhen in Dreiecken einzeichnen","media":true,"id":"mathe-7-28-all-k08"},{"category":"GTR-Kompetenzen","text":"Mittelsenkrechte, Winkelhalbierende einzeichnen, daraus Umkreis und Inkreis erstellen.","media":true,"id":"mathe-7-28-all-k09"},{"category":"GTR-Kompetenzen","text":"GeoGebra zur Lösung von Problemstellungen nutzen (Bilder unterlegen)","media":true,"id":"mathe-7-28-all-k10"},{"category":"GTR-Kompetenzen","text":"Satz des Thales entdecken","media":true,"id":"mathe-7-28-all-k11"},{"category":"Kern (nur E-Niveau)","text":"Dreiecke mithilfe der Kongruenzsätze mit Zirkel und Lineal konstruieren","media":false,"id":"mathe-7-28-all-k12"},{"category":"Kern (nur E-Niveau)","text":"Dreiecke mit Dynamischer Geometriesoftware zeichnen und konstruieren","media":false,"id":"mathe-7-28-all-k13"},{"category":"Kern (nur E-Niveau)","text":"Symmetrie und Kongruenz von Dreiecken beschreiben und begründen und diese Eigenschaften im Rahmen des Problemlösens und Argumentierens nutzen","media":false,"id":"mathe-7-28-all-k14"},{"category":"Kern (nur E-Niveau)","text":"besondere Linien im Dreieck kennen, zeichnen und sie zum Lösen von Sachproblemen auch unter Verwendung von Dynamischer Geometriesoftware nutzen","media":false,"id":"mathe-7-28-all-k15"},{"category":"Kern (nur E-Niveau)","text":"den Satz des Thales kennen","media":false,"id":"mathe-7-28-all-k16"}]},{"id":"mathe-7-29-all","subject":"mathematik","grades":[7],"title":"Negative Zahlen","shortTitle":"Negative Zahlen","level":"","aliases":["Negative Zahlen","Plus und Minus"],"sourcePages":[29],"competencies":[{"category":"Kern (G- und E-Niveau)","text":"negative Zahlen in Alltagssituationen erkennen","media":false,"id":"mathe-7-29-all-k01"},{"category":"Kern (G- und E-Niveau)","text":"intuitiv mit negativen Zahlen in Alltagssituationen rechnen","media":false,"id":"mathe-7-29-all-k02"},{"category":"Kern (G- und E-Niveau)","text":"rationale Zahlen ordnen und vergleichen","media":false,"id":"mathe-7-29-all-k03"},{"category":"Kern (G- und E-Niveau)","text":"rationale Zahlen addieren und subtrahieren auch in Sachzusammenhängen","media":false,"id":"mathe-7-29-all-k04"},{"category":"Kern (G- und E-Niveau)","text":"Rechenaufgaben mit rationalen Zahlen auch im Kopf lösen","media":false,"id":"mathe-7-29-all-k05"},{"category":"Kern (G- und E-Niveau)","text":"rationale Zahlen multiplizieren und dividieren","media":false,"id":"mathe-7-29-all-k06"},{"category":"Kern (nur E-Niveau)","text":"die Notwendigkeit der Zahlbereichserweiterungen von positiven rationalen zu rationalen Zahlen an Beispielen erläutern","media":false,"id":"mathe-7-29-all-k07"}]},{"id":"mathe-7-30-all","subject":"mathematik","grades":[7],"title":"Zuordnungen","shortTitle":"Zuordnungen","level":"","aliases":["Zuordnungen","Unterwegs"],"sourcePages":[30],"competencies":[{"category":"Kern (G- und E-Niveau)","text":"den Zusammenhang zwischen zwei Größen als Zuordnung beschreiben","media":false,"id":"mathe-7-30-all-k01"},{"category":"Kern (G- und E-Niveau)","text":"Sachsituationen mit proportionalen und antiproportionalen Zuordnungen modellieren","media":false,"id":"mathe-7-30-all-k02"},{"category":"Kern (G- und E-Niveau)","text":"zwischen den Darstellungsformen „Beschreibung, Tabelle und Graph“ wechseln","media":false,"id":"mathe-7-30-all-k03"},{"category":"Kern (G- und E-Niveau)","text":"proportionale und antiproportionale Zusammenhänge in der Umwelt und innermathematisch identifizieren","media":false,"id":"mathe-7-30-all-k04"},{"category":"Kern (G- und E-Niveau)","text":"proportionale Zusammenhänge in Tabellen und Graphen darstellen","media":false,"id":"mathe-7-30-all-k05"},{"category":"Kern (G- und E-Niveau)","text":"antiproportionale Zusammenhänge in Tabellen darstellen","media":false,"id":"mathe-7-30-all-k06"},{"category":"Kern (G- und E-Niveau)","text":"proportionale und antiproportionale Zuordnungen gegeneinander und gegenüber weiteren Zuordnungen abgrenzen","media":false,"id":"mathe-7-30-all-k07"},{"category":"Kern (G- und E-Niveau)","text":"Tabellen zur Berechnung nutzen, dabei auch die Dreisatztabelle","media":false,"id":"mathe-7-30-all-k08"},{"category":"GTR-Kompetenzen","text":"Eigenschaften von proportionalen und antiproportionalen graphisch entdecken","media":true,"id":"mathe-7-30-all-k09"},{"category":"GTR-Kompetenzen","text":"Proportionale und antiproportionale Zuordnungen vergleichen","media":true,"id":"mathe-7-30-all-k10"},{"category":"Kern (nur E-Niveau)","text":"Graphen antiproportionaler Zuordnungen zeichnen","media":false,"id":"mathe-7-30-all-k11"},{"category":"Kern (nur E-Niveau)","text":"Quotientengleichheit bei der proportionalen Zuordnung erkennen und nutzen","media":false,"id":"mathe-7-30-all-k12"},{"category":"Kern (nur E-Niveau)","text":"Produktgleichheit bei der antiproportionalen Zuordnung erkennen und nutzen","media":false,"id":"mathe-7-30-all-k13"}]},{"id":"mathe-7-31-all","subject":"mathematik","grades":[7],"title":"Variablen und Terme","shortTitle":"Variablen und Terme","level":"","aliases":["Variablen und Terme"],"sourcePages":[31],"competencies":[{"category":"Kern (G- und E-Niveau)","text":"Variablen als Platzhalter für Zahlen nutzen","media":false,"id":"mathe-7-31-all-k01"},{"category":"Kern (G- und E-Niveau)","text":"Terme als Rechenausdruck verstehen","media":false,"id":"mathe-7-31-all-k02"},{"category":"Kern (G- und E-Niveau)","text":"Rechengesetze vom Rechnen mit Zahlenterme auf Terme mit Variablen übertragen","media":false,"id":"mathe-7-31-all-k03"},{"category":"Kern (G- und E-Niveau)","text":"inner- und außermathematische Problemstellungen durch Terme beschreiben","media":false,"id":"mathe-7-31-all-k04"},{"category":"Kern (G- und E-Niveau)","text":"Terme in Sachsituationen veranschaulichen und deuten","media":false,"id":"mathe-7-31-all-k05"},{"category":"Kern (G- und E-Niveau)","text":"mit Variablen und Termen rechnen","media":false,"id":"mathe-7-31-all-k06"}]},{"id":"mathe-7-32-all","subject":"mathematik","grades":[7],"title":"Prozentrechnung","shortTitle":"Prozentrechnung","level":"","aliases":["Prozentrechnung","Überall Prozente"],"sourcePages":[32],"competencies":[{"category":"Kern (G- und E-Niveau)","text":"Prozentzahlen als Darstellungsform von Brüchen und Dezimalzahlen deuten und zwischen den verschiedenen Darstellungsformen wechseln","media":false,"id":"mathe-7-32-all-k01"},{"category":"Kern (G- und E-Niveau)","text":"Doppelskala aus Prozentskala und Größenskala in konkreten Sachsituationen erstellen","media":false,"id":"mathe-7-32-all-k02"},{"category":"Kern (G- und E-Niveau)","text":"bekannte Wertepaare aus Prozentangabe und Größenangabe in einer Tabelle darstellen und unbekannte Wertepaare unter Nutzung der Proportionalität ermitteln","media":false,"id":"mathe-7-32-all-k03"},{"category":"Kern (G- und E-Niveau)","text":"Prozentrechnung in Sachsituationen nutzen und Prozentsatz, Prozentwert, Grundwert, vermehrten und verminderten Grundwert berechnen","media":false,"id":"mathe-7-32-all-k04"},{"category":"Kern (G- und E-Niveau)","text":"Kreisdiagramme erstellen und damit Sachsituationen der Prozentrechnung veranschaulichen","media":false,"id":"mathe-7-32-all-k05"},{"category":"Kern (G- und E-Niveau)","text":"in der Prozentrechnung auch mit dem Dreisatz rechnen","media":false,"id":"mathe-7-32-all-k06"},{"category":"Kern (nur E-Niveau)","text":"Tabellenkalkulation zum Erstellen von Kreisdiagrammen nutzen","media":true,"id":"mathe-7-32-all-k07"}]},{"id":"mathe-7-33-all","subject":"mathematik","grades":[7],"title":"Statistische Erhebungen","shortTitle":"Statistische Erhebungen","level":"","aliases":["Statistische Erhebungen"],"sourcePages":[33],"competencies":[{"category":"Kern (G- und E-Niveau)","text":"Darstellungen von Daten analysieren und kritisch hinterfragen","media":false,"id":"mathe-7-33-all-k01"},{"category":"Kern (G- und E-Niveau)","text":"Datensätze unter Verwendung von Kenngrößen (Spannweite, Minimum, Maximum, Zentralwert, häufigster Wert, arithmetischer Mittelwert) interpretieren","media":false,"id":"mathe-7-33-all-k02"}]},{"id":"mathe-8-35-all","subject":"mathematik","grades":[8],"title":"Gleichungen","shortTitle":"Gleichungen","level":"","aliases":["Gleichungen"],"sourcePages":[35],"competencies":[{"category":"Kern (G- und E-Niveau)","text":"Variable als Platzhalter für eine Lösung kennen und nutzen","media":false,"id":"mathe-8-35-all-k01"},{"category":"Kern (G- und E-Niveau)","text":"inner- und außermathematische Problemstellungen mit Gleichungen beschreiben","media":false,"id":"mathe-8-35-all-k02"},{"category":"Kern (G- und E-Niveau)","text":"lineare Gleichungen durch (systematisches) Probieren lösen","media":false,"id":"mathe-8-35-all-k03"},{"category":"Kern (G- und E-Niveau)","text":"gegenständliche Gleichungen handelnd durch Wegnehmen, Dazulegen und Aufteilen lösen","media":false,"id":"mathe-8-35-all-k04"},{"category":"Kern (G- und E-Niveau)","text":"lineare Gleichungen algebraisch lösen","media":false,"id":"mathe-8-35-all-k05"},{"category":"Kern (G- und E-Niveau)","text":"beim Lösen von Gleichungen die Probe zur Kontrolle nutzen und die Ergebnisse beurteilen","media":false,"id":"mathe-8-35-all-k06"},{"category":"Kern (nur E-Niveau)","text":"Gleichungen mit Klammertermen der Form 𝑎 (𝑏𝑥 + 𝑐) lösen","media":false,"id":"mathe-8-35-all-k07"}]},{"id":"mathe-8-36-all","subject":"mathematik","grades":[8],"title":"Häufigkeiten und Zufallsexperimente","shortTitle":"Häufigkeiten und Zufallsexperimente","level":"","aliases":["Häufigkeiten und Zufallsexperimente","Glück und Zufall"],"sourcePages":[36],"competencies":[{"category":"Kern (E- und G-Kurs)","text":"Laplace und Nicht-Laplace Experimente durchführen","media":false,"id":"mathe-8-36-all-k01"},{"category":"Kern (E- und G-Kurs)","text":"zwischen Zufall und Wahrscheinlichkeit unterscheiden","media":false,"id":"mathe-8-36-all-k02"},{"category":"Kern (E- und G-Kurs)","text":"absolute und relative Häufigkeiten bestimmen und voneinander abgrenzen","media":false,"id":"mathe-8-36-all-k03"},{"category":"Kern (E- und G-Kurs)","text":"Wahrscheinlichkeiten bei einstufigen Zufallsexperimenten bestimmen","media":false,"id":"mathe-8-36-all-k04"},{"category":"Kern (E- und G-Kurs)","text":"Ergebnisse von einstufigen Zufallsexperimenten interpretieren","media":false,"id":"mathe-8-36-all-k05"},{"category":"Kern (E- und G-Kurs)","text":"relative Häufigkeiten zur Prognose von Wahrscheinlichkeiten nutzen","media":false,"id":"mathe-8-36-all-k06"},{"category":"Kern (E- und G-Kurs)","text":"Wahrscheinlichkeitsaussagen aus dem Alltag interpretieren","media":false,"id":"mathe-8-36-all-k07"},{"category":"Kern (E- und G-Kurs)","text":"die Wahrscheinlichkeit des Gegenereignisses zur Berechnung von Wahrscheinlichkeiten nutzen","media":false,"id":"mathe-8-36-all-k08"},{"category":"GTR-Kompetenzen","text":"Keine, aber optional zur Visualisierung Material von „diWeMa“: „Baumdiagramm zum Urnenmodell“ bzw. „Würfeln und rel. Häufigkeit“ von Andreas Lindner","media":true,"id":"mathe-8-36-all-k09"},{"category":"Kern (nur E-Kurs)","text":"Wahrscheinlichkeiten zur Prognose für absolute Häufigkeiten von Ergebnissen nutzen","media":false,"id":"mathe-8-36-all-k10"},{"category":"Kern (nur E-Kurs)","text":"Zufallsgeräte (Laplace und Nicht-Laplace) analysieren","media":false,"id":"mathe-8-36-all-k11"},{"category":"Kern (nur E-Kurs)","text":"Ergebnisse von zweistufigen Zufallsexperimenten interpretieren","media":false,"id":"mathe-8-36-all-k12"},{"category":"Kern (nur E-Kurs)","text":"zweistufige Zufallsexperimente mit und ohne Zurücklegen durchführen","media":false,"id":"mathe-8-36-all-k13"},{"category":"Kern (nur E-Kurs)","text":"Baumdiagramme als Möglichkeit der Darstellung nutzen und anfertigen","media":false,"id":"mathe-8-36-all-k14"},{"category":"Kern (nur E-Kurs)","text":"Wahrscheinlichkeiten mithilfe der Pfad- und Summenregel berechnen","media":false,"id":"mathe-8-36-all-k15"},{"category":"Kern (nur E-Kurs)","text":"Pfad- und Summenregel begründen","media":false,"id":"mathe-8-36-all-k16"}]},{"id":"mathe-8-37-all","subject":"mathematik","grades":[8],"title":"Lineare Funktionen","shortTitle":"Lineare Funktionen","level":"","aliases":["Lineare Funktionen","Veränderungen"],"sourcePages":[37],"competencies":[{"category":"Kern (G- und E-Niveau)","text":"in Sachsituationen und in Graphen lineare Zusammenhänge identifizieren","media":false,"id":"mathe-8-37-all-k01"},{"category":"Kern (G- und E-Niveau)","text":"lineare Zusammenhänge in Graphen, Tabellen und Termen und Sachsituationen darstellen und zwischen Darstellungsformen wechseln","media":false,"id":"mathe-8-37-all-k02"},{"category":"Kern (G- und E-Niveau)","text":"Sachsituationen durch lineare Funktionen modellieren","media":false,"id":"mathe-8-37-all-k03"},{"category":"Kern (G- und E-Niveau)","text":"Graphen linearer Funktionen in Hinblick auf ihre Schnittpunkte mit den Achsen und ihre Steigungen beschreiben","media":false,"id":"mathe-8-37-all-k04"},{"category":"Kern (G- und E-Niveau)","text":"Steigungsdreieck zur Berechnung der Steigung nutzen","media":false,"id":"mathe-8-37-all-k05"},{"category":"Kern (G- und E-Niveau)","text":"Variablen als Stellvertreter für eine Zahlenmenge erkennen","media":false,"id":"mathe-8-37-all-k06"},{"category":"Kern (G- und E-Niveau)","text":"Gleichungen zur Berechnung von Werten aufstellen und nutzen","media":false,"id":"mathe-8-37-all-k07"},{"category":"Kern (G- und E-Niveau)","text":"Verschiedene lineare Funktionen der Form 𝑓(𝑥) = 𝑚 ∙ 𝑥 + 𝑏 vergleichen und die Auswirkungen der Parameter 𝑚 und 𝑏 auf dem Graphen beschreiben auch mithilfe von digitalen Mathematikwerkzeugen","media":true,"id":"mathe-8-37-all-k08"},{"category":"Kern (G- und E-Niveau)","text":"mit linearen Funktionen Sachsituationen modellieren und Probleme lösen sowohl hilfsmittelfrei als auch unter Verwendung digitaler Mathematikwerkzeug","media":true,"id":"mathe-8-37-all-k09"},{"category":"GTR-Kompetenzen","text":"mit GeoGebr","media":true,"id":"mathe-8-37-all-k10"},{"category":"GTR-Kompetenzen","text":"Kontrolle der Steigung mit GeoGebra","media":true,"id":"mathe-8-37-all-k11"},{"category":"GTR-Kompetenzen","text":" siehe Kern","media":true,"id":"mathe-8-37-all-k12"},{"category":"Kern (nur E-Niveau)","text":"die Steigung von Graphen von linearen Funktionen als konstante Änderungsrate interpretieren","media":false,"id":"mathe-8-37-all-k13"},{"category":"Kern (nur E-Niveau)","text":"Schnittpunkte graphisch ermitteln und in Hinblick auf Sachsituationen deuten","media":false,"id":"mathe-8-37-all-k14"},{"category":"Kern (nur E-Niveau)","text":"lineare Gleichungen graphisch lösen","media":false,"id":"mathe-8-37-all-k15"},{"category":"Kern (nur E-Niveau)","text":"einfache lineare Gleichungssysteme mit zwei Variablen graphisch sowohl hilfsmittelfrei als auch unter Verwendung digitaler Mathematikwerkzeuge lösen","media":true,"id":"mathe-8-37-all-k16"},{"category":"Kern (nur E-Niveau)","text":"komplett mit Geo- Gebra machbar","media":false,"id":"mathe-8-37-all-k17"}]},{"id":"mathe-8-38-all","subject":"mathematik","grades":[8],"title":"Zinsrechnung","shortTitle":"Zinsrechnung","level":"","aliases":["Zinsrechnung","Sparen - Zinsrechnung"],"sourcePages":[38],"competencies":[{"category":"Kern (G- und E-Kurs)","text":"Zinsrechnung in alltagsrelevanten Sachsituationen nutzen","media":false,"id":"mathe-8-38-all-k01"},{"category":"Kern (G- und E-Kurs)","text":"Zinssätze, Zinsen und Ausgangskapital berechnen","media":false,"id":"mathe-8-38-all-k02"},{"category":"Kern (G- und E-Kurs)","text":"in der Zinsrechnung auch mit dem Dreisatz rechnen","media":false,"id":"mathe-8-38-all-k03"},{"category":"Kern (nur E-Kurs)","text":"Zinseszins rekursiv berechnen","media":false,"id":"mathe-8-38-all-k04"},{"category":"Kern (nur E-Kurs)","text":"Tabellenkalkulationssoftware nutzen","media":true,"id":"mathe-8-38-all-k05"}]},{"id":"mathe-8-39-all","subject":"mathematik","grades":[8],"title":"Flächen und Prismen","shortTitle":"Flächen und Prismen","level":"","aliases":["Flächen und Prismen","Außergewöhnliche Wohnhäuser"],"sourcePages":[39],"competencies":[{"category":"Kern (G- und E-Niveau)","text":"den Flächeninhalt von Dreieck und Parallelogramm berechnen und die Formeln begründen","media":false,"id":"mathe-8-39-all-k01"},{"category":"Kern (G- und E-Niveau)","text":"Skizzen anfertigen","media":false,"id":"mathe-8-39-all-k02"},{"category":"Kern (G- und E-Niveau)","text":"den Flächeninhalt des Trapezes berechnen","media":false,"id":"mathe-8-39-all-k03"},{"category":"Kern (G- und E-Niveau)","text":"Umfang und Flächeninhalt geradlinig begrenzter Figuren schätzen und berechnen","media":false,"id":"mathe-8-39-all-k04"},{"category":"Kern (G- und E-Niveau)","text":"mit Zirkel und Geodreieck ebene geometrische Objekte zeichnen","media":false,"id":"mathe-8-39-all-k05"},{"category":"Kern (G- und E-Niveau)","text":"maßstabsgerechte Zeichnungen erstellen","media":false,"id":"mathe-8-39-all-k06"},{"category":"Kern (G- und E-Niveau)","text":"Längen durch das Erstellen maßstabsgerechter Zeichnungen bestimmen","media":false,"id":"mathe-8-39-all-k07"},{"category":"Kern (G- und E-Niveau)","text":"Variablen in Formeln nutzen","media":false,"id":"mathe-8-39-all-k08"},{"category":"Kern (G- und E-Niveau)","text":"Vierecke klassifizieren","media":false,"id":"mathe-8-39-all-k09"},{"category":"Kern (G- und E-Niveau)","text":"Umfang und Flächeninhalt von Figuren mithilfe von geradlinig begrenzten Figuren abschätzen und die Ergebnisse bewerten","media":false,"id":"mathe-8-39-all-k10"},{"category":"Kern (G- und E-Niveau)","text":"Eigenschaften von Prismen erkennen und benennen","media":false,"id":"mathe-8-39-all-k11"},{"category":"Kern (G- und E-Niveau)","text":"Schrägbilder und Körpernetze von geraden Prismen zeichnen und deuten sowie Modelle herstellen","media":false,"id":"mathe-8-39-all-k12"},{"category":"Kern (G- und E-Niveau)","text":"Oberflächeninhalt und Volumen von geraden Prismen schätzen und berechnen","media":false,"id":"mathe-8-39-all-k13"},{"category":"GTR-Kompetenzen","text":"GeoGebra zur Visualisierung","media":true,"id":"mathe-8-39-all-k14"},{"category":"Kern (nur E-Niveau)","text":"dynamische Geometrie Software zum Zeichnen und Konstruieren ebener geometrischer Objekte verwenden","media":false,"id":"mathe-8-39-all-k15"},{"category":"Kern (nur E-Niveau)","text":"die Formel zur Flächeninhaltsberechnung des Trapezes begründen","media":false,"id":"mathe-8-39-all-k16"},{"category":"Kern (nur E-Niveau)","text":"Symmetrie und Kongruenz geometrischer Objekte beschreiben und begründen und diese Eigenschaften im Rahmen des Problemlösens und Argumentierens nutzen","media":false,"id":"mathe-8-39-all-k17"},{"category":"Kern (nur E-Niveau)","text":"die Oberflächenformel und die Volumenformel für Prismen begründen","media":false,"id":"mathe-8-39-all-k18"}]},{"id":"mathe-8-40-all","subject":"mathematik","grades":[8],"title":"Klammerterme","shortTitle":"Klammerterme","level":"","aliases":["Klammerterme","Sprache der Mathematik II"],"sourcePages":[40],"competencies":[{"category":"Kern (G- und E-Niveau)","text":"Produkt- und Summenform als Flächeninhalte deuten","media":false,"id":"mathe-8-40-all-k01"},{"category":"Kern (G- und E-Niveau)","text":"Klammerterme in Sachsituationen veranschaulichen und deuten","media":false,"id":"mathe-8-40-all-k02"},{"category":"Kern (G- und E-Niveau)","text":"Rechengesetze vom Rechnen mit Zahlenterme auf Terme mit Variablen übertragen","media":false,"id":"mathe-8-40-all-k03"},{"category":"Kern (G- und E-Niveau)","text":"Klammerterme ausmultiplizieren und berechnen","media":false,"id":"mathe-8-40-all-k04"},{"category":"Kern (nur E-Niveau)","text":"Terme faktorisieren","media":false,"id":"mathe-8-40-all-k05"}]},{"id":"mathe-9-42-e","subject":"mathematik","grades":[9],"title":"Ähnlichkeit","shortTitle":"Ähnlichkeit","level":"E","aliases":["Ähnlichkeit","Konstruieren und Projizieren"],"sourcePages":[42],"competencies":[{"category":"Inhaltlicher Kern","text":"Messungen in der Umwelt planen und diese gezielt durchführen","media":false,"id":"mathe-9-42-e-k01"},{"category":"Inhaltlicher Kern","text":"Ähnlichkeiten erkennen und begründen","media":false,"id":"mathe-9-42-e-k02"},{"category":"Inhaltlicher Kern","text":"Figuren vergrößern und verkleinern","media":false,"id":"mathe-9-42-e-k03"},{"category":"Inhaltlicher Kern","text":"unbekannte Strecken über Ähnlichkeitsfaktoren berechnen","media":false,"id":"mathe-9-42-e-k04"},{"category":"Inhaltlicher Kern","text":"Ähnlichkeitsfaktoren über Streckenverhältnisse bestimmen","media":false,"id":"mathe-9-42-e-k05"},{"category":"Inhaltlicher Kern","text":"Ähnlichkeitsfaktoren zur Lösung von Sachproblemen nutzen","media":false,"id":"mathe-9-42-e-k06"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"für die Modellierung relevante Informationen aus komplexen, nicht vertrauten Sachsituationen entnehmen","media":false,"id":"mathe-9-42-e-k07"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Fragen, die für die Mathematik charakteristisch sind, stellen und begründet Vermutungen äußern auch unter Verwendung geeigneter Medien","media":true,"id":"mathe-9-42-e-k08"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"an geeigneten Beispielen und Veranschaulichungen die Plausibilität von Aussagen zeigen und sich geeignete Informationen für Argumentationen beschaffen","media":false,"id":"mathe-9-42-e-k09"},{"category":"Methodischer Kern · Kommunizieren","text":"ihre Überlegungen anderen verständlich mitteilen, wobei sie die Fachsprache benutzen","media":false,"id":"mathe-9-42-e-k10"},{"category":"Methodischer Kern · Kommunizieren","text":"Lösungswege und Überlegungen anderer vergleichen und diese auf Schlüssigkeit und Vollständigkeit überprüfen","media":false,"id":"mathe-9-42-e-k11"},{"category":"Methodischer Kern · Kommunizieren","text":"die Arbeit im Team beurteilen und bewerten und diese weiterentwickeln","media":false,"id":"mathe-9-42-e-k12"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"vielfältige Darstellungsformen zur Problemlösung nutzen","media":false,"id":"mathe-9-42-e-k13"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"geeignete heuristische Strategien auswählen und diese anwenden","media":false,"id":"mathe-9-42-e-k14"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"Lösungswege vergleichen und die Problemlösestrategien reflektieren","media":false,"id":"mathe-9-42-e-k15"}]},{"id":"mathe-9-43-g","subject":"mathematik","grades":[9],"title":"Ähnlichkeit","shortTitle":"Ähnlichkeit","level":"G","aliases":["Ähnlichkeit","Konstruieren und Projizieren"],"sourcePages":[43],"competencies":[{"category":"Inhaltlicher Kern","text":"Ähnlichkeiten erkennen und begründen","media":false,"id":"mathe-9-43-g-k01"},{"category":"Inhaltlicher Kern","text":"Figuren vergrößern und verkleinern","media":false,"id":"mathe-9-43-g-k02"},{"category":"Inhaltlicher Kern","text":"unbekannte Strecken über bekannte Vergrößerungs- bzw. Verkleinerungsfaktoren (Ähnlichkeitsfaktoren) berechnen","media":false,"id":"mathe-9-43-g-k03"},{"category":"Inhaltlicher Kern","text":"Ähnlichkeitsfaktoren zur Lösung von Sachproblemen nutzen","media":false,"id":"mathe-9-43-g-k04"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"für die Modellierung relevante Informationen aus komplexen Sachsituationen entnehmen","media":false,"id":"mathe-9-43-g-k05"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Fragen stellen, die für die Mathematik charakteristisch sind und begründet Vermutungen äußern auch unter Verwendung geeigneter Medien","media":true,"id":"mathe-9-43-g-k06"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"an geeigneten Beispielen und Veranschaulichungen die Plausibilität von Aussagen zeigen und sich geeignete Informationen für Argumentationen beschaffen","media":false,"id":"mathe-9-43-g-k07"},{"category":"Methodischer Kern · Kommunizieren","text":"ihre Überlegungen anderen verständlich mitteilen, wobei sie die Fachsprache benutzen","media":false,"id":"mathe-9-43-g-k08"},{"category":"Methodischer Kern · Kommunizieren","text":"Lösungswege und Überlegungen anderer vergleichen und diese auf Schlüssigkeit und Vollständigkeit überprüfen","media":false,"id":"mathe-9-43-g-k09"},{"category":"Methodischer Kern · Kommunizieren","text":"die Arbeit im Team beurteilen und bewerten und diese weiterentwickeln","media":false,"id":"mathe-9-43-g-k10"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"vielfältige Darstellungsformen zur Problemlösung nutzen","media":false,"id":"mathe-9-43-g-k11"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"geeignete heuristische Strategien auswählen und diese anwenden","media":false,"id":"mathe-9-43-g-k12"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"Lösungswege vergleichen und die Problemlösestrategien reflektieren","media":false,"id":"mathe-9-43-g-k13"}]},{"id":"mathe-9-44-e","subject":"mathematik","grades":[9],"title":"Lineare Funktionen / Gleichungssysteme","shortTitle":"Lineare Funktionen / Gleichungssysteme","level":"E","aliases":["Lineare Funktionen","Gleichungssysteme","Tarife und Kosten im Vergleich"],"sourcePages":[44,45],"competencies":[{"category":"Inhaltlicher Kern","text":"Schnittpunkte von Graphen linearer Funktionen in Sachsituationen deuten","media":false,"id":"mathe-9-44-e-k01"},{"category":"Inhaltlicher Kern","text":"Schnittpunkte von Graphen linearer Funktionen berechnen","media":false,"id":"mathe-9-44-e-k02"},{"category":"Inhaltlicher Kern","text":"den Zusammenhang zwischen der Lösbarkeit eines Gleichungssystems und der Lage der zugehörigen Graphen beschreiben","media":false,"id":"mathe-9-44-e-k03"},{"category":"Inhaltlicher Kern","text":"Modellierungsaufgaben mithilfe der Schnittpunktbestimmung lösen","media":false,"id":"mathe-9-44-e-k04"},{"category":"Inhaltlicher Kern","text":"Schnittpunkte mithilfe von digitalen Mathematikwerkzeugen bestimmen","media":true,"id":"mathe-9-44-e-k05"},{"category":"Inhaltlicher Kern","text":"geometrische und algebraische Voraussetzungen untersuchen, unter denen Schnittpunkte von Graphen zweier linearer Funktionen vorliegen","media":false,"id":"mathe-9-44-e-k06"},{"category":"Inhaltlicher Kern","text":"Sachsituationen durch Gleichungssysteme modellieren und bewerten","media":false,"id":"mathe-9-44-e-k07"},{"category":"Inhaltlicher Kern","text":"lineare Gleichungssysteme mit zwei Variablen durch Probieren, graphisch und algebraisch sowohl hilfsmittelfrei als auch unter Verwendung digitaler Mathematikwerkzeuge (auch mit einem CAS) lösen","media":true,"id":"mathe-9-44-e-k08"},{"category":"Inhaltlicher Kern","text":"Gleichungssysteme mit zwei Variablen aufstellen und zur Lösung von Problemen nutzen","media":false,"id":"mathe-9-44-e-k09"},{"category":"Inhaltlicher Kern","text":"die Lösbarkeit von Gleichungssystemen mit zwei Variablen erkennen","media":false,"id":"mathe-9-44-e-k10"},{"category":"Inhaltlicher Kern","text":"den Zusammenhang zwischen der Lösbarkeit eines Gleichungssystems und der Lage der zugehörigen Graphen","media":false,"id":"mathe-9-44-e-k11"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"für die Modellierung relevante Informationen aus komplexen, nicht vertrauten Sachsituationen entnehmen","media":false,"id":"mathe-9-44-e-k12"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"Terme, Gleichungen und Funktionen zur Ermittlung von Lösungen im mathematischen Modell verwenden","media":false,"id":"mathe-9-44-e-k13"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"sich geeignete Informationen für Argumentationen beschaffen","media":false,"id":"mathe-9-44-e-k14"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"verschiedene Argumentationen und Begründungen erläutern und bewerten","media":false,"id":"mathe-9-44-e-k15"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"Lösungswege vergleichen und Problemlösestrategien reflektieren","media":false,"id":"mathe-9-44-e-k16"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"heuristische Strategien anwenden: Vorwärts- und Rückwärtsarbeiten, Zurückführen auf Bekanntes, Spezialisieren und Verallgemeinern, Variieren von Bedingungen","media":false,"id":"mathe-9-44-e-k17"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"Parametervariationen unter Verwendung von digitalen Mathematikwerkzeugen nutzen und ein geeignetes Werkzeug zum Berechnen nutzen","media":true,"id":"mathe-9-44-e-k18"}]},{"id":"mathe-9-46-g","subject":"mathematik","grades":[9],"title":"Lineare Funktionen","shortTitle":"Lineare Funktionen","level":"G","aliases":["Lineare Funktionen","Tarife und Kosten im Vergleich"],"sourcePages":[46],"competencies":[{"category":"Inhaltlicher Kern","text":"In Sachsituationen und in Graphen lineare Zusammenhänge identifizieren","media":false,"id":"mathe-9-46-g-k01"},{"category":"Inhaltlicher Kern","text":"die Steigungen von Graphen linearer Funktionen als konstante Änderungsrate interpretieren","media":false,"id":"mathe-9-46-g-k02"},{"category":"Inhaltlicher Kern","text":"die Schnittpunkte von Graphen linearer Funktionen mit den Achsen des Koordinatensystems zur Lösung von Sachsituationen nutzen","media":false,"id":"mathe-9-46-g-k03"},{"category":"Inhaltlicher Kern","text":"Schnittpunkte von Graphen linearer Funktionen in Sachsituationen deuten","media":false,"id":"mathe-9-46-g-k04"},{"category":"Inhaltlicher Kern","text":"Schnittpunkte von Graphen linearer Funktionen berechnen","media":false,"id":"mathe-9-46-g-k05"},{"category":"Inhaltlicher Kern","text":"Modellierungsaufgaben mithilfe der Schnittpunktbestimmung lösen","media":false,"id":"mathe-9-46-g-k06"},{"category":"Inhaltlicher Kern","text":"geometrische und algebraische Voraussetzungen untersuchen, unter denen Schnittpunkte von Graphen zweier linearer Funktionen vorliegen","media":false,"id":"mathe-9-46-g-k07"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"für die Modellierung relevante Informationen aus komplexen Sachsituationen entnehmen","media":false,"id":"mathe-9-46-g-k08"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"Terme, Gleichungen und Funktionen zur Ermittlung von Lösungen im mathematischen Modell verwenden","media":false,"id":"mathe-9-46-g-k09"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"sich geeignete Informationen für Argumentationen beschaffen","media":false,"id":"mathe-9-46-g-k10"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"Lösungswege vergleichen","media":false,"id":"mathe-9-46-g-k11"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"heuristische Strategien anwenden: Vorwärts- und Rückwärtsarbeiten, Zurückführen auf Bekanntes","media":false,"id":"mathe-9-46-g-k12"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"Parametervariationen unter Verwendung von digitalen Mathematikwerkzeugen nutzen und ein geeignetes Werkzeug zum Berechnen nutzen","media":true,"id":"mathe-9-46-g-k13"}]},{"id":"mathe-9-47-e","subject":"mathematik","grades":[9],"title":"Reelle Zahlen","shortTitle":"Reelle Zahlen","level":"E","aliases":["Reelle Zahlen","Wurzeln und Potenzen","Ganz groß – ganz klein"],"sourcePages":[47,48],"competencies":[{"category":"Inhaltlicher Kern","text":"Quadratwurzeln als Länge einer Quadratseite deuten","media":false,"id":"mathe-9-47-e-k01"},{"category":"Inhaltlicher Kern","text":"Kubikwurzeln als Länge einer Würfelkante deuten","media":false,"id":"mathe-9-47-e-k02"},{"category":"Inhaltlicher Kern","text":"Wurzelziehen als Umkehroperation zum Potenzieren bei Potenzen mit natürlichen Exponenten nutzen","media":false,"id":"mathe-9-47-e-k03"},{"category":"Inhaltlicher Kern","text":"in einfachen Fällen Wurzeln aus rationalen Zahlen im Kopf ziehen und Wurzeln berechnen","media":false,"id":"mathe-9-47-e-k04"},{"category":"Inhaltlicher Kern","text":"die Menge der reellen Zahlen kennen und rationale und irrationale Zahlen voneinander abgrenzen","media":false,"id":"mathe-9-47-e-k05"},{"category":"Inhaltlicher Kern","text":"exemplarisch ein Näherungsverfahren beschreiben und dieses zur Annäherung an eine irrationale Zahl anwenden","media":false,"id":"mathe-9-47-e-k06"},{"category":"Inhaltlicher Kern","text":"Potenzieren als Umkehrung des Wurzelziehens erfahren","media":false,"id":"mathe-9-47-e-k07"},{"category":"Inhaltlicher Kern","text":"die wissenschaftliche Schreibweise zur Darstellung von großen und kleinen Zahlen nutzen","media":false,"id":"mathe-9-47-e-k08"},{"category":"Inhaltlicher Kern","text":"mit reellen Zahlen auch in Sachsituationen rechnen","media":false,"id":"mathe-9-47-e-k09"},{"category":"Methodischer Kern · Mit symbolischen, formalen und technischen Elementen der Mathematik umgehen","text":"Lösungs- und Kontrollverfahren anwenden","media":false,"id":"mathe-9-47-e-k10"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Fragen stellen, die für die Mathematik charakteristisch sind und begründet Vermutungen äußern","media":false,"id":"mathe-9-47-e-k11"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Argumentationsketten aufbauen","media":false,"id":"mathe-9-47-e-k12"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"an geeigneten Beispielen und Veranschaulichungen die Plausibilität von Aussagen zeigen","media":false,"id":"mathe-9-47-e-k13"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Aussagen und Sätze umkehren und sie überprüfen","media":false,"id":"mathe-9-47-e-k14"},{"category":"Methodischer Kern · Kommunizieren","text":"ihre Überlegungen anderen verständlich mitteilen, wobei sie vornehmlich die Fachsprache benutzen","media":false,"id":"mathe-9-47-e-k15"},{"category":"Methodischer Kern · Kommunizieren","text":"Lösungswege und Überlegungen anderer vergleichen und diese auf Schlüssigkeit überprüfen","media":false,"id":"mathe-9-47-e-k16"},{"category":"Methodischer Kern · Kommunizieren","text":"die Arbeit im Team selbstständig organisieren und diese weiterentwickeln","media":false,"id":"mathe-9-47-e-k17"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"die eingeführte Technologie zur Lösung von Problemen nutzen","media":false,"id":"mathe-9-47-e-k18"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"geeignete heuristische Strategien auswählen und diese anwenden: Vorwärts- und Rückwärtsarbeiten, Zurückführen auf Bekanntes Mathematische Darstellungen verwenden","media":false,"id":"mathe-9-47-e-k19"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"Reelle Zahlen verwenden","media":false,"id":"mathe-9-47-e-k20"}]},{"id":"mathe-9-49-e","subject":"mathematik","grades":[9],"title":"Pythagoras","shortTitle":"Pythagoras","level":"E","aliases":["Pythagoras","Der Satz des Pythagoras"],"sourcePages":[49],"competencies":[{"category":"Inhaltlicher Kern","text":"den Satz des Pythagoras handelnd entdecken","media":false,"id":"mathe-9-49-e-k01"},{"category":"Inhaltlicher Kern","text":"den Satz des Pythagoras begründen und ihn bei Berechnungen anwenden","media":false,"id":"mathe-9-49-e-k02"},{"category":"Inhaltlicher Kern","text":"geometrische Beweise des Satzes des Pythagoras nachvollziehen","media":false,"id":"mathe-9-49-e-k03"},{"category":"Inhaltlicher Kern","text":"Streckenlängen mithilfe des Satzes des Pythagoras berechnen","media":false,"id":"mathe-9-49-e-k04"},{"category":"Methodischer Kern · Mit symbolischen, formalen und technischen Elementen der Mathematik umgehen","text":"Lösungs- und Kontrollverfahren anwenden und sie hinsichtlich ihrer Effizienz bewerten","media":false,"id":"mathe-9-49-e-k05"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Fragen stellen, die für die Mathematik charakteristisch sind und begründet Vermutungen äußern","media":false,"id":"mathe-9-49-e-k06"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Argumentationsketten aufbauen","media":false,"id":"mathe-9-49-e-k07"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"an geeigneten Beispielen und Veranschaulichungen die Plausibilität von Aussagen zeigen","media":false,"id":"mathe-9-49-e-k08"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Aussagen und Sätze umkehren und sie überprüfen","media":false,"id":"mathe-9-49-e-k09"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"verschiedene Argumentationen und Begründungen erläutern und bewerten","media":false,"id":"mathe-9-49-e-k10"},{"category":"Methodischer Kern · Kommunizieren","text":"ihre Überlegungen anderen verständlich mitteilen, wobei sie vornehmlich die Fachsprache benutzen.","media":false,"id":"mathe-9-49-e-k11"},{"category":"Methodischer Kern · Kommunizieren","text":"Lösungswege und Überlegungen anderer vergleichen und diese auf Schlüssigkeit überprüfen","media":false,"id":"mathe-9-49-e-k12"},{"category":"Methodischer Kern · Kommunizieren","text":"die Arbeit im Team selbstständig organisieren und diese weiterentwickeln","media":false,"id":"mathe-9-49-e-k13"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"die eingeführte Technologie zur Lösung von Problemen nutzen","media":false,"id":"mathe-9-49-e-k14"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"geeignete heuristische Strategien auswählen und diesen anwenden: Vorwärts- und Rückwärtsarbeiten, Zurückführen auf Bekanntes","media":false,"id":"mathe-9-49-e-k15"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"ihre Ergebnisse in Bezug auf die ursprüngliche Problemstellung beurteilen","media":false,"id":"mathe-9-49-e-k16"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"Lösungswege vergleichen und die Problemlösestrategien reflektieren","media":false,"id":"mathe-9-49-e-k17"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"die zu einer Problemlösung noch fehlenden Informationen beschaffen Mathematische Darstellungen verwenden","media":false,"id":"mathe-9-49-e-k18"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"Reelle Zahlen verwenden","media":false,"id":"mathe-9-49-e-k19"}]},{"id":"mathe-9-50-g","subject":"mathematik","grades":[9],"title":"Wurzeln und Pythagoras","shortTitle":"Wurzeln und Pythagoras","level":"G","aliases":["Wurzeln und Pythagoras","Der Satz des Pythagoras","Wurzeln und Potenzen"],"sourcePages":[50],"competencies":[{"category":"Inhaltlicher Kern","text":"Quadratwurzeln als Länge einer Strecke deuten","media":false,"id":"mathe-9-50-g-k01"},{"category":"Inhaltlicher Kern","text":"Wurzel ziehen als Umkehrung des Quadrierens","media":false,"id":"mathe-9-50-g-k02"},{"category":"Inhaltlicher Kern","text":"in einfachen Fällen Wurzeln aus rationalen Zahlen im Kopf ziehen und Wurzeln berechnen","media":false,"id":"mathe-9-50-g-k03"},{"category":"Inhaltlicher Kern","text":"den Satz des Pythagoras handelnd entdecken","media":false,"id":"mathe-9-50-g-k04"},{"category":"Inhaltlicher Kern","text":"einen geometrischen Beweis des Satzes des Pythagoras nachvollziehen","media":false,"id":"mathe-9-50-g-k05"},{"category":"Inhaltlicher Kern","text":"Streckenlängen mithilfe des Satzes des Pythagoras berechnen","media":false,"id":"mathe-9-50-g-k06"},{"category":"Inhaltlicher Kern","text":"mit reellen Zahlen auch in Sachsituationen rechnen","media":false,"id":"mathe-9-50-g-k07"},{"category":"Methodischer Kern · Mit symbolischen, formalen und technischen Elementen der Mathematik umgehen","text":"Lösungs- und Kontrollverfahren anwenden","media":false,"id":"mathe-9-50-g-k08"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Fragen stellen, die für die Mathematik charakteristisch sind und begründet Vermutungen äußern","media":false,"id":"mathe-9-50-g-k09"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Argumentationsketten aufbauen","media":false,"id":"mathe-9-50-g-k10"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"an geeigneten Beispielen und Veranschaulichungen die Plausibilität von Aussagen zeigen","media":false,"id":"mathe-9-50-g-k11"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Aussagen und Sätze umkehren","media":false,"id":"mathe-9-50-g-k12"},{"category":"Methodischer Kern · Kommunizieren","text":"ihre Überlegungen anderen verständlich mitteilen, wobei sie zunehmend die Fachsprache benutzen.","media":false,"id":"mathe-9-50-g-k13"},{"category":"Methodischer Kern · Kommunizieren","text":"Lösungswege und Überlegungen anderer vergleichen und diese auf Schlüssigkeit überprüfen","media":false,"id":"mathe-9-50-g-k14"},{"category":"Methodischer Kern · Kommunizieren","text":"die Arbeit im Team organisieren und diese weiterentwickeln","media":false,"id":"mathe-9-50-g-k15"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"die eingeführte Technologie zur Lösung von Problemen nutzen","media":false,"id":"mathe-9-50-g-k16"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"ihre Ergebnisse in Bezug auf die ursprüngliche Problemstellung beurteilen","media":false,"id":"mathe-9-50-g-k17"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"Lösungswege vergleichen","media":false,"id":"mathe-9-50-g-k18"}]},{"id":"mathe-9-51-e","subject":"mathematik","grades":[9],"title":"Kreis und Körper","shortTitle":"Kreis und Körper","level":"E","aliases":["Kreis und Körper","Rund um den Kreis"],"sourcePages":[51,52],"competencies":[{"category":"Inhaltlicher Kern","text":"experimentell die Kreiszahl 𝜋 entdecken","media":false,"id":"mathe-9-51-e-k01"},{"category":"Inhaltlicher Kern","text":"den Umfang eines Kreises schätzen und berechnen","media":false,"id":"mathe-9-51-e-k02"},{"category":"Inhaltlicher Kern","text":"handelnd den Flächeninhalt und Umfang eines Kreises näherungsweise bestimmen","media":false,"id":"mathe-9-51-e-k03"},{"category":"Inhaltlicher Kern","text":"den Flächeninhalt eines Kreises schätzen und berechnen","media":false,"id":"mathe-9-51-e-k04"},{"category":"Inhaltlicher Kern","text":"den Radius eines Kreises aus dem Flächeninhalt berechnen","media":false,"id":"mathe-9-51-e-k05"},{"category":"Inhaltlicher Kern","text":"Umfang und Flächeninhalt von aus Kreisen zusammengesetzten Figuren schätzen und berechnen","media":false,"id":"mathe-9-51-e-k06"},{"category":"Inhaltlicher Kern","text":"Zylindernetze untersuchen und zeichnen","media":false,"id":"mathe-9-51-e-k07"},{"category":"Inhaltlicher Kern","text":"den Oberflächeninhalt und das Volumen eines Zylinders schätzen und berechnen","media":false,"id":"mathe-9-51-e-k08"},{"category":"Inhaltlicher Kern","text":"exemplarisch ein Näherungsverfahren für die irrationale Zahl 𝜋 beschreiben und dieses anwenden","media":false,"id":"mathe-9-51-e-k09"},{"category":"Inhaltlicher Kern","text":"Optional: Oberflächeninhalt und Volumen einer Kugel schätzen und berechnen","media":false,"id":"mathe-9-51-e-k10"},{"category":"Inhaltlicher Kern","text":"Optional: den Kugelradius aus dem Kugelvolumen berechnen","media":false,"id":"mathe-9-51-e-k11"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"für die Modellierung relevante Informationen aus komplexen, nicht vertrauten Situationen entnehmen","media":false,"id":"mathe-9-51-e-k12"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"Modelle zur Beschreibung überschaubarer Sachsituationen wählen und ihre Wahl begründen","media":false,"id":"mathe-9-51-e-k13"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"Terme, Gleichungen und Funktionen zur Ermittlung von Lösungen im mathematischen Modell verwenden","media":false,"id":"mathe-9-51-e-k14"},{"category":"Methodischer Kern · Mit symbolischen, formalen und technischen Elementen der Mathematik umgehen","text":"Lösungs- und Kontrollverfahren anwenden","media":false,"id":"mathe-9-51-e-k15"},{"category":"Methodischer Kern · Mit symbolischen, formalen und technischen Elementen der Mathematik umgehen","text":"Formelsammlungen nutzen","media":false,"id":"mathe-9-51-e-k16"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Fragen stellen, die für die Mathematik charakteristisch sind, und begründet Vermutungen auch unter Verwendung geeigneter Medien äußern","media":true,"id":"mathe-9-51-e-k17"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"sich geeignete Informationen für Argumentationen beschaffen","media":false,"id":"mathe-9-51-e-k18"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Argumentationsketten aufbauen und/oder diese analysieren","media":false,"id":"mathe-9-51-e-k19"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"verschiedene Argumentationen und Begründungen erläutern und bewerten","media":false,"id":"mathe-9-51-e-k20"}]},{"id":"mathe-9-53-g","subject":"mathematik","grades":[9],"title":"Kreis und Zylinder","shortTitle":"Kreis und Zylinder","level":"G","aliases":["Kreis und Zylinder","Rund um den Kreis"],"sourcePages":[53,54],"competencies":[{"category":"Inhaltlicher Kern","text":"experimentell die Kreiszahl 𝜋 entdecken","media":false,"id":"mathe-9-53-g-k01"},{"category":"Inhaltlicher Kern","text":"den Umfang eines Kreises schätzen und berechnen","media":false,"id":"mathe-9-53-g-k02"},{"category":"Inhaltlicher Kern","text":"handelnd den Flächeninhalt eines Kreises näherungsweise bestimmen","media":false,"id":"mathe-9-53-g-k03"},{"category":"Inhaltlicher Kern","text":"den Flächeninhalt eines Kreises schätzen und berechnen","media":false,"id":"mathe-9-53-g-k04"},{"category":"Inhaltlicher Kern","text":"den Radius eines Kreises aus dem Flächeninhalt berechnen","media":false,"id":"mathe-9-53-g-k05"},{"category":"Inhaltlicher Kern","text":"Umfang und Flächeninhalt von aus Kreisen zusammengesetzten Figuren schätzen und berechnen","media":false,"id":"mathe-9-53-g-k06"},{"category":"Inhaltlicher Kern","text":"Zylindernetze erkennen","media":false,"id":"mathe-9-53-g-k07"},{"category":"Inhaltlicher Kern","text":"den Oberflächeninhalt und das Volumen eines Zylinders schätzen und berechnen","media":false,"id":"mathe-9-53-g-k08"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"für die Modellierung relevante Informationen aus komplexen Situationen entnehmen","media":false,"id":"mathe-9-53-g-k09"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"Modelle zur Beschreibung überschaubarer Sachsituationen wählen","media":false,"id":"mathe-9-53-g-k10"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"Terme, Gleichungen und Funktionen zur Ermittlung von Lösungen im mathematischen Modell verwenden","media":false,"id":"mathe-9-53-g-k11"},{"category":"Methodischer Kern · Mit symbolischen, formalen und technischen Elementen der Mathematik umgehen","text":"Lösungs- und Kontrollverfahren anwenden","media":false,"id":"mathe-9-53-g-k12"},{"category":"Methodischer Kern · Mit symbolischen, formalen und technischen Elementen der Mathematik umgehen","text":"Formelsammlungen nutzen","media":false,"id":"mathe-9-53-g-k13"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Fragen stellen, die für die Mathematik charakteristisch sind, und begründet Vermutungen","media":false,"id":"mathe-9-53-g-k14"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"sich geeignete Informationen für Argumentationen beschaffen","media":false,"id":"mathe-9-53-g-k15"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Argumentationsketten aufbauen und/oder diese analysieren","media":false,"id":"mathe-9-53-g-k16"},{"category":"Methodischer Kern · Kommunizieren","text":"ihre Überlegungen anderen verständlich mitteilen, wobei sie vornehmlich die Fachsprache benutzen","media":false,"id":"mathe-9-53-g-k17"},{"category":"Methodischer Kern · Kommunizieren","text":"Lösungswege und Überlegungen anderer vergleichen und diese auf Schlüssigkeit","media":false,"id":"mathe-9-53-g-k18"},{"category":"Methodischer Kern · Kommunizieren","text":"die Arbeit im Team beurteilen und bewerten und diese weiterentwickeln","media":false,"id":"mathe-9-53-g-k19"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"die eingeführte Technologie zur Lösung von Problemen nutzen","media":false,"id":"mathe-9-53-g-k20"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"heuristische Strategien anwenden: Vorwärts- und Rückwärtsarbeiten, Zurückführen auf Bekanntes","media":false,"id":"mathe-9-53-g-k21"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"Lösungswege vergleichen","media":false,"id":"mathe-9-53-g-k22"}]},{"id":"mathe-9-55-e","subject":"mathematik","grades":[9,10],"title":"Quadratische Funktionen","shortTitle":"Quadratische Funktionen","level":"E","aliases":["Quadratische Funktionen","Parabeln"],"sourcePages":[55,56],"competencies":[{"category":"Inhaltlicher Kern","text":"Parabeln in der Umwelt identifizieren","media":false,"id":"mathe-9-55-e-k01"},{"category":"Inhaltlicher Kern","text":"Graphen quadratischer Funktionen in Sachsituationen deuten","media":false,"id":"mathe-9-55-e-k02"},{"category":"Inhaltlicher Kern","text":"quadratische Funktionen in Graphen, Tabellen und Termen und Sachsituationen darstellen und zwischen Darstellungsformen wechseln","media":false,"id":"mathe-9-55-e-k03"},{"category":"Inhaltlicher Kern","text":"bei quadratischen Funktionen der Form 𝑓(𝑥) = 𝑎 (𝑥 − 𝑑)2 + 𝑒 Parametervariationen durchführen und die Auswirkungen auf die Graphen beschreiben","media":false,"id":"mathe-9-55-e-k04"},{"category":"Inhaltlicher Kern","text":"verschiedene Darstellungsformen des Terms einer quadratischen Funktion vergleichen","media":false,"id":"mathe-9-55-e-k05"},{"category":"Inhaltlicher Kern","text":"Graphen quadratischer Funktionen beschreiben und dabei auf Symmetrien, Verlauf und besondere Punkte eingehen","media":false,"id":"mathe-9-55-e-k06"},{"category":"Inhaltlicher Kern","text":"den Zusammenhang zwischen möglichen Nullstellen und dem Scheitelpunkt der Graphen quadratischer Funktionen beschreiben","media":false,"id":"mathe-9-55-e-k07"},{"category":"Inhaltlicher Kern","text":"digitale Mathematikwerkzeuge zur Lösung von Problemen einsetzen","media":true,"id":"mathe-9-55-e-k08"},{"category":"Inhaltlicher Kern","text":"Sachsituationen durch quadratische Funktionen modellieren, auch durch Regressionen mithilfe digitaler Mathematikwerkzeuge","media":true,"id":"mathe-9-55-e-k09"},{"category":"Inhaltlicher Kern","text":"die Scheitelpunktform und die allgemeine Form vergleichen und ineinander überführen","media":false,"id":"mathe-9-55-e-k10"},{"category":"Inhaltlicher Kern","text":"Nullstellen am Graphen identifizieren und diese in Sachsituationen deuten","media":false,"id":"mathe-9-55-e-k11"},{"category":"Inhaltlicher Kern","text":"Nullstellen quadratischer Funktionen auch in Sachsituationen berechnen","media":false,"id":"mathe-9-55-e-k12"},{"category":"Inhaltlicher Kern","text":"quadratische Gleichungen der Form 𝑎 𝑥² + 𝑏 𝑥 + 𝑐 = 0 in einfachen Fällen hilfsmittelfrei graphisch und algebraisch lösen","media":false,"id":"mathe-9-55-e-k13"},{"category":"Inhaltlicher Kern","text":"quadratische Gleichungen der Form 𝑎 𝑥² + 𝑏 𝑥 + 𝑐 = 0 und a (x – d)2 + e = 0 graphisch unter Verwendung digitaler Mathematikwerkzeuge bzw. algebraisch unter Verwendung eines CAS lösen","media":true,"id":"mathe-9-55-e-k14"},{"category":"Inhaltlicher Kern","text":"mit quadratischen Funktionen Sachsituationen modellieren und Probleme lösen auch unter Verwendung digitaler Mathematikwerkzeuge","media":true,"id":"mathe-9-55-e-k15"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"Terme, Gleichungen, Funktionen zur Ermittlung von Lösungen im mathematischen Modell verwenden Mathematische Darstellungen verwenden","media":false,"id":"mathe-9-55-e-k16"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"Darstellungen adressatengerecht und sachangemessen auswählen","media":false,"id":"mathe-9-55-e-k17"},{"category":"Methodischer Kern · Mit symbolischen, formalen und technischen Elementen der Mathematik umgehen","text":"einfache quadratische Gleichungen aufstellen und sie lösen","media":false,"id":"mathe-9-55-e-k18"},{"category":"Methodischer Kern · Mit symbolischen, formalen und technischen Elementen der Mathematik umgehen","text":"Sachzusammenhänge durch Funktionen darstellen","media":false,"id":"mathe-9-55-e-k19"},{"category":"Methodischer Kern · Mit symbolischen, formalen und technischen Elementen der Mathematik umgehen","text":"Tabellen, Graphen, Terme und Gleichungen zur Bearbeitung quadratischer Zusammenhänge nutzen","media":false,"id":"mathe-9-55-e-k20"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Fragen stellen, die für die Mathematik charakteristisch sind und begründet Vermutungen äußern","media":false,"id":"mathe-9-55-e-k21"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"verschiedene Argumentationen und Begründungen erläutern und bewerten","media":false,"id":"mathe-9-55-e-k22"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"an geeigneten Beispielen und Veranschaulichungen die Plausibilität von Aussagen zeigen","media":false,"id":"mathe-9-55-e-k23"},{"category":"Methodischer Kern · Kommunizieren","text":"Ihre Überlegungen anderen verständlichen mitteilen, wobei sie vornehmlich die Fachsprache benutzen","media":false,"id":"mathe-9-55-e-k24"},{"category":"Methodischer Kern · Kommunizieren","text":"Lösungswege und Überlegungen anderer vergleichen und diese auf Schlüssigkeit überprüfen","media":false,"id":"mathe-9-55-e-k25"},{"category":"Methodischer Kern · Kommunizieren","text":"die Arbeit ihm Team selbstständig organisieren und diese weiterentwickeln","media":false,"id":"mathe-9-55-e-k26"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"die eingeführte Technologie zur Lösung von Problemen nutzen","media":false,"id":"mathe-9-55-e-k27"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"geeignete heuristische Strategien auswählen und diese anwenden","media":false,"id":"mathe-9-55-e-k28"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"ihre Ergebnisse in Bezug auf die ursprüngliche Problemstellung beurteilen","media":false,"id":"mathe-9-55-e-k29"}]},{"id":"mathe-9-57-g","subject":"mathematik","grades":[9,10],"title":"Quadratische Funktionen","shortTitle":"Quadratische Funktionen","level":"G","aliases":["Quadratische Funktionen","Parabeln"],"sourcePages":[57],"competencies":[{"category":"Inhaltlicher Kern","text":"Parabeln in der Umwelt identifizieren","media":false,"id":"mathe-9-57-g-k01"},{"category":"Inhaltlicher Kern","text":"Graphen quadratischer Funktionen in Sachsituationen deuten","media":false,"id":"mathe-9-57-g-k02"},{"category":"Inhaltlicher Kern","text":"quadratische Funktionen in Graphen, Tabellen und Termen und Sachsituationen darstellen und zwischen Darstellungsformen wechseln","media":false,"id":"mathe-9-57-g-k03"},{"category":"Inhaltlicher Kern","text":"bei quadratischen Funktionen der Form 𝑓(𝑥) = 𝑎 𝑥2 + 𝑐 die Auswirkungen der Parameter auf die Graphen beschreiben","media":false,"id":"mathe-9-57-g-k04"},{"category":"Inhaltlicher Kern","text":"Graphen quadratischer Funktionen beschreiben und dabei auf Symmetrien, Verlauf und besondere Punkte eingehen","media":false,"id":"mathe-9-57-g-k05"},{"category":"Inhaltlicher Kern","text":"Nullstellen am Graphen identifizieren und in Sachsituationen deuten","media":false,"id":"mathe-9-57-g-k06"},{"category":"Inhaltlicher Kern","text":"quadratische Gleichungen der Form 𝑎 𝑥2 + 𝑐 = 0 graphisch und algebraisch lösen","media":false,"id":"mathe-9-57-g-k07"},{"category":"Inhaltlicher Kern","text":"mit quadratischen Funktionen Sachsituationen modellieren und Probleme lösen","media":false,"id":"mathe-9-57-g-k08"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"Terme, Gleichungen, Funktionen zur Ermittlung von Lösungen im mathematischen Modell verwenden Mathematische Darstellungen verwenden","media":false,"id":"mathe-9-57-g-k09"},{"category":"Methodischer Kern · Mathematisch modellieren","text":"Darstellungen adressatengerecht und sachangemessen auswählen","media":false,"id":"mathe-9-57-g-k10"},{"category":"Methodischer Kern · Mit symbolischen, formalen und technischen Elementen der Mathematik umgehen","text":"einfache quadratische Gleichungen aufstellen und sie lösen","media":false,"id":"mathe-9-57-g-k11"},{"category":"Methodischer Kern · Mit symbolischen, formalen und technischen Elementen der Mathematik umgehen","text":"Sachzusammenhänge durch Funktionen darstellen","media":false,"id":"mathe-9-57-g-k12"},{"category":"Methodischer Kern · Mit symbolischen, formalen und technischen Elementen der Mathematik umgehen","text":"Tabellen, Graphen, Terme und Gleichungen zur Bearbeitung quadratischer Zusammenhänge nutzen","media":false,"id":"mathe-9-57-g-k13"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"Fragen stellen, die für die Mathematik charakteristisch sind und begründet Vermutungen äußern","media":false,"id":"mathe-9-57-g-k14"},{"category":"Methodischer Kern · Mathematisch argumentieren","text":"an geeigneten Beispielen und Veranschaulichungen die Plausibilität von Aussagen zeigen","media":false,"id":"mathe-9-57-g-k15"},{"category":"Methodischer Kern · Kommunizieren","text":"Lösungswege und Überlegungen anderer vergleichen und diese auf Schlüssigkeit überprüfen","media":false,"id":"mathe-9-57-g-k16"},{"category":"Methodischer Kern · Kommunizieren","text":"die Arbeit ihm Team organisieren und diese weiterentwickeln","media":false,"id":"mathe-9-57-g-k17"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"die eingeführte Technologie zur Lösung von Problemen nutzen","media":false,"id":"mathe-9-57-g-k18"},{"category":"Methodischer Kern · Probleme mathematisch lösen","text":"ihre Ergebnisse in Bezug auf die ursprüngliche Problemstellung beurteilen","media":false,"id":"mathe-9-57-g-k19"}]},{"id":"mathe-10-59-e","subject":"mathematik","grades":[10],"title":"Quadratische Funktionen","shortTitle":"Quadratische Funktionen","level":"E","aliases":["Quadratische Funktionen","Parabeln"],"sourcePages":[59],"competencies":[{"category":"Kern","text":"Parabeln in der Umwelt identifizieren","media":false,"id":"mathe-10-59-e-k01"},{"category":"Kern","text":"Graphen quadratischer Funktionen in Sachsituationen deuten","media":false,"id":"mathe-10-59-e-k02"},{"category":"Kern","text":"quadratische Funktionen in Graphen, Tabellen und Termen und Sachsituationen darstellen und zwischen Darstellungsformen wechseln","media":false,"id":"mathe-10-59-e-k03"},{"category":"Kern","text":"bei quadratischen Funktionen der Form 𝑓(𝑥) = 𝑎 (𝑥 − 𝑑)2 + 𝑒 Parametervariationen durchführen und die Auswirkungen auf die Graphen beschreiben","media":false,"id":"mathe-10-59-e-k04"},{"category":"Kern","text":"verschiedene Darstellungsformen des Terms einer quadratischen Funktion vergleichen","media":false,"id":"mathe-10-59-e-k05"},{"category":"Kern","text":"Graphen quadratischer Funktionen beschreiben und dabei auf Symmetrien, Verlauf und besondere Punkte eingehen","media":false,"id":"mathe-10-59-e-k06"},{"category":"Kern","text":"den Zusammenhang zwischen möglichen Nullstellen und dem Scheitelpunkt der Graphen quadratischer Funktionen beschreiben","media":false,"id":"mathe-10-59-e-k07"},{"category":"Kern","text":"digitale Mathematikwerkzeuge zur Lösung von Problemen einsetzen","media":true,"id":"mathe-10-59-e-k08"},{"category":"Kern","text":"Sachsituationen durch quadratische Funktionen modellieren, auch durch Regressionen mithilfe digitaler Mathematikwerkzeuge","media":true,"id":"mathe-10-59-e-k09"},{"category":"Kern","text":"die Scheitelpunktform und die allgemeine Form vergleichen und ineinander überführen","media":false,"id":"mathe-10-59-e-k10"},{"category":"Kern","text":"Nullstellen am Graphen identifizieren und diese in Sachsituationen deuten","media":false,"id":"mathe-10-59-e-k11"},{"category":"Kern","text":"Nullstellen quadratischer Funktionen auch in Sachsituationen berechnen","media":false,"id":"mathe-10-59-e-k12"},{"category":"Kern","text":"quadratische Gleichungen der Form 𝑎 𝑥² + 𝑏 𝑥 + 𝑐 = 0 in einfachen Fällen hilfsmittelfrei graphisch und algebraisch lösen","media":false,"id":"mathe-10-59-e-k13"},{"category":"Kern","text":"mit quadratischen Funktionen Sachsituationen modellieren und Probleme lösen auch unter Verwendung digitaler Mathematikwerkzeuge","media":true,"id":"mathe-10-59-e-k14"},{"category":"GTR-Kompetenzen","text":"Wertetabelle anzeigen lassen","media":true,"id":"mathe-10-59-e-k15"},{"category":"GTR-Kompetenzen","text":"Schieberegler zur Visualisierung","media":true,"id":"mathe-10-59-e-k16"},{"category":"GTR-Kompetenzen","text":"Besondere Punkte anzeigen lassen","media":true,"id":"mathe-10-59-e-k17"},{"category":"GTR-Kompetenzen","text":"Regression zu Werten","media":true,"id":"mathe-10-59-e-k18"},{"category":"GTR-Kompetenzen","text":"Nullstellen identifizieren","media":true,"id":"mathe-10-59-e-k19"},{"category":"GTR-Kompetenzen","text":" siehe Kern, ggf. auch hier mit Regression","media":true,"id":"mathe-10-59-e-k20"}]},{"id":"mathe-10-60-g","subject":"mathematik","grades":[10],"title":"Quadratische Funktionen","shortTitle":"Quadratische Funktionen","level":"G","aliases":["Quadratische Funktionen","Parabeln"],"sourcePages":[60],"competencies":[{"category":"Kern","text":"Parabeln in der Umwelt identifizieren","media":false,"id":"mathe-10-60-g-k01"},{"category":"Kern","text":"Graphen quadratischer Funktionen in Sachsituationen deuten","media":false,"id":"mathe-10-60-g-k02"},{"category":"Kern","text":"quadratische Funktionen in Graphen, Tabellen und Termen und Sachsituationen darstellen und zwischen Darstellungsformen wechseln","media":false,"id":"mathe-10-60-g-k03"},{"category":"Kern","text":"bei quadratischen Funktionen der Form 𝑓(𝑥) = 𝑎 𝑥2 + 𝑐 die Auswirkungen der Parameter auf die Graphen beschreiben","media":false,"id":"mathe-10-60-g-k04"},{"category":"Kern","text":"Graphen quadratischer Funktionen beschreiben und dabei auf Symmetrien, Verlauf und besondere Punkte eingehen","media":false,"id":"mathe-10-60-g-k05"},{"category":"Kern","text":"Nullstellen am Graphen identifizieren und in Sachsituationen deuten","media":false,"id":"mathe-10-60-g-k06"},{"category":"Kern","text":"quadratische Gleichungen der Form 𝑎 𝑥2 + 𝑐 = 0 graphisch und algebraisch lösen","media":false,"id":"mathe-10-60-g-k07"},{"category":"Kern","text":"mit quadratischen Funktionen Sachsituationen modellieren und Probleme lösen","media":false,"id":"mathe-10-60-g-k08"},{"category":"GTR-Kompetenzen","text":"Wertetabelle anzeigen lassen","media":true,"id":"mathe-10-60-g-k09"},{"category":"GTR-Kompetenzen","text":"Schieberegler zur Visualisierung","media":true,"id":"mathe-10-60-g-k10"},{"category":"GTR-Kompetenzen","text":"Nullstellen identifizieren","media":true,"id":"mathe-10-60-g-k11"}]},{"id":"mathe-10-61-e","subject":"mathematik","grades":[10],"title":"Körper","shortTitle":"Körper","level":"E","aliases":["Körper"],"sourcePages":[61],"competencies":[{"category":"Kern","text":"Eigenschaften von Körpern erkennen und benennen","media":false,"id":"mathe-10-61-e-k01"},{"category":"Kern","text":"Körpernetze von Pyramiden und Kegeln auch maßstabgerecht zeichnen und deuten","media":false,"id":"mathe-10-61-e-k02"},{"category":"Kern","text":"Modelle von Pyramiden und Kegeln herstellen","media":false,"id":"mathe-10-61-e-k03"},{"category":"Kern","text":"Schrägbilder von geraden Pyramiden auch maßstabgerecht zeichnen und deuten","media":false,"id":"mathe-10-61-e-k04"},{"category":"Kern","text":"Oberflächeninhalt und Volumen von Pyramiden und Kegeln schätzen und berechnen","media":false,"id":"mathe-10-61-e-k05"},{"category":"Kern","text":"Oberflächeninhalt und Volumen zusammengesetzter Körper berechnen","media":false,"id":"mathe-10-61-e-k06"},{"category":"Kern","text":"Oberflächeninhalt und Volumen einer Kugel schätzen und berechnen","media":false,"id":"mathe-10-61-e-k07"},{"category":"Kern","text":"den Kugelradius aus dem Kugelvolumen berechnen","media":false,"id":"mathe-10-61-e-k08"},{"category":"Kern","text":"Formelsammlungen nutzen","media":false,"id":"mathe-10-61-e-k09"},{"category":"Kern","text":"Modelle zur Beschreibung überschaubarer Sachsituationen wählen und ihre Wahl begründen","media":false,"id":"mathe-10-61-e-k10"}]},{"id":"mathe-10-62-g","subject":"mathematik","grades":[10],"title":"Körper","shortTitle":"Körper","level":"G","aliases":["Körper"],"sourcePages":[62],"competencies":[{"category":"Kern","text":"Eigenschaften von Körpern erkennen und benennen","media":false,"id":"mathe-10-62-g-k01"},{"category":"Kern","text":"Körpernetze von Pyramiden auch maßstabgerecht zeichnen und deuten","media":false,"id":"mathe-10-62-g-k02"},{"category":"Kern","text":"Modelle von Pyramiden herstellen","media":false,"id":"mathe-10-62-g-k03"},{"category":"Kern","text":"Schrägbilder von geraden Pyramiden auch maßstabgerecht zeichnen und deuten","media":false,"id":"mathe-10-62-g-k04"},{"category":"Kern","text":"vorgegebene Kegelnetze untersuchen und daraus Kegelmodelle herstellen","media":false,"id":"mathe-10-62-g-k05"},{"category":"Kern","text":"Oberflächeninhalt und Volumen von Pyramiden und Kegeln schätzen und berechnen","media":false,"id":"mathe-10-62-g-k06"},{"category":"Kern","text":"Oberflächeninhalt und Volumen zusammengesetzter Körper berechnen","media":false,"id":"mathe-10-62-g-k07"},{"category":"Kern","text":"Oberflächeninhalt und Volumen einer Kugel schätzen und berechnen","media":false,"id":"mathe-10-62-g-k08"},{"category":"Kern","text":"den Kugelradius aus dem Kugelvolumen berechnen","media":false,"id":"mathe-10-62-g-k09"},{"category":"Kern","text":"Formelsammlungen nutzen","media":false,"id":"mathe-10-62-g-k10"},{"category":"Kern","text":"Modelle zur Beschreibung überschaubarer Sachsituationen wählen","media":false,"id":"mathe-10-62-g-k11"}]},{"id":"mathe-10-63-e","subject":"mathematik","grades":[10],"title":"Statistik","shortTitle":"Statistik","level":"E","aliases":["Statistik"],"sourcePages":[63],"competencies":[{"category":"Kern","text":"mehrstufige Zufallsexperimente durchführen und im Baumdiagramm darstellen","media":false,"id":"mathe-10-63-e-k01"},{"category":"Kern","text":"Wahrscheinlichkeiten in Zufallsexperimenten berechnen","media":false,"id":"mathe-10-63-e-k02"},{"category":"Kern","text":"Informationen aus statistischen Untersuchungen entnehmen","media":false,"id":"mathe-10-63-e-k03"},{"category":"Kern","text":"Daten in Vierfeldertafeln und Baumdiagrammen darstellen","media":false,"id":"mathe-10-63-e-k04"},{"category":"Kern","text":"statistische Aussagen mithilfe der Vierfeldertafel oder des Rückwärtsschließens im Baumdiagramm hinterfragen","media":false,"id":"mathe-10-63-e-k05"},{"category":"Kern","text":"Informationen aus Texten analysieren und bewerten","media":false,"id":"mathe-10-63-e-k06"}]},{"id":"mathe-10-64-g","subject":"mathematik","grades":[10],"title":"Zweistufige Zufallsexperimente","shortTitle":"Zweistufige Zufallsexperimente","level":"G","aliases":["Zweistufige Zufallsexperimente","Chancen und Strategien"],"sourcePages":[64],"competencies":[{"category":"Kern","text":"Laplace-Experimente durchführen und Wahrscheinlichkeiten bestimmen","media":false,"id":"mathe-10-64-g-k01"},{"category":"Kern","text":"zweistufige Zufallsexperimente mit und ohne Zurücklegen durchführen","media":false,"id":"mathe-10-64-g-k02"},{"category":"Kern","text":"Ergebnisse von Zufallsexperimenten interpretieren","media":false,"id":"mathe-10-64-g-k03"},{"category":"Kern","text":"Wahrscheinlichkeiten zur Prognose für absolute Häufigkeiten von Ergebnissen nutzen","media":false,"id":"mathe-10-64-g-k04"},{"category":"Kern","text":"Baumdiagramme als Möglichkeit der Darstellung nutzen und anfertigen","media":false,"id":"mathe-10-64-g-k05"},{"category":"Kern","text":"Wahrscheinlichkeiten mithilfe der Pfad- und Summenregel berechnen","media":false,"id":"mathe-10-64-g-k06"}]},{"id":"mathe-10-65-e","subject":"mathematik","grades":[10],"title":"Trigonometrie","shortTitle":"Trigonometrie","level":"E","aliases":["Trigonometrie","Messen im Gelände"],"sourcePages":[65,66],"competencies":[{"category":"Kern","text":"Seitenverhältnisse in rechtwinkligen Dreiecken untersuchen","media":false,"id":"mathe-10-65-e-k01"},{"category":"Kern","text":"Sinus, Kosinus und Tangens eines Winkels deuten und berechnen","media":false,"id":"mathe-10-65-e-k02"},{"category":"Kern","text":"Streckenlängen und Winkelgrößen in rechtwinkligen Dreiecken mithilfe von Sinus, Kosinus und Tangens berechnen","media":false,"id":"mathe-10-65-e-k03"},{"category":"Kern","text":"Streckenlängen und Winkelgrößen in allgemeinen Dreiecken mithilfe des Sinus- und des Kosinussatzes berechnen","media":false,"id":"mathe-10-65-e-k04"},{"category":"Kern","text":"Messungen in der Umwelt planen und diese gezielt durchführen","media":false,"id":"mathe-10-65-e-k05"},{"category":"Kern","text":"Seitenverhältnisse in rechtwinkligen Dreiecken untersuchen","media":false,"id":"mathe-10-65-e-k06"},{"category":"Kern","text":"Sinus, Kosinus und Tangens eines Winkels deuten und berechnen","media":false,"id":"mathe-10-65-e-k07"},{"category":"Kern","text":"Streckenlängen und Winkelgrößen in rechtwinkligen Dreiecken mithilfe von Sinus, Kosinus und Tangens berechnen","media":false,"id":"mathe-10-65-e-k08"},{"category":"Kern","text":"Messungen in ihrer Umwelt planen und diese gezielt durchführen","media":false,"id":"mathe-10-65-e-k09"}]},{"id":"mathe-10-67-e","subject":"mathematik","grades":[10],"title":"Exponentialfunktionen","shortTitle":"Exponentialfunktionen","level":"E","aliases":["Exponentialfunktionen","Wachstum und Prognosen"],"sourcePages":[67],"competencies":[{"category":"Kern ( GTR-Kompetenzen siehe quadratische Funktionen)","text":"Sachsituationen mit Exponentialfunktionen beschreiben","media":true,"id":"mathe-10-67-e-k01"},{"category":"Kern ( GTR-Kompetenzen siehe quadratische Funktionen)","text":"Exponentialfunktionen in Graphen, Tabellen und Termen und Sachsituationen darstellen und zwischen Darstellungsformen wechseln","media":true,"id":"mathe-10-67-e-k02"},{"category":"Kern ( GTR-Kompetenzen siehe quadratische Funktionen)","text":"Wachstumsfaktor und Wachstumsrate in Sachsituationen bestimmen und ineinander überführen","media":true,"id":"mathe-10-67-e-k03"},{"category":"Kern ( GTR-Kompetenzen siehe quadratische Funktionen)","text":"den Wachstumsfaktor als konstante prozentuale Änderung deuten und gegenüber linearem Wachstum abgrenzen","media":true,"id":"mathe-10-67-e-k04"},{"category":"Kern ( GTR-Kompetenzen siehe quadratische Funktionen)","text":"Zinseszinsen berechnen","media":true,"id":"mathe-10-67-e-k05"},{"category":"Kern ( GTR-Kompetenzen siehe quadratische Funktionen)","text":"lineares und exponentielles Wachstum iterativ modellieren","media":true,"id":"mathe-10-67-e-k06"},{"category":"Kern ( GTR-Kompetenzen siehe quadratische Funktionen)","text":"bei Exponentialfunktion der Form 𝑓(𝑥) = 𝑐 ∙ 𝑎𝑥 die Auswirkungen der Parameter auf die Graphen beschreiben","media":true,"id":"mathe-10-67-e-k07"},{"category":"Kern ( GTR-Kompetenzen siehe quadratische Funktionen)","text":"digitale Mathematikwerkzeuge zum Zeichnen von Exponentialfunktionen nutzen und zur Lösung von Problemen einsetzen","media":true,"id":"mathe-10-67-e-k08"},{"category":"Kern ( GTR-Kompetenzen siehe quadratische Funktionen)","text":"Sachsituationen durch Wachstumsfunktionen modellieren, auch durch Regressionen mithilfe digitaler Mathematikwerkzeuge","media":true,"id":"mathe-10-67-e-k09"},{"category":"Kern ( GTR-Kompetenzen siehe quadratische Funktionen)","text":"Modellierungsmodelle für Wachstumsfunktionen (z. B. lineares und exponentielles) auswählen, begründen und bewerten","media":true,"id":"mathe-10-67-e-k10"},{"category":"Kern ( GTR-Kompetenzen siehe quadratische Funktionen)","text":"mit Exponentialfunktionen Sachsituationen modellieren und Probleme lösen auch unter Verwendung digitaler Mathematikwerkzeuge","media":true,"id":"mathe-10-67-e-k11"},{"category":"Kern ( GTR-Kompetenzen siehe quadratische Funktionen)","text":"(ggf. Gleichungen der Form 𝑐 ∙ 𝑎𝑥 = 𝑏 mithilfe eines CAS lösen)","media":true,"id":"mathe-10-67-e-k12"}]},{"id":"mathe-10-68-e","subject":"mathematik","grades":[10],"title":"Sinusfunktionen","shortTitle":"Sinusfunktionen","level":"E","aliases":["Sinusfunktionen"],"sourcePages":[68],"competencies":[{"category":"Kern","text":"periodische Vorgänge in der Umwelt entdecken und untersuchen","media":false,"id":"mathe-10-68-e-k01"},{"category":"Kern","text":"Winkel in Bogenmaß angeben","media":false,"id":"mathe-10-68-e-k02"},{"category":"Kern","text":"das Bogenmaß zum Zeichnen von Sinusfunktionen nutzen","media":false,"id":"mathe-10-68-e-k03"},{"category":"Kern","text":"periodische Vorgänge in Tabellen und Graphen darstellen und charakteristische Merkmale wie Frequenz, Amplitude, Periodendauer identifizieren","media":false,"id":"mathe-10-68-e-k04"},{"category":"Kern","text":"bei Sinusfunktionen der Form 𝑓(𝑥) = 𝑎 ∙ sin(𝑏(𝑥 + 𝑐)) + 𝑑 die Auswirkungen der Parameter auf die Graphen beschreiben","media":false,"id":"mathe-10-68-e-k05"},{"category":"Kern","text":"digitale Mathematikwerkzeuge zum Zeichnen von Sinusfunktionen nutzen und zur Lösung von Problemen einsetzen","media":true,"id":"mathe-10-68-e-k06"},{"category":"Kern","text":"Sinusfunktionen zur Modellierung von Sachsituationen und zur Lösung von Problemen nutzen auch unter Verwendung digitaler Mathematikwerkzeuge","media":true,"id":"mathe-10-68-e-k07"}]}],"methodCurriculum":[{"id":"methode-5-1","grade":5,"text":"Plakatgestaltung und -vorstellung (UE „Unsere Klasse“)","topicHints":["Unsere Klasse"],"media":false,"category":"Methodencurriculum"},{"id":"methode-5-2","grade":5,"text":"Diagramme lesen, erstellen, auswerten (UE „Unsere Klasse“)","topicHints":["Unsere Klasse"],"media":false,"category":"Methodencurriculum"},{"id":"methode-5-3","grade":5,"text":"Gruppenarbeit (UE „Unsere Klasse“)","topicHints":["Unsere Klasse"],"media":false,"category":"Methodencurriculum"},{"id":"methode-5-4","grade":5,"text":"Arbeiten mit dem Kompetenzraster (UE „Grundrechenarten“, „Rund um die Haustiere“, „Klassenkameraden besuchen“)","topicHints":["Grundrechenarten","Rund um die Haustiere","Klassenkameraden besuchen"],"media":false,"category":"Methodencurriculum"},{"id":"methode-5-5","grade":5,"text":"Umgang mit mathematischem Werkzeug – Lineal, Geodreieck, Klickies (UE „Unsere Klasse“, „Erlebniswelt Geometrie“, „Gut verpackt“)","topicHints":["Unsere Klasse","Erlebniswelt Geometrie","Gut verpackt"],"media":false,"category":"Methodencurriculum"},{"id":"methode-5-6","grade":5,"text":"Umgang mit mathematischen Computerprogrammen (UE „Erlebniswelt Geometrie“)","topicHints":["Erlebniswelt Geometrie"],"media":true,"category":"Methodencurriculum"},{"id":"methode-5-7","grade":5,"text":"Lernen an Stationen (UE „Rund um die Haustiere“)","topicHints":["Rund um die Haustiere"],"media":false,"category":"Methodencurriculum"},{"id":"methode-5-8","grade":5,"text":"Fahrpläne lesen (UE „Klassenkameraden besuchen“)","topicHints":["Klassenkameraden besuchen"],"media":false,"category":"Methodencurriculum"},{"id":"methode-6-1","grade":6,"text":"Mappe/ Album anlegen (UE „Wir teilen auf“, „Erlebniswelt Kreis und Symmetrie“)","topicHints":["Wir teilen auf","Erlebniswelt Kreis und Symmetrie"],"media":false,"category":"Methodencurriculum"},{"id":"methode-6-2","grade":6,"text":"Umgang mit mathematischem Werkzeug – Geobrett (UE „Wir teilen auf“, „Mit Karte und Kompass“, „Erlebniswelt Kreis und Symmetrie“)","topicHints":["Wir teilen auf","Mit Karte und Kompass","Erlebniswelt Kreis und Symmetrie"],"media":false,"category":"Methodencurriculum"},{"id":"methode-6-3","grade":6,"text":"Plakatgestaltung und -vorstellung (UE „Gewinnen und verlieren I“)","topicHints":["Gewinnen und verlieren I"],"media":false,"category":"Methodencurriculum"},{"id":"methode-6-4","grade":6,"text":"Arbeiten mit dem Kompetenzraster (UE „Gewinnen und verlieren II“, „Rund um den Sport“)","topicHints":["Gewinnen und verlieren II","Rund um den Sport"],"media":false,"category":"Methodencurriculum"},{"id":"methode-6-5","grade":6,"text":"Umgang mit mathematischem Werkzeug – Geodreieck, Zirkel (UE „Orientierung mit Karte und Kompass“, „Erlebniswelt Kreis und Symmetrie“)","topicHints":["Orientierung mit Karte und Kompass","Erlebniswelt Kreis und Symmetrie"],"media":false,"category":"Methodencurriculum"},{"id":"methode-6-6","grade":6,"text":"Umgang mit mathematischem Werkzeug Zometool, Klickies, Frames (UE „Gut verpackt“)","topicHints":["Gut verpackt"],"media":false,"category":"Methodencurriculum"},{"id":"methode-6-7","grade":6,"text":"Maßstabsgerechtes Zeichnen (UE „Wir wir wohnen“)","topicHints":["Wir wir wohnen"],"media":false,"category":"Methodencurriculum"},{"id":"methode-6-8","grade":6,"text":"Zeichnen in der Kabinettprojektion (UE „Wie wir wohnen“)","topicHints":["Wie wir wohnen"],"media":false,"category":"Methodencurriculum"},{"id":"methode-7-1","grade":7,"text":"Arbeiten mit dem Kompetenzraster (UE „Bruchrechnung“, „Ein Streifzug rund ums Dreieck“, „Unterwegs“)","topicHints":["Bruchrechnung","Ein Streifzug rund ums Dreieck","Unterwegs"],"media":false,"category":"Methodencurriculum"},{"id":"methode-7-2","grade":7,"text":"Umgang mit mathematischem Werkzeug – Geodreieck, Zirkel (UE „Ein Streifzug rund ums Dreieck“)","topicHints":["Ein Streifzug rund ums Dreieck"],"media":false,"category":"Methodencurriculum"},{"id":"methode-7-3","grade":7,"text":"Umgang mit mathematischem Werkzeug – Geobrett (UE „Überall Prozente“)","topicHints":["Überall Prozente"],"media":false,"category":"Methodencurriculum"},{"id":"methode-7-4","grade":7,"text":"Umgang mit mathematischen Computerprogrammen (UE „Ein Streifzug rund ums Dreieck“)","topicHints":["Ein Streifzug rund ums Dreieck"],"media":true,"category":"Methodencurriculum"},{"id":"methode-7-5","grade":7,"text":"Umgang mit einem wissenschaftlichen Taschenrechner","topicHints":[],"media":true,"category":"Methodencurriculum"},{"id":"methode-7-6","grade":7,"text":"Lernen an Stationen (UE „Plus und Minus“)","topicHints":["Plus und Minus"],"media":false,"category":"Methodencurriculum"},{"id":"methode-8-1","grade":8,"text":"Lernen an Stationen bzw. Lerntheke (UE „Glück und Zufall“)","topicHints":["Glück und Zufall"],"media":false,"category":"Methodencurriculum"},{"id":"methode-8-2","grade":8,"text":"Arbeiten mit dem Kompetenzraster (UE „Sparen - Zinsrechnung“ „Außergewöhnliche Wohnhäuser“)","topicHints":["Sparen - Zinsrechnung","Außergewöhnliche Wohnhäuser"],"media":false,"category":"Methodencurriculum"},{"id":"methode-8-3","grade":8,"text":"Umgang mit Computerprogrammen – Tabellenkalkulation (UE „Sparen - Zinsrechnung“)","topicHints":["Sparen - Zinsrechnung"],"media":true,"category":"Methodencurriculum"},{"id":"methode-8-4","grade":8,"text":"Modelle herstellen (UE „Außergewöhnliche Wohnhäuser“)","topicHints":["Außergewöhnliche Wohnhäuser"],"media":false,"category":"Methodencurriculum"},{"id":"methode-8-5","grade":8,"text":"Zeichnen in der Kabinettprojektion (UE „Außergewöhnliche Wohnhäuser“)","topicHints":["Außergewöhnliche Wohnhäuser"],"media":false,"category":"Methodencurriculum"},{"id":"methode-8-6","grade":8,"text":"Umgang mit mathematischem Werkzeug – Zometool, Klickies, Frames (UE „Außergewöhnliche Wohnhäuser“)","topicHints":["Außergewöhnliche Wohnhäuser"],"media":false,"category":"Methodencurriculum"},{"id":"methode-8-7","grade":8,"text":"Legen von Flächen mithilfe von Quadraten, Streifen und Kästchen (UE „Sprache der Mathematik II“)","topicHints":["Sprache der Mathematik II"],"media":false,"category":"Methodencurriculum"},{"id":"methode-8-8","grade":8,"text":"Terme und Gleichungen aufstellen und nach einem vorgegebenen Ablauf lösen (UE „Sprache der Mathematik II“)","topicHints":["Sprache der Mathematik II"],"media":false,"category":"Methodencurriculum"},{"id":"methode-8-9","grade":8,"text":"Umgang mit mathematischem Werkzeug: Geobrett (UE „Veränderungen“)","topicHints":["Veränderungen"],"media":false,"category":"Methodencurriculum"},{"id":"methode-9-1","grade":9,"text":"Maßstabsgerechtes Vergrößern und Verkleinern (UE „Konstruieren und Projizieren“)","topicHints":["Konstruieren und Projizieren"],"media":false,"category":"Methodencurriculum"},{"id":"methode-9-2","grade":9,"text":"Lineare Funktionen (Gleichungssysteme) aufstellen und nach einem vorgegebenen Ablauf lösen (UE „Tarife und Kosten im Vergleich)","topicHints":["Tarife und Kosten im Vergleich"],"media":false,"category":"Methodencurriculum"},{"id":"methode-9-3","grade":9,"text":"Arbeiten mit dem Kompetenzraster (UE „Wurzeln und Potenzen“, „Rund um den Kreis“, „Ganz groß – ganz klein“)","topicHints":["Wurzeln und Potenzen","Rund um den Kreis","Ganz groß – ganz klein"],"media":false,"category":"Methodencurriculum"},{"id":"methode-9-4","grade":9,"text":"Lerntempoduett (UE „Wurzeln und Potenzen“, „Ganz groß – ganz klein“)","topicHints":["Wurzeln und Potenzen","Ganz groß – ganz klein"],"media":false,"category":"Methodencurriculum"},{"id":"methode-9-5","grade":9,"text":"Poster erstellen und präsentieren (UE „Brücken und mehr“, „Mathematik im Beruf“)","topicHints":["Brücken und mehr","Mathematik im Beruf"],"media":false,"category":"Methodencurriculum"},{"id":"methode-9-6","grade":9,"text":"Tandemübung (UE „Der Satz des Pythagoras“, „Brücken und mehr“)","topicHints":["Der Satz des Pythagoras","Brücken und mehr"],"media":false,"category":"Methodencurriculum"},{"id":"methode-10-1","grade":10,"text":"Quadratische Funktionen (UE „Parabeln“)","topicHints":["Parabeln"],"media":false,"category":"Methodencurriculum"},{"id":"methode-10-2","grade":10,"text":"Messgeräte bauen und anwenden – Höhenwinkelmesser (UE „Messen im Gelände“)","topicHints":["Messen im Gelände"],"media":false,"category":"Methodencurriculum"},{"id":"methode-10-3","grade":10,"text":"Umgang mit einem wissenschaftlichen Taschenrechner, erweiterte Funktionen (UE „Messen im Gelände“, „Körper“)","topicHints":["Messen im Gelände","Körper"],"media":true,"category":"Methodencurriculum"},{"id":"methode-10-4","grade":10,"text":"Experimenten durchführen - Wahrscheinlichkeiten entdecken (UE „Chancen und Strategien“)","topicHints":["Chancen und Strategien"],"media":false,"category":"Methodencurriculum"},{"id":"methode-10-5","grade":10,"text":"Projektarbeit zusammengesetzte Körper (UE „Körper“, E-Kurs)","topicHints":["Körper“, E-Kurs"],"media":false,"category":"Methodencurriculum"},{"id":"methode-10-6","grade":10,"text":"Körpernetze anfertigen (UE „Körper“)","topicHints":["Körper"],"media":false,"category":"Methodencurriculum"},{"id":"methode-10-7","grade":10,"text":"ggf. Stationenlernen (UE „Körper“)","topicHints":["Körper"],"media":false,"category":"Methodencurriculum"},{"id":"methode-10-8","grade":10,"text":"(UE „Wachstum und Prognosen“)","topicHints":["Wachstum und Prognosen"],"media":false,"category":"Methodencurriculum"},{"id":"methode-10-9","grade":10,"text":"Mathematisches Lexikon mit Operatoren anlegen, mit der Formelsammlung umgehen, Lernplakate erstellen (Prüfungsvorbereitung)","topicHints":[],"media":false,"category":"Methodencurriculum"}]};

/* ===== V0.20.2 – Curriculare Kompetenzen als verbindliche Planungsebene =====
   - Schulcurricula Religion/Mathematik und Methodencurriculum Mathematik sind als
     strukturierte, statische Referenz eingebettet. Die Originaldateien bleiben außerhalb
     der GitHub-App; nur die extrahierten Kompetenztexte/Quellenangaben sind enthalten.
   - Reihen können explizit mit einem Curriculum-Thema verknüpft werden. Cross-Grade-
     Zuordnungen erfordern eine ausdrückliche Bestätigung und werden nie still geraten.
   - Soll-Stunden tragen konkrete Kompetenz-IDs. Reihen- und Stundenprompts erhalten nur
     die tatsächlich verknüpften Kompetenzen; Medien-/Methodenkompetenzen sind sichtbar.
   - Fortschritt unterscheidet: noch nicht eingeplant / eingeplant / bearbeitet / nur in
     ausgegrauter Stunde. Für Jg. 5–7 wird zusätzlich ein Nachweisstatus geführt.
*/
const V202_VERSION='V0.20.2';
let v202Browser={subject:'religion',grade:5};

function v202SubjectKey(course){
  const s=catalogNormV17(course?.subject||'');
  if(s.includes('relig'))return 'religion';
  if(s.includes('mathe'))return 'mathematik';
  return '';
}
function v202Grade(course){
  const text=`${course?.name||''} ${course?.subject||''}`;
  const m=text.match(/(?:^|\D)(1[0-3]|[5-9])(?=[a-zA-Z]?\b|\D|$)/);
  return m?Number(m[1]):null;
}
function v202Norm(s){return String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de-DE').replace(/[^a-z0-9äöüß]+/g,' ').trim();}
function v202Topic(id){return (V202_CURRICULUM.topics||[]).find(t=>t.id===id)||null;}
function v202Method(id){return (V202_CURRICULUM.methodCurriculum||[]).find(m=>m.id===id)||null;}
function v202Topics(subject='',grade=null){return (V202_CURRICULUM.topics||[]).filter(t=>(!subject||t.subject===subject)&&(!grade||(t.grades||[]).includes(Number(grade))));}
function v202MethodsForGrade(grade){return (V202_CURRICULUM.methodCurriculum||[]).filter(m=>Number(m.grade)===Number(grade));}
function v202Source(subject){return V202_CURRICULUM.sources?.[subject]||null;}
function v202Tokens(s){return new Set(v202Norm(s).split(/\s+/).filter(x=>x.length>2));}
function v202Similarity(a,b){
  const na=v202Norm(a),nb=v202Norm(b);if(!na||!nb)return 0;if(na===nb)return 1;if(na.includes(nb)||nb.includes(na))return .86;
  const A=v202Tokens(a),B=v202Tokens(b);if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return hit/Math.max(A.size,B.size);
}
function v202TopicScore(title,t){return Math.max(v202Similarity(title,t.title),...(t.aliases||[]).map(a=>v202Similarity(title,a)));}
function v202SuggestedTopic(course,title){
  const subject=v202SubjectKey(course),grade=v202Grade(course);if(!subject||!grade)return null;
  const ranked=v202Topics(subject,grade).map(t=>({t,score:v202TopicScore(title,t)})).sort((a,b)=>b.score-a.score);
  return ranked[0]?.score>=.42?ranked[0]:null;
}
function v202CrossGradeSuggestion(course,title){
  const subject=v202SubjectKey(course),grade=v202Grade(course);if(!subject||!grade)return null;
  const ranked=v202Topics(subject).filter(t=>!(t.grades||[]).includes(grade)).map(t=>({t,score:v202TopicScore(title,t)})).sort((a,b)=>b.score-a.score);
  return ranked[0]?.score>=.58?ranked[0]:null;
}
function v202MethodSuggested(m,q,topic){
  if(!m||!q||!topic)return false;const hay=[q.title,topic.title,...(topic.aliases||[])];
  return (m.topicHints||[]).some(h=>hay.some(x=>v202Similarity(h,x)>=.62));
}
function v202MediaLike(x){return !!x?.media||/(internet|computer|digital|medien|audiovisu|geogebra|tabellenkalk|gtr|taschenrechner|plakat|präsent|referat|film|pc\b)/i.test(String(x?.text||''));}
function v202ExtensionLike(x){return String(x?.level||'').toLowerCase()==='erweitert'||/(nur\s+e|e-niveau|e-kurs)/i.test(String(x?.category||''));}
function v202Config(q,create=false){
  if(!q)return null;if(!q.curriculumV202&&create)q.curriculumV202={schema:1,topicId:'',subjectKey:'',grade:null,confirmed:false,methodIds:[],manualDoneIds:[],evidenceIds:[]};
  if(q.curriculumV202){q.curriculumV202.methodIds=Array.isArray(q.curriculumV202.methodIds)?q.curriculumV202.methodIds:[];q.curriculumV202.manualDoneIds=Array.isArray(q.curriculumV202.manualDoneIds)?q.curriculumV202.manualDoneIds:[];q.curriculumV202.evidenceIds=Array.isArray(q.curriculumV202.evidenceIds)?q.curriculumV202.evidenceIds:[];}
  return q.curriculumV202||null;
}
function v202LinkedTopic(q){const cfg=v202Config(q,false);return cfg?.confirmed?v202Topic(cfg.topicId):null;}
function v202DefaultMethodIds(q,topic){const grade=v202Grade(cls(q?.classId));return v202MethodsForGrade(grade).filter(m=>v202MethodSuggested(m,q,topic)).map(m=>m.id);}
function v202EffectiveMethodIds(q,topic){const cfg=v202Config(q,false);return cfg?.confirmed?cfg.methodIds:v202DefaultMethodIds(q,topic);}
function v202SequenceCompetencies(q,topicOverrideId='',methodIdsOverride=null){
  const topic=v202Topic(topicOverrideId)||v202LinkedTopic(q);if(!topic)return[];
  const methods=Array.isArray(methodIdsOverride)?methodIdsOverride:v202EffectiveMethodIds(q,topic);
  const base=(topic.competencies||[]).map(c=>({...c,sourceType:'curriculum',sourceTopicId:topic.id}));
  const extra=(methods||[]).map(v202Method).filter(Boolean).map(m=>({...m,level:'',sourceType:'method',sourceTopicId:topic.id}));
  return [...base,...extra];
}
function v202CompById(q,id){return v202SequenceCompetencies(q).find(c=>c.id===id)||null;}
function v202TopicOptions(subject,selected='',includeAllGrades=true){
  const list=v202Topics(subject),groups=[...new Set(list.flatMap(t=>t.grades||[]))].sort((a,b)=>a-b);
  return `<option value="">— noch nicht zugeordnet —</option>`+groups.map(g=>`<optgroup label="Jahrgang ${g}">${list.filter(t=>(t.grades||[]).includes(g)).map(t=>`<option value="${esc(t.id)}" ${selected===t.id?'selected':''}>${esc(t.title)}</option>`).join('')}</optgroup>`).join('');
}
function v202AssignedUnits(q,id){return (q?.plan||[]).filter(u=>Array.isArray(u.competencyIdsV202)&&u.competencyIdsV202.includes(id));}
function v202UnitHeld(q,u){
  return (state.lessons||[]).some(l=>v182IsHeld(l)&&(l.planReference?.unitId===u.id||(l.sequenceId===q.id&&v202Norm(l.title)===v202Norm(u.title))));
}
function v202Progress(q,id){
  const cfg=v202Config(q,false),assigned=v202AssignedUnits(q,id),active=assigned.filter(u=>!v201UnitSkipped(u)),held=assigned.filter(u=>v202UnitHeld(q,u));
  const manual=cfg?.manualDoneIds?.includes(id);if(manual||held.length)return {key:'done',label:'bearbeitet',units:assigned};
  if(active.length)return {key:'planned',label:`eingeplant${active.length>1?` · ${active.length} Std.`:''}`,units:active};
  if(assigned.length)return {key:'skipped',label:'nur in ausgegrauter Stunde',units:assigned};
  return {key:'open',label:'noch nicht eingeplant',units:[]};
}
function v202AssessmentEvidence(q,id,comp){
  const hits=[];for(const a of state.assessmentsV188||[]){if(a.classId!==q.classId)continue;const an=a.evaluationV200?.analysis;if(!an?.competencies)continue;for(const c of an.competencies){if(c.curriculumCompetencyId===id||(comp&&v202Norm(c.text)===v202Norm(comp.text))){hits.push(a.title||a.type||'Leistungsnachweis');break;}}}
  return [...new Set(hits)];
}
function v202Evidence(q,id,comp){const cfg=v202Config(q,false),formal=v202AssessmentEvidence(q,id,comp),manual=cfg?.evidenceIds?.includes(id);return {has:manual||formal.length>0,manual,formal};}
function v202Coverage(q){
  const comps=v202SequenceCompetencies(q),core=comps.filter(c=>!v202ExtensionLike(c)),grade=v202Grade(cls(q.classId));let planned=0,done=0,evidence=0;
  for(const c of core){const p=v202Progress(q,c.id);if(p.key==='planned'||p.key==='done')planned++;if(p.key==='done')done++;if(grade>=5&&grade<=7&&v202Evidence(q,c.id,c).has)evidence++;}
  return {total:core.length,allTotal:comps.length,extensions:comps.length-core.length,planned,done,evidence,grade};
}
function v202SetTopic(q,topicId,methodIds){
  if(!q)return;const c=cls(q.classId),topic=v202Topic(topicId);if(!topic){q.curriculumV202=null;return;}
  const grade=v202Grade(c),subject=v202SubjectKey(c);if(topic.subject!==subject)throw Error('Das gewählte Curriculum gehört zu einem anderen Fach.');
  const cross=grade&&!topic.grades.includes(grade);if(cross&&!confirm(`Die Curriculum-Zuordnung stammt aus Jahrgang ${topic.grades.join('/')}, der Fachkurs wirkt wie Jahrgang ${grade}. Wirklich ausdrücklich so zuordnen?`))throw Error('Zuordnung abgebrochen.');
  const old=v202Config(q,false);q.curriculumV202={schema:1,topicId:topic.id,subjectKey:subject,grade,confirmed:true,crossGradeConfirmed:!!cross,methodIds:Array.isArray(methodIds)?methodIds:v202DefaultMethodIds(q,topic),manualDoneIds:old?.manualDoneIds||[],evidenceIds:old?.evidenceIds||[],linkedAt:new Date().toISOString()};
  const allowed=new Set(v202SequenceCompetencies(q).map(x=>x.id));for(const u of q.plan||[])u.competencyIdsV202=(u.competencyIdsV202||[]).filter(id=>allowed.has(id));
}
function v202StatusHtml(q,c){
  const p=v202Progress(q,c.id),grade=v202Grade(cls(q.classId)),ev=grade>=5&&grade<=7?v202Evidence(q,c.id,c):null,media=v202MediaLike(c);
  const unitTitle=p.units.length?p.units.map(u=>u.title).join(' · '):'';
  return `<div class="v202-comp-row ${p.key}"><div class="v202-comp-main"><div class="v202-comp-tags"><span class="v202-category">${esc(c.category||'Kompetenz')}</span>${c.level?`<span class="v202-level">${esc(c.level)}</span>`:''}${v202ExtensionLike(c)?'<span class="v202-level">Erweiterung</span>':''}${media?'<span class="v202-media">Methode/Medien</span>':''}</div><strong>${esc(c.text)}</strong><small>${esc(c.id)}${unitTitle?` · ${esc(unitTitle)}`:''}</small></div><div class="v202-comp-actions"><span class="v202-progress ${p.key}">${esc(p.label)}</span><button class="text-button small" data-v202-done-toggle="${q.id}|${c.id}">${v202Config(q,false)?.manualDoneIds?.includes(c.id)?'Manuell ✓':'als bearbeitet'}</button>${ev?`<button class="${ev.has?'secondary':'text-button'} small" data-v202-evidence-toggle="${q.id}|${c.id}" title="${esc(ev.formal.length?'Automatisch aus: '+ev.formal.join(', '):'Manuellen Nachweis/Beobachtung markieren')}">${ev.has?'Nachweis ✓':'Nachweis offen'}</button>`:''}</div></div>`;
}
function v202CurriculumSection(q){
  const c=cls(q.classId),subject=v202SubjectKey(c),grade=v202Grade(c);if(!subject)return '';
  const cfg=v202Config(q,false),linked=v202LinkedTopic(q),suggest=v202SuggestedTopic(c,q.title),cross=v202CrossGradeSuggestion(c,q.title),selected=linked?.id||suggest?.t?.id||'';
  const source=v202Source(subject),cur=linked||suggest?.t||null;
  const headNote=linked?`Verknüpft mit ${source?.title||'Schulcurriculum'} · Quelle S. ${(linked.sourcePages||[]).join(', ')}`:suggest?`Vorschlag für Jahrgang ${grade} – noch nicht bestätigt.`:cross?`Nur ein ähnlicher Treffer in Jahrgang ${(cross.t.grades||[]).join('/')}: „${cross.t.title}“. Cross-Grade wird nie automatisch übernommen.`:'Keine sichere automatische Zuordnung. Bitte Thema auswählen.';
  let body='';if(linked){
    const methods=v202MethodsForGrade(grade),selectedMethods=new Set(v202EffectiveMethodIds(q,linked));
    const grouped={};for(const comp of v202SequenceCompetencies(q)){(grouped[comp.category||'Kompetenzen']??=[]).push(comp);}
    const cov=v202Coverage(q),leb=grade>=5&&grade<=7?` · ${cov.evidence}/${cov.total} mit Nachweis` : '';
    body=`<div class="v202-coverage"><strong>${cov.done}/${cov.total}</strong><span>bearbeitet</span><strong>${cov.planned}/${cov.total}</strong><span>eingeplant${leb}</span></div>${Object.entries(grouped).map(([cat,items])=>`<details class="v202-comp-group" open><summary>${esc(cat)} <span>${items.length}</span></summary>${items.map(x=>v202StatusHtml(q,x)).join('')}</details>`).join('')}${methods.length?`<details class="v202-method-pool"><summary>Zusätzliches Methodencurriculum Mathematik · Jahrgang ${grade}</summary><p class="microcopy">Passende Einträge sind beim Verknüpfen vorausgewählt. Weitere jahrgangsbezogene Methoden kannst du bewusst ergänzen.</p>${methods.map(m=>`<label class="v202-method-option"><input type="checkbox" data-v202-method-id="${m.id}" ${selectedMethods.has(m.id)?'checked':''}><span>${v202MediaLike(m)?'<b>Medien · </b>':''}${esc(m.text)}</span></label>`).join('')}<button class="secondary" data-v202-method-save="${q.id}">Methodenauswahl speichern</button></details>`:''}`;
  }
  return `<section class="detail-section v202-curriculum"><div class="section-head"><div><span class="eyebrow">CURRICULUM & KOMPETENZEN</span><h3>Kompetenzen dieser Unterrichtsreihe</h3><p>${esc(headNote)}</p></div><button class="secondary" data-v202-browser>Gesamtes Curriculum ansehen</button></div><div class="v202-link-row"><label>Curriculum-Thema<select id="v202-topic-${q.id}">${v202TopicOptions(subject,selected)}</select></label><button class="primary" data-v202-topic-save="${q.id}">${linked?'Zuordnung ändern':'Zuordnung bestätigen'}</button>${linked?`<button class="text-button" data-v202-topic-unlink="${q.id}">Zuordnung lösen</button>`:''}</div>${linked?.crossGradeConfirmed?`<div class="v202-warning">⚠ Bewusst jahrgangsübergreifend verknüpft: Kurs Jg. ${grade}, Curriculum Jg. ${linked.grades.join('/')}.</div>`:''}${body}</section>`;
}
function v202BrowserModal(){
  const subject=v202Browser.subject,grade=Number(v202Browser.grade)||5,source=v202Source(subject),topics=v202Topics(subject,grade);
  return `<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide v202-browser-modal" data-modal-stop><header class="modal-header"><div><span class="eyebrow">SCHULCURRICULUM · FEST EINGELESEN</span><h2>Curriculum & Kompetenzen</h2></div><button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body"><div class="v202-browser-filter"><label>Fach<select id="v202-browser-subject"><option value="religion" ${subject==='religion'?'selected':''}>Evangelische Religion</option><option value="mathematik" ${subject==='mathematik'?'selected':''}>Mathematik</option></select></label><label>Jahrgang<select id="v202-browser-grade">${[5,6,7,8,9,10].map(g=>`<option value="${g}" ${g===grade?'selected':''}>${g}</option>`).join('')}</select></label></div><p class="v202-source-note"><strong>${esc(source?.title||'')}</strong>${source?.note?` · ${esc(source.note)}`:''}</p>${topics.map(t=>`<details class="v202-browser-topic"><summary><strong>${esc(t.title)}</strong><span>Quelle S. ${(t.sourcePages||[]).join(', ')}</span></summary>${Object.entries((t.competencies||[]).reduce((o,x)=>{(o[x.category||'Kompetenzen']??=[]).push(x);return o;},{})).map(([cat,items])=>`<h4>${esc(cat)}</h4>${items.map(x=>`<div class="v202-browser-comp">${v202MediaLike(x)?'<span class="v202-media">Methode/Medien</span>':''}<span>${esc(x.text)}</span><small>${esc(x.id)}${x.level?' · '+esc(x.level):''}</small></div>`).join('')}`).join('')}</details>`).join('')||'<p class="muted">Für diese Auswahl sind keine Tableaus hinterlegt.</p>'}${subject==='mathematik'?`<details class="v202-browser-topic"><summary><strong>Schulinternes Methodencurriculum · Jahrgang ${grade}</strong><span>${v202MethodsForGrade(grade).length} Einträge</span></summary>${v202MethodsForGrade(grade).map(m=>`<div class="v202-browser-comp">${v202MediaLike(m)?'<span class="v202-media">Methode/Medien</span>':''}<span>${esc(m.text)}</span><small>${esc(m.id)}</small></div>`).join('')}</details>`:''}</div></section></div>`;
}
function v202FlowTopic(){
  const q=seq(v184Flow.sequenceId),c=cls(v184Flow.courseId);return v202Topic(v184Flow.curriculumTopicIdV202)||v202LinkedTopic(q)||v202SuggestedTopic(c,q?.title||v184Flow.newTitle)?.t||null;
}
function v202FlowMethodIds(topic){const q=seq(v184Flow.sequenceId);if(q&&v202LinkedTopic(q)?.id===topic?.id)return v202EffectiveMethodIds(q,topic);if(!topic)return[];const fake={title:q?.title||v184Flow.newTitle,classId:v184Flow.courseId};return v202DefaultMethodIds(fake,topic);}
function v202PromptCompetencyBlock(topic,q=null){
  if(!topic)return'';const methods=q?v202EffectiveMethodIds(q,topic):v202FlowMethodIds(topic),comps=q?v202SequenceCompetencies(q,topic.id,methods):[...(topic.competencies||[]).map(x=>({...x,sourceType:'curriculum'}),),...methods.map(v202Method).filter(Boolean).map(x=>({...x,sourceType:'method'}))];
  const c=cls(q?.classId||v184Flow.courseId),grade=v202Grade(c),source=v202Source(topic.subject),threshold=grade>=5&&grade<=7?source?.thresholds5to7:null;
  return `## VERBINDLICHE CURRICULARE KOMPETENZEN\nQuelle: ${source?.title||'Schulcurriculum'} · Tableau „${topic.title}“ · Seite(n) ${(topic.sourcePages||[]).join(', ')}\nKursjahrgang: ${grade||'nicht erkannt'}${topic.grades?.includes(grade)?'':` · ACHTUNG: Tableau stammt aus Jahrgang ${topic.grades?.join('/')||'?'}; diese Zuordnung wurde im Cockpit ausdrücklich gewählt.`}\n${threshold?`Bewertungsgrenzen Jg. 5–7 aus der Quelle: erreicht ab ${threshold.reachedMinPct} %, teilweise erreicht ab ${threshold.partialMinPct} %.\n`:''}\n${comps.map(x=>`- ID ${x.id} | ${x.category||'Kompetenz'}${x.level?' | '+x.level:''}${v202ExtensionLike(x)?' | ERWEITERUNG/E-NIVEAU':''}${v202MediaLike(x)?' | METHODE/MEDIEN':''}: ${x.text}`).join('\n')}\n\nDiese IDs und Formulierungen sind verbindlich. Plane die Reihe gleichzeitig material- UND kompetenzorientiert. Medien-/Methodenkompetenzen müssen ausdrücklich in passenden Lernhandlungen vorkommen, auch wenn vorhandene Arbeitsblätter sie nicht automatisch abdecken. Eine Kompetenz darf sich über mehrere Stunden erstrecken; eine Stunde darf mehrere Kompetenz-IDs tragen. Weise jeder Soll-Stunde im Feld competencyIds exakt die tatsächlich bearbeiteten IDs zu. Alle grundlegenden/Kern-Kompetenzen sowie bewusst ausgewählten Methodencurriculum-Einträge sollen im Verlauf sichtbar eingeplant werden. Als „erweitert“, „nur E-Niveau“ oder „nur E-Kurs“ markierte Kompetenzen sind Differenzierungs-/Erweiterungsziele und dürfen NICHT als Pflichtziel für alle behandelt werden; plane sie gezielt als Erweiterung, wenn passend. Wenn Zeit, Material oder Reihenstand die verbindlichen Kernziele nicht zulassen, NICHT still weglassen oder als erreicht behaupten, sondern vor dem Importblock konkret benennen, welche Kompetenz offen bleibt und warum. Für Jahrgänge 5–7 so planen, dass bewertbare Kompetenzen später auch durch Klassenarbeit, Test, Präsentation, Produkt oder dokumentierte Beobachtung nachweisbar sein können.\n`;
}

// Neue Planobjekte behalten Kompetenz-IDs auch durch spätere Bereinigungs-/Importpfade.
const v202CleanPlanUnitBefore=cleanPlanUnitV10;
cleanPlanUnitV10=function(u={}){const out=v202CleanPlanUnitBefore(u);out.competencyIdsV202=Array.isArray(u.competencyIdsV202)?[...new Set(u.competencyIdsV202.map(String))]:[];return out;};

// Curriculare Zielkompetenzen werden bereits beim Reihenprompt verbindlich mitgegeben.
const v202V184OpenBefore=v184Open;
v184Open=function(courseId='',qid=''){
  v202V184OpenBefore(courseId,qid);const q=seq(v184Flow.sequenceId),c=cls(v184Flow.courseId),linked=v202LinkedTopic(q),suggest=v202SuggestedTopic(c,q?.title||'');v184Flow.curriculumTopicIdV202=linked?.id||suggest?.t?.id||'';
};
const v202V184CaptureBefore=v184CaptureSetup;
v184CaptureSetup=function(){const node=document.getElementById('v202-flow-topic');if(node)v184Flow.curriculumTopicIdV202=node.value||'';v202V184CaptureBefore();};
const v202V184PromptBefore=v184Prompt;
v184Prompt=function(){
  let txt=v202V184PromptBefore();const c=cls(v184Flow.courseId),subject=v202SubjectKey(c),grade=v202Grade(c);if(!subject||!grade)return txt;
  const topic=v202Topic(v184Flow.curriculumTopicIdV202)||v202LinkedTopic(seq(v184Flow.sequenceId));if(!topic){if(v202Topics(subject,grade).length)throw Error('Bitte zuerst ein verbindliches Curriculum-Thema auswählen. Das Schulcockpit plant Religion/Mathematik in den hinterlegten Jahrgängen nicht mehr ohne curriculare Zuordnung.');txt+=`\n\n## Curriculare Quellenlage\nFür ${c?.subject||''} Jahrgang ${grade} enthält die aktuell im Schulcockpit hinterlegte Kompetenzbibliothek kein jahrgangsspezifisches Tableau. Erfinde deshalb keine schulinterne Kompetenzzuordnung.\n`;return txt;}
  if(topic.subject!==subject)throw Error('Das gewählte Curriculum-Thema gehört zu einem anderen Fach.');
  if(!topic.grades.includes(grade)&&!seq(v184Flow.sequenceId)?.curriculumV202?.crossGradeConfirmed&&!confirm(`Das gewählte Tableau gehört zu Jahrgang ${topic.grades.join('/')}, der Kurs wirkt wie Jahrgang ${grade}. Für diesen Plan ausdrücklich so verwenden?`))throw Error('Curriculum-Zuordnung abgebrochen.');
  const block=v202PromptCompetencyBlock(topic,seq(v184Flow.sequenceId));txt=txt.replace('## Auftrag\n',block+'\n## Auftrag\n');
  txt=txt.replace('"competencies": "", "notes": "", "materials": [','"competencies": "", "competencyIds": ["'+(topic.competencies?.[0]?.id||'')+'"], "notes": "", "materials": [');
  txt+=`\n\n## Zusätzliche Importregel V0.20.2\nJede units[]-Stunde MUSS das Array competencyIds enthalten. Verwende darin ausschließlich IDs aus der verbindlichen Kompetenzliste dieses Prompts. Ein leeres Array ist nur zulässig, wenn die Stunde nachweislich reine Organisation/Prüfungsdurchführung ist; begründe das in notes. Keine neue Kompetenz-ID erfinden.\n`;
  return txt;
};
const v202V184NormalizeBefore=v184Normalize;
v184Normalize=function(x){
  const pkg=v202V184NormalizeBefore(x),q=seq(v184Flow.sequenceId),topic=v202Topic(v184Flow.curriculumTopicIdV202)||v202LinkedTopic(q);if(!topic)return pkg;
  const allowed=new Set((q?v202SequenceCompetencies(q,topic.id,v202FlowMethodIds(topic)):[...(topic.competencies||[]),...v202FlowMethodIds(topic).map(v202Method).filter(Boolean)]).map(c=>c.id));
  pkg.units.forEach((u,i)=>{const raw=x.units?.[i]?.competencyIds;if(!Array.isArray(raw))throw Error(`Stunde ${i+1}: competencyIds fehlt. Bitte die Antwort mit dem V0.20.2-Prompt neu erzeugen.`);const ids=[...new Set(raw.map(String))];const bad=ids.filter(id=>!allowed.has(id));if(bad.length)throw Error(`Stunde ${i+1}: unbekannte Kompetenz-ID(s): ${bad.join(', ')}. Nicht raten – nur IDs aus dem Curriculum verwenden.`);u.competencyIdsV202=ids;});
  pkg.curriculumTopicIdV202=topic.id;return pkg;
};
const v202V184ApplyBefore=v184Apply;
v184Apply=async function(){
  const requested=(v184Flow.pkg?.units||[]).map(u=>({title:u.title,plannedDate:u.plannedDate,ids:[...(u.competencyIdsV202||[])]})),topicId=v184Flow.pkg?.curriculumTopicIdV202||v184Flow.curriculumTopicIdV202||'';
  const result=await v202V184ApplyBefore(),q=seq(result.qid);if(q&&topicId){const topic=v202Topic(topicId);if(topic){const methods=v202FlowMethodIds(topic);v202SetTopic(q,topicId,methods);}for(const r of requested){let u=(q.plan||[]).find(x=>r.plannedDate&&x.plannedDate===r.plannedDate&&v202Norm(x.title)===v202Norm(r.title));if(!u)u=(q.plan||[]).find(x=>v202Norm(x.title)===v202Norm(r.title));if(u)u.competencyIdsV202=r.ids.filter(id=>v202CompById(q,id));}await saveState();}return result;
};

// Reihenplanungsdialog zeigt Curriculum-Thema bereits vor dem Prompt.
const v202V184ModalBefore=v184ModalHtml;
v184ModalHtml=function(){
  let h=v202V184ModalBefore();if(v184Flow.step!==0)return h;const c=cls(v184Flow.courseId),subject=v202SubjectKey(c),grade=v202Grade(c);if(!subject||!grade)return h;
  const q=seq(v184Flow.sequenceId),suggest=v202SuggestedTopic(c,q?.title||v184Flow.newTitle),selected=v184Flow.curriculumTopicIdV202||v202LinkedTopic(q)?.id||suggest?.t?.id||'';
  const control=`<label class="v202-flow-topic">Curriculum-Thema <select id="v202-flow-topic">${v202TopicOptions(subject,selected)}</select><small>Verbindlich für die Planung. Andere Jahrgänge sind auswählbar, aber werden niemals still übernommen.</small></label>`;
  return h.replace(/<label>Reihentitel[\s\S]*?<\/label><div class="v184-grid">/,m=>m.replace('<div class="v184-grid">',control+'<div class="v184-grid">'));
};

// Unit-Editor: konkrete Kompetenz(en) pro Stunde, komplett unabhängig von einer 1:1-Zuordnung.
const v202ModalBefore=modalHtml;
modalHtml=function(){
  if(modal?.type==='curriculumV202')return v202BrowserModal();let h=v202ModalBefore();if(modal?.type!=='unitV182')return h;
  const q=seq(modal.qid),topic=v202LinkedTopic(q);if(!q||!topic)return h;const u=q.plan?.find(x=>x.id===modal.uid),chosen=new Set(u?.competencyIdsV202||[]),comps=v202SequenceCompetencies(q);
  const box=`<section class="v202-unit-competencies"><span class="eyebrow">KOMPETENZEN DIESER STUNDE</span><p class="microcopy">Mehrere möglich; dieselbe Kompetenz kann in mehreren Stunden vorkommen. Nur wirklich bearbeitete Kompetenzen markieren.</p>${comps.map(c=>`<label><input type="checkbox" data-v202-unit-comp="${c.id}" ${chosen.has(c.id)?'checked':''}><span>${v202MediaLike(c)?'<b class="v202-media-inline">Methode/Medien · </b>':''}${esc(c.text)}<small>${esc(c.category||'')}</small></span></label>`).join('')}</section>`;
  return h.replace('<label>Materialhinweise – jede Datei/Referenz in eine neue Zeile',box+'<label>Materialhinweise – jede Datei/Referenz in eine neue Zeile');
};

// Reihenansicht: Zuordnung, Fortschritt, LEB-Nachweise und Curriculum-Browser.
const v202SequencePanelBefore=sequencePanel;
sequencePanel=function(q){let h=v202SequencePanelBefore(q);if(!q)return h;const section=v202CurriculumSection(q);const marker='<section class="detail-section v184-sequence-action">';const pos=h.indexOf(marker);if(pos>=0)return h.slice(0,pos)+section+h.slice(pos);const danger=h.indexOf('<section class="danger-zone');return danger>=0?h.slice(0,danger)+section+h.slice(danger):h+section;};

// Soll-Stunden zeigen ihre Kompetenzbezüge direkt in der Übersicht.
const v202PlanUnitCardBefore=planUnitCardV10;
planUnitCardV10=function(q,u,i){let h=v202PlanUnitCardBefore(q,u,i);const ids=u?.competencyIdsV202||[],comps=ids.map(id=>v202CompById(q,id)).filter(Boolean);if(!comps.length)return h;const chips=`<div class="v202-unit-chips">${comps.slice(0,4).map(c=>`<span title="${esc(c.text)}" class="${v202MediaLike(c)?'media':''}">${esc(c.category||'Kompetenz')}</span>`).join('')}${comps.length>4?`<span>+${comps.length-4}</span>`:''}</div>`;return h.replace('</h4>','</h4>'+chips);};

// Jahreskarten geben einen knappen curricularen Status, ohne die Ansicht zu überladen.
const v202SequenceCardBefore=v190SequenceCard;
v190SequenceCard=function(q){let h=v202SequenceCardBefore(q),topic=v202LinkedTopic(q);if(!topic)return h;const cov=v202Coverage(q),extra=`<div class="v202-card-status"><span>Curriculum: ${esc(topic.title)}</span><span>${cov.planned}/${cov.total} eingeplant</span><span>${cov.done}/${cov.total} bearbeitet</span>${cov.grade>=5&&cov.grade<=7?`<span>${cov.evidence}/${cov.total} Nachweise</span>`:''}</div>`;return h.replace('</button></article>',extra+'</button></article>');};

// In der tatsächlichen Unterrichtsstunde werden die zugeordneten Kompetenzen sichtbar.
const v202LessonPanelBefore=lessonPanel;
lessonPanel=function(l){let h=v202LessonPanelBefore(l);if(!l||l.kind==='group'||l.groupId)return h;const q=seq(l.sequenceId),u=q?.plan?.find(x=>x.id===l.planReference?.unitId)||q?.plan?.find(x=>x.plannedDate===l.date&&v202Norm(x.title)===v202Norm(l.title));if(!q||!u)return h;const comps=(u.competencyIdsV202||[]).map(id=>v202CompById(q,id)).filter(Boolean);if(!comps.length)return h;const section=`<section class="detail-section v202-lesson-comps"><span class="eyebrow">KOMPETENZEN HEUTE</span><h3>${comps.length} curriculare Ziel${comps.length===1?'kompetenz':'kompetenzen'}</h3>${comps.map(c=>`<div>${v202MediaLike(c)?'<span class="v202-media">Methode/Medien</span>':''}<strong>${esc(c.text)}</strong><small>${esc(c.category||'')}</small></div>`).join('')}</section>`;return h.replace(/<section class="detail-section v180-lesson-status">/,section+'<section class="detail-section v180-lesson-status">');};

// Konkrete Stundenplanung kennt nur die für diese Stunde verknüpften Kompetenzen.
const v202ConcretePromptBefore=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){let txt=v202ConcretePromptBefore(l);const q=seq(l.sequenceId),topic=v202LinkedTopic(q);if(!q||!topic)return txt;const u=q.plan?.find(x=>x.id===l.planReference?.unitId)||q.plan?.find(x=>x.plannedDate===l.date&&v202Norm(x.title)===v202Norm(l.title));const ids=u?.competencyIdsV202||[],comps=ids.map(id=>v202CompById(q,id)).filter(Boolean);if(!comps.length){txt+=`\n\n## Curriculare Zuordnung dieser konkreten Stunde\nDie Reihe ist mit „${topic.title}“ verknüpft, aber dieser Soll-Stunde ist noch KEINE konkrete Kompetenz-ID zugeordnet. Erfinde keine Zuordnung und behaupte nicht, eine Kompetenz werde heute erreicht. Weise mich darauf hin, dass ich die Soll-Stunde im Schulcockpit zuerst curricular zuordnen sollte.\n`;return txt;}txt+=`\n\n## Verbindliche curriculare Kompetenzen DIESER Stunde\n${comps.map(c=>`- ${c.id} | ${c.category||'Kompetenz'}${v202MediaLike(c)?' | METHODE/MEDIEN':''}: ${c.text}`).join('\n')}\nDie Stunde muss diese Kompetenzen tatsächlich lernwirksam bearbeiten. Sie müssen nicht in einer Stunde abschließend erreicht sein. Keine weitere Kompetenz der Reihe ohne belegten Grund als heutiges Ziel ergänzen.\n`;return txt;};
makeBrief=concretePlanningPromptV12;

// Prüfungsanalyse: eingebautes Curriculum und exakte Curriculum-ID stehen zur Verfügung,
// weiterhin ohne Namen oder individuelle Ergebnisse.
function v202AssessmentSequenceCandidates(a){
  const qs=classSequences(a.classId).filter(q=>v202LinkedTopic(q));if(!qs.length)return[];const d=a.date||'';return qs.map(q=>{let score=v202Similarity(a.scope||a.title||'',q.title);if(d&&q.startDate&&q.endDate&&d>=q.startDate&&d<=q.endDate)score+=1;if(d&&q.endDate&&q.endDate<=d)score+=.15;return {q,score};}).sort((a,b)=>b.score-a.score).filter(x=>x.score>.2).slice(0,2).map(x=>x.q);
}
const v202AssessmentPromptBefore=v200AssessmentAnalysisPrompt;
v200AssessmentAnalysisPrompt=function(a,priv){let txt=v202AssessmentPromptBefore(a,priv);const c=cls(a.classId),subject=v202SubjectKey(c),grade=v202Grade(c),qs=v202AssessmentSequenceCandidates(a);if(!subject||!grade)return txt;const source=v202Source(subject),threshold=grade>=5&&grade<=7?source?.thresholds5to7:null;const comps=qs.flatMap(q=>v202SequenceCompetencies(q).map(x=>({q,x})));if(comps.length){txt+=`\n\n## Im Schulcockpit verbindlich verknüpfte Curriculum-Kompetenzen\n${comps.map(({q,x})=>`- ${x.id} | Reihe „${q.title}“ | ${x.category||'Kompetenz'}: ${x.text}`).join('\n')}\nOrdne eine Prüfungs-Kompetenz nur dann einer dieser Quellen zu, wenn die Formulierung sachlich exakt passt. Ergänze in jedem competency-Objekt dann \"curriculumCompetencyId\": \"exakte ID\". Wenn keine eindeutige Zuordnung möglich ist, NICHT raten: stelle vor dem Importblock eine Rückfrage.\n`;}
  if(threshold)txt+=`\nVerbindliche Bewertungsgrenzen aus ${source.title} für Jahrgang ${grade}: erreicht ab ${threshold.reachedMinPct} %, teilweise erreicht ab ${threshold.partialMinPct} %, darunter noch nicht erreicht. Verwende exakt diese Werte; keine anderen Grenzen erfinden.\n`;
  return txt;
};
const v202ExtractAnalysisBefore=v200ExtractAnalysis;
v200ExtractAnalysis=function(text){const obj=v202ExtractAnalysisBefore(text),known=new Set((V202_CURRICULUM.topics||[]).flatMap(t=>(t.competencies||[]).map(c=>c.id)).concat((V202_CURRICULUM.methodCurriculum||[]).map(m=>m.id)));for(const c of obj.competencies||[]){if(c.curriculumCompetencyId&&!known.has(c.curriculumCompetencyId))throw new Error(`Unbekannte curriculumCompetencyId ${c.curriculumCompetencyId}. Bitte nicht raten, sondern Zuordnung in ChatGPT klären.`);}return obj;};
const v202Step1Before=v200Step1;
v200Step1=function(a,priv){let h=v202Step1Before(a,priv),qs=v202AssessmentSequenceCandidates(a);if(!qs.length)return h;const info=`<section class="detail-section v202-assessment-curriculum"><span class="eyebrow">BEREITS IM COCKPIT HINTERLEGT</span><h3>Curriculum wird automatisch mitgegeben</h3><p>${qs.map(q=>`<strong>${esc(q.title)}</strong> → ${esc(v202LinkedTopic(q)?.title||'')}`).join('<br>')}</p><p class="microcopy">Du musst das Hauscurriculum für diese Zuordnung nicht erneut hochladen. Zusätzliche/neuere Fachkonferenzdateien kannst du weiterhin unten ergänzen.</p></section>`;return h.replace('<section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">KOMPETENZGRUNDLAGE</span>',info+'<section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">KOMPETENZGRUNDLAGE</span>');};

// Globaler Curriculum-Browser in der Jahresplanung – unabhängig von vorhandenen Klassen.
const v202SequencesViewBefore=v190SequencesView;
v190SequencesView=function(){let h=v202SequencesViewBefore();return h.replace('<button class="primary" data-v184-open>Neue Reihe / Reihe mit ChatGPT planen →</button>','<button class="secondary" data-v202-browser>Curriculum & Kompetenzen</button><button class="primary" data-v184-open>Neue Reihe / Reihe mit ChatGPT planen →</button>');};
sequencesView=v190SequencesView;

const v202WireBefore=wire;
wire=function(){
  v202WireBefore();
  document.querySelectorAll('[data-v202-browser]').forEach(b=>b.onclick=()=>{modal={type:'curriculumV202'};render();});
  document.getElementById('v202-browser-subject')?.addEventListener('change',e=>{v202Browser.subject=e.target.value;render();});
  document.getElementById('v202-browser-grade')?.addEventListener('change',e=>{v202Browser.grade=Number(e.target.value)||5;render();});
  document.querySelectorAll('[data-v202-topic-save]').forEach(b=>b.onclick=async()=>{const q=seq(b.dataset.v202TopicSave),sel=document.getElementById('v202-topic-'+q.id)?.value||'';if(!sel)return alert('Bitte ein Curriculum-Thema auswählen.');try{const t=v202Topic(sel),methodIds=v202DefaultMethodIds(q,t);v202SetTopic(q,sel,methodIds);await saveState();render();}catch(e){if(e.message!=='Zuordnung abgebrochen.')alert(e.message||e);}});
  document.querySelectorAll('[data-v202-topic-unlink]').forEach(b=>b.onclick=async()=>{const q=seq(b.dataset.v202TopicUnlink);if(!q||!confirm('Curriculum-Zuordnung dieser Reihe lösen? Bereits gesetzte Kompetenz-IDs in den Soll-Stunden werden dabei entfernt.'))return;q.curriculumV202=null;for(const u of q.plan||[])u.competencyIdsV202=[];await saveState();render();});
  document.querySelectorAll('[data-v202-method-save]').forEach(b=>b.onclick=async()=>{const q=seq(b.dataset.v202MethodSave),cfg=v202Config(q,false);if(!q||!cfg)return;cfg.methodIds=[...document.querySelectorAll('[data-v202-method-id]:checked')].map(x=>x.dataset.v202MethodId);const allowed=new Set(v202SequenceCompetencies(q).map(x=>x.id));for(const u of q.plan||[])u.competencyIdsV202=(u.competencyIdsV202||[]).filter(id=>allowed.has(id));await saveState();render();});
  document.querySelectorAll('[data-v202-done-toggle]').forEach(b=>b.onclick=async()=>{const [qid,id]=b.dataset.v202DoneToggle.split('|'),q=seq(qid),cfg=v202Config(q,true),s=new Set(cfg.manualDoneIds||[]);s.has(id)?s.delete(id):s.add(id);cfg.manualDoneIds=[...s];await saveState();render();});
  document.querySelectorAll('[data-v202-evidence-toggle]').forEach(b=>b.onclick=async()=>{const [qid,id]=b.dataset.v202EvidenceToggle.split('|'),q=seq(qid),cfg=v202Config(q,true),s=new Set(cfg.evidenceIds||[]);s.has(id)?s.delete(id):s.add(id);cfg.evidenceIds=[...s];await saveState();render();});

  // Speichern im Unit-Editor erweitern, ohne die V0.20.1-Einschublogik anzutasten.
  const saveBtn=document.querySelector('[data-v182-unit-save]');if(saveBtn&&document.querySelector('[data-v202-unit-comp]')){const oldClick=saveBtn.onclick;saveBtn.onclick=async function(e){const ids=[...document.querySelectorAll('[data-v202-unit-comp]:checked')].map(x=>x.dataset.v202UnitComp),[qid,uidx]=this.dataset.v182UnitSave.split('|'),q=seq(qid),beforeIds=new Set((q?.plan||[]).map(x=>x.id)),title=document.getElementById('v182-unit-title')?.value.trim()||'',date=document.getElementById('v182-unit-date')?.value||'';if(oldClick)await oldClick.call(this,e);const qq=seq(qid);let u=uidx?qq?.plan?.find(x=>x.id===uidx):qq?.plan?.find(x=>!beforeIds.has(x.id));if(!u)u=qq?.plan?.find(x=>v202Norm(x.title)===v202Norm(title)&&(!date||x.plannedDate===date));if(u){const allowed=new Set(v202SequenceCompetencies(qq).map(c=>c.id));u.competencyIdsV202=ids.filter(id=>allowed.has(id));await saveState();render();}};}

  // Reihenplanungsdialog: bei Kurs/Reihenwechsel die curriculare Auswahl passend neu setzen.
  document.getElementById('v184-course')?.addEventListener('change',e=>{const c=cls(e.target.value);v184Flow.curriculumTopicIdV202=v202SuggestedTopic(c,v184Flow.newTitle||'')?.t?.id||'';render();});
  document.getElementById('v184-sequence')?.addEventListener('change',e=>{const q=seq(e.target.value),c=cls(v184Flow.courseId);v184Flow.curriculumTopicIdV202=v202LinkedTopic(q)?.id||v202SuggestedTopic(c,q?.title||'')?.t?.id||'';render();});
};

const v202RenderBefore=render;
render=function(){v202RenderBefore();const v=document.querySelector('.brand small');if(v)v.textContent=`${state.settings.schoolYear} · ${V202_VERSION}`;};

// Life RPG completion bridge: emit only after the authoritative school save succeeds.
const lifeRpgSaveSchoolBeforeBridge=saveState;
saveState=function(...args){
  const bridge=window.LifeRPGSchoolBridge;
  const ready=v186Ready && bridge;
  const result=lifeRpgSaveSchoolBeforeBridge.apply(this,args);
  if(ready)Promise.resolve(result).then(()=>v186DbGet()).then(record=>{
    if(record?.json)return bridge.observe(bridge.projection(JSON.parse(record.json)));
  }).catch(()=>{});
  return result;
};

