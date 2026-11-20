/* Schulcockpit V0.33.5 – straightforward missing-results review after the first Excel.
 * All names, student IDs, participation notes and points remain in private IndexedDB.
 */
(function(){
'use strict';
const core=window.SchulcockpitMakeupRosterV335;
if(!core)return;
const safe=value=>esc(String(value??''));
let busy=false;
const exam=()=>v200Assessment(v200Eval?.assessmentId);
const privateData=()=>v200Eval?.privateData;
const currentClass=()=>{
 const a=exam(),rec=typeof v235Current==='function'?v235Current():null;
 return rec&&a&&rec.classId===a.classId?rec:null;
};
const choices=[
 ['unknown','Noch ungeklärt'],
 ['makeup','Schreibt nach'],
 ['paper_pending','Papierpunkte fehlen'],
 ['not_participating','Nimmt nicht teil']
];
function resultPanel(a,priv){
 const rec=currentClass();
 if(!rec?.roster?.length)return '<section class="v335-panel">'+
  '<div class="v335-head"><h3>Wer hat schon ein Ergebnis?</h3></div>'+
  '<p>Die vorhandene Klassenliste fehlt noch. Du kannst sie in Schritt 1 öffnen.</p>'+
  '<button class="secondary" data-v200-step="1">Klassenliste öffnen</button></section>';
 if(!(priv?.roster||[]).length&&!priv?.classtime)
  return '<section class="v335-panel"><div class="v335-head"><h3>Wer hat schon ein Ergebnis?</h3></div>'+
   '<p>Die Klassenliste ist vorhanden, aber noch keine bewertete Prüfungs-Teilnehmerliste. Importiere zuerst die Classtime-Ergebnisse oder übernimm die Klasse für eine Papierarbeit.</p></section>';
 const overview=core.reconcile(rec.roster,priv);
 const versions=window.SchulcockpitExamTabsV338?.available?.(a)||[];
 const groups=core.reviewGroups(rec.roster,priv,overview,versions);
 const specialChoices=groups.versions.map(f=>['file:'+f.fileKey,
  (f.role==='inclusion_makeup'?'Inklusions-Nachschreibearbeit':'Inklusionsarbeit')+
  (groups.versions.length>1?' · '+(f.name||'eigene Fassung'):'')+' zuordnen']);
 const statusLabel=(s)=>s.le?
  '<small class="v335-le-tag">LE · Inklusionsfassung prüfen</small>':'';
 function row(s){
  const label='<strong>'+safe(s.name)+'</strong>'+statusLabel(s);
  if(s.ambiguous||s.conflictingAssignment)
   return '<div class="v335-missing-row">'+label+
    '<span class="v335-row-note">Zuordnung uneindeutig – bitte Schritt 1 prüfen</span></div>';
  if(s.assigned){
   const name=s.assigned.role==='inclusion_makeup'?'Inklusions-Nachschreibearbeit':
    s.assigned.role==='inclusion'?'Inklusionsarbeit':'Nachschreibefassung';
   return '<div class="v335-missing-row">'+label+
    '<span class="v335-row-note"><strong>'+safe(name)+'</strong> zugeordnet · Punkte noch offen</span>'+
    '<small>Ergebnis im zugehörigen Fassungsreiter ergänzen</small></div>';
  }
  return '<div class="v335-missing-row">'+label+
    '<label><span class="v335-visually-hidden">Ergebnisstatus von '+safe(s.name)+'</span>'+
    '<select data-v335-status="'+safe(s.id)+'" aria-label="Ergebnisstatus von '+safe(s.name)+'">'+
    choices.map(([value,name])=>'<option value="'+value+'"'+(s.reason===value?' selected':'')+'>'+safe(name)+'</option>').join('')+
    specialChoices.map(([key,name])=>'<option value="'+safe(key)+'">'+safe(name)+'</option>').join('')+
    '</select></label>'+
    '<small>'+(s.le?'LE ist vorgemerkt, die Fassung noch nicht bestätigt':
    s.linked?'In Prüfungs-Teilnehmerliste · noch keine Punkte':
    'Noch nicht in dieser Prüfung')+'</small></div>';
 }
 const toPrepare=core.prepareEntries({...overview,missing:groups.standardMissing});
 const standardRows=groups.standardMissing.map(row).join('');
 const specialRows=groups.specialMissing.map(row).join('');
 const leWaiting=groups.specialMissing.filter(x=>x.le&&!x.assigned).length;
 return '<section class="v335-panel"><div class="v335-head"><div>'+
  '<span class="eyebrow">CLASSTIME · ERGEBNISSE ERGÄNZEN</span>'+
  '<h3>Wer hat schon ein Ergebnis?</h3></div>'+
  '<span class="v335-counter">'+groups.regularRecorded+' von '+groups.regularActive+
  ' regulär mit Punkten</span></div>'+
  '<p class="v335-hint">Ein Kind kann bereits in der Prüfungs-Teilnehmerliste stehen, ohne dass korrigierte Punkte vorliegen. Erst bestätigte Aufgabenpunkte zählen als Ergebnis – auch 0 Punkte.</p>'+
  (overview.unmatchedExam?'<p class="v335-warn">'+overview.unmatchedExam+
    ' vorhandene Prüfungs-Zuordnung(en) sind nicht eindeutig mit der Klassenliste verknüpft. Bitte Schritt 1 prüfen.</p>':'')+
  '<details class="v335-details"'+(groups.standardMissing.length<=8&&groups.pendingStandard?' open':'')+'>'+
  '<summary>Reguläre Arbeit · '+groups.standardMissing.length+
   ' ohne Punkte / zu klären</summary>'+
  (groups.standardMissing.length?
    '<p>Hier wählst du Nachschreiben, Papierpunkte, Nichtteilnahme oder ausdrücklich eine Inklusionsfassung.</p>'+
    '<div class="v335-missing-list">'+standardRows+'</div>':
    '<p>Keine ungeklärten regulären Ergebnisse.</p>')+
  (toPrepare.length?
    '<div class="v335-prepare"><p><strong>'+toPrepare.length+
    ' Kind(er) für den regulären Nachimport vorbereiten</strong></p>'+
    '<button class="secondary" data-v335-prepare>Für spätere Ergebnisdateien vorbereiten</button></div>':'')+
  '</details>'+
  (groups.specialMissing.length?
   '<details class="v335-details" open><summary>LE / andere Prüfungsfassung · '+
    groups.specialMissing.length+' Ergebnis(se) offen</summary>'+
    '<p>LE ist bereits aus der privaten Klassenliste erkannt. Es ist ein Vorschlag für die Inklusionsauswertung, keine automatische Zuweisung. Wähle die tatsächlich geschriebene Fassung; bereits zugeordnete Kinder erscheinen darunter direkt als Inklusionsarbeit.</p>'+
    (leWaiting&&!groups.versions.length?
     '<p class="v335-warn">Noch keine Inklusions-Prüfungsdatei verfügbar. Bitte die Datei in Schritt 1 als Inklusionsarbeit kennzeichnen.</p>':'')+
    '<div class="v335-missing-list">'+specialRows+'</div></details>':'')+
  '<div class="v335-actions"><button class="secondary" data-v335-import>Weitere Classtime-Excel ergänzen</button>'+
  (overview.unmatchedExam?'<button class="secondary" data-v200-step="1">Namen zuordnen</button>':'')+
  '</div><p class="v335-message" role="status" aria-live="polite"></p></section>';
}
const oldStep3=v200Step3;
v200Step3=function(a,priv){
 const original=oldStep3(a,priv);
 if(!a?.evaluationV200?.analysis?.items?.length)return original;
 const root=document.createElement('div');
 root.innerHTML=original;
 const excel=root.querySelector('.v218-flow [data-v218-stage="excel"]');
 const panel=resultPanel(a,priv);
 if(excel)excel.insertAdjacentHTML('afterend',panel);
 else root.insertAdjacentHTML('afterbegin',panel);
 return root.innerHTML;
};
async function assignSpecial(classId,kind){
 if(busy)return;
 const a=exam(),rec=currentClass(),p=privateData();
 const available=window.SchulcockpitExamTabsV338?.available?.(a)||[];
 const selected=available.find(f=>f.key===kind&&
  (f.role==='inclusion'||f.role==='inclusion_makeup'));
 if(!rec||!p||!selected||!rec.roster.some(m=>m.id===classId&&m.participatesV258!==false))
  throw Error('Inklusionsfassung oder Kind ist nicht eindeutig verfügbar.');
 const overview=core.reconcile(rec.roster,p);
 const row=core.reviewGroups(rec.roster,p,overview,available).byClassId[classId];
 if(!row||row.ambiguous||row.conflictingAssignment||row.assigned)
  throw Error('Die bestehende Prüfungszuordnung ist nicht eindeutig. Bitte zuerst Schritt 1 prüfen.');
 const linked=(p.roster||[]).filter(st=>st.classStudentId===classId||
  (!st.classStudentId&&core.norm(st.name)===core.norm(rec.roster.find(m=>m.id===classId)?.name)));
 if(linked.length>1||linked.some(st=>
   window.SchulcockpitExamAnalysisV317?.hasResults?.(p,st.id)))
  throw Error('Für dieses Kind sind bereits Punkte oder uneindeutige Verknüpfungen gespeichert. Die Zuordnung bitte zuerst in Schritt 1 prüfen.');
 if(!window.SchulcockpitExamSourcesV318?.assign)
  throw Error('Die sichere Prüfungszuordnung ist noch nicht verfügbar.');
 const member=rec.roster.find(m=>m.id===classId);
 if(!confirm('„'+member.name+'“ der '+(selected.role==='inclusion_makeup'?
  'Inklusions-Nachschreibearbeit':'Inklusionsarbeit')+
  ' zuordnen? Nur die private Dateizuordnung wird gespeichert; vorhandene Ergebnisse bleiben unverändert.'))return;
 busy=true;
 try{
  await window.SchulcockpitExamSourcesV318.assign(selected.fileKey,classId,true);
 }finally{busy=false;}
}
async function changeReason(classId,reason){
 if(busy)return;
 const rec=currentClass(),priv=privateData();
 if(!rec||!priv||!rec.roster.some(s=>s.id===classId&&s.participatesV258!==false))
  throw Error('Kind ist nicht eindeutig Teil der aktiven Klassenliste.');
 const value=core.normalizeReason(reason),next=structuredClone(priv);
 const missing=core.reconcile(rec.roster,priv).missing.find(row=>row.id===classId);
 if(!missing||missing.ambiguous)throw Error('Die Zuordnung ist noch nicht eindeutig.');
 // The existing step-4 participation picker and report status must agree with
 // this explicit decision. Do not touch a special-variant marker.
 if(missing.examId){
  const previous=priv.participationV210?.[missing.examId]||'present';
  if(previous==='variant')
   throw Error('Dieses Kind hat bereits eine andere Prüfungsfassung. Bitte deren Teilnahme in der Korrektur prüfen.');
  next.participationV210={...(next.participationV210||{})};
  next.participationV210[missing.examId]=
   value==='makeup'?'makeup':value==='not_participating'?'absent':'present';
 }
 next.pendingReasonsV335={...(next.pendingReasonsV335||{}),[classId]:value};
 busy=true;
 try{
  await v200PrivatePut(next);
  if(v200Eval?.assessmentId===next.assessmentId)v200Eval.privateData=next;
  render();
 }finally{busy=false;}
}
async function prepare(){
 if(busy)return;
 const rec=currentClass(),priv=privateData();
 if(!rec?.roster?.length||!priv)throw Error('Klassenliste oder Auswertung nicht geladen.');
 const summary=core.reconcile(rec.roster,priv),items=core.prepareEntries(summary);
 if(!items.length)throw Error('Keine neu vorzubereitenden Kinder. Zuerst „Schreibt nach“ auswählen.');
 if(!Object.values(priv.scores||{}).some(s=>Object.values(s||{}).some(v=>v!==null&&v!==undefined&&v!==''))&&
    !priv.classtime?.reviewedV210)
  throw Error('Bitte zuerst die vorhandene Classtime-Arbeit importieren und ihre Punkte übernehmen. Für reine Papierarbeiten gibt es in Schritt 1 die Klassenlisten-Übernahme.');
 if(!confirm(items.length+' bislang fehlende Person(en) aus der privaten Klassenliste in diese Prüfungs-Teilnehmerliste aufnehmen? Bereits gespeicherte Ergebnisse bleiben unverändert.'))return;
 const existing=priv.roster||[],names=new Set(existing.map(s=>core.norm(s.name)));
 const memberById=new Map(rec.roster.map(s=>[s.id,s]));
 const next=structuredClone(priv);
 next.roster=[...(next.roster||[])];
 next.participationV210={...(next.participationV210||{})};
 for(const item of items){
  const member=memberById.get(item.id);
  if(!member||names.has(core.norm(member.name))||
     next.roster.some(s=>s.classStudentId===member.id))
   throw Error('Ein fehlendes Kind hat einen widersprüchlichen Namen bzw. bereits einen Eintrag. Bitte die Zuordnung in Schritt 1 prüfen.');
  let newId='S-v335-'+uid('student');
  while(next.roster.some(s=>s.id===newId))newId='S-v335-'+uid('student');
  next.roster.push({id:newId,name:member.name,classStudentId:member.id,rowIndex:null});
  next.participationV210[newId]=item.reason==='makeup'?'makeup':'present';
  names.add(core.norm(member.name));
 }
 busy=true;
 try{
  await v200PrivatePut(next);
  if(v200Eval?.assessmentId===next.assessmentId)v200Eval.privateData=next;
  render();
 }finally{busy=false;}
}
const oldWire=wire;
wire=function(){
 oldWire();
 if(view!=='evaluation'||v200Eval?.step!==3)return;
 document.querySelectorAll('[data-v335-status]').forEach(input=>input.onchange=()=>{
  input.disabled=true;
  void (input.value.startsWith('file:')?
    assignSpecial(input.dataset.v335Status,input.value):
    changeReason(input.dataset.v335Status,input.value))
   .catch(err=>{alert('Ergebnisstatus nicht gespeichert: '+(err.message||err));render();})
   .finally(()=>{input.disabled=false;});
 });
 document.querySelector('[data-v335-prepare]')?.addEventListener('click',()=>{
  void prepare().catch(err=>alert('Nachschreiber-Vorbereitung: '+(err.message||err)));
 });
 document.querySelector('[data-v335-import]')?.addEventListener('click',()=>{
  // Reuse V300 importer; do not create an unprotected second XLSX upload path.
  const details=document.querySelector('.v333-makeup > details');
  if(details){details.open=true;details.scrollIntoView({behavior:'smooth',block:'start'});}
  else{
   const input=document.querySelector('[data-v300-files]');
   if(input)input.click();else alert('Classtime-Nachimport ist in dieser Ansicht noch nicht verfügbar.');
  }
 });
};
const previousRender=render;
render=function(){
 previousRender();
 const label=document.querySelector('.brand small');
 if(label)label.textContent=(state.settings?.schoolYear||'')+' · V0.33.5';
};
render();
})();
