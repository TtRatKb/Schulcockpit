/* Schulcockpit V0.33.24 – searchable link index for the physical archive.
 * Read-only normalization of material variants and catalog entries. Never touches
 * file blobs, catalog assignments, grades, lesson plans or existing archive entries.
 */
(function(root){
'use strict';
function text(v){return String(v??'').trim();}
function norm(v){
 return text(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/ß/g,'ss').replace(/\s+/g,' ').trim();
}
function unique(values){return [...new Set(values.filter(Boolean).map(text))];}
function subject(raw){
 const n=norm(raw);
 if(n==='mathematik'||n==='mathe'||n==='math')return 'Mathematik';
 if(n==='religion'||n==='reli'||n==='ev religion'||n==='evangelische religion')return 'Religion';
 return '';
}
function fromPathSubject(path){
 const n=norm(path);
 const m=/(?:^|[ /\\._-])(mathe|mathematik)(?:$|[ /\\._-])/i.test(n);
 const r=/(?:^|[ /\\._-])(religion|reli)(?:$|[ /\\._-])/i.test(n);
 return m!==r?(m?'Mathematik':'Religion'):'';
}
function grade(v){
 const n=Number(v);
 return Number.isInteger(n)&&n>=5&&n<=13?n:null;
}
function fromClassGrade(name){
 const match=text(name).match(/(?:^|[^\d])(1[0-3]|[5-9])(?=[a-z]?(?:$|[\s,;._/-]))/i);
 return grade(match?.[1]);
}
function fromPathGrade(path){
 const p=text(path).replace(/\\/g,'/');
 const folder=p.split('/').slice(0,-1).join('/');
 const m=folder.match(/(?:^|\/)(?:klasse|jahrgang|jg[._-]?|stufe|mathe|mathematik|religion|reli)\s*[-_ /]*(1[0-3]|[5-9])(?=[a-z]?(?:\/|$|[\s._-]))/i)
  ||folder.match(/(?:^|\/)(1[0-3]|[5-9])[a-z]?(?=\/|$)/i);
 return grade(m?.[1]);
}
function folderTopic(path){
 const dirs=text(path).replace(/\\/g,'/').split('/').filter(Boolean);
 if(dirs.length<2)return '';
 const folder=dirs[dirs.length-2].trim();
 if(/^(?:[5-9]|1[0-3])[a-z]?$|^schuljahr|^(?:materialien?|arbeitsblaetter|arbeitsblätter|ab|docs|dateien|downloads|loesungen|lösungen)$/i.test(folder))return '';
 return folder;
}
function build(materials=[],catalog=[],classes=[],sequences=[]){
 const cls=new Map(classes.map(c=>[String(c.id),c])),
   seq=new Map(sequences.map(s=>[String(s.id),s])),out=[],seen=new Set();
 function add(row,metadata,context={}){
  if(!row.id||seen.has(row.id))return;
  seen.add(row.id);
  const h=metadata?.hubV237||{},h238=metadata?.hubV238||{};
  let subjects=unique([subject(h.subject)]),grades=unique([grade(h.grade)]).map(Number);
  const candidateCourses=unique([h.courseId,context.courseId,
   ...(Array.isArray(context.assignments)?context.assignments.map(a=>a.classId):[])]);
  for(const cid of candidateCourses){
   const c=cls.get(cid);
   if(!c)continue;
   if(!subjects.length){const sub=subject(c.subject);if(sub)subjects.push(sub);}
   if(!grades.length){const g=grade(c.grade)||fromClassGrade(c.name);if(g)grades.push(g);}
  }
  if(!subjects.length){
   const sub=fromPathSubject([metadata?.courseLabel,metadata?.sourcePath,
    metadata?.sourceArchive,metadata?.fileName,context?.title].filter(Boolean).join('/'));
   if(sub)subjects.push(sub);
  }
  if(!grades.length){
   const g=fromClassGrade(metadata?.courseLabel)||fromPathGrade(metadata?.sourcePath);
   if(g)grades.push(g);
  }
  const topics=unique([
   seq.get(String(h.sequenceId||''))?.title,
   ...((context.assignments||[]).map(a=>seq.get(String(a.sequenceId||''))?.title)),
   context.sequenceTitle,metadata?.sequenceTitle,
   h238.archiveTopic,h238.topicPath,
   ...(context.topics||[])
  ]);
  const fallback=folderTopic(metadata?.sourcePath);
  if(!topics.length&&fallback)topics.push(fallback);
  const path=[metadata?.sourceArchive,metadata?.sourcePath].filter(Boolean).join(' / ');
  const label=[subjects.join(', '),grades.length?'Jg. '+grades.join(', '):'',
   topics[0]||''].filter(Boolean).join(' · ');
  const searchText=norm([row.title,row.filename,context.title,path,metadata?.courseLabel,
   metadata?.sourcePath,subjects.join(' '),grades.join(' '),topics.join(' ')].filter(Boolean).join(' '));
  out.push({...row,subjects,grades,topics,path,label,searchText});
 }
 for(const m of materials||[]){
  if(!m?.id)continue;
  const variants=m.variants||[];
  for(const v of variants){
   if(!v?.id)continue;
   const filename=text(v.fileName||v.label||v.type||'Fassung');
   const title=text(m.title||'Material');
   add({id:'m:'+m.id+':'+v.id,title,filename,
    kind:v.type==='solution'||v.type==='teacher'?'Lehrkraftdatei':'Materialfassung'},
    m,{title,assignments:m.assignments||[],courseId:m.hubV237?.courseId,
       sequenceTitle:m.sequenceTitle,
       topics:[m.topic,m.unit].filter(Boolean)});
  }
 }
 for(const c of catalog||[]){
  if(!c?.catalogId)continue;
  add({id:'c:'+c.catalogId,title:text(c.fileName||c.title||'Katalogdatei'),
    filename:text(c.fileName||c.title||'Datei'),kind:'Katalogdatei'},c,{});
 }
 return out.sort((a,b)=>a.title.localeCompare(b.title,'de',{sensitivity:'base'})
  ||a.filename.localeCompare(b.filename,'de',{sensitivity:'base'})
  ||a.id.localeCompare(b.id));
}
function filter(rows,criteria={}){
 const sub=text(criteria.subject),gr=grade(criteria.grade),topic=text(criteria.topic);
 const terms=norm(criteria.search).split(/\s+/).filter(Boolean);
 return rows.filter(row=>
  (!sub||row.subjects.includes(sub))&&
  (!gr||row.grades.includes(gr))&&
  (!topic||row.topics.includes(topic))&&
  terms.every(t=>row.searchText.includes(t)));
}
function facets(rows,criteria={}){
 const sub=text(criteria.subject),gr=grade(criteria.grade);
 const subjectRows=filter(rows,{subject:sub});
 const scoped=filter(rows,{subject:sub,grade:gr});
 return {
  subjects:unique(rows.flatMap(r=>r.subjects)).sort((a,b)=>a.localeCompare(b,'de')),
  grades:[...new Set(subjectRows.flatMap(r=>r.grades))].sort((a,b)=>a-b),
  topics:unique(scoped.flatMap(r=>r.topics)).sort((a,b)=>a.localeCompare(b,'de',{sensitivity:'base'}))
 };
}
const api={build,filter,facets,norm};
root.SchulcockpitPhysicalArchiveSearchV3324=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
