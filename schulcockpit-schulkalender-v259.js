/* Schulcockpit V0.25.9 – eigenständiger Schulkalender in der Hauptnavigation.
 * Bestehende Ferien-/ICS- und Fristdaten werden ohne Migration wiederverwendet. */
(function(){
'use strict';
let schoolYearV259='';
function currentYear(){return v190NormYear(schoolYearV259||state.settings.schoolYear);}
function milestones(year){return (state.yearMilestonesV257?.[year]||[]).filter(x=>x?.date&&x?.title).slice().sort((a,b)=>a.date.localeCompare(b.date));}
function rowV259(r){
  const official=r.type==='official';
  return '<div class="v190-range-row"><span><strong>'+esc(r.name||'Unterrichtsfrei')+'</strong><small>'+
    esc(fmtDate(r.start))+(r.end!==r.start?' – '+esc(fmtDate(r.end)):'')+' · '+
    (official?'Amtlich':r.type==='ics'?'ICS-Import':'Eigener Eintrag')+'</small></span>'+
    (official?'':'<button class="danger-lite small" type="button" data-v190-range-remove="'+esc(r.id)+'" aria-label="Unterrichtsfreien Zeitraum entfernen">Entfernen</button>')+'</div>';
}
function pageV259(){
  const y=currentYear(),cal=v190Calendar(y),bounds=v190YearBounds(y),ranges=v190CalendarRanges(y),notes=milestones(y);
  // Die vorhandenen V190-Speicher-Handler beziehen ihr Jahr aus diesem Entwurf.
  v190CalendarDraft={year:y};
  const holidays=[...v190PublicHolidaysForYear(v190YearStartNum(y)),...v190PublicHolidaysForYear(v190YearStartNum(y)+1)]
    .filter(h=>h.date>=bounds.start&&h.date<=bounds.end&&new Date(h.date+'T12:00:00').getDay()>=1&&new Date(h.date+'T12:00:00').getDay()<=5);
  return '<div class="content-grid v259-calendar">'+
    '<section class="panel v259-calendar-intro"><div class="section-head"><div><span class="eyebrow">SCHULWEITE PLANUNG</span><h2>Schulkalender</h2>'+
    '<p>Ferien und Unterrichtsausfälle gelten für alle Kurse. Fristen sind eigene Planungsmarken und lassen Unterrichtstage frei.</p></div>'+
    '<label>Schuljahr<select id="v259-year">'+v190YearOptions().map(x=>'<option value="'+esc(x)+'" '+(x===y?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label></div>'+
    '<p><strong>Unterrichtszeitraum:</strong> '+esc(fmtDate(bounds.start))+' – '+esc(fmtDate(bounds.end))+
    ' · Ferienordnung: '+(v190OfficialComplete(y)?'vollständig hinterlegt':'für dieses Jahr nicht vollständig hinterlegt')+'</p>'+
    '<label class="v184-toggle"><input id="v190-use-current-tt" type="checkbox" '+(y===v190NormYear(state.settings.schoolYear)||cal.useCurrentTimetable?'checked':'')+
    (y===v190NormYear(state.settings.schoolYear)?' disabled':'')+'> Aktuellen Stundenplan als Planungsrhythmus verwenden</label></section>'+
    '<section class="panel"><div class="section-head"><div><span class="eyebrow">STUNDEN FINDEN NICHT STATT</span><h2>Ferien, SchILF & schulfreie Tage</h2></div>'+
    '<label class="upload-button">ICS-Datei importieren<input id="v190-ics" type="file" accept=".ics,text/calendar" hidden></label></div>'+
    '<p>Diese Tage werden von der Wochen- und Jahresplanung als unterrichtsfrei behandelt. Für eine SchILF am Mittwoch genügt ein Eintrag für dieses Datum.</p>'+
    '<div class="v190-range-list">'+(ranges.map(rowV259).join('')||'<p>Keine schulfreien Tage hinterlegt.</p>')+'</div>'+
    '<div class="v190-add-range"><input id="v190-range-name" aria-label="Grund" placeholder="z. B. SchILF / Studientag" maxlength="140">'+
    '<input id="v190-range-start" type="date" aria-label="Beginn"><input id="v190-range-end" type="date" aria-label="Ende, optional">'+
    '<button class="secondary" type="button" data-v190-range-add>+ Unterrichtsausfall</button></div></section>'+
    '<section class="panel"><div class="section-head"><div><span class="eyebrow">PLANUNGSMARKEN</span><h2>Schultermine & Fristen</h2></div></div>'+
    '<p>Notenschluss, Konferenzen oder Abgabefristen erscheinen als Hinweise in der ChatGPT-Jahresplanung, sperren aber nicht automatisch den Unterricht.</p>'+
    '<div class="v259-deadlines">'+(notes.map(n=>'<div class="v190-range-row"><span><strong>'+esc(fmtDate(n.date))+'</strong><small>'+esc(n.title)+'</small></span>'+
    '<button class="danger-lite small" type="button" data-v259-remove="'+esc(n.id)+'">Entfernen</button></div>').join('')||'<p>Noch keine Fristen eingetragen.</p>')+'</div>'+
    '<div class="v190-add-range"><input id="v259-deadline-title" maxlength="140" placeholder="z. B. Notenschluss 1. Halbjahr" aria-label="Bezeichnung">'+
    '<input id="v259-deadline-date" type="date" aria-label="Fristdatum"><button class="secondary" type="button" data-v259-add>+ Termin / Frist</button></div></section>'+
    '<section class="panel"><span class="eyebrow">AUTOMATISCH BERÜCKSICHTIGT</span><h2>Gesetzliche Feiertage</h2><p>'+esc(holidays.map(x=>fmtDate(x.date)+' '+x.name).join(' · ')||'Keine Feiertage an Werktagen.')+'</p>'+
    '<button class="primary" type="button" data-v190-calendar-recalc>Geplante Reihentermine für '+esc(y)+' neu berechnen</button></section></div>';
}
const oldTitle=pageTitle;
pageTitle=function(){return view==='school-calendar'?'Schulkalender':oldTitle();};
const oldView=viewHtml;
viewHtml=function(){return view==='school-calendar'?pageV259():oldView();};
const oldRender=render;
render=function(){
  oldRender();
  const nav=document.querySelector('.sidebar nav');
  if(!nav)return;
  let b=nav.querySelector('[data-v259-nav]');
  if(!b){
    b=document.createElement('button');b.type='button';b.dataset.v259Nav='1';
    b.innerHTML='<span>▣</span> Schulkalender';
    const anchor=nav.querySelector('[data-view="sequences"]');
    if(anchor)anchor.after(b);else nav.appendChild(b);
    b.addEventListener('click',()=>{view='school-calendar';modal=null;schoolYearV259=schoolYearV259||v190NormYear(state.settings.schoolYear);render();});
  }
  b.classList.toggle('active',view==='school-calendar');
};
const oldWire=wire;
wire=function(){
  oldWire();
  if(view!=='school-calendar')return;
  document.getElementById('v259-year')?.addEventListener('change',e=>{schoolYearV259=v190NormYear(e.target.value);render();});
  document.querySelector('[data-v259-add]')?.addEventListener('click',async()=>{
    const y=currentYear(),date=document.getElementById('v259-deadline-date')?.value||'',title=document.getElementById('v259-deadline-title')?.value.trim()||'',bounds=v190YearBounds(y);
    if(!date||date<bounds.start||date>bounds.end||!title)return alert('Bitte Bezeichnung und Datum innerhalb des Schuljahres angeben.');
    const before=structuredClone(state.yearMilestonesV257||{});
    state.yearMilestonesV257=state.yearMilestonesV257||{};
    state.yearMilestonesV257[y]=[...milestones(y),{id:uid('milestone'),date,title:title.slice(0,140)}];
    try{await saveState();render();}catch(e){state.yearMilestonesV257=before;alert('Termin nicht gespeichert: '+(e.message||e));}
  });
  document.querySelectorAll('[data-v259-remove]').forEach(b=>b.addEventListener('click',async()=>{
    const y=currentYear(),before=structuredClone(state.yearMilestonesV257||{});
    state.yearMilestonesV257[y]=milestones(y).filter(x=>x.id!==b.dataset.v259Remove);
    try{await saveState();render();}catch(e){state.yearMilestonesV257=before;alert('Termin nicht entfernt: '+(e.message||e));}
  }));
};
})();
