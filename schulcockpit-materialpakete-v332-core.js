/* V0.33.2 – One current teacher material package, explicit source coverage,
 * per-variant quantities and course-level print/digital delivery.
 * Pure helpers. Storage and original files are never changed by these selectors.
 */
const SC_MATERIAL_PACKAGES_V332=(function(){
'use strict';
const str=x=>String(x??'');
const key=s=>str(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
function digital(course,lesson){
 const override=lesson?.materialDeliveryV332;
 const courseSetting=course?.materialDeliveryV332;
 if(override==='digital'||override==='print')return override==='digital';
 if(courseSetting==='digital'||courseSetting==='print')return courseSetting==='digital';
 return !!course?.allIpadsV179;
}
function chosen(lesson){
 return Object.entries(lesson?.worksheetChoicesV276||{}).filter(([,c])=>
  c&&Array.isArray(c.chosenNames)&&c.chosenNames.length).map(([k,c])=>({key:k,...c}));
}
function coveredHints(lesson,materials=[]){
 const byId=new Map(materials.map(m=>[m.id,m]));
 const list=chosen(lesson).map(c=>{
  const b=lesson?.resourceBundlesV176?.[c.key];
  const matIds=uniq((b?.items||[]).map(i=>i.materialId));
  const primary=matIds.map(id=>byId.get(id)).find(m=>
   (m?.variants||[]).some(v=>(c.chosenNames||[]).includes(v.fileName)));
  const sources=(primary?.evolutionV296?.sources||[]).map(s=>s.hint).filter(Boolean);
  // Source metadata is documentation, not proof that user selected replacement;
  // only extraHiddenHints (user selected) and reviewed mapping may suppress.
  const extras=uniq([...(c.extraHiddenHints||[]),
   ...(c.reviewedHiddenHintsV332||[])].filter(h=>key(h)!==key(c.hint)));
  return {primary:c.hint,key:c.key,extras,
   sourceHints:uniq([c.hint,...sources]),materialId:primary?.id||'',
   originalIds:uniq((c.originalPairs||[]).map(x=>x.materialId)),
   chosenNames:[...c.chosenNames]};
 });
 return list;
}
function hidden(lesson,materials=[]){
 return new Set(coveredHints(lesson,materials).flatMap(c=>c.extras.map(key)));
}
function asVisible(lesson,materials,resource){
 if(!resource)return false;
 return !hidden(lesson,materials).has(key(resource.hint));
}
function lessonMaterialIds(lesson,materials){
 const ids=new Set(coveredHints(lesson,materials).map(x=>x.materialId).filter(Boolean));
 return ids;
}
function proposalForMerge(hints,primary){
 const set=uniq((hints||[]).map(str).filter(Boolean));
 if(!set.includes(primary))throw Error('Das Hauptarbeitsblatt muss Teil der Ersetzung sein.');
 if(set.length<1)throw Error('Mindestens eine Quelle auswählen.');
 return {primary,others:set.filter(h=>key(h)!==key(primary))};
}
function defaults(variants,students,existingPlans=[]){
 const n=Math.max(0,Math.min(500,Math.floor(Number(students)||0)));
 const std=(variants||[]).filter(v=>!['solution','teacher'].includes(v.type));
 const support=std.find(v=>v.type==='support'||v.type==='daz');
 const standard=std.find(v=>v.type==='standard')||std[0];
 const distribution={};
 for(const v of variants||[]){
  const old=existingPlans.find(p=>p.variantId===v.id);
  const explicit=!!old?.manualCountV332;
  if(explicit){distribution[v.id]=old.count||0;continue;}
  if(['solution','teacher'].includes(v.type)){distribution[v.id]=0;continue;}
  if(support&&standard&&support.id!==standard.id)
   distribution[v.id]=v.id===standard.id?Math.ceil(n*2/3):
    v.id===support.id?Math.floor(n/3):0;
  else distribution[v.id]=v.id===standard?.id?n:0;
 }
 return distribution;
}
function groupCount(students,groupSize){
 const n=Math.max(0,Math.floor(Number(students)||0)),g=Math.max(1,Math.floor(Number(groupSize)||4));
 return Math.ceil(n/g);
}
function desiredCopies({numbers,variants,delivery='print'}){
 const out={},errs=[];
 for(const v of variants||[]){
  const n=Number(numbers?.[v.id]||0);
  if(!Number.isInteger(n)||n<0||n>500)errs.push((v.fileName||v.id)+': 0–500 Kopien erforderlich');
  if(v.type==='solution'&&n>0)errs.push((v.fileName||v.id)+': Lösung ist kein Klassensatz');
  out[v.id]=delivery==='digital'?0:n;
 }
 return {counts:out,errors:errs};
}
function excludeReason(l,p,course,materials=[],rows=[]){
 if(digital(course,l))return 'Dieser Kurs verwendet digitale Materialien – keine Kopien erforderlich';
 const used=coveredHints(l,materials);
 const ownIds=new Set(used.map(c=>c.materialId).filter(Boolean));
 if(ownIds.has(p.materialId))return '';
 if(used.some(c=>c.originalIds.includes(p.materialId)))
  return 'Ursprüngliche Hauptdatei durch eigene Fassung ersetzt';
 const removedKeys=new Set(used.flatMap(c=>c.extras.map(key)));
 for(const r of rows||[]){
  if(!removedKeys.has(key(r.hint)))continue;
  const ids=(r.bundleItemsV176||[]).map(x=>x.materialId);
  if(r.material?.id)ids.push(r.material.id);
  const b=Object.entries(l.resourceBundlesV176||{}).find(([id])=>
   key(id)===key(r.hint))?.[1];
  if(b)ids.push(...(b.items||[]).map(x=>x.materialId));
  if(ids.includes(p.materialId))
   return 'Früheres Arbeitsblatt ist durch das eigene gemeinsame Material ersetzt';
 }
 return '';
}
return {key,chosen,coveredHints,hidden,asVisible,lessonMaterialIds,
 proposalForMerge,defaults,groupCount,desiredCopies,digital,excludeReason};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_MATERIAL_PACKAGES_V332;
