# V0.33.11 – Fehlende Ergebnisse im passenden Prüfungsreiter

Stand: 20. November 2026. Das Dashboard trennt jetzt die bisherigen V335-Ergebnisstatus-Anzeigen von den V338-Sonderfassungen. Maßgeblich bleiben die bestehenden privaten Daten und ausdrücklich zugewiesene Prüfungsdateien.

## Ursache der Anzeige „0 von 26 mit Punkten“

Eine Prüfungs-Teilnehmerliste enthält Personen, nicht zwangsläufig schon bestätigte Aufgabenpunkte. Die Anzeige V335 zählt ausschließlich tatsächlich in `scores`, `paperScores` oder `bonusScores` gespeicherte Ergebnisse (einschließlich 0 Punkten). Vor einem bestätigten Excel-Import ist daher auch bei vollständiger Teilnehmerliste „0 mit Punkten“ plausibel. Es ist keine automatische Fehlermeldung über verlorene Daten.

## Korrigierte Darstellung

- Im **regulären Reiter, Schritt 3** werden reguläre Ergebnisse, LE-Markierungen sowie ausdrücklich zugewiesene Inklusions-/Sonderfassungen in zwei ausklappbaren Abschnitten statt einer 26-zeiligen gemeinsamen Liste dargestellt. Der Zähler berücksichtigt nur Kinder ohne LE und ohne Sonderzuordnung.
- Vorhandene LE-Kennzeichnungen aus der lokalen Klassenliste werden als **„LE · Inklusionsfassung prüfen“** angezeigt. Sie sind ein fachlicher Vorschlag, keine stillschweigende Zuweisung.
- Bei einem noch ungeklärten Kind kann im **gleichen Auswahlfeld** eine tatsächlich vorhandene Inklusionsarbeit ausgewählt werden. Nach Bestätigung verwendet die Aktion die vorhandene sichere V318-Dateizuordnung. Punkte, Namen, Flags, manuelle Bewertungen und Originaldateien werden nicht geändert.
- Bereits einer Sonderfassung zugewiesene Kinder zeigen **„Inklusionsarbeit zugeordnet · Punkte noch offen“** statt „Noch ungeklärt“. Sie müssen keine zusätzliche V335-Teilnahmebegründung erhalten.
- Nach der Zuordnung erfolgt bei Bedarf die bestehende lokale Teilnehmer-Aktivierung **im Inklusionsreiter** unter Schritt 3; anschließend wird das eigene Excel importiert.
- Mehrdeutig zugeordnete Personen und bereits korrigierte Ergebnisse werden **nicht automatisch** einer anderen Prüfungsfassung zugeteilt. Der Hinweis verweist dann auf die sichere Prüfung in Schritt 1.

## Tests und Datenschutz

`tests/nachschreiber-abgleich-v335.test.cjs` prüft mit erfundenen Personen die LE-/Regulär-Trennung, echte Zuweisungen und unveränderte Punktdaten. `tests/browser-smoke.mjs` prüft zusätzlich die Auswahl des LE-Kinds, sichere Bestätigung, gespeicherte private Dateizuordnung und Aktivierung im Inklusionsreiter. Alle personenbezogenen Daten verbleiben im Browser; keine Migration.

**Hinweis:** Im speziellen Reiter sind neue Excel-Dateien und eigene Rastersätze weiterhin separat zu behandeln. Eine vorhandene vollständige Prüfungs-Teilnehmerliste ist kein Ersatz für den Import einer tatsächlich geschriebenen Classtime-Session.
