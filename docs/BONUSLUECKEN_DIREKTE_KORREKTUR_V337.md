# V0.33.7 – Bonuslücken direkt im Punkteraster

Stand: 19. November 2026. Vor produktivem Einsatz ein vollständiges verschlüsseltes Schulcockpit-Backup inklusive der privaten Daten erstellen.

## Umsetzung

Im bestehenden Schritt 4 „Punkte eingeben“ wird unter der originalen Classtime-Punktzahl direkt das Eingabefeld **Davon Bonus** für die teilweise als Bonus markierten Aufgaben dargestellt. Es gibt kein zweites Bonuslückenformular. Das Feld existiert pro Kind und verwendet das bisherige private IndexedDB-Feld gradingOverridesV267[studentId][itemId].bonusEarned.

### Fachliche Regel

Die Classtime-Punkte sind die **ursprüngliche Gesamtpunktzahl**. Die tatsächlich erreichten Bonuspunkte sind ein Teil davon, nicht zusätzliche Punkte. Die regulären Punkte ergeben sich aus Gesamtpunkten minus Bonuspunkten. Beispiel: 9 Gesamtpunkte, davon maximal 3 Bonuslücken (2, 6, 9). Ein Kind mit 7 von 9 und zwei richtig gelösten Bonuslücken hat 5 reguläre und 2 Bonuspunkte.

Zulässig sind nur Bonuspunkte von max(0, Gesamtpunkte - (Original-Maximum - Bonus-Maximum)) bis min(Gesamtpunkte, Bonus-Maximum). Bei 9/9 müssen alle drei Bonuslücken richtig sein; bei 7/9 kann die Anzahl nur 1, 2 oder 3 sein. Benannte einpunktige Lücken werden in ganzen Punkten angeboten, sonst sind Viertelpunkte möglich.

Ein noch ungeprüfter Bonusanteil ist offen, nicht 0. Nach einer Änderung der ursprünglichen Gesamtpunktzahl werden die bislang erfassten Teilpunkte geprüft, nicht still korrigiert. Individuell komplett als Bonus gewertete oder ausgenommene Aufgaben erhalten keinen Teilbonus-Editor.

### Bedienung

- Direkt unter dem Originalwert eines Kindes: Dropdown „Davon Bonus“ und sofortiger Hinweis „X regulär + Y Bonus“.
- Speicherung beim Ändern; bestehender Autoload für die Rohpunkte und private Herkunftsmarkierung bleiben erhalten.
- Fortschritt „X von Y Bonusaufteilungen geprüft“ über der Korrekturmatrix.
- Der frühere separate Teilbonus-Editor wird aus der erweiterten Einzelbewertung entfernt. Individuelles Ausnehmen/komplett Bonus bleibt verfügbar.
- Die vorhandene Punkte-, Lernbereichs- und PDF-Berechnung bleibt bestehen.

## Tests

- tests/bonusluecken-v337.test.cjs: neun Gesamtpunkte/drei Lücken, mathematische Grenzen, Viertelpunkte, 0 Punkte, Nachschreiben, Berechnung, Rohdatenerhaltung.
- tests/browser-smoke.mjs: Klasse 8 mit der bisherigen Ausnahmeregel und dem direkten Dropdown; zusätzliche Zwei-Kinder-Runde mit 7/9 + zwei Bonus bzw. 9/9 + drei Bonus, privater Speicherung und V267-Bericht.
- Bestehende Bewertungs-, Classtime-, Nachschreib-, Backup- und PDF-Prüfungen.

Es werden keine echten Namen, Antworten oder Schülerpunkte im Repository gespeichert.