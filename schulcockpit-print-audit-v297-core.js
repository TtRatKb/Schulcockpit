/* V0.29.7 – one authoritative print queue for the selected planning week.
 * Pure read-only audit: no print flags, material files or lesson history mutated.
 */
const SC_PRINT_AUDIT_V297=(function(){
'use strict';
function resolveJobs(lessons,lookup){
 const available=[],missing=[],excluded=[],seen=new Set();
 const safe=(l,p,reason)=>excluded.push({lessonId:l.id,materialId:p.materialId,variantId:p.variantId,reason});
 for(const l of lessons||[]){
  if(l.kind==='group'||l.groupId||l.executionV180?.type==='cancelled')continue;
  const resources=lookup.resources(l)||[];
  for(const p of l.printPlan||[]){
   if(!p.needed||!(Number(p.count)>0)||p.alreadyPrinted)continue;
   const id=[l.id,p.materialId,p.variantId].join('|');
   if(seen.has(id)){safe(l,p,'Doppelter Druckauftrag für dieselbe Datei und Stunde');continue;}
   seen.add(id);
   if(p._v183removed||p._v183obsolete){safe(l,p,'Material wurde entfernt oder ersetzt');continue;}
   const m=lookup.material(p.materialId),v=lookup.variant(p.materialId,p.variantId);
   if(!m||!v){safe(l,p,'Verknüpfte Materialfassung fehlt');continue;}
   if(v._v183obsolete){safe(l,p,'Alte Materialfassung ersetzt');continue;}
   const matched=resources.filter(r=>(r.bundleItemsV176||[])
     .some(x=>x.materialId===p.materialId&&x.variantId===p.variantId));
   if(matched.length&&!matched.some(r=>
      r.type==='print'&&!r.bundleV176?.deferred&&!r.bundleV176?.archivedV183&&
      lookup.isActive(l,r.hint))){
    safe(l,p,'Materialpaket ist ausgeblendet, verschoben oder kein Druckmaterial');continue;
   }
   if(!matched.length&&!(l.materials||[]).includes(p.materialId)){
    safe(l,p,'Druckauftrag gehört zu keinem aktiven Stundenmaterial');continue;
   }
   const count=Math.ceil(Number(p.count)||0);
   if(count<1||count>500){safe(l,p,'Kopiermenge nicht plausibel (1–500)');continue;}
   const row={lesson:l,cls:lookup.course(l.classId),material:m,variant:v,plan:p,
    fileReady:!!lookup.hasFile(v),copies:count};
   (row.fileReady?available:missing).push(row);
  }
 }
 return {available,missing,excluded,open:[...available,...missing]};
}
function uniqueNames(items){
 const used=new Set();
 return items.map((row,index)=>{
  const date=String(row.lesson.date||'Datum').replace(/[^0-9-]/g,'');
  const subj=String(row.cls?.subject||'Fach'),grade=String(row.cls?.name||'Kurs');
  const ext=(row.variant.fileName||'').match(/\.([^.]+)$/)?.[0]||'';
  let label=[String(row.copies).padStart(2,'0')+'x',subj,grade,row.material.title,row.variant.label].join('_');
  label=label.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').replace(/\s+/g,' ').slice(0,130);
  const dir=(row.plan.mode==='color'?'FARBE':'SW')+'/'+date+'_'
    +grade.replace(/[\\/:*?"<>|]/g,'-')+'/';
  let name=dir+label+ext,n=2;
  while(used.has(name)){name=dir+label+'_'+n+++ext;}
  used.add(name);
  return {row,name,index:index+1};
 });
}
return {resolveJobs,uniqueNames};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_PRINT_AUDIT_V297;