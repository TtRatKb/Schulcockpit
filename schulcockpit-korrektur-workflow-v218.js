/* Schulcockpit V0.21.8 — guided, resumable correction workspace.
 * Additive UX layer. Existing assessment analysis, private points, filenames,
 * grade thresholds and curriculum links remain untouched. */
const V218_VERSION='V0.21.8';
function v218Exam(){return v200Assessment(v200Eval?.assessmentId);}
function v218UX(a){return a.evaluationUXV218||(a.evaluationUXV218={});}
function v218Node(id){return document.getElementById(id);}
function v218Message(message,kind='note'){
  const box=v218Node('v218-message');
  if(box){box.textContent=message;box.dataset.kind=kind;box.setAttribute('role',kind==='error'?'alert':'status');}
}
function v218TaskReady(a){
  const an=a?.evaluationV200?.analysis;
  if(!an?.items?.length||a.itemDraftV216)return false;
  const total=new Map((an.competencies||[]).map(c=>[c.id,0]));
  for(const it of an.items){
    const bonus=it.source.endsWith('_bonus');
    const r=Number(it.regularMax),b=Number(it.bonusMax);
    if(!total.has(it.competencyId)||!Number.isFinite(r)||!Number.isFinite(b)||r<0||b<0||
      (bonus?(r!==0||b<=0):(r<=0||b!==0)))return false;
    if(!bonus)total.set(it.competencyId,total.get(it.competencyId)+r);
  }
  return [...total.values()].every(n=>n>0);
}
function v218Stage(a,priv){
  const plan=v218TaskReady(a),excel=!!priv?.classtime?.detection?.sourceV210;
  const mapping=!!priv?.classtime?.reviewedV210&&!priv?.classtime?.mapDraftV218;
  const bonus=!!priv?.classtime?.bonusReviewV218;
  return {plan,excel,mapping,bonus};
}
function v218Fold(a,id,done,heading,content,description=''){
  const custom=a?.evaluationUXV218?.expanded||{};
  const open=Object.prototype.hasOwnProperty.call(custom,id)?custom[id]:!done;
  return '<details class="v218-stage '+(done?'v218-done':'v218-pending')+'" data-v218-stage="'+id+'" '
    +(open?'open':'')+'><summary><span class="v218-stage-name"><span class="v218-mark">'
    +(done?'✓':'○')+'</span><strong>'+heading+'</strong></span><span class="v218-stage-status">'
    +(done?'Erledigt · ansehen / ändern':id==='bonus'?'Optional · später möglich':'Noch zu bearbeiten')+'</span></summary>'
    +'<div class="v218-stage-content">'+(description?'<p class="microcopy">'+description+'</p>':'')+content+'</div></details>';
}
function v218TaskBlock(a,an){
  const rows=an.items.map(it=>{
    const sources=[['classtime','Classtime regulär'],['paper','Papier regulär'],
      ['classtime_bonus','Classtime Bonus'],['paper_bonus','Papier Bonus']];
    const sel=arr=>arr.map(([value,label])=>'<option value="'+esc(value)+'" '
      +(it.source===value?'selected':'')+'>'+esc(label)+'</option>').join('');
    const cs=(an.competencies||[]).map(c=>'<option value="'+esc(c.id)+'" '
      +(it.competencyId===c.id?'selected':'')+'>'+esc(c.text)+'</option>').join('');
    return '<tr><td>'+esc(it.label||it.id)+'</td><td><select data-v210-kind="'+esc(it.id)+'">'+sel(sources)+'</select></td>'
      +'<td><input inputmode="decimal" data-v210-regular="'+esc(it.id)+'" value="'+esc(it.regularMax??0)+'" aria-label="Reguläre Maximalpunkte"></td>'
      +'<td><input inputmode="decimal" data-v210-bonus="'+esc(it.id)+'" value="'+esc(it.bonusMax??0)+'" aria-label="Bonus-Maximalpunkte"></td>'
      +'<td><select data-v210-criterion="'+esc(it.id)+'">'+cs+'</select></td></tr>';
  }).join('');
  return '<p>Hier kontrollierst du einmal, welche Aufgaben zur Arbeit gehören, wie viele Punkte sie geben '
    +'und welche Kompetenz sie prüfen. <strong>Bonus wird nicht zur regulären Höchstpunktzahl addiert.</strong></p>'
    +'<div class="v210-scroll"><table class="v210-grid"><thead><tr><th>Aufgabe</th><th>Bearbeitet in</th>'
    +'<th>Regulär max.</th><th>Bonus max.</th><th>Kompetenz</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div class="v200-actions"><button class="secondary" data-v210-add-paper>+ Papieraufgabe</button>'
    +'<button class="secondary" data-v216-add-classtime>+ Classtime-Aufgabe</button>'
    +'<button class="secondary" data-v213-add-bonus="paper_bonus">+ Papierbonus</button>'
    +'<button class="secondary" data-v213-add-bonus="classtime_bonus">+ Classtime-Bonus</button>'
    +'<button class="primary" data-v218-save-plan>Aufgabenplan prüfen und abschließen ✓</button></div>'
    +'<p id="v216-save-state" role="status" data-status="'+(a.itemDraftV216?'draft':'success')+'">'
    +esc(a.itemDraftV216?'Zwischenstand gespeichert – einzelne Angaben noch prüfen':'Alle bisherigen Eingaben lokal gespeichert')+'</p>';
}
function v218ExcelBlock(priv){
  const ct=priv?.classtime;
  return '<p>Hier liest Schulcockpit die Excel <strong>nur auf diesem Gerät</strong>. '
    +'Sie enthält die Ergebnisse, nicht die Klassenarbeitsvorlage.</p>'
    +(ct?'<p><strong>✓ '+esc(ct.parsed?.fileName||'Excel')+'</strong> – '
      +esc((priv.roster||[]).length)+' Lernende erkannt. Du kannst bei Bedarf eine neuere Datei einlesen.</p>':
      '<p>Excel noch nicht eingelesen. Für reine Papierarbeiten kannst du diesen Abschnitt überspringen.</p>')
    +'<label class="upload-button">Classtime-Excel auswählen<input id="v210-excel-file" type="file" accept=".xlsx" hidden></label>';
}
function v218MapBlock(priv,an){
  const ct=priv?.classtime;
  if(!ct)return '<p>Hier erscheint nach dem Excelimport die Zuordnung der Classtime-Fragen.</p>';
  v200AutoMapItems(priv,an);
  const columns=v200QuestionColumns(ct),items=an.items.filter(i=>i.source==='classtime');
  const previous=ct.mapping||{},mapping=new Map(columns.map(c=>[String(c.index),c]));
  const rows=items.map(it=>{
    const stored=Object.prototype.hasOwnProperty.call(ct.mapDraftV218?.mapping||{},it.id)?ct.mapDraftV218.mapping[it.id]:previous[it.id];
    const possibles=v217Candidates(ct,it);
    const ambiguous=possibles.length!==1;
    const choices='<option value="">— bitte auswählen —</option>'+
      columns.filter(c=>c.max>0).map(c=>'<option value="'+c.index+'" '
        +(String(c.index)===String(stored)?'selected':'')+'>'+esc(c.label+' · '+(c.description||'')+' · max. '+c.max)+'</option>').join('');
    const chosen=mapping.get(String(stored));
    const hint=chosen?(ambiguous?'Manuell zugeordnet – Punktmaximum prüfen':'Automatisch gefunden – kontrollierbar'):
      'Noch nicht zugeordnet';
    return '<tr><td><strong>'+esc(it.label||it.id)+'</strong><small>'+esc(it.regularMax)+' reguläre Punkte</small></td>'
      +'<td><select data-v200-map-item="'+esc(it.id)+'" aria-label="Classtime-Frage für '+esc(it.label||it.id)+'">'
      +choices+'</select><small>'+esc(hint)+'</small></td></tr>';
  }).join('');
  const rules=columns.filter(c=>c.max>0).map(c=>{
    const rule=ct.mapDraftV218?.rules?.[c.label]||v210QuestionRule(ct,c.label);
    const options=[['original','Originalpunkte beibehalten'],['binary','Nur 0 oder volle Punktzahl'],['quarter','Auf Viertelpunkte runden']];
    return '<tr><td>'+esc(c.label)+' · '+esc(c.description||'')+'</td><td>'+esc(c.max)+'</td>'
      +'<td><select data-v210-rule="'+esc(c.label)+'">'+options.map(([v,t])=>
      '<option value="'+v+'" '+(rule===v?'selected':'')+'>'+t+'</option>').join('')+'</select></td></tr>';
  }).join('');
  const audit=v210ScoreAudit(priv,an),mapped=items.filter(it=>{
    const v=Object.prototype.hasOwnProperty.call(ct.mapDraftV218?.mapping||{},it.id)?ct.mapDraftV218.mapping[it.id]:previous[it.id];return v!==undefined&&v!==null&&v!==''&&mapping.has(String(v));
  }).length;
  let next='';
  if(!audit.ready)next='<p class="v218-note">Noch nicht alle Zuordnungen sind freigegeben: '
    +esc((audit.problems||[]).slice(0,3).join('; '))+'</p>';
  else next='<p>'+audit.count+' digitale Punktwerte können nach Bestätigung geprüft und übernommen werden. '
    +'Unbewertete Antworten bleiben offen und werden nicht still zu 0.</p>';
  return '<p>Ordne die digitale Teilaufgabe direkt hier der richtigen <strong>Q-Frage</strong> zu. '
    +'Stimmen Name und Maximalpunkte nicht, kannst du die Auswahl ändern.</p>'
    +'<p><strong>'+mapped+' von '+items.length+'</strong> regulären Classtime-Aufgaben zugeordnet.</p>'
    +'<div class="v210-scroll"><table class="v210-grid"><thead><tr><th>Deine Aufgabe</th><th>Excel-Frage auswählen</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<details class="v218-subdetails"><summary>Bewertungsregeln kontrollieren (z. B. Q3/Q4)</summary>'
    +'<p>Diese Regeln verändern nur die Punkteberechnung, nicht die gespeicherte Original-Excel.</p>'
    +'<div class="v210-scroll"><table class="v210-grid"><thead><tr><th>Excel-Frage</th><th>Max.</th><th>Regel</th>'
    +'</tr></thead><tbody>'+rules+'</tbody></table></div></details>'
    +next+'<button class="primary" data-v218-apply-scores>Digitale Zuordnung prüfen und Punkte übernehmen ✓</button>';
}
function v218BonusBlock(priv,an){
  const ct=priv?.classtime,bonus=an.items.filter(i=>i.source==='classtime_bonus');
  if(!ct)return '<p>Nach dem Excelimport kannst du hier leere Classtime-Bonusantworten prüfen. '
    +'Papier-Bonusaufgaben werden oben einmalig im Aufgabenplan ergänzt.</p>';
  const cols=v200QuestionColumns(ct).filter(c=>c.max===0);
  if(!cols.length)return '<p>Keine 0/0-Bonusfragen in dieser Excel erkannt. '
    +'Vorhandene Papier-Bonusaufgaben bleiben im Aufgabenplan.</p>';
  const rows=bonus.map(it=>{
    const chosen=ct.bonusMappingV213?.[it.id]||v213BonusSuggestion(ct,it)||
      (v217Candidates(ct,it).length===1?v217Candidates(ct,it)[0].label:'');
    return '<div class="v218-bonus-row"><label><strong>'+esc(it.label||it.id)+'</strong>'
      +'<select data-v213-bonus-map="'+esc(it.id)+'" aria-label="Bonusfrage zuordnen">'
      +'<option value="">— auswählen —</option>'
      +cols.map(c=>'<option value="'+esc(c.label)+'" '+(chosen===c.label?'selected':'')+'>'
      +esc(c.label+' · '+(c.description||''))+'</option>').join('')+'</select></label>'
      +'<small>'+esc(it.bonusMax)+' mögliche Bonuspunkte</small></div>';
  }).join('');
  return '<p>Das hier betrifft <strong>nur Classtime-Bonusfragen mit 0/0</strong>. '
    +'Sind sie tatsächlich unbeantwortet, kannst du die sicheren Fälle als 0 markieren. '
    +'Bei abgegebenen Antworten vergibst du die Bonuspunkte später selbst. '
    +'Papierbonus musst du hier <strong>nicht</strong> nochmals anlegen.</p>'
    +(bonus.length?rows:'<p>Die Bonusfragen sind noch nicht im Aufgabenplan. '
      +'Lege sie dort einmalig als „Classtime-Bonus“ an.</p>')
    +'<button class="secondary" data-v218-bonus-zeros>Nur sicher leere Bonusantworten als 0 übernehmen</button>'
    +'<p class="microcopy">Falls die Einzelantworten in diesem Excel-Export nicht eindeutig zuordenbar sind, '
    +'erhält niemand automatisch 0 Punkte. Das blockiert den weiteren Korrekturablauf nicht.</p>'
    +'<p id="v218-bonus-result" role="status"></p>';
}
function v218CompetenceBlock(an,priv){
  const grouped=new Map((an.competencies||[]).map(c=>[c.id,{text:c.text,regular:0,bonus:0}]));
  for(const it of an.items) {
    const p=grouped.get(it.competencyId);if(!p)continue;
    if(it.source.endsWith('_bonus'))p.bonus+=Number(it.bonusMax)||0;
    else p.regular+=Number(it.regularMax)||0;
  }
  return '<p><strong>Nur für dich:</strong> Übersicht, welche Rasterzeile wie viele reguläre '
    +'und mögliche Bonuspunkte umfasst. Die offizielle Curriculum-Verknüpfung erscheint '
    +'nicht zusätzlich auf dem Schülerbogen.</p>'
    +'<div class="v210-scroll"><table class="v210-grid"><thead><tr><th>Prüfkompetenz</th>'
    +'<th>Regulär max.</th><th>Bonus möglich</th></tr></thead><tbody>'
    +[...grouped.values()].map(x=>'<tr><td>'+esc(x.text)+'</td><td>'+x.regular+'</td>'
      +'<td>'+x.bonus+'</td></tr>').join('')+'</tbody></table></div>';
}
function v218ScoreReady(priv,an){return !!priv?.roster?.length&&!!an?.items?.length;}
const v218Step3Previous=v200Step3;
v200Step3=function(a,priv){
  const an=a?.evaluationV200?.analysis;
  if(!an)return '<section class="detail-section">Zuerst die Aufgabenanalyse importieren.</section>';
  const done=v218Stage(a,priv);
  const canProceed=v218ScoreReady(priv,an);
  let html='<div class="v218-flow"><div class="v218-flow-intro"><h3>Fragen und Excel – Schritt für Schritt</h3>'
    +'<p>Jeden Abschnitt einmal bearbeiten. Danach wird er grün und klappt ein. '
    +'Mit einem Klick kannst du ihn jederzeit wieder öffnen.</p>'
    +'<p id="v218-message" role="status" data-kind="note">Deine bisherigen Daten bleiben erhalten.</p></div>';
  html+=v218Fold(a,'plan',done.plan,'1 · Aufgabenplan und Kompetenzen',
    v218TaskBlock(a,an));
  html+=v218Fold(a,'excel',done.excel,'2 · Classtime-Ergebnisse lokal einlesen',
    v218ExcelBlock(priv));
  html+=v218Fold(a,'mapping',done.mapping,'3 · Aufgaben zuordnen und digitale Punkte übernehmen',
    v218MapBlock(priv,an));
  html+=v218Fold(a,'bonus',done.bonus,'4 · Leere Classtime-Bonusantworten prüfen (optional)',
    v218BonusBlock(priv,an)+(priv?.classtime?v216MissingBonusPanel(priv,an):''));
  const roster=priv?.roster||[];
  const extras='<p>'+roster.length+' Lernende aus dem lokalen Classtime-Export erkannt. '
    +'Die Schreibweise der Namen kannst du später im lokalen Teilnehmerbereich prüfen.</p>'
    +v218CompetenceBlock(an,priv);
  html+='<details class="v218-stage v218-optional"><summary><strong>Optional: Prüfkompetenzen, '
    +'Punktesummen und Teilnehmerzahl ansehen</strong></summary>'
    +'<div class="v218-stage-content">'+extras+'</div></details>';
  const reviewed=priv?.classtime?.reviewedV210;
  html+='<div class="v200-actions v218-bottom"><button class="secondary" data-v200-step="2">← Analyse</button>'
    +'<button class="primary" data-v200-step="4" '+(!canProceed?'disabled':'')+'>'
    +'Weiter zur Punkteingabe →</button></div>';
  html+='</div>';
  return html;
};

/* Reopening an assessment starts at the last persisted step; on legacy
 * records with a completed analysis, start from the live questions page. */
let v218Opening=false;
const v218OpenPrevious=v200OpenEval;
v200OpenEval=async function(id){
  v218Opening=true;
  try{await v218OpenPrevious(id);}
  finally{v218Opening=false;}
  const a=v200Assessment(id);
  if(!v200Eval||v200Eval.assessmentId!==id||!a)return;
  const remembered=a.evaluationUXV218?.lastStep;
  const inferred=a.evaluationV200?.analysis?3:(a.files?.length?2:1);
  v200Eval.step=Number.isInteger(remembered)&&remembered>=1&&remembered<=5?remembered:inferred;
  render();
};
const v218RenderPrevious=render;
render=function(){
  if(!v218Opening&&view==='evaluation'&&v200Eval?.assessmentId){
    const a=v218Exam();
    if(a&&a.evaluationUXV218?.lastStep!==v200Eval.step){
      const ux=v218UX(a),old=ux.lastStep;
      ux.lastStep=v200Eval.step;
      try{saveState();}catch(e){ux.lastStep=old;console.warn('Korrekturposition nicht gespeichert',e);}
    }
  }
  v218RenderPrevious();
  const el=document.querySelector('.brand small');
  if(el)el.textContent=state.settings.schoolYear+' · '+V218_VERSION;
};

/* Answer sheets must have a unique, verifiable S1..Sn reference for every
 * roster member before bulk-zero is permitted. A partial answer sheet
 * cannot prove missing answers are zero and must NOT block continuation. */
function v218SafeDetail(ct,stu,label){
  const rows=ct?.detection?.studentRows||[],index=rows.findIndex(x=>
    x.rowIndex===stu.rowIndex&&v200Norm(x.name)===v200Norm(stu.name));
  if(index<0)return null;
  const sheet=ct.parsed?.sheets?.find(s=>String(s.name).toUpperCase()===String(label).toUpperCase());
  if(!sheet)return null;
  const header=sheet.rows.findIndex(x=>/name des lernenden/i.test(String(x?.[0]||'')));
  if(header<0)return null;
  const entries=sheet.rows.slice(header+1).filter(r=>/^S\d+$/i.test(String(r?.[0]??'').trim()));
  const expected=new Set(rows.map((_,i)=>'S'+(i+1)));
  const codes=entries.map(x=>String(x[0]).trim().toUpperCase());
  if(entries.length!==rows.length||new Set(codes).size!==rows.length||
    codes.some(c=>!expected.has(c)))return null;
  const target=entries.find(x=>String(x[0]).trim().toUpperCase()==='S'+(index+1));
  if(!target)return null;
  return {answered:target.slice(2).some(v=>v!==null&&v!==undefined&&String(v).trim()!==''),question:label};
}
const v218BonusRowsPrevious=v213BonusRows;
v213BonusRows=function(priv,an,mapping){
  const ct=priv?.classtime;
  if(!ct?.detection?.sourceV210)return {rows:[],errors:['Classtime-Datei fehlt'],warnings:[]};
  const used=new Set(),rows=[],warnings=[],errors=[];
  const all=new Set(v200QuestionColumns(ct).filter(c=>c.max===0).map(c=>c.label));
  for(const it of (an?.items||[]).filter(x=>x.source==='classtime_bonus')){
    const label=mapping?.[it.id]||'';
    if(!label){warnings.push((it.label||it.id)+': Bonusfrage noch nicht zugeordnet');continue;}
    if(used.has(label)){errors.push(label+' wurde mehrfach ausgewählt');continue;}
    used.add(label);
    if(!all.has(label)){errors.push(label+' ist keine Classtime-Bonusfrage');continue;}
    if(!(Number(it.bonusMax)>0)){errors.push((it.label||it.id)+': Bonus-Maximalpunkte fehlen');continue;}
    for(const stu of priv.roster||[]){
      const result=v218SafeDetail(ct,stu,label);
      if(result)rows.push({studentId:stu.id,itemId:it.id,label,answered:result.answered});
      else{warnings.push(label+': Antworten nicht eindeutig zuordenbar – keine automatische Nullwertung');break;}
    }
  }
  return {rows,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
};

async function v218CommitBonus(){
  const priv=v200Eval?.privateData,an=v200EvalAnalysis(),a=v218Exam();
  if(!priv?.classtime||!an)throw Error('Classtime-Datei fehlt.');
  const mapping={...(priv.classtime.bonusMappingV213||{})};
  for(const sel of document.querySelectorAll('[data-v213-bonus-map]'))
    mapping[sel.dataset.v213BonusMap]=sel.value;
  const result=v213BonusRows(priv,an,mapping);
  if(result.errors.length)throw Error(result.errors.join('; '));
  const missing=result.rows.filter(x=>!x.answered &&
    (priv.bonusScores?.[x.studentId]?.[x.itemId]===undefined||
      priv.bonusScores?.[x.studentId]?.[x.itemId]===null));
  const answered=result.rows.filter(x=>x.answered &&
    priv.bonusScores?.[x.studentId]?.[x.itemId]===undefined).length;
  const before={scores:structuredClone(priv.bonusScores||{}),
    origins:structuredClone(priv.bonusOriginsV213||{}),
    mapping:structuredClone(priv.classtime.bonusMappingV213||{}),
    reviewed:priv.classtime.bonusReviewV218};
  if(missing.length&&!confirm(missing.length+' sicher leere Bonusantworten mit 0 Punkten erfassen? '
    +answered+' beantwortete Fragen bleiben zur manuellen Korrektur offen.'))return;
  priv.classtime.bonusMappingV213=mapping;
  priv.bonusScores=structuredClone(before.scores);
  priv.bonusOriginsV213=structuredClone(before.origins);
  for(const x of missing){
    priv.bonusScores[x.studentId]=priv.bonusScores[x.studentId]||{};
    priv.bonusScores[x.studentId][x.itemId]=0;
    priv.bonusOriginsV213[x.studentId]=priv.bonusOriginsV213[x.studentId]||{};
    priv.bonusOriginsV213[x.studentId][x.itemId]='unanswered-q-sheet';
  }
  // Do not claim completion while the Q sheet cannot be linked safely.
  priv.classtime.bonusReviewV218=result.warnings.length?null:{
    at:new Date().toISOString(),safeZeros:missing.length};
  try{await v200PrivatePut(priv);}
  catch(e){
    priv.bonusScores=before.scores;priv.bonusOriginsV213=before.origins;
    priv.classtime.bonusMappingV213=before.mapping;
    priv.classtime.bonusReviewV218=before.reviewed;throw e;
  }
  return {zeros:missing.length,answered,warnings:result.warnings};
}

const v218WirePrevious=wire;
wire=function(){
  v218WirePrevious();
  if(view!=='evaluation'||v200Eval?.step!==3)return;
  const a=v218Exam();if(!a)return;
  document.querySelectorAll('[data-v218-stage]').forEach(node=>
    node.addEventListener('toggle',()=>{
      const ux=v218UX(a),prev=structuredClone(ux.expanded||{});
      ux.expanded={...prev,[node.dataset.v218Stage]:node.open};
      try{saveState();}catch(e){ux.expanded=prev;console.warn('Abschnitt nicht gespeichert',e);}
    }));
  document.querySelector('[data-v218-save-plan]')?.addEventListener('click',()=>{
    void v216Serial(async()=>{
      const result=await v216Capture({requireValid:true});
      if(!result.valid){v218Message('Zwischenstand gespeichert. Noch zu prüfen: '+
        result.errors[0],'note');return;}
      const ux=v218UX(a),previous=structuredClone(ux);
      ux.expanded={...(ux.expanded||{}),plan:false,excel:true};
      try{saveState();}catch(e){a.evaluationUXV218=previous;throw e;}
      render();v218Message('✓ Aufgabenplan gespeichert. Weiter mit dem Excelimport.','success');
    }).catch(e=>v218Message('Aufgabenplan nicht gespeichert: '+(e.message||e),'error'));
  });
  // Choice changes are private drafts until an explicit confirmation.
  // Do not overwrite previously imported student scores or approved mapping.
  for(const select of document.querySelectorAll('[data-v200-map-item],[data-v210-rule]')){
    select.addEventListener('change',()=>{
      void v216Serial(async()=>{
        const priv=v200Eval?.privateData,ct=priv?.classtime;
        if(!ct)return;
        const before=structuredClone(ct.mapDraftV218||null);
        const mapping={},rules={};
        for(const x of document.querySelectorAll('[data-v200-map-item]'))
          mapping[x.dataset.v200MapItem]=x.value===''?'':Number(x.value);
        for(const x of document.querySelectorAll('[data-v210-rule]'))
          rules[x.dataset.v210Rule]=x.value;
        ct.mapDraftV218={mapping,rules};
        try{await v200PrivatePut(priv);v218Message(
          'Änderung zwischengespeichert. Bitte die digitale Punkteübernahme erneut bestätigen.','note');}
        catch(e){ct.mapDraftV218=before;v218Message('Zuordnung nicht gespeichert: '+(e.message||e),'error');}
      });
    });
  }
  document.querySelector('[data-v218-apply-scores]')?.addEventListener('click',e=>{
    const btn=e.currentTarget;btn.disabled=true;
    void v216Serial(async()=>{
      const plan=await v216Capture({requireValid:true});
      if(!plan.valid){v218Message('Erst die offenen Angaben im Aufgabenplan abschließen: '+plan.errors[0],'note');return;}
      const p=v200Eval?.privateData;
      const oldAudit=p?.classtime?.scoreAuditV210;
      await v200SaveMappingAndScores();
      const done=!!p?.classtime?.reviewedV210&&p.classtime.scoreAuditV210!==oldAudit;
      if(!done){v218Message('Nicht übernommen. Du kannst die Auswahl ändern und erneut bestätigen.','note');return;}
      // First import succeeded; clear only the local mapping draft, never the scores.
      if(p.classtime.mapDraftV218){
        const pending=p.classtime.mapDraftV218;
        delete p.classtime.mapDraftV218;
        try{await v200PrivatePut(p);}
        catch(e){p.classtime.mapDraftV218=pending;throw e;}
      }
      if(done){
        const ux=v218UX(a);ux.expanded={...(ux.expanded||{}),mapping:false,bonus:true};
        saveState();render();
      }
      v218Message('✓ Digitale Punkte lokal übernommen. Weiter mit den Bonusfragen oder der Punkteingabe.','success');
    }).catch(e=>v218Message('Noch nicht übernommen: '+(e.message||e),'error'))
      .finally(()=>{btn.disabled=false;});
  });
  document.querySelector('[data-v218-bonus-zeros]')?.addEventListener('click',e=>{
    const btn=e.currentTarget;btn.disabled=true;
    void v216Serial(async()=>{
      await v216Capture();
      const result=await v218CommitBonus();
      if(!result)return;
      if(result.warnings.length){
        v218Message(result.zeros+' eindeutig leere Bonusantworten mit 0 gespeichert. '
          +'Weitere Fälle bleiben offen: '+result.warnings.join('; ')+
          '. Diese Punkte kannst du später manuell eintragen.','note');
        return;
      }
      const ux=v218UX(a);ux.expanded={...(ux.expanded||{}),bonus:false};
      saveState();render();
      v218Message('✓ '+result.zeros+' sicher leere Bonusantworten erfasst. '
        +result.answered+' Antworten noch manuell korrigieren.','success');
    }).catch(err=>v218Message('Bonusprüfung nicht übernommen: '+(err.message||err),'error'))
      .finally(()=>{btn.disabled=false;});
  });

};
render();