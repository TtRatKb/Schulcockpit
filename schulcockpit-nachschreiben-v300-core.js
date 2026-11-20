/* Schulcockpit V0.30.0 – private, auditable second-session imports.
 * Only verified user-linked rows are imported. No implicit overwrites or
 * inferred grades; all this data stays in the private assessment IndexedDB.
 */
const SC_MAKEUP_BATCH_V300=(function(){
'use strict';
function norm(text){return String(text||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();}
function signature(parsed,det){
 const s=parsed?.sheets?.[det?.sheetIndex];
 if(!s||!Array.isArray(det?.studentRows))throw Error('Kein bestätigtes Classtime-Tabellenblatt.');
 const str=JSON.stringify([s.name,s.rows[det.headerRow],s.rows[det.questionMaxRowV210],
  det.studentRows.map(r=>[r.name,r.row])]);
 let hash=2166136261;
 for(let i=0;i<str.length;i++){hash^=str.charCodeAt(i);hash=Math.imul(hash,16777619);}
 return (hash>>>0).toString(16).padStart(8,'0')+'-'+det.studentRows.length;
}
function proposals(batch,roster){
 const used=new Set();
 return (batch?.det?.studentRows||batch?.rows||[]).map(row=>{
  const matches=(roster||[]).filter(s=>norm(s.name)===norm(row.name));
  const id=matches.length===1&&!used.has(matches[0].id)?matches[0].id:'';
  if(id)used.add(id);
  return {rowIndex:row.rowIndex,name:row.name,studentId:id,ambiguous:matches.length!==1};
 });
}
function importableItem(it){return it?.source==='classtime'||(it?.source==='classtime_bonus'&&Number(it.bonusMax)>0);}
function itemMax(it){return Number(it?.source==='classtime_bonus'?it.bonusMax:it?.regularMax);}
function taskCode(value){
 const m=String(value||'').match(/\b(?:bonus\s*)?frage\s*(\d+)\s*([a-z]?)\b/i);
 return m?String(Number(m[1]))+String(m[2]||'').toLowerCase():'';
}
function columns(parsed,det){
 const s=parsed?.sheets?.[det?.sheetIndex];if(!s)throw Error('Classtime-Tabelle fehlt.');
 const hdr=s.rows[det.headerRow]||[],max=s.rows[det.questionMaxRowV210]||[];
 return hdr.map((value,index)=>{
  const label=String(value||'').trim();
  if(!/^Q\d+$/i.test(label))return null;
  const n=Number(String(max[index]??'').replace(',','.'));
  const description=parsed.sheets?.find(sh=>sh.name===label)?.rows?.[0]?.[2];
  return {label,index,max:Number.isFinite(n)?n:null,description:String(description||'').slice(0,180)};
 }).filter(Boolean);
}
function autoMap(items,cols){
 const suggestions=new Map(),byColumn=new Map(),result={};
 for(const it of (items||[]).filter(importableItem)){
  const aliases=[it.id,it.label,...(it.classtimeAliases||[])].filter(Boolean);
  const exact=cols.filter(c=>c.max===itemMax(it)&&
    aliases.some(value=>norm(value)===norm(c.label)));
  const codes=new Set(aliases.map(taskCode).filter(Boolean));
  const semantic=cols.filter(c=>c.max===itemMax(it)&&codes.has(taskCode(c.description)));
  // The existing exact Q alias wins. A descriptive task number is accepted
  // only when precisely one column has the same original maximum.
  const matches=exact.length?exact:semantic;
  if(matches.length!==1)continue;
  const col=matches[0];
  suggestions.set(it.id,col.index);
  byColumn.set(col.index,(byColumn.get(col.index)||0)+1);
 }
 for(const [id,index] of suggestions)if(byColumn.get(index)===1)result[id]=index;
 return result;
}
function isScore(n,max){
 if(n===null||n===undefined||String(n).trim()==='')return null;
 const text=String(n).trim();
 if(!/^(?:\d+|\d+[.,]\d+)$/.test(text))throw Error('Ungültiger Punktewert '+text);
 const value=Number(text.replace(',','.'));
 if(!Number.isFinite(value)||value<0||value>max+1e-9)throw Error('Punkte '+text+' außerhalb 0–'+max);
 return value;
}
function evaluate({batch,analysis,roster,linked,mapping,current,variant='standard',replacement=[]}){
 if(!batch||!analysis?.items?.length||!batch.det||!batch.parsed)throw Error('Prüfungsanalyse oder Excel-Vorschau fehlt.');
 const cols=columns(batch.parsed,batch.det),byIndex=new Map(cols.map(c=>[String(c.index),c]));
 const rows=(batch.det.studentRows||[]),seen=new Set(),replacing=new Set(replacement||[]),chosen=[];
 const items=analysis.items.filter(importableItem);
 if(!items.length)throw Error('Diese Arbeit enthält keine Classtime-Aufgaben in der Bewertungsanalyse.');
 const mappings=new Map(),usedCols=new Set();
 for(const it of items){
  const raw=mapping?.[it.id],col=raw===undefined||raw===null||raw===''?null:byIndex.get(String(raw));
  if(!col)throw Error('Classtime-Zuordnung fehlt für '+(it.label||it.id));
  if(usedCols.has(col.index))throw Error('Eine Q-Spalte darf nicht mehreren Aufgaben zugeordnet werden.');
  if(col.max===null||Math.abs(col.max-itemMax(it))>1e-8)
   throw Error('Punktemaximum von '+(it.label||it.id)+' passt nicht zur Excel-Spalte '+col.label+
    ': '+itemMax(it)+' ≠ '+col.max+'. Verwende das richtige Variantenraster.');
  usedCols.add(col.index);mappings.set(it.id,col);
 }
 for(const r of rows){
  const sid=linked?.[r.rowIndex];if(!sid)continue;
  const student=(roster||[]).find(s=>s.id===sid);
  if(!student)throw Error('Eine Zuordnung verweist nicht auf die bestehende Teilnehmerliste.');
  if(seen.has(sid))throw Error('Zwei Excel-Zeilen wurden demselben Kind zugeordnet.');
  seen.add(sid);
  const marks={},bonusMarks={};let valid=0;
  for(const it of items){
   const col=mappings.get(it.id),v=isScore(r.row?.[col.index],itemMax(it));
   if(v!==null){
    (it.source==='classtime_bonus'?bonusMarks:marks)[it.id]=v;
    valid++;
   }
  }
  if(!valid)throw Error('In einer ausgewählten Zeile fehlen alle bewertbaren Classtime-Punkte.');
  const existing=['scores','paperScores','bonusScores'].some(k=>
    Object.values(current?.[k]?.[sid]||{}).some(v=>v!==undefined&&v!==null&&v!==''));
  const active=current?.activeVariantV300?.[sid]||'standard';
  const wantsReplacement=replacing.has(sid);
  if(existing&&!wantsReplacement){
   const conflicts=[
    ...Object.entries(marks).map(([k,v])=>[current?.scores?.[sid]?.[k],v]),
    ...Object.entries(bonusMarks).map(([k,v])=>[current?.bonusScores?.[sid]?.[k],v])
   ].filter(([prior,v])=>prior!==undefined&&prior!==null&&Number(prior)!==Number(v));
   if(active!==variant||conflicts.length)
    throw Error('Für '+student.name+' existieren bereits Ergebnisse. Zuerst „Bisherige Arbeit ersetzen“ aktivieren.');
  }
  chosen.push({studentId:sid,rowIndex:r.rowIndex,name:student.name,marks,bonusMarks,
   variant,replace:existing&&wantsReplacement,valid});
 }
 if(!chosen.length)throw Error('Bitte mindestens eine Excel-Zeile eindeutig einer Person zuordnen.');
 return {chosen,count:chosen.length,points:chosen.reduce((n,x)=>n+x.valid,0)};
}
function backupStudent(priv,sid){
 const fields=['scores','paperScores','bonusScores','scoreSourcesV211','bonusOriginsV213',
  'feedbackV210','gradingOverridesV267','gradesV260','participationV210','activeVariantV300'];
 const data={};
 for(const k of fields)if(priv[k]&&Object.prototype.hasOwnProperty.call(priv[k],sid))
  data[k]=structuredClone(priv[k][sid]);
 return {savedAt:new Date().toISOString(),data};
}
function apply(priv,proposal,source){
 const next=structuredClone(priv);
 next.scores=next.scores||{};next.scoreSourcesV211=next.scoreSourcesV211||{};
 next.participationV210=next.participationV210||{};next.activeVariantV300=next.activeVariantV300||{};
 next.examAttemptsV300=next.examAttemptsV300||{};next.makeupHistoryV300=next.makeupHistoryV300||[];
 for(const student of proposal.chosen){
  const id=student.studentId;
  if(student.replace){
   next.examAttemptsV300[id]=next.examAttemptsV300[id]||[];
   next.examAttemptsV300[id].push({...backupStudent(next,id),replacedBy:source.id,
    fromVariant:next.activeVariantV300[id]||'standard'});
   for(const k of ['scores','paperScores','bonusScores','scoreSourcesV211','bonusOriginsV213',
    'feedbackV210','gradingOverridesV267','gradesV260'])
    if(next[k])delete next[k][id];
  }
  const previousScores={...(next.scores[id]||{})};
  const previousOrigins={...(next.scoreSourcesV211[id]||{})};
  next.scores[id]={...previousScores,...student.marks};
  const bonuses=student.bonusMarks||{};
  if(Object.keys(bonuses).length){
   next.bonusScores=next.bonusScores||{};
   next.bonusOriginsV213=next.bonusOriginsV213||{};
   const previousBonus={...(next.bonusScores[id]||{})};
   const previousBonusOrigins={...(next.bonusOriginsV213[id]||{})};
   next.bonusScores[id]={...previousBonus,...bonuses};
   next.bonusOriginsV213[id]={...previousBonusOrigins};
   for(const [key,value] of Object.entries(bonuses)){
    if(!student.replace&&previousBonusOrigins[key]==='manual'&&
      previousBonus[key]!==undefined&&Number(previousBonus[key])===Number(value))continue;
    next.bonusOriginsV213[id][key]='excel-makeup-v300';
   }
  }
  next.scoreSourcesV211[id]={...previousOrigins};
  for(const key of Object.keys(student.marks)){
   // Reimporting an equal digital value does not undo a manual correction.
   if(!student.replace&&previousOrigins[key]==='manual'&&
     previousScores[key]!==undefined&&Number(previousScores[key])===Number(student.marks[key]))
    continue;
   next.scoreSourcesV211[id][key]='excel-makeup-v300';
  }
  next.participationV210[id]='present';next.activeVariantV300[id]=student.variant;
  next.makeupHistoryV300.push({batchId:source.id,studentId:id,
    importedAt:new Date().toISOString(),variant:student.variant,
    replaced:student.replace,questionCount:student.valid});
 }
 next.makeupBatchesV300=(next.makeupBatchesV300||[]).map(b=>b.id===source.id?
   {...b,importedAt:new Date().toISOString(),importedStudents:proposal.chosen.map(x=>x.studentId)}:b);
 return next;
}
return {norm,signature,proposals,columns,autoMap,importableItem,itemMax,evaluate,backupStudent,apply,isScore};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_MAKEUP_BATCH_V300;