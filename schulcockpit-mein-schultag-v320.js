/* Schulcockpit V0.32.0 – Mein Schultag als LESEANSICHT auf echten Daten.
 * Keine zweite Planung, keine neuen Material-/Druckflags und kein Auto-Import.
 */
(function(){
'use strict';
const C=window.SchulcockpitDayCoreV320;
if(!C)throw Error('Tagesansicht: Kernmodul fehlt.');
let day='';
function todayLocal(){
 const d=new Date();
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function selected(){
 if(!day||C.weekday(day)<0)day=C.initialDay(todayLocal());
 return day;
}
function dayLabel(date){
 if(!date)return 'Datum offen';
 return new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
  .format(new Date(date+'T12:00:00'));
}
function kindFor(l){
 try{return window.SchulcockpitLessonContextV289?.context(l)?.type||'ordinary';}
 catch(err){console.warn('Tagesansicht: Stundentyp konnte nicht ermittelt werden',err);return 'ordinary';}
}
function model(){
 const date=selected(),types={};
 for(const l of state.lessons||[])if(l.date===date&&l.id)types[l.id]=kindFor(l);
 return C.summarize({
  lessons:state.lessons||[],classes:state.classes||[],materials:state.materials||[],
  storedKeys:[...storedFileKeys],substitutionPlans:state.substitutionPlansV262||{},
  lessonTypes:types
 },date);
}
const STATUS={held:'Erledigt',ready:'Bereit',warning:'Offen',canceled:'Entfällt',special:'Sondertermin',open:'Offen'};
function fileMarkup(row){
 if(!row.firstFile)return '';
 return '<button type="button" class="text-button v320-action-file" data-v320-file="'+esc(row.firstFile.key)+'" '+
  'data-v320-file-name="'+esc(row.firstFile.name)+'">AB öffnen</button>';
}
function rowMarkup(r){
 const sub=r.type==='substitution',ordinary=r.type==='ordinary',canMark=ordinary&&!r.canceled&&!r.held;
 const label=r.slot!==99?r.slot+'. Stunde':r.period;
 const print=r.copyOpen?'<span class="v320-mini v320-alert">'+r.copyOpen+' Druckposition'+(r.copyOpen===1?'':'en')+' offen</span>':
  r.copyTotal?'<span class="v320-mini">Kopien vorbereitet</span>':'';
 const missing=r.copyMissing?'<span class="v320-mini v320-alert">'+r.copyMissing+' Druckdatei(en) lokal nicht verfügbar</span>':'';
 const ppt=ordinary&&!r.held&&!r.canceled?
  '<span class="v320-mini'+(r.hasPresentation?'':' v320-alert')+'">'+(r.hasPresentation?'PPT vorhanden':'PPT noch nicht lokal verfügbar')+'</span>':'';
 const buttons='<button type="button" class="secondary" data-v320-open="'+esc(r.id)+'">'+(r.held?'Stunde / Reflexion':'Stunde öffnen')+'</button>'+ 
  (ordinary&&r.hasPresentation?'<button type="button" class="secondary" data-v182-ppt="'+esc(r.id)+'">PPT herunterladen</button>':'')+
  (ordinary?fileMarkup(r):'')+
  (ordinary&&r.copyOpen?'<button type="button" class="secondary" data-v182-prep="'+esc(r.id)+'">Kopien vorbereiten</button>':'')+
  (sub?'<button type="button" class="secondary" data-v320-sub="'+esc(r.id)+'">Vertretungszettel & ABs</button>':'')+
  (canMark?'<button type="button" class="text-button" data-v320-sub="'+esc(r.id)+'">Als Vertretung</button>':'')+
  (canMark?'<button type="button" class="primary" data-v182-held="'+esc(r.id)+'">Gehalten ✓</button>':'');
 return '<article class="v320-lesson v320-'+esc(r.status)+'"><div class="v320-lesson-top">'+
  '<div class="v320-slot">'+esc(label)+'</div>'+
  '<div class="v320-main"><strong>'+esc(r.course)+'</strong><span>'+esc(r.title)+'</span></div>'+
  '<span class="v320-status '+esc(r.status)+'">'+esc(STATUS[r.status]||'Offen')+'</span></div>'+
  '<p class="v320-meta">'+esc(r.statusText)+'</p>'+
  (print||missing||ppt?'<div class="v320-facts">'+ppt+print+missing+'</div>':'')+
  '<div class="v320-actions">'+buttons+'</div></article>';
}
function page(){
 const m=model();
 const holiday=[0,6].includes(C.weekday(m.date));
 return '<div class="content-grid v320-day"><section class="panel v320-head">'+
  '<div><span class="eyebrow">DEIN UNTERRICHT · TAGESÜBERBLICK</span><h2>Mein Schultag</h2>'+
  '<p>Nur bestehende Stunden, Druckaufträge und Dateien. Keine zweite Planung.</p></div>'+
  '<div class="v320-nav"><button type="button" class="secondary" data-v320-prev aria-label="Vorheriger Wochentag">‹</button>'+
  '<label>Datum<input type="date" id="v320-day-date" value="'+esc(m.date)+'"></label>'+
  '<button type="button" class="secondary" data-v320-next aria-label="Nächster Wochentag">›</button>'+
  '<button type="button" class="text-button" data-v320-today>Heute / nächster Wochentag</button></div></section>'+ 
  '<section class="panel v320-today"><div class="v320-day-title"><h3>'+esc(dayLabel(m.date))+'</h3>'+
  '<div class="v320-stats"><div><strong>'+m.total+'</strong><small>Stunden</small></div>'+
  '<div><strong>'+m.ready+'</strong><small>Vorbereitet</small></div>'+
  '<div><strong>'+m.printOpen+'</strong><small>Druckpositionen offen</small></div></div></div>'+
  (m.rows.length?'<div class="v320-list">'+m.rows.map(rowMarkup).join('')+'</div>':
   '<div class="v320-empty"><strong>Für diesen Tag sind keine Unterrichtsstunden hinterlegt.</strong>'+
   '<p>'+(holiday?'Das ist ein Wochenende. Du kannst mit den Pfeilen zum nächsten Wochentag springen.':
    'Das bedeutet nicht automatisch, dass du unterrichtsfrei hast. Prüfe gegebenenfalls, ob die Woche im Cockpit aufgebaut wurde.')+
   '</p><button type="button" class="secondary" data-v320-week>Wochenplanung öffnen</button></div>')+
  '</section>'+
  '<section class="panel v320-footer"><p>Die Statusanzeige ersetzt weder deinen Stundenplan noch die Prüfung, ob gedruckte Materialien wirklich bereitliegen. Fehlende Dateien werden nicht als vorhanden angenommen.</p>'+
  '<button type="button" class="secondary" data-v320-prep>Wochenvorbereitung öffnen</button>'+
  '<button type="button" class="secondary" data-v320-week>Meine Woche</button></section></div>';
}
function openRow(id){
 const l=lesson(id);if(!l)return;
 const type=kindFor(l);
 if(type==='substitution'&&window.SchulcockpitSubstitutionV262?.open?.(l.date,l.classId,C.lessonSlot(l)))return;
 modal={type:'lesson',id:l.id};render();
}
function openFile(key,name){
 if(!key)return;
 void fileStoreGet(key).then(rec=>{
  if(!rec?.blob)throw Error('Originaldatei lokal nicht verfügbar. Bitte im Materialbereich prüfen.');
  const title=rec.name||name||'Arbeitsblatt';
  if(/\.(pdf|png|jpe?g|webp|txt)$/i.test(title)){
   const url=URL.createObjectURL(rec.blob),tab=window.open(url,'_blank');
   if(!tab){URL.revokeObjectURL(url);downloadBlob(title,rec.blob);}
   else setTimeout(()=>URL.revokeObjectURL(url),60000);
  }else downloadBlob(title,rec.blob);
 }).catch(err=>alert('Material konnte nicht geöffnet werden: '+(err.message||err)));
}
async function openWeek(where){
 const date=selected(),old=state.settings.activeWeekStart;
 const monday=C.addDays(date,-((new Date(date+'T12:00:00').getDay()||7)-1));
 state.settings.activeWeekStart=monday;
 try{await saveState();view=where;render();}
 catch(err){state.settings.activeWeekStart=old;alert('Die ausgewählte Woche konnte nicht gespeichert werden: '+(err.message||err));}
}
const previousPage=viewHtml;
viewHtml=function(){return view==='dayV320'?page():previousPage();};
const previousTitle=pageTitle;
pageTitle=function(){return view==='dayV320'?'Mein Schultag':previousTitle();};
const previousWire=wire;
wire=function(){
 previousWire();
 if(view!=='dayV320')return;
 document.querySelector('[data-v320-prev]')?.addEventListener('click',()=>{day=C.schoolDay(selected(),-1);render();});
 document.querySelector('[data-v320-next]')?.addEventListener('click',()=>{day=C.schoolDay(selected(),1);render();});
 document.querySelector('[data-v320-today]')?.addEventListener('click',()=>{day=C.initialDay(todayLocal());render();});
 document.getElementById('v320-day-date')?.addEventListener('change',e=>{if(C.weekday(e.target.value)>=0){day=e.target.value;render();}});
 document.querySelectorAll('[data-v320-open]').forEach(b=>b.addEventListener('click',()=>openRow(b.dataset.v320Open)));
 document.querySelectorAll('[data-v320-file]').forEach(b=>b.addEventListener('click',()=>openFile(b.dataset.v320File,b.dataset.v320FileName)));
 document.querySelectorAll('[data-v320-sub]').forEach(b=>b.addEventListener('click',()=>{
  const l=lesson(b.dataset.v320Sub);
  if(!l)return;
  void window.SchulcockpitSubstitutionDirectV319?.openOrMark(l).catch(err=>alert('Vertretungsstunde: '+(err.message||err)));
 }));
 document.querySelectorAll('[data-v320-week]').forEach(b=>b.addEventListener('click',()=>{void openWeek('week');}));
 document.querySelector('[data-v320-prep]')?.addEventListener('click',()=>{void openWeek('prep');});
};
const previousRender=render;
render=function(){
 previousRender();
 const nav=document.querySelector('.sidebar nav');
 if(nav&&!nav.querySelector('[data-view="dayV320"]')){
  const focus=nav.querySelector('[data-view="focus"]');
  const btn=document.createElement('button');
  btn.dataset.view='dayV320';
  btn.innerHTML='<span>☀</span> Mein Schultag';
  if(focus)focus.after(btn);else nav.prepend(btn);
  btn.addEventListener('click',()=>{view='dayV320';modal=null;render();});
 }
 const b=nav?.querySelector('[data-view="dayV320"]');
 if(b)b.classList.toggle('active',view==='dayV320');
 const badge=document.querySelector('.brand small');
 if(badge)badge.textContent=(state.settings?.schoolYear||'')+' · V0.32.0';
};
window.SchulcockpitDayV320={model,openRow,setDay:d=>{if(C.weekday(d)>=0){day=d;render();}}};
})();
