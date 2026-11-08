/* V0.30.7 – temporary lessons overlay real weeks without editing the
 * teacher's permanent timetable or creating permanent class records.
 * All functions pure, compatible with saved V304 short-plan groups.
 */
const SC_TEMP_COURSE_V307=(function(){
'use strict';
const WEEKDAYS=['','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
const pad=n=>String(n).padStart(2,'0');
function date(value,required=true){
 const s=String(value||'').trim();
 if(!s&&!required)return '';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Bitte ein gültiges Start- oder Enddatum auswählen.');
 const d=new Date(s+'T12:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw Error('Ungültiges Datum.');
 return s;
}
function plusDay(s,n){
 const d=new Date(date(s)+'T12:00:00Z');
 d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);
}
function weekday(s){const d=new Date(date(s)+'T12:00:00Z').getUTCDay();return d===0?7:d;}
function text(v,max=500){return String(v??'').trim().slice(0,max);}
function slot(raw){
 const d=Number(raw?.weekday),p=Number(raw?.slot);
 if(!Number.isInteger(d)||d<1||d>5||!Number.isInteger(p)||p<0||p>25)
  throw Error('Wochentag und Block der Vertretung müssen gültig sein.');
 return {weekday:d,slot:p};
}
function slots(rows){
 const seen=new Set(),out=[];
 for(const row of rows||[]){
  const s=slot(row),key=s.weekday+'|'+s.slot;
  if(seen.has(key))continue;
  seen.add(key);out.push(s);
 }
 if(!out.length)throw Error('Bitte mindestens einen Unterrichtstermin pro Woche auswählen.');
 if(out.length>15)throw Error('Mehr als 15 Blöcke je Woche sind nicht vorgesehen.');
 return out.sort((a,b)=>a.weekday-b.weekday||a.slot-b.slot);
}
function config(raw){
 const x=raw||{},startDate=date(x.startDate),endDate=date(x.endDate,false),
  examDate=date(x.examDate,false);
 if(endDate&&endDate<startDate)throw Error('Das Enddatum darf nicht vor dem Startdatum liegen.');
 if(endDate&&endDate>plusDay(startDate,365))throw Error('Länger als ein Jahr? Bitte den Zeitraum abschnittsweise verlängern.');
 if(examDate&&examDate<startDate)throw Error('Der Klausurtermin liegt vor dem Beginn der Übernahme.');
 if(examDate&&endDate&&examDate>endDate)throw Error('Der Klausurtermin liegt nach der Übernahme.');
 return {startDate,endDate,slots:slots(x.slots),
  examDate,examTitle:text(x.examTitle||'Klassenarbeit / Klausur',160),
  topic:text(x.topic,450),
  workMode:text(x.workMode||'Kurzer Einstieg, anschließend selbstständige Aufgabenbearbeitung.',700),
  note:text(x.note,900),
  courseMaterials:uniqueRefs(x.courseMaterials||[])};
}
function uniqueRefs(refs){return [...new Set((refs||[]).map(x=>text(x,130)).filter(x=>/^[mc]:[A-Za-z0-9_.:-]+$/.test(x)))].slice(0,160);}
function plannedDates(settings,from,to,skip){
 const start=settings.startDate,end=settings.endDate||to;
 if(!start||!from||!to||end<from||start>to)return [];
 const first=start>from?start:from,last=end<to?end:to;
 const keys=new Set(settings.slots.map(x=>x.weekday+'|'+x.slot)),items=[];
 for(let d=first;d<=last;d=plusDay(d,1)){
  if(skip?.(d))continue;
  const day=weekday(d);
  for(const slot of settings.slots.filter(x=>x.weekday===day)){
   if(keys.has(day+'|'+slot.slot))
    items.push({date:d,weekday:day,slot:slot.slot,
     exam:settings.examDate===d,examTitle:settings.examTitle});
  }
 }
 return items;
}
function courseId(id){return 'temporary-v307:'+text(id,100);}
function lessonId(id,d,slot){return 'temp-v307:'+text(id,100)+':'+date(d)+':'+Number(slot);}
function metadata(g){
 return {id:courseId(g.id),name:text(g.grade||g.title,80),subject:text(g.subject,80),
  color:'#9675b7',students:0,temporaryV307:true};
}
function draftLesson(g,one,period=''){
 const cfg=g.temporaryV307;
 return {id:lessonId(g.id,one.date,one.slot),classId:courseId(g.id),
  quickGroupIdV307:g.id,quickSlotV307:one.weekday+'|'+one.slot,
  source:'manual',temporaryV307:true,kind:'course',
  date:one.date,slot:one.slot,period:period||'Block '+(one.slot+1),
  title:one.exam?cfg.examTitle:(cfg.topic||'Selbstständig arbeiten'),
  objective:cfg.workMode||'',status:'open',
  planReference:{title:one.exam?cfg.examTitle:cfg.topic,material:''},
  quickExamV307:!!one.exam,quickExamTitleV307:one.exam?cfg.examTitle:'',
  sequenceId:'',unit:'',materials:[],printPlan:[],plannedSteps:[],
  completedSteps:[],phasePlan:[],slides:[],prepTasks:[],
  presentationNotRequiredV177:true};
}
function applySlots(g,range,skip,periodFor){
 const settings=config(g.temporaryV307),
  dates=plannedDates(settings,range.start,range.end,skip);
 return dates.map(s=>({spec:s,id:lessonId(g.id,s.date,s.slot),
  record:draftLesson({...g,temporaryV307:settings},s,periodFor?.(s.slot))}));
}
function currentDateSpan(start,weeks=4){
 const d=date(start);
 return {start:d,end:plusDay(d,weeks*7-1)};
}
function coursePrompt(g,lessons,materials,range){
 const cfg=config(g.temporaryV307),period=range||currentDateSpan(cfg.startDate,4),
  slotsText=cfg.slots.map(x=>WEEKDAYS[x.weekday]+' · Block '+(x.slot+1)).join('; ');
 const ls=(lessons||[]).filter(x=>x.date>=period.start&&x.date<=period.end&&
  x.classId===courseId(g.id)).sort((a,b)=>a.date.localeCompare(b.date)||a.slot-b.slot);
 const mats=(materials||[]).filter(x=>cfg.courseMaterials.includes(x.ref));
 return '# Schulcockpit – befristete Unterrichtsübernahme\n\n'+
  '## Kurs\n'+g.subject+' '+(g.grade||'')+' · '+g.title+
  '\nBeginn: '+cfg.startDate+
  '\nEnde: '+(cfg.endDate||'noch offen / bis auf Weiteres')+
  '\nRegelmäßiger Rhythmus: '+slotsText+
  '\nPlanungshorizont: '+period.start+' bis '+period.end+
  '\nThema: '+(cfg.topic||'noch nicht genauer festgelegt')+
  '\nUnterrichtsauftrag: '+cfg.workMode+
  '\nWeitere Vorgaben der Lehrkraft: '+(cfg.note||'keine')+
  '\nKlausurtermin: '+(cfg.examDate?cfg.examDate+' – '+cfg.examTitle:'nicht eingetragen')+
  '\n\n## Bereits zugeordnete oder geplante Stunden im Zeitraum\n'+
  (ls.length?ls.map(l=>'- '+l.date+' · Block '+(Number(l.slot)+1)+': '+
    (l.quickExamV307?'KLASSENARBEIT/KLAUSUR':l.title||'noch offen')+
    (l.objective?'; Auftrag: '+l.objective:'')+
    (l.materials?.length?'; Material-IDs: '+l.materials.join(', '):'')).join('\n'):'- Noch keine Stunden konkretisiert.')+
  '\n\n## Vorhandener Materialpool (Dateien sind nur lokal im Schulcockpit)\n'+
  (mats.length?mats.map(m=>'- '+m.name+' ['+m.ref+']'+(m.kind?' · '+m.kind:'')+
   (m.ready?' · Original lokal verfügbar':' · Original möglicherweise erst zu verbinden')).join('\n'):
   '- Noch keine Materialien ausgewählt.')+
  '\n\n## Auftrag an ChatGPT\n'+
  'Plane diese kurzfristige Übernahme für den angegebenen Zeitraum mit möglichst wenig Zusatzvorbereitung. '+
  'Ein kurzer Einstieg und überwiegend selbstständige Arbeit mit den bereits vorhandenen Aufgaben '+
  'sind ausdrücklich erwünscht; füge nur dann eine aufwendigere Methode hinzu, wenn sie einen echten Mehrwert hat. '+
  'Beachte unbedingt alle Wochentermine und den Klausurtermin; plane am Klausurtag keinen neuen normalen Stoff. '+
  'Keine verpflichtenden PowerPoints, Arbeitsblattneuerstellungen, künstlichen Kompetenztabellen oder komplexen Reihenpläne. '+
  'Kopiere vorhandene Materialnamen nicht zu angeblichen Textinhalten: Wenn Dateien nicht beigefügt sind, '+
  'kennst du deren Aufgaben NICHT. Bitte bei Bedarf um die Originale und erfinde keine Buchseiten oder Aufgaben. '+
  'Gib pro Termin lediglich Thema, kurzen Einstieg, selbstständigen Auftrag, kurze Sicherung, '+
  'benötigtes Material und ggf. eine sinnvolle Hausaufgabe an. Fehlende Informationen als offen markieren. '+
  'Erstelle zuerst eine kompakte Übersicht über die vier Wochen, nicht automatisch eine PPT oder einen JSON-Reihenimport. '+
  'Ermögliche eine spätere Verlängerung ohne Neubeginn.\n';
}
return {WEEKDAYS,date,plusDay,weekday,slot,slots,config,uniqueRefs,plannedDates,
 courseId,lessonId,metadata,draftLesson,applySlots,currentDateSpan,coursePrompt};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_TEMP_COURSE_V307;