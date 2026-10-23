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
 const roster=await evaluate('(()=>{const b=document.querySelector("[data-v248-nav]");if(!b)return {button:false};b.click();return {button:true,title:document.querySelector(".topbar h1")?.textContent||""};})()');
 if(!roster.button||!roster.title.includes('Klassenlisten'))throw Error('Private roster navigation failed: '+JSON.stringify(roster));
 console.log('Roster navigation passed');
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
 const planned=await evaluate('(async()=>{const y="2026/27",key="smoke-m5f|"+y;state.yearAssessmentPlansV244=state.yearAssessmentPlansV244||{};state.yearAssessmentPlansV244[key]=[SC_YEAR_RULES_V244.tidy({id:"a1",half:1,type:"klassenarbeit",mode:"papier",status:"offen",topic:""}),SC_YEAR_RULES_V244.tidy({id:"fixed",half:1,type:"klassenarbeit",status:"fest",topic:"Grundrechenarten I",confirmedDate:"2026-10-30",assessmentId:"existing-fixed"})];await saveState();modal=null;render();const b=[...document.querySelectorAll("[data-v236-rules]")].find(x=>x.dataset.v236Rules==="smoke-m5f");if(!b)return {found:false};b.click();return {found:true,topics:document.querySelectorAll("[data-v245-topic]").length,oldHelper:!!document.querySelector("[data-v252-propose]"),wishFields:document.querySelectorAll("[data-v244-field$=\"|proposedDate\"]").length};})()');
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
 const milestone=await evaluate('(()=>{const date=document.querySelector("#v257-milestone-date");const title=document.querySelector("#v257-milestone-title");date.value="2027-01-20";title.value="Notenschluss";document.querySelector("[data-v257-add]").click();return true;})()');
 if(!milestone)throw Error('Milestone control missing');
 await poll(async()=>evaluate('(state.yearMilestonesV257?.["2026/27"]||[]).some(x=>x.title==="Notenschluss")'),
   'saving school milestone');
 console.log('School milestone persists separately from blocked teaching days');
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


 if(exceptions.length)throw Error('Runtime exceptions: '+exceptions.join('\n'));
 console.log('Schulcockpit browser smoke PASSED.');
}finally{
 socket?.close();chrome.kill('SIGKILL');
 // Chrome's cache subprocesses may still exit after the parent has received SIGKILL.
 // Cleanup must never mask an actual browser assertion or fail a passing test.
 try{await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150});}
 catch(e){console.warn('Temporary Chrome profile cleanup deferred:',e.message);}
}
