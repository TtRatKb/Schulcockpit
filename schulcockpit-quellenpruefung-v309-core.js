/* V0.30.9 – source integrity is an evidence trail, not AI self-certification.
 * Neither filenames nor broad curricular scope prove the placement of
 * a particular topic in a particular lesson. Existing plans stay unchanged.
 */
const SC_PLAN_SOURCES_V309=(function(){
'use strict';
const TYPES=['curriculum','themenkarte','material','lehrkraft','unspecified'];
const clean=(x,n=300)=>String(x??'').trim().slice(0,n);
const norm=x=>clean(x,1000).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
function evidence(input){
 const raw=input&&typeof input==='object'?input:{},type=TYPES.includes(raw.type)?raw.type:'unspecified';
 const refs=Array.isArray(raw.references)?raw.references:raw.source?[raw.source]:[];
 return {type,document:clean(raw.document||raw.title,170),
  passage:clean(raw.passage||raw.quote,260),
  comment:clean(raw.comment||raw.uncertainty,450),
  references:refs.filter(x=>typeof x==='string').map(x=>clean(x,150)).slice(0,4),
  declaredBy:'ai-unverified'};
}
function status(unit){
 const review=unit?.sourceReviewV309?.status;
 if(review==='accepted')return 'teacher-accepted';
 if(review==='revision')return 'revision';
 if(unit?.importedFromV184||unit?.sourceEvidenceV309)return 'unverified';
 return 'other';
}
function tally(sequences){
 const units=(sequences||[]).flatMap(q=>q?.plan||[]);
 return {all:units.length,ai:units.filter(u=>u.importedFromV184||u.sourceEvidenceV309).length,
  unverified:units.filter(u=>status(u)==='unverified').length,
  revision:units.filter(u=>status(u)==='revision').length,
  teacherAccepted:units.filter(u=>status(u)==='teacher-accepted').length};
}
function prompt(old,sequence,sourceFiles){
 const warning='## Quellenbindung: enger Themenkartenrahmen statt allgemeiner Ergänzungen\n'+
 'Das Schulcurriculum kann mehr Lerninhalte enthalten als die konkrete Themenkarte/Reihe. '+
 'Curricular irgendwo genannte Inhalte gehören NICHT automatisch in diese Stunde. '+
 'Prüfe pro Stunde die tatsächliche Themenkarte, die konkrete Kompetenz und die vorhandenen Materialseiten. '+
 'Beispiel: „Teiler und Vielfache“ können im Lehrplan unter natürlichen Zahlen stehen, '+
 'ohne deshalb in einer einzelnen Stunde zur schriftlichen Division zwingend vorgesehen zu sein.\n'+
 'Nur nachweisbar zugeordnete Inhalte als verbindliche Stunde planen. '+
 'Unbelegte fachliche Ergänzungen separat als optionale Idee markieren, keinesfalls '+
 'in Titel, verpflichtenden Inhalt oder Kompetenz hineinschreiben. '+
 'Wenn die Themenkarte nur „Division von natürlichen Zahlen, Zerlegung, Rest, Fachbegriffe“ '+
 'nennt, ist daraus keine gesicherte Anweisung abzuleiten, in dieser Stunde '+
 '„Teiler und Vielfache“ oder zusätzliche Spezialthemen zu unterrichten.\n'+
 'Ein Dateiname, Themenkartenname oder im Cockpit verlinktes PDF ist KEIN Beleg, '+
 'dass ChatGPT dessen Inhalt gelesen hat. Du musst die tatsächlichen Originale '+
 'im Chat erhalten haben, bevor du daraus fachliche Aussagen ableitest. '+
 'Fehlt eine Quelle, schreibe „nicht durch vorliegende Quelle belegt“ und '+
 'vermeide eine erfundene Quelle, Seitenzahl oder wörtliche Textstelle.\n'+
 'Pro JSON-Stunde ein Feld sourceEvidence mit type: curriculum|themenkarte|material|lehrkraft|unspecified, '+
 'document, passage (knapper tatsächlicher Beleg, nicht erfinden), comment und references[] ausgeben. '+
 'Falls die Quelle nicht zugänglich war, sourceEvidence.type="unspecified", '+
 'passage="" und comment mit offener Lücke angeben. '+
 'Die Herkunft wird vor dem Import nur als KI-Angabe, NICHT als automatisch überprüfter Nachweis behandelt.\n';
 const q=(sequence?.plan||[]).filter(u=>status(u)==='revision');
 const issues=q.length?'## Von der Lehrkraft bereits beanstandete Stunden\n'+
  q.map(u=>'- '+u.title+': '+clean(u.sourceReviewV309?.note,300)).join('\n')+
  '\nDiese Stunden NICHT stillschweigend unverändert übernehmen; Korrektur oder Quellenprüfung verlangen.\n':'';
 const names=(sourceFiles||[]).map(x=>x.name||x).filter(Boolean);
 const provenance='## Tatsächliche Dateiverfügbarkeit\n'+
 (names.length?'Im lokalen Schulcockpit hinterlegt (Inhalt im Chat erst sichtbar NACH Hochladen): '+
 names.join(' · '):'Im Cockpit keine speziellen Planungs-/Themenkarten-Dateien für diese Reihe bestätigt.')+
 '\nNicht behaupten, diese lokalen Dateien gelesen zu haben.\n';
 const insert='\n'+warning+'\n'+provenance+'\n'+issues+'\n';
 const at=String(old||'').indexOf('## Auftrag\n');
 let result=at>=0?old.slice(0,at)+insert+old.slice(at):old+insert;
 result=result.replace('"notes": "", "materials": [',
  '"notes": "", "sourceEvidence": {"type":"unspecified","document":"","passage":"","comment":"","references":[]}, "materials": [');
 return result;
}
function unitLabel(unit){
 const e=unit?.sourceEvidenceV309||{};
 if(status(unit)==='revision')return 'Überarbeitung vorgemerkt';
 if(status(unit)==='teacher-accepted')return 'Von Lehrkraft anhand einer Quelle abgeglichen';
 if(status(unit)==='unverified')return e.type&&e.type!=='unspecified'?
  'KI nennt eine Quelle – noch NICHT geprüft':'Herkunft von ChatGPT-Inhalten nicht belegt';
 return 'Manuelle/ältere Planung · keine KI-Quellenangabe';
}
return {TYPES,norm,evidence,status,tally,prompt,unitLabel};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_PLAN_SOURCES_V309;