/* Schulcockpit V0.30.0 – staged Classtime batches, already-finished PDFs and
 * variant-specific competency rubrics. All student data remains in private IDB.
 */
(function(){
'use strict';
const core=SC_MAKEUP_BATCH_V300;
let busy=false,message='';
const $=selector=>document.querySelector(selector);
function exam(){return v200Assessment(v200Eval?.assessmentId);}
function privateData(){return v200Eval?.privateData;}
function variantName(value){return ({standard:'Reguläre Arbeit',inclusion:'Förder-/Inklusionsarbeit',alternative:'Eigenständige Nachschreibearbeit'})[value]||value;}
function analysisFor(kind){
 const p=privateData();
 return kind==='standard'?v200EvalAnalysis():p?.variantAnalysesV300?.[kind]||null;
}
function selectedReportAnalysis(priv,student){
 const key=priv?.activeVariantV300?.[student?.id]||'standard';
 return key==='standard'?null:priv?.variantAnalysesV300?.[key]||null;
}
const beforeReport=v200StudentReport;
v200StudentReport=function(priv,an,student){
 const selected=selectedReportAnalysis(priv,student),kind=priv?.activeVariantV300?.[student?.id]||'standard';
 if(kind!=='standard'&&!selected){
  const old=beforeReport(priv,an,student);
  return {...old,complete:false,missing:['Prüfungsraster der Variante fehlt'],examVariantV300:kind};
 }
 const r=beforeReport(priv,selected||an,student);
 return {...r,examVariantV300:kind};
};
const priorDetail=v210CalculationDetail;
v210CalculationDetail=function(priv,an,student){
 return priorDetail(priv,selectedReportAnalysis(priv,student)||an,student);
};
// The PDF itself must tell the recipient which examination version was
// assessed. The main exam title, all layout dimensions and scores stay intact.
const priorPdfHeader=v233Header;
v233Header=function(out,r,a,p,cont){
 const result=priorPdfHeader(out,r,a,p,cont);
 if(r.examVariantV300&&r.examVariantV300!=='standard'){
  const topic=v233Topic(a)||'Deine Ergebnisse',size=topic.length>46?16:topic.length>27?20:24;
  const offset=(v233Wrap(topic,506,size,'F4').length-1)*23;
  v233Text(out,553,719-offset,variantName(r.examVariantV300),8.5,'F2',p.muted,'right');
 }
 return result;
};
function summary(){
 const priv=privateData()||{},reports=v200ReportList();
 const ready=reports.filter(r=>r.complete||(r.learningSupportV235&&r.scoreCompleteV283)).length;
 const makeup=reports.filter(r=>['makeup','absent'].includes(priv.participationV210?.[r.student.id])).length;
 const pending=reports.length-ready;
 const batches=(priv.makeupBatchesV300||[]),imported=batches.filter(b=>b.importedAt).length;
 return '<section class="detail-section v300-summary"><div class="v300-top"><div>'+
 '<span class="eyebrow">VORKORREKTUR · DIESE KLASSENARBEIT</span><h3>Fertige Arbeiten jetzt abschließen</h3>'+
 '<p>Du kannst die bereits geschriebenen Arbeiten vollständig bewerten, persönliche Rückmeldungen speichern '+
 'und die fertigen Bögen bereits vor dem Nachschreibetermin als PDF ausgeben.</p></div>'+
 '<div class="v300-stats"><strong>'+ready+'/'+reports.length+'</strong><small>Bögen druckbereit</small>'+
 '<strong>'+makeup+'</strong><small>Als Nachschreiben/fehlend geführt</small>'+
 '<strong>'+imported+'</strong><small>Nachimporte übernommen</small></div></div>'+
 (pending?'<p class="microcopy">'+pending+' Bögen sind noch unvollständig oder haben offene Teilwertungen. '+
 'Sie werden beim PDF-Export nicht als fertig ausgegeben.</p>':'')+
 '<div class="v200-actions"><button class="secondary" data-v300-step="4">Punkte weiterkorrigieren</button>'+
 '<button class="secondary" data-v300-step="5">Persönliche Rückmeldungen prüfen</button>'+
 '<button class="primary" data-v300-step="5">Fertige Kompetenzbögen als PDF vorbereiten →</button></div></section>';
}
function options(arr,selected){
 return arr.map(([v,label])=>'<option value="'+esc(v)+'" '+(String(v)===String(selected)?'selected':'')+'>'+esc(label)+'</option>').join('');
}
function importPanel(){
 const priv=privateData(),a=exam();
 if(!a)return '';
 const batches=priv?.makeupBatchesV300||[];
 return '<section class="detail-section v300-section"><div class="section-head compact">'+
 '<div><span class="eyebrow">NACHSCHREIBEN · ERGÄNZEN STATT NEU BEGINNEN</span>'+
 '<h3>Weitere Classtime-Excel-Dateien übernehmen</h3></div>'+
 '<label class="upload-button">+ Nachschreiberdateien auswählen / ablegen'+
 '<input type="file" data-v300-files accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple hidden></label></div>'+
 '<p>Wähle auch mehrere Dateien gleichzeitig, etwa zwei Ergebnisse der normalen Arbeit und zwei der '+
 'Inklusionsarbeit. Jede Datei wird <strong>zunächst nur lokal geprüft</strong>. Namen, Q-Fragen und '+
 'Maximalpunkte musst du vor der Übernahme bestätigen. Vorhandene Bewertungen und PDFs bleiben erhalten.</p>'+
 '<details class="v300-rubrics"><summary>Andere Aufgaben / Punkteverteilung: zusätzliches Variantenraster anlegen</summary>'+
 '<p>Für Förder- und abweichende Nachschreibearbeiten braucht es ein eigenes, fachlich geprüftes Aufgaben-/Kompetenzraster. '+
 'Du kannst dafür dasselbe <code>SCHULCOCKPIT_ASSESSMENT_IMPORT</code>-Format wie bei der Originalarbeit verwenden. '+
 'Diese Variantenanalyse wird <strong>nur in der privaten Auswertung</strong> gespeichert, '+
 'nicht als Ersatz für die ursprüngliche Klassenarbeit.</p>'+
 '<label>Variante<select data-v300-rubric-kind>'+options([['inclusion','Förder-/Inklusionsarbeit'],['alternative','Eigenständige Nachschreibearbeit']],'inclusion')+'</select></label>'+
 '<p><button type="button" class="secondary" data-v300-copy-variant-prompt>Datenschutzsicheren Analyse-Prompt für diese Variante kopieren</button></p>'+
 '<textarea data-v300-rubric rows="5" placeholder="Hier die geprüfte Aufgaben-/Kompetenzanalyse einfügen …"></textarea>'+
 '<button type="button" class="secondary" data-v300-rubric-save>Variantenraster prüfen & lokal speichern</button>'+
 '<div class="v300-rubric-status">Gespeichert: '+
 ['inclusion','alternative'].map(k=>variantName(k)+' '+(analysisFor(k)?'✓':'noch nicht')).join(' · ')+
 '</div></details>'+
 (batches.length?'<div class="v300-batch-list">'+batches.map(batchCard).join('')+'</div>':
 '<p class="microcopy">Noch keine zusätzlichen Excel-Dateien eingelesen. Du kannst die Vorkorrektur unabhängig davon bereits fertigstellen.</p>')+
 '<p class="v300-message" data-v300-message role="status">'+esc(message)+'</p></section>';
}
function batchCard(b){
 const p=privateData(),a=v200EvalAnalysis(),variant=b.variantV300||'standard';
 const source=analysisFor(variant),rows=b.det?.studentRows||[],columns=core.columns(b.parsed,b.det);
 const mappings={...(source?core.autoMap(source.items,columns):{}),...(b.mappingV300||{})};
 const proposals=core.proposals(b,p.roster||[]);
 const linked={...Object.fromEntries(proposals.map(x=>[x.rowIndex,x.studentId])),...(b.linksV300||{})};
 const replacement=new Set(b.replacementsV300||[]);
 const optionsStudents=[['','Nicht importieren / noch offen'],...(p.roster||[]).map(x=>[x.id,x.name])];
 const kindSelect='<select data-v300-variant="'+esc(b.id)+'">'+
 options([['standard','Reguläre Arbeit'],['inclusion','Förder-/Inklusionsarbeit'],['alternative','Eigenständige Nachschreibearbeit']],variant)+'</select>';
 if(b.importedAt)return '<details class="v300-batch v300-done"><summary><strong>✓ '+esc(b.fileName)+'</strong>'+
 '<span>'+esc(variantName(variant))+' · '+(b.importedStudents||[]).length+' Zuordnung(en) übernommen</span></summary>'+
 '<p>Dieser Durchgang wurde am '+esc(b.importedAt.slice(0,10))+' übernommen. '+
 'Die Punktwerte sind lokal gespeichert. Eine erneute Übernahme derselben Datei ist gesperrt.</p></details>';
 return '<details class="v300-batch" open><summary><strong>'+esc(b.fileName)+'</strong>'+
 '<span>'+rows.length+' Excel-Zeile(n) · Zuordnung vor Übernahme erforderlich</span></summary>'+
 '<div class="v300-batch-content"><label>Zu welcher Prüfungsfassung gehören die Ergebnisse?'+kindSelect+'</label>'+
 (!source?'<p class="warnbox">Für '+esc(variantName(variant))+
 ' fehlt noch die geprüfte Aufgaben-/Kompetenzanalyse. Bitte oben das Variantenraster hinterlegen. '+
 'Die vorhandenen Punkte bleiben unangetastet.</p>':'')+
 '<div class="v210-scroll"><table class="v210-grid"><thead><tr><th>Excel-Name</th>'+
 '<th>Kind aus der vorhandenen Klassenarbeitsliste</th><th>Bisheriges Ergebnis ersetzen?</th></tr></thead><tbody>'+
 rows.map(r=>{
  const sid=linked[r.rowIndex]||'',hasExisting=sid&&['scores','paperScores','bonusScores'].some(k=>
   Object.values(p[k]?.[sid]||{}).some(v=>v!==null&&v!==undefined&&v!==''));
  return '<tr><td>'+esc(r.name)+'</td><td><select data-v300-link="'+esc(b.id+'|'+r.rowIndex)+'">'+
   options(optionsStudents,sid)+'</select></td><td>'+
   (hasExisting?'<label><input type="checkbox" data-v300-replace="'+esc(b.id+'|'+r.rowIndex)+'" '+
    (replacement.has(sid)?'checked':'')+'> Bisherige Arbeit archivieren und ersetzen</label>':
   '<small>Keine vorhandenen Punkte zu ersetzen</small>')+'</td></tr>';
 }).join('')+'</tbody></table></div>'+
 (source?'<h4>Aufgaben den Q-Spalten zuordnen</h4>'+
 '<p class="microcopy">Das Punktemaximum muss für jede Aufgabe genau übereinstimmen. '+
 'Eine Änderung der Prüfungsfassung darf nicht durch dieselbe Gesamtpunktzahl vorgetäuscht werden.</p>'+
 '<div class="v210-scroll"><table class="v210-grid"><thead><tr><th>Aufgabe</th><th>Classtime-Frage</th></tr></thead><tbody>'+
 source.items.filter(x=>x.source==='classtime').map(it=>
  '<tr><td>'+esc(it.label||it.id)+' · max. '+esc(it.regularMax)+'</td><td><select data-v300-map="'+
  esc(b.id+'|'+it.id)+'"><option value="">Bitte Q-Spalte zuordnen</option>'+
  columns.map(c=>'<option value="'+c.index+'" '+(String(mappings[it.id])===String(c.index)?'selected':'')+'>'+
   esc(c.label+' · max. '+(c.max??'offen'))+'</option>').join('')+'</select></td></tr>'
 ).join('')+'</tbody></table></div>':'')+
 '<div class="v300-actions"><button class="secondary" data-v300-save-draft="'+esc(b.id)+'">Zuordnung speichern</button>'+
 '<button class="primary" data-v300-commit="'+esc(b.id)+'" '+(!source?'disabled':'')+
 '>Geprüfte Nachschreibepunkte übernehmen →</button></div></div></details>';
}
function collect(b){
 const read=(attr)=>[...document.querySelectorAll('['+attr+']')].filter(x=>
   x.dataset[attr.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]?.startsWith(b.id+'|'));
 const linked={},replacements=new Set(),mapping={};
 for(const r of b.det.studentRows||[]){
  const key=b.id+'|'+r.rowIndex,element=$('[data-v300-link="'+CSS.escape(key)+'"]');
  const sid=element?.value||'';
  if(sid)linked[r.rowIndex]=sid;
  if(sid&&$('[data-v300-replace="'+CSS.escape(key)+'"]')?.checked)replacements.add(sid);
 }
 const an=analysisFor(b.variantV300||'standard');
 for(const it of an?.items||[]){
  if(it.source!=='classtime')continue;
  const element=$('[data-v300-map="'+CSS.escape(b.id+'|'+it.id)+'"]');
  mapping[it.id]=element?.value||'';
 }
 return {linked,replacements:[...replacements],mapping};
}
async function persist(next){
 await v200PrivatePut(next);
 v200Eval.privateData=next;
}
async function loadFiles(list){
 if(!v200Eval||!list.length)return;
 if(list.length>12)throw Error('Bitte höchstens zwölf Dateien gleichzeitig auswählen.');
 for(const file of list){
  if(!/\.xlsx$/i.test(file.name)||file.size>25*1024*1024)
   throw Error('Nur XLSX-Dateien bis 25 MB pro Datei: '+file.name);
 }
 const errors=[];
 for(const file of list){
  try{
   const parsed=await v200ParseXlsx(file),det=v200DetectClasstime(parsed);
   if(!det.sourceV210||!det.verifiedV210||!det.studentRows?.length)
    throw Error('Classtime-S-SESSION oder Teilnehmernamen nicht eindeutig erkannt.');
   const signature=core.signature(parsed,det),current=privateData()||v200DefaultPrivate(v200Eval.assessmentId);
   if((current.makeupBatchesV300||[]).some(b=>b.signature===signature))
    throw Error('Diese Ergebnisdatei wurde bereits zur Prüfung eingelesen.');
   const next=structuredClone(current);
   next.makeupBatchesV300=next.makeupBatchesV300||[];
   next.makeupBatchesV300.push({id:'batch-'+uid('v300'),fileName:file.name,signature,
    parsed,det,variantV300:'standard',mappingV300:{},linksV300:{},replacementsV300:[],
    createdAt:new Date().toISOString()});
   await persist(next);
  }catch(e){errors.push(file.name+': '+(e?.message||e));}
 }
 message=errors.length?'Nicht eingelesen: '+errors.join(' · '):
  'Dateien sind lokal gespeichert. Jetzt die einzelnen Personen und Aufgaben bestätigen.';
 render();
}
async function saveBatchDraft(id){
 const current=privateData(),b=current?.makeupBatchesV300?.find(x=>x.id===id);
 if(!b||b.importedAt)throw Error('Dieser Import ist bereits abgeschlossen.');
 const draft=collect(b),next=structuredClone(current),target=next.makeupBatchesV300.find(x=>x.id===id);
 Object.assign(target,{linksV300:draft.linked,replacementsV300:draft.replacements,mappingV300:draft.mapping});
 await persist(next);
 return target;
}
async function commitBatch(id){
 const current=privateData(),b=current?.makeupBatchesV300?.find(x=>x.id===id);
 if(!b||b.importedAt)throw Error('Dieser Import wurde bereits übernommen.');
 const draft=collect(b),kind=b.variantV300||'standard',an=analysisFor(kind);
 if(!an)throw Error('Für die ausgewählte Fassung fehlt das eigene geprüfte Raster.');
 const roster=current.roster||[];
 const proposal=core.evaluate({batch:b,analysis:an,roster,
  linked:draft.linked,mapping:draft.mapping,current,variant:kind,replacement:draft.replacements});
 if(proposal.chosen.some(x=>x.replace)){
  const names=proposal.chosen.filter(x=>x.replace).map(x=>x.name);
  if(!confirm('ACHTUNG: Bei '+names.join(', ')+' werden die bisherigen Punkte, individuellen '+
   'Bewertungsregeln und persönlichen Rückmeldungstexte im aktiven Versuch ERSETZT. '+
   'Die bisherigen Ergebnisse bleiben lokal in der Versuchshistorie gespeichert. '+ 
   'Nur durchführen, wenn die neue Arbeit tatsächlich gelten soll. Fortfahren?'))return;
 }
 if(!confirm('Geprüften Import bestätigen:\n'+proposal.count+' Kind(er), '+proposal.points+
  ' bewertete Felder, Prüfungsfassung: '+variantName(kind)+
  '.\nBereits korrigierte andere Kinder bleiben unverändert. Jetzt übernehmen?'))return;
 const copy=structuredClone(current),target=copy.makeupBatchesV300.find(x=>x.id===id);
 Object.assign(target,{linksV300:draft.linked,replacementsV300:draft.replacements,mappingV300:draft.mapping});
 const next=core.apply(copy,proposal,target);
 await persist(next);
 message='✓ '+proposal.count+' Ergebnis(se) ergänzt. Vorherige Korrekturen bleiben erhalten.';
 v200Eval.step=5;render();
}
async function saveRubric(){
 const kind=$('[data-v300-rubric-kind]')?.value,raw=$('[data-v300-rubric]')?.value||'';
 if(!['inclusion','alternative'].includes(kind))throw Error('Bitte eine gültige Variante auswählen.');
 const parsed=v200ExtractAnalysis(raw);
 const current=privateData(),old=current.variantAnalysesV300?.[kind];
 if(old&&JSON.stringify(old)!==JSON.stringify(parsed)&&
  (current.makeupHistoryV300||[]).some(x=>x.variant===kind))
  throw Error('Für diese Prüfungsvariante sind bereits Punkte importiert. Bitte das bestehende Raster nicht still überschreiben.');
 const next=structuredClone(current);next.variantAnalysesV300={...(next.variantAnalysesV300||{}),[kind]:parsed};
 await persist(next);message='✓ Raster für '+variantName(kind)+' lokal gespeichert.';render();
}
function alternativeScorePanel(){
 const priv=privateData(),variants=(priv?.roster||[]).filter(s=>
  ['inclusion','alternative'].includes(priv.activeVariantV300?.[s.id]));
 if(!variants.length)return '';
 return '<section class="detail-section v300-alternates"><h3>Andere Prüfungsfassungen – eigene Aufgabenpunkte</h3>'+
 '<p>Bei den hier aufgeführten Kindern gilt das bestätigte Variantenraster. '+
 'Die reguläre Punktematrix wird für diese Kinder gesperrt; bearbeite ihre abweichenden Aufgaben hier.</p>'+
 variants.map(s=>{
  const kind=priv.activeVariantV300[s.id],an=analysisFor(kind);
  if(!an)return '<p class="warnbox">'+esc(s.name)+': Variantenraster fehlt.</p>';
  return '<details><summary>'+esc(s.name)+' · '+esc(variantName(kind))+'</summary>'+
  '<div class="v210-scroll"><table class="v210-grid"><thead><tr><th>Teilaufgabe</th><th>Max.</th><th>Punkte</th></tr></thead><tbody>'+
  an.items.map(it=>{
   const raw=v200GetScore(priv,s.id,it);
   const max=it.source.endsWith('_bonus')?it.bonusMax:it.regularMax;
   return '<tr><td>'+esc(it.label||it.id)+'</td><td>'+esc(max)+'</td><td>'+
   '<input type="text" inputmode="decimal" data-v300-score="'+esc(s.id+'|'+it.id)+
   '" value="'+esc(raw??'')+'" placeholder="noch offen"></td></tr>';
  }).join('')+'</tbody></table></div>'+
  '<button class="secondary" data-v300-store-scores="'+esc(s.id)+'">Punkte dieser Fassung speichern</button></details>';
 }).join('')+'</section>';
}
async function saveVariantScores(id){
 const p=privateData(),stu=p.roster.find(s=>s.id===id);
 if(!stu)throw Error('Kind nicht gefunden.');
 const an=analysisFor(p.activeVariantV300?.[id]||'standard');
 if(!an)throw Error('Variantenraster fehlt.');
 const next=structuredClone(p);
 for(const it of an.items){
  const selector='[data-v300-score="'+CSS.escape(id+'|'+it.id)+'"]',input=$(selector);
  if(!input)throw Error('Eingabefeld fehlt: '+it.id);
  const max=it.source.endsWith('_bonus')?Number(it.bonusMax):Number(it.regularMax);
  const score=core.isScore(input.value,max);
  const field=it.source==='classtime'?'scores':it.source==='paper'?'paperScores':'bonusScores';
  next[field]=next[field]||{};next[field][id]=next[field][id]||{};
  if(score===null)delete next[field][id][it.id];
  else next[field][id][it.id]=score;
  next.scoreSourcesV211=next.scoreSourcesV211||{};
  next.scoreSourcesV211[id]=next.scoreSourcesV211[id]||{};
  next.scoreSourcesV211[id][it.id]=score===null?'unresolved':'manual';
 }
 await persist(next);message='✓ Punkte für '+stu.name+' gespeichert.';render();
}
const beforeStep3=v200Step3;
v200Step3=function(a,priv){return summary()+importPanel()+beforeStep3(a,priv);};
const beforeStep4=v200Step4;
v200Step4=function(a,priv){return summary()+alternativeScorePanel()+beforeStep4(a,priv);};
const beforeStep5=v200Step5;
v200Step5=function(a,priv){
 const h=beforeStep5(a,priv),alt=(priv?.roster||[]).filter(s=>priv.activeVariantV300?.[s.id]&&
  priv.activeVariantV300[s.id]!=='standard').length;
 return summary()+(alt?'<p class="v300-variants-warning">Es sind '+alt+
  ' andere Prüfungsfassung(en) aktiv. Im Klassenüberblick bitte keine ungleichen '+
  'Aufgaben-/Punkteraster direkt vergleichen; die individuellen Bögen verwenden das jeweilige Variantenraster.</p>':'')+h;
};
const beforeWire=wire;
wire=function(){
 beforeWire();
 if(view!=='evaluation'||!v200Eval)return;
 document.querySelectorAll('[data-v300-step]').forEach(b=>b.onclick=()=>{
  v200Eval.step=Number(b.dataset.v300Step);render();
 });
 document.querySelector('[data-v300-files]')?.addEventListener('change',e=>{
  const files=[...e.target.files];if(!files.length)return;
  busy=true;e.target.disabled=true;
  void loadFiles(files).catch(err=>{message='Fehler: '+(err.message||err);render();})
   .finally(()=>busy=false);
 });
 document.querySelectorAll('[data-v300-variant]').forEach(select=>select.onchange=async()=>{
  const current=privateData(),b=current?.makeupBatchesV300?.find(b=>b.id===select.dataset.v300Variant);
  if(!b||b.importedAt)return;
  try{
   const next=structuredClone(current),target=next.makeupBatchesV300.find(x=>x.id===b.id);
   target.variantV300=select.value;
   // A new rubric has different Q questions; require visible mapping review.
   target.mappingV300={};
   await persist(next);render();
  }catch(err){message='Variante nicht gespeichert: '+(err.message||err);render();}
 });
 document.querySelectorAll('[data-v300-save-draft]').forEach(btn=>btn.onclick=async()=>{
  try{await saveBatchDraft(btn.dataset.v300SaveDraft);message='✓ Zuordnung lokal gespeichert.';render();}
  catch(err){message='Nicht gespeichert: '+(err.message||err);render();}
 });
 document.querySelectorAll('[data-v300-commit]').forEach(btn=>btn.onclick=async()=>{
  if(busy)return;busy=true;btn.disabled=true;
  try{await commitBatch(btn.dataset.v300Commit);}
  catch(err){message='Keine Ergebnisse übernommen: '+(err.message||err);render();}
  finally{busy=false;}
 });
 document.querySelector('[data-v300-copy-variant-prompt]')?.addEventListener('click',async()=>{
  try{
   const kind=$('[data-v300-rubric-kind]')?.value;
   const a=exam(),p=privateData(),an=a?.evaluationV200?.analysis;
   if(!a||!['inclusion','alternative'].includes(kind))throw Error('Prüfungsvariante fehlt.');
   const plain=v200AssessmentAnalysisPrompt(a,{...p,classtime:null});
   const custom='WICHTIG: Du erstellst ausschließlich ein NEUES, gesondertes Aufgaben- und Kompetenzraster für die '+
    variantName(kind)+'. Prüfe die zugehörige tatsächlich geschriebene Variante, NICHT die ursprüngliche Arbeit. '+
    'Die reguläre Klassenarbeit und ihre alten Punkte bleiben unverändert. '+ 
    'Übernimm bestätigte Kompetenztexte und Prozentgrenzen aus vorhandenen Grundlagen; '+
    'weichen Aufgaben, Kompetenzen, reguläre Maximalpunkte oder Bonusanteile ab, '+ 
    'verwende die für diese Fassung tatsächlich gültigen Werte. '+ 
    'Niemals einzelne Schülerantworten, Namen oder Ergebnisse an ChatGPT übergeben. '+
    'Gib GENAU EINEN SCHULCOCKPIT_ASSESSMENT_IMPORT-Block für diese Variante aus.\n\n';
   await navigator.clipboard.writeText(custom+plain);
   message='✓ Anonymer Analyse-Prompt kopiert. Ergänze in ChatGPT die Aufgaben der Variante ohne Schülerdaten.';
   const slot=$('[data-v300-message]');if(slot)slot.textContent=message;
  }catch(err){message='Prompt nicht kopiert: '+(err.message||err);
   const slot=$('[data-v300-message]');if(slot)slot.textContent=message;}
 });
 document.querySelector('[data-v300-rubric-save]')?.addEventListener('click',()=>{
  void saveRubric().catch(err=>{message='Variantenraster nicht gespeichert: '+(err.message||err);render();});
 });
 document.querySelectorAll('[data-v300-store-scores]').forEach(btn=>btn.onclick=()=>{
  void saveVariantScores(btn.dataset.v300StoreScores).catch(err=>{message='Punkte nicht gespeichert: '+(err.message||err);render();});
 });
 // In the regular grid, alternate versions must never be accidentally scored
 // against the *regular* item maxima.
 for(const s of privateData()?.roster||[]){
  if(!['inclusion','alternative'].includes(privateData().activeVariantV300?.[s.id]))continue;
  const selector='[data-v210-grid-score^="'+CSS.escape(s.id+'|')+'"]';
  for(const input of document.querySelectorAll(selector)){
   input.disabled=true;
   input.title='Abweichende Prüfungsfassung: Punkte im gesonderten Variantenraster oben bearbeiten.';
  }
 }
};
const beforeRender=render;
render=function(){
 beforeRender();
 const label=document.querySelector('.brand small');
 if(label)label.textContent=state.settings.schoolYear+' · V0.30.0';
};
if(typeof window!=='undefined')window.SchulcockpitMakeupsV300={summary,importPanel,analysisFor,core};
})();