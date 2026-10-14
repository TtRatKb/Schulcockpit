/* Schulcockpit V0.20.5 – Prüfkompetenzen anhand der tatsächlichen Arbeit vorschlagen.
   Das ist keine unkontrollierte Automatik: Vor dem Druck muss eine Lehrkraft die
   Zuordnung Aufgabe ↔ Curriculumkompetenz einmal ausdrücklich prüfen. */
function v205ExamHasTeacherSelection(a){
  const s=v204AssessmentSelection(a,false);
  return !!(s?.confirmed&&s.selectedIds?.length);
}
function v205AutoExamAvailable(a){
  const c=cls(a?.classId);
  return !!(c&&v204AllCourseCurriculum(c).length);
}
function v205ExamNeedsReview(a){
  const s=v204AssessmentSelection(a,false);
  return !!(s?.sourceV205==='ai-proposal'&&!s.teacherReviewedV205);
}

const v205ExamPromptBefore=v200AssessmentAnalysisPrompt;
v200AssessmentAnalysisPrompt=function(a,priv){
  if(v205ExamHasTeacherSelection(a))return v205ExamPromptBefore(a,priv);
  if(!v205AutoExamAvailable(a))return v205ExamPromptBefore(a,priv);
  // V0.20.2-Prompt (mit Datenschutz, Quellen und optionalen Reiheninformationen),
  // ohne die in V0.20.4 verlangte manuelle Vorauswahl.
  let txt=v204AssessmentPromptBefore(a,priv);
  const course=cls(a.classId),grade=v202Grade(course),subject=v202SubjectKey(course);
  const pool=v204AllCourseCurriculum(course),source=v202Source(subject);
  const candidates=v202AssessmentSequenceCandidates(a);
  const matched=candidates.map(q=>q.title+' → '+(v202LinkedTopic(q)?.title||'')).join('; ');
  txt+='\n\n## V0.20.5 – KOMPETENZEN DIREKT AUS DER PRÜFUNG ERMITTELN\n';
  txt+='Die Lehrkraft hat noch keine einzelnen Prüfkompetenzen ausgewählt. Ermittle deshalb die tatsächlich nachweisbar geprüften Kompetenzen aus den beigefügten ORIGINAL-Aufgaben und dem folgenden verbindlichen Jahrgangs-Curriculum. Wähle nur Kompetenzen, die konkrete Aufgaben mit erkennbarer Punkteverteilung belegen. Gib keinesfalls den ganzen Jahrgangskatalog als geprüft aus.\n';
  txt+='Fach: '+subject+'; Jahrgang: '+grade+'; eingetragener Schwerpunkt: '+(a.scope||'offen')+'\n';
  txt+='Zum Prüfungszeitpunkt relevante Reihen als Orientierung (nicht als Beweis): '+(matched||'noch keine sicher verknüpft')+'\n';
  txt+='\n## ERLAUBTE CURRICULUM-IDS DIESER PRÜFUNG\n';
  txt+=pool.map(c=>'- '+c.id+' | '+(c.topicTitle||'')+' | '+(c.category||'Kompetenz')+': '+c.text).join('\n')+'\n';
  txt+='\n## Verbindliche Zuordnungsregeln\n';
  txt+='1. Prüfe jede Aufgabe/Teilaufgabe gegen die erlaubten IDs. Jede gewählte Kompetenz MUSS durch mindestens eine regulär bewertete Aufgabe (regularMax > 0) belegt sein. Aufgaben ohne eindeutige Zuordnung: RÜCKFRAGE statt Import.\n';
  txt+='2. Jedes competencies[]-Objekt braucht "curriculumCompetencyId" mit genau einer erlaubten ID; "text" enthält den vollständigen Wortlaut dieser Kompetenz. Keine frei erfundenen IDs und keine Kompetenz aus einem anderen Jahrgang/Fach.\n';
  txt+='3. Übernehme Punkte und Aufgaben nur aus den Original-Prüfungsdateien und der anonymen Classtime-Spaltenstruktur. Ein Dateiname oder der Prüfungsschwerpunkt allein beweist KEINE konkrete Aufgabe. Fehlt eine Datei oder die Punkteverteilung, frage erst nach und erzeuge noch keinen Importblock.\n';
  txt+='4. Methodenkompetenzen nur aufnehmen, wenn sie in der tatsächlichen Prüfung erkennbar bewertet werden. Bloßes Behandeln im Unterricht genügt nicht.\n';
  txt+='5. Die Zuordnung ist zunächst ein Vorschlag. Die Lehrkraft prüft sie im Schulcockpit vor dem Kompetenzbogen-Druck.\n';
  if(grade>=5&&grade<=7&&source?.thresholds5to7){
    const lim=source.thresholds5to7;
    txt+='6. Verbindliche Kompetenzgrenzen aus '+source.title+': erreicht ab '+lim.reachedMinPct+'%, teilweise erreicht ab '+lim.partialMinPct+'%. Keine anderen Grenzen einsetzen.\n';
  }
  v200AssertNoStudentLeak(txt,priv);
  return txt;
};

const v205ExamExtractBefore=v200ExtractAnalysis;
v200ExtractAnalysis=function(text){
  const a=v200Assessment(v200Eval?.assessmentId);
  if(v205ExamHasTeacherSelection(a))return v205ExamExtractBefore(text);
  if(!v205AutoExamAvailable(a))return v205ExamExtractBefore(text);
  // V0.20.2-Validator behält alle bisherigen Schema-/Punkteprüfungen.
  const obj=v204ExtractAnalysisBefore(text);
  const pool=new Map(v204AllCourseCurriculum(cls(a.classId)).map(c=>[c.id,c]));
  const seen=new Set();
  for(const c of obj.competencies){
    if(!c.curriculumCompetencyId||!pool.has(c.curriculumCompetencyId))
      throw Error('Prüfungskompetenz nicht im Fach-/Jahrgangscurriculum: '+(c.curriculumCompetencyId||c.text||c.id));
    if(seen.has(c.curriculumCompetencyId))
      throw Error('Doppelte curriculare Kompetenz: '+c.curriculumCompetencyId);
    seen.add(c.curriculumCompetencyId);
    c.text=pool.get(c.curriculumCompetencyId).text;
  }
  for(const c of obj.competencies){
    if(!obj.items.some(i=>i.competencyId===c.id&&Number(i.regularMax)>0))
      throw Error('Für die Kompetenz '+c.curriculumCompetencyId+' fehlt eine regulär bewertete Aufgabe. Bitte erst die Zuordnung klären.');
  }
  const grade=v202Grade(cls(a.classId)),limits=v202Source(v202SubjectKey(cls(a.classId)))?.thresholds5to7;
  if(grade>=5&&grade<=7&&limits){
    if(Number(obj.thresholds.reachedMinPct)!==Number(limits.reachedMinPct)||Number(obj.thresholds.partialMinPct)!==Number(limits.partialMinPct))
      throw Error('Die Kompetenzgrenzen weichen vom hinterlegten Hauscurriculum ab.');
  }
  return obj;
};

const v205ImportExamBefore=v200ImportAnalysis;
v200ImportAnalysis=async function(text){
  const a=v200Assessment(v200Eval?.assessmentId),automatic=v205AutoExamAvailable(a)&&!v205ExamHasTeacherSelection(a);
  const wasAutomatic=a?.competencySelectionV204?.sourceV205==='ai-proposal';
  await v205ImportExamBefore(text);
  if(automatic&&a?.evaluationV200?.analysis){
    const ids=[...new Set(a.evaluationV200.analysis.competencies.map(c=>c.curriculumCompetencyId).filter(Boolean))];
    a.competencySelectionV204={schema:1,selectedIds:ids,confirmed:true,sourceV205:'ai-proposal',
      teacherReviewedV205:false,updatedAt:new Date().toISOString()};
    await saveState();
    render();
  }else if(wasAutomatic&&a?.competencySelectionV204){
    // Jede erneute Prüfungsanalyse macht eine frühere Freigabe ungültig.
    a.competencySelectionV204.teacherReviewedV205=false;
    await saveState();render();
  }
};

const v205ExamStep1Before=v200Step1;
v200Step1=function(a,priv){
  let h=v205ExamStep1Before(a,priv);
  if(!v205ExamHasTeacherSelection(a)&&v205AutoExamAvailable(a)){
    h=h.replace('data-v200-step="2" disabled','data-v200-step="2"');
    const n='<p class="v205-exam-note"><strong>Weniger Häkchen:</strong> ChatGPT kann die tatsächlich geprüften Kompetenzen direkt aus der beigefügten Klassenarbeit vorschlagen. Danach prüfst du nur die Aufgaben-Zuordnung. Die originalen Prüfungsaufgaben werden benötigt, individuelle Schülerdaten werden nicht mitgegeben.</p>';
    const i=h.lastIndexOf('<div class="v200-actions">');
    if(i>=0)h=h.slice(0,i)+n+h.slice(i);
  }
  return h;
};
const v205ExamStep3Before=v200Step3;
v200Step3=function(a,priv){
  let h=v205ExamStep3Before(a,priv);
  if(!v205ExamNeedsReview(a))return h;
  const top='<section class="detail-section v205-review"><h3>Automatische Kompetenzzuordnung kontrollieren</h3><p>ChatGPT hat die Kompetenzen aus der Arbeit vorgeschlagen. Prüfe jetzt die Aufgaben- und Punktezuordnung unten; korrigiere nötigenfalls die Zuordnung. Erst nach deiner Freigabe dürfen Kompetenzbögen gedruckt werden.</p><button class="primary" data-v205-approve-exam>Zuordnung geprüft – für Ausdruck freigeben</button></section>';
  return top+h;
};
const v205ExamStep5Before=v200Step5;
v200Step5=function(a,priv){
  let h=v205ExamStep5Before(a,priv);
  if(v205ExamNeedsReview(a))h='<p class="v205-exam-note">Kompetenzzuordnung noch nicht freigegeben. Bitte in Schritt 3 prüfen und freigeben, bevor du PDF-Bögen erstellst.</p>'+h;
  return h;
};
const v205ExamPdfZipBefore=v200DownloadPdfZip;
v200DownloadPdfZip=function(){
  if(v205ExamNeedsReview(v200Assessment(v200Eval?.assessmentId))){alert('Bitte zuerst in Schritt 3 die automatische Kompetenzzuordnung prüfen und freigeben.');return;}
  return v205ExamPdfZipBefore();
};
const v205ExamPdfBefore=v200DownloadCombinedPdf;
v200DownloadCombinedPdf=function(){
  if(v205ExamNeedsReview(v200Assessment(v200Eval?.assessmentId))){alert('Bitte zuerst in Schritt 3 die automatische Kompetenzzuordnung prüfen und freigeben.');return;}
  return v205ExamPdfBefore();
};

// Bei späteren Aufgabenänderungen die Freigabe erneut verlangen.
const v205MappingBefore=v204SaveItemCompetencyMapping;
v204SaveItemCompetencyMapping=async function(){
  await v205MappingBefore();
  const a=v200Assessment(v200Eval?.assessmentId),s=v204AssessmentSelection(a,false);
  if(s?.sourceV205==='ai-proposal'){s.teacherReviewedV205=false;await saveState();render();}
};

const v205ReadExamSelectionBefore=v204ReadExamSelectionIntoDraft;
v204ReadExamSelectionIntoDraft=function(){
  const draft=v188AssessmentDraft,previous=draft?.competencySelectionV204;
  const ids=previous?.selectedIds||[],wasAuto=previous?.sourceV205==='ai-proposal',
    wasReviewed=!!previous?.teacherReviewedV205;
  v205ReadExamSelectionBefore();
  if(wasAuto&&draft?.competencySelectionV204){
    const now=draft.competencySelectionV204;
    now.sourceV205='ai-proposal';
    now.teacherReviewedV205=wasReviewed
      &&ids.length===now.selectedIds.length
      &&ids.every(id=>now.selectedIds.includes(id));
    if(!now.teacherReviewedV205)delete now.reviewedAtV205;
  }
};
const v205ExamSummaryBefore=v204ExamSelectionSummary;
v204ExamSelectionSummary=function(a){
  const h=v205ExamSummaryBefore(a);
  return v205ExamNeedsReview(a)
    ?'<p class="v205-exam-note">Diese Kompetenzliste wurde aus den Prüfungsaufgaben vorgeschlagen. Vor dem Ausdruck ist die Bestätigung in Schritt 3 nötig.</p>'+h
    :h;
};

const v205ExamWireBefore=wire;
wire=function(){
  v205ExamWireBefore();
  document.querySelector('[data-v205-approve-exam]')?.addEventListener('click',async()=>{
    const a=v200Assessment(v200Eval?.assessmentId),s=v204AssessmentSelection(a,false);
    if(!a||!s||s.sourceV205!=='ai-proposal')return;
    if(!a.evaluationV200?.analysis?.items?.length)return alert('Eine Aufgabenanalyse muss zuerst vorliegen.');
    s.teacherReviewedV205=true;s.reviewedAtV205=new Date().toISOString();
    await saveState();render();
  });
};

// Die Erweiterungen sofort sichtbar machen; normale Daten-Hydrierung bleibt unverändert.
render();
