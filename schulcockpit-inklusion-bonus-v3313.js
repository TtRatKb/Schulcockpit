/* V0.33.13 – compact editing for the active inclusion assessment only.
 * The examined file remains the unit of ownership; old Classtime exports remain raw.
 */
(function(){
'use strict';
const core=window.SchulcockpitInclusionBonusV3313Core;
const gap=window.SchulcockpitBonusGapsV337;
if(!core||!gap)return;
const safe=x=>esc(String(x??''));
const exam=()=>v200Assessment(v200Eval?.assessmentId);
const file=()=>window.SchulcockpitExamTabsV338?.available?.(exam())?.find(
 f=>f.key===window.SchulcockpitExamTabsV338.activeKind(exam()));
let saving=false,dirty=false;
function rulesPanel(current,p){
 const an=p?.variantAnalysesV317?.[current?.fileKey];
 if(!an?.items?.length)return '';
 const opts=(it)=>{
  if(String(it.source).endsWith('_bonus'))return '<strong>Bonusfrage</strong>';
  const actual=core.mode(it);
  return '<select data-v3313-mode aria-label="Wertung für '+safe(it.label||it.id)+'">'+
   [['regular','Regulär'],['bonus','Ganz Bonus'],['partial','Teilweise Bonus']].map(([key,name])=>
    '<option value="'+key+'"'+(actual===key?' selected':'')+'>'+name+'</option>').join('')+
   '</select>';
 };
 return '<div class="v3313-rules"><h4>Wertung der Inklusionsaufgaben</h4>'+
  '<p class="microcopy">Punkte und Bonusregeln gehören ausschließlich zu dieser Prüfungsfassung. Originalwerte der Classtime-Excel bleiben unverändert.</p>'+
  '<div class="v210-scroll"><table class="v210-grid"><thead><tr><th>Aufgabe</th><th>Max.</th><th>Wertung</th><th>Bonusanteil</th></tr></thead><tbody>'+
  an.items.map(it=>{
   const bonus=String(it.source).endsWith('_bonus');
   return '<tr data-v3313-rule="'+safe(it.id)+'"><td><strong>'+safe(it.label||it.id)+'</strong></td>'+
    '<td>'+safe(core.max(it))+'</td><td>'+opts(it)+'</td><td>'+
    (bonus?'Alle Punkte Bonus':
     '<div class="v3313-part"'+(core.mode(it)==='partial'?'':' hidden')+'>'+
     '<label>Davon Bonus <input type="number" min="0.25" step="0.25" max="'+safe(core.max(it))+
     '" data-v3313-part value="'+safe(it.partialBonusV267?.max??'')+'"></label>'+
     '<label>Lücken/Teilaufgaben <input data-v3313-desc maxlength="150" placeholder="z. B. Lücken 2, 6, 9" value="'+
     safe(it.partialBonusV267?.description||'')+'"></label></div>')+
    '</td></tr>';
  }).join('')+'</tbody></table></div>'+
  '<div class="v200-actions"><button type="button" class="secondary" data-v3313-save>Wertung dieser Fassung speichern</button>'+
  '<span class="microcopy" role="status" data-v3313-status></span></div></div>';
}
function collectRules(){
 const current=file(),p=v200Eval?.privateData,an=p?.variantAnalysesV317?.[current?.fileKey];
 if(!current||!an)throw Error('Inklusionsraster fehlt.');
 const changes={};
 for(const row of document.querySelectorAll('[data-v3313-rule]')){
  const id=row.dataset.v3313Rule,it=an.items.find(it=>it.id===id);
  if(!it)throw Error('Aufgabe gehört nicht zum aktuellen Raster.');
  changes[id]={mode:row.querySelector('[data-v3313-mode]')?.value||'bonus',
   bonusMax:row.querySelector('[data-v3313-part]')?.value||'',
   description:row.querySelector('[data-v3313-desc]')?.value||''};
 }
 if(Object.keys(changes).length!==an.items.length)
  throw Error('Nicht alle Aufgaben der Inklusionsfassung geladen.');
 return {current,p,an,changes};
}
async function saveRules(){
 if(saving)return;
 const {current,p,an,changes}=collectRules();
 const result=core.updateRules(an,changes,p);
 if(!result.changed.length){dirty=false;return;}
 const scored=(p.roster||[]).some(st=>
  window.SchulcockpitExamAnalysisV317?.hasResults?.(p,st.id));
 if(scored&&!confirm('Diese Aufgabenwertung der Inklusionsfassung ändern?\n'+
  result.changed.join(', ')+'\n\nDie vorhandenen Schülerpunkte bleiben unverändert. Bei Bonuslücken müssen die individuell erreichten Bonuspunkte danach geprüft werden.'))return;
 saving=true;
 try{
  const currentAgain=file(),now=v200Eval?.privateData;
  if(currentAgain?.fileKey!==current.fileKey||now!==p)
   throw Error('Die Auswertung wurde inzwischen verändert. Bitte neu prüfen.');
  const next=structuredClone(p);
  next.variantAnalysesV317={...(next.variantAnalysesV317||{}),
   [current.fileKey]:result.analysis};
  await v200PrivatePut(next);
  v200Eval.privateData=next;
  dirty=false;
  render();
 }finally{saving=false;}
}
function bonusMarkup(item,studentId,p){
 if(!gap.isSplit(item,p?.gradingOverridesV267?.[studentId]?.[item.id]||{}))return '';
 const prior=p?.gradingOverridesV267?.[studentId]?.[item.id]?.bonusEarned;
 const raw=v200GetScore(p,studentId,item);
 const b=gap.bounds(item,raw);
 const options=b.ready?gap.options(b,gap.stepFor(item)):[];
 const saved=prior!==undefined&&prior!==null?String(prior):'';
 return '<label class="v3313-bonus">Davon Bonus'+
  (item.partialBonusV267?.description?' · '+safe(item.partialBonusV267.description):'')+
  '<select data-v3313-bonus="'+safe(studentId+'|'+item.id)+'" aria-label="Davon Bonus für '+
  safe(item.label||item.id)+'">'+
  '<option value="">'+(b.ready?'– noch prüfen –':'Gesamtpunkte zuerst eintragen')+'</option>'+
  (saved!==''&&!options.some(x=>String(x)===saved)?
    '<option selected value="'+safe(saved)+'">⚠ '+safe(saved)+' erneut prüfen</option>':'')+
  options.map(n=>'<option value="'+n+'"'+(String(n)===saved?' selected':'')+'>'+
    safe(String(n).replace('.',','))+' von '+safe(b.part)+'</option>').join('')+
  '</select></label>';
}
function refreshBonus(input){
 const current=file(),p=v200Eval?.privateData;
 if(!current||!p)return;
 const id=input.dataset.v317Score||'',split=id.indexOf('|');
 if(split<0)return;
 const studentId=id.slice(0,split),itemId=id.slice(split+1);
 const select=[...document.querySelectorAll('[data-v3313-bonus]')].find(el=>
  el.dataset.v3313Bonus===id);
 if(!select)return;
 const item=p.variantAnalysesV317?.[current.fileKey]?.items?.find(it=>it.id===itemId);
 if(!item)return;
 const placeholder=select.querySelector('option[value=""]');
 const bounds=gap.bounds(item,input.value);
 const old=select.value;
 select.replaceChildren(placeholder||new Option('– noch prüfen –',''));
 const values=bounds.ready?gap.options(bounds,gap.stepFor(item)):[];
 if(select.options[0])select.options[0].textContent=bounds.ready?'– noch prüfen –':'Gesamtpunkte zuerst eintragen';
 for(const value of values)select.add(new Option(String(value).replace('.',',')+' von '+bounds.part,String(value)));
 if(values.some(value=>String(value)===old))select.value=old;
 else select.value='';
}
const beforeWire=wire;
wire=function(){
 beforeWire();
 if(view!=='evaluation'||!v200Eval||!file())return;
 if(v200Eval.step===2){
  document.querySelectorAll('[data-v3313-mode]').forEach(select=>select.addEventListener('change',()=>{
   dirty=true;const part=select.closest('[data-v3313-rule]')?.querySelector('.v3313-part');
   if(part)part.hidden=select.value!=='partial';
  }));
  document.querySelectorAll('[data-v3313-part],[data-v3313-desc]').forEach(el=>
   el.addEventListener('input',()=>{dirty=true;}));
  document.querySelector('[data-v3313-save]')?.addEventListener('click',()=>{
   void saveRules().catch(error=>{
    const target=document.querySelector('[data-v3313-status]');
    if(target)target.textContent='Nicht gespeichert: '+(error.message||error);
   });
  });
 }
 if(v200Eval.step===4){
  document.querySelectorAll('.v338-section [data-v317-score]').forEach(input=>
   input.addEventListener('input',()=>refreshBonus(input)));
 }
};
window.SchulcockpitInclusionBonusV3313={rulesPanel,bonusMarkup,
 hasDirty:()=>dirty};
render();
})();
