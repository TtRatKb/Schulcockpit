/* Schulcockpit V0.20.5 – schonender Einstieg in die kompetenzorientierte Planung.
   Keine historische Stunde, kein Prüfungsdatensatz und keine Datei wird verändert.
   Fach/Jahrgang und eindeutiges Curriculums-Thema werden nur als Reihen-Metadaten verknüpft. */
const V205_VERSION='V0.20.5';

function v205GoalText(comp){
  const original=String(comp?.text||'').trim();
  if(!original)return '';
  if(/^Die Schüler(?:innen|\*innen|:innen| und Schüler)/i.test(original))
    return /[.!?]$/.test(original)?original:original+'.';
  const bare=original.replace(/[.!?]\s*$/,'').trim();
  const method=String(comp?.id||'').startsWith('methode-');
  if(method){
    const stem=bare.replace(/\s*\(UE\b[\s\S]*$/i,'').trim();
    if(/^Plakatgestaltung und -vorstellung/i.test(stem))return 'Die Schüler*innen können ein Plakat gestalten und vorstellen.';
    if(/^Diagramme lesen, erstellen, auswerten/i.test(stem))return 'Die Schüler*innen können Diagramme lesen, erstellen und auswerten.';
    if(/^Gruppenarbeit/i.test(stem))return 'Die Schüler*innen können in Gruppen zusammenarbeiten.';
    if(/^Arbeiten mit dem Kompetenzraster/i.test(stem))return 'Die Schüler*innen können mit dem Kompetenzraster arbeiten.';
    if(/^Umgang mit mathematischem Werkzeug/i.test(stem))return 'Die Schüler*innen können mathematische Werkzeuge sachgerecht verwenden.';
    if(/^(lesen|erstellen|planen|berechnen|auswerten|anwenden|recherchieren|präsentieren|arbeiten)\b/i.test(stem))
      return 'Die Schüler*innen können '+stem.charAt(0).toLowerCase()+stem.slice(1)+'.';
    // Bei nominalen Kurzbezeichnungen kein neues, unbelegtes Lernziel behaupten.
    return 'Die Schüler*innen können die Methode „'+stem+'“ in einer geeigneten Lernaufgabe anwenden.';
  }
  return 'Die Schüler*innen können '+bare.charAt(0).toLowerCase()+bare.slice(1)+'.';
}

// Lesbares Ziel anzeigen, amtlichen Originalwortlaut und ID trotzdem erhalten.
const v205PreviousStatusHtml=v202StatusHtml;
v202StatusHtml=function(q,c){
  const h=v205PreviousStatusHtml(q,c);
  const orig='<strong>'+esc(c.text)+'</strong>';
  return h.replace(orig,'<strong>'+esc(v205GoalText(c))+'</strong><small class="v205-original" title="Wortlaut aus dem Hauscurriculum">Quelle: '+esc(c.text)+'</small>');
};
const v205PreviousPromptBlock=v202PromptCompetencyBlock;
v202PromptCompetencyBlock=function(topic,q){
  const original=v205PreviousPromptBlock(topic,q);
  if(!topic)return original;
  const methods=q?v202EffectiveMethodIds(q,topic):v202FlowMethodIds(topic);
  const comps=[...(topic.competencies||[]),...(methods||[]).map(v202Method).filter(Boolean)];
  return original+'\n\n## Verständliche, beobachtbare Lernziele (Original-IDs beibehalten)\n'
    +comps.map(c=>'- '+c.id+': '+v205GoalText(c)).join('\n')
    +'\nDie obigen Lernziele sind eine Lesehilfe; verbindlich bleiben die exakten Curriculum-IDs und Originalformulierungen. Plane methodische Ziele als konkrete Lernhandlungen ein.\n';
};

// Fehlerbehebung: Prüfungen liegen in state.assessments, nicht in state.assessmentsV188.
v202AssessmentEvidence=function(q,id,comp){
  const hits=[];
  for(const a of state.assessments||[]){
    if(a.classId!==q.classId)continue;
    if(a.competencySelectionV204?.sourceV205==='ai-proposal'&&!a.competencySelectionV204?.teacherReviewedV205)continue;
    const an=a.evaluationV200?.analysis;
    if(!Array.isArray(an?.competencies))continue;
    if(an.competencies.some(c=>c.curriculumCompetencyId===id||(comp&&v202Norm(c.text)===v202Norm(comp.text))))
      hits.push(a.title||a.type||'Leistungsnachweis');
  }
  return [...new Set(hits)];
};

function v205DateToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function v205MatchTopic(q){
  const course=cls(q.classId),subject=v202SubjectKey(course),grade=v202Grade(course);
  if(!subject||!grade)return {subject,grade,topic:null,score:0,confident:false};
  const ranking=v202Topics(subject,grade).map(t=>({topic:t,score:v202TopicScore(q.title,t)})).sort((a,b)=>b.score-a.score);
  const best=ranking[0],second=ranking[1];
  const confident=!!best&&best.score>=0.80&&best.score-(second?.score||0)>=0.15;
  return {subject,grade,topic:best?.topic||null,score:best?.score||0,confident};
}
function v205RelevantRows(year){
  const today=v205DateToday();
  return (state.sequences||[]).filter(q=>v190SeqYear(q)===year&&(!q.endDate||q.endDate>=today))
    .map(q=>({q,course:cls(q.classId),linked:v202LinkedTopic(q),match:v205MatchTopic(q)}))
    .sort((a,b)=>(a.course?.subject||'').localeCompare(b.course?.subject||'','de')||(a.course?.name||'').localeCompare(b.course?.name||'','de')||(a.q.startDate||'').localeCompare(b.q.startDate||''));
}
function v205TopicChoices(item){
  if(item.linked)return '';
  const m=item.match;
  const topics=v202Topics(m.subject,m.grade);
  if(!topics.length)return '';
  const chosen=m.confident?m.topic.id:'';
  return '<select data-v205-topic="'+esc(item.q.id)+'" aria-label="Curriculum-Thema für '+esc(item.q.title)+'">'
    +'<option value="">— noch nicht zuordnen —</option>'
    +topics.map(t=>'<option value="'+esc(t.id)+'" '+(chosen===t.id?'selected':'')+'>'+esc(t.title)+'</option>').join('')
    +'</select>';
}
function v205WizardHtml(){
  const year=modal?.year||v190PlanningYear(),rows=v205RelevantRows(year);
  const matches=rows.filter(r=>!r.linked&&r.match.confident).length;
  const unclear=rows.filter(r=>!r.linked&&!r.match.confident).length;
  const cells=rows.map(r=>{
    const m=r.match,q=r.q,c=r.course;
    const status=r.linked?'Bereits verknüpft':m.confident?'Automatischer Vorschlag':'Keine sichere Zuordnung';
    const suggestion=r.linked?r.linked.title:m.confident?m.topic.title:'Bitte nur bei Bedarf auswählen';
    return '<div class="v205-row">'
      +'<div><strong>'+esc((c?.subject||'Fach')+' '+(c?.name||'')+' · '+q.title)+'</strong>'
      +'<small>'+esc(status)+' · '+esc(suggestion)+'</small></div>'
      +'<div>'+v205TopicChoices(r)+'</div>'
      +'<button class="secondary small" data-v205-plan="'+esc(q.id)+'">Reihe planen</button>'
      +'</div>';
  }).join('');
  const outcome=Number.isInteger(modal?.applied)?'<div class="v205-result"><strong>'+modal.applied+' Reihen mit Kompetenzen verknüpft.</strong> Deine bisherigen Stunden und Prüfungen wurden nicht verändert. Bei ungeklärten Reihen kannst du später gezielt die Curriculum-Zuordnung prüfen.</div>':'';
  return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-xwide v205-modal" data-modal-stop>'
    +'<header class="modal-header"><div><span class="eyebrow">SCHULJAHR '+esc(year)+' · KOMPETENZEN</span>'
    +'<h2>Ab jetzt kompetenzorientiert weiterplanen</h2></div><button class="icon-button" data-action="modal-close">×</button></header>'
    +'<div class="modal-body"><p>Das Cockpit erkennt Fach, Jahrgang und eindeutige Curriculum-Themen. Es verknüpft ausschließlich die <strong>Reihe</strong> mit ihrer Kompetenzgrundlage. Bereits gehaltene Stunden, Soll-Stunden, Klassenarbeiten und Materialdateien bleiben unverändert.</p>'
    +'<div class="v205-stats"><span><strong>'+matches+'</strong> eindeutige Vorschläge</span><span><strong>'+unclear+'</strong> zunächst offen</span><span><strong>'+rows.filter(r=>r.linked).length+'</strong> bereits verknüpft</span></div>'
    +outcome
    +'<p class="microcopy">Vorauswahl bedeutet nicht „bereits unterrichtet“ oder „von Schüler*innen erreicht“. Unklare und jahrgangsfremde Zuordnungen werden nicht automatisch übernommen.</p>'
    +'<div class="v205-list">'+(cells||'<p>Keine aktuellen oder zukünftigen Reihen für dieses Schuljahr gefunden.</p>')+'</div>'
    +'<div class="v200-actions"><button class="secondary" data-action="modal-close">Schließen</button>'
    +'<button class="primary" data-v205-apply>Vorschläge für die Zukunft übernehmen</button></div>'
    +'</div></section></div>';
}
const v205ModalHtmlBefore=modalHtml;
modalHtml=function(){if(modal?.type==='v205Wizard')return v205WizardHtml();return v205ModalHtmlBefore();};

async function v205Apply(){
  if(modal?.type!=='v205Wizard')return;
  const year=modal.year,rows=v205RelevantRows(year),decisions=[];
  for(const item of rows){
    if(item.linked)continue;
    const choice=document.querySelector('[data-v205-topic="'+item.q.id+'"]')?.value||'';
    if(!choice)continue;
    const t=v202Topic(choice),m=item.match;
    if(!t||t.subject!==m.subject||!(t.grades||[]).includes(m.grade))
      throw new Error('Ungültige Fach-/Jahrgangszuordnung bei '+item.q.title+'.');
    if(item.q.endDate&&item.q.endDate<v205DateToday())continue;
    decisions.push({q:item.q,topic:t,grade:m.grade,subject:m.subject});
  }
  if(!decisions.length){alert('Keine neuen eindeutigen oder manuell gewählten Zuordnungen gefunden.');return;}
  for(const d of decisions){
    // Absichtlich NICHT v202SetTopic: Dieses würde ggf. historische Soll-Stunden bereinigen.
    d.q.curriculumV202={schema:1,topicId:d.topic.id,subjectKey:d.subject,grade:d.grade,
      confirmed:true,crossGradeConfirmed:false,methodIds:v202DefaultMethodIds(d.q,d.topic),
      manualDoneIds:[],evidenceIds:[],autoLinkedV205:true,linkedAt:new Date().toISOString()};
  }
  try{
    await saveState();
  }catch(e){
    for(const d of decisions)delete d.q.curriculumV202;
    throw e;
  }
  modal={type:'v205Wizard',year,applied:decisions.length};render();
}
const v205PreviousSequencesView=sequencesView;
sequencesView=function(){
  const h=v205PreviousSequencesView();
  const anchor='<button class="secondary" data-v202-browser>Curriculum & Kompetenzen</button>';
  return h.includes(anchor)?h.replace(anchor,'<button class="primary" data-v205-open>Schuljahr kompetenzorientiert vorbereiten</button>'+anchor):h;
};
const v205WireBefore=wire;
wire=function(){
  v205WireBefore();
  document.querySelector('[data-v205-open]')?.addEventListener('click',()=>{
    modal={type:'v205Wizard',year:v190PlanningYear()};render();
  });
  document.querySelector('[data-v205-apply]')?.addEventListener('click',()=>v205Apply().catch(e=>alert(e.message||e)));
  document.querySelectorAll('[data-v205-plan]').forEach(b=>b.addEventListener('click',()=>{
    const q=seq(b.dataset.v205Plan);if(q)v184Open(q.classId,q.id);
  }));
};
const v205RenderBefore=render;
render=function(){
  v205RenderBefore();
  const v=document.querySelector('.brand small');
  if(v)v.textContent=state.settings.schoolYear+' · '+V205_VERSION;
};
