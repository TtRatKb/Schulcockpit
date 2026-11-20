/* Schulcockpit V0.33.6 – verifiable Classtime task matching and explicit score regrading.
 * Pure helpers; no real student names or records are sent to any server.
 */
(function(root){
'use strict';
const CODE=/\b(?:bonus\s*)?frage\s*(\d+)\s*([a-z]?)\b/i;
function taskCode(value){
 const t=String(value||'').replace(/[\u2013\u2014]/g,'-').match(CODE);
 return t?String(Number(t[1]))+String(t[2]||'').toLowerCase():'';
}
function isDigital(item){return item?.source==='classtime'||item?.source==='classtime_bonus';}
function isNumericalBonus(item){return item?.source==='classtime_bonus'&&Number(item.bonusMax)>0;}
function maximum(item){return item.source==='classtime_bonus'?Number(item.bonusMax):Number(item.regularMax);}
function isBonus(item){return item.source.endsWith('_bonus')||!!item.bonusInsteadV260;}
function taskLabel(item){
 const total=maximum(item);
 if(item.source==='classtime_bonus')return String(total)+' Originalpunkte · vollständig Bonus';
 if(item.partialBonusV267?.max>0)return String(total)+' Originalpunkte · davon '+item.partialBonusV267.max+' Bonus';
 if(item.bonusInsteadV260)return String(total)+' Originalpunkte · vollständig Bonus';
 return String(total)+' reguläre Punkte';
}
function matches(item,cols){
 const labels=[item.id,item.label,...(item.classtimeAliases||[])].filter(Boolean);
 const direct=labels.filter(x=>/^Q\d+$/i.test(String(x).trim())).map(x=>String(x).trim().toUpperCase());
 const code=new Set(labels.map(taskCode).filter(Boolean));
 let result=(cols||[]).filter(c=>direct.includes(String(c.label).toUpperCase()));
 if(result.length===1)return result;
 result=(cols||[]).filter(c=>code.has(taskCode(c.description)));
 return result;
}
function recommend(items,cols,persisted={}){
 const out={...persisted};
 const occupied=new Set(Object.entries(out).filter(([,v])=>v!==''&&v!==null&&v!==undefined)
   .map(([,v])=>String(v)));
 const proposals=new Map();
 for(const it of items.filter(isDigital)){
  if(out[it.id]!==''&&out[it.id]!==null&&out[it.id]!==undefined)continue;
  const matchesFor=matches(it,cols).filter(col=>{
   if(occupied.has(String(col.index)))return false;
   // 0/0 Classtime bonuses are processed by the separate safe answer-sheet path.
   if(it.source==='classtime_bonus'&&col.max===0)return false;
   return Number(col.max)>0;
  });
  if(matchesFor.length!==1)continue;
  const key=String(matchesFor[0].index);
  proposals.set(key,[...(proposals.get(key)||[]),it.id]);
 }
 for(const [index,ids] of proposals)if(ids.length===1&&!occupied.has(index)){
  out[ids[0]]=Number(index);occupied.add(index);
 }
 return out;
}
function safeScale(original,from,to){
 const score=Number(original),a=Number(from),b=Number(to);
 if(!Number.isFinite(score)||!Number.isFinite(a)||!Number.isFinite(b)||
    !(a>0&&b>0)||score<0||score>a)return null;
 return Math.round(score*b/a*4)/4;
}
function classify(item,column,conversion){
 const excel=Number(column?.max),planned=maximum(item);
 if(!Number.isFinite(excel)||!Number.isFinite(planned)||planned<=0)
  return {ok:false,issue:'Punktmaximum ist nicht nachvollziehbar.'};
 if(Math.abs(excel-planned)<1e-8)return {ok:true,mode:'original'};
 if(item.source==='classtime_bonus')
  return {ok:false,issue:'Eine Bonusaufgabe mit abweichendem Originalmaximum muss gesondert geprüft werden.'};
 if(conversion==='manual')return {ok:true,mode:'manual'};
 if(conversion==='scale')return {ok:true,mode:'scale'};
 return {ok:false,issue:'Die Excel hat '+excel+' Punkte, die Bewertung '+planned+
  '. Bitte „manuell neu bewerten“ oder „proportional umrechnen“ wählen.'};
}
function validateMapping(items,cols,selected={},conversions={}){
 const byIndex=new Map((cols||[]).map(c=>[String(c.index),c]));
 const used=new Map(),issues=[],selectedById={};
 for(const it of items.filter(isDigital)){
  const id=it.id,idx=selected[id],column=byIndex.get(String(idx));
  if(idx===''||idx===undefined||idx===null||!column){
   issues.push((it.label||id)+': bitte eine Excel-Frage auswählen.');continue;
  }
  const existing=used.get(String(idx));
  if(existing){
   issues.push('Dieselbe Excel-Frage '+column.label+' ist bei '+existing+' und '+(it.label||id)+' ausgewählt.');
   continue;
  }
  used.set(String(idx),it.label||id);
  const decision=classify(it,column,conversions[id]);
  if(!decision.ok)issues.push((it.label||id)+': '+decision.issue);
  selectedById[id]={column,decision};
 }
 return {ok:issues.length===0,issues,selectedById};
}
function numericBonusRows(priv,items,selectedById,strictScore,answerStatus){
 const ct=priv?.classtime,main=ct?.parsed?.sheets?.[ct.detection?.sheetIndex],rows=[],warnings=[];
 if(!main)return {rows:[],warnings:['Classtime-Quelle fehlt.']};
 for(const it of items.filter(isNumericalBonus)){
  const matched=selectedById[it.id];
  if(!matched?.decision.ok||matched.decision.mode!=='original')continue;
  const col=matched.column,max=Number(it.bonusMax);
  for(const student of priv.roster||[]){
   // A primary-session Q value may never re-enter a confirmed inclusion
   // or makeup student's score store, even when item IDs happen to match.
   if((priv.participationV210?.[student.id]||'present')!=='present'||
      (priv.activeVariantV300?.[student.id]||'standard')!=='standard'||
      priv.examFileV317?.[student.id]||
      student.rowIndex===null||student.rowIndex===undefined)continue;
   const src=main.rows?.[student.rowIndex]||[];
   const raw=src[col.index],n=strictScore(raw);
   if(raw===null||raw===undefined||raw===''){
    // Unknown is not a zero. Require explicit evidence, not an empty Excel cell.
    rows.push({studentId:student.id,itemId:it.id,score:null,question:col.label});continue;
   }
   if(n===null||n<0||n>max){
    const status=typeof answerStatus==='function'?answerStatus(ct,student,col.label,raw)?.status:'unknown';
    if(status==='not-answered'){
      rows.push({studentId:student.id,itemId:it.id,score:0,question:col.label,verifiedEmpty:true});
    }else{
      warnings.push(col.label+': mindestens eine Antwort ist nicht bewertet und bleibt offen.');
      rows.push({studentId:student.id,itemId:it.id,score:null,question:col.label});
    }
    continue;
   }
   rows.push({studentId:student.id,itemId:it.id,score:n,question:col.label});
  }
 }
 return {rows,warnings:[...new Set(warnings)]};
}
const api={taskCode,isDigital,isNumericalBonus,maximum,isBonus,taskLabel,
 matches,recommend,safeScale,classify,validateMapping,numericBonusRows};
root.SchulcockpitClasstimeMatchV336=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);