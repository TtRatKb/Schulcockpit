/* Schulcockpit V0.30.5 – worksheet reality log.
 * Printing, distributing and completing are three distinct events.
 * Preserve the original Sollplan and all material file records.
 */
const SC_WORKSHEET_ACTUAL_V305=(function(){
'use strict';
const STATES=[
 ['unknown','Noch nicht erfasst'],
 ['complete','Vollständig bearbeitet'],
 ['partial','Teilweise bearbeitet'],
 ['unused','Nicht ausgeteilt / nicht verwendet'],
 ['skipped','Bewusst weggelassen / nicht mehr nötig']
];
const FOLLOW=[
 ['undecided','Noch entscheiden'],
 ['continue','Ja, in der Folgestunde beenden / verwenden'],
 ['stop','Nein, nicht in der Folgestunde']
];
function normalize(s){return String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function idFor(e){return e.materialId&&e.variantId?'m:'+e.materialId+'|v:'+e.variantId:
 e.materialId?'m:'+e.materialId:'h:'+normalize(e.hint||e.title);}
function keyForResource(h){return normalize(h);}
function valid(status){return STATES.some(x=>x[0]===status)?status:'unknown';}
function tidy(value){
 const v=value||{},status=valid(v.status);
 const printed=['yes','no'].includes(v.printed)?v.printed:'unknown';
 return {status,printed,follow:['continue','stop','undecided'].includes(v.follow)?v.follow:
   ['complete','skipped'].includes(status)?'stop':'undecided',
   note:String(v.note||'').trim().slice(0,380),savedAt:v.savedAt||''};
}
function rows(resources=[],plans=[],extra=[]){
 const result=[],seen=new Set();
 const add=(e)=>{
  const id=idFor(e);if(!id||seen.has(id))return;
  seen.add(id);result.push({...e,id,hint:e.hint||e.title||'',title:e.title||e.hint||'Material',
   printable:e.printable!==false,printedFromPlan:!!e.printedFromPlan});
 };
 for(const r of resources){
  if(r?.active===false||!['print','reference'].includes(r.type))continue;
  const files=r.items||[];
  if(files.length)for(const b of files)add({
   hint:r.hint,materialId:b.materialId,variantId:b.variantId,
   title:b.fileName||b.title||r.hint,printable:r.type==='print',
   printedFromPlan:plans.some(p=>p.materialId===b.materialId&&p.variantId===b.variantId&&p.alreadyPrinted)
  });
  else add({hint:r.hint,title:r.title||r.hint,printable:r.type==='print',
   materialId:r.materialId||'',variantId:r.variantId||''});
 }
 for(const e of extra){
  if(!e||e.hidden)continue;
  add({hint:e.hint||e.title,title:e.title,materialId:e.materialId,variantId:e.variantId,
   printable:e.printable!==false,printedFromPlan:!!e.printedFromPlan});
 }
 return result;
}
function nextLesson(current,lessons){
 if(!current?.classId||!current.date)return null;
 return (lessons||[]).filter(l=>l?.id!==current.id&&l.classId===current.classId&&
  l.kind!=='group'&&!l.groupId&&l.executionV180?.type!=='cancelled'&&
  (l.date>current.date||(l.date===current.date&&Number(l.slot||0)>Number(current.slot||0))))
  .sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||
   Number(a.slot||0)-Number(b.slot||0))[0]||null;
}
function signatures(e){
 const set=new Set();if(e.id)set.add(e.id);
 if(e.materialId)set.add('m:'+e.materialId);
 if(e.hint)set.add('h:'+normalize(e.hint));
 if(e.title)set.add('h:'+normalize(e.title));
 return set;
}
function equals(a,b){
 // Two distinct inclusion/standard files of one material must never be
 // conflated just because their parent materialId matches.
 if(a?.materialId&&b?.materialId&&a.materialId===b.materialId&&
  a.variantId&&b.variantId)return a.variantId===b.variantId;
 if(a?.materialId&&b?.materialId)return a.materialId===b.materialId;
 const sa=signatures(a),sb=signatures(b);
 return [...sa].some(s=>sb.has(s)&&s.length>2);
}
function matches(a,b){
 return (a||[]).map(x=>({source:x,targets:(b||[]).filter(y=>equals(x,y))}))
   .filter(x=>x.targets.length);
}
function dueItems(previous,rowsNow){
 if(!previous)return [];
 const stored=previous.worksheetActualV305?.items||{};
 return matches((previous.worksheetActualV305?.snapshot||[]).filter(x=>stored[x.id]&&
  tidy(stored[x.id]).status!=='unknown'),rowsNow).map(({source,targets})=>{
  const record=tidy(stored[source.id]);
  return {source,target:targets[0],record,
   shouldRepeat:(record.status==='partial'||record.status==='unused')&&record.follow==='continue',
   shouldSuppress:record.status==='complete'||record.status==='skipped'||
    (['partial','unused'].includes(record.status)&&record.follow==='stop')};
 });
}
function refine(current,log,items){
 const next={...current,items:{...(current?.items||{})},
  snapshot:(items||[]).map(x=>({id:x.id,hint:x.hint,title:x.title,
   materialId:x.materialId||'',variantId:x.variantId||''}))};
 for(const x of items){
  next.items[x.id]=tidy(next.items[x.id]);
  if(next.items[x.id].status==='complete'||next.items[x.id].status==='skipped')
   next.items[x.id].follow='stop';
 }
 next.updatedAt=new Date().toISOString();return next;
}
function noteForPrompt(previous,rowsNow,allow=[]){
 const hits=dueItems(previous,rowsNow).filter(h=>!allow.includes(h.target.id));
 if(!hits.length)return '';
 return '\n\n## Tatsächlich bearbeitete Materialien aus der letzten Unterrichtsstunde\n'+
 hits.map(h=>'- '+h.source.title+' ('+previous.date+'): '+
 (h.record.status==='complete'?'vollständig bearbeitet – NICHT nochmal als neue Aufgabe einplanen.':
  h.record.status==='skipped'?'bewusst weggelassen / nicht mehr nötig – NICHT nochmal als neue Aufgabe einplanen.':
  h.record.status==='unused'&&h.record.follow==='stop'?
   'NICHT ausgeteilt; bewusst nicht mehr nötig – NICHT nochmal als neue Aufgabe einplanen.':
  h.record.status==='partial'&&h.record.follow==='stop'?
   'nur teilweise bearbeitet; die Lehrkraft möchte hier NICHT fortsetzen.':
  h.shouldRepeat?'nur teilweise oder noch nicht ausgeteilt – in dieser Stunde gezielt weiterführen.':
  'Einsatz war nicht abgeschlossen; ob es weitergeführt werden soll, ist noch offen.')+
 (h.record.note?' Lehrkraftnotiz: '+h.record.note:'')).join('\n')+
 '\nDer Sollplan und vorhandene Materialien bleiben erhalten, aber tatsächlicher Ist-Stand hat Vorrang. '+
 'Bei bewusst erneut gewünschter Wiederholung muss die Lehrkraft dies angeben. '+
 'Keine Doppel-Kopien aus bereits abgeschlossenem Unterricht veranlassen.\n';
}
return {STATES,FOLLOW,normalize,idFor,valid,tidy,rows,nextLesson,signatures,equals,matches,dueItems,refine,noteForPrompt};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_WORKSHEET_ACTUAL_V305;