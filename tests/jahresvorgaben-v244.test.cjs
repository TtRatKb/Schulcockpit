'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const h=require('../schulcockpit-jahresvorgaben-v244.js');
const topics=[{id:'grund',title:'Grundrechenarten I und II',competencies:[{id:'k01',text:'Rechnen'}]},
 {id:'stat',title:'Statistik',competencies:[{id:'k02',text:'Diagramme'}]}];
const methods=[{id:'methode-5-4',text:'Kompetenzraster',sourceComplete:true},
 {id:'methode-5-1',text:'Plakat gestalten und vorstellen',sourceComplete:true},
 {id:'methode-5-2',text:'Diagramme auswerten',sourceComplete:true}];
test('Several assessments per semester, with combined topics and alternatives',()=>{
 const rows=[
  {id:'written',half:1,type:'klassenarbeit',topic:'Plus und Minus',status:'fest',confirmedDate:'2026-09-30',assessmentId:'ka1'},
  {id:'planned',half:1,type:'klassenarbeit',topic:'Mal und Geteilt + Statistik/Runden',status:'vorschlag',proposedDate:'2026-11-17',alternativeDate:'2026-11-24'},
  {id:'spring1',half:2,type:'klassenarbeit',topic:'Brüche',status:'offen'},
  {id:'spring2',half:2,type:'klassenarbeit',topic:'Geometrie',status:'offen'}
 ];
 assert.deepEqual(h.checkRows(rows,'2026/27'),[]);
 assert.equal(rows.filter(x=>x.half===1).length,2);
 assert.equal(rows.filter(x=>x.half===2).length,2);
});
test('Cannot mark exams as fixed without an actual immutable assessment record',()=>{
 assert.match(h.checkRows([{id:'x',half:1,type:'klassenarbeit',topic:'Mal und Geteilt',
  status:'fest',confirmedDate:'2026-12-01'}],'2026/27').join(' '),/Prüfungsdatensatz/);
 assert.equal(h.checkRows([{id:'x',half:1,type:'klassenarbeit',topic:'Mal und Geteilt',
  status:'vorschlag',proposedDate:'2026-12-01'}],'2026/27').length,0);
});
test('Invalid, duplicated and out-of-year assessment dates never accepted',()=>{
 assert.ok(h.checkRows([{id:'same',half:1,topic:'Brüche'},{id:'same',half:2,topic:'Körper'}],'2026/27').some(x=>x.includes('mehrfach')));
 assert.ok(h.checkRows([{id:'n1',half:1,topic:'Brüche',proposedDate:'2026-02-29'}],'2026/27').some(x=>x.includes('ungültiger')));
 assert.ok(h.checkRows([{id:'n1',half:1,topic:'Brüche',proposedDate:'2028-01-15'}],'2026/27').some(x=>x.includes('außerhalb')));
});
test('A fixed exam conflicts with another registered exam or prepared teaching',()=>{
 const a=h.conflictOnFixedDate('2026-11-17','m5',[{classId:'m5',date:'2026-11-17'}],
  [{classId:'m5',date:'2026-11-17',status:'ready'}],l=>l.status==='ready');
 assert.equal(a.existing.length,1);assert.equal(a.protectedLessons.length,1);
});
test('Competency audit sees methods allocated to concrete units across multiple sequences',()=>{
 const sequences=[
  {title:'Grundrechenarten',topicId:'grund',units:[{title:'Standpunkt',competencyIds:['k01'],methodIds:['methode-5-4'],
    resourcesNeeded:'Standpunkt-Test'}]},
  {title:'Statistik',topicId:'stat',units:[{title:'Plakat erstellen',competencyIds:['k02'],methodIds:['methode-5-1','methode-5-2'],
    resourcesNeeded:'Plakatpapier, Stifte'}]}
 ];
 const plans=[{id:'plan1',status:'offen',topic:'Grundrechenarten + Statistik'}];
 const audit=h.auditPlan({sequences,assessmentPlans:[{planId:'plan1'}],
  assessments:[{planId:'plan1',preparationUnitTitles:['Plakat erstellen']}],topics,methods,plannedExams:plans});
 assert.equal(audit.methodTotal,3);
 assert.equal(audit.methodScheduled,3);
 assert.equal(audit.missingMethods.length,0);
 assert.equal(audit.unmatchedExams.length,0);
 assert.equal(audit.resourcesNeeded.length,2);
});
test('Methods omitted by ChatGPT are reported, not silently counted as covered',()=>{
 const audit=h.auditPlan({sequences:[{title:'Grundrechenarten',topicId:'grund',
  units:[{title:'Mal und Geteilt',competencyIds:['k01'],methodIds:[]}]}],
  topics,methods,plannedExams:[{id:'ka2',status:'offen',topic:'Mal und Geteilt + Statistik'}],
  assessments:[]});
 assert.equal(audit.missingMethods.length,3);
 assert.deepEqual(audit.unmatchedExams,['Mal und Geteilt + Statistik']);
});
test('Prior protected methods are counted; unprotected old plans do not falsify coverage',()=>{
 const audit=h.auditPlan({sequences:[],currentSequences:[{title:'Bereits gehalten',
  units:[{title:'Standpunkt',competencyIdsV202:['methode-5-4']}]}],topics,methods});
 assert.equal(audit.methodScheduled,1);
 assert.deepEqual(audit.missingMethods.map(x=>x.id),['methode-5-1','methode-5-2']);
});
test('Reusing a curriculum theme needs unique evidenced competency IDs',()=>{
 assert.equal(h.deriveTopicId(['k01'],topics),'grund');
 assert.equal(h.deriveTopicId(['k01','k02'],topics),'');
 assert.equal(h.deriveTopicId(['nicht-belegt'],topics),'');
});

test('Undecided Religion topics stay explicitly open instead of being invented',()=>{
 assert.equal(h.checkRows([{id:'religion5',half:1,type:'ersatzleistung',status:'offen',topic:''}],'2026/27').length,0);
 assert.ok(h.checkRows([{id:'religion5',half:1,type:'ersatzleistung',status:'vorschlag',topic:'',proposedDate:'2026-12-10'}],'2026/27').length>0);
});
