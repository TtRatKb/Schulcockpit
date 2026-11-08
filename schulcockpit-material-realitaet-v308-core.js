/* V0.30.8 – effective lesson materials, deferred paper/book work and
 * exact cognitive-entry instructions. No mutation of historical Soll rows.
 */
const SC_MATERIAL_REALITY_V308=(function(){
'use strict';
const clean=x=>String(x??'').trim();
function key(x){return clean(x).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();}
function materialRows(rows){
 const result=[];
 for(const r of rows||[]){
  if(!r||!['print','reference','digital','activity'].includes(r.type))continue;
  const files=(r.bundleItemsV176||[]).map(x=>x.v?.fileName||x.m?.title||x.fileName||'')
   .filter(Boolean),single=r.variant?.fileName||r.material?.title||'';
  result.push({hint:r.hint,type:r.type,name:clean(r.title||r.hint),
   files:[...new Set(files.length?files:single?[single]:[])],
   already:!!r.v306AlreadyDistributed});
 }
 return result;
}
function materialBlock(rows){
 const xs=materialRows(rows);
 return xs.length?xs.map(x=>{
  const kind=x.already?'BEREITS AUSGETEILT · nur Rest bearbeiten / besprechen':
   x.type==='reference'?'BUCH / ARBEITSHEFT – verpflichtende Aufträge, NICHT kopieren':
   x.type==='print'?'AKTIVES ARBEITSBLATT – verwenden, falls verfügbar':
   x.type==='digital'?'DIGITALES MATERIAL':'UNTERRICHTSAKTIVITÄT';
  return '- ['+kind+'] '+x.name+
   (x.files.length?'\n  Zugeordnete Originaldatei(en): '+x.files.join(' · '):'')+
   (x.already?'\n  KEIN neuer Download oder Ausdruck.':'');
 }).join('\n'):'- Kein verbindliches Hauptmaterial ausgewählt.';
}
function strictPrompt(input,rows,options={}){
 let prompt=String(input||''),block=materialBlock(rows);
 const strict='## Verbindliche Materialauswahl – IST dieser Stunde, nicht historische Soll-Liste\n'+
 block+'\n\n'+
 'Die obige Liste ist die EINZIGE aktuelle Materialgrundlage. '+
 'Alte Original-Materialpakete, die über „Aus dieser Stunde entfernen“ deaktiviert wurden, '+
 'sind KEINE aktuellen Arbeitsaufträge. Entfernte Dateien dürfen nicht als neue Kopien, '+
 'Materialeinträge oder Phasen auftauchen. Die unveränderte Reihenplan-Archivliste ist '+
 'kein Gegenbeleg zur aktuellen Lehrkraftentscheidung.\n'+
 'BUCH/AH hat Vorrang vor neu erfundenen Aufgaben im Mathematikheft: '+
 'Wenn Buch- oder Arbeitsheftseiten (ggf. mit konkreten Aufgabennummern) genannt sind, '+
 'müssen diese den Kern der Erarbeitung bilden. Erfinde KEINE alternativen Rechenaufgaben '+
 'zum Abschreiben ins Heft. Setze stattdessen „Bearbeitet die angegebenen Aufgaben im Buch/AH“ '+
 'auf die eine Arbeitsauftragfolie und ergänze höchstens eine kurze hilfreiche Anleitung. '+
 'Die konkreten Aufgaben kennst du nur, wenn die entsprechenden Seiten im Chat beigefügt sind; '+
 'sonst NICHT behaupten, sie gelesen zu haben. Fehlende Seiten ggf. zur Prüfung anfordern.\n'+
 'Wenn ein Arbeitsblatt aktiv ist, ist es das Ausgangsmaterial; nicht ungefragt ein Ersatzblatt '+
 'oder eigene Aufgabenfolien erfinden. Falls keine aktiven Quellen vorliegen, frage vor '+
 'fachlich konkreten Aufgaben nach, statt frei Lernmaterial zu halluzinieren.\n';
 if(/## Hauptmaterial aus der Reihenplanung\n/.test(prompt)){
  prompt=prompt.replace(/## Hauptmaterial aus der Reihenplanung\n[\s\S]*?(?=\n\n## Letzter tatsächlicher Stand|\n\n## Auftrag)/,
   strict.trimEnd());
 }else{
  const marker='Danach hänge GENAU EINEN maschinenlesbaren Block an:';
  const i=prompt.indexOf(marker);prompt=i>=0?prompt.slice(0,i)+strict+'\n'+prompt.slice(i):prompt+'\n'+strict;
 }
 // Historical V0.18.3 footer only has print packages and can contradict the
 // new strict material selection. Replace it, do not merely append advice.
 prompt=prompt.replace(/\n\n## Verbindliche Materialentscheidungen im Cockpit\n[^\n]*(?:\n[^\n]*)?/g,'');
 const ids=materialRows(rows);
 if(options.outOfDateHint){
  prompt+='\n\n## Nicht eingeplante Quelle\n'+clean(options.outOfDateHint).slice(0,350);
 }
 return prompt;
}
const NOTES=['auto','topflop','fehlerdetektiv','impuls'];
function cognitiveConfig(c){
 const count=Math.max(1,Math.min(6,Math.round(Number(c?.count)||3)));
 const mode=NOTES.includes(c?.mode)?c.mode:'auto';
 return {count,mode};
}
function cognitivePrompt(c,last){
 const o=cognitiveConfig(c),prior=(last||[]).slice(0,2).map(l=>l.date+' · '+l.title).join('; ');
 const detail=o.mode==='topflop'?'Top/Flop-Aussagen':
  o.mode==='fehlerdetektiv'?'Fehlerdetektiv-Beispiele':
  o.mode==='impuls'?'kurze Impulsfragen':'geeignete kognitive Aktivierungsaufgaben';
 return '## Verbindliche Einstellung für den kognitiven Einstieg\n'+
 'Lehrkraftwunsch: GENAU '+o.count+' '+detail+' innerhalb des gewählten Einstiegsformats. '+
 'Nicht willkürlich auf ein bis zwei Aufgaben kürzen. Die Aufgaben gehören in eine kurze '+
 'zusammenhängende Einstiegssequenz und dürfen nicht zu mehreren Erarbeitungsphasen werden.\n'+
 'Letzte tatsächlich GEHALTENE Stunde(n): '+(prior||'im Cockpit nicht verlässlich erfasst')+'.\n'+
 'Wähle ausdrücklich bereits eingeführte Begriffe, Rechenwege und typische Schülerfehler '+
 'aus der unmittelbar vorhergehenden bzw. maximal zwei zurückliegenden Stunden. '+
 'Keine Inhalte aus erst heute neu eingeführten Arbeitsblättern oder fremden Themenbereichen '+
 'unbemerkt vorwegnehmen.\n'+
 'Fehlerdetektiv: keine demonstrativ absurden Fehler (z. B. grob falscher Rechenoperator). '+
 'Nutze fachlich plausible typische Fehlstrategien (z. B. Rest falsch weitergeführt, '+
 'Zwischenschritt übersehen, Stellenwert verwechselt), nur wenn diese Fehlerart zum '+
 'tatsächlich belegten Vorwissen passt. Jeder Fehler benötigt eine eindeutige korrekte '+
 'Lösung und einen erklärbaren Denkfehler in den Referentennotizen. '+
 'Wenn das Vorwissen oder Material nicht ausreicht, kennzeichne diese Unsicherheit '+
 'statt einen konkreten vorherigen Lerninhalt zu erfinden. '+
 'Bei Top/Flop pro Aussage eindeutig TOP/FLOP mit Begründung; nicht immer alle offensichtlich wahr '+
 'oder offensichtlich falsch. Die Anzahl bezieht sich auf Aufgaben, nicht auf die Zahl der Folien.\n';
}
function coverageIssues(rows,plan){
 const refs=materialRows(rows).filter(r=>r.type==='reference'&&!r.already);
 if(!refs.length||!plan)return [];
 // Listing a book in the JSON materials[] does not prove the lesson tasks
 // actually use its pages. Check ONLY phases and slides, not material labels.
 const phases=Array.isArray(plan.phases)?plan.phases:[];
 const slides=Array.isArray(plan.slides)?plan.slides:[];
 const content=[...phases,...slides].flatMap(x=>[
  x?.title,x?.details,x?.notes,x?.statement,
  ...(Array.isArray(x?.content)?x.content:[]),
  ...(Array.isArray(x?.steps)?x.steps:[])
 ]).filter(Boolean).join(' ').toLowerCase().replace(/\s+/g,' ');
 const result=[];
 for(const r of refs){
  const hint=r.name.toLowerCase();
  const workbook=/(arbeitsheft|arbeitsbuch|\bah\b)/i.test(hint),
   book=/(buch|schulbuch|lehrbuch)/i.test(hint)&&!workbook;
  const match=hint.match(/(?:s(?:eite)?\.?|seite)\s*(\d{1,3})\b/i);
  const noun=workbook?/(arbeitsheft|arbeitsbuch|\bah\b)/i:
    book?/(buch|schulbuch|lehrbuch)/i:null;
  if(!noun)continue;
  const page=match?.[1];
  const hasNoun=noun.test(content);
  const hasPage=!page||new RegExp('(?:s(?:eite)?\\.?|seite)\\s*'+page+'\\b','i').test(content);
  if(!hasNoun||!hasPage)result.push({
   hint:r.name,reason:!hasNoun?'Arbeitsauftrag greift das Buch/Arbeitsheft nicht auf':
    'Die konkret vorgegebene Seite '+page+' fehlt im Aufgabenverlauf'
  });
 }
 return result;
}
function deferredId(lessonId,itemId){return String(lessonId)+'||'+String(itemId);}
function pending(all,courseId,date,held){
 const rows=[];
 for(const source of (all||[])){
  if(!source||source.classId!==courseId||source.date>=date||!held(source))continue;
  const snap=source.worksheetActualV305?.snapshot||[];
  for(const e of snap){
   const actual=source.worksheetActualV305?.items?.[e.id];
   if(!actual||actual.follow!=='later'||!['partial','unused'].includes(actual.status))continue;
   const id=deferredId(source.id,e.id);
   const assigned=(all||[]).filter(l=>l.id!==source.id&&l.classId===courseId&&
    l.date>=source.date&&!l.quickDisabledV307&&
    (l.deferredLinksV308||[]).some(x=>x.key===id)&&(!l.executionV180||l.executionV180.type!=='cancelled'))
    .sort((a,b)=>a.date.localeCompare(b.date))[0]||null;
   rows.push({key:id,sourceId:source.id,itemId:e.id,sourceDate:source.date,
    title:e.title||e.hint||'Unterrichtsmaterial',hint:e.hint||e.title||'',
    materialId:e.materialId||'',variantId:e.variantId||'',
    printed:actual.printed||'unknown',status:actual.status,assignedLessonId:assigned?.id||'',
    assignedDate:assigned?.date||''});
  }
 }
 return rows.sort((a,b)=>a.sourceDate.localeCompare(b.sourceDate)||a.title.localeCompare(b.title,'de'))
  .slice(-100);
}
return {key,materialRows,materialBlock,strictPrompt,cognitiveConfig,cognitivePrompt,
 coverageIssues,deferredId,pending};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_MATERIAL_REALITY_V308;