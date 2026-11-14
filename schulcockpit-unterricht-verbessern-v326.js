/* Schulcockpit V0.32.6 – classroom improvement workbench, not a new database.
 * Existing state.backlog / reflectionV182 remain the only task source of truth.
 */
(function(){
'use strict';
const C=window.SchulcockpitImproveCoreV326;
if(!C)throw Error('Verbessern 2.0: Kernmodul fehlt.');
const NEW_FLAGS=[
 ['active_students','Mehr Schüleraktivität statt Lehrkraftvortrag'],
 ['thinking','Kognitiv stärker aktivieren'],
 ['check_learning','Lernstand aller sichtbar machen']
];
for(const x of NEW_FLAGS)if(!V182_FLAGS.lesson.some(e=>e[0]===x[0]))V182_FLAGS.lesson.push(x);
// Keep prior-year learning visible in the existing V323 memory/prompt path.
const memoryCore=window.SchulcockpitQuickReflectionCoreV323;
function activeHints(entry){
 const flags=Array.isArray(entry?.lessonFlags)?entry.lessonFlags:[];
 return NEW_FLAGS.filter(([id])=>flags.includes(id)).map(([,label])=>label);
}
if(memoryCore){
 const priorEvidence=memoryCore.evidence;
 memoryCore.evidence=function(entries){
  return priorEvidence(entries).map(x=>({...x,hints:[...new Set([...(x.hints||[]),...activeHints(x)])]}));
 };
 const priorPrompt=memoryCore.promptHints;
 memoryCore.promptHints=function(entries){
  const base=priorPrompt(entries),hints=activeHints(entries?.[0]);
  if(!hints.length)return base;
  return base+'\nWeitere ausdrückliche Entwicklungswünsche aus der früheren Stunde:\n'+
   hints.map(x=>'- '+x).join('\n')+
   '\nNutze diese Hinweise nur als Vorschläge, nicht als automatische Bewertung.\n';
 };
}
let status='open',kind='all',subject='all',editor=null,editorText='',busy=false;
const items=()=>C.collect(state,[...storedFileKeys]);
const task=id=>(state.backlog||[]).find(x=>String(x.id)===String(id));
const row=id=>items().find(x=>x.id===String(id));
function stats(items){
 const s=C.summarize(items);
 return '<div class="v326-stats"><div><strong>'+s.open+'</strong><small>offen</small></div>'+
  '<div><strong>'+s.lesson+'</strong><small>Stundenabläufe</small></div>'+
  '<div><strong>'+s.material+'</strong><small>Arbeitsmaterialien</small></div>'+
  '<div><strong>'+s.ppt+'</strong><small>Präsentationen</small></div></div>';
}
function options(list,value){
 return list.map(([v,label])=>'<option value="'+esc(v)+'" '+(value===v?'selected':'')+'>'+esc(label)+'</option>').join('');
}
function card(item){
 const cat=C.CATEGORIES[item.kind]||'Unterricht';
 const descr=item.issues.length?item.issues.map(x=>x.label).join(' · '):
  'Manueller Eintrag – Einzelheiten im ursprünglichen Auftrag prüfen';
 const orig=item.hasOriginal?'Originaldatei lokal vorhanden':
  item.kind==='lesson'?'Kein Dateioriginal erforderlich':'Originaldatei hier nicht lokal verfügbar';
 return '<article class="v326-card '+(item.done?'v326-done':'')+'">'+
  '<div class="v326-card-top"><div><small>'+esc(item.subject||'Fach offen')+
  (item.grade?' · Jahrgang '+esc(item.grade):'')+(item.sourceDate?' · '+esc(item.sourceDate):'')+
  ' · '+esc(cat)+'</small><h3>'+esc(item.title)+'</h3></div>'+
  '<span class="v326-category">'+(item.done?'Erledigt':item.priority===2?'Material-/Inhaltshinweis':'Entwicklungsidee')+'</span></div>'+
  (item.lessonTitle&&item.lessonTitle!==item.title?'<p class="v326-context">Stunde: '+esc(item.lessonTitle)+'</p>':'')+
  '<p class="v326-issues">'+esc(descr)+'</p>'+
  '<div class="v326-file-status">'+(item.hasOriginal?'✓ ':'')+esc(orig)+'</div>'+
  '<div class="v326-card-actions">'+
  '<button type="button" class="primary" data-v326-plan="'+esc(item.id)+'">✨ Gezielt verbessern</button>'+
  (item.hasMaterial?'<button type="button" class="secondary" data-v326-version="'+esc(item.id)+'">Neue Materialfassung</button>':'')+
  (item.hasLesson?'<button type="button" class="text-button" data-v326-lesson="'+esc(item.lessonId)+'">Stunde ansehen</button>':'')+
  '<button type="button" class="text-button" data-v326-toggle="'+esc(item.id)+'">'+
  (item.done?'Wieder öffnen':'Als erledigt markieren')+'</button></div></article>';
}
function page(){
 const all=items(),sub=[...new Set(all.map(i=>i.subject).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de')),
  s=C.summarize(all),matches=C.filter(all,{status,kind,subject});
 return '<div class="content-grid v326-improve">'+
  '<section class="hero-card v326-hero"><div><span class="eyebrow">SCHULCOCKPIT · UNTERRICHT VERBESSERN 2.0</span>'+
  '<h2>Gute Stunden werden mit jedem Durchlauf besser.</h2>'+
  '<p>Deine Reflexionen ergeben konkrete Verbesserungsaufgaben. Du entscheidest, wann du sie überarbeitest – '+
  'mit möglichst viel aktiver Lernzeit und ohne überflüssige neue Materialien.</p></div></section>'+
  '<section class="panel v326-overview"><div class="section-head"><div><span class="eyebrow">ENTWICKLUNG IM BLICK</span>'+
  '<h2>Deine offenen Verbesserungen</h2></div>'+
  '<button class="secondary" type="button" data-v326-ideas>Ideenlabor öffnen</button></div>'+
  stats(all)+
  '<p class="microcopy">Die Zahlen zeigen dokumentierte Überarbeitungsaufgaben, keine Bewertung deiner Unterrichtsqualität. '+
  '„Erledigt“ wird nur durch deinen Klick gesetzt.</p></section>'+
  '<section class="panel v326-list"><div class="section-head"><div><span class="eyebrow">KONKRETE NÄCHSTE SCHRITTE</span>'+
  '<h2>Was möchtest du verbessern?</h2></div><span>'+matches.length+' von '+s.all+' Einträgen</span></div>'+
  '<div class="v326-filters"><label>Bearbeitungsstand<select data-v326-filter="status">'+options([
   ['open','Offen'],['all','Alle'],['done','Erledigt']],status)+'</select></label>'+
  '<label>Bereich<select data-v326-filter="kind">'+options([
   ['all','Alle Bereiche'],['lesson','Stundenabläufe'],['material','Arbeitsmaterialien'],['ppt','Präsentationen']],kind)+'</select></label>'+
  '<label>Fach<select data-v326-filter="subject">'+options([
   ['all','Alle Fächer'],...sub.map(x=>[x,x])],subject)+'</select></label></div>'+
  (matches.length?'<div class="v326-items">'+matches.slice(0,120).map(card).join('')+'</div>':
  '<div class="v326-empty"><strong>Hier ist gerade nichts offen.</strong><p>Nach einer gehaltenen Stunde kannst du bei der Blitzreflexion '+
  '„Mehr Schüleraktivität“, „Kognitiv aktivieren“ oder andere Verbesserungswünsche markieren. '+
  'Sie erscheinen nach dem Speichern automatisch hier.</p></div>')+
  (matches.length>120?'<p class="microcopy">Die ersten 120 Einträge werden gezeigt. Nutze die Filter, um weitere anzuzeigen.</p>':'')+
  '</section></div>';
}
function setFocus(value){
 if(!editor)return;
 editor.focus=value;
 editorText=C.brief(row(editor.id),value);
 render();
}
function detailModal(){
 const item=row(editor?.id);if(!item)return '';
 const source=item.source.name?item.source.name:'Keine direkt verfügbare Originaldatei';
 const f=editor.focus;
 return '<div class="modal-backdrop" data-action="modal-close">'+
  '<section class="modal modal-xwide v326-modal" data-modal-stop>'+
  '<header class="modal-header"><div><span class="eyebrow">ÜBERARBEITEN STATT NEU ERFINDEN</span>'+
  '<h2>'+esc(item.title)+'</h2></div>'+
  '<button class="icon-button" data-action="modal-close" aria-label="Schließen">×</button></header>'+
  '<div class="modal-body v326-modal-content">'+
  '<p>Wähle, <strong>wie</strong> du die Stunde verbessern möchtest. Der Auftrag ist bearbeitbar, '+
  'und du entscheidest selbst, was du an ChatGPT weitergibst.</p>'+
  '<label>Didaktischer Schwerpunkt<select data-v326-focus>'+
  options(C.FOCI,f)+'</select></label>'+
  '<label>Überarbeitungsauftrag<textarea rows="15" spellcheck="true" data-v326-text>'+
   esc(editorText)+'</textarea></label>'+
  '<p class="v326-attachment">'+(item.hasOriginal?
   '✓ Ausgewählte Originaldatei verfügbar: '+esc(source):
   '⚠ Kein Original lokal verfügbar. Das Quellenpaket enthält dann nur den Auftrag.')+'</p>'+
  '<p class="microcopy"><strong>Datenschutz:</strong> Freitext-Reflexionen und Schülerdaten werden nicht automatisch angefügt. '+
  'Prüfe auch das Originaldokument auf personenbezogene Angaben, bevor du es extern hochlädst.</p>'+
  '<div class="v326-modal-actions">'+
  '<button class="secondary" type="button" data-v326-copy>Auftrag kopieren</button>'+
  '<button class="primary" type="button" data-v326-export>Auftrag + Original als ZIP</button>'+
  (item.hasMaterial?'<button class="secondary" type="button" data-v326-from-editor="'+esc(item.id)+'">Neue Materialfassung hinterlegen</button>':'')+
  '</div><p class="microcopy">Der Export erstellt noch keine neue Datei. Sobald du eine überarbeitete Fassung hast, '+
  'kannst du sie über die bestehende Materialentwicklung als neue Version sichern. '+ 
  'Die Verbesserungsaufgabe wird nicht automatisch als erledigt markiert.</p></div></section></div>';
}
function openEditor(id){
 const item=row(id);if(!item)throw Error('Verbesserungsauftrag nicht gefunden.');
 editor={id:item.id,focus:C.focusFor(item)};
 editorText=C.brief(item,editor.focus);
 modal={type:'improveV326'};render();
}
async function setDone(id){
 const b=task(id);if(!b)return;
 const old={done:b.done,doneAt:b.doneAt};
 b.done=!b.done;b.doneAt=b.done?new Date().toISOString():'';
 try{await Promise.resolve(saveState());render();}
 catch(err){b.done=old.done;b.doneAt=old.doneAt;render();throw err;}
}
function openLesson(id){
 const l=lesson(id);if(!l)return;
 modal=null;v182LessonId=id;view='lessonDayV182';render();
}
function version(id){
 const i=row(id);
 if(!i?.hasMaterial)throw Error('Keine vorhandene Materialdatei zugeordnet. Öffne die betreffende Stunde.');
 const provider=window.SchulcockpitMaterialEvolutionV296;
 if(!provider?.begin)throw Error('Die bestehende Materialentwicklung ist nicht verfügbar.');
 provider.begin('library',{sourceKey:'m:'+i.materialId});
}
async function copyText(){
 const text=String(document.querySelector('[data-v326-text]')?.value||editorText);
 if(!text.trim())throw Error('Bitte den Auftrag nicht leer lassen.');
 if(navigator.clipboard?.writeText){
  try{await navigator.clipboard.writeText(text);return;}
  catch(err){console.warn('Zwischenablage nicht zugänglich, Textdatei wird angeboten',err);}
 }
 downloadText('Unterricht_verbessern_Auftrag.md',text);
}
async function exportBundle(){
 if(busy)return;
 const item=row(editor?.id);
 if(!item)throw Error('Aufgabe nicht gefunden.');
 if(typeof JSZip==='undefined')throw Error('ZIP-Funktion nicht verfügbar. Bitte neu laden.');
 const text=String(document.querySelector('[data-v326-text]')?.value||editorText);
 if(!text.trim())throw Error('Bitte zuerst den Auftrag formulieren.');
 busy=true;
 try{
  const zip=new JSZip();
  zip.file('00_AUFTRAG_FUER_CHATGPT.md',text);
  let included=false;
  if(item.source.fileKey&&storedFileKeys.has(item.source.fileKey)){
   const rec=await fileStoreGet(item.source.fileKey);
   if(rec?.blob){
    if(rec.blob.size>60*1024*1024)throw Error('Originaldatei ist größer als 60 MB. Bitte separat prüfen.');
    const extension=String(item.source.name||rec.name||'').match(/\.[a-z0-9]{2,6}$/i)?.[0]||'';
    zip.file('01_Originalmaterial'+extension,await rec.blob.arrayBuffer());included=true;
   }
  }
  zip.file('BITTE_LESEN.txt','Unterricht gezielt verbessern\n\n'+
   (included?'Die Originaldatei liegt bei. Prüfe sie vor dem Hochladen auf personenbezogene Inhalte.':
   'Das Original liegt nicht lokal vor und wurde NICHT beigefügt. Bitte eine vorhandene Originaldatei selbst ergänzen.')+
   '\n\nDas Quellenpaket wurde nur lokal exportiert und nicht an einen KI-Dienst gesendet. '+
   'Alte Materialien und Reflexionen wurden nicht verändert.\n');
  const bytes=await zip.generateAsync({type:'blob',compression:'DEFLATE'});
  downloadBlob('Unterricht_verbessern_'+C.bundleName(item)+'.zip',bytes);
 }finally{busy=false;}
}
let choiceQueue=Promise.resolve();
function chooseFlag(id,key){
 const job=choiceQueue.then(async()=>{
  const l=lesson(id);if(!l||!v182IsHeld(l)||v182IsCanceled(l))throw Error('Keine gehaltene Stunde.');
  if(!NEW_FLAGS.some(x=>x[0]===key))throw Error('Unbekannte Verbesserung.');
  const before=l.reflectionV182?structuredClone(l.reflectionV182):null;
  try{
   const reflection=v182GetReflection(l),at=reflection.lessonFlags.indexOf(key);
   if(at>=0)reflection.lessonFlags.splice(at,1);else reflection.lessonFlags.push(key);
   reflection.completedAt='';
   await Promise.resolve(saveState());
  }catch(err){
   if(before)l.reflectionV182=before;else delete l.reflectionV182;
   throw err;
  }finally{render();}
 });
 choiceQueue=job.catch(()=>{});
 return job;
}
const beforeReflection=v182ReflectionHtml;
v182ReflectionHtml=function(l){
 const html=beforeReflection(l);
 if(!l||!v182IsHeld(l)||!html.includes('<div class="v323-chips">'))return html;
 const flags=l.reflectionV182?.lessonFlags||[];
 return html.replace('<div class="v323-chips">',
  '<div class="v323-chips">'+NEW_FLAGS.map(([key,label])=>
   '<button type="button" class="v323-chip'+(flags.includes(key)?' active':'')+
   '" aria-pressed="'+(flags.includes(key)?'true':'false')+'" data-v326-flag="'+esc(l.id+'|'+key)+'">'+
   (flags.includes(key)?'✓ ':'')+esc(label)+'</button>').join(''));
};
const previousImprove=improveView;
improveView=function(){return page();};
const previousModal=modalHtml;
modalHtml=function(){return modal?.type==='improveV326'?detailModal():previousModal();};
const previousWire=wire;
wire=function(){
 previousWire();
 if(view==='improve'){
  for(const select of document.querySelectorAll('[data-v326-filter]'))select.addEventListener('change',e=>{
   const field=select.dataset.v326Filter;
   if(field==='status')status=e.target.value;
   if(field==='kind')kind=e.target.value;
   if(field==='subject')subject=e.target.value;
   render();
  });
  for(const b of document.querySelectorAll('[data-v326-plan]'))b.addEventListener('click',()=>openEditor(b.dataset.v326Plan));
  for(const b of document.querySelectorAll('[data-v326-lesson]'))b.addEventListener('click',()=>openLesson(b.dataset.v326Lesson));
  for(const b of document.querySelectorAll('[data-v326-version]'))b.addEventListener('click',()=>{try{version(b.dataset.v326Version);}catch(err){alert(err.message||err);}});
  for(const b of document.querySelectorAll('[data-v326-toggle]'))b.addEventListener('click',()=>void setDone(b.dataset.v326Toggle).catch(err=>alert('Status konnte nicht gespeichert werden: '+(err.message||err))));
  document.querySelector('[data-v326-ideas]')?.addEventListener('click',()=>{view='ideas';modal=null;render();});
 }
 if(modal?.type==='improveV326'){
  document.querySelector('[data-v326-focus]')?.addEventListener('change',e=>setFocus(e.target.value));
  document.querySelector('[data-v326-text]')?.addEventListener('input',e=>{editorText=e.target.value;});
  document.querySelector('[data-v326-copy]')?.addEventListener('click',()=>void copyText().catch(err=>alert('Auftrag konnte nicht kopiert werden: '+(err.message||err))));
  document.querySelector('[data-v326-export]')?.addEventListener('click',()=>void exportBundle().catch(err=>alert('Materialpaket konnte nicht erstellt werden: '+(err.message||err))));
  document.querySelector('[data-v326-from-editor]')?.addEventListener('click',e=>{try{version(e.currentTarget.dataset.v326FromEditor);}catch(err){alert(err.message||err);}});
 }
 for(const b of document.querySelectorAll('[data-v326-flag]'))b.addEventListener('click',()=>{
  const [id,key]=b.dataset.v326Flag.split('|');
  void chooseFlag(id,key).catch(err=>alert('Verbesserungswunsch konnte nicht gespeichert werden: '+(err.message||err)));
 });
};
const previousRender=render;
render=function(){
 previousRender();
 const badge=document.querySelector('.brand small');
 if(badge)badge.textContent=(state.settings?.schoolYear||'')+' · V0.32.6';
};
window.SchulcockpitImproveV326={items,openEditor,chooseFlag,setDone,exportBundle};
})();
