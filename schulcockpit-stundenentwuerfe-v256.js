/* Schulcockpit V0.25.6 – durable four-step lesson/PPT workflow.
   Stores only step number and imported teacher draft in local IDB; never
   stores student names or regenerates PPT automatically. */
(function(){
'use strict';
const PREFIX='__sc_lesson_wizard_v256__:';
let timer=null,queue=Promise.resolve(),restoring=0;
function key(id){return PREFIX+id;}
function warn(e){
 console.warn('Stunden-Assistent nicht gespeichert:',e);
 if(!document.body)return;
 let node=document.getElementById('v256-warning');
 if(!node){node=document.createElement('div');node.id='v256-warning';document.body.appendChild(node);
  node.style.cssText='position:fixed;bottom:15px;right:15px;z-index:100010;padding:12px;border:2px solid #ab3a33;background:white;max-width:470px;border-radius:9px';}
 node.textContent='⚠ Der Stunden-Arbeitsstand konnte nicht gespeichert werden. Bitte den ChatGPT-Text vor dem Schließen separat sichern.';
}
function snapshot(){
 if(!wizardV14?.lessonId||!lesson(wizardV14.lessonId))return null;
 return {schema:'schulcockpit.lesson-wizard.draft.v1',lessonId:wizardV14.lessonId,
  step:Number(wizardV14.step)||1,raw:String(wizardV14.raw||''),
  freePlanningV258:!!lesson(wizardV14.lessonId)?.freePlanningV258};
}
function persist(value){
 if(!value)return;
 queue=queue.catch(()=>{}).then(async()=>{
  const raw=JSON.stringify(value);
  if(raw.length>6*1024*1024)throw Error('Stundenentwurf überschreitet 6 MB.');
  await fileStorePut(key(value.lessonId),new File([raw],'Stunden-Entwurf.json',{type:'application/json'}));
  document.getElementById('v256-warning')?.remove();
 }).catch(warn);
}
function checkpoint(){
 if(restoring||view!=='assistant'||!wizardV14?.lessonId||typeof setTimeout!=='function')return;
 if(timer)clearTimeout(timer);
 const value=snapshot(); // capture before switching to another lesson
 timer=setTimeout(()=>{timer=null;persist(value);},250);
}
const oldOpen=openWizardV14;
openWizardV14=function(id,step=1){
 if(!lesson(id))return oldOpen(id,step);
 if(wizardV14?.lessonId===id&&view!=='assistant'&&Number(wizardV14.step)>1){
  view='assistant';render();return;
 }
 if(timer){clearTimeout(timer);timer=null;}
 restoring++;
 const ticket=restoring;
 oldOpen(id,step);
 void(async()=>{
  try{
   await queue.catch(()=>{});
   const saved=await fileStoreGet(key(id));
   if(!saved?.blob||ticket!==restoring||view!=='assistant'||wizardV14?.lessonId!==id)return;
   const data=JSON.parse(await saved.blob.text());
   if(data.schema!=='schulcockpit.lesson-wizard.draft.v1'||data.lessonId!==id||
     ![1,2,3,4].includes(Number(data.step))||typeof data.raw!=='string'||
     !!data.freePlanningV258!==!!lesson(id)?.freePlanningV258)return;
   wizardV14.step=data.step;wizardV14.raw=data.raw;wizardV14.parsed=null;
   // Step 3 must be explicitly parsed and reviewed again before importing.
   render();
  }catch(e){console.warn('Stunden-Assistent konnte nicht wiederhergestellt werden:',e);}
  finally{if(ticket===restoring){restoring=0;checkpoint();}}
 })();
};
document.addEventListener('input',event=>{
 if(view!=='assistant'||event.target?.id!=='v14-answer'||wizardV14.step!==3)return;
 wizardV14.raw=event.target.value;wizardV14.parsed=null;
 checkpoint();
});
const oldRender=render;
render=function(){
 oldRender();
 checkpoint();
 const badge=document.querySelector('.brand small');
 if(badge)badge.textContent=state.settings.schoolYear+' · V0.25.8';
};
})();
