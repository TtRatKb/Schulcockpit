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
  sequences:[
    {id:'seq-m5-rechnen',classId:'m5a',title:'Schriftliche Rechenverfahren',startDate:'2026-09-14',endDate:'2026-10-09',goal:'Schriftliche Addition und Subtraktion sicher anwenden, Fehler erklären und Strategien reflektieren.',assessmentDate:'',notes:''},
    {id:'seq-r5-bibel',classId:'r5b',title:'Die Bibel kennenlernen',startDate:'2026-09-14',endDate:'2026-10-09',goal:'Aufbau, Entstehung und Orientierung in der Bibel kennenlernen.',assessmentDate:'',notes:''},
    {id:'seq-r8-islam',classId:'r8a',title:'Islam',startDate:'2026-09-01',endDate:'2026-10-08',goal:'Grundlagen des Islam erschließen und zentrale religiöse Praxis sachgerecht einordnen.',assessmentDate:'2026-10-08',notes:'Klassenarbeit am Ende der Einheit.'},
    {id:'seq-r11-anthro',classId:'r11',title:'Anthropologie',startDate:'2026-09-01',endDate:'2026-10-23',goal:'Menschenbilder erschließen, vergleichen und reflektieren.',assessmentDate:'',notes:''},
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
    l.slides=l.slides.map(sl=>({id:sl.id||uid('slide'),type:sl.type||'Inhalt',title:sl.title||'',content:Array.isArray(sl.content)?sl.content:(sl.content?[String(sl.content)]:[]),notes:sl.notes||''}));
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
  const slides=cleanArray(x.slides,40).map(sl=>({type:cleanString(sl.type||'Inhalt',80),title:cleanString(sl.title,500),content:cleanArray(sl.content||sl.bullets,20).map(v=>cleanString(v,1000)).filter(Boolean),notes:cleanString(sl.notes||'',2000)})).filter(sl=>sl.title||sl.content.length||sl.notes);
  const materials=cleanArray(x.materials,30).map(it=>({title:cleanString(it.title,400),kind:it.kind==='book'?'book':'file',source:cleanString(it.source||'',300),pages:cleanString(it.pages||'',120),tasks:cleanString(it.tasks||'',300),variant:allowedVariants.has(it.variant)?it.variant:'standard',copies:Math.max(0,Math.min(200,Number(it.copies)||0)),printMode:it.printMode==='color'?'color':it.printMode==='none'?'none':'bw',alreadyPrinted:!!it.alreadyPrinted,note:cleanString(it.note||'',1000)})).filter(it=>it.title);
  const prepTasks=cleanArray(x.prepTasks||x.todos,30).map(t=>({title:cleanString(t.title||t.task,500),category:cleanString(t.category||'Vorbereitung',120),note:cleanString(t.note||'',1000)})).filter(t=>t.title);
  return {schema:cleanString(x.schema||'schulcockpit.lesson.v1',100),lesson:{title:cleanString(lessonData.title||'',500),objective:cleanString(lessonData.objective||'',1500)},phases,slides,materials,prepTasks};
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
  if(opts.lesson){ if(pkg.lesson.title)l.title=pkg.lesson.title; if(pkg.lesson.objective)l.objective=pkg.lesson.objective; }
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
