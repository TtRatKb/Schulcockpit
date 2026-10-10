/* Schulcockpit DZ24 — opt-in, private Firebase completion event outbox. No school content. */
import {getApp,getApps,initializeApp} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {getAuth,GoogleAuthProvider,browserLocalPersistence,setPersistence,onAuthStateChanged,signInWithPopup,signOut} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const fb={apiKey:"AIzaSyBFW-vUovZVkqTrxz-6UgZbSkH3eHjK-Ns",authDomain:"life-rpg-3afb7.firebaseapp.com",projectId:"life-rpg-3afb7",storageBucket:"life-rpg-3afb7.firebasestorage.app",messagingSenderId:"88670369654",appId:"1:88670369654:web:864bc94bbb5f25d073ec57"};
const app=getApps().length?getApp():initializeApp(fb), auth=getAuth(app), db=getFirestore(app);
const CONFIG="life-rpg:school-cloud-link:v1",QUEUE="life-rpg:schulcockpit-events:v1",LOCAL="life-rpg:schulcockpit-bridge:v1",ACKS="life-rpg:school-cloud-uploaded:v1:";
let user=null,busy=false,rerun=false,feedback="",panel=null;
function cfg(){try{return JSON.parse(localStorage.getItem(CONFIG)||"null")||{};}catch{return {};}}
function isEnabled(){const c=cfg();return !!user && c.enabled===true && c.uid===user.uid && Number.isFinite(Number(c.since));}
function valid(e){return e?.schema===1 && e.source==="schulcockpit" && ["lesson-prepared","lesson-reflected","preparation-completed","assessment-analyzed"].includes(e.type) && typeof e.eventId==="string" && e.eventId.startsWith(e.type+":") && /^(lesson-prepared|lesson-reflected|preparation-completed|assessment-analyzed):[a-zA-Z0-9_-]{1,120}$/.test(e.eventId) && Number.isFinite(Date.parse(e.completedAt));}
function events(){const q=JSON.parse(localStorage.getItem(QUEUE)||'{"schema":1,"events":[]}');if(q?.schema!==1||!Array.isArray(q.events))throw Error("Das lokale Ereignisformat ist unbekannt.");return q.events;}
function render(){
  if(!panel)return;
  panel.querySelector("[data-sc-status]").textContent=feedback || (!user?"Google-Konto nicht angemeldet.":isEnabled()?"Cloud-Synchronisierung aktiv.":"Cloud-Synchronisierung noch nicht aktiviert.");
  panel.querySelector("[data-sc-user]").textContent=user?`Konto: ${user.email||user.uid}`:"Mit demselben Google-Konto verbinden wie Life RPG.";
  panel.querySelector("[data-sc-enable]").textContent=isEnabled()?"Jetzt synchronisieren":"Mit Life RPG Cloud verbinden";
  panel.querySelector("[data-sc-pause]").disabled=!isEnabled();
}
async function flush(){
  if(busy){rerun=true;return 0;}
  if(!isEnabled() || !navigator.onLine)return 0;
  busy=true; let count=0;
  try{
    const c=cfg();
    let acknowledgements;
    try {acknowledgements=new Set(JSON.parse(localStorage.getItem(ACKS+user.uid)||"[]"));}
    catch {acknowledgements=new Set();}
    const list=events().filter(e=>valid(e)&&Date.parse(e.completedAt)>=Number(c.since) && !acknowledgements.has(e.eventId));
    for(const e of list){
      // Persisted, pseudonymous IDs, no student names/content or lesson text.
      const ref=doc(db,"users",user.uid,"schoolEvents",e.eventId);
      const existing=await getDoc(ref);
      if(!existing.exists()){
        await setDoc(ref,{schema:1,source:"schulcockpit",eventId:e.eventId,type:e.type,completedAt:e.completedAt,uploadedAt:serverTimestamp()});
        count++;
      }
      acknowledgements.add(e.eventId);
      try {localStorage.setItem(ACKS+user.uid,JSON.stringify([...acknowledgements]));}
      catch(err){console.warn("Cloud-Uploadbelege konnten nicht lokal gecacht werden; Firebase-Dedupe bleibt aktiv.",err);}
    }
    feedback=`Cloud-Abgleich erfolgreich · ${count} neue Abschlüsse übertragen.`;
    render();return count;
  }catch(error){
    feedback=`Cloud-Abgleich nicht möglich (${error?.code||error?.message||"Fehler"}). Ereignisse bleiben lokal erhalten. Bitte Firestore-Regeln/Anmeldung prüfen.`;
    render();throw error;
  }finally{busy=false; if(rerun){rerun=false;queueMicrotask(()=>flush().catch(()=>{}));}}
}
async function enable(){
  try{
    if(!user){await setPersistence(auth,browserLocalPersistence);await signInWithPopup(auth,new GoogleAuthProvider());user=auth.currentUser;}
    if(!user)throw Error("Anmeldung wurde nicht abgeschlossen.");
    const old=cfg();
    if(!(old.enabled && old.uid===user.uid)){
      // Enrollment timestamp prevents old school planning from generating retro rewards.
      localStorage.setItem(CONFIG,JSON.stringify({schema:1,enabled:true,uid:user.uid,since:Date.now()}));
    }
    // Enable optional same-origin delivery as well; legacy receipts preserve idempotency.
    const previousLocal=(()=>{try{return JSON.parse(localStorage.getItem(LOCAL)||"null")||{};}catch{return {};}})();
    localStorage.setItem(LOCAL,JSON.stringify({schema:1,enabled:true,since:previousLocal.since||Date.now()}));
    feedback="Verbunden. Neue Schulcockpit-Abschlüsse werden privat übertragen.";
    render();await flush();
  }catch(error){feedback=`Verbindung: ${error?.code||error?.message||error}`;render();}
}
function mount(){
  if(document.getElementById("scLifeRpgCloudToggle"))return;
  const button=document.createElement("button");button.id="scLifeRpgCloudToggle";button.type="button";button.textContent="↔ Life RPG";
  button.style.cssText="position:fixed;right:15px;bottom:15px;z-index:99999;border-radius:22px;border:1px solid #c7a5c1;background:#fff4fa;color:#593451;padding:10px 16px;font-weight:700;box-shadow:0 4px 20px #0002;cursor:pointer";
  const dlg=document.createElement("dialog");dlg.id="scLifeRpgCloudDialog";dlg.style.cssText="max-width:min(480px,calc(100vw - 28px));border:1px solid #ddc8d8;border-radius:18px;padding:22px;background:#fffafb;color:#4b3045;box-shadow:0 20px 70px #23132655";
  dlg.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px"><h2 style="margin:0">Schulcockpit ↔ Life RPG</h2><button data-sc-close type="button">✕</button></div>
    <p>Nur neu abgeschlossene Arbeitsschritte werden übertragen: Art, stabile pseudonyme Ereignis-ID und Zeitpunkt. Keine Schülernamen, Noten, Unterrichtstexte, Materialien oder Arbeitszeit.</p>
    <p data-sc-user></p><p data-sc-status role="status"></p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button data-sc-enable type="button">Mit Life RPG Cloud verbinden</button><button data-sc-pause type="button">Pausieren</button></div>
    <p style="font-size:0.85em">Benötigt dieselbe Google-Anmeldung wie Life RPG und die private Firestore-Regel aus dem DZ24-Paket. Alte Abschlüsse vor Aktivierung werden nicht nachträglich vergütet. Es werden niemals Schulcockpit-Dokumente in den Life-RPG-Save kopiert.</p>`;
  document.body.append(button,dlg);panel=dlg;
  button.addEventListener("click",()=>{render();dlg.showModal();});
  dlg.querySelector("[data-sc-close]").addEventListener("click",()=>dlg.close());
  dlg.querySelector("[data-sc-enable]").addEventListener("click",()=>isEnabled()?flush().catch(()=>{}):enable());
  dlg.querySelector("[data-sc-pause]").addEventListener("click",()=>{const c=cfg();localStorage.setItem(CONFIG,JSON.stringify({...c,enabled:false}));feedback="Pausiert. Bestehende Ereignisse bleiben erhalten.";render();});
  render();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
onAuthStateChanged(auth,next=>{user=next;feedback="";render();if(isEnabled())flush().catch(()=>{});});
window.addEventListener("life-rpg:school-outbox-updated",()=>{if(isEnabled())flush().catch(()=>{});});
window.addEventListener("focus",()=>{if(isEnabled())flush().catch(()=>{});});
window.addEventListener("online",()=>{if(isEnabled())flush().catch(()=>{});});
window.LifeRPGSchoolCloud={flush,connected:isEnabled};
