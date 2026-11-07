const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const core=require('../schulcockpit-nachschreiben-v300-core.js');
const normal={items:[{id:'A1',label:'Aufgabe 1',source:'classtime',regularMax:2}],competencies:[],thresholds:{}};
const inclusion={items:[{id:'F1',label:'Förderaufgabe',source:'classtime',regularMax:1}],competencies:[],thresholds:{}};
const priv={assessmentId:'test-exam',roster:[{id:'S001',name:'Aster Vale'},
 {id:'S002',name:'Nova Reed'}],
 participationV210:{S001:'present',S002:'makeup'},
 scores:{S001:{A1:1}},activeVariantV300:{S001:'inclusion'},
 variantAnalysesV300:{inclusion},
 makeupBatchesV300:[{id:'import-1',fileName:'SYNTHETIC.xlsx',variantV300:'standard',
 parsed:{fileName:'SYNTHETIC.xlsx',sheets:[{name:'S-SYNTHETIC',rows:[[],['Name','Q1'],[],['Name',2],['Nova Reed',2]]}]},
 det:{sheetIndex:0,headerRow:1,questionMaxRowV210:3,
 studentRows:[{rowIndex:4,name:'Nova Reed',row:['Nova Reed',2]}]}}]};
const ctx={SC_MAKEUP_BATCH_V300:core,console,window:{},document:{querySelector:()=>null,querySelectorAll:()=>[]},
 state:{settings:{schoolYear:'2026/27'}},view:'evaluation',v200Eval:{assessmentId:'test-exam',
 privateData:priv,step:3},
 v200Assessment:()=>({id:'test-exam',title:'Synthetic evaluation',classId:'c',evaluationV200:{analysis:normal}}),
 v200EvalAnalysis:()=>normal,
 v200StudentReport:(p,a,stu)=>({student:stu,complete:stu.id==='S001',
  missing:[],totalAdjusted:1,totalMax:2,learningSupportV235:false,from:a.items[0]?.id}),
 v200ReportList:()=>priv.roster.map(stu=>ctx.v200StudentReport(priv,normal,stu)),
 v200Step3:()=>'<section>Alte Classtime-Zuordnung</section>',
 v200Step4:()=>'<div>Reguläre Punktematrix</div>',
 v200Step5:()=>'<div>Reguläre Rückmeldungen</div>',
 v210CalculationDetail:(p,a,stu)=>a.items[0]?.id,
 v200GetScore:(p,sid,it)=>p.scores?.[sid]?.[it.id],
 v200PrivatePut:async()=>{},v200DefaultPrivate:id=>({assessmentId:id,roster:[]}),
 v200ParseXlsx:async()=>null,v200DetectClasstime:()=>null,
 v200ExtractAnalysis:()=>normal,cls:()=>({subject:'Religion',name:'8'}),
 uid:()=> 'uid-test',v200SafeName:x=>x,wire:()=>{},render:()=>{},esc:x=>String(x),
 structuredClone,alert:x=>{throw Error(x)},confirm:()=>true
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-nachschreiben-v300.js'),'utf8'),ctx);
assert.match(ctx.v200Step3({},priv),/VORKORREKTUR/);
assert.match(ctx.v200Step3({},priv),/multiple hidden/);
assert.match(ctx.v200Step3({},priv),/Nachschreiberdateien/);
assert.match(ctx.v200Step3({},priv),/data-v300-commit="import-1"/);
assert.match(ctx.v200Step3({},priv),/Nicht importieren \/ noch offen/);
assert.match(ctx.v200Step3({},priv),/Förder-\/Inklusionsarbeit/);
assert.match(ctx.v200Step4({},priv),/Andere Prüfungsfassungen – eigene Aufgabenpunkte/);
assert.match(ctx.v200Step4({},priv),/Förderaufgabe/);
assert.match(ctx.v200Step5({},priv),/ungleichen/);
assert.equal(ctx.v200StudentReport(priv,normal,priv.roster[0]).from,'F1',
 'active assessment variant, not standard rubric');
assert.equal(ctx.v200StudentReport(priv,normal,priv.roster[1]).from,'A1');
assert.equal(ctx.v210CalculationDetail(priv,normal,priv.roster[0]),'F1');
assert.equal(ctx.window.SchulcockpitMakeupsV300.analysisFor('inclusion'),inclusion);
console.log('Assessment UI: precorrection, multiple imports, variant-specific reports and safe graded views OK.');
