#!/usr/bin/env bash
# PostgreSQL backup script for OpenWA
# Dumps the remote database via Docker, rotates old backups.
set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

DB_HOST="${DATABASE_HOST:-postgresql-devperso.alwaysdata.net}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-devperso_openwa}"
DB_USER="${DATABASE_USERNAME:-devperso}"
DB_PASS="${DATABASE_PASSWORD:-}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="openwa_${TIMESTAMP}.sql.gz"
DEST="${BACKUP_DIR}/${FILENAME}"

echo "[$(date -Iseconds)] Starting backup → ${DEST}"

PGPASSWORD="$DB_PASS" docker run --rm \
  -e PGPASSWORD="$DB_PASS" \
  postgres:17-alpine \
  pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --no-password \
    --format=plain \
    --no-owner \
    --no-acl \
    "$DB_NAME" \
  | gzip > "$DEST"

SIZE=$(du -sh "$DEST" | cut -f1)
echo "[$(date -Iseconds)] Backup complete: ${FILENAME} (${SIZE})"

# Rotate: delete backups older than KEEP_DAYS
find "$BACKUP_DIR" -name "openwa_*.sql.gz" -mtime +"$KEEP_DAYS" -print -delete \
  | while read -r f; do echo "[$(date -Iseconds)] Deleted old backup: $f"; done

echo "[$(date -Iseconds)] Done. Backups retained: $(find "$BACKUP_DIR" -name "openwa_*.sql.gz" | wc -l)"
