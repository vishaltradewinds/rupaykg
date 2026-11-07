-- Shakti Batch E disposable policy contract.
-- Structural safety contract only; runs against disposable CI PostgreSQL.
-- It intentionally does not mutate production and does not certify runtime behavior.

DO $$
DECLARE
  t text;
  required_tables text[] := ARRAY[
    'organization_memberships','roles','platform_access_change_requests',
    'audit_events','cpcb_swm_status_history',
    'bwg_waste_reports','chain_of_custody_links','credentials',
    'epr_credit_allocations','epr_credit_transfers','epr_credits',
    'registry_events','settlements','settlement_events'
  ];
BEGIN
  FOREACH t IN ARRAY required_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'Batch E required table is missing: public.%', t;
    END IF;
  END LOOP;
END $$;

-- Authorization surfaces must retain authoritative organization/membership
-- columns rather than relying on role/session-name identity.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='organization_memberships'
      AND column_name='organization_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='organization_memberships'
      AND column_name='identity_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='organization_memberships'
      AND column_name='status'
  ) THEN
    RAISE EXCEPTION 'organization_memberships lacks required authorization columns';
  END IF;
END $$;

-- Audit controls must carry actor/organization provenance.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='audit_events'
      AND column_name='organization_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='audit_events'
      AND column_name='actor_identity_id'
  ) THEN
    RAISE EXCEPTION 'audit_events lacks required provenance columns';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cpcb_swm_status_history'
      AND column_name='organization_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cpcb_swm_status_history'
      AND column_name='actor_identity_id'
  ) THEN
    RAISE EXCEPTION 'cpcb_swm_status_history lacks required provenance columns';
  END IF;
END $$;

-- Multi-party surfaces must not be protected by a blanket organization-only
-- policy that ignores the authoritative participant/counterparty relationship.
DO $$
DECLARE
  t text;
  policy_count integer;
  multi_party text[] := ARRAY[
    'bwg_waste_reports','chain_of_custody_links','credentials',
    'epr_credit_allocations','epr_credit_transfers','epr_credits',
    'registry_events','settlements','settlement_events'
  ];
BEGIN
  FOREACH t IN ARRAY multi_party LOOP
    SELECT count(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname='public' AND tablename=t
      AND (
        coalesce(qual,'') ~* 'organization_id\s*=\s*app\.current_organization_id'
        OR coalesce(with_check,'') ~* 'organization_id\s*=\s*app\.current_organization_id'
      );
    IF policy_count > 0 THEN
      RAISE EXCEPTION 'Unsafe blanket organization policy detected on multi-party surface: %', t;
    END IF;
  END LOOP;
END $$;

-- Append-only audit/status controls: runtime must not receive UPDATE/DELETE
-- grants merely because SELECT/INSERT are required.
DO $$
DECLARE
  tbl text;
  upd boolean;
  del boolean;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['audit_events','cpcb_swm_status_history'] LOOP
    SELECT has_table_privilege('rupaykg_app_runtime','public.'||tbl,'UPDATE'),
           has_table_privilege('rupaykg_app_runtime','public.'||tbl,'DELETE')
      INTO upd, del;
    IF upd OR del THEN
      RAISE EXCEPTION 'Runtime role has forbidden UPDATE/DELETE privilege on append-only audit surface: %', tbl;
    END IF;
  END LOOP;
END $$;

-- The disposable runtime role must remain a non-privileged, non-bypass-RLS role.
DO $$
DECLARE
  is_super boolean;
  bypass boolean;
BEGIN
  SELECT rolsuper, rolbypassrls INTO is_super, bypass
  FROM pg_roles WHERE rolname='rupaykg_app_runtime';
  IF is_super OR bypass THEN
    RAISE EXCEPTION 'rupaykg_app_runtime is privileged or bypasses RLS';
  END IF;
END $$;

SELECT 'Batch E structural policy contract PASSED' AS result;
