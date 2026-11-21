# V0.33.22 – Rasterquelle ohne Pflicht-Upload und ausgerichtete Quellenwahl

## Nutzerproblem
Bei „Auswertung & Rückgabe“ war eine ChatGPT-Analyse nicht importierbar, wenn ChatGPT einen aus einem Screenshot bekannten Kolleg*innenraster als `provided-rubric` bezeichnet hatte, die Originaldatei aber **nicht lokal im Schulcockpit** gespeichert war. Der alte Dialog erzwang eine überbreite Datei-Dropdown/Checkbox-Kombination.

## Korrektur
- Bei einem unbekannten Raster-Dateinamen erscheint eine klar ausgerichtete Auswahl mit drei weiterhin unterscheidbaren Fällen:
  1. **ChatGPT hat eigene Rasterzeilen aus den wirklich geprüften Aufgaben formuliert**: Erst nach ausdrücklicher Lehrkraftbestätigung wird nur `rubricV209.origin` auf `task-derived` gesetzt, `sourceFile` geleert und die Herkunft in `derivationNote` dokumentiert.
  2. **Kolleg*innenraster wurde aus einem Screenshot im Chat tatsächlich übernommen**: Die Quelle bleibt `provided-rubric` und wird als bestätigter `sourceKindV3322: 'chat-screenshot'` ohne vorgetäuschte lokale Datei geführt. Der Validator erlaubt diesen Ausnahmefall nur mit `sourceConfirmedV3322: true`, leerem `sourceFile` und aussagekräftiger `sourceDescriptionV3322`.
  3. **Tatsächlich vorhandene lokale Rasterdatei**: Kann wie bisher eindeutig verknüpft werden. Die klassische Quellendatei-Validierung bleibt aktiv.
- Die eigene Quellenauswahl ist ein bewusstes fachliches Urteil. Keine automatische Umklassifizierung aus Dateinamen oder Raten des ChatGPT-Outputs.
- Bereits eingefügter Importtext wird übernommen. Kein erneuter ChatGPT-Durchgang erforderlich.
- Aufgaben-/Raster-IDs, Punkte, Bonusregeln, originale Formulierungen und private Schülerdaten werden bei der Quellenkorrektur nicht verändert.
- Nach Quellenwahl läuft derselbe bestehende Import samt V0.33.21-Kompetenzfilter, Prüfung auf gültige Aufgaben/Raster/Prozentschwellen und Schutz bereits eingetragener Punkte.
- Der Rückgaberaster-Vorschauhinweis zeigt bei einer Screenshotquelle ehrlich an, dass sie nicht lokal hinterlegt ist.

## Oberfläche
- Kompakte, responsive Auswahlkarten; jede Karte hat ihren erklärenden Text direkt neben dem Auswahlfeld.
- Datei-Upload und altes Rasterdatei-Select bleiben unter einer zusammengeklappten **optionalen** Auswahl.
- Bei engem Bildschirm eine einspaltige Darstellung; kein horizontales Herauslaufen der Quellenkarte.

## Prüfung
- Node-Tests für beide Herkunftswege, fehlende Bestätigung, Schutz vorhandener Daten und den V209-Validator.
- Chrome-Smoke-Test: ein nicht hinterlegtes Screenshot-Raster durch die neue Auswahl in einen eigenständig generierten Rastervorschlag übernehmen und ohne Upload zur Rastervorschau gelangen; Bounding-Rect-Test gegen horizontales Verschieben.

**Nicht geändert:** lokale Dateispeicherung, Originale, Schülerpunkte, PDF-Bewertungsregeln, bereits gespeicherte Arbeiten und V0.33.21-Themenfilter.
