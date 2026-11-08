-- Shakti runtime grant reconciliation completion.
-- Adds DML privileges identified by the audited authentication/onboarding/platform
-- mutation inventory after the initial runtime grant reconciliation migration.
-- No DELETE/DDL privilege is granted.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rupaykg_app_runtime') THEN
    RAISE EXCEPTION 'rupaykg_app_runtime role is required before runtime grant reconciliation completion';
  END IF;
END $$;

grant update on table public.organization_geography_scopes to rupaykg_app_runtime;
grant update on table public.organization_verification_evidence to rupaykg_app_runtime;
grant update on table public.organizations to rupaykg_app_runtime;
