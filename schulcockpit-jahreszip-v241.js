/* Schulcockpit V0.24.1 – planning files split without silently skipping available originals.
   Pure grouping logic; actual teaching blobs remain in the local browser. */
(function(root){
'use strict';
const FILE_LIMIT=400;
const BYTE_LIMIT=140*1024*1024;
const MAX_SINGLE=480*1024*1024;
function splitFiles(files,opts={}){
  const maxFiles=opts.maxFiles||FILE_LIMIT,maxBytes=opts.maxBytes||BYTE_LIMIT,
    maxSingle=opts.maxSingle||MAX_SINGLE,coreBytes=opts.coreBytes||0;
  if(!Number.isFinite(maxFiles)||maxFiles<1||!Number.isFinite(maxBytes)||maxBytes<1)throw Error('Ungültiges Exportlimit.');
  if(coreBytes>=maxBytes)throw Error('Die Planungs-Metadaten überschreiten bereits das Paketlimit.');
  const parts=[{files:[],bytes:coreBytes,oversized:false}],paths=new Set();
  for(const f of files){
    if(!f?.path||!f.blob||!Number.isFinite(f.blob.size)||f.blob.size<0)throw Error('Ungültige Materialdatei im Export.');
    if(paths.has(f.path))throw Error('Doppelter Dateipfad im Jahresplanungs-ZIP: '+f.path);
    paths.add(f.path);
    if(f.blob.size>maxSingle)throw Error('Eine einzelne Datei überschreitet '+Math.round(maxSingle/1024/1024)+' MB: '+f.path+'. Bitte die Originaldatei gesondert prüfen.');
    let part=parts[parts.length-1];
    if(part.files.length>=maxFiles||part.bytes+f.blob.size>maxBytes){
      part={files:[],bytes:0,oversized:false};parts.push(part);
    }
    if(f.blob.size>maxBytes){
      // One source is too big for a standard 140 MB part; keep it intact.
      // It may require an individual manual upload due to platform limits.
      part.oversized=true;
    }
    part.files.push(f);part.bytes+=f.blob.size;
  }
  return parts;
}
function mapParts(parts){
 const known=new Map();
 parts.forEach((p,i)=>p.files.forEach(f=>known.set(f.path,i+1)));
 return known;
}
function baseName(s){return String(s||'Planung').replace(/[^A-Za-z0-9ÄÖÜäöüß_-]+/g,'_').slice(0,90);}
function partName(base,num,total){return baseName(base)+'_Teil_'+String(num).padStart(2,'0')+'_von_'+String(total).padStart(2,'0')+'.zip';}
const api={FILE_LIMIT,BYTE_LIMIT,MAX_SINGLE,splitFiles,mapParts,partName};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.SC_YEAR_PARTS_V241=api;
})(typeof globalThis!=='undefined'?globalThis:this);
