/* Schulcockpit V0.33.7 – bonus-gap points directly beneath each Classtime score.
 * Uses the existing private gradingOverridesV267 structure and V267 calculation.
 * No duplicate table, no import-score rewriting, no new schema for pupil records.
 */
(function(){
'use strict';
const core=window.SchulcockpitBonusGapsV337;
if(!core)return;
const safe=x=>esc(String(x??''));
const textNumber=n=>Number.isFinite(Number(n))?String(Number(n)).replace('.',','):'–';
const exam=()=>v200Assessment(v200Eval?.assessmentId);
const data=()=>v200Eval?.privateData;
const analysis=()=>exam()?.evaluationV200?.analysis;
const key=(student,item)=>student+'|'+item;
let busy=false;
function rawScore(p,student,item){return v200GetScore(p,student,item);}
function gapMarkup(p,student,item){
 const ch=p?.gradingOverridesV267?.[student.id]?.[item.id]||{};
 const raw=rawScore(p,student.id,item);
 const result=core.view(item,raw,ch.bonusEarned,ch);
 const b=result.bounds;
 const passive=(p.participationV210?.[student.id]||'present')!=='present';
 const options=core.options(b,core.stepFor(item)),saved=ch.bonusEarned;
 const validSaved=core.eligible(item,raw,saved,ch);
 const numericSaved=core.validNumber(saved);
 const label=item.partialBonusV267?.description||'Bonusanteil';
 const sid=safe(key(student.id,item.id));
 let html='<div class="v337-gap '+(result.state==='invalid'?'v337-invalid':
   result.state==='complete'?'v337-done':'')+'" data-v337-gap="'+sid+'">';
 if(!b.ready){
  html+='<span class="v337-gap-title">Davon Bonus · '+safe(b.part||item.partialBonusV267.max)+' P</span>'+
   '<small class="v337-status">Gesamtpunkte noch offen · zuerst diese eintragen</small></div>';
  return html;
 }
 html+='<label class="v337-gap-label"><span>Davon Bonus</span>'+
  '<select data-v337-part="'+sid+'"'+(passive?' disabled':'')+
  ' aria-label="'+safe(student.name+' · '+(item.label||item.id)+' · davon Bonuspunkte')+'">'+
  '<option value=""'+((saved===null||saved===undefined||saved==='')?' selected':'')+'>– prüfen –</option>';
 if(numericSaved!==null&&!validSaved)html+='<option value="'+safe(numericSaved)+
   '" selected>⚠ '+safe(textNumber(numericSaved))+' prüfen</option>';
 for(const n of options)html+='<option value="'+n+'"'+
   (validSaved&&Math.abs(n-Number(saved))<1e-9?' selected':'')+'>'+
   safe(textNumber(n))+' von '+safe(textNumber(b.part))+'</option>';
 html+='</select></label><span class="v337-status" role="status">'+
  (result.state==='complete'?safe(textNumber(result.regular)+' regulär + '+
   textNumber(result.bonus)+' Bonus'):
   result.state==='invalid'?'⚠ Bonusaufteilung passt nicht mehr zur Gesamtpunktzahl':
   'Bonuslücken noch prüfen')+'</span>';
 if(passive)html+='<small>Teilnahme offen</small>';
 return html+'</div>';
}
function progress(p,an){
 return core.count(an?.items||[],p?.roster||[],p,rawScore);
}
const oldStep=v200Step4;
v200Step4=function(a,p){
 const html=oldStep(a,p),an=a?.evaluationV200?.analysis;
 if(!an?.items?.some(item=>core.isSplit(item))||!p?.roster?.length)return html;
 const host=document.createElement('div');host.innerHTML=html;
 const matrix=host.querySelector('.v221-matrix');
 if(!matrix)return html;
 const items=new Map(an.items.map(item=>[item.id,item]));
 const students=new Map(p.roster.map(student=>[student.id,student]));
 const table=matrix.querySelector('tbody');
 let withGaps=0;
 for(const cell of table?.querySelectorAll('.v221-cell')||[]){
  const input=cell.querySelector('[data-v210-grid-score]');if(!input)continue;
  const raw=input.dataset.v210GridScore||'',sep=raw.indexOf('|');
  if(sep<0)continue;
  const student=students.get(raw.slice(0,sep)),item=items.get(raw.slice(sep+1));
  if(!student||!item||!core.isSplit(item,
    p.gradingOverridesV267?.[student.id]?.[item.id]))continue;
  cell.insertAdjacentHTML('beforeend',gapMarkup(p,student,item));
  withGaps++;
 }
 if(!withGaps)return html;
 const head=matrix.querySelector('thead tr');
 for(const th of head?.querySelectorAll('th.v221-head')||[]){
  const idx=[...th.parentNode.children].indexOf(th)-1;
  const it=an.items[idx];
  if(!core.isSplit(it))continue;
  th.insertAdjacentHTML('beforeend','<small class="v337-head-bonus">davon '+
   safe(textNumber(it.partialBonusV267.max))+' Bonus</small>');
  th.title=(it.label||it.id)+' · '+textNumber(it.regularMax)+' Gesamtpunkte, davon '+
   textNumber(it.partialBonusV267.max)+' Bonus · '+(it.partialBonusV267.description||'');
 }
 const overview=progress(p,an);
 const details='<p class="v337-intro"><strong>Bonuspunkte direkt eintragen:</strong> '+
  'Die Classtime-Zahl ist die Gesamtpunktzahl. „Davon Bonus“ zählt <strong>innerhalb</strong> '+
  'dieser Punkte, nicht zusätzlich. Die regulären Punkte werden automatisch berechnet.</p>'+
  '<p class="v337-progress" data-v337-progress role="status" aria-live="polite">'+
  overview.complete+' von '+overview.total+' Bonusaufteilungen geprüft'+
  (overview.awaitingRaw?' · '+overview.awaitingRaw+' Originalpunktwerte fehlen':'')+
  (overview.invalid?' · '+overview.invalid+' ungültig':'')+'.</p>';
 const status=host.querySelector('.v221-score-section .v221-matrix-wrap');
 if(status)status.insertAdjacentHTML('beforebegin',details);
 // Preserve the exception controls for "only this pupil" decisions, but remove
 // the old second copy of the bonus-gap editor hidden in advanced options.
 const advanced=host.querySelector('.v267-individual');
 if(advanced){
  for(const h of advanced.querySelectorAll('h4')){
   if(!h.textContent.includes('Erreichte Bonuspunkte'))continue;
   const info=h.nextElementSibling;
   if(info?.tagName==='P')info.remove();
   h.remove();
  }
  advanced.querySelector('.v267-partial-inputs')?.remove();
  advanced.querySelector('[data-v267-save-parts]')?.remove();
  const summary=advanced.querySelector('summary');
  if(summary)summary.innerHTML='<strong>Weitere Ausnahmen nur für ein Kind</strong>';
  const details=advanced.querySelector('details');
  if(details)details.open=false;
 }
 return host.innerHTML;
};
function cellNodes(id){
 const container=[...document.querySelectorAll('[data-v337-gap]')].find(el=>el.dataset.v337Gap===id);
 return {container,select:container?.querySelector('[data-v337-part]')};
}
function updateProgress(){
 const p=data(),a=analysis(),target=document.querySelector('[data-v337-progress]');
 if(!p||!a||!target)return;
 const r=progress(p,a);
 target.textContent=r.complete+' von '+r.total+' Bonusaufteilungen geprüft'+
  (r.awaitingRaw?' · '+r.awaitingRaw+' Originalpunktwerte fehlen':'')+
  (r.invalid?' · '+r.invalid+' ungültig':'')+'.';
}
function updateResultFor(studentId){
 const helper=window.SchulcockpitBonusMatrixV281,report=helper?.reportFor(studentId);
 if(!helper||!report)return;
 for(const el of document.querySelectorAll('[data-v281-result]')){
  if(el.dataset.v281Result===studentId)el.textContent=helper.resultText(report);
 }
 const current=document.querySelector('[data-v281-show][aria-pressed="true"]');
 if(current?.dataset.v281Show===studentId){
  const detail=document.querySelector('[data-v281-detail]');
  if(detail)detail.innerHTML=helper.breakdown(studentId);
 }
}
function refreshCell(studentId,itemId){
 const p=data(),an=analysis(),student=p?.roster?.find(s=>s.id===studentId),
  item=an?.items?.find(it=>it.id===itemId),loc=cellNodes(key(studentId,itemId));
 if(!student||!item||!loc.container)return;
 const el=document.createElement('div');
 el.innerHTML=gapMarkup(p,student,item);
 const replacement=el.firstElementChild;
 if(replacement){
  loc.container.replaceWith(replacement);
  replacement.querySelector('[data-v337-part]')?.addEventListener('change',function(){
   void persistGap(this).catch(err=>{
    const message=document.getElementById('v221-save-status');
    if(message){message.textContent='Bonuslücken nicht gespeichert: '+(err.message||err);message.dataset.kind='error';}
    refreshCell(studentId,itemId);
  });
  });
 }
 updateProgress();
 updateResultFor(studentId);
}
async function persistGap(select){
 if(busy||!select)return;
 const id=select.dataset.v337Part||'',sep=id.indexOf('|');
 if(sep<0)throw Error('Bonuspunkte konnten keiner Person und Aufgabe zugeordnet werden.');
 const studentId=id.slice(0,sep),itemId=id.slice(sep+1);
 const p=data(),an=analysis(),student=p?.roster?.find(x=>x.id===studentId),
  item=an?.items?.find(x=>x.id===itemId);
 if(!p||!student||!item||!core.isSplit(item,p.gradingOverridesV267?.[studentId]?.[itemId]))
  throw Error('Für diese Aufgabe sind keine Bonuslücken aktiv.');
 if((p.participationV210?.[studentId]||'present')!=='present')
  throw Error('Zuerst den Teilnahmestatus überprüfen.');
 busy=true;select.disabled=true;
 try{
  // Scores might still be in the v221 autosave queue. Finish that first.
  if(typeof v221Queue==='function'&&typeof v221SaveAllVisible==='function'){
   const saved=await v221Queue(v221SaveAllVisible);
   if(!saved)throw Error('Bitte die noch offene Gesamtpunkte-Eingabe zuerst prüfen.');
  }
  const raw=rawScore(p,studentId,item),entry=select.value.trim(),
    number=entry===''?null:core.validNumber(entry);
  if(entry!==''&&!core.eligible(item,raw,number,p.gradingOverridesV267?.[studentId]?.[itemId]))
   throw Error('Die Bonuspunkte müssen zu '+textNumber(raw)+' Gesamtpunkten passen. Bitte prüfen.');
  const prior=structuredClone(p.gradingOverridesV267||{});
  const own=p.gradingOverridesV267=structuredClone(prior);
  const changes={...(own[studentId]||{})};
  const current={...(changes[itemId]||{})};
  if(number===null)delete current.bonusEarned;
  else current.bonusEarned=number;
  if(Object.keys(current).length)changes[itemId]=current;
  else delete changes[itemId];
  if(Object.keys(changes).length)own[studentId]=changes;
  else delete own[studentId];
  try{await v200PrivatePut(p);}
  catch(err){p.gradingOverridesV267=prior;throw err;}
  refreshCell(studentId,itemId);
  const output=document.getElementById('v221-save-status');
  if(output){output.textContent=number===null?
    'Bonuspunkte wieder offen · ursprüngliche Classtime-Punkte unverändert.':
    '✓ Bonuslücken lokal gespeichert: '+student.name+' · '+(item.label||item.id)+
      ' · davon '+textNumber(number)+' Bonuspunkte. Original unverändert.';
   output.dataset.kind='success';}
 }finally{busy=false;if(select.isConnected)select.disabled=false;}
}
const oldSaveCell=v210SaveCell;
v210SaveCell=async function(input){
 const result=await oldSaveCell(input);
 const id=input?.dataset?.v210GridScore||'',at=id.indexOf('|');
 if(at>=0&&document.querySelector('.v337-progress'))
  refreshCell(id.slice(0,at),id.slice(at+1));
 return result;
};
const prevWire=wire;
wire=function(){
 prevWire();
 if(view!=='evaluation'||v200Eval?.step!==4)return;
 for(const select of document.querySelectorAll('[data-v337-part]')){
  select.addEventListener('change',()=>void persistGap(select).catch(err=>{
   const target=document.getElementById('v221-save-status');
   if(target){target.textContent='Bonuspunkte nicht gespeichert: '+(err.message||err);target.dataset.kind='error';}
   const id=select.dataset.v337Part||'',sep=id.indexOf('|');
   if(sep>=0)refreshCell(id.slice(0,sep),id.slice(sep+1));
  }));
 }
};
const prevRender=render;
render=function(){
 prevRender();
 const label=document.querySelector('.brand small');
 if(label)label.textContent=(state.settings?.schoolYear||'')+' · V0.33.7';
};
render();
})();
