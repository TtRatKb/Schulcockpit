/* V0.28.8 – read-only weekly timetable reconciliation planner.
 * There is no deletion, moving or mutation in the planning core. */
const SC_WEEKFILL_V288=(function(){
'use strict';
function dayAt(monday,weekday){
 const dt=new Date(monday+'T12:00:00');
 if(!/^\d{4}-\d\d-\d\d$/.test(monday)||!Number.isFinite(dt.getTime()))return '';
 dt.setDate(dt.getDate()+weekday-1);
 return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
}
function mondayOf(date){
 const d=new Date(date+'T12:00:00');
 if(!Number.isFinite(d.getTime()))return '';
 d.setDate(d.getDate()-(d.getDay()||7)+1);
 return dayAt(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),1);
}
function plan({monday,today,timetable=[],lessons=[],noSchool=()=>null,allowedYear=()=>true}={}){
 if(!monday||!today||monday<mondayOf(today)||!allowedYear(monday))
  return {missing:[],excluded:[],conflicts:[],reason:'inactive-or-historical'};
 const booked=new Set((lessons||[]).filter(l=>l?.date>=monday&&l.date<=dayAt(monday,5))
  .map(l=>l.date+'|'+Number(l.slot??l.order??0)));
 const missing=[],excluded=[],conflicts=[],seen=new Set();
 for(const t of timetable||[]){
  const weekday=Number(t?.weekday),slot=Number(t?.slot);
  if(!Number.isInteger(weekday)||weekday<1||weekday>5||
   !Number.isInteger(slot)||slot<0||!t?.id)continue;
  const date=dayAt(monday,weekday),key=date+'|'+slot;
  // Never manufacture a historical lesson for a day already in the past.
  if(date<today)continue;
  if(seen.has(key)){conflicts.push({t,date,reason:'duplicate-timetable-slot'});continue;}
  seen.add(key);
  const absence=noSchool(date,t.classId||'');
  if(absence){excluded.push({t,date,absence});continue;}
  if(booked.has(key))continue;
  booked.add(key);
  missing.push({t,date,slot});
 }
 return {missing,excluded,conflicts,reason:''};
}
return {dayAt,mondayOf,plan};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_WEEKFILL_V288;
