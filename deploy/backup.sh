#!/usr/bin/env bash
# Nightly database backup, keeping 14 days locally and optionally mirroring
# off-host to S3/R2/Backblaze and pinging a dead-man's-switch heartbeat URL.
#
#   sudo -u postgres /home/ratecoaster/app/deploy/backup.sh
#
# Optional environment variables (set in /home/ratecoaster/app/.env or root cron):
#   BACKUP_S3_URI=s3://my-bucket/ratecoaster-backups   (uses awscli or rclone)
#   BACKUP_HEARTBEAT_URL=https://hc-ping.com/<uuid>
set -euo pipefail

BACKUP_DIR="/var/backups/ratecoaster"
KEEP_DAYS=14
STAMP="$(date +%Y-%m-%d_%H%M)"
DUMP_PATH="$BACKUP_DIR/ratecoaster_${STAMP}.dump"

mkdir -p "$BACKUP_DIR"

# Custom format (-Fc) rather than plain SQL: it compresses, and it lets you
# restore a single table instead of the whole database.
pg_dump -Fc ratecoaster > "$DUMP_PATH"

# Verify the file is non-trivial before trusting it. A zero-byte "backup" that
# nobody checked is the classic way to discover you have no backups at all.
SIZE=$(stat -c%s "$DUMP_PATH")
if [ "$SIZE" -lt 1000 ]; then
  echo "ERROR: backup is only ${SIZE} bytes — something is wrong" >&2
  exit 1
fi

if [ -n "${BACKUP_S3_URI:-}" ]; then
  DEST="${BACKUP_S3_URI%/}/ratecoaster_${STAMP}.dump"
  if command -v aws >/dev/null 2>&1; then
    aws s3 cp "$DUMP_PATH" "$DEST" --only-show-errors
    echo "Uploaded off-host backup to $DEST"
  elif command -v rclone >/dev/null 2>&1; then
    rclone copyto "$DUMP_PATH" "$DEST"
    echo "Uploaded off-host backup to $DEST"
  else
    echo "WARNING: BACKUP_S3_URI is set, but neither aws nor rclone is installed." >&2
    exit 1
  fi
fi

find "$BACKUP_DIR" -name 'ratecoaster_*.dump' -mtime "+$KEEP_DAYS" -delete

if [ -n "${BACKUP_HEARTBEAT_URL:-}" ]; then
  curl -fsS -m 10 --retry 3 "$BACKUP_HEARTBEAT_URL" >/dev/null
fi

echo "Backed up ${SIZE} bytes to $DUMP_PATH"
