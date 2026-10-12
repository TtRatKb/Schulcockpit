/* DZ49 — anonymisierte Schulcockpit-Arbeitsschritte, erst NACH erfolgreichem lokalen Save. */
(() => {
  "use strict";
  const KEY="life-rpg:schulcockpit-events:v1", CONFIG="life-rpg:schulcockpit-bridge:v1";
  const CORE=["lesson-prepared","lesson-reflected","preparation-completed","assessment-analyzed","sequence-planned"];
  const TYPES=[...CORE,"assessment-filed","assessment-corrected","assessment-makeup-scheduled","assessment-makeup-written","assessment-competency-raster","assessment-returned"];
  let previous=null,started=false,chain=Promise.resolve();
  const stamp=()=>new Date().toISOString();
  const legal=id=>/^[a-zA-Z0-9_-]{1,120}$/.test(String(id||""));
  const depth=(work,type)=>{
    if(type==="preparation-completed"){
      const prints=(work.printPlan||[]).filter(x=>x.needed!==false&&Number(x.count)>0&&!x._v183removed&&!x._v183obsolete);
      return (work.prepTasks||[]).length+prints.length>=4?"standard":"brief";
    }
    if(type==="lesson-prepared")return (work.phasePlan||[]).length>=4&&(work.slides||[]).length>=5?"extended":"standard";
    if(type==="lesson-reflected"){
      const r=work.reflectionV182||{};
      return [r.overall,r.timing,r.learning].filter(Boolean).length>=2&&String(r.note||'').trim().length>=80?"standard":"brief";
    }
    if(type==="assessment-analyzed"){
      const an=work.evaluationV200?.analysis||{};
      return (an.items||[]).length>=8&&(an.competencies||[]).length>=4?"extended":"substantial";
    }
    if(type==="sequence-planned")return (work.plan||[]).length>=8?"extended":"substantial";
    return "brief";
  };
  // Historical peak is used instead of the current count. Undo+redo must never repay a paper.
  function correctedSlots(w){
    let balance=0,peak=0;const slots={};
    for(const event of (Array.isArray(w?.correctionEvents)?w.correctionEvents:[])){
      const delta=Number(event?.delta);
      if(!Number.isSafeInteger(delta)||Math.abs(delta)>60)continue;
      balance=Math.max(0,Math.min(60,balance+delta));
      for(let i=peak+1;i<=balance;i++)slots[i]=typeof event.at==='string'&&Number.isFinite(Date.parse(event.at))?event.at:stamp();
      peak=Math.max(peak,balance);
    }
    return {peak,slots};
  }
  function projection(s){
    const p={};
    const add=(id,type,done,band="brief",completedAt="")=>{
      if(legal(id)||(type.startsWith("assessment-")&&/^[a-zA-Z0-9_-]{1,120}:[a-zA-Z0-9_-]{1,120}$/.test(String(id))))p[`${type}:${id}`]={done:!!done,band,completedAt};
    };
    for(const l of s.lessons||[]){
      add(l.id,CORE[0],!!window.concretePlanReadyV12?.(l)||!!l.manualPlanReadyV177||l.status==='ready',depth(l,CORE[0]));
      add(l.id,CORE[1],!!l.reflectionV182?.completedAt,depth(l,CORE[1]));
      const tasks=l.prepTasks||[],prints=(l.printPlan||[]).filter(x=>x.needed!==false&&Number(x.count)>0&&!x._v183removed&&!x._v183obsolete);
      add(l.id,CORE[2],tasks.length+prints.length>0&&tasks.every(t=>t.done)&&prints.every(x=>x.alreadyPrinted),depth(l,CORE[2]));
    }
    for(const a of s.assessmentsV188||s.assessments||[]){
      if(!legal(a.id))continue;
      const an=a.evaluationV200?.analysis;
      add(a.id,"assessment-analyzed",!!an?.competencies?.length&&!!an?.items?.length,depth(a,"assessment-analyzed"));
      add(a.id,"assessment-filed",Array.isArray(a.files)&&a.files.some(f=>!!f?.fileKey));
      const w=a.correctionV203||{};
      const {peak,slots}=correctedSlots(w);
      // Each paper gets its OWN stable ID; +5 creates five independent events.
      for(let i=1;i<=peak;i++)add(`${a.id}:${i}`,"assessment-corrected",true,"brief",slots[i]);
      for(const m of (Array.isArray(w.makeups)?w.makeups:[])){
        if(!legal(m.id))continue;
        add(`${a.id}:${m.id}`,"assessment-makeup-scheduled",!!m.scheduledDate);
        add(`${a.id}:${m.id}`,"assessment-makeup-written",!!m.writtenAt,"brief",m.writtenAt);
      }
      add(a.id,"assessment-competency-raster",!!a.rewardMilestonesV49?.competencyRasterCreatedAt,"brief",a.rewardMilestonesV49?.competencyRasterCreatedAt);
      add(a.id,"assessment-returned",!!w.returnedAt,"brief",w.returnedAt);
    }
    for(const q of s.sequences||[]){
      const units=(q.plan||[]).filter(u=>String(u.title||'').trim()&&(String(u.content||'').trim()||String(u.objective||'').trim())&&String(u.plannedDate||'').trim());
      add(q.id,"sequence-planned",units.length>=3&&!!String(q.goal||'').trim(),depth(q,"sequence-planned"));
    }
    return p;
  }
  function baseline(s){previous=projection(s);}
  function observe(next){
    if(!previous){previous=next;return Promise.resolve(0);}
    const old=previous;previous=next;
    try{
      const config=JSON.parse(localStorage.getItem(CONFIG)||'null');
      if(!config?.enabled)return Promise.resolve(0);
      const keys=Object.keys(next).filter(id=>next[id].done===true&&old[id]?.done!==true);
      if(!keys.length)return Promise.resolve(0);
      const queue=JSON.parse(localStorage.getItem(KEY)||'{"schema":1,"events":[]}');
      if(queue.schema!==1||!Array.isArray(queue.events))throw Error('Unbekanntes Bridge-Format');
      const seen=new Set(queue.events.map(e=>e.eventId));let added=0;
      for(const id of keys){
        if(seen.has(id))continue;
        const type=id.slice(0,id.indexOf(':'));
        if(!TYPES.includes(type))continue;
        const item=next[id];
        // The corrected slot timestamp can be historical, but we only pay for NEW transitions observed after enrollment.
        const at=type==='assessment-corrected'?(item.completedAt||stamp()):stamp();
        const e={schema:1,source:'schulcockpit',eventId:id,type,completedAt:at,rewardSchema:3};
        if(CORE.includes(type)){e.rewardSchema=2;e.effortBand=item.band;}
        queue.events.push(e);seen.add(id);added++;
      }
      if(added){
        localStorage.setItem(KEY,JSON.stringify(queue));
        window.dispatchEvent(new Event('life-rpg:school-outbox-updated'));
      }
      return Promise.resolve(added);
    }catch(e){
      previous=old;console.error('Life RPG Schulcockpit Outbox nicht gespeichert',e);
      alert('Schulcockpit wurde gespeichert, aber der Life-RPG-Reward-Log konnte nicht gespeichert werden. Bitte nicht die Browserdaten löschen.');
      return Promise.reject(e);
    }
  }
  window.LifeRPGSchoolBridge={baseline,projection,observe,_test:{depth,correctedSlots}};
  // app.js initializes its authoritative IndexedDB asynchronously: NEVER baseline the empty boot state.
  // Wrap persistence only after hydration, and only emit after its promise resolves successfully.
  const timer=setInterval(()=>{
    if(started||typeof v186Ready==='undefined'||!v186Ready)return;
    started=true;clearInterval(timer);baseline(state);
    const original=saveState;
    saveState=function(...args){
      const result=original.apply(this,args);
      const snapshot=projection(state);
      chain=chain.catch(()=>{}).then(()=>Promise.resolve(result)).then(()=>observe(snapshot));
      // Existing handlers await only their IndexedDB save. An outbox failure stays visible
      // and can be retried at the next save; it must not roll back the actual lesson save.
      chain.catch(()=>{});
      return result;
    };
    // Competency raster: reward the FIRST successful PDF export, NOT just analysis import.
    const mark=async a=>{
      if(!a||a.rewardMilestonesV49?.competencyRasterCreatedAt)return;
      a.rewardMilestonesV49={...(a.rewardMilestonesV49||{}),competencyRasterCreatedAt:stamp()};
      await saveState();
    };
    const zip=v200DownloadPdfZip;
    v200DownloadPdfZip=async function(...args){
      const a=v200Assessment(v200Eval?.assessmentId),result=await zip.apply(this,args);
      if(result===true)await mark(a);
      return result;
    };
    const pdf=v200DownloadCombinedPdf;
    v200DownloadCombinedPdf=function(...args){
      const a=v200Assessment(v200Eval?.assessmentId),result=pdf.apply(this,args);
      if(result===true)mark(a).catch(err=>console.error('Kompetenzraster-Reward',err));
      return result;
    };
  },150);
})();
