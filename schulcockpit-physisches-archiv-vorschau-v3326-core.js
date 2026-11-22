/* V0.33.26 – safe offline preview classification and text extraction for file picker.
 * Pure helpers; no persistent storage or network calls.
 */
(function(root){
'use strict';
function kind(name){
 const f=String(name||'').trim().toLowerCase();
 if(/\.pdf$/.test(f))return 'pdf';
 if(/\.(?:png|jpe?g|gif|webp|bmp)$/.test(f))return 'image';
 if(/\.(?:txt|md|csv|json|log)$/.test(f))return 'text';
 if(/\.docx$/.test(f))return 'docx';
 if(/\.pptx$/.test(f))return 'pptx';
 return 'unsupported';
}
function slideNames(names){
 return names.filter(name=>/^ppt\/slides\/slide[0-9]+\.xml$/.test(name))
  .sort((a,b)=>Number(a.match(/slide([0-9]+)\.xml$/)[1])-Number(b.match(/slide([0-9]+)\.xml$/)[1]));
}
function xmlPlainText(xml,namespace){
 if(typeof DOMParser==='undefined')throw Error('XML-Vorschau in diesem Browser nicht verfügbar.');
 const document=new DOMParser().parseFromString(String(xml||''),'application/xml');
 if(document.getElementsByTagName('parsererror').length)throw Error('Office-Datei konnte nicht gelesen werden.');
 const tags=namespace==='docx'?['p','t','tab','br']:['p','t','br'];
 const paragraphs=Array.from(document.getElementsByTagNameNS('*','p'));
 const lines=paragraphs.map(p=>{
  const pieces=[];
  const walk=(node)=>{
   for(const child of node.childNodes||[]){
    if(child.nodeType!==1){continue;}
    const n=child.localName||'';
    if(n==='t')pieces.push(child.textContent||'');
    else if(n==='tab')pieces.push('\t');
    else if(n==='br'||n==='cr')pieces.push('\n');
    else walk(child);
   }
  };
  walk(p);
  return pieces.join('').trim();
 }).filter(Boolean);
 if(lines.length)return lines.join('\n');
 // Some nonstandard producers omit paragraphs; still allow extracting visible text runs.
 return Array.from(document.getElementsByTagNameNS('*','t')).map(x=>x.textContent||'').filter(Boolean).join(' ');
}
function limitText(text,max=24000){
 const t=String(text||'');
 return {text:t.slice(0,max),truncated:t.length>max};
}
const api={kind,slideNames,xmlPlainText,limitText};
root.SchulcockpitPhysicalArchivePreviewV3326Core=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
