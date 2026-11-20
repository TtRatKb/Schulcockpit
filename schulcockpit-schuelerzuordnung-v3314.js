/* V0.33.14 – review original Excel participant ID against local class-list identity.
 * Local-only, manual, atomic link corrections. No marks or personal data exported.
 */
(function(){
'use strict';
const core=window.SchulcockpitStudentIdentityV3314;
if(!core)return;
const safe=x=>esc(String(x??''));
const exam=()=>v200Assessment(v200Eval?.assessmentId);
const classList=()=>typeof v235Current==='function'?v235Current():null;
function status(entry,priv){
 const raw=core.marksExist(priv,entry.id)?'Punkte vorhanden':'Punkte noch offen';
 const source=entry.rowIndex===null||entry.rowIndex===undefined?
  'zusätzlicher Prüfungs-Eintrag':'Classtime-Zeile '+(Number(entry.rowIndex)+1);
 return safe(raw+' · '+source);
}
function panel(a,p){
 const rec=classList();
 if(!a||!rec?.roster?.length||!p?.roster?.length||rec.classId!==a.classId)return '';
 const issues=core.audit(rec,p,v200Norm);
 const byId=new Map(rec.roster.map(s=>[s.id,s]));
 const format=st=>{
  const chosen=String(st.classStudentId||'');
  const issue=issues.some(x=>x.examId===st.id);
  return '<tr'+(issue?' class="v3314-suspect"':'')+'><td><strong>'+
   safe(st.name)+'</strong><small>'+status(st,p)+'</small></td>'+
   '<td><select data-v3314-link="'+safe(st.id)+'" aria-label="Klassenperson für '+safe(st.name)+'">'+
   '<option value="">Noch nicht verknüpft</option>'+
   rec.roster.map(s=>'<option value="'+safe(s.id)+'"'+(chosen===s.id?' selected':'')+'>'+safe(s.name)+'</option>').join('')+
   '</select></td></tr>';
 };
 return '<div class="v3314-audit">'+
  (issues.length?'<p class="v3314-warning"><strong>Zuordnung prüfen:</strong> '+issues.length+
    ' mögliche Abweichung(en) zwischen Prüfungsnamen und Klassenliste. Bitte vor der Notenrückgabe kontrollieren.</p>':'')+
  '<details'+(issues.length?' open':'')+'><summary>Prüfungsnamen und Klassenliste abgleichen'+
   (issues.length?' · '+issues.length+' Auffälligkeit(en)':'')+'</summary>'+
  '<p class="microcopy">Links steht der ursprüngliche Prüfungsname mit der zugehörigen Classtime-Zeile; rechts die Person aus deiner privaten Klassenliste. Bei gleichen Vornamen entscheidet der <strong>vollständige Name</strong>, niemals die Position oder der Vorname allein. Änderungen werden erst nach ausdrücklicher Bestätigung gespeichert.</p>'+
  '<div class="v235-wide"><table class="v235-table"><thead><tr><th>Prüfungs-Teilnehmer*in</th><th>Gehört zu Kind aus Klassenliste</th></tr></thead><tbody>'+
  p.roster.map(format).join('')+'</tbody></table></div>'+
  '<div class="v200-actions"><button type="button" class="secondary" data-v3314-save>Geprüfte Zuordnungen speichern</button>'+
   '<small data-v3314-status role="status"></small></div>'+
  '<p class="microcopy">Gespeicherte Prüfungs-IDs, Rohpunkte und die Original-Excel bleiben unverändert. Bei einer bereits benoteten Inklusionsfassung muss die zugeordnete Datei ebenfalls passen.</p>'+
  '</details></div>';
}
function problems(a,p){
 const rec=classList();
 if(!rec||rec.classId!==a?.classId)return [];
 return core.audit(rec,p,v200Norm);
}
let writing=false;
async function saveLinks(){
 if(writing)return;
 const p=v200Eval?.privateData,a=exam(),rec=classList();
 if(!a||!p||!rec||rec.classId!==a.classId)throw Error('Klassenliste und Auswertung gehören nicht zusammen.');
 const fields=[...document.querySelectorAll('[data-v3314-link]')],choices={};
 for(const field of fields)choices[field.dataset.v3314Link]=field.value;
 if(fields.length!==p.roster.length)throw Error('Prüfungs-Teilnehmerliste wurde zwischenzeitlich verändert.');
 const planned=core.reassign(p,rec,choices);
 if(!planned.changes.length){
  const el=document.querySelector('[data-v3314-status]');if(el)el.textContent='Alle ausgewählten Zuordnungen sind bereits gespeichert.';
  return;
 }
 const classById=new Map(rec.roster.map(st=>[st.id,st.name]));
 const examById=new Map(p.roster.map(st=>[st.id,st.name]));
 const summary=planned.changes.map(ch=>
  (examById.get(ch.examId)||'Prüfungseintrag')+' → '+(classById.get(ch.newClassId)||'ohne Verknüpfung')).join('\n');
 if(!confirm('Diese '+planned.changes.length+' geprüfte(n) Zuordnung(en) ändern?\n'+summary+
  '\n\nPunkte und Excel-Zeilen bleiben an ihrer bisherigen Prüfungs-ID. Kontrolliere danach bei betroffenen Kindern den Teilnahmestatus und die Prüfungsfassung.'))return;
 writing=true;
 try{
  await v200PrivatePut(planned.next);
  if(v200Eval?.assessmentId===a.id)v200Eval.privateData=planned.next;
  render();
 }finally{writing=false;}
}
const priorStepOne=v200Step1;
v200Step1=function(a,p){
 const html=priorStepOne(a,p),fragment=document.createElement('div');
 fragment.innerHTML=html;
 const area=fragment.querySelector('.v235-roster');
 if(area)area.insertAdjacentHTML('beforeend',panel(a,p));
 return fragment.innerHTML;
};
const priorStepFive=v200Step5;
v200Step5=function(a,p){
 const html=priorStepFive(a,p),issues=problems(a,p);
 if(!issues.length)return html;
 const fragment=document.createElement('div');fragment.innerHTML=html;
 const target=fragment.querySelector('.v260-grades,.v224-review');
 if(target){
  const banner=document.createElement('p');
  banner.className='v3314-warning';
  banner.textContent=issues.length+' auffällige Schülerzuordnung(en): Bitte in Schritt 1 die vollständigen Namen aus der Classtime-Prüfung mit der Klassenliste abgleichen, bevor Noten ausgegeben werden.';
  target.insertAdjacentElement('afterbegin',banner);
 }
 return fragment.innerHTML;
};
const priorWire=wire;
wire=function(){
 priorWire();
 if(view!=='evaluation'||v200Eval?.step!==1)return;
 document.querySelector('[data-v3314-save]')?.addEventListener('click',()=>{
  void saveLinks().catch(error=>{
   const el=document.querySelector('[data-v3314-status]');
   if(el)el.textContent='Nicht gespeichert: '+(error.message||error);
  });
 });
};
window.SchulcockpitIdentityAuditV3314={problems};
render();
})();
