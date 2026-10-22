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
],{stdio:'ignore'});
let socket=null;const pending=new Map(),exceptions=[];let nextId=0;
async function poll(fn,why,limit=20000){
 const deadline=Date.now()+limit;
 while(Date.now()<deadline){try{const v=await fn();if(v)return v;}catch(e){}await sleep(180);}
 throw Error('Timed out: '+why);
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
 if(reply.result?.exceptionDetails)throw Error(reply.result.exceptionDetails.text||'JavaScript expression failed');
 return reply.result?.result?.value;
}
try{
 const target=await poll(async()=>{
  const arr=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
  return arr.find(x=>x.type==='page');
 },'Chrome CDP page');
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
 await evaluate('(()=>{document.querySelector("#v248-names").value="Smoke Kind Eins\nSmoke Kind Zwei";document.querySelector("[data-v248-add]").click();return true;})()');
 const privateData=await poll(async()=>{
  const d=await evaluate('(async()=>{const r=await v200PrivateGet(v235Key("smoke-m5f"));return {n:r?.roster?.length||0,leak:JSON.stringify(state).includes("Smoke Kind Eins")};})()');
  return d.n===2?d:null;
 },'two private local pupils');
 if(privateData.leak)throw Error('Student names leaked into public planner state');
 console.log('Private roster stored without exposing names to main app state');
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
 await send('Page.reload',{ignoreCache:false});
 await poll(async()=>{
  const r=await evaluate('({done:typeof v186Ready!=="undefined"&&v186Ready,loading:!!document.querySelector("#sc-v186-load")})');
  return r.done&&!r.loading;
 },'reload of persistent IndexedDB data',30000);
 const afterReload=await evaluate('(async()=>{const r=await v200PrivateGet(v235Key("smoke-m5f"));return {course:!!cls("smoke-m5f"),students:r?.roster?.length||0,publicNames:JSON.stringify(state).includes("Smoke Kind Eins")};})()');
 if(!afterReload.course||afterReload.students!==2||afterReload.publicNames)
  throw Error('Persisted Fachkurs / private roster reload failed: '+JSON.stringify(afterReload));
 await evaluate('(()=>{v184Open("smoke-m5f");return true;})()');
 const restored=await poll(async()=>{
  const x=await evaluate('({step:v184Flow.step,raw:v184Flow.raw,prompt:v184Flow.prompt})');
  return x.step===1?x:null;
 },'sequence wizard after browser restart');
 if(restored.prompt!=='SMOKE PROMPT'||restored.raw!=='SMOKE ANSWER')
  throw Error('Persisted sequence draft lost after reload: '+JSON.stringify(restored));
 console.log('Browser restart: private roster and sequence draft recovered');
 const planning=await evaluate('(()=>{view="sequences";modal=null;render();return {sidebar:!!document.querySelector(".sidebar nav"),year:!!document.querySelector(".v190-year-plan")};})()');
 if(!planning.sidebar||!planning.year)throw Error('Year planning page failed: '+JSON.stringify(planning));
 console.log('Year planning page passed');
 const annual=await evaluate('(()=>{const c=state.classes?.find(x=>x.subject&&x.id);if(!c)return {skipped:true};openFlow(c.id,false);return {modal:modal?.type,dialog:!!document.querySelector(".v236-modal")};})()');
 if(!annual.skipped&&(!annual.dialog||annual.modal!=='annualV236'))throw Error('Annual modal failed: '+JSON.stringify(annual));
 console.log('Annual modal passed',annual);
 if(exceptions.length)throw Error('Runtime exceptions: '+exceptions.join('\n'));
 console.log('Schulcockpit browser smoke PASSED.');
}finally{
 socket?.close();chrome.kill('SIGKILL');
 await rm(profile,{recursive:true,force:true});
}
