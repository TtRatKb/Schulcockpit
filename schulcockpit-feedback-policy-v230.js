/* Schulcockpit V0.23.0: policy-based, concise competency feedback.
 * Read-only from reports; no changes to results, IndexedDB or PDF.
 * Saved teacher feedbackV210 still takes precedence in v224CurrentValues.
 */
const V230_RULES=Object.freeze({namedMax:2,summaryFrom:3,mostRatio:.8,focusMax:2,bonusHigh:.8,limit:900});

// Reusable grammar forms. Extend these patterns as grades 5–7 gain new
// competencies; unfamiliar labels fall back to a safe quoted form.
const V230_TERMS=[
  {test:/zahlenstrahl.*stellenwert|stellenwert.*zahlenstrahl/,subject:'das Ablesen am Zahlenstrahl und das Arbeiten mit der Stellenwerttafel',where:'beim Ablesen am Zahlenstrahl und beim Arbeiten mit der Stellenwerttafel'},
  {test:/zahlen.*rund|runden.*zahlen/,subject:'das Runden von Zahlen',where:'beim Runden von Zahlen'},
  {test:/schriftlich.*addier|schriftlich.*addition/,subject:'das schriftliche Addieren',where:'beim schriftlichen Addieren'},
  {test:/schriftlich.*subtrah|schriftlich.*subtraktion/,subject:'das schriftliche Subtrahieren',where:'beim schriftlichen Subtrahieren'},
  {test:/fachbegriff|mathematische.*begriffe/,subject:'das Verwenden mathematischer Fachbegriffe',where:'beim Verwenden mathematischer Fachbegriffe'},
  {test:/zahlenstrahl/,subject:'das Ablesen am Zahlenstrahl',where:'beim Ablesen am Zahlenstrahl'},
  {test:/stellenwert/,subject:'das Arbeiten mit der Stellenwerttafel',where:'beim Arbeiten mit der Stellenwerttafel'},
  {test:/(?:brüche|brüchen|bruchzahlen).*?(?:addier|addition)/,subject:'das Addieren von Brüchen',where:'beim Addieren von Brüchen'},
  {test:/(?:brüche|brüchen|bruchzahlen).*?(?:multiplizier|multiplikation)/,subject:'das Multiplizieren von Brüchen',where:'beim Multiplizieren von Brüchen'}
];
function v230Term(c){
  const raw=(v224Clean(c?.text)||'diese Kompetenz').replace(/\s+/g,' ').slice(0,160);
  const match=V230_TERMS.find(t=>t.test.test(raw.toLocaleLowerCase('de')));
  return match||{subject:'die Kompetenz „'+raw+'“',where:'bei der Kompetenz „'+raw+'“'};
}
function v230Bonus(report){
  const b=(report?.competencies||[]).flatMap(c=>c.auditV210||[])
    .filter(x=>String(x.source||'').endsWith('_bonus')&&Number(x.max)>0);
  const full=b.filter(x=>x.earned!==null&&x.earned!==undefined&&Number.isFinite(Number(x.earned))&&
    Math.abs(Number(x.earned)-Number(x.max))<1e-9);
  const complete=b.length>0&&b.every(x=>x.earned!==null&&x.earned!==undefined&&
    Number.isFinite(Number(x.earned))&&Number(x.earned)>=0&&Number(x.earned)<=Number(x.max));
  const max=b.reduce((n,x)=>n+Number(x.max),0);
  const earned=complete?b.reduce((n,x)=>n+Number(x.earned),0):null;
  const ratio=complete&&max>0?earned/max:null;
  return {count:b.length,fullCount:full.length,ratio,
    all:ratio!==null&&Math.abs(ratio-1)<1e-9};
}
function v230Plan(report){
  const all=(report?.competencies||[]).filter(c=>Number(c.regularMax)>0);
  const evaluated=all.filter(c=>Number.isFinite(c.pct)&&
    ['erreicht','teilweise erreicht','noch nicht erreicht'].includes(c.status));
  const reached=evaluated.filter(c=>c.status==='erreicht').sort((a,b)=>b.pct-a.pct);
  const partial=evaluated.filter(c=>c.status==='teilweise erreicht').sort((a,b)=>a.pct-b.pct);
  const weak=evaluated.filter(c=>c.status==='noch nicht erreicht')
    .sort((a,b)=>a.pct-b.pct||Number(b.regularMax)-Number(a.regularMax));
  const total=evaluated.length,yes=reached.length,ratio=total?yes/total:0;
  const regularFull=Number(report?.totalMax)>0&&Number.isFinite(Number(report?.totalReg))&&
    Math.abs(Number(report.totalMax)-Number(report.totalReg))<1e-9;
  const bonus=v230Bonus(report);
  return {total,yes,ratio,reached,partial,weak,regularFull,bonus,
    allReached:total>0&&total===yes,
    ready:report?.complete===true&&total>0&&total===all.length};
}
function v230Choose(list,seed,salt){return v227Pick(list,seed,salt);}
function v230Summary(p,seed){
  if(p.allReached&&p.total>=2)return v230Choose([
    'Wow, du hast in allen Kompetenzbereichen die Lernziele erreicht!',
    'Klasse, alle Kompetenzbereiche hast du erfolgreich erreicht!',
    'In allen Kompetenzbereichen hast du die Ziele erreicht. Richtig stark!',
    'Das kann sich sehen lassen: Alle Kompetenzbereiche sind erreicht!'
  ],seed,11);
  const spread=p.ratio>=V230_RULES.mostRatio?'in den meisten':'in mehreren';
  return v230Choose([
    'Klasse, du hast '+spread+' Kompetenzbereichen das Lernziel erreicht!',
    'Das ist richtig gut: Du hast das Lernziel '+spread+' Kompetenzbereichen erreicht.',
    'Du hast das Lernziel '+spread+' Kompetenzbereichen erreicht. Super!'
  ],seed,13);
}
function v230Skill(c,seed,salt,earlier){
  const t=v230Term(c);
  const full=Number(c.regularMax)>0&&Number.isFinite(Number(c.regularEarned))&&
    Math.abs(Number(c.regularEarned)-Number(c.regularMax))<1e-9;
  const forms=full?[
    'Du hast '+t.where+' sogar alle regulären Punkte erreicht!',
    'Besonders toll: '+v229Upper(t.where)+' hast du die volle reguläre Punktzahl erreicht.',
    'Du hast '+t.where+' alle regulären Punkte geholt. Klasse!'
  ]:[
    'Du hast '+t.where+' das Lernziel schon erreicht. Klasse!',
    v229Upper(t.where)+' hast du bereits gute Ergebnisse erzielt.',
    'Du hast '+t.where+' schon gute Ergebnisse erreicht.'
  ];
  let s=v230Choose(forms,seed,salt);
  // Transitions are only added after an already existing skill sentence.
  if(earlier && !/^(?:Auch|Außerdem|Besonders|Du hast)/.test(s))
    s='Auch '+s.charAt(0).toLowerCase()+s.slice(1);
  return s;
}
function v230BonusPraise(p,seed){
  const b=p.bonus;
  if(!b.count||b.ratio===null)return '';
  if(p.regularFull&&b.all)return v230Choose([
    'Dazu hast du sogar alle regulären Punkte und sämtliche Bonuspunkte geholt. Wow!',
    'Besonders stark: Du hast alle regulären Punkte und alle möglichen Bonuspunkte erreicht!'
  ],seed,31);
  if(b.all)return v230Choose([
    'Bei den Bonusaufgaben hast du sogar alle Zusatzpunkte geholt. Super!',
    'Auch die Bonusaufgaben hast du vollständig geschafft. Klasse!'
  ],seed,33);
  if(b.fullCount){
    const n=b.fullCount,how=n===1?'einer Bonusaufgabe':n+' Bonusaufgaben';
    return v230Choose([
      'Ein toller Extra-Erfolg: Bei '+how+' hast du alle Zusatzpunkte geholt!',
      'Bei '+how+' hast du sogar die volle Bonuspunktzahl erreicht. Super!',
      'Zusätzlich hast du bei '+how+' alle möglichen Bonuspunkte bekommen. Klasse!'
    ],seed,35);
  }
  if(b.ratio>=V230_RULES.bonusHigh)return v230Choose([
    'Auch bei den Bonusaufgaben hast du richtig viele Zusatzpunkte gesammelt. Klasse!',
    'Die Bonusaufgaben sind dir ebenfalls sehr gut gelungen!'
  ],seed,37);
  return '';
}
function v230Strength(p,seed){
  if(!p.ready)return ['Die Ergebnisse sind noch unvollständig. Bitte prüfe zunächst die Bewertung.'];
  const out=[];
  if(p.yes>=V230_RULES.summaryFrom||p.allReached&&p.total>1)out.push(v230Summary(p,seed));
  else if(p.yes){
    p.reached.slice(0,V230_RULES.namedMax).forEach((c,i)=>
      out.push(v230Skill(c,seed,23+i*3,i>0)));
  }
  // After the overall summary, mention only one genuine exception when
  // no stronger regular-total or bonus achievement will already be praised.
  if(p.yes>=V230_RULES.summaryFrom&&!p.regularFull&&!p.bonus.fullCount&&!p.bonus.all){
    const special=p.reached.find(c=>Number(c.regularMax)>0&&Number.isFinite(Number(c.regularEarned))&&
      Math.abs(Number(c.regularMax)-Number(c.regularEarned))<1e-9);
    if(special)out.push(v230Skill(special,seed,43,false));
  }
  if(p.regularFull&&p.yes>=V230_RULES.summaryFrom&&(!p.bonus.all||!p.bonus.count))
    out.push(v230Choose([
      'Du hast sogar alle regulären Punkte erreicht. Richtig stark!',
      'Und auch die reguläre Punktzahl ist vollständig. Super!'
    ],seed,45));
  const praise=v230BonusPraise(p,seed);
  if(praise)out.push(praise);
  if(!out.length){
    if(p.partial.length||p.weak.some(c=>c.pct>0))
      out.push(v230Choose([
        'Einige Punkte hast du bereits erreicht. Das ist ein Anfang!',
        'Ein paar Teilschritte sind dir schon gelungen. Darauf kannst du beim Üben aufbauen!'
      ],seed,51));
    else out.push(v230Choose([
      'Kopf hoch! Schau dir die Aufgaben in Ruhe noch einmal an.',
      'Diese Arbeit war noch schwierig. Mit Übung kannst du die Grundlagen festigen.'
    ],seed,53));
  }
  return out;
}
function v230Practice(c,seed,i){
  const t=v230Term(c),band=v225Band(c);
  if(band==='zero')return v230Choose([
    'Wiederhole '+t.subject+' und löse anschließend selbst passende Übungsaufgaben.',
    'Schau dir die Aufgaben '+t.where+' noch einmal genau an und übe die Grundlagen selbstständig.'
  ],seed,71+i);
  if(band==='weak')return v230Choose([
    'Du hast '+t.where+' erst wenige Punkte erreicht. Schau dir die Aufgaben erneut an und löse selbst weitere Beispiele.',
    'Du hast '+t.where+' bisher nur wenige Punkte geholt. Wiederhole die Schritte und bearbeite selbst passende Übungen.'
  ],seed,75+i);
  if(band==='practice')return v230Choose([
    'Übe '+t.subject+' weiter: Schau dir deine Aufgaben erneut an und löse selbst ähnliche Beispiele.',
    'Schau dir deine Aufgaben '+t.where+' noch einmal an und bearbeite selbst weitere Übungen.'
  ],seed,79+i);
  return v230Choose([
    'Übe '+t.subject+' mit weiteren passenden Aufgaben, um sicherer zu werden.',
    'Sieh dir deine Aufgaben '+t.where+' noch einmal an und kontrolliere anschließend selbst gelöste Beispiele.'
  ],seed,83+i);
}
function v230Next(p,seed){
  if(!p.ready)return ['Vervollständige zunächst die noch offenen Bewertungen.'];
  const focus=[...p.weak,...p.partial].slice(0,V230_RULES.focusMax);
  if(focus.length)return focus.map((c,i)=>v230Practice(c,seed,i));
  return [v230Choose([
    'Mach weiter so! Probiere ruhig auch schwierigere Übungsaufgaben.',
    'Suche dir neue Aufgaben zum Wiederholen und löse sie selbstständig.',
    'Festige dein Können, indem du weitere Aufgaben selbstständig bearbeitest.'
  ],seed,89)];
}
function v230Punctuate(strength,next){
  let n=0;
  for(const list of [strength,next])for(let i=0;i<list.length;i++)
    list[i]=list[i].replace(/!/g,(_mark,position,whole)=>{
      if(++n<=2)return '!';
      return '.';
    }).replace(/\b(?:Klasse|Super)\.$/,'Das ist schön.');
}
function v230Compose(report){
  const p=v230Plan(report),seed=v227Seed(report);
  let strength=v230Strength(p,seed),next=v230Next(p,seed);
  v230Punctuate(strength,next);
  if(strength.join(' ').length>V230_RULES.limit)
    strength=['Du hast '+p.yes+' von '+p.total+' Kompetenzbereichen erreicht. Weitere Ergebnisse findest du in der Tabelle.'];
  if(next.join(' ').length>V230_RULES.limit)next=next.slice(0,1);
  return {strength,next,strong:p.reached[0]||null,development:p.weak[0]||p.partial[0]||null};
}
function v230DefaultFeedback(report){
  const s=v230Compose(report);
  return {strength:s.strength.join(' '),next:s.next.join(' ')};
}
v224Suggestions=v230Compose;
v224DefaultFeedback=v230DefaultFeedback;
const v230Step5Before=v200Step5;
v200Step5=function(a,priv){
  return v230Step5Before(a,priv).replace(
    'Alle erreichten und noch nicht erreichten Kompetenzen fließen in die Vorschläge ein.',
    'Die Tabelle zeigt alle Kompetenzen; die Rückmeldung würdigt das Gesamtbild, Besonderheiten und nächste Lernschritte.');
};
v224FeedbackPrompt=function(report){
  const p=v230Plan(report);
  return 'Formuliere zwei freundliche kurze Rückmeldungen für Mathematik in Klasse 5–7. '
    +'Die Tabelle enthält alle Kompetenzen: Bitte NICHT alle aufzählen. '
    +'Bei ein bis zwei erreichten Kompetenzen benenne die Stärken; ab drei erreichten Kompetenzen fasse das Gesamtbild zusammen. '
    +'Lobe volle reguläre Punkte nur, falls tatsächlich erzielt, und Bonus nur nach Nachweis. '
    +'Der Lernschritt muss eine eigenständige Aufgabe für das Kind enthalten. '
    +'Höchstens zwei Ausrufezeichen, du-Anrede, keine unbelegten Erklärungen. '
    +'Keine Namen, IDs, Klassenbezeichnungen, Punkte, Prozentzahlen oder Daten. '
    +'Antwort in genau zwei Zeilen: STÄRKE: ... und NÄCHSTER SCHRITT: ...\\n'
    +'Erreichte Bereiche: '+p.yes+' von '+p.total+'.\\n'
    +'Beste Bereiche: '+(p.reached.slice(0,2).map(x=>v224Clean(x.text)).join('; ')||'keine')+'\\n'
    +'Übungsschwerpunkt: '+(p.weak[0]||p.partial[0]?v224Clean((p.weak[0]||p.partial[0]).text):'Vertiefung');
};
render();
