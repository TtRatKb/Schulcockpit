/* Schulcockpit V0.30.5 – per-sheet lesson reflection and next-hour context.
 * Never mark an item completed merely because it was printed. Never change
 * a next lesson or its files without an explicit teacher click/confirmation.
 */
(function(){
'use strict';
const C=SC_WORKSHEET_ACTUAL_V305;
let pending=false;
function getRows(l){
 if(!l)return [];
 const materials=allResourceRowsV176(l).filter(r=>['print','reference'].includes(r.type)&&
  v183IsActive(l,r.hint)).map(r=>{
  const items=(r.bundleItemsV176||[]).filter(e=>e.materialId&&e.variantId).map(e=>{
   const m=mat(e.materialId),v=variant(e.materialId,e.variantId);
   return {materialId:e.materialId,variantId:e.variantId,
    fileName:v?.fileName||m?.title||r.hint};
  });
  if(!items.length&&r.material&&r.variant)items.push({
   materialId:r.material.id,variantId:r.variant.id,
   fileName:r.variant.fileName||r.material.title||r.hint
  });
  return {hint:r.hint,title:r.hint,type:r.type,active:true,items,
   materialId:!items.length?r.material?.id||'':'',
   variantId:!items.length?r.variant?.id||'':''};
 });
 const extra=(l.printPlan||[]).filter(p=>(p.needed||p.alreadyPrinted)&&
  !p._v183removed&&!p._v183obsolete&&
  !materials.some(r=>r.items.some(i=>i.materialId===p.materialId&&i.variantId===p.variantId)))
  .map(p=>{
   const m=mat(p.materialId),v=variant(p.materialId,p.variantId);
   if(!m||!v)return null;
   // Do not reintroduce removed material hints through legacy print plans.
   const hide=(l.hiddenResourceKeysV183||[]).some(k=>k===resourceKeyV14(m.title));
   if(hide)return null;
   return {materialId:p.materialId,variantId:p.variantId,hint:m.title,
    title:v.fileName||m.title,printable:true,printedFromPlan:!!p.alreadyPrinted};
  }).filter(Boolean);
 return C.rows(materials,l.printPlan||[],extra);
}
function log(l){return l?.worksheetActualV305||{items:{},snapshot:[]};}
function lastHeld(l){
 if(!l?.classId)return null;
 const old=(state.lessons||[]).filter(x=>x.id!==l.id&&x.classId===l.classId&&
  v182IsHeld(x)&&!v182IsCanceled(x)&&
  (x.date<l.date||(x.date===l.date&&Number(x.slot||0)<Number(l.slot||0))))
  .sort((a,b)=>b.date.localeCompare(a.date)||Number(b.slot||0)-Number(a.slot||0));
 // Only the directly preceding taught lesson informs this hour. An old
 // worksheet record must not silently block a legitimate reuse months later.
 const previous=old[0]||null;
 if(!previous?.worksheetActualV305?.snapshot?.length)return null;
 const delta=(Date.parse(l.date+'T12:00:00Z')-Date.parse(previous.date+'T12:00:00Z'))/86400000;
 return delta<=21?previous:null;
}
function sourceFor(l){
 const src=lastHeld(l);return {src,rows:getRows(l),hits:C.dueItems(src,getRows(l))};
}
function stateLabel(v){return C.STATES.find(x=>x[0]===v)?.[1]||'Noch offen';}
function followLabel(v){return C.FOLLOW.find(x=>x[0]===v)?.[1]||'Noch entscheiden';}
function select(options,current,attr){
 return '<select '+attr+'>'+options.map(([v,label])=>
  '<option value="'+esc(v)+'" '+(v===current?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select>';
}
function reflectionItems(l){
 const rows=getRows(l),store=log(l),count=rows.filter(x=>C.tidy(store.items?.[x.id]).status!=='unknown').length;
 if(!rows.length)return '';
 const next=C.nextLesson(l,state.lessons||[]);
 return '<section class="v305-review"><div class="section-head"><div>'+
  '<span class="eyebrow">WAS IST MIT DEN ARBEITSBLÄTTERN PASSIERT?</span>'+
  '<h3>Materialeinsatz & Bearbeitungsstand</h3></div><span>'+count+'/'+rows.length+' erfasst</span></div>'+
  '<p class="microcopy">Drucken ist nicht dasselbe wie Austeilen oder Bearbeiten. Für jedes Blatt nur den tatsächlichen Stand wählen. '+
  'Deine Auswahl wird direkt lokal gespeichert und bleibt unabhängig von der Materialqualität oben.</p>'+
  rows.map(x=>{
   const actual=C.tidy(store.items?.[x.id]),visible=['partial','unused'].includes(actual.status);
   const printed=actual.printed==='unknown'&&x.printedFromPlan?'yes':actual.printed;
   const key=l.id+'|'+x.id;
   return '<div class="v305-item"><div class="v305-item-top"><div><strong>'+esc(x.title)+'</strong>'+
    '<small>'+esc(x.hint!==x.title?'Materialhinweis: '+x.hint+' · ':'')+
    (x.printable?'Arbeitsblatt / Kopiermaterial':'Buch / Arbeitsheft')+
    (x.printedFromPlan?' · im Druckplan als gedruckt markiert':'')+'</small></div>'+
    (x.materialId?'<button type="button" class="text-button" data-v305-open="'+esc(x.materialId)+'">Datei ↗</button>':'')+
    '</div><div class="v305-pickers"><label>Ausgedruckt?'+
    select([['unknown','Unbekannt'],['yes','Ja'],['no','Nein']],printed,
     'data-v305-printed="'+esc(key)+'"')+'</label>'+
    '<label>Im Unterricht'+select(C.STATES,actual.status,'data-v305-status="'+esc(key)+'"')+'</label></div>'+
    (visible?'<label class="v305-follow">Soll das Blatt in der Folgestunde noch verwendet/beendet werden?'+
    select(C.FOLLOW,actual.follow,'data-v305-follow="'+esc(key)+'"')+'</label>':'')+
    '<label class="v305-comment">Kurze Notiz (optional)<input maxlength="380" data-v305-note="'+esc(key)+'" value="'+esc(actual.note)+'" placeholder="z. B. Blatt nicht verteilt; schriftliche Division entfällt"></label></div>';
  }).join('')+
  (next?'<p class="microcopy">Nächster Unterrichtstermin: '+esc(next.date)+
   '. In der Folgestunde zeigt das Cockpit bereits erledigte oder offene Materialien an. '+
   'Eine dort erneut auftauchende Aufgabe kannst du gezielt ausblenden, ohne die ursprüngliche Stunde zu verändern.</p>':'')+
  '</section>';
}
async function setActual(l,id,field,val){
 if(!l||!v182IsHeld(l))throw Error('Material-Ist-Stand ist nur nach einer gehaltenen Stunde verfügbar.');
 const before=l.worksheetActualV305?structuredClone(l.worksheetActualV305):null;
 const oldReflection=l.reflectionV182?.completedAt||'';
 try{
  const rows=getRows(l);if(!rows.some(x=>x.id===id)&&!log(l).snapshot?.some(x=>x.id===id))
   throw Error('Dieses Blatt gehört nicht zur aktuellen Stunde.');
  const d=C.refine(l.worksheetActualV305||{},null,rows),r=C.tidy(d.items[id]);
  if(field==='status'){
   r.status=C.valid(val);
   if(['complete','skipped'].includes(r.status))r.follow='stop';
   else if(r.status==='partial'||r.status==='unused')r.follow='undecided';
   else r.follow='undecided';
  }else if(field==='follow'&&C.FOLLOW.some(x=>x[0]===val))r.follow=val;
  else if(field==='printed'&&['yes','no','unknown'].includes(val))r.printed=val;
  else if(field==='note')r.note=String(val||'').slice(0,380);
  d.items[id]=r;d.updatedAt=new Date().toISOString();
  l.worksheetActualV305=d;
  if(l.reflectionV182)l.reflectionV182.completedAt='';
  await Promise.resolve(saveState());render();
 }catch(err){
  if(before)l.worksheetActualV305=before;else delete l.worksheetActualV305;
  if(l.reflectionV182)l.reflectionV182.completedAt=oldReflection;
  render();throw err;
 }
}
function nextPanel(l){
 if(!l||v182IsHeld(l)||v182IsCanceled(l))return '';
 const {src,hits}=sourceFor(l),hidden=l.worksheetReuseV305?.suppressed||{};
 const already=(src?.worksheetActualV305?.snapshot||[]).filter(e=>
   Object.values(hidden).some(x=>x.sourceId===e.id)).map(e=>{
    const record=C.tidy(src.worksheetActualV305.items?.[e.id]);
    const id=Object.entries(hidden).find(([key,x])=>x.sourceId===e.id)?.[0];
    return {source:e,target:{...e,id},record,shouldSuppress:true,shouldRepeat:false};
   });
 const shown=[...hits.filter(x=>x.shouldSuppress||x.shouldRepeat||x.record.follow==='undecided'),
  ...already.filter(x=>!hits.some(y=>y.target.id===x.target.id))];
 if(!src||!shown.length)return '';
 const dismissed=new Set(l.worksheetReuseV305?.repeat||[]);
 return '<section class="panel v305-next"><div class="section-head"><div>'+
  '<span class="eyebrow">IST-STAND STATT DUPPELTER SOLL-AUFGABEN</span>'+
  '<h3>Materialien aus der letzten Stunde · '+esc(src.date)+'</h3></div></div>'+
  '<p class="microcopy">Diese Materialien sind für die jetzige Stunde erneut vorgesehen, '+
  'wurden aber bereits verwendet oder bewusst zurückgestellt. '+
  'Ein Arbeitsblatt bleibt im ursprünglichen Stundenarchiv erhalten.</p>'+
  shown.map(x=>{
   const id=x.target.id,wasHidden=!!hidden[id],repeated=dismissed.has(id),key=l.id+'|'+id;
   const label=x.shouldSuppress?'Bereits bearbeitet / bewusst nicht mehr nötig':
    x.shouldRepeat?'Noch nicht fertig – weiterführen':'Fortsetzung noch offen';
   return '<div class="v305-next-item"><div><strong>'+esc(x.target.title)+'</strong>'+
    '<small>'+esc(label)+' · '+esc(stateLabel(x.record.status))+
    (x.record.note?' · '+esc(x.record.note):'')+'</small></div><div class="v305-next-actions">'+
    (wasHidden?'<button class="secondary" data-v305-restore="'+esc(key)+'">Wieder einplanen</button>':
     repeated?'<button class="secondary" data-v305-repeat="'+esc(key)+'">Bewusste Wiederholung zurücknehmen</button>':
     x.shouldSuppress?'<button class="primary" data-v305-hide="'+esc(key)+'">Aus dieser Stunde ausblenden</button>'+
      '<button class="text-button" data-v305-repeat="'+esc(key)+'">Doch wiederholen</button>':
     '<span class="v305-chip">Zum Fortsetzen vorgesehen</span>')+
    '</div></div>';
  }).join('')+
  '<p class="microcopy">Bei „Ausblenden“ werden nur der aktuelle Materialhinweis und seine '+
  'Druckposition für diese Folgestunde deaktiviert. Vorhandene Dateien, die Ausgangsstunde und '+
  'andere Kurse bleiben unverändert. Eine ausdrücklich vorbereitete Wiederholung kannst du behalten.</p></section>';
}
function affected(l,id){
 return getRows(l).find(x=>x.id===id);
}
async function suppress(l,id){
 if(!l||v182IsHeld(l)||v182IsCanceled(l))throw Error('Gehaltene oder ausgefallene Stunden bleiben unverändert.');
 const row=affected(l,id);if(!row)throw Error('Material ist in der Folgestunde nicht mehr aktiv.');
 const old=l.worksheetReuseV305?structuredClone(l.worksheetReuseV305):null;
 const hiddenBefore=[...(l.hiddenResourceKeysV183||[])],overrides=structuredClone(l.resourceOverrides||{});
 const plans=structuredClone(l.printPlan||[]);
 const bundleSnapshot=structuredClone(resourceBundleV176(l,row.hint)||null);
 if(!confirm('„'+row.title+'“ nur für die Stunde am '+l.date+' ausblenden? '+
  'Damit wird es nicht erneut als Arbeitsblatt oder Druckauftrag eingeplant. '+
  'Die Datei und die bereits gehaltene Stunde bleiben unverändert.'))return;
 try{
  l.worksheetReuseV305=l.worksheetReuseV305||{suppressed:{},repeat:[]};
  l.worksheetReuseV305.suppressed=l.worksheetReuseV305.suppressed||{};
  const hintKey=resourceKeyV14(row.hint);
  const originallyHidden=(l.hiddenResourceKeysV183||[]).includes(hintKey);
  const bundle=resourceBundleV176(l,row.hint);
  const siblingItems=(bundle?.items||[]).filter(x=>x.materialId!==row.materialId||
    (row.variantId&&x.variantId!==row.variantId));
  // A source hint can contain several worksheets: remove just the confirmed
  // completed file, not the unfinished sibling from the same bundle.
  const partial=!!bundle?.items?.length&&siblingItems.length>0;
  const bundleRemoved=partial?(bundle.items||[]).map((item,index)=>({item:structuredClone(item),index}))
   .filter(x=>x.item.materialId===row.materialId&&
    (!row.variantId||x.item.variantId===row.variantId)):[];
  l.worksheetReuseV305.suppressed[id]={
   sourceId:sourceFor(l).hits.find(x=>x.target.id===id)?.source.id||'',
   title:row.title,hint:row.hint,originalType:resourceTypeV14(l,row.hint),
   originallyHidden,partial,bundleRemoved,plans:plans.filter(p=>row.materialId===p.materialId&&
    (!row.variantId||p.variantId===row.variantId)).map(p=>({
     id:p.id||'',materialId:p.materialId,variantId:p.variantId,
     needed:p.needed,removed:p._v183removed,obsolete:p._v183obsolete,reason:p._v183Reason
    }))
  };
  if(partial){
   bundle.items=siblingItems;bundle._v183Manual=true;
  }else{
   const hidden=l.hiddenResourceKeysV183||(l.hiddenResourceKeysV183=[]);
   if(!hidden.includes(hintKey))hidden.push(hintKey);
   setResourceTypeV14(l,row.hint,'ignore');
  }
  for(const p of l.printPlan||[])if(p.materialId===row.materialId&&
    (!row.variantId||p.variantId===row.variantId)){
    p.needed=false;p._v183removed=true;p._v183Reason='already-handled-previous-v305';
  }
  await Promise.resolve(saveState());render();
 }catch(err){
  if(old)l.worksheetReuseV305=old;else delete l.worksheetReuseV305;
  l.hiddenResourceKeysV183=hiddenBefore;l.resourceOverrides=overrides;l.printPlan=plans;
  if(bundleSnapshot){const b=resourceBundleV176(l,row.hint);if(b)Object.assign(b,bundleSnapshot);}
  render();throw err;
 }
}
async function restore(l,id){
 const record=l?.worksheetReuseV305?.suppressed?.[id];if(!record)return;
 const old=structuredClone(l);
 try{
  if(record.partial){
   const b=resourceBundleV176(l,record.hint);
   if(!b)throw Error('Das Materialpaket zum Wiederherstellen fehlt.');
   b.items=b.items||[];
   for(const recordItem of (record.bundleRemoved||[]).slice().sort((a,b)=>a.index-b.index))
    if(!b.items.some(x=>x.materialId===recordItem.item.materialId&&
      x.variantId===recordItem.item.variantId))
     b.items.splice(Math.min(recordItem.index,b.items.length),0,recordItem.item);
  }else{
   if(!record.originallyHidden)
    l.hiddenResourceKeysV183=(l.hiddenResourceKeysV183||[]).filter(k=>k!==resourceKeyV14(record.hint));
   setResourceTypeV14(l,record.hint,record.originalType);
  }
  for(const snap of record.plans||[]){
   const p=(l.printPlan||[]).find(p=>p.materialId===snap.materialId&&p.variantId===snap.variantId&&
    (!snap.id||p.id===snap.id));
   if(p){
    p.needed=snap.needed;
    p._v183removed=snap.removed;
    p._v183obsolete=snap.obsolete;
    p._v183Reason=snap.reason;
   }
  }
  delete l.worksheetReuseV305.suppressed[id];await Promise.resolve(saveState());render();
 }catch(e){Object.assign(l,old);render();throw e;}
}
async function repeat(l,id){
 const before=l.worksheetReuseV305?structuredClone(l.worksheetReuseV305):null;
 try{
  l.worksheetReuseV305=l.worksheetReuseV305||{suppressed:{},repeat:[]};
  const a=new Set(l.worksheetReuseV305.repeat||[]);a.has(id)?a.delete(id):a.add(id);
  l.worksheetReuseV305.repeat=[...a];
  await Promise.resolve(saveState());render();
 }catch(e){if(before)l.worksheetReuseV305=before;else delete l.worksheetReuseV305;render();throw e;}
}
const oldReflection=v182ReflectionHtml;
v182ReflectionHtml=function(l){
 const html=oldReflection(l),add=reflectionItems(l);
 return add?html.replace('<label class="v182-note-label">',add+'<label class="v182-note-label">'):html;
};
const oldDay=v182LessonDayHtml;
v182LessonDayHtml=function(l){
 const html=oldDay(l),newBlock=nextPanel(l);
 return newBlock?html.replace('<section class="panel v182-end-panel">',newBlock+'<section class="panel v182-end-panel">'):html;
};
const oldWizard=wizardPlanStepV14;
wizardPlanStepV14=function(l){
 const html=oldWizard(l),add=nextPanel(l);
 return add?html.replace('<h3>Material in dieser Stunde</h3>',add+'<h3>Material in dieser Stunde</h3>'):html;
};
const oldPrompt=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
 const text=oldPrompt(l);if(l?.freePlanningV258)return text;
 const {src,rows}=sourceFor(l);
 const info=C.noteForPrompt(src,rows,l.worksheetReuseV305?.repeat||[]);
 if(!info)return text;
 const marker='Danach hänge GENAU EINEN maschinenlesbaren Block an:';
 const pos=text.indexOf(marker);
 return pos<0?text+info:text.slice(0,pos)+info+'\n'+text.slice(pos);
};
makeBrief=concretePlanningPromptV12;
const oldWire=wire;
wire=function(){
 oldWire();
 for(const [attribute,field] of [['data-v305-status','status'],['data-v305-follow','follow'],
 ['data-v305-printed','printed'],['data-v305-note','note']]){
  document.querySelectorAll('['+attribute+']').forEach(input=>input.addEventListener('change',()=>{
   const raw=input.getAttribute(attribute),sep=raw.indexOf('|');
   if(sep<0)return;
   const l=lesson(raw.slice(0,sep)),id=raw.slice(sep+1);
   void setActual(l,id,field,input.value).catch(e=>alert('Materialstand nicht gespeichert: '+(e.message||e)));
  }));
 }
 document.querySelectorAll('[data-v305-open]').forEach(b=>b.addEventListener('click',async()=>{
  const m=mat(b.dataset.v305Open);if(!m)return;
  try{await v182OpenMaterial({id:m.id,title:m.title,material:m,variants:m.variants||[]});}
  catch(e){alert(e.message||e);}
 }));
 for(const [name,cb] of [['hide',suppress],['restore',restore],['repeat',repeat]]){
  document.querySelectorAll('[data-v305-'+name+']').forEach(b=>b.addEventListener('click',()=>{
   const raw=b.getAttribute('data-v305-'+name),sep=raw.indexOf('|');
   const l=lesson(raw.slice(0,sep)),id=raw.slice(sep+1);
   if(pending)return;pending=true;
   void cb(l,id).catch(e=>alert('Folgestunde nicht geändert: '+(e.message||e)))
    .finally(()=>{pending=false;});
  }));
 }
};
const oldRender=render;
render=function(){
 oldRender();const v=document.querySelector('.brand small');
 if(v)v.textContent=state.settings.schoolYear+' · V0.30.5';
};
if(typeof window!=='undefined')window.SchulcockpitWorksheetActualV305={
 rows:getRows,reflectionItems,nextPanel,sourceFor,core:C
};
})();