/* Schulcockpit V0.30.2 – lightweight idea lab and tool shelf.
 * Links stay links; no scraping or automatic student-data transmission.
 * A lesson is only counted as redesigned/tried after an explicit teacher action.
 */
(function(){
'use strict';
const C=SC_IDEAS_V302;
let search='',subject='all',category='all',showArchived=false,editorId=null,
 editorOpen=false,chosenLessonId='',stageFilter='all',classFilter='all',busy=false;
function entries(){return Array.isArray(state.inspirationV302)?state.inspirationV302:C.starters();}
function mutables(){return state.inspirationV302||(state.inspirationV302=structuredClone(C.starters()));}
function byId(id){return entries().find(x=>x.id===id);}
function course(l){return cls(l?.classId);}
function seqTitle(l){return seq(l?.sequenceId)?.title||l?.unit||'';}
function labelFor(e){
 const arr=e.kind==='tool'?C.TOOL_USES:C.IDEA_KINDS;
 return arr.find(x=>x[0]===e.category)?.[1]||'Fundstück';
}
function options(xs,value){return xs.map(([id,label])=>
 '<option value="'+esc(id)+'" '+(String(value)===String(id)?'selected':'')+'>'+esc(label)+'</option>').join('');}
function statusLabel(l){return C.STAGES.find(x=>x[0]===C.lessonState(l).stage)?.[1]||'Noch offen';}
function allLessons(){
 return (state.lessons||[]).filter(C.activeLesson)
  .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||
    String(a.id).localeCompare(String(b.id)));
}
function lessonChoiceList(){
 const list=allLessons(),future=list.filter(l=>l.date>=new Date().toISOString().slice(0,10))
  .sort((a,b)=>a.date.localeCompare(b.date));
 const prior=list.filter(l=>l.date<new Date().toISOString().slice(0,10));
 const rows=[...future.slice(0,100),...prior.slice(0,70)];
 const old=chosenLessonId&&lesson(chosenLessonId);
 if(old&&!rows.some(x=>x.id===old.id))rows.unshift(old);
 return rows.map(l=>[l.id,l.date+' · '+(course(l)?.subject||'')+' '+(course(l)?.name||'')+
  ' · '+(l.planReference?.title||l.title||'Stunde')]);
}
function link(e){
 if(!e.sourceUrl)return '';
 return '<a href="'+esc(e.sourceUrl)+'" target="_blank" rel="noopener noreferrer" class="v302-external">Quelle öffnen ↗</a>';
}
function card(e,mode='list'){
 const marked=C.lessonState(chosenLessonId?lesson(chosenLessonId):null).ideaIds.includes(e.id);
 const sub=e.subjects.length?e.subjects.map(x=>C.SUBJECTS.find(y=>y[0]===x)?.[1]||x).join(' & '):'fachübergreifend / noch offen';
 const grade=e.grades.length?' · Jg. '+e.grades.join(', '):'';
 return '<article class="v302-card '+(e.archived?'archived':'')+'">'+
  '<div class="v302-card-title"><div><strong>'+esc(e.title)+'</strong>'+
  '<small>'+esc(labelFor(e))+' · '+esc(sub+grade)+'</small></div>'+
  '<span class="v302-chip '+(e.tested?'tested':'saved')+'">'+
   (e.tested?'✓ ausprobiert':e.starter?'Noch prüfen':'Gespeichert')+'</span></div>'+
  (e.description?'<p>'+esc(e.description)+'</p>':'')+
  (e.how?'<p class="v302-how"><strong>So könnte es gehen:</strong> '+esc(e.how)+'</p>':'')+
  (e.topics.length?'<div class="v302-tags">'+e.topics.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div>':'')+
  (e.needs?'<small>Benötigt: '+esc(e.needs)+'</small>':'')+
  (e.setupMinutes!==null?'<small>Vorbereitung: ca. '+esc(e.setupMinutes)+' Min. (eigene Schätzung)</small>':'')+
  (e.privacy?'<small>Zu prüfen: '+esc(e.privacy)+'</small>':'')+
  (e.materialId&&mat(e.materialId)?'<small>📎 Materialhub: '+esc(mat(e.materialId).title)+'</small>':'')+
  '<div class="v302-card-actions">'+link(e)+
   (mode==='list'?'<button type="button" class="secondary" data-v302-edit="'+esc(e.id)+'">Bearbeiten</button>'+
    '<button type="button" class="text-button" data-v302-archive="'+esc(e.id)+'">'+(e.archived?'Wiederherstellen':'Archivieren')+'</button>'+
    (!e.archived?'<button type="button" class="secondary" data-v302-pin="'+esc(e.id)+'" '+(!chosenLessonId?'disabled':'')+'>'+
      (marked?'✓ Für Stunde vorgemerkt':'Für gewählte Stunde vormerken')+'</button>':''):'')+
  '</div></article>';
}
function editor(kind){
 const existing=editorId?byId(editorId):null;
 const e=existing||{kind,title:'',category:kind==='tool'?'classroom':'hands-on',
  sourceUrl:'',materialId:'',subjects:[],grades:[],topics:[],description:'',how:'',needs:'',
  setupMinutes:null,privacy:'',tested:false,lessonIds:[]};
 const c=e.kind||kind;
 return '<section class="panel v302-editor"><div class="section-head"><div>'+
  '<span class="eyebrow">DEIN IDEENARCHIV</span><h3>'+esc(editorId?'Fundstück bearbeiten':'Neues '+(c==='tool'?'Tool':'Unterrichtsfundstück')+' speichern')+
  '</h3></div><button type="button" class="secondary" data-v302-cancel>Schließen</button></div>'+
  '<div class="v302-edit-grid">'+
  '<label>Titel / kurzer Name<input data-v302-field="title" maxlength="140" value="'+esc(e.title)+'" placeholder="'+
    (c==='tool'?'z. B. Algebra Tiles':'z. B. Gleichungen mit Streichhölzern')+'"></label>'+
  '<label>Link (optional, z. B. YouTube, Pinterest, Website)<input data-v302-field="sourceUrl" type="url" value="'+esc(e.sourceUrl||'')+
  '" placeholder="https://…"></label>'+
  '<label>Einordnung<select data-v302-field="category">'+
   options(c==='tool'?C.TOOL_USES:C.IDEA_KINDS,e.category)+'</select></label>'+
  '<fieldset><legend>Fach</legend>'+C.SUBJECTS.map(([id,name])=>
   '<label><input type="checkbox" data-v302-subject="'+id+'" '+(e.subjects?.includes(id)?'checked':'')+'>'+name+'</label>').join('')+
   '<small>Kein Häkchen = fachübergreifend oder noch nicht festgelegt</small></fieldset>'+
  '<label>Themen / Stichwörter<input data-v302-field="topics" value="'+esc((e.topics||[]).join('; '))+
   '" placeholder="z. B. Gleichungen; Terme; Gleichheitszeichen"></label>'+
  '<label>Jahrgänge (optional)<input data-v302-field="grades" value="'+esc((e.grades||[]).join(', '))+
   '" placeholder="z. B. 5, 6, 7"></label>'+
  '<label class="v302-wide">Was ist die Idee? / Was kann das Tool?<textarea rows="3" data-v302-field="description" maxlength="1200" placeholder="Eine kurze Notiz reicht – weitere Details später ergänzen.">'+esc(e.description||'')+'</textarea></label>'+
  '<details class="v302-wide v302-advanced"><summary>Optional: genauer Ablauf, Aufwand, Geräte und Datenschutz</summary>'+
  '<div class="v302-edit-grid">'+
  '<label class="v302-wide">Verknüpfte Datei aus dem Materialhub (optional)<select data-v302-field="materialId">'+
  options([['','Keine Datei verknüpfen'],...(state.materials||[]).filter(m=>m.id&&m.title).slice(0,500).map(m=>[m.id,m.title])],e.materialId||'')+
  '</select></label>'+
  '<label class="v302-wide">So könnte ich es einsetzen<textarea rows="3" data-v302-field="how" maxlength="1200">'+esc(e.how||'')+'</textarea></label>'+
  '<label>Benötigte Materialien / Geräte<input data-v302-field="needs" maxlength="450" value="'+esc(e.needs||'')+'"></label>'+
  '<label>Vorbereitung in Minuten (Schätzung)<input data-v302-field="setupMinutes" type="number" min="0" max="999" value="'+(e.setupMinutes??'')+'"></label>'+
  '<label class="v302-wide">Zu prüfende Zugänge / Datenschutz<input data-v302-field="privacy" maxlength="300" value="'+esc(e.privacy||'')+'"></label>'+
  '</div></details>'+
  '<label class="v302-checked v302-wide"><input data-v302-tested type="checkbox" '+(e.tested?'checked':'')+
  '> Habe ich selbst bereits ausprobiert</label>'+
  '</div><div class="v302-edit-actions"><button type="button" class="secondary" data-v302-cancel>Abbrechen</button>'+
  '<button type="button" class="primary" data-v302-save>In meiner Sammlung speichern ✓</button></div>'+
  '<p class="microcopy">Nur deine Notizen und Links werden gespeichert. Links werden nicht automatisch eingelesen; '+
  'bitte Urheberrecht, Zugänge und Schülerdatenschutz vor einer Nutzung prüfen.</p></section>';
}
function filtersHtml(kind){
 const cats=kind==='tool'?C.TOOL_USES:C.IDEA_KINDS;
 return '<section class="panel v302-controls"><div class="v302-controls-grid">'+
  '<label>Suchen<input data-v302-search value="'+esc(search)+'" placeholder="Thema, Tool, Stichwort …"></label>'+
  '<label>Fach<select data-v302-filter-subject>'+options([['all','Alle Fächer'],...C.SUBJECTS],subject)+'</select></label>'+
  '<label>Art<select data-v302-filter-cat>'+options([['all','Alle Arten'],...cats],category)+'</select></label>'+
  '<label class="v302-checked"><input data-v302-show-archived type="checkbox" '+(showArchived?'checked':'')+'> Archivierte zeigen</label>'+
  '</div><div class="v302-lesson-choice"><label>Für eine konkrete Stunde vormerken'+
   '<select data-v302-target-lesson><option value="">Stunde wählen …</option>'+
   options(lessonChoiceList(),chosenLessonId)+'</select></label>'+
   '<p class="microcopy">Die Zuordnung ändert nicht die bisherige Planung. Erst im Stundenassistenten kannst du die Idee bewusst zur Grundlage einer Neuplanung machen.</p>'+
  '</div></section>';
}
function library(kind){
 const items=entries().filter(e=>e.kind===kind).filter(e=>
  (showArchived||!e.archived)&&
  (subject==='all'||!e.subjects.length||e.subjects.includes(subject))&&
  (category==='all'||e.category===category)&&
  (!search||[e.title,e.description,e.how,e.needs,...(e.topics||[])].join(' ').toLocaleLowerCase('de-DE')
   .includes(search.toLocaleLowerCase('de-DE'))));
 const header=kind==='tool'?
  ['Digitale Toolbox','Tools für Lernende, Materialerstellung und Schulalltag',
   'Vom Algebra-Tile bis zum Materialgenerator: erst sammeln und prüfen, später gezielt in Stunden verwenden.']:
  ['Ideenlabor','Aus Fundstücken werden besondere Unterrichtsstunden',
   'Speichere Spiele, Experimente, Videos, Pinterest-Funde oder handlungsorientierte Aufgaben. Fach und Thema verbinden sie mit späteren Stunden.'];
 return '<div class="content-grid v302-page"><section class="hero-card v302-hero"><div>'+
  '<span class="eyebrow">'+header[0].toLocaleUpperCase('de-DE')+'</span><h2>'+header[1]+'</h2><p>'+header[2]+'</p></div>'+
  '<button class="primary" data-v302-add>+ '+(kind==='tool'?'Tool':'Idee')+' merken</button></section>'+
  (kind==='idea'?developmentSummary():'<div class="v302-starter-caption">Die fünf Startkarten wurden aus deinen genannten Tools vorgemerkt. '+
   'Nur Math Figures hat bereits einen überprüften Link; ergänze die übrigen Links nach dem Ausprobieren.</div>')+
  filtersHtml(kind)+(editorOpen?editor(kind):'')+
  '<section class="v302-list">'+(items.length?items.map(e=>card(e)).join(''):'<div class="panel">Noch nichts gefunden. Du kannst ein neues Fundstück speichern oder den Filter ändern.</div>')+'</section></div>';
}
function developmentSummary(){
 const st=C.stats(allLessons()),pct=st.total?Math.round(st.evolved/st.total*100):0;
 return '<section class="panel v302-progress"><div class="section-head"><div><span class="eyebrow">LANGFRISTIGE UNTERRICHTSENTWICKLUNG</span>'+
  '<h3>Dein Stunden-Upgrade ✨</h3></div><button class="secondary" data-v302-progress>Stundenübersicht öffnen</button></div>'+
  '<div class="v302-progress-stats"><div><strong>'+st.evolved+'</strong><small>bewusst neu gestaltet / erprobt</small></div>'+
  '<div><strong>'+st.idea+'</strong><small>Ideen vorgemerkt</small></div>'+
  '<div><strong>'+st.none+'</strong><small>ohne dokumentiertes Upgrade</small></div></div>'+
  '<progress max="'+Math.max(st.total,1)+'" value="'+st.evolved+'"></progress>'+
  '<p class="microcopy">'+pct+' % deiner '+st.total+' erfassten Unterrichtstermine sind ausdrücklich als weiterentwickelt oder erprobt markiert. '+
  'Nicht markiert bedeutet <strong>nicht</strong>, dass eine Stunde schlecht ist. '+
  'Es werden keine Unterrichtsqualitäten automatisch aus einer PowerPoint oder einem Arbeitsblatt abgeleitet.</p></section>';
}
function growth(){
 const all=allLessons();
 const courses=[...new Set(all.map(l=>l.classId))].map(id=>{const c=cls(id);return [id,((c?.subject||'')+' '+(c?.name||'')).trim()]});
 const sorted=all.filter(l=>(classFilter==='all'||l.classId===classFilter)&&
  (stageFilter==='all'||C.lessonState(l).stage===stageFilter));
 const st=C.stats(sorted);
 const rows=sorted.slice(0,90);
 return '<div class="content-grid v302-page"><section class="hero-card v302-hero"><div>'+
  '<span class="eyebrow">DEIN UNTERRICHT ÜBER DIE JAHRE</span><h2>Stundenentwicklung</h2>'+
  '<p>Vom ersten Fundstück bis zur erprobten Stunde – ohne fertige Sollpläne zu überschreiben.</p></div>'+
  '<button type="button" class="secondary" data-v302-back>← Ideenlabor</button></section>'+
  '<section class="panel"><div class="v302-growth-filters">'+
  '<label>Klasse<select data-v302-class-filter>'+options([['all','Alle Klassen'],...courses],classFilter)+'</select></label>'+
  '<label>Stand<select data-v302-stage-filter>'+options([['all','Alle Stände'],...C.STAGES],stageFilter)+'</select></label>'+
  '</div><p class="microcopy">'+st.total+' passende Unterrichtstermine · '+st.evolved+
  ' ausdrücklich als neugestaltet/erprobt markiert. Die Liste zeigt höchstens 90 Termine auf einmal.</p></section>'+
  '<div class="v302-growth-list">'+(rows.length?rows.map(l=>{
   const x=C.lessonState(l),ideas=x.ideaIds.map(byId).filter(Boolean);
   return '<article class="v302-growth-row"><div><small>'+esc(l.date||'')+' · '+esc((course(l)?.subject||'')+' '+(course(l)?.name||''))+
    '</small><strong>'+esc(l.planReference?.title||l.title||'Unterrichtsstunde')+'</strong>'+
    '<small>'+esc(ideas.map(x=>x.title).join(' · ')||'Noch keine Idee direkt für diese Stunde vorgemerkt')+'</small></div>'+
    '<div><span class="v302-stage '+esc(x.stage)+'">'+esc(statusLabel(l))+'</span>'+
    '<button type="button" class="secondary" data-v302-open-lesson="'+esc(l.id)+'">Stunde öffnen</button></div></article>';
  }).join(''):'<div class="panel">Keine passenden Stunden in diesem Filter.</div>')+'</div></div>';
}
const oldTitle=pageTitle;
pageTitle=function(){return view==='tools'?'Digitale Toolbox':view==='ideas'?'Ideenlabor':
 view==='growth'?'Stundenentwicklung':oldTitle();};
const oldHtml=viewHtml;
viewHtml=function(){return view==='tools'?library('tool'):view==='ideas'?library('idea'):
 view==='growth'?growth():oldHtml();};
function stageBlock(l,full=false){
 const x=C.lessonState(l),hits=C.candidates(entries(),l,course(l),seqTitle(l),6);
 const chosen=x.ideaIds.map(byId).filter(e=>e&&!e.archived);
 const show=[...chosen,...hits.map(h=>h.entry).filter(e=>!chosen.some(x=>x.id===e.id))].slice(0,7);
 const hasIdeas=show.length>0;
 const cards=show.map(e=>'<div class="v302-suggestion"><div><strong>'+esc(e.title)+'</strong>'+
  '<small>'+esc(labelFor(e))+(e.tested?' · bereits ausprobiert':' · noch nicht als ausprobiert bestätigt')+'</small>'+
  (e.description?'<span>'+esc(e.description.slice(0,190))+'</span>':'')+
  '</div><button type="button" class="secondary" data-v302-lesson-toggle="'+esc(l.id+'|'+e.id)+'">'+
  (x.ideaIds.includes(e.id)?'✓ Vorgemerkt':'Für Neuplanung vormerken')+'</button>'+link(e)+'</div>').join('');
 return '<section class="'+(full?'panel ':'')+'v302-lesson-panel"><div class="section-head"><div>'+
  '<span class="eyebrow">IDEENLABOR · ENTDECKEN STATT NUR ABARBEITEN</span>'+
  '<h3>Diese Stunde spielerischer oder handlungsorientierter gestalten?</h3></div>'+
  '<span class="v302-stage '+esc(x.stage)+'">'+esc(statusLabel(l))+'</span></div>'+
  (hasIdeas?'<div class="v302-suggestions">'+cards+'</div>':
   '<p class="microcopy">Zu diesem Thema ist noch keine passende Idee hinterlegt. '+
   'Im Ideenlabor kannst du zum Beispiel eine Aktivität, einen Medienimpuls oder ein Experiment merken.</p>')+
  '<p class="microcopy">Die vorhandenen Arbeitsblätter und die bisherige Präsentation bleiben erhalten. '+
  'Vorgemerkte Ideen fließen beim nächsten Kopieren des ChatGPT-Planungsprompts ein. '+
  'Die Unterrichtsstunde wird nicht automatisch umgeschrieben.</p>'+
  '<div class="v302-lesson-actions">'+
  '<button type="button" class="secondary" data-v302-open-ideas>Zum Ideenlabor</button>'+
  '<label>Entwicklungsstand dokumentieren <select data-v302-stage="'+esc(l.id)+'">'+
   options(C.STAGES.filter(([stage])=>stage!=='tried'||v182IsHeld(l)),x.stage)+'</select></label>'+
  '</div><details class="v302-lesson-note" '+(x.note?'open':'')+'>'+
  '<summary>Eigene Erfahrung / Hinweis für die nächste Durchführung</summary>'+
  '<textarea data-v302-note="'+esc(l.id)+'" maxlength="650" rows="2" placeholder="Was hat funktioniert? Was müsste ich vorbereiten oder vereinfachen?">'+esc(x.note)+'</textarea>'+
  '<button type="button" class="secondary" data-v302-save-note="'+esc(l.id)+'">Notiz speichern</button>'+
  '</details></section>';
}
const oldWizard=wizardPlanStepV14;
wizardPlanStepV14=function(l){
 const html=oldWizard(l),block=stageBlock(l,false);
 return html.includes('<h3>Material in dieser Stunde</h3>')?
  html.replace('<h3>Material in dieser Stunde</h3>',block+'<h3>Material in dieser Stunde</h3>'):
  html+block;
};
const oldDay=v182LessonDayHtml;
v182LessonDayHtml=function(l){
 const html=oldDay(l),block=stageBlock(l,true);
 return html.includes('<section class="panel v182-end-panel">')?
  html.replace('<section class="panel v182-end-panel">',block+'<section class="panel v182-end-panel">'):html+block;
};
const oldPrompt=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
 const original=oldPrompt(l),append=C.prompt(l,entries(),course(l),seqTitle(l));
 if(!append)return original;
 const key='Danach hänge GENAU EINEN maschinenlesbaren Block an:';
 const i=original.indexOf(key);
 return i>=0?original.slice(0,i)+append+'\n'+original.slice(i):original+append;
};
makeBrief=concretePlanningPromptV12;
async function changeEntries(update){
 const before=Array.isArray(state.inspirationV302)?structuredClone(state.inspirationV302):null;
 try{
  const items=mutables();update(items);
  await Promise.resolve(saveState());
  render();
 }catch(e){
  if(before)state.inspirationV302=before;else delete state.inspirationV302;
  render();throw e;
 }
}
async function changeLesson(id,update){
 const l=lesson(id);if(!l||!C.activeLesson(l))throw Error('Unterrichtsstunde nicht gefunden.');
 const before=l.innovationV302?structuredClone(l.innovationV302):null;
 try{
  l.innovationV302={...C.lessonState(l)};update(l.innovationV302,l);
  l.innovationV302.updatedAt=new Date().toISOString();
  await Promise.resolve(saveState());render();
 }catch(e){
  if(before)l.innovationV302=before;else delete l.innovationV302;
  render();throw e;
 }
}
function readForm(kind){
 const field=name=>document.querySelector('[data-v302-field="'+name+'"]')?.value||'';
 const existing=editorId?byId(editorId):null;
 const grades=field('grades').match(/\b(?:1[0-3]|[5-9])\b/g)||[];
 return C.validate({...existing,id:existing?.id||uid('idea'),kind:existing?.kind||kind,
  title:field('title'),category:field('category'),sourceUrl:field('sourceUrl'),
  materialId:field('materialId'),
  description:field('description'),how:field('how'),needs:field('needs'),
  setupMinutes:field('setupMinutes')||null,privacy:field('privacy'),
  subjects:C.SUBJECTS.map(x=>x[0]).filter(id=>document.querySelector('[data-v302-subject="'+id+'"]')?.checked),
  grades:grades.map(Number),topics:field('topics').split(';'),
  tested:!!document.querySelector('[data-v302-tested]')?.checked,
  updatedAt:new Date().toISOString(),createdAt:existing?.createdAt||new Date().toISOString()
 });
}
function openLesson(id){const l=lesson(id);if(!l)return;v182LessonId=id;modal=null;view='lessonDayV182';render();}
const oldWire=wire;
wire=function(){
 oldWire();
 document.querySelectorAll('[data-v302-open-ideas]').forEach(b=>b.onclick=()=>{view='ideas';render();});
 document.querySelectorAll('[data-v302-lesson-toggle]').forEach(b=>b.onclick=async()=>{
  const [lid,id]=b.dataset.v302LessonToggle.split('|'),entry=byId(id);
  if(!entry||entry.archived)return;
  try{await changeLesson(lid,d=>{
    const found=d.ideaIds.includes(id);
    d.ideaIds=found?d.ideaIds.filter(x=>x!==id):[...d.ideaIds,id];
    if(d.stage==='none'&&d.ideaIds.length)d.stage='idea';
    if(d.stage==='idea'&&!d.ideaIds.length)d.stage='none';
  });}
  catch(e){alert('Stundenidee nicht gespeichert: '+(e.message||e));}
 });
 document.querySelectorAll('[data-v302-save-note]').forEach(b=>b.onclick=async()=>{
  const lid=b.dataset.v302SaveNote;
  const text=document.querySelector('[data-v302-note="'+CSS.escape(lid)+'"]')?.value||'';
  try{await changeLesson(lid,d=>{d.note=text.slice(0,650);});}
  catch(e){alert('Notiz nicht gespeichert: '+(e.message||e));}
 });
 document.querySelectorAll('[data-v302-stage]').forEach(s=>s.onchange=async()=>{
  try{
   const l=lesson(s.dataset.v302Stage);
   if(s.value==='tried'&&!v182IsHeld(l))throw Error('Als erprobt markieren erst nach durchgeführter Stunde.');
   await changeLesson(l.id,d=>{
    d.stage=s.value;
    if(s.value==='tried')d.triedAt=new Date().toISOString();
   });
  }catch(e){alert('Entwicklungsstand nicht gespeichert: '+(e.message||e));render();}
 });
 if(!['tools','ideas','growth'].includes(view))return;
 document.querySelector('[data-v302-back]')?.addEventListener('click',()=>{view='ideas';render();});
 document.querySelector('[data-v302-progress]')?.addEventListener('click',()=>{view='growth';render();});
 document.querySelectorAll('[data-v302-open-lesson]').forEach(b=>b.onclick=()=>openLesson(b.dataset.v302OpenLesson));
 document.querySelector('[data-v302-stage-filter]')?.addEventListener('change',e=>{stageFilter=e.target.value;render();});
 document.querySelector('[data-v302-class-filter]')?.addEventListener('change',e=>{classFilter=e.target.value;render();});
 document.querySelector('[data-v302-add]')?.addEventListener('click',()=>{
  editorId=null;editorOpen=true;render();
 });
 document.querySelectorAll('[data-v302-edit]').forEach(b=>b.onclick=()=>{
  editorId=b.dataset.v302Edit;editorOpen=true;render();
 });
 document.querySelectorAll('[data-v302-cancel]').forEach(b=>b.onclick=()=>{editorOpen=false;editorId=null;render();});
 document.querySelector('[data-v302-target-lesson]')?.addEventListener('change',e=>{
  chosenLessonId=e.target.value;render();
 });
 document.querySelector('[data-v302-search]')?.addEventListener('change',e=>{search=e.target.value;render();});
 document.querySelector('[data-v302-filter-subject]')?.addEventListener('change',e=>{subject=e.target.value;render();});
 document.querySelector('[data-v302-filter-cat]')?.addEventListener('change',e=>{category=e.target.value;render();});
 document.querySelector('[data-v302-show-archived]')?.addEventListener('change',e=>{showArchived=e.target.checked;render();});
 document.querySelectorAll('[data-v302-pin]').forEach(b=>b.onclick=async()=>{
  if(!chosenLessonId){alert('Bitte zuerst eine Stunde wählen.');return;}
  const id=b.dataset.v302Pin,e=byId(id);if(!e||e.archived)return;
  try{await changeLesson(chosenLessonId,d=>{
   if(!d.ideaIds.includes(id))d.ideaIds.push(id);
   if(d.stage==='none')d.stage='idea';
  });}catch(err){alert('Idee nicht vorgemerkt: '+(err.message||err));}
 });
 document.querySelectorAll('[data-v302-archive]').forEach(b=>b.onclick=async()=>{
  const id=b.dataset.v302Archive,e=byId(id);if(!e)return;
  try{await changeEntries(all=>{
   const row=all.find(x=>x.id===id);if(row)row.archived=!row.archived;
  });}catch(err){alert('Archivstatus nicht gespeichert: '+(err.message||err));}
 });
 document.querySelector('[data-v302-save]')?.addEventListener('click',async()=>{
  if(busy)return;busy=true;
  try{
   const entry=readForm(view==='tools'?'tool':'idea');
   await changeEntries(all=>{
    const idx=all.findIndex(x=>x.id===entry.id);
    if(idx>=0)all[idx]=entry;else all.push(entry);
   });editorOpen=false;editorId=null;render();
  }catch(err){alert('Fundstück konnte nicht gespeichert werden: '+(err.message||err));}
  finally{busy=false;}
 });
};
const oldRender=render;
render=function(){
 oldRender();
 const nav=document.querySelector('.sidebar nav');
 if(nav){
  for(const [key,icon,label] of [['ideas','✦','Ideenlabor'],['tools','▣','Digitale Toolbox']]){
   if(nav.querySelector('[data-view="'+key+'"]'))continue;
   const button=document.createElement('button');button.dataset.view=key;
   button.className=view===key?'active':'';
   button.innerHTML='<span>'+icon+'</span>'+label;
   const before=nav.querySelector('[data-view="improve"]');
   if(before)nav.insertBefore(button,before);else nav.append(button);
   button.onclick=()=>{view=key;modal=null;editorOpen=false;render();};
  }
 }
 const version=document.querySelector('.brand small');
 if(version)version.textContent=(state.settings?.schoolYear||'')+' · V0.30.3';
};
if(typeof window!=='undefined')window.SchulcockpitIdeasV302={
 entries,card,stageBlock,library,developmentSummary,prompt:concretePlanningPromptV12,
 core:C
};
})();