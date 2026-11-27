# Private LEB-Kompetenzmatrix V0.33.34

Die Funktion ist standardmäßig gesperrt und muss pro Kurs nach einer expliziten Geräte-/Schulfreigabe aktiviert werden. Sie verwendet ausschließlich stabile IDs aus der bestehenden privaten Klassenliste. Namen und Bewertungen werden nicht im normalen `state`, in Standard-Backups, Prompts oder Planungsexporten gespeichert.

Bewertungen liegen als eigener Datensatz im bestehenden privaten IndexedDB-Store. E, TE, NNE, offen, abwesend und nicht beurteilbar bleiben getrennt. Es gibt keine Vorbelegung und keine automatische Mittelung. Änderungen behalten die frühere Fassung. Backup, Wiederherstellung und Löschung betreffen nur die private Kompetenzmatrix; Klassenlisten und Klausurauswertungen bleiben erhalten.
