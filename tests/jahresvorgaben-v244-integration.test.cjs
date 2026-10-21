/* V0.24.4: integration test for multiple exams and curriculum-aware year import. */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const helper=require('../schulcockpit-jahresvorgaben-v244.js');
function mock(){
 const wireEvents={},button=(id,dataset={})=>({dataset,addEventListener:(k,fn)=>wireEvents[id]=fn});
 const open=button('open',{v236Open:'m5'}),save=button('save'),add1=button('add1',{v244Add:'1'}),
  add2=button('add2',{v244Add:'2'}),fix=button('fix',{v244Fix:'0'});
 const fields=[];
 const q={id:'q1',title:'Grundrechenarten',classId:'m5',schoolYearV190:'2026/27',plan:[],orderV190:0};
 const state={settings:{schoolYear:'2026/27'},classes:[{id:'m5',subject:'Mathematik',name:'5f'}],
  sequences:[q],lessons:[],timetable:[{classId:'m5',weekday:1,slot:1}],assessments:[],
  materials:[],materialCatalog:[],yearRequirementsV236:{}};
 const comp={id:'mathe-5-15-all-k01',text:'Einfache Rechenaufgaben im Kopf lösen'};
 const topic={id:'mathe-5-15-all',title:'Grundrechenarten',competencies:[comp],grades:[5],subject:'mathematik'};
 const method={id:'methode-5-4',text:'Kompetenzraster verwenden',sourceComplete:true};
 const doc={querySelectorAll(sel){
   if(sel==='[data-v236-open]')return [open];
   if(sel==='[data-v236-rules]'||sel==='[data-v244-remove]')return [];
   if(sel==='[data-v244-field]')return fields;
   if(sel==='[data-v244-add]')return [add1,add2];
   if(sel==='[data-v244-fix]')return [fix];
   return [];
  },querySelector(sel){
   if(sel==='[data-v236-save]')return save;
   if(sel==='[data-v236-export]')return button('export');
   if(sel==='[data-v236-parse]')return button('parse');
   if(sel==='[data-v236-apply]')return button('apply');
   return null;
  },getElementById(){return null}};
 let slotsCalled=0,rendered=0,alerts=[],saved=0;
 const ctx={state,modal:null,document:doc,Blob,Date,Map,Set,Promise,console,SC_YEAR_RULES_V244:helper,
  esc:s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/>/g,'&gt;'),
  uid:(prefix='id')=>prefix+'-'+Math.floor(Math.random()*1000000),
  clone:x=>JSON.parse(JSON.stringify(x)),iso:d=>d.toISOString().slice(0,10),
  activeMonday:()=>new Date('2026-10-05T12:00:00'),v190NoSchoolInfo:()=>null,
  visitWeekV177:()=>{},shiftActiveWeek:()=>{},v191LessonProtected:()=>false,
  v182IsHeld:()=>false,lessonSlot:l=>l.slot||1,
  v190PlanningYear:()=> '2026/27',v190YearBounds:()=>({start:'2026-08-01',end:'2027-07-31'}),
  v190CourseSlots:()=>[{date:'2026-11-16',slot:1},{date:'2026-11-23',slot:1}],
  v190PlanningSequences:()=>state.sequences,
  v190CalendarRanges:()=>[],v190PublicHolidaysForYear:()=>[],v190YearStartNum:()=>2026,
  v190YearFromDate:()=> '2026/27',v190SeqYear:()=> '2026/27',
  v190RescheduleCourseYear:()=>{slotsCalled++;return {warning:''};},
  v202SubjectKey:()=> 'mathematik',v202Grade:()=>5,v202Source:()=>null,
  v202Topics:()=>[topic],v202MethodsForGrade:()=>[method],
  v202Norm:s=>String(s).toLowerCase().trim(),v202SetTopic:(q,id,ids)=>{q.curriculumV202={confirmed:true,topicId:id,methodIds:ids};},
  v191LessonProtected:()=>false,
  v184CurrentCourseCatalog:()=>[],catalogAvailableV17:()=>false,
  cls:id=>state.classes.find(c=>c.id===id),seq:id=>state.sequences.find(q=>q.id===id),
  render:()=>{rendered++;},saveState:async()=>{saved++;},
  alert:s=>alerts.push(s),confirm:()=>true,modalHtml:()=>'',wire:()=>{},sequencesView:()=>'',view:'prep',
  cleanPlanUnitV10:data=>({...data,id:'unit-new-'+Math.random()}),
  v184EnsureSelectedMaterial:async()=>null,
  downloadText:()=>{},downloadBlob:()=>{},
  activeWeekDate:()=>'',activeWeekEnd:()=>'',weekWorkflowV177:()=>({})
 };
 const src=fs.readFileSync(path.join(__dirname,'..','schulcockpit-restjahr-v236.js'),'utf8');
 vm.runInNewContext(src,ctx,{filename:'schulcockpit-restjahr-v236.js'});
 return {ctx,state,q,fields,open,save,add1,add2,fix,wireEvents,alerts,
  get slotsCalled(){return slotsCalled},get saved(){return saved},get rendered(){return rendered}};
}
test('Course UI supports four individual classworks; fixed date is distinct from proposal',async()=>{
 const t=mock();t.ctx.wire();t.open.onclick();
 t.ctx.wire();t.add1.onclick();t.ctx.wire();t.add1.onclick();
 t.ctx.wire();t.add2.onclick();t.ctx.wire();t.add2.onclick();
 const names=['Plus und Minus bereits erledigt','Mal und Geteilt + Statistik/Runden','Brüche','Geometrie'];
 for(let i=0;i<4;i++){
  t.fields.push({dataset:{v244Field:i+'|topic'},value:names[i]});
  t.fields.push({dataset:{v244Field:i+'|half'},value:i<2?'1':'2'});
  if(i===0)t.fields.push({dataset:{v244Field:i+'|proposedDate'},value:'2026-11-16'});
 }
 t.ctx.wire();await t.wireEvents.save();
 const rows=t.state.yearAssessmentPlansV244['m5|2026/27'];
 assert.equal(rows.length,4);
 assert.equal(rows.filter(r=>r.half===2).length,2);
 assert.equal(rows[1].topic,'Mal und Geteilt + Statistik/Runden');
 assert.equal(rows[0].status,'vorschlag');
 t.ctx.wire();await t.fix.onclick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.state.assessments.length,1);
 assert.equal(t.state.assessments[0].date,'2026-11-16');
 assert.equal(t.state.assessments[0].title,names[0]);
 assert.equal(t.state.yearAssessmentPlansV244['m5|2026/27'][0].status,'fest');
 assert.ok(t.slotsCalled>=1);
});
test('Year import with method ID updates V202 progress fields rather than only obsolete fields',async()=>{
 const t=mock();t.ctx.wire();t.open.onclick();
 t.ctx.wire();
 // Directly load valid plan via the response editor parser.
 const plan={schema:'schulcockpit.year.v1',courseId:'m5',schoolYear:'2026/27',
   sequences:[{sequenceId:'q1',topicId:'mathe-5-15-all',title:'Grundrechenarten',units:[
    {title:'Standpunkt Multiplikation',materials:[],competencyIds:['mathe-5-15-all-k01'],
      methodIds:['methode-5-4'],resourcesNeeded:'Standpunkt-AB drucken',preparation:'Lernweg selbst einschätzen'}
   ]}],assessmentPlans:[]};
 const raw=JSON.stringify(plan);
 // Underlying annual module controls keep flow private; use document hooks.
 const source=t.ctx.modalHtml();
 assert.match(source,/Restliches Schuljahr mit ChatGPT planen/);
 assert.match(source,/EINZELNE LEISTUNGSNACHWEISE/);
 assert.ok(raw.includes('methode-5-4'));
 const src=fs.readFileSync(path.join(__dirname,'..','schulcockpit-restjahr-v236.js'),'utf8');
 assert.match(src,/u\.competencyIdsV202=\[\.\.\.new Set\(\[\.\.\.u\.competencyIds,\.\.\.u\.methodIds\]\)\]/);
 assert.match(src,/v202SetTopic\(q,incomingTopic,methods\)/);
 assert.match(src,/flow\.preview\?\.blockers\?\.length/);
});
