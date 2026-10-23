'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const lib=require('../schulcockpit-pruefungsthemen-v245.js'),rules=require('../schulcockpit-jahresvorgaben-v244.js');
const sequences=[
 {id:'gr1',title:'Grundrechenarten I',plan:[{plannedDate:'2026-09-21'}],curriculumV202:{topicId:'mathe-5-all'}},
 {id:'gr2',title:'Mal und Geteilt',plan:[{plannedDate:'2026-10-26'},{plannedDate:'2026-11-06'}]},
 {id:'stat',title:'Statistik und Rundung',plan:[{plannedDate:'2026-11-13'}]},
 {id:'geom',title:'Erlebniswelt Geometrie',plan:[{plannedDate:'2027-03-01'}]}
];
const curriculum=[{id:'mathe-5-all',title:'Grundrechenarten I + II'},{id:'mathe-5-extra',title:'Brüche'}];
const slots=[];for(let n=0;n<12;n++){
 const d=lib.dateShift('2026-11-16',n*7);
 slots.push({date:d,slot:1});
}
test('Known classroom topics are offered once, unmatched curriculum topics remain optional',()=>{
 const t=lib.topicsForCourse(sequences,curriculum);
 assert.ok(t.some(x=>x.id==='seq:gr2'&&x.title==='Mal und Geteilt'));
 assert.ok(t.some(x=>x.id==='seq:stat'));
 assert.equal(t.filter(x=>x.id==='kc:mathe-5-all').length,0);
 assert.equal(t.filter(x=>x.id==='kc:mathe-5-extra').length,1);
});
test('Classwork can use one principal and one supplemental topic with no duplicate',()=>{
 const t=lib.topicsForCourse(sequences,curriculum);
 const row={primaryTopicIds:['seq:gr2'],supplementaryTopicIds:['seq:stat']};
 assert.deepEqual(lib.selectedCoverage(row,t).invalid,[]);
 assert.deepEqual(lib.selectedCoverage(row,t).duplicated,[]);
 const wrong=lib.selectedCoverage({...row,supplementaryTopicIds:['seq:gr2','nonsense']},t);
 assert.deepEqual(wrong.duplicated,['seq:gr2']);
 assert.deepEqual(wrong.invalid,['nonsense']);
});
test('Prefers an eligible free Fachtermin in last or penultimate week before Christmas vacations',()=>{
 const results=lib.candidateDates({slots,sequences,topics:curriculum,
  ranges:[{start:'2026-12-23',end:'2027-01-06',type:'official',name:'Weihnachtsferien'}],
  row:{id:'ka2',half:1,type:'klassenarbeit',primaryTopicIds:['seq:gr2'],supplementaryTopicIds:['seq:stat']},
  rows:[],confirmed:[],today:'2026-11-10',year:'2026/27'});
 assert.ok(results.length>0);
 assert.equal(results[0].date,'2026-12-14');
 assert.ok(results[0].untilBreak>=7&&results[0].untilBreak<=17);
 assert.ok(results.every(x=>x.date>'2026-11-13'));
});
test('Avoids vacations, known exams and close-by other assessments',()=>{
 const found=lib.candidateDates({slots,sequences,topics:curriculum,
  ranges:[{start:'2026-12-23',end:'2027-01-06',name:'Weihnachtsferien'}],
  row:{id:'ka2',half:1,primaryTopicIds:['seq:gr2']},
  rows:[{id:'other',proposedDate:'2026-12-14',status:'vorschlag'}],
  confirmed:['2026-12-21'],today:'2026-11-10',year:'2026/27',
  free:date=>date==='2026-12-07'});
 assert.ok(found.every(x=>!['2026-12-07','2026-12-14','2026-12-21'].includes(x.date)));
});
test('Second-semester proposals cannot move into first semester; swap remains tentative',()=>{
 const s=lib.candidateDates({slots:[...slots,{date:'2027-02-08',slot:1},{date:'2027-02-15',slot:1}],
  sequences:[],topics:[],ranges:[],row:{half:2,id:'test',type:'test'},rows:[],confirmed:[],today:'2026-11-01',year:'2026/27'});
 assert.ok(s.every(x=>x.date>='2027-02-01'));
 const swapped=lib.swapProposals({proposedDate:'2027-02-15',alternativeDate:'2027-02-08',status:'vorschlag'});
 assert.equal(swapped.proposedDate,'2027-02-08');assert.equal(swapped.alternativeDate,'2027-02-15');
 assert.equal(swapped.status,'vorschlag');
});
test('Optional Classtime competency test is distinct from compulsory classwork',()=>{
 const row=rules.tidy({id:'test',half:2,type:'test',mode:'classtime',topic:'Diagramme'});
 assert.equal(row.type,'test');assert.equal(row.mode,'classtime');
 assert.deepEqual(rules.checkRows([row],'2026/27'),[]);
});
test('Import contract delegates all proposal dates to ChatGPT and preserves topic choices',()=>{
 const js=fs.readFileSync(path.join(__dirname,'..','schulcockpit-restjahr-v236.js'),'utf8');
 assert.match(js,/selectableExamTopics/);
 assert.match(js,/coveredMainIds/);
 assert.match(js,/coveredSupplementaryIds/);
 assert.doesNotMatch(js,/v245AutoSuggestAfterImport\(\)/);
 assert.match(js,/Terminvorschläge entstehen ausschließlich in deiner ChatGPT-Jahresplanung/);
 assert.match(js,/v245-set-count/);
 assert.match(js,/data-v245-test/);
 assert.match(js,/data-v244-fix/);
});
