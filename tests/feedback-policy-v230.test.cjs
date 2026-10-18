/* Run with: node tests/feedback-policy-v230.test.cjs
 * Synthetic reports only. Does not require a browser or real pupil data.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const filename=path.join(__dirname,'..','schulcockpit-feedback-policy-v230.js');

function pick(options,seed,salt=0){
  let mixed=(seed ^ Math.imul(salt+1,0x9e3779b1))>>>0;
  mixed^=mixed>>>16;
  mixed=Math.imul(mixed,0x7feb352d);
  mixed^=mixed>>>15;
  return options[(mixed>>>0)%options.length];
}
function seed(report){
  let hash=2166136261;
  for(const c of String(report.student?.id||'feedback'))
    hash=Math.imul(hash^c.charCodeAt(0),16777619);
  return hash>>>0;
}
function clean(text){
  return String(text||'').trim().replace(/^(?:Du kannst|Ich kann)\s+/i,'')
    .replace(/[.!]\s*$/,'').trim();
}
const ctx={
  v224Suggestions:null,v224DefaultFeedback:null,v224FeedbackPrompt:null,
  v200Step5:()=>'Alle erreichten und noch nicht erreichten Kompetenzen fließen in die Vorschläge ein.',
  v224Clean:clean,v227Pick:pick,v227Seed:seed,
  v229Upper:t=>t.charAt(0).toUpperCase()+t.slice(1),
  v225Band:c=>{
    if(c.status==='erreicht')return c.pct>=99.999?'perfect':'reached';
    if(c.status==='teilweise erreicht')return 'partial';
    if(c.status==='noch nicht erreicht')return c.pct===0?'zero':c.pct<=25?'weak':'practice';
    return 'open';
  },
  render:()=>{}
};
vm.runInNewContext(fs.readFileSync(filename,'utf8'),ctx,{filename});
const texts=[
  'Du kannst am Zahlenstrahl ablesen und mit der Stellenwerttafel arbeiten.',
  'Du kannst Zahlen runden.',
  'Du kannst mathematische Fachbegriffe verwenden.',
  'Du kannst schriftlich addieren.',
  'Du kannst schriftlich subtrahieren.'
];
function report(id,pcts,opts={}){
  const competencies=pcts.map((pct,i)=>{
    const regularMax=opts.maxes?.[i]??10;
    return {id:'C'+i,text:opts.labels?.[i]||texts[i],pct,regularMax,
      regularEarned:opts.regular?.[i]??regularMax*pct/100,
      status:pct>=70?'erreicht':pct>=50?'teilweise erreicht':'noch nicht erreicht',
      auditV210:i===0?(opts.bonus||[]).map(([earned,max])=>
        ({source:'paper_bonus',earned,max})):[]};
  });
  return {student:{id},competencies,
    totalMax:opts.totalMax??competencies.reduce((x,c)=>x+c.regularMax,0),
    totalReg:opts.totalReg??competencies.reduce((x,c)=>x+c.regularEarned,0),
    complete:opts.complete!==false};
}
const full=report('all',[100,100,100,100,100],
  {maxes:[10,10,10,10,11],regular:[10,10,10,10,11],
   totalMax:51,totalReg:51,bonus:[[5,5],[6,6],[4,4],[2.5,5]]});
const adjusted=report('adjusted',[100,100,100,100,100],
  {totalReg:40,bonus:[[5,5],[6,6],[4,4],[2.5,5]]});
const allBonus=report('allbonus',[100,100,100,100,100],
  {bonus:[[5,5],[4,4]]});
const cases={
  full,adjusted,allBonus,
  four:report('four',[100,90,80,70,40]),
  three:report('three',[100,95,75,40,20]),
  two:report('two',[90,75,30,0,50]),
  one:report('one',[0,0,0,85,30]),
  oneOfNine:report('11-percent',[100/9],
    {labels:['Du kannst Zahlen runden.'],maxes:[9],regular:[1]}),
  zero:report('zero',[0,0,0,0,0]),
  partial:report('partial',[60,60,55,40,20]),
  noBonus:report('nobonus',[100,100,100,100,100]),
  unknown:report('unknown',[80,10],
    {labels:['Du kannst mit Proportionalitäten argumentieren.','Du kannst lineare Funktionen untersuchen.']}),
  incomplete:report('incomplete',[100,100,100,100,100],{complete:false})
};
const output=Object.fromEntries(Object.entries(cases)
  .map(([name,data])=>[name,ctx.v230DefaultFeedback(data)]));
for(const [name,feedback] of Object.entries(output)){
  assert.ok(feedback.strength.length<=900&&feedback.next.length<=900,name+' length');
  assert.ok((feedback.strength.match(/!/g)||[]).length+
    (feedback.next.match(/!/g)||[]).length<=2,name+' punctuation');
  assert.ok(!/^(?:Auch|Außerdem)\b/.test(feedback.strength),name+' dangling connector');
  assert.ok(!/\bwir\b|\bgemeinsam\b/i.test(feedback.next),name+' independent task');
  assert.ok(!/(?:Klasse|Super)\.$/.test(feedback.strength),name+' awkward cheer');
}
assert.match(output.full.strength,/allen Kompetenzbereichen|alle Kompetenzbereiche/);
assert.doesNotMatch(output.full.strength,/Zahlenstrahl|Runden von Zahlen|schriftlichen Addieren/);
assert.match(output.full.strength,/regulären Punkte|reguläre Punktzahl/);
assert.match(output.full.strength,/3 Bonusaufgaben/);
assert.doesNotMatch(output.adjusted.strength,/alle regulären Punkte|reguläre Punktzahl/);
assert.match(output.allBonus.strength,/Bonus/);
assert.match(output.four.strength,/meisten/);
assert.match(output.three.strength,/mehreren/);
assert.match(output.one.strength,/Addieren/);
assert.match(output.oneOfNine.next,/Runden/);
assert.match(output.oneOfNine.next,/selbst/);
assert.doesNotMatch(output.zero.strength,/erste Punkte|einige Punkte|Punkte erreicht/);
assert.doesNotMatch(output.noBonus.strength,/Bonus/);
assert.match(output.unknown.strength,/„mit Proportionalitäten argumentieren“/);
assert.match(ctx.v200Step5(),/Die Tabelle zeigt alle Kompetenzen/);
assert.match(ctx.v224FeedbackPrompt(cases.three),/NICHT alle aufzählen/);
const previous=JSON.stringify(full);
ctx.v230DefaultFeedback(full);
assert.equal(JSON.stringify(full),previous,'no report mutation');
const many=Array.from({length:27},(_,i)=>
  ctx.v230DefaultFeedback({...full,student:{id:'anonymous-'+i}}).strength);
assert.ok(new Set(many).size>=8,'variety across 27 synthetic students');
assert.equal(ctx.v230DefaultFeedback(full).strength,output.full.strength,'determinism');
console.log('PASS – V0.23.0 feedback policy: 13 profiles, 27 synthetic students');
