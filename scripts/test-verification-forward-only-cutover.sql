-- Shakti P0 #214/#215 forward-only verification cutover rehearsal.
-- Disposable PostgreSQL only. This is NOT a production migration and MUST NOT
-- be executed against the live production database.
\set ON_ERROR_STOP on

BEGIN;

-- Preconditions model the live production divergence discovered by read-only
-- reconciliation. The historical 096 columns must already exist; this rehearsal
-- does not replay 096.
DO $pre$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='verifications'
      AND column_name='authorization_membership_id'
  ) THEN RAISE EXCEPTION 'P0 #214 precondition failed: historical 096 authorization_membership_id is absent'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='verifications'
      AND column_name='authorization_role_id'
  ) THEN RAISE EXCEPTION 'P0 #214 precondition failed: historical 096 authorization_role_id is absent'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='verifications'
      AND column_name='authorization_permissions_snapshot'
  ) THEN RAISE EXCEPTION 'P0 #214 precondition failed: historical 096 authorization_permissions_snapshot is absent'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='verifications'
      AND column_name='authorization_checked_at'
  ) THEN RAISE EXCEPTION 'P0 #214 precondition failed: historical 096 authorization_checked_at is absent'; END IF;
END
$pre$;

-- Apply the already-reviewed canonical convergence only in this disposable
-- transaction. No numbered migration is replayed and no production object is
-- changed.
\set KEEP_CONVERGENCE true
\i scripts/test-verification-convergence.sql

-- Forward-only post-cutover assertions.
DO $assert$
DECLARE
  v_count integer;
  v_legacy integer;
  v_owner text;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_trigger
  WHERE tgrelid='public.verifications'::regclass AND NOT tgisinternal;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'forward-only cutover must leave exactly 3 authoritative verification triggers; found %',v_count;
  END IF;

  SELECT count(*) INTO v_legacy
  FROM pg_trigger
  WHERE tgrelid='public.verifications'::regclass
    AND NOT tgisinternal
    AND tgname IN ('verification_independence_guard','verifications_integrity_guard');
  IF v_legacy <> 0 THEN
    RAISE EXCEPTION 'legacy competing verification triggers remain after cutover';
  END IF;

  SELECT pg_get_userbyid(p.proowner) INTO v_owner
  FROM pg_proc p
  WHERE p.oid='public.enforce_verification_authorization()'::regprocedure;
  IF v_owner <> 'rupaykg_verification_guard' THEN
    RAISE EXCEPTION 'canonical verification guard is not owned by rupaykg_verification_guard';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_auth_context_owner') THEN
    RAISE EXCEPTION 'competing rupaykg_auth_context_owner remains after cutover';
  END IF;
END
$assert$;

ROLLBACK;
