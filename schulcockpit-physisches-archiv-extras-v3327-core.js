/* V0.33.27 – convenient keepsake reminders and upload constraints.
 * Pure, deterministic helpers; no real student information required.
 */
(function(root){
'use strict';
function str(x){return String(x??'').trim();}
function classGrade(course){
 const explicit=Number(course?.grade);
 if(Number.isInteger(explicit)&&explicit>=5&&explicit<=13)return explicit;
 const name=str(course?.name);
 const match=name.match(/(?:^|[\s\/_.-])(?:klasse|jg|jahrgang)?\s*(1[0-3]|[5-9])(?=[a-z]?(?:$|[\s\/_.-]))/i);
 return match?Number(match[1]):null;
}
function schoolYearStart(value){
 const start=Number(str(value).match(/^(\d{4})\s*\/\s*(\d{2,4})$/)?.[1]);
 return Number.isInteger(start)&&start>=2000&&start<2100?start:null;
}
function dateFromParts(year,month,day){
 const d=new Date(Date.UTC(year,month-1,day));
 return d.toISOString().slice(0,10);
}
function nextYearDate(today){
 const match=str(today).match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(!match)return '';
 const year=Number(match[1])+1,month=Number(match[2]),day=Number(match[3]);
 const d=new Date(Date.UTC(year,month-1,day));
 if(d.getUTCMonth()!==month-1)return dateFromParts(year,month,day-1);
 return dateFromParts(year,month,day);
}
function reminder(mode,course,schoolYear,today){
 const start=schoolYearStart(schoolYear);
 if(mode==='none')return {date:'',label:'Keine automatische Wiedervorlage'};
 if(mode==='custom')return {date:'',label:'Datum selbst auswählen'};
 if(mode==='year')return {date:nextYearDate(today),label:'In einem Jahr erinnern'};
 if(mode==='endSchoolYear'){
  if(!start)return {date:'',error:'Kein gültiges Schuljahr hinterlegt. Bitte ein Datum auswählen.'};
  return {date:dateFromParts(start+1,6,1),label:'Vor den Sommerferien erinnern'};
 }
 const target=mode==='end10'?10:mode==='end13'?13:null;
 if(target===null)return {date:'',error:'Bitte einen Erinnerungszeitpunkt auswählen.'};
 if(!course)return {date:'',error:'Bitte zunächst eine Klasse mit erkennbarem Jahrgang auswählen.'};
 const from=classGrade(course);
 if(from===null)return {date:'',error:'Der Jahrgang dieser Klasse ist nicht erkennbar. Wähle ein eigenes Datum.'};
 if(from>target)return {date:'',error:'Die Klasse ist bereits über Jahrgang '+target+'. Bitte ein eigenes Datum wählen.'};
 if(!start)return {date:'',error:'Das Schuljahr ist nicht bekannt. Bitte ein eigenes Datum wählen.'};
 // 1 June in the last year of target grade: deliberately before summer break,
 // not a claim about a precise holiday date or about graduation.
 return {date:dateFromParts(start+(target-from)+1,6,1),
  label:'Vor Ende von Jahrgang '+target+' erinnern'};
}
function classLabel(course,schoolYear){
 if(!course)return '';
 return ['Klasse '+str(course.name||course.grade||''),str(schoolYear)].filter(Boolean).join(' · ');
}
const FILE_EXT=/\.(?:pdf|docx?|pptx?|xlsx?|png|jpe?g|webp|gif|bmp|txt|md|csv|odt|ods|odp)$/i;
const MAX_BYTES=80*1024*1024;
function validFile(file){
 const name=str(file?.name),size=Number(file?.size);
 if(!name||!FILE_EXT.test(name))throw Error('Bitte PDF, Word, PowerPoint, Excel, Bild- oder Textdatei auswählen.');
 if(!Number.isFinite(size)||size<=0||size>MAX_BYTES)
  throw Error('Die Datei darf nicht leer oder größer als 80 MB sein.');
 return name;
}
const api={classGrade,schoolYearStart,reminder,classLabel,validFile};
root.SchulcockpitPhysicalArchiveExtrasV3327Core=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
