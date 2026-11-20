# Schulcockpit V0.33.9 – Inklusions-ClassTime-Excel sicher zuordnen

Stand: 20. November 2026. Änderung baut auf V0.33.8 auf, ohne die private Datenstruktur zu migrieren.

## Behobener Unterschied zwischen regulärer Auswertung und Sonderfassungen

- Der separate V300-Excel-Nachimport bietet jetzt eindeutige **Frage-Nr.-Vorschläge aus den Q-Fragenbeschreibungen** an, auch wenn „Frage 3b“ nicht „Q3“ ist. Vorbelegungen sind keine stillen Importe.
- **Numerisch bewertete Bonusfragen** (`classtime_bonus` mit `bonusMax > 0`) werden mit ihrem **Bonusmaximum** zugeordnet und in den vorhandenen privaten `bonusScores` gespeichert, mit Ursprung `bonusOriginsV213`.
- **0/0-Bonusfragen** werden weiterhin ausdrücklich manuell beurteilt. Abweichende Excel-Maxima, doppelte Q-Zuordnungen und mehrdeutige Beschreibungen werden nicht automatisch akzeptiert; es gibt keine verdeckte Umrechnung.
- Beim Ergänzen bleiben Original-Classtime-Dateien, bereits korrigierte Kinder, individuelle Bonuswerte und manuelle Herkünfte erhalten. Abweichende vorhandene Bonuswerte verlangen den bestehenden ausdrücklichen Ersetzungsdialog.
- Keine neue Datenbank, keine automatische Punkte- oder Notenumstellung, keine Schülerdaten im Repository.

## Tests

`tests/nachschreiben-v300.test.js` erweitert: eigene fiktive Sonderfassung mit drei digital bewerteten Aufgaben inklusive 3-Punkte-Bonusfrage, zuverlässige Q-Beschreibungsvorschläge, mehrdeutige Treffer, alte Punkte schützen, identische manuelle Bonuswerte erhalten, alte Originaldatei nicht ändern. Bestehende GitHub-Smoke- und Chrome-Tests bleiben erforderlich.

## Separat zu prüfen

Der Jahrgang-8-Notenschlüssel `assessment.gradeScaleV260` gehört bisher zur gesamten Klassenarbeit. Ein eigener Inklusions-Notenschlüssel ist mit V0.33.9 **noch nicht implementiert**. Deshalb in der Inklusionsfassung keine abweichende Skala speichern, bevor diese getrennt implementiert und getestet ist. Bis dahin fachlich geprüfte manuelle Noten verwenden oder die gemeinsame Skala verwenden, wenn sie in beiden Fassungen tatsächlich identisch sein soll.
