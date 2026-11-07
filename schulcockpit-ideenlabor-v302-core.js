/* Schulcockpit V0.30.2 – tool shelf, discoverable activity ideas and
 * voluntarily documented lesson development. Pure data helpers.
 * No pupil data or remote requests. */
const SC_IDEAS_V302=(function(){
'use strict';
const SUBJECTS=[['math','Mathematik'],['religion','Religion']];
const TOOL_USES=[
 ['classroom','Im Unterricht mit Lernenden'],
 ['materials','Arbeitsblätter / Tests gestalten'],
 ['preparation','Unterricht vorbereiten'],
 ['organization','Organisation / Klassenführung']
];
const IDEA_KINDS=[
 ['hands-on','Handlungsorientiert / Experiment'],
 ['game','Spiel / Gamification'],
 ['digital','Digitale Erkundung / Simulation'],
 ['video','Video / Medienimpuls'],
 ['visual','Bild / Karikatur / Materialfund'],
 ['creative','Kreativer Auftrag / Projekt'],
 ['other','Sonstige Unterrichtsidee']
];
const STAGES=[
 ['none','Noch nicht überarbeitet'],
 ['idea','Idee für diese Stunde vorgemerkt'],
 ['redesigned','Stunde neu gestaltet'],
 ['tried','Im Unterricht erprobt']
];
const LABELS={math:'Mathematik',religion:'Religion'};
function baseTool(id,title,use,subjects,description,url=''){
 return {id:'starter:'+id,kind:'tool',title,category:use,subjects,
  grades:[],topics:[],lessonIds:[],materialId:'',sourceUrl:url,description,
  how:'',needs:'',setupMinutes:null,tested:false,privacy:'',archived:false,
  createdAt:'',updatedAt:'',starter:true};
}
function starters(){
 return [
  baseTool('test-paired','Test paired','materials',[],
   'Von dir zum Ausprobieren notiert: Aus Materialien Übungs- oder Testfragen erstellen. Funktionen und Datenschutz vor dem Einsatz prüfen.'),
  baseTool('algebra-tiles','Algebra Tiles','classroom',['math'],
   'Virtuelle Algebra-Plättchen zum Entdecken und Darstellen von Termen; konkrete Plattform noch nicht hinterlegt.'),
  baseTool('class-gauntlet','Class Gauntlet','classroom',[],
   'Als mögliche spielerische Anwendung vorgemerkt. Spielregeln, Fachbezug und Lerndatenschutz vor Nutzung prüfen.'),
  baseTool('math-figures','Math Figures','materials',['math'],
   'Generator für mathematische Zeichnungen, etwa Zahlenstrahlen und Koordinatensysteme.',
   'https://mathfigures.teacher.dev/'),
  baseTool('tap-tally','Tap and Tally','organization',[],
   'Als Tool zur Unterrichtsorganisation vorgemerkt. Vor dem Einsatz prüfen, welche Daten gespeichert werden.')
 ];
}
function lower(x){return String(x||'').normalize('NFKD')
 .replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss')
 .toLocaleLowerCase('de-DE').replace(/[^a-z0-9]+/g,' ').trim();}
function safeUrl(url){
 const value=String(url||'').trim();
 if(!value)return '';
 if(!/^https?:\/\/[^/\s?#]+(?::\d+)?(?:[/?#][^\s]*)?$/i.test(value))
  throw Error('Bitte einen vollständigen http(s)-Link verwenden.');
 const host=value.match(/^https?:\/\/([^/?#]+)/i)?.[1]||'';
 if(/(?:^|\.)(?:localhost|local|internal)$/i.test(host)||/^127\.|^0\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host))
  throw Error('Private und lokale Netzwerkadressen gehören nicht als Unterrichtslink in den Prompt.');
 return value.slice(0,1800);
}
function words(s){return lower(s).split(/\s+/).filter(w=>w.length>=4&&!['stunde','unterricht','thema','material','klasse','eine','einem','einen','machen','lernen','dieser'].includes(w));}
function strings(value,maxEntries=12,maxChars=70){
 const raw=Array.isArray(value)?value:String(value||'').split(/[,\n;]/);
 return [...new Set(raw.map(s=>String(s||'').trim().slice(0,maxChars)).filter(Boolean))].slice(0,maxEntries);
}
function normalize(raw){
 const x=raw||{},kind=x.kind==='tool'?'tool':'idea';
 const validCats=kind==='tool'?TOOL_USES:IDEA_KINDS;
 const subjects=Array.isArray(x.subjects)?x.subjects:[];
 return {
  id:String(x.id||'').slice(0,90),
  kind,title:String(x.title||'').trim().slice(0,140),
  category:validCats.some(([id])=>id===x.category)?x.category:validCats[0][0],
  subjects:[...new Set(subjects)].filter(s=>LABELS[s]),
  grades:[...new Set((x.grades||[]).map(Number).filter(n=>Number.isInteger(n)&&n>=5&&n<=13))],
  topics:strings(x.topics,15,90),
  lessonIds:strings(x.lessonIds,120,100),
  materialId:String(x.materialId||'').trim().slice(0,100),
  sourceUrl:safeUrl(x.sourceUrl),
  description:String(x.description||'').trim().slice(0,1200),
  how:String(x.how||'').trim().slice(0,1200),
  needs:String(x.needs||'').trim().slice(0,450),
  setupMinutes:x.setupMinutes===null||x.setupMinutes===undefined||x.setupMinutes===''?null:
   Math.max(0,Math.min(999,Math.round(Number(x.setupMinutes)||0))),
  privacy:String(x.privacy||'').trim().slice(0,300),
  tested:x.tested===true,archived:x.archived===true,
  createdAt:String(x.createdAt||''),updatedAt:String(x.updatedAt||''),starter:x.starter===true
 };
}
function validate(raw){
 const x=normalize(raw);
 if(x.title.length<2)throw Error('Bitte einen aussagekräftigen Titel eingeben.');
 if(x.kind==='idea'&&!x.description&&!x.how)
  throw Error('Beschreibe zumindest kurz, was die Lernenden dabei machen.');
 return x;
}
function courseSubject(course){
 const s=lower(course?.subject);
 return /mathe/.test(s)?'math':/religi/.test(s)?'religion':'';
}
function grade(course){
 const n=String(course?.name||'').match(/(?:^|[^\d])(1[0-3]|[5-9])(?=\D|$)/)?.[1];
 return n?Number(n):0;
}
function lessonTexts(l){
 return [l?.planReference?.title,l?.title,l?.planReference?.content,l?.unit]
  .filter(Boolean).map(lower);
}
function match(entry,l,course,seqTitle=''){
 if(!entry||!l||entry.archived)return 0;
 if(entry.lessonIds?.includes(l.id))return 100;
 const subj=courseSubject(course);
 if(entry.subjects.length&&(!subj||!entry.subjects.includes(subj)))return 0;
 const g=grade(course);
 if(entry.grades.length&&(!g||!entry.grades.includes(g)))return 0;
 const fields=[...lessonTexts(l),lower(seqTitle)],topics=entry.topics.map(lower).filter(Boolean);
 if(topics.length){
  let best=0;
  for(const t of topics){
   if(t.length<4)continue;
   if(fields.some(f=>f===t))best=Math.max(best,90);
   else if(fields.some(f=>f.includes(t)&&t.length>=6))best=Math.max(best,72);
   else{
    const ts=words(t);
    if(ts.length>=2&&fields.some(f=>ts.every(w=>f.split(' ').includes(w))))best=Math.max(best,62);
   }
  }
  return best;
 }
 // General tools can appear as fallbacks in the course's preparation flow.
 return entry.kind==='tool'&&entry.category==='classroom'?12:0;
}
function candidates(entries,l,course,seqTitle,limit=7){
 return (entries||[]).map(e=>({entry:e,score:match(e,l,course,seqTitle)}))
  .filter(x=>x.score>0).sort((a,b)=>b.score-a.score||Number(b.entry.tested)-Number(a.entry.tested)||
   xTitle(a.entry).localeCompare(xTitle(b.entry),'de')).slice(0,limit);
}
function xTitle(x){return String(x.title||'');}
function activeLesson(l){return !!l?.id&&!!l?.classId&&!l?.groupId&&l?.kind!=='group'&&l?.executionV180?.type!=='cancelled';}
function lessonState(l){
 const x=l?.innovationV302||{},raw=String(x.stage||'none');
 const stage=STAGES.some(z=>z[0]===raw)?raw:'none';
 return {stage,ideaIds:strings(x.ideaIds,40,90),
  note:String(x.note||'').slice(0,650),updatedAt:x.updatedAt||'',triedAt:x.triedAt||''};
}
function stats(lessons){
 const rows=(lessons||[]).filter(activeLesson),counts={total:rows.length,none:0,idea:0,redesigned:0,tried:0};
 rows.forEach(l=>{counts[lessonState(l).stage]++;});
 counts.evolved=counts.redesigned+counts.tried;
 return counts;
}
function prompt(lesson,entries,course,seqTitle=''){
 const state=lessonState(lesson),byId=new Map((entries||[]).map(e=>[e.id,e]));
 const picked=state.ideaIds.map(id=>byId.get(id)).filter(e=>e&&!e.archived);
 const relevant=candidates(entries,lesson,course,seqTitle,6)
  .filter(x=>!picked.some(e=>e.id===x.entry.id)&&x.score>=60).slice(0,3);
 if(!picked.length&&!relevant.length)return '';
 const format=(e,chosen)=>[
  '- '+e.title+(chosen?' [FÜR DIESE STUNDE VORGEMERKT]':' [PASSENDER IDEENPOOL, OPTIONAL]'),
  '  Art: '+(e.kind==='tool'?'Tool':'Unterrichtsidee')+
   '; '+((e.kind==='tool'?TOOL_USES:IDEA_KINDS).find(c=>c[0]===e.category)?.[1]||''),
  '  Idee: '+(e.description||'keine nähere Beschreibung'),
  e.how?'  Ablauf: '+e.how:'',
  e.needs?'  Benötigt: '+e.needs:'',
  e.setupMinutes!==null?'  Geschätzte Vorbereitung: '+e.setupMinutes+' Min.':'',
  e.sourceUrl?'  Quellenlink (vor Nutzung prüfen): '+e.sourceUrl:'',
  e.materialId?'  Bestehendes Material im Schulcockpit-Hub (vor Nutzung Dateizugriff prüfen): ID '+e.materialId:'',
  e.privacy?'  Datenschutz-/Nutzungshinweis der Lehrkraft: '+e.privacy:'',
  e.tested?'  Durch Lehrkraft bereits ausprobiert.':'  Noch nicht als ausprobiert bestätigt.'
 ].filter(Boolean).join('\n');
 return '\n\n## Gesammelte Unterrichtsideen und digitale Tools (freiwillige Unterrichtsentwicklung)\n'+
 'Der bestehende Sollplan und die bekannten Kernmaterialien bleiben Ausgangspunkt. '+
 'Prüfe, ob eine vorgemerkte Idee diese Unterrichtsstunde fachlich sinnvoll durch eine '+
 'Entdeckungs-, Spiel- oder handlungsorientierte Phase verbessern kann. '+
 'Wenn ja, entwickle eine konkrete, realistische ALTERNATIVE zum bloßen AB-Abarbeiten: '+
 'Lernziel, vorhandenes Vorwissen, 1–2 sinnvolle Arbeitsphasen, Sicherung, '+
 'Vorbereitungszeit, Geräte-/Materialbedarf, Differenzierung, Klassenführung und '+
 'Fallback ohne Technik. Wenn Aufwand/Nutzen nicht passt, begründe es kurz und behalte den bisherigen Aufbau. '+
 'Nie Linkinhalte erfinden oder behaupten, unbekannte Websites getestet zu haben. '+
 'Keine personenbezogenen Schülerdaten an externe Tools übermitteln. '+
 'Ein Link ist kein importierbares Folienbild, kein automatisch heruntergeladenes Arbeitsblatt und '+
 'keine bereits bereitgestellte Datei. Benenne nötige Vorbereitungsaufgaben explizit.\n'+
 (state.note?'\n### Frühere Erfahrung / Hinweis der Lehrkraft\n'+state.note+'\n':'')+
 (picked.length?'\n### Für diese Stunde bewusst vorgemerkt\n'+picked.map(e=>format(e,true)).join('\n'):'')+
 (relevant.length?'\n### Weitere passende Fundstücke\n'+relevant.map(x=>format(x.entry,false)).join('\n'):'')+
 '\nDidaktisches Prinzip: Nicht jede Stunde braucht ein Spiel; entscheidend ist der Lerngewinn, '+
 'nicht ein Gamification-Label. Wenn du die neue Idee einsetzt, beschreibe, welche traditionelle AB-Phase '+
 'ersetzt oder sinnvoll ergänzt wird und was aus der bisherigen Stunde erhalten bleiben soll.\n';
}
return {SUBJECTS,TOOL_USES,IDEA_KINDS,STAGES,starters,lower,safeUrl,
 normalize,validate,courseSubject,grade,lessonTexts,match,candidates,
 activeLesson,lessonState,stats,prompt};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_IDEAS_V302;