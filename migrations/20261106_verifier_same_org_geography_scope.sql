-- Fail-closed verifier authorization scoped to the subject activity.
-- Forward-only replacement for the global verifier check in migration 008.
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
    JOIN public.organization_memberships m
      ON m.organization_id = a.organization_id
     AND m.identity_id = p_identity_id
     AND m.status = 'VERIFIED'
    JOIN public.roles r ON r.id = m.role_id
    WHERE a.id = p_activity_id
      AND a.geography_id IS NOT NULL
      AND (
        lower(r.name) IN ('verifier', 'auditor', 'validator', 'verification_officer')
        OR r.permissions @> '["verification:approve"]'::jsonb
        OR r.permissions @> '["verification.approve"]'::jsonb
      )
      AND EXISTS (
        SELECT 1
        FROM public.organization_geography_scopes s
        WHERE s.organization_id = a.organization_id
          AND s.status = 'VERIFIED'
      )
      AND public.organization_has_geography_scope(a.organization_id, a.geography_id)
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
BEGIN
  IF NEW.decision = 'APPROVED' THEN
    v_activity_id := NEW.activity_id;

    IF NEW.evidence_id IS NOT NULL THEN
      IF v_activity_id IS NULL THEN
        SELECT e.activity_id INTO v_activity_id
        FROM public.evidence e
        WHERE e.id = NEW.evidence_id;
      ELSIF NOT EXISTS (
        SELECT 1 FROM public.evidence e
        WHERE e.id = NEW.evidence_id
          AND e.activity_id = v_activity_id
      ) THEN
        RAISE EXCEPTION 'verification activity and evidence must reference the same activity';
      END IF;
    END IF;

    IF v_activity_id IS NULL THEN
      RAISE EXCEPTION 'verification approval requires a resolvable subject activity';
    END IF;

    IF NOT public.has_verification_permission_for_activity(
      NEW.verifier_identity_id, v_activity_id
    ) THEN
      RAISE EXCEPTION 'verification requires verified authority in the subject organization and geography';
    END IF;

    SELECT a.actor_identity_id INTO v_activity_actor
    FROM public.activities a WHERE a.id = v_activity_id;

    IF v_activity_actor IS NOT NULL
       AND v_activity_actor = NEW.verifier_identity_id THEN
      RAISE EXCEPTION 'activity actor cannot verify its own evidence';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
