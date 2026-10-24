/* Schulcockpit V0.26.0 – Bewertungswechsel ohne Verlust der Classtime-Rohwerte;
 * Punkte- und Notenbogen für Jahrgang 8+. Persönliche Noten nur im Privatdatenspeicher. */
(function(){
'use strict';
const core=SC_GRADING_V260;
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
  const auto=core.grade(computed.totalPct,a.gradeScaleV260);
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
    '<p class="microcopy">Bei Jahrgang 5–7 können Bonuspunkte weiterhin nur die zugeordnete Kompetenz auffüllen. Bei Jahrgang 8+ werden sie mit der Gesamtpunktzahl verrechnet (höchstens 100 %).</p>'+
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
  const idx=Math.min(Math.max(0,Number(v200Eval.studentIndex)||0),(priv?.roster||[]).length-1);
  const student=priv?.roster?.[idx],r=student?v200StudentReport(priv,analysis(),student):null;
  const scale=a.gradeScaleV260||['','','','',''];
  const cutoffNames=['Note 1 ab','Note 2 ab','Note 3 ab','Note 4 ab','Note 5 ab'];
  const reports=v200ReportList(),count=reports.filter(x=>x.complete).length;
  const chooser='<div class="v260-grade-navigator"><label>Kind auswählen <select data-v224-student>'+
    reports.map((x,i)=>'<option value="'+i+'" '+(idx===i?'selected':'')+'>'+esc(x.student.name)+'</option>').join('')+'</select></label></div>';
  const section='<section class="detail-section v260-grades"><h3>Jahrgang 8+: Punkte- und Notenübersicht</h3>'+
    '<p>Für diese Klasse wird anstelle eines Kompetenzchecks ein A4-Bogen mit <strong>allen Aufgaben, Sollpunkten, Istpunkten, Bonuskennzeichnung, Gesamtpunkten und Note</strong> gedruckt. Die ursprüngliche Classtime-Note wird nicht übernommen.</p>'+
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
  if(!higher(a)){
    const ids=new Set(graded.map(x=>x.competencyId));
    const missing=(an.competencies||[]).filter(c=>!ids.has(c.id));
    if(missing.length)throw Error('Mindestens eine Kompetenz hätte danach keine regulären Punkte mehr. Bitte die Zuordnung zuerst prüfen: '+missing.map(x=>x.text).join('; '));
  }
  const changes=next.filter((it,i)=>!!it.bonusInsteadV260!==!!originals[i].bonusInsteadV260);
  if(!confirm(changes.map(it=>(it.bonusInsteadV260?'Als Bonus: ':'Wieder regulär: ')+(it.label||it.id)).join('\n')+
    '\n\nNeue reguläre Maximalpunktzahl: '+total+' Punkte. Einzelpunkte und Original-Classtime-Werte bleiben unverändert. Bewertung wirklich ändern?'))return;
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
  const p=v233Colors(a),pages=[];let out,y;
  function page(continued){
    out=[];pages.push(out);v233Fill(out,42,815,42,4,p.accent);
    v233Text(out,42,792,v233Label(a).toUpperCase(),10,'F2',p.muted);
    v233Text(out,553,792,state.settings?.schoolYear||'',9,'F2',p.muted,'right');
    const title=v233Topic(a)||'Leistungsnachweis';
    v233Wrap(title,506,20,'F4').slice(0,2).forEach((line,i)=>v233Text(out,42,764-i*22,line,20,'F4',p.ink));
    v233Text(out,42,712,continued?'Punkteübersicht · Fortsetzung':'Deine Punkte- und Notenübersicht',11,'F2',p.muted);
    v233Line(out,42,700,553,700,p.line);
    v233Text(out,42,679,v234PrintName(r),12,'F2',p.ink);
    v233Text(out,42,661,'Geschrieben am: '+(v233Date(a.date)||'–'),9,'F1',p.muted);
    v233Text(out,553,661,'Korrigiert am: '+(v233Date(v233Settings(a).correctedAt)||'–'),9,'F1',p.muted,'right');
    y=635;
    v233Fill(out,42,y-35,511,35,p.dark);
    v233Text(out,51,y-22,'Aufgabe',10,'F2',p.white);
    v233Text(out,379,y-22,'Möglich',9,'F2',p.white,'center');
    v233Text(out,449,y-22,'Erreicht',9,'F2',p.white,'center');
    v233Text(out,525,y-22,'Wertung',9,'F2',p.white,'center');
    y-=35;
  }
  page(false);
  for(const [i,it] of (r.itemsV260||[]).entries()){
    const lines=v233Wrap(it.label,273,10,'F1'),height=Math.max(34,16+lines.length*13);
    if(y-height<198)page(true);
    v233Fill(out,42,y-height,511,height,i%2?p.white:p.stripe);
    if(it.bonus)v233Fill(out,507,y-height,46,height,p.soft);
    lines.forEach((line,n)=>v233Text(out,52,y-18-n*13,line,10,'F1',p.ink));
    v233Text(out,379,y-height/2-3,scoreLabel(it.max),10,'F1',p.ink,'center');
    v233Text(out,449,y-height/2-3,it.earned===null?'offen':scoreLabel(it.earned),10,'F2',p.ink,'center');
    v233Text(out,525,y-height/2-3,it.bonus?'Bonus':'regulär',8.4,'F2',it.bonus?p.bonus:p.muted,'center');
    v233Line(out,42,y-height,553,y-height,p.line);y-=height;
  }
  if(y<254)page(true);
  y-=17;v233Fill(out,42,y-91,511,91,p.soft);
  v233Text(out,54,y-20,'REGULÄRE PUNKTE',9,'F2',p.muted);
  v233Text(out,54,y-43,scoreLabel(r.totalReg)+' / '+scoreLabel(r.totalMax),16,'F2',p.ink);
  v233Text(out,54,y-66,'Bonuspunkte erreicht: + '+scoreLabel(r.totalBonusEarned),9,'F1',p.bonus);
  v233Text(out,315,y-20,'ANRECHENBAR',9,'F2',p.muted);
  v233Text(out,315,y-43,scoreLabel(r.totalAdjusted)+' / '+scoreLabel(r.totalMax),16,'F2',p.accent);
  v233Text(out,315,y-66,(r.totalPct===null?'–':v233Number(r.totalPct))+' % · maximal 100 %',9,'F1',p.muted);
  y-=117;
  v233Text(out,42,y,'NOTE: '+(r.gradeV260||'______'),14,'F2',p.ink);
  if(!r.gradeV260)v233Text(out,42,y-18,'Noch keine Note eingetragen bzw. kein gültiger Notenschlüssel hinterlegt.',8.5,'F1',p.muted);
  v233Text(out,42,121,'Bonusaufgaben erhöhen nicht die regulär erreichbare Gesamtpunktzahl.',8,'F1',p.muted);
  v233Sign(out,p,a,!!sig);
  return pages;
};
})();
