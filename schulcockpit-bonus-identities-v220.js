/* Schulcockpit V0.22.0 — conservative Classtime answer-sheet identity.
 * Never transmit individual responses; original XLSX and pupil scores remain
 * exclusively in the browser's private IndexedDB.
 *
 * Trust only identical complete unique identifier sets between the primary
 * S-session sheet and each Q sheet. Works for anonymized S1..S27 AND native
 * Classtime full names, independent of question-sheet sort order.
 * Roster display-name edits are permitted; rowIndex is the exact local link
 * back to the original primary spreadsheet identity.
 */
const V220_VERSION='V0.22.0';

function v220NormalizedIdentity(value){
  return v200Norm(value);
}
function v220QuestionEvidence(ct,label,roster){
  const d=ct?.detection,sheets=ct?.parsed?.sheets||[],members=d?.studentRows||[];
  if(!d?.sourceV210||!d.verifiedV210||!members.length||!Array.isArray(roster)||!roster.length)
    return {ok:false,reason:'Haupttabelle oder Teilnehmendenliste nicht sicher bestätigt'};
  if(roster.length!==members.length)
    return {ok:false,reason:'Teilnehmendenzahl stimmt nicht mit der Excel-Haupttabelle überein'};
  const master=sheets[d.sheetIndex];
  if(!master)return {ok:false,reason:'Classtime-Haupttabelle fehlt'};
  const originalByRow=new Map(),originalByName=new Map();
  for(const row of members){
    if(!Number.isInteger(row.rowIndex)||row.rowIndex<0||originalByRow.has(row.rowIndex))
      return {ok:false,reason:'Haupttabelle enthält keine eindeutigen Zeilenkennungen'};
    const original=String(master.rows?.[row.rowIndex]?.[d.nameCol]??'');
    const name=v220NormalizedIdentity(original),captured=v220NormalizedIdentity(row.name);
    if(!name||!captured||name!==captured||originalByName.has(name))
      return {ok:false,reason:'Lernendenkennungen der Excel-Haupttabelle sind uneindeutig'};
    originalByRow.set(row.rowIndex,name);originalByName.set(name,row.rowIndex);
  }
  const rosterById=new Map(),usedRows=new Set();
  for(const student of roster){
    if(typeof student.id!=='string'||!student.id||rosterById.has(student.id)||
      !Number.isInteger(student.rowIndex)||usedRows.has(student.rowIndex)||
      !originalByRow.has(student.rowIndex))
      return {ok:false,reason:'Lokale Teilnehmerliste hat keine eindeutige Excel-Zeilenverknüpfung'};
    rosterById.set(student.id,student.rowIndex);usedRows.add(student.rowIndex);
  }
  const sheet=sheets.find(x=>String(x.name||'').toUpperCase()===String(label||'').toUpperCase());
  if(!sheet)return {ok:false,reason:'Frageblatt '+label+' fehlt'};
  const headers=[];
  for(let row=0;row<Math.min(15,sheet.rows?.length||0);row++){
    const cells=sheet.rows[row]||[];
    for(let col=0;col<cells.length;col++){
      if(/name\s+des\s+lernenden/i.test(String(cells[col]??'')))headers.push({row,col});
    }
  }
  if(headers.length!==1)return {ok:false,reason:'Namensspalte im Frageblatt nicht eindeutig'};
  const h=headers[0];
  // Classtime puts the question score immediately after its name column.
  // Other rows can contain aggregate metadata but not be mistaken for pupils.
  const answers=new Map();
  for(const cells of (sheet.rows||[]).slice(h.row+1)){
    const raw=cells?.[h.col],name=v220NormalizedIdentity(raw);
    if(!name)continue;
    if(!originalByName.has(name))
      return {ok:false,reason:'Frageblatt enthält andere Namen/Kennungen als die Haupttabelle'};
    if(answers.has(name))
      return {ok:false,reason:'Frageblatt enthält eine Kennung mehrfach'};
    const content=cells.slice(h.col+2);
    answers.set(name,content.some(v=>v!==null&&v!==undefined&&String(v).trim()!==''));
  }
  if(answers.size!==originalByName.size)
    return {ok:false,reason:'Frageblatt enthält '+answers.size+' von '+originalByName.size+' eindeutig zugeordneten Lernenden'};
  const byStudent=new Map();
  for(const student of roster){
    const key=originalByRow.get(student.rowIndex);
    if(!answers.has(key))
      return {ok:false,reason:'Einzelne Personen konnten nicht sicher zugeordnet werden'};
    byStudent.set(student.id,answers.get(key));
  }
  return {ok:true,byStudent,unanswered:[...byStudent.values()].filter(v=>!v).length,
    answered:[...byStudent.values()].filter(Boolean).length};
}
const v220BonusRowsPrior=v213BonusRows;
v213BonusRows=function(priv,an,mapping){
  const ct=priv?.classtime;
  if(!ct?.detection?.sourceV210)return v220BonusRowsPrior(priv,an,mapping);
  const permitted=new Set(v200QuestionColumns(ct).filter(c=>c.max===0).map(c=>c.label));
  const used=new Set(),rows=[],warnings=[],errors=[],counts=[];
  for(const item of (an?.items||[]).filter(x=>x.source==='classtime_bonus')){
    const label=mapping?.[item.id];
    if(!label){warnings.push((item.label||item.id)+': Bonusfrage auswählen');continue;}
    if(!permitted.has(label)){errors.push(label+': ist keine Bonusfrage mit 0 regulären Punkten');continue;}
    if(used.has(label)){errors.push(label+': dieselbe Frage mehrfach ausgewählt');continue;}
    if(!(Number(item.bonusMax)>0)){errors.push((item.label||item.id)+': Bonus-Maximalpunkte fehlen');continue;}
    used.add(label);
    const evidence=v220QuestionEvidence(ct,label,priv.roster);
    if(!evidence.ok){
      warnings.push(label+': '+evidence.reason+' – keine automatische Nullwertung');
      counts.push({label,ok:false,reason:evidence.reason});
      continue;
    }
    // Atomic per question: never apply just a prefix of partially matched rows.
    for(const student of priv.roster){
      rows.push({studentId:student.id,itemId:item.id,label,answered:evidence.byStudent.get(student.id)});
    }
    counts.push({label,ok:true,unanswered:evidence.unanswered,answered:evidence.answered});
  }
  return {rows,errors:[...new Set(errors)],warnings:[...new Set(warnings)],counts};
};
/* Aggregate-only preview. No names, IDs, answer text or individual scores. */
const v220BonusBlockPrior=v218BonusBlock;
v218BonusBlock=function(priv,an){
  const html=v220BonusBlockPrior(priv,an),ct=priv?.classtime;
  if(!ct?.detection?.sourceV210||!html.includes('data-v218-bonus-zeros'))return html;
  const entries=(an?.items||[]).filter(x=>x.source==='classtime_bonus');
  if(!entries.length)return html;
  const tentative={...(ct.bonusMappingV213||{})};
  for(const item of entries){
    if(tentative[item.id])continue;
    const suggestion=v213BonusSuggestion(ct,item)||
      (v217Candidates(ct,item).length===1?v217Candidates(ct,item)[0].label:'');
    if(suggestion)tentative[item.id]=suggestion;
  }
  const verified=v213BonusRows(priv,an,tentative);
  const list=(verified.counts||[]).map(c=>c.ok?
    '<li>'+esc(c.label)+': '+c.unanswered+' nicht beantwortet · '+c.answered+' beantwortet</li>':
    '<li>'+esc(c.label)+': Zuordnung noch offen ('+esc(c.reason)+')</li>').join('');
  if(!list)return html;
  const total=(verified.counts||[]).filter(x=>x.ok).reduce((n,c)=>n+c.unanswered,0);
  const note='<div class="v220-evidence"><strong>Vorprüfung anhand deiner lokal gespeicherten Excel:</strong>'
    +'<ul>'+list+'</ul><p><strong>'+total+' eindeutig leere Antworten erkannt</strong> '
    +'(noch nicht als 0 gespeichert).</p><p class="microcopy">Das sind nur Antwortstatus, keine vergebenen Bonuspunkte. '
    +'Die verbindliche Übernahme erfolgt erst nach einem Klick und deiner Bestätigung. '
    +'Änderst du eine Q-Auswahl, wird sie beim Klick erneut geprüft.</p></div>';
  return html.replace('<button class="secondary" data-v218-bonus-zeros>',note+
    '<button class="secondary" data-v218-bonus-zeros>');
};
const v220RenderBefore=render;
render=function(){
  v220RenderBefore();
  const el=document.querySelector('.brand small');
  if(el)el.textContent=state.settings.schoolYear+' · '+V220_VERSION;
};
render();