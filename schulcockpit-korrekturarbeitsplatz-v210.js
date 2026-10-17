/* Schulcockpit V0.21.0 – sichtbar geführter Korrekturarbeitsplatz.
 * Fachanalyse zuerst, Classtime und Papierscores danach, lokale Nachrechnung.
 * Keine Änderung der Klassen-/Stunden- oder Curriculumdaten. */
const v210NavBefore=v200StepNav;
v200StepNav=function(step){
  const labels=['','1 · Unterlagen','2 · Kompetenzen','3 · Fragen & Excel','4 · Punkte','5 · Prüfen & Drucken'];
  return '<nav class="v200-steps v210-steps" aria-label="Korrekturablauf">'+[1,2,3,4,5].map(n=>
    '<button class="'+(step===n?'active':n<step?'done':'')+'" data-v200-step="'+n+'">'+labels[n]+'</button>').join('')+'</nav>';
};
const v210Step1Before=v200Step1;
v200Step1=function(a,priv){
  const html=v210Step1Before(a,priv),c=cls(a.classId),isLower=v202Grade(c)<=7;
  const examFiles=(a.files||[]).map(f=>'<span class="v210-file">'+esc(f.name)+'</span>').join('');
  const head='<section class="detail-section v210-intro"><h3>1. Klassenarbeit und Quellen vorbereiten</h3>'
    +'<p>Zuerst die <strong>Aufgaben der Klassenarbeit</strong>, den vorhandenen Erwartungshorizont und '+(isLower?'das vorhandene <strong>Kompetenzraster</strong> (Klassen 5–7)':'optional ein Kompetenzraster')+' hinterlegen. Dann ordnet ChatGPT im nächsten Schritt nur die <em>Aufgaben</em> den passenden Lernzielen zu – ohne einen einzigen Schülerpunkt.</p>'
    +'<div class="v210-files">'+(examFiles||'<span class="warn">Noch keine Prüfungsdatei zugeordnet.</span>')+'</div>'
    +'<button class="secondary" data-v204-edit-assessment>Prüfungsdateien und Kompetenzraster hinzufügen / bearbeiten</button>'
    +'<p class="microcopy">Die Excel mit echten Ergebnissen kommt erst in Schritt 3. Bereits gespeicherte Quellen im Materialpool müssen nicht neu an ChatGPT geschickt werden, sofern sie als Prüfungsdatei hier hinterlegt sind.</p>'
    +'</section>';
  return head+html.replace('<span class="eyebrow">CLASSTIME · LOKAL</span>','<span class="eyebrow">CLASSTIME · SPÄTER IN SCHRITT 3</span>');
};
const v210Step2Before=v200Step2;
v200Step2=function(a,priv){
  return '<section class="detail-section v210-intro"><h3>2. Aufgaben und Kompetenzraster kontrollierbar zuordnen</h3><p>ChatGPT bekommt die leeren Prüfungsaufgaben und ihre Kompetenzgrundlagen. Jede Rasterzeile, der Aufgabenbezug, reguläre und mögliche Bonuspunkte werden anschließend in Schritt 3 angezeigt und sind bearbeitbar. <strong>Individuelle Schülerergebnisse werden nie an ChatGPT übertragen.</strong></p></section>'+v210Step2Before(a,priv);
};
function v210ExcelState(priv,an){
  const ct=priv?.classtime;
  if(!ct)return {preview:'',problems:[],audit:null};
  v200AutoMapItems(priv,an);
  const audit=v210ScoreAudit(priv,an),cols=v200QuestionColumns(ct);
  const qRows=cols.map(col=>{
    const rule=v210QuestionRule(ct,col.label);
    const option=(name,label)=>'<option value="'+name+'" '+(rule===name?'selected':'')+'>'+label+'</option>';
    return '<tr><td>'+esc(col.label)+'</td><td>'+esc(col.description||'–')+'</td><td>'+esc(col.max??'–')+'</td>'
      +'<td>'+(col.max===0?'<strong>Bonus-Kandidat: manuell bewerten</strong>':
        '<select data-v210-rule="'+esc(col.label)+'">'
        +option('original','Classtime-Wert beibehalten')
        +option('binary','Nur 0 oder 1 (Teilpunkte → 0)')
        +option('quarter','Auf Viertelpunkte runden')
        +'</select>')+'</td></tr>';
  }).join('');
  const warnings=audit.problems.length?'<div class="warnbox"><strong>Übernahme noch gesperrt:</strong> '+esc(audit.problems.slice(0,6).join('; '))+(audit.problems.length>6?' …':'')+'</div>':'';
  const preview='<section class="detail-section v210-excel-review"><h3>Classtime: Vorschau vor jeder Übernahme</h3>'
    +'<p><strong>'+esc(ct.parsed.fileName)+'</strong> · '+esc(ct.parsed.sheets[ct.detection.sheetIndex]?.name||'')+' · '+esc((priv.roster||[]).length)+' Lernende.</p>'
    +'<p class="microcopy">Die Regeln gelten für die ganze jeweilige Frage, nicht für die gesamte Arbeit. Bei Q3/Q4 kannst du „Nur 0 oder 1“ wählen; die Originalwerte bleiben lokal im eingelesenen Excel-Auszug erhalten. Nicht beantwortete reguläre Fragen werden nach Freigabe mit 0 bewertet. 0-Maximalpunkte-Fragen niemals als automatisch richtige Bonusaufgaben übernehmen.</p>'
    +'<div class="v210-scroll"><table class="v210-grid"><thead><tr><th>Frage</th><th>Aufgabenbeschreibung</th><th>Max.</th><th>Bewertungsregel</th></tr></thead><tbody>'+qRows+'</tbody></table></div>'
    +'<p>'+audit.count+' lesbare digitale Ergebnisse · '+audit.blank+' nicht beantwortete reguläre Aufgaben (nach Freigabe 0 Punkte) · '+audit.unusual.length+' Werte außerhalb von Viertelschritten.</p>'+warnings
    +(audit.unusual.length?'<p class="warn">Bitte Dezimalwerte kontrollieren: '+esc(audit.unusual.slice(0,6).join(', '))+'</p>':'')
    +'<details><summary>Beispielwerte und Rechenweg ansehen</summary><div class="v210-scroll"><table class="v210-grid"><thead><tr><th>Kind</th><th>Frage</th><th>Excel roh</th><th>Nach Regel</th></tr></thead><tbody>'
    +audit.rows.slice(0,36).map(x=>'<tr><td>'+esc(x.studentName)+'</td><td>'+esc(x.question)+'</td><td>'+esc(x.original)+'</td><td>'+esc(x.score===null?'offen':x.score)+'</td></tr>').join('')+'</tbody></table></div></details>'
    +'</section>';
  return {preview,problems:audit.problems,audit};
}
const v210Step3Before=v200Step3;
v200Step3=function(a,priv){
  const an=v200EvalAnalysis();if(!an)return v210Step3Before(a,priv);
  const list=an.items.map(it=>{
    const selection=(val,name)=>'<option value="'+val+'" '+(it.source===val?'selected':'')+'>'+name+'</option>';
    const comps=an.competencies.map(c=>'<option value="'+esc(c.id)+'" '+(it.competencyId===c.id?'selected':'')+'>'+esc(c.text)+'</option>').join('');
    return '<tr><td>'+esc(it.label||it.id)+'</td><td><select data-v210-kind="'+esc(it.id)+'">'
      +selection('classtime','Classtime regulär')+selection('paper','Papier regulär')
      +selection('classtime_bonus','Classtime Bonus')+selection('paper_bonus','Papier Bonus')+'</select></td>'
      +'<td><input data-v210-regular="'+esc(it.id)+'" inputmode="decimal" value="'+esc(it.regularMax??0)+'" aria-label="Reguläre Maximalpunkte"></td>'
      +'<td><input data-v210-bonus="'+esc(it.id)+'" inputmode="decimal" value="'+esc(it.bonusMax??0)+'" aria-label="Bonus-Maximalpunkte"></td>'
      +'<td><select data-v210-criterion="'+esc(it.id)+'">'+comps+'</select></td></tr>';
  }).join('');
  const metadata='<section class="detail-section"><h3>3. Aufgabenplan – alles nachprüfbar</h3>'
    +'<p>Diese Tabelle stammt aus der fachlichen Analyse. Kontrolliere vor den Ergebnissen: <strong>Quelle, mögliche Punkte, Bonusstatus und Kompetenz</strong>. Aufgaben können mehrere Zeilen derselben Kompetenz zugeordnet bekommen. Bonuspunkte zählen nicht zur regulären Höchstpunktzahl.</p>'
    +'<div class="v210-scroll"><table class="v210-grid"><thead><tr><th>Aufgabe</th><th>Bearbeitet in</th><th>Regulär max.</th><th>Bonus max.</th><th>Kompetenzraster</th></tr></thead><tbody>'+list+'</tbody></table></div>'
    +'<div class="v200-actions"><button class="secondary" data-v210-add-paper>Schriftliche Teilaufgabe hinzufügen</button><button class="primary" data-v210-save-items>Aufgabenplan kontrollieren und speichern</button></div>'
    +'<p class="microcopy">Änderungen an der Kompetenz-/Punktezuordnung setzen die Freigabe für den Ausdruck zurück. Vorhandene eingegebene Einzelpunkte werden nicht automatisch überschrieben.</p></section>';
  const files='<section class="detail-section"><div class="section-head compact"><div><h3>Erst jetzt: Classtime-Ergebnisse lokal importieren</h3><p>Es geht nur um die Punkte. ChatGPT benötigt diese Datei nicht.</p></div><label class="upload-button">Excel auswählen<input id="v210-excel-file" type="file" accept=".xlsx" hidden></label></div>'
    +(priv?.classtime?'<p class="microcopy">Excel erkannt. Bitte darunter Fragenregeln und Spalten prüfen, dann erst die digitalen Punkte freigeben.</p>':'<p>Keine Classtime-Datei eingelesen. Bei reinen Papierarbeiten kannst du direkt mit den manuellen Punkten fortfahren.</p>')
    +'</section>';
  const excel=v210ExcelState(priv,an);
  const old=v210Step3Before(a,priv);
  // Der bisherige Spalteneditor bleibt erhalten. Der alte Speicherknopf
  // wird durch die sichere Vorschau-Bestätigung ersetzt.
  const safe=old.replace('Zuordnung speichern & Punkte übernehmen','Nach Prüfung: digitale Punkte übernehmen');
  return metadata+files+excel.preview+safe;
};
function v210ScoreMap(priv,it,id){
  if(it.source==='classtime')return priv.scores?.[id]?.[it.id];
  if(it.source==='paper')return priv.paperScores?.[id]?.[it.id];
  return priv.bonusScores?.[id]?.[it.id];
}
function v210ScoreTable(a,priv){
  const an=v200EvalAnalysis(),items=an?.items||[],roster=priv?.roster||[];
  if(!an||!roster.length)return '<section class="detail-section"><h3>4. Punkte erfassen</h3><p>Bitte zuerst eine Teilnehmerliste erfassen und die Aufgabenstruktur prüfen.</p></section>';
  const max=it=>it.source.endsWith('_bonus')?Number(it.bonusMax)||0:Number(it.regularMax)||0;
  const cols=items.map(it=>'<th title="'+esc(it.source)+'">'+esc(it.label||it.id)
    +'<small>'+esc(it.source.endsWith('_bonus')?'Bonus ':'')+esc(max(it))+' P.</small></th>').join('');
  const rows=roster.map((stu,i)=>{
    const status=priv.participationV210?.[stu.id]||'present';
    const opt=(v,label)=>'<option value="'+v+'" '+(v===status?'selected':'')+'>'+label+'</option>';
    return '<tr><th class="v210-student"><span>'+esc(stu.name)+'</span><small>S'+(i+1)+'</small>'
      +'<select data-v210-participation="'+esc(stu.id)+'">'+opt('present','Mitgeschrieben')
      +opt('absent','Nicht mitgeschrieben')+opt('makeup','Nachschreiben offen')
      +opt('variant','Andere Arbeit – gesondert prüfen')+'</select></th>'
      +items.map(it=>{
        const v=v210ScoreMap(priv,it,stu.id),m=max(it),digital=it.source==='classtime';
        return '<td><input data-v210-grid-score="'+esc(stu.id)+'|'+esc(it.id)+'" type="text" inputmode="decimal"'
          +' value="'+esc(v===undefined||v===null?'':v)+'" placeholder="–" aria-label="'+esc(stu.name+' '+(it.label||it.id))+'"'
          +(status!=='present'?' disabled':'')
          +' title="'+esc((digital?'Classtime (bei Bedarf korrigierbar)':'Manuell')+' · 0–'+m)+'"></td>';
      }).join('')+'</tr>';
  }).join('');
  return '<section class="detail-section v210-scores"><h3>4. Einmal eingeben – ohne ständig zur Maus zu greifen</h3>'
    +'<p>Alle Lernenden untereinander, alle Aufgaben nebeneinander. Digitale Ergebnisse stehen bereits eingetragen; du darfst sie lokal korrigieren. Bei Papier- und Bonusaufgaben gibst du selbst Punkte ein. <strong>Enter</strong> speichert und springt zum nächsten Feld.</p>'
    +'<p class="microcopy">Leeres Feld = noch zu prüfen; ausdrücklich eingegebene 0 = 0 Punkte. Fehlende Kinder bleiben sichtbar, werden aber nicht als „0 Punkte in der Arbeit“ beurteilt.</p>'
    +'<div class="v210-scroll v210-score-scroll"><table class="v210-grid v210-score-grid"><thead><tr><th>Teilnehmende / Status</th>'+cols+'</tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<p class="microcopy">Personenbezogene Punktzahlen werden ausschließlich im lokalen privaten Browserdatenspeicher gespeichert, nicht im regulären JSON-Backup.</p>'
    +'<div class="v200-actions"><button class="secondary" data-v200-step="3">← Aufgaben und Excel</button><button class="primary" data-v200-step="5">Berechnung und Kompetenzbögen kontrollieren →</button></div></section>';
}
v200Step4=function(a,priv){return v210ScoreTable(a,priv);};

const v210StudentReportBefore=v200StudentReport;
v200StudentReport=function(priv,an,stu){
  const status=priv.participationV210?.[stu.id]||'present';
  const old=v210StudentReportBefore(priv,an,stu);
  if(status!=='present')return {...old,participationV210:status,complete:false,missing:['Status: '+status]};
  const comp=new Map((an.competencies||[]).map(c=>[c.id,{...c,regularMax:0,regularEarned:0,bonusEarned:0,itemLabels:[],auditV210:[]}]));
  let totalMax=0,totalReg=0,totalBonus=0;const missing=[];
  for(const it of an.items||[]){
    const c=comp.get(it.competencyId);if(!c)continue;
    const raw=v200GetScore(priv,stu.id,it),bonus=it.source.endsWith('_bonus'),
          mx=bonus?Number(it.bonusMax)||0:Number(it.regularMax)||0;
    if(raw===null||raw===undefined||raw===''){missing.push(it.label||it.id);}
    const valid=raw!==null&&raw!==undefined&&raw!==''&&Number.isFinite(Number(raw));
    const earned=valid?Math.min(mx,Math.max(0,Number(raw))):0;
    c.itemLabels.push(it.label||it.id);
    c.auditV210.push({label:it.label||it.id,source:it.source,earned:valid?earned:null,max:mx});
    if(bonus){c.bonusEarned+=earned;totalBonus+=earned;}
    else {c.regularMax+=mx;c.regularEarned+=earned;totalMax+=mx;totalReg+=earned;}
  }
  const competencies=[...comp.values()].map(c=>{
    const adjusted=Math.min(c.regularMax,c.regularEarned+c.bonusEarned),pct=c.regularMax?adjusted/c.regularMax*100:null;
    return {...c,adjusted,pct,status:v200StatusFor(pct,an.thresholds)};
  });
  const totalAdjusted=Math.min(totalMax,totalReg+totalBonus);
  return {student:stu,competencies,totalMax,totalReg,totalBonus,totalAdjusted,
    totalPct:totalMax?totalAdjusted/totalMax*100:null,missing,complete:missing.length===0,
    participationV210:'present'};
};
function v210CalculationDetail(priv,an,stu){
  const r=v200StudentReport(priv,an,stu);
  return '<div class="v210-calculation"><h4>'+esc(stu.name)+' · Rechenweg</h4>'
    +(r.participationV210!=='present'?'<p class="warn">Status: '+esc(r.participationV210)+' – kein automatischer Kompetenzbogen.</p>':'')
    +r.competencies.map(c=>'<div class="v210-calculation-row"><strong>'+esc(c.text)+'</strong><small>'
      +c.auditV210.map(x=>esc(x.label)+': '+(x.earned===null?'offen':x.earned)+'/'+x.max+(x.source.endsWith('_bonus')?' Bonus':'')).join(' · ')
      +'</small><div>Regulär '+c.regularEarned+'/'+c.regularMax+' + '+c.bonusEarned+' Bonus → '
      +c.adjusted+'/'+c.regularMax+' = '+(c.pct===null?'offen':Math.round(c.pct*10)/10+' %')
      +' → <strong>'+esc(c.status||'noch nicht feststellbar')+'</strong></div></div>').join('')
    +'<p><strong>Gesamt:</strong> '+r.totalReg+' regulär + '+r.totalBonus+' Bonus (gedeckelt auf '+r.totalMax
    +') = '+r.totalAdjusted+'/'+r.totalMax+' Punkte. '+(r.missing.length?'Offen: '+esc(r.missing.join(', ')):'Alle Punkte erfasst.')+'</p></div>';
}
const v210Step5Before=v200Step5;
v200Step5=function(a,priv){
  const html=v210Step5Before(a,priv),an=v200EvalAnalysis();
  if(!an||!priv?.roster?.length)return html;
  let idx=Math.max(0,Math.min(Number(v200Eval.studentIndex)||0,priv.roster.length-1));
  return '<section class="detail-section v210-audit"><h3>5. Jede Bewertung nachvollziehen</h3>'
    +'<label>Berechnung für <select data-v210-audit-student>'
    +priv.roster.map((s,i)=>'<option value="'+i+'" '+(i===idx?'selected':'')+'>'+esc(s.name)+'</option>').join('')
    +'</select></label>'+v210CalculationDetail(priv,an,priv.roster[idx])
    +'<p class="microcopy">Automatisierte Rückmeldung: Das bestehende System hebt eine Stärke und ein Übungsziel aus den Ergebnissen hervor. Namen und Punkte gehen dafür nicht an ChatGPT. Die Option für deine Unterschrift und gegebenenfalls die Elternunterschrift findest du bei den PDF-Einstellungen darunter.</p>'
    +'</section>'+html;
};
const v210EvaluationModalBefore=v200EvaluationModal;
v200EvaluationModal=function(){
  const html=v210EvaluationModalBefore();
  return html.replace('modal modal-xwide v200-modal','modal modal-xwide v200-modal v210-workspace');
};
function v210StatusLabel(key){return ({present:'mitgeschrieben',absent:'gefehlt',makeup:'Nachschreiben offen',variant:'andere Prüfungsvariante'})[key]||key;}
const v210CompletenessBefore=v200StudentCompleteness;
v200StudentCompleteness=function(priv,an,stu){
  const st=priv.participationV210?.[stu.id]||'present';
  if(st!=='present')return {need:an?.items?.length||0,done:0,complete:false};
  return v210CompletenessBefore(priv,an,stu);
};
async function v210SaveItems(){
  const a=v200Assessment(v200Eval?.assessmentId),an=v200EvalAnalysis();
  if(!an)throw Error('Keine Aufgabenanalyse vorhanden.');
  const originals=structuredClone(an.items);
  const get=(type,id)=>document.querySelector('['+type+'="'+id+'"]');
  const validSources=['classtime','paper','classtime_bonus','paper_bonus'];
  const validComps=new Set((an.competencies||[]).map(c=>c.id));
  for(const it of an.items){
    const kind=get('data-v210-kind',it.id)?.value||it.source,
       c=get('data-v210-criterion',it.id)?.value||it.competencyId,
       reg=v210StrictScore(get('data-v210-regular',it.id)?.value),
       bon=v210StrictScore(get('data-v210-bonus',it.id)?.value);
    if(!validSources.includes(kind)||!validComps.has(c))throw Error('Quelle oder Kompetenzzuordnung fehlt bei '+(it.label||it.id));
    if(reg===null||bon===null||reg<0||bon<0)throw Error('Maximalpunkte fehlen oder sind ungültig bei '+(it.label||it.id));
    if(kind.endsWith('_bonus')&&reg!==0)throw Error('Bonusaufgaben dürfen keine regulären Maximalpunkte haben: '+(it.label||it.id));
    if(!kind.endsWith('_bonus')&&reg<=0)throw Error('Reguläre Aufgaben brauchen mehr als 0 Maximalpunkte: '+(it.label||it.id));
    it.source=kind;it.competencyId=c;it.regularMax=reg;it.bonusMax=bon;
  }
  const oldApproval=a.competencySelectionV204?.teacherReviewedV205;
  if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=false;
  try{await saveState();}
  catch(e){an.items=originals;if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=oldApproval;throw e;}
  render();
}
async function v210AddPaperItem(){
  const a=v200Assessment(v200Eval?.assessmentId),an=v200EvalAnalysis();
  if(!an?.competencies?.length)throw Error('Bitte erst das Kompetenzraster importieren.');
  const label=prompt('Bezeichnung der schriftlichen Teilaufgabe (z. B. A7b):');
  if(!label?.trim())return;
  let id='Papier'+String(Date.now());
  while(an.items.some(x=>x.id===id))id+='x';
  // Bewusst ohne Maximalpunkte: muss in der Tabelle erst geprüft werden.
  an.items.push({id,label:label.trim(),source:'paper',regularMax:0,bonusMax:0,
    competencyId:an.competencies[0].id,classtimeAliases:[]});
  if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=false;
  await saveState();render();
}
async function v210SaveCell(input){
  const [sid,itemId]=String(input.dataset.v210GridScore||'').split('|');
  const priv=v200Eval?.privateData,an=v200EvalAnalysis(),it=an?.items?.find(x=>x.id===itemId);
  if(!priv||!it)throw Error('Teilaufgabe nicht gefunden.');
  if((priv.participationV210?.[sid]||'present')!=='present')return;
  const mx=it.source.endsWith('_bonus')?Number(it.bonusMax)||0:Number(it.regularMax)||0;
  const val=input.value.trim(),num=val===''?null:v210StrictScore(val);
  if(val!==''&&(num===null||num<0||num>mx))throw Error('Für '+(it.label||it.id)+' sind nur Punkte zwischen 0 und '+mx+' erlaubt.');
  const key=it.source==='classtime'?'scores':it.source==='paper'?'paperScores':'bonusScores';
  priv[key]=priv[key]||{};priv[key][sid]=priv[key][sid]||{};
  const old=priv[key][sid][itemId];
  if(num===null)delete priv[key][sid][itemId];else priv[key][sid][itemId]=num;
  try{await v200PrivatePut(priv);}catch(e){if(old===undefined)delete priv[key][sid][itemId];else priv[key][sid][itemId]=old;throw e;}
}
const v210WireBefore=wire;
wire=function(){
  v210WireBefore();
  document.getElementById('v210-excel-file')?.addEventListener('change',async e=>{
    const f=e.target.files?.[0];if(!f)return;
    try{e.target.disabled=true;await v200ImportClasstimeFile(f);}
    catch(err){alert('Noch keine Punkte übernommen: '+(err?.message||err));}
    finally{e.target.disabled=false;}
  });
  document.querySelector('[data-v210-save-items]')?.addEventListener('click',()=>v210SaveItems().catch(e=>alert(e.message||e)));
  document.querySelector('[data-v210-add-paper]')?.addEventListener('click',()=>v210AddPaperItem().catch(e=>alert(e.message||e)));
  for(const el of document.querySelectorAll('[data-v210-participation]')){
    el.onchange=async()=>{
      const p=v200Eval.privateData;p.participationV210=p.participationV210||{};
      const old=p.participationV210[el.dataset.v210Participation];
      p.participationV210[el.dataset.v210Participation]=el.value;
      try{await v200PrivatePut(p);render();}
      catch(e){if(old===undefined)delete p.participationV210[el.dataset.v210Participation];else p.participationV210[el.dataset.v210Participation]=old;alert(e.message||e);}
    };
  }
  const controls=[...document.querySelectorAll('[data-v210-grid-score]')];
  for(const [i,el] of controls.entries()){
    el.onchange=async()=>{try{await v210SaveCell(el);el.classList.remove('v210-error');}catch(e){el.classList.add('v210-error');alert(e.message||e);el.focus();}};
    el.onkeydown=async event=>{
      if(event.key!=='Enter')return;
      event.preventDefault();
      try{
        await v210SaveCell(el);
        const next=controls.slice(i+1).find(x=>!x.disabled);
        if(next){next.focus();next.select();}
        else{v200Eval.step=5;render();}
      }catch(e){el.classList.add('v210-error');alert(e.message||e);el.focus();}
    };
  }
  document.querySelector('[data-v210-audit-student]')?.addEventListener('change',e=>{
    v200Eval.studentIndex=Number(e.target.value)||0;render();
  });
};
const v210RenderBefore=render;
render=function(){
  v210RenderBefore();
  const brand=document.querySelector('.brand small');
  if(brand)brand.textContent=state.settings.schoolYear+' · '+V210_VERSION;
};
render();
