/* Schulcockpit V0.33.8 – separate *workspaces* for actual exam versions.
 * Underlying class, private exam roster, rubric-by-file and V300 score batches
 * remain the original, validated records. A tab switch never mutates them.
 */
(function(){
'use strict';
const core=window.SchulcockpitExamTabsV338Core;
if(!core)return;
const safe=value=>esc(String(value??''));
const exam=()=>v200Assessment(v200Eval?.assessmentId);
const priv=()=>v200Eval?.privateData;
const kindFor=(a,file)=>window.SchulcockpitExamSourcesV318?.kind(a,file)||file.roleV316||'';
const tabsByExam=new Map(),stepByTab=new Map();
function available(a=exam()){return core.available(a,kindFor);}
function activeKind(a=exam()){
 if(!a)return 'standard';
 const saved=tabsByExam.get(a.id)||'standard';
 return core.allowed(a,saved,kindFor)?saved:'standard';
}
function currentFile(a=exam()){
 const key=activeKind(a);
 return key==='standard'?null:available(a).find(f=>f.key===key)||null;
}
function fileLabel(f){
 return (f.role==='inclusion'?'Inklusionsarbeit':
   f.role==='inclusion_makeup'?'Inklusions-Nachschreibearbeit':
   'Nachschreibearbeit')+(f.name?' · '+f.name:'');
}
const beforeReportList=v200ReportList;
v200ReportList=function(...args){
 const all=beforeReportList(...args);
 if(view!=='evaluation'||v200Eval?.step!==5)return all;
 const a=exam();
 if(!a||!available(a).length)return all;
 const current=activeKind(a),matching=core.matchingReports(all,current);
 if(current!=='standard')return matching;
 // A blocked or ambiguous special-assignment report must not silently appear
 // in the regular work or regular PDF just because its fallback label says standard.
 const chooser=window.SchulcockpitExamAnalysisV317?.select;
 return typeof chooser==='function'?matching.filter(r=>
   chooser(priv(),r.student)?.status==='standard'):matching;
};
function element(html,selector){
 const root=document.createElement('div');root.innerHTML=html;
 return root.querySelector(selector);
}
function panel(title,body){
 return '<section class="detail-section v338-section"><h3>'+safe(title)+'</h3>'+body+'</section>';
}
function tabKey(a,key){return a.id+'|'+key;}
async function choose(kind){
 const a=exam();
 if(!a||!core.allowed(a,kind,kindFor))return;
 const previous=activeKind(a);
 if(previous===kind)return;
 if(view==='evaluation'&&v200Eval?.step===4&&previous!=='standard'){
  // The shared matrix auto-saves by pupil, not via legacy V317 score cards.
  if(document.querySelector('.v3316-matrix'))
   await window.SchulcockpitVariantMatrixV3316?.flush?.();
  const dirty=[...document.querySelectorAll('[data-v317-score]')].some(input=>{
   const raw=input.dataset.v317Score||'',sep=raw.indexOf('|');
   if(sep<0)return false;
   const p=priv(),itId=raw.slice(sep+1),sid=raw.slice(0,sep);
   const it=window.SchulcockpitExamAnalysisV317?.analysisForVariant(previous,p,a)
     ?.items?.find(it=>it.id===itId);
   if(!it)return false;
   const before=v200GetScore(p,sid,it),actual=String(input.value||'').trim().replace(',','.');
   return actual!==String(before??'');
  });
  if(dirty&&!confirm('Es gibt noch nicht gespeicherte Punkte in dieser Prüfungsfassung. Erst mit „Punkte dieser Fassung speichern“ sichern. Trotzdem wechseln und die ungespeicherten Eingaben verwerfen?'))return;
 }
 if(view==='evaluation'&&v200Eval?.step===5&&
    typeof v224DraftDirty!=='undefined'&&v224DraftDirty){
  if(typeof v224Serialized==='function'&&typeof v224SaveFeedback==='function')
   await v224Serialized(v224SaveFeedback);
  else throw Error('Eine persönliche Rückmeldung ist noch nicht gespeichert.');
 }
 stepByTab.set(tabKey(a,previous),Number(v200Eval.step)||1);
 tabsByExam.set(a.id,kind);
 v200Eval.step=stepByTab.get(tabKey(a,kind))||(kind==='standard'?1:2);
 v200Eval.studentIndex=0;
 render();
}
function stepBar(a,kind){
 const options=[{key:'standard',label:'Reguläre Arbeit'},...available(a).map(f=>({
  key:f.key,label:fileLabel(f)
 }))];
 return '<div class="v338-version-bar" role="group" aria-label="Prüfungsfassung">'+
  options.map(t=>'<button type="button" data-v338-select="'+safe(t.key)+'" '+
   'class="'+(kind===t.key?'primary':'secondary')+'" aria-pressed="'+(kind===t.key)+
   '">'+safe(t.label)+'</button>').join('')+'</div>';
}
function header(file,step){
 const stages=['Datei und Teilnehmende','Eigenes Aufgabenraster','Eigene Classtime-Ergebnisse',
  'Eigene Punkte korrigieren','Rückgabe und PDF'];
 return '<div class="v338-special-head"><span class="eyebrow">EIGENSTÄNDIGE AUSWERTUNG</span>'+
   '<h3>'+safe(fileLabel(file))+'</h3>'+
   '<p>Schritt '+step+' · '+stages[step-1]+
    '. Die reguläre Arbeit und andere Fassungen bleiben unverändert.</p></div>';
}
function stepOne(html,file){
 const root=element(html,'.v214-workspace-content');
 if(!root)return panel('Datei und Teilnehmende',
  '<p>Die gemeinsame Klassenliste und die Prüfungsdateien werden hier verwaltet.</p>');
 const section=root.querySelector('.v318-exam-sources');
 if(section){
  for(const card of [...section.querySelectorAll('.v318-file-card')]){
   const id=card.querySelector('[data-v214-file-open]')?.dataset.v214FileOpen;
   if(id!==file.fileKey)card.remove();
  }
  section.querySelector('.v318-good')?.remove();
  section.querySelector('.v318-error')?.remove();
  const title=section.querySelector('h3');
  if(title)title.textContent='Datei und Kinder für diese Fassung';
 }
 const others=[...root.children].filter(ch=>ch!==section&&(
  ch.classList?.contains('v235-class-roster')||ch.querySelector?.('[data-v235-new-names]')));
 return panel('Welche Kinder schreiben diese Fassung?',
  '<p>Wähle die Kinder an der zugehörigen Datei aus. Die Klassenliste bleibt für beide Arbeiten gemeinsam.</p>'+
  (section?.outerHTML||'<p>Bitte die Inklusionsdatei zunächst als eigene Prüfungsfassung kennzeichnen.</p>')+
  (others.length?others.map(x=>x.outerHTML).join(''):
   '<p>Falls die Klassenliste noch fehlt, wechsle kurz zur regulären Ansicht und lege sie dort an.</p>'));
}
function stepTwo(html,file,p){
 const root=element(html,'.v214-workspace-content');
 const sections=[...root?.querySelectorAll('.v317-rubric')||[]];
 const found=sections.find(node=>node.querySelector('[data-v317-copy]')?.dataset.v317Copy===file.fileKey);
 const legacy=p?.variantAnalysesV300?.inclusion;
 return panel('Aufgaben und Kompetenzen dieser Fassung',
   '<p>Hier gilt nur das Raster dieser Inklusionsarbeit. Die regulären Aufgaben und Punktzahlen werden nicht übernommen.</p>'+
   (found?.outerHTML||'<p>Für diese Datei ist noch kein eigenständiger Aufgabenplan angelegt. Prüfe in Schritt 1 ihre Dateikategorie.</p>')+
   (window.SchulcockpitInclusionBonusV3313?.rulesPanel?.(file,p)||'')+
   (legacy&&!p?.variantAnalysesV317?.[file.fileKey]?
    '<p class="v338-notice">Es existiert noch ein älteres, allgemeines Inklusionsraster. Es wird nicht ungeprüft einer bestimmten Datei zugeordnet. Du kannst die geprüfte Fassung hier ausdrücklich neu hinterlegen.</p>':''));
}
function participantsPlan(file,p){
 const rec=typeof v235Current==='function'?v235Current():null,
  api=window.SchulcockpitExamAnalysisV317;
 return core.prepareParticipants(rec,p,file.key,
  (doc,id)=>api?.hasResults(doc,id),exam()?.classId);
}
function participantNotice(file,p){
 const plan=participantsPlan(file,p);
 if(!plan.assigned)return '<p class="v338-notice">Für diese Arbeit sind noch keine Kinder ausgewählt. Öffne Schritt 1 und ordne die Kinder an der Inklusionsdatei zu.</p>';
 if(plan.problems.length)return '<p class="v338-notice">Die Schülerzuordnung ist noch nicht eindeutig: '+
  plan.problems.slice(0,3).map(safe).join(' · ')+
  '. Bitte die Zuordnung in Schritt 1 überprüfen. Es wurden keine Datensätze verändert.</p>';
 if(!plan.add.length&&!plan.activate.length)return '';
 return '<div class="v338-participants"><p><strong>'+plan.add.length+
  ' Kind(er) fehlen noch in der Prüfungs-Teilnehmerliste</strong>'+
  (plan.activate.length?' · '+plan.activate.length+' vorhandene Zuordnung(en) noch aktivieren':'')+
  '. Die Kinder wurden in Schritt 1 bereits dieser Fassung zugewiesen.</p>'+
  '<button type="button" class="secondary" data-v338-prepare>Diese Kinder für die Inklusionsarbeit vorbereiten</button>'+
  '<p class="microcopy">Nur nach deiner Bestätigung. Bestehende Punkte der regulären Arbeit bleiben erhalten.</p></div>';
}
let preparing=false;
async function prepareAssigned(){
 if(preparing)return;
 const a=exam(),file=currentFile(a),p=priv();
 if(!a||!file||!p)throw Error('Keine ausgewählte Prüfungsfassung.');
 const plan=participantsPlan(file,p);
 if(plan.problems.length)throw Error(plan.problems.join('; '));
 if(!plan.add.length&&!plan.activate.length)return;
 if(!confirm(plan.add.length+' bisher fehlende Kinder aus der privaten Klassenliste ergänzen und '+
   plan.activate.length+' vorhandene Kinder dieser Prüfungsfassung bestätigen? '+
   'Andere Kinder und ihre bisherigen Ergebnisse bleiben unverändert.'))return;
 preparing=true;
 try{
  // The pure helper rechecks names and stable course IDs immediately before write.
  const fresh=participantsPlan(file,priv());
  if(JSON.stringify(fresh)!==JSON.stringify(plan))
   throw Error('Die Klassenliste hat sich geändert. Bitte die Zuordnung neu prüfen.');
  const next=structuredClone(priv()),used=new Set((next.roster||[]).map(x=>x.id));
  next.roster=next.roster||[];
  next.activeVariantV300={...(next.activeVariantV300||{})};
  next.examFileV317={...(next.examFileV317||{})};
  for(const row of plan.add){
   let id='S-v338-'+uid('examstudent');
   while(used.has(id))id='S-v338-'+uid('examstudent');
   used.add(id);
   next.roster.push({id,name:row.name,classStudentId:row.classId,rowIndex:null});
   next.activeVariantV300[id]=file.key;
   next.examFileV317[id]=file.fileKey;
  }
  for(const id of plan.activate){
   next.activeVariantV300[id]=file.key;
   next.examFileV317[id]=file.fileKey;
  }
  await v200PrivatePut(next);
  if(v200Eval?.assessmentId===a.id)v200Eval.privateData=next;
  render();
 }finally{preparing=false;}
}
function stepThree(html,file,p){
 const root=element(html,'.v214-workspace-content'),source=root?.querySelector('.v300-section');
 if(!source)return panel('Classtime-Ergebnisse dieser Fassung',
  '<p>Der geschützte Nachimport ist noch nicht verfügbar. Die alte Auswertung wurde nicht verändert.</p>');
 source.querySelector('.v300-rubrics')?.remove();
 const list=source.querySelector('.v300-batch-list');
 if(list){
  const batches=p?.makeupBatchesV300||[],nodes=[...list.children];
  nodes.forEach((node,i)=>{
   const b=batches[i];
   // Unassigned legacy inclusion batches stay visible but cannot be silently adopted.
   const legacy=(file.role==='inclusion'&&b?.variantV300==='inclusion')||
    (file.role==='inclusion_makeup'&&b?.variantV300==='inclusion_makeup');
   if(!b||!(b.variantV300===file.key||legacy)){
    node.remove();return;
   }
   if(legacy){
    const content=node.querySelector('.v300-batch-content');
    const action=content?.querySelector('[data-v300-commit]');
    if(action){action.disabled=true;action.title='Zuerst genau diese Prüfungsfassung auswählen.';}
    content?.insertAdjacentHTML('afterbegin',
     '<p class="v338-notice">Älterer, noch nicht dieser Datei zugeordneter Import. Wähle bei „Prüfungsfassung“ ausdrücklich '+safe(fileLabel(file))+
     ' aus und prüfe die Aufgaben erneut, bevor du Punkte übernimmst.</p>');
   }
  });
  if(!list.children.length)list.innerHTML='<p class="microcopy">Für diese Fassung gibt es noch keine eigenen Excel-Dateien.</p>';
 }
 // Only pupils assigned to this file can be proposed for its Excel rows.
 // V300/V317 still validate every choice at import time.
 const permitted=new Set(selectedStudents(file,p).map(x=>x.id));
 for(const select of source.querySelectorAll('[data-v300-link]')){
  for(const option of [...select.options]){
   if(option.value&&!permitted.has(option.value))option.remove();
  }
  if(select.value&&!permitted.has(select.value))select.value='';
 }
 const heading=source.querySelector('h3');
 if(heading)heading.textContent='Classtime-Excel dieser Fassung';
 const intro=source.querySelector('.section-head+p');
 if(intro)intro.textContent='Neue Excel-Dateien werden automatisch dieser Prüfungsfassung zugeordnet. Prüfe anschließend die Namen, Fragen und Maximalpunkte. Bestehende Ergebnisse der anderen Fassung bleiben erhalten.';
 return panel('Ergebnisse nur dieser Fassung importieren',
  participantNotice(file,p)+
  (!p?.variantAnalysesV317?.[file.fileKey]?
   '<p class="v338-notice">Zuerst das eigenständige Raster aus Schritt 2 speichern. Es wird nichts ohne passende Aufgabenanalyse übernommen.</p>':'')+
  (!(p?.roster||[]).length?
    '<p class="v338-notice">Die Prüfungs-Teilnehmerliste ist noch leer. Bitte zuerst die vorhandene Kursliste mit den Teilnehmenden verknüpfen, damit Excel-Ergebnisse sicher zugeordnet werden können.</p>':'')+
  source.outerHTML);
}
function selectedStudents(file,p){
 const roster=typeof v235Current==='function'?v235Current():null;
 const api=window.SchulcockpitExamAnalysisV317;
 return core.assignedStudents(roster,p,file.key,(privateDoc,st)=>api?.select(privateDoc,st));
}
function stepFour(html,file,p){
 const root=element(html,'.v214-workspace-content');
 const students=selectedStudents(file,p),ids=new Set(students.map(s=>s.id));
 const pending=students.filter(s=>!s.ready);
 const pendingIds=new Set(pending.map(s=>s.id));
 // Keep only unresolved file activations from the original, safe V317
 // assignment workflow. Ready pupils are shown together in the shared matrix.
 const ass=root?.querySelector('.v317-selected');
 if(ass){
  for(const row of [...ass.querySelectorAll('.v317-student-row')]){
   const id=row.querySelector('[data-v317-activate]')?.dataset.v317Activate||
     row.querySelector('[data-v317-student-file]')?.dataset.v317StudentFile;
   if(!ids.has(id)||!pendingIds.has(id))row.remove();
  }
 }
 const help=!students.length?
   '<p class="v338-notice">Für diese Fassung sind noch keine Kinder eindeutig aus der Kursliste zugeordnet. Prüfe Schritt 1.</p>':
   (pending.length?'<p class="v338-notice">Bei '+pending.length+
    ' Kind(ern) muss die Bewertungsfassung noch bestätigt werden.</p>':'');
 const matrix=window.SchulcockpitVariantMatrixV3316?.render?.(file,p,students)||
  '<p class="v338-notice">Die gemeinsame Korrekturtabelle ist noch nicht geladen.</p>';
 return panel('Punkte korrigieren – '+(file.role==='inclusion'?'Inklusionsarbeit':'diese Prüfungsfassung'),
  help+(ass?.querySelector('.v317-student-row')?ass.outerHTML:'')+matrix);
}
function stepFive(html,file,p){
 const root=element(html,'.v214-workspace-content');
 const reports=v200ReportList();
 const ready=reports.filter(r=>r.complete||r.learningSupportV235&&r.scoreCompleteV283).length;
 const higher=v202Grade(cls(exam().classId))>=8;
 const review=root?.querySelector(higher?'.v260-grades':'.v224-review');
 const print=root?.querySelector('.v224-print');
 if(!reports.length)return panel('Rückgabe dieser Fassung',
   '<p>Für diese Prüfungsfassung ist noch kein eindeutig zugeordnetes Ergebnis vorhanden. Prüfe die Kinderzuordnung und die Punkte in Schritt 4.</p>');
 const summary='<p class="v338-progress"><strong>'+ready+' von '+reports.length+
   '</strong> Rückgabebögen dieser Fassung vollständig. Noch nicht geschriebene Arbeiten können später ergänzt werden.</p>';
 return panel('Bewertung und Rückgabe nur für diese Fassung',
   summary+(review?.outerHTML||'<p>Der Rückgabeeditor für diese Jahrgangsstufe ist noch nicht verfügbar.</p>')+
   (print?.outerHTML||'<p>Die vorhandenen PDF-Funktionen stehen nach vollständiger Korrektur bereit.</p>'));
}
// V0.33.14: V224, V234 and V260 use the same filtered student reports.
// Never substitute the full roster index while rendering a special version.
const oldPage=v214EvaluationPage;
v214EvaluationPage=function(){
 const original=oldPage(),a=exam();
 if(!a||!available(a).length)return original;
 const kind=activeKind(a),file=currentFile(a),step=Number(v200Eval?.step)||1;
 const root=document.createElement('div');root.innerHTML=original;
 const viewRoot=root.querySelector('.v214-evaluation-workspace');
 if(!viewRoot)return original;
 const head=viewRoot.querySelector('.v214-workspace-head');
 const bar=stepBar(a,kind);
 if(head)head.insertAdjacentHTML('afterend',bar);
 if(!file)return root.innerHTML;
 const main=viewRoot.querySelector('.v214-workspace-content');
 if(!main)return root.innerHTML;
 // Work from the fully wired legacy components, but display *only* the chosen version.
 let special='';
 if(step===1)special=stepOne(original,file);
 else if(step===2)special=stepTwo(original,file,priv());
 else if(step===3)special=stepThree(original,file,priv());
 else if(step===4)special=stepFour(original,file,priv());
 else special=stepFive(original,file,priv());
 main.innerHTML=header(file,step)+special;
 return root.innerHTML;
};
const oldWire=wire;
wire=function(){
 oldWire();
 if(view!=='evaluation'||!v200Eval)return;
 document.querySelectorAll('[data-v338-select]').forEach(b=>b.onclick=()=>{
  void choose(b.dataset.v338Select).catch(err=>alert('Fassungswechsel nicht abgeschlossen: '+(err.message||err)));
 });
 document.querySelector('[data-v338-prepare]')?.addEventListener('click',()=>{
  void prepareAssigned().catch(err=>alert('Kinder noch nicht vorbereitet: '+(err.message||err)));
 });
};
const oldRender=render;
render=function(){
 oldRender();
 const tag=document.querySelector('.brand small');
 if(tag)tag.textContent=(state.settings?.schoolYear||'')+' · V0.33.18';
};
window.SchulcockpitExamTabsV338={activeKind,available,choose};
render();
})();