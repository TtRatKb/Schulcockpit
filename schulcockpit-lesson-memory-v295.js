/* V0.29.5 – display previous observations when a lesson is reused. */
(function(){
'use strict';
const core=SC_LESSON_MEMORY_V295;
function textFor(key,val){
 const labels={
 overall:{great:'Sehr gut',fine:'Gut',good:'Gut',mixed:'Teils/teils',revise:'Überarbeiten',hard:'Schwierig'},
 timing:{fit:'Zeit passte',tight:'Zeit knapp',unfinished:'Nicht fertig',leftover:'Zeit übrig'},
 learning:{achieved:'Lernziel erreicht',partly:'Teilweise erreicht',repeat:'Wiederholung nötig',easy:'Zu leicht'}
 };
 return labels[key]?.[val]||val||'';
}
function labelFlags(kind,flags){
 const known=typeof V182_FLAGS==='object'?V182_FLAGS[kind]||[]:[];
 return (flags||[]).map(f=>known.find(x=>x[0]===f)?.[1]||f);
}
function pastHtml(l){
 const prior=core.findings(l,state.lessons||[],state.classes||[],3);
 if(!prior.length)return '';
 return '<section class="panel v295-memory"><div class="section-head"><div>'+
 '<span class="eyebrow">AUS FRÜHEREN SCHULJAHREN / STUNDEN</span>'+
 '<h3>Das habe ich beim letzten Mal gelernt</h3></div><span class="v295-count">'+prior.length+
 ' frühere Erfahrung(en)</span></div>'+
 '<p class="microcopy">Nur ein Rückblick – deine neue Stunde und ihre Materialien werden nicht automatisch verändert.</p>'+
 prior.map(x=>{
  const snippets=[textFor('overall',x.overall),textFor('timing',x.timing),textFor('learning',x.learning)].filter(Boolean);
  const issues=labelFlags('lesson',x.lessonFlags).concat(labelFlags('ppt',x.pptFlags));
  for(const fs of Object.values(x.materialIssues))issues.push(...labelFlags('material',fs));
  return '<details class="v295-memory-item"><summary>'+
    '<strong>'+esc(x.date.split('-').reverse().join('.'))+' · '+esc(x.title||'Frühere Stunde')+'</strong>'+
    '<small>'+esc(snippets.join(' · ')||'Rückblick vorhanden')+'</small></summary>'+
    (x.note?'<p><strong>Meine Notiz:</strong> '+esc(x.note)+'</p>':'')+
    (x.actual?'<p><strong>Tatsächlich gemacht:</strong> '+esc(x.actual)+'</p>':'')+
    (issues.length?'<p><strong>Für das nächste Mal:</strong> '+esc([...new Set(issues)].join(' · '))+'</p>':'')+
    '<button type="button" class="secondary" data-v295-open-old="'+esc(x.id)+'">Alte Stunde ansehen</button>'+
   '</details>';
 }).join('')+'</section>';
}
const originalPlan=wizardPlanStepV14;
wizardPlanStepV14=function(l){
 const html=originalPlan(l),memory=pastHtml(l);
 return memory?html.replace('<h3>Material in dieser Stunde</h3>',memory+'<h3>Material in dieser Stunde</h3>'):html;
};
const originalDay=v182LessonDayHtml;
v182LessonDayHtml=function(l){
 const html=originalDay(l),memory=pastHtml(l);
 if(!memory||v182IsHeld(l))return html;
 return html.replace('<section class="panel v182-end-panel">',memory+'<section class="panel v182-end-panel">');
};
const oldWire=wire;
wire=function(){
 oldWire();
 document.querySelectorAll('[data-v295-open-old]').forEach(b=>b.addEventListener('click',()=>{
  const l=lesson(b.dataset.v295OpenOld);if(!l)return;
  v182LessonId=l.id;modal=null;view='lessonDayV182';render();
 }));
};
const oldRender=render;
render=function(){
 oldRender();
 const v=document.querySelector('.brand small');
 if(v)v.textContent=state.settings.schoolYear+' · V0.29.5';
};
if(typeof window!=='undefined')window.SchulcockpitLessonMemoryV295={findings:core.findings,pastHtml};
})();