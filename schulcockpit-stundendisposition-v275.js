/* V0.27.5 – integrated hourly disposition for sequences, Monday and lesson review.
   Lesson content and files move WITH the lesson; held history never moves. */
(function(){
'use strict';
const core=SC_HOURLY_V275;
let draft=null,busy=false;
const currentDay=()=>iso(new Date());
const ident=(q,u)=>q.id+'|'+u.id;
function parts(k){const i=k.indexOf('|');return [k.slice(0,i),k.slice(i+1)];}
function yearOf(l){return v190YearFromDate(l.date||currentDay());}
function isConcrete(l){return !!l&&(concretePlanReadyV12(l)||!!l.presentationReady||
 (l.phasePlan||[]).length>0||(l.slides||[]).length>0||(l.printPlan||[]).length>0||
 (l.materials||[]).length>0||l.source==='manual'||!!l.manualPinnedV272);}
function realCourse(l){return l?.classId&&l.kind!=='group'&&!l.groupId;}
function items(cid,year){
 const qs=v190PlanningSequences(cid,year);
 return qs.flatMap(q=>(q.plan||[]).filter(u=>!v201UnitSkipped(u)||u.parkedFromV275)
 .map(u=>({key:ident(q,u),q,u,title:u.title||'Ohne Titel',
  date:u.plannedDate||'',slot:Number(u.plannedSlotV272||0),
  held:false,parked:!!u.parkedFromV275,
  linked:(state.lessons||[]).some(l=>l.classId===cid&&l.planReference?.unitId===u.id&&isConcrete(l)&&!v182IsHeld(l))})));
}
function lessonByUnit(cid,key){
 const [,uid]=parts(key);
 return (state.lessons||[]).filter(l=>l.classId===cid&&l.planReference?.unitId===uid)
   .sort((a,b)=>(v182IsHeld(a)?-1:1)-(v182IsHeld(b)?-1:1))[0]||null;
}
function exactSlot(l,ss){return ss.find(s=>s.date===l.date&&
  (l.timetableId&&l.timetableId===s.timetableId||Number(lessonSlot(l))===s.slot));}
function context(){
 if(!draft)return null;
 const qs=v190PlanningSequences(draft.cid,draft.year),all=items(draft.cid,draft.year);
 const ss=v190CourseSlots(draft.cid,draft.year).filter(s=>s.date>=currentDay())
  .sort((a,b)=>a.date.localeCompare(b.date)||a.slot-b.slot);
 const covered=new Set(),blocked=[],anchors=[],warnings=[];
 for(const l of state.lessons||[]){
  if(l.classId!==draft.cid||!realCourse(l)||!l.date||l.date<currentDay())continue;
  const slot=exactSlot(l,ss);if(!slot)continue;
  const key=core.slotId(slot),source=all.find(x=>x.u.id===l.planReference?.unitId);
  if(v182IsHeld(l)||v182IsCanceled(l)){
    blocked.push(key);if(source)anchors.push(source.key);
  }else if(isConcrete(l)){
    // Only genuinely unlinked drafted lessons need a manual reconciliation.
    // Linked, prepared lessons move with their materials on insert/cascade.
    if(!source)blocked.push(key);
  }
  covered.add(key);
 }
 for(const x of all){
   if((state.lessons||[]).some(l=>l.classId===draft.cid&&
     l.planReference?.unitId===x.u.id&&v182IsHeld(l)))x.held=true;
 }
 return {qs,all,ss,blocked,anchors,warnings};
}
function open(opts){
 const l=opts.lessonId?(state.lessons||[]).find(x=>x.id===opts.lessonId):null;
 const cid=opts.cid||l?.classId,q=opts.qid?seq(opts.qid):null;
 const year=opts.year|| (l?yearOf(l):q?v190SeqYear(q):state.settings.schoolYear);
 if(!cid||!v190PlanningSequences(cid,year).length)return alert('Für diesen Fachkurs ist keine Reihenplanung vorhanden.');
 const all=items(cid,year);
 const preferred=opts.key||(l&&all.find(x=>x.u.id===l.planReference?.unitId)?.key)||
    all.find(x=>x.date&&x.date>=currentDay())?.key||all[0]?.key;
 if(!preferred)return alert('Für diesen Kurs gibt es noch keine Soll-Stunden.');
 const ss=v190CourseSlots(cid,year).filter(s=>s.date>=currentDay())
  .sort((a,b)=>a.date.localeCompare(b.date)||a.slot-b.slot);
 const fromLesson=l&&ss.find(s=>s.date===l.date&&Number(s.slot)===Number(lessonSlot(l)));
 const ownDate=all.find(x=>x.key===preferred)?.date;
 const destination=fromLesson||ss.find(s=>s.date===ownDate)||ss.find(s=>s.date===currentDay())||ss[0];
 draft={cid,year,sourceKey:preferred,lessonId:l?.id||'',action:l&&v182IsHeld(l)?'continue_partial':'insert',
   carry:'',inline:true,carryWhole:false,targetId:destination?core.slotId(destination):'',fingerprint:fingerprint()};
 modal={type:'hourlyDispositionV275'};render();
 // Other legacy render hooks may lazily normalize the active week.
 draft.fingerprint=fingerprint();
}
function fingerprint(){
 const cid=draft?.cid;
 return JSON.stringify([
   (state.sequences||[]).filter(q=>q.classId===cid),
   (state.lessons||[]).filter(l=>l.classId===cid),
   (state.timetable||[]).filter(t=>t.classId===cid),
   (state.assessments||[]).filter(a=>a.classId===cid),
   state.schoolCalendarsV190
 ]);
}
function actionInfo(){
 const ctx=context();if(!ctx)throw Error('Keine Auswahl.');
 const source=ctx.all.find(x=>x.key===draft.sourceKey);if(!source)throw Error('Quellstunde nicht mehr vorhanden.');
 const a=draft.action,continuing=a==='continue_partial'||a==='continue_whole';
 if(continuing&&!draft.lessonId)throw Error('Fortsetzen erfordert eine tatsächlich durchgeführte Unterrichtsstunde.');
 if(a==='continue_partial'&&!draft.carry.trim())throw Error('Bitte kurz angeben, was noch fehlt.');
 if(a==='continue_whole'&&source.held===false&&draft.lessonId){
   const l=state.lessons.find(x=>x.id===draft.lessonId);
   if(l&&!v182IsHeld(l)&&l.date>=currentDay())throw Error('Zum Fortsetzen muss die Ausgangsstunde stattgefunden haben.');
 }
 let engineAction=a;
 if(a==='continue_partial'&&draft.inline)engineAction='carry_inline';
 else if(a==='continue_partial'||a==='continue_whole')engineAction=draft.cascade?'continue':'replace';
 else if(a==='move')engineAction=draft.cascade?'insert':'replace';
 const result=core.plan({slots:ctx.ss,units:ctx.all,sourceKey:draft.sourceKey,
   targetId:draft.targetId,action:engineAction,today:currentDay(),
   blockedIds:ctx.blocked,anchorKeys:ctx.anchors,explicitlyMove:draft.action==='move'});
 return {...ctx,source,result,continuing};
}
function dispositionModal(){
 const ctx=context();if(!ctx)return '';
 const cid=draft.cid,c=cls(cid),source=ctx.all.find(x=>x.key===draft.sourceKey);
 let data=null,error='';
 try{data=actionInfo();}catch(e){error=e.message||String(e);}
 const continuing=draft.action.startsWith('continue');
 const withoutTarget=draft.action==='park';
 const targetOptions=ctx.ss.map(s=>'<option value="'+esc(core.slotId(s))+'" '+(draft.targetId===core.slotId(s)?'selected':'')+'>'+
   esc(fmtDate(s.date)+' · '+s.slot+'. Block')+'</option>').join('');
 const actions=[['insert','Einfügen – spätere Stunden und Reihen nach hinten verschieben'],
  ['move','Verschieben – nachfolgende Stunden automatisch nachrücken'],
  ['swap','Zwei Stunden tauschen (auch mit vorbereiteten Folgestunden)'],
  ['park','Aus aktuellem Zeitplan nehmen (nicht löschen)'],
  ['continue_partial','Nicht fertig – nur den Rest fortsetzen'],
  ['continue_whole','Nicht fertig – gesamte Stunde wiederholen']];
 const moved=data?.result?.moves||[],parked=data?.result?.parked||[];
 const label=k=>ctx.all.find(x=>x.key===k)?.title||source?.title||k;
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-xwide v275-modal" data-modal-stop>'+
 '<header class="modal-header"><div><span class="eyebrow">UNTERRICHTSPLANUNG · '+esc(c?.subject||'')+' '+esc(c?.name||'')+'</span>'+
 '<h2>Einzelne Stunde organisieren</h2></div><button class="icon-button" data-action="modal-close">×</button></header>'+
 '<div class="modal-body"><p>Hier kannst du Stunden aus dem Zeitplan nehmen, tauschen, verschieben oder nach einer unvollständigen Unterrichtsstunde fortsetzen. Änderungen an <strong>allen betroffenen Reihen</strong> siehst du vor dem Speichern.</p>'+
 '<div class="v275-grid"><label>Unterrichtsstunde<select data-v275-source>'+ctx.all.map(x=>
 '<option value="'+esc(x.key)+'" '+(draft.sourceKey===x.key?'selected':'')+'>'+esc((x.date?fmtDate(x.date):'Ohne Termin')+' · '+x.q.title+' / '+x.title)+'</option>').join('')+
 '</select></label><label>Was soll passieren?<select data-v275-action>'+actions.map(([k,t])=>
 '<option value="'+k+'" '+(draft.action===k?'selected':'')+'>'+esc(t)+'</option>').join('')+
 '</select></label></div>'+
 (!withoutTarget?'<div class="v275-grid"><label>Neuer Fachtermin<select data-v275-target>'+targetOptions+'</select></label>'+
 '<label class="v275-check"><input type="checkbox" data-v275-cascade '+(draft.cascade?'checked':'')+' '+(!['move','continue_partial','continue_whole'].includes(draft.action)||draft.inline&&draft.action==='continue_partial'?'disabled':'')+'>'+
 'Auch offene Folgestunden und spätere Reihen nach hinten verschieben</label></div>':'')+
 (draft.action==='continue_partial'?'<label class="v275-check"><input type="checkbox" data-v275-inline '+(draft.inline?'checked':'')+'>'+
  'Rest nur als Einstieg/Besprechung in die nächste Stunde aufnehmen (das nächste Thema bleibt bestehen)</label>':'')+
 (continuing?'<label>Was fehlt noch?'+(draft.action==='continue_partial'?' (für die Fortsetzung erforderlich)':' (optional)')+
 '<textarea rows="3" maxlength="1800" data-v275-carry placeholder="z. B. Ergebnisse der Vertretungsaufgaben besprechen (ca. 15 Minuten), dann mit dem nächsten Thema beginnen">'+esc(draft.carry)+'</textarea></label>':'')+
 (continuing?'<p class="v275-note">Die durchgeführte Stunde bleibt mit ihren Materialien und ihrem Ist-Stand erhalten. Die Fortsetzung wird als eigene, verknüpfte Soll-Stunde eingeplant.</p>':'')+
 (error?'<p role="alert" class="warnbox">'+esc(error)+'</p>':
 '<section class="v275-preview"><h3>Vorschau</h3>'+
 (data?.result?.inline?'<p class="v275-note"><strong>Kurze Fortsetzung:</strong> Der Rest wird in der ausgewählten Fachstunde als Einstieg vermerkt. Das dort bereits geplante Thema und alle Folgetermine bleiben unverändert.</p>':'')+
 (moved.length?'<table><thead><tr><th>Unterrichtsstunde</th><th>Vorher</th><th>Nachher</th></tr></thead><tbody>'+
 moved.map(m=>'<tr><td>'+esc(m.repeatOf?'Fortsetzung: '+label(m.repeatOf):label(m.key))+'</td><td>'+esc(m.from?fmtDate(m.from):'neu')+'</td><td>'+esc(m.to?fmtDate(m.to):'ohne Termin')+'</td></tr>').join('')+'</tbody></table>':'<p>Keine Termindaten zu verschieben.</p>')+
 (parked.length?'<p class="v275-note"><strong>Bleiben erhalten, aber ohne Termin:</strong> '+parked.map(p=>esc(label(p.key))).join(' · ')+'</p>':'')+
 (data?.result?.warnings?.length?'<p class="warnbox">'+data.result.warnings.slice(0,4).map(esc).join(' · ')+'</p>':'')+
 '</section>')+
 '<div class="v275-actions"><button type="button" class="secondary" data-action="modal-close">Abbrechen</button>'+
 '<button type="button" class="primary" data-v275-apply '+(error||(!moved.length&&!parked.length&&!data?.result?.inline)?'disabled':'')+
 '>Änderung übernehmen</button></div><p class="microcopy">Gehaltene Unterrichtsstunden und feste Klassenarbeitstermine werden nie überschrieben. Vorbereitete zukünftige Stunden rücken beim Einfügen und Verschieben samt Materialien mit. Gehaltene Ist-Stunden und Klassenarbeitstermine bleiben unverändert.</p>'+
 '</div></section></div>';
}
function restoreBackup(backup){
 state.sequences=backup.sequences;state.lessons=backup.lessons;
 state.settings.activeWeekStart=backup.week;
}
function attach(l,x,s){
 const {q,u}=x;
 l.date=s.date;l.slot=s.slot;l.period=s.period||l.period;l.timetableId=s.timetableId||l.timetableId;
 l.sequenceId=q.id;l.unit=q.title;
 if(!isConcrete(l)||!l.title||l.title==='Thema noch festlegen')l.title=u.title||'Thema noch festlegen';
 if(!isConcrete(l)||!l.objective)l.objective=u.objective||l.objective||'';
 l.planReference={...(l.planReference||{}),unitId:u.id,title:u.title,plannedDate:s.date,
   content:u.content,objective:u.objective,material:u.material,notes:u.notes,autoMatched:false};
 l.manualPinnedV272={unitId:u.id,chosenAt:new Date().toISOString()};
 delete l.scheduleParkedV275;
 if(l.status!=='done')l.status='open';
}
function makeLesson(x,s){
 return {id:uid('lesson'),classId:draft.cid,kind:'course',source:'timetable',
 date:s.date,slot:s.slot,period:s.period||'',timetableId:s.timetableId,
 status:'open',objective:'',plannedSteps:[],completedSteps:[],phasePlan:[],
 slides:[],prepTasks:[],materials:[],printPlan:[],...{}};
}
async function apply(){
 if(!draft||busy)return;busy=true;
 const button=document.querySelector('[data-v275-apply]');if(button)button.disabled=true;
 const backup={sequences:structuredClone(state.sequences),lessons:structuredClone(state.lessons),week:state.settings.activeWeekStart};
 let saved=false,targetLesson=null;
 try{
  if(fingerprint()!==draft.fingerprint)throw Error('Die Planung hat sich inzwischen geändert. Bitte den Dialog neu öffnen.');
  const ctx=actionInfo(),moves=ctx.result.moves,parked=ctx.result.parked;
  if(!moves.length&&!parked.length&&!ctx.result.inline)return;
  const pending=new Map(),changing=new Set([...moves.map(m=>m.key),...parked.map(p=>p.key)]);
  if(ctx.result.inline){
   const next=ctx.result.inline,slot=ctx.ss.find(s=>core.slotId(s)===next.targetId);
   if(!slot)throw Error('Der ausgewählte Fachtermin ist nicht mehr vorhanden.');
   const expectedUnit=next.topicKey?parts(next.topicKey)[1]:'';
   // In older installations a blank timetable card can coexist with the
   // already linked planned lesson. Prefer the actual next topic, not the
   // first empty card with the same weekday/slot.
   let l=(state.lessons||[]).filter(x=>x.classId===draft.cid&&
     x.date===slot.date&&Number(lessonSlot(x))===Number(slot.slot))
     .sort((a,b)=>Number(b.planReference?.unitId===expectedUnit)-
       Number(a.planReference?.unitId===expectedUnit))[0];
   if(l&&v182IsHeld(l))throw Error('Die Zielstunde wurde inzwischen gehalten.');
   if(!l){
     l=makeLesson(ctx.source,slot);state.lessons.push(l);
     const u=ctx.all.find(x=>x.date===slot.date&&(!x.slot||x.slot===slot.slot));
     if(u)attach(l,u,slot);
   }
   l.carryoverV275={sourceLessonId:draft.lessonId,sourceUnitId:ctx.source.u.id,
     sourceTitle:ctx.source.title,mode:'partial',note:draft.carry.trim(),
     updatedAt:new Date().toISOString()};
   const original=(state.lessons||[]).find(x=>x.id===draft.lessonId);
   if(original){
     original.continuationStatusV275={mode:'continue_partial',note:draft.carry.trim(),
       targetLessonId:l.id,inline:true,updatedAt:new Date().toISOString()};
     if(!v182IsHeld(original)&&!v182IsCanceled(original))original.status='done';
   }
   state.settings.activeWeekStart=iso(mondayOf(new Date(slot.date+'T12:00:00')));
   await saveState();saved=true;
   targetLesson=l;draft=null;modal=null;view='prep';render();openWizardV14(l.id,1);return;
  }
  const sourceLesson=draft.lessonId?(state.lessons||[]).find(l=>l.id===draft.lessonId):null;
  for(const m of moves)if(m.repeatOf){
   const [qid,unitId]=parts(m.repeatOf),q=seq(qid),parent=q?.plan?.find(u=>u.id===unitId);
   if(!parent)throw Error('Die Originalstunde wurde nicht gefunden.');
   const copy=structuredClone(parent);
   copy.id=uid('unit-continue');copy.plannedDate='';delete copy.plannedSlotV272;
   delete copy.parkedFromV275;delete copy.skippedThisYearV201;
   copy.continuationOfV275=parent.id;
   copy.continuationKindV275=draft.action.startsWith('continue')?draft.action:'repeat';
   copy.continuationNoteV275=draft.carry.trim();
   if(draft.action==='continue_partial'){
    copy.title='Fortsetzung: '+parent.title;
    copy.content='Noch offen / nachzuholen: '+draft.carry.trim()+'\n\nHerkunft: '+(parent.content||'');
   }else if(draft.carry.trim())copy.notes=(copy.notes||'')+'\nFortsetzung: '+draft.carry.trim();
   const index=q.plan.findIndex(u=>u.id===parent.id);
   q.plan.splice(index+1,0,copy);
   pending.set(m.key,{q,u:copy});
  }
  const all=ctx.all.map(x=>({key:x.key,q:x.q,u:x.u}));
  for(const [k,x] of pending)all.push({key:k,...x});
  const byKey=new Map(all.map(x=>[x.key,x]));
  const affected=[...changing].map(k=>byKey.get(k)).filter(Boolean);
  const lessonForKey=new Map();
  for(const x of affected){
   const l=(state.lessons||[]).filter(l=>l.classId===draft.cid&&
     l.planReference?.unitId===x.u.id&&!v182IsHeld(l)&&(l.date>=currentDay()||!l.date))
     .sort((a,b)=>Number(isConcrete(b))-Number(isConcrete(a)))[0];
   if(l)lessonForKey.set(x.key,l);
  }
  // Park all moving lesson objects first (two-phase): ensures swapping two
  // prepared lessons does not accidentally overwrite either content.
  for(const l of lessonForKey.values()){
   l.scheduleParkedV275={previousDate:l.date,previousSlot:lessonSlot(l)};
   l.date='';
  }
  for(const p of parked){
   const x=byKey.get(p.key);if(!x)throw Error('Das vorherige Zielthema fehlt.');
   x.u.parkedFromV275={date:x.u.plannedDate,slot:x.u.plannedSlotV272||0,at:new Date().toISOString()};
   x.u.plannedDate='';delete x.u.plannedSlotV272;
   x.u.skippedThisYearV201=true;
  }
  const usedSlots=new Set();
  for(const m of moves){
   const x=byKey.get(m.key);if(!x)throw Error('Verschobenes Thema fehlt.');
   if(!m.to){
    x.u.parkedFromV275={date:x.u.plannedDate,slot:x.u.plannedSlotV272||0,at:new Date().toISOString()};
    x.u.plannedDate='';delete x.u.plannedSlotV272;x.u.skippedThisYearV201=true;
    continue;
   }
   const dest=ctx.ss.find(s=>s.date===m.to&&Number(s.slot)===Number(m.toSlot)&&
    String(s.timetableId||'')===String(m.timetableId||''));
   if(!dest)throw Error('Ein neu geplanter Fachtermin ist nicht mehr frei.');
   const sid=core.slotId(dest);
   if(usedSlots.has(sid))throw Error('Zwei Stunden würden denselben Fachtermin belegen.');
   usedSlots.add(sid);
   x.u.plannedDate=m.to;x.u.plannedSlotV272=m.toSlot;
   delete x.u.parkedFromV275;delete x.u.skippedThisYearV201;
   let l=lessonForKey.get(m.key);
   if(!l){
    // An empty, automatically generated timetable card is reusable, but never
    // overwrite an already prepared or completed lesson.
    l=(state.lessons||[]).find(candidate=>candidate.classId===draft.cid&&
      candidate.date===dest.date&&Number(lessonSlot(candidate))===dest.slot&&
      !v182IsHeld(candidate)&&!isConcrete(candidate)&&!candidate.planReference?.unitId);
    if(!l)l=makeLesson(x,dest),state.lessons.push(l);
   }
   attach(l,x,dest);
   if(!targetLesson)targetLesson=l;
  }
  // A teacher may create an extra unit with the desired Friday date already
  // filled in. The cascade then moves ONLY the displaced units, not the new
  // unit itself. Link that source to Friday so the Monday/print views show it.
  if(draft.action==='insert'&&!moves.some(m=>m.key===draft.sourceKey||m.repeatOf===draft.sourceKey)){
   const dest=ctx.ss.find(s=>core.slotId(s)===draft.targetId),x=byKey.get(draft.sourceKey);
   if(dest&&x?.u?.plannedDate===dest.date){
    let l=(state.lessons||[]).find(row=>row.classId===draft.cid&&row.date===dest.date&&
     Number(lessonSlot(row))===Number(dest.slot)&&row.planReference?.unitId===x.u.id);
    if(!l){
     l=(state.lessons||[]).find(row=>row.classId===draft.cid&&row.date===dest.date&&
      Number(lessonSlot(row))===Number(dest.slot)&&!v182IsHeld(row)&&!isConcrete(row)&&!row.planReference?.unitId);
     if(!l){l=makeLesson(x,dest);state.lessons.push(l);}
     delete l.v180MovedFrom;
     attach(l,x,dest);
    }
    targetLesson=l;
   }
  }
  if(ctx.continuing&&sourceLesson){
   sourceLesson.continuationStatusV275={mode:draft.action,note:draft.carry.trim(),
     nextUnitId:pending.values().next().value?.u?.id||'',updatedAt:new Date().toISOString()};
   if(!v182IsHeld(sourceLesson)&&!v182IsCanceled(sourceLesson))sourceLesson.status='done';
  }
  // A prepared source with a date in the past was never mutated. Keep its
  // historic cards for audit, yet do not display obsolete auto-matched future
  // duplicates once their unit has moved.
  const planUnits=new Map(all.map(x=>[x.u.id,x.u]));
  const affectedIds=new Set(affected.map(x=>x.u.id));
  for(const l of state.lessons||[]){
   if(l.classId!==draft.cid||!l.date||l.date<currentDay()||usedSlots.has(core.slotId({
    date:l.date,slot:lessonSlot(l),timetableId:l.timetableId||''})))continue;
   if(!l.planReference?.autoMatched||!affectedIds.has(l.planReference?.unitId)||isConcrete(l)||v182IsHeld(l))continue;
   l.scheduleParkedV275={previousDate:l.date,previousSlot:lessonSlot(l)};
   l.date='';
  }
  // Only rebuild date ranges of affected sequences. No other course changes.
  for(const qid of new Set(affected.map(x=>x.q.id))){
   const q=seq(qid);if(!q)continue;
   const d=(q.plan||[]).filter(u=>!v201UnitSkipped(u)&&u.plannedDate)
     .map(u=>u.plannedDate).sort();
   if(d.length){q.startDate=d[0];q.endDate=d[d.length-1];}
  }
  if(targetLesson)state.settings.activeWeekStart=iso(mondayOf(new Date(targetLesson.date+'T12:00:00')));
  await saveState();saved=true;
  draft=null;modal=null;view='prep';render();
  if(targetLesson)openWizardV14(targetLesson.id,1);
 }catch(e){
  if(!saved){restoreBackup(backup);render();}
  alert('Stundendisposition nicht übernommen: '+(e.message||e));
 }finally{busy=false;if(button)button.disabled=false;}
}
const oldSequencePanel=sequencePanel;
sequencePanel=function(q){
 const html=oldSequencePanel(q);
 return html.replace(/data-v272-unit="([^"]+)"/g,'data-v275-unit="$1"')
   .replace(/Termin wählen \/ verschieben →/g,'Stunde organisieren →');
};
const oldCard=coursePrepRowV14;
coursePrepRowV14=function(l){
 const html=oldCard(l);
 if(!realCourse(l))return html;
 // Suppress the older targeted-switch action; the new one handles all cases.
 return html.replace(/<div class="v272-switch-button">[\s\S]*?<\/div>/g,'')
 .replace('</article>','<div class="v275-card-action"><button type="button" class="secondary" data-v275-lesson="'+esc(l.id)+'">Stunde verschieben / fortsetzen</button></div></article>');
};
const oldDay=v182LessonDayHtml;
v182LessonDayHtml=function(l){
 const html=oldDay(l);if(!realCourse(l))return html;
 return html.replace(/<button type="button" class="secondary" data-v272-target="[^"]+">Stundenthema wechseln<\/button>/g,'')
   .replace('<section class="v182-day-top">','<section class="v182-day-top"><button type="button" class="secondary" data-v275-lesson="'+esc(l.id)+'">Stunde tauschen / fortsetzen</button>');
};
const oldModal=modalHtml;
modalHtml=function(){return modal?.type==='hourlyDispositionV275'?dispositionModal():oldModal();};
const oldWire=wire;
wire=function(){
 oldWire();
 document.querySelectorAll('[data-v275-unit]').forEach(b=>b.addEventListener('click',()=>open({qid:parts(b.dataset.v275Unit)[0],
   cid:seq(parts(b.dataset.v275Unit)[0])?.classId,key:b.dataset.v275Unit})));
 document.querySelectorAll('[data-v275-lesson]').forEach(b=>b.addEventListener('click',()=>open({lessonId:b.dataset.v275Lesson})));
 if(modal?.type!=='hourlyDispositionV275')return;
 for(const [attr,field] of [['source','sourceKey'],['target','targetId'],['action','action']]){
  document.querySelector('[data-v275-'+attr+']')?.addEventListener('change',e=>{
   draft[field]=e.target.value;
   if(field==='sourceKey'){draft.lessonId='';if(draft.action.startsWith('continue'))draft.action='insert';}
   if(field==='action')draft.cascade=e.target.value==='move';
   render();draft.fingerprint=fingerprint();
  });
 }
 document.querySelector('[data-v275-cascade]')?.addEventListener('change',e=>{draft.cascade=e.target.checked;render();draft.fingerprint=fingerprint();});
 document.querySelector('[data-v275-inline]')?.addEventListener('change',e=>{draft.inline=e.target.checked;render();draft.fingerprint=fingerprint();});
 document.querySelector('[data-v275-carry]')?.addEventListener('input',e=>{draft.carry=e.target.value;});
 document.querySelector('[data-v275-carry]')?.addEventListener('change',e=>{draft.carry=e.target.value;render();draft.fingerprint=fingerprint();});
 document.querySelector('[data-v275-apply]')?.addEventListener('click',()=>void apply());
};
const previousPlanningPrompt=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){
 let out=previousPlanningPrompt(l);
 if(!l?.carryoverV275)return out;
 const c=l.carryoverV275;
 return out+'\n\n## Kurze Fortsetzung aus der vorherigen Stunde (verbindlich)\n'+
 'Zu Beginn dieser Stunde kurz nachbesprechen: '+c.note+'\n'+
 'Das regulär für diesen Termin eingeplante Thema bleibt Teil derselben Stunde. '+ 
 'Plane dafür nur einen angemessenen kurzen Einstieg ein, nicht automatisch eine ganze Doppelstunde. '+ 
 'Berücksichtige diesen Übergang bei Zeitplanung, Sicherung und PowerPoint.\n';
};
window.SchulcockpitDispositionV275={open,actionInfo};
})();
