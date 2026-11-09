/* Schulcockpit V0.31.4 – click-to-swap / click-to-place on the ACTUAL hour cards.
 * Alternative to lengthy native dragging: choose one hour, then swap it
 * with another hour, or place it before/after another hour. Only stages data.
 */
(function(){
'use strict';
const API=window.SchulcockpitSequenceDragV311;
let chosen='',chosenSeq='';
const escText=v=>esc(String(v??''));
function current(){return modal?.type==='sequence'?seq(modal.id):null;}
function order(q){
 const d=API.getDraft();
 return d?.qid===q.id?d.order:[...(q.plan||[]).map(u=>u.id)];
}
function held(q,id){
 const u=API.getRows(q).find(x=>x.id===id);
 return !!u?.held;
}
function replaceRow(html,q,id){
 const isHeld=held(q,id),active=chosenSeq===q.id&&!!chosen;
 const chosenCard=active&&chosen===id;
 const controls=isHeld?'<span class="v314-fixed" title="Bereits gehalten">🔒 Fester Termin</span>':
 !active?'<button type="button" class="v314-choose" data-v314-choose="'+escText(id)+'">'+
 '↔ Tauschen / einordnen</button>':
 chosenCard?'<button type="button" class="v314-unchoose" data-v314-cancel>Auswahl aufheben</button>':
 '<button type="button" class="v314-do" data-v314-swap="'+escText(id)+'">↔ Tauschen</button>'+
 '<button type="button" class="v314-do" data-v314-before="'+escText(id)+'">↑ Davor</button>'+
 '<button type="button" class="v314-do" data-v314-after="'+escText(id)+'">↓ Danach</button>';
 return '<div class="v314-card-controls" aria-label="Stunde anordnen">'+controls+'</div>';
}
const beforePanel=sequencePanel;
sequencePanel=function(q){
 let html=beforePanel(q);
 if(!q||!html.includes('data-v312-direct'))return html;
 if(chosenSeq!==q.id){chosenSeq=q.id;chosen='';}
 html=html.replace(/(<article\b[^>]*\bclass="v312-actual-row[^"]*"[^>]*\bdata-v311-row="([^"]+)"[^>]*>)([\s\S]*?)(<\/article>)/g,
  (whole,open,id,inner,close)=>{
   const selected=chosen===id?' v314-selected':'';
   return open.replace('class="v312-actual-row','class="v312-actual-row'+selected)+
     inner+replaceRow(html,q,id)+close;
  });
 if(chosen){
  const selectedUnit=(q.plan||[]).find(u=>u.id===chosen);
  html=html.replace('<small class="v311-live v312-live"',
   '<div class="v314-instruction" role="status"><strong>'+escText(selectedUnit?.title||'Stunde')+
   '</strong> ausgewählt. Tippe bei einer anderen Stunde auf „Tauschen“, „Davor“ oder „Danach“. '+
   '<button type="button" data-v314-cancel>Abbrechen</button></div>'+
   '<small class="v311-live v312-live"');
 }
 return html;
};
function rerenderKeepingScroll(){
 const old=document.querySelector('.modal-body'),pos=old?.scrollTop||0;
 render();
 const next=document.querySelector('.modal-body');
 if(next)next.scrollTop=pos;
}
function choose(q,id){
 if(held(q,id))return;
 chosen=id;chosenSeq=q.id;rerenderKeepingScroll();
}
function stage(q,id,mode){
 if(!chosen||chosen===id)return;
 try{
  const base=order(q),from=base.indexOf(chosen),to=base.indexOf(id);
  if(from<0||to<0||held(q,chosen))throw Error('Die ausgewählte Stunde ist nicht mehr verschiebbar.');
  if(mode==='swap'&&held(q,id))
   throw Error('Eine bereits gehaltene Stunde kann nicht getauscht werden.');
  const next=mode==='swap'?(()=>{
   const items=base.slice();[items[from],items[to]]=[items[to],items[from]];return items;
  })():API.reorder(base,chosen,id,mode==='after',
   API.getRows(q).filter(x=>x.held).map(x=>x.id));
  if(next.every((x,i)=>x===base[i])){chosen='';rerenderKeepingScroll();return;}
  API.stageOrder(q.id,next); // pure preview validates all dates first
  chosen='';rerenderKeepingScroll();
 }catch(e){alert('Anordnung nicht möglich: '+(e.message||e));}
}
document.addEventListener('click',e=>{
 const target=e.target.closest?.('[data-v314-choose],[data-v314-cancel],'+
  '[data-v314-swap],[data-v314-before],[data-v314-after]');
 const q=current();
 if(!target||!q)return;
 e.preventDefault();e.stopPropagation();
 if(target.hasAttribute('data-v314-cancel')){chosen='';rerenderKeepingScroll();return;}
 if(target.dataset.v314Choose){choose(q,target.dataset.v314Choose);return;}
 const mode=target.hasAttribute('data-v314-swap')?'swap':
  target.hasAttribute('data-v314-before')?'before':'after';
 stage(q,target.dataset.v314Swap||target.dataset.v314Before||target.dataset.v314After,mode);
},true);
window.SchulcockpitSafeReorderV314={choose,stage,getSelected:()=>chosen};
const beforeRender=render;
render=function(){
 beforeRender();
 const brand=document.querySelector('.brand small');
 if(brand)brand.textContent=state.settings.schoolYear+' · V0.31.4';
};
})();
