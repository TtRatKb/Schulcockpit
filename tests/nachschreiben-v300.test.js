const assert=require('node:assert/strict');
const core=require('../schulcockpit-nachschreiben-v300-core.js');
const sheet={name:'S-SYNTHETIC',rows:[
 [],['Name','Q1','Q2'],[],['Name','3','2'],
 ['Aster Vale',2,1],['Nova Reed',3,2],['River Day',0,1]]};
const det={sheetIndex:0,headerRow:1,questionMaxRowV210:3,sourceV210:'S-SESSION',
 studentRows:[{rowIndex:4,name:'Aster Vale',row:sheet.rows[4]},
 {rowIndex:5,name:'Nova Reed',row:sheet.rows[5]},
 {rowIndex:6,name:'River Day',row:sheet.rows[6]}]};
const parsed={fileName:'Synthetic-only.xlsx',sheets:[sheet]};
const batch={id:'batch-1',parsed,det};
const roster=[{id:'S001',name:'Aster Vale'},{id:'S002',name:'Nova Reed'},
 {id:'S003',name:'River Day'},{id:'S004',name:'Sage Green'}];
const an={items:[{id:'item-one',source:'classtime',label:'Q1',regularMax:3},
 {id:'item-two',source:'classtime',label:'Q2',regularMax:2}]};
const mapping={ 'item-one':1,'item-two':2 };
assert.equal(core.norm(' Nóva  Reed'),'nova reed');
assert.equal(core.columns(parsed,det).length,2);
assert.equal(core.autoMap(an.items,core.columns(parsed,det))['item-one'],1);
assert.equal(core.proposals(batch,roster).length,3);
assert.deepEqual(core.proposals(batch,roster).map(x=>x.studentId),['S001','S002','S003']);
const sig=core.signature(parsed,det);
assert.equal(sig,core.signature(parsed,det));
const swapped=structuredClone(parsed);swapped.sheets[0].rows[4][1]=1;
const swappedDet=structuredClone(det);swappedDet.studentRows[0].row[1]=1;
assert.notEqual(sig,core.signature(swapped,swappedDet));
const linked={4:'S001',5:'S002'};
const privateBase={assessmentId:'exam-synthetic',roster,classtime:{parsed:{fileName:'initial.xlsx'}},
 scores:{S001:{'item-one':1,'item-two':1},S004:{'item-one':3,'item-two':2}},
 paperScores:{S001:{'Paper-1':2}},bonusScores:{S001:{'Bonus':1}},
 scoreSourcesV211:{S001:{'item-one':'manual'}},
 feedbackV210:{S001:{strength:'Old evidence',next:'Prior skill'}},
 gradesV260:{S001:'manual'},participationV210:{S002:'makeup',S001:'present'},
 makeupBatchesV300:[{...batch,signature:sig,variantV300:'standard'}]};
const initial=structuredClone(privateBase);
assert.throws(()=>core.evaluate({batch,analysis:an,roster,linked,mapping,current:privateBase}),
 /Bisherige Arbeit ersetzen/);
assert.deepEqual(privateBase,initial,'preview must never mutate private records');
assert.throws(()=>core.evaluate({batch,analysis:an,roster,linked:{4:'S001',5:'S001'},
 mapping,current:privateBase,replacement:['S001']}),/Zwei Excel-Zeilen/);
assert.throws(()=>core.evaluate({batch,analysis:an,roster,linked:{4:'not-a-student'},
 mapping,current:privateBase}),/Teilnehmerliste/);
assert.throws(()=>core.evaluate({batch,analysis:an,roster,linked:{4:'S001'},
 mapping:{'item-one':1,'item-two':1},current:privateBase,replacement:['S001']}),/mehreren Aufgaben/);
assert.throws(()=>core.evaluate({batch,analysis:{items:[{...an.items[0],regularMax:4}]},
 roster,linked:{4:'S001'},mapping:{'item-one':1},current:privateBase,
 variant:'inclusion',replacement:['S001']}),/Punktemaximum/);
const inclusion=core.evaluate({batch,analysis:an,roster,linked:{5:'S002'},
 mapping,current:privateBase,variant:'inclusion'});
assert.equal(inclusion.chosen[0].variant,'inclusion');
assert.equal(inclusion.chosen[0].replace,false);
const proposal=core.evaluate({batch,analysis:an,roster,linked,mapping,
 current:privateBase,replacement:['S001']});
assert.equal(proposal.count,2);
assert.equal(proposal.chosen[0].replace,true);
assert.equal(proposal.chosen[1].replace,false);
const next=core.apply(privateBase,proposal,{id:'batch-1'});
assert.deepEqual(privateBase,initial,'evaluation and apply must never mutate existing private data');
assert.equal(next.scores.S001['item-one'],2);
assert.equal(next.scores.S001['item-two'],1);
assert.equal(next.scores.S004['item-one'],3,'unaffected existing student marks retained');
assert.equal(next.participationV210.S002,'present','makeup becomes present after confirmed import');
assert.equal(next.examAttemptsV300.S001.length,1);
assert.equal(next.examAttemptsV300.S001[0].data.feedbackV210.strength,'Old evidence');
assert.equal(next.examAttemptsV300.S001[0].data.paperScores['Paper-1'],2);
assert.equal(next.feedbackV210?.S001,undefined,'old personal text cleared after retake');
assert.equal(next.gradesV260?.S001,undefined,'old manual grade cleared after retake');
assert.equal(next.makeupBatchesV300[0].importedStudents.length,2);
assert.deepEqual(next.classtime,initial.classtime,'original Excel preserved');
assert.equal(core.isScore('0',2),0);assert.equal(core.isScore('',2),null);
assert.throws(()=>core.isScore('2,5',2),/außerhalb/);
console.log('Private makeup batches: exact Q maxima, explicit replacement, old attempt archive, original/classmates safe.');
