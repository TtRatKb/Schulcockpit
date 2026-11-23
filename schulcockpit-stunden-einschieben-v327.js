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
  // A blocked move must never erase the teacher's newly typed hour.
  const editorValues=[...document.querySelectorAll('.v182-unit-editor input, .v182-unit-editor textarea')]
   .filter(el=>el.id?.startsWith('v182-unit-')).map(el=>[el.id,el.value]);
  try{await action.call(this,e);}
  catch(error){
   state.sequences=backup.sequences;state.lessons=backup.lessons;
   let failedRestore='';
   try{await saveState();}catch(err){failedRestore=' Wiederherstellung konnte nicht gespeichert werden: '+(err.message||err);}
   modal=originalModal;render();
   for(const [id,value] of editorValues){const el=document.getElementById(id);if(el)el.value=value;}
   alert('Einschieben nicht gespeichert. Ursprüngliche Planung wiederhergestellt. Deine Eingaben im Editor sind noch vorhanden. '+(error.message||error)+failedRestore);
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
