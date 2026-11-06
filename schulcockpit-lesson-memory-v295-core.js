/* V0.29.5 – historical teaching reflection lookup, pure and read-only. */
const SC_LESSON_MEMORY_V295=(function(){
'use strict';
function normalized(s){
 return String(s||'').toLocaleLowerCase('de-DE').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss')
  .replace(/\s*\([^)]*(?:aufgabe|std\.?|stunde|datum)[^)]*\)/ig,'')
  .replace(/[^a-z0-9]+/g,' ').trim();
}
function topic(l){return normalized(l?.planReference?.title||l?.title||'');}
function usable(t){
 return t.length>=8&&!['stundenbeginn','einstieg','wiederholung','klassenarbeit','test','abschluss','vorbereitung','einfuhrung','lernerfolgskontrolle'].includes(t);
}
function findings(current,lessons,courses,limit=3){
 if(!current?.classId||!current?.date)return [];
 const course=new Map((courses||[]).map(c=>[c.id,c]));
 const now=course.get(current.classId);
 const subject=normalized(now?.subject),grade=Number(String(now?.name||'').match(/\d+/)?.[0])||0;
 const target=topic(current);
 if(!usable(target))return [];
 return (lessons||[]).filter(l=>{
  if(l?.id===current.id||!l?.date||l.date>=current.date||
   l.executionV180?.type==='cancelled')return false;
  if(l.status!=='done'&&l.executionV180?.type!=='substitute')return false;
  const r=l.reflectionV182||{},legacy=l.reflection||{},actual=l.actualV270||{};
  if(!r.completedAt&&!r.note?.trim()&&!legacy.note?.trim()&&!actual.savedAt)return false;
  if(topic(l)!==target)return false;
  if(l.classId===current.classId)return true;
  const other=course.get(l.classId),otherGrade=Number(String(other?.name||'').match(/\d+/)?.[0])||0;
  return !!subject&&normalized(other?.subject)===subject&&grade>0&&grade===otherGrade;
 }).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,limit).map(l=>({
  id:l.id,date:l.date,title:l.title||l.planReference?.title||'',classId:l.classId,
  overall:l.reflectionV182?.overall||l.reflection?.mood||'',
  timing:l.reflectionV182?.timing||l.reflection?.timing||'',
  learning:l.reflectionV182?.learning||l.reflection?.learning||'',
  note:l.reflectionV182?.note||l.reflection?.note||'',
  materialIssues:l.reflectionV182?.materialIssues||{},
  lessonFlags:l.reflectionV182?.lessonFlags||[],
  pptFlags:l.reflectionV182?.pptFlags||[],
  actual:l.actualV270?.summary||''
 }));
}
return {normalized,topic,usable,findings};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_LESSON_MEMORY_V295;