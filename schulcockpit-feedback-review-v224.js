/* Schulcockpit V0.22.4 – persönliche, lokal bearbeitbare Rückgabe.
 * Private data remains local. ChatGPT receives nothing automatically.
 * Existing competency thresholds, point totals and PDF export remain intact. */
const V224_VERSION='V0.22.4';
function v224Report(){return v200ReportList();}
function v224Index(len){return Math.min(Math.max(0,Number(v200Eval?.studentIndex)||0),Math.max(0,len-1));}
function v224Clean(text){
  return String(text||'').trim().replace(/^(?:Du kannst|Ich kann)\s+/i,'')
    .replace(/[.!]\s*$/,'').trim();
}
function v224SubjectPhrase(text){
  const t=v224Clean(text);
  const l=t.toLowerCase();
  if(/schriftlich.*addier|schriftlich.*addition|additionsverfahren/.test(l))return 'das schriftliche Addieren';
  if(/schriftlich.*subtrah|schriftlich.*subtraktion|subtraktionsverfahren/.test(l))return 'das schriftliche Subtrahieren';
  if(/zahlen.*rund|runden.*zahlen/.test(l))return 'das Runden von Zahlen';
  if(/zahlenstrahl/.test(l))return 'das Ablesen von Zahlen am Zahlenstrahl';
  if(/stellenwert/.test(l))return 'die Arbeit mit Stellenwerten';
  if(/fachbegriffe/.test(l))return 'das Verwenden mathematischer Fachbegriffe';
  return t ? '„'+t+'“' : 'diese Aufgaben';
}
function v224Competencies(report){
  const list=(report?.competencies||[]).filter(c=>Number(c.regularMax)>0&&Number.isFinite(c.pct));
  return [...list].sort((a,b)=>b.pct-a.pct);
}
function v224Suggestions(report){
  const list=v224Competencies(report),best=list[0],also=list.find(c=>c.id!==best?.id&&c.pct>=80);
  const low=[...list].reverse().find(c=>c.pct<70),bonus=best&&best.bonusEarned>0;
  const positive=best?(best.pct>=90?
      'Besonders gut gelingt dir schon '+v224SubjectPhrase(best.text)+'.':
      best.pct>=70?'Mit '+v224SubjectPhrase(best.text)+' kommst du schon gut zurecht.':
      'Bei '+v224SubjectPhrase(best.text)+' hast du schon wichtige Schritte geschafft.')
    :'Du hast dich mit den Aufgaben auseinandergesetzt und kannst darauf aufbauen.';
  const second=also?'Auch '+v224SubjectPhrase(also.text)+' klappt bei dir schon richtig gut.':'';
  const bonusLine=bonus?'Mit den Bonusaufgaben hast du zusätzlich gezeigt, was du schon kannst.':'';
  const next=low?'Schau dir als Nächstes '+v224SubjectPhrase(low.text)+' noch einmal in Ruhe an.':
    'Bleib dran und übe die Aufgaben, bei denen du noch unsicher bist.';
  return {
    strength:[positive,second,bonusLine].filter(Boolean),
    next:[next,'Du kannst dich dabei an deinen Lösungswegen orientieren und Fehler Schritt für Schritt verbessern.'],
    strong:best,development:low
  };
}
function v224DefaultFeedback(report){
  const s=v224Suggestions(report);
  return {strength:s.strength.slice(0,2).join(' ').slice(0,250),
    next:s.next[0].slice(0,250)};
}
function v224CurrentValues(priv,report){
  const stored=priv?.feedbackV210?.[report?.student?.id]||{};
  const standard=v224DefaultFeedback(report);
  return {strength:String(stored.strength||'').trim()||standard.strength,
    next:String(stored.next||'').trim()||standard.next};
}
const v224BeforeFeedback=v200Feedback;
v200Feedback=function(report,a){
  if(!report?.student)return v224BeforeFeedback(report,a);
  const prev=v200Eval?.privateData?.feedbackV210?.[report.student.id]||{};
  const generated=v224DefaultFeedback(report);
  return {strength:String(prev.strength||'').trim()||generated.strength,
    next:String(prev.next||'').trim()||generated.next};
};
function v224Status(report){
  if(report.participationV210&&report.participationV210!=='present')return 'Nicht regulär mitgeschrieben';
  if(!report.complete)return 'Punkte noch unvollständig';
  const fb=v200Eval?.privateData?.feedbackV210?.[report.student.id];
  return fb&&(fb.strength||fb.next)?'Persönlich bearbeitet':'Vorschlag · noch prüfen';
}
function v224CompetenceRows(report){
  return (report.competencies||[]).filter(c=>c.regularMax>0).map(c=>{
    const pct=Number.isFinite(c.pct)?Math.round(c.pct):null;
    const percent=pct===null?'offen':pct+' %';
    const style=pct===null?'open':pct>=90?'strong':pct>=70?'partial':'practice';
    return '<div class="v224-competence v224-'+style+'"><div><strong>'+esc(c.text)+'</strong>'
      +'<small>'+esc(c.status||'noch offen')+' · '+esc(percent)
      +' · '+esc(c.adjusted)+' / '+esc(c.regularMax)+' reguläre Punkte'
      +(Number(c.bonusEarned)>0?' · '+esc(c.bonusEarned)+' Bonuspunkte erzielt':'')+'</small></div></div>';
  }).join('');
}
function v224Step5Page(a,priv){
  const reports=v224Report(),idx=v224Index(reports.length),r=reports[idx];
  if(!r)return '<section class="detail-section"><h3>Prüfen & Drucken</h3>'
    +'<p>Bitte erst die Teilnehmerliste und Ergebnisse erfassen.</p></section>';
  const fb=v224CurrentValues(priv,r),s=v224Suggestions(r),completed=reports.filter(x=>x.complete).length;
  const options=reports.map((x,i)=>'<option value="'+i+'" '+(i===idx?'selected':'')+'>'
    +esc(x.student.name)+' · '+esc(v224Status(x))+'</option>').join('');
  const strengthTips=s.strength.map((x,i)=>'<button type="button" class="v224-chip" data-v224-phrase="strength" data-v224-phrase-index="'+i+'">'+esc(x)+'</button>').join('');
  const nextTips=s.next.map((x,i)=>'<button type="button" class="v224-chip" data-v224-phrase="next" data-v224-phrase-index="'+i+'">'+esc(x)+'</button>').join('');
  const missing=reports.length-completed;
  return '<section class="detail-section v224-review">'
    +'<div class="v224-review-heading"><div><span class="eyebrow">SCHRITT 5 · PRÜFEN & DRUCKEN</span>'
    +'<h3>Eine Rückmeldung nach der anderen</h3><p>Kontrolliere kurz die Ergebnisse und formuliere eine ermutigende persönliche Rückmeldung.</p></div>'
    +'<span class="v224-count">'+(idx+1)+' / '+reports.length+'</span></div>'
    +'<div class="v224-navigator"><button type="button" class="secondary" data-v224-prev '+(idx===0?'disabled':'')+'>← Vorheriges Kind</button>'
    +'<label>Auswählen <select data-v224-student>'+options+'</select></label>'
    +'<button type="button" class="secondary" data-v224-next '+(idx===reports.length-1?'disabled':'')+'>Nächstes Kind →</button></div>'
    +'<div class="v224-review-summary"><strong>'+esc(r.student.name)+'</strong> · '
    +(r.complete?esc(r.totalAdjusted)+' / '+esc(r.totalMax)+' Punkte'
      +(Number(r.totalBonusEarned)>0?' · '+esc(r.totalBonusEarned)+' Bonuspunkte erzielt':''):
      'Noch unvollständig: '+esc((r.missing||[]).join(', ')))+'</div>'
    +'<h4>Kompetenzen auf einen Blick</h4><div class="v224-competences">'+v224CompetenceRows(r)+'</div>'
    +'<details class="v224-audit"><summary>Aufgaben und genaue Punkteverteilung ansehen</summary>'
    +v210CalculationDetail(priv,a.evaluationV200.analysis,r.student)+'</details>'
    +'<div class="v224-editor"><h4>Deine persönliche Rückmeldung</h4>'
    +'<p class="microcopy">Vorschläge beruhen nur auf den vergebenen Punkten und Bonuspunkten. '
    +'Deine Beobachtungen aus der schriftlichen Arbeit ergänzt du selbst. '
    +'Die beiden Texte werden im PDF verwendet, sobald du sie speicherst.</p>'
    +'<label>Was schon gut gelingt <textarea data-v224-strength maxlength="250" rows="3">'+esc(fb.strength)+'</textarea></label>'
    +'<div class="v224-chips">'+strengthTips+'</div>'
    +'<label>Ein nächster Lernschritt <textarea data-v224-next-text maxlength="250" rows="3">'+esc(fb.next)+'</textarea></label>'
    +'<div class="v224-chips">'+nextTips+'</div>'
    +'<div class="v224-editor-actions"><button type="button" class="secondary" data-v224-reset>Automatischen Vorschlag einsetzen</button>'
    +'<button type="button" class="primary" data-v224-save>Rückmeldung speichern ✓</button></div>'
    +'<p class="v224-status" id="v224-save-status" role="status" aria-live="polite">Änderungen werden lokal gesichert, bevor du zum nächsten Kind gehst.</p>'
    +'<div class="v224-preview"><strong>So klingt die Rückmeldung auf dem Bogen:</strong>'
    +'<p data-v224-preview-strength>'+esc(fb.strength)+'</p>'
    +'<p data-v224-preview-next>'+esc(fb.next)+'</p></div>'
    +'<details class="v224-ai"><summary>Optional: mit ChatGPT sprachlich schöner formulieren</summary>'
    +'<p>Schulcockpit sendet nichts automatisch. Du kopierst auf Wunsch selbst eine '
    +'<strong>namenlose Formulierungshilfe</strong> ohne Klasse, Datum, Punktwerte oder individuelle Aufgabenantworten. '
    +'Auch Kompetenzstärken sind persönliche Leistungsinformationen: Bitte nur verwenden, wenn dies datenschutzrechtlich zulässig ist.</p>'
    +'<button type="button" class="secondary" data-v224-copy-prompt>Anonymisierte Formulierungshilfe kopieren</button>'
    +'<label>Antwort von ChatGPT hier einfügen (optional)<textarea rows="4" data-v224-ai-result '
    +'placeholder="STÄRKE: ...\nNÄCHSTER SCHRITT: ..."></textarea></label>'
    +'<button type="button" class="secondary" data-v224-use-ai>Textvorschlag in die Felder übernehmen</button>'
    +'</details></div>'
    +'</section>'
    +'<section class="detail-section v224-print"><h3>Drucken, wenn die Rückmeldungen passen</h3>'
    +'<p>'+completed+' von '+reports.length+' Kompetenzbögen vollständig.'
    +(missing?' '+missing+' Bögen haben noch offene Bewertungen und können beim ZIP-Export ausgelassen werden.':'')
    +' Die persönlichen Texte werden vor dem Druck noch einmal mitgenommen.</p>'
    +'<div class="v200-actions"><button class="secondary" data-v200-step="4">← Punkte korrigieren</button>'
    +'<button class="secondary" data-v200-combined-pdf '+(!completed?'disabled':'')+'>Gesamt-PDF</button>'
    +'<button class="primary" data-v200-pdf-zip '+(!completed?'disabled':'')+'>Einzelne Kompetenzbögen als PDF-ZIP</button></div>'
    +'<details><summary>Klassenüberblick (nur für dich)</summary><div class="v224-aggregate">'
    +(a.evaluationV200.analysis.competencies||[]).map(c=>{
      const rc=reports.filter(x=>x.complete).map(x=>x.competencies.find(z=>z.id===c.id)).filter(Boolean);
      return '<p><strong>'+esc(c.text)+'</strong> · '+rc.filter(x=>x.status==='erreicht').length+' erreicht, '
        +rc.filter(x=>x.status==='teilweise erreicht').length+' teilweise, '
        +rc.filter(x=>x.status==='noch nicht erreicht').length+' noch nicht erreicht</p>';
    }).join('')+'</div></details></section>';
}
v200Step5=v224Step5Page;
function v224FeedbackPrompt(report){
  const cs=v224Competencies(report);
  const strongest=cs.filter(c=>c.pct>=80).slice(0,2).map(c=>v224Clean(c.text));
  const focus=cs.filter(c=>c.pct<70).slice(-1).map(c=>v224Clean(c.text));
  const hasBonus=cs.some(c=>Number(c.bonusEarned)>0);
  return 'Bitte formuliere zwei kurze, warmherzige und natürliche Rückmeldungen auf Deutsch '
    +'für eine Mathematikarbeit der Sekundarstufe I. Sprich das Kind mit „du“ an, '
    +'klinge wie eine freundliche Lehrkraft, nicht wie ein Bewertungsalgorithmus. '
    +'Keine unbelegten Eigenschaften wie Fleiß, Sorgfalt oder Anstrengung behaupten. '
    +'Beschreibe höchstens zwei gelungene Fähigkeiten und einen konkreten Übungsschwerpunkt. '
    +'Schwachstellen freundlich, aber klar benennen. Verwende keine Prozente, Punkte oder Aufgabennummern. '
    +'Maximal je 230 Zeichen. Nur zwei Zeilen im Format STÄRKE: ... und NÄCHSTER SCHRITT: ...\n'
    +'Gut erkennbar: '+(strongest.join('; ')||'noch keine eindeutig herausragende Kompetenz')+'\n'
    +'Weiter üben: '+(focus.join('; ')||'einen passenden nächsten Schritt ohne erfundene Schwächen')+'\n'
    +'Zusätzliche Bonusleistung: '+(hasBonus?'ja':'nicht angegeben')+'\n'
    +'Es sind bewusst keine Namen, Einzelpunkte, Antworten, Klassen- oder Schulangaben enthalten.';
}
function v224StudentValue(){return document.querySelector('[data-v224-student]');}
function v224DraftFields(){
  return {strength:document.querySelector('[data-v224-strength]'),
    next:document.querySelector('[data-v224-next-text]')};
}
function v224Notice(text,kind='note'){
  const el=document.getElementById('v224-save-status');
  if(el){el.textContent=text;el.dataset.kind=kind;el.setAttribute('role',kind==='error'?'alert':'status');}
}
function v224RefreshPreview(){
  const d=v224DraftFields();
  const s=document.querySelector('[data-v224-preview-strength]'),
    n=document.querySelector('[data-v224-preview-next]');
  if(s)s.textContent=d.strength?.value||'';
  if(n)n.textContent=d.next?.value||'';
}
let v224SaveQueue=Promise.resolve(),v224DraftDirty=false;
function v224Serialized(work){
  const next=v224SaveQueue.then(work);v224SaveQueue=next.catch(()=>{});return next;
}
async function v224SaveFeedback(){
  const p=v200Eval?.privateData,rs=v224Report(),r=rs[v224Index(rs.length)];
  if(!p||!r)throw Error('Aktuelle Rückmeldung nicht gefunden.');
  const inputs=v224DraftFields();
  if(!inputs.strength||!inputs.next)throw Error('Die Rückmeldungsfelder fehlen.');
  const draft={strength:inputs.strength.value.trim().slice(0,250),
    next:inputs.next.value.trim().slice(0,250)};
  const last=p.feedbackV210?.[r.student.id],old=last?structuredClone(last):undefined;
  if(!p.feedbackV210)p.feedbackV210={};
  if(JSON.stringify(last||{})===JSON.stringify(draft)){
    v224DraftDirty=false;v224Notice('✓ Rückmeldung bereits lokal gespeichert.','success');return true;
  }
  p.feedbackV210[r.student.id]=draft;
  try{await v200PrivatePut(p);}
  catch(err){
    if(old===undefined)delete p.feedbackV210[r.student.id];
    else p.feedbackV210[r.student.id]=old;
    v224Notice('Nicht gespeichert: '+(err.message||err)+'. Bitte Seite nicht schließen.','error');
    throw err;
  }
  v224DraftDirty=false;
  v224Notice('✓ Persönliche Rückmeldung lokal gespeichert.','success');
  v224RefreshPreview();
  return true;
}
async function v224GoStudent(nextIndex){
  const len=v224Report().length;
  if(!Number.isInteger(nextIndex)||nextIndex<0||nextIndex>=len)return;
  const select=v224StudentValue();
  const prev=v224Index(len);
  try{
    if(v224DraftDirty)await v224Serialized(v224SaveFeedback);
    v200Eval.studentIndex=nextIndex;
    render();
  }catch(err){
    if(select)select.value=String(prev);
    v224Notice('Kind nicht gewechselt: '+(err.message||err),'error');
  }
}
function v224AppendPhrase(kind,phrase){
  const d=v224DraftFields(),el=kind==='strength'?d.strength:d.next;
  if(!el||!phrase)return;
  const prior=el.value.trim();
  if(prior.includes(phrase))return;
  const next=(prior?prior+' ':'')+phrase;
  if(next.length>250){v224Notice('Der Text ist zu lang. Kürze ihn bitte vor dem Speichern.','warning');return;}
  el.value=next;v224DraftDirty=true;v224RefreshPreview();v224Notice('Text ergänzt – beim Wechsel wird automatisch gespeichert.','note');
}
const v224WireBefore=wire;
wire=function(){
  v224WireBefore();
  if(view!=='evaluation'||v200Eval?.step!==5)return;
  const priv=v200Eval.privateData,reports=v224Report(),r=reports[v224Index(reports.length)];
  if(!r)return;
  const select=v224StudentValue();
  select?.addEventListener('change',()=>void v224GoStudent(Number(select.value)));
  document.querySelector('[data-v224-prev]')?.addEventListener('click',()=>void v224GoStudent(v224Index(reports.length)-1));
  document.querySelector('[data-v224-next]')?.addEventListener('click',()=>void v224GoStudent(v224Index(reports.length)+1));
  const fields=v224DraftFields();
  for(const el of [fields.strength,fields.next]){
    el?.addEventListener('input',()=>{v224DraftDirty=true;v224RefreshPreview();v224Notice('Noch nicht gespeichert – beim Wechsel automatisch sichern.','note');});
    el?.addEventListener('blur',()=>{if(v224DraftDirty)void v224Serialized(v224SaveFeedback).catch(()=>{});});
  }
  document.querySelector('[data-v224-save]')?.addEventListener('click',()=>void v224Serialized(v224SaveFeedback).catch(()=>{}));
  document.querySelector('[data-v224-reset]')?.addEventListener('click',()=>{
    const standard=v224DefaultFeedback(r);
    if(fields.strength)fields.strength.value=standard.strength;
    if(fields.next)fields.next.value=standard.next;
    v224DraftDirty=true;v224RefreshPreview();
    v224Notice('Vorschläge eingesetzt. Bitte bei Bedarf anpassen und speichern.','note');
  });
  document.querySelectorAll('[data-v224-phrase]').forEach(btn=>btn.addEventListener('click',()=>{
    const choice=v224Suggestions(r)[btn.dataset.v224Phrase]?.[Number(btn.dataset.v224PhraseIndex)];
    v224AppendPhrase(btn.dataset.v224Phrase,choice);
  }));
  document.querySelector('[data-v224-copy-prompt]')?.addEventListener('click',async()=>{
    // Never transmit or export names, scores, school, class, or response data.
    try{await navigator.clipboard.writeText(v224FeedbackPrompt(r));v224Notice('Namenloser Prompt kopiert. Du entscheidest selbst, ob du ihn in ChatGPT einfügst.','success');}
    catch(e){v224Notice('Kopieren fehlgeschlagen: '+(e.message||e),'error');}
  });
  document.querySelector('[data-v224-use-ai]')?.addEventListener('click',()=>{
    const text=document.querySelector('[data-v224-ai-result]')?.value||'';
    const m=text.match(/(?:^|\n)\s*STÄRKE:\s*([^\n]+)/i),
      n=text.match(/(?:^|\n)\s*NÄCHSTER SCHRITT:\s*([^\n]+)/i);
    if(!m&&!n){v224Notice('Bitte die zwei Zeilen STÄRKE: und NÄCHSTER SCHRITT: einfügen.','warning');return;}
    if(m&&fields.strength)fields.strength.value=m[1].trim().slice(0,250);
    if(n&&fields.next)fields.next.value=n[1].trim().slice(0,250);
    v224DraftDirty=true;v224RefreshPreview();
    v224Notice('Sprachvorschlag übernommen, noch nicht gespeichert. Bitte kontrollieren.','note');
  });
  // Printing must never silently omit changes to the currently visible feedback.
  for(const button of document.querySelectorAll('[data-v200-pdf-zip],[data-v200-combined-pdf]')){
    const clone=button.cloneNode(true);button.replaceWith(clone);
    clone.addEventListener('click',async()=>{
      if(clone.disabled)return;clone.disabled=true;
      try{
        if(v224DraftDirty)await v224Serialized(v224SaveFeedback);
        if(clone.hasAttribute('data-v200-pdf-zip'))await v200DownloadPdfZip();
        else await v200DownloadCombinedPdf();
      }catch(e){v224Notice('PDF nicht erstellt: '+(e.message||e),'error');}
      finally{if(clone.isConnected)clone.disabled=false;}
    });
  }
};
const v224RenderBefore=render;
render=function(){
  v224RenderBefore();
  const asset=document.querySelector('link[rel="stylesheet"]')?.getAttribute('href')||'';
  const version=asset.match(/[?&]v=(\d+\.\d+\.\d+)/)?.[1]||V224_VERSION.replace(/^V/,'');
  const mark=document.querySelector('.brand small');
  if(mark)mark.textContent=state.settings.schoolYear+' · V'+version;
};
render();