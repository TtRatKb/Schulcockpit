const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','schulcockpit-freiplanung-v258.js'),'utf8');

function createHarness(){
  const last={id:'old',classId:'mathe5',date:'2026-10-22',title:'Multiplikation von natürlichen Zahlen 1',
    status:'done',reflection:{note:'PRIVAT: Lisa braucht Unterstützung',learning:'PRIVAT: Tom'}};
  const next={id:'monday',classId:'mathe5',date:'2026-10-26',period:'1. Block',
    title:'Multiplikation von natürlichen Zahlen 2',status:'open',
    planReference:{title:'Standpunkt multiplizieren und dividieren',material:'Arbeitsblatt Grundaufgaben Multiplikation'}};
  const captures={},calls={saved:0,rendered:0,removed:[]};
  const doc={
    addEventListener:(event,handler,capture)=>{captures[event]={handler,capture};},
    querySelectorAll:()=>[]
  };
  const context={
    state:{lessons:[last,next]},document:doc,
    concretePlanningPromptV12:()=> 'SOLLPLAN_TEXT',makeBrief:()=>'',
    wizardPlanStepV14:()=>'<section><h3>Material in dieser Stunde</h3></section>',
    wizardPromptStepV14:()=>'<h2>Jetzt ChatGPT planen lassen</h2><p>Er enthält Reihenplanung, Material und die letzte Reflexion.</p><p>Ich erstelle die konkrete Stunde und den Schulcockpit-Datenblock.</p>',
    coursePrepRowV14:l=>'<div><button class="primary" data-start-wizard="'+l.id+'">Öffnen</button></div>',
    cls:()=>({subject:'Mathematik',name:'5f',students:28}),
    v182IsHeld:l=>l.status==='done',
    wizardLessonV14:()=>next,lesson:id=>id===next.id?next:last,
    saveState:()=>{calls.saved++;},render:()=>{calls.rendered++;},openWizardV14:()=>{},
    wire:()=>{},alert:msg=>{throw Error(msg);},
    v183DeleteFromLesson:(l,h)=>{calls.removed.push({id:l.id,h});},
    resourceEditorV176:null,esc:txt=>String(txt)
  };
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'schulcockpit-freiplanung-v258.js'});
  return {last,next,context,captures,calls};
}

test('Freiplanung gives chronology and schema without forcing Soll material or exposing reflections',()=>{
  const {next,context}=createHarness();
  next.freePlanningV258=true;
  const prompt=context.concretePlanningPromptV12(next);
  assert.match(prompt,/Multiplikation von natürlichen Zahlen 1/);
  assert.match(prompt,/weiteren Nachricht oder Sprachnachricht/);
  assert.match(prompt,/<SCHULCOCKPIT_IMPORT>/);
  assert.match(prompt,/schulcockpit\.lesson\.v2/);
  assert.doesNotMatch(prompt,/Standpunkt multiplizieren/);
  assert.doesNotMatch(prompt,/Grundaufgaben Multiplikation/);
  assert.doesNotMatch(prompt,/Lisa|Tom|PRIVAT/);
  next.freePlanningV258=false;
  assert.equal(context.concretePlanningPromptV12(next),'SOLLPLAN_TEXT');
});

test('Free planning is a reversible single-lesson flag with unchanged Soll reference',()=>{
  const {next,context}=createHarness();
  assert.match(context.wizardPlanStepV14(next),/data-v258-plan-mode="free"/);
  const originalPlan=next.planReference;
  next.freePlanningV258=true;
  assert.match(context.wizardPlanStepV14(next),/Freien ChatGPT-Prompt/);
  assert.doesNotMatch(context.wizardPlanStepV14(next),/Standpunkt/);
  assert.match(context.wizardPromptStepV14(next),/Sprachnachricht/);
  assert.equal(next.planReference,originalPlan);
  assert.match(context.coursePrepRowV14(next),/data-v258-free-start/);
});

test('Remove-this-lesson button has stable delegation and never rewrites source sequence',()=>{
  const {next,context,captures,calls}=createHarness();
  assert.equal(captures.click.capture,true);
  let stopped=false;
  captures.click.handler({target:{closest:()=>({dataset:{v183Hide:'monday|Arbeitsblatt%20Grundaufgaben%20Multiplikation'}})},
    preventDefault:()=>{},stopImmediatePropagation:()=>{stopped=true;}});
  assert.equal(stopped,true);
  assert.equal(calls.removed.length,1);
  assert.equal(calls.removed[0].id,'monday');
  assert.equal(calls.removed[0].h,'Arbeitsblatt Grundaufgaben Multiplikation');
  assert.equal(next.planReference.material,'Arbeitsblatt Grundaufgaben Multiplikation');
  assert.equal(calls.saved,1);
});
