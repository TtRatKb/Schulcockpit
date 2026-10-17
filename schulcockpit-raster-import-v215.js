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
  if(obj?.rubricV209?.origin!=='provided-rubric')return null;
  const file=String(obj.rubricV209.sourceFile||'').trim();
  if(file&&(a.files||[]).some(f=>String(f.name||'').trim()===file))return null;
  return {file,analysis:obj};
}
function v215RubricResolver(a){
  const raw=v200Eval?.rawImport||'';
  const mismatch=v215RubricSourceMismatch(raw,a);
  if(!mismatch)return '';
  const files=a.files||[];
  const options=files.map(f=>{
    const role=v214Role(a,f),desc=role==='rubric'?'bereits als Raster markiert':
      role==='used'?'tatsächlich geschriebene Datei':'Archiv / Referenz';
    return '<option value="'+esc(f.id)+'">'+esc(f.name)+' · '+esc(desc)+'</option>';
  }).join('');
  return '<section class="detail-section v215-resolve" id="v215-rubric-resolve" role="status">'
    +'<span class="eyebrow">EINMALIGE QUELLENZUORDNUNG</span>'
    +'<h3>Kompetenzraster wiederfinden – ohne ChatGPT erneut zu bemühen</h3>'
    +'<p>Deine eingefügte Analyse nennt als Rasterquelle <strong>'
    +esc(mismatch.file||'(ohne Dateinamen)')+'</strong>. Unter diesem genauen Namen '
    +'ist sie bei dieser Klassenarbeit nicht gespeichert. Das ist zunächst nur ein '
    +'Dateizuordnungsproblem; deine Analyse bleibt im Eingabefeld erhalten.</p>'
    +(files.length?'<label>Welche deiner lokal gespeicherten Dateien enthält wirklich dieses Raster?'
      +'<select id="v215-rubric-file"><option value="">— Datei auswählen —</option>'
      +options+'</select></label>'
      +'<label class="v215-verify"><input type="checkbox" id="v215-rubric-confirm">'
      +'<span>Ich habe geprüft, dass diese Datei das Kompetenzraster mit den '
      +'in der Analyse genannten Zeilen enthält.</span></label>'
      +'<button class="primary" data-v215-attach-rubric>Rasterdatei verknüpfen und Analyse prüfen →</button>'
      :'<p class="warnbox">Für diese Klassenarbeit ist noch keine lokale Prüfungsdatei gespeichert. '
        +'Bitte zuerst das tatsächlich verwendete Kompetenzraster hinzufügen.</p>')
    +'<label class="upload-button">Rasterdatei hier lokal ergänzen'
    +'<input type="file" id="v215-add-rubric" accept=".pdf,.png,.jpg,.jpeg,.docx,.doc" hidden></label>'
    +'<p class="microcopy">Es wird nichts gelöscht und kein Schülerergebnis übertragen. '
    +'„Aus Aufgaben abgeleitet“ wird nicht automatisch gesetzt: Das Kollegiumsraster '
    +'bleibt ein vorgegebenes Raster, sobald seine echte Quelle verknüpft ist.</p></section>';
}
const v215Step2Before=v200Step2;
v200Step2=function(a,priv){
  let html=v215Step2Before(a,priv);
  html=html.replace('Finale ChatGPT-Antwort importieren','Aufgaben und Kompetenzraster aus ChatGPT prüfen');
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
  // Place the actionable error at the TOP, before the long read-only prompt.
  return notice+insert+html;
};
async function v215ImportText(raw){
  if(!v200Eval)throw Error('Keine Klassenarbeit geöffnet.');
  v200Eval.rawImport=raw;
  const a=v200Assessment(v200Eval.assessmentId);
  if(v215RubricSourceMismatch(raw,a)){
    v215ImportError='Die Rasterquelle konnte noch nicht eindeutig zugeordnet werden. '
      +'Bitte unten die tatsächlich verwendete Datei auswählen und bestätigen.';
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