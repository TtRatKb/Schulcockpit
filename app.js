const STORAGE_KEY = 'schulcockpit-state-v1';

function clone(v){ return JSON.parse(JSON.stringify(v)); }
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
      {id:'add-standard',type:'standard',label:'Standard',available:true,fileName:'Fehlerdetektiv_Addition.pdf',printCount:21,printMode:'bw'},
      {id:'add-challenge',type:'challenge',label:'Forderung',available:true,fileName:'Fehlerdetektiv_Addition_Forderung.pdf',printCount:4,printMode:'bw'},
      {id:'add-support',type:'support',label:'Förderung',available:false},
      {id:'add-daz',type:'daz',label:'DaZ / einfache Sprache',available:false},
      {id:'add-solution',type:'solution',label:'Lösung',available:true,fileName:'Fehlerdetektiv_Addition_Loesung.pdf',printCount:1,printMode:'bw'},
    ],improvementFlags:['Mehr Rechenplatz bei Aufgabe 4']},
    {id:'mat-ah',title:'Klett Arbeitsheft Mathematik 5',kind:'book',source:'Arbeitsheft',pages:'S. 28',tasks:'Nr. 1–5',variants:[
      {id:'ah-standard',type:'standard',label:'AH S. 28',available:true},
      {id:'ah-support',type:'support',label:'Förderalternative',available:true,fileName:'Klett_Foerdermaterial_S17.pdf',printCount:3,printMode:'bw'},
    ],improvementFlags:[]},
    {id:'mat-koran',title:'Koran – Aufbau und Orientierung',kind:'file',variants:[
      {id:'koran-standard',type:'standard',label:'Standard',available:true,fileName:'Koran_Aufbau.pdf',printCount:27,printMode:'color',alreadyPrinted:true},
      {id:'koran-challenge',type:'challenge',label:'Forderung',available:false},
      {id:'koran-daz',type:'daz',label:'DaZ / einfache Sprache',available:false},
    ],improvementFlags:['DaZ-Version wäre sinnvoll']},
    {id:'mat-bibel',title:'Bibel-Rätsel',kind:'file',variants:[
      {id:'bibel-standard',type:'standard',label:'Standard',available:true,fileName:'Bibel_Raetsel.pdf',printCount:26,printMode:'color'},
    ],improvementFlags:['Layout motivierender machen']},
  ],
  lessons:[
    {id:'l1',classId:'m5a',date:dateForWeekday(1),period:'1. Block',unit:'Schriftliche Rechenverfahren',title:'Schriftliche Addition und Subtraktion vertiefen',objective:'Fehler erkennen, erklären und Rechenstrategien sicher anwenden.',status:'ready',plannedSteps:['Fachbegriffe aktivieren','Fehlerdetektiv bearbeiten','Arbeitsheft S. 28','Sicherung'],completedSteps:[],materials:['mat-addition','mat-ah']},
    {id:'l2',classId:'r8a',date:dateForWeekday(2),period:'1./2. Block',unit:'Islam',title:'Der Koran – Aufbau und Orientierung',objective:'Den Aufbau des Korans erschließen und zentrale Begriffe einordnen.',status:'planned',plannedSteps:['Rückblick Vertretungsstunde','Material erschließen','Vergleich','Sicherung'],completedSteps:['Rückblick Vertretungsstunde','Material erschließen'],materials:['mat-koran'],reflection:{mood:'okay',timing:'unfinished',learning:'partial',note:'Vertretungsmaterial wurde zuvor nicht bearbeitet. Sicherung nachholen.'}},
    {id:'l3',classId:'r5b',date:dateForWeekday(3),period:'2. Block',unit:'Die Bibel kennenlernen',title:'Orientierung in der Bibel',objective:'Die Bibel als Bibliothek kennenlernen und Informationen gezielt nachschlagen.',status:'needs-material',plannedSteps:['Verhaltensregeln','Bibel erkunden','Bibel-Rätsel','Austausch'],completedSteps:[],materials:['mat-bibel']},
    {id:'l4',classId:'r11',date:dateForWeekday(4),period:'3./4. Block',unit:'Anthropologie',title:'Menschenbilder vergleichen',objective:'Unterschiedliche Menschenbilder vergleichen und begründet positionieren.',status:'open',plannedSteps:['Kognitiver Einstieg','Materialanalyse','Vergleich','Transfer'],completedSteps:[],materials:[]},
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

function migrate(s){
  const out=s||clone(sampleState);
  out.settings=out.settings||clone(sampleState.settings);
  out.classes=out.classes||[]; out.materials=out.materials||[]; out.lessons=out.lessons||[]; out.backlog=out.backlog||[];
  if(!Array.isArray(out.timetable)) out.timetable=clone(sampleState.timetable);
  out.lessons.forEach(l=>{ if(!l.materials) l.materials=[]; if(!l.plannedSteps) l.plannedSteps=[]; if(!l.completedSteps) l.completedSteps=[]; });
  return out;
}
function loadState(){ try{return migrate(JSON.parse(localStorage.getItem(STORAGE_KEY))||clone(sampleState));}catch{return clone(sampleState);} }
function saveState(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
function persist(){ saveState(); render(); }
function cls(id){ return state.classes.find(x=>x.id===id); }
function mat(id){ return state.materials.find(x=>x.id===id); }
function lesson(id){ return state.lessons.find(x=>x.id===id); }
function esc(s=''){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDate(d){ return new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(d+'T12:00:00')); }
function daysUntil(date){ const a=new Date();a.setHours(12,0,0,0); const b=new Date(date+'T12:00:00'); return Math.round((b-a)/86400000); }
function downloadText(name,content,type='text/plain'){ const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500); }
function currentWeekLessons(){ const m=iso(mondayOf()); const f=new Date(mondayOf());f.setDate(f.getDate()+4);const fs=iso(f); return state.lessons.filter(l=>l.date>=m&&l.date<=fs).sort((a,b)=>a.date.localeCompare(b.date)||String(a.period).localeCompare(String(b.period))); }

function printItems(){
  return currentWeekLessons().flatMap(l=>l.materials.flatMap(mid=>{const m=mat(mid),c=cls(l.classId);if(!m)return[];return m.variants.filter(v=>v.available&&v.fileName&&(v.printCount||0)>0).map(v=>({lesson:l,cls:c,material:m,variant:v}));}));
}
function openPrintItems(){ return printItems().filter(i=>!i.variant.alreadyPrinted); }

function workflowTasks(){
  const lessons=currentWeekLessons(); const tasks=[];
  lessons.forEach(l=>{
    const c=cls(l.classId); const who=`${c?.subject||''} ${c?.name||''}`.trim();
    if(l.status==='open') tasks.push({id:`plan-${l.id}`,stage:1,date:l.date,type:'plan',lessonId:l.id,title:`${who}: Stunde planen`,detail:`${fmtDate(l.date)} · ${l.title||'Thema noch festlegen'}`,why:'Erst die Planung klären, damit Material und Kopierbedarf feststehen.'});
    if(l.status==='needs-material') tasks.push({id:`material-${l.id}`,stage:2,date:l.date,type:'material',lessonId:l.id,title:`${who}: fehlendes Material fertigstellen`,detail:`${fmtDate(l.date)} · ${l.title}`,why:'Die Stunde ist geplant, aber noch nicht materialbereit.'});
  });
  const openPrint=openPrintItems();
  if(openPrint.length) tasks.push({id:'print-week',stage:3,date:dateForWeekday(1),type:'print',title:`Wochenkopien erledigen`,detail:`${openPrint.length} offene Druckposition${openPrint.length===1?'':'en'} · Farbe und S/W gesammelt`,why:'Alles in einem Kopierlauf erledigen, statt morgens vor dem Unterricht.'});
  lessons.forEach(l=>{
    if(l.status==='planned'){
      const c=cls(l.classId);tasks.push({id:`final-${l.id}`,stage:4,date:l.date,type:'final',lessonId:l.id,title:`${c?.subject||''} ${c?.name||''}: Feinschliff abschließen`,detail:`${fmtDate(l.date)} · Präsentation/Details prüfen`,why:'Die Grobplanung steht; jetzt nur noch so viel fertigstellen, dass die Stunde bereit ist.'});
    }
    if(l.status==='done' && !(l.reflection&&Object.keys(l.reflection).length)){
      const c=cls(l.classId);tasks.push({id:`reflect-${l.id}`,stage:5,date:l.date,type:'reflect',lessonId:l.id,title:`${c?.subject||''} ${c?.name||''}: kurz reflektieren`,detail:'10-Sekunden-Reflexion',why:'Der tatsächliche Verlauf soll für die nächste Planung erhalten bleiben.'});
    }
  });
  return tasks.sort((a,b)=>a.stage-b.stage||a.date.localeCompare(b.date));
}
function stageLabel(stage){ return ({1:'1 · Planung klären',2:'2 · Material fertigstellen',3:'3 · Wochenkopien',4:'4 · Feinschliff',5:'5 · Reflexion'})[stage]||'Später'; }

function render(){
  const app=document.getElementById('app');
  app.innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">S</div><div><strong>Schulcockpit</strong><span>Planen · Unterrichten · Verbessern</span></div></div><nav>
    ${navBtn('focus','✓','Was jetzt?')}${navBtn('week','▦','Meine Woche')}${navBtn('timetable','◫','Stundenplan')}${navBtn('print','⎙','Kopierzentrum')}${navBtn('materials','▤','Materialien')}${navBtn('improve','✦','Verbessern')}
  </nav><div class="sidebar-footer"><button data-action="backup">Backup exportieren</button><button data-action="reset">Demo zurücksetzen</button><small>V0.2.0 · statische GitHub-Version</small></div></aside><main><header class="topbar"><div><span class="eyebrow">SCHULJAHR ${esc(state.settings.schoolYear)}</span><h1>${pageTitle()}</h1></div><div class="top-actions"><div class="week-chip">KW ${kw()}</div><button class="primary" data-action="brief-picker">ChatGPT-Brief</button></div></header>${viewHtml()}</main>${modal?modalHtml():''}</div>`;
  wire();
}
function navBtn(key,icon,label){ return `<button class="${view===key?'active':''}" data-view="${key}"><span>${icon}</span>${label}</button>`; }
function pageTitle(){ return ({focus:'Was mache ich als Nächstes?',week:'Meine Woche',timetable:'Stundenplan & Klassen',print:'Kopierzentrum',materials:'Materialbibliothek',improve:'Unterricht verbessern'})[view]; }
function viewHtml(){ return view==='focus'?focusView():view==='week'?weekView():view==='timetable'?timetableView():view==='print'?printView():view==='materials'?materialsView():improveView(); }

function focusView(){
  const tasks=workflowTasks(), next=tasks[0];
  const stages=[1,2,3,4,5];
  return `<div class="content-grid">
    <section class="focus-hero ${next?'':'all-done'}"><div><span class="eyebrow">ARBEITSMODUS · KW ${kw()}</span><h2>${next?esc(next.title):'Die Woche ist arbeitsseitig vorbereitet.'}</h2><p>${next?esc(next.why):'Keine offenen Planungsschritte, Kopieraufträge oder Reflexionen in dieser Woche.'}</p>${next?`<div class="next-meta">${esc(next.detail)}</div>`:''}</div>${next?`<button class="primary big" data-task="${next.id}">Jetzt erledigen →</button>`:'<div class="done-badge">✓</div>'}</section>
    <section class="workflow-strip">${stages.map(s=>{const count=tasks.filter(t=>t.stage===s).length;return `<div class="workflow-step ${count?'active-step':'complete-step'}"><span>${count?'•':'✓'}</span><div><strong>${stageLabel(s).replace(/^\d · /,'')}</strong><small>${count?`${count} offen`:'erledigt'}</small></div></div>`}).join('')}</section>
    <section class="panel"><div class="section-head"><div><span class="eyebrow">PRIORISIERTE REIHENFOLGE</span><h2>Einfach von oben nach unten</h2></div><span class="muted">Das Cockpit sortiert nach Arbeitslogik und Unterrichtsdatum.</span></div><div class="task-queue">${tasks.length?tasks.map((t,i)=>taskCard(t,i)).join(''):'<div class="empty-state">✓ Für diese Woche ist aktuell nichts mehr offen.</div>'}</div></section>
    <section class="tip-card"><strong>Prinzip dieser Ansicht</strong><p>Zuerst wird die Planung so weit geklärt, dass der Materialbedarf feststeht. Danach kommen fehlende Materialien, dann der gebündelte Wochen-Kopierlauf und erst anschließend der Feinschliff einzelner Stunden.</p></section>
  </div>`;
}
function taskCard(t,i){ return `<button class="task-card" data-task="${t.id}"><span class="task-number">${i+1}</span><span class="task-main"><small>${stageLabel(t.stage)}</small><strong>${esc(t.title)}</strong><span>${esc(t.detail)}</span></span><span class="task-arrow">→</span></button>`; }

function weekView(){
  const lessons=currentWeekLessons(); const ready=lessons.filter(l=>l.status==='ready').length; const open=lessons.filter(l=>!['ready','done'].includes(l.status)).length; const print=openPrintItems().length; const improve=state.backlog.filter(b=>!b.done).length; const pct=Math.round((ready/Math.max(lessons.length,1))*100);
  return `<div class="content-grid"><section class="hero-card"><div><span class="eyebrow">WOCHENÜBERBLICK</span><h2>Dein Unterricht in tatsächlicher Reihenfolge</h2><p>Die Stunden stammen aus deiner Wochenplanung. Klick eine Stunde an, um Stand, Reflexion und Material zu bearbeiten.</p></div><div class="progress-ring" style="background:radial-gradient(circle,#fff8f3 58%,transparent 60%),conic-gradient(var(--plum) 0 ${pct}%,#e7d9d7 ${pct}%);"><strong>${pct}%</strong><span>bereit</span></div></section><section class="stats-row">${stat('Unterricht bereit',ready,'vollständig vorbereitet')}${stat('Noch offen',open,'Planung oder Material')}${stat('Kopieraufträge',print,'noch nicht erledigt')}${stat('Verbesserungen',improve,'für ruhigere Zeiten')}</section><section class="panel"><div class="section-head"><div><span class="eyebrow">KW ${kw()}</span><h2>Unterricht</h2></div><button class="text-button" data-view="timetable">Stundenplan bearbeiten →</button></div><div class="lesson-list">${lessons.length?lessons.map(lessonCard).join(''):'<p class="muted">Noch keine Stunden für diese Woche. Lege zuerst deinen Stundenplan an und synchronisiere die Woche.</p>'}</div></section></div>`;
}
function stat(label,value,detail){ return `<div class="stat-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`; }
function lessonCard(l){ const c=cls(l.classId),meta=statusMeta[l.status]||statusMeta.open; const copies=l.materials.map(mat).filter(Boolean).flatMap(m=>m.variants).filter(v=>v.available&&v.fileName&&(v.printCount||0)>0); const printed=copies.filter(v=>v.alreadyPrinted).length; return `<button class="lesson-card" data-lesson="${l.id}"><div class="lesson-date"><strong>${fmtDate(l.date)}</strong><span>${esc(l.period)}</span></div><div class="class-pill" style="--class-color:${c?.color||'#999'}">${esc(c?.subject||'')} ${esc(c?.name||'')}</div><div class="lesson-main"><strong>${esc(l.title||'Thema noch festlegen')}</strong><span>${esc(l.unit||'Sequenz noch nicht eingetragen')}</span></div><div class="lesson-meta"><span class="status ${meta[1]}">${meta[0]}</span><span class="copy-mini">⎙ ${printed}/${copies.length}</span></div></button>`; }

function timetableView(){
  return `<div class="content-grid"><section class="hero-card"><div><span class="eyebrow">GRUNDGERÜST</span><h2>Einmal Stundenplan eintragen – jede Woche wiederverwenden.</h2><p>Der Stundenplan legt fest, wann welche Klasse kommt. Mit „Aktuelle Woche synchronisieren“ werden fehlende Wochenstunden automatisch angelegt, ohne bestehende Planungen zu überschreiben.</p></div><button class="primary" data-action="sync-week">Aktuelle Woche synchronisieren</button></section>
  <section class="panel"><div class="section-head"><div><span class="eyebrow">KLASSEN & FÄCHER</span><h2>Deine Lerngruppen</h2></div><span class="muted">Schülerzahl wird später für Druckmengen genutzt.</span></div><div class="class-editor">${state.classes.map(c=>`<div class="class-edit-row"><input data-class-field="${c.id}|subject" value="${esc(c.subject)}"><input data-class-field="${c.id}|name" value="${esc(c.name)}"><input class="small-input" type="number" min="1" data-class-field="${c.id}|students" value="${c.students}"><button class="danger-lite" data-delete-class="${c.id}">×</button></div>`).join('')}</div><div class="add-class-row"><input id="new-subject" placeholder="Fach, z. B. Religion"><input id="new-class" placeholder="Klasse, z. B. 7a"><input id="new-students" class="small-input" type="number" min="1" value="25"><button data-action="add-class">+ Klasse</button></div></section>
  <section class="panel"><div class="section-head"><div><span class="eyebrow">WOCHENRASTER</span><h2>Regelmäßiger Stundenplan</h2></div><span class="muted">Demo-Einträge kannst du löschen und durch deine echten Stunden ersetzen.</span></div><div class="timetable-grid">${[1,2,3,4,5].map(d=>`<div class="day-column"><div class="day-head">${dayNames[d]}</div><div class="day-slots">${state.timetable.filter(t=>t.weekday===d).sort((a,b)=>a.order-b.order).map(t=>timetableCard(t)).join('')||'<div class="empty-slot">frei / noch leer</div>'}</div></div>`).join('')}</div><div class="add-timetable-row"><select id="tt-day">${[1,2,3,4,5].map(d=>`<option value="${d}">${dayNames[d]}</option>`).join('')}</select><input id="tt-period" placeholder="z. B. 2. Block"><select id="tt-class"><option value="">Klasse wählen …</option>${state.classes.map(c=>`<option value="${c.id}">${esc(c.subject)} ${esc(c.name)}</option>`).join('')}</select><button data-action="add-timetable">+ Stunde</button></div></section></div>`;
}
function timetableCard(t){ const c=cls(t.classId); return `<div class="tt-card" style="--class-color:${c?.color||'#999'}"><strong>${esc(t.period)}</strong><span>${esc(c?.subject||'Unbekannt')} ${esc(c?.name||'')}</span><button data-delete-tt="${t.id}" title="Löschen">×</button></div>`; }

function printView(){ const items=printItems(); return `<div class="content-grid"><section class="hero-card print-hero"><div><span class="eyebrow">MONTAGS-WORKFLOW</span><h2>Einmal sammeln. Einmal kopieren.</h2><p>Bereits kopierte Materialien bleiben sichtbar, werden aber nicht erneut als offen gezählt.</p></div><button class="primary" data-action="download-print">Druckliste herunterladen</button></section>${['color','bw'].map(mode=>`<section class="panel"><div class="section-head"><div><span class="eyebrow">${mode==='color'?'FARBKOPIERER':'SCHWARZ-WEISS'}</span><h2>${mode==='color'?'Farbe':'S/W'}</h2></div></div><div class="print-list">${items.filter(i=>i.variant.printMode===mode).map(i=>`<label class="print-row ${i.variant.alreadyPrinted?'done':''}"><input type="checkbox" data-print="${i.material.id}|${i.variant.id}" ${i.variant.alreadyPrinted?'checked':''}><span class="copies">${String(i.variant.printCount).padStart(2,'0')}×</span><span class="print-content"><strong>${esc(i.material.title)} · ${esc(i.variant.label)}</strong><small>${esc(i.cls?.subject||'')} ${esc(i.cls?.name||'')} · ${fmtDate(i.lesson.date)} · ${esc(i.variant.fileName)}</small></span><span>${i.variant.alreadyPrinted?'bereits da':'offen'}</span></label>`).join('')||'<p class="muted">Keine Einträge.</p>'}</div></section>`).join('')}</div>`; }

function materialsView(){ return `<div class="content-grid"><section class="hero-card"><div><span class="eyebrow">MATERIALBIBLIOTHEK</span><h2>Nicht nur Dateien – sondern Unterrichtsressourcen.</h2><p>Standard, Forderung, Förderung, DaZ und Lösungen können gemeinsam zu einem Material gehören.</p></div></section><section class="materials-grid">${state.materials.map(materialCard).join('')}</section></div>`; }
function materialCard(m){ const types=['standard','challenge','support','daz']; return `<button class="material-card" data-material="${m.id}"><div class="material-icon">${m.kind==='book'?'▥':'▤'}</div><div><span class="eyebrow">${m.kind==='book'?'BUCH / ARBEITSHEFT':'DATEI'}</span><h3>${esc(m.title)}</h3>${m.pages?`<p>${esc(m.pages)} · ${esc(m.tasks||'')}</p>`:''}<div class="variant-strip">${types.map(t=>{const v=m.variants.find(x=>x.type===t);return `<span class="${v?.available?'available':''}">${variantLabels[t]}</span>`}).join('')}</div>${m.improvementFlags?.length?`<div class="notice">✦ ${m.improvementFlags.length} Verbesserung${m.improvementFlags.length>1?'en':''} offen</div>`:''}</div></button>`; }
function improveView(){ const open=state.backlog.filter(b=>!b.done); return `<div class="content-grid"><section class="hero-card improve-hero"><div><span class="eyebrow">QUALITÄTSENTWICKLUNG</span><h2>Ideen festhalten, ohne sie sofort erledigen zu müssen.</h2><p>Wenn später Zeit frei ist, zeigt dir das Cockpit passende kleine Verbesserungen.</p></div></section>${['10','30','60'].map(e=>`<section class="panel"><div class="section-head"><div><span class="eyebrow">ZEITFENSTER</span><h2>${e==='10'?'Bis 10 Minuten':e==='30'?'10–30 Minuten':'30–60 Minuten'}</h2></div><span class="muted">${open.filter(b=>b.effort===e).length} offen</span></div><div class="backlog-list">${state.backlog.filter(b=>b.effort===e).map(b=>`<label class="backlog-row ${b.done?'done':''}"><input type="checkbox" data-backlog="${b.id}" ${b.done?'checked':''}><span><strong>${esc(b.title)}</strong><small>${esc(b.detail)}</small></span></label>`).join('')||'<p class="muted">Keine Einträge.</p>'}</div></section>`).join('')}</div>`; }

function modalHtml(){ let title='',body=''; if(modal.type==='lesson'){const l=lesson(modal.id),c=cls(l.classId);title=`${c?.subject||''} ${c?.name||''} · ${l.title||'Stunde'}`;body=lessonPanel(l);} if(modal.type==='material'){const m=mat(modal.id);title=m.title;body=materialPanel(m);} if(modal.type==='brief'){title='ChatGPT-Brief erstellen';body=briefPicker();} return `<div class="modal-backdrop" data-action="modal-close"><section class="modal" data-modal-stop><header class="modal-header"><div><span class="eyebrow">SCHULCOCKPIT</span><h2>${esc(title)}</h2></div><button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">${body}</div></section></div>`; }
function lessonPanel(l){ const materials=l.materials.map(mat).filter(Boolean),r=l.reflection||{}; return `<div class="detail-stack"><div class="detail-summary"><div><span class="eyebrow">STUNDENZIEL</span><p>${esc(l.objective||'Noch nicht festgelegt.')}</p></div><select data-status="${l.id}">${[['open','Offen'],['planned','Geplant'],['needs-material','Material fehlt'],['ready','Bereit'],['done','Gehalten']].map(([v,t])=>`<option value="${v}" ${l.status===v?'selected':''}>${t}</option>`).join('')}</select></div>
  <section class="detail-section"><div class="lesson-edit-grid"><label>Thema<input data-lesson-field="${l.id}|title" value="${esc(l.title||'')}"></label><label>Sequenz<input data-lesson-field="${l.id}|unit" value="${esc(l.unit||'')}"></label><label class="full">Stundenziel<input data-lesson-field="${l.id}|objective" value="${esc(l.objective||'')}"></label></div><div class="quick-status-row"><button data-quick-status="${l.id}|planned">✓ Planung steht</button><button data-quick-status="${l.id}|needs-material">⚠ Material fehlt</button><button data-quick-status="${l.id}|ready">★ Stunde bereit</button><button data-quick-status="${l.id}|done">Unterricht gehalten</button></div></section>
  <section class="detail-section"><div class="section-head"><h3>Wie weit seid ihr wirklich gekommen?</h3><span class="muted">Ein Klick reicht.</span></div><div class="step-list">${l.plannedSteps.length?l.plannedSteps.map((s,i)=>`<label class="${l.completedSteps.includes(s)?'checked':''}"><input type="checkbox" data-step="${l.id}|${i}" ${l.completedSteps.includes(s)?'checked':''}><span>${esc(s)}</span></label>`).join(''):'<p class="muted">Noch kein Ablauf hinterlegt. Das kann später aus dem ChatGPT-Import kommen.</p>'}</div></section>
  <section class="detail-section"><h3>10-Sekunden-Reflexion</h3><div class="reflection-grid">${quickChoice('Wie lief\'s?','mood',l.id,[['great','😄 sehr gut'],['good','🙂 gut'],['okay','😐 okay'],['hard','😬 schwierig']],r.mood)}${quickChoice('Zeitplanung','timing',l.id,[['fits','✓ passend'],['too-much','⏩ zu viel'],['too-little','⏱ zu wenig'],['unfinished','↪ nicht fertig']],r.timing)}${quickChoice('Lernstand','learning',l.id,[['understood','✓ verstanden'],['partial','~ teilweise'],['difficult','⚠ schwierig'],['too-easy','🚀 zu leicht']],r.learning)}</div><textarea data-note="${l.id}" placeholder="Optionale Notiz …">${esc(r.note||'')}</textarea></section>
  <section class="detail-section"><div class="section-head"><h3>Materialien</h3><span class="muted">Varianten & Kopierstatus</span></div><div class="linked-materials">${materials.map(m=>`<button data-material="${m.id}"><strong>${esc(m.title)}</strong><span>${m.variants.filter(v=>v.available).map(v=>esc(v.label)).join(' · ')}</span></button>`).join('')||'<p class="muted">Keine Materialien verknüpft.</p>'}</div></section><button class="primary wide" data-action="brief-download" data-id="${l.id}">ChatGPT-Brief für diese Stunde herunterladen</button></div>`; }
function quickChoice(title,key,lid,options,value){ return `<div><span class="field-label">${title}</span><div class="choice-row">${options.map(([v,t])=>`<button class="${value===v?'selected':''}" data-reflection="${lid}|${key}|${v}">${t}</button>`).join('')}</div></div>`; }
function materialPanel(m){ const missing=['challenge','support','daz','solution'].filter(t=>!m.variants.some(v=>v.type===t)); return `<div class="detail-stack"><section class="detail-section"><span class="eyebrow">VARIANTEN</span><div class="variant-list">${m.variants.map(v=>`<div class="variant-row"><button class="availability-dot ${v.available?'on':''}" data-variant-toggle="${m.id}|${v.id}">${v.available?'✓':'+'}</button><div><strong>${esc(v.label)}</strong><small>${esc(v.fileName||(v.available?'als Ressource hinterlegt':'noch nicht vorhanden'))}</small></div><span class="${v.available?'tag good':'tag'}">${v.available?'vorhanden':'offen'}</span></div>`).join('')}</div><div class="add-variant-row">${missing.map(t=>`<button data-add-variant="${m.id}|${t}">+ ${variantLabels[t]}</button>`).join('')}</div></section><section class="detail-section"><h3>Schnell markieren: fürs nächste Mal verbessern</h3><div class="improvement-buttons">${['Fehler enthalten','zu schwer','zu leicht','mehr Schreibplatz','unübersichtlich','nicht motivierend','Aufgabe unklar','Lösung ergänzen','Differenzierung fehlt'].map(t=>`<button data-improve="${m.id}|${encodeURIComponent(t)}">${t}</button>`).join('')}</div><div class="custom-improvement"><input id="custom-improve" placeholder="Eigene Notiz …"><button data-action="custom-improve" data-id="${m.id}">Hinzufügen</button></div></section><section class="detail-section"><h3>Offene Hinweise</h3>${m.improvementFlags?.length?`<ul class="notes-list">${m.improvementFlags.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:'<p class="muted">Keine offenen Hinweise.</p>'}</section></div>`; }
function briefPicker(){ return `<div class="brief-list"><p class="muted">Wähle die Stunde, deren aktuellen Stand du für ChatGPT exportieren möchtest.</p>${currentWeekLessons().map(l=>{const c=cls(l.classId);return `<button class="brief-row" data-action="brief-download" data-id="${l.id}"><span><strong>${esc(c?.subject||'')} ${esc(c?.name||'')}</strong><small>${esc(l.title||'Thema noch festlegen')}</small></span><span>↓ .md</span></button>`}).join('')}</div>`; }
function makeBrief(l){ const c=cls(l.classId),materials=l.materials.map(mat).filter(Boolean),r=l.reflection||{}; return `# Schulcockpit – ChatGPT-Brief\n\n## Klasse\n${c?.subject||''} ${c?.name||''} · ${c?.students||'?'} Schüler:innen\n\n## Sequenz\n${l.unit||'noch nicht eingetragen'}\n\n## Nächste / aktuelle Stunde\n${l.title||'noch festzulegen'}\nZiel: ${l.objective||'noch nicht festgelegt'}\nDatum: ${l.date}\n\n## Geplanter Verlauf\n${l.plannedSteps.length?l.plannedSteps.map((s,i)=>`${i+1}. ${s}`).join('\n'):'- noch nicht hinterlegt'}\n\n## Tatsächlich bereits geschafft\n${l.completedSteps.length?l.completedSteps.map(s=>`- ${s}`).join('\n'):'- noch keine Angaben'}\n\n## Reflexion / letzter Stand\n- Stimmung: ${r.mood||'nicht angegeben'}\n- Zeit: ${r.timing||'nicht angegeben'}\n- Lernstand: ${r.learning||'nicht angegeben'}\n- Notiz: ${r.note||'keine'}\n\n## Materialien\n${materials.length?materials.map(m=>`- ${m.title}${m.pages?` · ${m.pages}`:''}${m.tasks?` · ${m.tasks}`:''}\n  Varianten: ${m.variants.map(v=>`${v.label}: ${v.available?'vorhanden':'fehlt'}`).join(', ')}\n  Überarbeitung: ${m.improvementFlags?.length?m.improvementFlags.join('; '):'keine offenen Hinweise'}`).join('\n'):'- noch keine Materialien verknüpft'}\n\n## Auftrag an ChatGPT\nPlane die nächste sinnvolle Unterrichtsstunde auf Grundlage des tatsächlichen Lernstands. Verwende vorhandenes Material bevorzugt. Gib einen klaren Verlauf, konkrete Folieninhalte, Arbeitsaufträge, benötigte Materialien und ggf. sinnvolle Differenzierung aus. Berücksichtige, welche Materialien bereits vorhanden bzw. bereits kopiert sind.\n`; }

function syncWeek(){
  let added=0;
  state.timetable.forEach(t=>{
    const date=dateForWeekday(t.weekday); const exists=state.lessons.some(l=>l.date===date&&l.classId===t.classId&&l.period===t.period);
    if(!exists){state.lessons.push({id:`lesson-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,classId:t.classId,date,period:t.period,unit:'',title:'Thema noch festlegen',objective:'',status:'open',plannedSteps:[],completedSteps:[],materials:[]});added++;}
  });
  saveState(); alert(added?`${added} fehlende Wochenstunde${added===1?'':'n'} angelegt.`:'Die aktuelle Woche ist bereits vollständig synchronisiert.'); render();
}
function handleTask(id){ const t=workflowTasks().find(x=>x.id===id); if(!t)return; if(t.type==='print'){view='print';render();return;} if(t.lessonId){modal={type:'lesson',id:t.lessonId};render();} }
function addImprovement(mid,detail){ const m=mat(mid);m.improvementFlags=m.improvementFlags||[];if(!m.improvementFlags.includes(detail))m.improvementFlags.push(detail);state.backlog.push({id:`backlog-${Date.now()}`,materialId:mid,title:m.title,detail,effort:'30',done:false});saveState();modal={type:'material',id:mid};render(); }

function wire(){
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;modal=null;render();});
  document.querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>handleTask(b.dataset.task));
  document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>{modal={type:'lesson',id:b.dataset.lesson};render();});
  document.querySelectorAll('[data-material]').forEach(b=>b.onclick=e=>{e.stopPropagation();modal={type:'material',id:b.dataset.material};render();});
  document.querySelectorAll('[data-action="modal-close"]').forEach(b=>b.onclick=e=>{if(e.target.closest('[data-modal-stop]'))return;modal=null;render();});
  document.querySelectorAll('[data-modal-stop]').forEach(x=>x.onclick=e=>e.stopPropagation());
  document.querySelector('[data-action="backup"]')?.addEventListener('click',()=>downloadText('schulcockpit-backup.json',JSON.stringify(state,null,2),'application/json'));
  document.querySelector('[data-action="reset"]')?.addEventListener('click',()=>{if(confirm('Demo-Daten wirklich zurücksetzen?')){localStorage.removeItem(STORAGE_KEY);state=clone(sampleState);render();}});
  document.querySelector('[data-action="brief-picker"]')?.addEventListener('click',()=>{modal={type:'brief'};render();});
  document.querySelector('[data-action="sync-week"]')?.addEventListener('click',syncWeek);
  document.querySelector('[data-action="add-class"]')?.addEventListener('click',()=>{const subject=document.getElementById('new-subject').value.trim(),name=document.getElementById('new-class').value.trim(),students=Number(document.getElementById('new-students').value)||25;if(!subject||!name)return alert('Bitte Fach und Klasse eintragen.');state.classes.push({id:`class-${Date.now()}`,subject,name,students,color:['#6d5f9b','#b86f8b','#557b78','#8b684c','#8a6b88'][state.classes.length%5]});persist();});
  document.querySelectorAll('[data-class-field]').forEach(i=>i.onchange=()=>{const [id,key]=i.dataset.classField.split('|');const c=cls(id);c[key]=key==='students'?Number(i.value)||1:i.value;saveState();});
  document.querySelectorAll('[data-delete-class]').forEach(b=>b.onclick=()=>{const id=b.dataset.deleteClass;if(state.timetable.some(t=>t.classId===id)||state.lessons.some(l=>l.classId===id))return alert('Diese Klasse wird noch im Stundenplan oder in Unterrichtsstunden verwendet. Lösche dort zuerst die Verknüpfungen.');state.classes=state.classes.filter(c=>c.id!==id);persist();});
  document.querySelector('[data-action="add-timetable"]')?.addEventListener('click',()=>{const weekday=Number(document.getElementById('tt-day').value),period=document.getElementById('tt-period').value.trim(),classId=document.getElementById('tt-class').value;if(!period||!classId)return alert('Bitte Block/Stunde und Klasse auswählen.');const order=state.timetable.filter(t=>t.weekday===weekday).length+1;state.timetable.push({id:`tt-${Date.now()}`,weekday,period,classId,order});persist();});
  document.querySelectorAll('[data-delete-tt]').forEach(b=>b.onclick=()=>{state.timetable=state.timetable.filter(t=>t.id!==b.dataset.deleteTt);persist();});
  document.querySelector('[data-action="download-print"]')?.addEventListener('click',()=>{const text=openPrintItems().map(i=>`${i.variant.printCount}x · ${i.variant.printMode==='color'?'FARBE':'S/W'} · ${i.cls?.subject||''} ${i.cls?.name||''} · ${i.material.title} · ${i.variant.label} · ${i.variant.fileName}`).join('\n');downloadText(`KW${kw()}_Druckliste.txt`,text||'Keine offenen Druckaufträge.');});
  document.querySelectorAll('[data-print]').forEach(x=>x.onchange=()=>{const [mid,vid]=x.dataset.print.split('|'),v=mat(mid).variants.find(v=>v.id===vid);v.alreadyPrinted=x.checked;persist();});
  document.querySelectorAll('[data-backlog]').forEach(x=>x.onchange=()=>{const b=state.backlog.find(b=>b.id===x.dataset.backlog);b.done=x.checked;persist();});
  document.querySelectorAll('[data-status]').forEach(x=>x.onchange=()=>{lesson(x.dataset.status).status=x.value;saveState();modal={type:'lesson',id:x.dataset.status};render();});
  document.querySelectorAll('[data-quick-status]').forEach(b=>b.onclick=()=>{const [lid,status]=b.dataset.quickStatus.split('|');lesson(lid).status=status;saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-lesson-field]').forEach(i=>i.onchange=()=>{const [lid,key]=i.dataset.lessonField.split('|');lesson(lid)[key]=i.value;saveState();});
  document.querySelectorAll('[data-step]').forEach(x=>x.onchange=()=>{const [lid,idx]=x.dataset.step.split('|'),l=lesson(lid),s=l.plannedSteps[Number(idx)];l.completedSteps=x.checked?[...new Set([...l.completedSteps,s])]:l.completedSteps.filter(y=>y!==s);saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-reflection]').forEach(b=>b.onclick=()=>{const [lid,key,val]=b.dataset.reflection.split('|'),l=lesson(lid);l.reflection=l.reflection||{};l.reflection[key]=val;saveState();modal={type:'lesson',id:lid};render();});
  document.querySelectorAll('[data-note]').forEach(t=>t.onchange=()=>{const l=lesson(t.dataset.note);l.reflection=l.reflection||{};l.reflection.note=t.value;saveState();});
  document.querySelectorAll('[data-action="brief-download"]').forEach(b=>b.onclick=()=>{const l=lesson(b.dataset.id),c=cls(l.classId);downloadText(`${l.date}_${c?.name||'Klasse'}_ChatGPT-Brief.md`,makeBrief(l));});
  document.querySelectorAll('[data-variant-toggle]').forEach(b=>b.onclick=()=>{const [mid,vid]=b.dataset.variantToggle.split('|'),v=mat(mid).variants.find(v=>v.id===vid);v.available=!v.available;saveState();modal={type:'material',id:mid};render();});
  document.querySelectorAll('[data-add-variant]').forEach(b=>b.onclick=()=>{const [mid,type]=b.dataset.addVariant.split('|');mat(mid).variants.push({id:`${mid}-${type}-${Date.now()}`,type,label:variantLabels[type],available:false});saveState();modal={type:'material',id:mid};render();});
  document.querySelectorAll('[data-improve]').forEach(b=>b.onclick=()=>{const [mid,enc]=b.dataset.improve.split('|');addImprovement(mid,decodeURIComponent(enc));});
  document.querySelector('[data-action="custom-improve"]')?.addEventListener('click',e=>{const input=document.getElementById('custom-improve'),val=input.value.trim();if(val)addImprovement(e.currentTarget.dataset.id,val);});
}

render();
