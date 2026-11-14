# Schulcockpit: Schuljahresübernahme und Folgejahr-Stundenplan

Stand: 14. November 2026 · V0.32.5 · GitHub-`main` ist nach dem Merge die technische Quelle.

## Praktischer Ablauf

1. Jahresplanung → **Aus Vorjahr übernehmen** (V0.32.4): einzelne Reihen in neue oder passende vorhandene Fachkurse übernehmen. Das aktive Schuljahr und die alten Ist-Daten bleiben bestehen.
2. Jahresplanung → **Stundenplan fürs Folgejahr** (V0.32.5): Mo–Fr-Blockraster ausfüllen, gegebenenfalls weitere Fachkurse anlegen. Über **Vorjahres-Rhythmus als Vorschlag** werden nur eindeutig zuordenbare Stunden übernommen.
3. **Stundenplan speichern**. Er liegt zunächst ausschließlich in `state.schoolYearTimetablesV325[year]`; `state.timetable` für das laufende Schuljahr bleibt unverändert.
4. Optional **Reihentermine berechnen**: V190 verwendet für das geplante Folgejahr die separaten gespeicherten Stundenplanfelder. Ferien, kursbezogene Ausfälle und vorhandene Klassenarbeitstermine werden berücksichtigt.
5. **Erst am Beginn des Folgejahres**, nach eigener Datensicherung und zwei Bestätigungen, kann der neue Plan aktiviert werden. Die alte globale Stundenplanstruktur und ihre Periodenbeschriftungen werden unter dem alten Schuljahr archiviert.

## Bewusste Sicherheitsgrenzen

- Keine automatische Umschaltung durch den Kalender, beim Übernehmen von Reihen oder beim Speichern des zukünftigen Rasters.
- Keine Übertragung von Schülerlisten, Noten, Prüfungen, Unterrichts-Ist, Kopierstatus, Reflexionen oder generierten Präsentationen.
- Neue Fachkurse werden mit Schülerzahl 0 angelegt.
- GA-/Klassenzeiten aus dem alten Stundenplan werden zwar archiviert, aber für das Folgejahr **nicht** automatisch kopiert. Sie sind nach der Aktivierung ausdrücklich neu einzugeben.
- Keine Mehrfachbelegung desselben Wochentags/Blocks. Keine erfundene Zuordnung bei mehrdeutiger Herkunft einer Fachklasse.
- Zukünftige Reihentermine bleiben explizit ein eigener Arbeitsschritt; sie können später in der regulären Jahresplanung geändert werden.
- Bei unvollständigen amtlichen Feriendaten muss die mögliche Ungenauigkeit vor der Terminberechnung ausdrücklich bestätigt werden.
- Der globale Fachkurs- und Materialkatalog bleibt weiterhin gemeinsam; neue Kurs-IDs und Jahreskennzeichen verhindern das versehentliche Mischen von Ziel- und Ursprungskurs.
- **Rückfall bei Speicherfehler:** Wochenraster, Zielklassen und Einstellungen werden im aktiven UI wiederhergestellt. Ein echter Browser-/Cloud-End-to-End-Test mit individuellen Nutzerdaten bleibt zusätzlich sinnvoll.

## Technische Implementierung

- `schulcockpit-folgejahr-stundenplan-v325-core.js`: reine Validierung, Vorjahresvorschlag, Stundenplanaufbau, zukünftige Slots und Aktivierungsplan.
- `schulcockpit-folgejahr-stundenplan-v325.js`: UI, explizite Aktionen, `v190CourseSlots`-Integration.
- Speicherung `state.schoolYearTimetablesV325[year]={entries,periods,...}`; bereits vorhandene Stundenplan-IDs bleiben bei unveränderten belegten Zellen erhalten.
- `tests/folgejahr-stundenplan-v325.test.js`: 22 isolierte Prüfungen.
- `tests/browser-smoke.mjs`: End-to-End mit fiktiven Kursen, Vorjahresstunden, Reihenterminen und simuliertem Schuljahresbeginn.

## Nächste mögliche Ausbaustufen

- Eigene Klassen-/GA-Gruppen je Schuljahr und geführte Ersteinrichtung nach Aktivierung.
- Import aus echtem Wochenstundenplan (nur nach ausdrücklich bestätigtem Importformat).
- Vergleich der geplanten Sollstunden pro Kurs mit schulinterner Stundentafel.
- Optionales Archiv-/Wechselprotokoll mit Wiederherstellungsdialog, ohne alte Daten zu löschen.
