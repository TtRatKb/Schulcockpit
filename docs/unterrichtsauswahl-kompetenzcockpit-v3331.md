# Unterrichtsauswahl und Kompetenzcockpit V0.33.31

## Befund

- Der physische Fachtermin wird kanonisch durch Schuljahr, `classId`, Datum und numerischen `slot` identifiziert. `lesson.id` bleibt die Identität der konkreten Stundenkarte; `planReference.unitId` verweist auf die Reihenidee.
- Soll-Daten liegen in `sequence.plan`, die aktive Zuordnung in `lesson.planReference`. Ist-Daten bleiben in `lesson.actualV270`. Materialdateien bleiben über stabile `fileKey`-Referenzen in IndexedDB.
- Gehaltene/abgesagte Stunden und Ist-Einträge sind Historie. Vorbereitete offene Karten enthalten schützenswerte Dateien, Folien und Druckstatus. Sie dürfen bei einer Auswahl nicht gelöscht werden.
- Scheduler und Kartenabgleich lesen `planReference.unitId`; eine Lehrkraftwahl wird deshalb dort mit `autoMatched:false` und `manualPinnedV272` bestätigt. Es gibt keinen zweiten Terminplan.

## Sichere Einführung

V0.33.31 führt keine automatische Bestandsmigration aus. Bestehende Zuordnungen bleiben unverändert und erscheinen bis zu einer bewussten Wahl als Vorschlag. Die Auswahl schreibt transaktional in die bestehende Stundenkarte, hält den vorherigen Bezug in `teacherChoiceV3331.history` für eine spätere Undo-Oberfläche fest und bewahrt Materialien, Folien, Druckstatus sowie Reihenideen. Bereits gehaltener Unterricht wird abgewiesen.

Das Kompetenzcockpit ist zunächst read-only. Sein Nenner kommt aus dem vollständigen kursbezogenen Curriculumkatalog, nicht aus vorhandenen Reihen. „Geplant“ stammt aus expliziten Stunden-IDs, „unterrichtet“ ausschließlich aus bestätigten `actualV270`-Einträgen. „Überprüft“ und „individuell beurteilt“ bleiben bis zur Einführung eigener Nachweisobjekte bewusst null; Stunden-Tags werden nicht als Nachweis ausgegeben.
