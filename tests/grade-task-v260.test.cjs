const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../schulcockpit-bewertung-v260.js'),'utf8');
const core=require('../schulcockpit-bewertung-v260-core.js');
function harness(grade=8){
  const exam={id:'E1',classId:'c1',title:'Religion 8',date:'2026-10-22',files:[]};
  const priv={roster:[],scores:{},paperScores:{},bonusScores:{}};
  const globals={SC_GRADING_V260:core,structuredClone,
    v200Step1:()=>'basis',v200StepNav:()=>'',v188AssessmentModal:()=>'',
    v200AssessmentAnalysisPrompt:()=>'',v200ExtractAnalysis:()=>({}),v200ImportAnalysis:()=>{},
    v200AnalysisReady:()=>false,v200StudentReport:()=>({student:{id:'S1'},complete:true}),
    v200Step3:()=>'',v200Step4:()=>'',v200Step5:()=>'',v233ReportPages:()=>[],wire:()=>{},
    v200Assessment:()=>exam,v200Eval:{assessmentId:'E1',privateData:priv,studentIndex:0},
    v202Grade:()=>grade,cls:()=>({subject:'Religion',name:'8f'}),
    v200EvalAnalysis:()=>exam.evaluationV200?.analysis||null,
    v200AnonymizedClasstimeStructure:()=> 'Frage Q1 · max 3',
    v200AssertNoStudentLeak:()=>{},v200GetScore:()=>3,v200StatusFor:()=>'',
    v200ReportList:()=>[],v233Options:()=>'',v204PdfOptions:()=>'',v234NameEditor:()=>'',
    v233Number:x=>String(x),v233Colors:()=>({}),v233Fill:()=>{},v233Text:()=>{},
    v233Line:()=>{},v233Wrap:s=>[s],v233Label:()=>'',v233Topic:()=>'',
    v233Date:()=>'',v233Settings:()=>({}),v234PrintName:()=>'',v233Sign:()=>{},
    v200PrivatePut:async()=>{},saveState:async()=>{},render:()=>{},
    state:{settings:{schoolYear:'2026/27'}},document:{querySelector:()=>null,querySelectorAll:()=>[]},
    esc:x=>String(x),alert:()=>{},confirm:()=>true,
  };
  vm.runInNewContext(source,globals,{filename:'schulcockpit-bewertung-v260.js'});
  return {globals,exam};
}
test('grade 8 gets grade-only ChatGPT analysis schema and no competency preselection',()=>{
  const {globals:g}=harness();
  const prompt=g.v200AssessmentAnalysisPrompt(g.v200Assessment(),{classtime:null,roster:[]});
  assert.match(prompt,/SCHULCOCKPIT_GRADE_TASK_IMPORT/);
  assert.match(prompt,/KEINE Kompetenzchecks/);
  assert.doesNotMatch(prompt,/Schülername: /);
  const text='<SCHULCOCKPIT_GRADE_TASK_IMPORT>'+JSON.stringify({schema:'schulcockpit.grade-task-analysis.v1',items:[
    {id:'Q1',label:'Aufgabe 1',source:'classtime',regularMax:3,bonusMax:0,classtimeAliases:['Frage Q1']}]
  })+'</SCHULCOCKPIT_GRADE_TASK_IMPORT>';
  const result=g.v200ExtractAnalysis(text);
  assert.equal(result.taskOnlyV260,true);
  assert.equal(result.items[0].source,'classtime');
  assert.equal(result.items[0].competencyId,'_TASK_SCORES_V260');
  assert.equal(result.thresholds.reachedMinPct,undefined);
});
test('grade-only import rejects missing points and does not alter grade-wide competency catalog',async()=>{
  const {globals:g,exam}=harness();
  const wrap=obj=>'<SCHULCOCKPIT_GRADE_TASK_IMPORT>'+JSON.stringify(obj)+'</SCHULCOCKPIT_GRADE_TASK_IMPORT>';
  assert.throws(()=>g.v200ExtractAnalysis(wrap({schema:'schulcockpit.grade-task-analysis.v1',items:[
    {id:'Q1',label:'A1',source:'classtime',regularMax:-1}]})),/Maximalpunkte/);
  await g.v200ImportAnalysis(wrap({schema:'schulcockpit.grade-task-analysis.v1',items:[
    {id:'Q1',label:'A1',source:'classtime',regularMax:3,bonusMax:0}]}));
  assert.equal(exam.evaluationV200.analysis.taskOnlyV260,true);
  assert.equal(g.v200AnalysisReady(),true);
});
