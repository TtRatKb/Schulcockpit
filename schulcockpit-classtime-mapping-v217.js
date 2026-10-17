/* Schulcockpit V0.21.7: eindeutige Classtime-Spalten, verständliche Vorschau. */
const V217_VERSION='V0.21.7';
function v217Code(text){
  const s=String(text||'').replace(/\u2013|\u2014/g,'-');
  const q=s.match(/\bQ\s*0*(\d+)\b/i);
  const a=s.match(/\bA\s*(\d+)\s*([a-z])(?:\s*[-\/]\s*([a-z]))?\b/i);
  return [...(q?['q'+Number(q[1])]:[]),
    ...(a?['a'+Number(a[1])+a[2].toLowerCase()+(a[3]?'-'+a[3].toLowerCase():'')]:[])];
}
function v217Candidates(ct,item){
  const bonus=item.source.endsWith('_bonus'),mx=Number(item.regularMax);
  const labels=[item.id,item.label,...(item.classtimeAliases||[])].filter(Boolean);
  const codes=new Set(labels.flatMap(v217Code));
  const cols=v200QuestionColumns(ct).filter(c=>Number.isFinite(c.max)&&
    (bonus?c.max===0:Math.abs(c.max-mx)<1e-8));
  const direct=cols.filter(c=>codes.has(String(c.label||'').toLowerCase()));
  if(direct.length)return direct;
  const taskCodes=new Set([...codes].filter(x=>x.startsWith('a')));
  return cols.filter(c=>{
    const label=String(c.description||'').split(/[·:|]/)[0].replace(/^\s*(?:BONUS\s*)?\*/i,'');
    return v217Code(label).some(k=>taskCodes.has(k));
  });
}
const v217OldMap=v200AutoMapItems;
v200AutoMapItems=function(priv,an){
  const ct=priv?.classtime;
  if(!ct?.detection?.sourceV210)return v217OldMap(priv,an);
  ct.mapping=ct.mapping||{};
  const all=(an?.items||[]).filter(it=>it.source.startsWith('classtime'));
  const occupied=new Set(all.map(it=>ct.mapping[it.id]).filter(x=>x!==undefined&&x!==null&&x!=='').map(String));
  const choices=new Map();
  for(const it of all){
    if(Object.prototype.hasOwnProperty.call(ct.mapping,it.id))continue;
    const matches=v217Candidates(ct,it);
    if(matches.length!==1||occupied.has(String(matches[0].index)))continue;
    const key=String(matches[0].index);
    choices.set(key,[...(choices.get(key)||[]),it]);
  }
  for(const [key,items] of choices)if(items.length===1){
    ct.mapping[items[0].id]=Number(key);occupied.add(key);
  }
};
const v217ExcelBefore=v210ExcelState;
v210ExcelState=function(priv,an){
  const result=v217ExcelBefore(priv,an),ct=priv?.classtime;
  if(!ct?.detection?.sourceV210)return result;
  const cols=v200QuestionColumns(ct),all=(an?.items||[]).filter(i=>i.source==='classtime');
  const byIndex=new Map(cols.map(c=>[String(c.index),c]));
  const rows=all.map(it=>{
    const ix=ct.mapping?.[it.id],col=byIndex.get(String(ix));
    const candidate=v217Candidates(ct,it);
    const text=col?col.label+' – '+(col.description||''):'Noch nicht eindeutig erkannt';
    const status=col?(candidate.some(x=>x.index===col.index)?'Vorschlag – bitte prüfen':'Manuelle Zuordnung – bitte prüfen'):
      candidate.length>1?'Mehrere Treffer':'Auswahl notwendig';
    return '<tr><td>'+esc(it.label||it.id)+'</td><td>'+esc(text)+'</td><td>'+esc(status)+'</td></tr>';
  }).join('');
  const matched=all.filter(it=>byIndex.has(String(ct.mapping?.[it.id]))).length;
  const missing=all.length-matched;
  const summary='<section class="detail-section v217-mapping">'
    +'<h3>Aufgaben mit den Excel-Fragen verbinden</h3><p><strong>'
    +matched+' von '+all.length+'</strong> regulären Classtime-Aufgaben zugeordnet.</p>'
    +(missing?'<p>Die Excel enthält Ergebnisse. Es fehlen noch '+missing+' sichere Verbindungen '
      +'zwischen deiner Aufgabenbezeichnung und der Q-Spalte. '
      +'Du kannst sie unten auswählen. Die Punkte bleiben bis dahin unverändert.</p>':
      '<p>Die Aufgaben sind anhand ihrer Q-Nummer oder A-Aufgabenbezeichnung und der '
      +'Maximalpunkte zugeordnet. Bitte kurz kontrollieren, dann die digitalen Punkte übernehmen.</p>')
    +'<div class="v210-scroll"><table class="v210-grid"><thead><tr>'
    +'<th>Aufgabenplan</th><th>Excel</th><th>Status</th></tr></thead><tbody>'
    +rows+'</tbody></table></div>'
    +'<button class="secondary" data-v217-jump>Spaltenzuordnung prüfen ↓</button></section>';
  result.preview=summary+result.preview;
  result.preview=result.preview.replace('<strong>Übernahme noch gesperrt:</strong>',
    '<strong>Zuordnung noch unvollständig:</strong>');
  if(missing)result.preview=result.preview.replace(
    /<p>\d+ lesbare digitale Ergebnisse · \d+ nicht beantwortete reguläre Aufgaben \(nach Freigabe 0 Punkte\) · \d+ Werte außerhalb von Viertelschritten\.<\/p>/,
    '<p class="microcopy">Punktevorschau noch unvollständig, da '+missing+
    ' Aufgaben nicht verbunden sind. Das heißt NICHT, dass die Kinder 0 Punkte haben.</p>');
  if(result.preview.includes('<strong>0</strong> eindeutig nicht beantwortete Fragen · <strong>0</strong> abgegebene')){
    result.preview=result.preview.replace(
      /<section class="detail-section v212-answer-audit">[\s\S]*?<\/section>/,
      '<section class="detail-section v212-answer-audit"><h3>Antwortstatus nicht automatisch ermittelt</h3>'
      +'<p>In dieser Datei wurden keine passenden Sondermarkierungen erkannt. '
      +'Daraus folgt nicht, dass alle Fragen beantwortet wurden. '
      +'Ungültige Einzelwerte bleiben zur Prüfung offen.</p></section>');
  }
  return result;
};
const v217StepBefore=v200Step3;
v200Step3=function(a,priv){
  const html=v217StepBefore(a,priv);
  return html.replace('class="v200-map-table"','id="v217-map-target" class="v200-map-table"');
};
const v217WireBefore=wire;
wire=function(){
  v217WireBefore();
  document.querySelector('[data-v217-jump]')?.addEventListener('click',()=>{
    const t=document.getElementById('v217-map-target');
    t?.scrollIntoView({behavior:'smooth',block:'center'});
    t?.querySelector('select')?.focus({preventScroll:true});
  });
};
const v217RenderBefore=render;
render=function(){
  v217RenderBefore();
  const el=document.querySelector('.brand small');
  if(el)el.textContent=state.settings.schoolYear+' · '+V217_VERSION;
};
render();