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
  classes:[
    { id:'m5a', name:'5a', subject:'Mathematik', students:28, color:'#6d5f9b' },
    { id:'r5b', name:'5b', subject:'Religion', students:26, color:'#b86f8b' },
    { id:'r8a', name:'8a', subject:'Religion', students:27, color:'#557b78' },
    { id:'r11', name:'11', subject:'Religion', students:24, color:'#8b684c' },
  ],
  timetable:[
    {id:'tt1',weekday:1,order:1,period:'1. Block',classId:'m5a'},
    {id:'tt2',weekday:2,order:1,period:'1./2. Block',classId:'r8a'},
    {id:'tt3',weekday:3,order:1,period:'2. Block',classId:'r5b'},
    {id:'tt4',weekday:4,order:1,period:'3./4. Block',classId:'r11'},
  ],
  materials:[
    {id:'mat-addition',title:'Fehlerdetektiv – schriftliche Addition',kind:'file',variants:[
      {id:'add-standard',type:'standard',label:'Standard',available:true,fileName:'Fehlerdetektiv_Addition.pdf'},
      {id:'add-challenge',type:'challenge',label:'Forderung',available:true,fileName:'Fehlerdetektiv_Addition_Forderung.pdf'},
      {id:'add-support',type:'support',label:'Förderung',available:false},
      {id:'add-daz',type:'daz',label:'DaZ / einfache Sprache',available:false},
      {id:'add-solution',type:'solution',label:'Lösung',available:true,fileName:'Fehlerdetektiv_Addition_Loesung.pdf'},
    ],improvementFlags:['Mehr Rechenplatz bei Aufgabe 4']},
    {id:'mat-ah',title:'Klett Arbeitsheft Mathematik 5',kind:'book',source:'Arbeitsheft',pages:'S. 28',tasks:'Nr. 1–5',variants:[
      {id:'ah-standard',type:'standard',label:'AH S. 28',available:true},
      {id:'ah-support',type:'support',label:'Förderalternative',available:true,fileName:'Klett_Foerdermaterial_S17.pdf'},
    ],improvementFlags:[]},
    {id:'mat-koran',title:'Koran – Aufbau und Orientierung',kind:'file',variants:[
      {id:'koran-standard',type:'standard',label:'Standard',available:true,fileName:'Koran_Aufbau.pdf'},
      {id:'koran-challenge',type:'challenge',label:'Forderung',available:false},
      {id:'koran-daz',type:'daz',label:'DaZ / einfache Sprache',available:false},
    ],improvementFlags:['DaZ-Version wäre sinnvoll']},
    {id:'mat-bibel',title:'Bibel-Rätsel',kind:'file',variants:[
      {id:'bibel-standard',type:'standard',label:'Standard',available:true,fileName:'Bibel_Raetsel.pdf'},
    ],improvementFlags:['Layout motivierender machen']},
  ],
  lessons:[
    {id:'l1',classId:'m5a',date:dateForWeekday(1),period:'1. Block',unit:'Schriftliche Rechenverfahren',title:'Schriftliche Addition und Subtraktion vertiefen',objective:'Fehler erkennen, erklären und Rechenstrategien sicher anwenden.',status:'ready',plannedSteps:['Fachbegriffe aktivieren','Fehlerdetektiv bearbeiten','Arbeitsheft S. 28','Sicherung'],completedSteps:[],materials:['mat-addition','mat-ah'],printPlan:[
      {id:'pp1',materialId:'mat-addition',variantId:'add-standard',count:21,mode:'bw',alreadyPrinted:false,needed:true},
      {id:'pp2',materialId:'mat-addition',variantId:'add-challenge',count:4,mode:'bw',alreadyPrinted:false,needed:true},
      {id:'pp3',materialId:'mat-ah',variantId:'ah-support',count:3,mode:'bw',alreadyPrinted:false,needed:true},
    ]},
    {id:'l2',classId:'r8a',date:dateForWeekday(2),period:'1./2. Block',unit:'Islam',title:'Der Koran – Aufbau und Orientierung',objective:'Den Aufbau des Korans erschließen und zentrale Begriffe einordnen.',status:'planned',plannedSteps:['Rückblick Vertretungsstunde','Material erschließen','Vergleich','Sicherung'],completedSteps:['Rückblick Vertretungsstunde','Material erschließen'],materials:['mat-koran'],printPlan:[
      {id:'pp4',materialId:'mat-koran',variantId:'koran-standard',count:27,mode:'color',alreadyPrinted:true,needed:true},
    ],reflection:{mood:'okay',timing:'unfinished',learning:'partial',note:'Vertretungsmaterial wurde zuvor nicht bearbeitet. Sicherung nachholen.'}},
    {id:'l3',classId:'r5b',date:dateForWeekday(3),period:'2. Block',unit:'Die Bibel kennenlernen',title:'Orientierung in der Bibel',objective:'Die Bibel als Bibliothek kennenlernen und Informationen gezielt nachschlagen.',status:'needs-material',plannedSteps:['Verhaltensregeln','Bibel erkunden','Bibel-Rätsel','Austausch'],completedSteps:[],materials:['mat-bibel'],printPlan:[
      {id:'pp5',materialId:'mat-bibel',variantId:'bibel-standard',count:26,mode:'color',alreadyPrinted:false,needed:true},
    ]},
    {id:'l4',classId:'r11',date:dateForWeekday(4),period:'3./4. Block',unit:'Anthropologie',title:'Menschenbilder vergleichen',objective:'Unterschiedliche Menschenbilder vergleichen und begründet positionieren.',status:'open',plannedSteps:['Kognitiver Einstieg','Materialanalyse','Vergleich','Transfer'],completedSteps:[],materials:[],printPlan:[]},
  ],
  backlog:[
    {id:'b1',materialId:'mat-addition',title:'Fehlerdetektiv Addition',detail:'Mehr Rechenplatz bei Aufgabe 4',effort:'10',done:false},
    {id:'b2',materialId:'mat-bibel',title:'Bibel-Rätsel',detail:'Layout motivierender gestalten',effort:'30',done:false},
    {id:'b3',materialId:'mat-koran',title:'Koran-Arbeitsblatt',detail:'DaZ-/einfache-Sprache-Version ergänzen',effort:'30',done:false},
    {id:'b4',title:'PowerPoint-Master',detail:'Think–Pair–Share-Folie ergänzen',effort:'10',done:false},
  ],
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
  out.classes=out.classes||[]; out.materials=out.materials||[]; out.lessons=out.lessons||[]; out.backlog=out.backlog||[];
  if(!Array.isArray(out.timetable)) out.timetable=clone(sampleState.timetable);
  out.materials.forEach(m=>{
    m.variants=m.variants||[]; m.improvementFlags=m.improvementFlags||[];
    m.variants.forEach(v=>{ if(v.fileKey===undefined) v.fileKey=null; });
  });
  out.lessons.forEach(l=>{
    if(!l.materials) l.materials=[]; if(!l.plannedSteps) l.plannedSteps=[]; if(!l.completedSteps) l.completedSteps=[];
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

function wire(){
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

render();
refreshStoredFileKeys();
