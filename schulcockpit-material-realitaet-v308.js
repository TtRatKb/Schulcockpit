/* Schulcockpit V0.30.8 – one effective lesson material list, no stale
 * Soll instructions in AI prompts; explicitly postpone book/AH/worksheets
 * for any future hour, rather than forcing immediate continuation.
 */
(function(){
'use strict';
const C=SC_MATERIAL_REALITY_V308;
const oldPrompt=concretePlanningPromptV12;
const oldWizard=wizardPlanStepV14;
const oldDay=v182LessonDayHtml;
const oldRelevant=v182RelevantMaterials;
const oldWeekCard=lessonMaterialCardV14;
let busy=false;
function resources(l){return (allResourceRowsV176(l)||[]).filter(r=>
 v183IsActive(l,r.hint)&&r.type!=='ignore');}
function actualLast(l){
 return (state.lessons||[]).filter(x=>x.classId===l.classId&&x.id!==l.id&&
 v182IsHeld(x)&&!v182IsCanceled(x)&&(x.date<l.date||
 x.date===l.date&&Number(x.slot||0)<Number(l.slot||0)))
 .sort((a,b)=>b.date.localeCompare(a.date)||Number(b.slot||0)-Number(a.slot||0)).slice(0,2);
}
function deferrals(l){
 if(!l||!l.classId)return [];
 return C.pending(state.lessons||[],l.classId,l.date,
  x=>v182IsHeld(x)&&!v182IsCanceled(x));
}
function deferralPanel(l){
 if(!l||v182IsHeld(l)||v182IsCanceled(l))return '';
 const all=deferrals(l),waiting=all.filter(x=>!x.assignedLessonId||x.assignedLessonId===l.id);
 if(!waiting.length)return '';
 const entries=waiting.slice(-18);
 return '<details class="v308-later panel"><summary>📚 Für später vorgemerkt · '+entries.length+
 ' Buch-/Arbeitsheftaufträge oder Arbeitsblätter <small>(freiwillig öffnen)</small></summary>'+
 '<p class="microcopy">Diese Aufgaben wurden in einer früheren Stunde nicht abgeschlossen und ausdrücklich '+
 'für später vorgemerkt. Sie wandern NICHT automatisch in jede nächste Stunde. '+
 'Du entscheidest, wann sie wieder drankommen.</p>'+
 entries.map(e=>{
  const active=(l.deferredLinksV308||[]).some(x=>x.key===e.key);
  const key=l.id+'|'+encodeURIComponent(e.key);
  return '<div class="v308-later-row"><div><strong>'+esc(e.title)+'</strong>'+
   '<small>'+esc(e.sourceDate)+' · '+(e.status==='partial'?'teilweise bearbeitet':'noch nicht verwendet')+
   (e.printed==='yes'?' · bereits ausgedruckt':'')+'</small></div>'+
   (active?'<button class="secondary" data-v308-detach="'+esc(key)+'">Aus dieser Stunde lösen</button>':
   '<button class="primary" data-v308-attach="'+esc(key)+'">In dieser Stunde verwenden</button>')+
   '</div>';
 }).join('')+'</details>';
}
function excluded(l){
 const hidden=(l.hiddenResourceKeysV183||[]),manual=l.resourceManualV183||{},
  hiddenSet=new Set([...hidden,...Object.entries(manual).filter(([,v])=>v?.cleared).map(([k])=>k)]);
 return rawResourceLinesV14(l).filter(h=>hiddenSet.has(resourceKeyV14(h))||
  resourceTypeV14(l,h)==='ignore');
}
function hiddenMaterialIds(l){
 const off=new Set();
 for(const hint of excluded(l)){
  const b=resourceBundleV176(l,hint);
  for(const ent of b?.items||[])off.add(ent.materialId);
  if(!b?.items?.length){const m=bestMaterialMatchV12(hint);if(m)off.add(m.id);}
 }
 for(const d of Object.values(l.worksheetReuseV305?.suppressed||{}))
  for(const p of d.plans||[])if(p.materialId)off.add(p.materialId);
 return off;
}
v182RelevantMaterials=function(l){
 const previous=oldRelevant(l);
 if(!l)return previous;
 const hiddenKeys=new Set(excluded(l).map(resourceKeyV14)),
  offIds=hiddenMaterialIds(l),
  onIds=new Set(resources(l).flatMap(r=>
   (r.bundleItemsV176||[]).map(x=>x.materialId).concat(r.material?.id?[r.material.id]:[])));
 return previous.filter(m=>{
  if(m.hint)return !hiddenKeys.has(resourceKeyV14(m.hint));
  if(m.material?.id||m.id){
   const id=m.material?.id||m.id;
   if(offIds.has(id)&&!onIds.has(id))return false;
  }
  return true;
 });
};
function currentMaterialHtml(l){
 const rs=C.materialRows(resources(l));
 const list=rs.map(r=>r.name);
 return '<p class="v308-current-note"><strong>Aktuell für diese Stunde:</strong> '+
 (list.length?list.map(esc).join(' · '):'Keine Hauptmaterialien ausgewählt')+
 '</p>'+
 (excluded(l).length?'<details class="v308-old-soll"><summary>Ursprüngliche, jetzt ausgeblendete '+
 'Materialhinweise anzeigen</summary>'+
 '<p>'+excluded(l).map(esc).join(' · ')+'</p></details>':'');
}
v182LessonDayHtml=function(l){
 let h=oldDay(l);
 if(!l)return h;
 h=h.replace(/<p class="v182-plan-hint">[\s\S]*?<\/p>/,currentMaterialHtml(l));
 const extra=deferralPanel(l);
 if(extra)h=h.replace('<section class="panel v182-end-panel">',extra+
  '<section class="panel v182-end-panel">');
 return h;
};
wizardPlanStepV14=function(l){
 let h=oldWizard(l);
 const extra=deferralPanel(l);
 const binding='<div class="v308-material-truth">'+
 '<strong>Nur die aktiven Materialien zählen für den ChatGPT-Prompt.</strong>'+
 '<p>Entfernte Einträge bleiben ausschließlich im Reihenplan-Archiv und werden '+
 'nicht mehr als erforderliches Material gezeigt. Buch/AH-Seiten sind keine Druckdateien.</p>'+
 '</div>';
 h=h.replace('<h3>Material in dieser Stunde</h3>',
  binding+'<h3>Material in dieser Stunde</h3>');
 if(extra)h=h.replace('<div class="wizard-footer-v14">',extra+
  '<div class="wizard-footer-v14">');
 const cognitive=l.cognitiveEntryV308||{count:3,mode:'auto'};
 const conf=C.cognitiveConfig(cognitive);
 const field='<section class="v308-cognition"><div><strong>Kognitiver Einstieg</strong>'+
 '<p>Für Top/Flop, Fehlerdetektiv oder Impulsaufgaben – Anzahl selbst festlegen. '+
 'Auf fachlich plausible typische Fehler aus den letzten Stunden achten.</p></div>'+
 '<label>Anzahl der Aufgaben<select data-v308-count="'+esc(l.id)+'">'+
 [1,2,3,4,5,6].map(n=>'<option value="'+n+'" '+(n===conf.count?'selected':'')+'>'+n+'</option>').join('')+
 '</select></label>'+
 '<label>Einstiegsformat<select data-v308-mode="'+esc(l.id)+'">'+
 [['auto','Sinnvoll auswählen'],['topflop','Top oder Flop'],['fehlerdetektiv','Fehlerdetektiv'],
 ['impuls','Kurze Impulsfragen']].map(([v,t])=>
 '<option value="'+v+'" '+(v===conf.mode?'selected':'')+'>'+t+'</option>').join('')+
 '</select></label></section>';
 h=h.replace('<h3>Material in dieser Stunde</h3>',
  field+'<h3>Material in dieser Stunde</h3>');
 return h;
};
lessonMaterialCardV14=function(l){
 const h=oldWeekCard(l);
 if(!l)return h;
 // Archived hints are still accessible on explicit request. Keep them
 // collapsed and clearly distinct from active copying or classwork rows.
 return h;
};
concretePlanningPromptV12=function(l){
 if(!l)return oldPrompt(l);
 let text=C.strictPrompt(oldPrompt(l),resources(l));
 const instructions=C.cognitivePrompt(l.cognitiveEntryV308,actualLast(l));
 const deferred=(l.deferredLinksV308||[]).map(link=>{
  const origin=deferrals(l).find(x=>x.key===link.key);
  return origin?'- '+origin.title+' (aus Stunde vom '+origin.sourceDate+
   '): NUR den damals nicht geschafften Teil bearbeiten/besprechen. '+
   (origin.printed==='yes'||origin.status==='partial'?'NICHT erneut drucken.':'Nur falls noch nicht ausgegeben: Kopien separat prüfen.'):'';
 }).filter(Boolean);
 const pending=deferred.length?'\n## Bewusst aus einer früheren Stunde herübergenommen\n'+
 deferred.join('\n')+'\n':'';
 const needle='Danach hänge GENAU EINEN maschinenlesbaren Block an:',pos=text.indexOf(needle);
 const guide='\n\n'+instructions+pending;
 return pos>=0?text.slice(0,pos)+guide+'\n'+text.slice(pos):text+guide;
};
makeBrief=concretePlanningPromptV12;
const oldImportPanel=wizardImportStepV14;
wizardImportStepV14=function(l){
 const h=oldImportPanel(l);
 if(!wizardV14.parsed)return h;
 const issues=C.coverageIssues(resources(l),wizardV14.parsed);
 if(!issues.length)return h;
 const warning='<section class="v308-import-warning" role="alert">'+
 '<strong>⚠ Buch-/Arbeitsheftauftrag fehlt möglicherweise im ChatGPT-Entwurf</strong>'+
 '<p>Der Plan nennt diese von dir hinterlegten Buch-/AH-Aufträge nicht erkennbar in '+
 'den Arbeitsphasen oder Folien. Ein bloßer Eintrag in der Materialliste reicht nicht.</p>'+
 '<ul>'+issues.map(x=>'<li>'+esc(x.hint)+' · '+esc(x.reason)+'</li>').join('')+'</ul>'+
 '<p>Am besten ChatGPT mit den genannten Seiten konkret korrigieren lassen und die '+
 'Antwort erneut prüfen. Eine bewusste Übernahme ist nach Rückfrage weiterhin möglich.</p>'+
 '</section>';
 return h.replace('<div class="wizard-footer-v14">',warning+'<div class="wizard-footer-v14">');
};
function attach(l,uid){
 if(!l||v182IsHeld(l)||v182IsCanceled(l))throw Error('Diese Stunde ist bereits gehalten oder ausgefallen.');
 const entry=deferrals(l).find(x=>x.key===uid);
 if(!entry)throw Error('Dieses vorgemerkte Material wurde nicht gefunden oder ist schon anderweitig eingeplant.');
 if(entry.assignedLessonId&&entry.assignedLessonId!==l.id)throw Error('Das Material ist bereits für eine andere Stunde vorgemerkt.');
 l.deferredLinksV308=l.deferredLinksV308||[];
 if(l.deferredLinksV308.some(x=>x.key===uid))return;
 const hint=entry.hint||entry.title;
 const oldHint=rawResourceLinesV14(l).some(h=>resourceKeyV14(h)===resourceKeyV14(hint));
 const k=resourceKeyV14(hint);
 const oldType=l.resourceOverrides?.[k]||'';
 const wasHidden=(l.hiddenResourceKeysV183||[]).includes(k);
 if(!oldHint){l.customResourceHintsV176=l.customResourceHintsV176||[];
  l.customResourceHintsV176.push(hint);}
 if(wasHidden)l.hiddenResourceKeysV183=l.hiddenResourceKeysV183.filter(x=>x!==k);
 if(l.resourceManualV183?.[k])delete l.resourceManualV183[k];
 const type=entry.status==='partial'||entry.printed==='yes'?'reference':
  /^buch\b|^ah\b|arbeitsheft\b|seite\s*\d/i.test(hint)?'reference':'print';
 setResourceTypeV14(l,hint,type);
 if(entry.materialId&&entry.variantId&&mat(entry.materialId)&&variant(entry.materialId,entry.variantId)){
  const b=resourceBundleV176(l,hint,true);
  b.items=b.items||[];
  if(!b.items.some(x=>x.materialId===entry.materialId&&x.variantId===entry.variantId))
   b.items.push({id:uidFn(),materialId:entry.materialId,variantId:entry.variantId});
  b.complete=true;b._v183Manual=true;b.archivedV183=false;
  l.materials=l.materials||[];
  if(!l.materials.includes(entry.materialId))l.materials.push(entry.materialId);
  // Moving work back into a lesson must not silently create a print order.
  const p=(l.printPlan||[]).find(p=>p.materialId===entry.materialId&&
   p.variantId===entry.variantId);
  if(p&&type==='reference')p.needed=false;
 }
 // When the immediately preceding lesson marked an item 'later', V306
 // normally suppresses it. Explicitly choosing THIS lesson overrides that
 // suppression without reviving any unrelated worksheet.
 l.worksheetReuseV305=l.worksheetReuseV305||{};
 const repeats=new Set(l.worksheetReuseV305.repeat||[]);
 const repeatAdded=!repeats.has(entry.itemId);
 repeats.add(entry.itemId);l.worksheetReuseV305.repeat=[...repeats];
 l.deferredLinksV308.push({key:uid,sourceId:entry.sourceId,hint,
  materialId:entry.materialId,variantId:entry.variantId,
  addedHint:!oldHint,oldType,wasHidden,repeatAdded,sourceItemId:entry.itemId,
  linkedAt:new Date().toISOString()});
}
function uidFn(){return uid('bundle');}
function detach(l,uid){
 if(!l||v182IsHeld(l))throw Error('Gehaltene Stunden können nicht nachträglich umgeordnet werden.');
 const item=l.deferredLinksV308?.find(x=>x.key===uid);if(!item)return;
 l.deferredLinksV308=l.deferredLinksV308.filter(x=>x.key!==uid);
 if(item.repeatAdded&&l.worksheetReuseV305)
  l.worksheetReuseV305.repeat=(l.worksheetReuseV305.repeat||[]).filter(x=>x!==item.sourceItemId);
 const other=(l.deferredLinksV308||[]).some(x=>resourceKeyV14(x.hint)===resourceKeyV14(item.hint));
 if(other)return;
 const k=resourceKeyV14(item.hint);
 if(item.addedHint)
  l.customResourceHintsV176=(l.customResourceHintsV176||[]).filter(x=>resourceKeyV14(x)!==k);
 const b=resourceBundleV176(l,item.hint);
 if(b&&item.materialId&&item.variantId){
  b.items=(b.items||[]).filter(x=>x.materialId!==item.materialId||x.variantId!==item.variantId);
 }
 if(item.oldType)setResourceTypeV14(l,item.hint,item.oldType);
 else if(l.resourceOverrides)delete l.resourceOverrides[k];
 if(item.wasHidden){
  l.hiddenResourceKeysV183=l.hiddenResourceKeysV183||[];
  if(!l.hiddenResourceKeysV183.includes(k))l.hiddenResourceKeysV183.push(k);
 }
 // Existing material catalog records and other hour links stay untouched;
 // loose l.materials references may be used by other resource hints.
}
const oldWire=wire;
wire=function(){
 oldWire();
 // v185 applies the current textbox, not necessarily the earlier parsed
 // preview. Check the latest actual AI import BEFORE that handler can mutate
 // the lesson. If the teacher declines, stop the event at capture phase.
 const apply=document.querySelector('[data-v14-apply-answer]');
 if(apply)apply.addEventListener('click',event=>{
  const l=wizardLessonV14();if(!l)return;
  let pkg=null;try{pkg=parseAiImport(document.getElementById('v14-answer')?.value||wizardV14.raw||'');}
  catch{return;} // let the established parser show its diagnostic
  const issues=C.coverageIssues(resources(l),pkg);
  if(issues.length&&!confirm('Die folgenden verbindlichen Buch-/AH-Aufträge kommen im '+
    'importierten Aufgabenverlauf nicht eindeutig vor:\n\n'+
    issues.map(x=>'• '+x.hint).join('\n')+
    '\n\nTrotzdem diesen Plan übernehmen? Nein = erst in ChatGPT korrigieren lassen.')){
   event.preventDefault();event.stopImmediatePropagation();
  }
 },true);
 document.querySelectorAll('[data-v308-count],[data-v308-mode]').forEach(el=>{
  el.onchange=()=>{
   const field=el.hasAttribute('data-v308-count')?'count':'mode';
   const l=lesson(el.getAttribute('data-v308-'+field));if(!l)return;
   l.cognitiveEntryV308=l.cognitiveEntryV308||{count:3,mode:'auto'};
   l.cognitiveEntryV308[field]=field==='count'?Number(el.value):el.value;
   l.cognitiveEntryV308=C.cognitiveConfig(l.cognitiveEntryV308);
   saveState();render();
  };
 });
 for(const [verb,callback] of [['attach',attach],['detach',detach]]){
  document.querySelectorAll('[data-v308-'+verb+']').forEach(b=>b.onclick=async()=>{
   if(busy)return;
   const raw=b.getAttribute('data-v308-'+verb),i=raw.indexOf('|');
   if(i<0)return;
   const l=lesson(raw.slice(0,i)),ref=decodeURIComponent(raw.slice(i+1));
   const original=l?structuredClone(l):null;busy=true;
   try{callback(l,ref);await Promise.resolve(saveState());render();}
   catch(err){if(l&&original)Object.assign(l,original);
    alert('Material konnte nicht umgeplant werden: '+(err.message||err));render();}
   finally{busy=false;}
  });
 }
 document.querySelectorAll('[data-v183-hide]').forEach(b=>{
  const orig=b.onclick;
  if(typeof orig!=='function')return;
  b.onclick=()=>{
   const id=b.dataset.v183Hide||'',l=lesson(id.split('|')[0]);
   if(l&&typeof v183ShowArchived!=='undefined')v183ShowArchived.delete(l.id);
   orig();
  };
 });
};
const oldRender=render;
render=function(){
 oldRender();
 const v=document.querySelector('.brand small');
 if(v)v.textContent=state.settings.schoolYear+' · V0.30.8';
};
if(typeof window!=='undefined')window.SchulcockpitMaterialRealityV308={
 core:C,resources,excluded,deferrals,deferralPanel,attach,detach
};
})();