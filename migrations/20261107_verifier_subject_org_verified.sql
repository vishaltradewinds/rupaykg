-- Subject organization legal verification is the authoritative onboarding status.
-- organizations.status is an operational record status and is not a legal-verification signal.
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
      JOIN public.organization_memberships membership
        ON membership.organization_id = activity.organization_id
       AND membership.identity_id = verifier.id
       AND membership.status = 'VERIFIED'
      JOIN public.roles role
        ON role.id = membership.role_id
       AND role.organization_id = activity.organization_id
     WHERE activity.id = p_activity_id
       AND activity.geography_id IS NOT NULL
       AND EXISTS (
         SELECT 1
           FROM pg_catalog.jsonb_array_elements_text(role.permissions) permission(value)
          WHERE permission.value IN (
            'VERIFY_EVIDENCE', 'verification:approve', 'verification.approve'
          )
       )
       AND public.organization_has_geography_scope_at(
         activity.organization_id,
         activity.geography_id,
         coalesce(activity.occurred_at, activity.created_at)
       )
  );
$function$;
