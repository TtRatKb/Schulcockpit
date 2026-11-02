/* V0.28.2 – earned bonus is not discarded when individual tasks become bonus.
 * Fully synthetic test data. No student identifiers or actual scores. */
const assert=require('node:assert/strict');
const core=require('../schulcockpit-bewertung-v260-core.js');
const individual=require('../schulcockpit-bewertung-v267-core.js');
const comp=[{id:'daily',text:'Alltag'},{id:'rituals',text:'Bräuche'}];
const task=(id,c,max,source='classtime')=>({id,label:id,competencyId:c,
 source,regularMax:source.endsWith('_bonus')?0:max,bonusMax:source.endsWith('_bonus')?max:0});
const status=p=>p==null?'':p>=70?'erreicht':p>=50?'teilweise erreicht':'noch nicht erreicht';
function run(items,scores,overrides={},isLower=true){
 return individual.compute(items,comp,it=>scores[it.id],overrides,isLower,{reachedMinPct:70,partialMinPct:50},status);
}
{
 // 2 out of 4 marks: move the possible 4 points OUT of the denominator,
 // but the 2 actual achieved marks remain counted as bonus.
 const items=[task('A','daily',6),task('B','daily',4),task('C','rituals',5)];
 const scores={A:3,B:2,C:0};
 const before=run(items,scores),after=run(items,scores,{B:{mode:'bonus'}});
 assert.equal(before.totalReg,5);assert.equal(before.totalMax,15);
 assert.equal(after.totalReg,3);assert.equal(after.totalBonusEarned,2);
 assert.equal(after.totalEarned,5);assert.equal(after.totalBonusUsed,2);
 assert.equal(after.totalAdjusted,5);assert.equal(after.totalMax,11);
 assert.equal(after.totalPct,100*5/11);
 assert.equal(after.competencies[0].regularMax,6);
 assert.equal(after.competencies[0].regularEarned,3);
 assert.equal(after.competencies[0].bonusEarned,2);
 assert.equal(after.competencies[0].pct,100*5/6);
 assert.equal(after.competencies[1].status,'noch nicht erreicht');
 assert.equal(items[1].bonusInsteadV260,undefined);
 assert.equal(scores.B,2,'original marks unchanged');
}
{
 // 2 out of 5 marks in a COMPETENCE that becomes entirely bonus:
 // still eligible in total; but the competence must not be mislabeled E/NNE.
 const items=[task('A','daily',6),task('B','rituals',5)];
 const scores={A:3,B:2};
 const r=run(items,scores,{B:{mode:'bonus'}});
 assert.equal(r.totalReg,3);assert.equal(r.totalBonusEarned,2);
 assert.equal(r.totalAdjusted,5);assert.equal(r.totalMax,6);
 assert.equal(r.competencies[1].bonusOnly,true);
 assert.equal(r.competencies[1].status,'');
 assert.equal(r.competencies[0].status,'teilweise erreicht');
}
{
 // The 0-point bonus is not falsely made positive; denominator still shrinks.
 const items=[task('A','daily',6),task('B','rituals',5)];
 const scores={A:3,B:0};
 const r=run(items,scores,{B:{mode:'bonus'}});
 assert.equal(r.totalBonusEarned,0);assert.equal(r.totalAdjusted,3);
 assert.equal(r.totalMax,6);assert.equal(r.competencies[1].bonusOnly,true);
}
{
 // A child's bonus cannot falsely change the competency status of another area.
 // It DOES count toward the overall points, which is separate from E/TE/NNE.
 const items=[task('A','daily',4),task('B','daily',3),task('C','rituals',4)];
 const scores={A:4,B:3,C:0};
 const r=run(items,scores,{B:{mode:'bonus'}});
 assert.equal(r.totalEarned,7);assert.equal(r.totalAdjusted,7);
 assert.equal(r.totalMax,8);assert.equal(r.competencies[0].status,'erreicht');
 assert.equal(r.competencies[1].status,'noch nicht erreicht');
 assert.equal(r.competencies[0].adjusted,4,'competence E/TE/NNE is capped locally');
 assert.equal(r.totalBonusUsed,3,'overall bonus no longer silently discarded');
}
{
 // Limit credit to 100%, but make ALL raw bonus marks visible.
 const items=[task('A','daily',8),task('B','rituals',5,'paper_bonus')];
 const scores={A:8,B:5};
 const r=run(items,scores);
 assert.equal(r.totalEarned,13);
 assert.equal(r.totalBonusEarned,5);
 assert.equal(r.totalAdjusted,8);assert.equal(r.totalBonusUsed,0);
 assert.equal(r.totalBonusUnused,5);assert.equal(r.totalPct,100);
 assert.equal(r.competencies[1].bonusOnly,true);
}
{
 // Original bonus Q15/Q16, post-hoc classwide bonus Q13, individual Q12.
 const items=[task('Q11','daily',6),task('Q12','daily',4),
  {...task('Q13','rituals',5),bonusInsteadV260:true},
  task('Q15','rituals',2,'classtime_bonus'),task('Q16','rituals',1,'paper_bonus')];
 const scores={Q11:2,Q12:1,Q13:3,Q15:2,Q16:0};
 const r=run(items,scores,{Q12:{mode:'bonus'}});
 assert.equal(r.totalReg,2);
 assert.equal(r.totalBonusEarned,6);
 assert.equal(r.totalEarned,8);
 assert.equal(r.totalMax,6);
 assert.equal(r.totalAdjusted,6);
 assert.equal(r.totalBonusUnused,2);
 assert.equal(r.competencies[1].bonusEarned,5);
 assert.equal(r.competencies[1].bonusOnly,true);
 assert.equal(r.competencies[1].status,'');
 assert.equal(r.itemsV260.find(x=>x.id==='Q13').earned,3);
 assert.equal(r.itemsV260.find(x=>x.id==='Q15').earned,2);
 assert.equal(r.itemsV260.find(x=>x.id==='Q12').earned,1);
 const otherChild=run(items,scores);
 assert.equal(otherChild.totalMax,10);
 assert.equal(otherChild.totalReg,3);
 assert.equal(otherChild.totalEarned,8);
}
{
 // >=8 still caps globally, even with individually converted tasks.
 const items=[task('A','daily',6),task('B','rituals',4)];
 const r=run(items,{A:3,B:2},{B:{mode:'bonus'}},false);
 assert.equal(r.totalEarned,5);assert.equal(r.totalAdjusted,5);
 assert.equal(r.totalMax,6);
}
{
 // Missing score is not silently treated as zero.
 const items=[task('A','daily',6),task('B','rituals',2,'paper_bonus')];
 const r=run(items,{A:3,B:null});
 assert.equal(r.complete,false);
 assert.deepEqual(r.missing,['B']);
}
console.log('V0.28.2: earned bonus fully preserved; denominators, capping, original/native/individual bonus, grade-7 statuses pass');