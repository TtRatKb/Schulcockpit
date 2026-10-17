/* Schulcockpit V0.21.1 – gezielte Sicherheitskorrekturen im Korrekturarbeitsplatz.
 * Keine persönlichen Prüfungsdaten in GitHub, keine automatischen Nullwertungen. */
const V211_VERSION='V0.21.1';
const v211AuditOriginal=v210ScoreAudit;
v210ScoreAudit=function(priv,an,mapping=null,rules=null){
  const a=v211AuditOriginal(priv,an,mapping,rules);
  const rowErrors=new Set((a.rows||[]).filter(r=>r.problem).map(r=>r.studentId+' · '+r.question+': '+r.problem));
  a.problems=(a.problems||[]).filter(p=>!rowErrors.has(p));
  a.unresolved=(a.rows||[]).filter(r=>{
    if(!r.problem)return false;
    const item=an?.items?.find(it=>it.id===r.itemId)||{id:r.itemId,source:'classtime'};
    const current=v200GetScore(priv,r.studentId,item);
    return !Number.isFinite(v210StrictScore(current));
  });
  a.ready=a.problems.length===0; // Valid cells can be staged; invalid cells stay empty.
  return a;
};
const v211RuleOriginal=v210QuestionRule;
v210QuestionRule=function(ct,q){
  const rule=ct?.rulesV210?.[q];
  if(['original','binary','quarter'].includes(rule))return rule;
  if(/^Q[34]$/.test(q)&&/grundrechenarten/i.test(String(ct?.parsed?.fileName||''))&&
    v200QuestionColumns(ct).find(c=>c.label===q)?.max===1)return 'binary';
  return v211RuleOriginal(ct,q);
};
const v211ExcelOriginal=v210ExcelState;
v210ExcelState=function(priv,an){
  const r=v211ExcelOriginal(priv,an),missing=r.audit?.unresolved||[];
  if(!missing.length)return r;
  const no=new Map((priv.roster||[]).map((s,i)=>[s.id,'S'+(i+1)]));
  r.preview+='<section class="detail-section v211-unresolved"><h3>'+missing.length+' ungeklärte Excelwerte</h3>'
    +'<p class="warn">Diese Felder werden <strong>nicht automatisch zu 0 Punkten</strong>. '
    +'Gültige Werte können übernommen werden. Ungeklärte Felder bleiben im Punkteraster offen und sperren '
    +'den jeweiligen fertigen Kompetenzbogen.</p><details><summary>Betroffene Felder</summary><ul>'
    +missing.slice(0,30).map(x=>'<li>'+esc(no.get(x.studentId)||'S?')+' · '+esc(x.question)
      +' · '+esc(x.problem)+' (Excel: '+esc(x.original)+')</li>').join('')
    +'</ul>'+(missing.length>30?'<p>Weitere '+(missing.length-30)+' Einträge offen.</p>':'')
    +'</details></section>';
  return r;
};
v200ApplyClasstimeScores=function(priv,an){
  const audit=v210ScoreAudit(priv,an);
  if(!audit.ready)throw Error('Erst Spalten/Maximalpunkte klären: '+audit.problems.slice(0,5).join('; '));
  const scores=structuredClone(priv.scores||{}),origins=structuredClone(priv.scoreSourcesV211||{});
  for(const r of audit.rows){
    scores[r.studentId]=scores[r.studentId]||{};
    origins[r.studentId]=origins[r.studentId]||{};
    const previous=scores[r.studentId][r.itemId],origin=origins[r.studentId][r.itemId];
    if(origin==='manual')continue;
    if(r.score===null){
      if(previous!==undefined&&previous!==null&&origin!=='excel')continue;
      delete scores[r.studentId][r.itemId];origins[r.studentId][r.itemId]='unresolved';
    }else if(previous!==undefined&&previous!==null&&!origin&&Number(previous)!==r.score){
      origins[r.studentId][r.itemId]='manual'; // protect prior edits without provenance
    }else{
      scores[r.studentId][r.itemId]=r.score;
      origins[r.studentId][r.itemId]=r.unanswered?'unanswered':'excel';
    }
  }
  priv.scores=scores;priv.scoreSourcesV211=origins;
  priv.classtime.reviewedV210=true;
  priv.classtime.scoreAuditV210={timestamp:new Date().toISOString(),changed:audit.rows.filter(r=>r.changed).length,
    decimalWarnings:audit.unusual.length,missing:audit.blank,unresolved:audit.unresolved.length,imported:audit.count};
};
const v211ImportOriginal=v200ImportClasstimeFile;
v200ImportClasstimeFile=async function(file){
  const known=v200Eval?.privateData?.roster||[];
  if(known.length){
    const parsed=await v200ParseXlsx(file),d=v200DetectClasstime(parsed);
    if(!d?.verifiedV210||known.length!==d.studentRows.length)
      throw Error('Teilnehmerzahl/Zuordnung weicht ab. Vor Neuimport manuell abgleichen.');
  }
  return v211ImportOriginal(file);
};
const v211MapOriginal=v200SaveMappingAndScores;
v200SaveMappingAndScores=async function(){
  const priv=v200Eval?.privateData,an=v200EvalAnalysis();
  if(priv?.classtime&&an){
    const map={...(priv.classtime.mapping||{})},rules={...(priv.classtime.rulesV210||{})};
    for(const e of document.querySelectorAll('[data-v200-map-item]'))
      map[e.dataset.v200MapItem]=e.value===''?'':Number(e.value);
    for(const e of document.querySelectorAll('[data-v210-rule]'))rules[e.dataset.v210Rule]=e.value;
    const a=v210ScoreAudit(priv,an,map,rules);
    if(a.ready&&a.unresolved.length&&!confirm(a.unresolved.length+
      ' digitale Felder bleiben ungeklärt und LEER. Übrige gültige Werte jetzt übernehmen?'))return;
  }
  return v211MapOriginal();
};
const v211ReportOriginal=v200StudentReport;
v200StudentReport=function(priv,an,stu){
  const report=v211ReportOriginal(priv,an,stu);
  if(report.participationV210!=='present')return report;
  const issues=[];
  for(const item of an?.items||[]){
    const mx=item.source.endsWith('_bonus')?Number(item.bonusMax):Number(item.regularMax);
    const raw=v200GetScore(priv,stu.id,item);
    if(!Number.isFinite(mx)||mx<=0)issues.push((item.label||item.id)+': Maximalpunkte offen');
    else if(raw!==null&&raw!==undefined&&raw!==''){
      const n=v210StrictScore(raw);
      if(n===null||n<0||n>mx+1e-9)issues.push((item.label||item.id)+': Punkte ungültig');
    }
  }
  if(issues.length){report.missing=[...new Set([...(report.missing||[]),...issues])];report.complete=false;}
  return report;
};
const v211ItemsOriginal=v210SaveItems;
v210SaveItems=async function(){
  const an=v200EvalAnalysis(),priv=v200Eval?.privateData;
  if(!an)throw Error('Aufgabenplan fehlt.');
  const totals=new Map((an.competencies||[]).map(c=>[c.id,0]));
  for(const it of an.items){
    const get=s=>document.querySelector('['+s+'="'+it.id+'"]')?.value;
    const source=get('data-v210-kind')||it.source,comp=get('data-v210-criterion')||it.competencyId;
    const reg=v210StrictScore(get('data-v210-regular')),bonus=v210StrictScore(get('data-v210-bonus'));
    if(reg===null||bonus===null)throw Error('Maximalpunkte fehlen bei '+(it.label||it.id));
    if(!source.endsWith('_bonus')){
      if(bonus!==0)throw Error('Bonus für '+(it.label||it.id)+' als eigene Aufgabe eintragen.');
      totals.set(comp,(totals.get(comp)||0)+reg);
    }
    if(source===it.source){
      const key=source==='classtime'?'scores':source==='paper'?'paperScores':'bonusScores';
      const max=source.endsWith('_bonus')?bonus:reg;
      for(const marks of Object.values(priv?.[key]||{})){
        const value=marks?.[it.id];
        if(value!==null&&value!==undefined&&value!==''&&
          (v210StrictScore(value)===null||Number(value)>max+1e-9))
          throw Error('Bestehende Punkte übersteigen neue Maximalpunkte: '+(it.label||it.id));
      }
    }
  }
  if([...totals.values()].some(v=>v<=0))
    throw Error('Jede Rasterkompetenz benötigt mindestens eine reguläre Aufgabe.');
  return v211ItemsOriginal();
};
v210AddPaperItem=async function(){
  const a=v200Assessment(v200Eval?.assessmentId),an=v200EvalAnalysis();
  if(!a||!an?.competencies?.length)throw Error('Bitte zuerst das Kompetenzraster importieren.');
  const title=prompt('Bezeichnung der Papier-Teilaufgabe:');if(!title?.trim())return;
  const answer=prompt('Reguläre Maximalpunkte für '+title.trim()+':','1');if(answer===null)return;
  const points=v210StrictScore(answer);
  if(points===null||points<=0)throw Error('Maximalpunkte müssen positiv sein.');
  let id='Papier'+Date.now();while(an.items.some(x=>x.id===id))id+='x';
  const item={id,label:title.trim(),source:'paper',regularMax:points,bonusMax:0,
    competencyId:an.competencies[0].id,classtimeAliases:[]};
  const before=a.competencySelectionV204?.teacherReviewedV205;
  an.items.push(item);if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=false;
  try{await saveState();}catch(e){
    an.items=an.items.filter(x=>x!==item);
    if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=before;
    throw e;
  }
  render();
};
v210SaveCell=async function(input){
  const [sid,iid]=String(input.dataset.v210GridScore||'').split('|');
  const priv=v200Eval?.privateData,it=v200EvalAnalysis()?.items?.find(x=>x.id===iid);
  if(!priv||!it)throw Error('Unbekannte Aufgabe.');
  if((priv.participationV210?.[sid]||'present')!=='present')return;
  const max=it.source.endsWith('_bonus')?Number(it.bonusMax):Number(it.regularMax);
  const raw=input.value.trim(),score=raw===''?null:v210StrictScore(raw);
  if(!Number.isFinite(max)||max<=0||(raw!==''&&(score===null||score<0||score>max)))
    throw Error('Für '+(it.label||iid)+' sind 0 bis '+max+' Punkte erlaubt.');
  const key=it.source==='classtime'?'scores':it.source==='paper'?'paperScores':'bonusScores';
  priv[key]=priv[key]||{};priv[key][sid]=priv[key][sid]||{};
  priv.scoreSourcesV211=priv.scoreSourcesV211||{};priv.scoreSourcesV211[sid]=priv.scoreSourcesV211[sid]||{};
  const before=priv[key][sid][iid],origin=priv.scoreSourcesV211[sid][iid];
  if(score===null)delete priv[key][sid][iid];else priv[key][sid][iid]=score;
  priv.scoreSourcesV211[sid][iid]=score===null?'unresolved':'manual';
  try{await v200PrivatePut(priv);}catch(e){
    if(before===undefined)delete priv[key][sid][iid];else priv[key][sid][iid]=before;
    if(origin===undefined)delete priv.scoreSourcesV211[sid][iid];else priv.scoreSourcesV211[sid][iid]=origin;
    throw e;
  }
};
const v211WireOriginal=wire;
wire=function(){
  v211WireOriginal();
  const cells=[...document.querySelectorAll('[data-v210-grid-score]')];
  cells.forEach((el,i)=>{
    el.dataset.v211Saved=el.value.trim();
    const persist=async()=>{
      const value=el.value.trim();
      if(value===el.dataset.v211Saved)return true;
      try{await v210SaveCell(el);el.dataset.v211Saved=value;el.classList.remove('v210-error');return true;}
      catch(e){el.classList.add('v210-error');alert(e.message||e);el.focus();return false;}
    };
    el.onchange=()=>{void persist();};
    el.onkeydown=async e=>{
      if(e.key!=='Enter')return;
      e.preventDefault();
      if(!await persist())return;
      const next=cells.slice(i+1).find(x=>!x.disabled);
      if(next){next.focus();next.select();}else{v200Eval.step=5;render();}
    };
  });
};
const v211CombinedOriginal=v200DownloadCombinedPdf;
v200DownloadCombinedPdf=function(){
  if(v200ReportList().some(r=>!r.complete)&&!confirm(
    'Nicht alle Arbeiten sind vollständig. Nur vollständige Bogen werden im Gesamt-PDF ausgegeben. Fortfahren?'))return;
  return v211CombinedOriginal();
};
const v211RenderOriginal=render;
render=function(){
  v211RenderOriginal();
  const el=document.querySelector('.brand small');
  if(el)el.textContent=state.settings.schoolYear+' · '+V211_VERSION;
};
render();