/* Schulcockpit V0.24.8 – own local roster tab, backed by existing private V235 records.
   No student names, scores or support attributes enter the public planner state. */
(function(){
'use strict';
let currentCourse='',activeRoster=null,loading=false,mutation=Promise.resolve();
const oldTitle=pageTitle;
pageTitle=function(){return view==='rosters'?'Klassenlisten':oldTitle();};
const oldView=viewHtml;
viewHtml=function(){return view==='rosters'?rosterPageV248():oldView();};
function courseList(){
  return (state.classes||[]).filter(c=>c.subject&&!/^ga$/i.test(c.subject));
}
function entryName(c){return (c.subject||'Fach')+' · '+(c.name||'Kurs');}
function rosterPageV248(){
  const courses=courseList();
  const c=courses.find(c=>c.id===currentCourse)||courses[0];
  if(!c)return '<div class="panel"><h2>Klassenlisten</h2><p>Lege zunächst einen Fachkurs in „Stundenplan“ an.</p></div>';
  const rec=activeRoster?.classId===c.id?activeRoster:null;
  const members=rec?.roster||[];
  const rows=members.map((s,i)=>'<div class="v248-student"><span>'+String(i+1)+'.</span>'+
    '<input data-v248-rename="'+esc(s.id)+'" maxlength="120" value="'+esc(s.name)+'" aria-label="Name bearbeiten">'+
    '<small>'+(s.learningSupport?'LE-Merkmal lokal gespeichert':'')+'</small></div>').join('');
  return '<div class="content-grid"><section class="panel v248-private"><div class="section-head"><div>'+
    '<span class="eyebrow">PRIVATER BROWSERSPEICHER</span><h2>Klassenlisten verwalten</h2></div>'+
    '<label>Fachkurs<select id="v248-course">'+courses.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===c.id?'selected':'')+'>'+
      esc(entryName(x))+'</option>').join('')+'</select></label></div>'+
    '<p>Schülerinnen und Schüler einmal je Fachkurs eintragen. Bei der Klassenarbeitsauswertung wird dieselbe lokale Liste automatisch wiederverwendet. Namen und private Merkmale erscheinen nicht in ChatGPT-Planungspaketen oder im öffentlichen App-State.</p>'+
    '<p class="microcopy">Die derzeitige Verknüpfung erfolgt pro Fachkurs. Zwei Fachkurse mit gleicher Klassenbezeichnung werden noch nicht ungefragt zusammengeführt.</p>'+
    (rec?'<h3>'+members.length+' Kinder</h3>'+
      '<div class="v248-students">'+(rows||'<p>Die Liste ist noch leer.</p>')+'</div>'+
      '<details><summary>Kinder ergänzen</summary><p class="microcopy">Ein Name pro Zeile.</p>'+
      '<textarea id="v248-names" rows="5" placeholder="Vorname Nachname"></textarea>'+
      '<p><button class="primary" data-v248-add>Neue Kinder speichern</button></p></details>'+
      '<details><summary>Separate sensible Sicherung</summary><p class="microcopy">Diese Namen bleiben außerhalb des gewöhnlichen Schulcockpit-Backups. Sichere sie nur auf einem dafür freigegebenen geschützten Gerät.</p>'+
      '<button class="secondary" data-v248-backup>Private Liste sichern</button></details>'
      :'<p>Private Liste wird geladen …</p>')+
    '</section></div>';
}
async function loadV248(id){
  if(!id)return;
  const rec=await v200PrivateGet(v235Key(id));
  if(view!=='rosters'||currentCourse!==id)return;
  activeRoster=rec?.schema==='schulcockpit.private-class-roster.v1'&&rec.classId===id?
    rec:v235Blank(id);
  render();
}
async function saveV248(next){
  v235ValidRoster(next.roster);
  await v200PrivatePut(next);activeRoster=next;render();
}
function doSerial(task){
  mutation=mutation.catch(()=>{}).then(task).catch(e=>alert('Klassenliste: '+(e.message||e)));
}
async function addV248(){
  const incoming=String(document.getElementById('v248-names')?.value||'')
    .split(/\r?\n/).map(v235Name).filter(Boolean);
  if(!incoming.length)throw Error('Bitte mindestens einen Namen angeben.');
  const next=structuredClone(activeRoster);
  const seen=new Set(next.roster.map(x=>v200Norm(x.name)));
  for(const name of incoming){
    const norm=v200Norm(name);
    if(seen.has(norm))throw Error('Doppelter Name: '+name);
    next.roster.push({id:v235NewId(),name,learningSupport:false});
    seen.add(norm);
  }
  await saveV248(next);
}
async function renameV248(id,text){
  const next=structuredClone(activeRoster),entry=next.roster.find(x=>x.id===id);
  if(!entry)throw Error('Unbekannter Schülerdatensatz.');
  const name=v235Name(text);
  if(!name)throw Error('Name darf nicht leer sein.');
  entry.name=name;await saveV248(next);
}
function backupV248(){
  if(!activeRoster?.roster.length)return;
  if(!confirm('Diese Sicherung enthält personenbezogene Schülerdaten. Nur auf einem freigegebenen und geschützten Gerät speichern?'))return;
  const name=entryName(cls(currentCourse));
  downloadText('SENSIBEL_Klassenliste_'+v200SafeName(name)+'.json',
    JSON.stringify({schema:'schulcockpit.private-class-roster.backup.v1',
      classId:currentCourse,data:activeRoster},null,2),'application/json');
}
const oldRender=render;
render=function(){
  oldRender();
  const nav=document.querySelector('.sidebar nav');
  if(nav&&!nav.querySelector('[data-v248-nav]')){
    const b=document.createElement('button');
    b.type='button';b.dataset.v248Nav='1';
    b.className=view==='rosters'?'active':'';
    b.innerHTML='<span>♙</span> Klassenlisten';
    b.addEventListener('click',()=>{
      view='rosters';modal=null;
      currentCourse=currentCourse||courseList()[0]?.id||'';
      activeRoster=null;render();
      if(currentCourse)void loadV248(currentCourse).catch(e=>alert(e.message||e));
    });
    nav.appendChild(b);
  }
};
const oldWire=wire;
wire=function(){
  oldWire();if(view!=='rosters')return;
  document.getElementById('v248-course')?.addEventListener('change',e=>{
    currentCourse=e.target.value;activeRoster=null;render();
    void loadV248(currentCourse).catch(err=>alert('Klassenliste: '+(err.message||err)));
  });
  document.querySelector('[data-v248-add]')?.addEventListener('click',()=>doSerial(addV248));
  document.querySelectorAll('[data-v248-rename]').forEach(el=>el.addEventListener('change',()=>{
    const id=el.dataset.v248Rename,name=el.value;
    doSerial(()=>renameV248(id,name));
  }));
  document.querySelector('[data-v248-backup]')?.addEventListener('click',backupV248);
};
})();
