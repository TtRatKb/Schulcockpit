/* V0.29.4 – Fast, keyboard-friendly Material-Hub sorting.
 * Reviews are private metadata only; lesson links, original bytes and
 * filenames are never deleted, overwritten or silently reassigned. */
(function(){
'use strict';
const core=SC_MATERIAL_TRIAGE_V294;
let active=false,queue=[],index=0,subject='',grade=0,unreviewed=true;
let chosen=null,saving=false,previewKey='',previewUrl='',previewToken=0;
const subjects=['','Mathematik','Religion'],grades=[0,5,6,7,8,9,10,11,12,13];
function all(){
 const catalog=state.materialCatalog||[],ids=new Set(catalog.map(x=>x.catalogId)),out=[];
 for(const c of catalog)out.push({key:'c:'+c.catalogId,obj:c,name:c.fileName||'Katalogeintrag',
  isCatalog:true,ready:!!catalogAvailableV17(c),subject:c.hubV237?.subject||'',grade:Number(c.hubV237?.grade)||0});
 for(const m of state.materials||[]){
  if(m.catalogId&&ids.has(m.catalogId))continue;
  const first=(m.assignments||[])[0],course=cls(m.hubV237?.courseId||first?.classId);
  out.push({key:'m:'+m.id,obj:m,name:m.title||'Material',isCatalog:false,
   ready:(m.variants||[]).some(v=>hasStoredFile(v)),
   subject:m.hubV237?.subject||(/relig/i.test(course?.subject||'')?'Religion':/mathe/i.test(course?.subject||'')?'Mathematik':''),
   grade:Number(m.hubV237?.grade)||Number(String(course?.name||'').match(/\d+/)?.[0])||0});
 }
 return out;
}
function byKey(key){return all().find(x=>x.key===key)||null;}
function eligible(x){return (!subject||x.subject===subject)&&(!grade||x.grade===grade)&&
 (!unreviewed||!core.decision(x.obj).reviewed);}
function refill(){
 queue=all().filter(eligible).sort((a,b)=>a.name.localeCompare(b.name,'de',{numeric:true}))
  .map(x=>x.key);index=0;chosen=null;cleanupPreview();
}
function current(){return byKey(queue[index]);}
function draftFor(x){
 const d=core.decision(x.obj);
 let kind=d.kind;
 if(!core.types.some(t=>t[0]===kind)){
  if(/loesung/.test(kind))kind='loesung';
  else if(/arbeit|inklusion/.test(kind))kind='klassenarbeit';
  else kind='sonstiges';
 }
 return {kind,usage:d.usage};
}
function draft(){
 const x=current();
 if(!x)return null;
 if(!chosen||chosen.key!==x.key)chosen={key:x.key,...draftFor(x)};
 return chosen;
}
function options(values,currentValue,field){
 return values.map(([id,name,shortcut])=>
  '<button type="button" class="secondary v294-choice'+(currentValue===id?' selected':'')+
  '" data-v294-'+field+'="'+esc(id)+'" aria-pressed="'+String(currentValue===id)+'">'+
  '<kbd>'+esc(shortcut)+'</kbd> '+esc(name)+'</button>').join('');
}
function canPreview(x){const fileName=x?.isCatalog?x?.name:x?.obj?.variants?.find(v=>hasStoredFile(v))?.fileName||x?.name;return x?.ready&&/\.(pdf|png|jpe?g|webp|txt|md)$/i.test(fileName||'');}
function possiblePairs(x){
 if(!x)return [];
 return core.duplicates(all().map(y=>y.obj),x.obj).slice(0,8);
}
function triageView(){
 const xs=all(),stats=core.counters(xs.map(x=>x.obj)),x=current(),d=draft(),
 scope=xs.filter(y=>(!subject||y.subject===subject)&&(!grade||y.grade===grade));
 const done=scope.filter(y=>core.decision(y.obj).reviewed).length;
 const total=scope.length;
 return '<div class="content-grid v294-hub">'+
 '<section class="hero-card v294-header"><div><span class="eyebrow">MATERIALHUB · SORTIERMODUS</span>'+
 '<h2>Einordnen, entscheiden, weiter. ✦</h2>'+
 '<p>Kurze Dateivorschau, Materialart und Verwendung mit einem Klick oder Tastenkürzel. '+
 'Deine Originale und bereits verwendeten Stundenmaterialien bleiben unverändert.</p></div>'+
 '<button class="secondary" data-v294-close>← Zur Bibliothek</button></section>'+
 '<section class="panel v294-progress"><div><strong>'+stats.done+' / '+stats.all+' Dateien eingeordnet</strong>'+
 '<span>'+stats.pending+' noch offen · '+stats.supplementary+' als Zusatzmaterial markiert</span></div>'+
 '<progress value="'+stats.done+'" max="'+Math.max(1,stats.all)+'"></progress>'+
 '<div class="v294-filters"><label>Fach<select data-v294-filter="subject">'+
 subjects.map(s=>'<option value="'+esc(s)+'" '+(subject===s?'selected':'')+'>'+esc(s||'Alle Fächer')+'</option>').join('')+'</select></label>'+
 '<label>Jahrgang<select data-v294-filter="grade">'+grades.map(g=>
 '<option value="'+g+'" '+(grade===g?'selected':'')+'>'+esc(g||'Alle')+'</option>').join('')+'</select></label>'+
 '<label><input type="checkbox" data-v294-unreviewed '+(unreviewed?'checked':'')+'> Nur noch nicht bearbeitete</label></div>'+
 '<small>Deine Auswahl: '+done+' / '+total+' eingeordnet · für die aktuelle Ansicht '+queue.length+' Datei(en) in der Warteschlange</small></section>'+
 (x?'<section class="panel v294-card"><div class="v294-rowhead"><div><span class="eyebrow">DATEI '+(index+1)+' / '+queue.length+'</span>'+
 '<h3>'+esc(x.name)+'</h3><p>'+esc([x.subject||'Fach offen',x.grade?'Jg. '+x.grade:'Jahrgang offen',
 x.obj.sourceArchive||x.obj.source||''].filter(Boolean).join(' · '))+'</p>'+
 (x.obj.sourcePath?'<small>'+esc(x.obj.sourcePath)+'</small>':'')+
 '</div><div class="v294-actions"><button class="secondary" data-v294-prev '+(index===0?'disabled':'')+'>← Zurück</button>'+
 '<button class="secondary" data-v294-skip>Überspringen →</button></div></div>'+
 '<div class="v294-main"><section><h4>Dateivorschau</h4><div class="v294-preview" data-v294-preview>'+
 (x.ready?'Vorschau wird lokal geladen …':'Nur Katalogeintrag: Originaldatei in diesem Browser noch nicht verbunden.')+
 '</div>'+(x.ready?'<button class="text-button" data-v294-open>Original öffnen / herunterladen</button>':'')+
 '<div class="v294-dupes">'+(possiblePairs(x).length?'<strong>Mögliche weitere Fassung(en) – nicht automatisch löschen</strong>'+
 possiblePairs(x).map(y=>'<div>'+esc(y.reason)+' · '+esc(y.name)+
 '<button class="text-button" data-v294-jump="'+esc(y.key)+'">Ansehen</button></div>').join(''):
 '<small>Keine eindeutig identische Datei oder PDF-/Word-Paarung erkannt.</small>')+'</div></section>'+
 '<section><h4>1. Was ist es?</h4><div class="v294-choices">'+options(core.types,d.kind,'kind')+'</div>'+
 '<h4>2. Wie wird es genutzt?</h4><div class="v294-choices">'+options(core.uses,d.usage,'usage')+'</div>'+
 '<p class="microcopy">„Zusatzmaterial“ ist eine Nutzung, keine andere Dateiart. '+
 'Archiv bedeutet hier nur: für neue Planungen zurückstellen – keine Löschung bestehender Verknüpfungen.</p>'+
 '<button class="primary v294-save" data-v294-save '+(!d.usage?'disabled':'')+'>Speichern & nächste Datei → <kbd>Enter</kbd></button>'+
 '<small class="v294-shortcuts">Tastatur: 1–8 Materialart · K Kern · Z Zusatz · L Lehrkraft · A Archiv · Enter speichern · Esc schließen</small>'+
 '</section></div></section>':
 '<section class="panel v294-finished"><h3>✨ Diese Warteschlange ist geschafft!</h3>'+
 '<p>'+queue.length+' Dateien durchgesehen. Andere Jahrgänge oder „Alle“ auswählen, um weiterzumachen. '+
 'Dateien wurden nicht gelöscht.</p><button class="secondary" data-v294-close>Zur Bibliothek</button></section>')+'</div>';
}
function cleanupPreview(){
 previewToken++;
 if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl='';}
 previewKey='';
}
async function getFile(x){
 if(!x||!x.ready)return null;
 if(x.isCatalog)return await catalogEntryFileV17(x.obj);
 const v=(x.obj.variants||[]).find(v=>hasStoredFile(v));
 if(!v)return null;
 const record=await fileStoreGet(v.fileKey);
 if(!record?.blob)return null;
 return new File([record.blob],record.name||v.fileName||x.name,{type:record.blob.type||''});
}
async function showPreview(){
 if(!active)return;
 const x=current(),area=document.querySelector('[data-v294-preview]');
 if(!x||!area||previewKey===x.key)return;
 cleanupPreview();previewKey=x.key;
 const token=previewToken;
 if(!x.ready)return;
 try{
  const file=await getFile(x);
  if(!active||current()?.key!==x.key||token!==previewToken||!area.isConnected)return;
  area.replaceChildren();
  if(!file){area.textContent='Original derzeit nicht verfügbar.';return;}
  if(/\.(png|jpe?g|webp)$/i.test(file.name)){
   previewUrl=URL.createObjectURL(file);const img=document.createElement('img');
   img.src=previewUrl;img.alt='Vorschau: '+x.name;area.append(img);
  }else if(/\.pdf$/i.test(file.name)){
   previewUrl=URL.createObjectURL(file.type?file:new Blob([file],{type:'application/pdf'}));
   const frame=document.createElement('iframe');frame.title='PDF-Vorschau: '+x.name;frame.src=previewUrl;area.append(frame);
  }else if(/\.(txt|md)$/i.test(file.name)){
   const pre=document.createElement('pre');pre.textContent=(await file.text()).slice(0,5000);area.append(pre);
  }else area.textContent='Keine direkte Vorschau für diesen Dateityp. Über „Original öffnen“ herunterladen.';
 }catch(err){
  if(area.isConnected&&token===previewToken)area.textContent='Vorschau nicht verfügbar: '+(err.message||err);
 }
}
function change(field,value){
 const d=draft();if(!d)return;
 d[field]=value;
 for(const b of document.querySelectorAll('[data-v294-'+field+']')){
  const yes=b.dataset['v294'+field[0].toUpperCase()+field.slice(1)]===value;
  b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));
 }
 const save=document.querySelector('[data-v294-save]');
 if(save)save.disabled=!d.usage||saving;
}
async function commit(){
 if(saving)return;
 const x=current(),d=draft();if(!x||!d)return;
 core.validated(d.kind,d.usage);
 const oldHub=x.obj.hubV237?structuredClone(x.obj.hubV237):null,
  oldDecision=x.obj.hubV295?structuredClone(x.obj.hubV295):null;
 saving=true;
 try{
  x.obj.hubV237={...(x.obj.hubV237||{}),kind:d.kind};
  x.obj.hubV295={...(x.obj.hubV295||{}),usage:d.usage,
   reviewedAt:new Date().toISOString(),reviewSource:'material-triage'};
  if(x.isCatalog&&typeof persistCatalogV171==='function')await persistCatalogV171();
  await saveState();
  index++;chosen=null;cleanupPreview();render();
 }catch(err){
  if(oldHub===null)delete x.obj.hubV237;else x.obj.hubV237=oldHub;
  if(oldDecision===null)delete x.obj.hubV295;else x.obj.hubV295=oldDecision;
  if(x.isCatalog&&typeof persistCatalogV171==='function')await persistCatalogV171().catch(()=>{});
  throw err;
 }finally{saving=false;const btn=document.querySelector('[data-v294-save]');if(btn)btn.disabled=false;}
}
function move(delta){index=Math.max(0,Math.min(queue.length,index+delta));chosen=null;cleanupPreview();render();}
function jump(key){let idx=queue.indexOf(key);if(idx<0){queue.splice(index+1,0,key);idx=index+1;}index=idx;chosen=null;cleanupPreview();render();}
function start(){active=true;refill();modal=null;render();}
function close(){active=false;chosen=null;cleanupPreview();render();}
function keyboard(e){
 if(!active||modal||saving||e.altKey||e.ctrlKey||e.metaKey)return;
 if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)||e.target?.isContentEditable)return;
 const k=String(e.key||'').toUpperCase();
 if(k==='ESCAPE'){e.preventDefault();close();return;}
 const type=core.types.find(x=>x[2]===k),usage=core.uses.find(x=>x[2]===k);
 if(type&&current()){e.preventDefault();change('kind',type[0]);}
 else if(usage&&current()){e.preventDefault();change('usage',usage[0]);}
 else if(k==='ENTER'&&current()){e.preventDefault();void commit().catch(err=>alert('Einordnung nicht gespeichert: '+(err.message||err)));}
}
document.addEventListener('keydown',keyboard);
const originalMaterials=materialsView;
materialsView=function(){
 if(active)return triageView();
 const original=originalMaterials();
 const entry='<section class="panel v294-entry"><div><span class="eyebrow">MATERIALHUB AUFRÄUMEN</span>'+
 '<h3>⚡ Schnell einordnen</h3><p>Ein Material nach dem anderen: Vorschau, Art, Kern- oder Zusatzmaterial, weiter. '+
 'Mögliche PDF-/Word-Paare werden zur Prüfung angezeigt; nichts wird automatisch gelöscht.</p></div>'+
 '<button class="primary" data-v294-start>Sortiermodus starten →</button></section>';
 return original.replace('<div class="content-grid v237-hub">','<div class="content-grid v237-hub">'+entry);
};
const originalWire=wire;
wire=function(){
 originalWire();
 if(view!=='materials')return;
 document.querySelector('[data-v294-start]')?.addEventListener('click',start);
 if(!active){
  // Review status stays visible in the classic directory without taking over its actions.
  const map=new Map(all().map(x=>[x.key,x.obj]));
  for(const row of document.querySelectorAll('.v237-row')){
   const key=row.querySelector('[data-v237-edit]')?.dataset.v237Edit;
   const record=map.get(key),d=core.decision(record);
   if(!d.reviewed)continue;
   const holder=row.querySelector('.v237-flags');if(!holder)continue;
   const label=document.createElement('span');
   label.className='v294-reviewed';
   label.textContent='✓ Geprüft · '+(core.uses.find(x=>x[0]===d.usage)?.[1]||'Nutzung offen');
   holder.append(label);
  }
  return;
 }
 document.querySelectorAll('[data-v294-close]').forEach(b=>b.addEventListener('click',close));
 document.querySelector('[data-v294-prev]')?.addEventListener('click',()=>move(-1));
 document.querySelector('[data-v294-skip]')?.addEventListener('click',()=>move(1));
 document.querySelectorAll('[data-v294-kind]').forEach(b=>b.onclick=()=>change('kind',b.dataset.v294Kind));
 document.querySelectorAll('[data-v294-usage]').forEach(b=>b.onclick=()=>change('usage',b.dataset.v294Usage));
 document.querySelector('[data-v294-save]')?.addEventListener('click',()=>void commit().catch(err=>alert('Einordnung nicht gespeichert: '+(err.message||err))));
 document.querySelectorAll('[data-v294-jump]').forEach(b=>b.addEventListener('click',()=>jump(b.dataset.v294Jump)));
 document.querySelectorAll('[data-v294-filter]').forEach(el=>el.onchange=()=>{
  if(el.dataset.v294Filter==='subject')subject=el.value;
  else grade=Number(el.value)||0;
  refill();render();
 });
 document.querySelector('[data-v294-unreviewed]')?.addEventListener('change',e=>{
  unreviewed=e.target.checked;refill();render();
 });
 document.querySelector('[data-v294-open]')?.addEventListener('click',()=>{
  const x=current();if(!x)return;
  const show=canPreview(x),windowRef=show?window.open('','_blank'):null;
  void getFile(x).then(file=>{
   if(!file){windowRef?.close();alert('Originaldatei lokal nicht verfügbar.');return;}
   if(show&&windowRef){
    const url=URL.createObjectURL(file);
    windowRef.location.href=url;
    setTimeout(()=>URL.revokeObjectURL(url),180000);
   }else downloadBlob(file.name,file);
  }).catch(err=>{windowRef?.close();alert('Datei konnte nicht geöffnet werden: '+(err.message||err));});
 });
 void showPreview();
};
const originalPrompt=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
 const original=originalPrompt(l);
 const files=window.SchulcockpitWorksheetChoiceV276?.activeFiles?.(l)||[];
 const labels=files.map(f=>{
  const m=mat(f.materialId),catalog=(state.materialCatalog||[]).find(e=>e.catalogId===m?.catalogId);
  const role=m?.hubV295?.usage||catalog?.hubV295?.usage||'';
  return role?'- '+f.name+': '+(core.uses.find(x=>x[0]===role)?.[1]||role):null;
 }).filter(Boolean);
 return original+'\n\n## Priorität der Unterrichtsmaterialien\n'+
  'Nutze zuerst die für die Stunde gewählten REGULÄREN Materialien. '+
  'Zusatzmaterial ist optional, darf die Hauptarbeitsblätter nicht verdrängen und soll nur eingesetzt werden, '+
  'wenn es zeitlich und fachlich sinnvoll ist. Lehrkraftquellen sind nicht automatisch Schülerarbeitsblätter. '+
  'Archivfassungen nur nach ausdrücklicher Freigabe. Falls nur Zusatzmaterial vorliegt, '+
  'bitte um das reguläre Material statt damit eine künstlich komplizierte Stunde zu planen.\n'+
  (labels.length?'Aktuell im Materialhub eingeordnete aktive Dateien:\n'+labels.join('\n')+'\n':'');
};
if(typeof v184CatalogPromptEntries==='function'){
 const prevCatalogPrompt=v184CatalogPromptEntries;
 v184CatalogPromptEntries=function(cid,title){
  const original=prevCatalogPrompt(cid,title),byId=new Map((state.materialCatalog||[]).map(x=>[String(x.catalogId),x]));
  const annotated=original.split('\n').filter(line=>{
   const id=line.match(/^\s*-\s*ID\s+([^ ]+)\s+\|/)?.[1],e=byId.get(id);
   return e?.hubV295?.usage!=='archive';
  }).map(line=>{
   const id=line.match(/^\s*-\s*ID\s+([^ ]+)\s+\|/)?.[1],e=byId.get(id);
   const usage=e?.hubV295?.usage;
   return line+(usage?' | Verwendung: '+(core.uses.find(x=>x[0]===usage)?.[1]||usage):'');
  });
  return 'Materialrollen: Kernmaterial zuerst verwenden. Zusatzmaterial nur bei Bedarf, '+
   'Lehrkraftquellen nicht automatisch an Schüler:innen verteilen; Archiv nicht aktiv einplanen.\n'+
   annotated.join('\n');
 };
}
// Only explicit teacher choices may attach supplementary/teacher/archive
// material as a main worksheet in a newly imported lesson.
if(typeof v184DefaultChoice==='function'){
 const previousDefault=v184DefaultChoice;
 v184DefaultChoice=function(item,candidates,cid){
  const choice=previousDefault(item,candidates,cid);
  const match=candidates.find(c=>c.key===choice);
  const role=match?.m?.hubV295?.usage||match?.e?.hubV295?.usage;
  return ['supplement','teacher','archive'].includes(role)?'unresolved':choice;
 };
}
}
if(typeof window!=='undefined')window.SchulcockpitMaterialTriageV294={all,refill,byKey,core};
})();