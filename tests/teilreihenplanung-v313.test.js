'use strict';
const assert=require('node:assert/strict');
const C=require('../schulcockpit-teilreihenplanung-v313-core.js');
const ctx={
 course:{id:'religion9',subject:'Religion',name:'9'},
 sequence:{id:'tod-trauer',title:'Tod und Trauer'},
 deliverable:{title:'Trauerglas',deadline:'2026-12-08',
  type:'Kreative Ersatzleistung',description:'Gestalterische Arbeit mit Erläuterung'},
 heldUnits:[
  {id:'held-1',plannedDate:'2026-10-20'},
  {id:'held-2',plannedDate:'2026-10-27'}],
 openUnits:[
  {id:'abgabe',plannedDate:'2026-12-08',title:'Gestaltung und Abgabe'},
  {id:'jenseits',plannedDate:'2026-11-17',title:'Was kommt nach dem Tod?'},
  {id:'trost',plannedDate:'2026-11-24',title:'Trost'}],
 materials:[
  {ref:'s:rubric',name:'Bewertungskriterien Trauerglas.pdf',available:true,teacherOnly:true},
  {ref:'m:worksheet',name:'Jenseitsvorstellungen.pdf',available:true},
  {ref:'c:missing',name:'Hilfe AB.pdf',available:false}
 ]
};
function complete(){
 return {schema:C.SCHEMA,courseId:ctx.course.id,sequenceId:ctx.sequence.id,
 deliverable:{...ctx.deliverable},
 materialAudit:[
  {ref:'s:rubric',verdict:'teacher_only',reason:'Kriterien nur Lehrkraft, keine Unterrichtsstunde'},
  {ref:'m:worksheet',verdict:'usable',reason:'Nutzbare Schülerquellen'},
  {ref:'c:missing',verdict:'unknown',reason:'Original fehlt'}],
 units:ctx.openUnits.map(u=>({
  unitId:u.id,plannedDate:u.plannedDate,title:u.title+' – neu',
  content:'Schüler erarbeiten begründete Positionen und sichern Ergebnisse.',
  objective:'Eine Position begründet darstellen',notes:'',
  studentMaterialRefs:u.id==='jenseits'?['m:worksheet']:[],
  bookTasks:[],needsNewWorksheet:u.id==='trost',
  worksheetBrief:u.id==='trost'?'Ein neues AB mit Quellentexten, AFB I–III, 25 Minuten':'',
  additionalPreparation:'Material prüfen',teachingReason:'Thematisch vertiefen'}))
 };
}
const pkg=complete(),block='<SCHULCOCKPIT_PARTIAL_SEQUENCE_IMPORT>\n'+
 JSON.stringify(pkg)+'\n</SCHULCOCKPIT_PARTIAL_SEQUENCE_IMPORT>';
assert.equal(C.validate('Planung:\n'+block,ctx).units.length,3);
assert(C.validDate('2026-12-08'));
assert(!C.validDate('2026-02-30'));
assert.throws(()=>C.validate('unstructured answer',ctx),/IMPORT/);
for(const [bad,regex] of [
 [x=>x.sequenceId='other',/anderen/],
 [x=>x.courseId='other',/anderen/],
 [x=>x.deliverable.deadline='2026-12-15',/Abgabetermin/],
 [x=>x.deliverable.title='Anderes Produkt',/Trauerglas/],
 [x=>x.units[1].unitId='held-1',/gehaltenen/],
 [x=>x.units.pop(),/genau/],
 [x=>x.units.push({...x.units[0]}),/genau/],
 [x=>x.units[1].plannedDate='2026-11-18',/Termin/],
 [x=>x.materialAudit[0].verdict='usable',/Lehrkraft|Materialauswahl|nutzbar|begründete/],
 [x=>x.units[0].studentMaterialRefs=['s:rubric'],/nutzbare/],
 [x=>x.units[0].studentMaterialRefs=['c:missing'],/nutzbare/],
 [x=>x.materialAudit[2].verdict='usable',/nicht als Original verfügbar/],
 [x=>x.materialAudit.pop(),/alle/],
 [x=>x.materialAudit[0].reason='',/unbegründete/],
 [x=>{x.units[2].needsNewWorksheet=true;x.units[2].worksheetBrief='';},/Arbeitsblatt/]
]){
 const x=structuredClone(pkg);bad(x);
 assert.throws(()=>C.validate(x,ctx),regex);
}
const prompt=C.prompt(ctx);
assert.match(prompt,/AUSSCHLIESSLICH den noch offenen Rest/);
assert.match(prompt,/Trauerglas/);
assert.match(prompt,/2026-12-08/);
assert.match(prompt,/Lehrkraft/);
assert.match(prompt,/GEHALTEN/);
assert.match(prompt,/nicht erneut|UNVERÄNDERT/);
assert.match(prompt,/worksheetBrief/);
assert.match(prompt,/nicht als Schülerarbeitsblatt/);
assert.match(prompt,/SCHULCOCKPIT_PARTIAL_SEQUENCE_IMPORT/);
console.log('V313 partial prompt and import validation: held hours frozen, deadline fixed, role audit, no invented material and new worksheet required OK');
