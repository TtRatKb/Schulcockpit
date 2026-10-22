/* Schulcockpit V0.24.7 — competency texts and safe assignment to planned lessons.
   Adds no new state schema; retains existing curriculum IDs and protected Ist lessons. */
(function(){
'use strict';
const previousCard=planUnitCardV10;
planUnitCardV10=function(q,u,i){
  let html=previousCard(q,u,i);
  const ids=[...new Set([...(u.competencyIdsV202||[]),...(u.competencyIds||[]),...(u.methodIds||[])])];
  if(!ids.length)return html;
  const items=ids.map(id=>v202CompById(q,id)).filter(Boolean);
  if(!items.length)return html;
  const detail='<details class="v247-hour-comps"><summary>'+items.length+
    ' konkrete Kompetenz'+(items.length===1?'':'en')+' anzeigen</summary>'+
    items.map(c=>'<div><small>'+esc(c.category||'Kompetenz')+
      (v202MediaLike(c)?' · Methode':'')+'</small><p>'+esc(c.text)+'</p></div>').join('')+
    '</details>';
  return html.replace('</h4>', '</h4>'+detail);
};
const previousStatus=v202StatusHtml;
v202StatusHtml=function(q,c){
  const html=previousStatus(q,c);
  if(!q||!c)return html;
  const button='<button type="button" class="text-button small" data-v247-assign="'+
    esc(q.id)+'|'+esc(c.id)+'">Stunden zuordnen</button>';
  return html.replace('<div class="v202-comp-actions">','<div class="v202-comp-actions">'+button);
};
function v247IsLocked(q,u){
  if(v202UnitHeld(q,u))return true;
  return (state.lessons||[]).some(l=>l.classId===q.classId&&
    v191LessonProtected(l)&&(l.planReference?.unitId===u.id||
    (l.sequenceId===q.id&&u.plannedDate&&l.date===u.plannedDate)));
}
function v247AssignModal(){
  const q=seq(modal?.qid),id=modal?.competencyId,comp=q&&v202CompById(q,id);
  if(!comp)return '<div class="modal-backdrop" data-action="modal-close"><section class="modal"><p>Kompetenz nicht gefunden.</p><button data-action="modal-close">Schließen</button></section></div>';
  const units=q.plan||[];
  const rows=units.map((u,i)=>{
    const locked=v247IsLocked(q,u),on=(u.competencyIdsV202||[]).includes(id);
    return '<label class="v247-assignment"><input type="checkbox" data-v247-unit="'+esc(u.id)+
      '" '+(on?'checked ':'')+(locked?'disabled ':'')+'><span>'+
      esc((i+1)+'. '+(u.title||'Stunde')+(u.plannedDate?' · '+u.plannedDate:''))+
      (locked?' · geschützt':'')+'</span></label>';
  }).join('');
  return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide" data-modal-stop>'+
    '<header class="modal-header"><div><span class="eyebrow">KOMPETENZPLANUNG</span><h2>Stunden zuordnen</h2></div>'+
    '<button class="icon-button" data-action="modal-close">×</button></header>'+
    '<div class="modal-body"><p><strong>'+esc(comp.text)+'</strong></p>'+
    '<p class="microcopy">Mehrere Stunden sind möglich. Bereits gehaltene oder konkret geschützte Stunden werden nicht verändert. Die Zuordnung fließt in den Montagsmodus-Prompt ein.</p>'+
    (rows||'<p>Noch keine Sollstunden für diese Reihe vorhanden.</p>')+
    '<div class="v247-actions"><button class="primary" data-v247-save>Zuordnungen speichern</button></div></div></section></div>';
}
const previousModal=modalHtml;
modalHtml=function(){return modal?.type==='assignV247'?v247AssignModal():previousModal();};
async function v247SaveAssignments(){
  const q=seq(modal?.qid),id=modal?.competencyId;
  if(!q||!v202CompById(q,id))throw Error('Die Kompetenz gehört nicht mehr zu dieser Reihe.');
  const selected=new Set([...document.querySelectorAll('[data-v247-unit]:checked')].map(e=>e.dataset.v247Unit));
  const prior=(q.plan||[]).map(u=>({id:u.id,ids:[...(u.competencyIdsV202||[])]}));
  try{
    for(const u of q.plan||[]){
      if(v247IsLocked(q,u))continue;
      const ids=new Set(u.competencyIdsV202||[]);
      selected.has(u.id)?ids.add(id):ids.delete(id);
      u.competencyIdsV202=[...ids];
    }
    await saveState();modal={type:'sequence',id:q.id};render();
  }catch(e){
    for(const u of q.plan||[])u.competencyIdsV202=prior.find(x=>x.id===u.id)?.ids||[];
    throw e;
  }
}
const beforeWire=wire;
wire=function(){
  beforeWire();
  document.querySelectorAll('[data-v247-assign]').forEach(b=>b.addEventListener('click',()=>{
    const [qid,competencyId]=b.dataset.v247Assign.split('|');
    if(!qid||!competencyId)return;
    modal={type:'assignV247',qid,competencyId};render();
  }));
  document.querySelector('[data-v247-save]')?.addEventListener('click',e=>{
    e.currentTarget.disabled=true;
    void v247SaveAssignments().catch(err=>{
      alert('Zuordnung nicht gespeichert: '+(err.message||err));render();
    });
  });
};
})();
