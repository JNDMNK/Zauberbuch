# 📖 Zauberbuch – DnD 5e Spell Library

Eine selbst gehostete Bibliothek für D&D-5e-Zauber: durchsuchen, filtern, als Fantasy-Karten ansehen
und im eigenen **Zauberbuch** sammeln. Zauber (inkl. Homebrew) werden zweisprachig (DE/EN) über eine
Verwaltungsoberfläche gepflegt. Die App ist nur nach Anmeldung nutzbar; Benutzer legt der Admin an. Läuft als einzelner Docker-Container – optimiert für **Unraid**.

- 🔎 Live-Suche über Name und Beschreibung, **sprachübergreifend** („Feuerball“ findet auch „Fireball“)
- 🎚️ Filter: Grad (Mehrfachauswahl), Schule, Klasse, Schadensart, Konzentration, Ritual, Komponenten, Zauberzeit,
  Quelle/Homebrew, nur Mein Zauberbuch – Sortierung nach Name, Grad, Schule; Filter stehen in der URL
- 🃏 Responsives Karten-Grid im Pergament-Stil, Akzentfarbe je Schule, Schaden/Heilung direkt auf der Karte
  (z. B. „8W6 Feuer“), Detail als Modal **und** unter `/spells/:slug`
- 📕 „Mein Zauberbuch“: persönliche Sammlung pro Benutzer (Herz auf der Karte, serverseitig gespeichert,
  optimistisches UI-Update) mit denselben Such- und Filterfunktionen
- 📜 **Charakterbogen**: beliebig viele Charaktere pro Benutzer im Aufbau des D&D-5e-Bogens (Charakter,
  Merkmale & Inventar, Hintergrund, Zauber) mit automatischer Berechnung, Autospeichern, Porträt/Symbol
  und Verknüpfung der Zauber mit der Bibliothek
- 👥 Rollen **Benutzer**, **Dungeon Master** und **Admin** (siehe [Rollen & Benutzer](#rollen--benutzer))
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
4. [Umgebungsvariablen](#umgebungsvariablen)
5. [Daten, Backup & Wiederherstellung](#daten-backup--wiederherstellung)
6. [Reverse Proxy](#reverse-proxy-nginx-proxy-manager--swag)
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

## Rollen & Benutzer

Ohne Anmeldung sind keine Daten sichtbar – weder in der Oberfläche noch über die API. Eine
Selbstregistrierung gibt es nicht: Benutzer legt der Admin unter **Verwaltung → Benutzer → Neuer Benutzer**
an (Benutzername, optional E-Mail, Passwort, Rolle). Dort kann er auch Rollen ändern, Passwörter neu
setzen (der Benutzer wird dabei auf allen Geräten abgemeldet) und Benutzer löschen.

| Recht | Benutzer | Dungeon Master | Admin |
|---|:---:|:---:|:---:|
| Zauber suchen, filtern, ansehen | ✔ | ✔ | ✔ |
| Eigenes Zauberbuch („Mein Zauberbuch“) führen | ✔ | ✔ | ✔ |
| Zauber anlegen, bearbeiten, duplizieren, löschen | – | ✔ | ✔ |
| Zauberbücher aller Benutzer ansehen | – | ✔ | ✔ |
| Eigene Charakterbögen anlegen und bearbeiten | ✔ | ✔ | ✔ |
| Charakterbögen aller Benutzer ansehen (nur lesen) | – | ✔ | ✔ |
| JSON-Import und -Export (Zauber, Benutzer, Charakterbögen) | – | – | ✔ |
| Benutzer anlegen, Rollen ändern, Passwörter setzen, löschen | – | – | ✔ |

Der erste Admin wird beim Start aus `ADMIN_USERNAME`/`ADMIN_PASSWORD` angelegt. Der letzte Admin
kann weder herabgestuft noch gelöscht werden.

## Charakterbogen

Unter **Charakterbogen** legt jeder Benutzer beliebig viele Charaktere an (bis zu 50). Der Bogen ist wie der
D&D-5e-Charakterbogen in vier Reiter gegliedert:

| Reiter | Inhalt |
|---|---|
| **Charakter** | Klasse & Stufe, Hintergrund, Volk, EP · Attribute · Inspiration, Übungsbonus · Rettungswürfe und Fertigkeiten (Kreis anklicken: nicht geübt → geübt → Expertise) · RK, Initiative, Bewegungsrate · Trefferpunkte, Trefferwürfel, Todesrettungswürfe · Angriffe · Persönlichkeit · Übungen & Sprachen · Klassenmerkmale |
| **Merkmale & Inventar** | Volksmerkmale, Sinne, Lebensstil, Hoch-/Weitsprung, Feinde, weitere Merkmale · Inventar mit Teilgewicht, eingestimmte Gegenstände, Münzen, Traglast |
| **Hintergrund** | Alter, Glaube, Größe, Gewicht, Gesinnung, Aussehen … · Porträt und Symbol (Bild-Upload) · Verbündete, Aussehen, Hintergrundgeschichte, zusätzliche Ausrüstung, Werdegang |
| **Zauber** | Zauberwirkende Klasse und Attribut · Zauberplätze je Grad (verbrauchte Plätze anklickbar, „lange Rast“ setzt zurück) · Zauberlisten mit „vorbereitet“, Namensvorschlägen aus der Bibliothek, Link zur Zauberbeschreibung und Übernahme aus „Mein Zauberbuch“ |

**Automatisch berechnet** werden die benötigten Erfahrungspunkte für die nächste Stufe (laut Spielerhandbuch;
reichen die EP für einen Stufenaufstieg, bietet der Bogen an, die Stufe zu erhöhen), Attributsmodifikatoren,
Übungsbonus (aus der Gesamtstufe, überschreibbar),
Rettungswürfe, Fertigkeiten, passive Wahrnehmung, Initiative, Angriffsbonus, Zauber-Rettungswurf-SG und
-Angriffsbonus, Sprungweiten, Gewichte (50 Münzen = 1 lb) und Traglastgrenzen.

Änderungen werden automatisch gespeichert (kurz nach der letzten Eingabe sowie beim Verlassen der Seite).
Bilder werden im Browser verkleinert und mit dem Bogen gespeichert. Admin und Dungeon Master sehen alle
Bögen unter **Verwaltung → Charakterbögen** – nur lesend. Der Bogen lässt sich über das Drucker-Symbol drucken.

### Export & Import der Benutzer (Admin)

Unter **Verwaltung → Import / Export → Benutzer** exportiert der Admin alle Benutzer mit E-Mail, Rolle,
Sprache und „Mein Zauberbuch“ (als Zauber-Slugs). Optional – und standardmäßig – werden die **verschlüsselten
Passwörter** (bcrypt-Hashes) mitexportiert, sodass sich nach einem Import alle mit ihrem bisherigen Passwort
anmelden können. Die Datei ist daher vertraulich zu behandeln.

Beim Import zeigt eine Vorschau jeden Benutzer mit Status. Vorhandene Benutzer (gleicher Benutzername) werden
übersprungen oder auf Wunsch aktualisiert (E-Mail, Rolle, Sprache, Passwort; Zauberbuch wird ergänzt). Das
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

**Umzug oder Wiederherstellung per Export:** Unter **Verwaltung → Import / Export** exportiert der Admin
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

## Reverse Proxy (Nginx Proxy Manager / SWAG)

Die App setzt `trust proxy` (Standard: ein Proxy-Hop), wertet also `X-Forwarded-Proto` und
`X-Forwarded-For` aus. Hinter einem HTTPS-Proxy wird das Login-Cookie automatisch mit `Secure`
gesetzt, und das Rate-Limiting sieht die echte Client-IP.

- **Nginx Proxy Manager:** Proxy Host → Forward Hostname `zauberbuch` (oder Server-IP), Port `8080`,
  „Block Common Exploits“ und SSL aktivieren. Weitere Einstellungen sind nicht nötig.
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
| `classes` | enum[] | ✔ | Beliebig viele aus `bard` (Barde), `druid` (Druide), `warlock` (Hexenmeister), `cleric` (Kleriker), `wizard` (Magier), `paladin` (Paladin), `ranger` (Waldläufer), `sorcerer` (Zauberer), `artificer` (Artificer); darf leer sein |
| `source` | string | ✔ | Quelle, z. B. `SRD`, `PHB`, `Homebrew` |
| `isHomebrew` | bool | ✔ | Homebrew-Badge und -Filter |
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
| `GET /api/spells` | User | Suche & Filter, paginiert (siehe unten) |
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
| `GET /api/spells/names` | User | Alle Zaubernamen (slug, Grad, DE/EN) für Vorschläge |
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
| `GET /api/users` | Admin | Benutzerliste |
| `POST /api/users` | Admin | `{ username, email?, password, role? }` – Benutzer anlegen |
| `GET /api/users/export?passwords=true\|false` | Admin | Alle Benutzer als JSON-Datei |
| `POST /api/users/import/preview` | Admin | `{ users: [...], mode?: "skip" \| "update", defaultPassword? }` → Status je Benutzer |
| `POST /api/users/import` | Admin | wie Vorschau; legt an bzw. aktualisiert |
| `PATCH /api/users/:id` | Admin | `{ role?: "admin" \| "dungeonmaster" \| "user", password? }` (letzter Admin geschützt) |
| `DELETE /api/users/:id` | Admin | Benutzer löschen (nicht sich selbst, nicht den letzten Admin) |

Parameter für `GET /api/spells` (Listen als Komma-Liste, z. B. `level=0,3`):
`query`, `level`, `school`, `class`, `castingTime`, `damageType`, `concentration`, `ritual`, `verbal`, `somatic`,
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
(Admin/Dungeon Master/Benutzer), Suche & Filter (sprachübergreifend, Grad, Klasse, Zauberzeit,
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
