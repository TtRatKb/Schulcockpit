# V0.33.27 – Dateien im physischen Archiv hinzufügen und Erinnerungen vereinfacht erfassen

## Aufgabe
Beim Zuordnen physischer Arbeitsblätter ist eine Datei manchmal noch gar nicht im Material-Hub vorhanden. Bislang konnte sie nur über einen anderen Bildschirm importiert werden. Bei Erinnerungsstücken mussten Klasse, Anlass und Datum über mehrere freie Textfelder eingetragen werden.

## Dateien direkt hinzufügen
- Im Archiv unter **Digitales Material verknüpfen** kann eine Lehrkraft mit einem gewöhnlichen Datei-Auswahlfeld eine **neue Datei hinzufügen** (bis 80 MB, PDF/Word/PowerPoint/Excel/Bild/Text und ODF). Eine neue normale Materialkarte mit genau einer Standardfassung wird im bisherigen `state.materials` angelegt und die Datei per `fileStorePut` in **IndexedDB auf diesem Gerät** gespeichert. Der zugehörige neue Datensatz wird direkt zum gerade bearbeiteten Archivgegenstand verknüpft.
- Die Datei ist über die normale Materialsuche auffindbar und ihre Vorschau funktioniert wie in V0.33.26. Es wird weder GitHub verwendet noch ein separates Uploadverzeichnis geschaffen. Die bestehenden Unterrichts- und Klassendaten bleiben unangetastet.
- Optional lässt sich ein **noch nicht lokal hinterlegtes Original** an eine bereits ausgewählte Katalogdatei (`c:...`) oder Materialfassung (`m:...:...`) hängen. **Bereits vorhandene Dateien werden niemals stillschweigend überschrieben.** Bei abweichendem Dateinamen erfordert ein Katalog-Anhang eine Bestätigung.
- Neue Materialdateien bleiben auch dann im Material-Hub, wenn der Papierarchiv-Eintrag anschließend verworfen wird; die Anlage einer Digitaldatei ist eine eigene bewusste Aktion.
- Im Fehlerfall versucht das Archiv, die unvollständig abgelegte neue Datei und die neu erzeugten Metadaten zurückzunehmen. Bereits vorher vorhandene Originaldateien werden nicht gelöscht.
- Beim Anhängen einer Katalogdatei wird zusätzlich der bestehende materialcatalog-IndexedDB-Datensatz explizit gespeichert; eine spätere Aktualisierung des Materialkatalogs erhält bestehende `localFileKey`-Verknüpfungen für IDs, die im neuen Manifest vorhanden sind.
- Da echte Binärdateien im lokalen IndexedDB liegen, müssen Originale bei Gerätewechsel bzw. Browserprofilwechsel nach dem allgemeinen Schulcockpit-Dateiworkflow neu verbunden oder übertragen werden. Ein JSON-Backup allein ersetzt keine Dateibinärsicherung.

## Erinnerungsstücke ohne viele Freitextfelder
- Bei der Materialart **Erinnerungsstück** erscheinen zunächst nur **Klasse/Kurs**, **Wann erinnern?** und **Erinnerung ab**.
- Die Klasse wird direkt aus vorhandenen Schulcockpit-Klassen gewählt. Die Gruppenbezeichnung und der Ausgangsjahrgang werden daraus übernommen. Besteht kein passender Kurs, lässt sich unter „Weitere Angaben“ eine eigene Bezeichnung und ein Jahrgang ergänzen.
- Wiedervorlage-Presets: **Vor Ende Jahrgang 10**, **Vor Ende Jahrgang 13**, **Vor den nächsten Sommerferien**, **In einem Jahr**, **Datum selbst auswählen** und **noch nicht erinnern**.
- Die Berechnung nutzt das hinterlegte Schuljahr und den erkennbaren Jahrgang. Beispiel: im Schuljahr 2026/27 aus Jahrgang 5 → Wiedervorlage **01.06.2032** vor Abschluss von Jahrgang 10. Es handelt sich bewusst um einen vorgeschlagenen frühen Erinnerungstermin, **nicht** um einen behaupteten letzten Schultag. Jede Erinnerung lässt sich auf ein anderes Datum setzen.
- Ist die Jahrgangsangabe unklar oder liegt bereits hinter der gewünschten Stufe, wird statt eines erfundenen Datums eine klare Fehlermeldung gezeigt.
- Der bisherige freie Gruppen- und Anlasstext bleibt unter „Weitere Angaben“ erhalten. Die vorhandenen Felder `cohort`, `reminderDate`, `reminderLabel` und bestehende Archiv-IDs werden nicht verändert oder migriert. Nur neue optionale Metadatenfelder `classIdV3327`, `startingGradeV3327`, `reminderModeV3327` kommen hinzu.
- Digitale Materialien bei Erinnerungsstücken sind als **optional** eingeklappt. Für Kinderbriefe, Fotos und personenbezogene Erinnerungen wird ausdrücklich empfohlen, nur den **physischen Lagerort** zu notieren und nichts Digitales zu hinterlegen.

## Was unberührt bleibt
Material-Hub-Aufbau, Unterrichtsplanung, Druckpakete, Restkopienverrechnung, fachliche Katalogzuordnung und alle bestehenden Archiv-Einträge.

## Tests
- `tests/physisches-archiv-extras-v3327.test.cjs` für Datum, Klassenjahrgänge, Validierungsgrenzen und Rückwärtskompatibilität.
- Chrome-Smoke prüft eine echte Datei in IndexedDB, deren automatische Verknüpfung, Anlage einer Jahrgang-5-Erinnerung für Jahrgang 10 und das explizite Ergänzen eines zuvor fehlenden Katalog-Originals. Ein absichtlicher zweiter Anhang darf die Originaldatei nicht überschreiben.
- Die übrigen Schulcockpit-Workflows werden unverändert ausgeführt.
