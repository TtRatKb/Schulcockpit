/* Schulcockpit V0.27.8 – movable future lesson drafts, including print/PPT data.
   A fixed exam is excluded by v190CourseSlots. Past held/actual lessons are
   historical records, not protected future "planning anchors". */
(function(){
'use strict';
SC_HOURLY_V275.plan=SC_HOURLY_V278.plan;
function isHistory(l){return !!l&&(v182IsHeld(l)||v182IsCanceled(l));}
v191LessonProtected=isHistory;
function prepared(l){
 return !!l&&!!((l.phasePlan||[]).length||(l.slides||[]).length||(l.printPlan||[]).length||
  (l.materials||[]).length||l.presentationReady||l.aiImportAt||l.source==='manual'||
  l.manualPinnedV272||l.actualV270?.savedAt);
}
function blank(l){
 return !isHistory(l)&&!prepared(l)&&!l.planReference?.unitId&&
  (!l.title||l.title==='Thema noch festlegen'); // Empty legacy shift markers are reusable too.
}
function key(s){return s.date+'|'+Number(s.slot)+'|'+String(s.timetableId||'');}
function weekNow(){return iso(new Date());}
function createForUnit(cid,slot,q,u){
 return {id:uid('lesson'),classId:cid,kind:'course',source:'timetable',
  date:slot.date,slot:slot.slot,period:slot.period||'',timetableId:slot.timetableId||'',
  status:'open',title:u.title||'Thema noch festlegen',objective:u.objective||'',
  sequenceId:q.id,unit:q.title,
  planReference:{unitId:u.id,title:u.title||'',plannedDate:slot.date,content:u.content||'',
   objective:u.objective||'',material:u.material||'',notes:u.notes||'',autoMatched:false},
  plannedSteps:[],completedSteps:[],phasePlan:[],slides:[],prepTasks:[],materials:[],printPlan:[]};
}
const oldReflow=v190RescheduleCourseYear;
v190RescheduleCourseYear=function(cid,year=v190PlanningYear(),silent=false,options={}){
 const today=weekNow(),yearNorm=v190NormYear(year),qs=v190PlanningSequences(cid,yearNorm);
 if(!qs.length)return oldReflow(cid,year,silent,options);
 const beforeDates=new Map(qs.flatMap(q=>(q.plan||[]).map(u=>[u.id,u.plannedDate||''])));
 const snapshot={lessons:structuredClone(state.lessons),sequences:structuredClone(state.sequences)};
 // An old unheld card after the inserted unit must move with that unit,
 // even if its original planned date is now in the past.
 const ordered=qs.flatMap(q=>(q.plan||[]).filter(u=>!v201UnitSkipped(u)));
 const insertedAt=options.insertedUnitId?ordered.findIndex(u=>u.id===options.insertedUnitId):-1;
 const movablePast=new Set(insertedAt<0?[]:ordered.slice(insertedAt).map(u=>u.id));
 const previous=(state.lessons||[]).filter(l=>l.classId===cid&&
  !isHistory(l)&&(!l.date||l.date>=today||movablePast.has(l.planReference?.unitId)))
  .map(l=>({id:l.id,original:structuredClone(l)}));
 const byOriginal=new Map(previous.map(x=>[x.id,x.original]));
 try{
  // The existing scheduler already respects actual calendar closures and exam
  // dates, and reflows all later sequences. Only its obsolete 'concrete = fixed'
  // rule is overridden; all course metadata stays in the original model.
  const result=oldReflow(cid,year,silent,options);
  // The old rescheduler legitimately leaves overflowing units undated.
  // Keep them active, with explicit metadata for the sequence view; never
  // convert a lack of free lessons into "skipped this school year".
  for(const q of qs)for(const u of q.plan||[]){
   if(v201UnitSkipped(u))continue;
   if(u.plannedDate){
    delete u.overflowV280;
   }else if(u.overflowV280||movablePast.has(u.id)||
    (beforeDates.get(u.id)||'')>=today){
    u.overflowV280={fromDate:beforeDates.get(u.id)||u.overflowV280?.fromDate||'',
     at:u.overflowV280?.at||new Date().toISOString()};
   }
  }
  const slots=v190CourseSlots(cid,yearNorm).filter(s=>s.date>=today);
  if(!slots.length)return result;
  const reserved=new Set();
  for(const l of state.lessons||[]){
   if(l.classId!==cid||!isHistory(l)||!l.date||l.date<today)continue;
   const s=slots.find(s=>s.date===l.date&&
    (l.timetableId&&s.timetableId===l.timetableId||Number(lessonSlot(l))===Number(s.slot)));
   if(s)reserved.add(key(s));
  }
  const placed=new Map(),used=new Set(reserved);
  for(const q of qs)for(const u of q.plan||[]){
   if(v201UnitSkipped(u)||!u.plannedDate||u.plannedDate<today)continue;
   const choices=slots.filter(s=>s.date===u.plannedDate&&!used.has(key(s)));
   const s=choices.find(s=>Number(u.plannedSlotV272||0)===Number(s.slot))||choices[0];
   if(!s)throw Error('Ein Soll-Thema kollidiert mit einem bereits belegten Fachtermin: '+u.title);
   used.add(key(s));placed.set(u.id,{slot:s,q,u});
   u.plannedSlotV272=s.slot;
  }
  // Restore each future lesson's original CONTENT. The legacy rescheduler may
  // have temporarily attached an unrelated topic to its former DATE.
  for(const l of state.lessons||[]){
   const original=byOriginal.get(l.id);
   if(!original)continue;
   for(const field of Object.keys(l))delete l[field];
   Object.assign(l,original);
  }
  const linked=new Map();
  for(const l of state.lessons||[]){
   const original=byOriginal.get(l.id);
   if(!original?.planReference?.unitId)continue;
   const uid=original.planReference.unitId;
   if(!linked.has(uid))linked.set(uid,[]);
   linked.get(uid).push(l);
  }
  const targetTaken=new Map(),duplicateWarnings=[];
  for(const [unitId,rows] of linked){
   const place=placed.get(unitId);
   // A past duplicate can have its own complete lesson draft. Keep it intact,
   // but never let it prevent a teacher from inserting a different new hour.
   // Already parked extra cards must not become the preferred card next time.
   const sorted=[...rows].sort((a,b)=>
    Number(!!a.scheduleParkedV275?.planDuplicateDraftV3328)-
     Number(!!b.scheduleParkedV275?.planDuplicateDraftV3328)||
    Number(prepared(b))-Number(prepared(a))||
    Number(!!b.date&&b.date===place?.slot.date)-
     Number(!!a.date&&a.date===place?.slot.date));
   const primary=sorted[0];
   for(const extra of sorted.slice(1)){
    const wasPrepared=prepared(extra),
     alreadyParked=!!extra.scheduleParkedV275?.planDuplicateDraftV3328;
    if(wasPrepared&&!alreadyParked)
     duplicateWarnings.push('Die zusätzliche ausgearbeitete Karte „'+
      (extra.title||extra.id)+'“ wurde ohne Termin aufbewahrt. Inhalte, PowerPoint und Materialien sind erhalten; in der Reihe unter „Stundenkarten ansehen“ öffnen.');
    extra.scheduleParkedV275={
     ...(extra.scheduleParkedV275||{}),
     previousDate:extra.date||extra.scheduleParkedV275?.previousDate||'',
     previousSlot:lessonSlot(extra)||extra.scheduleParkedV275?.previousSlot||0,
     reason:'Zusätzliche Stundenkarte mit derselben Soll-Stunden-ID',
     planDuplicateDraftV3328:wasPrepared||alreadyParked
    };
    extra.date='';
    if(extra.planReference)extra.planReference.plannedDate='';
   }
   if(!place){
    if(primary.date){
     primary.scheduleParkedV275={previousDate:primary.date,previousSlot:lessonSlot(primary),
      reason:'Überhang – aktives Soll-Thema ohne Fachtermin'};
     primary.date='';
     if(primary.planReference)primary.planReference.plannedDate='';
    }
    continue;
   }
   const s=place.slot;
   primary.date=s.date;primary.slot=s.slot;primary.period=s.period||primary.period||'';
   primary.timetableId=s.timetableId||primary.timetableId;
   primary.sequenceId=place.q.id;primary.unit=place.q.title;
   primary.planReference={...(primary.planReference||{}),unitId,title:place.u.title,
    plannedDate:s.date,content:place.u.content,objective:place.u.objective,
    material:place.u.material,notes:place.u.notes,autoMatched:false};
   delete primary.scheduleParkedV275;
   targetTaken.set(key(s),primary.id);
  }
  // Keep all unrelated, nonempty lesson cards safe; never overwrite them.
  // Empty old auto-cards can be reused or parked after the prepared content moves.
  for(const l of state.lessons||[]){
   if(l.classId!==cid||!l.date||l.date<today||isHistory(l)||targetTaken.get(key({
    date:l.date,slot:lessonSlot(l),timetableId:l.timetableId||''}))===l.id)continue;
   const s=slots.find(s=>s.date===l.date&&Number(s.slot)===Number(lessonSlot(l)));
   if(!s||!targetTaken.has(key(s)))continue;
   if(blank(l)){
    l.scheduleParkedV275={previousDate:l.date,reason:'Leere alte Stundenkarte'};
    l.date='';
   }else if(!l.planReference?.unitId){
    // A prepared orphan is user data. It is movable only once it has a
    // reliable unit association. Never silently discard its material.
    throw Error('Eine ausgearbeitete Stunde am '+fmtDate(l.date)+' ist keiner Soll-Stunde zugeordnet. Bitte diese Stundenkarte einmal einem Reihenthema zuordnen.');
   }
  }
  // Backdated inserted units still receive a linked card on that date.
  if(options.insertedUnitId&&options.insertedDate&&options.insertedDate<today){
   const row=qs.flatMap(q=>(q.plan||[]).map(u=>({q,u})))
    .find(x=>x.u.id===options.insertedUnitId);
   if(row?.u.plannedDate&&!(state.lessons||[]).some(l=>l.classId===cid&&
      l.planReference?.unitId===row.u.id)){
    const s=v190CourseSlots(cid,yearNorm).find(s=>s.date===row.u.plannedDate);
    if(s)state.lessons.push(createForUnit(cid,s,row.q,row.u));
   }
  }
  // Make newly inserted near-term hours visible in the Monday / print views,
  // without eagerly creating hundreds of placeholder cards for later months.
  const horizon=new Date(today+'T12:00:00');horizon.setDate(horizon.getDate()+28);
  const limit=iso(horizon);
  for(const [unitId,{slot:s,q,u}] of placed){
   if(s.date>limit||linked.has(unitId))continue;
   if([...targetTaken.keys()].includes(key(s)))continue;
   let l=(state.lessons||[]).find(l=>l.classId===cid&&l.date===s.date&&
    Number(lessonSlot(l))===Number(s.slot)&&blank(l));
   if(l){
    // An empty legacy moved-from card has no actual content; drop its stale warning.
    delete l.v180MovedFrom;
    l.title=u.title||'Thema noch festlegen';l.objective=u.objective||'';
    l.sequenceId=q.id;l.unit=q.title;
    l.planReference={unitId:u.id,title:u.title||'',plannedDate:s.date,
     content:u.content||'',objective:u.objective||'',material:u.material||'',
     notes:u.notes||'',autoMatched:false};
    l.slot=s.slot;l.period=s.period||l.period;l.timetableId=s.timetableId||l.timetableId;
   }else{l=createForUnit(cid,s,q,u);state.lessons.push(l);}
   targetTaken.set(key(s),l.id);
  }
  if(duplicateWarnings.length)
   result.warning=[result.warning,...duplicateWarnings].filter(Boolean).join('\n');
  return result;
 }catch(e){
  state.lessons=snapshot.lessons;state.sequences=snapshot.sequences;
  throw e;
 }
};
const oldRender=render;
render=function(){oldRender();const v=document.querySelector('.brand small');if(v)v.textContent=state.settings.schoolYear+' · V0.27.8';};
window.SchulcockpitFlexPlanV278={reflow:v190RescheduleCourseYear};
})();
