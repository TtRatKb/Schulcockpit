/* V0.29.3 – Fachspezifische, lokal berechnete Rückmeldungsbausteine.
 * This is a pure transformation of already calculated competence results.
 * No changes to points, private feedback, profiles or imported exams. */
const SC_FEEDBACK_FACH_V293=(function(){
'use strict';
function subjectKind(subject){
 const text=String(subject||'').toLocaleLowerCase('de-DE').trim();
 if(/mathematik|mathe/.test(text))return 'math';
 if(/religion|religionslehre|evangel|kathol/.test(text))return 'religion';
 return 'other';
}
function label(text,max=94){
 let value=String(text||'').trim()
  .replace(/^(?:du kannst|ich kann)\s+/i,'')
  .replace(/\s*\((?:A(?:ufgabe)?\s*)?\d+(?:\s*[,–-]\s*(?:A(?:ufgabe)?\s*)?\d+)*\)\s*\.?$/i,'')
  .replace(/[.!]\s*$/,'').replace(/\s+/g,' ');
 if(!value)return 'diesem Lernbereich';
 if(value.length<=max)return value;
 const cut=value.slice(0,max-1),last=cut.lastIndexOf(' ');
 return (last>=max/2?cut.slice(0,last):cut).trimEnd()+'…';
}
function quote(c){return '„'+label(c?.text)+'“';}
function evaluated(report){
 return (report?.competencies||[]).filter(c=>
  Number(c.regularMax)>0&&Number.isFinite(c.pct)&&
  ['erreicht','teilweise erreicht','noch nicht erreicht'].includes(c.status));
}
function action(c){
 const t=String(c?.text||'').toLocaleLowerCase('de-DE');
 if(/begründen|beurteilen|bewerten|stellung\s*nehm|argument|urteil|verhalten/.test(t))
  return 'Überlege, welche Gründe deine Antwort stützen, und formuliere sie nachvollziehbar.';
 if(/deuten|erschließ|interpret|symbol|bedeutung/.test(t))
  return 'Achte darauf, welche Hinweise im Text oder Material deine Deutung stützen.';
 if(/vergleichen|unterscheid|gemeinsamkeit|unterschied/.test(t))
  return 'Stelle Gemeinsamkeiten und Unterschiede gegenüber und erläutere, worauf du dich beziehst.';
 if(/prüfen|richtigkeit|behauptung|aussag/.test(t))
  return 'Prüfe deine Aussagen anhand der behandelten Inhalte und begründe deine Entscheidung.';
 if(/erklär|erläuter|zusammenhang|zusammenhänge|anwenden/.test(t))
  return 'Versuche, die Zusammenhänge in eigenen Worten zu erklären.';
 if(/benennen|zuordnen|begriffe|regeln|nennen/.test(t))
  return 'Halte die wichtigsten Begriffe fest und erkläre, was sie bedeuten.';
 if(/beschreiben|darstellen/.test(t))
  return 'Beschreibe die wesentlichen Merkmale noch einmal möglichst genau.';
 if(/reflektieren|perspektiv|einschätz/.test(t))
  return 'Betrachte unterschiedliche Sichtweisen und begründe deine Einschätzung.';
 return 'Überlege, welche Inhalte aus dem Unterricht deine Antworten stützen.';
}
function complete(report){
 return !!report&&(report.complete===true||
  (report.learningSupportV235===true&&report.scoreCompleteV283===true));
}
function compose(report){
 const all=evaluated(report),reached=all.filter(c=>c.status==='erreicht')
  .sort((a,b)=>b.pct-a.pct),unfinished=all.filter(c=>c.status!=='erreicht')
  .sort((a,b)=>a.status===b.status?a.pct-b.pct:
   a.status==='noch nicht erreicht'?-1:1);
 const focus=unfinished[0]||null, n=reached.length, total=all.length;
 if(!complete(report)||total===0||total!==(report?.competencies||[]).filter(c=>Number(c.regularMax)>0).length){
  return {strength:['Die Auswertung ist noch nicht vollständig.'],
   next:['Prüfe bitte zuerst, ob alle Punkte und Teilwertungen erfasst sind.'],
   strong:null,development:null};
 }
 let first,alternative;
 if(n===total){
  first='Du hast die Lernziele in allen bewerteten Bereichen erreicht. Das ist ein tolles Ergebnis!';
  alternative='Die behandelten Inhalte hast du in allen bewerteten Bereichen gut erfasst. Klasse!';
 }else if(n>=3){
  const spread=n/total>=.8?'den meisten':'mehreren';
  first='Du hast in '+spread+' Bereichen die Lernziele erreicht. Das ist dir gut gelungen!';
  alternative='Bei vielen Inhalten der Arbeit hast du bereits gezeigt, was du verstanden hast.';
 }else if(n===2){
  const two='Bei '+quote(reached[0])+' und '+quote(reached[1])+' hast du die Lernziele erreicht.';
  first=two.length<=240?two:'Bei '+quote(reached[0])+' hast du das Lernziel erreicht.';
  alternative='In zwei Bereichen der Arbeit hast du die Lernziele bereits erreicht. Gut gemacht!';
 }else if(n===1){
  first='Bei '+quote(reached[0])+' hast du das Lernziel erreicht. Das ist dir gut gelungen!';
  alternative='Die Aufgaben zu '+quote(reached[0])+' sind dir bereits gut gelungen.';
 }else if(Number(report?.totalEarned??(Number(report?.totalReg||0)+Number(report?.totalBonusEarned||0)))>0){
  first='Du hast in einigen Aufgaben bereits Punkte erreicht. Darauf kannst du aufbauen.';
  alternative='Einige Inhalte hast du schon richtig erfasst. Daran kannst du weiterarbeiten.';
 }else{
  first='Die Themen dieser Arbeit waren noch schwierig. Schau sie dir in Ruhe erneut an.';
  alternative='Diesmal waren die Inhalte noch nicht leicht. Gehe die Aufgaben nach und nach erneut durch.';
 }
 const strength=[first,alternative].filter(x=>x.length<=250);
 if(Number(report?.totalBonusEarned)>0)
  strength.push('Auch bei den Bonusaufgaben hast du zusätzliche Punkte erreicht.');
 let next,other;
 if(focus){
  const topic=quote(focus);
  next='Schau dir die Aufgaben zu '+topic+' noch einmal an. '+action(focus);
  other='Nimm dir '+topic+' noch einmal vor. Erkläre dir die wichtigsten Inhalte in eigenen Worten.';
 }else{
  next='Wähle einen Gedanken aus der Arbeit aus und erkläre, warum er für das Thema wichtig ist.';
  other='Überlege, welche unterschiedlichen Sichtweisen es zu einem Thema der Arbeit gibt.';
 }
 const nextIdeas=[next,other].map(s=>s.length<=250?s:
  'Lies die zugehörigen Aufgaben noch einmal und erläutere die wichtigsten Inhalte in eigenen Worten.');
 return {strength,next:nextIdeas,strong:reached[0]||null,development:focus};
}
function defaultFeedback(report){
 const s=compose(report);
 return {strength:s.strength[0]||'',next:s.next[0]||''};
}
function prompt(report,subject){
 const s=compose(report),kind=subjectKind(subject),course=kind==='religion'?'Religion':'den Unterricht';
 return 'Formuliere zwei kurze, freundliche persönliche Rückmeldungen für '+course+'. '
  +'Beschreibe nur tatsächlich belegbare Leistungen, keine erfundenen Ursachen oder Eigenschaften. '
  +'Der Schwerpunkt soll auf dem Verstehen von Inhalten, dem Erklären, Deuten, Vergleichen '
  +'oder Begründen liegen, je nachdem, welche Kompetenz tatsächlich vorliegt. '
  +'Kein mathematisches Üben, keine erfundenen Zusatzaufgaben und keine automatischen Fehlerdiagnosen. '
  +'Sprich das Kind mit „du“ an. Maximal 230 Zeichen je Text. '
  +'Keine Namen, IDs, Klassenbezeichnungen, Daten, Punkte, Prozentzahlen oder Antworten. '
  +'Antworte in genau zwei Zeilen: STÄRKE: ... und NÄCHSTER SCHRITT: ...\n'
  +'Erreichte Kompetenzbereiche: '+(s.strong?label(s.strong.text,145):'keine sicher erreichten Bereiche')+'\n'
  +'Möglicher nächster Schwerpunkt: '+(s.development?label(s.development.text,145):'inhaltliche Vertiefung');
}
return {subjectKind,label,action,evaluated,complete,compose,defaultFeedback,prompt};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_FEEDBACK_FACH_V293;
