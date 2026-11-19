# V0.33.6 – Classtime-Zuordnung, Bonusscore, geänderte Maximalpunkte

Stand: 19.11.2026. Implementierung ausschließlich aus unveränderten, versionierten Schulcockpit-Modulen; lokale sensible Bewertungsdaten bleiben in IndexedDB.

## Korrigierte Fälle

- **Eindeutige Q-Zuordnung ohne Nummerngleichheit:** Die eigene Prüfungsfrage „Frage 3b“ wird über die Bezeichnung in der anonymen Beschreibung von Excel Q4 erkannt, „Bonusfrage 4b“ über Q6. Es wird ausschließlich bei einem eindeutigen Treffer automatisch **vorbelegt**, erst die spätere Bestätigung übernimmt die Werte.
- **Bonusfrage mit echten Punkten (Q6 max. 3):** `classtime_bonus` mit positivem Excel-Maximum wird in der gemeinsamen Zuordnung angezeigt und bei freigegebenem Import in das bestehende private `bonusScores`-Feld übernommen, mit separater Herkunftsmarkierung. Bereits eingetragene manuelle Bonuswerte bleiben unangetastet. Bonusfragen mit **0/0** bleiben aus Sicherheitsgründen im bisherigen gesonderten Antwortblatt-Verfahren.
- **Nachträglich vollständig als Bonus eingestufte Aufgaben:** Ursprüngliche Classtime-Fragen behalten ihre Original-Maximalpunkte und korrekte Spaltenzuordnung. In der Zuordnung erscheint die effektive Bonuswertung.
- **Teilbonus in Frage 1:** Neun ursprüngliche Classtime-Punkte werden nicht auf sechs verkürzt; die drei Bonuslücken werden im bestehenden individuellen Bewertungsbereich gesondert erfasst. Die Zuordnung zeigt „9 Originalpunkte · davon 3 Bonus“.
- **Q8 / Frage 6 von 10 auf 6:** Keine stille Umrechnung. Lehrkraft entscheidet explizit zwischen (1) manuell neu bewerten, Excel-Punkte dieser Frage nicht übernehmen, oder (2) proportional 10→6, auf Viertelpunkte gerundet. Das Excel-Original bleibt erhalten; einzelne manuell korrigierte Werte und zuvor geschützte Punkte werden nicht überschrieben.
- **Warnung „noch nicht zugeordnet“ trotz ausgewählter Dropdowns:** Die gemeinsame Tabelle macht klar: vorausgewählte Fragen sind nur Vorschläge bis zur Bestätigung. Widersprüchliche doppelte/fehlende Zuordnungen verhindern die Übernahme.

## Datensicherheit

V210/211/212-Rohdatenprüfung, V218-Klappworkflow, V300-Nachimporte sowie V267-Kompetenzberechnung bleiben erhalten. Das Excel wird nicht verändert und es gibt keinen Upload an einen Server oder an ChatGPT. Jede unerklärte Übereinstimmung oder ungültige Rohzahl bleibt prüfpflichtig.

## Tests

`tests/classtime-abgleich-v336.test.cjs`: alle acht Fragen inklusive Q6 und Q8, Doppeltzuordnung, Bonusrohwerte und Unterscheidung zwischen Originalscore und wirksamer Maximalpunktzahl.

`tests/browser-smoke.mjs`: vollständige künstliche S-SESSION-Struktur, tatsächlicher Import mit Bonus-Q6 und manueller Q8-Neubewertung, anschließend erneuter Import mit ausdrücklich gewählter proportionaler Umrechnung; Nachweis, dass die ursprüngliche Excel-Struktur erhalten bleibt.

Vor Einsatz bei realen Auswertungsdaten einen vollständigen privaten Schulcockpit-Backup-Export erstellen.
