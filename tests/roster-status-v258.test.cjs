const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','schulcockpit-klassenliste-le-v235.js'),'utf8');

function setup(){
  const data={roster:[],scores:{},paperScores:{},bonusScores:{},participationV210:{},assessmentId:'exam'};
  const context={
    v200Eval:{assessmentId:'exam',privateData:data},
    v200Assessment:()=>({id:'exam',classId:'mathe5'}),
    v200OpenEval:async()=>{},v200PrivateGet:async()=>null,v200PrivatePut:async()=>{},
    v200Norm:s=>String(s).toLowerCase().trim(),
    v200StepNav:()=>'',v200Step1:()=>'',
    v221CompactTable:()=>'',v200Step4:(a,priv)=>priv.roster.map(s=>s.name).join(', '),
    v200StudentReport:(p,a,s)=>({student:s,complete:true}),
    v200ReportList:()=>context.v200Eval.privateData.roster.map(s=>({student:s,complete:true})),
    v224Status:()=>'',v224Index:()=>0,v200Step5:()=>'',
    v200ImportClasstimeFile:async()=>{},wire:()=>{},
    cls:()=>({name:'5f'}),render:()=>{},
    structuredClone,confirm:()=>true,
    uid:x=>x+'-new',esc:String,
    v200SafeName:String,downloadText:()=>{},
    document:{querySelector:()=>null,querySelectorAll:()=>[]},
    alert:()=>{}
  };
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'schulcockpit-klassenliste-le-v235.js'});
  vm.runInContext(`v235Active={assessmentId:'__sc_class_roster_v235__:mathe5',schema:'schulcockpit.private-class-roster.v1',classId:'mathe5',roster:[
    {id:'a',name:'Kind A',learningSupport:true},
    {id:'b',name:'Kind B',eseSupportV258:true,geSupportV258:true,participatesV258:false}
  ]}`,context);
  return context;
}

test('Roster offers Lernen, ESE, GE and a reversible participation flag',()=>{
  const ctx=setup();
  const html=vm.runInContext('v235Panel({classId:"mathe5"},{roster:[]})',ctx);
  assert.match(html,/data-v235-le="a"/);
  assert.match(html,/data-v235-ese="b"/);
  assert.match(html,/data-v235-ge="b"/);
  assert.match(html,/data-v235-participates="b"/);
  assert.match(html,/1 aktiv · 1 ausgeblendet/);
  assert.equal(vm.runInContext('v235Participates(v235Active.roster[0])',ctx),true);
  assert.equal(vm.runInContext('v235Participates(v235Active.roster[1])',ctx),false);
});

test('Paper exam keeps every enrolled identity and marks the hidden person absent',async()=>{
  const ctx=setup();
  await vm.runInContext('v235UseClassForPaper()',ctx);
  assert.equal(ctx.v200Eval.privateData.roster.length,2);
  assert.equal(ctx.v200Eval.privateData.roster[0].classStudentId,'a');
  assert.equal(ctx.v200Eval.privateData.roster[1].classStudentId,'b');
  assert.equal(ctx.v200Eval.privateData.participationV210.S002,'absent');
  // Only presentation/report lists are filtered; underlying exam data survives.
  const shown=ctx.v200Step4({},ctx.v200Eval.privateData);
  assert.equal(shown,'Kind A');
  assert.equal(ctx.v200Eval.privateData.roster.length,2);
  assert.equal(ctx.v200ReportList().length,1);
  vm.runInContext('v235Active.roster[1].participatesV258=true',ctx);
  assert.equal(ctx.v200Step4({},ctx.v200Eval.privateData),'Kind A, Kind B');
  assert.equal(ctx.v200ReportList().length,2);
});
