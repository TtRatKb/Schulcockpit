/* V0.29.8 – a teacher-owned method library, wired to the real plan prompt.
 * Existing methods and AI import schemas stay compatible. */
(function(){
'use strict';
const core=SC_METHOD_BANK_V298;
let filters={phase:'all',subject:'all',search:'',showOff:false},editing='',showEditor=false;
function methods(){return Array.isArray(state.teachingMethodsV298)?state.teachingMethodsV298:core.defaults();}
function persisted(){
 if(!Array.isArray(state.teachingMethodsV298))state.teachingMethodsV298=core.defaults();
 return state.teachingMethodsV298;
}
function info(id){return methods().find(m=>m.id===id);}
function editor(){
 const m=info(editing)||{title:'',phase:'entry',subjects:['math','religion'],description:'',when:'',avoid:'',source:'',enabled:true};
 const choice=(name,current,values)=>'<select data-v298-field="'+name+'">'+values.map(([v,t])=>
  '<option value="'+esc(v)+'" '+(v===current?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select>';
 return '<section class="panel v298-editor"><div class="section-head"><div><span class="eyebrow">EIGENE METHODENSAMMLUNG</span>'+
  '<h3>'+esc(editing?'Methode bearbeiten':'Neue Methode aufnehmen')+'</h3></div>'+
  '<button class="secondary" data-v298-cancel>Schließen</button></div>'+
  '<div class="v298-fields"><label class="v298-full">Name der Methode<input data-v298-field="title" maxlength="110" value="'+esc(m.title)+'" placeholder="z. B. Stummer Impuls"></label>'+
  '<label>Unterrichtsphase'+choice('phase',m.phase,core.PHASES)+'</label>'+
  '<fieldset><legend>Passende Fächer</legend>'+core.SUBJECTS.map(([id,label])=>
   '<label><input type="checkbox" data-v298-subject="'+id+'" '+(m.subjects.includes(id)?'checked':'')+'>'+label+'</label>').join('')+'</fieldset>'+
  '<label class="v298-full">So läuft die Methode ab<textarea data-v298-field="description" rows="3" maxlength="900">'+esc(m.description)+'</textarea></label>'+
  '<label>Wann passt sie?<textarea data-v298-field="when" rows="3" maxlength="650" placeholder="Material, Vorwissen, Lerngruppe, Zeit">'+esc(m.when)+'</textarea></label>'+
  '<label>Wann passt sie nicht?<textarea data-v298-field="avoid" rows="3" maxlength="650" placeholder="z. B. nur ein einheitlicher Informationstext">'+esc(m.avoid)+'</textarea></label>'+
  '<label class="v298-full">Quelle / Inspiration (optional)<input data-v298-field="source" type="url" maxlength="500" value="'+esc(m.source||'')+'" placeholder="https://…"></label>'+
  '</div><div class="v298-form-actions"><button class="primary" data-v298-save>Speichern</button>'+
  '<button class="secondary" data-v298-cancel>Abbrechen</button></div></section>';
}
function methodCard(m){
 return '<article class="v298-method'+(!m.enabled?' inactive':'')+'">'+
 '<div class="v298-method-head"><div><strong>'+esc(m.title)+'</strong>'+
 '<small>'+esc(core.PHASES.find(x=>x[0]===m.phase)?.[1]||'')+' · '+
 m.subjects.map(x=>esc(core.SUBJECTS.find(y=>y[0]===x)?.[1]||x)).join(' & ')+
 (m.builtin?' · Vorschlag':' · Eigener Eintrag')+'</small></div>'+
 '<div class="v298-actions"><button class="secondary" data-v298-edit="'+esc(m.id)+'">Bearbeiten</button>'+
 '<button class="text-button" data-v298-toggle="'+esc(m.id)+'">'+(m.enabled?'Pausieren':'Aktivieren')+'</button>'+
 (!m.builtin?'<button class="text-button" data-v298-remove="'+esc(m.id)+'">Löschen</button>':'')+
 '</div></div><p>'+esc(m.description)+'</p>'+
 (m.when?'<div><strong>Passt, wenn:</strong> '+esc(m.when)+'</div>':'')+
 (m.avoid?'<div><strong>Eher nicht:</strong> '+esc(m.avoid)+'</div>':'')+
 (m.source?'<small>Quelle: <a href="'+esc(m.source)+'" target="_blank" rel="noopener noreferrer">'+esc(m.source)+'</a></small>':'')+
 '</article>';
}
function methodsView(){
 const all=methods(),list=all.filter(m=>
  (filters.showOff||m.enabled)&&
  (filters.phase==='all'||m.phase===filters.phase)&&
  (filters.subject==='all'||m.subjects.includes(filters.subject))&&
  (!filters.search||[m.title,m.description,m.when,m.avoid].join(' ').toLocaleLowerCase('de-DE').includes(filters.search.toLocaleLowerCase('de-DE'))));
 const active=all.filter(m=>m.enabled);
 return '<div class="content-grid v298-page"><section class="hero-card v298-hero"><div>'+
  '<span class="eyebrow">DEINE DIDAKTISCHE WERKZEUGKISTE</span><h2>Methoden statt Einheitsstunden ✦</h2>'+
  '<p>Lege Einstiege, Erarbeitungsmethoden, Sicherungen und Vertiefungen ab. Bei der Unterrichtsplanung '+
  'werden passende Methoden und ihre Grenzen im ChatGPT-Prompt berücksichtigt – ohne sie zwanghaft einzusetzen.</p>'+
  '</div><button class="primary" data-v298-add>+ Methode ergänzen</button></section>'+
  '<section class="panel v298-controls"><div class="v298-stats"><strong>'+active.length+
  '</strong><span>aktive Methoden</span><strong>'+all.filter(m=>!m.builtin).length+
  '</strong><span>eigene Ergänzungen</span></div><div class="v298-filters">'+
  '<label>Phase<select data-v298-filter="phase"><option value="all">Alle Phasen</option>'+
  core.PHASES.map(([v,t])=>'<option value="'+v+'" '+(filters.phase===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
  '<label>Fach<select data-v298-filter="subject"><option value="all">Beide Fächer</option>'+
  core.SUBJECTS.map(([v,t])=>'<option value="'+v+'" '+(filters.subject===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
  '<label>Suche<input data-v298-search value="'+esc(filters.search)+'" placeholder="Fehlerdetektiv, Perspektiven …"></label>'+
  '<label class="v298-check"><input type="checkbox" data-v298-showoff '+(filters.showOff?'checked':'')+'> Pausierte zeigen</label>'+
  '</div></section>'+
  (showEditor?editor():'')+
  '<section class="v298-method-list">'+(list.length?list.map(methodCard).join(''):
  '<div class="panel">Hier passen gerade keine Methoden. Filter ändern oder eine neue ergänzen.</div>')+
  '</section></div>';
}
const oldPageTitle=pageTitle;
pageTitle=function(){return view==='methods'?'Methodenbibliothek':oldPageTitle();};
const oldViewHtml=viewHtml;
viewHtml=function(){return view==='methods'?methodsView():oldViewHtml();};
function save(method){
 const before=Array.isArray(state.teachingMethodsV298)?structuredClone(state.teachingMethodsV298):null;
 try{
  const list=persisted(),i=list.findIndex(m=>m.id===method.id);
  if(i>=0)list[i]=method;else list.push(method);
  saveState();render();
 }catch(err){
  if(before)state.teachingMethodsV298=before;else delete state.teachingMethodsV298;
  throw err;
 }
}
function patch(id,transform){
 const existing=info(id);if(!existing)return;
 const result=core.valid({...transform(existing),id:existing.id,builtin:existing.builtin});
 save(result);
}
function openEditor(id){
 editing=id||'';showEditor=true;render();
}
const oldWire=wire;
wire=function(){
 oldWire();
 if(view!=='methods')return;
 document.querySelector('[data-v298-add]')?.addEventListener('click',()=>openEditor(''));
 document.querySelectorAll('[data-v298-cancel]').forEach(b=>b.onclick=()=>{showEditor=false;editing='';render();});
 document.querySelectorAll('[data-v298-edit]').forEach(b=>b.onclick=()=>openEditor(b.dataset.v298Edit));
 document.querySelectorAll('[data-v298-toggle]').forEach(b=>b.onclick=()=>{
  const m=info(b.dataset.v298Toggle);if(m)save({...m,enabled:!m.enabled});
 });
 document.querySelectorAll('[data-v298-remove]').forEach(b=>b.onclick=()=>{
  const id=b.dataset.v298Remove,m=info(id);
  if(!m||m.builtin||!confirm('„'+m.title+'“ wirklich aus deiner Methodensammlung löschen?'))return;
  const before=structuredClone(persisted());
  try{state.teachingMethodsV298=state.teachingMethodsV298.filter(x=>x.id!==id);saveState();render();}
  catch(err){state.teachingMethodsV298=before;alert('Löschen fehlgeschlagen: '+(err.message||err));}
 });
 document.querySelectorAll('[data-v298-filter]').forEach(s=>s.onchange=()=>{
  filters[s.dataset.v298Filter]=s.value;render();
 });
 document.querySelector('[data-v298-showoff]')?.addEventListener('change',e=>{filters.showOff=e.target.checked;render();});
 document.querySelector('[data-v298-search]')?.addEventListener('change',e=>{filters.search=e.target.value.trim();render();});
 document.querySelector('[data-v298-save]')?.addEventListener('click',()=>{
  const input=key=>document.querySelector('[data-v298-field="'+key+'"]')?.value||'';
  const old=info(editing);
  const candidate={id:editing||uid('method'),title:input('title'),phase:input('phase'),
   subjects:core.SUBJECTS.map(x=>x[0]).filter(x=>document.querySelector('[data-v298-subject="'+x+'"]')?.checked),
   description:input('description'),when:input('when'),avoid:input('avoid'),source:input('source'),
   enabled:old?.enabled!==false,builtin:old?.builtin===true};
  try{
   if(candidate.source&&!/^https?:\/\//i.test(candidate.source))throw Error('Quellenlinks bitte mit https:// angeben.');
   const clean=core.valid(candidate);
   // The id and user decision are stable; the editor remains open if saving fails.
   save(clean);showEditor=false;editing='';render();
  }catch(err){alert('Methode nicht gespeichert: '+(err.message||err));}
 });
};
const oldWizardPlan=wizardPlanStepV14;
wizardPlanStepV14=function(l){
 const html=oldWizardPlan(l),subject=core.subject(cls(l?.classId)?.subject);
 const available=methods().filter(m=>m.enabled&&(!subject||m.subjects.includes(subject)));
 const prefs=l.methodPreferencesV298||{};
 const dropdown=core.PHASES.map(([phase,label])=>{
  const options=available.filter(m=>m.phase===phase);
  return '<label>'+label+'<select data-v298-prefer="'+esc(l.id+'|'+phase)+'">'+
   '<option value="">Automatisch passend wählen</option>'+
   options.map(m=>'<option value="'+esc(m.id)+'" '+(prefs[phase]===m.id?'selected':'')+'>'+esc(m.title)+'</option>').join('')+
   '</select></label>';
 }).join('');
 const block='<section class="v298-preferences"><strong>Methodenwahl (optional)</strong>'+
 '<p>ChatGPT darf die Methodenbibliothek sinnvoll kombinieren. Hier kannst du einen Wunsch setzen; '+
 'bei ungeeigneten Materialien soll ChatGPT den Wunsch begründet nicht übernehmen.</p>'+
 '<div class="v298-pref-grid">'+dropdown+'</div></section>';
 return html.replace('<h3>Material in dieser Stunde</h3>',block+'<h3>Material in dieser Stunde</h3>');
};
const beforePrompt=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
 const prompt=beforePrompt(l),c=cls(l.classId),all=methods();
 const recent=core.recent(l,state.lessons||[],all);
 const byPhase=core.recommended(l,c,all,recent);
 const prefs=l.methodPreferencesV298||{};
 const section='\n\n## Methodenbibliothek – passendes Unterrichtsdesign, nicht Methoden-Bingo\n'+
 'Wähle für jede Phase eine fachlich sinnvolle Methode aus meiner Bibliothek; du musst nicht alle nutzen. '+
 'Keine Methode allein zur Abwechslung oder wegen ihres Namens einsetzen. Prüfe Material, Vorwissen, '+
 'Altersstufe, Zeit, Differenzierung und Lernziel. Vermeide insbesondere Expertenpuzzle/Stationen, '+
 'wenn nur ein einheitliches Arbeitsblatt vorliegt oder kein Material für unterschiedliche Teilperspektiven verfügbar ist.\n'+
 core.PHASES.map(([phase,label])=>'### '+label+'\n'+
  (prefs[phase]?'Lehrkraftwunsch: '+(all.find(m=>m.id===prefs[phase])?.title||'keiner')+
   '. Nur verwenden, wenn die Voraussetzungen erfüllt sind.\n':'')+
  (byPhase[phase]||[]).map(core.methodPrompt).join('\n')).join('\n')+
 '\nIn den vergangenen Stunden erkannt (nur als Abwechslungshinweis): '+
 (recent.length?Array.from(new Set(recent)).map(id=>all.find(m=>m.id===id)?.title||id).join(', '):'keine sicher erkennbar')+'.\n'+
 '\n## Verbindlicher didaktischer Verlauf\n'+
 'Plane eine klare Unterrichtsstunde mit Einstieg – möglichst EINER zusammenhängenden Erarbeitung '+
 '(in der Regel etwa 30 Minuten, nur soweit die tatsächliche Stundenlänge das erlaubt) – gemeinsamer Sicherung – '+
 'sinnvoller Vertiefung/Transfer bzw. Exit. Höchstens ZWEI zusammenhängende Erarbeitungsphasen; '+
 'eine Doppelstunde ist kein Freibrief für drei getrennte Arbeitsblatt-Schleifen. '+
 'Der Einstieg soll aktivieren, Neugier wecken oder Vorwissen anknüpfen; '+
 'begriffsintensive Diskussionsfragen erst nach Einführung des Begriffs. '+
 'Beispiel: Nicht „Bedeutet Dschihad immer Krieg?“ diskutieren lassen, bevor Dschihad erklärt wurde.\n'+
 'Gib pro Erarbeitungsphase GENAU EINE zusammenhängende Arbeitsauftrag-Folie aus. '+
 'Nie gleichzeitig benötigte Arbeitsanweisungen auf mehrere Folien aufteilen. '+
 'Stehen die Arbeitsaufträge bereits auf dem AB, reicht ein kurzer Verweis. '+
 'Lange Aufträge und Musterlösungen gehören in Arbeitsblätter bzw. Referentennotizen, '+
 'nicht auf drei Aufgabenfolien hintereinander.\n'+
 'Top/Flop ist OPTIONAL und ausschließlich für bereits bekanntes Vorwissen, NICHT Standard-Einstieg. '+
 'Wenn du es bewusst nutzt, eher drei bis vier fachlich gute, begründbare Aussagen, '+
 'statt mechanisch zwei. Ein Fehlerdetektiv oder ein offener Impuls kann sinnvoller sein. '+
 'Sicherungsergebnisse nicht vorab sichtbar einblenden, sondern gemeinsam entwickeln.\n'+
 'Bei Religion ermöglichen die Aufgaben Verstehen, Deuten, Begründen und Perspektivwechsel; '+
 'in Mathematik sichern sie fachliche Begriffe und tragfähige Rechen-/Problemlösewege. '+
 'Liefere keine fachlich ungerechtfertigte Kontroverse.\n'+
 '\n## Bilder und visuelle Impulse – bestehendes PPTX-Format beachten\n'+
 'Wenn ein wirklich passendes Bild, eine Karikatur oder ein Diagramm einen didaktischen Mehrwert bietet, '+
 'prüfe nach Möglichkeit Quelle, Urheberrecht und Aussagekontext. Nutze „bildimpuls“ mit imageMaterial '+
 'NUR, wenn ein exakt so benanntes PNG/JPG bereits als aktives Material im lokalen Hub vorhanden ist. '+
 'Ein bloßer Internetlink wird vom Cockpit NICHT automatisch heruntergeladen. '+
 'Fehlt das Bild, nutze eine „text“-Folie mit optionalem Bildvorschlag in den Notizen: '+
 'Suchbegriff, seriöse Quelle/URL soweit überprüft, Bildrechte soweit bekannt und die passende Folienposition. '+
 'Plane die Folie ohne vorausgesetztes Bild funktionsfähig; keine frei erfundenen Quellen/URLs. '+
 'Wenn du für diese Planung wirklich auf ein Bild angewiesen bist, benenne die fehlende Datei '+
 'als konkrete Vorbereitungsaufgabe, bevor du die PPT erzeugst.\n';
 const token='Danach hänge GENAU EINEN maschinenlesbaren Block an:';
 const i=prompt.indexOf(token);
 return i>=0?prompt.slice(0,i)+section+'\n'+prompt.slice(i):prompt+section;
};
makeBrief=concretePlanningPromptV12;
const beforeGlobalWire=wire;
wire=function(){
 beforeGlobalWire();
 document.querySelectorAll('[data-v298-prefer]').forEach(sel=>sel.onchange=()=>{
  const [lid,phase]=sel.dataset.v298Prefer.split('|'),l=lesson(lid);
  if(!l||!core.PHASES.some(x=>x[0]===phase))return;
  l.methodPreferencesV298={...(l.methodPreferencesV298||{}),[phase]:sel.value||''};
  try{saveState();}catch(err){alert('Methodenwunsch nicht gespeichert: '+(err.message||err));}
 });
};
const oldRender=render;
render=function(){
 oldRender();
 const nav=document.querySelector('.sidebar nav');
 if(nav&&!nav.querySelector('[data-view="methods"]')){
  const item=document.createElement('button');item.dataset.view='methods';
  if(view==='methods')item.className='active';
  item.innerHTML='<span>✳</span>Methodenbibliothek';
  const anchor=nav.querySelector('[data-view="improve"]');
  if(anchor)nav.insertBefore(item,anchor);else nav.append(item);
  item.onclick=()=>{view='methods';modal=null;render();};
 }
 const tag=document.querySelector('.brand small');
 if(tag)tag.textContent=state.settings.schoolYear+' · V0.29.8';
};
if(typeof window!=='undefined')window.SchulcockpitMethodsV298={methods,methodsView,core};
})();