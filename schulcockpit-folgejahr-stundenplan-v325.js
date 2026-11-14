/* Schulcockpit V0.32.5 – separate timetable editor for future school years.
 * No write to live state.timetable until separately confirmed year activation.
 */
(function(){
'use strict';
const C=window.SchulcockpitFutureTimetableCoreV325;
if(!C)throw Error('Folgejahr-Stundenplan: Kernmodul fehlt.');
const DAYS=['','Montag','Dienstag','Mittwoch','Donnerstag','Freitag'];
let draft=null,year='',saving=false,counter=0;
function plannedYear(){
 const current=v190NormYear(state.settings?.schoolYear||'2026/27');
 const p=v190NormYear(state.settings?.sequencePlanningYearV190||'');
 return C.validYear(p)&&p>current?p:C.next(current);
}
function open(y=''){
 const current=v190NormYear(state.settings.schoolYear),target=C.validYear(y)&&y>current?y:plannedYear();
 year=target;draft=C.newDraft(state,target);
 view='futureTimetableV325';modal=null;render();
}
function courses(){
 return [...C.targetCourses(state,year).map(c=>({id:c.id,subject:c.subject,name:c.name,stored:true})),
 ...(draft?.newCourses||[]).map(c=>({id:c.key,subject:c.subject,name:c.name,stored:false}))];
}
function courseName(id){
 const c=courses().find(x=>x.id===id);return c?(c.subject+' '+c.name):'Unbekannter Fachkurs';
}
function validState(){return C.check(state,draft,v190NormYear(state.settings?.schoolYear||''));}
function currentRow(day,slot){
 return (draft.entries||[]).find(x=>Number(x.weekday)===day&&Number(x.slot)===slot)||null;
}
function gridHtml(){
 const courseOptions='<option value="">— frei —</option>'+courses().map(c=>
   '<option value="'+esc(c.id)+'">'+esc(c.subject)+' · '+esc(c.name)+'</option>').join('');
 return '<div class="v325-scroll"><div class="v325-grid"><div class="v325-corner">Block</div>'+
  DAYS.slice(1).map(x=>'<div class="v325-day">'+x+'</div>').join('')+
  draft.periods.map((period,slot)=>{
   const label='<div class="v325-period"><label><small>Block '+slot+'</small>'+
    '<input type="text" data-v325-period="'+slot+'" maxlength="90" value="'+esc(period)+'"></label></div>';
   const cells=DAYS.slice(1).map((d,index)=>{
    const dow=index+1,row=currentRow(dow,slot);
    const val=row?.classId||'';
    const options=courseOptions.replace('value="'+esc(val)+'"','value="'+esc(val)+'" selected');
    return '<div class="v325-cell"><select aria-label="'+d+', Block '+slot+
     '" data-v325-cell="'+dow+'|'+slot+'">'+options+'</select></div>';
   }).join('');
   return label+cells;
  }).join('')+'</div></div>';
}
function page(){
 if(!draft)draft=C.newDraft(state,plannedYear());
 const active=v190NormYear(state.settings.schoolYear),report=validState(),
  stored=state.schoolYearTimetablesV325?.[year],b=v190YearBounds(year),
  canActivate=C.next(active)===year&&iso(new Date())>=b.start,
  scheduled=stored?.entries?.length||0;
 const courseList=courses().map(c=>'<div class="v325-course"><strong>'+esc(c.subject)+' '+esc(c.name)+'</strong>'+
   '<small>'+draft.entries.filter(x=>x.classId===c.id).length+' Wochenstunden'+(c.stored?'':' · wird erst beim Speichern angelegt')+'</small></div>').join('');
 const readyText=stored?scheduled+' Stundenplanfelder gespeichert':'Noch kein Stundenplan für dieses Schuljahr gespeichert';
 return '<div class="content-grid v325-view">'+
  '<section class="panel v325-hero"><button class="text-button" type="button" data-v325-back>← Zur Jahresplanung</button>'+
  '<span class="eyebrow">ZUKÜNFTIGER STUNDENPLAN · OHNE ALTEN UNTERRICHT ZU VERÄNDERN</span>'+
  '<h2>Stundenplan für '+esc(year)+'</h2>'+
  '<p>Ordne deine neuen Fachkurse den Wochentagen und Blöcken zu. Alle Änderungen bleiben zunächst ein Entwurf. '+
  '<strong>Der aktuelle Stundenplan für '+esc(active)+' wird nicht verändert.</strong></p>'+
  '<div class="v325-status">'+esc(readyText)+' · '+report.entriesCount+' Felder im aktuellen Entwurf</div></section>'+
  '<section class="panel v325-courses"><div class="section-head"><div><span class="eyebrow">FACHKURSE IM FOLGEJAHR</span>'+
  '<h3>Welche Lerngruppen unterrichtest du?</h3></div></div>'+
  '<div class="v325-course-list">'+(courseList||'<p>Noch keine Fachkurse für dieses Schuljahr. Du kannst hier einen hinzufügen.</p>')+'</div>'+
  '<div class="v325-new-course"><label>Fach<input id="v325-new-subject" placeholder="z. B. Mathematik"></label>'+
  '<label>Klasse / Kurs<input id="v325-new-name" placeholder="z. B. 6b"></label>'+
  '<button class="secondary" type="button" data-v325-add>+ Fachkurs hinzufügen</button></div>'+
  '<p class="microcopy">Keine Schülerlisten und keine Noten. Neue Kurse werden mit Schülerzahl 0 angelegt; diese kannst du später selbst ergänzen.</p></section>'+
  '<section class="panel"><div class="section-head"><div><span class="eyebrow">WOCHENRHYTHMUS · '+esc(year)+'</span>'+
  '<h3>Wann findet welcher Unterricht statt?</h3></div>'+
  '<button class="secondary" type="button" data-v325-suggest>Vorjahres-Rhythmus als Vorschlag</button></div>'+
  '<p>Die Zuordnung aus dem alten Jahr wird <strong>nur auf deinen ausdrücklichen Klick</strong> vorgeschlagen. '+
  'Du kannst alle Zellen danach ändern. Doppelbelegungen werden vermieden.</p>'+
  gridHtml()+
  '<div class="v325-period-actions"><button class="text-button" type="button" data-v325-add-period>+ Block hinzufügen</button>'+
  '<button class="text-button" type="button" data-v325-remove-period>Letzten leeren Block entfernen</button></div></section>'+
  '<section class="panel v325-review"><div class="section-head"><div><span class="eyebrow">PRÜFEN & SPEICHERN</span>'+
  '<h3>Dein neuer Wochenplan</h3></div></div>'+
  '<div class="v325-facts"><span><strong>'+report.entriesCount+'</strong> Wochenstunden</span>'+
  '<span><strong>'+courses().length+'</strong> Fachkurse</span>'+
  '<span><strong>'+report.errors.length+'</strong> Fehler</span></div>'+
  (report.errors.length?'<div class="v325-errors" role="alert">'+report.errors.map(x=>'<p>⚠ '+esc(x)+'</p>').join('')+'</div>':'')+
  (report.warnings.length?'<details><summary>Hinweise ('+report.warnings.length+')</summary><ul>'+
  report.warnings.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></details>':'')+
  '<div class="v325-actions"><button class="primary" type="button" data-v325-save '+(report.errors.length?'disabled':'')+
  '>Stundenplan für '+esc(year)+' speichern</button>'+
  '<button class="secondary" type="button" data-v325-dates '+(!scheduled?'disabled':'')+
  '>Reihentermine aus gespeichertem Stundenplan berechnen</button></div>'+
  '<p class="microcopy">Das Speichern legt keine Unterrichtsstunden an. Die Berechnung von Reihenterminen erfolgt separat auf deinen Klick und berücksichtigt den Schulkalender und bereits eingetragene Prüfungen.</p></section>'+
  (C.next(active)===year?'<section class="panel v325-activation"><div>'+
   '<span class="eyebrow">ERST ZUM SCHULJAHRESBEGINN</span><h3>'+esc(year)+' als aktives Schuljahr starten</h3>'+
   '<p>Das ist ein <strong>separater Schritt</strong>: Der laufende Stundenplan wird für das alte Jahr archiviert und '+
   'der vorbereitete neue Plan wird zum aktiven Stundenplan. Alte Unterrichtsdaten und Materialdateien bleiben bestehen.</p>'+
   (!canActivate?'<p class="microcopy">Verfügbar ab '+esc(fmtDate(b.start))+'. Bis dahin kannst du in Ruhe alles vorbereiten.</p>':'')+
   '<p class="microcopy">Klassengruppen-/GA-Zeiten aus dem Vorjahr werden nicht ungefragt übernommen. '+
   'Bitte nach der Aktivierung gegebenenfalls separat im normalen Stundenplan eintragen.</p></div>'+
   '<button class="secondary" type="button" data-v325-activate '+(!canActivate||!scheduled?'disabled':'')+
   '>Neues Schuljahr ausdrücklich aktivieren</button></section>':'')+
  '</div>';
}
function setCell(day,slot,id){
 const key=day+'|'+slot;
 draft.entries=(draft.entries||[]).filter(x=>Number(x.weekday)+'|'+Number(x.slot)!==key);
 if(id)draft.entries.push({weekday:day,slot,classId:id,period:draft.periods[slot],kind:'course'});
 render();
}
function addCourse(){
 const subject=document.getElementById('v325-new-subject')?.value.trim()||'',
  name=document.getElementById('v325-new-name')?.value.trim()||'';
 if(!subject||!name)return alert('Bitte Fach und Kursnamen eintragen.');
 counter++;draft.newCourses.push({key:'new:planned'+counter,subject,name});
 render();
}
function suggest(){
 if(draft.entries.length&&!confirm('Aktuelle Eingaben durch den Vorjahres-Rhythmus als Vorschlag ersetzen?'))return;
 const r=C.suggest(state,draft,state.timetable||[]);
 if(!r.entries.length){
  alert('Keine eindeutig zuordenbaren Vorjahresstunden gefunden. Trage die neue Woche direkt im Raster ein.');return;
 }
 draft.entries=r.entries;
 render();
 if(r.ambiguous.length||r.conflicts.length)alert('Vorschlag übernommen. Nicht eindeutig zuordenbare Kurse oder belegte Felder wurden ausgelassen. Bitte den Stundenplan prüfen.');
}
function save(){
 if(saving)return Promise.resolve(false);
 const cfg=structuredClone(draft),report=C.check(state,cfg,v190NormYear(state.settings.schoolYear));
 if(report.errors.length)throw Error(report.errors.join('\n'));
 saving=true;
 const old={classes:state.classes,timetables:state.schoolYearTimetablesV325};
 return Promise.resolve().then(async()=>{
  const result=C.prepare(state,cfg,uid);
  state.classes=result.classes;state.schoolYearTimetablesV325=result.timetables;
  await Promise.resolve(saveState());
  draft=C.newDraft(state,cfg.year);
  render();
  return result;
 }).catch(err=>{
  state.classes=old.classes;
  if(old.timetables===undefined)delete state.schoolYearTimetablesV325;
  else state.schoolYearTimetablesV325=old.timetables;
  render();
  throw err;
 }).finally(()=>{saving=false;});
}
const oldSlots=v190CourseSlots;
v190CourseSlots=function(cid,y=v190PlanningYear()){
 const normalized=v190NormYear(y),active=v190NormYear(state.settings.schoolYear),
  stored=state.schoolYearTimetablesV325?.[normalized];
 if(stored&&normalized!==active){
  const bounds=v190YearBounds(normalized),
   exams=(state.assessments||[]).filter(x=>x.classId===cid&&v190YearFromDate(x.date)===normalized).map(x=>x.date);
  return C.schedule(normalized,stored.entries||[],cid,bounds,v190NoSchoolInfo,exams);
 }
 return oldSlots(cid,normalized);
};
async function dateAll(){
 const stored=state.schoolYearTimetablesV325?.[year];
 if(!stored?.entries?.length)throw Error('Bitte zuerst den Stundenplan speichern.');
 if(!v190OfficialComplete(year)&&!confirm('Für dieses Schuljahr fehlen noch vollständige amtliche Ferientermine. Ohne diese können falsche Daten entstehen. Trotzdem fortfahren?'))return;
 const ids=[...new Set(stored.entries.filter(x=>x.classId).map(x=>x.classId))]
   .filter(id=>v190PlanningSequences(id,year).length);
 if(!ids.length)throw Error('Keine Reihen für diese Kurse im Folgejahr vorhanden. Bitte zuerst die Reihen übernehmen.');
 if(!confirm('Die Sollstunden für '+ids.length+' Fachkurs(e) anhand des gespeicherten Stundenplans und des Schulkalenders auf Termine verteilen?\n\n'+
  'Bereits gehaltene Stunden bleiben geschützt. Die Termine der neuen, noch nicht gehaltenen Reihen können sich ändern.'))return;
 const before={sequences:structuredClone(state.sequences),lessons:structuredClone(state.lessons)};
 try{
  const messages=[],counts=[];
  for(const cid of ids){
   const result=v190RescheduleCourseYear(cid,year,true);
   if(result.warning)messages.push(courseName(cid)+': '+result.warning);
   counts.push(result.changed);
  }
  await Promise.resolve(saveState());
  view='sequences';state.settings.sequencePlanningYearV190=year;
  await Promise.resolve(saveState());render();
  alert('Reihentermine für '+ids.length+' Fachkurs(e) berechnet ('+
   counts.reduce((n,v)=>n+v,0)+' neu datierte Sollstunden).'+
   (messages.length?'\n\nBitte prüfen:\n'+messages.join('\n'):''));
 }catch(err){
  state.sequences=before.sequences;state.lessons=before.lessons;
  render();throw err;
 }
}
async function activate(){
 const active=v190NormYear(state.settings.schoolYear),bounds=v190YearBounds(year),
  now=iso(new Date());
 const prepared=C.activation(state,year,bounds,now);
 if(!confirm('Das Schuljahr '+year+' JETZT aktivieren?\n\nDer aktuelle Stundenplan von '+active+
  ' wird als Archiv gesichert. Die Wochenansicht verwendet anschließend den NEUEN Stundenplan. '+
  'Alle alten Stunden, Klassenarbeiten und Materialien bleiben erhalten.'))return;
 if(!confirm('Letzte Bestätigung: Der aktive Stundenplan wird auf '+year+
  ' umgestellt. Bitte vorher eine vollständige Datensicherung erstellen. Fortfahren?'))return;
 const old={timetable:state.timetable,periods:state.settings.periods,
  schoolYear:state.settings.schoolYear,planningYear:state.settings.sequencePlanningYearV190,
  week:state.settings.activeWeekStart,timetables:state.schoolYearTimetablesV325};
 try{
  state.schoolYearTimetablesV325=prepared.timetables;
  state.timetable=prepared.timetable;state.settings.periods=prepared.periods;
  state.settings.schoolYear=prepared.activeYear;state.settings.sequencePlanningYearV190=prepared.planYear;
  state.settings.activeWeekStart=prepared.week;
  await Promise.resolve(saveState());
  view='sequences';render();
  alert(year+' ist jetzt das aktive Schuljahr. Der bisherige Stundenplan bleibt archiviert; alte Stunden und Noten wurden nicht verändert.');
 }catch(err){
  state.timetable=old.timetable;state.settings.periods=old.periods;
  state.settings.schoolYear=old.schoolYear;state.settings.sequencePlanningYearV190=old.planningYear;
  state.settings.activeWeekStart=old.week;
  state.schoolYearTimetablesV325=old.timetables;
  render();throw err;
 }
}
function goBack(){view='sequences';modal=null;render();}
const oldView=viewHtml;
viewHtml=function(){
 if(view==='futureTimetableV325')return page();
 let html=oldView();
 if(view!=='sequences')return html;
 html=html.replace('<div class="v190-year-actions">','<div class="v190-year-actions">'+
  '<button type="button" class="secondary" data-v325-open>⌗ Stundenplan fürs Folgejahr</button>');
 const y=v190PlanningYear(),stored=state.schoolYearTimetablesV325?.[y];
 if(stored?.entries?.length&&v190NormYear(state.settings.schoolYear)!==y){
  // Keep the old planner and calendar semantics; change only stale button copy.
  html=html.replace(/(<button[^>]*data-v190-reschedule="([^"]+)"[^>]*>)Reihenfolge speichern(<\/button>)/g,
   (full,open,id,close)=>stored.entries.some(x=>x.classId===id)?open+'Termine neu berechnen'+close:full);
  html=html.replace('Reihenfolge ohne automatische Datierung','Eigener Wochenrhythmus gespeichert');
 }
 return html;
};
const oldTitle=pageTitle;
pageTitle=function(){return view==='futureTimetableV325'?'Folgejahres-Stundenplan':oldTitle();};
const oldWire=wire;
wire=function(){
 oldWire();
 document.querySelector('[data-v325-open]')?.addEventListener('click',()=>open());
 if(view!=='futureTimetableV325')return;
 document.querySelector('[data-v325-back]')?.addEventListener('click',goBack);
 document.querySelector('[data-v325-add]')?.addEventListener('click',addCourse);
 document.querySelector('[data-v325-suggest]')?.addEventListener('click',suggest);
 document.querySelectorAll('[data-v325-cell]').forEach(s=>s.addEventListener('change',()=>{
  const [d,p]=s.dataset.v325Cell.split('|').map(Number);setCell(d,p,s.value);
 }));
 document.querySelectorAll('[data-v325-period]').forEach(s=>s.addEventListener('input',()=>{
  draft.periods[Number(s.dataset.v325Period)]=s.value;
 }));
 document.querySelector('[data-v325-add-period]')?.addEventListener('click',()=>{
  if(draft.periods.length>=16)return alert('Es sind bereits 16 Blöcke hinterlegt.');
  draft.periods.push(draft.periods.length+'. Block');render();
 });
 document.querySelector('[data-v325-remove-period]')?.addEventListener('click',()=>{
  if(draft.periods.length<=1)return;
  const last=draft.periods.length-1;
  if(draft.entries.some(x=>Number(x.slot)===last))
   return alert('In diesem Block stehen noch Stunden. Leere zuerst diese Zellen.');
  draft.periods.pop();render();
 });
 document.querySelector('[data-v325-save]')?.addEventListener('click',e=>{
  const b=e.currentTarget;b.disabled=true;
  void save().then(result=>{
   if(result)alert('Stundenplan für '+result.year+' gespeichert. Der laufende Unterrichtsplan bleibt unverändert.');
  }).catch(err=>alert('Speichern abgebrochen: '+(err.message||err)))
   .finally(()=>{if(b.isConnected)b.disabled=false;});
 });
 document.querySelector('[data-v325-dates]')?.addEventListener('click',e=>{
  const b=e.currentTarget;b.disabled=true;
  void dateAll().catch(err=>alert('Terminplanung: '+(err.message||err))).finally(()=>{if(b.isConnected)b.disabled=false;});
 });
 document.querySelector('[data-v325-activate]')?.addEventListener('click',e=>{
  const b=e.currentTarget;b.disabled=true;
  void activate().catch(err=>alert('Aktivierung abgebrochen: '+(err.message||err)))
   .finally(()=>{if(b.isConnected)b.disabled=false;});
 });
};
const oldRender=render;
render=function(){
 oldRender();
 const badge=document.querySelector('.brand small');
 if(badge)badge.textContent=(state.settings?.schoolYear||'')+' · V0.32.5';
};
window.SchulcockpitFutureTimetableV325={open,draft:()=>draft,check:validState,save,dateAll,activate,slotPreview:(cid,y)=>v190CourseSlots(cid,y)};
})();
