/* Schulcockpit V0.23.9 – selektiver, lokaler Klassenordnerimport ohne Gigabyte-Kopien.
   FileList-Analyse ausschließlich Metadaten, erst bestätigte Auswahl als IndexedDB-Blobs. */
(function(){
'use strict';
const MB=1024*1024;
const TYPES=[
 ['arbeitsblatt','Arbeitsblätter'],['werkstatt','Mathewerkstatt / Stationen'],
 ['reihenplanung','Reihenplanungen'],['loesung','Lösungen / Erwartungshorizonte'],
 ['praesentation','Präsentationen'],['quelle','Quellen'],
 ['referenzarbeit','Ältere Klassenarbeiten'],['inklusion','Inklusionsarbeiten'],
 ['ersatzleistung','Ersatzleistungen'],['sonstiges','Andere Unterrichtsdateien']
];
const EXT=/\.(?:pdf|doc|docx|odt|ppt|pptx|potx|xls|xlsx|ods|png|jpe?g|webp|gif|txt|rtf|mp3|mp4|ggb|key|pages|numbers|notebook)$/i;
function clean(s){return String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();}
function reject(path){
 const s=String(path||'').replace(/\\/g,'/');
 const leaf=s.split('/').pop()||'';
 if(!s||!EXT.test(s)||s.startsWith('__MACOSX/')||s.split('/').some(p=>p==='..'||p.startsWith('.')||p.startsWith('._')))return true;
 return /^(?:thumbs\.db|desktop\.ini)$/i.test(leaf);
}
function yearIn(path){
 const parts=String(path||'').replace(/\\/g,'/').split('/').slice(0,-1);
 for(const p of parts){
   let m=p.match(/(?:schuljahr(?:gang)?|sj)\s*[:._ -]*(20\d{2})[. _\/-]+(20\d{2}|\d{2})(?!\d)/i);
   if(!m)continue;
   const y=Number(m[1]),end=Number(m[2].length===2?m[1].slice(0,2)+m[2]:m[2]);
   if(end===y+1)return String(y)+'/'+String(end).slice(-2);
 }
 return '';
}
function topicOf(path){
 const dirs=String(path||'').replace(/\\/g,'/').split('/').filter(Boolean);
 if(dirs.length<3)return 'Allgemeine Materialien';
 const root=dirs[0],first=dirs[1]||'';
 if(/(?:schuljahr|^sj\s*20)/i.test(first))return root;
 return first;
}
function typeOf(path){
 const n=clean(path),base=clean(String(path||'').split('/').pop());
 if(/losung|loesung|lo.{0,5}sung|erwartungshorizont|bewertungsraster|musterlosung|korrekturhilfe/.test(n))return 'loesung';
 if(/inklusion|inkl\b|le arbeit|klassenarbeit le/.test(n)&&/arbeit|klausur|test|leistung/.test(n))return 'inklusion';
 if(/klassenarbeit|klausur|lernkontrolle|lernerfolgskontrolle|arbeit nr/.test(n))return 'referenzarbeit';
 if(/themenkarte|reihenplanung|sequenzplanung|stoffverteilungsplan|jahresplan/.test(base))return 'reihenplanung';
 if(/ersatzleistung|trauerglas|lapbook|kreativleistung/.test(n))return 'ersatzleistung';
 if(/mathematische werkstatt|mathewerkstatt|stationenlernen|lerntheke/.test(n))return 'werkstatt';
 if(/arbeitsblatt|uebungsblatt|ubungsblatt|aufgabenblatt|\bab \d|rechenregeln|knobel|grundaufgaben/.test(base))return 'arbeitsblatt';
 if(/\.(pptx?|potx|key)$/i.test(path))return 'praesentation';
 if(/quelle|hintergrund|sachtext|infotext/.test(n))return 'quelle';
 return 'sonstiges';
}
function analyze(input){
 const rows=[],seen=new Map();let scanned=0,ignored=0,bytes=0;
 for(const f of input){
   scanned++;
   const path=String(f.webkitRelativePath||f.relativePath||f.path||f.name||'').replace(/\\/g,'/');
   if(reject(path)||!f.size){ignored++;continue;}
   const topic=topicOf(path),year=yearIn(path);
   const x={file:f,path,topic,year,type:typeOf(path),size:Number(f.size)||0,name:path.split('/').pop()};
   rows.push(x);bytes+=x.size;
   if(year&&(year.slice(0,4)>(seen.get(topic)||'')))seen.set(topic,year.slice(0,4));
 }
 const examNewest=new Map();
 for(const x of rows){if(!['referenzarbeit','inklusion'].includes(x.type)||!x.year)continue;
   if(x.year>(examNewest.get(x.topic)||''))examNewest.set(x.topic,x.year);
 }
 for(const x of rows){
   x.latest=!x.year||x.year.slice(0,4)===(seen.get(x.topic)||'');
   x.timeless=!x.year;
   x.reference=['referenzarbeit','inklusion'].includes(x.type);
   x.examRecommended=x.reference&&!!x.year&&x.year===examNewest.get(x.topic);
   x.key=x.topic+'|'+clean(x.name)+'|'+x.size;
   // Older files are only candidates, not proof of distinct content.
   x.olderCandidate=!x.latest;
 }
 return {rows,scanned,ignored,bytes,topics:[...new Set(rows.map(x=>x.topic))].sort((a,b)=>a.localeCompare(b,'de')),
   newestByTopic:Object.fromEntries([...seen].map(([topic,year])=>[topic,year+'/'+String(Number(year)+1).slice(-2)]))};
}
function proposed(x,o){
 if(o.topics&&!o.topics.includes(x.topic))return false;
 if(x.reference){if(!o.includeExams)return false;
   if(x.examRecommended)return true; // latest available reference exam even if topic's newest year has no exam
 }
 if(x.timeless)return !!o.includeTimeless;
 if(x.latest)return true;
 return !!o.includeOlder;
}
function stats(rows){
 return rows.reduce((a,x)=>{a.count++;a.bytes+=x.size;a.types[x.type]=(a.types[x.type]||0)+1;return a;},{count:0,bytes:0,types:{}});
}
function fmt(n){return n>=1024*MB?(n/(1024*MB)).toFixed(2)+' GB':(n/MB).toFixed(1)+' MB';}
if(typeof module!=='undefined'&&module.exports){module.exports={clean,reject,yearIn,topicOf,typeOf,analyze,proposed,stats,fmt};return;}
let flow=null,busy=false;
function chooseOptions(){return {topics:flow.selectedTopics,includeOlder:flow.includeOlder,includeExams:flow.includeExams,includeTimeless:flow.includeTimeless};}
function selected(){return flow?.data.rows.filter(x=>proposed(x,chooseOptions()))||[];}
function preview(){
 const a=flow.data,chosen=selected(),s=stats(chosen),archive=stats(a.rows),budget=Number(flow.budget)*MB;
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-xwide v239-modal" data-modal-stop>'
  +'<header class="modal-header"><div><span class="eyebrow">KLASSENORDNER IMPORTIEREN</span><h2>Nur ausgewählte Materialien speichern</h2></div><button class="icon-button" data-action="modal-close">×</button></header>'
  +'<div class="modal-body"><p>Schulcockpit hat die Ordnerstruktur gelesen, <strong>ohne die Dateien im Browser zu speichern</strong>. Die neueste Schuljahresfassung jedes Themas ist vorausgewählt. Ältere Dateien bleiben auf deinem Computer, bis du sie ausdrücklich hinzunimmst.</p>'
  +'<div class="v239-overview"><div><strong>'+a.rows.length+'</strong><span>gefundene Unterrichtsdateien</span></div>'
  +'<div><strong>'+fmt(a.bytes)+'</strong><span>gesamter lokaler Ordner</span></div>'
  +'<div><strong>'+s.count+'</strong><span>zum Speichern ausgewählt</span></div>'
  +'<div><strong>'+fmt(s.bytes)+'</strong><span>tatsächliche Kopiermenge</span></div></div>'
  +'<p class="microcopy">'+a.ignored+' technische, leere oder nicht unterstützte Dateien übersprungen (z. B. weitere ZIPs). Ordnerauswahl ist keine Cloud-Übertragung.</p>'
  +'<div class="v239-config">'
  +'<label>Fach<select id="v239-subject"><option value="Mathematik" '+(flow.subject==='Mathematik'?'selected':'')+'>Mathematik</option><option value="Religion" '+(flow.subject==='Religion'?'selected':'')+'>Religion</option></select></label>'
  +'<label>Jahrgang<select id="v239-grade">'+[5,6,7,8,9,10,11,12,13].map(g=>'<option value="'+g+'" '+(flow.grade===g?'selected':'')+'>Klasse '+g+'</option>').join('')+'</select></label>'
  +'<label>Maximale Speichergröße<select id="v239-budget">'+[100,250,500].map(x=>'<option value="'+x+'" '+(flow.budget===x?'selected':'')+'>'+x+' MB</option>').join('')+'</select></label>'
  +'</div>'
  +'<div class="v239-modes">'
  +'<label><input type="checkbox" id="v239-timeless" '+(flow.includeTimeless?'checked':'')+'> Allgemeine Dateien ohne Schuljahresordner</label>'
  +'<label><input type="checkbox" id="v239-exams" '+(flow.includeExams?'checked':'')+'> Referenz-Klassenarbeiten und Inklusionsfassungen mitnehmen (neueste vorhandene pro Thema)</label>'
  +'<label><input type="checkbox" id="v239-older" '+(flow.includeOlder?'checked':'')+'> Auch ältere Schuljahresfassungen (kann sehr viel werden)</label>'
  +'</div>'
  +'<h3>Themenordner auswählen</h3><div class="v239-topic-grid">'+a.topics.map(t=>{
    const all=a.rows.filter(x=>x.topic===t),chosenHere=all.filter(x=>proposed(x,chooseOptions()));
    const year=a.newestByTopic[t]||'ohne eindeutiges Schuljahr';
    return '<label class="v239-topic"><input type="checkbox" data-v239-topic="'+esc(t)+'" '+(flow.selectedTopics.includes(t)?'checked':'')+'>'
      +'<span><strong>'+esc(t)+'</strong><small>'+esc(year)+' · '+all.length+' Dateien, '+chosenHere.length+' ausgewählt · '+fmt(stats(chosenHere).bytes)+'</small></span></label>';
  }).join('')+'</div>'
  +'<p class="microcopy">Erkannte Auswahl: '+Object.entries(s.types).map(([k,v])=>(TYPES.find(t=>t[0]===k)?.[1]||k)+': '+v).join(' · ')+'. Ältere Varianten sind nur anhand von Pfad, Jahrgang und Dateinamen vorsortiert – der Dateiinhalt wurde noch nicht bewertet.</p>'
  +(s.bytes>budget?'<p class="v239-warning">Die ausgewählten '+fmt(s.bytes)+' überschreiten dein gewähltes Speicherlimit von '+flow.budget+' MB. Bitte Themen abwählen, Optionen reduzieren oder Limit bewusst erhöhen.</p>':'')
  +'<p class="microcopy">Später kannst du denselben Klassenordner erneut auswählen, um weitere Dateien hinzuzufügen. Nicht importierte Originale bleiben unverändert auf deinem Computer. Bereits vorhandene Materialien und Zuordnungen werden nicht überschrieben.</p>'
  +'<div class="v237-actions"><button class="secondary" data-action="modal-close">Abbrechen</button><button class="primary" data-v239-save '+(!s.count||s.bytes>budget?'disabled':'')+'>Nur diese '+s.count+' Dateien lokal speichern</button></div>'
  +'</div></section></div>';
}
function pathsIdentical(e,path,sub,gr,src){
 return e.hubV237?.subject===sub&&Number(e.hubV237?.grade)===gr&&e.sourcePath===path&&e.sourceArchive===src;
}
async function digest(file){
 if(typeof crypto==='undefined'||!crypto.subtle||file.size>20*MB)return '';
 const bytes=await file.arrayBuffer();
 const raw=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(raw)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function store(){
 if(busy||!flow)return;
 const target=selected(),amount=stats(target).bytes;
 if(!target.length||amount>flow.budget*MB)throw Error('Auswahl leer oder über Speicherlimit. Bitte Vorschau prüfen.');
 busy=true;
 const before=clone(state.materialCatalog||[]),createdKeys=[];
 let created=0,skipped=0,shared=0,older=0,bytesWritten=0;
 const src='Ordner:'+flow.subject+':'+flow.data.rows[0]?.path.split('/')[0];
 const sub=flow.subject,gr=flow.grade;
 const button=document.querySelector('[data-v239-save]');
 try{
   for(let i=0;i<target.length;i++){
     const x=target[i];
     if(button&&i%8===0)button.textContent='Speichere '+(i+1)+' / '+target.length+' …';
     const already=(state.materialCatalog||[]).find(e=>pathsIdentical(e,x.path,sub,gr,src));
     if(already&&catalogAvailableV17(already)){skipped++;continue;}
     const sha=await digest(x.file);
     // Blob reuse is content-verified; never infer identical content from matching names alone.
     const same=sha?(state.materialCatalog||[]).find(e=>e.hubV237?.sha256===sha&&catalogAvailableV17(e)):null;
     let key=same?.localFileKey||'catalog-file-'+uid('folder');
     if(!same){
       await fileStorePut(key,x.file);
       createdKeys.push(key);bytesWritten+=x.size;
       storedFileKeys.add(key);
     }else shared++;
     const entry=already||{catalogId:uid('cat-folder'),fileName:x.name,sourceArchive:src,sourcePath:x.path,
       courseLabel:sub+' '+gr,sequenceTitle:x.topic,scope:'sequence_pool',resourceType:'print',
       variantType:'standard',disposition:''};
     const prior=entry.hubV237||{},extra=entry.hubV238||{};
     entry.localFileKey=key;
     entry.hubV237={...prior,subject:sub,grade:gr,kind:prior.kind||x.type,
       status:prior.status||'pool',sha256:sha||prior.sha256||''};
     entry.hubV238={...extra,isPreferred:x.latest,sourceYear:x.year,topicPath:x.topic,archiveTopic:x.topic,
       referenceExam:x.reference,level:'',promoted:!x.latest||x.reference||!!extra.promoted,selectivelySaved:true};
     if(!already){state.materialCatalog.push(entry);created++;}
     if(!x.latest)older++;
   }
   await persistCatalogV171();await saveState();
   flow=null;modal=null;render();
   alert('Klassenordner erfolgreich verarbeitet.\n'+created+' neue Materialeinträge, '+skipped+' bereits vorhanden, '
     +shared+' vorhandene Originaldateien wiederverwendet, '+older+' ältere Fassungen bewusst übernommen.\n'
     +fmt(bytesWritten)+' neu in diesem Browser gespeichert. Nicht ausgewählte Dateien sind nicht importiert.');
 }catch(err){
   state.materialCatalog=before;
   for(const key of createdKeys){try{await fileStoreDelete(key);storedFileKeys.delete(key);}catch(rollback){console.warn('Nicht genutzter Importblobs konnte nicht entfernt werden',rollback);}}
   try{await persistCatalogV171();await saveState();}catch(rollback){console.error('Katalog-Rollback nicht bestätigt',rollback);}
   throw err;
 }finally{busy=false;}
}
function stage(files){
 const data=analyze(files);
 if(!data.rows.length)throw Error('Keine unterstützten Unterrichtsdateien im gewählten Ordner.');
 if(data.rows.length>12000)throw Error('Über 12.000 Dateien: Bitte den Jahrgangsordner aufteilen.');
 const prev=document.querySelector('[data-v237-folder].active')?.dataset.v237Folder||'';
 const parts=prev.split('|'),root=data.rows[0].path.split('/')[0]||'';
 const guessGrade=Number(root.match(/(?:klasse|jg|jahrgang|stufe)\s*0?(\d{1,2})/i)?.[1])||0;
 flow={data,subject:parts[0]==='Religion'?'Religion':'Mathematik',grade:Number(parts[1])||guessGrade||5,
   selectedTopics:[...data.topics],includeOlder:false,includeTimeless:true,includeExams:true,budget:250};
 modal={type:'v239Folder'};render();
}
const prevMaterials=materialsView;
materialsView=function(){
 return prevMaterials().replace(
  '<label class="upload-button big-upload">+ Themen-ZIPs automatisch einsortieren',
  '<label class="upload-button big-upload">+ Klassenordner auswählen<input type="file" id="v239-folder-upload" webkitdirectory directory multiple hidden></label>'
  +'<span class="v239-folder-hint">Klasse 05, 06 … direkt auswählen: Das Cockpit liest erst nur Namen, Ordner und Größen und speichert danach nur deine Auswahl.</span>'
  +'<label class="upload-button">Themen-ZIP komplett speichern');
};
const prevModal=modalHtml;
modalHtml=function(){return modal?.type==='v239Folder'?preview():prevModal();};
const prevWire=wire;
wire=function(){
 prevWire();
 document.getElementById('v239-folder-upload')?.addEventListener('change',e=>{
   try{stage([...e.target.files]);}catch(err){alert('Klassenordner konnte nicht eingelesen werden: '+(err.message||err));}
 });
 for(const [id,key] of [['v239-timeless','includeTimeless'],['v239-exams','includeExams'],['v239-older','includeOlder']])
   document.getElementById(id)?.addEventListener('change',e=>{flow[key]=e.target.checked;render();});
 document.getElementById('v239-budget')?.addEventListener('change',e=>{flow.budget=Number(e.target.value)||250;render();});
 document.getElementById('v239-grade')?.addEventListener('change',e=>{flow.grade=Number(e.target.value)||5;render();});
 document.getElementById('v239-subject')?.addEventListener('change',e=>{flow.subject=e.target.value;render();});
 document.querySelectorAll('[data-v239-topic]').forEach(e=>e.addEventListener('change',()=>{
   if(e.checked&&!flow.selectedTopics.includes(e.dataset.v239Topic))flow.selectedTopics.push(e.dataset.v239Topic);
   if(!e.checked)flow.selectedTopics=flow.selectedTopics.filter(t=>t!==e.dataset.v239Topic);
   render();
 }));
 document.querySelector('[data-v239-save]')?.addEventListener('click',e=>{
   e.currentTarget.disabled=true;store().catch(err=>{alert('Auswahl nicht vollständig gespeichert: '+(err.message||err));render();});
 });
};
const prevRender=render;
render=function(){prevRender();const logo=document.querySelector('.brand small');if(logo)logo.textContent=state.settings.schoolYear+' · V0.23.9';};
})();