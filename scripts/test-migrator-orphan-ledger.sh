#!/usr/bin/env bash
set -euo pipefail

: "${RUPAYKG_MIGRATOR_DATABASE_URL:?CI migrator URL is required}"
: "${RUPAYKG_MIGRATOR_DATABASE_SSL:?CI migrator SSL mode is required}"

# This runs only against the disposable GitHub Actions PostgreSQL service.
# Simulate a historical ledger row whose original source is archived outside
# migrations/. The runner must stop before applying any pending migration.
psql "$RUPAYKG_MIGRATOR_DATABASE_URL" --set=ON_ERROR_STOP=1 <<'SQL'
insert into schema_migrations(version, filename)
values ('096', '096_verification_authorization_provenance.sql')
on conflict (version) do update
set filename = excluded.filename;
SQL

set +e
output="$(
  RUPAYKG_MIGRATOR_DATABASE_URL="$RUPAYKG_MIGRATOR_DATABASE_URL" \
  RUPAYKG_MIGRATOR_DATABASE_SSL="$RUPAYKG_MIGRATOR_DATABASE_SSL" \
  NODE_ENV=test npm run migrate -w @rupaykg/api 2>&1
)"
status=$?
set -e

if [[ "$status" -eq 0 ]]; then
  echo "Expected migration runner to reject an orphaned ledger version, but it succeeded." >&2
  exit 1
fi

if ! grep -Fq "096 (096_verification_authorization_provenance.sql)" <<<"$output"; then
  echo "Migration runner failed for an unexpected reason; orphan diagnostic not found." >&2
  printf '%s\n' "$output" >&2
  exit 1
fi

echo "Verified migration runner fails closed on archived/orphaned ledger version 096."
