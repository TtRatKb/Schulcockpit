/* Schulcockpit V0.32.4 – school-year transfer with preflight and explicit consent.
 * Adds only new courses/sequences/unit references; never rewrites old school years.
 */
(function(){
'use strict';
const C=window.SchulcockpitYearTransferCoreV324;
if(!C)throw Error('Schuljahresübernahme: Kernmodul fehlt.');
let sourceYear='',selected=new Set(),routes={},saving=false;
function initial(){
 const y=v190NormYear(state.settings?.schoolYear||'2026/27');
 if(!C.year(sourceYear))sourceYear=y;
 return sourceYear;
}
function yearOptions(){
 const s=new Set((state.sequences||[]).map(q=>C.seqYear(q,state.settings?.schoolYear)));
 s.add(v190NormYear(state.settings?.schoolYear||'2026/27'));
 return [...s].filter(C.year).sort();
}
function target(){return C.next(initial());}
function sourceGroups(){
 const data=C.sourceSequences(state,initial()),map=new Map();
 for(const q of data){
  if(!map.has(q.classId))map.set(q.classId,{course:cls(q.classId),sequences:[]});
  map.get(q.classId).sequences.push(q);
 }
 return [...map].map(([id,x])=>({...x,id}));
}
function suggestedRoute(g){
 const a=routes[g.id];
 if(a)return a;
 return {mode:'new',name:(g.course?.name||'Neue Klasse')+' ('+target()+')'};
}
function input(){
 const map={};
 for(const g of sourceGroups())map[g.id]=suggestedRoute(g);
 return {sourceYear:initial(),targetYear:target(),selectedIds:[...selected],routes:map};
}
function currentPreview(){return C.preview(state,input());}
function selectedCount(g){return g.sequences.filter(q=>selected.has(q.id)).length;}
function groupMarkup(g){
 const src=g.course||{},tgt=target(),r=suggestedRoute(g);
 const eligible=C.targetCourses(state,tgt).filter(c=>c.subject===src.subject&&c.id!==g.id);
 const opts='<option value="new" '+(r.mode==='new'?'selected':'')+'>Neuen Fachkurs anlegen</option>'+
   eligible.map(c=>'<option value="existing:'+esc(c.id)+'" '+(r.mode==='existing'&&r.targetId===c.id?'selected':'')+'>'+
    'Bestehenden Zielkurs: '+esc(c.name)+'</option>').join('');
 return '<section class="v324-course"><div class="v324-source"><div><span class="eyebrow">'+esc(src.subject||'Fach')+'</span>'+
  '<h3>'+esc(src.name||'Fachkurs')+'</h3><small>'+g.sequences.length+' vorhandene Reihen</small></div>'+
  '<div class="v324-route"><label>Ziel im Schuljahr '+esc(tgt)+'<select data-v324-route="'+esc(g.id)+'">'+opts+'</select></label>'+
  (r.mode==='new'?'<label>Bezeichnung des neuen Fachkurses<input data-v324-name="'+esc(g.id)+'" '+
  'maxlength="120" value="'+esc(r.name||'')+'" placeholder="z. B. 6a"></label>':'')+
  '</div></div>'+
  '<div class="v324-units">'+g.sequences.map(q=>{
   const lessons=(q.plan||[]).length;
   return '<label class="v324-item"><input type="checkbox" data-v324-seq="'+esc(q.id)+'" '+
    (selected.has(q.id)?'checked':'')+'><span><strong>'+esc(q.title)+'</strong>'+
    '<small>'+lessons+' Sollstunde'+(lessons===1?'':'n')+
    (q.goal?' · '+esc(String(q.goal).slice(0,110)):'')+'</small></span></label>';
  }).join('')+'</div></section>';
}
function page(){
 const ys=yearOptions(),s=initial(),t=target(),p=currentPreview(),groups=sourceGroups();
 const warnings=p.warnings||[],errors=p.errors||[];
 return '<div class="content-grid v324-year"><section class="panel v324-hero">'+
  '<button type="button" class="text-button" data-v324-back>← Zur Jahresplanung</button>'+
  '<div><span class="eyebrow">VORLAGEN STATT ALLES NEU PLANEN</span>'+
  '<h2>Unterricht ins nächste Schuljahr übernehmen</h2>'+
  '<p>Bewährte Reihen, Sollstunden und Materialverknüpfungen auswählen. Die alte Planung bleibt erhalten. '+
  'Im neuen Schuljahr werden noch keine Termine und keine Unterrichtsstunden als gehalten angelegt.</p></div>'+
  '<div class="v324-years"><label>Ausgangsjahr<select data-v324-year>'+
  ys.map(y=>'<option value="'+esc(y)+'" '+(s===y?'selected':'')+'>'+esc(y)+'</option>').join('')+
  '</select></label><span aria-hidden="true">→</span><label>Folgejahr<strong>'+esc(t)+'</strong></label></div></section>'+
  '<section class="panel"><div class="section-head"><div><span class="eyebrow">AUSWÄHLEN & ZUORDNEN</span>'+
  '<h2>Was möchtest du wiederverwenden?</h2></div>'+
  '<div class="v324-all"><button type="button" class="secondary" data-v324-all>Alle Reihen wählen</button>'+
  '<button type="button" class="text-button" data-v324-none>Keine</button></div></div>'+
  (groups.length?groups.map(groupMarkup).join(''):'<p>Im gewählten Schuljahr sind keine geeigneten Unterrichtsreihen gespeichert.</p>')+
  '</section><section class="panel v324-preview"><div class="section-head"><div>'+
  '<span class="eyebrow">VORSCHAU · NOCH NICHT GESPEICHERT</span><h2>Das wird übernommen</h2></div></div>'+
  '<div class="v324-stats"><span><strong>'+p.selected.length+'</strong> Reihen</span>'+
  '<span><strong>'+p.unitCount+'</strong> Sollstunden</span>'+
  '<span><strong>'+p.materialCount+'</strong> Materialreferenzen</span>'+
  '<span><strong>'+p.templateCount+'</strong> frühere Stundenentwürfe als Vorlage</span></div>'+
  (errors.length?'<div class="v324-errors" role="alert">'+errors.map(e=>'<p>⚠ '+esc(e)+'</p>').join('')+'</div>':'')+
  '<ul class="v324-notes">'+warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>'+
  '<p class="microcopy">Keine Schülernamen, Noten, Klassenarbeiten, tatsächlich gehaltenen Stunden, Kopierhäkchen, generierten PowerPoints oder alten Termine. '+
  'Die gemeinsame Materialbibliothek wird nur durch neue Verknüpfungen ergänzt. Fehlende lokale Originaldateien werden nicht als verfügbar ausgegeben.</p>'+
  '<div class="v324-actions"><button type="button" class="primary" data-v324-apply '+(errors.length?'disabled':'')+
  '>Ausgewählte Reihen übernehmen</button><button type="button" class="secondary" data-v324-back>Abbrechen</button></div>'+
  '</section></div>';
}
function gotoYear(){
 view='sequences';modal=null;render();
}
function openTransfer(){
 initial();selected=new Set();routes={};
 for(const g of sourceGroups())routes[g.id]=suggestedRoute(g);
 view='yearTransferV324';modal=null;render();
}
async function apply(){
 if(saving)return;
 const cfg=input(),p=C.preview(state,cfg);
 if(p.errors.length)throw Error(p.errors.join('\n'));
 const names=[...p.grouped].map(([id,g])=>{
  const rt=cfg.routes[id];return g.course.subject+' '+g.course.name+' → '+
   (rt.mode==='new'?rt.name:cls(rt.targetId)?.name||'Zielkurs');
 }).join('\n');
 if(!confirm('Wirklich '+p.selected.length+' Reihen und '+p.unitCount+' Sollstunden nach '+p.targetYear+
  ' übernehmen?\n\n'+names+
  '\n\nDie alten Stunden, Noten, Termine und Schülerdaten bleiben unverändert. Neue Termine legst du erst später an.'))return;
 saving=true;
 const previous={classes:state.classes,sequences:state.sequences,materials:state.materials,
  year:state.settings.sequencePlanningYearV190};
 try{
  const res=C.transfer(state,cfg,uid,storedFileKeys);
  state.classes=res.classes;state.sequences=res.sequences;state.materials=res.materials;
  state.settings.sequencePlanningYearV190=cfg.targetYear;
  await Promise.resolve(saveState());
  view='sequences';render();
  alert(res.createdSequences.length+' Reihen und '+res.unitCount+' Sollstunden für '+cfg.targetYear+
   ' übernommen. '+res.createdClasses.length+' neue Fachkurse angelegt.\n\n'+
   'Die Termine sind bewusst offen: Richte zuerst den Stundenplan für das neue Jahr ein. '+
   'Frühere Stundenentwürfe kannst du später pro Stunde ausdrücklich übernehmen.');
 }catch(err){
  state.classes=previous.classes;state.sequences=previous.sequences;state.materials=previous.materials;
  state.settings.sequencePlanningYearV190=previous.year;
  render();
  throw err;
 }finally{saving=false;}
}
function unitTemplate(l){
 if(!l||v182IsHeld(l)||v182IsCanceled(l)||!l.sequenceId)return null;
 const q=seq(l.sequenceId),u=q?.plan?.find(u=>u.id===l.planReference?.unitId);
 const ref=u?.reuseV324;
 if(!ref||!q?.originSequenceIdV324||C.seqYear(q,state.settings?.schoolYear)!==C.next(q.originYearV324))return null;
 const source=lesson(ref.sourceLessonId);
 if(!source||source.status!=='done'||source.executionV180?.type==='cancelled'||
  !source.date||C.dateYear(source.date)!==q.originYearV324)return null;
 const oldSeq=seq(q.originSequenceIdV324);
 if(!oldSeq||oldSeq.classId!==source.classId||source.planReference?.unitId!==u.originUnitIdV324)return null;
 return {q,u,source,ref};
}
function lessonCard(l){
 const tpl=unitTemplate(l);if(!tpl)return '';
 const existing=!!(l.phasePlan?.length||l.slides?.length||l.presentationReady);
 return '<section class="v324-template"><span class="eyebrow">BEWÄHRTE STUNDE AUS DEM VORJAHR</span>'+
  '<h3>Stundenentwurf wiederverwenden</h3>'+
  '<p>Zum selben Sollstundenthema wurde am '+esc(tpl.source.date)+
  ' bereits Unterricht gehalten. Die frühere Stunde bleibt unverändert. '+
  'Du kannst ihren Ablauf und Folienentwurf als Ausgangspunkt übernehmen – nicht die alte fertige PPTX.</p>'+
  '<div class="v324-template-actions"><button type="button" class="secondary" data-v324-open-old="'+esc(tpl.source.id)+'">'+
  'Alte Stunde ansehen</button>'+
  '<button type="button" class="primary" data-v324-template="'+esc(l.id)+'" '+(existing?'disabled':'')+'>'+
  (existing?'Neue Stunde bereits konkret geplant':'Ablauf & Folienentwurf übernehmen')+'</button></div>'+
  '<p class="microcopy">Vor der Nutzung bitte Aufgaben, Lehrplanbezüge, Materialfassungen und mögliche personenbezogene Inhalte prüfen. '+
  'Kopierstatus, Klassenarbeit, Schülerdaten, Reflexion und PPT-Dateien werden nicht übertragen.</p></section>';
}
async function useTemplate(id){
 const l=lesson(id),tpl=unitTemplate(l);
 if(!tpl)throw Error('Keine passende unveränderte Vorjahresstunde gefunden.');
 if(l.phasePlan?.length||l.slides?.length||l.presentationReady||v182IsHeld(l))
  throw Error('Die aktuelle Stunde wurde bereits konkret geplant; sie wird nicht überschrieben.');
 if(!confirm('Ablauf und FolienENTWURF aus '+tpl.source.date+' in diese noch leere Stunde übernehmen?\n'+
  'Keine alte PowerPoint, Unterrichts-Ist oder Kopierhäkchen. Alte Inhalte vor dem Einsatz sorgfältig prüfen.'))return;
 const copy=C.lessonContent(tpl.source),old=structuredClone(l);
 try{
  l.phasePlan=copy.phasePlan;l.slides=copy.slides;
  // Non-destructive reuse of the already assigned library resources, never print flags.
  const associated=(state.materials||[]).filter(m=>(m.assignments||[]).some(a=>
   a.classId===l.classId&&a.sequenceId===tpl.q.id&&a.unitId===tpl.u.id)).map(m=>m.id);
  l.materials=[...new Set([...(l.materials||[]),...associated])];
  l.status='planned';l.presentationReady=false;
  await Promise.resolve(saveState());
  render();
 }catch(err){
  for(const key of Object.keys(l))delete l[key];
  Object.assign(l,old);render();throw err;
 }
}
const oldView=viewHtml;
viewHtml=function(){
 if(view==='yearTransferV324')return page();
 const html=oldView();
 if(view!=='sequences'||!html.includes('v190-year-actions'))return html;
 return html.replace('<div class="v190-year-actions">','<div class="v190-year-actions">'+
  '<button type="button" class="secondary" data-v324-open>↻ Aus Vorjahr übernehmen</button>');
};
const oldTitle=pageTitle;
pageTitle=function(){return view==='yearTransferV324'?'Schuljahr übernehmen':oldTitle();};
const oldWizard=wizardPlanStepV14;
wizardPlanStepV14=function(l){
 const html=oldWizard(l),card=lessonCard(l),mark='<h3>Material in dieser Stunde</h3>';
 return card&&html.includes(mark)?html.replace(mark,card+mark):html;
};
const oldDay=v182LessonDayHtml;
v182LessonDayHtml=function(l){
 const html=oldDay(l),card=lessonCard(l),mark='<section class="panel v182-end-panel">';
 return card&&html.includes(mark)?html.replace(mark,card+mark):html;
};
const oldWire=wire;
wire=function(){
 oldWire();
 document.querySelector('[data-v324-open]')?.addEventListener('click',openTransfer);
 document.querySelectorAll('[data-v324-back]').forEach(x=>x.addEventListener('click',gotoYear));
 if(view==='yearTransferV324'){
  document.querySelector('[data-v324-year]')?.addEventListener('change',e=>{
   sourceYear=e.target.value;selected.clear();routes={};render();
  });
  document.querySelector('[data-v324-all]')?.addEventListener('click',()=>{
   selected=new Set(C.sourceSequences(state,initial()).map(q=>q.id));render();
  });
  document.querySelector('[data-v324-none]')?.addEventListener('click',()=>{selected.clear();render();});
  document.querySelectorAll('[data-v324-seq]').forEach(e=>e.addEventListener('change',()=>{
   if(e.checked)selected.add(e.dataset.v324Seq);else selected.delete(e.dataset.v324Seq);
   render();
  }));
  document.querySelectorAll('[data-v324-name]').forEach(e=>e.addEventListener('change',()=>{
   routes[e.dataset.v324Name]={...routes[e.dataset.v324Name],mode:'new',name:e.value};
   render();
  }));
  document.querySelectorAll('[data-v324-route]').forEach(e=>e.addEventListener('change',()=>{
   const cid=e.dataset.v324Route,old=routes[cid]||suggestedRoute({id:cid,course:cls(cid)});
   routes[cid]=e.value.startsWith('existing:')?
    {mode:'existing',targetId:e.value.slice(9),name:old.name}:
    {mode:'new',name:old.name||cls(cid)?.name||''};
   render();
  }));
  document.querySelector('[data-v324-apply]')?.addEventListener('click',e=>{
   if(saving)return;
   e.currentTarget.disabled=true;
   void apply().catch(err=>alert('Schuljahresübernahme abgebrochen: '+(err.message||err)))
    .finally(()=>{if(document.contains(e.currentTarget))e.currentTarget.disabled=false;});
  });
 }
 document.querySelectorAll('[data-v324-open-old]').forEach(btn=>btn.addEventListener('click',()=>{
  const old=lesson(btn.dataset.v324OpenOld);if(!old)return;
  v182LessonId=old.id;view='lessonDayV182';modal=null;render();
 }));
 document.querySelectorAll('[data-v324-template]').forEach(btn=>btn.addEventListener('click',()=>{
  const id=btn.dataset.v324Template;btn.disabled=true;
  void useTemplate(id).catch(err=>alert('Stundenvorlage: '+(err.message||err)))
   .finally(()=>{if(document.contains(btn))btn.disabled=false;});
 }));
};
const oldRender=render;
render=function(){
 oldRender();
 const badge=document.querySelector('.brand small');
 if(badge)badge.textContent=(state.settings?.schoolYear||'')+' · V0.32.4';
};
window.SchulcockpitYearTransferV324={openTransfer,preview:currentPreview,apply,useTemplate,unitTemplate};
})();
