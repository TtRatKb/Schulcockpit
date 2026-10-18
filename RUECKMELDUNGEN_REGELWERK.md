# Verbindliches Regelwerk – persönliche Mathe-Rückmeldungen (ab V0.23.0)

**Gilt für:** Korrekturarbeitsplatz, Schritt 5 „Prüfen & Drucken“, Mathematik insbesondere Jg. 5–7; perspektivisch alle Kompetenzraster mit demselben Datenmodell.

**Leitprinzip:** **Die Tabelle ist vollständig. Der Text wählt aus.** Die Rückmeldung ist kein sprachlich vervielfältigtes Kompetenzraster, sondern eine wertschätzende Interpretation mit optionalem herausragendem Erfolg und einem eigenen nächsten Übungsauftrag.

## 1. Fachliche Datengrundlage

- Gewertet werden **nur regulär bewertbare** Kompetenzen (regularMax > 0) mit vollständigem, gültigem Status. Die Status `erreicht`, `teilweise erreicht` und `noch nicht erreicht` stammen ausschließlich aus der vorhandenen Berechnung; die Textlogik verändert sie nicht.
- Der Bericht berechnet Kompetenzprozente aus **anrechenbaren Punkten nach Bonusausgleich** (maximal 100 % je Kompetenz). **100 % im Kompetenzfeld bedeutet daher nicht zwangsläufig 100 % regulär erarbeitete Punkte.**
- Die volle **reguläre Gesamtpunktzahl** wird nur gelobt, wenn `totalReg == totalMax > 0`. Die volle Punktzahl einer **einzelnen** Kompetenz wird nur gelobt, wenn `regularEarned == regularMax > 0`. Keine Ableitung solcher Aussagen allein aus dem gerundeten Prozentwert.
- Bonusaufgaben werden getrennt aus `auditV210` mit `source` auf `_bonus`, `earned` und `max` ermittelt. Ein vollständig absolvierter Bonus erfordert `earned == max > 0`. **Alle Bonuspunkte** dürfen nur gelobt werden, wenn **sämtliche** Bonusaufgaben valide und vollständig bewertet sind. Offene Bonuswerte führen zu keiner Vollbonus-Behauptung.
- Ergebnisse aus privaten Browserdaten bleiben privat. Der Generator ist rein lesend und benötigt keine Migration.

## 2. Entscheidungsregeln vor der Wortwahl

| Anzahl der erreichten Kompetenzen (E) | Entscheidungsregel für „Was schon gut gelingt“ |
| --- | --- |
| Keine | Ehrlicher Zuspruch; bereits tatsächlich erzielte Teilpunkte würdigen, sofern vorhanden. Niemals einen Erfolg erfinden. |
| 1–2 bei ansonsten weiteren Kompetenzen | **Eine** erreichte Kompetenz wird einzeln gewürdigt. **Zwei** erreichte Kompetenzen werden in der Regel zu **einem gemeinsamen, grammatisch passenden Lobsatz** verbunden; kein zweimal identisches „Das Lernziel ist erreicht. Klasse!“. Nur bei beiden tatsächlich vollständig erreichten *regulären* Kompetenzwerten darf die gemeinsame volle Punktzahl genannt werden. Keine unbegründeten „Auch“-Anfänge. |
| Ab 3, nicht alle, unter 80 % aller Kompetenzen | „In mehreren Kompetenzbereichen …“ – normalerweise **keine Aufzählung**. Höchstens eine besondere Kompetenz hervorheben, falls fachlich nachweisbar und nicht schon ein stärkeres Bonus-/Gesamtlob folgt. |
| Ab 3 und mindestens 80 %, aber nicht alle | „In den meisten Kompetenzbereichen …“ – wie oben. |
| Alle Kompetenzen (bei mindestens zwei) | „In allen Kompetenzbereichen …“ – **keine Kompetenzliste**. Anschließend ggf. volle reguläre Punktzahl und/oder besondere Bonusleistung erwähnen. |

Bei nur ein oder zwei insgesamt bewertbaren Kompetenzen darf das vollständige Erreichen auch als Gesamterfolg benannt werden. Die Regel ist auf beliebige Kompetenzanzahlen ausgelegt; die Klassifikationen richten sich nach tatsächlichen Status, nicht nach einer erwarteten Standardzahl von fünf.

## 3. Wertigkeit bei herausragenden Leistungen

1. **Alle regulären Punkte UND sämtliche möglichen Bonuspunkte:** besonderer Gesamterfolg, ohne doppelte Einzelaufzählung.
2. **Alle regulären Punkte, aber nicht alle Bonuspunkte:** reguläre Punktzahl getrennt anerkennen; dazu bei Bedarf außergewöhnliche Bonusleistung.
3. **Alle Bonuspunkte, regulär nicht vollständig:** voller Bonus loben, nicht fälschlich alle regulären Punkte behaupten.
4. **Eine oder mehrere vollständig bewertete Bonusaufgaben:** „Bei [Anzahl] Bonusaufgaben alle Zusatzpunkte …“; nur anhand individueller Aufgabenwerte.
5. **Keine volle Bonusaufgabe, aber mindestens 80 % der verfügbaren Bonuspunkte:** hoher Bonusanteil darf allgemein gelobt werden, falls der gesamte Bonusdatenstand vollständig ist.
6. **Keine nachgewiesene besondere Bonusleistung:** kein erfundenes Bonuslob.

Die Boni werden nicht zusätzlich in die Prozentberechnung für sprachliche Superlative „hineingerechnet“. Eine hohe Bonuspunktzahl darf nicht dazu führen, dass die reguläre Gesamtleistung falsch beschrieben wird.

## 4. Ein nächster Lernschritt = ein eigener Auftrag

- Vorrang haben `noch nicht erreicht`-Kompetenzen, aufsteigend nach Kompetenzprozent; danach `teilweise erreicht`. **Maximal zwei** Schwerpunkte, denn die Tabelle enthält den Rest.
- **0 %:** Grundlagen selbst nachsehen bzw. wiederholen und dazu Übungsaufgaben bearbeiten.
- **1–25 % (z. B. 1/9 Punkten):** geringer Lernstand wird ehrlich benannt; die zugehörigen Aufgaben sollen erneut angesehen und passende Beispiele **selbst** gelöst werden.
- **26–49 %:** bereits Teilpunkte vorhanden, gezielte weitere Beispiele selbst lösen.
- **50–69 %:** vorhandene Kenntnisse festigen, weitere passende Aufgaben lösen.
- **Alle erreicht:** weiter selbstständig üben bzw. kniffligere Aufgaben ausprobieren.
- Kein automatisch versprochener Unterrichtseingriff („Wir wiederholen das zusammen“, „Darauf bauen wir auf“). Keine unbelegten Fehlerdiagnosen (z. B. „Überträge vergessen“), kein erfundener Fleiß.

## 5. Sprachqualität und Datenschutz

- Freundlich, direkt und für Fünft- bis Siebtklässler verständlich; positives Lob darf „Klasse!“, „Super!“ oder „Richtig stark!“ enthalten. Maximal zwei Ausrufezeichen in der gesamten generierten Rückmeldung.
- Nicht jeder Satz braucht eine Kompetenznennung. Kurze, zusammenhängende Sätze statt mechanischer Aufzählung. „Auch“/„Außerdem“ nur, wenn tatsächlich ein vorheriger Bezug besteht.
- Sätze werden nur aus grammatisch passenden, geprüften Kompetenzformen gebildet. Der lexikalische Katalog liegt in `V230_TERMS` im separaten Modul `schulcockpit-feedback-policy-v230.js`. Der aktuelle Katalog enthält insbesondere Begriffe aus der vorliegenden Klasse-5-Arbeit sowie erste Bruchrechen-Formen. Bei **unbekannten** Kompetenztexten wird die bereinigte Originalbezeichnung zur Sicherheit in Anführungszeichen eingesetzt.
- **Erweiterungsablauf für Jg. 5–7:** echten Kompetenzwortlaut prüfen → passendes sprachliches Muster eintragen → Beispielsätze für volle, erreichte, schwache und teilweise erreichte Kompetenz durchspielen → Regressionstests ergänzen. Dies ist ein **fortlaufender Ausbau**, keine Behauptung, der heutige Katalog decke bereits alle Jahrgangsstufen vollständig ab.
- Vorschläge sind je Datensatz stabil, aber variieren im Ausdruck. Maximal 900 Zeichen pro Feld; längere Texte werden nicht mitten im Satz still abgeschnitten.
- **Keine Veränderung** an selbst geschriebenen oder bewusst übernommenen Rückmeldungen unter `feedbackV210`. Die Lehrkraft kann den neuen Vorschlag ausdrücklich über „Automatischen Vorschlag einsetzen“ wählen. Keine automatische Überschreibung vorhandener Texte, keine Übertragung personenbezogener Schülerdaten.

## 6. Regressionen, die bei jeder künftigen Erweiterung gelten

- 5/5 E + 51/51 regulären Punkten + 17,5/20 Bonuspunkten bei drei vollständig erreichten Bonusaufgaben: **keine Liste** der fünf Kompetenzen, korrektes Gesamt-, reguläres und Bonuslob.
- 5/5 E **nur dank Bonusausgleich**: keine Aussage „alle regulären Punkte“.
- Alle regulären Punkte und **alle** Bonuspunkte: besonders würdigen, ohne Aussagen doppelt zu wiederholen.
- 4/5 E: „in den meisten“; 3/5 E: „in mehreren“; 1–2/5 E: spezifisch benennen.
- 1/9 Punkten im Runden: geringe Leistung klar benennen, Kind zum **eigenen** Nacharbeiten auffordern.
- 0 %: keine fälschlich erreichten Punkte; 50–69 % korrekt als teilweise erreicht behandeln.
- Teilweise bewertete Bonusaufgaben: keine Behauptung „alle Bonuspunkte“.
- Fremde Kompetenztexte: grammatisch sichere Anführungszeichen; Daten/Originaltitel nicht überschreiben.
- Synthetisches 89-%-/70-%-Profil (zwei von fünf erreichten Kompetenzen): ein gemeinsamer natürlicher Lobsatz, keine wiederholten Satzbausteine oder doppeltes „Klasse!“. 100 %/100 % der *regulären* Punkte: gemeinsames besonderes Lob. Bei unbekannten Begriffen grammatisch neutral verbinden.
- 27+ künstliche Datensätze: Varianten, syntaktisch stimmige Übergänge, Längenbegrenzung, maximal zwei Ausrufezeichen.
- **Unverändert** bleiben Notenschlüssel, Fachstatus, Bonusverrechnung, persönliche Daten, IndexedDB, Import/Export, PDF und Unterschriften.

**Abnahmehinweis:** Die automatisierten Text- und Syntaxtests decken nicht das reale Safari-/PDF-Layout ab. Vor dem tatsächlichen Drucken ist eine Prüfung mit dem privaten Klassenbestand im Browser erforderlich.
