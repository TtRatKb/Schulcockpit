/* Schulcockpit V0.28.5 – memory-bounded, encrypted, streamed browser transfer.
 * V2 uses per-frame AES-GCM and an OPFS temporary file. No full data ZIP,
 * JSON base64 wrapper or large in-memory concatenation. V1 imports remain
 * available through the existing transfer module.
 */
(function(){
'use strict';
const SCHEMA='schulcockpit.browser-transfer.v2';
const DB_NAMES=['schulcockpit-state-v2','schulcockpit-files-v1','schulcockpit-assessment-private-v1'];
const STORAGE='schulcockpit-state-v1',MAGIC=new Uint8Array([83,67,66,50]);
const MAX_CHUNK=512*1024,MAX_FRAME=MAX_CHUNK+1024,MAX_META=80*1024*1024;
const TEMP='schulcockpit-browsertransfer-v285-export.tmp';
const textEncoder=new TextEncoder(),textDecoder=new TextDecoder();
let downloadURL='',downloadFile=null,busy=false;
function fail(s){throw Error(s);}
function bytes(s){return textEncoder.encode(s);}
function readU32(b,off){return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(off,false);}
function setU32(b,off,n){new DataView(b.buffer,b.byteOffset,b.byteLength).setUint32(off,n,false);}
function seqAAD(seq){const b=new Uint8Array(8);setU32(b,0,0x53434232);setU32(b,4,seq);return b;}
function concat(...buffers){
 const len=buffers.reduce((n,b)=>n+b.length,0),out=new Uint8Array(len);
 let pos=0;for(const b of buffers){out.set(b,pos);pos+=b.length;}return out;
}
async function keyFor(pass,salt){
 if(String(pass||'').length<12)fail('Das Sicherungskennwort benötigt mindestens 12 Zeichen.');
 const key=await crypto.subtle.importKey('raw',bytes(pass),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:260000,hash:'SHA-256'},
  key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function existingDB(name){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(name);let missing=false;
  req.onupgradeneeded=()=>{missing=true;req.transaction.abort();};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>missing?resolve(null):reject(req.error||Error('IndexedDB konnte nicht geöffnet werden.'));
 });
}
async function keysFor(db,store){
 return new Promise((resolve,reject)=>{
  const req=db.transaction(store,'readonly').objectStore(store).getAllKeys();
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
async function valueFor(db,store,key){
 return new Promise((resolve,reject)=>{
  const req=db.transaction(store,'readonly').objectStore(store).get(key);
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
function encode(value,blobs,seen=new WeakSet()){
 if(value===null||typeof value!=='object')return value;
 if(value instanceof Date)return {__scDateV285:value.toISOString()};
 let kind='',blob=null;
 if(value instanceof Blob){kind=value instanceof File?'file':'blob';blob=value;}
 else if(value instanceof ArrayBuffer){kind='arraybuffer';blob=new Blob([value]);}
 else if(ArrayBuffer.isView(value)){
  kind='typed';blob=new Blob([new Uint8Array(value.buffer,value.byteOffset,value.byteLength)]);
 }
 if(blob){
  const index=blobs.length;
  if(blob.size>4294967295)fail('Ein einzelnes Unterrichtsarchiv ist größer als 4 GB. Bitte dieses Archiv separat sichern.');
  blobs.push(blob);
  return {__scBinaryV285:true,index,kind,size:blob.size,type:blob.type||'',
   name:kind==='file'?value.name:null,lastModified:kind==='file'?value.lastModified:null,
   typed:kind==='typed'?value.constructor.name:null};
 }
 if(seen.has(value))fail('Zyklische Daten können nicht verlustfrei gesichert werden.');
 seen.add(value);
 let result;
 if(Array.isArray(value))result=value.map(v=>encode(v,blobs,seen));
 else{
  result={};
  for(const [k,v]of Object.entries(value)){
   if(k==='__proto__'||k==='constructor'||k==='prototype')fail('Ungültiger Datenfeldname.');
   result[k]=encode(v,blobs,seen);
  }
 }
 seen.delete(value);return result;
}
function binaryMarkers(value,out=new Map()){
 if(value&&typeof value==='object'){
  if(value.__scBinaryV285===true){
   if(!Number.isInteger(value.index)||value.index<0||out.has(value.index)||
    !Number.isInteger(value.size)||value.size<0||value.size>4294967295)
    fail('Sicherungsmetadaten sind beschädigt.');
   if(!['file','blob','arraybuffer','typed'].includes(value.kind))fail('Unbekannter Binärdatentyp.');
   out.set(value.index,value);
  }else for(const [k,v]of Object.entries(value)){
   if(['__proto__','constructor','prototype'].includes(k))fail('Ungültige Datensatzfelder.');
   binaryMarkers(v,out);
  }
 }
 return out;
}
function decode(value,parts,seen=new WeakSet()){
 if(value===null||typeof value!=='object')return value;
 if(value.__scBinaryV285){
  const found=parts.get(value.index)||[];
  const blob=new Blob(found,{type:value.type||''});
  if(blob.size!==value.size)fail('Eine Unterrichtsdatei ist unvollständig.');
  if(value.kind==='file')return new File([blob],value.name||'Datei',{type:value.type||'',lastModified:value.lastModified||0});
  if(value.kind==='blob')return blob;
  // Typed buffers in the app are rare; do not allocate during the first pass.
  return blob.arrayBuffer().then(ab=>{
   if(value.kind==='arraybuffer')return ab;
   const ctor=globalThis[value.typed];
   if(!['Uint8Array','Int8Array','Uint16Array','Int16Array','Uint32Array','Int32Array','Float32Array','Float64Array','Uint8ClampedArray'].includes(value.typed)||!ctor)
    fail('Unbekannter Byte-Datentyp.');
   return new ctor(ab);
  });
 }
 if(value.__scDateV285)return new Date(value.__scDateV285);
 if(seen.has(value))fail('Zyklische Datensatzstruktur.');
 seen.add(value);
 if(Array.isArray(value))return Promise.all(value.map(v=>decode(v,parts,seen)));
 const entries=Object.entries(value);
 return Promise.all(entries.map(async ([k,v])=>{
  if(['__proto__','constructor','prototype'].includes(k))fail('Ungültiges Datenfeld.');
  return [k,await decode(v,parts,seen)];
 })).then(kv=>Object.fromEntries(kv));
}
async function writerFor(name){
 if(!navigator.storage?.getDirectory)
  fail('Diese Safari-Version bietet keinen lokalen Datei-Zwischenspeicher für große Sicherungen.');
 const root=await navigator.storage.getDirectory();
 const handle=await root.getFileHandle(name,{create:true});
 if(typeof handle.createWritable==='function'){
  try{
   const writable=await handle.createWritable();
   return {handle,write:b=>writable.write(b),close:()=>writable.close(),
    abort:()=>writable.abort?.()};
  }catch(err){
   if(!['NotSupportedError','NotAllowedError','InvalidStateError','TypeError'].includes(err?.name))throw err;
   // Older Safari: the OPFS worker-only sync writer is used below.
  }
 }
 // Safari <26 can still write incrementally via worker-only sync OPFS handles.
 const worker=new Worker('schulcockpit-opfs-v285-worker.js?v=0.28.5');
 let reqID=0;const pending=new Map();
 worker.onmessage=e=>{
  const {id,ok,error}=e.data||{},p=pending.get(id);
  if(!p)return;pending.delete(id);ok?p.resolve():p.reject(Error(error||'OPFS-Schreibfehler'));
 };
 worker.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message||'Safari-Dateischreibfehler'));pending.clear();};
 function ask(op,data){
  const id=++reqID;
  return new Promise((resolve,reject)=>{
   pending.set(id,{resolve,reject});
   if(data)worker.postMessage({id,op,bytes:data.buffer},[data.buffer]);
   else worker.postMessage({id,op,name});
  });
 }
 await ask('open');
 return {handle,write:b=>ask('write',b),close:async()=>{try{await ask('close');}finally{worker.terminate();}},
  abort:async()=>{try{await ask('abort');}finally{worker.terminate();}}};
}
async function exportAll(pass,onProgress=()=>{}){
 if(busy)fail('Es läuft bereits eine Sicherung.');busy=true;
 let writer=null,finished=false;
 try{
  if(typeof v186Flush==='function')await v186Flush();
  // Derive only once; a wrong/missing password must never start a partial export.
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const key=await keyFor(pass,salt);
  writer=await writerFor(TEMP);
  await writer.write(concat(MAGIC,salt));
  let seq=0,records=0,rawBytes=0;
  const countsByDb={};
  async function frame(payload){
   if(payload.length>MAX_FRAME)fail('Sicherungsblock zu groß.');
   const iv=crypto.getRandomValues(new Uint8Array(12));
   const encrypted=new Uint8Array(await crypto.subtle.encrypt({
    name:'AES-GCM',iv,additionalData:seqAAD(seq++)},key,payload));
   const out=new Uint8Array(4+12+encrypted.length);
   setU32(out,0,12+encrypted.length);out.set(iv,4);out.set(encrypted,16);
   await writer.write(out);rawBytes+=out.length;
  }
  const specs=[];
  for(const name of DB_NAMES){
   const db=await existingDB(name);
   if(!db){specs.push({name,missing:true,stores:[]});continue;}
   try{
    const stores=[];
    for(const store of Array.from(db.objectStoreNames)){
     const tx=db.transaction(store,'readonly'),obj=tx.objectStore(store);
     const indexes=[];
     for(const indexName of Array.from(obj.indexNames)){
      const idx=obj.index(indexName);
      indexes.push({name:indexName,keyPath:idx.keyPath,unique:idx.unique,multiEntry:idx.multiEntry});
     }
     stores.push({name:store,keyPath:obj.keyPath,autoIncrement:obj.autoIncrement,indexes});
    }
    specs.push({name,version:db.version,stores});
   }finally{db.close();}
  }
  const header={schema:SCHEMA,created:new Date().toISOString(),origin:location.origin,
   databases:specs,localStorage:localStorage.getItem(STORAGE)};
  await frame(concat(new Uint8Array([1]),bytes(JSON.stringify(header))));
  for(const spec of specs){
   if(spec.missing)continue;
   const db=await existingDB(spec.name);
   if(!db)fail('Eine Datenbank ist während der Sicherung verschwunden: '+spec.name);
   try{
    for(const store of spec.stores){
     const keys=await keysFor(db,store.name);
     for(const id of keys){
      const value=await valueFor(db,store.name,id);
      if(value===undefined)fail('Ein Datensatz wurde während der Sicherung gelöscht. Bitte Änderungen abschließen und erneut sichern.');
      const blobs=[];
      const body=bytes(JSON.stringify({db:spec.name,store:store.name,key:id,
       value:encode(value,blobs)}));
      if(body.length>MAX_META)fail('Ein Planungsdatensatz ist zu groß für eine sichere Sicherung.');
      let at=0;
      do{
       const n=Math.min(MAX_CHUNK,body.length-at),part=body.subarray(at,at+n);
       const flag=at===0&&at+n===body.length?3:at===0?1:at+n===body.length?4:2;
       await frame(concat(new Uint8Array([2,flag]),part));at+=n;
      }while(at<body.length);
      for(let i=0;i<blobs.length;i++){
       const blob=blobs[i];
       for(let off=0;off<blob.size;off+=MAX_CHUNK){
        const chunk=new Uint8Array(await blob.slice(off,off+MAX_CHUNK).arrayBuffer());
        const marker=new Uint8Array(9);marker[0]=3;setU32(marker,1,i);setU32(marker,5,off);
        await frame(concat(marker,chunk));
        if(off%(16*MAX_CHUNK)===0)onProgress('Sichere Dateien: '+records+' Datensätze · '+Math.round(rawBytes/1048576)+' MB …');
       }
      }
      await frame(new Uint8Array([4]));
      records++;countsByDb[spec.name]=(countsByDb[spec.name]||0)+1;
      if(records%10===0)onProgress('Sichere '+records+' Datensätze · '+Math.round(rawBytes/1048576)+' MB …');
     }
    }
   }finally{db.close();}
  }
  if(!records)fail('Keine gespeicherten Schulcockpit-Daten gefunden.');
  const footer={schema:SCHEMA,recordCount:records,countsByDb,lastSequence:seq};
  await frame(concat(new Uint8Array([5]),bytes(JSON.stringify(footer))));
  await writer.close();finished=true;
  const file=await writer.handle.getFile();
  if(file.size!==rawBytes+20)fail('Die gespeicherte Sicherung hat nicht die erwartete Dateigröße.');
  onProgress('Überprüfe die verschlüsselte Sicherungsdatei …');
  const check=await scan(file,pass);
  if(check.recordCount!==records)fail('Sicherung enthält nicht alle Datensätze.');
  if(downloadURL)URL.revokeObjectURL(downloadURL);
  downloadFile=file;downloadURL=URL.createObjectURL(file);
  const link=document.getElementById('v285-download');
  if(link){
   link.href=downloadURL;
   link.download='Schulcockpit_Browserumzug_'+new Date().toISOString().slice(0,10)+'.scbackup';
   link.hidden=false;
   link.removeAttribute('aria-disabled');
  }
  return {recordCount:records,bytes:file.size,countsByDb,format:'streaming-v2'};
 }finally{
  if(writer&&!finished)try{await writer.abort();}catch{}
  busy=false;
 }
}
async function* frames(file,pass){
 const head=new Uint8Array(await file.slice(0,20).arrayBuffer());
 if(head.length!==20||MAGIC.some((n,i)=>n!==head[i]))fail('Keine neue, speicherschonende .scbackup-Datei.');
 const key=await keyFor(pass,head.subarray(4,20));
 let pos=20,seq=0;
 while(pos<file.size){
  const prefix=new Uint8Array(await file.slice(pos,pos+4).arrayBuffer());
  if(prefix.length!==4)fail('Sicherung abgebrochen oder unvollständig.');
  const len=readU32(prefix,0);pos+=4;
  if(len<28||len>MAX_FRAME+28||pos+len>file.size)fail('Ungültiger Sicherungsblock.');
  const encrypted=new Uint8Array(await file.slice(pos,pos+len).arrayBuffer());pos+=len;
  let payload;
  try{
   payload=new Uint8Array(await crypto.subtle.decrypt({
    name:'AES-GCM',iv:encrypted.subarray(0,12),additionalData:seqAAD(seq)},
    key,encrypted.subarray(12)));
  }catch{
   fail('Kennwort falsch oder Sicherung beschädigt. Es wurden keine Daten importiert.');
  }
  yield {tag:payload[0],value:payload.subarray(1),seq:seq++};
 }
}
async function scan(file,pass,onRecord=null,onProgress=()=>{}){
 let header=null,footer=null,record=null,metaChunks=[],metaSize=0,recordCount=0;
 const countsByDb={},seenStores=new Set();
 let lastSequence=0;
 for await(const {tag,value,seq}of frames(file,pass)){
  if(footer)fail('Zusätzliche Daten nach dem Sicherungsabschluss.');
  lastSequence=seq;
  if(tag===1){
   if(header||record||seq!==0)fail('Mehrdeutiger Sicherungsindex.');
   header=JSON.parse(textDecoder.decode(value));
   const names=header?.databases?.map(d=>d.name);
   if(header?.schema!==SCHEMA||!Array.isArray(names)||names.length!==DB_NAMES.length||
    new Set(names).size!==3||names.some(n=>!DB_NAMES.includes(n)))fail('Unvollständige Schulcockpit-Datenbanken.');
   for(const spec of header.databases){
    if(spec.missing)continue;
    if(!Number.isInteger(spec.version)||spec.version<1||!Array.isArray(spec.stores))fail('Ungültige Datenbank-Struktur.');
    for(const st of spec.stores){
     if(!st.name||seenStores.has(spec.name+'|'+st.name))fail('Doppelter Datenspeicher.');
     seenStores.add(spec.name+'|'+st.name);
    }
   }
  }else if(tag===2){
   if(!header||footer||record&&record.metaDone)fail('Datensatz-Reihenfolge beschädigt.');
   const flag=value[0],chunk=value.subarray(1);
   if(flag!==1&&flag!==2&&flag!==3&&flag!==4)fail('Ungültiger Metadatenblock.');
   if(flag===1||flag===3){if(record||metaChunks.length)fail('Doppelter Datensatzanfang.');}
   else if(!metaChunks.length)fail('Fehlender Datensatzanfang.');
   metaChunks.push(chunk);metaSize+=chunk.length;
   if(metaSize>MAX_META)fail('Ein Datensatz ist zu groß.');
   if(flag===3||flag===4){
    const body=JSON.parse(await new Blob(metaChunks).text());
    if(!seenStores.has(body.db+'|'+body.store)||!Object.prototype.hasOwnProperty.call(body,'value'))
     fail('Unbekannter Datensatz-Speicher.');
    record={...body,metaDone:true,expected:binaryMarkers(body.value),
     lengths:new Map(),parts:new Map()};
    for(const id of record.expected.keys())record.lengths.set(id,0);
    metaChunks=[];metaSize=0;
   }
  }else if(tag===3){
   if(!record?.metaDone||value.length<8)fail('Dateidaten ohne Datensatz.');
   const i=readU32(value,0),off=readU32(value,4),b=value.subarray(8);
   const expected=record.expected.get(i),sofar=record.lengths.get(i);
   if(!expected||sofar!==off||sofar+b.length>expected.size||b.length>MAX_CHUNK)
    fail('Unterrichtsdatei enthält fehlende oder falsch geordnete Teile.');
   record.lengths.set(i,sofar+b.length);
   if(onRecord){
    let arr=record.parts.get(i);
    if(!arr){arr=[];record.parts.set(i,arr);}
    arr.push(b.slice());
   }
  }else if(tag===4){
   if(!record?.metaDone||value.length)fail('Datensatzende ohne Inhalt.');
   for(const [i,meta]of record.expected)if(record.lengths.get(i)!==meta.size)
    fail('Mindestens eine Unterrichtsdatei ist unvollständig.');
   if(onRecord){
    const restored=await decode(record.value,record.parts);
    await onRecord(record.db,record.store,record.key,restored);
   }
   recordCount++;countsByDb[record.db]=(countsByDb[record.db]||0)+1;
   record=null;
   if(recordCount%20===0)onProgress(recordCount+' Datensätze geprüft …');
  }else if(tag===5){
   if(!header||record||metaChunks.length)fail('Sicherungsabschluss bei unvollständigen Daten.');
   footer=JSON.parse(textDecoder.decode(value));
   if(footer.schema!==SCHEMA||footer.recordCount!==recordCount||footer.lastSequence!==seq)
    fail('Die Sicherung ist nicht vollständig.');
   if(DB_NAMES.some(n=>(footer.countsByDb?.[n]||0)!==(countsByDb[n]||0)))
    fail('Datensatzanzahl der Sicherung stimmt nicht überein.');
  }else fail('Unbekannter Sicherungsblock.');
 }
 if(!header||!footer)fail('Die Sicherung ist unvollständig (Abschluss fehlt).');
 return {recordCount,countsByDb,header};
}
async function prepareDB(spec){
 if(spec.missing)return null;
 const original=await existingDB(spec.name);
 let targetVersion=spec.version;
 if(original){
  if(original.version>targetVersion)targetVersion=original.version;
  if(spec.stores.some(st=>!original.objectStoreNames.contains(st.name)))
   targetVersion=original.version+1;
  original.close();
 }
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(spec.name,targetVersion);
  req.onupgradeneeded=()=>{
   const db=req.result;
   for(const s of spec.stores){
    let store;
    if(db.objectStoreNames.contains(s.name))store=req.transaction.objectStore(s.name);
    else{
     const opts={autoIncrement:!!s.autoIncrement};
     if(s.keyPath!==null&&s.keyPath!==undefined)opts.keyPath=s.keyPath;
     store=db.createObjectStore(s.name,opts);
    }
    for(const ix of s.indexes||[])if(!store.indexNames.contains(ix.name))
     store.createIndex(ix.name,ix.keyPath,{unique:!!ix.unique,multiEntry:!!ix.multiEntry});
   }
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Der Firefox-Datenspeicher konnte nicht geöffnet werden.'));
  req.onblocked=()=>reject(Error('Bitte andere Schulcockpit-Tabs in Firefox schließen.'));
 });
}
async function importAll(file,pass,onProgress=()=>{}){
 if(!await SchulcockpitTransferV264.destinationEmpty())
  fail('In Firefox sind bereits Schulcockpit-Daten. Zum Schutz wird nichts überschrieben; bitte einen leeren Firefox-Datenbestand verwenden.');
 if(new TextDecoder().decode(await file.slice(0,4).arrayBuffer())!=='SCB2')
  return SchulcockpitTransferV264.importAll(file,pass);
 onProgress('Prüfe zuerst sämtliche verschlüsselten Datensätze und Dateien – es wird noch nichts geschrieben …');
 const checked=await scan(file,pass,null,onProgress);
 if(!await SchulcockpitTransferV264.destinationEmpty())
  fail('Der Firefox-Datenbestand wurde inzwischen verändert; Import abgebrochen.');
 const dbs=new Map();
 for(const spec of checked.header.databases){
  const db=await prepareDB(spec);
  if(db)dbs.set(spec.name,db);
 }
 let written=0;
 try{
  const added=await scan(file,pass,async(dbName,storeName,key,record)=>{
   const db=dbs.get(dbName);
   if(!db)fail('Gesicherte Datenbank fehlt.');
   await new Promise((resolve,reject)=>{
    const tx=db.transaction(storeName,'readwrite'),store=tx.objectStore(storeName);
    if(store.keyPath===null)store.put(record,key);else store.put(record);
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error||Error('Datensatz konnte nicht gespeichert werden.'));
    tx.onabort=()=>reject(tx.error||Error('Datensatz wurde nicht gespeichert.'));
   });
   written++;
   if(written%20===0)onProgress(written+' von '+checked.recordCount+' Datensätzen gespeichert …');
  },onProgress);
  if(added.recordCount!==checked.recordCount)fail('Wiederherstellung unvollständig.');
  for(const spec of checked.header.databases){
   if(spec.missing)continue;
   const db=dbs.get(spec.name);
   for(const store of spec.stores){
    const count=await new Promise((resolve,reject)=>{
     const req=db.transaction(store.name,'readonly').objectStore(store.name).count();
     req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    // Check combined counts below; freshly bootstrapped state may have one placeholder row.
    if(store.name==='snapshots'&&spec.name==='schulcockpit-state-v2'){
     if(count!==1)fail('Die Planungsdaten wurden nicht korrekt wiederhergestellt.');
    }
   }
  }
  // Write the compact pointer last: a reload must never read half-imported data.
  if(checked.header.localStorage!==null)
   localStorage.setItem(STORAGE,checked.header.localStorage);
  return written;
 }catch(err){
  fail('Die Wiederherstellung wurde nicht vollständig abgeschlossen ('+(err?.message||err)+
   '). Safari enthält weiterhin das Original. Firefox bitte nicht weiterverwenden, bis ein leerer Datenbestand hergestellt wurde.');
 }finally{
  for(const db of dbs.values())try{db.close();}catch{}
 }
}
function isV2(file){return file?.slice(0,4).arrayBuffer().then(b=>textDecoder.decode(b)==='SCB2');}
function revealLink(){const link=document.getElementById('v285-download');if(link&&downloadURL){link.href=downloadURL;link.hidden=false;}}
const oldRender=render;
render=function(){oldRender();const v=document.querySelector('.brand small');if(v)v.textContent=state.settings.schoolYear+' · V0.28.5';};
const oldWire=wire;
wire=function(){
 oldWire();
 if(view!=='focus')return;
 revealLink();
};
const oldView=viewHtml;
viewHtml=function(){
 const html=oldView();
 if(view!=='focus')return html;
 // Put the download link in the existing transfer area, after the export button.
 return html.replace(
  'Vollständige verschlüsselte .scbackup herunterladen</button>',
  'Vollständige verschlüsselte .scbackup vorbereiten</button>'+
  '<a id="v285-download" class="primary v285-download" hidden download>✓ Fertige .scbackup jetzt herunterladen</a>'+
  '<p class="microcopy v285-help">Speicherschonender Export: verschlüsselt die Daten in kleinen Abschnitten. '+
  'Der Download wird erst freigeschaltet, wenn alle Dateien geprüft wurden. '+
  'Safari währenddessen geöffnet lassen und genügend freien Gerätespeicher vorhalten.</p>');
};
window.SchulcockpitTransferV285={exportAll,importAll,scan,isV2,getExportFile:()=>downloadFile};
})();
