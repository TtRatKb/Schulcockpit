/* Schulcockpit V0.22.5 – abgestufte, ermutigende Mathe-Rückmeldungen.
 * Only reading local report scores, never modifying stored assessments or
 * replacing teacher-authored notes. Curriculum status stays authoritative.
 */
const V225_VERSION='V0.22.5';
const V225_TEXT_LIMIT=900;
// An in-flight IndexedDB write may finish after the teacher types again.
let v225EditRevision=0;
const v225ScheduleBefore=v224ScheduleSave;
v224ScheduleSave=function(){
  v225EditRevision++;
  return v225ScheduleBefore();
};

function v225Band(c){
  const pct=Number(c?.pct),status=String(c?.status||'').trim().toLowerCase();
  if(!Number.isFinite(pct)||!Number(c?.regularMax))return 'open';
  if(status==='erreicht')return pct>=99.999?'perfect':'reached';
  if(status==='teilweise erreicht')return 'partial';
  if(status==='noch nicht erreicht'){
    if(pct===0)return 'zero';
    return pct<=25?'weak':'practice';
  }
  return 'open'; // Do not invent curriculum threshold classifications.
}
function v225Noun(text){
  const l=v224Clean(text).toLowerCase();
  if(/zahlenstrahl/.test(l)&&/stellenwert/.test(l))
    return 'das Ablesen am Zahlenstrahl und den Umgang mit der Stellenwerttafel';
  if(/schriftlich.*addier|schriftlich.*addition|additionsverfahren/.test(l))return 'das schriftliche Addieren';
  if(/schriftlich.*subtrah|schriftlich.*subtraktion|subtraktionsverfahren/.test(l))return 'das schriftliche Subtrahieren';
  if(/zahlen.*rund|runden.*zahlen/.test(l))return 'das Runden von Zahlen';
  if(/zahlenstrahl/.test(l))return 'das Ablesen von Zahlen am Zahlenstrahl';
  if(/stellenwert/.test(l))return 'das Arbeiten mit der Stellenwerttafel';
  if(/fachbegriffe/.test(l))return 'den Umgang mit mathematischen Fachbegriffen';
  return '„'+v224Clean(text)+'“';
}
function v225At(text){
  const l=v224Clean(text).toLowerCase();
  if(/zahlenstrahl/.test(l)&&/stellenwert/.test(l))
    return 'beim Ablesen am Zahlenstrahl und beim Arbeiten mit der Stellenwerttafel';
  if(/schriftlich.*addier|schriftlich.*addition|additionsverfahren/.test(l))return 'beim schriftlichen Addieren';
  if(/schriftlich.*subtrah|schriftlich.*subtraktion|subtraktionsverfahren/.test(l))return 'beim schriftlichen Subtrahieren';
  if(/zahlen.*rund|runden.*zahlen/.test(l))return 'beim Runden von Zahlen';
  if(/zahlenstrahl/.test(l))return 'beim Ablesen von Zahlen am Zahlenstrahl';
  if(/stellenwert/.test(l))return 'beim Arbeiten mit der Stellenwerttafel';
  if(/fachbegriffe/.test(l))return 'beim Verwenden mathematischer Fachbegriffe';
  return 'bei „'+v224Clean(text)+'“';
}
function v225FullBonus(report){
  // Overall competency percentages are capped at 100 % after bonus offsets.
  // Full bonus achievement must therefore be tested on individual bonus items.
  return (report?.competencies||[]).flatMap(c=>c.auditV210||[])
    .filter(x=>String(x.source||'').endsWith('_bonus')&&Number(x.max)>0&&
      x.earned!==null&&x.earned!==undefined&&Number.isFinite(Number(x.earned))&&
      Math.abs(Number(x.earned)-Number(x.max))<1e-9);
}
function v225FeedbackParts(report){
  const comps=(report?.competencies||[]).filter(c=>Number(c.regularMax)>0&&Number.isFinite(c.pct));
  const green=comps.filter(c=>['perfect','reached'].includes(v225Band(c)))
    .sort((a,b)=>b.pct-a.pct);
  const red=comps.filter(c=>['zero','weak','practice'].includes(v225Band(c)))
    .sort((a,b)=>a.pct-b.pct);
  const partial=comps.filter(c=>v225Band(c)==='partial');
  const fullBonus=v225FullBonus(report);
  const strength=[];
  if(green.length>=3)strength.push('Du kannst schon in vielen Bereichen richtig viel!');
  green.forEach((c,i)=>{
    const at=v225At(c.text),perfect=v225Band(c)==='perfect';
    if(perfect&&i===0)strength.push('Richtig stark: '+at.charAt(0).toUpperCase()+at.slice(1)+' bist du schon sehr sicher!');
    else if(perfect)strength.push('Auch '+at+' klappt es bei dir schon besonders gut!');
    else if(i===0)strength.push(at.charAt(0).toUpperCase()+at.slice(1)+' kommst du schon gut zurecht.');
    else strength.push('Außerdem kommst du '+at+' schon gut zurecht.');
  });
  if(fullBonus.length===1)
    strength.push('Bei einer Bonusaufgabe hast du sogar alle Zusatzpunkte geholt – klasse!');
  else if(fullBonus.length>1)
    strength.push('Bei '+fullBonus.length+' Bonusaufgaben hast du sogar alle Zusatzpunkte geholt – klasse!');
  if(!strength.length){
    if(partial.length)strength.push('Du hast schon erste Grundlagen verstanden. Darauf kannst du weiter aufbauen.');
    else strength.push('Wir schauen uns gemeinsam an, welche Rechenwege dir schon gelingen und wo wir weiterüben.');
  }
  const next=[];
  red.forEach((c,i)=>{
    const at=v225At(c.text),band=v225Band(c);
    if(band==='zero'){
      if(i===0)next.push('Schau dir '+v225Noun(c.text)+' unbedingt noch einmal in Ruhe an.');
      else next.push('Auch '+at+' fangen wir am besten noch einmal bei den Grundlagen an.');
    }else if(band==='weak'){
      next.push((i===0?'':'Auch hier gilt: ')+at.charAt(0).toUpperCase()+at.slice(1)+
        ' brauchst du noch viel Übung – das können wir Schritt für Schritt angehen.');
    }else{
      next.push(i===0?at.charAt(0).toUpperCase()+at.slice(1)+
        ' hilft dir noch etwas Übung.':'Auch '+at+' brauchst du noch etwas Übung.');
    }
  });
  if(!red.length){
    if(partial.length)next.push('Einige Aufgaben klappen schon teilweise. Übe diese Bereiche in Ruhe weiter.');
    else next.push('Bleib dran und festige dein Können mit passenden Übungsaufgaben.');
  }
  // Optional only: written work has not been analyzed for actual carry errors.
  const carry=red.some(c=>/subtrah|subtraktion/.test(v224Clean(c.text).toLowerCase()));
  if(carry)next.push('Übe beim schriftlichen Subtrahieren auch Aufgaben mit Überträgen.');
  return {strength,next,green,red,partial,fullBonus};
}
function v225DefaultFeedback(report){
  const s=v225FeedbackParts(report);
  return {strength:s.strength.join(' '),next:s.next.slice(0,s.red.length||1).join(' ')};
}
function v225Suggestions(report){
  const s=v225FeedbackParts(report);
  return {strength:s.strength,next:s.next,strong:s.green[0]||null,development:s.red[0]||null};
}
v224Suggestions=v225Suggestions;
v224DefaultFeedback=v225DefaultFeedback;

function v225CompetenceRows(report){
  return (report?.competencies||[]).filter(c=>Number(c.regularMax)>0).map(c=>{
    const pct=Number.isFinite(c.pct)?Math.round(c.pct):null;
    const band=v225Band(c);
    const name={perfect:'100 % erreicht',reached:'erreicht',partial:'teilweise erreicht',
      practice:'noch nicht erreicht',weak:'noch nicht erreicht',zero:'noch nicht erreicht',open:'noch offen'}[band];
    return '<div class="v224-competence v225-'+band+'">'
      +'<div><strong>'+esc(c.text)+'</strong><small>'+esc(name)+' · '
      +(pct===null?'offen':pct+' %')
      +' · '+esc(c.adjusted)+' / '+esc(c.regularMax)+' reguläre Punkte'
      +(Number(c.bonusEarned)>0?' · '+esc(c.bonusEarned)+' Bonuspunkte erzielt':'')
      +'</small></div></div>';
  }).join('');
}
v224CompetenceRows=v225CompetenceRows;

const v225Step5Before=v200Step5;
v200Step5=function(a,priv){
  return v225Step5Before(a,priv)
    .replace(/data-v224-strength maxlength="250"/g,'data-v224-strength maxlength="'+V225_TEXT_LIMIT+'"')
    .replace(/data-v224-next-text maxlength="250"/g,'data-v224-next-text maxlength="'+V225_TEXT_LIMIT+'"')
    .replace('Die beiden Texte werden im PDF verwendet, sobald du sie speicherst.',
      'Alle erreichten und noch nicht erreichten Kompetenzen fließen in die Vorschläge ein. '
      +'Eigene gespeicherte Texte bleiben erhalten. Über „Automatischen Vorschlag einsetzen“ '
      +'kannst du den neuen Vorschlag bewusst übernehmen. Die Rückmeldung wird im PDF verwendet.');
};
v224AppendPhrase=function(kind,phrase){
  const d=v224DraftFields(),el=kind==='strength'?d.strength:d.next;
  if(!el||!phrase)return;
  const prior=el.value.trim();
  if(prior.includes(phrase))return;
  const next=(prior?prior+' ':'')+phrase;
  if(next.length>V225_TEXT_LIMIT){
    v224Notice('Der Text ist zu lang. Kürze ihn bitte etwas.','warning');return;
  }
  el.value=next;v224DraftDirty=true;v224RefreshPreview();v224ScheduleSave();
  v224Notice('Text ergänzt – wird lokal gespeichert.','note');
};
v224SaveFeedback=async function(){
  const p=v200Eval?.privateData,rs=v224Report(),r=rs[v224Index(rs.length)];
  if(!p||!r)throw Error('Aktuelle Rückmeldung nicht gefunden.');
  const inputs=v224DraftFields();
  if(!inputs.strength||!inputs.next)throw Error('Die Rückmeldungsfelder fehlen.');
  const draft={strength:inputs.strength.value.trim(),next:inputs.next.value.trim()};
  const savingRevision=v225EditRevision;
  if(draft.strength.length>V225_TEXT_LIMIT||draft.next.length>V225_TEXT_LIMIT)
    throw Error('Rückmeldung ist zu lang; maximal '+V225_TEXT_LIMIT+' Zeichen je Feld.');
  const last=p.feedbackV210?.[r.student.id],old=last?structuredClone(last):undefined;
  if(!p.feedbackV210)p.feedbackV210={};
  if(JSON.stringify(last||{})===JSON.stringify(draft)){
    if(savingRevision===v225EditRevision){
      v224DraftDirty=false;v224Notice('✓ Rückmeldung bereits lokal gespeichert.','success');
    }else{
      v224DraftDirty=true;v224Notice('Neue Änderungen warten noch auf Speicherung.','note');
      v224ScheduleSave();
    }
    return true;
  }
  p.feedbackV210[r.student.id]=draft;
  try{await v200PrivatePut(p);}
  catch(err){
    if(old===undefined)delete p.feedbackV210[r.student.id];
    else p.feedbackV210[r.student.id]=old;
    v224Notice('Nicht gespeichert: '+(err.message||err)+'. Bitte Seite nicht schließen.','error');
    throw err;
  }
  if(savingRevision===v225EditRevision){
    v224DraftDirty=false;
    v224Notice('✓ Persönliche Rückmeldung lokal gespeichert.','success');
  }else{
    // Older writes must not mark newer text as safely persisted.
    v224DraftDirty=true;
    v224Notice('Neuere Änderungen werden noch lokal gespeichert …','note');
    v224ScheduleSave();
  }
  v224RefreshPreview();
  return true;
};
v224FeedbackPrompt=function(report){
  const s=v225FeedbackParts(report);
  return 'Bitte formuliere eine freundliche, konkrete Rückmeldung zu einer Mathematikarbeit. '
    +'Sprich das Kind direkt mit du an, bleibe bei belegbaren Leistungen, '
    +'verwende nicht mechanisch die Kompetenzformulierungen. '
    +'Erwähne ALLE erreichten und ALLE noch nicht erreichten Fähigkeiten, '
    +'unterscheide vollständig erreicht, weitgehend erreicht, 0 % und schon teilweise vorhanden. '
    +'Bleibe auch bei mehreren Lernbaustellen konstruktiv. '
    +'Verwende niemals Namen, Daten, Punkte, Prozentzahlen oder Aufgabennummern. '
    +'Gib die zwei Absätze als STÄRKE: und NÄCHSTER SCHRITT: aus.\n'
    +'Gelingt: '+(s.green.map(c=>(v225Band(c)==='perfect'?'besonders sicher: ':'erreicht: ')+v224Clean(c.text)).join('; ')||'keine sicher erreichte Kompetenz')+'\n'
    +'Übungsbereiche: '+(s.red.map(c=>(v225Band(c)==='zero'?'von Grund auf üben: ':'weiter üben: ')+v224Clean(c.text)).join('; ')||'kein nicht erreichter Bereich')+'\n'
    +'Bonusaufgabe vollständig erreicht: '+(s.fullBonus.length>0?'ja':'nein');
};
/* Apply the new proposal and color mapping immediately after upgrading. */
render();
