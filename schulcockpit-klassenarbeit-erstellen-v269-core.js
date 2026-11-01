/* Schulcockpit V0.26.9 – pure exam-creation brief selection and prompt.
   No private roster, names or results are consulted. */
const SC_EXAM_BRIEF_V269=(function(){
'use strict';
function text(v,max=600){return String(v??'').trim().slice(0,max);}
function optionsForExam(exam,seqs=[],lessons=[],today=''){
 if(!exam||!exam.date)return [];
 const out=[],represented=new Set();
 const ordered=seqs.filter(q=>q.classId===exam.classId).sort((a,b)=>String(a.startDate||'').localeCompare(String(b.startDate||'')));
 for(const q of ordered)for(const [idx,u] of (q.plan||[]).entries()){
  if(u.skippedThisYearV201)continue;
  const linked=lessons.filter(l=>l.classId===exam.classId&&(
    l.planReference?.unitId===u.id||l.sequenceId===q.id&&l.date===u.plannedDate||
    l.sequenceId===q.id&&l.title===u.title&&l.date===u.plannedDate));
  const l=linked.find(x=>x.heldV269)||linked[0]||null;
  const date=l?.date||u.plannedDate||'';
  if(date&&date>=exam.date)continue;
  if(l)represented.add(l.id);
  const held=linked.some(x=>x.heldV269);
  const changed=linked.some(x=>x.actualV270?.savedAt&&x.actualV270.mode!=='asplanned');
  const stage=changed?'changed':held?'held':date&&date<today?'unconfirmed':date&&date>=today?'upcoming':'undated';
  out.push({key:'u:'+q.id+':'+u.id,courseId:exam.classId,sequenceId:q.id,unitId:u.id,
   date,stage,defaultChecked:stage==='held'||stage==='unconfirmed'||stage==='changed',
   sequence:text(q.title,170),title:text(l?.title&&l.title!=='Thema noch festlegen'?l.title:u.title,200),
   content:text(u.content||l?.planReference?.content,900),objective:text(u.objective||l?.objective,500),
   competence:text((u.competencies||[]).map?.(x=>typeof x==='string'?x:x.text||'').join('; ')||u.competencies||'',500),
   lessonSummary:l?text((l.phasePlan||[]).map(p=>p.title||'').filter(Boolean).join('; '),450):'',
   sourceKind:'sequence',order:idx});
 }
 for(const l of lessons.filter(l=>l.classId===exam.classId&&l.date&&l.date<exam.date)){
  if(represented.has(l.id)||l.kind==='group'||l.groupId||l.status==='canceled')continue;
  if(ordered.some(q=>(q.plan||[]).some(u=>u.plannedDate===l.date&&q.id===l.sequenceId)))continue;
  const stage=l.actualV270?.savedAt&&l.actualV270.mode!=='asplanned'?'changed':l.heldV269?'held':l.date<today?'unconfirmed':'upcoming';
  out.push({key:'l:'+l.id,courseId:exam.classId,sequenceId:l.sequenceId||'',
   date:l.date,stage,defaultChecked:stage!=='upcoming',
   sequence:text(ordered.find(q=>q.id===l.sequenceId)?.title||l.unit||'Zusätzliche Stunde',170),
   title:text(l.title||'Nicht benannt',200),content:text(l.planReference?.content||'',900),
   objective:text(l.objective||'',500),competence:'',lessonSummary:text((l.phasePlan||[]).map(p=>p.title||'').filter(Boolean).join('; '),450),
   sourceKind:'lesson'});
 }
 return out.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||a.sequence.localeCompare(b.sequence));
}
function makePrompt({exam,course,selected=[],files=[],rules={}}){
 if(!exam?.date||!course)throw Error('Prüfungstermin und Kurs fehlen.');
 if(!selected.length)throw Error('Bitte mindestens einen behandelten oder geplanten Inhalt auswählen.');
 const lines=selected.map((u,i)=>
  `${i+1}. [${u.stage==='held'?'ALS GEHALTEN ERFASST':u.stage==='upcoming'?'VOR DER ARBEIT GEPLANT – NOCH NICHT GEHALTEN':u.stage==='changed'?'ANDERS DURCHGEFÜHRT – SOLL NICHT ALS VERMITTELT ANNEHMEN':u.stage==='unconfirmed'?'VERGANGENER PLAN – DURCHFÜHRUNG NICHT BESTÄTIGT':'DATUM OFFEN – NICHT BESTÄTIGT'}] ${u.date||'ohne Datum'} · ${u.sequence} – ${u.title}\n   Inhalt: ${u.content||'nicht eingetragen'}\n   Ziel: ${u.objective||'nicht eingetragen'}${u.competence?'\n   Kompetenzen: '+u.competence:''}${u.lessonSummary?'\n   Stundenphasen: '+u.lessonSummary:''}`).join('\n');
 const refs=files.map(f=>'- '+f.name+' ('+(f.colleague?'Kolleg*innenarbeit / Referenzarbeit':f.kind||'Unterrichtsmaterial')+')'+(f.note?' · '+f.note:'')).join('\n')||'- Keine Dateien ausgewählt.';
 const when=selected.filter(x=>x.stage==='upcoming').map(x=>x.title);
 return `# Schulcockpit · Klassenarbeit VOR dem Schreiben entwerfen

## Ausgangslage
- Kurs: ${text(course.subject,80)} ${text(course.name,60)}
- Leistungsnachweis: ${text(exam.title||exam.type||'Klassenarbeit',150)}
- Termin: ${exam.date}
- Von der Lehrkraft angegebener Stoff: ${text(exam.scope||'',600)||'nicht angegeben'}
- Zeit für die Arbeit: ${text(rules.duration||'noch offen',45)}
- Gewünschte Form: ${text(rules.format||'noch offen',45)}
- Zusätzliche Vorgaben: ${text(rules.instructions||'',1500)||'keine'}

## Verbindliche Stoffauswahl
${lines}
${when.length?'\nVOR DER ARBEIT NOCH ZU UNTERRICHTEN, ABER AUSDRÜCKLICH ALS PRÜFUNGSSTOFF AUSGEWÄHLT: '+when.join('; '):''}

## Materialdateien, die ich ausgewählt habe
${refs}

Die Liste benennt Dateien, gibt aber ihren Inhalt NICHT wieder. Verwende sie nur, wenn sie mit diesem Paket tatsächlich hochgeladen wurden. Falls eine Datei fehlt, sage es ausdrücklich.

## Dein Auftrag
Erstelle einen ersten einsatzfähigen Entwurf der Klassenarbeit mit sachgerechter Bearbeitungszeit, nachvollziehbarer Punkteverteilung, Aufgabenstellungen und getrenntem Erwartungshorizont/Musterlösung. Orientiere dich am ausgewählten Unterrichtsstoff und am tatsächlichen Leistungsstand des Jahrgangs. Berücksichtige die ausgewählten künftigen Stunden nur, weil die Lehrkraft sie ausdrücklich als prüfungsrelevant gewählt hat. Ihre Durchführung ist noch nicht bestätigt.

Nutze Arbeiten von Kolleg*innen höchstens als fachliche und didaktische Vergleichsvorlage. Erstelle eine eigenständige Arbeit und überprüfe Aufgabenabdeckung, Schwierigkeit und Umfang. Formuliere keine personenbezogenen Schülerbezüge. Keine erfundenen Lehrplanvorgaben, Kompetenzformulierungen, Punkte oder Musterlösungen aus nicht beigefügten Dateien.

Kennzeichne, welche Aufgaben auf welchem Stoff beruhen, und liefere eine kompakte Prüfungsmatrix (Thema · Aufgabe · mögliche Punkte). Wenn ein entscheidender Stoffbereich, die Bearbeitungszeit oder Bewertungsanforderungen unklar sind, stelle gezielte Rückfragen, bevor du diese Fakten festlegst.

Die Arbeit muss rechtzeitig vor dem Prüfungstermin an die Förderschullehrkraft gegeben werden können. Ergänze deshalb eine kurze, nicht personenbezogene Übersicht: Welche Aufgaben lassen sich bei Bedarf sprachlich vereinfachen, strukturieren oder mit Hilfen versehen? Lege Fördermaßnahmen nicht allein aus einem Etikett ab und ändere fachliche Anforderungen nicht ungefragt.

Die finale Arbeit und Musterlösung bitte getrennt ausgeben.\n`;
}
return {optionsForExam,makePrompt};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_EXAM_BRIEF_V269;
