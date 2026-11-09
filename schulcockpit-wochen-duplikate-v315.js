/* V0.31.5 – one active planning card per physical teaching slot, without
 * destroying any of the user's local lesson data.
 * Unique resources/actual evidence in separate cards are NEVER hidden.
 */
(function(){
'use strict';
const C=SC_WEEK_DUPLICATES_V315;
const baseWeek=currentWeekLessons;
function inspect(){
 const rows=baseWeek();
 return C.analyze(rows);
}
currentWeekLessons=function(){return inspect().visible;};
function present(item){
 const l=(state.lessons||[]).find(x=>x.id===item.extraId);
 const c=cls(l?.classId),name=[c?.subject||'',c?.name||''].filter(Boolean).join(' ')||'Fachstunde';
 return esc(name)+' · '+esc(l?.date?fmtDate(l.date):'Datum offen')+
  ' · '+esc(l?.period||'Block '+(item.slot+1));
}
function banner(){
 const {hidden,collisions}=inspect();
 if(!hidden.length&&!collisions.length)return '';
 let html='<section class="v315-collisions" aria-label="Mehrfach angelegte Unterrichtskarten">';
 if(hidden.length){
  html+='<details><summary>Eine Unterrichtskarte pro Termin · '+
   hidden.length+' zusätzliche '+(hidden.length===1?'Karte':'Karten')+
   ' sicher zusammengefasst <small>(Originale behalten)</small></summary>'+
   '<p>Für denselben Kurs, denselben Tag und denselben Block gibt es zusätzliche Karten '+
   'ohne eigene Unterrichtsdaten. Sie werden nicht doppelt vorbereitet oder gedruckt. '+
   'Kein Eintrag wurde gelöscht oder umdatiert.</p>'+
   '<div class="v315-collision-items">'+hidden.map(item=>
    '<div><span>'+present(item)+'</span>'+
    '<button type="button" class="secondary" data-v182-open="'+esc(item.extraId)+'">'+
    'Zusätzliche Karte öffnen ↗</button></div>').join('')+'</div></details>';
 }
 if(collisions.length){
  html+='<details class="v315-warning" open><summary><strong>'+
   collisions.length+' mehrfach belegte'+(collisions.length===1?'r Fachtermin':' Fachtermine')+
   ' mit unterschiedlichen Daten – bitte prüfen</strong></summary>'+
   '<p>Es existieren mehrere eigenständige Planungen zum selben Block. '+
   'Hier wird nichts automatisch entfernt oder zusammengeführt. '+
   'Öffne die Karten und prüfe, welche tatsächlich verwendet werden soll.</p>'+
   collisions.map(item=>'<div class="v315-collision-items">'+
    item.ids.map(id=>{
     const l=(state.lessons||[]).find(x=>x.id===id);
     return '<div><span>'+esc(l?.date?fmtDate(l.date):'Datum offen')+' · '+
      esc(l?.title||l?.planReference?.title||'Unterrichtskarte')+
      '</span><button type="button" class="secondary" data-v182-open="'+esc(id)+'">'+
      'Karte öffnen ↗</button></div>';
    }).join('')+'</div>').join('')+'</details>';
 }
 return html+'</section>';
}
const beforePrep=weekPrepViewV14;
weekPrepViewV14=function(){
 const html=beforePrep(),info=banner();
 return info?html.replace('<div class="course-prep-list-v14">',info+
  '<div class="course-prep-list-v14">'):html;
};
weekPrepViewV08=weekPrepViewV14;
weekPrepViewV12=weekPrepViewV14;
const beforeWeekView=weekView;
weekView=function(){
 const html=beforeWeekView(),info=banner();
 return info?html.replace('<section class="v182-week-grid">',info+
  '<section class="v182-week-grid">'):html;
};
// 'Replace this week' can legitimately remove unmatched timetable cards.
 // Do not allow it to remove originals that the read-only deduped view hides.
const oldRebuild=rebuildActiveWeek;
rebuildActiveWeek=function(replace=false){
 if(replace&&inspect().hidden.length){
  return alert('Diese Woche enthält zusätzliche Stundenkarten zum selben Fachtermin. '+
   '„Woche ersetzen“ wurde vorsichtshalber nicht ausgeführt, damit keine der '+
   'ursprünglichen Stundenkarten gelöscht wird. Bitte zuerst die Karten im '+
   'Montagsmodus prüfen. Eine normale Aktualisierung ist weiterhin möglich.');
 }
 return oldRebuild(replace);
};
syncWeek=()=>rebuildActiveWeek(false);
window.SchulcockpitWeekDuplicatesV315={inspect,analyze:C.analyze};
const previousRender=render;
render=function(){
 previousRender();
 const brand=document.querySelector('.brand small');
 if(brand)brand.textContent=state.settings.schoolYear+' · V0.31.5';
};
})();
