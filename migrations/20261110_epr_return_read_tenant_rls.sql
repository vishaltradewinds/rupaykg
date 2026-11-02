-- Enable only tenant-scoped EPR return reads under the signed request-context verifier.
-- This migration intentionally grants no EPR write privileges and creates no write policy.
-- DBA prerequisite: rupaykg_app_runtime must be a dedicated LOGIN, NOBYPASSRLS,
-- NOINHERIT role with no elevated attributes or role memberships. The verifier
-- schema/function must already be owned by rupaykg_security_definer.

DO $preflight$
DECLARE
  app_role record;
  verifier record;
  key_owner name;
  returns_owner name;
BEGIN
  SELECT rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole,
         rolinherit, rolreplication
    INTO app_role
    FROM pg_catalog.pg_roles
   WHERE rolname = 'rupaykg_app_runtime';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EPR_RLS_APP_ROLE_MISSING: DBA must provision rupaykg_app_runtime';
  END IF;
  IF NOT app_role.rolcanlogin OR app_role.rolsuper OR app_role.rolbypassrls
     OR app_role.rolcreatedb OR app_role.rolcreaterole
     OR app_role.rolinherit OR app_role.rolreplication THEN
    RAISE EXCEPTION 'EPR_RLS_APP_ROLE_INVALID: rupaykg_app_runtime must be LOGIN, NOBYPASSRLS, NOINHERIT and have no elevated attributes';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members m
     WHERE m.member = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'rupaykg_app_runtime')
  ) THEN
    RAISE EXCEPTION 'EPR_RLS_APP_ROLE_MEMBERSHIP_INVALID: app runtime must not inherit or assume another role';
  END IF;

  SELECT p.prosecdef, r.rolname AS owner_name
    INTO verifier
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
   WHERE n.nspname = 'app_security'
     AND p.proname = 'current_request_context_claims'
     AND p.pronargs = 0;
  IF NOT FOUND OR NOT verifier.prosecdef OR verifier.owner_name <> 'rupaykg_security_definer' THEN
    RAISE EXCEPTION 'EPR_RLS_SIGNED_CONTEXT_VERIFIER_INVALID: dedicated SECURITY DEFINER verifier is required';
  END IF;

  SELECT pg_catalog.pg_get_userbyid(c.relowner)
    INTO key_owner
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'app_security' AND c.relname = 'request_context_keys';
  IF key_owner IS DISTINCT FROM 'rupaykg_security_definer' THEN
    RAISE EXCEPTION 'EPR_RLS_SIGNING_KEY_OWNER_INVALID';
  END IF;

  SELECT pg_catalog.pg_get_userbyid(c.relowner)
    INTO returns_owner
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'epr_returns';
  IF returns_owner IS NULL OR returns_owner = 'rupaykg_app_runtime' THEN
    RAISE EXCEPTION 'EPR_RLS_RETURNS_TABLE_OWNER_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
     WHERE schemaname = 'public' AND tablename = 'epr_returns'
  ) THEN
    RAISE EXCEPTION 'EPR_RLS_EXISTING_POLICY_REQUIRES_MANUAL_RECONCILIATION';
  END IF;
END
$preflight$;

REVOKE ALL ON TABLE public.epr_returns FROM PUBLIC;
REVOKE ALL ON TABLE public.epr_schemes FROM PUBLIC;
GRANT USAGE ON SCHEMA public, app_security TO rupaykg_app_runtime;
GRANT EXECUTE ON FUNCTION app_security.current_request_context_claims() TO rupaykg_app_runtime;
GRANT SELECT ON TABLE public.epr_returns, public.epr_schemes TO rupaykg_app_runtime;

ALTER TABLE public.epr_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epr_returns FORCE ROW LEVEL SECURITY;

CREATE POLICY epr_returns_select_tenant
  ON public.epr_returns
  FOR SELECT
  TO rupaykg_app_runtime
  USING (
    organization_id = nullif(
      (app_security.current_request_context_claims())[2],
      ''
    )::uuid
  );

COMMENT ON POLICY epr_returns_select_tenant ON public.epr_returns IS
  'Read-only tenant isolation: only the organization claim from a verified short-lived signed request context is visible to rupaykg_app_runtime. No EPR write policy is granted.';
