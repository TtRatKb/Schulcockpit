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

const specialSheet={name:'S-EXTRA',rows:[
 [],['Name','Q1','Q2','Q3'],[],['Name','5','3','6'],
 ['Aster Vale',4,1,5],['Nova Reed',5,2,6]]};
const specialParsed={fileName:'synthetic-inclusion.xlsx',sheets:[
 specialSheet,
 {name:'Q1',rows:[['','','Frage 2 - Die fünf Säulen']]},
 {name:'Q2',rows:[['','','Bonusfrage 4b - Die fünfte Säule']]},
 {name:'Q3',rows:[['','','Frage 6 - Sachtext']]}]};
const specialDet={sheetIndex:0,headerRow:1,questionMaxRowV210:3,
 studentRows:[{rowIndex:4,name:'Aster Vale',row:specialSheet.rows[4]},
  {rowIndex:5,name:'Nova Reed',row:specialSheet.rows[5]}]};
const specialBatch={id:'batch-special',parsed:specialParsed,det:specialDet};
const specialItems=[
 {id:'spec-2',label:'Frage 2 · Die fünf Säulen',source:'classtime',regularMax:5},
 {id:'spec-4b',label:'Bonusfrage 4b · Die fünfte Säule',
  source:'classtime_bonus',regularMax:0,bonusMax:3},
 {id:'spec-6',label:'Frage 6 · Sachtext',source:'classtime',regularMax:6}];
const specialCols=core.columns(specialParsed,specialDet);
assert.equal(specialCols[1].description,'Bonusfrage 4b - Die fünfte Säule');
assert.deepEqual(core.autoMap(specialItems,specialCols),
 {'spec-2':1,'spec-4b':2,'spec-6':3},'semantic Q matching and scored bonus suggested');
assert.equal(core.itemMax(specialItems[1]),3);
assert.equal(core.importableItem(specialItems[1]),true);
assert.equal(core.importableItem({...specialItems[1],bonusMax:0}),false,
 'zero-point answer-sheet bonus stays manual');
assert.deepEqual(core.autoMap([specialItems[1]],
 [{index:2,label:'Q2',max:3,description:'Bonusfrage 4b'},
  {index:3,label:'Q3',max:3,description:'Bonusfrage 4b'}]),{},
 'ambiguous descriptions must never be silently mapped');
assert.deepEqual(core.autoMap([{...specialItems[2],regularMax:10}],specialCols),{},
 'changed maximum must not be silently accepted');
const specialMapping=core.autoMap(specialItems,specialCols);
const specialProposal=core.evaluate({batch:specialBatch,analysis:{items:specialItems},
 roster,linked:{5:'S002'},mapping:specialMapping,current:privateBase,
 variant:'file:synthetic-inclusion'});
assert.deepEqual(specialProposal.chosen[0].marks,{'spec-2':5,'spec-6':6});
assert.deepEqual(specialProposal.chosen[0].bonusMarks,{'spec-4b':2});
assert.equal(specialProposal.points,3);
const specialAfter=core.apply(privateBase,specialProposal,{id:'batch-special'});
assert.equal(specialAfter.bonusScores.S002['spec-4b'],2);
assert.equal(specialAfter.bonusOriginsV213.S002['spec-4b'],'excel-makeup-v300');
assert.equal(specialAfter.scores.S002['spec-2'],5);
assert.deepEqual(specialAfter.scores.S001,privateBase.scores.S001,
 'other children retain all regular marks');
assert.deepEqual(specialAfter.bonusScores.S001,privateBase.bonusScores.S001,
 'other children retain all bonus marks');
assert.deepEqual(privateBase,initial,'preview and application never mutate original');
const conflictingBonus={...privateBase,
 bonusScores:{...privateBase.bonusScores,S002:{'spec-4b':1}},
 activeVariantV300:{S002:'file:synthetic-inclusion'}};
assert.throws(()=>core.evaluate({batch:specialBatch,analysis:{items:specialItems},
 roster,linked:{5:'S002'},mapping:specialMapping,current:conflictingBonus,
 variant:'file:synthetic-inclusion'}),/Bisherige Arbeit ersetzen/,
 'conflicting bonus mark cannot be overwritten without explicit replacement');
const restoredManual={...privateBase,bonusScores:{...privateBase.bonusScores,
 S002:{'spec-4b':2}},bonusOriginsV213:{S002:{'spec-4b':'manual'}},
 activeVariantV300:{S002:'file:synthetic-inclusion'}};
const equalBonus=core.evaluate({batch:specialBatch,analysis:{items:specialItems},
 roster,linked:{5:'S002'},mapping:specialMapping,current:restoredManual,
 variant:'file:synthetic-inclusion'});
const equalAfter=core.apply(restoredManual,equalBonus,{id:'batch-special'});
assert.equal(equalAfter.bonusOriginsV213.S002['spec-4b'],'manual',
 'equal manual bonus and its provenance remain protected');

console.log('Private makeup batches: exact Q maxima, explicit replacement, old attempt archive, original/classmates safe.');
