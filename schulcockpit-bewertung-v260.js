/* Schulcockpit V0.26.0 – Bewertungswechsel ohne Verlust der Classtime-Rohwerte;
 * Punkte- und Notenbogen für Jahrgang 8+. Persönliche Noten nur im Privatdatenspeicher. */
(function(){
'use strict';
const core=SC_GRADING_V260;
const scope=typeof SchulcockpitGradeScopeV3310!=='undefined'?SchulcockpitGradeScopeV3310:null;
function selectedKind(a){return window.SchulcockpitExamTabsV338?.activeKind?.(a)||'standard';}
function course(a){return cls(a?.classId);}
function higher(a){return a&&v202Grade(course(a))>=8;}
function assessment(){return v200Assessment(v200Eval?.assessmentId);}
function analysis(){return v200EvalAnalysis();}
function scoreLabel(x){return Number.isFinite(Number(x))?v233Number(x):'–';}
// Jahrgang 8+: Kein künstliches Kompetenzraster und keine erfundenen E/TE/NNE-
// Schwellen. Der interne Gruppeneintrag erfüllt nur ältere Aufgaben-Editoren;
// die tatsächliche Bewertung berücksichtigt ausschließlich einzelne Aufgaben.
const internalId='_TASK_SCORES_V260';
const oldStep1=v200Step1;
const oldStepNav=v200StepNav;
v200StepNav=function(step){
  const h=oldStepNav(step);
  return higher(assessment())?h.replace('2 · Kompetenzen','2 · Aufgabenanalyse').replace('5 · Prüfen & Drucken','5 · Note & Drucken'):h;
};
v200Step1=function(a,priv){
  let h=oldStep1(a,priv);
  if(!higher(a))return h;
  h=h.replace(/<section class="detail-section v204-curriculum-ready">[\s\S]*?<\/section>/,
    '<section class="detail-section"><h3>Aufgabenorientierte Bewertung</h3><p>Ab Jahrgang 8 brauchst du für diese Auswertung keinen Kompetenzcheck. Erfasse die Aufgaben und die dafür möglichen Punkte; den schulischen Notenschlüssel kannst du später ergänzen.</p></section>');
  return h.replace(/(<button class="primary" data-v200-step="2") disabled>/,'$1>');
};
const oldAssessmentModal=v188AssessmentModal;
v188AssessmentModal=function(){
  const h=oldAssessmentModal();
  if(!higher(v188AssessmentDraft))return h;
  return h.replace(/<section class="detail-section v204-exam-comps">[\s\S]*?<\/section>/,
    '<section class="detail-section"><h3>Bewertung ab Jahrgang 8</h3><p>Kein Kompetenzraster nötig. Die Punkte und die Note werden später auf einem Aufgabenbogen dargestellt.</p></section>')
    .replace('Unterschriften auf dem Kompetenzbogen','Unterschriften auf dem Punkte- und Notenbogen');
};
const oldAnalysisPrompt=v200AssessmentAnalysisPrompt;
v200AssessmentAnalysisPrompt=function(a,priv){
  if(!higher(a))return oldAnalysisPrompt(a,priv);
  const c=course(a),ct=v200AnonymizedClasstimeStructure(priv?.classtime);
  const example={schema:'schulcockpit.grade-task-analysis.v1',items:[
    {id:'A1',label:'Aufgabe 1',source:'classtime',regularMax:3,bonusMax:0,
      classtimeAliases:['eindeutige Spaltenüberschrift des anonymisierten Exports']}]};
  const txt='# Schulcockpit: Aufgabenanalyse für Jahrgang 8+ – KEINE Schülerdaten\n\n'
    +'Kurs: '+(c?.subject||'')+' '+(c?.name||'')+' · '+(a.title||a.type||'Leistungsnachweis')+' · '+(a.date||'')+'\n'
    +'Prüfungsstoff: '+(a.scope||'nicht angegeben')+'\n'
    +'Prüfungsdateien: '+(a.files||[]).map(f=>f.name).join(', ')+'\n\n'
    +'Sichte die tatsächlich beigefügten Aufgaben und Bewertungsgrundlagen. Erfasse jede bewertete Teilaufgabe mit eindeutiger ID, Aufgabentitel, Quelle (classtime, paper, classtime_bonus oder paper_bonus), regulären und Bonus-Maximalpunkten und erkennbaren Classtime-Spaltennamen. Für Bonusaufgaben gilt regularMax=0. Keine Punkte oder Lösungen erfinden: bei unklaren Punktzahlen, Aufgabenbezügen und Bonusregeln zuerst konkrete Rückfragen stellen.\n'
    +'Ab Jahrgang 8 gibt es KEINE Kompetenzchecks. Erfinde keine E/TE/NNE-Stufen, Kompetenzzuordnungen, Prozentschwellen oder Notenschlüssel. Noten werden erst nach dem lokalen Import der Schülerpunkte anhand des von der Lehrkraft festgelegten Schlüssels berechnet.\n'
    +'Die folgende Classtime-Struktur enthält ausdrücklich KEINE Schülernamen oder Antworten:\n'+ct+'\n\n'
    +'Gib nach Klärung einen einzigen gültigen JSON-Block zwischen <SCHULCOCKPIT_GRADE_TASK_IMPORT> und </SCHULCOCKPIT_GRADE_TASK_IMPORT> aus. Muster:\n'
    +'<SCHULCOCKPIT_GRADE_TASK_IMPORT>\n'+JSON.stringify(example,null,2)+'\n</SCHULCOCKPIT_GRADE_TASK_IMPORT>\n'
    +'Die IDs und Punkte im Muster sind ausschließlich Beispiele, nicht die angenommenen tatsächlichen Werte.\n';
  v200AssertNoStudentLeak(txt,priv);
  return txt;
};
const oldExtract=v200ExtractAnalysis;
v200ExtractAnalysis=function(raw){
  const a=assessment();if(!higher(a))return oldExtract(raw);
  const match=String(raw||'').match(/<SCHULCOCKPIT_GRADE_TASK_IMPORT>\s*([\s\S]*?)\s*<\/SCHULCOCKPIT_GRADE_TASK_IMPORT>/);
  if(!match)throw Error('Bitte den vollständigen SCHULCOCKPIT_GRADE_TASK_IMPORT-Block übernehmen. Rückfragen von ChatGPT zunächst klären.');
  let data;try{data=JSON.parse(match[1]);}catch(_){throw Error('Ungültiges JSON im Aufgabenimport.');}
  if(data?.schema!=='schulcockpit.grade-task-analysis.v1'||!Array.isArray(data.items)||!data.items.length||data.items.length>150)
    throw Error('Die Analyse muss 1–150 Aufgaben im Schema schulcockpit.grade-task-analysis.v1 enthalten.');
  const ids=new Set(),items=data.items.map(it=>{
    if(typeof it.id!=='string'||!it.id.trim()||ids.has(it.id))throw Error('Eindeutige Aufgaben-IDs fehlen.');ids.add(it.id);
    if(!['classtime','paper','classtime_bonus','paper_bonus'].includes(it.source))throw Error('Unbekannte Aufgabenquelle bei '+it.id);
    const reg=Number(it.regularMax),bon=Number(it.bonusMax||0),isBonus=it.source.endsWith('_bonus');
    if(!Number.isFinite(reg)||!Number.isFinite(bon)||reg<0||bon<0||isBonus&&reg!==0||isBonus&&bon<=0||!isBonus&&reg<=0)
      throw Error('Unplausible Maximalpunkte bei '+it.id);
    if(typeof it.label!=='string'||!it.label.trim()||it.label.length>150)throw Error('Aufgabenbezeichnung fehlt bei '+it.id);
    if(!Array.isArray(it.classtimeAliases||[])||(it.classtimeAliases||[]).some(s=>typeof s!=='string'||s.length>150))
      throw Error('Ungültige Classtime-Spaltenbezeichnung bei '+it.id);
    return {id:it.id,label:it.label,source:it.source,regularMax:reg,bonusMax:bon,
      competencyId:internalId,classtimeAliases:it.classtimeAliases||[]};
  });
  if(!items.some(it=>!it.source.endsWith('_bonus')))throw Error('Mindestens eine reguläre Aufgabe wird für eine Note benötigt.');
  return {schema:'schulcockpit.assessment-analysis.v1',taskOnlyV260:true,
    thresholds:{source:'Für Aufgaben-/Notenbewertung nicht anwendbar'},
    competencies:[{id:internalId,text:'Aufgabenpunkte – interne Gruppierung, keine Kompetenzbewertung',topic:'Leistungsnachweis',source:'Intern'}],
    items,notes:'Aufgabenorientierte Notenauswertung ohne Kompetenzchecks.'};
};
const oldImport=v200ImportAnalysis;
v200ImportAnalysis=async function(raw){
  const a=assessment();if(!higher(a))return oldImport(raw);
  const obj=v200ExtractAnalysis(raw),old=a.evaluationV200;
  a.evaluationV200={schema:1,analysis:obj,updatedAt:new Date().toISOString()};
  try{await saveState();v200Eval.rawImport='';render();}
  catch(e){a.evaluationV200=old;throw e;}
};
const oldAnalysisReady=v200AnalysisReady;
v200AnalysisReady=function(){
  if(!higher(assessment()))return oldAnalysisReady();
  const an=analysis();return !!(an?.items?.length&&an.items.some(it=>!core.bonus(it)));
};
const previousStudentReport=v200StudentReport;
v200StudentReport=function(priv,an,stu){
  const old=previousStudentReport(priv,an,stu);
  if(old.participationV210&&old.participationV210!=='present')return old;
  const a=assessment();
  if(!a||!an)return old;
  const computed=core.calculate(an.items,an.competencies,it=>v200GetScore(priv,stu.id,it),!higher(a),an.thresholds,v200StatusFor);
  const scale=scope?scope.forStudent(a,priv,stu,window.SchulcockpitExamAnalysisV317?.select):a.gradeScaleV260;
   const auto=core.grade(computed.totalPct,scale);
  const manual=String(priv?.gradesV260?.[stu.id]||'').trim();
  return {...old,...computed,gradeV260:manual||auto,gradeIsManualV260:!!manual,gradeAutoV260:auto,
    complete:computed.complete&&computed.totalMax>0,participationV210:'present'};
};
const previousStep3=v200Step3;
v200Step3=function(a,priv){
  let h=previousStep3(a,priv),an=analysis();
  if(!an?.items?.length)return h;
  if(higher(a))h=h.replace(/<td><select data-v210-criterion="[^"]+">[\s\S]*?<\/select><\/td>/g,'<td>–</td>')
    .replace(/Kompetenzraster/g,'Aufgabenpunkte').replace('und Kompetenz','und Punkte');
  const eligible=an.items.filter(it=>!String(it.source||'').endsWith('_bonus'));
  return '<section class="detail-section v260-reclass"><h3>Bewertung nachträglich anpassen</h3>'+
    '<p>Hier kannst du eine ursprünglich reguläre Classtime- oder Papieraufgabe nach der Korrektur <strong>als Bonus</strong> werten. Originaldaten, erreichte Einzelpunkte und die ursprüngliche Quelle bleiben erhalten. Die Aufgabe zählt anschließend nicht mehr zur regulären Gesamtpunktzahl.</p>'+
    '<div class="v260-reclass-rows">'+eligible.map(it=>'<label class="v260-reclass-row"><input type="checkbox" data-v260-bonus="'+esc(it.id)+'" '+(it.bonusInsteadV260?'checked':'')+'>'+
    '<span><strong>'+esc(it.label||it.id)+'</strong> · '+esc(it.source)+' · '+esc(scoreLabel(it.regularMax))+' mögliche Punkte</span></label>').join('')+'</div>'+
    '<p class="microcopy">Für die Gesamtpunktzahl werden reguläre und erzielte Bonuspunkte addiert (höchstens 100 %). In Jahrgang 5–7 wird die E/TE/NNE-Stufe jeder Unterkompetenz weiterhin nur aus den Aufgaben dieser Kompetenz berechnet.</p>'+
    '<button class="secondary" type="button" data-v260-save-bonus>Bonuseinstufung prüfen und speichern</button></section>'+h;
};
const previousStep4=v200Step4;
v200Step4=function(a,priv){
  const h=previousStep4(a,priv);
  return '<div class="detail-section"><p class="microcopy">Nachträglich als Bonus markierte Aufgaben bleiben in dieser Tabelle in ihrer ursprünglichen Classtime-/Papier-Spalte. Die korrigierten Gesamtpunkte siehst du in Schritt 5.</p></div>'+h;
};
const previousStep5=v200Step5;
v200Step5=function(a,priv){
  const h=previousStep5(a,priv);
  if(!higher(a))return h;
  // The grade dropdown is a filtered report list; the raw roster may
  // contain other versions, excluded pupils and an entirely different Leon.
  const reports=v200ReportList(),idx=v224Index(reports.length);
  const r=reports[idx]||null,student=r?.student||null;
  const kind=selectedKind(a);
   const scale=(scope?scope.forTab(a,priv,kind):a.gradeScaleV260)||['','','','',''];
  const cutoffNames=['Note 1 ab','Note 2 ab','Note 3 ab','Note 4 ab','Note 5 ab'];
  const count=reports.filter(x=>x.complete).length;
  const selectedReportIndex=idx;
   const chooser='<div class="v260-grade-navigator"><label>Kind auswählen <select data-v224-student>'+
    reports.map((x,i)=>'<option value="'+i+'" '+(selectedReportIndex===i?'selected':'')+'>'+esc(x.student.name)+'</option>').join('')+'</select></label></div>';
  const section='<section class="detail-section v260-grades"><h3>Jahrgang 8+: Punkte- und Notenübersicht</h3>'+
    '<p>Für diese Klasse wird anstelle eines Kompetenzchecks ein A4-Bogen mit <strong>allen Aufgaben, Sollpunkten, Istpunkten, Bonuskennzeichnung, Gesamtpunkten und Note</strong> gedruckt. Die ursprüngliche Classtime-Note wird nicht übernommen.</p>'+
    (scope?.fileKey(kind)?'<p class="microcopy"><strong>Eigener Notenschlüssel dieser Prüfungsfassung.</strong> Änderungen hier beeinflussen die reguläre Arbeit nicht.</p>':'')+
     chooser+v234NameEditor(priv)+
    '<div class="v260-grade-thresholds">'+cutoffNames.map((name,i)=>'<label>'+name+' (%)<input data-v260-scale="'+i+'" inputmode="decimal" type="number" min="0" max="100" step="0.01" value="'+esc(scale[i]??'')+'"></label>').join('')+'</div>'+
    '<p class="microcopy">Für eine automatische Note bitte den tatsächlich gültigen Notenschlüssel eintragen. Ohne vollständigen Schlüssel erfolgt <strong>keine automatische Notenvergabe</strong>. Eine einzelne Note kannst du jederzeit manuell festlegen.</p>'+
    '<button type="button" class="secondary" data-v260-save-scale>Notenschlüssel speichern</button>'+
    (r?'<div class="v260-grade-student"><p><strong>'+esc(student.name)+'</strong>: '+scoreLabel(r.totalReg)+' regulär + '+scoreLabel(r.totalBonusEarned)+' Bonus → <strong>'+scoreLabel(r.totalAdjusted)+' / '+scoreLabel(r.totalMax)+'</strong> ('+(r.totalPct===null?'–':v233Number(r.totalPct)+' %')+')</p>'+
    '<label>Note für dieses Kind (manuelle Festlegung oder leer für Automatik) <select data-v260-grade="'+esc(student.id)+'">'+
      [['','Automatisch / offen'],...['1','2','3','4','5','6'].map(n=>[n,'Note '+n])].map(x=>'<option value="'+x[0]+'" '+(String(priv.gradesV260?.[student.id]||'')===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></label>'+
    '<p>'+esc(r.gradeV260?'Aktuelle Note: '+r.gradeV260+(r.gradeIsManualV260?' (manuell)':' (nach Notenschlüssel)'):'Aktuelle Note: noch offen')+'</p></div>':'')+'</section>';
  // Die bestehende Rückgabeseite enthält sonst ausdrücklich einen
  // Kompetenzcheck samt E/TE/NNE-Textvorschlägen. Nur in 8+ ersetzen.
  const print='<section class="detail-section v224-print"><h3>Punkte- und Notenbögen drucken</h3>'+
    '<p>'+count+' von '+reports.length+' Aufgabenbögen vollständig. Die Noten werden ausschließlich aus deinem Notenschlüssel oder der manuellen Festlegung übernommen.</p>'+
    v233Options(a)+v204PdfOptions(a)+
    '<div class="v200-actions"><button class="secondary" data-v200-step="4">← Punkte korrigieren</button>'+
    '<button class="secondary" data-v200-combined-pdf '+(count?'':'disabled')+'>Gesamt-PDF</button>'+
    '<button class="primary" data-v200-pdf-zip '+(count?'':'disabled')+'>Einzelne Punkte- und Notenbögen als PDF-ZIP</button></div></section>';
  return section+print;
};
async function saveBonus(){
  const a=assessment(),an=analysis();if(!a||!an)return;
  const originals=structuredClone(an.items),next=structuredClone(an.items);
  for(const it of next){
    const check=document.querySelector('[data-v260-bonus="'+it.id+'"]');
    if(check&&!String(it.source||'').endsWith('_bonus'))it.bonusInsteadV260=check.checked;
  }
  if(JSON.stringify(originals)===JSON.stringify(next))return;
  const graded=next.filter(it=>!core.bonus(it)),total=graded.reduce((n,it)=>n+core.max(it),0);
  if(total<=0)throw Error('Mindestens eine regulär bewertete Aufgabe muss übrig bleiben.');
  const regularIds=new Set(graded.map(x=>x.competencyId));
  const unassessed=!higher(a)?(an.competencies||[]).filter(c=>!regularIds.has(c.id)):[];
  const changes=next.filter((it,i)=>!!it.bonusInsteadV260!==!!originals[i].bonusInsteadV260);
  if(!confirm(changes.map(it=>(it.bonusInsteadV260?'Als Bonus: ':'Wieder regulär: ')+(it.label||it.id)).join('\n')+
    '\n\nNeue reguläre Maximalpunktzahl: '+total+' Punkte.'+
    (unassessed.length?'\nHinweis: '+unassessed.map(c=>c.text).join('; ')+' hat danach keine regulären Punkte, wird im Kompetenzraster als „nur Bonus“ gekennzeichnet und erhält keinen E/TE/NNE-Status. Erzielte Bonuspunkte fließen in die Gesamtpunktzahl ein (höchstens 100 %), aber nicht in die E/TE/NNE-Einstufung anderer Kompetenzen.':'')+
    '\nEinzelpunkte und Original-Classtime-Werte bleiben unverändert. Bewertung wirklich ändern?'))return;
  const reviewed=a.competencySelectionV204?.teacherReviewedV205;
  an.items=next;
  if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=false;
  try{await saveState();render();}
  catch(e){an.items=originals;if(a.competencySelectionV204)a.competencySelectionV204.teacherReviewedV205=reviewed;throw e;}
}
async function saveScale(){
  const a=assessment();if(!higher(a))return;
  const entries=[...document.querySelectorAll('[data-v260-scale]')].sort((x,y)=>Number(x.dataset.v260Scale)-Number(y.dataset.v260Scale));
  const scale=entries.map(el=>el.value.trim().replace(',','.'));
  if(scale.some(Boolean)&&!core.validateScale(scale))throw Error('Bitte alle fünf Notengrenzen zwischen 0 und 100 eingeben: Note 1 > 2 > 3 > 4 > 5. Oder alle Felder leeren, um die automatische Benotung auszuschalten.');
  const kind=selectedKind(a);
  if(kind!=='standard'){
    const key=scope?.fileKey(kind);
    const allowed=window.SchulcockpitExamTabsV338?.available?.(a)?.some(f=>f.key===kind);
    if(!key||!allowed)throw Error('Diese Prüfungsfassung ist nicht mehr eindeutig vorhanden. Es wurde nichts gespeichert.');
    const next=scope.withScale(v200Eval?.privateData,key,scale.some(Boolean)?scale:null);
    await v200PrivatePut(next);
    v200Eval.privateData=next;
    render();
    return;
  }
  const old=a.gradeScaleV260===undefined?undefined:structuredClone(a.gradeScaleV260);
  a.gradeScaleV260=scale.some(Boolean)?scale.map(Number):undefined;
  try{await saveState();render();}
  catch(e){a.gradeScaleV260=old;throw e;}
}
async function saveManualGrade(id,value){
  const priv=v200Eval?.privateData;
  if(!priv||(value&&!['1','2','3','4','5','6'].includes(value)))throw Error('Ungültige Note.');
  const old=priv.gradesV260?.[id];
  priv.gradesV260=priv.gradesV260||{};
  if(value)priv.gradesV260[id]=value;else delete priv.gradesV260[id];
  try{await v200PrivatePut(priv);render();}
  catch(e){if(old===undefined)delete priv.gradesV260[id];else priv.gradesV260[id]=old;throw e;}
}
const previousWire=wire;
wire=function(){
  previousWire();
  document.querySelector('[data-v260-save-bonus]')?.addEventListener('click',()=>void saveBonus().catch(e=>alert(e.message||e)));
  document.querySelector('[data-v260-save-scale]')?.addEventListener('click',()=>void saveScale().catch(e=>alert(e.message||e)));
  document.querySelectorAll('[data-v260-grade]').forEach(el=>el.addEventListener('change',()=>void saveManualGrade(el.dataset.v260Grade,el.value).catch(e=>alert(e.message||e))));
};
const originalReportPages=v233ReportPages;
v233ReportPages=function(r,a,sig){
 if(!higher(a))return originalReportPages(r,a,sig);
 if(!r?.complete)throw Error('Der Punktebogen kann erst nach vollständiger Korrektur gedruckt werden.');
 const model=window.SchulcockpitGradeSheetV3315;
 if(!model)throw Error('Die Aufgaben- und Punkteübersicht wurde nicht geladen.');
 const rows=model.taskRows(r.itemsV260||[]);
 if(!rows.length)throw Error('Für diesen Rückgabebogen sind keine Aufgabenpunkte vorhanden.');
 const p=v233Colors(a),pages=[];let out,y;
 const bonusPossible=rows.reduce((sum,row)=>sum+row.bonusMax,0);
 const priv=typeof v200Eval!=='undefined'?v200Eval?.privateData:null;
 const gradeKeys=model.gradeBoundaries(r.totalMax,model.scaleForReport(r,a,priv));
 const fmt=model.showPoints;
 function header(continued,withTable){
   out=[];pages.push(out);
   v233Fill(out,42,815,42,4,p.accent);
   v233Text(out,42,792,v233Label(a).toUpperCase(),10,'F2',p.muted);
   v233Text(out,553,792,state.settings?.schoolYear||'',9,'F2',p.muted,'right');
   const topic=v233Topic(a)||'Leistungsnachweis';
   v233Wrap(topic,506,20,'F4').slice(0,2).forEach((line,i)=>
     v233Text(out,42,764-i*22,line,20,'F4',p.ink));
   v233Text(out,42,712,continued?'Punkteübersicht · Fortsetzung':
     'Deine Punkte- und Notenübersicht',11,'F2',p.muted);
   v233Line(out,42,700,553,700,p.line);
   v233Text(out,42,679,v234PrintName(r),12,'F2',p.ink);
   v233Text(out,42,661,'Geschrieben am: '+(v233Date(a.date)||'–'),9,'F1',p.muted);
   v233Text(out,553,661,'Korrigiert am: '+
     (v233Date(v233Settings(a).correctedAt)||'–'),9,'F1',p.muted,'right');
   y=635;
   if(withTable)tableHead();
 }
 function tableHead(){
   v233Fill(out,42,y-36,511,36,p.dark);
   v233Text(out,51,y-23,'Aufgabe',10,'F2',p.white);
   v233Text(out,403,y-16,'Regulär',9,'F2',p.white,'center');
   v233Text(out,403,y-28,'erreicht / möglich',7.4,'F1',p.white,'center');
   v233Text(out,505,y-16,'Bonus',9,'F2',p.white,'center');
   v233Text(out,505,y-28,'erreicht / möglich',7.4,'F1',p.white,'center');
   y-=36;
 }
 header(false,true);
 for(const [i,row] of rows.entries()){
   const names=v233Wrap(row.label,292,9.4,'F1');
   const note=row.note?v233Wrap(row.note,292,8,'F1'):[];
   const height=Math.max(30,13+names.length*11+(note.length?note.length*10+2:0));
   if(y-height<160)header(true,true);
   v233Fill(out,42,y-height,511,height,i%2?p.white:p.stripe);
   if(row.hasBonus)v233Fill(out,459,y-height,94,height,p.soft);
   names.forEach((line,j)=>v233Text(out,51,y-15-j*11,line,9.4,'F1',p.ink));
   note.forEach((line,j)=>v233Text(out,51,y-16-names.length*11-j*10,line,8,'F1',p.muted));
   const regular=row.excluded?'nicht gewertet':
     row.hasRegular?(row.open?'offen':fmt(row.regularEarned)+' / '+fmt(row.regularMax)):'–';
   const bonus=row.excluded?'–':
     row.hasBonus?(row.open?'offen':fmt(row.bonusEarned)+' / '+fmt(row.bonusMax)):'–';
   const baseline=y-height/2-3;
   v233Text(out,402,baseline,regular,row.excluded?7.2:9.5,'F2',p.ink,'center');
   v233Text(out,505,baseline,bonus,9.2,'F2',row.hasBonus?p.bonus:p.muted,'center');
   v233Line(out,42,y-height,553,y-height,p.line);
   y-=height;
 }
 // Keep teacher-defined learning areas from previous versions as an optional,
 // compact supplement. The TASK list remains the primary score breakdown;
 // no compulsory E/TE/NNE competency block in grade 8+.
 const areas=(r.learningAreasV267||[]).filter(area=>Number(area.regularMax)>0);
 if(areas.length){
   if(y<215)header(true,false);
   y-=11;
   v233Text(out,42,y,'LERNBEREICHE · ergänzende Punkteübersicht',8.7,'F2',p.muted);
   y-=13;
   for(const area of areas){
     const lines=v233Wrap(area.label,320,8.8,'F1');
     const h=Math.max(26,12+lines.length*11);
     if(y-h<152)header(true,false);
     v233Fill(out,42,y-h,511,h,p.stripe);
     lines.forEach((line,j)=>v233Text(out,51,y-16-j*11,line,8.8,'F1',p.ink));
     const reg=fmt(area.regularEarned)+' / '+fmt(area.regularMax);
     const bonus=Number(area.bonusEarned)>0?' (+ '+fmt(area.bonusEarned)+' Bonus)':'';
     v233Text(out,542,y-h/2-3,reg+bonus,8.3,'F2',p.ink,'right');
     v233Line(out,42,y-h,553,y-h,p.line);
     y-=h;
   }
 }
 // Keep the calculation together. An additional page is preferable to
 // squeezing the real grading scale onto a tiny unreadable area.
 if(y<339)header(true,false);
 y-=11;
 v233Fill(out,42,y-83,511,83,p.soft);
 v233Text(out,53,y-17,'REGULÄRE PUNKTE',8.5,'F2',p.muted);
 v233Text(out,53,y-41,fmt(r.totalReg)+' / '+fmt(r.totalMax),15,'F2',p.ink);
 v233Text(out,209,y-17,'BONUSPUNKTE',8.5,'F2',p.muted);
 v233Text(out,209,y-41,fmt(r.totalBonusEarned)+' / '+fmt(bonusPossible),15,'F2',p.bonus);
 v233Text(out,209,y-59,'erreicht / möglich',7.8,'F1',p.muted);
 v233Text(out,387,y-17,'ANRECHENBAR',8.5,'F2',p.muted);
 v233Text(out,387,y-41,fmt(r.totalAdjusted)+' / '+fmt(r.totalMax),15,'F2',p.accent);
 v233Text(out,387,y-59,(r.totalPct===null?'–':v233Number(r.totalPct))+' %',9,'F2',p.muted);
 y-=96;
 v233Text(out,42,y,'NOTE: '+(r.gradeV260||'noch offen'),14,'F2',p.ink);
 if(r.gradeIsManualV260)v233Text(out,212,y,'manuell festgelegt',8,'F1',p.muted);
 y-=21;
 if(gradeKeys.length){
   v233Text(out,42,y,'NOTENSCHLÜSSEL · Prozent und Mindestpunkte',9.2,'F2',p.muted);
   y-=12;
   const width=164,cellHeight=34;
   for(const [i,grade] of gradeKeys.entries()){
     const column=i%3,line=Math.floor(i/3),x=42+column*173,top=y-line*38;
     v233Fill(out,x,top-cellHeight,width,cellHeight,p.stripe);
     v233Line(out,x,top-cellHeight,x+width,top-cellHeight,p.line);
     v233Text(out,x+8,top-13,'Note '+grade.grade,9.5,'F2',p.ink);
     v233Text(out,x+75,top-13,grade.label,8,'F1',p.muted);
     v233Text(out,x+8,top-28,grade.pointsLabel,8,'F1',p.ink);
   }
   y-=80;
   v233Text(out,42,y,'Punktgrenzen rechnerisch auf 0,01 Punkte aufgerundet; maßgeblich sind die Prozentgrenzen.',7.4,'F1',p.muted);
   y-=14;
 }else{
   v233Text(out,42,y,'Kein vollständiger Notenschlüssel hinterlegt. Die Note kann manuell festgelegt werden.',8.1,'F1',p.muted);
   y-=21;
 }
 if(y<94)throw Error('Punkte- und Notenbogen: Nicht genügend Platz für die Unterschrift.');
 v233Text(out,42,97,'Bonuspunkte werden bis maximal 100 % angerechnet; die reguläre Maximalpunktzahl bleibt gleich.',7.5,'F1',p.muted);
 v233Sign(out,p,a,!!sig);
 if(pages.length>1)for(let i=0;i<pages.length;i++)
   v233Text(pages[i],553,28,(i+1)+' / '+pages.length,7.5,'F1',p.muted,'right');
 // IMPORTANT: v204PdfBytes needs a PDF content STREAM (string), not an
 // array of commands. Returning arrays truncated /Length and left huge blank
 // colored blocks in the finished A4 output.
 return pages.map(commands=>commands.join(''));
};
})();
