const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../schulcockpit-bewertung-v260-core.js');
const items=[
  {id:'A1',label:'Aufgabe 1',source:'classtime',regularMax:10,bonusMax:0,competencyId:'K1'},
  {id:'A2',label:'Aufgabe 2',source:'classtime',regularMax:5,bonusMax:0,competencyId:'K1'},
  {id:'B1',label:'Aufgabe 3',source:'paper',regularMax:10,bonusMax:0,competencyId:'K2'}
];
const competencies=[{id:'K1',text:'Rechnen'},{id:'K2',text:'Übertragen'}];
const raw={A1:8,A2:4,B1:6};
const compute=(input,lower)=>core.calculate(input,competencies,it=>raw[it.id],lower,{reachedMinPct:80,partialMinPct:50},p=>p>=80?'erreicht':p>=50?'teilweise erreicht':'noch nicht erreicht');
test('regular Classtime item reclassified as bonus preserves scores and original source',()=>{
  const old=compute(items,false),changed=structuredClone(items);
  changed[1].bonusInsteadV260=true;
  const result=compute(changed,false);
  assert.equal(old.totalMax,25);
  assert.equal(result.totalMax,20);
  assert.equal(result.totalReg,14);
  assert.equal(result.totalBonusEarned,4);
  assert.equal(result.totalAdjusted,18);
  assert.equal(result.totalPct,90);
  assert.equal(result.itemsV260[1].source,'classtime');
  assert.equal(result.itemsV260[1].earned,4);
  assert.equal(changed[1].source,'classtime');
  assert.deepEqual(raw,{A1:8,A2:4,B1:6});
});
test('grades 5–7 cap bonus within its own competency; higher grades cap globally',()=>{
  const changed=structuredClone(items);changed[1].bonusInsteadV260=true;
  raw.A1=10;raw.A2=5;raw.B1=4;
  try{
    const lower=compute(changed,true),higher=compute(changed,false);
    assert.equal(lower.totalMax,20);
    assert.equal(lower.totalAdjusted,14);
    assert.equal(higher.totalAdjusted,19);
    assert.equal(lower.competencies[0].adjusted,10);
    assert.equal(lower.competencies[1].adjusted,4);
  }finally{raw.A1=8;raw.A2=4;raw.B1=6;}
});
test('missing scores are not silently converted to zeros',()=>{
  const r=core.calculate(items,competencies,it=>it.id==='A2'?null:raw[it.id],true,{},()=> '');
  assert.equal(r.complete,false);
  assert.deepEqual(r.missing,['Aufgabe 2']);
  assert.equal(r.itemsV260[1].earned,null);
});
test('automatic grade requires a complete, ordered teacher scale',()=>{
  assert.equal(core.grade(83,undefined),'');
  assert.equal(core.grade(83,[95,80,65,50,25]),'2');
  assert.equal(core.grade(18,[95,80,65,50,25]),'6');
  assert.equal(core.grade(100,[95,80,65,50,25]),'1');
  assert.equal(core.validateScale([95,80,80,50,25]),false);
  assert.equal(core.validateScale([95,80,65,50,'']),false);
});
