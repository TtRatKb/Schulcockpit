/* V0.24.4: integration test for multiple exams and curriculum-aware year import. */
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const helper=require('../schulcockpit-jahresvorgaben-v244.js');
const examTopics=require('../schulcockpit-pruefungsthemen-v245.js');
function mock(){
 const wireEvents={},button=(id,dataset={})=>({dataset,addEventListener:(k,fn)=>wireEvents[id]=fn});
 const open=button('open',{v236Open:'m5'}),save=button('save'),add1=button('add1',{v244Add:'1'}),
  add2=button('add2',{v244Add:'2'}),fix=button('fix',{v244Fix:'0'});
 const fields=[],topicFields=[],countInputs={1:{value:'2'},2:{value:'2'}};
 const count=button('setcount'),swap=button('swap',{v245Swap:'0'}),suggest=button('suggest',{v245Suggest:'0'}),testBtn=button('test',{v245Test:'2'});
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
   if(sel==='[data-v245-topic]')return topicFields;
   if(sel==='[data-v245-swap]')return [swap];
   if(sel==='[data-v245-suggest]')return [suggest];
   if(sel==='[data-v245-test]')return [testBtn];
   return [];
  },querySelector(sel){
   if(sel==='[data-v236-save]')return save;
   if(sel==='[data-v245-set-count]')return count;
   if(sel==='[data-v245-count="1"]')return countInputs[1];
   if(sel==='[data-v245-count="2"]')return countInputs[2];
   if(sel==='[data-v236-export]')return button('export');
   if(sel==='[data-v236-parse]')return button('parse');
   if(sel==='[data-v236-apply]')return button('apply');
   return null;
  },getElementById(){return null}};
 let slotsCalled=0,rendered=0,alerts=[],saved=0;
 const ctx={state,modal:null,document:doc,Blob,Date,Map,Set,Promise,console,SC_YEAR_RULES_V244:helper,SC_EXAM_TOPICS_V245:examTopics,
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
 return {ctx,state,q,fields,topicFields,countInputs,count,swap,suggest,testBtn,open,save,add1,add2,fix,wireEvents,alerts,
  get slotsCalled(){return slotsCalled},get saved(){return saved},get rendered(){return rendered}};
}

test('Mathematics count-first UI creates 2 classworks per half and selected topics survive save',async()=>{
 const t=mock();t.ctx.wire();t.open.onclick();
 t.ctx.wire();t.count.onclick();
 assert.match(t.ctx.modalHtml(),/Anzahl Klassenarbeiten/);
 assert.match(t.ctx.modalHtml(),/Themen auswählen/);
 const selected=[
  {dataset:{v245Topic:'0|seq:q1'},value:'primary',addEventListener:()=>{}},
  {dataset:{v245Topic:'0|kc:mathe-5-15-all'},value:'supplementary',addEventListener:()=>{}}
 ];
 t.topicFields.push(...selected);
 t.ctx.wire();t.wireEvents.save();await new Promise(resolve=>setImmediate(resolve));
 const rows=t.state.yearAssessmentPlansV244['m5|2026/27'];
 assert.equal(rows.length,4);
 assert.deepEqual([...rows[0].primaryTopicIds],['seq:q1']);
 assert.deepEqual([...rows[0].supplementaryTopicIds],['kc:mathe-5-15-all']);
 assert.match(rows[0].topic,/Grundrechenarten/);
});
test('Short Classtime tests are optional and not counted as an extra classwork',async()=>{
 const t=mock();t.ctx.wire();t.open.onclick();
 t.ctx.wire();t.testBtn.onclick();
 assert.match(t.ctx.modalHtml(),/Kurzer Kompetenztest/);
 assert.match(t.ctx.modalHtml(),/Classtime/);
 t.ctx.wire();t.wireEvents.save();await new Promise(resolve=>setImmediate(resolve));
 const rows=t.state.yearAssessmentPlansV244['m5|2026/27'];
 assert.equal(rows.length,1);
 assert.equal(rows[0].type,'test');
 assert.equal(rows[0].mode,'classtime');
});
test('After import tentative suggested classwork gets optional alternative but never a fixed exam record',async()=>{
 const t=mock();t.state.yearAssessmentPlansV244={'m5|2026/27':[
  {id:'ka2',half:1,type:'klassenarbeit',status:'offen',topic:'Grundrechenarten',primaryTopicIds:['seq:q1'],
   supplementaryTopicIds:[],proposedDate:'',alternativeDate:''}
 ]};
 t.ctx.__testV244.setFlow({courseId:'m5',year:'2026/27',phase:'preview'});
 const plan={schema:'schulcockpit.year.v1',courseId:'m5',schoolYear:'2026/27',
  sequences:[{sequenceId:'q1',topicId:'mathe-5-15-all',title:'Grundrechenarten',units:[
   {title:'Standpunkt',materials:[],competencyIds:['mathe-5-15-all-k01'],methodIds:['methode-5-4']}
  ]}],
  assessmentPlans:[{planId:'ka2',coveredMainIds:['seq:q1'],coveredSupplementaryIds:[],
   proposedDate:'',alternativeDate:'',preparationUnitTitles:['Standpunkt']}]};
 const preview=t.ctx.__testV244.previewImport(plan);
 assert.equal(preview.blockers.length,0);
 t.ctx.__testV244.setFlow({courseId:'m5',year:'2026/27',phase:'preview',data:plan,preview});
 await t.ctx.__testV244.applyImport();
 const saved=t.state.yearAssessmentPlansV244['m5|2026/27'][0];
 assert.equal(saved.status,'vorschlag');
 assert.equal(saved.proposedDate,'2026-11-16');
 assert.equal(saved.alternativeDate,'2026-11-23');
 assert.equal(t.state.assessments.length,0);
});
test('Import blocks a model response that drops selected supplemental topic',()=>{
 const t=mock();t.state.yearAssessmentPlansV244={'m5|2026/27':[
  {id:'ka2',half:1,type:'klassenarbeit',status:'offen',topic:'Grundrechenarten + extra',
   primaryTopicIds:['seq:q1'],supplementaryTopicIds:['kc:mathe-5-15-all']}
 ]};
 t.ctx.__testV244.setFlow({courseId:'m5',year:'2026/27',phase:'preview'});
 const plan={schema:'schulcockpit.year.v1',courseId:'m5',schoolYear:'2026/27',
  sequences:[{sequenceId:'q1',topicId:'mathe-5-15-all',title:'Grundrechenarten',units:[
   {title:'Standpunkt',materials:[],competencyIds:['mathe-5-15-all-k01'],methodIds:['methode-5-4']}
  ]}],
  assessmentPlans:[{planId:'ka2',coveredMainIds:['seq:q1'],coveredSupplementaryIds:[]}]};
 const result=t.ctx.__testV244.previewImport(plan);
 assert.ok(result.blockers.some(x=>x.includes('Vorgegebener Prüfungsstoff fehlt')));
});
