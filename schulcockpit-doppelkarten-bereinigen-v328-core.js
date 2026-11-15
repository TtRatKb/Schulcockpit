/* Schulcockpit V0.32.8 – explicit, reversible duplicate-card cleanup.
 * A physical teaching slot must retain at least one active card.
 * Never touch the sequence plan, shared materials or IndexedDB files.
 */
const SC_DUPLICATE_CLEANUP_V328=(function(){
'use strict';
const key=SC_WEEK_DUPLICATES_V315.slotKey;
function protectedHistory(l){
 return !!l&&(l.status==='done'||l.status==='cancelled'||!!l.heldAtV182||
  !!l.actualV270?.savedAt||!!l.reflectionV182?.completedAt||
  !!l.executionV180?.type);
}
function evaluate(state,id){
 const l=(state?.lessons||[]).find(x=>x.id===id);
 if(!l)return {allowed:false,reason:'Diese Stundenkarte existiert nicht mehr.',peers:[]};
 const physical=key(l);
 if(!physical)return {allowed:false,reason:'Der Unterrichtsblock lässt sich nicht eindeutig zuordnen.',lesson:l,peers:[]};
 const peers=(state.lessons||[]).filter(x=>x.id!==id&&key(x)===physical);
 if(!peers.length)return {allowed:false,reason:'Diese Karte ist die einzige Karte für den Fachtermin.',lesson:l,peers};
 if(protectedHistory(l))return {allowed:false,reason:'Gehaltener, ausgefallener oder bereits mit Ist-Daten dokumentierter Unterricht kann hier nicht entfernt werden.',lesson:l,peers};
 return {allowed:true,reason:'',lesson:l,peers};
}
function ensureTrash(state){
 if(!Array.isArray(state.duplicateCardTrashV328))state.duplicateCardTrashV328=[];
 return state.duplicateCardTrashV328;
}
function remove(state,id,now=new Date().toISOString()){
 const result=evaluate(state,id);
 if(!result.allowed)throw Error(result.reason);
 const trash=ensureTrash(state);
 if(trash.some(x=>x.lesson?.id===id))throw Error('Diese Karten-ID liegt bereits im Papierkorb.');
 const snapshot=structuredClone(result.lesson);
 trash.push({id,deletedAt:now,lesson:snapshot,slotKey:key(result.lesson)});
 state.lessons=state.lessons.filter(x=>x.id!==id);
 return {deletedId:id,remainingIds:result.peers.map(x=>x.id)};
}
function restore(state,id){
 const trash=ensureTrash(state);
 const index=trash.findIndex(x=>x.id===id);
 if(index<0)throw Error('Die entfernte Karte ist nicht im Papierkorb.');
 if((state.lessons||[]).some(x=>x.id===id))throw Error('Diese Karten-ID ist bereits aktiv. Wiederherstellen wurde abgebrochen.');
 const record=structuredClone(trash[index].lesson);
 if(!record?.id||record.id!==id)throw Error('Archivierte Stundenkarte ist beschädigt.');
 state.lessons.push(record);
 trash.splice(index,1);
 return record;
}
return {evaluate,remove,restore,protectedHistory};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_DUPLICATE_CLEANUP_V328;
