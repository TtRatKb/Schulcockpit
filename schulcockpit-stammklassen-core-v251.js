/* Schulcockpit 0.25.1 – pure privacy-safe master-class merge logic.
   Never uploads pupils, alters points or overwrites existing course identities. */
(function(root){
'use strict';
const PREFIX='__sc_masterclass_v251__:';
const INDEX_KEY=PREFIX+'index';
const ID=(id)=>PREFIX+String(id||'');
function norm(name){
 return String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
   .replace(/[^a-z0-9]+/g,' ').trim();
}
function nameOf(s){return String(s||'').trim().replace(/\s+/g,' ').slice(0,120);}
function validate(roster){
 if(!Array.isArray(roster)||roster.length>250)throw Error('Eine Klassenliste darf maximal 250 Kinder enthalten.');
 const ids=new Set(),names=new Set();
 for(const s of roster){
  const id=String(s?.id||''),name=nameOf(s?.name),key=norm(name);
  if(!id||!name||!key||ids.has(id)||names.has(key))throw Error('Doppelte oder ungültige Schüler-ID bzw. Name in der Klassenliste.');
  ids.add(id);names.add(key);
 }
 return true;
}
function makePlan(master,course){
 validate(master);validate(course);
 const byMaster=new Map(master.map(s=>[s.id,s]));
 const byName=new Map(course.map(s=>[norm(s.name),s]));
 const byLinked=new Map(course.filter(s=>s.masterStudentIdV251).map(s=>[s.masterStudentIdV251,s]));
 const newNames=[],matches=[],conflicts=[];
 for(const m of master){
  const linked=byLinked.get(m.id);
  if(linked){
   if(norm(linked.name)!==norm(m.name))conflicts.push({id:m.id,courseId:linked.id,masterName:m.name,courseName:linked.name,reason:'Namen unterscheiden sich'});
   else matches.push({id:m.id,courseId:linked.id});
   continue;
  }
  const existing=byName.get(norm(m.name));
  if(existing){
   if(existing.masterStudentIdV251&&existing.masterStudentIdV251!==m.id){
    conflicts.push({id:m.id,courseId:existing.id,masterName:m.name,courseName:existing.name,reason:'Anderer Stammdatensatz verknüpft'});
   }else matches.push({id:m.id,courseId:existing.id});
  }else newNames.push({id:m.id,name:m.name});
 }
 const orphanLinks=course.filter(s=>s.masterStudentIdV251&&!byMaster.has(s.masterStudentIdV251));
 for(const s of orphanLinks)conflicts.push({id:s.masterStudentIdV251,courseId:s.id,masterName:'',courseName:s.name,reason:'Stammdatensatz fehlt'});
 return {newNames,matches,conflicts,oldCount:course.length};
}
function applyPlan(course,plan,newId){
 if(!plan||plan.conflicts?.length)throw Error('Offene Zuordnungskonflikte müssen vor dem Abgleich geprüft werden.');
 validate(course);
 const copy=course.map(s=>({...s}));
 const ids=new Set(copy.map(s=>s.id));
 for(const m of plan.matches||[]){
  const s=copy.find(x=>x.id===m.courseId);
  if(!s||s.masterStudentIdV251&&s.masterStudentIdV251!==m.id)throw Error('Veraltete oder widersprüchliche Kurszuordnung.');
  s.masterStudentIdV251=m.id;
 }
 for(const m of plan.newNames||[]){
  const id=newId();
  if(!id||ids.has(id))throw Error('Ungültige oder doppelte neue Schüler-ID.');
  ids.add(id);
  copy.push({id,name:m.name,learningSupport:false,masterStudentIdV251:m.id});
 }
 validate(copy);
 return copy;
}
const api={PREFIX,INDEX_KEY,ID,norm,nameOf,validate,makePlan,applyPlan};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.SC_MASTERCLASS_CORE_V251=api;
})(typeof globalThis!=='undefined'?globalThis:this);
