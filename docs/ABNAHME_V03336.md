# Abnahme V0.33.36 gegen `02_ABNAHME.md`

Stand: 28.11.2026. Die verbindliche Quelldatei enthält entgegen der Überschrift im Auftrag **29** nummerierte Szenarien (A01–A07, B01–B05, C01–C03, D01–D06, E01–E04, F01–F04). Deshalb werden alle 29 ausgewiesen. „Bestanden“ bedeutet durch einen vorhandenen automatisierten Test oder den neuen echten Browserdialog-Test belegt; „teilweise“ benennt die verbleibende Grenze.

| ID | Status | Nachweis / Restpunkt |
|---|---|---|
| A01 | teilweise | Schutz- und Rollbacklogik vorhanden; vollständige doppelte Bestandsmigration bleibt ohne realistische Gesamtfixture offen. |
| A02 | bestanden | Vorschläge bleiben unbestätigt; Auswahl schreibt erst nach Aktion. |
| A03 | bestanden | Auswahl ist nun direkt in der Wochen-/Montagskarte bedienbar und kollisionsgeprüft. |
| A04 | bestanden | Kurs-, Slot- und Kollisionsprüfung im V3331-Core. |
| A05 | teilweise | Kanonische Lesson-ID und Reload getestet; vollständiger Scheduler-Rundlauf noch nicht als eigener E2E-Test. |
| A06 | teilweise | Bestehende Tausch-/Drag-Tests grün; kombinierter Nachweis-Transfer verlangt weiterhin bewusste Prüfung. |
| A07 | bestanden | Ausfall setzt geplanten Nachweis auf `review_required`, keine Ist-Bestätigung. |
| B01 | bestanden | Verknüpfte lokale Originale sind in Alternativen öffnbar; fehlende Datei ist deaktiviert und beschriftet. |
| B02 | bestanden | V3332 Browser-/Core-Test: lokale Dateien, Materialhub-Link, kein PPT-Zwang. |
| B03 | teilweise | Gezielter datenschutzarmer Prompt vorhanden; automatischer Delta-Rückimport bleibt offen. |
| B04 | teilweise | Transaktionsrollback vorhanden; alter/falscher Delta-Import mangels Importfunktion noch offen. |
| B05 | bestanden | Bestehende Materialrealitäts-/Varianten-Tests verhindern falsche Druckfreigabe. |
| C01 | teilweise | Ist-Ersatz und Dateien werden historisiert; explizite Religion-9-Gesamtfixture fehlt. |
| C02 | bestanden | Korrekturmodus mit Bestätigung und Fassungshistorie. |
| C03 | teilweise | Soll/Ist-Trennung vorhanden; Folgejahrexport mit verwendeten Fassungen nicht vollständig neu geprüft. |
| D01 | bestanden | Vollständiger Katalog ist Nenner; Tags allein sind kein Nachweis. |
| D02 | bestanden | IDs werden dedupliziert, Quelle/ID angezeigt, Quellenlücke bleibt offen. |
| D03 | bestanden | CRU-5-Katalog 2026/27 ist versioniert; ältere Jahrgänge bleiben im bisherigen Katalog. |
| D04 | bestanden | Automatische Lückenprüfung und gezielter Mini-Prompt vorhanden. |
| D05 | bestanden | Ausfall/fehlender Termin wird offen markiert; Verschieben behält stabile Lesson-Verknüpfung. |
| D06 | bestanden | Klassenstatus getrennt; offen/abwesend bleiben eigene Zustände. |
| E01 | bestanden | Datierte Historie ohne Mittelung/Vorbelegung vorhanden; anklickbare Einzelschüler-Gesamtansicht bleibt offen. |
| E02 | bestanden | Klausurrasterzeilen bleiben getrennt und sind standardmäßig nur Teilnachweise. |
| E03 | bestanden | Stabile bestätigte IDs, Nachschreib-/LE-Regressionstests, keine NNE-Umdeutung. |
| E04 | teilweise | Historie bleibt erhalten; vollständige anklickbare Schüleransicht und Referenzaktualisierung noch offen. |
| F01 | bestanden | Private Daten getrennt; vorhandene Prompt-/ZIP-Tests prüfen Ausschluss. |
| F02 | teilweise | Getrenntes Backup und Rollback vorhanden; vollständige Neustart-/Fehlschreib-Gesamtfixture fehlt. |
| F03 | bestanden | Reguläre Export-/PPTX-/Klausurregressionen bleiben Teil des Smoke-Workflows. |
| F04 | teilweise | Reale Chrome-Dialogtests sind regulär eingebunden; echter Firefox- und Tastatur-/Small-Viewport-Lauf bleibt offen. |

## Freigabeurteil

Die Änderungen V0.33.36 sind als eigenständige, abwärtskompatible Härtung freigabefähig: keine destruktive Datenmigration, keine automatische Vollabdeckung und keine automatische Nachweisübertragung. Die als teilweise markierten Punkte dürfen nicht als vollständig abgeschlossen behauptet werden und bleiben Grundlage der nächsten Entwicklungsphase.
