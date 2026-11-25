# 📖 Zauberbuch – DnD 5e Spell Library

Eine selbst gehostete Bibliothek für D&D-5e-Zauber: durchsuchen, filtern, als Fantasy-Karten ansehen
und im eigenen **Zauberbuch** sammeln. Zauber (inkl. Homebrew) werden zweisprachig (DE/EN) über eine
Verwaltungsoberfläche gepflegt. Die App ist nur nach Anmeldung nutzbar; Benutzer legt der Admin an. Läuft als einzelner Docker-Container – optimiert für **Unraid**.

- 🔎 Live-Suche über Name und Beschreibung, **sprachübergreifend** („Feuerball“ findet auch „Fireball“) – per Häkchen
  „Nur im Namen suchen“ auch ausschließlich in den Zaubernamen (DE und EN)
- 🎚️ Filter: Grad (Mehrfachauswahl), Schule, Klasse, Schadensart, Konzentration, Ritual, Komponenten, Zauberzeit,
  Quelle/Homebrew, nur Mein Zauberbuch – Sortierung nach Name, Grad, Schule; Filter stehen in der URL
- 🃏 Responsives Karten-Grid im Pergament-Stil, Akzentfarbe je Schule, Schaden/Heilung direkt auf der Karte
  (z. B. „8W6 Feuer“), Detail als Modal **und** unter `/spells/:slug`
- 📕 „Mein Zauberbuch“: persönliche Sammlung pro Benutzer (Herz auf der Karte, serverseitig gespeichert,
  optimistisches UI-Update) mit denselben Such- und Filterfunktionen
- 📜 **Charakterbogen**: beliebig viele Charaktere pro Benutzer im Aufbau des D&D-5e-Bogens (Charakter,
  Merkmale & Inventar, Hintergrund, Zauber) mit automatischer Berechnung, Autospeichern, Porträt/Symbol
  und Verknüpfung der Zauber mit der Bibliothek
- 🗒️ **Infotafel** pro Geschichte: Mitspieler halten wichtige Infos fest – mit Kategorien, Suche, Kommentaren,
  angehefteten Beiträgen, Ungelesen-Zähler und Papierkorb (siehe [Infotafel](#infotafel))
- ⚔️ **Kampfhilfe**: Initiative-Reihenfolge mit Runden und aktivem Zug, Spielercharaktere live aus den
  Charakterbögen (RK, LP mit Lebensbalken), Monster mit verdeckbaren Werten, Zustände (siehe [Kampfhilfe](#kampfhilfe))
- 👥 Server-Rollen **Benutzer**, **Moderator** und **Admin**, dazu **Rollen pro Geschichte** (Spieler / Dungeon Master)
  für Infotafel und Kampf (siehe [Rollen & Benutzer](#rollen--benutzer))
- 🎲 **Würfel**: Würfel-Symbol in der Kopfzeile öffnet den Würfelbecher – W4, W6, W8, W10, W12, W20 und W100 in
  beliebiger Anzahl, Modifikator, Vorteil/Nachteil für den W20 (verworfener Wurf durchgestrichen), Einzelwerte und
  Summe, Hinweis bei natürlicher 20 bzw. 1 und ein Verlauf der letzten 20 Würfe (Klick würfelt erneut; nur in diesem
  Browser gespeichert). Gewürfelt wird mit kryptografisch sicherem Zufall. Ist eine **Geschichte ausgewählt**, bietet
  der Würfelbecher die eigenen Charaktere dieser Geschichte an: Attributswürfe, Rettungswürfe, Fertigkeiten,
  Initiative, Angriffe samt Schaden (aus „Waffen & Angriffszauber“, z. B. „1W6 + 3“) und Zauberangriff setzen Würfel
  und Modifikator direkt aus dem Charakterbogen; Ergebnis, Verlauf und „In den Chat“ (als dieser Charakter) tragen die
  Bezeichnung mit.
- ⚡ **Live-Aktualisierung**: Infotafel, Chat, Glocke und Kampf erscheinen bei allen sofort, ohne Neuladen
- 💬 **Chat** je Geschichte: private Zweiergespräche (Spieler ↔ DM, Spieler ↔ Spieler) und selbst erstellte Gruppen
  (nur für ihre Mitglieder sichtbar) über die Sprechblase in der Kopfzeile – als Charakter schreiben, Würfe teilen, Nachrichten bearbeiten/löschen, Zähler für Ungelesenes
- 🧭 **Geschichten-Ansicht**: per Umschalter in der Kopfzeile führen Charakterbogen, Infotafel und Kampf direkt
  zur gewählten Geschichte
- 🔒 Ohne Anmeldung keine Daten – die Startseite ist der Login, es gibt keine Selbstregistrierung
- 🌍 DE/EN-Umschalter für Oberfläche **und** Zaubertexte (pro Benutzer gespeichert, Gäste im localStorage);
  fehlende Übersetzungen fallen auf die andere Sprache zurück (mit Hinweis-Badge)
- 🌙 Dark-/Light-Mode
- 🛠️ Verwaltung: Zauber anlegen/bearbeiten/duplizieren/löschen, Markdown-Editor mit Vorschau, DE/EN-Tabs,
  Zauberbücher aller Benutzer ansehen, JSON-Import (Vorschau + Dublettenprüfung) und -Export, Benutzerverwaltung
- 🔐 bcrypt, JWT im httpOnly-Cookie (SameSite=Lax) + CSRF-Header, Rate-Limiting, helmet
- 🐳 Multi-Stage-Dockerfile, PUID/PGID/UMASK, automatische Migrationen mit DB-Sicherung, Healthcheck

---

## Inhalt

1. [Schnellstart (docker compose)](#schnellstart-docker-compose)
2. [Installation auf Unraid](#installation-auf-unraid)
3. [Rollen & Benutzer](#rollen--benutzer)
   - [Infotafel](#infotafel)
   - [Kampfhilfe](#kampfhilfe)
4. [Umgebungsvariablen](#umgebungsvariablen)
5. [Daten, Backup & Wiederherstellung](#daten-backup--wiederherstellung)
6. [Reverse Proxy](#reverse-proxy-nginx-proxy-manager--swag)
   - [Live-Aktualisierung](#live-aktualisierung)
7. [JSON-Importformat](#json-importformat)
8. [REST-API](#rest-api)
9. [Lokale Entwicklung ohne Docker](#lokale-entwicklung-ohne-docker)
10. [Tests](#tests)
11. [Image bauen & veröffentlichen](#image-bauen--veröffentlichen)
12. [Projektstruktur](#projektstruktur)

---

## Schnellstart (docker compose)

```bash
git clone https://github.com/JNDMNK/zauberbuch.git
cd zauberbuch
cp .env.example .env        # Admin-Passwort und DATA_PATH anpassen!
docker compose up -d
```

Danach ist die App unter **http://SERVER-IP:8080/** erreichbar – die Startseite ist der Login.
Mit `ADMIN_USERNAME` / `ADMIN_PASSWORD` anmelden; unter **Verwaltung → Benutzer** legst du weitere
Benutzer an.

Standardmäßig baut `docker compose` das Image lokal. Um das fertige Image aus der GitHub Container
Registry zu verwenden, in der `.env` `ZAUBERBUCH_IMAGE=ghcr.io/jndmnk/zauberbuch:latest` setzen und
`docker compose pull && docker compose up -d` ausführen.

> Außerhalb von Unraid in der `.env` z. B. `DATA_PATH=./data` setzen.

## Installation auf Unraid

### Variante A: Docker-Template (empfohlen)

1. Sicherstellen, dass das Image `ghcr.io/jndmnk/zauberbuch` veröffentlicht und öffentlich ist
   (siehe [Image bauen & veröffentlichen](#image-bauen--veröffentlichen)).
2. Template auf den Unraid-USB-Stick kopieren:
   ```bash
   cp zauberbuch.xml /boot/config/plugins/dockerMan/templates-user/my-zauberbuch.xml
   ```
3. In der Unraid-Oberfläche **Docker → Add Container → Template: Zauberbuch** wählen,
   **Admin-Passwort** setzen und **Apply** klicken.
4. Über das Container-Icon → **WebUI** öffnen.

Die Daten liegen unter `/mnt/user/appdata/zauberbuch`. Die App läuft als `nobody:users` (99:100).

### Variante B: Docker Compose Manager

Mit dem Plugin „Docker Compose Manager“ einen neuen Stack anlegen, den Inhalt von
`docker-compose.yml` einfügen und unter „Edit Stack → ENV File“ die Werte aus `.env.example`
setzen (mindestens `ZAUBERBUCH_IMAGE` und `ADMIN_PASSWORD`). Dann **Compose Up**.

**Icon in der Docker-Übersicht:** Das Template bringt das Zauberbuch-Icon mit. Zusätzlich trägt das Image die Labels
`net.unraid.docker.icon` und `net.unraid.docker.webui` (ebenso die `docker-compose.yml`) – so zeigt Unraid Icon und
WebUI-Link auch bei Containern, die ohne Template (Compose oder „Add Container“) angelegt wurden. Fehlt das Icon nach
dem Update noch, einmal **Check for Updates** bzw. den Container neu erstellen; Unraid speichert Icons zwischen.

## Rollen & Benutzer

Die **Verwaltung** erreichst du über das Benutzermenü oben rechts (auf dem Handy über das ☰-Menü). „Alle Zauber“
und „Mein Zauberbuch“ liegen im Aufklappmenü **Zauber** – für Moderator und Admin dort zusätzlich
**„Zauberbücher der Spieler“**. Die Charakterbögen der anderen Spieler sehen Moderator und Admin (sowie der
Dungeon Master einer Geschichte die Bögen seiner Geschichte) auf der Seite **Charakterbogen** unter
„Charakterbögen weiterer Spieler“ (nur lesend).

Es gibt zwei Ebenen von Rechten:

- **Server-Rolle** (Verwaltung → Benutzer): **Benutzer**, **Moderator** (früher „Dungeon Master“) und **Admin**.
  Sie regelt Zauber, Zauberbücher, alle Charakterbögen und die Verwaltung.
- **Rolle pro Geschichte** (Verwaltung → Geschichten): **Spieler** oder **Dungeon Master**. Sie allein regelt, was
  jemand auf **Infotafel und Kampf** sieht und darf – auch für Moderatoren. Ein normaler Benutzer kann also in einer
  Geschichte Dungeon Master und in einer anderen Spieler sein. Der **Admin** hat in allen Geschichten DM-Rechte,
  außer er ist dort als Spieler eingetragen.

Unter **Mein Konto** (Benutzermenü) stellt jeder seine Sprache ein, ändert sein Passwort und lädt ein **Profilbild**
hoch (wird quadratisch zugeschnitten und auf 256 px verkleinert; entfernbar). Es erscheint im Benutzermenü und im Chat.

Ohne Anmeldung sind keine Daten sichtbar – weder in der Oberfläche noch über die API. Eine
Selbstregistrierung gibt es nicht: Benutzer legt der Admin unter **Verwaltung → Benutzer → Neuer Benutzer**
an (Benutzername, optional E-Mail, Passwort, Rolle). Dort kann er auch Rollen ändern, das Zusatzrecht
„Zauber bearbeiten“ vergeben, Passwörter neu
setzen (der Benutzer wird dabei auf allen Geräten abgemeldet) und Benutzer löschen.

| Recht (Server-Rolle) | Benutzer | Moderator | Admin |
|---|:---:|:---:|:---:|
| Zauber suchen, filtern, ansehen | ✔ | ✔ | ✔ |
| Eigenes Zauberbuch („Mein Zauberbuch“) führen | ✔ | ✔ | ✔ |
| Zauber anlegen, bearbeiten, duplizieren | (✔)¹ | ✔ | ✔ |
| Zauber löschen | – | ✔ | ✔ |
| Zauberbücher aller Benutzer ansehen | – | ✔ | ✔ |
| Eigene Charakterbögen anlegen und bearbeiten (inkl. Einstellungen: Geschichte, Mitbearbeiter) | ✔ | ✔ | ✔ |
| Geteilte Charakterbögen bearbeiten (als Mitbearbeiter) | ✔ | ✔ | ✔ |
| Einstellungen fremder Bögen ändern (Geschichte, Mitbearbeiter) | (✔)² | ✔ | ✔ |
| Charakterbögen aller Benutzer ansehen (nur lesen) | (✔)² | ✔ | ✔ |
| Geschichten anlegen, bearbeiten, Rollen vergeben, archivieren (Verwaltung → Geschichten) | – | ✔ | ✔ |
| Geschichten löschen, Papierkorb der Infotafel (wiederherstellen) | – | – | ✔ |
| JSON-Import und -Export (Zauber, Benutzer, Charakterbögen, Infotafel) | – | – | ✔ |
| Benutzer anlegen, Rollen ändern, Passwörter setzen, löschen | – | – | ✔ |

² Als Dungeon Master einer Geschichte: für die Bögen, die dieser Geschichte zugeordnet sind.

| Recht (Rolle in der Geschichte) | Spieler | Dungeon Master |
|---|:---:|:---:|
| Infotafel lesen, Beiträge und Kommentare schreiben, eigene bearbeiten/löschen | ✔ | ✔ |
| Fremde Beiträge/Kommentare bearbeiten und löschen, anheften | – | ✔ |
| Kämpfe ansehen (verdeckte Monsterwerte nur als grober Zustand) | ✔ | ✔ |
| Kämpfe führen (anlegen, Teilnehmer, Initiative, Monster, Zustände, verdeckte Werte) | – | ✔ |
| Spieler-Monster-Datenbank der Geschichte bearbeiten | ✔ | nur lesen |
| DM-Monster-Datenbank nutzen | – | ✔ |
| Charakterbögen der Geschichte lesen und deren Einstellungen ändern | – | ✔ |

Ohne Eintrag ist eine Geschichte (mit Infotafel und Kämpfen) unsichtbar.

¹ Nur mit dem Zusatzrecht **„Zauber bearbeiten“**, das der Admin pro Benutzer unter **Verwaltung → Benutzer**
per Häkchen vergibt (auch direkt beim Anlegen). Der Benutzer behält ansonsten seine Rechte: In der Verwaltung
sieht er nur den Reiter **Zauber**, kann aber nicht löschen und keine fremden Zauberbücher oder Charakterbögen
ansehen. Das Recht wird beim Benutzer-Export/-Import mitgenommen.

Der erste Admin wird beim Start aus `ADMIN_USERNAME`/`ADMIN_PASSWORD` angelegt. Der letzte Admin
kann weder herabgestuft noch gelöscht werden.

## Charakterbogen

Unter **Charakterbogen** legt jeder Benutzer beliebig viele Charaktere an (bis zu 50). 
**Assistent für neue Charaktere** („Neuer Charakter (Assistent)“, daneben weiterhin „Leerer Bogen“): führt in
neun Schritten zu einem fertig ausgefüllten Bogen der Stufe 1 – **Geschichte** (eigene Geschichten oder „Ohne
Geschichte“; die aktive Geschichte ist vorausgewählt, der Charakter wird ihr direkt zugeordnet, und es gelten ihre
Quellen und Sprachen – Sprachen des Volks, die es in der Geschichte nicht gibt, werden mit Hinweis weggelassen) → Name → **Volk** (mit Unterart) → **Klasse** (mit
Unterklasse, wenn sie schon auf Stufe 1 gewählt wird, z. B. Klerikerdomäne) → **Hintergrund** (optional) →
**Attributswerte** (Standardreihe 15/14/13/12/10/8, Punktekauf mit 27 Punkten oder Würfeln 4W6/eigene Werte;
Erhöhung wahlweise nach Volk – Regeln 2014, inkl. „zwei weitere deiner Wahl“ – oder nach Hintergrund – Regeln
2024, +2/+1 oder +1/+1/+1) → **Fertigkeiten, Sprachen, Werkzeuge** (Klassenwahl „Zwei aus …“, feste Fertigkeiten des
Hintergrunds, Sprachen und Werkzeuge „deiner Wahl“ aus Wiki bzw. Gegenstands-Datenbank) → **Ausrüstung** →
**Zusammenfassung**. Im Schritt **Ausrüstung** wird die Startausrüstung von Klasse und Hintergrund aus dem Wiki-Text
erkannt: Auswahlen erscheinen als Optionen – in einer Zeile („(a) … oder (b) …“, „a) … oder b) …“, „A: … B: …“,
„Rapier oder Kurzschwert“) oder untereinander („A) Rapier“ / „B) Kurzschwert“, auch als verschachtelte bzw.
nummerierte Liste; Einleitungen wie „Wähle eins:“ werden übersprungen), Platzhalter wie „eine einfache Waffe“, „zwei
Kriegswaffen“ oder „ein anderes Musikinstrument“ als Auswahlliste aus der Gegenstands-Datenbank. Gegenstände kommen mit
Anzahl ins **Inventar** – erkannte Einträge verknüpft mit Gewicht und Karte (auch Plurale und Munition, z. B. „zwei
Handäxte“ → 2× Beil, „20 Pfeile“ → Pfeile (20)), übrige als Text. Ausrüstungspakete (Entdecker-, Gewölbe-,
Einbrecher-, Priester-, Diplomaten-, Unterhaltungs-, Gelehrtenausrüstung) werden auf Wunsch nach SRD in ihre Teile
ausgepackt, Startgold („Ein Beutel mit 15 GM“) geht in die Münzen, und Werkzeuge mit Übung (z. B. Diebeswerkzeug) landen
zusätzlich als Gegenstand im Inventar. Alle
Angaben kommen aus dem Wiki; übernommen werden Volk/Klasse/Hintergrund, Größe, Attribute, Rettungswürfe,
Fertigkeiten, Rüstungs- und Waffenübung, TP-Maximum (Trefferwürfel + KON), Trefferwürfel, RK ohne Rüstung,
Bewegungsrate, Sprachen, Werkzeuge, Volks- und Klassenmerkmale der Stufe 1, Hintergrundmerkmal und -talent,
Startausrüstung (Inventar und Münzen, wahlweise nur als Text), Zauberattribut und Zauberplätze sowie auf Wunsch zufällige Persönlichkeitsmerkmale aus
den Tabellen des Hintergrunds.

**Stufenaufstieg** (ein Hinweis unter den Erfahrungspunkten, sobald sie für die nächste Stufe reichen: „Genug
Erfahrung für Stufe 2! – Stufenaufstieg auf Stufe 2“; reichen sie für mehrere Stufen, wird Stufe für Stufe
aufgestiegen und angezeigt, wie viele noch folgen). **Meilensteine:** Der Dungeon Master der Geschichte gibt beim
Bogen eines Spielers über „Meilenstein-Aufstieg auf Stufe … freigeben“ (Leiste oben am Bogen) einen Aufstieg ohne
genug EP frei; der Spieler wird benachrichtigt, sieht den Hinweis „Der DM hat den Meilenstein-Aufstieg … freigegeben“
und steigt selbst auf (die Freigabe verfällt danach bzw. lässt sich zurücknehmen). Beim eigenen Bogen öffnet der DM
den Aufstieg direkt über „Stufenaufstieg ohne EP (Meilenstein)“. Der Dialog erkennt
Klasse und Unterklasse aus „Klasse & Stufe“ (Wiki) und zeigt Schritt für Schritt, was sich ändert –
**Trefferpunkte** (Durchschnitt, Würfeln oder eigener Wert, jeweils + KON), Trefferwürfel, die **neuen Klassen- und
Unterklassenmerkmale** der Stufe aus dem Wiki, die **Wahl der Unterklasse** auf der passenden Stufe (z. B. Magier 2,
Barbar 3), die **Attributswerterhöhung** (+2 / +1+1, max. 20) oder ein **Talent** auf den Stufen, für die das Wiki
eine Attributswerterhöhung vorsieht (eine höhere Konstitution erhöht die TP rückwirkend), **Zauberplätze** nach den
SRD-Tabellen (Voll-, Halbzauberer, Paktmagie), Übungsbonus und EP für die nächste Stufe. Neue Merkmale werden an „Klassenmerkmale“ angehängt, ein Talent an
„Weitere Merkmale“.

Der Bogen ist wie der D&D-5e-Charakterbogen in vier Reiter gegliedert:

| Reiter | Inhalt |
|---|---|
| **Charakter** | Klasse & Stufe, Hintergrund, Volk, EP · Attribute · Inspiration, Übungsbonus · Rettungswürfe und Fertigkeiten (Kreis anklicken: nicht geübt → geübt → Expertise) · RK, Initiative, Bewegungsrate · Trefferpunkte, Trefferwürfel, Todesrettungswürfe · Angriffe · Persönlichkeit · Übungen & Sprachen · Klassenmerkmale |
| **Merkmale & Inventar** | Volksmerkmale, Sinne, Lebensstil, Hoch-/Weitsprung, Feinde, weitere Merkmale · Inventar mit Teilgewicht, eingestimmte Gegenstände, Münzen, Traglast |
| **Hintergrund** | Alter, Glaube, Größe, Gewicht, Gesinnung, Aussehen … · Porträt und Symbol (Bild-Upload) · Verbündete, Aussehen, Hintergrundgeschichte, zusätzliche Ausrüstung, Werdegang |
| **Notizen** | Persönliche Notizen wie auf der Infotafel: Titel, Kategorie (Allgemein, Auftrag, Person, Ort, Wissen & Geheimnisse, Beute, Erledigen), formatierter Text mit Querverweisen, anpinnen, Suche und Filter. Privat für Besitzer und Mitbearbeiter; einzelne Notizen lassen sich „für den DM sichtbar“ machen – der DM der Geschichte (und Admin/Moderator) liest dann nur diese, ohne sie ändern zu können. Nicht im Druck, in der Gesamtsicherung enthalten |
| **Zauber** | Zauberwirkende Klasse und Attribut · Zauberplätze je Grad (verbrauchte Plätze anklickbar, „lange Rast“ setzt zurück) · Zauberlisten mit „vorbereitet“, Namensvorschlägen aus der Bibliothek, Link zur Zauberbeschreibung und Übernahme aus „Mein Zauberbuch“ |

**Automatisch berechnet** werden die benötigten Erfahrungspunkte für die nächste Stufe (laut Spielerhandbuch;
reichen die EP für einen Stufenaufstieg, bietet der Bogen an, die Stufe zu erhöhen), Attributsmodifikatoren,
Übungsbonus (aus der Gesamtstufe, überschreibbar),
Rettungswürfe, Fertigkeiten, passive Wahrnehmung, Initiative, Angriffsbonus, Zauber-Rettungswurf-SG und
-Angriffsbonus, Sprungweiten, Gewichte (50 Münzen = 1 lb) und Traglastgrenzen.

Änderungen werden automatisch gespeichert (kurz nach der letzten Eingabe sowie beim Verlassen der Seite).
Bilder (JPG, PNG, WebP, GIF; iPhone-Fotos wandelt das Gerät beim Auswählen um) werden im Browser verkleinert
(Porträt max. 700 px, Symbol max. 500 px, Drehung aus den Kamera-Daten wird übernommen) und mit dem Bogen
gespeichert – Fotos als JPEG, Bilder mit transparentem Hintergrund (z. B. Wappen) als PNG. Admin und Moderator sehen alle
Bögen auf der Seite **Charakterbogen** unter „Charakterbögen weiterer Spieler“ – nur lesend. Der Bogen lässt sich über das Drucker-Symbol drucken.

### Lebensstil & tägliche Kosten

Der **Lebensstil** wird im Bogen (Seite „Merkmale & Inventar“) aus einer Liste gewählt, die **täglichen Kosten**
kommen automatisch aus einer Tabelle:

- Ohne Geschichte gelten die Standardwerte aus dem Spielerhandbuch: Jämmerlich —, Ärmlich 1 SM, Schlecht 2 SM,
  Einfach 1 GM, Komfortabel 2 GM, Wohlhabend 4 GM, Edel 10 GM min.
- Jede **neue Geschichte** startet mit diesen Standardwerten. Unter **Verwaltung → Geschichten → Geschichte
  bearbeiten** lassen sich Namen und Kosten anpassen, Lebensstile hinzufügen oder entfernen („Standardwerte“ setzt
  zurück).
- Ist ein Bogen einer Geschichte zugeordnet, gelten **deren** Werte. Ändert der DM die Kosten, zeigen alle Bögen der
  Geschichte sofort die neuen Werte.
- Ein früher frei eingetragener Lebensstil, den es in der Tabelle nicht gibt, bleibt erhalten und behält seine
  Kosten.

### Sprachen und Werkzeuge & andere

Im Kasten **„Übung und Sprachen“** auf Seite 1 werden **Sprachen** und **Werkzeuge & andere** je Eintrag aus einer
Liste gewählt; **„+ Weitere hinzufügen“** ergänzt eine Zeile, **×** entfernt sie. Bereits gewählte Einträge sind in den
anderen Zeilen gesperrt.

- **Sprachen kommen aus dem Wiki** (Reiter „Sprachen“, Standard-Datenbank, vorbefüllt mit den 16 SRD-Sprachen samt Art,
  typischen Sprechern und Schrift). Neue Geschichten starten mit allen Wiki-Sprachen; unter **Verwaltung →
  Geschichten → Geschichte bearbeiten → Sprachen** werden Wiki-Sprachen an-/abgewählt und eigene ergänzt („Alle aus dem
  Wiki“ setzt zurück). Bögen einer Geschichte sehen deren Sprachen, Bögen ohne Geschichte alle Wiki-Sprachen.
- **Götter kommen ebenfalls aus dem Wiki** (Reiter „Götter“, vorbefüllt mit den 67 Gottheiten der vier
  fantasy-historischen Pantheons des SRD: keltisch, griechisch, ägyptisch, nordisch – mit Gesinnung, empfohlenen
  Domänen und Symbol). Unter **Geschichte bearbeiten → Götter** werden sie nach Pantheon gruppiert an-/abgewählt
  („alle“/„keine“ je Pantheon), eigene Götter ergänzt – auch eine Welt ganz ohne Götter ist möglich. Im
  Charakterbogen schlägt **„Glaube / Gottheit“** die Götter der Geschichte vor (ohne Geschichte: alle aus dem Wiki);
  steht die Gottheit im Wiki, öffnet ein Knopf ihre Karte. Freier Text bleibt möglich.
- Werkzeuge: Standardliste wie im Charakterbogen-PDF (36 Werkzeuge, Instrumente und Spielsätze), siehe unten.
- Jede neue Geschichte startet mit diesen Listen; unter **Verwaltung → Geschichten → Geschichte bearbeiten**
  lassen sich Einträge ergänzen oder entfernen („Standardwerte“ setzt zurück). Für Bögen der Geschichte gelten
  deren Listen.
- Gespeichert wird weiterhin ein Eintrag je Zeile; früher frei eingetragene Werte bleiben erhalten und wählbar.
- **Werkzeuge & andere sind mit dem Wiki verknüpft:** Die Auswahl kommt aus der Wiki-Ausrüstung (Gegenstands-Datenbank
  der Geschichte des Bogens bzw. Standard), gruppiert nach Art (Handwerkszeug, Spielset, Musikinstrument, sonstiges
  Werkzeug). Neben jedem Eintrag aus der Datenbank öffnet ein Knopf die Karte. Bezeichnungen der früheren
  Standardliste (z. B. „Satz Würfel“, „Tüftlerwerkzeuge“) werden automatisch dem passenden Wiki-Eintrag zugeordnet.
  Einträge der Werkzeugliste einer Geschichte, die es im Wiki nicht gibt (z. B. Drachenschach-Spielsatz), stehen
  unter „Weitere“.

### Gegenstände (Rüstung, Waffen, Ausrüstung)

- **Wiki → Rüstung / Waffen / Gegenstände / Ausrüstung** (für alle lesbar, bearbeitbar von Admin und Moderator) ist die **Standard-Datenbank**, aufgeteilt in die Reiter
  **Rüstung**, **Waffen**, **Gegenstände** und **Ausrüstung** in Kartenansicht mit Suche. Sie ist mit einer SRD-Grundausstattung
  vorbefüllt (Waffen, Rüstungen, Abenteurerausrüstung, Heiltränke).
  - Alle Einträge haben einen **Wert** (Freitext, z. B. „5 GM“); die Grundausstattung bringt die SRD-Preise mit.
  - Gegenstände: Name, Beschreibung, Gewicht, optional Heilung oder Schaden (z. B. Heiltrank 2W4+2 Heilung).
  - Waffen: Name, Schadenswürfel + Schadensart (wie bei den Zauberkarten), Gewicht, Beschreibung.
  - Ausrüstung (Werkzeuge nach SRD, z. B. Diebeswerkzeug): Name, **Art** (Handwerkszeug, Spielset, Musikinstrument,
    sonstiges Werkzeug), Gewicht, Wert, Beschreibung – vorbefüllt mit den 35 Werkzeugen und Werkzeug-Ausrüstungen des
    SRD (neue Kategorien werden bei Updates nachgetragen, solange sie leer sind).
  - Rüstung: Name, Rüstungsklasse (Text, z. B. „13 + GES (max. 2)“), benötigte **Stärke** (optional, z. B. 15 beim
    Plattenpanzer), Gewicht, Beschreibung.
- **Verwaltung → Geschichten → Geschichte bearbeiten → Gegenstände**: Jede Geschichte **erbt** die Standard-Datenbank
  live. Einträge lassen sich für die Geschichte anpassen, ausblenden, wieder auf den Standard zurücksetzen, und eigene
  Einträge kommen hinzu. Spätere Änderungen am Standard kommen automatisch an, außer ein Eintrag wurde angepasst.
- Im **Inventar des Charakterbogens** schlägt das Namensfeld (wie bei den Zaubern) Einträge aus der Datenbank der
  Geschichte des Bogens vor – ohne zugeordnete Geschichte aus der Standard-Datenbank. Beim Übernehmen wird der Text als
  „Name · Schaden · Beschreibung“ eingetragen, das Gewicht ins Gewichtsfeld übernommen und die Zeile mit der Karte
  verknüpft (Knopf neben dem Namen öffnet sie).

### Magische Gegenstände

- **Verwaltung → Magische Gegenstände** ist eine **allgemeine Datenbank für alle Geschichten**. Anlegen,
  bearbeiten und löschen dürfen Admin, Moderatoren und **alle Dungeon Master** (DMs erreichen die Verwaltung über das
  Benutzermenü). Gegenstände haben **Name**, **Beschreibung** (Markdown wie bei den Zaubern), **Gewicht** (lb),
  **Wert** (Freitext, z. B. „200 GM“) und den Haken „Einstimmung benötigt“.
- **Besitzer werden je Geschichte vergeben:** Oben „Besitzer vergeben in“ eine Geschichte wählen (DMs sehen nur die
  Geschichten, die sie leiten; Admin/Moderator alle), dann die Charakterbögen dieser Geschichte ankreuzen – auch
  mehrere. Derselbe Gegenstand kann so in mehreren Geschichten gleichzeitig vergeben sein; Besitzer aus Geschichten,
  die man nicht leitet, erscheinen nur als Anzahl („+1 in einer anderen Geschichte“). Gegenstände ohne Besitzer in
  der gewählten Geschichte liegen dort „beim DM“.
- **Karten wie bei den Zaubern:** Name, Textvorschau, Wert, Gewicht und Besitzer; ein Klick auf die Karte zeigt den
  Gegenstand vollständig im Vordergrund (im Charakterbogen dort auch Weitergeben/Zurückgeben). In der Verwaltung
  lassen sich dort die **Besitzer direkt per Haken zuordnen** – ohne den Bearbeiten-Dialog, jede Änderung wird sofort
  gespeichert und neue Besitzer werden benachrichtigt.
- Wer einen Gegenstand erhält, bekommt eine **Benachrichtigung** (Glocke); ein Klick öffnet den Bogen.
- Im Charakterbogen zeigt der Reiter **„Magische Gegenstände“** (vor „Einstellungen“) die Gegenstände des
  Charakters als Karten. Besitzer und Mitbearbeiter können einen Gegenstand **an einen anderen Charakter der
  Geschichte weitergeben** (dessen Spieler wird benachrichtigt) oder **an den DM zurückgeben** (die Dungeon Master
  der Geschichte werden benachrichtigt).
- **Gewicht:** Das Gewicht eines Gegenstands zählt bei jedem Charakter, der ihn besitzt, zur **Gesamtlast** und damit
  zu „belastet“/„stark belastet“; unter der Gesamtlast steht der Anteil der magischen Gegenstände.
- **Einstimmung:** Beim Gegenstand gibt es den Haken **„Einstimmung benötigt“**. Nur solche Gegenstände erscheinen in
  den drei Auswahllisten „Eingestimmte magische Gegenstände“ des Charakters; Gegenstände ohne Haken bleiben nur im
  Reiter „Magische Gegenstände“. Eingestimmte Gegenstände sind auf ihrer Karte markiert. (Beim Update auf diese Version
  bekommen bereits vorhandene Gegenstände den Haken, damit bestehende Einstimmungen erhalten bleiben.)

### Einstellungen eines Bogens

Die letzte Seite des Bogens, **Einstellungen**, sehen Besitzer, Moderator, Admin und der Dungeon Master der
zugeordneten Geschichte:

- **Geschichte:** ordnet den Bogen einer Geschichte der Infotafel zu. Der Besitzer wird dadurch automatisch
  **Mitspieler** dieser Geschichte (Infotafel, Kämpfe, Spieler-Monster-Datenbank). Im Kampf zeigt
  „Spieler hinzufügen“ dann zunächst nur die Bögen dieser Geschichte („Alle Bögen anzeigen“ blendet den Rest ein).
  Wird die Zuordnung entfernt, bleibt die Mitgliedschaft bestehen – die verwaltet der DM auf der Infotafel.
- **Mitbearbeiter:** ausgewählte Benutzer dürfen alle Werte des Bogens ändern; sie finden ihn auf ihrer Seite
  Charakterbogen unter **„Mit mir geteilt“**. Löschen, Duplizieren und die Einstellungen bleiben beim Besitzer
  (sowie DM und Admin).

Beim Export/Import der Charakterbögen werden Geschichte (über den Namen) und Mitbearbeiter (über die
Benutzernamen) mitgenommen.

### Export & Import der Benutzer (Admin)

Unter **Verwaltung → Import / Export → Benutzer** exportiert der Admin alle Benutzer mit E-Mail, Rolle,
Zusatzrecht, Sprache und „Mein Zauberbuch“ (als Zauber-Slugs). Optional – und standardmäßig – werden die **verschlüsselten
Passwörter** (bcrypt-Hashes) mitexportiert, sodass sich nach einem Import alle mit ihrem bisherigen Passwort
anmelden können. Die Datei ist daher vertraulich zu behandeln.

Beim Import zeigt eine Vorschau jeden Benutzer mit Status. Vorhandene Benutzer (gleicher Benutzername) werden
übersprungen oder auf Wunsch aktualisiert (E-Mail, Rolle, Zusatzrecht, Sprache, Passwort; Zauberbuch wird ergänzt). Das
eigene Admin-Konto wird nie verändert. Für Einträge ohne Passwort-Hash kann ein Startpasswort vorgegeben
werden, sonst werden sie übersprungen. Einträge mit einer E-Mail-Adresse, die bereits ein anderer Benutzer hat,
werden als Konflikt übersprungen.

```json
{
  "format": "zauberbuch-users",
  "version": 1,
  "exportedAt": "2026-01-01T12:00:00.000Z",
  "includesPasswords": true,
  "users": [
    { "username": "jan", "email": "jan@example.com", "role": "user", "language": "de",
      "passwordHash": "$2b$12$…", "favorites": ["feuerball", "schild"], "createdAt": "2026-01-01T10:00:00.000Z" }
  ]
}
```

### Export & Import der Charakterbögen (Admin)

Unter **Verwaltung → Import / Export → Charakterbögen** exportiert der Admin alle Bögen aller Benutzer als
eine JSON-Datei (inkl. Porträts und Symbole) – z. B. als Sicherung oder für einen Umzug. Beim Import zeigt
eine Vorschau jeden Bogen mit Status:

- **Zuordnung:** Jeder Bogen wird über den Benutzernamen (`owner`) wieder seinem Spieler zugeordnet.
  Bögen, deren Spieler es nicht gibt, werden übersprungen oder einem wählbaren Benutzer zugeordnet.
- **Dubletten:** Vorhandene Charaktere werden nie überschrieben. Gibt es beim selben Spieler bereits einen
  Charakter mit gleichem Namen, wird der Bogen übersprungen oder auf Wunsch trotzdem neu angelegt.
- Ungültige Werte im Bogen werden wie beim Speichern bereinigt.

Format:

```json
{
  "format": "zauberbuch-characters",
  "version": 1,
  "exportedAt": "2026-01-01T12:00:00.000Z",
  "characters": [
    { "owner": "jan", "name": "Vaelor Blackcoil", "data": { "identity": { "name": "Vaelor Blackcoil", "level": 3 }, "abilities": { "int": 17 } } }
  ]
}
```

`data` ist der komplette Bogen; fehlende Felder werden mit Standardwerten gefüllt.

## Quellen

- **Verwaltung → Quellen** (Admin und Moderator): Liste der Bücher mit Name und Kürzel, die in der ganzen App als
  Quelle auswählbar sind. Vorbefüllt mit **Spielerhandbuch (SHB)**, **Tashas Kessel der Schöpfung (TKS)** und
  **Xanathars Ratgeber für alles (XRA)**; je Quelle wird angezeigt, wie viele Wiki-Einträge, Gegenstände, magische
  Gegenstände, Zauber und Monster sie verwenden.
- Im **Wiki** (Völker, Klassen, Rüstung, Waffen, Gegenstände …) hat jeder Eintrag das Feld **„Quelle“**; Karten zeigen
  das Kürzel, die Detailansicht den vollen Namen, und die Listen lassen sich nach Quelle filtern. Die mitgelieferte
  SRD-Grundausstattung (auch die Beispielzauber) ist dem Spielerhandbuch zugeordnet.
- **Magische Gegenstände** haben ebenfalls ein Quellen-Feld (Kürzel auf der Karte, voller Name in der Detailansicht).
- **Zauber** und **Monster** (Werteblock) wählen die Quelle aus einer Auswahlliste (Quellen der Liste plus
  „Homebrew“) und zeigen sie verknüpft an: Kürzel auf Zauberkarte und in der Zauberverwaltung, voller Name in der
  Detailansicht bzw. im Werteblock, mit Tooltip. Sie speichern die Quelle als Text; benennt man eine Quelle um, werden
  Zauber und Monster mit dem alten Namen automatisch angepasst. Ein Name, der nicht (mehr) in der Liste steht, bleibt
  erhalten und wird als „nicht in der Liste“ markiert. Löscht man eine Quelle, verlieren Wiki-Einträge und
  (magische) Gegenstände die Angabe, Zauber und Monster behalten ihren Text.

## Wiki

- Hauptmenüpunkt **„Wiki“** (für alle angemeldeten Benutzer). Die Bereiche sind in einer **Seitenleiste** (am Handy
  ein Auswahlfeld „Bereich: …“) in drei Gruppen geordnet, jeweils mit Anzahl der Einträge:
  - **Charakter:** Völker, Klassen, Hintergründe, Talente
  - **Ausrüstung:** Rüstung, Waffen, Gegenstände, Ausrüstung (Gegenstands-Datenbank, siehe oben)
  - **Welt:** Sprachen, Götter, Regeln
- **Globale Suche** („Ganzes Wiki durchsuchen …“) über alle Bereiche gleichzeitig (ab 2 Zeichen): Treffer nach
  Bereich gruppiert (Namenstreffer zuerst, sonst mit Textausschnitt und hervorgehobener Fundstelle), Auswahl mit
  Maus oder Pfeiltasten + Enter öffnet den Eintrag im passenden Bereich. Innerhalb eines Bereichs filtert zusätzlich
  das Feld „In … suchen“ die Karten.
- Kartenansicht; ein Klick auf die Karte zeigt den vollständigen Eintrag (direkt verlinkbar über
  `?tab=class&entry=…`, Einträge der Gegenstands-Datenbank über `?tab=tool&item=…`).
- **Querverweise:** In Wiki-Einträgen, Zauberbeschreibungen, Monster-Werteblöcken und magischen Gegenständen werden
  Namen anderer Wiki-Einträge, von Rüstung, Waffen und Werkzeugen sowie von Zaubern automatisch verlinkt (gepunktet
  unterstrichen; je Textabschnitt das erste Vorkommen, auch mit deutschen Endungen wie „Rapiere“ oder
  „vergifteten“). Ein Klick öffnet den Eintrag – im Wiki im passenden Bereich, sonst als Dialog; Zauber öffnen als
  Zauberkarte. Allgemeine Abenteuerausrüstung („Seil“, „Buch“ …) wird bewusst nicht verlinkt; kurze Namen (unter
  5 Zeichen, z. B. „Tyr“) nur bei exakter Schreibweise.
- **Zauberliste je Klasse:** Die Detailansicht einer Klasse zeigt alle Zauber ihrer Zauberlisten aus der
  Zauberbibliothek, nach Grad gruppiert; ein Klick öffnet den Zauber. Die neun SRD-Zauberklassen werden am Namen
  erkannt; im Klassenformular lassen sich die genutzten Listen auch frei wählen (z. B. eine eigene Klasse nutzt die
  Artificer-Liste; „Artifizient“ wird als Artificer erkannt). Eigene **zaubernde** Wiki-Klassen (Zauberwirken im
  Klassenformular eingestellt) erscheinen außerdem im **Zauberformular** neben den neun Klassen – so lassen sich
  einzelne Zauber direkt einer eigenen Klasse zuordnen; Klassen ohne Zauberwirken (Barbar, Kämpfer …) erscheinen dort nicht.
- **Zauberplätze je Klasse:** Im Klassenformular unter „Zauberplätze & Zauberlisten“: Art des Zauberwirkens
  (automatisch nach Klassenname, kein Zauberwirken, Vollzauberer, Halbzauberer ab Stufe 2 bzw. ab Stufe 1,
  Drittelzauberer ab Stufe 3, Paktmagie) oder eine **eigene Tabelle** (Plätze je Stufe 1–20 und Grad 1–9, mit
  Vorlagen zum Übernehmen) sowie das Zauberattribut. Die Klassenansicht zeigt die Tabelle; Charakter-Assistent und
  Stufenaufstieg verwenden sie (auch für eigene Klassen).
- **Klassentabelle:** Zusätzlich zu den Zauberplätzen je Klasse die **bekannten Zaubertricks** je Stufe (bei den
  SRD-Klassen automatisch, sonst frei eintragbar) und bis zu **zwei frei benannte Spalten**, z. B. „Bekannte
  Infusionen“ und „Durchdrungene Gegenstände“ beim Artificer. Die Klassenansicht zeigt sie in der Tabelle, der
  Stufenaufstieg nennt die Änderung (z. B. „Bekannte Infusionen 4 → 6“).
- Felder nach dem **System Reference Document 5.1**:
  - **Volk:** Attributswerterhöhung, Alter, Gesinnung, Größe, Bewegungsrate, Sprachen, Merkmale (Name + Text) und
    Unterrassen (Name, Attributswerterhöhung, Beschreibung, eigene Merkmale).
  - **Klasse:** Trefferwürfel, TP auf der 1. und auf höheren Stufen, primäres Attribut, Übung (Rüstung, Waffen,
    Werkzeuge, Rettungswürfe, Fertigkeiten), Ausrüstung, Zauberwirken, Klassenmerkmale je Stufe sowie Unterklassen
    (Bezeichnung, z. B. „Arkane Tradition“, mit eigenen Merkmalen je Stufe und **eigener Quelle** – eine Klasse aus
    dem Spielerhandbuch kann so Unterklassen aus Tashas oder Xanathars enthalten).
  - **Sprache:** Art (Standard/Exotisch), typische Sprecher, Schrift – Standard für Geschichten und Charakterbögen.
  - **Gottheit:** Pantheon, Gesinnung, empfohlene Domänen, Symbol (Reiter mit Pantheon-Filter).
  - **Regel:** Kategorie (Grundregeln, Zustand, Kampf, Abenteuer, Rasten, Zauberwirken – auch als Filter) und
    optional ein **Zustand im Kampf**. Vorbefüllt mit 38 Regeln aus dem SRD: alle 15 Zustände (mit
    Erschöpfungstabelle), Vorteil/Nachteil, Attributs- und Rettungswürfe, Kampfablauf, Überraschung, Aktionen,
    Gelegenheitsangriff, Deckung, Kampf mit zwei Waffen, Ringen, Stoßen, kritische Treffer, 0 Trefferpunkte und
    Todesrettungswürfe, Sicht und Licht, Reisetempo, Fallschaden, Ersticken, Springen, kurze und lange Rast,
    Konzentration, Rituale und Zauberwirken. Im **Kampf** sind die Zustände an den Teilnehmern anklickbar und zeigen die
    verknüpfte Regel.
  - **Talent:** Kategorie (Herkunftstalent, Allgemeines Talent, Kampfstil-Talent, Epische Gabe – im Reiter auch als
    Filter), Voraussetzung, optionale Attributswerterhöhung (Halbtalente), Vorteile, „mehrfach wählbar“.
  - **Hintergrund:** Attributswerte (Auswahl aus den sechs Attributen, nach aktuellen Regeln drei), Talent
    (Herkunftstalent; Vorschläge aus den Wiki-Talenten, steht es im Wiki, ist es in der Detailansicht verlinkt), Fertigkeiten, Werkzeuge, Sprachen, Ausrüstung, Merkmal (Name + Text) und vorgeschlagene
    Charakterzüge – Persönlichkeitsmerkmale, Ideale, Bindungen und Makel, angezeigt als Würfeltabellen (W8/W6).
  - Dazu Kurzbeschreibung (für die Karte) und Beschreibung; Texte unterstützen Markdown.
- Beim ersten Start ist das Wiki mit den **9 Völkern, 12 Klassen, dem Talent „Ringer“ und dem Hintergrund
  „Tempeldiener“ des SRD 5.1** befüllt (mehr enthält das SRD nicht; neue Rubriken werden bei Updates einzeln
  nachgetragen, solange sie leer sind) (deutsche Zusammenfassung;
  SRD 5.1 von Wizards of the Coast LLC, lizenziert unter CC-BY-4.0).
- Einträge anlegen, bearbeiten und löschen dürfen nur **Admin und Moderator**.

## Infotafel

Unter **Infotafel** halten die Spieler wichtige Infos zum Spiel fest – Termine, Orte, NSCs, Quests, Gegenstände,
Lore. Jede **Geschichte** (Kampagne) hat ihre eigene Tafel, sodass mehrere Gruppen parallel spielen können.

- **Geschichten** legen Admin und Moderatoren unter **Verwaltung → Geschichten** an; sie erscheinen automatisch auf
  Infotafel und Kampf. Beim Bearbeiten trägt man Mitglieder mit ihrer Rolle ein (**Spieler** oder **Dungeon
  Master**) – diese Rollen sind die Ansichtsregeln für Infotafel und Kampf. Ein Moderator, der eine Geschichte
  anlegt, wird automatisch ihr Dungeon Master. Abgeschlossene Geschichten lassen sich **archivieren** (lesbar,
  aber schreibgeschützt; über „Archivierte anzeigen“ einblendbar). Endgültig löschen kann eine Geschichte nur der
  Admin. Spieler werden außerdem automatisch Mitglied, wenn sie ihren Charakterbogen der Geschichte zuordnen.
- **Quellen einer Geschichte:** Unter Verwaltung → Geschichten → bearbeiten legt man fest, welche Bücher gelten –
  „Alle Quellen“ (Standard, keine Einschränkung) oder eine Auswahl der Quellen aus Verwaltung → Quellen plus
  **„Homebrew / ohne Quelle“** (eigene Zauber und Einträge ohne Quellenangabe). Die Auswahl wirkt in der
  Geschichten-Ansicht (Zauberliste, Zauberbuch, Wiki) sowie im Charakter-Assistenten, im Charakterbogen
  (Zaubervorschläge) und im Stufenaufstieg (Unterklassen, Talente) von Charakteren dieser Geschichte.
  Beim Ändern der Quellen werden die Einstellungen der Geschichte automatisch angepasst: Sprachen und Götter aus dem
  Wiki sowie Werkzeuge der Gegenstands-Datenbank eines abgewählten Buchs werden abgewählt, die eines neu gewählten
  Buchs angewählt (Hinweis mit der Anzahl). Eigene Einträge bleiben erhalten; einzelne Optionen lassen sich danach
  wie gewohnt an- und abwählen.
- **Dungeon Master** einer Geschichte (auch ohne Verwaltungsrolle) sehen unter Verwaltung → Geschichten ihre
  Geschichten und bearbeiten deren Einstellungen – Quellen, Beschreibung, Lebensstile, Sprachen, Götter,
  Werkzeuge. Name, Mitglieder, Archivieren und die Gegenstands-Datenbank der Geschichte bleiben Admin und
  Moderatoren vorbehalten.
- **Beiträge** haben einen optionalen Titel, eine **Kategorie** und Text mit Markdown. **Ersteller und
  Zeitstempel** setzt der Server automatisch; Änderungen werden mit „bearbeitet am … von …“ gekennzeichnet.
  Ändern und löschen dürfen der Ersteller und die Dungeon Master der Geschichte. Lange Beiträge werden eingeklappt.
- **Anheften** (📌, Dungeon Master der Geschichte) hält wichtige Beiträge oben.
- **Kommentare** unter jedem Beitrag; dieselben Rechte wie bei Beiträgen.
- **Gefällt mir / Gefällt mir nicht** (👍/👎) unter jedem Beitrag: je Mitspieler eine Reaktion, erneuter Klick nimmt
  sie zurück, ein Klick auf den anderen Knopf wechselt. Die Zahlen sehen alle, beim Darüberfahren erscheinen die
  Namen. In archivierten Geschichten nur lesbar.
- **Benachrichtigung:** Ein neuer Beitrag löst bei allen anderen Mitspielern der Geschichte die Glocke aus
  („frodo hat auf der Infotafel „…“ geschrieben: …“); ein Klick darauf öffnet die Infotafel der Geschichte.
- **Suche** über Beiträge und Kommentare, **Filter** nach Kategorie.
- **Ungelesen-Zähler** am Reiter und an jeder Geschichte (neue Beiträge und Kommentare anderer seit dem letzten
  Öffnen). Neue Beiträge, Kommentare und Reaktionen anderer erscheinen **sofort** (Live-Aktualisierung).
- **Papierkorb:** Gelöschte Beiträge kann der Admin unter **Infotafel → Papierkorb** **90 Tage** lang
  wiederherstellen; danach werden sie automatisch endgültig entfernt. Gelöschte Kommentare sind sofort weg.
- Wird ein Benutzer gelöscht, bleiben seine Beiträge erhalten („gelöschter Benutzer“).

### DM-Notizen

- Dungeon Master einer Geschichte (und der Admin, sofern er dort nicht Spieler ist) sehen auf der Infotafel den
  zusätzlichen Reiter **„DM-Notizen“** – Spieler sehen ihn nicht, auch die API verweigert ihnen den Zugriff.
- Notizen sind in **Abschnitte** gegliedert (z. B. „Dorf A“) mit formatiertem Text (Markdown wie bei den Zaubern),
  etwa um mögliche Ereignisse und Abläufe festzuhalten.
- Abschnitte lassen sich mit Pfeilen **sortieren**, auf- und zuklappen (wird im Browser gemerkt), bearbeiten,
  löschen und durchsuchen. Jeder Abschnitt zeigt, wann und von wem er zuletzt geändert wurde; mehrere DMs einer
  Geschichte teilen sich die Notizen.

### Chat

- Die **Sprechblase** oben in der Kopfzeile öffnet den Chat (rechts als Seitenleiste, auf dem Handy bildschirmfüllend);
  ein roter Zähler zeigt ungelesene Nachrichten.
- Chats gehören immer zu einer **Geschichte**: Oben wählt man die Geschichte (voreingestellt die aktive), darunter
  stehen alle anderen Mitglieder – zuletzt aktive Gespräche zuerst.
- **Direktnachrichten** sind privat zu zweit (Spieler ↔ DM, Spieler ↔ Spieler). Niemand sonst liest mit – auch der DM
  sieht Gespräche zwischen Spielern nicht.
- **Gruppen:** Jedes Mitglied einer Geschichte kann über „Neue Gruppe“ eine Gruppe mit Namen anlegen und andere
  Mitglieder der Geschichte (auch den DM) hinzufügen. Eine Gruppe und ihren Verlauf sehen **nur ihre Mitglieder** –
  DM und Admin nur, wenn sie hinzugefügt wurden. Wer die Gruppe erstellt hat, ändert über ⚙ Name und Mitglieder oder
  löscht sie samt Verlauf; alle anderen sehen dort die Mitglieder und können die Gruppe verlassen. Verlässt der
  Ersteller die Gruppe, übernimmt das am längsten dabei befindliche Mitglied die Verwaltung. Entfernte Mitglieder
  sehen die Gruppe danach nicht mehr. In Gruppen steht über jeder Nachricht, wer (bzw. welcher Charakter) schreibt.
- **Als Charakter schreiben:** Wer eigene Charaktere in der Geschichte hat, wählt „Schreiben als“; die Nachricht
  zeigt dann Namen und Porträt des Charakters. Die Wahl wird **je Geschichte gespeichert** (auf dem Server, also auch
  auf anderen Geräten) und gilt für alle Gespräche dieser Geschichte, bis man sie selbst ändert. Angeboten werden nur
  eigene Charaktere dieser Geschichte; wechselt ein Charakter die Geschichte, gilt die Wahl dort nicht mehr. Im
  Charakterbogen öffnet die Sprechblase den Chat direkt als dieser Charakter (und merkt ihn ebenso).
- **Bilder im Chat:** Ist oben eine Geschichte gewählt, zeigen Kontaktliste und Nachrichten das **Charakterbild** des
  Mitglieds aus dieser Geschichte (bevorzugt der Charakter, als der es schreibt), sonst sein **Profilbild**; in
  „Allgemein“ zuerst das Profilbild, dann das Charakterbild. Ohne beides erscheint der Anfangsbuchstabe. Nachrichten
  „als Charakter“ zeigen immer dessen Bild.
- **Würfe teilen:** Im Würfelbecher schickt „In den Chat“ das Ergebnis (Ausdruck, Summe, Einzelwürfe) an einen
  wählbaren Gesprächspartner, optional mit Kommentar.
- Eigene Nachrichten lassen sich **bearbeiten** (Text) und **löschen** („Nachricht gelöscht“ bleibt im Verlauf);
  gelesene Nachrichten erhalten ✓✓. Enter sendet, Umschalt+Enter fügt eine Zeile ein; Formatierung und Querverweise
  wie bei Notizen.
- Neue Nachrichten, Bearbeitungen und Lesebestätigungen erscheinen sofort (Live-Aktualisierung). In archivierten Geschichten ist
  der Verlauf nur lesbar. Der Chat ist in der Gesamtsicherung enthalten.

## Kampfhilfe

Unter **Kampf** führt der Dungeon Master einer Geschichte Kämpfe. Jeder Kampf gehört zu einer **Geschichte**; deren
Spieler sehen ihn – nur lesend – in derselben Ansicht.

- **Spieler hinzufügen:** Auswahl aus den Charakterbögen der Geschichte und ihrer Mitglieder. Name,
  Rüstungsklasse und LP (aktuell/maximal, temporäre LP, Lebensbalken) kommen **live aus dem Bogen** und werden
  in der Kampfhilfe nie verändert. Ändert ein Spieler seine LP im Bogen, sieht man das nach wenigen Sekunden.
- **Initiative** trägt der DM direkt im Kreis auf der Karte ein.
- **Monster** legt der DM selbst an (Name, Anzahl, RK, LP, Initiative). Mehrere gleiche Monster werden
  durchnummeriert. Schaden und Heilung per Zahl + „Schaden“/„Heilung“; LP bleiben zwischen 0 und Maximum.
- **Verbündete NSCs** („Verbündeten hinzufügen“) funktionieren genau wie Monster – Anzahl, RK, LP, Initiative,
  Schaden/Heilung, Zustände, verbergbare Werte –, sind aber blau als **„Verbündet“** gekennzeichnet. Ihre Werte
  sind standardmäßig für Spieler sichtbar; bei 0 LP gelten sie (wie Spieler) als bewusstlos.
- **Werte verbergen:** Pro Monster kann der DM RK und LP für Spieler ausblenden (Auge auf der Karte, beim Anlegen
  standardmäßig an). Spieler sehen dann nur „unverletzt / angeschlagen / schwer verletzt / besiegt“ – die Zahlen
  werden gar nicht erst an ihren Browser geschickt.
- **Runde & Zug:** „Kampf starten“ / „Nächster Zug“ / „Zurück“ springen in Initiative-Reihenfolge weiter (höchste
  zuerst, bei Gleichstand alphabetisch), besiegte Monster werden übersprungen, nach dem Letzten beginnt die
  nächste Runde. Wer am Zug ist, ist rot markiert.
- **Kampfzeit:** Neben der Runde steht die verstrichene Zeit (1 Runde = 6 Sekunden, 10 Runden = 1 Minute) – praktisch,
  um nachzusehen, wie lange ein Zauber noch wirkt.
- **Farbmarkierung** am linken Kartenrand: grün = Spielercharakter, blau = Verbündeter.
- **Zustände** (vergiftet, liegend, bewusstlos, Konzentration …) setzt der DM pro Karte.
- **Sortierung** der Karten wählt jeder für sich: nach Initiative oder alphabetisch.
- Die Ansicht aktualisiert sich alle 3 Sekunden; ein roter Punkt am Reiter zeigt laufende Kämpfe.
- Beendete Kämpfe bleiben in der Liste und lassen sich fortsetzen oder löschen.
- **Admin als Spieler:** Ist der Admin in einer Geschichte als Spieler eingetragen, sieht er deren Kämpfe wie ein
  Spieler (ohne verdeckte Werte, ohne Verwaltung). Gibt er diese Rolle auf, erhalten die Dungeon Master der
  Geschichte eine Benachrichtigung (Glocke oben rechts).

### Monster-Datenbanken

Im Bereich **Kampf → Monster-Datenbank** gibt es zwei getrennte Datenbanken mit Name, RK, LP, Angriff
(z. B. „Krummsäbel +4 zum Treffen“), **Schaden** und Beschreibung. Der Schaden wird genau wie bei den Zaubern
hinterlegt – Würfelausdruck (z. B. `1d6+2` oder `2W8+4`) plus Schadensart aus derselben Liste – und erscheint im
gleichen Design (Symbol, Farbe der Schadensart, z. B. „1W6 + 2 Hieb“):

**Vollständiger Werteblock** (in beiden Datenbanken, alle Felder optional): Größe, Typ, Gesinnung, RK mit Zusatz
(z. B. „Lederrüstung, Schild“), LP mit Trefferwürfeln, Bewegungsrate, die sechs Attribute (Modifikator wird berechnet),
Rettungswürfe, Fertigkeiten, Schadensanfälligkeiten/-resistenzen/-immunitäten, Zustandsimmunitäten, Sinne, Sprachen,
Herausforderungsgrad (EP und Übungsbonus werden berechnet), beliebig viele **Merkmale, Aktionen, Bonusaktionen,
Reaktionen und legendäre Aktionen** (Name + Text mit Markdown) sowie Tags, Lebensraum und Quelle. Die Karte zeigt
eine Kurzfassung (RK, LP, HG, Merkmale/Aktionen); ein Klick öffnet den Werteblock im Stil des Monsterhandbuchs.
Der bisherige Angriff mit Schaden bleibt als „Kurzangriff für den Kampf“ erhalten.

- **DM-Datenbank:** Vorlagen – eine gemeinsame Datenbank aller Dungeon Master, aber **nur im Kontext einer
  Geschichte sichtbar, in der man Dungeon Master ist** (oben Geschichte wählen, dann zwischen DM- und
  Spieler-Datenbank umschalten). Wer in der gewählten Geschichte Spieler ist – auch wenn er anderswo leitet, und
  auch der Admin mit Spielerrolle –, sieht sie nicht; die API verlangt dafür `?storyId=` mit DM-Rolle.
  Beim Hinzufügen von Monstern oder Verbündeten im Kampf wählt der DM oben eine Vorlage; Name, RK, LP, Angriff und
  Beschreibung und Schaden werden übernommen (Anzahl und Initiative kommen dazu). Neue Monster lassen sich dort mit
  „Zusätzlich als Vorlage speichern“ direkt in die Datenbank übernehmen. Angriff, Schaden und Beschreibung stehen auf der
  Kampfkarte und sind **nur für den DM** sichtbar.
  Monster, die aus einer Vorlage stammen, bleiben mit ihr verknüpft: Auf der Kampfkarte erscheint für den DM der
  Link **„Werteblock öffnen“**, der den vollständigen Werteblock direkt auf der Kampfseite einblendet (Spieler sehen
  den Link nie; wird die Vorlage gelöscht, entfällt er, das Monster bleibt im Kampf).
- **Spieler-Datenbank je Geschichte:** gemeinsames Monster-Notizbuch der Mitspieler – ohne die Daten des DM. Alle
  Mitspieler dürfen Einträge anlegen, ergänzen und löschen (RK/LP dürfen leer bleiben, LP auch als Bereich wie
  „10-15“, wenn die Gruppe nur schätzen kann); angezeigt wird, wer einen
  Eintrag angelegt und zuletzt geändert hat. Die Dungeon Master der Geschichte können sie **nur lesen**.

### Geschichten-Ansicht

Rechts in der Kopfzeile schaltet jeder zwischen **„Allgemein“** und einer seiner Geschichten um (die Auswahl wird
im Konto gespeichert). In der Geschichten-Ansicht:

- **Charakterbogen:** Ist genau ein eigener Bogen der Geschichte zugeordnet und sieht man keine weiteren Bögen
  dieser Geschichte (geteilt oder als Dungeon Master), öffnet der Klick im Menü direkt diesen Bogen. Sonst zeigt die
  Übersicht nur die Bögen der Geschichte („Alle anzeigen“ hebt den Filter auf).
- **Infotafel:** öffnet direkt die Tafel der Geschichte.
- **Kampf:** zeigt nur die Kämpfe der Geschichte; läuft genau einer, führt der Klick im Menü direkt hinein.
- **Monster-Datenbank:** die Spieler-Datenbank der Geschichte ist vorausgewählt.
- **Zauber und Zauberbuch:** schränkt die Geschichte ihre Quellen ein, erscheinen nur Zauber aus diesen Quellen
  (Hinweis oberhalb der Liste mit den Quellen; „Allgemeine Ansicht (alles anzeigen)“ wechselt zurück zu allen
  Zaubern).
- **Wiki:** ebenso nur Einträge (Völker, Klassen, Unterklassen, Hintergründe, Talente, Rüstung, Waffen,
  Gegenstände …) aus den Quellen der Geschichte, auch in der globalen Suche und in der Zauberliste je Klasse.

In der Ansicht **„Allgemein“** bleibt die Menüführung wie gewohnt.

### Benachrichtigungen

Die **Glocke** in der Kopfzeile zeigt ungelesene Benachrichtigungen; neue werden zusätzlich kurz eingeblendet.
Beim Öffnen gelten sie als gelesen, „Alle löschen“ leert die Liste. Gelesene Benachrichtigungen werden nach
30 Tagen automatisch entfernt, ungelesene nach 180 Tagen.

### Export & Import der Infotafel (Admin)

Unter **Verwaltung → Import / Export → Infotafel** exportiert der Admin alle Geschichten mit Mitspielern,
Beiträgen und Kommentaren (ohne Papierkorb). Ersteller und Mitspieler werden über den Benutzernamen gespeichert –
nach einer Neuinstallation daher **zuerst die Benutzer importieren**. Beim Import werden Geschichten mit gleichem
Namen zusammengeführt; bereits vorhandene Beiträge werden übersprungen, ein erneuter Import erzeugt also keine
Dubletten.

## Umgebungsvariablen

| Variable | Standard | Beschreibung |
|---|---|---|
| `PUID` | `99` | Benutzer-ID, unter der die App läuft (Unraid: `nobody`) |
| `PGID` | `100` | Gruppen-ID (Unraid: `users`) |
| `UMASK` | `022` | UMASK für neu angelegte Dateien |
| `TZ` | `Europe/Berlin` | Zeitzone (Logs, Namen der Sicherungen) |
| `PORT` | `8080` | Interner HTTP-Port |
| `JWT_SECRET` | *(leer)* | Schlüssel für Login-Tokens. Leer ⇒ wird beim ersten Start zufällig erzeugt und in `/data/jwt_secret` gespeichert |
| `ADMIN_USERNAME` | *(leer)* | Erster Admin; wird nur angelegt, wenn noch **kein** Admin existiert. Existiert der Benutzer bereits, wird er zum Admin befördert |
| `ADMIN_PASSWORD` | *(leer)* | Passwort des ersten Admins (mind. 8 Zeichen empfohlen) |
| `ADMIN_EMAIL` | *(leer)* | Optionale E-Mail des ersten Admins |
| `DEFAULT_LANGUAGE` | `de` | Sprache für Gäste ohne gespeicherte Auswahl (`de`/`en`) |
| `SEED_EXAMPLES` | `false` (Image) / `true` (Compose, Template) | Legt 5 Beispielzauber an, solange die Datenbank leer ist |

Weitere, optionale Variablen:

| Variable | Standard | Beschreibung |
|---|---|---|
| `TRUST_PROXY` | `1` | Express-`trust proxy` (Anzahl Proxy-Hops, `true`/`false` oder Subnetz, z. B. `loopback, 172.16.0.0/12`) |
| `AUTH_RATE_LIMIT_MAX` | `10` | Max. Login-Versuche pro IP und Zeitfenster |
| `AUTH_RATE_LIMIT_WINDOW_MIN` | `15` | Zeitfenster des Rate-Limits in Minuten |
| `JWT_EXPIRES_IN` | `7d` | Gültigkeit der Login-Tokens |
| `COOKIE_MAX_AGE_DAYS` | `7` | Lebensdauer des Login-Cookies in Tagen |
| `BCRYPT_ROUNDS` | `12` | bcrypt-Kostenfaktor |
| `KEEP_BACKUPS` | `5` | Anzahl der aufbewahrten automatischen DB-Sicherungen |
| `LOG_TO_FILE` | `true` | Logs zusätzlich nach `/data/logs/zauberbuch.log` schreiben (Rotation ab 10 MB) |
| `DATABASE_URL` | `file:/data/zauberbuch.db` | SQLite-Datei (nur in Sonderfällen ändern) |

## Daten, Backup & Wiederherstellung

Alle persistenten Daten liegen **ausschließlich unter `/data`** (Unraid: `/mnt/user/appdata/zauberbuch`):

```
/data
├── zauberbuch.db          # SQLite-Datenbank (+ -wal/-shm im Betrieb)
├── jwt_secret             # automatisch erzeugtes JWT-Secret (falls JWT_SECRET leer)
├── backups/               # automatische Sicherungen vor Migrationen
├── logs/zauberbuch.log    # Access- und App-Log
└── uploads/               # reserviert für Datei-Uploads
```

**Automatische Sicherung:** Beim Containerstart prüft `start.sh` mit `prisma migrate status`, ob
Migrationen ausstehen (z. B. nach einem Update). Ist das der Fall, wird **vor** `prisma migrate deploy`
eine konsistente Kopie der Datenbank (`sqlite3 .backup`) als
`/data/backups/zauberbuch-JJJJMMTT-HHMMSS.db` abgelegt. Es werden die letzten 5 Sicherungen behalten.

**Manuelle Sicherung im laufenden Betrieb:**

```bash
docker exec zauberbuch sqlite3 /data/zauberbuch.db ".backup '/data/backups/manuell-$(date +%F).db'"
```

Alternativ den Container stoppen und den kompletten Ordner `/mnt/user/appdata/zauberbuch` sichern
(z. B. mit dem Unraid-Plugin „Appdata Backup“). Zusätzlich lässt sich unter
**Verwaltung → Import / Export** jederzeit ein JSON-Export aller Zauber herunterladen.

**Gesamtsicherung (empfohlen für Umzug und Wiederherstellung):** Unter **Verwaltung → Import / Export →
Gesamtsicherung** lädt der Admin **alle Daten in einer JSON-Datei** herunter (`zauberbuch-gesamt-JJJJ-MM-TT.json`):
Benutzer (mit Passwort-Hashes – Datei sicher aufbewahren), Zauber und Zauberbücher, Charakterbögen mit Bildern,
Geschichten, Infotafel, DM-Notizen, Kämpfe, Bestiarium, magische Gegenstände, Gegenstands-Datenbank, Wiki und
Quellen. Der Import zeigt zuerst eine Vorschau (Anzahl je Bereich) und ersetzt nach Bestätigung **sämtliche** Daten
in einer Transaktion – schlägt etwas fehl, bleibt alles unverändert. Vorher legt der Server automatisch eine
Sicherheitskopie als `/data/backups/vor-import-JJJJMMTT-HHMMSS.db` an. Sicherungen älterer App-Versionen lassen sich
einspielen (neue Felder erhalten Standardwerte, fehlende Wiki-/Katalog-Grundausstattung wird ergänzt); Sicherungen
einer **neueren** Version werden abgelehnt. Ist danach kein Admin vorhanden, wird er wie beim Start aus
`ADMIN_USERNAME`/`ADMIN_PASSWORD` angelegt.

**Teil-Export:** Unter **Verwaltung → Import / Export** exportiert der Admin außerdem einzeln
Zauber, Benutzer und Charakterbögen als JSON-Dateien. Auf dem neuen Server in dieser Reihenfolge importieren:
**1. Zauber → 2. Benutzer → 3. Charakterbögen** (Benutzer verweisen über „Mein Zauberbuch“ auf Zauber,
Charakterbögen über den Benutzernamen auf Benutzer).

> Bei einem normalen Container-Update gehen keine Daten verloren – alles liegt in `/data`. Fehlen nach einem
> Update Benutzer oder Zauber, ist `/data` nicht persistent gemappt (Unraid: Pfad `/data` →
> `/mnt/user/appdata/zauberbuch` im Container-Template prüfen).

**Wiederherstellung aus einer DB-Sicherung:**

```bash
docker stop zauberbuch
cd /mnt/user/appdata/zauberbuch
rm -f zauberbuch.db-wal zauberbuch.db-shm
cp backups/zauberbuch-20250101-120000.db zauberbuch.db
docker start zauberbuch
```

## Live-Aktualisierung

Infotafel (Beiträge, Kommentare, Reaktionen, roter Punkt im Menü), Chat, Glocke und Kampf (Zugwechsel, Trefferpunkte
– auch aus den Charakterbögen –, neue/beendete Kämpfe) aktualisieren sich bei allen Beteiligten **sofort**, ohne
Neuladen. Technisch hält jeder angemeldete Tab eine schlanke Verbindung zu `/api/events` (Server-Sent Events). Der
Server schickt darüber nur kurze Signale wie „Infotafel der Geschichte X hat sich geändert“ – **keine Inhalte** –, und
der Browser lädt den Bereich über die normale API nach. So gelten immer die üblichen Rechte: private Chats und
DM-Inhalte erreichen nur, wer sie sehen darf.

- Ein Kommentar-Herzschlag alle 25 Sekunden hält die Verbindung durch Proxys und Router offen.
- **Drucken (Safari):** Safari/WebKit wertet die offene Verbindung als „Seite lädt noch“ und würde den Druck endlos
  verschieben. Der Drucken-Knopf und ⌘P bzw. Strg+P trennen sie deshalb vorher; sie verbindet sich wieder, sobald man
  danach klickt oder tippt (spätestens nach 2 Minuten). Das Drucken über das Safari-Menü „Ablage → Drucken“ läuft
  daran vorbei – dafür bitte ⌘P oder den Knopf verwenden.
- Nach einem Abbruch (WLAN-Wechsel, Neustart des Containers) verbindet sich der Browser selbst neu und lädt alle
  Bereiche einmal nach.
- Als Sicherheitsnetz fragen die Bereiche zusätzlich selten selbst nach (Infotafel, Glocke, Zähler alle 2 Minuten,
  offener Chat/Kampf alle 30 Sekunden).

## Reverse Proxy (Nginx Proxy Manager / SWAG)

Die App setzt `trust proxy` (Standard: ein Proxy-Hop), wertet also `X-Forwarded-Proto` und
`X-Forwarded-For` aus. Hinter einem HTTPS-Proxy wird das Login-Cookie automatisch mit `Secure`
gesetzt, und das Rate-Limiting sieht die echte Client-IP.

- **Nginx Proxy Manager:** Proxy Host → Forward Hostname `zauberbuch` (oder Server-IP), Port `8080`,
  „Block Common Exploits“ und SSL aktivieren. Weitere Einstellungen sind nicht nötig – auch nicht für die
  Live-Aktualisierung: Die App schickt dafür den Header `X-Accel-Buffering: no`, sodass nginx diese Verbindung nicht
  puffert, und hält sie mit einem Herzschlag alle 25 s unter dem nginx-Standard-Timeout von 60 s. (Getestet mit
  einem nginx in Standard-Proxy-Konfiguration mit eingeschalteter Pufferung.)
- **SWAG:** Beispiel `/config/nginx/proxy-confs/zauberbuch.subdomain.conf`:

  ```nginx
  server {
      listen 443 ssl;
      listen [::]:443 ssl;
      server_name zauberbuch.*;
      include /config/nginx/ssl.conf;
      client_max_body_size 10m;

      location / {
          include /config/nginx/proxy.conf;
          include /config/nginx/resolver.conf;
          set $upstream_app zauberbuch;
          set $upstream_port 8080;
          set $upstream_proto http;
          proxy_pass $upstream_proto://$upstream_app:$upstream_port;
      }
  }
  ```

Eigene nginx-Konfiguration: Wer die Pufferung oder Timeouts global verändert hat, kann für die Live-Verbindung
optional einen eigenen Block ergänzen (im Nginx Proxy Manager unter Proxy Host → Advanced → Custom Nginx
Configuration):

```nginx
location /api/events {
    proxy_pass http://SERVER-IP:8080;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 1h;
}
```

**FRITZ!Box / DuckDNS:** Für die Live-Aktualisierung ist keine zusätzliche Portfreigabe nötig – sie läuft über
dieselbe HTTPS-Verbindung (Port 443) wie die App. Fällt die Verbindung kurz weg, z. B. bei der täglichen
Zwangstrennung oder einer neuen IP über DuckDNS, verbindet sich der Browser nach wenigen Sekunden selbst neu.

Bei mehreren hintereinandergeschalteten Proxys `TRUST_PROXY` auf die Anzahl der Hops setzen.
Die App ist für den Betrieb unter einer eigenen (Sub-)Domain ausgelegt, nicht unter einem Unterpfad.

## JSON-Importformat

Unter **Verwaltung → Import / Export** können Zauber als JSON importiert werden. Akzeptiert wird
entweder ein **Array von Zaubern** oder ein **Export-Objekt** mit dem Feld `spells` (genau das Format
des JSON-Exports – Export und Import sind also verlustfrei austauschbar). Ältere Dateien ohne
`damageDice`/`damageType` bleiben gültig:

```json
{
  "format": "zauberbuch-spells",
  "version": 1,
  "exportedAt": "2025-01-01T12:00:00.000Z",
  "spells": [
    {
      "slug": "fireball",
      "level": 3,
      "school": "evocation",
      "castingTime": "action",
      "range": "150 ft",
      "components": { "verbal": true, "somatic": true, "material": true },
      "concentration": false,
      "ritual": false,
      "duration": "instantaneous",
      "classes": ["sorcerer", "wizard"],
      "source": "SRD",
      "isHomebrew": false,
      "damageDice": "8d6",
      "damageType": "fire",
      "translations": {
        "de": {
          "name": "Feuerball",
          "castingTimeText": "1 Aktion",
          "rangeText": "45 m",
          "durationText": "Unmittelbar",
          "materialDescription": "Eine winzige Kugel aus Fledermausguano und Schwefel",
          "description": "Ein heller Lichtstreif … **8W6 Feuerschaden** …",
          "higherLevels": "Auf höheren Graden steigt der Schaden um **1W6** je Grad über dem 3."
        },
        "en": {
          "name": "Fireball",
          "description": "A bright streak flashes … **8d6 fire damage** …"
        }
      }
    }
  ]
}
```

### Felder

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `slug` | string | ✔ | Eindeutige ID für die URL; nur `a-z`, `0-9` und `-` (z. B. `magic-missile`). **Dubletten werden über den slug erkannt.** |
| `level` | int | ✔ | `0` = Zaubertrick, `1`–`9` |
| `school` | enum | ✔ | `abjuration` (Bannmagie), `conjuration` (Beschwörung), `divination` (Erkenntniszauber), `evocation` (Hervorrufung), `illusion` (Illusion), `necromancy` (Nekromantie), `transmutation` (Verwandlung), `enchantment` (Verzauberung) |
| `castingTime` | enum | ✔ | Kategorie für den Filter: `action`, `bonus_action`, `reaction`, `longer` |
| `range` | string | ✔ | Sprachunabhängige Reichweite, z. B. `150 ft`, `self`, `touch` (Anzeige-Fallback) |
| `components` | object | ✔ | `{ "verbal": bool, "somatic": bool, "material": bool }` |
| `concentration` | bool | ✔ | Konzentration erforderlich |
| `ritual` | bool | ✔ | Als Ritual wirkbar |
| `duration` | string | ✔ | Sprachunabhängige Dauer, z. B. `instantaneous`, `1 minute` (Anzeige-Fallback) |
| `wikiClasses` | string[] | – | Zusätzliche Zuordnung zu eigenen Wiki-Klassen (IDs) |
| `classes` | enum[] | ✔ | Beliebig viele aus `bard` (Barde), `druid` (Druide), `warlock` (Hexenmeister), `cleric` (Kleriker), `wizard` (Magier), `paladin` (Paladin), `ranger` (Waldläufer), `sorcerer` (Zauberer), `artificer` (Artificer); darf leer sein |
| `source` | string | ✔ | Quelle (Name aus der Quellenliste), z. B. `Spielerhandbuch`, `Homebrew` |
| `isHomebrew` | bool | ✔ | Homebrew-Badge und -Filter; wird beim Speichern aus `source` abgeleitet (`Homebrew` = true) |
| `damageDice` | string \| null | – | Schaden bzw. Heilung als Würfelausdruck: Würfel (`8d6`, auch `8W6`), ganze Zahlen und `mod` (Zauberattributsmodifikator), verbunden mit `+`/`-`, z. B. `1d4+1`, `2d8+1d6`, `1d4+mod`. Wird normalisiert gespeichert (klein, ohne Leerzeichen) und je Sprache angezeigt (DE „1W4 + Mod.“, EN „1d4 + mod“). |
| `damageType` | enum \| null | wenn `damageDice` | `acid` (Säure), `bludgeoning` (Wucht), `cold` (Kälte), `fire` (Feuer), `force` (Energie), `lightning` (Blitz), `necrotic` (Nekrotisch), `piercing` (Stich), `poison` (Gift), `psychic` (Psychisch), `radiant` (Gleißend), `slashing` (Hieb), `thunder` (Schall) oder `healing` (Heilung). `damageDice` und `damageType` werden nur gemeinsam angegeben. |
| `translations.de` / `translations.en` | object \| null | mind. eine | Texte je Sprache (siehe unten) |

Felder je Übersetzung:

| Feld | Pflicht | Beschreibung |
|---|---|---|
| `name` | ✔ | Name des Zaubers |
| `description` | ✔ | Beschreibung in **Markdown** |
| `higherLevels` | – | „Auf höheren Graden“ in Markdown |
| `castingTimeText` | – | Anzeigetext der Zauberzeit, z. B. „1 Aktion“ (sonst die übersetzte Kategorie) |
| `rangeText` | – | Anzeigetext der Reichweite, z. B. „45 m“ (sonst `range`) |
| `durationText` | – | Anzeigetext der Dauer, z. B. „Konzentration, bis zu 1 Minute“ (sonst `duration`) |
| `materialDescription` | wenn `components.material` | Beschreibung der Materialkomponente (in mindestens einer Sprache) |

**Ablauf:** Datei auswählen oder JSON einfügen → *Vorschau erstellen* zeigt je Eintrag den Status
**Neu**, **Dublette** (slug existiert bereits) oder **Ungültig** (mit Fehlermeldungen) → Umgang mit
Dubletten wählen (*Überspringen* oder *Überschreiben*) → *Importieren*. Ungültige Einträge werden nie
importiert; der Import läuft in einer Transaktion. Maximal 5000 Zauber bzw. 10 MB pro Import.

## REST-API

Alle Endpunkte liegen unter `/api` und sprechen JSON. Bis auf `/api/health`, `/api/config` und
`/api/auth/login|logout|me` erfordern alle eine Anmeldung. Fehler haben das Format
`{ "error": { "code": "…", "message": "…", "details": [...] } }` mit passenden Statuscodes
(400 Validierung, 401 nicht angemeldet, 403 keine Berechtigung/CSRF, 404, 409 Konflikt, 429 Rate-Limit).

**CSRF:** Schreibende Anfragen (POST/PUT/PATCH/DELETE) benötigen den Header
`X-Requested-With: zauberbuch`. Das Cookie ist zusätzlich `SameSite=Lax` und `httpOnly`.

| Methode & Pfad | Recht | Beschreibung |
|---|---|---|
| `GET /api/health` | – | Healthcheck (prüft DB-Verbindung) |
| `GET /api/config` | – | `defaultLanguage`, `version` |
| `POST /api/auth/login` | – | `{ identifier, password }` – identifier = Benutzername oder E-Mail |
| `POST /api/auth/logout` | – | Cookie löschen |
| `GET /api/auth/me` | – | Aktueller Benutzer oder `null` |
| `PATCH /api/auth/me` | User | `{ language: "de" \| "en" }` |
| `POST /api/auth/password` | User | `{ currentPassword, newPassword }` – meldet andere Sitzungen ab |
| `GET /api/spells` | User | Suche & Filter, paginiert (siehe unten); `story=<id>` = nur Zauber aus den Quellen der Geschichte |
| `GET /api/spells/sources` | User | Liste aller Quellen |
| `GET /api/spells/:slug` | User | Zauber mit vollständigen Texten |
| `POST /api/spells` | DM/Admin | Zauber anlegen (Body = Importformat eines Zaubers) |
| `PUT /api/spells/:id` | DM/Admin | Zauber aktualisieren |
| `POST /api/spells/:id/duplicate` | DM/Admin | Kopie mit slug `…-copy` anlegen |
| `DELETE /api/spells/:id` | DM/Admin | Zauber löschen |
| `GET /api/spells/export` | Admin | JSON-Export aller Zauber |
| `POST /api/spells/import/preview` | Admin | `{ spells: [...] }` → Status je Eintrag |
| `POST /api/spells/import` | Admin | `{ spells: [...], mode: "skip" \| "overwrite" }` |
| `GET /api/favorites` | User | Eigenes Zauberbuch: `{ spellIds: [...] }` |
| `POST /api/favorites` | User | `{ spellId }` – Zauber ins Zauberbuch aufnehmen |
| `DELETE /api/favorites/:spellId` | User | Zauber aus dem Zauberbuch entfernen |
| `GET /api/spellbooks` | DM/Admin | Alle Benutzer mit Anzahl der Zauber im Zauberbuch |
| `GET /api/spells/names` | User | Alle Zaubernamen (slug, Grad, DE/EN) für Vorschläge; optional `?story=<id>` |
| `GET /api/characters` | User | Eigene Charaktere (Übersicht) |
| `POST /api/characters` | User | `{ name? }` – neuen Charakterbogen anlegen |
| `GET /api/characters/:id` | Besitzer, DM/Admin | Bogen inkl. `data` und `canEdit` |
| `PUT /api/characters/:id` | Besitzer | `{ data }` – kompletten Bogen speichern (wird validiert/bereinigt) |
| `POST /api/characters/:id/duplicate` | Besitzer | Kopie anlegen |
| `DELETE /api/characters/:id` | Besitzer | Charakter löschen |
| `GET /api/characters/all` | DM/Admin | Alle Charaktere mit Besitzer |
| `GET /api/characters/export` | Admin | Alle Charakterbögen als JSON-Datei |
| `POST /api/characters/import/preview` | Admin | `{ characters: [...], fallbackOwnerId? }` → Status je Bogen |
| `POST /api/characters/import` | Admin | `{ characters: [...], fallbackOwnerId?, duplicates: "skip" \| "create" }` |
| `GET /api/stories` · `GET /api/stories/users` | Moderator/Admin | Verwaltung: alle Geschichten mit Rollen bzw. Benutzerliste |
| `POST /api/stories` · `PATCH /api/stories/:id` | Moderator/Admin | `{ name, description?, archived?, members?: [{ userId, role: "player" \| "dm" }] }` |
| `DELETE /api/stories/:id` | Admin | Geschichte samt Beiträgen und Kämpfen löschen |
| `GET /api/stories/mine` · `PUT /api/stories/active` | User | Geschichten zum Umschalten (mit Rolle, Sprachen, Werkzeugen, Göttern, Quellen) bzw. `{ storyId \| null }` (Geschichten-Ansicht) |
| `GET /api/board/stories?archived=true` | User | Sichtbare Geschichten inkl. Mitglieder mit Rolle, eigene Rolle, Beitragszahl, ungelesen |
| `GET /api/board/stories/:id/posts?q=&category=&page=` | Mitspieler, DM/Admin | Beiträge (angeheftete zuerst) inkl. Kommentare |
| `POST /api/board/stories/:id/posts` | Mitspieler, DM/Admin | `{ title?, body, category? }` |
| `PATCH /api/board/posts/:id` · `DELETE /api/board/posts/:id` | Ersteller, DM/Admin | Bearbeiten bzw. in den Papierkorb |
| `POST /api/board/posts/:id/pin` | DM/Admin | `{ pinned }` |
| `PUT /api/board/posts/:id/reaction` | Mitspieler, DM/Admin | Gefällt mir / nicht: `{ value: 1 \| -1 \| 0 }` (0 nimmt zurück); Beiträge liefern `likedBy`, `dislikedBy`, `myReaction` |
| `POST /api/board/posts/:id/comments` · `PATCH`/`DELETE /api/board/comments/:id` | Mitspieler / Ersteller, DM/Admin | Kommentare |
| `GET /api/board/unread` · `POST /api/board/stories/:id/read` | User | Ungelesen-Zähler bzw. als gelesen markieren |
| `GET /api/board/deleted` · `POST /api/board/posts/:id/restore` · `DELETE /api/board/posts/:id/permanent` | Admin | Papierkorb |
| `GET /api/board/export` · `POST /api/board/import` | Admin | Infotafel exportieren/importieren |
| `GET /api/combat/encounters` · `GET /api/combat/encounters/:id` | Mitspieler, DM/Admin | Kämpfe bzw. ein Kampf (verdeckte Monsterwerte nur für DM/Admin) |
| `POST /api/combat/encounters` · `PATCH`/`DELETE /api/combat/encounters/:id` | DM/Admin | `{ storyId, name }` bzw. `{ name?, round?, turnCombatantId?, ended? }` |
| `POST /api/combat/encounters/:id/turn` | DM/Admin | `{ direction: 1 \| -1 }` – nächster/vorheriger Zug |
| `POST /api/combat/encounters/:id/characters` · `/monsters` | DM/Admin | Spielercharaktere bzw. Monster/verbündete NSCs (`allied: true`) hinzufügen |
| `PATCH /api/combat/combatants/:id` · `POST …/hp` · `DELETE …` | DM/Admin | Initiative, Zustände, Monster-/NSC-Werte; `{ delta }` Schaden/Heilung |
| `GET`/`POST /api/bestiary/dm?storyId=` · `GET`/`PUT`/`DELETE /api/bestiary/dm/:id?storyId=` | DM der angegebenen Geschichte | DM-Datenbank (Vorlagen) |
| `GET`/`POST /api/bestiary/stories/:storyId` · `PUT`/`DELETE /api/bestiary/entries/:id` | Mitspieler (DM/Admin nur `GET`) | Spieler-Datenbank je Geschichte |
| `GET /api/combat/encounters/:id/candidates` | DM der Geschichte | Charakterbögen für „Spieler hinzufügen“ |
| `GET/POST /api/characters/:id/notes` · `PUT/DELETE …/notes/:noteId` | Besitzer/Mitbearbeiter (DM: freigegebene lesen) | Persönliche Notizen |
| `PUT /api/auth/me/avatar` · `GET /api/avatars/:userId?v=` | angemeldet | Eigenes Profilbild setzen (`{ avatar: Data-URL \| null }`, PNG/JPEG/WebP, im Browser auf 256 px zugeschnitten) bzw. abrufen |
| `GET /api/events` | angemeldet | Live-Aktualisierung (Server-Sent Events): Ereignis `change` mit `{ type: board \| chat \| combat, storyId }` bzw. `{ type: notifications }` |
| `GET /api/chat/unread` | angemeldet | Ungelesene Chat-Nachrichten (`{ total, byStory }`) |
| `GET /api/chat/stories/:storyId` · `GET …/portraits` | Mitglied der Geschichte | Gesprächspartner mit letzter Nachricht/Ungelesenen, eigene Charaktere, gespeicherte Wahl `speakAs`; Charakterporträts |
| `PUT /api/chat/stories/:storyId/speak-as` | Mitglied der Geschichte | „Schreiben als“ merken (`{ characterId }`, `null` = als Benutzer) |
| `GET`/`POST /api/chat/stories/:storyId/with/:userId` | Mitglied (nur die beiden Beteiligten) | Verlauf (`?since=ISO` für Änderungen, markiert als gelesen) bzw. senden (`{ body, characterId?, dice? }`) |
| `POST /api/chat/stories/:storyId/groups` | Mitglied der Geschichte | Gruppe anlegen (`{ name, memberIds }`, Ersteller ist automatisch dabei) |
| `PUT`/`DELETE /api/chat/groups/:id` · `POST …/leave` | Ersteller (verwaltet) / Gruppenmitglied | Name/Mitglieder ändern bzw. löschen; verlassen |
| `GET`/`POST /api/chat/groups/:id/messages` | Gruppenmitglied | Verlauf (`?since=ISO`, markiert als gelesen) bzw. senden (`{ body, characterId?, dice? }`) |
| `PUT`/`DELETE /api/chat/messages/:id` | Absender | Eigene Nachricht bearbeiten (`{ body }`) bzw. löschen |
| `PUT /api/characters/:id/milestone` | DM der Geschichte | Meilenstein-Aufstieg freigeben (`{ level }` bzw. `{ level: null }`) |
| `GET /api/backup/export` · `POST /api/backup/import` | Admin | Gesamtsicherung (`{ backup, confirm: true }`) |
| `GET /api/sources` · `POST /api/sources` · `PUT`/`DELETE /api/sources/:id` | lesen: angemeldet; schreiben: Moderator/Admin | Quellen (`{ name, abbreviation? }`) |
| `GET /api/wiki` · `POST /api/wiki` · `PUT`/`DELETE /api/wiki/:id` | lesen: angemeldet; schreiben: Moderator/Admin | Wiki (`{ kind: 'race' \| 'class' \| 'feat' \| 'background' \| 'language' \| 'god', name, summary?, description?, data }`) |
| `GET`/`POST /api/dm-notes/stories/:storyId` · `PUT …/order` · `PUT`/`DELETE /api/dm-notes/:id` | DM der Geschichte | DM-Notizen (`{ title, body? }`; Reihenfolge `{ ids }`) |
| `GET /api/catalog?storyId=` | angemeldet | Wirksame Gegenstands-Datenbank (Standard bzw. Geschichte) |
| `POST /api/catalog/standard` · `PUT`/`DELETE /api/catalog/:id` | Moderator/Admin | Standard-Datenbank bzw. eigene Einträge bearbeiten (`{ category, name, description?, weight?, value?, ac?, strength?, damageDice?, damageType? }`) |
| `GET`/`POST /api/catalog/stories/:storyId` · `PUT`/`DELETE …/override/:baseId` · `POST …/hide/:baseId` | Moderator/Admin | Liste einer Geschichte: anpassen, zurücksetzen, ausblenden, eigene Einträge |
| `GET /api/items/stories` · `GET`/`POST /api/items` · `PUT`/`DELETE /api/items/:id` · `PUT /api/items/:id/holders` | Moderator/Admin, alle DMs (Besitzer nur in eigenen Geschichten) | Allgemeine Datenbank (`{ name, description?, weight?, value?, attunement?, storyId?, holderIds? }`; Besitzer `{ storyId, holderIds }`) |
| `GET /api/items/character/:characterId` · `POST /api/items/:id/transfer` | Besitzer/Mitbearbeiter (lesen auch DM) | Gegenstände eines Bogens; `{ fromCharacterId, toCharacterId \| null }` |
| `GET /api/notifications` · `POST /api/notifications/read` · `DELETE /api/notifications` | User | Eigene Benachrichtigungen |
| `GET /api/users` | Admin | Benutzerliste |
| `POST /api/users` | Admin | `{ username, email?, password, role? }` – Benutzer anlegen |
| `GET /api/users/export?passwords=true\|false` | Admin | Alle Benutzer als JSON-Datei |
| `POST /api/users/import/preview` | Admin | `{ users: [...], mode?: "skip" \| "update", defaultPassword? }` → Status je Benutzer |
| `POST /api/users/import` | Admin | wie Vorschau; legt an bzw. aktualisiert |
| `PATCH /api/users/:id` | Admin | `{ role?: "admin" \| "dungeonmaster" \| "user", password? }` (letzter Admin geschützt) |
| `DELETE /api/users/:id` | Admin | Benutzer löschen (nicht sich selbst, nicht den letzten Admin) |

Parameter für `GET /api/spells` (Listen als Komma-Liste, z. B. `level=0,3`):
`query`, `nameOnly=true` (Suchbegriff nur in den Zaubernamen), `level`, `school`, `class`, `castingTime`, `damageType`,
`concentration`, `ritual`, `verbal`, `somatic`,
`material`, `homebrew` (je `true`/`false`), `source`, `favorites=true` (eigenes Zauberbuch),
`owner=<userId>` (Zauberbuch eines Benutzers, nur DM/Admin),
`sort=name|level|school`, `order=asc|desc`, `lang=de|en` (Sortiersprache), `page`, `pageSize` (max. 100).

Beispiel: `GET /api/spells?query=feuer&level=3&class=wizard&sort=level`

## Lokale Entwicklung ohne Docker

Voraussetzung: Node.js ≥ 20 (empfohlen: aktuelle LTS).

```bash
npm install
cp server/.env.example server/.env
npm run prisma:deploy --workspace server     # legt ./data/zauberbuch.db an
npm run dev                                  # Backend :8080 + Vite :5173
```

Dann **http://localhost:5173** öffnen; Vite leitet `/api` an das Backend weiter.
Frontend und Backend lassen sich auch getrennt starten (`npm run dev:server`, `npm run dev:client`).

Schemaänderungen: `server/prisma/schema.prisma` anpassen und
`npm run prisma:migrate --workspace server -- --name beschreibung` ausführen. Die neue Migration unter
`server/prisma/migrations/` committen – sie wird im Container beim nächsten Start automatisch
angewendet (mit vorheriger Sicherung).

Produktions-Build ohne Docker:

```bash
npm run build                                 # Server-Bundle + Frontend
cd server && DATA_DIR=../data DATABASE_URL=file:../../data/zauberbuch.db npm start
```

Der Server liefert das gebaute Frontend aus `client/dist` mit aus.

## Tests

```bash
npm test
```

Die API-Tests (Vitest + Supertest) laufen gegen eine eigene, temporäre SQLite-Datenbank
(`server/tests/.tmp`) und decken Authentifizierung (Login per Name/E-Mail, Logout, CSRF,
Passwortwechsel, keine Selbstregistrierung, Login-Pflicht), Benutzerverwaltung und Rollen
(Admin/Moderator/Benutzer, Rollen pro Geschichte), Suche & Filter (sprachübergreifend, Grad, Klasse, Zauberzeit,
Sortierung, Paginierung), Verwaltung (CRUD, Duplizieren, Import mit Dublettenprüfung, Export) sowie
Zauberbücher (eigene und fremde) sowie Charakterbögen (Rechte, Bereinigung ungültiger Werte, Lesezugriff
für DM/Admin) ab.

```bash
npm run typecheck   # TypeScript-Prüfung aller Pakete
```

## Image bauen & veröffentlichen

**Lokal (amd64):**

```bash
docker build -t zauberbuch:latest --build-arg APP_VERSION=1.0.0 .
```

**arm64 (z. B. Raspberry Pi):** Das Image lässt sich für arm64 bauen, allerdings **nativ auf
einem ARM-Rechner**. Unter QEMU-Emulation (`--platform linux/arm64` auf einem x86-Host) bricht
`prisma generate` ab.

```bash
# auf einem arm64-Host
docker build -t zauberbuch:latest .
```

**GitHub Actions:** `.github/workflows/docker.yml` führt Typecheck und Tests aus und baut das Image
bei jedem Push auf `main` sowie bei Tags `v*.*.*`. Es wird nach `ghcr.io/jndmnk/zauberbuch` gepusht:

| Ereignis | Tags |
|---|---|
| Push auf `main` | `latest`, `sha-<kurz>` |
| Tag `v1.2.3` | `1.2.3`, `1.2`, `1`, `sha-<kurz>` |

Standardmäßig wird nur `linux/amd64` gebaut (das reicht für Unraid). Für ein zusätzliches
`linux/arm64`-Image unter *Settings → Secrets and variables → Actions → Variables* die
Repository-Variable `BUILD_ARM64` mit dem Wert `true` anlegen. arm64 wird dann nativ auf dem
GitHub-Runner `ubuntu-24.04-arm` gebaut, und beide Varianten werden zu einem Multi-Arch-Manifest
zusammengeführt. (Je nach GitHub-Plan sind ARM-Runner für private Repositories ggf. kostenpflichtig.)
Pull Requests werden nur gebaut, nicht gepusht.

Release erstellen:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

Nach dem ersten Push das Paket unter *GitHub → Packages → zauberbuch → Package settings* auf
**Public** stellen, damit Unraid es ohne Login ziehen kann.

## Projektstruktur

```
zauberbuch/
├── shared/                 # gemeinsame Enums, zod-Schemas & Typen (Frontend + Backend)
│   └── src/{enums,schemas,types}.ts
├── server/                 # Express + Prisma (TypeScript, gebündelt mit esbuild)
│   ├── prisma/             # schema.prisma + Migrationen
│   ├── src/
│   │   ├── routes/         # auth, spells, favorites, users
│   │   ├── middleware/     # Auth, Rollen, CSRF
│   │   ├── lib/            # Prisma, JWT/bcrypt, Suche, Logger, Fehler
│   │   ├── app.ts          # Express-App (helmet, trust proxy, statisches Frontend)
│   │   ├── bootstrap.ts    # erster Admin, Beispielzauber
│   │   └── index.ts        # Start
│   └── tests/              # Vitest + Supertest
├── client/                 # React + Vite + Tailwind + react-i18next
│   └── src/
│       ├── components/     # Karten, Detail/Modal, Filter, Header …
│       ├── pages/          # Liste/Mein Zauberbuch, Detail, Login, Konto, admin/*
│       ├── context/        # Auth + Zauberbuch, Theme, Toasts
│       ├── i18n/locales/   # de.json, en.json
│       └── lib/            # API-Client, Filter↔URL, Übersetzungs-Fallback
├── docker/                 # entrypoint.sh (PUID/PGID/UMASK) + start.sh (Backup, Migration)
├── Dockerfile
├── docker-compose.yml
├── zauberbuch.xml          # Unraid-Template
└── .github/workflows/docker.yml
```

## Lizenz & Hinweise

Code unter MIT-Lizenz (siehe `LICENSE`). Die Beispielzauber sind eigene, gekürzte Zusammenfassungen
angelehnt an das *System Reference Document 5.1* von Wizards of the Coast LLC
(CC-BY-4.0, https://creativecommons.org/licenses/by/4.0/). Dungeons & Dragons ist eine Marke von
Wizards of the Coast; dieses Projekt ist nicht offiziell mit Wizards of the Coast verbunden.
