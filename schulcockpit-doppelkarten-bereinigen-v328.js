/* Schulcockpit V0.32.8 – remove duplicate lesson cards deliberately.
 * Adds actions only to the pre-existing duplicate warning (V0.31.5).
 * Deleted cards remain recoverable; material files and sequence plans stay put.
 */
(function(){
'use strict';
const C=SC_DUPLICATE_CLEANUP_V328;
let busy=false,lastNotice='';
const records=()=>Array.isArray(state.duplicateCardTrashV328)?state.duplicateCardTrashV328:[];
const dateLabel=l=>l?.date?fmtDate(l.date):'Ohne Datum';
const courseLabel=l=>{
 const c=cls(l?.classId);
 return [c?.subject||'',c?.name||''].filter(Boolean).join(' ')||
  (l?.groupId?'Lerngruppe':'Fachkurs');
};
const title=l=>String(l?.title||l?.planReference?.title||'Unbenannte Unterrichtskarte');
const status=l=>C.protectedHistory(l)?'gehalten / historisch':
  l?.status==='ready'?'vorbereitet':'offene Planung';
const count=(l,k)=>Array.isArray(l?.[k])?l[k].length:0;
function itemSummary(l){
 return '<strong>'+esc(title(l))+'</strong>'+
  '<small>'+esc(dateLabel(l))+' · '+esc(courseLabel(l))+' · '+
   esc(String(lessonSlot(l)))+'. Block · '+esc(status(l))+'</small>'+
  '<span>'+count(l,'slides')+' Folien · '+count(l,'materials')+
   ' Materialien · '+count(l,'printPlan')+' Druckeinträge · '+
   count(l,'phasePlan')+' Phasen</span>';
}
const previousModalHtml=modalHtml;
modalHtml=function(){
 if(modal?.type!=='duplicateCleanupV328')return previousModalHtml();
 const id=modal.lessonId,check=C.evaluate(state,id),l=check.lesson;
 return '<div class="modal-backdrop" data-action="modal-close">'+
  '<section class="modal modal-wide v328-modal" data-modal-stop>'+
  '<header class="modal-header"><div><span class="eyebrow">DOPPELTE STUNDENKARTEN</span>'+
  '<h2>Welche Karte möchtest du entfernen?</h2></div>'+
  '<button class="icon-button" type="button" data-action="modal-close" aria-label="Schließen">×</button></header>'+
  '<div class="modal-body">'+
  (l?'<p>Du entfernst ausschließlich die folgende <strong>Stundenkarte</strong>. Die '+
   'Reihenplanung, anderen Karten und gemeinsam genutzten Materialdateien bleiben erhalten.</p>'+
   '<article class="v328-compare v328-selected"><span class="eyebrow">AUSGEWÄHLT ZUM ENTFERNEN</span>'+
   itemSummary(l)+'</article>':'')+
  (check.peers.length?'<h3>Diese Karte(n) am selben Termin bleiben bestehen</h3>'+
   check.peers.map(p=>'<article class="v328-compare">'+itemSummary(p)+'</article>').join(''):'')+
  (!check.allowed?'<p class="warnbox" role="alert">'+esc(check.reason)+'</p>':
   '<p class="v328-warning">Hinweis: Auch eine vorbereitete Karte kann eigene Folien, '+
   'Notizen und Druckeinstellungen enthalten. Sie wird deshalb im wiederherstellbaren '+
   'Bereich aufbewahrt. Falls ihre Soll-Stunde noch falsch terminiert ist, '+
   'kann die Wochenaktualisierung später erneut eine Karte anlegen.</p>')+
  '<div class="v328-actions"><button type="button" class="secondary" data-action="modal-close">Abbrechen</button>'+
  '<button type="button" class="danger-lite" data-v328-confirm="'+esc(id||'')+'" '+
   (!check.allowed?'disabled':'')+'>Nur diese Karte entfernen</button></div>'+
  '</div></section></div>';
};
async function remove(id){
 if(busy)return;
 const check=C.evaluate(state,id);
 if(!check.allowed){alert(check.reason);render();return;}
 if(!confirm('„'+title(check.lesson)+'“ wirklich als doppelte Stundenkarte entfernen?\n\n'+
  'Die '+check.peers.length+' andere(n) Karte(n) am selben Fachtermin bleiben erhalten. '+
  'Die entfernte Karte kannst du unter „Entfernte Doppelkarten“ wiederherstellen.'))return;
 busy=true;
 const previousLessons=state.lessons;
 const hadTrash=Object.prototype.hasOwnProperty.call(state,'duplicateCardTrashV328');
 const previousTrash=hadTrash?structuredClone(state.duplicateCardTrashV328):undefined;
 try{
  C.remove(state,id);
  await saveState();
  lastNotice='✓ Stundenkarte entfernt. Bei Bedarf kannst du sie unten wiederherstellen.';
  modal=null;render();
 }catch(err){
  state.lessons=previousLessons;
  if(hadTrash)state.duplicateCardTrashV328=previousTrash;
  else delete state.duplicateCardTrashV328;
  modal=null;render();
  alert('Die Karte wurde nicht entfernt: '+(err.message||err));
 }finally{busy=false;}
}
async function restore(id){
 if(busy)return;
 busy=true;
 const previousLessons=state.lessons;
 const previousTrash=structuredClone(records());
 try{
  C.restore(state,id);
  await saveState();
  lastNotice='✓ Die ursprüngliche Stundenkarte wurde vollständig wiederhergestellt.';
  render();
 }catch(err){
  state.lessons=previousLessons;state.duplicateCardTrashV328=previousTrash;
  render();alert('Wiederherstellen fehlgeschlagen: '+(err.message||err));
 }finally{busy=false;}
}
function restorePanel(){
 const trash=records().slice().reverse();
 if(!trash.length)return null;
 const panel=document.createElement('section');
 panel.className='v328-trash';
 panel.innerHTML='<details><summary>Entfernte Doppelkarten wiederherstellen ('+
  trash.length+')</summary>'+
  (lastNotice?'<p role="status">'+esc(lastNotice)+'</p>':'')+
  '<p class="microcopy">Diese Karten werden nicht mehr für die Unterrichtsplanung gezählt. '+
  'Ihre ursprünglichen Inhalte bleiben für eine Wiederherstellung erhalten.</p>'+
  '<div class="v328-trash-list">'+trash.map(e=>{
   const l=e.lesson;
   return '<div class="v328-trash-row"><div>'+itemSummary(l)+'</div>'+
    '<button type="button" class="secondary" data-v328-restore="'+esc(e.id)+'">'+
     'Wiederherstellen</button></div>';
  }).join('')+'</div></details>';
 return panel;
}
function enhance(){
 // The V0.31.5 detector has already labelled genuinely conflicting cards.
 // Never offer a global "delete lesson" action outside its duplicate groups.
 for(const opener of document.querySelectorAll('.v315-collisions [data-v182-open]')){
  const id=opener.dataset.v182Open,l=lesson(id);
  if(!l)continue;
  const check=C.evaluate(state,id);
  const container=opener.parentElement;
  if(!container)continue;
  if(!check.allowed){
   if(C.protectedHistory(l)){
    const note=document.createElement('small');
    note.className='v328-history';
    note.textContent='Gehaltener Unterricht ist geschützt';
    container.appendChild(note);
   }
   continue;
  }
  const button=document.createElement('button');
  button.type='button';button.className='danger-lite small v328-delete';
  button.textContent='Karte entfernen …';button.dataset.v328Delete=id;
  button.addEventListener('click',()=>{
   if(busy)return;modal={type:'duplicateCleanupV328',lessonId:id};render();
  });
  container.appendChild(button);
 }
 const target=document.querySelector('.course-prep-list-v14')||
  document.querySelector('.v182-week-grid');
 if(target){
  const panel=restorePanel();
  if(panel){
   target.parentElement?.insertBefore(panel,target);
   panel.querySelectorAll('[data-v328-restore]').forEach(b=>
    b.addEventListener('click',()=>restore(b.dataset.v328Restore)));
  }
 }
 document.querySelector('[data-v328-confirm]')?.addEventListener('click',e=>
  remove(e.currentTarget.dataset.v328Confirm));
}
const oldRender=render;
render=function(){
 oldRender();
 enhance();
 const version=document.querySelector('.brand small');
 if(version)version.textContent=state.settings.schoolYear+' · V0.32.8';
};
window.SchulcockpitDuplicateCleanupV328={evaluate:id=>C.evaluate(state,id)};
})();
