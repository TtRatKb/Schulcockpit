/* Schulcockpit V0.33.4 – one canonical task editor, no private-data mutation.
 * Historical 6 regular + 3 bonus drafts are only suggested, never silently applied.
 */
(function(root){
'use strict';
const TYPES=['classtime','paper','classtime_bonus','paper_bonus'];
const number=v=>{
 if(v===null||v===undefined||String(v).trim()==='')return NaN;
 const raw=String(v).trim().replace(',','.');
 if(!/^\d+(?:\.\d+)?$/.test(raw))return NaN;
 return Number(raw);
};
const mode=item=>String(item.source||'').endsWith('_bonus')?'bonus':
 item.bonusInsteadV260?'bonus':
 number(item.partialBonusV267?.max)>0?'partial':'regular';
const family=source=>String(source||'').startsWith('paper')?'paper':'classtime';
const rawMax=item=>Number(String(item.source||'').endsWith('_bonus')?item.bonusMax:item.regularMax)||0;
function row(item,oldDraft=null){
 const old=oldDraft||{},isBonus=String(item.source||'').endsWith('_bonus');
 let maximum=rawMax(item),selected=mode(item),bonus=selected==='partial'?number(item.partialBonusV267.max):0;
 let proposed=false;
 const dr=number(old.regularRaw),db=number(old.bonusRaw);
 const draftSource=String(old.source||item.source);
 if(oldDraft){
   proposed=true;
   if(String(draftSource).endsWith('_bonus')){
     maximum=Number.isFinite(db)&&db>0?db:maximum;
     selected='bonus';bonus=maximum;
   }else if(Number.isFinite(dr)&&Number.isFinite(db)&&dr>0&&db>0){
     // Invalid V216 split draft: user meant 6 regular + 3 bonus = 9 original.
     maximum=dr+db;selected='partial';bonus=db;
   }else if(Number.isFinite(dr)&&dr>0){
     maximum=dr;
     if(selected==='bonus')bonus=maximum;
   }
 }else if(!isBonus&&Number(item.bonusMax)>0&&maximum>0){
   // Legacy mixed-schema data, also never silently migrated.
   bonus=Number(item.bonusMax);maximum+=bonus;selected='partial';proposed=true;
 }
 if(selected==='bonus')bonus=maximum;
 const result={id:item.id,label:item.label||item.id,source:family(draftSource),
  original:maximum,mode:selected,bonus:selected==='partial'?bonus:selected==='bonus'?maximum:0,
  description:item.partialBonusV267?.description||'',learningArea:item.learningAreaV267||'',competencyId:old.competencyId||item.competencyId,
  legacySuggested:proposed,previousSource:item.source};
 return result;
}
function effective(row){
 const total=number(row.original),part=row.mode==='bonus'?total:row.mode==='partial'?number(row.bonus):0;
 return {
  regular:Number.isFinite(total)&&Number.isFinite(part)?Math.max(0,total-part):NaN,
  bonus:part,total
 };
}
function verify(items,changes,priv,columns=[]){
 if(!Array.isArray(items)||!items.length)throw Error('Keine Aufgaben vorhanden.');
 if(!Array.isArray(changes)||changes.length!==items.length)throw Error('Nicht alle Aufgaben wurden erfasst.');
 const byId=new Map(changes.map(c=>[c.id,c]));
 const next=structuredClone(items),warnings=[],changed=[];
 let regularTotal=0,bonusTotal=0;
 for(const item of next){
  const c=byId.get(item.id);
  if(!c)throw Error('Aufgabe '+(item.label||item.id)+' fehlt.');
  const label=item.label||item.id;
  if(!['paper','classtime'].includes(c.source))throw Error(label+': Quelle fehlt.');
  if(!['regular','bonus','partial'].includes(c.mode))throw Error(label+': Wertung fehlt.');
  const original=number(c.original);
  if(!Number.isFinite(original)||original<=0||original>10000)
   throw Error(label+': Bitte die ursprüngliche Gesamtpunktzahl größer 0 eintragen.');
  const part=c.mode==='bonus'?original:c.mode==='partial'?number(c.bonus):0;
  if(c.mode==='partial'&&(!Number.isFinite(part)||part<=0||part>=original||!Number.isInteger(part*4)))
   throw Error(label+': Die Bonuspunkte müssen größer 0 und kleiner als die Gesamtpunktzahl sein (Viertelpunkte möglich).');
  const description=String(c.description||'').trim();
  if(description.length>150)throw Error(label+': Die Lückenbezeichnung ist zu lang.');
  const area=String(c.learningArea??item.learningAreaV267??'').trim();
  if(area.length>120)throw Error(label+': Der Lernbereich ist zu lang.');
  if(typeof c.taskText==='string'){
   const taskText=cleanTaskText(c.taskText);
   if(taskText)item.taskText=taskText;else delete item.taskText;
  }
  if(c.competencyId) item.competencyId=c.competencyId;
  if(area)item.learningAreaV267=area;else delete item.learningAreaV267;
  const source=c.mode==='bonus'&&String(item.source||'').endsWith('_bonus')?
    c.source+'_bonus':c.source;
  const saved=Object.keys(priv?.scores||{}).map(id=>priv.scores[id]?.[item.id])
    .concat(Object.keys(priv?.paperScores||{}).map(id=>priv.paperScores[id]?.[item.id]))
    .concat(Object.keys(priv?.bonusScores||{}).map(id=>priv.bonusScores[id]?.[item.id]))
    .filter(v=>v!==null&&v!==undefined&&v!=='');
  if(source!==item.source&&saved.length)
   throw Error(label+': Classtime-/Papierquelle kann wegen vorhandener Ergebnisse nicht geändert werden.');
  if(saved.some(v=>!Number.isFinite(number(v))||number(v)>original+1e-9))
   throw Error(label+': Ein vorhandenes Ergebnis ist größer als das neue Maximum von '+original+' Punkten. Bitte zuerst die konkrete Bewertung prüfen.');
  if(source.startsWith('classtime')){
   const linked=columns.find(col=>String(col.id)===String(item.id));
   if(linked&&Number.isFinite(Number(linked.max))&&Math.abs(Number(linked.max)-original)>1e-8){
    warnings.push(label+': Classtime-Excel enthält '+linked.max+' mögliche Punkte, deine neue Wertung '+original+
      '. Die Excel-Zuordnung muss vor einer erneuten Übernahme fachlich geklärt werden.');
    if(saved.length)throw Error(label+': Classtime liefert '+linked.max+
      ' Maximalpunkte, aber du möchtest '+original+' vergeben. Die vorhandenen Rohpunkte dürfen nicht still umgerechnet werden.');
   }
  }
  item.source=source;
  item.regularMax=source.endsWith('_bonus')?0:original;
  item.bonusMax=source.endsWith('_bonus')?original:0;
  delete item.bonusInsteadV260;
  delete item.partialBonusV267;
  if(c.mode==='bonus'&&!source.endsWith('_bonus'))item.bonusInsteadV260=true;
  if(c.mode==='partial')item.partialBonusV267={max:part,description};
  regularTotal+=c.mode==='bonus'?0:original-part;
  bonusTotal+=part;
  if(JSON.stringify(item)!==JSON.stringify(items.find(x=>x.id===item.id)))changed.push(label);
 }
 if(regularTotal<=0)throw Error('Die Arbeit braucht mindestens eine regulär bewertete Aufgabe.');
 return {items:next,regular:regularTotal,bonus:bonusTotal,changed,warnings};
}
// Original question text is metadata, not a scoring rule or a bonus description.
function cleanTaskText(value){return typeof value==='string'?value.trim():'';}
function taskRef(value){
 const m=String(value||'').match(/(?:^|[\s–—:])(?:Aufgabe|Frage)\s*(\d+)\s*([a-z])?(?=\s|[.:,;·–—)-]|$)/i);
 return m?String(Number(m[1]))+(m[2]||'').toLowerCase():'';
}
function taskCandidates(item,columns,match){
 const labels=[item.id,item.label,...(item.classtimeAliases||[])];
 const direct=new Set(labels.map(x=>String(x||'').trim().toUpperCase()).filter(x=>/^Q\d+$/.test(x)));
 if(direct.size)return columns.filter(c=>direct.has(String(c.label).toUpperCase()));
 const byExisting=typeof match==='function'?match(item,columns):[];
 if(byExisting.length)return byExisting;
 const codes=new Set(labels.map(taskRef).filter(Boolean));
 return columns.filter(c=>codes.has(taskRef(c.description)));
}
function resolveTaskText(item,items,columns,mapping={},match){
 const stored=cleanTaskText(item.taskText);
 if(stored)return {text:stored,source:'saved'};
 if(!String(item.source||'').startsWith('classtime'))return {text:'',source:'missing'};
 const candidates=taskCandidates(item,columns,match);
 if(candidates.length!==1)return {text:'',source:candidates.length?'ambiguous':'missing'};
 const col=candidates[0],mapped=mapping[item.id];
 const linked=v=>v!==null&&v!==undefined&&v!=='';
 if(linked(mapped)&&String(mapped)!==String(col.index))return {text:'',source:'ambiguous'};
 const conflict=items.some(other=>other.id!==item.id&&String(other.source||'').startsWith('classtime')&&
   (linked(mapping[other.id])?String(mapping[other.id])===String(col.index):
    taskCandidates(other,columns,match).some(c=>String(c.index)===String(col.index))));
 if(conflict)return {text:'',source:'ambiguous'};
 const value=cleanTaskText(col.taskText);
 return {text:value,source:value?'classtime':'missing'};
}
function preserveTaskTexts(oldItems,newItems){
 for(const item of newItems||[]){
  if(cleanTaskText(item.taskText))continue;
  const old=(oldItems||[]).find(x=>x.id===item.id&&x.label===item.label&&x.source===item.source&&
    JSON.stringify(x.classtimeAliases||[])===JSON.stringify(item.classtimeAliases||[]));
  if(cleanTaskText(old?.taskText))item.taskText=old.taskText;
 }
 return newItems;
}
const TASK_TEXT_SCHEMA='schulcockpit.task-texts.v1';
function taskTextIdentity(item){return {id:String(item.id),label:String(item.label||item.id),source:String(item.source||'')};}
function taskTextPrompt(examId,items){
 const tasks=items.map(taskTextIdentity);
 return 'Ergänze ausschließlich die Original-Aufgabenstellungen meiner bereits ausgewerteten Klassenarbeit. Nutze die unbeschriebene Originalarbeit bzw. die Original-Aufgaben aus diesem Chat; keine Schülerdaten. Keine neue Klausuranalyse, keine Änderungen an Punkten oder Kompetenzen. Ordne jede Teilaufgabe exakt anhand ID und Bezeichnung zu. Übernimm den vollständigen Originalwortlaut inkl. relevanter Vorgaben und Antwortoptionen, soweit belegt. Keine Lösungen, Schülerantworten, Namen oder erfundenen Texte. Bei Unklarheit die betreffende Aufgabe auslassen oder taskText leer lassen. IDs, label, source und examId exakt beibehalten. Antworte nur mit dem folgenden Block; fülle taskText für jede belegbare Aufgabe aus:\n\n<SCHULCOCKPIT_TASK_TEXTS>\n'+JSON.stringify({schema:TASK_TEXT_SCHEMA,examId:String(examId),items:tasks.map(t=>({...t,taskText:''}))},null,2)+'\n</SCHULCOCKPIT_TASK_TEXTS>';
}
function parseTaskTexts(raw,examId,items){
 const matches=[...String(raw||'').matchAll(/<SCHULCOCKPIT_TASK_TEXTS>\s*([\s\S]*?)\s*<\/SCHULCOCKPIT_TASK_TEXTS>/g)];
 if(matches.length!==1)throw Error('Bitte genau einen SCHULCOCKPIT_TASK_TEXTS-Block einfügen.');
 let obj;try{obj=JSON.parse(matches[0][1]);}catch{throw Error('Der Aufgabenstellungs-Block enthält ungültiges JSON.');}
 if(obj?.schema!==TASK_TEXT_SCHEMA||obj.examId!==String(examId)||!Array.isArray(obj.items))throw Error('Der Block gehört nicht zu dieser Klassenarbeit oder hat ein unbekanntes Format.');
 if(Object.keys(obj).some(k=>!['schema','examId','items'].includes(k)))throw Error('Nur Aufgabenstellungen importieren, keine weiteren Daten.');
 const known=new Map(items.map(it=>[String(it.id),taskTextIdentity(it)])),seen=new Set(),updates=[];
 if(known.size!==items.length)throw Error('Die bestehenden Aufgaben-IDs sind nicht eindeutig.');
 for(const row of obj.items){
  if(!row||typeof row.id!=='string'||seen.has(row.id)||!known.has(row.id))throw Error('Unbekannte oder doppelte Aufgaben-ID.');
  const target=known.get(row.id);seen.add(row.id);
  if(row.label!==target.label||row.source!==target.source)throw Error('Aufgabe '+target.label+': Bezeichnung oder Quelle stimmt nicht überein.');
  if(Object.keys(row).some(k=>!['id','label','source','taskText'].includes(k))||typeof row.taskText!=='string')throw Error('Aufgabe '+target.label+': Nur den originalen Aufgabentext übernehmen.');
  const taskText=cleanTaskText(row.taskText);
  if(taskText)updates.push({...target,taskText});
 }
 if(!updates.length)throw Error('Keine belegten Aufgabenstellungen enthalten.');
 return updates;
}
function patchTaskTexts(items,draft,updates){
 const byId=new Map(updates.map(x=>[x.id,x.taskText]));
 const nextItems=items.map(it=>byId.has(String(it.id))?{...it,taskText:byId.get(String(it.id))}:it);
 // Do not create a scoring draft or alter existing scoring edits.
 let nextDraft=draft;
 if(draft?.items){
  const draftItems={...draft.items};
  for(const [id,taskText] of byId)if(Object.prototype.hasOwnProperty.call(draftItems,id))draftItems[id]={...draftItems[id],taskText};
  nextDraft={...draft,items:draftItems};
 }
 return {items:nextItems,draft:nextDraft};
}
const api={row,effective,verify,number,mode,family,rawMax,cleanTaskText,resolveTaskText,preserveTaskTexts,taskTextPrompt,parseTaskTexts,patchTaskTexts};
root.SchulcockpitAssessmentEditorV334=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);