/* Schulcockpit V0.33.4 – replaces contradictory task tables with ONE editor.
 * Existing score imports, PDF rendering and private data stay on their V200/V300/V317 paths.
 */
(function(){
'use strict';
const core=window.SchulcockpitAssessmentEditorV334;
if(!core)return;
const text=x=>esc(String(x??''));
const label=n=>Number.isFinite(Number(n))?String(Number(n)).replace('.',','):'–';
let saving=false,draftSave=Promise.resolve(),saveTimer=null;
const exam=()=>v200Assessment(v200Eval?.assessmentId);
function create(html){
 const div=document.createElement('div');div.innerHTML=html;return div;
}
function observed(a,item){
 const override=a?.itemDraftV334?.items?.[item.id];
 if(override)return {...core.row(item),...override};
 return core.row(item,a?.itemDraftV216?.items?.[item.id]||null);
}
function editableRow(item,a,an,grade){
 const p=observed(a,item),e=core.effective(p);
 const sourceOptions=[['classtime','Classtime'],['paper','Papier']];
 const modes=[['regular','Regulär'],['bonus','Komplett Bonus'],['partial','Teilweise Bonus']];
 const select=(field,choices,val)=>'<select data-v334-field="'+field+'" aria-label="'+field+' für '+text(item.label||item.id)+'">'+
   choices.map(([id,name])=>'<option value="'+id+'"'+(id===val?' selected':'')+'>'+text(name)+'</option>').join('')+'</select>';
 const comps=an.competencies||[];
 return '<tr data-v334-task="'+text(item.id)+'"><td class="v334-name"><strong>'+
  text(item.label||item.id)+'</strong><small>'+text(item.source.startsWith('paper')?'Papier':'Classtime')+
  ' · bisher '+label(core.rawMax(item))+' P</small>'+
  '<details class="v334-learning"'+(p.learningArea?' open':'')+'><summary>Lernbereich (optional)</summary>'+
  '<input data-v334-field="learningArea" value="'+text(p.learningArea||'')+'" maxlength="120" placeholder="z. B. Wissen und Deuten"></details></td>'+
  '<td>'+select('source',sourceOptions,p.source)+'</td>'+
  '<td><label class="v334-visually-hidden">Punkte insgesamt</label><input type="number" inputmode="decimal" min="0.25" step="0.25" data-v334-field="original" value="'+text(p.original)+'"></td>'+
  '<td>'+select('mode',modes,p.mode)+'</td>'+
  '<td><div class="v334-bonus-input"'+(p.mode==='partial'?'':' hidden')+'>'+
  '<input type="number" inputmode="decimal" min="0.25" step="0.25" data-v334-field="bonus" value="'+(p.mode==='partial'?text(p.bonus):'')+'" aria-label="Davon Bonuspunkte"></div>'+
  '<span class="v334-bonus-all"'+(p.mode==='bonus'?'':' hidden')+'>Alle Punkte</span>'+
  '<span class="v334-bonus-none"'+(p.mode==='regular'?'':' hidden')+'>–</span></td>'+
  '<td class="v334-result"><strong data-v334-reg>'+label(e.regular)+'</strong> regulär'+
  '<small><strong data-v334-bon>'+label(e.bonus)+'</strong> Bonus</small></td>'+
  '</tr>'+
  '<tr class="v334-subrow" data-v334-subrow="'+text(item.id)+'"'+(p.mode==='partial'?'':' hidden')+'><td colspan="6">'+
  '<label>Welche Lücken oder Teilaufgaben sind Bonus? <input data-v334-field="description" maxlength="150" placeholder="z. B. Lücken 2, 6, 9" value="'+text(p.description||'')+'"></label></td></tr>'+
  (grade<8&&comps.length>1?'<tr class="v334-subrow v334-comp"><td colspan="6"><label>Prüfkompetenz: '+
    select('competencyId',comps.map(c=>[c.id,c.text]),p.competencyId)+'</label></td></tr>':'');
}
function panel(a){
 const an=a.evaluationV200?.analysis,grade=v202Grade(cls(a.classId)),items=an.items||[];
 const draft=a.itemDraftV216?.items||{};
 const recovered=items.filter(it=>{
   const d=draft[it.id];return d&&Number(String(d.regularRaw).replace(',','.'))>0&&Number(String(d.bonusRaw).replace(',','.'))>0&&
     !String(d.source||it.source).endsWith('_bonus');
 });
 const rows=items.map(it=>editableRow(it,a,an,grade)).join('');
 const options=items.map(it=>observed(a,it)),sum=options.reduce((t,x)=>{
  const e=core.effective(x);
  if(Number.isFinite(e.regular))t.regular+=e.regular;
  if(Number.isFinite(e.bonus))t.bonus+=e.bonus;
  return t;
 },{regular:0,bonus:0});
 return '<section class="v334-panel"><div class="v334-header"><div><span class="eyebrow">EIN AUFGABENPLAN FÜR DIE GANZE ARBEIT</span>'+
  '<h3>Aufgaben und Punkte</h3></div>'+
  '<div class="v334-total"><strong><span data-v334-total-regular>'+label(sum.regular)+'</span> regulär</strong>'+
  '<span>+ <span data-v334-total-bonus>'+label(sum.bonus)+'</span> Bonus möglich</span></div></div>'+
  '<p class="v334-hint">Trage pro Aufgabe die <strong>ursprünglichen Gesamtpunkte</strong> ein. Bei teilweise Bonus werden die Bonuspunkte davon abgezogen – nicht ein zweites Mal von den regulären Punkten.</p>'+
  (recovered.length?'<p class="v334-recovered">Frühere Eingabe erkannt: '+recovered.map(it=>text(it.label||it.id)).join(', ')+
    '. Die Kombination aus regulären und Bonuspunkten wird hier als Gesamtpunktzahl vorgeschlagen. Bitte prüfen und einmal speichern.</p>':'')+
  '<div class="v334-table-scroll"><table class="v334-table"><thead><tr>'+
  '<th>Aufgabe</th><th>Bearbeitet in</th><th>Punkte insgesamt</th><th>Wertung</th><th>Davon Bonus</th><th>Ergebnis</th>'+
  '</tr></thead><tbody>'+rows+'</tbody></table></div>'+
  '<div class="v334-footer"><p id="v216-save-state" role="status" data-status="draft">'+
  text(a.itemDraftV334||a.itemDraftV216?'Entwurf vorhanden – bitte prüfen und speichern':'Alle bestätigten Angaben sind lokal gespeichert')+
  '</p><button type="button" class="primary" data-v334-save>Aufgabenplan prüfen und speichern</button></div>'+
  '<details class="v334-add"><summary>Fehlen zusätzliche Papier- oder Classtime-Aufgaben?</summary>'+
  '<p>Nur nötig, wenn eine Aufgabe im Plan fehlt.</p><div class="v334-add-buttons">'+
  '<button class="secondary" data-v210-add-paper>+ Papieraufgabe</button>'+
  '<button class="secondary" data-v216-add-classtime>+ Classtime-Aufgabe</button>'+
  '<button class="secondary" data-v213-add-bonus="paper_bonus">+ Papierbonus</button>'+
  '<button class="secondary" data-v213-add-bonus="classtime_bonus">+ Classtime-Bonus</button>'+
  '</div></details>'+
  '</section>';
}
const previousStep3=v200Step3;
v200Step3=function(a,priv){
 const html=previousStep3(a,priv);
 if(!a?.evaluationV200?.analysis?.items?.length)return html;
 const root=create(html),plan=root.querySelector('.v218-flow [data-v218-stage="plan"]');
 const body=plan?.querySelector('.v218-stage-content');
 if(!body)return html;
 body.innerHTML=panel(a);
 plan.open=true;
 const summary=plan.querySelector('summary .v218-stage-name strong');
 if(summary)summary.textContent='1 · Aufgaben und Punkte';
 const pending=!!(a.itemDraftV334||a.itemDraftV216);
 plan.classList.toggle('v218-pending',pending);
 plan.classList.toggle('v218-done',!pending);
 const stageStatus=plan.querySelector('.v218-stage-status');
 if(stageStatus)stageStatus.textContent=pending?'Entwurf · noch bestätigen':'Gespeichert · jederzeit ändern';
 if(pending)root.querySelectorAll('[data-v200-step="4"],[data-v200-step="5"]').forEach(btn=>{
   btn.disabled=true;btn.title='Bitte den Aufgabenplan zuerst prüfen und speichern.';
 });
 // Remove conflicting duplicates rather than hiding them in another "advanced" menu.
 root.querySelectorAll('.v333-legacy,.v216-progress,.v218-optional').forEach(node=>node.remove());
 return root.innerHTML;
};
function collect(){
 const a=exam(),an=a?.evaluationV200?.analysis;
 if(!a||!an)return null;
 const rows=[...document.querySelectorAll('.v334-table [data-v334-task]')];
 if(rows.length!==an.items.length)return null;
 const items={};
 for(const row of rows){
  const id=row.dataset.v334Task;
  const field=name=>row.querySelector('[data-v334-field="'+name+'"]')?.value;
  const description=document.querySelectorAll('[data-v334-subrow]')||[];
  const sub=[...description].find(el=>el.dataset.v334Subrow===id);
  const competency=[...document.querySelectorAll('.v334-comp')].find(el=>{
    const prior=el.previousElementSibling;return prior?.dataset.v334Subrow===id;
  });
  const original=an.items.find(x=>x.id===id);
  items[id]={id,source:field('source'),original:field('original'),mode:field('mode'),
    bonus:field('bonus'),description:sub?.querySelector('[data-v334-field="description"]')?.value||'',
    learningArea:field('learningArea')||'',competencyId:original?.competencyId||''};
  if(competency?.querySelector('[data-v334-field="competencyId"]'))
   items[id].competencyId=competency.querySelector('[data-v334-field="competencyId"]').value;
 }
 return items;
}
function preview(){
 const a=exam();if(!a)return;
 const rows=collect();if(!rows)return;
 let reg=0,bonus=0,valid=true;
 for(const [id,data] of Object.entries(rows)){
  const e=core.effective(data);
  const cell=[...document.querySelectorAll('[data-v334-task]')].find(x=>x.dataset.v334Task===id);
  if(!Number.isFinite(e.regular)||!Number.isFinite(e.bonus)||!Number.isFinite(e.total)||
    e.total<=0||(data.mode==='partial'&&(e.bonus<=0||e.bonus>=e.total)))valid=false;
  else{reg+=e.regular;bonus+=e.bonus;}
  if(cell){
   const r=cell.querySelector('[data-v334-reg]'),b=cell.querySelector('[data-v334-bon]');
   if(r)r.textContent=label(e.regular);
   if(b)b.textContent=label(e.bonus);
   const mode=cell.querySelector('[data-v334-field="mode"]')?.value;
   const parent=cell.querySelector('.v334-bonus-input');
   const all=cell.querySelector('.v334-bonus-all');
   const none=cell.querySelector('.v334-bonus-none');
   const sub=[...document.querySelectorAll('[data-v334-subrow]')].find(x=>x.dataset.v334Subrow===id);
   if(parent)parent.hidden=mode!=='partial';
   if(all)all.hidden=mode!=='bonus';
   if(none)none.hidden=mode!=='regular';
   if(sub)sub.hidden=mode!=='partial';
  }
 }
 const r=document.querySelector('[data-v334-total-regular]'),b=document.querySelector('[data-v334-total-bonus]');
 if(r)r.textContent=valid?label(reg):'–';
 if(b)b.textContent=valid?label(bonus):'–';
 const status=document.querySelector('.v334-footer #v216-save-state');
 if(status){status.textContent='Entwurf – noch nicht bestätigt';status.dataset.status='draft';}
}
function scheduleDraft(){
 const a=exam(),fields=collect();
 if(!a||!fields)return;
 a.itemDraftV334={schema:1,items:fields};
 preview();
 if(saveTimer!==null)clearTimeout(saveTimer);
 saveTimer=setTimeout(()=>{
  saveTimer=null;
  draftSave=draftSave.catch(()=>{}).then(()=>saveState())
    .catch(err=>{const box=document.querySelector('.v334-footer #v216-save-state');
      if(box){box.textContent='Zwischenspeichern fehlgeschlagen: '+(err.message||err);box.dataset.status='error';}});
 },350);
}
function columnsFor(an,priv){
 const ct=priv?.classtime;
 if(!ct?.parsed||typeof v200QuestionColumns!=='function')return [];
 const columns=v200QuestionColumns(ct),mapping=ct.mapping||{};
 return (an.items||[]).map(it=>{
  const col=columns.find(x=>String(x.index)===String(mapping[it.id]));
  return col?{id:it.id,max:col.max}:null;
 }).filter(Boolean);
}
async function commit(){
 if(saving)return;
 const a=exam(),an=a?.evaluationV200?.analysis,priv=v200Eval?.privateData,form=collect();
 if(!a||!an||!form)return;
 const batch=an.items.map(it=>form[it.id]);
 const result=core.verify(an.items,batch,priv,columnsFor(an,priv));
 if(result.changed.length&&!confirm('Diese Änderungen für die ganze Klassenarbeit übernehmen?\n'+
   result.changed.join(', ')+'\n\nNeue maximale Wertung: '+label(result.regular)+' reguläre + '+
   label(result.bonus)+' Bonuspunkte.'+
   '\nDie ursprünglichen Schülerpunkte werden nicht überschrieben.'+
   (result.warnings.length?'\n\nBitte beachten:\n'+result.warnings.join('\n'):'')))return;
 const old={items:an.items,draft216:a.itemDraftV216,draft334:a.itemDraftV334,
  reviewed:a.competencySelectionV204?.teacherReviewedV205};
 saving=true;
 try{
  if(saveTimer!==null){clearTimeout(saveTimer);saveTimer=null;}
  await draftSave.catch(()=>{});
  an.items=result.items;
  delete a.itemDraftV216;
  delete a.itemDraftV334;
  if(result.changed.length&&a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=false;
  await saveState();
  render();
  const status=document.querySelector('.v334-footer #v216-save-state');
  if(status){status.textContent='✓ Aufgabenplan gespeichert · '+label(result.regular)+' reguläre + '+
    label(result.bonus)+' Bonuspunkte';status.dataset.status='success';}
 }catch(err){
  an.items=old.items;
  if(old.draft216===undefined)delete a.itemDraftV216;else a.itemDraftV216=old.draft216;
  if(old.draft334===undefined)delete a.itemDraftV334;else a.itemDraftV334=old.draft334;
  if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=old.reviewed;
  throw err;
 }finally{saving=false;}
}
const beforeWire=wire;
wire=function(){
 beforeWire();
 if(view!=='evaluation'||v200Eval?.step!==3||!document.querySelector('.v334-panel'))return;
 document.querySelectorAll('[data-v200-step]').forEach(btn=>btn.addEventListener('click',e=>{
   const a=exam(),to=Number(btn.dataset.v200Step);
   if(to>=4&&(a?.itemDraftV216||a?.itemDraftV334)){
     e.preventDefault();e.stopImmediatePropagation();
     alert('Bitte den Aufgabenplan einmal prüfen und speichern. Der bisherige Entwurf bleibt erhalten.');
   }else if(to<4&&a?.itemDraftV216&&!a?.itemDraftV334){
     a.itemDraftV334={schema:1,items:collect()||{}};
   }
 },true));
 document.querySelectorAll('.v334-panel [data-v334-field]').forEach(input=>{
  input.addEventListener('input',scheduleDraft);
  if(input.tagName==='SELECT')input.addEventListener('change',scheduleDraft);
 });
 document.querySelector('[data-v334-save]')?.addEventListener('click',()=>{
  void commit().catch(err=>{
    const status=document.querySelector('.v334-footer #v216-save-state');
    if(status){status.textContent='Nicht gespeichert: '+(err.message||err);status.dataset.status='error';}
    alert('Aufgabenplan: '+(err.message||err));
  });
 });
};
const prevRender=render;
render=function(){
 prevRender();
 const name=document.querySelector('.brand small');
 if(name)name.textContent=(state.settings?.schoolYear||'')+' · V0.33.4';
};
render();
})();