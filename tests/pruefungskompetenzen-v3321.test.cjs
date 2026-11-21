'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const scope=require('../schulcockpit-pruefungskompetenzen-v3321-core.js');
const source=[
 {id:'R-7-1',topicId:'religion-7-islam',topicTitle:'Islam',text:'Gemeinschaft und Gebet'},
 {id:'R-7-2',topicId:'religion-7-islam',topicTitle:'Islam',text:'Feste im Islam'},
 {id:'R-7-3',topicId:'religion-7-jud',topicTitle:'Judentum',text:'Einblicke in das Judentum'},
 {id:'R-7-1',topicId:'religion-7-islam',topicTitle:'Islam',text:'Duplikat'}
];
test('multiple competencies belong to a specific curriculum topic without duplicates',()=>{
 const groups=scope.groups(source);
 assert.deepEqual(groups.map(g=>g.id),['religion-7-islam','religion-7-jud']);
 assert.deepEqual(groups[0].competencies.map(c=>c.id),['R-7-1','R-7-2']);
});
test('no teacher selection means no prompt and never a whole-year fallback',()=>{
 const missing=scope.selection(source,null);
 assert.equal(missing.ready,false);
 assert.equal(missing.competencies.length,0);
 assert.match(missing.errors.join(' '),/bestätigen/);
 assert.throws(()=>scope.create(source,[],[]),/Thema auswählen/);
});
test('explicit topic and subset of competencies are the only allowed prompt references',()=>{
 const selection=scope.create(source,['religion-7-islam'],['R-7-2']);
 const chosen=scope.selection(source,selection);
 assert.equal(chosen.ready,true);
 assert.deepEqual(chosen.competencies.map(c=>c.id),['R-7-2']);
 assert.equal(chosen.competencies.some(c=>c.id==='R-7-3'),false);
 assert.ok(!source.some(c=>c.curriculumCompetencyId));
});
test('out-of-topic competency, stale ID or changed curriculum blocks generation',()=>{
 assert.throws(()=>scope.create(source,['religion-7-islam'],['R-7-3']),/nicht in den ausgewählten/);
 assert.throws(()=>scope.create(source,['religion-7-islam'],['fake']),/nicht in den ausgewählten/);
 assert.equal(scope.selection(source,{schema:1,confirmed:true,topicIds:['old'],competencyIds:['R-7-1']}).ready,false);
});
test('final imported rubric may only map to chosen topic competency IDs',()=>{
 const chosen=scope.create(source,['religion-7-islam'],['R-7-1','R-7-2']);
 assert.equal(scope.checkImport({competencies:[
  {id:'K1',curriculumCompetencyId:'R-7-1'},
  {id:'K2',curriculumCompetencyId:''}]},chosen.competencyIds),true);
 assert.throws(()=>scope.checkImport({competencies:[
  {id:'K1',curriculumCompetencyId:'R-7-3'}]},chosen.competencyIds),/nicht zu den bestätigten/);
});
test('legacy assessment data and children are unchanged by pure topic filtering',()=>{
 const old={evaluationV200:{analysis:{items:[{id:'A1',regularMax:8}]}},
  competencySelectionV204:{selectedIds:['R-7-3'],confirmed:true},
  scores:{s1:{A1:6}}};
 const snapshot=structuredClone(old);
 scope.create(source,['religion-7-islam'],['R-7-1']);
 assert.deepEqual(old,snapshot);
});
