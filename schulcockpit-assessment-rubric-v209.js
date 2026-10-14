/* Schulcockpit V0.20.9 – Kompetenzraster für die tatsächliche Klassenarbeit.
   Nicht jede prüfbare Teilfähigkeit hat eine eigene offizielle Curriculum-ID.
   Rasterzeilen bleiben eigenständig (auch mehrfach dieselbe übergeordnete ID),
   während der Originalwortlaut des Hauscurriculums separat erhalten bleibt.
   Keine automatische Migration, keine Änderung an vorhandenen Analysen,
   Stunden, Classtime-Tabellen oder privaten Schülerdaten. */
const V209_VERSION='V0.20.9';

function v209RubricAnalysis(a){
  const an=a?.evaluationV200?.analysis;
  return an?.rubricV209?.schema===1?an:null;
}
function v209ExtractRubricInput(text){
  const m=String(text||'').match(/<SCHULCOCKPIT_ASSESSMENT_IMPORT>\s*([\s\S]*?)\s*<\/SCHULCOCKPIT_ASSESSMENT_IMPORT>/);
  if(!m)return null;
  let obj;
  try{obj=JSON.parse(m[1]);}catch{throw Error('Der Kompetenzraster-Import enthält ungültiges JSON.');}
  return obj?.rubricV209?.schema===1?obj:null;
}
function v209CheckRubric(obj,a){
  if(!a)throw Error('Die zugehörige Klassenarbeit wurde nicht gefunden.');
  if(!['provided-rubric','task-derived'].includes(obj.rubricV209.origin))
    throw Error('Die Herkunft des Kompetenzrasters fehlt: provided-rubric oder task-derived.');
  const file=String(obj.rubricV209.sourceFile||'').trim();
  if(obj.rubricV209.origin==='provided-rubric' &&
    (!file||!(a.files||[]).some(f=>String(f.name||'').trim()===file)))
    throw Error('Das vorgegebene Kompetenzraster ist nicht als Prüfungsdatei dieser Arbeit gespeichert. Bitte die Datei unter den Prüfungsunterlagen hinterlegen oder die Analyse ausdrücklich als task-derived kennzeichnen.');
  if(obj.rubricV209.origin==='task-derived'&&!String(obj.rubricV209.derivationNote||'').trim())
    throw Error('Bei neu vorgeschlagenen Rasterzeilen muss die Herleitung aus den tatsächlichen Aufgaben erläutert werden.');
  const standardText=JSON.stringify(obj);
  if(!Array.isArray(obj.competencies)||!obj.competencies.length)throw Error('Keine Kompetenzraster-Zeilen vorhanden.');
  if(!Array.isArray(obj.items)||!obj.items.length)throw Error('Keine Prüfungsaufgaben vorhanden.');
  // Der bestehende V0.20.0-Parser prüft Schema, Punkte/Bonus, IDs,
  // Aufgabenzuordnung und die offiziellen Prozentgrenzen.
  const parsed=v204ExtractAnalysisBefore('<SCHULCOCKPIT_ASSESSMENT_IMPORT>'+standardText+'</SCHULCOCKPIT_ASSESSMENT_IMPORT>');
  const course=cls(a.classId),pool=new Map(v204AllCourseCurriculum(course).map(c=>[c.id,c]));
  const ids=new Set(),grade=v202Grade(course),source=v202Source(v202SubjectKey(course));
  const limits=source?.thresholds5to7;
  if(grade>=5&&grade<=7&&limits &&
    (Number(parsed.thresholds.reachedMinPct)!==Number(limits.reachedMinPct)||
     Number(parsed.thresholds.partialMinPct)!==Number(limits.partialMinPct)))
    throw Error('Die Bewertungsschwellen stimmen nicht mit dem Hauscurriculum überein.');
  const itemsByComp=new Map();
  for(const it of parsed.items){
    if(!itemsByComp.has(it.competencyId))itemsByComp.set(it.competencyId,[]);
    itemsByComp.get(it.competencyId).push(it);
  }
  const originalOrder=parsed.rubricV209.origin==='provided-rubric' &&
    Array.isArray(parsed.rubricV209.criterionOrder)?parsed.rubricV209.criterionOrder:null;
  if(originalOrder && (originalOrder.length!==parsed.competencies.length||
     originalOrder.some((id,i)=>id!==parsed.competencies[i].id)))
    throw Error('Die Reihenfolge der Rasterzeilen stimmt nicht mit criterionOrder überein.');
  for(const c of parsed.competencies){
    if(!c.id||ids.has(c.id))throw Error('Die Zeilen des Kompetenzrasters benötigen verschiedene Bewertungs-IDs.');
    ids.add(c.id);
    if(typeof c.text!=='string'||!c.text.trim())throw Error('Jede Rasterzeile braucht ihre eigene lesbare Kompetenzformulierung.');
    c.text=c.text.trim(); // Bewertungswortlaut NIE durch Curriculumtext ersetzen.
    const linked=String(c.curriculumCompetencyId||'').trim();
    if(linked){
      const original=pool.get(linked);
      if(!original)throw Error('Die Curriculum-ID '+linked+' ist für diesen Fachkurs nicht belegbar. Bitte offen lassen und im Raster erläutern, statt eine fremde ID einzusetzen.');
      c.curriculumCompetencyId=linked;
      c.curriculumTextV209=original.text;
      c.curriculumTopicV209=original.topicTitle||original.topicId||'Methodencurriculum';
      c.linkageStatusV209='linked';
      if(!String(c.linkageNoteV209||'').trim())
        c.linkageNoteV209='Konkretisierung einer übergeordneten Hauscurriculum-Kompetenz.';
    }else{
      c.curriculumCompetencyId='';
      c.curriculumTextV209='';
      c.curriculumTopicV209='';
      c.linkageStatusV209='unmapped';
      if(!String(c.linkageNoteV209||'').trim())
        throw Error('Für die Rasterzeile „'+c.text+'“ fehlt eine Begründung, warum noch keine eindeutige Curriculum-ID feststeht.');
    }
    const itemRows=itemsByComp.get(c.id)||[];
    if(!itemRows.some(it=>Number(it.regularMax)>0))
      throw Error('Die Rasterzeile „'+c.text+'“ hat keine regulär bewertete Aufgabe. Bitte Punktezuordnung prüfen.');
  }
  return parsed;
}

const v209PreviousPrompt=v200AssessmentAnalysisPrompt;
v200AssessmentAnalysisPrompt=function(a,priv){
  if(!a||!v205AutoExamAvailable(a))return v209PreviousPrompt(a,priv);
  const c=cls(a.classId),grade=v202Grade(c),subject=v202SubjectKey(c),
    originalSource=v202Source(subject),pool=v204AllCourseCurriculum(c);
  const limits=originalSource?.thresholds5to7;
  const selected=v204AssessmentSelection(a,false)?.selectedIds||[];
  const files=(a.files||[]).map(f=>f.name);
  let prompt='# Schulcockpit – Kompetenzraster einer geschriebenen Klassenarbeit auswerten\n\n';
  prompt+='## Prüfung und Datenschutz\n';
  prompt+='Fachkurs: '+(c?.subject||'')+' '+(c?.name||'')+'; Klassenarbeit: '+(a.title||a.type||'Leistungsnachweis')
    +'; Datum: '+(a.date||'unbekannt')+'; Schwerpunkt: '+(a.scope||'nicht angegeben')+'.\n';
  prompt+='Prüfungsdateien im beigefügten Paket: '+(files.join(', ')||'KEINE')+'.\n';
  prompt+='Nutze ausschließlich Original-Prüfungsaufgaben und ein gegebenenfalls von der Lehrkraft mitgegebenes Kompetenzraster. Keine Schülernamen, persönlichen Antworten, individuellen Punktzahlen oder personenbezogenen Daten anfordern oder ausgeben; diese bleiben im lokalen Schulcockpit.\n';
  prompt+='Wenn Originalaufgaben oder Punktverteilung fehlen, stelle Rückfragen und erzeuge NOCH KEINEN Importblock.\n';
  prompt+='## Drei Ebenen strikt trennen\n';
  prompt+='1. Hauscurriculum: unveränderte Original-Kompetenz und ID. Eine Originalkompetenz darf mehrere Teilfähigkeiten umfassen.\n';
  prompt+='2. Unterrichtsreihe: tatsächlich unterrichtete Teilfähigkeiten, keine Aussagen über noch nicht unterrichtete Bereiche.\n';
  prompt+='3. Rückgaberaster: je Zeile eine eigenständige, konkret geprüfte Fähigkeit mit eigener Bewertungs-ID. ZWEI Rasterzeilen DÜRFEN dieselbe curriculumCompetencyId erhalten, etwa schriftliche Addition und schriftliche Subtraktion. Bewertet und ausgedruckt wird pro Rasterzeile, NICHT durch Zusammenfassen der übergeordneten ID.\n';
  prompt+='## Vorgegebenes Kolleg*innen-Kompetenzraster\n';
  prompt+='Wenn unter den beigefügten Dateien ein echtes Kompetenzraster liegt: Bewahre dessen Reihenfolge und Formulierungen für jede Zeile exakt. Bewahre ausdrücklich die in der Vorlage genannten Aufgabenverweise (z. B. „A 1–3“) und die getrennte Bewertung. Nutze rubricV209.origin="provided-rubric" und dessen wirklichen Dateinamen in sourceFile.\n';
  prompt+='Wenn KEIN Originalraster vorliegt, leite eine möglichst knappe, kindgerechte „Du kannst …“-Formulierung aus den tatsächlich geprüften Aufgaben ab, rubricV209.origin="task-derived", sourceFile="", derivationNote begründet dies. Behaupte nicht, dass solche Formulierungen vom Kollegen stammen. Frage bei unklaren Aufgaben nach.\n';
  prompt+='Ein Kompetenzraster ist NICHT zwingend mit dem curricularen Wortlaut identisch. Den curricularen Wortlaut NICHT in das Feld text kopieren, wenn der Rückgabetext konkreter ist.\n';
  prompt+='Für jede Rasterzeile eine geeignete originale curriculumCompetencyId aus der Liste unten angeben, falls wirklich belegbar. Mehrere Rasterzeilen dürfen dieselbe ID tragen. Wenn keine genaue Zuordnung begründbar ist, setze curriculumCompetencyId="" und erkläre die offene Zuordnung in linkageNoteV209. Niemals ein neues Schulcurriculum-Ziel erfinden.\n';
  prompt+='Bei fachlichen Basisbegriffen keine E-Niveau-Kompetenz als Pflichtziel zuordnen, wenn der Bezug nicht sicher belegt ist.\n';
  prompt+='Die Zeilen nur anhand der tatsächlich bewerteten Teilaufgaben und echten Maximalpunkte erstellen; Ergänzungs-/Bonusaufgaben separat, nicht in den regulären Nenner. Die Raster-Punktesummen müssen mit den Originalaufgaben übereinstimmen. Pro Teilaufgabe eine primäre Rasterzeile; bei getrennt bewerteten Teilfähigkeiten entsprechend teilen.\n';
  if(selected.length)prompt+='Bereits im Schulcockpit ausgewählte übergeordnete Curriculum-IDs (nur fachliche Orientierung, NICHT die Rasterzeilen): '+selected.join(', ')+'.\n';
  prompt+='\n## Erlaubte Curriculum-IDs (Originaltexte; nur als Hintergrundbezug)\n';
  prompt+=pool.map(x=>'- '+x.id+' | '+(x.topicTitle||'Methodencurriculum')+' | '+(x.category||'Methode')+': '+x.text).join('\n')+'\n';
  prompt+='\n## Verbindliche Bewertungsgrenzen\n';
  if(grade>=5&&grade<=7&&limits){
    prompt+='Hauscurriculum '+originalSource.title+': erreicht ab '+limits.reachedMinPct+' %, teilweise erreicht ab '+limits.partialMinPct+' %. Verwende diese exakten Werte.\n';
  }else prompt+='Nur aus einer belegten Bewertungsquelle übernehmen; fehlen Grenzen, zunächst rückfragen.\n';
  if(subject==='mathematik')prompt+='Das Mathematik-Hauscurriculum verlangt für NEU konzipierte schriftliche Lernkontrollen mindestens 10 reguläre Maximalpunkte je geprüfter Kompetenz. Bei dieser bereits geschriebenen Arbeit die tatsächlichen Punkte NICHT verändern oder auffüllen. Abweichungen nur als Hinweis benennen.\n';
  prompt+='\n## Anonymisierte Classtime-Struktur\n'+v200AnonymizedClasstimeStructure(priv?.classtime)+'\n';
  prompt+='\n## Ausgabeformat nach vollständiger Prüfung der Quellen\n';
  prompt+='Bei fehlenden Angaben nur „RÜCKFRAGEN“ mit den konkret notwendigen Punkten. Sonst exakt EINEN Block mit dem unveränderten Schema und dem zusätzlichen rubricV209-Abschnitt:\n';
  prompt+='<SCHULCOCKPIT_ASSESSMENT_IMPORT>\n'+JSON.stringify({
    schema:'schulcockpit.assessment-analysis.v1',
    rubricV209:{schema:1,origin:'provided-rubric',sourceFile:'EXAKTER_DATEINAME_AUS_DEM_PAKET',criterionOrder:['K1','K2']},
    thresholds:{reachedMinPct:grade<=7&&limits?limits.reachedMinPct:0,partialMinPct:grade<=7&&limits?limits.partialMinPct:0,source:'Schulcurriculum + exakte Fundstelle'},
    competencies:[
      {id:'K1',text:'Du kannst … (A 1–3).',topic:'Prüfungsthema',source:'Raster-Datei/Abschnitt',
        curriculumCompetencyId:'PASSENDE_ID_ODER_LEER',linkageNoteV209:'Begründung der curricularen Verbindung'},
      {id:'K2',text:'Du kannst … (A 4).',topic:'Prüfungsthema',source:'Raster-Datei/Abschnitt',
        curriculumCompetencyId:'',linkageNoteV209:'Keine eindeutige Kompetenz im hinterlegten Jahrgangstableau'}
    ],
    items:[{id:'A1',label:'Aufgabe 1',source:'classtime',regularMax:0,bonusMax:0,
      competencyId:'K1',classtimeAliases:['nur echte Spaltenüberschriften']}],
    curriculum:{sourceTitle:originalSource?.title||'Schulcurriculum',topics:[]},
    notes:'Unklarheiten, Ausnahmen und Quellenlage'
  },null,2)+'\n</SCHULCOCKPIT_ASSESSMENT_IMPORT>\n';
  prompt+='Das JSON oben ist ausschließlich eine STRUKTURVORLAGE: Ersetze ALLE Beispieltexte, Beispielzahlen, IDs und Aufgaben durch die tatsächlich aus den Originaldateien nachweisbaren Werte. Bei task-derived: rubricV209.origin="task-derived", sourceFile="", derivationNote="konkrete Herleitung aus Aufgaben" setzen, criterionOrder korrekt ausgeben. Jede Rasterzeile muss mindestens eine regulär bewertete Aufgabe haben.\n';
  v200AssertNoStudentLeak(prompt,priv);
  return prompt;
};

const v209LegacyExtract=v200ExtractAnalysis;
v200ExtractAnalysis=function(text){
  const obj=v209ExtractRubricInput(text);
  if(!obj)return v209LegacyExtract(text); // ältere Prüfungsimporte unverändert behandeln
  return v209CheckRubric(obj,v200Assessment(v200Eval?.assessmentId));
};

const v209LegacyImport=v200ImportAnalysis;
v200ImportAnalysis=async function(text){
  const source=v209ExtractRubricInput(text);
  if(!source)return v209LegacyImport(text);
  const a=v200Assessment(v200Eval?.assessmentId),obj=v209CheckRubric(source,a);
  const prevAnalysis=a?.evaluationV200,prevSelection=a?.competencySelectionV204;
  // Gleiche Aufgaben-IDs sind für vorhandene lokale Punkte wichtig.
  const privateData=v200Eval?.privateData;
  const existingScored=Object.values(privateData?.scores||{}).some(x=>Object.values(x||{}).some(v=>v!==null&&v!==''&&v!==undefined))
    ||Object.values(privateData?.paperScores||{}).some(x=>Object.values(x||{}).some(v=>v!==null&&v!==''&&v!==undefined))
    ||Object.values(privateData?.bonusScores||{}).some(x=>Object.values(x||{}).some(v=>v!==null&&v!==''&&v!==undefined));
  if(existingScored&&prevAnalysis?.analysis){
    const oldIds=(prevAnalysis.analysis.items||[]).map(x=>x.id).join('|'),
          newIds=(obj.items||[]).map(x=>x.id).join('|');
    if(oldIds!==newIds)throw Error('Es sind bereits lokale Schülerpunkte vorhanden und die Aufgaben-IDs wurden verändert. Bitte zuerst das sensible lokale Auswertungsbackup sichern und die Aufgaben-Zuordnung manuell klären; kein automatisches Überschreiben.');
  }
  const ids=[...new Set(obj.competencies.map(x=>x.curriculumCompetencyId).filter(Boolean))];
  a.evaluationV200={schema:1,analysis:obj,updatedAt:new Date().toISOString()};
  a.competencySelectionV204={
    schema:1,selectedIds:ids,confirmed:true,
    sourceV205:'ai-proposal',sourceV209:'rubric-criteria',
    teacherReviewedV205:false,updatedAt:new Date().toISOString()
  };
  try{await saveState();}
  catch(e){
    if(prevAnalysis)a.evaluationV200=prevAnalysis;else delete a.evaluationV200;
    if(prevSelection)a.competencySelectionV204=prevSelection;else delete a.competencySelectionV204;
    throw e;
  }
  v200Eval.rawImport='';
  render();
};

// Rückgabe- und Vorschau bleiben pro Rasterzeile. Bei nicht zugeordneten
// Zeilen wird KEINE vermeintlich offizielle Curriculum-ID hinzugefügt.
function v209RubricPreview(a){
  const an=v209RubricAnalysis(a);
  if(!an)return '';
  const sums=new Map();
  for(const it of an.items){
    if(!sums.has(it.competencyId))sums.set(it.competencyId,{max:0,items:[]});
    const s=sums.get(it.competencyId);
    s.max+=Number(it.regularMax)||0;
    s.items.push(it.label||it.id);
  }
  const rows=an.competencies.map(c=>{
    const sum=sums.get(c.id)||{max:0,items:[]};
    const link=c.curriculumCompetencyId
      ?'Hauscurriculum: '+c.curriculumCompetencyId+' – '+c.curriculumTextV209
      :'Noch keine eindeutige Curriculum-ID. '+c.linkageNoteV209;
    return '<tr><td><strong>'+esc(c.text)+'</strong><small>'+esc(link)+'</small></td>'
      +'<td>'+esc(sum.items.join(', '))+'</td><td class="num">'+esc(sum.max)+'</td></tr>';
  }).join('');
  return '<section class="detail-section v209-rubric-review"><div class="section-head compact"><div>'
    +'<span class="eyebrow">TATSÄCHLICHES PRÜFUNGSRASTER</span><h3>Rückgabezeilen und Punkte kontrollieren</h3></div></div>'
    +'<p>Die Formulierungen links werden pro Zeile im PDF ausgedruckt. Die darunter stehenden Curriculum-IDs dienen nur der späteren Nachverfolgung. Auch dieselbe ID darf mehrfach vorkommen.</p>'
    +'<div class="v209-table-wrap"><table class="v209-table"><thead><tr><th>Bewertete Teilfähigkeit</th><th>Aufgabe</th><th>Max. Punkte</th></tr></thead>'
    +'<tbody>'+rows+'</tbody></table></div>'
    +'<p class="microcopy">Rasterquelle: '+esc(an.rubricV209.origin==='provided-rubric'?'Originalvorlage „'+an.rubricV209.sourceFile+'“':'Aus den tatsächlichen Aufgaben vorgeschlagen, nicht aus einer Kolleg*innenvorlage übernommen')
    +'. Prüfe vor der Freigabe die exakte Zeilenreihenfolge, alle Aufgabe-Punkte-Verbindungen und offene curriculare Bezüge.</p>'
    +'<div class="v200-actions"><button class="secondary" data-v200-step="2">← Analyse bei Unklarheiten korrigieren</button></div></section>';
}
const v209PreviousStep3=v200Step3;
v200Step3=function(a,priv){
  let html=v209PreviousStep3(a,priv);
  const review=v209RubricPreview(a);
  if(!review)return html;
  const pos=html.indexOf('<section class="detail-section v205-review">');
  return pos>=0?html.slice(0,pos)+review+html.slice(pos):review+html;
};

// Die bisherige Zusammenfassung zeigt nur offizielle Curriculumtexte;
// bei Prüfungsrastern müssen hingegen immer die tatsächlichen Kriterien
// (auch ohne Curriculum-ID) angezeigt werden.
const v209SummaryBefore=v204ExamSelectionSummary;
v204ExamSelectionSummary=function(a){
  const an=v209RubricAnalysis(a);
  if(!an)return v209SummaryBefore(a);
  return '<div class="v204-selected-exam-comps">'+an.competencies.map(c=>
    '<div><strong>'+esc(c.text)+'</strong><small>'+esc(c.curriculumCompetencyId?
      'Hintergrund: '+c.curriculumCompetencyId:'Curriculumbezug noch offen')+'</small></div>').join('')+'</div>';
};

// Ungeprüfte KI-Vorschläge dürfen die Nachweisübersicht niemals füllen;
// erst Lehrkraftfreigabe zählt. Bestehende V0.20.5-Schutzregel bleibt aktiv.
const v209RenderBefore=render;
render=function(){
  v209RenderBefore();
  const el=document.querySelector('.brand small');
  if(el)el.textContent=state.settings.schoolYear+' · '+V209_VERSION;
};
render();
