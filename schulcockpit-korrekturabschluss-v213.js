/* Schulcockpit V0.21.3 – Korrekturabschluss.
 * Datenschutz: private Excel-Antworten/Punkte nur im Browser, nie in Git/ChatGPT.
 * Erweitert V0.21.2, ohne alte Daten oder Exportformate zu migrieren. */
const V213_VERSION='V0.21.3';

/* Detailblätter verwenden S1...Sn, teils mit nachgestellten Leerzeichen.
 * Nur einen eindeutig passenden Datensatz akzeptieren; niemals anhand
 * zufälliger Namens- oder Zellenähnlichkeit Leistungen zuweisen. */
function v213Detail(ct,student,label){
  const det=ct?.detection,rows=det?.studentRows||[];
  if(!det?.sourceV210||!/^Q\d+$/i.test(String(label||'')))return null;
  const idx=rows.findIndex(x=>x.rowIndex===student?.rowIndex&&v200Norm(x.name)===v200Norm(student.name));
  if(idx<0)return null;
  const sheet=ct.parsed?.sheets?.find(x=>x.name.toUpperCase()===label.toUpperCase());
  if(!sheet)return null;
  const header=sheet.rows.findIndex(x=>/name des lernenden/i.test(String(x?.[0]||'')));
  if(header<0)return null;
  const expected='S'+(idx+1),matched=(sheet.rows.slice(header+1)||[])
    .filter(r=>String(r?.[0]??'').trim()===expected);
  if(matched.length!==1)return null;
  // Avoid accepting an apparently matching answer in a shuffled/wrong Q sheet.
  const nominal=sheet.rows[header+1+idx];
  if(!nominal||String(nominal[0]??'').trim()!==expected)return null;
  const answered=matched[0].slice(2).some(x=>x!==null&&x!==undefined&&String(x).trim()!=='');
  return {answered,question:label,studentIndex:idx};
}

v212AnswerStatus=function(ct,student,label,raw){
  const col=v200QuestionColumns(ct).find(c=>c.label.toUpperCase()===String(label||'').toUpperCase());
  const sheet=ct?.parsed?.sheets?.find(x=>x.name.toUpperCase()===String(label||'').toUpperCase());
  const value=v210StrictScore(raw),code=v210StrictScore(sheet?.rows?.[0]?.[1]);
  if(!ct?.detection?.sourceV210||!col||!sheet)return {status:'unknown'};
  if(value===null||code===null||!Number.isFinite(col.max)||value!==code||value<=col.max)
    return {status:'not-marker'};
  const detail=v213Detail(ct,student,label);
  if(!detail)return {status:'unknown'};
  return {status:detail.answered?'ungraded':'not-answered'};
};

/* Die Vorschau muss die Q3/Q4-Regel verwenden, die im Auswahlfeld angezeigt
 * wird. V0.21.0 prüfte vorher immer 'original', solange noch nicht gespeichert. */
const v213AuditBefore=v210ScoreAudit;
v210ScoreAudit=function(priv,an,mapping=null,ruleOverride=null){
  const rules={...(priv?.classtime?.rulesV210||{}),...(ruleOverride||{})};
  for(const c of v200QuestionColumns(priv?.classtime))
    if(!['original','binary','quarter'].includes(rules[c.label]))
      rules[c.label]=v210QuestionRule(priv.classtime,c.label);
  return v213AuditBefore(priv,an,mapping,rules);
};

function v213BonusRows(priv,an,mapping){
  const ct=priv?.classtime,all=v200QuestionColumns(ct).filter(c=>c.max===0),
    roster=priv?.roster||[],result=[],errors=[];
  if(!ct?.detection?.sourceV210)return {rows:[],errors:['Noch keine eindeutig erkannte Classtime-Datei.']};
  const bonus=(an?.items||[]).filter(it=>it.source==='classtime_bonus'),used=new Set();
  for(const it of bonus){
    const label=mapping?.[it.id]||'';
    if(!label){errors.push((it.label||it.id)+': Frage noch nicht zugeordnet');continue;}
    if(used.has(label)){errors.push('Dieselbe Bonusfrage ist mehrfach zugeordnet: '+label);continue;}
    used.add(label);
    if(!all.some(c=>c.label===label)){errors.push((it.label||it.id)+': '+label+' ist keine 0-Punkte-Classtime-Frage');continue;}
    if(!(Number(it.bonusMax)>0)){errors.push((it.label||it.id)+': Bonus-Maximalpunkte zuerst im Aufgabenplan festlegen');continue;}
    for(const stu of roster){
      const detail=v213Detail(ct,stu,label);
      if(!detail){errors.push(label+': Zuordnung der Frageblatt-Zeilen nicht eindeutig');break;}
      result.push({studentId:stu.id,itemId:it.id,label,answered:detail.answered});
    }
  }
  return {rows:result,errors:[...new Set(errors)]};
}
function v213BonusSuggestion(ct,it){
  const cols=v200QuestionColumns(ct).filter(c=>c.max===0);
  const allowed=[it.id,it.label,...(it.classtimeAliases||[])].map(x=>String(x||'').trim().toUpperCase());
  const matches=cols.filter(c=>allowed.includes(c.label.toUpperCase()));
  return matches.length===1?matches[0].label:'';
}
function v213BonusPanel(priv,an){
  const ct=priv?.classtime,bonus=an.items.filter(x=>x.source==='classtime_bonus');
  const info='<section class="detail-section v213-bonus"><h3>Bonus ohne Doppeltippen korrigieren</h3>'
    +'<p>Bei ausdrücklich ausgewählten Classtime-Bonusfragen kann Schulcockpit <strong>nachweislich leere Antworten</strong> auf 0 setzen. '
    +'Vorhandene Antworten bleiben offen, bis du sie selbst bewertest. Ein grüner Haken bei 0/0 ist kein Punktebeleg.</p>'
    +'<div class="v200-actions"><button class="secondary" data-v213-add-bonus="paper_bonus">Papier-Bonus hinzufügen</button>'
    +'<button class="secondary" data-v213-add-bonus="classtime_bonus">Classtime-Bonus hinzufügen</button></div>';
  if(!ct||!bonus.length)return info+'<p class="microcopy">Sobald Classtime-Bonusaufgaben im Aufgabenplan stehen, kannst du sie hier den echten Frage-IDs zuordnen.</p></section>';
  const cols=v200QuestionColumns(ct).filter(c=>c.max===0);
  const rows=bonus.map(it=>{
    const chosen=ct.bonusMappingV213?.[it.id]||v213BonusSuggestion(ct,it);
    return '<label>'+esc(it.label||it.id)+' → <select data-v213-bonus-map="'+esc(it.id)+'">'
      +'<option value="">— Bonusfrage auswählen —</option>'
      +cols.map(c=>'<option value="'+esc(c.label)+'" '+(chosen===c.label?'selected':'')+'>'+esc(c.label)+'</option>').join('')
      +'</select></label>';
  }).join('');
  return info+'<div class="v213-bonus-map">'+rows+'</div>'
    +'<button class="secondary" data-v213-bonus-zeros>Geprüfte leere Bonusantworten als 0 speichern</button>'
    +'<p class="microcopy">Nur nach deiner Bestätigung; bereits eingetragene Bonuspunkte bleiben unverändert. '
    +'Fehlende Classtime-Kommentare können nicht automatisch rekonstruiert werden.</p></section>';
}
async function v213SetUnansweredBonus(){
  const priv=v200Eval?.privateData,an=v200EvalAnalysis();
  if(!priv?.classtime||!an)throw Error('Bitte zuerst Analyse und Classtime-Datei einlesen.');
  const mapping={...(priv.classtime.bonusMappingV213||{})};
  for(const el of document.querySelectorAll('[data-v213-bonus-map]'))mapping[el.dataset.v213BonusMap]=el.value;
  const result=v213BonusRows(priv,an,mapping);
  if(result.errors.length)throw Error(result.errors.slice(0,5).join('; '));
  if(!result.rows.length)throw Error('Keine zugeordneten Bonusfragen.');
  const prior=priv.bonusScores||{},pending=result.rows.filter(r=>
    !r.answered && (prior[r.studentId]?.[r.itemId]===undefined||
      prior[r.studentId]?.[r.itemId]===null));
  const toReview=result.rows.filter(r=>r.answered && (prior[r.studentId]?.[r.itemId]===undefined||
      prior[r.studentId]?.[r.itemId]===null)).length;
  if(!confirm(pending.length+' eindeutig unbeantwortete Bonusfragen als 0 speichern?\n'
    +toReview+' tatsächlich beantwortete Bonusfragen bleiben für deine Punkteprüfung offen. '
    +'Bereits eingetragene Punkte werden nicht geändert.'))return;
  const previousScores=structuredClone(priv.bonusScores||{});
  const previousMap=structuredClone(priv.classtime.bonusMappingV213||{});
  const previousOrigin=structuredClone(priv.bonusOriginsV213||{});
  try{
    priv.classtime.bonusMappingV213=mapping;
    priv.bonusScores=structuredClone(previousScores);
    priv.bonusOriginsV213=structuredClone(previousOrigin);
    for(const entry of pending){
      priv.bonusScores[entry.studentId]=priv.bonusScores[entry.studentId]||{};
      priv.bonusScores[entry.studentId][entry.itemId]=0;
      priv.bonusOriginsV213[entry.studentId]=priv.bonusOriginsV213[entry.studentId]||{};
      priv.bonusOriginsV213[entry.studentId][entry.itemId]='unanswered-q-sheet';
    }
    await v200PrivatePut(priv);
  }catch(e){
    priv.bonusScores=previousScores;priv.classtime.bonusMappingV213=previousMap;
    priv.bonusOriginsV213=previousOrigin;throw e;
  }
  render();
}
async function v213AddBonus(kind){
  const a=v200Assessment(v200Eval?.assessmentId),an=v200EvalAnalysis();
  if(!a||!an?.competencies?.length)throw Error('Bitte erst das Kompetenzraster prüfen.');
  const name=prompt('Bezeichnung der Bonusaufgabe (z. B. Q8 oder A8b):');
  if(!name?.trim())return;
  const raw=prompt('Maximale BONUS-Punkte (nicht Teil der regulären Höchstpunktzahl):','1');
  if(raw===null)return;
  const bonus=v210StrictScore(raw);
  if(bonus===null||bonus<=0)throw Error('Bonus-Maximalpunkte müssen größer als 0 sein.');
  let id='Bonus'+Date.now();while(an.items.some(i=>i.id===id))id+='x';
  const item={id,label:name.trim(),source:kind,regularMax:0,bonusMax:bonus,
    competencyId:an.competencies[0].id,classtimeAliases:[]};
  const approved=a.competencySelectionV204?.teacherReviewedV205;
  an.items.push(item);
  if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=false;
  try{await saveState();}
  catch(e){
    an.items=an.items.filter(i=>i!==item);
    if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=approved;
    throw e;
  }
  render();
}
const v213Step3Before=v200Step3;
v200Step3=function(a,priv){
  const html=v213Step3Before(a,priv),an=v200EvalAnalysis();
  return an?html+v213BonusPanel(priv,an):html;
};

/* Local private restore: separate from normal JSON backup, never merges
 * a different assessment, never overwrites silently. */
const v213Step1Before=v200Step1;
v200Step1=function(a,priv){
  const html=v213Step1Before(a,priv);
  return html+'<section class="detail-section v213-restore">'
    +'<h3>Sensibles Auswertungsbackup wiederherstellen</h3>'
    +'<p class="microcopy">Nur ein zuvor aus derselben Klassenarbeit heruntergeladenes PRIVATES Backup. '
    +'Namen und Punkte bleiben auf diesem Gerät. Vor einem Überschreiben wird eine Sicherung des aktuellen Stands heruntergeladen.</p>'
    +'<label class="upload-button">Privates Backup auswählen<input id="v213-private-restore" '
    +'type="file" accept=".json,application/json" hidden></label></section>';
};
function v213ValidRestore(input,assessmentId){
  const rec=input?.data;
  if(input?.schema!=='schulcockpit.private-assessment.v1'||
    input.assessment?.id!==assessmentId||rec?.assessmentId!==assessmentId)
    throw Error('Dieses private Backup gehört nicht zur geöffneten Klassenarbeit.');
  if(!Array.isArray(rec.roster)||!['scores','paperScores','bonusScores'].every(k=>
      rec[k]===undefined||rec[k]!==null&&typeof rec[k]==='object'&&!Array.isArray(rec[k])))
    throw Error('Das Backup hat keine gültige private Auswertungsstruktur.');
  const ids=new Set();
  for(const s of rec.roster){
    if(typeof s.id!=='string'||!s.id||typeof s.name!=='string'||ids.has(s.id))
      throw Error('Die Teilnehmerliste im Backup ist ungültig oder doppelt.');
    ids.add(s.id);
  }
  return rec;
}
async function v213RestoreFile(file){
  if(!v200Eval||!file)throw Error('Keine Auswertung ausgewählt.');
  if(file.size>30*1024*1024)throw Error('Das private Backup ist ungewöhnlich groß; bitte gesondert prüfen.');
  let input;
  try{input=JSON.parse(await file.text());}
  catch(e){throw Error('Datei enthält kein gültiges JSON.');}
  const id=v200Eval.assessmentId,rec=v213ValidRestore(input,id);
  const current=structuredClone(v200Eval.privateData||v200DefaultPrivate(id));
  if(!confirm('Privates Backup für diese Klassenarbeit laden? Es enthält '
    +rec.roster.length+' Personen. Aktuelle lokale Auswertung wird vor dem Ersetzen gesichert.'))return;
  const a=v200Assessment(id);
  downloadText('SENSIBEL_VOR_RESTORE_'+v200SafeName(a?.title||'Klassenarbeit')+'.json',
    JSON.stringify({schema:'schulcockpit.private-assessment.v1',
      assessment:{id,title:a?.title,date:a?.date},data:current},null,2),'application/json');
  try{
    await v200PrivatePut(rec);
    const saved=await v200PrivateGet(id);
    if(saved.roster?.length!==rec.roster.length||
        JSON.stringify(saved.scores||{})!==JSON.stringify(rec.scores||{})||
        JSON.stringify(saved.bonusScores||{})!==JSON.stringify(rec.bonusScores||{}))
      throw Error('Kontrolle des wiederhergestellten Datensatzes fehlgeschlagen.');
    v200Eval.privateData=saved;
  }catch(e){
    await v200PrivatePut(current);
    v200Eval.privateData=current;
    throw e;
  }
  render();
}
const v213WireBefore=wire;
wire=function(){
  v213WireBefore();
  for(const button of document.querySelectorAll('[data-v213-add-bonus]'))
    button.onclick=()=>v213AddBonus(button.dataset.v213AddBonus).catch(e=>alert(e.message||e));
  document.querySelector('[data-v213-bonus-zeros]')?.addEventListener('click',()=>
    v213SetUnansweredBonus().catch(e=>alert(e.message||e)));
  document.getElementById('v213-private-restore')?.addEventListener('change',async e=>{
    const input=e.currentTarget;
    try{input.disabled=true;await v213RestoreFile(input.files?.[0]);}
    catch(err){alert('Privates Backup nicht übernommen: '+(err.message||err));}
    finally{input.disabled=false;}
  });
  // Prevent navigating to a step that assumes an existing analysis.
  for(const button of document.querySelectorAll('[data-v200-step]')){
    const go=Number(button.dataset.v200Step);
    if(go<4)continue;
    const old=button.onclick;
    button.onclick=e=>{
      if(!v200AnalysisReady()){alert('Bitte zuerst die Aufgaben- und Kompetenzanalyse importieren.');return;}
      if(go===4&&!v200Eval?.privateData?.roster?.length){
        alert('Bitte erst lokal die Teilnehmenden importieren oder erfassen.');return;
      }
      return old?.call(button,e);
    };
  }
};
const v213RenderBefore=render;
render=function(){
  v213RenderBefore();
  const mark=document.querySelector('.brand small');
  if(mark)mark.textContent=state.settings.schoolYear+' · '+V213_VERSION;
};
render();


/* The legacy PDF generator stops drawing criteria when y falls below 235.
 * Fail visibly rather than delivering silently truncated competency sheets. */
function v213PreflightPdf(report,a){
  if(!report?.complete)throw Error('Für diesen Kompetenzbogen fehlen noch bewertete Aufgaben.');
  let y=800-24-17-28-28;
  for(const c of (report.competencies||[]).filter(x=>x.regularMax>0)){
    const h=Math.max(34,16+v200Wrap(c.text,52).length*11);
    y-=h;
    if(y<235)throw Error('Zu viele/lange Kompetenzzeilen für eine PDF-Seite bei '+
      (report.student?.name||'diesem Kind')+'. Bitte Raster/Umfang prüfen statt abgeschnitten zu drucken.');
  }
  const fb=v200Feedback(report,a);
  y-=15+18+v200Wrap('Das gelingt dir bereits: '+fb.strength,88).length*12
    +5+v200Wrap(fb.next,88).length*12+16+30+48;
  if(y<55)throw Error('Die Rückmeldung würde das Unterschriftsfeld überlappen. '
    +'Bitte kürzere persönliche Rückmeldung verwenden.');
  return true;
}
const v213PdfZipBefore=v200DownloadPdfZip;
v200DownloadPdfZip=async function(){
  const a=v200Assessment(v200Eval?.assessmentId);
  for(const r of v200ReportList().filter(x=>x.complete))v213PreflightPdf(r,a);
  return v213PdfZipBefore();
};
const v213PdfCombinedBefore=v200DownloadCombinedPdf;
v200DownloadCombinedPdf=function(){
  const a=v200Assessment(v200Eval?.assessmentId);
  for(const r of v200ReportList().filter(x=>x.complete))v213PreflightPdf(r,a);
  return v213PdfCombinedBefore();
};
