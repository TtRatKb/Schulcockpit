/* Schulcockpit V0.32.9 – canonical Soll-to-lesson reconciliation.
 * Pure proposal: no user state or stored file is mutated until the caller commits.
 * Identity is classId + stable planReference.unitId; never infer from title alone.
 */
const SC_PLAN_CARD_SYNC_V329=(function(){
'use strict';
const txt=v=>String(v??'');
const key=s=>txt(s?.date)+'|'+Number(s?.slot);
const historical=l=>!!l&&(l.status==='done'||l.status==='cancelled'||
 !!l.heldAtV182||!!l.actualV270?.savedAt||
 !!l.reflectionV182?.completedAt||!!l.executionV180?.type);
const filled=x=>Array.isArray(x)?x.length>0:!!x;
function weight(l){
 let n=0;
 for(const k of ['slides','phasePlan','materials','printPlan','prepTasks',
  'plannedSteps','completedSteps'])if(filled(l[k]))n+=100+(l[k].length||0);
 if(l.presentationReady||l.presentationBlobKeyV180)n+=300;
 if(l.manualPlanReadyV177||l.aiImportAt)n+=140;
 if(l.reflectionV182?.note)n+=200;
 if(l.notes)n+=30;
 if(l.source==='manual')n+=15;
 return n;
}
function toDate(start,n){
 const d=new Date(start+'T12:00:00');d.setDate(d.getDate()+n);
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function propose(input){
 const {state,classId,sequences=[],slots=[],today,forceUnitIds=[]}=input||{};
 if(!state||!classId||!today)throw Error('Fachkurs und aktuelles Datum fehlen.');
 const lessons=structuredClone(state.lessons||[]);
 const actions=[],issues=[],forced=new Set(forceUnitIds);
 const units=sequences.flatMap(q=>(q.plan||[]).filter(u=>!u.skippedThisYearV201)
  .map(u=>({q,u})));
 const unique=new Set();
 for(const {u} of units){
  if(unique.has(u.id))issues.push('Doppelte Soll-Stunden-ID: '+txt(u.title));
  unique.add(u.id);
 }
 const courseSlots=slots.filter(s=>s?.date&&Number.isInteger(Number(s.slot)))
  .slice().sort((a,b)=>a.date.localeCompare(b.date)||Number(a.slot)-Number(b.slot));
 const assigned=new Map(),used=new Set();
 for(const {q,u} of units){
  if(!u.plannedDate)continue; // Undated overflow is not a physical lesson.
  const available=courseSlots.filter(s=>s.date===u.plannedDate&&!used.has(key(s)));
  const siblings=lessons.filter(l=>l.classId===classId&&l.planReference?.unitId===u.id);
  let chosen=null;
  const targetSlot=Number(u.plannedSlotV272);
  if(Number.isInteger(targetSlot)&&targetSlot>0){
   chosen=available.find(s=>Number(s.slot)===targetSlot);
   if(!chosen){
    issues.push('Terminblock von „'+txt(u.title)+'“ ('+u.plannedDate+') nicht verfügbar.');
    continue;
   }
  }else{
   const sameDate=siblings.find(l=>l.date===u.plannedDate&&
    available.some(s=>Number(s.slot)===Number(l.slot)));
   chosen=sameDate?available.find(s=>Number(s.slot)===Number(sameDate.slot)):available[0];
  }
  if(!chosen){
   issues.push('Kein freier Fachtermin für „'+txt(u.title)+'“ ('+u.plannedDate+').');
   continue;
  }
  used.add(key(chosen));assigned.set(u.id,{q,u,s:chosen});
 }
 if(issues.length)return {actions:[],issues,lessons,changed:0};
 const currentById=new Map(lessons.map(l=>[l.id,l]));
 const preferred=new Map(),changes=new Map();
 const makeCard=({q,u,s})=>{
  let id='lesson-plan-'+u.id,seq=1;
  while(currentById.has(id))id='lesson-plan-'+u.id+'-'+(++seq);
  const l={id,classId,kind:'course',source:'timetable',date:s.date,
   slot:Number(s.slot),period:s.period||'',timetableId:s.timetableId||'',
   title:u.title||'Thema noch festlegen',objective:u.objective||'',
   status:'open',sequenceId:q.id,unit:q.title,plannedSteps:[],
   completedSteps:[],phasePlan:[],slides:[],prepTasks:[],materials:[],printPlan:[],
   planReference:{unitId:u.id,title:u.title||'',plannedDate:s.date,
    content:u.content||'',objective:u.objective||'',material:u.material||'',
    notes:u.notes||'',autoMatched:false}};
  currentById.set(id,l);lessons.push(l);
  actions.push({kind:'create',id,title:u.title||'',from:'',to:s.date,slot:Number(s.slot)});
  return l;
 };
 const minCreate=toDate(today,-21),maxCreate=toDate(today,35);
 for(const {q,u} of units){
  const hit=assigned.get(u.id),linked=lessons.filter(l=>l.classId===classId&&
   l.planReference?.unitId===u.id),locked=linked.filter(historical),
   editable=linked.filter(l=>!historical(l));
  if(locked.length){
   // Held/cancelled/actual evidence is immutable; never claim it moved.
   if(hit&&locked.some(l=>l.date!==hit.s.date||
     Number(l.slot)!==Number(hit.s.slot)))
    issues.push('Gehaltene bzw. dokumentierte Stunde „'+txt(u.title)+
      '“ hat einen anderen Ist-Termin als im Sollplan.');
   continue;
  }
  if(!hit){
   // A genuine year-end overflow remains in the plan without a date.
   for(const l of editable)if(l.date)changes.set(l.id,{kind:'park',l,
    reason:'Aktive Soll-Stunde ohne freien Fachtermin',title:u.title||''});
   continue;
  }
  const {s}=hit;
  let primary=[...editable].sort((a,b)=>weight(b)-weight(a)||
    Number(b.date===s.date)-Number(a.date===s.date)||
    txt(a.id).localeCompare(txt(b.id)))[0]||null;
  if(!primary){
   if(!forced.has(u.id)&&!(s.date>=minCreate&&s.date<=maxCreate))continue;
   primary=makeCard(hit);
  }
  preferred.set(u.id,primary.id);
  if(primary.date!==s.date||Number(primary.slot)!==Number(s.slot)||
     primary.timetableId!==s.timetableId)
   changes.set(primary.id,{kind:'move',l:primary,q,u,s,title:u.title||''});
  else changes.set(primary.id,{kind:'refresh',l:primary,q,u,s,title:u.title||''});
  for(const extra of editable){
   if(extra.id===primary.id||!extra.date)continue;
   changes.set(extra.id,{kind:'park',l:extra,
    reason:'Zusätzliche Karte zur selben Soll-Stunde',title:u.title||''});
  }
 }
 // Destination collision check is based on FINAL proposed locations, not the
 // old calendar. A moved topic can vacate its former date for the next unit.
 const finalAt=new Map();
 for(const l of lessons){
  if(l.classId!==classId||!l.date)continue;
  const change=changes.get(l.id);
  const dst=change?.kind==='park'?'':change?.kind==='move'?change.s.date:l.date;
  const slot=change?.kind==='move'?Number(change.s.slot):Number(l.slot);
  if(!dst)continue;
  const k=dst+'|'+slot;
  if(!finalAt.has(k))finalAt.set(k,[]);
  finalAt.get(k).push(l);
 }
 for(const [k,overlaps] of finalAt){
  if(overlaps.length<2)continue;
  const target=overlaps.find(l=>preferred.has(l.planReference?.unitId)&&
   preferred.get(l.planReference?.unitId)===l.id&&
   assigned.has(l.planReference.unitId)&&
   key(assigned.get(l.planReference.unitId).s)===k);
  if(!target)continue; // Other preexisting conflicts are not ours to resolve.
  for(const occupant of overlaps){
   if(occupant.id===target.id)continue;
   if(historical(occupant)){
    issues.push('Geplanter Fachtermin '+k+' ist tatsächlich bereits gehalten oder dokumentiert.');
   }else if(assigned.has(occupant.planReference?.unitId)){
    issues.push('Am Fachtermin '+k+' verbleibt eine weitere aktive Soll-Stundenkarte.');
   }else{
    // Unknown content stays intact, but leaves the regular course slot after
    // explicit reconciliation. Its original date remains in park metadata.
    changes.set(occupant.id,{kind:'park',l:occupant,
     reason:'Ohne eindeutige Soll-Zuordnung am neu belegten Fachtermin',
     title:occupant.title||'Ohne Titel'});
   }
  }
 }
 if(issues.length)return {actions:[],issues,lessons:structuredClone(state.lessons||[]),changed:0};
 for(const c of changes.values()){
  const l=c.l,oldDate=l.date||'';
  if(c.kind==='park'){
   l.scheduleParkedV275={...(l.scheduleParkedV275||{}),
    previousDate:oldDate,previousSlot:l.slot,
    reason:c.reason,planCardReconcileV329:true};
   l.date='';
   if(l.planReference)l.planReference.plannedDate='';
   actions.push({kind:'park',id:l.id,title:c.title,from:oldDate,to:'',slot:l.slot});
  }else{
   const {s,q,u}=c;
   if(c.kind==='move'){
    l.date=s.date;l.slot=Number(s.slot);
    l.period=s.period||l.period||'';l.timetableId=s.timetableId||l.timetableId;
    if(oldDate!==s.date&&l.presentationReady&&
       l.presentationSourceV177==='generated'&&!l.presentationNotRequiredV177){
     l.presentationReady=false;
     l.pptNeedsDateRefreshV311={oldDate,changedAt:today+'T12:00:00'};
    }
    actions.push({kind:'move',id:l.id,title:c.title,from:oldDate,to:s.date,slot:Number(s.slot)});
   }
   l.sequenceId=q.id;l.unit=q.title;
   const oldRef=l.planReference||{};
   l.planReference={...oldRef,unitId:u.id,
    title:u.title||oldRef.title||'',plannedDate:s.date,
    autoMatched:false};
   if(!l.title||l.title==='Thema noch festlegen'||l.title===oldRef.title)
    l.title=u.title||l.title;
   if(!l.objective&&u.objective)l.objective=u.objective;
   delete l.scheduleParkedV275;
  }
 }
 return {actions,issues,lessons,changed:actions.length};
}
return {propose,historical,weight};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_PLAN_CARD_SYNC_V329;
