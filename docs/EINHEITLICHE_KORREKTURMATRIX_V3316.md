# V0.33.16 – Einheitliche Korrekturmatrix für alle Prüfungsfassungen

Ausgangslage: Die reguläre Arbeit hatte bereits die kompakte V221/V281-Korrekturmatrix inklusive individueller Bonuskennzeichnungen. V338 zeigte in der Inklusionsfassung stattdessen die älteren V317-Einzelkarten (ein Kind anklicken, Punkte korrigieren, zurück zur Übersicht). Die in V3313 privat gespeicherten Bonusregeln waren in den Einzelkarten nicht als solche erkennbar.

## Änderung

- **Dieselbe UI-Komponente `v221CompactTable`** rendert nun auch die Inklusions- bzw. alternative Prüfungsfassung. Die Datei wird dafür nur im Speicher als eigenes Raster und eigene Teilnehmergruppe an die Tabellenfunktion übergeben. Die bestehende reguläre Korrektur bleibt unangetastet.
- **Eigene Datenbasis:** Tabellenzeilen kommen ausschließlich aus der geprüften Klassen-/Prüfungsdateizuordnung `V338.assignedStudents` und `V317.select`, Spalten ausschließlich aus `priv.variantAnalysesV317[fileKey].items`. Kein Abgleich allein über Vornamen, keine Vermischung von regulärer und abweichender Arbeit.
- **Bonus sichtbar:** Im Spaltenkopf `★ Bonus: X P.` für vollständig zu Bonus erklärte Aufgaben, `davon X Bonus (reg. Y)` für nachträgliche Bonuslücken. In der Zelle `★ Bonus` für klassenweite Bonuswertung, `☆ Bonus` als individuelle Entscheidung wie in der regulären V281-Matrix; Bonuslücken als unmittelbare `Davon Bonus`-Auswahl neben den Gesamtpunkten.
- **Noten direkt sichtbar:** Jede Schülerzeile zeigt die aktuelle reguläre Punktsumme, Bonuspunkte, angerechnete Punkte und (bei vollständiger Korrektur) Prozent und Note. Bei offenen Bonusaufteilungen steht ausdrücklich „Wertung offen“ statt einer fertigen Note. Der Notenschlüssel bleibt pro Datei getrennt.
- **Kein doppelter Editor:** Die alten V317-Einzelkarten werden im Fassungsreiter ersetzt. Der sichere V317-Dialog zur erstmaligen Aktivierung einer noch ungeklärten Fassung bleibt bestehen.
- **Sicherer Schreibzugriff:** Inputs der Sondermatrix tragen eigene Attribute, damit V210/V221 und V317 nicht versehentlich die reguläre Bewertungsmatrix überschreiben. Jede Zeile wird über die bestehende geprüfte `V3313Core.applyMarks`-Routine atomar im privaten Speicher gesichert. Vor dem Speichern wird die aktive `fileKey` für dieses Kind erneut mit `V317.select`, `examFileV317` und `activeVariantV300` validiert. Classtime-Werte werden erst nach bewusstem Entsperren geändert. Wechsel der Fassung führt noch offene Änderungen vorher zu Ende oder stoppt bei Fehlern.
- **Datenschutz:** Ausschließlich private IndexedDB-Daten, keine Migration, keine Schülernamen/Noten in Repository oder KI-Kontext. Vorhandene Bonuskorrekturen und frühere Versuche bleiben erhalten.

## Regression

- `tests/variantenmatrix-v3316.test.cjs`: zwei Kinder mit gleichem fiktiven Vornamen, reguläre vs. Bonusaufgaben und nachträgliche Bonuslücken, eigene Punkte-/Notenberechnung und stabile IDs
- Browser-Smoke: beide Inklusionskinder gleichzeitig in derselben Matrix, gespeicherte Bonusregeln in den Spalten, Änderungen bei einem Kind, Anrechenbarkeit einer individuellen Bonuswertung, richtige Noten, Schutz der anderen Kinder und der regulären Versuchshistorie
- Bestehende V338-/V3313-/V335-Workflows laufen weiterhin.

Bei späteren zusätzlichen Prüfungsfassungen gilt dieselbe Tabellenlogik (eigene Aufgaben/Raster/Punkte).
