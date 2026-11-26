/* Schulcockpit V0.33.32 – direct own lesson / actual teaching with local files. */
(function(){
'use strict';
const core=SC_OWN_TEACHING_V3332;let draft=null,busy=false;
const value=(sel,n=2500)=>String(document.querySelector(sel)?.value||'').trim().slice(0,n);
function current(l){return seq(l.sequenceId)||v190PlanningSequences(l.classId,v190YearFromDate(l.date))[0]||null;}
function comps(l){const c=cls(l.classId);return c?v204AllCourseCurriculum(c):[];}
function open(id,mode){const l=lesson(id);if(!l||v182IsHeld(l))return alert('Bereits dokumentierter Unterricht wird nur im ausdrücklichen Korrekturmodus der Stundenansicht geändert.');draft={lessonId:id,mode};modal={type:'ownV3332'};render();}
function modalHtmlV3332(){
 const l=lesson(draft?.lessonId);if(!l)return '';
 const actual=draft.mode==='actual',list=comps(l),old=l.actualV270||{};
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-xwide v3332-modal" data-modal-stop><header class="modal-header"><div><span class="eyebrow">'+(actual?'BEREITS ANDERS UNTERRICHTET':'ETWAS EIGENES UNTERRICHTEN')+'</span><h2>'+esc(fmtDate(l.date))+' · '+esc(whoV14(l))+'</h2></div><button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">'+
 '<p>'+(actual?'Dokumentiere knapp den tatsächlichen Unterricht. Der bisherige Vorschlag bleibt in der Historie, ist aber nicht mehr die aktive Stunde.':'Eine kurze Absicht genügt. ChatGPT und eine neue Präsentation sind nicht erforderlich.')+'</p><div class="v3332-grid"><label>Thema (optional)<input data-v3332-title maxlength="160" value="'+esc(old.title||'')+'" placeholder="z. B. Vier Soli mit vorhandener Präsentation"></label><label>Absicht / tatsächlicher Ablauf<textarea data-v3332-summary rows="4" maxlength="2500" placeholder="Was möchtest du erreichen bzw. was wurde tatsächlich gemacht?">'+esc(old.summary||'')+'</textarea></label></div>'+
 '<details><summary>Kompetenzen auswählen ('+list.length+' verfügbar)</summary><div class="v3332-comps">'+list.map(c=>'<label><input type="checkbox" data-v3332-comp="'+esc(c.id)+'" '+((old.coveredIds||[]).includes(c.id)?'checked':'')+'><span><small>'+esc(c.id)+' · '+esc(c.category||c.topicTitle||'Curriculum')+'</small>'+esc(c.text)+'</span></label>').join('')+'</div></details>'+
 '<label class="v3332-files">Vorhandene Materialien lokal hinterlegen<input type="file" data-v3332-files multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.md"><span>PDF, PPTX, Arbeitsblätter oder Bilder – Auswahl oder Finder-Drop</span></label>'+
 '<p class="microcopy">Dateien bleiben lokal in IndexedDB und werden mit stabilem FileKey im Materialhub sowie an dieser Stundenkarte verknüpft. Vorhandene Materialien, Folien und Druckstatus werden nicht gelöscht.</p><div class="v3332-actions"><button class="secondary" data-action="modal-close">Abbrechen</button><button class="primary" data-v3332-save>'+(actual?'Als tatsächlichen Unterricht speichern':'Als Soll-Stunde übernehmen')+'</button></div></div></section></div>';
}
function ensureSequence(l){
 let q=current(l);if(q)return q;
 q={id:uid('own-seq'),classId:l.classId,title:'Eigener Unterricht',startDate:l.date,endDate:l.date,
  schoolYearV190:v190YearFromDate(l.date),orderV190:(state.sequences||[]).length,plan:[],
  ownSequenceV3332:true};state.sequences.push(q);return q;
}
async function save(){
 if(busy)return;const l=lesson(draft?.lessonId);if(!l)throw Error('Fachtermin nicht mehr vorhanden.');
 const title=value('[data-v3332-title]',160),summary=value('[data-v3332-summary]',2500),
  ids=[...document.querySelectorAll('[data-v3332-comp]:checked')].map(x=>x.dataset.v3332Comp),
  files=[...document.querySelector('[data-v3332-files]')?.files||[]];
 if(files.length>12||files.some(f=>f.size>25*1024*1024))throw Error('Bitte maximal 12 Dateien zu je 25 MB auswählen.');
 const snapshot={lessons:structuredClone(state.lessons),sequences:structuredClone(state.sequences),materials:structuredClone(state.materials)},keys=[];busy=true;
 try{
  const q=ensureSequence(l),unit=core.ownUnit({id:uid('own-unit'),title,intention:summary,competencyIds:ids,date:l.date,slot:lessonSlot(l),actual:draft.mode==='actual'});
  q.plan=q.plan||[];q.plan.push(unit);q.startDate=!q.startDate||l.date<q.startDate?l.date:q.startDate;q.endDate=!q.endDate||l.date>q.endDate?l.date:q.endDate;
  const stored=[];
  for(const f of files){const mid=uid('mat'),vid=uid('var'),key='own-v3332-'+mid+'-'+vid;await fileStorePut(key,f);keys.push(key);storedFileKeys.add(key);
   const m={id:mid,title:f.name.replace(/\.[^.]+$/,''),kind:'file',resourceType:/\.(pptx?|png|jpe?g|gif|webp)$/i.test(f.name)?'digital':'print',source:'Eigener Unterricht',variants:[{id:vid,type:'standard',label:'Original',available:true,fileName:f.name,fileKey:key}],improvementFlags:[],assignments:[{classId:l.classId,sequenceId:q.id,unitId:unit.id}]};state.materials.push(m);l.materials=l.materials||[];l.materials.push(mid);stored.push({name:f.name,fileKey:key,size:f.size,type:f.type,materialId:mid,variantId:vid});}
  const actual=draft.mode==='actual'?core.actualRecord({previous:l.actualV270,title,summary,competencyIds:ids,files:stored,replacedPlanReference:l.planReference}):null;
  core.attachOwnLesson({lesson:l,sequence:q,unit,actual});await saveState();modal=null;render();
 }catch(e){state.lessons=snapshot.lessons;state.sequences=snapshot.sequences;state.materials=snapshot.materials;for(const k of keys){try{await fileStoreDelete(k);}catch{}storedFileKeys.delete(k);}throw e;}finally{busy=false;}
}
const oldModal=modalHtml;modalHtml=function(){return modal?.type==='ownV3332'?modalHtmlV3332():oldModal();};
const oldDay=v182LessonDayHtml;v182LessonDayHtml=function(l){let h=oldDay(l);if(!l?.actualV270?.savedAt)return h;const count=(l.actualV270.correctionHistoryV3332||[]).length;return h.replace('<button type="button" class="primary" data-v270-save="'+esc(l.id)+'">Ist-Unterricht speichern</button>','<div class="warnbox"><strong>Korrekturmodus</strong> · Der vorhandene Ist-Stand wird nur nach ausdrücklicher Bestätigung geändert. '+count+' frühere Fassung'+(count===1?'':'en')+' gespeichert.</div><button type="button" class="primary" data-v270-save="'+esc(l.id)+'">Korrigierten Ist-Stand speichern</button>');};
let correctionGuard=false;function bindCorrectionGuard(){if(correctionGuard)return;correctionGuard=true;document.addEventListener('click',e=>{const b=e.target.closest?.('[data-v270-save]'),l=b&&lesson(b.dataset.v270Save);if(!b||!l?.actualV270?.savedAt)return;if(!confirm('Den dokumentierten Ist-Unterricht korrigieren? Die bisherige Fassung bleibt in der Historie erhalten.')){e.preventDefault();e.stopImmediatePropagation();return;}const old=structuredClone({...l.actualV270,correctionHistoryV3332:undefined});l.actualV270.correctionHistoryV3332=[...(l.actualV270.correctionHistoryV3332||[]),{correctedAt:new Date().toISOString(),previous:old}];},true);}
function enhance(){document.querySelectorAll('.v3331-decision').forEach(p=>{const l=v182LessonId&&lesson(v182LessonId),a=p.querySelector('.v3331-actions');if(!l||!a||a.querySelector('[data-v3332-own]'))return;a.insertAdjacentHTML('beforeend','<button class="secondary" data-v3332-own="'+esc(l.id)+'">Etwas Eigenes unterrichten</button><button class="secondary" data-v3332-actual="'+esc(l.id)+'">Bereits anders unterrichtet</button>');});}
const oldWire=wire;wire=function(){oldWire();document.querySelectorAll('[data-v3332-own]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.v3332Own,'plan')));document.querySelectorAll('[data-v3332-actual]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.v3332Actual,'actual')));document.querySelector('[data-v3332-save]')?.addEventListener('click',e=>{e.currentTarget.disabled=true;void save().catch(err=>{alert('Eigener Unterricht nicht gespeichert: '+(err.message||err));render();});});};
const oldRender=render;render=function(){bindCorrectionGuard();oldRender();enhance();SchulcockpitDropV284?.enhance?.();const v=document.querySelector('.brand small');if(v)v.textContent=state.settings.schoolYear+' · V0.33.32';};
window.SchulcockpitOwnTeachingV3332={open};render();
})();
