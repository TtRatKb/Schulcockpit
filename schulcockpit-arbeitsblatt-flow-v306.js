/* Schulcockpit V0.30.6 – make the documented material Ist-stand authoritative
 * in ALL active planning/printing surfaces, without editing the original Soll.
 * Compact reflection + return to the week being reflected.
 */
(function(){
'use strict';
const C=SC_WORKSHEET_ACTUAL_V305,F=SC_WORKSHEET_FLOW_V306;
const previousResources=lessonResourcesV14;
const previousPrintItems=printItems;
const previousMissing=missingPrintFilesForLesson;
const previousMaterialList=v182RelevantMaterials;
const previousResourceRow=resourceRowV14;
const previousResourceStatus=resourceStatusV176;
let saving=false;
function previousHeld(l){
 if(!l?.id||!l.classId||!l.date||v182IsHeld(l)||v182IsCanceled(l))return null;
 const prior=(state.lessons||[]).filter(x=>x.id!==l.id&&x.classId===l.classId&&
  v182IsHeld(x)&&!v182IsCanceled(x)&&
  (x.date<l.date||(x.date===l.date&&Number(x.slot||0)<Number(l.slot||0))))
  .sort((a,b)=>String(b.date).localeCompare(String(a.date))||Number(b.slot||0)-Number(a.slot||0))[0];
 if(!prior?.worksheetActualV305?.snapshot?.length)return null;
 const gap=(Date.parse(l.date+'T12:00:00Z')-Date.parse(prior.date+'T12:00:00Z'))/86400000;
 // Follow-on work applies to the directly previous taught lesson, not to
 // identical file names from a much older unit or another course.
 return gap>=0&&gap<=21?prior:null;
}
function entriesFromResource(r){
 if(r.bundleItemsV176?.length)return r.bundleItemsV176
  .filter(e=>e.materialId&&e.variantId)
  .map(e=>({materialId:e.materialId,variantId:e.variantId,
   fileName:e.v?.fileName||variant(e.materialId,e.variantId)?.fileName||e.m?.title||r.hint}));
 if(r.material&&r.variant)return [{materialId:r.material.id,variantId:r.variant.id,
  fileName:r.variant.fileName||r.material.title||r.hint}];
 return [];
}
function rawRows(l){
 // Capture the pre-v306 source resolver. Do not call the globally wrapped
 // allResourceRowsV176 here or resource calculation would recurse.
 if(!l)return [];
 const resources=previousResources(l).filter(r=>['print','reference'].includes(r.type)&&
  v183IsActive(l,r.hint)).map(r=>({
   hint:r.hint,title:r.hint,type:r.type,items:entriesFromResource(r)
  }));
 const known=new Set(resources.flatMap(r=>r.items.map(e=>e.materialId+'|'+e.variantId)));
 const extra=(l.printPlan||[]).filter(p=>(p.needed||p.alreadyPrinted)&&
  !p._v183removed&&!p._v183obsolete&&!known.has(p.materialId+'|'+p.variantId))
  .map(p=>{
   const m=mat(p.materialId),v=variant(p.materialId,p.variantId);
   if(!m||!v)return null;
   if((l.hiddenResourceKeysV183||[]).includes(resourceKeyV14(m.title)))return null;
   return {hint:m.title,title:v.fileName||m.title,materialId:p.materialId,
    variantId:p.variantId,printedFromPlan:!!p.alreadyPrinted};
  }).filter(Boolean);
 return C.rows(resources,l.printPlan||[],extra);
}
function effective(l){
 const prior=previousHeld(l);
 if(!prior)return {prior:null,rows:[],hits:[],map:new Map()};
 const rows=rawRows(l);
 const hits=F.outcomes(prior,rows,l.worksheetReuseV305?.repeat||[]);
 // Existing v305 manual removal is a historical override: the original
 // file was deliberately detached, even if a record cannot be rematched now.
 return {prior,rows,hits,map:F.decisionMap(hits)};
}
function planHit(l,mid,vid){
 const info=effective(l);
 return info.hits.find(h=>h.target.materialId===mid&&
  (!vid||!h.target.variantId||h.target.variantId===vid))||null;
}
function rowItems(r){
 const items=entriesFromResource(r);
 return items.length?items.map(e=>({...e,id:C.idFor(e)})):
  [{hint:r.hint,title:r.hint,id:C.idFor({hint:r.hint})}];
}
function transform(l,r,info){
 if(!['print','reference'].includes(r.type))return r;
 const original=rowItems(r),retained=original.filter(e=>!F.suppressInPlanning(info.map.get(e.id)));
 if(!retained.length)return null;
 const results={...r},retainedIds=new Set(retained.map(e=>e.id));
 if(r.bundleItemsV176?.length){
  const filtered=r.bundleItemsV176.filter(e=>retainedIds.has(C.idFor(e)));
  if(filtered.length!==r.bundleItemsV176.length){
   results.bundleItemsV176=filtered;
   if(r.bundleV176)results.bundleV176={...r.bundleV176,
    items:(r.bundleV176.items||[]).filter(x=>retainedIds.has(C.idFor(x)))};
   if(!filtered.length&&r.material&&r.variant){
    results.material=null;results.variant=null;
   }
  }
 }else if(r.material&&r.variant&&!retainedIds.has(C.idFor({materialId:r.material.id,variantId:r.variant.id}))){
  results.material=null;results.variant=null;
 }
 const allAlready=retained.every(e=>F.shareable(info.map.get(e.id)));
 if(allAlready&&r.type==='print'){
  results.type='reference';results.v306AlreadyDistributed=true;
 }
 const removedCount=original.length-retained.length;
 if(removedCount)results.v306RemovedCount=removedCount;
 return results;
}
lessonResourcesV14=function(l){
 const rs=previousResources(l);
 if(!l||v182IsHeld(l))return rs;
 const info=effective(l);
 if(!info.hits.length)return rs;
 return rs.map(r=>transform(l,r,info)).filter(Boolean);
};
printItems=function(){
 return previousPrintItems().filter(i=>!F.noNewPrint(planHit(i.lesson,i.plan.materialId,i.plan.variantId)));
};
openPrintItems=function(){return printItems().filter(i=>!i.plan.alreadyPrinted);};
missingPrintFilesForLesson=function(l){
 return previousMissing(l).filter(p=>!F.noNewPrint(planHit(l,p.materialId,p.variantId)));
};
// Without this, "Für diese Stunde griffbereit" still pulled completed
// files through l.materials / curriculum assignments after the print filter.
v182RelevantMaterials=function(l){
 const list=previousMaterialList(l);
 if(!l||v182IsHeld(l))return list;
 const info=effective(l);
 if(!info.hits.length)return list;
 const original=info.rows,active=original.filter(r=>!F.suppressInPlanning(info.map.get(r.id)));
 return list.filter(m=>{
  const id=String(m.id||'');
  if(id.startsWith('hint:')){
   const hint=decodeURIComponent(id.slice(5)),k=C.normalize(hint);
   return !original.some(r=>C.normalize(r.hint)===k)||
    active.some(r=>C.normalize(r.hint)===k);
  }
  if(id.startsWith('catalog:'))return true;
  return !original.some(r=>r.materialId===id)||active.some(r=>r.materialId===id);
 });
};
resourceStatusV176=function(r){
 if(r?.v306AlreadyDistributed)return 'Bereits ausgeteilt · nur offene Aufgaben beenden, kein neuer Ausdruck';
 return previousResourceStatus(r);
};
resourceRowV14=function(l,r){
 if(!r?.v306AlreadyDistributed)return previousResourceRow(l,r);
 const items=r.bundleItemsV176?.length?r.bundleItemsV176:
  r.material&&r.variant?[{materialId:r.material.id,variantId:r.variant.id,v:r.variant}]:[];
 return '<div class="resource-row-v176 v306-reuse-row">'+
  '<span class="resource-type reference">Fortsetzung</span>'+
  '<div class="resource-description-v176"><strong>'+esc(displayResourceTitleV176(l,r.hint))+'</strong>'+
  '<small>Schon ausgeteilt · nur die offenen Aufgaben bearbeiten und ggf. Ergebnisse besprechen. Kein neuer Ausdruck.</small>'+
  (items.length?'<small>'+items.map(x=>esc(x.v?.fileName||variant(x.materialId,x.variantId)?.fileName||'Blatt')).join(' · ')+'</small>':'')+
  '</div></div>';
};
function statusOptions(value){
 return C.STATES.map(([id,label])=>'<option value="'+esc(id)+'" '+(value===id?'selected':'')+'>'+esc(label)+'</option>').join('');
}
function followOptions(value){
 return C.FOLLOW.map(([id,label])=>'<option value="'+esc(id)+'" '+(value===id?'selected':'')+'>'+esc(label)+'</option>').join('');
}
function workRows(l){
 const all=window.SchulcockpitWorksheetActualV305.rows(l);
 if(!all.length)return '<p class="microcopy">Für diese Stunde sind keine einzelnen Arbeitsblätter oder Buchaufträge zugeordnet.</p>';
 const log=l.worksheetActualV305||{},entries=log.items||{};
 return all.map(e=>{
  const a=C.tidy(entries[e.id]),printed=a.printed==='unknown'&&e.printedFromPlan?'yes':a.printed;
  const needsFollow=['partial','unused'].includes(a.status);
  return '<div class="v306-worksheet"><div class="v306-worksheet-head"><strong>'+esc(e.title)+'</strong>'+
   '<small>'+(e.printedFromPlan?'Als gedruckt markiert':'')+(e.printable?' · Arbeitsblatt':' · Buch / Arbeitsheft')+'</small></div>'+
   '<label>Was haben die Kinder damit gemacht?'+
   '<select data-v306-actual="'+esc(l.id)+'|'+esc(e.id)+'" aria-label="Bearbeitungsstand '+esc(e.title)+'">'+
   statusOptions(a.status)+'</select></label>'+
   (needsFollow?'<label class="v306-follow">In der Folgestunde?'+
    '<select data-v306-follow="'+esc(l.id)+'|'+esc(e.id)+'">'+followOptions(a.follow)+'</select></label>':'')+
   '<details class="v306-worksheet-more"><summary>Optional: Ausdruck / Notiz</summary>'+
    '<label>Ausdruckstatus<select data-v306-printed="'+esc(l.id)+'|'+esc(e.id)+'">'+
     [['unknown','Unbekannt'],['yes','Ja, schon gedruckt'],['no','Nein']].map(([v,t])=>
      '<option value="'+v+'" '+(printed===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
    '<label>Kurze Notiz<input maxlength="380" data-v306-note="'+esc(l.id)+'|'+esc(e.id)+'" value="'+esc(a.note)+'" placeholder="Optional – bleibt lokal"></label>'+
   '</details></div>';
 }).join('');
}
const oldReflection=v182ReflectionHtml;
v182ReflectionHtml=function(l){
 if(!l)return '';
 const r=v182GetReflection(l),materials=v182RelevantMaterials(l),issueCount=
  r.lessonFlags.length+r.pptFlags.length+Object.values(r.materialIssues||{}).reduce((n,a)=>n+(a?.length||0),0);
 return '<section class="v182-reflection v306-reflection" id="reflection-v182">'+
  '<header class="v306-reflection-head"><span class="eyebrow">NACH DEM UNTERRICHT</span>'+
   '<h2>Reflexion · kurz und übersichtlich</h2>'+
   '<p>Nur das Wesentliche anklicken. Überarbeitungshinweise sind optional; deine ursprüngliche Stunde bleibt gespeichert.</p></header>'+
  '<div class="v306-step"><h3><span>1</span> Wie lief die Stunde?</h3>'+
   '<div class="v306-quick-answers">'+
   v182Choices(l,'overall',V182_OVERALL)+v182Choices(l,'timing',V182_TIMING)+
   v182Choices(l,'learning',V182_LEARNING)+'</div></div>'+
  '<div class="v306-step"><h3><span>2</span> Welche Arbeitsblätter wurden wirklich bearbeitet?</h3>'+
   '<p class="microcopy">Vollständig erledigt = in der direkten Folgestunde automatisch nicht erneut einplanen. '+
   'Teilweise erledigt und „fortsetzen“ = Material bleibt bekannt, ohne nochmal zu kopieren. '+
   'Drucken allein gilt nicht als Bearbeiten.</p>'+
   '<div class="v306-worksheets">'+workRows(l)+'</div></div>'+
  '<details class="v306-optional" '+(issueCount?'open':'')+'>'+
   '<summary><strong>3 · Verbesserungen & Notizen (optional)</strong>'+
    '<small>'+ (issueCount?issueCount+' Hinweis(e) markiert':'Nur bei Bedarf öffnen')+'</small></summary>'+
   '<div class="v306-optional-body">'+
    v182FlagGroup(l,'lesson','','Was würdest du am Ablauf verbessern?')+
    '<details '+(r.pptFlags.length?'open':'')+'><summary>PowerPoint · nur wenn etwas nicht passte</summary>'+
      v182FlagGroup(l,'ppt','','Welche PPT-Probleme gab es?')+'</details>'+
    '<details '+(Object.values(r.materialIssues).some(a=>a?.length)?'open':'')+'><summary>Materialqualität · nur wenn etwas verbessert werden soll</summary>'+
      (materials.map(m=>'<div class="v182-material-review">'+
       v182FlagGroup(l,'material',m.id,m.title)+v182FileButton(m)+'</div>').join('')||
       '<p class="microcopy">Keine Dateien verknüpft.</p>')+'</details>'+
    '<label class="v182-note-label">Kurze persönliche Notiz (optional)<textarea id="v182-reflection-note" rows="2" maxlength="2500" placeholder="Was möchtest du fürs nächste Mal merken?">'+esc(r.note||'')+'</textarea></label>'+
   '</div></details>'+
  '<div class="v306-reflection-actions"><button class="primary" data-v182-save-reflection="'+esc(l.id)+'">'+
    'Reflexion speichern · zurück zur Woche ✓</button>'+
   '<button class="secondary" data-v182-no-change="'+esc(l.id)+'">Kein Überarbeitungsbedarf · abschließen</button>'+
   '<button class="text-button" data-v306-back-week="'+esc(l.id)+'">Ohne Abschluss zur Woche</button></div>'+
  '</section>';
};
async function updateActual(l,id,field,value){
 if(!l||!v182IsHeld(l))throw Error('Stunde ist nicht als gehalten markiert.');
 const old=l.worksheetActualV305?structuredClone(l.worksheetActualV305):null;
 const completion=l.reflectionV182?.completedAt||'';
 try{
  const rows=window.SchulcockpitWorksheetActualV305.rows(l);
  if(!rows.some(x=>x.id===id))throw Error('Arbeitsblatt nicht mehr zugeordnet.');
  const d=C.refine(l.worksheetActualV305||{},null,rows),rec=C.tidy(d.items[id]);
  if(field==='status'){
   rec.status=C.valid(value);
   rec.follow=['complete','skipped'].includes(rec.status)?'stop':'undecided';
  }else if(field==='follow'){
   if(!C.FOLLOW.some(([x])=>x===value))throw Error('Ungültige Entscheidung.');
   rec.follow=value;
  }else if(field==='printed'){
   if(!['yes','no','unknown'].includes(value))throw Error('Ungültiger Druckstatus.');
   rec.printed=value;
  }else if(field==='note')rec.note=String(value||'').trim().slice(0,380);
  d.items[id]=rec;l.worksheetActualV305=d;
  if(l.reflectionV182)l.reflectionV182.completedAt='';
  await Promise.resolve(saveState());return true;
 }catch(e){
  if(old)l.worksheetActualV305=old;else delete l.worksheetActualV305;
  if(l.reflectionV182)l.reflectionV182.completedAt=completion;
  throw e;
 }
}
function nextSummary(l){
 if(!l||v182IsHeld(l)||v182IsCanceled(l))return '';
 const info=effective(l);
 if(!info.prior||!info.hits.length)return '';
 const done=info.hits.filter(x=>x.mode==='done'),carry=info.hits.filter(x=>F.shareable(x));
 const unresolved=info.hits.filter(x=>x.mode==='open'||x.mode==='newPrint');
 const repeat=info.hits.filter(x=>x.mode==='repeat');
 return '<section class="panel v306-next-summary"><div class="section-head"><div>'+
  '<span class="eyebrow">AUS DER LETZTEN STUNDE · '+esc(info.prior.date)+'</span>'+
  '<h3>Materialien automatisch abgeglichen ✓</h3></div></div>'+
  (done.length?'<p><strong>'+done.length+' erledigt oder bewusst gestrichen:</strong> '+
   done.map(x=>esc(x.source.title)).join(' · ')+'. Diese Blätter werden nicht erneut bearbeitet oder gedruckt.</p>':'')+
  (carry.length?'<p><strong>'+carry.length+' zur Fortsetzung:</strong> '+
   carry.map(x=>esc(x.source.title)).join(' · ')+
   '. Bereits vorbereitetes Material nutzen; nur offene Aufgaben beenden oder die Ergebnisse besprechen.</p>':'')+
  (unresolved.length?'<p><strong>'+unresolved.length+' mit offener bzw. neuer Bereitstellung:</strong> '+
   unresolved.map(x=>esc(x.source.title)).join(' · ')+'.</p>':'')+
  (repeat.length?'<p>Bewusst wiederholt: '+repeat.map(x=>esc(x.source.title)).join(' · ')+'.</p>':'')+
  (done.length?'<details class="v306-repeat-details"><summary>Ein erledigtes Blatt ausnahmsweise doch wiederholen</summary>'+
   '<p class="microcopy">Nur auf ausdrücklichen Wunsch. Die bereits gehaltene Stunde und die Originaldatei bleiben unverändert.</p>'+
   done.map(x=>'<button type="button" class="secondary" data-v306-repeat="'+esc(l.id)+'|'+esc(x.targetId)+'">'+
    esc(x.source.title)+' erneut einplanen</button>').join('')+'</details>':'')+
  '<p class="microcopy">Grundlage ist deine Reflexion. Die ursprünglichen Soll-Verknüpfungen bleiben '+
  'für spätere Jahrgänge erhalten, sind hier aber nicht mehr als aktive Druckmaterialien berücksichtigt.</p></section>';
}
const oldDay=v182LessonDayHtml;
v182LessonDayHtml=function(l){
 // Remove the old v305 warning/action card. It incorrectly required a second
 // teacher decision and could leave legacy assignment/print entries behind.
 const html=oldDay(l).replace(/<section class="panel v305-next">[\s\S]*?<\/section>/,'');
 const section=nextSummary(l);
 return section?html.replace('<section class="panel v182-end-panel">',section+
  '<section class="panel v182-end-panel">'):html;
};
const oldWizard=wizardPlanStepV14;
wizardPlanStepV14=function(l){
 const html=oldWizard(l).replace(/<section class="panel v305-next">[\s\S]*?<\/section>/,'');
 const section=nextSummary(l);
 return section?html.replace('<h3>Material in dieser Stunde</h3>',section+
  '<h3>Material in dieser Stunde</h3>'):html;
};
const oldPrompt=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
 let txt=oldPrompt(l);
 if(!l||l.freePlanningV258)return txt;
 // V305 described one generic duplicate-warning block, which is now replaced
 // by the precise done/carry/distribute logic and has no obsolete advice.
 txt=txt.replace(/\n\n## Tatsächlich bearbeitete Materialien aus der letzten Unterrichtsstunde[\s\S]*?Freitext-Reflexionsnotizen bleiben aus Datenschutzgründen ausschließlich lokal im Cockpit\.\n/,'');
 const info=effective(l),note=F.prompt(info.prior,info.hits);
 if(!note)return txt;
 const token='Danach hänge GENAU EINEN maschinenlesbaren Block an:',i=txt.indexOf(token);
 return i>=0?txt.slice(0,i)+note+'\n'+txt.slice(i):txt+note;
};
makeBrief=concretePlanningPromptV12;
function goToWeek(l){
 if(!l)return;
 const monday=iso(mondayOf(new Date(l.date+'T12:00:00')));
 state.settings.activeWeekStart=monday;
 view='week';modal=null;
 v182LessonId=l.id;
 saveState();render();
}
async function finish(l,noIssues){
 if(!l||saving)return;
 saving=true;
 try{
  const r=v182GetReflection(l);
  if(noIssues){
   r.overall=r.overall||'fine';r.timing=r.timing||'fit';r.learning=r.learning||'achieved';
   r.lessonFlags=[];r.pptFlags=[];r.materialIssues={};r.note='';
  }else{
   r.note=document.querySelector('#v182-reflection-note')?.value?.trim().slice(0,2500)||'';
  }
  v182CommitBacklog(l);
  // Preserve date navigation even when reflecting lessons from an older week.
  state.settings.activeWeekStart=iso(mondayOf(new Date(l.date+'T12:00:00')));
  await Promise.resolve(saveState());
  view='week';modal=null;render();
 }catch(e){alert('Reflexion nicht abgeschlossen: '+(e.message||e));}
 finally{saving=false;}
}
const previousWire=wire;
wire=function(){
 previousWire();
 document.querySelectorAll('[data-v306-actual],[data-v306-follow],[data-v306-printed],[data-v306-note]').forEach(e=>{
  e.addEventListener('change',async()=>{
   const attr=['actual','follow','printed','note'].find(k=>e.hasAttribute('data-v306-'+k));
   const value=e.getAttribute('data-v306-'+attr),i=value.indexOf('|');
   if(i<0)return;
   const l=lesson(value.slice(0,i)),id=value.slice(i+1);
   const top=e.getBoundingClientRect().top;
   try{
    await updateActual(l,id,attr==='actual'?'status':attr,e.value);
    render();
    const next=[...document.querySelectorAll('[data-v306-'+attr+']')].find(x=>
     x.getAttribute('data-v306-'+attr)===value);
    if(next&&typeof window.scrollBy==='function')
     window.scrollBy(0,next.getBoundingClientRect().top-top);
   }catch(err){alert('Bearbeitungsstand nicht gespeichert: '+(err.message||err));render();}
  });
 });
 document.querySelectorAll('[data-v182-save-reflection]').forEach(b=>{
  b.onclick=()=>void finish(lesson(b.dataset.v182SaveReflection),false);
 });
 document.querySelectorAll('[data-v182-no-change]').forEach(b=>{
  b.onclick=()=>void finish(lesson(b.dataset.v182NoChange),true);
 });
 document.querySelectorAll('[data-v306-back-week]').forEach(b=>b.onclick=()=>{
  goToWeek(lesson(b.dataset.v306BackWeek));
 });
 document.querySelectorAll('[data-v306-repeat]').forEach(b=>b.onclick=async()=>{
  const raw=b.dataset.v306Repeat,i=raw.indexOf('|'),l=lesson(raw.slice(0,i)),id=raw.slice(i+1);
  if(!l||v182IsHeld(l)||!confirm('„'+(effective(l).map.get(id)?.source.title||'Arbeitsblatt')+
   '“ in dieser Stunde bewusst wiederholen? Dadurch kann auch ein neuer Druckauftrag nötig werden.'))return;
  const old=l.worksheetReuseV305?structuredClone(l.worksheetReuseV305):null;
  try{
   l.worksheetReuseV305=l.worksheetReuseV305||{};
   l.worksheetReuseV305.repeat=[...new Set([...(l.worksheetReuseV305.repeat||[]),id])];
   // Unwind a previous V305 manual suppression, if present, without touching
   // any previous lesson or material file.
   const archived=l.worksheetReuseV305.suppressed?.[id];
   if(archived){
    if(archived.partial){
     const bundle=resourceBundleV176(l,archived.hint);
     if(bundle)for(const x of archived.bundleRemoved||[])
      if(!bundle.items?.some(e=>e.materialId===x.item.materialId&&e.variantId===x.item.variantId))
       (bundle.items||(bundle.items=[])).splice(Math.min(x.index,bundle.items.length),0,x.item);
    }else{
     if(!archived.originallyHidden)
      l.hiddenResourceKeysV183=(l.hiddenResourceKeysV183||[]).filter(k=>k!==resourceKeyV14(archived.hint));
     setResourceTypeV14(l,archived.hint,archived.originalType);
    }
    for(const snap of archived.plans||[]){
     const p=(l.printPlan||[]).find(p=>p.materialId===snap.materialId&&p.variantId===snap.variantId);
     if(p){p.needed=snap.needed;p._v183removed=snap.removed;p._v183obsolete=snap.obsolete;
      p._v183Reason=snap.reason;}
    }
    delete l.worksheetReuseV305.suppressed[id];
   }
   await Promise.resolve(saveState());render();
  }catch(err){if(old)l.worksheetReuseV305=old;else delete l.worksheetReuseV305;
   alert('Wiederholung nicht gespeichert: '+(err.message||err));render();}
 });
};
const oldRender=render;
render=function(){
 oldRender();
 const tag=document.querySelector('.brand small');
 if(tag)tag.textContent=state.settings.schoolYear+' · V0.30.6';
};
if(typeof window!=='undefined')window.SchulcockpitWorksheetFlowV306={
 rawRows,effective,transform,nextSummary,workRows,finish,previousHeld,
 core:F
};
})();