const assert=require('node:assert/strict');
const {test}=require('node:test');
const G=require('../schulcockpit-classtime-sammelfragen-v3338-core.js');
const M=require('../schulcockpit-nachschreiben-v300-core.js');
const items=[{id:'a',label:'Aufgabe 4b a',source:'classtime',regularMax:2,competencyId:'K'},{id:'b',label:'Aufgabe 4b b',source:'classtime',regularMax:2,competencyId:'K'},{id:'c',label:'Aufgabe 4b c',source:'classtime_bonus',bonusMax:2,competencyId:'K'}],mapping={a:1,b:1,c:2},parts={a:'1,2',b:'3-4'},cols=[{label:'Q5',index:1,max:4},{label:'Q6',index:2,max:2}];
const parsed={sheets:[{name:'S-DEMO',rows:[[],['Name','Q5','Q6'],[],['Name',4,2],['Synthetic A',3,1],['Synthetic B',4,0],['Synthetic C',0,0]]},{name:'Q5',rows:[[],['Name des Lernenden','Punkte Lücke 1','Punkte Lücke 2','Punkte Lücke 3','Punkte Lücke 4'],['S1',1,0,1,1],['S2',1,1,1,1],['S3',0,0,0,0]]}]};
const det={sheetIndex:0,headerRow:1,questionMaxRowV210:3,studentRows:parsed.sheets[0].rows.slice(4).map((row,i)=>({rowIndex:i+4,name:row[0],row}))};
const batch={id:'synthetic',parsed,det};
test('shared partitions enforce disjoint complete original maxima, calculate exact detail scores',()=>{
 const g=G.plan(items,cols,mapping,parts);assert.equal(g.ok,true);
 assert.deepEqual(g.direct.map(x=>x.id),['c']);
 assert.deepEqual(G.groupScores(parsed,det,g.groups[0],det.studentRows[0]).map(x=>x.score),[1,2]);
 assert.equal(G.plan(items,cols,mapping,{a:'1,2',b:'2,3'}).ok,false);
 assert.equal(G.plan(items,cols,mapping,{a:'1',b:'3,4'}).ok,false);
 assert.equal(G.plan(items,cols,mapping,{a:'1,2'}).ok,false);
});
test('partial aggregate without verified individual scores stays open; extremes exact; original not mutated',()=>{
 const x=structuredClone(parsed);x.sheets.pop();const g=G.plan(items,cols,mapping,parts).groups[0],old=structuredClone(x);
 assert.deepEqual(G.groupScores(x,det,g,det.studentRows[0]).map(x=>x.score),[null,null]);
 assert.deepEqual(G.groupScores(x,det,g,det.studentRows[1]).map(x=>x.score),[2,2]);
 assert.deepEqual(G.groupScores(x,det,g,det.studentRows[2]).map(x=>x.score),[0,0]);
 assert.deepEqual(x,old);
 const wrong=structuredClone(parsed);wrong.sheets[1].rows[2][2]=1;
 assert.deepEqual(G.groupScores(wrong,det,g,det.studentRows[0]).map(x=>x.score),[null,null]);
 const answer=structuredClone(parsed);answer.sheets[1].rows[1]=['Name des Lernenden','Lücke 1','Lücke 2','Lücke 3','Lücke 4'];
 assert.deepEqual(G.groupScores(answer,det,g,det.studentRows[0]).map(x=>x.score),[null,null]);
});
test('makeup import uses same exact split, preserves individual source and partial uncertainty',()=>{
 const roster=[{id:'s',name:'Synthetic A'}],current={roster};
 const args={batch,analysis:{items},roster,linked:{4:'s'},mapping,current,groupParts:parts};
 const p=M.evaluate(args);assert.deepEqual(p.chosen[0].marks,{a:1,b:2});assert.deepEqual(p.chosen[0].bonusMarks,{c:1});
 const missing=M.evaluate({...args,batch:{...batch,parsed:{...parsed,sheets:[parsed.sheets[0]]}}});
 assert.equal(missing.groupOpen,2);assert.deepEqual(missing.chosen[0].marks,{});
 const next=M.apply(current,missing,{id:'synthetic'});assert.match(next.groupReviewV3338.s.a.message,/3\/4/);assert.equal(current.scores,undefined);
});
test('A task reference does not equate A4b with A4b a',()=>{
 assert.equal(G.taskRef('Frage 01 · A1a · Fachbegriffe'), '1a');assert.equal(G.taskRef('Aufgabe 4b a – Rechenregeln'),'4ba');assert.equal(G.taskRef('FRAGE 05 · A4b (a–f)'),'4b');
});
