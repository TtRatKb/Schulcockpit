/* V0.29.4 – pure material-triage decisions and cautious duplicate hints.
 * File bytes, assignments and existing catalog identity are never altered. */
const SC_MATERIAL_TRIAGE_V294=(function(){
'use strict';
const types=[
 ['arbeitsblatt','Arbeitsblatt','1'],
 ['hilfekarte','Hilfekarte','2'],
 ['klassenarbeit','Klassenarbeit / Test','3'],
 ['praesentation','Präsentation','4'],
 ['loesung','Lösung / EWH','5'],
 ['werkstatt','Stationen / Werkstatt','6'],
 ['quelle','Quelle / Infotext','7'],
 ['sonstiges','Sonstiges','8']
];
const uses=[
 ['core','Regulär / Kernmaterial','K'],
 ['supplement','Zusatzmaterial','Z'],
 ['teacher','Nur für Lehrkräfte','L'],
 ['archive','Archiv / derzeit nicht verwenden','A']
];
const validType=new Set(types.map(x=>x[0])),validUse=new Set(uses.map(x=>x[0]));
function fold(s){return String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de-DE').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();}
function extension(s){return (String(s||'').match(/\.([a-z0-9]{1,6})$/i)?.[1]||'').toLowerCase();}
function stem(s){return fold(String(s||'').replace(/\.[^.]+$/,''));}
function decision(entry){const h=entry?.hubV295||{};return {kind:entry?.hubV237?.kind||entry?.kind||'sonstiges',
 usage:validUse.has(h.usage)?h.usage:'',reviewed:!!h.reviewedAt};}
function validated(kind,usage){if(!validType.has(kind)||!validUse.has(usage))throw Error('Bitte Materialart und Verwendung auswählen.');return {kind,usage};}
function duplicates(all,entry){
 if(!entry)return [];
 const selectedName=entry.fileName||entry.title||'',base=stem(selectedName),ext=extension(selectedName),
  sha=entry.hubV237?.sha256||'',sub=entry.hubV237?.subject||entry.subject||'',
  grade=entry.hubV237?.grade||entry.grade||'';
 if(!sha&&base.length<9)return [];
 return all.filter(x=>{
  if(x===entry)return false;
  const name=x.fileName||x.title||'',
   sameScope=(x.hubV237?.subject||x.subject||'')===sub &&
    String(x.hubV237?.grade||x.grade||'')===String(grade);
  if(!sameScope)return false;
  const exact=!!sha&&sha===x.hubV237?.sha256;
  const otherExt=extension(name);
  const paired=base.length>=9&&base===stem(name)&&
   (['pdf','doc','docx'].includes(ext)&&['pdf','doc','docx'].includes(otherExt))&&ext!==otherExt;
  return exact||paired;
 }).map(x=>({key:x.catalogId?'c:'+x.catalogId:'m:'+x.id,
  name:x.fileName||x.title||'',reason:sha&&sha===x.hubV237?.sha256?'Identischer Datei-Hash':'Mögliches PDF-/Word-Paar'}));
}
function counters(entries){
 return {all:entries.length,done:entries.filter(x=>decision(x).reviewed).length,
  pending:entries.filter(x=>!decision(x).reviewed).length,
  supplementary:entries.filter(x=>decision(x).usage==='supplement').length};
}
return {types,uses,fold,extension,stem,decision,validated,duplicates,counters};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_MATERIAL_TRIAGE_V294;