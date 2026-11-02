/* V0.28.1 – direct, individual bonus decisions inside the correction matrix.
 * All student-specific decisions are saved only in the private evaluation store.
 * Raw Classtime/paper scores and class-wide task definitions remain unchanged. */
(function(){
'use strict';
let selectedStudentId='',busy=false;
const bonus=it=>SC_GRADING_V260.bonus(it);
function currentData(){
 const a=v200Assessment(v200Eval?.assessmentId),priv=v200Eval?.privateData;
 return {a,priv,an:a?.evaluationV200?.analysis};
}
function reportFor(id){
 const {priv,an}=currentData(),stu=priv?.roster?.find(x=>x.id===id);
 return stu&&an?v200StudentReport(priv,an,stu):null;
}
function pts(v){return v===null||v===undefined||v===''?'–':v233Number(v);}
function gradeName(c){
 if(c.bonusOnly)return 'Nur Bonus';
 return ({'erreicht':'E · erreicht','teilweise erreicht':'TE · teilweise erreicht',
  'noch nicht erreicht':'NNE · noch nicht erreicht'})[c.status]||'noch offen';
}
function resultText(r){
 if(!r)return '–';
 if(r.participationV210&&r.participationV210!=='present')return 'Nicht regulär mitgeschrieben';
 if(!r.totalMax)return 'Nur Bonus · keine reguläre Bewertungsgrundlage';
 return pts(r.totalReg)+' reg. + '+pts(r.totalBonusEarned)+' Bonus · '+
  pts(r.totalAdjusted)+' / '+pts(r.totalMax)+' P'
  +(r.totalPct===null?'':' · '+Math.round(r.totalPct)+' %');
}
function breakdown(id){
 const r=reportFor(id);
 if(!r)return '<p>Bitte ein Kind auswählen.</p>';
 const a=currentData().a,lower=v202Grade(cls(a.classId))<=7;
 if(r.participationV210&&r.participationV210!=='present')
  return '<p>Für dieses Kind liegt derzeit keine regulär geschriebene Arbeit vor.</p>';
 const rows=(r.competencies||[]).filter(c=>c.regularMax>0||c.bonusOnly);
 return '<div class="v281-detail-head"><strong>'+esc(r.student.name)+'</strong>'+
  '<span>'+esc(resultText(r))+'</span></div>'+
  '<p class="v281-detail-summary"><strong>'+pts(r.totalReg)+' reguläre Punkte</strong> · '+
  pts(r.totalBonusEarned)+' Bonuspunkte erzielt · '+pts(r.totalBonusUsed)+' davon anrechenbar'+
  (r.totalBonusUnused?' · '+pts(r.totalBonusUnused)+' über dem 100-%-Limit':'')+
  (r.gradeV260?' · Note '+esc(r.gradeV260):'')+'</p>'+
  '<div class="v281-detail-scroll"><table class="v281-details"><thead><tr>'+
  '<th>Unterkompetenz</th><th>Regulär</th><th>Bonus</th><th>Stand</th></tr></thead><tbody>'+
  rows.map(c=>'<tr class="'+(c.bonusOnly?'v281-only':'')+'"><th scope="row">'+esc(c.text)+'</th>'+
    '<td>'+pts(c.regularEarned)+' / '+pts(c.regularMax)+'</td>'+
    '<td>'+pts(c.bonusEarned)+' / '+pts(c.bonusMax)+'</td>'+
    '<td>'+esc(lower?gradeName(c):c.bonusOnly?'Nur Bonus':'Punkte')+'</td></tr>').join('')+
  '</tbody></table></div>'+
  (!r.totalMax?'<p class="warnbox">Für dieses Kind sind alle Aufgaben Bonus. '+
  'Ohne reguläre Maximalpunktzahl kann keine reguläre Bewertung erstellt werden.</p>':'')+
  '<p class="microcopy">Alle erzielten Bonuspunkte zählen zum Gesamtpunktestand, jedoch höchstens '+
  'bis 100 % der regulären Gesamtpunktzahl. Für E/TE/NNE zählt Bonus nur in der jeweiligen '+
  'Unterkompetenz; reine Bonus-Unterkompetenzen erhalten selbst keinen E/TE/NNE-Status.</p>';
}
function updateStudent(id){
 const r=reportFor(id);
 for(const el of document.querySelectorAll('[data-v281-result]'))
  if(el.dataset.v281Result===id)el.textContent=resultText(r);
 for(const el of document.querySelectorAll('[data-v281-show]'))
  el.setAttribute('aria-pressed',String(el.dataset.v281Show===selectedStudentId));
 const panel=document.querySelector('[data-v281-detail]');
 if(panel&&id===selectedStudentId)panel.innerHTML=breakdown(id);
}
function choiceButton(student,it,priv){
 const existing=priv?.gradingOverridesV267?.[student.id]?.[it.id]?.mode||'default';
 const inactive=(priv.participationV210?.[student.id]||'present')!=='present';
 if(bonus(it))return '<span class="v281-static-bonus" title="Diese Aufgabe ist bereits für die gesamte Klasse Bonus">★</span>';
 const active=existing==='bonus',excluded=existing==='exclude';
 return '<button type="button" class="v281-bonus-toggle'+(active?' is-bonus':'')+
  (excluded?' is-excluded':'')+'" data-v281-bonus="'+esc(student.id)+'|'+esc(it.id)+'"'+
  ' aria-pressed="'+active+'"'+(inactive?' disabled':'')+
  ' aria-label="'+esc((it.label||it.id)+' für '+student.name+(active?
    ' wieder regulär bewerten':' als Bonusaufgabe bewerten'))+'"'+
  ' title="'+esc(active?'Für dieses Kind als Bonus gewertet. Zum Zurücksetzen anklicken.':
   excluded?'Aktuell individuell ausgenommen. Als Bonus werten?':
   'Für dieses Kind als Bonus werten – auch bei 0 Punkten.')+'">'+
  (active?'★ Bonus':excluded?'–':'☆ Bonus')+'</button>';
}
const oldStep4=v200Step4;
v200Step4=function(a,priv){
 let html=oldStep4(a,priv),an=a?.evaluationV200?.analysis;
 if(!html.includes('v221-matrix')||!an?.items?.length||!priv?.roster?.length)return html;
 // The original advanced form remains available for exclusions and partial
 // bonus gaps, but no longer interrupts the primary correction matrix.
 const advanced=html.match(/<section class="detail-section v267-individual">[\s\S]*?<\/section>/)?.[0]||'';
 if(advanced)html=html.replace(advanced,'');
 const roster=new Map(priv.roster.map(s=>[s.id,s]));
 const items=new Map(an.items.map(it=>[it.id,it]));
 html=html.replace(/<td class="v221-cell ([^"]+)">([\s\S]*?)<\/td>/g,(whole,cls,contents)=>{
  const key=contents.match(/data-v210-grid-score="([^"]+)"/)?.[1];
  if(!key)return whole;
  const pos=key.indexOf('|'),sid=key.slice(0,pos),itid=key.slice(pos+1),
   student=roster.get(sid),it=items.get(itid);
  if(!student||!it)return whole;
  const changed=priv.gradingOverridesV267?.[sid]?.[itid]?.mode==='bonus';
  return '<td class="v221-cell '+cls+(changed?' v281-cell-bonus':'')+'">'+
    contents+choiceButton(student,it,priv)+'</td>';
 });
 html=html.replace(/<tr><th scope="row" class="v221-person"[^>]*>[\s\S]*?<\/tr>/g,row=>{
  const sid=row.match(/data-v210-participation="([^"]+)"/)?.[1];
  if(!sid||!roster.has(sid))return row;
  const student=roster.get(sid),r=reportFor(student.id);
  return row.replace(/(<small>S\d+<\/small>)/,
   '$1<span class="v281-person-result" data-v281-result="'+esc(sid)+'">'+
   esc(resultText(r))+'</span><button type="button" class="v281-show"'+
   ' data-v281-show="'+esc(sid)+'" aria-pressed="'+String(selectedStudentId===sid)+'">'+
   'Kompetenzen</button>');
 });
 if(!roster.has(selectedStudentId))selectedStudentId=priv.roster.find(s=>
   (priv.participationV210?.[s.id]||'present')==='present')?.id||priv.roster[0].id;
 html=html.replace(
  'Classtime-Werte bleiben zunächst gesperrt und lassen sich durch Anklicken gezielt korrigieren.',
  'Classtime-Werte bleiben zunächst gesperrt und lassen sich durch Anklicken gezielt korrigieren. '+
  '<strong>☆ Bonus</strong> unter einer Punktzahl: für genau dieses Kind als Bonus werten. '+
  '<strong>★ Bonus</strong>: aktuell als Bonus gewertet; erneut klicken macht die Aufgabe regulär.');
 const detail='<section class="detail-section v281-breakdown" aria-label="Individuell berechnete Kompetenzverteilung">'+
  '<div class="section-head compact"><h3>Aktuelle Kompetenzverteilung des ausgewählten Kindes</h3></div>'+
  '<p class="microcopy">Klicke in der Tabelle bei einem Kind auf „Kompetenzen“ oder stelle eine '+
  'Aufgabe dort direkt auf Bonus. Die Werte darunter werden sofort neu berechnet.</p>'+
  '<div data-v281-detail aria-live="polite">'+breakdown(selectedStudentId)+'</div>'+
  '<p id="v281-status" role="status" aria-live="polite"></p></section>';
 if(advanced){
  const collapsed=advanced.replace('<details open>','<details>')
    .replace('<summary><strong>Individuelle Bewertung / Bonuslücken</strong>',
      '<summary><strong>Erweiterte Einzelregeln (ausnehmen / Bonuslücken)</strong>');
  return html+detail+collapsed;
 }
 return html+detail;
};
const oldCompetenceRows=v224CompetenceRows;
v224CompetenceRows=function(report){
 return (report?.competencies||[]).filter(c=>c.regularMax>0||c.bonusOnly)
  .map(c=>c.bonusOnly?
   '<div class="v224-competence v281-only"><div><strong>'+esc(c.text)+'</strong>'+
   '<small>Nur Bonus · '+pts(c.bonusEarned)+' / '+pts(c.bonusMax)+
   ' Bonuspunkte · keine E/TE/NNE-Einstufung</small></div></div>':
   oldCompetenceRows({...report,competencies:[c]})).join('');
};
const oldSaveCell=v210SaveCell;
v210SaveCell=async function(input){
 const result=await oldSaveCell(input);
 const id=String(input?.dataset?.v210GridScore||'').split('|')[0];
 if(id&&v200Eval?.step===4)updateStudent(id);
 return result;
};
async function toggle(btn){
 if(busy)return;
 const raw=btn.dataset.v281Bonus||'',sep=raw.indexOf('|'),
 sid=raw.slice(0,sep),iid=raw.slice(sep+1),{priv,an}=currentData(),
 student=priv?.roster?.find(x=>x.id===sid),it=an?.items?.find(x=>x.id===iid);
 if(!student||!it||bonus(it)||sep<0)throw Error('Diese Aufgabe ist nicht individuell umstellbar.');
 if((priv.participationV210?.[sid]||'present')!=='present')return;
 busy=true;btn.disabled=true;
 const message=document.getElementById('v281-status');
 try{
  // Preserve pending score edits before updating the person's grading rules.
  if(typeof v221Queue==='function'&&typeof v221SaveAllVisible==='function'){
   const ok=await v221Queue(v221SaveAllVisible);
   if(!ok)throw Error('Bitte zuerst die markierte fehlerhafte Punkteingabe korrigieren.');
  }
  const before=reportFor(sid),prior=structuredClone(priv.gradingOverridesV267||{});
  const current=priv.gradingOverridesV267?.[sid]?.[iid]?.mode||'default';
  const next=current==='bonus'?'default':'bonus';
  priv.gradingOverridesV267=priv.gradingOverridesV267||{};
  const own=priv.gradingOverridesV267[sid]||{};
  const entry={...(own[iid]||{})};
  if(next==='default')delete entry.mode;else entry.mode=next;
  if(Object.keys(entry).length)own[iid]=entry;else delete own[iid];
  priv.gradingOverridesV267[sid]=own;
  try{await v200PrivatePut(priv);}
  catch(err){priv.gradingOverridesV267=prior;throw err;}
  selectedStudentId=sid;
  const after=reportFor(sid);
  btn.classList.toggle('is-bonus',next==='bonus');
  btn.classList.remove('is-excluded');
  btn.setAttribute('aria-pressed',String(next==='bonus'));
  btn.textContent=next==='bonus'?'★ Bonus':'☆ Bonus';
  btn.setAttribute('aria-label',(it.label||it.id)+' für '+student.name+
   (next==='bonus'?' wieder regulär bewerten':' als Bonusaufgabe bewerten'));
  btn.title=next==='bonus'?'Für dieses Kind als Bonus gewertet. Zum Zurücksetzen anklicken.':
    'Für dieses Kind als Bonus werten – auch bei 0 Punkten.';
  btn.closest('td')?.classList.toggle('v281-cell-bonus',next==='bonus');
  for(const el of document.querySelectorAll('[data-v281-result]'))
   if(el.dataset.v281Result===sid)el.textContent=resultText(after);
  updateStudent(sid);
  if(message)message.textContent='✓ '+(it.label||it.id)+' für '+student.name+
   (next==='bonus'?' als Bonus':' wieder regulär')+' gewertet. '+
   resultText(before)+' → '+resultText(after)+'. Lokal gespeichert.';
 }finally{busy=false;if(btn.isConnected)btn.disabled=false;}
}
const oldWire=wire;
wire=function(){
 oldWire();
 if(view!=='evaluation'||v200Eval?.step!==4)return;
 for(const btn of document.querySelectorAll('[data-v281-bonus]'))
  btn.addEventListener('click',()=>void toggle(btn).catch(err=>{
   const status=document.getElementById('v281-status');
   if(status)status.textContent='Nicht gespeichert: '+(err.message||err);
  }));
 for(const btn of document.querySelectorAll('[data-v281-show]'))
  btn.addEventListener('click',()=>{
   selectedStudentId=btn.dataset.v281Show;updateStudent(selectedStudentId);
   document.querySelector('.v281-breakdown')?.scrollIntoView?.({block:'nearest',behavior:'smooth'});
  });
 // Synchronize the older advanced dropdown when revisiting Step 4; it is
 // retained only for exclusions and partial-bonus point allocations.
 const sel=document.querySelector('[data-v267-exception-item]'),
  mode=document.querySelector('[data-v267-exception-mode]');
 if(sel&&mode){
  const id=v200Eval?.privateData?.roster?.[Math.max(0,v200Eval.studentIndex||0)]?.id;
  mode.value=v200Eval?.privateData?.gradingOverridesV267?.[id]?.[sel.value]?.mode||'default';
 }
};
const oldRender=render;
render=function(){
 oldRender();
 const tag=document.querySelector('.brand small');
 if(tag)tag.textContent=state.settings.schoolYear+' · V0.28.2';
};
window.SchulcockpitBonusMatrixV281={reportFor,breakdown,resultText};
})();