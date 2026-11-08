/* Schulcockpit V0.31.1 – pure, lossless ordering for individual Soll-Stunden.
 * Unit IDs are permanent; only the order and still-open appointment assignments
 * change. Already-held lessons are absolute anchors, regardless of their date.
 */
const SC_SEQUENCE_DRAG_V311=(function(){
'use strict';
const id=x=>String(x??'');
const date=x=>String(x||'');
function requireUnique(ids){
 const all=ids.map(id);
 if(new Set(all).size!==all.length||all.some(x=>!x))
  throw Error('Die Reihenplanung enthält fehlende oder doppelte Stunden-IDs.');
 return all;
}
function reorder(original,source,target,after=false,fixed=[]){
 const ids=requireUnique(original),locked=new Set(fixed.map(id));
 if(!ids.includes(id(source))||!ids.includes(id(target)))
  throw Error('Die gewählte Stunde gehört nicht mehr zu dieser Reihe.');
 if(locked.has(id(source)))
  throw Error('Eine bereits gehaltene Stunde kann nicht verschoben werden.');
 if(id(source)===id(target))return ids;
 const remaining=ids.filter(x=>x!==id(source)),at=remaining.indexOf(id(target));
 remaining.splice(at+(after?1:0),0,id(source));
 // Held records remain at their original visual position and appointment.
 const movable=remaining.filter(x=>!locked.has(x));
 let pos=0;
 const result=ids.map(x=>locked.has(x)?x:movable[pos++]);
 if(result.length!==ids.length||new Set(result).size!==ids.length)
  throw Error('Die Reihenfolge konnte nicht sicher übernommen werden.');
 return result;
}
function asSlot(s){
 if(s===null||s===undefined||s==='')return null;
 const n=Number(s);return Number.isInteger(n)&&n>=0&&n<=30?n:null;
}
function calculate(original,order){
 const rows=Array.isArray(original)?original:[],ids=requireUnique(rows.map(x=>x.id));
 const wanted=requireUnique(order);
 if(wanted.length!==ids.length||wanted.some(x=>!ids.includes(x)))
  throw Error('Die Reihenplanung hat sich zwischenzeitlich verändert. Bitte neu öffnen.');
 const byId=new Map(rows.map(x=>[id(x.id),x]));
 for(let i=0;i<ids.length;i++)if(rows[i].held&&ids[i]!==wanted[i])
  throw Error('Bereits gehaltene Stunden müssen an ihrem ursprünglichen Platz bleiben.');
 const pool=rows.filter(x=>!x.held&&!x.skipped&&date(x.date))
  .map((x,i)=>({
   date:date(x.date),slot:asSlot(x.slot),
   period:id(x.period),timetableId:id(x.timetableId),source:id(x.id),index:i
  })).sort((a,b)=>a.date.localeCompare(b.date)||
   (a.slot??999)-(b.slot??999)||a.index-b.index);
 // No guesswork about which of two course periods has been assigned to a
 // unit on the same date: ambiguity would damage links and print decisions.
 const occupied=new Set();
 for(const s of pool){
  const k=s.date+'|'+(s.slot??'?');
  if(occupied.has(k)||s.slot===null&&pool.filter(x=>x.date===s.date).length>1)
   throw Error('Mehrdeutige Fachtermine am '+s.date+
    '. Bitte zuerst die betroffenen Stunden mit einem konkreten Block verknüpfen.');
  occupied.add(k);
 }
 let next=0;
 const result=wanted.map(unitId=>{
  const previous=byId.get(unitId);
  const assigned=previous.held?{
   date:date(previous.date),slot:asSlot(previous.slot),
   period:id(previous.period),timetableId:id(previous.timetableId)
  }:previous.skipped?{date:'',slot:null,period:'',timetableId:''}:
   pool[next++]||{date:'',slot:null,period:'',timetableId:''};
  return {id:unitId,title:id(previous.title),held:!!previous.held,
   skipped:!!previous.skipped,
   fromDate:date(previous.date),fromSlot:asSlot(previous.slot),
   date:assigned.date,slot:assigned.slot,
   period:assigned.period,timetableId:assigned.timetableId};
 });
 const changes=result.filter(x=>x.fromDate!==x.date||
  (x.date&&x.fromSlot!==x.slot));
 return {rows:result,changes,changed:changes.length,
  orderChanged:wanted.some((x,i)=>x!==ids[i])};
}
return {reorder,calculate,asSlot};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_SEQUENCE_DRAG_V311;
