/* Schulcockpit V0.29.0 – compact, sorted year plan without modifying
 * course IDs, course order, dated units or private assessment data. */
(function(){
'use strict';
const openedCourses=new Set();
let examsOpen=false,returnedOpen=false,inactiveOpen=false;
function sortKey(c){
 const subject=String(c?.subject||'').toLocaleLowerCase('de-DE');
 const rank=subject.includes('mathematik')?0:subject.includes('religion')?1:
  subject.includes('method')?2:3;
 const grade=Number(String(c?.name||'').match(/\d+/)?.[0])||99;
 return {rank,grade,name:String(c?.name||'')};
}
function compare(a,b){
 const x=sortKey(a),y=sortKey(b);
 return x.rank-y.rank||x.grade-y.grade||
  x.name.localeCompare(y.name,'de-DE',{numeric:true});
}
function courseFor(section){
 const id=section.querySelector('[data-v190-reschedule]')?.dataset.v190Reschedule;
 return (state.classes||[]).find(c=>c.id===id)||null;
}
function compactCourse(section,c){
 const head=section.querySelector(':scope > .section-head');
 const list=section.querySelector(':scope > .v190-sequence-list');
 if(!head||!list||!c)return;
 const count=v190PlanningSequences(c.id,v190PlanningYear()).length;
 const fold=document.createElement('details');fold.className='v290-course-fold';
 fold.dataset.v290Course=c.id;fold.open=openedCourses.has(c.id);
 const summary=document.createElement('summary');summary.className='v290-course-summary';
 const name=document.createElement('strong');
 name.textContent=[c.subject,c.name].filter(Boolean).join(' ');
 const stats=document.createElement('small');
 stats.textContent=count+' Reihe'+(count===1?'':'n')+' · '+v190PlanningSequences(c.id,v190PlanningYear())
  .reduce((n,q)=>n+v190SequenceNeed(q),0)+' Sollstunden';
 summary.append(name,stats);fold.append(summary,head,list);
 section.replaceChildren(fold);
 section.classList.add('v290-course-plan');
 fold.addEventListener('toggle',()=>{if(fold.open)openedCourses.add(c.id);else openedCourses.delete(c.id);});
}
function compactExams(root){
 const section=root.querySelector('.v188-assessment-panel');
 if(!section)return;
 section.classList.add('v290-exam-panel');
 const header=section.querySelector(':scope > .section-head'),
  list=section.querySelector(':scope > .v188-assessment-list');
 if(!header||!list)return;
 const oldIntro=header.querySelector('p');if(oldIntro)oldIntro.remove();
 const active=document.createElement('div');active.className='v290-active-exams';
 const completed=document.createElement('details');completed.className='v290-returned-exams';
 completed.open=returnedOpen;
 const doneSummary=document.createElement('summary');
 const doneBody=document.createElement('div');doneBody.className='v290-returned-list';
 let openCount=0,doneCount=0;
 for(const card of [...list.querySelectorAll(':scope > .v188-assessment-card')]){
  const id=card.querySelector('[data-v188-assessment-edit]')?.dataset.v188AssessmentEdit;
  const a=(state.assessments||[]).find(x=>x.id===id),returned=!!a?.correctionV203?.returnedAt;
  if(a){
   const actions=card.querySelector('.v188-assessment-actions');
   if(actions){
    const button=document.createElement('button');button.type='button';
    button.className='secondary v290-return-button';
    button.dataset.v290Return=id;
    button.textContent=returned?'↩ Wieder öffnen':'✓ Zurückgegeben';
    button.setAttribute('aria-label',returned?'Rückgabe rückgängig machen':'Klassenarbeit als zurückgegeben markieren');
    actions.prepend(button);
    button.addEventListener('click',async()=>{
     const assessment=(state.assessments||[]).find(x=>x.id===id);if(!assessment)return;
     const previous=structuredClone(assessment.correctionV203||null);
     const info=v203Workflow(assessment,true);
     info.returnedAt=returned?'':new Date().toISOString();
     try{await saveState();render();}
     catch(err){assessment.correctionV203=previous;alert('Rückgabestatus konnte nicht gespeichert werden.');render();}
    });
   }
  }
  if(returned){doneBody.append(card);doneCount++;}
  else{active.append(card);openCount++;}
 }
 const title=section.querySelector('h2');
 if(title)title.textContent='Klassenarbeiten & Klausuren · '+openCount+' offen';
 doneSummary.textContent=doneCount+' zurückgegeben · bei Bedarf einblenden';
 completed.append(doneSummary,doneBody);
 completed.addEventListener('toggle',()=>{returnedOpen=completed.open;});
 if(!openCount){
  const empty=document.createElement('p');empty.className='microcopy';
  empty.textContent='Keine offenen Klassenarbeiten.';
  active.append(empty);
 }
 const fold=document.createElement('details');fold.className='v290-assessment-fold';
 fold.open=examsOpen;
 const summary=document.createElement('summary');
 summary.className='v290-assessment-summary';
 const label=document.createElement('strong');
 label.textContent=openCount+' offene Klassenarbeiten/Klausuren';
 const hint=document.createElement('small');
 hint.textContent=doneCount+' zurückgegeben · Termine bleiben fest im Plan';
 summary.append(label,hint);fold.append(summary,active,completed);
 fold.addEventListener('toggle',()=>{examsOpen=fold.open;});
 list.replaceChildren(fold);
}
function compactCalendar(root){
 const section=root.querySelector('.v190-calendar-summary');
 if(!section||section.classList.contains('v290-calendar-summary'))return;
 section.classList.add('v290-calendar-summary');
}
function compact(){
 if(view!=='sequences')return;
 const root=document.querySelector('.v190-year-plan');
 if(!root||root.dataset.v290Done==='1')return;
 root.dataset.v290Done='1';
 compactExams(root);compactCalendar(root);
 const sections=[...root.querySelectorAll(':scope > .v190-course-plan')];
 const active=[],inactive=[];
 for(const section of sections){
  const c=courseFor(section);
  if(!c)continue;
  const inTimetable=(state.timetable||[]).some(t=>t.classId===c.id);
  const hasLessons=(state.lessons||[]).some(l=>l.classId===c.id);
  compactCourse(section,c);
  (inTimetable||hasLessons?active:inactive).push({section,c});
 }
 const sorted=items=>items.sort((a,b)=>compare(a.c,b.c));
 for(const {section}of sorted(active))root.append(section);
 if(inactive.length){
  const container=document.createElement('details');
  container.className='v290-inactive-courses';container.open=inactiveOpen;
  const summary=document.createElement('summary');
  summary.textContent=inactive.length+' weitere'+(inactive.length===1?'r Kurs':' Kurse')+
   ' ohne Stundenplan · gespeicherte Reihen bleiben erhalten';
  const inner=document.createElement('div');
  inner.className='v290-inactive-list';
  for(const {section}of sorted(inactive))inner.append(section);
  container.append(summary,inner);root.append(container);
  container.addEventListener('toggle',()=>{inactiveOpen=container.open;});
 }
}
const beforeRender=render;
render=function(){
 beforeRender();compact();
 const ver=document.querySelector('.brand small');if(ver)ver.textContent=state.settings.schoolYear+' · V0.29.0';
};
window.SchulcockpitYearPlanV290={compare,compact};
})();