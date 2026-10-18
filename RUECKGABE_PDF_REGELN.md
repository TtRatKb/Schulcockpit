# Schulcockpit – Rückgabe-PDF: Druck- und Gestaltungskonzept (V0.23.3)

## Ziel

Der Bogen wird direkt an Kinder und Eltern ausgegeben. Deshalb soll er wie ein hochwertig gesetztes DIN-A4-Schulformular wirken, nicht wie ein roher technischer Bericht. Referenz für die Hierarchie: „Klassenarbeit Nr. 1 / Grundrechenarten I / 2026/2027“, klare tabellarische Kompetenzen, persönliche Rückmeldung und Unterschriften. Keine dekorative Mathegrafik; unten ausreichend ruhiger Platz für einen privaten Sticker.

## Inhalte und Reihenfolge

1. **Kopf:** Nummer/Überschrift der Klassenarbeit, Thema, Schuljahr, Name, Datum der Klassenarbeit und davon unabhängig das **Korrekturdatum**.
2. **Legende oberhalb der Tabelle:** E = erreicht, TE = teilweise erreicht, NNE = noch nicht erreicht.
3. **Kompetenztabelle:** Vollständige Fachkompetenzen; **Erreichte Punkte** = regulär erzielte Punkte und tatsächliche Bonuspunkte getrennt als `7 + 3` (kein Bonus: `7`), **Mögliche Punkte** = regulärer Maximalwert `10`, **Stand** = ausschließlich E, TE oder NNE. Status-Farbhintergrund nur als Orientierung, die Kürzel bleiben auch schwarz-weiß unterscheidbar.
4. **Gesamtpunkte:** `regulär + Bonus / regulär möglich` und **separat die anrechenbare Punktzahl** nach der schon bestehenden kompetenzbezogenen Bonusdeckelung. Extrapunkte können die kompetenzbezogenen regulären Maxima nicht übersteigen. Keine Neuinterpretation der Bewertung.
5. **Persönliche Rückmeldung:** Bestehende, in `feedbackV210` gespeicherte Texte behalten Vorrang vor automatisch generierten; Stärke und nächster eigenständiger Lernschritt bleiben erhalten.
6. **Unterschriften/Stickerraum:** Manuelle Kürzel-/Lehrkraftunterschriftslinie; optional nach bisheriger Einstellung ein Feld für Erziehungsberechtigte und eine bereits lokal hinterlegte Lehrer-Signatur. Ruhiger freier Raum unten, keine Matheillustration.

## Druckoptionen in Schritt 5

Die Lehrkraft kann für **jede Klassenarbeit** einstellen: Überschrift, Thema, **Korrekturdatum** und **Farbig / Schwarz-Weiß**. Diese Optionen liegen am bestehenden Prüfungsmetadatenobjekt unter `printSettingsV233` und werden mittels `saveState` dauerhaft gesichert. Sie verändern keine privaten Schülerdaten, keinen Kursplan und keine Berechnungen. Die bisherige Prüfungsdatum-Angabe `a.date` bleibt davon unabhängig.

## Typografie und technische Sicherheitsregeln

- Druckformat **DIN A4 (595 × 842 pt)**, Rand ca. 42 pt, klare Überschriftenhierarchie, ausreichende Zeilenhöhen. PDF nutzt bereits vom PDF-Standard bereitgestellte **Helvetica** für Fließtext und **Times-Bold** für das Thema (keine extern heruntergeladenen Schriftdateien).
- Sonderzeichen werden **WinAnsi-konform** als PDF-Oktalbytes kodiert, nicht als `Moeglich`, `Rueckmeldung` oder Fragezeichen für Umlaute. Gewöhnliche deutsche Umlaute und typografische Satzzeichen müssen lesbar bleiben.
- Farbdruck nutzt dezente Blau-/Grün-/Gelb-/Rosatöne; Schwarz-Weiß-Druck abgestufte Grautöne. Kein Status darf ausschließlich durch Farbe vermittelt werden.
- **Jede Kompetenzzeile muss vollständig erscheinen**; bei langen Rastern neue Seite mit Fortsetzungskopf. Lange Rückmeldungen dürfen umbrechen und auf einer Folgeseite fortgesetzt werden, statt am Seitenende still verloren zu gehen.
- Die beiden bisherigen Exportwege (Gesamt-PDF und ZIP mit Einzel-PDFs) müssen dieselbe PDF-Funktion verwenden. Vor Export werden ungespeicherte persönliche Texte und veränderte Druckeinstellungen gespeichert; bei Speicherfehler kein stiller Export mit ungesichertem Zustand.
- Keine Schülerdaten verlassen die lokale Browserinstanz. Externe Font-, PDF-, KI- oder Bilddienste werden für den Export nicht benötigt.

## Testfälle

- Fünf unterschiedlich lange Kompetenztexte inklusive Tabellenzeilen aus Jahrgang 5 passen bei üblichen kurzen Rückmeldungen **mit Unterschriften** auf eine A4-Seite.
- E/TE/NNE sichtbar; **`7 + 3` gegen `10`**, Gesamt-/Bonussumme und anrechenbarer Betrag korrekt getrennt.
- „Mögliche“, „Rückmeldung“, „Kürzel“, „Übe“ im PDF mit tatsächlichen Umlauten.
- Beide Druckfarbenvarianten enthalten dieselben Werte und Statuskürzel.
- Fehlende Elternunterschriftsanforderung entfernt nur das Elternfeld; die Lehrkraftunterschrift bleibt.
- Längeres Raster und längere persönliche Texte → Folgeseiten statt Abschneiden.
- Korrekturdatum eingeben, speichern, beim nächsten Öffnen beibehalten; fehlgeschlagene Speicherung → vorherige Einstellungen wiederherstellen.
- Berichtserzeugung verändert die Eingabedaten nicht; Datenmodelle, Im-/Export und Bonusschwellen bleiben unverändert.

**Praxisabnahme:** Syntaxtests und synthetische PDF-Byte-/Strukturprüfungen ersetzen keine abschließende Sichtprüfung im echten Safari-/PDF-Viewer mit lokal vorliegenden echten Klassenarbeitsdaten.
