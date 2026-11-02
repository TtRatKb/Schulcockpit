// Test v0.27.9: valid bonus-only subskill, invalid genuinely uncovered
// subskill, unchanged grading, and PDF/summary treatment without child data.
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../schulcockpit-bewertung-v260-core.js');
const c1={id:'overall',text:'Alltag der jüdischen Gemeinden'};
const c2={id:'bonus-part',text:'Einzelne Bräuche erläutern'};
const regular={id:'A1',label:'A1',source:'classtime',regularMax:8,bonusMax:0,competencyId:c1.id};
const bonus={id:'A2',label:'A2',source:'paper_bonus',regularMax:0,bonusMax:3,competencyId:c2.id};
const items=[regular,bonus];
const ctx={console,structuredClone,
 v200Step3:()=>'',v200Step5:()=>'<strong>Einzelne Bräuche erläutern</strong><span>0 erreicht · 0 teilweise · 0 noch nicht</span>',
 wire:()=>{},render:()=>{},v200Eval:{step:3},state:{settings:{schoolYear:'2026/27'}},
 document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]},
 v200Assessment:()=>null, v200EvalAnalysis:()=>null,
 v210StrictScore:v=>{if(v===''||v===undefined||v===null)return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null;},
 cls:()=>({name:'7a'}),v202Grade:()=>7,
 esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'),
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-aufgaben-autosave-v216.js'),'utf8'),ctx);
const draft={items:{A1:{source:'classtime',regularRaw:'8',bonusRaw:'0',competencyId:'overall'},
 A2:{source:'paper_bonus',regularRaw:'0',bonusRaw:'3',competencyId:'bonus-part'}}};
const result=ctx.v216DraftToItems({competencies:[c1,c2],items},draft,{});
assert.equal(result.errors.length,0,JSON.stringify(result.errors));
const none=ctx.v216DraftToItems({competencies:[c1,c2,{id:'missing'}],items},draft,{});
assert.match(none.errors.join(' '),/reguläre oder Bonus-Teilaufgabe/);
const allBonus=ctx.v216DraftToItems({competencies:[c1,c2],items:[
 {...regular,source:'paper_bonus',regularMax:0,bonusMax:8},bonus
 ]},{items:{A1:{source:'paper_bonus',regularRaw:'0',bonusRaw:'8',competencyId:'overall'},A2:draft.items.A2}},{});
assert.match(allBonus.errors.join(' '),/Mindestens eine regulär bewertete/);
const reclassified=[regular,{...bonus,source:'paper',regularMax:3,bonusMax:0,bonusInsteadV260:true}];
const reclassifiedResult=ctx.v216DraftToItems({competencies:[c1,c2],items:reclassified},
 {items:{A1:draft.items.A1,A2:{source:'paper',regularRaw:'3',bonusRaw:'0',competencyId:'bonus-part'}}},{});
assert.equal(reclassifiedResult.errors.length,0,JSON.stringify(reclassifiedResult.errors));
const report=core.calculate(items,[c1,c2],it=>it.id==='A1'?6:2,true,
 {reachedMinPct:70,partialMinPct:50},pct=>pct===null?'':pct>=70?'erreicht':pct>=50?'teilweise erreicht':'noch nicht erreicht');
const r1=report.competencies[0],r2=report.competencies[1];
assert.equal(r1.status,'erreicht');
assert.equal(r2.bonusOnly,true);
assert.equal(r2.status,'');
assert.equal(r2.regularMax,0);
assert.equal(r2.bonusMax,3);
assert.equal(r2.bonusEarned,2);
assert.equal(report.totalMax,8);
assert.equal(report.totalAdjusted,6,'Bonus-only must not affect standard scoring');
assert.equal(report.totalBonusEarned,2);
const zero=core.calculate(items,[c1,c2],it=>it.id==='A1'?0:0,true,
 {reachedMinPct:70,partialMinPct:50},pct=>pct===null?'':pct>=70?'erreicht':pct>=50?'teilweise erreicht':'noch nicht erreicht');
assert(zero.competencies[1].bonusOnly);
assert.equal(zero.competencies[1].status,'','Bonus-only must NOT be NNE');
ctx.v202Grade=()=>7;
vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-bonuskompetenzen-v279.js'),'utf8'),ctx);
assert.match(ctx.v200Step5({evaluationV200:{analysis:{competencies:[c1,c2],items}},classId:'c'},{}),/Nur Bonus · keine E\/TE\/NNE-Einstufung/);
assert.match(ctx.v200Step3({evaluationV200:{analysis:{competencies:[c1,c2],items}}},{}),/Nur über Bonusaufgaben/);
const pdf=fs.readFileSync(path.join(__dirname,'../schulcockpit-report-pdf-v233.js'),'utf8');
assert(pdf.includes('c=>Number(c.regularMax)>0||c.bonusOnly'));
assert(pdf.includes("c.bonusOnly?'Bonus':tag"));
assert(pdf.includes('c.bonusOnly?c.bonusMax:c.regularMax'));
console.log('Bonus-only subskills: grading, coverage, screen status and PDF selection passed');
