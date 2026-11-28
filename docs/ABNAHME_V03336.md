# Abnahme V0.33.37 gegen `02_ABNAHME.md`

Stand: 28.11.2026, nach erneuter kritischer Prüfung von V0.33.36. Die verbindliche Quelldatei enthält **29** nummerierte Szenarien. „Bestanden“ wird nur verwendet, wenn der vollständige betroffene Workflow automatisiert oder als echter Browserdialog belegt ist. Die Quellenprüfung bezieht sich auf die drei unveränderten PDF-Originale mit den Hashes aus `QUELLENMATRIX_V03337.json`; die vollständige Übergabekonferenzdatei für Religion 6/7 liegt weiterhin nicht vor.

| ID | Status | Nachweis / Restpunkt |
|---|---|---|
| A01 | teilweise | Schutz- und Rollbacklogik vorhanden; vollständige doppelte Bestandsmigration bleibt ohne realistische Gesamtfixture offen. |
| A02 | bestanden | Vorschläge bleiben unbestätigt; Auswahl schreibt erst nach Aktion. |
| A03 | bestanden | Auswahl ist nun direkt in der Wochen-/Montagskarte bedienbar und kollisionsgeprüft. |
| A04 | bestanden | Kurs-, Slot- und Kollisionsprüfung im V3331-Core. |
| A05 | teilweise | Kanonische Lesson-ID und Reload getestet; vollständiger Scheduler-Rundlauf noch nicht als eigener E2E-Test. |
| A06 | teilweise | Tausch-/Drag-Tests und neue Bewegungsverlaufssicherung sind grün; ein kombinierter UI-Test aus Tausch, Vorschau und Nachweisprüfung fehlt noch. |
| A07 | bestanden | Ausfall setzt geplanten Nachweis auf `review_required`, keine Ist-Bestätigung. |
| B01 | bestanden | Verknüpfte lokale Originale sind in Alternativen öffnbar; fehlende Datei ist deaktiviert und beschriftet. |
| B02 | bestanden | V3332 Browser-/Core-Test: lokale Dateien, Materialhub-Link, kein PPT-Zwang. |
| B03 | bestanden | Gezielter datenschutzarmer Prompt, termin-/kursgebundener Delta-Block, sichtbare Vorschau und anschließende bewusste Speicherung im echten Browser getestet. |
| B04 | teilweise | Falscher Kurs, unbekannte Kompetenz-ID und veralteter Token werden ohne Zustandsänderung abgewiesen; persistenter Entwurf über Browserneustart fehlt noch. |
| B05 | bestanden | Bestehende Materialrealitäts-/Varianten-Tests verhindern falsche Druckfreigabe. |
| C01 | teilweise | Ist-Ersatz und Dateien werden historisiert; explizite Religion-9-Gesamtfixture fehlt. |
| C02 | bestanden | Korrekturmodus mit Bestätigung und Fassungshistorie. |
| C03 | bestanden | V324 übernimmt ausschließlich neue Sollvorlagen, referenziert tatsächlich gehaltenen Unterricht und verknüpft nun auch tatsächlich eingesetzte Material-IDs; 20 Transferregressionen grün. |
| D01 | bestanden | Vollständiger Katalog ist Nenner; Tags allein sind kein Nachweis. |
| D02 | bestanden | IDs werden dedupliziert, Quelle/ID angezeigt, Quellenlücke bleibt offen. |
| D03 | teilweise | CRU-5-Katalog 2026/27 ist versioniert; Original-PDFs Religion 6/7 sind per Hash, Seiten und Katalogzählung geprüft. Die vollständige Übergabekonferenzquelle für Themenverschiebungen fehlt, daher keine vollständige Freigabe. |
| D04 | bestanden | Automatische Lückenprüfung und gezielter Mini-Prompt vorhanden. |
| D05 | bestanden | Ausfall/fehlender Termin wird offen markiert; Verschieben behält stabile Lesson-Verknüpfung. |
| D06 | bestanden | Klassenstatus getrennt; offen/abwesend bleiben eigene Zustände. |
| E01 | bestanden | Anklickbare Einzelschüleransicht zeigt alle 11 aktiven CRU-Kompetenzen einschließlich „unbeurteilt“, datierte Einzelhistorie und Teil-/Vollnachweis ohne Mittelung; Browserdialog getestet. |
| E02 | bestanden | Klausurrasterzeilen bleiben getrennt und sind standardmäßig nur Teilnachweise. |
| E03 | bestanden | Stabile bestätigte IDs, Nachschreib-/LE-Regressionstests, keine NNE-Umdeutung. |
| E04 | teilweise | Vollständige anklickbare Schüleransicht und Druck aller unbeurteilten/Teilnachweise sind umgesetzt; ein End-to-End-Test einer nachträglich korrigierten Klausurreferenz fehlt noch. |
| F01 | bestanden | Private Daten getrennt; vorhandene Prompt-/ZIP-Tests prüfen Ausschluss. |
| F02 | teilweise | Getrenntes Backup und Rollback vorhanden; vollständige Neustart-/Fehlschreib-Gesamtfixture fehlt. |
| F03 | bestanden | Reguläre Export-/PPTX-/Klausurregressionen bleiben Teil des Smoke-Workflows. |
| F04 | teilweise | Reale Chrome-Dialogtests sind regulär eingebunden; echter Firefox- und Tastatur-/Small-Viewport-Lauf bleibt offen. |

## Freigabeurteil

V0.33.37 ergänzt sichere Delta-Rückimporte, umfassendere Nachweisbindungen, vollständige individuelle Katalogansichten, tatsächlich verwendete Folgejahrmaterialien und eine reproduzierbare Quellenmatrix. KI-Vorschläge mit `autoMatched=true` können nicht mehr direkt in die konkrete Vorbereitung geöffnet werden, bevor die Lehrkraft bestätigt hat. Offen bleiben insbesondere die fehlende Religion-6/7-Konferenzvollquelle, Firefox/Small-Viewport/Tastatur-E2E, persistente Delta-Entwürfe über Neustart und einzelne kombinierte Migrations-/Korrekturfixtures. Diese Punkte bleiben ausdrücklich „teilweise“.
