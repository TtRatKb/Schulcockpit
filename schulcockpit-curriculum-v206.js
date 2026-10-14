/* Schulcockpit V0.20.6 – Fachkonferenz 2026/27: belegte Themenanpassungen.
   Quellen: eingebettetes Schulcurriculum (Mathe/Religion, altes Jahrgangstableau)
   sowie Übergabekonferenz 2026/27, Folien 5/10/11/12.
   Konferenz setzt Themen/Leistungsnachweise, aber KEINE neuen Kompetenzformulierungen.
   Deshalb keine erfundenen Curriculumeinträge oder stillen Jahrgangsverschiebungen. */
const V206_VERSION='V0.20.6';
const V206_EXAM_NOTES={
 'religion-5':'1. HJ: Ersatzleistung (Thema offen); 2. HJ: Klassenarbeit (Thema offen). Neues KC noch in Arbeit.',
 'religion-6':'1. HJ: Judentum (KW 40); 2. HJ: Ersatzleistung Feste und Feiertage.',
 'religion-7':'1. HJ: Klassenarbeit Reformation (KW 46); 2. HJ: Kreativleistung Diakonie.',
 'religion-8':'1. HJ: Klassenarbeit Islam (KW 41); 2. HJ: Ersatzleistung Jesus und seine Botschaft (noch fraglich).',
 'religion-9':'1. HJ: Ersatzleistung „Trauerglas“; 2. HJ: Klassenarbeit Tod und Auferstehung Jesu.',
 'religion-10':'1. HJ: Klassenarbeit Kirche und Nationalsozialismus (KW 47); 2. HJ: Klassenarbeit religiöse Gruppierungen.'
};
const V206_MATH_FIRST=['k01','k02','k04','k05','k07','k08','k14'];
const V206_MATH_SECOND=['k01','k02','k03','k04','k05','k07','k08','k13','k14'];
const V206_JEWISH=['k01','k02','k04','k05','k06','k07','k09'];
const V206_ABRAHAM=['k03','k08','k10'];
const V206_EVKATH=['religion-5-8-k02','religion-5-8-k03','religion-5-8-k06','religion-5-8-k09','religion-5-8-k13'];
const v206Norm=s=>v202Norm(String(s||''));
const v206Suffixes=(base,suffixes)=>suffixes.map(x=>base+'-'+x);
function v206Kind(q){
  const c=cls(q?.classId);if(!c)return 'missing-course';
  const subj=v202SubjectKey(c),grade=v202Grade(c);
  if(v206Norm(c.subject).includes('method')&& !subj)return 'independent-methods';
  if(subj==='religion'&&grade===5&&v206Norm(c.name)==='5')return 'religion5-pending';
  if(subj==='religion'&&grade>10)return 'upper-grade-source-missing';
  return '';
}
function v206Profile(q){
  const c=cls(q?.classId),sub=v202SubjectKey(c),g=v202Grade(c),n=v206Norm(q?.title);
  const p={topicId:'',confidence:false,label:'',sourceNote:'',allowIds:null,extraIds:[],partial:false,version:'conference-2026-27'};
  if(!c||v206Kind(q))return p;
  if(sub==='mathematik'&&g===5){
    if((n.includes('grundrechenarten')&&/(\*|geteilt|multiplik|divid|mal und|mal geteilt)/i.test(q.title))||n.includes('grundrechenarten ii')){
      return {...p,topicId:'mathe-5-15-all',confidence:true,label:'Grundrechenarten II (Multiplikation / Division)',
        allowIds:v206Suffixes('mathe-5-15-all',V206_MATH_SECOND),
        sourceNote:'Die Schule plant Teil II getrennt. Das ältere Mathematik-Curriculum führt I und II gemeinsam (S. 15). Die Kompetenzteilmenge ist eine fachliche Planungs-Vorauswahl, keine neue offizielle Curriculumliste.'};
    }
    if(n.includes('grundrechenarten')&&(n.includes('naturliche zahlen')||n.includes('plus')||n.includes('addition')||n.includes('subtraktion'))){
      return {...p,topicId:'mathe-5-15-all',confidence:true,label:'Grundrechenarten I (Addition / Subtraktion)',
        allowIds:v206Suffixes('mathe-5-15-all',V206_MATH_FIRST),
        sourceNote:'Teil I und II stehen im alten Schulcurriculum gemeinsam auf S. 15. Nur eine fachliche Planungs-Vorauswahl; die offiziellen Kompetenz-IDs bleiben erhalten.'};
    }
    if(n.includes('unsere klasse')&&n.includes('rund')){
      return {...p,topicId:'mathe-5-13-all',confidence:true,label:'Unsere Klasse + Rundung',
        extraIds:['mathe-5-15-all-k06'],
        sourceNote:'Statistik stammt aus „Unsere Klasse“ (S. 13); das Runden aus dem älteren Kompetenzblock „Grundrechenarten I + II“ (S. 15).'};
    }
  }
  if(sub==='religion'&&g===6){
    if(n.includes('evangelisch')&&n.includes('katholisch'))return {...p,topicId:'religion-5-8',confidence:false,partial:true,
      label:'Evangelische und katholische Christen – Teilbezug aus altem Jg. 5',
      allowIds:V206_EVKATH,sourceNote:'Jg. 6 laut Übergabekonferenz (2. HJ); im älteren Curriculum kein vollständiges eigenes Jg.-6-Tableau. Diese ausgewählten Jg.-5-Kompetenzen sind nur Teilbezüge; restliche Kompetenzgrundlage muss noch fachlich bestätigt werden.'};
    if(n.includes('feste')&&n.includes('feiertage'))return {...p,topicId:'religion-5-9',confidence:true,
      label:'Feste und Feiertage – 2026/27 nach Jg. 6 verlagert',
      sourceNote:'Laut Übergabekonferenz im 2. HJ des Jahrgangs 6. Die unveränderten Kompetenzformulierungen stammen jedoch aus dem alten Jg.-5-Tableau (S. 9).'};
    if(n.includes('abraham')&&!n.includes('judentum'))return {...p,topicId:'religion-6-15',confidence:true,
      label:'Abraham / gemeinsame Wurzeln (Teil des alten Judentum-Tableaus)',
      allowIds:v206Suffixes('religion-6-15',V206_ABRAHAM),
      sourceNote:'Fachliche Unterteilung des gemeinsamen offiziellen Kompetenzblocks (S. 15); kein zweites eigenständiges Quelltableau.'};
    if(n.includes('judentum')&&!n.includes('abraham'))return {...p,topicId:'religion-6-15',confidence:true,
      label:'Judentum – Alltag, Feste und Geschichte (Teilblock)',
      allowIds:v206Suffixes('religion-6-15',V206_JEWISH),
      sourceNote:'Fachliche Unterteilung des gemeinsamen offiziellen Kompetenzblocks (S. 15); kein zweites eigenständiges Quelltableau.'};
  }
  if(sub==='religion'&&g===5&&v206Norm(c.name)==='5f'){
    if(n.includes('bibel'))return {...p,topicId:'religion-6-13',confidence:false,partial:true,
      label:'Bibel – älteres Jg.-6-Tableau als vorläufige Quelle',
      sourceNote:'Für Religion 5f noch kein passendes bestätigtes neues Jg.-5-Tableau verfügbar. Der alte Bibel-Kompetenzblock ist unter Jg. 6 (S. 13) hinterlegt. Nur nach bewusster Prüfung verwenden.'};
  }
  if(sub==='religion'&&g===9&&n.includes('auferstehung')&&n.includes('jesu')){
    return {...p,topicId:'religion-10-33',confidence:true,label:'Tod und Auferstehung Jesu – 2026/27 nach Jg. 9',
      sourceNote:'Übergabekonferenz: Klassenarbeit in Jg. 9, 2. HJ. Die vorhandenen Kompetenzformulierungen stammen aus einem älteren Jg.-10-Tableau (S. 33).'};
  }
  if(sub==='religion'&&g===7&&n.includes('diakonie')&&n.includes('freundschaft')){
    return {...p,topicId:'religion-7-19',confidence:false,partial:true,
      label:'Freundschaft, Liebe und Sexualität – Diakonie fehlt',
      sourceNote:'Der ältere Kompetenzblock belegt Freundschaft/Liebe, NICHT Diakonie. Die Übergabekonferenz nennt für Diakonie eine Kreativleistung im 2. Halbjahr. Für diese sind noch eigene Kompetenzformulierungen zu klären.'};
  }
  return p;
}
function v206Resolution(q){
  const status=v206Kind(q),p=v206Profile(q),linked=v202LinkedTopic(q),c=cls(q?.classId);
  if(status)return {q,c,status,p,linked,topic:null,confidence:false};
  const base=v205MatchTopic(q);const specific=p.topicId?v202Topic(p.topicId):null;
  return {q,c,status:'',p,linked,topic:specific||base.topic,
    confidence:!!specific?p.confidence:base.confident,
    sourceNote:p.sourceNote||'',topicId:specific?.id||base.topic?.id||''};
}
function v206CourseExamNote(c){
  if(v202SubjectKey(c)!=='religion')return '';
  return V206_EXAM_NOTES['religion-'+v202Grade(c)]||'';
}
function v206RowOptions(r){
  if(r.status)return '';
  const subject=v202SubjectKey(r.c),grade=v202Grade(r.c);
  let topics=r.p.topicId?[v202Topic(r.p.topicId)].filter(Boolean):v202Topics(subject,grade);
  const selected=r.linked?.id||r.confidence&&r.topic?.id||'';
  if(r.linked&&!topics.some(t=>t.id===r.linked.id))topics=[r.linked,...topics];
  const extra=r.p.topicId&&!r.confidence?' (Vorschlag – Quelljahrgang prüfen)':'';
  return '<select data-v206-topic="'+esc(r.q.id)+'"><option value="">— keine verlässliche Zuordnung —</option>'
    +topics.map(t=>'<option value="'+esc(t.id)+'" '+(selected===t.id?'selected':'')+'>'
       +esc((t.id===r.p.topicId&&r.p.label?r.p.label:t.title)+(t.id===r.p.topicId?extra:''))+'</option>').join('')
    +'</select>';
}
function v205WizardHtml(){
  const year=modal?.year||v190PlanningYear(),today=v205DateToday();
  const items=v205RelevantRows(year).map(({q})=>v206Resolution(q));
  let confident=0,open=0,held=0;
  const body=items.map(r=>{
    const {q,c,status,p,linked,confidence,topic}=r;
    let reason='',pill='';
    if(status==='independent-methods'){reason='Eigenständiger Methodenunterricht; kein Mathematik-/Religionscurriculum zuordnen.';held++;}
    else if(status==='religion5-pending'){reason='Religion 5 pausiert: neues KC Christlicher Religionsunterricht laut Fachkonferenz noch in Arbeit (SchILF 28.10.2026).';held++;}
    else if(status==='upper-grade-source-missing'){reason='Für Religion 11 ist im Schulcockpit noch keine Oberstufen-Kompetenzquelle hinterlegt.';held++;}
    else if(!topic){reason='Keine sichere fach-/jahrgangsbezogene Kompetenzquelle gefunden.';open++;}
    else if(!linked&&confidence){reason='Eindeutiger Planungs-Vorschlag · '+topic.title;confident++;}
    else if(linked){reason='Bereits verknüpft · '+linked.title+(p.topicId===linked.id&&!q.curriculumV202?.appliedConferenceV206?' · Fachkonferenz-Ergänzung vorbereitet':'');}
    else {reason='Quelle bitte einmal bestätigen · '+topic.title;open++;}
    const isPartial=!!p.partial;
    const note=[p.sourceNote,isPartial?'Noch keine vollständige Kompetenzgrundlage für alle Bestandteile dieses Themas.':''].filter(Boolean).join(' ');
    const exam=v206CourseExamNote(c);
    return '<div class="v205-row v206-row"><div><strong>'+esc((c?.subject||'Fach')+' '+(c?.name||'')+' · '+q.title)+'</strong>'
      +'<small>'+esc(reason)+'</small>'
      +(note?'<small class="v206-provenance">'+esc(note)+'</small>':'')
      +(exam?'<small class="v206-conference">'+esc(exam)+'</small>':'')
      +'</div><div>'+(status?'<span class="v206-muted">Keine automatische Zuordnung</span>':v206RowOptions(r))+'</div>'
      +(status?'<span></span>':'<button class="secondary small" data-v205-plan="'+esc(q.id)+'">Reihe planen</button>')
      +'</div>';
  }).join('');
  const outcome=Number.isInteger(modal?.applied)
    ?'<div class="v205-result"><strong>'+modal.applied+' Zuordnungen gespeichert.</strong> Die Stundenpläne, bisherigen Stunden, Prüfungen und Dateien sind unverändert geblieben.</div>':'';
  return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-xwide v205-modal" data-modal-stop>'
    +'<header class="modal-header"><div><span class="eyebrow">SCHULJAHR '+esc(year)+' · V0.20.6</span>'
    +'<h2>Kompetenzplanung an die Fachkonferenz anpassen</h2></div><button class="icon-button" data-action="modal-close">×</button></header>'
    +'<div class="modal-body"><p>Berücksichtigt sind die Themenzuordnungen aus der Übergabekonferenz 2026/27. Die Original-Kompetenz-IDs bleiben erhalten. Verschobene Jahrgänge und nur teilweise belegte Themen werden ausdrücklich gekennzeichnet.</p>'
    +'<div class="v205-stats"><span><strong>'+confident+'</strong> vorbereitet</span><span><strong>'+open+'</strong> fachlich offen</span><span><strong>'+held+'</strong> ausgenommen</span></div>'
    +outcome+'<p class="microcopy">Keine rückwirkende Korrektur: Frühere Stunden, feste Arbeiten und Materialdateien werden nicht geändert. Eine Themenzuordnung bedeutet ausdrücklich nicht, dass eine Kompetenz schon erreicht wurde. Bei Grundrechenarten ist die Teilung eine Planungszuordnung zum gemeinsamen alten Kompetenzblock.</p>'
    +'<div class="v205-list">'+(body||'<p>Keine aktiven Reihen für dieses Jahr vorhanden.</p>')+'</div>'
    +'<div class="v200-actions"><button class="secondary" data-action="modal-close">Schließen</button><button class="primary" data-v205-apply>Passende Zuordnungen übernehmen</button></div></div></section></div>';
}
async function v205Apply(){
  if(modal?.type!=='v205Wizard')return;
  const year=modal.year,updates=[];
  for(const {q} of v205RelevantRows(year)){
    const r=v206Resolution(q);if(r.status)continue;
    const value=document.querySelector('[data-v206-topic="'+q.id+'"]')?.value||'';
    if(!value)continue;
    const sameTopic=value===r.linked?.id;
    const wantsConferenceUpdate=sameTopic&&r.p.topicId===value;
    if(sameTopic&&(!wantsConferenceUpdate||(
      q.curriculumV202?.appliedConferenceV206
      &&(!r.p.allowIds||r.p.allowIds.every(id=>(q.curriculumV202.competencyAllowlistV206||[]).includes(id)))
      &&JSON.stringify(q.curriculumV202.extraCompetencyIdsV206||[])===JSON.stringify(r.p.extraIds||[])
      &&(q.curriculumV202.sourceNoteV206||'')===(r.p.sourceNote||'')
    )))continue;
    const t=v202Topic(value),s=v202SubjectKey(r.c),grade=v202Grade(r.c);
    if(!t||t.subject!==s)throw Error('Unpassende Fachzuordnung bei '+q.title);
    const crossGrade=!(t.grades||[]).includes(grade);
    if(crossGrade&&value!==r.p.topicId)throw Error('Jahrgangswechsel ohne belegte Fachkonferenz-Zuordnung bei '+q.title);
    if(r.linked&&!sameTopic&&(q.plan||[]).some(u=>(u.competencyIdsV202||[]).length))
      throw Error('Für die Reihe „'+q.title+'“ sind bereits einzelne Stunden mit Kompetenzen verknüpft. Bitte diese Zuordnung vor einem Themenwechsel separat prüfen.');
    const prof=(r.p.topicId===value)?r.p:null;
    const old=q.curriculumV202?structuredClone(q.curriculumV202):null;
    const existingIds=new Set((q.plan||[]).flatMap(u=>u.competencyIdsV202||[]));
    const allow=prof?.allowIds&&sameTopic&&existingIds.size
      ?[...new Set([...prof.allowIds,...existingIds])]:prof?.allowIds||null;
    updates.push({q,old,value,t,grade,subject:s,crossGrade,prof,allow,sameTopic});
  }
  if(!updates.length){alert('Keine neuen Zuordnungen übernommen. Offene Quellen bleiben unverändert.');return;}
  for(const u of updates){
    const old=u.old;
    u.q.curriculumV202={schema:1,topicId:u.t.id,subjectKey:u.subject,grade:u.grade,confirmed:true,
      crossGradeConfirmed:u.crossGrade,
      methodIds:u.sameTopic&&Array.isArray(old?.methodIds)?old.methodIds:v202DefaultMethodIds(u.q,u.t),
      manualDoneIds:old?.manualDoneIds||[],evidenceIds:old?.evidenceIds||[],
      appliedConferenceV206:!!u.prof,sourcePagesV206:u.t.sourcePages||[],
      sourceGradesV206:u.t.grades||[],sourceNoteV206:u.prof?.sourceNote||'',
      competencyAllowlistV206:u.allow||null,
      extraCompetencyIdsV206:u.prof?.extraIds||[],
      incompleteCoverageV206:!!u.prof?.partial,linkedAt:new Date().toISOString()};
  }
  try{await saveState();}
  catch(e){for(const u of updates){if(u.old)u.q.curriculumV202=u.old;else delete u.q.curriculumV202;}throw e;}
  modal={type:'v205Wizard',year,applied:updates.length};render();
}

// Reihen-Stundenprompts nutzen die zu dieser Unterrichtsreihe passenden Kompetenz-IDs,
// nicht unbesehen sämtliche Inhalte des gemeinsamen Alt-Curriculum-Themas.
const v206SequenceCompsBefore=v202SequenceCompetencies;
v202SequenceCompetencies=function(q,topicOverrideId='',methodIdsOverride=null){
  const base=v206SequenceCompsBefore(q,topicOverrideId,methodIdsOverride);
  const cfg=q?.curriculumV202;
  if(!cfg?.confirmed||topicOverrideId&&cfg.topicId!==topicOverrideId)return base;
  const allow=Array.isArray(cfg.competencyAllowlistV206)?new Set(cfg.competencyAllowlistV206):null;
  const filtered=allow?base.filter(c=>c.sourceType==='method'||allow.has(c.id)):base.slice();
  for(const id of cfg.extraCompetencyIdsV206||[]){
    if(filtered.some(c=>c.id===id))continue;
    const c=v204CurriculumComp(id);
    if(c)filtered.push({...c,sourceType:'curriculum',sourceTopicId:c.topicId,
      complementarySourceV206:true});
  }
  return filtered;
};
const v206CurriculumPromptBefore=v202PromptCompetencyBlock;
v202PromptCompetencyBlock=function(topic,q){
  if(!topic)return v206CurriculumPromptBefore(topic,q);
  // Ohne Spezialregeln alte Verhaltensweise unverändert übernehmen.
  if(!q?.curriculumV202?.appliedConferenceV206)return v206CurriculumPromptBefore(topic,q);
  const cfg=q.curriculumV202,methods=v202EffectiveMethodIds(q,topic),comps=v202SequenceCompetencies(q,topic.id,methods);
  const c=cls(q.classId),source=v202Source(topic.subject),grade=v202Grade(c),
    limit=grade>=5&&grade<=7?source?.thresholds5to7:null;
  return '## VERBINDLICHER KOMPETENZBEZUG / ÜBERGANG 2026/27\n'
    +'Kurs: '+(c?.subject||'')+' '+(c?.name||'')+'; Originalquelle: '+(source?.title||'')+'; Originaltableau: '+topic.title
    +'; Original-Jahrgang: '+(topic.grades||[]).join(', ')+'; Quellen-Seiten: '+(topic.sourcePages||[]).join(', ')+'.\n'
    +(cfg.sourceNoteV206||'')+'\n'
    +(cfg.incompleteCoverageV206?'ACHTUNG: Diese Quellen belegen die Unterrichtsreihe nur teilweise. Keine weiteren curricularen Kompetenzen erfinden; mache fehlende offizielle Kompetenzen kenntlich.\n':'')
    +(limit?'Kompetenz-Bewertungsgrenzen laut Originalfachcurriculum: erreicht ab '+limit.reachedMinPct+' %, teilweise erreicht ab '+limit.partialMinPct+' %.\n':'')
    +comps.map(x=>'- '+x.id+' | '+(x.sourceType==='method'?'Methode':x.category||'Kompetenz')
      +(x.complementarySourceV206?' | zweites Curriculumthema':'')+': '+x.text
      +'\n  Lernziel: '+v205GoalText(x)).join('\n')
    +'\nDie Original-IDs sind verbindlich. Plane die Stunde kompetenzorientiert; im Methodenanteil tatsächliche Lernhandlungen. Die geplante oder gehaltene Stunde allein beweist noch keinen individuellen Kompetenzerwerb. Nutze keine anderen Jahrgangskompetenzen ohne explizite Quelle.\n';
};
// Bei Reimport derselben Reihe dürfen bestätigte Konferenz-Anpassungen nicht durch
// die ältere v202SetTopic-Migration still verloren gehen.
const v206SetTopicBefore=v202SetTopic;
v202SetTopic=function(q,topicId,methodIds){
  const cfg=q?.curriculumV202,retained=cfg?.confirmed&&cfg.topicId===topicId&&cfg.appliedConferenceV206
    ?{...cfg,methodIds:cfg.methodIds?.slice()||[],
      manualDoneIds:cfg.manualDoneIds?.slice()||[],evidenceIds:cfg.evidenceIds?.slice()||[]}:null;
  if(retained){
    // Eine bereits bestätigte Konferenz-Verknüpfung bleibt beim ChatGPT-Reimport
    // unverändert. Insbesondere kein erneuter Cross-Grade-Dialog und kein
    // Löschen existierender Kompetenzzuordnungen einzelner Soll-Stunden.
    if(Array.isArray(methodIds))q.curriculumV202.methodIds=[...methodIds];
    return;
  }
  v206SetTopicBefore(q,topicId,methodIds);

};
// Deutliche Herkunftsmarkierung in der Reihenansicht.
const v206CurriculumSectionBefore=v202CurriculumSection;
v202CurriculumSection=function(q){
  let h=v206CurriculumSectionBefore(q);
  const cfg=q?.curriculumV202;if(!cfg?.appliedConferenceV206)return h;
  const note='<p class="v206-provenance"><strong>Fachkonferenz-Abgleich 2026/27:</strong> '+esc(cfg.sourceNoteV206||'Herkunftstabelle im alten Schulcurriculum geprüft.')
    +(cfg.incompleteCoverageV206?' <strong>Kompetenzgrundlage unvollständig.</strong>':'')+'</p>';
  return h.replace('<section class="detail-section v202-curriculum">','<section class="detail-section v202-curriculum">'+note);
};

// Die Prüfungsanalyse muss auch jene ORIGINAL-Kompetenz-IDs zulassen, die die
// Fachkonferenz in einen anderen Jahrgang verschoben hat – nur für tatsächlich
// verknüpfte Reihen dieser Lerngruppe, niemals global für alle Jahrgänge.
const v206CoursePoolBefore=v204AllCourseCurriculum;
v204AllCourseCurriculum=function(course){
  const base=v206CoursePoolBefore(course);
  if(!course)return base;
  const seen=new Set(base.map(c=>c.id));
  for(const q of state.sequences||[]){
    if(q.classId!==course.id||!q.curriculumV202?.appliedConferenceV206||!v202LinkedTopic(q))continue;
    for(const c of v202SequenceCompetencies(q)){
      if(seen.has(c.id)||c.sourceType==='method')continue;
      const source=v204CurriculumComp(c.id);
      if(!source)continue;
      base.push({...source,
        topicTitle:source.topicTitle||v202Topic(source.topicId)?.title||'Fachkonferenz',
        conferenceSourceV206:true});
      seen.add(c.id);
    }
  }
  return base;
};

const V206_EXCURSION_NOTES={
  5:'Schöpfung: Unterrichtsgang Müllsammeln (Januar–April); neues KC ist in Arbeit.',
  6:'Judentum: Besuch EJS Leer (September–November); ev./kath.: Besuch Jacobi-Kirche (individuell).',
  7:'Diakonie: externe Person an der IGS (März–Mai).',
  9:'Tod und Sterben: externe Lernorte/Personen und ggf. Friedhofsgang (Januar/Februar).'
};
// Fachkonferenzinformationen ergänzen den Planungs-Prompt, ohne daraus
// erfundene Termine, Curriculums-IDs oder automatische Prüfungseinträge zu machen.
const v206SequencePromptBefore=v184Prompt;
v184Prompt=function(){
  let txt=v206SequencePromptBefore();
  const c=cls(v184Flow.courseId),grade=v202Grade(c),subject=v202SubjectKey(c);
  if(subject!=='religion'||!grade)return txt;
  const note=V206_EXAM_NOTES['religion-'+grade],exc=V206_EXCURSION_NOTES[grade];
  if(!note&&!exc)return txt;
  const info='\n\n## Fachkonferenz Religion 2026/27 – ergänzende Unterrichtsvorgaben\n'
    +(note?'Leistungsnachweise laut Übergabekonferenz: '+note+'\n':'')
    +(exc?'Vorgesehene Lernorte / Veranstaltungen: '+exc+'\n':'')
    +'Diese Angaben stammen aus der Übergabekonferenz und sind Rahmeninformationen. Die PowerPoint enthält weder verbindliche Einzelstundenanzahlen für alle Reihen noch konkrete Prüfungsdaten für alle Themen. Bereits im Schulcockpit eingetragene Prüfungstermine bleiben maßgeblich. Fehlende Kompetenztexte NICHT erfinden.\n';
  return txt.replace('## Auftrag\n',info+'\n## Auftrag\n');
};

const v206RenderBefore=render;
render=function(){v206RenderBefore();const el=document.querySelector('.brand small');if(el)el.textContent=state.settings.schoolYear+' · '+V206_VERSION;};
render();
