/* Schulcockpit V0.33.31 – teacher-confirmed lesson selection and read-only yearly gaps. */
(function(){
'use strict';
const core=SC_TEACHING_CHOICE_V3331;
let choice=null,busy=false,filter='gaps';
function yearFor(l){return typeof v190YearFromDate==='function'?v190YearFromDate(l.date):state.settings.schoolYear;}
function sequencesFor(l){return v190PlanningSequences(l.classId,yearFor(l));}
function candidates(l){return sequencesFor(l).flatMap(q=>(q.plan||[]).filter(u=>!v201UnitSkipped(u))
 .map(u=>({q,u,current:u.id===l.planReference?.unitId})));
}
function unitMaterials(l,u){return (state.materials||[]).filter(m=>(m.assignments||[]).some(a=>a.classId===l.classId&&a.unitId===u.id)).map(m=>{const v=(m.variants||[]).find(x=>x.available&&x.fileKey)||m.variants?.[0];return {id:m.id,title:m.title||v?.fileName||'Material',fileKey:v?.fileKey||'',fileName:v?.fileName||'',available:!!(v?.fileKey&&storedFileKeys.has(v.fileKey))};});}
function openChoice(id){const l=lesson(id);if(!l)return;choice={lessonId:id,unitId:l.planReference?.unitId||''};modal={type:'choiceV3331'};render();}
function choiceModal(){
 const l=lesson(choice?.lessonId);if(!l)return '';
 const rows=candidates(l),selected=rows.find(x=>x.u.id===choice.unitId),
  p=selected?core.previewSelection({lesson:l,sequence:selected.q,unit:selected.u,
   schoolYear:yearFor(l),lessons:state.lessons}):null;
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-xwide v3331-modal" data-modal-stop>'+
 '<header class="modal-header"><div><span class="eyebrow">UNTERRICHT SELBST AUSWÄHLEN</span><h2>'+esc(fmtDate(l.date))+' · '+esc(cls(l.classId)?.subject||'Fach')+' '+esc(cls(l.classId)?.name||'')+'</h2></div><button class="icon-button" data-action="modal-close">×</button></header>'+
 '<div class="modal-body"><p>Wähle die konkrete Stunde für diesen Fachtermin. Andere Termine und die ursprünglichen Reihenideen bleiben unverändert.</p>'+
 '<div class="v3331-options">'+rows.map(({q,u,current})=>{const ms=unitMaterials(l,u);return '<label class="v3331-option '+(choice.unitId===u.id?'selected':'')+'"><input type="radio" name="v3331-unit" value="'+esc(u.id)+'" '+(choice.unitId===u.id?'checked':'')+'><span><small>'+esc(q.title||'Reihe')+(u.plannedDate?' · bisher '+esc(fmtDate(u.plannedDate)):' · ohne Termin')+'</small><strong>'+esc(u.title||'Unbenannte Stunde')+(current?' · aktuell':'')+'</strong><p>'+esc(u.objective||u.content||'Ziel oder Ablauf ist im Vorschlag noch nicht konkret beschrieben.')+'</p><small>Material: '+esc(u.material||'noch nicht angegeben')+'</small>'+(ms.length?'<div>'+ms.map(m=>'<button type="button" class="text-button" data-v3331-material="'+esc(m.fileKey)+'" '+(!m.available?'disabled':'')+'>'+esc(m.title)+' · '+(m.available?'Original öffnen':'Datei fehlt')+'</button>').join('')+'</div>':'')+'</span></label>';}).join('')+'</div>'+
 (!rows.length?'<p class="warnbox">Für diesen Kurs sind noch keine Vorschläge in der Reihenplanung vorhanden.</p>':'')+
 (p?.issues.length?'<p class="warnbox" role="alert">'+p.issues.map(esc).join('<br>')+'</p>':'')+
 (p?.evidenceWarnings?.length?'<p class="warnbox"><strong>Nachweise bleiben verbindlich:</strong><br>'+p.evidenceWarnings.map(esc).join('<br>')+'</p>':'')+
 (p?.prepared&&p.changes?'<p class="warnbox">Diese Stundenkarte ist bereits vorbereitet. Beim Wechsel bleiben Dateien, Folien und Druckstatus an diesem Fachtermin erhalten. Prüfe anschließend, ob sie zur neuen Auswahl passen.</p>':'')+
 '<div class="v3331-actions"><button class="secondary" data-action="modal-close">Abbrechen</button><button class="primary" data-v3331-apply '+(!p?.ok||p.confirmed?'disabled':'')+'>'+(p?.confirmed?'Bereits bestätigt':'Diese Stunde verbindlich bestätigen')+'</button></div></div></section></div>';
}
async function apply(){
 if(busy)return;const l=lesson(choice?.lessonId),row=l&&candidates(l).find(x=>x.u.id===choice.unitId);
 if(!row)throw Error('Der gewählte Vorschlag ist nicht mehr vorhanden.');
 const backup=structuredClone(l);busy=true;
 try{core.applySelection({lesson:l,sequence:row.q,unit:row.u,schoolYear:yearFor(l),lessons:state.lessons});await saveState();modal=null;render();}
 catch(e){Object.keys(l).forEach(k=>delete l[k]);Object.assign(l,backup);throw e;}finally{busy=false;}
}
function decisionPanel(l){
 if(!l?.classId||l.groupId||l.kind==='group'||core.isHistory(l))return '';
 const confirmed=!!l.teacherChoiceV3331?.chosenAt;
 return '<section class="panel v3331-decision"><div><span class="eyebrow">'+(confirmed?'BEWUSST BESTÄTIGT':'VORSCHLAG · NOCH NICHT BESTÄTIGT')+'</span><h2>'+esc(l.planReference?.title||l.title||'Thema noch offen')+'</h2><p>'+esc(l.planReference?.objective||l.objective||l.planReference?.content||'Ziel und Ablauf bitte vor der Übernahme prüfen.')+'</p></div><div class="v3331-actions"><button class="primary" data-v3331-confirm="'+esc(l.id)+'">'+(confirmed?'Auswahl ändern':'Diese Stunde übernehmen')+'</button><button class="secondary" data-v3331-other="'+esc(l.id)+'">Andere Stunde auswählen</button>'+(confirmed?'<button class="text-button" data-v3331-undo="'+esc(l.id)+'">Letzte Auswahl zurücknehmen</button>':'')+'</div></section>';
}
function courseRows(c){
 const year=state.settings.schoolYear,qs=v190PlanningSequences(c.id,year),ls=(state.lessons||[]).filter(l=>l.classId===c.id&&yearFor(l)===v190NormYear(year));
 const rows=core.competencyRows({catalog:v204AllCourseCurriculum(c),sequences:qs,lessons:ls}),evidence=state.competencyEvidenceV3333||[];
 for(const r of rows){const ev=evidence.filter(e=>e.classId===c.id&&e.competencyId===r.id&&(!e.schoolYear||e.schoolYear===year));r.verified=ev.some(e=>e.status==='done'&&e.coverageScope==='full');r.partiallyVerified=ev.some(e=>e.status==='done'&&e.coverageScope!=='full');r.evidencePlanned=ev.some(e=>e.status==='planned'||e.status==='done');r.evidenceReview=ev.filter(e=>e.status==='review_required').length;}
 return rows;
}
function cockpit(){
 const courses=(state.classes||[]).filter(c=>{const g=v202Grade(c),s=v202SubjectKey(c);return g>=5&&g<=7&&(s==='religion'||s==='mathematik');});
 const cid=state.settings.competencyCourseV3331&&courses.some(c=>c.id===state.settings.competencyCourseV3331)?state.settings.competencyCourseV3331:courses[0]?.id;
 const c=cls(cid),rows=c?courseRows(c):[],shown=filter==='gaps'?rows.filter(r=>!r.planned||!r.taught):rows;
 const count=k=>rows.filter(r=>r[k]).length;
 return '<div class="content-grid v3331-cockpit"><section class="panel"><div class="section-head"><div><span class="eyebrow">READ-ONLY · KEINE BEWERTUNG</span><h2>Jahres-Kompetenzcockpit</h2><p>Der vollständige Kurskatalog bleibt der Nenner – auch wenn noch keine Reihe existiert. Planung und bestätigter Ist-Unterricht werden getrennt gezählt.</p></div><label>Fachkurs<select data-v3331-course>'+courses.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===cid?'selected':'')+'>'+esc(x.subject+' '+x.name)+'</option>').join('')+'</select></label></div>'+
 (!courses.length?'<p class="warnbox">Lege zuerst einen Mathematik- oder Religionskurs der Jahrgänge 5–7 an.</p>':'<div class="v3331-metrics"><span><strong>'+rows.length+'</strong> verbindlich im Katalog</span><span><strong>'+count('planned')+'</strong> gezielt geplant</span><span><strong>'+count('taught')+'</strong> tatsächlich bestätigt</span><span><strong>'+count('verified')+'</strong> überprüft</span></div><div class="v3331-filter"><button class="'+(filter==='gaps'?'primary':'secondary')+'" data-v3331-filter="gaps">Nur Lücken</button><button class="'+(filter==='all'?'primary':'secondary')+'" data-v3331-filter="all">Alle</button></div><div class="v3331-rows">'+shown.map(r=>'<article><div><small>'+esc(r.id)+' · '+esc(r.category)+' · '+esc(r.source)+'</small><strong>'+esc(r.text)+'</strong></div><div class="v3331-states"><span class="'+(r.planned?'ok':'open')+'">'+(r.planned?'✓ geplant':'○ ungeplant')+'</span><span class="'+(r.taught?'ok':'open')+'">'+(r.taught?'✓ unterrichtet':'○ nicht bestätigt')+'</span><span class="'+(r.verified?'ok':'open')+'">'+(r.verified?'✓ überprüft':r.evidenceReview?'△ Nachweis prüfen':'○ nicht überprüft')+'</span></div></article>').join('')+'</div>')+'</section></div>';
}
const oldModal=modalHtml;modalHtml=function(){return modal?.type==='choiceV3331'?choiceModal():oldModal();};
const oldDay=v182LessonDayHtml;v182LessonDayHtml=function(l){const h=oldDay(l),p=decisionPanel(l);return p?h.replace('<div class="content-grid',p+'<div class="content-grid'):h;};
const oldPrepRow=coursePrepRowV14;coursePrepRowV14=function(l){const h=oldPrepRow(l),confirmed=!!l.teacherChoiceV3331?.chosenAt;return h.replace('</article>','<div class="v3331-actions"><button class="secondary" data-v3331-confirm="'+esc(l.id)+'">'+(confirmed?'Auswahl ändern':'Vorschlag bestätigen')+'</button><button class="secondary" data-v3331-other="'+esc(l.id)+'">Andere Stunde</button></div></article>');};
const oldView=viewHtml;viewHtml=function(){return view==='competenciesV3331'?cockpit():oldView();};
const oldTitle=pageTitle;pageTitle=function(){return view==='competenciesV3331'?'Kompetenzcockpit':oldTitle();};
const oldWire=wire;wire=function(){oldWire();
 document.querySelectorAll('[data-v3331-confirm],[data-v3331-other]').forEach(b=>b.addEventListener('click',()=>openChoice(b.dataset.v3331Confirm||b.dataset.v3331Other)));
 document.querySelectorAll('[data-v3331-undo]').forEach(b=>b.addEventListener('click',async()=>{const l=lesson(b.dataset.v3331Undo);if(!l||!confirm('Letzte Unterrichtsauswahl für diesen Termin zurücknehmen? Materialien und Vorbereitung bleiben erhalten.'))return;const backup=structuredClone(l);try{core.undoSelection(l);await saveState();render();}catch(e){Object.keys(l).forEach(k=>delete l[k]);Object.assign(l,backup);alert('Auswahl nicht zurückgenommen: '+(e.message||e));}}));
 document.querySelectorAll('input[name="v3331-unit"]').forEach(e=>e.addEventListener('change',()=>{choice.unitId=e.value;render();}));
 document.querySelector('[data-v3331-apply]')?.addEventListener('click',()=>void apply().catch(e=>alert('Auswahl nicht gespeichert: '+(e.message||e))));
 document.querySelectorAll('[data-v3331-material]').forEach(b=>b.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();try{const f=await fileStoreGet(b.dataset.v3331Material);if(!f)throw Error('Datei fehlt im lokalen Speicher.');window.open(URL.createObjectURL(f),'_blank','noopener');}catch(x){alert(x.message||x);}}));
 document.querySelector('[data-v3331-course]')?.addEventListener('change',e=>{state.settings.competencyCourseV3331=e.target.value;saveState();render();});
 document.querySelectorAll('[data-v3331-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.v3331Filter;render();}));
};
const oldRender=render;render=function(){oldRender();const nav=document.querySelector('.sidebar nav');if(nav&&!nav.querySelector('[data-view="competenciesV3331"]')){const b=document.createElement('button');b.dataset.view='competenciesV3331';b.innerHTML='<span>◫</span> Kompetenzcockpit';b.onclick=()=>{view='competenciesV3331';modal=null;render();};nav.appendChild(b);}const v=document.querySelector('.brand small');if(v)v.textContent=state.settings.schoolYear+' · V0.33.31';};
window.SchulcockpitTeachingChoiceV3331={openChoice,courseRows};
render();
})();
