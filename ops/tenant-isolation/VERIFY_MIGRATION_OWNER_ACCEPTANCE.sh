#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${MIGRATION_FILE:?MIGRATION_FILE is required}"
test "$MIGRATION_FILE" = "migrations/111_shakti_mrv_provenance_tenant_rls.sql"

# Disposable GitHub Actions PostgreSQL only. Reconstruct the production
# migration-owner and ledger ownership path, then invoke the real application
# migration runner as the restricted LOGIN role.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rupaykg') THEN
    CREATE ROLE rupaykg LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD 'ci-migration-owner-only';
  ELSE
    ALTER ROLE rupaykg LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD 'ci-migration-owner-only';
  END IF;
END
$role$;

-- Reproduce production schema, protected-table and migration-ledger ownership.
ALTER SCHEMA public OWNER TO rupaykg;
ALTER TABLE public.mrv_provenance_events OWNER TO rupaykg;
ALTER TABLE public.schema_migrations OWNER TO rupaykg;

GRANT SELECT ON public.activities, public.evidence, public.verifications TO rupaykg;
GRANT USAGE ON SCHEMA app TO rupaykg;
GRANT SELECT (id, status, suspended_at) ON public.identities TO rupaykg WITH GRANT OPTION;
GRANT EXECUTE ON FUNCTION app.current_organization_id() TO rupaykg;
GRANT EXECUTE ON FUNCTION app.is_verified_org_member(uuid) TO rupaykg;
GRANT rupaykg_ddl TO rupaykg WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;

-- Rewind only migration 111 in this disposable rehearsal so the application
-- runner must execute the protected SQL and write its own ledger row.
DROP POLICY IF EXISTS mrv_provenance_events_tenant_select ON public.mrv_provenance_events;
DROP POLICY IF EXISTS mrv_provenance_events_tenant_insert ON public.mrv_provenance_events;
DROP POLICY IF EXISTS mrv_provenance_events_tenant_update ON public.mrv_provenance_events;
DELETE FROM public.schema_migrations
 WHERE filename = '111_shakti_mrv_provenance_tenant_rls.sql';
SQL

# Verify the actual migration executor can SET ROLE to the controlled DDL owner.
test "$(psql "$DATABASE_URL" -tAc "select pg_has_role('rupaykg', 'rupaykg_ddl', 'SET')")" = "t"
test "$(psql "$DATABASE_URL" -tAc "select pg_get_userbyid(relowner) from pg_class where oid='public.mrv_provenance_events'::regclass")" = "rupaykg"
test "$(psql "$DATABASE_URL" -tAc "select pg_get_userbyid(relowner) from pg_class where oid='public.schema_migrations'::regclass")" = "rupaykg"

# Connect as the real restricted LOGIN role and run apps/src/migrate.ts via the
# same workspace command used operationally. This proves both protected SQL
# execution and the schema_migrations SELECT/INSERT path as that login.
MIGRATION_DATABASE_URL="$(node -e 'const u=new URL(process.env.DATABASE_URL);u.username="rupaykg";u.password="ci-migration-owner-only";process.stdout.write(u.toString())')"
DATABASE_URL="$MIGRATION_DATABASE_URL" \
DATABASE_SSL=false \
RUPAYKG_ALLOW_PROTECTED_SHAKTI_MIGRATIONS=1 \
npm run migrate -w @rupaykg/api

# Assert the exact migration ledger record and the final table owner.
test "$(psql "$DATABASE_URL" -tAc "select count(*) from public.schema_migrations where version='111' and filename='111_shakti_mrv_provenance_tenant_rls.sql'")" = "1"
test "$(psql "$DATABASE_URL" -tAc "select pg_get_userbyid(relowner) from pg_class where oid='public.mrv_provenance_events'::regclass")" = "rupaykg_ddl"

echo "PASS: apps/src/migrate.ts executed migration 111 as LOGIN rupaykg; ledger row 111 committed and provenance owner transferred to rupaykg_ddl."
