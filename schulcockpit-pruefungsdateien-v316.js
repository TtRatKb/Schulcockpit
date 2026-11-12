/* Schulcockpit V0.31.6 – Prüfungsdateien nach Fassung kennzeichnen und privat Kindern zuordnen.
 * Dateikategorien sind normale Prüfungsmetadaten. Namen und Kind-IDs liegen
 * ausschließlich in schulcockpit-assessment-private-v1 (nicht in state/Prompts).
 * Kein automatisches Ableiten der Fassung aus Fördermerkmalen.
 */
(function(){
'use strict';
const ROLES=[
 ['standard','Reguläre Klassenarbeit'],
 ['alternative','Nachschreibearbeit'],
 ['inclusion','Inklusionsarbeit'],
 ['inclusion_makeup','Inklusions-Nachschreibearbeit'],
 ['solution','Lösung / Erwartungshorizont'],
 ['other','Sonstige Prüfungsdatei']
];
const SPECIAL=new Set(['alternative','inclusion','inclusion_makeup']);
let context=null;
let pendingMeta=new WeakMap();
let loadSequence=0;

function roleFor(value){
 return ROLES.some(x=>x[0]===value)?value:'standard';
}
function labelFor(role){
 return ROLES.find(x=>x[0]===role)?.[1]||ROLES[0][1];
}
function optionHtml(role){
 return ROLES.map(([value,label])=>'<option value="'+value+'"'+(role===value?' selected':'')+'>'+esc(label)+'</option>').join('');
}
function metaOf(file){
 let data=pendingMeta.get(file);
 if(!data){data={role:'standard',ids:[]};pendingMeta.set(file,data);}
 return data;
}
function assignedIds(key,kind){
 if(kind==='pending'){
  const file=v188AssessmentDraft?.pendingFiles?.[Number(key)];
  return file?(metaOf(file).ids||[]):[];
 }
 return context?.assignments?.get(key)||[];
}
function assignmentHtml(kind,key,role){
 if(!SPECIAL.has(role)){
  return '<small class="v316-hint">'+(role==='standard'
   ?'Standardfassung für alle übrigen regulär teilnehmenden Kinder.'
   :'Keine individuelle Schülerzuordnung nötig.')+'</small>';
 }
 if(context?.status==='loading')return '<small class="v316-hint">Klassenliste und bisherige Zuordnungen werden geladen …</small>';
 if(context?.status==='error')return '<small class="v316-error">Private Zuordnungen konnten nicht geladen werden.</small>';
 const list=context?.roster||[];
 if(!list.length)return '<small class="v316-warning">Noch keine Klassenliste für diesen Fachkurs vorhanden. Bitte im Bereich „Klassenlisten“ eintragen.</small>';
 const selected=new Set(assignedIds(key,kind));
 const count=list.filter(s=>selected.has(s.id)).length;
 const choices=list.map(s=>
  '<label class="v316-student"><input type="checkbox" data-v316-assign="'+esc(kind+'|'+key+'|'+s.id)+'"'+
  (selected.has(s.id)?' checked':'')+'><span>'+esc(s.name)+
  (typeof v235Participates==='function'&&!v235Participates(s)?' <small>(nicht regulär teilnehmend)</small>':'')+
  '</span></label>').join('');
 return '<details class="v316-assignment"><summary>Schüler*innen zuordnen · '+count+' ausgewählt</summary>'+
  '<div class="v316-students">'+choices+'</div>'+
  '<p class="microcopy">Nur ausdrücklich ausgewählte Kinder erhalten diese Fassung. Die Zuordnung bleibt privat im Browser.</p></details>'+
  (!count?'<small class="v316-warning">Für diese Fassung ist noch niemand zugeordnet.</small>':'');
}
function fileRow(file,index,kind){
 const pending=kind==='pending';
 const key=pending?String(index):String(file.fileKey||'');
 const meta=pending?metaOf(file):null;
 const role=roleFor(pending?meta.role:file.roleV316);
 const buttons=pending
  ?'<button class="danger-lite small" data-v188-assessment-pending-remove="'+index+'" aria-label="Datei entfernen">×</button>'
  :'<button class="text-button" data-v188-assessment-file-open="'+esc(key)+'">Öffnen</button>'+
   '<button class="danger-lite small" data-v188-assessment-file-remove="'+esc(file.id)+'" aria-label="Datei entfernen">×</button>';
 return '<div class="v316-file v188-file-row'+(pending?' pending':'')+'">'+
  '<div class="v316-file-top"><span><strong>'+esc(file.name)+'</strong>'+
  '<small>'+(pending?'wird beim Speichern lokal hinterlegt':'lokal gespeichert')+'</small></span>'+
  '<div class="v316-file-buttons">'+buttons+'</div></div>'+
  '<label class="v316-role-label">Dateikategorie <select data-v316-role="'+esc(kind+'|'+key)+'">'+optionHtml(role)+'</select></label>'+
  assignmentHtml(kind,key,role)+'</div>';
}
function sectionHtml(){
 const a=v188AssessmentDraft||{};
 const saved=(a.files||[]).map((f,i)=>fileRow(f,i,'saved')).join('');
 const pending=(a.pendingFiles||[]).map((f,i)=>fileRow(f,i,'pending')).join('');
 const changed=context?.changedCourse?'<p class="v316-warning">Der Fachkurs wurde gewechselt. Frühere Schülerzuordnungen werden nicht auf den anderen Kurs übertragen.</p>':'';
 return '<section class="detail-section v316-exam-files"><div class="section-head compact"><div>'+
  '<span class="eyebrow">PRÜFUNGSDATEIEN · FASSUNGEN</span>'+
  '<h3>Regulär, Nachschreiben & Inklusion</h3></div>'+
  '<label class="upload-button">Dateien hinzufügen<input id="v188-assessment-files" type="file" multiple hidden></label></div>'+
  '<p class="muted">Lade mehrere Fassungen derselben Klassenarbeit hoch, wähle pro Datei eine Kategorie und ordne Sonderfassungen gezielt Kindern aus deiner Klassenliste zu. Die Standardfassung gilt für alle übrigen regulär Teilnehmenden.</p>'+
  changed+
  '<div class="v188-assessment-files v316-files">'+
  (saved+pending||'<p class="muted">Noch keine Prüfungsdatei ausgewählt.</p>')+'</div>'+
  '<p class="microcopy">Dateien bleiben lokal. Namen und Zuordnungen werden weder in Planungsprompts noch im regulären Schulcockpit-Backup gespeichert. Sichere private Zuordnungen separat.</p>'+
  '</section>';
}
function snapshotVisible(){
 if(typeof v188ReadAssessmentDraft==='function')v188ReadAssessmentDraft();
 if(typeof v204ReadExamSelectionIntoDraft==='function')v204ReadExamSelectionIntoDraft();
}
async function loadPrivate(){
 const current=context;
 const draft=v188AssessmentDraft;
 if(!current||!draft)return;
 const classId=draft.classId;
 const assessmentId=draft.id;
 const seq=++loadSequence;
 current.status='loading';current.roster=[];current.assignments=new Map();
 current.classId=classId;
 try{
  const [classRecord,examRecord]=await Promise.all([
   v200PrivateGet(v235Key(classId)),
   assessmentId?v200PrivateGet(assessmentId):Promise.resolve(null)
  ]);
  if(seq!==loadSequence||context!==current||modal?.type!=='assessmentV188')return;
  current.roster=classRecord?.schema==='schulcockpit.private-class-roster.v1'&&
   classRecord.classId===classId?(classRecord.roster||[]):[];
  v235ValidRoster(current.roster);
  const stored=examRecord?.examAssignmentClassV316===classId?
   (examRecord.examFileAssignmentsV316||{}):{};
  current.assignments=new Map(Object.entries(stored).filter(x=>Array.isArray(x[1]))
   .map(([key,ids])=>[key,[...new Set(ids.map(String))]]));
  current.status='ready';
 }catch(error){
  if(seq!==loadSequence||context!==current)return;
  console.error('Private Prüfungszuordnungen konnten nicht geladen werden:',error);
  current.status='error';
 }
 if(context===current&&modal?.type==='assessmentV188')render();
}
const previousOpen=v188OpenAssessment;
v188OpenAssessment=function(id=''){
 loadSequence++;
 pendingMeta=new WeakMap();
 context={status:'loading',roster:[],assignments:new Map(),classId:'',changedCourse:false};
 previousOpen(id);
 void loadPrivate();
};
const previousModal=v188AssessmentModal;
v188AssessmentModal=function(){
 const html=previousModal();
 if(!v188AssessmentDraft)return html;
 const rx=/<section class="detail-section"><div class="section-head compact"><div><span class="eyebrow">PRÜFUNGSDATEIEN<\/span>[\s\S]*?<\/section>/;
 return rx.test(html)?html.replace(rx,sectionHtml()):html.replace('<div class="v188-modal-actions">',sectionHtml()+'<div class="v188-modal-actions">');
};

function updateRole(kind,key,role){
 const draft=v188AssessmentDraft;
 if(!draft)return;
 if(kind==='pending'){
  const file=draft.pendingFiles?.[Number(key)];
  if(!file)return;
  const data=metaOf(file);data.role=role;
  if(!SPECIAL.has(role))data.ids=[];
 }else{
  const file=draft.files?.find(f=>f.fileKey===key);
  if(!file)return;
  file.roleV316=role;
  if(!SPECIAL.has(role))context?.assignments?.delete(key);
 }
}
function updateAssignment(kind,key,id,checked){
 const allowed=new Set((context?.roster||[]).map(s=>String(s.id)));
 if(!allowed.has(id)||context?.status!=='ready')return;
 if(kind==='pending'){
  const file=v188AssessmentDraft?.pendingFiles?.[Number(key)];if(!file)return;
  const data=metaOf(file),values=new Set(data.ids||[]);
  checked?values.add(id):values.delete(id);
  data.ids=[...values];
 }else{
  const values=new Set(context.assignments.get(key)||[]);
  checked?values.add(id):values.delete(id);
  context.assignments.set(key,[...values]);
 }
}
function validateAssignments(savedDraft){
 const known=new Set((context?.roster||[]).map(x=>String(x.id)));
 const roles=new Map();
 const all=[...(savedDraft.files||[]).map(f=>({
  role:roleFor(f.roleV316),ids:context.assignments.get(String(f.fileKey||''))||[]
 })),...(savedDraft.pendingFiles||[]).map(f=>({
  role:roleFor(metaOf(f).role),ids:metaOf(f).ids||[]
 }))];
 for(const data of all){
  if(!SPECIAL.has(data.role))continue;
  for(const id of data.ids){
   if(!known.has(String(id)))throw Error('Eine Schülerzuordnung passt nicht mehr zur Klassenliste. Bitte die Zuordnung überprüfen.');
   const seen=roles.get(id)||new Set();
   seen.add(data.role);roles.set(id,seen);
  }
 }
 if([...roles.values()].some(x=>x.size>1))
  throw Error('Ein Kind wurde mehreren unterschiedlichen Sonderfassungen zugeordnet. Bitte die Auswahl prüfen.');
}
const previousSave=v188SaveAssessment;
v188SaveAssessment=async function(){
 const draft=v188AssessmentDraft;
 if(!draft)return previousSave();
 snapshotVisible();
 if(!context||context.status!=='ready'||context.classId!==draft.classId)
  throw Error('Die private Klassenliste ist noch nicht geladen oder konnte nicht gelesen werden. Bitte erneut öffnen und prüfen.');
 validateAssignments(draft);
 const existingCount=(draft.files||[]).length;
 const pending=(draft.pendingFiles||[]).map(f=>({
  role:roleFor(metaOf(f).role),ids:[...(metaOf(f).ids||[])]
 }));
 const rolesExisting=new Map((draft.files||[]).map(f=>[String(f.fileKey||''),roleFor(f.roleV316)]));
 const assignments=new Map([...context.assignments.entries()].map(([key,ids])=>[key,[...ids]]));
 // Bestehende Save-/Migrations-Wrapper bleiben die Quelle für Datei-Blobs und
 // alle anderen Prüfungsfelder. Wir ergänzen nur unsere eigene Dateimetadaten.
 if(!draft.id)draft.id=uid('assess');
 const id=draft.id;
 const ok=await previousSave();
 if(!ok)return ok;
 const saved=state.assessments?.find(a=>a.id===id);
 if(!saved)throw Error('Die gespeicherte Klassenarbeit wurde nicht wiedergefunden.');
 const newlyAdded=saved.files.slice(existingCount);
 if(newlyAdded.length!==pending.length)
  throw Error('Dateien gespeichert, aber Zuordnung der neuen Fassungen nicht eindeutig. Bitte prüfen.');
 const privateAssignments={};
 for(const file of saved.files){
  const role=rolesExisting.get(String(file.fileKey))||'standard';
  file.roleV316=role;
  if(SPECIAL.has(role)){
   const ids=assignments.get(String(file.fileKey))||[];
   if(ids.length)privateAssignments[file.fileKey]=ids;
  }
 }
 for(let i=0;i<newlyAdded.length;i++){
  const file=newlyAdded[i],data=pending[i];
  file.roleV316=data.role;
  if(SPECIAL.has(data.role)&&data.ids.length)privateAssignments[file.fileKey]=data.ids;
 }
 // Vorhandene Prüfungsdateien und Korrekturdaten bleiben erhalten; nur dieses
 // zusätzliche private Feld wird geändert.
 await saveState();
 const privateRecord=await v200PrivateGet(id);
 privateRecord.examAssignmentClassV316=saved.classId;
 privateRecord.examFileAssignmentsV316=privateAssignments;
 await v200PrivatePut(privateRecord);
 render();
 return ok;
};
const previousWire=wire;
wire=function(){
 previousWire();
 if(modal?.type!=='assessmentV188'||!v188AssessmentDraft)return;
 document.querySelectorAll('[data-v316-role]').forEach(select=>select.addEventListener('change',()=>{
  snapshotVisible();
  const value=select.dataset.v316Role||'',split=value.indexOf('|');
  if(split<0)return;
  updateRole(value.slice(0,split),value.slice(split+1),roleFor(select.value));
  render();
 }));
 document.querySelectorAll('[data-v316-assign]').forEach(box=>box.addEventListener('change',()=>{
  const parts=(box.dataset.v316Assign||'').split('|');
  if(parts.length!==3)return;
  updateAssignment(parts[0],parts[1],parts[2],box.checked);
  const details=box.closest('details');
  if(details){
   const summary=details.querySelector('summary');
   const count=details.querySelectorAll('input[type="checkbox"]:checked').length;
   if(summary)summary.textContent='Schüler*innen zuordnen · '+count+' ausgewählt';
   const warning=details.nextElementSibling;
   if(warning?.classList.contains('v316-warning'))warning.hidden=count>0;
  }
 }));
 document.getElementById('v188-assessment-class')?.addEventListener('change',event=>{
  const id=event.target.value;
  if(!context||context.classId===id)return;
  context.changedCourse=true;
  void loadPrivate();
 });
};
if(typeof window!=='undefined')window.SchulcockpitExamFilesV316={
 roles:ROLES.slice(),roleFor,labelFor
};
})();