# V0.33.17 – Erreichte Gesamtpunkte und kompakter Notenschlüssel

## Kontext

Religion Jahrgang 8, normale Classtime-Arbeit und eigenständige Inklusionsfassung. Die originale Excel, die Aufgabenmaxima und individuelle Bonuslücken bleiben unverändert. Kinder sollen ihre ursprünglichen Antworten/Kommentare in Classtime und die **letztgültigen korrigierten Punkte** auf dem Rückgabebogen erkennen können.

## Korrigierte Gesamtpunkte

Das vorhandene Bewertungsmodell V260 speichert getrennt:
- `totalReg`: regulär erreichte Punkte
- `totalBonusEarned`: **alle** erreichten Bonuspunkte
- `totalEarned`: **tatsächlich erhaltene Gesamtpunkte, auch wenn über dem Maximum**
- `totalAdjusted`: für die Prozentberechnung auf das reguläre Maximum begrenzte Punkte
- `totalPct`: höchstens 100 %

V3315 stellte im PDF zuletzt `totalAdjusted / totalMax` als „anrechenbar“ dar und versteckte damit tatsächlich erworbene Bonuspunkte, sobald die reguläre Punktzahl vollständig war.

V0.33.17 druckt:
- die Zeilen je Aufgabe mit `regulär erreicht / möglich` und `Bonus erreicht / möglich`, inklusive konkret markierter Bonuslücken
- darunter **reguläre Punkte**, **zusätzliche Bonuspunkte** und **Gesamt inkl. Bonus = totalEarned / totalMax** (beispielsweise **38 / 34 Punkte**)
- getrennt den **Prozentwert für die Note, bei 100 % gedeckelt**
- kleine Notenschlüsselzeile 1 bis 6 (bei Note 6 „unter“ der fünften Grenze)
- als letztes großes Gestaltungselement die hervorgehobene **Note**, oberhalb von Unterschrift/Kürzel

Unnötige Information und die überdimensionierte sechsteilige Notentabelle entfallen. Das Blatt wird mit bestehenden Farbmodi und PDF-Methoden erzeugt. Eine Classtime-Bemerkung erscheint nur für digitale Aufgaben.

## Vereinheitlichte Viertelpunkt-Grenzen

Die Prozentvorgaben bleiben in den bereits bestehenden `gradeScaleV260` bzw. `variantGradeScalesV3310[fileKey]` gespeichert. Es werden **keine bestehenden Notenschlüsselwerte migriert oder geändert**.

Die daraus abgeleiteten Punktgrenzen werden **nach unten auf 0,25 Punkte abgerundet**. Die pure Funktion `SC_GRADING_V260.cutoffPoints` ist dafür die einzige Rechenquelle: PDF `SchulcockpitGradeSheetV3315.gradeBoundaries` und automatische `SC_GRADING_V260.grade` verwenden exakt dieselben Grenzen.

Beispiel **34 reguläre Maximalpunkte** bei 91/81/66/50/25 %:
- Note 1 ab 30,75 Punkten
- Note 2 ab 27,50 Punkten
- Note 3 ab 22,25 Punkten
- Note 4 ab 17 Punkten
- Note 5 ab 8,50 Punkten
- Note 6 unter 8,50 Punkten

**Schulischer Hinweis:** Das vorliegende Schulcurriculum Evangelische Religion nennt die Prozentspannen 91/81/66/50/25 %. Das Abrunden der aus den Prozenten berechneten *Punktgrenzen* führt im Grenzfall dazu, dass die erreichte Prozentzahl knapp darunter liegt (z. B. 22,25 / 34 = 65,44 %). Es ist eine bewusste Rundungsregel und muss mit den geltenden Fachkonferenzabsprachen übereinstimmen. PDF und Cockpit benennen die Rundung ausdrücklich.

## Sicherheits- und Regressionsanforderungen

- Anrechenbare Punkte und Prozent bleiben maximal 100 %, **die tatsächlich erzielten Punkte nicht**
- Bereits korrigierte Bonuslücken, Noten und Prüfungsergebnisse werden nicht umgeschrieben
- Nicht korrigierte Aufgaben werden weiterhin als offen behandelt; keine automatische Note ohne vollständigen gültigen Schlüssel
- Manuelle Noten haben Vorrang
- Dieselbe Grenzrechnung für reguläre Fassung, Inklusionsfassung und individuelle Bonusänderungen
- Die bestehenden Jahrgang-5–7-Kompetenzrückgabebögen bleiben unberührt

Tests: `tests/bewertung-v260.test.cjs`, `tests/notenbogen-v3315.test.cjs`, synthetische PDF-Bytes in `tests/browser-smoke.mjs` (u. a. 38/34 Punkte bei 100 % und alle Notenschlüsselgrenzen). Vollständige GitHub-CI vor Merge erforderlich.
