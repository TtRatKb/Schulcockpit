/* V0.33.27 – direct file upload and simpler class-related keepsake reminders.
 * Separate optional view; existing Material-Hub files and lesson plans stay untouched.
 */
(function(){
'use strict';
const C=window.SchulcockpitPhysicalArchiveV3323Core;
const Search=window.SchulcockpitPhysicalArchiveSearchV3324;
const Preview=window.SchulcockpitPhysicalArchivePreviewV3326Core;
const Extra=window.SchulcockpitPhysicalArchiveExtrasV3327Core;
if(!C||!Search||!Preview||!Extra)throw Error('Physisches Archiv: Such-, Vorschau- oder Erinnerungsmodul fehlt.');
const escText=v=>esc(String(v??''));
let opened=false,filter='active',query='',editing='',draft=newDraft();
const PICKER_STEP=40;
let picker={search:'',subject:'',grade:'',topic:'',limit:PICKER_STEP};
let previewDialog=null,previewToken=0;
let uploadBusy=false,uploadMessage='';
function resetPicker(){picker={search:'',subject:'',grade:'',topic:'',limit:PICKER_STEP};}
function newDraft(){
 return {type:'copies',title:'',refKey:'',locationId:'fach-01',detail:'',quantity:1,
  reminderDate:'',reminderLabel:'',cohort:'',classIdV3327:'',startingGradeV3327:'',reminderModeV3327:'none',note:'',archived:false};
}
function doc(){return C.ensure(state.physicalArchiveV3323);}
function safeRef(ref){return String(ref||'');}
function refTitle(ref){
 if(ref.startsWith('m:')){
  const last=ref.lastIndexOf(':'),m=state.materials?.find(x=>x.id===ref.slice(2,last));
  const v=m?.variants?.find(x=>x.id===ref.slice(last+1));
  return m?(m.title+(v?' · '+(v.fileName||v.label||'Fassung'):' · Datei nicht gefunden')):'Material nicht mehr vorhanden';
 }
 if(ref.startsWith('c:')){
  const e=state.materialCatalog?.find(x=>x.catalogId===ref.slice(2));
  return e?.fileName||'Katalogeintrag nicht mehr vorhanden';
 }
 return '';
}
function indexedFiles(){
 return Search.build(state.materials||[],state.materialCatalog||[],
   state.classes||[],state.sequences||[]);
}
function pickerResults(rows){
 const active=!!(picker.search.trim()||picker.subject||picker.grade||picker.topic);
 if(!active)return '<p class="microcopy">Suche nach Dateiname oder Stichwort oder wähle ein Fach, einen Jahrgang oder ein Thema. '+
  rows.length+' Dateien und Fassungen sind insgesamt durchsuchbar – ohne feste Obergrenze.</p>';
 const hits=Search.filter(rows,picker),visible=hits.slice(0,picker.limit);
 return '<div class="v3324-results-heading"><strong>'+hits.length+' Treffer</strong>'+
  '<span>'+visible.length+' angezeigt</span></div>'+
  (hits.length?'<div class="v3324-file-list" role="list">'+visible.map(x=>
   '<div class="v3324-file" role="listitem"><div class="v3324-file-info">'+
   '<strong>'+escText(x.title)+'</strong>'+
   (x.filename!==x.title?'<small>'+escText(x.filename)+'</small>':'')+
   '<small>'+escText(x.kind+(x.label?' · '+x.label:''))+'</small>'+
   (x.path?'<small class="v3324-file-path" title="'+escText(x.path)+'">'+escText(x.path)+'</small>':'')+
   '</div><div class="v3326-file-actions"><button type="button" class="secondary" data-v3326-preview="'+escText(x.id)+'">Vorschau</button>'+
   '<button type="button" class="'+(draft.refKey===x.id?'primary':'secondary')+
   '" aria-pressed="'+(draft.refKey===x.id?'true':'false')+
   '" data-v3324-pick="'+escText(x.id)+'">'+
   (draft.refKey===x.id?'Ausgewählt ✓':'Verknüpfen')+'</button></div></div>').join('')+'</div>':
   '<p class="muted">Keine passenden Dateien. Probiere einen anderen Suchbegriff oder setze einen Filter zurück.</p>')+
  (visible.length<hits.length?'<button type="button" class="secondary v3324-more" data-v3324-more>Weitere '+Math.min(PICKER_STEP,hits.length-visible.length)+' anzeigen</button>':'');
}
function pickerHtml(){
 const rows=indexedFiles(),facets=Search.facets(rows,picker);
 const selected=rows.find(x=>x.id===draft.refKey),linked=draft.refKey?
  (selected?selected.title+(selected.filename!==selected.title?' · '+selected.filename:''):
   (refTitle(draft.refKey)||'Verknüpfung derzeit nicht im Material-Hub gefunden')):'';
 const options=(vals,active)=>vals.map(([id,label])=>'<option value="'+escText(id)+'"'+
  (String(active)===String(id)?' selected':'')+'>'+escText(label)+'</option>').join('');
 return '<div class="v3324-picker" id="v3324-picker">'+
  '<div class="v3324-picker-header"><strong>Digitales Material verknüpfen (optional)</strong>'+
  '<small>Suche im gesamten Material-Hub – auch in importierten Archivdateien.</small></div>'+
  '<div class="v3324-current" role="status"><div><small>Aktuelle Verknüpfung</small>'+
  '<strong>'+escText(linked||'Kein digitales Material ausgewählt')+'</strong></div>'+
  (draft.refKey?'<div class="v3326-file-actions"><button type="button" class="secondary" data-v3326-preview="'+escText(draft.refKey)+'">Vorschau</button>'+
  '<button type="button" class="text-button" data-v3324-unlink>Verknüpfung lösen</button></div>':'')+'</div>'+
  '<div class="v3327-upload"><div><strong>Datei noch nicht im Schulcockpit?</strong>'+
  '<small>Direkt hier eine eigene PDF-, Word-, PowerPoint-, Bild- oder andere Unterrichtsdatei hinzufügen. Sie erscheint danach im Material-Hub und bleibt lokal auf diesem Gerät.</small></div>'+
  '<label class="v3327-file-chooser">Neue Datei hinzufügen<input type="file" id="v3327-new-file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif,.bmp,.txt,.md,.csv,.odt,.ods,.odp"></label>'+
  (draft.refKey?'<details class="v3327-attach"><summary>Fehlendes Original zum ausgewählten Eintrag ergänzen</summary>'+
   '<p class="microcopy">Nur wählen, wenn diese Datei wirklich zum ausgewählten Katalogeintrag oder zur Materialfassung gehört. Vorhandene Dateien werden nicht überschrieben.</p>'+
   '<label>Datei als Original hinterlegen<input type="file" id="v3327-attach-file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif,.bmp,.txt,.md,.csv,.odt,.ods,.odp"></label>'+
   '</details>':'')+
  (uploadMessage?'<p class="v3327-upload-message" role="status">'+escText(uploadMessage)+'</p>':'')+'</div>'+
  '<div class="v3324-search-grid">'+
  '<label class="v3324-search-wide">Datei suchen<input type="search" id="v3324-file-query" '+
  'placeholder="z. B. Brüche, Arbeitsblatt, Dateiname …" autocomplete="off" value="'+escText(picker.search)+'"></label>'+
  '<label>Fach<select id="v3324-subject">'+options([['','Alle Fächer'],...facets.subjects.map(x=>[x,x])],picker.subject)+'</select></label>'+
  '<label>Klasse / Jahrgang<select id="v3324-grade">'+options([['','Alle Jahrgänge'],...facets.grades.map(x=>[x,'Jahrgang '+x])],picker.grade)+'</select></label>'+
  '<label>Thema<select id="v3324-topic">'+options([['','Alle Themen'],...facets.topics.map(x=>[x,x])],picker.topic)+'</select></label>'+
  '</div><div class="v3324-filter-bar"><small>Fach, Jahrgang und Thema werden aus den vorhandenen Materialzuordnungen und Ordnerinformationen übernommen. Unzugeordnete Dateien bleiben über die Suche auffindbar.</small>'+
  '<button type="button" class="text-button" data-v3324-clear>Filter zurücksetzen</button></div>'+
  '<div id="v3324-results" aria-live="polite">'+pickerResults(rows)+'</div>'+
  '<input type="hidden" data-v3323-field="refKey" value="'+escText(draft.refKey)+'">'+
  '</div>';
}
function refreshPicker(){
 const box=document.getElementById('v3324-picker');
 if(!box)return;
 box.outerHTML=pickerHtml();
 wirePicker();
}

// Only read a file that is actually on this device. The catalog index alone
// contains metadata, not binary content. No file is uploaded or modified.
async function previewFile(ref){
 if(ref.startsWith('c:')){
  const entry=(state.materialCatalog||[]).find(x=>x.catalogId===ref.slice(2));
  return entry?await catalogEntryFileV17(entry):null;
 }
 if(ref.startsWith('m:')){
  const idx=ref.lastIndexOf(':'),mid=ref.slice(2,idx),vid=ref.slice(idx+1);
  const material=(state.materials||[]).find(m=>m.id===mid);
  const v=material?.variants?.find(v=>v.id===vid);
  if(!v?.fileKey)return null;
  const record=await fileStoreGet(v.fileKey);
  if(!record)return null;
  const b=record.blob||record;
  return new File([b],record.name||v.fileName||material.title||'Material',
    {type:record.type||b.type||''});
 }
 return null;
}
function closePreview(){
 ++previewToken;
 const prior=previewDialog;
 previewDialog=null;
 if(!prior)return;
 if(prior.objectUrl)URL.revokeObjectURL(prior.objectUrl);
 prior.overlay.remove();
 document.removeEventListener('keydown',prior.onKey);
 if(prior.trigger?.isConnected)prior.trigger.focus();
}
function previewStatus(message){
 const element=previewDialog?.overlay?.querySelector('[data-v3326-status]');
 if(element)element.textContent=message;
}
function previewMessage(text){
 const root=previewDialog?.overlay?.querySelector('[data-v3326-content]');
 if(!root)return;
 root.replaceChildren();
 const p=document.createElement('p');p.className='v3326-message';p.textContent=text;root.append(p);
}
function previewText(text,message=''){
 const root=previewDialog?.overlay?.querySelector('[data-v3326-content]');
 if(!root)return;
 root.replaceChildren();
 if(message){const p=document.createElement('p');p.className='microcopy';p.textContent=message;root.append(p);}
 const pre=document.createElement('pre');
 pre.className='v3326-text';
 const capped=Preview.limitText(text,26000);
 pre.textContent=capped.text+(capped.truncated?'\n\n[… weitere Inhalte nur in der Originaldatei …]':'');
 root.append(pre);
}
async function officeText(file,kind){
 if(typeof JSZip==='undefined')throw Error('Die ZIP-Unterstützung für Office-Dokumente ist nicht verfügbar.');
 if(file.size>32*1024*1024)throw Error('Diese Office-Datei ist für die schnelle Textvorschau zu groß. Bitte das Original öffnen.');
 const zip=await JSZip.loadAsync(file);
 const unzipSmall=async entry=>{
  if(!entry)return '';
  if(Number(entry._data?.uncompressedSize)>3*1024*1024)
    throw Error('Die Textdaten dieser Datei sind zu groß für eine sichere Vorschau.');
  return entry.async('string');
 };
 if(kind==='docx'){
  const xml=await unzipSmall(zip.file('word/document.xml'));
  if(!xml)return '';
  return Preview.xmlPlainText(xml,'docx');
 }
 const names=Preview.slideNames(Object.keys(zip.files)).slice(0,15);
 const result=[];
 for(const name of names){
  const xml=await unzipSmall(zip.file(name));
  const body=Preview.xmlPlainText(xml,'pptx');
  if(body)result.push('Folie '+(name.match(/slide(\d+)\.xml$/)?.[1]||'')+'\n'+body);
 }
 return result.join('\n\n');
}
async function paintPreview(file,fromComparison=false){
 const dialog=previewDialog;
 if(!dialog)return;
 if(dialog.objectUrl){URL.revokeObjectURL(dialog.objectUrl);dialog.objectUrl=null;}
 dialog.file=file;
 const content=dialog.overlay.querySelector('[data-v3326-content]');
 if(!content)return;
 content.replaceChildren();
 const kind=Preview.kind(file.name);
 const download=dialog.overlay.querySelector('[data-v3326-download]');
 download.hidden=false;
 download.textContent=fromComparison?'Vergleichsdatei herunterladen':'Original herunterladen';
 previewStatus((fromComparison?'Nur zum Vergleichen ausgewählte Datei (nicht gespeichert) · ':'Lokal gespeichertes Original · ')+
  file.name);
 if(kind==='pdf'||kind==='image'){
  const mime=kind==='pdf'?'application/pdf':
    (file.name.toLowerCase().endsWith('.jpg')||file.name.toLowerCase().endsWith('.jpeg')?'image/jpeg':
      file.name.toLowerCase().endsWith('.png')?'image/png':
      file.name.toLowerCase().endsWith('.webp')?'image/webp':
      file.name.toLowerCase().endsWith('.gif')?'image/gif':'image/bmp');
  const blob=file.type===mime?file:new Blob([file],{type:mime});
  dialog.objectUrl=URL.createObjectURL(blob);
  const media=document.createElement(kind==='pdf'?'iframe':'img');
  media.className=kind==='pdf'?'v3326-pdf':'v3326-image';
  if(kind==='pdf'){media.title='PDF-Vorschau: '+file.name;media.setAttribute('referrerpolicy','no-referrer');}
  else media.alt='Bildvorschau: '+file.name;
  media.src=dialog.objectUrl;
  content.append(media);
  if(kind==='pdf'){
   const note=document.createElement('p');note.className='microcopy';
   note.textContent='Falls dein Browser keine eingebetteten PDFs anzeigt, kannst du das Original unten herunterladen.';
   content.append(note);
  }
  return;
 }
 if(kind==='text'){
  if(file.size>4*1024*1024)throw Error('Die Textdatei ist für die Schnellvorschau zu groß.');
  const text=await file.text();
  if(previewDialog!==dialog)return;
  previewText(text,'Textansicht der lokal gespeicherten Datei.');
  return;
 }
 if(kind==='docx'||kind==='pptx'){
  const words=await officeText(file,kind);
  if(previewDialog!==dialog)return;
  previewText(words||'In dieser Datei wurde kein direkt auslesbarer Text gefunden.',
    'Textvorschau – Formatierung, Tabellen, Bilder und Grafiken werden nicht originalgetreu dargestellt. Bei Bedarf das Original öffnen.');
  return;
 }
 previewMessage('Für dieses Dateiformat gibt es noch keine integrierte Vorschau. Das Original kannst du unten herunterladen und in der passenden Anwendung öffnen.');
}
async function showPreview(ref,trigger){
 const row=indexedFiles().find(x=>x.id===ref);
 if(!row)return;
 closePreview();
 const token=previewToken;
 const overlay=document.createElement('div');
 overlay.className='v3326-overlay';
 overlay.innerHTML='<section class="v3326-dialog" role="dialog" aria-modal="true" aria-labelledby="v3326-preview-title">'+
  '<header class="v3326-head"><div><span class="eyebrow">MATERIALVORSCHAU · NUR AUF DIESEM GERÄT</span>'+
  '<h2 id="v3326-preview-title">'+escText(row.filename||row.title)+'</h2>'+
  '<small>'+escText(row.label||row.path||row.kind)+'</small></div>'+
  '<button type="button" class="icon-button" aria-label="Vorschau schließen" data-v3326-close>×</button></header>'+
  '<div class="v3326-body"><p data-v3326-status class="microcopy" role="status">Datei wird lokal gesucht …</p>'+
  '<div data-v3326-content class="v3326-content"><p>Datei wird geladen …</p></div>'+
  '<div class="v3326-compare"><label>Optional: eine eigene Datei nur zum Vergleichen ansehen (ohne Upload oder Speicherung)'+
  '<input type="file" data-v3326-comparison accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp,.txt,.md,.csv,.json,.docx,.pptx,.doc,.ppt,.xls,.xlsx"></label></div></div>'+
  '<footer class="v3326-footer"><button type="button" class="secondary" data-v3326-download hidden>Original herunterladen</button>'+
  '<button type="button" class="primary" data-v3326-select>Katalogeintrag verknüpfen</button>'+
  '<button type="button" class="secondary" data-v3326-close>Schließen</button></footer></section>';
 const onKey=e=>{if(e.key==='Escape'){e.preventDefault();closePreview();}};
 document.addEventListener('keydown',onKey);
 document.body.append(overlay);
 previewDialog={overlay,trigger,onKey,objectUrl:null,file:null,ref};
 overlay.querySelector('[data-v3326-close]')?.focus();
 overlay.querySelectorAll('[data-v3326-close]').forEach(el=>el.addEventListener('click',closePreview));
 overlay.addEventListener('click',e=>{if(e.target===overlay)closePreview();});
 overlay.querySelector('[data-v3326-select]').addEventListener('click',()=>{
  draft.refKey=ref;
  if(!draft.title){
   draft.title=row.filename||row.title;
   const title=document.querySelector('[data-v3323-field="title"]');
   if(title)title.value=draft.title;
  }
  closePreview();
  refreshPicker();
 });
 overlay.querySelector('[data-v3326-download]').addEventListener('click',()=>{
  if(previewDialog?.file)downloadBlob(previewDialog.file.name,previewDialog.file);
 });
 overlay.querySelector('[data-v3326-comparison]').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  const current=previewDialog;
  if(!current||current.overlay!==overlay)return;
  try{await paintPreview(file,true);}
  catch(err){if(previewDialog?.overlay===overlay)previewMessage(err.message||String(err));}
 });
 try{
  const file=await previewFile(ref);
  if(token!==previewToken||previewDialog?.overlay!==overlay)return;
  if(!file){
   previewStatus('Originaldatei in diesem Browser nicht verfügbar');
   previewMessage('Dieser Eintrag enthält bisher nur Dateiname und Zuordnung. Verbinde im Material-Hub das Original-ZIP oder die Quelldatei. Alternativ kannst du unten eine Datei nur zum Vergleichen öffnen. Dabei wird keine Datei automatisch zugeordnet oder gespeichert.');
   return;
  }
  try{await paintPreview(file);}
  catch(err){if(token===previewToken&&previewDialog?.overlay===overlay)
    previewMessage('Vorschau nicht möglich: '+(err.message||String(err))+' Du kannst das Original herunterladen.');}
 }catch(err){
  if(token===previewToken&&previewDialog?.overlay===overlay){
   previewStatus('Datei konnte nicht geöffnet werden.');
   previewMessage('Die lokale Datei konnte nicht gelesen werden: '+(err.message||String(err)));
  }
 }
}


async function uploadFile(file,attach=false){
 Extra.validFile(file);
 if(uploadBusy)throw Error('Eine Datei wird bereits gespeichert.');
 uploadBusy=true;
 const priorMaterials=state.materials,priorCatalog=state.materialCatalog;
 let key='',committed=false;
 try{
  if(attach){
   if(!draft.refKey)throw Error('Bitte zuerst einen bestehenden Materialeintrag auswählen.');
   if(draft.refKey.startsWith('m:')){
    const index=draft.refKey.lastIndexOf(':'),
     mid=draft.refKey.slice(2,index),vid=draft.refKey.slice(index+1),
     mat=(state.materials||[]).find(x=>x.id===mid),
     variant=mat?.variants?.find(x=>x.id===vid);
    if(!variant)throw Error('Die ausgewählte Materialfassung wurde nicht gefunden.');
    key=variant.fileKey||('material-'+mid+'-'+vid);
    if(await fileStoreGet(key))throw Error('Für diese Fassung gibt es bereits eine Originaldatei. Sie wurde nicht überschrieben.');
    await fileStorePut(key,file);
    // Do not modify the existing material in place until the file is actually stored.
    state.materials=structuredClone(state.materials);
    const target=state.materials.find(x=>x.id===mid).variants.find(x=>x.id===vid);
    target.fileKey=key;target.fileName=file.name;target.available=true;
   }else if(draft.refKey.startsWith('c:')){
    const id=draft.refKey.slice(2),cat=(state.materialCatalog||[]).find(x=>x.catalogId===id);
    if(!cat)throw Error('Der ausgewählte Katalogeintrag ist nicht mehr vorhanden.');
    key=cat.localFileKey||('catalog-file-'+id);
    if(await fileStoreGet(key))throw Error('Für diesen Katalogeintrag ist bereits eine Originaldatei gespeichert. Sie wurde nicht überschrieben.');
    if(file.name.toLowerCase()!==String(cat.fileName||'').toLowerCase()&&
      !confirm('Die Datei „'+file.name+'“ hat einen anderen Namen als der Eintrag „'+cat.fileName+'“. Gehören beide wirklich zusammen?'))
      return false;
    await fileStorePut(key,file);
    state.materialCatalog=structuredClone(state.materialCatalog);
    state.materialCatalog.find(x=>x.catalogId===id).localFileKey=key;
   }else throw Error('Diese Materialart kann keine Originaldatei erhalten.');
  }else{
   const mid=uid('mat'),vid=uid('var');key='material-'+mid+'-'+vid;
   await fileStorePut(key,file);
   state.materials=[...(state.materials||[]),{
    id:mid,title:file.name.replace(/\.[^.]+$/,'')||file.name,
    kind:'file',resourceType:'print',source:'Physisches Archiv',
    variants:[{id:vid,type:'standard',label:'Standard',available:true,
     fileName:file.name,fileKey:key}],
    assignments:[],improvementFlags:[],pages:'',tasks:''
   }];
   draft.refKey='m:'+mid+':'+vid;
   if(!draft.title){
    draft.title=file.name.replace(/\.[^.]+$/,'')||file.name;
    const field=document.querySelector('[data-v3323-field="title"]');
    if(field)field.value=draft.title;
   }
  }
  // File and metadata are kept separately. Do not call a GitHub upload.
  // The existing saveState function persists the regular material data.
  await saveState();
  if(attach&&draft.refKey.startsWith('c:')&&typeof persistCatalogV171==='function')
   await persistCatalogV171();
  storedFileKeys.add(key);
  committed=true;
  uploadMessage=attach?'Originaldatei wurde sicher ergänzt.':'Neue Materialdatei wurde gespeichert und verknüpft.';
  refreshPicker();
  return true;
 }catch(err){
  if(!committed){
   state.materials=priorMaterials;state.materialCatalog=priorCatalog;
   if(key)try{await fileStoreDelete(key);}catch(cleanup){console.warn('Ungenutzte Archivdatei konnte nicht bereinigt werden',cleanup);}
   if(key)storedFileKeys.delete(key);
   try{saveState();}catch(e){console.warn('Rücksetzung der Metadaten konnte nicht gespeichert werden',e);}
  }
  throw err;
 }finally{uploadBusy=false;}
}
function wireArchiveUploads(){
 for(const [id,attach] of [['v3327-new-file',false],['v3327-attach-file',true]]){
  document.getElementById(id)?.addEventListener('change',async e=>{
   const input=e.currentTarget,file=input.files?.[0];
   if(!file||uploadBusy)return;
   input.disabled=true;
   try{await uploadFile(file,attach);}
   catch(err){uploadMessage='Datei nicht gespeichert: '+(err.message||String(err));refreshPicker();}
   finally{input.disabled=false;input.value='';}
  });
 }
}

function wirePickerResults(){
 document.querySelectorAll('[data-v3326-preview]').forEach(b=>b.addEventListener('click',()=>showPreview(b.dataset.v3326Preview,b)));
 document.querySelectorAll('[data-v3324-pick]').forEach(b=>b.addEventListener('click',()=>{
  const key=b.dataset.v3324Pick,row=indexedFiles().find(x=>x.id===key);
  if(!row)return;
  draft.refKey=key;
  if(!draft.title){
   draft.title=row.filename||row.title;
   const title=document.querySelector('[data-v3323-field="title"]');
   if(title)title.value=draft.title;
  }
  refreshPicker();
 }));
 document.querySelector('[data-v3324-more]')?.addEventListener('click',()=>{
  picker.limit+=PICKER_STEP;
  const box=document.getElementById('v3324-results');
  if(box){box.innerHTML=pickerResults(indexedFiles());wirePickerResults();}
 });
}
function wirePicker(){
 wireArchiveUploads();
 document.querySelector('.v3324-current [data-v3326-preview]')?.addEventListener('click',e=>
  showPreview(e.currentTarget.dataset.v3326Preview,e.currentTarget));
 const input=document.getElementById('v3324-file-query');
 input?.addEventListener('input',()=>{
  picker.search=input.value;picker.limit=PICKER_STEP;
  const box=document.getElementById('v3324-results');
  if(box){box.innerHTML=pickerResults(indexedFiles());wirePickerResults();}
 });
 for(const [id,key] of [['v3324-subject','subject'],['v3324-grade','grade'],['v3324-topic','topic']]){
  document.getElementById(id)?.addEventListener('change',e=>{
   picker[key]=e.target.value;
   if(key==='subject'){picker.grade='';picker.topic='';}
   if(key==='grade')picker.topic='';
   picker.limit=PICKER_STEP;refreshPicker();
  });
 }
 document.querySelector('[data-v3324-clear]')?.addEventListener('click',()=>{
  resetPicker();refreshPicker();
 });
 document.querySelector('[data-v3324-unlink]')?.addEventListener('click',()=>{
  draft.refKey='';refreshPicker();
 });
 wirePickerResults();
}
function locationName(id){
 const l=C.location(doc(),id);
 return l?C.locationLabel(l):'Ort unbekannt';
}
function dateToday(){
 const x=new Date(),p=n=>String(n).padStart(2,'0');
 return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());
}

function memoryClass(){
 const match=(state.classes||[]).find(c=>c.id===draft.classIdV3327);
 if(match)return match;
 const fallback=Number(draft.startingGradeV3327);
 return Number.isInteger(fallback)&&fallback>=5&&fallback<=13?{grade:fallback,name:'Andere Gruppe'}:null;
}
function currentReminderMode(){
 return draft.reminderModeV3327|| (draft.reminderDate?'custom':'none');
}
function memoryFields(){
 const cl=memoryClass(),mode=currentReminderMode();
 const suggestion=Extra.reminder(mode,cl,state.settings?.schoolYear,dateToday());
 const selectedDate=mode==='none'?'':(draft.reminderDate||suggestion.date||'');
 const courses=(state.classes||[]).map(c=>
  '<option value="'+escText(c.id)+'"'+(draft.classIdV3327===c.id?' selected':'')+'>'+
  escText((c.name||'Klasse')+' · '+(c.subject||'Fach unbekannt'))+'</option>').join('');
 const modes=[
  ['none','Noch nicht erinnern'],
  ['end10','Vor Ende von Jahrgang 10'],
  ['end13','Vor Ende von Jahrgang 13'],
  ['endSchoolYear','Vor den nächsten Sommerferien'],
  ['year','In einem Jahr'],
  ['custom','Datum selbst auswählen']
 ];
 const years=Array.from({length:9},(_,i)=>i+5);
 return '<div class="v3327-memory v3323-wide" id="v3327-memory">'+
  '<div class="v3327-memory-heading"><strong>Für welche Klasse und wann?</strong>'+
  '<small>Du brauchst nur Klasse und Erinnerungszeitpunkt auszuwählen. Ein vorgeschlagenes Datum kannst du ändern.</small></div>'+
  '<div class="v3327-memory-grid">'+
  '<label>Klasse/Kurs<select id="v3327-class">'+
   '<option value="">Andere Gruppe / keine Zuordnung</option>'+courses+
   (draft.classIdV3327&&!(state.classes||[]).some(c=>c.id===draft.classIdV3327)?
    '<option selected value="'+escText(draft.classIdV3327)+'">Frühere Klasse · '+escText(draft.cohort||draft.classIdV3327)+'</option>':'')+
   '</select></label>'+
  '<label>Wann erinnern?<select id="v3327-when">'+
   modes.map(([id,label])=>'<option value="'+id+'"'+(mode===id?' selected':'')+'>'+label+'</option>').join('')+
  '</select></label>'+
  '<label>Erinnerung ab<input type="date" id="v3327-date" value="'+escText(selectedDate)+'"></label>'+
  '</div>'+
  (suggestion.error?'<p class="v3327-memory-warning" role="status">'+escText(suggestion.error)+'</p>':
   mode!=='none'&&mode!=='custom'?'<p class="microcopy">Vorschlag: '+escText(suggestion.date||'')+
   ' · Erinnerung rechtzeitig vor den Sommerferien, nicht der offizielle letzte Schultag.</p>':'')+
  '<details class="v3327-memory-details"><summary>Weitere Angaben / andere Gruppe (optional)</summary>'+
   '<div class="v3327-memory-grid">'+
   '<label>Gruppenbezeichnung<input data-v3323-field="cohort" maxlength="100" value="'+escText(draft.cohort)+'" placeholder="z. B. Tutorenklasse 2026/27"></label>'+
   '<label>Jahrgang bei der Einlagerung<select id="v3327-start-grade"><option value="">Nicht angegeben</option>'+
   years.map(n=>'<option value="'+n+'"'+(String(draft.startingGradeV3327)===String(n)?' selected':'')+'>Jahrgang '+n+'</option>').join('')+
   '</select></label>'+
   '<label class="v3327-full">Anlass / Was soll ich später tun?<input data-v3323-field="reminderLabel" maxlength="120" value="'+escText(draft.reminderLabel)+'" placeholder="z. B. Briefe an die Klasse zurückgeben"></label>'+
   '</div></details></div>';
}
function updateMemoryReminder(){
 const mode=currentReminderMode(),suggestion=Extra.reminder(mode,memoryClass(),state.settings?.schoolYear,dateToday());
 if(mode==='none')draft.reminderDate='';
 else if(mode!=='custom')draft.reminderDate=suggestion.date||'';
 if(!draft.reminderLabel&&suggestion.label&&mode!=='custom'&&mode!=='none')
  draft.reminderLabel=suggestion.label;
 return suggestion;
}
function wireMemoryFields(){
 const dropdown=document.getElementById('v3327-class');
 dropdown?.addEventListener('change',e=>{
  draft.classIdV3327=e.target.value;
  const cl=(state.classes||[]).find(c=>c.id===draft.classIdV3327);
  if(cl){
   draft.cohort=Extra.classLabel(cl,state.settings?.schoolYear||'');
   draft.startingGradeV3327=String(Extra.classGrade(cl)||'');
  }else{
   draft.cohort='';
   draft.startingGradeV3327='';
  }
  updateMemoryReminder();render();
 });
 document.getElementById('v3327-when')?.addEventListener('change',e=>{
  const previous=Extra.reminder(currentReminderMode(),memoryClass(),state.settings?.schoolYear,dateToday());
  if(draft.reminderLabel===previous.label)draft.reminderLabel='';
  draft.reminderModeV3327=e.target.value;
  updateMemoryReminder();render();
 });
 document.getElementById('v3327-date')?.addEventListener('change',e=>{
  draft.reminderDate=e.target.value;
  draft.reminderModeV3327='custom';
  const mode=document.getElementById('v3327-when');
  if(mode)mode.value='custom';
 });
 document.getElementById('v3327-start-grade')?.addEventListener('change',e=>{
  draft.startingGradeV3327=e.target.value;updateMemoryReminder();render();
 });
}

function entryForm(){
 const d=doc(),mem=draft.type==='memory';
 return '<section class="panel v3323-editor" id="v3323-editor"><div class="section-head"><div>'+
 '<span class="eyebrow">'+(editing?'ARCHIVEINTRAG BEARBEITEN':'NEU EINLAGERN')+'</span>'+
 '<h2>'+(editing?'Eintrag bearbeiten':'Was möchtest du aufbewahren?')+'</h2></div>'+
 (editing?'<button type="button" class="text-button" data-v3323-reset>Abbrechen</button>':'')+
 '</div><div class="v3323-form">'+
 '<label>Art<select data-v3323-field="type">'+
 [['copies','Restkopien · verbrauchbar'],['reusable','Mehrwegmaterial · z. B. laminiert'],['memory','Erinnerungsstück · Wiedervorlage']].map(([id,t])=>
 '<option value="'+id+'"'+(draft.type===id?' selected':'')+'>'+t+'</option>').join('')+
 '</select></label>'+
 '<label>Bezeichnung<input data-v3323-field="title" maxlength="180" value="'+escText(draft.title)+'" placeholder="z. B. AB Brüche darstellen"></label>'+
 '<label>Aufbewahrungsort<select data-v3323-field="locationId">'+d.locations.map(l=>
 '<option value="'+escText(l.id)+'"'+(draft.locationId===l.id?' selected':'')+'>'+
 escText(l.kind==='folder'?'Fächerordner · '+C.locationLabel(l):C.locationLabel(l))+'</option>').join('')+
 '</select></label>'+
 '<label>Innerhalb des Fachs / der Box (optional)<input data-v3323-field="detail" maxlength="150" value="'+escText(draft.detail)+'" placeholder="z. B. Mappe Brüche / Umschlag 2"></label>'+
 (mem?'':('<label>'+(draft.type==='copies'?'Noch vorhandene Exemplare':'Noch vorhandene Sets / Stücke')+
 '<input type="number" min="0" max="9999" step="1" data-v3323-field="quantity" value="'+escText(draft.quantity)+'"></label>'))+
 (mem?memoryFields()+
 '<details class="v3327-memory-files v3323-wide"><summary>Digitales Foto oder Dokument hinterlegen (optional)</summary>'+pickerHtml()+'</details>':
 '<div class="v3323-wide">'+pickerHtml()+'</div>')+
 '<label class="v3323-wide">Notiz (optional)<textarea rows="2" maxlength="600" data-v3323-field="note" placeholder="Was sollte ich dazu wissen?">'+escText(draft.note)+'</textarea></label>'+
 '</div><div class="v3323-actions"><button type="button" class="primary" data-v3323-save>'+
 (editing?'Änderungen speichern':'Im Archiv erfassen')+'</button></div>'+
 '<p class="microcopy">Nur eine Bestandsnotiz, keine Schülerdatenbank. Eingetragene Mengen ändern bestehende Kopieraufträge nicht automatisch.</p></section>';
}
function entryCard(e){
 const label=e.type==='copies'?'Restkopien':e.type==='reusable'?'Mehrwegmaterial':'Andenken';
 const count=e.type==='memory'?'Wiedervorlage':e.quantity+' '+(e.type==='copies'?'Exemplare':'Sets/Stück');
 const due=e.type==='memory'&&e.reminderDate&&e.reminderDate<=dateToday()&&!e.archived;
 const loc=locationName(e.locationId)+(e.detail?' · '+e.detail:'');
 return '<article class="v3323-entry'+(e.archived?' is-archived':'')+'" data-v3323-entry="'+escText(e.id)+'">'+
 '<div class="v3323-entry-head"><div><span class="eyebrow">'+label+'</span>'+
 '<h3>'+escText(e.title)+'</h3><small>'+escText(loc)+'</small></div>'+
 '<strong class="v3323-count">'+escText(count)+'</strong></div>'+
 (e.refKey?'<small>Verknüpft: '+escText(refTitle(e.refKey))+'</small>':'')+
 (e.type==='memory'?'<p class="v3323-memory-meta">'+
 (e.cohort?escText(e.cohort)+' · ':'')+
 (due?'<strong>Jetzt daran denken · </strong>':'')+
 (e.reminderDate?'Ab '+escText(e.reminderDate)+' · ':'Kein Erinnerungsdatum · ')+
 escText(e.reminderLabel||e.cohort||'Persönliche Erinnerung')+'</p>':'')+
 (e.note?'<p>'+escText(e.note)+'</p>':'')+
 '<div class="v3323-entry-actions">'+
 (e.type!=='memory'&&!e.archived?'<button type="button" class="secondary" data-v3323-adjust="'+escText(e.id)+'|-1">− 1</button>'+
 '<button type="button" class="secondary" data-v3323-adjust="'+escText(e.id)+'|1">+ 1</button>':'')+
 '<button type="button" class="text-button" data-v3323-edit="'+escText(e.id)+'">Bearbeiten</button>'+
 '<button type="button" class="text-button" data-v3323-toggle="'+escText(e.id)+'">'+(e.archived?'Wieder aktivieren':'Als nicht mehr vorhanden markieren')+'</button>'+
 '</div></article>';
}
function page(){
 const d=doc(),active=d.entries.filter(x=>!x.archived);
 const upcoming=C.due(d,dateToday());
 const listed=d.entries.filter(e=>filter==='archived'?e.archived:filter==='all'||filter==='active'?!e.archived:e.type===filter&&!e.archived);
 const stock=C.total(d,'copies'),reuse=C.total(d,'reusable'),memory=C.total(d,'memory');
 return '<div class="content-grid v3323-page"><section class="hero-card v3323-hero">'+
 '<div><span class="eyebrow">PHYSISCHES ARCHIV</span><h2>Papier, Mehrwegmaterial & Erinnerungen</h2>'+
 '<p>Dein Fächerordner zu Hause wird über A–Z adressiert. Ein Material kann digital mehreren Kursen zugeordnet bleiben, aber physisch an einem Ort liegen.</p></div>'+
 '<button type="button" class="secondary" data-v3323-back>← Material-Hub</button></section>'+
 '<section class="v3323-stats"><div><strong>'+stock+'</strong><span>Restkopien-Einträge</span></div>'+
 '<div><strong>'+reuse+'</strong><span>Mehrwegmaterialien</span></div>'+
 '<div><strong>'+memory+'</strong><span>Andenken</span></div>'+
 '<div><strong>'+upcoming.length+'</strong><span>Wiedervorlagen fällig</span></div></section>'+
 (upcoming.length?'<section class="panel v3323-due"><h3>Wiedervorlage – jetzt anschauen</h3><p>'+
 upcoming.slice(0,8).map(e=>escText(e.title)+' ('+escText(locationName(e.locationId))+')').join(' · ')+
 '</p></section>':'')+
 entryForm()+
 '<section class="panel"><div class="section-head"><div><span class="eyebrow">LAGERORTE</span><h2>Wo ist etwas abgelegt?</h2></div></div>'+
 '<p class="microcopy">A–Z sind die 26 Fächer deines ausziehbaren Ordners. Andere Boxen oder Schulorte kannst du frei ergänzen.</p>'+
 '<div class="v3323-location-form"><input id="v3323-new-location" maxlength="60" placeholder="Weiteren Ort anlegen, z. B. Laminierbox L1">'+
 '<button type="button" class="secondary" data-v3323-add-location>Ort hinzufügen</button></div>'+
 '<details><summary>Alle Aufbewahrungsorte ('+d.locations.length+')</summary>'+
 '<div class="v3323-locations">'+d.locations.map(l=>'<span>'+escText(C.locationLabel(l))+'</span>').join('')+'</div></details></section>'+
 '<section class="panel"><div class="section-head"><div><span class="eyebrow">BESTAND</span>'+
 '<h2>Meine archivierten Gegenstände</h2></div><span class="muted">'+listed.length+' Einträge</span></div>'+
 '<div class="v3323-filters"><label>Anzeigen <select id="v3323-filter">'+
 [['active','Alle aktiven'],['copies','Restkopien'],['reusable','Mehrweg'],['memory','Erinnerungen'],['archived','Nicht mehr vorhanden']].map(([v,t])=>
 '<option value="'+v+'"'+(filter===v?' selected':'')+'>'+t+'</option>').join('')+
 '</select></label><label>Suchen<input type="search" id="v3323-query" value="'+escText(query)+'" placeholder="Material, Fach oder Aufbewahrungsort"></label></div>'+
 '<div class="v3323-entries">'+(listed.map(entryCard).join('')||'<p class="muted">Hier ist noch nichts eingetragen.</p>')+'</div></section>'+
 '</div>';
}
function openArchive(prefill=''){
 closePreview();uploadMessage='';
 opened=true;editing='';draft=newDraft();filter='active';query='';resetPicker();
 if(prefill){
  const key=safeRef(prefill);
  if(key.startsWith('m:')){
   const m=state.materials?.find(x=>x.id===key.slice(2));
   const v=m?.variants?.find(x=>!['solution','teacher'].includes(x.type))||m?.variants?.[0];
   if(m){draft.title=v?.fileName||m.title;draft.refKey=v?'m:'+m.id+':'+v.id:'';}
  }else if(key.startsWith('c:')){
   const c=state.materialCatalog?.find(x=>x.catalogId===key.slice(2));
   if(c){draft.title=c.fileName||'';draft.refKey=key;}
  }
 }
 view='materials';modal=null;render();
}
function reset(){
 editing='';draft=newDraft();resetPicker();uploadMessage='';render();
}
async function store(update){
 const before=state.physicalArchiveV3323?structuredClone(state.physicalArchiveV3323):undefined;
 try{
  const next=before?structuredClone(before):C.initial();
  const result=update(next);
  state.physicalArchiveV3323=next;
  await saveState();render();return result;
 }catch(err){
  if(before)state.physicalArchiveV3323=before;
  else delete state.physicalArchiveV3323;
  render();throw err;
 }
}
async function save(){
 const prev=editing;
 const nextDraft={...draft};
 if(nextDraft.type==='memory'){
  const mode=nextDraft.reminderModeV3327|| (nextDraft.reminderDate?'custom':'none');
  const r=Extra.reminder(mode,memoryClass(),state.settings?.schoolYear,dateToday());
  if(r.error)throw Error(r.error);
  if(mode==='none')nextDraft.reminderDate='';
  else if(mode!=='custom')nextDraft.reminderDate=r.date;
  if(!nextDraft.reminderLabel&&r.label&&mode!=='none')nextDraft.reminderLabel=r.label;
  nextDraft.reminderModeV3327=mode;
 }
 if(prev&&!doc().entries.some(x=>x.id===prev))throw Error('Der bearbeitete Eintrag existiert nicht mehr.');
 const id=prev||uid('phys-archive');
 await store(d=>{
  const value=C.checked({...nextDraft,updatedAt:new Date().toISOString()},d,id);
  const position=d.entries.findIndex(x=>x.id===id);
  if(position<0)d.entries.push(value);
  else d.entries[position]=value;
 });
 editing='';draft=newDraft();render();
}
async function adjust(id,delta){
 await store(d=>{
  const e=d.entries.find(x=>x.id===id);
  e.quantity=C.updateQuantity(d,id,delta);
  e.updatedAt=new Date().toISOString();
 });
}
async function toggle(id){
 const e=doc().entries.find(x=>x.id===id);
 if(!e)return;
 if(!e.archived&&!confirm('„'+e.title+'“ als nicht mehr vorhanden markieren? Der Eintrag bleibt wiederherstellbar.'))return;
 await store(d=>{const entry=d.entries.find(x=>x.id===id);entry.archived=!entry.archived;entry.updatedAt=new Date().toISOString();});
}
async function addLocation(){
 const name=document.getElementById('v3323-new-location')?.value?.trim();
 if(!name||name.length>60)throw Error('Bitte einen Ort mit maximal 60 Zeichen angeben.');
 if(doc().locations.some(l=>C.locationLabel(l).toLowerCase()===name.toLowerCase()))throw Error('Diesen Ort gibt es bereits.');
 const id=uid('phys-location');
 await store(d=>d.locations.push({id,name,kind:'other'}));
 draft.locationId=id;render();
}
function remapRefButton(html){
 return html.replace(/(<button class="secondary" data-v237-edit="([^"]+)">Einordnen<\/button>)/g,
  (_,original,key)=>original+'<button type="button" class="text-button" data-v3323-from-hub="'+key+'">Papierbestand</button>');
}
const oldMaterials=materialsView;
materialsView=function(){
 if(opened)return page();
 let html=oldMaterials();
 // The existing Material-Hub remains unchanged apart from entry points.
 if(!html.includes('class="v237-import-buttons"'))return html;
 html=html.replace('<div class="v237-import-buttons">',
  '<div class="v237-import-buttons"><button type="button" class="secondary" data-v3323-open>📦 Physisches Archiv öffnen</button>');
 return remapRefButton(html);
};
// Show only an in-app reminder when due; never create an automated notification.
const oldFocus=focusView;
focusView=function(){
 const html=oldFocus(),due=C.due(doc(),dateToday());
 if(!due.length)return html;
 const reminder='<section class="panel v3323-focus-due"><span class="eyebrow">PHYSISCHES ARCHIV</span>'+
 '<h2>'+due.length+' Erinnerungsstück'+(due.length===1?' wartet':'e warten')+' auf dich</h2>'+
 '<p>'+escText(due.slice(0,3).map(e=>e.title).join(' · '))+'</p>'+
 '<button type="button" class="secondary" data-v3323-open>Zum Archiv →</button></section>';
 return html.replace(/(<div class="content-grid[^"]*">)/,'$1'+reminder);
};
// Existing quantities stay unchanged until explicitly edited by the teacher.
const oldWizard=wizardPlanStepV14;
wizardPlanStepV14=function(l){
 const html=oldWizard(l);
 if(!l||!html.includes('<div class="v332-copies-body">'))return html;
 const notices=[],seen=new Set();
 const re=/<input type="number"[^>]*\bvalue="(\d+)"[^>]*\bdata-v332-count="([^"]+)"[^>]*>/g;
 for(const m of html.matchAll(re)){
  const [lid,mid,vid]=m[2].split('|');
  if(lid!==l.id||seen.has(mid+'|'+vid))continue;
  seen.add(mid+'|'+vid);
  const count=Number(m[1]),stock=C.available(doc(),mid,vid),p=C.proposal(count,stock);
  if(!p.fromArchive)continue;
  const mat=state.materials?.find(x=>x.id===mid),v=mat?.variants?.find(x=>x.id===vid);
  if(!v||['solution','teacher'].includes(v.type))continue;
  notices.push('<li><strong>'+escText(v.fileName||mat?.title||'Material')+'</strong> · '+
    p.stock+' im Archiv, '+p.required+' benötigt, Vorschlag: '+p.toPrint+' kopieren '+
    '<button type="button" class="text-button" data-v3323-suggest="'+escText(m[2])+'" data-v3323-next="'+p.toPrint+'">Vorschlag einsetzen</button></li>');
 }
 if(!notices.length)return html;
 const tip='<aside class="v3323-print-advice"><strong>📦 Restkopien im physischen Archiv</strong>'+
 '<ul>'+notices.join('')+'</ul>'+
 '<small>„Vorschlag einsetzen“ ändert nur das angezeigte Kopierfeld. Danach „Mengen speichern“ wählen. Den Papierbestand erst reduzieren, wenn du die Exemplare wirklich entnommen hast.</small></aside>';
 return html.replace('<div class="v332-copies-body">','<div class="v332-copies-body">'+tip);
};
function attach(){
 document.querySelectorAll('[data-v3323-open]').forEach(b=>b.addEventListener('click',()=>openArchive()));
 document.querySelectorAll('[data-v3323-from-hub]').forEach(b=>b.addEventListener('click',()=>openArchive(b.dataset.v3323FromHub)));
 document.querySelector('[data-v3323-back]')?.addEventListener('click',()=>{closePreview();opened=false;render();});
 wirePicker();
 wireMemoryFields();
 document.querySelectorAll('[data-v3323-field]').forEach(input=>{
  const changed=()=>{
   const field=input.dataset.v3323Field;
   draft[field]=input.value;
   if(field==='type')render();
  };
  input.addEventListener('input',changed);
  input.addEventListener('change',changed);
 });
 document.querySelector('[data-v3323-save]')?.addEventListener('click',e=>{
  const button=e.currentTarget;button.disabled=true;
  void save().catch(err=>{
   button.disabled=false;
   alert('Archiv nicht gespeichert: '+(err.message||err));
  });
 });
 document.querySelector('[data-v3323-reset]')?.addEventListener('click',reset);
 document.querySelectorAll('[data-v3323-adjust]').forEach(b=>b.addEventListener('click',()=>{
  const raw=b.dataset.v3323Adjust,i=raw.lastIndexOf('|');
  void adjust(raw.slice(0,i),Number(raw.slice(i+1))).catch(err=>alert(err.message||err));
 }));
 document.querySelectorAll('[data-v3323-toggle]').forEach(b=>b.addEventListener('click',()=>{
  void toggle(b.dataset.v3323Toggle).catch(err=>alert(err.message||err));
 }));
 document.querySelectorAll('[data-v3323-edit]').forEach(b=>b.addEventListener('click',()=>{
  const e=doc().entries.find(x=>x.id===b.dataset.v3323Edit);if(!e)return;
  editing=e.id;draft={...e};resetPicker();uploadMessage='';render();
 }));
 document.querySelector('[data-v3323-add-location]')?.addEventListener('click',e=>{
  e.currentTarget.disabled=true;
  void addLocation().catch(err=>alert(err.message||err));
 });
 document.getElementById('v3323-filter')?.addEventListener('change',e=>{filter=e.target.value;render();});
 const search=document.getElementById('v3323-query');
 const apply=()=>{
  query=search.value.toLowerCase();
  document.querySelectorAll('[data-v3323-entry]').forEach(row=>{
   row.hidden=!!query&&!row.textContent.toLowerCase().includes(query);
  });
 };
 if(search){search.addEventListener('input',apply);apply();}
 document.querySelectorAll('[data-v3323-suggest]').forEach(b=>b.addEventListener('click',()=>{
  const original=document.querySelector('[data-v332-count="'+b.dataset.v3323Suggest+'"]');
  if(!original)return;
  original.value=b.dataset.v3323Next;
  b.textContent='Vorschlag im Feld – jetzt Mengen speichern';
  b.disabled=true;
 }));
}
const oldWire=wire;
wire=function(){oldWire();attach();};
const oldRender=render;
render=function(){
 oldRender();
 const brand=document.querySelector('.brand small');
 if(brand)brand.textContent=state.settings.schoolYear+' · V0.33.27';
};
window.SchulcockpitPhysicalArchiveV3323={open:openArchive,available:(mid,vid)=>C.available(doc(),mid,vid),due:()=>C.due(doc(),dateToday())};
render();
})();
