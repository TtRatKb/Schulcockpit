/* V0.33.38: explicit, lossless shared Classtime question partitions. */
(function(root){
'use strict';
const isDigital=i=>['classtime','classtime_bonus'].includes(i?.source);
const maximum=i=>Number(i.source==='classtime_bonus'?i.bonusMax:i.regularMax);
const numeric=x=>x===null||x===undefined||String(x).trim()===''?null:/^\d+(?:[.,]\d+)?$/.test(String(x).trim())?Number(String(x).replace(',','.')):null;
function taskRef(value){
 const m=String(value||'').match(/(?:^|[\s·–—:*])(?:Aufgabe\s*|A\s*)(\d+)\s*([a-z])(?:\s+([a-z])(?=\s*[–—·:]|$))?(?=\s|[.:,;·–—(/)-]|$)/i);
 return m?Number(m[1])+m[2].toLowerCase()+(m[3]||'').toLowerCase():'';
}
function gapList(raw){
 const s=String(raw||'').trim();if(!s)return [];
 const out=[];for(const token of s.split(/[,;+\s]+/).filter(Boolean)){
  const m=token.match(/^(\d+)(?:[-–—](\d+))?$/);
  if(!m)throw Error('Lückennummern z. B. 1,2 oder 3-4 eingeben.');
  const a=Number(m[1]),b=Number(m[2]||m[1]);
  if(a<1||b<a||b>200)throw Error('Ungültiger Lückenbereich.');
  for(let i=a;i<=b;i++)out.push(i);
 }
 if(new Set(out).size!==out.length)throw Error('Eine Lücke ist mehrfach ausgewählt.');
 return out.sort((a,b)=>a-b);
}
function plan(items,cols,mapping={},parts={}){
 const byIndex=new Map(cols.map(c=>[String(c.index),c])),byQ=new Map(),groups=[],errors=[],groupIds=new Set();
 for(const item of items.filter(isDigital)){
  const v=mapping[item.id];if(v===null||v===undefined||v==='')continue;
  if(!byIndex.has(String(v)))continue;
  const arr=byQ.get(String(v))||[];arr.push(item);byQ.set(String(v),arr);
 }
 for(const [idx,rows] of byQ){
  const explicit=rows.some(it=>String(parts[it.id]||'').trim());
  if(!explicit)continue;
  const col=byIndex.get(idx),used=new Set(),sub=[];
  if(!Number.isInteger(col.max)||col.max<1||col.max>200){errors.push(col.label+': nur ausdrücklich nummerierte 1-Punkt-Lücken mit ganzzahligem Gesamtmaximum werden unterstützt.');continue;}
  for(const item of rows){
   try{
    const gaps=gapList(parts[item.id]);if(!gaps.length||gaps.length!==maximum(item))throw Error('Genau '+maximum(item)+' Lücke(n) à 1 Punkt zuordnen.');
    if(gaps.some(n=>n>col.max||used.has(n)))throw Error('Lücken überschneiden sich oder liegen außerhalb 1–'+col.max+'.');
    gaps.forEach(n=>used.add(n));sub.push({item,gaps});
   }catch(e){errors.push((item.label||item.id)+': '+e.message);}
  }
  if(used.size!==col.max)errors.push(col.label+': alle '+col.max+' Lücken müssen genau einmal zugeordnet sein (aktuell '+used.size+').');
  if(sub.length===rows.length&&used.size===col.max){groups.push({column:col,sub});rows.forEach(x=>groupIds.add(x.id));}
 }
 for(const item of items.filter(isDigital))if(String(parts[item.id]||'').trim()&&!byIndex.has(String(mapping[item.id])))errors.push((item.label||item.id)+': bitte zuerst eine Q-Spalte auswählen.');
 return {ok:!errors.length,errors,groups,groupIds,direct:items.filter(i=>!groupIds.has(i.id))};
}
// Only explicit score fields, not numeric answers. All gap values must match
// the session total and the verified S-row order.
function detailPoints(parsed,det,col,source,total){
 const sheets=(parsed?.sheets||[]).filter(s=>String(s.name).toUpperCase()===String(col.label).toUpperCase());
 if(sheets.length!==1)return null;
 const rows=sheets[0].rows||[],h=rows.findIndex(r=>/name des lernenden|learner name|student name/i.test(String(r?.[0]||'')));
 if(h<0)return null;
 const fields=new Map(),ambiguous=new Set();
 (rows[h]||[]).forEach((x,i)=>{
  const label=String(x||'');
  if(!/\b(?:punkte|points|score|punktzahl)\b/i.test(label))return;
  const m=label.match(/(?:l[üu]cke|blank|gap)\s*#?\s*(\d+)/i);
  if(!m)return;
  const n=Number(m[1]);if(fields.has(n))ambiguous.add(n);fields.set(n,i);
 });
 if(!fields.size)return null;
 if(ambiguous.size||fields.size!==col.max||Array.from({length:col.max},(_,i)=>i+1).some(n=>!fields.has(n)))return false;
 const participants=det.studentRows||[],pos=participants.findIndex(r=>r.rowIndex===source.rowIndex&&String(r.name)===String(source.name));
 if(pos<0)return false;
 const entries=rows.slice(h+1).filter(r=>/^S\d+$/i.test(String(r?.[0]||'').trim()));
 if(entries.length!==participants.length||entries.some((r,i)=>String(r[0]).trim().toUpperCase()!=='S'+(i+1)))return false;
 const row=entries[pos],values=new Map([...fields].map(([n,i])=>[n,numeric(row[i])]));
 if([...values.values()].some(v=>v===null||v<0||v>1)||Math.abs([...values.values()].reduce((s,n)=>s+n,0)-total)>1e-8)return false;
 return values;
}
function groupScores(parsed,det,group,source){
 const col=group.column,row=parsed?.sheets?.[det.sheetIndex]?.rows?.[source.rowIndex]||source.row||[];
 const raw=row[col.index],total=numeric(raw),valid=total!==null&&total>=0&&total<=col.max;
 let points=valid?detailPoints(parsed,det,col,source,total):null;
 if(points===null&&valid&&(total===0||total===col.max))points=new Map(Array.from({length:col.max},(_,i)=>[i+1,total===0?0:1]));
 const message=points?'':points===false?'Excel gesamt '+total+'/'+col.max+' P.; Detailwerte oder Teilnehmerfolge widersprüchlich. Bitte Original prüfen.':valid?'Excel gesamt '+total+'/'+col.max+' P.; Einzelpunkte nicht eindeutig exportiert. Lücken anhand des Originals manuell bewerten.':'Gesamtpunkte fehlen oder sind ungültig; Original prüfen.';
 return group.sub.map(({item,gaps})=>({itemId:item.id,source:item.source,question:col.label,original:raw??'',max:maximum(item),score:points?gaps.reduce((s,n)=>s+points.get(n),0):null,message,gaps}));
}
const api={taskRef,gapList,plan,groupScores};
root.SchulcockpitGroupedV3338=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
