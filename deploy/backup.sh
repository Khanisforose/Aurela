#!/usr/bin/env bash
# Aurela — nightly MongoDB backup (local VPS folder, 30-day rotation)
# Usage:  /opt/aurela/deploy/backup.sh            (run manually or from cron)
# Restore: see deploy/README.md → "Restore a backup"
set -euo pipefail

APP_DIR="${AURELA_DIR:-/opt/aurela}"
BACKUP_DIR="${AURELA_BACKUP_DIR:-/opt/aurela/backups}"
KEEP_DAYS="${AURELA_BACKUP_KEEP_DAYS:-30}"
STAMP="$(date +%F_%H%M)"
OUT="$BACKUP_DIR/aurela-$STAMP.archive.gz"
LOG="$BACKUP_DIR/backup.log"

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

echo "[$(date -Is)] starting backup → $OUT" | tee -a "$LOG"

# Stream a gzipped archive of ALL databases out of the running mongo container.
# -T disables the TTY so stdout is a clean binary stream.
if docker compose exec -T mongo mongodump --archive --gzip --quiet > "$OUT.tmp"; then
  mv "$OUT.tmp" "$OUT"
  SIZE=$(du -h "$OUT" | cut -f1)
  echo "[$(date -Is)] backup OK ($SIZE)" | tee -a "$LOG"
else
  rm -f "$OUT.tmp"
  echo "[$(date -Is)] backup FAILED" | tee -a "$LOG"
  exit 1
fi

# Rotate: delete archives older than KEEP_DAYS
find "$BACKUP_DIR" -name 'aurela-*.archive.gz' -type f -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/[rotate] removed /' | tee -a "$LOG" || true

# Optional remote upload hook (enable later): set AURELA_RCLONE_REMOTE="myremote:aurela-backups" in /etc/environment
# and install rclone (https://rclone.org/install/). Nothing happens if the variable is unset.
if [ -n "${AURELA_RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  if rclone copy "$OUT" "$AURELA_RCLONE_REMOTE" --quiet; then
    echo "[$(date -Is)] uploaded to $AURELA_RCLONE_REMOTE" | tee -a "$LOG"
  else
    echo "[$(date -Is)] remote upload FAILED (local copy kept)" | tee -a "$LOG"
  fi
fi

echo "[$(date -Is)] done" | tee -a "$LOG"
