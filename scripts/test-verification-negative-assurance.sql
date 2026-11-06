-- Shakti verification authorization negative/immutability assurance.
-- Disposable rehearsal only. No production migration or mutation.
\set ON_ERROR_STOP on
BEGIN;
\set KEEP_CONVERGENCE true

\i scripts/test-verification-convergence.sql

DO $assert$
DECLARE
  v_def text;
  v_owner text;
  v_config text[];
BEGIN
  SELECT pg_get_functiondef(p.oid), pg_get_userbyid(p.proowner), p.proconfig
    INTO v_def, v_owner, v_config
    FROM pg_proc p
   WHERE p.oid='public.enforce_verification_authorization()'::regprocedure;

  IF v_def IS NULL THEN RAISE EXCEPTION 'canonical verification guard is absent'; END IF;
  IF v_owner <> 'rupaykg_verification_guard' THEN RAISE EXCEPTION 'verification guard owner is %',v_owner; END IF;
  IF v_config <> ARRAY['search_path=pg_catalog']::text[] THEN RAISE EXCEPTION 'unsafe verification guard search_path'; END IF;

  -- Tenant binding must be explicit and transitive to the activity organization.
  IF position('m.organization_id=activity_organization_id' in replace(lower(v_def),' ','')) = 0 THEN
    RAISE EXCEPTION 'membership is not explicitly bound to the activity organization';
  END IF;
  IF position('r.organization_id=m.organization_id' in replace(lower(v_def),' ','')) = 0 THEN
    RAISE EXCEPTION 'role is not explicitly bound to the membership organization';
  END IF;
  IF position('m.organization_id=activity_organization_id' in replace(lower(v_def),' ','')) = 0
     OR position('r.organization_id=m.organization_id' in replace(lower(v_def),' ','')) = 0 THEN
    RAISE EXCEPTION 'tenant binding chain is incomplete';
  END IF;

  -- Explicit permission keys are the only authority.
  IF position('VERIFY_EVIDENCE' in v_def) = 0
     OR position('verification:approve' in v_def) = 0
     OR position('verification.approve' in v_def) = 0 THEN
    RAISE EXCEPTION 'explicit verifier permission keys are missing';
  END IF;
  IF upper(v_def) ~ 'ROLE_NAME|CURRENT_USER|SESSION_USER|R\.NAME' THEN
    RAISE EXCEPTION 'role-name/current-user authorization fallback detected';
  END IF;

  -- Fail-closed identity/org/geography conditions.
  IF position($needle$i.status='VERIFIED'$needle$ in lower(v_def)) = 0
     OR position($needle$o.status='VERIFIED'$needle$ in lower(v_def)) = 0
     OR position($needle$m.status='VERIFIED'$needle$ in lower(v_def)) = 0 THEN
    RAISE EXCEPTION 'verified identity/organization/membership checks are incomplete';
  END IF;
  IF position('i.suspended_at IS NULL' in v_def) = 0 THEN
    RAISE EXCEPTION 'identity suspension fail-closed check missing';
  END IF;
  IF position('activity_geography_id IS NULL OR NOT public.organization_has_geography_scope' in v_def) = 0 THEN
    RAISE EXCEPTION 'geography fail-closed check missing';
  END IF;

  -- Decision-time provenance must be server-derived.
  IF position('NEW.authorization_membership_id := membership_row.membership_id' in v_def) = 0
     OR position('NEW.authorization_role_id := membership_row.role_id' in v_def) = 0
     OR position('NEW.authorization_permissions_snapshot := membership_row.permissions' in v_def) = 0
     OR position('NEW.authorization_checked_at := clock_timestamp()' in v_def) = 0 THEN
    RAISE EXCEPTION 'immutable decision-time authorization provenance is incomplete';
  END IF;

  IF position('verification records are immutable' in lower(v_def)) = 0 THEN
    RAISE EXCEPTION 'verification UPDATE immutability guard missing';
  END IF;

  -- Exactly one authoritative verification decision trigger in the rehearsal.
  IF (SELECT count(*) FROM pg_trigger
       WHERE tgrelid='public.verifications'::regclass
         AND NOT tgisinternal
         AND tgname='verification_authorization_guard') <> 1 THEN
    RAISE EXCEPTION 'canonical verification authorization trigger is not uniquely installed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid='public.verifications'::regclass
       AND NOT tgisinternal
       AND tgname IN ('verification_independence_guard','verifications_integrity_guard')
  ) THEN
    RAISE EXCEPTION 'legacy competing verification trigger remains';
  END IF;

  -- Append-only controls.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid='public.verifications'::regclass
       AND NOT tgisinternal
       AND tgname='verification_delete_guard'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid='public.verifications'::regclass
       AND NOT tgisinternal
       AND tgname='verification_truncate_guard'
  ) THEN
    RAISE EXCEPTION 'append-only DELETE/TRUNCATE guards are incomplete';
  END IF;
END
$assert$;

ROLLBACK;
