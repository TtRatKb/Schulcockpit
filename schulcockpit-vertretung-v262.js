/* Schulcockpit V0.26.2 – Vertretungsmodus. Fachunterricht bleibt erhalten; Dateien lokal. */
(function(){
'use strict';
const LIMIT=300;
let selectedKey='',selectedYear='',items=[];
function currentYear(){return v190NormYear(view==='school-calendar'?(v190CalendarDraft?.year||state.settings.schoolYear):(selectedYear||state.settings.schoolYear));}
function nextDate(s){const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+1);return iso(d);}
function id(e){return e.date+'|'+e.classId+'|'+e.slot;}
function course(e){return (state.classes||[]).find(c=>c.id===e.classId);}
function saved(e){return (state.substitutionPlansV262||{})[id(e)]||{};}
function candidates(y){
  if(y!==v190NormYear(state.settings.schoolYear)&&!v190Calendar(y).useCurrentTimetable)return [];
  const closure=v190CalendarRanges(y).filter(x=>x.impactV262==='substitution').map(x=>({...x,scope:'school'}));
  const specific=v261CourseRanges(y).filter(x=>x.impactV262==='substitution').map(x=>({...x,scope:'course'}));
  const tt=(state.timetable||[]).filter(t=>t.classId&&Number(t.weekday)>=1&&Number(t.weekday)<=5);
  const bounds=v190YearBounds(y),out=new Map();
  for(const r of [...closure,...specific]){
    let d=r.start>bounds.start?r.start:bounds.start;
    const end=r.end<bounds.end?r.end:bounds.end;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!/^\d{4}-\d{2}-\d{2}$/.test(end))continue;
    for(let j=0;j<370&&d<=end;j++,d=nextDate(d)){
      const weekday=new Date(d+'T12:00:00').getDay()||7;
      for(const t of tt){
        if(Number(t.weekday)!==weekday||(r.scope==='course'&&r.classId!==t.classId)||v190NoSchoolInfo(d,t.classId))continue;
        const e={date:d,classId:t.classId,slot:Number(t.slot)||0,timetableId:t.id||'',period:t.period||'',reason:r.name||'Abwesenheit'};
        if(!out.has(id(e)))out.set(id(e),e);
      }
    }
  }
  return [...out.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.slot-b.slot||a.classId.localeCompare(b.classId)).slice(0,LIMIT);
}
function lessonFor(e){return (state.lessons||[]).find(l=>l.date===e.date&&l.classId===e.classId&&l.timetableId===e.timetableId)||
  (state.lessons||[]).find(l=>l.date===e.date&&l.classId===e.classId&&Number(lessonSlot(l))===e.slot);}
function context(e){
  const l=lessonFor(e),q=l?.sequenceId?seq(l.sequenceId):null;
  const u=l?.planReference||(state.sequences||[]).filter(x=>x.classId===e.classId).flatMap(x=>x.plan||[]).find(x=>x.plannedDate===e.date)||{};
  const prev=(state.lessons||[]).filter(x=>x.classId===e.classId&&x.date<e.date&&v182IsHeld(x)).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const exam=(state.assessments||[]).some(x=>x.classId===e.classId&&x.date===e.date);
  return {l,q,u,prev,exam,topic:u.title||l?.title||'Thema noch nicht festgelegt'};
}
function label(e){const c=course(e);return (c?.subject||'Fach')+' · '+(c?.name||'Kurs')+' · '+fmtDate(e.date)+' · Stunde '+e.slot;}
function list(y,inline){
  items=candidates(y);
  const pending=items.filter(e=>!saved(e).prepared&&!v182IsHeld(lessonFor(e))).length;
  return '<section class="panel v262-panel"><div class="section-head"><div><span class="eyebrow">UNTERRICHT TROTZ ABWESENHEIT</span><h2>Vertretungsmodus</h2><p>'+pending+' Vertretungsstunde'+(pending===1?'':'n')+' noch vorzubereiten</p></div>'+
    (inline?'<button type="button" class="secondary" data-v262-page>Alle Vertretungen →</button>':'')+'</div>'+
    '<p>Vertretungsstunden bleiben im Sollplan. Erstelle dazu selbstständig bearbeitbare Aufgaben statt einer PowerPoint und hinterlege die fertigen Dateien lokal.</p>'+
    (items.length?'<div class="v262-list">'+items.map(e=>{
      const x=context(e),p=saved(e),held=v182IsHeld(x.l);
      return '<article class="v262-item"><div><strong>'+esc(label(e))+'</strong><small>'+esc(e.reason)+' · '+esc(x.topic)+'</small>'+
        (x.exam?'<small class="v262-warn">Fester Leistungsnachweis am selben Tag – bitte Durchführung prüfen.</small>':'')+'</div>'+
        '<div><span class="pipeline-chip '+(p.prepared?'ok':'open')+'">'+(held?'Bereits gehalten':p.prepared?'✓ Vorbereitet':p.instructions?'Entwurf':'Offen')+'</span> '+
        '<button type="button" class="'+(p.prepared?'secondary':'primary')+'" data-v262-edit="'+esc(id(e))+'">Vorbereiten</button></div></article>';
    }).join('')+'</div>':'<p>Noch keine betroffenen Fachstunden. Trage im Schulkalender eine Abwesenheit ein oder ändere einen bestehenden Termin auf „Vertretung nötig“.</p>')+
    (items.length===LIMIT?'<p class="v262-warn">Es werden höchstens '+LIMIT+' Fachstunden angezeigt; längere Zeiträume bitte aufteilen.</p>':'')+'</section>';
}
function page(){
  const y=currentYear();
  return '<div class="content-grid v262-page"><section class="panel"><div class="section-head"><div><span class="eyebrow">SCHULCOCKPIT</span><h2>Vertretung vorbereiten</h2></div><label>Schuljahr<select id="v262-year">'+v190YearOptions().map(x=>'<option value="'+esc(x)+'" '+(x===y?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label></div>'+
    '<p>Für Krankheit oder SchILF: Markiere den Termin im Schulkalender als „Vertretung nötig“. Die betroffenen Fachstunden erscheinen automatisch hier.</p><button class="secondary" type="button" data-v262-calendar>Schulkalender öffnen →</button></section>'+list(y,false)+'</div>';
}
function chosen(){return items.find(x=>id(x)===selectedKey)||candidates(currentYear()).find(x=>id(x)===selectedKey);}
function modalPage(){
  const e=chosen();if(!e)return '<div class="modal-backdrop" data-action="modal-close"><section class="modal" data-modal-stop>Die Vertretungsstunde wurde im aktuellen Kalender nicht gefunden.</section></div>';
  const p=saved(e),x=context(e),files=p.files||[];
  return '<div class="modal-backdrop" data-action="modal-close"><section class="modal modal-wide v262-modal" data-modal-stop><header class="modal-header"><div><span class="eyebrow">VERTRETUNGSSTUNDE · '+esc(e.reason)+'</span><h2>'+esc(label(e))+'</h2></div><button class="icon-button" type="button" data-action="modal-close">×</button></header><div class="modal-body">'+
    '<p><strong>Soll-Thema:</strong> '+esc(x.topic)+(x.q?' · '+esc(x.q.title):'')+'</p>'+
    (x.exam?'<p class="v262-warn">An diesem Tag ist ein Leistungsnachweis geplant. Bitte vor einer Vertretung den Ablauf abstimmen; der Prüfungstermin wird nicht verändert.</p>':'')+
    '<div class="v262-fields"><label>Thema<input id="v262-topic" maxlength="200" value="'+esc(p.topic||x.topic)+'"></label>'+
    '<label>Dauer<select id="v262-minutes"><option value="45" '+(p.minutes===90?'':'selected')+'>45 Minuten</option><option value="90" '+(p.minutes===90?'selected':'')+'>90 Minuten</option></select></label></div>'+
    '<label>Arbeitsauftrag für die Schülerinnen und Schüler<textarea id="v262-instructions" rows="6" maxlength="6000" placeholder="Was machen die Schülerinnen und Schüler selbstständig?">'+esc(p.instructions||'')+'</textarea></label>'+
    '<label>Materialien / Buchseiten / Ablageort<textarea id="v262-materials" rows="3" maxlength="2500" placeholder="z. B. AB im Fach, Buch S. 42">'+esc(p.materialNote||'')+'</textarea></label>'+
    '<label>Hinweise für die Vertretungslehrkraft<textarea id="v262-notes" rows="3" maxlength="2500" placeholder="z. B. Einzelarbeit, Lösungen am Ende">'+esc(p.teacherNote||'')+'</textarea></label>'+
    '<label class="v262-check"><input id="v262-ready" type="checkbox" '+(p.prepared?'checked':'')+'> Material ist vorbereitet und verfügbar</label>'+
    '<div class="v262-attachments"><strong>Lokale Materialdateien</strong>'+files.map(f=>'<div class="v262-file"><span>'+esc(f.name)+'</span><button class="text-button" type="button" data-v262-download="'+esc(f.id)+'">Laden</button><button class="danger-lite small" type="button" data-v262-remove="'+esc(f.id)+'">Entfernen</button></div>').join('')+
    '<label class="upload-button">+ Arbeitsblätter / Lösungen anhängen<input id="v262-upload" type="file" multiple accept=".pdf,.doc,.docx,.odt,.txt,.png,.jpg,.jpeg,.zip" hidden></label></div>'+
    '<div class="v262-actions"><button type="button" class="secondary" data-v262-prompt>ChatGPT-Prompt kopieren</button><button type="button" class="secondary" data-v262-save>Speichern</button><button type="button" class="secondary" data-v262-docx>Word-Zettel</button><button type="button" class="secondary" data-v262-print>Drucken / PDF</button><button type="button" class="primary" data-v262-zip>Materialpaket (ZIP)</button></div>'+
    '<p class="microcopy">ChatGPT erstellt die Arbeitsblätter außerhalb des Cockpits. Lade sie danach hier hoch. Im ZIP liegen der Word-Vertretungszettel und alle lokal angehängten Dateien.</p></div></section></div>';
}
function form(e){
  const p=saved(e),value=id=>(document.getElementById(id)?.value||'').trim();
  return {...p,topic:value('v262-topic').slice(0,200),minutes:value('v262-minutes')==='90'?90:45,
    instructions:value('v262-instructions').slice(0,6000),materialNote:value('v262-materials').slice(0,2500),
    teacherNote:value('v262-notes').slice(0,2500),prepared:!!document.getElementById('v262-ready')?.checked,files:[...(p.files||[])]};
}
async function save(e,p,refresh=true){
  const store=state.substitutionPlansV262||(state.substitutionPlansV262={}),k=id(e),before=store[k];
  store[k]=p;
  try{await saveState();if(refresh)render();}
  catch(err){if(before===undefined)delete store[k];else store[k]=before;throw err;}
}
function prompt(e,p){
  const x=context(e),c=course(e);
  return '# Schulcockpit: eigenständige Vertretungsstunde\n\nIch bin wegen '+e.reason+' abwesend, die Klasse hat dennoch Unterricht.\n'+
    'Fach/Kurs: '+(c?.subject||'')+' '+(c?.name||'')+', '+e.date+', Stunde '+e.slot+', '+p.minutes+' Minuten, '+(Number(c?.students)||'unbekannte Zahl')+' Schüler:innen.\n'+
    'Reihe: '+(x.q?.title||'offen')+'\nThema: '+(p.topic||x.topic)+'\nSollinhalt: '+(x.u.content||'nicht konkretisiert')+
    '\nLernziel: '+(x.u.objective||'nicht konkretisiert')+'\nLetzte gehaltene Stunde: '+(x.prev?.date||'unbekannt')+' – '+(x.prev?.title||'')+
    '\nVorhandene Materialien: '+(x.u.material||'nicht angegeben')+'\nMeine Anweisung: '+(p.instructions||'noch offen')+
    '\nMaterial-/Buchhinweise: '+(p.materialNote||'keine')+'\nLehrkrafthinweise: '+(p.teacherNote||'keine')+'\n\n'+
    'Erstelle eine fachlich sinnvolle, weitgehend selbstständig bearbeitbare Vertretungsstunde. KEINE PowerPoint, keine Videos/Logins als Voraussetzung. Bestehende Materialien nur als verfügbar behandeln, wenn sie tatsächlich belegt sind; neue Arbeitsblätter bei Bedarf ausformulieren. Gib mir (1) einen kurzen höflichen Vertretungszettel mit Dank, Ablauf und Materialhinweisen für die aufsichtführende Lehrkraft, (2) druckfertige, nummerierte Arbeitsaufträge mit Platz für Lösungen, ggf. differenziert und in einfacher Sprache, (3) getrennte Lösungen für Lehrkräfte. Die Materialien sollen als DOCX/PDF gespeichert werden können. Keine personenbezogenen Schülerdaten.';
}
function escapeXml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function cover(e,p){
  const c=course(e);
  return ['VERTRETUNGSINFORMATION','Fach/Kurs: '+(c?.subject||'')+' '+(c?.name||'')+' · '+e.date+' · Stunde '+e.slot+' · '+p.minutes+' Minuten',
    'Thema: '+(p.topic||'noch offen'),'Liebe Kollegin, lieber Kollege,',
    'vielen Dank, dass du die Vertretung übernimmst!','Arbeitsauftrag für die Schülerinnen und Schüler:',p.instructions||'Bitte Arbeitsauftrag ergänzen.',
    'Materialien / Ablageort:',p.materialNote||'Keine besonderen Angaben.','Weitere Hinweise:',p.teacherNote||'Keine besonderen Hinweise.',
    'Vielen Dank und viele Grüße'];
}
async function docx(e,p){
  if(typeof JSZip==='undefined')throw Error('Word-Export nicht verfügbar. Bitte Seite neu laden.');
  const z=new JSZip(),paragraphs=cover(e,p).flatMap(x=>String(x).split('\n').map(line=>'<w:p><w:r><w:t xml:space="preserve">'+escapeXml(line)+'</w:t></w:r></w:p>')).join('');
  z.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  z.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  z.file('word/document.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>');
  return z.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
function requireWork(p){if(!p.instructions?.trim())throw Error('Bitte zuerst einen Arbeitsauftrag für die Schülerinnen und Schüler eintragen.');}
function filename(e){const c=course(e);return (e.date+'_'+(c?.subject||'Fach')+'_'+(c?.name||'Kurs')+'_Std'+e.slot).replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g,'_');}
async function bundle(e,p){
  requireWork(p);const z=new JSZip();z.file('01_Vertretungszettel.docx',await docx(e,p));
  const missing=[];for(let i=0;i<(p.files||[]).length;i++){
    const f=p.files[i],stored=await fileStoreGet(f.fileKey);
    if(!stored?.blob){missing.push(f.name);continue;}
    z.file('Materialien/'+String(i+1).padStart(2,'0')+'_'+f.name.replace(/[\\/]/g,'_'),await stored.blob.arrayBuffer());
  }
  if(missing.length)throw Error('Materialien fehlen lokal: '+missing.join(', ')+'. Bitte erneut hochladen.');
  return z.generateAsync({type:'blob',compression:'DEFLATE'});
}
function printPdf(e,p){
  requireWork(p);
  const body=cover(e,p).map((s,i)=>'<p class="'+([0,3,5,7,9].includes(i)?'heading':'')+'">'+escapeXml(s).replace(/\n/g,'<br>')+'</p>').join('');
  const html='<!doctype html><html lang="de"><head><meta charset="UTF-8"><title>Vertretungszettel</title><style>@page{size:A4;margin:20mm}body{font-family:Arial,sans-serif;line-height:1.5;color:#222;max-width:170mm;margin:auto}p{white-space:pre-wrap;margin:0 0 12px}.heading{font-weight:bold;margin-top:18px}p:first-child{font-size:20px;font-weight:bold}button{margin:12px 0;padding:10px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Drucken / als PDF speichern</button>'+body+'</body></html>';
  const w=window.open('','_blank');if(!w)throw Error('Popup blockiert. Bitte Popups zulassen oder Word verwenden.');
  w.document.open();w.document.write(html);w.document.close();
}
const oldTitle=pageTitle;pageTitle=function(){return view==='substitution-v262'?'Vertretungsmodus':oldTitle();};
const oldView=viewHtml;viewHtml=function(){
  if(view==='substitution-v262')return page();
  const html=oldView();if(view!=='school-calendar')return html;
  const marker='<section class="panel"><div class="section-head"><div><span class="eyebrow">PLANUNGSMARKEN</span>';
  return html.includes(marker)?html.replace(marker,list(currentYear(),true)+marker):html+list(currentYear(),true);
};
const oldModal=modalHtml;modalHtml=function(){return modal?.type==='substitutionV262'?modalPage():oldModal();};
const oldWire=wire;wire=function(){
  oldWire();
  document.querySelector('[data-v262-page]')?.addEventListener('click',()=>{view='substitution-v262';selectedYear=currentYear();modal=null;render();});
  document.querySelector('[data-v262-calendar]')?.addEventListener('click',()=>{view='school-calendar';selectedYear='';modal=null;render();});
  document.getElementById('v262-year')?.addEventListener('change',e=>{selectedYear=v190NormYear(e.target.value);render();});
  document.querySelectorAll('[data-v262-edit]').forEach(b=>b.addEventListener('click',()=>{selectedKey=b.dataset.v262Edit;modal={type:'substitutionV262'};render();}));
  if(modal?.type!=='substitutionV262')return;
  const e=chosen();if(!e)return;
  const error=err=>alert('Vertretungsmodus: '+(err.message||err));
  document.querySelector('[data-v262-save]')?.addEventListener('click',()=>save(e,form(e)).catch(error));
  document.querySelector('[data-v262-prompt]')?.addEventListener('click',async()=>{
    try{const p=form(e);await navigator.clipboard.writeText(prompt(e,p));await save(e,p,false);alert('Prompt kopiert. Erstelle die Materialien in ChatGPT und lade die Dateien anschließend hier hoch.');}
    catch(err){error(err);}
  });
  document.querySelector('[data-v262-docx]')?.addEventListener('click',async()=>{try{const p=form(e);requireWork(p);downloadBlob('Vertretung_'+filename(e)+'.docx',new Blob([await docx(e,p)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));await save(e,p,false);}catch(err){error(err);}});
  document.querySelector('[data-v262-print]')?.addEventListener('click',()=>{try{printPdf(e,form(e));}catch(err){error(err);}});
  document.querySelector('[data-v262-zip]')?.addEventListener('click',async()=>{try{const p=form(e);downloadBlob('Vertretung_'+filename(e)+'.zip',await bundle(e,p));await save(e,p,false);}catch(err){error(err);}});
  document.getElementById('v262-upload')?.addEventListener('change',async event=>{
    const files=[...(event.target.files||[])],p=form(e),added=[];if(!files.length)return;
    try{
      for(const f of files){if(f.size>35*1024*1024)throw Error('Datei über 35 MB: '+f.name);const uidValue=uid('sub-file'),fileKey='substitution-v262-'+uidValue;await fileStorePut(fileKey,f);added.push({id:uidValue,name:f.name,fileKey});}
      p.files.push(...added);await save(e,p);
    }catch(err){for(const f of added)try{await fileStoreDelete(f.fileKey);}catch(_){}error(err);}
  });
  document.querySelectorAll('[data-v262-download]').forEach(b=>b.addEventListener('click',async()=>{try{const f=(saved(e).files||[]).find(x=>x.id===b.dataset.v262Download),r=f&&await fileStoreGet(f.fileKey);if(!r?.blob)throw Error('Datei lokal nicht verfügbar.');downloadBlob(f.name,r.blob);}catch(err){error(err);}}));
  document.querySelectorAll('[data-v262-remove]').forEach(b=>b.addEventListener('click',async()=>{const p=form(e),f=p.files.find(x=>x.id===b.dataset.v262Remove);if(!f||!confirm('Material „'+f.name+'“ aus dem Vertretungspaket entfernen?'))return;p.files=p.files.filter(x=>x.id!==f.id);try{await save(e,p);await fileStoreDelete(f.fileKey);}catch(err){error(err);}}));
};
const oldRender=render;render=function(){
  oldRender();const nav=document.querySelector('.sidebar nav');if(!nav)return;
  let b=nav.querySelector('[data-v262-nav]');if(!b){b=document.createElement('button');b.type='button';b.dataset.v262Nav='1';b.innerHTML='<span>☷</span> Vertretung';const anchor=nav.querySelector('[data-v259-nav]');if(anchor)anchor.after(b);else nav.appendChild(b);b.addEventListener('click',()=>{view='substitution-v262';modal=null;selectedYear=selectedYear||v190NormYear(state.settings.schoolYear);render();});}
  b.classList.toggle('active',view==='substitution-v262');
  const version=document.querySelector('.brand small');if(version)version.textContent=state.settings.schoolYear+' · V0.26.2';
};
window.SchulcockpitSubstitutionV262={candidates,prompt,cover,docx,bundle,id};
})();
