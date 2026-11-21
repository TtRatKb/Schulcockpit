# V0.33.19 – Rückgabebogen: fachliche Reihenfolge und nutzbares Unterschriftsfeld

Im von der Lehrkraft geprüften PDF lag die Aufgabenübersicht relativ weit über einem starr am unteren Seitenrand gezeichneten Gesamtpunkteblock. Für die Fachlehrkraft blieb unter der großen Note nur ein sehr kleines Unterschriftsfeld. Der Notenschlüssel nahm unmittelbar vor der Note den optisch wichtigsten Platz ein.

**Änderung ausschließlich im PDF-Generator für Jahrgang 8+:**

1. Tabelle mit regulären und möglichen Bonuspunkten bleibt unverändert und vollständig; auch Bonuslücken und einseitiges A4-Layout bleiben erhalten.
2. Nach der tatsächlich letzten Tabellenzeile folgt mit kleinem Abstand die Gesamtpunktzahl (regulär, Bonus, Gesamtsumme inklusive etwaiger über dem Maximum liegender Bonuspunkte, für die Note auf 100 % begrenzter Prozentwert).
3. Die große Note steht direkt darunter.
4. Darunter bleibt ein deutlich höherer Bereich für handschriftliches Kürzel/Unterschrift; die Unterschriftslinie hat immer mindestens 60 Punkt (ca. 2,1 cm) freien Abstand vom Notenfeld, bei kurzen Arbeiten wesentlich mehr.
5. Der kleine Notenschlüssel 1–6 steht **nach dem Unterschriftsfeld** als reine Fußinformation am unteren Seitenrand. Er bleibt exakt an denselben Punkt-/Prozentgrenzen orientiert wie bisher.
6. Bestehende optionale Unterschriftsgrafik und Elternunterschrift werden mit demselben dynamischen Unterschriftsbereich versetzt.

Die Druckseite bleibt maximal eine A4-Seite pro Kind; kein zusätzliches Blatt. Optionale Lernbereiche werden nur im vorhandenen Freiraum zwischen Tabelle und Gesamtwertung ausgegeben und können deren Position nicht mehr überlagern. Kompetenzbogen Jahrgang 5–7 bleibt unverändert. Keine Migration oder Änderung von Noten, Bewertungen, Bonusregeln oder privaten Schülerdaten.

**Tests:** Chrome erzeugt PDF-Bytes für kurze/lange/Inklusionsarbeiten sowie für digitale und zusätzliche Elternunterschrift. Er prüft die vertikale Reihenfolge Tabelle → Gesamtwertung → Note → Unterschrift → Notenschlüssel, ausreichenden Freiraum und genau eine PDF-Seite.
