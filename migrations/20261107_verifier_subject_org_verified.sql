-- Require the subject organization itself to be verified before any verifier
-- can approve an activity. A verified membership/geography assignment alone is
-- insufficient while the organization is pending, suspended, or rejected.
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
    JOIN public.organizations o
      ON o.id = a.organization_id
     AND o.status = 'VERIFIED'
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
