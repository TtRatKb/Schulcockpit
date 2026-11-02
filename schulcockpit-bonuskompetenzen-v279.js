/* Schulcockpit V0.27.9 – only-bonus subcompetencies remain visible without
 * forcing regular points or pretending a competence was failed. */
(function(){
'use strict';
function bonusRows(an,draft=null){
 const rows=new Map((an?.competencies||[]).map(c=>[c.id,{text:c.text,regular:0,bonus:0}]));
 for(const it of an?.items||[]){
  const d=draft?.items?.[it.id]||{},id=d.competencyId||it.competencyId,
   group=rows.get(id);
  if(!group)continue;
  const kind=d.source||it.source,bonus=kind.endsWith('_bonus')||!!it.bonusInsteadV260,
   max=Number(bonus?(kind.endsWith('_bonus')?(d.bonusRaw??it.bonusMax):(d.regularRaw??it.regularMax)):(d.regularRaw??it.regularMax));
  if(!Number.isFinite(max)||max<=0)continue;
  if(bonus)group.bonus+=max;else group.regular+=max;
 }
 return [...rows.entries()].filter(([,x])=>x.regular===0&&x.bonus>0);
}
const oldStep3=v200Step3;
v200Step3=function(a,priv){
 const html=oldStep3(a,priv),list=bonusRows(a?.evaluationV200?.analysis,a?.itemDraftV216);
 if(!list.length)return html;
 const note='<section class="detail-section"><strong>Nur über Bonusaufgaben geprüfte Unterkompetenzen</strong>'+
  '<p>Diese Rasterzeilen sind zulässig. Sie werden im Kompetenzbogen als „Nur Bonus“ ausgewiesen, '+
  'ohne E/TE/NNE-Bewertung. Ihre Bonuspunkte verändern die reguläre Höchstpunktzahl nicht.</p>'+
  '<p class="microcopy">'+list.map(([,r])=>esc(r.text)).join(' · ')+'</p></section>';
 return note+html;
};
const oldStep5=v200Step5;
v200Step5=function(a,priv){
 let html=oldStep5(a,priv),an=a?.evaluationV200?.analysis;
 if(v202Grade(cls(a?.classId))>7||!an)return html;
 for(const [id,r] of bonusRows(an)){
  const target='<strong>'+esc(r.text)+'</strong><span>0 erreicht · 0 teilweise · 0 noch nicht</span>';
  const corrected='<strong>'+esc(r.text)+'</strong><span>Nur Bonus · keine E/TE/NNE-Einstufung</span>';
  html=html.replace(target,corrected);
 }
 return html;
};
const oldRender=render;
render=function(){
 oldRender();
 const label=document.querySelector('.brand small');
 if(label)label.textContent=state.settings.schoolYear+' · V0.27.9';
};
window.SchulcockpitBonusSubskillsV279={bonusRows};
})();
