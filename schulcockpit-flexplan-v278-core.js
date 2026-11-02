/* Schulcockpit V0.27.8: timetable-based hour movement.
   Only actually completed/cancelled lessons and assessment slots are historical anchors.
   A prepared future lesson is ALWAYS movable together with its materials. */
const SC_HOURLY_V278=(function(){
'use strict';
const slotId=s=>String(s.date)+'|'+Number(s.slot)+'|'+String(s.timetableId||'');
const order=(a,b)=>a.date.localeCompare(b.date)||Number(a.slot)-Number(b.slot)||String(a.timetableId||'').localeCompare(String(b.timetableId||''));
function plan(input){
 const {slots=[],units=[],sourceKey,targetId='',action='insert',today='',blockedIds=[]}=input||{};
 const timetable=[...slots].filter(s=>s.date>=today).sort(order);
 const positions=new Map(timetable.map((s,i)=>[slotId(s),i]));
 if(positions.size!==timetable.length)throw Error('Der Stundenplan enthält doppelte Fachtermine.');
 const byKey=new Map(units.map(u=>[u.key,u]));
 const source=byKey.get(sourceKey);
 if(!source)throw Error('Die gewählte Soll-Stunde fehlt in der Reihenplanung.');
 const blocked=new Set(blockedIds),occupied=new Map(),warnings=[];
 const sourceCanMove=action==='insert'||action==='replace'||action==='continue';
 const unitOrder=[...units].sort((a,b)=>Number(!!b.linked)-Number(!!a.linked));
 for(const u of unitOrder){
  if(!u.date||u.date<today||sourceCanMove&&u.key===sourceKey)continue;
  const matching=timetable.map((s,i)=>({s,i})).filter(x=>x.s.date===u.date&&(!u.slot||Number(u.slot)===Number(x.s.slot)));
  const pick=matching.find(x=>!occupied.has(x.i));
  if(!pick){
   warnings.push('Bereits doppelt oder außerhalb des Fachplans: '+u.title+' ('+u.date+').');
   continue;
  }
  occupied.set(pick.i,u);
 }
 const sourceIndex=source.date>=today?timetable.findIndex(s=>s.date===source.date&&(!source.slot||Number(s.slot)===Number(source.slot))):-1;
 const onTargetIndex=positions.get(targetId);
 const moves=[],parked=[];
 if(action==='park'){
  if(source.held)throw Error('Eine tatsächlich gehaltene Stunde bleibt im Ist-Verlauf.');
  moves.push({key:sourceKey,from:source.date||'',to:'',fromSlot:source.slot||0});
  return {moves,parked,warnings,action};
 }
 if(onTargetIndex===undefined)throw Error('Bitte einen regulären zukünftigen Fachtermin auswählen.');
 const target=timetable[onTargetIndex];
 if(blocked.has(targetId))throw Error('Dieser Fachtermin wurde bereits durchgeführt oder liegt nicht für die Neuplanung frei.');
 const onTarget=occupied.get(onTargetIndex);
 if(action==='carry_inline'){
  return {moves,parked,warnings,action,inline:{sourceKey,targetId,topicKey:onTarget?.key||null,targetDate:target.date,targetSlot:target.slot,timetableId:target.timetableId||''}};
 }
 const historical=!!source.held; // A past unheld Soll-Stunde can be moved; the original Ist card stays historical.
 const duplicate=action==='continue'||historical;
 const virtualKey=duplicate?'NEW:'+sourceKey:sourceKey;
 if(action==='swap'){
  if(historical)throw Error('Gehaltene bzw. vergangene Stunden können nicht aus der Historie getauscht werden.');
  if(sourceIndex<0)throw Error('Die Ausgangsstunde hat keinen zukünftigen Termin. Bitte Einfügen wählen.');
  if(!onTarget||onTarget.key===sourceKey)return {moves,parked,warnings,action,unchanged:true};
  if(onTarget.held)throw Error('Die Zielstunde wurde tatsächlich bereits gehalten.');
  const from=timetable[sourceIndex];
  if(blocked.has(slotId(from)))throw Error('Die Ausgangsstunde wurde tatsächlich bereits gehalten.');
  moves.push({key:sourceKey,from:source.date,to:target.date,toSlot:target.slot,timetableId:target.timetableId||''});
  moves.push({key:onTarget.key,from:onTarget.date,to:from.date,toSlot:from.slot,timetableId:from.timetableId||''});
  return {moves,parked,warnings,action};
 }
 if(action==='replace'){
  if(onTarget&&onTarget.key!==sourceKey){
   if(onTarget.held)throw Error('Die Zielstunde wurde tatsächlich bereits gehalten.');
   parked.push({key:onTarget.key,from:onTarget.date,fromSlot:onTarget.slot||0,title:onTarget.title});
  }
  if(!onTarget&&sourceIndex===onTargetIndex&&!duplicate)return {moves,parked,warnings,action,unchanged:true};
  moves.push({key:virtualKey,from:duplicate?'':source.date||'',to:target.date,toSlot:target.slot,timetableId:target.timetableId||'',repeatOf:duplicate?sourceKey:null});
  return {moves,parked,warnings,action};
 }
 if(action!=='insert'&&action!=='continue')throw Error('Unbekannte Stundenaktion.');
 const queue=[{...source,key:virtualKey,from:duplicate?'':source.date||'',repeatOf:duplicate?sourceKey:null}];
 for(let i=onTargetIndex;i<timetable.length;i++){
  const u=occupied.get(i);
  if(!u||u.key===sourceKey||u.held)continue;
  queue.push(u);
 }
 const allowed=[];
 for(let i=onTargetIndex;i<timetable.length;i++){
  if(blocked.has(slotId(timetable[i])))continue;
  const u=occupied.get(i);
  if(u?.held)continue;
  allowed.push(timetable[i]);
 }
 if(queue.length>allowed.length)throw Error('Bis zum Schuljahresende sind nicht genügend Fachtermine frei. Keine Änderung gespeichert.');
 for(let i=0;i<queue.length;i++){
  const u=queue[i],s=allowed[i];
  if(u.date===s.date&&Number(u.slot)>0&&Number(u.slot)===Number(s.slot)&&!u.repeatOf)continue;
  moves.push({key:u.key,from:u.from??u.date??'',to:s.date,toSlot:s.slot,timetableId:s.timetableId||'',repeatOf:u.repeatOf||null});
 }
 return {moves,parked,warnings,action};
}
return {plan,slotId};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_HOURLY_V278;
