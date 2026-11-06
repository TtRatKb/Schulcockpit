/* V0.29.4 – direct evaluation links from the established assessment cards.
 * No copying of assessments, files or private results; keep one canonical ID. */
(function(){
'use strict';
function appendLink(card,id){
 if(!id||card.querySelector('[data-v294-eval]'))return;
 const a=(state.assessments||[]).find(x=>x.id===id);
 if(!a)return;
 const actions=card.querySelector('.v188-assessment-actions')||card;
 const button=document.createElement('button');
 button.type='button';button.className='secondary v294-eval';
 button.dataset.v294Eval=id;
 button.textContent='Auswertung & Rückgabe';
 button.title='Dieselbe Klassenarbeit öffnen: Aufgaben erfassen, Punkte auswerten und Kompetenzbögen drucken';
 actions.append(button);
 button.addEventListener('click',async e=>{
  e.preventDefault();e.stopPropagation();
  button.disabled=true;
  try{await v200OpenEval(id);}
  catch(err){alert('Auswertung konnte nicht geöffnet werden: '+(err.message||err));}
  finally{if(button.isConnected)button.disabled=false;}
 });
}
const beforeRender=render;
render=function(){
 beforeRender();
 if(view==='sequences'){
  for(const card of document.querySelectorAll('.v188-assessment-card')){
   const id=card.querySelector('[data-v188-assessment-edit]')?.dataset.v188AssessmentEdit;
   if(id)appendLink(card,id);
  }
 }
 const version=document.querySelector('.brand small');
 if(version)version.textContent=state.settings.schoolYear+' · V0.29.4';
};
if(typeof window!=='undefined')window.SchulcockpitWorkflowLinksV294={appendLink};
})();