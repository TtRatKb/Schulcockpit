/* Schulcockpit V0.30.1 – one readable A4 page per pupil.
 * Loaded after existing assessment/PDF extensions so LE status, bonus
 * calculations, corrected dates, signatures and variant labels stay intact.
 * No data is written or changed by this print-only override.
 */
(function(){
'use strict';
const fit=SC_REPORT_FIT_V301;
const BASE_WIDTH=303;
function rowLayout(c,m){
 const {main,task}=fit.separateTaskRefs(c?.text);
 const lines=v233Wrap(main||'–',BASE_WIDTH,m.rowFont,'F1');
 const tail=lines.at(-1)||'';
 const taskFits=!!task&&v233Measure(tail,m.rowFont,'F1')+
  v233Measure(task,m.refFont,'F1')+9<=BASE_WIDTH;
 const refs=task&&!taskFits?v233Wrap(task,BASE_WIDTH,m.refFont,'F1'):[];
 const height=Math.max(m.minRow,
  m.rowBaseline+Math.max(0,lines.length-1)*m.rowLeading+
  refs.length*m.refLeading+m.rowBottom);
 return {lines,task,taskFits,refs,height};
}
function tableHeader(out,p,y,m,le){
 if(m.id==='original')return v233TableHead(out,p,y,le);
 const h=m.headHeight,f=h/43;
 v233Fill(out,42,y-h,511,h,p.dark);
 v233Text(out,51,y-26*f,le?'Kompetenzen · angepasst':'Kompetenzen',9.3,'F2',p.white);
 v233Text(out,412.5,y-13*f,'Erreichte',7.8,'F2',p.white,'center');
 v233Text(out,412.5,y-25*f,'Punkte',7.8,'F2',p.white,'center');
 v233Text(out,412.5,y-36*f,'+ Bonuspunkte',7.1,'F2',p.white,'center');
 v233Text(out,483.5,y-19*f,'Mögliche',7.5,'F2',p.white,'center');
 v233Text(out,483.5,y-30*f,'Punkte',7.5,'F2',p.white,'center');
 v233Text(out,530,y-26*f,'Stand',8,'F2',p.white,'center');
 return y-h;
}
function row(out,p,c,layout,y,m){
 const low=y-layout.height,tag=v233Status(c);
 v233Fill(out,42,low,511,layout.height,p['row'+tag]||p.stripe);
 v233Fill(out,507,low,46,layout.height,p[tag]||p.soft);
 for(const x of [42,365,460,507,553])v233Line(out,x,low,x,y,p.line,.6);
 v233Line(out,42,low,553,low,p.line,.7);
 layout.lines.forEach((line,i)=>
  v233Text(out,52,y-m.rowBaseline-i*m.rowLeading,line,m.rowFont,'F1',p.ink));
 if(layout.task){
  const base=y-m.rowBaseline-(layout.lines.length-1)*m.rowLeading;
  if(layout.taskFits){
   const x=52+v233Measure(layout.lines.at(-1)||'',m.rowFont,'F1')+9;
   v233Text(out,x,base,layout.task,m.refFont,'F1',p.muted);
  }else layout.refs.forEach((text,i)=>v233Text(out,52,base-(i+1)*m.refLeading,
   text,m.refFont,'F1',p.muted));
 }
 const earned=c.bonusOnly?v233Number(c.bonusEarned):v233Number(c.regularEarned);
 const bonus=!c.bonusOnly&&Number(c.bonusEarned)>0?' + '+v233Number(c.bonusEarned):'';
 const numericFont=m.id==='original'?10:9.5;
 const x=412.5-(v233Measure(earned,numericFont,'F2')+v233Measure(bonus,numericFont,'F2'))/2;
 const baseline=(y+low)/2-3;
 v233Text(out,x,baseline,earned,numericFont,'F2',p.ink);
 if(bonus)v233Text(out,x+v233Measure(earned,numericFont,'F2'),
  baseline,bonus,numericFont,'F2',p.bonus);
 v233Text(out,483.5,baseline,v233Number(c.bonusOnly?c.bonusMax:c.regularMax),
  numericFont,'F1',p.ink,'center');
 v233Text(out,530,baseline,c.bonusOnly?'Bonus':tag,
  c.bonusOnly?7.7:numericFont,'F2',p.ink,'center');
 return low;
}
function total(out,p,r,y,m){
 if(m.id==='original')return v233Total(out,p,r,y);
 const h=m.totalHeight,f=h/53;
 v233Fill(out,42,y-h,511,h,p.soft);v233Fill(out,42,y-h,3,h,p.accent);
 v233Text(out,54,y-16*f,'GESAMTPUNKTE',7.9,'F2',p.muted);
 const bonus=Number(r.totalBonusEarned)>0;
 const sum=v233Number(r.totalReg)+(bonus?' + '+v233Number(r.totalBonusEarned):'');
 v233Text(out,54,y-32*f,sum+'  /  '+v233Number(r.totalMax),12.1,'F2',p.ink);
 v233Text(out,54,y-46*f,
  bonus?'regulär + Bonus  /  regulär möglich':'erreicht  /  möglich',7.5,'F1',p.muted);
 v233Line(out,344,y-48*f,344,y-7*f,p.line);
 v233Text(out,355,y-16*f,'ANRECHENBAR',7.8,'F2',p.muted);
 v233Text(out,355,y-35*f,v233Number(r.totalAdjusted)+' / '+v233Number(r.totalMax),
 12.2,'F2',p.accent);
 return y-h;
}
function card(out,p,label,lines,y,m,fill,bar){
 const h=m.cardFirst+lines.length*m.cardLeading;
 v233Fill(out,42,y-h,511,h,fill);
 v233Fill(out,42,y-h,4,h,bar);
 v233Text(out,56,y-(m.cardFirst===34?16:14),label,m.cardTitleFont,'F2',p.ink);
 lines.forEach((line,i)=>v233Text(out,56,y-m.cardFirst-i*m.cardLeading,
  line,m.cardFont,'F1',p.ink));
 return y-h-m.cardGap;
}
const previousPages=v233ReportPages;
v233ReportPages=function(r,a,sig){
 // Grade 8+ has a different points/learning-areas/grade PDF generator
 // (v260). Never replace it with the E/TE/NNE competency layout.
 if(typeof v202Grade==='function'&&typeof cls==='function'&&
   v202Grade(cls(a?.classId))>=8)return previousPages(r,a,sig);
 const le=!!r?.learningSupportV235&&r?.scoreCompleteV283===true;
 if(!r?.complete&&!le)throw Error('Diesen Bogen erst nach vollständiger Punkteerfassung drucken.');
 const rows=(r.competencies||[]).filter(c=>Number(c.regularMax)>0||c.bonusOnly);
 if(!rows.length)throw Error('Keine bewertbaren Kompetenzen vorhanden.');
 const p=v233Colors(a),fb=v200Feedback(r,a),start=v233Header([],r,a,p,false);
 let plan;
 try{plan=fit.choose({startY:start,rows,feedback:fb,measureRow:rowLayout,wrap:v233Wrap});}
 catch(err){
  if(err?.code==='SC_REPORT_ONE_PAGE_TOO_LONG')
   throw Error('Kompetenzbogen für '+v234PrintName(r)+': '+err.message);
  throw err;
 }
 const m=plan.profile,out=[];
 let y=v233Header(out,r,a,p,false);
 v233Legend(out,p,y);
 y=tableHeader(out,p,y-m.legendGap,m,le);
 rows.forEach((c,i)=>{y=row(out,p,c,plan.layouts[i],y,m);});
 y=total(out,p,r,y-m.totalGap,m)-m.afterTotal;
 const note=le?'E/TE/NNE aus individuell geltenden Aufgabenpunkten; weitere Foerderbeurteilung separat.'
  :rows.some(c=>c.bonusOnly)?
   'Nur Bonus: ohne E/TE/NNE; Bonus zaehlt zum Gesamtergebnis (max. 100 %).':
   'Bonuspunkte zaehlen zum Gesamtergebnis (max. 100 %); E/TE/NNE je Kompetenz.';
 v233Text(out,44,y,note,m.id==='original'?7.8:7.5,'F1',p.muted);
 y-=m.noteGap;
 v233Text(out,42,y,'DEINE RÜCKMELDUNG',m.id==='original'?9.2:8.9,'F2',p.accent);
 y-=m.feedbackHeadingGap;
 y=card(out,p,'Was dir schon gut gelingt',plan.strength,y,m,p.praise,p.praiseBar);
 y=card(out,p,'Dein nächster Lernschritt',plan.next,y,m,p.practice,p.practiceBar);
 // Defend against geometry regressions. Never return a clipped/incomplete PDF.
 if(y<m.bottomLimit-1)throw Error('Der Kompetenzbogen passt nicht sicher auf eine A4-Seite. Bitte Rückmeldung prüfen.');
 v233Sign(out,p,a,!!sig);
 return [out.join('')];
};
const beforeStep5=v200Step5;
v200Step5=function(a,priv){
 const html=beforeStep5(a,priv),message='<p class="microcopy v301-onepage">'+
 'Druckformat: <strong>eine A4-Seite je Kind</strong>. Zeilenabstände und Schrift werden '+
 'nur bei Bedarf behutsam angepasst. Aufgabenverweise bleiben zusammen. '+
 'Sollte ein außergewöhnlich langer Bogen nicht mehr lesbar passen, '+
 'meldet der Export den betroffenen Bogen statt eine zweite Seite anzulegen.</p>';
 return html.replace('<div class="v200-actions"><button class="secondary" data-v200-step="4">',
  message+'<div class="v200-actions"><button class="secondary" data-v200-step="4">');
};
const beforeRender=render;
render=function(){
 beforeRender();
 const tag=document.querySelector('.brand small');
 if(tag)tag.textContent=state.settings.schoolYear+' · V0.30.1';
};
if(typeof window!=='undefined')window.SchulcockpitReportOnePageV301={
 plan:(r,a)=>fit.choose({startY:v233Header([],r,a,v233Colors(a),false),
  rows:(r.competencies||[]).filter(c=>Number(c.regularMax)>0||c.bonusOnly),
  feedback:v200Feedback(r,a),measureRow:rowLayout,wrap:v233Wrap}),
 pages:v233ReportPages
};
})();