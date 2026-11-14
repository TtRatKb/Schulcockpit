/* Schulcockpit V0.32.6 – pure quality-backlog and privacy-safe revision briefing.
 * Reuses V182 reflection backlog, existing material versions and V302 ideas.
 * Does not score teachers, invent learning gains or modify old lesson resources.
 */
(function(root){
'use strict';
const CATEGORIES={lesson:'Stundenablauf',ppt:'Präsentation',material:'Arbeitsmaterial'};
const FOCI=[
 ['active','Mehr Schüleraktivität'],
 ['thinking','Kognitiv aktivieren'],
 ['cooperation','Kooperativ lernen'],
 ['differentiate','Differenzieren'],
 ['check','Lernstand sichtbar machen'],
 ['clarity','Klarheit & Sicherung']
];
const FLAG_LABELS={
 lesson:{
  too_dense:'Zu viel Inhalt',not_enough:'Zu wenig Inhalt',flow:'Ablauf unklar',
  motivation:'Motivation fehlte',play:'Spielerischer gestalten',
  hands_on:'Handlungsorientierter arbeiten',discussion:'Gespräch und Ergebnissicherung verbessern',
  differentiation:'Mehr Differenzierung',active_students:'Mehr Schüleraktivität',
  thinking:'Kognitiv aktivieren',check_learning:'Lernstand sichtbar machen'},
 ppt:{
  error:'Inhaltlicher Fehler',typo:'Schreibfehler',layout:'Layout/Lesbarkeit',
  too_much:'Zu viel Text',task:'Arbeitsauftrag unklar',image:'Passendes Bild fehlt',
  flow:'Folienfolge passt nicht'},
 material:{
  error:'Fehler im Material',hard:'Zu schwer',easy:'Zu leicht',support:'Leichtere Fassung fehlt',
  challenge:'Forder-Version fehlt',daz:'Sprachhilfe fehlt',space:'Mehr Schreibplatz',
  structure:'Unübersichtlich',task:'Aufgabe unklar',boring:'Nicht motivierend',
  quantity:'Mehr Aufgaben nötig',solution:'Lösung ergänzen',replace:'Neue Fassung gewünscht'}
};
const FOCUS_GUIDES={
 active:'Plane eine Phase, in der die Lernenden selbst etwas erarbeiten, entscheiden, erklären, darstellen oder überprüfen – nicht nur zuhören oder Aufgaben abschreiben.',
 thinking:'Erzeuge eine echte Denkherausforderung mit Begründen, Vergleichen, Fehlersuche oder Transfer. Die Herausforderung muss zum bisherigen Kenntnisstand passen.',
 cooperation:'Nutze eine kurze kooperative Aufgabe mit klarer Einzeldenkzeit, wechselseitiger Abhängigkeit und anschließender individueller Ergebnissicherung.',
 differentiate:'Biete einen gemeinsamen Kernauftrag mit gestuften Hilfen und sinnvoller Vertiefung, ohne die Lernenden dauerhaft in feste Leistungsgruppen einzuteilen.',
 check:'Schlage eine unaufwendige formative Überprüfung vor, bei der alle Lernenden eine sichtbare Antwort geben und ich daraus eine nächste Unterrichtsentscheidung ableiten kann.',
 clarity:'Vereinfache den Ablauf und die Aufgabenstellungen, kläre das Lernziel und plane eine kurze, überprüfbare Sicherung.'
};
const byId=(xs)=>new Map((xs||[]).filter(x=>x&&x.id).map(x=>[String(x.id),x]));
function stage(b){
 if(b?.kind&&CATEGORIES[b.kind])return b.kind;
 if(b?.materialId||b?.catalogId)return 'material';
 return 'lesson';
}
function issues(b){
 const kind=stage(b),known=FLAG_LABELS[kind]||{};
 const flags=Array.isArray(b?.flags)?b.flags:[];
 return [...new Set(flags.filter(x=>typeof x==='string'&&Object.prototype.hasOwnProperty.call(known,x)))]
   .map(x=>({flag:x,label:known[x]}));
}
function priority(b){
 const flags=issues(b).map(x=>x.flag);
 if(flags.some(x=>['error','replace','hard','daz','support'].includes(x)))return 2;
 if(flags.some(x=>['active_students','thinking','check_learning','differentiation',
  'hands_on','discussion','flow','task','motivation','too_dense'].includes(x)))return 1;
 return 0;
}
function grade(name){
 const m=String(name||'').match(/(?:^|[^\d])(1[0-3]|[5-9])(?=[a-zA-Z]|\b)/i);
 return m?m[1]:'';
}
function itemFor(b,maps,keys){
 const l=maps.lessons.get(String(b.lessonId)),m=maps.materials.get(String(b.materialId)),
   c=maps.classes.get(String(l?.classId||b.classId)),kind=stage(b);
 const variants=m?.variants||[];
 const preferred=l?.printPlan?.find(p=>p.needed&&p.materialId===m?.id&&
  variants.some(v=>v.id===p.variantId&&v.fileKey&&keys.has(v.fileKey)));
 let v=variants.find(x=>x.id===preferred?.variantId)||
   variants.find(x=>x.id===m?.primaryVariantIdV183&&x.fileKey&&keys.has(x.fileKey))||
   variants.find(x=>x.type==='standard'&&x.fileKey&&keys.has(x.fileKey))||
   variants.find(x=>x.fileKey&&keys.has(x.fileKey));
 let source={fileKey:'',name:'',kind:''};
 if(kind==='ppt'&&l){
  const k=l.presentationBlobKeyV180||'lesson-ppt-'+l.id;
  if(keys.has(k))source={fileKey:k,name:l.presentationFileName||'Unterricht.pptx',kind:'ppt'};
 }else if(v&&kind==='material'){
  source={fileKey:v.fileKey,name:v.fileName||m?.title||'Arbeitsblatt',kind:'material'};
 }
 return {id:String(b.id),kind,done:!!b.done,sourceDate:b.sourceDate||l?.date||'',
  lessonId:l?.id||b.lessonId||'',materialId:m?.id||b.materialId||'',
  title:String(b.title||m?.title||l?.title||'Überarbeitung'),detail:String(b.detail||''),
  subject:String(c?.subject||m?.hubV237?.subject||''),grade:grade(c?.name)||String(m?.hubV237?.grade||''),
  lessonTitle:String(l?.planReference?.title||l?.title||''),materialTitle:String(m?.title||b.materialTitle||''),
  issues:issues(b),priority:priority(b),source,hasOriginal:!!source.fileKey,
  hasLesson:!!l,hasMaterial:!!m,
  isReflection:b.type==='reflectionV182'};
}
function collect(state,storedKeys=[]){
 const maps={lessons:byId(state.lessons),materials:byId(state.materials),
  classes:byId(state.classes)},keys=new Set(storedKeys);
 return (state.backlog||[]).filter(b=>b&&b.id).map(b=>itemFor(b,maps,keys));
}
function summarize(items){
 const xs=items||[],open=xs.filter(x=>!x.done);
 return {all:xs.length,open:open.length,done:xs.length-open.length,
  lesson:open.filter(x=>x.kind==='lesson').length,ppt:open.filter(x=>x.kind==='ppt').length,
  material:open.filter(x=>x.kind==='material').length,
  withSource:open.filter(x=>x.hasOriginal).length};
}
function filter(items,opts={}){
 const status=opts.status||'open',kind=opts.kind||'all',subject=opts.subject||'all';
 return (items||[]).filter(x=>(status==='all'||(status==='done'?x.done:!x.done))&&
  (kind==='all'||x.kind===kind)&&(subject==='all'||x.subject===subject))
 .sort((a,b)=>Number(a.done)-Number(b.done)||b.priority-a.priority||
  b.sourceDate.localeCompare(a.sourceDate)||a.title.localeCompare(b.title,'de'));
}
function focusFor(item){
 const flags=item.issues.map(x=>x.flag);
 if(flags.some(x=>['hard','support','challenge','daz','differentiation'].includes(x)))return 'differentiate';
 if(flags.some(x=>['active_students','hands_on','play','motivation','boring'].includes(x)))return 'active';
 if(flags.some(x=>['thinking','too_dense'].includes(x)))return 'thinking';
 if(flags.some(x=>['check_learning','discussion'].includes(x)))return 'check';
 return 'clarity';
}
function brief(item,focus='active'){
 if(!item)throw Error('Keine Aufgabe ausgewählt.');
 if(!Object.prototype.hasOwnProperty.call(FOCUS_GUIDES,focus))throw Error('Unbekannter Verbesserungsfokus.');
 const issues=item.issues.map(x=>'- '+x.label);
 const note=issues.length?issues.join('\n'):'- Keine strukturierten Problemmarkierungen vorhanden. Bitte zuerst nach dem konkreten Verbesserungsbedarf fragen.';
 const title=(item.lessonTitle||item.title).slice(0,300);
 return [
 '# Schulcockpit · Unterricht gezielt weiterentwickeln',
 '',
 '## Bekannter Rahmen (vor dem Teilen bitte auf personenbezogene Angaben prüfen)',
 '- Fach: '+(item.subject||'nicht angegeben'),
 '- Jahrgang: '+(item.grade||'nicht angegeben'),
 '- Stundenthema: '+(title||'nicht angegeben'),
 '- Überarbeitungsbereich: '+CATEGORIES[item.kind],
 '- Bestehendes Material: '+(item.materialTitle||item.source.name||'noch nicht benannt'),
 '',
 '## Dokumentierte, strukturierte Beobachtungen',
 note,
 '',
 '## Didaktischer Schwerpunkt',
 FOCUS_GUIDES[focus],
 '',
 '## Dein Auftrag',
 '1. Bewahre, was fachlich und methodisch bereits funktioniert. Verändere nur die markierten Schwächen.',
 '2. Entwickle höchstens drei umsetzbare Varianten: eine mit maximal 5 Minuten Zusatzvorbereitung, eine stärker schüleraktive Alternative und gegebenenfalls eine differenzierte Variante.',
 '3. Gib für jede Variante an: genaues Lernziel, konkrete Handlung der Lernenden, Arbeitsauftrag, Zeitbedarf, benötigte Materialien, Differenzierung und kurze Ergebnissicherung.',
 '4. Sorge für echte kognitive Aktivierung und erkennbare Beteiligung möglichst vieler Lernender. Digitale Tools nur dort, wo sie didaktisch einen Vorteil haben.',
 '5. Prüfe Fachrichtigkeit und Altersangemessenheit; kennzeichne Annahmen, Unsicherheiten und fehlende Originale.',
 '6. Wenn eine Originaldatei hochgeladen wurde: benenne konkrete Verbesserungen an dieser Originalfassung und biete eine direkt nutzbare überarbeitete Datei an, sofern möglich.',
 '7. Ohne Originaldatei: erfinde keine vorhandenen Aufgaben, Buchseiten, Lösungen oder Folieninhalte. Frage nach der benötigten Quelle.',
 '',
 '## Datenschutz',
 'Ich werde nur ausdrücklich ausgewählte Dateien bereitstellen. Bitte frage nicht nach Schülernamen, Noten, Schülerlisten oder persönlichen Reflexionsnotizen.',
 '',
 '## Gewünschtes Ergebnis',
 'Zunächst eine kurze, nachvollziehbare Änderungsliste und den konkreten verbesserten Unterrichtsbaustein. Keine vollständige Neuplanung, sofern sie nicht nötig ist.'
 ].join('\n');
}
function bundleName(item){
 return (String(item?.kind||'Unterricht')+'_'+String(item?.title||'Verbesserung'))
 .normalize('NFKC').replace(/[\\/:"*?<>|\u0000-\u001f]/g,'_')
 .replace(/\s+/g,'_').slice(0,75)||'Unterricht_verbessern';
}
const api={CATEGORIES,FOCI,FLAG_LABELS,FOCUS_GUIDES,stage,issues,priority,grade,
 collect,summarize,filter,focusFor,brief,bundleName};
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.SchulcockpitImproveCoreV326=api;
})(typeof window!=='undefined'?window:null);
