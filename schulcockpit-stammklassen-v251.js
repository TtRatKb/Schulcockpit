/* Schulcockpit V0.25.1 — private Stammklassen across subject courses.
   Reuses the V200 private IndexedDB; never writes pupil names into public state. */
(function(){
'use strict';
const CORE=globalThis.SC_MASTERCLASS_CORE_V251;
if(!CORE)return;
let catalog=null,master=null,selected='',busy=false,ticket=0,queue=Promise.resolve();
const courses=()=> (state.classes||[]).filter(c=>c.subject&&!/^ga$/i.test(c.subject));
const freshIndex=()=>({assessmentId:CORE.INDEX_KEY,schema:'schulcockpit.private-master-index.v1',classes:[]});
const nameCourse=c=>(c.subject||'Fach')+' · '+(c.name||'Kurs');
function readCourse(){const id=document.getElementById('v251-course')?.value;return courses().find(c=>c.id===id)||null;}
function serial(task){
 queue=queue.catch(()=>{}).then(task).catch(err=>{alert('Stammklasse: '+(err.message||err));render();});
 return queue;
}
async function atomicPut(records){
 const db=await v200PrivateOpen();
 try{
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(V200_PRIVATE_STORE,'readwrite'),store=tx.objectStore(V200_PRIVATE_STORE);
   for(const r of records){store.put({...r,updatedAt:new Date().toISOString()});}
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Private Stammklassendaten konnten nicht gespeichert werden.'));
   tx.onabort=()=>reject(tx.error||new Error('Private Stammklassendaten wurden nicht vollständig gespeichert.'));
  });
 }finally{db.close();}
}
async function load(){
 const version=++ticket;busy=true;
 try{
  const stored=await v200PrivateGet(CORE.INDEX_KEY);
  if(version!==ticket)return;
  catalog=stored?.schema==='schulcockpit.private-master-index.v1'&&Array.isArray(stored.classes)?
   stored:freshIndex();
  selected=catalog.classes.some(x=>x.id===selected)?selected:catalog.classes[0]?.id||'';
  master=selected?await v200PrivateGet(CORE.ID(selected)):null;
  if(version!==ticket)return;
  if(selected&&(!master||master.schema!=='schulcockpit.private-master-class.v1'||master.id!==selected)){
   master=null;
   alert('Ein Stammklassen-Datensatz kann nicht geladen werden. Die vorhandenen Kurslisten wurden nicht verändert.');
  }
 }catch(e){catalog=null;master=null;alert('Privater Stammklassenspeicher: '+(e.message||e));}
 finally{if(version===ticket){busy=false;if(view==='rosters')render();}}
}
async function loadSelected(id){
 selected=id;master=null;const version=++ticket;busy=true;render();
 try{
  const rec=await v200PrivateGet(CORE.ID(id));
  if(version!==ticket)return;
  if(rec?.schema!=='schulcockpit.private-master-class.v1'||rec.id!==id)
   throw Error('Stammklasse fehlt. Bitte nicht automatisch neu anlegen.');
  CORE.validate(rec.roster);master=rec;
 }catch(e){alert('Stammklasse nicht geladen: '+(e.message||e));}
 finally{if(version===ticket){busy=false;render();}}
}
function renderMaster(){
 const all=catalog?.classes||[];
 const parts=all.map(x=>'<option value="'+esc(x.id)+'"'+(selected===x.id?' selected':'')+'>'+esc(x.label)+'</option>').join('');
 const courseOptions=courses().map(c=>'<option value="'+esc(c.id)+'">'+esc(nameCourse(c))+'</option>').join('');
 const record=master?.id===selected?master:null;
 const descriptor=all.find(x=>x.id===selected);
 return '<section class="panel v251-master">'+
  '<div class="section-head"><div><span class="eyebrow">LOKAL · DATENSCHUTZ</span><h2>Stammklassen</h2></div></div>'+
  '<p>Einmal angelegte Namen in mehreren Fachkursen verwenden. Jede Klassenarbeit behält ihre bisherigen eigenen Schüler-IDs, Punkte und Förderkennzeichnungen. Der Abgleich erfolgt bewusst nur nach deiner Bestätigung.</p>'+
  (!catalog||busy?'<p>Private Stammklassen werden geladen …</p>':
   '<label>Stammklasse <select id="v251-master">'+
     (parts||'<option value="">Noch keine Stammklasse</option>')+'</select></label>'+
   '<details><summary>Neue Stammklasse anlegen</summary>'+
    '<p><label>Bezeichnung <input id="v251-label" maxlength="60" placeholder="z. B. 5f (2026/27)"></label></p>'+
    '<p><label>Bestehende Fachkursliste als Ausgangspunkt (optional) <select id="v251-import">'+
    '<option value="">Leer beginnen</option>'+courseOptions+'</select></label></p>'+
    '<p class="microcopy">Übernommen werden nur die Namen, keine LE-Merkmale und keine individuellen Leistungen. Original-Kurslisten bleiben unverändert.</p>'+
    '<button type="button" class="secondary" data-v251-create>Stammklasse anlegen</button></details>'+
   (record?'<h3>'+esc(descriptor?.label||'Stammklasse')+' · '+record.roster.length+' Kinder</h3>'+
    '<details><summary>Namen der Stammklasse anzeigen / ergänzen</summary>'+
    '<div class="v251-name-list">'+record.roster.map((p,i)=>'<p>'+(i+1)+'. '+esc(p.name)+'</p>').join('')+'</div>'+
    '<label>Weitere Namen (je Zeile ein Kind) <textarea id="v251-names" rows="4" placeholder="Vorname Nachname"></textarea></label>'+
    '<button type="button" class="secondary" data-v251-add>Neue Namen speichern</button></details>'+
    '<div class="v251-link"><h3>Mit Fachkurs abgleichen</h3><p>Fehlende Namen werden im Kurs ergänzt; übereinstimmende Namen verknüpft. Vorhandene Namen, IDs, Prüfungsergebnisse und LE-Merkmale werden nicht überschrieben.</p>'+
    '<label>Fachkurs <select id="v251-course">'+courseOptions+'</select></label>'+
    '<button type="button" class="primary" data-v251-sync>Abgleich prüfen und übernehmen</button>'+
    '<small>Bisher verknüpft: '+esc((descriptor?.courseIds||[]).map(id=>nameCourse(cls(id)||{name:'entfernter Kurs'})).join(', ')||'kein Fachkurs')+'</small></div>'
   :'')
  )+'</section>';
}
const previousView=viewHtml;
viewHtml=function(){
 const html=previousView();
 if(view!=='rosters')return html;
 return html.replace(/<\/div>\s*$/,renderMaster()+'</div>');
};
const oldRender=render;
render=function(){
 oldRender();
 if(view==='rosters'&&!catalog&&!busy)void load();
 const v=document.querySelector('.brand small');
 if(v)v.textContent=state.settings.schoolYear+' · V0.25.1';
};
async function createClass(){
 if(!catalog)throw Error('Private Stammklassen noch nicht geladen.');
 const label=String(document.getElementById('v251-label')?.value||'').trim().slice(0,60);
 if(label.length<2)throw Error('Bitte eine Klassenbezeichnung eingeben.');
 if(catalog.classes.some(c=>CORE.norm(c.label)===CORE.norm(label)))
  throw Error('Diese Stammklasse existiert bereits.');
 const sourceId=document.getElementById('v251-import')?.value||'';
 const source=sourceId?await v200PrivateGet(v235Key(sourceId)):null;
 const pupils=source?.schema==='schulcockpit.private-class-roster.v1'&&source.classId===sourceId?
  (source.roster||[]).map(p=>({id:v235NewId(),name:CORE.nameOf(p.name)})):[];
 CORE.validate(pupils);
 const id=v235NewId(),rec={assessmentId:CORE.ID(id),id,
   schema:'schulcockpit.private-master-class.v1',roster:pupils};
 const next=structuredClone(catalog);
 next.classes.push({id,label,courseIds:[]});
 await atomicPut([rec,next]);catalog=next;selected=id;master=rec;render();
}
async function addNames(){
 if(!master)throw Error('Keine Stammklasse ausgewählt.');
 const incoming=String(document.getElementById('v251-names')?.value||'').split(/\r?\n/)
   .map(CORE.nameOf).filter(Boolean);
 if(!incoming.length)throw Error('Keine Namen eingegeben.');
 const next=structuredClone(master),known=new Set(next.roster.map(x=>CORE.norm(x.name)));
 for(const name of incoming){
  const norm=CORE.norm(name);if(!norm||known.has(norm))throw Error('Name mehrfach vorhanden: '+name);
  next.roster.push({id:v235NewId(),name});known.add(norm);
 }
 CORE.validate(next.roster);
 await atomicPut([next]);master=next;render();
}
async function syncCourse(){
 if(!master||!catalog)throw Error('Stammklasse noch nicht geladen.');
 const course=readCourse();if(!course)throw Error('Fachkurs auswählen.');
 const prior=catalog.classes.find(c=>c.id===master.id);
 if(!prior)throw Error('Stammklasse gehört nicht mehr zur aktuellen Liste.');
 if(catalog.classes.some(c=>c.id!==master.id&&(c.courseIds||[]).includes(course.id)))
  throw Error('Dieser Fachkurs gehört bereits zu einer anderen Stammklasse.');
 const raw=await v200PrivateGet(v235Key(course.id));
 const roster=raw?.schema==='schulcockpit.private-class-roster.v1'&&raw.classId===course.id?
  raw:v235Blank(course.id);
 const plan=CORE.makePlan(master.roster,roster.roster);
 if(plan.conflicts.length){
  alert('Der Abgleich wurde ohne Datenänderungen abgebrochen. '+plan.conflicts.length+
    ' widersprüchliche Zuordnung(en):\n'+plan.conflicts.slice(0,7)
      .map(x=>x.courseName+' / '+x.masterName+' – '+x.reason).join('\n')+
    '\nBitte zunächst die Namen/Zuordnungen prüfen.');
  return;
 }
 if(!confirm('Stammklasse „'+prior.label+'“ mit '+nameCourse(course)+' abgleichen?\n'+
    plan.newNames.length+' neue Kinder, '+plan.matches.length+' bestehende eindeutige Treffer.\n'+
    'Keine vorhandenen Prüfungspunkte, LE-Merkmale oder Schüler-IDs werden ersetzt.'))return;
 const nextRoster=CORE.applyPlan(roster.roster,plan,v235NewId);
 v235ValidRoster(nextRoster);
 const nextIndex=structuredClone(catalog);
 const entry=nextIndex.classes.find(x=>x.id===master.id);
 entry.courseIds=[...new Set([...(entry.courseIds||[]),course.id])];
 const record={...roster,roster:nextRoster};
 await atomicPut([record,nextIndex]);
 catalog=nextIndex;render();
 alert('Fachkurs aktualisiert: '+plan.newNames.length+' Kinder ergänzt, '+plan.matches.length+' verknüpft. Bestehende Auswertungen wurden nicht verändert.');
}
const oldWire=wire;
wire=function(){
 oldWire();if(view!=='rosters')return;
 document.getElementById('v251-master')?.addEventListener('change',e=>{void loadSelected(e.target.value);});
 document.querySelector('[data-v251-create]')?.addEventListener('click',()=>serial(createClass));
 document.querySelector('[data-v251-add]')?.addEventListener('click',()=>serial(addNames));
 document.querySelector('[data-v251-sync]')?.addEventListener('click',()=>serial(syncCourse));
};
})();