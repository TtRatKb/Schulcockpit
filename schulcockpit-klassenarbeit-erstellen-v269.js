/* Schulcockpit V0.26.9 – Klassenarbeit vor dem Schreiben aus tatsächlich vorhandenen Quellen planen.
   Alle Daten/Dateien verbleiben lokal, bis die Lehrkraft den ZIP-Export selbst hochlädt. */
(function(){
'use strict';
const core=SC_EXAM_BRIEF_V269;
let flow=null,busy=false;
const MAX_FILES=65,MAX_BYTES=180*1024*1024;
function safe(s){return String(s||'Datei').replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,' ').slice(0,110);}
function cGrade(c){return v202Grade(c);}
function subject(s){return String(s||'').trim().toLowerCase().startsWith('mathe')?'Mathematik':String(s||'').toLowerCase().startsWith('relig')?'Religion':String(s||'');}
function eligible(c,a){
 return !!c&&cGrade(c)===cGrade(cls(a.classId))&&subject(c.subject)===subject(cls(a.classId)?.subject);
}
function context(a){
 const year=v190YearFromDate(a.date),seqs=v190PlanningSequences(a.classId,year);
 const lessons=(state.lessons||[]).filter(l=>l.classId===a.classId).map(l=>({...l,heldV269:v182IsHeld(l)}));
 return {year,seqs,units:core.optionsForExam(a,seqs,lessons,iso(new Date()))};
}
function sources(a,seqs){
 const c=cls(a.classId),seqIds=new Set(seqs.map(q=>q.id)),out=[],seen=new Set();
 const add=x=>{if(!x.key||seen.has(x.key))return;seen.add(x.key);out.push(x);};
 for(const q of seqs)for(const f of q.sourceFilesV190||[]){
  add({key:'s:'+f.fileKey,name:f.name||'Planungsdatei',fileKey:f.fileKey,
   kind:'Reihenquelle',note:q.title,sequenceId:q.id,ready:!!f.fileKey,
   colleague:false,ref:null});
 }
 for(const m of state.materials||[]){
  if(m.catalogId&&(state.materialCatalog||[]).some(e=>e.catalogId===m.catalogId))continue;
  const h=m.hubV237||{},links=m.assignments||[],
   match=links.some(x=>x.classId===a.classId||seqIds.has(x.sequenceId))||
   h.courseId===a.classId||seqIds.has(h.sequenceId)||
   subject(h.subject)===subject(c?.subject)&&Number(h.grade)===cGrade(c);
  if(!match)continue;
  for(const v of m.variants||[])if(v.fileKey){
   const col=!!h.isColleagueReferenceV269||h.kind==='kollegenarbeit';
   add({key:'m:'+m.id+':'+v.id,name:v.fileName||m.title||'Material',
    fileKey:v.fileKey,kind:h.kind||'Material',note:h.note||'',
    colleague:col,ready:storedFileKeys.has(v.fileKey),ref:{type:'m',id:m.id}});
  }
 }
 for(const e of state.materialCatalog||[]){
  const h=e.hubV237||{},q=seqs.find(q=>q.title===e.sequenceTitle),
   match=h.courseId===a.classId||seqIds.has(h.sequenceId)||!!q||
     subject(h.subject)===subject(c?.subject)&&Number(h.grade)===cGrade(c);
  if(!match||e.scope==='exclude'||e.disposition==='excluded')continue;
  const col=!!h.isColleagueReferenceV269||h.kind==='kollegenarbeit';
  add({key:'c:'+e.catalogId,name:e.fileName||'Katalogdatei',kind:h.kind||e.scope||'Material',
   note:h.note||e.sequenceTitle||'',colleague:col,
   ready:!!catalogAvailableV17(e),ref:{type:'c',id:e.catalogId}});
 }
 return out.sort((a,b)=>Number(b.colleague)-Number(a.colleague)||
   Number(b.kind==='Reihenquelle')-Number(a.kind==='Reihenquelle')||
   a.name.localeCompare(b.name,'de')).slice(0,220);
}
function options(){
 const a=(state.assessments||[]).find(x=>x.id===flow?.assessmentId);
 if(!a)return null;
 const {year,seqs,units}=context(a),files=sources(a,seqs);
 return {a,year,seqs,units,files};
}
function open(id){
 const a=(state.assessments||[]).find(x=>x.id===id);
 if(!a||!cls(a.classId)||!a.date)return alert('Bitte zunächst den Fachkurs und einen festen Prüfungstermin eintragen.');
 const {seqs,units}=context(a),files=sources(a,seqs);
 const old=a.examBriefV269||{},prior=Array.isArray(old.unitKeys),priorFiles=Array.isArray(old.fileKeys);
 flow={assessmentId:id,
  unitKeys:new Set(prior?old.unitKeys:units.filter(x=>x.defaultChecked).map(x=>x.key)),
  fileKeys:new Set(priorFiles?old.fileKeys:files.filter(x=>x.ready&&x.kind==='Reihenquelle').map(x=>x.key)),
  duration:String(old.duration||''),format:String(old.format||'papier'),instructions:String(old.instructions||'')};
 modal={type:'examBriefV269'};render();
}
function line(u){
 const clsName=u.stage==='held'?'Durchgeführt ✓':u.stage==='upcoming'?'Noch geplant':u.stage==='unconfirmed'?'Vergangen · nicht bestätigt':'Ohne Datum';
 return '<label class="v269-unit"><input type="checkbox" data-v269-unit="'+esc(u.key)+'" '+(flow.unitKeys.has(u.key)?'checked':'')+'>'+
 '<span><strong>'+esc(u.title||'Soll-Stunde')+'</strong><small>'+esc(u.date?fmtDate(u.date):'ohne Datum')+' · '+esc(u.sequence)+' · '+clsName+'</small>'+
 (u.content?'<small>'+esc(u.content.slice(0,220))+'</small>':'')+'</span></label>';
}
function fileRow(f){
 return '<div class="v269-file"><label><input type="checkbox" data-v269-file="'+esc(f.key)+'" '+(flow.fileKeys.has(f.key)?'checked':'')+
 (!f.ready?'disabled':'')+'><span><strong>'+esc(f.name)+'</strong><small>'+esc(f.colleague?'Kolleg*innenarbeit · als Vorlage':'Material · '+f.kind)+
 (f.note?' · '+esc(f.note.slice(0,85)):'')+' · '+(f.ready?'Original verfügbar':'Original fehlt')+'</small></span></label>'+
 (f.ref?'<button type="button" class="text-button" data-v269-mark="'+esc(f.key)+'">'+
 (f.colleague?'Markierung entfernen':'Als Kolleg*innenarbeit markieren')+'</button>':'')+'</div>';
}
function modalPage(){
 const data=options();if(!data)return '';
 const {a,units,files}=data,c=cls(a.classId),chosen=units.filter(u=>flow.unitKeys.has(u.key)),upcoming=chosen.filter(u=>u.stage==='upcoming');
 const grouped=[
  {title:'Bereits vergangene Unterrichtstermine',list:units.filter(u=>u.stage==='held'||u.stage==='unconfirmed')},
  {title:'Noch bis zur Arbeit vorgesehen',list:units.filter(u=>u.stage==='upcoming'||u.stage==='undated')}
 ];
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-xwide v269-modal" data-modal-stop>'+
 '<header class="modal-header"><div><span class="eyebrow">VOR DER KLASSENARBEIT · '+esc(c?.subject||'')+' '+esc(c?.name||'')+'</span><h2>Klassenarbeit mit ChatGPT entwerfen</h2></div><button class="icon-button" data-action="modal-close">×</button></header>'+
 '<div class="modal-body"><p class="v269-lead"><strong>'+esc(a.title||'Klassenarbeit')+'</strong> · '+esc(fmtDate(a.date))+
 '. Wähle die prüfungsrelevanten Themen. Bei geplanten Stunden entscheidet deine Auswahl ausdrücklich darüber, ob sie bereits in die frühe Arbeitsfassung gehören.</p>'+
 '<div class="v269-grid"><label>Arbeitszeit (optional)<input data-v269-duration placeholder="z. B. 45 Minuten" maxlength="45" value="'+esc(flow.duration)+'"></label>'+
 '<label>Prüfungsformat<select data-v269-format>'+
 [['papier','Papierarbeit'],['classtime','Classtime'],['kombiniert','Kombiniert'],['offen','Noch offen']].map(([k,t])=>'<option value="'+k+'" '+(flow.format===k?'selected':'')+'>'+t+'</option>').join('')+
 '</select></label></div>'+
 '<label class="v269-notes">Weitere Vorgaben (optional)<textarea data-v269-instructions rows="3" maxlength="1500" placeholder="z. B. Schwerpunkt, Anforderungsbereiche, gewünschte Aufgabenarten …">'+esc(flow.instructions)+'</textarea></label>'+
 '<section class="detail-section v269-content"><h3>Unterricht und Themen auswählen</h3>'+
 '<p>Gehalten = im Cockpit als gehalten erfasst. Vergangene Soll-Stunden ohne Bestätigung sind bewusst als ungeprüft markiert. Inhalte nach dem Prüfungstermin erscheinen nicht.</p>'+
 grouped.map(g=>'<details open><summary>'+g.title+' ('+g.list.length+')</summary>'+
 (g.list.map(line).join('')||'<p class="muted">Keine passenden Einträge.</p>')+'</details>').join('')+
 '<p class="v269-count">'+chosen.length+' Themen gewählt · '+upcoming.length+' davon noch geplant. Diese werden im Prompt ausdrücklich als künftig bezeichnet.</p></section>'+
 '<section class="detail-section v269-sources"><h3>Materialien und Kolleg*innenarbeiten</h3>'+
 '<p>Im Materialhub kannst du weitere Arbeiten hochladen und als <strong>„Klassenarbeit von Kolleg*innen“</strong> einordnen. Hier lassen sich bereits gespeicherte Dateien auswählen oder als Kolleg*innenvorlage markieren. Nur angekreuzte Originaldateien kommen ins ZIP.</p>'+
 '<details '+(files.length<25?'open':'')+'><summary>Verfügbare Quellen auswählen ('+files.length+')</summary>'+
 (files.map(fileRow).join('')||'<p class="muted">Noch keine passenden Materialien vorhanden. Du kannst sie über die Materialbibliothek hochladen.</p>')+'</details>'+
 '</section><section class="detail-section v269-footer"><p><strong>Datenschutz:</strong> Das ZIP wird nur lokal erzeugt. Prüfe Dateien vor dem Hochladen auf personenbezogene Schülerdaten oder nicht zur Weitergabe freigegebene Inhalte. Schulcockpit exportiert keine Klassenlisten, Ergebnisse oder Bewertungen.</p>'+
 '<p class="microcopy">Die Entscheidung, ob noch geplante Stunden tatsächlich prüfungsrelevant sind, bleibt bei dir. Das Paket ist eine Planungsgrundlage, keine automatische Bestätigung des Unterrichtsverlaufs.</p>'+
 '<div class="v269-actions"><button class="secondary" data-v269-save>Auswahl speichern</button>'+
 '<button class="primary" data-v269-export>ChatGPT-Paket als ZIP herunterladen</button></div>'+
 '<p role="status" id="v269-status" aria-live="polite"></p></section></div></section></div>';
}
function readInputs(){
 flow.duration=document.querySelector('[data-v269-duration]')?.value||flow.duration;
 flow.format=document.querySelector('[data-v269-format]')?.value||flow.format;
 flow.instructions=document.querySelector('[data-v269-instructions]')?.value||flow.instructions;
}
async function save(){
 readInputs();const a=options()?.a;if(!a)throw Error('Prüfung nicht mehr vorhanden.');
 const old=a.examBriefV269;
 a.examBriefV269={version:1,unitKeys:[...flow.unitKeys],fileKeys:[...flow.fileKeys],
  duration:flow.duration.slice(0,45),format:flow.format,instructions:flow.instructions.slice(0,1500),
  updatedAt:new Date().toISOString()};
 try{await saveState();}catch(e){a.examBriefV269=old;throw e;}
}
async function markFile(key){
 const f=options()?.files.find(x=>x.key===key);if(!f?.ref)return;
 const x=f.ref.type==='c'?(state.materialCatalog||[]).find(x=>x.catalogId===f.ref.id):
  (state.materials||[]).find(x=>x.id===f.ref.id);
 if(!x)return;
 const old=x.hubV237?structuredClone(x.hubV237):null;
 x.hubV237={...(x.hubV237||{}),isColleagueReferenceV269:!f.colleague};
 if(x.hubV237.kind==='kollegenarbeit'&&!x.hubV237.isColleagueReferenceV269)x.hubV237.kind='referenzarbeit';
 try{
  if(f.ref.type==='c'&&typeof persistCatalogV171==='function')await persistCatalogV171();
  await saveState();render();
 }catch(e){if(old)x.hubV237=old;else delete x.hubV237;throw e;}
}
async function readSource(f){
 if(f.ref?.type==='c'){
  const e=(state.materialCatalog||[]).find(e=>e.catalogId===f.ref.id);
  return e?catalogEntryFileV17(e):null;
 }
 const rec=await fileStoreGet(f.fileKey);
 if(!rec)return null;
 const b=rec.blob||rec;
 return new File([b],rec.name||f.name,{type:rec.type||b.type||''});
}
async function download(){
 const data=options();if(!data)throw Error('Prüfung nicht mehr verfügbar.');
 const {a,units,files}=data,chosen=units.filter(x=>flow.unitKeys.has(x.key));
 if(!chosen.length)throw Error('Bitte mindestens eine Stunde auswählen.');
 const selected=files.filter(f=>flow.fileKeys.has(f.key));
 if(selected.length>MAX_FILES)throw Error('Bitte höchstens '+MAX_FILES+' Dateien wählen.');
 const prompt=core.makePrompt({exam:a,course:cls(a.classId),selected,
   files:selected,rules:{duration:flow.duration,format:flow.format,instructions:flow.instructions}});
 const zip=new JSZip(),folder=zip.folder('Materialien'),names=new Set();
 const included=[];let bytes=0;
 for(const [i,f] of selected.entries()){
  const original=await readSource(f);
  if(!original)throw Error('Ausgewähltes Original nicht gefunden: '+f.name+'. Bitte die Datei im Materialhub erneut verknüpfen oder abwählen.');
  bytes+=original.size||0;if(bytes>MAX_BYTES)throw Error('Mehr als 180 MB Material gewählt. Bitte Auswahl reduzieren.');
  let name=String(i+1).padStart(2,'0')+'_'+safe(original.name||f.name);let suffix=1;
  while(names.has(name))name=String(i+1).padStart(2,'0')+'_'+suffix+++'_'+safe(original.name||f.name);
  names.add(name);folder.file(name,original);
  included.push({name,original:f.name,colleague:!!f.colleague,category:f.kind,sourceKey:f.key});
 }
 // No private student records are read; only lesson outlines and selected teacher files.
 const text=prompt+'\nDie beigefügten Dateien findest du im Ordner Materialien.\n';
 zip.file('00_PROMPT_Klassenarbeit_erstellen.txt',text);
 zip.file('01_STOFFUEBERSICHT.json',JSON.stringify({schema:'schulcockpit.exam-prep.v1',
   exam:{title:a.title,date:a.date,scope:a.scope,subject:cls(a.classId)?.subject,course:cls(a.classId)?.name},
   topics:chosen,selectedFiles:included,rules:{duration:flow.duration,format:flow.format,instructions:flow.instructions}},null,2));
 zip.file('02_HINWEISE.txt','Bitte zuerst Prompt und ggf. die Materialdateien bei ChatGPT hochladen. Dateien nicht ungeprüft versenden.\nKeine Schülernamen oder Bewertungen wurden aus dem privaten Speicher gelesen.\nMaterialdateien können jedoch ihrerseits personenbezogene oder urheberrechtlich geschützte Inhalte enthalten.\nDie in der Übersicht als vergangen, aber nicht bestätigt gekennzeichneten Soll-Stunden bitte vor Nutzung prüfen.\n');
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});
 downloadBlob('Schulcockpit_Klassenarbeit_entwerfen_'+safe(cls(a.classId)?.name||'Kurs')+'_'+a.date+'.zip',blob);
 return {topics:chosen.length,files:selected.length};
}
async function action(kind){
 if(busy)return;busy=true;
 const status=document.getElementById('v269-status'),buttons=[...document.querySelectorAll('[data-v269-save],[data-v269-export]')];
 buttons.forEach(b=>b.disabled=true);
 try{
  await save();
  if(kind==='export'){
   if(status)status.textContent='Paket wird lokal zusammengestellt …';
   const result=await download();
   if(status)status.textContent='Paket erstellt: '+result.topics+' Themen, '+result.files+' Originaldateien.';
  }else{
   if(status)status.textContent='Auswahl wurde gespeichert.';
  }
 }catch(e){if(status)status.textContent='Fehler: '+(e.message||e);else alert(e.message||e);}
 finally{busy=false;buttons.forEach(b=>b.disabled=false);}
}
const previousPanel=v190AssessmentPanelYear;
v190AssessmentPanelYear=function(y){
 const h=previousPanel(y);
 return h.replace(/(<button class="secondary" data-v188-assessment-edit="([^"]+)">Bearbeiten<\/button>)/g,
  (full,button,id)=>'<button class="primary" data-v269-open="'+esc(id)+'">Klassenarbeit erstellen</button>'+button);
};
const previousPanelAll=v188AssessmentPanel;
v188AssessmentPanel=function(){
 return previousPanelAll().replace(/(<button class="secondary" data-v188-assessment-edit="([^"]+)">Bearbeiten<\/button>)/g,
  (full,button,id)=>'<button class="primary" data-v269-open="'+esc(id)+'">Klassenarbeit erstellen</button>'+button);
};
const previousModal=modalHtml;
modalHtml=function(){return modal?.type==='examBriefV269'?modalPage():previousModal();};
const previousWire=wire;
wire=function(){
 previousWire();
 document.querySelectorAll('[data-v269-open]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.v269Open)));
 if(modal?.type!=='examBriefV269')return;
 document.querySelectorAll('[data-v269-unit]').forEach(el=>el.addEventListener('change',()=>{
  el.checked?flow.unitKeys.add(el.dataset.v269Unit):flow.unitKeys.delete(el.dataset.v269Unit);
  document.querySelector('.v269-count').textContent=flow.unitKeys.size+' Themen gewählt. Änderungen speichern oder exportieren.';
 }));
 document.querySelectorAll('[data-v269-file]').forEach(el=>el.addEventListener('change',()=>{
  el.checked?flow.fileKeys.add(el.dataset.v269File):flow.fileKeys.delete(el.dataset.v269File);
 }));
 document.querySelectorAll('[data-v269-mark]').forEach(b=>b.addEventListener('click',()=>void markFile(b.dataset.v269Mark).catch(e=>alert(e.message||e))));
 document.querySelector('[data-v269-save]')?.addEventListener('click',()=>void action('save'));
 document.querySelector('[data-v269-export]')?.addEventListener('click',()=>void action('export'));
};
const previousSave=v188SaveAssessment;
v188SaveAssessment=async function(){
 const id=v188AssessmentDraft?.id,old=(state.assessments||[]).find(a=>a.id===id)?.examBriefV269;
 const result=await previousSave();
 if(result&&old){
  const saved=(state.assessments||[]).find(a=>a.id===id);
  if(saved&&!saved.examBriefV269){saved.examBriefV269=old;await saveState();}
 }
 return result;
};
window.SchulcockpitExamBriefV269={open,context,sources,download};
})();
