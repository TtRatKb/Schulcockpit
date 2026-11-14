/* Schulcockpit V0.32.3 – schnelle Unterrichtsreflexion, sichtbar bei
 * Wiederverwendung. Bestehende V182/V306-Felder sind weiterhin maßgeblich.
 */
(function(){
'use strict';
const C=window.SchulcockpitQuickReflectionCoreV323;
if(!C)throw Error('Blitzreflexion: Kernmodul fehlt.');
const oldReflection=v182ReflectionHtml;
function quickPanel(l){
 const r=v182GetReflection(l),chosen=Object.keys(C.PRESETS).filter(key=>C.active(r,key));
 return '<div class="v323-quick" aria-label="Blitzreflexion">'+
  '<div class="v323-quick-head"><div><span class="eyebrow">⚡ BLITZREFLEXION</span>'+
  '<h3>Was soll ich mir fürs nächste Mal merken?</h3></div>'+
  (r.completedAt?'<span class="v323-done">✓ Gespeichert</span>':'')+'</div>'+
  '<p>Ein oder zwei passende Aussagen anklicken, dann speichern. Du musst keine langen Notizen schreiben.</p>'+
  '<div class="v323-chips">'+Object.entries(C.PRESETS).map(([key,config])=>
   '<button type="button" class="v323-chip'+(C.active(r,key)?' active':'')+'" data-v323-choice="'+
    esc(l.id+'|'+key)+'" aria-pressed="'+(C.active(r,key)?'true':'false')+'">'+
    (C.active(r,key)?'✓ ':'')+esc(config.label)+'</button>').join('')+'</div>'+
  '<label class="v323-note">Ein Satz fürs nächste Mal (optional)'+
   '<input type="text" data-v323-note="'+esc(l.id)+'" maxlength="2500" value="'+esc(r.note||'')+'" '+
   'placeholder="z. B. Einstieg mit Material A wiederverwenden"></label>'+
  '<div class="v323-save-row"><button class="primary" type="button" data-v323-save="'+esc(l.id)+'">'+
  'Reflexion speichern ✓</button>'+
  '<span>'+((r.completedAt&&!chosen.length)?'Bereits reflektiert':'Weitere Details unten optional')+'</span></div>'+
  '<p class="microcopy">Der Arbeitsblatt-Ist-Stand ist separat unten dokumentierbar. Hier wird kein Blatt automatisch als bearbeitet markiert.</p>'+
  '</div>';
}
v182ReflectionHtml=function(l){
 const html=oldReflection(l);
 if(!l||!v182IsHeld(l)||!html.includes('v306-reflection'))return html;
 const marker='<div class="v306-step"><h3><span>1</span> Wie lief die Stunde?</h3>';
 if(!html.includes(marker))return html;
 const out=html.replace(marker,quickPanel(l)+
  '<details class="v323-details"><summary>Arbeitsblätter, ausführliche Bewertung und weitere Hinweise</summary>'+marker);
 // The outer section is the last tag; all existing form controls remain wired.
 const i=out.lastIndexOf('</section>');
 return i<0?out:out.slice(0,i)+'</details>'+out.slice(i);
};
function memory(l){
 if(!l||v182IsHeld(l)||v182IsCanceled(l))return '';
 const history=window.SchulcockpitLessonMemoryV295?.findings?.(
  l,state.lessons||[],state.classes||[],3)||[];
 if(!history.length)return '';
 const enriched=C.evidence(history);
 const recent=enriched[0];
 const summary=recent.hints.length?recent.hints.map(h=>'<li>'+esc(h)+'</li>').join(''):
  '<li>Reflexion vorhanden – Details vor der Wiederverwendung prüfen.</li>';
 return '<section class="panel v323-memory"><div class="v323-memory-head">'+
  '<div><span class="eyebrow">AUS FRÜHEREM UNTERRICHT</span>'+
  '<h3>Das solltest du beim erneuten Planen wissen</h3></div>'+
  '<span class="v323-memory-count">'+enriched.length+' Erfahrung'+(enriched.length===1?'':'en')+'</span></div>'+
  '<p>Passendes Fach, passende Klassenstufe und dasselbe Stundenthema. Deine aktuelle Planung wird nicht automatisch überschrieben.</p>'+
  '<div class="v323-memory-primary"><strong>Letzter Durchlauf · '+esc(recent.date.split('-').reverse().join('.'))+'</strong>'+
  '<ul>'+summary+'</ul>'+
  (recent.note?'<p><strong>Deine damalige Notiz (nur lokal):</strong> '+esc(recent.note.slice(0,900))+'</p>':'')+
  '<button class="text-button" type="button" data-v323-past="'+esc(recent.id)+'">Alte Stunde öffnen</button></div>'+
  (enriched.length>1?'<details class="v323-memory-older"><summary>Weitere Erfahrungen ('+(enriched.length-1)+')</summary>'+
   enriched.slice(1).map(x=>'<div><strong>'+esc(x.date.split('-').reverse().join('.'))+' · '+esc(x.title)+'</strong>'+
    '<p>'+esc(x.hints.join(' · ')||x.note?.slice(0,250)||'Reflexion gespeichert')+'</p>'+
    '<button type="button" class="text-button" data-v323-past="'+esc(x.id)+'">Stunde ansehen</button></div>').join('')+
   '</details>':'')+
  '<p class="microcopy">Nur strukturierte Hinweise gelangen in den Planungs-Prompt; Freitextnotizen werden nicht automatisch an ChatGPT weitergegeben.</p></section>';
}
function withoutOldMemory(html){
 // V295 panel contains details but no nested sections; replace that rendering,
 // not its underlying reflection lookup or data.
 return html.replace(/<section class="panel v295-memory">[\s\S]*?<\/section>/,'');
}
const beforeWizard=wizardPlanStepV14;
wizardPlanStepV14=function(l){
 const html=beforeWizard(l),info=memory(l);
 if(!info)return html;
 const base=withoutOldMemory(html),mark='<h3>Material in dieser Stunde</h3>';
 return base.includes(mark)?base.replace(mark,info+mark):base.replace('</section>',info+'</section>');
};
const beforeDay=v182LessonDayHtml;
v182LessonDayHtml=function(l){
 const html=beforeDay(l),info=memory(l);
 if(!info)return html;
 const base=withoutOldMemory(html),mark='<section class="panel v182-end-panel">';
 return base.includes(mark)?base.replace(mark,info+mark):base;
};
const oldPrompt=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
 const txt=oldPrompt(l);
 if(!l||v182IsHeld(l)||v182IsCanceled(l))return txt;
 const prior=window.SchulcockpitLessonMemoryV295?.findings?.(
  l,state.lessons||[],state.classes||[],1)||[];
 return txt+C.promptHints(prior);
};
makeBrief=concretePlanningPromptV12;
let updating=false;
async function choose(id,key){
 const l=lesson(id);
 if(!l||!v182IsHeld(l)||v182IsCanceled(l))throw Error('Die Stunde wurde noch nicht gehalten.');
 if(updating)return;
 updating=true;
 const before=l.reflectionV182?structuredClone(l.reflectionV182):null;
 try{
  const next=C.apply(v182GetReflection(l),key);
  l.reflectionV182=next;
  await Promise.resolve(saveState());
 }catch(e){
  if(before)l.reflectionV182=before;else delete l.reflectionV182;
  throw e;
 }finally{updating=false;render();}
}
function openPast(id){
 const l=lesson(id);if(!l)return;
 v182LessonId=l.id;modal=null;view='lessonDayV182';render();
}
const oldWire=wire;
wire=function(){
 oldWire();
 for(const btn of document.querySelectorAll('[data-v323-choice]'))btn.onclick=()=>{
  const [id,key]=btn.dataset.v323Choice.split('|');
  void choose(id,key).catch(err=>alert('Blitzreflexion nicht gespeichert: '+(err.message||err)));
 };
 for(const el of document.querySelectorAll('[data-v323-note]'))el.addEventListener('input',()=>{
  const l=lesson(el.dataset.v323Note);if(!l)return;
  v182GetReflection(l).note=el.value;
  const advanced=document.querySelector('#v182-reflection-note');
  if(advanced)advanced.value=el.value;
 });
 for(const btn of document.querySelectorAll('[data-v323-save]'))btn.onclick=()=>{
  const l=lesson(btn.dataset.v323Save);
  if(!l)return;
  const note=document.querySelector('[data-v323-note="'+btn.dataset.v323Save+'"]')?.value||'';
  const advanced=document.querySelector('#v182-reflection-note');
  if(advanced)advanced.value=note;
  const fn=window.SchulcockpitWorksheetFlowV306?.finish;
  if(fn){btn.disabled=true;void fn(l,false).finally(()=>{if(btn.isConnected)btn.disabled=false;});}
  else document.querySelector('[data-v182-save-reflection]')?.click();
 };
 for(const btn of document.querySelectorAll('[data-v323-past]'))btn.onclick=()=>openPast(btn.dataset.v323Past);
 // The daily dashboard's original button opens an older generic modal;
 // for completed lessons, go directly to the real reflection surface.
 if(view==='dayV320')for(const btn of document.querySelectorAll('[data-v320-open]')){
  const l=lesson(btn.dataset.v320Open);
  if(!v182IsHeld(l))continue;
  btn.textContent='⚡ Reflexion öffnen';
  btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openPast(l.id);},true);
 }
};
const oldRender=render;
render=function(){
 oldRender();
 const badge=document.querySelector('.brand small');
 if(badge)badge.textContent=(state.settings?.schoolYear||'')+' · V0.32.3';
};
window.SchulcockpitQuickReflectionV323={choose,memory};
})();
