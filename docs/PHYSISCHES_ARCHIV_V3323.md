# V0.33.23 – Physisches Materialarchiv

## Warum dieses Feature klein bleibt
Die große Überarbeitung des Material-Hubs ist ausdrücklich vertagt. Stattdessen ergänzt das Schulcockpit einen eigenen optionalen Bereich **Physisches Archiv**, der über den bestehenden Material-Hub erreichbar ist. Bestehende Material-, Dateien-, Kopier- und Curriculumdaten bleiben unverändert.

## Drei Kategorien
1. **Restkopien**: noch vorhandene Ausdrucke; Anzahl veränderbar (manuell, nie automatisch).
2. **Mehrweg**: einlaminierte Karten, Stationsmaterial, Spiele und andere wiederverwendbare Sets; separat von Verbrauchskopien.
3. **Andenken**: Klassen-Erinnerungsstücke mit anlassbezogener Notiz und optionalem Wiedervorlagedatum. Keine Notwendigkeit für Schülernamen oder Inhalte einzelner Arbeiten.

## Lagerorte
Bei erster Nutzung werden 26 Fächer **A–Z** für den ausziehbaren Fächerordner definiert. Weitere Orte wie „Laminierbox L1“ oder „Erinnerungsbox“ lassen sich frei ergänzen. Ein Eintrag kann einen genaueren Unterort (Umschlag, Mappe) enthalten.

Der Fachbuchstabe ist eine **physische Adresse**, keine curriculare Zuordnung. Die internen IDs `fach-01` bis `fach-26` bleiben aus Gründen der Datensicherheit erhalten; im UI werden sie als A–Z angezeigt. Bereits angelegte Bestände in alten nummerierten Fächern werden so ohne Datenmigration korrekt zugeordnet (01 → A, 07 → G, 26 → Z). Ein Arbeitsblatt bleibt digital beliebig vielen Kursen zuordenbar, ohne physisch dupliziert zu werden.

## Material-Hub-Verknüpfung
Die bisherigen Materialzeilen erhalten den Nebenbefehl **Papierbestand**. Eine Bestandsnotiz kann dadurch mit einer vorhandenen Katalogdatei oder Materialfassung verknüpft werden. Alternativ sind Einträge ohne Digitaldatei möglich.

Die Prüfung auf verfügbare Restkopien berücksichtigt **nur exakt zugeordnete Material-/Varianten-IDs** `m:<materialId>:<variantId>`. Mehrwegmaterialien, verbrauchte/archivierte Einträge und andere Fassungen werden nicht als Druckkopien gezählt. Katalogeinträge ohne aktuelle Materialfassung werden zwar gefunden, aber nicht stillschweigend mit einer Druckdatei gleichgesetzt.

## Kopierworkflow
Im vorhandenen Dialog für die Kopiermengen (V0.33.2) wird bei einer geeigneten aktuellen Fassung angezeigt: „3 im Archiv, 25 benötigt, Vorschlag: 22 kopieren“. Der Button **Vorschlag einsetzen** passt nur den offenen Zahlenwert an. Erst die Lehrkraft speichert ihn über den bisherigen Button **Mengen speichern**.

Keine automatische Bestandsminderung bei Planung, Klick auf den Vorschlagsbutton, Druckpaket-ZIP oder Markierung „kopiert“. Die Menge wird erst beim tatsächlichen Entnehmen im physischen Archiv korrigiert. Das vermeidet fingierte Entnahmen und unbemerkte Doppelverwendung über mehrere Klassen hinweg. Später kann eine ausdrückliche Reservierungslogik ergänzt werden, falls wirklich nötig.

## Wiedervorlagen
Eintritt am Erinnerungsdatum (oder später): Hinweis auf der Startseite, solange das Erinnerungsstück aktiv ist. Keine Hintergrundprozesse, keine Push-Nachrichten, keine personenbezogenen Schülerdaten erforderlich.

## Speichern, Datenintegrität, Backup
Die kleine Metadatenstruktur `state.physicalArchiveV3323` wird über die bestehende `saveState()`-Funktion gespeichert; keine Migration alter Einträge. Bei Speicherfehler wird der Zustand zurückgerollt. Der Bestand wird nicht im Materialkatalog dupliziert. Datensatz bleibt im regulären Schulcockpit-Planungsbackup erhalten.

## Tests
- `tests/physisches-archiv-v3323.test.cjs`: 26 Fächer, Eingabevalidierung, getrennte Varianten und Artikeltypen, korrekte Mengenprognose, negative Mengen verhindert, Erinnerungsdatum sowie UI-Einbindung und unveränderte Druckpläne.
- `tests/browser-smoke.mjs`: Anlage einer Restkopie mit Materiallink, manuelle Entnahme, Anlage eines Andenkens, Hinweis auf der Startseite.
- Bestehende GitHub-CI und Browser-Smoke-Tests müssen unverändert grün bleiben.
