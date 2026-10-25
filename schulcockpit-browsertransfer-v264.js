/* V0.26.4 – Browserwechsel. Sicherung enthält alle drei App-Datenbanken und Dateien.
   Export aus Safari, Import ausschließlich in eine leere Firefox-Installation.
   Keine Daten werden an einen Server übertragen. */
(function(){
'use strict';
const DB_NAMES=['schulcockpit-state-v2','schulcockpit-files-v1','schulcockpit-assessment-private-v1'];
const SCHEMA='schulcockpit.browser-transfer.v1';
const LIMIT=750*1024*1024;
const STORAGE='schulcockpit-state-v1';
let working=false;
function fail(msg){throw Error(msg);}
function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s);}
function from64(s){return Uint8Array.from(atob(s),x=>x.charCodeAt(0));}
function openExisting(name){return new Promise((resolve,reject)=>{
 const req=indexedDB.open(name);let created=false;
 req.onupgradeneeded=()=>{created=true;req.transaction.abort();};
 req.onsuccess=()=>resolve(req.result);
 req.onerror=()=>created?resolve(null):reject(req.error);
 req.onblocked=()=>reject(Error('Bitte andere Schulcockpit-Tabs schließen.'));
});}
function readStore(db,store){return new Promise((resolve,reject)=>{
 const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).getAll();
 r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
});}
function putStore(db,store,records){return new Promise((resolve,reject)=>{
 const tx=db.transaction(store,'readwrite'),obj=tx.objectStore(store);
 obj.clear();for(const rec of records)obj.put(rec);
 tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('Speichern fehlgeschlagen'));
 tx.onabort=()=>reject(tx.error||Error('Speichern abgebrochen'));
});}
async function encode(value,zip,path,seen=new WeakSet()){
 if(value===null||typeof value!=='object')return value;
 if(value instanceof Blob){
   const bytes=new Uint8Array(await value.arrayBuffer());
   zip.file(path,bytes);
   return {__scBinaryV264:true,path,type:value.type,name:value instanceof File?value.name:null,lastModified:value instanceof File?value.lastModified:null,size:bytes.length};
 }
 if(value instanceof Date)return {__scDateV264:value.toISOString()};
 if(value instanceof ArrayBuffer)return {__scBufferV264:b64(new Uint8Array(value))};
 if(ArrayBuffer.isView(value))return {__scTypedV264:value.constructor.name,bytes:b64(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))};
 if(seen.has(value))fail('Zyklische Daten können nicht sicher gesichert werden.');
 seen.add(value);
 let out;
 if(Array.isArray(value)){out=[];for(let i=0;i<value.length;i++)out.push(await encode(value[i],zip,path+'_'+i,seen));}
 else{out={};for(const [k,v] of Object.entries(value)){if(k==='__proto__'||k==='constructor')fail('Ungültiger Datenfeldname.');out[k]=await encode(v,zip,path+'_'+encodeURIComponent(k),seen);}}
 seen.delete(value);
 return out;
}
async function decode(value,zip){
 if(value===null||typeof value!=='object')return value;
 if(value.__scBinaryV264===true){
  const item=zip.file(value.path);if(!item)fail('Fehlende Datei im Backup: '+value.path);
  const bytes=await item.async('uint8array');
  if(bytes.length!==value.size)fail('Dateigröße stimmt nicht: '+value.path);
  return value.name===null?new Blob([bytes],{type:value.type}):new File([bytes],value.name,{type:value.type,lastModified:value.lastModified});
 }
 if(value.__scDateV264)return new Date(value.__scDateV264);
 if(value.__scBufferV264)return from64(value.__scBufferV264).buffer;
 if(value.__scTypedV264){
  const ctor=globalThis[value.__scTypedV264],bytes=from64(value.bytes);
  if(!['Uint8Array','Int8Array','Uint16Array','Int16Array','Uint32Array','Int32Array','Float32Array','Float64Array','Uint8ClampedArray'].includes(value.__scTypedV264))fail('Unbekannter Binärdatentyp.');
  return new ctor(bytes.buffer);
 }
 if(Array.isArray(value))return Promise.all(value.map(x=>decode(x,zip)));
 const obj={};for(const [k,v] of Object.entries(value)){if(k==='__proto__'||k==='constructor')fail('Ungültiges Datenfeld.');obj[k]=await decode(v,zip);}return obj;
}
async function digest(bytes){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));}
async function derive(pass,salt){
 if(pass.length<12)fail('Das Kennwort benötigt mindestens 12 Zeichen.');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:260000,hash:'SHA-256'},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function exportAll(pass){
 if(!window.JSZip)fail('ZIP-Bibliothek nicht verfügbar.');
 if(typeof v186Flush==='function')await v186Flush();
 const zip=new JSZip(),manifest={schema:SCHEMA,created:new Date().toISOString(),origin:location.origin,databases:[],localStorage:localStorage.getItem(STORAGE)};
 let recordCount=0;
 for(const name of DB_NAMES){
  const db=await openExisting(name);
  if(!db){manifest.databases.push({name,missing:true,stores:[]});continue;}
  try{
   const stores=[];
   for(const store of Array.from(db.objectStoreNames)){
    const tx=db.transaction(store,'readonly'),obj=tx.objectStore(store);
    const rows=await readStore(db,store),out=[];
    for(let i=0;i<rows.length;i++)out.push(await encode(rows[i],zip,'binary/'+name+'/'+store+'/'+i));
    stores.push({name:store,keyPath:obj.keyPath,autoIncrement:obj.autoIncrement,records:out});
    recordCount+=rows.length;
   }
   manifest.databases.push({name,version:db.version,stores});
  }finally{db.close();}
 }
 if(!recordCount)fail('Keine gespeicherten Schulcockpit-Daten gefunden.');
 zip.file('manifest.json',JSON.stringify(manifest));
 const raw=await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:1}});
 if(raw.byteLength>LIMIT)fail('Sicherung ist zu groß (mehr als 750 MB). Bitte nicht auf ein unvollständiges Backup ausweichen.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await derive(pass,salt),raw));
 const wrapper={schema:SCHEMA,format:'encrypted-zip',salt:b64(salt),iv:b64(iv),digest:await digest(raw),ciphertext:b64(ciphertext)};
 downloadBlob('Schulcockpit_Browserumzug_'+new Date().toISOString().slice(0,10)+'.scbackup',new Blob([JSON.stringify(wrapper)],{type:'application/octet-stream'}));
 return {recordCount,bytes:raw.length};
}
async function destinationEmpty(){
 if((state.classes||[]).length||(state.sequences||[]).length||(state.lessons||[]).length||(state.materials||[]).length||(state.materialCatalog||[]).length||(state.assessments||[]).length)return false;
 for(const name of DB_NAMES){
  const db=await openExisting(name);if(!db)continue;
  try{for(const store of Array.from(db.objectStoreNames)){
   const rows=await readStore(db,store);
   if(name==='schulcockpit-state-v2'&&store==='snapshots'){
    // Freshly bootstrapped sample state is allowed; real planning data is not.
    if(rows.length>1)return false;
   }else if(rows.length)return false;
  }}finally{db.close();}
 }
 return true;
}
async function openForRestore(spec){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(spec.name,spec.version);
  req.onupgradeneeded=()=>{
   const db=req.result;
   for(const s of spec.stores)if(!db.objectStoreNames.contains(s.name))db.createObjectStore(s.name,{keyPath:s.keyPath??undefined,autoIncrement:!!s.autoIncrement});
  };
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  req.onblocked=()=>reject(Error('Bitte andere Tabs mit Schulcockpit schließen.'));
 });
}
async function importAll(file,pass){
 if(!await destinationEmpty())fail('Firefox enthält bereits Schulcockpit-Daten. Zum Schutz wird nichts überschrieben. Bitte zuerst einen wirklich leeren Firefox-Datenbestand verwenden.');
 if(file.size>LIMIT*2)fail('Sicherung zu groß.');
 const wrapper=JSON.parse(await file.text());
 if(wrapper.schema!==SCHEMA||wrapper.format!=='encrypted-zip')fail('Unbekanntes Sicherungsformat.');
 let raw;
 try{raw=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(wrapper.iv)},await derive(pass,from64(wrapper.salt)),from64(wrapper.ciphertext)));}
 catch{fail('Kennwort falsch oder Sicherung beschädigt. Es wurden keine Daten geschrieben.');}
 if(await digest(raw)!==wrapper.digest)fail('Prüfsumme ungültig.');
 const zip=await JSZip.loadAsync(raw);
 const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
 if(manifest.schema!==SCHEMA||!Array.isArray(manifest.databases)||manifest.databases.some(d=>!DB_NAMES.includes(d.name))||manifest.databases.length!==DB_NAMES.length)fail('Unvollständiger Sicherungsindex.');
 // Alle Dateien und Datensätze vor dem ersten Schreibvorgang dekodieren.
 const decoded=[];
 for(const spec of manifest.databases){
  const stores=[];
  for(const s of spec.stores||[]){const rows=[];for(const r of s.records)rows.push(await decode(r,zip));stores.push({...s,rows});}
  decoded.push({...spec,stores});
 }
 if(!await destinationEmpty())fail('Zieldaten wurden inzwischen verändert. Import abgebrochen.');
 for(const spec of decoded){
  if(spec.missing)continue;
  const db=await openForRestore(spec);
  try{for(const store of spec.stores)await putStore(db,store.name,store.rows);}
  finally{db.close();}
 }
 if(manifest.localStorage!==null)localStorage.setItem(STORAGE,manifest.localStorage);
 // Nachkontrolle der Datensatz-Anzahl (auch Materialdateien und private Werte).
 for(const spec of decoded){if(spec.missing)continue;const db=await openExisting(spec.name);
  try{for(const store of spec.stores){const rows=await readStore(db,store.name);if(rows.length!==store.rows.length)fail('Nachkontrolle fehlgeschlagen: '+spec.name+'/'+store.name);}}
  finally{db.close();}
 }
 return decoded.reduce((n,d)=>n+d.stores.reduce((m,s)=>m+s.rows.length,0),0);
}
function panel(){return '<section class="panel"><h2>Browserumzug · Safari → Firefox</h2><p>Alle lokalen Schulcockpit-Datenbanken, Unterrichtsdateien, Archive und private Bewertungsdaten verschlüsselt übertragen. Keine Cloud. Export und Import können bei sehr großen Archiven viel Arbeitsspeicher beanspruchen.</p><details><summary>1 · In Safari: Gesamtsicherung erstellen</summary><p>Mindestens 12 Zeichen. Kennwort sicher aufbewahren – ohne Kennwort ist die Sicherung nicht lesbar.</p><input id="v264-pass-export" type="password" placeholder="Sicherungskennwort"><button class="primary" data-v264-export>Verschlüsseltes Gesamtbackup herunterladen</button></details><details><summary>2 · In Firefox: Gesamtsicherung einspielen</summary><p><strong>Achtung:</strong> Nur für eine neue, noch leere Schulcockpit-Installation. Bei vorhandenen Daten wird der Import gesperrt. Safari bleibt unangetastet.</p><input id="v264-file" type="file" accept=".scbackup"><input id="v264-pass-import" type="password" placeholder="Sicherungskennwort"><button class="primary" data-v264-import>Sicherung prüfen und importieren</button></details><p id="v264-status" role="status" aria-live="polite"></p></section>';}
const oldView=viewHtml;
viewHtml=function(){const html=oldView();return view==='focus'?html+panel():html;};
const oldWire=wire;
wire=function(){oldWire();if(view!=='focus')return;
 const status=msg=>{const p=document.getElementById('v264-status');if(p)p.textContent=msg;};
 const run=async(btn,fn)=>{if(working)return;working=true;btn.disabled=true;try{await fn();}catch(e){status('Fehler: '+(e.message||e));}finally{working=false;btn.disabled=false;}};
 document.querySelector('[data-v264-export]')?.addEventListener('click',e=>run(e.currentTarget,async()=>{
  status('Sammle und verschlüssele die lokalen Daten …');const pass=document.getElementById('v264-pass-export').value;
  const result=await exportAll(pass);status(result.recordCount+' Datensätze verschlüsselt gesichert. Datei sicher aufbewahren und in Firefox importieren.');
 }));
 document.querySelector('[data-v264-import]')?.addEventListener('click',e=>run(e.currentTarget,async()=>{
  const file=document.getElementById('v264-file').files[0],pass=document.getElementById('v264-pass-import').value;
  if(!file)fail('Bitte eine .scbackup-Datei auswählen.');
  if(!confirm('Schulcockpit-Sicherung in die LEERE Firefox-Installation importieren? Bitte Safari unverändert behalten.'))return;
  status('Prüfe und entschlüssele die komplette Sicherung …');
  try{const count=await importAll(file,pass);alert(count+' Datensätze übertragen und gespeichert. Jetzt wird Schulcockpit neu geladen. Safari bitte noch nicht löschen.');location.reload();}
  catch(err){status('Import fehlgeschlagen: '+(err.message||err)+'. Falls bereits teilweise geschrieben wurde, bitte Firefox-Datenbestand nicht weiterverwenden. Safari bleibt die Originalquelle.');}
 }));
};
window.SchulcockpitTransferV264={exportAll,importAll,destinationEmpty};
})();