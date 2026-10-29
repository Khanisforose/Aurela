#!/usr/bin/env bash
# Installs the nightly Aurela backup cron job (02:30 server time) — idempotent, safe to re-run.
set -euo pipefail
APP_DIR="${AURELA_DIR:-/opt/aurela}"
chmod +x "$APP_DIR/deploy/backup.sh"
mkdir -p "$APP_DIR/backups"
LINE="30 2 * * * $APP_DIR/deploy/backup.sh >> $APP_DIR/backups/cron.log 2>&1  # aurela-backup"
( crontab -l 2>/dev/null | grep -v '# aurela-backup' ; echo "$LINE" ) | crontab -
echo "Installed nightly backup cron:"
crontab -l | grep 'aurela-backup'
echo
echo "Running a first backup now to verify…"
"$APP_DIR/deploy/backup.sh"
echo
ls -lh "$APP_DIR/backups" | tail -n 5
