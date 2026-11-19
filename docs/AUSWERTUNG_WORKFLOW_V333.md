# Auswertung & Rückgabe – geführter Workflow

Stand: 19. November 2026. **Die Repo-Implementierung ist maßgeblich.** Keine sensiblen Schüler-/Prüfungsergebnisse in GitHub.

## V0.33.3: umgesetzt (erste UX-Etappe)

- Vorhandene Auswertungsschritte bleiben bestehen. Die Aufgabenübersicht zeigt die **wirksamen** regulären und Bonus-Maximalpunkte inklusive nachträglich vollständig als Bonus markierter Aufgaben und Bonuslücken.
- Bei einer regulären Aufgabe können die Fälle **regulär**, **vollständig Bonus** und **teilweise Bonus** direkt ausgewählt werden. Eine Bonuslücke erhält die Zahl der Bonuspunkte und eine beschreibende Bezeichnung.
- Die Original-Maximalpunkte, die Quellen (Classtime/Papier), unveränderte individuelle Rohwerte sowie bestehende Rechentechnik bleiben erhalten. Die ursprüngliche Punktetabelle ist weiterhin gezielt erreichbar und prüft weiterhin unzulässige Maximalpunktänderungen.
- Zusatzfragen und alte Spezialbedienung erscheinen nur in ausklappbaren Abschnitten: zusätzliche Papier-/Classtime-Aufgabe, Rohpunkt-Anpassung, andere Fassungen, Nachschreibimporte, Einzelregeln.
- Im Analyseschritt werden die reguläre Prüfungsfassung und separat analysierte Sonderfassungen in zwei Tabs angezeigt. Die privaten Punkteraster und Schülerzuordnungen bleiben jeweils getrennt.
- Auswertungsübersicht: **In Bearbeitung / Archiv**. Erst ein expliziter Klick auf „Zurückgegeben · archivieren“ blendet eine Arbeit aus der aktiven Liste aus. Die Prüfung, Dateien und Bewertungen bleiben gespeichert; zurückholen ist möglich.
- Synthetische Kern-Regressionsprüfungen und bestehende GitHub Actions begleiten Änderungen.

**Wichtig:** Ein fertig wirkender Punktestand ist nicht gleich eine tatsächliche Rückgabe. Die Lehrkraft entscheidet über den Archivstatus. Ohne bestätigte Rückgabe wird insbesondere keine alte Arbeit automatisch versteckt.

## Noch offen: End-to-End-Prüfungsworkflow (zukünftig)

1. **Vor der Klassenarbeit**: Kurs, Thema, Kompetenzgrundlage, Klassenliste, vorhandene/neue Prüfungsfassung; vorab Aufgabenpunkte, Regeln und ggf. differenzierte Fassungen prüfen. ChatGPT kann die Aufgaben *mit* der Lehrkraft ausarbeiten; keine personenbeziehbaren Daten in ChatGPT.
2. **Classtime-Vorbereitung**: geprüfte Aufgaben einschließlich Punkte und Zuordnung in ein von Classtime tatsächlich unterstütztes Austauschformat überführen. Erst reales Export-/Importformat prüfen; keines erfinden. Bei nicht maschinenlesbarem Import stattdessen geeignete Vorlagen/Copy-Paste-Ansichten.
3. **Nach der Arbeit**: erste Classtime-Excel oder Papierpunkte einlesen und anhand der **vorher hinterlegten** Klassenliste robust zuordnen, unklare Namen/Mehrdeutigkeiten nachfragen, Ergebnisdefizit nicht automatisch als Abwesenheit deuten.
4. **Nichtteilnahme**: für jede Person ohne Ergebnis ausdrücklich „schreibt nach“, „hat nicht teilgenommen“, „Papierpunkte fehlen“ oder „noch ungeklärt“ wählen. Jeder Zustand kann später ergänzt/korrigiert werden, ohne andere Kinder zu verändern.
5. **Sonderfassungen**: für regulär, Inklusion und ggf. eigene Nachschreibefassung langfristig vollständig getrennte Bearbeitungsreiter über **alle** Schritte; gemeinsamer Prüfungs-/Kursbezug, getrennte Rubriken und Ergebnisse.
6. **Korrektur**: nur erforderliche Regeln anzeigen, zunächst vorab bestätigte Punkte verwenden; spätere Umwertung und Bonuslücken mit nachvollziehbarem Nenner und unveränderten Rohdaten.
7. **Rückgabe**: bei Jg. 5–7 ggf. Kompetenzbogen, bei Jg. 8+ Punkte-/Notenbogen. Vorhandene Kinder unabhängig von fehlenden Nachschreibenden fertigstellen, ausgegebene PDFs nach späteren Änderungen gezielt neu erstellen.
8. **Abschluss/Archiv**: explizite Rückgabe dokumentieren, aus aktiver Liste ausblenden; wieder öffnen, nachträglich Ergebnisse importieren und neu ausgeben bleibt möglich.

## Regressionsinvarianten

- Vor jeder Änderung an produktiven Browserdaten ein vollständiges Backup und einen Restore-Test durchführen.
- Keine Namen oder individuellen Ergebnisse in GitHub, Prompts, öffentlichen Metadaten oder statischen Testdaten.
- Keine Schülerpunktwerte aus Aufgaben-Gesamtpunkten in Bonuslücken erraten. Bonusteilergebnisse individuell belegen.
- Einen bestehenden Classtime-Excel-Import niemals still mit einer anderen Prüfungsfassung verrechnen.
- Nachschreib-Excel ergänzt bestätigte, fehlende Zeilen; vorhandene Ergebnisse niemals ohne gesonderte Bestätigung ersetzen.
- Punktmaximum-Anpassungen nicht still hoch-/runterrechnen: vorhandene überhöhte Einzelpunkte und nicht mehr passende Excel-Spalten müssen erkennbar bleiben.
- Die bestehende automatische Ein-/Ausklapplogik, Klassenauswertung, Kompetenzen/Noten und PDFs müssen erhalten bleiben.
