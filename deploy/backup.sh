#!/usr/bin/env bash
# Nightly database backup, keeping 14 days.
#   sudo -u postgres /home/ratecoaster/app/deploy/backup.sh
set -euo pipefail

BACKUP_DIR="/var/backups/ratecoaster"
KEEP_DAYS=14
STAMP="$(date +%Y-%m-%d_%H%M)"

mkdir -p "$BACKUP_DIR"

# Custom format (-Fc) rather than plain SQL: it compresses, and it lets you
# restore a single table instead of the whole database.
pg_dump -Fc ratecoaster > "$BACKUP_DIR/ratecoaster_$STAMP.dump"

# Verify the file is non-trivial before trusting it. A zero-byte "backup" that
# nobody checked is the classic way to discover you have no backups at all.
SIZE=$(stat -c%s "$BACKUP_DIR/ratecoaster_$STAMP.dump")
if [ "$SIZE" -lt 1000 ]; then
  echo "ERROR: backup is only ${SIZE} bytes — something is wrong" >&2
  exit 1
fi

find "$BACKUP_DIR" -name 'ratecoaster_*.dump' -mtime "+$KEEP_DAYS" -delete

echo "Backed up ${SIZE} bytes to $BACKUP_DIR/ratecoaster_$STAMP.dump"
