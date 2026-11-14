/* Schulcockpit V0.32.5 – independent year timetable: pure, no data mutation.
 * "Live" state.timetable is only replaced by separately confirmed activation.
 */
(function(root){
'use strict';
const YEAR=/^20\d{2}\/\d{2}$/;
const plain=x=>JSON.parse(JSON.stringify(x));
function validYear(y){return typeof y==='string'&&YEAR.test(y)&&Number(y.slice(5))===(Number(y.slice(0,4))+1)%100;}
function next(y){if(!validYear(y))return '';const n=Number(y.slice(0,4))+1;return n+'/'+String((n+1)%100).padStart(2,'0');}
function dateYear(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return '';const n=Number(date.slice(0,4))-(Number(date.slice(5,7))<8?1:0);return n+'/'+String((n+1)%100).padStart(2,'0');}
function seqYear(q,active){return q.schoolYearV190||dateYear(q.startDate||q.plan?.find(u=>u.plannedDate)?.plannedDate)||active;}
function targetCourses(state,y){
 const ids=new Set((state.sequences||[]).filter(q=>seqYear(q,state.settings?.schoolYear)===y).map(q=>q.classId));
 return (state.classes||[]).filter(c=>!!c.id&&!!c.subject&&(c.schoolYearV324===y||c.schoolYearV325===y||ids.has(c.id)));
}
function newDraft(state,y){
 const stored=state.schoolYearTimetablesV325?.[y]||{};
 return {year:y,periods:plain(stored.periods?.length?stored.periods:(state.settings?.periods||['GA / Tutorat','1. Block','2. Block','3. Block','4. Block'])),
  entries:plain(stored.entries||[]).filter(x=>x.kind!=='group'&&!x.groupId),
  newCourses:[]};
}
const clean=(x,max=120)=>String(x??'').trim().slice(0,max);
function targetKey(r){return Number(r.weekday)+'|'+Number(r.slot);}
function cellValid(r,periods){
 return Number.isInteger(Number(r.weekday))&&Number(r.weekday)>=1&&Number(r.weekday)<=5&&
  Number.isInteger(Number(r.slot))&&Number(r.slot)>=0&&Number(r.slot)<periods.length;
}
function check(state,draft,active){
 const errors=[],warnings=[],y=draft?.year;
 if(!validYear(y)||!(y>active))errors.push('Bitte ein zukünftiges Schuljahr auswählen.');
 const periods=Array.isArray(draft?.periods)?draft.periods:[];
 if(periods.length<1||periods.length>16)errors.push('Bitte 1 bis 16 Unterrichtsblöcke hinterlegen.');
 if(periods.some(x=>!clean(x,90)))errors.push('Jeder Block braucht eine kurze Bezeichnung.');
 const base=targetCourses(state,y),byId=new Map(base.map(x=>[x.id,x]));
 const newCourses=(draft?.newCourses||[]),fresh=new Map(),courseNames=new Set(base.map(c=>clean(c.subject).toLowerCase()+'|'+clean(c.name).toLowerCase()));
 for(const c of newCourses){
  const subject=clean(c.subject,100),name=clean(c.name,120),key=subject.toLocaleLowerCase('de')+'|'+name.toLocaleLowerCase('de');
  if(!c.key||!/^new:[A-Za-z0-9_-]{1,50}$/.test(c.key)||fresh.has(c.key))errors.push('Neue Kurskennung ungültig oder doppelt.');
  else fresh.set(c.key,{subject,name});
  if(!subject||!name)errors.push('Neue Fachkurse brauchen ein Fach und einen Namen.');
  if(courseNames.has(key))errors.push('Fachkurs bereits vorhanden: '+subject+' '+name);
  courseNames.add(key);
 }
 const entries=draft?.entries||[],seen=new Set(),counts=new Map();
 if(entries.length>100)errors.push('Bitte maximal 100 Unterrichtsfelder eintragen.');
 for(const row of entries){
  if(!cellValid(row,periods)){errors.push('Ungültiger Wochentag oder Block.');continue;}
  const key=targetKey(row);
  if(seen.has(key))errors.push('Doppelt belegter Stundenplanplatz: '+key);
  seen.add(key);
  const cid=String(row.classId||'');
  if(!byId.has(cid)&&!fresh.has(cid))errors.push('Unbekannter oder alter Fachkurs im neuen Stundenplan.');
  counts.set(cid,(counts.get(cid)||0)+1);
 }
 if(!entries.length)warnings.push('Der Stundenplan enthält noch keine Unterrichtsstunden.');
 for(const c of base)if(!counts.has(c.id))warnings.push('Noch ohne Wochenstunde: '+c.subject+' '+c.name);
 const ready=entries.length>0&&!errors.length;
 return {year:y,entriesCount:entries.length,activeYear:active,
  errors:[...new Set(errors)],warnings,ready,courses:base,newCourses:newCourses.length,
  courseHours:[...counts].map(([id,hours])=>({id,hours}))};
}
function suggest(state,draft,activeEntries){
 const y=draft.year,courses=targetCourses(state,y);
 const sourceSeq=new Map((state.sequences||[]).map(q=>[q.id,q]));
 const origins=new Map(),ambiguous=[];
 for(const c of courses){
  const found=new Set();
  if(c.originClassIdV324)found.add(c.originClassIdV324);
  for(const q of state.sequences||[]){
   if(q.classId!==c.id||seqYear(q,state.settings?.schoolYear)!==y||!q.originSequenceIdV324)continue;
   const old=sourceSeq.get(q.originSequenceIdV324);
   if(old)found.add(old.classId);
  }
  if(found.size===1)origins.set(c.id,[...found][0]);
  if(found.size>1)ambiguous.push(c.subject+' '+c.name);
 }
 const sourceToDest=new Map();
 for(const [dest,src] of origins){
  if(!sourceToDest.has(src))sourceToDest.set(src,[]);
  sourceToDest.get(src).push(dest);
 }
 const used=new Set(),mapped=[],conflicts=[];
 for(const row of activeEntries||[]){
  if(row.kind==='group'||row.groupId||!row.classId)continue;
  const to=sourceToDest.get(row.classId)||[];
  if(to.length!==1)continue;
  const c=courses.find(c=>c.id===to[0]);
  if(!c)continue;
  const cell=targetKey(row);
  if(used.has(cell)){conflicts.push(cell);continue;}
  used.add(cell);
  if(!cellValid(row,draft.periods)){conflicts.push(cell);continue;}
  mapped.push({weekday:Number(row.weekday),slot:Number(row.slot),classId:c.id,
   period:clean(draft.periods[Number(row.slot)],100),kind:'course'});
 }
 return {entries:mapped,ambiguous,conflicts,mappedCount:mapped.length};
}
function prepare(state,draft,uid){
 const checkResult=check(state,draft,state.settings?.schoolYear||'');
 if(checkResult.errors.length)throw Error(checkResult.errors.join('\n'));
 const classes=[...(state.classes||[])],created=[],ids=new Map();
 for(const c of draft.newCourses||[]){
  const id=uid('class');ids.set(c.key,id);
  const course={id,subject:clean(c.subject,100),name:clean(c.name,120),students:0,
   schoolYearV325:draft.year,color:'#806688',createdByV325:true};
  classes.push(course);created.push(course);
 }
 const previous=(state.schoolYearTimetablesV325?.[draft.year]?.entries||[]);
 const records=(draft.entries||[]).map(r=>{
  const cid=ids.get(r.classId)||r.classId;
  const old=previous.find(x=>x.classId===cid&&Number(x.weekday)===Number(r.weekday)&&Number(x.slot)===Number(r.slot));
  return {id:old?.id||uid('tt'),weekday:Number(r.weekday),slot:Number(r.slot),order:Number(r.slot),
   period:clean(draft.periods[Number(r.slot)],100),classId:cid,kind:'course'};
 }).sort((a,b)=>a.weekday-b.weekday||a.slot-b.slot);
 const timetables={...(state.schoolYearTimetablesV325||{}),
  [draft.year]:{entries:records,periods:plain(draft.periods),
    updatedAt:new Date().toISOString(),source:'manual-v325'}};
 return {classes,created,records,timetables,year:draft.year,stats:checkResult};
}
function schedule(year,records,cid,bounds,noSchool,exams=[]){
 if(!bounds?.start||!bounds?.end)return [];
 const tt=(records||[]).filter(r=>r.classId===cid&&r.kind!=='group'&&!r.groupId);
 if(!tt.length)return [];
 const blocked=new Set(exams||[]),out=[],
  first=new Date(bounds.start+'T12:00:00'),last=new Date(bounds.end+'T12:00:00');
 if(!Number.isFinite(first.getTime())||!Number.isFinite(last.getTime())||first>last)return [];
 let iterations=0;
 for(let d=new Date(first);d<=last&&iterations<400;d.setDate(d.getDate()+1),iterations++){
  const date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  if(blocked.has(date)||noSchool(date,cid))continue;
  const dow=d.getDay()||7;
  for(const t of tt)if(Number(t.weekday)===dow)
   out.push({date,slot:Number(t.slot),period:t.period,timetableId:t.id});
 }
 return out.sort((a,b)=>a.date.localeCompare(b.date)||a.slot-b.slot);
}
function monday(date){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()-((d.getDay()||7)-1));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function activation(state,target,bounds,today){
 const current=state.settings?.schoolYear||'';
 if(!validYear(target)||next(current)!==target)throw Error('Nur das unmittelbare Folgejahr lässt sich aktivieren.');
 if(today<bounds.start)throw Error('Das neue Schuljahr hat noch nicht begonnen. Die vorbereitete Planung bleibt separat verfügbar.');
 const future=state.schoolYearTimetablesV325?.[target];
 if(!future?.entries?.length)throw Error('Bitte zuerst den neuen Stundenplan speichern.');
 const verification=check(state,{year:target,periods:future.periods,entries:future.entries,newCourses:[]},current);
 if(verification.errors.length)throw Error(verification.errors.join('\n'));
 const archive={...(state.schoolYearTimetablesV325||{}),
  [current]:{entries:plain(state.timetable||[]),periods:plain(state.settings?.periods||[]),
    archivedAt:new Date().toISOString(),source:'active-before-switch'}};
 return {timetables:archive,timetable:plain(future.entries),periods:plain(future.periods),
  activeYear:target,planYear:target,week:monday(bounds.start)};
}
const api={validYear,next,dateYear,seqYear,targetCourses,newDraft,cellValid,check,suggest,prepare,schedule,activation,monday};
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.SchulcockpitFutureTimetableCoreV325=api;
})(typeof window!=='undefined'?window:null);