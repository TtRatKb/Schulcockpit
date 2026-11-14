/* Schulcockpit V0.32.4 – pure next-school-year transfer: no state mutation */
(function(root){
'use strict';
const txt=(x,n=2000)=>String(x??'').trim().slice(0,n);
const year=y=>/^20\d{2}\/\d{2}$/.test(String(y||''))&&Number(y.slice(5))===(Number(y.slice(0,4))+1)%100;
const next=y=>year(y)?(Number(y.slice(0,4))+1)+'/'+String((Number(y.slice(0,4))+2)%100).padStart(2,'0'):'';
function dateYear(d){if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return '';const n=Number(d.slice(0,4))-(Number(d.slice(5,7))<8?1:0);return n+'/'+String((n+1)%100).padStart(2,'0');}
function seqYear(q,active){return q.schoolYearV190||dateYear(q.startDate||q.plan?.find(u=>u.plannedDate)?.plannedDate)||active;}
function sourceSequences(state,y){const ids=new Set((state.classes||[]).map(c=>c.id));return (state.sequences||[]).filter(q=>q.id&&ids.has(q.classId)&&q.title&&seqYear(q,state.settings?.schoolYear)===y).sort((a,b)=>String(a.classId).localeCompare(String(b.classId))||Number(a.orderV190??9999)-Number(b.orderV190??9999));}
function targetCourses(state,y){const ids=new Set((state.sequences||[]).filter(q=>seqYear(q,state.settings?.schoolYear)===y).map(q=>q.classId));return (state.classes||[]).filter(c=>c.schoolYearV324===y||ids.has(c.id));}
function preview(state,input){
 const {sourceYear:from,targetYear:to}=input,errors=[],warnings=[],ids=[...new Set(input.selectedIds||[])];
 if(!year(from)||!year(to)||next(from)!==to)errors.push('Quell- und Zieljahr müssen direkt aufeinander folgen.');
 const available=new Map(sourceSequences(state,from).map(q=>[q.id,q]));
 const selected=ids.map(id=>available.get(id)).filter(Boolean);
 if(!selected.length)errors.push('Mindestens eine Reihe auswählen.');
 if(selected.length!==ids.length||selected.length>90)errors.push('Auswahl ungültig oder zu umfangreich.');
 const grouped=new Map(),classes=new Map((state.classes||[]).map(c=>[c.id,c]));
 for(const q of selected){if(!grouped.has(q.classId))grouped.set(q.classId,{course:classes.get(q.classId),sequences:[]});grouped.get(q.classId).sequences.push(q);}
 const existing=targetCourses(state,to),names=new Set();
 for(const [cid,g] of grouped){
  const source=g.course,r=input.routes?.[cid]||{};
  if(!source){errors.push('Quellkurs nicht gefunden: '+cid);continue;}
  if(r.mode==='new'){
   const name=txt(r.name,120),key=source.subject.toLowerCase()+'|'+name.toLowerCase();
   if(!name)errors.push('Neuen Kursnamen für '+source.subject+' '+source.name+' eingeben.');
   if(names.has(key))errors.push('Derselbe neue Zielkurs wurde zweimal angegeben: '+name);
   names.add(key);
   if(existing.some(c=>c.subject===source.subject&&c.name.toLowerCase()===name.toLowerCase()))
    errors.push('Dieser Zielkurs existiert bereits: '+name+'. Bitte ausdrücklich auswählen.');
  }else if(r.mode==='existing'){
   const dest=existing.find(c=>c.id===r.targetId);
   if(!dest||dest.id===cid||dest.subject!==source.subject)errors.push('Zielkurs ungültig für '+source.name);
   else{
    if((state.lessons||[]).some(l=>l.classId===dest.id&&dateYear(l.date)===from))
     errors.push('Zielkurs enthält noch Stunden des alten Schuljahres: '+dest.name);
    for(const q of g.sequences)if((state.sequences||[]).some(x=>x.classId===dest.id&&
     seqYear(x,state.settings?.schoolYear)===to&&
     (x.originSequenceIdV324===q.id||txt(x.title).toLowerCase()===txt(q.title).toLowerCase())))
       errors.push('Reihe existiert im Zielkurs bereits: '+q.title);
   }
  }else errors.push('Zielzuordnung fehlt für '+source.name);
 }
 const sourceLessons=new Set(),assigned=new Set(),files=new Set();
 for(const q of selected){
  for(const u of q.plan||[]){
   const l=(state.lessons||[]).find(l=>l.classId===q.classId&&l.planReference?.unitId===u.id&&
    l.status==='done'&&l.executionV180?.type!=='cancelled');
   if(l&&(l.phasePlan?.length||l.slides?.length))sourceLessons.add(l.id);
   for(const m of state.materials||[])if((m.assignments||[]).some(a=>a.classId===q.classId&&
    (a.unitId===u.id||(!a.unitId&&a.sequenceId===q.id))))assigned.add(m.id);
  }
  for(const f of q.sourceFilesV190||[])if(f.fileKey)files.add(f.fileKey);
 }
 warnings.push('Alte Stunden, Noten, Ist-Daten, Schülerlisten und Druckhäkchen bleiben unverändert.');
 return {errors,warnings,selected,grouped,sourceYear:from,targetYear:to,
  unitCount:selected.reduce((n,q)=>n+(q.plan||[]).length,0),
  templateCount:sourceLessons.size,materialCount:assigned.size,fileCount:files.size};
}
function isStudentMaterial(m,u){
 if(m.resourceType==='teacher'||m.kind==='teacher')return false;
 const label=txt(m.title).toLowerCase();
 if(/musterl[oö]sung|erwartungshorizont|answer.?key/.test(label))return false;
 return !(u.materialSuitabilityV313||[]).some(x=>['teacher_only','unsuitable','needs_revision'].includes(x.role)&&
  label.includes(txt(x.title).toLowerCase()));
}
function lessonContent(l){
 if(!l||l.status!=='done'||l.executionV180?.type==='cancelled')throw Error('Alte Stunde nicht durchgeführt.');
 const phasePlan=(l.phasePlan||[]).slice(0,30).map(p=>({phase:txt(p.phase,50),
  minutes:Math.max(0,Math.min(180,Number(p.minutes)||0)),title:txt(p.title,500),details:txt(p.details,2000)}));
 const fields=['type','title','statement','answer','correction','socialForm','time','material','imageMaterial'];
 const arrays=['content','steps','secondary','tertiary','solutionA','solutionB','comparison','takeaway'];
 const slides=(l.slides||[]).slice(0,50).map(s=>{
  const o={notes:''};for(const k of fields)o[k]=txt(s[k],k==='title'?500:1500);
  for(const k of arrays)o[k]=(Array.isArray(s[k])?s[k]:[]).slice(0,20).map(v=>txt(v,1000));
  return o;
 });
 return {phasePlan,slides};
}
function transfer(state,input,uid,availableKeys=[]){
 const p=preview(state,input);if(p.errors.length)throw Error(p.errors.join('\n'));
 const stored=new Set(availableKeys),classes=[...(state.classes||[])],
  sequences=[...(state.sequences||[])],materials=[...(state.materials||[])],
  matIndex=new Map(materials.map((m,i)=>[m.id,i])),lessons=state.lessons||[],
  createdClasses=[],createdSequences=[],linkedMaterials=[],classIds=new Map();
 function target(cid){
  if(classIds.has(cid))return classIds.get(cid);
  const route=input.routes[cid],src=classes.find(c=>c.id===cid);
  let id=route.targetId;
  if(route.mode==='new'){
   id=uid('class');
   const c={id,subject:src.subject,name:txt(route.name,120),students:0,color:src.color||'#806688',
    schoolYearV324:input.targetYear,originClassIdV324:cid,createdByV324:true};
   classes.push(c);createdClasses.push(c);
  }
  classIds.set(cid,id);return id;
 }
 for(const q of p.selected){
  const classId=target(q.classId),seqId=uid('seq'),unitPairs=[];
  const plan=(q.plan||[]).map(u=>{
   const source=lessons.filter(l=>l.classId===q.classId&&l.planReference?.unitId===u.id&&
    (!l.sequenceId||l.sequenceId===q.id)&&l.status==='done'&&l.executionV180?.type!=='cancelled')
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
   const clean={id:uid('unit'),plannedDate:'',title:txt(u.title,500),hours:txt(u.hours||'1',30),
    content:txt(u.content,12000),competencies:txt(u.competencies,4000),
    objective:txt(u.objective,4000),material:txt(u.material,5000),homework:txt(u.homework,3000),
    notes:'',originUnitIdV324:u.id};
   if(source&&(source.phasePlan?.length||source.slides?.length))
    clean.reuseV324={sourceLessonId:source.id,sourceDate:source.date,hadPhases:!!source.phasePlan?.length,hadSlides:!!source.slides?.length};
   if(Array.isArray(u.competencyIdsV202))clean.competencyIdsV202=u.competencyIdsV202.filter(x=>typeof x==='string').slice(0,65);
   if(Array.isArray(u.materials))clean.materials=u.materials.slice(0,30).filter(x=>x.title).map(m=>({
    title:txt(m.title,350),kind:txt(m.kind,40),variant:txt(m.variant,40),printMode:txt(m.printMode,10),
    copies:'class',reuse:!!m.reuse,materialRoleV313:txt(m.materialRoleV313,30),note:''}));
   if(u.newWorksheetDraftV313)clean.newWorksheetDraftV313={required:!!u.newWorksheetDraftV313.required,brief:txt(u.newWorksheetDraftV313.brief,1800)};
   if(Array.isArray(u.materialSuitabilityV313))clean.materialSuitabilityV313=u.materialSuitabilityV313.slice(0,30).map(x=>({
    title:txt(x.title,240),role:txt(x.role,35),reason:txt(x.reason,800)}));
   unitPairs.push({old:u,new:clean});return clean;
  });
  const sourceFilesV190=(q.sourceFilesV190||[]).filter(x=>x.fileKey&&stored.has(x.fileKey)).slice(0,80)
   .map(x=>({id:uid('source'),name:txt(x.name,230),fileKey:x.fileKey,size:Number(x.size)||0,type:txt(x.type,120)}));
  const sq={id:seqId,classId,schoolYearV190:input.targetYear,title:txt(q.title,280),
   goal:txt(q.goal,5000),hours:txt(q.hours,30),notes:'',
   startDate:'',endDate:'',assessmentDate:'',plan,sourceFilesV190,
   originSequenceIdV324:q.id,originYearV324:input.sourceYear,
   orderV190:sequences.filter(x=>x.classId===classId&&seqYear(x,state.settings?.schoolYear)===input.targetYear).length};
  for(const {old:u,new:unit} of unitPairs){
   const validLinks=[];
   for(const m of state.materials||[]){
    if(!isStudentMaterial(m,u)||!(m.assignments||[]).some(a=>a.classId===q.classId&&
     (a.unitId===u.id||(!a.unitId&&a.sequenceId===q.id))))continue;
    const i=matIndex.get(m.id),prior=materials[i],assignment={classId,sequenceId:seqId,unitId:unit.id};
    if(i===undefined||!prior)continue;
    if(!(prior.assignments||[]).some(a=>a.classId===classId&&a.unitId===unit.id)){
     materials[i]={...prior,assignments:[...(prior.assignments||[]),assignment]};
     linkedMaterials.push({materialId:m.id,...assignment});
    }
    validLinks.push(m.id);
   }
   const oldLinks=(u.materialLinksV184||[]).filter(x=>validLinks.includes(x.materialId));
   if(oldLinks.length)unit.materialLinksV184=oldLinks.map(x=>({
    materialId:x.materialId,variantId:x.variantId,catalogId:txt(x.catalogId,120),
    canonical:txt(x.canonical,260),displayTitle:txt(x.displayTitle,260),
    printMode:['bw','color','none'].includes(x.printMode)?x.printMode:'bw',copies:'class',
    reuse:!!x.reuse,kind:txt(x.kind,40)}));
  }
  sequences.push(sq);createdSequences.push(sq);
 }
 return {classes,sequences,materials,createdClasses,createdSequences,linkedMaterials,
  unitCount:p.unitCount,templateCount:p.templateCount,sourceYear:input.sourceYear,targetYear:input.targetYear};
}
const api={year,next,dateYear,seqYear,sourceSequences,targetCourses,preview,transfer,isStudentMaterial,lessonContent};
if(root)root.SchulcockpitYearTransferCoreV324=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);