/* Schulcockpit V0.25.0 – optional 6-hour statistics poster project.
   Only appends undated Soll units after explicit approval; never moves Ist/fixed exams. */
(function(){
'use strict';
const PROJECT_TAG='statistics-poster-v250';
const HOURS=[
  {title:'Datenprojekt: Thema, Forschungsfrage und Gruppen',content:'Arbeitsauftrag verstehen; Gruppen mit 3–4 Personen bilden; eine statistische Fragestellung vereinbaren und Erhebungsplan erstellen.',match:/erhebung|daten.*plan|gruppenarbeit/i},
  {title:'Datenprojekt: Daten erheben und dokumentieren',content:'Daten sammeln; nachvollziehbar in Strichlisten und Tabellen ordnen; Verantwortlichkeiten in der Gruppe klären.',match:/daten erheben|statistisch|strichlist|tabell/i},
  {title:'Datenprojekt: Daten auswerten und Diagramme erstellen',content:'Daten sortieren und auswerten; geeignete Säulen-/Balkendiagramme oder Piktogramme erstellen und Aussagen überprüfen.',match:/diagramm|darstell|daten.*auswert|graphisch/i},
  {title:'Datenprojekt: Plakat gestalten und Vorstellung vorbereiten',content:'Diagramme, Fragestellung, Ergebnisse und Begründungen auf einem Plakat nachvollziehbar darstellen; gemeinsame Vorstellung proben.',match:/plakat|präsent|vorstell|gruppenarbeit/i},
  {title:'Datenprojekt: Präsentationen – Teil 1',content:'Etwa die Hälfte der Gruppen stellt Plakat, Diagramm und Ergebnisse vor. Rückfragen und Feedback mit transparenten Kriterien.',match:/plakat|präsent|vorstell|diagramm/i},
  {title:'Datenprojekt: Präsentationen – Teil 2 und Sicherung',content:'Weitere Gruppen präsentieren; Vergleich der Darstellungen, fachliche Sicherung und kurze Reflexion der Zusammenarbeit.',match:/plakat|präsent|vorstell|diagramm|gruppenarbeit/i}
];
function eligible(q){
  const c=cls(q?.classId);
  return !!q&&v202SubjectKey(c)==='mathematik'&&v202Grade(c)===5&&
    /unsere klasse|statistik|daten und gr[oö]ßen|rundung/i.test(q.title||'');
}
function existing(q){
  return (q.plan||[]).some(u=>u.projectTagV250===PROJECT_TAG||
    /Datenprojekt: (Thema, Forschungsfrage und Gruppen|Präsentationen – Teil 1)/i.test(u.title||''));
}
function panel(q){
  if(!eligible(q))return '';
  return '<section class="detail-section v250-project"><div class="section-head"><div>'+
    '<span class="eyebrow">NACHTRÄGLICH PLANEN · MATHEMATIK 5</span><h3>Plakatprojekt in Statistik</h3></div>'+
    (existing(q)?'<span class="safe-chip">Projektstunden bereits enthalten</span>':
    '<button class="secondary" data-v250-preview="'+esc(q.id)+'">6 Projektstunden ergänzen →</button>')+
    '</div><p>Mit 27 Kindern entstehen ungefähr 7–9 Gruppen. Die Präsentationen brauchen mindestens zwei Unterrichtsstunden. Bestehende Stunden, feste Klassenarbeiten und Materialbezüge bleiben unverändert. Zusätzliche Stunden werden zunächst <strong>ohne Termin</strong> angelegt – die Jahresplanung muss danach die freien Fachstunden prüfen.</p></section>';
}
const previousPanel=sequencePanel;
sequencePanel=function(q){
  const html=previousPanel(q);
  if(!eligible(q))return html;
  const extra=panel(q),position=html.lastIndexOf('<section class="danger-zone');
  return position>=0?html.slice(0,position)+extra+html.slice(position):
    html.replace(/<\/div>\s*$/,extra+'</div>');
};
const beforeModal=modalHtml;
modalHtml=function(){
  if(modal?.type!=='statisticsProjectV250')return beforeModal();
  const q=seq(modal.qid);
  if(!eligible(q))return '<p>Reihe nicht gefunden.</p>';
  return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide" data-modal-stop>'+
    '<header class="modal-header"><div><span class="eyebrow">VORSCHAU · NUR SOLLPLAN</span>'+
    '<h2>Statistik-Plakatprojekt ergänzen</h2></div><button class="icon-button" data-action="modal-close">×</button></header>'+
    '<div class="modal-body"><p><strong>'+esc(q.title)+'</strong> · sechs zusätzliche Fachstunden</p>'+
    HOURS.map((h,i)=>'<p><strong>'+(i+1)+'. '+esc(h.title)+'</strong><small>'+esc(h.content)+'</small></p>').join('')+
    '<p class="microcopy">Die neuen Stunden erhalten keine erfundenen Termine, Dateien oder Prüfungsbewertungen. Nur belegte Kompetenz-IDs der Reihe werden übernommen. Bestehende Ist-Stunden und bestätigte Klassenarbeiten bleiben unverändert. Anschließend die Stunden im Jahresplan datieren und die Leistungsart im Bereich „Leistungsnachweise“ prüfen.</p>'+
    '<button class="primary" data-v250-confirm>Sechs ungedatete Sollstunden hinzufügen</button></div></section></div>';
};
async function append(){
  const q=seq(modal?.qid);
  if(!eligible(q)||existing(q))throw Error('Projekt bereits vorhanden oder falsche Reihe.');
  if(!confirm('Sechs neue, zunächst ungedatete Sollstunden in „'+q.title+'“ anlegen? Bestehende Termine werden nicht verschoben.'))return;
  const original=clone(q.plan||[]);
  try{
    const competences=v202SequenceCompetencies(q);
    q.plan=q.plan||[];
    for(const h of HOURS){
      const u=cleanPlanUnitV10({title:h.title,hours:'1',plannedDate:'',
        content:h.content,objective:'Daten fachgerecht erheben, darstellen, interpretieren und gemeinsam präsentieren.',
        notes:'Statistik-Plakatprojekt · Termin noch zu vergeben · 3–4 Kinder pro Gruppe · keine automatisch angelegte Ersatzleistung'});
      u.projectTagV250=PROJECT_TAG;
      u.competencyIdsV202=[...new Set(competences.filter(c=>h.match.test(c.text||'')).map(c=>c.id))];
      q.plan.push(u);
    }
    await saveState();
    modal={type:'sequence',id:q.id};render();
    alert('Sechs Projektstunden ergänzt. Bitte anschließend die konkreten Fachtermine im Jahresplan prüfen. Klassenarbeit und feste Termine wurden nicht verändert.');
  }catch(e){q.plan=original;throw e;}
}
const oldRender=render;
render=function(){oldRender();const v=document.querySelector('.brand small');if(v)v.textContent=state.settings.schoolYear+' · V0.25.0';};
const oldWire=wire;
wire=function(){
  oldWire();
  document.querySelectorAll('[data-v250-preview]').forEach(b=>b.addEventListener('click',()=>{
    const q=seq(b.dataset.v250Preview);
    if(!eligible(q)||existing(q))return;
    modal={type:'statisticsProjectV250',qid:q.id};render();
  }));
  document.querySelector('[data-v250-confirm]')?.addEventListener('click',e=>{
    e.currentTarget.disabled=true;
    void append().catch(err=>{alert('Projektstunden nicht hinzugefügt: '+(err.message||err));render();});
  });
};
render();
})();
