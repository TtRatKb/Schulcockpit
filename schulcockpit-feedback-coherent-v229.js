/* Schulcockpit V0.22.9 – zusammenhängende, handlungsorientierte Rückmeldungen.
 * Reiner Textgenerator auf Basis der bereits lokal berechneten Kompetenzstände.
 * Keine Änderungen an feedbackV210, Schülerdaten, Punkten, Speicher oder PDFs.
 */
const V229_VERSION='V0.22.9';

function v229Groups(items){
  const pending=[...items],groups=[];
  // Keep the related written arithmetic skills in the same sentence.
  const add=pending.find(c=>/schriftlich.*(?:addier|addition)/i.test(v224Clean(c.text)));
  const sub=pending.find(c=>/schriftlich.*(?:subtrah|subtraktion)/i.test(v224Clean(c.text)));
  if(add&&sub){
    groups.push([add,sub]);
    pending.splice(pending.indexOf(add),1);
    pending.splice(pending.indexOf(sub),1);
  }
  while(pending.length)groups.push(pending.splice(0,2));
  return groups;
}
function v229Upper(str){return str.charAt(0).toUpperCase()+str.slice(1);}
function v229PercentSentences(items,type,seed,offset,hasEarlierSkill){
  let earlier=hasEarlierSkill;
  const phrases=[];
  for(const group of v229Groups(items)){
    const at=v227At(group),cap=v229Upper(at),two=group.length>1,each=two?'jeweils ':'';
    const first=type==='perfect'?[
      cap+' hast du '+each+'alle möglichen Punkte geholt.',
      'Richtig stark: '+cap+' hast du '+each+'die volle Punktzahl erreicht.',
      'Du hast '+at+' '+each+'die volle Punktzahl erreicht.'
    ]:[
      cap+' hast du schon gute Ergebnisse erreicht.',
      cap+' hast du schon gute Ergebnisse erzielt.',
      'Du hast '+at+' bereits viele Punkte gesammelt.'
    ];
    const later=type==='perfect'?[
      'Auch '+at+' hast du '+each+'alle Punkte erreicht.',
      'Zusätzlich hast du '+at+' '+each+'die volle Punktzahl erreicht.',
      cap+' hast du ebenfalls '+each+'die volle Punktzahl erzielt.'
    ]:[
      'Auch '+at+' hast du schon viele Punkte erreicht.',
      'Außerdem bist du '+at+' gut vorangekommen.',
      cap+' hast du ebenfalls gute Ergebnisse erzielt.'
    ];
    phrases.push(v227Pick(earlier?later:first,seed,offset+phrases.length*7));
    earlier=true;
  }
  return phrases;
}
function v229PracticeSentences(items,type,seed,offset){
  if(!items.length)return [];
  return v229Groups(items).map((group,i)=>{
    const at=v227At(group),cap=v229Upper(at);
    if(type==='zero')return v227Pick([
      cap+' hast du diesmal noch keine Punkte erreicht. Schau dir die Aufgaben dazu noch einmal an und bearbeite selbst passende Übungen.',
      cap+' hat es diesmal noch nicht geklappt. Wiederhole die Grundlagen und probiere anschließend selbst neue Aufgaben.',
      cap+' gab es diesmal noch keine Punkte. Nimm dir diese Aufgaben noch einmal vor und übe die Grundlagen selbstständig.'
    ],seed,offset+i*5);
    if(type==='weak')return v227Pick([
      cap+' hast du erst wenige Punkte erreicht. Schau dir die Aufgaben dazu erneut an und bearbeite danach selbst weitere Beispiele.',
      'Du hast '+at+' bisher nur wenige Punkte erreicht. Wiederhole die wichtigsten Schritte und löse dazu selbst Übungsaufgaben.',
      cap+' hast du erst wenige Punkte erreicht. Sieh dir die Aufgaben noch einmal an und löse weitere Beispiele selbst.',
    ],seed,offset+i*5);
    return v227Pick([
      cap+' hast du schon einzelne Punkte erreicht. Bearbeite weitere passende Übungen selbstständig, damit du sicherer wirst.',
      cap+' hast du bereits einige Punkte erreicht. Sieh dir die Aufgaben noch einmal an und löse weitere Beispiele selbst.',
      cap+' brauchst du noch Übung. Sieh dir die Aufgaben erneut an und übe mit weiteren Beispielen.'
    ],seed,offset+i*5);
  });
}
function v229Compose(report){
  const s=v225FeedbackParts(report),seed=v227Seed(report);
  const perfect=s.green.filter(c=>v225Band(c)==='perfect');
  const reached=s.green.filter(c=>v225Band(c)==='reached');
  const zero=s.red.filter(c=>v225Band(c)==='zero');
  const weak=s.red.filter(c=>v225Band(c)==='weak');
  const practice=s.red.filter(c=>v225Band(c)==='practice');
  const strength=[],next=[];
  if(s.green.length>=3){
    strength.push(v227Pick([
      'Wow, in dieser Arbeit hast du richtig viel geschafft!',
      'Klasse, du hast in vielen Bereichen tolle Ergebnisse erzielt!',
      'Das kann sich wirklich sehen lassen!',
      'Du hast in vielen Bereichen sehr gute Ergebnisse erreicht.'
    ],seed,41));
  }
  strength.push(...v229PercentSentences(perfect,'perfect',seed,43,false));
  strength.push(...v229PercentSentences(reached,'reached',seed,71,perfect.length>0));
  if(s.fullBonus.length)strength.push(v228BonusPhrase(s.fullBonus.length,seed));
  if(!strength.length){
    if(s.partial.length)strength.push(v227Pick([
      'Bei einigen Aufgaben hast du schon Punkte erreicht. Ein guter Anfang!',
      'Du hast bei einigen Aufgaben schon Teilerfolge erzielt. Prima!',
      'Einige Aufgaben hast du bereits teilweise geschafft. Das ist ein Anfang.'
    ],seed,83));
    else if(s.red.some(c=>Number(c.pct)>0))strength.push(v227Pick([
      'Einige Punkte hast du bereits erreicht – ein erster Anfang!',
      'Die ersten Punkte sind schon da. Das ist ein Anfang.',
      'Du hast schon erste Punkte gesammelt. Prima!'
    ],seed,83));
    else strength.push(v227Pick([
      'Kopf hoch! Schwierige Aufgaben kannst du mit Übung besser kennenlernen.',
      'Diese Arbeit war noch schwierig. Nimm dir die Grundlagen in Ruhe vor.',
      'Noch hat es nicht geklappt. Mit Übung kannst du daran arbeiten.'
    ],seed,83));
  }
  next.push(...v229PracticeSentences(zero,'zero',seed,101));
  next.push(...v229PracticeSentences(weak,'weak',seed,113));
  next.push(...v229PracticeSentences(practice,'practice',seed,127));
  if(!s.red.length){
    if(s.partial.length){
      next.push(v227Pick([
        'Übe '+v227At(s.partial)+' mit weiteren Aufgaben selbstständig, damit du noch sicherer wirst.',
        'Schau dir die Aufgaben '+v227At(s.partial)+' noch einmal an und bearbeite weitere Beispiele selbst.',
        'Wiederhole die Aufgaben '+v227At(s.partial)+' und prüfe anschließend deine eigenen Lösungen.'
      ],seed,139));
    }else{
      next.push(v227Pick([
        'Bleib dran und festige dein Können mit ein paar weiteren Übungsaufgaben.',
        'Such dir weitere Aufgaben zum Wiederholen und probiere sie selbstständig aus.',
        'Mach weiter so! Mit neuen Übungsaufgaben kannst du dein Können festigen.'
      ],seed,139));
    }
  }
  // Limit exuberance without turning "Klasse!" into the unnatural "Klasse.".
  let exclamations=0;
  for(const list of [strength,next]){
    for(let i=0;i<list.length;i++){
      if(exclamations>=2)list[i]=list[i].replace(/\s+Klasse!$/,'');
      list[i]=list[i].replace(/!/g,()=>{
        exclamations++;
        return exclamations<=2?'!':'.';
      });
    }
  }
  return {strength,next,strong:s.green[0]||null,development:s.red[0]||null};
}
function v229DefaultFeedback(report){
  const text=v229Compose(report);
  return {strength:text.strength.join(' '),next:text.next.join(' ')};
}
function v229Suggestions(report){return v229Compose(report);}
v224Suggestions=v229Suggestions;
v224DefaultFeedback=v229DefaultFeedback;
render();
