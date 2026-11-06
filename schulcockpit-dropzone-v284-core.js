/* Schulcockpit V0.28.4 – safe reusable file drop validation (no file reads/uploads). */
const SC_DROP_CORE_V284=(function(){
'use strict';
function accepted(file,accept){
 const terms=String(accept||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!terms.length)return true;
 const name=String(file?.name||'').toLowerCase(),mime=String(file?.type||'').toLowerCase();
 return terms.some(t=>{
  if(t.startsWith('.'))return name.endsWith(t);
  if(t.endsWith('/*'))return mime.startsWith(t.slice(0,-1));
  return !!mime&&mime===t;
 });
}
function check(files,accept,multiple=false,directory=false){
 const list=Array.from(files||[]);
 if(directory)return {ok:false,reason:'Ordner bitte über „Auswählen“ hinzufügen. Das Ablegen kompletter Ordner wird hier noch nicht unterstützt.'};
 if(!list.length)return {ok:false,reason:'Bitte eine Datei aus dem Finder hier ablegen.'};
 if(!multiple&&list.length>1)return {ok:false,reason:'Hier kann nur eine Datei auf einmal ausgewählt werden.'};
 const bad=list.find(file=>!accepted(file,accept));
 if(bad){
  const transfer=String(accept).toLowerCase().includes('.scbackup');
  return {ok:false,reason:transfer&&String(bad.name||'').toLowerCase().endsWith('.json')?
   'Das ist eine JSON-Sicherung der Planung, keine vollständige Browserumzugs-Sicherung. Bitte in Safari unter „Browserumzug“ eine neue verschlüsselte .scbackup-Datei erzeugen.' :
   'Dateityp nicht passend: '+String(bad.name||'Datei')+'. Erwartet: '+(accept||'ein anderes Dateiformat')+'.'};
 }
 return {ok:true,files:list};
}
return {accepted,check};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_DROP_CORE_V284;
