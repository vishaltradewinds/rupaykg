-- Reapply the candidate verification migration over the fully migrated
-- disposable RupayKg schema after recreating the two historical trigger names.
-- This is executed as a dedicated CI step before the parallel Node test suite.
\set ON_ERROR_STOP on

BEGIN;

DROP TRIGGER IF EXISTS verification_authorization_guard ON public.verifications;

CREATE OR REPLACE FUNCTION public.test_legacy_verification_independence()
RETURNS trigger
LANGUAGE plpgsql
AS $body$
BEGIN
  RETURN NEW;
END;
$body$;

CREATE TRIGGER verification_independence_guard
BEFORE INSERT ON public.verifications
FOR EACH ROW EXECUTE FUNCTION public.test_legacy_verification_independence();

CREATE TRIGGER verifications_integrity_guard
BEFORE INSERT OR UPDATE ON public.verifications
FOR EACH ROW EXECUTE FUNCTION public.prevent_invalid_verification();

\i migrations/20261104_verification_authorization_tenant_binding.sql

DO $assert$
DECLARE
  trigger_names text[];
BEGIN
  SELECT array_agg(tgname ORDER BY tgname)
    INTO trigger_names
    FROM pg_trigger
   WHERE tgrelid='public.verifications'::regclass
     AND NOT tgisinternal;

  IF trigger_names IS DISTINCT FROM ARRAY['verification_authorization_guard']::text[] THEN
    RAISE EXCEPTION 'verification migration reapplication left unexpected triggers: %', trigger_names;
  END IF;
END;
$assert$;

DROP FUNCTION public.test_legacy_verification_independence();

COMMIT;
