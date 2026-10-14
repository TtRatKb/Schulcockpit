/* Schulcockpit V0.20.7: Quellenprüfung der Original-PDFs (Mathematik 02.04.2025,
   Religion Stand Juni 2019, Methodencurriculum Mathematik 28.03.2019).
   Bestehende Kompetenztexte/-IDs und sämtliche Unterrichts-/Prüfungsdaten
   werden bewusst NICHT verändert. Nur Darstellungs-/Planungslogik. */
const V207_VERSION='V0.20.7';
const V207_INCOMPLETE_SOURCE=new Map([
 ['methode-10-1','Im Methodencurriculum steht hier nur „Quadratische Funktionen (UE Parabeln)“; keine konkrete Methode formuliert.'],
 ['methode-10-8','Im Methodencurriculum steht nur „(UE Wachstum und Prognosen)“; die Methode fehlt im Original.'],
 ['mathe-8-36-all-k09','Die GTR-Spalte nennt ausdrücklich keine verbindliche Kompetenz, sondern nur optionales diWeMa-Material.'],
 ['mathe-8-37-all-k17','„Komplett mit GeoGebra machbar“ ist ein Umsetzungshinweis, kein eigenständiges Lernziel.'],
 ['mathe-10-59-e-k20','„Siehe Kern, ggf. auch hier mit Regression“ verweist auf andere Inhalte; keine eigenständige messbare Kompetenz.']
]);
const v207IsIncomplete=c=>V207_INCOMPLETE_SOURCE.has(c?.id);
const v207UnassignedMethods=(grade)=>v202MethodsForGrade(grade).filter(m=>!(m.topicHints||[]).length&&!v207IsIncomplete(m));
if(V202_CURRICULUM?.sources?.methoden_mathematik){
  V202_CURRICULUM.sources.methoden_mathematik.uploadedFile='Schulinternes Methodencurriculum Mathematik.pdf';
  V202_CURRICULUM.sources.methoden_mathematik.sourceVerifiedV207=true;
}

const v207MethodSuggestedBefore=v202MethodSuggested;
v202MethodSuggested=function(m,q,topic){
  if(v207IsIncomplete(m))return false;
  // Das offizielle Mathe-Tableau S.15 fasst I/II/Haustiere zusammen.
  // Daraus darf der Stationslern-Eintrag nur für „Rund um die Haustiere“
  // abgeleitet werden, nicht automatisch für beide Grundrechenarten-Reihen.
  const grade=v202Grade(cls(q?.classId));
  if(grade===5&&v202SubjectKey(cls(q?.classId))==='mathematik'
    &&topic?.id==='mathe-5-15-all'&&m?.id==='methode-5-7'){
    return /haustier/i.test(String(q?.title||''));
  }
  return v207MethodSuggestedBefore(m,q,topic);
};

// Fragmentarische Werkzeug-/Quellenhinweise bleiben im unveränderten
// PDF-Katalog sichtbar, zählen aber nicht als erreichte, zu prüfende Ziele.
const v207SequenceBefore=v202SequenceCompetencies;
v202SequenceCompetencies=function(q,topicOverrideId='',methodIdsOverride=null){
  return v207SequenceBefore(q,topicOverrideId,methodIdsOverride).filter(c=>!v207IsIncomplete(c));
};
const v207ExamPoolBefore=v204AllCourseCurriculum;
v204AllCourseCurriculum=function(course){
  return v207ExamPoolBefore(course).filter(c=>!v207IsIncomplete(c));
};

// Die Lesehilfe ist ausdrücklich eine didaktische Umformulierung, nicht
// eine wörtliche Kopie; bei fragmentarischen Quellen keinen Lernstand vortäuschen.
const v207GoalBefore=v205GoalText;
v205GoalText=function(c){
  if(!c?.text)return '';
  if(v207IsIncomplete(c))return 'Quellenhinweis (kein ausformulierter Kompetenzsatz): '+c.text;
  const id=String(c.id||''),text=String(c.text).trim();
  if(id.startsWith('methode-')){
    const body=text.replace(/\s*\(UE\b[\s\S]*$/i,'').trim().replace(/[.!?]$/,'');
    if(/plakatgestaltung und -vorstellung/i.test(body))return 'Die Schüler*innen können ein Plakat gestalten und ihre Ergebnisse vorstellen.';
    if(/^diagramme lesen, erstellen, auswerten/i.test(body))return 'Die Schüler*innen können Diagramme lesen, erstellen und auswerten.';
    if(/^gruppenarbeit/i.test(body))return 'Die Schüler*innen können in einer Gruppe zusammenarbeiten und gemeinsam Ergebnisse erarbeiten.';
    if(/^arbeiten mit dem kompetenzraster/i.test(body))return 'Die Schüler*innen können ein Kompetenzraster zur Planung und Überprüfung ihres Lernwegs verwenden.';
    if(/^lernen an stationen/i.test(body))return 'Die Schüler*innen können selbstständig an Lernstationen arbeiten und Ergebnisse dokumentieren.';
    if(/^fahrplane lesen/i.test(body))return 'Die Schüler*innen können Fahrpläne lesen und Informationen daraus entnehmen.';
    if(/^mappe.{0,4}album anlegen/i.test(body))return 'Die Schüler*innen können eine strukturierte Mappe oder ein Album zu einem Thema anlegen.';
    if(/^umgang mit einem wissenschaftlichen taschenrechner/i.test(body)||/^umgang mit einem wissenschaftlichen taschenrechner/i.test(body.normalize('NFKD')))return 'Die Schüler*innen können einen wissenschaftlichen Taschenrechner sachgerecht benutzen.';
    if(/^umgang mit mathematischem werkzeug/i.test(body)||/^umgang mit mathematischen computerprogrammen/i.test(body)||/^umgang mit computerprogrammen/i.test(body))
      return 'Die Schüler*innen können die genannten mathematischen Werkzeuge bzw. Programme für geeignete Aufgaben benutzen.';
    if(/^maßstabsgerechtes zeichnen/i.test(body))return 'Die Schüler*innen können Zeichnungen maßstabsgerecht anfertigen.';
    if(/^zeichnen in der kabinettprojektion/i.test(body))return 'Die Schüler*innen können Körper in der Kabinettprojektion zeichnen.';
    if(/^lerntempoduett/i.test(body))return 'Die Schüler*innen können im Lerntempoduett zusammenarbeiten.';
    if(/^tandemubung/i.test(body.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')))return 'Die Schüler*innen können Aufgaben im Tandem bearbeiten und Lösungen gegenseitig überprüfen.';
    if(/^poster erstellen und prasentieren/i.test(body.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')))return 'Die Schüler*innen können ein Poster erstellen und präsentieren.';
    if(/^modelle herstellen/i.test(body))return 'Die Schüler*innen können ein Modell zum mathematischen Sachverhalt herstellen.';
    if(/^korpernetze anfertigen/i.test(body.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')))return 'Die Schüler*innen können Körpernetze anfertigen.';
  }
  if(c.category==='Methoden'&&/^(Textarbeit|Stationenarbeit|Bearbeitung von|Erarbeitung von|Deutung und Beschreibung|Geschichte einer Bibel|Der judische Festkreis|Auseinandersetzung mit)/i.test(text.normalize('NFKD').replace(/[\u0300-\u036f]/g,''))){
    return 'Methodische Lernhandlung: '+text;
  }
  return v207GoalBefore(c);
};

// Methoden sichtbar, auch wenn sie weder einem festen Tableau noch einer
// konkreten Unterrichtsstunde sicher zugeordnet werden können.
function v207MethodGuideHtml(year){
  const courses=(state.classes||[]).filter(c=>v202SubjectKey(c)==='mathematik');
  const grades=[...new Set(courses.map(v202Grade).filter(g=>g>=5&&g<=10))].sort((a,b)=>a-b);
  if(!grades.length)return '';
  return '<details class="v207-method-guide" open><summary><strong>Methoden-Fahrplan Mathematik</strong> · Original-Methodencurriculum vom 28.03.2019</summary>'
    +'<p class="microcopy">Alle Einträge des entsprechenden Jahrgangs sind sichtbar. „Vorgeschlagen“ heißt nicht „bereits unterrichtet“ oder „erreicht“. Einträge ohne feste Themenbindung bleiben ausdrücklich offen.</p>'
    +grades.map(g=>{
      const courseIds=new Set(courses.filter(c=>v202Grade(c)===g).map(c=>c.id));
      const qlist=(state.sequences||[]).filter(q=>courseIds.has(q.classId)&&v190SeqYear(q)===year);
      const rows=v202MethodsForGrade(g).map(m=>{
        const candidates=qlist.filter(q=>{
          const topic=v202LinkedTopic(q)||v206Resolution(q).topic;
          return topic&&v202MethodSuggested(m,q,topic);
        });
        const planned=qlist.some(q=>(q.plan||[]).some(u=>(u.competencyIdsV202||[]).includes(m.id)));
        const linked=qlist.some(q=>q.curriculumV202?.methodIds?.includes(m.id));
        const issue=V207_INCOMPLETE_SOURCE.get(m.id);
        const status=issue?'Quelle unvollständig':planned?'In einer Soll-Stunde eingeplant':linked?'Reihe zugeordnet':candidates.length?'Passende Reihe erkannt':'Ohne feste Reihenzuordnung';
        return '<div class="v207-method-row"><span><strong>'+esc(m.text)+'</strong><small>'+esc(m.id)+' · '+esc(status)
          +(candidates.length?' · '+esc(candidates.map(q=>q.title).join(' / ')):'')+'</small>'
          +(issue?'<small class="v207-warning">'+esc(issue)+'</small>':'')+'</span></div>';
      }).join('');
      return '<details class="v207-method-year" open><summary>Jahrgang '+g+' · '+v202MethodsForGrade(g).length+' Quelleinträge</summary>'+rows+'</details>';
    }).join('')
    +'</details>';
}
const v207WizardBefore=v205WizardHtml;
v205WizardHtml=function(){
  const html=v207WizardBefore(),insert=v207MethodGuideHtml(modal?.year||v190PlanningYear());
  if(!insert)return html;
  const pos=html.indexOf('<div class="v205-list">');
  return pos>=0?html.slice(0,pos)+insert+html.slice(pos):html;
};
const v207StatusBefore=v202StatusHtml;
v202StatusHtml=function(q,c){
  const h=v207StatusBefore(q,c);
  if(!v207IsIncomplete(c))return h;
  return h.replace('<strong>'+esc(v205GoalText(c))+'</strong>',
    '<strong>Hinweis statt Kompetenzziel: '+esc(c.text)+'</strong>');
};
const v207BrowseBefore=v202BrowserModal;
v202BrowserModal=function(){
  let html=v207BrowseBefore();
  for(const [id,reason] of V207_INCOMPLETE_SOURCE){
    const match='<small>'+esc(id);
    html=html.replace(match,'<small>'+esc(id)+' · Quelleintrag unvollständig');
  }
  return html;
};

// Konferenz/Quellenhinweise beim Planen explizit berücksichtigen.
const v207PromptBefore=v184Prompt;
v184Prompt=function(){
  const text=v207PromptBefore(),course=cls(v184Flow?.courseId),grade=v202Grade(course);
  if(v202SubjectKey(course)==='religion'&&grade===7){
    const q=seq(v184Flow.sequenceId),name=q?.title||v184Flow.newTitle||'';
    if(/diakonie/i.test(name)){
      const hint='\n\n## Quellennachweis – Themenplan Diakonie, Jg. 7\n'
        +'Im Schulcurriculum Religion 2019 auf PDF-Seite 20 steht ein Themenplan, KEIN eigenes Kompetenz-Tableau: Was ist Diakonie und ihre biblische Herleitung; Recherche zu einer diakonischen Einrichtung, deren Arbeit und Zielgruppe; selbstständig formuliertes Heft mit Deckblatt, Inhaltsverzeichnis und Illustration; Reflexion und Selbsteinschätzung. Die Übergabekonferenz 2026/27 nennt eine Kreativleistung Diakonie. Plane dies als eigene Lernhandlung und Leistungsaufgabe, ohne erfundene Curriculum-IDs oder automatische Kompetenz-Nachweise.\n';
      return text.replace('## Auftrag\n',hint+'\n## Auftrag\n');
    }
  }
  if(v202SubjectKey(course)!=='mathematik'||!grade)return text;
  const q=seq(v184Flow.sequenceId),topic=q?v202LinkedTopic(q)||v206Resolution(q).topic:v202FlowTopic();
  if(!topic)return text;
  const selected=q?.curriculumV202?.confirmed?v202EffectiveMethodIds(q,topic):
    v202DefaultMethodIds(q||{title:v184Flow.newTitle||'',classId:course.id},topic);
  const listed=selected.map(v202Method).filter(m=>m&&!v207IsIncomplete(m));
  const unbound=v207UnassignedMethods(grade);
  const add='\n\n## ORIGINAL-Methodencurriculum Mathematik – Verbindlicher Planungsabgleich\n'
   +'Dokument: Schulinternes Methodencurriculum, 28.03.2019. Die Methoden sind nach Jahrgang und zum Teil nach Unterrichtseinheit angegeben; sie werden spiralförmig wieder aufgegriffen.\n'
   +(listed.length?'Für diese Reihe vorausgewählt:\n'+listed.map(m=>'- '+m.id+': '+m.text+' → '+v205GoalText(m)).join('\n')+'\n':'Für diese Reihe keine eindeutige zusätzliche Methodenverknüpfung; fehlende Zuordnungen offen benennen.\n')
   +(unbound.length?'Jahrgangsmethoden ohne feste Themenzuordnung (nicht still ignorieren): '+unbound.map(m=>m.id+' '+m.text).join('; ')+'\n':'')
   +'Bereits gehaltene Stunden nicht verändern. Offene Methoden transparent ausweisen; Unterrichtsmethode ist nicht automatisch ein individueller Leistungsnachweis.\n';
  return text.replace('## Auftrag\n',add+'\n## Auftrag\n');
};
const v207ExamPromptBefore=v200AssessmentAnalysisPrompt;
v200AssessmentAnalysisPrompt=function(a,priv){
  const text=v207ExamPromptBefore(a,priv);
  if(v202SubjectKey(cls(a?.classId))!=='mathematik')return text;
  const note='\n\n## Original-Hauscurriculum Mathematik 2025 – Kompetenzprüfung\n'
    +'Für neu zu planende schriftliche Lernkontrollen sieht die Schule mindestens 10 Maximalpunkte pro geprüfter Kompetenz vor (S. 4). Bei bereits geschriebenen Arbeiten dürften die tatsächlichen Aufgaben und Punktzahlen NICHT nachträglich geändert werden: Falls einzelne Kompetenzen unter 10 Punkten liegen, weise darauf als fachlich zu prüfenden Sonderfall hin, statt Punkte zu erfinden. Bringe auch die methodischen Kompetenzbezüge nur dort in die Prüfungsanalyse, wo Aufgaben sie tatsächlich bewerten.\n';
  v200AssertNoStudentLeak(text+note,priv);
  return text+note;
};
const v207RenderedBefore=render;
render=function(){v207RenderedBefore();const el=document.querySelector('.brand small');if(el)el.textContent=state.settings.schoolYear+' · '+V207_VERSION;};
render();
