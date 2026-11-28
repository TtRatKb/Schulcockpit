/* Schulcockpit V0.33.35 – explicit exam rubric linkage into private LEB history. */
(function(){
'use strict';
const C=SC_EXAM_LEB_V3335;let draft=null,busy=false;
const exam=()=>v200Assessment(v200Eval?.assessmentId),analysis=()=>v200EvalAnalysis(),priv=()=>v200Eval?.privateData;
async function open(){
 const a=exam(),an=analysis(),p=priv();if(!a||!an||!p)return alert('Bitte zuerst eine vollständige Klausurauswertung öffnen.');
 const [roster,leb]=await Promise.all([v200PrivateGet(v235Key(a.classId)),v200PrivateGet('__sc_leb_comp_v3334__:'+a.classId)]);
 if(roster?.schema!=='schulcockpit.private-class-roster.v1'||!roster.roster?.length)return alert('Bitte zuerst die private Klassenliste anlegen und eindeutig zuordnen.');
 if(leb?.schema!=='schulcockpit.private-leb-competencies.v1'||!leb.activated)return alert('Bitte zuerst die private LEB-Kompetenzmatrix im Kompetenzcockpit aktivieren.');
 draft={assessmentId:a.id,selected:new Set((an.competencies||[]).filter(c=>c.curriculumCompetencyId).map(c=>c.id)),roster,leb};modal={type:'examLebV3335'};render();
}
function participants(p){return (p.roster||[]).map(s=>({id:s.id,classStudentId:s.classStudentId||'',attendance:p.participationV210?.[s.id]||'present'}));}
function calc(){return C.preview({analysis:analysis(),reports:v200ReportList(),participants:participants(priv()),classRoster:draft.roster.roster,selected:[...draft.selected]});}
function modalV3335(){
 const a=exam(),an=analysis();if(!a||!draft)return '';const p=calc();
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-xwide v3335-modal" data-modal-stop><header class="modal-header"><div><span class="eyebrow">KLAUSUR ↔ PRIVATE LEB-HISTORIE</span><h2>'+esc(a.title||a.type||'Leistungsnachweis')+'</h2></div><button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body"><p>Bestätige jede tatsächlich bewertete Rasterzeile einzeln. Rohpunkte, Noten und Rückgabebögen werden nicht geändert.</p><div class="v3335-list">'+(an.competencies||[]).map(c=>'<label class="'+(!c.curriculumCompetencyId?'blocked':'')+'"><input type="checkbox" data-v3335-rubric="'+esc(c.id)+'" '+(draft.selected.has(c.id)?'checked':'')+' '+(!c.curriculumCompetencyId?'disabled':'')+'><span><strong>'+esc(c.text||c.id)+'</strong><small>Raster-ID '+esc(c.id)+' · '+(c.curriculumCompetencyId?'Curriculum '+esc(c.curriculumCompetencyId):'Curriculum-ID ungeklärt')+'</small></span></label>').join('')+'</div>'+(p.warnings.length?'<p class="warnbox">'+p.warnings.map(esc).join('<br>')+'</p>':'')+(p.errors.length?'<p class="warnbox" role="alert">'+p.errors.map(esc).join('<br>')+'</p>':'')+'<div class="v3335-preview">'+p.rows.map(r=>'<article><strong>'+esc(r.text)+'</strong><span>'+r.ratings.filter(x=>x.status==='E').length+' E · '+r.ratings.filter(x=>x.status==='TE').length+' TE · '+r.ratings.filter(x=>x.status==='NNE').length+' NNE · '+r.ratings.filter(x=>x.status==='open').length+' offen · '+r.ratings.filter(x=>x.status==='absent').length+' abwesend</span></article>').join('')+'</div><p class="microcopy">Offene Korrekturen, fehlende Identitäten und Abwesenheit werden niemals als NNE importiert. Zwei Rasterzeilen derselben Curriculum-ID bleiben getrennte Nachweise.</p><div class="v3335-actions"><button class="secondary" data-action="modal-close">Abbrechen</button><button class="primary" data-v3335-apply '+(!p.ready?'disabled':'')+'>Verknüpfung verbindlich übernehmen</button></div></div></section></div>';
}
async function apply(){
 if(busy)return;const a=exam(),p=calc();if(!p.ready)throw Error(p.errors.join('\n'));busy=true;
 const oldEvidence=structuredClone(state.competencyEvidenceV3333||[]),oldLinks=structuredClone(a.lebEvidenceLinksV3335||{}),oldLeb=structuredClone(draft.leb);
 try{
  const leb=structuredClone(draft.leb),links={...(a.lebEvidenceLinksV3335||{})};
  for(const row of p.rows){
   let eid=links[row.rubricId],e=(state.competencyEvidenceV3333||[]).find(x=>x.id===eid);
   if(!e){eid=uid('exam-evidence');e={schema:1,id:eid,classId:a.classId,competencyId:row.curriculumId,assessmentId:a.id,rubricCompetencyId:row.rubricId,status:'done',task:(a.title||a.type||'Klausur')+' · '+row.text,socialForm:'Einzelarbeit',duration:'',evidenceForm:'Klausur / Leistungsnachweis',scope:row.text,criteria:{E:'gemäß bestätigten Klausurgrenzen',TE:'gemäß bestätigten Klausurgrenzen',NNE:'gemäß bestätigten Klausurgrenzen'},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};state.competencyEvidenceV3333=state.competencyEvidenceV3333||[];state.competencyEvidenceV3333.push(e);links[row.rubricId]=eid;}
   for(const r of row.ratings){SC_LEB_COMPETENCIES_V3334.setRating(leb,eid,r.studentId,r.status,'Aus bestätigter Klausurrasterzeile',a.date||'');leb.ratings[eid][r.studentId].sourceV3335={assessmentId:a.id,rubricCompetencyId:row.rubricId,curriculumId:row.curriculumId,pct:r.pct};}
  }
  a.lebEvidenceLinksV3335=links;await v200PrivatePut(leb);draft.leb=leb;await saveState();modal=null;render();
 }catch(e){state.competencyEvidenceV3333=oldEvidence;a.lebEvidenceLinksV3335=oldLinks;try{await v200PrivatePut(oldLeb);}catch{}throw e;}finally{busy=false;}
}
const oldStep5=v200Step5;v200Step5=function(a,p){const h=oldStep5(a,p);if(!analysis()?.competencies?.length)return h;return h.replace('<div class="v200-actions">','<section class="detail-section v3335-entry"><span class="eyebrow">PRIVATE LEB-VERKNÜPFUNG</span><h3>Klausurraster als Kompetenznachweis übernehmen</h3><p>Erst nach Vorschau und Bestätigung; bestehende Punkte und Noten bleiben unverändert.</p><button class="secondary" data-v3335-open>Verknüpfung prüfen</button></section><div class="v200-actions">');};
const oldModal=modalHtml;modalHtml=function(){return modal?.type==='examLebV3335'?modalV3335():oldModal();};
const oldWire=wire;wire=function(){oldWire();document.querySelector('[data-v3335-open]')?.addEventListener('click',()=>void open());document.querySelectorAll('[data-v3335-rubric]').forEach(x=>x.addEventListener('change',()=>{x.checked?draft.selected.add(x.dataset.v3335Rubric):draft.selected.delete(x.dataset.v3335Rubric);render();}));document.querySelector('[data-v3335-apply]')?.addEventListener('click',e=>{e.currentTarget.disabled=true;void apply().catch(x=>{alert('Klausurverknüpfung nicht gespeichert: '+(x.message||x));render();});});};
const oldRender=render;render=function(){oldRender();const v=document.querySelector('.brand small');if(v)v.textContent=state.settings.schoolYear+' · V0.33.35';};
window.SchulcockpitExamLebV3335={open,preview:C.preview};render();
})();
