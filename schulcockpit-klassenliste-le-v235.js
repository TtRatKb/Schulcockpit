/* Schulcockpit V0.23.5 – lokale Klassenlisten und sichere LE-Wartestellung.
 * Keine personenbezogenen Daten in state/GitHub, keine Änderung vorhandener Punkte.
 * Eine Klasse hat ihren eigenen Datensatz im bestehenden privaten IndexedDB-Store.
 */
const V235_VERSION='V0.23.5';
const V235_PREFIX='__sc_class_roster_v235__:';
let v235Active=null;
let v235History=null;
let v235Pending=Promise.resolve();
function v235Serial(fn){
  const job=v235Pending.then(fn);
  v235Pending=job.catch(()=>{});
  return job;
}
function v235Key(classId){return V235_PREFIX+String(classId);}
function v235Blank(classId){
  return {assessmentId:v235Key(classId),schema:'schulcockpit.private-class-roster.v1',classId,
    roster:[],updatedAt:''};
}
function v235Current(){
  const a=v200Assessment(v200Eval?.assessmentId);
  return a&&v235Active?.classId===a.classId?v235Active:null;
}
function v235Name(name){
  return String(name||'').trim().replace(/\s+/g,' ').slice(0,120);
}
function v235ValidRoster(roster){
  if(!Array.isArray(roster)||roster.length>250)throw Error('Ungültige Klassenliste.');
  const ids=new Set(),names=new Set();
  for(const student of roster){
    const id=String(student.id||''),name=v235Name(student.name),norm=v200Norm(name);
    if(!id||!name||!norm||ids.has(id)||names.has(norm))
      throw Error('Die Klassenliste enthält leere oder doppelte Namen/IDs. Bitte zuerst prüfen.');
    ids.add(id);names.add(norm);
  }
  return true;
}
function v235ClassMatch(rec,priv,stu){
  const list=rec?.roster||[];
  if(stu.classStudentId){
    return list.find(s=>s.id===stu.classStudentId)||null;
  }
  const name=v200Norm(stu.name);
  if(!name)return null;
  // Only exact normalized, unambiguous matches; never row-position matching.
  const classHits=list.filter(s=>v200Norm(s.name)===name);
  const examHits=(priv.roster||[]).filter(s=>v200Norm(s.name)===name);
  return classHits.length===1&&examHits.length===1?classHits[0]:null;
}
function v235IsLE(priv,stu){
  const rec=v235Current();
  return !!v235ClassMatch(rec,priv,stu)?.learningSupport;
}
function v235NewId(){
  return typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'
    ?crypto.randomUUID():uid('classstudent');
}
async function v235SaveClass(next){
  v235ValidRoster(next.roster);
  await v200PrivatePut(next);
  v235Active=next;
  v235History=null;
}
async function v235LoadClass(assessmentId){
  const a=v200Assessment(assessmentId);
  if(!a)return;
  const found=await v200PrivateGet(v235Key(a.classId));
  if(v200Eval?.assessmentId!==assessmentId)return;
  v235Active=found?.schema==='schulcockpit.private-class-roster.v1'&&
    found.classId===a.classId?found:v235Blank(a.classId);
  v235History=null;
  render();
}
const v235OpenBefore=v200OpenEval;
v200OpenEval=async function(id){
  // Keep the existing reopen/last-step behavior untouched.
  v235Active=null;v235History=null;
  await v235OpenBefore(id);
  if(v200Eval?.assessmentId===id)await v235LoadClass(id);
};
async function v235AddNames(){
  const rec=v235Current();
  if(!rec)throw Error('Bitte zuerst eine Klassenarbeit öffnen.');
  const area=document.querySelector('[data-v235-new-names]');
  const incoming=String(area?.value||'').split(/\r?\n/).map(v235Name).filter(Boolean);
  if(!incoming.length)throw Error('Bitte mindestens einen Namen eingeben.');
  const next=structuredClone(rec),existing=new Set(next.roster.map(s=>v200Norm(s.name)));
  for(const name of incoming){
    const key=v200Norm(name);
    if(!key||existing.has(key))throw Error('Doppelter oder ungültiger Name: '+name);
    next.roster.push({id:v235NewId(),name,learningSupport:false});
    existing.add(key);
  }
  await v235SaveClass(next);
  render();
}
async function v235AdoptExam(){
  const rec=v235Current(),priv=v200Eval?.privateData;
  if(!rec||!priv?.roster?.length)throw Error('Noch keine lokale Prüfungs-Teilnehmerliste vorhanden.');
  const next=structuredClone(rec),known=new Set(next.roster.map(s=>v200Norm(s.name)));
  let added=0;
  for(const person of priv.roster){
    const name=v235Name(person.name),norm=v200Norm(name);
    if(!norm||known.has(norm))continue;
    next.roster.push({id:v235NewId(),name,learningSupport:false});
    known.add(norm);added++;
  }
  if(!added)throw Error('Alle eindeutig erkannten Namen stehen bereits in der Klassenliste.');
  await v235SaveClass(next);
  await v235LinkExam(true);
  render();
}
async function v235ToggleLE(id,enabled){
  const rec=v235Current();
  if(!rec)throw Error('Keine Klassenliste geöffnet.');
  const next=structuredClone(rec),student=next.roster.find(s=>s.id===id);
  if(!student)throw Error('Kind nicht in der Klassenliste gefunden.');
  student.learningSupport=!!enabled;
  await v235SaveClass(next);
  render();
}
async function v235Rename(id,raw){
  const rec=v235Current(),name=v235Name(raw);
  if(!rec||!name)throw Error('Bitte einen gültigen Namen eingeben.');
  const next=structuredClone(rec),person=next.roster.find(s=>s.id===id);
  if(!person)throw Error('Kind nicht in der Klassenliste gefunden.');
  person.name=name;
  await v235SaveClass(next);
  render();
}
async function v235LinkExam(silent=false){
  const rec=v235Current(),priv=v200Eval?.privateData;
  if(!rec||!priv?.roster?.length)return {linked:0,unmatched:0};
  const next=structuredClone(priv),byId=new Set(rec.roster.map(s=>s.id));
  const assigned=new Set(next.roster.map(s=>s.classStudentId).filter(x=>byId.has(x)));
  const mappings={};
  if(!silent){
    document.querySelectorAll('[data-v235-map]').forEach(x=>{
      if(x.value)mappings[x.dataset.v235Map]=x.value;
    });
  }
  let linked=0,unmatched=0;
  for(const stu of next.roster){
    if(stu.classStudentId&&byId.has(stu.classStudentId))continue;
    let match=v235ClassMatch(rec,next,stu);
    const manual=mappings[stu.id];
    if(manual){
      if(!byId.has(manual))throw Error('Unbekannte manuelle Zuordnung.');
      match=rec.roster.find(s=>s.id===manual);
    }
    if(!match){unmatched++;continue;}
    if(assigned.has(match.id))throw Error('Ein Kind wurde mehrfach derselben Klassenperson zugeordnet.');
    stu.classStudentId=match.id;assigned.add(match.id);linked++;
  }
  if(linked){
    await v200PrivatePut(next);
    v200Eval.privateData=next;
  }
  return {linked,unmatched};
}
async function v235UseClassForPaper(){
  const rec=v235Current(),priv=v200Eval?.privateData;
  if(!rec?.roster.length)throw Error('Bitte zuerst die Klassenliste anlegen.');
  if(!priv)throw Error('Keine Auswertung geöffnet.');
  if(priv.classtime||priv.roster?.length||
    Object.keys(priv.scores||{}).length||Object.keys(priv.paperScores||{}).length||
    Object.keys(priv.bonusScores||{}).length)
    throw Error('Es existieren bereits Prüfungsdaten. Diese werden zum Schutz nicht durch die Klassenliste ersetzt.');
  if(!confirm('Die Klassenliste als Teilnehmende für eine reine Papierarbeit übernehmen? Für Classtime bitte erst die Excel importieren und danach die Namen zuordnen.'))return;
  const next=structuredClone(priv);
  next.roster=rec.roster.map((s,i)=>({id:'S'+String(i+1).padStart(3,'0'),
    name:s.name,rowIndex:null,classStudentId:s.id}));
  await v200PrivatePut(next);
  v200Eval.privateData=next;
  render();
}
function v235Backup(){
  const rec=v235Current();if(!rec)return;
  if(!confirm('Die Klassenliste enthält Namen und Förderinformationen. Sensibles Backup nur auf einem geschützten Gerät speichern?'))return;
  const a=v200Assessment(v200Eval?.assessmentId);
  downloadText('SENSIBEL_Klassenliste_'+v200SafeName(cls(a.classId)?.name||'Kurs')+'.json',
    JSON.stringify({schema:'schulcockpit.private-class-roster.backup.v1',
      classId:rec.classId,data:rec},null,2),'application/json');
}
async function v235Restore(file){
  const rec=v235Current();
  if(!file||!rec)throw Error('Keine Klassenliste geöffnet.');
  if(file.size>2*1024*1024)throw Error('Klassenlisten-Backup zu groß.');
  const payload=JSON.parse(await file.text());
  if(payload.schema!=='schulcockpit.private-class-roster.backup.v1'||
     payload.classId!==rec.classId||
     payload.data?.assessmentId!==v235Key(rec.classId)||
     payload.data?.schema!=='schulcockpit.private-class-roster.v1')
    throw Error('Dieses Klassenlisten-Backup passt nicht zum geöffneten Kurs.');
  v235ValidRoster(payload.data.roster);
  if(!confirm('Klassenliste ersetzen? Bestehende lokale Klassenliste vorher gesondert sichern! Die bisherigen Prüfungspunkte bleiben unverändert.'))return;
  await v235SaveClass(structuredClone(payload.data));
  render();
}
function v235LinkRows(rec,priv){
  const roster=priv?.roster||[];
  const used=new Set(roster.map(s=>s.classStudentId).filter(Boolean));
  let matched=0;
  const pending=[];
  for(const stu of roster){
    const match=v235ClassMatch(rec,priv,stu);
    if(match){matched++;continue;}
    const opts='<option value="">Noch nicht zuordnen</option>'+
      (rec.roster||[]).filter(s=>!used.has(s.id)).map(s=>
        '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join('');
    pending.push('<label>'+esc(stu.name)+' → <select data-v235-map="'+esc(stu.id)+'">'+opts+'</select></label>');
  }
  return '<p>'+matched+' von '+roster.length+' Namen eindeutig mit der Klassenliste verknüpft.'
    +(pending.length?' '+pending.length+' Zuordnung(en) offen.':'')+'</p>'
    +(pending.length?'<div class="v235-mapping">'+pending.join('')+'</div>':'')
    +'<button type="button" class="secondary" data-v235-link>Zuordnung überprüfen und speichern</button>';
}
function v235YearTable(rec,history){
  const items=history||[];
  if(!items.length)return '<p>Für diesen Kurs liegen noch keine weiteren gespeicherten Auswertungen vor.</p>';
  const header=items.map(({exam})=>'<th title="'+esc(exam.title||'Klassenarbeit')+'"><span>'
    +esc(exam.title||'Arbeit')+'</span><small>'+esc(exam.date||'')+'</small></th>').join('');
  const rows=rec.roster.map(student=>{
    const cells=items.map(({exam,priv})=>{
      const roster=priv.roster||[];
      const found=roster.find(s=>s.classStudentId===student.id);
      if(!found)return '<td title="Noch keiner Klassenperson eindeutig zugeordnet">—</td>';
      const an=exam.evaluationV200?.analysis;
      if(!an?.items?.length)return '<td>nicht ausgewertet</td>';
      const report=v200StudentReport(priv,an,found);
      if(report.learningSupportV235)return '<td class="v235-wait">LE · offen</td>';
      if(report.participationV210&&report.participationV210!=='present')
        return '<td class="v235-wait">'+esc(v210StatusLabel(report.participationV210))+'</td>';
      if(!report.complete)return '<td class="v235-wait">Korrektur offen</td>';
      return '<td title="Punkteanteil – keine Zeugnisnote">'+
        esc(Math.round(report.totalAdjusted*100)/100)+' / '+esc(report.totalMax)+' P.</td>';
    }).join('');
    return '<tr><th>'+esc(student.name)+(student.learningSupport?' <small>LE</small>':'')+'</th>'+cells+'</tr>';
  }).join('');
  return '<p class="microcopy">Nur lokal: Leistungen über mehrere Arbeiten hinweg, keine automatische Zeugnisnote. '
    +'„—“ bedeutet fehlende bestätigte Zuordnung, nicht 0 Punkte.</p>'
    +'<div class="v235-wide"><table class="v235-table"><thead><tr><th>Klassenliste</th>'+header
    +'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}
async function v235ReadHistory(){
  const rec=v235Current();if(!rec)return;
  const id=rec.classId;
  const exams=(state.assessments||[]).filter(x=>x.classId===id)
    .slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  const history=[];
  for(const exam of exams)history.push({exam,priv:await v200PrivateGet(exam.id)});
  if(v235Current()?.classId===id){v235History=history;render();}
}
function v235Panel(a,priv){
  const rec=v235Current();
  if(!rec)return '<section class="detail-section"><p>Klassenliste wird lokal geladen …</p></section>';
  const members=rec.roster||[],exam=priv?.roster||[];
  const list=members.map(s=>'<tr><td><input type="text" maxlength="120" data-v235-rename="'+esc(s.id)
    +'" value="'+esc(s.name)+'" aria-label="Name in der Klassenliste"></td>'
    +'<td><label><input type="checkbox" data-v235-le="'+esc(s.id)+'" '
    +(s.learningSupport?'checked ':'')+'> LE</label></td></tr>').join('');
  const extra=exam.length?'<p>Du kannst die bereits vorhandene Prüfungs-Teilnehmerliste '
    +'ohne Punktverlust als Ausgangspunkt der Klassenliste übernehmen.</p>'
    +'<button type="button" class="secondary" data-v235-adopt>Fehlende Namen aus dieser Arbeit übernehmen</button>':'';
  const active=members.length&&exam.length?v235LinkRows(rec,priv):
    members.length&&!exam.length?
      '<button type="button" class="secondary" data-v235-paper>Für reine Papierarbeit als Teilnehmende übernehmen</button>':'';
  const leCount=members.filter(x=>x.learningSupport).length;
  return '<section class="detail-section v235-roster"><div class="section-head compact"><div>'
    +'<span class="eyebrow">NEU · KURSÜBERGREIFENDE KLASSENLISTE</span>'
    +'<h3>Klassenliste · '+members.length+' Kinder</h3></div><strong>'+leCount+' LE markiert</strong></div>'
    +'<p>Du führst die Kinder einmal je Fachkurs. Classtime-Punkte werden später über eindeutig '
    +'zugeordnete Personen verknüpft, ohne ursprüngliche Ergebnisse oder Prüfungs-IDs zu verändern. '
    +'Die Liste und die LE-Merkmale bleiben ausschließlich in deinem lokalen privaten Datenspeicher.</p>'
    +'<details '+(!members.length?'open':'')+'><summary>Klassenliste anlegen oder ergänzen</summary>'
    +'<p>Ein Name pro Zeile. Bestehende Namen werden nicht überschrieben.</p>'
    +'<textarea data-v235-new-names rows="5" placeholder="Ein Name pro Zeile"></textarea>'
    +'<div class="v200-actions"><button type="button" class="secondary" data-v235-add>Neue Kinder hinzufügen</button>'
    +extra+'</div></details>'
    +(members.length?'<details><summary>Kinder verwalten · LE markieren ('+leCount+' markiert)</summary>'
      +'<p class="microcopy">Änderungen werden sofort lokal gesichert. LE ist zunächst nur ein Hinweis '
      +'„zieldifferente Bewertung offen“ – noch kein neuer Notenschlüssel.</p>'
      +'<div class="v235-wide"><table class="v235-table"><thead><tr><th>Name</th><th>Förderschwerpunkt Lernen</th></tr></thead>'
      +'<tbody>'+list+'</tbody></table></div></details>':'')
    +(members.length?'<details><summary>Mit dieser Klassenarbeit verknüpfen</summary>'
      +'<p class="microcopy">Namen nur bei eindeutiger Übereinstimmung automatisch verknüpfen. '
      +'Classtime-Import unverändert zuerst durchführen; nicht nach Zeilennummer zuordnen.</p>'
      +active+'</details>':'')
    +(members.length?'<details><summary>Alle Klassenarbeiten im Überblick</summary>'
      +'<button type="button" class="secondary" data-v235-history>Jahresübersicht laden / aktualisieren</button>'
      +(v235History?v235YearTable(rec,v235History):'<p class="microcopy">Zeigt die lokal gespeicherten Punkte '
        +'aller Klassenarbeiten dieses Kurses nach bestätigter Schülerzuordnung.</p>')+'</details>':'')
    +'<details><summary>Sensible Klassenliste sichern / wiederherstellen</summary>'
    +'<p>Unabhängig vom normalen Schulcockpit-Backup. Enthält Namen und LE-Informationen und darf '
    +'nicht in ChatGPT oder GitHub hochgeladen werden.</p>'
    +'<button type="button" class="secondary" data-v235-backup>Private Klassenliste sichern</button>'
    +'<label class="upload-button">Privates Klassenlisten-Backup auswählen'
    +'<input type="file" accept=".json" data-v235-restore hidden></label></details>'
    +'</section>';
}
const v235Step1Before=v200Step1;
v200Step1=function(a,priv){return v235Panel(a,priv)+v235Step1Before(a,priv);};
const v235ReportBefore=v200StudentReport;
v200StudentReport=function(priv,an,stu){
  const report=v235ReportBefore(priv,an,stu);
  if(!v235IsLE(priv,stu))return report;
  return {...report,learningSupportV235:true,complete:false,
    missing:['LE: zieldifferente Bewertung noch offen'],
    totalPct:null,
    competencies:(report.competencies||[]).map(c=>({...c,pct:null,status:'noch nicht bewertet'}))};
};
const v235ReportListBefore=v200ReportList;
v200ReportList=function(){
  const list=v235ReportListBefore();
  // Druckfertige Bögen zuerst, LE-Fälle hinter den regulären Fällen,
  // ohne die stabile Prüfungs-Teilnehmerreihenfolge zu verändern.
  return list.map((r,i)=>({r,i})).sort((a,b)=>{
    const rank=x=>x.learningSupportV235?2:x.complete?0:1;
    return rank(a.r)-rank(b.r)||a.i-b.i;
  }).map(x=>x.r);
};
const v235StatusBefore=v224Status;
v224Status=function(r){
  return r?.learningSupportV235?'LE · Bewertung ausstehend':v235StatusBefore(r);
};
const v235Step5Before=v200Step5;
v200Step5=function(a,priv){
  const html=v235Step5Before(a,priv),reports=v200ReportList(),
    pending=reports.filter(r=>r.learningSupportV235),selected=reports[v224Index(reports.length)];
  if(!pending.length)return html;
  const hint='<section class="detail-section v235-pending"><strong>LE-Bewertung ausstehend · '
    +pending.length+' Kind(er)</strong><p>Die ursprünglichen Punkte bleiben gespeichert. '
    +'Für diese Kinder werden vorerst <strong>keine regulären Kompetenzbögen erzeugt</strong>. '
    +'Du kannst alle anderen fertigen Bögen bereits ausdrucken und die zieldifferente Bewertung '
    +'nach Rücksprache mit der Förderschullehrkraft klären.</p></section>';
  const individual=selected?.learningSupportV235?
    '<div class="v235-review-pending">'+hint+html+'</div>':
    hint+html;
  return individual;
};
const v235ImportBefore=v200ImportClasstimeFile;
v200ImportClasstimeFile=async function(file){
  const result=await v235ImportBefore(file);
  if(v235Current()?.roster?.length&&v200Eval?.privateData?.roster?.length){
    // Link only verified, unique name matches; never use raw Excel row positions.
    await v235LinkExam(true);
    render();
  }
  return result;
};
const v235WireBefore=wire;
wire=function(){
  v235WireBefore();
  if(view!=='evaluation'||!v200Eval)return;
  const guarded=fn=>()=>{void v235Serial(fn).catch(err=>alert('Klassenliste: '+(err.message||err)));};
  document.querySelector('[data-v235-add]')?.addEventListener('click',guarded(v235AddNames));
  document.querySelector('[data-v235-adopt]')?.addEventListener('click',guarded(v235AdoptExam));
  document.querySelector('[data-v235-paper]')?.addEventListener('click',guarded(v235UseClassForPaper));
  document.querySelector('[data-v235-link]')?.addEventListener('click',guarded(async()=>{
    const r=await v235LinkExam();
    render();
    alert(r.linked+' neue Zuordnung(en) gespeichert. '+r.unmatched+' weiterhin offen.');
  }));
  document.querySelectorAll('[data-v235-le]').forEach(el=>el.addEventListener('change',
    guarded(()=>v235ToggleLE(el.dataset.v235Le,el.checked))));
  document.querySelectorAll('[data-v235-rename]').forEach(el=>el.addEventListener('change',
    guarded(()=>v235Rename(el.dataset.v235Rename,el.value))));
  document.querySelector('[data-v235-history]')?.addEventListener('click',guarded(v235ReadHistory));
  document.querySelector('[data-v235-backup]')?.addEventListener('click',v235Backup);
  document.querySelector('[data-v235-restore]')?.addEventListener('change',e=>{
    const file=e.target.files?.[0];
    if(file)void v235Serial(()=>v235Restore(file)).catch(err=>alert('Wiederherstellung: '+(err.message||err)));
  });
};
