/* Schulcockpit V0.31.7 – prüfungsdateispezifische Aufgaben-, Punkte- und Kompetenzraster.
 * Die Dateirolle (ohne Namen) liegt am Prüfungsanhang. Die Zuordnung und alle
 * Raster/Ergebnisse bleiben im getrennten PRIVATEN IndexedDB-Prüfungsdatensatz.
 * Bestehende V300-Importe/Raster funktionieren weiter.
 */
(function(){
'use strict';
const PREFIX='file:';
const SPECIAL=new Set(['alternative','inclusion','inclusion_makeup']);
const core=SC_MAKEUP_BATCH_V300;
function currentExam(){return v200Assessment(v200Eval?.assessmentId);}
function currentPrivate(){return v200Eval?.privateData;}
function specialFiles(a=currentExam()){
 return (a?.files||[]).filter(f=>SPECIAL.has(f.roleV316)&&f.fileKey);
}
function regularFiles(a){
 return (a?.files||[]).filter(f=>{
  // An older exam may not have file categories yet: the analysis role is
  // authoritative until the teacher explicitly categorizes the file.
  const use=typeof v214Role==='function'?v214Role(a,f):'reference';
  const type=f.roleV316||(use==='rubric'?'solution':use==='used'?'standard':'reference');
  return (type==='standard'&&use==='used')||(type==='solution'&&use==='rubric');
 });
}
const priorAnalysisPrompt=v200AssessmentAnalysisPrompt;
v200AssessmentAnalysisPrompt=function(a,priv){
 return specialFiles(a).length?priorAnalysisPrompt({...a,files:regularFiles(a)},priv):priorAnalysisPrompt(a,priv);
};
function fileFromKey(key,a=currentExam()){
 return (a?.files||[]).find(f=>f.fileKey===key)||null;
}
function roleLabel(r){
 return ({standard:'Reguläre Arbeit',alternative:'Nachschreibearbeit',
  inclusion:'Inklusionsarbeit',inclusion_makeup:'Inklusions-Nachschreibearbeit'}[r]||r||'Prüfungsfassung');
}
function labelForVariant(kind){
 if(!String(kind||'').startsWith(PREFIX))return '';
 const f=fileFromKey(String(kind).slice(PREFIX.length));
 return f?roleLabel(f.roleV316)+' · '+f.name:'Unbekannte Prüfungsfassung';
}
function variantOptions(){
 return specialFiles().map(f=>[PREFIX+f.fileKey,roleLabel(f.roleV316)+' · '+f.name]);
}
function analysisForVariant(kind,priv=currentPrivate(),a=currentExam()){
 if(kind==='standard')return a?.evaluationV200?.analysis||null;
 if(!String(kind||'').startsWith(PREFIX))return null;
 const key=String(kind).slice(PREFIX.length);
 return specialFiles(a).some(f=>f.fileKey===key)?priv?.variantAnalysesV317?.[key]||null:null;
}
function hasResults(priv,id){
 return ['scores','paperScores','bonusScores'].some(k=>
  Object.values(priv?.[k]?.[id]||{}).some(v=>v!==null&&v!==undefined&&v!==''))
  ||!!priv?.gradesV260?.[id]||!!Object.keys(priv?.gradingOverridesV267?.[id]||{}).length;
}
function classPersonId(priv,student){
 if(!student)return '';
 const clsRecord=typeof v235Current==='function'?v235Current():null;
 if(!clsRecord||clsRecord.classId!==currentExam()?.classId)return '';
 if(student.classStudentId&&clsRecord.roster.some(s=>s.id===student.classStudentId))
  return student.classStudentId;
 // Exact, unambiguous name matching only; never use roster order.
 return typeof v235ClassMatch==='function'?(v235ClassMatch(clsRecord,priv,student)?.id||''):'';
}
function assignments(priv,student,a=currentExam()){
 const personId=classPersonId(priv,student);
 if(!personId)return {personId:'',files:[]};
 const found=specialFiles(a).filter(f=>
  (priv?.examFileAssignmentsV316?.[f.fileKey]||[]).includes(personId));
 return {personId,files:found};
}
function select(priv,student,a=currentExam()){
 const current=String(priv?.activeVariantV300?.[student?.id]||'standard');
 const explicit=String(priv?.examFileV317?.[student?.id]||'');
 const assigned=assignments(priv,student,a);
 if(!student)return {status:'none',files:[]};
 if(!assigned.personId){
  if(specialFiles(a).length)return {status:'unlinked',files:[],message:'Kind noch nicht eindeutig mit der privaten Klassenliste verknüpft'};
  return {status:'standard',files:[]};
 }
 const files=assigned.files;
 if(!files.length){
  if(explicit||current.startsWith(PREFIX))
   return {status:'invalid',files,message:'Gespeicherte Sonderfassung ist diesem Kind nicht mehr zugeordnet'};
  return {status:'standard',files:[]};
 }
 const currentFile=current.startsWith(PREFIX)?current.slice(PREFIX.length):'';
 const chosen=explicit||currentFile;
 if(chosen&&!files.some(f=>f.fileKey===chosen))
  return {status:'invalid',files,message:'Die aktive Fassung passt nicht zur aktuellen Schülerzuordnung'};
 if(explicit&&currentFile&&explicit!==currentFile)
  return {status:'invalid',files,message:'Widersprüchliche aktive Prüfungsfassungen'};
 if(files.length>1&&!chosen)
  return {status:'multiple',files,message:'Mehrere Sonderfassungen zugeordnet: Bewertungsfassung ausdrücklich auswählen'};
 const file=files.find(f=>f.fileKey===chosen)||files[0];
 if(!file)return {status:'invalid',files,message:'Datei nicht mehr vorhanden'};
 if(!chosen&&hasResults(priv,student.id))
  return {status:'switch',files,file,message:'Bisherige Punkte gehören noch keiner bestätigten Sonderfassung an'};
 if(!chosen&&current!=='standard')
  return {status:'switch',files,file,message:'Bestehende Varianten-Auswertung muss bestätigt umgestellt werden'};
 const rubric=analysisForVariant(PREFIX+file.fileKey,priv,a);
 if(!rubric)return {status:'missingRubric',files,file,message:'Eigenes Aufgaben-/Kompetenzraster fehlt'};
 return {status:'ready',files,file,rubric};
}
function validateBatch({kind,chosen,priv,exam:a}){
 for(const row of chosen||[]){
  const st=(priv?.roster||[]).find(s=>s.id===row.studentId);
  if(!st)throw Error('Kind nicht in der aktuellen Prüfungs-Teilnehmerliste.');
  const assignment=assignments(priv,st,a),key=String(kind||'');
  if(!assignment.personId&&specialFiles(a).length)
   throw Error(st.name+': zuerst mit der privaten Kursliste verknüpfen, damit die richtige Prüfungsfassung feststeht.');
  if(assignment.files.length){
   if(!key.startsWith(PREFIX)||!assignment.files.some(f=>PREFIX+f.fileKey===key))
    throw Error(st.name+': Die gewählte Excel-Fassung passt nicht zur im Klassenarbeitsdialog zugeordneten Datei.');
   const active=String(priv.examFileV317?.[st.id]||'');
   if(active&&active!==key.slice(PREFIX.length))
    throw Error(st.name+': Die bisher aktivierte Prüfungsfassung weicht ab. Bitte im Bewertungsbereich prüfen.');
  }else if(key.startsWith(PREFIX)){
   throw Error(st.name+': Diese Sonderfassung ist dem Kind noch nicht zugeordnet.');
  }
 }
}
function safePriv(priv,id){
 const copy={...priv,activeVariantV300:{...(priv.activeVariantV300||{}),[id]:'standard'}};
 return copy;
}
function blockedReport(priv,an,stu,reason,prior){
 const base=prior(safePriv(priv,stu.id),an,stu);
 return {...base,student:stu,competencies:[],complete:false,scoreCompleteV283:false,
  totalMax:0,totalReg:0,totalBonus:0,totalAdjusted:0,totalPct:null,
  gradeV260:'',gradeAutoV260:'',gradeIsManualV260:false,
  missing:[reason],assessmentVariantProblemV317:reason,
  examVariantV300:'standard'};
}
function excessItems(priv,stu,an){
 return (an?.items||[]).filter(it=>{
  const score=v200GetScore(priv,stu.id,it);
  if(score===null||score===undefined||score==='')return false;
  const max=Number(it.source.endsWith('_bonus')?it.bonusMax:it.regularMax);
  return !Number.isFinite(Number(score))||Number(score)<0||Number(score)>max+1e-8;
 });
}
const priorReport=v200StudentReport;
v200StudentReport=function(priv,an,stu){
 if(!priv||!stu)return priorReport(priv,an,stu);
 const selected=select(priv,stu);
 if(selected.status==='standard'||selected.status==='none')
  return priorReport(priv,an,stu);
 if(selected.status!=='ready')
  return blockedReport(priv,an,stu,selected.message||'Prüfungsfassung ungeklärt',priorReport);
 const excessive=excessItems(priv,stu,selected.rubric);
 if(excessive.length)
  return blockedReport(priv,an,stu,'Punkte außerhalb des Maximalwerts der Sonderfassung: '+
   excessive.map(it=>it.label||it.id).join(', '),priorReport);
 const report=priorReport(safePriv(priv,stu.id),selected.rubric,stu);
 return {...report,student:stu,examFileV317:selected.file.fileKey,
  examVariantLabelV317:roleLabel(selected.file.roleV316)+' · '+selected.file.name,
  examVariantV300:'standard'};
};
const priorDetail=v210CalculationDetail;
v210CalculationDetail=function(priv,an,stu){
 const selected=select(priv,stu);
 if(selected.status==='ready')
  return priorDetail(safePriv(priv,stu.id),selected.rubric,stu);
 return priorDetail(priv,an,stu);
};
const priorHeader=v233Header;
v233Header=function(out,report,assessment,palette,continued){
 const returned=priorHeader(out,report,assessment,palette,continued);
 if(report.examVariantLabelV317){
  const topic=v233Topic(assessment)||'Deine Ergebnisse';
  const size=topic.length>46?16:topic.length>27?20:24;
  const offset=(v233Wrap(topic,506,size,'F4').length-1)*23;
  v233Text(out,553,719-offset,report.examVariantLabelV317,8,'F2',palette.muted,'right');
 }
 return returned;
};
function rubricPanel(a,priv){
 const files=specialFiles(a);
 if(!files.length)return '';
 const analyses=priv?.variantAnalysesV317||{};
 return '<section class="detail-section v317-rubrics"><span class="eyebrow">PRÜFUNGSFASSUNGEN · EIGENE BEWERTUNG</span>'+
  '<h3>Aufgaben und Kompetenzen pro Fassung</h3>'+
  '<p>Jede abweichende Arbeit bekommt ihr eigenes geprüftes Raster: Teilaufgaben, Maximalpunkte, Bonuspunkte und zugehörige Kompetenzen. Das reguläre Raster bleibt unverändert. Keine Namen oder Ergebnisse werden an ChatGPT übergeben.</p>'+
  files.map(file=>{
   const key=file.fileKey,rubric=analyses[key];
   const max=(rubric?.items||[]).reduce((n,it)=>n+(it.source.endsWith('_bonus')?0:Number(it.regularMax)||0),0);
   const count=(Object.values(priv?.examFileAssignmentsV316||{}).length&&priv?.examFileAssignmentsV316?.[key]?.length)||0;
   return '<details class="v317-rubric" '+(!rubric?'open':'')+'><summary><strong>'+
    esc(roleLabel(file.roleV316)+' · '+file.name)+'</strong><span>'+
    (rubric?'✓ '+rubric.items.length+' Aufgaben · '+max+' Maximalpunkte':'⚠ eigenes Raster fehlt')+
    ' · '+count+' Zuordnung(en)</span></summary>'+
    '<p class="microcopy">Verglichen wird später nur mit diesem Aufgabensatz; Kompetenzen und Maximalpunkte werden nicht von der regulären Fassung übernommen.</p>'+
    '<div class="v200-actions"><button class="secondary" data-v317-copy="'+esc(key)+'">Analyse-Prompt kopieren</button>'+
    '<button class="secondary" data-v317-bundle="'+esc(key)+'">Nur diese Fassung als Analyse-ZIP</button></div>'+
    (rubric?'<p class="v317-compact">Kompetenzzuordnung: '+rubric.items.map(it=>
     esc((it.label||it.id)+' ('+it.regularMax+' P. → '+it.competencyId+')')).join(' · ')+'</p>':'')+
    '<label>Geprüften Analyseblock dieser Fassung einfügen<textarea data-v317-rubric="'+esc(key)+
    '" rows="5" placeholder="Finale Prüfungsanalyse mit Importblock einfügen …"></textarea></label>'+
    '<button class="primary" data-v317-save="'+esc(key)+'">Raster prüfen und lokal speichern</button>'+
    '</details>';
  }).join('')+'</section>';
}
function assignmentPanel(a,priv){
 const list=priv?.roster||[];
 if(!list.length||!specialFiles(a).length)return '';
 const relevant=list.map(st=>({st,chosen:select(priv,st)}))
  .filter(x=>x.chosen.status!=='standard'&&x.chosen.status!=='none');
 if(!relevant.length)return '';
 return '<section class="detail-section v317-selected"><span class="eyebrow">INDIVIDUELLE BEWERTUNG</span>'+
  '<h3>Welche Arbeit wird für welches Kind bewertet?</h3>'+
  '<p>Die Zuordnung stammt aus „Klassenarbeit bearbeiten“. Erst nach Bestätigung einer anderen Fassung dürfen vorhandene Punkte ersetzt werden. Bisherige Ergebnisse werden dabei archiviert.</p>'+
  '<div class="v317-student-list">'+relevant.map(({st,chosen})=>{
   const bad=chosen.status!=='ready';
   const current=chosen.file?.fileKey||chosen.files?.[0]?.fileKey||'';
   const choices=(chosen.files||[]).map(f=>'<option value="'+esc(f.fileKey)+'"'+
    (current===f.fileKey?' selected':'')+'>'+esc(roleLabel(f.roleV316)+' · '+f.name)+'</option>').join('');
   return '<div class="v317-student-row"><div><strong>'+esc(st.name)+'</strong>'+
    '<small>'+esc(bad?(chosen.message||'Raster fehlt'):(chosen.file.name+' · Raster bereit'))+'</small></div>'+
    '<div class="v317-student-actions">'+
    ((chosen.status==='multiple'||chosen.status==='switch'||chosen.status==='invalid'||chosen.status==='missingRubric')
     ?'<select data-v317-student-file="'+esc(st.id)+'">'+choices+'</select>'+
      '<button class="secondary" data-v317-activate="'+esc(st.id)+'">Bewertungsfassung bestätigen</button>':'')+
    '</div></div>';
  }).join('')+'</div></section>';
}
async function activate(id,key){
 const a=currentExam(),priv=currentPrivate(),st=(priv?.roster||[]).find(s=>s.id===id);
 if(!a||!st)throw Error('Prüfungs-Teilnehmer*in nicht vorhanden.');
 const valid=assignments(priv,st,a).files;
 if(!valid.some(f=>f.fileKey===key))throw Error('Diese Fassung ist dem Kind nicht zugeordnet.');
 const previous=String(priv.activeVariantV300?.[id]||'standard');
 const chosen=String(priv.examFileV317?.[id]||'');
 if(previous===PREFIX+key&&chosen===key)return;
 if(hasResults(priv,id)&&!confirm('Achtung: Bereits bewertete Aufgaben und individuelle Korrekturregeln von '+st.name+
  ' werden in die lokale Versuchshistorie verschoben, bevor diese Fassung aktiviert wird. Fortfahren?'))return;
 const next=structuredClone(priv);
 if(hasResults(priv,id)){
  next.examAttemptsV300=next.examAttemptsV300||{};
  next.examAttemptsV300[id]=next.examAttemptsV300[id]||[];
  next.examAttemptsV300[id].push({...core.backupStudent(next,id),
   fromFileV317:chosen||previous,replacedByFileV317:key});
  for(const name of ['scores','paperScores','bonusScores','scoreSourcesV211',
   'bonusOriginsV213','feedbackV210','gradingOverridesV267','gradesV260'])
   if(next[name])delete next[name][id];
 }
 next.activeVariantV300=next.activeVariantV300||{};
 next.activeVariantV300[id]=PREFIX+key;
 next.examFileV317=next.examFileV317||{};
 next.examFileV317[id]=key;
 await v200PrivatePut(next);
 v200Eval.privateData=next;
 render();
}
function rubricPrompt(a,file){
 // Use the existing assessment-analysis contract, but deliberately omit the
 // original Classtime S-SESSION: its Q columns may not match this special paper.
 const empty={assessmentId:a.id,roster:[],classtime:null,scores:{},paperScores:{},bonusScores:{}};
 const scoped={...a,files:[file],evaluationFilesV214:{...(a.evaluationFilesV214||{}),[file.id]:'used'}};
 const base=priorAnalysisPrompt(scoped,empty);
 return '# NUR DIESE KONKRETE PRÜFUNGSFASSUNG: '+roleLabel(file.roleV316)+' · '+file.name+
  '\nAnalysiere ausschließlich die beigefügte Fassung, nicht die reguläre Arbeit. '+
  'Ihre Aufgaben, Punkte und Kompetenzzuordnung müssen einzeln geprüft werden. '+
  'Wenn die Aufgaben oder Quellen etwas nicht belegen, frage nach; übernimm nichts ungeprüft aus anderen Fassungen. '+
  'Es werden keine Schülerdaten übermittelt.\n\n'+base;
}
const priorRegularBundle=v200DownloadAnalysisBundle;
v200DownloadAnalysisBundle=async function(){
 const a=currentExam(),priv=currentPrivate();
 if(!a||!specialFiles(a).length)return priorRegularBundle();
 const selected=regularFiles(a),cat=v200CatalogForClass(a.classId,false),prompt=v200AssessmentAnalysisPrompt(a,priv);
 v200AssertNoStudentLeak(prompt,priv);
 if(!selected.length)throw Error('Keine reguläre Prüfungsdatei vorhanden. Bitte zuerst die Datei einordnen.');
 const zip=new JSZip();
 zip.file('00_PROMPT_REGULAERE_PRUEFUNG.txt',prompt);
 zip.file('01_Classtime_Struktur_ANONYM.txt',v200AnonymizedClasstimeStructure(priv?.classtime));
 for(const file of selected){
  const rec=await fileStoreGet(file.fileKey);
  if(rec?.blob)zip.file('Regulaere_Pruefung/'+v200SafeName(file.name),rec.blob);
 }
 for(const file of cat?.files||[]){
  const rec=await fileStoreGet(file.fileKey);
  if(rec?.blob)zip.file('Kompetenzgrundlagen/'+v200SafeName(file.name),rec.blob);
 }
 zip.file('DATENSCHUTZ.txt','Es werden keine individuellen Ergebnisse exportiert. Prüfe alle hochzuladenden Originaldateien auf Namen oder andere personenbezogene Angaben.');
 downloadBlob('Schulcockpit_'+v200SafeName(a.title||'Klassenarbeit')+'_REGULAERE_Analyse.zip',
  await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}}));
};
async function copyPrompt(key){
 const a=currentExam(),file=fileFromKey(key,a);
 if(!file||!SPECIAL.has(file.roleV316))throw Error('Sonderfassung fehlt.');
 const prompt=rubricPrompt(a,file);
 v200AssertNoStudentLeak(prompt,currentPrivate());
 await navigator.clipboard.writeText(prompt);
 alert('Analyse-Prompt für die ausgewählte Prüfungsfassung kopiert – ohne Schülerdaten.');
}
async function bundle(key){
 const a=currentExam(),file=fileFromKey(key,a),cat=v200CatalogForClass(a?.classId,false);
 if(!file||!SPECIAL.has(file.roleV316))throw Error('Sonderfassung fehlt.');
 const rec=await fileStoreGet(key);
 if(!rec?.blob)throw Error('Originaldatei nicht mehr im lokalen Browser-Speicher.');
 const prompt=rubricPrompt(a,file);
 v200AssertNoStudentLeak(prompt,currentPrivate());
 const zip=new JSZip();
 zip.file('00_PROMPT_NUR_DIESE_FASSUNG.txt',prompt);
 zip.file('Pruefung/'+v200SafeName(file.name),rec.blob);
 for(const f of cat?.files||[]){
  const value=await fileStoreGet(f.fileKey);
  if(value?.blob)zip.file('Kompetenzgrundlagen/'+v200SafeName(f.name),value.blob);
 }
 zip.file('DATENSCHUTZ.txt','Keine Schülerinnen-/Schülernamen oder individuellen Ergebnisse automatisiert übertragen. Dokumente vor externer Weitergabe auf personenbezogene Inhalte prüfen.');
 downloadBlob('Schulcockpit_'+v200SafeName(a.title||'Klassenarbeit')+'_'+v200SafeName(file.name)+'_Raster.zip',
  await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}}));
}
async function saveRubric(key){
 const a=currentExam(),file=fileFromKey(key,a),priv=currentPrivate();
 if(!file||!SPECIAL.has(file.roleV316)||!priv)throw Error('Prüfungsfassung fehlt.');
 const text=document.querySelectorAll('[data-v317-rubric]');
 const element=[...text].find(x=>x.dataset.v317Rubric===key);
 const raw=element?.value||'';
 const parsed=v200ExtractAnalysis(raw);
 const old=priv.variantAnalysesV317?.[key];
 if(old&&JSON.stringify(old)!==JSON.stringify(parsed)){
  const used=(priv.roster||[]).some(st=>{
   const active=String(priv.activeVariantV300?.[st.id]||'');
   return (active===PREFIX+key||priv.examFileV317?.[st.id]===key)&&hasResults(priv,st.id);
  });
  if(used)throw Error('Diese Fassung hat bereits bewertete Ergebnisse. Das Bewertungsraster darf nicht stillschweigend überschrieben werden.');
 }
 const next=structuredClone(priv);
 next.variantAnalysesV317={...(next.variantAnalysesV317||{}),[key]:parsed};
 await v200PrivatePut(next);
 v200Eval.privateData=next;
 render();
}
function scorePanel(a,priv){
 if(!a||!priv?.roster?.length)return '';
 const students=priv.roster.map(st=>({st,choice:select(priv,st)}))
  .filter(x=>x.choice.status==='ready');
 if(!students.length)return '';
 return '<section class="detail-section v317-scores"><span class="eyebrow">ABWEICHENDE AUFGABEN · INDIVIDUELLE PUNKTE</span>'+
  '<h3>Die richtigen Aufgabenpunkte erfassen</h3>'+
  '<p>Die reguläre Punkteerfassung ist für diese Kinder gesperrt. Nur die unten gezeigten Aufgaben werden in der persönlichen Auswertung berücksichtigt. Maximalpunkte werden geprüft.</p>'+
  students.map(({st,choice})=>'<details class="v317-score-card"><summary>'+esc(st.name)+' · '+
   esc(choice.file.name)+' · '+choice.rubric.items.length+' Aufgaben</summary>'+
   '<div class="v210-scroll"><table class="v210-grid"><thead><tr><th>Aufgabe</th><th>Kompetenz</th><th>Max.</th><th>Punkte</th></tr></thead><tbody>'+
   choice.rubric.items.map(it=>{
    const comp=choice.rubric.competencies.find(c=>c.id===it.competencyId);
    const max=Number(it.source.endsWith('_bonus')?it.bonusMax:it.regularMax);
    const raw=v200GetScore(priv,st.id,it);
    return '<tr><td>'+esc(it.label||it.id)+'</td><td>'+
     esc(comp?.text||it.competencyId)+'</td><td>'+esc(max)+'</td><td>'+
     '<input type="text" inputmode="decimal" data-v317-score="'+esc(st.id+'|'+it.id)+'" '+
     'value="'+esc(raw??'')+'" placeholder="offen"></td></tr>';
   }).join('')+'</tbody></table></div>'+
   '<button class="secondary" data-v317-score-save="'+esc(st.id)+'">Punkte dieser Fassung speichern</button></details>'
  ).join('')+'</section>';
}
async function saveScores(id){
 const priv=currentPrivate(),st=(priv?.roster||[]).find(s=>s.id===id),chosen=select(priv,st);
 if(chosen.status!=='ready')throw Error('Fassung oder Bewertungsraster noch nicht freigegeben.');
 const next=structuredClone(priv);
 for(const it of chosen.rubric.items){
  const input=[...document.querySelectorAll('[data-v317-score]')].find(x=>x.dataset.v317Score===id+'|'+it.id);
  if(!input)throw Error('Eingabefeld fehlt für '+it.id);
  const max=Number(it.source.endsWith('_bonus')?it.bonusMax:it.regularMax);
  const mark=core.isScore(input.value,max);
  const field=it.source==='classtime'?'scores':it.source==='paper'?'paperScores':'bonusScores';
  next[field]=next[field]||{};next[field][id]=next[field][id]||{};
  if(mark===null)delete next[field][id][it.id];
  else next[field][id][it.id]=mark;
  next.scoreSourcesV211=next.scoreSourcesV211||{};
  next.scoreSourcesV211[id]=next.scoreSourcesV211[id]||{};
  next.scoreSourcesV211[id][it.id]=mark===null?'unresolved':'manual';
 }
 await v200PrivatePut(next);
 v200Eval.privateData=next;
 render();
}
function groupSummary(priv){
 const reports=v200ReportList(),groups=new Map();
 for(const r of reports){
  const label=r.examVariantLabelV317||(r.examVariantV300&&r.examVariantV300!=='standard'?r.examVariantV300:'Reguläre Arbeit');
  const key=r.examFileV317||label;
  if(!groups.has(key))groups.set(key,{label,rows:[]});
  groups.get(key).rows.push(r);
 }
 return '<section class="detail-section v317-groups"><span class="eyebrow">KLASSENBLICK NACH PRÜFUNGSFASSUNG</span>'+
  '<h3>Unterschiedliche Aufgaben nicht vermischen</h3>'+
  '<p>Kompetenz- und Punktvergleiche erfolgen nur innerhalb derselben Prüfungsfassung. Die individuellen Rückmeldebögen nutzen automatisch das jeweilige Raster.</p>'+
  [...groups.values()].map(g=>{
   const finished=g.rows.filter(x=>x.complete),sample=finished[0];
   const distribution=sample?.competencies?.map(c=>{
    const vals=finished.map(r=>r.competencies.find(v=>v.id===c.id)).filter(Boolean);
    return '<li>'+esc(c.text)+' · '+vals.filter(v=>v.status==='erreicht').length+
     ' erreicht / '+vals.filter(v=>v.status==='teilweise erreicht').length+
     ' teilweise / '+vals.filter(v=>v.status==='noch nicht erreicht').length+' noch nicht</li>';
   }).join('')||'';
   return '<details class="v317-group"><summary>'+esc(g.label)+' · '+finished.length+'/'+g.rows.length+
    ' vollständig</summary>'+(distribution?'<ul>'+distribution+'</ul>':
    '<p class="muted">Noch keine vollständig bewertete Arbeit.</p>')+'</details>';
  }).join('')+'</section>';
}
const step2Before=v200Step2;
v200Step2=function(a,priv){return rubricPanel(a,priv)+step2Before(a,priv);};
const step4Before=v200Step4;
v200Step4=function(a,priv){return assignmentPanel(a,priv)+scorePanel(a,priv)+step4Before(a,priv);};
const step5Before=v200Step5;
v200Step5=function(a,priv){
 let html=step5Before(a,priv);
 if(!specialFiles(a).length)return html;
 const existing=/<section class="detail-section"><span class="eyebrow">KLASSENBLICK<\/span>[\s\S]*?<\/section>/;
 // If a later module uses another wrapper, still show the grouped summary.
 return existing.test(html)?html.replace(existing,groupSummary(priv)):groupSummary(priv)+html;
};
const wireBefore=wire;
wire=function(){
 wireBefore();
 if(view!=='evaluation'||!v200Eval)return;
 document.querySelectorAll('[data-v317-copy]').forEach(b=>b.onclick=()=>{
  void copyPrompt(b.dataset.v317Copy).catch(e=>alert(e.message||e));
 });
 document.querySelectorAll('[data-v317-bundle]').forEach(b=>b.onclick=()=>{
  void bundle(b.dataset.v317Bundle).catch(e=>alert(e.message||e));
 });
 document.querySelectorAll('[data-v317-save]').forEach(b=>b.onclick=()=>{
  void saveRubric(b.dataset.v317Save).catch(e=>alert('Raster nicht gespeichert: '+(e.message||e)));
 });
 document.querySelectorAll('[data-v317-activate]').forEach(b=>b.onclick=()=>{
  const id=b.dataset.v317Activate;
  const key=[...document.querySelectorAll('[data-v317-student-file]')].find(x=>x.dataset.v317StudentFile===id)?.value;
  void activate(id,key).catch(e=>alert('Bewertungsfassung nicht aktiviert: '+(e.message||e)));
 });
 document.querySelectorAll('[data-v317-score-save]').forEach(b=>b.onclick=()=>{
  void saveScores(b.dataset.v317ScoreSave).catch(e=>alert('Punkte nicht gespeichert: '+(e.message||e)));
 });
 const blocked=new Set((currentPrivate()?.roster||[])
  .filter(st=>select(currentPrivate(),st).status!=='standard')
  .map(st=>st.id));
 for(const input of document.querySelectorAll('[data-v210-grid-score],[data-v200-score]')){
  const key=input.getAttribute('data-v210-grid-score')||input.getAttribute('data-v200-score')||'';
  if(blocked.has(key.split('|')[0])){
   input.disabled=true;
   input.title='Hier gilt eine abweichende Fassung: Punkte ausschließlich im eigenen Aufgabenraster erfassen.';
  }
 }
};
const renderBefore=render;
render=function(){
 renderBefore();
 const label=document.querySelector('.brand small');
 if(label)label.textContent=(state.settings?.schoolYear||'')+' · V0.31.7';
};
window.SchulcockpitExamAnalysisV317={
 analysisForVariant,labelForVariant,variantOptions,validateBatch,
 select,assignments,hasResults
};
})();