/* V0.30.6 – Effective material for the NEXT lesson derives from the actual
 * previous lesson. No destructive updates to historical plans / file blobs.
 * Use identical material/variant IDs, never just an approximate title match
 * when both sides have exact IDs.
 */
const SC_WORKSHEET_FLOW_V306=(function(){
'use strict';
const old=SC_WORKSHEET_ACTUAL_V305;
function policy(status,follow,printed){
 const a=old.tidy({status,follow,printed});
 if(a.status==='complete'||a.status==='skipped')return 'done';
 if(['partial','unused'].includes(a.status)&&['stop','later'].includes(a.follow))return 'done';
 if(a.status==='partial'&&a.follow==='continue')return 'carry';
 if(a.status==='unused'&&a.follow==='continue'&&a.printed==='yes')return 'distribute';
 if(a.status==='unused'&&a.follow==='continue')return 'newPrint';
 return 'open';
}
function outcomes(previous,currentRows,explicitRepeat=[]){
 const repeats=new Set(explicitRepeat||[]);
 return old.dueItems(previous,currentRows).map(hit=>{
  const {record,target}=hit;
  const wasPrinted=(previous?.printPlan||[]).some(p=>p.materialId===hit.source.materialId&&
   (!hit.source.variantId||p.variantId===hit.source.variantId)&&p.alreadyPrinted);
  const printed=record.printed==='unknown'&&(hit.source.printedFromPlan||wasPrinted)?'yes':record.printed;
  const mode=repeats.has(target.id)?'repeat':policy(record.status,record.follow,printed);
  return {...hit,mode,sourceId:hit.source.id,targetId:target.id};
 });
}
function decisionMap(hits){
 return new Map((hits||[]).map(h=>[h.targetId,h]));
}
function noNewPrint(hit){
 return !!hit&&['done','carry','distribute'].includes(hit.mode);
}
function suppressInPlanning(hit){return !!hit&&hit.mode==='done';}
function shareable(hit){return !!hit&&['carry','distribute'].includes(hit.mode);}
function simpleStatus(hit){
 if(!hit)return '';
 if(hit.mode==='done')return hit.record.follow==='later'?'Für eine spätere Stunde vorgemerkt':hit.record.status==='complete'?'Bereits vollständig bearbeitet':
  hit.record.status==='skipped'?'Bewusst weggelassen':'Nicht weiterführen';
 if(hit.mode==='carry')return 'Bereits ausgeteilt · nur Rest bearbeiten / besprechen';
 if(hit.mode==='distribute')return 'Schon ausgedruckt · jetzt austeilen';
 if(hit.mode==='newPrint')return 'Noch nicht ausgeteilt · für Fortsetzung vorbereiten';
 if(hit.mode==='repeat')return 'Bewusst erneut eingeplant';
 return 'Fortsetzung noch offen';
}
function prompt(previous,hits){
 if(!previous||!(hits||[]).length)return '';
 const items=hits.filter(h=>h.mode!=='repeat');
 if(!items.length)return '';
 return '\n\n## Verbindlicher Material-Ist-Stand aus der letzten Stunde\n'+
 items.map(h=>'- '+h.source.title+' ('+previous.date+'): '+simpleStatus(h)+
  (h.mode==='done'?'. Nicht erneut als Arbeitsauftrag, Arbeitsblatt oder Ausdruck einplanen.':
  h.mode==='carry'?'. In der Folgestunde NUR die noch offenen Aufgaben beenden und ggf. Ergebnisse sichern/besprechen. KEINE neue Kopie, kein neuer Arbeitsblatt-Download.':
  h.mode==='distribute'?'. Schon ausgedruckt, noch nicht ausgeteilt. Beim nächsten Mal austeilen, KEINE neue Kopie.':
  h.mode==='newPrint'?'. Muss für die Fortsetzung noch bereitgestellt werden.':
  '. Lehrkraft hat noch keine Fortsetzungsentscheidung getroffen.')).join('\n')+
 '\nNur die tatsächlich noch offenen Materialien als aktive Stundenressourcen behandeln. '+
 'Erledigte oder gestrichene Materialien stehen eventuell weiterhin als historische SOLL-Referenz im Reihenplan; '+
 'sie dürfen nicht erneut angefordert oder als Arbeitsphase geplant werden. '+
 'Freitext-Reflexionsnotizen bleiben ausschließlich lokal.\n';
}
return {policy,outcomes,decisionMap,noNewPrint,suppressInPlanning,shareable,simpleStatus,prompt};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_WORKSHEET_FLOW_V306;