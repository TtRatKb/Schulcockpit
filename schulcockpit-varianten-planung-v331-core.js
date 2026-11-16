/* Schulcockpit V0.33.1 – Teacher-selected worksheets constrain AI planning.
 * Read-only decisions: no automatic edits to sequences or stored files.
 */
const SC_TEACHER_SOURCE_CONTRACT_V331=(function(){
'use strict';
const clean=v=>String(v??'').trim();
const marker='Danach hänge GENAU EINEN maschinenlesbaren Block an:';
function levelFromName(name){
 const stem=clean(name).replace(/\.[^.]+$/,'');
 const m=stem.match(/(?:^|[_ .-])([GE])$/i);
 return m?.[1]?.toUpperCase()==='G'?'G-Fassung (Grundniveau)':
  m?.[1]?.toUpperCase()==='E'?'E-Fassung (Erweiterungsniveau)':'';
}
const role=name=>({standard:'Standardfassung',support:'Unterstützende Fassung',
 challenge:'Forderfassung',daz:'Sprachsensible Fassung',
 solution:'Lehrkraft-Lösung'})[name]||'Fassung';
function activeEntries(l,materials,priority){
 return priority.entries(l,materials).filter(x=>x.materialId&&x.variants.length);
}
function contract(text,l,entries){
 const chosen=entries.flatMap(e=>e.variants.map(v=>{
  const level=levelFromName(v.fileName);
  return '- '+v.fileName+' ('+role(v.type)+(level?', '+level:'')+')';
 })).join('\n');
 const old=clean(l?.planReference?.title||''),focus=clean(l?.lessonFocusV331?.title||l?.title||'');
 const topic=l?.lessonFocusV331?.title?
  'Die Lehrkraft hat den Schwerpunkt dieser Stundenkarte ausdrücklich auf „'+focus+
  '“ geändert. Der frühere Soll-Titel „'+old+'“ bleibt nur als Rückblick. '+
  'Ändere KEINE Reihen oder nachfolgenden Stunden.':
  'Soll-Titel: „'+old+'“. Der tatsächliche Schwerpunkt der Stunde muss zu '+
  'den vorhandenen Arbeitsblättern passen. Falls der Titel nicht passt, '+
  'schlage einen präziseren Stundentitel vor; ändere nicht die Reihe.';
 const rules='## Verbindlicher Auftrag: vorhandene Lehrkraftmaterialien\n'+
  'Es existieren bereits von der Lehrkraft selbst bearbeitete Arbeitsblätter. '+
  'Erstelle KEINE neuen Arbeitsblätter, Ersatzdateien, Aufgabenpakete, PDFs '+
  'oder Word-Dokumente. Deine Aufgabe ist ausschließlich ein realistischer '+
  'Unterrichtsverlauf und PowerPoint-Folien MIT diesen vorhandenen Dateien.\n'+
  'Für ChatGPT ausgewählte Fassungen (auch zur Differenzierung):\n'+
  (chosen||'- Keine aktiven Editionen.')+'\n'+
  'Die E- und G-Fassungen sind Alternativen für Lernniveaus, NICHT zwei '+
  'Arbeitsblätter, die alle nacheinander bearbeiten müssen. Die gespeicherten '+
  'Variantenrollen haben Vorrang; überprüfe die Inhalte beider Dateien.\n'+
  'Verwende die bestehenden Arbeitsaufträge und ergänze passende Folien, '+
  'Phasen und Sicherung. Wenn der Soll-Titel fachlich nicht zu den Dateien '+
  'passt, benenne die Diskrepanz knapp und plane die konkrete Stunde anhand '+
  'der bereitgestellten Materialien. Ziehe keine späteren Reihenthemen vor.\n'+
  'Im maschinenlesbaren SCHULCOCKPIT_IMPORT muss "materials":[] stehen, '+
  'denn die Dateien sind bereits im Schulcockpit hinterlegt.\n'+
  'Wenn Dateien fehlen oder nicht lesbar sind, frage nach; erfinde weder '+
  'deren Inhalt noch neue Ersatzmaterialien.\n'+topic+'\n';
 let result=String(text||'');
 result=result.replace('erfinde nur dann neues Material, wenn es didaktisch wirklich nötig ist',
  'erstelle keinerlei neue Arbeitsblätter, da die ausgewählten Dateien verbindlich sind')
 .replace('4. notwendige zusätzliche Materialien/Differenzierung nur falls nötig,',
  '4. Differenzierung anhand der vorhandenen E-/G- oder Förderfassungen ohne neue Dateien,');
 const at=result.indexOf(marker);
 result=at>=0?result.slice(0,at)+rules+'\n'+result.slice(at):result+'\n\n'+rules;
 return result+'\n\nWICHTIG: Keine neuen Arbeitsblätter erzeugen oder importieren; '+
  'nur Folien und Phasen planen. Das JSON-Feld "materials" bleibt [].\n';
}
function importDecision(lesson,pkg,entries){
 if(!entries?.length)return {pkg,suppressed:[],protected:false};
 const suppressed=(pkg?.materials||[]).map(x=>x.title).filter(Boolean);
 // A ChatGPT-generated title may be about an entirely different unit.
 // Preserve the existing teacher-visible lesson title unless they explicitly edit it.
 const focus=clean(lesson?.lessonFocusV331?.title||lesson?.title||'');
 return {pkg:{...pkg,
  lesson:focus?{...(pkg.lesson||{}),title:focus}:pkg.lesson,
  materials:[]},suppressed,protected:true};
}
return {activeEntries,contract,importDecision,role,levelFromName};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_TEACHER_SOURCE_CONTRACT_V331;
