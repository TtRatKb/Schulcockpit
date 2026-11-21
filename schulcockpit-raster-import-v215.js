/* Schulcockpit V0.21.5 – quelltreuer Rasterimport und eindeutige Navigation.
 * Keine stillen Umdeutungen: provided-rubric bleibt provided-rubric,
 * lediglich die von der Lehrkraft bestätigte lokale Quelldatei wird verknüpft. */
const V215_VERSION='V0.21.5';
let v215ImportError='';

function v215RubricSourceMismatch(raw,a){
  if(!raw?.trim()||!a)return null;
  let obj;
  try{obj=v209ExtractRubricInput(raw);}
  catch{return null;} // Der normale Parser zeigt separat den JSON-Fehler.
  if(obj?.rubricV209?.origin!=='provided-rubric'||v209ConfirmedChatScreenshot(obj.rubricV209))return null;
  const file=String(obj.rubricV209.sourceFile||'').trim();
  if(file&&(a.files||[]).some(f=>String(f.name||'').trim()===file))return null;
  return {file,analysis:obj};
}
function v215RubricResolver(a){
  const mismatch=v215RubricSourceMismatch(v200Eval?.rawImport||'',a);
  if(!mismatch)return '';
  const files=a.files||[];
  const options=files.map(f=>{
    const role=v214Role(a,f),desc=role==='rubric'?'bereits als Raster markiert':
      role==='used'?'tatsächlich geschriebene Datei':'Archiv / Referenz';
    return '<option value="'+esc(f.id)+'">'+esc(f.name)+' · '+esc(desc)+'</option>';
  }).join('');
  return '<section class="detail-section v215-resolve" id="v215-rubric-resolve" role="region" aria-label="Herkunft des Kompetenzrasters">'
    +'<span class="eyebrow">RASTERQUELLE KLÄREN</span>'
    +'<h3>Kein Raster-Upload nötig, wenn ChatGPT die Zeilen erstellt hat</h3>'
    +'<p>Die eingefügte Analyse bezeichnet <strong>'+esc(mismatch.file||'eine nicht benannte Datei')+'</strong> als Originalraster. '
    +'Diese Datei ist hier nicht hinterlegt. Wähle bitte, woher die Rasterzeilen wirklich stammen. '
    +'Die vorhandene Analyse bleibt erhalten.</p>'
    +'<div class="v215-source-choices" role="radiogroup" aria-label="Raster-Herkunft">'
    +'<label class="v215-source-choice"><input name="v215-source-choice" type="radio" value="task-derived" checked>'
    +'<span><strong>Von ChatGPT aus den Prüfungsaufgaben erstellt</strong>'
    +'<small>Der Screenshot war allenfalls eine Anregung. Die Rasterzeilen wurden neu aus den tatsächlichen Aufgaben abgeleitet; keine wörtliche Übernahme aus dem Kolleg*innenraster.</small></span></label>'
    +'<label class="v215-source-choice"><input name="v215-source-choice" type="radio" value="chat-screenshot">'
    +'<span><strong>Kolleg*innenraster als Screenshot im Chat verwendet</strong>'
    +'<small>ChatGPT hat das vorhandene Raster aus dem Screenshot übernommen. Die Quelldatei liegt nicht im Schulcockpit, der Ursprung bleibt ausdrücklich dokumentiert.</small></span></label></div>'
    +'<label class="v215-source-confirm"><input type="checkbox" id="v215-source-confirm">'
    +'<span>Ich habe die gewählte Herkunft geprüft und werde die Rasterzeilen und Aufgabenbezüge vor der Freigabe kontrollieren.</span></label>'
    +'<button class="primary" type="button" data-v215-confirm-source>Herkunft bestätigen und Analyse prüfen →</button>'
    +'<details class="v215-source-local"><summary>Stattdessen eine echte Rasterdatei verknüpfen (optional)</summary>'
    +(files.length?'<label class="v215-local-select">Welche lokal gespeicherte Datei enthält dieses Raster?'
      +'<select id="v215-rubric-file"><option value="">— Datei auswählen —</option>'
      +options+'</select></label>'
      +'<label class="v215-verify"><input type="checkbox" id="v215-rubric-confirm">'
      +'<span>Ich habe geprüft, dass diese Datei das Kompetenzraster mit den in der Analyse genannten Zeilen enthält.</span></label>'
      +'<button class="secondary" type="button" data-v215-attach-rubric>Rasterdatei verknüpfen →</button>'
      :'<p class="microcopy">Aktuell ist keine Rasterdatei lokal hinterlegt. Du kannst sie bei Bedarf ergänzen.</p>')
    +'<label class="upload-button">Rasterdatei hier lokal ergänzen'
    +'<input type="file" id="v215-add-rubric" accept=".pdf,.png,.jpg,.jpeg,.docx,.doc" hidden></label>'
    +'</details>'
    +'<p class="microcopy">Eine Kolleg*innenvorlage wird niemals automatisch in einen ChatGPT-Vorschlag umdeklariert. '
    +'Das geht nur mit deiner ausdrücklichen Bestätigung. Namen, Schülerpunkte und Originaldateien bleiben unverändert.</p></section>';
}
function v215ProvenanceCorrection(analysis,choice){
  if(analysis?.rubricV209?.origin!=='provided-rubric')throw Error('Keine ungeklärte Rasterquelle vorhanden.');
  if(!['task-derived','chat-screenshot'].includes(choice))throw Error('Bitte eine Rasterquelle auswählen.');
  const result=structuredClone(analysis),rubric=result.rubricV209;
  if(choice==='task-derived'){
    rubric.origin='task-derived';
    rubric.sourceFile='';
    rubric.derivationNote=[String(rubric.derivationNote||'').trim(),
      'Lehrkraft bestätigt: ChatGPT hat die Rasterzeilen aus den tatsächlich geprüften Aufgaben neu formuliert; die Kolleg*innenvorlage wurde nicht wortgleich übernommen.']
      .filter(Boolean).join(' ');
    delete rubric.sourceKindV3322;
    delete rubric.sourceConfirmedV3322;
    delete rubric.sourceDescriptionV3322;
  }else{
    rubric.origin='provided-rubric';
    rubric.sourceFile='';
    delete rubric.derivationNote;
    rubric.sourceKindV3322='chat-screenshot';
    rubric.sourceConfirmedV3322=true;
    rubric.sourceDescriptionV3322='Lehrkraft bestätigt: Originales Kolleg*innenraster als Screenshot im Chat gezeigt, nicht als Datei lokal im Schulcockpit hinterlegt.';
  }
  return result;
}
async function v215ConfirmSource(){
  const raw=document.getElementById('v200-analysis-import')?.value||v200Eval?.rawImport||'';
  const a=v200Assessment(v200Eval?.assessmentId),mismatch=v215RubricSourceMismatch(raw,a);
  if(!mismatch)throw Error('Der angezeigte Rasterquellen-Konflikt ist nicht mehr aktuell. Bitte die Analyse erneut prüfen.');
  const choice=document.querySelector('input[name="v215-source-choice"]:checked')?.value;
  if(!document.getElementById('v215-source-confirm')?.checked)
    throw Error('Bitte die gewählte Herkunft und die spätere fachliche Kontrolle ausdrücklich bestätigen.');
  const corrected=v215ProvenanceCorrection(mismatch.analysis,choice);
  const updated=raw.replace(
    /(<SCHULCOCKPIT_ASSESSMENT_IMPORT>\s*)[\s\S]*?(\s*<\/SCHULCOCKPIT_ASSESSMENT_IMPORT>)/,
    (_,before,after)=>before+JSON.stringify(corrected,null,2)+after
  );
  // Only provenance metadata changes. The normal schema, competency-scope,
  // point/bonus and student-data validators remain fully active.
  v200Eval.rawImport=updated;
  return v215ImportText(updated);
}
const v215Step2Before=v200Step2;
v200Step2=function(a,priv){
  let html=v215Step2Before(a,priv);
  html=html.replace('Finale ChatGPT-Antwort importieren','Aufgaben und Kompetenzvorschläge aus ChatGPT prüfen');
  html=html.replace('Analyse übernehmen','Analyse prüfen und Aufgabenplan öffnen →');
  html=html.replace('Weiter zu Ergebnissen →','Weiter zum Aufgabenplan →');
  const insert=v215RubricResolver(a);
  let notice='';
  if(v215ImportError){
    notice='<section class="detail-section v215-import-error" role="alert">'
      +'<strong>Die Analyse wurde noch nicht gespeichert.</strong>'
      +'<p>'+esc(v215ImportError)+'</p>'
      +'<p>Dein eingefügter ChatGPT-Text bleibt erhalten. Bitte die genannte Stelle prüfen; '
      +'danach denselben Import erneut versuchen.</p></section>';
  }
  if(!(a.files||[]).some(f=>v214Role(a,f)==='rubric')){
    html=html.replace('Das Paket enthält deinen Prüfungs-Prompt,',
      'Ein Kompetenzraster ist hier optional: ChatGPT soll ein auf die tatsächlichen Aufgaben gestütztes Raster vorschlagen (task-derived). Das wird vor dem Ausdruck von dir geprüft. Das Paket enthält deinen Prüfungs-Prompt,');
  }
  // Place the actionable error at the TOP, before the long read-only prompt.
  return notice+insert+html;
};
async function v215ImportText(raw){
  if(!v200Eval)throw Error('Keine Klassenarbeit geöffnet.');
  v200Eval.rawImport=raw;
  const a=v200Assessment(v200Eval.assessmentId);
  if(v215RubricSourceMismatch(raw,a)){
    v215ImportError='Die Rasterquelle konnte noch nicht eindeutig zugeordnet werden. '
      +'Bitte oben zwischen ChatGPT-Vorschlag, Screenshot im Chat und lokaler Datei wählen.';
    render();
    return false;
  }
  try{
    await v200ImportAnalysis(raw);
    v215ImportError='';
    v200Eval.step=3;
    render();
    return true;
  }catch(e){
    v215ImportError=e.message||String(e);
    // No source/analysis metadata changed if the underlying validator fails.
    render();
    return false;
  }
}
async function v215AttachRubric(){
  const id=v200Eval?.assessmentId;
  const a=v200Assessment(id),raw=v200Eval?.rawImport||'';
  const mismatch=v215RubricSourceMismatch(raw,a);
  if(!mismatch)throw Error('Es gibt keine noch offene Rasterquelle.');
  const selectedId=document.getElementById('v215-rubric-file')?.value;
  const verified=!!document.getElementById('v215-rubric-confirm')?.checked;
  const file=(a.files||[]).find(f=>f.id===selectedId);
  if(!file||!verified)throw Error('Bitte die passende Datei auswählen und die Herkunft des Rasters bestätigen.');
  const obj=structuredClone(mismatch.analysis);
  obj.rubricV209.sourceFile=file.name; // Exact local filename, no changes to rubric criteria.
  const corrected=raw.replace(
    /(<SCHULCOCKPIT_ASSESSMENT_IMPORT>\s*)[\s\S]*?(\s*<\/SCHULCOCKPIT_ASSESSMENT_IMPORT>)/,
    (_,start,end)=>start+JSON.stringify(obj,null,2)+end
  );
  // A used exam file may contain its own raster; do not remove the used role.
  const oldRoles=structuredClone(a.evaluationFilesV214||{});
  if(v214Role(a,file)==='reference'){
    a.evaluationFilesV214={...oldRoles,[file.id]:'rubric'};
  }
  v200Eval.rawImport=corrected;
  try{
    // First the full existing rubric/schema/pointer validator must pass.
    // It never modifies original IDs, wording, points or pupil records.
    const accepted=await v215ImportText(corrected);
    if(!accepted){
      a.evaluationFilesV214=oldRoles;
      v200Eval.rawImport=raw;
      render();
      return false;
    }
    // The successful V0.20.9 importer already persisted the full assessment,
    // including the deliberately linked source role.
    return true;
  }catch(e){
    a.evaluationFilesV214=oldRoles;
    v200Eval.rawImport=raw;
    throw e;
  }
}
const v215OpenBefore=v200OpenEval;
v200OpenEval=async function(id){
  v215ImportError='';
  return v215OpenBefore(id);
};
const v215WireBefore=wire;
wire=function(){
  v215WireBefore();
  // Replace previous click listener (installed by V0.20.0) rather than
  // letting it show the incorrect success popup after a failed validation.
  const prior=document.querySelector('[data-v200-analysis-import]');
  if(prior){
    const button=prior.cloneNode(true);
    prior.replaceWith(button);
    button.textContent='Analyse prüfen und Aufgabenplan öffnen →';
    button.addEventListener('click',async()=>{
      const raw=document.getElementById('v200-analysis-import')?.value||'';
      button.disabled=true;
      try{await v215ImportText(raw);}
      finally{button.disabled=false;}
    });
  }
  document.querySelector('[data-v215-confirm-source]')?.addEventListener('click',async e=>{
    const button=e.currentTarget;
    button.disabled=true;
    try{await v215ConfirmSource();}
    catch(err){v215ImportError=err.message||String(err);render();}
    finally{button.disabled=false;}
  });
  document.querySelector('[data-v215-attach-rubric]')?.addEventListener('click',async e=>{
    const button=e.currentTarget;
    button.disabled=true;
    try{await v215AttachRubric();}
    catch(err){v215ImportError=err.message||String(err);render();}
    finally{button.disabled=false;}
  });
  document.getElementById('v215-add-rubric')?.addEventListener('change',async e=>{
    const f=e.currentTarget.files?.[0];
    if(!f)return;
    try{
      if(typeof v214UploadFiles!=='function')throw Error('Dateiupload ist nicht verfügbar.');
      await v214UploadFiles([f]);
      v215ImportError='Rasterdatei lokal gespeichert. Wähle sie nun oben aus und bestätige die Zuordnung.';
      render();
    }catch(err){v215ImportError='Datei konnte nicht gespeichert werden: '+(err.message||err);render();}
  });
};
const v215RenderBefore=render;
render=function(){
  v215RenderBefore();
  const brand=document.querySelector('.brand small');
  if(brand)brand.textContent=state.settings.schoolYear+' · '+V215_VERSION;
};
render();