# V0.33.20 – Notenspiegel direkt über der Korrekturmatrix / Aufgaben als Bonus umwerten

## Hintergrund

Die Lehrkraft möchte bei der Religionsarbeit Jahrgang 8 und bei einer übernommenen Klassenarbeit Jahrgang 7 sehen, wie sich eine nachträgliche allgemeine Bonuswertung auf die Verteilung von Noten 1–6 auswirken würde. Ab Jahrgang 5–7 gibt es im eigentlichen System E/TE/NNE (ab 70/50 %); **ein Notenspiegel auf der Korrekturseite ist dort ausschließlich eine interne statistische Hilfe**, kein neues Zeugnis-/Bewertungssystem.

## Umsetzung

- Direkt **oberhalb der bestehenden V221-Korrekturmatrix** (reguläre Arbeit und getrennte Prüfungsfassungen über V338/V3316): kompakter Notenspiegel 1–6 mit sechs Zahlen, Anzahl vollständig korrigierter und noch offener Arbeiten, nicht vergleichbarer/nicht teilnehmender Schüler, Anteil Note 5/6, Durchschnitt und Anzahl Schüler bis **1 Punkt** vor dem nächsten rechnerischen Notensprung. Nichts wird durch diese Anzeige gespeichert.
- Es zählen nur **vollständig berechenbare** Ergebnisse der jeweiligen Prüfungsfassung. Fehlende Antworten, ungeklärte Bonuslücken, Nachschreiber und andere Prüfungsfassungen werden nicht als Fünfen oder Sechsen interpretiert. Echte Schulnoten dürfen nicht nur aufgrund einer Statistik automatisch verändert werden.
- Prozentgrenzen für Vorschau: **91 / 81 / 66 / 50 / 25**. Bei Jahrgang 8+ verwendet der Vergleich den tatsächlich für diese Prüfungsfassung hinterlegten privaten/öffentlichen Schlüssel, falls vorhanden; ansonsten wird ausdrücklich „Orientierung – Notenschlüssel noch nicht gespeichert“ angezeigt. Bei Jahrgang 5–7 immer als interne Vergleichsrechnung. Die schon vorhandene 0,25-Punkte-Grenzfunktion des Schulcockpits wird verwendet.
- In den Korrekturzeilen steht ergänzend eine rechnerische Note (bei 5–7 ausdrücklich „Interne Note“), bei höchstens einem noch fehlenden Punkt zusätzlich der Abstand und die nächstbessere Note. **Keine automatische Aufwertung**.
- **Direkt im Spaltenkopf** führt die kompakte Schaltfläche „Wertung ⚙“ zu regulär / vollständig Bonus / teilweise Bonus. Bei teilweisen Bonuspunkten: Anzahl (Viertelpunkte) und Lückenbezeichnung (z. B. 2, 6, 9).
- Schon vor dem Speichern zeigt das System eine **Live-Vorschau** des resultierenden Notenspiegels und der rechnerischen Noten in den Zeilen. Bei neu geteilten Bonuslücken müssen individuelle Aufteilungen nachgetragen werden, bis dahin erscheint die statistische Auswertung richtigerweise als noch offen.
- Speichern **nur nach ausdrücklicher Bestätigung**, mit Vorher/Nachher-Zahlen. Bestehende Privatpunkte und originale Excel-/Classtime-Werte werden nicht überschrieben. Gespeicherte Bonusaufteilungen verhindern eine unbemerkte Veränderung des Bonusanteils.
- Regulär: Änderung nur am vorhandenen `assessment.evaluationV200.analysis.items` mit `saveState`; Sonderfassung: nur `variantAnalysesV317[fileKey]` in privater IndexedDB. Keine künstliche neue Klassenarbeit oder zweite Schülerliste.
- Die vorhandene individuelle `☆ Bonus`-Schaltfläche und die `Davon Bonus`-Eingabe bleiben erhalten.

## Tests

- `tests/notenspiegel-v3320.test.cjs` (fiktive Daten): 1–6-Verteilung, unvollständige Arbeiten/Nachschreiber, globaler Bonuswechsel, nicht mutierende Vorschau, Schutz bereits korrigierter Bonuslücken, 0,25-Punkte-Abstand zur besseren Note, separate Inklusionsfassung, Kompetenzbewertung 5–7 unverändert.
- `tests/browser-smoke.mjs`: tatsächliche Bedienung Jahrgang 7, Live-Vorschau und bestätigter Bonuswechsel bei weiterhin gleichen Einzelpunkten, interne Klassifikationen, offene Bonuslücken; separate Inklusionsmatrix mit histogramm und abgebrochener Vorschau.
- Bestehende Exporte, Originalpunkte, Note und Rückgabebögen unberührt; keine personenbezogenen Schülerdaten im Repository oder ChatGPT.
