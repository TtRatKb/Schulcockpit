/* V0.27.6 – lesson-local worksheet choices and actual ChatGPT source files.
 * Replaces printing/AI resources for ONE lesson without retiring materials elsewhere.
 * Material and blobs stay local; ZIP is explicitly downloaded by the teacher. */
(function(){
'use strict';
const MAX_FILES=35,MAX_BYTES=160*1024*1024;
let saving=false;
const extOK=/\.(pdf|docx?|png|jpe?g|webp|pptx?|txt|md)$/i;
function parseResource(id){
 const pos=String(id||'').indexOf('|');
 return pos<0?[null,'']:[lesson(id.slice(0,pos)),decodeURIComponent(id.slice(pos+1))];
}
function baseName(s){return String(s||'Datei').replace(/[/\\:*?"<>|\x00-\x1f]/g,'_').slice(0,115);}
function activeFiles(l){
 const result=[],seen=new Set();
 const rows=allResourceRowsV176(l);
 for(const r of rows){
  if(!v183IsActive(l,r.hint))continue;
  const entries=(r.bundleItemsV176?.length?r.bundleItemsV176:
   r.material&&r.variant?[{materialId:r.material.id,variantId:r.variant.id,m:r.material,v:r.variant}]:[]);
  for(const ent of entries){
   const v=ent.v||variant(ent.materialId,ent.variantId);
   const m=ent.m||mat(ent.materialId);
   if(!v?.fileKey||v._v183obsolete||!hasStoredFile(v)||seen.has(v.fileKey))continue;
   seen.add(v.fileKey);
   result.push({key:v.fileKey,name:v.fileName||m?.title||'Datei',hint:r.hint,
     kind:r.type,materialId:ent.materialId,variantId:ent.variantId,
     isImage:/\.(png|jpe?g)$/i.test(v.fileName||'')});
  }
 }
 return result;
}
function sourceNotes(l){
 const rules=Object.values(l?.worksheetChoicesV276||{});
 return rules.map(x=>'- „'+x.hint+'“: ursprüngliche Datei(en) '+
  (x.originalNames?.join(', ')||'nicht eindeutig zugeordnet')+
  ' NICHT benutzen; stattdessen '+(x.chosenNames||[]).join(', ')+
  ' (nur für diese Unterrichtsstunde).').join('\n');
}
function sourceBlock(l){
 const files=activeFiles(l),notes=sourceNotes(l);
 return '\n\n## Verbindliche Materialauswahl für diese Stunde\n'+
 (notes||'Keine ausdrücklichen Ersetzungen hinterlegt.')+
 '\nAktive Originaldateien, die für die konkrete Planung zur Verfügung gestellt werden:\n'+
 (files.map(f=>'- '+f.name+' · '+f.kind+' · Materialhinweis: '+f.hint).join('\n')||'- Keine aktiven Dateianhänge zugeordnet.')+
 '\nInhalt der Dateien NICHT aus den Dateinamen ableiten. Lies die tatsächlich beigefügten Dateien. Fehlen die Originale, bitte nachfragen. Nutze ausschließlich die aktive Materialauswahl – keine alten Ersatzfassungen oder Archivdateien.\n'+
 '\n## Fachlich sinnvolle Visualisierungen in der Präsentation\n'+
 'Nutze Bilder, Skizzen, Zeitleisten, Schaubilder oder einfache Diagramme NUR, wenn sie einen didaktischen Mehrwert haben (z. B. zum Erklären, Vergleichen oder Sichern). '+
 'Bevorzuge eigene einfache, fachlich korrekte und auf dem Material beruhende Schaubilder. '+
 'Für eine echte Bildimpuls-Folie darf imageMaterial nur auf den exakten Dateinamen eines tatsächlich vorhandenen PNG/JPG aus dem hochgeladenen Paket verweisen. '+
 'Bei PDFs oder anderen Dateitypen keine direkte Bildeinbettung behaupten. Fehlt eine passende Bilddatei, beschreibe einen sinnvollen Bildvorschlag oder nutze eine textbasierte Folie. '+
 'Keine erfundenen Bilder, Quellenangaben oder angeblich schon erzeugten Illustrationen. \n';
}
async function replace(l,h,fs){
 if(saving)return;
 const files=[...(fs||[])].filter(f=>f?.name);
 if(!l||!h||!files.length)return;
 if(files.length>MAX_FILES||files.some(f=>!extOK.test(f.name)||f.size>30*1024*1024)||
 files.reduce((n,f)=>n+f.size,0)>MAX_BYTES)
   throw Error('Bitte maximal 35 Dateien (PDF, Word, Bilder oder PPT) mit je höchstens 30 MB und zusammen höchstens 160 MB wählen.');
 saving=true;
 const originalLesson=structuredClone(l),originalMaterials=state.materials.slice(),inserted=[];
 try{
  const oldBundle=resourceBundleV176(l,h),oldResources=lessonResourcesV14(l).find(r=>resourceKeyV14(r.hint)===resourceKeyV14(h));
  const existingChoice=l.worksheetChoicesV276?.[resourceKeyV14(h)];
  const previousPairs=(oldBundle?.items?.length?oldBundle.items.map(x=>({materialId:x.materialId,variantId:x.variantId})):
    oldResources?.material&&oldResources.variant?[{materialId:oldResources.material.id,variantId:oldResources.variant.id}]:[]);
  const priorPairs=existingChoice?.originalPairs?.length?existingChoice.originalPairs:previousPairs;
  const prior=existingChoice?.originalNames?.length?existingChoice.originalNames:priorPairs
    .map(x=>variant(x.materialId,x.variantId)?.fileName||mat(x.materialId)?.title||'').filter(Boolean);
  // Remove the previous files from this lesson's loose material links.
  // Otherwise the older resource collector exposes them as extra worksheets
  // even when the current print package has been correctly replaced.
  const previousIds=new Set(previousPairs.map(x=>x.materialId));
  l.materials=(l.materials||[]).filter(id=>!previousIds.has(id));
  // Disconnect old paper assignments only in the current lesson. The material
  // itself and all other lessons referencing it remain unchanged.
  v183DisconnectHint(l,h);
  const b=resourceBundleV176(l,h,true);
  b.items=[];b.complete=true;b.deferred=false;b.reusedV183=false;
  b._v183Manual=true;b._v183Preferred=false;b.archivedV183=false;
  l.hiddenResourceKeysV183=(l.hiddenResourceKeysV183||[]).filter(k=>k!==resourceKeyV14(h));
  setResourceTypeV14(l,h,'print');
  for(const f of files){
   const course=cls(l.classId),replacementSubject=/mathe/i.test(course?.subject||'')?'Mathematik':
     /relig/i.test(course?.subject||'')?'Religion':'';
   const replacementGrade=Number(String(course?.name||'').match(/\d+/)?.[0])||0;
   const m={id:uid('mat'),title:f.name.replace(/\.[^.]+$/,''),kind:'file',
     resourceType:'print',source:'Eigenes Ersatzarbeitsblatt · '+h,
     // Searchable beyond this school year, but NOT auto-assigned to other lessons.
     hubV237:{subject:replacementSubject,grade:replacementGrade,kind:'arbeitsblatt',status:'pool',
       note:'Erstellt als eigene Alternative zu '+h},
     hubV295:{usage:'core',reviewedAt:new Date().toISOString(),reviewSource:'lesson-worksheet',
       originLessonId:l.id,originLessonDate:l.date,originLessonTitle:l.title||l.planReference?.title||''},
     variants:[],improvementFlags:[],
     // Deliberately NOT assigned to the whole unit: the lesson bundle is the
     // exclusive source. Otherwise V0.18.4 auto-attaches these files as new
     // separate resource hints on render and undo cannot exclude them.
     assignments:[]};
   const vt=resourceFileRoleV176(f.name),v={id:uid('var'),type:vt,
     label:variantLabelV15(vt),available:true,fileName:f.name,
     fileKey:'material-v276-'+m.id};
   await fileStorePut(v.fileKey,f);storedFileKeys.add(v.fileKey);inserted.push(v.fileKey);
   m.variants.push(v);state.materials.push(m);
   b.items.push({id:uid('bundle'),materialId:m.id,variantId:v.id});
   l.materials=l.materials||[];
   if(!l.materials.includes(m.id))l.materials.push(m.id);
   const p=ensurePlan(l,m.id,v.id);
   p.needed=isPrintVariantV176(v,m);p.count=p.needed?(Number(cls(l.classId)?.students)||0):0;
   p.mode='bw';p.alreadyPrinted=false;p._v183removed=false;p._v183obsolete=false;
  }
  l.resourceManualV183=l.resourceManualV183||{};
  l.resourceManualV183[resourceKeyV14(h)]={materialId:b.items[0].materialId,
    variantId:b.items[0].variantId,customChoiceV276:true};
  l.worksheetChoicesV276=l.worksheetChoicesV276||{};
  l.worksheetChoicesV276[resourceKeyV14(h)]={hint:h,originalNames:prior,originalPairs:priorPairs,
    chosenNames:files.map(f=>f.name),changedAt:new Date().toISOString()};
  await saveState();
  render();
 }catch(e){
  Object.keys(l).forEach(k=>delete l[k]);Object.assign(l,originalLesson);
  state.materials=originalMaterials;
  for(const key of inserted){try{await fileStoreDelete(key);}catch{}storedFileKeys.delete(key);}
  render();throw e;
 }finally{saving=false;}
}
async function useOriginal(l,h){
 const key=resourceKeyV14(h),rule=l?.worksheetChoicesV276?.[key];
 if(!l||!rule)throw Error('Keine eigene Ersetzung für diese Stunde vorhanden.');
 const pairs=(rule.originalPairs||[]).filter(x=>mat(x.materialId)&&variant(x.materialId,x.variantId));
 if(!pairs.length)throw Error('Die bisherigen Originaldateien sind nicht mehr zugeordnet. Bitte über den Materialeditor manuell auswählen.');
 const before=structuredClone(l);
 try{
   const b=resourceBundleV176(l,h,true);
   const retiredIds=new Set((b.items||[]).map(x=>x.materialId));
   l.materials=(l.materials||[]).filter(id=>!retiredIds.has(id));
   for(const x of pairs)if(!l.materials.includes(x.materialId))l.materials.push(x.materialId);
   for(const x of b.items||[]){
     const p=(l.printPlan||[]).find(p=>p.materialId===x.materialId&&p.variantId===x.variantId);
     if(p)v183DisablePlan(p,'worksheet-choice-undone');
   }
   b.items=pairs.map(x=>({id:uid('bundle'),materialId:x.materialId,variantId:x.variantId}));
   b.complete=true;b.deferred=false;b.reusedV183=false;b._v183Manual=true;b.archivedV183=false;
   l.hiddenResourceKeysV183=(l.hiddenResourceKeysV183||[]).filter(k=>k!==key);
   setResourceTypeV14(l,h,'print');
   l.resourceManualV183=l.resourceManualV183||{};
   l.resourceManualV183[key]={materialId:pairs[0].materialId,variantId:pairs[0].variantId};
   for(const x of pairs){
     const m=mat(x.materialId),v=variant(x.materialId,x.variantId);
     if(!m||!v||!hasStoredFile(v))throw Error('Originaldatei fehlt lokal: '+(v?.fileName||m?.title||'unbekannt'));
     const p=ensurePlan(l,m.id,v.id);
     p._v183removed=false;p._v183obsolete=false;p.needed=isPrintVariantV176(v,m);
     if(p.needed&&!(p.count>0))p.count=Number(cls(l.classId)?.students)||0;
   }
   delete l.worksheetChoicesV276[key];
   await saveState();render();
 }catch(e){Object.keys(l).forEach(k=>delete l[k]);Object.assign(l,before);render();throw e;}
}
async function exportSources(l){
 if(!l)throw Error('Keine Stunde geöffnet.');
 const files=activeFiles(l);
 if(files.length>MAX_FILES)throw Error('Mehr als 35 aktive Dateien. Bitte die Auswahl in der Materialübersicht reduzieren.');
 const z=new JSZip(),folder=z.folder('Aktive_Materialien'),seenNames=new Set();
 let total=0;
 const entries=[];
 for(let i=0;i<files.length;i++){
  const f=files[i],record=await fileStoreGet(f.key);
  if(!record?.blob)throw Error('Die ausgewählte Originaldatei ist nicht mehr verfügbar: '+f.name);
  total+=record.blob.size||0;
  if(total>MAX_BYTES)throw Error('Die ausgewählten Materialdateien sind zusammen größer als 160 MB.');
  let path=String(i+1).padStart(2,'0')+'_'+baseName(record.name||f.name),n=1;
  while(seenNames.has(path))path=String(i+1).padStart(2,'0')+'_'+n+++'_'+baseName(record.name||f.name);
  seenNames.add(path);folder.file(path,record.blob);
  entries.push({file:path,original:f.name,materialHint:f.hint,kind:f.kind});
 }
 const prompt=concretePlanningPromptV12(l);
 z.file('00_PROMPT_Stundenplanung.md',prompt);
 z.file('01_MATERIALAUSWAHL.json',JSON.stringify({schema:'schulcockpit.lesson-materials.v1',
  lesson:{date:l.date,subject:cls(l.classId)?.subject||'',course:cls(l.classId)?.name||'',
    title:l.title||''},replacements:Object.values(l.worksheetChoicesV276||{}),
    activeFiles:entries},null,2));
 z.file('02_HINWEISE.txt','Zuerst diesen ZIP-Inhalt bei ChatGPT hochladen; nur die im Ordner Aktive_Materialien enthaltenen Dateien sind für die Stunde ausgewählt.\nBitte Originale vor Upload auf personenbezogene Daten oder nicht freigegebene Inhalte prüfen.\nSchulcockpit überträgt keine Schülerlisten oder Punkte.\nEine fertige PowerPoint wird nicht automatisch von ChatGPT in Schulcockpit gespeichert – der importierte Folienplan wird anschließend dort erzeugt.\n');
 const blob=await z.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});
 downloadBlob((l.date||'Unterricht')+'_'+baseName(whoV14(l))+'_ChatGPT_Planung.zip',blob);
 return files.length;
}
const previousResourceRow=resourceRowV14;
resourceRowV14=function(l,r){
 let html=previousResourceRow(l,r);
 if(!l||r.type!=='print'||v182IsHeld(l))return html;
 const id=l.id+'|'+encodeURIComponent(r.hint);
 const choices=l.worksheetChoicesV276?.[resourceKeyV14(r.hint)];
 const extra='<div class="v276-replace"><label class="upload-button small-upload">'+
 (choices?'Andere ABs auswählen':'Stattdessen eigene ABs nutzen')+
 '<input type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.ppt,.pptx,.txt,.md" data-v276-replace="'+esc(id)+'" hidden></label>'+
 (choices?'<small>Ausgewählt: '+esc(choices.chosenNames.join(', '))+' · alte ABs nicht im Druckpaket</small>'+ 
 '<button class="text-button" type="button" data-v276-original="'+esc(id)+'">Original-ABs wieder verwenden</button>':'')+'</div>';
 return html+extra;
};
const previousWizardPrompt=wizardPromptStepV14;
wizardPromptStepV14=function(l){
 let html=previousWizardPrompt(l);
 const newButton='<div class="v276-export"><strong>Mit den echten Arbeitsblättern planen</strong>'+
 '<p>Die ZIP enthält den Stundenprompt und alle aktuell ausgewählten Originaldateien. Anders als beim reinen Kopieren kann ChatGPT die tatsächlichen ABs prüfen.</p>'+
 '<button type="button" class="primary" data-v276-export="'+esc(l.id)+'">Prompt + ausgewählte Dateien als ZIP herunterladen</button>'+
 '<small>Erst das ZIP bei ChatGPT hochladen, dann die Planung starten. Du entscheidest selbst, was hochgeladen wird.</small></div>';
 return html.replace('<div class="wizard-footer-v14">',newButton+'<div class="wizard-footer-v14">');
};
const previousPrompt=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){return previousPrompt(l)+sourceBlock(l);};
const previousWire=wire;
wire=function(){
 previousWire();
 document.querySelectorAll('[data-v276-replace]').forEach(el=>el.addEventListener('change',async()=>{
  const [l,h]=parseResource(el.dataset.v276Replace);
  try{await replace(l,h,el.files);}catch(e){alert('Arbeitsblätter konnten nicht ausgetauscht werden: '+(e.message||e));}
 }));
 document.querySelectorAll('[data-v276-original]').forEach(b=>b.addEventListener('click',async()=>{
  const [l,h]=parseResource(b.dataset.v276Original);
  try{await useOriginal(l,h);}catch(e){alert('Originaldateien konnten nicht wiederhergestellt werden: '+(e.message||e));}
 }));
 document.querySelectorAll('[data-v276-export]').forEach(b=>b.addEventListener('click',async()=>{
  if(saving)return;
  const label=b.textContent;b.disabled=true;b.textContent='Planungspaket wird erstellt …';
  try{await exportSources(lesson(b.dataset.v276Export));}
  catch(e){alert('ChatGPT-Paket konnte nicht erstellt werden: '+(e.message||e));b.disabled=false;b.textContent=label;}
 }));
};
window.SchulcockpitWorksheetChoiceV276={activeFiles,replace,useOriginal,exportSources,sourceBlock};
})();