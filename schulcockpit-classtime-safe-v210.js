/* Schulcockpit V0.21.0 – Classtime: überprüfbarer lokaler Import.
 * Keine automatischen Änderungen bei Datei-Upload; Schülerdaten niemals
 * in ChatGPT-Prompt oder allgemeine JSON-Sicherung exportieren.
 * Aufgabenspalten werden anhand des echten S-SESSION-Schemas erkannt. */
const V210_VERSION='V0.21.0';
function v210StrictScore(raw){
  if(typeof raw==='number')return Number.isFinite(raw)?raw:null;
  if(typeof raw!=='string'||!raw.trim())return null;
  const s=raw.trim();
  if(!/^(?:\d+|\d+[.,]\d+)$/.test(s))return null;
  const v=Number(s.replace(',','.'));
  return Number.isFinite(v)?v:null;
}
function v210PrimarySheet(parsed){
  if(!parsed?.sheets?.length)return null;
  const found=parsed.sheets.findIndex(s=>/^S-[\p{L}\p{N}-]+$/u.test(s.name)&&
    (s.rows?.[1]||[]).some(c=>/^Q\d+$/i.test(String(c||'').trim()))&&
    /name des lernenden/i.test(String(s.rows?.[3]?.[0]||'')));
  return found>=0?found:null;
}
const v210DetectBefore=v200DetectClasstime;
v200DetectClasstime=function(parsed){
  const index=v210PrimarySheet(parsed);
  if(index===null)return {...v210DetectBefore(parsed),warning:'Das bekannte Classtime-Schema S-SESSION wurde nicht eindeutig erkannt. Bitte vor jeder Punkteübernahme Spalten und Namenszuordnung prüfen.',verifiedV210:false};
  const sheet=parsed.sheets[index],students=[];
  for(let ri=4;ri<sheet.rows.length;ri++){
    const row=sheet.rows[ri]||[],name=String(row[0]??'').trim();
    if(!name)continue; // Auch nicht mitschreibende Personen im Register behalten.
    students.push({rowIndex:ri,name,row});
  }
  const cols=(sheet.rows[1]||[]).map((v,i)=>({name:String(v||'').trim(),index:i}))
    .filter(o=>/^Q\d+$/i.test(o.name));
  if(!cols.length||!students.length)throw Error('Keine eindeutige Q-Spalten-/Schülerstruktur erkannt.');
  const idSet=new Set(students.map(s=>v200Norm(s.name)));
  const dup=idSet.size!==students.length;
  return {sheetIndex:index,headerRow:1,nameCol:0,studentRows:students,header:sheet.rows[1],
    verifiedV210:!dup,sourceV210:'S-SESSION',questionMaxRowV210:3,
    warning:dup?'Einige Namen kommen mehrfach vor. Reihenfolge und Zuordnung müssen manuell geprüft werden.':''};
};
const v210QuestionColumnsBefore=v200QuestionColumns;
v200QuestionColumns=function(ct){
  if(!ct?.detection?.sourceV210)return v210QuestionColumnsBefore(ct);
  const sh=ct.parsed.sheets[ct.detection.sheetIndex],maxRow=sh.rows[ct.detection.questionMaxRowV210]||[];
  return (sh.rows[ct.detection.headerRow]||[]).map((v,index)=>{
    const label=String(v??'').trim();
    return /^Q\d+$/i.test(label)?{index,label,
      max:v210StrictScore(maxRow[index]),
      description:String(ct.parsed.sheets.find(s=>s.name===label)?.rows?.[0]?.[2]||'').slice(0,180)}:null;
  }).filter(Boolean);
};
const v210PromptStructureBefore=v200AnonymizedClasstimeStructure;
v200AnonymizedClasstimeStructure=function(ct){
  if(!ct?.detection?.sourceV210)return ct?'Classtime-Struktur nicht sicher bestätigt. Keine Teilnehmer- oder Sessiondaten exportieren.':'Classtime noch nicht eingelesen.';
  const cols=v200QuestionColumns(ct);
  return ['# Ausschließlich anonyme Aufgabenstruktur (kein Session-Link, keine Namen, keine Antworten)',
    ...cols.map(c=>'- '+c.label+': '+(c.description||'Aufgabenbeschreibung fehlt')
      +' | reguläre Maximalpunkte laut Excel: '+(Number.isFinite(c.max)?c.max:'unklar')
      +(c.max===0?' | ACHTUNG: 0-Punkte-Aufgabe, Bonusstatus fachlich prüfen, niemals 0/0 als richtig interpretieren':''))
  ].join('\n');
};
function v210QuestionRule(ct,label){
  const item=ct?.rulesV210?.[label];
  return ['original','binary','quarter'].includes(item)?item:'original';
}
function v210PolicyScore(raw,max,policy){
  const n=v210StrictScore(raw);
  if(n===null){
    if(raw===null||raw===undefined||String(raw).trim()==='')return {value:0,problem:null,unanswered:true};
    return {value:null,problem:'nicht numerisch'};
  }
  if(!Number.isFinite(max)||max<=0)return {value:null,problem:'ohne reguläre Maximalpunkte (Bonus separat)'};
  if(n<0||n>max+1e-9)return {value:null,problem:'außerhalb 0–'+max};
  if(policy==='binary'){
    if(max!==1)return {value:null,problem:'Ganz-oder-gar-nicht nur für 1-Punkt-Aufgaben'};
    return {value:n>=1-1e-9?1:0,problem:null,changed:n!==0&&n!==1};
  }
  if(policy==='quarter'){
    const value=Math.min(max,Math.round(n*4)/4);
    return {value,problem:null,changed:Math.abs(n-value)>1e-9};
  }
  return {value:n,problem:null,changed:false,unusual:Math.abs(n*4-Math.round(n*4))>1e-6};
}
function v210ScoreAudit(priv,an,mappingOverride=null,ruleOverride=null){
  const ct=priv?.classtime,d=ct?.detection;
  if(!ct||!d?.sourceV210)return {ready:false,problems:['Nicht bestätigtes Classtime-Format.'],rows:[],count:0};
  if(!priv.roster?.length)return {ready:false,problems:['Keine eindeutig erkannten Teilnehmer.'],rows:[],count:0};
  const columns=new Map(v200QuestionColumns(ct).map(x=>[x.index,x]));
  const map=mappingOverride||ct.mapping||{},rules=ruleOverride||ct.rulesV210||{};
  const sh=ct.parsed.sheets[d.sheetIndex],rows=[],problems=[],unusual=[];
  const mappedQuestions=new Map();
  for(const item of (an?.items||[]).filter(x=>x.source.startsWith('classtime'))){
    const col=map[item.id];
    if(col===null||col===undefined||col==='')continue;
    if(mappedQuestions.has(String(col)))
      problems.push('Dieselbe Classtime-Frage wurde mehreren Prüfungsaufgaben zugeordnet: '
        +(mappedQuestions.get(String(col)).label||mappedQuestions.get(String(col)).id)
        +' und '+(item.label||item.id)+'. Bitte einmal eindeutig verteilen.');
    else mappedQuestions.set(String(col),item);
  }
  for(const stu of priv.roster||[]){
    const row=sh.rows[stu.rowIndex]||[];
    for(const item of (an?.items||[]).filter(it=>it.source==='classtime')){
      const cidx=map[item.id],col=columns.get(Number(cidx));
      if(cidx===undefined||cidx===null||cidx===''||!col){
        problems.push((item.label||item.id)+': keine bestätigte Excel-Spalte');
        continue;
      }
      const mx=Number(item.regularMax)||0;
      if(!Number.isFinite(col.max)||Math.abs(mx-col.max)>1e-8){
        problems.push((item.label||item.id)+': Maximalpunkte im Prüfungsplan ('+mx+') und Excel ('+col.max+') stimmen nicht überein');
        continue;
      }
      const policy=['original','binary','quarter'].includes(rules[col.label])?rules[col.label]:'original',
        original=row[Number(cidx)],res=v210PolicyScore(original,mx,policy);
      rows.push({studentId:stu.id,studentName:stu.name,itemId:item.id,question:col.label,
        original:original??'',score:res.value,problem:res.problem||'',changed:!!res.changed,unusual:!!res.unusual,unanswered:!!res.unanswered,
        max:mx,policy});
      if(res.problem&&res.problem!=='leer')problems.push(stu.id+' · '+col.label+': '+res.problem);
      if(res.unusual)unusual.push(stu.id+' · '+col.label+': '+String(original));
    }
  }
  return {ready:problems.length===0,problems:[...new Set(problems)],unusual,rows,
    count:rows.filter(x=>x.score!==null).length,blank:rows.filter(x=>x.unanswered).length};
}
const v210ImportFileBefore=v200ImportClasstimeFile;
v200ImportClasstimeFile=async function(file){
  // Datei einlesen und lokal als Quellnachweis speichern; KEINE automatische
  // Übernahme vermeintlicher Punktwerte.
  if(!v200Eval)throw Error('Keine Klassenarbeitsauswertung geöffnet.');
  const previous=v200Eval.privateData;
  const parsed=await v200ParseXlsx(file),detection=v200DetectClasstime(parsed);
  if(!detection.sourceV210||!detection.verifiedV210)
    throw Error('Die Excel-Datei oder Teilnehmendenzuordnung ist nicht eindeutig. Es wurden keine Ergebnisse übernommen.');
  const priv=previous||v200DefaultPrivate(v200Eval.assessmentId);
  const oldSheet=priv.classtime?.parsed?.sheets?.[priv.classtime?.detection?.sheetIndex];
  const newSheet=parsed.sheets[detection.sheetIndex];
  const hasImportedScores=Object.values(priv.scores||{}).some(x=>Object.values(x||{}).some(v=>v!==null&&v!==undefined));
  if(hasImportedScores&&oldSheet&&JSON.stringify(oldSheet.rows)!==JSON.stringify(newSheet.rows))
    throw Error('Für diese Klassenarbeit gibt es bereits übernommene digitale Punkte. Die neue Excel unterscheidet sich von der bisherigen. Bitte zuerst ein separates sensibles Auswertungsbackup sichern und eine bewusste Datenübernahme durchführen; nichts wurde überschrieben.');
  const existing=(priv.roster||[]).filter(x=>x.name);
  if(existing.length&&existing.some((x,i)=>v200Norm(detection.studentRows[i]?.name)!==v200Norm(x.name)))
    throw Error('Die Namen/Reihenfolge unterscheiden sich von der vorhandenen Teilnehmerliste. Bitte zuerst gesondert abgleichen, bevor Punkte überschrieben werden.');
  v200MergeRoster(priv,detection);
  priv.classtime={parsed,detection,mapping:priv.classtime?.mapping||{},
    rulesV210:priv.classtime?.rulesV210||{},importedAt:new Date().toISOString(),
    reviewedV210:false};
  v200Eval.privateData=priv;await v200PrivatePut(priv);render();
};
v200ApplyClasstimeScores=function(priv,an){
  const audit=v210ScoreAudit(priv,an);
  if(!audit.ready)throw Error('Einige Spalten oder Werte sind ungeklärt. Punkte wurden nicht übertragen: '+audit.problems.slice(0,4).join('; '));
  // Streng: nicht numerische und leere Werte nicht zu 0 machen;
  // 0-Maximalpunkte-Aufgaben werden NIE über Classtime automatisch bewertet.
  const staged=structuredClone(priv.scores||{});
  for(const row of audit.rows){
    staged[row.studentId]=staged[row.studentId]||{};
    if(row.score===null)delete staged[row.studentId][row.itemId];
    else staged[row.studentId][row.itemId]=row.score;
  }
  priv.scores=staged;
  priv.classtime.reviewedV210=true;
  priv.classtime.scoreAuditV210={timestamp:new Date().toISOString(),
    changed:audit.rows.filter(x=>x.changed).length,
    decimalWarnings:audit.unusual.length,missing:audit.blank,
    imported:audit.count};
};
v200SaveMappingAndScores=async function(){
  const priv=v200Eval?.privateData,an=v200EvalAnalysis();
  if(!priv?.classtime||!an)throw Error('Excel oder fachliche Aufgabenanalyse fehlt.');
  const mapping={...(priv.classtime.mapping||{})},
        rules={...(priv.classtime.rulesV210||{})};
  for(const el of document.querySelectorAll('[data-v200-map-item]'))mapping[el.dataset.v200MapItem]=el.value===''?'':Number(el.value);
  for(const el of document.querySelectorAll('[data-v210-rule]'))rules[el.dataset.v210Rule]=el.value;
  const audit=v210ScoreAudit(priv,an,mapping,rules);
  if(!audit.ready)throw Error('Zuerst prüfen: '+audit.problems.slice(0,7).join('; '));
  if(audit.unusual.length&&!confirm(audit.unusual.length+' Punktewerte liegen nicht auf Viertelpunkten. In der Vorschau prüfen und trotzdem unverändert übernehmen?'))return;
  const old=structuredClone({mapping:priv.classtime.mapping||{},rules:priv.classtime.rulesV210||{},
    scores:priv.scores||{},reviewed:priv.classtime.reviewedV210,audit:priv.classtime.scoreAuditV210});
  try{
    priv.classtime.mapping=mapping;priv.classtime.rulesV210=rules;
    v200ApplyClasstimeScores(priv,an);
    await v200PrivatePut(priv);
  }catch(e){
    priv.classtime.mapping=old.mapping;priv.classtime.rulesV210=old.rules;
    priv.classtime.reviewedV210=old.reviewed;priv.classtime.scoreAuditV210=old.audit;priv.scores=old.scores;
    throw e;
  }
  render();
};
