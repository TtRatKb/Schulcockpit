/* V0.29.3 – Religion and Mathematik must use different feedback language. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../schulcockpit-feedback-fach-v293-core.js');
const file=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const c=(id,text,pct,status)=>({id,text,pct,status,regularMax:10,regularEarned:pct/10,bonusEarned:0});
function report(rows,overrides={}){
 const earned=rows.reduce((sum,x)=>sum+x.regularEarned,0);
 return {student:{id:'local-only',name:'Never copy to prompt'},
  complete:true,totalReg:earned,totalEarned:earned,totalBonusEarned:0,
  competencies:rows,...overrides};
}
const religionNames=['Religion','Evangelische Religion','Ev. Religion','Religionslehre katholisch'];
for(const subject of religionNames)assert.equal(core.subjectKind(subject),'religion',subject);
for(const subject of ['Mathe','Mathematik','MATHEMATIK'])assert.equal(core.subjectKind(subject),'math',subject);
assert.equal(core.subjectKind('Deutsch'),'other');
const reached=c('e','Du kannst den Ablauf eines jüdischen Festes beschreiben.',90,'erreicht');
const explaining=c('x','Du kannst jüdische Speisevorschriften erklären und auf Mahlzeiten anwenden (A2, A9, A14).',60,'teilweise erreicht');
const fachbegriffe=c('f','Du kannst wichtige religiöse Fachbegriffe benennen und zuordnen.',45,'noch nicht erreicht');
const p=report([reached,explaining,fachbegriffe]);
const output=core.compose(p);
assert.match(output.strength[0],/jüdischen Festes/);
assert.match(output.next[0],/religiöse Fachbegriffe/);
assert.match(output.next[0],/Halte die wichtigsten Begriffe fest/);
assert.equal(core.label('Du kannst religiöse Begriffe zuordnen (A5, A12).'),'religiöse Begriffe zuordnen');
assert.equal(core.defaultFeedback(p).next,output.next[0]);
assert.equal(core.defaultFeedback(p).strength,output.strength[0]);
assert(!/mathematisch|Rechenweg|Rechenaufgaben|Übungsaufgaben|ähnliche Beispiele|übe beide/i.test(
 JSON.stringify(output)),'No math-only phrase in Religion suggestions');
const prompt=core.prompt(p,'Ev. Religion');
assert.match(prompt,/Rückmeldungen für Religion/);
assert.match(prompt,/deuten, vergleichen/i);
assert(!/Never copy|local-only|Schulklasse|%|Mathematikarbeit/.test(prompt));
const ops=[
 ['Du kannst Aussagen über religiösen Alltag auf ihre Richtigkeit prüfen.','Prüfe deine Aussagen'],
 ['Du kannst die Bedeutung eines jüdischen Symbols erschließen.','Deutung stützen'],
 ['Du kannst Unterschiede zwischen religiösen Festen vergleichen.','Gemeinsamkeiten und Unterschiede'],
 ['Du kannst ein Verhalten begründen und beurteilen.','Gründe deine Antwort'],
 ['Du kannst einen historischen Zusammenhang erläutern.','in eigenen Worten'],
 ['Du kannst religiöse Regeln benennen und zuordnen.','wichtigsten Begriffe'],
 ['Du kannst eine Feier beschreiben.','wesentlichen Merkmale'],
 ['Du kannst verschiedene Perspektiven reflektieren.','unterschiedliche Sichtweisen']
];
for(const [text,fragment] of ops){
 const x=core.compose(report([c('focus',text,55,'teilweise erreicht')]));
 assert(x.next[0].includes(fragment),'expected semantic action: '+text+' => '+x.next[0]);
}
for(const text of [
 'Du kannst Aussagen über den jüdischen Alltag und gelebten Glauben auf ihre Richtigkeit prüfen (A5, A12).',
 'Du kannst wichtige religiöse Orte, Gegenstände und Fachbegriffe des Judentums benennen und zuordnen (A6, A8, A11).',
 'Die Schülerinnen und Schüler sollen zentrale Aussagen erläutern und begründen.'
]){
 const x=core.compose(report([c('focus',text,51,'teilweise erreicht')]));
 assert(x.next[0].length<=250,'next should fit 250-char editor');
 assert(x.strength[0].length<=250);
 assert(!/mathematisch|Rechen|Übungsaufgaben|selbst weitere Beispiele/i.test(x.next[0]));
}
const all=core.compose(report([reached,c('b','Du kannst ein Gebet erklären.',90,'erreicht')]));
assert.match(all.strength[0],/allen bewerteten Bereichen/);
assert.match(all.next[0],/Gedanken aus der Arbeit/);
const some=core.compose(report([reached,c('b','Feste vergleichen',85,'erreicht')]));
assert.match(some.strength[0],/Lernziele.*erreicht/);
const none=core.compose(report([c('x','Ein Symbol deuten',0,'noch nicht erreicht')]));
assert.match(none.strength[0],/schwierig/);
const empty=core.compose(report([c('x','Ein Symbol deuten',null,'noch nicht erreicht')],{complete:false}));
assert.match(empty.next[0],/Punkte und Teilwertungen/);
const le=report([reached,explaining],{complete:false,learningSupportV235:true,scoreCompleteV283:true});
assert.match(core.compose(le).next[0],/erklären/);
const bonus=report([{id:'bonus',text:'Symbole deuten',regularMax:0,bonusOnly:true,bonusEarned:3,pct:null,status:''}]);
assert.match(core.compose(bonus).strength[0],/nicht vollständig/);

let subject='Mathematik';
let saved={strength:'Eigener, unveränderter Satz.',next:'Mathematische Fachbegriffe üben.'};
const original=structuredClone(saved);
const before={
 v224Suggestions:()=>({strength:['Math strength'],next:['Math next']}),
 v224DefaultFeedback:()=>({strength:'Math strength',next:'Math next'}),
 v224FeedbackPrompt:()=>('Mathe unverändert'),
 v200Step5:()=>'<div class="v224-editor"><h4>Deine persönliche Rückmeldung</h4></div>',
 render:()=>{}
};
const context={...before,SC_FEEDBACK_FACH_V293:core,console,
 v200Eval:{assessmentId:'a'},v200Assessment:()=>({classId:'test'}),
 cls:()=>({subject}),v200ReportList:()=>[p],v224Index:()=>0,
 window:{},state:{settings:{schoolYear:'2026/27'}},
 document:{querySelector:()=>null}};
vm.createContext(context);
vm.runInContext(file('schulcockpit-feedback-fach-v293.js'),context);
assert.equal(context.v224DefaultFeedback(p).strength,'Math strength','Math remains exactly as before');
assert.equal(context.v224Suggestions(p).next[0],'Math next');
assert.equal(context.v224FeedbackPrompt(p),'Mathe unverändert');
assert.doesNotMatch(context.v200Step5({classId:'test'},{}),/Religion:/);
subject='Ev. Religion';
assert.equal(context.v224DefaultFeedback(p).next,core.defaultFeedback(p).next);
assert.match(context.v224FeedbackPrompt(p),/Religion/);
const html=context.v200Step5({classId:'test'},{feedbackV210:{[p.student.id]:saved}});
assert.match(html,/Religion:/);
assert.match(html,/Mathematik-Bausteine/);
assert.deepEqual(saved,original,'Never rewrite or migrate teacher-authored feedback');
subject='Mathematik';
assert.equal(context.v224DefaultFeedback(p).next,'Math next','Switching subjects updates generator');
console.log('Feedback by subject: math unchanged; religion-specific operators, saved texts, prompt and LE validated.');