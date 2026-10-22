/* Schulcockpit V0.25.3 – encrypted private master-class archive, isolated from
   ordinary exports and from public planner state. No cloud or background sync. */
(function(root){
'use strict';
const C=root.SC_MASTERCLASS_CORE_V251;
if(!C)return;
const SCHEMA='schulcockpit.private-master-encrypted.v1';
const DATA='schulcockpit.private-master-backup.v1';
const ROUNDS=260000;
function b64(bytes){
 let s='';for(let i=0;i<bytes.length;i+=16000)s+=String.fromCharCode(...bytes.subarray(i,i+16000));
 return btoa(s);
}
function from64(s){if(typeof s!=='string'||s.length>6000000)throw Error('Ungültige verschlüsselte Datei.');
 return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
function passwordOk(s){return typeof s==='string'&&s.length>=12&&s.length<=200;}
async function aes(pass,salt){
 if(!passwordOk(pass))throw Error('Bitte ein Kennwort mit mindestens 12 Zeichen verwenden.');
 const raw=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ROUNDS,hash:'SHA-256'},raw,
  {name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encrypt(payload,pass){
 const text=JSON.stringify(payload);if(text.length>2000000)throw Error('Sicherung zu groß.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await aes(pass,salt);
 const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(text));
 return {schema:SCHEMA,kdf:'PBKDF2-SHA256',iterations:ROUNDS,cipher:'AES-256-GCM',
  salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(ct))};
}
async function decrypt(envelope,pass){
 if(!envelope||envelope.schema!==SCHEMA||envelope.kdf!=='PBKDF2-SHA256'||
  envelope.iterations!==ROUNDS||envelope.cipher!=='AES-256-GCM')
  throw Error('Unbekanntes verschlüsseltes Stammklassenformat.');
 if(!passwordOk(pass))throw Error('Kennwort mit mindestens 12 Zeichen eingeben.');
 const salt=from64(envelope.salt),iv=from64(envelope.iv);
 if(salt.length!==16||iv.length!==12)throw Error('Ungültige Sicherungsdatei.');
 try{
  const key=await aes(pass,salt);
  const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,from64(envelope.ciphertext));
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(clear));
 }catch(_){throw Error('Kennwort falsch oder Sicherungsdatei beschädigt. Es wurde nichts verändert.');}
}
function checkPayload(data){
 if(!data||data.schema!==DATA||!Array.isArray(data.classes)||data.classes.length>120)
  throw Error('Keine gültige Stammklassen-Sicherung.');
 const ids=new Set(),labels=new Set();
 const result=[];
 for(const item of data.classes){
  const id=String(item?.id||''),label=String(item?.label||'').trim();
  const rec=item?.record;
  if(!id||id.length>128||!label||label.length>60||ids.has(id)||labels.has(C.norm(label))||
   !rec||rec.id!==id||rec.assessmentId!==C.ID(id)||
   rec.schema!=='schulcockpit.private-master-class.v1')throw Error('Mehrdeutige oder ungültige Stammdaten.');
  C.validate(rec.roster);
  if(rec.roster.some(s=>typeof s.masterStudentIdV251!=='undefined'||
    Object.prototype.hasOwnProperty.call(s,'learningSupport')||
    Object.prototype.hasOwnProperty.call(s,'scores')))throw Error('Sicherung enthält unerlaubte Zusatzdaten.');
  ids.add(id);labels.add(C.norm(label));
  result.push({id,label,record:rec});
 }
 return result;
}
async function collect(){
 const idx=await v200PrivateGet(C.INDEX_KEY);
 if(idx?.schema!=='schulcockpit.private-master-index.v1')throw Error('Noch keine Stammklassen zum Sichern vorhanden.');
 const entries=idx.classes||[];
 if(!entries.length)throw Error('Noch keine Stammklassen zum Sichern vorhanden.');
 const classes=[];
 for(const e of entries){
  const record=await v200PrivateGet(C.ID(e.id));
  if(record?.schema!=='schulcockpit.private-master-class.v1'||record.id!==e.id)
   throw Error('Stammklasse unvollständig. Sicherung zum Schutz abgebrochen.');
  C.validate(record.roster);
  classes.push({id:e.id,label:e.label,
    record:{assessmentId:C.ID(e.id),id:e.id,schema:'schulcockpit.private-master-class.v1',
       roster:record.roster.map(p=>({id:p.id,name:p.name}))}});
 }
 const result={schema:DATA,createdAt:new Date().toISOString(),classes};
 checkPayload(result);
 return result;
}
async function restore(data){
 const items=checkPayload(data);
 const db=await v200PrivateOpen();
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction(V200_PRIVATE_STORE,'readwrite'),store=tx.objectStore(V200_PRIVATE_STORE);
   let rejectReason=null,inserted=0;
   const abort=(reason)=>{rejectReason=reason;try{tx.abort();}catch(_){}};
   const request=store.get(C.INDEX_KEY);
   request.onsuccess=()=>{
    const existing=request.result?.schema==='schulcockpit.private-master-index.v1'?
      request.result:{assessmentId:C.INDEX_KEY,schema:'schulcockpit.private-master-index.v1',classes:[]};
    const next=structuredClone(existing),knownIds=new Set(next.classes.map(x=>x.id));
    const knownLabels=new Set(next.classes.map(x=>C.norm(x.label)));
    const pending=items.filter(item=>!knownIds.has(item.id));
    if(items.some(item=>knownIds.has(item.id)||knownLabels.has(C.norm(item.label)))){
      abort(Error('Mindestens eine Stammklasse existiert bereits. Zum Schutz keine bestehenden Daten überschrieben. Vorher die vorhandenen Klassen separat sichern und den Konflikt klären.'));return;
    }
    if(next.classes.length+pending.length>120){abort(Error('Zu viele Stammklassen.'));return;}
    let done=0,failed=false;
    const add=()=>{
      if(failed)return;
      if(done===pending.length){
       for(const p of pending)next.classes.push({id:p.id,label:p.label,courseIds:[]});
       store.put({...next,updatedAt:new Date().toISOString()});
       return;
      }
      const p=pending[done++];
      const check=store.get(C.ID(p.id));
      check.onsuccess=()=>{
       if(check.result){failed=true;abort(Error('Stammklassen-ID bereits belegt; keine Daten verändert.'));return;}
       store.put({...p.record,updatedAt:new Date().toISOString()});
       add();
      };
    };
    add();inserted=pending.length;
   };
   tx.oncomplete=()=>resolve(inserted);
   tx.onerror=()=>reject(rejectReason||tx.error||Error('Wiederherstellung fehlgeschlagen.'));
   tx.onabort=()=>reject(rejectReason||tx.error||Error('Wiederherstellung abgebrochen; keine Teilimporte.'));
  });
 }finally{db.close();}
}
async function exportClicked(){
 const pass=document.getElementById('v253-export-pass')?.value||'';
 const again=document.getElementById('v253-export-again')?.value||'';
 if(!passwordOk(pass)||pass!==again)throw Error('Kennwörter müssen übereinstimmen und mindestens 12 Zeichen haben.');
 const envelope=await encrypt(await collect(),pass);
 document.getElementById('v253-export-pass').value='';
 document.getElementById('v253-export-again').value='';
 const blob=new Blob([JSON.stringify(envelope)],{type:'application/json'});
 downloadBlob('SENSIBEL_Stammklassen_verschluesselt_'+new Date().toISOString().slice(0,10)+'.json',blob);
}
async function importClicked(){
 const file=document.getElementById('v253-restore-file')?.files?.[0];
 const pass=document.getElementById('v253-import-pass')?.value||'';
 if(!file||file.size>5000000)throw Error('Bitte eine verschlüsselte Stammklassen-Sicherung bis 5 MB auswählen.');
 const data=await decrypt(JSON.parse(await file.text()),pass);
 const items=checkPayload(data);
 if(!items.length)throw Error('Die Sicherung enthält keine Klassen.');
 if(!confirm('Sicherung mit '+items.length+' Stammklasse(n) lokal wiederherstellen? Bestehende Datensätze werden niemals überschrieben. Fachkurs-Verknüpfungen müssen bei Bedarf anschließend bestätigt werden.'))return;
 const count=await restore(data);
 document.getElementById('v253-import-pass').value='';
 alert(count+' Stammklasse(n) sicher wiederhergestellt. Schulcockpit wird neu geladen, damit die lokale Klassenliste aktualisiert wird.');
 location.reload();
}
const oldView=viewHtml;
viewHtml=function(){
 const html=oldView();if(view!=='rosters')return html;
 const section='<section class="panel v253-archive"><h2>Stammklassen sicher sichern & wiederherstellen</h2>'+
 '<p>Die Stammklassennamen werden lokal mit einem selbst gewählten Kennwort verschlüsselt (AES-256-GCM). Die Sicherung enthält weder Prüfungsergebnisse noch LE-Kennzeichnungen. Sie ist <strong>nicht</strong> Teil normaler Schulcockpit-Backups. Nur auf einem freigegebenen Gerät verwenden und das Kennwort gesondert aufbewahren.</p>'+
 '<details><summary>Verschlüsselte Sicherung erstellen</summary>'+
 '<label>Kennwort (mindestens 12 Zeichen)<input id="v253-export-pass" type="password" autocomplete="new-password"></label>'+
 '<label>Kennwort wiederholen<input id="v253-export-again" type="password" autocomplete="new-password"></label>'+
 '<button type="button" class="secondary" data-v253-export>Sicherung herunterladen</button></details>'+
 '<details><summary>Verschlüsselte Stammklassen wiederherstellen</summary>'+
 '<p class="microcopy">Nur noch nicht vorhandene Stammklassen werden ergänzt. Bei Konflikten erfolgt keinerlei Überschreibung. Kurszuordnungen werden nicht ungeprüft auf ein anderes Gerät übertragen.</p>'+
 '<label>Verschlüsselte JSON-Sicherung<input type="file" accept=".json" id="v253-restore-file"></label>'+
 '<label>Kennwort<input id="v253-import-pass" type="password" autocomplete="off"></label>'+
 '<button type="button" class="secondary" data-v253-import>Wiederherstellung prüfen</button></details></section>';
 return html.replace(/<\/div>\s*$/,section+'</div>');
};
const oldWire=wire;
wire=function(){
 oldWire();if(view!=='rosters')return;
 const attach=(key,fn)=>{
  const btn=document.querySelector(key);btn?.addEventListener('click',async()=>{
   btn.disabled=true;try{await fn();}catch(e){alert('Stammklassen-Sicherung: '+(e.message||e));}
   finally{btn.disabled=false;}
  });
 };
 attach('[data-v253-export]',exportClicked);
 attach('[data-v253-import]',importClicked);
};
root.SC_PRIVATE_MASTER_BACKUP_V253={encrypt,decrypt,checkPayload,restore};
})(typeof globalThis!=='undefined'?globalThis:this);
