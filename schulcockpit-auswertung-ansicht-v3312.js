/* V0.33.12: keep the teacher's place during same-step evaluation edits.
 * UI-only. Nothing is written to student or examination storage.
 * Actual step, examination and version navigation intentionally starts fresh.
 */
(function(){
'use strict';
let restoring=false;
let pendingFocus=null;
const scope=()=>document.querySelector('.v214-evaluation-workspace');
const kind=()=>window.SchulcockpitExamTabsV338?.activeKind?.()||'standard';
function detailKey(detail,index){
 if(detail.matches('.v335-details')){
  const text=detail.querySelector('summary')?.textContent||'';
  return text.startsWith('Reguläre Arbeit')?'v335:standard':'v335:special';
 }
 const markers=[
  ['data-v317-score-save','score'],
  ['data-v317-copy','rubric'],
  ['data-v300-variant','batch'],
  ['data-v300-commit','batch'],
  ['data-v318-student','pupil'],
  ['data-v334-task','task']
 ];
 for(const [attr,label] of markers){
  const value=detail.querySelector('['+attr+']')?.getAttribute(attr);
  if(value)return label+':'+value;
 }
 // Identical page and step: DOM order is stable for remaining generic details.
 return 'detail:'+index;
}
function snapshot(){
 const root=scope();
 if(view!=='evaluation'||!v200Eval||!root)return null;
 const details=[...root.querySelectorAll('details')];
 const open=new Map(details.map((element,index)=>[detailKey(element,index),element.open]));
 const selected=document.activeElement;
 const editable=selected?.closest?.('[data-v335-status],[data-v317-score],[data-v300-link],[data-v300-map],[data-v337-part],[data-v260-grade],[data-v318-student]');
 const attribute=editable&&[...editable.attributes].find(attr=>attr.name.startsWith('data-v')&&
   /^(data-v335-status|data-v317-score|data-v300-link|data-v300-map|data-v337-part|data-v260-grade|data-v318-student)$/.test(attr.name));
 const remembered=pendingFocus&&pendingFocus.examId===v200Eval.assessmentId&&
   pendingFocus.step===v200Eval.step&&pendingFocus.kind===kind()?
   {name:pendingFocus.name,value:pendingFocus.value}:null;
 const scrollables=[document.scrollingElement,...document.querySelectorAll(
  '.v214-workspace-content,.v210-scroll,.v334-table-scroll,.app-main,.main-content')].filter(Boolean);
 const scroll=scrollables.map((node,index)=>({index,top:node.scrollTop,left:node.scrollLeft}));
 return {examId:v200Eval.assessmentId,step:v200Eval.step,kind:kind(),open,
  focus:attribute?{name:attribute.name,value:attribute.value}:remembered,scroll};
}
function restore(saved){
 if(!saved||view!=='evaluation'||!v200Eval||v200Eval.assessmentId!==saved.examId||
    v200Eval.step!==saved.step||kind()!==saved.kind)return;
 const root=scope();if(!root)return;
 const details=[...root.querySelectorAll('details')];
 for(const [index,element] of details.entries()){
  const key=detailKey(element,index);
  if(saved.open.has(key))element.open=saved.open.get(key);
 }
 if(saved.focus){
  const target=[...root.querySelectorAll('['+saved.focus.name+']')].find(element=>
    element.getAttribute(saved.focus.name)===saved.focus.value);
  if(target&&!target.disabled)target.focus({preventScroll:true});
  pendingFocus=null;
 }
 const scrollables=[document.scrollingElement,...document.querySelectorAll(
  '.v214-workspace-content,.v210-scroll,.v334-table-scroll,.app-main,.main-content')].filter(Boolean);
 for(const position of saved.scroll){
  const el=scrollables[position.index];
  if(el){el.scrollTop=position.top;el.scrollLeft=position.left;}
 }
}
// Read the changed field before legacy async handlers disable and blur it.
document.addEventListener('change',event=>{
 const root=scope(),element=event.target;
 if(view!=='evaluation'||!v200Eval||!root?.contains(element))return;
 const match=['data-v335-status','data-v318-student','data-v300-variant',
  'data-v260-grade','data-v317-score','data-v300-link','data-v300-map']
  .find(attr=>element.hasAttribute?.(attr));
 if(match)pendingFocus={examId:v200Eval.assessmentId,step:v200Eval.step,
  kind:kind(),name:match,value:element.getAttribute(match)};
},true);
const previousRender=render;
render=function(...args){
 if(restoring)return previousRender(...args);
 const before=snapshot();
 const result=previousRender(...args);
 if(before){
  restoring=true;
  try{restore(before);}
  finally{restoring=false;}
 }
 return result;
};
window.SchulcockpitEvaluationViewV3312={detailKey};
render();
})();
