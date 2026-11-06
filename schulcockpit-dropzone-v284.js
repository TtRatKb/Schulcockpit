/* Schulcockpit V0.28.4 – drop a Finder file wherever an upload input exists.
 * Delegates to the ORIGINAL input change handlers: does not parse, import or
 * store a file itself. Nonmatching files never invoke the importer.
 */
(function(){
'use strict';
const core=SC_DROP_CORE_V284;
function note(zone,text,error=false){
 let n=zone.querySelector(':scope > .sc-drop-message-v284');
 if(!n){n=document.createElement('span');n.className='sc-drop-message-v284';
  n.setAttribute('role','status');n.setAttribute('aria-live','polite');zone.append(n);}
 n.textContent=text||'';
 n.classList.toggle('sc-drop-error-v284',error);
 if(zone.classList.contains('sc-drop-zone-v284'))zone.classList.toggle('sc-drop-invalid-v284',error);
 if(zone.dataset.scDropInput==='v264-file'){
  const display=document.getElementById('v264-status');
  if(display&&error)display.textContent=text;
 }
}
function assign(input,files){
 const verdict=core.check(files,input.accept,input.multiple,
  input.hasAttribute('webkitdirectory')||input.hasAttribute('directory'));
 if(!verdict.ok)return verdict;
 if(input.disabled)return {ok:false,reason:'Dieser Datei-Import ist momentan deaktiviert.'};
 try{
  const transfer=new DataTransfer();
  verdict.files.forEach(f=>transfer.items.add(f));
  input.files=transfer.files;
  if(input.files.length!==verdict.files.length)
   throw Error('Dateien konnten nicht ausgewählt werden.');
  input.dispatchEvent(new Event('change',{bubbles:true}));
  return {ok:true,files:verdict.files};
 }catch(err){
  return {ok:false,reason:'Die Auswahl per Drag-and-drop wurde vom Browser nicht übernommen. Bitte den Datei-Button verwenden. '+(err?.message||'')};
 }
}
function bind(zone,input){
 if(zone.dataset.scDropBound==='1')return;
 zone.dataset.scDropBound='1';
 zone.dataset.scDropInput=input.id||'';
 zone.classList.add('sc-drop-zone-v284');
 zone.addEventListener('dragenter',event=>{
  if(!event.dataTransfer?.types?.includes('Files'))return;
  event.preventDefault();zone.classList.add('sc-drop-active-v284');
 });
 zone.addEventListener('dragover',event=>{
  if(!event.dataTransfer?.types?.includes('Files'))return;
  event.preventDefault();event.dataTransfer.dropEffect='copy';
  zone.classList.add('sc-drop-active-v284');
 });
 zone.addEventListener('dragleave',event=>{
  if(!zone.contains(event.relatedTarget))zone.classList.remove('sc-drop-active-v284');
 });
 zone.addEventListener('drop',event=>{
  if(!event.dataTransfer?.files?.length)return;
  event.preventDefault();event.stopPropagation();
  zone.classList.remove('sc-drop-active-v284');
  const result=assign(input,event.dataTransfer.files);
  if(!result.ok){note(zone,result.reason,true);return;}
  const count=result.files.length;
  note(zone,count===1?'Datei übernommen: '+result.files[0].name:count+' Dateien übernommen.');
 });
 if(!zone.matches('label')){
  zone.addEventListener('click',event=>{
   if(event.target.closest('button,a,input'))return;
   input.click();
  });
  zone.addEventListener('keydown',event=>{
   if(event.key==='Enter'||event.key===' '){event.preventDefault();input.click();}
  });
 }
}
function enhance(){
 for(const input of document.querySelectorAll('input[type="file"]')){
  if(input.dataset.scDropDone==='1')continue;
  input.dataset.scDropDone='1';
  const label=input.closest('label');
  if(label){
   const hint=document.createElement('span');
   hint.className='sc-drop-hint-v284';
   hint.textContent=input.hasAttribute('webkitdirectory')?'Ordner über Auswahl öffnen':'oder Datei'+(input.multiple?'en':'')+' hier ablegen';
   label.append(hint);
   if(!input.hasAttribute('webkitdirectory'))bind(label,input);
  }else{
   const zone=document.createElement('div');
   zone.className='sc-drop-field-v284';
   zone.setAttribute('role','button');
   zone.setAttribute('tabindex','0');
   zone.setAttribute('aria-label','Datei aus dem Finder hier ablegen oder auswählen');
   const icon=document.createElement('span');icon.className='sc-drop-icon-v284';icon.textContent='⇣';
   const text=document.createElement('span');text.className='sc-drop-text-v284';
   text.textContent=input.hasAttribute('webkitdirectory')?'Ordner über die Auswahl öffnen':
    'Datei'+(input.multiple?'en':'')+' hierherziehen oder klicken';
   zone.append(icon,text);
   if(input.parentElement)input.insertAdjacentElement('afterend',zone);
   if(!input.hasAttribute('webkitdirectory'))bind(zone,input);
  }
 }
}
const oldRender=render;
render=function(){oldRender();enhance();};
if(document.readyState==='loading')
 document.addEventListener('DOMContentLoaded',enhance,{once:true});
else enhance();
window.SchulcockpitDropV284={enhance,assign};
})();