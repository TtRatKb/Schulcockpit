// Static Schulcockpit browser smoke. Uses only synthetic, disposable profile data.
import {spawn} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const port=19239, sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=await mkdtemp(join(tmpdir(),'schulcockpit-smoke-'));
const chrome=spawn(process.env.CHROME_BIN||'google-chrome',[
 '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
 '--remote-debugging-port='+port,'--remote-allow-origins=*',
 '--user-data-dir='+profile,'about:blank'
],{stdio:['ignore','pipe','pipe'],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:''}});
let chromeLog='';
chrome.stderr?.on('data',chunk=>{chromeLog=(chromeLog+String(chunk)).slice(-5000);});
let socket=null;const pending=new Map(),exceptions=[];let nextId=0;
async function poll(fn,why,limit=20000){
 const deadline=Date.now()+limit;
 while(Date.now()<deadline){try{const v=await fn();if(v)return v;}catch(e){}await sleep(180);}
 throw Error('Timed out: '+why+'; Chrome PID '+chrome.pid+', exit '+chrome.exitCode+', signal '+chrome.signalCode+'; stderr: '+chromeLog.slice(-1300));
}
function send(method,params={}){
 if(!socket||socket.readyState!==WebSocket.OPEN)throw Error('Chrome CDP connection closed');
 const id=++nextId;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},15000);
  pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
  socket.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expression){
 const reply=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(reply.result?.exceptionDetails)throw Error(reply.result.exceptionDetails.exception?.description||reply.result.exceptionDetails.text||'JavaScript expression failed');
 return reply.result?.result?.value;
}
try{
 const target=await poll(async()=>{
  const arr=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
  return arr.find(x=>x.type==='page');
 },'Chrome CDP page',60000);
 socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{
  socket.addEventListener('open',resolve,{once:true});
  socket.addEventListener('error',reject,{once:true});
 });
 socket.addEventListener('message',ev=>{
  const msg=JSON.parse(String(ev.data));
  if(msg.id&&pending.has(msg.id)){
   const p=pending.get(msg.id);pending.delete(msg.id);
   msg.error?p.reject(Error(msg.error.message||JSON.stringify(msg.error))):p.resolve(msg);
  }
  if(msg.method==='Runtime.exceptionThrown'){
   const d=msg.params?.exceptionDetails;
   exceptions.push(String(d?.exception?.description||d?.text||'Uncaught exception'));
  }
 });
 await send('Runtime.enable');await send('Page.enable');
 await send('Page.navigate',{url:'http://127.0.0.1:8765/index.html'});
 const ready=await poll(async()=>{
  const v=await evaluate('({loading:!!document.querySelector("#sc-v186-load"),app:!!document.querySelector(".sidebar nav"),ready:typeof v186Ready!=="undefined"&&v186Ready,heading:document.querySelector(".brand small")?.textContent||""})');
  return v.ready&&!v.loading&&v.app?v:null;
 },'IndexedDB bootstrap and sidebar',30000);
 if(exceptions.length)throw Error('Startup exceptions: '+exceptions.join('\n'));
 console.log('Bootstrap passed:',ready.heading);
 const daySmoke=await evaluate("(async()=>{\n const before=structuredClone(state),oldView=view,oldModal=modal;\n try{\n  state.classes=[{id:'test-day-course',subject:'Mathematik',name:'5a'}];\n  state.lessons=[{id:'test-day-lesson',classId:'test-day-course',\n   date:'2026-11-16',slot:2,period:'2. Block',title:'Brüche addieren',\n   phasePlan:[{title:'Übung'}],slides:[{title:'Addition'}],status:'planned',\n   presentationReady:false,printPlan:[]}];\n  state.settings.activeWeekStart='2026-11-16';\n  view='dayV320';modal=null;render();\n  SchulcockpitDayV320.setDay('2026-11-16');\n  const nav=!!document.querySelector('.sidebar [data-view=\"dayV320\"]');\n  const card=document.querySelector('.v320-lesson');\n  const cardText=card?.textContent||'';\n  const initial=document.querySelector('#v320-day-date')?.value;\n  const unchanged=state.lessons[0].title==='Brüche addieren';\n  document.querySelector('[data-v320-next]')?.click();\n  const next=document.querySelector('#v320-day-date')?.value;\n  document.querySelector('[data-v320-prev]')?.click();\n  const back=document.querySelector('#v320-day-date')?.value;\n  return {nav,card:!!card,course:cardText.includes('Mathematik 5a'),\n   topic:cardText.includes('Brüche addieren'),\n   missingPpt:cardText.includes('nicht lokal verfügbar'),\n   initial,next,back,unchanged};\n }finally{\n  state=before;view=oldView;modal=oldModal;await saveState();render();\n }\n})()");
 if(!daySmoke.nav||!daySmoke.card||!daySmoke.course||!daySmoke.topic||!daySmoke.missingPpt||
    daySmoke.initial!=='2026-11-16'||daySmoke.next!=='2026-11-17'||
    daySmoke.back!=='2026-11-16'||!daySmoke.unchanged)
   throw Error('Daily dashboard smoke regression: '+JSON.stringify(daySmoke));
 console.log('Chrome V320: day navigation, real lesson, missing local PPT and non-mutating display verified');
 const firefoxTargetEmpty=await evaluate("(async()=>{\n const initial=await SchulcockpitTransferV264.destinationReport();\n const key='__material_catalog_manifest_v171__',idx='__sc_masterclass_v251__:index';\n await fileStorePut(key,new File([JSON.stringify({\n  kind:'schulcockpit-material-catalog-local',schemaVersion:'1.0',entries:[],meta:{}\n })],'materialkatalog-local.json',{type:'application/json'}));\n await v200PrivatePut({assessmentId:idx,schema:'schulcockpit.private-master-index.v1',classes:[]});\n const innocent=await SchulcockpitTransferV264.destinationReport();\n const note=await SchulcockpitTransferV264.destinationEmpty();\n await fileStoreDelete(key);await v200PrivateDelete(idx);\n return {initial:initial.safe,initialProblems:initial.problems,innocent:innocent.safe,\n  innocentProblems:innocent.problems,allowed:note,\n  stateFlags:SC_TARGET_CORE_V286.planning(state).counts,\n  storedFlags:SC_TARGET_CORE_V286.planning(JSON.parse((await v186DbGet()).json)).counts,\n  nonemptyTopLevel:Object.entries(state).filter(([k,v])=>\n   k!=='settings'&&![\"classes\",\"timetable\",\"sequences\",\"lessons\",\"materials\",\"materialCatalog\",\"assessments\",\"backlog\",\"tasks\",\"curricula\",\"competencyCatalogsV200\"].includes(k)&&\n   (Array.isArray(v)?v.length:typeof v==='object'?Object.values(v||{}).length:v)).map(([k])=>k)};\n})()");
 if(!firefoxTargetEmpty.initial||!firefoxTargetEmpty.innocent||!firefoxTargetEmpty.allowed)
  throw Error('Fresh Firefox app-created data incorrectly blocks migration: '+JSON.stringify(firefoxTargetEmpty));
 console.log('Fresh Firefox bootstrap and empty IndexedDB catalog/master-index accepted without deleting data');

 // Synthetic timetable fixtures were created for Monday 2026-11-02. Keep their
 // clock fixed just before that Monday to ensure the planned slot is still future.
 const syntheticClock=await evaluate("(()=>{\n const NativeDate=window.Date,anchor='2026-10-30T10:00:00+01:00';\n window.Date=class FixedTestDate extends NativeDate{\n  constructor(...args){if(args.length)super(...args);else super(anchor);}\n  static now(){return NativeDate.parse(anchor);}\n };\n return new Date().toISOString();\n})()");
 console.log('Synthetic browser fixture clock:',syntheticClock);
 const sequenceDrag=await evaluate("(async()=>{\n const before=structuredClone(state),beforeView=view,beforeModal=modal;\n try{\n  const cid='drag-r9',qid='drag-q9',unitIds=['held','work','ethics'];\n  state.settings.schoolYear='2026/27';\n  state.settings.activeWeekStart='2026-11-09';\n  state.classes=[{id:cid,subject:'Religion',name:'9',students:25}];\n  state.timetable=[{id:'drag-tt',classId:cid,weekday:2,slot:2,kind:'course',period:'3. Stunde'}];\n  state.schoolCalendarsV190={'2026/27':{customRanges:[],imports:[],useCurrentTimetable:true}};\n  state.assessments=[];\n  state.materials=[{id:'drag-m1',title:'Original Ethik',variants:[]}];\n  const times=['2026-10-27','2026-11-10','2026-11-17'];\n  state.sequences=[{id:qid,classId:cid,title:'Tod und Trauer',\n   schoolYearV190:'2026/27',startDate:times[0],endDate:times[2],plan:\n   unitIds.map((id,i)=>({id,title:id,plannedDate:times[i],plannedSlotV272:2}))}];\n  state.lessons=unitIds.map((id,i)=>({id:'drag-l-'+id,classId:cid,\n   sequenceId:qid,unit:'Tod und Trauer',date:times[i],slot:2,\n   timetableId:'drag-tt',period:'3. Stunde',title:id,\n   planReference:{unitId:id,plannedDate:times[i],title:id},\n   status:i===0?'done':'open',source:'timetable',kind:'course',\n   phasePlan:i===2?[{title:'Ethik-Frage',minutes:10}]:[],\n   materials:i===2?['drag-m1']:[],printPlan:i===2?\n    [{materialId:'drag-m1',alreadyPrinted:true,needed:true}]:[],\n   slides:[],prepTasks:[]}));\n  modal={type:'sequence',id:qid};view='sequences';render();\n  const handle=document.querySelector('[data-v311-list=\"editor\"] [data-v311-handle=\"ethics\"]');\n  const target=document.querySelector('[data-v311-list=\"editor\"] [data-v311-row=\"held\"]');\n  if(!handle||!target)throw Error('Lesson sort grips missing in real browser');\n  const dt=new DataTransfer(),rect=target.getBoundingClientRect();\n  handle.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt}));\n  target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,\n   clientY:rect.top+1,dataTransfer:dt}));\n  target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,\n   clientY:rect.top+1,dataTransfer:dt}));\n  const staging=SchulcockpitSequenceDragV311.getDraft();\n  const pending=!!staging&&staging.order[1]==='ethics'&&\n   state.sequences[0].plan[1].id==='work'&&\n   !document.querySelector('[data-v311-save]').disabled;\n  const debug={rectHeight:rect.height,modalType:modal?.type,stage:SchulcockpitSequenceDragV311.getDraft(),\n   message:document.querySelector('[data-v311-live]')?.textContent,\n   saveDisabled:document.querySelector('[data-v311-save]')?.disabled,\n   visibleOrder:[...document.querySelectorAll('[data-v311-list=\"editor\"] [data-v311-row]')]\n     .map(e=>e.dataset.v311Row)};\n  document.querySelector('[data-v311-save]').click();\n  await new Promise(r=>setTimeout(r,220));\n  const order=state.sequences[0].plan.map(u=>u.id);\n  const moved=state.lessons.find(l=>l.id==='drag-l-ethics');\n  const fixed=state.lessons.find(l=>l.id==='drag-l-held');\n  const after={order,ethicsDate:moved?.date,fixedDate:fixed?.date,\n   material:moved?.materials?.[0],printed:moved?.printPlan?.[0]?.alreadyPrinted,\n   phases:moved?.phasePlan?.[0]?.title};\n  state.settings.activeWeekStart='2026-11-09';\n  modal=null;view='week';render();\n  const week=!!document.querySelector('.v182-week-card')?.textContent?.includes('ethics');\n  view='prep';render();\n  const monday=!![...document.querySelectorAll('.course-prep-card-v14')]\n   .some(el=>el.textContent.includes('ethics'));\n  return {pending,...after,week,monday,debug};\n }finally{\n  state=before;view=beforeView;modal=beforeModal;\n  await saveState();render();\n }\n})()");
 if(!sequenceDrag.pending||sequenceDrag.order.join('|')!=='held|ethics|work'||
  sequenceDrag.ethicsDate!=='2026-11-10'||sequenceDrag.fixedDate!=='2026-10-27'||
  sequenceDrag.material!=='drag-m1'||!sequenceDrag.printed||
  sequenceDrag.phases!=='Ethik-Frage'||!sequenceDrag.week||!sequenceDrag.monday)
  throw Error('Real Chrome lesson drag-and-drop or Monday sync failed: '+JSON.stringify(sequenceDrag));
 console.log('Real Chrome: lesson drag, staged preview, save and Monday/week lesson identity verified');
 const directDrag=await evaluate("(async()=>{\n const original=structuredClone(state),oldView=view,oldModal=modal;\n try{\n  state.classes=[{id:'direct-r9',subject:'Religion',name:'9',students:25}];\n  state.settings.schoolYear='2026/27';\n  state.settings.sequencePlanningYearV190='2026/27';\n  state.settings.activeWeekStart='2026-11-09';\n  state.timetable=[{id:'direct-tt',classId:'direct-r9',weekday:2,slot:2,\n   period:'2. Block',kind:'course'}];\n  state.schoolCalendarsV190={'2026/27':{customRanges:[\n   {id:'direct-sub',name:'SchILF',start:'2026-11-10',end:'2026-11-10',\n    impactV262:'substitution',attendingClassIdsV289:[]}],imports:[],useCurrentTimetable:true}};\n  state.assessments=[];\n  const ids=['held','end','after','ethics'],dates=\n   ['2026-10-27','2026-11-10','2026-11-17','2026-11-24'];\n  state.sequences=[{id:'direct-q',classId:'direct-r9',schoolYearV190:'2026/27',\n   title:'Tod und Trauer',startDate:dates[0],endDate:dates[3],\n   plan:ids.map((id,i)=>({id,title:id==='end'?'Was passiert am Ende des Lebens?':id,\n    plannedDate:dates[i],plannedSlotV272:2}))}];\n  state.lessons=ids.map((id,i)=>({id:'direct-'+id,classId:'direct-r9',\n   date:dates[i],slot:2,timetableId:'direct-tt',period:'2. Block',\n   title:id==='end'?'Was passiert am Ende des Lebens?':id,\n   sequenceId:'direct-q',unit:'Tod und Trauer',\n   planReference:{unitId:id,plannedDate:dates[i],title:id},\n   status:i===0?'done':'open',source:'timetable',kind:'course',\n   materials:i===3?['direct-m']:[],printPlan:i===3?[{materialId:'direct-m',\n    alreadyPrinted:true,needed:true}]:[],phasePlan:[],slides:[],prepTasks:[]}));\n  state.lessons.push({...structuredClone(state.lessons[1]),id:'direct-end-second',\n   title:'Vertretung · Was passiert am Ende des Lebens?'});\n  state.materials=[{id:'direct-m',title:'Ethik-Aufgaben',variants:[]}];\n  modal={type:'sequence',id:'direct-q'};view='sequences';render();\n  const section=document.querySelector('.modal-body .detail-stack > .v312-direct-section');\n  const list=section?.querySelector('[data-v311-list=\"actual\"]');\n  if(!section||!list)throw Error('Actual lesson cards are not FIRST in sequence modal');\n  const start=[...list.querySelectorAll(':scope > [data-v311-row]')]\n   .map(el=>el.dataset.v311Row).join('|');\n  const two=section.querySelectorAll('[data-v311-row=\"end\"] [data-lesson]').length;\n  const beforeDuplicates=state.lessons.filter(l=>l.planReference?.unitId==='end').length;\n  const handle=section.querySelector('[data-v311-handle=\"ethics\"]');\n  const target=section.querySelector('[data-v311-row=\"end\"]');\n  const dt=new DataTransfer(),rect=target.getBoundingClientRect();\n  handle.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt}));\n  target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,\n   dataTransfer:dt,clientY:rect.top+1}));\n  target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,\n   dataTransfer:dt,clientY:rect.top+1}));\n  const pending=!!SchulcockpitSequenceDragV311.getDraft();\n  const staged=[...list.querySelectorAll(':scope > [data-v311-row]')]\n   .map(el=>el.dataset.v311Row).join('|');\n  const previewDate=section.querySelector('[data-v311-row=\"ethics\"] [data-v311-date]')?.textContent;\n  // Regression: a modal rerender used to disable both Save and Discard.\n  render();\n  const rerenderControls=!document.querySelector('.v312-direct-section [data-v311-save]').disabled&&\n    !document.querySelector('.v312-direct-section [data-v311-cancel]').hidden;\n  document.querySelector('.v312-direct-section [data-v311-cancel]').click();\n  const discarded=!SchulcockpitSequenceDragV311.getDraft()&&\n    state.sequences[0].plan.map(u=>u.id).join('|')==='held|end|after|ethics'&&\n    state.lessons.find(l=>l.id==='direct-ethics').date==='2026-11-24';\n  SchulcockpitSequenceDragV311.move('direct-q','ethics','end',false);\n  const restaged=!!SchulcockpitSequenceDragV311.getDraft()&&\n    !document.querySelector('.v312-direct-section [data-v311-save]').disabled;\n  // A drag at the modal's visible bottom must scroll the modal, not the entire page.\n  const body=document.querySelector('.modal-body');\n  body.style.maxHeight='190px';body.style.overflowY='auto';\n  const scrollingGrip=document.querySelector('.v312-direct-section [data-v311-handle=\"after\"]');\n  const dat2=new DataTransfer(),scrollBefore=body.scrollTop,area=body.getBoundingClientRect();\n  scrollingGrip.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dat2}));\n  body.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,\n   clientY:area.bottom-4,dataTransfer:dat2}));\n  body.dispatchEvent(new DragEvent('dragend',{bubbles:true,cancelable:true,dataTransfer:dat2}));\n  const scrolled=body.scrollTop>scrollBefore&&SchulcockpitDirectSequenceDragV312.scrollInfo()>0;\n  document.querySelector('.v312-direct-section [data-v311-save]').click();\n  await new Promise(res=>setTimeout(res,350));\n  const order=state.sequences[0].plan.map(u=>u.id).join('|');\n  const ethics=state.lessons.find(l=>l.id==='direct-ethics');\n  const dup=state.lessons.filter(l=>l.planReference?.unitId==='end');\n  const duplicateDates=dup.map(l=>l.date);\n  const saved=JSON.parse((await v186DbGet()).json);\n  const savedEthics=saved.lessons.find(l=>l.id==='direct-ethics')?.date;\n  return {rerenderControls,discarded,restaged,first:section===section.parentElement?.firstElementChild,dom:{parent:section.parentElement?.className,first:section.parentElement?.firstElementChild?.className,top:Math.round(section.getBoundingClientRect().top)},\n   start,two,beforeDuplicates,pending,staged,previewDate,scrolled,scrollBefore,\n   scrollAfter:body.scrollTop,order,ethicsDate:ethics.date,duplicateDates,\n   fixedDate:state.lessons.find(l=>l.id==='direct-held').date,\n   printDone:ethics.printPlan?.[0]?.alreadyPrinted,\n   persisted:savedEthics,duplicateCount:dup.length};\n }finally{\n  state=original;view=oldView;modal=oldModal;await saveState();render();\n }\n})()");
 if(!directDrag.rerenderControls||!directDrag.discarded||!directDrag.restaged||
  !directDrag.first||directDrag.start!=='held|end|after|ethics'||
  directDrag.two!==2||directDrag.beforeDuplicates!==2||!directDrag.pending||
  directDrag.staged!=='held|ethics|end|after'||!directDrag.previewDate?.includes('10.11.')||
  !directDrag.scrolled||directDrag.order!=='held|ethics|end|after'||
  directDrag.ethicsDate!=='2026-11-10'||directDrag.fixedDate!=='2026-10-27'||
  directDrag.duplicateCount!==2||directDrag.duplicateDates.some(d=>d!=='2026-11-17')||
  !directDrag.printDone||directDrag.persisted!=='2026-11-10')
  throw Error('Direct sequence cards, preview, duplicate-safe save or auto-scroll failed: '+JSON.stringify(directDrag));
 console.log('Chrome V312: ACTUAL cards at top, drag date preview, two originals retained, auto-scroll, persistent save');
 const safeSwap=await evaluate("(async()=>{\n const orig=structuredClone(state),beforeView=view,beforeModal=modal;\n try{\n  const cid='reorder-r9',qid='reorder-q',times=['2026-10-27','2026-11-10','2026-11-17'];\n  state.classes=[{id:cid,subject:'Religion',name:'9',students:25}];\n  state.timetable=[{id:'reorder-tt',classId:cid,weekday:2,slot:2,kind:'course',period:'3'}];\n  state.assessments=[];\n  state.settings.schoolYear='2026/27';\n  state.settings.activeWeekStart='2026-11-09';\n  state.schoolCalendarsV190={'2026/27':{customRanges:[],imports:[],useCurrentTimetable:true}};\n  state.sequences=[{id:qid,classId:cid,schoolYearV190:'2026/27',title:'Tod und Trauer',\n   startDate:times[0],endDate:times[2],plan:[\n    {id:'held',title:'Erste Stunde',plannedDate:times[0],plannedSlotV272:2},\n    {id:'a',title:'Trost',plannedDate:times[1],plannedSlotV272:2},\n    {id:'b',title:'Sterbehilfe',plannedDate:times[2],plannedSlotV272:2},\n    {id:'reserve',title:'Noch nicht eingeplant',plannedDate:''}]}];\n  state.lessons=['held','a','b'].map((id,i)=>({\n   id:'r-'+id,classId:cid,sequenceId:qid,date:times[i],\n   slot:2,timetableId:'reorder-tt',period:'3',source:'timetable',\n   status:i===0?'done':'open',title:id,\n   planReference:{unitId:id,plannedDate:times[i],title:id,\n    material:id==='b'?'MANUELL: AH S. 42 Nr. 1–5':''},\n   materials:id==='b'?['original-m']:[],printPlan:id==='b'?[{\n    materialId:'original-m',alreadyPrinted:true,needed:false}]:[],\n   slides:id==='b'?[{title:'Originalfolien'}]:[],\n   phasePlan:id==='b'?[{title:'Fallanalyse'}]:[]}));\n  state.lessons.push({id:'empty-timetable',classId:cid,date:times[1],\n   slot:2,status:'open',title:'Thema noch festlegen',source:'timetable',\n   materials:[],printPlan:[],slides:[],phasePlan:[],prepTasks:[]});\n  state.materials=[{id:'original-m',title:'Originalarbeitsblatt',variants:[]}];\n  const originalCount=state.lessons.length;\n  const originalDates=state.lessons.map(l=>[l.id,l.date]);\n  modal={type:'sequence',id:qid};view='sequences';render();\n  function doSwap(){\n   const choose=document.querySelector('[data-v312-direct] [data-v314-choose=\"b\"]');\n   if(!choose)throw Error('V314 choose control missing from actual card');\n   choose.click();\n   const swap=document.querySelector('[data-v312-direct] [data-v314-swap=\"a\"]');\n   if(!swap)throw Error('V314 target swap control missing');\n   swap.click();\n  }\n  doSwap();\n  const staged=SchulcockpitSequenceDragV311.getDraft()?.order.join('|');\n  const preview=document.querySelector('[data-v312-direct] [data-v311-row=\"b\"] [data-v311-date]')?.textContent;\n  const beforeCancel=state.sequences[0].plan.map(u=>u.id).join('|');\n  document.querySelector('[data-v312-direct] [data-v311-cancel]').click();\n  const discarded=!SchulcockpitSequenceDragV311.getDraft()&&\n   state.sequences[0].plan.map(u=>u.id).join('|')===beforeCancel;\n  doSwap();\n  document.querySelector('[data-v312-direct] [data-v311-save]').click();\n  await new Promise(r=>setTimeout(r,320));\n  const afterPlan=state.sequences[0].plan;\n  const afterLessons=state.lessons;\n  const snap=JSON.parse((await v186DbGet()).json);\n  return {staged,preview,discarded,\n   count:afterLessons.length,originalCount,\n   order:afterPlan.map(u=>u.id).join('|'),\n   dates:afterLessons.map(l=>[l.id,l.date]),\n   initialDates:originalDates,\n   scheduled:afterPlan.map(u=>[u.id,u.plannedDate]),\n   preservedManual:afterLessons.find(l=>l.id==='r-b')?.planReference?.material,\n   slides:afterLessons.find(l=>l.id==='r-b')?.slides?.[0]?.title,\n   printed:afterLessons.find(l=>l.id==='r-b')?.printPlan?.[0]?.alreadyPrinted,\n   range:[state.sequences[0].startDate,state.sequences[0].endDate],\n   saved:snap.lessons.find(l=>l.id==='r-b')?.date};\n }finally{\n  state=orig;view=beforeView;modal=beforeModal;await saveState();render();\n }\n})()");
 if(safeSwap.staged!=='held|b|a|reserve'||!safeSwap.preview?.includes('10.11.')||
  !safeSwap.discarded||safeSwap.order!=='held|b|a|reserve'||
  safeSwap.count!==safeSwap.originalCount||safeSwap.saved!=='2026-11-10'||
  safeSwap.scheduled.find(x=>x[0]==='reserve')?.[1]!==''||
  safeSwap.dates.find(x=>x[0]==='empty-timetable')?.[1]!=='2026-11-10'||
  safeSwap.dates.find(x=>x[0]==='r-a')?.[1]!=='2026-11-17'||
  safeSwap.dates.find(x=>x[0]==='r-held')?.[1]!=='2026-10-27'||
  safeSwap.preservedManual!=='MANUELL: AH S. 42 Nr. 1–5'||
  safeSwap.slides!=='Originalfolien'||!safeSwap.printed||
  safeSwap.range.join('|')!=='2026-10-27|2026-11-17')
  throw Error('Lossless direct lesson swap failed: '+JSON.stringify(safeSwap));
 console.log('Chrome V314: direct two-click swap, discard, save, unplanned preserved, no lesson date blanked, materials unchanged');
 const dup315=await evaluate("(async()=>{\n const before=structuredClone(state),oldView=view,oldModal=modal;\n try{\n  const cid='duplicate-r9';\n  state.settings.schoolYear='2026/27';\n  state.settings.activeWeekStart='2026-11-09';\n  state.classes=[{id:cid,subject:'Religion',name:'9',students:25}];\n  state.timetable=[{id:'dup-t',classId:cid,weekday:2,slot:2,\n   period:'3. Block',kind:'course'}];\n  state.sequences=[{id:'dup-q',classId:cid,schoolYearV190:'2026/27',\n   title:'Tod und Trauer',startDate:'2026-11-10',endDate:'2026-11-17',\n   plan:[{id:'dup-u',title:'Wie können wir trauernden Menschen helfen?',\n    plannedDate:'2026-11-10',plannedSlotV272:2}]}];\n  state.assessments=[];\n  state.materials=[];\n  state.materialCatalog=[];\n  state.schoolCalendarsV190={'2026/27':{customRanges:[],imports:[],useCurrentTimetable:true}};\n  const make=(id)=>({id,classId:cid,date:'2026-11-10',slot:2,\n   period:'3. Block',kind:'course',source:'timetable',timetableId:'dup-t',\n   status:'open',sequenceId:'dup-q',unit:'Tod und Trauer',\n   title:'Wie können wir trauernden Menschen helfen?',\n   planReference:{unitId:'dup-u',title:'Wie können wir trauernden Menschen helfen?',\n    plannedDate:'2026-11-10'},\n   materials:[],printPlan:[],slides:[],phasePlan:[],prepTasks:[]});\n  state.lessons=[make('dup-main'),make('dup-extra')];\n  const startCount=state.lessons.length;\n  modal=null;view='prep';render();\n  const monday=document.querySelectorAll('.course-prep-list-v14 .course-prep-card-v14').length;\n  const hasOriginalLink=!!document.querySelector('.v315-collisions [data-v182-open=\"dup-extra\"]')||\n    !!document.querySelector('.v315-collisions [data-v182-open=\"dup-main\"]');\n  const mondayNote=document.querySelector('.v315-collisions summary')?.textContent.trim();\n  view='week';render();\n  const week=document.querySelectorAll('.v182-week-grid .v182-week-card').length;\n  // A separate real print job is never silently hidden.\n  state.lessons[0].printPlan=[{materialId:'another-print',alreadyPrinted:false,needed:true}];\n  state.lessons[1].printPlan=[{materialId:'a-real-print',alreadyPrinted:true,needed:true}];\n  view='prep';render();\n  const conflictCount=document.querySelectorAll('.course-prep-list-v14 .course-prep-card-v14').length;\n  const conflictWarning=!!document.querySelector('.v315-collisions .v315-warning');\n  state.lessons[0].printPlan=[];\n  state.lessons[1].printPlan=[];\n  await saveState();\n  const saved=JSON.parse((await v186DbGet()).json);\n  view='prep';render();\n  const afterSave=document.querySelectorAll('.course-prep-list-v14 .course-prep-card-v14').length;\n  const allDates=state.lessons.map(l=>l.date);\n  return {monday,hasOriginalLink,mondayNote,week,conflictCount,conflictWarning,\n   afterSave,count:state.lessons.length,startCount,\n   savedOriginals:saved.lessons.filter(l=>l.classId===cid).length,\n   allDates};\n }finally{state=before;view=oldView;modal=oldModal;await saveState();render();}\n})()");
 if(dup315.monday!==1||dup315.week!==1||!dup315.hasOriginalLink||
  dup315.conflictCount!==2||!dup315.conflictWarning||dup315.afterSave!==1||
  dup315.count!==dup315.startCount||dup315.savedOriginals!==2||
  dup315.allDates.some(x=>x!=='2026-11-10'))
  throw Error('Duplicate Monday/week card reconciliation failed: '+JSON.stringify(dup315));
 console.log('Chrome V315: duplicate R9 week card unified, originals kept, different print jobs protected');
 const condensed=await evaluate("(async()=>{\n const original=structuredClone(state),previousView=view,previousModal=modal;\n try{\n  state.classes=[\n   {id:'sort-r9',name:'9',subject:'Religion',students:27},\n   {id:'sort-ghost',name:'5f',subject:'Religion',students:26},\n   {id:'sort-r11',name:'11',subject:'Religion',students:24},\n   {id:'sort-m5',name:'5f',subject:'Mathematik',students:30},\n   {id:'sort-r5',name:'5',subject:'Religion',students:26},\n   {id:'sort-method',name:'5f',subject:'Methoden',students:29},\n   {id:'sort-r7',name:'7',subject:'Religion',students:30},\n   {id:'sort-r6',name:'6',subject:'Religion',students:30}];\n  state.timetable=state.classes.filter(c=>c.id!=='sort-ghost').map((c,i)=>({\n   id:'sort-tt-'+i,classId:c.id,kind:'course',weekday:i%5+1,slot:i+1,period:'Block '+(i+1)}));\n  state.sequences=state.classes.flatMap(c=>Array.from({length:c.id==='sort-ghost'?4:1},(_,i)=>({\n   id:c.id+'-q'+i,classId:c.id,schoolYearV190:'2026/27',title:'Reihe '+(i+1),\n   plan:[{id:c.id+'-u'+i,title:'Test',plannedDate:''}]})));\n  state.lessons=[];state.assessments=[\n   {id:'sort-a1',classId:'sort-r9',date:'2026-10-10',type:'Klassenarbeit',title:'Erledigt',\n    correctionV203:{returnedAt:'2026-11-01T11:00:00Z',expectedCount:26,makeupMode:'all',\n     makeups:[],correctionEvents:[]}},\n   {id:'sort-a2',classId:'sort-r7',date:'2026-11-13',type:'Klassenarbeit',title:'Offen'},\n   {id:'sort-a3',classId:'sort-m5',date:'2026-11-20',type:'Klassenarbeit',title:'Noch offen'}\n  ];\n  state.settings.sequencePlanningYearV190='2026/27';\n  view='sequences';modal=null;render();\n  const active=[...document.querySelectorAll('.v190-year-plan > .v290-course-plan .v290-course-summary strong')]\n   .map(x=>x.textContent.trim());\n  const ghost=document.querySelector('.v290-inactive-courses');\n  const ghostStored=ghost?.querySelectorAll('.v190-sequence-card').length;\n  const assessment=document.querySelector('.v290-assessment-fold');\n  const closed=!!assessment&&!assessment.open;\n  const activeExams=assessment?.querySelectorAll('.v290-active-exams .v188-assessment-card').length;\n  const returned=assessment?.querySelectorAll('.v290-returned-list .v188-assessment-card').length;\n  const returnedClosed=!assessment.querySelector('.v290-returned-exams').open;\n  const first=document.querySelector('.v190-year-plan > .v290-course-plan .v290-course-fold');\n  first.open=true;first.dispatchEvent(new Event('toggle'));\n  render();\n  const persistedOpen=document.querySelector('.v190-year-plan > .v290-course-plan .v290-course-fold')?.open===true;\n  const button=document.querySelector('[data-v290-return=\"sort-a2\"]');\n  if(!button)throw Error('Quick mark returned button not found');\n  button.click();await new Promise(r=>setTimeout(r,200));\n  const nowReturned=state.assessments.find(a=>a.id==='sort-a2')?.correctionV203?.returnedAt?.length>0;\n  const regrouped=document.querySelectorAll('.v290-returned-list .v188-assessment-card').length===2;\n  const saved=JSON.parse((await v186DbGet()).json).assessments.find(a=>a.id==='sort-a2')\n   ?.correctionV203?.returnedAt?.length>0;\n  const card=document.querySelector('.v290-active-exams .v188-assessment-card');\n  const action=card?.querySelector('.v188-assessment-actions');\n  const right=card?.getBoundingClientRect().right||0;\n  const controlsFit=[...(action?.querySelectorAll('button')||[])].every(b=>\n   b.getBoundingClientRect().right<=right+3);\n  return {active,ghostStored,ghostClosed:ghost&&!ghost.open,closed,activeExams,returned,\n   returnedClosed,persistedOpen,nowReturned,regrouped,saved,controlsFit};\n }finally{state=original;view=previousView;modal=previousModal;await saveState();render();}\n})()");
 if(condensed.active.join('|')!=='Mathematik 5f|Religion 5|Religion 6|Religion 7|Religion 9|Religion 11|Methoden 5f'||
   condensed.ghostStored!==4||!condensed.ghostClosed||!condensed.closed||
   condensed.activeExams!==2||condensed.returned!==1||!condensed.returnedClosed||
   !condensed.persistedOpen||!condensed.nowReturned||!condensed.regrouped||
   !condensed.saved||!condensed.controlsFit)
  throw Error('Compact year planner sorting and returned assessment failed: '+JSON.stringify(condensed));
 console.log('Compact planner: 7 sorted active courses, 4 preserved orphan units, exams folded, return toggle persisted, no overflow');

 const canonical=await evaluate("(async()=>{\n const prev=structuredClone(state),oldView=view,oldModal=modal;\n try{\n  state.classes=[\n   {id:'test-r6',subject:'Religion',name:'6',students:26},\n   {id:'test-r9',subject:'Religion',name:'9',students:25},\n   {id:'test-r7',subject:'Religion',name:'7',students:28}];\n  state.timetable=[\n   {id:'test-t6',weekday:2,slot:1,classId:'test-r6',kind:'course',period:'1'},\n   {id:'test-t9',weekday:2,slot:2,classId:'test-r9',kind:'course',period:'2'},\n   {id:'test-t7',weekday:5,slot:1,classId:'test-r7',kind:'course',period:'1'}];\n  state.lessons=[\n   {id:'test-l6',classId:'test-r6',date:'2026-11-10',slot:1,title:'Thema noch festlegen',status:'open'},\n   {id:'test-l9',classId:'test-r9',date:'2026-11-10',slot:2,title:'Thema noch festlegen',status:'open'},\n   {id:'test-l7',classId:'test-r7',date:'2026-11-13',slot:1,title:'Thema noch festlegen',status:'open'}];\n  state.sequences=[{id:'test-q9',classId:'test-r9',title:'Tod und Trauer',schoolYearV190:'2026/27',\n   plan:[{id:'test-u9',title:'Trost und Trauer',plannedDate:'2026-11-10',content:'Schwierige Erfahrungen'}]}];\n  state.assessments=[{id:'test-a7',classId:'test-r7',date:'2026-11-13',\n   title:'Martin Luther',type:'Klassenarbeit',files:[]}];\n  const ev={id:'test-visit',name:'Besuch des ESJ',impactV262:'substitution',\n    start:'2026-11-10',end:'2026-11-10',attendingClassIdsV289:[]};\n  state.schoolCalendarsV190={'2026/27':{customRanges:[ev],imports:[],useCurrentTimetable:true}};\n  state.settings.activeWeekStart='2026-11-09';\n  view='school-calendar';modal=null;render();\n  const checkbox=[...document.querySelectorAll('.v289-attending label')].find(l=>l.textContent.includes('Religion 6'))?.querySelector('input');\n  if(!checkbox)throw Error('Excursion attendance checkbox missing');\n  checkbox.checked=true;checkbox.dispatchEvent(new Event('change',{bubbles:true}));\n  await new Promise(r=>setTimeout(r,200));\n  view='week';render();\n  const l6=state.lessons.find(l=>l.id==='test-l6'),\n    l9=state.lessons.find(l=>l.id==='test-l9'),\n    l7=state.lessons.find(l=>l.id==='test-l7');\n  const types=[l6,l9,l7].map(l=>SchulcockpitLessonContextV289.context(l).type);\n  const sub=SchulcockpitSubstitutionV262.candidates('2026/27');\n  const sub9=sub.some(e=>e.classId==='test-r9'&&e.date==='2026-11-10'),\n    sub6=sub.some(e=>e.classId==='test-r6'&&e.date==='2026-11-10');\n  modal={type:'lesson',id:'test-l7'};render();\n  const modalReady=!!document.querySelector('[data-v289-exam-check=\"prepared\"]')&&\n   !!document.querySelector('[data-v289-exam-edit=\"test-a7\"]')&&\n   !!document.querySelector('[data-v289-exam-eval=\"test-a7\"]');\n  const readyInput=document.querySelector('[data-v289-exam-check=\"prepared\"]');\n  readyInput.checked=true;readyInput.dispatchEvent(new Event('change',{bubbles:true}));\n  await new Promise(r=>setTimeout(r,200));\n  const persisted=JSON.parse((await v186DbGet()).json);\n  const persistCheck=persisted.assessments?.find(a=>a.id==='test-a7')?.preparationV289?.prepared===true;\n  const word=await SchulcockpitSubstitutionV262.docx(\n    sub.find(e=>e.classId==='test-r9'),\n    {topic:'Trost und Trauer',minutes:45,instructions:'Bearbeite Arbeitsblatt 1.',\n     teacherNote:'Einzelarbeit',materialNote:'AB im Fach'});\n  const zip=await JSZip.loadAsync(word);\n  const doc=await zip.file('word/document.xml').async('string');\n  modal=null;\n  return {attending:ev.attendingClassIdsV289.includes('test-r6'),types,\n   titles:[l6.title,l9.title,l7.title],sub9,sub6,modalReady,persistCheck,\n   word:doc.toLowerCase().includes('liebe vertretungslehrkraft')&&doc.includes('Bearbeite Arbeitsblatt 1.')};\n }finally{\n  state=prev;view=oldView;modal=oldModal;await saveState();render();\n }\n})()");
 if(!canonical.attending||canonical.types.join(',')!=='excursion,substitution,exam'||
    !canonical.titles[0].includes('Besuch des ESJ')||
    !canonical.titles[1].includes('Trost und Trauer')||
    !canonical.titles[2].includes('Martin Luther')||
    !canonical.sub9||canonical.sub6||!canonical.modalReady||
    !canonical.persistCheck||!canonical.word)
  throw Error('Exam, substitute and excursion synchrony failed: '+JSON.stringify(canonical));
 console.log('Canonical week: 10 Nov trip for R6, substitution+planned topic for R9, exam+checklist for R7, editable Word document');

 const weekfillV288=await evaluate("(async()=>{\n const saved=structuredClone(state),priorView=view,priorModal=modal;\n try{\n  const week='2026-11-16';\n  const data=[\n   ['math','Mathematik','5f',1,1],['rel6','Religion','6',2,1],\n   ['method','Methoden','5f',2,2],['rel9','Religion','9',2,3],\n   ['math2','Mathematik','5f',3,2],['rel11','Religion','11',3,1],\n   ['rel8','Religion','8',4,3],['rel5','Religion','5',4,4],\n   ['rel7','Religion','7',5,2]\n  ];\n  state.timetable=[];state.classes=[];state.sequences=[];state.lessons=[];\n  for(const [id,subject,name,weekday,slot]of data){\n   const cid=id==='math2'?'math':id;\n   if(!state.classes.some(c=>c.id===cid))state.classes.push({id:cid,name,subject,students:27});\n   state.timetable.push({id:'tt-'+id,classId:cid,weekday,slot,period:slot+'. Block',kind:'course'});\n  }\n  state.settings.activeWeekStart=week;\n  state.schoolCalendarsV190={'2026/27':{\n   customRanges:[],imports:[],useCurrentTimetable:true,createdAt:new Date().toISOString(),\n   courseRangesV261:[{id:'cancel-rel11',classId:'rel11',start:'2026-11-18',\n    end:'2026-11-18',name:'Fachunterricht entfällt',impactV262:'closure'}]\n  }};\n  state.sequences.push({id:'math-seq',classId:'math',title:'Grundrechenarten',\n   schoolYearV190:'2026/27',orderV190:1,startDate:'2026-11-09',\n   plan:[{id:'math-monday',title:'Rechengesetze 1',plannedDate:'2026-11-16'},\n    {id:'math-wednesday',title:'Dividieren sichern',plannedDate:'2026-11-18'}]});\n  state.lessons.push(\n   {id:'original-method',classId:'method',kind:'course',date:'2026-11-17',slot:2,\n    status:'planned',title:'Kooperation',phasePlan:[{title:'Eigene Planung'}],\n    materials:['existing-material'],printPlan:[{id:'existing-print',needed:true}]},\n   {id:'original-rel5',classId:'rel5',kind:'course',date:'2026-11-19',slot:4,\n    title:'Wichtige Stunde',status:'open',phasePlan:[]},\n   {id:'original-rel7',classId:'rel7',kind:'course',date:'2026-11-20',slot:2,\n    title:'Übung',status:'open',phasePlan:[]});\n  const originals=structuredClone(state.lessons);\n  view='week';modal=null;render();\n  const first=state.lessons.filter(l=>l.date>=week&&l.date<='2026-11-20');\n  const onscreen=(document.querySelector('.page')?.textContent||'').includes('Rechengesetze 1')&&\n   (document.querySelector('.page')?.textContent||'').includes('Dividieren sichern');\n  const note=document.querySelector('.v288-week-closures')?.textContent||'';\n  const math=first.find(x=>x.classId==='math'&&x.date===week);\n  const mathWed=first.find(x=>x.classId==='math'&&x.date==='2026-11-18');\n  const originalPreserved=originals.every(original=>\n   JSON.stringify(state.lessons.find(x=>x.id===original.id))===JSON.stringify(original));\n  render();\n  const secondCount=state.lessons.length;\n  view='prep';render();\n  const mondayCount=currentWeekLessons().filter(x=>x.kind==='course').length;\n  await saveState();\n  const persisted=JSON.parse((await v186DbGet()).json);\n  return {count:first.length,onscreen,mondayCount,secondCount,\n   math:math?.title,mathUnit:math?.planReference?.unitId,\n   wed:mathWed?.title,excludedRel11:!first.some(l=>l.classId==='rel11'),\n   note:note.includes('Fachunterricht entfällt')&&note.includes('Religion'),\n   preserved:originalPreserved,stored:persisted.lessons.filter(l=>l.date>=week&&l.date<='2026-11-20').length};\n }finally{\n  state=saved;view=priorView;modal=priorModal;\n  await saveState();render();\n }\n})()");
 if(weekfillV288.count!==8||weekfillV288.onscreen!==true||
    weekfillV288.mondayCount!==8||weekfillV288.secondCount!==8||
    weekfillV288.math!=='Rechengesetze 1'||weekfillV288.mathUnit!=='math-monday'||
    weekfillV288.wed!=='Dividieren sichern'||!weekfillV288.excludedRel11||
    !weekfillV288.note||!weekfillV288.preserved||weekfillV288.stored!==8)
   throw Error('KW47 cards did not correctly materialize from timetable and sequence: '+JSON.stringify(weekfillV288));
 console.log('KW47 auto-generated 5 missing lessons in week and Monday mode; preserved 3 prepared ones and course cancellation');

 const roster=await evaluate('(()=>{const b=document.querySelector("[data-v248-nav]");if(!b)return {button:false};b.click();return {button:true,title:document.querySelector(".topbar h1")?.textContent||""};})()');
 if(!roster.button||!roster.title.includes('Klassenlisten'))throw Error('Private roster navigation failed: '+JSON.stringify(roster));
 console.log('Roster navigation passed');
 const dropCheck=await evaluate("(async()=>{\n view='focus';render();\n const transfer=document.querySelector('#v264-file');\n if(!transfer||!transfer.closest('.sc-drop-zone-v284'))throw Error('Browser transfer lacks drop field');\n const holder=document.createElement('div');holder.id='smoke-drop-v284';\n holder.innerHTML='<label>Mock import<input id=\"smoke-drop-json\" type=\"file\" accept=\".json\"></label>'+\n  '<input type=\"file\" id=\"smoke-drop-binary\" accept=\".pdf\" multiple>';\n document.body.append(holder);\n const json=holder.querySelector('#smoke-drop-json'),pdf=holder.querySelector('#smoke-drop-binary');\n let changed=0;json.addEventListener('change',()=>changed++);\n SchulcockpitDropV284.enhance();\n const label=json.closest('label');\n if(!label.classList.contains('sc-drop-zone-v284'))throw Error('label has no dropzone');\n const make=(name,type='application/octet-stream')=>new File(['safe synthetic'],name,{type});\n function drop(zone,files){\n  const dt=new DataTransfer();for(const f of files)dt.items.add(f);\n  return zone.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));\n }\n drop(label,[make('fake.pdf','application/pdf')]);\n const rejected=json.files.length===0&&changed===0&&label.textContent.includes('Dateityp nicht passend');\n drop(label,[make('plans.json','application/json')]);\n const accepted=json.files.length===1&&json.files[0].name==='plans.json'&&changed===1;\n const z=pdf.nextElementSibling;\n const multi=z?.classList.contains('sc-drop-field-v284');\n drop(z,[make('a.pdf','application/pdf'),make('b.pdf','application/pdf')]);\n const multiple=pdf.files.length===2;\n drop(transfer.closest('label'),[make('schulcockpit-backup.json','application/json')]);\n const jsonExplained=transfer.files.length===0&&transfer.closest('label').textContent.includes('keine vollständige Browserumzugs-Sicherung');\n drop(transfer.closest('label'),[make('Schulcockpit_Browserumzug_2026-11-06.scbackup')]);\n const encrypted=transfer.files.length===1&&transfer.files[0].name.endsWith('.scbackup');\n holder.remove();\n return {rejected,accepted,multi,multiple,jsonExplained,encrypted,unchanged:state.classes.length===0};\n})()");
 if(Object.values(dropCheck).some(x=>x!==true))
   throw Error('General Finder drag/drop must preserve import handlers and reject JSON browser backup: '+JSON.stringify(dropCheck));
 console.log('Universal file drop: original change listeners, multi-file, wrong .json vs .scbackup and no data writes passed');
 // No production data: create a synthetic Fachkurs in the disposable browser profile.
 const synthetic=await evaluate('(async()=>{state.classes.push({id:"smoke-m5f",name:"5f",subject:"Mathematik",students:27});await saveState();view="rosters";modal=null;render();document.querySelector("[data-v248-nav]")?.click();return {course:!!cls("smoke-m5f"),view};})()');
 if(!synthetic.course)throw Error('Cannot seed synthetic Fachkurs');
 await poll(async()=>evaluate('!!document.querySelector("[data-v248-add]")'),'local class roster input');
 await evaluate('(()=>{document.querySelector("#v248-names").value="Smoke Kind Eins\\nSmoke Kind Zwei";document.querySelector("[data-v248-add]").click();return true;})()');
 const privateData=await poll(async()=>{
  const d=await evaluate('(async()=>{const r=await v200PrivateGet(v235Key("smoke-m5f"));return {n:r?.roster?.length||0,leak:JSON.stringify(state).includes("Smoke Kind Eins")};})()');
  return d.n===2?d:null;
 },'two private local pupils');
 if(privateData.leak)throw Error('Student names leaked into public planner state');
 console.log('Private roster stored without exposing names to main app state');
 const firefoxTargetOwn=await evaluate("(async()=>{\n const report=await SchulcockpitTransferV264.destinationReport();\n view='focus';modal=null;render();\n const button=document.querySelector('[data-v286-check]');\n if(!button)return {button:false,report};\n button.click();\n for(let i=0;i<25&&!document.getElementById('v264-status')?.textContent.includes('gespeicherte Daten');i++)\n  await new Promise(r=>setTimeout(r,50));\n const status=document.getElementById('v264-status')?.textContent||'';\n let guarded=false;\n try{await SchulcockpitTransferV264.requireEmptyTarget();}\n catch(err){guarded=String(err.message).includes('about:profiles');}\n view='rosters';modal=null;render();\n return {button:!!button,safe:report.safe,problems:report.problems,\n  warned:status.includes('gespeicherte Daten'),guarded};\n})()");
 if(!firefoxTargetOwn.button||firefoxTargetOwn.safe||!firefoxTargetOwn.warned||
    !firefoxTargetOwn.guarded||!firefoxTargetOwn.problems.length)
  throw Error('Existing Firefox work was not blocked/explained safely: '+JSON.stringify(firefoxTargetOwn));
 console.log('Already populated Firefox profile shows privacy-safe diagnostic and blocks overwrite');

 const backupProof=await evaluate("(async()=>{\n const fakeKey='smoke-backup-blob-v284';\n await fileStorePut(fakeKey,new File(['SYNTHETIC BLOB'], 'Smoke-Worksheet.pdf',{type:'application/pdf'}));\n const prev=downloadBlob, pass='safe test password 2026',captured={};\n try{\n  downloadBlob=(name,blob)=>{captured.name=name;captured.blob=blob;};\n  captured.summary=await SchulcockpitTransferV264.exportAll(pass);\n }finally{downloadBlob=prev;}\n const wrapper=JSON.parse(await captured.blob.text());\n const decode=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));\n const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),\n  'PBKDF2',false,['deriveKey']);\n const aes=await crypto.subtle.deriveKey({name:'PBKDF2',salt:decode(wrapper.salt),\n  iterations:260000,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['decrypt']);\n const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(wrapper.iv)},aes,\n  decode(wrapper.ciphertext));\n const zip=await JSZip.loadAsync(raw);\n const manifest=JSON.parse(await zip.file('manifest.json').async('string'));\n const names=manifest.databases.map(d=>d.name);\n const store=name=>manifest.databases.find(d=>d.name===name)?.stores||[];\n const file=store('schulcockpit-files-v1').flatMap(s=>s.records||[])\n  .find(r=>r.key===fakeKey);\n const privateRecord=store('schulcockpit-assessment-private-v1').flatMap(s=>s.records||[])\n  .some(r=>r.assessmentId===v235Key('smoke-m5f')&&r.roster?.length===2);\n const plan=store('schulcockpit-state-v2').flatMap(s=>s.records||[]).some(r=>r.id==='main');\n const fileBytes=file?.blob?.path?await zip.file(file.blob.path)?.async('string'):'';\n return {filename:captured.name,encrypted:!!wrapper.ciphertext&&!JSON.stringify(wrapper).includes('Smoke Kind Eins'),\n  count:captured.summary.recordCount,\n  allDbs:names.length===3&&names.includes('schulcockpit-state-v2')&&\n   names.includes('schulcockpit-files-v1')&&names.includes('schulcockpit-assessment-private-v1'),\n  privateRecord,plan,fileBytes};\n})()");
 if(!backupProof.filename.endsWith('.scbackup')||!backupProof.encrypted||
   !backupProof.allDbs||!backupProof.plan||!backupProof.privateRecord||
   backupProof.fileBytes!=='SYNTHETIC BLOB'||backupProof.count<3)
   throw Error('Full encrypted backup must include file blobs, planning and private records: '+JSON.stringify(backupProof));
 console.log('Encrypted .scbackup contains all 3 IndexedDB stores incl. private roster and binary teaching file');
 await poll(async()=>evaluate('!!document.querySelector("[data-v251-create]")'),'master class creation button');
 await evaluate('(()=>{document.querySelector("#v251-label").value="5f 2026/27";document.querySelector("#v251-import").value="smoke-m5f";document.querySelector("[data-v251-create]").click();return true;})()');
 const masterRecord=await poll(async()=>{
  const x=await evaluate('(async()=>{const idx=await v200PrivateGet(SC_MASTERCLASS_CORE_V251.INDEX_KEY);if(idx?.schema!=="schulcockpit.private-master-index.v1"||!idx.classes?.length)return null;const rec=await v200PrivateGet(SC_MASTERCLASS_CORE_V251.ID(idx.classes[0].id));return {id:idx.classes[0].id,count:rec?.roster?.length||0,leak:JSON.stringify(state).includes("Smoke Kind Eins")};})()');
  return x?.count===2?x:null;
 },'creating private master class from existing course');
 if(masterRecord.leak)throw Error('Master class pupils leaked to public state');
 await evaluate('(()=>{document.querySelector("#v251-names").value="Smoke Kind Drei";document.querySelector("[data-v251-add]").click();return true;})()');
 await poll(async()=>{
  const x=await evaluate('(async()=>{const idx=await v200PrivateGet(SC_MASTERCLASS_CORE_V251.INDEX_KEY);return (await v200PrivateGet(SC_MASTERCLASS_CORE_V251.ID(idx.classes[0].id)))?.roster?.length||0;})()');
  return x===3;
 },'adding one master pupil');
 await evaluate('(()=>{window.__testAlerts=[];window.confirm=()=>true;window.alert=msg=>window.__testAlerts.push(String(msg));document.querySelector("#v251-course").value="smoke-m5f";document.querySelector("[data-v251-sync]").click();return true;})()');
 const synchronized=await poll(async()=>{
  const x=await evaluate('(async()=>{const r=await v200PrivateGet(v235Key("smoke-m5f"));return {n:r.roster.length,ids:r.roster.map(s=>s.id),linked:r.roster.filter(s=>s.masterStudentIdV251).length,publicLeak:JSON.stringify(state).includes("Smoke Kind Drei")};})()');
  return x.n===3&&x.linked===3?x:null;
 },'explicit sync of Stammklasse to the existing course');
 const reported=await evaluate('window.__testAlerts||[]');
 if(reported.some(msg=>msg.startsWith('Stammklasse:')))throw Error('Master class sync error: '+reported.join(' | '));
 if(synchronized.publicLeak)throw Error('Synchronized private names leaked to public state');
 console.log('Stammklasse creation and safe course sync passed');
 const secure=await evaluate('(async()=>{const api=SC_PRIVATE_MASTER_BACKUP_V253;const id="demo-restore-only";const payload={schema:"schulcockpit.private-master-backup.v1",classes:[{id,label:"Restored Smoke",record:{id,assessmentId:SC_MASTERCLASS_CORE_V251.ID(id),schema:"schulcockpit.private-master-class.v1",roster:[{id:"demo1",name:"Private Smoke Name"}]}}]};const encrypted=await api.encrypt(payload,"12character-pass");const serialized=JSON.stringify(encrypted);let wrong=false;try{await api.decrypt(encrypted,"wrong-password")}catch(_){wrong=true}const recovered=await api.decrypt(encrypted,"12character-pass");const result=await api.restore(recovered);let blocked=false;try{await api.restore(recovered)}catch(_){blocked=true}const found=await v200PrivateGet(SC_MASTERCLASS_CORE_V251.ID(id));return {encrypted:!serialized.includes("Private Smoke Name"),wrong,blocked,result,found:found.roster.length,leak:JSON.stringify(state).includes("Private Smoke Name")};})()');
 if(!secure.encrypted||!secure.wrong||!secure.blocked||secure.result!==1||secure.found!==1||secure.leak)
   throw Error('Masterclass encrypted backup/restore failed: '+JSON.stringify(secure));
 console.log('Encrypted backup, wrong password and collision-safe restore passed');


 const firstOpen=await evaluate('(()=>{view="sequences";render();v184Open("smoke-m5f");return {modal:modal?.type,course:v184Flow.courseId};})()');
 if(firstOpen.modal!=='sequenceAiV184'||firstOpen.course!=='smoke-m5f')throw Error('Sequence wizard unavailable: '+JSON.stringify(firstOpen));
 const optionalCurriculum=await evaluate(`(async()=>{
  // Valid Math 5 plan with a deliberately UNASSIGNED school-curriculum topic.
  v184Flow.newTitle='Grundrechenarten II';v184Flow.curriculumTopicIdV202='';
  render();
  const selected=document.querySelector('#v202-flow-topic')?.value;
  const suggestion=!!v202SuggestedTopic(cls('smoke-m5f'),'Grundrechenarten II');
  const prompt=v184Prompt();
  const raw={schema:'schulcockpit.sequence.v1',courseId:'smoke-m5f',
   sequence:{title:'Smoke – ohne Curriculum',startDate:'',endDate:'',hours:'1',goal:'Division verstehen',notes:''},
   units:[{plannedDate:'',title:'Division handelnd erkunden',hours:'1',content:'Darstellungen vergleichen',
    objective:'Rechenwege erläutern',notes:'',materials:[]}]};
  const pkg=v184Normalize(raw);
  v184Flow.pkg=pkg;
  const out=await v184Apply(),q=seq(out.qid);
  const status={selected,suggestion,promptContainsOpen:prompt.includes('Zuordnung bewusst noch offen'),
   forced:prompt.includes('VERBINDLICHE CURRICULARE KOMPETENZEN'),
   units:pkg.units.length,ids:pkg.units[0].competencyIdsV202||[],
   saved:!!q?.plan?.length,linked:!!v202LinkedTopic(q),title:q?.title||''};
  state.sequences=state.sequences.filter(x=>x.id!==out.qid);await saveState();
  v184Open('smoke-m5f');
  return status;
 })()`);
 if(optionalCurriculum.selected!==''||!optionalCurriculum.suggestion||
   !optionalCurriculum.promptContainsOpen||optionalCurriculum.forced||
   optionalCurriculum.units!==1||optionalCurriculum.ids.length||
   !optionalCurriculum.saved||optionalCurriculum.linked)
   throw Error('Unassigned curriculum must be a valid, persisted AI sequence: '+JSON.stringify(optionalCurriculum));
 console.log('Optional curriculum: no forced suggestion, no invented IDs, sequence imported and saved');
 await sleep(300);
 await evaluate('(()=>{v184Flow.step=1;v184Flow.prompt="SMOKE PROMPT";v184Flow.raw="SMOKE ANSWER";render();return true;})()');
 await sleep(850);
 await evaluate('(()=>{modal=null;view="rosters";render();v184Open("smoke-m5f");return true;})()');
 const sameTab=await evaluate('({step:v184Flow.step,prompt:v184Flow.prompt,raw:v184Flow.raw})');
 if(sameTab.step!==1||sameTab.prompt!=='SMOKE PROMPT'||sameTab.raw!=='SMOKE ANSWER')
  throw Error('Sequence wizard lost draft when navigating: '+JSON.stringify(sameTab));
 console.log('Same-tab sequence wizard recovery passed');

 await evaluate('(()=>{modal=null;view="focus";render();const btn=document.querySelector("[data-action=setup-import]");if(!btn)throw Error("setup button missing");btn.click();const el=document.getElementById("setup-import-text");if(!el)throw Error("setup text missing");el.value="SMOKE SETUP DRAFT";el.dispatchEvent(new Event("input",{bubbles:true}));return true;})()');
 await sleep(700);
 await evaluate('(()=>{modal=null;view="rosters";render();return true;})()');
 const lessonSeed=await evaluate('(async()=>{state.lessons.push({id:"smoke-wizard",classId:"smoke-m5f",date:"2026-11-18",slot:2,period:"2",title:"Synthetic mathematics lesson",materials:[],printPlan:[],phasePlan:[],slides:[],prepTasks:[],status:"open"});await saveState();openWizardV14("smoke-wizard",3);wizardV14.step=3;wizardV14.raw="SMOKE WIZARD IMPORT TEXT";render();return {view,step:wizardV14.step};})()');
 if(lessonSeed.view!=='assistant'||lessonSeed.step!==3)throw Error('Four-step lesson wizard did not open');
 await sleep(1050);
 await evaluate('(()=>{view="rosters";render();return true;})()');
 await send('Page.reload',{ignoreCache:false});
 // CDP acknowledges the reload request before navigation has fully committed.
 await sleep(600);
 await poll(async()=>{
  const r=await evaluate('({done:typeof v186Ready!=="undefined"&&v186Ready,privateReady:typeof v200PrivateGet==="function"&&typeof v235Key==="function",loading:!!document.querySelector("#sc-v186-load")})');
  return r.done&&r.privateReady&&!r.loading;
 },'reload of persistent IndexedDB data',30000);
 const afterReload=await evaluate('(async()=>{const r=await v200PrivateGet(v235Key("smoke-m5f"));return {course:!!cls("smoke-m5f"),students:r?.roster?.length||0,publicNames:JSON.stringify(state).includes("Smoke Kind Eins")};})()');
 if(!afterReload.course||afterReload.students!==3||afterReload.publicNames)
  throw Error('Persisted Fachkurs / private roster reload failed: '+JSON.stringify(afterReload));
 await evaluate('(()=>{v184Open("smoke-m5f");return true;})()');
 const restored=await poll(async()=>{
  const x=await evaluate('({step:v184Flow.step,raw:v184Flow.raw,prompt:v184Flow.prompt})');
  return x.step===1?x:null;
 },'sequence wizard after browser restart');
 if(restored.prompt!=='SMOKE PROMPT'||restored.raw!=='SMOKE ANSWER')
  throw Error('Persisted sequence draft lost after reload: '+JSON.stringify(restored));
 console.log('Browser restart: private roster and sequence draft recovered');
 const setupDraft=await evaluate('(()=>{document.querySelector("[data-action=setup-import]").click();return modal?.type==="setup-import";})()');
 if(!setupDraft)throw Error('Setup import modal did not reopen');
 const draftText=await poll(async()=>evaluate('document.getElementById("setup-import-text")?.value||""'),'restoring setup import raw text');
 if(draftText!=='SMOKE SETUP DRAFT')throw Error('Setup import draft not recovered');
 console.log('Setup import resumed after browser restart');
 await evaluate('(()=>{openWizardV14("smoke-wizard",1);return true;})()');
 const wizardRestored=await poll(async()=>{
  const x=await evaluate('({view,step:wizardV14.step,raw:wizardV14.raw,lessonId:wizardV14.lessonId})');
  return x.step===3&&x.raw==='SMOKE WIZARD IMPORT TEXT'?x:null;
 },'restoring lesson-to-PowerPoint assistant after browser restart');
 if(wizardRestored.lessonId!=='smoke-wizard'||wizardRestored.view!=='assistant')
  throw Error('Lesson wizard recovery selected wrong lesson: '+JSON.stringify(wizardRestored));
 console.log('Four-step lesson-to-PowerPoint wizard recovered after browser restart');


 const planning=await evaluate('(()=>{view="sequences";modal=null;render();return {sidebar:!!document.querySelector(".sidebar nav"),year:!!document.querySelector(".v190-year-plan")};})()');
 if(!planning.sidebar||!planning.year)throw Error('Year planning page failed: '+JSON.stringify(planning));
 console.log('Year planning page passed');
 const annual=await evaluate('(()=>{const b=document.querySelector("[data-v236-open=\\\"smoke-m5f\\\"]")||[...document.querySelectorAll("[data-v236-open]")].find(x=>x.dataset.v236Open==="smoke-m5f");if(!b)return {missingButton:true,n:document.querySelectorAll("[data-v236-open]").length};b.click();return {modal:modal?.type,dialog:!!document.querySelector(".v236-modal")};})()');
 if(!annual.dialog||annual.modal!=='annualV236')throw Error('Annual modal failed: '+JSON.stringify(annual));
 console.log('Annual modal passed',annual);
 // Each exam must be editable independently: one selected topic never triggers
 // the former Mathe-5 Grundrechenarten-II/Statistics rewrite.
 const planned=await evaluate('(async()=>{const y="2026/27",key="smoke-m5f|"+y;state.yearAssessmentPlansV244=state.yearAssessmentPlansV244||{};state.yearAssessmentPlansV244[key]=[SC_YEAR_RULES_V244.tidy({id:"a1",half:1,type:"klassenarbeit",mode:"papier",status:"offen",topic:""}),SC_YEAR_RULES_V244.tidy({id:"fixed",half:1,type:"klassenarbeit",status:"fest",topic:"Grundrechenarten I",confirmedDate:"2026-10-30",assessmentId:"existing-fixed"})];await saveState();modal=null;render();const b=[...document.querySelectorAll("[data-v236-rules]")].find(x=>x.dataset.v236Rules==="smoke-m5f");if(!b)return {found:false};b.click();return {found:true,topics:document.querySelectorAll("[data-v245-topic]").length,oldHelper:!!document.querySelector("[data-v252-propose]"),wishFields:[...document.querySelectorAll("[data-v244-field]")].filter(e=>e.dataset.v244Field.endsWith("|proposedDate")).length};})()');
 if(!planned.found||!planned.topics||planned.oldHelper||planned.wishFields)throw Error('General exam editor invalid: '+JSON.stringify(planned));
 const changed=await evaluate('(()=>{window.confirm=()=>true;window.__testAlerts=[];window.alert=x=>window.__testAlerts.push(String(x));const el=document.querySelector("[data-v245-topic]");el.value="primary";el.dispatchEvent(new Event("change",{bubbles:true}));return {summary:el.closest("details")?.querySelector("summary")?.textContent,draft:state.yearAssessmentPlansV244["smoke-m5f|2026/27"][0].primaryTopicIds.length};})()');
 if(!changed.summary.includes("1 ausgewählt")||changed.draft!==0)
   throw Error('Selected topic not reflected in editable draft: '+JSON.stringify(changed));
 await evaluate('(()=>{document.querySelector("[data-v236-save]").click();return true;})()');
 const saved=await poll(async()=>{
  const x=await evaluate('(()=>{const a=state.yearAssessmentPlansV244["smoke-m5f|2026/27"]||[];return {count:a.length,fixed:a.find(z=>z.id==="fixed"),work:a.find(z=>z.id==="a1"),poster:a.find(z=>z.type==="fachleistung")};})()');
  return x.work?.primaryTopicIds.length===1?x:null;
 },'saving a curriculum topic selection');
 if(saved.count!==2||saved.fixed.confirmedDate!=='2026-10-30'||
   saved.work.proposedDate||saved.work.supplementaryTopicIds.length||saved.poster)
   throw Error('Exam editor changed unrelated assessments: '+JSON.stringify(saved));
 console.log('Independent exam topic saved; no automatic topic or date conversion');
 const milestone=await evaluate('(()=>{const nav=document.querySelector("[data-v259-nav]");if(!nav)return {nav:false};nav.click();const date=document.querySelector("#v259-deadline-date"),title=document.querySelector("#v259-deadline-title");if(!date||!title)return {nav:true,form:false};date.value="2027-01-20";title.value="Notenschluss";document.querySelector("[data-v259-add]").click();return {nav:true,form:true,page:view};})()');
 if(!milestone.nav||!milestone.form||milestone.page!=='school-calendar')throw Error('Separate school calendar/milestone control missing: '+JSON.stringify(milestone));
 await poll(async()=>evaluate('(state.yearMilestonesV257?.["2026/27"]||[]).some(x=>x.title==="Notenschluss")'),
   'saving school milestone');
 console.log('School milestone persists separately from blocked teaching days');
 const courseAbsence=await evaluate('(()=>{const cid="smoke-m5f",other="smoke-religion-8",date="2027-05-25";state.classes.push({id:other,name:"8a",subject:"Religion",students:0});state.timetable.push({id:"smoke-course-absence-a",classId:cid,weekday:2,slot:6,period:"6"},{id:"smoke-course-absence-b",classId:other,weekday:2,slot:7,period:"7"});view="school-calendar";render();const form=document.querySelector("[data-v261-add]");if(!form)return {form:false};const before={a:v190CourseSlots(cid,"2026/27").some(x=>x.date===date),b:v190CourseSlots(other,"2026/27").some(x=>x.date===date),lessons:state.lessons.length};document.querySelector("#v261-course").value=cid;document.querySelector("#v261-start").value=date;document.querySelector("#v261-reason").value="Exkursion";form.click();return {form:true,before};})()');
 if(!courseAbsence.form||!courseAbsence.before.a||!courseAbsence.before.b)throw Error('Course cancellation UI/initial timetable invalid: '+JSON.stringify(courseAbsence));
 const courseCheck=await poll(async()=>{
  const x=await evaluate('(()=>{const cal=v190Calendar("2026/27"),date="2027-05-25";return {record:(cal.courseRangesV261||[]).find(x=>x.classId==="smoke-m5f"&&x.start===date),a:v190CourseSlots("smoke-m5f","2026/27").some(x=>x.date===date),b:v190CourseSlots("smoke-religion-8","2026/27").some(x=>x.date===date),lessons:state.lessons.length};})()');
  return x.record?x:null;
 },'saving a course-only absence');
 if(courseCheck.a||!courseCheck.b||courseCheck.lessons!==courseAbsence.before.lessons)
   throw Error('Course absence affected the wrong timetable or lessons: '+JSON.stringify(courseCheck));
 console.log('Course-only absence kept another subject course untouched');
 const reserved=await evaluate('(()=>{state.timetable.push({id:"smoke-stat-slot",classId:"smoke-m5f",weekday:2,slot:2,period:"2"});const list=v190CourseSlots("smoke-m5f","2026/27").filter(x=>x.date>iso(new Date()));if(!list.length)throw Error("No future synthetic slot");const date=list[0].date;state.yearAssessmentPlansV244["smoke-m5f|2026/27"].push(SC_YEAR_RULES_V244.tidy({id:"smoke-reserved",type:"klassenarbeit",status:"vorschlag",proposedDate:date,topic:"Reservierter Prüfungstermin"}));return date;})()');
 const scheduled=await evaluate('(async()=>{const existing=cleanPlanUnitV10({title:"Statistik Grundfertigkeiten",plannedDate:"2026-10-21"});const project=Array.from({length:6},(_,i)=>({...cleanPlanUnitV10({title:"Datenprojekt "+(i+1),plannedDate:""}),projectTagV250:"statistics-poster-v250"}));state.sequences.push({id:"smoke-stat-seq",classId:"smoke-m5f",title:"Statistik und Runden",schoolYearV190:"2026/27",orderV190:0,startDate:"2026-10-21",plan:[existing,...project]});await saveState();modal={type:"sequence",id:"smoke-stat-seq"};view="sequences";render();const b=document.querySelector("[data-v254-preview]");if(!b)return {button:false};b.click();return {button:true,apply:!!document.querySelector("[data-v254-apply]"),preview:!!document.querySelector(".modal-body ol")};})()');
 if(!scheduled.button||!scheduled.apply||!scheduled.preview)
  throw Error('Calendar-driven project preview unavailable: '+JSON.stringify(scheduled));
 await evaluate('(()=>{window.confirm=()=>true;document.querySelector("[data-v254-apply]").click();return true;})()');
 const projectResult=await poll(async()=>{
  const p=await evaluate('(()=>{const q=seq("smoke-stat-seq");return {start:q.startDate,dates:q.plan.filter(u=>u.projectTagV250==="statistics-poster-v250").map(u=>u.plannedDate),original:q.plan[0].plannedDate};})()');
  return p.dates.length===6&&p.dates.every(Boolean)?p:null;
 },'storing six conflict-free statistics dates');
 if(projectResult.original!=='2026-10-21'||projectResult.start!=='2026-10-21'||
   new Set(projectResult.dates).size!==6||projectResult.dates.includes(reserved))
  throw Error('Unsafe project schedule assignment: '+JSON.stringify(projectResult));
 console.log('Six statistics project dates assigned without moving the existing lesson');

 const advance=await evaluate('(()=>{view="school-calendar";modal=null;render();const b=document.querySelector("[data-v190-calendar-recalc]");if(!b)return {button:false};const before=JSON.stringify([state.sequences,state.lessons]);b.click();return {button:true,title:b.textContent,modal:modal?.type,preview:!!document.querySelector("#v263-course"),unchanged:before===JSON.stringify([state.sequences,state.lessons])};})()');
 if(!advance.button||!advance.title.includes('Vorschau')||advance.modal!=='rescheduleV263'||!advance.preview||!advance.unchanged)
   throw Error('Calendar topic advancement bypassed safe preview: '+JSON.stringify(advance));
 const scoped=await evaluate('(()=>{let s=document.querySelector("#v263-course");if(!s){view="school-calendar";modal=null;render();document.querySelector("[data-v190-calendar-recalc]")?.click();s=document.querySelector("#v263-course");}if(!s)return {missing:true,modal:modal?.type,view};s.value="smoke-m5f";s.dispatchEvent(new Event("change"));return {modal:modal?.type,course:s.value,table:!!document.querySelector(".v263-movements")};})()');
 if(scoped.modal!=='rescheduleV263'||scoped.course!=='smoke-m5f')throw Error('Course-specific advancement unavailable: '+JSON.stringify(scoped));
 await evaluate('(()=>{modal=null;render();return true;})()');
 console.log('Topic advancement preview protected existing plans and allowed course selection');




 // Fully synthetic grade 8 assessment: prove the UI workflow and PDF summary.
 const grading=await evaluate(`(async()=>{
   state.classes.push({id:'smoke-r8',name:'8a',subject:'Religion',students:1});
   const a={id:'smoke-grading-v267',classId:'smoke-r8',title:'Synthetic test',type:'Klassenarbeit',
     date:'2026-10-20',gradeScaleV260:[95,80,65,50,25],
     evaluationV200:{schema:1,analysis:{schema:'schulcockpit.assessment-analysis.v1',
       taskOnlyV260:true,thresholds:{source:'not applicable'},competencies:[
         {id:'_TASK_SCORES_V260',text:'Aufgabenpunkte',source:'Intern'}],
       items:[
         {id:'A',label:'Lückentext',source:'classtime',regularMax:6,bonusMax:0,competencyId:'_TASK_SCORES_V260'},
         {id:'B',label:'Deutung',source:'classtime',regularMax:4,bonusMax:0,competencyId:'_TASK_SCORES_V260'}]}}};
   state.assessments=state.assessments||[];
   state.assessments.push(a);
   await saveState();
   await v200PrivatePut({assessmentId:a.id,roster:[{id:'p1',name:'Fiktives Testkind'}],
     scores:{p1:{A:4,B:3}},paperScores:{},bonusScores:{}});
   await v200OpenEval(a.id);
   v200Eval.step=3;render();
   if(!document.querySelector('[data-v267-task]'))throw Error('Partial-bonus editor absent in step 3');
   document.querySelector('[data-v267-task]').value='A';
   document.querySelector('[data-v267-max]').value='2';
   document.querySelector('[data-v267-description]').value='Lücken 2 und 4';
   document.querySelector('[data-v267-area]').value='Wissen und Deuten';
   document.querySelector('[data-v267-save-global]').click();
   return true;
 })()`);
 if(!grading)throw Error('Could not initialize new grading smoke');
 await poll(async()=>evaluate('!!state.assessments.find(a=>a.id==="smoke-grading-v267")?.evaluationV200?.analysis?.items?.[0]?.partialBonusV267'),'storing partial Classtime bonus policy');
 const individual=await evaluate(`(async()=>{
   v200Eval.step=4;render();
   if(!document.querySelector('[data-v267-exception-item]')||!document.querySelector('[data-v267-part="A"]'))throw Error('Student-only adjustments absent');
   document.querySelector('[data-v267-exception-item]').value='B';
   document.querySelector('[data-v267-exception-mode]').value='exclude';
   document.querySelector('[data-v267-save-exception]').click();
   return true;
 })()`);
 await poll(async()=>evaluate('(async()=>{const p=await v200PrivateGet("smoke-grading-v267");return p.gradingOverridesV267?.p1?.B?.mode==="exclude";})()'),'storing private student exception');
 const scored=await evaluate(`(async()=>{
   document.querySelector('[data-v267-part="A"]').value='2';
   document.querySelector('[data-v267-save-parts]').click();
   return true;
 })()`);
 await poll(async()=>evaluate('(async()=>{const p=await v200PrivateGet("smoke-grading-v267");return p.gradingOverridesV267?.p1?.A?.bonusEarned===2;})()'),'storing private gap scores');
 const graded=await evaluate(`(async()=>{
   v200Eval.step=5;render();
   const r=v200StudentReport(v200Eval.privateData,v200EvalAnalysis(),v200Eval.privateData.roster[0]);
   const pdf=v233ReportPages(r,state.assessments.find(a=>a.id==='smoke-grading-v267'),false);
   return {complete:r.complete,totalMax:r.totalMax,earned:r.totalAdjusted,grade:r.gradeV260,
      area:r.learningAreasV267?.[0]?.label,
      pdfText:pdf.flat().join(' ').includes('LERNBEREICHE'),
      sourceUnchanged:v200GetScore(v200Eval.privateData,'p1',v200EvalAnalysis().items[0])===4,
      privateOnly:!JSON.stringify(state).includes('Fiktives Testkind')};
 })()`);
 if(!graded.complete||graded.totalMax!==4||graded.earned!==4||graded.grade!=='1'||
    graded.area!=='Wissen und Deuten'||!graded.pdfText||!graded.sourceUnchanged||!graded.privateOnly)
   throw Error('Grade 8 individual scoring, privacy or PDF check failed: '+JSON.stringify(graded));
 console.log('Synthetic grade 8 bonus-gap/editor/individual-exception/points-PDF roundtrip passed');


 // Per-child bonus switch directly inside score matrix; no bonus points invented
 // for zero-mark answers. Every result and grade-7 competency must update live.
 const inlineStart=await evaluate("(async()=>{\n state.classes.push({id:'smoke-inline-r7',name:'7k',subject:'Religion',students:2});\n const a={id:'smoke-inline-grade7',classId:'smoke-inline-r7',title:'Fiktive Klassenarbeit',\n  type:'Klassenarbeit',date:'2026-10-20',evaluationV200:{schema:1,analysis:{\n   schema:'schulcockpit.assessment-analysis.v1',\n   thresholds:{reachedMinPct:70,partialMinPct:60},\n   competencies:[{id:'everyday',text:'Alltag erläutern'},{id:'ritual',text:'Bräuche beschreiben'}],\n   items:[{id:'T1',label:'Teilaufgabe 1',source:'classtime',regularMax:3,bonusMax:0,competencyId:'everyday'},\n    {id:'T2',label:'Teilaufgabe 2',source:'classtime',regularMax:3,bonusMax:0,competencyId:'everyday'},\n    {id:'T3',label:'Teilaufgabe 3',source:'paper',regularMax:4,bonusMax:0,competencyId:'ritual'}]\n  }}};\n state.assessments.push(a);\n await saveState();\n await v200PrivatePut({assessmentId:a.id,roster:[{id:'t1',name:'Fiktives Kind 1'},{id:'t2',name:'Fiktives Kind 2'}],\n  scores:{t1:{T1:0,T2:3},t2:{T1:0,T2:3}},\n  paperScores:{t1:{T3:0},t2:{T3:0}},bonusScores:{}});\n await v200OpenEval(a.id);v200Eval.step=4;render();\n const before=v200StudentReport(v200Eval.privateData,v200EvalAnalysis(),v200Eval.privateData.roster[0]);\n const first=document.querySelector('[data-v281-bonus=\"t1|T1\"]');\n return {first:!!first,readOnly:!!document.querySelector('[data-v210-grid-score=\"t1|T1\"]')?.readOnly,\n  previousMax:before.totalMax,originalStatus:before.competencies[0].status,\n  details:!!document.querySelector('[data-v281-detail]'),\n  privateOnly:!JSON.stringify(state).includes('Fiktives Kind 1')};\n})()");
 if(!inlineStart.first||!inlineStart.readOnly||inlineStart.previousMax!==10||
  inlineStart.originalStatus!=='noch nicht erreicht'||!inlineStart.details||!inlineStart.privateOnly)
   throw Error('Individual bonus matrix not ready: '+JSON.stringify(inlineStart));
 await evaluate('document.querySelector(\'[data-v281-bonus="t1|T1"]\').click()');
 await poll(async()=>evaluate('(async()=>{const p=await v200PrivateGet("smoke-inline-grade7");return p.gradingOverridesV267?.t1?.T1?.mode==="bonus";})()'),'persisting individual inline bonus');
 const inlineFirst=await evaluate("(async()=>{\n const p=await v200PrivateGet('smoke-inline-grade7');\n const r1=v200StudentReport(v200Eval.privateData,v200EvalAnalysis(),v200Eval.privateData.roster[0]);\n const r2=v200StudentReport(v200Eval.privateData,v200EvalAnalysis(),v200Eval.privateData.roster[1]);\n return {saved:p.gradingOverridesV267?.t1?.T1?.mode,\n  r1Max:r1.totalMax,r1Status:r1.competencies[0].status,\n  r2Max:r2.totalMax,r2Status:r2.competencies[0].status,\n  displayed:document.querySelector('[data-v281-result=\"t1\"]')?.textContent,\n  raw:v200GetScore(v200Eval.privateData,'t1',v200EvalAnalysis().items[0]),\n  pressed:document.querySelector('[data-v281-bonus=\"t1|T1\"]')?.getAttribute('aria-pressed')};\n})()");
 if(inlineFirst.r1Max!==7||inlineFirst.r1Status!=='erreicht'||
  inlineFirst.r2Max!==10||inlineFirst.r2Status!=='noch nicht erreicht'||
  inlineFirst.raw!==0||inlineFirst.pressed!=='true'||!inlineFirst.displayed.includes('/ 7'))
   throw Error('Individual bonus did not instantly recalculate only selected child: '+JSON.stringify(inlineFirst));
 await evaluate('document.querySelector(\'[data-v281-bonus="t1|T3"]\').click()');
 await poll(async()=>evaluate('(async()=>{const p=await v200PrivateGet("smoke-inline-grade7");return p.gradingOverridesV267?.t1?.T3?.mode==="bonus";})()'),'persisting second individual bonus');
 const inlineEnd=await evaluate("(async()=>{\n const p=await v200PrivateGet('smoke-inline-grade7');\n const r=v200StudentReport(v200Eval.privateData,v200EvalAnalysis(),v200Eval.privateData.roster[0]);\n v200Eval.step=5;render();\n const pdf=v233ReportPages(r,state.assessments.find(x=>x.id==='smoke-inline-grade7'),false);\n return {saved:p.gradingOverridesV267?.t1?.T3?.mode,\n  onlyBonus:r.competencies[1].bonusOnly,bonusMax:r.competencies[1].bonusMax,\n  bonusEarned:r.competencies[1].bonusEarned,onlyStatus:r.competencies[1].status,\n  max:r.totalMax,adjusted:r.totalAdjusted,preview:document.querySelector('.v281-only')?.textContent||'',\n  pdfIncludesBonus:pdf.flat().join('').includes('Bonus'),sourceScore:v200GetScore(v200Eval.privateData,'t1',\n   v200EvalAnalysis().items.find(x=>x.id==='T3'))};\n})()");
 if(inlineEnd.saved!=='bonus'||inlineEnd.max!==3||inlineEnd.adjusted!==3||
  !inlineEnd.onlyBonus||inlineEnd.bonusMax!==4||inlineEnd.bonusEarned!==0||
  inlineEnd.onlyStatus!==''||!inlineEnd.preview.includes('Nur Bonus')||
  !inlineEnd.pdfIncludesBonus||inlineEnd.sourceScore!==0)
   throw Error('Purely bonus competency missing in student report or PDF: '+JSON.stringify(inlineEnd));
 // Clicking the very same cell again restores only this child's regular task.
 const back=await evaluate('(async()=>{v200Eval.step=4;render();document.querySelector(\'[data-v281-bonus="t1|T1"]\').click();return true;})()');
 await poll(async()=>evaluate('(async()=>{const p=await v200PrivateGet("smoke-inline-grade7");return !p.gradingOverridesV267?.t1?.T1?.mode;})()'),'restoring individual regular evaluation');
 const inlineRestored=await evaluate('(()=>{const p=v200Eval.privateData,a=v200EvalAnalysis();const r=v200StudentReport(p,a,p.roster[0]);return {max:r.totalMax,status:r.competencies[0].status,only:r.competencies[1].bonusOnly,mark:v200GetScore(p,"t1",a.items[0]),pressed:document.querySelector(\'[data-v281-bonus="t1|T1"]\')?.getAttribute("aria-pressed")};})()');
 if(inlineRestored.max!==6||inlineRestored.status!=='noch nicht erreicht'||!inlineRestored.only||
    inlineRestored.mark!==0||inlineRestored.pressed!=='false')
    throw Error('Returning from per-child bonus to regular grading failed: '+JSON.stringify(inlineRestored));
 console.log('Inline per-child bonus: NNE to E, zero points, bonus-only PDF, other child unchanged');

 // Points already earned must remain visible and credited after a nonzero task
 // is switched to bonus. Follow with original bonus-only competency + PDF test.
 const nonzeroBefore=await evaluate("(async()=>{\n const p=v200Eval.privateData;\n p.scores.t1.T1=2;\n p.scores.t1.T2=1;\n await v200PrivatePut(p);\n v200Eval.step=4;render();\n const r=v200StudentReport(p,v200EvalAnalysis(),p.roster[0]);\n return {reg:r.totalReg,bonus:r.totalBonusEarned,raw:r.totalEarned,\n  adjusted:r.totalAdjusted,max:r.totalMax,\n  source:v200GetScore(p,'t1',v200EvalAnalysis().items[0])};\n})()");
 if(nonzeroBefore.reg!==3||nonzeroBefore.bonus!==0||nonzeroBefore.max!==6||
    nonzeroBefore.raw!==3||nonzeroBefore.adjusted!==3||nonzeroBefore.source!==2)
   throw Error('Failed to seed a partially successful assessment item: '+JSON.stringify(nonzeroBefore));
 await evaluate('document.querySelector(\'[data-v281-bonus="t1|T1"]\').click()');
 await poll(async()=>evaluate('(async()=>{const p=await v200PrivateGet("smoke-inline-grade7");return p.gradingOverridesV267?.t1?.T1?.mode==="bonus";})()'),'persisting nonzero bonus');
 const nonzeroAfter=await evaluate("(async()=>{\n const p=v200Eval.privateData,r=v200StudentReport(p,v200EvalAnalysis(),p.roster[0]);\n return {reg:r.totalReg,bonus:r.totalBonusEarned,raw:r.totalEarned,\n  adjusted:r.totalAdjusted,max:r.totalMax,used:r.totalBonusUsed,\n  displayed:document.querySelector('[data-v281-result=\"t1\"]')?.textContent||'',\n  score:v200GetScore(p,'t1',v200EvalAnalysis().items[0])};\n})()");
 if(nonzeroAfter.reg!==1||nonzeroAfter.bonus!==2||nonzeroAfter.raw!==3||
    nonzeroAfter.adjusted!==3||nonzeroAfter.max!==3||nonzeroAfter.used!==2||
    nonzeroAfter.score!==2||!nonzeroAfter.displayed.includes('1 reg. + 2 Bonus'))
   throw Error('Earned points were lost or hidden after converting nonzero mark to bonus: '+
    JSON.stringify(nonzeroAfter));
 const onlyBonusEarned=await evaluate("(async()=>{\n const p=v200Eval.privateData;\n p.scores.t1.T1=0;p.paperScores.t1.T3=1;\n await v200PrivatePut(p);\n v200Eval.step=4;render();\n const r=v200StudentReport(p,v200EvalAnalysis(),p.roster[0]);\n const text=document.querySelector('[data-v281-result=\"t1\"]')?.textContent||'';\n v200Eval.step=5;render();\n const pdf=v233ReportPages(r,state.assessments.find(x=>x.id==='smoke-inline-grade7'),false)\n   .flat().join('');\n return {reg:r.totalReg,bonus:r.totalBonusEarned,raw:r.totalEarned,\n  adjusted:r.totalAdjusted,max:r.totalMax,used:r.totalBonusUsed,\n  bonusOnly:r.competencies[1].bonusOnly,status:r.competencies[1].status,\n  text,pdfBonus:pdf.includes('Bonus'),score:p.paperScores.t1.T3,\n  other:v200StudentReport(p,v200EvalAnalysis(),p.roster[1]).totalMax};\n})()");
 if(onlyBonusEarned.reg!==1||onlyBonusEarned.bonus!==1||
    onlyBonusEarned.raw!==2||onlyBonusEarned.adjusted!==2||onlyBonusEarned.max!==3||
    onlyBonusEarned.used!==1||!onlyBonusEarned.bonusOnly||onlyBonusEarned.status!==''||
    !onlyBonusEarned.text.includes('1 reg. + 1 Bonus')||
    !onlyBonusEarned.pdfBonus||onlyBonusEarned.score!==1||onlyBonusEarned.other!==10)
   throw Error('Bonus-only competency marks were dropped from total or classmate altered: '+
    JSON.stringify(onlyBonusEarned));
 console.log('Earned partial and bonus-only marks retained in numerator, printable and classmate unaffected');

 // Early exam preparation: last double lesson, colleagues' exam and complete local ZIP.
 const examSeed=await evaluate(`(async()=>{
   const NativeDate=window.Date,anchor='2026-10-30T10:00:00+01:00';
   window.Date=class FixedExamClock extends NativeDate{
     constructor(...args){if(args.length)super(...args);else super(anchor);}
     static now(){return NativeDate.parse(anchor);}
   };
   const course={id:'smoke-exam-r7',name:'7c',subject:'Religion',students:0};
   state.classes.push(course);
   state.assessments=state.assessments||[];
   state.assessments.push({id:'smoke-exam-brief',classId:course.id,date:'2026-11-13',
     type:'Klassenarbeit',title:'Religion 7 Testarbeit',scope:'Vergleich der Religionen',files:[]});
   state.sequences.push({id:'smoke-exam-seq',classId:course.id,schoolYearV190:'2026/27',
     title:'Religionen vergleichen',plan:[
     {id:'u-held',title:'Judentum',plannedDate:'2026-10-28',content:'Tora'},
     {id:'u-next',title:'Islam und Christentum',plannedDate:'2026-11-11',content:'Gemeinsamkeiten'}]});
   const key='smoke-colleague-exam-v269';
   await fileStorePut(key,new File(['SYNTHETISCHE VORLAGE'],'Kollegenarbeit.pdf',{type:'application/pdf'}));
   storedFileKeys.add(key);
   state.materials.push({id:'smoke-colleague-doc',title:'Kollegenarbeit',variants:[
     {id:'original',type:'standard',fileKey:key,fileName:'Kollegenarbeit.pdf'}],
     hubV237:{subject:'Religion',grade:7,kind:'referenzarbeit',status:'pool'}});
   await saveState();view='sequences';modal=null;render();
   const b=document.querySelector('[data-v269-open="smoke-exam-brief"]');
   if(!b)throw Error('No early exam creation button in annual panel');
   b.click();
   const future=document.querySelector('[data-v269-unit="u:smoke-exam-seq:u-next"]');
   if(!future)throw Error('Missing upcoming double lesson selection');
   const before=future.checked;
   future.checked=true;future.dispatchEvent(new Event('change'));
   const file=document.querySelector('[data-v269-file="m:smoke-colleague-doc:original"]');
   if(!file)throw Error('Reference exam not offered');
   file.checked=true;file.dispatchEvent(new Event('change'));
   document.querySelector('[data-v269-mark="m:smoke-colleague-doc:original"]').click();
   const contextDate=iso(new Date());
   const opts=SC_EXAM_BRIEF_V269.optionsForExam(
     state.assessments.find(x=>x.id==='smoke-exam-brief'),
     v190PlanningSequences(course.id,'2026/27'),
     state.lessons.filter(x=>x.classId===course.id).map(l=>({...l,heldV269:v182IsHeld(l)})),contextDate);
   const selectedUnit=opts.find(x=>x.key==='u:smoke-exam-seq:u-next');
   window.Date=NativeDate;
   return {before,selected:future.checked,reference:file.checked,contextDate,
     unitStage:selectedUnit?.stage,defaultChecked:selectedUnit?.defaultChecked,
     unitDate:selectedUnit?.date};
 })()`);
 if(examSeed.before||!examSeed.selected||!examSeed.reference)
   throw Error('Future exam lesson was incorrectly preselected: '+JSON.stringify(examSeed));
 await poll(async()=>evaluate('!!state.materials.find(m=>m.id==="smoke-colleague-doc")?.hubV237?.isColleagueReferenceV269'),'marking colleague reference exam');
 const examZip=await evaluate(`(async()=>{
   const select=document.querySelector('[data-v269-file="m:smoke-colleague-doc:original"]');
   const future=document.querySelector('[data-v269-unit="u:smoke-exam-seq:u-next"]');
   if(!select||!future||!select.checked||!future.checked)throw Error('Choices lost after marking reference');
   let archive=null;const old=downloadBlob;
   downloadBlob=(name,blob)=>{archive=blob;};
   try{await document.querySelector('[data-v269-export]').click();
     for(let i=0;i<40&&!archive;i++)await new Promise(r=>setTimeout(r,100));
   }finally{downloadBlob=old;}
   if(!archive)throw Error('No exam ZIP generated: '+document.getElementById('v269-status')?.textContent);
   const zip=await JSZip.loadAsync(archive);
   const prompt=await zip.file('00_PROMPT_Klassenarbeit_erstellen.txt').async('string');
   const files=Object.keys(zip.files).filter(n=>n.startsWith('Materialien/')&&!zip.files[n].dir);
   const reference=files.length?await zip.file(files[0]).async('string'):'';
   return {topicKeys:state.assessments.find(a=>a.id==='smoke-exam-brief').examBriefV269?.unitKeys,sourceTopics:SchulcockpitExamBriefV269.context(state.assessments.find(a=>a.id==='smoke-exam-brief')).units.map(x=>x.key),promptStart:prompt.slice(0,450),hasFuture:prompt.includes('Islam und Christentum'),
     futureLabeled:prompt.includes('NOCH NICHT GEHALTEN'),
     teacherRef:prompt.includes('Kollegenarbeit.pdf')&&prompt.includes('Kolleg*innenarbeit'),
     reference,files:files.length,saved:!!state.assessments.find(a=>a.id==='smoke-exam-brief').examBriefV269};
 })()`);
 if(!examZip.hasFuture||!examZip.futureLabeled||!examZip.teacherRef||
     examZip.reference!=='SYNTHETISCHE VORLAGE'||examZip.files!==1||!examZip.saved)
   throw Error('Early exam creation local ZIP is inconsistent: '+JSON.stringify(examZip));
 console.log('Early exam planning includes upcoming lesson and selected colleague file, excludes private records');


 // Real lesson differs from plan; curriculum coverage must use documented Ist, not Soll.
 const actualSeed=await evaluate(`(async()=>{
   const exam=state.assessments.find(a=>a.id==='smoke-exam-brief');
   const course=cls('smoke-exam-r7');
   const choices=v204AllCourseCurriculum(course);
   if(choices.length<2)throw Error('No religion grade 7 competency choices');
   const q=state.sequences.find(q=>q.id==='smoke-exam-seq');
   q.plan[0].competencyIdsV202=[choices[0].id];
   exam.competencySelectionV204={schema:1,selectedIds:[choices[0].id,choices[1].id],confirmed:true};
   state.lessons.push({id:'smoke-real-lesson-v270',classId:course.id,
     date:'2026-10-28',sequenceId:q.id,period:'2',slot:2,kind:'course',
     title:'Original geplante Stunde',planReference:{unitId:'u-held',title:'Soll-Inhalt',autoMatched:true},
     status:'done',materials:[],printPlan:[],phasePlan:[],slides:[],prepTasks:[]});
   await saveState();
   v182LessonId='smoke-real-lesson-v270';modal=null;view='lessonDayV182';render();
   const a=document.querySelector('[data-v270-actual]');
   const ids=[...document.querySelectorAll('[data-v270-comp]')].map(x=>x.dataset.v270Comp);
   return {editor:!!a,competency:ids.includes(choices[0].id),chosen:choices[0].id};
 })()`);
 if(!actualSeed.editor||!actualSeed.competency)throw Error('Ist editor absent: '+JSON.stringify(actualSeed));
 const actualWrite=await evaluate(`(async()=>{
   document.querySelector('[data-v270-title]').value='Martin Luther: Kahoot, Checker Tobi und vier Soli';
   document.querySelector('[data-v270-actual]').value='Anders als geplant: Kahoot, Checker-Tobi-Video zur Reformation; Soli-Zuordnung.';
   document.querySelector('[data-v270-securing]').value='Gemeinsames Tafelbild mit den vier Soli';
   document.querySelector('[data-v270-material]').value='unsuitable';
   document.querySelector('[data-v270-comp="'+${JSON.stringify(actualSeed.chosen)}+'"]').value='secured';
   const dt=new DataTransfer();
   dt.items.add(new File(['SYNTHETIC SECURED OUTCOME'],'Sicherung_Soli.txt',{type:'text/plain'}));
   document.querySelector('[data-v270-files]').files=dt.files;
   document.querySelector('[data-v270-save]').click();
   return true;
 })()`);
 await poll(async()=>evaluate('!!state.lessons.find(x=>x.id==="smoke-real-lesson-v270")?.actualV270?.files?.length'),'saving actual lesson evidence file');
 const actualCheck=await evaluate(`(async()=>{
   const l=state.lessons.find(x=>x.id==='smoke-real-lesson-v270'),f=l.actualV270.files[0],
     saved=await fileStoreGet(f.fileKey),exam=state.assessments.find(a=>a.id==='smoke-exam-brief');
   modal=null;view='sequences';render();
   document.querySelector('[data-v270-exam="smoke-exam-brief"]').click();
   const statuses=[...document.querySelectorAll('.v270-state')].map(x=>x.textContent);
   return {savedText:await saved.blob.text(),original:l.title,actualTitle:l.actualV270.title,
     coverage:SchulcockpitActualV270.examRows(exam).rows.map(x=>x.status),
     oldUnitNotAutomaticallyDone:!v202UnitHeld(state.sequences.find(q=>q.id==='smoke-exam-seq'),state.sequences.find(q=>q.id==='smoke-exam-seq').plan[0]),
     hasDialog:modal.type==='v270ExamCheck',statuses};
 })()`);
 if(actualCheck.savedText!=='SYNTHETIC SECURED OUTCOME'||actualCheck.original!=='Original geplante Stunde'||
   actualCheck.coverage[0]!=='secured'||actualCheck.coverage[1]==='secured'||!actualCheck.hasDialog||!actualCheck.oldUnitNotAutomaticallyDone)
   throw Error('Mismatch between planned and actual lesson or unsafe exam check: '+JSON.stringify(actualCheck));
 const actualZip=await evaluate(`(async()=>{
   modal=null;view='sequences';render();
   document.querySelector('[data-v269-open="smoke-exam-brief"]').click();
   const l=state.lessons.find(x=>x.id==='smoke-real-lesson-v270'),fileKey=l.actualV270.files[0].fileKey;
   const input=document.querySelector('[data-v269-file="actual:'+fileKey+'"]');
   if(!input)throw Error('Ist evidence not selectable as exam source');
   input.checked=true;input.dispatchEvent(new Event('change'));
   let blob=null;const original=downloadBlob;
   downloadBlob=(name,b)=>{blob=b;};
   try{document.querySelector('[data-v269-export]').click();
     for(let i=0;i<45&&!blob;i++)await new Promise(r=>setTimeout(r,100));
   }finally{downloadBlob=original;}
   if(!blob)throw Error('Exam ZIP with actual evidence was not created: '+document.querySelector('#v269-status')?.textContent);
   const z=await JSZip.loadAsync(blob);
   const prompt=await z.file('00_PROMPT_Klassenarbeit_erstellen.txt').async('string');
   const files=Object.keys(z.files).filter(x=>x.includes('Sicherung_Soli.txt'));
   return {changedNotTaught:prompt.includes('ANDERS DURCHGEFÜHRT – SOLL NICHT ALS VERMITTELT ANNEHMEN'),promptActual:prompt.includes('Kahoot, Checker Tobi und vier Soli'),
     promptSafety:prompt.includes('Gesichert')&&prompt.includes('Nicht zugeordnet'),
     files:files.length,fileText:files.length?await z.file(files[0]).async('string'):''};
 })()`);
 if(!actualZip.changedNotTaught||!actualZip.promptActual||!actualZip.promptSafety||actualZip.files!==1||actualZip.fileText!=='SYNTHETIC SECURED OUTCOME')
   throw Error('Exam prompt/export missed actual lesson or private evidence: '+JSON.stringify(actualZip));
 console.log('Documented Ist diverges from Soll, local file preserved, curriculum check and exam ZIP work');


 // Grade 6 Religion: a written Classtime PDF, NO supplied competency rubric,
 // NO student results. Curriculum IDs are available and task-derived analysis works.
 const grade6Start=await evaluate(`(async()=>{
   const c={id:'smoke-religion6-v271',name:'6c',subject:'Religion',students:0};
   state.classes.push(c);
   const key='smoke-written-exam-v271',otherKey='smoke-colleague-reference-v271';
   await fileStorePut(key,new File(['ANONYME GESCHRIEBENE ARBEIT: Aufgabe 1, 4 Punkte'],
      'Klassenarbeit_6_Religion_Classtime.pdf',{type:'application/pdf'}));
   await fileStorePut(otherKey,new File(['SYNTHETISCHE VORLAGE'],'Referenz_6.pdf',{type:'application/pdf'}));
   storedFileKeys.add(key);storedFileKeys.add(otherKey);
   state.assessments.push({id:'smoke-religion6-assess-v271',classId:c.id,date:'2026-10-23',
      type:'Klassenarbeit',title:'Religion 6 · Test',scope:'Judentum',files:[
       {id:'f-written',name:'Klassenarbeit_6_Religion_Classtime.pdf',fileKey:key},
       {id:'f-reference',name:'Referenz_6.pdf',fileKey:otherKey}]});
   await saveState();
   await v200OpenEval('smoke-religion6-assess-v271');
   v200Eval.step=1;render(); // prior synthetic tests may have persisted a later step
   return {step:v200Eval.step,view,hasCurriculum:!!document.querySelector('.v271-curriculum-preview'),
      content:document.querySelector('.v214-workspace-content')?.textContent||'',
      hasButton:!!document.querySelector('[data-v318-role="f-written"]'),
      variantChoices:!!document.querySelector('[data-v318-role="f-reference"]')};
 })()`);
 if(!grade6Start.hasCurriculum||!grade6Start.hasButton||!grade6Start.variantChoices||
    !grade6Start.content.includes('Ein zusätzliches Kompetenzraster'))
   throw Error('Grade 6 introduction still requires rubric or no exam link: '+JSON.stringify(grade6Start));
 const grade6Bundle=await evaluate(`(async()=>{
   const selector=document.querySelector('[data-v318-role="f-written"]');
   if(!selector)throw Error('New evaluation file-category selector missing');
   selector.value='standard';selector.dispatchEvent(new Event('change',{bubbles:true}));
   for(let i=0;i<30&&v214Role(v200Assessment('smoke-religion6-assess-v271'),
      v200Assessment('smoke-religion6-assess-v271').files[0])!=='used';i++)
      await new Promise(r=>setTimeout(r,50));
   const a=v200Assessment('smoke-religion6-assess-v271');
   if(v214Role(a,a.files[0])!=='used'||v214Role(a,a.files[1])!=='reference')
      throw Error('Role marking failed');
   v200Eval.step=2;render();
   let blob=null;const oldDownload=downloadBlob;
   downloadBlob=(name,b)=>{blob=b;};
   try{
     document.querySelector('[data-v200-analysis-bundle]').click();
     for(let i=0;i<40&&!blob;i++)await new Promise(r=>setTimeout(r,100));
   }finally{downloadBlob=oldDownload;}
   if(!blob)throw Error('Bundle not created: optional rubric gate may still exist');
   const z=await JSZip.loadAsync(blob);
   const prompt=await z.file('00_Analyseprompt_OHNE_SCHUELERDATEN.txt').async('string');
   const docs=Object.keys(z.files).filter(k=>k.includes('.pdf'));
   return {prompt:prompt.includes('task-derived'),curriculum:prompt.includes('Erlaubte Curriculum-IDs'),
     selected:docs.some(k=>k.includes('Klassenarbeit_6_Religion_Classtime.pdf')),
     referenceExcluded:!docs.some(k=>k.includes('Referenz_6.pdf')),
     docs,step:document.querySelector('[data-v200-analysis-import]')!==null};
 })()`);
 if(!grade6Bundle.prompt||!grade6Bundle.curriculum||!grade6Bundle.selected||
    !grade6Bundle.referenceExcluded||!grade6Bundle.step)
   throw Error('Grade 6 analysis ZIP without external rubric is incorrect: '+JSON.stringify(grade6Bundle));
 const grade6Imported=await evaluate(`(async()=>{
   const course=cls('smoke-religion6-v271'),comp=v204AllCourseCurriculum(course)[0];
   if(!comp)throw Error('No stored Religion 6 curriculum');
   const obj={schema:'schulcockpit.assessment-analysis.v1',
      rubricV209:{schema:1,origin:'task-derived',sourceFile:'',
        derivationNote:'Ein bewertetes Erkennen in Aufgabe 1',criterionOrder:['K1']},
      thresholds:{reachedMinPct:70,partialMinPct:50,source:'Schulinternes Curriculum Religion'},
      competencies:[{id:'K1',text:'Du kannst den Fachbegriff aus Aufgabe 1 erklären.',
        topic:'Aufgabe 1',source:'Aufgaben-PDF',curriculumCompetencyId:comp.id,
        linkageNoteV209:'Die Zuordnung muss fachlich überprüft werden.'}],
      items:[{id:'A1',label:'Aufgabe 1',source:'classtime',regularMax:4,bonusMax:0,
        competencyId:'K1',classtimeAliases:['Aufgabe 1']}],
      notes:'Fiktive Prüfungsanalyse für Browsertest'};
   const raw='<SCHULCOCKPIT_ASSESSMENT_IMPORT>\\n'+JSON.stringify(obj)+'\\n</SCHULCOCKPIT_ASSESSMENT_IMPORT>';
   document.getElementById('v200-analysis-import').value=raw;
   document.querySelector('[data-v200-analysis-import]').click();
   for(let i=0;i<40&&(v200Eval.step!==3||!v200Assessment('smoke-religion6-assess-v271').evaluationV200?.analysis);i++)
     await new Promise(r=>setTimeout(r,100));
   const a=v200Assessment('smoke-religion6-assess-v271');
   return {origin:a.evaluationV200?.analysis?.rubricV209?.origin,
     reviewed:a.competencySelectionV204?.teacherReviewedV205,
     noResults:!v200Eval.privateData?.classtime,
     originalRows:a.evaluationV200?.analysis?.items?.length,
     preview:!!document.querySelector('.v209-rubric-review'),
     approveAvailable:!!document.querySelector('[data-v205-approve-exam]')};
 })()`);
 if(grade6Imported.origin!=='task-derived'||grade6Imported.reviewed!==false||
    !grade6Imported.noResults||grade6Imported.originalRows!==1||!grade6Imported.preview||!grade6Imported.approveAvailable)
   throw Error('Task-derived Grade 6 rubric not safely imported/reviewable: '+JSON.stringify(grade6Imported));
 const grade6Approval=await evaluate(`(async()=>{
   const a=v200Assessment('smoke-religion6-assess-v271');
   if(a.competencySelectionV204?.teacherReviewedV205!==false)throw Error('Unexpected prior approval');
   document.querySelector('[data-v205-approve-exam]').click();
   for(let i=0;i<30&&!a.competencySelectionV204?.teacherReviewedV205;i++)
     await new Promise(r=>setTimeout(r,50));
   return {approved:!!a.competencySelectionV204?.teacherReviewedV205,
     saved:!!a.competencySelectionV204?.reviewedAtV205};
 })()`);
 if(!grade6Approval.approved||!grade6Approval.saved)
   throw Error('Teacher approval after Grade 6 import did not persist');
 console.log('Religion 6 without rubric: ZIP, curriculum, task-derived preview and teacher approval passed');


 // User-reported scenario: multiplication topic stranded in KW41, originally
 // planned target shows 'Klassenarbeit', now needs a Monday slide deck.
 const manualMove=await evaluate(`(async()=>{
   const cid='smoke-math5-switch',qid='smoke-multiply-seq';
   state.classes.push({id:cid,name:'5f',subject:'Mathematik',students:25});
   state.timetable.push({id:'tt-switch-mon',classId:cid,weekday:1,slot:2,period:'2.',
     kind:'course'},{id:'tt-switch-thu',classId:cid,weekday:4,slot:3,period:'3.',kind:'course'});
   state.sequences.push({id:qid,classId:cid,schoolYearV190:'2026/27',
      title:'Multiplikation',orderV190:80,startDate:'2026-10-05',
      plan:[
       {id:'mult1',title:'Multiplizieren 1 – Fachbegriffe und Grundaufgaben',
         plannedDate:'2026-10-05',content:'Faktoren und Produkt, Grundaufgaben'},
       {id:'placeholder-exam',title:'Klassenarbeit (alter Soll-Platzhalter)',
         plannedDate:'2026-11-02',content:'Nicht als echter Prüfungstermin gespeichert'},
       {id:'mult2',title:'Multiplizieren 2',plannedDate:'2026-11-05',content:'Vertiefung'}]});
   const archived={id:'smoke-historic-mult',classId:cid,date:'2026-10-05',slot:2,
     title:'Multiplizieren 1 – Fachbegriffe und Grundaufgaben',status:'open',
     executionV180:{type:'cancelled',mode:'shift'},sequenceId:qid,
     planReference:{unitId:'mult1',title:'Multiplizieren 1 – Fachbegriffe und Grundaufgaben'},
     printPlan:[{id:'already-copied',alreadyPrinted:true}]};
   state.lessons.push(archived);
   state.settings.activeWeekStart='2026-11-02';
   const first=createBlankLessonFromTimetable(state.timetable.find(t=>t.id==='tt-switch-mon'));
   state.lessons.push(first);
   await saveState();
   modal={type:'sequence',id:qid};view='sequences';render();
   const btn=document.querySelector('[data-v275-unit="smoke-multiply-seq|mult1"]');
   if(!btn)throw Error('Old broken transfer button not replaced in sequence detail');
   btn.click();
   if(modal?.type!=='hourlyDispositionV275')throw Error('New hourly disposition did not open');

   const topic=document.querySelector('[data-v275-source]')?.value;
   const target=document.querySelector('select[data-v275-target]')?.value;
   const old=JSON.stringify(archived);
   const plan=state.sequences.find(q=>q.id===qid).plan.map(u=>u.plannedDate);
   return {topic,target,old,plan,preview:document.querySelector('.v275-preview')?.textContent||''};
 })()`);
 const manualTargetDate=manualMove.target?.slice(0,10);
 if(manualMove.topic!=='smoke-multiply-seq|mult1'||!manualTargetDate||
     !manualMove.preview.includes('Multiplizieren 1'))
   throw Error('Manual switch preview missed upcoming Monday or displaced legacy topic: '+JSON.stringify(manualMove));
 const manualApply=await evaluate(`(async()=>{
   document.querySelector('[data-v275-apply]').click();
   for(let i=0;i<35&&view!=='assistant';i++)
     await new Promise(r=>setTimeout(r,100));
   const q=state.sequences.find(x=>x.id==='smoke-multiply-seq');
   const rows=Object.fromEntries(q.plan.map(u=>[u.id,u.plannedDate]));
   const l=state.lessons.find(x=>x.classId==='smoke-math5-switch'&&x.date===${JSON.stringify(manualTargetDate)}&&Number(lessonSlot(x))===2);
   const archived=state.lessons.find(x=>x.id==='smoke-historic-mult');
   return {view,rows,monday:l?.title,manual:!!l?.manualPinnedV272,
    planUnit:l?.planReference?.unitId,
    archivedDate:archived?.date,archivedStatus:archived?.executionV180?.type,
    archivedPrinted:archived?.printPlan?.[0]?.alreadyPrinted,
    activeWeek:state.settings.activeWeekStart,
    assistantLesson:wizardV14?.lessonId};
 })()`);
 if(manualApply.rows.mult1!==manualTargetDate||
    !manualApply.rows['placeholder-exam']||!manualApply.rows.mult2||
    manualApply.planUnit!=='mult1'||!manualApply.manual||
    manualApply.archivedDate!=='2026-10-05'||manualApply.archivedStatus!=='cancelled'||
    !manualApply.archivedPrinted||!manualApply.activeWeek||
    manualApply.view!=='assistant'||!manualApply.assistantLesson)
   throw Error('Manual Monday topic switch failed to preserve history or open slide preparation: '+JSON.stringify(manualApply));
 console.log('Past multiplication topic shifted to Monday, legacy classwork placeholder advanced, old worksheet record preserved, PPT wizard opened');


 // Regression: "already held or prepared" MUST NOT prevent repeating or
 // making up the same instructional topic in Monday week. Original unchanged.
 const protectedMove=await evaluate(`(async()=>{
   const cid='smoke-repeat-math5',qid='smoke-repeat-seq',day='2026-11-09';
   state.classes.push({id:cid,name:'5g',subject:'Mathematik',students:23});
   state.timetable.push({id:'tt-repeat-mon',classId:cid,weekday:1,slot:2,
     period:'2.',kind:'course'},{id:'tt-repeat-thu',classId:cid,weekday:4,
     slot:3,period:'3.',kind:'course'});
   const sourceUnit={id:'repeat-original',title:'Multiplizieren 1 – Grundaufgaben',
     plannedDate:'2026-10-05',content:'Faktoren und Produkt',
     material:'Arbeitsblatt bereits ausgedruckt'};
   state.sequences.push({id:qid,classId:cid,title:'Multiplikation',
     schoolYearV190:'2026/27',startDate:'2026-10-05',orderV190:82,plan:[
       sourceUnit,
       {id:'repeat-exam-placeholder',title:'Klassenarbeit (älterer Soll-Eintrag)',
         plannedDate:day},
       {id:'repeat-next',title:'Multiplizieren 2',plannedDate:'2026-11-12'}
     ]});
   state.lessons.push({id:'smoke-protected-original',classId:cid,
     date:'2026-10-05',slot:2,status:'done',sequenceId:qid,
     title:sourceUnit.title,
     planReference:{unitId:sourceUnit.id,title:sourceUnit.title,
       autoMatched:false},printPlan:[{id:'printed',alreadyPrinted:true}],
     materials:['worksheet-keep'],presentationReady:false,
     phasePlan:[],slides:[],prepTasks:[]});
   state.settings.activeWeekStart=day;
   state.lessons.push(createBlankLessonFromTimetable(state.timetable.find(x=>x.id==='tt-repeat-mon')));
   await saveState();
   const original=JSON.stringify(state.lessons.find(l=>l.id==='smoke-protected-original'));
   const originalPlan=JSON.stringify(sourceUnit);
   modal={type:'sequence',id:qid};view='sequences';render();
   document.querySelector('[data-v275-unit="'+qid+'|repeat-original"]').click();
   const text=document.querySelector('.v275-modal')?.textContent||'';
   const err=document.querySelector('.v275-modal [role="alert"]')?.textContent||'';
   const btn=document.querySelector('[data-v275-apply]');
   return {original,originalPlan,repeatMessage:text.includes('Einfügen – spätere Stunden'),
     preview:text.includes('Klassenarbeit'),canSave:!!btn&&!btn.disabled,error:err};
 })()`);
 if(!protectedMove.repeatMessage||!protectedMove.preview||
    !protectedMove.canSave||protectedMove.error)
   throw Error('Prepared/held multiplication lesson wrongly blocked: '+JSON.stringify(protectedMove));
 const protectedApplied=await evaluate(`(async()=>{
   document.querySelector('[data-v275-apply]').click();
   for(let i=0;i<45&&view!=='assistant';i++)await new Promise(r=>setTimeout(r,100));
   const q=state.sequences.find(x=>x.id==='smoke-repeat-seq');
   const source=q.plan.find(u=>u.id==='repeat-original');
   const copy=q.plan.find(u=>u.continuationOfV275==='repeat-original');
   const past=state.lessons.find(l=>l.id==='smoke-protected-original');
   const newLesson=state.lessons.find(l=>l.classId==='smoke-repeat-math5'&&
      l.date==='2026-11-09'&&Number(lessonSlot(l))===2);
   return {
     sameOriginal:JSON.stringify(past)===${JSON.stringify(protectedMove.original)},
     samePlan:JSON.stringify(source)===${JSON.stringify(protectedMove.originalPlan)},
     oldStatus:past?.status,worksheet:past?.printPlan?.[0]?.alreadyPrinted,
     copyCount:q.plan.filter(u=>u.continuationOfV275==='repeat-original').length,
     newDate:copy?.plannedDate,newId:copy?.id,
     newLessonRef:newLesson?.planReference?.unitId,
     pinned:!!newLesson?.manualPinnedV272,
     classworkMoved:q.plan.find(u=>u.id==='repeat-exam-placeholder')?.plannedDate,
     assistant:view==='assistant'&&wizardV14?.lessonId===newLesson?.id,
     activeWeek:state.settings.activeWeekStart
   };
 })()`);
 if(!protectedApplied.sameOriginal||!protectedApplied.samePlan||!protectedApplied.worksheet||
    protectedApplied.oldStatus!=='done'||protectedApplied.copyCount!==1||
    protectedApplied.newDate!=='2026-11-09'||protectedApplied.newId!==protectedApplied.newLessonRef||
    !protectedApplied.pinned||protectedApplied.classworkMoved!=='2026-11-12'||
    !protectedApplied.assistant||protectedApplied.activeWeek!=='2026-11-09')
   throw Error('Re-planning protected topic lost teaching history or Monday wizard: '+JSON.stringify(protectedApplied));
 console.log('Protected/held original lesson preserved; repeated topic assigned Monday and PPT wizard opened');


 // Future prepared 'Dividieren verstehen' must now move with its original
 // phases and materials rather than blocking insertion of multiplication.
 const divisionSafe=await evaluate(`(async()=>{
   const cid='smoke-protected-division',qid='smoke-division-seq';
   state.classes.push({id:cid,name:'5h',subject:'Mathematik',students:25});
   state.timetable.push({id:'tt-div-mon',classId:cid,weekday:1,slot:2,period:'2.',kind:'course'});
   const original={id:'mult1',title:'Multiplizieren 1 – Fachbegriffe und Grundaufgaben',
     plannedDate:'2026-10-05',content:'Grundaufgaben Multiplikation'};
   const old={id:'old-placeholder',title:'Klassenarbeit (alter Soll-Eintrag)',plannedDate:'2026-11-09'};
   const division={id:'div-safe',title:'Dividieren verstehen: aufteilen, verteilen und schriftlich beginnen',
     plannedDate:'2026-11-16',content:'Schriftliche Division'};
   state.sequences.push({id:qid,classId:cid,schoolYearV190:'2026/27',
     title:'Grundrechenarten',startDate:'2026-10-05',plan:[original,old,division]});
   state.lessons.push({id:'division-held-previous',classId:cid,date:'2026-10-05',
     status:'done',slot:2,sequenceId:qid,planReference:{unitId:'mult1',autoMatched:false},
     title:original.title,materials:['already-printed'],printPlan:[{alreadyPrinted:true}]});
   state.lessons.push({id:'division-protected',classId:cid,date:'2026-11-16',
     status:'planned',slot:2,timetableId:'tt-div-mon',sequenceId:qid,
     planReference:{unitId:'div-safe',title:division.title,autoMatched:true},
     title:division.title,phasePlan:[{title:'Geplant und geschützt'}],
     materials:[],printPlan:[],slides:[]});
   state.settings.activeWeekStart='2026-11-09';
   state.lessons.push(createBlankLessonFromTimetable(state.timetable.find(x=>x.id==='tt-div-mon')));
   const protectedBefore=JSON.stringify(state.lessons.find(l=>l.id==='division-protected'));
   const sourceBefore=JSON.stringify(original);
   await saveState();
   view='sequences';modal={type:'sequence',id:qid};render();
   document.querySelector('[data-v275-unit="'+qid+'|mult1"]').click();
    const select=document.querySelector('[data-v275-action]');select.value='move';select.dispatchEvent(new Event('change'));
   const mode=document.querySelector('[data-v275-action]')?.value;
   const text=document.querySelector('.v275-modal')?.textContent||'';
   const disabled=document.querySelector('[data-v275-apply]')?.disabled;
   return {mode,description:text.includes('Dividieren verstehen'),
     divisionBlocked:text.includes('geschützte Stunde wurde verschoben'),
     canApply:!disabled,protectedBefore,sourceBefore};
 })()`);
 if(divisionSafe.mode!=='move'||!divisionSafe.description||
    divisionSafe.divisionBlocked||!divisionSafe.canApply)
   throw Error('Protected division still blocks an isolated Monday topic: '+JSON.stringify(divisionSafe));
 const divisionApplied=await evaluate(`(async()=>{
   document.querySelector('[data-v275-apply]').click();
   for(let i=0;i<45&&view!=='assistant';i++)await new Promise(r=>setTimeout(r,100));
   const q=state.sequences.find(x=>x.id==='smoke-division-seq');
   const done=state.lessons.find(l=>l.id==='division-held-previous');
   const division=state.lessons.find(l=>l.id==='division-protected');
   const original=q.plan.find(u=>u.id==='mult1');
   const repeated=q.plan.find(u=>u.continuationOfV275==='mult1');
   const placeholder=q.plan.find(u=>u.id==='old-placeholder');
   const newMon=state.lessons.find(l=>l.classId==='smoke-protected-division'&&l.date==='2026-11-09');
   return {
    divisionMoved:division?.date==='2026-11-23'&&
     division?.phasePlan?.[0]?.title==='Geplant und geschützt'&&
     division?.planReference?.unitId==='div-safe',
    originalUnchanged:JSON.stringify(original)===${JSON.stringify(divisionSafe.sourceBefore)},
    oldPrinted:done?.printPlan?.[0]?.alreadyPrinted,
    carried:placeholder?.plannedDate==='2026-11-16',
    repeatDate:repeated?.plannedDate,manual:!!newMon?.manualPinnedV272,
    newRef:newMon?.planReference?.unitId,repeatedId:repeated?.id,
    powerpoint:view==='assistant'&&wizardV14?.lessonId===newMon?.id
   };
 })()`);
 if(!divisionApplied.divisionMoved||!divisionApplied.originalUnchanged||
    !divisionApplied.oldPrinted||!divisionApplied.carried||
    divisionApplied.repeatDate!=='2026-11-09'||!divisionApplied.manual||
    divisionApplied.newRef!==divisionApplied.repeatedId||!divisionApplied.powerpoint)
   throw Error('Cascaded Monday lesson lost prepared division content or teaching history: '+JSON.stringify(divisionApplied));
 console.log('Prepared division moved forward with original phases; historic lesson preserved');


 // Grade 11 substitute worksheet was completed independently: only a short
 // discussion should carry into next topic, NOT a whole extra double lesson.
 const hourlySeed=await evaluate(`(async()=>{
   const cid='smoke-hourly-re11',qid='smoke-hourly-seq';
   state.classes.push({id:cid,name:'11a',subject:'Religion',students:24});
   state.timetable.push({id:'hourly-thu',classId:cid,weekday:4,slot:2,period:'2.',kind:'course'});
   state.timetable.push({id:'hourly-mon',classId:cid,weekday:1,slot:1,period:'1.',kind:'course'});
   state.sequences.push({id:qid,classId:cid,schoolYearV190:'2026/27',
     title:'Religion im Alltag',startDate:'2026-10-29',
     plan:[{id:'old-sub',title:'Eigenarbeit in Vertretung',plannedDate:'2026-10-29',content:'Aufgaben eigenverantwortlich'},
       {id:'new-topic',title:'Religion und Musik',plannedDate:'2026-11-09',content:'Symbole deuten'}]});
   state.lessons.push({id:'hourly-held',classId:cid,date:'2026-10-29',slot:2,
     title:'Eigenarbeit in Vertretung',status:'done',executionV180:{type:'substitute'},
     sequenceId:qid,planReference:{unitId:'old-sub',title:'Eigenarbeit in Vertretung',autoMatched:false},
     printPlan:[{alreadyPrinted:true}],materials:['safe-file'],slides:[],phasePlan:[]});
   state.lessons.push({id:'hourly-next',classId:cid,date:'2026-11-09',slot:1,timetableId:'hourly-mon',
     title:'Religion und Musik',status:'open',sequenceId:qid,
     planReference:{unitId:'new-topic',title:'Religion und Musik',autoMatched:true},
     materials:[],printPlan:[],phasePlan:[],slides:[]});
   await saveState();
   const old=JSON.stringify(state.sequences.find(q=>q.id===qid).plan);
   SchulcockpitDispositionV275.open({lessonId:'hourly-held'});
   return {open:modal?.type==='hourlyDispositionV275',
     action:document.querySelector('[data-v275-action]')?.value,
     inline:document.querySelector('[data-v275-inline]')?.checked,
     old};
 })()`);
 if(!hourlySeed.open||hourlySeed.action!=='continue_partial'||!hourlySeed.inline)
   throw Error('Last week substitute did not open partial continuation by default: '+JSON.stringify(hourlySeed));
 const hourlyResult=await evaluate(`(async()=>{
   const select=document.querySelector('[data-v275-target]');
   const wanted=[...select.options].find(x=>x.value.startsWith('2026-11-09|1|'));
   if(!wanted)throw Error('Next Religion 11 lesson is not selectable');
   select.value=wanted.value;select.dispatchEvent(new Event('change'));
   const note=document.querySelector('[data-v275-carry]');
   note.value='Besprechung der Vertretungsaufgaben, circa 15 Minuten';
   note.dispatchEvent(new Event('input'));
   note.dispatchEvent(new Event('change'));
   const btn=document.querySelector('[data-v275-apply]');
   if(!btn||btn.disabled)throw Error('Short followup could not be confirmed');
   const debugBefore=SchulcockpitDispositionV275.actionInfo().result;
   const errors=[];const prevAlert=window.alert;window.alert=m=>errors.push(String(m));
   try{btn.click();for(let i=0;i<45&&wizardV14?.lessonId!=='hourly-next';i++)await new Promise(r=>setTimeout(r,100));}
   finally{window.alert=prevAlert;}
   const seq=state.sequences.find(q=>q.id==='smoke-hourly-seq');
   const target=state.lessons.find(l=>l.id==='hourly-next');
   const original=state.lessons.find(l=>l.id==='hourly-held');
   const opened=state.lessons.find(l=>l.id===wizardV14?.lessonId);
   return {debugBefore,errors,view,modalType:modal?.type,wizardId:wizardV14?.lessonId,targetId:target?.id,openedTopic:opened?.title,openedCarry:opened?.carryoverV275?.note,assistant:view==='assistant'&&!!opened?.carryoverV275?.note,
     note:target?.carryoverV275?.note,source:original?.continuationStatusV275?.inline,
     originalPrinted:original?.printPlan?.[0]?.alreadyPrinted,
     originalHeld:v182IsHeld(original),
     sourcePlanUntouched:JSON.stringify(seq.plan)===${JSON.stringify(hourlySeed.old)},
     prompt:concretePlanningPromptV12(target).includes('circa 15 Minuten')};
 })()`);
 if(!hourlyResult.assistant||!hourlyResult.note?.includes('15 Minuten')||
    !hourlyResult.source||!hourlyResult.originalPrinted||!hourlyResult.originalHeld||
    !hourlyResult.sourcePlanUntouched||!hourlyResult.prompt)
   throw Error('Partial substitute followup changed next topic or lost original: '+JSON.stringify(hourlyResult));
 console.log('Religion 11 short substitute discussion + new lesson, no course shift, original files intact');


 // A full year must never reject an inserted topic; the last prepared lesson
 // stays visible, active and fully editable as a date-free overflow.
 const overhangStart=await evaluate("(async()=>{\n const cid='smoke-overhang-re7',qid='smoke-overhang-seq';\n state.classes.push({id:cid,name:'7r',subject:'Religion',students:26});\n state.timetable.push({id:'tt-overhang-fri',classId:cid,weekday:5,slot:2,period:'2.',kind:'course'});\n const all=v190CourseSlots(cid,'2026/27').filter(x=>x.date>='2026-11-02');\n if(all.length<2)throw Error('Need two future course lessons');\n const first=all.at(-2),last=all.at(-1);\n state.sequences.push({id:qid,classId:cid,title:'Reformation',schoolYearV190:'2026/27',\n  startDate:first.date,orderV190:88,plan:[\n   {id:'prep',title:'Klassenarbeitsvorbereitung',plannedDate:first.date,plannedSlotV272:first.slot},\n   {id:'ready',title:'Reformation mit Material',plannedDate:first.date,plannedSlotV272:first.slot},\n   {id:'final',title:'Reformation Abschluss',plannedDate:last.date,plannedSlotV272:last.slot}\n  ]});\n for(const [id,slot] of [['ready',first],['final',last]]){\n  state.lessons.push({id:'smoke-overhang-'+id,classId:cid,kind:'course',\n   source:'manual',date:slot.date,slot:slot.slot,timetableId:slot.timetableId,status:'open',\n   title:id==='ready'?'Reformation mit Material':'Reformation Abschluss',\n   planReference:{unitId:id,title:id,plannedDate:slot.date,autoMatched:false},\n   phasePlan:[{title:'Ausgearbeitet '+id}],materials:['material-'+id],\n   printPlan:[{id:'print-'+id,needed:true}]});\n }\n await saveState();\n SchulcockpitDispositionV275.open({cid,qid,key:qid+'|prep'});\n return {first:first.date,last:last.date,alertText:document.querySelector('.v275-modal [role=\"alert\"]')?.textContent||'',\n  preview:document.querySelector('.v275-preview')?.textContent||'',\n  disabled:!!document.querySelector('[data-v275-apply]')?.disabled};\n})()");
 if(overhangStart.disabled||overhangStart.alertText||!overhangStart.preview.includes('Überhang'))
   throw Error('Inserting extra lesson still blocked at year end: '+JSON.stringify(overhangStart));
 const overhangEnd=await evaluate("(async()=>{\n document.querySelector('[data-v275-apply]').click();\n for(let i=0;i<50&&!state.sequences.find(q=>q.id==='smoke-overhang-seq')?.plan.find(u=>u.id==='final')?.overflowV280;i++)\n  await new Promise(r=>setTimeout(r,100));\n const q=state.sequences.find(x=>x.id==='smoke-overhang-seq');\n const final=q.plan.find(x=>x.id==='final'),ready=q.plan.find(x=>x.id==='ready');\n const l=state.lessons.find(x=>x.id==='smoke-overhang-final');\n modal={type:'sequence',id:q.id};view='sequences';render();\n return {prep:q.plan.find(x=>x.id==='prep')?.plannedDate,ready:ready?.plannedDate,\n  final:final?.plannedDate,overflow:!!final?.overflowV280,\n  skipped:!!final?.skippedThisYearV201,lessonDate:l?.date,\n  material:l?.materials?.[0],print:l?.printPlan?.[0]?.id,\n  visible:!!document.querySelector('.v280-overflow'),\n  editable:!!document.querySelector('.v280-overflow [data-v275-unit]')};\n})()");
 if(overhangEnd.prep!==overhangStart.first||overhangEnd.ready!==overhangStart.last||
   overhangEnd.final!==''||!overhangEnd.overflow||overhangEnd.skipped||
   overhangEnd.lessonDate!==''||overhangEnd.material!=='material-final'||
   overhangEnd.print!=='print-final'||!overhangEnd.visible||!overhangEnd.editable)
   throw Error('Year-end overflow lost prepared materials or active unit: '+JSON.stringify({overhangStart,overhangEnd}));
 console.log('Prepared end-of-year lesson moved into active, editable overflow without material loss');

 // Per-lesson choice: replace planned worksheets with own PDFs; old files and
 // another lesson using them remain untouched. ChatGPT ZIP contains ONLY
 // selected active worksheets and gives proper image/diagram guidance.
 const worksheetSeed=await evaluate(`(async()=>{
   const cid='smoke-worksheets-v276',lid='smoke-material-lesson-v276',oldMat='smoke-old-mat-v276';
   state.classes.push({id:cid,name:'7e',subject:'Religion',students:24});
   state.sequences.push({id:'smoke-seq-v276',classId:cid,title:'Reformation',
     schoolYearV190:'2026/27',plan:[{id:'smoke-unit-v276',title:'Vier Soli',plannedDate:'2026-11-09',
       material:'AB Soli · Originalblatt'}]});
   const ov={id:'original-v276',type:'standard',label:'Original',
     available:true,fileName:'Original_Soli.pdf',fileKey:'smoke-old-worksheet-blob-v276'};
   await fileStorePut(ov.fileKey,new File(['OLD PRIVATE MATERIAL TEST'],'Original_Soli.pdf',{type:'application/pdf'}));
   storedFileKeys.add(ov.fileKey);
   state.materials.push({id:oldMat,title:'AB Soli · Originalblatt',
     kind:'file',resourceType:'print',variants:[ov],assignments:[{classId:cid}]});
   const primary={id:lid,classId:cid,kind:'course',source:'timetable',date:'2026-11-09',
    slot:1,period:'1.',title:'Vier Soli',status:'open',sequenceId:'smoke-seq-v276',
    planReference:{unitId:'smoke-unit-v276',title:'Vier Soli',
      material:'AB Soli · Originalblatt',autoMatched:true},materials:[oldMat],
    phasePlan:[],slides:[],prepTasks:[],printPlan:[]};
   state.lessons.push(primary);
   const other={...structuredClone(primary),id:'smoke-other-lesson-v276',date:'2026-11-16'};
   state.lessons.push(other);
   ensurePlan(primary,oldMat,ov.id).needed=true;
   ensurePlan(other,oldMat,ov.id).needed=true;
   await saveState();
   openWizardV14(lid,1);
   return {replaceButton:!!document.querySelector('[data-v276-replace]'),
      oldJob:primary.printPlan[0].needed,oldKey:ov.fileKey};
 })()`);
 if(!worksheetSeed.replaceButton||!worksheetSeed.oldJob)
   throw Error('Cannot select alternative worksheet in lesson wizard: '+JSON.stringify(worksheetSeed));
 const worksheetReplaced=await evaluate(`(async()=>{
   const upload=document.querySelector('[data-v276-replace]');
   const dt=new DataTransfer();
   dt.items.add(new File(['SYNTHETIC WORKSHEET'],'Meine_Soli_Uebung.pdf',{type:'application/pdf'}));
   dt.items.add(new File(['SYNTHETIC GRAPHIC'],'Soli_Schaubild.png',{type:'image/png'}));
   upload.files=dt.files;upload.dispatchEvent(new Event('change'));
   for(let i=0;i<40&&!state.lessons.find(l=>l.id==='smoke-material-lesson-v276')
      ?.worksheetChoicesV276;i++)await new Promise(r=>setTimeout(r,100));
   const l=state.lessons.find(l=>l.id==='smoke-material-lesson-v276');
   const other=state.lessons.find(l=>l.id==='smoke-other-lesson-v276');
   const current=SchulcockpitWorksheetChoiceV276.activeFiles(l);
   return {chosen:current.map(x=>x.name),oldActive:current.some(x=>x.name==='Original_Soli.pdf'),
    oldPrintNeeded:l.printPlan.find(p=>p.materialId==='smoke-old-mat-v276')?.needed,
    otherPrintNeeded:other.printPlan.find(p=>p.materialId==='smoke-old-mat-v276')?.needed,
    originalFileExists:!!(await fileStoreGet('smoke-old-worksheet-blob-v276')),
    countNew:l.printPlan.filter(p=>p.needed).length};
 })()`);
 if(worksheetReplaced.chosen.length!==2||worksheetReplaced.oldActive||
    worksheetReplaced.oldPrintNeeded||!worksheetReplaced.otherPrintNeeded||
    !worksheetReplaced.originalFileExists||worksheetReplaced.countNew!==2)
   throw Error('Alternative AB selection affected old material or other lesson: '+JSON.stringify(worksheetReplaced));
 const worksheetZip=await evaluate(`(async()=>{
   const l=state.lessons.find(l=>l.id==='smoke-material-lesson-v276');
   wizardV14.step=2;render();
   if(!document.querySelector('[data-v276-export]'))throw Error('ChatGPT materials ZIP not shown');
   let blob=null;const old=downloadBlob;
   downloadBlob=(name,b)=>{blob=b;};
   try{
     document.querySelector('[data-v276-export]').click();
     for(let i=0;i<45&&!blob;i++)await new Promise(r=>setTimeout(r,100));
   }finally{downloadBlob=old;}
   if(!blob)throw Error('No ChatGPT ZIP created');
   const zip=await JSZip.loadAsync(blob);
   const prompt=await zip.file('00_PROMPT_Stundenplanung.md').async('string');
   const materialFiles=Object.keys(zip.files).filter(n=>n.startsWith('Aktive_Materialien/')&&!zip.files[n].dir);
   const contents=await Promise.all(materialFiles.map(p=>zip.file(p).async('string')));
   const image=await v13ResolveImage({imageMaterial:'Soli_Schaubild.png'});
   return {visualFile:image?.name,promptReplacement:prompt.includes('Meine_Soli_Uebung.pdf')&&prompt.includes('Original_Soli.pdf'),
    promptVisuals:prompt.includes('Schaubilder')&&prompt.includes('imageMaterial'),
    sourceCount:materialFiles.length,hasOld:materialFiles.some(n=>n.includes('Original_Soli')),
    contents:contents.sort()};
 })()`);
 if(worksheetZip.visualFile!=='Soli_Schaubild.png'||!worksheetZip.promptReplacement||!worksheetZip.promptVisuals||
    worksheetZip.sourceCount!==2||worksheetZip.hasOld||
    !worksheetZip.contents.includes('SYNTHETIC WORKSHEET')||
    !worksheetZip.contents.includes('SYNTHETIC GRAPHIC'))
   throw Error('ChatGPT planning package not based on chosen real ABs: '+JSON.stringify(worksheetZip));
 console.log('Lesson-specific AB replacement changes print+prompt, preserves other course materials and ZIP includes chosen files');
 const worksheetUndone=await evaluate(`(async()=>{
   const l=state.lessons.find(l=>l.id==='smoke-material-lesson-v276');
   wizardV14.step=1;render();
   const btn=document.querySelector('[data-v276-original]');
   if(!btn)throw Error('No option to restore original worksheet');
   btn.click();
   for(let i=0;i<30&&l.worksheetChoicesV276&&Object.keys(l.worksheetChoicesV276).length;i++)
     await new Promise(r=>setTimeout(r,100));
   const selected=SchulcockpitWorksheetChoiceV276.activeFiles(l).map(x=>x.name);
   return {selected,rows:allResourceRowsV176(l).map(r=>({hint:r.hint,bundle:(r.bundleItemsV176||[]).map(x=>x.v?.fileName),mat:r.material?.title})),originalSelected:selected.includes('Original_Soli.pdf'),
     replacementExcluded:!selected.includes('Meine_Soli_Uebung.pdf'),
     originalPrintJob:l.printPlan.find(x=>x.materialId==='smoke-old-mat-v276')?.needed,
     newPrintJobs:l.printPlan.filter(x=>x.materialId!=='smoke-old-mat-v276'&&x.needed).length,
     replacementFilesStillStored:state.materials.filter(m=>m.source?.startsWith('Eigenes Ersatzarbeitsblatt')).length>=2};
 })()`);
 if(!worksheetUndone.originalSelected||!worksheetUndone.replacementExcluded||
    !worksheetUndone.originalPrintJob||worksheetUndone.newPrintJobs||
    !worksheetUndone.replacementFilesStillStored)
   throw Error('Reverting an alternative worksheet did not restore original print choice: '+JSON.stringify(worksheetUndone));


 const worksheetFlow=await evaluate("(async()=>{\n const saved=structuredClone(state),oldView=view,oldModal=modal,oldWizard=structuredClone(wizardV14);\n const oldLessonId=v182LessonId;\n try{\n  const cid='smoke-v306-math';\n  state.classes.push({id:cid,name:'5f',subject:'Mathematik',students:25});\n  const names=['6 Fachbegriffe Division','Halbschriftliche Division','Schriftliche Division'],\n   mids=names.map((_,i)=>'smoke-v306-m'+i);\n  for(let i=0;i<3;i++)state.materials.push({\n   id:mids[i],title:names[i],kind:'file',resourceType:'print',source:'Synthetic browser fixture',\n   assignments:[],variants:[{id:'std',type:'standard',fileName:names[i]+'.pdf',fileKey:'unused-v306-'+i}]\n  });\n  const bundles=()=>Object.fromEntries(names.map((n,i)=>[resourceKeyV14(n),\n   {title:n,items:[{id:'item-'+i,materialId:mids[i],variantId:'std'}],complete:true}]));\n  const prints=()=>mids.map((id,i)=>({id:'plan'+i,materialId:id,variantId:'std',needed:true,\n   count:25,alreadyPrinted:false,mode:'bw'}));\n  const make=(id,date,status)=>({id,classId:cid,date,slot:1,period:'1',kind:'course',status,\n   title:'Division',planReference:{title:'Division',material:names.join('\\n')},\n   materials:[...mids],resourceBundlesV176:bundles(),printPlan:prints(),slides:[],phasePlan:[],\n   plannedSteps:[],completedSteps:[],prepTasks:[]});\n  const prev=make('smoke-v306-prev','2026-10-29','done'),\n   next=make('smoke-v306-next','2026-11-02','open');\n  prev.printPlan.forEach(p=>p.alreadyPrinted=true);\n  const rs=SchulcockpitWorksheetActualV305.rows(prev);\n  if(rs.length!==3)throw Error('Expected 3 source ABs; got '+rs.length);\n  prev.worksheetActualV305=SC_WORKSHEET_ACTUAL_V305.refine({items:{\n   [rs[0].id]:{status:'complete',printed:'yes'},\n   [rs[1].id]:{status:'partial',printed:'yes',follow:'continue'},\n   [rs[2].id]:{status:'unused',printed:'yes',follow:'stop'}\n  }},null,rs);\n  state.lessons.push(prev,next);state.settings.activeWeekStart='2026-11-02';\n  const modes=SchulcockpitWorksheetFlowV306.effective(next).hits.map(x=>x.mode);\n  const sources=lessonResourcesV14(next).map(x=>({hint:x.hint,type:x.type}));\n  const print=printItems().filter(x=>x.lesson.id===next.id).length;\n  const missing=missingPrintFilesForLesson(next).length;\n  const prompt=concretePlanningPromptV12(next);\n  // Simulate the user's prior V305 \"Aus dieser Stunde entfernen\" action:\n  // the old warning vanished but stale l.materials links survived.\n  const legacy=make('smoke-v306-legacy','2026-11-03','open');\n  const oldHint=resourceKeyV14(names[2]),id=rs[2].id;\n  legacy.hiddenResourceKeysV183=[oldHint];\n  legacy.resourceOverrides={[oldHint]:'ignore'};\n  legacy.printPlan[2].needed=false;legacy.printPlan[2]._v183removed=true;\n  legacy.worksheetReuseV305={repeat:[],suppressed:{\n   [id]:{sourceId:id,title:names[2]+'.pdf',hint:names[2],\n    originalType:'print',originallyHidden:false,plans:[{materialId:mids[2],variantId:'std'}]}\n  }};\n  state.lessons.push(legacy);\n  const legacyLinks=v182RelevantMaterials(legacy).map(x=>x.title);\n  view='lessonDayV182';v182LessonId=next.id;modal=null;render();\n  const panel=!!document.querySelector('.v306-next-summary');\n  view='lessonDayV182';v182LessonId=prev.id;render();\n  const selectors=document.querySelectorAll('[data-v306-actual]').length;\n  document.querySelector('[data-v182-save-reflection]')?.click();\n  for(let i=0;i<60&&view!=='week';i++)await new Promise(r=>setTimeout(r,50));\n  return {modes,sources,print,missing,panel,selectors,legacyLinks,week:state.settings.activeWeekStart,\n   ended:view==='week',\n   prompt:prompt.includes('Halbschriftliche Division')&&prompt.includes('KEINE neue Kopie')&&prompt.includes('Nicht erneut'),\n   originals:next.printPlan.every(p=>p.needed)&&prev.printPlan.every(p=>p.alreadyPrinted)};\n }finally{\n  state=saved;view=oldView;modal=oldModal;wizardV14=oldWizard;v182LessonId=oldLessonId;\n  await saveState();render();\n }\n})()");
 if(worksheetFlow.modes.join('|')!=='done|carry|done'||worksheetFlow.sources.length!==1||
    worksheetFlow.sources[0].type!=='reference'||worksheetFlow.print!==0||
    worksheetFlow.missing!==0||!worksheetFlow.panel||worksheetFlow.selectors!==3||
    !worksheetFlow.ended||worksheetFlow.week!=='2026-10-26'||
    !worksheetFlow.prompt||!worksheetFlow.originals||
    worksheetFlow.legacyLinks.some(x=>x.includes("Schriftliche Division")))
   throw Error('Real-browser worksheet completion and return-to-week: '+JSON.stringify(worksheetFlow));
 console.log('Three Division worksheets: completed removed, partial continued without copies, compact reflection returns to past week');

 const temporaryCourse=await evaluate("(async()=>{\n const original=structuredClone(state),previousView=view,previousModal=modal,prevLesson=v182LessonId;\n try{\n  const C=SC_TEMP_COURSE_V307,api=window.SchulcockpitTemporaryCoursesV307;\n  state.lessons=[];state.timetable=[{id:'tt-original-v307',weekday:1,slot:2,period:'3. Block',classId:'normal-v307'}];\n  state.classes=[{id:'normal-v307',name:'5f',subject:'Mathematik',students:26}];\n  state.materials=[{id:'temp-m9',title:'Lineare Funktionen 9.pdf',\n   hubV237:{subject:'Mathematik',grade:9,kind:'arbeitsblatt'},\n   resourceType:'print',variants:[{id:'standard',type:'standard',fileName:'Lineare Funktionen 9.pdf',fileKey:'fake-m9'}]}];\n  state.materialCatalog=[{catalogId:'temp-archive-9',fileName:'Mathe 9 Jahrgangspool.pdf',\n   hubV237:{subject:'Mathematik',grade:9,kind:'arbeitsblatt'},sourceArchive:'Mathematik9.zip'}];\n  state.quickTeachingV304=[{id:'temporary-course-v307',title:'Mathe 9 Elternzeit',subject:'Mathematik',\n   grade:'9b',type:'temporary',sessions:[],\n   temporaryV307:C.config({startDate:'2026-11-09',endDate:'2026-12-06',\n    slots:[{weekday:1,slot:2},{weekday:4,slot:4}],\n    examDate:'2026-11-26',examTitle:'Klausur · Lineare Funktionen',\n    topic:'Lineare Funktionen',workMode:'Kurzer Einstieg; Kinder arbeiten selbstständig',\n    courseMaterials:['m:temp-m9','c:temp-archive-9']})}];\n  const g=state.quickTeachingV304[0],base=JSON.stringify(state.timetable);\n  const created=api.sync(g,{start:'2026-11-09',end:'2026-12-06'});\n  const monday=C.lessonId(g.id,'2026-11-09',2),l=lesson(monday);\n  const resources=api.materialOptions(g).map(x=>x.ref);\n  api.addRef(l,'m:temp-m9');api.addRef(l,'c:temp-archive-9');\n  const files=v182RelevantMaterials(l).map(x=>x.title);\n  const noPrint=!l.printPlan?.length;\n  state.settings.activeWeekStart='2026-11-09';\n  view='week';modal=null;render();\n  const weeklyCards=document.querySelectorAll('.v182-week-card .v307-card-label').length;\n  const inWeek=currentWeekLessons().filter(x=>x.temporaryV307).length;\n  view='timetable';render();\n  const chips=document.querySelectorAll('.v307-schedule-chip').length;\n  const scheduleSummary=document.querySelector('.v307-schedule-summary')?.textContent||'';\n  view='quickTeachingV304';render();\n  const hubPicker=!!document.querySelector('#v307-search');\n  const listed=document.querySelector('.v307-pool')?.textContent||'';\n  const exam=lesson(C.lessonId(g.id,'2026-11-26',4));\n  const examValid=exam?.quickExamV307&&exam.objective===''&&exam.title.includes('Klausur');\n  l.status='done';l.title='Eigene erprobte Stunde';\n  g.temporaryV307.endDate='2026-12-20';\n  const extended=api.sync(g,{start:'2026-12-07',end:'2026-12-20'});\n  const kept=lesson(monday).title==='Eigene erprobte Stunde'&&lesson(monday).status==='done';\n  const prompt=C.coursePrompt(g,state.lessons,api.materialOptions(g),{start:'2026-11-09',end:'2026-12-06'});\n  return {created,weeklyCards,inWeek,chips,hubPicker,listed:listed.includes('Mathe 9 Jahrgangspool'),\n   resources,files,noPrint,examValid,extended,kept,\n   stableTimetable:JSON.stringify(state.timetable)===base,\n   prompt:prompt.includes('2026-11-26')&&prompt.includes('selbstständig')&&prompt.includes('Lineare Funktionen 9.pdf')};\n }finally{\n  state=original;view=previousView;modal=previousModal;v182LessonId=prevLesson;\n  await saveState();render();\n }\n})()");
 if(temporaryCourse.created!==8||temporaryCourse.weeklyCards!==2||
   temporaryCourse.inWeek!==2||temporaryCourse.chips!==2||
   !temporaryCourse.hubPicker||!temporaryCourse.listed||
   !temporaryCourse.resources.includes('m:temp-m9')||
   !temporaryCourse.resources.includes('c:temp-archive-9')||
   temporaryCourse.files.length!==2||!temporaryCourse.noPrint||
   !temporaryCourse.examValid||temporaryCourse.extended!==4||
   !temporaryCourse.kept||!temporaryCourse.stableTimetable||!temporaryCourse.prompt)
   throw Error('Four-week temp-course in real browser: '+JSON.stringify(temporaryCourse));
 console.log('Temporary course: 2 weekly slots in timetable + Meine Woche, Mathe 9 Hub/archives, exam, 4-week prompt and extension without base timetable edits');

 const fidelity=await evaluate("(async()=>{\n const old=structuredClone(state),oldView=view,oldModal=modal,oldLessonId=v182LessonId;\n try{\n  const a=window.SchulcockpitMaterialRealityV308;\n  state.classes=[{id:'m5v308',name:'5f',subject:'Mathematik',students:27}];\n  state.materials=[];state.materialCatalog=[];state.sequences=[];\n  state.timetable=[{id:'tt308',classId:'m5v308',weekday:1,slot:1,period:'2. Stunde'}];\n  const previous={id:'prev308',classId:'m5v308',date:'2026-11-03',slot:1,\n   status:'done',source:'manual',title:'Division mit Rest',\n   planReference:{title:'Division mit Rest',material:'Buch S. 32 Nr. 1–4'},\n   materials:[],printPlan:[],slides:[],phasePlan:[],prepTasks:[]};\n  const row={id:'h:buch s 32 nr 1 4',hint:'Buch S. 32 Nr. 1–4',title:'Buch S. 32 Nr. 1–4'};\n  previous.worksheetActualV305={snapshot:[row],items:{\n   [row.id]:{status:'partial',follow:'later',printed:'unknown'}\n  }};\n  const next={id:'target308',classId:'m5v308',date:'2026-11-09',slot:1,\n   source:'manual',status:'open',title:'Halbschriftliche Division',materials:[],\n   planReference:{title:'Halbschriftliche Division',content:'Division und Rest',\n    material:'AB 6 Fachbegriffe Division\\nAB halbschriftliche Division'},\n   customResourceHintsV176:['Buch S. 42 Nr. 1–4','Arbeitsheft S. 21 Nr. 5–7'],\n   printPlan:[],slides:[],phasePlan:[],prepTasks:[]};\n  state.lessons=[previous,next];state.settings.activeWeekStart='2026-11-09';\n  v183DeleteFromLesson(next,'AB 6 Fachbegriffe Division');\n  v183DeleteFromLesson(next,'AB halbschriftliche Division');\n  const active=a.resources(next).map(r=>r.hint);\n  const prompt=concretePlanningPromptV12(next);\n  const wizard=wizardPlanStepV14(next);\n  const before=a.deferrals(next);\n  if(before.length!==1)throw Error('Expected 1 book page parked for later, got '+before.length);\n  a.attach(next,before[0].key);\n  const after=a.resources(next).map(x=>x.hint);\n  const later=concretePlanningPromptV12(next);\n  const day=v182LessonDayHtml(next);\n  const noExtraPrint=next.printPlan.length===0;\n  const evidence=SC_PLAN_SOURCES_V309.status({\n   importedFromV184:'2026-11-04',title:'Teiler/Vielfache'});\n  return {active,promptGhost:prompt.includes('AB 6 Fachbegriffe Division')||\n    prompt.includes('AB halbschriftliche Division'),\n   promptBooks:prompt.includes('Buch S. 42 Nr. 1–4')&&prompt.includes('Arbeitsheft S. 21 Nr. 5–7'),\n   promptStrict:prompt.includes('Erfinde KEINE alternativen Rechenaufgaben'),\n   wizardSettings:wizard.includes('data-v308-count')&&wizard.includes('data-v308-mode'),\n   wizardGhost:wizard.includes('AB 6 Fachbegriffe Division')||wizard.includes('AB halbschriftliche Division'),\n   before:before.length,after,later:later.includes('NUR den damals nicht geschafften Teil'),\n   dayActive:day.includes('Aktuell für diese Stunde:')&&day.includes('Buch S. 42'),\n   noExtraPrint,evidence,history:previous.worksheetActualV305.items[row.id].follow==='later',\n   originalPlan:next.planReference.material.includes('AB 6 Fachbegriffe Division')};\n }finally{\n  state=old;view=oldView;modal=oldModal;v182LessonId=oldLessonId;\n  await saveState();render();\n }\n})()");
 if(fidelity.active.length!==2||fidelity.promptGhost||!fidelity.promptBooks||
   !fidelity.promptStrict||!fidelity.wizardSettings||fidelity.wizardGhost||fidelity.before!==1||
   fidelity.after.length!==3||!fidelity.later||!fidelity.dayActive||
   !fidelity.noExtraPrint||fidelity.evidence!=='unverified'||
   !fidelity.history||!fidelity.originalPlan)
   throw Error('Active worksheets vs hidden original, overdue book/AH and source caution: '+JSON.stringify(fidelity));
 console.log('Material reality: removed AB absent from prompt, self-added book/AH mandatory, deferred book pages explicitly carried, cognitive settings present, old Soll preserved');

 // Disposable Safari→Firefox simulation: serialize the exact IndexedDB stores,
 // clear the browser profile, then import the encrypted package.
 const migration=await evaluate(`(async()=>{
   const pw='synthetic-smoke-password-123';
   const key='smoke-transfer-pdf';
   await fileStorePut(key,new File(['synthetic file contents'],'test.pdf',{type:'application/pdf'}));
   await saveState();
   let archived=null;
   const originalDownload=downloadBlob;
   downloadBlob=(name,blob)=>{archived=blob;};
   try{await SchulcockpitTransferV264.exportAll(pw);}
   finally{downloadBlob=originalDownload;}
   if(!archived)throw Error('No encrypted transfer package created');
   const json=JSON.parse(await archived.text());
   if(JSON.stringify(json).includes('synthetic file contents'))throw Error('Export leaks plaintext');
   const clear=name=>new Promise((resolve,reject)=>{
     const req=indexedDB.open(name);
     req.onsuccess=()=>{const db=req.result,stores=Array.from(db.objectStoreNames);
       if(!stores.length){db.close();resolve();return;}
       const tx=db.transaction(stores,'readwrite');
       for(const store of stores)tx.objectStore(store).clear();
       tx.oncomplete=()=>{db.close();resolve();};
       tx.onerror=()=>{db.close();reject(tx.error);};
     };
     req.onerror=()=>reject(req.error);
   });
   v186Ready=false; // simulation of a fresh target browser; prevents source-side autosaves
   await new Promise(resolve=>setTimeout(resolve,1200));
   await clear('schulcockpit-state-v2');
   await clear('schulcockpit-files-v1');
   await clear('schulcockpit-assessment-private-v1');
   localStorage.removeItem('schulcockpit-state-v1');
   state={settings:{schoolYear:'2026/27'},classes:[],lessons:[],sequences:[],materials:[],materialCatalog:[],assessments:[],timetable:[],backlog:[]};
   await fileStorePut('old-firefox-v1',new File(['firefox only'],'stale.txt'));
   await v200PrivatePut({assessmentId:'old-private-v1',roster:[{id:'old',name:'Synthetic Firefox-Only'}]});
   const oldWasPresent=!!(await fileStoreGet('old-firefox-v1'));
   const restored=await SchulcockpitTransferV264.importAll(archived,pw,{replace:true});
   const oldFileDeleted=!(await fileStoreGet('old-firefox-v1'));
   const oldPrivateDeleted=!(await v200PrivateGet('old-private-v1'))?.roster?.length;
   const file=await fileStoreGet(key);
   const privateRec=await v200PrivateGet(v235Key('smoke-m5f'));
   const snapshot=await v186DbGet();
   return {restored,oldWasPresent,oldFileDeleted,oldPrivateDeleted,
    fileText:file?.blob?await file.blob.text():'',privateCount:privateRec?.roster?.length||0,
    planning:!!snapshot?.json&&JSON.parse(snapshot.json).classes.some(x=>x.id==='smoke-m5f')};
 })()`);
 if(!migration.planning||!migration.oldWasPresent||!migration.oldFileDeleted||
    !migration.oldPrivateDeleted||migration.privateCount!==3||migration.fileText!=='synthetic file contents')
   throw Error('Full encrypted browser transfer roundtrip failed: '+JSON.stringify(migration));
 console.log('Encrypted browser transfer roundtrip with planner, Blob and private roster passed');
 const migrationV2=await evaluate("(async()=>{\n const pw='synthetic-safe-v2-secret-2026';\n view='focus';modal=null;render();\n const big=new Uint8Array(12*1024*1024);big.fill(73);\n await fileStorePut('smoke-big-v285',new File([big],'larger-material.pdf',{type:'application/pdf'}));\n const result=await SchulcockpitTransferV285.exportAll(pw);\n const file=SchulcockpitTransferV285.getExportFile();\n const link=document.getElementById('v285-download');\n if(!file||!link?.href||link.hidden)throw Error('No clickable V2 download link');\n const head=await file.slice(0,4).text();\n const checked=await SchulcockpitTransferV285.scan(file,pw);\n let truncated=false;\n try{await SchulcockpitTransferV285.scan(file.slice(0,file.size-29),pw);}\n catch(err){truncated=true;}\n let wrongPassword=false;\n try{await SchulcockpitTransferV285.scan(file,'wrong test passphrase 2026');}\n catch(err){wrongPassword=/Kennwort falsch|Sicherung beschädigt/.test(String(err));}\n let refusedNonempty=false;\n await fileStorePut('smoke-guard-existing-v286',new File(['existing data'],'existing.txt'));\n try{await SchulcockpitTransferV285.importAll(file,pw);}\n catch(err){refusedNonempty=/bereits Daten vorhanden/.test(String(err));}\n finally{await fileStoreDelete('smoke-guard-existing-v286');}\n if(!refusedNonempty)throw Error('V2 imported into populated data store!');\n const clear=name=>new Promise((resolve,reject)=>{\n  const req=indexedDB.open(name);\n  req.onsuccess=()=>{const db=req.result,stores=Array.from(db.objectStoreNames);\n   const tx=db.transaction(stores,'readwrite');\n   for(const store of stores)tx.objectStore(store).clear();\n   tx.oncomplete=()=>{db.close();resolve();};\n   tx.onerror=()=>{db.close();reject(tx.error);};\n  };\n  req.onerror=()=>reject(req.error);\n });\n v186Ready=false;\n await new Promise(resolve=>setTimeout(resolve,400));\n for(const n of ['schulcockpit-state-v2','schulcockpit-files-v1','schulcockpit-assessment-private-v1'])\n  await clear(n);\n localStorage.removeItem('schulcockpit-state-v1');\n state={settings:{schoolYear:'2026/27'},classes:[],lessons:[],sequences:[],materials:[],\n  materialCatalog:[],assessments:[],timetable:[],backlog:[]};\n await fileStorePut('__material_catalog_manifest_v171__',new File([JSON.stringify({\n  kind:'schulcockpit-material-catalog-local',entries:[],meta:{}\n })],'materialkatalog-local.json',{type:'application/json'}));\n await v200PrivatePut({assessmentId:'__sc_masterclass_v251__:index',\n  schema:'schulcockpit.private-master-index.v1',classes:[]});\n const safeTarget=await SchulcockpitTransferV264.destinationEmpty();\n await fileStorePut('old-firefox-v2',new File(['old Firefox only'],'old-v2.txt'));\n await v200PrivatePut({assessmentId:'old-private-v2',roster:[{id:'old',name:'Synthetic Firefox-Only'}]});\n const preOverwrite=await SchulcockpitTransferV264.destinationReport();\n let badPasswordRejected=false;\n try{await SchulcockpitTransferV285.importAll(file,'incorrect but long enough 2026',()=>{},{replace:true});}\n catch(err){badPasswordRejected=/Kennwort falsch|Sicherung beschädigt/.test(String(err));}\n const untouchedAfterBad=!!(await fileStoreGet('old-firefox-v2'))&&\n  (await v200PrivateGet('old-private-v2')).roster.length===1;\n const choiceVisible=!!document.querySelector('#v287-replace-firefox')&&\n  document.querySelector('#v287-replace-firefox').type==='checkbox';\n const count=await SchulcockpitTransferV285.importAll(file,pw,()=>{},{replace:true});\n const oldFileRemoved=!(await fileStoreGet('old-firefox-v2'));\n const oldPrivateRemoved=!(await v200PrivateGet('old-private-v2'))?.roster?.length;\n const restoredFile=await fileStoreGet('smoke-transfer-pdf');\n const restoredBig=await fileStoreGet('smoke-big-v285');\n const bigSize=restoredBig?.blob?.size;\n const firstByte=(await restoredBig.blob.slice(0,1).arrayBuffer()).byteLength?new Uint8Array(await restoredBig.blob.slice(0,1).arrayBuffer())[0]:null;\n const restoredPrivate=await v200PrivateGet(v235Key('smoke-m5f'));\n const snapshot=await v186DbGet();\n const decoded=JSON.parse(snapshot?.json||'{}');\n return {head,recordCount:result.recordCount,count,safeTarget,verified:checked.recordCount,\n  fileText:await restoredFile?.blob?.text(),privateCount:restoredPrivate?.roster?.length,\n  statePresent:decoded.classes?.some(x=>x.id==='smoke-m5f'),\n  wrongPassword,refusedNonempty,truncated,bigSize,firstByte,bytes:file.size,link:link.download,\n  preOverwriteBlocked:!preOverwrite.safe,badPasswordRejected,untouchedAfterBad,\n  choiceVisible,oldFileRemoved,oldPrivateRemoved};\n})()");
 if(migrationV2.head!=='SCB2'||!migrationV2.safeTarget||!migrationV2.statePresent||
    !migrationV2.wrongPassword||!migrationV2.refusedNonempty||
    migrationV2.privateCount!==3||migrationV2.fileText!=='synthetic file contents'||
    migrationV2.recordCount!==migrationV2.verified||
    migrationV2.count!==migrationV2.recordCount||
    !migrationV2.preOverwriteBlocked||!migrationV2.badPasswordRejected||
    !migrationV2.untouchedAfterBad||!migrationV2.choiceVisible||
    !migrationV2.oldFileRemoved||!migrationV2.oldPrivateRemoved||
    !migrationV2.truncated||migrationV2.bigSize!==12*1024*1024||migrationV2.firstByte!==73||
    !migrationV2.link.endsWith('.scbackup')||migrationV2.bytes<100)
  throw Error('Streamed V2 browser transfer did not fully round-trip: '+JSON.stringify(migrationV2));
 console.log('STREAMING V2 transfer: verified encrypted OPFS frames, manual download, private roster, binary and planning restored');
 const oldSafariWriter=await evaluate("(async()=>{\n const name='smoke-v285-worker-opfs.tmp',root=await navigator.storage.getDirectory(),\n  worker=new Worker('schulcockpit-opfs-v285-worker.js');\n let next=0;const pending=new Map();\n worker.onmessage=e=>{const r=pending.get(e.data.id);if(!r)return;pending.delete(e.data.id);\n  e.data.ok?r.resolve():r.reject(Error(e.data.error));};\n const ask=(op,bytes)=>new Promise((resolve,reject)=>{\n  const id=++next;pending.set(id,{resolve,reject});\n  if(bytes)worker.postMessage({id,op,bytes:bytes.buffer},[bytes.buffer]);\n  else worker.postMessage({id,op,name});\n });\n try{\n  await ask('open');\n  await ask('write',new TextEncoder().encode('SYNTHETIC SAFARI OPFS'));\n  await ask('close');\n  const file=await (await root.getFileHandle(name)).getFile();\n  return {ok:(await file.text())==='SYNTHETIC SAFARI OPFS',size:file.size};\n }finally{worker.terminate();await root.removeEntry(name).catch(()=>{});}\n})()");
 if(!oldSafariWriter.ok||oldSafariWriter.size!==21)
  throw Error('Older Safari worker-only OPFS writer failed: '+JSON.stringify(oldSafariWriter));
 console.log('OPFS worker fallback writes and restores bytes without createWritable');



 if(exceptions.length)throw Error('Runtime exceptions: '+exceptions.join('\n'));
 console.log('Schulcockpit browser smoke PASSED.');
}finally{
 socket?.close();chrome.kill('SIGKILL');
 // Chrome's cache subprocesses may still exit after the parent has received SIGKILL.
 // Cleanup must never mask an actual browser assertion or fail a passing test.
 try{await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150});}
 catch(e){console.warn('Temporary Chrome profile cleanup deferred:',e.message);}
}
