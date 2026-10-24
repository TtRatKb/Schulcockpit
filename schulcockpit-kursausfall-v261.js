/* Schulcockpit V0.26.1 – kursbezogene Unterrichtsausfälle im Schulkalender.
 * Ohne neue Schülerdaten, ohne implizite Verschiebung bestehender Stunden. */
(function(){
'use strict';
function year(){return v190NormYear(v190CalendarDraft?.year||state.settings.schoolYear);}
function courses(){return (state.classes||[]).filter(c=>c.id&&c.subject&&!/^ga$/i.test(c.subject));}
function courseName(id){const c=courses().find(x=>x.id===id);return c?(c.subject||'Fach')+' · '+(c.name||'Kurs'):'Nicht mehr vorhandener Kurs ('+id+')';}
function courseHtml(){
  const y=year(),list=v261CourseRanges(y),all=courses();
  return '<section class="panel v261-course-absence"><div class="section-head"><div><span class="eyebrow">NUR EIN FACHKURS BETROFFEN</span>'+
    '<h2>Unterrichtsausfälle einzelner Kurse</h2></div></div>'+
    '<p>Wenn zum Beispiel Mathe 5f wegen einer Exkursion entfällt, wählst du hier nur diesen Kurs. Andere Klassen haben am selben Tag weiter Unterricht. Der Ausfall wird beim Wochenaufbau, bei der Reihenplanung und im ChatGPT-Jahresplan berücksichtigt.</p>'+
    '<div class="v261-course-list">'+(list.map(r=>'<div class="v190-range-row"><span><strong>'+esc(courseName(r.classId))+'</strong>'+
      '<small>'+esc(fmtDate(r.start))+(r.end!==r.start?' – '+esc(fmtDate(r.end)):'')+' · '+esc(r.name||'Kurs fällt aus')+'</small></span>'+
      '<button class="danger-lite small" type="button" data-v261-remove="'+esc(r.id)+'">Entfernen</button></div>').join('')||
      '<p class="microcopy">Für dieses Schuljahr sind noch keine kursbezogenen Ausfälle hinterlegt.</p>')+'</div>'+
    (all.length?'<div class="v261-course-form">'+
      '<label>Betroffener Kurs<select id="v261-course">'+all.map(c=>'<option value="'+esc(c.id)+'">'+esc(courseName(c.id))+'</option>').join('')+'</select></label>'+
      '<label>Grund<input id="v261-reason" maxlength="140" placeholder="z. B. Exkursion, Projekttag, Entfall"></label>'+
      '<label>Datum<input id="v261-start" type="date"></label>'+
      '<label>Bis (optional)<input id="v261-end" type="date"></label>'+
      '<button class="secondary" type="button" data-v261-add>+ Kursausfall eintragen</button></div>':
      '<p>Lege zuerst mindestens einen Fachkurs unter „Stundenplan & Klassen“ an.</p>')+
    '<p class="microcopy">Bereits gehaltene Stunden bleiben unangetastet. Bestehende Solltermine werden erst mit „Geplante Reihentermine neu berechnen“ auf deine ausdrückliche Entscheidung hin verschoben.</p></section>';
}
const previousView=viewHtml;
viewHtml=function(){
  const h=previousView();
  if(view!=='school-calendar')return h;
  const marker='<section class="panel"><div class="section-head"><div><span class="eyebrow">PLANUNGSMARKEN</span>';
  return h.includes(marker)?h.replace(marker,courseHtml()+marker):h;
};
const previousWire=wire;
wire=function(){
  previousWire();
  if(view!=='school-calendar')return;
  document.querySelector('[data-v261-add]')?.addEventListener('click',async()=>{
    const y=year(),classId=document.getElementById('v261-course')?.value||'',
      start=document.getElementById('v261-start')?.value||'',
      end=document.getElementById('v261-end')?.value||start,
      name=(document.getElementById('v261-reason')?.value||'').trim()||'Fachunterricht entfällt',
      bounds=v190YearBounds(y);
    if(!courses().some(c=>c.id===classId))return alert('Bitte einen vorhandenen Fachkurs auswählen.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||
      start<bounds.start||end>bounds.end||end<start)
      return alert('Bitte einen gültigen Zeitraum innerhalb des Schuljahres eintragen.');
    const cal=v190Calendar(y),previous=structuredClone(cal.courseRangesV261||[]);
    if(previous.some(r=>r.classId===classId&&r.start===start&&r.end===end))
      return alert('Für diesen Kurs und Zeitraum ist bereits ein Ausfall eingetragen.');
    const fixed=(state.assessments||[]).filter(a=>a.classId===classId&&a.date>=start&&a.date<=end);
    const held=(state.lessons||[]).filter(l=>l.classId===classId&&l.date>=start&&l.date<=end&&v182IsHeld(l));
    if((fixed.length||held.length)&&!confirm('Achtung: Im gewählten Zeitraum liegen '+fixed.length+
      ' feste Leistungsnachweise und '+held.length+' bereits gehaltene Stunden dieses Kurses. '+
      'Der Kalendereintrag verändert diese bestehenden Daten nicht. Kursausfall trotzdem notieren?'))return;
    cal.courseRangesV261=[...previous,{id:uid('course-absence'),classId,start,end,name:name.slice(0,140)}];
    try{await saveState();render();}
    catch(e){cal.courseRangesV261=previous;alert('Kursausfall nicht gespeichert: '+(e.message||e));}
  });
  document.querySelectorAll('[data-v261-remove]').forEach(b=>b.addEventListener('click',async()=>{
    const cal=v190Calendar(year()),previous=structuredClone(cal.courseRangesV261||[]);
    cal.courseRangesV261=previous.filter(r=>r.id!==b.dataset.v261Remove);
    try{await saveState();render();}
    catch(e){cal.courseRangesV261=previous;alert('Kursausfall nicht entfernt: '+(e.message||e));}
  }));
};
})();
