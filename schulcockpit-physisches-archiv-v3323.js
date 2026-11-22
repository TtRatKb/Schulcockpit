/* V0.33.23 – paper stock, reusable material and keepsakes.
 * Separate optional view; existing Material-Hub files and lesson plans stay untouched.
 */
(function(){
'use strict';
const C=window.SchulcockpitPhysicalArchiveV3323Core;
if(!C)return;
const escText=v=>esc(String(v??''));
let opened=false,filter='active',query='',editing='',draft=newDraft();
function newDraft(){
 return {type:'copies',title:'',refKey:'',locationId:'fach-01',detail:'',quantity:1,
  reminderDate:'',reminderLabel:'',cohort:'',note:'',archived:false};
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
function choices(){
 const out=[{id:'',title:'Kein digitales Material verknüpft'}];
 for(const m of (state.materials||[]).slice(0,350)){
  for(const v of m.variants||[]){
   if(v.type==='solution'||v.type==='teacher')continue;
   out.push({id:'m:'+m.id+':'+v.id,title:m.title+' · '+(v.fileName||v.label||v.type||'Fassung')});
  }
 }
 if(draft.refKey&&!out.some(x=>x.id===draft.refKey))
  out.push({id:draft.refKey,title:refTitle(draft.refKey)||'Bisherige Materialverknüpfung'});
 return out;
}
function locationName(id){
 const l=C.location(doc(),id);
 return l?.name||'Ort unbekannt';
}
function dateToday(){
 const x=new Date(),p=n=>String(n).padStart(2,'0');
 return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());
}
function entryForm(){
 const d=doc(),mem=draft.type==='memory',refOptions=choices();
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
 escText(l.kind==='folder'?'Fächerordner · '+l.name:l.name)+'</option>').join('')+
 '</select></label>'+
 '<label>Innerhalb des Fachs / der Box (optional)<input data-v3323-field="detail" maxlength="150" value="'+escText(draft.detail)+'" placeholder="z. B. Mappe Brüche / Umschlag 2"></label>'+
 (mem?'':('<label>'+(draft.type==='copies'?'Noch vorhandene Exemplare':'Noch vorhandene Sets / Stücke')+
 '<input type="number" min="0" max="9999" step="1" data-v3323-field="quantity" value="'+escText(draft.quantity)+'"></label>'))+
 '<label class="v3323-wide">Digitales Material verknüpfen (optional)'+
 '<select data-v3323-field="refKey">'+refOptions.map(x=>'<option value="'+escText(x.id)+'"'+
 (draft.refKey===x.id?' selected':'')+'>'+escText(x.title)+'</option>').join('')+'</select>'+
 '<small>Bei sehr großen Materialbibliotheken den gewünschten Eintrag im Material-Hub direkt über „Papierbestand“ auswählen.</small></label>'+
 (mem?'<label>Wieder daran erinnern ab<input type="date" data-v3323-field="reminderDate" value="'+escText(draft.reminderDate)+'"></label>'+
 '<label>Bezug / Anlass (ohne Schülernamen)<input data-v3323-field="cohort" maxlength="100" value="'+escText(draft.cohort)+'" placeholder="z. B. Tutorenklasse 2026/27"></label>'+
 '<label class="v3323-wide">Wofür aufbewahrt?<input data-v3323-field="reminderLabel" maxlength="120" value="'+escText(draft.reminderLabel)+'" placeholder="z. B. am Ende von Jahrgang 10 zurückgeben"></label>':'')+
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
 '<p>Dein Fächerordner zu Hause wird über F01–F26 adressiert. Ein Material kann digital mehreren Kursen zugeordnet bleiben, aber physisch an einem Ort liegen.</p></div>'+
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
 '<p class="microcopy">F01–F26 sind die 26 Fächer deines ausziehbaren Ordners. Andere Boxen oder Schulorte kannst du frei ergänzen.</p>'+
 '<div class="v3323-location-form"><input id="v3323-new-location" maxlength="60" placeholder="Weiteren Ort anlegen, z. B. Laminierbox L1">'+
 '<button type="button" class="secondary" data-v3323-add-location>Ort hinzufügen</button></div>'+
 '<details><summary>Alle Aufbewahrungsorte ('+d.locations.length+')</summary>'+
 '<div class="v3323-locations">'+d.locations.map(l=>'<span>'+escText(l.name)+'</span>').join('')+'</div></details></section>'+
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
 opened=true;editing='';draft=newDraft();filter='active';query='';
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
 editing='';draft=newDraft();render();
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
 if(doc().locations.some(l=>l.name.toLowerCase()===name.toLowerCase()))throw Error('Diesen Ort gibt es bereits.');
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
 document.querySelector('[data-v3323-back]')?.addEventListener('click',()=>{opened=false;render();});
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
  e.currentTarget.disabled=true;
  void save().catch(err=>alert('Archiv nicht gespeichert: '+(err.message||err)));
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
  editing=e.id;draft={...e};render();
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
 if(brand)brand.textContent=state.settings.schoolYear+' · V0.33.23';
};
window.SchulcockpitPhysicalArchiveV3323={open:openArchive,available:(mid,vid)=>C.available(doc(),mid,vid),due:()=>C.due(doc(),dateToday())};
render();
})();
