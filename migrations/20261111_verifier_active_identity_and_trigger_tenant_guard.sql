-- Close the remaining verifier identity and trigger-path authorization gaps.
-- Forward-only hardening: all verification rows retain the pre-existing requirement
-- for verifier authority; authority is now bound to the subject activity's tenant,
-- verified geography, verified organization and active verified identity.
CREATE OR REPLACE FUNCTION public.has_verification_permission_for_activity(
  p_identity_id uuid,
  p_activity_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.activities a
      JOIN public.organizations o
        ON o.id = a.organization_id
       AND o.status = 'VERIFIED'
      JOIN public.identities i
        ON i.id = p_identity_id
       AND i.status = 'VERIFIED'
       AND i.suspended_at IS NULL
      JOIN public.organization_memberships m
        ON m.organization_id = a.organization_id
       AND m.identity_id = i.id
       AND m.status = 'VERIFIED'
      JOIN public.roles r ON r.id = m.role_id
     WHERE a.id = p_activity_id
       AND a.geography_id IS NOT NULL
       AND (
         lower(r.name) IN ('verifier', 'auditor', 'validator', 'verification_officer')
         OR r.permissions @> '["verification:approve"]'::jsonb
         OR r.permissions @> '["verification.approve"]'::jsonb
         OR r.permissions @> '["VERIFY_EVIDENCE"]'::jsonb
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

-- This trigger historically guarded every verification decision, not only APPROVED.
-- Preserve the established self-verification error contract by checking subject
-- identity first, then apply the activity-bound tenant/identity/geography predicate.
CREATE OR REPLACE FUNCTION public.enforce_verification_independence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  v_activity_id uuid;
  v_activity_actor uuid;
BEGIN
  v_activity_id := NEW.activity_id;

  IF NEW.evidence_id IS NOT NULL THEN
    IF v_activity_id IS NULL THEN
      SELECT e.activity_id
        INTO v_activity_id
        FROM public.evidence e
       WHERE e.id = NEW.evidence_id;
    ELSIF NOT EXISTS (
      SELECT 1
        FROM public.evidence e
       WHERE e.id = NEW.evidence_id
         AND e.activity_id = v_activity_id
    ) THEN
      RAISE EXCEPTION 'verification activity and evidence must reference the same activity';
    END IF;
  END IF;

  IF v_activity_id IS NULL THEN
    RAISE EXCEPTION 'verification requires a resolvable subject activity';
  END IF;

  SELECT a.actor_identity_id
    INTO v_activity_actor
    FROM public.activities a
   WHERE a.id = v_activity_id;

  IF v_activity_actor IS NOT NULL
     AND v_activity_actor = NEW.verifier_identity_id THEN
    RAISE EXCEPTION 'verifier cannot self-approve activity evidence';
  END IF;

  IF NOT public.has_verification_permission_for_activity(
    NEW.verifier_identity_id, v_activity_id
  ) THEN
    RAISE EXCEPTION 'verifier must be active, verified and authorized in the subject organization and geography';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.has_verification_permission_for_activity(uuid, uuid) IS
  'Fail-closed verifier authorization: active VERIFIED identity, VERIFIED membership and organization, explicit verifier permission, and VERIFIED geography scope for the subject activity tenant.';

COMMENT ON FUNCTION public.enforce_verification_independence() IS
  'Checks self-verification first, then applies the shared activity-tenant verifier authorization predicate to every verification decision.';
