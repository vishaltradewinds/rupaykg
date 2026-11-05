-- Disposable CI rehearsal for the verification-authorization migration.
-- The migration must remove every known legacy trigger name and converge on
-- exactly one canonical trigger when reapplied over an already-initialized DB.

BEGIN;

DROP TRIGGER IF EXISTS verification_authorization_guard ON public.verifications;
DROP TRIGGER IF EXISTS verification_independence_guard ON public.verifications;
DROP TRIGGER IF EXISTS verifications_integrity_guard ON public.verifications;

CREATE TRIGGER verification_independence_guard
BEFORE INSERT OR UPDATE ON public.verifications
FOR EACH ROW EXECUTE FUNCTION public.enforce_verification_authorization();

CREATE TRIGGER verifications_integrity_guard
BEFORE INSERT OR UPDATE ON public.verifications
FOR EACH ROW EXECUTE FUNCTION public.enforce_verification_authorization();

CREATE TRIGGER verification_authorization_guard
BEFORE INSERT OR UPDATE ON public.verifications
FOR EACH ROW EXECUTE FUNCTION public.enforce_verification_authorization();

COMMIT;

-- Reapply the migration under test. It must be idempotent and converge the
-- three legacy trigger names to the single canonical trigger.
\i migrations/20261104_verification_authorization_tenant_binding.sql

DO $assert$
DECLARE
  legacy_count integer;
  canonical_count integer;
BEGIN
  SELECT count(*)
    INTO legacy_count
    FROM pg_trigger
   WHERE tgrelid = 'public.verifications'::regclass
     AND NOT tgisinternal
     AND tgname IN (
       'verification_independence_guard',
       'verifications_integrity_guard'
     );

  SELECT count(*)
    INTO canonical_count
    FROM pg_trigger
   WHERE tgrelid = 'public.verifications'::regclass
     AND NOT tgisinternal
     AND tgname = 'verification_authorization_guard';

  -- Other independent verification triggers may legitimately remain on the table.
  -- The convergence contract is specifically that every known legacy
  -- authorization trigger name is gone and exactly one canonical authorization
  -- trigger remains.
  IF legacy_count <> 0 OR canonical_count <> 1 THEN
    RAISE EXCEPTION
      'verification authorization trigger convergence failed: legacy=%, canonical=%',
      legacy_count, canonical_count;
  END IF;

  RAISE NOTICE 'verification migration reapply over legacy trigger names verified';
END;
$assert$;
