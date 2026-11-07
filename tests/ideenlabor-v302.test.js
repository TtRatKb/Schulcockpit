/* V0.30.2 – entirely fictitious subjects, lessons, tools, activities.
 * Explicit teacher advancement only; never auto-judge AB + PowerPoint.
 */
'use strict';
const assert=require('node:assert/strict');
const core=require('../schulcockpit-ideenlabor-v302-core.js');
const tools=core.starters();
assert.equal(tools.length,5);
assert(tools.some(x=>x.title==='Test paired'&&!x.sourceUrl));
assert(tools.some(x=>x.title==='Class Gauntlet'&&!x.sourceUrl));
assert.equal(tools.find(x=>x.title==='Math Figures').sourceUrl,
 'https://mathfigures.teacher.dev/');
assert(tools.every(x=>x.tested===false),'untried sources may not be marketed as verified');
const custom=core.validate({
 id:'matches',kind:'idea',title:'Gleichungen mit Streichholzschachteln',
 category:'hands-on',subjects:['math'],grades:[5,6],topics:['Gleichungen','Terme'],
 sourceUrl:'https://www.youtube.com/watch?v=example123',
 description:'Schachteln als Variable und einzelne Streichhölzer als Zahlen benutzen.',
 how:'Ausprobieren, wie sich eine Gleichung durch beidseitiges Umlegen erhalten lässt.',
 needs:'Schachteln und Streichhölzer',setupMinutes:20,tested:false,
 materialId:'material-demo'
});
assert.equal(custom.materialId,'material-demo');
assert.deepEqual(custom.topics,['Gleichungen','Terme']);
assert.throws(()=>core.validate({kind:'idea',title:'Schachteln',sourceUrl:'javascript:alert(1)',
 description:'Hallo'}),/http\(s\)/);
assert.throws(()=>core.validate({kind:'idea',title:'Schachteln',sourceUrl:'https://localhost/private',
 description:'Hallo'}),/Private/);
assert.throws(()=>core.validate({kind:'idea',title:'',description:'Hallo'}),/Titel/);
assert.throws(()=>core.validate({kind:'idea',title:'Idee',description:'',how:''}),/Beschreibe/);
const g5={id:'c5',name:'5f',subject:'Mathematik'};
const g6={id:'c6',name:'6b',subject:'Mathematik'};
const r5={id:'r5',name:'5a',subject:'Evangelische Religion'};
const lesson={id:'l1',classId:'c5',date:'2026-11-12',title:'Gleichungen lösen',
 planReference:{title:'Einfache Gleichungen'},status:'planned',
 phasePlan:[{phase:'Erarbeitung',title:'AB lösen'}],materials:['material-original']};
const sameNextYear={...lesson,id:'l2',classId:'c6',date:'2027-10-02'};
const otherSubject={...lesson,id:'l3',classId:'r5'};
const base=JSON.stringify(lesson);
assert(core.match(custom,lesson,g5)>0);
assert(core.match(custom,sameNextYear,g6)>0,'idea resurfaces when topic fits a future grade');
assert.equal(core.match(custom,otherSubject,r5),0,'Religion does not see Maths-only ideas');
assert.equal(core.match(custom,{...lesson,title:'Brüche addieren',
 planReference:{title:'Brüche addieren'}},g5),0,'no arbitrary math recommendation');
const direct={...custom,lessonIds:['l3'],grades:[6],subjects:['math']};
assert.equal(core.match(direct,otherSubject,r5),100,'explicit teacher link outranks topic inference');
const categorized=core.normalize({kind:'tool',title:'Zahlenstrahl',category:'materials',subjects:[],grades:[],
 topics:[],description:'Zeichnen',sourceUrl:'',setupMinutes:null});
assert.equal(core.match(categorized,lesson,g5),0,'preparation-only tools should not crowd lesson prompts');
const candidates=core.candidates([custom,...tools],lesson,g5,'',6);
assert.equal(candidates[0].entry.id,'matches');
assert(!candidates.some(x=>x.entry.title==='Tap and Tally'));
assert.deepEqual(core.lessonState(lesson),{stage:'none',ideaIds:[],note:'',updatedAt:'',triedAt:''});
const st=core.stats([lesson,{...lesson,id:'l2',innovationV302:{stage:'idea',ideaIds:['matches']}},
 {...lesson,id:'l3',innovationV302:{stage:'redesigned'}},
 {...lesson,id:'l4',innovationV302:{stage:'tried'}},
 {...lesson,id:'l5',executionV180:{type:'cancelled'},innovationV302:{stage:'tried'}},
 {...lesson,id:'group',kind:'group',innovationV302:{stage:'tried'}}]);
assert.deepEqual(st,{total:4,none:1,idea:1,redesigned:1,tried:1,evolved:2});
assert.equal(JSON.stringify(lesson),base,'statistics never modify existing plan');
const prompt=core.prompt({...lesson,innovationV302:{stage:'idea',
 ideaIds:['matches'],note:'Beim letzten Mal war die Materialverteilung zu langsam.'}},
 [custom],g5);
assert.match(prompt,/Schachteln als Variable/);
assert.match(prompt,/20 Min/);
assert.match(prompt,/Schulcockpit-Hub/);
assert.match(prompt,/Beim letzten Mal war die Materialverteilung zu langsam/);
assert.match(prompt,/noch nicht als ausprobiert/i);
assert.match(prompt,/Fallback ohne Technik/);
assert.match(prompt,/bestehende Sollplan/);
assert(!prompt.includes('Fiktives Kind'),'nothing personal invented');
const absent=core.prompt({...lesson,title:'Fremdthema',
 planReference:{title:'Fremdthema'}},[custom],g5);
assert.equal(absent,'');
console.log('Idea Lab: independent tool uses, accurate matching, no fake progress, user-driven upgrades and reusable lesson prompts OK');
