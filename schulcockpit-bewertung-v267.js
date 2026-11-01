/* V0.26.7 – Bewertungsregeln für Aufgaben, Bonuslücken und einzelne Kinder.
   Rohpunkte aus Classtime bleiben unangetastet; Individualregeln nur in privater IndexedDB. */
(function(){
'use strict';
const calc=SC_GRADING_V267,base=SC_GRADING_V260;
function current(){return v200Assessment(v200Eval?.assessmentId);}
function analysis(){return v200EvalAnalysis();}
function privacy(){return v200Eval?.privateData;}
function grade8(a){return a&&v202Grade(cls(a.classId))>=8;}
function itemMax(it){return base.max(it);}
function possible(it){return !base.bonus(it)&&itemMax(it)>0;}
function student(){return privacy()?.roster?.[Math.min(Math.max(Number(v200Eval?.studentIndex)||0,0),Math.max(0,(privacy()?.roster?.length||1)-1))];}
function changes(priv,id){return priv?.gradingOverridesV267?.[id]||{};}
function scoreText(v){return v===null||v===undefined||v===''?'–':v233Number(v);}
const oldReport=v200StudentReport;
v200StudentReport=function(priv,an,stu){
 const old=oldReport(priv,an,stu);
 if(!an||old.participationV210&&old.participationV210!=='present')return old;
 const calculated=calc.compute(an.items,an.competencies,it=>v200GetScore(priv,stu.id,it),
    changes(priv,stu.id),!grade8(current()),an.thresholds,v200StatusFor);
 const a=current(),manual=String(priv.gradesV260?.[stu.id]||'').trim();
 const auto=calculated.complete?base.grade(calculated.totalPct,a?.gradeScaleV260):'';
 return {...old,...calculated,student:stu,gradeV260:manual||auto,
    gradeIsManualV260:!!manual,gradeAutoV260:auto,
    participationV210:'present'};
};
const oldPrompt=v200AssessmentAnalysisPrompt;
v200AssessmentAnalysisPrompt=function(a,priv){
 return oldPrompt(a,priv)+'\nZusatz für spätere Korrektur: Kennzeichne eindeutig einzelne Lücken/Teilfragen und deren maximale Punkte, soweit dies aus den anonymen Aufgabenmaterialien erkennbar ist. Für vom Classtime-Gesamtwert abweichende Bewertungen werden Bonuslücken und individuelle Sonderregeln später ausschließlich lokal im Schulcockpit festgelegt. Wenn Classtime nur eine Gesamtspalte enthält, darfst du die individuellen Teilpunkte nicht schätzen. Keine Schülernamen oder Schülerantworten anfordern.\n';
};
function partialEditor(a){
 const an=analysis();if(!an?.items?.length)return '';
 const options=an.items.filter(possible);
 if(!options.length)return '';
 const sel=options[0],part=sel.partialBonusV267||{};
 const all=an.items.filter(it=>it.partialBonusV267?.max>0);
 return '<section class="detail-section v267-global"><details><summary><strong>Bonuslücken / Lernbereiche innerhalb einer Aufgabe</strong></summary>'+
 '<p>Du kannst z. B. bei einem Lückentext mit 8 Punkten 2 Punkte als Bonus werten. Die originalen Classtime-Punkte bleiben bestehen. Für die tatsächlich erreichten Bonuspunkte wird später pro Kind eine getrennte Eingabe benötigt, falls Classtime nur den Aufgaben-Gesamtwert liefert.</p>'+
 '<div class="v267-edit-grid"><label>Aufgabe<select data-v267-task>'+options.map(it=>'<option value="'+esc(it.id)+'">'+esc(it.label)+' · '+scoreText(itemMax(it))+' P</option>').join('')+'</select></label>'+
 '<label>Davon Bonuspunkte (leer = keine)<input type="number" min="0" step="0.25" data-v267-max value="'+esc(part.max??'')+'"></label>'+
 '<label>Bonuslücken bezeichnen (z. B. Lücken 3, 7)<input data-v267-description maxlength="150" value="'+esc(part.description||'')+'"></label>'+
 '<label>Lernbereich/Teilkompetenz (optional, besonders Jg. 8+)<input data-v267-area maxlength="120" value="'+esc(sel.learningAreaV267||'')+'"></label></div>'+
 '<button class="secondary" data-v267-save-global>Aufgabenregel speichern</button>'+
 (all.length?'<p><strong>Aktiv:</strong> '+all.map(it=>esc(it.label)+' – '+scoreText(it.partialBonusV267.max)+' Bonus-P · '+esc(it.partialBonusV267.description||'ohne Bezeichnung')).join(' · ')+'</p>':'')+
 '<p class="microcopy">Eine Aufgabe kann entweder vollständig Bonus sein oder in reguläre und Bonuspunkte aufgeteilt werden. Bereits vergebene Rohpunkte werden niemals automatisch umgeschrieben.</p></details></section>';
}
const oldStep3=v200Step3;
v200Step3=function(a,priv){return partialEditor(a)+oldStep3(a,priv);};
function individualEditor(a,priv){
 const st=student(),an=analysis();if(!st||!an?.items?.length)return '';
 const overrides=changes(priv,st.id);
 const eligible=an.items.filter(it=>possible(it)||base.bonus(it));
 const split=an.items.filter(it=>it.partialBonusV267?.max>0&&!base.bonus(it)&&overrides[it.id]?.mode!=='bonus'&&overrides[it.id]?.mode!=='exclude');
 const exceptions=an.items.filter(it=>overrides[it.id]?.mode&&overrides[it.id].mode!=='default');
 return '<section class="detail-section v267-individual"><details '+(exceptions.length||split.length?'open':'')+'>'+
 '<summary><strong>Individuelle Bewertung / Bonuslücken</strong> · '+esc(st.name)+'</summary>'+
 '<p>Nur für dieses Kind: eine Aufgabe normal werten, als Bonus behandeln oder ganz aus der Wertung nehmen. Keine automatische Entscheidung anhand von Förderstatus. Andere Kinder bleiben unverändert.</p>'+
 '<div class="v267-edit-grid"><label>Aufgabe<select data-v267-exception-item>'+eligible.map(it=>'<option value="'+esc(it.id)+'">'+esc(it.label)+'</option>').join('')+'</select></label>'+
 '<label>Individuelle Wertung<select data-v267-exception-mode><option value="default">Wie für die Klasse</option><option value="bonus">Nur hier Bonus</option><option value="exclude">Hier nicht werten (ohne Bonus)</option></select></label></div>'+
 '<button type="button" class="secondary" data-v267-save-exception>Ausnahme speichern</button>'+
 (exceptions.length?'<div class="v267-exceptions"><strong>Nur für '+esc(st.name)+' abweichend:</strong> '+exceptions.map(it=>
  '<span>'+esc(it.label)+' · '+(overrides[it.id].mode==='bonus'?'Bonus':'nicht gewertet')+
  ' <button type="button" class="text-button" data-v267-clear="'+esc(it.id)+'">Zurücksetzen</button></span>').join(' · ')+'</div>':'')+
 (split.length?'<h4>Erreichte Bonuspunkte aus einzelnen Lücken</h4><p>Für diese Aufgaben musst du anhand der Classtime-Antworten prüfen, wie viele der als Bonus definierten Lücken dieses Kind richtig hat. Eine automatische Aufteilung aus der Gesamtpunktzahl wäre nicht verlässlich.</p>'+
 '<div class="v267-partial-inputs">'+split.map(it=>{
   const v=overrides[it.id]?.bonusEarned,raw=v200GetScore(priv,st.id,it);
   return '<label>'+esc(it.label)+' · '+esc(it.partialBonusV267.description||'Bonusteil')+
    ' (Original '+scoreText(raw)+' / '+scoreText(itemMax(it))+' P)'+
    '<input data-v267-part="'+esc(it.id)+'" type="number" min="0" step="0.25" max="'+it.partialBonusV267.max+'" value="'+(v===null||v===undefined?'':esc(v))+'" placeholder="Bonus-Punkte erzielt (0–'+it.partialBonusV267.max+')"></label>';
 }).join('')+'</div><button type="button" class="secondary" data-v267-save-parts>Bonuspunkte für dieses Kind speichern</button>':'')+
 '<p class="microcopy">Individuelle Ausnahmen und Bonuslücken-Punkte bleiben ausschließlich in der privaten lokalen Auswertung; sie gelangen nicht in den ChatGPT-Prompt.</p></details></section>';
}
const oldStep4=v200Step4;
v200Step4=function(a,priv){return individualEditor(a,priv)+oldStep4(a,priv);};
const oldStep5=v200Step5;
v200Step5=function(a,priv){
 let html=oldStep5(a,priv);
 if(!grade8(a))return html;
 const stu=student(),r=stu?v200StudentReport(priv,analysis(),stu):null;
 if(!r)return html;
 const labels=r.learningAreasV267||[];
 const summary='<section class="detail-section v267-preview"><h3>Lernbereiche mit Punkten (ohne Kompetenzstufen)</h3>'+
 (labels.length?'<div class="v267-areas">'+labels.map(x=>'<p><strong>'+esc(x.label)+'</strong>: '+scoreText(x.regularEarned)+' / '+scoreText(x.regularMax)+' regulär'+(x.bonusEarned?' · '+scoreText(x.bonusEarned)+' Bonus':'')+'</p>').join('')+'</div>':
 '<p class="muted">Optional kannst du in Schritt 3 zu einzelnen Aufgaben Lernbereiche hinterlegen. Für Klasse 8+ werden weiterhin keine E/TE/NNE-Statuswerte erzeugt.</p>')+
 (r.invalidV267?.length?'<p class="warnbox">Bei den Bonuslücken fehlen gültige Teilpunkte: '+esc(r.invalidV267.join(', '))+'</p>':'')+
 '</section>';
 return summary+html;
};
async function writePrivate(mutator){
 const priv=privacy();if(!priv)throw Error('Keine private Auswertung geladen.');
 const old=structuredClone(priv.gradingOverridesV267||{});
 priv.gradingOverridesV267=priv.gradingOverridesV267||{};
 try{mutator(priv.gradingOverridesV267);await v200PrivatePut(priv);render();}
 catch(e){priv.gradingOverridesV267=old;throw e;}
}
async function saveGlobal(){
 const a=current(),an=analysis();if(!a||!an)return;
 const id=document.querySelector('[data-v267-task]')?.value;
 const it=an.items.find(x=>x.id===id);
 if(!it||!possible(it))throw Error('Bitte eine reguläre Aufgabe auswählen.');
 const maxText=document.querySelector('[data-v267-max]')?.value.trim()||'';
 const desc=document.querySelector('[data-v267-description]')?.value.trim()||'';
 const area=document.querySelector('[data-v267-area]')?.value.trim()||'';
 if(desc.length>150||area.length>120)throw Error('Bezeichnung zu lang.');
 const next=maxText===''||Number(maxText)===0?null:Number(maxText);
 if(next!==null&&!calc.validateSplit(it,next))throw Error('Bonuspunkte müssen größer 0 und kleiner als die ursprüngliche Aufgabenpunktzahl sein (Schrittweite 0,25).');
 if(next!==null&&base.bonus(it))throw Error('Eine vollständig als Bonus gewertete Aufgabe kann nicht zusätzlich geteilt werden.');
 const old={partial:it.partialBonusV267,area:it.learningAreaV267};
 if(next!==null){it.partialBonusV267={max:next,description:desc};}
 else delete it.partialBonusV267;
 if(area)it.learningAreaV267=area;else delete it.learningAreaV267;
 try{await saveState();render();}
 catch(e){if(old.partial)it.partialBonusV267=old.partial;else delete it.partialBonusV267;
  if(old.area)it.learningAreaV267=old.area;else delete it.learningAreaV267;throw e;}
}
async function saveException(){
 const st=student(),id=document.querySelector('[data-v267-exception-item]')?.value,
 mode=document.querySelector('[data-v267-exception-mode]')?.value;
 const it=analysis()?.items?.find(x=>x.id===id);
 if(!st||!it||!['default','bonus','exclude'].includes(mode))throw Error('Bitte Aufgabe und Wertung auswählen.');
 if(mode==='bonus'&&base.bonus(it))throw Error('Die Aufgabe ist bereits für alle Bonus; keine individuelle Abweichung notwendig.');
 await writePrivate(store=>{
  const own=store[st.id]||{};const entry={...(own[id]||{})};
  if(mode==='default')delete entry.mode;else entry.mode=mode;
  if(!Object.keys(entry).length)delete own[id];else own[id]=entry;
  store[st.id]=own;
 });
}
async function clearException(id){
 const st=student();if(!st)return;
 await writePrivate(store=>{if(store[st.id]?.[id]){delete store[st.id][id].mode;
  if(!Object.keys(store[st.id][id]).length)delete store[st.id][id];}});
}
async function saveParts(){
 const st=student(),an=analysis();if(!st||!an)return;
 const entries=[...document.querySelectorAll('[data-v267-part]')];
 const changes=[];
 for(const el of entries){
  const it=an.items.find(x=>x.id===el.dataset.v267Part);
  if(!it||!it.partialBonusV267||!possible(it))continue;
  const raw=v200GetScore(privacy(),st.id,it);
  const text=el.value.trim(),val=text===''?null:Number(text.replace(',','.'));
  if(val!==null){
   if(!Number.isFinite(val)||val<0||val>it.partialBonusV267.max||
      !calc.numeric(raw)||val>Number(raw)||Number(raw)-val>itemMax(it)-Number(it.partialBonusV267.max))
     throw Error('Ungültige Bonusteilpunkte bei „'+it.label+'“. Original: '+scoreText(raw)+'. Bitte die Anzahl der richtigen Bonuslücken prüfen.');
  }
  changes.push({id:it.id,val});
 }
 await writePrivate(store=>{
   const own=store[st.id]||{};
   for(const ch of changes){
    const entry={...(own[ch.id]||{})};
    if(ch.val===null)delete entry.bonusEarned;else entry.bonusEarned=ch.val;
    if(!Object.keys(entry).length)delete own[ch.id];else own[ch.id]=entry;
   }
   store[st.id]=own;
 });
}
const oldWire=wire;
wire=function(){
 oldWire();
 const on=(selector,fn)=>document.querySelector(selector)?.addEventListener('click',()=>void fn().catch(e=>alert('Bewertungsanpassung: '+(e.message||e))));
 document.querySelector('[data-v267-task]')?.addEventListener('change',e=>{
  const it=analysis()?.items?.find(x=>x.id===e.target.value);
  const p=it?.partialBonusV267||{};
  document.querySelector('[data-v267-max]').value=p.max??'';
  document.querySelector('[data-v267-description]').value=p.description||'';
  document.querySelector('[data-v267-area]').value=it?.learningAreaV267||'';
 });
 document.querySelector('[data-v267-exception-item]')?.addEventListener('change',e=>{
   const mode=changes(privacy(),student()?.id)?.[e.target.value]?.mode||'default';
   document.querySelector('[data-v267-exception-mode]').value=mode;
 });
 on('[data-v267-save-global]',saveGlobal);
 on('[data-v267-save-exception]',saveException);
 on('[data-v267-save-parts]',saveParts);
 document.querySelectorAll('[data-v267-clear]').forEach(btn=>btn.addEventListener('click',()=>void clearException(btn.dataset.v267Clear).catch(e=>alert(e.message||e))));
};
})();
