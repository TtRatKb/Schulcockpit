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
let active=null,saving=false,liveObserver=null;
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
function decimal(value){return value===null?'–':Number(value).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:2});}
function diagnosticMarkup(result){
 const names=new Map((priv()?.roster||[]).map(s=>[s.id,s.name]));
 return (result.pendingRows?.length?'<details open class="v3338-diagnose"><summary><strong>'+result.pending+' unvollständige Arbeiten – Ursachen anzeigen</strong></summary>'+
 result.pendingRows.map(r=>'<div class="v3338-diagnostic-row"><strong>'+safe(names.get(r.id)||r.id)+'</strong>'+r.issues.map(i=>'<button type="button" class="text-button v3338-jump" data-v3338-jump="'+safe(r.id)+'" data-v3338-item="'+safe(i.itemId||'')+'" data-v3338-field="'+safe(i.field||'')+'">'+safe((i.label?i.label+' · ':'')+i.reason)+'</button>').join('')+'</div>').join('')+'</details>':'')+
 (result.excludedRows?.length?'<details class="v3338-diagnose"><summary>'+result.excluded+' nicht in dieser Statistik – Gründe</summary>'+result.excludedRows.map(r=>'<div><strong>'+safe(names.get(r.id)||r.id)+'</strong> · '+safe(r.reason)+'</div>').join('')+'</details>':'');
}
function taskMarkup(result){
 return '<details class="v3338-diagnose"><summary><strong>Aufgabenanalyse · Null-Punkte-Quote und Kompetenzabdeckung</strong></summary><p>Nur gültige reguläre Wertungen dieser Fassung. Offene Felder zählen nicht als 0. Auffällige Aufgaben fachlich prüfen; keine automatische Änderung.</p>'+
 '<div class="v210-scroll"><table class="v210-grid"><thead><tr><th>Aufgabe</th><th>0 Punkte</th><th>Ø Punkte (%)</th><th>Ohne diese Aufgabe verbleiben</th></tr></thead><tbody>'+
 (result.tasks||[]).map(t=>'<tr><td><strong>'+safe(t.label)+'</strong><small>'+safe(t.competency)+'</small>'+(t.taskText?'<details><summary>Aufgabenstellung</summary><p style="white-space:pre-wrap">'+safe(t.taskText)+'</p></details>':'')+'</td><td class="'+(t.zeroPct>50?'v3338-flag':'')+'">'+(t.zeroPct===null?'–':percent(t.zeroPct))+' ('+t.zero+'/'+t.count+')'+(t.open?' · '+t.open+' offen':'')+'</td><td>'+(t.averagePct===null?'–':percent(t.averagePct))+'</td><td>'+t.remaining+' Aufgaben · '+safe(core.fmt(t.remainingMax))+' P.'+(!t.remaining?'<strong class="v3338-flag"> Kein regulärer Nachweis mehr!</strong>':'')+'</td></tr>').join('')+'</tbody></table></div></details>';
}
function badText(result){return result.badPct===null?'–':result.bad+' / '+result.done+' ('+percent(result.badPct)+')';}
function statusText(result){return (result.provisional?'Vorläufig · '+result.done+' von '+result.expected+' erwarteten vergleichbaren Arbeiten bewertet; '+result.pending+' offen, '+result.awaiting+' Nachschreiben, '+result.unassigned+' Zuordnung(en) ungeklärt. ':result.done?'Abgeschlossen für diese Vergleichsgruppe. ':'Noch keine vergleichbaren fertigen Arbeiten. ')+(result.badPct===null?'':result.badPct>30?'Orientierung: 30-%-Grenze überschritten.':'Orientierung: 30-%-Grenze nicht überschritten.');}
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
  '<span>Note 5/6: <strong data-v3320-bad>'+safe(badText(result))+'</strong></span>'+
  '<span>Ø Note: <strong data-v3320-average>'+safe(decimal(result.averageGrade))+'</strong></span>'+
  '<span>Ø Punkte: <strong data-v3338-pct>'+(result.average===null?'–':percent(result.average))+'</strong></span>'+
  '<span><strong data-v3320-close>'+result.close+'</strong> bis 1 P. vor besserer Note</span>'+
  '</div><p class="microcopy" data-v3338-quote>'+safe(statusText(result))+'</p><div data-v3338-diagnostics>'+diagnosticMarkup(result)+'</div><div data-v3338-tasks>'+taskMarkup(result)+'</div><p class="microcopy v3320-explain">'+
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
 const pending=new Map((result.pendingRows||[]).map(r=>[r.id,r.issues]));
 const excluded=new Map((result.excludedRows||[]).map(r=>[r.id,r.reason]));
 document.querySelectorAll('.v3338-cell-issue').forEach(el=>el.classList.remove('v3338-cell-issue'));
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
  if(!r){
   const issues=pending.get(sid)||[];
   label.textContent=issues.length?issues.map(i=>(i.label?i.label+': ':'')+i.reason).join(' · '):excluded.get(sid)||'Nicht in dieser Vergleichsgruppe';
   label.classList.remove('v3320-near');label.classList.toggle('v3338-flag',!!issues.length);
   for(const i of issues){
    const target=[...row.querySelectorAll('[data-v210-grid-score],[data-v3316-score],[data-v337-part],[data-v3316-bonus]')].find(el=>[el.dataset.v210GridScore,el.dataset.v3316Score,el.dataset.v337Part,el.dataset.v3316Bonus].includes(sid+'|'+i.itemId));
    if(target)target.closest('td')?.classList.add('v3338-cell-issue');
   }
   continue;
  }
  label.classList.remove('v3338-flag');
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
  done:result.done,pending:result.pending,excluded:result.excluded,bad:badText(result),
  close:result.close,average:decimal(result.averageGrade)
 })){
  const el=root.querySelector('[data-v3320-'+field+']');if(el)el.textContent=value;
 }
 const pct=root.querySelector('[data-v3338-pct]');if(pct)pct.textContent=result.average===null?'–':percent(result.average);
 const quote=root.querySelector('[data-v3338-quote]');if(quote)quote.textContent=statusText(result);
 for(const [selector,markup] of [['[data-v3338-diagnostics]',diagnosticMarkup(result)],['[data-v3338-tasks]',taskMarkup(result)]]){
  const target=root.querySelector(selector);if(target){const opened=[...target.querySelectorAll('details')].map(d=>d.open);target.innerHTML=markup;[...target.querySelectorAll('details')].forEach((d,i)=>{if(opened[i]!==undefined)d.open=opened[i];});}
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
 const assessedIds=new Set(draft.analysis.items.filter(it=>
  core.mode(it)!=='bonus'&&core.max(it)-
   (core.mode(it)==='partial'?Number(it.partialBonusV267?.max)||0:0)>0)
  .map(it=>it.competencyId));
 const missingCompetences=(draft.analysis.competencies||[]).filter(comp=>
  !assessedIds.has(comp.id));
 const modeText=core.mode(draft.item)==='bonus'?'vollständig Bonus':
  core.mode(draft.item)==='partial'?'teilweise Bonus':'regulär';
 const text='Aufgabe „'+(draft.item.label||id)+'“ als '+modeText+' werten?\n'+
  'Reguläre Maximalpunkte danach: '+core.fmt(draft.regularMax)+' P.\n'+
  'Vollständig bewertete Arbeiten: '+before.done+' → '+after.done+
  '\nNote 5/6: '+before.bad+' → '+after.bad+
  (missingCompetences.length?'\nAchtung: '+missingCompetences.map(c=>c.text||c.id).join(', ')+
    ' hat danach keine regulären Aufgaben mehr (nur Bonus).':'')+
  '\n\nDie Originalwerte und bisherigen individuellen Punkte bleiben erhalten.';
 if(!confirm(text))return;
 saving=true;
 try{
  await flushScores();
  if(kind()!==current||exam()?.id!==a?.id||
   JSON.stringify(currentAnalysis())!==JSON.stringify(oldAnalysis))
   throw Error('Die Prüfungsfassung wurde zwischenzeitlich verändert. Bitte erneut prüfen.');
  if(current==='standard'){
   const oldItems=a.evaluationV200.analysis.items;
   const selection=a.competencySelectionV204;
   const previousReview=selection?.teacherReviewedV205;
   a.evaluationV200.analysis.items=draft.analysis.items;
   // Exactly as the existing Step-3 global bonus editor: a changed
   // competence weighting must be explicitly reviewed again.
   if(selection)selection.teacherReviewedV205=false;
   try{await saveState();}
   catch(error){
    a.evaluationV200.analysis.items=oldItems;
    if(selection)selection.teacherReviewedV205=previousReview;
    throw error;
   }
  }else{
   const file=currentFile();
   if(!file||file.key!==current)throw Error('Prüfungsfassung nicht mehr verfügbar.');
   const next=structuredClone(priv());
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
 if(liveObserver){liveObserver.disconnect();liveObserver=null;}
 oldWire();
 if(view!=='evaluation'||v200Eval?.step!==4||!document.querySelector('.v3320-overview'))return;
 for(const el of document.querySelectorAll('[data-v3320-edit]'))
  el.addEventListener('click',()=>openEditor(el.dataset.v3320Edit));
 refresh(stats(currentAnalysis()),false);
 document.querySelector('.v3320-overview')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-v3338-jump]');if(!b)return;
  const sid=b.dataset.v3338Jump,id=b.dataset.v3338Item,key=sid+'|'+id,field=b.dataset.v3338Field;
  const els=[...document.querySelectorAll('[data-v210-grid-score],[data-v3316-score],[data-v337-part],[data-v3316-bonus]')];
  const target=(field==='bonus'?els.find(el=>el.dataset.v337Part===key||el.dataset.v3316Bonus===key):null)||
    els.find(el=>el.dataset.v210GridScore===key||el.dataset.v3316Score===key)||
    [...document.querySelectorAll('[data-v210-participation]')].find(el=>el.dataset.v210Participation===sid);
  if(target){target.scrollIntoView({block:'center',inline:'center'});target.focus();if(target.readOnly)target.click();}
  else alert('Bitte Prüfungszuordnung bzw. Aufgabenplan in Schritt 1 oder 3 prüfen.');
 });
 // Autosave modules update the point/bonus result text after the private write.
 // Observe those narrow status nodes only, never the whole document, to avoid
 // recursive refreshes or rerendering/scoll jumps.
 const targets=[...document.querySelectorAll('[data-v281-result],[data-v3316-result],#v221-save-status,#v281-status')];
 const observer=liveObserver=new MutationObserver(()=>{
  if(view==='evaluation'&&v200Eval?.step===4&&!active)
   refresh(stats(currentAnalysis()),false);
 });
 for(const node of targets)observer.observe(node,{childList:true,characterData:true,subtree:true});
// Participation changes are handled by the existing page rerender.
};
window.SchulcockpitGradeMirrorV3320={stats,propose};
render();
})();
