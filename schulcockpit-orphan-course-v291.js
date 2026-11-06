/* Schulcockpit V0.29.1 – explicit recovery of sequences assigned to an
 * unused duplicate course, e.g. Religion 5f -> timetable course Religion 5.
 * Never silently reassigns, deletes or re-schedules lessons.
 */
(function(){
'use strict';
function subjectKey(c){return String(c?.subject||'').trim().toLocaleLowerCase('de-DE');}
function grade(c){return Number(String(c?.name||'').match(/\d+/)?.[0])||0;}
function eligibleSource(c){
 if(!c||!grade(c)||!(state.sequences||[]).some(q=>q.classId===c.id))return false;
 if((state.timetable||[]).some(t=>t.classId===c.id))return false;
 if((state.lessons||[]).some(l=>l.classId===c.id))return false;
 if((state.assessments||[]).some(a=>a.classId===c.id))return false;
 return true;
}
function targetFor(c){
 if(!eligibleSource(c))return null;
 const choices=(state.classes||[]).filter(x=>x.id!==c.id&&
  grade(x)===grade(c)&&subjectKey(x)===subjectKey(c)&&
  (state.timetable||[]).some(t=>t.classId===x.id));
 return choices.length===1?choices[0]:null;
}
function transferPreview(from,to){
 const source=state.classes.find(c=>c.id===from),target=state.classes.find(c=>c.id===to);
 if(!source||targetFor(source)?.id!==to)return null;
 const all=(state.sequences||[]),moving=all.filter(q=>q.classId===from),
 existing=all.filter(q=>q.classId===to);
 if(!moving.length)return null;
 const ids=new Set(moving.map(q=>q.id));
 const units=new Set(moving.flatMap(q=>(q.plan||[]).map(u=>u.id)));
 const dates=moving.flatMap(q=>(q.plan||[]).map(u=>u.plannedDate).filter(Boolean));
 return {source,target,moving,existing,ids,units,dates};
}
function viewModal(){
 const p=transferPreview(modal?.from,modal?.to);
 if(!p)return '<div class="modal-backdrop" data-action="modal-close"><section class="modal" data-modal-stop>Der Kursbestand hat sich verändert. Bitte die Reihenübersicht neu öffnen.</section></div>';
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide v291-modal" data-modal-stop>'+
  '<header class="modal-header"><div><span class="eyebrow">VORSCHAU · NOCH NICHT GESPEICHERT</span>'+
  '<h2>'+esc(p.moving.length+' Reihen von '+p.source.subject+' '+p.source.name+
   ' zu '+p.target.subject+' '+p.target.name+' zuordnen')+'</h2></div>'+
  '<button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">'+
  '<p>Der Ausgangskurs hat keine Unterrichtsstunde, keinen Stundenplaneintrag und keine Klassenarbeit. '+
  'Seine Reihen werden dem aktiven Fachkurs zugeordnet. '+
  '<strong>Themen, Datierungen und lokale Materialdateien bleiben erhalten.</strong> '+
  'Es findet keine automatische Neu-Terminierung statt.</p>'+
  '<div class="v291-preview-grid"><section><h3>Zu übertragende Reihen</h3><ul>'+
  p.moving.map(q=>'<li>'+esc(q.title)+' <small>('+((q.plan||[]).length)+' Stunden)</small></li>').join('')+
  '</ul></section><section><h3>Im Zielkurs bereits vorhanden</h3><ul>'+
  (p.existing.map(q=>'<li>'+esc(q.title)+'</li>').join('')||'<li>Keine Reihen</li>')+
  '</ul></section></div>'+
  '<p class="microcopy">Der leere Ausgangskurs bleibt in der Klassenverwaltung gespeichert und wird nicht automatisch gelöscht. '+
  'Wenn sich Inhalte überschneiden, kannst du die Reihen danach in Ruhe prüfen.</p>'+
  '<button class="primary" data-v291-confirm="'+esc(p.source.id)+'|'+esc(p.target.id)+'">Diese Reihen und ihre Materialzuordnungen übernehmen</button>'+
  '</div></section></div>';
}
async function transfer(from,to){
 const p=transferPreview(from,to);
 if(!p)throw Error('Die Ausgangskurse oder der Stundenplan wurden verändert.');
 if(!confirm(p.moving.length+' gespeicherte Reihen von '+p.source.subject+' '+p.source.name+
  ' zu '+p.target.subject+' '+p.target.name+
  ' übertragen? Bestehende Reihen und Termine bleiben unverändert; der alte Kurs wird nicht gelöscht.'))return false;
 const seqOld=state.sequences.map(q=>({id:q.id,classId:q.classId,orderV190:q.orderV190}));
 const assignmentsOld=new Map(),catalogOld=new Map();
 try{
  let next=Math.max(-1,...p.existing.map(q=>Number(q.orderV190)||0))+1;
  for(const q of p.moving){
   q.classId=to;q.orderV190=next++;
  }
  for(const material of state.materials||[]){
   const changes=(material.assignments||[]).filter(a=>a.classId===from&&
    (p.ids.has(a.sequenceId)||p.units.has(a.unitId)));
   if(!changes.length)continue;
   assignmentsOld.set(material.id,structuredClone(material.assignments));
   for(const a of changes)a.classId=to;
  }
  for(const entry of state.materialCatalog||[]){
   const hub=entry?.hubV237;
   if(hub?.courseId===from&&p.ids.has(hub.sequenceId)){
    catalogOld.set(entry.catalogId,structuredClone(hub));hub.courseId=to;
   }
  }
  // Ensure state + large material catalog are durable before success is shown.
  await saveState();
  if(catalogOld.size)await persistCatalogV171();
  modal=null;render();
  return true;
 }catch(err){
  for(const q of state.sequences||[]){
   const old=seqOld.find(x=>x.id===q.id);
   if(old){q.classId=old.classId;q.orderV190=old.orderV190;}
  }
  for(const m of state.materials||[])if(assignmentsOld.has(m.id))
   m.assignments=assignmentsOld.get(m.id);
  for(const e of state.materialCatalog||[])if(catalogOld.has(e.catalogId))
   e.hubV237=catalogOld.get(e.catalogId);
  await saveState().catch(()=>{});
  if(catalogOld.size)await persistCatalogV171().catch(()=>{});
  throw err;
 }
}
function decorate(){
 if(view!=='sequences')return;
 for(const fold of document.querySelectorAll('.v290-inactive-courses .v290-course-fold')){
  const cid=fold.dataset.v290Course,c=state.classes.find(x=>x.id===cid),target=targetFor(c);
  const summary=fold.querySelector(':scope > summary');
  if(!summary||!target)continue;
  const btn=document.createElement('button');
  btn.type='button';btn.className='secondary v291-move';
  btn.textContent='Reihen zu '+target.subject+' '+target.name+' übertragen';
  btn.title='Zuordnung prüfen – keine Inhalte löschen';
  btn.onclick=e=>{e.preventDefault();e.stopPropagation();modal={type:'v291-transfer',from:cid,to:target.id};render();};
  summary.append(btn);
 }
 // Hide a completely empty former duplicate only in the year-plan overview,
 // keeping the course itself accessible in the class administration.
 const container=document.querySelector('.v290-inactive-courses');
 if(container){
  for(const fold of [...container.querySelectorAll('.v290-course-fold')]){
   const cid=fold.dataset.v290Course;
   if((state.sequences||[]).some(q=>q.classId===cid))continue;
   const section=fold.closest('.v290-course-plan');section?.remove();
  }
  if(!container.querySelector('.v290-course-plan'))container.remove();
 }
}
const previousModal=modalHtml;
modalHtml=function(){return modal?.type==='v291-transfer'?viewModal():previousModal();};
const previousWire=wire;
wire=function(){
 previousWire();
 document.querySelector('[data-v291-confirm]')?.addEventListener('click',async e=>{
  const button=e.currentTarget;button.disabled=true;
  const [from,to]=button.dataset.v291Confirm.split('|');
  try{await transfer(from,to);}catch(err){alert('Kurszuordnung nicht übernommen: '+(err?.message||err));render();}
 });
};
const oldRender=render;
render=function(){
 oldRender();decorate();
 const ver=document.querySelector('.brand small');if(ver)ver.textContent=state.settings.schoolYear+' · V0.29.1';
};
window.SchulcockpitOrphanCoursesV291={eligibleSource,targetFor,transferPreview,transfer};
})();