/* V0.28.5 – older Safari's OPFS sync writer in a dedicated Worker.
 * Each message writes one small encrypted binary frame; nothing is uploaded.
 */
let access=null,position=0;
self.onmessage=async event=>{
 const {id,op,name,bytes}=event.data||{};
 try{
  if(op==='open'){
   if(access)throw Error('Es ist bereits eine Sicherung geöffnet.');
   const root=await navigator.storage.getDirectory();
   const file=await root.getFileHandle(name,{create:true});
   access=await file.createSyncAccessHandle();
   access.truncate(0);position=0;
  }else if(op==='write'){
   if(!access)throw Error('Kein Sicherungsziel geöffnet.');
   const data=new Uint8Array(bytes);
   let at=0;
   while(at<data.length){
    const n=access.write(data.subarray(at),{at:position+at});
    if(!n)throw Error('Der lokale Dateispeicher konnte die Sicherung nicht schreiben.');
    at+=n;
   }
   position+=data.length;
  }else if(op==='close'){
   if(!access)throw Error('Kein Sicherungsziel geöffnet.');
   access.flush();access.close();access=null;
  }else if(op==='abort'){
   if(access){access.close();access=null;}
  }else throw Error('Unbekannter Sicherungsschritt.');
  self.postMessage({id,ok:true,position});
 }catch(err){
  if(op==='write'||op==='open'){try{access?.close();}catch{}access=null;}
  self.postMessage({id,ok:false,error:err?.message||String(err)});
 }
};
