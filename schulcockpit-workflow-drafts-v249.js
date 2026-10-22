/* Schulcockpit V0.24.9 – recoverable sequence planning and evaluation progress.
   Local metadata/AI drafts only. Pupil names and results remain in the existing private DB. */
(function(){
'use strict';
const PREFIX='__sc_workflow_v249__:';
let timer=null,writing=Promise.resolve(),restoring=0;
function key(kind,id){return PREFIX+kind+':'+id;}
function selectedSequenceKey(){
  if(!v184Flow?.courseId)return '';
  return key('sequence',v184Flow.courseId+'|'+(v184Flow.sequenceId||'new'));
}
function enqueue(k,obj){
  writing=writing.catch(()=>{}).then(async()=>{
    const raw=JSON.stringify(obj);
    if(raw.length>6*1024*1024)throw Error('Planungsentwurf ist zu groß.');
    await fileStorePut(k,new File([raw],'Workflow-Entwurf.json',{type:'application/json'}));
  }).catch(e=>console.warn('Arbeitsstand nicht gesichert:',e));
}
function checkpoint(){
  if(restoring)return;
  if(modal?.type==='sequenceAiV184'&&v184Flow?.step===0)v184CaptureSetup();
  if(timer)clearTimeout(timer);
  timer=setTimeout(()=>{
    timer=null;if(restoring)return;
    if(v184Flow?.courseId&&v184Flow.step>=0){
      enqueue(selectedSequenceKey(),{
        schema:'schulcockpit.sequence.draft.v1',savedAt:new Date().toISOString(),
        courseId:v184Flow.courseId,sequenceId:v184Flow.sequenceId||'',
        draft:JSON.parse(JSON.stringify(v184Flow))
      });
    }
    if(v200Eval?.assessmentId&&Number(v200Eval.step)>0){
      enqueue(key('evaluation',v200Eval.assessmentId),{
        schema:'schulcockpit.evaluation.progress.v1',step:Number(v200Eval.step),
        studentIndex:Number(v200Eval.studentIndex)||0});
    }
  },280);
}
async function read(k){
  const rec=await fileStoreGet(k);
  if(!rec?.blob)return null;
  try{return JSON.parse(await rec.blob.text());}catch(_){return null;}
}
const formerOpen=v184Open;
v184Open=function(courseId='',qid=''){
  const c=cls(courseId)||state.classes.find(c=>c.subject&&!/^ga$/i.test(c.subject));
  const same=c&&v184Flow?.courseId===c.id&&
    (v184Flow.sequenceId||'')===(qid||'')&&v184Flow.step>0;
  if(same){modal={type:'sequenceAiV184'};render();return;}
  const ticket=++restoring;
  formerOpen(courseId,qid);
  if(!v184Flow?.courseId){restoring=0;return;}
  const id=v184Flow.courseId,seqId=v184Flow.sequenceId||'';
  void (async()=>{
    try{
      await writing.catch(()=>{});
      const data=await read(key('sequence',id+'|'+(seqId||'new')));
      if(!data||restoring!==ticket||modal?.type!=='sequenceAiV184'||
        v184Flow.courseId!==id||(v184Flow.sequenceId||'')!==seqId)return;
      if(data.schema!=='schulcockpit.sequence.draft.v1')return;
      const draft=data.draft;
      if(!draft||draft.courseId!==id||(draft.sequenceId||'')!==seqId||
        ![0,1,2].includes(draft.step))return;
      v184Flow={...v184Flow,...draft};
      // Every saved import preview must be revalidated against current material IDs.
      if(v184Flow.step===2&&!v184Flow.pkg)v184Flow.step=1;
      render();
    }catch(e){console.warn('Reihenplanungsentwurf konnte nicht gelesen werden',e);}
    finally{if(restoring===ticket){restoring=0;checkpoint();}}
  })();
};
const originalApply=v184Apply;
v184Apply=async function(){
  const k=selectedSequenceKey(),out=await originalApply();
  if(timer){clearTimeout(timer);timer=null;}
  await writing.catch(()=>{});
  if(k)await fileStoreDelete(k).catch(e=>console.warn('Alter Reihenentwurf konnte nicht gelöscht werden',e));
  v184Flow.step=-1; // Do not recreate an already completed import.
  return out;
};
const formerEval=v200OpenEval;
v200OpenEval=async function(id){
  const same=v200Eval?.assessmentId===id&&Number(v200Eval.step)>0;
  const step=same?v200Eval.step:0,index=same?v200Eval.studentIndex:0;
  await formerEval(id);
  if(same){v200Eval.step=step;v200Eval.studentIndex=index;render();return;}
  try{
    const data=await read(key('evaluation',id));
    if(v200Eval?.assessmentId===id&&data?.schema==='schulcockpit.evaluation.progress.v1'){
      v200Eval.step=Math.max(1,Math.min(5,Number(data.step)||1));
      v200Eval.studentIndex=Math.max(0,Number(data.studentIndex)||0);
      render();
    }
  }catch(e){console.warn('Auswertungsschritt konnte nicht wiederhergestellt werden',e);}
};
const oldRender=render;
render=function(){oldRender();const badge=document.querySelector('.brand small');if(badge)badge.textContent=state.settings.schoolYear+' · V0.24.9';checkpoint();};
const oldWire=wire;
wire=function(){
  oldWire();
  const fields=document.querySelectorAll('.v184-modal input,.v184-modal textarea,.v184-modal select');
  fields.forEach(el=>{if(el.type!=='file')el.addEventListener('input',checkpoint);});
  document.querySelector('#v184-file')?.addEventListener('change',checkpoint);
};
})();
