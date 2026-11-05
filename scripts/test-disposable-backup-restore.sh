#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

# Disposable production-representative recovery rehearsal.
# CI supplies localhost PostgreSQL only. This script never targets production.

source_db="${PGDATABASE:-rupaykg}"
restore_db="rupaykg_recovery_rehearsal"
dump_timeout="${RECOVERY_DUMP_TIMEOUT_SECONDS:-120}"
restore_timeout="${RECOVERY_RESTORE_TIMEOUT_SECONDS:-120}"
query_timeout="${RECOVERY_QUERY_TIMEOUT_SECONDS:-30}"

cleanup() {
  rm -f "${dump_file:-}"
  dropdb --if-exists --host=127.0.0.1 --username=postgres "$restore_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Waiting for disposable PostgreSQL..."
for attempt in {1..30}; do
  if pg_isready --host=127.0.0.1 --port=5432 --username=postgres --dbname="$source_db" >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo "FAIL: disposable PostgreSQL did not become ready within 30 seconds." >&2
    exit 1
  fi
  sleep 1
done

dropdb --if-exists --host=127.0.0.1 --username=postgres "$restore_db" >/dev/null 2>&1 || true
createdb --host=127.0.0.1 --username=postgres "$restore_db"

dump_file="$(mktemp)"

before_count="$(timeout --preserve-status "$query_timeout"s psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 --tuples-only --no-align -c "SELECT count(*) FROM public.schema_migrations")"
before_latest="$(timeout --preserve-status "$query_timeout"s psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 --tuples-only --no-align -c "SELECT coalesce(max(version),'NONE') FROM public.schema_migrations")"

echo "Creating disposable custom-format backup..."
timeout --preserve-status "$dump_timeout"s pg_dump --host=127.0.0.1 --username=postgres --format=custom --file="$dump_file" "$source_db"

echo "Restoring into separate disposable database..."
timeout --preserve-status "$restore_timeout"s pg_restore --host=127.0.0.1 --username=postgres --clean --if-exists --dbname="$restore_db" "$dump_file"

after_count="$(timeout --preserve-status "$query_timeout"s psql "postgresql://postgres:postgres@127.0.0.1:5432/$restore_db" --set=ON_ERROR_STOP=1 --tuples-only --no-align -c "SELECT count(*) FROM public.schema_migrations")"
after_latest="$(timeout --preserve-status "$query_timeout"s psql "postgresql://postgres:postgres@127.0.0.1:5432/$restore_db" --set=ON_ERROR_STOP=1 --tuples-only --no-align -c "SELECT coalesce(max(version),'NONE') FROM public.schema_migrations")"

test "$before_count" = "$after_count"
test "$before_latest" = "$after_latest"

echo "PASS: disposable backup/restore rehearsal preserved schema_migrations count=$after_count latest=$after_latest."
