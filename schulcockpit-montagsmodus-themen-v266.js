/* V0.26.6 – fehlende Soll-Themen im Montagsmodus sicher zuordnen. */
(function(){
'use strict';
function candidates(l){
 const year=v190NormYear(v190YearFromDate(l.date));
 const seqs=v190PlanningSequences(l.classId,year);
 const list=[];
 for(const q of seqs)for(const u of q.plan||[]){
  if(v201UnitSkipped(u))continue;
  list.push({q,u,date:u.plannedDate||''});
 }
 return list.sort((a,b)=>{
  const score=x=>x.date===l.date?0:x.date>=l.date?1:x.date?2:3;
  return score(a)-score(b)||a.date.localeCompare(b.date);
 });
}
function unresolved(l){
 if(!l?.classId||l.kind==='group'||l.groupId)return false;
 if(v182IsHeld(l)||concretePlanReadyV12(l)||l.v180MovedFrom||l.executionV180?.mode)return false;
 return !l.planReference?.unitId&&(!l.title||l.title==='Thema noch festlegen'||l.title==='');
}
function editor(l){
 const options=candidates(l);
 const field='<div class="v266-topic-picker" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">'+
 '<label style="flex:1;min-width:240px"><strong>Welche Folgestunde?</strong>'+
 '<select data-v266-select="'+esc(l.id)+'"><option value="">Thema aus der Jahresplanung auswählen …</option>'+
 options.map(({q,u,date})=>'<option value="'+esc(q.id+'|'+u.id)+'">'+esc((date?fmtDate(date)+' · ':'')+q.title+' – '+(u.title||'Unbenannte Soll-Stunde'))+'</option>').join('')+
 '</select></label><button type="button" class="secondary" data-v266-assign="'+esc(l.id)+'" '+(!options.length?'disabled':'')+'>Thema zuordnen</button></div>'+
 (!options.length?'<p class="muted">Für diesen Kurs und dieses Schuljahr gibt es noch keine aktiven Soll-Themen. Bitte zuerst den Reihenplan prüfen.</p>':
 '<p class="microcopy">Die Auswahl übernimmt nur das Thema in diese Unterrichtsstunde. Die Jahresplanung wird nicht verschoben und bestehende Materialien werden nicht gelöscht.</p>');
 return field;
}
const oldRow=typeof coursePrepRowV14==='function'?coursePrepRowV14:null;
if(oldRow)coursePrepRowV14=function(l){
 const html=oldRow(l);
 if(!unresolved(l))return html;
 return html.replace('</article>',editor(l)+'</article>');
};
const oldWire=wire;
wire=function(){
 oldWire();
 document.querySelectorAll('[data-v266-assign]').forEach(btn=>btn.addEventListener('click',async()=>{
  const l=state.lessons.find(x=>x.id===btn.dataset.v266Assign);
  if(!l||!unresolved(l))return alert('Diese Stunde wurde inzwischen geändert. Bitte die Ansicht neu öffnen.');
  const value=document.querySelector('[data-v266-select="'+CSS.escape(l.id)+'"]')?.value||'';
  if(!value)return alert('Bitte zuerst ein Thema auswählen.');
  const match=candidates(l).find(x=>x.q.id+'|'+x.u.id===value);
  if(!match)return alert('Das ausgewählte Soll-Thema ist nicht mehr vorhanden.');
  const {q,u}=match;
  if(!confirm('„'+(u.title||'Soll-Thema')+'“ für '+fmtDate(l.date)+' übernehmen? Die anderen Soll-Termine bleiben unverändert.'))return;
  const before=structuredClone(l);
  btn.disabled=true;
  try{
   l.sequenceId=q.id;l.unit=q.title;l.title=u.title||'Thema noch festlegen';
   l.objective=u.objective||'';
   l.planReference={plannedDate:u.plannedDate||'',title:u.title,content:u.content,
     objective:u.objective,material:u.material,notes:u.notes,unitId:u.id,autoMatched:false};
   await saveState();render();
  }catch(e){Object.keys(l).forEach(k=>delete l[k]);Object.assign(l,before);
   render();alert('Thema konnte nicht gespeichert werden: '+(e.message||e));}
 }));
};
const oldRender=render;
render=function(){oldRender();const tag=document.querySelector('.brand small');if(tag)tag.textContent=state.settings.schoolYear+' · V0.26.6';};
window.SchulcockpitLessonTopicV266={candidates,unresolved};
})();