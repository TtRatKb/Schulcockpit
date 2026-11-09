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
  throw Error('Die Reihenplanung hat sich verändert. Bitte erneut öffnen.');
 const byId=new Map(rows.map(x=>[id(x.id),x]));
 for(let i=0;i<ids.length;i++)if(rows[i].held&&ids[i]!==wanted[i])
  throw Error('Bereits gehaltene Stunden bleiben an ihrer ursprünglichen Position.');
 // Previously this pool was assigned to *every* non-held row, including rows
 // that did not have a scheduled date. When such a row moved toward the front,
 // a formerly dated hour received date="" and disappeared from the weekly UI.
 // An hour is either scheduled or unscheduled BEFORE dragging; reordering must
 // never silently change that category. Skipped rows keep all original fields.
 const slots=rows.filter(x=>!x.held&&!x.skipped&&date(x.date))
  .map((x,i)=>({date:date(x.date),slot:asSlot(x.slot),
   period:id(x.period),timetableId:id(x.timetableId),index:i}))
  .sort((a,b)=>a.date.localeCompare(b.date)||
   (a.slot??999)-(b.slot??999)||a.index-b.index);
 const occupied=new Set();
 for(const x of slots){
  const key=x.date+'|'+(x.slot===null?'?':x.slot);
  if(occupied.has(key)||x.slot===null&&slots.some(z=>z!==x&&z.date===x.date))
   throw Error('Doppelter oder uneindeutiger Fachtermin '+x.date+
    '. Bitte zuerst die mehrfach zugeordneten Sollstunden prüfen.');
  occupied.add(key);
 }
 let cursor=0;
 const result=wanted.map(unitId=>{
  const originalRow=byId.get(unitId);
  // A skipped unit is not an extra free slot. Its original date is not
  // erased merely because the teacher changes the list order.
  const immutable=!!originalRow.held||!!originalRow.skipped;
  const scheduled=!!date(originalRow.date);
  const next=immutable||!scheduled?{
   date:date(originalRow.date),slot:asSlot(originalRow.slot),
   period:id(originalRow.period),timetableId:id(originalRow.timetableId)
  }:slots[cursor++];
  if(!next||scheduled&&!immutable&&!next.date)
   throw Error('Stunden ohne Termin dürfen keinen vorhandenen Fachtermin verdrängen.');
  return {id:unitId,title:id(originalRow.title),held:!!originalRow.held,
   skipped:!!originalRow.skipped,scheduled:scheduled&&!originalRow.skipped,
   fromDate:date(originalRow.date),fromSlot:asSlot(originalRow.slot),
   date:next.date,slot:next.slot,period:next.period,timetableId:next.timetableId};
 });
 if(cursor!==slots.length)throw Error('Ein geplanter Fachtermin wurde nicht zugeteilt.');
 const origSlots=slots.map(x=>x.date+'|'+(x.slot??'?')).sort();
 const destSlots=result.filter(x=>x.scheduled&&!x.held).map(x=>x.date+'|'+(x.slot??'?')).sort();
 if(JSON.stringify(origSlots)!==JSON.stringify(destSlots))
  throw Error('Sicherheitsstopp: Die Fachtermine müssen vollständig erhalten bleiben.');
 const changes=result.filter(x=>x.fromDate!==x.date||
  (x.date&&x.fromSlot!==x.slot));
 return {rows:result,changes,changed:changes.length,
  orderChanged:wanted.some((x,i)=>x!==ids[i]),
  scheduledCount:slots.length,unscheduledCount:rows.filter(x=>!x.held&&!x.skipped&&!date(x.date)).length};
}
return {reorder,calculate,asSlot};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_SEQUENCE_DRAG_V311;
