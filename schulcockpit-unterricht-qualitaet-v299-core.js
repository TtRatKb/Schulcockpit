/* V0.29.9 – keep researched/teacher-proposed image briefs across lesson
 * import and browser reloads by storing them in the existing notes field.
 * No remote image fetching and no fabricated image licences.
 */
const SC_LESSON_QUALITY_V299=(function(){
'use strict';
function str(x,max=450){return String(x||'').trim().slice(0,max);}
function enrich(raw,normalized){
 const slides=(raw?.slides||[]),out=normalized;
 if(!Array.isArray(out?.slides))return out;
 let offset=0;
 for(let i=0;i<out.slides.length;i++){
  const sl=out.slides[i];
  let source=slides[offset]||{};
  if(str(source.title)!==str(sl.title)){
   const next=slides.findIndex((x,n)=>n>=offset&&str(x?.title)===str(sl.title));
   if(next>=0)source=slides[next],offset=next;
  }
  offset++;
  const hint=str(source.imageSuggestion||source.imageSearch||source.imageIdea,300);
  if(!hint)continue;
  const link=str(source.imageSource||source.imageUrl||'',450);
  const rights=str(source.imageLicense||source.imageRights||'',200);
  const alt=str(source.imageAlt||'',250);
  const location='Folie '+(i+1)+' („'+(sl.title||'Bildimpuls')+'“) – Bildvorschlag: '+hint;
  const appendix='\n[BILDVORSCHLAG – NICHT AUTOMATISCH EINGEFÜGT]\n'+location+
   (alt?'\nBeschreibung: '+alt:'')+
   (link?'\nQuelle/Link (durch Lehrkraft prüfen): '+link:'')+
   (rights?'\nRechteangabe (prüfen): '+rights:'')+
   '\nVor dem Unterricht ein rechtlich nutzbares PNG/JPG in den Materialhub legen und auf der Folie ergänzen.';
  sl.notes=(str(sl.notes,1300)+appendix).trim().slice(0,2000);
  if(/bildimpuls|^bild$/.test(sl.type)&&!sl.imageMaterial){
   // An unresolvable imageMaterial makes the existing Momiji generator abort.
   // A text slide has space for manually inserting the future visual and notes
   // record exactly where it belongs.
   sl.type='text';
   sl.content=['Bildimpuls vorbereiten – Bild auf dieser Folie ergänzen'];
  }
 }
 return out;
}
function inspect(pkg){
 const phases=pkg?.phases||[],slides=pkg?.slides||[],issues=[];
 const work=phases.filter(x=>/erarbeitung|übung/i.test(x.phase||''));
 const workSlides=slides.filter(s=>/arbeitsauftrag/i.test(s.type||''));
 if(work.length>2)issues.push('Mehr als zwei Erarbeitungs-/Übungsphasen. Prüfe, ob ein zusammenhängender Arbeitsblock sinnvoller ist.');
 if(workSlides.length>Math.max(1,work.length))
  issues.push('Mehr Aufgabenfolien als Erarbeitungsphasen. Für gleichzeitig benötigte Arbeitsaufträge genügt eine Folie pro Phase.');
 if(slides.filter(s=>/top.?flop/i.test(s.type||'')).length===2)
  issues.push('Genau zwei Top-/Flop-Aussagen. Das ist kein Pflichtformat – prüfe, ob ein anderer Einstieg oder ein sinnvoller längerer Block besser wäre.');
 if(slides.some(s=>/bildimpuls/i.test(s.type||'')&&!s.imageMaterial))
  issues.push('Ein Bildimpuls enthält noch keine verknüpfte PNG/JPG-Datei. Der bestehende PPT-Export braucht ein echtes lokales Bild.');
 return issues;
}
return {enrich,inspect};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_LESSON_QUALITY_V299;