/* Schulcockpit V0.28.0 – overhang is an editable scheduling state, not deletion. */
(function(){
'use strict';
function overflowRows(q){
 return (q?.plan||[]).filter(u=>!!u.overflowV280&&!u.plannedDate&&!v201UnitSkipped(u));
}
const originalPanel=sequencePanel;
sequencePanel=function(q){
 const html=originalPanel(q),rows=overflowRows(q);
 if(!rows.length)return html;
 const info='<section class="detail-section v280-overflow">'+
  '<div class="section-head compact"><div><span class="eyebrow">AKTIVE UNTERRICHTSPLANUNG</span>'+
  '<h3>Überhang · '+rows.length+' Stunde'+(rows.length===1?'':'n')+' noch ohne Termin</h3></div></div>'+
  '<p class="microcopy">Diese Stunden bleiben Teil der Reihe und sind weder gelöscht noch '+
  'für das Schuljahr ausgelassen. Sie haben nur keinen freien Fachtermin mehr. '+
  'Du kannst sie später zusammenfassen, verschieben oder über „Stunde organisieren“ wieder einplanen. '+
  'Vorhandene Stundenmaterialien bleiben erhalten.</p>'+
  '<div class="v182-plan-edit-list">'+rows.map(u=>
   '<div class="v201-plan-edit-row"><span>Ohne Termin</span><strong>'+esc(u.title||'Stunde ohne Titel')+'</strong>'+
   '<small>Überhang · weiterhin aktiv</small><div class="v201-plan-row-actions">'+
   '<button class="secondary" data-v275-unit="'+esc(q.id+'|'+u.id)+'">Stunde organisieren →</button>'+
   '<button class="text-button" data-v182-unit-edit="'+esc(q.id+'|'+u.id)+'">Bearbeiten</button>'+
   '</div></div>').join('')+'</div></section>';
 return html+info;
};
const originalCard=v190SequenceCard;
v190SequenceCard=function(q){
 let html=originalCard(q),count=overflowRows(q).length;
 if(!count)return html;
 return html.replace('</div></button></article>',
  '<span class="v280-overflow-count">'+count+' Stunde'+(count===1?'':'n')+
  ' als Überhang · noch ohne Termin</span></div></button></article>');
};
const originalRender=render;
render=function(){
 originalRender();
 const label=document.querySelector('.brand small');
 if(label)label.textContent=state.settings.schoolYear+' · V0.28.0';
};
window.SchulcockpitOverhangV280={overflowRows};
})();