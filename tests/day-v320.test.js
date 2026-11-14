/* Isolierte Smoke-/Regressionstests mit synthetischen Beispieldaten.
 * node tests/day-v320.test.js oder tests/day-v320.html im Browser öffnen.
 * Keine Projekt-, Klassen- oder personenbezogenen Daten erforderlich.
 */
(function(root){
'use strict';
const C=typeof module==='object'&&module.exports&&typeof require==='function'
 ?require('../schulcockpit-mein-schultag-v320-core.js')
 :root.SchulcockpitDayCoreV320;
function assert(condition,message){if(!condition)throw Error(message);}
function run(){
 const list=[];
 function test(name,fn){try{fn();list.push({name,ok:true});}catch(err){list.push({name,ok:false,error:String(err.message||err)});}}
 const date='2026-11-16';
 const base={
  lessons:[
   {id:'ordinary',date,classId:'c1',slot:2,title:'Brüche addieren',status:'planned',
    aiImportAt:'2026-11-12',slides:[{title:'A'}],phasePlan:[{title:'A'}],
    presentationReady:true,
    printPlan:[{materialId:'m1',variantId:'v1',needed:true,count:26,alreadyPrinted:false}]},
   {id:'sub',date,classId:'c2',slot:3,title:'Freiheit',status:'open',printPlan:[]},
   {id:'held',date,classId:'c1',slot:1,title:'Wiederholung',status:'done'},
   {id:'archived',date,classId:'c2',slot:4,title:'Übung',printPlan:[{materialId:'m1',variantId:'v1',needed:true,count:25,_v183obsolete:true}]},
   {id:'other-day',date:'2026-11-17',classId:'c2',slot:1,title:'Anderes Datum'},
   {id:'group',date,classId:'c1',kind:'group',id:'g1',title:'Pausenaufsicht'}
  ],
  classes:[{id:'c1',subject:'Mathematik',name:'5a'},{id:'c2',subject:'Religion',name:'8'}],
  materials:[{id:'m1',title:'AB Brüche',variants:[{id:'v1',fileKey:'blob1',fileName:'Brueche_AB.pdf'}]}],
  storedKeys:['blob1','lesson-ppt-ordinary'],
  substitutionPlans:{'2026-11-16|c2|3':{instructions:'Bearbeitet die Aufgaben auf dem AB.',prepared:true}},
  lessonTypes:{sub:'substitution'}
 };
 test('Wochenende springt zum Montag',()=>assert(C.initialDay('2026-11-14')==='2026-11-16','Samstag nicht übersprungen'));
 test('Navigiert rückwärts zum vorherigen Schultag',()=>assert(C.schoolDay('2026-11-16',-1)==='2026-11-13','Freitag erwartet'));
 test('Keine Stunden und keine erfundenen Einträge an anderem Datum',()=>{
  const x=C.summarize({...base,lessons:[]},date);
  assert(x.total===0&&x.rows.length===0,'Leerer Tag darf keine Daten erfinden');
 });
 test('Auswahl filtert andere Tage und Gruppen',()=>{
  const x=C.summarize(base,date);
  assert(x.total===4,'Vier Unterrichtsstunden erwartet');
  assert(x.rows.map(r=>r.id).join(',')==='held,ordinary,sub,archived','Stundenreihenfolge / Ausschluss falsch');
 });
 test('Bereit nur bei gespeicherter PPT und erfüllten Kopien',()=>{
  const x=C.summarize(base,date),r=x.rows.find(x=>x.id==='ordinary');
  assert(r.status==='warning'&&r.copyOpen===1&&r.hasPresentation,'Noch eine Kopierposition offen');
  const y=C.summarize({...base,lessons:base.lessons.map(l=>l.id==='ordinary'?
   {...l,printPlan:l.printPlan.map(p=>({...p,alreadyPrinted:true}))}:l)},date);
  assert(y.rows.find(x=>x.id==='ordinary').status==='ready','Mit Kopien sollte bereit gelten');
 });
 test('PPT-ready-Flag ohne lokale PPT-Datei täuscht keine Verfügbarkeit vor',()=>{
  const x=C.summarize({...base,storedKeys:['blob1']},date).rows.find(x=>x.id==='ordinary');
  assert(!x.hasPresentation&&x.status==='warning','Lokale PPT fehlt');
 });
 test('Archivierte und entfernte Druckpositionen werden nicht gezählt',()=>{
  const x=C.summarize(base,date);
  assert(x.rows.find(r=>r.id==='archived').copyOpen===0,'Archivierte Kopien gezählt');
  assert(x.printOpen===1,'Tages-Drucksumme falsch');
 });
 test('Vertretungsstunde nutzt eigenen Auftrag, ohne PPT-Pflicht',()=>{
  const x=C.summarize(base,date).rows.find(r=>r.id==='sub');
  assert(x.status==='ready'&&x.substitutionReady,'Vorbereitete Vertretung wurde nicht erkannt');
  const y=C.summarize({...base,substitutionPlans:{}},date).rows.find(r=>r.id==='sub');
  assert(y.status==='warning','Fehlende Vertretungsanweisung muss auffallen');
 });
 test('Gehaltene Stunden werden getrennt gezählt',()=>{
  const x=C.summarize(base,date);
  assert(x.held===1&&x.rows.find(r=>r.id==='held').status==='held','Gehalten falsch');
 });
 test('Fehlende lokale AB-Datei wird als fehlend, nicht vorhanden ausgewiesen',()=>{
  const x=C.summarize({...base,storedKeys:['lesson-ppt-ordinary']},date).rows.find(r=>r.id==='ordinary');
  assert(x.copyMissing===1&&!x.firstFile,'Fehlender AB-Blob darf nicht als verfügbar gelten');
 });
 test('Abgesagte Stunde wird nicht als offen bewertet',()=>{
  const data={...base,lessons:[{id:'x',classId:'c1',date,slot:2,status:'open',executionV180:{type:'cancelled'}}]};
  const x=C.summarize(data,date);
  assert(x.rows[0].status==='canceled'&&x.open===0,'Ausfall falsch');
 });
 test('Modell ändert weder Unterrichts- noch Materialdaten',()=>{
  const before=JSON.stringify(base);
  C.summarize(base,date);
  assert(JSON.stringify(base)===before,'Unerwünschte Datenmutation');
 });
 return {passed:list.filter(x=>x.ok).length,total:list.length,results:list,ok:list.every(x=>x.ok)};
}
if(typeof module==='object'&&module.exports){module.exports={run};if(typeof require==='function'&&require.main===module){
 const r=run();console.log(r.passed+'/'+r.total+' Tagesübersicht-Tests bestanden.');
 for(const t of r.results)if(!t.ok)console.error('FAIL',t.name,':',t.error);
 if(!r.ok)process.exitCode=1;
}}
if(root){
 const r=run();root.SchulcockpitDayTestsV320=r;
 const node=typeof document!=='undefined'?document.getElementById('results'):null;
 if(node){node.textContent=r.passed+'/'+r.total+' Tests bestanden'+(r.ok?' ✓':' – FEHLER')+
  '\n'+r.results.map(t=>(t.ok?'✓ ':'✗ ')+t.name+(t.error?' – '+t.error:'')).join('\n');
 node.className=r.ok?'ok':'error';}
}
})(typeof window!=='undefined'?window:null);
