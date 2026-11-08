/* Schulcockpit V0.31.3 – partial course-sequence replan from local material originals.
 * Keeps completed records untouched and archives older Soll descriptions.
 */
(function(){
'use strict';
const C=SC_PARTIAL_SEQUENCE_V313;
let flow=null;
const s=(v,n=2500)=>String(v??'').trim().slice(0,n);
const safe=(v)=>s(v,110).replace(/[^a-z0-9äöüÄÖÜß._-]+/gi,'_');
const rawDate=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
function q(){return flow?seq(flow.qid):null;}
function unitLinks(q,u){return (state.lessons||[]).filter(l=>l.classId===q.classId&&
 (l.planReference?.unitId===u.id||!l.planReference?.unitId&&
  l.sequenceId===q.id&&l.date===u.plannedDate));}
function held(q,u){return unitLinks(q,u).some(v182IsHeld);}
function protectedUnitIds(q){return (q.plan||[]).filter(u=>held(q,u)).map(u=>u.id);}
function openUnits(q){return (q.plan||[]).filter(u=>!held(q,u)&&!v201UnitSkipped(u));}
function selectedUnits(q){const all=openUnits(q);return flow?.qid===q.id&&Array.isArray(flow.selectedUnitIds)?
 all.filter(u=>flow.selectedUnitIds.includes(u.id)):all;}
function fingerprint(q){
 return JSON.stringify({qid:q.id,unit:(q.plan||[]).map(u=>
  [u.id,u.plannedDate,u.title,u.skippedThisYearV201,held(q,u)]),
  linked:(state.lessons||[]).filter(l=>l.classId===q.classId&&l.sequenceId===q.id)
   .map(l=>[l.id,l.planReference?.unitId,l.date,l.status,v182IsHeld(l),v182IsCanceled(l)])});
}
function defaultDelivery(q){
 const old=q.partialReplanV313?.deliverable||{};
 const religion=(cls(q.classId)?.subject||'').toLowerCase().includes('relig');
 const grief=/tod|trauer|sterb/i.test(q.title||'')&&
  v190SeqYear(q)==='2026/27'&&religion;
 return {title:old.title|| (grief?'Trauerglas':''),
  type:old.type||(grief?'Kreative Ersatzleistung':''),
  deadline:old.deadline||(grief?'2026-12-08':''),
  description:old.description||(grief?
   'Die Schülerinnen und Schüler gestalten ein Trauerglas als kreative Ersatzleistung; die Bewertungskriterien sind ein Lehrkraftdokument, kein Stundenfüllmaterial.':''),
  instructions:old.instructions||''};
}
function includedMaterials(q){
 const entries=new Map(),add=(ref,name,kind,source='',meta={})=>{
  if(!ref||entries.has(ref)||entries.size>=90)return;
  const teacherOnly=/bewertungskriterien.*trauerglas|trauerglas.*bewertungskriterien/i.test(name)&&
   /tod|trauer/i.test(q.title||'')||
   /^(teacher|lehrkraft)$/i.test(String(meta.resourceType||''))||
   /^(loesung|klausurloesung|arbeitsblattloesung|korrektur)$/i.test(String(meta.hubKind||''));
  entries.set(ref,{ref,name:s(name,240),kind,source:s(source,350),teacherOnly:!!teacherOnly,
   available:false,files:[],...meta});
 };
 for(const f of q.sourceFilesV190||[]){
  add('s:'+f.id,f.name,'Reihen-Originaldatei','Planungsdatei dieser Reihe',{fileKey:f.fileKey});
 }
 const activeIds=new Set((q.plan||[]).map(u=>u.id));
 const linked=new Set((state.lessons||[]).filter(l=>l.classId===q.classId&&
  l.sequenceId===q.id).flatMap(l=>[
   ...(l.materials||[]).filter(x=>typeof x==='string'),
   ...(l.printPlan||[]).map(x=>x.materialId).filter(Boolean)
  ]));
 for(const u of q.plan||[])for(const m of u.materialLinksV184||[]){
  if(m.materialId)linked.add(m.materialId);
  if(m.catalogId){
   const e=(state.materialCatalog||[]).find(e=>e.catalogId===m.catalogId);
   if(e)add('c:'+e.catalogId,e.fileName,'Katalogdatei',
    (e.sourceArchive||'')+' / '+(e.sourcePath||''),{catalogId:e.catalogId});
  }
 }
 for(const m of state.materials||[]){
  const assigned=(m.assignments||[]).some(a=>
   a.sequenceId===q.id||activeIds.has(a.unitId));
  const hub=m.hubV237||{},topic=s(hub.sequenceTitle||hub.topic||'').toLowerCase(),
   qtitle=s(q.title).toLowerCase();
  const related=topic.length>6&&(topic.includes(qtitle)||qtitle.includes(topic));
  const sameCourse=(m.assignments||[]).some(a=>a.classId===q.classId)||
   hub.courseId===q.classId||
   Number(hub.grade)===v202Grade(cls(q.classId))&&
   String(hub.subject||'').toLowerCase()===String(cls(q.classId)?.subject||'').toLowerCase()&&
   /trauerglas|trauer|jenseits|bestattung/i.test(m.title||'');
  if(linked.has(m.id)||assigned||related||sameCourse)
   add('m:'+m.id,m.title,'Materialhub',m.source||'',
    {materialId:m.id,resourceType:m.resourceType||'',hubKind:hub.kind||''});
 }
 for(const e of state.materialCatalog||[]){
  if(e.disposition==='excluded'||e.scope==='exclude'||catalogCourseV17(e)?.id!==q.classId)continue;
  const title=s(e.sequenceTitle).toLowerCase(),ref=s(q.title).toLowerCase();
  if(title.length>4&&(title.includes(ref)||ref.includes(title)))
   add('c:'+e.catalogId,e.fileName,'Katalogdatei',
    (e.sourceArchive||'')+' / '+(e.sourcePath||''),{catalogId:e.catalogId,
    resourceType:e.resourceType||'',hubKind:e.hubV237?.kind||''});
 }
 return [...entries.values()];
}
function originalFolder(ref){return 'originale/'+safe(ref.replace(':','_'))+'/';}
async function attachFiles(item,zip,archives){
 const add=(blob,fileName,variantId)=>{
  if(!blob||typeof blob.size!=='number'||blob.size<=0)return;
  const name=originalFolder(item.ref)+safe(variantId||'')+'_'+safe(fileName);
  zip.file(name,blob);
  item.files.push({path:name,name:fileName,size:blob.size});
  item.available=true;
 };
 try{
  if(item.ref.startsWith('s:')){
   const file=(q()?.sourceFilesV190||[]).find(f=>f.id===item.ref.slice(2));
   if(file?.fileKey){const rec=await fileStoreGet(file.fileKey);add(rec?.blob,file.name,'quelle');}
  }else if(item.ref.startsWith('m:')){
   const m=mat(item.ref.slice(2));
   if(m)for(const v of m.variants||[]){
    if(!v.fileKey||!hasStoredFile(v))continue;
    const rec=await fileStoreGet(v.fileKey);
    add(rec?.blob,v.fileName||rec?.name||m.title,v.id||v.type);
   }
  }else if(item.ref.startsWith('c:')){
   const e=(state.materialCatalog||[]).find(e=>e.catalogId===item.ref.slice(2));
   if(e&&catalogAvailableV17(e)){
    const ar=catalogArchiveRecordV17(e.sourceArchive);let archive=null;
    if(ar?.fileKey){
     if(!archives.has(ar.fileKey)){
      const blob=(await fileStoreGet(ar.fileKey))?.blob;
      archives.set(ar.fileKey,blob?await JSZip.loadAsync(blob):null);
     }
     archive=archives.get(ar.fileKey);
    }
    const blob=await catalogEntryFileV17(e,archive);
    add(blob,e.fileName,'original');
   }
  }
 }catch(error){console.warn('Material für Teilreihe nicht lesbar:',item.ref,error);}
 return item;
}
function currentContext(q,delivery,materials){
 const course=cls(q.classId),actual=(state.lessons||[]).filter(l=>
  l.classId===q.classId&&(l.sequenceId===q.id||
   (q.plan||[]).some(u=>u.id===l.planReference?.unitId)));
 const classroomMaterials=l=>[...(l.materials||[]),...(l.printPlan||[]).map(p=>p.materialId)]
  .filter(Boolean).map(id=>({id,title:mat(id)?.title||id,
   printed:(l.printPlan||[]).some(p=>p.materialId===id&&p.alreadyPrinted)}));
 const evidence=l=>({
  lessonId:l.id,date:l.date,slot:l.slot,title:l.title||'',objective:l.objective||'',
  unitId:l.planReference?.unitId||'',status:l.status,held:!!v182IsHeld(l),
  actuallyTaught:l.actualV270?.mode||'',
  reflection:s(l.reflectionV182?.note||l.reflection?.note,1600),
  materialUsed:classroomMaterials(l),
  planContent:l.planReference?.content||''});
 const open=selectedUnits(q),retained=openUnits(q).filter(u=>!open.includes(u));
 const assess=(state.assessments||[]).filter(a=>a.classId===q.classId&&
  (a.date>=q.startDate&&a.date<=q.endDate||
   (a.title||'').toLowerCase().includes('trauer')))
  .map(a=>({date:a.date,title:a.title,type:a.type,notes:a.notes}));
 const info={
  schema:C.SCHEMA,course:{id:course.id,name:course.name,subject:course.subject,
   grade:v202Grade(course),students:Number(course.students)||null,
   schoolYear:v190SeqYear(q)},
  sequence:{id:q.id,title:q.title,goal:q.goal||'',notes:q.notes||'',
   startDate:q.startDate||'',endDate:q.endDate||'',
   curriculum:q.curriculumV202||null},
  timetable:(state.timetable||[]).filter(t=>t.classId===q.classId)
   .map(t=>({weekday:t.weekday,slot:t.slot,period:t.period})),
  retainedUnits:retained.map(u=>({id:u.id,plannedDate:u.plannedDate,
   title:u.title,content:u.content,objective:u.objective,
   note:'Bewusste Entscheidung der Lehrkraft: STUNDE NICHT ÜBERARBEITEN'})),
  heldUnits:(q.plan||[]).filter(u=>held(q,u)).map(u=>({
   id:u.id,plannedDate:u.plannedDate,title:u.title,content:u.content,
   objective:u.objective,notes:u.notes,actual:actual.filter(l=>l.planReference?.unitId===u.id).map(evidence)})),
  openUnits:open.map(u=>({
   id:u.id,plannedDate:u.plannedDate,title:u.title,content:u.content,
   objective:u.objective,notes:u.notes,material:u.material,
   originalMaterialLinks:(u.materialLinksV184||[]).map(m=>({
    materialId:m.materialId||'',catalogId:m.catalogId||'',
    displayTitle:m.displayTitle||m.canonical||'',kind:m.kind||'',
    printMode:m.printMode||'none',reuse:!!m.reuse})),
   pendingMaterials:u.pendingMaterialReferencesV184||[],
   resourcesNeeded:u.resourcesNeededV244||'',
   previouslyPrepared:actual.filter(l=>l.planReference?.unitId===u.id).map(evidence)})),
  orphanLessons:actual.filter(l=>!l.planReference?.unitId).map(evidence),
  assessments:assess,deliverable:delivery,
  materials:materials.map(x=>({...x})),
  schoolCalendar:{noSchool:v190CalendarRanges(v190SeqYear(q))
   .filter(r=>r.impactV262!=='substitution'&&r.start<=q.endDate&&r.end>=q.startDate)
   .map(r=>({start:r.start,end:r.end,name:r.name})),
   substitution:v190CalendarRanges(v190SeqYear(q))
    .filter(r=>r.impactV262==='substitution'&&r.start<=q.endDate&&r.end>=q.startDate)
    .map(r=>({start:r.start,end:r.end,name:r.name}))}
 };
 return info;
}
async function exportZip(){
 const q0=q();if(!q0)throw Error('Bitte zuerst die Reihe öffnen.');
 const d=flow.delivery;
 if(!C.validDate(d.deadline)||!s(d.title))throw Error('Bitte Titel und gültigen Abgabetermin festlegen.');
 if(!selectedUnits(q0).length)throw Error('Bitte mindestens eine nicht gehaltene Stunde zur Überarbeitung auswählen.');
 if(typeof JSZip==='undefined')throw Error('ZIP-Unterstützung ist nicht geladen.');
 const zip=new JSZip(),archives=new Map(),sources=includedMaterials(q0);
 for(const item of sources)await attachFiles(item,zip,archives);
 const ctx=currentContext(q0,d,sources);
 const prompt=C.prompt(ctx);
 const instruction='# Teil-Neuplanung '+ctx.sequence.title+'\n\n'+
 '1. Diese ZIP-Datei zusammen mit dem Prompt in 01_CHATGPT_PROMPT.md bei ChatGPT hochladen. '+ 
 'Die Originaldateien liegen unter originale/. Fehlende Dateien stehen im Manifest.\n'+
 '2. ChatGPT soll NUR die offenen Stunden aus 02_IST_UND_SOLL.json neu planen. '+ 
 'Gehaltene Stunden stehen als unveränderlicher tatsächlicher Verlauf darin.\n'+
 '3. Jede Materialdatei kritisch lesen und in materialAudit bewerten. '+ 
 'Lehrkraft-Bewertungsraster sind NICHT automatisch Unterrichtsmaterial.\n'+
 '4. Die komplette Antwort mit <SCHULCOCKPIT_PARTIAL_SEQUENCE_IMPORT> im Cockpit einfügen. '+ 
 'Import prüfen, dann bewusst übernehmen. Vorher werden keine Unterrichtsdaten überschrieben.\n'+
 '5. Neue, noch NICHT vorhandene ABs sind als Bedarf hinterlegt; '+ 
 'sie müssen anschließend erstellt und im Materialhub verknüpft werden.\n';
 zip.file('00_START_HIER.md',instruction);
 zip.file('01_CHATGPT_PROMPT.md',prompt);
 zip.file('02_IST_UND_SOLL.json',JSON.stringify({
  course:ctx.course,sequence:ctx.sequence,timetable:ctx.timetable,
  heldUnits:ctx.heldUnits,retainedUnits:ctx.retainedUnits,openUnits:ctx.openUnits,
  orphanLessons:ctx.orphanLessons,assessments:ctx.assessments,
  schoolCalendar:ctx.schoolCalendar},null,2));
 zip.file('03_MATERIALMANIFEST.json',JSON.stringify({
  materials:ctx.materials,missing:ctx.materials.filter(m=>!m.available).map(m=>m.ref),
  note:'Nur originale/ enthält überprüfbare Dateien; Name allein beweist Eignung nicht.'},null,2));
 zip.file('04_LEISTUNGSABGABE.json',JSON.stringify(d,null,2));
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:5}});
 downloadBlob('Schulcockpit_Teilneuplanung_'+safe(q0.title)+'_'+rawDate()+'.zip',blob);
 flow.ctx=ctx;flow.prompt=prompt;flow.signature=fingerprint(q0);flow.step='import';
 render();
 const n=sources.filter(x=>!x.available).length;
 alert('ZIP erstellt · '+ctx.heldUnits.length+' gehaltene Stunden geschützt · '+
  ctx.openUnits.length+' offene Stunden neu zu planen · '+sources.length+
  ' Materialquellen ('+n+' ohne lokal verfügbares Original).'+
  '\n\nPrompt aus der ZIP im selben Chat verwenden. Anschließend Antwort hier zurückkopieren.');
}
function open(qid){
 const q0=seq(qid);if(!q0)return;
 flow={qid:q0.id,step:'setup',selectedUnitIds:openUnits(q0).map(u=>u.id),delivery:defaultDelivery(q0),
  raw:'',parsed:null,ctx:null,prompt:'',signature:''};
 modal={type:'v313PartialReplan'};render();
}
function modalPage(){
 const q0=q(),f=flow;if(!q0)return '<div class="modal-backdrop" data-action="modal-close"><section class="modal">Reihe nicht verfügbar.</section></div>';
 const protectedCount=protectedUnitIds(q0).length,open=openUnits(q0);
 const heading='<div class="modal-backdrop" data-action="modal-close">'+
  '<section class="modal modal-wide v313-modal" data-modal-stop>'+
  '<header class="modal-header"><div><span class="eyebrow">TEIL-NEUPLANUNG · '+safe(q0.title)+'</span>'+
  '<h2>'+({setup:'Nur den offenen Rest neu planen',import:'ChatGPT-Antwort zurückholen',preview:'Geprüfte neue Reihenplanung'}[f.step]||'Teil-Neuplanung')+'</h2>'+
  '<p>'+protectedCount+' gehaltene Sollstunden unverändert · '+open.length+
   ' offene Sollstunden für Überarbeitung</p></div>'+
  '<button class="icon-button" data-action="modal-close" aria-label="Schließen">×</button>'+
  '</header><div class="modal-body v313-body">';
 let body='';
 if(f.step==='setup'){
  body='<p>Die gehaltenen Stunden, ihre Reflexionen und verwendeten Materialien werden als Ist-Verlauf mitgegeben. '+ 
   'Die übrigen Stunden werden mit ihren vorhandenen IDs und Daten neu geplant. '+ 
   'Materialien werden kritisch geprüft; unbrauchbare Schülerunterlagen erzeugen einen klaren AB-Erstellungsbedarf.</p>'+
   '<div class="v313-fields"><label>Leistungsaufgabe / Abgabe'+
   '<input id="v313-delivery-title" value="'+esc(f.delivery.title)+'" placeholder="z. B. Trauerglas"></label>'+
   '<label>Form der Leistung<input id="v313-delivery-type" value="'+esc(f.delivery.type)+'" '+
    'placeholder="z. B. kreative Ersatzleistung"></label>'+
   '<label>Verbindlicher Abgabetermin<input type="date" id="v313-deadline" value="'+esc(f.delivery.deadline)+'"></label>'+
   '<label class="full">Wichtige Anforderungen / bereits festgelegte Kriterien'+
   '<textarea id="v313-description" rows="3">'+esc(f.delivery.description)+'</textarea></label>'+
   '<label class="full">Weitere persönliche didaktische Vorgaben (optional)'+
   '<textarea id="v313-instructions" rows="3" placeholder="z. B. mehr Gestaltungszeit, keine reinen Organisationsstunden">'+
    esc(f.delivery.instructions||'')+'</textarea></label></div>'+
   '<details><summary>Geschützte und offene Sollstunden prüfen</summary>'+
   '<p><strong>Häkchen setzen:</strong> Nur diese Stunden neu planen. Entferne das Häkchen bei einer Stunde, deren Inhalt du behalten möchtest – selbst wenn sie noch nicht als gehalten markiert ist.</p>'+
   '<div class="v313-plan-snapshot">'+(q0.plan||[]).map(u=>
     '<div><span>'+esc(u.plannedDate||'Datum offen')+'</span><strong>'+esc(u.title)+'</strong>'+
     (!held(q0,u)&&!v201UnitSkipped(u)?'<label class="v313-replan-toggle"><input type="checkbox" data-v313-include="'+esc(u.id)+'" '+
       (f.selectedUnitIds.includes(u.id)?'checked':'')+'> Neu planen</label>':'')+
     '<small>'+(held(q0,u)?'🔒 Bereits gehalten':v201UnitSkipped(u)?'Dieses Jahr ausgelassen':
       'Wird neu geplant')+'</small></div>').join('')+'</div></details>'+
   '<div class="v313-actions"><button class="primary" data-v313-export>'+
   'ZIP mit Ist-Unterricht & Originalmaterialien erstellen →</button></div>';
 }else if(f.step==='import'){
  body='<p><strong>1.</strong> Die ZIP bei ChatGPT hochladen und den Prompt verwenden. '+
   '<strong>2.</strong> Die vollständige Antwort hier einfügen. '+
   '<strong>3.</strong> Erst nach Prüfung speichern.</p>'+
   '<details><summary>ChatGPT-Prompt zum Kopieren anzeigen</summary>'+
   '<textarea id="v313-prompt" rows="8" readonly>'+esc(f.prompt)+'</textarea>'+
   '<button class="secondary" data-v313-copy>Prompt kopieren</button></details>'+
   '<label>ChatGPT-Antwort mit SCHULCOCKPIT_PARTIAL_SEQUENCE_IMPORT'+
   '<textarea id="v313-response" rows="13" placeholder="Vollständige Antwort einfügen">'+esc(f.raw||'')+
   '</textarea></label>'+
   '<div class="v313-actions"><button class="secondary" data-v313-back>Vorgaben ändern</button>'+
   '<button class="primary" data-v313-check>Antwort auf held/Material/Abgabe prüfen →</button></div>';
 }else if(f.step==='preview'){
  const p=f.parsed,a=p.materialAudit||[],newAb=p.units.filter(u=>u.needsNewWorksheet);
  body='<p><strong>'+p.units.length+' offene Stunden</strong> werden inhaltlich neu geplant; '+
   protectedCount+' gehaltene Stunden bleiben unverändert. Der Abgabetermin '+esc(p.deliverable.deadline)+
   ' bleibt fest. '+newAb.length+' Stunden brauchen ein <strong>neues Arbeitsblatt</strong>.</p>'+
   '<details open><summary>Neue Themen und fehlende Materialien</summary>'+
   p.units.map(u=>'<div class="v313-preview-row"><strong>'+esc(u.plannedDate)+' · '+esc(u.title)+'</strong>'+
   '<p>'+esc(u.content)+'</p>'+
   (u.needsNewWorksheet?'<small>📝 Neues AB ERSTELLEN: '+esc(u.worksheetBrief)+'</small>':'')+
   '</div>').join('')+'</details>'+
   '<details><summary>Materialprüfung ('+a.length+')</summary>'+
   a.map(e=>'<div class="v313-preview-row"><strong>'+esc(f.ctx.materials.find(x=>x.ref===e.ref)?.name||e.ref)+'</strong>'+
    '<small>'+esc(e.verdict)+' · '+esc(e.reason)+'</small></div>').join('')+'</details>'+
   '<p class="v313-warn">Bereits ausgearbeitete offene Stunden können fachlich veraltet sein. '+ 
   'Alte Folien, Druckentscheidungen und Materialien bleiben als Historie erhalten, '+ 
   'aber ungeeignete Materialien werden als nicht mehr aktiv markiert.</p>'+
   '<div class="v313-actions"><button class="secondary" data-v313-edit>Antwort korrigieren</button>'+
   '<button class="primary" data-v313-apply>Nur offene Stunden verbindlich übernehmen →</button></div>';
 }
 return heading+body+'</div></section></div>';
}
async function apply(){
 const f=flow,q0=q();if(!f?.parsed||!q0||!f.ctx)throw Error('Keine geprüfte Teilplanung vorhanden.');
 if(f.signature!==fingerprint(q0))throw Error('Die Ausgangsreihe wurde seit dem ZIP-Export verändert. Bitte neu exportieren.');
 const currentContext={...f.ctx,openUnits:selectedUnits(q0).map(u=>({id:u.id,plannedDate:u.plannedDate})),
  deliverable:f.ctx.deliverable};
 const pkg=C.validate(f.parsed,currentContext),old={
  sequences:structuredClone(state.sequences),lessons:structuredClone(state.lessons)};
 const byId=new Map((q0.plan||[]).map(u=>[u.id,u]));
 const audits=new Map(pkg.materialAudit.map(x=>[x.ref,x]));
 const materials=new Map(f.ctx.materials.map(m=>[m.ref,m]));
 const generatedAt=new Date().toISOString();
 const details=[];
 try{
  for(const r of pkg.units){
   const u=byId.get(r.unitId);
   if(!u||held(q0,u))throw Error('Eine bereits gehaltene Stunde würde verändert.');
   const previous={
    title:u.title,content:u.content,objective:u.objective,notes:u.notes,material:u.material,
    materialLinksV184:structuredClone(u.materialLinksV184||[]),
    pendingMaterialReferencesV184:structuredClone(u.pendingMaterialReferencesV184||[]),
    resourcesNeededV244:u.resourcesNeededV244,preparationV244:u.preparationV244,
    at:generatedAt};
   const oldMaterialIds=new Set((u.materialLinksV184||[]).map(x=>x.materialId).filter(Boolean));
   // Also retire materials marked unsuitable or teacher-only in the audit,
   // even if they reached the concrete lesson through a different path.
   for(const audit of pkg.materialAudit){
    if(audit.verdict==='usable')continue;
    if(audit.ref.startsWith('m:'))oldMaterialIds.add(audit.ref.slice(2));
    if(audit.ref.startsWith('c:')){
     const e=(state.materialCatalog||[]).find(x=>'c:'+x.catalogId===audit.ref);
     for(const m of state.materials||[])if(m.catalogId===e?.catalogId)oldMaterialIds.add(m.id);
    }
   }
   const approved=[],pending=[];
   for(const ref of r.studentMaterialRefs){
    const m=materials.get(ref);
    if(ref.startsWith('m:')){
     const physical=mat(ref.slice(2)),variant=(physical?.variants||[]).find(v=>hasStoredFile(v));
     if(physical&&variant){
      approved.push({materialId:physical.id,variantId:variant.id,
       catalogId:physical.catalogId||'',canonical:physical.title,
       displayTitle:physical.title,printMode:'none',copies:0,
       reuse:false,kind:'file',sourceReplanV313:true});
     }else pending.push({title:m?.name||ref,kind:'file',
       status:'requires-local-activation',sourceRefV313:ref});
    }else if(ref.startsWith('c:')){
     const e=(state.materialCatalog||[]).find(x=>'c:'+x.catalogId===ref);
     const physical=(state.materials||[]).find(x=>x.catalogId===e?.catalogId);
     const variant=physical?.variants?.find(v=>hasStoredFile(v));
     if(physical&&variant)approved.push({materialId:physical.id,
      variantId:variant.id,catalogId:e.catalogId,canonical:physical.title,
      displayTitle:physical.title,printMode:'none',copies:0,reuse:false,kind:'file',
      sourceReplanV313:true});
     else pending.push({title:m?.name||ref,kind:'file',
       status:'requires-local-activation',sourceRefV313:ref});
    }else if(ref.startsWith('s:')){
     // Source files are planning references, not automatically print-capable
     // Material Hub entries. Require explicit activation to print/download.
     pending.push({title:m?.name||ref,kind:'file',
      status:'requires-local-activation',sourceRefV313:ref});
    }
   }
   const newIds=new Set(approved.map(x=>x.materialId));
   const retired=[...oldMaterialIds].filter(id=>!newIds.has(id));
   u.previousPartialReplanV313=(u.previousPartialReplanV313||[]).slice(-2).concat(previous);
   u.title=r.title;u.content=r.content;u.objective=r.objective;u.notes=r.notes;
   u.materialLinksV184=approved;
   u.pendingMaterialReferencesV184=pending;
   u.material=[...r.studentMaterialRefs.map(ref=>materials.get(ref)?.name||ref),
    ...r.bookTasks].filter(Boolean).join('\n');
   u.newWorksheetV313=r.needsNewWorksheet?{
    required:true,brief:r.worksheetBrief,status:'must-create',createdAt:generatedAt}:null;
   u.resourcesNeededV244=[r.additionalPreparation,
    r.needsNewWorksheet?'Eigenes Arbeitsblatt erstellen: '+r.worksheetBrief:''].filter(Boolean).join('\n');
   u.preparationV244=r.teachingReason;
   u.partialReplanSourceV313={at:generatedAt,reason:r.teachingReason,
    reviewedMaterialRefs:r.studentMaterialRefs,retiredMaterialIds:retired};
   for(const l of unitLinks(q0,u)){
    if(v182IsHeld(l)||v182IsCanceled(l))continue;
    const planned=!!((l.phasePlan||[]).length||(l.slides||[]).length||l.aiImportAt);
    l.title=r.title;l.objective=r.objective;l.sequenceId=q0.id;l.unit=q0.title;
    l.planReference={...(l.planReference||{}),unitId:u.id,
     title:r.title,content:r.content,objective:r.objective,
     material:u.material,notes:r.notes,plannedDate:u.plannedDate,
     autoMatched:false};
    l.needsPlanRefreshV313=planned;
    l.replanSuppressedMaterialIdsV313=[...new Set([
     ...(l.replanSuppressedMaterialIdsV313||[]),...retired])];
    // A completed print operation remains historically completed. Unprinted
    // old automatic references are disabled; never erase the print record.
    for(const p of l.printPlan||[])
     if(retired.includes(p.materialId)&&!p.alreadyPrinted)p.needed=false;
    if(planned&&l.presentationReady&&!l.presentationNotRequiredV177)
     l.presentationReady=false;
   }
   details.push(u.id);
  }
  q0.materialAuditV313=pkg.materialAudit;
  q0.partialReplanV313={deliverable:{
   ...pkg.deliverable,instructions:f.delivery.instructions||''},
   completedAt:generatedAt,unitIds:details,source:'chatgpt-reviewed',
   needsNewWorksheetCount:pkg.units.filter(u=>u.needsNewWorksheet).length};
  await Promise.resolve(saveState());
  const count=details.length;flow=null;
  modal={type:'sequence',id:q0.id};render();
  alert('Teil-Neuplanung gespeichert: '+count+' offene Sollstunden. '+
   'Gehaltene Stunden und historische Materialien blieben erhalten. '+
   'Neues benötigtes Unterrichtsmaterial erscheint als Erstellungsauftrag.');
  return count;
 }catch(e){
  state.sequences=old.sequences;state.lessons=old.lessons;
  throw e;
 }
}
const oldPanel=sequencePanel;
sequencePanel=function(q0){
 let h=oldPanel(q0);if(!q0||(q0.plan||[]).length===0)return h;
 const p=q0.partialReplanV313?.deliverable,button=
 '<div class="v313-replan-cta"><div><strong>Nur den Rest der Reihe neu planen</strong>'+
 '<p>Gehaltene Stunden, bisherige Materialien und Reflexionen gehen als Ist-Kontext mit. '+
 'ChatGPT prüft Originaldateien kritisch und meldet fehlende Arbeitsblätter.</p>'+
 (p?'<small>Leistungsabgabe: '+esc(p.title)+' · '+esc(p.deadline)+'</small>':'')+
 '</div><button type="button" class="primary" data-v313-open="'+esc(q0.id)+'">'+
 'Offene Stunden mit ChatGPT neu planen →</button></div>';
 const anchor='<section class="detail-section v312-direct-section" data-v312-direct>';
 if(h.includes(anchor))return h.replace(anchor,anchor+button);
 return h.replace('<div class="detail-stack">','<div class="detail-stack">'+button);
};
const oldModal=modalHtml;
modalHtml=function(){return modal?.type==='v313PartialReplan'?modalPage():oldModal();};
const oldWire=wire;
wire=function(){
 oldWire();
 document.querySelectorAll('[data-v313-open]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.v313Open)));
 if(modal?.type!=='v313PartialReplan')return;
 document.querySelector('[data-v313-export]')?.addEventListener('click',async e=>{
  const el=e.currentTarget;el.disabled=true;
  const boxes=[...document.querySelectorAll('[data-v313-include]')];
  if(boxes.length)flow.selectedUnitIds=boxes.filter(x=>x.checked).map(x=>x.dataset.v313Include);
  flow.delivery={title:document.getElementById('v313-delivery-title')?.value||'',
   type:document.getElementById('v313-delivery-type')?.value||'',
   deadline:document.getElementById('v313-deadline')?.value||'',
   description:document.getElementById('v313-description')?.value||'',
   instructions:document.getElementById('v313-instructions')?.value||''};
  try{await exportZip();}
  catch(err){el.disabled=false;alert('ZIP konnte nicht erstellt werden: '+(err.message||err));}
 });
 document.querySelector('[data-v313-copy]')?.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(flow.prompt);alert('Prompt kopiert.');}
  catch{document.getElementById('v313-prompt')?.select();alert('Prompt auswählen und mit Cmd+C / Strg+C kopieren.');}
 });
 document.querySelector('[data-v313-back]')?.addEventListener('click',()=>{flow.step='setup';render();});
 document.querySelector('[data-v313-check]')?.addEventListener('click',()=>{
  flow.raw=document.getElementById('v313-response')?.value||'';
  try{
   if(flow.signature!==fingerprint(q()))throw Error('Die Ausgangsreihe hat sich verändert. Bitte ZIP neu exportieren.');
   flow.parsed=C.validate(flow.raw,flow.ctx);flow.step='preview';render();
  }catch(err){alert('Teil-Neuplanung: '+(err.message||err));}
 });
 document.querySelector('[data-v313-edit]')?.addEventListener('click',()=>{flow.step='import';render();});
 document.querySelector('[data-v313-apply]')?.addEventListener('click',async e=>{
  const b=e.currentTarget;b.disabled=true;
  try{await apply();}catch(err){b.disabled=false;alert('Keine Änderungen gespeichert: '+(err.message||err));}
 });
};
const oldPrompt=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
 let p=oldPrompt(l);const q0=l?.sequenceId?seq(l.sequenceId):null;
 const details=q0?.partialReplanV313;
 if(!details||!(q0.plan||[]).some(u=>u.id===l.planReference?.unitId))return p;
 const u=q0.plan.find(x=>x.id===l.planReference?.unitId),deadline=details.deliverable;
 p+='\n\n## Teil-Neuplanung dieser Reihe – verbindliche Lehrkraftvorgabe\n'+
  'Abgabeleistung: '+deadline.title+' ('+deadline.type+'). Abgabe: '+deadline.deadline+
  '. '+deadline.description+'. Das Bewertungsraster ist keine komplette Schülerarbeitsphase. '+
  'Keine Materialien erfinden. Die folgende Stunde basiert auf der bewusst überarbeiteten Sollplanung. '+
  (u.newWorksheetV313?.required?'ACHTUNG: Eigenes Arbeitsblatt ist NOCH NICHT erstellt; '+ 
   'vor der Nutzung erst erstellen: '+u.newWorksheetV313.brief+'. ':'')+
  (l.needsPlanRefreshV313?'Eine frühere konkrete Stundenplanung/Folienfassung kann fachlich überholt sein; '+
   'nicht ungeprüft übernehmen. ':'')+
  'Materialbewertung aus der Reihe: '+(q0.materialAuditV313||[]).map(a=>
   a.ref+' '+a.verdict+' ('+a.reason+')').join('; ')+'\n';
 return p;
};
const oldMaterials=v182RelevantMaterials;
v182RelevantMaterials=function(l){
 const rows=oldMaterials(l);const blocked=new Set(l?.replanSuppressedMaterialIdsV313||[]);
 return blocked.size?rows.filter(m=>!blocked.has(m?.material?.id||m?.id)):rows;
};
// The standard "plan whole sequence" wizard also receives this material
// quality contract. Preserve V309 source verification, existing import IDs and
// every pre-existing Material Hub choice; unfit files cannot be activated.
const v313OriginalSequencePrompt=v184Prompt;
v184Prompt=function(){
 let p=v313OriginalSequencePrompt(),q0=seq(v184Flow.sequenceId);
 const delivery=q0?.partialReplanV313?.deliverable;
 const guide='\n## Verbindliche Materialprüfung bereits in der REIHENPLANUNG\n'+
  'Sichte jede wirklich verfügbare Originaldatei, nicht nur den Dateinamen. '+
  'Gib für JEDES Material in units[].materials zusätzlich materialRole '+
  '(student / teacher_only / unsuitable / needs_revision / unknown) '+
  'und suitabilityReason als knappe Begründung an. '+
  'Bewertungsraster, Erwartungshorizonte und Lehrkraftlösungen dürfen NICHT '+
  'als Hauptmaterial für die Schülerarbeit oder Kopierauftrag verwendet werden. '+
  'Ist kein tragfähiges Schülerarbeitsmaterial vorhanden, muss die Stunde '+
  'needsNewWorksheet=true und worksheetBrief mit dem konkreten Erstellungsauftrag enthalten; '+
  'die nicht vorhandene Datei darf nicht als upload/print-fertig dargestellt werden. '+
  'Bloße Besprechung von Bewertungskriterien ist keine vollständige Unterrichtsstunde. '+
  'Auch bei teilweise passenden Vorlagen begründen, was ergänzt/überarbeitet werden muss. '+
  'Nur verified Quellen/Kompetenzen als verbindlich darstellen. '+ 
  (delivery?'Bereits bestätigte Abgabeleistung: '+delivery.title+
   ' ('+delivery.type+'), bindende Abgabe am '+delivery.deadline+'. '+delivery.description+'. ':'')+
  'Für jede Stunde die Felder needsNewWorksheet (true/false), worksheetBrief (Text) ergänzen; '+
  'kein erfundenes Arbeitsblatt als bereits vorhanden behaupten.\n\n';
 const pos=p.indexOf('<SCHULCOCKPIT_SEQUENCE_IMPORT>');
 return pos<0?p+guide:p.slice(0,pos)+guide+p.slice(pos);
};
const v313OriginalSequenceNormalize=v184Normalize;
v184Normalize=function(raw){
 const pkg=v313OriginalSequenceNormalize(raw);
 for(let i=0;i<pkg.units.length;i++){
  const src=raw?.units?.[i]||{},u=pkg.units[i];
  u.materialSuitabilityV313=(src.materials||[]).map((m,j)=>({
   title:String(m.title||u.materials[j]?.title||'').slice(0,240),
   role:['student','teacher_only','unsuitable','needs_revision','unknown'].includes(m.materialRole)?
    m.materialRole:'unknown',
   reason:String(m.suitabilityReason||'Keine Eignungsbegründung geliefert').slice(0,800)}));
  for(let j=0;j<u.materials.length;j++)
   u.materials[j].materialRoleV313=u.materialSuitabilityV313[j]?.role||'unknown';
  u.newWorksheetDraftV313={required:src.needsNewWorksheet===true,
   brief:String(src.worksheetBrief||'').trim().slice(0,1800)};
  if(u.newWorksheetDraftV313.required&&!u.newWorksheetDraftV313.brief)
   throw Error('Neues Arbeitsblatt ohne Erstellungsauftrag in Stunde '+(i+1));
 }
 return pkg;
};
const v313OriginalMaterialDecision=v184Decision;
v184Decision=function(ui,mi){
 const decision=v313OriginalMaterialDecision(ui,mi);
 if(['teacher_only','unsuitable','needs_revision'].includes(decision.item?.materialRoleV313))
  return {...decision,selected:'none',candidates:[]};
 return decision;
};
const v313OriginalSequenceApply=v184Apply;
v184Apply=async function(){
 const src=v184Flow.pkg;
 const result=await v313OriginalSequenceApply();
 const q0=seq(result.qid);let changed=0;
 if(!q0||!src)return result;
 for(const inp of src.units||[]){
  const matches=(q0.plan||[]).filter(u=>u.plannedDate===inp.plannedDate&&
   u.title===inp.title);
  if(matches.length!==1)continue; // no guesses when existing dates duplicate
  const u=matches[0],meta=inp.newWorksheetDraftV313||{};
  if(meta.required){
   u.newWorksheetV313={required:true,brief:meta.brief,
    status:'must-create',createdAt:new Date().toISOString()};
   u.resourcesNeededV244=[u.resourcesNeededV244,
    'Eigenes Arbeitsblatt erstellen: '+meta.brief].filter(Boolean).join('\n');
   changed++;
  }
  if(inp.materialSuitabilityV313?.length){
   u.materialSuitabilityV313=inp.materialSuitabilityV313;
   changed++;
  }
 }
 if(changed)await Promise.resolve(saveState());
 return result;
};
const oldRender=render;
render=function(){
 oldRender();const tag=document.querySelector('.brand small');
 if(tag)tag.textContent=state.settings.schoolYear+' · V0.31.3';
};
window.SchulcockpitPartialReplanV313={open,context:currentContext,exportZip,
 apply,getFlow:()=>flow,materialList:includedMaterials,held};
})();
