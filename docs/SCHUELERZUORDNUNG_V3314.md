# V0.33.14 – Zwei gleiche Vornamen, unterschiedliche Nachnamen

Ausgang: Bei Religion Jg. 8 wurden zwei Schüler mit gleichem Vornamen, aber unterschiedlichen Nachnamen in der Punkte-/Notenübersicht verwechselt. Eine reguläre Arbeit und eine Inklusionsfassung waren parallel vorhanden.

## Ursächlicher Anzeige-Fehler

Die bisherigen V260-Notenfelder lasen `priv.roster[v200Eval.studentIndex]`, obwohl der Auswahlschalter in Schritt 5 die **nach Fassung gefilterte** `v200ReportList()` anzeigte. Bei nicht zusammenhängender Originalreihenfolge konnte das ausgewählte Kind und das gezeigte Punkte-/Notenblatt auf unterschiedliche IDs verweisen. V338 übersetzte den Index bei Sonderfassungen nochmals zwischen voller und gefilterter Liste – mit ähnlichem Risiko.

**Fix:** Schritt 5 liest das tatsächlich ausgewählte Report-Objekt samt `student.id`; V338 führt keine fehleranfällige Indexübersetzung mehr durch. Der PDF-Namenseditor V234 nutzte bereits die Report-Liste.

## Bisheriger Excel-Datenverlust-Risikopfad

`v200MergeRoster` baute bei der ursprünglichen Classtime-Datei die Teilnehmerobjekte neu und übernahm nur ID, Name und Zeilenindex; bestehende `classStudentId`-Verknüpfungen konnten verloren gehen. Bei identischem Namen hätte die bisherige Map eine frühere ID doppelt vergeben können.

**Fix:** Vollständiger normalisierter Name muss eindeutig sein. Die exakte Person behält alle Metadaten, stabile ID, Klassenverknüpfung und neuen Excel-Zeilenindex. Zusätzliche Personen (Nachschrift/Inklusion) bleiben erhalten. Doppelter vollständiger Name, doppelte ID oder doppelte Zeilennummer wird vor Änderungen mit Fehlermeldung gestoppt.

## Lokale Kontrolle und Korrektur

Schritt 1 enthält einen standardmäßig geschlossenen Bereich **Prüfungsnamen und Klassenliste abgleichen**. Bei einer Abweichung von exakt zugewiesener Klassenperson und vollständigem Prüfungsnamen ist er geöffnet und zeigt eine Warnung. Die Zuordnungen können kontrolliert und gesammelt nach Bestätigung korrigiert werden. Die Operation prüft alle Prüfungs-IDs, Konflikte bei Klassenpersonen und aktive Sonderfassungen, verändert ausschließlich `classStudentId` und dokumentiert die Änderung lokal (`studentLinkHistoryV3314`). Original-Excel, Aufgabenergebnisse, alte Versuche und Noten werden nicht verändert. Ein gespeicherter Teilnahmestatus wird ausdrücklich **nicht** still angepasst und muss in Schritt 4 separat überprüft werden.

**Wichtig:** Das Programm kann die beiden Personen ohne erneute Sichtprüfung der vollständigen Namen nicht sicher automatisch tauschen. Eine reine Anzeigeverwechslung ist nach Update korrigiert; ein tatsächlicher falscher Klassenlink muss ggf. explizit korrigiert werden.

## Regression

`tests/schuelerzuordnung-v3314.test.cjs`: fiktive „Leon Albrecht“ und „Leon Bergmann“, getrennte ID/Excel-Zeile, vorhandene Originalpunkte und Inklusionsversuche, absichtliche Verwechslung, Korrektur ohne Punkteverlust. `tests/browser-smoke.mjs`: Wechsel zwischen regulärem und Inklusionsreiter, identischer Vorname mit anderem Nachnamen, Grade-8-Editor und erfolgreiche sichere Link-Korrektur.

Keine echten Schülerdaten im Repository, ChatGPT oder in Testlogs.
