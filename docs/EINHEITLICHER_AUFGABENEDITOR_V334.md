# V0.33.4 – Einheitlicher Aufgaben- und Punkteeditor

Stand: 19. November 2026. Diese Änderung ersetzt keine Bewertungsdatenbank.

## Punktebedeutung

„Punkte insgesamt“ sind die ursprünglichen Punkte der Aufgabe, „davon Bonus“ ist ein Teil dieser ursprünglichen Punkte.

Beispiel: Frage 1 enthält neun Lücken, davon drei Bonuslücken (2, 6, 9). Eingabe: Gesamt 9, Bonus 3; sichtbare Wertung: 6 regulär und 3 Bonus. Speicherung: regularMax=9, bonusMax=0, partialBonusV267.max=3. Bereits importierte Original-Classtime-Punkte bleiben unverändert. Die tatsächlich erreichten Bonuslückenpunkte müssen je Kind belegt werden.

Als vollständig Bonus markierte Fragen 3b und 5 behalten ihre ursprünglich reguläre Classtime-Quelle und Roh-Maximalpunkte; bonusInsteadV260 steuert die tatsächliche Wertung.

## Vorhandene unvollständige Entwürfe

Die alte, ungültige Kombination „6 regulär plus 3 Bonus“ wird als editierbarer Vorschlag von 9 ursprünglichen und 3 Bonuspunkten dargestellt – niemals automatisch migriert. Erst die bewusste Bestätigung übernimmt den Plan. Alte V216-Entwürfe bleiben bis dahin verfügbar. Neue unbestätigte Änderungen verbleiben im öffentlichen, schülerdatenfreien itemDraftV334.

## Bedienung

Nur eine Tabelle zeigt alle Aufgaben und ihre Originalpunktzahl, Quelle, Wertungsart, Bonusanteil, die wirksamen Punkte, Lernbereiche und ggf. Kompetenzzuordnung. Widersprüchliche, ehemals zusätzliche V260-/V267-Masken werden im Auswertungsschritt 3 nicht mehr gezeigt. Die Gesamtsumme aktualisiert sich direkt; gespeichert wird nach Bestätigung.

Fehlende Aufgaben lassen sich in einem optionalen Abschnitt hinzufügen. Die vorhandenen Nachschreiber-Importe, private Bewertungen und PDF-Exporte bleiben bestehen.

## Sicherheitsregeln

Keine Schülerdaten in GitHub. Kein automatisches Umschreiben vorhandener Rohwerte. Bereits eingetragene Ergebnisse dürfen nicht unbemerkt das neue Maximum überschreiten. Eine Classtime-Excel mit abweichendem Originalmaximum erfordert eine fachlich begründete Neubewertung, nicht automatisch eine Skalierung. Es bleibt explizit offen, wie spätere Umrechnung bei Frage 6 (10 auf 6 Punkte) erfolgt.

## Tests

- tests/aufgabeneditor-v334.test.cjs: 9/3, alte Entwürfe, vollständige Bonusaufgaben, Quellen- und Rohwertschutz.
- tests/browser-smoke.mjs: nur ein Editor, Teilbonus und Lernbereich im Browser, individueller Teilbonus und Punkte-PDF.
- Bestehende Regressionstests für Nachschreiben, Kompetenzen und Bewertungsberechnung.
