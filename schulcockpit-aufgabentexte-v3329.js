/* V0.33.29 – Originalaufgaben als rückwärtskompatible Metadaten. */
(function(){
'use strict';
const core=window.SchulcockpitAssessmentEditorV334;
if(!core)return;
const previousPrompt=v200AssessmentAnalysisPrompt;
v200AssessmentAnalysisPrompt=function(a,priv){
 const prompt=previousPrompt(a,priv)+'\n## Originale Aufgabenstellungen (zusätzliches Feld im bestehenden Importformat)\n'+
  'Ergänze bei JEDEM Element von items das optionale String-Feld "taskText" mit dem vollständigen, originalen Wortlaut der jeweiligen bewerteten Teilaufgabe (Operator, Angaben, relevante Vorgaben und Antwortoptionen, soweit sie aus der Quelle hervorgehen). Nicht zusammenfassen oder ergänzend erfinden. Keine Schülerantworten, Namen, Musterlösungen oder individuellen Ergebnisse einfügen. Wenn der Wortlaut nicht vollständig belegbar ist, verwende nur die belegten Bestandteile oder "" und nenne die Lücke. label bleibt die kurze Aufgabennummer; taskText ersetzt weder label noch Bonusbeschreibung oder Kompetenz. Das Schema bleibt schulcockpit.assessment-analysis.v1.\n';
 v200AssertNoStudentLeak(prompt,priv);
 return prompt;
};
const previousImport=v200ImportAnalysis;
v200ImportAnalysis=async function(raw){
 const a=v200Assessment(v200Eval?.assessmentId),old=a?.evaluationV200?.analysis?.items;
 // Keep exact task metadata on a matching reimport; the original importer still validates all scoring rules.
 if(old?.length&&typeof raw==='string'){
  const pattern=/<SCHULCOCKPIT_ASSESSMENT_IMPORT>\s*([\s\S]*?)\s*<\/SCHULCOCKPIT_ASSESSMENT_IMPORT>/;
  const m=raw.match(pattern);
  if(m){
   let parsed;try{parsed=JSON.parse(m[1]);}catch{}
   if(parsed?.schema==='schulcockpit.assessment-analysis.v1'&&Array.isArray(parsed.items)){
    core.preserveTaskTexts(old,parsed.items);
    raw=raw.replace(pattern,()=>'<SCHULCOCKPIT_ASSESSMENT_IMPORT>\n'+JSON.stringify(parsed)+'\n</SCHULCOCKPIT_ASSESSMENT_IMPORT>');
   }
  }
 }
 return previousImport(raw);
};
const previousRender=render;
render=function(){
 previousRender();
 const label=document.querySelector('.brand small');
 if(label)label.textContent=state.settings.schoolYear+' · V0.33.30';
};
render();
})();
