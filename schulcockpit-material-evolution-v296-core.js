/* V0.29.6 – pure, explicit provenance and variant-role validation. */
const SC_MATERIAL_EVOLUTION_V296=(function(){
'use strict';
const kinds=[
 ['cosmetic','Optisch schöner gestaltet','🎨'],
 ['merged','Mehrere Arbeitsblätter zusammengefasst','🧩'],
 ['revised','Inhaltlich verbessert / vereinfacht','🛠️'],
 ['original','Eigenes Material neu entwickelt','✨']
];
const efforts=[
 ['light','Kleine Überarbeitung'],
 ['medium','Mittlerer Aufwand'],
 ['high','Umfangreich selbst entwickelt']
];
const roles=[
 ['standard','Standardfassung'],
 ['support','Leichtere / Inklusionsfassung'],
 ['challenge','Forderfassung'],
 ['daz','Sprachsensible / DaZ-Fassung'],
 ['solution','Lösung / Erwartungshorizont']
];
function validate(files,choices){
 if(!Array.isArray(files)||!files.length)throw Error('Bitte mindestens eine Datei auswählen.');
 if(files.length>35)throw Error('Maximal 35 Dateien auf einmal.');
 if(!kinds.some(k=>k[0]===choices?.kind))throw Error('Bitte die Art deiner Weiterentwicklung auswählen.');
 if(!efforts.some(k=>k[0]===choices?.effort))throw Error('Bitte den selbst eingeschätzten Aufwand auswählen.');
 if(!Array.isArray(choices?.roles)||choices.roles.length!==files.length||
  choices.roles.some(r=>!roles.some(x=>x[0]===r))||!choices.roles.includes('standard'))
  throw Error('Jede Datei braucht eine gültige Rolle; mindestens eine muss Standard sein.');
 return true;
}
function guessRole(name,index){
 const raw=String(name||'').toLocaleLowerCase('de');
 const s=raw.normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
 if(/(?:^|[^a-z])(?:le|inkl|foerder|einfach|leicht|hilfe|basis)(?:[^a-z]|$)/.test(s)||/förder/.test(raw))
  return 'support';
 if(/loesung|losung|erwartungshorizont|muster/.test(s))return 'solution';
 if(/daz|sprache|sprachsensibel/.test(s))return 'daz';
 if(/knobel|forder|challenge|extra/.test(s))return 'challenge';
 return 'standard';
}
function badge(e){
 const h=e?.evolutionV296;
 if(!h||!kinds.some(k=>k[0]===h.kind))return null;
 const k=kinds.find(k=>k[0]===h.kind);
 return {label:k[2]+' '+k[1],effort:efforts.find(x=>x[0]===h.effort)?.[1]||'',
  variants:(e?.variants||[]).filter(v=>v.available!==false).map(v=>roles.find(r=>r[0]===v.type)?.[1]||v.type)};
}
function sourceRecords(material, catalog, inputKeys){
 const byKey=new Map([...(material||[]).map(m=>['m:'+m.id,{key:'m:'+m.id,name:m.title||'Material',materialId:m.id}]),
  ...(catalog||[]).map(c=>['c:'+c.catalogId,{key:'c:'+c.catalogId,name:c.fileName||'Datei',catalogId:c.catalogId}])]);
 return [...new Set(inputKeys||[])].map(k=>byKey.get(k)).filter(Boolean);
}
return {kinds,efforts,roles,validate,guessRole,badge,sourceRecords};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_MATERIAL_EVOLUTION_V296;