/* V0.33.21 – pick actual tested subjects BEFORE generating an AI rubric.
 * Metadata only; existing student scores, old rubrics and Classtime stay intact.
 */
(function(){
'use strict';
const core=window.SchulcockpitExamScopeV3321Core;
if(!core)return;
const safe=value=>esc(String(value??''));
const exam=()=>v200Assessment(v200Eval?.assessmentId);
const priv=()=>v200Eval?.privateData;
const kind=()=>window.SchulcockpitExamTabsV338?.activeKind?.(exam())||'standard';
const fileKey=()=>kind().startsWith('file:')?kind().slice(5):'';
const pool=a=>v204AllCourseCurriculum(cls(a?.classId));
const applies=a=>!!a&&v202Grade(cls(a.classId))<=7&&pool(a).length>0;
function forExam(a=exam(),p=priv()){
 if(!a)return {ready:false,errors:['Keine Klassenarbeit geöffnet.'],topicIds:[],competencyIds:[],competencies:[]};
 const file=kind().startsWith('file:')?kind().slice(5):'';
 const saved=file?p?.variantCurriculumScopesV3321?.[file]:a.examCurriculumScopeV3321;
 return core.selection(pool(a),saved);
}
function scopePanel(a,p){
 const groups=core.groups(pool(a)),current=forExam(a,p),activeTopic=new Set(current.topicIds),
  activeIds=new Set(current.competencyIds),existing=!!a.evaluationV200?.analysis;
 return '<section class="detail-section v3321-scope" aria-label="Prüfungsthemen und Kompetenzen">'+
  '<div class="section-head compact"><div><span class="eyebrow">PRÜFUNGSSTOFF ABGRENZEN</span>'+
  '<h3>Welche Themen und Kompetenzen wurden tatsächlich geprüft?</h3></div></div>'+
  '<p>Wähle die Themen dieser Klassenarbeit. Schulcockpit übernimmt zunächst alle zugehörigen Kompetenzen; unter „Kompetenzen eingrenzen“ kannst du einzelne abwählen. <strong>Nur die bestätigte Auswahl gelangt in den ChatGPT-Prompt.</strong></p>'+
  (existing?'<p class="microcopy">Ein vorhandenes Aufgaben- und Kompetenzraster bleibt unverändert. Die Auswahl gilt für künftige Analysen; sie ersetzt keine bereits korrigierten Ergebnisse.</p>':'')+
  '<div class="v3321-topics">'+groups.map(g=>{
   const checked=activeTopic.has(g.id);
   return '<div class="v3321-topic"><label class="v3321-topic-title">'+
    '<input type="checkbox" data-v3321-topic="'+safe(g.id)+'"'+(checked?' checked':'')+'>'+
    '<span><strong>'+safe(g.title)+'</strong><small>'+g.competencies.length+' zugehörige Kompetenzen</small></span></label>'+
    '<details'+(checked&&g.competencies.length<8?' open':'')+'><summary>Kompetenzen eingrenzen</summary>'+
    '<div class="v3321-comps">'+g.competencies.map(c=>
     '<label><input type="checkbox" data-v3321-comp="'+safe(c.id)+'" data-v3321-parent="'+safe(g.id)+'"'+
     (activeIds.has(c.id)?' checked':'')+'><span>'+safe(c.text)+'</span></label>').join('')+'</div></details></div>';
  }).join('')+'</div>'+
  '<div class="v3321-actions"><button class="primary" type="button" data-v3321-save>'+
  'Prüfungsthemen speichern</button><span data-v3321-status role="status">'+
  (current.ready?'✓ '+current.topicIds.length+' Thema/Themen · '+current.competencyIds.length+
    ' Kompetenzen bestätigt':'Noch keine verbindliche Auswahl gespeichert')+
  '</span></div>'+
  '<p class="microcopy">Themen der Unterrichtsplanung sind eine Orientierung. Nur tatsächlich in der Arbeit geprüfte Kompetenzen auswählen; Originalaufgaben und ggf. ein echtes Kolleg*innenraster bleiben die Grundlage der Bewertung.</p></section>';
}
function count(){
 const topics=[...document.querySelectorAll('[data-v3321-topic]:checked')].length,
  comps=[...document.querySelectorAll('[data-v3321-comp]:checked')].length;
 const el=document.querySelector('[data-v3321-status]');
 if(el)el.textContent=topics+' Thema/Themen · '+comps+' Kompetenzen ausgewählt – noch nicht gespeichert';
}
let busy=false;
async function save(){
 if(busy)return;
 const a=exam(),p=priv(),current=kind();
 if(!a||!applies(a))return;
 const topics=[...document.querySelectorAll('[data-v3321-topic]:checked')].map(el=>el.dataset.v3321Topic);
 const ids=[...document.querySelectorAll('[data-v3321-comp]:checked')].map(el=>el.dataset.v3321Comp);
 const scope=core.create(pool(a),topics,ids);
 busy=true;
 try{
  if(exam()?.id!==a.id||kind()!==current)throw Error('Die Prüfungsfassung hat sich geändert.');
  if(current==='standard'){
   const before=a.examCurriculumScopeV3321;
   a.examCurriculumScopeV3321=scope;
   try{await saveState();}
   catch(e){if(before)a.examCurriculumScopeV3321=before;else delete a.examCurriculumScopeV3321;throw e;}
  }else{
   const key=fileKey(),next=structuredClone(priv());
   if(!key||!next)throw Error('Private Prüfungsfassung fehlt.');
   next.variantCurriculumScopesV3321={...(next.variantCurriculumScopesV3321||{}),[key]:scope};
   await v200PrivatePut(next);
   v200Eval.privateData=next;
  }
  render();
 }catch(e){
  const el=document.querySelector('[data-v3321-status]');
  if(el)el.textContent='Nicht gespeichert: '+(e.message||e);
  else alert(e.message||e);
 }finally{busy=false;}
}
const previousStep2=v200Step2;
v200Step2=function(a,p){
 if(!applies(a)||forExam(a,p).ready)return previousStep2(a,p);
 return '<section class="detail-section v3321-needs-selection"><h3>Erst die Prüfungsthemen auswählen</h3>'+
  '<p>Für einen verlässlichen ChatGPT-Prompt müssen die tatsächlich geprüften Themen und Kompetenzen in Schritt 1 feststehen. '+ 
  'Ohne Auswahl wird <strong>kein gesamter Jahrgangskatalog</strong> mehr in den Prompt geschrieben.</p>'+
  '<button class="primary" type="button" data-v200-step="1">← Themen in Schritt 1 auswählen</button></section>'+
  (a?.evaluationV200?.analysis?'<section class="detail-section"><p>Das bereits gespeicherte Kompetenzraster bleibt erhalten. Du kannst seine vorhandenen Ergebnisse weiterhin in Schritt 3–5 prüfen.</p>'+
   '<button class="secondary" type="button" data-v200-step="3">Zu bestehenden Ergebnissen →</button></section>':'');
};
const oldPrompt=v200AssessmentAnalysisPrompt;
v200AssessmentAnalysisPrompt=function(a,p){
 if(!applies(a))return oldPrompt(a,p);
 const scope=forExam(a,p);
 if(!scope.ready)throw Error('Bitte zuerst unter „1 · Grundlagen“ die tatsächlich geprüften Themen und Kompetenzen auswählen und speichern.');
 const text=oldPrompt(a,p);
 const groupNames=core.groups(pool(a)).filter(g=>scope.topicIds.includes(g.id)).map(g=>g.title);
 const header='## Verbindliche Auswahl dieser Klassenarbeit\n'+
  'Ausschließlich diese Themen: '+groupNames.join('; ')+'.\n'+
  'Ausschließlich diese Curriculumkompetenzen: '+scope.competencyIds.join(', ')+'.\n'+
  'Nicht in der Liste enthaltene Kompetenzen dürfen NICHT in das Rückgaberaster aufgenommen werden.\n\n';
 v200AssertNoStudentLeak(header+text,p);
 return header+text;
};
const oldExtract=v200ExtractAnalysis;
v200ExtractAnalysis=function(text){
 const a=exam();
 if(!applies(a))return oldExtract(text);
 const scope=forExam(a,priv());
 if(!scope.ready)throw Error('Vor dem Kompetenzraster-Import zuerst die Prüfkompetenzen bestätigen.');
 const result=oldExtract(text);
 core.checkImport(result,scope.competencyIds);
 return result;
};
const oldImport=v200ImportAnalysis;
v200ImportAnalysis=async function(text){
 const a=exam();
 if(applies(a)){
  const scoped=forExam(a,priv());
  if(!scoped.ready)throw Error('Vor dem Import zuerst die Prüfungsthemen bestätigen.');
  const source=typeof v209ExtractRubricInput==='function'?v209ExtractRubricInput(text):null;
  if(source)core.checkImport(source,scoped.competencyIds);
 }
 return oldImport(text);
};
const oldPage=v214EvaluationPage;
v214EvaluationPage=function(){
 const html=oldPage(),a=exam(),p=priv();
 if(!a||!applies(a)||v200Eval?.step!==1)return html;
 const root=document.createElement('div');root.innerHTML=html;
 const body=root.querySelector('.v214-workspace-content');
 if(!body)return html;
 body.insertAdjacentHTML('afterbegin',scopePanel(a,p));
 return root.innerHTML;
};
const oldWire=wire;
wire=function(){
 oldWire();
 if(view!=='evaluation'||v200Eval?.step!==1)return;
 for(const topic of document.querySelectorAll('[data-v3321-topic]'))
  topic.addEventListener('change',()=>{
   for(const child of document.querySelectorAll('[data-v3321-parent]'))
    if(child.dataset.v3321Parent===topic.dataset.v3321Topic)child.checked=topic.checked;
   count();
  });
 for(const comp of document.querySelectorAll('[data-v3321-comp]'))
  comp.addEventListener('change',()=>{
   const parent=[...document.querySelectorAll('[data-v3321-topic]')].find(el=>
    el.dataset.v3321Topic===comp.dataset.v3321Parent);
   if(parent)parent.checked=[...document.querySelectorAll('[data-v3321-parent]')].some(el=>
    el.dataset.v3321Parent===comp.dataset.v3321Parent&&el.checked);
   count();
  });
 document.querySelector('[data-v3321-save]')?.addEventListener('click',()=>void save());
};
window.SchulcockpitExamScopeV3321={forExam,applies,pool};
render();
})();
