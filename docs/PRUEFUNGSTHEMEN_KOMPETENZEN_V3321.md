# V0.33.21 – Nur tatsächliche Prüfungsthemen im ChatGPT-Kompetenzraster-Prompt

## Fehler
Der gültige Prompt-Pfad `schulcockpit-assessment-rubric-v209.js` las über `v204AllCourseCurriculum(course)` sämtliche Kompetenzen des ganzen Jahrgangs ein, obwohl bei der Klassenarbeit nur wenige Themen geprüft wurden. Die ältere Prüfkompetenzauswahl wurde in V214 bewusst aus einer Prompt-Kopie entfernt; sie begrenzte den neuen V209-Kompetenzraster-Prompt deshalb nicht.

## Korrektur
- **Schritt 1 – Grundlagen:** Vor jeder neuen Analyse werden die tatsächlich geprüften **Curriculumthemen des betreffenden Fachkurses** und die dazugehörigen **Prüfkompetenzen** ausgewählt. Thema anklicken wählt zunächst seine Kompetenzen; „Kompetenzen eingrenzen“ erlaubt gezieltes Abwählen. Eine reine Themenbezeichnung ist nicht gleichbedeutend mit „alle Kompetenzen geprüft“.
- Nichts wird aus `scope`, Dateinamen, vergangenen Reihen oder ganzen Jahrgangskatalogen ungeprüft als Prüfungsstoff übernommen. **Ohne bestätigte Auswahl gibt es keinen neuen ChatGPT-Prompt.** Schritt 2 verweist zurück auf Schritt 1.
- Es wird ausschließlich eine kleine neue `examCurriculumScopeV3321`-Metadatenstruktur (topicIds, competencyIds, confirmed) auf dem regulären Prüfungsdatensatz gespeichert.
- **Eigenständige Prüfungsfassungen:** Für separate Inklusions- und Alternativarbeiten wird die Auswahl ausschließlich privat unter `variantCurriculumScopesV3321[fileKey]` gespeichert. Reguläre und separate Arbeiten überschreiben sich gegenseitig nicht.
- Der tatsächlich genutzte V209-Prompt enthält **nur** die explizit gewählten Kompetenzen (mit Originaltext/ID); keine vollständigen Jahreslisten. Die V317-Prompt-Erzeugung einer Sonderfassung verwendet ebenfalls den abschließend gültigen Prompt.
- Der Import neuer Raster verweigert verknüpfte IDs außerhalb der aktuellen Auswahl, einschließlich bei Inklusionsrastern. Wo eine Zuordnung laut tatsächlicher Aufgaben unmöglich ist, bleibt im V209-Format der dokumentierte `curriculumCompetencyId:''` mit Begründung möglich.
- Bei **bereits vorhandenen** Klassenarbeiten bleiben Rubriken, Schülerpunkte, Bonuswertungen und Classtime-Excel unverändert; eine neue Auswahl wirkt ausschließlich auf zukünftige Analysen. Vorhandene Ergebnisse können weiterhin in Schritt 3–5 geöffnet werden.
- Für Jahrgang 8+ ohne Kompetenzraster bleibt der bestehende aufgabenorientierte Benotungsworkflow erhalten, ebenso für Fächer/Jahrgänge ohne hinterlegten Fachcurriculumskatalog.

## Tests
- `tests/pruefungskompetenzen-v3321.test.cjs`: Eindeutige Themen- und Kompetenz-IDs, unbestätigte Auswahl, fremde/jahrgangsfremde/stale IDs, Importvalidierung und keine Mutation alter Arbeiten.
- `tests/browser-smoke.mjs`: komplette Bedienung in einer fiktiven Religions-Klasse 7, abgesicherter Schritt 2, nur gewählte Kompetenz-IDs im Prompt und separate private Themenauswahl für eine Inklusionsfassung; vorhandenes Raster bleibt unverändert.
- Bestehende Smoke-, PDF- und Jahresplanungsregressionen laufen weiter; nur nach grünen Tests in `main`.
