/* V0.33.20 – on-page examiner grade histogram and per-column rule editing.
 * Public analysis and private per-file rubrics stay separate. All grade 5–7
 * statistics are teacher-only previews, not stored student marks or notes.
 */
(function(){
'use strict';
const core=window.SchulcockpitGradeMirrorV3320Core;
if(!core)return;
const safe=x=>esc(String(x??''));
const exam=()=>v200Assessment(v200Eval?.assessmentId);
const priv=()=>v200Eval?.privateData;
const kind=()=>window.SchulcockpitExamTabsV338?.activeKind?.(exam())||'standard';
const currentFile=()=>window.SchulcockpitExamTabsV338?.available?.(exam())?.find(f=>f.key===kind());
const currentAnalysis=()=>{
 const a=exam(),p=priv(),f=currentFile();
 return f?p?.variantAnalysesV317?.[f.fileKey]:a?.evaluationV200?.analysis;
};
const currentScale=()=>{
 const a=exam(),p=priv(),f=currentFile();
 return f?p?.variantGradeScalesV3310?.[f.fileKey]:a?.gradeScaleV260;
};
let active=null,saving=false;
function stats(analysis){
 const a=exam(),p=priv();
 if(!a||!p||!analysis)return null;
 return core.summary({
  reports:v200ReportList(),analysis,priv:p,
  scale:currentScale(),scoreFor:v200GetScore,grade:v202Grade(cls(a.classId)),
  variant:kind()
 });
}
function percent(value){return Number(value).toLocaleString('de-DE',{maximumFractionDigits:1})+' %';}
function countMarkup(result){
 const internal=v202Grade(cls(exam()?.classId))<=7;
 const advisory=internal?'Interner Notenspiegel – keine Schülernoten':
  result.scaleStored?'Rechnerischer Notenspiegel dieser Prüfungsfassung':
  'Orientierung – Notenschlüssel für diese Fassung noch nicht gespeichert';
 return '<section class="v3320-overview" aria-label="Aktueller Notenspiegel">'+
  '<div class="v3320-overview-head"><strong>Notenspiegel</strong>'+
  '<span class="v3320-subtitle">'+safe(advisory)+'</span>'+
  '<span data-v3320-preview hidden class="v3320-preview">Vorschau · noch nicht gespeichert</span></div>'+
  '<div class="v3320-distribution">'+
  result.histogram.map((number,index)=>
   '<div class="v3320-grade-count'+(index>=4?' v3320-low':'')+'">'+
   '<span>Note '+(index+1)+'</span><strong data-v3320-count="'+index+'">'+number+'</strong></div>').join('')+
  '</div>'+
  '<div class="v3320-meta">'+
  '<span><strong data-v3320-done>'+result.done+'</strong> fertig</span>'+
  '<span><strong data-v3320-pending>'+result.pending+'</strong> noch unvollständig</span>'+
  '<span><strong data-v3320-excluded>'+result.excluded+'</strong> nicht vergleichbar / nicht teilgenommen</span>'+
  '<span>5/6: <strong data-v3320-bad>'+result.bad+'</strong></span>'+
  '<span>Durchschnitt: <strong data-v3320-average>'+(result.average===null?'–':percent(result.average))+'</strong></span>'+
  '<span><strong data-v3320-close>'+result.close+'</strong> bis 1 P. vor besserer Note</span>'+
  '</div><p class="microcopy v3320-explain">'+
   'Nur vollständig korrigierte Arbeiten dieser Prüfungsfassung. Die Noten 1–6 sind hier '+ 
   (internal?'ausschließlich eine interne Schwierigkeitseinschätzung; E/TE/NNE bleibt unverändert.':
   'rechnerisch aus Punkten und Notenschlüssel abgeleitet (ohne manuelle Notenänderungen).')+
   ' Ein Abstand von höchstens 1 Punkt ist nur ein Hinweis, keine automatische Aufwertung.</p>'+
  '</section><div data-v3320-rule-editor class="v3320-editor-host" hidden></div>';
}
function controls(item){
 const original=String(item.source||'').endsWith('_bonus');
 return '<button type="button" class="v3320-head-action" data-v3320-edit="'+safe(item.id)+'" '+
  (original?'disabled title="Ursprüngliche separate Bonusfrage bleibt Bonus"':
   'title="Aufgabe als Bonus oder teilweise Bonus werten"')+
  ' aria-label="'+safe((item.label||item.id)+' – Bonuswertung ändern')+'">'+
  (original?'★ Bonus':'Wertung <span aria-hidden="true">⚙</span>')+'</button>';
}
function applyHeader(root,analysis){
 const heads=[...root.querySelectorAll('.v221-matrix thead th.v221-head')];
 for(const [i,it] of analysis.items.entries()){
  const el=heads[i];if(!el)continue;
  if(el.querySelector('[data-v3320-edit]'))continue;
  const mode=core.mode(it);
  if(mode==='bonus')el.classList.add('v3320-bonus');
  else if(mode==='partial')el.classList.add('v3320-partial');
  el.insertAdjacentHTML('beforeend',controls(it));
 }
}
function rowLabels(result){
 const byId=new Map(result.students.map(row=>[row.id,row]));
 const all=[...document.querySelectorAll('.v221-matrix tbody tr')];
 for(const row of all){
  const source=row.querySelector('[data-v210-grid-score],[data-v3316-score]');
  const value=source?.getAttribute('data-v210-grid-score')||
   source?.getAttribute('data-v3316-score')||'';
  const sid=value.slice(0,value.indexOf('|'));
  if(!sid)continue;
  const cell=row.querySelector('.v221-person');
  if(!cell)continue;
  let label=cell.querySelector('[data-v3320-row]');
  if(!label){
   label=document.createElement('small');label.className='v3320-row-grade';
   label.dataset.v3320Row=sid;
   cell.append(label);
  }
  const r=byId.get(sid);
  if(!r){label.textContent='Statistik: noch offen / nicht teilgenommen';label.classList.remove('v3320-near');continue;}
  const isLower=v202Grade(cls(exam()?.classId))<=7;
  label.textContent=(isLower?'Interne Note ':'Note ')+r.grade+
   (r.next?' · '+core.fmt(r.next.points)+' P. bis Note '+r.next.grade:'');
  label.classList.toggle('v3320-near',!!r.next);
  label.title=r.next?'Rechnerisch '+core.fmt(r.next.points)+
   ' Punkte bis zur nächstbesseren Note. Keine automatische Punktevergabe.':'';
 }
}
function refresh(result,preview){
 if(!result)return;
 const root=document.querySelector('.v3320-overview');
 if(!root)return;
 result.histogram.forEach((n,i)=>{
  const el=root.querySelector('[data-v3320-count="'+i+'"]');if(el)el.textContent=n;
 });
 for(const [field,value] of Object.entries({
  done:result.done,pending:result.pending,excluded:result.excluded,bad:result.bad,
  close:result.close,average:result.average===null?'–':percent(result.average)
 })){
  const el=root.querySelector('[data-v3320-'+field+']');if(el)el.textContent=value;
 }
 const pending=root.querySelector('[data-v3320-preview]');
 if(pending)pending.hidden=!preview;
 rowLabels(result);
}
function editingMarkup(item){
 const value=core.mode(item),part=item.partialBonusV267?.max??'';
 const description=item.partialBonusV267?.description||'';
 return '<div class="v3320-editor" role="group" aria-label="Aufgabenwertung ändern">'+
  '<div class="v3320-editor-title"><strong>'+safe(item.label||item.id)+'</strong>'+
   '<span>'+safe(core.fmt(core.max(item)))+' mögliche Punkte</span></div>'+
  '<div class="v3320-fields"><label>Wertung <select data-v3320-mode>'+
  [['regular','Regulär'],['bonus','Ganz Bonus'],['partial','Teilweise Bonus']].map(([id,label])=>
   '<option value="'+id+'"'+(id===value?' selected':'')+'>'+label+'</option>').join('')+
  '</select></label><label data-v3320-part-label'+(value==='partial'?'':' hidden')+
   '>Davon Bonus (P.) <input data-v3320-part type="number" min=".25" step=".25" max="'+safe(core.max(item))+
   '" value="'+safe(part)+'" placeholder="z. B. 3"></label>'+
  '<label data-v3320-desc-label'+(value==='partial'?'':' hidden')+'>'+
   'Welche Lücken? <input data-v3320-description maxlength="150" placeholder="z. B. Lücken 2, 6, 9" value="'+safe(description)+'"></label></div>'+
  '<div class="v3320-editor-actions"><button type="button" class="primary small" data-v3320-save>Übernehmen</button>'+
  '<button type="button" class="secondary small" data-v3320-cancel>Abbrechen</button>'+
  '<span class="microcopy" data-v3320-message role="status"></span></div>'+
  '<p class="microcopy">Die Vorschau verändert noch keine Ergebnisse. Bei Bonuslücken muss anschließend der tatsächlich erzielte Bonusanteil pro Kind geprüft werden.</p></div>';
}
function message(value){
 const target=document.querySelector('[data-v3320-message]');
 if(target)target.textContent=value;
}
function closeEditor(){
 active=null;
 const host=document.querySelector('[data-v3320-rule-editor]');
 if(host){host.hidden=true;host.innerHTML='';}
 refresh(stats(currentAnalysis()),false);
}
function propose(){
 if(!active)return null;
 const a=currentAnalysis(),p=priv(),f=currentFile(),root=document.querySelector('[data-v3320-rule-editor]');
 const mode=root?.querySelector('[data-v3320-mode]')?.value;
 const part=root?.querySelector('[data-v3320-part]')?.value;
 const description=root?.querySelector('[data-v3320-description]')?.value;
 const key=f?.fileKey;
 const isMember=st=>!f||p.examFileV317?.[st.id]===key||
  p.activeVariantV300?.[st.id]==='file:'+key;
 return core.rule(a,active,{mode,bonusMax:part,description},p,isMember);
}
function preview(){
 if(!active)return;
 const root=document.querySelector('[data-v3320-rule-editor]'),
  partial=root?.querySelector('[data-v3320-mode]')?.value==='partial';
 for(const name of ['part-label','desc-label']){
  const el=root?.querySelector('[data-v3320-'+name+']');if(el)el.hidden=!partial;
 }
 try{
  const draft=propose();
  message(draft.changed?'Änderung nur als Vorschau angezeigt.':'Keine Änderung.');
  refresh(stats(draft.analysis),draft.changed);
 }catch(error){
  message('Bitte prüfen: '+(error.message||error));
  refresh(stats(currentAnalysis()),false);
 }
}
function openEditor(id){
 const item=currentAnalysis()?.items?.find(it=>it.id===id);
 if(!item||String(item.source||'').endsWith('_bonus'))return;
 active=id;
 const host=document.querySelector('[data-v3320-rule-editor]');
 if(!host)return;
 host.hidden=false;host.innerHTML=editingMarkup(item);
 const select=host.querySelector('[data-v3320-mode]');
 select?.addEventListener('change',preview);
 for(const el of host.querySelectorAll('[data-v3320-part],[data-v3320-description]'))
  el.addEventListener('input',preview);
 host.querySelector('[data-v3320-cancel]')?.addEventListener('click',closeEditor);
 host.querySelector('[data-v3320-save]')?.addEventListener('click',()=>void saveChange());
 preview();
 host.scrollIntoView?.({block:'nearest'});
 select?.focus({preventScroll:true});
}
async function flushScores(){
 if(kind()==='standard'){
  if(typeof v221Queue==='function'&&typeof v221SaveAllVisible==='function'){
   const result=await v221Queue(v221SaveAllVisible);
   if(!result)throw Error('Bitte zuerst die fehlerhaften Punkteingaben korrigieren.');
  }
 }else{
  await window.SchulcockpitVariantMatrixV3316?.flush?.();
 }
}
async function saveChange(){
 if(saving||!active)return;
 const current=kind(),a=exam(),p=priv(),oldAnalysis=currentAnalysis(),id=active;
 let draft;
 try{draft=propose();}
 catch(error){message(error.message||String(error));return;}
 if(!draft.changed){closeEditor();return;}
 const before=stats(oldAnalysis),after=stats(draft.analysis);
 const modeText=core.mode(draft.item)==='bonus'?'vollständig Bonus':
  core.mode(draft.item)==='partial'?'teilweise Bonus':'regulär';
 const text='Aufgabe „'+(draft.item.label||id)+'“ als '+modeText+' werten?\n'+
  'Reguläre Maximalpunkte danach: '+core.fmt(draft.regularMax)+' P.\n'+
  'Vollständig bewertete Arbeiten: '+before.done+' → '+after.done+
  '\nNote 5/6: '+before.bad+' → '+after.bad+
  '\n\nDie Originalwerte und bisherigen individuellen Punkte bleiben erhalten.';
 if(!confirm(text))return;
 saving=true;
 try{
  await flushScores();
  if(kind()!==current||exam()?.id!==a?.id||currentAnalysis()!==oldAnalysis)
   throw Error('Die Prüfungsfassung wurde zwischenzeitlich verändert. Bitte erneut prüfen.');
  if(current==='standard'){
   const oldItems=a.evaluationV200.analysis.items;
   a.evaluationV200.analysis.items=draft.analysis.items;
   try{await saveState();}
   catch(error){a.evaluationV200.analysis.items=oldItems;throw error;}
  }else{
   const file=currentFile();
   if(!file||file.key!==current)throw Error('Prüfungsfassung nicht mehr verfügbar.');
   const next=structuredClone(p);
   next.variantAnalysesV317={...(next.variantAnalysesV317||{}),
    [file.fileKey]:draft.analysis};
   await v200PrivatePut(next);
   v200Eval.privateData=next;
  }
  active=null;
  render();
 }catch(error){message('Nicht gespeichert: '+(error.message||error));}
 finally{saving=false;}
}
const priorPage=v214EvaluationPage;
v214EvaluationPage=function(){
 const html=priorPage(),a=exam(),p=priv();
 if(!a||!p||v200Eval?.step!==4)return html;
 const analysis=currentAnalysis();
 if(!analysis?.items?.length)return html;
 const root=document.createElement('div');root.innerHTML=html;
 const table=root.querySelector('.v214-evaluation-workspace .v221-matrix');
 if(!table)return html;
 const result=stats(analysis);if(!result)return html;
 applyHeader(root,analysis);
 const area=root.querySelector('.v3316-summary')||root.querySelector('.v221-score-section');
 if(!area?.parentNode)return html;
 area.insertAdjacentHTML('beforebegin',countMarkup(result));
 return root.innerHTML;
};
const oldWire=wire;
wire=function(){
 oldWire();
 if(view!=='evaluation'||v200Eval?.step!==4||!document.querySelector('.v3320-overview'))return;
 for(const el of document.querySelectorAll('[data-v3320-edit]'))
  el.addEventListener('click',()=>openEditor(el.dataset.v3320Edit));
 refresh(stats(currentAnalysis()),false);
 // Autosave modules update the point/bonus result text after the private write.
 // Observe those narrow status nodes only, never the whole document, to avoid
 // recursive refreshes or rerendering/scoll jumps.
 const targets=[...document.querySelectorAll('[data-v281-result],[data-v3316-result],#v221-save-status,#v281-status')];
 const observer=new MutationObserver(()=>{
  if(view==='evaluation'&&v200Eval?.step===4&&!active)
   refresh(stats(currentAnalysis()),false);
 });
 for(const node of targets)observer.observe(node,{childList:true,characterData:true,subtree:true});
 const main=document.querySelector('.v214-workspace-content');
 if(main)main.addEventListener('click',()=>{}, {once:true});
 // Changes to participation are handled through normal render and page rebuild.
};
window.SchulcockpitGradeMirrorV3320={stats,propose};
render();
})();
