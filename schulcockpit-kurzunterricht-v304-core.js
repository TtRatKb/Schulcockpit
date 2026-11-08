/* Schulcockpit V0.30.4 – independent, low-friction short-term teaching.
 * These entries are deliberately NOT permanent classes, timetable slots,
 * annual plans or normal lesson objects. No personal pupil data.
 */
const SC_QUICK_TEACH_V304=(function(){
'use strict';
const TYPES=[['cover','Einzelne Vertretungsstunde'],['temporary','Kurs für einige Wochen']];
const SUBJECTS=[['Mathematik','Mathematik'],['Religion','Religion'],['Sonstiges','Anderes Fach']];
function text(v,n=500){return String(v??'').trim().slice(0,n);}
function date(s){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))throw Error('Bitte ein gültiges Datum auswählen.');
 const d=new Date(s+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)
  throw Error('Ungültiges Unterrichtsdatum.');
 return s;
}
function addDays(day,num){
 const d=new Date(date(day)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+num);
 return d.toISOString().slice(0,10);
}
function group(raw){
 const x=raw||{},type=TYPES.some(t=>t[0]===x.type)?x.type:'temporary';
 const subject=SUBJECTS.some(s=>s[0]===x.subject)?x.subject:'Sonstiges';
 const title=text(x.title,120),grade=text(x.grade,50);
 if(title.length<3)throw Error('Gib dem Kurs einen kurzen Titel (mindestens drei Zeichen).');
 return {id:text(x.id,100),type,title,subject,grade,
  note:text(x.note,750),createdAt:text(x.createdAt,50),sessions:Array.isArray(x.sessions)?x.sessions:[]};
}
function session(raw){
 const x=raw||{};return {id:text(x.id,100),date:date(x.date),
  topic:text(x.topic,200),entry:text(x.entry,700),
  independent:text(x.independent,1100),end:text(x.end,700),
  material:text(x.material,550),note:text(x.note,850),
  done:x.done===true,reflection:text(x.reflection,650)};
}
function weekly(start,weeks,uid,topic=''){
 const n=Number(weeks);
 if(!Number.isInteger(n)||n<1||n>12)throw Error('Bitte 1–12 Wochen auswählen.');
 return Array.from({length:n},(_,i)=>session({id:uid(),date:addDays(start,i*7),topic}));
}
function addToGroup(base,newSessions){
 const seen=new Set((base.sessions||[]).map(x=>x.id));
 const sessions=[...(base.sessions||[])];
 for(const s of newSessions){const normalized=session(s);if(seen.has(normalized.id))throw Error('Doppelte Unterrichts-ID.');
  if(sessions.some(x=>x.date===normalized.date))throw Error('Für dieses Datum gibt es schon einen Eintrag. Ergänze ihn stattdessen.');
  seen.add(normalized.id);sessions.push(normalized);
 }
 return {...base,sessions:sessions.sort((a,b)=>a.date.localeCompare(b.date))};
}
function summary(groups){
 const all=(groups||[]).flatMap(g=>g.sessions||[]);
 return {groups:(groups||[]).length,lessons:all.length,done:all.filter(s=>s.done).length,
  open:all.filter(s=>!s.done).length};
}
function prompt(g,s,selectedIdeas=[]){
 const c=group(g),row=session(s);
 const ideas=(selectedIdeas||[]).filter(x=>x&&!x.archived).slice(0,4)
  .map(x=>'- '+text(x.title,120)+': '+text(x.description,550)+
   (x.sourceUrl?' (Quelle, noch zu prüfen: '+text(x.sourceUrl,700)+')':'')).join('\n');
 return '# Schulcockpit – kurze Unterrichtsplanung ohne Reihenplan\n\n'+
  '## Rahmen\nArt: '+(c.type==='cover'?'Einzelne Vertretungsstunde':'Zeitweise übernommener Kurs')+
  '\nFach: '+c.subject+'\nLerngruppe/Jahrgang: '+(c.grade||'nicht angegeben')+
  '\nDatum: '+row.date+'\nThema: '+(row.topic||'noch offen')+
  '\nHinweis der Lehrkraft: '+(c.note||'keiner')+
  '\n\n## Meine bisherige Mini-Planung\nEinstieg: '+(row.entry||'noch offen')+
  '\nSelbstständige Arbeit: '+(row.independent||'noch offen')+
  '\nAbschluss / Sicherung: '+(row.end||'noch offen')+
  '\nBenötigtes Material (freiwillig): '+(row.material||'keines')+
  '\nNotiz: '+(row.note||'keine')+
  (ideas?'\n\n## Freiwillig gespeicherte Unterrichtsideen\n'+ideas:'')+
  '\n\n## Auftrag\nHilf mir, daraus eine kurze, realistische Unterrichtsstunde zu machen. '+
  'Eine kurze Aktivierung und anschließend längere selbstständige Arbeit sind ausdrücklich erlaubt. '+
  'Nur nach Bedarf abwechslungsreichere Methoden, Hilfen, Arbeitsauftrag und eine kleine Sicherung vorschlagen. '+
  'KEINE vollständige Jahres-/Reihenplanung, kein Pflicht-PowerPoint, kein Materialpool, '+
  'keine erfundenen Kopien oder curricularen Kompetenzen. '+
  'Verwende die angegebenen Materialien nur soweit belegbar; fehlende Materialien als optional kennzeichnen. '+
  'Du darfst nach der Dauer fragen, falls sie wesentlich ist. Keine Schülernamen oder personenbezogene Daten verlangen. '+
  'Antworte als sofort umsetzbarer kurzer Verlaufsplan mit Einstiegsfrage, präzisem '+
  'Arbeitsauftrag und möglicher Sicherung; ein importierbarer JSON-Block ist nicht nötig.';
}
return {TYPES,SUBJECTS,text,date,addDays,group,session,weekly,addToGroup,summary,prompt};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_QUICK_TEACH_V304;