# Eigener Unterricht und Ist-Nachtrag V0.33.32

- „Etwas Eigenes unterrichten“ ergänzt eine stabile eigene Soll-Einheit in der bestehenden Reihe (oder in einer lokalen Auffangreihe, falls noch keine Reihe existiert) und ordnet dieselbe bestehende Stundenkarte zu. Es entsteht keine zweite aktive Karte am Fachtermin.
- „Bereits anders unterrichtet“ bewahrt die ersetzte `planReference` im Ist-Eintrag, setzt die eigene Einheit als kanonische aktive Zuordnung und markiert die Karte als gehalten.
- Hochgeladene Originale werden über stabile FileKeys in der bestehenden IndexedDB gespeichert, als Materialhub-Material angelegt und an Kurs, Reihe, Einheit und Stundenkarte verknüpft. Fehler führen zum Rollback von Zustand und bereits geschriebenen Dateien.
- Bestehende Ist-Einträge werden nur im sichtbaren Korrekturmodus nach Bestätigung geändert. Die vorherige Fassung bleibt in `correctionHistoryV3332` erhalten.
- Es werden keine Schülerdaten, Bewertungen oder Dateien extern übertragen. Die ChatGPT-Jahresplanung wird nicht neu importiert.
