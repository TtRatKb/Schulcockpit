/* Browser-independent integrations; fictitious plans and sources only. */
'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),
 fs=require('node:fs'),path=require('node:path');
const C=require('../schulcockpit-ideenlabor-v302-core.js');
const idea=C.validate({id:'idea-1',title:'Schachtelgleichungen erforschen',
 kind:'idea',category:'hands-on',subjects:['math'],grades:[5],topics:['Gleichungen'],
 description:'Mit Schachteln und Streichhölzern Gleichungen modellieren.',
 how:'Gleiche Operationen auf beiden Seiten erproben.',
 sourceUrl:'https://example.org/teacher-idea',setupMinutes:30});
const lesson={id:'l1',classId:'m5',date:'2026-11-11',
 title:'Gleichungen mit Unbekannten',planReference:{title:'Einfache Gleichungen'},
 phasePlan:[{phase:'Einstieg',title:'Alte Frage'},{phase:'Erarbeitung',title:'Vorhandenes AB'}],
 materials:['old-ab'],status:'planned'};
const before=JSON.stringify({phasePlan:lesson.phasePlan,materials:lesson.materials});
const state={settings:{schoolYear:'2026/27'},classes:[{id:'m5',name:'5f',subject:'Mathematik'}],
 sequences:[],lessons:[lesson],materials:[],inspirationV302:[idea]};
let saved=0,alerts=[];
const viewDoc={
 querySelector:()=>null,
 querySelectorAll:()=>[]
};
const ctx={SC_IDEAS_V302:C,state,view:'ideas',modal:null,window:{},
 document:viewDoc,console,structuredClone,Date,CSS:{escape:s=>s},
 cls:id=>state.classes.find(c=>c.id===id),lesson:id=>state.lessons.find(l=>l.id===id),
 seq:()=>null,mat:()=>null,uid:()=> 'testuid',
 v182IsHeld:l=>l.status==='done',v182LessonId:'',
 v182LessonDayHtml:()=>'<div><section class="panel v182-end-panel">Ist-Stand</section></div>',
 wizardPlanStepV14:()=>'<section><h3>Material in dieser Stunde</h3></section>',
 concretePlanningPromptV12:()=>'<BASE>\nDanach hänge GENAU EINEN maschinenlesbaren Block an:\n{}',
 makeBrief:()=>'',pageTitle:()=>'',viewHtml:()=>'<old>',
 saveState:()=>{saved++;},wire:()=>{},render:()=>{},
 esc:x=>String(x).replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;'),
 alert:s=>{alerts.push(s);}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../schulcockpit-ideenlabor-v302.js'),'utf8'),ctx);
assert.equal(ctx.pageTitle(),'Ideenlabor');
assert.match(ctx.viewHtml(),/Aus Fundstücken werden besondere Unterrichtsstunden/);
assert.match(ctx.viewHtml(),/Stunden-Upgrade/);
assert.match(ctx.viewHtml(),/Schachtelgleichungen erforschen/);
assert.match(ctx.viewHtml(),/data-v302-pin/);
ctx.view='tools';
assert.equal(ctx.pageTitle(),'Digitale Toolbox');
assert.match(ctx.viewHtml(),/Materialgenerator/);
assert.match(ctx.viewHtml(),/Math Figures/);
ctx.view='growth';
assert.match(ctx.viewHtml(),/Stundenentwicklung/);
assert.match(ctx.viewHtml(),/ohne dokumentiertes Upgrade|Noch nicht überarbeitet/);
ctx.view='ideas';
const wizard=ctx.wizardPlanStepV14(lesson);
assert.match(wizard,/Für Neuplanung vormerken/);
assert.match(wizard,/Material in dieser Stunde/);
assert.match(ctx.v182LessonDayHtml(lesson),/Eigene Erfahrung \/ Hinweis/);
const prompt=ctx.concretePlanningPromptV12(lesson);
assert.match(prompt,/Gesammelte Unterrichtsideen/);
assert.match(prompt,/Schachtelgleichungen erforschen/);
assert(prompt.indexOf('Gesammelte Unterrichtsideen')<prompt.indexOf('Danach hänge GENAU'));
const toggle={dataset:{v302LessonToggle:'l1|idea-1'}};
ctx.document.querySelectorAll=selector=>selector==='[data-v302-lesson-toggle]'?[toggle]:[];
(async()=>{
 ctx.wire();
 await toggle.onclick();
 assert.deepEqual(lesson.innovationV302.ideaIds,['idea-1']);
 assert.equal(lesson.innovationV302.stage,'idea');
 assert(saved>0);
 assert.equal(JSON.stringify({phasePlan:lesson.phasePlan,materials:lesson.materials}),before,
  'selecting a saved idea must never replace current worksheets or phases');
 assert.match(ctx.concretePlanningPromptV12(lesson),/FÜR DIESE STUNDE VORGEMERKT/);
 const stageSelect={dataset:{v302Stage:'l1'},value:'tried'};
 ctx.document.querySelectorAll=selector=>selector==='[data-v302-stage]'?[stageSelect]:[];
 ctx.wire();
 await stageSelect.onchange();
 assert.equal(lesson.innovationV302.stage,'idea');
 assert(alerts.some(a=>/erst nach durchgeführter Stunde/.test(a)));
 stageSelect.value='redesigned';
 await stageSelect.onchange();
 assert.equal(lesson.innovationV302.stage,'redesigned');
 lesson.status='done';
 stageSelect.value='tried';
 await stageSelect.onchange();
 assert.equal(lesson.innovationV302.stage,'tried');
 assert(lesson.innovationV302.triedAt);
 assert.match(ctx.window.SchulcockpitIdeasV302.developmentSummary(),/1/);
 assert.equal(JSON.stringify({phasePlan:lesson.phasePlan,materials:lesson.materials}),before);
 console.log('Idea Lab UI: two distinct pages, relevant hour, prompt, opt-in, grade-sensitive stages and old materials preserved OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
