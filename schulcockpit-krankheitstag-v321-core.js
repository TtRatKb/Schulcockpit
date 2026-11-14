/* Schulcockpit V0.32.1 – reine Tagesauswahl und sichere Auftragsvorschläge.
 * Keine Schreiboperationen, keine Schülerdaten, keine erfundenen Buchseiten.
 */
(function(root){
'use strict';
const DATE=/^\d{4}-\d{2}-\d{2}$/;
function valid(date){
 if(!DATE.test(String(date||'')))return false;
 const d=new Date(date+'T12:00:00');
 return !Number.isNaN(d.getTime())&&d.getFullYear()===Number(date.slice(0,4))&&
   d.getMonth()+1===Number(date.slice(5,7))&&d.getDate()===Number(date.slice(8));
}
function weekday(date){return valid(date)?new Date(date+'T12:00:00').getDay():-1;}
function slot(l){
 if(l?.slot!==''&&l?.slot!==null&&l?.slot!==undefined&&Number.isFinite(Number(l.slot)))return Number(l.slot);
 const m=String(l?.period||'').match(/\b(\d+)\.?\s*(?:Stunde|Block)\b/i);
 return m?Number(m[1]):null;
}
function key(date,classId,n){return date+'|'+classId+'|'+n;}
function isCourse(l){return !!(l?.classId&&l.kind!=='group'&&!l.groupId);}
function isHeld(l){return l?.status==='done'||l?.executionV180?.type==='substitute';}
function isCanceled(l){return l?.executionV180?.type==='cancelled';}
function time(l){return Number(l?.duration)===90||Number(l?.minutes)===90?90:45;}
function bookText(l){
 const raw=String(l?.planReference?.material||'');
 const match=raw.match(/(?:\bS\.\s*\d+(?:\s*[-–]\s*\d+)?|\bSeite[n]?\s*\d+(?:\s*[-–]\s*\d+)?|\bBuch\s+(?:S\.\s*)?\d+)/i);
 return match?raw.slice(0,1300):'';
}
function proposed(l,files=[]){
 const available=(files||[]).filter(f=>f&&f.available&&f.fileKey&&!/\.(?:pptx?|mp4|mov)$/i.test(f.name||'')&&!/(?:lösung|loesung|solutions?|answer.?key)/i.test(f.name||''));
 const print=available.filter(f=>f.fromPrint),selected=print.length?print:available;
 const b=bookText(l);
 return {topic:String(l?.title&&!/^Thema noch festlegen$/i.test(l.title)?l.title:l?.planReference?.title||'').slice(0,200),
  minutes:time(l),instructions:selected.length?
    'Die Kinder bearbeiten die beigefügten Arbeitsblätter selbstständig in Einzelarbeit. Wer fertig ist, kann die Antworten mit einer Partnerin oder einem Partner vergleichen.':
    b?'Die Kinder bearbeiten die angegebenen Buchaufgaben selbstständig in Einzelarbeit. Wer fertig ist, kann die Antworten vergleichen.':'',
  materialNote:b,teacherNote:'Keine fachliche Einführung erforderlich. Die Kinder arbeiten selbstständig.',
  prepared:false,linkedFileKeysV319:selected.map(x=>x.fileKey),files:[]};
}
function normalizePlan(old,draft){
 if(!old||!Object.keys(old).length)return {...draft};
 return {...draft,...old,
  files:Array.isArray(old.files)?old.files:[],
  linkedFileKeysV319:Array.isArray(old.linkedFileKeysV319)?old.linkedFileKeysV319:[...draft.linkedFileKeysV319]};
}
function candidates(input={}){
 const date=input.date;
 if(!valid(date))return {date,eligible:[],excluded:[],error:'Bitte ein gültiges Datum auswählen.'};
 if([0,6].includes(weekday(date)))return {date,eligible:[],excluded:[],error:'Am Wochenende sind keine regulären Stunden vorgesehen.'};
 const classes=new Map((input.classes||[]).map(x=>[String(x.id),x]));
 const lessons=(input.lessons||[]).filter(l=>l?.date===date&&isCourse(l)&&slot(l)!==null);
 const group=new Map();
 const attach=(item,actual)=>{
  const n=slot(item),k=key(date,item.classId,n);
  if(!group.has(k))group.set(k,{date,classId:item.classId,slot:n,timetableId:item.timetableId||item.id||'',
   period:item.period||'',lessons:[],timetable:item});
  if(actual)group.get(k).lessons.push(item);
 };
 for(const l of lessons)attach(l,true);
 const day=weekday(date);
 for(const t of input.timetable||[]){
  if(!isCourse(t)||Number(t.weekday)!==day||slot(t)===null)continue;
  const k=key(date,t.classId,slot(t));
  if(!group.has(k))attach(t,false);
 }
 const examClasses=new Set((input.assessments||[]).filter(a=>a.classId&&a.date===date).map(a=>String(a.classId)));
 const participating=new Set((input.attendingClassIds||[]).map(String));
 const closed=new Set((input.closedClassIds||[]).map(String));
 const types=input.lessonTypes||{};
 const eligible=[],excluded=[];
 for(const [k,row] of group){
  const l=row.lessons[0]||null,c=classes.get(String(row.classId));
  let reason='';
  if(!c)reason='Fachkurs ist nicht mehr vorhanden';
  else if(row.lessons.length>1)reason='Mehrere Unterrichtskarten im selben Block – bitte einzeln prüfen';
  else if(participating.has(String(row.classId)))reason='Klasse nimmt an einer Exkursion teil';
  else if(closed.has(String(row.classId)))reason='Unterricht findet nicht statt';
  else if(l&&isCanceled(l))reason='Stunde ist ausgefallen';
  else if(l&&isHeld(l))reason='Stunde wurde bereits gehalten';
  else if(examClasses.has(String(row.classId))||l&&types[l.id]==='exam')reason='Klassenarbeit / Leistungsnachweis';
  else if(l&&types[l.id]==='excursion')reason='Exkursion';
  const entry={key:k,date,classId:row.classId,slot:row.slot,lessonId:l?.id||'',
   period:l?.period||row.period||'',timetableId:l?.timetableId||row.timetable?.id||'',
   course:[c?.subject||'',c?.name||''].filter(Boolean).join(' ').trim()||'Fachkurs',
   topic:(l?.title&&!/^Thema noch festlegen$/i.test(l.title)?l.title:l?.planReference?.title)||'Thema noch offen',
   fallback:!l,lesson:l,
   event:{date,classId:row.classId,slot:row.slot,timetableId:l?.timetableId||row.timetable?.id||'',
    period:l?.period||row.period||'',reason:'Krankheit / Abwesenheit'},
   reason};
  (reason?excluded:eligible).push(entry);
 }
 const sort=(a,b)=>a.slot-b.slot||a.course.localeCompare(b.course,'de');
 eligible.sort(sort);excluded.sort(sort);
 return {date,eligible,excluded,error:''};
}
const API={valid,weekday,slot,key,isCourse,isHeld,isCanceled,bookText,proposed,normalizePlan,candidates};
if(root)root.SchulcockpitSickDayCoreV321=API;
if(typeof module==='object'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:null);
