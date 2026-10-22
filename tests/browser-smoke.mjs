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
