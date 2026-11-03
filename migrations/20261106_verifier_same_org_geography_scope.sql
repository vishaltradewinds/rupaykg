-- Subject-bound verifier authorization. A role label is never an authority grant.
-- Ensure clean installs and partially upgraded databases have the suspension
-- kill switch before verifier functions reference it.
ALTER TABLE public.identities
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

CREATE OR REPLACE FUNCTION public.has_verification_permission_for_activity(
  p_identity_id uuid,
  p_activity_id uuid
) RETURNS boolean
LANGUAGE sql STABLE
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.activities a
      JOIN public.identities i
        ON i.id = p_identity_id
       AND i.status = 'VERIFIED'
       AND i.suspended_at IS NULL
      JOIN public.organization_memberships m
        ON m.organization_id = a.organization_id
       AND m.identity_id = i.id
       AND m.status = 'VERIFIED'
      JOIN public.roles r
        ON r.id = m.role_id
       AND r.organization_id = a.organization_id
     WHERE a.id = p_activity_id
       AND (
         r.permissions @> '["VERIFY_EVIDENCE"]'::jsonb
         OR r.permissions @> '["verification:approve"]'::jsonb
         OR r.permissions @> '["verification.approve"]'::jsonb
       )
  );
$function$;

CREATE OR REPLACE FUNCTION public.prevent_invalid_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  v_activity_id uuid;
  v_activity_actor uuid;
  v_organization_id uuid;
  v_geography_id uuid;
BEGIN
  -- An approved decision and its captured authorization evidence are immutable.
  -- Corrections must be represented by a superseding verification record.
  IF TG_OP = 'UPDATE' AND OLD.decision = 'APPROVED'
     AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'approved verification is immutable; create a superseding record';
  END IF;

  v_activity_id := NEW.activity_id;
  IF NEW.evidence_id IS NOT NULL THEN
    IF v_activity_id IS NULL THEN
      SELECT e.activity_id INTO v_activity_id
        FROM public.evidence e WHERE e.id = NEW.evidence_id;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.evidence e
       WHERE e.id = NEW.evidence_id AND e.activity_id = v_activity_id
    ) THEN
      RAISE EXCEPTION 'verification activity and evidence must reference the same activity';
    END IF;
  END IF;

  IF v_activity_id IS NULL THEN
    RAISE EXCEPTION 'verification requires a resolvable subject activity';
  END IF;

  SELECT a.organization_id, a.geography_id, a.actor_identity_id
    INTO v_organization_id, v_geography_id, v_activity_actor
    FROM public.activities a WHERE a.id = v_activity_id;
  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'verification subject activity does not exist';
  END IF;

  -- Every decision (including REJECTED) requires an active identity, verified
  -- membership and explicit permission in the subject activity's organization.
  IF NOT public.has_verification_permission_for_activity(
    NEW.verifier_identity_id, v_activity_id
  ) THEN
    RAISE EXCEPTION 'verification requires active identity and explicit authority in the subject organization';
  END IF;

  IF v_activity_actor IS NOT NULL AND v_activity_actor = NEW.verifier_identity_id THEN
    RAISE EXCEPTION 'activity actor cannot verify its own evidence';
  END IF;

  IF NEW.decision = 'APPROVED' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organizations o
       WHERE o.id = v_organization_id AND o.status = 'VERIFIED'
    ) THEN
      RAISE EXCEPTION 'approved verification requires a verified subject organization';
    END IF;
    IF v_geography_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.organization_geography_scopes s
          WHERE s.organization_id = v_organization_id AND s.status = 'VERIFIED'
       )
       OR NOT public.organization_has_geography_scope(v_organization_id, v_geography_id) THEN
      RAISE EXCEPTION 'approved verification requires a verified geography scope covering the subject activity';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- The legacy trigger checks membership globally and role names. The unified
-- guard above now covers all decisions, including independence and tenant scope.
DROP TRIGGER IF EXISTS verification_independence_guard ON public.verifications;


-- Approved decisions are append-only: prevent deletion as well as mutation.
CREATE OR REPLACE FUNCTION public.prevent_approved_verification_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF OLD.decision = 'APPROVED' THEN
    RAISE EXCEPTION 'approved verification is immutable; create a superseding record';
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS approved_verification_delete_guard ON public.verifications;
CREATE TRIGGER approved_verification_delete_guard
  BEFORE DELETE ON public.verifications
  FOR EACH ROW EXECUTE FUNCTION public.prevent_approved_verification_delete();
