/* V0.31.0 – temporary course plan interchange; pure validation, no browser state. */
const SC_TEMP_PACKAGE_V310=(function(){
'use strict';
const SCHEMA='schulcockpit.temporary-course.v1';
const s=(x,max=2000)=>String(x??'').trim().slice(0,max);
function horizon(settings,now){
 const C=SC_TEMP_COURSE_V307,first=now>settings.startDate&&(!settings.endDate||now<=settings.endDate)?now:settings.startDate;
 const last=C.plusDay(first,27);
 return {start:first,end:settings.endDate&&settings.endDate<last?settings.endDate:last};
}
function rowsForCourse(group,lessons,materials,period){
 const cfg=SC_TEMP_COURSE_V307.config(group.temporaryV307);
 const active=(lessons||[]).filter(l=>l.quickGroupIdV307===group.id&&
  l.date>=period.start&&l.date<=period.end&&!l.quickDisabledV307)
  .sort((a,b)=>a.date.localeCompare(b.date)||Number(a.slot)-Number(b.slot));
 const refs=[...new Set([...cfg.courseMaterials,...active.flatMap(l=>l.quickMaterialRefsV307||[])])];
 const items=refs.map(ref=>(materials||[]).find(m=>m.ref===ref)||
  {ref,name:ref,ready:false,kind:'Nicht aufgelöst'});
 return {cfg,lessons:active,materials:items};
}
function instructions(){
 return '# Kursplanung – so geht es weiter\n\n'+
  '1. Lade diese ZIP-Datei bei ChatGPT hoch. Die Originale stehen im Ordner materialien/; fehlende Dateien sind im Manifest gekennzeichnet.\n'+
  '2. Füge den vollständigen Inhalt von 01_CHATGPT_PROMPT.md in denselben Chat ein. Die Datei ist zusätzlich im Cockpit per Klick kopierbar.\n'+
  '3. Lass ChatGPT einen einzigen SCHULCOCKPIT_COURSE_IMPORT-Block zurückgeben; nichts manuell in die Einzelstunden übertragen.\n'+
  '4. Kopiere die komplette ChatGPT-Antwort zurück ins Schulcockpit unter Kurzunterricht → Vier Wochen planen → Antwort prüfen → Planungen übernehmen.\n'+
  '5. Öffne die Stunden in „Meine Woche“ oder im Montagsmodus. Bei Stunden mit Folienplan dort „PowerPoint erstellen & herunterladen“ wählen.\n\n'+
  'Die ZIP enthält keine echten Aufgabeninhalte für Materialien, deren Originaldateien fehlen. Solche Inhalte nicht erfinden.\n';
}
function prompt(group,payload){
 const cfg=payload.settings,entries=payload.lessons,materials=payload.materials;
 const expected={schema:SCHEMA,groupId:group.id,lessons:[{
  id:'EXAKTE STUNDEN-ID AUS 02_KURSPLAN.json',date:'YYYY-MM-DD',slot:0,
  title:'Spezifisches Stundenthema statt Reihentitel',objective:'Kurzes Ziel',
  entry:'Konkreter kurzer Einstieg mit inhaltlich belegten Fragen',
  work:'Genaue Arbeitsanweisung zu vorhandenen Materialien',
  end:'Kurze Sicherung',materialRefs:['m:ID_AUS_MANIFEST'],
  presentationRequired:true,
  phases:[{phase:'Einstieg',minutes:5,title:'...',details:'...'},
   {phase:'Erarbeitung',minutes:30,title:'...',details:'...'},
   {phase:'Sicherung',minutes:10,title:'...',details:'...'}],
  slides:[{type:'text',title:'Einstieg',content:['...'],notes:''},
   {type:'arbeitsauftrag',title:'Arbeitsauftrag',content:['...'],notes:''}],
  footer:'Kurzes Tagesthema'
 }]};
 return '# Schulcockpit – befristeten Kurs verbindlich planen\n\n'+
  'Die ZIP wurde DIREKT aus dem lokalen Materialhub erstellt. Lies 02_KURSPLAN.json, 03_MATERIALMANIFEST.json und die beigefügten Originaldateien zuerst.\n'+
  'Fach: '+s(group.subject,100)+' · Lerngruppe: '+s(group.grade,100)+
  '\nKurs: '+s(group.title,200)+'\nZeitfenster: '+payload.period.start+' bis '+payload.period.end+
  '\nReihenthema (NICHT automatisch Stundenthema): '+s(cfg.topic,400)+
  '\nArbeitsmodus: '+s(cfg.workMode,700)+'\nHinweise: '+s(cfg.note,700)+
  '\nPrüfung: '+(cfg.examDate?cfg.examDate+' '+cfg.examTitle:'keine eingetragen')+
  '\n\n## Verbindliche Stunden\n'+entries.map(l=>{
   const d=l.quickDraftV307||{},refs=l.quickMaterialRefsV307||[];
   return '- '+l.id+' | '+l.date+' | Block '+(Number(l.slot)+1)+
    (l.quickExamV307?' | PRÜFUNG':'')+
    '\n  bisheriges Thema: '+s(d.topic||l.title,200)+
    '\n  Einstieg: '+s(d.entry,650)+
    '\n  Verbindliche Arbeit: '+s(d.work||l.objective,1000)+
    '\n  Sicherung: '+s(d.end,650)+
    '\n  Ausgewählte Materialien: '+(refs.join(', ')||'keine explizit ausgewählt');
  }).join('\n')+
  '\n\n## Materialien (genaue Verfügbarkeit im ZIP-Manifest)\n'+
  (materials.length?materials.map(m=>'- '+m.ref+': '+s(m.name,240)+' ['+s(m.kind,80)+']'+
   (m.ready?'':' – Original möglicherweise nicht vorhanden')).join('\n'):'- Keine Materialien hinterlegt.')+
  '\n\n## Unterrichtliche Regeln\n'+
  'Plane ALLE noch nicht gehaltenen Termine, ohne Daten, Blöcke oder IDs umzubenennen. '+
  'Benenne für jede Stunde ein EIGENES passendes Stundenthema. Das Reihenthema darf nicht pauschal wiederholt werden. '+
  'Prüfungstermine haben Vorrang; keine reguläre Erarbeitung am Prüfungstag.\n'+
  'Bereits für eine Stunde ausdrücklich ausgewählte Arbeitsblätter, Buch-/Arbeitsheftaufgaben und handschriftliche Arbeitsaufträge sind VERBINDLICH. '+
  'Keine selbst erfundenen Heftaufgaben statt vorhandener Buch- oder Arbeitsheftaufträge. '+ 
  'Materialreferenzen in materialRefs nur aus 03_MATERIALMANIFEST.json übernehmen. '+
  'Fehlende Originalseiten nicht als gelesen darstellen. Bei unbekannten Inhalten allgemein formulieren und auf die angegebene Seite/Datei verweisen. '+
  'Einstieg fachlich passend und knapp (z. B. 5–8 Minuten), danach überwiegend eigenständige Arbeit an den echten Materialien. '+
  'Für jede Stunde einen realistisch kurzen Abschluss vorsehen.\n'+
  'Für jede normale Stunde eine KURZE PowerPoint im vorhandenen Schulcockpit-Momiji-Master ermöglichen: Einstieg, Arbeitsauftrag, ggf. Sicherung; '+
  'dafür presentationRequired=true und 2–6 fachlich begründete slides erzeugen. Nur bei bewusst ungeeigneten Terminen '+
  '(z. B. Klausur) presentationRequired=false setzen. Keine fertig ausgefüllten Sicherungslösungen auf sichtbare Folien; diese in notes. '+
  'Die Lehrkraft kann im Cockpit anschließend selbst für jede Stunde „Keine PPT nötig“ wählen.\n'+
  'Neue Curriculumsinhalte nicht als verbindlich ausgeben. Wenn die Quellen nichts belegen, keine erfundene Kompetenz zuordnen.\n\n'+
  '## VERBINDLICHER RÜCKIMPORT\n'+
  'Gib zuerst eine gut lesbare kurze Stundenübersicht aus. Danach exakt EINEN gültigen JSON-Block im Format unten, '+ 
  'für JEDE noch offene Nicht-Klausurstunde und bei Bedarf die Klausur. '+
  'Alle ids, dates und slots müssen 1:1 aus 02_KURSPLAN.json stammen. Keine Markdown-Codefences innerhalb des Blocks. '+
  'slides verwenden Schulcockpit-Typen wie text, arbeitsauftrag, fehlerdetektiv, topflop und sicherung; bei letzterer Lösungen nur in notes.\n'+
  '<SCHULCOCKPIT_COURSE_IMPORT>\n'+JSON.stringify(expected,null,2)+
  '\n</SCHULCOCKPIT_COURSE_IMPORT>\n';
}
function extract(raw){
 const text=s(raw,250000);
 const m=text.match(/<SCHULCOCKPIT_COURSE_IMPORT>\s*([\s\S]*?)\s*<\/SCHULCOCKPIT_COURSE_IMPORT>/i);
 if(!m)throw Error('SCHULCOCKPIT_COURSE_IMPORT fehlt. Bitte die vollständige ChatGPT-Antwort kopieren.');
 try{return JSON.parse(m[1]);}catch{throw Error('Der Rückimport-Block enthält kein gültiges JSON.');}
}
function parse(raw,group,available,allowedRefs){
 const x=typeof raw==='string'?extract(raw):raw;
 if(x?.schema!==SCHEMA)throw Error('Falsches Kursimport-Schema.');
 if(x.groupId!==group.id)throw Error('Der Import gehört zu einem anderen Kurs. Es wurden keine Stunden verändert.');
 if(!Array.isArray(x.lessons)||!x.lessons.length||x.lessons.length>50)
  throw Error('Bitte 1 bis 50 Stunden zurückgeben.');
 const byId=new Map((available||[]).map(l=>[l.id,l])),seen=new Set(),allowed=new Set(allowedRefs||[]),out=[];
 for(const item of x.lessons){
  if(!item||typeof item!=='object'||seen.has(item.id))throw Error('Doppelte oder ungültige Stunden-ID im Import.');
  seen.add(item.id);
  const old=byId.get(item.id);
  if(!old||old.date!==item.date||Number(old.slot)!==Number(item.slot))
   throw Error('Stunden-ID, Datum oder Block nicht im ausgewählten Kurszeitraum: '+s(item.id,120));
  if(!s(item.title,250))throw Error('Jede Stunde benötigt ein eigenes Thema: '+old.date);
  if(item.presentationRequired!==true&&item.presentationRequired!==false)
   throw Error('PowerPoint-Entscheidung fehlt für '+old.date);
  const refs=Array.isArray(item.materialRefs)?item.materialRefs:[];
  if(refs.length>40||refs.some(x=>!allowed.has(x)))
   throw Error('Der Plan enthält eine nicht im Kurs vorgemerkte Material-ID: '+old.date);
  if(!Array.isArray(item.phases)||!item.phases.length||item.phases.length>15)
   throw Error('Es fehlen konkrete Unterrichtsphasen für '+old.date);
  if(!Array.isArray(item.slides)||item.slides.length>30||
    item.presentationRequired&&!item.slides.length)
   throw Error('Für die benötigte PowerPoint fehlen Folien: '+old.date);
  out.push({id:old.id,date:old.date,slot:old.slot,
   title:s(item.title,250),objective:s(item.objective,1400),
   entry:s(item.entry,1200),work:s(item.work,2200),end:s(item.end,1200),
   footer:s(item.footer,120),materialRefs:refs,
   presentationRequired:item.presentationRequired,
   phases:item.phases,slides:item.slides});
 }
 return out;
}
return {SCHEMA,horizon,rowsForCourse,instructions,prompt,extract,parse};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SC_TEMP_PACKAGE_V310;
