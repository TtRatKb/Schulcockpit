/* Schulcockpit V0.31.2 – sortable "Tatsächlicher Verlauf" cards at the TOP.
 * Reuses the validated V311 draft/commit contract. Never alters saved records on drag.
 */
(function(){
'use strict';
const CORE=window.SchulcockpitSequenceDragV311;
let autoScrolling=false,scrollEvents=0;
const safe=x=>esc(String(x??''));
function seqOpen(){return modal?.type==='sequence'?seq(modal.id):null;}
function unitLessonLinks(q,u){
 return (state.lessons||[]).filter(l=>l.classId===q.classId&&l.planReference?.unitId===u.id)
  .sort((a,b)=>Number(v182IsHeld(b))-Number(v182IsHeld(a))||
   Number(!!(b.slides||[]).length)-Number(!!(a.slides||[]).length)||
   String(a.id).localeCompare(String(b.id)));
}
function badge(l){
 return v182IsHeld(l)?'Gehalten':v182IsCanceled(l)?'Ausgefallen':
  statusMeta[l.status]?.[0]||'Offen';
}
function grip(q,u,held){
 return held?'<span class="v312-fixed" aria-label="Gehaltene Stunde: Position geschützt" title="Gehalten · nicht verschiebbar">🔒</span>':
  '<span role="button" tabindex="0" draggable="true" class="v311-handle v312-grip" '+
  'data-v311-handle="'+safe(u.id)+'" title="Stunde an eine andere Position ziehen" '+
  'aria-label="'+safe(u.title)+' verschieben (Alt + Pfeil hoch oder runter)">⋮⋮</span>';
}
function card(q,u,p,held){
 const links=unitLessonLinks(q,u);
 const date=p?.date||'',label=v201UnitSkipped(u)?'Dieses Jahr ausgelassen':
  date?fmtDate(date):'Datum offen';
 const locked=held||links.some(v182IsHeld);
 const title=safe(u.title||'Geplante Stunde'),actual=links.filter(l=>l.date),status=
  locked?'Gehalten':links.length?badge(links[0]):'Noch nicht vorbereitet';
 const notes=links.length>1?'<small class="v312-multiple">'+links.length+
  ' Stundenkarten verknüpft · beide bleiben erhalten</small>':'';
 const linksHtml=actual.length?actual.map(l=>
  '<button type="button" class="v312-open" data-lesson="'+safe(l.id)+'">'+
  '<span>'+safe(l.title&&l.title!==u.title?'Stundenkarte: '+l.title:'Stundenkarte öffnen')+'</span>'+
  '<small>'+safe(badge(l))+'</small></button>').join(''):
  '<button type="button" class="v312-organize secondary" data-v275-unit="'+
   safe(q.id+'|'+u.id)+'">Stunde organisieren</button>';
 return '<article class="v312-actual-row v311-row'+(locked?' v312-locked':'')+
  (v201UnitSkipped(u)?' v312-skipped':'')+'" data-v311-row="'+safe(u.id)+'">'+
  grip(q,u,locked)+
  '<div class="v312-actual-date" data-v311-date>'+safe(label)+'</div>'+
  '<div class="v312-actual-content"><strong class="v312-actual-title">'+title+'</strong>'+
  notes+(links.length>1?'<details class="v312-duplicates"><summary>Stundenkarten ansehen ('+
  links.length+')</summary><div class="v312-actions">'+linksHtml+'</div></details>':
  '<div class="v312-actions">'+linksHtml+'</div>')+'</div>'+
  '<span class="v312-status">'+safe(status)+'</span></article>';
}
function unmatched(q){
 const unitIds=new Set((q.plan||[]).map(u=>u.id)),ls=(state.lessons||[]).filter(l=>
  l.classId===q.classId&&l.sequenceId===q.id&&
  (!l.planReference?.unitId||!unitIds.has(l.planReference.unitId)));
 if(!ls.length)return '';
 return '<details class="v312-unmatched"><summary>'+ls.length+
  ' weitere Stundenkarte(n) ohne eindeutige Soll-Zuordnung</summary>'+
  '<p>Diese Originaleinträge werden nicht gelöscht oder automatisch in andere Stunden umgewandelt.</p>'+
  ls.map(l=>'<button type="button" data-lesson="'+safe(l.id)+'">'+
   safe(l.date?fmtDate(l.date):'Datum offen')+' · '+(l.title||'Ohne Thema'))+
   ' · '+safe(badge(l))+'</button>').join('')+'</details>';
}
function schedule(q,order){
 try{return new Map(CORE.preview(q,order).rows.map(p=>[p.id,p]));}
 catch(e){return new Map((q.plan||[]).map(u=>[u.id,{date:u.plannedDate||''}]));}
}
function content(q){
 const draft=CORE.getDraft(),current=(q.plan||[]).map(u=>u.id);
 const order=draft?.qid===q.id&&draft?.order?.length===current.length?
  draft.order:current;
 const byId=new Map(q.plan.map(u=>[u.id,u])),planned=schedule(q,order);
 return '<section class="detail-section v312-direct-section" data-v312-direct>'+
  '<div class="v312-head"><div><span class="eyebrow">DEINE STUNDEN IN DIESER REIHE</span>'+
  '<h3>Hier Stunden verschieben</h3>'+
  '<p>Greife <strong>⋮⋮</strong> und ziehe eine Stunde an ihren neuen Platz. '+
  'Die anderen offenen Stunden rücken in der Vorschau mit. <strong>Gehaltene Stunden bleiben fest.</strong></p>'+
  '</div><div class="v312-actions-top"><button class="primary" type="button" data-v311-save disabled>'+
  'Reihenfolge speichern</button><button class="secondary" type="button" data-v311-cancel hidden>'+
  'Verwerfen</button></div></div>'+
  '<small class="v311-live v312-live" data-v311-live aria-live="polite">'+
  (draft?.qid===q.id?'Noch nicht gespeichert – Änderungen prüfen.':'Noch keine Änderungen.')+'</small>'+
  '<div class="linked-lessons v311-list v312-actual-list" data-v311-list="actual">'+
  order.map(id=>byId.get(id)).filter(Boolean).map(u=>card(q,u,planned.get(u.id),
   unitLessonLinks(q,u).some(v182IsHeld))).join('')+'</div>'+
  unmatched(q)+'</section>';
}
const previousPanel=sequencePanel;
sequencePanel=function(q){
 let h=previousPanel(q);
 if(!q||(q.plan||[]).length===0)return h;
 // The legacy view renders this section after all the long Soll details.
 // Promote it to the top and replace just its content: all other editors remain.
 const marker='<div class="linked-lessons">',at=h.indexOf(marker);
 if(at<0)return h;
 const sectionStart=h.lastIndexOf('<section class="detail-section',at);
 const sectionEnd=h.indexOf('</section>',at);
 if(sectionStart<0||sectionEnd<0)return h;
 h=h.slice(0,sectionStart)+h.slice(sectionEnd+'</section>'.length);
 const root='<div class="detail-stack">';
 return h.includes(root)?h.replace(root,root+content(q)):content(q)+h;
};
// The modal body, not the document, is the scroll container.
// Firefox fires dragover repeatedly while the pointer remains at an edge.
document.addEventListener('dragstart',event=>{
 if(event.target.closest?.('.v312-actual-list [data-v311-handle]'))
  autoScrolling=true;
},true);
document.addEventListener('dragover',event=>{
 if(!autoScrolling||!seqOpen())return;
 const body=document.querySelector('.modal-body'),rect=body?.getBoundingClientRect();
 if(!body||!rect)return;
 const y=event.clientY,zone=Math.min(95,Math.max(45,rect.height*.15));
 let step=0;
 if(y>rect.bottom-zone&&y<=rect.bottom+12)
  step=Math.max(9,Math.round((y-(rect.bottom-zone))/zone*28));
 else if(y<rect.top+zone&&y>=rect.top-12)
  step=-Math.max(9,Math.round(((rect.top+zone)-y)/zone*28));
 if(step){
  event.preventDefault();
  body.scrollTop+=step;
  scrollEvents++;
 }
},true);
for(const eventName of ['drop','dragend'])document.addEventListener(eventName,()=>{
 autoScrolling=false;
},true);
window.SchulcockpitDirectSequenceDragV312={content,scrollInfo:()=>scrollEvents};
const originalRender=render;
render=function(){
 originalRender();
 const el=document.querySelector('.brand small');
 if(el)el.textContent=state.settings.schoolYear+' · V0.31.2';
};
})();
