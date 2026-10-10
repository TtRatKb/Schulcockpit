/* Local, same-origin event outbox. No lesson/student payload leaves Schulcockpit. */
(() => {
  "use strict";
  const KEY="life-rpg:schulcockpit-events:v1", CONFIG="life-rpg:schulcockpit-bridge:v1";
  const TYPES=["lesson-prepared","lesson-reflected","preparation-completed","assessment-analyzed","sequence-planned"];
  let previous=null;
  // Depth is computed locally from *structure*, not from personal lesson or pupil content.
  // Exported event contains only its stable type/id/date and this small reward band.
  // The map's values are immutable snapshots when a workflow first becomes complete.
  const depth=(work,type)=>{
    if(type==="preparation-completed"){
      const prints=(work.printPlan||[]).filter(x=>x.needed!==false&&Number(x.count)>0&&!x._v183removed&&!x._v183obsolete);
      return (work.prepTasks||[]).length+prints.length>=4?"standard":"brief";
    }
    if(type==="lesson-prepared") return ((work.phasePlan||[]).length>=4 && (work.slides||[]).length>=5)?"extended":"standard";
    if(type==="lesson-reflected"){
      const r=work.reflectionV182||{};
      const structured=[r.overall,r.timing,r.learning].filter(Boolean).length;
      return (structured>=2 && String(r.note||'').trim().length>=80)?"standard":"brief";
    }
    if(type==="assessment-analyzed"){
      const an=work.evaluationV200?.analysis||{};
      return (an.items||[]).length>=8 && (an.competencies||[]).length>=4?"extended":"substantial";
    }
    if(type==="sequence-planned") return (work.plan||[]).length>=8?"extended":"substantial";
    return "brief";
  };
  function projection(s) {
    const p={};
    const add=(id,type,done,band)=>{
      if(/^[a-zA-Z0-9_-]{1,120}$/.test(String(id)))p[`${type}:${id}`]={done:!!done,band:band||"brief"};
    };
    for(const l of s.lessons || []) {
      add(l.id,TYPES[0],!!window.concretePlanReadyV12?.(l) || !!l.manualPlanReadyV177 || l.status==="ready",depth(l,TYPES[0]));
      add(l.id,TYPES[1],!!l.reflectionV182?.completedAt,depth(l,TYPES[1]));
      const tasks=l.prepTasks || [], prints=(l.printPlan || []).filter(x=>x.needed!==false && Number(x.count)>0&&!x._v183removed&&!x._v183obsolete);
      add(l.id,TYPES[2],tasks.length+prints.length>0 && tasks.every(t=>t.done) && prints.every(x=>x.alreadyPrinted),depth(l,TYPES[2]));
    }
    // Actual assessments are stored in assessmentsV188 in current Schulcockpit.
    for(const a of (s.assessmentsV188 || s.assessments || [])) {
      const an=a.evaluationV200?.analysis;
      add(a.id,TYPES[3],!!an?.competencies?.length && !!an?.items?.length,depth(a,TYPES[3]));
    }
    for(const q of (s.sequences||[])) {
      const units=(q.plan||[]).filter(u=>String(u.title||'').trim() &&
        (String(u.content||'').trim() || String(u.objective||'').trim()) && String(u.plannedDate||'').trim());
      // A title-only or generated empty sequence is NOT a completed planning workflow.
      add(q.id,TYPES[4],units.length>=3 && !!String(q.goal||'').trim(),depth(q,TYPES[4]));
    }
    return p;
  }
  function baseline(s) { previous=projection(s); }
  async function observe(next) {
    if(!previous) {previous=next;return;}
    const old=previous;previous=next;
    try {
      const config=JSON.parse(localStorage.getItem(CONFIG) || "null");
      if(!config?.enabled) return;
      const changes=Object.keys(next).filter(k=>old[k]?.done===false && next[k]?.done===true);
      if(!changes.length)return;
      const write=()=>{
        const queue=JSON.parse(localStorage.getItem(KEY) || '{"schema":1,"events":[]}');
        if(queue.schema!==1 || !Array.isArray(queue.events))throw Error("Unbekanntes Bridge-Format");
        for(const id of changes)if(!queue.events.some(e=>e.eventId===id)) {
          queue.events.push({schema:1,source:"schulcockpit",eventId:id,type:id.split(":")[0],completedAt:new Date().toISOString(),rewardSchema:2,effortBand:next[id].band});
        }
        localStorage.setItem(KEY,JSON.stringify(queue));
        window.dispatchEvent(new Event("life-rpg:school-outbox-updated"));
      };
      if(navigator.locks?.request)await navigator.locks.request(KEY,write);else write();
    } catch(e) {
      previous=old;
      console.error("Life RPG bridge could not persist completion",e);
      alert("Schulcockpit ist gespeichert. Die Life-RPG-Verknüpfung konnte den Abschluss noch nicht speichern. Bitte diesen Tab offen lassen und erneut speichern; keine Browserdaten löschen.");
    }
  }
  window.LifeRPGSchoolBridge={baseline,projection,observe,_test:{depth}};
})();
