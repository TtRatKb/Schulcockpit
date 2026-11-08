'use strict';
const assert=require('node:assert/strict');
const core=require('../schulcockpit-kurzunterricht-v304-core.js');
const dates=core.weekly('2026-11-11',4,(()=>{let i=0;return ()=>String(++i);})(),'Eigenständige Übung');
assert.deepEqual(dates.map(x=>x.date),['2026-11-11','2026-11-18','2026-11-25','2026-12-02']);
assert(dates.every(x=>x.topic==='Eigenständige Übung'));
assert.equal(core.addDays('2026-12-30',7),'2027-01-06');
assert.throws(()=>core.weekly('2026-11-32',4,()=> 'x'),/Datum/);
assert.throws(()=>core.weekly('2026-11-11',13,()=> 'x'),/1–12/);
assert.throws(()=>core.group({title:'X'}),/Titel/);
const g=core.group({id:'temp',type:'temporary',title:'Mathe – 4 Wochen Vertretung',
 subject:'Mathematik',grade:'7b',note:'Die Klasse arbeitet überwiegend selbstständig.',sessions:dates});
assert.equal(g.sessions.length,4);
const withExtra=core.addToGroup(g,[{id:'extra',date:'2026-11-13',topic:'Sicherung'}]);
assert.equal(withExtra.sessions.length,5);
assert.equal(withExtra.sessions[1].date,'2026-11-13');
assert.equal(g.sessions.length,4,'adding sessions does not mutate original');
assert.throws(()=>core.addToGroup(g,[{id:'extra',date:'2026-11-11'}]),/schon einen Eintrag/);
const one=core.group({id:'cover',type:'cover',title:'Kurze Religionsvertretung',
 subject:'Religion',grade:'8',sessions:[core.session({id:'s',date:'2026-11-16',topic:'Gerechtigkeit',
 entry:'Ein kurzes Dilemma',independent:'Text lesen und begründete Position notieren',end:'Zwei Positionen vergleichen'})]});
const q=core.prompt(g,dates[0],[]);
assert.match(q,/Zeitweise übernommener Kurs/);
assert.match(q,/4 Wochen/); // class title, not compulsory planning detail
assert.match(q,/KEINE vollständige Jahres-\/Reihenplanung/);
assert.match(q,/kein Pflicht-PowerPoint/);
assert.match(q,/kein Materialpool/);
assert.match(q,/kein importierbarer JSON-Block|ein importierbarer JSON-Block ist nicht nötig/);
const single=core.prompt(one,one.sessions[0],[]);
assert.match(single,/Einzelne Vertretungsstunde/);
assert.match(single,/Ein kurzes Dilemma/);
assert.match(single,/Text lesen/);
const stats=core.summary([g,one]);
assert.deepEqual(stats,{groups:2,lessons:5,done:0,open:5});
const before=JSON.stringify({g,one});
core.prompt(one,one.sessions[0],[{title:'Karikatur',description:'Ein passender Einstieg, bei Verwendung Rechte prüfen.',sourceUrl:'https://example.org/abc'}]);
assert.equal(JSON.stringify({g,one}),before);
console.log('Quick teaching: four-week recurring dates, independent sessions, one-off lesson, short prompt and original state preserved OK.');
