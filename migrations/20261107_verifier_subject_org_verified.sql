-- Legal verification status, not operational record status, governs subject eligibility.
-- Keep the complete identity, membership, role, self-review and effective-geography
-- checks introduced by the preceding verifier migration.
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
      FROM public.activities activity
      JOIN public.organizations subject_org
        ON subject_org.id = activity.organization_id
       AND subject_org.verification_status = 'VERIFIED'
      JOIN public.identities verifier
        ON verifier.id = p_identity_id
       AND verifier.status = 'VERIFIED'
       AND verifier.suspended_at IS NULL
     WHERE activity.id = p_activity_id
       AND activity.geography_id IS NOT NULL
       AND activity.actor_identity_id IS DISTINCT FROM p_identity_id
       AND (
         SELECT count(*)
           FROM public.organization_memberships membership
           JOIN public.roles role
             ON role.id = membership.role_id
            AND role.organization_id = activity.organization_id
          WHERE membership.organization_id = activity.organization_id
            AND membership.identity_id = verifier.id
            AND membership.status = 'VERIFIED'
            AND EXISTS (
              SELECT 1
                FROM pg_catalog.jsonb_array_elements_text(role.permissions) permission(value)
               WHERE permission.value IN (
                 'VERIFY_EVIDENCE', 'verification:approve', 'verification.approve'
               )
            )
       ) = 1
       AND public.organization_has_geography_scope_at(
         activity.organization_id,
         activity.geography_id,
         coalesce(activity.occurred_at, activity.created_at)
       )
  );
$function$;
