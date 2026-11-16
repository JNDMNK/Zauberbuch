#!/bin/sh
# Startet Zauberbuch: DB-Sicherung (falls Migrationen ausstehen) -> Prisma-Migrationen -> Server.
set -eu

DATA_DIR="${DATA_DIR:-/data}"
BACKUP_DIR="$DATA_DIR/backups"
KEEP_BACKUPS="${KEEP_BACKUPS:-5}"
DB_FILE="${DATABASE_URL#file:}"
SCHEMA="/app/server/prisma/schema.prisma"
PRISMA="/app/node_modules/.bin/prisma"

log() { echo "[start] $*"; }

mkdir -p "$BACKUP_DIR"

backup_db() {
  stamp="$(date +%Y%m%d-%H%M%S)"
  target="$BACKUP_DIR/zauberbuch-$stamp.db"
  if command -v sqlite3 > /dev/null 2>&1 && sqlite3 "$DB_FILE" ".backup '$target'" 2>/dev/null; then
    :
  else
    cp "$DB_FILE" "$target"
    [ -f "$DB_FILE-wal" ] && cp "$DB_FILE-wal" "$target-wal" || true
  fi
  log "Datenbank gesichert: $target"
  # Nur die letzten $KEEP_BACKUPS Sicherungen behalten
  ls -1t "$BACKUP_DIR"/zauberbuch-*.db 2>/dev/null | tail -n +"$((KEEP_BACKUPS + 1))" | while read -r old; do
    rm -f "$old" "$old-wal"
    log "Alte Sicherung entfernt: $old"
  done
}

if [ -f "$DB_FILE" ]; then
  if "$PRISMA" migrate status --schema "$SCHEMA" > /dev/null 2>&1; then
    log "Datenbankschema ist aktuell."
  else
    log "Ausstehende Migrationen erkannt – erstelle Sicherung."
    backup_db
  fi
else
  log "Neue Datenbank wird angelegt: $DB_FILE"
fi

log "Führe Prisma-Migrationen aus …"
"$PRISMA" migrate deploy --schema "$SCHEMA"

cd /app/server
exec node dist/index.js
