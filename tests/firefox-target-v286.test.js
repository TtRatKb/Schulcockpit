const assert=require('node:assert/strict');
const core=require('../schulcockpit-targetcheck-v286-core.js');
const blank={settings:{schoolYear:'2026/27',weeklyPrintDay:1,activeWeekStart:'2026-11-02'},
 classes:[],timetable:[],sequences:[],lessons:[],materials:[],materialCatalog:[],
 assessments:[],backlog:[],tasks:[],schoolCalendarsV190:{},yearAssessmentPlansV244:{}};
assert.equal(core.planning(blank).safe,true);
const changed={...blank,classes:[{id:'c',name:'fiktiv'}]};
assert.equal(core.planning(changed).safe,false);
assert.equal(core.planning(changed).counts.classes,1);
assert.equal(core.planning({...blank,lessons:[{id:'x'}]}).safe,false);
assert.equal(core.planning({...blank,settings:{schoolYear:'2025/26',weeklyPrintDay:1}}).safe,false);
assert.equal(core.planning({...blank,materialCatalog:[{catalogId:'x'}]}).safe,false);
assert.equal(core.planning({...blank,assessmentStatsV250:{graded:1}}).safe,false);
assert.equal(core.planning({settings:blank.settings,classes:[],someDefaultState:{}}).safe,true);
assert.equal(core.planning(null).safe,false);
const emptyCat={key:'__material_catalog_manifest_v171__'};
const emptyPayload={kind:'schulcockpit-material-catalog-local',schemaVersion:'1.0',entries:[],meta:{}};
assert.equal(core.safeCatalog(emptyCat,emptyPayload),true);
assert.equal(core.safeCatalog(emptyCat,{...emptyPayload,entries:[{id:'file'}]}),false);
assert.equal(core.safeCatalog(emptyCat,{...emptyPayload,meta:{lastImport:'today'}}),false);
assert.equal(core.safeCatalog({...emptyCat,key:'some-other-file'},emptyPayload),false);
const master={assessmentId:'__sc_masterclass_v251__:index',schema:'schulcockpit.private-master-index.v1',classes:[]};
assert.equal(core.safeMasterIndex(master),true);
assert.equal(core.safeMasterIndex({...master,classes:[{id:'student'}]}),false);
assert.equal(core.safeMasterIndex({...master,assessmentId:'exam'}),false);
console.log('Firefox target: empty bootstrap recognized, real planning/files/private data never marked empty');
