/* Schulcockpit V0.31.0 – ZIP → ChatGPT → import → Monday/PPT for temporary courses.
 * Works only with local browser material, never uploads files to a server.
 */
(function(){
'use strict';
const C=SC_TEMP_PACKAGE_V310,base=window.SchulcockpitTemporaryCoursesV307;
let stage='start',promptText='',period=null,preview=null,rawAnswer='',lastGroup='';
const group=()=>base.selected();
const todayLocal=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const safe=x=>String(x||'Datei').replace(/[^a-zA-Z0-9äöüÄÖÜß._-]+/g,'_').slice(0,100);
function activeSpan(g){return period&&lastGroup===g.id?period:C.horizon(g.temporaryV307,todayLocal());}
function current(g,span){
 return (state.lessons||[]).filter(l=>l.quickGroupIdV307===g.id&&l.temporaryV307&&
  !l.quickDisabledV307&&l.date>=span.start&&l.date<=span.end)
  .sort((a,b)=>a.date.localeCompare(b.date)||lSlot(a)-lSlot(b));
}
function lSlot(l){return Number(l.slot)||0;}
function refs(g,lessons){
 return [...new Set([...(g.temporaryV307.courseMaterials||[]),
  ...lessons.flatMap(l=>l.quickMaterialRefsV307||[])])];
}
function materialLabel(ref){
 const item=base.findRef(ref);
 return {ref,name:item?.name||ref,kind:item?.kind||'Material',ready:false,files:[]};
}
async function original(ref,zip,archives){
 const res=materialLabel(ref),add=(name,blob,id)=>{
  if(!blob||typeof blob.size!=='number'||!blob.size)return false;
  const dir='materialien/'+(ref.startsWith('m:')?'hub_':'archiv_')+safe(ref.slice(2))+'_';
  const path=dir+safe(id||'original')+'_'+safe(name);
  zip.file(path,blob);res.files.push({path,name,size:blob.size});res.ready=true;return true;
 };
 try{
  if(ref.startsWith('m:')){
   const m=mat(ref.slice(2));
   if(m)for(const v of m.variants||[]){
    if(!v.fileKey||!hasStoredFile(v))continue;
    const rec=await fileStoreGet(v.fileKey);
    add(v.fileName||rec?.name||m.title,rec?.blob,v.id);
   }
  }else if(ref.startsWith('c:')){
   const e=(state.materialCatalog||[]).find(x=>'c:'+x.catalogId===ref);
   if(e&&catalogAvailableV17(e)){
    const ar=catalogArchiveRecordV17(e.sourceArchive);
    let archive=null;
    if(ar?.fileKey){
     if(!archives.has(ar.fileKey)){
      const stored=await fileStoreGet(ar.fileKey);
      archives.set(ar.fileKey,stored?.blob?await JSZip.loadAsync(stored.blob):null);
     }
     archive=archives.get(ar.fileKey);
    }
    const f=await catalogEntryFileV17(e,archive);
    add(e.fileName||'Archivdatei',f,'original');
   }
  }
 }catch(err){console.warn('Kursmaterial fehlt oder ist nicht lesbar',ref,err);}
 return res;
}
async function exportPackage(){
 const g=group();if(!g?.temporaryV307)throw Error('Bitte zuerst einen befristeten Kurs auswählen.');
 if(typeof JSZip==='undefined')throw Error('JSZip ist nicht geladen. Bitte die Seite aktualisieren.');
 const span=C.horizon(g.temporaryV307,todayLocal());
 // Populate the four-week date slots before calculating the package; preserve existing lessons.
 base.sync(g,span,false);
 const ls=current(g,span);
 if(!ls.length)throw Error('Im gewählten Zeitraum wurden keine Unterrichtstermine gefunden.');
 const zip=new JSZip(),archives=new Map(),items=[];
 for(const ref of refs(g,ls))items.push(await original(ref,zip,archives));
 const data={schema:C.SCHEMA,groupId:g.id,period:span,
  settings:{...g.temporaryV307},
  lessons:ls.map(l=>({id:l.id,date:l.date,slot:l.slot,
   title:l.title,exam:!!l.quickExamV307,held:!!v182IsHeld(l),
   quickDraftV307:l.quickDraftV307||{},
   work:l.objective||'',materialRefs:l.quickMaterialRefsV307||[]})),
  materials:items};
 const p=C.prompt(g,data);
 zip.file('00_START_HIER.md',C.instructions());
 zip.file('01_CHATGPT_PROMPT.md',p);
 zip.file('02_KURSPLAN.json',JSON.stringify(data,null,2));
 zip.file('03_MATERIALMANIFEST.json',JSON.stringify({
  groupId:g.id,materials:items,
  missing:items.filter(x=>!x.ready).map(x=>x.ref),
  explanation:'Nur tatsächlich lokal verfügbare Originaldateien sind im Ordner materialien/ enthalten.'
 },null,2));
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:5}});
 downloadBlob('Schulcockpit_Kursplanung_'+safe(g.subject+'_'+g.grade)+'_'+span.start+'.zip',blob);
 await Promise.resolve(saveState());
 promptText=p;period=span;lastGroup=g.id;rawAnswer='';preview=null;stage='import';
 render();
 const n=items.filter(x=>!x.ready).length;
 const msg='Kurs-ZIP heruntergeladen ('+ls.length+' Termine, '+items.filter(x=>x.ready).length+
  ' verfügbare Materialeinträge).'+(n?' '+n+' Originale fehlen – im Manifest gekennzeichnet.':'')+
  '\n\nDer Prompt liegt in der ZIP und unten zum Kopieren bereit. Danach die ChatGPT-Antwort hier einfügen.';
 alert(msg);
}
function valid(){
 const g=group();if(!g?.temporaryV307)throw Error('Kein befristeter Kurs ausgewählt.');
 const span=activeSpan(g);
 base.sync(g,span,false);
 const ls=current(g,span);
 const allowed=refs(g,ls);
 const p=C.parse(rawAnswer,g,ls,allowed);
 return {g,span,ls,p};
}
function previewHtml(g,rows,ls){
 const byId=new Map(ls.map(l=>[l.id,l]));
 const missing=ls.filter(l=>!v182IsHeld(l)&&!rows.some(p=>p.id===l.id));
 const protectedRows=rows.filter(p=>v182IsHeld(byId.get(p.id)));
 return '<section class="v310-preview"><h4>Importvorschau</h4>'+
  '<p><strong>'+rows.length+' Stunden</strong> im Datenblock · '+rows.filter(x=>x.presentationRequired).length+
  ' mit PowerPoint · '+missing.length+' offene Termine nicht enthalten · '+
  protectedRows.length+' bereits gehalten (werden nicht überschrieben).</p>'+
  (missing.length?'<p class="v310-warning">⚠ Diese Termine fehlen noch: '+missing.map(x=>esc(x.date)).join(', ')+
   '. Bitte ChatGPT die fehlenden Stunden ergänzen lassen.</p>':'')+
  '<ol>'+rows.map(x=>'<li>'+esc(x.date)+' · '+esc(x.title)+
   ' · '+(x.presentationRequired?'PPT vorgesehen':'keine PPT')+'</li>').join('')+'</ol>'+
  '<button class="primary" data-v310-apply '+(missing.length?'disabled':'')+
  '>Geprüfte Stunden in den Montagsmodus übernehmen →</button></section>';
}
function nextPpt(g){return current(g,activeSpan(g)).find(l=>!v182IsHeld(l)&&
  !l.quickExamV307&&!l.presentationNotRequiredV177&&!l.presentationReady&&
  (l.slides||[]).length>0)||null;}
function panel(g){
 if(!g?.temporaryV307)return '';
 if(lastGroup!==g.id){stage='start';preview=null;promptText='';rawAnswer='';period=null;lastGroup=g.id;}
 const span=activeSpan(g);
 return '<section class="panel v310-plan"><div class="section-head"><div>'+
  '<span class="eyebrow">KURSPLANUNG · ORIGINALDATEIEN AUS DEM HUB</span>'+
  '<h3>Vier Wochen planen → ZIP → ChatGPT → Montagsmodus</h3>'+
  '<p>Kein einzelnes Arbeitsblatt erneut zusammensuchen. Die lokale ZIP enthält die vorgemerkten Originale, eine Arbeitsanweisung und den vollständigen Prompt.</p>'+
  '</div></div><div class="v310-actions">'+
  '<button class="primary" data-v310-export>ZIP mit Originalen & Arbeitsanweisung erstellen</button>'+
  '<button class="secondary" data-v310-return>Antwort einfügen / prüfen ↓</button></div>'+
  (stage==='start'?'':'<div class="v310-import">'+
   '<p><strong>1.</strong> ZIP bei ChatGPT hochladen, dazu den Prompt einfügen. '+
   '<strong>2.</strong> Die vollständige Antwort hier einfügen. '+
   '<strong>3.</strong> Erst nach Vorschau importieren.</p>'+
   (promptText?'<details><summary>ChatGPT-Prompt anzeigen / kopieren</summary>'+
    '<textarea id="v310-prompt" rows="8" readonly>'+esc(promptText)+'</textarea>'+
    '<button class="secondary" data-v310-copy>Prompt kopieren</button></details>':'')+
   '<label>ChatGPT-Antwort mit SCHULCOCKPIT_COURSE_IMPORT<textarea id="v310-response" rows="11" '+
   'placeholder="Komplette Antwort von ChatGPT hier einfügen …">'+esc(rawAnswer)+'</textarea></label>'+
   '<div class="v310-actions"><button class="primary" data-v310-check>Antwort prüfen →</button>'+
   '<button class="secondary" data-v310-monday>Montagsmodus öffnen ↗</button>'+
   (nextPpt(g)?'<button class="primary" data-v310-ppt>PowerPoint für '+esc(nextPpt(g).date)+' erstellen ↗</button>':'')+'</div>'+
   (preview?previewHtml(g,preview,current(g,span)):'')+'</div>')+
  '</section>';
}
const previousHtml=viewHtml;
viewHtml=function(){
 const html=previousHtml();
 if(view!=='quickTeachingV304')return html;
 const g=group();if(!g?.temporaryV307)return html;
 return html.replace('data-v307-prompt','data-v310-export')
  .replace('<section class="panel v307-pool">',panel(g)+'<section class="panel v307-pool">');
};
function monday(g){
 const first=current(g,activeSpan(g)).find(l=>!v182IsHeld(l))||current(g,activeSpan(g))[0];
 if(first)state.settings.activeWeekStart=iso(mondayOf(new Date(first.date+'T12:00:00')));
 view='prep';saveState();render();
}
async function applyPlans(g,rows){
 const ls=current(g,activeSpan(g));
 const backups=new Map(),changed=[];
 try{
  for(const x of rows){
   const l=ls.find(v=>v.id===x.id);
   if(!l||v182IsHeld(l)||l.quickExamV307&&x.presentationRequired)continue;
   backups.set(l.id,structuredClone(l));
   const norm=normalizeAiPackage({lesson:{title:x.title,objective:x.objective,footer:x.footer},
    phases:x.phases,slides:x.slides,materials:[],prepTasks:[]});
   l.title=x.title;l.objective=x.objective||x.work;
   if(x.footer)l.footerTopic=x.footer;
   l.quickDraftV307={topic:x.title,entry:x.entry,work:x.work,end:x.end};
   l.planReference={...(l.planReference||{}),title:x.title,content:x.work,objective:x.objective};
   l.phasePlan=norm.phases.map(p=>({id:uid('phase'),...p,done:false}));
   l.slides=norm.slides.map(sl=>({id:uid('slide'),...sl}));
   l.manualPlanReadyV177=true;l.aiImportAt=new Date().toISOString();
   l.aiImportSource='temporary-course-v310';
   l.presentationNotRequiredV177=!x.presentationRequired;
   l.presentationReady=!x.presentationRequired;
   if(x.presentationRequired)l.presentationSourceV177='';
   for(const ref of x.materialRefs||[]){
    if(!(l.quickMaterialRefsV307||[]).includes(ref))base.addRef(l,ref);
   }
   changed.push(l);
  }
  if(!changed.length)throw Error('Keine offenen Stunden zum Import vorhanden.');
  await Promise.resolve(saveState());
 }catch(error){
  for(const l of changed){const backup=backups.get(l.id);
   if(backup){for(const key of Object.keys(l))delete l[key];Object.assign(l,backup);}
  }
  throw error;
 }
 return changed.length;
}
const previousWire=wire;
wire=function(){
 previousWire();
 if(view!=='quickTeachingV304'||!group()?.temporaryV307)return;
 document.querySelectorAll('[data-v310-export]').forEach(b=>b.addEventListener('click',async()=>{
  b.disabled=true;try{await exportPackage();}catch(e){alert('Kurs-ZIP konnte nicht erstellt werden: '+(e.message||e));b.disabled=false;}
 }));
 document.querySelector('[data-v310-return]')?.addEventListener('click',()=>{
  stage='import';render();document.getElementById('v310-response')?.focus();
 });
 document.querySelector('[data-v310-copy]')?.addEventListener('click',async()=>{
  const p=document.getElementById('v310-prompt');
  try{await navigator.clipboard.writeText(p?.value||promptText);alert('Prompt kopiert.');}
  catch{p?.select();alert('Prompt markieren und mit ⌘C / Strg+C kopieren.');}
 });
 document.querySelector('[data-v310-check]')?.addEventListener('click',()=>{
  rawAnswer=document.getElementById('v310-response')?.value||'';
  try{const data=valid();preview=data.p;render();}
  catch(e){preview=null;alert('Importprüfung: '+(e.message||e));}
 });
 document.querySelector('[data-v310-apply]')?.addEventListener('click',async()=>{
  try{
   const data=valid();
   if(data.ls.some(l=>!v182IsHeld(l)&&!data.p.some(p=>p.id===l.id)))
    throw Error('Es fehlen noch Stunden. Erst den vollständigen Vier-Wochen-Import prüfen.');
   if(data.p.some(p=>{const l=data.ls.find(x=>x.id===p.id);return l&&(l.phasePlan||[]).length>0;})&&
    !confirm('Bereits konkret geplante, noch nicht gehaltene Stunden in diesem Kurs ersetzen? Originalmaterialien und historische Ist-Stunden bleiben erhalten.'))return;
   const count=await applyPlans(data.g,data.p);
   preview=null;stage='import';render();
   alert(count+' Stunden gespeichert. Sie sind jetzt im Montagsmodus verfügbar. Für PowerPoints einzelne Stunde öffnen → Planung ansehen / ändern → PowerPoint erzeugen.');
  }catch(e){alert('Kein Import durchgeführt: '+(e.message||e));}
 });
 document.querySelector('[data-v310-monday]')?.addEventListener('click',()=>monday(group()));
 document.querySelector('[data-v310-ppt]')?.addEventListener('click',()=>{
  const l=nextPpt(group());if(l)openWizardV14(l.id,4);
 });
};
const previousRender=render;
render=function(){
 previousRender();
 const stamp=document.querySelector('.brand small');
 if(stamp)stamp.textContent=state.settings.schoolYear+' · V0.31.0';
};
window.SchulcockpitTemporaryCourseZipV310={exportPackage,applyPlans,valid};
})();
