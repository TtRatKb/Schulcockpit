/* Schulcockpit V0.25.4 – preview and assign unoccupied calendar dates to
   previously confirmed statistics-poster units. Never move other lessons. */
(function(){
'use strict';
const TAG='statistics-poster-v250';
const day=(d)=>String(d||'').slice(0,10);
function applicable(q){
 const c=q&&cls(q.classId);
 return !!q&&v202SubjectKey(c)==='mathematik'&&v202Grade(c)===5&&
 (q.plan||[]).some(u=>u.projectTagV250===TAG);
}
function makePreview(q){
 if(!applicable(q))return {error:'Keine Statistik-Projektstunden vorhanden.'};
 const units=(q.plan||[]).filter(u=>u.projectTagV250===TAG);
 if(units.length!==6)return {error:'Es wurden nicht genau sechs Projektstunden erkannt. Bitte die Reihe prüfen.'};
 if(units.some(u=>u.plannedDate))return {error:'Mindestens eine Projektstunde ist bereits datiert. Zum Schutz keine erneute automatische Zuordnung.'};
 const other=(q.plan||[]).filter(u=>u.projectTagV250!==TAG);
 if(other.some(u=>!u.plannedDate))return {error:'In dieser Reihe gibt es noch undatierte reguläre Sollstunden. Bitte zuerst deren Termine festlegen.'};
 const year=v190SeqYear(q);
 const course=q.classId;
 const plans=v190PlanningSequences(course,year);
 const position=plans.findIndex(x=>x.id===q.id);
 if(position<0)return {error:'Diese Reihe gehört nicht zur aktiven Jahresplanung.'};
 const next=plans.slice(position+1);
 // Future rows with no dates cannot be shifted silently to make room.
 if(next.some(x=>!(x.plan||[]).some(u=>u.plannedDate)&&!x.startDate))
   return {error:'Mindestens eine spätere Reihe hat noch keine Termine. Der freie Platz ist nicht zuverlässig bestimmbar.'};
 const lower=[day(iso(new Date())),day(q.startDate||''),...other.map(u=>day(u.plannedDate)).filter(Boolean)].sort().at(-1)||'';
 const futureAnchors=next.flatMap(x=>(x.plan||[]).map(u=>u.plannedDate).filter(Boolean)
    .concat(x.startDate?[x.startDate]:[])).sort();
 const upper=futureAnchors.length?futureAnchors[0]:'';
 if(upper&&lower>=upper)return {error:'Die nachfolgende Reihe beginnt bereits. Für sechs zusätzliche Stunden ist kein freier Zeitraum vorhanden.'};
 const booked=new Set();
 for(const x of plans)for(const u of x.plan||[]){
   if(!u.plannedDate||u.projectTagV250===TAG&&x.id===q.id)continue;
   booked.add(day(u.plannedDate));
 }
 for(const l of state.lessons||[])if(l.classId===course&&l.date)booked.add(day(l.date));
 for(const a of state.assessments||[])if(a.classId===course&&a.date)booked.add(day(a.date));
 const entries=(state.yearAssessmentPlansV244||{})[course+'|'+year]||[];
 for(const a of entries)for(const key of ['proposedDate','alternativeDate','confirmedDate'])
  if(a[key])booked.add(day(a[key]));
 const candidates=v190CourseSlots(course,year).filter(s=>{
  const date=day(s.date);
  return date>lower&&(!upper||date<upper)&&!booked.has(date)&&!v190NoSchoolInfo(date);
 });
 const takenDates=new Set(),slots=[];
 for(const slot of candidates){
  if(takenDates.has(slot.date))continue; // avoid different Fachstunden on same date being indistinguishable in unit records
  takenDates.add(slot.date);slots.push(slot);
  if(slots.length===units.length)break;
 }
 if(slots.length<units.length)return {error:'Nur '+slots.length+' von 6 benötigten freien Fachterminen zwischen '+(lower||'heute')+
     (upper?' und '+upper:' und Schuljahresende')+' gefunden. Bestehende Unterrichts- und Prüfungstermine bleiben geschützt.',
  available:slots.map(x=>x.date)};
 return {qid:q.id,year,units:units.map(u=>({id:u.id,title:u.title})),
  slots:slots.map(s=>({date:s.date,slot:s.slot,timetableId:s.timetableId}))};
}
let proposal=null;
function modalHtmlV254(){
 const q=seq(modal?.qid);
 const result=q?makePreview(q):{error:'Reihe nicht mehr vorhanden.'};
 proposal=result.error?null:result;
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide" data-modal-stop>'+
  '<header class="modal-header"><div><span class="eyebrow">DATUMSVORSCHAU · NICHT GESPEICHERT</span><h2>Statistikprojekt terminieren</h2></div>'+
  '<button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">'+
  (result.error?'<p class="v254-error">'+esc(result.error)+'</p><p>Du kannst die Projektstunden weiterhin einzeln terminieren. Andere Reihen werden nicht automatisch verschoben.</p>':
   '<p>Diese sechs tatsächlichen Fachstunden wurden anhand von Stundenplan, Ferien, Klassenarbeiten, anderen Reihen und bereits belegten Unterrichtstagen gefunden. Es werden ausschließlich die bisher undatierten Statistik-Projektstunden verändert.</p>'+
   '<ol>'+result.units.map((u,i)=>'<li><strong>'+esc(result.slots[i].date)+'</strong> · '+esc(u.title)+'</li>').join('')+'</ol>'+
   '<button class="primary" type="button" data-v254-apply>Nur diese sechs Termine übernehmen</button>')+
  '</div></section></div>';
}
const formerPanel=sequencePanel;
sequencePanel=function(q){
 const html=formerPanel(q);
 if(!applicable(q))return html;
 const before='<section class="detail-section v254-dates"><h3>Statistikprojekt terminieren</h3>'+
 '<p>Freie Fachstunden anhand des vorhandenen Kalenders suchen. Vorschau vor dem Speichern, ohne Unterricht oder Prüfungen zu verschieben.</p>'+
 '<button type="button" class="secondary" data-v254-preview="'+esc(q.id)+'">Sechs freie Projekttermine prüfen</button></section>';
 return html.replace(/<\/div>\s*$/,before+'</div>');
};
const prevModal=modalHtml;
modalHtml=function(){return modal?.type==='projectDatesV254'?modalHtmlV254():prevModal();};
async function applyV254(){
 const q=seq(modal?.qid);
 if(!q||!proposal||proposal.qid!==q.id)throw Error('Keine geprüfte Terminübersicht vorhanden.');
 // Recompute immediately to prevent applying an obsolete preview after other changes.
 const current=makePreview(q);
 if(current.error||JSON.stringify(current.slots)!==JSON.stringify(proposal.slots)||
  JSON.stringify(current.units)!==JSON.stringify(proposal.units))
  throw Error('Die Termine haben sich verändert. Bitte neue Vorschau öffnen; es wurde nichts gespeichert.');
 if(!confirm('Genau diese sechs vorgeschlagenen Projekttermine in '+q.title+' speichern? Keine andere Stunde, Reihe oder Prüfung wird verschoben.'))return;
 const before=(q.plan||[]).map(u=>({id:u.id,plannedDate:u.plannedDate}));
 const oldStart=q.startDate,oldEnd=q.endDate;
 try{
  for(let i=0;i<current.units.length;i++){
   const unit=q.plan.find(u=>u.id===current.units[i].id);
   if(!unit||unit.projectTagV250!==TAG||unit.plannedDate)throw Error('Projektstunde wurde zwischenzeitlich verändert.');
   unit.plannedDate=current.slots[i].date;
  }
  // Do not rewrite the old start date (including a lesson already held).
  const allDates=(q.plan||[]).map(u=>u.plannedDate).filter(Boolean).sort();
  if(allDates.length)q.endDate=allDates[allDates.length-1];
  await saveState();
  proposal=null;
  modal={type:'sequence',id:q.id};render();
  alert('Sechs Statistik-Projektstunden terminiert. Die restliche Jahresplanung und Klassenarbeiten bleiben unverändert.');
 }catch(e){
  for(const u of q.plan||[]){const saved=before.find(x=>x.id===u.id);if(saved)u.plannedDate=saved.plannedDate;}
  q.startDate=oldStart;q.endDate=oldEnd;
  throw e;
 }
}
const oldWire=wire;
wire=function(){
 oldWire();
 document.querySelectorAll('[data-v254-preview]').forEach(b=>b.addEventListener('click',()=>{
  proposal=null;modal={type:'projectDatesV254',qid:b.dataset.v254Preview};render();
 }));
 document.querySelector('[data-v254-apply]')?.addEventListener('click',e=>{
  e.currentTarget.disabled=true;void applyV254().catch(err=>{alert('Termine nicht übernommen: '+(err.message||err));render();});
 });
};
})();
