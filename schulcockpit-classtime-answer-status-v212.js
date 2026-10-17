/* Schulcockpit V0.21.2 – Classtime-Status aus originalen Fragenblättern.
 * Fehlende Antwort != vorhandene, noch nicht bewertete Antwort.
 * Keine Schülerantworten an ChatGPT; alle Detailprüfungen bleiben lokal. */
const V212_VERSION='V0.21.2';

/* S-SESSION reports can contain numeric-looking special values (e.g. "42")
 * for unvalidated answers. Recognize the marker only if the Q sheet itself
 * documents the same value in its metadata and the value exceeds the regular
 * maximum; never treat such a marker as points. */
function v212AnswerStatus(ct,studentRow,label,raw){
  if(!ct?.detection?.sourceV210||!/^Q\d+$/i.test(String(label||'')))
    return {status:'unknown'};
  const col=v200QuestionColumns(ct).find(c=>c.label.toUpperCase()===label.toUpperCase());
  const sheet=ct.parsed?.sheets?.find(s=>s.name.toUpperCase()===label.toUpperCase());
  const n=v210StrictScore(raw),metadata=v210StrictScore(sheet?.rows?.[0]?.[1]);
  if(!col||!sheet||n===null||metadata===null||n!==metadata||
     !Number.isFinite(col.max)||n<=col.max)return {status:'not-marker'};
  const participants=ct.detection.studentRows||[];
  const pos=participants.findIndex(s=>s.rowIndex===studentRow.rowIndex &&
    v200Norm(s.name)===v200Norm(studentRow.name));
  if(pos<0)return {status:'unknown'};
  const header=sheet.rows.findIndex(row=>/name des lernenden/i.test(String(row?.[0]||'')));
  if(header<0)return {status:'unknown'};
  const detail=sheet.rows[header+1+pos];
  if(!detail||String(detail[0]||'').trim()!=='S'+(pos+1))return {status:'unknown'};
  const answered=detail.slice(2).some(value=>value!==null&&value!==undefined&&String(value).trim()!=='');
  return {status:answered?'ungraded':'not-answered'};
}

function v212MarkerStats(ct){
  const result={notAnswered:0,ungraded:0,unknown:0};
  if(!ct?.detection?.sourceV210)return result;
  const sheet=ct.parsed.sheets[ct.detection.sheetIndex],cols=v200QuestionColumns(ct);
  for(const stu of ct.detection.studentRows||[]){
    const row=sheet.rows[stu.rowIndex]||[];
    for(const col of cols){
      const s=v212AnswerStatus(ct,stu,col.label,row[col.index]);
      if(s.status==='not-answered')result.notAnswered++;
      else if(s.status==='ungraded')result.ungraded++;
      else if(s.status==='unknown')result.unknown++;
    }
  }
  return result;
}

const v212ScoreAuditBefore=v210ScoreAudit;
v210ScoreAudit=function(priv,an,mappingOverride=null,ruleOverride=null){
  const audit=v212ScoreAuditBefore(priv,an,mappingOverride,ruleOverride);
  const ct=priv?.classtime;
  if(!ct?.detection?.sourceV210)return audit;
  const index=new Map((priv.roster||[]).map(s=>[s.id,s]));
  const markerRows=[];
  for(const row of audit.rows||[]){
    if(!row.problem)continue;
    const stu=index.get(row.studentId);
    if(!stu)continue;
    const kind=v212AnswerStatus(ct,stu,row.question,row.original).status;
    if(kind==='not-answered'){
      row.score=0;row.problem='';row.unanswered=true;
      row.answerStatusV212='not-answered';
      markerRows.push(row);
    }else if(kind==='ungraded'){
      row.answerStatusV212='ungraded';
      row.problem='Antwort vorhanden, Bewertung ausstehend';
    }
  }
  audit.count=(audit.rows||[]).filter(r=>r.score!==null).length;
  audit.blank=(audit.rows||[]).filter(r=>r.unanswered).length;
  // Parent V0.21.1 distinguishes malformed structural mappings from
  // unresolved individual cells; recalculate unresolved after classifying.
  audit.unresolved=(audit.rows||[]).filter(r=>{
    if(!r.problem)return false;
    const item=(an?.items||[]).find(i=>i.id===r.itemId)||{id:r.itemId,source:'classtime'};
    const existing=v200GetScore(priv,r.studentId,item);
    return !Number.isFinite(v210StrictScore(existing));
  });
  audit.notAnsweredFromDetailV212=markerRows.length;
  audit.ungradedFromDetailV212=audit.unresolved.filter(r=>r.answerStatusV212==='ungraded').length;
  return audit;
};

const v212ExcelStateBefore=v210ExcelState;
v210ExcelState=function(priv,an){
  const out=v212ExcelStateBefore(priv,an),stats=v212MarkerStats(priv?.classtime);
  if(!priv?.classtime?.detection?.sourceV210)return out;
  out.preview+='<section class="detail-section v212-answer-audit">'
    +'<h3>Antwortstatus aus den einzelnen Excel-Frageblättern</h3>'
    +'<p><strong>'+stats.notAnswered+'</strong> eindeutig nicht beantwortete Fragen · '
    +'<strong>'+stats.ungraded+'</strong> abgegebene, noch nicht bewertete Antworten'
    +(stats.unknown?' · <strong>'+stats.unknown+'</strong> unklare Zuordnungen':'')
    +'. Diese Zahlen beziehen sich auf den Stand <strong>dieser importierten Datei</strong>.</p>'
    +'<p class="microcopy">Nur eine durch das passende Fragenblatt nachgewiesene leere Antwort wird '
    +'nach deiner Importfreigabe als 0 für eine reguläre Aufgabe übernommen. '
    +'Vorhandene, aber unbewertete Antworten bleiben offen. Bonusfragen mit 0 Maximalpunkten '
    +'werden aus Classtime niemals als automatisch richtig gewertet; ihre tatsächlichen Bonuspunkte '
    +'musst du anhand deiner Korrektur vergeben.</p></section>';
  return out;
};

const v212RenderBefore=render;
render=function(){
  v212RenderBefore();
  const brand=document.querySelector('.brand small');
  if(brand)brand.textContent=state.settings.schoolYear+' · '+V212_VERSION;
};
render();