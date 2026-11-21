'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
const input={
 schema:'schulcockpit.assessment-analysis.v1',
 rubricV209:{schema:1,origin:'provided-rubric',sourceFile:'Kollegin-Raster-aus-Chat.png',criterionOrder:['K1']},
 thresholds:{reachedMinPct:70,partialMinPct:50},
 competencies:[{id:'K1',text:'Du kannst einen Unterschied erläutern.',curriculumCompetencyId:'',
   linkageNoteV209:'Für diese Teilfähigkeit keine eindeutige curriculare Zuordnung.'}],
 items:[{id:'A1',label:'Aufgabe 1',regularMax:5,bonusMax:0,competencyId:'K1'}]
};
const wrap=o=>'<SCHULCOCKPIT_ASSESSMENT_IMPORT>\n'+JSON.stringify(o)+'\n</SCHULCOCKPIT_ASSESSMENT_IMPORT>';
const parse=raw=>{const m=String(raw).match(/<SCHULCOCKPIT_ASSESSMENT_IMPORT>\s*([\s\S]*?)\s*<\/SCHULCOCKPIT_ASSESSMENT_IMPORT>/);return m?JSON.parse(m[1]):null;};
function ctx215(){
 const a={id:'a',classId:'r7',files:[{id:'paper',name:'Klassenarbeit.pdf'}],evaluationFilesV214:{paper:'used'}};
 const sandbox={structuredClone,console,Error,Date,Map,Set,JSON,
  v200Eval:{assessmentId:'a',rawImport:wrap(input),step:2,privateData:{scores:{s1:{A1:4}}}},
  v200Assessment:()=>a,v209ExtractRubricInput:parse,
  v209ConfirmedChatScreenshot:r=>r?.origin==='provided-rubric'&&r?.sourceKindV3322==='chat-screenshot'&&
    r?.sourceConfirmedV3322===true&&!String(r.sourceFile||'').trim()&&
    String(r.sourceDescriptionV3322||'').trim().length>=20,
  v214Role:(a,f)=>a.evaluationFilesV214?.[f.id]||'reference',
  v200Step2:()=>'<section>Import</section>',v200OpenEval:async()=>{},wire:()=>{},render:()=>{},
  state:{settings:{schoolYear:'2026/27'}},esc:s=>String(s),
  document:{getElementById:()=>null,querySelector:()=>null},
  v200ImportAnalysis:async raw=>{const obj=parse(raw);sandbox.saved=structuredClone(obj);}
 };
 vm.createContext(sandbox);vm.runInContext(source('schulcockpit-raster-import-v215.js'),sandbox);
 return {sandbox,a};
}
test('a screenshot referenced only in ChatGPT is not a locally attached source',()=>{
 const {sandbox,a}=ctx215();
 assert.ok(sandbox.v215RubricSourceMismatch(wrap(input),a));
 const html=sandbox.v215RubricResolver(a);
 assert.match(html,/Von ChatGPT aus den Prüfungsaufgaben erstellt/);
 assert.match(html,/Kolleg*innenraster als Screenshot im Chat verwendet/);
 assert.match(html,/echte Rasterdatei verknüpfen \(optional\)/);
 assert.match(html,/v215-source-confirm/);
});
test('teacher-confirmed ChatGPT-generated rubric needs no upload and keeps criteria and scores',async()=>{
 const {sandbox,a}=ctx215(),snapshot=JSON.stringify(input),scores=JSON.stringify(sandbox.v200Eval.privateData.scores);
 const fixed=sandbox.v215ProvenanceCorrection(input,'task-derived');
 assert.equal(fixed.rubricV209.origin,'task-derived');
 assert.equal(fixed.rubricV209.sourceFile,'');
 assert.match(fixed.rubricV209.derivationNote,/Lehrkraft bestätigt/);
 assert.equal(JSON.stringify(fixed.items),JSON.stringify(input.items));
 assert.equal(JSON.stringify(input),snapshot);
 sandbox.document={
  getElementById:id=>id==='v200-analysis-import'?{value:wrap(input)}:
    id==='v215-source-confirm'?{checked:true}:null,
  querySelector:sel=>sel==='input[name="v215-source-choice"]:checked'?{value:'task-derived'}:null
 };
 const ok=await sandbox.v215ConfirmSource();
 assert.equal(ok,true);
 assert.equal(sandbox.v200Eval.step,3);
 assert.equal(sandbox.saved.rubricV209.origin,'task-derived');
 assert.equal(JSON.stringify(sandbox.v200Eval.privateData.scores),scores);
 assert.equal(a.files.length,1);
});
test('screenshot source remains explicitly provided, but never pretends to be a local file',()=>{
 const {sandbox,a}=ctx215(),fixed=sandbox.v215ProvenanceCorrection(input,'chat-screenshot');
 assert.equal(fixed.rubricV209.origin,'provided-rubric');
 assert.equal(fixed.rubricV209.sourceFile,'');
 assert.equal(fixed.rubricV209.sourceKindV3322,'chat-screenshot');
 assert.equal(fixed.rubricV209.sourceConfirmedV3322,true);
 assert.equal(sandbox.v215RubricSourceMismatch(wrap(fixed),a),null);
 assert.equal(JSON.stringify(fixed.competencies),JSON.stringify(input.competencies));
});
test('source choice cannot silently bypass explicit teacher confirmation',async()=>{
 const {sandbox}=ctx215();
 sandbox.document={
  getElementById:id=>id==='v200-analysis-import'?{value:wrap(input)}:{checked:false},
  querySelector:()=>({value:'task-derived'})
 };
 await assert.rejects(sandbox.v215ConfirmSource(),/ausdrücklich bestätigen/);
 assert.equal(sandbox.saved,undefined);
 assert.equal(sandbox.v200Eval.step,2);
});
test('V209 rejects invented local sources; accepts only positively confirmed chat screenshot',()=>{
 const sandbox={structuredClone,console,Error,Date,Map,Set,JSON,
  v200AssessmentAnalysisPrompt:()=>'',v200ExtractAnalysis:()=>{},v200ImportAnalysis:async()=>{},
  v200Step1:()=>'',v200Step3:()=>'',v204AnalysisMappingEditor:()=>'',v204SaveItemCompetencyMapping:()=>{},
  v204ExamSelectionSummary:()=>'',v204ExtractAnalysisBefore:parse,
  v204AllCourseCurriculum:()=>[],v200Eval:{assessmentId:'a',privateData:{}},
  v202Grade:()=>7,v202SubjectKey:()=>'religion',
  v202Source:()=>({thresholds5to7:{reachedMinPct:70,partialMinPct:50}}),cls:()=>({}),
  render:()=>{},state:{settings:{schoolYear:'2026/27'}},
  document:{querySelector:()=>null},esc:s=>String(s)
 };
 vm.createContext(sandbox);vm.runInContext(source('schulcockpit-assessment-rubric-v209.js'),sandbox);
 const a={id:'a',classId:'r7',files:[{name:'Klassenarbeit.pdf'}]};
 assert.throws(()=>sandbox.v209CheckRubric(structuredClone(input),a),/nicht lokal hinterlegt/);
 const fixed={
  ...structuredClone(input),
  rubricV209:{schema:1,origin:'provided-rubric',sourceFile:'',criterionOrder:['K1'],
   sourceKindV3322:'chat-screenshot',sourceConfirmedV3322:true,
   sourceDescriptionV3322:'Von der Lehrkraft bestätigtes Kolleginnenraster als Screenshot im Chat.'}
 };
 assert.equal(sandbox.v209CheckRubric(fixed,a).competencies[0].text,input.competencies[0].text);
 const fake={...structuredClone(fixed),rubricV209:{...fixed.rubricV209,sourceFile:'falscher-filename.pdf'}};
 assert.throws(()=>sandbox.v209CheckRubric(fake,a),/nicht lokal hinterlegt/);
});
