/* Schulcockpit V0.20.8 – Methodencurriculum sichtbar + Themenkarten als
   lokale, unverbindliche Planungshilfen. Keine automatischen State-Migrationen;
   keine fremden DOCX-Dateien oder Schülerdaten im öffentlichen Repository. */
const V208_VERSION='V0.20.8';
const V208_MATH5_THEMENCARDS=Object.freeze([
  {
    key:'grundrechenarten',
    file:'Themenkarte Grundrechenarten I & II 2026-27.docx',
    year:'2026/27',
    overview:'Aktuelle kollegiale Themenkarte: zwei getrennte Teile, laut Vorlage jeweils fünf Wochen/zehn Unterrichtsblöcke. Teil I: große Zahlen, Runden, schriftliches Addieren und Subtrahieren. Teil II: schriftliches Multiplizieren (Blöcke 1–2), schriftliches Dividieren (3–4), Rechengesetze (5–6), differenzierte Mathe-Werkstatt (7–8), Klassenarbeit (9), Rückgabe (10).',
    methods:'Teil II, Blöcke 7–8: mathematische Werkstatt; im Dokument werden Stationenlernen, Lerntheke oder Kompetenzraster als mögliche Formen ausdrücklich genannt. Helferprinzip und Ich–Du–Wir werden vorgeschlagen. Methode 5-7 ist dafür ein fachlich begründeter Vorschlag, nicht automatisch nachgewiesen.',
    caution:'Die Kolleg*innenkarte beschreibt Unterrichtsblöcke, keine verbindlichen Daten. Grundrechenarten I ist bei dieser Lehrkraft bereits durchgeführt; keine historischen Stunden überschreiben. Das Thema „Rund um die Haustiere“ ist nach aktueller Rückmeldung veraltet und darf nicht neu als Pflichtreihe eingeführt werden.'
  },
  {
    key:'unsere-klasse',
    file:'Themenkarte - Unsere Klasse.docx',
    year:'November 2024',
    overview:'Kollegiale Statistik-Themenkarte mit Mini-Projekt: zunächst Strichlisten und Diagramme; in den Blöcken 2–3 planen Lernende eine Klassenbefragung, erheben Daten, gestalten Gruppenplakate und präsentieren die Ergebnisse. Später statistische Kenngrößen und Vorbereitung/Arbeit.',
    methods:'Die Vorlage nennt Plakatgestaltung und -vorstellung, Diagramme lesen/erstellen/auswerten, Gruppenarbeit und sachgerechten Umgang mit Lineal/Bleistift. Die Mini-Projekt-Blöcke 2–3 bieten konkrete Lernhandlungen zu Methode 5-1, 5-2, 5-3 und ggf. 5-5.',
    caution:'Die Themenkarte nennt auch Median/Modalwert/Spannweite. Diese sind nicht allein aufgrund der Karte verpflichtende Jahrgang-5-Kompetenzen; maßgeblich bleibt der Schulcurriculumblock und der dokumentierte Unterrichtsstand.'
  },
  {
    key:'klassenkameraden',
    file:'Themenkarte_Klassenkameraden 25-26.docx',
    year:'2025/26',
    overview:'Kollegiale Themenkarte zu Koordinatensystem, Längen/Zeiten und Weg-Zeit-Diagrammen. Als Unterrichtsvorschlag: Gitternetze/Koordinaten, Längen und Zeiten, Fahrplanarbeit in Block 7, Weg-Zeit-Diagramme in Blöcken 8–9.',
    methods:'In Block 7 stehen eigener Stundenplan und Busfahrplan als Ausgangspunkt zur Bestimmung von Zeitpunkten und Zeitspannen. Dies ist ein konkreter Ort für Methode 5-8 „Fahrpläne lesen“.',
    caution:'Älterer Planungsstand. Die aktuelle Reihe und deren verfügbare Stunden bestimmen, was davon passt.'
  },
  {
    key:'erlebniswelt',
    file:'Themenkarte Erlebniswelt Geometrie 25 26.docx',
    year:'2024–2026, zuletzt 2026 überarbeitet',
    overview:'Kollegiale Geometrie-Themenkarte mit Vorschlag von ca. 12–14 Unterrichtsblöcken: Punkt/Strecke/Gerade, senkrecht/parallel, Abstände, Koordinatensystem, Symmetrien, Vierecke und separater oder integrierter GeoGebra-Einführung. „Gut verpackt“ wird dort optional nach der Arbeit aufgeführt.',
    methods:'In der Vorlage ist GeoGebra ausdrücklich wegen einer medienpädagogischen LEB-Kompetenz als verpflichtend gekennzeichnet; Block 12 oder integriert in der Reihe. Lineal/Geodreieck und ggf. Kompetenzraster/Checkliste werden ebenfalls genannt. Methode 5-6 (mathematische Computerprogramme) unbedingt sichtbar planen.',
    caution:'Der Kollegi*innentext ist eine Planungshilfe, kein Ersatz für offizielle Curriculumsbezüge. Prüfe insbesondere die Trennung von Geometrie/Symmetrie und die als optional markierte Körperfortsetzung.'
  },
  {
    key:'wir-teilen-auf',
    file:'Themenkarte Wir teilen auf 2022_23.docx',
    year:'2022/23',
    overview:'Ältere Themenkarte zu Brüchen als Anteilen, mit Wahl zwischen ausführlicher Lernwerkstatt und stärker gelenktem Unterricht. Werkstatt mit Stationen, Selbstkontrolle und Lerntagebuch; alternativ kürzerer Ablauf.',
    methods:'Methodenvorschlag Geobrett zum handelnden Vergleichen von Anteilen sowie selbstständige Stationenarbeit/Lernwerkstatt und Mappe/Lerntagebuch. Das Methodencurriculum ordnet Geobrett/Album überwiegend Jahrgang 6 zu; daher keine Jahrgang-6-ID allein wegen dieser alten Jahrgang-5-Vorlage hinzufügen.',
    caution:'Historische Themenkarte, nicht automatisch heutiger Pflichtverlauf; Materialdateien M1–M12 stehen nicht bereits durch diese Dateinamenangabe im Cockpit zur Verfügung.'
  },
  {
    key:'spiegelung',
    file:'99 Themenkarte Blüten und Blätter - Spiegelungen.docx',
    year:'2022/23',
    overview:'Älterer Unterrichtsvorschlag zu Achsensymmetrie und Parallelverschiebung mit ca. sieben Unterrichtsblöcken; Spiegel als Anschauungsmaterial, differenzierter Themenplan, Übung und optionaler Test.',
    methods:'Spiegelkarten, Geodreieck und eigenes Erzeugen von Spiegelungen; der mögliche Test sollte laut Themenkarte nur Achsensymmetrie und Parallelverschiebung abdecken.',
    caution:'Historischer Vorschlag; in der alten Themenkarte ist Punktsymmetrie optional beziehungsweise nicht im damaligen Test. Nicht ungeprüft auf die aktuelle Reihen-/LEB-Verteilung übertragen.'
  }
]);
function v208Math5Cards(course,title){
  if(v202SubjectKey(course)!=='mathematik'||v202Grade(course)!==5)return [];
  const n=v202Norm(title);
  if(!n)return [];
  if(/grundrechenarten/.test(n))return [V208_MATH5_THEMENCARDS[0]];
  if(/unsere klasse|statistik/.test(n))return [V208_MATH5_THEMENCARDS[1]];
  if(/klassenkameraden|koordinaten|weg zeit/.test(n))return [V208_MATH5_THEMENCARDS[2]];
  if(/bluten|blatter|spiegel|symmetr/.test(n)&&!/geometrie/.test(n))return [V208_MATH5_THEMENCARDS[5]];
  if(/erlebniswelt geometrie|geometrie|gut verpackt/.test(n))return [V208_MATH5_THEMENCARDS[3]];
  if(/wir teilen auf|bruch/.test(n))return [V208_MATH5_THEMENCARDS[4]];
  return [];
}
function v208MathSecond(q,topic){
  if(!q||topic?.id!=='mathe-5-15-all')return false;
  const c=cls(q.classId),n=v202Norm(q.title);
  return v202SubjectKey(c)==='mathematik'&&v202Grade(c)===5&&/grundrechenarten/.test(n)
    &&(/ii\b|multiplik|divisi|geteilt|mal/.test(n)||/[\*:]/.test(q.title));
}
// Die neue aktuelle Themenkarte belegt einen zusätzlichen *Vorschlag*.
// Bereits bestätigte Methoden-Auswahlen werden NICHT ungefragt verändert.
const v208MethodSuggestedBefore=v202MethodSuggested;
v202MethodSuggested=function(m,q,topic){
  if(m?.id==='methode-5-7'&&v208MathSecond(q,topic))return true;
  return v208MethodSuggestedBefore(m,q,topic);
};

// Transparent erklären, was der bisher missverständliche Status bedeutet,
// und den aktuellen Quellbeleg als sofortigen Ein-Klick-Vorschlag anbieten.
const v208MethodGuideBefore=v207MethodGuideHtml;
v207MethodGuideHtml=function(year){
  let html=v208MethodGuideBefore(year);
  if(!html)return html;
  html=html.replace('„Vorgeschlagen“ heißt nicht „bereits unterrichtet“ oder „erreicht“. Einträge ohne feste Themenbindung bleiben ausdrücklich offen.',
    '„Reihe zugeordnet“ = als Methodenziel gespeichert und bei der ChatGPT-Reihenplanung im Kompetenzblock enthalten. „In einer Soll-Stunde eingeplant“ = konkrete Stunden-ID hinterlegt. Beides bedeutet NICHT „durchgeführt“ oder „bewertet“. Vorschläge bleiben bis zur Bestätigung unverbindlich.');
  const tasks=(state.sequences||[]).filter(q=>v190SeqYear(q)===year
    &&v208MathSecond(q,v202LinkedTopic(q)||v206Resolution(q).topic)
    &&!q.curriculumV202?.methodIds?.includes('methode-5-7'));
  if(!tasks.length)return html;
  const buttons=tasks.map(q=>{
    const linked=v202LinkedTopic(q)?.id==='mathe-5-15-all';
    return '<div class="v208-method-suggestion"><strong>Aktuelle Themenkarte 2026/27: '+esc(q.title)+'</strong>'
      +'<p>Blöcke 7–8: mathematische Werkstatt. Stationenlernen/Lerntheke sind dokumentierte methodische Möglichkeiten; „Rund um die Haustiere“ ist dafür nicht mehr nötig.</p>'
      +(linked?'<button class="secondary small" data-v208-attach-stations="'+esc(q.id)+'">Methode 5-7 dieser Reihe zuordnen</button>'
        :'<span class="muted">Erst das Curriculum-Thema dieser Reihe bestätigen; dann ist die Methode mit einem Klick zuordbar.</span>')
      +'</div>';
  }).join('');
  // Das erste innere <details> ist der Jahrgang 5; die Hauptgruppe bleibt offen.
  const at=html.indexOf('</details>');
  return at>=0?html.slice(0,at)+buttons+html.slice(at):html+buttons;
};

// Die Kolleg*innenvorlagen sind ein Orientierungsmaterial, nicht das
// Original-Schulcurriculum und kein verifizierter Anhang im Chat.
const v208PromptBefore=v184Prompt;
v184Prompt=function(){
  let prompt=v208PromptBefore(),c=cls(v184Flow.courseId),q=seq(v184Flow.sequenceId);
  const cards=v208Math5Cards(c,q?.title||v184Flow.newTitle||'');
  if(!cards.length)return prompt;
  const topic=q?v202LinkedTopic(q)||v206Resolution(q).topic:v202FlowTopic();
  const method5_7=cards[0].key==='grundrechenarten'&&v208MathSecond(q||{classId:c.id,title:v184Flow.newTitle},topic);
  const assigned=!!q?.curriculumV202?.methodIds?.includes('methode-5-7');
  const section='\n\n## Kollegiale Themenkarten als UNVERBINDLICHE Reihenplanungsreferenz\n'
    +'Die folgenden Informationen stammen aus Lehrer*innen-Themenkarten, nicht aus einem neuen Hauscurriculum. Sie sind Vergleichs- und Inspirationsmaterial; ihre älteren Angaben dürfen bestätigte Curriculumsziele, bereits gehaltenen Unterricht oder feststehende Klassenarbeitstermine nicht überschreiben. Ein Block ist kein automatisch datierter Unterrichtstermin.\n'
    +cards.map(card=>'- **'+card.file+'** (Stand '+card.year+')\n  Vorschlag: '+card.overview+'\n  Methodischer Bezug: '+card.methods+'\n  Quellenwarnung: '+card.caution).join('\n')
    +(method5_7?'\nMethodenprüfung 5-7: '+(assigned
       ?'Die Methode ist in dieser Reihe ausdrücklich ausgewählt: als verpflichtend zu berücksichtigendes Lernziel mit ID methode-5-7 in einer geeigneten Werkstattphase verorten.'
       :'Die neue Themenkarte legt Stationenlernen/Lerntheke als Möglichkeit nahe, aber methode-5-7 wurde dieser Reihe NICHT ausdrücklich zugeordnet. Nur als Vorschlag ausweisen und nicht als bereits erfüllt markieren.')+'\n':'')
    +'\nDie hier referenzierten DOCX-Dateien sind NICHT automatisch Teil dieses Prompt-Exports. Für genaue Materialien/Buchseiten: die jeweilige Original-Themenkarte separat in diesen Chat hochladen oder als lokale Planungsdatei der Reihe im Schulcockpit hinterlegen und mitsenden. Ohne Anhang keine genaue Dokumentenanalyse vortäuschen.\n';
  return prompt.replace('## Auftrag\n',section+'\n## Auftrag\n');
};

// Bewusste Benutzerentscheidung: Nur den bestätigten Methodenbezug setzen,
// nie Stunden, Leistungsnachweise, bestehende Kompetenzmarkierungen verändern.
async function v208AssignStations(qid){
  const q=seq(qid),topic=v202LinkedTopic(q);
  if(!v208MathSecond(q,topic))throw Error('Die Methode kann nur der bestätigten Reihe Grundrechenarten II in Jahrgang 5 zugeordnet werden.');
  const old=structuredClone(q.curriculumV202);
  try{
    q.curriculumV202.methodIds=[...new Set([...(q.curriculumV202.methodIds||[]),'methode-5-7'])];
    await saveState();
  }catch(err){q.curriculumV202=old;throw err;}
  modal={type:'v205Wizard',year:v190SeqYear(q)};
  render();
}
const v208WireBefore=wire;
wire=function(){
  v208WireBefore();
  document.querySelectorAll('[data-v208-attach-stations]').forEach(el=>{
    el.onclick=async ()=>{
      try{await v208AssignStations(el.dataset.v208AttachStations);}
      catch(err){alert(err?.message||String(err));}
    };
  });
};
const v208RenderBefore=render;
render=function(){
  v208RenderBefore();
  const brand=document.querySelector('.brand small');
  if(brand)brand.textContent=state.settings.schoolYear+' · '+V208_VERSION;
};
render();
