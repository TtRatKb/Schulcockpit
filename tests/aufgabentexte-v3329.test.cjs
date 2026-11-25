const assert=require('node:assert/strict');
const {test}=require('node:test');
const core=require('../schulcockpit-aufgabeneditor-v334-core.js');
const matching=require('../schulcockpit-classtime-abgleich-v336-core.js');
const a={id:'A1a',label:'Aufgabe 1 A',source:'classtime',regularMax:1,bonusMax:0,competencyId:'K1',classtimeAliases:['Q3']};
const b={id:'A1b',label:'Aufgabe 1 B',source:'classtime',regularMax:1,bonusMax:0,competencyId:'K1',classtimeAliases:['Q1']};
const long='Frage 1 A – '+('Originaler Aufgabentext mit <Angaben> & Antwortoptionen. '.repeat(12));
const cols=[{index:1,label:'Q1',description:'Frage 1 B',taskText:'Frage B',max:1},{index:3,label:'Q3',description:long.slice(0,180),taskText:long,max:1}];
test('full original text, correct reordered column, no scoring mutations',()=>{
 const items=[a,b],before=JSON.stringify(items);
 assert.equal(core.resolveTaskText(a,items,cols,{A1a:3,A1b:1},matching.matches).text,long.trim());
 assert.equal(core.resolveTaskText(b,items,cols,{},matching.matches).text,'Frage B');
 assert.equal(JSON.stringify(items),before);
});
test('conflicting or duplicate mapping never guesses; paper and bonus metadata',()=>{
 assert.equal(core.resolveTaskText(a,[a,b],cols,{A1a:1},matching.matches).source,'ambiguous');
 assert.equal(core.resolveTaskText(a,[a,b],cols,{A1a:3,A1b:3},matching.matches).source,'ambiguous');
 const paper={...a,source:'paper',taskText:'Original auf Papier'};
 assert.equal(core.resolveTaskText(paper,[paper],cols,{},matching.matches).text,paper.taskText);
 const bonus={...a,source:'classtime_bonus',bonusMax:1,regularMax:0};
 assert.equal(core.resolveTaskText(bonus,[bonus],cols,{},matching.matches).text,long.trim());
 assert.equal(core.resolveTaskText({...paper,taskText:''},[],cols,{}).source,'missing');
});
test('text metadata persists independently of raw score, competency and bonus rules',()=>{
 const input={...a,taskText:'Vorher'};
 const change={id:a.id,source:'classtime',mode:'regular',original:1,competencyId:'K1',taskText:long};
 const result=core.verify([input],[change],{scores:{S1:{A1a:1}}},[{id:a.id,max:1}]);
 assert.equal(result.items[0].taskText,long.trim());
 assert.equal(result.items[0].regularMax,1);assert.equal(result.items[0].competencyId,'K1');
 assert.equal(input.taskText,'Vorher');
 const next=[{...a}];core.preserveTaskTexts(result.items,next);
 assert.equal(next[0].taskText,long.trim());
 const changed=[{...a,classtimeAliases:['Q9']}];core.preserveTaskTexts(result.items,changed);
 assert.equal(changed[0].taskText,undefined);
});
