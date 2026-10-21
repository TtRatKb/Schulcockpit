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
 const src=fs.readFileSync(path.join(__dirname,'..','schulcockpit-restjahr-v236.js'),'utf8')
  .replace('const previousSequences=sequencesView;',
    'globalThis.__testV244={setFlow:x=>{flow=x;},previewImport,applyImport,context}; const previousSequences=sequencesView;');
 vm.runInNewContext(src,ctx,{filename:'schulcockpit-restjahr-v236.js'});
 return {ctx,state,q,fields,open,save,add1,add2,fix,wireEvents,alerts,
  get slotsCalled(){return slotsCalled},get saved(){return saved},get rendered(){return rendered}};
}
test('Course UI supports four individual classworks; fixed date is distinct from proposal',async()=>{
 const t=mock();t.ctx.wire();t.open.onclick();
 t.ctx.wire();t.add1.onclick();t.ctx.wire();t.add1.onclick();
 t.ctx.wire();t.add2.onclick();t.ctx.wire();t.add2.onclick();
 const names=['Mal und Geteilt + Statistik/Runden','Plus und Minus (bereits geschrieben)','Brüche','Geometrie'];
 for(let i=0;i<4;i++){
  t.fields.push({dataset:{v244Field:i+'|topic'},value:names[i],addEventListener:()=>{}});
  t.fields.push({dataset:{v244Field:i+'|half'},value:i<2?'1':'2',addEventListener:()=>{}});
  if(i===0)t.fields.push({dataset:{v244Field:i+'|proposedDate'},value:'2026-11-16',addEventListener:()=>{}});
  if(i===1)t.fields.push({dataset:{v244Field:i+'|status'},value:'erledigt',addEventListener:()=>{}});
 }
 t.ctx.wire();t.wireEvents.save();await new Promise(resolve=>setImmediate(resolve));
 const rows=t.state.yearAssessmentPlansV244['m5|2026/27'];
 assert.equal(rows.length,4);
 assert.equal(rows.filter(r=>r.half===2).length,2);
 assert.equal(rows[0].topic,'Mal und Geteilt + Statistik/Runden');
 assert.equal(rows[1].status,'erledigt');
 assert.equal(rows[0].status,'vorschlag');
 t.ctx.wire();await t.fix.onclick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.state.assessments.length,1);
 assert.equal(t.state.assessments[0].date,'2026-11-16');
 assert.equal(t.state.assessments[0].title,names[0]);
 assert.equal(t.state.yearAssessmentPlansV244['m5|2026/27'][0].status,'fest');
 assert.ok(t.slotsCalled>=1);
});
test('Year import actually records per-lesson method IDs where V202 coverage reads them',async()=>{
 const t=mock();t.ctx.__testV244.setFlow({courseId:'m5',year:'2026/27',phase:'preview'});
 const plan={schema:'schulcockpit.year.v1',courseId:'m5',schoolYear:'2026/27',
   sequences:[{sequenceId:'q1',topicId:'mathe-5-15-all',title:'Grundrechenarten',units:[
    {title:'Standpunkt Multiplikation',materials:[],competencyIds:['mathe-5-15-all-k01'],
      methodIds:['methode-5-4'],resourcesNeeded:'Standpunkt-AB drucken',preparation:'Lernweg selbst einschätzen'}
   ]}],assessmentPlans:[]};
 const preview=t.ctx.__testV244.previewImport(plan);
 assert.equal(preview.audit.missingMethods.length,0);
 assert.equal(preview.blockers.length,0);
 t.ctx.__testV244.setFlow({courseId:'m5',year:'2026/27',phase:'preview',data:plan,preview});
 await t.ctx.__testV244.applyImport();
 assert.equal(t.q.plan.length,1);
 const u=t.q.plan[0];
 assert.deepEqual([...u.competencyIdsV202],['mathe-5-15-all-k01','methode-5-4']);
 assert.deepEqual([...u.methodIds],['methode-5-4']);
 assert.equal(u.resourcesNeededV244,'Standpunkt-AB drucken');
 assert.equal(u.preparationV244,'Lernweg selbst einschätzen');
 assert.equal(t.q.curriculumV202.topicId,'mathe-5-15-all');
 assert.ok(t.q.curriculumV202.methodIds.includes('methode-5-4'));
});
test('Year import preview blocks missing Methodencurriculum or missing individual classwork',()=>{
 const t=mock();t.state.yearAssessmentPlansV244={'m5|2026/27':[
  {id:'exam-1',half:1,type:'klassenarbeit',topic:'Mal und Geteilt + Statistik und Runden',status:'offen',proposedDate:''}]};
 t.ctx.__testV244.setFlow({courseId:'m5',year:'2026/27',phase:'preview'});
 const proposal={schema:'schulcockpit.year.v1',courseId:'m5',schoolYear:'2026/27',
   sequences:[{sequenceId:'q1',topicId:'mathe-5-15-all',title:'Grundrechenarten',units:[
    {title:'Multiplikation',materials:[],competencyIds:['mathe-5-15-all-k01'],methodIds:[]}
   ]}]};
 const review=t.ctx.__testV244.previewImport(proposal);
 assert.ok(review.blockers.some(x=>x.includes('Klassenarbeit ohne Planungsbezug')));
 assert.ok(review.blockers.some(x=>x.includes('Methodenkompetenz fehlt')));
});

test('A canceled math lesson stops consuming an instructional slot; next slot remains usable',()=>{
 const t=mock();
 t.state.lessons.push({classId:'m5',date:'2026-11-16',slot:1,executionV180:{type:'cancelled'}});
 const slots=t.ctx.v190CourseSlots('m5','2026/27');
 assert.equal(slots.length,1);
 assert.equal(slots[0].date,'2026-11-23');
});
