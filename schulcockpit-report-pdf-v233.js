/* Schulcockpit V0.23.4: pastel A4 competency reports and private print names.
 * No network services; all established scores and authored texts stay intact.
 */
const V233_VERSION='V0.23.4';
const V233_CP={8364:128,8218:130,402:131,8222:132,8230:133,8224:134,8225:135,710:136,8240:137,352:138,8249:139,338:140,381:142,8216:145,8217:146,8220:147,8221:148,8226:149,8211:150,8212:151,732:152,8482:153,353:154,8250:155,339:156,382:158,376:159};
function v233Literal(str){
  let out='';
  for(const c of String(str??'').normalize('NFC')){
    const n=c.codePointAt(0);
    if(n===10||n===13||n===9){out+=' ';continue;}
    const val=n>=32&&n<=126||n>=160&&n<=255?n:V233_CP[n];
    if(val===undefined){out+='?';continue;}
    if(val===40||val===41||val===92)out+='\\'+String.fromCharCode(val);
    else out+=val<32||val>126?'\\'+val.toString(8).padStart(3,'0'):String.fromCharCode(val);
  }
  return out;
}
function v233Number(n){
  return Number.isFinite(Number(n))?(Math.round(Number(n)*100)/100).toLocaleString('de-DE',{maximumFractionDigits:2}):'–';
}
function v233N(n){return String(Math.round(Number(n)*100)/100);}
function v233Color(hex){return hex.replace('#','').match(/../g).map(s=>v233N(parseInt(s,16)/255)).join(' ');}
function v233Colors(a){
  const mono=a?.printSettingsV233?.mode==='mono';
  return mono?{
    ink:'#181818',muted:'#505050',line:'#bababa',dark:'#313131',soft:'#f1f1f1',stripe:'#ffffff',
    white:'#ffffff',E:'#e5e5e5',TE:'#dcdcdc',NNE:'#d1d1d1',
    rowE:'#f5f5f5',rowTE:'#efefef',rowNNE:'#e8e8e8',
    praise:'#eeeeee',practice:'#f5f5f5',bonus:'#3c3c3c',
    accent:'#555555',praiseBar:'#595959',practiceBar:'#777777'
  }:{
    ink:'#3b4055',muted:'#6d6d83',line:'#dcd8e5',dark:'#66617e',soft:'#f7f1fa',stripe:'#fcfbfd',
    white:'#ffffff',E:'#d9efdf',TE:'#ffedc6',NNE:'#f8dce1',
    rowE:'#f0f9f1',rowTE:'#fff9e9',rowNNE:'#fff0f3',
    praise:'#eff8f1',practice:'#f2effb',bonus:'#985c9c',
    accent:'#b88abb',praiseBar:'#75ae8d',practiceBar:'#a497d4'
  };
}
function v233Measure(str,size,font){
  if(typeof document!=='undefined'&&document.createElement){
    const canvas=v233Measure.cv||(v233Measure.cv=document.createElement('canvas')),ctx=canvas.getContext&&canvas.getContext('2d');
    if(ctx){ctx.font=(font==='F2'||font==='F4'?'bold ':'')+size+'px '+(font==='F4'?'Georgia':'Arial');return ctx.measureText(String(str)).width*1.05;}
  }
  return Array.from(String(str)).reduce((n,c)=>n+size*(/[il.,:;!|]/.test(c)?.3:/[WMÄÖÜ@]/.test(c)?.88:/[A-Z0-9]/.test(c)?.64:.56),0);
}
function v233Wrap(str,max,size,font='F1'){
  const out=[],words=String(str??'').trim().split(/\s+/).filter(Boolean);let line='';
  for(const word of words){
    const attempt=line?line+' '+word:word;
    if(v233Measure(attempt,size,font)<=max){line=attempt;continue;}
    if(line){out.push(line);line='';}
    let rest=word;
    while(v233Measure(rest,size,font)>max&&rest.length>1){
      let n=rest.length-1;
      while(n>1&&v233Measure(rest.slice(0,n)+'-',size,font)>max)n--;
      out.push(rest.slice(0,n)+'-');rest=rest.slice(n);
    }
    line=rest;
  }
  if(line)out.push(line);
  return out.length?out:[''];
}
function v233Text(out,x,y,t,size=10,font='F1',color='#20374d',align='left'){
  const val=String(t??'');
  if(align!=='left'){const w=v233Measure(val,size,font);x-=align==='center'?w/2:w;}
  out.push(v233Color(color)+' rg BT /'+font+' '+v233N(size)+' Tf 1 0 0 1 '+v233N(x)+' '+v233N(y)+' Tm ('+v233Literal(val)+') Tj ET\n');
}
function v233Fill(out,x,y,w,h,col){out.push(v233Color(col)+' rg '+[x,y,w,h].map(v233N).join(' ')+' re f\n');}
function v233Line(out,x,y,a,b,col,w=.6){out.push(v233Color(col)+' RG '+v233N(w)+' w '+[x,y].map(v233N).join(' ')+' m '+[a,b].map(v233N).join(' ')+' l S\n');}
function v233Date(x){
  const value=String(x||'').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value.slice(8,10)+'.'+value.slice(5,7)+'.'+value.slice(0,4);
  return value;
}
function v233Settings(a){return a?.printSettingsV233||{};}
function v233Label(a){
  if(v233Settings(a).examLabel)return String(v233Settings(a).examLabel);
  const title=String(a?.title||''),match=title.match(/Klassenarbeit\s*(?:Nr\.?|Nummer)?\s*(\d+)/i)||title.match(/(\d+)\.\s*Klassenarbeit/i);
  return match?'Klassenarbeit Nr. '+match[1]:'Klassenarbeit';
}
function v233Topic(a){
  const stored=String(v233Settings(a).topic||'').trim();
  // Earlier versions persisted the generic word "Klassenarbeit" as a topic.
  // Repair it for existing assessments without deleting the stored value.
  if(stored&&!/^(?:klassenarbeit(?:\s*(?:nr\.?|nummer)?\s*\d+)?|arbeit|test|lernerfolgskontrolle)$/i.test(stored))
    return stored;
  const title=String(a?.title||'').replace(/(?:Klassenarbeit\s*(?:Nr\.?|Nummer)?\s*\d+|\d+\.\s*Klassenarbeit)[\s:–-]*/ig,'').trim();
  const scope=String(a?.scope||'').trim(),topics=a?.evaluationV200?.analysis?.curriculum?.topics||[];
  // A generic assessment title is not a topic; avoid "Klassenarbeit /
  // Klassenarbeit / Kompetenzrückmeldung" on printouts.
  const generic=/^(?:klassenarbeit(?:\s*(?:nr\.?|nummer)?\s*\d+)?|arbeit|test|lernerfolgskontrolle)$/i;
  if(title.length>=4&&title.length<=70&&!generic.test(title))return title;
  if(scope&&scope.length<=70&&!generic.test(scope))return scope;
  if(topics.length===1&&String(topics[0].title||'').length<=70)return String(topics[0].title||'');
  return '';
}
function v234PrintName(report){
  const id=report?.student?.id;
  const privateData=typeof v200Eval!=='undefined'?v200Eval?.privateData:null;
  const override=id!==undefined&&id!==null?privateData?.printNamesV234?.[id]:null;
  return String(override||report?.student?.name||'').trim();
}
function v233Status(c){return ({'erreicht':'E','teilweise erreicht':'TE','noch nicht erreicht':'NNE'})[c?.status]||'–';}
function v233Header(out,r,a,p,cont){
  const yr=typeof state!=='undefined'?state?.settings?.schoolYear||'':'',topic=v233Topic(a)||'Deine Ergebnisse';
  v233Fill(out,42,815,42,4,p.accent);
  v233Text(out,42,793,v233Label(a).toUpperCase(),9,'F2',p.muted);
  if(yr)v233Text(out,553,793,yr,9,'F2',p.muted,'right');
  const size=topic.length>46?16:topic.length>27?20:24;
  const titleLines=v233Wrap(topic,506,size,'F4');
  if(titleLines.length>2)throw Error('Das PDF-Thema ist zu lang. Bitte kürzer formulieren.');
  titleLines.forEach((line,i)=>v233Text(out,42,772-i*23,line,size,'F4',p.ink));
  const offset=(titleLines.length-1)*23;
  v233Text(out,42,745-offset,cont?'Fortsetzung · '+v234PrintName(r):'Deine Kompetenzübersicht',10.6,'F2',p.muted);
  v233Line(out,42,736-offset,553,736-offset,p.line);
  if(cont)return 712-offset;
  v233Text(out,42,719-offset,v234PrintName(r),12,'F2',p.ink);
  v233Text(out,42,695-offset,'Geschrieben am: '+(v233Date(a?.date)||'–'),9,'F1',p.muted);
  v233Text(out,553,695-offset,'Korrigiert am: '+(v233Date(v233Settings(a).correctedAt)||'–'),9,'F1',p.muted,'right');
  return 674-offset;
}
function v233Legend(out,p,y){
  let x=42;
  for(const [tag,name,fill,space] of [['E','erreicht',p.E,127],['TE','teilweise erreicht',p.TE,181],['NNE','noch nicht erreicht',p.NNE,195]]){
    v233Fill(out,x,y-10,24,19,fill);
    v233Text(out,x+12,y-4,tag,8.5,'F2',p.ink,'center');
    v233Text(out,x+30,y-4,name,9,'F1',p.muted);
    x+=space;
  }
}
function v233TableHead(out,p,y){
  v233Fill(out,42,y-43,511,43,p.dark);
  v233Text(out,51,y-26,'Kompetenzen',10,'F2',p.white);
  v233Text(out,412.5,y-13,'Erreichte',8.2,'F2',p.white,'center');
  v233Text(out,412.5,y-25,'Punkte',8.2,'F2',p.white,'center');
  v233Text(out,412.5,y-36,'+ Bonuspunkte',7.5,'F2',p.white,'center');
  v233Text(out,483.5,y-19,'Mögliche',7.8,'F2',p.white,'center');
  v233Text(out,483.5,y-30,'Punkte',7.8,'F2',p.white,'center');
  v233Text(out,530,y-26,'Stand',8.5,'F2',p.white,'center');
  return y-43;
}
function v233CompetenceLayout(c){
  const text=String(c?.text||'').trim();
  // Keep curriculum wording unchanged. Task references are typeset as a
  // separate quiet suffix so "(A 5)" never dangles on its own by accident.
  const match=text.match(/\s*(\((?:A(?:ufgabe)?\s*)?\d+(?:\s*[-–,]\s*\d+)*\))\s*$/i);
  const task=match?match[1]:'';
  const main=task?text.slice(0,match.index).trim():text;
  const lines=v233Wrap(main,303,10.1);
  const tail=lines[lines.length-1]||'';
  const taskFits=!!task&&v233Measure(tail,10.1,'F1')+v233Measure(task,8.6,'F1')+12<=303;
  const taskExtra=!!task&&!taskFits;
  const height=Math.max(47,16+lines.length*14+(taskExtra?12:0));
  return {lines,task,taskFits,taskExtra,height};
}
function v233Row(out,p,c,y,index){
  const layout=v233CompetenceLayout(c);
  if(layout.lines.length>14)throw Error('Ein Kompetenztext ist für die PDF-Tabelle zu lang.');
  const height=layout.height,low=y-height,tag=v233Status(c);
  v233Fill(out,42,low,511,height,p['row'+tag]||p.stripe);
  v233Fill(out,507,low,46,height,p[tag]||p.soft);
  for(const x of [42,365,460,507,553])v233Line(out,x,low,x,y,p.line,.6);
  v233Line(out,42,low,553,low,p.line,.7);
  layout.lines.forEach((line,i)=>v233Text(out,52,y-18-i*14,line,10.1,'F1',p.ink));
  if(layout.task){
    const lastLine=layout.lines.at(-1)||'',lastBase=y-18-(layout.lines.length-1)*14;
    const tx=layout.taskFits?52+v233Measure(lastLine,10.1,'F1')+8:52;
    v233Text(out,tx,layout.taskFits?lastBase:lastBase-12,layout.task,8.6,'F1',p.muted);
  }
  const earned=v233Number(c.regularEarned),bonus=Number(c.bonusEarned)>0?' + '+v233Number(c.bonusEarned):'';
  const x=412.5-(v233Measure(earned,10,'F2')+v233Measure(bonus,10,'F2'))/2;
  const baseline=(y+low)/2-3;
  v233Text(out,x,baseline,earned,10,'F2',p.ink);
  if(bonus)v233Text(out,x+v233Measure(earned,10,'F2'),baseline,bonus,10,'F2',p.bonus);
  v233Text(out,483.5,baseline,v233Number(c.regularMax),10,'F1',p.ink,'center');
  v233Text(out,530,baseline,tag,10,'F2',p.ink,'center');
  return low;
}
function v233Total(out,p,r,y){
  v233Fill(out,42,y-53,511,53,p.soft);
  v233Fill(out,42,y-53,3,53,p.accent);
  v233Text(out,54,y-16,'GESAMTPUNKTE',8,'F2',p.muted);
  const hasBonus=Number(r.totalBonusEarned)>0;
  const total=v233Number(r.totalReg)+(hasBonus?' + '+v233Number(r.totalBonusEarned):'');
  v233Text(out,54,y-32,total+'  /  '+v233Number(r.totalMax),13.2,'F2',p.ink);
  v233Text(out,54,y-46,hasBonus?'regulär + Bonus  /  regulär möglich':'erreicht  /  möglich',7.9,'F1',p.muted);
  v233Line(out,344,y-48,344,y-7,p.line);
  v233Text(out,355,y-16,'ANRECHENBAR',8,'F2',p.muted);
  v233Text(out,355,y-35,v233Number(r.totalAdjusted)+' / '+v233Number(r.totalMax),13,'F2',p.accent);
  return y-53;
}
function v233Sign(out,p,a,sig){
  v233Line(out,42,69,270,69,p.muted,.7);
  if(sig)out.push('q 144 0 0 39 64 74 cm /Sig Do Q\n');
  v233Text(out,42,54,'Kürzel / Unterschrift der Fachlehrkraft',8.1,'F1',p.muted);
  if(a?.parentSignatureRequiredV204){
    v233Line(out,332,69,553,69,p.muted,.7);
    v233Text(out,332,54,'Unterschrift eines Erziehungsberechtigten',7.7,'F1',p.muted);
  }
}
function v233ReportPages(r,a,sig){
  if(!r?.complete)throw Error('Diesen Bogen erst nach vollständiger Korrektur drucken.');
  const rows=(r.competencies||[]).filter(c=>Number(c.regularMax)>0);
  if(!rows.length)throw Error('Keine bewertbaren Kompetenzen vorhanden.');
  const p=v233Colors(a),pages=[];let current=[],y=0;
  function begin(cont=false){current=[];pages.push(current);y=v233Header(current,r,a,p,cont);}
  begin();
  v233Legend(current,p,y);y=v233TableHead(current,p,y-27);
  for(let i=0;i<rows.length;i++){
    const h=v233CompetenceLayout(rows[i]).height;
    if(y-h<204){begin(true);y=v233TableHead(current,p,y);}
    y=v233Row(current,p,rows[i],y,i);
  }
  if(y-70<180)begin(true);
  y=v233Total(current,p,r,y-10)-8;
  v233Text(current,44,y,'Bonus zählt je Kompetenz höchstens bis zur regulären Punktzahl.',7.8,'F1',p.muted);y-=17;
  // The narrative is the most personal part of the sheet: show two
  // real print-safe cards instead of burying text under the score table.
  const fb=v200Feedback(r,a);
  const strength=v233Wrap(fb.strength||'–',477,10.2);
  const next=v233Wrap(fb.next||'–',477,10.2);
  if(strength.length>92||next.length>92)
    throw Error('Die Rückmeldung ist zu lang für den Druck.');
  if(y<150)begin(true);
  v233Text(current,42,y,'DEINE RÜCKMELDUNG',9.2,'F2',p.accent);
  y-=16;
  function card(label,lines,color,bar){
    let offset=0;
    do{
      if(y<142)begin(true);
      // Keep headings and at least one line together. On exceptionally
      // long texts, create a visibly continued card on the next page.
      const available=y-95;
      const count=Math.min(lines.length-offset,Math.max(1,Math.floor((available-36)/14.4)));
      if(count<1||available<52){begin(true);continue;}
      const segment=lines.slice(offset,offset+count);
      const h=34+segment.length*14.4;
      if(y-h<88){begin(true);continue;}
      v233Fill(current,42,y-h,511,h,color);
      v233Fill(current,42,y-h,4,h,bar);
      v233Text(current,56,y-16,label+(offset?' (Fortsetzung)':''),10.7,'F2',p.ink);
      segment.forEach((line,i)=>v233Text(current,56,y-34-i*14.4,line,10.2,'F1',p.ink));
      y-=h+9;
      offset+=count;
    }while(offset<lines.length);
  }
  card('Was dir schon gut gelingt',strength,p.praise,p.praiseBar);
  card('Dein nächster Lernschritt',next,p.practice,p.practiceBar);
  if(y<88)begin(true);
  v233Sign(current,p,a,!!sig);
  if(pages.length>1)for(let i=0;i<pages.length;i++)
    v233Text(pages[i],553,28,(i+1)+' / '+pages.length,7.5,'F1',p.muted,'right');
  return pages.map(x=>x.join(''));
}
v204PdfBytes=function(reports,a,sig){
  const pages=(reports||[]).flatMap(r=>v233ReportPages(r,a,sig));
  if(!pages.length)throw Error('Keine druckbaren Rückmeldungen.');
  const objects=[],ids=[],streams=[];let count=7;
  pages.forEach(()=>{ids.push(count++);streams.push(count++);});
  const imageId=sig?count++:0;
  objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
  objects[2]='<< /Type /Pages /Kids ['+ids.map(n=>n+' 0 R').join(' ')+'] /Count '+ids.length+' >>';
  ['Helvetica','Helvetica-Bold','Times-Roman','Times-Bold'].forEach((font,i)=>{
    objects[i+3]='<< /Type /Font /Subtype /Type1 /BaseFont /'+font+' /Encoding /WinAnsiEncoding >>';
  });
  pages.forEach((page,i)=>{
    const resources=' /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >>'+(sig?' /XObject << /Sig '+imageId+' 0 R >>':'');
    objects[ids[i]]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <<'+resources+' >> /Contents '+streams[i]+' 0 R >>';
    objects[streams[i]]='<< /Length '+page.length+' >>\nstream\n'+page+'\nendstream';
  });
  if(sig)objects[imageId]='<< /Type /XObject /Subtype /Image /Width '+sig.width+' /Height '+sig.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+sig.bytes.length+' >>\nstream\n'+v204BytesBinary(sig.bytes)+'\nendstream';
  let pdf='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n',offsets=[0];
  for(let i=1;i<objects.length;i++){
    if(objects[i]===undefined)throw Error('PDF-Aufbau fehlgeschlagen ('+i+').');
    offsets[i]=pdf.length;pdf+=i+' 0 obj\n'+objects[i]+'\nendobj\n';
  }
  const position=pdf.length;
  pdf+='xref\n0 '+objects.length+'\n0000000000 65535 f \n';
  for(let i=1;i<objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+='trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+position+'\n%%EOF';
  const result=new Uint8Array(pdf.length);
  for(let i=0;i<pdf.length;i++)result[i]=pdf.charCodeAt(i)&255;
  return result;
};
// Previous y-based preflight assumed an old, single-page layout.
v213PreflightPdf=function(r,a){return v233ReportPages(r,a,null).length>0;};
function v233Options(a){
  const s=v233Settings(a),mode=s.mode==='mono'?'mono':'color';
  return '<div class="v233-print-options"><h4>Rückgabebogen gestalten</h4>'
    +'<p class="microcopy">Angaben für alle Bögen dieser Klassenarbeit. Das Korrekturdatum ist unabhängig vom Datum der Klassenarbeit.</p>'
    +'<div class="v233-option-grid">'
    +'<label>Überschrift <input data-v233-setting="examLabel" maxlength="80" value="'+esc(s.examLabel||v233Label(a))+'"></label>'
    +'<label>Thema <input data-v233-setting="topic" maxlength="120" value="'+esc(v233Topic(a))+'"></label>'
    +'<label>Datum der Korrektur <input type="date" data-v233-setting="correctedAt" value="'+esc(s.correctedAt||'')+'"></label>'
    +'<label>Druckversion <select data-v233-setting="mode"><option value="color" '+(mode==='color'?'selected':'')+'>Farbig</option><option value="mono" '+(mode==='mono'?'selected':'')+'>Schwarz-Weiß</option></select></label>'
    +'</div><p class="microcopy">E/TE/NNE, Bonuspunkte, individuelle Rückmeldungen und bisherige Unterschriftsoptionen bleiben erhalten.</p>'
    +'<p class="v233-save-status" role="status" aria-live="polite"></p></div>';
}
function v234NameEditor(priv){
  const reports=v224Report(),report=reports[v224Index(reports.length)];
  if(!report?.student?.id)return '';
  const id=report.student.id,defaultName=String(report.student.name||'').trim();
  const shown=String(priv?.printNamesV234?.[id]||defaultName).trim();
  return '<div class="v234-name-editor">'
    +'<label>Vollständiger Name für den Rückgabebogen'
    +'<input data-v234-print-name data-v234-student="'+esc(id)+'" maxlength="120" autocomplete="off" value="'+esc(shown)+'" placeholder="Vorname und Nachname"></label>'
    +'<small>Nur der Name auf dem PDF wird angepasst. Die Schülerzuordnung bleibt unverändert; der Eintrag wird ausschließlich lokal gespeichert.</small>'
    +'<small class="v234-name-status" role="status" aria-live="polite"></small></div>';
}
const v233BeforeStep5=v200Step5;
v200Step5=function(a,priv){
  const html=v233BeforeStep5(a,priv),anchor='<section class="detail-section v224-print"><h3>Drucken, wenn die Rückmeldungen passen</h3>';
  const withOptions=html.replace(anchor,anchor+v233Options(a));
  return withOptions.replace('<div class="v224-review-summary">',v234NameEditor(priv)+'<div class="v224-review-summary">');
};
async function v233SaveSettings(){
  const a=v200Assessment(v200Eval?.assessmentId);if(!a)return;
  const fresh={};
  for(const key of ['examLabel','topic','correctedAt','mode']){
    const el=document.querySelector('[data-v233-setting="'+key+'"]');
    if(el)fresh[key]=String(el.value||'').trim();
  }
  if(!Object.keys(fresh).length)return;
  if(fresh.correctedAt&&!/^\d{4}-\d{2}-\d{2}$/.test(fresh.correctedAt))throw Error('Ungültiges Korrekturdatum.');
  if(fresh.mode&&!['color','mono'].includes(fresh.mode))throw Error('Unbekannte Druckversion.');
  const previous=a.printSettingsV233?{...a.printSettingsV233}:undefined;
  const latest={...previous,...fresh};
  if(JSON.stringify(previous||{})===JSON.stringify(latest))return;
  a.printSettingsV233=latest;
  try{await saveState();}
  catch(e){if(previous===undefined)delete a.printSettingsV233;else a.printSettingsV233=previous;throw e;}
}
/* Print names are PRIVATE, keyed by existing stable student ID. Never
 * alter the Classtime roster or add names to public assessment metadata.
 * Serialize the IndexedDB write with the existing feedback save queue.
 */
function v234SavePrintName(){
  const element=document.querySelector('[data-v234-print-name]');
  const priv=v200Eval?.privateData,id=element?.dataset?.v234Student;
  if(!priv||!id||!element)return Promise.resolve(false);
  const source=(priv.roster||[]).find(x=>x.id===id);
  const raw=String(element.value||'').trim().replace(/\s+/g,' ').slice(0,120);
  const value=raw===String(source?.name||'').trim()?'':raw;
  return v224Serialized(async()=>{
    const map=priv.printNamesV234||{},prior=map[id];
    if((prior||'')===value)return false;
    if(!priv.printNamesV234)priv.printNamesV234={};
    if(value)priv.printNamesV234[id]=value;
    else delete priv.printNamesV234[id];
    try{await v200PrivatePut(priv);}
    catch(err){
      if(prior===undefined)delete priv.printNamesV234[id];
      else priv.printNamesV234[id]=prior;
      throw err;
    }
    return true;
  });
}
const v234SettingsBefore=v233SaveSettings;
v233SaveSettings=async function(){
  // Called by the guarded PDF click handler after any pending feedback save.
  await v234SavePrintName();
  return v234SettingsBefore();
};
const v233BeforeWire=wire;
wire=function(){
  v233BeforeWire();
  const printName=document.querySelector('[data-v234-print-name]');
  const nameStatus=document.querySelector('.v234-name-status');
  printName?.addEventListener('change',()=>{
    void v234SavePrintName().then(()=>{
      if(nameStatus)nameStatus.textContent='✓ Druckname lokal gespeichert.';
    }).catch(error=>{
      if(nameStatus)nameStatus.textContent='Druckname nicht gespeichert: '+(error.message||error);
    });
  });
  const note=document.querySelector('.v233-save-status');
  document.querySelectorAll('[data-v233-setting]').forEach(el=>el.addEventListener('change',async()=>{
    try{await v233SaveSettings();if(note)note.textContent='✓ Druckeinstellungen gespeichert.';}
    catch(e){if(note)note.textContent='Nicht gespeichert: '+(e.message||e);}
  }));
  // Capture before the v224 click listener, preserving its save-before-print
  // protection and additionally saving the PDF header/date/style values.
  document.querySelectorAll('[data-v200-pdf-zip],[data-v200-combined-pdf]').forEach(button=>{
    button.addEventListener('click',async event=>{
      if(button.disabled)return;
      event.preventDefault();event.stopImmediatePropagation();button.disabled=true;
      try{
        v224CancelTimer();
        if(v224DraftDirty)await v224Serialized(v224SaveFeedback);
        await v233SaveSettings();
        if(button.hasAttribute('data-v200-pdf-zip'))await v200DownloadPdfZip();
        else await v200DownloadCombinedPdf();
      }catch(e){v224Notice('PDF nicht erstellt: '+(e.message||e),'error');}
      finally{if(button.isConnected)button.disabled=false;}
    },true);
  });
};
render();
