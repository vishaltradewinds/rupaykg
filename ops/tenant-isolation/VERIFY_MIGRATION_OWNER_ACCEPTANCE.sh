#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${MIGRATION_FILE:?MIGRATION_FILE is required}"

# This runs only in the disposable GitHub Actions PostgreSQL service.
# Rebuild the exact documented migration-owner preconditions after the normal
# superuser migration suite, then execute migration 101 as a real LOGIN role.
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

-- Reproduce production ownership and the minimum grant path in this disposable DB.
ALTER SCHEMA public OWNER TO rupaykg;
ALTER TABLE public.mrv_provenance_events OWNER TO rupaykg;
GRANT SELECT ON public.activities, public.evidence, public.verifications TO rupaykg;
GRANT USAGE ON SCHEMA app TO rupaykg;
GRANT SELECT (id, status, suspended_at) ON public.identities TO rupaykg WITH GRANT OPTION;
GRANT EXECUTE ON FUNCTION app.current_organization_id() TO rupaykg;
GRANT EXECUTE ON FUNCTION app.is_verified_org_member(uuid) TO rupaykg;
GRANT rupaykg_ddl TO rupaykg WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;

DROP POLICY IF EXISTS mrv_provenance_events_tenant_select ON public.mrv_provenance_events;
DROP POLICY IF EXISTS mrv_provenance_events_tenant_insert ON public.mrv_provenance_events;
DROP POLICY IF EXISTS mrv_provenance_events_tenant_update ON public.mrv_provenance_events;
SQL

# Assert the exact SET privilege through catalog semantics before execution.
test "$(psql "$DATABASE_URL" -tAc "select pg_has_role('rupaykg', 'rupaykg_ddl', 'SET')")" = "t"
test "$(psql "$DATABASE_URL" -tAc "select pg_get_userbyid(relowner) from pg_class where oid='public.mrv_provenance_events'::regclass")" = "rupaykg"

# Use a real connection as the non-superuser migration owner, not SET ROLE from
# postgres. The production migration SQL is executed unchanged.
MIGRATION_DATABASE_URL="$(node -e 'const u=new URL(process.env.DATABASE_URL);u.username="rupaykg";u.password="ci-migration-owner-only";process.stdout.write(u.toString())')"
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_FILE"

test "$(psql "$DATABASE_URL" -tAc "select pg_get_userbyid(relowner) from pg_class where oid='public.mrv_provenance_events'::regclass")" = "rupaykg_ddl"
echo "PASS: migration 101 executed as LOGIN rupaykg with verified SET TRUE membership; provenance owner is rupaykg_ddl."
