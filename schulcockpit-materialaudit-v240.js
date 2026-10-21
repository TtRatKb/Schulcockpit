/* Schulcockpit V0.24.0 – rückwirkende Material-Nachsortierung und Bestandsprüfung.
   Best-effort metadata classification, no invented file contents or class work dates.
   Existing catalog IDs, file keys, archives, actual lessons and assessments preserved. */
(function(){
'use strict';
const TYPES=[
 ['arbeitsblatt','Arbeitsblätter'],
 ['werkstatt','Mathewerkstatt / Stationen'],
 ['arbeitsblattloesung','Lösungen zu Arbeitsblättern'],
 ['werkstattloesung','Lösungen zur Werkstatt'],
 ['klausurloesung','Lösungen zu Klassenarbeiten'],
 ['loesung','Weitere Lösungen'],
 ['referenzarbeit','Referenz-Klassenarbeiten'],
 ['inklusion','Inklusionsarbeiten'],
 ['klassenarbeit','Klassenarbeiten / Klausuren'],
 ['ersatzleistung','Ersatzleistungen'],
 ['reihenplanung','Reihenplanungen / Themenkarten'],
 ['praesentation','Präsentationen'],
 ['quelle','Quellen und Hintergrund'],
 ['sonstiges','Weitere Dateien']
];
function n(s){return String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/ß/g,'ss').replace(/[\u2500-\u257f]/g,' ').replace(/[^a-z0-9]+/g,' ').trim();}
function contains(s,re){return re.test(n(s));}
function classify(e){
 const path=String(e?.sourcePath||e?.sourceArchive||'').replace(/\\/g,'/');
 const name=String(e?.fileName||e?.title||path.split('/').pop()||'');
 const all=n(path+' '+name),base=n(name),parts=path.split('/').map(n);
 const testDir=parts.some(p=>/klassenarbeit|klausur|lernkontrolle|prufung|arbeit nr|\bka\s*\d|\barbeit\s*$|klassen arbeiten/.test(p));
 const testFile=/klassenarbeit|klausur|lernkontrolle|lernerfolgskontrolle|prufung|arbeit nr|\bka\s*\d/.test(base);
 const isExam=testFile||testDir||e?.scope==='assessment';
 const isSolution=/losung|loesung|lo.{0,8}sung|erwartungshorizont|musterlosung|bewertungsraster|korrekturhilfe|solution/.test(all)
   ||parts.some(p=>/^eh$|^e h$|^losungen$/.test(p));
 const isWorkshop=/mathewerkstatt|mathematische werkstatt|stationenlernen|lernwerkstatt|lerntheke|stationsarbeit/.test(all);
 const include=/inklusion|\binkl\b|^le \b|\ble arbeit\b|lernentwicklung|i niveau/.test(all);
 if(isSolution){if(isExam)return 'klausurloesung';if(isWorkshop)return 'werkstattloesung';if(/arbeitsblatt|uebungsblatt|ubungsblatt|\bab \d|fachbegriff|grundaufgaben|wiederholung|knobel|aufgabenblatt/.test(all))return 'arbeitsblattloesung';return 'loesung';}
 if(isExam)return include?'inklusion':'referenzarbeit';
 if(/ersatzleistung|kreativleistung|lapbook|trauerglas|leistungsprodukt/.test(all))return 'ersatzleistung';
 if(/themenkarte|reihenplanung|sequenzplanung|stoffverteilungsplan|jahresplan|unterrichtsreihe/.test(base))return 'reihenplanung';
 if(isWorkshop)return 'werkstatt';
 if(/arbeitsblatt|uebungsblatt|ubungsblatt|ubung|aufgabenblatt|\bab \d|fachbegriff|grundaufgaben|wiederholung|knobel|rechenregeln|stellenwerttafel/.test(base))return 'arbeitsblatt';
 if(/\.(pptx?|potx|key)$/i.test(name)||/prasentation|powerpoint|folien/.test(base))return 'praesentation';
 if(/quelle|hintergrund|weltbild|bibeltext|sachtext|infotext/.test(all))return 'quelle';
 return 'sonstiges';
}
function loc(e){
 const h=e?.hubV237||e?.hubV240||{}, parts=[e?.courseLabel,e?.sourcePath,e?.sourceArchive,e?.fileName,e?.title].filter(Boolean);
 let subject=h.subject||'',grade=Number(h.grade)||0;
 if(!subject)for(const p of parts){
   if(/\breligion\b|\breli\b/i.test(p)){subject='Religion';break;}
   if(/\bmathe\b|\bmathematik\b/i.test(p)){subject='Mathematik';break;}
 }
 if(!grade)for(const p of parts){
   const s=String(p).replace(/\\/g,'/');
   const m=s.match(/(?:klasse|jahrgang|stufe|jg\.?|mathematik|mathe|religion|reli)\s*[._ /-]*0?(1[0-3]|[5-9])(?=[a-z]?(?:[^0-9]|$))/i)
     ||s.match(/(?:^|\/)0?(1[0-3]|[5-9])[a-z]?(?=\/|$)/i);
   if(m){grade=Number(m[1]);break;}
 }
 return {subject:['Mathematik','Religion'].includes(subject)?subject:'',grade:grade>=5&&grade<=13?grade:0};
}
function status(e){
 if(e?.disposition==='excluded'||e?.hubV237?.status==='excluded')return 'excluded';
 return e?.hubV237?.status||(['backlog','lesson_candidate'].includes(e?.scope)?'unassigned':'pool');
}
function recommendation(e){
 const ident=loc(e),prev=e.hubV237||{},manual=!!prev.reviewedAt;
 const classified=classify(e),kind=manual&&prev.kind&&prev.kind!=='sonstiges'?prev.kind:classified;
 const oldStatus=status(e),newStatus=oldStatus==='unassigned'&&ident.subject&&ident.grade?'pool':oldStatus;
 const typeChanged=kind!==prev.kind&&(classified!=='sonstiges'||!prev.kind);
 const statusChanged=newStatus!==oldStatus;
 const locChanged=(ident.subject&&ident.subject!==prev.subject)||(ident.grade&&ident.grade!==Number(prev.grade));
 const relevant=typeChanged||statusChanged||locChanged;
 const confident=!!ident.subject&&!!ident.grade;
 return {kind,oldStatus,newStatus,subject:ident.subject,grade:ident.grade,typeChanged,statusChanged,locChanged,
   manual,confident,relevant,uncertain:!confident||kind==='sonstiges'};
}
function bucket(e){
 const r=recommendation(e),h=e?.hubV240||{};
 return h.auditOverrideType||r.kind||'sonstiges';
}
function counts(xs){
 const by=Object.fromEntries(TYPES.map(x=>[x[0],0]));
 for(const e of xs)by[bucket(e)]=(by[bucket(e)]||0)+1;
 return {total:xs.length,by,classified:xs.length-(by.sonstiges||0)};
}
function label(kind){return TYPES.find(x=>x[0]===kind)?.[1]||'Weitere Dateien';}
if(typeof module!=='undefined'&&module.exports){module.exports={classify,loc,status,recommendation,bucket,counts,label};return;}
let previewOpen=false,busy=false;
function all(){
 const result=[...(state.materialCatalog||[]).map(e=>({e,type:'catalog'}))];
 for(const m of state.materials||[]){
   if(m.catalogId&&(state.materialCatalog||[]).some(e=>e.catalogId===m.catalogId))continue;
   const a=(m.assignments||[])[0],course=cls(a?.classId);
   result.push({e:{...m,courseLabel:course?course.subject+' '+course.name:'',sourcePath:m.source||'',hubV237:m.hubV237||{}},type:'material',original:m});
 }
 return result;
}
function planned(){
 const arr=all().filter(x=>x.e.disposition!=='excluded').map(x=>({...x,r:recommendation(x.e)}));
 return {arr,will:arr.filter(x=>x.r.relevant&&x.r.confident&&!x.r.manual),
   reviewed:arr.filter(x=>x.r.relevant&&x.r.confident&&x.r.manual&&x.r.statusChanged),
   open:arr.filter(x=>!x.r.confident||x.r.uncertain)};
}
function visibleFolder(){
 const b=document.querySelector('[data-v237-folder].active');
 if(b)return b.dataset.v237Folder?.split('|')||[];
 const label=document.querySelector('#v237-subject')?.value||'';
 const grade=Number(document.querySelector('#v237-grade')?.value)||0;
 return [label,grade];
}
function folderStats(){
 const [subject,grade]=visibleFolder();
 if(!subject||!grade)return '';
 const allEntries=all().filter(({e})=>{const a=loc(e);return a.subject===subject&&a.grade===Number(grade);});
 const active=allEntries.filter(({e})=>e.disposition!=='excluded'&&
   (!e.hubV238||e.hubV238.isPreferred!==false||e.hubV238.promoted));
 const sum=counts(active.map(x=>x.e)),unclassified=sum.by.sonstiges||0;
 const b=active.filter(({e})=>status(e)==='unassigned').length;
 const values=TYPES.map(([t,title])=>'<div><strong>'+sum.by[t]+'</strong><span>'+title+'</span></div>').join('');
 return '<section class="panel v240-audit"><div class="section-head"><div><span class="eyebrow">GESAMTBESTAND · '+esc(subject)+' '+Number(grade)+'</span>'
   +'<h2>Alle '+sum.total+' Einträge nach Materialart</h2></div></div>'
   +'<p class="microcopy">Jeder Eintrag wird genau einmal gezählt. „Weitere Dateien“ und nicht eingeplante Dokumente bleiben sichtbar – nichts verschwindet aus der Statistik.</p>'
   +'<div class="v240-kind-grid">'+values+'</div><p class="microcopy">'+b+' formal noch nicht eingeordnet · '
   +unclassified+' ohne sicher erkennbare Materialart · '+sum.classified+' einer konkreten Materialart zugeordnet. '
   +'Die Zuordnung basiert auf Dateipfad und Namen, nicht auf einer inhaltlichen Dokumentprüfung.</p></section>';
}
function exactTeachingSequence(e,r){
 if(!r.confident||!e.sequenceTitle)return null;
 const title=n(e.sequenceTitle);
 const matches=(state.sequences||[]).filter(q=>{
   const c=cls(q.classId);
   return !!c&&n(q.title)===title&&v202Grade(c)===r.grade
     &&v202SubjectKey(c)===(r.subject==='Mathematik'?'mathematik':'religion');
 });
 if(matches.length!==1)return null;
 const q=matches[0],course=cls(q.classId);
 // Do not silently substitute a different explicitly named course.
 const explicitCourse=n(e.courseLabel||''),courseName=n(course.subject+' '+course.name);
 if(explicitCourse&&explicitCourse!==n(course.subject+' '+r.grade)&&explicitCourse!==courseName
   &&!explicitCourse.endsWith(' '+title))return null;
 return {courseId:course.id,sequenceId:q.id};
}
function modalPreview(){
 const p=planned(),groups={};
 for(const x of p.will)groups[x.r.kind]=(groups[x.r.kind]||0)+1;
 return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-xwide v240-modal" data-modal-stop>'
   +'<header class="modal-header"><div><span class="eyebrow">BESTAND AUTOMATISCH AUFRÄUMEN</span><h2>Einmalig vorhandene Dateien nachsortieren</h2></div>'
   +'<button class="icon-button" data-action="modal-close">×</button></header><div class="modal-body">'
   +'<p>Die Vorschläge beruhen auf vorhandenen Fach-/Jahrgangsangaben, Ordnernamen, Unterrichtsreihentiteln und Materialdateinamen. Sie verändern keine Originaldatei, Stundenplanung oder Prüfungstermine.</p>'
   +'<div class="v240-preview-nums"><div><strong>'+p.will.length+'</strong><span>automatisch übernehmbare Vorschläge</span></div>'
   +'<div><strong>'+p.reviewed.length+'</strong><span>bereits manuell bearbeitet, noch als offen markiert</span></div>'
   +'<div><strong>'+p.open.length+'</strong><span>ohne sichere Fach-/Jahrgangs- oder Typ-Angabe</span></div></div>'
   +'<p>Vorgeschlagene Materialarten: '+esc(Object.entries(groups).map(([k,v])=>label(k)+' '+v).join(' · ')||'keine')+'</p>'
   +'<label class="v240-legacy-choice"><input type="checkbox" id="v240-fix-reviewed" checked> Bereits von dir mit Fach/Jahrgang bearbeitete Einträge ebenfalls aus „Noch einzuordnen“ in den Jahrgangspool übernehmen</label>'
   +'<details><summary>Beispiele der Zuordnung ansehen</summary><div class="v240-samples">'
   +p.will.slice(0,25).map(x=>'<p><strong>'+esc(x.e.fileName)+'</strong><small>'+esc(x.r.subject+' '+x.r.grade+' → '+label(x.r.kind)+(x.r.newStatus==='pool'?' · Jahrgangspool':''))+'</small></p>').join('')
   +'</div></details><p class="microcopy">Ein „Reihenname“ allein bedeutet nicht, dass schon eine vorhandene Unterrichtsreihe verknüpft ist. Das Dokument wird in diesem Fall fachlich im Jahrgangspool einsortiert und im Jahresplanungs-Katalog sichtbar, ohne einen Termin zu erfinden. Nicht eindeutige Fälle bleiben zur Prüfung.</p>'
   +'<div class="v237-actions"><button class="secondary" data-action="modal-close">Abbrechen</button><button class="primary" data-v240-apply>Vorschläge gesammelt übernehmen</button></div>'
   +'</div></section></div>';
}
async function apply(){
 if(busy)return;
 busy=true;
 const before=clone(state.materialCatalog||[]),materialsBefore=clone(state.materials||[]),p=planned(),fix=document.getElementById('v240-fix-reviewed')?.checked!==false;
 const work=[...p.will,...(fix?p.reviewed:[])];
 const backup={
  date:new Date().toISOString(),kind:'schulcockpit.catalog.before-automap.v240',
  entries:work.map(x=>({catalogId:x.e.catalogId,scope:x.e.scope,disposition:x.e.disposition,
   courseLabel:x.e.courseLabel,sequenceTitle:x.e.sequenceTitle,hubV237:x.e.hubV237||null}))
 };
 let changed=0;
 try{
   if(work.length)downloadText('Schulcockpit_Materialzuordnung_vorher_'+Date.now()+'.json',JSON.stringify(backup,null,2),'application/json');
   for(const {e,r,type,original} of work){
     const target=type==='material'?original:e,old=target.hubV237||{};
     const matched=type==='catalog'?exactTeachingSequence(e,r):null;
     target.hubV237={...old,subject:r.subject,grade:r.grade,
       kind:r.manual&&old.kind&&old.kind!=='sonstiges'?old.kind:r.kind,
       status:matched?'assigned':r.newStatus,
       courseId:old.courseId||matched?.courseId||'',sequenceId:old.sequenceId||matched?.sequenceId||'',
       autoClassifiedV240:true};
     if(type==='catalog'&&r.newStatus==='pool'&&['backlog','lesson_candidate'].includes(e.scope))e.scope='sequence_pool';
     changed++;
   }
   await persistCatalogV171();await saveState();previewOpen=false;modal=null;render();
   alert(changed+' vorhandene Materialeinträge nachsortiert. Fach-/Jahrgangspool statt offener Eingang; weitere ungeklärte Materialarten sind weiterhin sichtbar.');
 }catch(err){state.materialCatalog=before;state.materials=materialsBefore;
   try{await persistCatalogV171();await saveState();}catch(rollback){console.error('Rücknahme konnte nicht bestätigt werden',rollback);}
   throw err;
 }finally{busy=false;}
}
const beforeView=materialsView;
materialsView=function(){
 const html=beforeView();
 const p=planned();
 const newButton='<button class="primary" data-v240-review>✨ '+(p.will.length+p.reviewed.length)+' Dateien automatisch nachsortieren</button>';
 let out=html.replace('>Material ohne Datei anlegen</button>','>Material ohne Datei anlegen</button>'+newButton);
 const box=folderStats();
 if(box)out=out.replace('<section class="panel v237-list">',box+'<section class="panel v237-list">');
 return out;
};
const beforeModal=modalHtml;
modalHtml=function(){return modal?.type==='v240Preview'?modalPreview():beforeModal();};
const beforeWire=wire;
wire=function(){
 beforeWire();
 document.querySelector('[data-v240-review]')?.addEventListener('click',()=>{modal={type:'v240Preview'};previewOpen=true;render();});
 document.querySelector('[data-v240-apply]')?.addEventListener('click',e=>{e.currentTarget.disabled=true;apply().catch(err=>{alert('Zuordnung nicht abgeschlossen: '+(err.message||err));render();});});
};
const beforeRender=render;
render=function(){beforeRender();const v=document.querySelector('.brand small');if(v)v.textContent=state.settings.schoolYear+' · V0.24.0';};
})();