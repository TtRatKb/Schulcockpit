/* V0.28.3 – distinguish "all score cells filled" from "LE assessment pending".
 * Never automatically remove a documented support flag or alter points.
 */
(function(){
'use strict';
const oldReport=v200StudentReport;
v200StudentReport=function(priv,an,stu){
 const r=oldReport(priv,an,stu);
 return v235IsLE(priv,stu)?SC_LE_STATUS_V283.clarify({...r,learningSupportV235:true}):r;
};
const previousStepNav=v200StepNav;
v200StepNav=function(step){
 return previousStepNav(step).replace(/(Klassenliste · \d+ Kinder · \d+) LE offen/g,
  '$1 LE markiert');
};
const oldStep4=v200Step4;
v200Step4=function(a,priv){
 let html=oldStep4(a,priv),an=a?.evaluationV200?.analysis;
 if(!html.includes('v235-le-tag')||!an||!priv?.roster)return html;
 const byId=new Map(priv.roster.map(s=>[s.id,s]));
 return html.replace(/<tr><th scope="row" class="v221-person"[^>]*>[\s\S]*?<\/tr>/g,row=>{
  const sid=row.match(/data-v210-participation="([^"]+)"/)?.[1],stu=byId.get(sid);
  if(!stu||!v235IsLE(priv,stu))return row;
  const r=v200StudentReport(priv,an,stu);
  const state=r.scoreCompleteV283?'Punkte vollständig':'Punkte/Teilwertung noch offen';
  return row.replace('LE · Bewertung offen',
   'LE · '+state+' · zieldifferente Bewertung separat ausstehend');
 });
};
const oldStep5=v200Step5;
v200Step5=function(a,priv){
 const html=oldStep5(a,priv),pending=v200ReportList().filter(r=>r.learningSupportV235);
 if(!pending.length)return html;
 const ready=pending.filter(r=>r.scoreCompleteV283).length;
 const lines=ready===pending.length
  ?'Bei '+ready+' von '+pending.length+' LE-Kind(ern) sind alle Punkte vollständig erfasst. '
    +'Der offene Status betrifft ausschließlich die gesonderte zieldifferente Bewertung.'
  :'Bei '+ready+' von '+pending.length+' LE-Kind(ern) sind die Punkte vollständig erfasst. '
    +'Bei den übrigen sind auch noch Punkte oder Teilwertungen zu prüfen. '
    +'Die zieldifferente Beurteilung steht unabhängig davon aus.';
 const detail='<p class="v283-le-clarity"><strong>Punkte und Beurteilung sind zwei verschiedene Schritte:</strong> '+
   esc(lines)+' Die individuellen Bonusentscheidungen bleiben gespeichert und werden bei der '+
   'Punktberechnung berücksichtigt.</p>';
 return html.replace(/(<section class="detail-section v235-pending">[\s\S]*?)(<\/section>)/,
  (all,inside,close)=>inside+detail+close);
};
const oldRender=render;
render=function(){
 oldRender();
 const version=document.querySelector('.brand small');
 if(version)version.textContent=state.settings.schoolYear+' · V0.28.3';
};
window.SchulcockpitLEStatusV283={isLe:stu=>!!v235IsLE(v200Eval?.privateData,stu)};
})();