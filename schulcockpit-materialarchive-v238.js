/* V0.23.8 — Schuljahres-Themenarchive indexieren, Original-ZIP nur einmal lokal speichern. */
(function(){
'use strict';
const LIMIT=2800;
function plain(s){return String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();}
function junk(path,dir){const s=String(path||'').replace(/\\/g,'/');return !!dir||!s||s.startsWith('__MACOSX/')||s.startsWith('/')||s.split('/').some(p=>p==='..'||p.startsWith('.'))||/\.DS_Store$/i.test(s);}
function schoolYear(path){const folders=String(path||'').split('/').slice(0,-1);for(const p of folders){const m=p.match(/schuljahr\s*(20\d{2})[ -_./]+(20\d{2})/i);if(m&&Number(m[2])===Number(m[1])+1)return m[1]+'/'+m[2].slice(-2);}return '';}
function folderTopic(path){const p=String(path||'').split('/');const i=p.findIndex(s=>/schuljahr\s*20\d{2}[ -_./]+20\d{2}/i.test(s));return (i>=0?p.slice(i+1,-1):p.slice(1,-1)).join(' › ')||'Allgemeines Reihenmaterial';}
function level(path){const name=String(path||'').split('/').pop()||'',n=plain(name);if(/\binkl\b|inklusion/.test(n))return 'Inklusion';if(/knobel|forder|challenge/.test(n))return 'Forderung';if(/g\s*\+\s*e/i.test(name))return 'G + E';if(/(^|[\s_-])g(?:[\s._-]|$)/i.test(name))return 'G';if(/(^|[\s_-])e(?:[\s._-]|$)/i.test(name))return 'E';return '';}
function fileType(path){
 const n=plain(path),base=plain(String(path||'').split('/').pop());
 if(/losung|loesung|lo.{0,5}sung|musterlosung|erwartungshorizont|bewertungsraster|korrekturhilfe/.test(n))return 'loesung';
 if(/inklusion|inkl\b/.test(n)&&/klassenarbeit|arbeit nr|klausur|arbeit\b/.test(n))return 'inklusion';
 if(/klassenarbeit|klausur|lernkontrolle|arbeit nr/.test(n))return 'referenzarbeit';
 if(/themenkarte|reihenplanung|sequenzplanung|stoffverteilungsplan/.test(base))return 'reihenplanung';
 if(/ersatzleistung|trauerglas|lapbook|kreativleistung/.test(n))return 'ersatzleistung';
 if(/mathematische werkstatt|mathewerkstatt|stationenlernen|lerntheke/.test(n))return 'werkstatt';
 if(/arbeitsblatt|uebungsblatt|ubungsblatt|fachbegriffe|grundaufgaben|knobel|wiederholungsaufgaben|rechenregeln/.test(base))return 'arbeitsblatt';
 if(/\.(pptx?|potx)$/i.test(path))return 'praesentation';
 return 'sonstiges';
}
function summarize(rows){
 const files=rows.filter(x=>!junk(x.path,x.dir)),years=[...new Set(files.map(x=>schoolYear(x.path)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
 const newest=years[0]||'';
 const entries=files.map(x=>{const y=schoolYear(x.path),kind=fileType(x.path);return {...x,year:y,preferred:!newest||!y||y===newest,kind,topic:folderTopic(x.path),level:level(x.path),reference:['referenzarbeit','inklusion'].includes(kind)};});
 let repetitions=0;const fingerprints=new Set();
 // First keep the latest edition, then one representative of each older distinct file.
 const ranked=entries.map((x,i)=>({x,i})).sort((a,b)=>{
   if(a.x.preferred!==b.x.preferred)return a.x.preferred?-1:1;
   return b.x.year.localeCompare(a.x.year);
 });
 for(const {x} of ranked){
   const key=x.crc!=null&&x.size!=null?x.crc+':'+x.size:'';
   x.extraFromOlder=!x.preferred&&(!key||!fingerprints.has(key));
   if(key){if(fingerprints.has(key))repetitions++;else fingerprints.add(key);}
 }
 return {entries,years:years.map(y=>({year:y,count:entries.filter(x=>x.year===y).length})),newest,repetitions,technical:rows.length-files.length,preferred:entries.filter(x=>x.preferred).length,extras:entries.filter(x=>x.extraFromOlder).length};
}
function infer(zipName,path,folder=''){
 const parts=folder.split('|'),raw=zipName+' '+path;
 let subject=['Mathematik','Religion'].includes(parts[0])?parts[0]:/religion/i.test(raw)?'Religion':/mathe|grundrechenarten|geometrie|bruche|statistik/i.test(raw)?'Mathematik':'';
 let grade=Number(parts[1])||0;
 const m=path.match(/(?:^|\/)(?:klasse\s*0?|jahrgang\s*0?|jg\s*0?|0?)(1[0-3]|[5-9])[a-z]?(?=\/|$)/i);
 if(!grade&&m)grade=Number(m[1]);
 if(!grade&&subject==='Mathematik'&&/grundrechenarten i und ii|grundrechenarten i & ii/i.test(raw))grade=5;
 return {subject,grade:grade>=5&&grade<=13?grade:0};
}
if(typeof module!=='undefined'&&module.exports){module.exports={plain,junk,schoolYear,folderTopic,level,fileType,summarize,infer};return;}
let pending=null,busy=false;
async function stage(files){
 if(typeof JSZip==='undefined')throw Error('ZIP-Bibliothek nicht geladen.');
 const plans=[];
 for(const file of files){
  if(!/\.zip$/i.test(file.name))continue;
  const zip=await JSZip.loadAsync(file),rows=[];let total=0;
  for(const [path,e] of Object.entries(zip.files)){
   const size=e._data?.uncompressedSize;
   if(!e.dir&&Number.isFinite(size)){total+=size;if(total>1800*1024*1024)throw Error('Über 1,8 GB entpackte Daten. Bitte kleinere Themen-ZIPs verwenden.');}
   rows.push({path,dir:!!e.dir,crc:e._data?.crc32??null,size:size??null});
   if(rows.length>LIMIT*2+1000)throw Error('Zu viele Archivbestandteile. Bitte aufteilen.');
  }
  const summary=summarize(rows);
  if(!summary.entries.length||summary.entries.length>LIMIT)throw Error('Das ZIP hat keine oder zu viele Unterrichtsdateien (max. '+LIMIT+').');
  const folder=document.querySelector('[data-v237-folder].active')?.dataset.v237Folder||'';
  plans.push({file,summary,context:infer(file.name,summary.entries[0].path,folder)});
 }
 if(!plans.length)throw Error('Bitte Themen-ZIPs auswählen.');
 pending=plans;modal={type:'v238Preview'};render();
}
function opts(arr,current,attr,placeholder){
 return '<select '+attr+'><option value="">'+placeholder+'</option>'+arr.map(([v,t])=>
  '<option value="'+esc(String(v))+'" '+(String(v)===String(current)?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select>';
}
function preview(){
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-xwide v238-modal" data-modal-stop>'
 +'<header class="modal-header"><div><span class="eyebrow">THEMEN-ZIP SORTIEREN</span><h2>Schuljahresfassungen automatisch erkennen</h2></div><button class="icon-button" data-action="modal-close">×</button></header>'
 +'<div class="modal-body"><p>Das aktuellste Schuljahr wird der bevorzugte Materialpool, ältere Fassungen bleiben als Archiv zugänglich. Alles bleibt lokal. Keine Datei wird automatisch als Unterrichts- oder Klassenarbeitstermin eingeplant.</p>'
 +pending.map((p,i)=>{const s=p.summary;
  return '<section class="v238-preview"><h3>'+esc(p.file.name)+'</h3><div class="v238-counts"><strong>'+s.entries.length+' echte Dateien</strong><span>'+s.preferred+' bevorzugt</span>'
   +'<span>'+(s.entries.length-s.preferred)+' ältere Fassungen</span><span>'+s.extras+' zusätzliche ältere Varianten</span><span>'+s.technical+' technische ZIP-Einträge ignoriert</span>'
   +'<span>'+(s.repetitions||0)+' übereinstimmende Prüfsummen/Größen (nicht gelöscht)</span></div>'
   +'<div class="v237-form"><label>Fach'+opts([['Mathematik','Mathematik'],['Religion','Religion']],p.context.subject,'data-v238-subject="'+i+'"','Fach auswählen')+'</label>'
   +'<label>Jahrgang'+opts([5,6,7,8,9,10,11,12,13].map(g=>[g,'Klasse '+g]),p.context.grade,'data-v238-grade="'+i+'"','Jahrgang auswählen')+'</label></div>'
   +'<p>Bevorzugter Ordner: <strong>'+esc(s.newest||'keine Schuljahresordner')+'</strong></p>'
   +'<div class="v238-years">'+s.years.map(y=>'<span>'+esc(y.year)+': '+y.count+'</span>').join('')+'</div>'
   +'<details><summary>Beispiele aus den Unterordnern ansehen</summary><div class="v238-samples">'
   +s.entries.slice(0,22).map(e=>'<p>'+esc(e.path)+' <small>'+esc(e.kind)+(e.preferred?' · bevorzugt':' · archiviert')+'</small></p>').join('')
   +'</div></details></section>';
 }).join('')
 +'<p class="microcopy">Das ZIP wird nur einmal in IndexedDB gespeichert. Einzeldateien bleiben darin und werden nur bei Bedarf geöffnet. Ältere Prüfungen gelten als Referenzen, nicht als neue Klassenarbeiten. Für große Archive muss ausreichend Browserspeicher frei sein.</p>'
 +'<div class="v237-actions"><button class="secondary" data-action="modal-close">Abbrechen</button><button class="primary" data-v238-commit>Archiv einsortieren</button></div></div></section></div>';
}
function indexEntry(plan,row){
 const file=plan.file,c=plan.context,topic=file.name.replace(/\.zip$/i,'').replace(/^\d+\s*/,'').trim();
 const old=(state.materialCatalog||[]).find(e=>plain(e.sourceArchive)===plain(file.name)&&plain(e.sourcePath)===plain(row.path));
 const e=old||{catalogId:uid('cat-archive'),fileName:row.path.split('/').pop(),sourceArchive:file.name,sourcePath:row.path,
  courseLabel:c.subject+' '+c.grade,sequenceTitle:topic,scope:row.preferred?'sequence_pool':'teacher_reference',
  variantType:'standard',resourceType:row.reference||row.kind==='loesung'?'teacher':'print',
  localFileKey:'',disposition:''};
 const h=e.hubV237||{};
 e.hubV237={...h,subject:h.subject||c.subject,grade:h.grade||c.grade,kind:h.kind||row.kind,status:h.status||'pool'};
 e.hubV238={...(e.hubV238||{}),isPreferred:row.preferred,sourceYear:row.year,
   topicPath:row.topic,level:row.level,archiveTopic:topic,referenceExam:row.reference,
   extraFromOlder:!!row.extraFromOlder,
   uncompressedSize:row.size||0,crc32:row.crc??null};
 return {entry:e,isNew:!old};
}
async function storeOne(plan){
 const file=plan.file,prev=state.materialCatalogArchives?.[file.name];
 if(prev&&Number(prev.size)!==file.size)throw Error('Ein anderes Archiv heißt ebenfalls „'+file.name+'“. Bitte umbenennen.');
 if(prev&&!prev.smartV238)throw Error('„'+file.name+'“ ist bereits im alten Religionskatalog verbunden. Bitte den bisherigen Quellarchiv-Import verwenden.');
 const oldCatalog=clone(state.materialCatalog||[]),oldArchives=clone(state.materialCatalogArchives||{});
 const key=prev?.fileKey||'topic-zip-'+uid('archive');let newlyStored=false;
 try{
  if(!prev){await fileStorePut(key,file);newlyStored=true;}
  state.materialCatalog=state.materialCatalog||[];
  let added=0;
  for(const item of plan.summary.entries){const r=indexEntry(plan,item);if(r.isNew){state.materialCatalog.push(r.entry);added++;}}
  state.materialCatalogArchives=state.materialCatalogArchives||{};
  state.materialCatalogArchives[file.name]={...prev,fileKey:key,size:file.size,linkedAt:new Date().toISOString(),
    matched:plan.summary.entries.length,total:plan.summary.entries.length,activated:0,smartV238:true,newestYear:plan.summary.newest};
  await persistCatalogV171();await saveState();
  return {name:file.name,added,total:plan.summary.entries.length};
 }catch(err){
  state.materialCatalog=oldCatalog;state.materialCatalogArchives=oldArchives;
  try{await persistCatalogV171();await saveState();}catch(rollback){console.error('Archiv-Rollback fehlgeschlagen',rollback);}
  if(newlyStored)try{await fileStoreDelete(key);}catch(rollback){console.warn('Unbenutztes ZIP konnte nicht entfernt werden',rollback);}
  throw err;
 }
}
async function commit(){
 if(busy)return;
 for(const p of pending)if(!['Mathematik','Religion'].includes(p.context.subject)||Number(p.context.grade)<5||Number(p.context.grade)>13)
   throw Error('Bitte für jedes ZIP Fach und Jahrgang auswählen.');
 busy=true;
 try{
  const out=[];
  for(const p of pending)out.push(await storeOne(p));
  pending=null;modal=null;render();
  alert('Themen-ZIPs einsortiert:\n'+out.map(x=>x.name+': '+x.total+' Einträge, davon '+x.added+' neu.').join('\n')
    +'\nNeueste Materialien unter Fach/Jahrgang, ältere Varianten unter „Fassungen → Ältere Fassungen“.');
 }finally{busy=false;}
}
async function promote(key){
 const e=(state.materialCatalog||[]).find(x=>'c:'+x.catalogId===key);
 if(!e?.hubV238)return;
 const old=!!e.hubV238.promoted;e.hubV238.promoted=!old;
 try{await persistCatalogV171();await saveState();render();}
 catch(err){e.hubV238.promoted=old;throw err;}
}
const beforeCatalog=v184CurrentCourseCatalog;
v184CurrentCourseCatalog=function(cid){
 return beforeCatalog(cid).filter(e=>!e.hubV238||(
   (e.hubV238.isPreferred!==false||e.hubV238.promoted)&&(!e.hubV238.referenceExam||e.hubV238.promoted)));
};
const beforeMatch=v184CourseMatchCatalog;
v184CourseMatchCatalog=function(e,cid){
 if(e?.hubV238&&((e.hubV238.isPreferred===false&&!e.hubV238.promoted)||(e.hubV238.referenceExam&&!e.hubV238.promoted)))return false;
 return beforeMatch(e,cid);
};
const beforeModal=modalHtml;
modalHtml=function(){return modal?.type==='v238Preview'?preview():beforeModal();};
const beforeWire=wire;
wire=function(){
 beforeWire();
 document.getElementById('v238-smart-upload')?.addEventListener('change',e=>stage([...e.target.files]).catch(err=>alert('Themen-ZIP konnte nicht geprüft werden: '+(err.message||err))));
 document.querySelectorAll('[data-v238-subject]').forEach(el=>el.onchange=()=>{pending[Number(el.dataset.v238Subject)].context.subject=el.value;});
 document.querySelectorAll('[data-v238-grade]').forEach(el=>el.onchange=()=>{pending[Number(el.dataset.v238Grade)].context.grade=Number(el.value)||0;});
 document.querySelector('[data-v238-commit]')?.addEventListener('click',e=>{
  e.currentTarget.disabled=true;e.currentTarget.textContent='Original-ZIP lokal speichern …';
  commit().catch(err=>{alert('Archivimport nicht abgeschlossen: '+(err.message||err));render();});
 });
 document.querySelectorAll('[data-v238-promote]').forEach(el=>el.onclick=()=>promote(el.dataset.v238Promote).catch(err=>alert(err.message||err)));
 if(modal?.type==='v238Preview')document.querySelectorAll('[data-action="modal-close"]').forEach(b=>b.addEventListener('click',()=>{pending=null;},{once:true}));
};
const beforeRender=render;
render=function(){beforeRender();const e=document.querySelector('.brand small');if(e)e.textContent=state.settings.schoolYear+' · V0.23.8';};
})();