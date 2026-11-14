# Schulcockpit – aktueller technischer Stand und nächste Schritte

Stand: 14. November 2026. **GitHub \`main\` bleibt die Quelle für den tatsächlich veröffentlichten Stand.**
Diese Datei ersetzt nicht automatisch ältere Projektanhänge in ChatGPT; dort steht teilweise noch V0.18.8.

## Geliefert vor diesem Entwicklungsschritt

- **V0.31.7:** Prüfungsdateien mit getrennten Punkte-/Kompetenzrastern.
- **V0.31.8:** Prüfungsfassungen in der Auswertung unmittelbar auswählen und Kindern zuordnen.
- **V0.31.9:** Einzelne Unterrichtsstunden als Vertretungsstunde markieren; einfacher Word-Vertretungszettel und Materialpaket.
- Existierende Module für Unterrichts-Ist, Wochenvorbereitung, Materialhistorie, Arbeitsblattwahl und Reflexion bleiben bestehen.

## Aktueller Entwicklungsschritt: V0.32.0

**Mein Schultag – Tagesübersicht**, zunächst als lesende Ansicht auf dem bestehenden Zustand:

- zeigt ausschließlich vorhandene Stunden des gewählten Tages; keine automatisch erfundenen Wochenstunden;
- verwendet die vorhandenen Stunden-, Material-, PPT-, Druck- und Vertretungsdaten;
- führt mit direkten Aktionen in die existierenden Workflows;
- macht lokal fehlende PPT-/Arbeitsblattdateien sichtbar;
- überschreibt keine Sollstunden, Ist-Dokumentationen oder Statusmarkierungen;
- benutzt keine personenbezogenen Schülerdaten;
- enthält browserlesbare Smoke-Tests mit vollständig synthetischen Daten.

Die neue Ansicht ist bewusst **kein zweites Aufgaben-, Material- oder Planungsmodell**.

### Technische Leitplanken

- GitHub Pages, keine neue Laufzeit-/Build-Abhängigkeit.
- Dateiinhalte und private Prüfungsergebnisse bleiben im lokalen Browser.
- Neue, reine Statuslogik: \`schulcockpit-mein-schultag-v320-core.js\`.
- Browseroberfläche: \`schulcockpit-mein-schultag-v320.js\` und zugehörige CSS-Datei.
- Automatisierte Kurztests: \`tests/day-v320.test.js\` und \`tests/index-assets.test.js\`.
- GitHub Actions prüft Datei-Links und ausgewählte kritische Module auf Syntaxfehler.

## Nächste Arbeitspakete in empfohlener Reihenfolge

1. **Produktiven Tagesüberblick in echtem Browser testen.** Test mit mindestens einem Fachkurs, einem fehlenden AB, einer gehaltenen Stunde, einer Vertretung und einer Klassenarbeit. Bestehende lokale Daten vorher sichern.
2. **„Ich bin krank“ für den ganzen Tag:** Aus dem Stundenplan alle betroffenen Fachstunden für ein Datum sammeln, pro Stunde einfache Aufträge und vorhandene ABs wählen, alle Word-Zettel und Materialien als einen ZIP-Export herunterladen. Keine Fachunterrichts-PowerPoints.
3. **Druckpaket konsolidieren:** Nur tatsächlich neu benötigte Dateien/Fassungen; bereits verteilte oder archivierte ABs nicht erneut aufnehmen. Wiederverwendung mit klarer Kopienanzahl.
4. **Reflexion direkt aus Tagesansicht:** Zwei bis drei Klicks, Notizen und bisherige Verbesserungsmarkierungen beim Wiederverwenden einer Reihe anzeigen.
5. **Prüfungsauswertung end-to-end absichern:** Unterschiedliche Sonderfassungen mit Beispieldaten durch Import, Punkte, Kompetenzen und PDF-Druck begleiten.
6. **Schuljahresübernahme:** Reihen und Materialien ins Folgejahr übernehmen, ohne Kinder-/Leistungsdaten; dabei bestehende Ist-Stunden schützen.

## Was nicht behauptet wird

- Eine vollständig getestete End-to-End-Browsermigration gibt es hier noch nicht.
- Fehlende Arbeitsblätter entstehen noch nicht innerhalb der statischen App; dafür gibt es derzeit den ChatGPT-Quellenexport.
- Der Tagesstatus ist eine Übersicht der **lokal gespeicherten** Daten, keine Echtzeitabfrage von WebUntis.
- Die Schuljahresübernahme und der Gesamtkrankheitstag sind noch zukünftige Aufgaben.
