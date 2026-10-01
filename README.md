# Bordinventar

Bordinventar ist eine kleine App, die zeigt, was an Bord wo liegt. Sie läuft auf dem iPhone und auf dem Mac, braucht kein Konto und keinen Server und funktioniert nach dem ersten Öffnen auch ohne Internet, zum Beispiel auf See.

Die Adresse der App lautet:

**https://kaeptnmonmon.github.io/bordinventar/**

Dass dieses Repository öffentlich ist, ist unkritisch: Hier liegt nur der Programmcode. Die Inventardaten liegen ausschließlich auf den Geräten, auf denen du die App benutzt, und kommen nie hierher.

## Was die App kann

- **Suchen:** Oben im Suchfeld eintippen, was du suchst, zum Beispiel „Impeller“ oder „schaekel“. Die Liste filtert sofort. „Schäkel“, „schaekel“ und „SCHAEKEL“ sind dasselbe.
- **Alles:** Alle Artikel, sortiert nach Stauraum und Kiste.
- **Stauräume:** Jeder Stauraum als Karte, mit seinen Kisten oder Unterteilungen.
- **Plan:** Das Schiff von oben. Tippe einen Bereich an, um zu sehen, was dort liegt. Suchst du etwas, leuchtet der Bereich auf, in dem es liegt.
- **Prüfen:** Was abgelaufen ist, was in den nächsten sechs Monaten abläuft und was nachgekauft werden muss.
- **Aufgaben:** Reparaturen, Projekte und Termine, unabhängig vom Inventar. Siehe unten.
- **Menge ändern:** Mit den Knöpfen − und + in der Zeile, ohne Dialog.
- **Artikel anlegen, ändern, löschen:** Mit dem Knopf „+ Artikel“ unten rechts, mit einem Tipp auf den Namen oder mit dem Mülleimer am Zeilenende. Vor dem Löschen fragt die App nach.

Es gibt keinen Speichern-Knopf. Jede Änderung wird sofort im Gerät gesichert.

### Aufgaben

Im Reiter „Aufgaben“ steht oben statt der Suche ein Eingabefeld: antippen, den Text eintippen oder diktieren, dann Return oder „+“. Die Aufgabe ist sofort angelegt, und das Feld bleibt leer und fokussiert stehen, du kannst gleich die nächste diktieren.

Kleinigkeiten wie „Umlenkrolle Fockschot reparieren“ reichen als ein Satz. Für größere Vorhaben oder Termine tippst du die Aufgabe danach an und trägst ein **Fälligkeitsdatum** und eine **Notiz** nach, zum Beispiel beim Kleben des Steuerbord-Fensters oder bei der jährlichen Unterwasserwartung. Fällige Aufgaben werden wie das Ablaufdatum bei Artikeln eingefärbt: überfällig rot, bald fällig gelb.

Ein Tipp auf den Kreis vor der Aufgabe hakt sie ab. Sie verschwindet dann aus der Liste und landet in einem eingeklappten Block „Erledigt“, den du bei Bedarf aufklappst. Gelöscht wird dabei nichts; endgültig entfernst du erledigte Aufgaben über „Erledigte löschen“ in diesem Block.

Aufgaben gleichen sich zwischen iPhone und Mac genauso ab wie das Inventar, über Sicherung und Import (siehe unten).

Für wiederkehrende Termine gibt es noch keine Automatik. Nach dem Abhaken legst du die nächste Fälligkeit bei Bedarf als neue Aufgabe an.

### Eine Aufgabe aus einem Chat oder einer anderen App übergeben

Ein Chat wie Claude.ai hat keinen Zugriff auf diese App – Browser trennen die Daten jeder Adresse streng, und Bordinventar hat bewusst keinen Server, der das überbrücken könnte. Zwei Wege funktionieren trotzdem, beide ohne dass Daten irgendwo zwischengespeichert würden:

**Direkt mit der Adresse.** Hängst du `?aufgabe=DeinText` an die Adresse der App, öffnet sie direkt den Reiter „Aufgaben“ mit diesem Text im Eingabefeld, fertig zum Abschicken mit Return. Ein Beispiel:

```
https://kaeptnmonmon.github.io/bordinventar/?aufgabe=Fenster%20Steuerbord%20Pflicht%20kleben
```

Leerzeichen werden als `%20` geschrieben, Umlaute und Sonderzeichen entsprechend. Nichts wird automatisch angelegt – du siehst den Text erst im Feld und bestätigst ihn selbst.

Das lässt sich mit der App **Kurzbefehle** am iPhone zu einer Teilen-Aktion machen: Neuer Kurzbefehl, Aktion „URL öffnen“ mit der Adresse oben und der Kurzbefehl-Eingabe statt `DeinText` eingesetzt, dazu „Übergabe vom Teilen-Menü akzeptieren“ (Text) einschalten. Danach kannst du in Safari, in Notizen oder im Claude-Chat Text markieren, auf „Teilen“ tippen und den Kurzbefehl wählen – er öffnet Bordinventar mit dem Text im Aufgabenfeld.

**Als Datei.** Bitte den Chat, dir die Aufgabe als Datei in genau diesem Aufbau auszugeben, speichere die Datei und lies sie über „Sicherung einlesen“ ein:

```json
{
  "format": "bordinventar",
  "version": 1,
  "exportedAt": "2026-10-01T12:00:00.000Z",
  "tasks": [
    { "id": "tsk_fenster01", "title": "Fenster Steuerbord Pflicht kleben", "dueDate": "", "note": "", "done": false, "completedAt": null, "updatedAt": "2026-10-01T12:00:00.000Z" }
  ]
}
```

Dieser Weg eignet sich für mehrere Aufgaben auf einmal; der erste Weg ist für eine einzelne Aufgabe schneller.

### Kisten, Unterteilungen und Stauräume

Jeder Bereich im Plan ist ein Stauraum. Die meisten zeigen ihre Artikel direkt, zum Beispiel der Ankerkasten. Zwei Arten der Unterteilung gibt es:

- **Kisten** mit Nummer und Ebene gibt es nur in der Backskiste Backbord (und in zusätzlichen Stauräumen, die du über das Menü selbst anlegst).
- **Unterteilungen** ohne Nummer, die du selbst benennst („Mitte“, „Vorne“), lassen sich in den Salon-Schapps, in der Pantry und in den Sofas anlegen. Dafür gibt es in diesen Stauräumen den Knopf „+ Unterteilung“.

Löschst du eine Kiste oder Unterteilung, bleiben ihre Artikel im Stauraum erhalten. Löschst du einen Stauraum, den du selbst angelegt hast, werden auch seine Kisten und Artikel gelöscht. Die App nennt dir vorher die Anzahl.

## Installieren

Die App muss einmal mit Internet geöffnet werden. Danach läuft sie auch im Flugmodus.

**iPhone**
1. Öffne die Adresse oben in **Safari**. Das ist der Weg, den ich getestet habe.
2. Warte ein paar Sekunden, bis die Seite ganz geladen ist.
3. Tippe auf das Teilen-Symbol und wähle **Zum Home-Bildschirm**.
4. Starte die App künftig über das neue Symbol auf dem Home-Bildschirm. Sie erscheint ohne Browserleiste.

**Mac**
1. Öffne die Adresse in Safari.
2. Wähle im Menü **Ablage**, dann **Zum Dock hinzufügen**.

**Zu Safari und der installierten App:** Beide greifen auf dieselbe Adresse zu, und Browser speichern Daten pro Adresse – nach allem, was ich weiß, teilen sie sich deshalb denselben Datenbestand. Sicher bin ich mir nicht, weil ich das nicht an einem echten iPhone nachprüfen kann. Einmal selbst testen, bevor du dich darauf verlässt: In der installierten App einen Testeintrag anlegen, dann dieselbe Adresse in Safari öffnen und nachsehen, ob er dort erscheint. IPhone und Mac haben in jedem Fall getrennte Daten, weil es zwei verschiedene Geräte sind – dafür gibt es den Abgleich (siehe unten).

## Sichern

Ein Backup legst du selbst an. Tippe oben rechts auf die drei Punkte (⋮) und wähle:

- **Sicherung als JSON:** Das vollständige Backup. Es lässt sich in der App wieder einlesen und dient dem Abgleich zwischen Geräten.
- **Sicherung als HTML:** Ein Archiv, das du in jedem Browser öffnen und durchsuchen kannst, auch in zehn Jahren und ohne diese App. Die Datei lässt sich ebenfalls in der App wieder einlesen.
- **Liste als CSV:** Eine Tabelle für Numbers oder Excel.

Am **iPhone** öffnet sich das Teilen-Menü. Wähle dort „In Dateien sichern“, am besten einen Ordner in iCloud Drive. Öffnet sich das Menü nicht, wird die Datei stattdessen heruntergeladen und liegt in der App „Dateien“ im Ordner „Downloads“. Am **Mac** wird die Datei in den Ordner „Downloads“ geladen.

Der Dateiname enthält Datum und Uhrzeit, zum Beispiel `Bordinventar-2026-09-28_1435.json`. So verwechselst du Sicherungen nicht. Lege regelmäßig eine an und immer vor größeren Änderungen.

## Zwischen iPhone und Mac abgleichen

Die Daten werden nicht automatisch übertragen. Du überträgst sie selbst, und das geht so:

1. Am ersten Gerät legst du eine **Sicherung als JSON** an.
2. Bringe die Datei zum zweiten Gerät, am einfachsten per AirDrop oder über iCloud Drive.
3. Am zweiten Gerät tippst du im Menü auf **Sicherung einlesen** und wählst die Datei.
4. Die App meldet, wie viele Einträge neu, geändert oder gelöscht wurden.

Der Abgleich **führt zusammen, statt zu ersetzen**. Für jeden Eintrag gilt die jüngere Fassung, egal auf welchem Gerät sie entstanden ist. Was nur auf dem einen Gerät existiert, bleibt erhalten. **Gelöschtes wird mit übertragen:** Hast du einen Artikel auf dem einen Gerät gelöscht und liest die Sicherung auf dem anderen ein, verschwindet er auch dort. Wurde er aber nach dem Löschen auf dem anderen Gerät noch geändert, gewinnt die Änderung.

Willst du in beide Richtungen abgleichen, wiederholst du die Schritte mit vertauschten Geräten. Die Reihenfolge ist egal.

## Wenn etwas nicht stimmt

- **Die Seite zeigt „404“:** Die Adresse stimmt nicht, oder die App ist noch nicht veröffentlicht. Prüfe die Schreibweise `bordinventar` und warte nach einer Aktualisierung ein bis zwei Minuten.
- **Nach einer Aktualisierung sehe ich noch die alte Fassung:** Schließe die App ganz und öffne sie neu. Beim ersten Öffnen holt sie die neue Fassung im Hintergrund, beim zweiten läuft sie.
- **Das Teilen-Menü öffnet sich nicht:** Die Sicherung wird dann als Datei heruntergeladen. Du findest sie in der App „Dateien“ im Ordner „Downloads“.
- **Meine Daten sind weg:** Die Daten gehören zur Adresse und zur Installation. Sie verschwinden, wenn du die App vom Home-Bildschirm löschst oder wenn sich die Adresse ändert. Benenne das Repository und den GitHub-Benutzer deshalb nie um. Mit einer Sicherung stellst du alles über „Sicherung einlesen“ wieder her.
- **Ein Datum ist voreingestellt:** Im Feld „Haltbar bis“ entfernst du ein Datum mit dem ×.

## Für den, der die App pflegt

Die App ist reines HTML, CSS und JavaScript ohne Programmierumgebung. Es gibt nichts zu installieren und zu bauen.

### Hochladen auf GitHub Pages

Einmalige Einrichtung:

1. Auf github.com ein öffentliches Repository `bordinventar` unter dem Konto `KaeptnMonMon` anlegen.
2. Die Dateien hochladen, wie unten beschrieben.
3. Im Repository unter **Settings**, dann **Pages** als Quelle **Deploy from a branch** wählen, den Zweig `main` und den Ordner `/ (root)`, und speichern. Nach ein bis zwei Minuten ist die Adresse erreichbar.

### Dateien für den Upload bereitstellen

Im Projektordner erzeugt dieser Befehl den Ordner `Upload` mit genau den Dateien, die auf GitHub gehören, und prüft dabei, ob der Service Worker alle kennt:

```bash
./bereitstellen.sh
```

Den **Inhalt** von `Upload` ziehst du auf GitHub unter **Add file**, dann **Upload files**, und bestätigst mit **Commit changes**. Gleichnamige Dateien werden ersetzt. Nimm den Inhalt und nicht den Ordner `Upload` selbst.

### Bei jeder Änderung

Erhöhe in `sw.js` die Cache-Version, zum Beispiel von `bordinventar-v19` auf `bordinventar-v20`. Ohne diesen Schritt bleibt auf dem iPhone still die alte Fassung stehen, ohne Fehlermeldung. Danach `./bereitstellen.sh` ausführen und den Inhalt von `Upload` hochladen.

Hinzufügen einer neuen Datei: Trage sie in die Liste in `sw.js` ein, sonst stoppt `bereitstellen.sh` mit einer Meldung.

### Lokal ausprobieren

Aus dem Projektordner heraus, in einem Unterordner gleichen Namens, damit sich Pfadfehler sofort zeigen:

```bash
./bereitstellen.sh && mkdir -p /tmp/pagestest && ln -sfn "$PWD/Upload" /tmp/pagestest/bordinventar && cd /tmp/pagestest && python3 -m http.server 8080
```

Dann `http://localhost:8080/bordinventar/` in Safari öffnen. Auf `localhost` funktioniert auch der Offline-Betrieb. Am iPhone über die Adresse des Macs im WLAN klappen Bedienung und Layout, aber der Offline-Betrieb nur über `https`.

### Aufbau

| Datei | Aufgabe |
|---|---|
| `index.html` | Grundgerüst, Kopfleiste und Reiter |
| `app.css` | Gestaltung, Farben, hell und dunkel |
| `sw.js` | Service Worker: Offline-Betrieb und Cache-Version |
| `manifest.webmanifest` | Installierbarkeit als App |
| `seed.json` | Startdaten beim allerersten Start |
| `js/store.js` | Datenbank im Gerät (IndexedDB) und Schema |
| `js/model.js` | Suche, Ablauf, Mindestbestand |
| `js/views.js`, `js/plan.js`, `js/zones.js` | Reiter, Schiffsplan und seine Bereiche |
| `js/dialogs.js`, `js/overlay.js`, `js/menu.js` | Dialoge, Rückfragen und Menü |
| `js/exchange.js`, `js/backup-page.js` | Sicherung, Import und die HTML-Sicherung |
| `js/tasks.js` | Reiter „Aufgaben“: Ableitung, Ansicht, Dialog, Schnelleingabe |

Die Bereiche des Schiffsplans und ihre Zeichnung stehen in `js/zones.js`. Dort steht auch, welcher Bereich sich in Kisten oder Unterteilungen gliedert. Alle Einzelheiten beschreibt die Spezifikation `BORDINVENTAR-SPEC.md` im Projektordner.
