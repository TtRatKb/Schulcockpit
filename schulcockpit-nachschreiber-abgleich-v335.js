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
  '<p>Die vorhandene Klassenliste fehlt noch. Sobald du sie in Schritt 1 anlegst, erkennt Schulcockpit die Kinder, deren Ergebnisse noch fehlen.</p>'+
  '<button class="secondary" data-v200-step="1">Klassenliste öffnen</button></section>';
 const overview=core.reconcile(rec.roster,priv);
 const rows=overview.missing.map(s=>
  '<div class="v335-missing-row"><strong>'+safe(s.name)+'</strong>'+
  (s.ambiguous?'<small>Mehrfache Prüfungszuordnung – erst die Namen in Schritt 1 klären</small>':
   '<label><span class="v335-visually-hidden">Grund für fehlendes Ergebnis von '+safe(s.name)+'</span>'+
   '<select data-v335-status="'+safe(s.id)+'" aria-label="Fehlendes Ergebnis von '+safe(s.name)+'">'+
    choices.map(([value,name])=>'<option value="'+value+'"'+(s.reason===value?' selected':'')+'>'+name+'</option>').join('')+
    '</select></label>')+
   '<small>'+(s.linked?'Bereits in der Prüfungs-Teilnehmerliste':'Noch nicht in dieser Prüfung')+'</small></div>').join('');
 const toPrepare=core.prepareEntries(overview);
 const pending=overview.pending;
 const section='<section class="v335-panel"><div class="v335-head"><div>'+
  '<span class="eyebrow">CLASSTIME · ERGEBNISSE ERGÄNZEN</span><h3>Wer hat schon ein Ergebnis?</h3></div>'+
  '<span class="v335-counter">'+overview.recorded+' von '+overview.active+' mit Punkten</span></div>'+
  '<p class="v335-hint">'+(pending?pending+' Ergebnis(se) fehlen noch oder sind ungeklärt.':
   'Keine ungeklärten Ergebnisse aus der Klassenliste.')+
   ' Fehlende Excel-Zeilen bedeuten nicht automatisch, dass ein Kind gefehlt hat.</p>'+
  (overview.unmatchedExam?'<p class="v335-warn">'+overview.unmatchedExam+
    ' vorhandene Prüfungs-Zuordnung(en) passen noch nicht eindeutig zur Klassenliste. '+
    'Bitte zuerst in Schritt 1 verknüpfen.</p>':'')+
  '<details class="v335-details"'+(pending?' open':'')+'><summary>Fehlende Ergebnisse klären · '+
    overview.missing.length+' Kind(er)</summary>'+
   (overview.missing.length?
     '<p>Wähle nur den Grund aus. Er wird lokal gespeichert und lässt sich jederzeit ändern.</p>'+
     '<div class="v335-missing-list">'+rows+'</div>':
     '<p>Alle aktiven Kinder haben bereits Punkte erfasst oder wurden als nicht teilnehmend markiert.</p>')+
   (toPrepare.length?
     '<div class="v335-prepare"><p><strong>'+toPrepare.length+
     ' Kind(er) für späteren Import vormerken</strong></p>'+
     '<p>Damit Classtime beim Nachschreiben die Person eindeutig zuordnen kann, wird ein fehlender Eintrag in der privaten Prüfungs-Teilnehmerliste ergänzt. Andere Ergebnisse bleiben unverändert.</p>'+
     '<button class="secondary" data-v335-prepare>Für spätere Ergebnisdateien vorbereiten</button></div>':'')+
   '</details>'+
  '<div class="v335-actions"><button class="secondary" data-v335-import>Weitere Classtime-Excel ergänzen</button>'+
  (overview.unmatchedExam?'<button class="secondary" data-v200-step="1">Namen zuordnen</button>':'')+
  '</div><p class="v335-message" role="status" aria-live="polite"></p></section>';
 return section;
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
  void changeReason(input.dataset.v335Status,input.value)
   .catch(err=>{alert('Teilnahmestatus nicht gespeichert: '+(err.message||err));render();})
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
