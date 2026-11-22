# V0.33.24 – Gezielt Dateien für das physische Archiv finden

## Ausgangslage
V0.33.23 zeigte bei „Digitales Material verknüpfen“ eine einzige Dropdown-Liste der ersten **350** selbst angelegten Materialien. Der große **Materialkatalog** (beispielsweise 800 importierte Arbeitsblätter) war nicht enthalten. Wer ein vorhandenes Papierexemplar mit einer Datei verbinden wollte, musste die Quelle sonst zuerst im allgemeinen Material-Hub suchen.

## Umsetzung
- Der Papierarchiv-Editor erhält eine **Suche nach Namen, Dateinamen, Dateipfad und Stichworten** sowie die kombinierbaren Filter **Fach**, **Klasse / Jahrgang** und **Thema**.
- In der Suche liegen **alle** geladenen `state.materialCatalog`-Einträge und **alle** Materialfassungen unter `state.materials[].variants[]`. Die alte Grenze von 350 Einträgen entfällt vollständig.
- Fach und Jahrgang werden möglichst aus expliziten `hubV237`-Zuordnungen abgeleitet, ersatzweise aus tatsächlich verknüpften Kursen oder eindeutigen Ordnernamen. Themen stammen aus `hubV238`, Reihenverknüpfungen und (wenn nötig) aussagekräftigen Ordnernamen.
- Keine erfundenen Fächer/Jahrgänge/Themen: Ist die Zuordnung unklar, bleibt sie offen. Die Datei bleibt trotzdem über die Volltextsuche erreichbar.
- Bei einem Material, das tatsächlich in mehreren Kursen verwendet wird, sind die zugeordneten Jahrgänge durchsuchbar, solange keine explizite Material-Metadatenzuordnung etwas anderes festlegt.
- Nur die ersten **40 Treffer** werden angezeigt; „Weitere anzeigen“ lädt jeweils 40 nach. Dies schont die Oberfläche auch bei mehr als 800 Dateien.
- Jede Trefferzeile zeigt Titel, tatsächlichen Dateinamen, Materialtyp, gegebenenfalls Fach/Jahrgang/Thema und ihren bekannten Archivpfad. Die explizite Auswahl verknüpft ausschließlich die **exakte** Original-ID (`m:<materialId>:<variantId>` oder `c:<catalogId>`).
- Die getroffene Auswahl bleibt sichtbar und lässt sich bewusst lösen. Ein neuer Suchvorgang oder ein Filterwechsel verwirft nicht die ausgewählte Datei oder die anderen Formularfelder.
- Über „Papierbestand“ in einer bisherigen Material-Hub-Zeile bleibt die vorhandene Direktverknüpfung erhalten.

## Abgrenzung
Keine umfassende Neugestaltung des Material-Hubs, keine geänderten Materialkatalogdaten, keine Änderungen an PDF, Klassenlisten, Schülerdaten oder bestehenden Unterrichtsstunden. Bestehende physische Archiveinträge funktionieren weiterhin unverändert. Die bestehende sichere Bestands- und Kopierlogik aus V0.33.23 bleibt erhalten.

## Tests
`tests/physisches-archiv-suche-v3324.test.cjs` prüft die Vollständigkeit über 900 Katalogdateien, kombinierte Filter, mehrfache Fachkurszuordnungen, unbekannte Metadaten, 800 × 2 Materialfassungen, Datenunveränderlichkeit und die neue UI.

Im Chrome-Smoke wird die Archivsuche mit **801** Katalogeinträgen getestet: 800 Treffer für Mathematik 5/Brüche, begrenzte Anzeige und „Weitere anzeigen“; danach Suche unter Religion 7/Japanische Religionen, Auswahl einer konkreten letzten Datei und Speichern der Original-ID. Der Editor wird gegen horizontales Überlaufen geprüft.
