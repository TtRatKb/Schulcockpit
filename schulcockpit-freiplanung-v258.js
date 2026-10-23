/* Schulcockpit V0.25.8 – freie Stundenplanung und verlässliche Materialwahl.
 * Der Sollplan bleibt unangetastet; keine privaten Klassenlisten oder
 * unkontrollierten Reflexionstexte werden in ChatGPT-Prompts übernommen. */
(function(){
'use strict';

function previousContext(l){
  const previous=(state.lessons||[]).filter(x=>x.id!==l.id&&x.classId===l.classId&&
    x.date<l.date&&!(x.kind==='group'||x.groupId))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const completed=previous.filter(x=>v182IsHeld(x)||x.status==='done').slice(0,3).reverse();
  const rows=completed.length?completed:previous.slice(0,1);
  if(!rows.length)return 'Noch keine vorherige Fachstunde dokumentiert.';
  // Only timetable dates, generic lesson titles and completion flags. Reflective
  // notes, diagnoses, attendance details and free-text learning evaluations stay local.
  return rows.map(x=>'- '+(x.date||'Datum offen')+' · '+(x.title||'Thema nicht dokumentiert')+
    ' ('+(v182IsHeld(x)||x.status==='done'?'als gehalten markiert':'Ist-Status nicht bestätigt')+')').join('\n');
}

function freePrompt(l){
  const c=cls(l.classId),count=Math.max(0,Number(c?.students)||0);
  return `# Schulcockpit – Freiplanung einer Unterrichtsstunde

## Modus: bewusste Abweichung vom Sollplan
Ich möchte diese konkrete Stunde selbst neu ausrichten. Bisherige Soll-Themen, Soll-Ziele und Soll-Materialien gelten für diese Stunde NICHT als Vorgabe. Verändere weder die Jahres-/Reihenplanung noch bereits gehaltene Stunden.

## Organisatorischer Rahmen
Fach/Kurs: ${c?.subject||''} ${c?.name||''}
Datum: ${l.date||''}
Block: ${l.period||'nicht eingetragen'}
Ungefähre Lerngruppengröße: ${count||'nicht eingetragen'}

## Vorheriger Unterricht (nur ein grober, nicht personenbezogener Überblick)
${previousContext(l)}

## Meine eigentliche Idee kommt als Nächstes
Ich schildere sie gleich in einer weiteren Nachricht oder Sprachnachricht. Warte bitte darauf, bevor du die Planung erstellst. Wenn ich noch keine Idee mitgeschickt habe, bestätige nur kurz, dass du bereit bist. Bei unklarer Stundendauer oder wirklich fehlenden Angaben frage gezielt nach. Bitte fordere keine personenbezogenen Schülerdaten an.

## Sobald ich meine Idee geschildert habe
- Arbeite meine neue Absicht aus, ohne mich zum ursprünglichen Sollthema zurückzuführen.
- Plane realistische Phasen mit Minuten, konkrete Arbeitsaufträge, Einstieg, Sicherung und ggf. anonyme Differenzierung.
- Gib genaue Inhalte und sprechfertige Arbeitsaufträge für die Folien an.
- Nutze vorhandene Materialien nur, wenn ich sie ausdrücklich nenne. Erfinde keine Kopierpflicht und gehe nicht davon aus, dass Ausdrucke möglich sind.
- Erwähne nur notwendige Vorbereitung; digitale Alternativen sind möglich.
- Schließe mit GENAU EINEM importierbaren Datenblock in folgendem Format:

<SCHULCOCKPIT_IMPORT>
{
  "schema":"schulcockpit.lesson.v2",
  "lesson":{"title":"...","objective":"..."},
  "phases":[{"phase":"Einstieg","minutes":10,"title":"...","details":"..."}],
  "slides":[{"type":"Titel|Einstieg|Top oder Flop|Arbeitsauftrag|Inhalt|Sicherung|Reflexion|Sonstiges","title":"...","content":["..."],"notes":""}],
  "materials":[],
  "prepTasks":[]
}
</SCHULCOCKPIT_IMPORT>

Die Felder in diesem Muster sind Beispiele, keine fertige Unterrichtsplanung. Füge unter materials nur tatsächlich benötigte Materialien hinzu. Für diese Stunde bleibt das Soll im Cockpit als getrennte Referenz bestehen.`;
}

const originalPrompt=concretePlanningPromptV12;
concretePlanningPromptV12=function(l){return l?.freePlanningV258?freePrompt(l):originalPrompt(l);};
makeBrief=concretePlanningPromptV12;

const originalPlanStep=wizardPlanStepV14;
wizardPlanStepV14=function(l){
  if(l.freePlanningV258){
    return '<section class="wizard-panel-v14"><span class="eyebrow">SCHRITT 1 · FREIPLANUNG</span>'+
      '<h2>Du hast eine andere Idee für diese Stunde.</h2>'+
      '<p>Der bisherige Sollplan bleibt erhalten, bestimmt aber weder Thema noch Material des ChatGPT-Prompts. Du kannst deine Idee anschließend im Chat auch einsprechen.</p>'+
      '<p class="microcopy">Als Kontext werden nur bisherige Unterrichtstitel und Daten übergeben – keine Reflexionsnotizen oder Schülerdaten.</p>'+
      '<div class="wizard-footer-v14"><button class="secondary" data-v258-plan-mode="planned">Doch nach Sollplan planen</button>'+
      '<button class="primary big" data-v14-wizard-next="2">Freien ChatGPT-Prompt anzeigen →</button></div></section>';
  }
  return originalPlanStep(l).replace('<h3>Material in dieser Stunde</h3>',
    '<section class="v258-alternative"><strong>Heute anders unterrichten?</strong><p>Du kannst die Sollplanung für diese Stunde übergehen und deine eigene Idee mit ChatGPT ausarbeiten. Andere Stunden und die Reihe bleiben unverändert.</p>'+
    '<button class="secondary" data-v258-plan-mode="free">Andere Idee · Freiplanung mit ChatGPT →</button></section>'+
    '<h3>Material in dieser Stunde</h3>');
};

const originalPromptStep=wizardPromptStepV14;
wizardPromptStepV14=function(l){
  const html=originalPromptStep(l);
  return l.freePlanningV258?html
    .replace('Jetzt ChatGPT planen lassen','Eigene Idee mit ChatGPT planen')
    .replace('Er enthält Reihenplanung, Material und die letzte Reflexion.',
      'Er enthält den organisatorischen Rahmen und einen kurzen Unterrichtsrückblick, aber keine Themen- oder Materialvorgaben.')
    .replace('Ich erstelle die konkrete Stunde und den Schulcockpit-Datenblock.',
      'Schicke danach deine Idee als Text oder Sprachnachricht. Erst dann erstellt ChatGPT den Plan und Datenblock.')
    :html;
};

const originalPrepRow=coursePrepRowV14;
coursePrepRowV14=function(l){
  const html=originalPrepRow(l);
  if(v182IsHeld(l))return html;
  return html.replace('<button class="primary" data-start-wizard="'+l.id+'">',
    '<button class="secondary" data-v258-free-start="'+esc(l.id)+'">'+
    (l.freePlanningV258?'Freiplanung ✓':'Andere Idee · Freiplanung')+'</button>'+
    '<button class="primary" data-start-wizard="'+l.id+'">');
};

const originalWire=wire;
wire=function(){
  originalWire();
  document.querySelectorAll('[data-v258-plan-mode]').forEach(btn=>btn.addEventListener('click',()=>{
    const l=wizardLessonV14();
    if(!l||v182IsHeld(l))return alert('Bereits gehaltene Stunden bleiben unverändert.');
    l.freePlanningV258=btn.dataset.v258PlanMode==='free';
    saveState();render();
  }));
  document.querySelectorAll('[data-v258-free-start]').forEach(btn=>btn.addEventListener('click',()=>{
    const l=lesson(btn.dataset.v258FreeStart);
    if(!l||v182IsHeld(l))return;
    l.freePlanningV258=true;saveState();openWizardV14(l.id,1);
  }));
};

// Stable handler: the old per-button event listener could be lost when the
// lesson/material editor is redrawn. This action changes only the current lesson.
document.addEventListener('click',event=>{
  const btn=event.target?.closest?.('[data-v183-hide]');
  if(!btn)return;
  event.preventDefault();event.stopImmediatePropagation();
  try{
    const id=btn.dataset.v183Hide||'',split=id.indexOf('|');
    if(split<1)return;
    const l=lesson(id.slice(0,split)),hint=decodeURIComponent(id.slice(split+1));
    if(!l||v182IsHeld(l))return alert('Eine bereits gehaltene Stunde wird nicht verändert.');
    v183DeleteFromLesson(l,hint);
    resourceEditorV176={lessonId:'',key:''};
    saveState();render();
  }catch(e){alert('Materialentscheidung konnte nicht gespeichert werden: '+(e.message||e));}
},true);

})();
