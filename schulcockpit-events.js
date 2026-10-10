/* Local, same-origin event outbox. No lesson/student payload leaves Schulcockpit. */
(() => {
  "use strict";
  const KEY="life-rpg:schulcockpit-events:v1", CONFIG="life-rpg:schulcockpit-bridge:v1";
  const TYPES=["lesson-prepared","lesson-reflected","preparation-completed","assessment-analyzed"];
  let previous=null;
  function projection(s) {
    const p={};
    const add=(id,type,done)=>{ if(/^[a-zA-Z0-9_-]{1,120}$/.test(String(id)))p[`${type}:${id}`]=!!done; };
    for(const l of s.lessons || []) {
      add(l.id,TYPES[0],!!window.concretePlanReadyV12?.(l) || !!l.manualPlanReadyV177 || l.status==="ready");
      add(l.id,TYPES[1],!!l.reflectionV182?.completedAt);
      const tasks=l.prepTasks || [], prints=(l.printPlan || []).filter(p=>p.needed!==false && Number(p.count)>0);
      add(l.id,TYPES[2],tasks.length+prints.length>0 && tasks.every(t=>t.done) && prints.every(p=>p.alreadyPrinted));
    }
    for(const a of s.assessments || []) {
      const an=a.evaluationV200?.analysis;
      add(a.id,TYPES[3],!!an?.competencies?.length && !!an?.items?.length);
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
      const changes=Object.keys(next).filter(k=>old[k]===false && next[k]===true);
      if(!changes.length)return;
      const write=()=>{
        const queue=JSON.parse(localStorage.getItem(KEY) || '{"schema":1,"events":[]}');
        if(queue.schema!==1 || !Array.isArray(queue.events))throw Error("Unbekanntes Bridge-Format");
        for(const id of changes)if(!queue.events.some(e=>e.eventId===id)) {
          queue.events.push({schema:1,source:"schulcockpit",eventId:id,type:id.split(":")[0],completedAt:new Date().toISOString()});
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
  window.LifeRPGSchoolBridge={baseline,projection,observe};
})();
