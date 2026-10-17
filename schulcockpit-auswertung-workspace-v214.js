/* Schulcockpit V0.21.4 – Auswertung als Arbeitsbereich, keine Modal-Korrektur.
 * Quellvorlagen erhalten; tatsächliche Prüfungsauswahl separat; schulische
 * Curriculum-IDs von konkret geprüften/unterrichteten Teilfähigkeiten trennen.
 * Keine personenbezogenen Daten im Git-Repository oder ChatGPT-Bundle. */
const V214_VERSION='V0.21.4';
function v214Role(a,file){
  const role=a?.evaluationFilesV214?.[file.id];
  return ['reference','used','rubric'].includes(role)?role:'reference';
}
function v214SelectedFiles(a){return (a?.files||[]).filter(f=>['used','rubric'].includes(v214Role(a,f)));}
function v214LegacyExamDates(){
  const known=new Set((state.assessments||[]).map(a=>a.classId+'|'+a.date));
  return (state.sequences||[]).filter(q=>q.classId&&/^\d{4}-\d{2}-\d{2}$/.test(q.assessmentDate||'')&&
    !known.has(q.classId+'|'+q.assessmentDate));
}
function v214AssessmentList(){
  const items=[...(state.assessments||[])].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  const row=a=>{
    const c=cls(a.classId),has=!!a.evaluationV200?.analysis;
    const selected=v214SelectedFiles(a).length;
    return '<article class="v214-assessment-card"><div><span class="eyebrow">'
      +esc((c?.subject||'Fach')+' '+(c?.name||''))+'</span>'
      +'<h3>'+esc(a.title||a.type||'Klassenarbeit')+'</h3>'
      +'<p>'+esc(fmtDate(a.date))+' · '+esc(a.type||'Leistungsnachweis')+'</p>'
      +'<small>'+esc((a.files||[]).length)+' lokale Dateien · '+selected+' für diese Auswertung ausgewählt'
      +(has?' · Kompetenzanalyse vorhanden':' · Kompetenzanalyse noch offen')+'</small></div>'
      +'<div class="v214-list-actions"><button class="primary" data-v214-open="'+esc(a.id)+'">Auswertung öffnen</button>'
      +'<button class="secondary" data-v188-assessment-edit="'+esc(a.id)+'">Termin bearbeiten</button></div></article>';
  };
  const legacy=v214LegacyExamDates();
  return '<div class="v214-index"><section class="panel"><div class="section-head"><div>'
    +'<span class="eyebrow">KLASSENARBEITEN · KLAUSUREN · TESTS</span>'
    +'<h2>Auswertung & Rückgabe</h2>'
    +'<p>Die Termine und Prüfungsdateien stammen aus denselben Einträgen wie in der Reihenplanung. '
    +'Keine zweite Liste und keine doppelte Datenpflege.</p></div>'
    +'<button class="primary" data-v188-assessment-new>+ Leistungsnachweis</button></div>'
    +(items.length?items.map(row).join(''):'<p class="muted">Noch keine Klassenarbeit eingetragen.</p>')+'</section>'
    +(legacy.length?'<section class="panel"><h3>Ältere Termine aus Reihenplanungen</h3>'
    +'<p>Diese Datumsfelder stammen aus älteren Reihenplänen ohne eigenständigen Prüfungsdatensatz. '
    +'Sie bleiben erhalten; du kannst sie mit einem Klick bewusst in die zentrale Prüfungsübersicht übernehmen.</p>'
    +legacy.map(q=>'<div class="v214-legacy-date"><span>'+esc((cls(q.classId)?.subject||'')+' '
      +(cls(q.classId)?.name||'')+' · '+q.title+' · '+fmtDate(q.assessmentDate))+'</span>'
      +'<button class="secondary" data-v214-legacy="'+esc(q.id)+'">Termin übernehmen</button></div>').join('')
    +'</section>':'')+'</div>';
}
function v214EvaluationPage(){
  const a=v200Assessment(v200Eval?.assessmentId);
  if(!a)return '<section class="panel"><p>Keine Prüfung ausgewählt.</p><button data-view="evaluations">Zur Übersicht</button></section>';
  const priv=v200Eval.privateData||v200DefaultPrivate(a.id),step=v200Eval.step||1,c=cls(a.classId);
  const contents=step===1?v200Step1(a,priv):step===2?v200Step2(a,priv):
    step===3?v200Step3(a,priv):step===4?v200Step4(a,priv):v200Step5(a,priv);
  return '<div class="v214-evaluation-workspace"><div class="v214-workspace-head">'
    +'<button class="text-button" data-view="evaluations">← Alle Klassenarbeiten</button>'
    +'<div><span class="eyebrow">'+esc((c?.subject||'')+' '+(c?.name||'')+' · '+fmtDate(a.date))+'</span>'
    +'<h2>'+esc(a.title||a.type||'Leistungsnachweis')+'</h2></div>'
    +'<button class="secondary" data-v214-edit-exam="'+esc(a.id)+'">Prüfungstermin bearbeiten</button></div>'
    +v200StepNav(step)+'<div class="v214-workspace-content">'+contents+'</div></div>';
}
const v214OldViewHtml=viewHtml;
viewHtml=function(){
  if(view==='evaluations')return v214AssessmentList();
  if(view==='evaluation')return v214EvaluationPage();
  return v214OldViewHtml();
};
const v214OldTitle=pageTitle;
pageTitle=function(){return view==='evaluations'||view==='evaluation'?'Auswertung & Rückgabe':v214OldTitle();};
const v214OldOpen=v200OpenEval;
v200OpenEval=async function(id){
  await v214OldOpen(id);
  if(!v200Eval||v200Eval.assessmentId!==id)return;
  modal=null;view='evaluation';render();
};
const v214OldRender=render;
render=function(){
  // Old render calls wire() after writing HTML; the new viewHtml is already
  // selected when rendering. No underlying assessment modal remains.
  if(view==='evaluation'&&modal?.type==='assessmentEvalV200')modal=null;
  v214OldRender();
  const nav=document.querySelector('.sidebar nav');
  if(nav&&!nav.querySelector('[data-view="evaluations"]')){
    const next=nav.querySelector('[data-view="timetable"]');
    const html=navBtn('evaluations','▣','Auswertung & Rückgabe');
    if(next)next.insertAdjacentHTML('beforebegin',html);else nav.insertAdjacentHTML('beforeend',html);
    const btn=nav.querySelector('[data-view="evaluations"]');
    btn.onclick=()=>{view='evaluations';modal=null;render();};
  }
  const active=nav?.querySelector('[data-view="evaluations"]');
  if(active){active.classList.toggle('active',view==='evaluations'||view==='evaluation');}
  const shell=document.querySelector('.app-shell');
  shell?.classList.toggle('v214-full-mode',view==='evaluation');
  document.body.classList.toggle('v214-body-workspace',view==='evaluation');
  const el=document.querySelector('.brand small');
  if(el)el.textContent=state.settings.schoolYear+' · '+V214_VERSION;
};

/* Evaluation sources are roles attached to existing file IDs, not deletion/
 * migration of the colleague's original A/B/inclusion source documents. */
function v214FilePanel(a){
  const docs=(a.files||[]).map(f=>{
    const role=v214Role(a,f);
    return '<div class="v214-file-row"><div><strong>'+esc(f.name)+'</strong>'
      +'<small>Original bleibt lokal gespeichert</small></div>'
      +'<label>Rolle <select data-v214-file-role="'+esc(f.id)+'">'
      +[['reference','Vorlage / Archiv (nicht auswerten)'],['used','Tatsächlich geschriebene Arbeit'],['rubric','Kompetenzraster / Erwartungshorizont']]
        .map(([v,t])=>'<option value="'+v+'" '+(role===v?'selected':'')+'>'+t+'</option>').join('')
      +'</select></label>'
      +'<button class="text-button" data-v214-file-open="'+esc(f.fileKey)+'">Öffnen</button></div>';
  }).join('');
  return '<section class="detail-section v214-file-panel"><h3>Welche Dateien wurden wirklich verwendet?</h3>'
    +'<p>Die A-/B- und Inklusionsvorlagen deines Kollegen bleiben als <strong>Referenzmaterial</strong> erhalten. '
    +'Für diese Auswertung wählst du nur deine tatsächlich geschriebene Classtime-Aufgabenversion '
    +'(z. B. PDF ohne Ergebnisse), die Papierarbeit und das passende Kompetenzraster aus.</p>'
    +(docs||'<p>Hier sind noch keine Dateien hinterlegt.</p>')
    +'<label class="upload-button">Deine Prüfungs- und Rasterdateien hinzufügen'
    +'<input id="v214-exam-files" type="file" multiple hidden accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.pptx,.txt"></label>'
    +'<p class="microcopy">Nur als „tatsächlich geschrieben“ oder „Kompetenzraster“ markierte Dateien '
    +'werden in das ChatGPT-Analysepaket aufgenommen. Ergebnisse und Schülerantworten gehören '
    +'ausschließlich in den späteren lokalen Excel-/Punkteschritt.</p></section>';
}
v200Step1=function(a,priv){
  const an=a.evaluationV200?.analysis;
  const selection=a.competencySelectionV204||null;
  const ready=!!an?.items?.length;
  return '<section class="detail-section v214-privacy"><strong>🔒 Ergebnisse bleiben lokal.</strong> '
    +'Die schriftlichen Aufgaben und das Kompetenzraster dürfen zur fachlichen Zuordnung '
    +'verwendet werden. Namen, Antworten und Punktwerte der Kinder werden nicht an ChatGPT geschickt.</section>'
    +v214FilePanel(a)
    +'<section class="detail-section"><h3>Prüfkompetenzen aus dem Raster ableiten</h3>'
    +'<p>Du musst <strong>nicht</strong> erst alle Kompetenzen des Hauscurriculums auswählen. '
    +'Die konkrete Kompetenzliste entsteht aus der wirklich geschriebenen Arbeit und dem Originalraster '
    +'in Schritt 2. Der übergeordnete Curriculumtext bleibt als Quelle erhalten; Addition und Subtraktion '
    +'dürfen getrennte Bewertungszeilen mit derselben Curriculum-ID sein.</p>'
    +(ready?'<p class="microcopy">Eine fachliche Analyse ist bereits gespeichert. '
      +esc(an.competencies?.length||0)+' konkrete Rasterzeilen vorhanden.</p>'
      :'<p class="microcopy">Noch kein fertiger Aufgaben-/Kompetenzimport vorhanden. '
      +'Eine ältere Reihenplanung ohne Kompetenzzuordnung ist kein Hindernis.</p>')
    +(selection?.sourceV205==='ai-proposal'&&selection.teacherReviewedV205?
      '<p>Die bisherige Prüfungsanalyse ist von dir freigegeben.</p>':'')
    +'</section>'
    +'<section class="detail-section"><details><summary>Schülerliste für Papierarbeiten lokal erfassen</summary>'
    +'<textarea id="v200-roster-text" rows="6" placeholder="Ein Name pro Zeile">'
    +esc((priv.roster||[]).map(s=>s.name).join('\n'))+'</textarea>'
    +'<button class="secondary" data-v200-roster-save>Liste lokal speichern</button></details>'
    +'<details><summary>Sensibles Auswertungsbackup wiederherstellen</summary>'
    +'<label class="upload-button">Privates Backup auswählen<input id="v213-private-restore" type="file" accept=".json" hidden></label></details>'
    +'<div class="v200-actions"><button class="secondary" data-v200-private-backup>Sensibles Backup</button>'
    +'<button class="primary" data-v200-step="2">Weiter zur Aufgabenanalyse →</button></div></section>';
};

/* Ignore archived reference files in analysis prompts and ZIPs. Never send
 * the uploaded Classtime results; teacher selects actual blank tasks/rubric. */
const v214OldPrompt=v200AssessmentAnalysisPrompt;
v200AssessmentAnalysisPrompt=function(a,priv){
  const selected=v214SelectedFiles(a);
  const exam={...a,files:selected,competencySelectionV204:null};
  let result=v214OldPrompt(exam,priv);
  result+='\n\n## Tatsächlich verwendete Prüfungsfassungen\n';
  result+='Berücksichtige ausschließlich die ausgewählten leeren Prüfungsdateien und '
    +'das originale Kompetenzraster. Archivierte A-/B-/Inklusionsvorlagen, '
    +'die nicht benutzt wurden, dürfen NICHT als tatsächlich geschriebene Aufgaben gelten.\n';
  result+='Rückgaberaster-Zeilen sind konkrete Unterkompetenzen. Mehrere dürfen auf dieselbe '
    +'unveränderte offizielle Curriculum-ID verweisen (z.B. schriftliche Addition und '
    +'schriftliche Subtraktion). Fehlende curriculare Zuordnung ausdrücklich offen lassen.\n';
  if(!selected.length)result+='\nNoch KEINE tatsächlich verwendeten Dateien ausgewählt; '
    +'keine belastbare Aufgabenanalyse ohne diese Quellen erzeugen.\n';
  v200AssertNoStudentLeak(result,priv);return result;
};
v200DownloadAnalysisBundle=async function(){
  const a=v200Assessment(v200Eval?.assessmentId),priv=v200Eval?.privateData;
  const selected=v214SelectedFiles(a);
  if(!selected.some(f=>v214Role(a,f)==='used'))
    throw Error('Bitte zuerst mindestens eine tatsächlich geschriebene Prüfungsdatei auswählen.');
  if(v202Grade(cls(a.classId))<=7&&!selected.some(f=>v214Role(a,f)==='rubric'))
    throw Error('Für Jahrgang 5–7 bitte zuerst das verwendete Kompetenzraster markieren.');
  const prompt=v200AssessmentAnalysisPrompt(a,priv);
  v200AssertNoStudentLeak(prompt,priv);
  const zip=new JSZip();
  zip.file('00_Analyseprompt_OHNE_SCHUELERDATEN.txt',prompt);
  zip.file('01_Classtime_Fragenstruktur_ANONYM.txt',v200AnonymizedClasstimeStructure(priv?.classtime));
  let added=0;
  for(const f of selected){
    const rec=await fileStoreGet(f.fileKey);
    if(!rec?.blob)throw Error('Lokale Datei fehlt: '+f.name);
    zip.file((v214Role(a,f)==='rubric'?'Kompetenzraster/':'Geschriebene_Arbeit/')+
      (added++)+'_'+f.name,rec.blob);
  }
  zip.file('BITTE_LESEN.txt','Nur leere Aufgaben und Raster. Keine Schülerantworten, '
    +'keine Ergebnisse und keine iSurf-Exporte hochladen. Das originale Hauscurriculum '
    +'ist als Text im Analyseprompt enthalten.');
  downloadBlob('Schulcockpit_'+v200SafeName(a.title||'Arbeit')+'_Analysepaket.zip',
    await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}}));
};

/* Keep analysis fields when an existing exam record is edited: V0.18.8
 * rebuilt assessment objects and previously discarded unknown fields. */
const v214SaveAssessmentBefore=v188SaveAssessment;
v188SaveAssessment=async function(){
  const id=v188AssessmentDraft?.id,old=id?state.assessments.find(a=>a.id===id):null;
  const extras=old?structuredClone(old):null;
  const saved=await v214SaveAssessmentBefore();
  if(!saved||!extras)return saved;
  const fresh=state.assessments.find(a=>a.id===id);
  if(!fresh)return saved;
  const added={};
  for(const [k,v] of Object.entries(extras)){
    if(!(k in fresh)){fresh[k]=v;added[k]=true;}
  }
  if(Object.keys(added).length){await saveState();render();}
  return saved;
};
async function v214UploadFiles(list){
  const a=v200Assessment(v200Eval?.assessmentId);
  if(!a||!list?.length)return;
  const originalFiles=[...(a.files||[])],originalRoles={...(a.evaluationFilesV214||{})},keys=[];
  try{
    a.files=a.files||[];a.evaluationFilesV214=a.evaluationFilesV214||{};
    for(const f of list){
      const id=uid('afile'),key='assessment-'+a.id+'-'+id;
      await fileStorePut(key,f);keys.push(key);storedFileKeys.add(key);
      a.files.push({id,name:f.name,type:f.type||'',size:f.size||0,fileKey:key,addedAt:new Date().toISOString()});
      a.evaluationFilesV214[id]=/raster|kompetenz/i.test(f.name)?'rubric':'used';
    }
    await saveState();
  }catch(e){
    a.files=originalFiles;a.evaluationFilesV214=originalRoles;
    for(const key of keys){try{await fileStoreDelete(key);storedFileKeys.delete(key);}catch(_){}}
    throw e;
  }
  render();
}
async function v214SetRole(fileId,role){
  const a=v200Assessment(v200Eval?.assessmentId);
  if(!a?.files?.some(f=>f.id===fileId)||!['reference','used','rubric'].includes(role))
    throw Error('Dateiauswahl ist ungültig.');
  const old={...(a.evaluationFilesV214||{})};
  a.evaluationFilesV214={...old,[fileId]:role};
  try{await saveState();}catch(e){a.evaluationFilesV214=old;throw e;}
  render();
}

/* Optional subskills belong to the exact teaching sequence, not the source
 * curriculum. A parent competency can be covered across Teil I and Teil II.
 * This does NOT set the parent as 'done' or change past lessons. */
function v214Parents(q){
  const course=cls(q?.classId),all=v204AllCourseCurriculum(course);
  const profile=typeof v206Profile==='function'?v206Profile(q):null;
  const ids=new Set(profile?.allowIds||[]);
  const preferred=all.filter(c=>ids.has(c.id)||v202SequenceCompetencies(q).some(x=>x.id===c.id));
  return {all,preferred};
}
function v214SubskillsPanel(q){
  if(!q?.id)return '';
  const rows=q.subskillsV214||[],{all,preferred}=v214Parents(q);
  const byId=new Map(all.map(c=>[c.id,c]));
  const parentOptions=(items)=>items.map(c=>'<option value="'+esc(c.id)+'">'+
    esc(c.text)+' ('+esc(c.id)+')</option>').join('');
  const options='<option value="">– übergeordnete Curriculumkompetenz wählen –</option>'
    +(preferred.length?'<optgroup label="Passende Themenkompetenzen">'+parentOptions(preferred)+'</optgroup>':'')
    +'<optgroup label="Alle Kompetenzen des Fachjahrgangs">'+parentOptions(all.filter(c=>!preferred.some(p=>p.id===c.id)))+'</optgroup>';
  const list=rows.map(r=>{
    const parent=byId.get(r.parentId);
    return '<div class="v214-subskill-row"><div><strong>'+esc(r.text)+'</strong><small>'
      +esc(r.part||'Teil offen')+' · '+esc(r.status==='assessed'?'in Arbeit geprüft':r.status==='taught'?'in Unterricht bearbeitet':'vorgesehen')
      +(parent?' · Bezug: '+parent.text:' · Curriculumbezug offen')+'</small></div>'
      +'<button class="text-button danger-lite" data-v214-remove-subskill="'+esc(q.id+'|'+r.id)+'">Entfernen</button></div>';
  }).join('');
  return '<section class="detail-section v214-subskills"><div class="section-head compact"><div>'
    +'<span class="eyebrow">KONKRETE TEILKOMPETENZEN</span><h3>Was wird in dieser Reihe tatsächlich bearbeitet?</h3></div></div>'
    +'<p>Die Original-Kompetenzen aus dem Schulcurriculum bleiben unverändert. '
    +'Hier kannst du z.B. „schriftlich addieren“ für <strong>Grundrechenarten I</strong> '
    +'und später „schriftlich multiplizieren“ für <strong>Grundrechenarten II</strong> '
    +'derselben übergeordneten Kompetenz zuordnen. Ein Teilziel schließt die Gesamtkompetenz nicht ab.</p>'
    +(list||'<p class="muted">Noch keine konkreten Teilkompetenzen erfasst.</p>')
    +'<div class="v214-subskill-form"><label>Offizielle Oberkompetenz<select id="v214-parent-'+esc(q.id)+'">'
    +options+'</select></label><label>Teil / Abschnitt<select id="v214-part-'+esc(q.id)+'">'
    +'<option value="I">Grundrechenarten I / Teil I</option><option value="II">Grundrechenarten II / Teil II</option>'
    +'<option value="sonstige">Anderer Abschnitt</option></select></label>'
    +'<label>Konkretes Lernziel<input id="v214-text-'+esc(q.id)+'" '
    +'placeholder="z. B. Du kannst schriftlich subtrahieren."></label>'
    +'<button class="primary" data-v214-add-subskill="'+esc(q.id)+'">Teilkompetenz hinzufügen</button></div>'
    +'<p class="microcopy">Die Zuordnung ist eine Konkretisierung für deine Planung, keine Änderung '
    +'des offiziellen Kompetenzkatalogs. Der Unterrichts-/Nachweisstatus bleibt separat.</p></section>';
}
const v214OldCurriculumSection=v202CurriculumSection;
v202CurriculumSection=function(q){return v214OldCurriculumSection(q)+v214SubskillsPanel(q);};
async function v214AddSubskill(qid){
  const q=seq(qid);if(!q)throw Error('Reihe nicht vorhanden.');
  const id=document.getElementById('v214-parent-'+qid)?.value||'';
  const textValue=document.getElementById('v214-text-'+qid)?.value.trim()||'';
  const part=document.getElementById('v214-part-'+qid)?.value||'I';
  if(!textValue)throw Error('Bitte eine konkrete Teilkompetenz formulieren.');
  if(id&&!v214Parents(q).all.some(c=>c.id===id))throw Error('Unbekannter Curriculumbezug.');
  const original=structuredClone(q.subskillsV214||[]);
  q.subskillsV214=[...original,{id:uid('subskill'),parentId:id,text:textValue,part,status:'planned',
    createdAt:new Date().toISOString(),origin:'teacher'}];
  try{await saveState();}catch(e){q.subskillsV214=original;throw e;}
  render();
}
async function v214RemoveSubskill(pair){
  const [qid,id]=pair.split('|'),q=seq(qid);
  if(!q?.subskillsV214?.some(x=>x.id===id))return;
  if(!confirm('Nur dieses konkrete Teilziel aus der Reihe entfernen? Die offizielle Curriculumkompetenz bleibt unverändert.'))return;
  const before=structuredClone(q.subskillsV214);
  q.subskillsV214=q.subskillsV214.filter(x=>x.id!==id);
  try{await saveState();}catch(e){q.subskillsV214=before;throw e;}
  render();
}
function v214AssessmentSequenceOptions(a){
  const sequences=classSequences(a.classId);
  return sequences.map(q=>'<option value="'+esc(q.id)+'">'+esc(q.title)+(q.startDate?' · '+esc(q.startDate):'')+'</option>').join('');
}
const v214OldStep3=v200Step3;
v200Step3=function(a,priv){
  const h=v214OldStep3(a,priv),an=a.evaluationV200?.analysis;
  if(!an?.competencies?.length)return h;
  const options=v214AssessmentSequenceOptions(a);
  if(!options)return h;
  return h+'<section class="detail-section v214-rubric-to-sequence"><h3>Rasterziele auch in der Reihenplanung festhalten</h3>'
    +'<p>Die konkreten Kompetenzen aus dieser Klassenarbeit können als Teilziele der '
    +'passenden Reihe übernommen werden – ausdrücklich <strong>ohne</strong> '
    +'die übergeordneten Curriculumkompetenzen oder vergangene Stunden als abgeschlossen zu markieren.</p>'
    +'<label>Unterrichtsreihe<select id="v214-rubric-sequence">'+options+'</select></label>'
    +'<button class="secondary" data-v214-rubric-to-sequence>Prüfungsraster als Teilkompetenzen vormerken</button>'
    +'<p class="microcopy">Bei mehreren Reihen bitte die richtige auswählen. '
    +'Die Originaltexte des Kollegen bleiben im Prüfungsraster unverändert.</p></section>';
};
async function v214TransferRubric(){
  const a=v200Assessment(v200Eval?.assessmentId),an=a?.evaluationV200?.analysis;
  const q=seq(document.getElementById('v214-rubric-sequence')?.value||'');
  if(!q||q.classId!==a.classId||!an?.competencies?.length)
    throw Error('Bitte die zugehörige Unterrichtsreihe wählen.');
  const allowed=new Set(v214Parents(q).all.map(x=>x.id));
  const old=structuredClone(q.subskillsV214||[]);
  const add=[];
  for(const c of an.competencies){
    if(old.some(x=>x.sourceAssessmentId===a.id&&x.criterionId===c.id))continue;
    add.push({id:uid('subskill'),text:c.text,parentId:allowed.has(c.curriculumCompetencyId)?c.curriculumCompetencyId:'',
      part:/\b(II|2)\b/.test(q.title)?'II':'I',status:'assessed',sourceAssessmentId:a.id,criterionId:c.id,
      createdAt:new Date().toISOString(),origin:'exam-rubric'});
  }
  if(!add.length)return alert('Diese Rasterziele sind in der Reihe bereits vorhanden.');
  if(!confirm(add.length+' Teilkompetenzen in „'+q.title+'“ vormerken? '
    +'Das bestätigt NICHT, dass die vollständigen übergeordneten Kompetenzen abgeschlossen sind.'))return;
  q.subskillsV214=[...old,...add];
  try{await saveState();}catch(e){q.subskillsV214=old;throw e;}
  render();
}
async function v214AdoptLegacy(qid){
  const q=seq(qid);
  if(!q?.assessmentDate||!q.classId)return;
  const matches=state.assessments.some(a=>a.classId===q.classId&&a.date===q.assessmentDate);
  if(matches)throw Error('Für diesen Kurs und Termin gibt es bereits einen Eintrag.');
  if(!confirm('Den festen Prüfungstermin '+fmtDate(q.assessmentDate)+' aus „'+q.title+
    '“ in die zentrale Auswertung übernehmen? Die Reihe und alle vorhandenen Dateien bleiben erhalten.'))return;
  const entry={id:uid('assess'),classId:q.classId,date:q.assessmentDate,type:'Klassenarbeit',
    title:'Klassenarbeit · '+q.title,scope:q.title,files:[],legacySequenceId:q.id,
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  state.assessments.push(entry);
  try{await saveState();}catch(e){state.assessments=state.assessments.filter(x=>x!==entry);throw e;}
  render();
}
const v214OldWire=wire;
wire=function(){
  v214OldWire();
  document.querySelectorAll('[data-v214-open]').forEach(b=>b.onclick=()=>v200OpenEval(b.dataset.v214Open)
    .catch(e=>alert(e.message||e)));
  document.querySelectorAll('[data-v214-legacy]').forEach(b=>b.onclick=()=>v214AdoptLegacy(b.dataset.v214Legacy)
    .catch(e=>alert(e.message||e)));
  document.querySelectorAll('[data-v214-file-role]').forEach(el=>el.onchange=()=>v214SetRole(el.dataset.v214FileRole,el.value)
    .catch(e=>alert('Dateirolle nicht gespeichert: '+(e.message||e))));
  document.querySelectorAll('[data-v214-file-open]').forEach(b=>b.onclick=async()=>{
    try{const f=await fileStoreGet(b.dataset.v214FileOpen);if(f?.blob)downloadBlob(f.name,f.blob);
      else alert('Datei nicht mehr im lokalen Speicher vorhanden.');}catch(e){alert(e.message||e);}
  });
  document.getElementById('v214-exam-files')?.addEventListener('change',e=>v214UploadFiles([...e.target.files])
    .catch(err=>alert('Dateien nicht gespeichert: '+(err.message||err))));
  document.querySelector('[data-v214-edit-exam]')?.addEventListener('click',e=>
    v188OpenAssessment(e.currentTarget.dataset.v214EditExam));
  document.querySelectorAll('[data-v214-add-subskill]').forEach(b=>b.onclick=()=>v214AddSubskill(b.dataset.v214AddSubskill)
    .catch(e=>alert(e.message||e)));
  document.querySelectorAll('[data-v214-remove-subskill]').forEach(b=>b.onclick=()=>v214RemoveSubskill(b.dataset.v214RemoveSubskill)
    .catch(e=>alert(e.message||e)));
  document.querySelector('[data-v214-rubric-to-sequence]')?.addEventListener('click',()=>v214TransferRubric()
    .catch(e=>alert(e.message||e)));
};