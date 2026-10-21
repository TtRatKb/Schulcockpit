/* Schulcockpit V0.23.6 – Restjahr/Leistungsnachweise, lokale ChatGPT-ZIP-Übergabe. */
(function(){
'use strict';
const SCHEMA='schulcockpit.year.v1';
function datePlus(s,n){const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function nextInstructionalDelta(start,delta,entries,isFree){
  if(!entries.length)return delta;
  const sign=delta<0?-1:1;let seen=0;
  for(let n=1;n<=64;n++){
    const mon=datePlus(start,7*n*sign);
    if(entries.some(t=>Number(t.weekday)>=1&&Number(t.weekday)<=5&&!isFree(datePlus(mon,Number(t.weekday)-1)))){
      if(++seen===Math.abs(delta))return n*sign;
    }
  }
  return null;
}
function parseAnnual(raw,courseId,year){
  const s=String(raw||''),match=s.match(/<SCHULCOCKPIT_YEAR_IMPORT>\s*([\s\S]*?)\s*<\/SCHULCOCKPIT_YEAR_IMPORT>/i);
  let obj;
  try{obj=JSON.parse(match?match[1]:s.trim());}catch(_){throw Error('Ungültiges JSON: SCHULCOCKPIT_YEAR_IMPORT vollständig einfügen.');}
  if(obj?.schema!==SCHEMA||obj.courseId!==courseId||obj.schoolYear!==year)throw Error('Schema, Kurs oder Schuljahr passen nicht zu diesem Planungsauftrag.');
  if(!Array.isArray(obj.sequences)||!obj.sequences.length||obj.sequences.length>25)throw Error('Es sind 1–25 einzelne Reihen erforderlich.');
  let count=0;
  for(const q of obj.sequences){
    if(!q?.title||!Array.isArray(q.units)||q.units.length>150)throw Error('Jede Reihe braucht Titel und maximal 150 Stunden.');
    count+=q.units.length;
    for(const u of q.units){
      if(!u?.title||!Array.isArray(u.materials)||u.materials.length>30)throw Error('Jede Stunde braucht Titel und materials als Array (max. 30).');
      if((u.competencyIds!==undefined&&!Array.isArray(u.competencyIds))||
         (u.methodIds!==undefined&&!Array.isArray(u.methodIds)))throw Error('Kompetenz-IDs müssen als Arrays übergeben werden.');
      if(u.materials.some(m=>!m||!m.title||typeof m.title!=='string'))throw Error('Jedes Material benötigt einen Titel.');
    }
  }
  if(count>650)throw Error('Maximal 650 Stunden pro Jahresimport.');
  return obj;
}
function clean(s){return String(s||'Datei').replace(/[^a-zA-Z0-9._ÄÖÜäöüß-]/g,'_').slice(0,110);}
function repairNameV243(name){
  return String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss')
    .replace(/\.[a-z0-9]{1,8}$/i,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function repairTargetV243(s,target){
  if(!target||!target.id||!['material','katalog','reihe','pruefung'].includes(target.kind))return null;
  let holder,record,property='fileKey';
  if(target.kind==='material'){
    holder=(s.materials||[]).find(m=>m.id===target.id);
    record=(holder?.variants||[]).find(v=>v.id===target.variantId);
  }else if(target.kind==='katalog'){
    record=(s.materialCatalog||[]).find(e=>e.catalogId===target.id);
    property='localFileKey';
  }else if(target.kind==='reihe'){
    holder=(s.sequences||[]).find(q=>q.id===target.id);
    record=(holder?.sourceFilesV190||[]).find(f=>f.id===target.fileId);
  }else{
    holder=(s.assessments||[]).find(a=>a.id===target.id);
    record=(holder?.files||[]).find(f=>f.id===target.fileId);
  }
  if(!record)return null;
  if(target.kind==='katalog'&&target.sourcePath&&record.sourcePath!==target.sourcePath)return null;
  if(target.kind==='katalog'&&target.sourceArchive&&record.sourceArchive!==target.sourceArchive)return null;
  return {record,property,holder,expected:target.name||record.fileName||record.name||holder?.title||''};
}
if(typeof module!=='undefined'&&module.exports){module.exports={datePlus,nextInstructionalDelta,parseAnnual,clean,missingDescriptionV242,repairNameV243,repairTargetV243};return;}

// Navigation: Unterrichtsfreie Wochen auslassen, belegte Einzeltage schützen.
function weekEntries(){return (state.timetable||[]).filter(t=>Number(t.weekday)>=1&&Number(t.weekday)<=5);}
function jump(delta){return nextInstructionalDelta(iso(activeMonday()),delta,weekEntries(),d=>!!v190NoSchoolInfo(d));}
const oldVisit=visitWeekV177;
visitWeekV177=function(delta,planningOnly){
  const entries=weekEntries(),step=jump(delta);
  if(step===null)return alert('Keine weitere Unterrichtswoche gefunden. Bitte Kalender/Stundenplan prüfen.');
  if(!entries.length)return oldVisit(delta,planningOnly);
  const monday=weekStartDateV177(step);
  state.settings.activeWeekStart=monday;
  const w=weekWorkflowV177(monday);w.planningOnly=!!planningOnly;w.printPanelOpen=false;
  for(const t of entries){
    const d=activeWeekDate(Number(t.weekday));
    if(v190NoSchoolInfo(d))continue;
    if(!state.lessons.some(l=>l.date===d&&(l.timetableId===t.id||(l.classId===t.classId&&lessonSlot(l)===Number(t.slot)))))
      state.lessons.push(createBlankLessonFromTimetable(t));
  }
  state.lessons.filter(l=>l.date>=monday&&l.date<=activeWeekEnd()&&!v191LessonProtected(l)).forEach(attachExactPlanV11);
  Promise.resolve(saveState()).catch(e=>alert('Speicherfehler: '+(e.message||e)));
  view='prep';modal=null;expandedLessonV176.clear();resourceEditorV176={lessonId:'',key:''};render();
};
shiftActiveWeek=function(delta){
  const step=jump(delta);
  if(step===null)return alert('Keine weitere Unterrichtswoche im Kalender gefunden.');
  state.settings.activeWeekStart=weekStartDateV177(step);
  Promise.resolve(saveState()).catch(e=>alert('Speicherfehler: '+(e.message||e)));render();
};

// Halbjahresvorgaben: bewusst bestätigen, keine automatische Änderung an Prüfungen.
function reqKey(cid,y){return cid+'|'+y;}
function savedReq(cid,y){return (state.yearRequirementsV236||{})[reqKey(cid,y)]||null;}
function suggest(c){
  const empty=()=>({type:'offen',status:'offen',note:''});
  if(v202SubjectKey(c)!=='religion')return [empty(),empty()];
  if(v202Grade(c)===11)return [{type:'klausur',status:'geplant',note:'Oberstufe; Termin und Anzahl bitte bestätigen.'},empty()];
  const data={
    6:[['klassenarbeit','erledigt'],['ersatzleistung','geplant']],
    7:[['klassenarbeit','geplant'],['ersatzleistung','geplant']],
    8:[['klassenarbeit','erledigt'],['ersatzleistung','geplant']],
    9:[['ersatzleistung','geplant'],['klassenarbeit','geplant']]
  }[v202Grade(c)];
  return data?data.map(r=>({type:r[0],status:r[1],note:''})):[empty(),empty()];
}
function reqs(cid,y){
 const course=cls(cid),sub=v202SubjectKey(course)==='mathematik'?'Mathematik':'Religion',grade=v202Grade(course);
 const gradeDefaults=state.assessmentGradeV237||{},local=savedReq(cid,y),suggested=suggest(course);
 return [0,1].map(i=>({...suggested[i],...(gradeDefaults[[sub,grade,y,i+1].join('|')]||{}),...(local?.[i]||{})}));
}
let flow={courseId:'',year:'',phase:'setup',raw:'',data:null,preview:null};
function openFlow(cid,onlyRules){
  if(!cls(cid))return alert('Bitte einen Fachkurs auswählen.');
  flow={courseId:cid,year:v190PlanningYear(),phase:onlyRules?'rules':'setup',raw:'',data:null,preview:null};
  modal={type:'annualV236'};render();
}
function selector(values,current,attr){
  return '<select '+attr+'>'+values.map(v=>'<option value="'+v[0]+'" '+(current===v[0]?'selected':'')+'>'+v[1]+'</option>').join('')+'</select>';
}
function requirementEditor(){
  return '<div class="v236-semesters">'+reqs(flow.courseId,flow.year).map((r,i)=>
    '<section><h3>'+(i+1)+'. Halbjahr</h3><label>Nachweis'+selector([['offen','Noch offen'],['klassenarbeit','Klassenarbeit'],['ersatzleistung','Ersatzleistung'],['klausur','Klausur'],['kein','Keiner'] ],r.type,'data-v236-kind="'+i+'"')+'</label>'
    +'<label>Status'+selector([['offen','Offen'],['geplant','Einzuplanen'],['terminiert','Terminiert'],['erledigt','Erledigt']],r.status,'data-v236-status="'+i+'"')+'</label>'
    +'<label>Hinweise<input maxlength="500" data-v236-note="'+i+'" value="'+esc(r.note||'')+'"></label></section>'
  ).join('')+'</div>';
}
function modalHtmlAnnual(){
  const c=cls(flow.courseId),q=v190PlanningSequences(flow.courseId,flow.year);
  let html='';
  if(flow.phase==='setup'||flow.phase==='rules'){
    html='<p>Eine Planung für alle noch offenen Reihen – basierend auf tatsächlichem Unterricht, Kalender und vollständigem Curriculum. Vorschläge für Religion 6–9 sind vorgefüllt, aber noch nicht gespeichert.</p>'
      +requirementEditor()
      +'<p class="muted">'+q.length+' bestehende Reihen · '+v190CourseSlots(flow.courseId,flow.year).length+' reguläre Fachtermine ohne feste Prüfungen.</p>'
      +'<div class="v236-actions"><button class="secondary" data-v236-save>Halbjahresvorgaben speichern</button>'
      +(flow.phase==='setup'?'<button class="primary" data-v236-export>Restjahr-ZIP für ChatGPT erstellen →</button>':'<button class="secondary" data-v236-to-setup>Zur Planung →</button>')+'</div>';
  }else if(flow.phase==='missing'){
    const entries=flow.missingReview||[];
    const fixed=entries.filter(e=>e.repairedV243).length;
    html='<p><strong>'+entries.length+' Originaldateien waren beim letzten Export nicht lesbar.</strong> '
      +fixed+' davon hast du inzwischen neu verknüpft. Wähle das Original direkt im Finder, ohne das Material neu anzulegen.</p>'
      +'<div class="v242-missing-list">'+entries.map((e,i)=>'<article class="v242-missing-item">'
      +'<strong>'+(i+1)+'. '+esc(e.name)+'</strong><small>'+esc(e.category)+'</small>'
      +(e.repairedV243?'<p class="v243-ok">✓ Original neu gespeichert: '+esc(e.selectedFileV243||e.name)+'</p>':
        '<p>'+esc(e.reason)+'</p>')
      +(e.sources?.length?'<small>Mögliche Quellpfade: '+esc(e.sources.join(' · '))+'</small>':'')
      +(e.repairTarget&&!e.repairedV243?'<label class="upload-button v243-repair">Originaldatei auswählen'
        +'<input type="file" data-v243-file="'+i+'" hidden></label>':
        (!e.repairTarget?'<small>Dieser Eintrag hat keine eindeutige Material-ID; bitte den Fehlerbericht prüfen.</small>':''))
      +'</article>').join('')+'</div>'
      +'<p class="microcopy">Die Datei wird nur lokal gespeichert und mit genau demselben Material verknüpft. Kurs, Reihen, Titel und bisherige Unterrichtszuordnungen bleiben bestehen. Wähle bei mehreren Fassungen bitte die richtige Version.</p>'
      +'<div class="v236-actions"><button class="secondary" data-v242-report>Fehlerbericht herunterladen</button>'
      +'<button class="secondary" data-v242-cancel>Abbrechen und Originale prüfen</button>'
      +(fixed===0?'<button class="secondary" data-v242-continue>Trotzdem unvollständige ZIPs erstellen</button>':'')
      +'<button class="primary" data-v243-recheck>Dateien neu prüfen und ZIPs vorbereiten →</button></div>';
  }else if(flow.phase==='downloads'){
    const parts=flow.downloadParts||[],total=parts.length,clicked=parts.filter(x=>x.downloaded).length;
    html='<p><strong>'+total+' vollständige Teil-ZIPs</strong> wurden vorbereitet. '+(flow.packageMissing?
      flow.packageMissing+' lokale Originaldateien fehlen laut Materialprüfung.':
      'Alle hier registrierten und lokal verfügbaren Materialdateien sind auf die Pakete verteilt.')+'</p>'
      +'<p>Bitte <strong>jeden Teil herunterladen</strong> und anschließend <strong>alle Teil-ZIPs zusammen</strong> in denselben ChatGPT-Chat hochladen. Die eigentliche Planungsanweisung liegt in Teil 01. Erst nach allen Uploads eine Jahresplanung anfordern.</p>'
      +'<div class="v241-parts">'+parts.map((x,i)=>'<div class="v241-part"><div><strong>Teil '+(i+1)+' von '+total+'</strong>'
        +'<small>'+x.count+' Originaldateien · '+Math.round(x.size/1024/1024)+' MB ZIP'
        +(x.oversized?' · große Einzeldatei':'')+'</small></div>'
        +'<button class="secondary" data-v241-download="'+i+'">'+(x.downloaded?'Erneut herunterladen':'Teil '+(i+1)+' herunterladen')+'</button>'
      +'</div>').join('')+'</div>'
      +'<p class="microcopy">'+clicked+' von '+total+' Download-Schaltflächen angeklickt. Bitte die Dateien zusätzlich in deinem Downloads-Ordner kontrollieren. Bei Safari muss eventuell das Herunterladen mehrerer Dateien erlaubt werden.</p>'
      +'<div class="v236-actions"><button class="primary" data-v241-response '+(clicked<total?'disabled':'')+'>Alle Teile heruntergeladen → Weiter</button></div>';
  }else if(flow.phase==='response'){
    html='<p>Alle nummerierten Teil-ZIPs dieser Planung gemeinsam in ChatGPT hochladen und erst danach die vollständige Antwort hier einfügen.</p>'
      +(flow.downloadParts?.length?'<button class="secondary" data-v241-back>Teil-ZIPs erneut anzeigen</button>':'')
      +'<label>ChatGPT-Antwort<textarea id="v236-raw" rows="13" placeholder="SCHULCOCKPIT_YEAR_IMPORT …">'+esc(flow.raw)+'</textarea></label>'
      +'<div class="v236-actions"><label class="upload-button">Antwortdatei öffnen<input id="v236-file" type="file" accept=".json,.txt,.md" hidden></label>'
      +'<button class="secondary" data-v236-export>ZIP erneut laden</button><button class="primary" data-v236-parse>Gesamtimport prüfen →</button></div>';
  }else{
    const p=flow.preview;
    html='<h3>Vorschau für '+esc(c.subject+' '+c.name)+'</h3><p>'+p.sequences+' Reihen · '+p.units+' zu importierende Sollstunden · '+p.protected+' geschützte bisherige Sollstunden · '+p.unmatched+' nicht eindeutig zugeordnete Materialien.</p>'
      +'<p>Nur die noch nicht geschützten Sollstunden der betroffenen Reihen werden ersetzt. Gehaltene und konkret ausgearbeitete Stunden, Prüfungen und Originaldateien bleiben bestehen.</p>'
      +'<div class="v236-sequence-list">'+flow.data.sequences.map(x=>'<p><strong>'+esc(x.title)+'</strong> · '+x.units.length+' Sollstunden'+(x.sequenceId?'':' · neue Reihe')+'</p>').join('')+'</div>'
      +(p.warnings.length?'<p class="v236-warn">'+esc(p.warnings.join(' · '))+'</p>':'')
      +'<div class="v236-actions"><button class="secondary" data-v236-back>← Antwort bearbeiten</button><button class="primary" data-v236-apply>Gesamtplanung übernehmen →</button></div>';
  }
  return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-xwide v236-modal" data-modal-stop><header class="modal-header"><div><span class="eyebrow">'+esc(flow.year)+' · '+esc(c.subject+' '+c.name)+'</span><h2>Restliches Schuljahr mit ChatGPT planen</h2></div><button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">'+html+'</div></section></div>';
}
function readRules(){return [0,1].map(i=>({
  type:document.querySelector('[data-v236-kind="'+i+'"]')?.value||'offen',
  status:document.querySelector('[data-v236-status="'+i+'"]')?.value||'offen',
  note:(document.querySelector('[data-v236-note="'+i+'"]')?.value||'').slice(0,500)
}));}
async function saveRules(){
  const key=reqKey(flow.courseId,flow.year),prior=savedReq(flow.courseId,flow.year);
  state.yearRequirementsV236=state.yearRequirementsV236||{};
  // Keep topic/form and handout, submission, correction, return and grade deadline
  // when the short original editor updates only type, status and notes.
  state.yearRequirementsV236[key]=readRules().map((r,i)=>({...reqs(flow.courseId,flow.year)[i],...r}));
  try{await saveState();}catch(e){if(prior)state.yearRequirementsV236[key]=prior;else delete state.yearRequirementsV236[key];throw e;}
  render();
}
function curriculum(cid){
  const c=cls(cid),subject=v202SubjectKey(c),grade=v202Grade(c);
  return {subject,grade,source:v202Source(subject),
    topics:v202Topics(subject,grade).map(t=>({id:t.id,title:t.title,sourcePages:t.sourcePages||[],
      competencies:(t.competencies||[]).map(x=>({id:x.id,text:x.text,category:x.category,level:x.level}))})),
    methods:subject==='mathematik'?v202MethodsForGrade(grade).map(m=>({id:m.id,text:m.text,topicHints:m.topicHints||[],
      sourceComplete:!(typeof v207IsIncomplete==='function'&&v207IsIncomplete(m))})):[]
  };
}
function currentDate(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function context(){
  const c=cls(flow.courseId),y=flow.year,limits=v190YearBounds(y);
  const ls=(state.lessons||[]).filter(l=>l.classId===c.id&&v190YearFromDate(l.date)===y);
  return {course:{id:c.id,subject:c.subject,name:c.name,grade:v202Grade(c),students:Number(c.students)||null},
    schoolYear:y,planningFrom:currentDate(),bounds:limits,
    timetable:(state.timetable||[]).filter(t=>t.classId===c.id).map(t=>({weekday:t.weekday,slot:t.slot,period:t.period})),
    freeDates:v190CalendarRanges(y),publicHolidays:[...v190PublicHolidaysForYear(v190YearStartNum(y)),...v190PublicHolidaysForYear(v190YearStartNum(y)+1)].filter(x=>x.date>=limits.start&&x.date<=limits.end),
    availableSlots:v190CourseSlots(c.id,y).filter(s=>s.date>=currentDate()),
    actual:ls.filter(l=>v182IsHeld(l)||v191LessonProtected(l)||l.v180MovedFrom).map(l=>({
      date:l.date,slot:l.slot,sequenceId:l.sequenceId||'',unitId:l.planReference?.unitId||'',
      title:l.title||l.planReference?.title||'',objective:l.objective||l.planReference?.objective||'',
      content:l.planReference?.content||'',held:!!v182IsHeld(l),prepared:!!concretePlanReadyV12(l)
    })),
    sequences:v190PlanningSequences(c.id,y).map(q=>({
      id:q.id,title:q.title,goal:q.goal,notes:q.notes,order:q.orderV190,startDate:q.startDate,endDate:q.endDate,
      curriculum:q.curriculumV202||null,
      units:(q.plan||[]).map(u=>({id:u.id,plannedDate:u.plannedDate,title:u.title,objective:u.objective,
        content:u.content,competencyIds:u.competencyIds||[],methodIds:u.methodIds||[],
        material:u.material,materials:u.materialLinksV184||[]})),
      sourceFiles:(q.sourceFilesV190||[]).map(f=>f.name)
    })),
    competencySources:curriculum(c.id),
    requirements:reqs(c.id,y),requirementsConfirmed:!!savedReq(c.id,y),
    assessments:(state.assessments||[]).filter(a=>a.classId===c.id&&v190YearFromDate(a.date)===y).map(a=>({
      id:a.id,date:a.date,type:a.type,title:a.title,scope:a.scope,notes:a.notes,files:(a.files||[]).map(f=>f.name)
    })),
    catalog:v184CurrentCourseCatalog(c.id).map(e=>({catalogId:e.catalogId,fileName:e.fileName,sourceArchive:e.sourceArchive||'',
      sourcePath:e.sourcePath||'',sequenceTitle:e.sequenceTitle||'',scope:e.scope||'',variantType:e.variantType||'',
      materialart:e.hubV237?.kind||'',status:e.hubV237?.status||'',resourceType:e.resourceType||'',
      note:e.hubV237?.note||'',available:!!catalogAvailableV17(e)})),
    standaloneMaterials:(state.materials||[]).filter(m=>
      !(m.catalogId&&(state.materialCatalog||[]).some(e=>e.catalogId===m.catalogId))&&
      ((m.assignments||[]).some(a=>a.classId===c.id)||
       m.hubV237?.subject===(v202SubjectKey(c)==='mathematik'?'Mathematik':'Religion')&&
       Number(m.hubV237?.grade)===v202Grade(c)&&(!m.hubV237?.courseId||m.hubV237.courseId===c.id))
    ).map(m=>({id:m.id,title:m.title,materialart:m.hubV237?.kind||'',
      resourceType:m.resourceType||'',source:m.source||'',variants:(m.variants||[]).map(v=>({
        id:v.id,name:v.fileName||'',variantType:v.type||'',available:!!hasStoredFile(v)
      }))}))
  };
}
function assignmentPrompt(ctx){
  const shape={schema:SCHEMA,courseId:ctx.course.id,schoolYear:ctx.schoolYear,sequences:[
    {sequenceId:'bestehende-id-oder-leer',title:'Reihentitel',goal:'',notes:'',units:[
      {unitId:'bestehende-id-oder-leer',title:'Thema',content:'',objective:'',competencyIds:[],methodIds:[],
        materials:[{title:'',kind:'file',catalogId:'',materialId:'',sourceArchive:'',sourcePath:'',printMode:'none',copies:0,reuse:false}]}
    ]}
  ]};
  return '# Schulcockpit: restliches Schuljahr gemeinsam planen\n\n'
    +'Lies zuerst 09_MATERIALPRUEFUNG.json und 08_DATEI_MANIFEST.json. Prüfe genau, welche bereits im Schulcockpit erfassten Materialien wirklich in diesem ZIP vorhanden sind. Bei fehlenden oder wegen Größengrenzen ausgelassenen Dateien keine Vollständigkeit behaupten, sondern die Lücken ausdrücklich nennen. Über zuvor nicht importierte iSurf-Originale enthält das ZIP keine Informationen. '
    +'Sichte danach alle enthaltenen Originaldateien. Gib eine einzige gemeinsame Antwort für ALLE bestehenden Reihen von '
    +ctx.course.subject+' '+ctx.course.name+' im Schuljahr '+ctx.schoolYear+'. Die Reihen müssen separat bleiben; neue Reihen nur nach sachlichem Nachweis. '
    +'Die laufende Reihe anhand des Ist-Unterrichts fortsetzen. Bereits gehaltene und konkret vorbereitete Stunden nicht erneut planen oder verändern. '
    +'Übernimm die vorhandenen Reihen-IDs und ggf. Sollstunden-IDs, um Dubletten zu vermeiden. '
    +'Planung ab '+ctx.planningFrom+'; das Cockpit selbst verteilt neue Stunden anschließend auf reguläre Unterrichtsslots. '
    +'Erfinde KEINE Unterrichtstage, Materialien, Kompetenz-IDs oder Termine.\n\n'
    +'Lies die curricularen Quellen samt ALLEN fachlichen und methodischen Kompetenzen (insbesondere Jahrgang 5–7). Wenn für die Oberstufe bzw. einen Kurs keine vollständigen Curriculumeinträge vorliegen, benenne diese Quellenlücke ausdrücklich und erfinde keine Kompetenzen. '
    +'Verwende unverändert die belegten competencyIds und methodIds aus 05_KOMPETENZEN.json; nicht belegte IDs nicht erfinden. '
    +'Methoden als echte Lernhandlungen, Erweiterungskompetenzen nur als Erweiterungen. '
    +'Fehlende Kernkompetenzen bei Platzmangel ausdrücklich benennen. '
    +'Feste Prüfungen bleiben fix. Halbjahresregeln (Klassenarbeit, Ersatzleistung, Klausur) aus 06_LEISTUNGSNACHWEISE.json berücksichtigen. Themenzuordnung und konkrete Leistungsform beachten: Arbeitsauftrag vorstellen, Bearbeitungszeit einplanen, ggf. erinnern, Abgabe, Bewertung und Rückgabe mit ausreichend Zeit vor einer tatsächlich eingetragenen Notenfrist. Fehlende Fristen nicht erfinden. '
    +'Wenn eine Halbjahresvorgabe noch offen/nicht bestätigt ist, nicht eigenmächtig entscheiden. '
    +'Material nur nach Sichtung echter Datei/Inhalte zuweisen. Die Dateien unter weiteres_material/ sind als eigene Materialobjekte bereits lokal hinterlegt; verwende dafür materialId aus 07B_WEITERE_MATERIALIEN.json, nicht erfundene Katalog-IDs. Für Katalogdateien nur exakt belegte catalogId oder Archiv+Pfad übernehmen. Ältere Klassenarbeiten und Referenzarbeiten dienen nur als Orientierung und sind nicht als neue verpflichtende Arbeiten zu behandeln. '
    +'Für Bücher kind=book und keine Kopien. Fehlende/unbestätigte Dateien nicht als vorhanden ausgeben. '
    +'Nicht jede Datei ist ein Kopierauftrag. Keine Schülerdaten in der Antwort.\n\n'
    +'Gib zuerst eine knappe Übersicht mit Zeitbedarf, nicht abgedeckten Kompetenzen und offenen Prüfungsentscheidungen. '
    +'Danach GENAU EINEN gültigen JSON-Block zwischen <SCHULCOCKPIT_YEAR_IMPORT> und </SCHULCOCKPIT_YEAR_IMPORT>. '
    +'Fülle das folgende STRUKTURMUSTER mit echten Daten, lass Platzhalter weg, ohne Markdown-Fence:\n'
    +'<SCHULCOCKPIT_YEAR_IMPORT>\n'+JSON.stringify(shape,null,2)+'\n</SCHULCOCKPIT_YEAR_IMPORT>\n';
}
async function exportZip(){
  if(typeof JSZip==='undefined'||typeof SC_YEAR_PARTS_V241==='undefined')
    throw Error('Der neue Jahresplanungs-ZIP-Export wurde nicht vollständig geladen. Seite neu laden.');
  const ctx=context(),mod=SC_YEAR_PARTS_V241,manifest={included:[],missing:[],skipped:[]};
  const missingTargets=[];
  const base='Schulcockpit_Restjahr_'+clean(ctx.course.subject+'_'+ctx.course.name+'_'+flow.year);
  const core={
    '01_PLANUNGSAUFTRAG.txt':assignmentPrompt(ctx),
    '02_KURS_KALENDER.json':JSON.stringify({course:ctx.course,schoolYear:ctx.schoolYear,planningFrom:ctx.planningFrom,bounds:ctx.bounds,
      timetable:ctx.timetable,freeDates:ctx.freeDates,publicHolidays:ctx.publicHolidays,availableSlots:ctx.availableSlots},null,2),
    '03_IST_UNTERRICHT.json':JSON.stringify(ctx.actual,null,2),
    '04_REIHEN_SOLL.json':JSON.stringify(ctx.sequences,null,2),
    '05_KOMPETENZEN.json':JSON.stringify(ctx.competencySources,null,2),
    '06_LEISTUNGSNACHWEISE.json':JSON.stringify({requirements:ctx.requirements,confirmed:ctx.requirementsConfirmed,assessments:ctx.assessments},null,2),
    '07_MATERIALKATALOG.json':JSON.stringify(ctx.catalog,null,2),
    '07B_WEITERE_MATERIALIEN.json':JSON.stringify(ctx.standaloneMaterials,null,2)
  };
  // Include EVERY locally available source exactly once, without the old 400-files
  // or 140-MB truncation. Parts are split at these limits instead.
  const candidates=[],paths=new Set();
  function append(path,blob,origin,target){
    if(!blob||typeof blob.size!=='number'){
      manifest.missing.push(origin||path);
      missingTargets.push(target||{kind:'unknown',name:origin||path});
      return;
    }
    if(paths.has(path))throw Error('Doppelter Pfad im Export: '+path);
    paths.add(path);
    candidates.push({path,blob});
  }
  for(const q of v190PlanningSequences(flow.courseId,flow.year))for(const f of q.sourceFilesV190||[]){
    const rec=await fileStoreGet(f.fileKey);
    append('reihen/'+clean(q.id)+'/'+clean(f.id+'_'+f.name),rec?.blob,'Reihenmaterial '+f.name,
      {kind:'reihe',id:q.id,fileId:f.id,name:f.name});
  }
  for(const a of (state.assessments||[]).filter(a=>a.classId===flow.courseId&&v190YearFromDate(a.date)===flow.year))for(const f of a.files||[]){
    const rec=await fileStoreGet(f.fileKey);
    append('pruefungen/'+clean(a.id+'_'+f.name),rec?.blob,'Prüfung '+f.name,
      {kind:'pruefung',id:a.id,fileId:f.id,name:f.name});
  }
  const archives=new Map();
  for(const e of v184CurrentCourseCatalog(flow.courseId)){
    if(!catalogAvailableV17(e)){
      manifest.missing.push('Katalog '+e.fileName);
      missingTargets.push({kind:'katalog',id:e.catalogId,name:e.fileName,sourceArchive:e.sourceArchive||'',sourcePath:e.sourcePath||''});
      continue;
    }
    try{
      const ar=catalogArchiveRecordV17(e.sourceArchive);
      let zip=null;
      if(ar?.fileKey){
        if(!archives.has(ar.fileKey)){
          const rec=await fileStoreGet(ar.fileKey);
          archives.set(ar.fileKey,rec?.blob?await JSZip.loadAsync(rec.blob):null);
        }
        zip=archives.get(ar.fileKey);
      }
      const file=await catalogEntryFileV17(e,zip);
      append('materialien/'+clean(e.catalogId+'_'+e.fileName),file,'Katalog '+e.fileName,
        {kind:'katalog',id:e.catalogId,name:e.fileName,sourceArchive:e.sourceArchive||'',sourcePath:e.sourcePath||''});
    }catch(err){
      manifest.missing.push('Nicht lesbar '+e.fileName);
      missingTargets.push({kind:'katalog',id:e.catalogId,name:e.fileName,sourceArchive:e.sourceArchive||'',sourcePath:e.sourcePath||''});
    }
  }
  for(const m of state.materials||[]){
    if(m.catalogId&&(state.materialCatalog||[]).some(e=>e.catalogId===m.catalogId))continue;
    const linked=(m.assignments||[]).some(a=>a.classId===flow.courseId);
    const h=m.hubV237||{},subject=v202SubjectKey(cls(flow.courseId))==='mathematik'?'Mathematik':'Religion';
    const shared=h.subject===subject&&Number(h.grade)===v202Grade(cls(flow.courseId))&&(!h.courseId||h.courseId===flow.courseId);
    if(!linked&&!shared)continue;
    for(const v of m.variants||[]){
      if(!v.fileKey||!hasStoredFile(v)){
        manifest.missing.push('Weiteres Material '+(v.fileName||m.title));
        missingTargets.push({kind:'material',id:m.id,variantId:v.id,name:v.fileName||m.title});
        continue;
      }
      const rec=await fileStoreGet(v.fileKey);
      append('weiteres_material/'+clean(m.id+'_'+v.id+'_'+(v.fileName||rec?.name||m.title)),
        rec?.blob,'Weiteres Material '+(v.fileName||m.title),
        {kind:'material',id:m.id,variantId:v.id,name:v.fileName||m.title});
    }
  }
  const coreBytes=Object.values(core).reduce((a,s)=>a+new Blob([s]).size,0)+512*1024;
  const parts=mod.splitFiles(candidates,{coreBytes});
  const mapping=mod.mapParts(parts);
  const total=parts.length;
  const partDefs=parts.map((p,i)=>({number:i+1,name:mod.partName(base,i+1,total),
    count:p.files.length,bytes:p.bytes,oversized:p.oversized}));
  manifest.included=candidates.map(f=>f.path);
  manifest.parts=partDefs.map(({number,name,count,bytes,oversized})=>({number,name,count,bytes,oversized}));
  manifest.files=candidates.map(f=>({path:f.path,part:mapping.get(f.path),partFile:partDefs[mapping.get(f.path)-1].name}));
  const packageCatalog=ctx.catalog.map(e=>{
    const path='materialien/'+clean(e.catalogId+'_'+e.fileName),part=mapping.get(path)||null;
    return {catalogId:e.catalogId,fileName:e.fileName,materialart:e.materialart||'nicht klassifiziert',
      sourceArchive:e.sourceArchive,sourcePath:e.sourcePath,
      status:part?'enthalten':'originaldatei_nicht_im_zip',
      part,partFile:part?partDefs[part-1].name:''};
  });
  const packageKinds={};
  for(const e of packageCatalog){
    const key=e.materialart;
    packageKinds[key]=packageKinds[key]||{erfasst:0,enthalten:0,fehlend:0};
    packageKinds[key].erfasst++;
    if(e.status==='enthalten')packageKinds[key].enthalten++;
    else packageKinds[key].fehlend++;
  }
  const audit={schema:'schulcockpit.materialpackage.audit.v2',
    course:ctx.course,schoolYear:ctx.schoolYear,scope:'nur_im_Schulcockpit_erfasste_Materialien',
    note:'Nur der lokal registrierte Bestand kann geprüft werden. Nicht importierte iSurf-Materialien sind nicht bekannt. Alle nummerierten Teile sind für eine vollständige Auswertung erforderlich.',
    status:manifest.missing.length?'UNVOLLSTAENDIG_ORIGINALE_FEHLEN':'VOLLSTAENDIG_IN_ALLEN_TEILEN',
    catalogTotal:packageCatalog.length,catalogIncluded:packageCatalog.filter(e=>e.status==='enthalten').length,
    filesIncluded:candidates.length,missingCount:manifest.missing.length,skippedCount:0,parts:partDefs,
    byType:packageKinds,catalog:packageCatalog,missing:manifest.missing,
    missingDetails:manifest.missing.map((entry,i)=>({...missingDescriptionV242(entry,ctx),repairTarget:missingTargets[i]})),skipped:[]};
  const pending={ctx,core,manifest,parts,total,partDefs,audit};
  if(manifest.missing.length){
    flow.missingReview=manifest.missing.map((entry,i)=>({...missingDescriptionV242(entry,ctx),repairTarget:missingTargets[i]}));
    flow.repairsMadeV243=false;
    flow.pendingZipV242=pending;
    flow.phase='missing';render();return;
  }
  await buildDownloadsV242(pending);
}
function missingDescriptionV242(entry,ctx){
  const input=String(entry||'');
  const definitions=[
    ['Reihenmaterial ','Reihenmaterial','Eine in der Unterrichtsreihe verknüpfte lokale Datei fehlt oder kann nicht gelesen werden.'],
    ['Prüfung ','Prüfungsanhang','Eine für diesen Kurs gespeicherte Prüfungsdatei ist lokal nicht mehr lesbar.'],
    ['Katalog ','Katalogdatei','Der Materialkatalog verweist auf eine Einzeldatei oder ein Originalarchiv, das im Browser nicht verfügbar ist.'],
    ['Nicht lesbar ','Katalogdatei','Die Datei ist katalogisiert, ließ sich aber aus der gespeicherten Datei oder dem Quellarchiv nicht auslesen.'],
    ['Weiteres Material ','Materialanhang','Ein lokal verknüpfter Materialanhang ist nicht mehr verfügbar oder lesbar.']
  ];
  const match=definitions.find(d=>input.startsWith(d[0]));
  const name=match?input.slice(match[0].length):input;
  const sources=(match?.[1]==='Katalogdatei'?(ctx.catalog||[])
    .filter(e=>e.fileName===name).map(e=>[e.sourceArchive,e.sourcePath].filter(Boolean).join(' / ')).filter(Boolean):[]);
  return {name,category:match?.[1]||'Materialdatei',
    reason:match?.[2]||'Die Datei konnte nicht aus dem lokalen Bestand übernommen werden.',
    sources:[...new Set(sources)].slice(0,6),
    sourceAmbiguous:sources.length>1};
}
async function buildDownloadsV242(pending){
  const {ctx,core,manifest,parts,total,partDefs,audit}=pending;
  const output=[];
  for(let i=0;i<total;i++){
    const z=new JSZip(),p=parts[i];
    if(i===0){
      for(const [name,content] of Object.entries(core))z.file(name,content);
      z.file('08_DATEI_MANIFEST.json',JSON.stringify(manifest,null,2));
      z.file('09_MATERIALPRUEFUNG.json',JSON.stringify(audit,null,2));
      z.file('10_TEILPAKETE.json',JSON.stringify({
        schema:'schulcockpit.annual.multipart.v1',requiredParts:total,
        warning:'ALLE Teil-ZIPs in derselben ChatGPT-Unterhaltung hochladen, bevor eine Jahresplanung erstellt wird.',
        parts:partDefs,missing:manifest.missing
      },null,2));
    }
    z.file('00_ZUERST_LESEN.txt',
      'Schulcockpit Jahresplanung '+ctx.course.subject+' '+ctx.course.name+' '+flow.year
      +'\nTeil '+(i+1)+' von '+total+'\n'
      +'ALLE '+total+' ZIP-Dateien dieser Lieferung gemeinsam in ChatGPT hochladen.'
      +'\nDie Aufgabenstellung und die Vollständigkeitsprüfung stehen in Teil 01.'
      +'\nPlanung erst beginnen, wenn wirklich ALLE Teile bereitstehen.\n');
    if(i>0)z.file('11_DATEIEN_DIESES_TEILS.json',JSON.stringify({
      schema:'schulcockpit.annual.part.v1',part:i+1,total,
      requiredFiles:p.files.map(f=>f.path)
    },null,2));
    for(const f of p.files)z.file(f.path,f.blob);
    const blob=await z.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});
    output.push({name:partDefs[i].name,blob,count:p.files.length,size:blob.size,
      oversized:p.oversized,downloaded:false});
  }
  flow.downloadParts=output;
  flow.packageMissing=manifest.missing.length;
  flow.pendingZipV242=null;
  flow.phase='downloads';render();
}
function allowedIds(){
  const c=curriculum(flow.courseId),set=new Set();
  for(const t of c.topics)for(const x of t.competencies)set.add(x.id);
  for(const m of c.methods)if(m.sourceComplete)set.add(m.id);
  return set;
}
function protectedUnit(q,u){
  if(u.plannedDate&&u.plannedDate<currentDate())return true;
  return (state.lessons||[]).some(l=>l.classId===q.classId&&v191LessonProtected(l)&&
    (l.planReference?.unitId===u.id||
      (u.plannedDate&&l.date===u.plannedDate&&l.sequenceId===q.id)||
      (l.sequenceId===q.id&&v202Norm(l.title||l.planReference?.title||'')===v202Norm(u.title||'')&&!!u.title)));
}
function catalogMatch(m){
  if(!m||!['file','digital','source'].includes(m.kind))return null;
  const cat=v184CurrentCourseCatalog(flow.courseId);
  if(m.catalogId){
    return cat.find(e=>e.catalogId===m.catalogId&&(!m.sourceArchive||e.sourceArchive===m.sourceArchive)
      &&(!m.sourcePath||e.sourcePath===m.sourcePath))||null;
  }
  if(!m.sourceArchive||!m.sourcePath)return null;
  const matches=cat.filter(e=>e.sourceArchive===m.sourceArchive&&e.sourcePath===m.sourcePath);
  return matches.length===1?matches[0]:null;
}
function standaloneMatch(item){
  if(!item?.materialId)return null;
  const m=(state.materials||[]).find(x=>x.id===item.materialId);
  if(!m)return null;
  const c=cls(flow.courseId),h=m.hubV237||{};
  const linked=(m.assignments||[]).some(a=>a.classId===flow.courseId);
  const pool=h.subject===(v202SubjectKey(c)==='mathematik'?'Mathematik':'Religion')&&
    Number(h.grade)===v202Grade(c)&&(!h.courseId||h.courseId===flow.courseId);
  if(!linked&&!pool)return null;
  const v=(m.variants||[]).find(v=>hasStoredFile(v)&&(!item.variantType||v.type===item.variantType));
  return v?{m,v}:null;
}
function previewImport(data){
  const used=new Set(),warnings=[],qs=v190PlanningSequences(flow.courseId,flow.year),known=allowedIds();
  let units=0,protectedCount=0,unmatched=0;
  for(const d of data.sequences){
    const q=d.sequenceId?qs.find(q=>q.id===d.sequenceId):null;
    if(d.sequenceId&&!q)throw Error('Unbekannte Reihen-ID: '+d.sequenceId);
    if(q&&used.has(q.id))throw Error('Reihe doppelt: '+d.title);
    if(q){used.add(q.id);protectedCount+=(q.plan||[]).filter(u=>protectedUnit(q,u)).length;}
    else warnings.push('Neue Reihe: '+d.title);
    units+=d.units.length;
    for(const u of d.units){
      for(const id of [...(u.competencyIds||[]),...(u.methodIds||[])])if(!known.has(id))warnings.push('Unbelegte Kompetenz-ID: '+id);
      for(const m of u.materials)if(['file','digital','source'].includes(m.kind)&&!catalogMatch(m)&&!standaloneMatch(m))unmatched++;
    }
  }
  return {sequences:data.sequences.length,units,protected:protectedCount,unmatched,warnings:[...new Set(warnings)].slice(0,15)};
}
async function applyImport(){
  const before={sequences:clone(state.sequences),lessons:clone(state.lessons),materials:clone(state.materials)};
  const base=v190PlanningSequences(flow.courseId,flow.year),known=allowedIds();
  let changed=0,created=0,unmatched=0;
  // Lokales Sicherungsartefakt der betroffenen Planungsdaten vor dem Commit.
  downloadText('Vor_Restjahrimport_'+clean(flow.courseId)+'_'+Date.now()+'.json',JSON.stringify({
    schema:'schulcockpit.year.preimport.v1',courseId:flow.courseId,schoolYear:flow.year,
    sequences:before.sequences.filter(q=>q.classId===flow.courseId&&v190SeqYear(q)===flow.year),
    lessons:before.lessons.filter(l=>l.classId===flow.courseId&&v190YearFromDate(l.date)===flow.year)
  },null,2),'application/json');
  try{
    for(const d of flow.data.sequences){
      let q=d.sequenceId?seq(d.sequenceId):null;
      if(q&&(q.classId!==flow.courseId||v190SeqYear(q)!==flow.year))throw Error('Fremde Reihe.');
      if(!q){q={id:uid('seq'),classId:flow.courseId,schoolYearV190:flow.year,title:String(d.title),
        orderV190:base.length+created,goal:'',notes:'',startDate:'',endDate:'',hours:'',plan:[]};state.sequences.push(q);created++;}
      else changed++;
      q.goal=String(d.goal||q.goal||'').slice(0,3000);
      q.notes=String(d.notes||q.notes||'').slice(0,2200);
      const kept=(q.plan||[]).filter(u=>protectedUnit(q,u));
      const free=(q.plan||[]).filter(u=>!protectedUnit(q,u)),used=new Set(),incoming=[];
      for(const i of d.units){
        const hit=free.find(u=>!used.has(u.id)&&(i.unitId?u.id===i.unitId:v202Norm(u.title)===v202Norm(i.title)));
        if(hit)used.add(hit.id);
        const u=hit?clone(hit):cleanPlanUnitV10({title:i.title});
        u.title=String(i.title).slice(0,280);u.content=String(i.content||'').slice(0,3500);
        u.objective=String(i.objective||'').slice(0,1800);
        u.competencyIds=[...new Set((i.competencyIds||[]).filter(id=>known.has(id)))];
        u.methodIds=[...new Set((i.methodIds||[]).filter(id=>known.has(id)&&id.startsWith('methode-')))];
        u.plannedDate='';u.materialLinksV184=[];u.referenceMaterialsV184=[];u.pendingMaterialReferencesV184=[];
        const names=[];
        for(const m of i.materials){
          const name=String(m.title||'').slice(0,350),kind=['file','book','digital','activity','source'].includes(m.kind)?m.kind:'file';
          if(!name)continue;names.push(name);
          if(['book','activity'].includes(kind)){u.referenceMaterialsV184.push({title:name,kind});continue;}
          const existingMaterial=standaloneMatch({...m,kind});
          if(existingMaterial){
            const {m:original,v}=existingMaterial;
            original.assignments=original.assignments||[];
            if(!original.assignments.some(a=>a.classId===flow.courseId&&a.sequenceId===q.id&&a.unitId===u.id))
              original.assignments.push({classId:flow.courseId,sequenceId:q.id,unitId:u.id});
            u.materialLinksV184.push({materialId:original.id,variantId:v.id,catalogId:'',
              canonical:v.fileName||original.title,displayTitle:name,
              printMode:['bw','color'].includes(m.printMode)?m.printMode:'none',
              copies:m.copies==='class'?'class':Math.max(0,Number(m.copies)||0),reuse:!!m.reuse,kind});
            continue;
          }
          const entry=catalogMatch({...m,kind});
          if(!entry){u.pendingMaterialReferencesV184.push({title:name,kind,status:'not-matched'});unmatched++;continue;}
          const resolved=await v184EnsureSelectedMaterial({selected:'c:'+entry.catalogId},flow.courseId,q.id,u.id);
          if(!resolved?.variant){u.pendingMaterialReferencesV184.push({title:name,kind,status:'not-matched'});unmatched++;continue;}
          u.materialLinksV184.push({materialId:resolved.material.id,variantId:resolved.variant.id,
            catalogId:entry.catalogId,canonical:resolved.canonical,displayTitle:name,
            printMode:['bw','color'].includes(m.printMode)?m.printMode:'none',
            copies:m.copies==='class'?'class':Math.max(0,Number(m.copies)||0),reuse:!!m.reuse,kind});
        }
        u.material=[...new Set(names)].join('\n');u.importedFromV184=new Date().toISOString();incoming.push(u);
      }
      q.plan=[...kept,...incoming.filter(u=>!kept.some(k=>k.id===u.id))];
    }
    const schedule=v190RescheduleCourseYear(flow.courseId,flow.year,true);
    if(schedule.warning?.includes('kein Stundenplan'))throw Error(schedule.warning);
    await saveState();modal=null;render();
    alert('Restjahr importiert: '+changed+' bestehende Reihen, '+created+' neue Reihen. '+unmatched+' Materialreferenzen müssen noch geprüft werden.'+(schedule.warning?'\n'+schedule.warning:''));
  }catch(e){
    state.sequences=before.sequences;state.lessons=before.lessons;state.materials=before.materials;
    try{await saveState();}catch(err){console.error('Rollback-Speicherung fehlgeschlagen',err);}
    throw e;
  }
}
const previousSequences=sequencesView;
sequencesView=function(){
  return previousSequences().replace(/(<button class="secondary" data-v184-open-course="([^"]+)">)/g,(_s,old,cid)=>
    '<button class="primary" data-v236-open="'+esc(cid)+'">✨ Restjahr mit ChatGPT planen</button>'
    +'<button class="text-button" data-v236-rules="'+esc(cid)+'">Leistungsnachweise</button>'+old);
};
const previousModal=modalHtml;
modalHtml=function(){return modal?.type==='annualV236'?modalHtmlAnnual():previousModal();};
const previousWire=wire;
wire=function(){
  previousWire();
  document.querySelectorAll('[data-v236-open]').forEach(b=>b.onclick=()=>openFlow(b.dataset.v236Open,false));
  document.querySelectorAll('[data-v236-rules]').forEach(b=>b.onclick=()=>openFlow(b.dataset.v236Rules,true));
  document.querySelector('[data-v236-to-setup]')?.addEventListener('click',()=>{flow.phase='setup';render();});
  document.querySelector('[data-v242-report]')?.addEventListener('click',()=>{
    const report={schema:'schulcockpit.missing-originals.v1',courseId:flow.courseId,
      schoolYear:flow.year,missing:flow.missingReview||[]};
    downloadBlob('Schulcockpit_Fehlende_Originale_'+clean(flow.courseId+'_'+flow.year)+'.json',
      new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  });
  document.querySelector('[data-v242-cancel]')?.addEventListener('click',()=>{
    flow.pendingZipV242=null;flow.phase='setup';render();
  });
  document.querySelector('[data-v242-continue]')?.addEventListener('click',async e=>{
    const b=e.currentTarget;b.disabled=true;
    try{
      if(!flow.pendingZipV242)throw Error('Kein vorbereitetes Jahresplanungspaket mehr vorhanden.');
      await buildDownloadsV242(flow.pendingZipV242);
    }catch(err){alert('Export mit Lücken fehlgeschlagen: '+(err.message||err));b.disabled=false;}
  });
  document.querySelectorAll('[data-v241-download]').forEach(b=>b.onclick=()=>{
    const i=Number(b.dataset.v241Download),p=flow.downloadParts?.[i];
    if(!p)return;
    downloadBlob(p.name,p.blob);
    p.downloaded=true;
    render();
  });
  document.querySelector('[data-v241-response]')?.addEventListener('click',()=>{
    if((flow.downloadParts||[]).every(p=>p.downloaded)){flow.phase='response';render();}
  });
  document.querySelector('[data-v241-back]')?.addEventListener('click',()=>{flow.phase='downloads';render();});
  document.querySelector('[data-v236-save]')?.addEventListener('click',()=>saveRules().catch(e=>alert('Speichern fehlgeschlagen: '+(e.message||e))));
  document.querySelector('[data-v236-export]')?.addEventListener('click',async e=>{
    const b=e.currentTarget;b.disabled=true;
    try{
      if(flow.phase==='setup')await saveRules();
      if(confirm('Das ZIP enthält ggf. Unterrichts- und Prüfungsdateien. Vor dem Hochladen auf personenbezogene Daten prüfen. ZIP lokal erzeugen?'))await exportZip();
    }catch(err){alert('ZIP-Export fehlgeschlagen: '+(err.message||err));}
    finally{b.disabled=false;}
  });
  document.getElementById('v236-raw')?.addEventListener('input',e=>{flow.raw=e.target.value;});
  document.getElementById('v236-file')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(f){flow.raw=await f.text();document.getElementById('v236-raw').value=flow.raw;}});
  document.querySelector('[data-v236-parse]')?.addEventListener('click',()=>{
    try{flow.raw=document.getElementById('v236-raw')?.value||flow.raw;
      flow.data=parseAnnual(flow.raw,flow.courseId,flow.year);
      flow.preview=previewImport(flow.data);flow.phase='preview';render();
    }catch(e){alert('Import ungültig: '+(e.message||e));}
  });
  document.querySelector('[data-v236-back]')?.addEventListener('click',()=>{flow.phase='response';render();});
  document.querySelector('[data-v236-apply]')?.addEventListener('click',async e=>{
    const b=e.currentTarget;b.disabled=true;
    try{await applyImport();}catch(err){alert('Gesamtimport abgebrochen: '+(err.message||err));b.disabled=false;}
  });
};
const oldRender=render;
render=function(){oldRender();const el=document.querySelector('.brand small');if(el)el.textContent=state.settings.schoolYear+' · V0.23.6';};
})();