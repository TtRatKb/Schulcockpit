/* Schulcockpit V0.32.3 – simple reflection presets and evidence-based takeaways.
 * Pure logic: uses existing reflectionV182 and V295 lesson memory. No new database.
 */
(function(root){
'use strict';
const PRESETS={
 works:{label:'Das hat funktioniert',overall:'fine'},
 tight:{label:'Zeit war zu knapp',timing:'tight'},
 repeat:{label:'Mehr Übung nötig',learning:'repeat'},
 differentiate:{label:'Mehr Differenzierung',lessonFlag:'differentiation'}
};
function apply(current,key){
 if(!Object.hasOwn(PRESETS,key))throw Error('Unbekannte Reflexionsauswahl.');
 const out=structuredCopy(current||{}),p=PRESETS[key];
 out.lessonFlags=Array.isArray(out.lessonFlags)?[...out.lessonFlags]:[];
 out.pptFlags=Array.isArray(out.pptFlags)?[...out.pptFlags]:[];
 out.materialIssues=out.materialIssues&&typeof out.materialIssues==='object'?out.materialIssues:{};
 if(p.overall)out.overall=out.overall===p.overall?'':p.overall;
 if(p.timing)out.timing=out.timing===p.timing?'':p.timing;
 if(p.learning)out.learning=out.learning===p.learning?'':p.learning;
 if(p.lessonFlag){
  const at=out.lessonFlags.indexOf(p.lessonFlag);
  if(at<0)out.lessonFlags.push(p.lessonFlag);else out.lessonFlags.splice(at,1);
 }
 out.completedAt=''; // A choice alone never falsely completes reflection.
 return out;
}
function structuredCopy(x){return JSON.parse(JSON.stringify(x||{}));}
function active(r,key){
 const p=PRESETS[key];return !!(p&&(p.overall?r?.overall===p.overall:
  p.timing?r?.timing===p.timing:p.learning?r?.learning===p.learning:
  p.lessonFlag?r?.lessonFlags?.includes(p.lessonFlag):false));
}
function takeaways(entry){
 if(!entry)return [];
 const hints=[],add=x=>{if(!hints.includes(x))hints.push(x);};
 if(['tight','unfinished'].includes(entry.timing))add('Mehr Zeit einplanen oder Stoff kürzen');
 if(entry.timing==='leftover')add('Zusatzaufgabe für schnelle Lernende bereithalten');
 if(entry.learning==='repeat')add('Mehr Übung / Wiederholung einplanen');
 if(entry.learning==='partly')add('Lernziel noch einmal sichern');
 if(entry.learning==='easy')add('Schwierigere Aufgaben anbieten');
 const flags=Array.isArray(entry.lessonFlags)?entry.lessonFlags:[];
 if(flags.includes('differentiation'))add('Stärker differenzieren');
 if(flags.includes('too_dense'))add('Inhalt reduzieren');
 if(flags.includes('flow'))add('Ablauf übersichtlicher planen');
 if(flags.includes('discussion'))add('Gespräch und Ergebnissicherung verbessern');
 if(flags.includes('motivation')||flags.includes('play')||flags.includes('hands_on'))add('Einstieg / Aktivierung verbessern');
 if((entry.pptFlags||[]).length)add('Präsentation auf markierte Probleme prüfen');
 if(Object.values(entry.materialIssues||{}).some(fs=>Array.isArray(fs)&&fs.length))add('Materialfassungen auf markierte Probleme prüfen');
 if(['fine','great','good'].includes(entry.overall)&&!hints.length)add('Bewährten Ablauf beibehalten');
 if(['mixed','revise','hard'].includes(entry.overall)&&!hints.length)add('Ablauf beim nächsten Einsatz überprüfen');
 return hints.slice(0,6);
}
function evidence(entries){
 return (entries||[]).filter(e=>!!e.date).map(e=>({...e,hints:takeaways(e)}));
}
function promptHints(entries){
 // Intentionally never export free-text reflection notes or learner details.
 const latest=(entries||[])[0];if(!latest)return '';
 const hints=takeaways(latest);
 if(!hints.length)return '';
 return '\n\n## Hinweise aus einer früher gehaltenen, gleich benannten Stunde\n'+
  'Vorherige Durchführung: '+latest.date+'.\n'+
  hints.map(x=>'- '+x).join('\n')+
  '\nDiese Hinweise sind Erfahrungswerte, keine zwingende automatische Umplanung. '+
  'Freitextnotizen und personenbezogene Beobachtungen bleiben ausschließlich im Schulcockpit.\n';
}
const api={PRESETS,apply,active,takeaways,evidence,promptHints};
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.SchulcockpitQuickReflectionCoreV323=api;
})(typeof window!=='undefined'?window:null);
