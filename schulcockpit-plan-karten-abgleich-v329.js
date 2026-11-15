/* Schulcockpit V0.32.9 – one consistent plan/card identity in Reihenplanung
 * and the Monday workflow, including a visible, transactional repair of old data.
 */
(function(){
'use strict';
const C=SC_PLAN_CARD_SYNC_V329;
let busy=false,lastResult='',openYear='';
const today=()=>iso(new Date());
const fmt=d=>d?fmtDate(d):'Ohne Termin';
function inspect(cid,year){
 const y=year||v190PlanningYear(),qs=v190PlanningSequences(cid,y),
 slots=v190CourseSlots(cid,y);
 if(!qs.length||!slots.length)return null;
 return C.propose({state,classId:cid,sequences:qs,slots,today:today()});
}
function classLabel(cid){
 const c=cls(cid);return [c?.subject||'',c?.name||''].filter(Boolean).join(' ')||'Fachkurs';
}
const actionText=a=>a.kind==='move'?'Stundenkarte verschieben':
 a.kind==='park'?'Zusätzliche Karte ohne Termin aufbewahren':
 a.kind==='create'?'Fehlende Stundenkarte anlegen':'Zuordnung aktualisieren';
function relevantCourses(){
 const first=iso(activeMonday()),last=activeWeekEnd(),
 y=v190YearFromDate(first),ids=new Set();
 for(const l of state.lessons||[]){
  if(l.classId&&l.date>=first&&l.date<=last)ids.add(l.classId);
 }
 for(const q of state.sequences||[]){
  if(v190SeqYear(q)!==y)continue;
  if((q.plan||[]).some(u=>u.plannedDate>=first&&u.plannedDate<=last))
   ids.add(q.classId);
 }
 return [...ids].filter(cid=>v190PlanningSequences(cid,y).length).map(cid=>({cid,y}));
}
function banner(){
 if(!v186Ready||!['prep','week'].includes(view))return '';
 const entries=relevantCourses().map(({cid,y})=>({cid,y,p:inspect(cid,y)}))
   .filter(x=>x.p&&(x.p.changed||x.p.issues.length));
 if(!entries.length)return '';
 return '<section class="panel v329-banner" role="status">'+
  '<span class="eyebrow">REIHENPLANUNG ↔ STUNDENKARTEN</span>'+
  '<h3>Diese Unterrichtstermine stimmen noch nicht vollständig überein</h3>'+
  '<p>Der Montagsmodus verwendet vorhandene Stundenkarten. Hier kannst du '+
  'sie mit der gespeicherten Reihenplanung abgleichen – einschließlich '+
  'früherer offener Termine. Keine gehaltene Stunde wird verschoben.</p>'+
  '<div class="v329-banner-rows">'+entries.map(x=>'<div><strong>'+
   esc(classLabel(x.cid))+'</strong><span>'+x.p.changed+
   ' Kartenänderung'+(x.p.changed===1?'':'en')+
   (x.p.issues.length?' · '+x.p.issues.length+' Konflikt'+
    (x.p.issues.length===1?'':'e'):'')+'</span>'+
   '<button type="button" class="primary" data-v329-preview="'+esc(x.cid)+
   '" data-v329-year="'+esc(x.y)+'">Abgleich ansehen →</button></div>').join('')+
  '</div></section>';
}
const oldViewHtml=viewHtml;
viewHtml=function(){
 const html=oldViewHtml(),message=banner();
 if(!message)return html;
 const start=html.indexOf('<div class="content-grid');
 if(start>=0){
  const end=html.indexOf('>',start);
  if(end>=0)return html.slice(0,end+1)+message+html.slice(end+1);
 }
 return message+html;
};
const oldSequencePanel=sequencePanel;
sequencePanel=function(q){
 let html=oldSequencePanel(q);
 if(!q)return html;
 const p=inspect(q.classId,v190SeqYear(q));
 if(!p||!p.changed&&!p.issues.length)return html;
 const alert='<section class="detail-section v329-sequence-notice">'+
  '<div><strong>Stundenkarten mit dem Sollplan abgleichen</strong>'+
  '<p>'+p.changed+' abweichende oder fehlende Stundenkarte'+
   (p.changed===1?'':'n')+(p.issues.length?' · '+p.issues.length+
   ' nicht automatisch lösbare Konflikte':'')+
  '. Unterrichtsinhalte und Materialdateien bleiben dabei erhalten.</p></div>'+
  '<button type="button" class="primary" data-v329-preview="'+esc(q.classId)+
  '" data-v329-year="'+esc(v190SeqYear(q))+'">Abgleich prüfen →</button></section>';
 // Keep V312's direct drag editor as the FIRST child of detail-stack.
 // Its position is an established keyboard/drag and Chrome smoke invariant.
 const direct=html.indexOf('<section class="detail-section v312-direct-section"');
 if(direct>=0){
  const close=html.indexOf('</section>',direct);
  if(close>=0)return html.slice(0,close+'</section>'.length)+alert+
   html.slice(close+'</section>'.length);
 }
 const root='<div class="detail-stack">';
 return html.includes(root)?html.replace(root,root+alert):alert+html;
};
const oldModal=modalHtml;
modalHtml=function(){
 if(modal?.type!=='planCardSyncV329')return oldModal();
 const cid=modal.cid,y=modal.year,p=inspect(cid,y);
 const actions=p?.actions||[],issues=p?.issues||[],canApply=actions.length&&!issues.length;
 return '<div class="modal-backdrop" data-action="modal-close">'+
  '<section class="modal modal-xwide v329-modal" data-modal-stop>'+
  '<header class="modal-header"><div><span class="eyebrow">STUNDENPLAN ABGLEICH</span>'+
  '<h2>'+esc(classLabel(cid))+' · Stundenkarten korrigieren</h2></div>'+
  '<button type="button" class="icon-button" data-action="modal-close">×</button></header>'+
  '<div class="modal-body">'+
  '<p>Maßgeblich ist die Reihenfolge und Terminierung im Sollplan. '+
   'Vorhandene Unterrichtsinhalte gehören weiterhin zu ihrer <strong>Stunden-ID</strong> '+
   'und wandern samt Arbeitsblättern, Folien und Vorbereitung an den richtigen Termin.</p>'+
  (issues.length?'<div class="warnbox" role="alert"><strong>Bitte erst prüfen:</strong> '+
   issues.map(x=>esc(x)).join(' · ')+'</div>':'')+
  (actions.length?'<table class="v329-preview"><thead><tr><th>Änderung</th>'+
   '<th>Stunde</th><th>Bisher</th><th>Danach</th></tr></thead><tbody>'+
   actions.map(a=>'<tr><td>'+esc(actionText(a))+'</td>'+
    '<td>'+esc(a.title||'Unterrichtskarte')+'</td><td>'+esc(fmt(a.from))+
    '</td><td>'+esc(fmt(a.to))+'</td></tr>').join('')+'</tbody></table>':
   '<p>Keine automatisch korrigierbaren Abweichungen gefunden.</p>')+
  '<p class="microcopy">Zusätzliche Karten werden ohne Termin aufbewahrt, nicht gelöscht. '+
   'Du kannst sie anschließend direkt in der Reihenplanung öffnen und einzeln entfernen. '+
   'Bereits gehaltene Stunden sind geschützt. Der Papierkorb und alle Originaldateien bleiben unangetastet.</p>'+
  '<div class="v329-actions"><button type="button" class="secondary" data-action="modal-close">Abbrechen</button>'+
  '<button type="button" class="primary" data-v329-apply="'+esc(cid)+
   '" data-v329-year="'+esc(y)+'" '+(canApply?'':'disabled')+
   '>Diese '+actions.length+' Änderungen übernehmen</button></div></div>'+
  '</section></div>';
};
async function apply(cid,y){
 if(busy)return;
 const p=inspect(cid,y);
 if(!p||p.issues.length||!p.changed){
  alert(p?.issues.join('\n')||'Es sind keine Änderungen nötig.');render();return;
 }
 const backup=structuredClone(state.lessons);
 busy=true;
 try{
  state.lessons=p.lessons;
  await saveState();
  lastResult='✓ '+p.changed+' Stundenkarten abgeglichen.';
  modal=null;render();
 }catch(err){
  state.lessons=backup;
  try{await saveState();}catch(recovery){console.error('Karten-Rollback nicht gespeichert',recovery);}
  modal=null;render();
  alert('Abgleich nicht gespeichert. Der vorige Stand wurde wiederhergestellt: '+(err.message||err));
 }finally{busy=false;}
}
const oldReflow=v190RescheduleCourseYear;
v190RescheduleCourseYear=function(cid,year=v190PlanningYear(),silent=false,options={}){
 const originalLessons=structuredClone(state.lessons),
 originalSequences=structuredClone(state.sequences);
 try{
  const result=oldReflow(cid,year,silent,options),p=inspect(cid,year);
  if(p?.issues.length){
   // Do not quietly claim consistent planning if a historical or unidentified
   // card prevents a safe move. Let the caller show the remaining conflict.
   result.warning=[result.warning,...p.issues].filter(Boolean).join('\n');
  }else if(p?.changed){
   state.lessons=p.lessons;result.cardUpdatesV329=p.changed;
  }
  return result;
 }catch(e){
  state.lessons=originalLessons;state.sequences=originalSequences;
  throw e;
 }
};
let delegated=false;
function enhanceCards(){
 for(const b of document.querySelectorAll('.v312-direct-section [data-v329-open]')){
  const id=b.dataset.v329Open,l=lesson(id);
  if(!l||b.parentElement?.querySelector('[data-v329-delete="'+id+'"]'))continue;
  if(typeof SC_DUPLICATE_CLEANUP_V328==='undefined'||
    !SC_DUPLICATE_CLEANUP_V328.evaluate(state,id).allowed)continue;
  const remove=document.createElement('button');
  remove.type='button';remove.className='danger-lite small v329-delete';
  remove.textContent='Karte entfernen …';
  remove.dataset.v329Delete=id;
  b.insertAdjacentElement('afterend',remove);
 }
}
function bind(){
 if(delegated)return;delegated=true;
 document.addEventListener('click',e=>{
  const open=e.target.closest?.('[data-v329-open]'),
   remove=e.target.closest?.('[data-v329-delete]'),
   preview=e.target.closest?.('[data-v329-preview]'),
   commit=e.target.closest?.('[data-v329-apply]');
  const b=open||remove||preview||commit;
  if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(open){
   const l=lesson(open.dataset.v329Open);
   if(!l)return;
   v182LessonId=l.id;modal=null;view='lessonDayV182';render();
  }else if(remove){
   modal={type:'duplicateCleanupV328',lessonId:remove.dataset.v329Delete};render();
  }else if(preview){
   modal={type:'planCardSyncV329',cid:preview.dataset.v329Preview,
    year:preview.dataset.v329Year||v190PlanningYear()};render();
  }else if(commit){
   apply(commit.dataset.v329Apply,commit.dataset.v329Year||v190PlanningYear());
  }
 },true);
}
const oldRender=render;
render=function(){
 bind();
 oldRender();
 enhanceCards();
 const label=document.querySelector('.brand small');
 if(label)label.textContent=state.settings.schoolYear+' · V0.32.9';
};
window.SchulcockpitPlanCardSyncV329={inspect,apply,byCourse:relevantCourses,
 result:()=>lastResult};
})();
