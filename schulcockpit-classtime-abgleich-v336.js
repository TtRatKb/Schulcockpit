/* Schulcockpit V0.33.6 – one reviewed Classtime question map, including 3-point bonuses.
 * No original Excel cells are edited. Only verified digital marks enter private IndexedDB.
 */
(function(){
'use strict';
const core=window.SchulcockpitClasstimeMatchV336;
if(!core)return;
const safe=x=>esc(String(x??''));
const exam=()=>v200Assessment(v200Eval?.assessmentId);
const priv=()=>v200Eval?.privateData;
const analysis=()=>v200EvalAnalysis();
const fmt=n=>String(n).replace('.',',');
function candidates(an,cols){
 return an.items.filter(it=>{
  if(it.source==='classtime')return true;
  if(it.source!=='classtime_bonus')return false;
  // A 0/0 Classtime bonus has no objectively scored numeric value.
  // It remains in the existing answer-sheet-based manual bonus path.
  return !core.matches(it,cols).some(c=>Number(c.max)===0);
 });
}
function mapped(it,ct,proposals){
 const draft=ct.mapDraftV218?.mapping||{};
 return Object.prototype.hasOwnProperty.call(draft,it.id)?draft[it.id]:proposals[it.id];
}
const beforeAudit=v210ScoreAudit;
v210ScoreAudit=function(p,an,mapOverride=null,rulesOverride=null){
 const ct=p?.classtime;
 if(!ct?.detection?.sourceV210||!an?.items?.length)
  return beforeAudit(p,an,mapOverride,rulesOverride);
 const map=mapOverride||ct.mapping||{},cols=new Map(v200QuestionColumns(ct).map(c=>[String(c.index),c]));
 const decisions=ct.regradeV336||{};
 const shadow={...an,items:[]},scale=new Map();
 for(const item of an.items){
  if(item.source!=='classtime'){shadow.items.push(item);continue;}
  const col=cols.get(String(map[item.id]));
  const original=Number(item.regularMax);
  if(!col||!Number.isFinite(col.max)||Math.abs(col.max-original)<1e-8){
   shadow.items.push(item);continue;
  }
  if(decisions[item.id]==='manual'){
   // This task is intentionally left blank for a human to grade on the new scale.
   continue;
  }
  if(decisions[item.id]==='scale'){
   shadow.items.push({...item,regularMax:col.max});
   scale.set(item.id,{old:col.max,current:original});
  }else shadow.items.push(item); // Old validator must continue to reject unresolved mismatches.
 }
 const audit=beforeAudit(p,shadow,map,rulesOverride);
 for(const row of audit.rows||[]){
  const conversion=scale.get(row.itemId);
  if(!conversion)continue;
  if(row.score!==null&&Number.isFinite(Number(row.score))){
   const adapted=core.safeScale(row.score,conversion.old,conversion.current);
   if(adapted!==null){row.score=adapted;row.max=conversion.current;row.changed=true;}
  }
 }
 if(scale.size)audit.rescaledV336=[...scale.keys()];
 audit.manualV336=an.items.filter(it=>it.source==='classtime'&&decisions[it.id]==='manual')
   .map(it=>it.id);
 return audit;
};
const beforeApply=v200ApplyClasstimeScores;
v200ApplyClasstimeScores=function(p,an){
 const ct=p?.classtime,cols=v200QuestionColumns(ct);
 const items=candidates(an,cols),map=ct?.mapping||{},regrade=ct?.regradeV336||{};
 const validated=core.validateMapping(items,cols,map,regrade);
 if(!validated.ok)throw Error('Die Zuordnung ist nicht vollständig: '+validated.issues.slice(0,3).join('; '));
 const bonus=core.numericBonusRows(p,items,validated.selectedById,v210StrictScore,
  typeof v212AnswerStatus==='function'?v212AnswerStatus:null);
 // Validate and calculate all bonus rows before any regular scores are changed.
 const nextBonus=structuredClone(p.bonusScores||{}),origins=structuredClone(p.bonusOriginsV213||{});
 let imported=0,preserved=0;
 for(const x of bonus.rows){
  if(x.score===null)continue;
  const values=nextBonus[x.studentId]||{},previous=values[x.itemId];
  const origin=origins[x.studentId]?.[x.itemId];
  if(previous!==null&&previous!==undefined&&
     (origin!=='excel-bonus-v336'||Number(previous)!==Number(x.score))){
   preserved++;continue; // Never replace manually edited bonus marks.
  }
  nextBonus[x.studentId]={...values,[x.itemId]:x.score};
  origins[x.studentId]={...(origins[x.studentId]||{}),[x.itemId]:
   x.verifiedEmpty?'unanswered-q-sheet':'excel-bonus-v336'};
  imported++;
 }
 beforeApply(p,an);
 p.bonusScores=nextBonus;
 p.bonusOriginsV213=origins;
 p.classtime.scoreAuditV210={...(p.classtime.scoreAuditV210||{}),
  bonusImportedV336:imported,bonusPreservedV336:preserved,bonusWarningsV336:bonus.warnings,
  manuallyRegradedV336:an.items.filter(it=>regrade[it.id]==='manual').map(it=>it.id)};
};
const beforeSave=v200SaveMappingAndScores;
v200SaveMappingAndScores=async function(){
 const p=priv(),an=analysis(),ct=p?.classtime;
 if(!ct||!an)return beforeSave();
 const cols=v200QuestionColumns(ct),items=candidates(an,cols);
 const mapping={...(ct.mapping||{})};
 for(const el of document.querySelectorAll('[data-v200-map-item]'))
  mapping[el.dataset.v200MapItem]=el.value===''?'':Number(el.value);
 const policies={...(ct.regradeV336||{})};
 for(const el of document.querySelectorAll('[data-v336-regrade]')){
  const val=el.value;
  if(val!=='manual'&&val!=='scale')delete policies[el.dataset.v336Regrade];
  else policies[el.dataset.v336Regrade]=val;
 }
 const checked=core.validateMapping(items,cols,mapping,policies);
 if(!checked.ok)throw Error(checked.issues.slice(0,6).join('; '));
 const converted=items.filter(it=>policies[it.id]==='scale');
 const manual=items.filter(it=>policies[it.id]==='manual');
 if((converted.length||manual.length)&&!confirm(
   'Abweichende Classtime-Höchstpunktzahlen bestätigen?\n'+
   converted.map(it=>(it.label||it.id)+': proportional auf '+fmt(core.maximum(it))+
    ' Punkte, auf Viertelpunkte gerundet').concat(
   manual.map(it=>(it.label||it.id)+': selbst neu bewerten, kein Excelwert wird übertragen')).join('\n')+
   '\n\nDie ursprüngliche Excel-Datei bleibt unverändert. Bereits manuelle Korrekturen werden nicht überschrieben.'))return;
 const snapshot={
  regrade:structuredClone(ct.regradeV336||{}),bonus:structuredClone(p.bonusScores||{}),
  origins:structuredClone(p.bonusOriginsV213||{}),oldMapping:structuredClone(ct.mapping||{}),
  oldScores:structuredClone(p.scores||{}),oldProvenance:structuredClone(p.scoreSourcesV211||{}),
  oldAudit:structuredClone(ct.scoreAuditV210||null),oldReviewed:ct.reviewedV210
 };
 ct.regradeV336=policies;
 try{
  await beforeSave();
  if(!ct.reviewedV210||ct.scoreAuditV210===snapshot.oldAudit){
   ct.regradeV336=snapshot.regrade;
   return;
  }
 }catch(e){
  ct.regradeV336=snapshot.regrade;ct.mapping=snapshot.oldMapping;
  ct.scoreAuditV210=snapshot.oldAudit;ct.reviewedV210=snapshot.oldReviewed;
  p.bonusScores=snapshot.bonus;p.bonusOriginsV213=snapshot.origins;
  p.scores=snapshot.oldScores;p.scoreSourcesV211=snapshot.oldProvenance;
  throw e;
 }
};
const oldMap=v218MapBlock;
v218MapBlock=function(p,an){
 const ct=p?.classtime;
 if(!ct?.detection?.sourceV210)return oldMap(p,an);
 const cols=v200QuestionColumns(ct),items=candidates(an,cols);
 const proposals=core.recommend(items,cols,{...(ct.mapping||{}),...(ct.mapDraftV218?.mapping||{})});
 const all=new Map(cols.map(c=>[String(c.index),c]));
 let suggested=0,manualOptions=0;
 const rows=items.map(it=>{
  const selected=mapped(it,ct,proposals),match=all.get(String(selected));
  if(match)suggested++;
  const max=core.maximum(it),mismatch=match&&Number(match.max)!==max;
  const choice=ct.regradeDraftV336?.[it.id]||ct.regradeV336?.[it.id]||'';
  const matching=core.matches(it,cols);
  const certain=matching.length===1&&match&&matching[0].index===match.index;
  const options='<option value="">— Excel-Frage auswählen —</option>'+
   cols.filter(c=>Number(c.max)>0).map(c=>'<option value="'+safe(c.index)+'"'+
    (String(selected)===String(c.index)?' selected':'')+'>'+
     safe(c.label+' · '+(c.description||'')+' · '+fmt(c.max)+' Punkte')+'</option>').join('');
  const regrade=mismatch?
   '<div class="v336-regrade"><strong>Excel '+fmt(match.max)+
   ' Punkte → Bewertung '+fmt(max)+' Punkte</strong><label>Wie sollen die Punkte gewertet werden?'+
   '<select data-v336-regrade="'+safe(it.id)+'"><option value="">Bitte entscheiden</option>'+
   '<option value="manual"'+(choice==='manual'?' selected':'')+
   '>Manuell neu bewerten (Excelwert nicht übernehmen)</option>'+
   '<option value="scale"'+(choice==='scale'?' selected':'')+
   '>Proportional umrechnen (auf Viertelpunkte)</option></select></label></div>':'';
  if(mismatch)manualOptions++;
  return '<tr><td><strong>'+safe(it.label||it.id)+'</strong><small>'+
   safe(core.taskLabel(it))+'</small></td><td><select data-v200-map-item="'+safe(it.id)+'">'+
   options+'</select><small class="v336-hint">'+
   (match?(certain?'Eindeutiger Vorschlag · wird mit dem Import bestätigt':
      'Zuordnung bitte kontrollieren'):'Noch keine passende Frage ausgewählt')+
   '</small>'+regrade+'</td></tr>';
 }).join('');
 const rules=cols.filter(c=>Number(c.max)>0).map(c=>{
  const value=ct.mapDraftV218?.rules?.[c.label]||v210QuestionRule(ct,c.label);
  const options=[['original','Originalpunkte beibehalten'],['binary','Nur 0 oder volle Punktzahl'],
   ['quarter','Auf Viertelpunkte runden']];
  return '<tr><td>'+safe(c.label+' · '+(c.description||''))+'</td><td>'+
    safe(c.max)+'</td><td><select data-v210-rule="'+safe(c.label)+'">'+
    options.map(([id,name])=>'<option value="'+id+'"'+(id===value?' selected':'')+'>'+
     safe(name)+'</option>').join('')+'</select></td></tr>';
 }).join('');
 const zeros=an.items.filter(it=>it.source==='classtime_bonus'&&
  core.matches(it,cols).some(c=>c.max===0)).length;
 return '<section class="v336-questions"><p>Die eindeutig erkannten Fragen sind bereits vorausgewählt. '+
  'Prüfe die Zuordnung einmal und bestätige sie unten. <strong>Es wird nichts doppelt bewertet.</strong></p>'+
  '<p class="v336-progress"><strong>'+suggested+' von '+items.length+
  '</strong> digitalen Aufgaben vorgeschlagen'+(zeros?' · '+zeros+
    ' Bonusfrage(n) ohne Classtime-Punkte werden anschließend separat geprüft':'')+'.</p>'+
  '<div class="v210-scroll"><table class="v210-grid v336-table"><thead><tr>'+
  '<th>Deine Aufgabe und Wertung</th><th>Passende Excel-Frage</th></tr></thead><tbody>'+
  rows+'</tbody></table></div>'+
  '<details class="v336-extra"><summary>Nur bei Bedarf: Excel-Bewertungsregeln kontrollieren</summary>'+
  '<p>Diese Regeln ändern weder Bonusstatus noch Aufgabenmaximum. Bei normalen Punktwerten '+
  'kann „Originalpunkte beibehalten“ ausgewählt bleiben.</p>'+
  '<div class="v210-scroll"><table class="v210-grid"><thead><tr><th>Excel-Frage</th><th>Max.</th>'+
  '<th>Regel</th></tr></thead><tbody>'+rules+'</tbody></table></div></details>'+
  '<p class="v336-message" role="status">'+
  (manualOptions?'Bei '+manualOptions+' Aufgabe(n) stimmen Original- und Bewertungsmaximum nicht überein. '+
    'Bitte dort eine Neubewertung wählen. ':'')+
  'Die Auswahl wird beim Bestätigen überprüft und die Punkte werden nur bei gültigen '+
  'Zuordnungen übernommen.</p>'+
  '<button class="primary" data-v218-apply-scores>Excel-Zuordnung prüfen und Punkte übernehmen ✓</button></section>';
};
const previousBonus=v218BonusBlock;
v218BonusBlock=function(p,an){
 const ct=p?.classtime;
 if(ct?.detection?.sourceV210&&!v200QuestionColumns(ct).some(c=>c.max===0))
  return '<p>Die Bonusaufgaben mit regulären Excel-Punktespalten sind bereits in der gemeinsamen '+
   'Excel-Zuordnung enthalten. Du musst hier nichts ein zweites Mal zuordnen. '+
   'Die Bonuslücken innerhalb einer Aufgabe werden bei der individuellen Korrektur erfasst.</p>';
 return previousBonus(p,an);
};
const previousWire=wire;
wire=function(){
 previousWire();
 if(view!=='evaluation'||v200Eval?.step!==3)return;
 document.querySelectorAll('[data-v336-regrade]').forEach(el=>{
  el.addEventListener('change',()=>{
   const p=priv(),ct=p?.classtime;if(!ct)return;
   ct.regradeDraftV336={...(ct.regradeDraftV336||{}),[el.dataset.v336Regrade]:el.value};
   // Unlike confirmed scores, this is only a reversible local private draft.
   void v200PrivatePut(p).catch(err=>{
    const status=document.querySelector('.v336-message');
    if(status)status.textContent='Die Neubewertungs-Auswahl wurde nicht gespeichert: '+(err.message||err);
   });
  });
 });
};
const previousRender=render;
render=function(){
 previousRender();
 const version=document.querySelector('.brand small');
 if(version)version.textContent=(state.settings?.schoolYear||'')+' · V0.33.6';
};
render();
})();