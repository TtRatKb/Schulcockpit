const assert=require('node:assert/strict');
const {test}=require('node:test');
const c=require('../schulcockpit-aufgabeneditor-v334-core.js');
const items=[{id:'A1',label:'Aufgabe 1',source:'classtime',regularMax:4,competencyId:'K1',taskText:'Alt',classtimeAliases:['Q1']},{id:'A2',label:'Aufgabe 2',source:'paper_bonus',regularMax:0,bonusMax:2,competencyId:'K2'}];
const row={id:'A1',label:'Aufgabe 1',source:'classtime',taskText:'Original <Text>\nAntwortoptionen'};
const wrap=(items,examId='exam7',extras={})=>'<SCHULCOCKPIT_TASK_TEXTS>'+JSON.stringify({schema:'schulcockpit.task-texts.v1',examId,items,...extras})+'</SCHULCOCKPIT_TASK_TEXTS>';
test('prompt carries exact task identities and no scores or competency metadata',()=>{
 const p=c.taskTextPrompt('exam7',items);
 assert.match(p,/"examId": "exam7"/);assert.match(p,/"id": "A2"/);
 assert.doesNotMatch(p,/regularMax|competencyId|classtimeAliases|"Alt"/);
});
test('rejects wrong exam, duplicate/unknown IDs, changed labels/sources, other metadata, malformed blocks',()=>{
 for(const raw of [wrap([row],'other'),wrap([row,row]),wrap([{...row,id:'wrong'}]),wrap([{...row,label:'Aufgabe 9'}]),wrap([{...row,source:'paper'}]),wrap([{...row,regularMax:99}]),wrap([row],'exam7',{competencies:[]}),wrap([{...row,taskText:''}]),'invalid',wrap([row])+wrap([row])])assert.throws(()=>c.parseTaskTexts(raw,'exam7',items));
});
test('partial import changes only task text, preserves score drafts, bonus, ids and original object',()=>{
 const draft={schema:1,items:{A1:{original:'3',mode:'partial',bonus:'1',taskText:'Draft'},A2:{original:'2'}}};
 const old=structuredClone({items,draft});
 const updates=c.parseTaskTexts(wrap([row,{id:'A2',label:'Aufgabe 2',source:'paper_bonus',taskText:''}]),'exam7',items);
 const next=c.patchTaskTexts(items,draft,updates);
 assert.deepEqual(next.items,[{...items[0],taskText:row.taskText},items[1]]);
 assert.deepEqual(next.draft,{...draft,items:{...draft.items,A1:{...draft.items.A1,taskText:row.taskText}}});
 assert.deepEqual({items,draft},old);
 assert.equal(c.patchTaskTexts(items,undefined,updates).draft,undefined);
});
