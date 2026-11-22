# V0.33.26 – Dateivorschau im physischen Archiv

## Hintergrund
Die digitale Materialsuche (V0.33.24) findet auch die noch unvollständig katalogisierten Dateien. Dabei sind Dateinamen wie `AB_123.pdf` allein nicht aussagekräftig genug, um den richtigen Papierbestand zu verknüpfen.

## Ergänzung
- In den Trefferzeilen und neben der aktuell ausgewählten Materialverknüpfung gibt es die Schaltfläche **Vorschau**.
- Die Vorschau läuft in einem separaten Dialog, der beim Schließen zur gleichen Materialsuche zurückführt.
- **PDFs:** Eingebettete Darstellung im Browser, soweit vom Browser unterstützt.
- **Bilder:** PNG, JPEG, GIF, WEBP und BMP werden direkt angezeigt.
- **Text:** TXT, Markdown, CSV und JSON werden als Text angezeigt.
- **DOCX:** Text aus der lokal gespeicherten Word-Datei wird ausgelesen. Die Vorschau zeigt nicht zuverlässig Layout, Bilder, Tabellenformatierung oder Schriftarten.
- **PPTX:** Text aus bis zu 15 Folien wird in Folienreihenfolge ausgelesen. Grafik, Design und Animationen sind nicht originalgetreu.
- Für andere Formate ist eine ehrliche Formatmeldung mit Downloadmöglichkeit vorhanden.
- Wenn ein Katalogeintrag nur Metadaten enthält und die Originaldatei im Browser fehlt, wird kein Inhalt erfunden. Hinweis auf Material-Hub und erneutes Verbinden des Original-ZIPs bzw. der Einzeldatei.
- Optional kann für einen **einmaligen lokalen Vergleich** eine Datei über den System-Dateidialog geöffnet werden. Sie wird ausdrücklich weder gespeichert noch automatisch dem Katalogeintrag zugeordnet.
- Die eindeutige Zuordnung erfolgt weiterhin nur über **Katalogeintrag verknüpfen**. Vorschau, Download und Schließen haben keine Wirkung auf vorhandene Archivbestände oder Unterrichtsdaten.

## Datenhaltung und Sicherheit
Es werden ausschließlich lokale IndexedDB-Dateien bzw. bereits verbundene Original-ZIPs gelesen (über `catalogEntryFileV17` und `fileStoreGet`). Keine Netzwerkübertragung, keine neuen Uploadspeicher, keine Änderungen am Katalog oder bei Materialvarianten. Bei PDF/Bildern werden temporäre Browser-Objekt-URLs nach dem Schließen freigegeben. Text-/Office-Vorschauen haben Obergrenzen für Größe und Textmenge. Die XML-Ausgabe wird als reiner Text eingefügt, nicht als HTML ausgeführt.

Die bestehenden Such- und Filterzustände bleiben beim Betrachten erhalten. Bei fehlenden Originaldateien wird niemals vorgetäuscht, dass eine Vorschau vorliegt.

## Tests
- `tests/physisches-archiv-vorschau-v3326.test.cjs`: Dateitypen, Office-Reihenfolge, Textkürzung, weiterhin manuelle Zuordnung.
- Der Chrome-Smoke prüft PDF und Word als echte IndexedDB-Dateien, das separate Auswählen/Verknüpfen sowie die Meldung bei nicht lokal gespeicherten Katalogdateien.
- Bestehende Browser- und Jahresplanungs-Regressionen müssen erfolgreich bleiben.
