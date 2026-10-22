/* Schulcockpit V0.25.5 – local, resumable AI-import and setup dialogs.
   Deliberately stores only drafts, never applies imported content automatically. */
(function(){
'use strict';
const PREFIX='__sc_wizard_draft_v255__:';
const supported=new Set(['ai-import','setup-import','planV182']);
let queue=Promise.resolve(),timer=null,restoring=0,completedType='';
function key(type,id=''){return PREFIX+type+':'+(id||'global');}
function current(){
 if(!modal||!supported.has(modal.type))return null;
 if(modal.type==='planV182')return {type:'planV182',id:'',payload:v182PlanPackage||null};
 return {type:modal.type,id:modal.type==='ai-import'?modal.id:'',raw:String(modal.raw||'')};
}
function warning(error){
 console.warn('Dialogentwurf konnte nicht gespeichert werden:',error);
 if(typeof document==='undefined'||!document.body)return;
 let el=document.getElementById('v255-warning');
 if(!el){el=document.createElement('div');el.id='v255-warning';document.body.appendChild(el);
 el.style.cssText='position:fixed;right:14px;bottom:14px;z-index:100000;padding:12px;max-width:480px;background:#fff;border:2px solid #b33;border-radius:9px';}
 el.textContent='⚠ Dieser Import-Arbeitsstand konnte nicht lokal gesichert werden. Bitte Originaldatei bzw. Text separat aufbewahren.';
}
function put(snapshot){
 if(!snapshot||!snapshot.id&&snapshot.type==='ai-import')return;
 queue=queue.catch(()=>{}).then(async()=>{
  const raw=JSON.stringify({schema:'schulcockpit.import-dialog.v1',savedAt:new Date().toISOString(),...snapshot});
  if(raw.length>6*1024*1024)throw Error('Importentwurf überschreitet 6 MB.');
  await fileStorePut(key(snapshot.type,snapshot.id),new File([raw],'Lokaler-Importentwurf.json',{type:'application/json'}));
  if(typeof document!=='undefined')document.getElementById('v255-warning')?.remove();
 }).catch(warning);
}
function schedule(){
 if(restoring||typeof setTimeout!=='function')return;
 if(timer)clearTimeout(timer);
 const snapshot=current();
 if(!snapshot)return;
 timer=setTimeout(()=>{timer=null;put(snapshot);},240);
}
async function restore(type,id){
 const version=++restoring;
 try{
  if(timer){clearTimeout(timer);timer=null;}
  await queue.catch(()=>{});
  const item=await fileStoreGet(key(type,id));
  if(!item?.blob||version!==restoring||modal?.type!==type||(type==='ai-import'&&modal.id!==id))return;
  const data=JSON.parse(await item.blob.text());
  if(data.schema!=='schulcockpit.import-dialog.v1'||data.type!==type||data.id!==id)return;
  if(type==='planV182'){
   if(data.payload&&typeof data.payload==='object'&&Array.isArray(data.payload.sequences))v182PlanPackage=data.payload;
  }else if(typeof data.raw==='string'&&data.raw.length<=6*1024*1024){
   modal.raw=data.raw;
   modal.parsed=null; // never reuse a stale validation preview
  }
  render();
 }catch(e){console.warn('Importdialog konnte nicht wiederhergestellt werden:',e);}
 finally{if(version===restoring){restoring=0;schedule();}}
}
async function clear(type,id){
 if(timer){clearTimeout(timer);timer=null;}
 await queue.catch(()=>{});
 await fileStoreDelete(key(type,id)).catch(e=>console.warn('Importentwurf konnte nicht bereinigt werden',e));
}
function fromClick(event){
 const b=event.target?.closest?.('[data-action],[data-open-import-v12],[data-v182-plan-import]');
 if(!b)return;
 const action=b.dataset.action;
 if(action==='open-ai-import'||b.dataset.openImportV12){
  const id=b.dataset.id||b.dataset.openImportV12||'';
  if(id&&modal?.type==='ai-import'&&modal.id===id)void restore('ai-import',id);
 }
 if(action==='setup-import'&&modal?.type==='setup-import')void restore('setup-import','');
 if(b.hasAttribute('data-v182-plan-import')&&modal?.type==='planV182')void restore('planV182','');
 if(action==='apply-ai-import'||action==='apply-setup-import'||b.hasAttribute('data-v182-plan-apply')){
  const type=action==='apply-ai-import'?'ai-import':action==='apply-setup-import'?'setup-import':'planV182';
  const id=type==='ai-import'?(b.dataset.id||modal?.id||''):'';
  if(modal?.type!==type)void clear(type,id); // synchronous import finished
  else if(type==='planV182')completedType=type+'|'+id; // async import may finish later
  // Invalid/incomplete imports must never discard a saved draft.
 }
}
document.addEventListener('click',fromClick); // bubble after legacy click handlers update the modal
document.addEventListener('input',event=>{
 const el=event.target;
 if(modal?.type==='ai-import'&&el?.id==='ai-import-text'){
   modal.raw=el.value;modal.parsed=null;schedule();
 }else if(modal?.type==='setup-import'&&el?.id==='setup-import-text'){
   modal.raw=el.value;modal.parsed=null;schedule();
 }
});
const beforeRender=render;
render=function(){
 // A successful apply closes the active import modal. A failed apply leaves it open.
 const done=completedType;
 beforeRender();
 const badge=typeof document!=='undefined'?document.querySelector('.brand small'):null;
 if(badge)badge.textContent=state.settings.schoolYear+' · V0.25.5';
 if(done){
  const [type,id]=done.split('|');
  if(modal?.type!==type){completedType='';void clear(type,id);}
 }
 schedule();
};
})();
