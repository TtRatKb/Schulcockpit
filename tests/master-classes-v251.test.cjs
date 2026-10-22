const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../schulcockpit-stammklassen-core-v251.js');
const master=[
 {id:'m1',name:'Anna Müller'},
 {id:'m2',name:'Ben Weiß'},
 {id:'m3',name:'Cora Lang'}
];
test('reuses same person by normalized name and keeps old course IDs',()=>{
 const course=[{id:'s44',name:'Anna Müller',learningSupport:true,other:'keep'}];
 const plan=core.makePlan(master,course);
 assert.equal(plan.matches.length,1);
 assert.deepEqual(plan.newNames.map(x=>x.name),['Ben Weiß','Cora Lang']);
 let i=0;
 const next=core.applyPlan(course,plan,()=> 'new-'+(++i));
 assert.equal(next[0].id,'s44');
 assert.equal(next[0].learningSupport,true);
 assert.equal(next[0].other,'keep');
 assert.equal(next[0].masterStudentIdV251,'m1');
 assert.equal(next.length,3);
 assert.equal(course.length,1);
 assert.equal(course[0].masterStudentIdV251,undefined);
});
test('repeat sync does not duplicate pupils',()=>{
 let i=0;
 const first=core.applyPlan([],core.makePlan(master,[]),()=> 'new-'+(++i));
 const repeat=core.makePlan(master,first);
 assert.equal(repeat.newNames.length,0);
 assert.equal(repeat.matches.length,master.length);
 const again=core.applyPlan(first,repeat,()=>{throw Error('No IDs should be generated');});
 assert.equal(again.length,master.length);
});
test('linked person with different name is flagged without changing the name',()=>{
 const course=[{id:'c1',name:'Anna Meier',masterStudentIdV251:'m1'}];
 const plan=core.makePlan(master,course);
 assert.equal(plan.conflicts.length,1);
 assert.throws(()=>core.applyPlan(course,plan,()=> 'new1'),/Offene Zuordnungskonflikte/);
 assert.equal(course[0].name,'Anna Meier');
});
test('conflicting master identifier cannot overwrite pre-existing course link',()=>{
 const course=[{id:'c1',name:'Anna Müller',masterStudentIdV251:'elsewhere'}];
 const plan=core.makePlan(master,course);
 assert(plan.conflicts.length>=1);
 assert.throws(()=>core.applyPlan(course,plan,()=> 'new1'));
});
test('duplicate names and ids never enter a roster',()=>{
 assert.throws(()=>core.validate([{id:'a',name:'Anna Müller'},{id:'b',name:'Anna  Müller'}]));
 assert.throws(()=>core.validate([{id:'a',name:'Anna Müller'},{id:'a',name:'Ben Weiß'}]));
});
test('master lists do not implicitly carry scores or LE status',()=>{
 const plan=core.makePlan([{id:'m1',name:'A. B.'}],[]);
 const next=core.applyPlan([],plan,()=> 'fresh');
 assert.deepEqual(next,[{id:'fresh',name:'A. B.',learningSupport:false,masterStudentIdV251:'m1'}]);
});
