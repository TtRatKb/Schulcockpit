/* Schulcockpit V0.33.36 – school-year catalog, completeness and evidence integrity. */
'use strict';
const SC_INTEGRITY_V3336=(function(){
 const CRU5=[
  ['cru-r5-2026-h1-i01','Inhaltskompetenz','Du kannst biblische Erzählungen von Vertrauen und Angst benennen.'],
  ['cru-r5-2026-h1-i02','Inhaltskompetenz','Du kannst erläutern, was dich im Leben unterstützt und wie du andere unterstützen kannst.'],
  ['cru-r5-2026-h1-i03','Inhaltskompetenz','Du kannst eigene Zukunftsvorstellungen beschreiben und dich mit den Ansprüchen biblischer Friedensverheißungen auseinandersetzen.'],
  ['cru-r5-2026-h1-i04','Inhaltskompetenz','Du kannst Aufbau und Bedeutung Heiliger Schriften erklären.'],
  ['cru-r5-2026-h1-p01','Prozesskompetenz','Du kannst existenzielle Herausforderungen benennen.'],
  ['cru-r5-2026-h1-p02','Prozesskompetenz','Du kannst biblische Texte kreativ gestalten.'],
  ['cru-r5-2026-h2-i01','Inhaltskompetenz','Du kannst erklären, warum Abraham als Ursprung des Judentums, Christentums und Islams gilt.'],
  ['cru-r5-2026-h2-i02','Inhaltskompetenz','Du kennst religiöse Feste und Feiern verschiedener Religionen und kannst an einem Beispiel Bedeutung und Tradition eines Festes/einer Feier erklären.'],
  ['cru-r5-2026-h2-i03','Inhaltskompetenz','Du kannst dich mit Geboten, Liebe und Barmherzigkeit als Grundlage menschlichen Handelns auseinandersetzen.'],
  ['cru-r5-2026-h2-p01','Prozesskompetenz','Du kannst relevante christliche Inhalte bearbeiten und präsentieren.'],
  ['cru-r5-2026-h2-p02','Prozesskompetenz','Du kannst grundlegende religiöse Ausdrucksformen (z. B. den Schabbat) wahrnehmen und beschreiben.']
 ].map(([id,category,text])=>({id,category,text,topicTitle:'CRU Klasse 5 · SchiLF 2026',source:'SchiLF-Protokoll CRU Klasse 5',sourceVersion:'2026/27'}));
 const ids=u=>[...(u?.competencyIdsV202||[]),...(u?.competencyIds||[]),...(u?.methodIds||[])];
 function catalog(course,year,base=[]){return year==='2026/27'&&course?.subject&&/religion/i.test(course.subject)&&Number(String(course.name||'').match(/\d+/)?.[0]||course.grade)===5?CRU5.map(x=>({...x})):base;}
 function completeness(catalogRows=[],sequences=[],evidence=[]){const units=sequences.flatMap(q=>q.plan||[]),rows=catalogRows.map(c=>{const planned=units.some(u=>ids(u).includes(c.id)),ev=evidence.filter(e=>e.competencyId===c.id);return {...c,planned,evidencePlanned:ev.some(e=>['planned','done'].includes(e.status)),verified:ev.some(e=>e.status==='done'&&e.coverageScope==='full'),partial:ev.some(e=>e.status==='done'&&e.coverageScope!=='full')};});return {rows,missingPlan:rows.filter(x=>!x.planned),missingEvidence:rows.filter(x=>!x.evidencePlanned),complete:rows.every(x=>x.planned&&x.evidencePlanned)};}
 function prompt(course,year,result){const lines=x=>x.map(c=>'- '+c.id+' | '+c.category+' | '+c.text).join('\n')||'- keine';return `# Gezielter Delta-Auftrag: Reihenplanung vervollständigen\n\nKurs: ${course?.subject||''} ${course?.name||''}\nSchuljahr: ${year}\n\nErgänze ausschließlich die folgenden Lücken. Bestehende Reihen, Termine, Materialien, gehaltene oder vorbereitete Stunden dürfen nicht überschrieben, verschoben oder neu erzeugt werden. Erfinde keine Curriculum-IDs. Gib für jede Ergänzung eine Vorschau mit Ziel-Reihe, Kompetenz-ID und einem konkreten Kompetenznachweis aus.\n\n## Nicht eingeplant\n${lines(result.missingPlan)}\n\n## Ohne konkreten Nachweis\n${lines(result.missingEvidence)}\n\nAntworte zuerst in verständlichem Deutsch. Danach liefere einen kleinen Delta-JSON-Block; keine vollständige Jahresplanung.`;}
 function reconcile(evidence=[],lessons=[],yearFor=()=>'',now=new Date().toISOString()){let changed=0;for(const e of evidence){const l=e.lessonId&&lessons.find(x=>x.id===e.lessonId);if(!e.schoolYear){e.schoolYear=l?yearFor(l):'';changed++;}if(!e.coverageScope){e.coverageScope='partial';changed++;}if(e.lessonId&&(!l||l.status==='cancelled'||l.executionV180?.type==='cancel')){if(e.status!=='review_required'){e.previousStatusV3336=e.status;e.status='review_required';changed++;}e.reviewReason=!l?'Verknüpfter Fachtermin fehlt; Nachweis bleibt offen.':'Unterrichtsausfall: Nachweis ausdrücklich neu terminieren oder offen lassen.';e.integrityCheckedAt=now;}}return changed;}
 return {CRU5,catalog,completeness,prompt,reconcile};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_INTEGRITY_V3336;
