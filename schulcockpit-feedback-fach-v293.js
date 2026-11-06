/* V0.29.3 – subject-specific personal feedback for Religion, without
 * replacing stored teacher edits or changing established Math templates. */
(function(){
'use strict';
const core=SC_FEEDBACK_FACH_V293;
const previousSuggestions=v224Suggestions;
const previousDefault=v224DefaultFeedback;
const previousPrompt=v224FeedbackPrompt;
function subject(){
 const a=typeof v200Assessment==='function'?v200Assessment(v200Eval?.assessmentId):null;
 return typeof cls==='function'?cls(a?.classId)?.subject||'':'';
}
function religion(){return core.subjectKind(subject())==='religion';}
v224Suggestions=function(report){
 return religion()?core.compose(report):previousSuggestions(report);
};
v224DefaultFeedback=function(report){
 return religion()?core.defaultFeedback(report):previousDefault(report);
};
v224FeedbackPrompt=function(report){
 return religion()?core.prompt(report,subject()):previousPrompt(report);
};
const oldStep5=v200Step5;
v200Step5=function(a,priv){
 let html=oldStep5(a,priv);
 if(core.subjectKind(typeof cls==='function'?cls(a?.classId)?.subject:'')!=='religion')return html;
 const reports=v200ReportList(),selected=reports[v224Index(reports.length)];
 const previous=priv?.feedbackV210?.[selected?.student?.id];
 const savedText=String(previous?.strength||'')+' '+String(previous?.next||'');
 const oldMath=/mathematisch|rechenweg|rechenaufgab|zahlenstrahl|übungsaufgaben|übe beide bereiche mit weiteren eigenen beispielen/i.test(savedText);
 const info='<p class="microcopy"><strong>Religion:</strong> Die Formulierungen richten sich nach den Inhalten und Denkaufgaben der Kompetenzen (z. B. erklären, deuten, vergleichen, begründen). '+
  'Gespeicherte Texte bleiben erhalten. Mit „Automatischen Vorschlag einsetzen“ kannst du bei Bedarf neue Formulierungen übernehmen.</p>'+
  (oldMath?'<p class="warnbox">Diese gespeicherte Rückmeldung enthält offenbar noch Mathematik-Bausteine. '+
   'Bitte prüfe sie oder nutze „Automatischen Vorschlag einsetzen“.</p>':'');
 return html.replace('<div class="v224-editor"><h4>Deine persönliche Rückmeldung</h4>',
  '<div class="v224-editor"><h4>Deine persönliche Rückmeldung</h4>'+info);
};
const renderBefore=render;
render=function(){
 renderBefore();
 if(typeof document==='undefined')return;
 const version=document.querySelector('.brand small');
 if(version)version.textContent=state.settings.schoolYear+' · V0.29.3';
};
if(typeof window!=='undefined')window.SchulcockpitFachFeedbackV293={
 subjectKind:core.subjectKind,compose:core.compose
};
render();
})();