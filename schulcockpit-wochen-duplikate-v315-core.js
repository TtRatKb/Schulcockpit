/* V0.31.5 – identify redundant records for one genuine timetable period.
 * Pure and non-destructive: never delete, move or rewrite lesson data.
 * Conflicting teaching evidence remains visible and must be reviewed.
 */
const SC_WEEK_DUPLICATES_V315=(function(){
'use strict';
const txt=v=>String(v??'');
const filled=v=>{
 if(v===undefined||v===null||v===false||v===0||v==='')return false;
 if(Array.isArray(v))return v.some(filled);
 if(typeof v==='object')return Object.keys(v).length>0; // a stored false can mean a deliberate decision
 return true;
};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const IGNORE=new Set(['id','classId','groupId','kind','date','slot','period',
 'timetableId','source','createdAt','updatedAt','scheduleParkedV275','duplicateOfV315',
 'sequenceId','unit','title','objective','status','planReference']);
function concreteWeight(l){
 let weight=0;
 const status=txt(l?.status);
 if(status==='done'||l?.heldAtV182||l?.executionV180?.type==='substitute')weight+=1000;
 if(l?.executionV180?.type==='cancelled')weight+=800;
 if(l?.reflectionV182?.completedAt||l?.actualV270?.savedAt)weight+=500;
 if(l?.aiImportAt||l?.manualPlanReadyV177)weight+=150;
 if(l?.presentationReady||l?.presentationBlobKeyV180)weight+=70;
 for(const k of ['phasePlan','slides','materials','printPlan','prepTasks',
 'plannedSteps','completedSteps','actualV270','reflectionV182','executionV180']){
  if(filled(l?.[k]))weight+=50;
 }
 if(l?.planReference?.unitId)weight+=35;
 if(filled(l?.planReference))weight+=10;
 if(txt(l?.title).trim()&&!/^(thema noch festlegen|unterricht planen)$/i.test(txt(l?.title)))weight+=6;
 if(txt(l?.objective).trim())weight+=5;
 return weight;
}
function slotKey(l){
 if(!l||!l.date||!(l.classId||l.groupId))return '';
 // A timetable block number is a period identity, not the ordinal of
 // the lesson within a sequence. Do not compare labels like "3. Block".
 const raw=l.slot;
 const n=raw===null||raw===undefined||raw===''?NaN:Number(raw);
 if(!Number.isInteger(n)||n<0||n>30)return '';
 return [txt(l.date),l.groupId?'group:'+txt(l.groupId):'course:'+txt(l.classId),n].join('|');
}
function shadowOf(extra,primary){
 if(!extra||!primary||extra.id===primary.id)return false;
 if(slotKey(extra)!==slotKey(primary)||!slotKey(extra))return false;
 // Both are historical lessons? Both remain. Never conceal held/cancelled
 // records or a second genuinely planned hour with independent evidence.
 if(txt(extra.status)!=='open'||extra.heldAtV182||
    extra.executionV180?.type||extra.reflectionV182?.completedAt)return false;
 if(extra.sequenceId&&primary.sequenceId&&extra.sequenceId!==primary.sequenceId)return false;
 if(extra.unit&&primary.unit&&extra.unit!==primary.unit)return false;
 if(txt(extra.title).trim()&&txt(primary.title).trim()&&
    txt(extra.title)!==txt(primary.title)&&
    !/^(thema noch festlegen|unterricht planen)$/i.test(txt(extra.title)))
  return false;
 if(filled(extra.objective)&&!equal(extra.objective,primary.objective))return false;
 const a=extra.planReference||{},b=primary.planReference||{};
 if(a.unitId&&b.unitId&&a.unitId!==b.unitId)return false;
 for(const [key,value] of Object.entries(a)){
  if(['unitId','plannedDate','autoMatched'].includes(key))continue;
  if(key==='title'&&(!filled(value)||txt(value)===txt(primary.title)))continue;
  if(filled(value)&&!equal(value,b[key]))return false;
 }
 // Nothing unknown or unique may be silently filtered from planning,
 // printing or the lesson opening workflow.
 for(const [key,value] of Object.entries(extra)){
  if(IGNORE.has(key)||!filled(value))continue;
  if(!equal(value,primary[key]))return false;
 }
 return true;
}
function analyze(lessons){
 const rows=Array.isArray(lessons)?lessons:[],groups=new Map();
 for(const l of rows){
  const key=slotKey(l);
  if(!key)continue;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(l);
 }
 const hidden=[],collisions=[],hiddenIds=new Set();
 for(const [key,items] of groups){
  if(items.length<2)continue;
  const primary=[...items].sort((a,b)=>concreteWeight(b)-concreteWeight(a)||
   (txt(a.id)<txt(b.id)?-1:1))[0];
  const distinct=[];
  for(const extra of items){
   if(extra.id===primary.id)continue;
   if(shadowOf(extra,primary)){
    hidden.push({key,primaryId:primary.id,extraId:extra.id,
     courseId:extra.classId||'',date:extra.date,slot:Number(extra.slot),
     title:txt(extra.title||extra.planReference?.title||'')});
    hiddenIds.add(extra.id);
   }else distinct.push(extra.id);
  }
  if(distinct.length)collisions.push({key,date:primary.date,
   classId:primary.classId||'',slot:Number(primary.slot),ids:[primary.id,...distinct]});
 }
 return {visible:rows.filter(l=>!hiddenIds.has(l.id)),hidden,collisions,
  originalCount:rows.length};
}
return {analyze,slotKey,shadowOf,concreteWeight};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_WEEK_DUPLICATES_V315;
