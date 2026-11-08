/* Schulcockpit V0.30.7 – temporary course overlay for the existing Kurzunterricht.
 * No mutation of state.timetable, no permanent class, no imaginary worksheet.
 * Existing V304 short notes remain intact and can be adopted later.
 */
(function(){
'use strict';
const C=SC_TEMP_COURSE_V307;
let active='',formOpen=false,formGroup='',query='',maxResults=24,showLegacy=false;
function all(){return Array.isArray(state.quickTeachingV304)?state.quickTeachingV304:[];}
function selected(){return all().find(g=>g.id===active)||all()[0]||null;}
function cfg(g){return g?.temporaryV307||null;}
function today(){return new Date().toISOString().slice(0,10);}
function nextWeekSpan(){
 const d=activeMonday(),start=iso(d),e=new Date(d);
 e.setDate(e.getDate()+6);return {start,end:iso(e)};
}
function defaultEnd(start){return C.plusDay(start,27);}
function choices(items,value){return items.map(([x,label])=>'<option value="'+esc(x)+'" '+(String(x)===String(value)?'selected':'')+'>'+esc(label)+'</option>').join('');}
function gradeHint(g){return String(g?.grade||'').match(/(?:^|\D)(1[0-3]|[5-9])(?:\D|$)/)?.[1]||'';}
function gradeFromPath(e){
 const h=e?.hubV237||{};
 if(Number(h.grade)>=5&&Number(h.grade)<=13)return Number(h.grade);
 const s=[e.sourceArchive,e.sourcePath,e.fileName].filter(Boolean).join('/');
 const d=s.match(/(?:klasse|jahrgang|jg\.?|mathe|mathematik|religion)\s*[-_. /]*(1[0-3]|[5-9])\b/i);
 return d?Number(d[1]):0;
}
function subjectFromPath(e){
 if(e?.hubV237?.subject)return e.hubV237.subject;
 const s=[e.sourceArchive,e.sourcePath,e.fileName].filter(Boolean).join(' ');
 return /mathe|mathematik/i.test(s)?'Mathematik':/religion|\breli\b/i.test(s)?'Religion':'';
}
function materialOptions(g){
 const items=[];
 for(const m of state.materials||[]){
  if(m.hubV237?.status==='excluded'||m.disposition==='excluded')continue;
  const sub=m.hubV237?.subject||subjectFromPath(m),grade=Number(m.hubV237?.grade)||gradeFromPath(m),
   ref='m:'+m.id;
  items.push({ref,name:m.title||'Material',subject:sub,grade,
   kind:m.hubV237?.kind||m.resourceType||'Material',ready:(m.variants||[]).some(hasStoredFile),
   source:'material',materialId:m.id});
 }
 for(const e of state.materialCatalog||[]){
  if(e.scope==='exclude'||e.disposition==='excluded'||e.hubV237?.status==='excluded')continue;
  if((state.materials||[]).some(m=>m.catalogId===e.catalogId))continue;
  items.push({ref:'c:'+e.catalogId,name:e.fileName||e.sourcePath||'Archivmaterial',
   subject:subjectFromPath(e),grade:gradeFromPath(e),kind:e.hubV237?.kind||'Archivdatei',
   ready:typeof catalogAvailableV17==='function'&&catalogAvailableV17(e),
   source:'catalog',catalogId:e.catalogId,cat:e});
 }
 const subject=g?.subject||'',grade=Number(gradeHint(g))||0;
 return items.filter(x=>(!subject||!x.subject||x.subject===subject)&&
  (!grade||!x.grade||x.grade===grade)).sort((a,b)=>
   Number(!!b.ready)-Number(!!a.ready)||a.name.localeCompare(b.name,'de'));
}
function findRef(ref){
 const id=String(ref||'').slice(2);
 if(String(ref).startsWith('m:')){
  const m=mat(id);if(!m)return null;
  return {ref,name:m.title||'Material',kind:m.hubV237?.kind||m.resourceType||'Material',
   ready:(m.variants||[]).some(hasStoredFile),source:'material',materialId:m.id};
 }
 if(String(ref).startsWith('c:')){
  const e=(state.materialCatalog||[]).find(x=>x.catalogId===id);
  if(!e)return null;
  return {ref,name:e.fileName||e.sourcePath||'Archivdatei',
   kind:e.hubV237?.kind||'Archivdatei',
   ready:typeof catalogAvailableV17==='function'&&catalogAvailableV17(e),
   source:'catalog',catalogId:e.catalogId,cat:e};
 }
 return null;
}
function virtual(g){return g?.temporaryV307?C.metadata(g):null;}
const originalCls=cls;
cls=function(id){
 const direct=originalCls(id);if(direct)return direct;
 const g=all().find(x=>x.temporaryV307&&C.courseId(x.id)===id);
 return g?virtual(g):null;
};
function lessonExisting(id){return (state.lessons||[]).find(l=>l.id===id);}
function getSlotLabel(num){return state.settings.periods?.[num]||'Block '+(num+1);}
function managed(l){return !!l?.temporaryV307&&!!l.quickGroupIdV307;}
function isProtected(l){
 return v182IsHeld(l)||l.reflectionV182?.completedAt||
  (l.phasePlan||[]).length>0||(l.slides||[]).length>0||
  (l.materials||[]).length>0||(l.quickCatalogRefsV307||[]).length>0||
  (l.prepTasks||[]).length>0||(l.printPlan||[]).some(p=>p.needed||p.alreadyPrinted)||
  (l.worksheetActualV305?.snapshot||[]).length>0;
}
function sync(g,span,save=true){
 const settings=cfg(g);if(!settings)return 0;
 const range={start:span?.start||settings.startDate,
  end:span?.end||settings.endDate||C.plusDay(settings.startDate,55)};
 const plans=C.applySlots(g,range,
  d=>typeof v190NoSchoolInfo==='function'&&!!v190NoSchoolInfo(d,C.courseId(g.id)),
  getSlotLabel);
 const valid=new Set(plans.map(x=>x.id));let added=0,changed=0;
 for(const x of plans){
  let l=lessonExisting(x.id);
  if(!l){l=x.record;state.lessons.push(l);added++;
   // One-time adoption of notes saved in the previous Kurzunterricht editor.
   const legacy=(g.sessions||[]).find(s=>s.date===x.spec.date);
   if(legacy){
    if(legacy.topic)l.title=legacy.topic;
    if(legacy.independent)l.objective=legacy.independent;
    l.phasePlan=[
     legacy.entry&&{id:uid('phase'),phase:'Einstieg',title:legacy.entry},
     legacy.independent&&{id:uid('phase'),phase:'Erarbeitung',title:legacy.independent},
     legacy.end&&{id:uid('phase'),phase:'Sicherung',title:legacy.end}
    ].filter(Boolean);
    if(legacy.done){l.status='done';l.heldAtV182=new Date().toISOString();}
    if(legacy.reflection)l.reflectionV182={overall:'',timing:'',learning:'',
     lessonFlags:[],pptFlags:[],materialIssues:{},note:legacy.reflection,completedAt:''};
   }
  }
  if(l.quickDisabledV307){l.quickDisabledV307=false;changed++;}
  // Correct only records that still have the implicit V307 defaults. A teacher
  // explicitly selecting "Keine PPT nötig" sets presentationSourceV177='none'.
  if(l.presentationNotRequiredV177===true&&l.presentationReady===true&&
     !l.presentationSourceV177&&!l.presentationBlobKeyV180&&
     !l.aiImportAt&&!l.manualPlanReadyV177){
   l.presentationNotRequiredV177=false;l.presentationReady=false;changed++;
  }
  // The course-wide topic is not an actual lesson topic. Retain every manual
  // draft, prepared phase and previously imported lesson without alteration.
  if(!v182IsHeld(l)&&!l.quickExamV307&&!l.quickDraftV307?.topic&&
     !l.aiImportAt&&!(l.phasePlan||[]).length&&!(l.slides||[]).length&&
     !l.manualPlanReadyV177&&settings.topic&&l.title===settings.topic){
   l.title='Thema noch nicht konkretisiert';
   if(l.planReference?.title===settings.topic)l.planReference.title=l.title;
   changed++;
  }
  if(!v182IsHeld(l)){
   const exam=!!x.spec.exam;
   if(!!l.quickExamV307!==exam){
    const wasExam=!!l.quickExamV307,oldTitle=l.quickExamTitleV307||settings.examTitle;
    if(wasExam&&l.title===oldTitle)l.title=settings.topic||'Selbstständig arbeiten';
    if(exam&&(!l.title||l.title===settings.topic||l.title==='Selbstständig arbeiten'))l.title=settings.examTitle;
    l.quickExamV307=exam;changed++;
   }
   if(exam)l.quickExamTitleV307=settings.examTitle;
  }
 }
 // Only projections that are definitely outside the new recurring slots are
 // deactivated. Protected, edited and held lessons stay in the archive.
 for(const l of state.lessons||[]){
  if(!managed(l)||l.quickGroupIdV307!==g.id)continue;
  if(!l.date||l.date<range.start||l.date>range.end)continue;
  if(!valid.has(l.id)&&!l.quickDisabledV307){
   l.quickDisabledV307=true;changed++;
  }
 }
 if((added||changed)&&save)saveState();
 return added;
}
function ensureWeek(){
 const span=nextWeekSpan(),m=span.start;
 let n=0;
 for(const g of all()){
  if(!cfg(g))continue;
  const c=cfg(g);
  if(c.startDate>span.end||c.endDate&&c.endDate<span.start)continue;
  n+=sync(g,span,false);
 }
 if(n)saveState();
}
const oldCurrent=currentWeekLessons;
currentWeekLessons=function(){
 ensureWeek();
 return oldCurrent().filter(l=>!managed(l)||!l.quickDisabledV307);
};
const oldWeekCard=v182WeekCard;
v182WeekCard=function(l){
 const html=oldWeekCard(l);
 if(!managed(l))return html;
 const badge=l.quickExamV307?'KLAUSUR · BEFRISTETER KURS':'BEFRISTET · UNTERRICHTSÜBERNAHME';
 return html.replace('<div class="v182-week-meta">',
  '<div class="v307-card-label">'+badge+'</div><div class="v182-week-meta">')
  .replace('PPT offen','PPT noch nicht erstellt');
};
// A temporary course should not create a full lesson-production backlog merely
// because the teacher chose lightweight self-guided practice for the takeover.
const oldWorkflowV11=workflowTasksV11;
workflowTasksV11=function(){
 return oldWorkflowV11().filter(task=>{
  const l=lessonExisting(task.lessonId);
  return !managed(l)||!['plan','final'].includes(task.type);
 });
};
const oldWorkflow=workflowTasks;
workflowTasks=function(){
 return oldWorkflow().filter(task=>{
  const l=lessonExisting(task.lessonId);
  return !managed(l)||!['plan','final'].includes(task.type);
 });
};
const oldRelevant=v182RelevantMaterials;
v182RelevantMaterials=function(l){
 const original=oldRelevant(l);
 if(!managed(l))return original;
 const catalogRefs=(l.quickCatalogRefsV307||[]).map(ref=>
  (state.materialCatalog||[]).find(e=>'c:'+e.catalogId===ref)).filter(Boolean);
 const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 // A chosen archive can appear as an ordinary raw-resource hint AND as a
 // first-class locally openable catalog file. Prefer the catalog file once.
 const catalogNames=new Set(catalogRefs.map(e=>norm(e.fileName)));
 const xs=original.filter(e=>!String(e.id||'').startsWith('hint:')||
  !catalogNames.has(norm(e.title)));
 const present=new Set(xs.map(x=>x.id));
 for(const e of catalogRefs){
  if(present.has('catalog:'+e.catalogId))continue;
  xs.push({id:'catalog:'+e.catalogId,title:e.fileName||'Archivdatei',
   catalog:e,variants:[]});
 }
 return xs;
};
const oldTimetable=timetableView;
timetableView=function(){
 const html=oldTimetable(),span=nextWeekSpan();
 const entries=all().flatMap(g=>{
  const c=cfg(g);if(!c||c.startDate>span.end||c.endDate&&c.endDate<span.start)return [];
  return C.plannedDates(c,span.start,span.end,
    d=>typeof v190NoSchoolInfo==='function'&&!!v190NoSchoolInfo(d,C.courseId(g.id)))
    .map(x=>({...x,g}));
 });
 const summary='<section class="panel v307-schedule-summary"><div class="section-head"><div>'+
  '<span class="eyebrow">NUR IM GEWÄHLTEN ZEITRAUM</span><h2>Befristete Stundenplan-Ergänzungen</h2>'+
  '<p>Dein reguläres Stundenraster bleibt unangetastet. Übernahmen erscheinen nur in den passenden Wochen.</p>'+
  '</div><button class="secondary" data-v307-open-quick>Übernahmen verwalten ↗</button></div>'+
  (entries.length?'<div class="v307-mini-schedule">'+entries.map(x=>
    '<div><strong>'+esc(C.WEEKDAYS[x.weekday])+' · '+esc(getSlotLabel(x.slot))+'</strong>'+
    '<span>'+esc(x.g.subject+' '+x.g.grade)+' · '+esc(x.g.title)+
    (x.exam?' · Klausur':'')+'</span></div>').join('')+'</div>':
   '<p class="microcopy">In dieser Woche ist keine befristete Übernahme geplant.</p>')+
  '</section>';
 return html.replace(/<\/div>\s*$/,summary+'</div>');
};
function badgeTimetable(){
 if(view!=='timetable')return;
 const span=nextWeekSpan();
 for(const g of all()){
  const c=cfg(g);if(!c||c.startDate>span.end||c.endDate&&c.endDate<span.start)continue;
  const dates=C.plannedDates(c,span.start,span.end,
   d=>typeof v190NoSchoolInfo==='function'&&!!v190NoSchoolInfo(d,C.courseId(g.id)));
  for(const row of dates){
   const select=document.querySelector('[data-tt-cell-v11="'+row.weekday+'|'+row.slot+'"]');
   const cell=select?.closest('.schedule-cell');
   if(!cell)continue;
   const chip=document.createElement('div');chip.className='v307-schedule-chip';
   chip.textContent=(row.exam?'📝 ':'↪ ')+g.subject+' '+g.grade;
   chip.title=g.title+' · befristet '+c.startDate+(c.endDate?' bis '+c.endDate:' bis auf Weiteres');
   cell.append(chip);
  }
 }
}
function materialList(g){
 const list=materialOptions(g),activeRefs=new Set(cfg(g)?.courseMaterials||[]),
  q=query.toLocaleLowerCase('de'),visible=list.filter(x=>!q||[x.name,x.kind,x.subject,String(x.grade)]
   .some(t=>String(t||'').toLocaleLowerCase('de').includes(q))).slice(0,maxResults);
 return '<div class="v307-find"><label>Materialhub durchsuchen<input id="v307-search" type="search" value="'+esc(query)+'"'+
  ' placeholder="z. B. Lineare Funktionen, Klasse 9, Übungsblatt …"></label>'+
  '<button class="secondary" data-v307-search>Suchen</button></div>'+
  '<div class="v307-files">'+visible.map(x=>
   '<div class="v307-file"><div><strong>'+esc(x.name)+'</strong><small>'+
    esc([x.subject,x.grade&&'Jg. '+x.grade,x.kind].filter(Boolean).join(' · '))+
    ' · '+(x.ready?'Original hier verfügbar':'Archiv / Original ggf. erst verbinden')+'</small></div>'+
   '<button '+(activeRefs.has(x.ref)?'class="text-button"':'class="secondary"')+
    ' data-v307-pool="'+esc(x.ref)+'">'+(activeRefs.has(x.ref)?'✓ Im Kurs · entfernen':'+ Für Kurs merken')+
   '</button></div>').join('')+
   (!visible.length?'<p class="microcopy">Kein passendes Material gefunden. Prüfe Fach, Jahrgang und Dateinamen im Materialhub.</p>':'')+
   (list.length>maxResults?'<button class="text-button" data-v307-more>Weitere Materialien anzeigen</button>':'')+'</div>';
}
function poolItems(g){
 const refs=cfg(g)?.courseMaterials||[];
 if(!refs.length)return '<p class="microcopy">Noch kein Material für diesen Kurs vorgemerkt. Du kannst unten direkt den Materialhub durchsuchen.</p>';
 return refs.map(ref=>{
  const item=findRef(ref),name=item?.name||'Nicht mehr zugeordnete Datei';
  return '<div class="v307-pool-item"><div><strong>'+esc(name)+'</strong>'+
   '<small>'+esc(item?.kind||'Material')+'</small></div>'+
   '<button class="text-button" data-v307-pool="'+esc(ref)+'">Entfernen</button></div>';
 }).join('');
}
function addSlotForm(weekday=1,slot=0){
 const period=(state.settings.periods||[]).map((p,i)=>[String(i),p||'Block '+(i+1)]);
 if(!period.length)period.push(['0','Block 1']);
 return '<div class="v307-slot"><label>Wochentag<select data-v307-day>'+
  choices(C.WEEKDAYS.slice(1,6).map((x,i)=>[String(i+1),x]),String(weekday))+
  '</select></label><label>Unterrichtsblock<select data-v307-period>'+
  choices(period,String(slot))+'</select></label>'+
  '<button type="button" class="text-button" data-v307-remove-slot aria-label="Termin entfernen">'+
   '<span aria-hidden="true">×</span> Entfernen</button></div>';
}
function editor(g){
 const isNew=!g,isOld=!!g&&!cfg(g),dateStart=cfg(g)?.startDate||g?.sessions?.[0]?.date||today(),
  dates=cfg(g)?.endDate||defaultEnd(dateStart),type=g?.type||'temporary',course=g||{};
 const selection=cfg(g)?.slots?.length?cfg(g).slots:
  [{weekday:C.weekday(dateStart)<=5?C.weekday(dateStart):1,slot:0}];
 return '<section class="panel v307-editor"><div class="section-head"><div>'+
  '<span class="eyebrow">BEFRISTETE STUNDENPLAN-ERGÄNZUNG</span>'+
  '<h3>'+(isNew?'Neue Übernahme':isOld?'Bisherige Kurzplanung in den Stundenplan aufnehmen':'Zeitraum / Rhythmus ändern')+'</h3></div>'+
  '<button class="secondary" data-v307-cancel>Abbrechen</button></div>'+
  '<div class="v307-fields">'+
  '<label>Art<select id="v307-type">'+choices([['temporary','Kurs für begrenzte Zeit'],['cover','Einzelne Vertretungsstunde']],type)+'</select></label>'+
  '<label>Fach<select id="v307-subject">'+choices([['Mathematik','Mathematik'],['Religion','Religion'],['Sonstiges','Anderes Fach']],course.subject||'Mathematik')+'</select></label>'+
  '<label>Titel<input id="v307-title" maxlength="120" value="'+esc(course.title||'')+
  '" placeholder="z. B. Mathematik 9 · Elternzeitvertretung"></label>'+
  '<label>Klasse/Jahrgang<input id="v307-grade" maxlength="40" value="'+esc(course.grade||'')+
  '" placeholder="z. B. 9b"></label>'+
  '<label>Beginn<input type="date" id="v307-start" value="'+esc(dateStart)+'"></label>'+
  '<label>Ende (auch später änderbar)<input type="date" id="v307-end" value="'+esc(dates)+'"></label>'+
  '<label class="v307-check"><input type="checkbox" id="v307-open-end" '+(cfg(g)&&!cfg(g).endDate?'checked':'')+
  '> Ohne festes Enddatum / bis auf Weiteres</label>'+
  '<div class="v307-slot-wrapper"><strong>Wann und wie oft pro Woche?</strong>'+
   '<div id="v307-slot-rows">'+selection.map(s=>addSlotForm(s.weekday,s.slot)).join('')+'</div>'+
   '<button type="button" class="secondary" data-v307-add-slot>+ Weiterer Unterrichtstermin in der Woche</button>'+
   '<p class="microcopy">Die Blöcke erscheinen zusätzlich in „Meine Woche“ und im Stundenplan. '+
   'Deinen dauerhaften Stundenplan ändern wir nicht.</p></div>'+
  '<label>Thema der Übernahme<input id="v307-topic" maxlength="450" value="'+esc(cfg(g)?.topic||'')+
  '" placeholder="z. B. Lineare Funktionen"></label>'+
  '<label>Schwerpunkt der Arbeit<textarea id="v307-work" rows="2" maxlength="700">'+
   esc(cfg(g)?.workMode||'Kurzer Einstieg, dann arbeiten die Kinder selbstständig an den vorhandenen Aufgaben.')+
  '</textarea></label>'+
  '<label>Klassenarbeit / Klausur am (optional)<input id="v307-exam-date" type="date" value="'+esc(cfg(g)?.examDate||'')+'"></label>'+
  '<label>Name der Prüfung<input id="v307-exam-title" maxlength="160" value="'+esc(cfg(g)?.examTitle||'Klassenarbeit / Klausur')+'"></label>'+
  '<label class="v307-wide">Hinweise der Kollegin / des Kollegen (optional)<textarea id="v307-notes" maxlength="900" rows="2">'+
   esc(cfg(g)?.note||course.note||'')+'</textarea></label>'+
  '</div><div class="v307-edit-actions"><button class="primary" data-v307-save>In den Wochenplan übernehmen ✓</button>'+
  '<span class="microcopy">Bei einer Verlängerung bleiben bisherige Unterrichtsstunden und Materialien erhalten.</span></div>'+
  '</section>';
}
function scheduleCards(g){
 const c=cfg(g),start=c.startDate,range=c.endDate||C.plusDay(start,55),
   entries=(state.lessons||[]).filter(l=>managed(l)&&l.quickGroupIdV307===g.id&&
    !l.quickDisabledV307&&l.date>=start&&l.date<=range)
   .sort((a,b)=>a.date.localeCompare(b.date)||a.slot-b.slot);
 const next=entries.filter(l=>l.date>=today()).slice(0,18);
 const shown=next.length?next:entries.slice(-12);
 return '<section class="panel v307-lessons"><div class="section-head"><div>'+
  '<span class="eyebrow">JETZT IM NORMALEN WOCHENPLAN</span>'+
  '<h3>Unterrichtstermine</h3><p>Einzelne Stunden kannst du öffnen und wie gewohnt vorbereiten.</p></div>'+
  '<button class="secondary" data-v307-prompt>Vier-Wochen-Prompt kopieren ↗</button></div>'+
  (c.examDate?'<p class="v307-exam">📝 Klausurtermin: <strong>'+esc(c.examDate)+'</strong> · '+
   esc(c.examTitle)+'</p>':'')+
  '<div class="v307-lesson-items">'+shown.map(l=>{
   const refs=l.quickMaterialRefsV307||[];
   return '<div class="v307-lesson-item"><div class="v307-lesson-info"><small>'+
    esc(C.WEEKDAYS[C.weekday(l.date)]+' · '+l.date+' · '+getSlotLabel(l.slot))+'</small>'+
    '<strong>'+esc(l.title||'Selbstständige Arbeit')+(l.quickExamV307?' · Klausur':'')+'</strong>'+
    '<small>'+esc(refs.length+' Material'+(refs.length===1?'':'ien')+' für diese Stunde')+'</small></div>'+
    '<div class="v307-lesson-buttons"><button class="text-button" data-v307-link-show="'+esc(l.id)+'">'+
     'Material zuordnen</button><button class="secondary" data-v307-lesson="'+esc(l.id)+'">'+
     'Stunde öffnen ↗</button></div>'+
    '<div class="v307-lesson-materials" id="v307-material-'+esc(l.id)+'" hidden>'+
     (refs.length?refs.map(r=>'<div class="v307-linked"><span>'+
       esc(findRef(r)?.name||'Material aus dem Hub')+'</span>'+
       '<button class="text-button" data-v307-unlink="'+esc(l.id)+'|'+esc(r)+'">× Lösen</button></div>').join(''):'')+
     '<label>Material aus deinem Kurs-Pool<select data-v307-pick="'+esc(l.id)+'">'+
      '<option value="">Material auswählen …</option>'+
       (c.courseMaterials||[]).filter(r=>!refs.includes(r)).map(ref=>
        '<option value="'+esc(ref)+'">'+esc(findRef(ref)?.name||ref)+'</option>').join('')+
      '</select></label>'+
     '<p class="microcopy">Zuordnung = Datei für diese Stunde verfügbar. Kopierbedarf wird nicht automatisch angelegt.</p>'+
    '</div>'+
    (!l.quickExamV307?'<details class="v307-mini-editor"><summary>Kurzen Einstieg / Arbeitsauftrag festlegen</summary>'+
      '<div class="v307-mini-fields">'+
      '<label>Thema<input data-v307-mini-field="topic" data-v307-mini-id="'+esc(l.id)+
       '" value="'+esc(l.quickDraftV307?.topic||l.title||'')+'"></label>'+
      '<label>Kurzer Einstieg<textarea rows="2" data-v307-mini-field="entry" data-v307-mini-id="'+esc(l.id)+
       '" placeholder="Optional · ein Impuls oder eine Wiederholungsfrage">'+esc(l.quickDraftV307?.entry||'')+'</textarea></label>'+
      '<label>Selbstständiger Arbeitsauftrag<textarea rows="2" data-v307-mini-field="work" data-v307-mini-id="'+esc(l.id)+
       '" placeholder="z. B. Buch S. 78, Aufgaben 1–4">'+esc(l.quickDraftV307?.work||'')+'</textarea></label>'+
      '<label>Kurzer Abschluss<textarea rows="2" data-v307-mini-field="end" data-v307-mini-id="'+esc(l.id)+
       '" placeholder="Optional · offene Fragen und Lösungen vergleichen">'+esc(l.quickDraftV307?.end||'')+'</textarea></label>'+
      '<button class="primary" data-v307-mini-save="'+esc(l.id)+'">Mini-Stunde speichern ✓</button>'+
      '</div></details>':'')+
    '</div>';
  }).join('')+
  (!shown.length?'<p class="microcopy">Keine Termine im ausgewählten Zeitraum. Prüfe Feiertage und den eingestellten Wochenrhythmus.</p>':'')+
  '</div></section>';
}
function page(){
 const groups=all(),g=selected();
 return '<div class="content-grid v307-page"><section class="hero-card v307-hero"><div>'+
  '<span class="eyebrow">ZEITWEISE ÜBERNOMMENER UNTERRICHT</span>'+
  '<h2>Kurzunterricht – direkt in deiner Woche</h2>'+
  '<p>Zum Beispiel vier Wochen Mathematik 9 übernehmen: Wochentage und Blöcke festlegen, '+
  'vorhandene Materialien auswählen und bis zur Klausur überwiegend selbstständige Arbeit einplanen. '+
  'Dein dauerhafter Stundenplan bleibt unverändert.</p></div>'+
  '<button class="primary" data-v307-new>+ Übernahme anlegen</button></section>'+
  (groups.length?'<section class="panel v307-select"><label>Übernahme auswählen<select id="v307-select">'+
    choices(groups.map(x=>[x.id,x.title+' · '+x.grade]),g?.id||'')+
   '</select></label></section>':'')+
  (formOpen?editor(all().find(x=>x.id===formGroup)||null):'')+
  (!g?'<section class="panel"><p>Hier kannst du eine befristete Kursübernahme oder eine einzelne '+
   'Vertretungsstunde anlegen.</p></section>':
   !cfg(g)?'<section class="panel"><h3>'+esc(g.title)+'</h3>'+
    '<p>Diese Kurzplanung stammt aus der bisherigen Version. Deine bisherigen Termine und Notizen bleiben gespeichert. '+
    'Du kannst sie jetzt mit Wochentagen und Unterrichtsblöcken in den normalen Wochenplan übernehmen.</p>'+
    '<button class="primary" data-v307-edit="'+esc(g.id)+'">In den Stundenplan aufnehmen</button>'+
    '<details class="v307-old-notes"><summary>Bisherige Kurznotizen ('+(g.sessions||[]).length+')</summary>'+
     (g.sessions||[]).map(s=>'<p><strong>'+esc(s.date)+'</strong> · '+esc(s.topic||s.independent||'Kein Thema')+'</p>').join('')+
    '</details></section>':
   '<section class="panel v307-course"><div class="section-head"><div>'+
     '<span class="eyebrow">'+(g.type==='cover'?'EINZELVERTRETUNG':'BEFRISTETER KURS')+'</span>'+
     '<h2>'+esc(g.subject+' '+g.grade)+' · '+esc(g.title)+'</h2>'+
     '<p>Vom '+esc(cfg(g).startDate)+' '+(cfg(g).endDate?'bis '+esc(cfg(g).endDate):'bis auf Weiteres')+
     ' · '+cfg(g).slots.length+' Block'+(cfg(g).slots.length===1?'':'e')+' pro Woche</p></div>'+
     '<button class="secondary" data-v307-edit="'+esc(g.id)+'">Zeiten / Klausur ändern</button></div>'+
     (cfg(g).topic?'<p><strong>Thema:</strong> '+esc(cfg(g).topic)+'</p>':'')+
     '<p class="microcopy">'+esc(cfg(g).workMode)+'</p>'+
     '<div class="v307-rhythm">'+cfg(g).slots.map(x=>
       '<span>'+esc(C.WEEKDAYS[x.weekday]+' · '+getSlotLabel(x.slot))+'</span>').join('')+'</div>'+
     ((g.sessions||[]).length?'<details class="v307-old-notes"><summary>Bisherige Kurznotizen ('+
      g.sessions.length+') · bleiben im Archiv</summary>'+
      g.sessions.map(s=>'<p><strong>'+esc(s.date)+'</strong> · '+esc(s.topic||s.independent||'Ohne Thema')+'</p>').join('')+
     '</details>':'')+
     '<button class="text-button" data-v307-week>Diese Woche öffnen ↗</button>'+
     '<button class="text-button" data-v307-remove="'+esc(g.id)+'">Übernahme beenden / entfernen</button></section>'+
     '<section class="panel v307-pool"><div class="section-head"><div>'+
       '<span class="eyebrow">KEINE EXTRA-UPLOADS ERFORDERLICH</span><h3>Material aus dem vorhandenen Hub</h3>'+
       '<p>Materialien erst für den Kurs vormerken und bei Bedarf einzelnen Stunden zuordnen.</p>'+
       '</div></div>'+
       '<div class="v307-pool-current">'+poolItems(g)+'</div>'+materialList(g)+'</section>'+
     scheduleCards(g))+
  '</div>';
}
function readSlots(){
 return [...document.querySelectorAll('#v307-slot-rows .v307-slot')].map(x=>({
  weekday:Number(x.querySelector('[data-v307-day]').value),
  slot:Number(x.querySelector('[data-v307-period]').value)
 }));
}
function formValue(id){return document.getElementById(id)?.value?.trim()||'';}
function scheduleAfterUpdate(g,oldConfig){
 const current=cfg(g);if(!current)return;
 const end=current.endDate||C.plusDay(current.startDate,55);
 sync(g,{start:current.startDate,end:end},false);
 // A shortened/modified schedule only hides *future* automatically generated
 // placeholders; historical lessons and edited lessons remain intact.
 const matches=new Set(C.applySlots(g,{start:current.startDate,end},
  d=>typeof v190NoSchoolInfo==='function'&&!!v190NoSchoolInfo(d,C.courseId(g.id)))
  .map(x=>x.id));
 for(const l of state.lessons||[]){
  if(!managed(l)||l.quickGroupIdV307!==g.id||v182IsHeld(l))continue;
  const valid=l.date>=current.startDate&&(!current.endDate||l.date<=current.endDate)&&
   matches.has(l.id);
  if(!valid)l.quickDisabledV307=true;
 }
}
async function persist(fn){
 const backup=structuredClone({groups:all(),lessons:state.lessons});
 try{fn();await Promise.resolve(saveState());render();}
 catch(e){state.quickTeachingV304=backup.groups;state.lessons=backup.lessons;render();throw e;}
}
function addRef(l,ref){
 const item=findRef(ref);
 if(!item||!managed(l))throw Error('Material aus dem Hub nicht gefunden.');
 l.quickMaterialRefsV307=C.uniqueRefs([...(l.quickMaterialRefsV307||[]),ref]);
 l.customResourceHintsV176=l.customResourceHintsV176||[];
 const hint=item.name;
 if(!l.customResourceHintsV176.includes(hint))l.customResourceHintsV176.push(hint);
 setResourceTypeV14(l,hint,'reference');
 if(ref.startsWith('m:')){
  const mid=ref.slice(2),m=mat(mid);
  if(!m)throw Error('Material im Hub nicht gefunden.');
  l.materials=l.materials||[];
  if(!l.materials.includes(mid))l.materials.push(mid);
  const v=(m.variants||[]).find(v=>v.type==='standard')||(m.variants||[])[0];
  if(v){
   const b=resourceBundleV176(l,hint,true);
   b.items=b.items||[];
   if(!b.items.some(x=>x.materialId===mid&&x.variantId===v.id))
    b.items.push({id:uid('bundle'),materialId:mid,variantId:v.id});
   b.complete=true;b._v183Manual=true;b.deferred=false;
  }
 }else{
  l.quickCatalogRefsV307=C.uniqueRefs([...(l.quickCatalogRefsV307||[]),ref]);
 }
}
function removeRef(l,ref){
 if(!l||!managed(l))return;
 l.quickMaterialRefsV307=(l.quickMaterialRefsV307||[]).filter(x=>x!==ref);
 if(ref.startsWith('c:'))
  l.quickCatalogRefsV307=(l.quickCatalogRefsV307||[]).filter(x=>x!==ref);
 else{
  const id=ref.slice(2);
  const original=l.materials||[];
  l.materials=original.filter(x=>x!==id);
 }
 const item=findRef(ref),hint=item?.name;
 if(hint&&!l.quickMaterialRefsV307.some(x=>findRef(x)?.name===hint)){
  l.customResourceHintsV176=(l.customResourceHintsV176||[]).filter(x=>x!==hint);
  if(l.resourceBundlesV176)delete l.resourceBundlesV176[resourceKeyV14(hint)];
  if(l.resourceOverrides)delete l.resourceOverrides[resourceKeyV14(hint)];
 }
}
const oldTitle=pageTitle;
pageTitle=function(){return view==='quickTeachingV304'?'Kurzunterricht & Übernahmen':oldTitle();};
const oldHtml=viewHtml;
viewHtml=function(){return view==='quickTeachingV304'?page():oldHtml();};
const oldWire=wire;
wire=function(){
 oldWire();
 document.querySelector('[data-v307-open-quick]')?.addEventListener('click',()=>{view='quickTeachingV304';render();});
 if(view!=='quickTeachingV304')return;
 document.querySelector('[data-v307-new]')?.addEventListener('click',()=>{
  formOpen=true;formGroup='';render();
 });
 document.querySelector('[data-v307-cancel]')?.addEventListener('click',()=>{
  formOpen=false;render();
 });
 document.querySelector('#v307-select')?.addEventListener('change',e=>{
  active=e.target.value;formOpen=false;maxResults=24;query='';render();
 });
 document.querySelectorAll('[data-v307-edit]').forEach(b=>b.onclick=()=>{
  formGroup=b.dataset.v307Edit;formOpen=true;render();
 });
 document.querySelector('[data-v307-add-slot]')?.addEventListener('click',()=>{
  document.getElementById('v307-slot-rows')?.insertAdjacentHTML('beforeend',addSlotForm(1,0));
 });
 document.querySelector('#v307-slot-rows')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-v307-remove-slot]');
  if(!b)return;
  if(document.querySelectorAll('#v307-slot-rows .v307-slot').length===1)
   return alert('Mindestens einen Termin pro Woche behalten.');
  b.closest('.v307-slot').remove();
 });
 document.querySelector('#v307-open-end')?.addEventListener('change',e=>{
  const d=document.querySelector('#v307-end');if(d){d.disabled=e.target.checked;}
 });
 // Match the initial checkbox (new / existing indefinite groups).
 if(document.querySelector('#v307-open-end')?.checked){
  const end=document.getElementById('v307-end');if(end)end.disabled=true;
 }
 document.querySelector('#v307-type')?.addEventListener('change',e=>{
  if(e.target.value!=='cover')return;
  const start=formValue('v307-start'),day=start&&C.weekday(start);
  const first=document.querySelector('#v307-slot-rows .v307-slot');
  if(first&&day<=5)first.querySelector('[data-v307-day]').value=String(day);
  for(const e of [...document.querySelectorAll('#v307-slot-rows .v307-slot')].slice(1))e.remove();
 });
 document.querySelector('[data-v307-save]')?.addEventListener('click',async()=>{
  try{
   const existing=all().find(x=>x.id===formGroup)||null,now=formValue('v307-start'),
    kind=formValue('v307-type'),end=kind==='cover'?now:
     document.querySelector('#v307-open-end')?.checked?'':formValue('v307-end'),
    slots=kind==='cover'?
     [{weekday:C.weekday(now),slot:readSlots()[0]?.slot||0}]:readSlots();
   const record=C.config({
    startDate:now,endDate:end,slots,examDate:formValue('v307-exam-date'),
    examTitle:formValue('v307-exam-title'),topic:formValue('v307-topic'),
    workMode:formValue('v307-work'),note:formValue('v307-notes'),
    courseMaterials:existing?.temporaryV307?.courseMaterials||[]
   });
   const name=formValue('v307-title'),grade=formValue('v307-grade'),
    subject=formValue('v307-subject');
   if(name.length<3)throw Error('Bitte einen verständlichen Kursnamen angeben.');
   if(!grade)throw Error('Bitte die Lerngruppe bzw. den Jahrgang angeben.');
   if(kind==='cover'&&C.weekday(now)>5)throw Error('Eine Einzelvertretung bitte auf Montag bis Freitag legen.');
   await persist(()=>{
    const g=existing||{id:uid('quick'),sessions:[],createdAt:new Date().toISOString()};
    g.title=name;g.subject=subject;g.grade=grade;g.type=kind;
    g.temporaryV307=record;
    if(!existing)state.quickTeachingV304=Array.isArray(state.quickTeachingV304)?
      [...state.quickTeachingV304,g]:[g];
    scheduleAfterUpdate(g,existing?.temporaryV307||null);
    active=g.id;
   });
   formOpen=false;render();
  }catch(e){alert('Übernahme nicht gespeichert: '+(e.message||e));}
 });
 document.querySelector('[data-v307-search]')?.addEventListener('click',()=>{
  query=formValue('v307-search');maxResults=24;render();
 });
 document.querySelector('#v307-search')?.addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;e.preventDefault();query=e.target.value.trim();maxResults=24;render();
 });
 document.querySelector('[data-v307-more]')?.addEventListener('click',()=>{
  query=formValue('v307-search');maxResults+=40;render();
 });
 document.querySelectorAll('[data-v307-pool]').forEach(b=>b.onclick=async()=>{
  const g=selected(),ref=b.dataset.v307Pool;if(!cfg(g))return;
  const had=(cfg(g).courseMaterials||[]).includes(ref);
  try{await persist(()=>{const s=new Set(cfg(g).courseMaterials||[]);
   had?s.delete(ref):s.add(ref);cfg(g).courseMaterials=C.uniqueRefs([...s]);
  });}catch(e){alert(e.message||e);}
 });
 document.querySelectorAll('[data-v307-mini-save]').forEach(b=>b.onclick=async()=>{
  const l=lesson(b.dataset.v307MiniSave);
  if(!l||v182IsHeld(l))return alert('Eine bereits gehaltene Stunde wird nicht über die Kurzplanung überschrieben.');
  const fields=[...document.querySelectorAll('[data-v307-mini-id]')].filter(x=>x.dataset.v307MiniId===l.id);
  const values={};for(const x of fields)values[x.dataset.v307MiniField]=x.value.trim();
  try{await persist(()=>{
   l.quickDraftV307={
    topic:String(values.topic||'').slice(0,180),entry:String(values.entry||'').slice(0,650),
    work:String(values.work||'').slice(0,1000),end:String(values.end||'').slice(0,650)
   };
   if(l.quickDraftV307.topic)l.title=l.quickDraftV307.topic;
   if(l.quickDraftV307.work)l.objective=l.quickDraftV307.work;
  });}catch(e){alert('Kurzstunde nicht gespeichert: '+(e.message||e));}
 });
 document.querySelectorAll('[data-v307-lesson]').forEach(b=>b.onclick=()=>{
  const l=lesson(b.dataset.v307Lesson);if(!l)return;
  v182LessonId=l.id;
  state.settings.activeWeekStart=iso(mondayOf(new Date(l.date+'T12:00:00')));
  view='lessonDayV182';saveState();render();
 });
 document.querySelectorAll('[data-v307-link-show]').forEach(b=>b.onclick=()=>{
  const target=document.getElementById('v307-material-'+b.dataset.v307LinkShow);
  if(target)target.hidden=!target.hidden;
 });
 document.querySelectorAll('[data-v307-pick]').forEach(s=>s.onchange=async()=>{
  if(!s.value)return;
  const l=lesson(s.dataset.v307Pick);try{
   await persist(()=>addRef(l,s.value));
   const target=document.getElementById('v307-material-'+l.id);
   if(target)target.hidden=false;
  }catch(e){alert('Material nicht verknüpft: '+(e.message||e));}
 });
 document.querySelectorAll('[data-v307-unlink]').forEach(b=>b.onclick=async()=>{
  const raw=b.dataset.v307Unlink,i=raw.indexOf('|'),l=lesson(raw.slice(0,i)),ref=raw.slice(i+1);
  try{await persist(()=>removeRef(l,ref));}catch(e){alert(e.message||e);}
 });
 document.querySelector('[data-v307-prompt]')?.addEventListener('click',async()=>{
  const g=selected(),c=cfg(g);
  if(!c)return;
  // Plan the NEXT four weeks, not always the first four of an old takeover.
  const now=today(),first=(now>c.startDate&&(!c.endDate||now<=c.endDate))?now:c.startDate;
  const end=C.plusDay(first,27),span={start:first,end:c.endDate&&c.endDate<end?c.endDate:end};
  const chosen=C.applySlots(g,span,
   d=>typeof v190NoSchoolInfo==='function'&&!!v190NoSchoolInfo(d,C.courseId(g.id)),
   getSlotLabel).map(x=>lessonExisting(x.id)||x.record);
  const text=C.coursePrompt(g,chosen,(c.courseMaterials||[]).map(findRef).filter(Boolean),span);
  try{await navigator.clipboard.writeText(text);
   alert('Vier-Wochen-Prompt kopiert. Beim Einsatz die tatsächlichen Originaldateien bei ChatGPT hinzufügen.');}
  catch{downloadText('Kurzunterricht_'+g.id+'.md',text,'text/markdown');
   alert('Vier-Wochen-Prompt als Textdatei gespeichert.');}
 });
 document.querySelector('[data-v307-week]')?.addEventListener('click',()=>{
  const g=selected();if(!cfg(g))return;
  state.settings.activeWeekStart=iso(mondayOf(new Date(cfg(g).startDate+'T12:00:00')));
  saveState();view='week';render();
 });
 document.querySelector('[data-v307-remove]')?.addEventListener('click',async()=>{
  const g=selected();if(!g||!confirm('Diese befristete Übernahme aus dem Wochenplan nehmen? '+
   'Bereits gehaltene Stunden, Reflexionen und Originalmaterialien bleiben erhalten. '+
   'Die gesammelten Kurznotizen bleiben in der Kurzplanung gespeichert.'))return;
  try{
   await persist(()=>{
    delete g.temporaryV307;
    for(const l of state.lessons||[])if(managed(l)&&l.quickGroupIdV307===g.id&&!v182IsHeld(l))
      l.quickDisabledV307=true;
   });
  }catch(e){alert(e.message||e);}
 });
};
const oldRender=render;
render=function(){
 oldRender();badgeTimetable();
 const tag=document.querySelector('.brand small');
 if(tag)tag.textContent=state.settings.schoolYear+' · V0.30.7';
};
if(typeof window!=='undefined')window.SchulcockpitTemporaryCoursesV307={
 all,selected,materialOptions,findRef,sync,ensureWeek,addRef,removeRef,plannedDates:C.plannedDates,
 page,courseId:C.courseId,config:C.config,core:C
};
})();