/* V0.29.6 – self-made material editions and honest provenance.
 * Original file bytes, historical lessons, private data and catalog IDs intact. */
(function(){
'use strict';
const core=SC_MATERIAL_EVOLUTION_V296;
let draft=null,saving=false;
const allowed=/\.(pdf|docx?|png|jpe?g|webp|pptx?|txt|md)$/i;
const materialKinds=[...new Map([...SC_MATERIAL_TRIAGE_V294.types,
 ...SC_MATERIAL_TRIAGE_V294.legacyTypes].map(([id,label])=>[id,[id,label]])).values()];
function keyLabel(e){
 return e?.title||e?.fileName||'Material';
}
function sourceObj(key){
 if(key?.startsWith('m:'))return mat(key.slice(2));
 if(key?.startsWith('c:'))return (state.materialCatalog||[]).find(e=>e.catalogId===key.slice(2));
 return null;
}
function contextOf(key){
 const x=window.SchulcockpitMaterialTriageV294?.byKey?.(key);
 if(x)return {subject:x.subject,grade:x.grade};
 const e=sourceObj(key),h=e?.hubV237||{};
 return {subject:h.subject||'',grade:Number(h.grade)||0};
}
function begin(mode,opts={}){
 const ref=opts.sourceKey||'',loc=contextOf(ref),stored=sourceObj(ref)?.evolutionV296||{};
 draft={mode,lessonId:opts.lessonId||'',hint:opts.hint||'',sourceKey:ref,
  title:mode==='lesson'?(opts.hint||'Eigenes Arbeitsblatt'):
    mode==='tag'?keyLabel(sourceObj(ref)):
    mode==='library'?(keyLabel(sourceObj(ref))+' – eigene Fassung'):'',
  materialKind:sourceObj(ref)?.hubV237?.kind||'arbeitsblatt',
  subject:loc.subject||(mode==='lesson'?cls(lesson(opts.lessonId)?.classId)?.subject||'':''),
  grade:loc.grade||(mode==='lesson'?Number(String(cls(lesson(opts.lessonId)?.classId)?.name||'').match(/\d+/)?.[0])||0:0),
  files:[],roles:[],kind:stored.kind||'cosmetic',effort:stored.effort||'medium',
  note:stored.note||'',extraHints:new Set(),
  sources:new Set(mode==='tag'?(stored.sources||[]).map(x=>x.key).filter(Boolean):ref?[ref]:[])};
 modal={type:'materialEvolutionV296'};render();
}
function lessonSources(){
 const l=lesson(draft?.lessonId);if(!l)return [];
 return allResourceRowsV176(l).filter(r=>r.type==='print'&&v183IsActive(l,r.hint)&&
   resourceKeyV14(r.hint)!==resourceKeyV14(draft.hint)).slice(0,28).map(r=>({key:r.hint,label:r.hint}));
}
function librarySources(){
 const candidates=[...(state.materials||[]).map(m=>({key:'m:'+m.id,name:m.title||'Material',
    sub:m.hubV237?.subject||'',grade:Number(m.hubV237?.grade)||0})),
  ...(state.materialCatalog||[]).map(c=>({key:'c:'+c.catalogId,name:c.fileName||'Datei',
    sub:c.hubV237?.subject||'',grade:Number(c.hubV237?.grade)||0}))];
 const matched=candidates.filter(x=>
  (!draft.subject||x.sub===draft.subject)&&(!draft.grade||x.grade===Number(draft.grade)));
 const chosen=candidates.filter(x=>draft.sources.has(x.key));
 return [...new Map([...chosen,...matched.filter(x=>x.key!==draft.sourceKey).slice(0,50)].map(x=>[x.key,x])).values()]
  .map(x=>({key:x.key,label:x.name}));
}
function selector(options,value,attr){
 return '<select '+attr+'>'+options.map(([id,name])=>'<option value="'+esc(id)+'" '+
   (id===value?'selected':'')+'>'+esc(name)+'</option>').join('')+'</select>';
}
function form(){
 if(!draft)return '';
 const sources=draft.mode==='lesson'?lessonSources():librarySources(),
 sourceLabel=draft.mode==='lesson'?'Weitere Arbeitsblätter dieser Stunde, die deine neue Fassung ersetzt':
  'Aus diesen vorhandenen Materialien ist die neue Fassung entstanden';
 const sourceRows=sources.map(s=>{
  const checked=draft.mode==='lesson'?draft.extraHints.has(s.key):draft.sources.has(s.key);
  return '<label><input type="checkbox" data-v296-source="'+esc(s.key)+'" '+(checked?'checked':'')+'>'+
    '<span>'+esc(s.label)+'</span></label>';
 }).join('');
 const fileRows=draft.files.map((f,i)=>'<div class="v296-file"><strong>'+esc(f.name)+'</strong>'+
  '<label>Fassung'+selector(core.roles,draft.roles[i],'data-v296-role="'+i+'"')+'</label></div>').join('');
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-xwide v296-modal" data-modal-stop>'+
  '<header class="modal-header"><div><span class="eyebrow">MATERIAL ENTWICKELN · EIGENE ARBEIT SICHTBAR MACHEN</span>'+
  '<h2>'+esc(draft.mode==='lesson'?'Arbeitsblätter dieser Stunde verbessern':
  draft.mode==='library'?'Vorhandenes Material weiterentwickeln':draft.mode==='tag'?'Eigene Arbeit nachträglich kennzeichnen':'Eigenes Material anlegen')+'</h2></div>'+
  '<button class="icon-button" data-action="modal-close" aria-label="Schließen">×</button></header>'+
  '<div class="modal-body v296-form"><p class="microcopy">Beschreibe, was du selbst verändert hast. '+
  'Alle Originaldateien und bisherigen Unterrichtszuordnungen bleiben erhalten. '+
  'Nur bei einer Stundenersetzung wird die neue Standardfassung für diese Stunde aktiv.</p>'+
  '<label>Titel des gemeinsamen Materials<input data-v296-title maxlength="120" value="'+esc(draft.title)+'" placeholder="z. B. Halbschriftliche Division – mein Arbeitsblatt"></label>'+
  '<label>Materialart'+selector(materialKinds,draft.materialKind,'data-v296-material-kind')+'</label>'+ 
  '<div class="v296-grid"><label>Wie ist es entstanden?'+selector(core.kinds,draft.kind,'data-v296-kind')+'</label>'+
  '<label>Dein selbst eingeschätzter Aufwand'+selector(core.efforts,draft.effort,'data-v296-effort')+'</label></div>'+
  '<label>Was hast du verändert? (optional)<textarea data-v296-note rows="2" maxlength="500" placeholder="z. B. zwei ABs auf einer Seite zusammengefasst, Aufgaben vereinfacht">'+esc(draft.note)+'</textarea></label>'+
  (draft.mode!=='lesson'?'<div class="v296-grid"><label>Fach'+selector([['','Fach wählen'],['Mathematik','Mathematik'],['Religion','Religion']],draft.subject,'data-v296-subject')+'</label>'+
  '<label>Jahrgang'+selector([[0,'Jahrgang wählen'],...[5,6,7,8,9,10,11,12,13].map(x=>[x,String(x)])],Number(draft.grade),'data-v296-grade')+'</label></div>':'')+
  (sources.length?'<details class="v296-sources" '+(draft.kind==='merged'?'open':'')+'>'+
   '<summary>'+esc(sourceLabel)+' · '+(draft.mode==='lesson'?draft.extraHints.size:draft.sources.size)+' ausgewählt</summary>'+
   '<p class="microcopy">Quelle(n) nur vermerken; keine Datei aus der Bibliothek löschen.'+
   (draft.mode==='lesson'?' Zusätzliche ausgewählte ABs werden ausschließlich in dieser Stunde ausgeblendet.':'')+'</p>'+
   '<div class="v296-source-list">'+sourceRows+'</div></details>':'')+
  (draft.mode==='tag'?'<p class="microcopy"><strong>Vorhandene Dateien bleiben erhalten:</strong> '+
   ((sourceObj(draft.sourceKey)?.variants||[]).map(v=>esc(v.fileName||'Datei')+' ('+esc(v.type||'Standard')+')').join(' · ')||'Keine Datei hinterlegt')+
   '. Du musst nichts erneut hochladen.</p>':
   '<label class="upload-button v296-upload">Dateien hinzufügen (Standard und z. B. Inklusion gleichzeitig)'+
   '<input type="file" multiple data-v296-files accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.ppt,.pptx,.txt,.md" hidden></label>'+
   (draft.files.length?'<div class="v296-files"><h3>'+draft.files.length+' Fassung(en) ausgewählt</h3>'+
   fileRows+'</div>':'<p class="microcopy">Du kannst mehrere Dateien auf einmal auswählen und anschließend jeder eine Rolle zuweisen.</p>'))+
  '<div class="v296-actions"><button class="secondary" data-action="modal-close">Abbrechen</button>'+
   '<button class="primary" data-v296-save '+(!draft.files.length&&draft.mode!=='tag'?'disabled':'')+'>'+
   (draft.mode==='tag'?'Einordnung speichern ✓':'Material und Varianten speichern →')+'</button></div>'+
  '</div></section></div>';
}
async function commit(){
 if(saving||!draft)return;
 const d=draft,files=d.files;
 if(d.mode!=='tag')core.validate(files,d);
 else if(!core.kinds.some(k=>k[0]===d.kind)||!core.efforts.some(e=>e[0]===d.effort))
  throw Error('Art der Verbesserung und Aufwand auswählen.');
 if(!d.title.trim())throw Error('Bitte einen Materialtitel eingeben.');
 if(files.some(f=>!allowed.test(f.name)||f.size>30*1024*1024)||
   files.reduce((n,f)=>n+f.size,0)>160*1024*1024)throw Error('Unzulässiger Dateityp oder zu große Dateien (max. 30 MB pro Datei, 160 MB gesamt).');
 saving=true;
 try{
  if(!materialKinds.some(x=>x[0]===d.materialKind))throw Error('Bitte eine gültige Materialart auswählen.');
  if(d.mode==='lesson'){
   const l=lesson(d.lessonId);if(!l||v182IsHeld(l))throw Error('Diese Stunde ist bereits gehalten; nutze den Materialhub für neue Fassungen.');
   await window.SchulcockpitWorksheetChoiceV276.replace(l,d.hint,files,{
    groupedV296:true,title:d.title.trim(),kind:d.kind,effort:d.effort,note:d.note,
    roles:d.roles,materialKind:d.materialKind,extraHints:[...d.extraHints]});
  }else if(d.mode==='tag'){
   const m=sourceObj(d.sourceKey);
   if(!m?.id)throw Error('Das vorhandene Material wurde nicht gefunden.');
   const previous={title:m.title,hubV237:m.hubV237?structuredClone(m.hubV237):null,
    evolutionV296:m.evolutionV296?structuredClone(m.evolutionV296):null};
   try{
    if(!['Mathematik','Religion'].includes(d.subject)||!(Number(d.grade)>=5&&Number(d.grade)<=13))
     throw Error('Bitte Fach und Jahrgang festlegen.');
    m.title=d.title.trim().slice(0,120);
    m.hubV237={...(m.hubV237||{}),subject:d.subject,grade:Number(d.grade),kind:d.materialKind};
    m.evolutionV296={...(m.evolutionV296||{}),kind:d.kind,effort:d.effort,note:d.note.trim().slice(0,500),
      sources:core.sourceRecords(state.materials,state.materialCatalog,[...d.sources]),
      createdAt:m.evolutionV296?.createdAt||new Date().toISOString()};
    await saveState();
   }catch(err){
    m.title=previous.title;
    if(previous.hubV237)m.hubV237=previous.hubV237;else delete m.hubV237;
    if(previous.evolutionV296)m.evolutionV296=previous.evolutionV296;else delete m.evolutionV296;
    throw err;
   }
  }else{
   if(!['Mathematik','Religion'].includes(d.subject)||!(Number(d.grade)>=5&&Number(d.grade)<=13))
    throw Error('Bitte Fach und Jahrgang festlegen.');
   const originalMaterials=state.materials.slice(),addedKeys=[];
   try{
    const m={id:uid('mat'),title:d.title.trim().slice(0,120),kind:'file',resourceType:'print',
     source:'Selbst entwickeltes Unterrichtsmaterial',
     hubV237:{subject:d.subject,grade:Number(d.grade),kind:d.materialKind,status:'pool',
      note:'Selbst entwickelt / überarbeitet'},
     hubV295:{usage:'core',reviewedAt:new Date().toISOString(),reviewSource:'material-evolution'},
     evolutionV296:{kind:d.kind,effort:d.effort,note:d.note.trim().slice(0,500),
      sources:core.sourceRecords(state.materials,state.materialCatalog,[...d.sources]),
      createdAt:new Date().toISOString()},
     variants:[],assignments:[],improvementFlags:[]};
    for(let i=0;i<files.length;i++){
     const f=files[i],v={id:uid('var'),type:d.roles[i],label:variantLabelV15(d.roles[i])||d.roles[i],
       fileName:f.name,fileKey:'material-evolution-v296-'+m.id+'-'+uid('blob'),available:true};
     await fileStorePut(v.fileKey,f);storedFileKeys.add(v.fileKey);addedKeys.push(v.fileKey);
     m.variants.push(v);
    }
    m.primaryVariantIdV183=m.variants.find(v=>v.type==='standard').id;
    state.materials.push(m);await saveState();
   }catch(err){
    state.materials=originalMaterials;
    for(const key of addedKeys){try{await fileStoreDelete(key);}catch{}storedFileKeys.delete(key);}
    throw err;
   }
  }
  draft=null;modal=null;render();
 }finally{saving=false;}
}
const beforeModal=modalHtml;
modalHtml=function(){return modal?.type==='materialEvolutionV296'?form():beforeModal();};
const beforeRow=resourceRowV14;
resourceRowV14=function(l,r){
 const html=beforeRow(l,r);
 if(!l||r?.type!=='print'||v182IsHeld(l))return html;
 const id=l.id+'|'+encodeURIComponent(r.hint);
 return html+'<button type="button" class="text-button v296-develop" data-v296-lesson="'+esc(id)+'">'+
 '✨ Eigene überarbeitete Fassung(en) hinterlegen</button>';
};
const oldWire=wire;
wire=function(){
 oldWire();
 document.querySelectorAll('[data-v296-lesson]').forEach(b=>b.addEventListener('click',()=>{
  const raw=b.dataset.v296Lesson,sep=raw.indexOf('|');
  if(sep<0)return;
  begin('lesson',{lessonId:raw.slice(0,sep),hint:decodeURIComponent(raw.slice(sep+1))});
 }));
 if(modal?.type!=='materialEvolutionV296')return;
 document.querySelector('[data-v296-files]')?.addEventListener('change',e=>{
  draft.files=[...(e.target.files||[])];draft.roles=draft.files.map((f,i)=>core.guessRole(f.name,i));render();
 });
 document.querySelectorAll('[data-v296-role]').forEach(e=>e.addEventListener('change',()=>{
  draft.roles[Number(e.dataset.v296Role)]=e.value;
 }));
 document.querySelector('[data-v296-title]')?.addEventListener('input',e=>{draft.title=e.target.value;});
 document.querySelector('[data-v296-kind]')?.addEventListener('change',e=>{draft.kind=e.target.value;});
 document.querySelector('[data-v296-material-kind]')?.addEventListener('change',e=>{draft.materialKind=e.target.value;});
 document.querySelector('[data-v296-effort]')?.addEventListener('change',e=>{draft.effort=e.target.value;});
 document.querySelector('[data-v296-note]')?.addEventListener('input',e=>{draft.note=e.target.value;});
 document.querySelector('[data-v296-subject]')?.addEventListener('change',e=>{draft.subject=e.target.value;});
 document.querySelector('[data-v296-grade]')?.addEventListener('change',e=>{draft.grade=Number(e.target.value)||0;});
 document.querySelectorAll('[data-v296-source]').forEach(e=>e.addEventListener('change',()=>{
  const set=draft.mode==='lesson'?draft.extraHints:draft.sources;
  if(e.checked)set.add(e.dataset.v296Source);
  else set.delete(e.dataset.v296Source);
 }));
 document.querySelector('[data-v296-save]')?.addEventListener('click',async e=>{
  e.currentTarget.disabled=true;
  try{await commit();}
  catch(err){alert('Material konnte nicht gespeichert werden: '+(err.message||err));if(e.currentTarget.isConnected)e.currentTarget.disabled=false;}
 });
};
function badgeFor(record){
 const label=core.badge(record);
 if(!label)return null;
 const b=document.createElement('span');b.className='v296-badge v296-'+record.evolutionV296.kind;
 b.textContent=label.label;return {b,label};
}
const oldRender=render;
render=function(){
 oldRender();
 if(view==='materials'&&modal?.type!=='materialEvolutionV296'){
  const container=document.querySelector('.v237-import-buttons');
  if(container&&!container.querySelector('[data-v296-new]')){
   const button=document.createElement('button');button.type='button';button.className='primary';
   button.dataset.v296New='';button.textContent='✨ Eigenes Material erstellen';
   button.onclick=()=>begin('new');container.append(button);
  }
  for(const row of document.querySelectorAll('.v237-row')){
   const key=row.querySelector('[data-v237-edit]')?.dataset.v237Edit;
   const src=sourceObj(key),holder=row.querySelector('.v237-row-actions');
   if(!src||!holder)continue;
   if(!holder.querySelector('[data-v296-library]')){
    const btn=document.createElement('button');btn.type='button';btn.className='text-button';
    btn.dataset.v296Library=key;btn.textContent='✨ Weiterentwickeln';
    btn.onclick=()=>begin('library',{sourceKey:key});holder.append(btn);
   }
   if(key?.startsWith('m:')&&!holder.querySelector('[data-v296-tag]')){
    const eligible=src.evolutionV296||/eigene|eigenes|ersatzarbeitsblatt|überarbeitet|selbst/i.test(src.source||'')||
      src.hubV295?.reviewSource==='lesson-worksheet';
    if(eligible){
     const tag=document.createElement('button');tag.type='button';tag.className='text-button';
     tag.dataset.v296Tag=key;tag.textContent=src.evolutionV296?'🎨 Herkunft ändern':'🎨 Eigene Arbeit kennzeichnen';
     tag.onclick=()=>begin('tag',{sourceKey:key});holder.append(tag);
    }
   }
   const evolution=key?.startsWith('m:')?src:state.materials.find(m=>m.catalogId===src.catalogId);
   if(!evolution?.evolutionV296)continue;
   const label=badgeFor(evolution),file=row.querySelector('.v237-file');
   if(label&&file&&!file.querySelector('.v296-badge')){
    const d=document.createElement('div');d.className='v296-badge-line';d.append(label.b);
    const effort=document.createElement('small');effort.textContent='Aufwand: '+label.label.effort+
      ' · Fassungen: '+label.label.variants.join(', ');
    d.append(effort);file.append(d);
   }
  }
  const own=(state.materials||[]).filter(m=>m.evolutionV296);
  if(own.length&&!document.querySelector('.v296-stats')){
   const first=document.querySelector('.v237-hub .v294-entry')||document.querySelector('.v237-hub .v237-hero');
   if(first){
    const bar=document.createElement('div');bar.className='v296-stats';
    bar.textContent='✨ '+own.length+' eigene Weiterentwicklungen · '+
     own.filter(m=>m.evolutionV296.kind==='original').length+' neu entwickelte Materialien · '+
     own.filter(m=>(m.variants||[]).some(v=>v.type==='support')).length+' mit Förderfassung';
    first.insertAdjacentElement('afterend',bar);
   }
  }
 }
 const tag=document.querySelector('.brand small');if(tag)tag.textContent=state.settings.schoolYear+' · V0.29.6';
};
if(typeof window!=='undefined')window.SchulcockpitMaterialEvolutionV296={begin,core};
})();