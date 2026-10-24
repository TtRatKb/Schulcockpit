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
  if(obj.assessmentPlans!==undefined){
    if(!Array.isArray(obj.assessmentPlans)||obj.assessmentPlans.length>20)throw Error('assessmentPlans muss ein Array mit höchstens 20 Einträgen sein.');
    const planIds=new Set();
    for(const p of obj.assessmentPlans){
      if(!p||typeof p.planId!=='string'||!p.planId.trim()||planIds.has(p.planId))throw Error('Jede Prüfungsvorschau braucht eine eindeutige planId.');
      planIds.add(p.planId);
      for(const k of ['coveredMainIds','coveredSupplementaryIds'])
        if(p[k]!==undefined&&(!Array.isArray(p[k])||p[k].some(v=>typeof v!=='string')))
          throw Error('Ungültige Themen-ID-Liste bei Prüfungsplan '+p.planId);
      for(const k of ['proposedDate','alternativeDate'])if(p[k]&&(!/^\d{4}-\d{2}-\d{2}$/.test(p[k])||isNaN(Date.parse(p[k]))))
        throw Error('Ungültiges Datum bei Prüfungsplan '+p.planId);
    }
  }
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
// Only curriculum entries explicitly phrased as optional are non-blocking.
// Do not mark them as taught or assign them to fictitious lessons.
function optionalCurriculumCompetency(c){
  return /^(?:ggf\.?|gegebenenfalls|evtl\.?|eventuell)(?:\s|$)/i.test(String(c?.text||'').trim());
}
if(typeof module!=='undefined'&&module.exports){module.exports={datePlus,nextInstructionalDelta,parseAnnual,clean,missingDescriptionV242,repairNameV243,repairTargetV243,optionalCurriculumCompetency};return;}

// Navigation: Unterrichtsfreie Wochen auslassen, belegte Einzeltage schützen.
function weekEntries(){return (state.timetable||[]).filter(t=>Number(t.weekday)>=1&&Number(t.weekday)<=5);}
function jump(delta){return nextInstructionalDelta(iso(activeMonday()),delta,weekEntries(),d=>{
  const weekday=new Date(d+'T12:00:00').getDay()||7;
  return weekEntries().filter(t=>Number(t.weekday)===weekday).every(t=>!!v190NoSchoolInfo(d,t.classId||''));
});}
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
    if(v190NoSchoolInfo(d,t.classId||''))continue;
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
function yearMilestones(y){return (state.yearMilestonesV257?.[y]||[]).filter(x=>x&&x.date&&x.title);}
let flow={courseId:'',year:'',phase:'setup',raw:'',data:null,preview:null};
function openFlow(cid,onlyRules){
  if(!cls(cid))return alert('Bitte einen Fachkurs auswählen.');
  const year=v190PlanningYear();
   if(!onlyRules&&flow.courseId===cid&&flow.year===year&&flow.phase&&flow.phase!=='rules'){
     // Preserve the exact current step, uploaded answer, and in-memory multipart ZIP blobs.
     modal={type:'annualV236'};render();return;
   }
   flow={courseId:cid,year,phase:onlyRules?'rules':'setup',raw:'',data:null,preview:null};
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
function v247ArchiveNames(){return [...new Set((flow.missingReview||[]).filter(x=>x.repairTarget?.kind==='katalog').map(x=>x.repairTarget.sourceArchive).filter(Boolean))];}
async function v247RelinkArchive(index,file){
  const archive=v247ArchiveNames()[index];
  if(!archive||!file||modal?.type!=='annualV236'||flow.phase!=='missing')throw Error('Originalarchiv kann in diesem Schritt nicht übernommen werden.');
  if(!/\.zip$/i.test(file.name)||typeof JSZip==='undefined')throw Error('Bitte eine gültige Original-ZIP auswählen.');
  const rows=(state.materialCatalog||[]).filter(e=>catalogNormV17(e.sourceArchive)===catalogNormV17(archive));
  if(!rows.length)throw Error('Keine Katalogeinträge für '+archive);
  const zip=await JSZip.loadAsync(file),matched=rows.filter(e=>zipEntryForCatalogV17(zip,e)).length;
  if(!matched)throw Error('Keine eindeutig passenden Einträge im gewählten Archiv.');
  if(catalogNormV17(file.name)!==catalogNormV17(archive)&&!confirm('ZIP-Dateiname weicht ab:\n'+file.name+'\nErwartet: '+archive+'\nErkannte Katalogeinträge: '+matched+'/'+rows.length+'\n\nTrotzdem verbinden?'))return null;
  if(rows.length>=10&&matched<Math.ceil(rows.length*0.6)&&!confirm('Nur '+matched+'/'+rows.length+' Katalogeinträge gefunden. Das Archiv könnte unvollständig sein.\n\nTrotzdem verbinden?'))return null;
  const before=clone(state.materialCatalogArchives||{}),key='catalog-relink-v247-'+uid('archive');
  let written=false;
  try{
    await fileStorePut(key,file);written=true;
    const stored=await fileStoreGet(key);
    if(!stored?.blob||stored.blob.size!==file.size)throw Error('Das Original-ZIP konnte lokal nicht verifiziert werden.');
    state.materialCatalogArchives=state.materialCatalogArchives||{};
    state.materialCatalogArchives[archive]={...(before[archive]||{}),fileKey:key,size:file.size,
      matched,total:rows.length,linkedAt:new Date().toISOString(),storedOriginalName:file.name};
    await saveState();storedFileKeys.add(key);
    flow.pendingZipV242=null;flow.repairsMadeV243=true;
    return {matched,total:rows.length};
  }catch(err){
    state.materialCatalogArchives=before;
    if(written)try{await fileStoreDelete(key);}catch(e){console.warn('Temporäre ZIP-Datei konnte nicht gelöscht werden',e);}
    try{await saveState();}catch(e){console.warn('Archiv-Rollback konnte nicht bestätigt werden',e);}
    throw err;
  }
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
    const archives=v247ArchiveNames();
    html='<p><strong>'+entries.length+' Originaldateien waren beim letzten Export nicht lesbar.</strong> '
      +fixed+' davon hast du inzwischen neu verknüpft. Wähle das Original direkt im Finder, ohne das Material neu anzulegen.</p>'
      +(archives.length?'<section class="detail-section"><h3>Alle Katalogoriginale aus einem ZIP wieder verbinden</h3><p>Jedes benötigte Quellarchiv nur einmal auswählen – keine Einzeldateien neu zuordnen.</p>'+archives.map((name,i)=>'<label class="upload-button">📦 '+esc(name)+' auswählen<input type="file" accept=".zip" data-v247-archive="'+i+'" hidden></label>').join(' ')+'</section>':'')
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
      +'<section class="v244-coverage-review"><h3>Kompetenz- und Klassenarbeitsprüfung</h3>'
      +'<p>'+p.audit.methodScheduled+' von '+p.audit.methodTotal+' belegten Methodenkompetenzen mindestens einer Stunde zugeordnet. '
      +((state.yearAssessmentPlansV244||{})[reqKey(flow.courseId,flow.year)]||[]).length+' einzeln erfasste Nachweise werden geprüft.</p>'
      +(p.audit.resourcesNeeded.length?'<details><summary>'+p.audit.resourcesNeeded.length+' Stunden mit frühzeitigem Materialbedarf</summary>'
        +p.audit.resourcesNeeded.map(x=>'<p>'+esc(x.unit+': '+x.needs)+'</p>').join('')+'</details>':'')
      +(p.blockers.length?'<div class="v244-blockers"><strong>Vor Import beheben: '+p.blockers.length+' verbindliche Planungslücken</strong>'
        +'<ul>'+p.blockers.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':
        '<p class="v244-ok">✓ Einzelne Prüfungspläne und belegte Methodenkompetenzen in der Antwort gefunden.</p>')
      +'</section>'
      +(p.warnings.length?'<p class="v236-warn">'+esc(p.warnings.join(' · '))+'</p>':'')
      +'<div class="v236-actions"><button class="secondary" data-v236-back>← Antwort bearbeiten</button>'
      +'<button class="primary" data-v236-apply '+(p.blockers.length?'disabled title="Bitte die Planung zuerst in ChatGPT korrigieren"':'')+'>Gesamtplanung übernehmen →</button></div>';
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
    freeDates:[...v190CalendarRanges(y).map(r=>({...r,scope:'school'})),
      ...(typeof v261CourseRanges==='function'?v261CourseRanges(y,c.id).map(r=>({...r,scope:'course',classId:c.id})):[])],
    publicHolidays:[...v190PublicHolidaysForYear(v190YearStartNum(y)),...v190PublicHolidaysForYear(v190YearStartNum(y)+1)].filter(x=>x.date>=limits.start&&x.date<=limits.end),
    schoolMilestones:yearMilestones(y).map(x=>({date:x.date,title:x.title})),
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
        content:u.content,competencyIds:u.competencyIdsV202||u.competencyIds||[],methodIds:u.methodIds||[],
        resourcesNeeded:u.resourcesNeededV244||'',preparation:u.preparationV244||'',
        material:u.material,materials:u.materialLinksV184||[]})),
      sourceFiles:(q.sourceFilesV190||[]).map(f=>f.name)
    })),
    competencySources:curriculum(c.id),
    selectableExamTopics:typeof SC_EXAM_TOPICS_V245!=='undefined'?
      SC_EXAM_TOPICS_V245.topicsForCourse(v190PlanningSequences(c.id,y),curriculum(c.id).topics):[],
    requirements:reqs(c.id,y),requirementsConfirmed:!!savedReq(c.id,y),
    assessmentPlans:(state.yearAssessmentPlansV244||{})[reqKey(c.id,y)]||[],
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
  const shape={schema:SCHEMA,courseId:ctx.course.id,schoolYear:ctx.schoolYear,
    assessmentPlans:[{planId:'vorhandene-pruefungsplan-id',proposedDate:'',alternativeDate:'',
      coveredMainIds:['seq:reihen-id'],coveredSupplementaryIds:['seq:andere-reihe-oder-kc:curriculum-id'],
      preparationUnitTitles:['konkrete Vorbereitungsstunde'],contingency:'Welche Stunden bei Ausfall angepasst werden können'}],
    sequences:[{sequenceId:'bestehende-id-oder-leer',topicId:'belegte-curriculum-themen-id',
      title:'Reihentitel',goal:'',notes:'',units:[
      {unitId:'bestehende-id-oder-leer',title:'Thema',content:'',objective:'',competencyIds:[],methodIds:[],
        resourcesNeeded:'z.B. Plakatpapier frühzeitig besorgen',preparation:'Fach-/Methodenschritt',
        materials:[{title:'',kind:'file',catalogId:'',materialId:'',sourceArchive:'',sourcePath:'',printMode:'none',copies:0,reuse:false}]}
    ]}]};
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
    +'Feste Prüfungen in 06_LEISTUNGSNACHWEISE.json behalten EXAKT ihr bestätigtes Datum. assessmentPlans enthält MEHRERE einzelne Nachweise pro Halbjahr, nicht bloß einen pro Halbjahr. Jede noch offene Prüfung muss mit derselben planId im Ergebnisfeld assessmentPlans erscheinen. Ihre Themenkombination ist verbindlich als PRÜFUNGSSTOFF, zum Beispiel Multiplikation/Division UND Statistik/Runden in EINER Klassenarbeit; die Reihen müssen rechtzeitig davor gelehrt und wiederholt werden. Bereits geschriebene Prüfungen weder duplizieren noch erneut einplanen. Zwei weitere Arbeiten im zweiten Halbjahr sind zwei unterschiedliche Einträge. ' 
    +'ChatGPT soll für MATHEMATIK nicht jedem Curriculumthema eine eigene Klassenarbeit zuordnen. Bei sechs oder mehr Themen und weniger Arbeiten muss jede Arbeit mehrere geeignete Themen bündeln können: coveredMainIds für die Hauptthemen und coveredSupplementaryIds für ergänzende Aufgaben. Die IDs stammen ausschließlich aus selectableExamTopics in 06_LEISTUNGSNACHWEISE.json; von der Lehrkraft bereits ausgewählte Haupt-/Zusatzthemen dürfen nicht verworfen werden. Vorher noch offene Themen dürfen didaktisch vorgeschlagen werden. Zusätzlich können kurze Kompetenztests (type=test, mode=classtime oder papier) oder Unterrichtsbeobachtungen formative Lernstände sichtbar machen; nicht behaupten, jede Fachkompetenz müsse zwingend schriftlich geprüft werden. In RELIGION haben Themen und Zeiten aus der Übergabekonferenz Vorrang; unbekannte Termine für das folgende Halbjahr bleiben offen, bis die Fachkonferenz entscheidet. '
    +'Plane mögliche Prüfungstermine für jeden offenen Nachweis SELBST im Zusammenhang mit der gesamten Jahres- und Reihenplanung. Benutze die konkret verfügbaren Fachstunden, den benötigten Lern- und Wiederholungszeitraum, Ferien, Unterrichtsausfälle sowie die Schulfristen aus 02_KURS_KALENDER.json. Schlage proposedDate vor, wenn der Prüfungsstoff tatsächlich abgeschlossen ist; alternativeDate nur, wenn eine zweite sinnvolle Option existiert. Freie Termine nicht blind nach Ferientagen oder nach einer allgemeinen Faustregel auswählen. '
    +'Diese Terminvorschläge entstehen ausschließlich in deiner ChatGPT-Jahresplanung, niemals durch eine automatische Berechnung des Cockpits. Du darfst keinen Termin selbst als verbindlich markieren. Bereits fest bestätigte Prüfungen bleiben auf ihrem exakten Datum. Bereits geschriebene Prüfungen nicht neu anlegen. Begründe Engpässe und Alternativen; fehlende Terminmöglichkeiten offen kennzeichnen. '
    +'Themenzuordnung und konkrete Leistungsform beachten: Ersatzleistungsauftrag vorstellen, Bearbeitungszeit, Erinnerungen, Abgabe, Bewertung und Rückgabe mit ausreichend Zeit vor einer tatsächlich eingetragenen Notenfrist. Fehlende Fristen nicht erfinden. '
    +'Prüfe für JEDEN Leistungsnachweis zusätzlich type, mode, note, primaryTopicIds und supplementaryTopicIds in 06_LEISTUNGSNACHWEISE.json. Lies die methodischen Kompetenzen des jeweiligen Themas aus 05_KOMPETENZEN.json und verknüpfe beide Quellen ausdrücklich. Beispiel: Ist ein kurzer Test als Präsentation zum Thema Statistik/Runden eingetragen und nennt die Methodenkompetenz Plakatgestaltung und Präsentation, dann plane die erforderlichen Stunden zum Erstellen und Vorstellen des Plakats sowie die Bewertung dieser Leistung; behaupte diese konkrete Leistung aber nur, wenn sie aus den Quellen oder dem Lehrerhinweis tatsächlich hervorgeht. Die Notiz (note) der Lehrkraft ist verbindliche Kontextinformation, keine optionale Dekoration. '
    +'Berücksichtige die Schultermine ausdrücklich: Unterrichtsfreie Tage (beispielsweise SchILF) sind Sperren; Notenschluss und andere Fristen dagegen Meilensteine, keine zusätzlichen unterrichtsfreien Tage. '
    +'Die Einträge freeDates in 02_KURS_KALENDER.json unterscheiden scope=school (schulweit unterrichtsfrei) von scope=course (ausschließlich dieser Fachkurs fällt aus). Plane an course-Ausfalltagen für DIESEN Kurs keine Stunde und verschiebe nicht versehentlich die anderen Kurse. '
    +'Ordne JEDER zukünftigen Unterrichtsstunde bereits in der JAHRESPLANUNG passende belegte competencyIds und methodIds zu. In 05_KOMPETENZEN.json enthaltene methodische Pflichtkompetenzen dürfen nicht auf eine spätere Einzelstundenplanung verschoben werden: z.B. Kompetenzraster beim Standpunkt oder Plakat gestalten UND vorstellen im passenden Themenblock. Für entsprechende Stunden resourcesNeeded und preparation eintragen, damit Materialbeschaffung früh genug erfolgt. Im Ergebnis müssen alle tatsächlich verfügbaren, verpflichtenden Methodenkompetenzen einer oder mehreren Stunden bzw. bereits belegten Ist-Stunden zugeordnet sein. Fehlende Belege als Lücke kennzeichnen, nicht behaupten. '
    +'Nutze pro Reihe topicId aus der Quelle, keine unbestätigten Kompetenztitel. '
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
      timetable:ctx.timetable,freeDates:ctx.freeDates,publicHolidays:ctx.publicHolidays,
      schoolMilestones:ctx.schoolMilestones,availableSlots:ctx.availableSlots},null,2),
    '03_IST_UNTERRICHT.json':JSON.stringify(ctx.actual,null,2),
    '04_REIHEN_SOLL.json':JSON.stringify(ctx.sequences,null,2),
    '05_KOMPETENZEN.json':JSON.stringify(ctx.competencySources,null,2),
    '06_LEISTUNGSNACHWEISE.json':JSON.stringify({requirements:ctx.requirements,confirmed:ctx.requirementsConfirmed,
      selectableExamTopics:ctx.selectableExamTopics,assessmentPlans:ctx.assessmentPlans,assessments:ctx.assessments},null,2),
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
async function repairOriginalV243(index,file){
  if(!file||modal?.type!=='annualV236'||flow.phase!=='missing')
    throw Error('Der Datei-Dialog ist nicht mehr aktiv. Jahresplanung erneut öffnen.');
  const issue=flow.missingReview?.[index];
  if(!issue||issue.repairedV243)throw Error('Diese Datei ist nicht mehr offen.');
  const target=repairTargetV243(state,issue.repairTarget);
  if(!target)throw Error('Die ursprüngliche Material-/Datei-ID konnte nicht eindeutig gefunden werden. Keine neue Datei angelegt.');
  if(!file.size||file.size>480*1024*1024)throw Error('Die gewählte Datei ist leer oder größer als 480 MB und kann so nicht übernommen werden.');
  if(repairNameV243(target.expected)!==repairNameV243(file.name)){
    const okay=confirm('Der ausgewählte Dateiname weicht vom bisher gespeicherten Namen ab.\n\n'
      +'Erwartet: '+target.expected+'\nGewählt: '+file.name
      +'\n\nWirklich dieses Original mit dem bestehenden Material verknüpfen?');
    if(!okay)return false;
  }
  const record=target.record,previousKey=record[target.property],previousName=record.fileName,
    previousAvailable=record.available,newKey='repair-original-'+uid('file');
  let written=false;
  try{
    await fileStorePut(newKey,file);
    written=true;
    const verified=await fileStoreGet(newKey);
    const stored=verified?.blob||verified;
    if(!stored||stored.size!==file.size)
      throw Error('Die ausgewählte Datei konnte nicht vollständig im lokalen Dateispeicher überprüft werden.');
    record[target.property]=newKey;
    if(issue.repairTarget.kind==='material'){
      record.available=true;
      record.fileName=file.name;
    }
    await saveState();
    storedFileKeys.add(newKey);
    issue.repairedV243=true;
    issue.selectedFileV243=file.name;
    flow.repairsMadeV243=true;
    // Do not continue with the pre-repair manifest (which would omit this file).
    flow.pendingZipV242=null;
    render();
    return true;
  }catch(err){
    record[target.property]=previousKey;
    if(issue.repairTarget.kind==='material'){
      record.fileName=previousName;record.available=previousAvailable;
    }
    if(written){
      try{await fileStoreDelete(newKey);}catch(cleanup){console.warn('Temporäre Reparaturdatei konnte nicht bereinigt werden',cleanup);}
      storedFileKeys.delete(newKey);
    }
    try{await saveState();}catch(cleanup){console.error('Dateiverweis konnte nach fehlgeschlagener Reparatur nicht gesichert werden',cleanup);}
    throw err;
  }
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
// Accept only a pre-existing, explicitly confirmed cross-grade association.
function confirmedCrossGradeTopic(q,topicId,cur){
  const cfg=q?.curriculumV202;
  if(!cfg?.confirmed||!cfg.crossGradeConfirmed||cfg.topicId!==topicId)return false;
  const topic=typeof v202Topic==='function'?v202Topic(topicId):null;
  return !!topic&&topic.subject===cur.subject&&
    !(topic.grades||[]).includes(Number(cur.grade));
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
  const cur=curriculum(flow.courseId),saved=(state.yearAssessmentPlansV244||{})[reqKey(flow.courseId,flow.year)]||[];
  const retained=qs.map(q=>({title:q.title,units:(q.plan||[]).filter(u=>protectedUnit(q,u))
    .map(u=>({title:u.title,competencyIdsV202:u.competencyIdsV202||u.competencyIds||[],methodIds:u.methodIds||[]}))}));
  const manuallyDone=new Set(qs.flatMap(q=>q.curriculumV202?.manualDoneIds||[]));
  retained.push({title:'Bereits nachgewiesen',units:[{competencyIdsV202:[...manuallyDone]}]});
  const audit=V244?V244.auditPlan({sequences:data.sequences,assessments:data.assessmentPlans||[],
    topics:cur.topics,methods:cur.methods,currentSequences:retained,plannedExams:saved}):
    {missingMethods:[],methodTotal:0,methodScheduled:0,unmatchedExams:[],invalidIds:[],missingTopics:[],unknownExams:[],resourcesNeeded:[]};
  const existingById=new Map(qs.map(q=>[q.id,q]));
  const compTopic=new Map(cur.topics.map(t=>[t.id,t]));
  const topicProblems=[];
  for(const x of data.sequences){
    const old=existingById.get(x.sequenceId),declared=x.topicId||old?.curriculumV202?.topicId||'';
    const derived=V244?.deriveTopicId(x.units.flatMap(u=>u.competencyIds||[]),cur.topics)||'';
    const targetId=declared||derived;
    if(!targetId&&x.units.some(u=>(u.competencyIds||[]).length))topicProblems.push(x.title+': kein eindeutiges Curriculumthema');
    if(targetId&&!compTopic.has(targetId)&&!confirmedCrossGradeTopic(old,targetId,cur))topicProblems.push(x.title+': ungültiges Curriculumthema '+targetId);
    if(old?.curriculumV202?.confirmed&&declared&&old.curriculumV202.topicId!==declared)
      topicProblems.push(x.title+': bestehende bestätigte Curriculumzuordnung weicht ab');
  }
  const selectedTopics=V245?v245Topics():[],proposedPlans=new Map((data.assessmentPlans||[]).map(p=>[p.planId,p]));
  const topicWarnings=[];
  if(V245){
    for(const row of saved.filter(r=>r.status!=='fest'&&r.status!=='erledigt')){
      const selected=V245.selectedCoverage(row,selectedTopics),p=proposedPlans.get(row.id);
      if(selected.invalid.length)topicWarnings.push('Unbekannte zugeordnete Themen: '+selected.invalid.join(', '));
      if(selected.duplicated.length)topicWarnings.push('Thema zugleich Haupt- und Zusatzstoff: '+selected.duplicated.join(', '));
      if(p){
        const main=V245.tidyIds(p.coveredMainIds),extra=V245.tidyIds(p.coveredSupplementaryIds);
        const notAvailable=[...main,...extra].filter(x=>!selectedTopics.some(t=>t.id===x));
        if(notAvailable.length)topicWarnings.push('Unbelegte Prüfungs-Themen-IDs: '+notAvailable.join(', '));
        const dropped=[...selected.primary.filter(x=>!main.includes(x)),
          ...selected.extra.filter(x=>!extra.includes(x))];
        if(dropped.length)topicWarnings.push('Vorgegebener Prüfungsstoff fehlt im ChatGPT-Plan: '+row.topic+' ('+dropped.join(', ')+')');
      }
    }
  }
  const topicCoverage=new Map();
  const currentById=new Map(qs.map(q=>[q.id,q]));
  const addTopicIds=(topicId,ids)=>{
    if(!topicId||!compTopic.has(topicId))return;
    if(!topicCoverage.has(topicId))topicCoverage.set(topicId,new Set());
    const set=topicCoverage.get(topicId);
    for(const id of ids||[])set.add(id);
  };
  // Existing protected lessons, and all lessons of sequences omitted from the import, survive.
  for(const q of qs){
    const isReplaced=data.sequences.some(x=>x.sequenceId===q.id);
    const preserved=(q.plan||[]).filter(u=>!isReplaced||protectedUnit(q,u));
    addTopicIds(q.curriculumV202?.topicId,preserved.flatMap(u=>
      [...(u.competencyIdsV202||[]),...(u.competencyIds||[]),...(u.methodIds||[])]));
    addTopicIds(q.curriculumV202?.topicId,q.curriculumV202?.manualDoneIds||[]);
  }
  for(const x of data.sequences){
    const old=currentById.get(x.sequenceId);
    const topicId=x.topicId||old?.curriculumV202?.topicId||
      (V244?.deriveTopicId(x.units.flatMap(u=>u.competencyIds||[]),cur.topics)||'');
    addTopicIds(topicId,x.units.flatMap(u=>[...(u.competencyIds||[]),...(u.methodIds||[])]));
  }
  const isAdditional=c=>typeof v202ExtensionLike==='function'
    ?v202ExtensionLike(c)
    :String(c?.level||'').toLowerCase()==='erweitert'||/(nur\s+e|e-niveau|e-kurs)/i.test(String(c?.category||''));
  const coreGaps=[];
  for(const [topicId,covered] of topicCoverage){
    const topic=compTopic.get(topicId);
    // The 2026/27 conference may explicitly split one legacy curriculum topic
    // across two sequences (e.g. Grundrechenarten I vs II). Respect each
    // sequence's saved V206 allowlist, not every competency of the older tableau.
    const participants=qs.filter(q=>q.curriculumV202?.confirmed&&
      q.curriculumV202?.topicId===topicId);
    const imported=data.sequences.filter(x=>x.topicId===topicId||
      currentById.get(x.sequenceId)?.curriculumV202?.topicId===topicId);
    const required=new Map();
    for(const q of participants){
      const allow=Array.isArray(q.curriculumV202?.competencyAllowlistV206)?
        new Set(q.curriculumV202.competencyAllowlistV206):null;
      const effective=typeof v202SequenceCompetencies==='function'
        ?v202SequenceCompetencies(q)
        :(topic?.competencies||[]).filter(c=>!allow||allow.has(c.id));
      for(const c of effective){
        if(!isAdditional(c)&&!optionalCurriculumCompetency(c))required.set(c.id,c);
      }
    }
    // New rows without a confirmed existing curricular profile use the actual
    // tableau instead, until a teacher verifies an explicit subset.
    if(imported.some(x=>!currentById.has(x.sequenceId))||!participants.length){
      for(const c of topic?.competencies||[])if(!isAdditional(c)&&!optionalCurriculumCompetency(c))required.set(c.id,c);
    }
    for(const competency of required.values()){
      if(covered.has(competency.id))continue;
      coreGaps.push('Kernkompetenz nicht eingeplant: '+competency.text+
        ' ('+competency.id+' · '+topic.title+')');
    }
  }
  const blockers=[
    ...coreGaps,
    ...topicWarnings,
    ...audit.unmatchedExams.map(x=>'Leistungsnachweis ohne Planungsbezug: '+x),
    ...audit.unknownExams.map(x=>'Unbekannte Prüfungs-ID: '+x),
    ...audit.missingMethods.map(m=>'Methodenkompetenz fehlt: '+m.text+' ('+m.id+')'),
    ...audit.invalidIds.map(x=>'Unbekannte Kompetenz-ID: '+x),
    ...topicProblems
  ];
  return {sequences:data.sequences.length,units,protected:protectedCount,unmatched,
    warnings:[...new Set(warnings)].slice(0,15),audit,topicProblems,blockers};
}
async function applyImport(){
  if(flow.preview?.blockers?.length)throw Error('Ungültige Jahresplanung: fehlende Prüfungen/Methodenkompetenzen.');
  const before={sequences:clone(state.sequences),lessons:clone(state.lessons),materials:clone(state.materials),
    examPlans:clone(state.yearAssessmentPlansV244||{})};
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
        // V202 competency overview uses competencyIdsV202, not competencyIds.
        u.competencyIdsV202=[...new Set([...u.competencyIds,...u.methodIds])];
        u.resourcesNeededV244=String(i.resourcesNeeded||'').slice(0,750);
        u.preparationV244=String(i.preparation||'').slice(0,750);
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
      const cur=curriculum(flow.courseId);
      const currentTopic=q.curriculumV202?.confirmed?q.curriculumV202.topicId:'';
      const incomingTopic=d.topicId||currentTopic||(V244?.deriveTopicId(
        d.units.flatMap(u=>u.competencyIds||[]),cur.topics)||'');
      if(incomingTopic){
        const preservedCrossGrade=confirmedCrossGradeTopic(q,incomingTopic,cur);
        if(!cur.topics.some(t=>t.id===incomingTopic)&&!preservedCrossGrade)
          throw Error('Nicht belegtes Curriculumthema für '+q.title);
        if(currentTopic&&currentTopic!==incomingTopic)throw Error('Bestätigte Curriculumzuordnung darf nicht stillschweigend geändert werden: '+q.title);
        // Keep the conference-approved V206 allowlist, evidence and source notes.
        // Never re-confirm or silently rewrite an existing cross-grade association.
        if(!preservedCrossGrade){
          const methods=[...new Set([...(q.curriculumV202?.methodIds||[]),
            ...q.plan.flatMap(u=>u.methodIds||[])])];
          v202SetTopic(q,incomingTopic,methods);
        }
      }
    }
    if(V244&&Array.isArray(flow.data.assessmentPlans)){
      const key=reqKey(flow.courseId,flow.year),saved=state.yearAssessmentPlansV244?.[key]||[];
      const byId=new Map(flow.data.assessmentPlans.map(p=>[p.planId,p]));
      for(const row of saved){
        if(['fest','erledigt'].includes(row.status))continue;
        const proposed=byId.get(row.id);if(!proposed)continue;
        if(V245){
          const available=v245Topics(),known=new Set(available.map(t=>t.id));
          if(!(row.primaryTopicIds||[]).length&&Array.isArray(proposed.coveredMainIds))
            row.primaryTopicIds=V245.tidyIds(proposed.coveredMainIds).filter(id=>known.has(id));
          if(!(row.supplementaryTopicIds||[]).length&&Array.isArray(proposed.coveredSupplementaryIds))
            row.supplementaryTopicIds=V245.tidyIds(proposed.coveredSupplementaryIds).filter(id=>known.has(id));
          if(!row.topic){
            const texts=[...row.primaryTopicIds.map(id=>available.find(t=>t.id===id)?.title).filter(Boolean),
              ...row.supplementaryTopicIds.map(id=>available.find(t=>t.id===id)?.title).filter(Boolean)];
            if(texts.length)row.topic=texts.join(' + ');
          }
        }
        for(const field of ['proposedDate','alternativeDate']){
          if(row[field]||!V244.isoValid(proposed[field])||!proposed[field])continue;
          const d=proposed[field],math=v202SubjectKey(cls(flow.courseId))==='mathematik';
          if(math&&(d<currentDate()||!v190CourseSlots(flow.courseId,flow.year).some(slot=>slot.date===d)))continue;
          row[field]=d;
          if(field==='proposedDate')row.suggestedByV245='ChatGPT (vorläufig)';
        }
        if(row.proposedDate&&row.status==='offen')row.status='vorschlag';
        row.contingencyV244=String(proposed.contingency||'').slice(0,900);
        row.preparationUnitTitlesV244=Array.isArray(proposed.preparationUnitTitles)?
          proposed.preparationUnitTitles.map(String).slice(0,18):[];
      }
    }
    const schedule=v190RescheduleCourseYear(flow.courseId,flow.year,true);
    if(schedule.warning?.includes('kein Stundenplan'))throw Error(schedule.warning);
    // No local "helpful" date generation: only ChatGPT proposals are imported.
    await saveState();
    // Only clear a work-in-progress checkpoint after successful plan persistence.
    await v246ClearDraft(flow.courseId,flow.year);
    flow={courseId:'',year:'',phase:'setup',raw:'',data:null,preview:null};
    modal=null;render();
    alert('Restjahr importiert: '+changed+' bestehende Reihen, '+created+' neue Reihen. '+unmatched+' Materialreferenzen müssen noch geprüft werden.'+(schedule.warning?'\n'+schedule.warning:''));
  }catch(e){
    state.sequences=before.sequences;state.lessons=before.lessons;state.materials=before.materials;
    state.yearAssessmentPlansV244=before.examPlans;
    try{await saveState();}catch(err){console.error('Rollback-Speicherung fehlgeschlagen',err);}
    throw e;
  }
}
// V0.24.4: explicit independent assessments, so two exams in a semester are
// not reduced to one "type + note" field. Existing confirmed exams stay in state.assessments.
const V244=typeof SC_YEAR_RULES_V244!=='undefined'?SC_YEAR_RULES_V244:null;
const v244OldSlots=typeof v190CourseSlots==='function'?v190CourseSlots:null;
if(v244OldSlots)v190CourseSlots=function(cid,year){
 // An explicitly cancelled lesson is no longer a usable teaching slot. The
 // scheduler may shift unfinished content, but NEVER move confirmed exam dates.
 return v244OldSlots(cid,year).filter(slot=>!(state.lessons||[]).some(l=>
   l.classId===cid&&l.date===slot.date&&l.executionV180?.type==='cancelled'&&
   (l.timetableId&&slot.timetableId?l.timetableId===slot.timetableId:
    Number(lessonSlot(l))===Number(slot.slot))));
};
function v244RowsKey(){return reqKey(flow.courseId,flow.year);}
function v244Rows(){return (flow.assessmentDraftV244||[]);}
function v244OriginalRows(){if(!V244)return [];return clone((state.yearAssessmentPlansV244||{})[v244RowsKey()]||[]);}
function v244Capture(){
  if(!V244||!flow.assessmentDraftV244)return;
  document.querySelectorAll('[data-v244-field]').forEach(el=>{
    const [index,field]=el.dataset.v244Field.split('|'),row=v244Rows()[Number(index)];
    if(row&&['half','type','topic','note','mode','status','confirmedDate','planningModeV257'].includes(field))
      {if((field==='proposedDate'||field==='alternativeDate')&&row[field]!==el.value)row.suggestedByV245='Lehrkraft';
      row[field]=field==='half'?Number(el.value):el.value;}
  });
  v245CaptureTopics();
}

const V245=typeof SC_EXAM_TOPICS_V245!=='undefined'?SC_EXAM_TOPICS_V245:null;
function v245Topics(){
  if(!V245)return [];
  return V245.topicsForCourse(v190PlanningSequences(flow.courseId,flow.year),curriculum(flow.courseId).topics);
}
function v245CaptureTopics(){
  if(!V245||!flow.assessmentDraftV244)return;
  const options=v245Topics(),by=new Map(options.map(t=>[t.id,t]));
  document.querySelectorAll('[data-v245-topic]').forEach(el=>{
    const bits=el.dataset.v245Topic.split('|'),row=v244Rows()[Number(bits[0])],id=bits.slice(1).join('|');
    if(!row||!by.has(id)||row.status==='fest')return;
    row.primaryTopicIds=(row.primaryTopicIds||[]).filter(x=>x!==id);
    row.supplementaryTopicIds=(row.supplementaryTopicIds||[]).filter(x=>x!==id);
    if(el.value==='primary')row.primaryTopicIds.push(id);
    if(el.value==='supplementary')row.supplementaryTopicIds.push(id);
  });
  for(const row of v244Rows()){
    const selected=(row.primaryTopicIds||[]).length+(row.supplementaryTopicIds||[]).length;
    if(selected&&v202SubjectKey(cls(flow.courseId))==='mathematik'){
      const primary=(row.primaryTopicIds||[]).map(id=>by.get(id)?.title).filter(Boolean);
      const extra=(row.supplementaryTopicIds||[]).map(id=>by.get(id)?.title).filter(Boolean);
      row.topic=[primary.join(' + '),extra.length?'Zusatzaufgabe(n): '+extra.join(' + '):''].filter(Boolean).join(' · ');
      row.autoTopicV245=row.topic;
      continue;
    }
    const current=String(row.topic||'').trim();
    if(current&&current!==String(row.autoTopicV245||''))continue;
    const title=(row.primaryTopicIds||[]).map(x=>by.get(x)?.title).filter(Boolean);
    const extra=(row.supplementaryTopicIds||[]).map(x=>by.get(x)?.title).filter(Boolean);
    row.topic=[title.join(' + '),extra.length?'Ergänzend: '+extra.join(' + '):''].filter(Boolean).join(' · ');
    row.autoTopicV245=row.topic;
  }
}
function v245UnlinkedFixedCounts(rows){
  const linked=new Set((rows||[]).map(r=>r.assessmentId).filter(Boolean));
  const totals={1:0,2:0},start=Number(String(flow.year).slice(0,4));
  for(const a of (state.assessments||[])){
    if(a.classId!==flow.courseId||!a.date||v190YearFromDate(a.date)!==flow.year||linked.has(a.id))continue;
    if(!/klassenarbeit/i.test(String(a.type||'')))continue;
    const half=a.date<=(start+1)+'-01-31'?1:2;
    totals[half]++;
  }
  return totals;
}
const v259RevealUsedTopics=new Set();
function v245TopicHtml(row,i){
  if(!V245||v202SubjectKey(cls(flow.courseId))!=='mathematik'||row.status==='fest')return '';
  const options=v245Topics();if(!options.length)return '<p class="microcopy">Noch keine Reihen/Curriculumthemen verfügbar.</p>';
  const picked=(row.primaryTopicIds||[]).length+(row.supplementaryTopicIds||[]).length;
  const otherUsed=new Set(v244Rows().filter(x=>x.id!==row.id).flatMap(x=>[...(x.primaryTopicIds||[]),...(x.supplementaryTopicIds||[])]));
  const visible=options.filter(t=>v259RevealUsedTopics.has(row.id)||!otherUsed.has(t.id)||
    (row.primaryTopicIds||[]).includes(t.id)||(row.supplementaryTopicIds||[]).includes(t.id));
  const hidden=options.length-visible.length;
  return '<details class="v245-topics"><summary>Themen auswählen · '+picked+' ausgewählt</summary>'
    +'<p class="microcopy">Wähle ein oder mehrere Hauptthemen und bei Bedarf weitere Themen für Zusatzaufgaben. Du musst nicht jedes Curriculumthema in einer Klassenarbeit prüfen.</p>'
    +(otherUsed.size?'<button class="text-button" type="button" data-v259-used="'+esc(row.id)+'">'+
      (v259RevealUsedTopics.has(row.id)?'Bereits anderweitig zugeordnete Themen ausblenden':'Bereits vergebene Themen anzeigen')+'</button>':'')+
    (hidden?'<p class="microcopy">'+hidden+' Thema/Themen sind bereits anderen Leistungsnachweisen zugeordnet und daher ausgeblendet.</p>':'')+
    '<div class="v245-topic-table">'+visible.map(t=>{
      const value=(row.primaryTopicIds||[]).includes(t.id)?'primary':
        (row.supplementaryTopicIds||[]).includes(t.id)?'supplementary':'none';
      return '<label class="v245-topic-row"><span><strong>'+esc(t.title)+'</strong><small>'
        +esc(t.origin)+(t.hours?' · '+t.hours+' geplante Stunden':'')+'</small></span>'
        +'<select data-v245-topic="'+i+'|'+esc(t.id)+'">'
        +[['none','Nicht in dieser Arbeit'],['primary','Hauptthema'],['supplementary','Zusatzaufgabe']].map(x=>
          '<option value="'+x[0]+'" '+(value===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')
        +'</select></label>';
    }).join('')+'</div></details>';
}
function v244ExamHtml(){
  if(!V244)return '<p class="v236-warn">Die erweiterte Leistungsnachweisplanung konnte nicht geladen werden. Bitte die Seite neu laden.</p>';
  const rows=v244Rows(),fixedCounts=v245UnlinkedFixedCounts(rows),actual=(state.assessments||[]).filter(a=>
    a.classId===flow.courseId&&v190YearFromDate(a.date)===flow.year);
  const type=[['klassenarbeit','Klassenarbeit'],['klausur','Klausur'],['ersatzleistung','Ersatzleistung'],['fachleistung','Fachspezifische Leistung'],['test','Kurzer Kompetenztest']];
  const statuses={offen:'Noch offen',vorschlag:'Terminvorschlag',fest:'Verbindlich',erledigt:'Erledigt'};
  const selected=(key,current,items,locked=false)=>'<select data-v244-field="'+key+'" '+(locked?'disabled':'')+'>'
    +items.map(([v,label])=>'<option value="'+v+'" '+(v===current?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select>';
  const cards=rows.map((row,i)=>{
    const fixed=row.status==='fest',kind=type.find(x=>x[0]===row.type)?.[1]||'Nachweis';
    return '<section class="v244-exam-row"><header><strong>'+(i+1)+'. '+esc(kind)+'</strong><span>'+esc(statuses[row.status]||'Noch offen')+'</span></header>'
      +'<div class="v244-exam-fields"><label>Halbjahr'+selected(i+'|half',row.half,[[1,'1. Halbjahr'],[2,'2. Halbjahr']],fixed)+'</label>'
      +'<label>Art'+selected(i+'|type',row.type,type,fixed)+'</label>'
      +'<label>Status'+selected(i+'|status',row.status,
        fixed?[['fest','Verbindlich – gesperrt']]:[['offen','Noch offen'],['vorschlag','ChatGPT-Vorschlag vorhanden'],['erledigt','Bereits geschrieben']],fixed)+'</label>'
      +'<label>Durchführung'+selected(i+'|mode',row.mode||'offen',
        [['offen','Noch offen'],['classtime','Classtime'],['papier','Papier'],['praesentation','Präsentation'],['sonstiges','Sonstige Form']],fixed)+'</label>'
      +v245TopicHtml(row,i)
      +(v202SubjectKey(cls(flow.courseId))!=='mathematik'&&!fixed?
       '<label class="v244-span">Thema / Prüfungsstoff (optional)<input data-v244-field="'+i+'|topic" value="'+esc(row.topic)+'"></label>':'')
      +(row.topic?'<p class="microcopy v244-span">Prüfungsstoff: '+esc(row.topic)+'</p>':'')
      +(!fixed&&row.status!=='erledigt'?'<label class="v244-span">Terminplanung'+selected(i+'|planningModeV257',row.planningModeV257||'chatgpt',
        [['chatgpt','ChatGPT soll beim Jahresplan einen Termin vorschlagen'],['fixed','Termin steht bereits verbindlich fest']])+'</label>':'')
      +(!fixed&&row.status!=='erledigt'&&row.planningModeV257==='fixed'?
        '<label class="v244-span">Verbindliches Datum<input type="date" data-v244-field="'+i+'|confirmedDate" value="'+esc(row.confirmedDate||'')+'"></label>':'')
      +(!fixed&&row.proposedDate?'<p class="microcopy v244-span">ChatGPT-Vorschlag (unverbindlich): '+esc(row.proposedDate)
        +(row.alternativeDate?' · Alternative: '+esc(row.alternativeDate):'')+'</p>':'')
      +(row.dateWarningV245?'<p class="microcopy v244-span">'+esc(row.dateWarningV245)+'</p>':'')
      +'<label class="v244-span">Hinweise / Absprachen<input data-v244-field="'+i+'|note" value="'+esc(row.note||'')+'" '+(fixed?'disabled':'')+' placeholder="z. B. mit Mathekollegium abstimmen"></label></div>'
      +'<div class="v244-exam-actions">'
      +(fixed?'<span class="v244-fixed">🔒 Termin verbindlich: '+esc(row.confirmedDate||'laut bestehender Prüfung')+'</span>':
        '<button class="text-button" data-v244-remove="'+i+'">Eintrag entfernen</button>'
        +(row.planningModeV257==='fixed'&&row.status!=='erledigt'?
          '<button class="secondary" data-v244-fix="'+i+'">Diesen Termin verbindlich speichern</button>':''))
      +'</div></section>';
  }).join('');
  const saved=actual.filter(a=>!rows.some(x=>x.assessmentId===a.id));
  return '<section class="v244-exam-editor"><div class="section-head"><div><span class="eyebrow">EINZELNE LEISTUNGSNACHWEISE</span>'
    +'<h3>Anzahl, Themen und Terminsicherheit</h3></div></div>'
    +'<p class="microcopy">Erfasse Anzahl, Halbjahr, Status und Themen. ChatGPT ermittelt offene Prüfungstermine später aus der gesamten Jahresplanung. Steht ein Termin bereits fest, gib sein Datum ein und speichere ihn ausdrücklich verbindlich. Bereits geschriebene und feste Arbeiten bleiben geschützt.</p>'
    +(v202SubjectKey(cls(flow.courseId))==='mathematik'?'<div class="v245-count"><label>1. Halbjahr: Anzahl Klassenarbeiten<input type="number" min="0" max="10" data-v245-count="1" value="'+(rows.filter(x=>x.half===1&&x.type==='klassenarbeit').length+fixedCounts[1])+'"></label>'
       +'<label>2. Halbjahr: Anzahl Klassenarbeiten<input type="number" min="0" max="10" data-v245-count="2" value="'+(rows.filter(x=>x.half===2&&x.type==='klassenarbeit').length+fixedCounts[2])+'"></label>'
       +'<button class="secondary" data-v245-set-count>Anzahl übernehmen</button></div>':'')
    +'<div class="v244-exam-list">'+(cards||'<p>Noch keine einzelnen zukünftigen Leistungsnachweise erfasst.</p>')+'</div>'
    +'<div class="v244-adds"><button class="secondary" data-v244-add="1">+ Nachweis im 1. Halbjahr</button>'
    +'<button class="secondary" data-v244-add="2">+ Nachweis im 2. Halbjahr</button>'
    +'<button class="secondary" data-v245-test="1">+ Kurzer Test im 1. Halbjahr</button>'
    +'<button class="secondary" data-v245-test="2">+ Kurzer Test im 2. Halbjahr</button>'
    +'<button class="secondary" data-v246-fachleistung>+ Fachspezifische Leistung</button></div>'
    +(saved.length?'<details><summary>'+saved.length+' bereits fest eingetragene Prüfungen (unverändert)</summary>'
      +saved.map(a=>'<p>'+esc(a.date+' · '+(a.title||a.type||'Leistungsnachweis'))+'</p>').join('')+'</details>':'')
    +'</section>';
}
const v244OldEditor=requirementEditor;
function v257ScheduleHtml(){
 const count=yearMilestones(flow.year).length;
 return '<section class="v244-exam-editor"><h3>Schulkalender für '+esc(flow.year)+'</h3>'+
   '<p class="microcopy">Ferien, SchILF, Studientage und Notenfristen verwaltest du zentral im eigenen Reiter <strong>Schulkalender</strong>. '+count+' Frist(en) sind bereits hinterlegt und werden im Planungs-Prompt berücksichtigt.</p>'+
   '<button class="secondary" type="button" data-v259-go-calendar>Zum Schulkalender →</button></section>';
}
requirementEditor=function(){
 // Mathematics uses individual assessment cards; the old one-entry-per-half
 // summary is redundant and led to conflicting instructions.
 return (v202SubjectKey(cls(flow.courseId))==='mathematik'?'':v244OldEditor())+
   v244ExamHtml()+v257ScheduleHtml();
};
const v244OldOpen=openFlow;
openFlow=function(cid,onlyRules){
 const same=!onlyRules&&flow.courseId===cid&&flow.year===v190PlanningYear()&&flow.phase!=='rules';
 const preserved=same?flow.assessmentDraftV244:null;
 v244OldOpen(cid,onlyRules);
 flow.assessmentDraftV244=preserved||v244OriginalRows().map(V244?V244.tidy:x=>x);
 render();
};
async function v244PersistRows(capture=true){
 if(!V244)return;
 if(capture)v244Capture();
 const list=v244Rows().map(V244.tidy);
 for(const row of list)if(row.status==='offen'&&row.proposedDate)row.status='vorschlag';
 const errors=V244.checkRows(list,flow.year);
 if(errors.length)throw Error(errors.join('\n'));
 const prev=clone(state.yearAssessmentPlansV244||{});
 state.yearAssessmentPlansV244=state.yearAssessmentPlansV244||{};
 state.yearAssessmentPlansV244[v244RowsKey()]=list;
 try{await saveState();}catch(e){state.yearAssessmentPlansV244=prev;throw e;}
 flow.assessmentDraftV244=clone(list);
}
const v244OriginalSave=saveRules;
saveRules=async function(){
 if(!V244)return v244OriginalSave();
 // Save both forms together. Previously the old save re-rendered before the
 // selected curriculum topics were persisted, reverting the current fields.
 v244Capture();
 const key=v244RowsKey(),rows=v244Rows().map(V244.tidy),
   rules=v202SubjectKey(cls(flow.courseId))==='mathematik'?reqs(flow.courseId,flow.year):readRules();
 const errors=V244.checkRows(rows,flow.year);
 if(errors.length)throw Error(errors.join('\n'));
 if(rows.some(x=>x.status!=='fest'&&x.status!=='erledigt'&&x.planningModeV257==='fixed'))
   throw Error('Ein fester Termin muss zuerst über „Diesen Termin verbindlich speichern“ bestätigt werden.');
 const oldRules=clone(state.yearRequirementsV236||{}),oldPlans=clone(state.yearAssessmentPlansV244||{});
 state.yearRequirementsV236=state.yearRequirementsV236||{};
 state.yearRequirementsV236[key]=rules.map((r,i)=>({...reqs(flow.courseId,flow.year)[i],...r}));
 state.yearAssessmentPlansV244=state.yearAssessmentPlansV244||{};
 state.yearAssessmentPlansV244[key]=rows;
 try{await saveState();}catch(e){
   state.yearRequirementsV236=oldRules;state.yearAssessmentPlansV244=oldPlans;throw e;
 }
 flow.assessmentDraftV244=clone(rows);render();
};
async function v244Fix(index){
 if(!V244)return;
 v244Capture();
 const row=v244Rows()[index];
 if(!row||['fest','erledigt'].includes(row.status))return;
 const date=row.confirmedDate,cid=flow.courseId;
 if(!date||!V244.isoValid(date))throw Error('Bitte zuerst das verbindliche Datum eintragen.');
 if(!row.topic.trim())throw Error('Bitte Themen bzw. Prüfungsstoff angeben.');
 const bounds=v190YearBounds(flow.year);
 if(date<bounds.start||date>bounds.end)throw Error('Der Termin liegt außerhalb des Schuljahres.');
 if(v190NoSchoolInfo(date,cid))throw Error('Dieser Fachtermin ist im Schulkalender als Unterrichtsausfall eingetragen.');
 const daySlots=(state.timetable||[]).filter(t=>t.classId===cid&&Number(t.weekday)===(new Date(date+'T12:00:00').getDay()||7));
 if(!daySlots.length||!v190CourseSlots(cid,flow.year).some(s=>s.date===date))
   throw Error('An diesem Tag ist kein freier Fachtermin vorhanden (z.B. ausgefallen, Ferien oder bereits belegt).');
 const collision=V244.conflictOnFixedDate(date,cid,state.assessments,state.lessons,v191LessonProtected);
 if(collision.existing.length)throw Error('Für diesen Kurs ist an diesem Tag bereits ein verbindlicher Leistungsnachweis eingetragen.');
 if(collision.protectedLessons.length)throw Error('Für diesen Tag ist eine gehaltene oder konkret ausgearbeitete Unterrichtsstunde geschützt. Bitte die Situation zunächst klären.');
 if(!confirm('LEISTUNGSNACHWEIS VERBINDLICH FESTLEGEN?\n\n'+row.topic+'\n'+date
   +'\n\nDieser Termin wird als fester Leistungsnachweis gespeichert und bei späteren Stundenverschiebungen nicht automatisch geändert. Wirklich bestätigen?'))return;
 const before={assessments:clone(state.assessments),sequences:clone(state.sequences),lessons:clone(state.lessons),
  plans:clone(state.yearAssessmentPlansV244||{})};
 try{
   const a={id:uid('assess'),classId:cid,date,type:row.type==='ersatzleistung'?'Ersatzleistung':row.type==='fachleistung'?'Fachspezifische Leistung':row.type==='klausur'?'Klausur':row.type==='test'?'Test':'Klassenarbeit',
     title:row.topic,scope:row.topic,notes:row.note||'Verbindlich durch Lehrkraft festgelegt.',
     files:[],yearPlanIdV244:row.id,createdAt:new Date().toISOString()};
   state.assessments=state.assessments||[];state.assessments.push(a);
   row.status='fest';row.confirmedDate=date;row.assessmentId=a.id;row.planningModeV257='fixed';
   await v244PersistRows(false);
   await saveState();render();
   alert('Termin verbindlich gespeichert. Er wird im nächsten ChatGPT-Jahresplan berücksichtigt. Bereits geplante Unterrichtsstunden wurden nicht automatisch verschoben.');
 }catch(e){
   state.assessments=before.assessments;state.sequences=before.sequences;state.lessons=before.lessons;
   state.yearAssessmentPlansV244=before.plans;
   flow.assessmentDraftV244=clone(before.plans[v244RowsKey()]||[]);
   try{await saveState();}catch(err){console.error('Rollback Leistungsnachweis fehlgeschlagen',err);}
   throw e;
 }
}
const v244PreviousWire=wire;
wire=function(){
 v244PreviousWire();
 document.querySelectorAll('[data-v244-field]').forEach(input=>input.addEventListener('change',()=>v244Capture()));
 document.querySelectorAll('[data-v244-add]').forEach(b=>b.onclick=()=>{
   v244Capture();if(v244Rows().length>=20)return alert('Maximal 20 Leistungsnachweise.');
   const c=cls(flow.courseId),legacy=reqs(flow.courseId,flow.year)[Number(b.dataset.v244Add)-1];
   flow.assessmentDraftV244.push(V244.tidy({id:uid('exam-plan'),half:Number(b.dataset.v244Add),
     type:['klassenarbeit','klausur','ersatzleistung'].includes(legacy.type)?legacy.type:
       v202SubjectKey(c)==='mathematik'?'klassenarbeit':'ersatzleistung'}));
   render();
 });
 document.querySelectorAll('[data-v244-remove]').forEach(b=>b.onclick=()=>{
   v244Capture();const row=v244Rows()[Number(b.dataset.v244Remove)];
   if(!row||row.status==='fest')return;
   flow.assessmentDraftV244.splice(Number(b.dataset.v244Remove),1);render();
 });
 document.querySelectorAll('[data-v244-fix]').forEach(b=>b.onclick=()=>{
   v244Fix(Number(b.dataset.v244Fix)).catch(e=>alert('Termin NICHT fixiert: '+(e.message||e)));
 });
 document.querySelectorAll('[data-v245-topic]').forEach(el=>el.addEventListener('change',()=>{
   v244Capture();
   const i=Number(el.dataset.v245Topic.split('|')[0]),row=v244Rows()[i];
   const details=el.closest?.('.v245-topics'),summary=details?.querySelector('summary');
   if(summary&&row)summary.textContent='Themen auswählen · '+
     ((row.primaryTopicIds||[]).length+(row.supplementaryTopicIds||[]).length)+' ausgewählt';
 }));
 document.querySelectorAll('[data-v259-used]').forEach(b=>b.addEventListener('click',()=>{
   v244Capture();
   const id=b.dataset.v259Used;
   if(v259RevealUsedTopics.has(id))v259RevealUsedTopics.delete(id);
   else v259RevealUsedTopics.add(id);
   render();
   document.querySelector('[data-v259-used="'+id+'"]')?.closest('details')?.setAttribute('open','');
 }));
 document.querySelectorAll('[data-v244-field$="|planningModeV257"]').forEach(el=>el.addEventListener('change',()=>{
   v244Capture();render();
 }));
 document.querySelector('[data-v245-set-count]')?.addEventListener('click',()=>{
   v244Capture();
   const rows=v244Rows(),desired={};
   const existing=v245UnlinkedFixedCounts(rows);
   for(const half of [1,2]){
     const field=document.querySelector('[data-v245-count="'+half+'"]');
     desired[half]=Math.max(0,Math.min(10,Number(field?.value||0)));
     if(desired[half]<existing[half]){
       alert('Es sind bereits '+existing[half]+' feste Klassenarbeiten im '+half+'. Halbjahr vorhanden. Diese können durch die Anzahl-Auswahl nicht gelöscht werden.');return;
     }
     const current=rows.filter(x=>x.half===half&&x.type==='klassenarbeit');
     if(desired[half]-existing[half]<current.length){
       const removable=current.filter(x=>x.status==='offen'&&!x.topic&&!x.proposedDate&&!x.alternativeDate);
       if(removable.length<current.length-(desired[half]-existing[half])){
         alert('Die Anzahl kann nicht automatisch reduziert werden, weil bereits Themen/Termine oder bestätigte Arbeiten vorhanden sind. Entferne nur die gewünschten offenen Einträge einzeln.');
         return;
       }
     }
   }
   for(const half of [1,2]){
     let current=rows.filter(x=>x.half===half&&x.type==='klassenarbeit');
     while(current.length<desired[half]-existing[half]){
       const item=V244.tidy({id:uid('exam-plan'),half,type:'klassenarbeit'});
       rows.push(item);current.push(item);
     }
     while(current.length>desired[half]-existing[half]){
       const item=[...current].reverse().find(x=>x.status==='offen'&&!x.topic&&!x.proposedDate&&!x.alternativeDate);
       if(!item)break;rows.splice(rows.indexOf(item),1);current.splice(current.indexOf(item),1);
     }
   }
   render();
 });
 document.querySelector('[data-v246-fachleistung]')?.addEventListener('click',()=>{
   v244Capture();
   if(v244Rows().length>=20)return alert('Maximal 20 Leistungsnachweise.');
   flow.assessmentDraftV244.push(V244.tidy({id:uid('exam-plan'),half:1,type:'fachleistung',
     mode:'praesentation',status:'offen'}));
   render();
 });
 document.querySelectorAll('[data-v245-test]').forEach(b=>b.onclick=()=>{
   v244Capture();if(v244Rows().length>=20)return alert('Maximal 20 Leistungsnachweise.');
   flow.assessmentDraftV244.push(V244.tidy({id:uid('exam-plan'),half:Number(b.dataset.v245Test),
     type:'test',mode:'classtime',status:'offen'}));
   render();
 });
 document.querySelector('[data-v259-go-calendar]')?.addEventListener('click',async()=>{
   try{await v244PersistRows();view='school-calendar';modal=null;render();}
   catch(e){alert('Bitte die Angaben zunächst korrigieren: '+(e.message||e));}
 });
 document.querySelector('[data-v257-calendar]')?.addEventListener('click',()=>{
   v244Capture();v190CalendarDraft={year:flow.year};modal={type:'calendarV190'};render();
 });
 document.querySelector('[data-v257-add]')?.addEventListener('click',async()=>{
   const date=document.getElementById('v257-milestone-date')?.value||'',
     title=(document.getElementById('v257-milestone-title')?.value||'').trim();
   const bounds=v190YearBounds(flow.year);
   if(!date||!V244.isoValid(date)||date<bounds.start||date>bounds.end||!title)
     return alert('Bitte eine Frist mit Bezeichnung und Datum innerhalb des Schuljahres eintragen.');
   const before=clone(state.yearMilestonesV257||{});
   state.yearMilestonesV257=state.yearMilestonesV257||{};
   state.yearMilestonesV257[flow.year]=[...yearMilestones(flow.year),{id:uid('milestone'),date,title:title.slice(0,140)}];
   try{await saveState();render();}catch(e){state.yearMilestonesV257=before;alert('Frist nicht gespeichert: '+(e.message||e));}
 });
 document.querySelectorAll('[data-v257-remove]').forEach(b=>b.addEventListener('click',async()=>{
   const before=clone(state.yearMilestonesV257||{});
   state.yearMilestonesV257[flow.year]=yearMilestones(flow.year).filter(x=>x.id!==b.dataset.v257Remove);
   try{await saveState();render();}catch(e){state.yearMilestonesV257=before;alert('Frist nicht entfernt: '+(e.message||e));}
 }));
};

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
  document.querySelectorAll('[data-v247-archive]').forEach(input=>input.addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;input.disabled=true;
    try{
      const result=await v247RelinkArchive(Number(input.dataset.v247Archive),file);
      if(result){alert('Originalarchiv verbunden: '+result.matched+'/'+result.total+' Katalogdateien gefunden. Materialprüfung wird aktualisiert.');await exportZip();}
    }catch(err){alert('Archiv NICHT verbunden: '+(err.message||err));}
    finally{input.disabled=false;input.value='';}
  }));
  document.querySelectorAll('[data-v243-file]').forEach(input=>input.addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    input.disabled=true;
    try{
      const repaired=await repairOriginalV243(Number(input.dataset.v243File),file);
      if(!repaired){input.disabled=false;input.value='';}
    }catch(err){
      alert('Originaldatei wurde NICHT verbunden: '+(err.message||err));
      input.disabled=false;input.value='';
    }
  }));
  document.querySelector('[data-v243-recheck]')?.addEventListener('click',async e=>{
    const b=e.currentTarget;b.disabled=true;
    try{await exportZip();}
    catch(err){alert('Materialprüfung fehlgeschlagen: '+(err.message||err));b.disabled=false;}
  });
  document.querySelector('[data-v242-continue]')?.addEventListener('click',async e=>{
    const b=e.currentTarget;b.disabled=true;
    try{
      if(flow.repairsMadeV243){
        // Never export stale incomplete parts after a successful repair.
        await exportZip();return;
      }
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
    if(flow.preview?.blockers?.length)return alert('Die Planung enthält noch verbindliche Lücken. Bitte ChatGPT-Antwort erst korrigieren.');
    const b=e.currentTarget;b.disabled=true;
    try{await applyImport();}catch(err){alert('Gesamtimport abgebrochen: '+(err.message||err));b.disabled=false;}
  });
};

// V0.24.6: checkpoint annual work in local IndexedDB (no additional teaching-file copies).
const V246_DRAFT_PREFIX='__sc_annual_draft_v246__:';
function v246DraftWarning(err){
  console.warn('Jahresplanungsentwurf nicht gesichert:',err);
  if(typeof document==='undefined'||!document.body)return;
  let el=document.getElementById('v246-draft-warning');
  if(!el){el=document.createElement('div');el.id='v246-draft-warning';document.body.appendChild(el);
    el.style.cssText='position:fixed;bottom:16px;left:16px;z-index:99999;max-width:580px;padding:12px 16px;border:2px solid #b33;border-radius:8px;background:#fff;color:#8b1515;box-shadow:0 4px 24px #0003';}
  el.textContent='⚠ Der aktuelle Jahresplanungs-Arbeitsstand konnte nicht automatisch gespeichert werden. Bitte diese Seite geöffnet lassen und den ChatGPT-Text gegebenenfalls zusätzlich sichern.';
}
let v246SaveQueue=Promise.resolve(),v246SaveTimer=null,v246RestoreVersion=0,v246Restoring=false;
function v246DraftKey(cid,year){return V246_DRAFT_PREFIX+cid+'|'+year;}
function v246DraftSnapshot(){
  if(!flow.courseId||!flow.year)return null;
  const packages=(flow.downloadParts||[]).map(p=>({name:p.name,count:p.count,size:p.size,
    oversized:!!p.oversized,downloaded:!!p.downloaded}));
  return {schema:'schulcockpit.annual.draft.v1',courseId:flow.courseId,year:flow.year,
    phase:flow.phase,raw:flow.raw||'',data:flow.data||null,
    assessmentDraftV244:flow.assessmentDraftV244||null,
    packageMissing:flow.packageMissing||0,downloadParts:packages,
    savedAt:new Date().toISOString()};
}
function v246QueueSave(snapshot){
  if(!snapshot)return;
  const key=v246DraftKey(snapshot.courseId,snapshot.year);
  v246SaveQueue=v246SaveQueue.catch(()=>{}).then(async()=>{
    const payload=JSON.stringify(snapshot);
    if(payload.length>7*1024*1024)throw Error('Planungsentwurf zu groß für automatische Sicherung.');
    await fileStorePut(key,new File([payload],'Arbeitsstand-Jahresplanung.json',
      {type:'application/json'}));
    if(typeof document!=='undefined')document.getElementById('v246-draft-warning')?.remove();
  }).catch(v246DraftWarning);
}
function v246ScheduleSave(){
  if(v246Restoring||!flow.courseId||!flow.year||typeof setTimeout!=='function'||typeof clearTimeout!=='function')return;
  if(v246SaveTimer)clearTimeout(v246SaveTimer);
  v246SaveTimer=setTimeout(()=>{v246SaveTimer=null;v246QueueSave(v246DraftSnapshot());},250);
}
async function v246ClearDraft(cid,year){
  if(typeof fileStoreDelete!=='function')return;
  if(v246SaveTimer){clearTimeout(v246SaveTimer);v246SaveTimer=null;}
  await v246SaveQueue.catch(()=>{});
  await fileStoreDelete(v246DraftKey(cid,year));
}
async function v246RestoreDraft(cid,year,version){
  if(typeof fileStoreGet!=='function') {v246Restoring=false;return;}
  try{
    await v246SaveQueue.catch(()=>{});
    const record=await fileStoreGet(v246DraftKey(cid,year));
    if(!record?.blob||version!==v246RestoreVersion||
       flow.courseId!==cid||flow.year!==year||modal?.type!=='annualV236')return;
    const data=JSON.parse(await record.blob.text());
    if(data.schema!=='schulcockpit.annual.draft.v1'||data.courseId!==cid||data.year!==year)return;
    if(!['setup','missing','downloads','response','preview'].includes(data.phase))return;
    const parts=Array.isArray(data.downloadParts)?data.downloadParts:[];
    const finishedParts=parts.length>0&&parts.every(p=>p.downloaded);
    // ZIP blobs are not duplicated. Already downloaded ZIPs remain in the user's Downloads folder.
    const phase=data.phase==='downloads'?(finishedParts?'response':'setup'):
      data.phase==='missing'?'setup':data.phase;
    flow={courseId:cid,year,phase,raw:String(data.raw||''),data:data.data||null,
      preview:null,packageMissing:Number(data.packageMissing)||0,
      assessmentDraftV244:Array.isArray(data.assessmentDraftV244)?
        data.assessmentDraftV244.map(V244?V244.tidy:x=>x):v244OriginalRows(),
      downloadParts:[],resumeNoteV246:parts.length?
        ('Vorherige '+parts.length+' ZIP-Teile bleiben in deinem Downloads-Ordner; sie werden nicht erneut gespeichert.'):''};
    if(phase==='preview'&&flow.data){
      try{flow.preview=previewImport(flow.data);}catch(e){
        flow.phase='response';flow.resumeNoteV246='Die alte Importvorschau muss erneut geprüft werden: '+(e.message||e);
      }
    }
    render();
  }catch(e){console.warn('Gespeicherte Jahresplanung konnte nicht wiederhergestellt werden',e);}
  finally{v246Restoring=false;v246ScheduleSave();}
}
const v246PriorOpen=openFlow;
openFlow=function(cid,onlyRules){
  const year=v190PlanningYear(),same=flow.courseId===cid&&flow.year===year&&flow.phase!=='rules';
  if(!onlyRules&&!same){v246Restoring=true;if(v246SaveTimer&&typeof clearTimeout==='function'){clearTimeout(v246SaveTimer);v246SaveTimer=null;}}
  v246PriorOpen(cid,onlyRules);
  if(!onlyRules&&!same)void v246RestoreDraft(cid,year,++v246RestoreVersion);
};
const v246BeforeRender=render;
render=function(){
  v246BeforeRender();
  if(modal?.type==='annualV236'&&flow.resumeNoteV246){
    const panel=document.querySelector('.v236-modal .modal-body');
    if(panel)panel.insertAdjacentHTML('afterbegin','<p class="microcopy">'+esc(flow.resumeNoteV246)+'</p>');
  }
  v246ScheduleSave();
};
const v246BeforeWire=wire;
wire=function(){
  v246BeforeWire();
  const holder=document.querySelector('.v236-modal');
  if(!holder)return;
  holder.querySelectorAll('input,textarea,select').forEach(el=>{
    if(el.type==='file')return;
    el.addEventListener('input',v246ScheduleSave);
    el.addEventListener('change',v246ScheduleSave);
  });
};


const oldRender=render;
render=function(){oldRender();const el=document.querySelector('.brand small');if(el)el.textContent=state.settings.schoolYear+' · V0.25.7';};
})();
