# V0.33.5 – Fehlende Ergebnisse und Nachschreibende

Stand: 19. November 2026. Der veröffentlichte Repository-Stand bleibt die technische Quelle.

## Umgesetzt

Nach einer vorhandenen Aufgabenanalyse zeigt Schulcockpit in Auswertungsschritt 3 **Wer hat schon ein Ergebnis?**. Die Anzahl basiert auf der bestehenden privaten Kursklassenliste (V235) und tatsächlich bewerteten Aufgabenpunkten – ausdrücklich nicht auf der Zahl der Classtime-Excel-Zeilen.

Bei jedem aktiven Kind ohne Punkte ist eine private, lokal gespeicherte Entscheidung möglich: **Noch ungeklärt**, **Schreibt nach**, **Papierpunkte fehlen** oder **Nimmt nicht teil**. Ein Ergebnis mit null Punkten gilt als vorhanden. Mehrfache oder nicht eindeutige Schülerzuordnungen werden nicht als Treffer erfunden; ein Hinweis führt zur Klassenliste in Schritt 1.

Der neue Bearbeitungsstatus wird im privaten Bewertungsdatensatz unter `pendingReasonsV335` keyed by der stabilen Klassenpersonen-ID gespeichert. Keine Namen, Aufgabenpunkte oder Förderinformationen werden in öffentliches `state`, GitHub oder ChatGPT-Prompts kopiert.

Wenn eine erste Ergebnisübernahme existiert, können **ausdrücklich** als Nachschreibende oder noch ausstehende Papierkorrektur klassifizierte Personen, die bisher im Prüfungsroster fehlen, per Bestätigungsdialog in die private Prüfungs-Teilnehmerliste aufgenommen werden. Es wird nur eine verknüpfte, zunächst unbewertete Person mit stabiler Klassenpersonen-ID hinzugefügt. Bereits vorhandene Prüfungsroster, Punkte und Bewertungsregeln bleiben unverändert.

Der Button **Weitere Classtime-Excel ergänzen** öffnet den bereits bestehenden, geschützten V300-Nachimport; es gibt keinen neuen ungeprüften Upload. Bei einer zusätzlichen Excel schlägt die automatische Namenszuordnung standardmäßig nur Personen **ohne bisher gespeicherte Ergebnisse** vor. Eine bewusst manuell zugeordnete Person mit Ergebnissen kann nach dem bestehenden Sicherheits-/Ersetzungsdialog weiterhin behandelt werden. Die eigentliche V300-Importlogik, Punkte- und Variantenprüfung sowie lokale Historie bleiben erhalten.

Nach dem erfolgreichen V300-Import wird die Person automatisch als mit Punkten erfasst angezeigt, ohne ihre zuvor lokale Begründung aus historischen Datensätzen herauszulöschen.

## Noch nicht umgesetzt

- Durchgehender eigener Inklusions-Reiter für alle Auswertungsschritte und vollständig eigener Vorbereitungsschritt vor der Arbeit.
- Automatische und fachlich geprüfte Übernahme eines echten Classtime-Prüfungsformats vor dem Schreiben.
- Fachlich bestätigte Neubewertungsregel einer bereits mit anderem Maximalwert exportierten Classtime-Frage.
- Automatische Freigabe von Rückgabebögen für komplette Klassen und historischer Druckstand.

## Tests und Datenschutz

- `tests/nachschreiber-abgleich-v335.test.cjs`: eindeutige Personenverknüpfung, 0-Punkte-Fälle, fehlende Personen, ausschließlich neue Excel-Zuordnung, späteres Importieren und Schutz vorhandener Schülerpunkte.
- `tests/browser-smoke.mjs`: synthetische Klassenliste, gespeicherter Nachschreibstatus, Ergänzung der Prüfungs-Teilnehmerliste, Nachimport und unveränderte ursprüngliche Punkte.
- Alle Datensätze für Tests sind rein erfunden. Vor produktiver Nutzung lokale Sicherung anlegen.

## Datenintegrität

- Fehlende Excel-Zeile ist **kein Beweis** für Abwesenheit.
- Unbestätigte Namen werden niemals per Zeilennummer oder unscharf zugeordnet.
- Bereits korrigierte Personen werden beim neuen Excel-Import nicht automatisch ausgewählt.
- Nachimporte ändern keine anderen Kinder. Ein explizites Ersetzen verwendet weiterhin die vorhandene V300-Versuchshistorie.
