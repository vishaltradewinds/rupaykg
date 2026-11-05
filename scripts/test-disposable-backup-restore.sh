#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

# Disposable production-representative recovery rehearsal.
# This script never targets production: the CI workflow supplies localhost
# PostgreSQL and a disposable restore database. It proves that a migrated
# database can be dumped, restored, and re-verified before release planning.

source_db="${PGDATABASE:-rupaykg}"
restore_db="rupaykg_recovery_rehearsal"

dropdb --if-exists --host=127.0.0.1 --username=postgres "$restore_db" >/dev/null 2>&1 || true
createdb --host=127.0.0.1 --username=postgres "$restore_db"

dump_file="$(mktemp)"
trap 'rm -f "$dump_file"; dropdb --if-exists --host=127.0.0.1 --username=postgres "$restore_db" >/dev/null 2>&1 || true' EXIT

before_count="$(psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 --tuples-only --no-align -c "SELECT count(*) FROM public.schema_migrations")"
before_latest="$(psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 --tuples-only --no-align -c "SELECT coalesce(max(version),'NONE') FROM public.schema_migrations")"

pg_dump --host=127.0.0.1 --username=postgres --format=custom --file="$dump_file" "$source_db"
pg_restore --host=127.0.0.1 --username=postgres --clean --if-exists --dbname="$restore_db" "$dump_file"

after_count="$(psql "postgresql://postgres:postgres@127.0.0.1:5432/$restore_db" --set=ON_ERROR_STOP=1 --tuples-only --no-align -c "SELECT count(*) FROM public.schema_migrations")"
after_latest="$(psql "postgresql://postgres:postgres@127.0.0.1:5432/$restore_db" --set=ON_ERROR_STOP=1 --tuples-only --no-align -c "SELECT coalesce(max(version),'NONE') FROM public.schema_migrations")"

test "$before_count" = "$after_count"
test "$before_latest" = "$after_latest"

echo "PASS: disposable backup/restore rehearsal preserved schema_migrations count=$after_count latest=$after_latest."
