/* Schulcockpit V0.21.9 — Bonus action must report feedback at its button.
 * Pure UI integration and guarded workflow. No migration of scores/analysis. */
const V219_VERSION='V0.21.9';
const v219BonusBlockBefore=v218BonusBlock;
v218BonusBlock=function(priv,an){
  const html=v219BonusBlockBefore(priv,an);
  if(!html.includes('id="v218-bonus-result"'))return html;
  const previous=priv?.classtime?.bonusReviewV218;
  const message=previous
    ?'✓ Bereits geprüft: '+Number(previous.safeZeros||0)+' sicher leere Bonusantworten wurden mit 0 Punkten erfasst. '
      +'Vorhandene manuelle Punkte bleiben unverändert.'
    :'Noch nicht durchgeführt. Beim Prüfen erscheint das Ergebnis direkt hier – auch wenn keine '
      +'automatische 0 sicher möglich ist.';
  const state=previous?'success':'note';
  return html.replace('<p id="v218-bonus-result" role="status"></p>',
    '<p id="v218-bonus-result" role="status" aria-live="polite" data-kind="'+state+'">'
      +esc(message)+'</p>');
};
const v219FoldBefore=v218Fold;
v218Fold=function(a,id,done,title,body,description){
  if(id==='bonus'&&done){
    const review=v200Eval?.privateData?.classtime?.bonusReviewV218;
    title+=' · '+Number(review?.safeZeros||0)+' sichere Nullwerte gespeichert';
  }
  return v219FoldBefore(a,id,done,title,body,description);
};
function v219LocalFeedback(message,kind='note'){
  const el=document.getElementById('v218-bonus-result');
  if(el){
    el.textContent=message;
    el.dataset.kind=kind;
    el.setAttribute('role',kind==='error'?'alert':'status');
  }
}
async function v219BonusClick(){
  const capture=await v216Capture({requireValid:true});
  if(!capture?.valid){
    return {kind:'draft',message:'Aufgabenplan noch nicht vollständig: '
      +(capture?.errors?.[0]||'Bitte den Aufgabenplan abschließen.')+
      ' Der Zwischenstand wurde lokal gesichert; Bonuspunkte wurden nicht geändert.'};
  }
  const result=await v218CommitBonus();
  if(!result){
    return {kind:'note',message:'Du hast die Übernahme abgebrochen. Es wurden keine neuen Bonuspunkte eingetragen.'};
  }
  const zeros=Number(result.zeros||0),answered=Number(result.answered||0);
  const warnings=result.warnings||[];
  if(warnings.length){
    return {kind:'warning',message:zeros+' nachweislich leere Bonusantworten wurden mit 0 Punkten gespeichert. '
      +answered+' beantwortete Antworten bleiben zur manuellen Prüfung offen. '
      +'Für '+warnings.length+' Bonusfrage(n) ist die eindeutige Personen-Zuordnung nicht nachgewiesen: '
      +warnings.join('; ')+'. Hier wurde keine automatische 0 vergeben. '
      +'Du kannst die Punkte trotzdem im nächsten Schritt manuell korrigieren.'};
  }
  const a=v218Exam(),ux=v218UX(a);
  const old=structuredClone(ux.expanded||{});
  ux.expanded={...old,bonus:false};
  try{await saveState();}
  catch(e){
    ux.expanded=old;
    return {kind:'warning',message:'Die '+zeros+' sicheren Nullwerte wurden lokal in den Ergebnissen gespeichert. '
      +'Nur das automatische Einklappen ließ sich nicht sichern: '+(e.message||e)};
  }
  return {kind:'success',message:'✓ Bonusprüfung abgeschlossen: '+zeros+
    ' nachweislich leere Bonusantworten als 0 gespeichert; '+answered+
    ' beantwortete Antworten bleiben für deine manuelle Bewertung offen.',
    repaint:true};
}
const v219WireBefore=wire;
wire=function(){
  v219WireBefore();
  if(view!=='evaluation'||v200Eval?.step!==3)return;
  const previous=document.querySelector('[data-v218-bonus-zeros]');
  if(!previous)return;
  // The V0.21.8 listener reports only at the top of a very long screen.
  // Replace its element to remove that handler and attach exactly one
  // self-contained action with feedback beside the actual button.
  const btn=previous.cloneNode(true);
  previous.replaceWith(btn);
  btn.addEventListener('click',()=>{
    if(btn.disabled)return;
    btn.disabled=true;
    const original=btn.textContent;
    btn.textContent='Prüfe Bonusantworten …';
    v219LocalFeedback('Prüfe die Frageblätter und sichere eindeutig leere Bonusantworten lokal …','progress');
    void v216Serial(v219BonusClick).then(result=>{
      v219LocalFeedback(result.message,result.kind);
      if(result.repaint){
        render();
        const stage=document.querySelector('[data-v218-stage="bonus"]');
        stage?.scrollIntoView?.({behavior:'smooth',block:'center'});
      }
    }).catch(e=>{
      v219LocalFeedback('Die Bonusprüfung konnte nicht abgeschlossen werden: '
        +(e.message||e)+'. Deine bisherigen Einträge bleiben erhalten.','error');
    }).finally(()=>{
      if(btn.isConnected){btn.disabled=false;btn.textContent=original;}
    });
  });
};
const v219RenderBefore=render;
render=function(){
  v219RenderBefore();
  const brand=document.querySelector('.brand small');
  if(brand)brand.textContent=state.settings.schoolYear+' · '+V219_VERSION;
};
render();