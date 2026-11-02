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
 const scoped=await evaluate('(()=>{const s=document.querySelector("#v263-course");s.value="smoke-m5f";s.dispatchEvent(new Event("change"));return {modal:modal?.type,course:s.value,table:!!document.querySelector(".v263-movements")};})()');
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


 // Early exam preparation: last double lesson, colleagues' exam and complete local ZIP.
 const examSeed=await evaluate(`(async()=>{
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
   return {before,selected:future.checked,reference:file.checked};
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
      content:document.querySelector('.v214-file-panel')?.textContent||'',
      hasButton:!!document.querySelector('[data-v214-quick-used="f-written"]')};
 })()`);
 if(!grade6Start.hasCurriculum||!grade6Start.hasButton||!grade6Start.content.includes('Ein zusätzliches Kompetenzraster'))
   throw Error('Grade 6 introduction still requires rubric or no exam link: '+JSON.stringify(grade6Start));
 const grade6Bundle=await evaluate(`(async()=>{
   document.querySelector('[data-v214-quick-used="f-written"]').click();
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
 if(manualMove.topic!=='smoke-multiply-seq|mult1'||
     !manualMove.target?.startsWith('2026-11-02|2|')||
     !manualMove.preview.includes('Klassenarbeit'))
   throw Error('Manual switch preview missed upcoming Monday or displaced legacy topic: '+JSON.stringify(manualMove));
 const manualApply=await evaluate(`(async()=>{
   document.querySelector('[data-v275-apply]').click();
   for(let i=0;i<35&&view!=='assistant';i++)
     await new Promise(r=>setTimeout(r,100));
   const q=state.sequences.find(x=>x.id==='smoke-multiply-seq');
   const rows=Object.fromEntries(q.plan.map(u=>[u.id,u.plannedDate]));
   const l=state.lessons.find(x=>x.classId==='smoke-math5-switch'&&x.date==='2026-11-02'&&Number(lessonSlot(x))===2);
   const archived=state.lessons.find(x=>x.id==='smoke-historic-mult');
   return {view,rows,monday:l?.title,manual:!!l?.manualPinnedV272,
    planUnit:l?.planReference?.unitId,
    archivedDate:archived?.date,archivedStatus:archived?.executionV180?.type,
    archivedPrinted:archived?.printPlan?.[0]?.alreadyPrinted,
    activeWeek:state.settings.activeWeekStart,
    assistantLesson:wizardV14?.lessonId};
 })()`);
 if(manualApply.rows.mult1!=='2026-11-02'||
    manualApply.rows['placeholder-exam']!=='2026-11-05'||
    manualApply.rows.mult2!=='2026-11-09'||
    manualApply.planUnit!=='mult1'||!manualApply.manual||
    manualApply.archivedDate!=='2026-10-05'||manualApply.archivedStatus!=='cancelled'||
    !manualApply.archivedPrinted||manualApply.activeWeek!=='2026-11-02'||
    manualApply.view!=='assistant'||!manualApply.assistantLesson)
   throw Error('Manual Monday topic switch failed to preserve history or open slide preparation: '+JSON.stringify(manualApply));
 console.log('Past multiplication topic shifted to Monday, legacy classwork placeholder advanced, old worksheet record preserved, PPT wizard opened');


 // Regression: "already held or prepared" MUST NOT prevent repeating or
 // making up the same instructional topic in Monday week. Original unchanged.
 const protectedMove=await evaluate(`(async()=>{
   const cid='smoke-repeat-math5',qid='smoke-repeat-seq',day='2026-11-02';
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
       {id:'repeat-next',title:'Multiplizieren 2',plannedDate:'2026-11-05'}
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
      l.date==='2026-11-02'&&Number(lessonSlot(l))===2);
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
    protectedApplied.newDate!=='2026-11-02'||protectedApplied.newId!==protectedApplied.newLessonRef||
    !protectedApplied.pinned||protectedApplied.classworkMoved!=='2026-11-05'||
    !protectedApplied.assistant||protectedApplied.activeWeek!=='2026-11-02')
   throw Error('Re-planning protected topic lost teaching history or Monday wizard: '+JSON.stringify(protectedApplied));
 console.log('Protected/held original lesson preserved; repeated topic assigned Monday and PPT wizard opened');


 // Reporter screenshot: protected 'Dividieren verstehen' farther along the
 // sequence was blocking 'Multiplizieren 1' on Monday. Default SINGLE mode
 // must leave this protected lesson unchanged and park only Monday's placeholder.
 const divisionSafe=await evaluate(`(async()=>{
   const cid='smoke-protected-division',qid='smoke-division-seq';
   state.classes.push({id:cid,name:'5h',subject:'Mathematik',students:25});
   state.timetable.push({id:'tt-div-mon',classId:cid,weekday:1,slot:2,period:'2.',kind:'course'});
   const original={id:'mult1',title:'Multiplizieren 1 – Fachbegriffe und Grundaufgaben',
     plannedDate:'2026-10-05',content:'Grundaufgaben Multiplikation'};
   const old={id:'old-placeholder',title:'Klassenarbeit (alter Soll-Eintrag)',plannedDate:'2026-11-02'};
   const division={id:'div-safe',title:'Dividieren verstehen: aufteilen, verteilen und schriftlich beginnen',
     plannedDate:'2026-11-09',content:'Schriftliche Division'};
   state.sequences.push({id:qid,classId:cid,schoolYearV190:'2026/27',
     title:'Grundrechenarten',startDate:'2026-10-05',plan:[original,old,division]});
   state.lessons.push({id:'division-held-previous',classId:cid,date:'2026-10-05',
     status:'done',slot:2,sequenceId:qid,planReference:{unitId:'mult1',autoMatched:false},
     title:original.title,materials:['already-printed'],printPlan:[{alreadyPrinted:true}]});
   state.lessons.push({id:'division-protected',classId:cid,date:'2026-11-09',
     status:'planned',slot:2,timetableId:'tt-div-mon',sequenceId:qid,
     planReference:{unitId:'div-safe',title:division.title,autoMatched:true},
     title:division.title,phasePlan:[{title:'Geplant und geschützt'}],
     materials:[],printPlan:[],slides:[]});
   state.settings.activeWeekStart='2026-11-02';
   state.lessons.push(createBlankLessonFromTimetable(state.timetable.find(x=>x.id==='tt-div-mon')));
   const protectedBefore=JSON.stringify(state.lessons.find(l=>l.id==='division-protected'));
   const sourceBefore=JSON.stringify(original);
   await saveState();
   view='sequences';modal={type:'sequence',id:qid};render();
   document.querySelector('[data-v272-unit="'+qid+'|mult1"]').click();
   const mode=document.querySelector('[data-v274-mode]')?.value;
   const text=document.querySelector('.v275-modal')?.textContent||'';
   const disabled=document.querySelector('[data-v272-apply]')?.disabled;
   return {mode,description:text.includes('Bleibt im Plan ohne Termin'),
     divisionBlocked:text.includes('geschützte Stunde wurde verschoben'),
     canApply:!disabled,protectedBefore,sourceBefore};
 })()`);
 if(divisionSafe.mode!=='single'||!divisionSafe.description||
    divisionSafe.divisionBlocked||!divisionSafe.canApply)
   throw Error('Protected division still blocks an isolated Monday topic: '+JSON.stringify(divisionSafe));
 const divisionApplied=await evaluate(`(async()=>{
   document.querySelector('[data-v275-apply]').click();
   for(let i=0;i<45&&view!=='assistant';i++)await new Promise(r=>setTimeout(r,100));
   const q=state.sequences.find(x=>x.id==='smoke-division-seq');
   const done=state.lessons.find(l=>l.id==='division-held-previous');
   const division=state.lessons.find(l=>l.id==='division-protected');
   const original=q.plan.find(u=>u.id==='mult1');
   const repeated=q.plan.find(u=>u.repeatedFromV273==='mult1');
   const placeholder=q.plan.find(u=>u.id==='old-placeholder');
   const newMon=state.lessons.find(l=>l.classId==='smoke-protected-division'&&l.date==='2026-11-02');
   return {
    divisionUnchanged:JSON.stringify(division)===${JSON.stringify(divisionSafe.protectedBefore)},
    originalUnchanged:JSON.stringify(original)===${JSON.stringify(divisionSafe.sourceBefore)},
    oldPrinted:done?.printPlan?.[0]?.alreadyPrinted,
    parked:placeholder?.plannedDate===''&&placeholder.parkedFromV274?.date==='2026-11-02',
    repeatDate:repeated?.plannedDate,manual:!!newMon?.manualPinnedV272,
    newRef:newMon?.planReference?.unitId,repeatedId:repeated?.id,
    powerpoint:view==='assistant'&&wizardV14?.lessonId===newMon?.id
   };
 })()`);
 if(!divisionApplied.divisionUnchanged||!divisionApplied.originalUnchanged||
    !divisionApplied.oldPrinted||!divisionApplied.parked||
    divisionApplied.repeatDate!=='2026-11-02'||!divisionApplied.manual||
    divisionApplied.newRef!==divisionApplied.repeatedId||!divisionApplied.powerpoint)
   throw Error('Isolated Monday assignment changed the protected division or source: '+JSON.stringify(divisionApplied));
 console.log('Protected division untouched; Monday multiplication PPT ready, old topic parked');


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
   btn.click();
   for(let i=0;i<45&&view!=='assistant';i++)await new Promise(r=>setTimeout(r,100));
   const seq=state.sequences.find(q=>q.id==='smoke-hourly-seq');
   const target=state.lessons.find(l=>l.id==='hourly-next');
   const original=state.lessons.find(l=>l.id==='hourly-held');
   return {assistant:view==='assistant'&&wizardV14?.lessonId===target?.id,
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
   const restored=await SchulcockpitTransferV264.importAll(archived,pw);
   const file=await fileStoreGet(key);
   const privateRec=await v200PrivateGet(v235Key('smoke-m5f'));
   const snapshot=await v186DbGet();
   return {restored,fileText:file?.blob?await file.blob.text():'',privateCount:privateRec?.roster?.length||0,
    planning:!!snapshot?.json&&JSON.parse(snapshot.json).classes.some(x=>x.id==='smoke-m5f')};
 })()`);
 if(!migration.planning||migration.privateCount!==3||migration.fileText!=='synthetic file contents')
   throw Error('Full encrypted browser transfer roundtrip failed: '+JSON.stringify(migration));
 console.log('Encrypted browser transfer roundtrip with planner, Blob and private roster passed');

 if(exceptions.length)throw Error('Runtime exceptions: '+exceptions.join('\n'));
 console.log('Schulcockpit browser smoke PASSED.');
}finally{
 socket?.close();chrome.kill('SIGKILL');
 // Chrome's cache subprocesses may still exit after the parent has received SIGKILL.
 // Cleanup must never mask an actual browser assertion or fail a passing test.
 try{await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150});}
 catch(e){console.warn('Temporary Chrome profile cleanup deferred:',e.message);}
}
