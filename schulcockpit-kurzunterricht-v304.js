/* Schulcockpit V0.30.4 – independent short planning drawer.
 * Does not require timetable, material library or sequence IDs.
 */
(function(){
'use strict';
const C=SC_QUICK_TEACH_V304;
let selected='',showCreate=false,error='';
function groups(){return Array.isArray(state.quickTeachingV304)?state.quickTeachingV304:[];}
function chosen(){return groups().find(x=>x.id===selected)||groups()[0]||null;}
function choice(arr,value){return arr.map(([v,label])=>'<option value="'+esc(v)+'" '+(v===value?'selected':'')+'>'+esc(label)+'</option>').join('');}
function value(s){return String(s||'').trim();}
function itemField(id,title,current,textarea=false,placeholder=''){
 const attr='data-v304-session="'+esc(id)+'" data-v304-key="'+esc(title)+'"';
 return '<label>'+esc(({topic:'Thema',entry:'Kurzer Einstieg',independent:'Selbstständige Arbeitsphase / Auftrag',
 end:'Abschluss / Ergebnissicherung',material:'Material, Buchseiten oder Links (optional)',note:'Notiz (optional)',
 reflection:'Wie lief es? (optional)'}[title]||title))+
  (textarea?'<textarea rows="2" '+attr+' placeholder="'+esc(placeholder)+'">'+esc(current||'')+'</textarea>':
  '<input '+attr+' value="'+esc(current||'')+'" placeholder="'+esc(placeholder)+'">')+'</label>';
}
function suggestion(g){
 const lib=state.inspirationV302||[];
 return lib.filter(x=>!x.archived&&(!x.subjects?.length||
  x.subjects.includes(/mathe/i.test(g.subject)?'math':/religion/i.test(g.subject)?'religion':'other'))).slice(0,60);
}
function lessonCard(g,s,i){
 const sources=suggestion(g),where='session-'+s.id;
 return '<details class="v304-session" '+(i===0?'open':'')+'><summary><span>'+
  '<strong>'+esc(s.date)+' · '+esc(s.topic||'Thema noch offen')+'</strong>'+
  '<small>'+(s.done?'✓ gehalten':'○ geplant')+'</small></span><span>Bearbeiten</span></summary>'+
  '<div class="v304-session-edit">'+
  '<label>Datum<input type="date" data-v304-session="'+esc(s.id)+'" data-v304-key="date" value="'+esc(s.date)+'"></label>'+
  itemField(s.id,'topic',s.topic,false,'z. B. eigenständig Aufgaben bearbeiten')+
  itemField(s.id,'entry',s.entry,true,'Ein kurzer Impuls oder eine Frage genügt')+
  itemField(s.id,'independent',s.independent,true,'z. B. Arbeitsheft Seite 12 Aufgaben 1–6')+
  itemField(s.id,'end',s.end,true,'Gemeinsamer Blick auf die Ergebnisse')+
  itemField(s.id,'material',s.material,true,'Kein Material erforderlich')+
  itemField(s.id,'note',s.note,true)+
  '<label>Optional: Idee aus Ideenlabor oder Toolbox in ChatGPT-Prompt einbeziehen<select data-v304-inspire="'+esc(s.id)+'">'+
   '<option value="">Keine zusätzliche Idee</option>'+sources.map(e=>
    '<option value="'+esc(e.id)+'" '+(s.inspirationId===e.id?'selected':'')+'>'+esc(e.title)+'</option>').join('')+
  '</select></label>'+
  '<label class="v304-check"><input type="checkbox" data-v304-done="'+esc(s.id)+'" '+(s.done?'checked':'')+
  '> Diese Stunde hat stattgefunden</label>'+
  itemField(s.id,'reflection',s.reflection,true,'Was soll ich beim nächsten Mal beachten?')+
  '<div class="v304-session-buttons"><button class="primary" data-v304-save-session="'+esc(s.id)+'">Stunde speichern</button>'+
   '<button class="secondary" data-v304-prompt="'+esc(s.id)+'">Kurzen ChatGPT-Prompt kopieren</button>'+
   '<button class="text-button" data-v304-delete-session="'+esc(s.id)+'">Stunde entfernen</button>'+
  '</div></div></details>';
}
function page(){
 const all=groups(),g=chosen(),stats=C.summary(all);
 return '<div class="content-grid v304-page"><section class="hero-card v304-hero"><div>'+
  '<span class="eyebrow">OHNE GROSSE REIHENPLANUNG</span><h2>Kurzunterricht & Übernahmen</h2>'+
  '<p>Vier Wochen Elternzeitvertretung oder nur eine spontane Stunde? Hier reicht ein Thema, ein kurzer Einstieg '+
  'und das, was die Lerngruppe selbstständig bearbeiten soll. Materialhub, Methoden und PowerPoint sind freiwillig.</p>'+
  '</div><button class="primary" data-v304-new>+ Kurzplanung anlegen</button></section>'+
  '<section class="panel v304-overview"><span><strong>'+all.length+'</strong> Planungen</span>'+
  '<span><strong>'+stats.lessons+'</strong> Unterrichtstermine</span>'+
  '<span><strong>'+stats.done+'</strong> gehalten</span></section>'+
  (showCreate?'<section class="panel v304-new"><div class="section-head"><h3>Schnell einen Kurs oder eine Einzelstunde anlegen</h3>'+
  '<button class="secondary" data-v304-cancel>Abbrechen</button></div>'+
  '<div class="v304-fields"><label>Art<select id="v304-type">'+choice(C.TYPES,'temporary')+'</select></label>'+
  '<label>Kurzname<input id="v304-title" maxlength="120" placeholder="z. B. Mathe 7 · Elternzeitvertretung"></label>'+
  '<label>Fach<select id="v304-subject">'+choice(C.SUBJECTS,'Mathematik')+'</select></label>'+
  '<label>Lerngruppe (freiwillig)<input id="v304-grade" maxlength="50" placeholder="z. B. 7b"></label>'+
  '<label>Erster Termin<input id="v304-start" type="date" value="'+new Date().toISOString().slice(0,10)+'"></label>'+
  '<label>Zeitraum<select id="v304-weeks">'+choice([['1','Nur eine Stunde'],['2','2 Wochen'],['3','3 Wochen'],['4','4 Wochen'],['5','5 Wochen'],['6','6 Wochen'],['8','8 Wochen'],['12','12 Wochen']],'4')+'</select></label>'+
  '<label class="v304-full">Rahmen / Vorgaben vom Kollegen (optional)<textarea id="v304-note" rows="2" maxlength="750"></textarea></label></div>'+
  '<p class="microcopy">Bei mehreren Wochen entsteht zunächst ein Termin pro Woche am gewählten Wochentag. '+
  'Weitere Termine kannst du einzeln ergänzen. Die Planung beeinflusst den offiziellen Stundenplan nicht.</p>'+
  '<div class="v304-buttons"><button class="primary" data-v304-create>Planung erstellen ✓</button></div></section>':'')+
  (error?'<p class="v304-error" role="status">'+esc(error)+'</p>':'')+
  (all.length?'<section class="panel v304-selector"><label>Planung öffnen<select id="v304-select">'+choice(all.map(x=>[x.id,x.title+' · '+x.subject]),g?.id||'')+'</select></label></section>':'')+
  (!g?'<section class="panel">Noch kein Kurzunterricht angelegt. Du kannst hier auch eine einzelne '+
   'Vertretungsstunde ohne Fachkurs im Schulcockpit planen.</section>':
  '<section class="panel v304-detail"><div class="section-head"><div><span class="eyebrow">'+
   (g.type==='cover'?'EINZELSTUNDE':'ZEITWEISE KURSÜBERNAHME')+'</span><h2>'+esc(g.title)+'</h2>'+
   '<p>'+esc(g.subject)+' · '+esc(g.grade||'Lerngruppe offen')+'</p></div>'+
   '<button class="text-button" data-v304-delete-group="'+esc(g.id)+'">Planung entfernen</button></div>'+
   (g.note?'<p class="v304-notice">'+esc(g.note)+'</p>':'')+
   '<p class="microcopy">Alle Termine sind unabhängig vom normalen Schuljahresplan. '+
   'Du kannst auch nur Titel und Arbeitsauftrag speichern und die übrigen Felder offen lassen.</p>'+
   '<div class="v304-sessions">'+(g.sessions||[]).map((s,i)=>lessonCard(g,s,i)).join('')+'</div>'+
   '<div class="v304-buttons"><label>Weiteren Termin hinzufügen<input id="v304-more-date" type="date" value="'+
    esc(C.addDays(g.sessions.at(-1)?.date||new Date().toISOString().slice(0,10),7))+'"></label>'+
   '<button class="secondary" data-v304-add-date>+ Termin ergänzen</button></div></section>')+
  '</div>';
}
const prevTitle=pageTitle;pageTitle=function(){return view==='quickTeachingV304'?'Kurzunterricht':prevTitle();};
const prevHtml=viewHtml;viewHtml=function(){return view==='quickTeachingV304'?page():prevHtml();};
async function persist(action){
 const prev=structuredClone(groups());
 try{state.quickTeachingV304=structuredClone(groups());action(state.quickTeachingV304);
  await Promise.resolve(saveState());error='';render();
 }catch(e){state.quickTeachingV304=prev;error=e?.message||String(e);render();throw e;}
}
const oldWire=wire;
wire=function(){
 oldWire();if(view!=='quickTeachingV304')return;
 document.querySelector('[data-v304-new]')?.addEventListener('click',()=>{showCreate=true;error='';render();});
 document.querySelector('[data-v304-cancel]')?.addEventListener('click',()=>{showCreate=false;render();});
 document.querySelector('#v304-select')?.addEventListener('change',e=>{selected=e.target.value;render();});
 document.querySelector('[data-v304-create]')?.addEventListener('click',async()=>{
  try{
   const id=uid('quick'),type=document.querySelector('#v304-type').value;
   const record=C.group({id,type,title:document.querySelector('#v304-title').value,
    subject:document.querySelector('#v304-subject').value,grade:document.querySelector('#v304-grade').value,
    note:document.querySelector('#v304-note').value,createdAt:new Date().toISOString(),sessions:[]});
   const weeks=type==='cover'?1:Number(document.querySelector('#v304-weeks').value);
   record.sessions=C.weekly(document.querySelector('#v304-start').value,weeks,()=>uid('qs'));
   await persist(groups=>groups.push(record));selected=id;showCreate=false;render();
  }catch(e){error=e.message||String(e);render();}
 });
 document.querySelector('[data-v304-delete-group]')?.addEventListener('click',async e=>{
  const id=e.currentTarget.dataset.v304DeleteGroup;
  if(!confirm('Diese eigenständige Kurzplanung einschließlich ihrer Termine entfernen? '+ 
   'Reguläre Schulcockpit-Kurse und Unterrichtsstunden bleiben unverändert.'))return;
  try{await persist(all=>{const i=all.findIndex(g=>g.id===id);if(i>=0)all.splice(i,1);});
   selected=groups()[0]?.id||'';render();}catch(e){alert(e.message||e);}
 });
 document.querySelector('[data-v304-add-date]')?.addEventListener('click',async()=>{
  try{const date=document.querySelector('#v304-more-date')?.value,group=chosen();
   const newSession=C.session({id:uid('qs'),date});
   await persist(all=>{const i=all.findIndex(g=>g.id===group.id);
    all[i]=C.addToGroup(all[i],[newSession]);});
  }catch(e){alert('Termin nicht gespeichert: '+(e.message||e));}
 });
 document.querySelectorAll('[data-v304-save-session]').forEach(b=>b.onclick=async()=>{
  const id=b.dataset.v304SaveSession,g=chosen(),existing=g?.sessions.find(s=>s.id===id);
  if(!existing)return;
  const draft={...existing};
  document.querySelectorAll('[data-v304-session]').forEach(input=>{
   if(input.dataset.v304Session===id)draft[input.dataset.v304Key]=input.value;
  });
  draft.done=!!document.querySelector('[data-v304-done="'+CSS.escape(id)+'"]')?.checked;
  draft.inspirationId=document.querySelector('[data-v304-inspire="'+CSS.escape(id)+'"]')?.value||'';
  try{const ready=C.session(draft);ready.inspirationId=draft.inspirationId;
   await persist(all=>{const i=all.findIndex(x=>x.id===g.id);
    all[i].sessions=all[i].sessions.map(s=>s.id===id?ready:s).sort((a,b)=>a.date.localeCompare(b.date));});
  }catch(e){alert('Stunde nicht gespeichert: '+(e.message||e));}
 });
 document.querySelectorAll('[data-v304-delete-session]').forEach(b=>b.onclick=async()=>{
  if(!confirm('Nur diesen Kurzunterrichtstermin entfernen?'))return;
  const id=b.dataset.v304DeleteSession,g=chosen();try{
   await persist(all=>{const record=all.find(x=>x.id===g.id);
    if(record)record.sessions=record.sessions.filter(s=>s.id!==id);});
  }catch(e){alert(e.message||e);}
 });
 document.querySelectorAll('[data-v304-prompt]').forEach(b=>b.onclick=async()=>{
  const id=b.dataset.v304Prompt,g=chosen(),s=g?.sessions.find(x=>x.id===id);
  if(!s)return;
  // Read unsaved on-screen text for this prompt, but do not mutate stored state.
  const draft={...s};document.querySelectorAll('[data-v304-session]').forEach(input=>{
   if(input.dataset.v304Session===id)draft[input.dataset.v304Key]=input.value;
  });
  draft.inspirationId=document.querySelector('[data-v304-inspire="'+CSS.escape(id)+'"]')?.value||'';
  try{
   const idea=(state.inspirationV302||[]).find(x=>x.id===draft.inspirationId);
   const text=C.prompt(g,draft,idea?[idea]:[]);
   try{await navigator.clipboard.writeText(text);alert('Kurzer Unterrichtsprompt kopiert.');}
   catch{downloadText('Kurzunterricht_'+id+'.txt',text);alert('Prompt als Textdatei gespeichert.');}
  }catch(e){alert('Prompt nicht erstellt: '+(e.message||e));}
 });
};
const oldRender=render;
render=function(){
 oldRender();
 const nav=document.querySelector('.sidebar nav');
 if(nav&&!nav.querySelector('[data-view="quickTeachingV304"]')){
  const btn=document.createElement('button');btn.dataset.view='quickTeachingV304';
  btn.className=view==='quickTeachingV304'?'active':'';
  btn.innerHTML='<span>✎</span>Kurzunterricht';
  const before=nav.querySelector('[data-view="ideas"]');
  if(before)nav.insertBefore(btn,before);else nav.append(btn);
  btn.onclick=()=>{view='quickTeachingV304';modal=null;render();};
 }
 const v=document.querySelector('.brand small');
 if(v)v.textContent=state.settings.schoolYear+' · V0.30.4';
};
if(typeof window!=='undefined')window.SchulcockpitQuickTeachingV304={page,groups,core:C};
})();