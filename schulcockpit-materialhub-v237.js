/* Schulcockpit V0.23.7 – Materialbibliothek nach Fach/Jahrgang, sichere manuelle Zuordnung,
   allgemeine ZIP-Importe und thematisch gebundene Leistungsnachweise.
   Kein automatischer Netzversand, keine Änderung an Lehrkraftdateien oder Ist-Stunden. */
(function(){
'use strict';
const TYPES=[
 ['arbeitsblatt','Arbeitsblatt / Übung'],['werkstatt','Mathewerkstatt / Stationen'],
 ['reihenplanung','Reihenplanung / Themenkarte'],['klassenarbeit','Klassenarbeit / Klausur'],
 ['inklusion','Inklusionsarbeit / angepasste Arbeit'],['loesung','Lösung / Erwartungshorizont'],
 ['ersatzleistung','Ersatzleistung / Anleitung'],['praesentation','Präsentation'],
 ['quelle','Quelle / Hintergrund'],['sonstiges','Sonstiges']
];
const SUBJECTS=['Mathematik','Religion'];
const grades=[5,6,7,8,9,10,11,12,13];
const STATUS=['unassigned','pool','assigned','excluded'];
function norm(x){return String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();}
function detectType(name){
 const s=norm(name);
 if(/inklusion|lern(?:entwicklungs|einstiegs)niveau|i niveau|le arbeit|foerder arbeit/.test(s)&&/arbeit|klausur|test|leistung/.test(s))return 'inklusion';
 if(/erwartungshorizont|musterlosung|korrekturhilfe|losung|losungen|solution|bewertungsraster/.test(s))return 'loesung';
 if(/ersatzleistung|kreativleistung|lapbook|trauerglas|leistungsprodukt/.test(s))return 'ersatzleistung';
 if(/klassenarbeit|klausur|lernkontrolle|lernerfolgskontrolle|arbeit nr|probe arbeit|prufung/.test(s))return 'klassenarbeit';
 if(/mathewerkstatt|werkstatt|stationenlernen|station [0-9]|lerntheke|stationslernen/.test(s))return 'werkstatt';
 if(/reihenplanung|jahresplan|jahresubersicht|themenkarte|stoffverteilungsplan|sequenzplan|unterrichtsreihe/.test(s))return 'reihenplanung';
 if(/arbeitsblatt| ubung|ubungsblatt|aufgabenblatt|ab [0-9]|blatt [0-9]/.test(s))return 'arbeitsblatt';
 if(/prasentation|folien|powerpoint|\.pptx?$/.test(s))return 'praesentation';
 if(/quelle|hintergrund|infotext|sachtext/.test(s))return 'quelle';
 return 'sonstiges';
}
function locate(item){
 const meta=item.hubV237||{},source=[item.courseLabel,item.sourceArchive,item.sourcePath,item.fileName,item.title].filter(Boolean).join(' ');
 let subject=meta.subject||(/religion|reli\b/i.test(source)?'Religion':/mathe|mathematik/i.test(source)?'Mathematik':'');
 const match=source.match(/(?:^|[^0-9])(1[0-3]|[5-9])(?=[a-z]?(?:[^0-9]|$))/i);
 let grade=Number(meta.grade)||Number(match?.[1])||0;
 if(grade<5||grade>13)grade=0;
 return {subject,grade};
}
function statusOf(e){
 const x=e.hubV237||{};
 if(e.disposition==='excluded'||x.status==='excluded')return 'excluded';
 if(x.status&&STATUS.includes(x.status))return x.status;
 if(e.scope==='exclude')return 'excluded';
 if(['backlog','lesson_candidate'].includes(e.scope))return 'unassigned';
 if(['direct_lesson','lesson_variant','lesson_support'].includes(e.scope)){
   const a=typeof catalogAssignmentV17==='function'?catalogAssignmentV17(e):null;
   return a?.unit?'assigned':'pool';
 }
 return 'pool';
}
function gradeKey(subject,grade,year,half){return [subject,grade,year,half].join('|');}
function typeLabel(t){return TYPES.find(x=>x[0]===t)?.[1]||'Sonstiges';}
function dateValid(s){if(!s)return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;}
function deadlineAdvice(item){
 const a=[];
 if(item.gradeDeadline&&item.dueDate&&item.dueDate>=item.gradeDeadline)a.push('Die Abgabe liegt nicht vor der Notenfrist.');
 if(item.returnDate&&item.gradeDeadline&&item.returnDate>=item.gradeDeadline)a.push('Die Rückgabe ist nicht vor der Notenfrist vorgesehen.');
 if(item.handoutDate&&item.dueDate&&item.handoutDate>=item.dueDate)a.push('Arbeitsauftrag muss vor der Abgabe ausgegeben werden.');
 if(item.dueDate&&item.returnDate&&item.dueDate>=item.returnDate)a.push('Die Rückgabe muss nach der Abgabe liegen.');
 if(item.correctionDate&&item.dueDate&&item.correctionDate<=item.dueDate)a.push('Die Bewertung muss nach der Abgabe erfolgen.');
 if(item.correctionDate&&item.returnDate&&item.correctionDate>item.returnDate)a.push('Die Bewertung ist später als die Rückgabe terminiert.');
 if(item.correctionDate&&item.gradeDeadline&&item.correctionDate>=item.gradeDeadline)a.push('Die Bewertung liegt nicht vor der Notenfrist.');
 return a;
}
function safeFileName(s){return String(s||'datei').split('/').pop().replace(/[^A-Za-z0-9_.ÄÖÜäöüß-]/g,'_').slice(0,150);}
if(typeof module!=='undefined'&&module.exports){module.exports={detectType,locate,statusOf,gradeKey,deadlineAdvice,safeFileName};return;}

let ui={subject:'',grade:0,filter:'all',query:'',page:0,assessCourseId:''};
let editing=null,staged=null,busy=false;
function relevantCourses(sub,gr){return (state.classes||[]).filter(c=>!sub||v202SubjectKey(c)===(sub==='Mathematik'?'mathematik':'religion')).filter(c=>!gr||v202Grade(c)===Number(gr));}
function items(){
 const out=[];
 for(const e of state.materialCatalog||[]){
   const loc=locate(e),meta=e.hubV237||{};
   out.push({key:'c:'+e.catalogId,cat:e,name:e.fileName||'Datei',subject:loc.subject,grade:loc.grade,
     kind:meta.kind||detectType(e.fileName||e.sourcePath||''),status:statusOf(e),
     ready:!!catalogAvailableV17(e),scope:e.scope||'',sequenceTitle:meta.sequenceId?seq(meta.sequenceId)?.title||'':e.sequenceTitle||'',
     sourceArchive:e.sourceArchive||'',sourcePath:e.sourcePath||''});
 }
 for(const m of state.materials||[]){
   if(m.catalogId&&(state.materialCatalog||[]).some(e=>e.catalogId===m.catalogId))continue;
   const meta=m.hubV237||{},first=(m.assignments||[])[0],course=cls(meta.courseId||first?.classId),
     loc=locate({...m,courseLabel:course?(course.subject+' '+course.name):'',sourceArchive:m.source||''});
   const ready=(m.variants||[]).some(v=>hasStoredFile(v));
   out.push({key:'m:'+m.id,material:m,name:m.title||'Material',subject:meta.subject||loc.subject,
     grade:Number(meta.grade)||loc.grade,kind:meta.kind||detectType(m.title||''),
     status:meta.status||((m.assignments||[]).length?'assigned':'unassigned'),ready,
     sequenceTitle:seq(meta.sequenceId||first?.sequenceId)?.title||'',sourceArchive:m.source||'',sourcePath:''});
 }
 return out;
}
function stats(xs){
 return {all:xs.length,ready:xs.filter(x=>x.ready).length,unassigned:xs.filter(x=>x.status==='unassigned').length,
   pool:xs.filter(x=>x.status==='pool').length,assigned:xs.filter(x=>x.status==='assigned').length,
   excluded:xs.filter(x=>x.status==='excluded').length};
}
function matchUi(x){
 if(ui.filter==='unassigned'&&x.status!=='unassigned')return false;
 if(ui.filter==='pool'&&x.status!=='pool')return false;
 if(ui.filter==='assigned'&&x.status!=='assigned')return false;
 if(ui.filter==='excluded'&&x.status!=='excluded')return false;
 if(ui.filter!=='all'&&ui.filter!=='unassigned'&&ui.filter!=='pool'&&ui.filter!=='assigned'&&ui.filter!=='excluded')return false;
 if(ui.subject&&x.subject!==ui.subject)return false;
 if(ui.grade&&x.grade!==Number(ui.grade))return false;
 if(ui.query&&!norm([x.name,x.sourceArchive,x.sourcePath,x.sequenceTitle,typeLabel(x.kind)].join(' ')).includes(norm(ui.query)))return false;
 return true;
}
function tile(sub,grade,xs){
 const group=xs.filter(x=>x.subject===sub&&x.grade===grade&&x.status!=='excluded');
 const ready=group.filter(x=>x.ready).length,tot=group.length;
 const by=t=>group.filter(x=>x.kind===t).length;
 const series=(state.sequences||[]).filter(q=>v190SeqYear(q)===v190PlanningYear()&&relevantCourses(sub,grade).some(c=>c.id===q.classId));
 return '<button class="v237-tile '+(ui.subject===sub&&ui.grade===grade?'active':'')+'" data-v237-folder="'+sub+'|'+grade+'">'
   +'<strong>Klasse '+grade+'</strong><span>'+tot+' Einträge · '+ready+' lokal</span>'
   +'<small>'+by('arbeitsblatt')+' AB · '+by('werkstatt')+' Werkstatt · '+by('klassenarbeit')+' Arbeiten · '+by('inklusion')+' Inklusion</small>'
   +'<small>'+by('ersatzleistung')+' Ersatzleistungen · '+by('loesung')+' Lösungen · '+by('reihenplanung')+' Plan-Dateien · '+(series.length?series.length+' geplante Reihen':'Reihen offen')+'</small></button>';
}
function rows(xs){
 const matched=xs.filter(matchUi),size=48,subset=matched.slice(ui.page*size,(ui.page+1)*size);
 return '<div class="v237-table-head"><strong>'+matched.length+' Treffer</strong><span>'+Math.min(ui.page*size+1,matched.length)+'–'+Math.min((ui.page+1)*size,matched.length)+'</span></div>'
  +(subset.map(x=>'<article class="v237-row"><div class="v237-file">'
   +'<strong>'+esc(x.name)+'</strong><small>'+esc(typeLabel(x.kind))+' · '+esc((x.subject||'Fach offen')+' '+(x.grade||''))+' · '+esc(x.sequenceTitle||'Reihe offen')+'</small>'
   +(x.sourcePath?'<small title="'+esc(x.sourcePath)+'">'+esc(x.sourceArchive?x.sourceArchive+' / '+x.sourcePath:x.sourcePath)+'</small>':'')+'</div>'
   +'<div class="v237-flags"><span>'+esc(x.status==='unassigned'?'Noch einzuordnen':x.status==='pool'?'Jahrgangspool':x.status==='assigned'?'Zugeordnet':'Ausgeblendet')+'</span>'
   +'<span class="'+(x.ready?'v237-ready':'v237-remote')+'">'+(x.ready?'Original lokal':'Nur Katalog / Datei fehlt')+'</span></div>'
   +'<div class="v237-row-actions"><button class="secondary" data-v237-edit="'+esc(x.key)+'">Einordnen</button>'
   +(x.ready?'<button class="text-button" data-v237-file="'+esc(x.key)+'">Öffnen</button>':'')+'</div></article>').join('')||'<p class="muted">Hier sind keine Einträge. Andere Jahrgänge oder Filter auswählen.</p>')
  +'<div class="v237-pages"><button class="secondary" data-v237-page="-1" '+(ui.page<=0?'disabled':'')+'>← Zurück</button>'
  +'<button class="secondary" data-v237-page="1" '+((ui.page+1)*size>=matched.length?'disabled':'')+'>Weiter →</button></div>';
}
function assessmentNotes(sub,gr){
 if(sub!=='Religion')return [];
 const notes=typeof V206_EXAM_NOTES==='object'?V206_EXAM_NOTES['religion-'+gr]||'':'';
 return notes?[notes]:[];
}
function select(values,current,attr,empty=''){
 return '<select '+attr+'>'+(empty?'<option value="">'+empty+'</option>':'')
  +values.map(([k,v])=>'<option value="'+esc(k)+'" '+(String(current)===String(k)?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select>';
}
function coursesHtml(sub,gr){
 return relevantCourses(sub,gr).map(c=>'<option value="'+esc(c.id)+'">'+esc(c.subject+' '+c.name)+'</option>').join('');
}
function assessmentPanel(){
 if(!ui.subject||!ui.grade)return '';
 const courses=relevantCourses(ui.subject,ui.grade);
 const c=courses.find(x=>x.id===ui.assessCourseId)||courses[0];
 const note=assessmentNotes(ui.subject,ui.grade);
 const y=v190PlanningYear();
 const cells=[1,2].map(h=>{
   const saved=(state.assessmentGradeV237||{})[gradeKey(ui.subject,ui.grade,y,h)]||{};
   const current=c?((state.yearRequirementsV236||{})[c.id+'|'+y]||[])[h-1]||{}:{};
   const obj={...saved,...current};
   const method=[['offen','Noch offen'],['klassenarbeit','Klassenarbeit'],['ersatzleistung','Ersatzleistung'],['klausur','Klausur'],['kein','Kein Nachweis']];
   const status=[['offen','Offen'],['geplant','Einzuplanen'],['terminiert','Terminiert'],['erledigt','Erledigt']];
   const relevantSequences=c?v190PlanningSequences(c.id,y):[];
   return '<section class="v237-assess-cell"><h3>'+h+'. Halbjahr</h3>'
    +'<div class="v237-assess-two"><label>Art'+select(method,obj.type||'offen','data-v237-a="'+h+'|type"')+'</label>'
    +'<label>Status'+select(status,obj.status||'offen','data-v237-a="'+h+'|status"')+'</label></div>'
    +'<label>Thema / Leistungsprodukt<input data-v237-a="'+h+'|topic" value="'+esc(obj.topic||'')+'" placeholder="z. B. Diakonie · Kreativleistung"></label>'
    +'<label>Konkrete Form / Arbeitsauftrag<textarea data-v237-a="'+h+'|task" rows="2" placeholder="z. B. Lapbook, Trauerglas, Präsentation …">'+esc(obj.task||'')+'</textarea></label>'
    +'<label>Zugehörige Reihe'+select(relevantSequences.map(q=>[q.id,q.title]),obj.sequenceId||'','data-v237-a="'+h+'|sequenceId"','Reihe noch offen / fachlich vorgegeben')+'</label>'
    +'<div class="v237-assess-dates">'
    +[['handoutDate','Auftrag vorstellen'],['dueDate','Abgabe'],['correctionDate','Bewertung bis'],['returnDate','Rückgabe'],['gradeDeadline','Notenfrist']].map(([key,label])=>
      '<label>'+label+'<input type="date" data-v237-a="'+h+'|'+key+'" value="'+esc(obj[key]||'')+'"></label>').join('')
    +'</div><label>Hinweise<input data-v237-a="'+h+'|note" value="'+esc(obj.note||'')+'"></label></section>';
 }).join('');
 return '<section class="panel v237-assess"><div class="section-head"><div><span class="eyebrow">LEISTUNGSNACHWEISE · '+esc(y)+'</span><h2>Prüfungen und Ersatzleistungen</h2></div><button class="primary" data-v237-save-assess>Vorgaben speichern</button></div>'
  +(note.length?'<p class="muted">Fachkonferenz-Hinweis (nicht automatisch als Termin übernommen): '+esc(note.join('; '))+'</p>':'')
  +'<p class="microcopy">Abgabetermine müssen Zeit für Bewertung und Rückgabe vor der Notenfrist lassen. Leere Termine bleiben ausdrücklich offen. Bereits festgelegte Prüfungstermine im Cockpit bleiben unverändert.</p>'
  +(courses.length>1?'<label>Fachkurs für diesen Jahrgang'+select(courses.map(x=>[x.id,x.subject+' '+x.name]),c?.id||'','id="v237-assess-course"')+'</label>':'')
  +'<div class="v237-assess-grid">'+cells+'</div></section>';
}
function hubView(){
 ensureMaterialCatalogV17();ensureMaterialInboxV15();
 const xs=items(),ss=stats(xs),folder=!!ui.subject&&!!ui.grade;
 const title='Material-Hub';
 const intro='<section class="hero-card v237-hero"><div><span class="eyebrow">MATERIALBIBLIOTHEK</span><h2>'+title+'</h2><p>Materialien nach Fach und Jahrgang, unabhängig davon, ob du den Kurs gerade unterrichtest. Originaldateien bleiben ausschließlich lokal im Browser.</p></div>'
 +'<div class="v237-import-buttons"><label class="upload-button big-upload">+ Dateien oder ZIP importieren<input type="file" multiple id="v237-upload" accept=".zip,.pdf,.doc,.docx,.ppt,.pptx,.potx,.png,.jpg,.jpeg,.xlsx,.xls,.txt" hidden></label>'
 +'<details><summary>Vorhandene Religions-Katalogarchive verbinden</summary><label class="upload-button">Bekannte Original-ZIPs<input type="file" id="material-archive-upload-v17" accept=".zip" multiple hidden></label><label class="upload-button">Katalog-JSON aktualisieren<input type="file" id="material-catalog-upload-v17" accept=".json" hidden></label></details></div></section>';
 const stat='<section class="v237-stats"><button data-v237-filter="all"><strong>'+ss.all+'</strong><span>Insgesamt erfasst</span></button>'
 +'<button data-v237-filter="unassigned"><strong>'+ss.unassigned+'</strong><span>Zu prüfen</span></button>'
 +'<button data-v237-filter="pool"><strong>'+ss.pool+'</strong><span>Im Jahrgangspool</span></button>'
 +'<button data-v237-filter="assigned"><strong>'+ss.assigned+'</strong><span>Reihen/Stunden</span></button>'
 +'<div><strong>'+ss.ready+'</strong><span>Originale lokal verfügbar</span></div></section>';
 const dir='<section class="panel v237-folders"><div class="section-head"><div><span class="eyebrow">NACH FACH UND JAHRGANG</span><h2>Materialordner</h2></div><button class="text-button" data-v237-home>Alle Fächer</button></div>'
  +SUBJECTS.map(sub=>'<div class="v237-subject"><h3>'+esc(sub)+'</h3><div class="v237-tiles">'+grades.map(g=>tile(sub,g,xs)).join('')+'</div></div>').join('')+'</section>';
 const pendingInbox=state.materialInbox||[];
 const legacy=pendingInbox.length?'<details class="panel v237-legacy"><summary>'+pendingInbox.length+' bisherige Eingangsdateien (alter Upload) · hier direkt zuordnen</summary><div class="material-inbox-list-v15">'+pendingInbox.slice(0,70).map(materialInboxRowV15).join('')+'</div>'
  +(pendingInbox.length>70?'<p>Weitere Eingangsdateien erscheinen nach dem Zuordnen der ersten 70.</p>':'')+'</details>':'';
 const list='<section class="panel v237-list"><div class="section-head"><div><span class="eyebrow">'+(folder?esc(ui.subject+' · Klasse '+ui.grade):'GESAMTER MATERIALBESTAND')+'</span><h2>Dateien einordnen und wiederfinden</h2></div></div>'
  +'<div class="v237-filters"><label>Status'+select([['all','Alle'],['unassigned','Noch einzuordnen'],['pool','Jahrgangspool'],['assigned','Reihe / Stunde'],['excluded','Ausgeblendet']],ui.filter,'id="v237-filter"')+'</label>'
  +'<label>Fach'+select(SUBJECTS.map(s=>[s,s]),ui.subject,'id="v237-subject"','Alle Fächer')+'</label>'
  +'<label>Jahrgang'+select(grades.map(g=>[g,''+g]),ui.grade,'id="v237-grade"','Alle Jahrgänge')+'</label>'
  +'<label>Suche<input id="v237-query" type="search" placeholder="Dateiname, Thema, Reihe …" value="'+esc(ui.query)+'"></label></div>'
  +rows(xs)+'</section>';
 return '<div class="content-grid v237-hub">'+intro+stat+dir+legacy+list+assessmentPanel()+'</div>';
}
function editModal(){
 const x=items().find(x=>x.key===editing.key);
 if(!x)return '';
 const v=editing.draft,cs=relevantCourses(v.subject,v.grade),courses=(state.classes||[]).filter(c=>v202SubjectKey(c)===(v.subject==='Mathematik'?'mathematik':'religion')&&v202Grade(c)===Number(v.grade));
 const selected=cls(v.courseId),seqs=selected?v190PlanningSequences(selected.id,v190PlanningYear()):[];
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide v237-edit" data-modal-stop>'
  +'<header class="modal-header"><div><span class="eyebrow">MATERIAL EINORDNEN</span><h2>'+esc(x.name)+'</h2></div><button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">'
  +'<p class="microcopy">Einordnung betrifft ausschließlich die Bibliotheks-Metadaten. Originaldatei und historische Unterrichtsplanung werden nicht verändert.</p>'
  +'<div class="v237-form">'
  +'<label>Fach'+select(SUBJECTS.map(s=>[s,s]),v.subject,'data-v237-edit-field="subject"','Bitte auswählen')+'</label>'
  +'<label>Jahrgang'+select(grades.map(g=>[g,''+g]),v.grade,'data-v237-edit-field="grade"','Bitte auswählen')+'</label>'
  +'<label>Materialart'+select(TYPES,v.kind,'data-v237-edit-field="kind"')+'</label>'
  +'<label>Einordnung'+select([['unassigned','Noch einzuordnen'],['pool','Fach-/Jahrgangspool'],['assigned','Bestimmter Kurs / Reihe'],['excluded','Ausblenden, nicht löschen']],v.status,'data-v237-edit-field="status"')+'</label>'
  +'<label>Fachkurs (optional)'+select(courses.map(c=>[c.id,c.subject+' '+c.name]),selected?.id||'','data-v237-edit-field="courseId"','Kein aktueller Kurs / späterer Jahrgang')+'</label>'
  +'<label>Unterrichtsreihe (optional)'+select(seqs.map(q=>[q.id,q.title]),v.sequenceId,'data-v237-edit-field="sequenceId"','Noch keine Reihe – Materialpool')+'</label>'
  +'<label class="v237-wide">Hinweis<input data-v237-edit-field="note" maxlength="650" value="'+esc(v.note||'')+'"></label>'
  +'</div><div class="v237-actions"><button class="secondary" data-action="modal-close">Abbrechen</button><button class="primary" data-v237-commit>Einordnung speichern →</button></div></div></section></div>';
}
function importedModal(){
 const xs=staged.entries,byType=TYPES.filter(t=>xs.some(x=>x.kind===t[0])).map(t=>t[1]+': '+xs.filter(x=>x.kind===t[0]).length);
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-xwide v237-import" data-modal-stop>'
  +'<header class="modal-header"><div><span class="eyebrow">ALLGEMEINER MATERIALIMPORT</span><h2>'+xs.length+' Dateien vorsortieren</h2></div><button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">'
  +'<p>Die Dateinamen werden nur als Vorschläge interpretiert. Keine automatische Stunden- oder Prüfungszuordnung. Originale bleiben lokal. Bekannte Religionsarchive werden über den bisherigen Katalog verknüpft.</p>'
  +'<div class="v237-form"><label>Fach'+select(SUBJECTS.map(s=>[s,s]),staged.subject,'id="v237-import-subject"','Aus Ordnernamen erkennen / offen lassen')+'</label>'
  +'<label>Jahrgang'+select(grades.map(g=>[g,''+g]),staged.grade,'id="v237-import-grade"','Aus Dateipfaden erkennen / offen lassen')+'</label></div>'
  +'<div class="v237-type-summary">'+byType.map(s=>'<span>'+esc(s)+'</span>').join('')+'</div>'
  +'<details><summary>Dateiliste ansehen ('+xs.length+')</summary><div class="v237-preview-list">'+xs.slice(0,85).map(e=>'<div>'+esc(e.path)+' <small>'+esc(typeLabel(e.kind))+'</small></div>').join('')+'</div>'+(xs.length>85?'<p>Weitere Dateien werden ebenfalls importiert.</p>':'')+'</details>'
  +'<p class="microcopy">Bereits eindeutig identische Dateien werden nicht doppelt angelegt. Unterschiedliche Originale mit gleichem Namen bleiben erhalten. Bei großen Sammlungen kann das Speichern im Browser dauern.</p>'
  +'<div class="v237-actions"><button class="secondary" data-action="modal-close">Abbrechen</button><button class="primary" data-v237-import-commit>In Bibliothek speichern →</button></div>'
  +'</div></section></div>';
}
function editEntry(key){
 const x=items().find(x=>x.key===key);if(!x)return;
 const meta=x.cat?.hubV237||x.material?.hubV237||{};
 const course=cls(meta.courseId),q=seq(meta.sequenceId);
 editing={key,draft:{subject:x.subject,grade:x.grade,kind:x.kind,status:x.status,
   courseId:meta.courseId||q?.classId||'',sequenceId:meta.sequenceId||'',note:meta.note||''}};
 modal={type:'v237Edit'};render();
}
function persistCatalog(){return typeof persistCatalogV171==='function'?persistCatalogV171():Promise.resolve();}
async function commitEntry(){
 const x=items().find(x=>x.key===editing?.key);if(!x)throw Error('Material nicht mehr vorhanden.');
 const draft=editing.draft;
 if(!SUBJECTS.includes(draft.subject)||!grades.includes(Number(draft.grade)))throw Error('Bitte Fach und Jahrgang auswählen.');
 if(!TYPES.some(t=>t[0]===draft.kind))throw Error('Ungültige Materialart.');
 const course=cls(draft.courseId),q=seq(draft.sequenceId);
 if(course&&(v202Grade(course)!==Number(draft.grade)||v202SubjectKey(course)!==(draft.subject==='Mathematik'?'mathematik':'religion')))
   throw Error('Kurs und Fach/Jahrgang passen nicht zusammen.');
 if(q&&(!course||q.classId!==course.id))throw Error('Die gewählte Reihe gehört nicht zum Kurs.');
 const status=draft.status==='assigned'&&!course?'pool':draft.status;
 const h={subject:draft.subject,grade:Number(draft.grade),kind:draft.kind,status,
   courseId:course?.id||'',sequenceId:q?.id||'',note:String(draft.note||'').slice(0,650),reviewedAt:new Date().toISOString()};
 if(x.cat){
   const e=x.cat,backup={scope:e.scope,disposition:e.disposition,hubV237:e.hubV237,courseLabel:e.courseLabel,sequenceTitle:e.sequenceTitle};
   try{
     e.hubV237=h;e.disposition=status==='excluded'?'excluded':'';
     if(status==='pool'||status==='assigned'){
       if(['backlog','lesson_candidate','future_sequence','sequence_pool'].includes(e.scope))e.scope='sequence_pool';
       if(course)e.courseLabel=course.subject+' '+course.name;
       if(q)e.sequenceTitle=q.title;
     }
     // No change to old scope for already activated lesson files; avoid detached Ist links.
     await persistCatalog();await saveState();
   }catch(err){Object.assign(e,backup);await persistCatalog().catch(()=>{});throw err;}
 }else{
   const m=x.material,prior=clone(m.hubV237||{}),assignments=clone(m.assignments||[]);
   try{
     m.hubV237=h;
     if(course){
       m.assignments=m.assignments||[];
       if(!m.assignments.some(a=>a.classId===course.id&&a.sequenceId===(q?.id||'')))
         m.assignments.push({classId:course.id,sequenceId:q?.id||'',unitId:''});
     }
     await saveState();
   }catch(err){m.hubV237=prior;m.assignments=assignments;throw err;}
 }
 editing=null;modal=null;render();
}
async function stageUploads(files){
 if(typeof JSZip==='undefined')throw Error('ZIP-Unterstützung fehlt.');
 if(!files.length)return;
 const data={entries:[],subject:ui.subject||'',grade:ui.grade||0,archives:[]};
 let count=0;
 for(const f of files){
   if(/\.zip$/i.test(f.name)){
     if((state.materialCatalog||[]).some(e=>!e.hubV237&&norm(e.sourceArchive)===norm(f.name))){data.archives.push(f);continue;}
     const zip=await JSZip.loadAsync(f);
     for(const [path,e] of Object.entries(zip.files)){
       if(e.dir||path.startsWith('__MACOSX/')||/\/\./.test(path)||path.split('/').pop().startsWith('.'))continue;
       if(++count>1300)throw Error('Mehr als 1300 Dateien. Bitte das ZIP in kleinere Teile aufteilen.');
       data.entries.push({path,kind:detectType(path),archive:f.name,zipEntry:e,fileName:path.split('/').pop()});
     }
   }else{
     if(++count>1300)throw Error('Mehr als 1300 Dateien. Bitte in kleinere Teile aufteilen.');
     data.entries.push({path:f.webkitRelativePath||f.name,kind:detectType(f.name),fileName:f.name,file:f,archive:''});
   }
 }
 if(!data.entries.length&&!data.archives.length)throw Error('Keine lesbaren Dateien im Upload.');
 staged=data;modal={type:'v237Import'};render();
}
async function fingerprint(blob){
 if(typeof crypto==='undefined'||!crypto.subtle)return '';
 const bytes=await blob.arrayBuffer();
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function finishImport(){
 if(busy)return;
 // Mixed-year and mixed-subject ZIPs are allowed. Unrecognized files go to the inbox.
 if(staged.subject&&!SUBJECTS.includes(staged.subject))throw Error('Ungültiges Fach.');
 if(staged.grade&&!grades.includes(Number(staged.grade)))throw Error('Ungültiger Jahrgang.');
 let initial=clone(state.materialCatalog||[]),addedKeys=[],newHashes=new Set(initial.map(e=>e.hubV237?.sha256).filter(Boolean));
 let added=0,linked=0,duplicate=0,skipped=0,known=0,allBytes=0;busy=true;
 try{
   for(const f of staged.archives){const r=await importCatalogArchiveV17(f);known++;linked+=r.found;}
   // Ab hier kann der generische Import separat zurückgerollt werden;
   // erfolgreich verbundene Altarchive dürfen nicht versehentlich verloren gehen.
   initial=clone(state.materialCatalog||[]);
   newHashes=new Set(initial.map(e=>e.hubV237?.sha256).filter(Boolean));
   for(const row of staged.entries){
     const current=(state.materialCatalog||[]).find(e=>row.archive&&norm(e.sourceArchive)===norm(row.archive)&&norm(e.sourcePath)===norm(row.path));
     const detected=locate({sourceArchive:row.archive,sourcePath:row.path,fileName:row.fileName});
     const subject=staged.subject||detected.subject,grade=staged.grade||detected.grade;
     if(current&&catalogAvailableV17(current)){duplicate++;continue;}
     const blob=row.file||await row.zipEntry.async('blob');
     if(blob.size>80*1024*1024||allBytes+blob.size>420*1024*1024){skipped++;continue;}
     allBytes+=blob.size;
     const sha=await fingerprint(blob);
     const existingSameHash=sha?(state.materialCatalog||[]).find(e=>e.hubV237?.sha256===sha&&e.localFileKey):null;
     if(existingSameHash&&existingSameHash.hubV237?.subject===subject&&existingSameHash.hubV237?.grade===grade&&norm(existingSameHash.fileName)===norm(row.fileName)){
       duplicate++;continue;
     }
     const id=current?.catalogId||uid('cat-hub'),key=current?.localFileKey||existingSameHash?.localFileKey||('catalog-file-'+id);
     const file=new File([blob],row.fileName,{type:blob.type||''});
     if(!existingSameHash||current?.localFileKey){await fileStorePut(key,file);if(!storedFileKeys.has(key))addedKeys.push(key);}
     storedFileKeys.add(key);
     const meta={...(current?.hubV237||{}),subject,grade,
       kind:current?.hubV237?.kind||row.kind,status:current?.hubV237?.status||(subject&&grade?'pool':'unassigned'),
       sha256:sha||current?.hubV237?.sha256||'',reviewedAt:new Date().toISOString()};
     if(current){current.localFileKey=key;current.hubV237=meta;linked++;}
     else{
       state.materialCatalog.push({catalogId:id,fileName:row.fileName,sourceArchive:row.archive||'Einzeldateien',
         sourcePath:row.path,courseLabel:subject&&grade?subject+' '+grade:'',sequenceTitle:'',
         scope:subject&&grade?'sequence_pool':'backlog',variantType:'standard',resourceType:'print',localFileKey:key,disposition:'',hubV237:meta});
       added++;
     }
     if(sha)newHashes.add(sha);
   }
   await persistCatalog();await saveState();
   staged=null;modal=null;render();
   alert('Import abgeschlossen: '+added+' neue Bibliothekseinträge, '+linked+' vorhandene verbunden, '+duplicate+' identische ausgelassen, '+skipped+' wegen Größenlimit nicht verarbeitet, '+known+' bekannte Katalogarchive verbunden. Nur lokal gespeichert.');
 }catch(err){
   // Existing connected archives may have been updated by the legacy importer.
   // Never erase or undo their IndexedDB content; roll back only newly created keys.
   state.materialCatalog=initial;
   for(const key of addedKeys){await fileStoreDelete(key).catch(()=>{});storedFileKeys.delete(key);}
   await persistCatalog().catch(()=>{});
   throw err;
 }finally{busy=false;}
}
async function openFile(key){
 const x=items().find(x=>x.key===key);if(!x)return;
 let file=null;
 if(x.cat)file=await catalogEntryFileV17(x.cat);
 else{
   const v=x.material?.variants?.find(v=>hasStoredFile(v)),rec=v?await fileStoreGet(v.fileKey):null;
   if(rec?.blob)file=new File([rec.blob],rec.name||v.fileName||x.name,{type:rec.blob.type||''});
 }
 if(!file)return alert('Originaldatei in diesem Browser nicht verfügbar. Ggf. das Original-ZIP erneut verbinden.');
 if(/\.(pdf|png|jpe?g|webp|txt)$/i.test(file.name)){
   const url=URL.createObjectURL(file);window.open(url,'_blank');setTimeout(()=>URL.revokeObjectURL(url),60000);
 }else downloadBlob(file.name,file);
}
function assessmentCourseId(){return ui.assessCourseId||document.getElementById('v237-assess-course')?.value||relevantCourses(ui.subject,ui.grade)[0]?.id||'';}
async function commitAssessments(){
 const y=v190PlanningYear(),cid=assessmentCourseId();
 const key=cid+'|'+y,old=clone((state.yearRequirementsV236||{})[key]||[]),previous=clone(state.assessmentGradeV237||{});
 state.assessmentGradeV237=state.assessmentGradeV237||{};
 state.yearRequirementsV236=state.yearRequirementsV236||{};
 const rr=old.length?old:[{},{ }];
 const warnings=[];
 for(const half of [1,2]){
   const fields={};document.querySelectorAll('[data-v237-a^="'+half+'|"]').forEach(el=>{
     fields[el.dataset.v237A.split('|')[1]]=el.value||'';
   });
   for(const k of ['handoutDate','dueDate','correctionDate','returnDate','gradeDeadline'])
     if(!dateValid(fields[k]))throw Error('Ungültiges Datum: '+k);
   const q=seq(fields.sequenceId);
   if(q&&q.classId!==cid)throw Error('Die ausgewählte Reihe gehört einem anderen Kurs.');
   warnings.push(...deadlineAdvice(fields).map(t=>half+'. Halbjahr: '+t));
   const data={...(rr[half-1]||{}),...fields};
   state.assessmentGradeV237[gradeKey(ui.subject,ui.grade,y,half)]=data;
   rr[half-1]=data;
 }
 if(warnings.length&&!confirm(warnings.join('\n')+'\n\nTrotzdem speichern?')){state.assessmentGradeV237=previous;return;}
 if(cid)state.yearRequirementsV236[key]=rr;
 try{await saveState();render();alert('Leistungsnachweise und Fristen gespeichert. Die Angaben werden beim nächsten Jahresplanungs-ZIP übernommen.');}
 catch(err){state.assessmentGradeV237=previous;if(cid)state.yearRequirementsV236[key]=old;throw err;}
}
// Make previously unrecognized Mathematics or future-grade catalog files available for year ZIP,
// without altering course assignments or existing legacy catalog IDs.
const originalCatalogCourse=catalogCourseV17;
catalogCourseV17=function(e){
 const h=e?.hubV237;
 if(h?.subject&&h.grade){
   const course=cls(h.courseId);
   if(course)return course;
   const matches=relevantCourses(h.subject,h.grade);
   if(matches.length===1)return matches[0];
   if(matches.length>1)return null; // not silently assigned to one of several parallel classes
 }
 return originalCatalogCourse(e);
};
const originalCourseCatalog=v184CurrentCourseCatalog;
v184CurrentCourseCatalog=function(cid){
 const course=cls(cid),subject=v202SubjectKey(course)==='mathematik'?'Mathematik':'Religion',grade=v202Grade(course);
 const normal=originalCourseCatalog(cid);
 const additional=(state.materialCatalog||[]).filter(e=>{
   const h=e.hubV237;
   return e.disposition!=='excluded'&&e.scope!=='exclude'&&h?.subject===subject&&Number(h.grade)===grade&&(!h.courseId||h.courseId===cid);
 });
 return [...new Map([...normal,...additional].map(e=>[e.catalogId,e])).values()];
};
const originalCourseMatch=v184CourseMatchCatalog;
v184CourseMatchCatalog=function(e,cid){
 if(originalCourseMatch(e,cid))return true;
 const h=e?.hubV237,course=cls(cid);
 return !!h&&e.disposition!=='excluded'&&e.scope!=='exclude'&&h.subject===(v202SubjectKey(course)==='mathematik'?'Mathematik':'Religion')
   &&Number(h.grade)===v202Grade(course)&&(!h.courseId||h.courseId===cid);
};
materialsView=hubView;
const prevModal=modalHtml;
modalHtml=function(){if(modal?.type==='v237Edit')return editModal();if(modal?.type==='v237Import')return importedModal();return prevModal();};
const prevWire=wire;
wire=function(){
 prevWire();
 document.querySelectorAll('[data-v237-folder]').forEach(b=>b.onclick=()=>{
   const [sub,gr]=b.dataset.v237Folder.split('|');ui.subject=sub;ui.grade=Number(gr);ui.filter='all';ui.page=0;ui.query='';render();
 });
 document.querySelector('[data-v237-home]')?.addEventListener('click',()=>{ui.subject='';ui.grade=0;ui.filter='all';ui.page=0;ui.query='';render();});
 document.querySelectorAll('[data-v237-filter]').forEach(b=>b.onclick=()=>{ui.filter=b.dataset.v237Filter;ui.page=0;render();});
 document.getElementById('v237-filter')?.addEventListener('change',e=>{ui.filter=e.target.value;ui.page=0;render();});
 document.getElementById('v237-subject')?.addEventListener('change',e=>{ui.subject=e.target.value;ui.page=0;render();});
 document.getElementById('v237-grade')?.addEventListener('change',e=>{ui.grade=Number(e.target.value)||0;ui.page=0;render();});
 document.getElementById('v237-query')?.addEventListener('change',e=>{ui.query=e.target.value;ui.page=0;render();});
 document.querySelectorAll('[data-v237-page]').forEach(b=>b.onclick=()=>{ui.page=Math.max(0,ui.page+Number(b.dataset.v237Page));render();});
 document.querySelectorAll('[data-v237-edit]').forEach(b=>b.onclick=()=>editEntry(b.dataset.v237Edit));
 document.querySelectorAll('[data-v237-file]').forEach(b=>b.onclick=()=>openFile(b.dataset.v237File).catch(e=>alert(e.message||e)));
 document.getElementById('v237-upload')?.addEventListener('change',e=>stageUploads([...e.target.files]).catch(err=>alert(err.message||err)));
 document.querySelectorAll('[data-v237-edit-field]').forEach(el=>el.onchange=()=>{
   const key=el.dataset.v237EditField;editing.draft[key]=el.value;
   if(['subject','grade','courseId'].includes(key)){
     if(key==='subject'||key==='grade'){editing.draft.courseId='';editing.draft.sequenceId='';}
     if(key==='courseId')editing.draft.sequenceId='';
     render();
   }
 });
 document.querySelector('[data-v237-commit]')?.addEventListener('click',e=>{e.currentTarget.disabled=true;commitEntry().catch(err=>{alert('Einordnung nicht gespeichert: '+(err.message||err));render();});});
 document.getElementById('v237-import-subject')?.addEventListener('change',e=>{staged.subject=e.target.value;});
 document.getElementById('v237-import-grade')?.addEventListener('change',e=>{staged.grade=Number(e.target.value)||0;});
 document.querySelector('[data-v237-import-commit]')?.addEventListener('click',e=>{
   e.currentTarget.disabled=true;e.currentTarget.textContent='Dateien werden lokal gespeichert …';
   finishImport().catch(err=>{alert('Import fehlgeschlagen: '+(err.message||err));render();});
 });
 document.getElementById('v237-assess-course')?.addEventListener('change',e=>{ui.assessCourseId=e.target.value;render();});
 document.querySelector('[data-v237-save-assess]')?.addEventListener('click',e=>{
   e.currentTarget.disabled=true;commitAssessments().catch(err=>{alert('Leistungsnachweise nicht gespeichert: '+(err.message||err));render();});
 });
};
const oldRender=render;
render=function(){oldRender();const version=document.querySelector('.brand small');if(version)version.textContent=state.settings.schoolYear+' · V0.23.7';};
})();