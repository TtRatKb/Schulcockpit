/* Schulcockpit V0.22.8 – warmherzige, kindgerechte Rückmeldungen.
 * Ergänzt ausschließlich V0.22.7-Vorschlagsformulierungen. Bereits persönlich
 * geschriebene Rückmeldungen bleiben unter feedbackV210 unverändert.
 */
const V228_VERSION='V0.22.8';
const v228ComposeBefore=v227Compose;

function v228BonusPhrase(count,seed){
  const names=['','einer','zwei','drei','vier','fünf','sechs'];
  const at=count===1?'einer Bonusaufgabe':(names[count]||count)+' Bonusaufgaben';
  return v227Pick([
    'Auch bei den Bonusaufgaben gibt es Grund zur Freude: Bei '+at+' hast du alle Zusatzpunkte erreicht.',
    'Super: Bei '+at+' hast du sogar die volle Bonuspunktzahl gesammelt.',
    'Ein toller Extra-Erfolg: Bei '+at+' hast du alle möglichen Zusatzpunkte geholt.',
    'Bei '+at+' hast du dir auch noch alle Zusatzpunkte gesichert. Klasse!'
  ],seed,47);
}
v227Compose=function(report){
  const result=v228ComposeBefore(report);
  const data=v225FeedbackParts(report),seed=v227Seed(report);
  const perfect=data.green.filter(c=>v225Band(c)==='perfect');
  const reached=data.green.filter(c=>v225Band(c)==='reached');
  let i=0;
  if(data.green.length>=3){
    result.strength[i++]=v227Pick([
      'Wow, das ist eine richtig starke Leistung!',
      'Klasse, du hast in vielen Bereichen tolle Ergebnisse erzielt!',
      'Das kann sich wirklich sehen lassen!',
      'In mehreren Bereichen zeigst du schon großes Können.',
      'Hier hast du schon richtig viel drauf!'
    ],seed,41);
  }
  if(perfect.length){
    const at=v227At(perfect);
    result.strength[i++]=v227Pick([
      'Die volle Punktzahl hast du '+at+' erreicht – richtig klasse!',
      'Besonders toll: '+at+' hast du sogar die volle Punktzahl erreicht.',
      'Du erreichst '+at+' sogar die volle Punktzahl. Das ist stark!',
      'Die Aufgaben '+at+' hast du mit voller Punktzahl abgeschlossen.',
      'Super: '+at+' erreichst du sogar die volle Punktzahl.'
    ],seed,43);
  }
  if(reached.length){
    const at=v227At(reached);
    result.strength[i++]=v227Pick([
      'Auch '+at+' kommst du schon richtig gut zurecht.',
      'Die Aufgaben '+at+' sind dir ebenfalls schon gut gelungen.',
      'Prima, wie viel dir '+at+' schon gelingt.',
      'Du zeigst '+at+' bereits, was du kannst.',
      'Auch '+at+' hast du gute Ergebnisse erreicht.'
    ],seed,45);
  }
  if(data.fullBonus.length){
    result.strength[i++]=v228BonusPhrase(data.fullBonus.length,seed);
  }
  if(i===0){
    if(data.partial.length){
      result.strength[0]=v227Pick([
        'Du hast schon einige Aufgaben teilweise geschafft – prima! Darauf bauen wir auf.',
        'Einige Punkte hast du bereits erreicht. Das ist ein guter Anfang!',
        'Es sind dir schon erste Teile gelungen. Toll, darauf können wir aufbauen!'
      ],seed,49);
    }else if(data.red.some(c=>Number(c.pct)>0)){
      result.strength[0]=v227Pick([
        'Die ersten Punkte sind geschafft – prima! Darauf bauen wir auf.',
        'Du hast schon einige Punkte erreicht. Ein guter Anfang!',
        'Ein Anfang ist gemacht, und von hier aus üben wir weiter.',
        'Schön, dass du schon erste Punkte erreicht hast!'
      ],seed,49);
    }else{
      result.strength[0]=v227Pick([
        'Kopf hoch! Wir nehmen uns die Aufgaben Schritt für Schritt vor.',
        'Diese Arbeit war noch schwierig. Wir üben die Grundlagen gemeinsam in Ruhe.',
        'Noch hat es nicht geklappt – aber wir fangen ganz in Ruhe damit an.',
        'Wir schauen uns die Grundlagen an. Eins nach dem anderen!'
      ],seed,49);
    }
  }
  if(!data.green.length && data.red.length){
    result.next.push(v227Pick([
      'Mit Übung können die einzelnen Schritte nach und nach leichter werden!',
      'Wir bleiben dran und gehen einen Schritt nach dem anderen.',
      'Das üben wir weiter – gemeinsam und in deinem Tempo.',
      'Schritt für Schritt gehen wir das zusammen an!'
    ],seed,53));
  }
  if(data.green.length && !data.red.length && !data.partial.length){
    result.next=result.next.map(x=>x.replace(
      'Übe ruhig weiter, damit du deine starken Ergebnisse sicher halten kannst.',
      'Mach weiter so und festige deine Stärken mit neuen Aufgaben.'
    ));
  }
  // If three distinct sources of praise coincide, keep the enthusiasm readable:
  // never more than two exclamation marks in the complete generated feedback.
  let used=0;
  for(const list of [result.strength,result.next]){
    for(let k=0;k<list.length;k++){
      list[k]=list[k].replace(/!/g,()=>{
        used++;
        return used<=2?'!':'.';
      });
    }
  }
  return result;
};
// v227DefaultFeedback / v227Suggestions resolve v227Compose at invocation.
// Thus the existing editor, saved-text preference and PDF paths remain intact.
render();
