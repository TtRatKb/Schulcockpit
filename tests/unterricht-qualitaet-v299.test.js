const assert=require('node:assert/strict');
const core=require('../schulcockpit-unterricht-qualitaet-v299-core.js');
const normalized={slides:[{type:'bildimpuls',title:'Aussagebild',content:[],notes:'Leitfrage an die Klasse',
 imageMaterial:''},{type:'arbeitsauftrag',title:'Auftrag',content:['Bearbeite AB'],notes:''}]};
const raw={slides:[
 {type:'bildimpuls',title:'Aussagebild',imageMaterial:'',imageSuggestion:'Karikatur über Perspektiven',
  imageSource:'https://example.org/karikatur',imageLicense:'Rechte noch prüfen',
  imageAlt:'Zwei kontrastierende Perspektiven'},
 {type:'arbeitsauftrag',title:'Auftrag',content:['Bearbeite AB']}]};
const pkg=core.enrich(raw,normalized);
assert.equal(pkg.slides[0].type,'text','missing image must not break Momiji render');
assert.match(pkg.slides[0].notes,/Karikatur über Perspektiven/);
assert.match(pkg.slides[0].notes,/https:\/\/example.org\/karikatur/);
assert.match(pkg.slides[0].notes,/Rechte noch prüfen/);
assert.match(pkg.slides[0].content.join(''),/Bildimpuls vorbereiten/);
assert.equal(pkg.slides[1].type,'arbeitsauftrag');
assert.equal(pkg.slides[1].notes,'');
const warnings=core.inspect({phases:[
 {phase:'Erarbeitung'},{phase:'Übung'},{phase:'Erarbeitung'}],
 slides:[{type:'arbeitsauftrag'},{type:'arbeitsauftrag'},{type:'arbeitsauftrag'},{type:'arbeitsauftrag'},
 {type:'topflop'},{type:'topflop'}]});
assert(warnings.some(s=>/Mehr als zwei/.test(s)));
assert(warnings.some(s=>/Mehr Aufgabenfolien/.test(s)));
assert(warnings.some(s=>/zwei Top/.test(s)));
const ready=core.enrich({slides:[{title:'Bild',imageSuggestion:'Lichtbrechung',imageSource:''}]},
 {slides:[{type:'text',title:'Bild',content:['Impuls'],notes:''}]});
assert.match(ready.slides[0].notes,/BILDVORSCHLAG/);
assert.equal(core.inspect({phases:[{phase:'Einstieg'},{phase:'Erarbeitung'},{phase:'Sicherung'}],
 slides:[{type:'arbeitsauftrag'},{type:'sicherung'}]}).length,0);
assert(!JSON.stringify(pkg).includes('data:image'),'no remote image bytes faked');
console.log('Lesson-quality: coherent phases warnings and safe image briefs in notes OK');