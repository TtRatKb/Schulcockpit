# V0.33.10 – Notenschlüssel pro Prüfungsfassung (Jahrgang 8+)

Stand: 20.11.2026. Dieses Update ergänzt die V0.33.8-Fassungsreiter und V0.33.9-Excel-Sicherheit.

## Neu

- Die reguläre Arbeit behält ihren bisherigen `assessment.gradeScaleV260`-Notenschlüssel unverändert.
- Jede vorhandene Inklusions-/Nachschreibedatei kann einen **eigenen Notenschlüssel** erhalten. Die fünf Prozentgrenzen liegen im privaten IndexedDB-Auswertungsdatensatz unter `variantGradeScalesV3310[fileKey]`.
- In Schritt 5 wird der Notenschlüssel **des aktiven Reiters** angezeigt und gespeichert. Bei einer neuen Sonderfassung bleibt die automatische Note absichtlich offen, bis die Lehrkraft ihren tatsächlich gültigen Schlüssel eingibt.
- Ausgegeben wird die Note auf Grundlage des tatsächlich für das Kind freigegebenen Sonderrasters **und** des dazugehörigen Notenschlüssels, nicht der regulären Arbeit.
- Bei der Navigation im Sonderreiter wird auch für Jahrgang 8+ die richtige Person ausgewählt, statt den Index aus der gesamten Prüfungsliste mit dem gefilterten Index zu verwechseln.
- Manuelle Noten, bestehende Punkte, alle Bonuswerte, Raster, frühere PDFs und die reguläre Skala werden nicht migriert oder verändert. Individuelle manuelle Noten behalten Vorrang.

## Regressionsnachweise

`tests/notenschluessel-v3310.test.cjs`: getrennte 1/2-Notenzuordnung bei gleicher Prozentzahl, neuer Sonderreiter ohne automatische Note, Erhalt der regulären Notenschwellen, Punkte/Bonuspunkte/manuellen Noten und Originaldaten.

Der vorhandene Chrome-Workflow und die bestehenden Browser-/PDF-/Backup-Regressionen bleiben erforderlich.

## Fachlicher Hinweis: Religion 8

Das hochgeladene Schulcurriculum Evangelische Religion der IGS Moormerland (Leistungsbewertung, S. 5) nennt für Jahrgang 8–10 die Notenbereiche **1 ab 91 %, 2 ab 81 %, 3 ab 66 %, 4 ab 50 %, 5 ab 25 %, sonst 6**. Das Cockpit trägt sie nicht ungefragt ein; bitte in Schritt 5 fachlich bestätigen. Bei einer zieldifferenten Inklusionsfassung sind die geltenden Bewertungsabsprachen maßgeblich.
