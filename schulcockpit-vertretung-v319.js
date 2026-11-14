/* Schulcockpit V0.31.9 – einzelne Stunde direkt als Vertretungsstunde vorbereiten.
 * Keine Änderung an Unterrichtsreihe, PowerPoint, Planstatus, Klassenkalender
 * oder regulärer Unterrichtsdatei. Bestehender V262-Word-/Materialexport wird genutzt.
 */
(function(){
'use strict';
const api=window.SchulcockpitSubstitutionV262;
function slot(l){
 const number=Number(lessonSlot(l));
 return Number.isFinite(number)?number:null;
}
function key(l){
 return l?.date&&l?.classId&&slot(l)!==null?l.date+'|'+l.classId+'|'+slot(l):'';
}
function manual(l){
 return !!state.manualSubstitutionHoursV319?.[key(l)];
}
function blocked(l){
 if(!l?.id||!l.date||!l.classId||l.kind==='group'||l.groupId||slot(l)===null||
   v182IsHeld(l)||v182IsCanceled(l))return true;
 const type=window.SchulcockpitLessonContextV289?.context(l)?.type;
 return type==='exam'||type==='excursion'||type==='group';
}
function simpleDraft(l,e){
 const available=api.linkedLessonFiles(e)
  .filter(f=>!/(\blösungen?\b|\bloesungen?\b|musterlösung|answer.?key|solutions?)/i.test(f.name));
 const printable=available.filter(f=>f.fromPrint);
 const selected=printable.length?printable:available;
 const suggested=l?.planReference?.material||'';
 const explicitBook=/(?:\bS\.\s*\d+|\bSeite[n]?\s*\d+|\bBuch\s+\d+)/i.test(suggested);
 const instructions=available.length?
  'Die Kinder bearbeiten die beigefügten Arbeitsblätter selbstständig in Einzelarbeit. Wer fertig ist, kann seine Antworten mit einer Partnerin oder einem Partner vergleichen.':
  explicitBook?'Die Kinder bearbeiten die angegebenen Buchaufgaben selbstständig in Einzelarbeit. Wer fertig ist, kann seine Antworten mit einer Partnerin oder einem Partner vergleichen.':'';
 return {topic:(l.title||l.planReference?.title||'').slice(0,200),
  minutes:Number(l.duration)===90?90:45,
  instructions,
  materialNote:explicitBook?String(suggested).slice(0,2500):'',
  teacherNote:'Die Kinder arbeiten möglichst selbstständig. Es ist keine fachliche Einführung nötig.',
  prepared:false,files:[],
  linkedFileKeysV319:selected.map(f=>f.fileKey)};
}
async function openOrMark(l){
 if(blocked(l))throw Error('Diese Stunde kann nicht als Vertretungsstunde vorbereitet werden.');
 const sl=slot(l);
 if(api.open(l.date,l.classId,sl))return;
 const k=key(l);
 const oldMap=state.manualSubstitutionHoursV319;
 const oldPlans=state.substitutionPlansV262;
 const backupMap=oldMap?structuredClone(oldMap):{};
 const backupPlans=oldPlans?structuredClone(oldPlans):{};
 const e={date:l.date,classId:l.classId,slot:sl,timetableId:l.timetableId||'',
   period:l.period||'',reason:'Vertretungsstunde'};
 state.manualSubstitutionHoursV319={...backupMap,[k]:e};
 state.substitutionPlansV262={...backupPlans};
 if(!state.substitutionPlansV262[k])state.substitutionPlansV262[k]=simpleDraft(l,e);
 try{await saveState();}
 catch(error){
  if(oldMap===undefined)delete state.manualSubstitutionHoursV319;
  else state.manualSubstitutionHoursV319=backupMap;
  if(oldPlans===undefined)delete state.substitutionPlansV262;
  else state.substitutionPlansV262=backupPlans;
  throw error;
 }
 if(!api.open(l.date,l.classId,sl))
  throw Error('Die Stunde wurde markiert, konnte aber nicht geöffnet werden. Bitte den Vertretungsbereich öffnen.');
}
async function clear(k){
 const map=state.manualSubstitutionHoursV319||{};
 if(!Object.prototype.hasOwnProperty.call(map,k))return;
 if(!confirm('Nur die direkte Vertretungsmarkierung für diese Stunde beenden? Die normale Stundenplanung und deine gespeicherten Materialien bleiben erhalten.'))return;
 const previous=structuredClone(map);
 state.manualSubstitutionHoursV319={...map};
 delete state.manualSubstitutionHoursV319[k];
 try{await saveState();}
 catch(error){state.manualSubstitutionHoursV319=previous;throw error;}
 modal=null;view='substitution-v262';render();
}
function showButtons(){
 if(!['week','prep','focus','lessonDayV182','tasks','improve'].includes(view))return;
 const visited=new Set();
 for(const el of document.querySelectorAll('[data-lesson],[data-v182-open]')){
  const id=el.dataset.lesson||el.dataset.v182Open;
  if(!id)continue;
  const l=lesson(id);
  if(blocked(l))continue;
  const holder=el.closest('.prep-lesson-row,.v182-week-card,.lesson-card,.v182-day-top')||el.parentElement;
  if(!holder||visited.has(holder))continue;
  visited.add(holder);
  if(holder.querySelector('[data-v319-start]'))continue;
  const button=document.createElement('button');
  button.type='button';
  button.className='secondary v319-lesson-button';
  button.dataset.v319Start=id;
  const active=manual(l),calendar=window.SchulcockpitLessonContextV289?.context(l)?.type==='substitution';
  button.textContent=active?'Vertretung bearbeiten':calendar?'Vertretung vorbereiten':'Als Vertretungsstunde vorbereiten';
  button.title='Einfache selbstständige Aufgaben statt PowerPoint; Word-Zettel und Arbeitsblätter';
  button.addEventListener('click',e=>{
   e.preventDefault();e.stopPropagation();
   button.disabled=true;
   void openOrMark(l).catch(err=>{
    alert('Vertretungsstunde konnte nicht vorbereitet werden: '+(err.message||err));
    button.disabled=false;
   });
  });
  const area=document.createElement('div');area.className='v319-button-area';area.appendChild(button);
  holder.appendChild(area);
 }
}
const beforeWire=wire;
wire=function(){
 beforeWire();
 if(modal?.type==='substitutionV262'){
  document.querySelector('[data-v319-unmark]')?.addEventListener('click',e=>{
   void clear(e.currentTarget.dataset.v319Unmark).catch(err=>alert(err.message||err));
  });
 }
};
const beforeRender=render;
render=function(){
 beforeRender();
 showButtons();
 const version=document.querySelector('.brand small');
 if(version)version.textContent=(state.settings?.schoolYear||'')+' · V0.31.9';
};
window.SchulcockpitSubstitutionDirectV319={openOrMark,manual,blocked,key};
})();