/* V0.29.4 canonical assessment shortcut: no duplicate assessment creation. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
let clicks=0,opened='',attached=[];
const actions={append:b=>attached.push(b)};
const card={querySelector:s=>s==='[data-v294-eval]'?attached[0]||null:
 s==='.v188-assessment-actions'?actions:null};
const ctx={
 state:{assessments:[{id:'exam-a',title:'Klassenarbeit'}],settings:{schoolYear:'2026/27'}},
 document:{createElement:()=>({dataset:{},addEventListener(event,callback){this[event]=callback;}}),
 querySelector:()=>null,querySelectorAll:()=>[]},
 view:'sequences',render:()=>{},
 v200OpenEval:async id=>{clicks++;opened=id;},
 alert:s=>{throw Error(String(s));},
 window:{},console
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../schulcockpit-workflow-links-v294.js'),'utf8'),ctx);
ctx.window.SchulcockpitWorkflowLinksV294.appendLink(card,'exam-a');
ctx.window.SchulcockpitWorkflowLinksV294.appendLink(card,'exam-a');
assert.equal(attached.length,1,'no duplicate button on rerender');
assert.equal(attached[0].textContent,'Auswertung & Rückgabe');
(async()=>{
 await attached[0].click({preventDefault(){},stopPropagation(){}});
 assert.equal(clicks,1);assert.equal(opened,'exam-a','open existing canonical exam ID');
 assert.equal(ctx.state.assessments.length,1,'do not create a second assessment');
 console.log('Year-plan shortcut opens the original assessment workspace.');
})().catch(e=>{console.error(e);process.exitCode=1;});
