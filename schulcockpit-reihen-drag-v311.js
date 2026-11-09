/* Schulcockpit V0.31.1 – drag individual hours, review, then commit once.
 * Planned lessons retain identity and every linked material, note, PPT and print flag.
 * Only held hours are immovable; the old date-based scheduler is NOT used here.
 */
(function(){
'use strict';
const C=SC_SEQUENCE_DRAG_V311;
let draft=null,dragging='',notice='';
const tidy=s=>String(s??'');
function qForModal(){return modal?.type==='sequence'?seq(modal.id):null;}
function linked(q,u){
 const candidates=(state.lessons||[]).filter(l=>l.classId===q.classId);
 return candidates.filter(l=>{
  if(l.planReference?.unitId)return l.planReference.unitId===u.id;
  // Some older actual lessons were stored before unitId associations were
  // introduced. Respect only an unambiguous same-sequence same-date match.
  // Never capture an unrelated blank timetable placeholder.
  if(!u.plannedDate||l.sequenceId!==q.id||l.date!==u.plannedDate||
     (q.plan||[]).filter(x=>x.plannedDate===u.plannedDate).length!==1)return false;
  return v182IsHeld(l)||v182IsCanceled(l)||!blank(l);
 });
}
function heldIds(q){return (q.plan||[]).filter(u=>linked(q,u).some(v182IsHeld)).map(u=>u.id);}
function fingerprint(q){
 return JSON.stringify({
  plan:(q.plan||[]).map(u=>[u.id,u.plannedDate,u.plannedSlotV272,u.skippedThisYearV201]),
  lessons:(state.lessons||[]).filter(l=>l.classId===q.classId&&
   (q.plan||[]).some(u=>u.id===l.planReference?.unitId))
   .map(l=>[l.id,l.date,lessonSlot(l),l.timetableId,l.status,
    l.planReference?.unitId,v182IsHeld(l),v182IsCanceled(l)]),
  timetable:(state.timetable||[]).filter(t=>t.classId===q.classId)
   .map(t=>[t.id,t.weekday,t.slot])
 });
}
function unitRows(q){
 const courseSlots=v190CourseSlots(q.classId,v190SeqYear(q)),chosen=new Set();
 return (q.plan||[]).map(u=>{
  const ls=linked(q,u),held=ls.find(v182IsHeld),
   matching=ls.find(l=>l.date===u.plannedDate)||null;
  const date=held?.date||u.plannedDate||'',preferred=held||matching;
  let s=null;
  if(date){
   const available=courseSlots.filter(x=>x.date===date);
   const slotPref=preferred?lessonSlot(preferred):
    C.asSlot(u.plannedSlotV272);
   s=available.find(x=>Number(x.slot)===slotPref&&
    (!preferred?.timetableId||x.timetableId===preferred.timetableId))||
    (preferred?.timetableId?available.find(x=>x.timetableId===preferred.timetableId):null)||
    (available.length===1?available[0]:null);
   // Several hours on the same date require an exact existing association.
   if(!s&&available.length>1&&slotPref!==null)
    s=available.find(x=>Number(x.slot)===slotPref)||null;
  }
  const slot=preferred?lessonSlot(preferred):
   C.asSlot(u.plannedSlotV272)??(s?Number(s.slot):null);
  const period=preferred?.period||s?.period||'';
  const timetableId=preferred?.timetableId||s?.timetableId||'';
  const key=date+'|'+(slot===null?'?':slot);
  if(date&&!v201UnitSkipped(u)){
   if(chosen.has(key))throw Error('Mehrere Soll-Stunden teilen denselben Fachtermin '+date+
    '. Bitte ihre Stundenblöcke zuerst eindeutig zuordnen.');
   chosen.add(key);
  }
  return {id:u.id,title:u.title||'',held:!!held,skipped:v201UnitSkipped(u),
   date,slot,period,timetableId};
 });
}
function preview(q,order){
 return C.calculate(unitRows(q),order);
}
function selectedOrder(q){
 if(draft&&draft.qid===q.id){
  if(draft.signature===fingerprint(q))return draft.order;
  draft=null;notice='Die Planungsdaten haben sich verändert. Bitte erneut sortieren.';
 }
 return (q.plan||[]).map(u=>u.id);
}
function toolbar(){
 const current=qForModal(),dirty=!!(current&&draft?.qid===current.id&&
  draft.signature===fingerprint(current)&&draft.order.some((id,i)=>id!==current.plan?.[i]?.id));
 return '<div class="v311-toolbar"><p>Stunden an <strong>⋮⋮</strong> greifen und an die gewünschte Stelle ziehen. '+
  'Nur tatsächlich <strong>gehaltene Stunden</strong> sind fest. Geplante Stunden, '+
  'auch vorbereitete und vergangene ohne „Gehalten“, dürfen verschoben werden. '+
  '<span>Änderungen werden erst mit „Reihenfolge speichern“ wirksam.</span></p>'+
  '<div class="v311-buttons"><button class="primary" data-v311-save '+(dirty?'':'disabled')+'>Reihenfolge speichern ✓</button>'+
  '<button class="secondary" data-v311-cancel '+(dirty?'':'hidden')+'>Verwerfen</button></div>'+
  '<small class="v311-live" data-v311-live aria-live="polite">'+
  (notice||'Noch keine Änderungen.')+'</small></div>';
}
function handle(q,u){
 const fixed=heldIds(q).includes(u.id);
 return fixed?'<span class="v311-held" title="Bereits gehalten – fester Termin" aria-label="Bereits gehalten">🔒</span>':
  '<span role="button" tabindex="0" draggable="true" class="v311-handle" '+
  'data-v311-handle="'+esc(u.id)+'" title="Ziehen zum Verschieben · Tastatur: Alt + Pfeiltaste" '+
  'aria-label="Stunde '+esc(u.title)+' verschieben">⋮⋮</span>';
}
function summaryRow(q,u,i){
 let html=planUnitCardV10(q,u,i);
 html=html.replace('data-use-plan-unit="'+q.id+'|'+u.id+'"',
  'data-v275-unit="'+q.id+'|'+u.id+'"');
 html=html.replace('In nächste Stunde übernehmen →','Stunde organisieren →');
 html=html.replace(/^(<article class="sequence-plan-unit )/,
  '<article data-v311-row="'+esc(u.id)+'" class="sequence-plan-unit v311-row ');
 html=html.replace(/^(<article[^>]*>)/,'$1'+handle(q,u));
 html=html.replace('<div class="sequence-plan-date"><span>',
  '<div class="sequence-plan-date"><span data-v311-date>');
 html=html.replace('<strong>'+(i+1)+'</strong></div><div class="sequence-plan-copy">',
  '<strong data-v311-pos>'+(i+1)+'</strong></div><div class="sequence-plan-copy">');
 return html;
}
function editorRow(q,u,i){
 const fixed=linked(q,u).some(v182IsHeld),skipped=v201UnitSkipped(u);
 const actions='<button class="text-button" data-v201-unit-before="'+esc(q.id+'|'+u.id)+'">+ davor</button>'+
  '<button class="secondary" data-v182-unit-edit="'+esc(q.id+'|'+u.id)+'">Bearbeiten</button>'+
  '<button class="'+(skipped?'secondary':'text-button')+'" data-v201-unit-skip="'+
   esc(q.id+'|'+u.id)+'" data-v201-skip-value="'+(skipped?'0':'1')+'">'+
   (skipped?'Wieder einplanen':'Dieses Jahr auslassen')+'</button>'+
  '<button class="danger-lite small" data-v188-unit-delete="'+esc(q.id+'|'+u.id)+'">Löschen</button>';
 return '<div class="v201-plan-edit-row v311-row '+(skipped?'v201-skipped-row':'')+
  (fixed?' v311-is-held':'')+'" data-v311-row="'+esc(u.id)+'">'+handle(q,u)+
  '<span data-v311-date>'+esc(skipped?'—':u.plannedDate?fmtDate(u.plannedDate):'Datum offen')+'</span>'+
  '<strong>'+esc(u.title)+'</strong>'+
  '<small data-v311-pos>'+(fixed?'🔒 Gehalten · ':'')+'Position '+(i+1)+'</small>'+
  '<div class="v201-plan-row-actions v311-editor-actions">'+actions+'</div></div>';
}
const oldPanel=sequencePanel;
sequencePanel=function(q){
 let html=oldPanel(q);if(!q||!(q.plan||[]).length)return html;
 const order=selectedOrder(q),byId=new Map(q.plan.map(u=>[u.id,u]));
 const rows=order.map(id=>byId.get(id)).filter(Boolean);
 // Update the compact list and the editing list: both share the same pending order.
 const start=html.indexOf('<div class="sequence-plan-list">');
 if(start>=0){
  const end=html.indexOf('</div></section>',start);
  if(end>=0){
   const list='<div class="sequence-plan-list v311-list" data-v311-list="summary">'+
    rows.map((u,i)=>summaryRow(q,u,i)).join('')+'</div>';
   html=html.slice(0,start)+list+html.slice(end+6);
  }
 }
 const editing='<section class="detail-section v182-plan-edit v201-plan-edit v311-section">'+
  '<div class="section-head"><div><h3>Einzelstunden im Sollplan sortieren</h3>'+
  '<p class="microcopy">Ganze Stunden inklusive Material und Vorbereitung bewegen sich gemeinsam. '+
  'Gehaltene Stunden bleiben unverändert.</p></div>'+
  '<button class="primary" data-v182-unit-new="'+esc(q.id)+'">+ Stunde ergänzen</button></div>'+
  toolbar()+'<div class="v182-plan-edit-list v201-plan-edit-list v311-list" data-v311-list="editor">'+
  rows.map((u,i)=>editorRow(q,u,i)).join('')+'</div></section>';
 html=html.replace(/<section class="detail-section v182-plan-edit v201-plan-edit">[\s\S]*?<\/section>/,
  editing);
 // Keep one save bar near the compact list, too, so no scrolling is required.
 const summaryStart=html.indexOf('<div class="sequence-plan-list v311-list"');
 if(summaryStart>=0)html=html.slice(0,summaryStart)+toolbar()+html.slice(summaryStart);
 return html;
};
function updateDom(q){
 const order=selectedOrder(q),p=preview(q,order),byId=new Map(q.plan.map(u=>[u.id,u]));
 for(const list of document.querySelectorAll('[data-v311-list]')){
  const nodes=new Map([...list.querySelectorAll('[data-v311-row]')]
   .map(el=>[el.dataset.v311Row,el]));
  for(const item of p.rows){
   const el=nodes.get(item.id);if(!el)continue;
   list.appendChild(el);
   const u=byId.get(item.id),label=item.skipped?
    (list.dataset.v311List==='summary'?'Dieses Schuljahr ausgelassen':'—'):
    item.date?fmtDate(item.date):'Datum offen';
   const dateNode=el.querySelector('[data-v311-date]');
   if(dateNode)dateNode.textContent=label+
    (list.dataset.v311List==='summary'&&u?.hours?' · '+u.hours+' Std.':'');
   const pos=el.querySelector('[data-v311-pos]');
   if(pos)pos.textContent=(list.dataset.v311List==='summary'?'':item.held?'🔒 Gehalten · ':'Position ')+
    (p.rows.indexOf(item)+1);
   el.classList.toggle('v311-updated',p.changes.some(x=>x.id===item.id));
  }
 }
 const modified=!!draft&&draft.qid===q.id&&p.orderChanged;
 for(const b of document.querySelectorAll('[data-v311-save]'))b.disabled=!modified;
 for(const b of document.querySelectorAll('[data-v311-cancel]'))b.hidden=!modified;
 for(const el of document.querySelectorAll('[data-v311-live]')){
  el.textContent=modified?'Noch nicht gespeichert · '+p.changed+' Termin'+(p.changed===1?'':'e')+
   ' ändern sich. Materialien und vorbereitete Folien bleiben bei ihren Stunden.':
   (notice||'Noch keine Änderungen.');
 }
}
function applyDrop(q,source,target,after){
 try{
  const current=selectedOrder(q),fixed=heldIds(q);
  const order=C.reorder(current,source,target,after,fixed);
  if(order.every((id,i)=>id===current[i]))return;
  preview(q,order); // validate before updating a single UI element
  if(!draft||draft.qid!==q.id)draft={qid:q.id,signature:fingerprint(q),order};
  else draft.order=order;
  notice='';updateDom(q);
 }catch(e){alert('Verschieben nicht möglich: '+(e.message||e));}
}
function sameSlot(l,p){
 return l.date===p.date&&(p.slot===null||Number(lessonSlot(l))===Number(p.slot));
}
function blank(l){
 return !v182IsHeld(l)&&!v182IsCanceled(l)&&
  !(l.materials||[]).length&&!(l.phasePlan||[]).length&&
  !(l.slides||[]).length&&!(l.printPlan||[]).length&&
  !(l.prepTasks||[]).length&&!l.presentationReady&&!l.aiImportAt&&
  !l.manualPlanReadyV177&&!l.manualPinnedV272&&!l.actualV270?.savedAt&&
  !l.heldAtV182&&!l.reflectionV182?.completedAt;
}
async function persist(q){
 if(!draft||draft.qid!==q.id||draft.signature!==fingerprint(q))
  throw Error('Die Planung hat sich seit dem Ziehen verändert. Bitte neu öffnen.');
 const p=preview(q,draft.order);
 if(!p.orderChanged)return 0;
 const byId=new Map(q.plan.map(u=>[u.id,u])),placed=new Map(p.rows.map(x=>[x.id,x]));
 const moving=[],movingIds=new Set();
 // Link by stable unit ID, not by a date or a fuzzy topic.
 for(const u of q.plan){
  const target=placed.get(u.id);
  if(!target)throw Error('Geplante Stunden-ID fehlt.');
  if(u.plannedDate&&!v201UnitSkipped(u)&&!target.date)
   throw Error('Sicherheitsstopp: „'+u.title+'“ würde ihren Termin verlieren.');
  for(const l of linked(q,u)){
   if(v182IsHeld(l)){
    if(l.date!==target.date)throw Error('Gehaltener Termin würde verändert: '+l.date);
    continue;
   }
   if(v182IsCanceled(l))continue; // preserve the cancelled historical card
   // A lesson manually moved elsewhere is NOT the scheduled representation
   // of this unit; respect that override.
   if(l.date!==u.plannedDate)continue;
   if(!l.date||!target.date)continue;
   if(l.date===target.date&&Number(lessonSlot(l))===Number(target.slot))continue;
   moving.push({l,u,target});movingIds.add(l.id);
  }
 }
 const byUnit=new Map();
 for(const x of moving){
  const group=byUnit.get(x.u.id)||[];group.push(x);byUnit.set(x.u.id,group);
  if(x.target.slot===null&&x.l.date!==x.target.date)
   throw Error('Der neue Fachtermin für „'+x.u.title+'“ benötigt einen eindeutigen Stundenblock.');
 }
 for(const group of byUnit.values()){
  if(group.length<2)continue;
  const first=group[0].l;
  if(group.some(x=>x.l.date!==first.date||
     Number(lessonSlot(x.l))!==Number(lessonSlot(first))))
   throw Error('Mehrere Karten zur selben Soll-Stunde belegen unterschiedliche Stundenblöcke.');
 }
 // Never remove another lesson from its date. Only a genuinely empty
 // timetable placeholder is allowed to coexist; all populated collisions
 // stop the operation before a single source record is changed.
 for(const {l,target} of moving){
  for(const other of state.lessons||[]){
   if(other.classId!==q.classId||!other.date||movingIds.has(other.id)||
      !sameSlot(other,target)||other.id===l.id)continue;
   if(!blank(other)||other.planReference?.unitId)
    throw Error('Zieltermin '+target.date+' ist bereits mit „'+
      (other.title||'einer anderen Stunde')+'“ belegt. Nichts wurde verändert.');
  }
 }
 const backup={sequences:structuredClone(state.sequences),
  lessons:structuredClone(state.lessons)};
 try{
  q.plan.splice(0,q.plan.length,...draft.order.map(id=>byId.get(id)));
  for(const x of p.rows){
   const u=byId.get(x.id);
   // Never edit a held lesson; this records only the Soll plan's assignment.
   u.plannedDate=x.date;
   if(x.date&&x.slot!==null)u.plannedSlotV272=x.slot;
   else delete u.plannedSlotV272;
   if(!x.skipped&&x.date)delete u.overflowV280;
  }
  // A permutation of the existing appointments must not rewrite the start
  // and end of the sequence or park unrelated blank timetable cards.
  for(const {l,u,target} of moving){
   const oldDate=l.date;
   l.date=target.date;
   if(target.slot!==null)l.slot=target.slot;
   if(target.period)l.period=target.period;
   if(target.timetableId)l.timetableId=target.timetableId;
   l.sequenceId=q.id;l.unit=q.title;
   // Do not reset independently edited lesson content, resources, materials
   // or teacher notes from the old coarse sequence template.
   l.planReference={...(l.planReference||{}),unitId:u.id,
    plannedDate:target.date};
   if(target.date)delete l.scheduleParkedV275;
   else l.scheduleParkedV275={previousDate:oldDate,
    reason:'Aktives Soll-Thema ohne freien Fachtermin'};
   // The original PPT is retained as a local file. But its DATE may be stale;
   // do not mark it as ready for the rescheduled lesson.
   if(oldDate!==target.date&&l.presentationReady&&
      l.presentationSourceV177==='generated'&&!l.presentationNotRequiredV177){
    l.presentationReady=false;
    l.pptNeedsDateRefreshV311={oldDate,changedAt:new Date().toISOString()};
   }
  }
  // Empty week cards with stale course titles must be reconciled explicitly.
  for(const row of p.rows){
   if(!row.date||row.skipped||row.held)continue;
   if((state.lessons||[]).some(l=>l.classId===q.classId&&
     l.planReference?.unitId===row.id&&l.date===row.date))continue;
   const u=byId.get(row.id);
   const l=(state.lessons||[]).find(l=>l.classId===q.classId&&
     sameSlot(l,row)&&blank(l)&&!l.planReference?.unitId);
   if(l){
    l.sequenceId=q.id;l.unit=q.title;l.title=u.title||'Thema noch festlegen';
    l.objective=u.objective||'';
    l.planReference={unitId:u.id,title:u.title,plannedDate:row.date,
     content:u.content||'',objective:u.objective||'',material:u.material||'',
     notes:u.notes||'',autoMatched:true};
   }
  }
  await Promise.resolve(saveState());
  const count=p.changed;draft=null;notice='✓ Reihenfolge gespeichert · '+
   count+' Termin'+(count===1?'':'e')+' aktualisiert. Montagsmodus und „Meine Woche“ nutzen die neue Planung.';
  modal={type:'sequence',id:q.id};render();
  return count;
 }catch(err){
  state.sequences=backup.sequences;
  state.lessons=backup.lessons;
  render();throw err;
 }
}
// Delegation survives modal/html replacement and the many historical render
// wrappers. Binding listeners to individual rows is unreliable in those flows.
let delegated=false;
function bindSortableEvents(){
 if(delegated||typeof document.addEventListener!=='function')return;
 delegated=true;
 document.addEventListener('keydown',e=>{
  const grip=e.target.closest?.('[data-v311-handle]'),q=qForModal();
  if(!grip||!q||!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;
  e.preventDefault();
  const order=selectedOrder(q),i=order.indexOf(grip.dataset.v311Handle);
  const dest=order[i+(e.key==='ArrowUp'?-1:1)];
  if(dest)applyDrop(q,grip.dataset.v311Handle,dest,e.key==='ArrowDown');
 });
 document.addEventListener('dragstart',e=>{
  const grip=e.target.closest?.('[data-v311-handle]'),q=qForModal();
  if(!grip||!q)return;
  dragging=grip.dataset.v311Handle;
  if(!dragging||heldIds(q).includes(dragging)){e.preventDefault();dragging='';return;}
  e.dataTransfer?.setData('text/plain',dragging); // Firefox needs real drag payload.
  if(e.dataTransfer)e.dataTransfer.effectAllowed='move';
  grip.classList.add('v311-dragging');
 });
 document.addEventListener('dragover',e=>{
  const row=e.target.closest?.('[data-v311-row]'),q=qForModal();
  if(!row||!q||!dragging||row.dataset.v311Row===dragging)return;
  e.preventDefault();
  if(e.dataTransfer)e.dataTransfer.dropEffect='move';
  const rect=row.getBoundingClientRect(),after=e.clientY>=rect.top+rect.height/2;
  row.classList.add('v311-over');row.classList.toggle('v311-after',after);
 });
 document.addEventListener('dragleave',e=>{
  const row=e.target.closest?.('[data-v311-row]');
  if(row&&!row.contains(e.relatedTarget))row.classList.remove('v311-over','v311-after');
 });
 document.addEventListener('drop',e=>{
  const row=e.target.closest?.('[data-v311-row]'),q=qForModal();
  if(!row||!q||!dragging)return;
  e.preventDefault();
  const source=dragging,target=row.dataset.v311Row,rect=row.getBoundingClientRect();
  const after=e.clientY>=rect.top+rect.height/2;
  dragging='';
  document.querySelectorAll('.v311-over,.v311-dragging').forEach(el=>
   el.classList.remove('v311-over','v311-after','v311-dragging'));
  applyDrop(q,source,target,after);
 });
 document.addEventListener('dragend',()=>{
  dragging='';
  document.querySelectorAll('.v311-dragging,.v311-over').forEach(el=>
   el.classList.remove('v311-dragging','v311-over','v311-after'));
 });
 document.addEventListener('click',async e=>{
  const b=e.target.closest?.('[data-v311-save],[data-v311-cancel]'),q=qForModal();
  if(!b||!q)return;
  e.preventDefault();e.stopPropagation();
  if(b.hasAttribute('data-v311-cancel')){
   draft=null;notice='Änderung verworfen.';render();return;
  }
  if(b.disabled)return;
  document.querySelectorAll('[data-v311-save]').forEach(x=>x.disabled=true);
  try{await persist(q);}catch(err){
   alert('Reihenfolge wurde nicht gespeichert: '+(err.message||err));
   document.querySelectorAll('[data-v311-save]').forEach(x=>x.disabled=false);
  }
 },true); // Capture: the legacy modal stops click bubbling at data-modal-stop.
}
const beforeWire=wire;
wire=function(){beforeWire();bindSortableEvents();};
bindSortableEvents();
const oldPpt=v182PptAction;
v182PptAction=function(l){
 if(!l?.pptNeedsDateRefreshV311)return oldPpt(l);
 return '<small class="v311-ppt-warning">Die gespeicherte PowerPoint trägt noch das alte Datum '+
  esc(l.pptNeedsDateRefreshV311.oldDate||'')+'. Original bleibt erhalten.</small>'+
  '<button class="secondary" data-v311-ppt-refresh="'+esc(l.id)+'">PowerPoint für neuen Termin erzeugen ↗</button>';
};
const pptWire=wire;
wire=function(){
 pptWire();
 document.querySelectorAll('[data-v311-ppt-refresh]').forEach(b=>b.addEventListener('click',async()=>{
  const l=lesson(b.dataset.v311PptRefresh);if(!l)return;
  try{
   await generateMomijiPptV13(l);
   delete l.pptNeedsDateRefreshV311;
   await Promise.resolve(saveState());render();
  }catch(e){alert('PowerPoint konnte noch nicht aktualisiert werden: '+(e.message||e));}
 }));
};
const previousRender=render;
render=function(){
 previousRender();
 const el=document.querySelector('.brand small');
 if(el)el.textContent=state.settings.schoolYear+' · V0.31.1';
};
window.SchulcockpitSequenceDragV311={
 getRows:unitRows,preview,commit:persist,getDraft:()=>draft,
 stageOrder:(qid,order)=>{const q=seq(qid);if(!q)return false;
  const current=selectedOrder(q);
  if(!Array.isArray(order)||order.length!==current.length)return false;
  preview(q,order);
  draft={qid:q.id,signature:fingerprint(q),order:[...order]};
  notice='';updateDom(q);return true;
 },

 discard:()=>{draft=null;notice='Nicht gespeicherte Reihenfolge verworfen.';render();},
 move:(qid,source,target,after=false)=>{const q=seq(qid);if(q)applyDrop(q,source,target,after);},
 reorder:C.reorder
};
})();
