/* V0.27.5 – pure course-wide hourly disposition.
 * Each change is previewed, never assumes an unverified lesson was taught.
 * Existing held lessons and protected future anchors cannot be silently moved. */
const SC_HOURLY_V275=(function(){
'use strict';
const id=s=>String(s.date)+'|'+Number(s.slot)+'|'+String(s.timetableId||'');
const sort=(a,b)=>a.date.localeCompare(b.date)||Number(a.slot)-Number(b.slot)||String(a.timetableId||'').localeCompare(String(b.timetableId||''));
function plan({slots,units,sourceKey,targetId='',action='insert',today,blockedIds=[],anchorKeys=[],allowPreparedSwap=false}){
 const timetable=[...slots].sort(sort).filter(s=>s.date>=today);
 const lookup=new Map(timetable.map((s,i)=>[id(s),i]));
 if(lookup.size!==timetable.length)throw Error('Der Stundenplan enthält doppelte Fachtermine.');
 const byKey=new Map(units.map(u=>[u.key,u]));
 const source=byKey.get(sourceKey);
 if(!source)throw Error('Die ausgewählte Unterrichtsstunde wurde nicht gefunden.');
 const blocked=new Set(blockedIds),anchors=new Set(anchorKeys);
 const occupied=new Map(),ambiguous=[];
 for(const u of units){
   if(!u.date||u.date<today||u.key===sourceKey&&action==='continue')continue;
   const possible=timetable.map((s,i)=>({s,i})).filter(x=>x.s.date===u.date);
   let match=possible.find(x=>Number(u.slot)>0&&x.s.slot===Number(u.slot));
   if(!match)match=possible.find(x=>!occupied.has(x.i));
   if(!match){ambiguous.push(u);continue;}
   if(occupied.has(match.i))ambiguous.push(u);
   else occupied.set(match.i,u);
 }
 const moves=[],parked=[],warnings=ambiguous.map(u=>'Ungeklärter älterer Soll-Eintrag: '+u.title+' ('+u.date+')');
 const sourceIndex=[...occupied].find(([,u])=>u.key===sourceKey)?.[0]??-1;
 const sourceLocked=anchors.has(sourceKey)||!!source.held;
 if(action==='park'){
   if(source.held)throw Error('Eine bereits gehaltene Stunde kann nicht rückwirkend aus der Historie entfernt werden. Du kannst ihren Rest stattdessen fortsetzen.');
   moves.push({key:sourceKey,from:source.date||'',to:'',fromSlot:source.slot||0});
   return {moves,parked,warnings,action};
 }
 const ti=lookup.get(targetId);
 if(ti===undefined)throw Error('Bitte einen kommenden regulären Fachtermin auswählen.');
 const target=timetable[ti];
 if(blocked.has(targetId))throw Error('Der gewählte Termin ist bereits gehalten oder ausdrücklich gesperrt. Bitte einen anderen Fachtermin wählen.');
 const onTarget=occupied.get(ti);
 const isNew=action==='continue'||sourceLocked;
 const virtualKey=isNew?'NEW:'+sourceKey:sourceKey;
 if(action==='swap'){
   if(isNew)throw Error('Eine gehaltene Stunde kann nicht getauscht werden. Wähle „Fortsetzen“ oder „Einfügen“.');
   if(sourceIndex<0)throw Error('Zum Tauschen benötigt die Ausgangsstunde einen zukünftigen Termin.');
   if(!onTarget||onTarget.key===sourceKey)return {moves:[],parked,warnings,action,unchanged:true};
   if(onTarget.held)throw Error('Die andere Stunde ist bereits gehalten und kann nicht getauscht werden.');
   const otherSlot=timetable[sourceIndex];
   if(blocked.has(id(otherSlot)))throw Error('Der Ausgangstermin ist geschützt.');
   moves.push({key:sourceKey,from:source.date,to:target.date,toSlot:target.slot,timetableId:target.timetableId||''});
   moves.push({key:onTarget.key,from:onTarget.date,to:otherSlot.date,toSlot:otherSlot.slot,timetableId:otherSlot.timetableId||''});
   return {moves,parked,warnings,action};
 }
 if(action==='replace'){
   if(onTarget&&onTarget.key!==sourceKey){
     if(onTarget.held||anchors.has(onTarget.key))throw Error('Das Zielthema ist geschützt. Wähle einen freien Termin oder ausdrücklich „Stunden tauschen“.');
     parked.push({key:onTarget.key,from:onTarget.date,fromSlot:onTarget.slot||0,title:onTarget.title});
   }
   if(sourceIndex===ti&&!isNew)return {moves:[],parked:[],warnings,unchanged:true,action};
   moves.push({key:virtualKey,from:isNew?'':source.date||'',to:target.date,toSlot:target.slot,timetableId:target.timetableId||'',repeatOf:isNew?sourceKey:null});
   return {moves,parked,warnings,action};
 }
 if(action!=='insert'&&action!=='continue')throw Error('Unbekannte Aktion.');
 if(onTarget?.held||onTarget&&anchors.has(onTarget.key))
   throw Error('Am Zieltermin liegt bereits eine geschützte Stunde. Wähle „Tauschen“ oder einen anderen Termin.');
 // Queue all following movable topics across *all* sequences in date order;
 // prepared future lessons are stationary unless explicitly swapped.
 const queue=[{...source,key:virtualKey,from:isNew?'':source.date,repeatOf:isNew?sourceKey:null}];
 for(let i=ti;i<timetable.length;i++){
   const item=occupied.get(i);
   if(!item||item.key===sourceKey)continue;
   if(item.held||anchors.has(item.key))continue;
   queue.push(item);
 }
 const allowed=[];
 for(let i=ti;i<timetable.length;i++){
   const slot=timetable[i],item=occupied.get(i);
   if(blocked.has(id(slot))||item&&(item.held||anchors.has(item.key)))continue;
   allowed.push(slot);
 }
 if(queue.length>allowed.length)throw Error('Es gibt nicht genügend freie Fachstunden bis zum Schuljahresende. Es wurde nichts geändert.');
 for(let i=0;i<queue.length;i++){
   const item=queue[i],s=allowed[i];
   if(item.date===s.date&&Number(item.slot)>0&&Number(item.slot)===Number(s.slot)&&!item.repeatOf)continue;
   moves.push({key:item.key,from:item.from??item.date??'',to:s.date,toSlot:s.slot,
     timetableId:s.timetableId||'',repeatOf:item.repeatOf||null});
 }
 return {moves,parked,warnings,action};
}
return {plan,slotId:id};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_HOURLY_V275;
