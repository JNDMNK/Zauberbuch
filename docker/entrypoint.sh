#!/bin/sh
# Zauberbuch Entrypoint (läuft als root):
# passt den internen Benutzer an PUID/PGID an (Unraid: 99/100), setzt UMASK und die Rechte
# auf /data und startet danach die App als dieser Nicht-Root-Benutzer (su-exec).
set -eu

PUID="${PUID:-99}"
PGID="${PGID:-100}"
UMASK="${UMASK:-022}"
DATA_DIR="${DATA_DIR:-/data}"

log() { echo "[entrypoint] $*"; }

case "$PUID" in ''|*[!0-9]*) log "Ungültige PUID '$PUID'"; exit 1 ;; esac
case "$PGID" in ''|*[!0-9]*) log "Ungültige PGID '$PGID'"; exit 1 ;; esac

# Zeitzone
if [ -n "${TZ:-}" ] && [ -f "/usr/share/zoneinfo/$TZ" ]; then
  ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime
  echo "$TZ" > /etc/timezone
fi

umask "$UMASK"

if [ "$(id -u)" = "0" ]; then
  # Gruppe mit PGID finden oder anlegen
  GROUP_NAME="$(getent group "$PGID" | cut -d: -f1 || true)"
  if [ -z "$GROUP_NAME" ]; then
    GROUP_NAME="zauberbuch"
    if getent group "$GROUP_NAME" > /dev/null 2>&1; then delgroup "$GROUP_NAME" 2>/dev/null || true; fi
    addgroup -g "$PGID" "$GROUP_NAME"
  fi

  # Benutzer mit PUID finden oder anlegen
  USER_NAME="$(getent passwd "$PUID" | cut -d: -f1 || true)"
  if [ -z "$USER_NAME" ]; then
    USER_NAME="zauberbuch"
    if getent passwd "$USER_NAME" > /dev/null 2>&1; then deluser "$USER_NAME" 2>/dev/null || true; fi
    adduser -D -H -h /tmp -s /sbin/nologin -u "$PUID" -G "$GROUP_NAME" "$USER_NAME"
  else
    addgroup "$USER_NAME" "$GROUP_NAME" 2>/dev/null || true
  fi

  mkdir -p "$DATA_DIR" "$DATA_DIR/backups" "$DATA_DIR/logs" "$DATA_DIR/uploads"
  # Nur Dateien mit abweichendem Besitzer anpassen (schnell auch bei vielen Dateien)
  find "$DATA_DIR" \( ! -user "$PUID" -o ! -group "$PGID" \) -exec chown "$PUID:$PGID" {} + 2>/dev/null || \
    log "Warnung: Besitzer von $DATA_DIR konnte nicht vollständig angepasst werden"
  chmod 750 "$DATA_DIR" 2>/dev/null || true

  log "Starte als $USER_NAME (uid=$PUID, gid=$PGID, umask=$UMASK, TZ=${TZ:-UTC})"
  export HOME=/tmp
  exec su-exec "$PUID:$PGID" "$@"
fi

# Container wurde bereits als Nicht-Root gestartet (z. B. --user) – Rechte nicht änderbar
log "Läuft bereits als uid=$(id -u); PUID/PGID werden ignoriert"
mkdir -p "$DATA_DIR/backups" "$DATA_DIR/logs" "$DATA_DIR/uploads"
exec "$@"
