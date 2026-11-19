/* Schulcockpit V0.33.3 – guided evaluation without changing existing import formats. */
(function(){
'use strict';
const core=window.SchulcockpitEvalGuideCoreV333;
if(!core)return;
let listTab='active',rubricTab='standard',editing=false;
const grade=a=>typeof v202Grade==='function'?v202Grade(cls(a.classId)):0;
const exam=()=>typeof v200Assessment==='function'?v200Assessment(v200Eval?.assessmentId):null;
const fmt=n=>Number.isFinite(Number(n))?String(Number(n)).replace('.',','):'–';
const escapeText=s=>esc(String(s??''));
function create(tag,className,html){
 const el=document.createElement(tag);
 if(className)el.className=className;
 if(html!==undefined)el.innerHTML=html;
 return el;
}
function button(text,attr,clsName='secondary'){
 return '<button type="button" class="'+clsName+'" '+attr+'>'+escapeText(text)+'</button>';
}
function boxWith(title,content,open=false){
 return '<details class="v333-extra" '+(open?'open':'')+'><summary>'+title+'</summary><div class="v333-extra-body">'+content+'</div></details>';
}
function countResults(priv){
 return (priv?.roster||[]).filter(st=>
  ['scores','paperScores','bonusScores'].some(field=>
   Object.values(priv?.[field]?.[st.id]||{}).some(x=>x!==null&&x!==undefined&&x!==''))).length;
}
function planRows(a){
 const an=a?.evaluationV200?.analysis;
 if(!an?.items?.length)return '';
 const rows=an.items.map(it=>{
  const x=core.effective(it),m=x.mode,original=m==='original_bonus';
  const choices=[['regular','Regulär'],['bonus','Komplett Bonus'],['partial','Teilweise Bonus']];
  const select=original?
    '<span class="v333-fixed">Ursprüngliche Bonusaufgabe</span>':
    '<select class="v333-mode" data-v333-mode="'+escapeText(it.id)+'" aria-label="Wertung für '+escapeText(it.label||it.id)+'">'+
    choices.map(([v,t])=>'<option value="'+v+'" '+(m===v?'selected':'')+'>'+t+'</option>').join('')+'</select>';
  return '<tr data-v333-row="'+escapeText(it.id)+'"><td><strong>'+escapeText(it.label||it.id)+'</strong>'+
    '<small>Original: '+fmt(x.original)+' P · '+(String(it.source).startsWith('paper')?'Papier':'Classtime')+'</small></td>'+
    '<td><strong>'+fmt(x.regular)+'</strong></td><td><strong>'+fmt(x.bonus)+'</strong></td>'+
    '<td><span class="v333-current-mode">'+
      (m==='partial'?'Teilbonus'+(x.description?' · '+escapeText(x.description):''):
        m==='bonus'||m==='original_bonus'?'Bonus':'Regulär')+'</span>'+
    '<div class="v333-edit-mode" hidden>'+select+
    (!original?'<div class="v333-part-inputs" '+(m==='partial'?'':'hidden')+'>'+
      '<label>Bonuspunkte<input type="number" min="0.25" step="0.25" data-v333-part="'+escapeText(it.id)+'" value="'+(m==='partial'?escapeText(it.partialBonusV267.max):'')+'"></label>'+
      '<label>Lücken / Teilaufgabe<input data-v333-label="'+escapeText(it.id)+'" maxlength="150" value="'+(m==='partial'?escapeText(it.partialBonusV267.description||''):'')+'" placeholder="z. B. Lücken 2, 6, 9"></label>'+
      button('Teilbonus speichern','data-v333-part-save="'+escapeText(it.id)+'"','secondary')+
    '</div>':'')+'</div></td></tr>';
 }).join('');
 const t=core.totals(an.items),special=(a.files||[]).filter(f=>
  ['inclusion','inclusion_makeup','alternative'].includes(f.roleV316));
 return '<section class="v333-guide"><div class="v333-guide-header"><div><span class="eyebrow">AUFGABEN UND WERTUNG</span>'+
  '<h3>So wird diese Arbeit bewertet</h3></div><div class="v333-totals"><strong>'+fmt(t.regular)+' regulär</strong>'+
  '<span>+ '+fmt(t.bonus)+' Bonus möglich</span></div></div>'+
  '<p class="v333-short-help">Hier steht die tatsächliche Wertung. Die ursprünglichen Classtime-Punkte bleiben erhalten.</p>'+
  '<div class="v333-compact-scroll"><table class="v333-compact-table"><thead><tr><th>Aufgabe</th>'+
  '<th>Regulär</th><th>Bonus</th><th>Wertung</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
  '<label class="v333-question"><input type="checkbox" data-v333-adjust> Musst du nachträglich Bonuspunkte ändern?</label>'+
  '<p class="v333-short-help v333-adjust-tip" hidden>Wähle die betroffene Aufgabe aus. Änderungen der regulären Höchstpunktzahl werden vor dem Speichern bestätigt.</p>'+
  (special.length?boxWith('Gibt es eine andere Prüfungsfassung? · '+special.length+' vorhanden',
    '<p>Die Inklusions- und Nachschreibarbeiten haben eigene Aufgaben- und Punkteraster.</p>'+
    button('Eigenes Bewertungsraster öffnen','data-v333-rubrics')):'')+
  '</section>';
}
const earlierStep3=v200Step3;
v200Step3=function(a,priv){
 const html=earlierStep3(a,priv);
 if(!a?.evaluationV200?.analysis?.items?.length)return html;
 const root=create('div','',html);
 const flow=root.querySelector('.v218-flow');
 const plan=flow?.querySelector('[data-v218-stage="plan"]');
 if(!plan)return html;
 const body=plan.querySelector('.v218-stage-content');
 const original=body?.querySelector('.v210-scroll');
 if(!body||!original)return html;
 const table=original.outerHTML;
 original.remove();
 const notes=body.querySelector(':scope > p');
 if(notes)notes.remove();
 const legacyActions=body.querySelector('.v200-actions');
 let addButtons='',saveButton='';
 if(legacyActions){
  for(const b of [...legacyActions.querySelectorAll('button')]){
    const isSave=b.hasAttribute('data-v218-save-plan');
    if(isSave)saveButton=b.outerHTML;
    else addButtons+=b.outerHTML;
  }
  legacyActions.remove();
 }
 const advanced=boxWith('Musst du ursprüngliche Aufgabenpunkte oder die Quelle korrigieren?',
    '<p>Zum Beispiel Frage 6 von 10 auf 6 Punkte. Bereits importierte Einzelpunkte dürfen das neue Maximum nicht überschreiten; die Zuordnung zur Excel muss anschließend geprüft werden.</p>'+
    table+saveButton);
 const adding=boxWith('Hast du zusätzliche Papier- oder Classtime-Aufgaben?',
    '<p>Nur nötig, wenn Aufgaben in der importierten Analyse fehlen.</p><div class="v333-add-actions">'+addButtons+'</div>');
 body.insertAdjacentHTML('afterbegin',planRows(a)+adding+advanced);
 const oldPanels=[...root.querySelectorAll('.v260-reclass,.v267-global')];
 if(oldPanels.length){
  const wrapper=create('div','v333-legacy',boxWith('Weitere Bewertungsoptionen (bisherige Bedienung)',
    '<p>Die bisherigen Einzelregeln bleiben erreichbar. Änderungen wirken auf dieselben gespeicherten Aufgaben.</p>'));
  const slot=wrapper.querySelector('.v333-extra-body');
  for(const panel of oldPanels){panel.remove();slot.append(panel);}
  flow.parentNode.insertBefore(wrapper,flow);
 }
 const progress=root.querySelector('.v216-progress');
 if(progress){
  const stateText=progress.querySelector('#v216-save-state')?.outerHTML||'';
  progress.innerHTML='<strong>Speicherstatus</strong> '+stateText;
  progress.classList.add('v333-progress');
 }
 const summary=root.querySelector('.v300-summary');
 if(summary){
  const wrap=create('div','v333-history');
  wrap.innerHTML=boxWith('Bisherige Korrektur und fertige Bögen ansehen',summary.outerHTML);
  summary.replaceWith(wrap);
 }
 const makeup=root.querySelector('.v300-section');
 if(makeup){
  const imports=priv?.makeupBatchesV300?.length||0;
  const wrap=create('div','v333-makeup');
  wrap.innerHTML=boxWith('Stehen Nachschreibende aus oder möchtest du Excel-Ergebnisse ergänzen?'+
    (imports?' · '+imports+' Import(e)':''),
    '<p>Weitere Excel-Dateien ergänzen die fehlenden Kinder. Vorhandene Bewertungen bleiben unverändert.</p>'+
    makeup.outerHTML);
  makeup.replaceWith(wrap);
 }
 const intro=root.querySelector('.v218-flow-intro');
 if(intro){
  const heading=intro.querySelector('h3');
  if(heading)heading.textContent='Schritt für Schritt zu den Ergebnissen';
  const explanation=intro.querySelector('p:not([id])');
  if(explanation)explanation.textContent='Öffne nur die Bereiche, die du gerade brauchst. Deine Eingaben bleiben erhalten.';
 }
 return root.innerHTML;
};
const earlierStep2=v200Step2;
v200Step2=function(a,priv){
 const html=earlierStep2(a,priv);
 const root=create('div','',html),special=root.querySelector('.v317-rubrics');
 if(!special)return html;
 special.remove();
 const spec=boxWith('Aufgaben der Sonderfassung',special.outerHTML,true);
 return '<section class="v333-tabs"><div class="v333-tabbar" role="group" aria-label="Prüfungsfassung">'+
 button('Reguläre Arbeit','data-v333-rubric-tab="standard"',rubricTab==='standard'?'primary':'secondary')+
 button('Inklusion / andere Fassung','data-v333-rubric-tab="special"',rubricTab==='special'?'primary':'secondary')+
 '</div><div data-v333-rubric-panel="standard" '+(rubricTab==='standard'?'':'hidden')+'>'+root.innerHTML+'</div>'+
 '<div data-v333-rubric-panel="special" '+(rubricTab==='special'?'':'hidden')+'>'+spec+'</div></section>';
};
const oldList=v214AssessmentList;
v214AssessmentList=function(){
 const root=create('div','',oldList()),panel=root.querySelector('.v214-index > .panel');
 if(!panel)return root.innerHTML;
 const rows=[...panel.querySelectorAll('.v214-assessment-card')];
 if(!rows.length)return root.innerHTML;
 const active=[],archive=[];
 for(const row of rows){
  const id=row.querySelector('[data-v214-open]')?.getAttribute('data-v214-open');
  const a=(state.assessments||[]).find(x=>x.id===id);
  if(!a)continue;
  const actions=row.querySelector('.v214-list-actions');
  if(actions){
   actions.insertAdjacentHTML('beforeend',
    core.returned(a)?
      button('Zurück in Bearbeitung','data-v333-return="'+escapeText(id)+'"'):
      button('Zurückgegeben · archivieren','data-v333-archive="'+escapeText(id)+'"'));
  }
  if(core.returned(a)){
   row.classList.add('v333-archived-card');
   row.querySelector('.eyebrow')?.insertAdjacentHTML('beforeend',' · zurückgegeben');
   archive.push(row);
  }else active.push(row);
  row.remove();
 }
 const head=panel.querySelector('.section-head');
 const tabs=create('div','v333-archive-tabs',
  button('In Bearbeitung ('+active.length+')','data-v333-filter="active"',listTab==='active'?'primary':'secondary')+
  button('Archiv ('+archive.length+')','data-v333-filter="archive"',listTab==='archive'?'primary':'secondary'));
 if(head)head.insertAdjacentElement('afterend',tabs);else panel.prepend(tabs);
 const area=create('div','v333-visible-list');
 const current=listTab==='archive'?archive:active;
 if(!current.length)area.innerHTML='<p class="muted">'+
   (listTab==='archive'?'Noch keine zurückgegebenen Arbeiten archiviert.':'Keine offenen Klassenarbeiten. 🎉')+'</p>';
 else for(const item of current)area.append(item);
 tabs.insertAdjacentElement('afterend',area);
 return root.innerHTML;
};
const oldWorkspace=v214EvaluationPage;
v214EvaluationPage=function(){
 const html=oldWorkspace(),a=exam();
 if(!a)return html;
 const root=create('div','',html),head=root.querySelector('.v214-workspace-head');
 if(head){
  head.insertAdjacentHTML('beforeend',core.returned(a)?
   button('Zurück in Bearbeitung','data-v333-return="'+escapeText(a.id)+'"'):
   button('Zurückgegeben · archivieren','data-v333-archive="'+escapeText(a.id)+'"'));
 }
 return root.innerHTML;
};
async function setReturned(id,value){
 if(editing)return;
 const a=(state.assessments||[]).find(x=>x.id===id);
 if(!a)throw Error('Prüfung nicht gefunden.');
 if(value&&!confirm('Die Arbeit als zurückgegeben markieren und aus der aktiven Auswertung ausblenden? Alle Bewertungen, Dateien und Nachschreibimporte bleiben erhalten.'))return;
 const previous=a.evaluationUXV333===undefined?undefined:structuredClone(a.evaluationUXV333);
 editing=true;
 try{
  a.evaluationUXV333={...(a.evaluationUXV333||{})};
  if(value)a.evaluationUXV333.returnedAt=new Date().toISOString();
  else delete a.evaluationUXV333.returnedAt;
  await saveState();
  if(value){listTab='active';view='evaluations';}
  render();
 }catch(err){
  if(previous===undefined)delete a.evaluationUXV333;
  else a.evaluationUXV333=previous;
  throw err;
 }finally{editing=false;}
}
async function saveBonusMode(id,mode,part,description){
 if(editing)return;
 const a=exam(),an=a?.evaluationV200?.analysis;
 if(!an)throw Error('Prüfungsanalyse fehlt.');
 if(a.itemDraftV216)throw Error('Im ursprünglichen Aufgabenplan ist noch ein Entwurf offen. Bitte zuerst die ursprünglichen Punkte kontrollieren und speichern.');
 const previous=an.items;
 const next=core.adjust(an.items,id,mode,part,description);
 const total=core.totals(next);
 if(!confirm('Neue Wertung speichern?\nReguläre Höchstpunktzahl: '+fmt(total.regular)+
   ' Punkte; mögliche Bonuspunkte: '+fmt(total.bonus)+
   '.\nBereits importierte Classtime-Rohpunkte bleiben unverändert.')){render();return;}
 const reviewed=a.competencySelectionV204?.teacherReviewedV205;
 editing=true;
 try{
  an.items=next;
  if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=false;
  await saveState();render();
 }catch(err){
  an.items=previous;
  if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=reviewed;
  throw err;
 }finally{editing=false;}
}
const oldWire=wire;
wire=function(){
 oldWire();
 if(view==='evaluations'||view==='evaluation'){
  document.querySelectorAll('[data-v333-filter]').forEach(b=>b.onclick=()=>{
   listTab=b.dataset.v333Filter==='archive'?'archive':'active';render();
  });
  document.querySelectorAll('[data-v333-archive]').forEach(b=>b.onclick=()=>{
   void setReturned(b.dataset.v333Archive,true).catch(e=>alert('Archivierung fehlgeschlagen: '+(e.message||e)));
  });
  document.querySelectorAll('[data-v333-return]').forEach(b=>b.onclick=()=>{
   void setReturned(b.dataset.v333Return,false).catch(e=>alert('Wiederherstellung fehlgeschlagen: '+(e.message||e)));
  });
 }
 if(view!=='evaluation'||!v200Eval)return;
 document.querySelectorAll('[data-v333-rubric-tab]').forEach(b=>b.onclick=()=>{
  rubricTab=b.dataset.v333RubricTab==='special'?'special':'standard';
  document.querySelectorAll('[data-v333-rubric-panel]').forEach(panel=>{
    panel.hidden=panel.dataset.v333RubricPanel!==rubricTab;
  });
  document.querySelectorAll('[data-v333-rubric-tab]').forEach(btn=>{
    btn.classList.toggle('primary',btn.dataset.v333RubricTab===rubricTab);
    btn.classList.toggle('secondary',btn.dataset.v333RubricTab!==rubricTab);
  });
 });
 document.querySelectorAll('[data-v333-rubrics]').forEach(b=>b.onclick=()=>{
  rubricTab='special';v200Eval.step=2;render();
 });
 if(v200Eval.step!==3)return;
 const adjust=document.querySelector('[data-v333-adjust]');
 if(adjust){
  const setup=()=>{
   document.querySelectorAll('.v333-edit-mode').forEach(el=>{el.hidden=!adjust.checked;});
   const tip=document.querySelector('.v333-adjust-tip');
   if(tip)tip.hidden=!adjust.checked;
  };
  adjust.onchange=setup;setup();
 }
 document.querySelectorAll('[data-v333-mode]').forEach(select=>select.onchange=()=>{
  const row=select.closest('[data-v333-row]'),mode=select.value;
  const parts=row?.querySelector('.v333-part-inputs');
  if(parts)parts.hidden=mode!=='partial';
  if(mode==='partial')return;
  void saveBonusMode(select.dataset.v333Mode,mode).catch(e=>{
   alert('Wertung nicht gespeichert: '+(e.message||e));render();
  });
 });
 document.querySelectorAll('[data-v333-part-save]').forEach(b=>b.onclick=()=>{
  const id=b.dataset.v333PartSave;
  const row=[...document.querySelectorAll('[data-v333-row]')].find(x=>x.dataset.v333Row===id);
  const points=row?.querySelector('[data-v333-part]')?.value;
  const description=row?.querySelector('[data-v333-label]')?.value;
  void saveBonusMode(id,'partial',points,description).catch(e=>{
   alert('Bonuslücken nicht gespeichert: '+(e.message||e));
  });
 });
};
const oldRender=render;
render=function(){
 oldRender();
 const label=document.querySelector('.brand small');
 if(label)label.textContent=(state.settings?.schoolYear||'')+' · V0.33.3';
};
window.SchulcockpitEvalGuideV333={setReturned,saveBonusMode};
render();
})();