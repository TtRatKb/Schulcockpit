/* V0.32.7 – safe rollback for insertion through the legacy unit editor. */
(function(){
'use strict';
const oldWire=wire;
wire=function(){
 oldWire();
 const button=document.querySelector('[data-v182-unit-save]');
 if(!button||modal?.type!=='unitV182'||modal.uid||typeof button.onclick!=='function')return;
 const action=button.onclick;
 button.onclick=async function(e){
  const backup={sequences:structuredClone(state.sequences),lessons:structuredClone(state.lessons)};
  const originalModal={...modal};
  try{await action.call(this,e);}
  catch(error){
   state.sequences=backup.sequences;state.lessons=backup.lessons;
   let failedRestore='';
   try{await saveState();}catch(err){failedRestore=' Wiederherstellung konnte nicht gespeichert werden: '+(err.message||err);}
   modal=originalModal;render();
   alert('Einschieben nicht gespeichert. Ursprüngliche Planung wiederhergestellt. '+(error.message||error)+failedRestore);
  }
 };
};
const oldRender=render;
render=function(){
 oldRender();
 const info=document.querySelector('.brand small');
 if(info)info.textContent=state.settings.schoolYear+' · V0.32.7';
};
})();
