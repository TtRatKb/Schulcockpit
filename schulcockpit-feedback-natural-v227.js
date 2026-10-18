/* Schulcockpit V0.22.7 – variationsreiche Rückmeldungen aus lokalen Ergebnissen.
 * Nur Textvorschläge: keine Veränderung an Schülerdaten, Punkten, Status,
 * vorhandenen persönlichen Rückmeldungen, Backup oder PDF-Logik.
 */
const V227_VERSION='V0.22.7';

function v227Seed(report){
  const id=String(report?.student?.id||'feedback');
  let hash=2166136261;
  for(let i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),16777619);
  return hash>>>0;
}
function v227Pick(options,seed,salt=0){return options[(seed+salt)%options.length];}
function v227Join(items){
  if(items.length<2)return items[0]||'';
  if(items.length===2)return items.join(' und ');
  return items.slice(0,-1).join(', ')+' und '+items[items.length-1];
}
function v227At(items){return v227Join(items.map(c=>v225At(c.text)));}
function v227Nouns(items){return v227Join(items.map(c=>v225Noun(c.text)));}
function v227Capital(text){return text.charAt(0).toUpperCase()+text.slice(1);}
function v227Bonus(n,seed){
  if(!n)return '';
  const names=['','einer','zwei','drei','vier','fünf','sechs'];
  const at=n===1?'einer Bonusaufgabe':(names[n]||n)+' Bonusaufgaben';
  const forPhrase=n===1?'eine Bonusaufgabe':(names[n]||n)+' Bonusaufgaben';
  return v227Pick([
    'Zusätzlich hast du bei '+at+' alle möglichen Zusatzpunkte erreicht.',
    'Bei '+at+' konntest du sogar die volle Bonuspunktzahl sammeln.',
    'Auch die Bonuspunkte können sich sehen lassen: Bei '+at+' hast du alle Zusatzpunkte bekommen.',
    'Für '+forPhrase+' hast du darüber hinaus die volle Zahl an Bonuspunkten erhalten.'
  ],seed,17);
}
function v227Compose(report){
  const s=v225FeedbackParts(report),seed=v227Seed(report);
  const perfect=s.green.filter(c=>v225Band(c)==='perfect');
  const reached=s.green.filter(c=>v225Band(c)==='reached');
  const zero=s.red.filter(c=>v225Band(c)==='zero');
  const low=s.red.filter(c=>v225Band(c)==='weak');
  const practice=s.red.filter(c=>v225Band(c)==='practice');
  const strength=[],next=[];
  if(s.green.length>=3){
    strength.push(v227Pick([
      'Das kann sich wirklich sehen lassen!',
      'Du hast in dieser Arbeit viele Stärken gezeigt.',
      'Eine richtig starke Leistung!',
      'In mehreren Bereichen zeigst du schon großes Können.'
    ],seed));
  }
  if(perfect.length){
    const at=v227At(perfect);
    strength.push(v227Pick([
      'Die volle Punktzahl hast du '+at+' erreicht.',
      'Besonders stark sind deine Ergebnisse '+at+': Hier erreichst du die volle Punktzahl.',
      'Du erreichst '+at+' sogar die volle Punktzahl.',
      'Mit der vollen Punktzahl '+at+' erzielst du ein besonders gutes Ergebnis.'
    ],seed,3));
  }
  if(reached.length){
    const at=v227At(reached),nouns=v227Nouns(reached),plural=reached.length>1;
    strength.push(v227Pick([
      'Auch '+at+' kommst du schon gut zurecht.',
      'Gut gelungen '+(plural?'sind':'ist')+' dir außerdem '+nouns+'.',
      'Du zeigst bereits viel Können '+at+'.',
      'Auf einem guten Weg bist du '+at+'.'
    ],seed,7));
  }
  const bonus=v227Bonus(s.fullBonus.length,seed);
  if(bonus)strength.push(bonus);
  if(!strength.length){
    if(s.partial.length)strength.push('In einigen Bereichen hast du schon Punkte erreicht. Darauf können wir aufbauen.');
    else if(s.red.some(c=>Number(c.pct)>0))strength.push('Einige Punkte hast du bereits erreicht. Das ist ein Anfang, auf dem wir aufbauen können.');
    else strength.push('Wir schauen gemeinsam, wie dir die Aufgaben Schritt für Schritt besser gelingen können.');
  }
  if(zero.length){
    const at=v227At(zero),nouns=v227Nouns(zero),plural=zero.length>1;
    next.push(v227Pick([
      v227Capital(at)+' hast du diesmal noch keine Punkte erreicht. Wir wiederholen dazu die Grundlagen.',
      'Noch schwergefallen '+(plural?'sind':'ist')+' dir '+nouns+'. Hier gehen wir die Grundlagen in Ruhe durch.',
      'Für '+nouns+' gab es diesmal noch keine Punkte. Wir fangen bei den Grundlagen an.',
      'Diesmal hat es '+at+' noch nicht geklappt. Wir üben diese Bereiche gemeinsam von Grund auf.'
    ],seed,11));
  }
  if(low.length){
    const at=v227At(low);
    next.push(v227Pick([
      'Erste Punkte hast du '+at+' bereits erreicht. Mit gezieltem Üben wirst du hier sicherer.',
      'Ein Anfang ist '+at+' schon gemacht. Diese Aufgaben brauchen aber noch Übung.',
      'Du hast '+at+' bereits einzelne Punkte gesammelt. Darauf bauen wir Schritt für Schritt auf.',
      'Noch viel Übung brauchst du '+at+'. Die ersten erreichten Punkte sind aber eine gute Grundlage.'
    ],seed,13));
  }
  if(practice.length){
    const at=v227At(practice);
    next.push(v227Pick([
      v227Capital(at)+' hast du bereits einige Punkte geholt. Übe hier weiter, um sicherer zu werden.',
      'Auch '+at+' hast du bereits Punkte erreicht, aber weitere Übung hilft.',
      'Du hast '+at+' bereits Teilerfolge erzielt. Jetzt geht es darum, sicherer zu werden.',
      'Weitere Übung lohnt sich '+at+'. Einige Punkte hast du hier bereits erreicht.'
    ],seed,19));
  }
  if(!s.red.length){
    if(s.partial.length){
      const at=v227At(s.partial);
      next.push(v227Pick([
        'Auch '+at+' hast du schon Teile geschafft. Übe hier weiter, um sicherer zu werden.',
        'Bei den Aufgaben '+at+' hast du bereits Punkte erreicht. Mit etwas Übung wird es noch sicherer.',
        'Mit weiterer Übung kannst du '+at+' noch sicherer werden.',
        v227Capital(at)+' bist du schon auf einem guten Weg. Bleib dran.'
      ],seed,23));
    }else{
      next.push(v227Pick([
        'Bleib dran und festige deine Stärken mit passenden Übungsaufgaben.',
        'Mit weiteren Übungsaufgaben kannst du dein Können gut festigen.',
        'Übe ruhig weiter, damit du deine starken Ergebnisse sicher halten kannst.'
      ],seed,29));
    }
  }
  return {strength,next,strong:s.green[0]||null,development:s.red[0]||null};
}
function v227Suggestions(report){return v227Compose(report);}
function v227DefaultFeedback(report){
  const sentences=v227Compose(report);
  return {strength:sentences.strength.join(' '),next:sentences.next.join(' ')};
}
// Bestehende Editoren und PDFs fragen diese beiden Funktionen ab.
// feedbackV210 wird von v224CurrentValues / v200Feedback weiterhin bevorzugt.
v224Suggestions=v227Suggestions;
v224DefaultFeedback=v227DefaultFeedback;
render();
