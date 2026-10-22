/* Schulcockpit V0.24.6 – ZIP filenames originally stored as UTF-8 but decoded as CP437.
   Matching is non-destructive: never rewrite catalog IDs, archive names or source paths. */
(function(root){
'use strict';
const HIGH='ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
const byteFor=new Map(Array.from(HIGH,(ch,i)=>[ch,128+i]));
function repairPart(part){
  const input=String(part||'');
  if(!/[\u2500-\u257f]/u.test(input))return input.normalize('NFC');
  const bytes=[];
  for(const ch of input){
    const code=ch.codePointAt(0);
    if(code<=127)bytes.push(code);
    else if(byteFor.has(ch))bytes.push(byteFor.get(ch));
    else return input.normalize('NFC');
  }
  try{return decodeURIComponent(bytes.map(byte=>'%'+byte.toString(16).padStart(2,'0')).join('')).normalize('NFC');}
  catch(_){return input.normalize('NFC');}
}
function restoredPath(path){
  return String(path||'').replace(/\\/g,'/').split('/').map(repairPart).join('/');
}
const legacy=root.zipEntryForCatalogV17;
const norm=root.catalogNormV17;
if(typeof legacy!=='function'||typeof norm!=='function')return;
root.zipEntryForCatalogV17=function(zip,e){
  if(!zip||!zip.files||!e)return null;
  const wanted=restoredPath(e.sourcePath||'');
  if(wanted){
    const exact=Object.keys(zip.files).filter(path=>!zip.files[path].dir&&norm(restoredPath(path))===norm(wanted));
    if(exact.length===1)return zip.files[exact[0]];
    if(exact.length>1)return null; // Never auto-select an ambiguous original.
    if(wanted!==String(e.sourcePath||''))return null; // No fuzzy match after decoding.
  }
  return legacy(zip,e);
};
root.SC_ZIP_NAMES_V246={restoredPath,repairPart};
})(typeof window!=='undefined'?window:globalThis);
