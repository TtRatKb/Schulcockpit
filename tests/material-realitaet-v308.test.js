'use strict';
const assert=require('node:assert/strict');
const C=require('../schulcockpit-material-realitaet-v308-core.js');
const old='## Hauptmaterial aus der Reihenplanung\n'+
 '- Materialpaket 6 Fachbegriffe Division\n'+
 '- Halbschriftliche Division\n'+
 '- Buch S. 42 Nr. 1–4\n\n'+
 '## Letzter tatsächlicher Stand\nLetzte Stunde: Division\n\n'+
 '## Auftrag\nEin Prompt mit Sollplan. Danach hänge GENAU EINEN maschinenlesbaren Block an:\n'+
 '<SCHULCOCKPIT_IMPORT>{}</SCHULCOCKPIT_IMPORT>\n\n'+
 '## Verbindliche Materialentscheidungen im Cockpit\nNur diese aktiven Materialpakete berücksichtigen: keine.\n';
const rows=[
 {hint:'Buch S. 42, Nr. 1–4',type:'reference'},
 {hint:'Arbeitsheft S. 21, Nr. 5–7',type:'reference'},
 {hint:'AB zusätzliche Übungen',type:'print',bundleItemsV176:[
  {v:{fileName:'Division_Zusatz.pdf'},m:{title:'Zusatz'}}]},
 {hint:'6 Fachbegriffe Division',type:'ignore'}
];
const result=C.strictPrompt(old,rows);
const segment=result.split('## Verbindliche Materialauswahl – IST dieser Stunde')[1].split('## Letzter tatsächlicher Stand')[0];
assert(segment.includes('Buch S. 42'));
assert(segment.includes('Arbeitsheft S. 21'));
assert(segment.includes('Division_Zusatz.pdf'));
assert(!segment.includes('6 Fachbegriffe Division'));
assert(!result.includes('Nur diese aktiven Materialpakete berücksichtigen: keine.'));
assert.match(result,/BUCH\/AH hat Vorrang/);
assert.match(result,/Erfinde KEINE alternativen Rechenaufgaben/);
assert.match(result,/Die konkreten Aufgaben kennst du nur, wenn/);
assert.match(result,/SCHULCOCKPIT_IMPORT/);
assert.equal(C.materialRows(rows).length,3);
const empty=C.strictPrompt(old,[]);
assert.match(empty,/Kein verbindliches Hauptmaterial/);
assert(!empty.includes('6 Fachbegriffe Division'));
const cognit=C.cognitivePrompt({count:4,mode:'fehlerdetektiv'},[
 {date:'2026-11-05',title:'Halbschriftliche Division'},
 {date:'2026-11-04',title:'Division mit Rest'}
]);
assert.match(cognit,/GENAU 4 Fehlerdetektiv-Beispiele/);
assert.match(cognit,/Halbschriftliche Division/);
assert.match(cognit,/fachlich plausible typische Fehlstrategien/);
assert.match(cognit,/Referentennotizen/);
assert.equal(C.cognitiveConfig({count:88,mode:'alien'}).count,6);
assert.equal(C.cognitiveConfig({count:0}).count,3);
const src={id:'old',classId:'math-5',date:'2026-10-29',status:'done',
 worksheetActualV305:{snapshot:[
  {id:'h:buch s 32 nr 1 4',hint:'Buch S. 32 Nr. 1–4',title:'Buch S. 32 Nr. 1–4'},
  {id:'m:div-v|v:standard',hint:'Divisionsblatt',title:'Divisionsblatt.pdf',
   materialId:'div-v',variantId:'standard'}
 ],items:{
  'h:buch s 32 nr 1 4':{status:'partial',follow:'later',printed:'unknown'},
  'm:div-v|v:standard':{status:'unused',follow:'later',printed:'yes'}
 }}};
const now={id:'next',classId:'math-5',date:'2026-11-02',status:'open'};
const other={id:'foreign',classId:'religion-5',date:'2026-11-02',status:'open'};
let queue=C.pending([src,now,other],'math-5','2026-11-02',l=>l.status==='done');
assert.equal(queue.length,2);
assert(queue.every(x=>!x.assignedLessonId));
assert.equal(queue[0].sourceDate,'2026-10-29');
assert.equal(C.pending([src,now,other],'religion-5','2026-11-02',l=>l.status==='done').length,0);
now.deferredLinksV308=[{key:queue[0].key}];
queue=C.pending([src,now],'math-5','2026-11-07',l=>l.status==='done');
assert.equal(queue.filter(x=>x.assignedLessonId).length,1);
assert.equal(queue.find(x=>x.assignedLessonId).assignedDate,'2026-11-02');
const bookRows=[{hint:'Buch S. 42 Nr. 1–4',type:'reference'},
 {hint:'Arbeitsheft S. 21 Nr. 5–7',type:'reference'}];
const wrong={lesson:{title:'Division'},phases:[{title:'Erarbeitung',details:'Schreibe die von mir erfundenen Aufgaben in dein Matheheft'}],
 slides:[{title:'Arbeitsauftrag',content:['Löse 152 : 8, 360 : 9 in deinem Heft']}],
 materials:[{title:'Buch S. 42 Nr. 1–4'},{title:'Arbeitsheft S. 21 Nr. 5–7'}]};
const issues=C.coverageIssues(bookRows,wrong);
assert.equal(issues.length,2,'mere listing books as materials is NOT actual phase use');
assert(issues.every(x=>x.hint.match(/(?:Buch|heft)/)));
const fixed={...wrong,phases:[{title:'Erarbeitung',
 details:'Bearbeitet Buch S. 42 Nr. 1–4 und Arbeitsheft S. 21 Nr. 5–7'}]};
assert.equal(C.coverageIssues(bookRows,fixed).length,0);
const partial={...wrong,phases:[{title:'Erarbeitung',
 details:'Bearbeitet die Aufgaben aus dem Buch auf S. 42 und die Aufgaben im Matheheft'}]};
assert.equal(C.coverageIssues(bookRows,partial).length,1);
console.log('Active material prompt: old removed worksheets absent, book/AH authoritative, 4 realistic cognitive tasks and cross-week postpone queue OK.');
