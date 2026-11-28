import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),port=19331;
const profile=await mkdtemp(join(tmpdir(),'sc-v3331-'));
const chrome=spawn(process.env.CHROME_BIN||'google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port='+port,'--remote-allow-origins=*','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let ws,id=0;const pending=new Map();
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expression=>{const r=(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result;if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
try{
 let target;for(let i=0;i<100&&!target;i++){try{target=(await(await fetch('http://127.0.0.1:'+port+'/json')).json()).find(x=>x.type==='page');}catch{}await sleep(100);}
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m);}};
 await send('Runtime.enable');await send('Page.navigate',{url:'http://127.0.0.1:8767/index.html'});
 for(let i=0;i<200&&!await evaluate("typeof SchulcockpitTeachingChoiceV3331==='object'");i++)await sleep(100);
 const result=await evaluate(`(async()=>{const old=structuredClone(state),oldView=view,oldModal=modal;try{
  state.settings.schoolYear='2026/27';state.classes=[{id:'r5',subject:'Religion',name:'5a'}];state.materials=[{id:'m',title:'Original',variants:[]}];
  state.sequences=[{id:'q',classId:'r5',title:'Vertrauen',schoolYearV190:'2026/27',plan:[{id:'u1',title:'KI-Idee',competencyIdsV202:['rel-5-1']},{id:'u2',title:'Eigene Alternative',objective:'Vertrauen an einer Geschichte erklären',competencyIdsV202:[]}]}];
  state.lessons=[{id:'l',classId:'r5',date:'2026-11-30',slot:1,status:'open',title:'KI-Idee',sequenceId:'q',planReference:{unitId:'u1',title:'KI-Idee',autoMatched:true},materials:['m']}];
  view='focus';modal=null;render();SchulcockpitTeachingChoiceV3331.openChoice('l');
  const panel=!!document.querySelector('.v3331-modal')&&document.querySelector('.v3331-modal').textContent.includes('UNTERRICHT SELBST AUSWÄHLEN');
  const radios=[...document.querySelectorAll('input[name="v3331-unit"]')];radios.find(x=>x.value==='u2').click();
  const preview=!!document.querySelector('[data-v3331-apply]')&&!document.querySelector('[data-v3331-apply]').disabled;
  document.querySelector('[data-v3331-apply]').click();for(let i=0;i<100&&modal!==null;i++)await new Promise(r=>setTimeout(r,30));
  state=JSON.parse(JSON.stringify(state));render();
  const saved=state.lessons[0].planReference.unitId==='u2'&&state.lessons[0].materials[0]==='m'&&state.lessons[0].planReference.autoMatched===false&&!!state.lessons[0].teacherChoiceV3331;
  view='competenciesV3331';render();const cockpit=!!document.querySelector('.v3331-cockpit')&&document.querySelector('.v3331-cockpit').textContent.includes('nicht überprüft');
  return {panel,preview,saved,cockpit,version:document.querySelector('.brand small').textContent};
 }finally{state=old;view=oldView;modal=oldModal;await saveState();render();}})()`);
 if(!result.panel||!result.preview||!result.saved||!result.cockpit||!/V0\.33\.3[12345]/.test(result.version))throw Error(JSON.stringify(result));
 console.log('V3331 browser: canonical alternative, preserved material, reload-safe marker and read-only gaps OK');
}finally{ws?.close();chrome.kill('SIGTERM');await new Promise(r=>chrome.once('exit',r));await sleep(200);await rm(profile,{recursive:true,force:true});}
