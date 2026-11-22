/* V0.33.27 – physical teaching materials, keepsakes and A–Z filing labels.
 * Pure helpers: no names, no files, no implicit changes to print plans.
 */
(function(root){
'use strict';
const TYPES=['copies','reusable','memory'];
const TEXT_MAX=600,MAX_QUANTITY=9999;
function str(x){return String(x??'').trim();}
function initial(){
 const locations=Array.from({length:26},(_,i)=>({
  id:'fach-'+String(i+1).padStart(2,'0'),
  name:String.fromCharCode(65+i),
  kind:'folder'
 }));
 return {schema:1,locations,entries:[]};
}
function ensure(doc){
 const clean=doc&&doc.schema===1&&Array.isArray(doc.entries)&&Array.isArray(doc.locations);
 return clean?doc:initial();
}
function location(doc,id){
 return ensure(doc).locations.find(l=>l.id===id)||null;
}
// The stable 'fach-01'..'fach-26' IDs are deliberately kept: existing
// inventory references must NOT move when the physical labels change to A–Z.
function locationLabel(item){
 if(!item)return '';
 const id=str(item.id),name=str(item.name);
 const match=id.match(/^fach-(0[1-9]|1\d|2[0-6])$/);
 if(match&&item.kind==='folder'){
  const number=Number(match[1]),letter=String.fromCharCode(64+number);
  // Old unedited labels F01–F26 remain compatible without a data migration.
  // Preserve any genuinely user-defined name that does not match defaults.
  if(name==='F'+String(number).padStart(2,'0')||name===letter||!name)return letter;
 }
 return name;
}
function checked(d,doc,existingId=''){
 const type=TYPES.includes(d.type)?d.type:'';
 const title=str(d.title);
 const locationId=str(d.locationId);
 const quantity=Number(d.quantity);
 const refKey=str(d.refKey);
 const reminderDate=str(d.reminderDate);
 if(!type)throw Error('Bitte Materialart auswählen.');
 if(!title||title.length>180)throw Error('Bitte eine Bezeichnung (maximal 180 Zeichen) angeben.');
 if(!location(doc,locationId))throw Error('Bitte einen vorhandenen Aufbewahrungsort auswählen.');
 if(!Number.isInteger(quantity)||quantity<0||quantity>MAX_QUANTITY)
   throw Error('Der Bestand muss eine ganze Zahl von 0 bis 9999 sein.');
 if(refKey&&!/^(m:[^:|]+:[^:|]+|c:[^:|]+)$/.test(refKey))
   throw Error('Ungültige Materialverknüpfung.');
 if(reminderDate&&!/^\d{4}-\d{2}-\d{2}$/.test(reminderDate))
   throw Error('Ungültiges Erinnerungsdatum.');
 if(reminderDate&&new Date(reminderDate+'T12:00:00').toISOString().slice(0,10)!==reminderDate)
   throw Error('Ungültiges Erinnerungsdatum.');
 return {
  id:existingId||str(d.id),type,title,locationId,refKey,
  quantity:type==='memory'?1:quantity,
  detail:str(d.detail).slice(0,150),
  note:str(d.note).slice(0,TEXT_MAX),
  cohort:str(d.cohort).slice(0,100),
  reminderDate,reminderLabel:str(d.reminderLabel).slice(0,120),
  classIdV3327:str(d.classIdV3327).slice(0,120),
  reminderModeV3327:str(d.reminderModeV3327).slice(0,40),
  archived:!!d.archived,
  updatedAt:str(d.updatedAt)
 };
}
function available(doc,materialId,variantId){
 const key='m:'+str(materialId)+':'+str(variantId);
 if(!materialId||!variantId)return 0;
 return ensure(doc).entries.reduce((n,e)=>n+
  (!e.archived&&e.type==='copies'&&e.refKey===key?Math.max(0,Number(e.quantity)||0):0),0);
}
function proposal(required,stock){
 const n=Math.max(0,Math.floor(Number(required)||0)),
       s=Math.max(0,Math.floor(Number(stock)||0)),
       fromArchive=Math.min(n,s);
 return {required:n,stock:s,fromArchive,toPrint:n-fromArchive};
}
function due(doc,today){
 const date=str(today);
 return ensure(doc).entries.filter(e=>!e.archived&&e.type==='memory'&&
  e.reminderDate&&e.reminderDate<=date).sort((a,b)=>
   a.reminderDate.localeCompare(b.reminderDate)||a.title.localeCompare(b.title,'de'));
}
function updateQuantity(doc,id,diff){
 const d=ensure(doc),entry=d.entries.find(e=>e.id===id&&!e.archived);
 if(!entry)throw Error('Archivgegenstand nicht gefunden.');
 if(entry.type==='memory')throw Error('Erinnerungsstücke werden nicht verbraucht.');
 const next=Number(entry.quantity)+Number(diff);
 if(!Number.isInteger(next)||next<0||next>MAX_QUANTITY)throw Error('Bestand darf nicht negativ werden.');
 return next;
}
function total(doc,type){
 return ensure(doc).entries.filter(e=>!e.archived&&(!type||e.type===type)).length;
}
const api={TYPES,initial,ensure,location,locationLabel,checked,available,proposal,due,updateQuantity,total};
root.SchulcockpitPhysicalArchiveV3323Core=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
