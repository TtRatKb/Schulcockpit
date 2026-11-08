/* Schulcockpit V0.31.3 – strict partial sequence planning, pure validation.
 * Never import an entire sequence when only unfinished unit IDs are supplied.
 * Current lesson dates are preserved (especially hand-in deadlines and history).
 */
const SC_PARTIAL_SEQUENCE_V313=(function(){
'use strict';
const SCHEMA='schulcockpit.sequence.partial.v1';
const text=(v,n=2600)=>String(v??'').trim().slice(0,n);
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&
 Number.isFinite(Date.parse(v+'T12:00:00'))&&
 new Date(v+'T12:00:00').toISOString().slice(0,10)===v;
const VERDICTS=['usable','teacher_only','unsuitable','needs_revision','unknown'];
function tag(answer){
 const m=String(answer??'').match(/<SCHULCOCKPIT_PARTIAL_SEQUENCE_IMPORT>\s*([\s\S]*?)\s*<\/SCHULCOCKPIT_PARTIAL_SEQUENCE_IMPORT>/i);
 if(!m)throw Error('SCHULCOCKPIT_PARTIAL_SEQUENCE_IMPORT fehlt. Die vollständige ChatGPT-Antwort einfügen.');
 try{return JSON.parse(m[1]);}
 catch{throw Error('Der Rückimport enthält kein gültiges JSON.');}
}
function validate(answer,ctx){
 const doc=typeof answer==='string'?tag(answer):answer;
 if(doc?.schema!==SCHEMA)throw Error('Falsches Importformat für die Teil-Neuplanung.');
 if(doc.courseId!==ctx.course.id||doc.sequenceId!==ctx.sequence.id)
  throw Error('Der Import gehört zu einem anderen Kurs oder einer anderen Reihe.');
 const deadline=ctx.deliverable?.deadline,title=ctx.deliverable?.title;
 if(!validDate(deadline)||!text(title))throw Error('Leistung und verbindlicher Abgabetermin fehlen im Export.');
 if(doc.deliverable?.deadline!==deadline||
  text(doc.deliverable?.title,150)!==text(title,150))
  throw Error('Trauerglas/Abgabetermin im Rückimport weicht von der festgelegten Vorgabe ab.');
 const targets=ctx.openUnits||[],expected=new Set(targets.map(u=>u.id));
 if(!expected.size)throw Error('Alle Stunden sind bereits gehalten oder ausgelassen; kein offener Rest.');
 if(expected.size!==targets.length)throw Error('Doppelte Stunden-IDs in der Originalreihe.');
 if(!Array.isArray(doc.units)||doc.units.length!==expected.size)
  throw Error('Es müssen genau '+expected.size+' noch offene Stunden mit ihren vorhandenen IDs zurückkommen.');
 const seen=new Set(),refs=new Map((ctx.materials||[]).map(m=>[m.ref,m]));
 const audits=doc.materialAudit;
 if(!Array.isArray(audits)||audits.length!==refs.size)
  throw Error('Die Materialprüfung muss alle '+refs.size+' beigefügten Referenzen ausdrücklich bewerten.');
 const assessed=new Map();
 for(const a of audits){
  if(!refs.has(a?.ref)||assessed.has(a.ref)||!VERDICTS.includes(a.verdict)||
    !text(a.reason,700))
   throw Error('Die Materialprüfung enthält unbekannte, doppelte oder unbegründete Einträge.');
  const original=refs.get(a.ref);
  if(original.teacherOnly&&a.verdict==='usable')
   throw Error('Lehrkraft-Bewertungsunterlagen dürfen nicht als Schülerhauptmaterial gelten: '+original.name);
  if(!original.available&&a.verdict==='usable')
   throw Error('Material '+original.name+' ist nicht als Original verfügbar und darf nicht als nutzbar gelten.');
  assessed.set(a.ref,{ref:a.ref,verdict:a.verdict,reason:text(a.reason,700),
   suggestedUse:text(a.suggestedUse,800)});
 }
 const units=[];
 for(const item of doc.units){
  if(!item||!expected.has(item.unitId)||seen.has(item.unitId))
   throw Error('Stunden-ID fehlt, ist doppelt oder gehört zu einer gehaltenen Stunde: '+text(item?.unitId,150));
  seen.add(item.unitId);
  const original=targets.find(u=>u.id===item.unitId);
  if(!text(item.title,260)||!text(item.content,3300)||!text(item.objective,1600))
   throw Error('Stunde '+original.id+' braucht Titel, Inhalt und Lernziel.');
  if(item.plannedDate!==original.plannedDate)
   throw Error('Der geplante Termin '+original.plannedDate+' wurde verändert. Termine werden nicht still verschoben.');
  const links=item.studentMaterialRefs;
  if(!Array.isArray(links)||new Set(links).size!==links.length||links.length>45)
   throw Error('Materialauswahl für '+original.id+' ist ungültig.');
  for(const ref of links){
   if(!refs.has(ref)||assessed.get(ref)?.verdict!=='usable')
    throw Error('Nur nach Prüfung nutzbare Unterrichtsmaterialien dürfen aktiv zugeordnet werden: '+ref);
  }
  if(!Array.isArray(item.bookTasks)||item.bookTasks.length>20)
   throw Error('Buch-/Arbeitsheftaufträge müssen als Liste vorliegen.');
  if(typeof item.needsNewWorksheet!=='boolean')
   throw Error('Bitte pro Stunde explizit angeben, ob ein eigenes Arbeitsblatt benötigt wird.');
  if(item.needsNewWorksheet&&!text(item.worksheetBrief,1800))
   throw Error('Für das neu benötigte Arbeitsblatt fehlt ein konkreter Erstellungsauftrag.');
  units.push({unitId:item.unitId,plannedDate:original.plannedDate,
   title:text(item.title,260),content:text(item.content,3300),
   objective:text(item.objective,1600),notes:text(item.notes,1200),
   studentMaterialRefs:links,bookTasks:item.bookTasks.map(v=>text(v,500)).filter(Boolean),
   needsNewWorksheet:item.needsNewWorksheet,worksheetBrief:text(item.worksheetBrief,1800),
   additionalPreparation:text(item.additionalPreparation,1100),
   teachingReason:text(item.teachingReason,1600)});
 }
 if(units.length!==expected.size)throw Error('Der Rückimport ist nicht vollständig.');
 return {schema:SCHEMA,sequenceId:ctx.sequence.id,courseId:ctx.course.id,
  deliverable:{title,deadline,type:text(ctx.deliverable.type,130),
   description:text(ctx.deliverable.description,1500)},
  materialAudit:[...assessed.values()],units};
}
function prompt(ctx){
 const open=ctx.openUnits||[],sample={
  schema:SCHEMA,sequenceId:ctx.sequence.id,courseId:ctx.course.id,
  deliverable:{title:ctx.deliverable.title,deadline:ctx.deliverable.deadline,
   type:ctx.deliverable.type,description:ctx.deliverable.description},
  materialAudit:(ctx.materials||[]).map(m=>({
   ref:m.ref,verdict:m.available?'usable':'unknown',
   reason:'Nach tatsächlicher Sichtung begründen – kein Default übernehmen',
   suggestedUse:''})),
  units:open.map(u=>({
   unitId:u.id,plannedDate:u.plannedDate,title:'Neue konkrete Stundenfrage',
   content:'Inhalt, Aktivierung und Schülerarbeit',objective:'Beobachtbares Lernziel',
   notes:'',studentMaterialRefs:[],bookTasks:[],needsNewWorksheet:true,
   worksheetBrief:'Konkrete Anforderungen an ein neu zu erstellendes AB',
   additionalPreparation:'',teachingReason:'Warum diese Stunde zum Lernfortschritt beiträgt'}))
 };
 return '# Schulcockpit – AUSSCHLIESSLICH den noch offenen Rest einer bestehenden Reihe neu planen\n\n'+
 'Lies zuerst 00_START_HIER.md, 02_IST_UND_SOLL.json, 03_MATERIALMANIFEST.json, 04_LEISTUNGSABGABE.json und alle enthaltenen Originaldateien. '+
 'Es handelt sich um eine kritische didaktische Überarbeitung, NICHT um eine neue Reihe oder eine Neuplanung der gehaltenen Stunden.\n\n'+
 '## Unveränderliche Vorgaben der Lehrkraft\n'+
 'Fach/Kurs: '+ctx.course.subject+' '+ctx.course.name+'. Reihe: '+ctx.sequence.title+'.\n'+
 'Zwei bzw. alle in der Datei als GEHALTEN gekennzeichneten Unterrichtsstunden sind IST und bleiben UNVERÄNDERT. '+
 'Weitere in retainedUnits ausdrücklich ausgenommene, aber noch nicht als gehalten markierte Stunden sind ebenfalls UNVERÄNDERLICH. '+
 'Die neu zu planenden Stunden stehen einzeln mit festen unitIds und Sollterminen in 02_IST_UND_SOLL.json. '+ 
 'Ändere weder Kurs-ID, Reihen-ID, Stunden-ID noch Datum. Der Umfang des offenen Rests ist durch diese Liste vorgegeben; '+ 
 'zusätzliche Stunden nur als unverbindliche Anregung im Fließtext, nicht im JSON.\n'+
 'Abgabeleistung: '+ctx.deliverable.title+' ('+ctx.deliverable.type+'). '+
 'Verbindliche Abgabe am '+ctx.deliverable.deadline+'. '+ctx.deliverable.description+'\n'+
 'Die Reihe muss genügend sinnvolle Unterrichtszeit VOR der Abgabe zur inhaltlichen Vorbereitung, '+ 
 'Gestaltung, Reflexion und Orientierung zur Leistungsaufgabe lassen. Am Abgabetag ist die Abgabe verbindlich '+ 
 'einzuplanen; keine spätere Stunde als Vorbereitung für diese Frist ausgeben. '+ 
 'Bewertungskriterien dürfen als transparente Information für Lernende erläutert werden, '+ 
 'sind aber KEIN tragfähiges Hauptmaterial für eine ganze Stunde. '+ 
 'Bewertungsraster/Lehrkraftlösungen niemals als Schülerarbeitsblatt oder Kopierauftrag einplanen.\n\n'+
 '## Unbedingt Material kritisch prüfen\n'+
 'Bewerte ALLE Dateien aus dem Manifest anhand ihres wirklichen Inhalts: usable (didaktisch tragfähige Schülergrundlage), '+ 
 'teacher_only (nur Lehrkraft, z. B. Korrektur-/Bewertungsbogen), unsuitable (nicht sinnvoll verwendbar), '+ 
 'needs_revision (überarbeiten), unknown (Original fehlt oder nicht lesbar). '+ 
 'Begründe jeden Eintrag, statt ihn aus seinem Dateinamen zu erraten. Kopiere nicht einfach die alten Materialzuweisungen. '+ 
 'Ein unbrauchbares oder reines Lehrkraftmaterial darf NICHT in studentMaterialRefs erscheinen. '+ 
 'Bei fehlenden didaktisch geeigneten Originalen MUSS needsNewWorksheet=true stehen, '+ 
 'mit einem KONKRETEN worksheetBrief für ein neues Arbeitsblatt – inklusive Inhalt, Texte/Quellen, '+ 
 'Aufgaben, AFB, Umfang, erwarteter Arbeitszeit und ggf. Differenzierung. Behaupte nicht, das AB sei bereits vorhanden. '+ 
 'Buch-/Arbeitsheftaufträge nur als solche benennen, keine unbekannten Aufgabentexte erfinden. '+ 
 'Alte bereits verwendete Materialien nicht erneut zum Hauptmaterial machen, nur wenn bewusste Fortführung begründet ist; '+ 
 'Druckstatus (bereits ausgeteilt) beachten.\n\n'+
 '## Curriculare Zuverlässigkeit und didaktische Qualität\n'+
 'Nutze die belegten Kompetenzen und Quellen aus dem Paket, keine erfundenen curricularen Anforderungen. '+ 
 'Didaktische Ergänzungen als Vorschläge kennzeichnen. '+ 
 'Die einzelnen Stunden sollen fachlich SUBSTANZIELL sein (echte Lernhandlungen, argumentative/gestalterische Arbeit, '+ 
 'Reflexion und passende Sicherung), nicht eine ganze Stunde mit Bewertungsmaßstäben, Organisation oder zwei Impulsfragen füllen. '+ 
 'Bei Tod/Trauer sensibel, ohne Zwang zur Offenlegung persönlicher Erfahrungen, mit fiktiven Alternativen. '+ 
 'Prüfe, ob der alte Themen- und Materialplan die Lernziele überhaupt erfüllen kann, und korrigiere ihn gegebenenfalls deutlich. '+ 
 'Plane offen, was zusätzlich erstellt oder besorgt werden muss. '+ 
 'Eine kurze PowerPoint für einen Einstieg ist möglich, aber Material ist die Arbeitsgrundlage.\n\n'+
 '## Rückimport\n'+
 'Erstelle zuerst eine knappe Begründung der neuen Reihenlogik und eine Materialprüfung mit '+
 'konkreten Warnungen. Danach exakt EINEN vollständigen JSON-Datenblock, jede offene Stunde GENAU EINMAL, '+ 
 'jede Materialreferenz aus dem Manifest GENAU EINMAL in materialAudit. '+ 
 'studentMaterialRefs darf ausschließlich usable-Referenzen enthalten. '+ 
 'plannedDate und alle IDs aus dem Paket exakt kopieren. Die Lehrerleistung inklusive Termin UNVERÄNDERT übernehmen. '+ 
 'Verwende keine Markdown-Codefences IM Block. Dies ist ein Schema-MUSTER, die Platzhalter sind zu ersetzen:\n'+
 '<SCHULCOCKPIT_PARTIAL_SEQUENCE_IMPORT>\n'+JSON.stringify(sample,null,2)+
 '\n</SCHULCOCKPIT_PARTIAL_SEQUENCE_IMPORT>\n';
}
return {SCHEMA,validate,prompt,tag,validDate};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_PARTIAL_SEQUENCE_V313;
