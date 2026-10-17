/* Schulcockpit V0.21.6 – belastbarer Aufgabenplan, sichere Zwischenstände.
 * Bestehende Prüfungsanalysen und Schülerpunkte bleiben unangetastet.
 * Eingabestände werden lokal gespeichert, auch wenn fachlich noch unvollständig.
 */
const V216_VERSION='V0.21.6';
let v216Queue=Promise.resolve();
let v216PersistenceFailed=false;
function v216Serial(action){
  const op=v216Queue.then(action);
  v216Queue=op.catch(()=>{});
  return op;
}
function v216Exam(){return v200Assessment(v200Eval?.assessmentId);}
function v216Current(){return v216Exam()?.evaluationV200?.analysis;}
function v216Status(text,kind='success'){
  const status=document.getElementById('v216-save-state');
  if(status){
    status.textContent=text;
    status.dataset.status=kind;
    status.setAttribute('role',kind==='error'?'alert':'status');
  }
}
function v216SourceKey(kind){
  return kind==='classtime'?'scores':kind==='paper'?'paperScores':'bonusScores';
}
function v216ReadEditor(){
  const a=v216Exam(),an=v216Current();
  if(!a||!an||v200Eval?.step!==3)return null;
  const items={};
  for(const it of an.items){
    const field=(prefix)=>document.querySelector('['+prefix+'="'+it.id+'"]');
    items[it.id]={
      source:field('data-v210-kind')?.value??it.source,
      regularRaw:String(field('data-v210-regular')?.value??it.regularMax??''),
      bonusRaw:String(field('data-v210-bonus')?.value??it.bonusMax??''),
      competencyId:field('data-v210-criterion')?.value??it.competencyId
    };
  }
  const candidates={...(a.bonusCandidatesV216||{})};
  for(const input of document.querySelectorAll('[data-v216-found-max]')){
    const label=input.dataset.v216FoundMax;
    candidates[label]={
      maxRaw:String(input.value??''),
      competencyId:document.querySelector('[data-v216-found-criterion="'+label+'"]')?.value||''
    };
  }
  for(const select of document.querySelectorAll('[data-v216-found-criterion]')){
    const label=select.dataset.v216FoundCriterion;
    candidates[label]={...(candidates[label]||{maxRaw:''}),competencyId:select.value||''};
  }
  return {items,candidates};
}
function v216DraftToItems(an,draft,priv){
  const errors=[],kinds=new Set(['classtime','paper','classtime_bonus','paper_bonus']);
  const comps=new Set((an.competencies||[]).map(c=>c.id));
  const totals=new Map((an.competencies||[]).map(c=>[c.id,0]));
  const result=structuredClone(an.items);
  for(const it of result){
    const d=draft.items?.[it.id];
    if(!d){errors.push((it.label||it.id)+': Bearbeitungsfeld fehlt');continue;}
    const kind=d.source,reg=v210StrictScore(d.regularRaw),bonus=v210StrictScore(d.bonusRaw);
    if(!kinds.has(kind)||!comps.has(d.competencyId)){
      errors.push((it.label||it.id)+': Quelle oder Kompetenz fehlt');continue;
    }
    if(reg===null||bonus===null||reg<0||bonus<0){
      errors.push((it.label||it.id)+': Maximalpunkte noch unvollständig');continue;
    }
    if(kind.endsWith('_bonus')?(reg!==0||bonus<=0):(reg<=0||bonus!==0)){
      errors.push((it.label||it.id)+(kind.endsWith('_bonus')?
        ': Bonusaufgabe benötigt 0 reguläre und positive Bonus-Maximalpunkte':
        ': reguläre Aufgabe benötigt positive reguläre und 0 Bonus-Maximalpunkte'));
      continue;
    }
    const old=an.items.find(x=>x.id===it.id),data=priv?.[v216SourceKey(old.source)]||{};
    const hasSaved=Object.values(data).some(m=>m?.[it.id]!==null&&
      m?.[it.id]!==undefined&&m?.[it.id]!=='');
    if(kind!==old.source&&hasSaved){
      errors.push((it.label||it.id)+': Quelle wegen vorhandener Schülerpunkte nicht automatisch änderbar');
      continue;
    }
    if(kind===old.source){
      const limit=kind.endsWith('_bonus')?bonus:reg;
      const tooHigh=Object.values(data).some(m=>{
        const raw=m?.[it.id];if(raw===null||raw===undefined||raw==='')return false;
        const n=v210StrictScore(raw);
        return n===null||n<0||n>limit+1e-9;
      });
      if(tooHigh){
        errors.push((it.label||it.id)+': vorhandene Punkte übersteigen neue Maximalpunkte');
        continue;
      }
    }
    it.source=kind;it.regularMax=reg;it.bonusMax=bonus;it.competencyId=d.competencyId;
    if(!kind.endsWith('_bonus'))totals.set(it.competencyId,(totals.get(it.competencyId)||0)+reg);
  }
  if([...totals.values()].some(n=>n<=0))errors.push('Jede Rasterkompetenz benötigt mindestens eine regulär bewertete Teilaufgabe');
  return {items:result,errors};
}
function v216ApplyDraftToForm(a){
  const d=a?.itemDraftV216?.items||{};
  for(const [id,val] of Object.entries(d)){
    const pairs=[['data-v210-kind','source'],['data-v210-regular','regularRaw'],
      ['data-v210-bonus','bonusRaw'],['data-v210-criterion','competencyId']];
    for(const [attr,key] of pairs){
      const input=document.querySelector('['+attr+'="'+id+'"]');
      if(input&&val[key]!==undefined)input.value=String(val[key]);
    }
  }
  for(const [label,fields] of Object.entries(a?.bonusCandidatesV216||{})){
    const inp=document.querySelector('[data-v216-found-max="'+label+'"]');
    const sel=document.querySelector('[data-v216-found-criterion="'+label+'"]');
    if(inp)inp.value=fields.maxRaw??'';
    if(sel)sel.value=fields.competencyId||'';
  }
}
async function v216Capture({requireValid=false}={}){
  const a=v216Exam(),an=v216Current();
  const draft=v216ReadEditor();
  if(!a||!an||!draft)return {valid:true,changed:false};
  const lastDraft=structuredClone(a.itemDraftV216??null),lastCand=structuredClone(a.bonusCandidatesV216||{});
  const validated=v216DraftToItems(an,draft,v200Eval?.privateData);
  if(requireValid&&validated.errors.length){
    // Even an invalid intermediate stage is stored before reporting the error.
    a.itemDraftV216={schema:1,items:draft.items};
    a.bonusCandidatesV216=draft.candidates;
    try{await saveState();v216PersistenceFailed=false;}
    catch(e){a.itemDraftV216=lastDraft;a.bonusCandidatesV216=lastCand;v216PersistenceFailed=true;throw e;}
    v216Status('Zwischenstand gespeichert – '+validated.errors[0],'draft');
    return {valid:false,errors:validated.errors};
  }
  const oldItems=an.items,oldApproval=a.competencySelectionV204?.teacherReviewedV205;
  const changed=!validated.errors.length&&JSON.stringify(validated.items)!==JSON.stringify(an.items);
  a.itemDraftV216={schema:1,items:draft.items};
  a.bonusCandidatesV216=draft.candidates;
  if(!validated.errors.length){
    // A completed draft is cleared even when its values already match
    // the accepted metadata (e.g. after switching an unfinished type back).
    delete a.itemDraftV216;
  }
  if(changed){
    an.items=validated.items;
    if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=false;
  }
  try{
    await saveState();v216PersistenceFailed=false;
  }catch(e){
    an.items=oldItems;a.itemDraftV216=lastDraft;a.bonusCandidatesV216=lastCand;
    if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=oldApproval;
    v216PersistenceFailed=true;
    v216Status('Speichern fehlgeschlagen – bitte Seite nicht schließen!','error');
    throw e;
  }
  if(validated.errors.length){
    v216Status('Zwischenstand lokal gespeichert – '+validated.errors[0],'draft');
  }else{
    v216Status(changed?'✓ Aufgabenplan automatisch gespeichert':'✓ Alle Eingaben lokal gespeichert','success');
  }
  return {valid:!validated.errors.length,changed,errors:validated.errors};
}
async function v216AddItem(kind){
  const a=v216Exam(),an=v216Current();
  if(!a||!an?.competencies?.length)throw Error('Bitte zuerst das Kompetenzraster importieren.');
  const current=await v216Capture(); // Save all other rows before any render.
  if(v216PersistenceFailed)throw Error('Zwischenspeichern fehlgeschlagen. Keine Aufgabe hinzugefügt.');
  const name=prompt('Name der '+(kind.endsWith('_bonus')?'Bonus':'regulären')+'aufgabe:');
  if(!name?.trim())return;
  if(an.items.some(i=>v200Norm(i.label||i.id)===v200Norm(name)))
    throw Error('Diese Aufgabenbezeichnung existiert bereits. Bitte eindeutige Bezeichnungen benutzen.');
  const pointsRaw=prompt(kind.endsWith('_bonus')?'Maximale BONUS-Punkte (nicht regulär):':
    'Maximale REGULÄRE Punkte:', '1');
  if(pointsRaw===null)return;
  const points=v210StrictScore(pointsRaw);
  if(points===null||points<=0)throw Error('Bitte positive Maximalpunkte eingeben.');
  let id='Teil'+Date.now();while(an.items.some(i=>i.id===id))id+='x';
  const it={id,label:name.trim(),source:kind,
    regularMax:kind.endsWith('_bonus')?0:points,
    bonusMax:kind.endsWith('_bonus')?points:0,
    competencyId:an.competencies[0].id,
    classtimeAliases:kind.startsWith('classtime')?[name.trim()]:[]};
  const oldItems=an.items,previous=a.competencySelectionV204?.teacherReviewedV205;
  an.items=[...oldItems,it];
  if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=false;
  try{await saveState();v216PersistenceFailed=false;}
  catch(e){
    an.items=oldItems;if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=previous;
    v216PersistenceFailed=true;throw e;
  }
  render();
  v216Status('✓ '+it.label+' hinzugefügt und gespeichert; bestehende Eingaben erhalten','success');
}
function v216MissingBonus(priv,an){
  const ct=priv?.classtime;
  if(!ct?.parsed||!ct?.detection)return[];
  const mapped=new Set((an.items||[]).flatMap(it=>
    [it.label,it.id,...(it.classtimeAliases||[]),
      priv.classtime?.bonusMappingV213?.[it.id]]
    .filter(Boolean).map(v200Norm)));
  const cols=v200QuestionColumns(ct);
  return cols.filter(c=>c.max===0&&/^Q\d+$/i.test(c.label)&&!mapped.has(v200Norm(c.label)));
}
function v216MissingBonusPanel(priv,an){
  const list=v216MissingBonus(priv,an);
  if(!list.length)return '';
  const opts='<option value="">— passende Rasterkompetenz wählen —</option>'+
    (an.competencies||[]).map(c=>'<option value="'+esc(c.id)+'">'+esc(c.text)+'</option>').join('');
  return '<section class="detail-section v216-bonus-missing">'
    +'<h3>Classtime-Bonusfragen fehlen noch im Aufgabenplan</h3>'
    +'<p>Im lokalen Classtime-Export stehen die folgenden Aufgaben mit <strong>0/0</strong> '
    +'oder ohne reguläre Maximalpunkte. Das heißt nicht, dass sie falsch oder richtig sind. '
    +'Sie dürfen weder fehlen noch automatisch als richtig gelten. Wähle Kompetenz und '
    +'tatsächliche Bonus-Maximalpunkte, bevor sie aufgenommen werden.</p>'
    +list.map(c=>'<div class="v216-bonus-candidate"><strong>'+esc(c.label)+'</strong>'
      +'<label>Bonus max. <input data-v216-found-max="'+esc(c.label)+'" '
      +'inputmode="decimal" placeholder="z. B. 2"></label>'
      +'<label>Kompetenz<select data-v216-found-criterion="'+esc(c.label)+'">'+opts+'</select></label></div>').join('')
    +'<button class="primary" data-v216-bonus-import>Ausgefüllte Bonusfragen zum Aufgabenplan hinzufügen</button>'
    +'<p class="microcopy">Die Angaben werden lokal zwischengespeichert. Fragen ohne '
    +'ausgefüllte Bonuspunkte bleiben offen. Keine Antworten oder Schülerpunkte werden importiert.</p></section>';
}
async function v216ImportBonusCandidates(){
  const a=v216Exam(),an=v216Current(),priv=v200Eval?.privateData;
  if(!a||!an)return;
  const saved=await v216Capture();
  if(v216PersistenceFailed)throw Error('Vorherige Änderungen konnten nicht gespeichert werden.');
  const candidates=v216MissingBonus(priv,an),settings=a.bonusCandidatesV216||{};
  const additions=[];
  for(const col of candidates){
    const entry=settings[col.label];
    if(!entry?.maxRaw?.trim())continue;
    const n=v210StrictScore(entry.maxRaw);
    if(n===null||n<=0)throw Error('Bitte Bonus-Maximalpunkte für '+col.label+' prüfen.');
    if(!an.competencies.some(c=>c.id===entry.competencyId))
      throw Error('Bitte die Kompetenz für '+col.label+' auswählen.');
    let id='CTBonus'+col.label;while(an.items.some(x=>x.id===id)||additions.some(x=>x.id===id))id+='x';
    additions.push({id,label:col.label,source:'classtime_bonus',regularMax:0,bonusMax:n,
      competencyId:entry.competencyId,classtimeAliases:[col.label]});
  }
  if(!additions.length)throw Error('Bitte mindestens eine Bonusfrage mit Punkten und Kompetenz ausfüllen.');
  const originals=an.items,oldCandidates=structuredClone(a.bonusCandidatesV216||{}),
    approval=a.competencySelectionV204?.teacherReviewedV205;
  an.items=[...originals,...additions];
  a.bonusCandidatesV216={...oldCandidates};
  for(const add of additions)delete a.bonusCandidatesV216[add.label];
  if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=false;
  try{await saveState();v216PersistenceFailed=false;}
  catch(e){
    an.items=originals;a.bonusCandidatesV216=oldCandidates;
    if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=approval;
    v216PersistenceFailed=true;throw e;
  }
  render();v216Status('✓ '+additions.length+' fehlende Classtime-Bonusfragen gespeichert','success');
}
const v216Step3Before=v200Step3;
v200Step3=function(a,priv){
  let html=v216Step3Before(a,priv),an=a?.evaluationV200?.analysis;
  if(!an)return html;
  html=html.replace('Schriftliche Teilaufgabe hinzufügen','Reguläre Papieraufgabe hinzufügen');
  html=html.replace(
    'data-v210-add-paper>Reguläre Papieraufgabe hinzufügen</button>',
    'data-v210-add-paper>Reguläre Papieraufgabe hinzufügen</button>'+
    '<button class="secondary" data-v216-add-classtime>Reguläre Classtime-Frage hinzufügen</button>'
  );
  const status=a.itemDraftV216?'Zwischenstand lokal gesichert – bitte ggf. noch Punkte prüfen':
    'Alle bisher bestätigten Aufgaben bleiben lokal gespeichert';
  return '<section class="detail-section v216-progress"><strong>Dein Korrekturstand</strong>'
    +'<p id="v216-save-state" role="status" data-status="'+(a.itemDraftV216?'draft':'success')+'">'
    +esc(status)+'</p>'
    +'<p class="microcopy">Bei jeder Eingabe wird der Zwischenstand sofort lokal gespeichert. '
    +'Wenn die Angaben vollständig gültig sind, wird auch der Aufgabenplan automatisch aktualisiert. '
    +'Nicht abgeschlossene Einträge bleiben als Entwurf erhalten – auch nach einem Neuladen. '
    +'Das Originalraster und bereits eingetragene Schülerpunkte werden nicht gelöscht.</p></section>'
    +html+v216MissingBonusPanel(priv,an);
};

/* Include every question shown in the actual (empty) Classtime task PDF,
 * even if Classtime configured it with 0/0. Do not invent missing weights. */
const v216PromptBefore=v200AssessmentAnalysisPrompt;
v200AssessmentAnalysisPrompt=function(a,priv){
  let prompt=v216PromptBefore(a,priv);
  prompt+='\n\n## V0.21.6 – VOLLSTÄNDIGKEIT ALLER CLASSTIME-FRAGEN (VERBINDLICH)\n';
  prompt+='Prüfe die TATSÄCHLICH geschriebene Classtime-Aufgaben-PDF von der ersten bis zur LETZTEN Frage. '
    +'Lass KEINE Aufgaben aus, nur weil Classtime für sie 0 von 0 Punkten anzeigt. '
    +'Insbesondere am Ende stehende Sternchen-, Lückentext-, offene Text- und Bonusaufgaben '
    +'müssen als eigene items[] erscheinen: source="classtime_bonus", regularMax=0, '
    +'bonusMax nur nach ausdrücklichem Beleg aus Aufgabenblatt/Raster/Lehrkraft.\n';
  prompt+='Wenn die Bonus-Maximalpunkte oder die passende konkrete Rasterkompetenz fehlen, '
    +'erzeuge zuerst RÜCKFRAGEN und keinen fertigen Importblock. Keine 0/0-Frage als '
    +'automatisch richtig, nicht bearbeitet oder regulär bestanden interpretieren. '
    +'Am Ende eine Prüfzeile: Anzahl und Bezeichnungen ALLER Classtime-Fragen in der PDF, '
    +'davon regulär / Bonus; jede Frage muss in items[] enthalten oder als fachlich ungeklärt markiert sein.\n';
  const ct=priv?.classtime,bonusColumns=v200QuestionColumns(ct).filter(c=>c.max===0);
  if(bonusColumns.length)prompt+='Im lokal erkannten Export existieren diese 0/0-Fragen: '
    +bonusColumns.map(c=>c.label).join(', ')+'. Jede davon mit tatsächlichen Aufgaben abgleichen.\n';
  v200AssertNoStudentLeak(prompt,priv);
  return prompt;
};
const v216WireBefore=wire;
wire=function(){
  v216WireBefore();
  if(v200Eval?.step!==3||!v216Current())return;
  const a=v216Exam();
  v216ApplyDraftToForm(a);
  const editors=[...document.querySelectorAll(
    '[data-v210-kind],[data-v210-regular],[data-v210-bonus],[data-v210-criterion],'+
    '[data-v216-found-max],[data-v216-found-criterion]')];
  const capture=()=>{
    v216Status('Speichert …','draft');
    void v216Serial(()=>v216Capture()).catch(e=>
      v216Status('Speichern fehlgeschlagen: '+(e.message||e)+' – nicht schließen!','error'));
  };
  for(const el of editors){
    el.addEventListener('input',capture);
    // Select changes may not dispatch input consistently in older Safari.
    if(el.tagName==='SELECT')el.addEventListener('change',capture);
  }
  // Classtime bonus question mapping is private score-side metadata. Unlike
  // public task descriptors it belongs in the private IndexedDB record.
  for(const el of document.querySelectorAll('[data-v213-bonus-map]')){
    el.addEventListener('change',()=>{
      void v216Serial(async()=>{
        const priv=v200Eval?.privateData,ct=priv?.classtime;
        if(!ct)return;
        const before=structuredClone(ct.bonusMappingV213||{});
        ct.bonusMappingV213={...before,[el.dataset.v213BonusMap]:el.value};
        try{await v200PrivatePut(priv);v216PersistenceFailed=false;
          v216Status('✓ Classtime-Bonuszuordnung lokal gespeichert','success');
        }catch(e){
          ct.bonusMappingV213=before;v216PersistenceFailed=true;
          v216Status('Bonuszuordnung nicht gespeichert: '+(e.message||e),'error');
        }
      });
    });
  }
  const replaceButton=(selector,listener)=>{
    const old=document.querySelector(selector);
    if(!old)return;
    const b=old.cloneNode(true);old.replaceWith(b);
    b.addEventListener('click',()=>{
      b.disabled=true;
      void v216Serial(listener).catch(e=>{
        v216PersistenceFailed=true;
        v216Status('Nicht gespeichert: '+(e.message||e),'error');
      }).finally(()=>{b.disabled=false;});
    });
  };
  replaceButton('[data-v210-save-items]',()=>v216SaveClickedDirect());
  replaceButton('[data-v210-add-paper]',()=>v216AddItem('paper'));
  replaceButton('[data-v216-add-classtime]',()=>v216AddItem('classtime'));
  replaceButton('[data-v213-add-bonus="paper_bonus"]',()=>v216AddItem('paper_bonus'));
  replaceButton('[data-v213-add-bonus="classtime_bonus"]',()=>v216AddItem('classtime_bonus'));
  replaceButton('[data-v216-bonus-import]',()=>v216ImportBonusCandidates());
  // Preserve an incomplete but durable draft across navigation; block going
  // to the result steps if the task metadata is still contradictory.
  for(const b of document.querySelectorAll('[data-v200-step]')){
    const n=Number(b.dataset.v200Step);
    const old=b.onclick;
    b.onclick=e=>{
      if(n===3)return old?.call(b,e);
      b.disabled=true;
      void v216Serial(async()=>{
        const result=await v216Capture();
        if(!result.valid&&n>=4){
          v216Status('Zwischenstand gespeichert. Vor den Punkten erst Aufgabenplan vervollständigen: '+
            result.errors[0],'draft');
          return;
        }
        if(!v216PersistenceFailed)old?.call(b,e);
      }).catch(err=>v216Status('Navigation angehalten: '+(err.message||err),'error'))
        .finally(()=>{b.disabled=false;});
    };
  }
};
async function v216SaveClickedDirect(){
  const result=await v216Capture({requireValid:true});
  v216Status(result.valid?'✓ Aufgabenplan kontrolliert und gespeichert':
    'Zwischenstand gespeichert – '+result.errors[0],result.valid?'success':'draft');
}
const v216RenderBefore=render;
render=function(){
  v216RenderBefore();
  const el=document.querySelector('.brand small');
  if(el)el.textContent=state.settings.schoolYear+' · '+V216_VERSION;
};
if(typeof window!=='undefined')window.addEventListener('beforeunload',event=>{
  if(!v216PersistenceFailed)return;
  event.preventDefault();
  event.returnValue='Lokale Änderungen konnten nicht gespeichert werden.';
});
render();
