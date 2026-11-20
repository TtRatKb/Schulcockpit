/* V0.33.16 – one correction-table component for regular and special files.
 * Rendering reuses V221's established matrix. Events are separately validated
 * against V317's confirmed file key, never against the regular-paper rubric.
 */
(function(){
'use strict';
const core=window.SchulcockpitVariantMatrixV3316Core;
const scoresCore=window.SchulcockpitInclusionBonusV3313Core;
const gaps=window.SchulcockpitBonusGapsV337;
if(!core||!scoresCore||!gaps||typeof v221CompactTable!=='function')return;
const safe=x=>esc(String(x??''));
const exam=()=>v200Assessment(v200Eval?.assessmentId);
const data=()=>v200Eval?.privateData;
const current=()=>window.SchulcockpitExamTabsV338?.activeKind?.(exam())||'standard';
const file=()=>window.SchulcockpitExamTabsV338?.available?.(exam())?.find(f=>f.key===current());
const select=(p,s)=>window.SchulcockpitExamAnalysisV317?.select?.(p,s);
const itemFor=(p,key,id)=>p?.variantAnalysesV317?.[key]?.items?.find(it=>it.id===id);
let queue=Promise.resolve(),busy=false;
const timers=new WeakMap();
function enqueue(fn){
 const pending=queue.then(fn);queue=pending.catch(()=>{});
 return pending;
}
function notice(message,kind='note'){
 const el=document.querySelector('.v338-section #v221-save-status');
 if(el){el.textContent=message;el.dataset.kind=kind;el.setAttribute('role',kind==='error'?'alert':'status');}
}
function key(sid,itemId){return sid+'|'+itemId;}
function availableScores(){
 return [...document.querySelectorAll('.v338-section [data-v3316-score]')];
}
function components(sid){
 const root=document.querySelector('.v338-section .v3316-matrix');
 if(!root)return {scores:[],bonus:[]};
 return {
  scores:[...root.querySelectorAll('[data-v3316-score]')].filter(el=>el.dataset.v3316Score.startsWith(sid+'|')),
  bonus:[...root.querySelectorAll('[data-v3316-part]')].filter(el=>el.dataset.v3316Part.startsWith(sid+'|'))
 };
}
function warnError(error,input){
 notice('Nicht gespeichert: '+(error?.message||error)+'. Bitte die Eingabe prüfen.','error');
 input?.classList.add('v210-error');
 input?.focus?.({preventScroll:true});
}
function gapHtml(p,student,it,total){
 const change=p.gradingOverridesV267?.[student.id]?.[it.id]||{};
 if(!gaps.isSplit(it,change))return '';
 const bound=gaps.bounds(it,total,change),old=change.bonusEarned,
  prior=old===null||old===undefined?'':String(old),valid=gaps.eligible(it,total,old,change);
 const opts=bound.ready?gaps.options(bound,gaps.stepFor(it)):[];
 const hasOld=prior!==''&&!opts.some(n=>String(n)===prior);
 const title=it.partialBonusV267?.description||'Bonuslücken';
 return '<div class="v337-gap '+(prior!==''&&valid?'v337-done':hasOld?'v337-invalid':'')+'" data-v3316-gap="'+safe(key(student.id,it.id))+'">'+
  '<label class="v337-gap-label"><span>Davon Bonus · '+safe(title)+'</span>'+
  '<select data-v3316-part="'+safe(key(student.id,it.id))+'"'+(bound.ready?'':' disabled')+
   ' aria-label="'+safe(student.name+' · '+(it.label||it.id)+' · davon Bonus')+'">'+
  '<option value=""'+(prior===''?' selected':'')+'>– prüfen –</option>'+
  (hasOld?'<option value="'+safe(prior)+'" selected>⚠ '+safe(prior)+' erneut prüfen</option>':'')+
  opts.map(n=>'<option value="'+n+'"'+(String(n)===prior?' selected':'')+'>'+
   safe(String(n).replace('.',','))+' / '+safe(bound.part)+'</option>').join('')+
  '</select></label><small class="v337-status">'+
  (bound.ready?prior!==''&&valid?'Erfasst: '+safe(Number(total)-Number(old))+' regulär + '+
   safe(old)+' Bonus':'Bonuslücken noch prüfen':'Gesamtpunkte zuerst eintragen')+'</small></div>';
}
function decorate(fileInfo,p,students,html){
 const root=document.createElement('div');root.innerHTML=html;
 const table=root.querySelector('table.v221-matrix');
 if(!table)return html;
 const rubric=p.variantAnalysesV317?.[fileInfo.fileKey];
 if(!rubric)return html;
 const items=rubric.items,byId=new Map(students.map(s=>[s.id,s]));
 const headers=[...table.querySelectorAll('thead th.v221-head')];
 headers.forEach((head,i)=>{
  const it=items[i];if(!it)return;
  const meta=core.taskDisplay(it);
  const small=head.querySelector('small');
  if(small)small.textContent=meta.label;
  if(meta.mode==='bonus'){
   head.classList.add('v221-ct-bonus','v3316-bonus-head');
   head.title=(it.label||it.id)+' · vollständig Bonus (gespeicherte Aufgabenregel)';
  }else if(meta.mode==='partial'){
   head.classList.add('v3316-partial-head');
   head.title=(it.label||it.id)+' · '+meta.regularMax+' reguläre und '+
    meta.bonusMax+' mögliche Bonuspunkte · '+(it.partialBonusV267.description||'');
  }
 });
 for(const row of table.querySelectorAll('tbody tr')){
  const cell=row.querySelector('[data-v210-grid-score]');
  const raw=cell?.getAttribute('data-v210-grid-score')||'',pos=raw.indexOf('|');
  if(pos<0)continue;
  const sid=raw.slice(0,pos),student=byId.get(sid);
  if(!student)continue;
  const picker=row.querySelector('[data-v210-participation]');
  if(picker){
   const tag=document.createElement('small');
   tag.className='v3316-participant';
   tag.textContent='Diese Prüfungsfassung';
   picker.replaceWith(tag);
  }
  const result=v200StudentReport(p,rubric,student);
  const label=document.createElement('span');
  label.className='v281-person-result';
  label.dataset.v3316Result=sid;
  label.textContent=core.summary(result);
  row.querySelector('.v221-person')?.append(label);
  for(const td of row.querySelectorAll('td.v221-cell')){
   const input=td.querySelector('[data-v210-grid-score]');
   if(!input)continue;
   const pair=input.getAttribute('data-v210-grid-score'),sep=pair.indexOf('|'),
    it=items.find(x=>x.id===pair.slice(sep+1));
   if(!it)continue;
   input.removeAttribute('data-v210-grid-score');
   input.setAttribute('data-v3316-score',pair);
   input.dataset.v3316Saved=input.value.trim();
   input.removeAttribute('disabled');
   const mode=core.taskMode(it);
   const currentOverride=p.gradingOverridesV267?.[sid]?.[it.id]?.mode||'default';
   if(mode==='bonus') {
    td.classList.add('v281-cell-bonus');
    td.insertAdjacentHTML('beforeend','<span class="v281-static-bonus">★ Bonus</span>');
   } else {
    const selected=currentOverride==='bonus',excluded=currentOverride==='exclude';
    const button='<button type="button" data-v3316-toggle="'+safe(pair)+'" class="v281-bonus-toggle'+
      (selected?' is-bonus':'')+(excluded?' is-excluded':'')+'" aria-pressed="'+selected+'"'+
      ' title="'+safe(selected?'Individuelle Bonuswertung zurücknehmen':'Nur für dieses Kind als Bonus werten')+'">'+
      (selected?'★ Bonus':excluded?'–':'☆ Bonus')+'</button>';
    td.insertAdjacentHTML('beforeend',button);
    if(selected)td.classList.add('v281-cell-bonus');
    if(mode==='partial'&&!selected&&!excluded)
      td.insertAdjacentHTML('beforeend',gapHtml(p,student,it,v200GetScore(p,sid,it)));
   }
  }
 }
 const heading=root.querySelector('.v221-score-section > h3');
 if(heading)heading.textContent='4. Punkte korrigieren – '+(fileInfo.role==='inclusion'?'Inklusionsarbeit':'eigene Prüfungsfassung');
 const intro=root.querySelector('.v221-score-section > .microcopy');
 if(intro)intro.textContent='Gleiche Korrekturmatrix wie bei der regulären Arbeit – aber nur die Kinder, Aufgaben und Bonusregeln dieser Fassung. ★ = Bonus; ☆ = hier individuell als Bonus werten. Classtime-Punkte zum Ändern anklicken. Enter speichert und springt zum nächsten offenen Feld.';
 const wrapper=root.querySelector('.v221-score-section');
 if(wrapper)wrapper.classList.add('v3316-matrix');
 return root.innerHTML;
}
function render(fileInfo,p,assigned){
 const rubric=p?.variantAnalysesV317?.[fileInfo?.fileKey];
 if(!rubric?.items?.length)return '<p class="v338-notice">Erst das eigene Aufgabenraster dieser Fassung in Schritt 2 speichern.</p>';
 const students=core.eligibleRows(fileInfo,p,assigned,select);
 if(!students.length)return '<p class="v338-notice">Keine freigegebenen Teilnehmenden. Erst die Zuordnung in Schritt 1 oder hier oben bestätigen.</p>';
 const fakeExam={...exam(),evaluationV200:{...(exam()?.evaluationV200||{}),analysis:rubric}};
 const attendance={...(p.participationV210||{})};
 for(const st of students)attendance[st.id]='present';
 const fakePrivate={...p,roster:students,participationV210:attendance};
 const grid=v221CompactTable(fakeExam,fakePrivate);
 const bonusCount=rubric.items.filter(it=>core.taskMode(it)==='bonus').length,
  splitCount=rubric.items.filter(it=>core.taskMode(it)==='partial').length;
 return '<div class="v3316-summary"><strong>'+students.length+' Kind(er) · '+
   rubric.items.length+' Aufgaben</strong> · '+bonusCount+' vollständig Bonus · '+
   splitCount+' mit Bonusanteil. <span>Die Spalten zeigen die zuletzt gespeicherten Regeln.</span></div>'+
   decorate(fileInfo,p,students,grid);
}
function dirty(){
 return availableScores().some(el=>el.value.trim()!==el.dataset.v3316Saved)||
  [...document.querySelectorAll('[data-v3316-part]')].some(el=>
   el.value!==el.dataset.v3316Saved);
}
function inputFor(sid,itemId){
 return availableScores().find(el=>el.dataset.v3316Score===key(sid,itemId));
}
function syncBonus(sid,itemId){
 const p=data(),f=file(),it=itemFor(p,f?.fileKey,itemId),student=p?.roster?.find(st=>st.id===sid);
 if(!it||!student)return;
 const existing=[...document.querySelectorAll('[data-v3316-gap]')].find(el=>el.dataset.v3316Gap===key(sid,itemId));
 if(!existing)return;
 const source=inputFor(sid,itemId),prior=existing.querySelector('[data-v3316-part]')?.value||'';
 const temp=document.createElement('div');
 temp.innerHTML=gapHtml(p,student,it,source?.value);
 const next=temp.firstElementChild;
 if(!next)return;
 const choice=next.querySelector('[data-v3316-part]');
 if(choice&&prior&&[...choice.options].some(o=>o.value===prior)){
  choice.value=prior;
 }else if(choice&&prior&&!choice.disabled){
  choice.add(new Option('⚠ '+prior+' erneut prüfen',prior,true,true));
 }
 existing.replaceWith(next);
 choice?.addEventListener('change',()=>void enqueue(()=>saveRow(sid,choice)).catch(err=>warnError(err,choice)));
}
function rowModel(sid){
 const f=file(),p=data(),st=p?.roster?.find(x=>x.id===sid);
 if(!f||!p||!st)throw Error('Bitte zunächst die richtige Prüfungsfassung auswählen.');
 const selection=select(p,st),rubric=core.ensureTarget(p,sid,f.fileKey,selection);
 const nodes=components(sid);
 if(nodes.scores.length!==rubric.items.length)throw Error('Korrekturtabelle ist nicht vollständig. Bitte neu öffnen.');
 const marks={},bonuses={};
 for(const it of rubric.items){
  const input=nodes.scores.find(el=>el.dataset.v3316Score===key(sid,it.id));
  if(!input)throw Error('Aufgabenspalte fehlt: '+(it.label||it.id));
  marks[it.id]=input.value;
  const choice=nodes.bonus.find(el=>el.dataset.v3316Part===key(sid,it.id));
  if(choice)bonuses[it.id]=choice.value;
 }
 return {f,p,st,rubric,nodes,marks,bonuses};
}
async function saveRow(sid,focus){
 const {f,p,st,rubric,nodes,marks,bonuses}=rowModel(sid);
 const changes=nodes.scores.some(el=>el.value.trim()!==el.dataset.v3316Saved)||
  nodes.bonus.some(el=>el.value!==el.dataset.v3316Saved);
 if(!changes)return true;
 const next=scoresCore.applyMarks(p,sid,rubric.items,marks,bonuses);
 // Avoid persisting an unrelated/stale version when a tab was changed.
 if(current()!==f.key||data()!==p)throw Error('Die Korrekturansicht hat sich verändert. Bitte erneut prüfen.');
 await v200PrivatePut(next);
 if(v200Eval?.assessmentId===exam()?.id)v200Eval.privateData=next;
 for(const el of nodes.scores){el.dataset.v3316Saved=el.value.trim();el.classList.remove('v210-error','v221-empty');
  el.classList.add(el.value.trim()?'v221-filled':'v221-empty');
  if(el.dataset.v221Digital==='1'){el.readOnly=true;el.classList.remove('v221-unlocked');}
 }
 for(const el of nodes.bonus)el.dataset.v3316Saved=el.value;
 const r=v200StudentReport(next,rubric,st);
 const output=[...document.querySelectorAll('[data-v3316-result]')].find(el=>el.dataset.v3316Result===sid);
 if(output)output.textContent=core.summary(r);
 notice('✓ Punkte und Bonuswertungen für '+st.name+' lokal gespeichert.','success');
 return true;
}
function cancelTimer(input){
 const id=timers.get(input);if(id!==undefined){clearTimeout(id);timers.delete(input);}
}
async function flush(){
 const all=availableScores();for(const input of all)cancelTimer(input);
 const ids=[...new Set(all.map(el=>el.dataset.v3316Score.split('|')[0]))];
 for(const sid of ids){
  const ok=await enqueue(()=>saveRow(sid));
  if(!ok)return false;
 }
 return true;
}
async function toggle(sid,itemId){
 await flush();
 const p=data(),f=file(),st=p?.roster?.find(x=>x.id===sid);
 if(!p||!f||!st)throw Error('Prüfungsfassung fehlt.');
 const rubric=core.ensureTarget(p,sid,f.fileKey,select(p,st));
 const it=rubric.items.find(x=>x.id===itemId);
 if(!it||core.taskMode(it)==='bonus')throw Error('Diese Aufgabe ist bereits für die gesamte Fassung Bonus.');
 const next=structuredClone(p);next.gradingOverridesV267={...(next.gradingOverridesV267||{})};
 const old=next.gradingOverridesV267[sid]||{},entries={...old},value={...(entries[itemId]||{})};
 if(value.mode==='bonus')delete value.mode;
 else value.mode='bonus';
 if(Object.keys(value).length)entries[itemId]=value;else delete entries[itemId];
 if(Object.keys(entries).length)next.gradingOverridesV267[sid]=entries;
 else delete next.gradingOverridesV267[sid];
 await v200PrivatePut(next);
 v200Eval.privateData=next;
 render();
}
const beforeWire=wire;
wire=function(){
 beforeWire();
 if(view!=='evaluation'||v200Eval?.step!==4||current()==='standard')return;
 if(!document.querySelector('.v3316-matrix'))return;
 for(const input of availableScores()){
  const id=input.dataset.v3316Score,at=id.indexOf('|'),sid=id.slice(0,at),task=id.slice(at+1);
  if(input.dataset.v221Digital==='1'){
   input.readOnly=true;
   const unlock=()=>{if(input.readOnly){input.readOnly=false;input.classList.add('v221-unlocked');
    notice('Classtime-Wert entsperrt. Änderungen werden ausschließlich in dieser Prüfungsfassung gespeichert.');input.focus();input.select();}};
   input.addEventListener('click',unlock);
   input.addEventListener('keydown',e=>{
    if(e.key==='F2'||e.key===' '&&input.readOnly){e.preventDefault();unlock();}
   });
  }
  input.addEventListener('input',()=>{
   if(input.readOnly)return;
   cancelTimer(input);
   syncBonus(sid,task);
   notice('Speichere Punkte lokal …','progress');
   timers.set(input,setTimeout(()=>{
    timers.delete(input);void enqueue(()=>saveRow(sid,input)).catch(e=>warnError(e,input));
   },650));
  });
  input.addEventListener('change',()=>{
   cancelTimer(input);
   void enqueue(()=>saveRow(sid,input)).catch(e=>warnError(e,input));
  });
  input.addEventListener('blur',()=>{
   if(input.value.trim()!==input.dataset.v3316Saved){
    cancelTimer(input);void enqueue(()=>saveRow(sid,input)).catch(e=>warnError(e,input));
   }else if(input.dataset.v221Digital==='1'){input.readOnly=true;input.classList.remove('v221-unlocked');}
  });
  input.addEventListener('keydown',async e=>{
   if(e.key!=='Enter')return;
   e.preventDefault();cancelTimer(input);
   try{
    await enqueue(()=>saveRow(sid,input));
    const candidates=availableScores(),idx=candidates.indexOf(input);
    const next=candidates.slice(idx+1).concat(candidates.slice(0,idx)).find(el=>
      !el.disabled&&el.dataset.v221Digital!=='1'&&el.value.trim()==='');
    if(next){next.focus();next.select();}
    else notice('✓ Alle aktuell offenen Papier- und Bonusfelder bearbeitet.','success');
   }catch(err){warnError(err,input);}
  });
 }
 for(const input of document.querySelectorAll('[data-v3316-part]')){
  input.dataset.v3316Saved=input.value;
  input.addEventListener('change',()=>{
   const raw=input.dataset.v3316Part,at=raw.indexOf('|'),sid=raw.slice(0,at);
   void enqueue(()=>saveRow(sid,input)).catch(err=>warnError(err,input));
  });
 }
 for(const button of document.querySelectorAll('[data-v3316-toggle]')){
  button.addEventListener('click',()=>{
   const raw=button.dataset.v3316Toggle,at=raw.indexOf('|');
   void enqueue(()=>toggle(raw.slice(0,at),raw.slice(at+1))).catch(err=>warnError(err,button));
  });
 }
 // Do not navigate away from unresolved edits, but keep familiar V221 step controls.
 for(const button of document.querySelectorAll('.v3316-matrix [data-v200-step]')){
  const prior=button.onclick;
  button.onclick=async e=>{
   e.preventDefault?.();
   if(busy)return;
   busy=true;button.disabled=true;
   try{
    await flush();
    if(current()!=='standard')await prior?.call(button,e);
   }catch(err){warnError(err);}finally{busy=false;if(button.isConnected)button.disabled=false;}
  };
 }
};
window.SchulcockpitVariantMatrixV3316={render,dirty,flush};
render();
})();
