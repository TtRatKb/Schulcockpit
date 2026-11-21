# V0.33.18 – Genau eine A4-Seite je Kind bei Notenbögen (Jg. 8+)

## Problem
Nach V0.33.17 wird die Punkte-/Aufgabentabelle auf Seite 1 gedruckt. Der Generator reservierte für die Summen und den Notenschlüssel jedoch **immer** den unteren Teil einer möglicherweise neuen Seite: `if (y < 361) header(true,false)`. Dadurch entstand schon bei normalen acht Aufgaben eine leere zweite Seite mit Gesamtpunkten und Note, obwohl der erste Bogen Platz gehabt hätte.

## Änderung
Die Jahrgang-8+-PDF-Erzeugung plant **eine einzige Seite pro Kind** und erstellt genau einen PDF-Stream. Die vorhandene PDF-Seitenlogik für Jahrgang 5–7 ist unberührt.

- Kompakterer Titel-/Namensblock ohne leere Zwischenräume
- Aufgaben- und Bonuslückenbeschriftungen werden vor dem Zeichnen gemessen
- Tabellenzeilen schrumpfen nur so weit wie nötig; bei längeren Aufgabenlisten werden zwei nebeneinanderstehende **Aufgabentabellen auf derselben A4-Seite** verwendet
- Die benotungsrelevanten Blöcke stehen zuverlässig unter der Tabelle: reguläre Punkte, tatsächlich erreichte Bonuspunkte, echte Gesamtpunkte (auch über Maximum), gekappte Notenprozentzahl, einzeiliger Notenschlüssel, hervorgehobene Note und Unterschrift
- Gedruckt wird kein zweites Blatt und kein leeres Fortsetzungsblatt
- Falls selbst die dichteste lesbare Variante bei extrem vielen/sehr langen Aufgaben nicht passt, wird der Export mit einer **konkreten Fehlermeldung** blockiert, statt Text abzuschneiden oder heimlich eine zweite Seite zu erzeugen

Die private Schülerliste, Ergebnisse, Inklusionsaufgaben, Notengrenzen und bereits vergebene Noten bleiben vollständig erhalten. Der bereits eingeführte Bonus-/Viertelpunktmodus wird unverändert weiterverwendet.

## Regression
Der Chrome-Browsertest prüft echte PDF-Inhalte und die Zahl der Streams für einen normalen 8-Aufgabenbogen, eine Arbeit mit 28 längeren Aufgabenbezeichnungen, Bonuslücken sowie einen separaten Inklusionsbogen; zusätzlich werden lesbare Gesamtsummen und Notenschlüssel vorausgesetzt. Alle übrigen Smoke- und Jahresplanungstests laufen weiter.
