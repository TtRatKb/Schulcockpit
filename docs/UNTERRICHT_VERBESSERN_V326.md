# Unterricht verbessern 2.0 · Schulcockpit V0.32.6

Stand: 14. November 2026. Der tatsächliche GitHub-`main`-Stand bleibt die technische Quelle.

## Alltag: ein kleiner Impuls statt zusätzlicher Dokumentation

1. **Nach dem Unterricht:** In der bestehenden Blitzreflexion optional „Mehr Schüleraktivität“, „Kognitiv stärker aktivieren“ oder „Lernstand aller sichtbar machen“ anklicken. Erst die reguläre Schaltfläche **Reflexion speichern** erstellt die bereits existierenden V182-Verbesserungsaufgaben.
2. **Später:** Unter **Unterricht verbessern** nach Fach, Bereich, Bearbeitungsstand oder Zeitfenster (10/30/60 Minuten) filtern. Auch frei formulierte ältere Verbesserungsnotizen bleiben lokal lesbar. Die Liste ist eine Ansicht auf `state.backlog`, keine zweite Datenbank.
3. **Gezielt überarbeiten:** Bei einem Eintrag „Gezielt verbessern“ wählen. Didaktischen Schwerpunkt festlegen, den frei editierbaren Auftrag prüfen und wahlweise kopieren oder zusammen mit dem lokal verfügbaren Original in einem ZIP exportieren. Das ZIP wird **nicht automatisch hochgeladen**.
4. **Neue Materialien verwalten:** „Neue Materialfassung“ öffnet die vorhandene V296-Materialentwicklung mit Quellenverknüpfung. Originale, alte Stunden und alte Dateiversionen bleiben erhalten. Die neue Fassung wird **nicht ungefragt** in gehaltene Stunden, alte Druckaufträge oder ganze Reihen zurückgeschrieben.
5. **Erledigt:** Erst nach eigener Prüfung des tatsächlichen Ergebnisses den vorhandenen `state.backlog[].done`-Status setzen. Ein Prompt-Download ist kein Nachweis einer wirksamen Verbesserung.

## Didaktische Prinzipien

- **Aktivität ≠ Digitalität.** Eine einfach umsetzbare, lernwirksame Schülerhandlung hat Vorrang vor einer App oder einem Spiel ohne erkennbaren Mehrwert.
- **Denkanforderungen statt bloßer Beschäftigung.** Lernende sollen vergleichen, begründen, überprüfen, entscheiden oder zielgerichtet miteinander arbeiten.
- **Formative Rückmeldung** möglichst für alle sichtbar machen, ohne neue personenbezogene Leistungstabellen aufzubauen.
- **Differenzierung** als gemeinsamer fachlicher Kern mit angemessenen Hilfen und optionaler Vertiefung.
- **Erhalten, was funktioniert.** Keine vollständige Neuplanung nur um eine bestehende Aufgabe „innovativer“ aussehen zu lassen.
- **Erfahrungen aus Vorjahren:** Die ausdrücklich gewählten Verbesserungsflags erscheinen über die schon vorhandene V323-Unterrichtserinnerung erneut, werden aber nicht als automatische Qualitätsbewertung interpretiert.

## Datenschutz & Datenintegrität

- Prompts erhalten nur fest definierte Reflexionsflags als Beobachtungen. `backlog.note`, `backlog.detail`, `reflectionV182.note` und persönliche Lernstands-/Schülerdaten werden nicht automatisch übernommen.
- Das Stundenthema und der Materialtitel dienen als Kontext. Diese beiden frei benennbaren Felder im Prompt bitte vor dem Weitergeben prüfen.
- Ein Quellen-ZIP enthält nur die ausdrücklich ausgewählte Originaldatei (bei tatsächlicher lokaler Verfügbarkeit), den editierbaren Prompt und einen Datenschutz-Hinweis. Das ZIP kann **nicht** ohne Nutzeraktion einen externen KI-Dienst erreichen.
- Historische Unterrichts-, Material- und Kopierdaten werden weder überschrieben noch gelöscht. Das Fortschrittsbild beschreibt die **Anzahl dokumentierter Aufgaben**, nicht die pädagogische Qualität einer Lehrkraft.
- V296 erzeugt eigene Materialfassungen mit Herkunftsnachweis. Automatische Material-Ersetzung über Kurse hinweg ist ausdrücklich **nicht Bestandteil** von V0.32.6.
- Bestehende V182-Rückmeldungen und ältere manuelle Verbesserungsaufgaben bleiben sichtbar. Aufgaben ohne bekannte Fachzuordnung erhalten kein erfundenes Fach.

## Testabdeckung

- `tests/unterricht-verbessern-v326.test.js`: 19 deterministische Tests ohne echte Schülerdaten (Filter, Bestand, Fassung, Privatsphäre, Differenzierung, Prompt).
- `tests/browser-smoke.mjs`: realer Chrome-Ablauf für Blitzreflexion, V182-Backlog, Editierdialog, ZIP mit Beispiel-PDF, V296-Dialog und manuelles Abschließen.
- Bestehende Schuljahreswechsel-, Export- und Planungs-Regressionen bleiben aktiv.

## Sinnvolle Erweiterungen – nicht bereits umgesetzt

- Überarbeitete Materialfassungen gezielt für **ausgewählte zukünftige** Stunden aktivieren, mit Vorschauliste und unabhängiger Kopierprüfung.
- Wirksamkeit pädagogischer Veränderungen ausschließlich anhand freiwilliger, aussagekräftiger Unterrichtsbeobachtungen nach dem Erproben dokumentieren – keine automatische Erfolgsskala aus der Anzahl digitaler Tools.
- Didaktische Musterbibliothek mit kurzen Methodenbausteinen für Mathematik und Religion, die ohne neue Pflichtdokumentation in Stundenentwürfe eingefügt werden können.
