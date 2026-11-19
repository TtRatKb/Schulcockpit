# Schulcockpit V0.33.8 – Fassungsreiter über den gesamten Auswertungsweg

Stand 19. November 2026. Die reguläre und die eigene Inklusions-/Nachschreibefassung gehören weiterhin zur selben Klassenarbeit, besitzen jedoch innerhalb der Oberfläche vollständig getrennte Arbeitsbereiche.

## Umsetzung

Oben werden die reguläre Arbeit und für jede vorhandene Datei mit Rolle inclusion, alternative oder inclusion_makeup ein eigener Reiter angezeigt. Die Auswahl ändert ausschließlich den sichtbaren Arbeitsbereich; keine bestehenden Punkte, Originaldateien oder Schülerzuordnungen werden umgeschrieben.

### Eigener Workflow je Fassung

1. Dateizuordnung: Die tatsächlich verwendete Fassungsdatei und deren Kinder zuweisen. Die Klassenliste ist gemeinsam und bleibt privat.
2. Aufgabenplan: Nur das geprüfte V317-Aufgaben-/Kompetenzraster dieser konkreten Datei anzeigen. Geprüfte Importblöcke können mit den vorhandenen V317-Funktionen hinterlegt werden.
3. Ergebnisse: Den bewährten V300-XLSX-Nachimport nur für diese Fassung anzeigen. Neue Excel-Dateien werden bei dieser aktiven Fassung vorbelegt. Bestehende allgemeine Inklusionsimporte werden nicht automatisch umgewidmet; Auswahl und erneute Prüfung sind ausdrücklich nötig.
4. Korrektur: Nur die zugewiesenen Kinder und ihr eigenes V317-Raster und deren Eingaben. Das reguläre Punkteraster wird in diesem Reiter nicht angezeigt. Nicht bestätigte Fassungen müssen zunächst explizit aktiviert werden.
5. Rückgabe: Der vorhandene persönliche Rückmeldungstext, die PDF-Ausgabe und die Ergebnisliste sind auf Berichte mit genau dem aktuell ausgewählten Datei-Key begrenzt. Ein Inklusions-PDF darf keine Namen aus der regulären Arbeit enthalten.

## Datensicherheit

- Gleiche Prüfung, gleiche stabilen privaten Schüler-IDs, originaler Dateischlüssel; keine Kopie und keine Datenbankmigration.
- Original-Classtime/Papierwerte, Bonuslücken, Nachschreibimporte und Prüfungsfassungs-Zuordnung werden nicht automatisch verändert.
- Eine andere Fassung darf nur bei bereits vorhandener fachlicher V317-Zuordnung und bestätigten Aufgaben genutzt werden. Die bewährte V300-Importvalidierung bleibt zuständig.
- Ältere generische Inklusions-Batches dürfen nicht unbemerkt zu einer spezifischen Datei importiert werden; zuerst die Version im Batch wählen.
- Beim Reiterwechsel werden ungespeicherte Sonderfassungspunkte ausdrücklich abgefragt und ungespeicherte persönliche Rückmeldungen vor dem Wechsel gesichert.
- Schülernamen und individuelle Ergebnisse bleiben lokal in IndexedDB. Vor produktiver Benutzung ein vollständiges, verschlüsseltes privates Backup erstellen.

## Tests

- tests/pruefungsreiter-v338.test.cjs prüft synthetische Fassungs-, Batch-, Klassenlisten- und PDF-Report-Trennung ohne Datenmutation.
- tests/browser-smoke.mjs prüft alle fünf Schritte mit eigener Datei, 2 anonymen fiktiven Personen, eigenen Rastern, eigenem Punktespeicher, PDF ohne fremde Namen und Schutz ungespeicherter Punkte.
- Vorhandene Nachschreib-, V317/V318-, V300-, Bewertungs-, PDF-, Backup- und Jahresplan-Regressionen bleiben verpflichtend.