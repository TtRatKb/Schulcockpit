/* V0.29.8 – locally stored teaching methods; pure filtering and lesson hints. */
const SC_METHOD_BANK_V298=(function(){
'use strict';
const PHASES=[['entry','Einstieg'],['work','Erarbeitung'],['secure','Sicherung'],['deepen','Vertiefung / Transfer']];
const SUBJECTS=[['math','Mathematik'],['religion','Religion']];
const BUILTINS=[
 ['frage','Einstiegs- / Diskussionsfrage','entry','both','Offene, begründbare Frage zu einer bereits verständlichen Situation.','Stellt einen echten Denk- oder Deutungskonflikt her.','Keine Begriffe abfragen, die erst im heutigen Material erklärt werden.'],
 ['bild','Bildimpuls / Karikatur','entry','both','Passendes Bild zunächst beschreiben, dann deuten und Fragen entwickeln.','Ein fachlich aussagekräftiges und rechtlich verwendbares Bild liegt vor.','Kein beliebiges Dekor; bei Karikaturen Perspektive und Kontext klären.'],
 ['fehler','Fehlerdetektiv','entry','math','Fehlerhafte Lösung untersuchen, Fehler begründen und korrigieren.','Die notwendigen Grundbegriffe wurden bereits eingeführt.','Nicht als Rätsel über völlig neue Rechenregeln einsetzen.'],
 ['fehlerr','Fehlerdetektiv: Aussage prüfen','entry','religion','Eine bewusst problematische Aussage anhand bekannten Vorwissens prüfen und differenzieren.','Die Aussage ist fair und kontextualisiert.','Keine Stereotype oder unbekannten Fachbegriffe als vermeintliches Vorwissen.'],
 ['topflop','Top oder Flop','entry','both','Kurze begründete Aussagen aus bereits erarbeitetem Stoff prüfen.','Nur zur Aktivierung und Wiederholung.','Nicht als Routine erzwingen, keine ungeklärten neuen Begriffe.'],
 ['schatzen','Schätzen und begründen','entry','math','Erst einen Wert abschätzen, danach Lösungswege vergleichen.','Eine nachvollziehbare Alltagssituation bzw. Größe ist vorhanden.','Schätzung soll Denkwege öffnen, nicht nur raten lassen.'],
 ['denkpause','Think – Pair – Share','entry','both','Kurze Einzelüberlegung, Austausch zu zweit und begründetes Teilen.','Geeigneter offener Impuls, genügend Zeit zur Wortmeldung.','Nicht alle drei Schritte künstlich für eine triviale Frage durchlaufen.'],
 ['text','Textarbeit mit Markierauftrag','work','both','Kernaussagen markieren, gezielte Leitfrage beantworten und Ergebnisse verbinden.','Lesbarer, altersgerechter Originaltext liegt vor.','Keinen zusätzlichen langen Auftrag erfinden, wenn das AB alles vorgibt.'],
 ['exppuzzle','Expertenpuzzle','work','both','Unterschiedliche Teilaspekte in Expertengruppen bearbeiten und gegenseitig erklären.','Mindestens drei wirklich unterschiedliche, vergleichbar anspruchsvolle Informationsbereiche.','Bei nur einem Arbeitsblatt mit einem Thema ungeeignet.'],
 ['lerntempoduett','Lerntempoduett','work','math','Aufgaben zunächst selbst bearbeiten und bei ähnlichem Stand Lösungen erklären.','Differenzierte Aufgaben oder natürliche unterschiedliche Bearbeitungstempi.','Keine bloße künstliche Arbeitsaufteilung auf Folien.'],
 ['stationen','Stationenarbeit','work','both','Mehrere Stationen mit klar unterschiedlichen Zielen eigenständig bearbeiten.','Mehrere vorbereitete Stationen und ausreichend Zeit.','Bei einem einzelnen AB nicht erzwingen; Materialumfang beachten.'],
 ['quellen','Quellenvergleich','work','religion','Zwei Deutungen oder Textquellen gegenüberstellen und daraus eine Position entwickeln.','Mindestens zwei geeignete Perspektiven oder Quellen liegen vor.','Unklare Herkunft und ungleiche Quellen nicht unkritisch gleichsetzen.'],
 ['tandem','Partner-Tandem','work','math','Getrennte Aufgabenvarianten bearbeiten, vergleichen und gegenseitig erklären.','Passende A/B-Varianten liegen vor oder sind leicht verfügbar.','Nicht aus einem Einzelblatt unnötig zwei neue Versionen machen.'],
 ['tafel','Gemeinsames Tafelbild','secure','both','Lernende formulieren Kernaussagen, die gemeinsam geordnet werden.','Ergebnisse liegen vor und können sinnvoll gebündelt werden.','Erwartete Ergebnisse nur in Lehrkraftnotizen, nicht vorab einblenden.'],
 ['vergleich','Lösungswege vergleichen','secure','math','Zwei Lösungswege begründen, Gemeinsamkeiten und Unterschiede klären.','Zwei tatsächliche oder plausible Lösungswege.','Keine fertige Lösung präsentieren, bevor Lernende argumentieren.'],
 ['begrunden','Positionen begründet vergleichen','secure','religion','Unterschiedliche Positionen mit Textbelegen nebeneinanderstellen und begründet abwägen.','In der Erarbeitung wurden tragfähige Argumente erschlossen.','Kein reines Meinungssammeln ohne fachliche Begründung.'],
 ['anker','Drei wichtigste Erkenntnisse','secure','both','Drei tragfähige Kerngedanken gemeinsam herausarbeiten.','Es gibt tatsächlich mehrere zentrale Einsichten.','Keine Wiederholung einer langen Aufgabenliste.'],
 ['exit','Exit-Ticket','deepen','both','Eine kurze individuelle Transfer- oder Reflexionsfrage schriftlich beantworten.','Eine konkrete, zum Ziel passende abschließende Frage.','Nicht als zusätzliche umfangreiche Arbeitsphase.'],
 ['transfer','Anwendung / Transfer','deepen','both','Gelerntes auf einen neuen, überschaubaren Fall übertragen.','Die Grundlagen wurden zuvor gesichert.','Nicht bereits beim Einstieg unbekannte Kenntnisse voraussetzen.'],
 ['urteil','Begründetes Urteil','deepen','religion','Eigene Position mit fachlichen Argumenten abwägen und begründen.','Mehrere begründbare Perspektiven sind bekannt.','Weltanschauliche Antworten nicht als richtig/falsch vereinheitlichen.']
];
function defaults(){return BUILTINS.map(([id,title,phase,subject,description,when,avoid])=>({
 id:'built:'+id,title,phase,subjects:subject==='both'?['math','religion']:[subject],
 description,when,avoid,source:'',enabled:true,builtin:true}));}
function subject(raw){
 const x=String(raw||'').toLowerCase();
 if(/mathe|mathematik/.test(x))return 'math';
 if(/religi|evangel|kathol/.test(x))return 'religion';
 return '';
}
function clean(raw){
 const m=raw||{};
 return {id:String(m.id||''),title:String(m.title||'').trim().slice(0,110),
 phase:PHASES.some(x=>x[0]===m.phase)?m.phase:'entry',
 subjects:['math','religion'].filter(x=>(Array.isArray(m.subjects)?m.subjects:[]).includes(x)),
 description:String(m.description||'').trim().slice(0,900),
 when:String(m.when||'').trim().slice(0,650),
 avoid:String(m.avoid||'').trim().slice(0,650),
 source:/^https?:\/\//i.test(String(m.source||''))?String(m.source).slice(0,500):'',
 enabled:m.enabled!==false,builtin:!!m.builtin};
}
function valid(m){
 const x=clean(m);
 if(!x.title||!x.description||!x.subjects.length)throw Error('Titel, Erklärung und mindestens ein Fach eingeben.');
 if(!PHASES.some(p=>p[0]===x.phase))throw Error('Unterrichtsphase ist ungültig.');
 return x;
}
function recent(lesson,lessons,methods,count=5){
 return (lessons||[]).filter(l=>l.classId===lesson.classId&&l.id!==lesson.id&&
    l.date<lesson.date&&l.status==='done').sort((a,b)=>b.date.localeCompare(a.date))
  .slice(0,count).flatMap(l=>{
   const full=(l.phasePlan||[]).map(p=>p.title+' '+p.details).join(' ').toLowerCase();
   return (methods||[]).filter(m=>full.includes(m.title.toLowerCase())).map(m=>m.id);
  });
}
function recommended(lesson,course,all,recentIds=[]){
 const subj=subject(course?.subject),items=(all||[]).map(clean).filter(m=>m.enabled&&
   (!subj||m.subjects.includes(subj))),history=new Set(recentIds);
 const fav=lesson.methodPreferencesV298||{};
 const output={};
 for(const [phase] of PHASES){
  let options=items.filter(m=>m.phase===phase);
  options.sort((a,b)=>(fav[phase]===a.id?-5:0)-(fav[phase]===b.id?-5:0)||
   Number(history.has(a.id))-Number(history.has(b.id))||
   Number(a.builtin)-Number(b.builtin)||a.title.localeCompare(b.title,'de'));
  output[phase]=options.slice(0,8);
 }
 return output;
}
function methodPrompt(m){
 return '- '+m.title+' ('+m.id+'): '+m.description+
  (m.when?' Geeignet, wenn: '+m.when:'')+(m.avoid?' Ungeeignet, wenn: '+m.avoid:'');
}
return {PHASES,SUBJECTS,defaults,subject,clean,valid,recent,recommended,methodPrompt};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_METHOD_BANK_V298;