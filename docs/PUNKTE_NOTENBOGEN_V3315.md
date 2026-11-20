# V0.33.15 – Punkte- und Notenbogen ab Jahrgang 8

Datum: 20. November 2026. Maßgeblich: aktueller Code aus `main` vor diesem Patch (V0.33.14).

## Reproduzierter Defekt (große farbige, inhaltsleere Blöcke)

Der PDF-Renderer für Jahrgang 8+ in `schulcockpit-bewertung-v260.js` erstellte `pages` als Array von einzelnen PDF-Text- und Zeichenoperationen und gab **dieses unverbundene Array** zurück. `v204PdfBytes` aus `schulcockpit-report-pdf-v233.js` erwartet jedoch pro Seite einen **vollständigen Textstream**. Die Streamlänge `/Length` wurde daher aus der Anzahl der Zeichenbefehle statt der Länge des Textstreams gebildet, und die PDF-Ausgabe enthielt durch implizite Array-Konvertierung Kommata. Das erklärt die teilweise zeichnenden Flächen und das Fehlen der eigentlichen Tabelle.

**Fix:** `v233ReportPages` liefert für Jahrgang 8+ wie der ursprüngliche Kompetenzausdruck `pages.map(commands => commands.join(''))`. Der Test prüft jede Streamlänge gegen die Byteposition des folgenden `endstream` und kontrolliert Textinhalt sowie mehrseitige PDF-Ausgaben.

## Neues, kompaktes Rückgabeformat

- Titel, vollständiger privater Druckname, Schreib-/Korrekturdatum
- Jede Aufgabenbezeichnung (kein verpflichtender E/TE/NNE-Kompetenzblock)
- **Regulär: erreicht / möglich** und **Bonus: erreicht / möglich** in getrennten Spalten
- Nachträglich ausgewiesene Bonuslücken (z. B. Lücken 2, 6 und 9) werden **mit dem regulären Anteil derselben Aufgabe in einer Zeile** zusammengeführt
- Reine Bonusaufgaben, nicht gewertete Aufgaben und 0 erreichte Punkte bleiben explizit erkennbar
- Gesamtübersicht: regulär erreichte / maximal mögliche Punkte, Bonus erreicht / maximal möglich, anrechenbar / regulär möglich, Prozentwert (maximal 100 %)
- Note einschließlich Hinweis „manuell festgelegt“, falls tatsächlich manuell gesetzt
- **Notenschlüssel 1–6** mit Prozentgrenzen und rechnerischen Punktegrenzen (auf 0,01 Punkte nach oben gerundet). Der tatsächliche Notenschlüssel wird für die spezifische Prüfungsfassung aus `variantGradeScalesV3310[fileKey]` gelesen; die reguläre Fassung nutzt `assessment.gradeScaleV260`. Fehlt ein gültiger Schlüssel, werden keine Grenzen erfunden.

**Kein Eingriff** in Schüler-/Klassenlisten, Excel-Rohdaten, Bonuskorrekturen, Note, Prüfungszuordnung, Versuchshistorie oder Notenschlüssel. Neue Ansicht ist ausschließlich PDF-Ausgabe. Der Kompetenzausdruck für Jahrgänge 5–7 bleibt unverändert.

## Tests

- `tests/notenbogen-v3315.test.cjs`: fiktive Aufgaben, Bonuslücken 9 → 6 regulär + 3 Bonus, Aufgabenfolge, Nullpunkte, Ausschlüsse, Grenzwerte und Fassungstrennung
- `tests/browser-smoke.mjs`: Generiert echte PDF-Bytes für synthetische 8.-Klasse, kontrolliert alle `/Length`-Angaben, sichtbare Aufgaben-/Punkt-/Notentexte, andere Skala für Inklusionsfassung und mehrseitige Ausgabe
- Vor Merge alle GitHub-Checks und anschließend GitHub-Pages-Deployment prüfen.
