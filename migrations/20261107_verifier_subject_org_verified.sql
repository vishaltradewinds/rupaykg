-- Keep the subject-bound permission predicate explicit and stable.
-- Organization approval state and geography are enforced by the unified trigger
-- for APPROVED decisions; role names are never privileges.
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
