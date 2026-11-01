const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../schulcockpit-unterricht-ist-v270-core.js');
const units=[
 {id:'u1',plannedDate:'2026-10-30',competencyIdsV202:['K1','K2']},
 {id:'u2',plannedDate:'2026-11-11',competencyIdsV202:['K3']},
 {id:'u3',plannedDate:'2026-11-18',competencyIdsV202:['K4']}
];
const lessons=[
 {id:'l1',classId:'r7',date:'2026-10-30',planReference:{unitId:'u1'},heldV270:true,
  actualV270:{mode:'changed',summary:'Video und Kahoot',securedIds:['K1'],coveredIds:['K2']}}
];
const check=(ids,u=units,l=lessons)=>core.assess(ids,u,l,'2026-11-13');
test('explicitly secured is stronger than covered; unselected old plan does not imply secured',()=>{
 const r=check(['K1','K2','K3','K4']);
 assert.deepEqual(r.map(x=>x.status),['secured','covered','planned','missing']);
 assert.equal(core.briefing(r).ready,false);
});
test('held but not documented is not automatically counted as secured',()=>{
 const r=check(['K1'],units,[{id:'l1',classId:'r7',date:'2026-10-30',heldV270:true,
  planReference:{unitId:'u1'}}]);
 assert.equal(r[0].status,'unconfirmed');
});
test('late lesson after exam cannot prove competence for exam',()=>{
 const l=[{id:'l2',classId:'r7',date:'2026-11-17',heldV270:true,
 actualV270:{securedIds:['K3']}}];
 assert.equal(check(['K3'],units,l)[0].status,'planned');
});
test('only explicitly documented competence counts, not similar title',()=>{
 const l=[{id:'l2',classId:'r7',date:'2026-10-30',title:'K1 - played video',
  heldV270:true,actualV270:{summary:'K1',securedIds:[],coveredIds:[]}}];
 assert.notEqual(check(['K1'],units,l)[0].status,'secured');
});
test('empty selection is not a green exam check',()=>{
 assert.equal(core.briefing(check([])).ready,false);
});
