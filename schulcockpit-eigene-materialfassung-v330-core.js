/* V0.33.0 – explicit teacher choices are authoritative.
 * Pure read-only selectors. Existing originals, files and lesson schemas stay unchanged.
 */
const SC_TEACHER_MATERIAL_PRIORITY_V330=(function(){
'use strict';
const str=x=>String(x??'');
const key=s=>str(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
const distinct=a=>[...new Set((a||[]).map(str).filter(Boolean))];
function entries(lesson,materials=[]){
 if(!lesson?.worksheetChoicesV276)return [];
 const byId=new Map((materials||[]).map(m=>[m.id,m]));
 return Object.entries(lesson.worksheetChoicesV276).map(([choiceKey,choice])=>{
  if(!choice||!Array.isArray(choice.chosenNames)||!choice.chosenNames.length)return null;
  const bundle=lesson.resourceBundlesV176?.[choiceKey];
  const activeItems=(bundle?.items||[]).filter(x=>x?.materialId&&x?.variantId);
  const ownMaterials=distinct(activeItems.map(x=>x.materialId)).map(id=>byId.get(id)).filter(Boolean);
  const chosenSet=new Set(choice.chosenNames);
  const main=ownMaterials.find(m=>m.variants?.some(v=>chosenSet.has(v.fileName)))||ownMaterials[0];
  const variants=(main?.variants||[]).filter(v=>v.available!==false&&chosenSet.has(v.fileName));
  const sources=distinct([...(choice.originalNames||[]),
   ...(main?.evolutionV296?.sources||[]).flatMap(x=>x.names||[])]);
  const replacedHints=distinct([choice.hint,...(choice.extraHiddenHints||[])]);
  // Earlier V276 choices may know the replaced hint but not each original
  // filename. Keep that provenance visible instead of suggesting only one AB.
  const expected=replacedHints.length;
  if(sources.length<expected)for(const hint of [...replacedHints.slice(1),replacedHints[0]]){
   if(sources.length>=expected)break;
   if(!sources.some(name=>key(name)===key(hint)))sources.push(hint);
  }
  return {key:choiceKey,hint:choice.hint||bundle?.title||'Arbeitsblatt',
   title:main?.title||bundle?.title||choice.chosenNames[0],
   chosen:distinct(choice.chosenNames),variants,sources,replacedHints,
   merged:choice.improvementKindV296==='merged'||main?.evolutionV296?.kind==='merged',
   note:main?.evolutionV296?.note||'',materialId:main?.id||'',
   activeItems:activeItems.map(x=>({...x,material:byId.get(x.materialId)}))};
 }).filter(Boolean);
}
function primary(entry,hint){return !!entry&&key(hint)===key(entry.hint);}
function secondary(entries,hint){
 return (entries||[]).some(e=>!primary(e,hint)&&
  e.replacedHints.slice(1).some(h=>key(h)===key(hint)));
}
function effectiveRows(rows,entries,active=()=>true){
 const out=[];
 for(const r of rows||[]){
  if(!r||r.type==='ignore'||!active(r))continue;
  if(secondary(entries,r.hint))continue;
  const e=(entries||[]).find(x=>primary(x,r.hint));
  if(e){
   out.push({...r,title:e.title,teacherEditionV330:true,
    teacherFilesV330:e.chosen,teacherSourcesV330:e.sources});
  }else out.push(r);
 }
 return out;
}
function description(entry){
 if(!entry)return '';
 if(entry.merged)return 'Zusammengeführt aus '+entry.sources.length+
  (entry.sources.length===1?' früheren Datei':' früheren Dateien');
 return entry.sources.length?'Überarbeitet aus '+entry.sources.length+
  (entry.sources.length===1?' früheren Datei':' früheren Dateien'):'Eigene Fassung';
}
function promptRows(rows,entries,active=()=>true){
 const effective=effectiveRows(rows,entries,active);
 return effective.map(r=>{
  const e=(entries||[]).find(x=>primary(x,r.hint));
  if(!e)return r;
  return {...r,title:e.title,activeTeacherChoiceV330:e};
 });
}
function promptSection(old,rows,entries,format,active=()=>true){
 if(!entries?.length)return str(old);
 const updated=promptRows(rows,entries,active);
 const lines=updated.map(r=>{
  if(!r.activeTeacherChoiceV330)return format([r]);
  const e=r.activeTeacherChoiceV330;
  return '- [VERBINDLICH · EIGENE FASSUNG DER LEHRKRAFT] '+e.title+
   '\n  Verwende für diese Stunde ausschließlich: '+e.chosen.join(' · ')+
   (e.sources.length?'\n  Ersetzt die früheren Originale: '+e.sources.join(' · ')+
    ' (nicht zusätzlich bearbeiten oder drucken).':'');
 }).join('\n')||'- Keine aktiven Materialien ausgewählt.';
 const marker='## Verbindliche Materialauswahl – IST dieser Stunde, nicht historische Soll-Liste\n';
 const suffix='\n\nDie obige Liste ist die EINZIGE aktuelle Materialgrundlage.';
 const text=str(old),start=text.indexOf(marker);
 if(start>=0){
  const stop=text.indexOf(suffix,start+marker.length);
  if(stop>=0)return text.slice(0,start+marker.length)+lines+text.slice(stop);
 }
 const instruction='\n\n## Vorrang deiner Materialentscheidungen\n'+lines+
  '\nFalls ältere Materialhinweise davon abweichen, sind sie nur Herkunft/Archiv und dürfen keine zusätzlichen Aufgaben erzeugen.\n';
 const tag='Danach hänge GENAU EINEN maschinenlesbaren Block an:';
 const index=text.indexOf(tag);
 return index>=0?text.slice(0,index)+instruction+'\n'+text.slice(index):text+instruction;
}
return {entries,primary,secondary,effectiveRows,promptRows,promptSection,description,key};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_TEACHER_MATERIAL_PRIORITY_V330;
