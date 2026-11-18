/* V0.33.2 – One worksheet-package action and explicit print quantities.
 * Existing lesson/catalog files stay intact. In particular, no re-upload is
 * required to amend which source hints an already-uploaded edition replaces.
 */
(function(){
'use strict';
const P=SC_MATERIAL_PACKAGES_V332;
let mapping=null,busy=false;
const own=l=>P.coveredHints(l,state.materials||[]);
const digital=l=>P.digital(cls(l.classId),l);
const allHints=l=>{
 const list=allResourceRowsV176(l).filter(r=>
  (r.type==='print'||r.type==='ignore')&&r.hint).map(r=>r.hint);
 return [...new Set(list)];
};
function primary(l){
 const hints=allResourceRowsV176(l).filter(r=>r.type==='print'&&v183IsActive(l,r.hint));
 return hints.find(r=>!P.hidden(l,state.materials).has(P.key(r.hint)))?.hint||'';
}
function packagePanel(l){
 if(!l||v182IsHeld(l))return '';
 const current=own(l),starts=primary(l);
 if(!starts&&!current.length)return '';
 const covered=current.map(c=>'<div class="v332-mapping"><strong>'+
  esc(state.materials.find(m=>m.id===c.materialId)?.title||c.primary||'Eigene Fassung')+
  '</strong><small>Ersetzt: '+[c.primary,...c.extras].map(x=>esc(x)).join(' + ')+
  '</small><button type="button" class="secondary" data-v332-map="'+esc(l.id+'|'+encodeURIComponent(c.key))+
  '">Ersetzte Originale überprüfen →</button></div>').join('');
 return '<section class="v332-package"><span class="eyebrow">GEMEINSAMES MATERIALPAKET</span>'+
 '<h3>Arbeitsblätter für diese Stunde</h3><p>Einmal eigene Fassungen hochladen. '+
 'Wähle im Dialog, welche bisherigen Arbeitsblätter dadurch ersetzt werden. '+
 'Die Originale bleiben im Verlauf erhalten.</p>'+
 '<button type="button" class="primary" data-v332-upload="'+esc(l.id)+
 '">+ Materialpaket überarbeiten / zusammenführen</button>'+
 (current.length?'<div class="v332-mappings">'+covered+'</div>':'')+
 '</section>';
}
function selectedGroups(l){
 const rows=allResourceRowsV176(l).filter(r=>r.type==='print'&&v183IsActive(l,r.hint)
  &&!P.hidden(l,state.materials||[]).has(P.key(r.hint)));
 const groups=new Map();
 for(const r of rows){
  const rule=l.worksheetChoicesV276?.[resourceKeyV14(r.hint)];
  const bundle=r.bundleItemsV176||[];
  for(const link of bundle){
   if(!link.materialId)continue;
   const material=mat(link.materialId);if(!material)continue;
   const group=groups.get(material.id)||{material,variants:[]};
   const chosen=new Set(rule?.chosenNames||[]);
   const vars=rule?(material.variants||[]).filter(v=>chosen.has(v.fileName)):
    (material.variants||[]).filter(v=>v.id===link.variantId);
   for(const v of vars)if(!group.variants.some(a=>a.id===v.id))group.variants.push(v);
   groups.set(material.id,group);
  }
 }
 return [...groups.values()].filter(g=>g.variants.length);
}
function copiesPanel(l){
 if(!l||v182IsHeld(l))return '';
 const list=selectedGroups(l),c=cls(l.classId),isDigital=digital(l);
 const option=l.materialDeliveryV332||'inherit';
 const delivery='<div class="v332-delivery"><label>Bereitstellung dieser Stunde '+
 '<select data-v332-lesson-delivery="'+esc(l.id)+'">'+
 [['inherit','Kursvorgabe ('+(P.digital(c)?'digital':'Papier')+')'],
 ['digital','Nur digital / keine Kopien'],['print','Ausdrucken (Ausnahme)']].map(([id,label])=>
 '<option value="'+id+'" '+(option===id?'selected':'')+'>'+esc(label)+'</option>').join('')+
 '</select></label><strong>'+(isDigital?'📱 Digital: 0 Kopien im Druckpaket':
 '🖨️ Papier: Mengen pro Fassung')+'</strong></div>';
 const itemList=list.map(({material,variants})=>{
  const plans=(l.printPlan||[]).filter(p=>p.materialId===material.id);
  const proposed=P.defaults(variants,Number(c?.students)||0,plans);
  const fields=variants.map(v=>{
   const old=plans.find(p=>p.variantId===v.id);
   const role=v.type==='support'?'Grundversion / mit Hilfen':
    v.type==='challenge'?'Erweiterte Fassung':v.type==='solution'?'Lösung / Erwartungshorizont':
    variantLabelV15(v.type||'standard');
   const value=old?.manualCountV332?Number(old.count)||0:
    old?.needed?Number(old.count)||0:(isDigital?0:proposed[v.id]||0);
   return '<label class="v332-count-row"><span><strong>'+esc(v.fileName||material.title)+
    '</strong><small>'+esc(role)+(v.type==='solution'?' · nicht für Schülerinnen und Schüler':'')+
    '</small></span><input type="number" min="0" max="500" step="1" value="'+value+
    '" data-v332-count="'+esc(l.id+'|'+material.id+'|'+v.id)+'" '+
    (v.type==='solution'?'disabled':'')+'><small>Exemplare</small></label>';
  }).join('');
  return '<div class="v332-print-group" data-v332-group="'+esc(l.id+'|'+material.id)+'">'+
   '<div class="v332-group-head"><strong>'+esc(material.title)+
   '</strong><span>'+variants.length+' Fassung(en)</span></div>'+
   fields+'<div class="v332-presets"><button type="button" class="secondary" data-v332-preset="'+
    esc(l.id+'|'+material.id+'|split')+'">2/3 Standard · 1/3 Grund</button>'+
   '<button type="button" class="secondary" data-v332-preset="'+
    esc(l.id+'|'+material.id+'|group')+'">Gruppenarbeit (4er)</button>'+
   '<button type="button" class="secondary" data-v332-preset="'+
    esc(l.id+'|'+material.id+'|none')+'">0 Kopien</button></div></div>';
 }).join('');
 return '<section class="v332-copies"><h3>Digital oder drucken? · Mengen nach Fassung</h3>'+
 '<p>Kopiermengen sind je Stunde und Datei einstellbar. Grundversion bedeutet '+
 'nicht automatisch Förderstatus. Bei Gruppenarbeit kannst du die benötigten Sätze '+
 'direkt reduzieren. Ein digitaler Kurs wird nicht ins Druckpaket aufgenommen.</p>'+
 delivery+(list.length?itemList:'<p>Für diese Stunde sind noch keine druckbaren Materialdateien verknüpft.</p>')+
 '<div class="v332-save"><button type="button" class="primary" data-v332-save-copies="'+esc(l.id)+
 '">Mengen speichern</button></div></section>';
}
const oldWizard=wizardPlanStepV14;
wizardPlanStepV14=function(l){
 let html=oldWizard(l);
 const view=packagePanel(l)+copiesPanel(l);
 return view?html.replace('<h3>Material in dieser Stunde</h3>',
  view+'<h3>Material in dieser Stunde</h3>'):html;
};
const oldCard=lessonMaterialCardV14;
lessonMaterialCardV14=function(l){
 const html=oldCard(l),body=packagePanel(l)+copiesPanel(l);
 return body&&html.includes('<div class="lesson-material-body-v176">')?
  html.replace('<div class="lesson-material-body-v176">',
   '<div class="lesson-material-body-v176">'+body):html;
};
const oldResource=resourceRowV14;
resourceRowV14=function(l,r,...args){
 if(!r)return '';
 if(l&&P.hidden(l,state.materials||[]).has(P.key(r.hint)))return '';
 return oldResource(l,r,...args);
};
const oldTimetable=timetableView;
timetableView=function(){
 let base=oldTimetable();
 const list=(state.classes||[]).filter(c=>c.subject&&!/^ga$/i.test(c.subject));
 const panel='<section class="panel v332-course-settings"><div class="section-head"><div>'+
  '<span class="eyebrow">PAPIER / iPADS · JE FACHKURS</span>'+
  '<h2>Materialbereitstellung der Kurse</h2></div></div>'+
  '<p>Die digitale Kennzeichnung (iPads) wird als Vorgabe übernommen. '+
  'Du kannst sie hier getrennt vom Kahoot-Schalter korrigieren. '+
  'Die gewählte Einstellung gilt auch für alte Druckaufträge, ohne diese zu löschen.</p>'+
  '<div class="v332-courses">'+list.map(c=>'<label><strong>'+esc(c.subject)+' '+
   esc(c.name)+'</strong><select data-v332-course="'+esc(c.id)+'">'+
   [['inherit','Aus iPad-Einstellung ('+(c.allIpadsV179?'digital':'Papier')+')'],
    ['digital','Digital · keine Kopien'],['print','Papier / Druckaufträge']].map(([v,n])=>
      '<option value="'+v+'" '+((c.materialDeliveryV332||'inherit')===v?'selected':'')+'>'+
      esc(n)+'</option>').join('')+'</select></label>').join('')+'</div></section>';
 return base.replace(/<\/div>\s*$/,panel+'</div>');
};
const oldModal=modalHtml;
modalHtml=function(){
 if(modal?.type!=='packageMappingV332'||!mapping)return oldModal();
 const l=lesson(mapping.lessonId);
 if(!l)return '<div class="modal-backdrop" data-action="modal-close">Stunde fehlt</div>';
 const row=own(l).find(x=>x.key===mapping.choiceKey),all=allHints(l);
 if(!row)return oldModal();
 const selected=new Set([row.primary,...row.extras].map(P.key));
 const list=all.map(h=>'<label class="v332-source">'+
  '<input type="checkbox" data-v332-source="'+esc(h)+'" '+
  (selected.has(P.key(h))?'checked':'')+' '+(P.key(h)===P.key(row.primary)?'disabled':'')+'>'+
  '<span>'+esc(h)+'</span>'+ (P.key(h)===P.key(row.primary)?
   '<small>Ausgangsblatt – bereits Teil der Ersetzung</small>':'')+'</label>').join('');
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide" data-modal-stop>'+
  '<header class="modal-header"><div><span class="eyebrow">MATERIAL-QUELLEN</span>'+
  '<h2>Welche früheren Blätter ersetzt diese Fassung?</h2></div>'+
  '<button class="icon-button" data-action="modal-close">×</button></header>'+
  '<div class="modal-body"><p>Die eigenen Dateien bleiben bestehen. Wähle alle bisherigen '+
  'Arbeitsblätter aus, deren Inhalte du in der neuen Fassung zusammengeführt hast. '+
  'Nur diese Originale werden in dieser Stunde ausgeblendet und aus dem Druckpaket genommen.</p>'+
  '<div class="v332-sources">'+list+'</div><div class="v332-save">'+
  '<button type="button" class="secondary" data-action="modal-close">Abbrechen</button>'+
  '<button type="button" class="primary" data-v332-save-map="'+esc(l.id)+
  '">Zuordnung übernehmen</button></div></div></section></div>';
};
async function applyMapping(l,choiceKey,hints){
 if(!l||v182IsHeld(l))throw Error('Gehaltener Unterricht wird nicht umgeschrieben.');
 const choice=l.worksheetChoicesV276?.[choiceKey];
 if(!choice)throw Error('Die überarbeitete Fassung ist nicht mehr verknüpft.');
 const originals=P.proposalForMerge(hints,choice.hint).others;
 const oldExtras=choice.extraHiddenHints||[],before=structuredClone(l);
 try{
  const oldSet=new Set(oldExtras.map(P.key)),nextSet=new Set(originals.map(P.key));
  for(const hint of oldExtras){
   if(!nextSet.has(P.key(hint)))v183RestoreToLesson(l,hint);
  }
  const originalSources=[...(choice.originalSourcesV332||[])];
  for(const hint of originals){
   const row=allResourceRowsV176(l).find(r=>P.key(r.hint)===P.key(hint));
   if(!row)throw Error('Original nicht mehr in dieser Stunde auffindbar: '+hint);
   const pairs=(row.bundleItemsV176||[]).map(x=>({materialId:x.materialId,variantId:x.variantId}));
   if(row.material&&row.variant)pairs.push({materialId:row.material.id,variantId:row.variant.id});
   if(!originalSources.some(x=>P.key(x.hint)===P.key(hint)))
    originalSources.push({hint,pairs,names:pairs.map(x=>variant(x.materialId,x.variantId)?.fileName||
     mat(x.materialId)?.title||hint)});
   v183DeleteFromLesson(l,hint);
   const retired=new Set(pairs.map(p=>p.materialId));
   for(const p of l.printPlan||[])if(retired.has(p.materialId))v183DisablePlan(p,'merged-source-replaced-v332');
   const ownIds=new Set((l.resourceBundlesV176?.[choiceKey]?.items||[]).map(x=>x.materialId));
   l.materials=(l.materials||[]).filter(id=>!retired.has(id)||ownIds.has(id));
  }
  choice.extraHiddenHints=originals;
  choice.reviewedHiddenHintsV332=[...originals];
  choice.originalSourcesV332=originalSources;
  choice.mappingConfirmedAtV332=new Date().toISOString();
  await saveState();mapping=null;modal=null;render();
 }catch(e){Object.keys(l).forEach(k=>delete l[k]);Object.assign(l,before);render();throw e;}
}
async function saveCopies(l){
 if(busy)return;
 const groupList=selectedGroups(l),before=structuredClone(l);
 const course=cls(l.classId),delivery=document.querySelector('[data-v332-lesson-delivery="'+l.id+'"]')?.value||'inherit';
 const nextDelivery=delivery==='inherit'?'':delivery;
 const isDigital=nextDelivery==='digital'||(!nextDelivery&&P.digital(course));
 const changed=[];
 for(const group of groupList){
  for(const v of group.variants){
   const inp=document.querySelector('[data-v332-count="'+l.id+'|'+group.material.id+'|'+v.id+'"]');
   if(!inp)continue;
   const n=Number(inp.value);
   if(!Number.isInteger(n)||n<0||n>500)throw Error('Kopiermenge muss zwischen 0 und 500 liegen.');
   if(v.type==='solution'&&n>0)throw Error('Erwartungshorizonte dürfen nicht als Klassensatz gedruckt werden.');
   const prev=(l.printPlan||[]).find(p=>p.materialId===group.material.id&&p.variantId===v.id);
   changed.push({material:group.material,variant:v,n,prev,
    previousCount:Number(prev?.count||0),wasPrinted:!!prev?.alreadyPrinted});
  }
 }
 const undo=changed.filter(x=>x.wasPrinted&&x.n!==x.previousCount);
 if(undo.length&&!confirm('Bei '+undo.length+' bereits kopierten Fassungen ändert sich die Kopierzahl. '+ 
  'Deren „erledigt“-Markierung wird zurückgesetzt. Änderungen übernehmen?'))return;
 busy=true;
 try{
  if(nextDelivery)l.materialDeliveryV332=nextDelivery;
  else delete l.materialDeliveryV332;
  for(const {material,variant:v,n,previousCount,wasPrinted} of changed){
   const p=ensurePlan(l,material.id,v.id);
   p.count=n;p.manualCountV332=true;
   p.needed=n>0&&v.type!=='solution';
   p._v183removed=false;p._v183obsolete=false;
   if(wasPrinted&&n!==previousCount)p.alreadyPrinted=false;
  }
  await saveState();render();
 }catch(e){Object.keys(l).forEach(k=>delete l[k]);Object.assign(l,before);
  render();throw e;}finally{busy=false;}
}
const oldWire=wire;
wire=function(){
 oldWire();
 for(const b of document.querySelectorAll('[data-v332-upload]'))b.addEventListener('click',()=>{
  const l=lesson(b.dataset.v332Upload),h=l&&primary(l);
  if(!h){alert('Es gibt kein aktives Ausgangsblatt. Bitte zuerst ein Material hinzufügen.');return;}
  window.SchulcockpitMaterialEvolutionV296.begin('lesson',{lessonId:l.id,hint:h});
 });
 for(const b of document.querySelectorAll('[data-v332-map]'))b.addEventListener('click',()=>{
  const raw=b.dataset.v332Map,i=raw.indexOf('|');
  mapping={lessonId:raw.slice(0,i),choiceKey:decodeURIComponent(raw.slice(i+1))};
  modal={type:'packageMappingV332'};render();
 });
 document.querySelector('[data-v332-save-map]')?.addEventListener('click',async e=>{
  if(busy)return;
  const l=lesson(e.currentTarget.dataset.v332SaveMap),row=own(l).find(x=>x.key===mapping?.choiceKey);
  if(!row)return;const checked=[row.primary,...[...document.querySelectorAll('[data-v332-source]')]
    .filter(x=>x.checked&&!x.disabled).map(x=>x.dataset.v332Source)];
  busy=true;e.currentTarget.disabled=true;
  try{await applyMapping(l,mapping.choiceKey,checked);}catch(err){alert('Zuordnung nicht geändert: '+(err.message||err));}
  finally{busy=false;}
 });
 for(const b of document.querySelectorAll('[data-v332-save-copies]'))b.addEventListener('click',async e=>{
  const l=lesson(e.currentTarget.dataset.v332SaveCopies);if(!l)return;
  try{await saveCopies(l);}catch(err){alert('Kopiermengen nicht geändert: '+(err.message||err));}
 });
 for(const b of document.querySelectorAll('[data-v332-preset]'))b.addEventListener('click',()=>{
  const [lid,mid,kind]=b.dataset.v332Preset.split('|'),l=lesson(lid);
  if(!l)return;
  const group=selectedGroups(l).find(g=>g.material.id===mid);if(!group)return;
  const c=cls(l.classId),n=Number(c?.students)||0,preset=P.defaults(group.variants,n);
  const primary=group.variants.find(v=>v.type==='standard')||group.variants[0];
  for(const v of group.variants){
   const input=document.querySelector('[data-v332-count="'+lid+'|'+mid+'|'+v.id+'"]');
   if(!input||v.type==='solution')continue;
   input.value=kind==='none'?0:kind==='group'?
    (v.id===primary.id?P.groupCount(n,4):0):preset[v.id]||0;
  }
 });
 for(const sel of document.querySelectorAll('[data-v332-course]'))sel.addEventListener('change',async()=>{
  const c=cls(sel.dataset.v332Course);if(!c)return;
  const old=c.materialDeliveryV332;
  try{
   if(sel.value==='inherit')delete c.materialDeliveryV332;
   else c.materialDeliveryV332=sel.value;
   await saveState();render();
  }catch(err){if(old)c.materialDeliveryV332=old;else delete c.materialDeliveryV332;
   alert('Kurs-Einstellung nicht gespeichert: '+(err.message||err));render();}
 });
};
const oldRender=render;
render=function(){
 oldRender();
 const version=document.querySelector('.brand small');
 if(version)version.textContent=state.settings.schoolYear+' · V0.33.2';
};
window.SchulcockpitMaterialPackagesV332={primary,selectedGroups,packagePanel,
 copiesPanel,applyMapping};
})();
