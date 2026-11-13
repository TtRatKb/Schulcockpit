/* Schulcockpit V0.31.8 – derselbe Dateityp und die private Schülerzuordnung
 * direkt dort, wo die Lehrkraft in Auswertung > Schritt 1 ihre Dateien sieht.
 * Vorhandene lokale Blobs, Prüfungs-ID, Kursliste und Bewertungsdaten bleiben erhalten.
 */
(function(){
'use strict';
const OPTIONS=[
 ['standard','Reguläre Klassenarbeit'],
 ['alternative','Nachschreibearbeit'],
 ['inclusion','Inklusionsarbeit'],
 ['inclusion_makeup','Inklusions-Nachschreibearbeit'],
 ['solution','Lösung / Erwartungshorizont'],
 ['reference','Vorlage / andere Version'],
 ['other','Sonstige Datei (nicht analysieren)']
];
const SPECIAL=new Set(['alternative','inclusion','inclusion_makeup']);
let updating=false;
function current(){return v200Assessment(v200Eval?.assessmentId);}
function privateData(){return v200Eval?.privateData;}
function kind(a,file){
 const actual=file.roleV316;
 if(OPTIONS.some(([key])=>key===actual))return actual;
 const old=v214Role(a,file);
 return old==='used'?'standard':old==='rubric'?'solution':'reference';
}
function label(kind){return OPTIONS.find(x=>x[0]===kind)?.[1]||kind;}
function options(value){
 return OPTIONS.map(([key,name])=>'<option value="'+key+'"'+(key===value?' selected':'')+'>'+esc(name)+'</option>').join('');
}
function classRoster(a){
 const record=typeof v235Current==='function'?v235Current():null;
 return record?.classId===a.classId?record:null;
}
function activeResultsForFile(priv,key){
 return (priv?.roster||[]).some(s=>{
  if(priv?.examFileV317?.[s.id]!==key&&priv?.activeVariantV300?.[s.id]!=='file:'+key)return false;
  return (window.SchulcockpitExamAnalysisV317?.hasResults(priv,s.id))||
   !!priv?.makeupHistoryV300?.some(h=>h.studentId===s.id&&h.variant==='file:'+key);
 });
}
function studentList(a,file,priv){
 const roster=classRoster(a);
 if(!roster)return '<p class="v318-help">Die private Kursliste wird geladen. Die Auswahl erscheint hier automatisch.</p>';
 const members=roster.roster||[];
 if(!members.length)return '<p class="v318-help">Für diesen Kurs ist noch keine Klassenliste hinterlegt. Ergänze die Namen im Abschnitt „Klassenliste“ oben auf dieser Seite.</p>';
 if(priv?.examAssignmentClassV316&&priv.examAssignmentClassV316!==a.classId)
  return '<p class="v318-error">Die früheren privaten Zuordnungen gehören zu einem anderen Fachkurs. Bitte den Kursbezug überprüfen.</p>';
 const ids=new Set(priv?.examFileAssignmentsV316?.[file.fileKey]||[]);
 const count=members.filter(s=>ids.has(s.id)).length;
 return '<details class="v318-assign"><summary>Schüler*innen zuordnen · '+count+' ausgewählt</summary>'+
  '<div class="v318-members">'+members.map(s=>
   '<label><input type="checkbox" data-v318-student="'+esc(file.fileKey+'|'+s.id)+'" '+
   (ids.has(s.id)?'checked ':'')+'><span>'+esc(s.name)+
   (typeof v235Participates==='function'&&!v235Participates(s)?' <small>(nicht regulär teilnehmend)</small>':'')+
   '</span></label>').join('')+'</div>'+
  '<p class="microcopy">Nur ausgewählte Kinder erhalten diese Fassung. Es wird kein Fördermerkmal automatisch übernommen; Namen bleiben im privaten Browserspeicher.</p></details>'+
  (count?'<small class="v318-good">'+count+' Kind(er) zugeordnet</small>':
   '<small class="v318-help">Noch keinem Kind zugeordnet. Für die spätere Auswertung bitte zuordnen.</small>');
}
function fileCard(a,file,priv){
 const role=kind(a,file),isStandard=role==='standard';
 const selected=isStandard&&v214Role(a,file)==='used';
 const hasRubric=!!priv?.variantAnalysesV317?.[file.fileKey];
 return '<div class="v318-file-card"><div class="v318-file-title"><div>'+
  '<strong>'+esc(file.name)+'</strong><small>Original bleibt lokal gespeichert</small></div>'+
  '<button class="text-button" data-v214-file-open="'+esc(file.fileKey)+'">Öffnen</button></div>'+
  '<label class="v318-type">Art der Datei<select data-v318-role="'+esc(file.id)+'">'+options(role)+'</select></label>'+
  (isStandard?
   '<label class="v318-regular"><input type="radio" name="v318-regular-source" data-v318-main="'+esc(file.id)+'"'+
   (selected?' checked':'')+'> Diese Datei als Grundlage für die <strong>reguläre Prüfungsanalyse</strong> verwenden</label>':
   SPECIAL.has(role)?
    '<div class="v318-special"><p><strong>'+esc(label(role))+'</strong> – diese Fassung erhält eigene Aufgaben, Maximalpunkte und Kompetenzzuordnungen.</p>'+
    studentList(a,file,priv)+
    '<div class="v318-rubric-status"><span>'+(hasRubric?'✓ Eigenes Bewertungsraster hinterlegt':'Eigenes Bewertungsraster noch offen')+'</span>'+
    '<button class="secondary" type="button" data-v318-rubric="'+esc(file.fileKey)+'">Raster in Schritt 2 bearbeiten</button></div></div>':
   '<p class="v318-help">'+(role==='solution'?
    'Wird als Erwartungshorizont bei der regulären Prüfungsanalyse berücksichtigt.':
    'Diese Datei bleibt gespeichert, wird aber nicht als geschriebene Prüfungsfassung ausgewertet.')+'</p>')+
  '</div>';
}
const originalPanel=v214FilePanel;
v214FilePanel=function(a){
 if(!a)return originalPanel(a);
 const priv=v200Eval?.assessmentId===a.id?privateData():null;
 const fileKinds=(a.files||[]).map(f=>kind(a,f));
 const regularSelected=(a.files||[]).filter(f=>kind(a,f)==='standard'&&v214Role(a,f)==='used');
 const specials=fileKinds.filter(x=>SPECIAL.has(x)).length;
 return '<section class="detail-section v318-exam-sources"><div class="v318-section-head">'+
  '<div><span class="eyebrow">PRÜFUNGSDATEIEN · FASSUNGEN</span>'+
  '<h3>1. Welche Fassung schreibt welches Kind?</h3></div>'+
  '<label class="upload-button">Dateien hinzufügen<input id="v214-exam-files" type="file" multiple hidden '+
  'accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.pptx,.txt"></label></div>'+
  '<p class="muted">Ordne jede vorhandene Datei direkt hier ein. Für Nachschreibe- und Inklusionsarbeiten kannst du anschließend die Kinder aus der bestehenden Klassenliste auswählen. Jede abweichende Fassung bekommt in Schritt 2 ihr eigenes geprüftes Bewertungsraster.</p>'+
  '<div class="v318-cards">'+(a.files||[]).map(f=>fileCard(a,f,priv)).join('')+
  (!(a.files||[]).length?'<p>Noch keine Prüfungsdateien hinterlegt.</p>':'')+'</div>'+
  (regularSelected.length!==1?
   '<p class="v318-error">Bitte genau eine reguläre, tatsächlich geschriebene Arbeit als Grundlage der regulären Analyse auswählen. Derzeit: '+regularSelected.length+'.</p>':
   '<p class="v318-good">✓ Reguläre Prüfungsgrundlage: '+esc(regularSelected[0].name)+'</p>')+
  (specials?'<p class="microcopy">'+specials+' abweichende Prüfungsfassung(en) mit eigener Auswertung. Diese Dateien werden nicht mit der regulären Aufgabenanalyse vermischt.</p>':'')+
  '<p class="microcopy">Die Classtime-Ergebnis-Excel kommt erst bei der lokalen Punkteauswertung dazu. Keine Namen, Schülerantworten oder Punktedateien an ChatGPT hochladen.</p>'+
  '</section>';
};
async function saveKind(fileId,nextKind){
 if(updating)return;
 const a=current(),file=a?.files?.find(f=>f.id===fileId);
 if(!file||!OPTIONS.some(x=>x[0]===nextKind))throw Error('Prüfungsdatei oder Kategorie fehlt.');
 const priv=privateData(),oldKind=kind(a,file);
 if(oldKind===nextKind)return;
 if(activeResultsForFile(priv,file.fileKey))
  throw Error('Diese Fassung wird bereits für bewertete Ergebnisse verwendet. Bitte die bestehenden Versuche zuerst kontrollieren; der Dateityp kann nicht stillschweigend verändert werden.');
 const oldFileRole=file.roleV316,oldRoles={...(a.evaluationFilesV214||{})};
 const before={...(priv?.examFileAssignmentsV316||{})};
 updating=true;
 try{
  file.roleV316=nextKind;
  a.evaluationFilesV214={...oldRoles};
  if(nextKind==='standard'){
   for(const other of a.files||[])if(other.id!==fileId&&kind(a,other)==='standard')
    a.evaluationFilesV214[other.id]='reference';
   a.evaluationFilesV214[fileId]='used';
  }else{
   a.evaluationFilesV214[fileId]=nextKind==='solution'?'rubric':'reference';
  }
  // Private assignments are removed only if the file is no longer an
  // examination version. No score/grade/roster is modified.
  if(SPECIAL.has(oldKind)&&!SPECIAL.has(nextKind)&&priv?.examFileAssignmentsV316?.[file.fileKey]){
   const copy=structuredClone(priv);
   delete copy.examFileAssignmentsV316[file.fileKey];
   await v200PrivatePut(copy);
   if(v200Eval?.assessmentId===a.id)v200Eval.privateData=copy;
  }
  await saveState();
 }catch(e){
  file.roleV316=oldFileRole;
  a.evaluationFilesV214=oldRoles;
  if(priv?.examFileAssignmentsV316)priv.examFileAssignmentsV316=before;
  throw e;
 }finally{updating=false;render();}
}
async function selectRegular(fileId){
 if(updating)return;
 const a=current(),file=a?.files?.find(f=>f.id===fileId);
 if(!file||kind(a,file)!=='standard')throw Error('Die gewählte Datei ist keine reguläre Prüfungsfassung.');
 const old={...(a.evaluationFilesV214||{})};
 try{
  a.evaluationFilesV214={...old};
  for(const f of a.files||[])if(kind(a,f)==='standard')
   a.evaluationFilesV214[f.id]=f.id===fileId?'used':'reference';
  await saveState();
 }catch(e){a.evaluationFilesV214=old;throw e;}
 render();
}
async function assign(key,studentId,checked){
 if(updating)return;
 const a=current(),file=a?.files?.find(f=>f.fileKey===key),cls=classRoster(a);
 if(!a||!file||!SPECIAL.has(kind(a,file)))throw Error('Keine zuweisbare Sonderfassung.');
 if(!cls||!cls.roster?.some(s=>s.id===studentId))throw Error('Kind nicht in der vorhandenen privaten Kursliste.');
 const priv=privateData();
 if(!priv)throw Error('Privater Auswertungsspeicher nicht geöffnet.');
 if(priv.examAssignmentClassV316&&priv.examAssignmentClassV316!==a.classId)
  throw Error('Vorhandene Zuordnung gehört zu einem anderen Kurs.');
 const all={...(priv.examFileAssignmentsV316||{})},set=new Set(all[key]||[]);
 if(checked){
  for(const [otherKey,ids] of Object.entries(all)){
   const other=a.files.find(f=>f.fileKey===otherKey);
   if(other&&otherKey!==key&&SPECIAL.has(kind(a,other))&&kind(a,other)!==kind(a,file)&&ids.includes(studentId))
    throw Error('Dieses Kind ist bereits einer anderen Sonderfassung zugeordnet. Entferne zunächst die bisherige Zuordnung.');
  }
  set.add(studentId);
 }else set.delete(studentId);
 if(set.size)all[key]=[...set];else delete all[key];
 const next=structuredClone(priv);
 next.examAssignmentClassV316=a.classId;
 next.examFileAssignmentsV316=all;
 await v200PrivatePut(next);
 if(v200Eval?.assessmentId===a.id)v200Eval.privateData=next;
 render();
}
const beforeDownload=v200DownloadAnalysisBundle;
v200DownloadAnalysisBundle=async function(){
 const a=current();
 if(a){
  const count=(a.files||[]).filter(f=>kind(a,f)==='standard'&&v214Role(a,f)==='used').length;
  if(count!==1)throw Error('Für die reguläre Prüfungsanalyse genau eine geschriebene Standardfassung auswählen. Derzeit: '+count+'.');
 }
 return beforeDownload();
};
const beforeWire=wire;
wire=function(){
 beforeWire();
 if(view!=='evaluation'||v200Eval?.step!==1)return;
 document.querySelectorAll('[data-v318-role]').forEach(el=>el.onchange=()=>{
  void saveKind(el.dataset.v318Role,el.value).catch(e=>alert('Dateikategorie nicht gespeichert: '+(e.message||e)));
 });
 document.querySelectorAll('[data-v318-main]').forEach(el=>el.onchange=()=>{
  if(el.checked)void selectRegular(el.dataset.v318Main).catch(e=>alert('Prüfungsauswahl nicht gespeichert: '+(e.message||e)));
 });
 document.querySelectorAll('[data-v318-student]').forEach(el=>el.onchange=()=>{
  const [key,id]=String(el.dataset.v318Student||'').split('|');
  void assign(key,id,el.checked).catch(e=>{alert('Zuordnung nicht gespeichert: '+(e.message||e));render();});
 });
 document.querySelectorAll('[data-v318-rubric]').forEach(el=>el.onclick=()=>{
  v200Eval.step=2;render();
 });
};
const oldRender=render;
render=function(){
 oldRender();
 const label=document.querySelector('.brand small');
 if(label)label.textContent=(state.settings?.schoolYear||'')+' · V0.31.8';
};
window.SchulcockpitExamSourcesV318={kind,label,selectRegular,assign,saveKind};
})();