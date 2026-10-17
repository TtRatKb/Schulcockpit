/* Schulcockpit V0.22.1 — kompakte Korrekturmatrix.
 * Display-only task codes; no changes to stored item IDs, source kinds,
 * individual results, bonus arithmetic or current IndexedDB schema.
 */
const V221_VERSION='V0.22.1';
function v221Code(item){
  const text=String(item.label||item.id||'');
  const a=text.match(/(?:^|[^\p{L}\p{N}])A\s*(\d+)\s*([a-z])(?:\s*[-–—]\s*([a-z]))?/iu);
  if(a)return 'A'+Number(a[1])+a[2].toLowerCase()+(a[3]?'–'+a[3].toLowerCase():'');
  const q=text.match(/(?:^|[^\p{L}\p{N}])Q\s*(\d+)/iu);
  if(q)return 'Q'+Number(q[1]);
  const fromId=String(item.id||'').match(/^A\d+[a-z](?:[-–][a-z])?$/i);
  if(fromId)return fromId[0];
  // Fallback for irregular hand-entered labels: never display a whole sentence
  return text.trim().split(/\s+/).slice(0,1).join('').slice(0,9)||'–';
}
function v221InputScore(priv,stu,it){
  return v200GetScore(priv,stu.id,it);
}
function v221GridSummary(priv,an){
  let paper=0,digital=0;
  for(const student of priv.roster||[]){
    if((priv.participationV210?.[student.id]||'present')!=='present')continue;
    for(const it of an.items||[]){
      const value=v221InputScore(priv,student,it);
      if(value!==null&&value!==undefined&&value!=='')continue;
      if(it.source==='classtime')digital++;
      else paper++;
    }
  }
  return {paper,digital};
}
function v221CompactTable(a,priv){
  const an=a?.evaluationV200?.analysis,people=priv?.roster||[];
  if(!an?.items?.length||!people.length)
    return '<section class="detail-section"><h3>Punkteingabe</h3><p>Bitte erst Aufgabenplan und Teilnehmerliste vervollständigen.</p></section>';
  const tasks=an.items,originalCodeCounts=new Map();
  const codes=tasks.map(it=>{
    const code=v221Code(it),seen=originalCodeCounts.get(code)||0;
    originalCodeCounts.set(code,seen+1);
    return {code:seen?code+'·'+(seen+1):code,it};
  });
  const head=codes.map(({code,it})=>{
    const digital=it.source==='classtime',bonus=it.source.endsWith('_bonus');
    const type=digital?'Classtime':bonus?'Bonus':'Papier';
    const mx=bonus?it.bonusMax:it.regularMax;
    return '<th scope="col" class="v221-head '+(digital?'v221-digital':bonus?'v221-bonus':'v221-paper')+'"'
      +' title="'+esc(type+' · '+(it.label||it.id)+' · maximal '+mx+' Punkte')+'">'
      +'<span class="v221-code">'+esc(code)+'</span>'
      +'<small>'+esc(mx)+' P.</small></th>';
  }).join('');
  const body=people.map((student,i)=>{
    const status=priv.participationV210?.[student.id]||'present';
    const selected=key=>key===status?' selected':'';
    const picker='<select aria-label="Teilnahmestatus von '+esc(student.name)+'" data-v210-participation="'+esc(student.id)+'">'
      +'<option value="present"'+selected('present')+'>Mitgeschrieben</option>'
      +'<option value="absent"'+selected('absent')+'>Nicht da</option>'
      +'<option value="makeup"'+selected('makeup')+'>Nachschreiben</option>'
      +'<option value="variant"'+selected('variant')+'>Andere Arbeit</option></select>';
    const cells=tasks.map(it=>{
      const value=v221InputScore(priv,student,it),hasValue=value!==null&&value!==undefined&&value!=='';
      const digital=it.source==='classtime',bonus=it.source.endsWith('_bonus');
      const mx=Number(bonus?it.bonusMax:it.regularMax);
      const inactive=status!=='present';
      const source=digital?'Classtime':bonus?'Bonus':'Papier';
      return '<td class="v221-cell '+(digital?'v221-digital':bonus?'v221-bonus':'v221-paper')+'">'
        +'<input class="v221-mark '+(hasValue?'v221-filled':'v221-empty')+'"'
        +' type="text" inputmode="decimal" autocomplete="off" spellcheck="false"'
        +' data-v210-grid-score="'+esc(student.id)+'|'+esc(it.id)+'"'
        +(digital?' data-v221-digital="1" readonly':'')
        +(inactive?' disabled':'')
        +' value="'+(hasValue?esc(value):'')+'" placeholder="–"'
        +' aria-label="'+esc(student.name+' · '+(it.label||it.id)+' · '+source+' · maximal '+mx)+'"'
        +' title="'+esc((it.label||it.id)+' · '+source+' · 0 bis '+mx+' Punkte'
          +(digital?' · Zum Korrigieren anklicken':''))
        +'"></td>';
    }).join('');
    return '<tr><th scope="row" class="v221-person" title="'+esc(student.name)+'">'
      +'<strong>'+esc(student.name)+'</strong><small>S'+(i+1)+'</small>'+picker+'</th>'+cells+'</tr>';
  }).join('');
  const summary=v221GridSummary(priv,an);
  return '<section class="detail-section v221-score-section"><h3>4. Punkte eingeben</h3>'
    +'<p class="v221-help"><span class="v221-key v221-digital">Classtime · geschützt</span>'
    +'<span class="v221-key v221-paper">Papier · eingeben</span>'
    +'<span class="v221-key v221-bonus">Bonus · eingeben</span></p>'
    +'<p class="microcopy">Nur Aufgabencodes in der Tabelle; vollständige Aufgabenbeschreibung beim Darüberfahren. '
    +'Classtime-Werte bleiben zunächst gesperrt und lassen sich durch Anklicken gezielt korrigieren. '
    +'<strong>Enter</strong> speichert und springt zum nächsten <strong>leeren Papier- oder Bonusfeld</strong>. '
    +'Bereits ausgefüllte Felder werden übersprungen. Leere Felder sind offen, nicht 0 Punkte.</p>'
    +'<p id="v221-save-status" role="status" aria-live="polite" data-kind="note">'
    +summary.paper+' offene Papier-/Bonusfelder'+(summary.digital?' · '+summary.digital+' digitale Ergebnisse noch offen':'')+
    '. Jede Änderung wird lokal gespeichert.</p>'
    +'<div class="v221-matrix-wrap"><table class="v221-matrix" style="--v221-n:'+tasks.length+'">'
    +'<colgroup><col class="v221-person-col">'+tasks.map(()=>'<col class="v221-mark-col">').join('')+'</colgroup>'
    +'<thead><tr><th scope="col" class="v221-person-heading">Person</th>'+head+'</tr></thead>'
    +'<tbody>'+body+'</tbody></table></div>'
    +'<div class="v200-actions"><button class="secondary" data-v200-step="3">← Aufgaben und Excel</button>'
    +'<button class="primary" data-v200-step="5">Berechnung & Rückgabe →</button></div></section>';
}
v210ScoreTable=v221CompactTable;
v200Step4=function(a,priv){return v221CompactTable(a,priv);};

let v221WriteQueue=Promise.resolve();
const v221Timers=new WeakMap();
function v221Queue(job){
  const result=v221WriteQueue.then(job);
  v221WriteQueue=result.catch(()=>{});
  return result;
}
function v221Notice(message,kind='note'){
  const el=document.getElementById('v221-save-status');
  if(el){el.textContent=message;el.dataset.kind=kind;
    el.setAttribute('role',kind==='error'?'alert':'status');}
}
function v221LockDigital(input){
  if(input.dataset.v221Digital!=='1')return;
  input.readOnly=true;delete input.dataset.v221Unlocked;
  input.classList.remove('v221-unlocked');
}
function v221UnlockDigital(input){
  if(input.disabled||input.dataset.v221Digital!=='1'||!input.readOnly)return;
  input.readOnly=false;input.dataset.v221Unlocked='1';
  input.classList.add('v221-unlocked');
  v221Notice('Classtime-Wert zum Korrigieren entsperrt. Änderung wird als manuelle Korrektur gespeichert.','note');
  input.focus();input.select();
}
async function v221PersistInput(input){
  if(input.disabled)return true;
  const raw=input.value.trim(),previous=input.dataset.v221Saved??'';
  if(raw===previous){v221LockDigital(input);return true;}
  v221Notice('Speichere Punkte lokal …','progress');
  try{
    // Use the protected V0.21.1 routine. It checks ranges and writes
    // immutable manual provenance without overwriting other students.
    await v210SaveCell(input);
    input.dataset.v221Saved=raw;
    input.classList.remove('v210-error','v221-empty');
    input.classList.add(raw?'v221-filled':'v221-empty');
    v221LockDigital(input);
    const a=v200Assessment(v200Eval?.assessmentId),
      summary=a?v221GridSummary(v200Eval.privateData,a.evaluationV200?.analysis||{items:[]}):null;
    v221Notice('✓ Punkte lokal gespeichert'+(summary?' · '+summary.paper+' Papier-/Bonusfelder noch offen':''),'success');
    return true;
  }catch(err){
    input.classList.add('v210-error');
    v221Notice('Nicht gespeichert: '+(err.message||err)+'. Eingabe bleibt stehen; bitte korrigieren.','error');
    input.focus();
    return false;
  }
}
function v221CancelTimer(input){
  const pending=v221Timers.get(input);
  if(pending!==undefined){clearTimeout(pending);v221Timers.delete(input);}
}
function v221EligibleNext(inputs,origin){
  const start=inputs.indexOf(origin),len=inputs.length;
  if(!len)return null;
  for(let step=1;step<=(start<0?len:len-1);step++){
    const el=inputs[(Math.max(-1,start)+step)%len];
    if(el.disabled||el.dataset.v221Digital==='1'||el.value.trim()!=='')continue;
    return el;
  }
  return null;
}
async function v221SaveAllVisible(){
  const items=[...document.querySelectorAll('[data-v210-grid-score]')];
  for(const el of items)v221CancelTimer(el);
  for(const el of items){
    if(!(await v221PersistInput(el)))return false;
  }
  return true;
}
const v221WireBefore=wire;
wire=function(){
  v221WireBefore();
  if(view!=='evaluation'||v200Eval?.step!==4)return;
  const cells=[...document.querySelectorAll('[data-v210-grid-score]')];
  for(const el of cells){
    el.dataset.v221Saved=el.value.trim();
    if(el.dataset.v221Digital==='1'){
      el.readOnly=true;
      el.addEventListener('click',()=>v221UnlockDigital(el));
      el.addEventListener('keydown',e=>{
        if(e.key==='F2'||(e.key===' '&&el.readOnly)){
          e.preventDefault();v221UnlockDigital(el);
        }
      });
    }
    const save=()=>{v221CancelTimer(el);return v221Queue(()=>v221PersistInput(el));};
    el.addEventListener('input',()=>{
      v221CancelTimer(el);
      if(el.readOnly||el.disabled)return;
      v221Notice('Eingabe wird lokal gespeichert …','progress');
      v221Timers.set(el,setTimeout(()=>{v221Timers.delete(el);void save();},650));
    });
    el.onchange=()=>{void save();};
    el.addEventListener('blur',()=>{if(el.dataset.v221Saved!==el.value.trim())void save();});
    el.onkeydown=async event=>{
      if(event.key!=='Enter')return;
      event.preventDefault();
      if(el.dataset.v221Digital==='1'&&el.readOnly){
        // An imported value is never part of the normal Enter sequence.
      }else if(!await save())return;
      const next=v221EligibleNext(cells,el);
      if(next){next.focus();next.select();}
      else v221Notice('✓ Alle aktuell offenen Papier- und Bonusfelder bearbeitet. '
        +'Du kannst die Ergebnisse prüfen oder vorhandene Punkte gezielt ändern.','success');
    };
  }
  // Guard navigation against an unsaved, invalid last edit.
  for(const button of document.querySelectorAll('[data-v200-step]')){
    if(Number(button.dataset.v200Step)!==5)continue;
    const previous=button.onclick;
    button.onclick=async e=>{
      button.disabled=true;
      try{
        const success=await v221Queue(v221SaveAllVisible);
        if(success)return previous?.call(button,e);
      }finally{if(button.isConnected)button.disabled=false;}
    };
  }
};
const v221RenderBefore=render;
render=function(){
  v221RenderBefore();
  const el=document.querySelector('.brand small');
  if(el)el.textContent=state.settings.schoolYear+' · '+V221_VERSION;
};
render();