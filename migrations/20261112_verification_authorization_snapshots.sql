-- Forward-only compatibility for the production verification authorization contract.
-- Existing production columns are retained; clean installs receive the same fields.
ALTER TABLE public.verifications
  ADD COLUMN IF NOT EXISTS authorization_membership_id uuid,
  ADD COLUMN IF NOT EXISTS authorization_role_id uuid,
  ADD COLUMN IF NOT EXISTS authorization_permissions_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS authorization_checked_at timestamptz;

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verifications_authorization_membership_fk') THEN
    ALTER TABLE public.verifications
      ADD CONSTRAINT verifications_authorization_membership_fk
      FOREIGN KEY (authorization_membership_id) REFERENCES public.organization_memberships(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verifications_authorization_role_fk') THEN
    ALTER TABLE public.verifications
      ADD CONSTRAINT verifications_authorization_role_fk
      FOREIGN KEY (authorization_role_id) REFERENCES public.roles(id);
  END IF;
END;
$constraints$;

-- Capture the exact same-tenant permission-bearing membership and role used
-- for BOTH APPROVED and REJECTED decisions. Caller-supplied snapshots are denied.
CREATE OR REPLACE FUNCTION public.capture_verification_authorization_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  v_activity_id uuid;
  v_membership_id uuid;
  v_role_id uuid;
  v_permissions jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'verification decisions and authorization snapshots are immutable; create a superseding record';
  END IF;

  IF NEW.authorization_membership_id IS NOT NULL
     OR NEW.authorization_role_id IS NOT NULL
     OR NEW.authorization_permissions_snapshot IS NOT NULL
     OR NEW.authorization_checked_at IS NOT NULL THEN
    RAISE EXCEPTION 'verification authorization snapshot is database-generated';
  END IF;

  v_activity_id := NEW.activity_id;
  IF v_activity_id IS NULL AND NEW.evidence_id IS NOT NULL THEN
    SELECT e.activity_id INTO v_activity_id
      FROM public.evidence e WHERE e.id = NEW.evidence_id;
  END IF;
  IF v_activity_id IS NULL THEN
    RAISE EXCEPTION 'cannot snapshot verifier authorization without a subject activity';
  END IF;

  SELECT m.id, r.id, r.permissions
    INTO v_membership_id, v_role_id, v_permissions
    FROM public.activities a
    JOIN public.organization_memberships m
      ON m.organization_id = a.organization_id
     AND m.identity_id = NEW.verifier_identity_id
     AND m.status = 'VERIFIED'
    JOIN public.roles r
      ON r.id = m.role_id
     AND r.organization_id = a.organization_id
   WHERE a.id = v_activity_id
     AND (
       r.permissions @> '["VERIFY_EVIDENCE"]'::jsonb
       OR r.permissions @> '["verification:approve"]'::jsonb
       OR r.permissions @> '["verification.approve"]'::jsonb
     )
   ORDER BY m.id
   LIMIT 1;

  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'cannot snapshot verifier authorization without an explicit subject-organization permission';
  END IF;

  NEW.authorization_membership_id := v_membership_id;
  NEW.authorization_role_id := v_role_id;
  NEW.authorization_permissions_snapshot := v_permissions;
  NEW.authorization_checked_at := clock_timestamp();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS verification_authorization_snapshot_guard ON public.verifications;
CREATE TRIGGER verification_authorization_snapshot_guard
  BEFORE INSERT OR UPDATE ON public.verifications
  FOR EACH ROW EXECUTE FUNCTION public.capture_verification_authorization_snapshot();

-- Decisions are append-only, including REJECTED outcomes. Corrections require
-- a separately linked superseding decision; history is never rewritten/deleted.
CREATE OR REPLACE FUNCTION public.prevent_approved_verification_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  RAISE EXCEPTION 'verification decisions are immutable; create a superseding record';
END;
$function$;

DROP TRIGGER IF EXISTS approved_verification_delete_guard ON public.verifications;
DROP TRIGGER IF EXISTS verification_delete_guard ON public.verifications;
CREATE TRIGGER verification_delete_guard
  BEFORE DELETE ON public.verifications
  FOR EACH ROW EXECUTE FUNCTION public.prevent_approved_verification_delete();
