/* Schulcockpit V0.27.2 – pure, conservative single-course lesson insertion.
   One lesson is explicitly chosen; subsequent unprepared lessons move forward
   only as far as the next free eligible timetable slot. Does NOT alter exams. */
const SC_LESSON_SWITCH_V272=(function(){
'use strict';
const key=(q,u)=>q+'|'+u;
const order=(a,b)=>a.date.localeCompare(b.date)||a.slot-b.slot||String(a.timetableId||'').localeCompare(String(b.timetableId||''));
function plan({units,slots,sourceKey,targetIndex,today,protectedKeys=[],blockedSlots=[],mode='cascade'}){
 if(!Array.isArray(units)||!Array.isArray(slots))throw Error('Unvollständige Fachtermine.');
 const all=slots.map((s,i)=>({...s,slot:Number(s.slot),index:i})).sort(order);
 if(all.some((x,i)=>x.index!==i))throw Error('Fachtermine müssen in zeitlicher Reihenfolge vorliegen.');
 const target=all[targetIndex],source=units.find(u=>u.key===sourceKey);
 if(!source)throw Error('Die ausgewählte Soll-Stunde existiert nicht mehr.');
 if(!target||!target.date||target.date<today)throw Error('Bitte einen noch bevorstehenden Fachtermin wählen.');
 const locked=new Set(protectedKeys),blocked=new Set(blockedSlots);
 if(locked.has(sourceKey))throw Error('Diese Soll-Stunde ist bereits gehalten oder ausgearbeitet und kann nicht automatisch versetzt werden.');
 if(source.date===target.date&&Number(source.slot||0)===target.slot)
   return {moves:[],target:all[targetIndex],sourceKey,unchanged:true};
 if(mode==='single'){
   if(blocked.has(targetIndex))throw Error('Die gewünschte Zielstunde ist bereits gehalten oder konkret vorbereitet. Diese Stunde wird nicht überschrieben.');
   const onTarget=units.filter(u=>u.key!==sourceKey&&u.date===target.date&&
      (!u.slot||Number(u.slot)===target.slot));
   if(onTarget.length>1)throw Error('Auf dem Zieltermin liegen mehrere Soll-Themen. Bitte die doppelte Planung zuerst einzeln prüfen.');
   const occupying=onTarget[0]||null;
   if(occupying&&locked.has(occupying.key))
     throw Error('Das Zielthema „'+(occupying.title||occupying.key)+'“ ist bereits geschützt. Bitte einen anderen Termin wählen.');
   if(!['single','cascade'].includes(mode))throw Error('Unbekannte Verschiebeart.');
   return {
     moves:[{key:source.key,title:source.title||'Soll-Stunde',from:source.date||'',
       to:target.date,toSlot:target.slot,timetableId:target.timetableId||'',first:true}],
     parked:occupying?[{key:occupying.key,title:occupying.title||'Soll-Stunde',from:occupying.date||''}]:[],
     sourceKey,target,unchanged:false,warnings:[]
   };
 }
 if(mode!=='cascade')throw Error('Unbekannte Verschiebeart.');
 const perDate=new Map();
 for(const s of all){
   if(!perDate.has(s.date))perDate.set(s.date,[]);
   perDate.get(s.date).push(s.index);
 }
 const occupancy=new Map(), unlocated=[],placed=new Set();
 // Earlier dates are historical. Only scheduled future lessons from target
 // onwards can be displaced. Multiple periods on a day get distinct slots.
 for(const u of units){
   if(u.key===sourceKey||!u.date||u.date<target.date)continue;
   const indices=perDate.get(u.date)||[];
   let found=indices.find(i=>!placed.has(i)&&Number(u.slot||0)===all[i].slot);
   if(found===undefined&&!u.slot)found=indices.find(i=>!placed.has(i));
   if(found===undefined){unlocated.push(u);continue;}
   occupancy.set(found,u);placed.add(found);
 }
 // Existing duplicate/out-of-calendar records remain untouched. They must
 // be shown as warnings instead of blocking an otherwise safe specific move.
 const moves=[],from=new Map(),sourceAt=units.find(u=>u.key===sourceKey);
 let carry=sourceAt;
 for(let i=targetIndex;i<all.length;i++){
   const s=all[i],taken=occupancy.get(i);
   if(blocked.has(i)){
     if(i===targetIndex)throw Error('Die Zielstunde ist bereits gehalten, vorbereitet oder manuell festgelegt.');
     if(taken)throw Error('Eine bereits geschützte Stunde würde verschoben: '+(taken.title||taken.key)+'. Bitte einen anderen Termin wählen.');
     continue;
   }
   if(taken&&locked.has(taken.key))
     throw Error('„'+(taken.title||taken.key)+'“ ist bereits vorbereitet oder gehalten. Verschieben würde diese Stunde verändern.');
   moves.push({key:carry.key,title:carry.title||'Soll-Stunde',from:carry.date||'',to:s.date,
     toSlot:s.slot,timetableId:s.timetableId||'',first:carry.key===sourceKey});
   if(taken)carry=taken;
   else{carry=null;break;}
 }
 if(carry)throw Error('Kein weiterer freier Fachtermin im Schuljahr. Es wurde nichts verändert.');
 const seen=new Set();
 for(const m of moves){if(seen.has(m.key))throw Error('Ein Soll-Thema würde mehrfach verschoben.');seen.add(m.key);}
 return {moves,target,sourceKey,unchanged:false,
   warnings:unlocated.map(u=>'Nicht zugeordneter Soll-Termin bleibt unverändert: '+(u.title||u.key)+' ('+u.date+')')};
}
return {key,plan};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_LESSON_SWITCH_V272;
