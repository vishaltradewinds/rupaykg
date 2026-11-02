-- Stakeholder approval authority must be a verified, active platform principal.
-- Role names alone are not authorization; the membership's organization and
-- explicit permission are part of the authority boundary.
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_stakeholder_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  -- Applications must enter through PENDING intake. Direct INSERT as APPROVED
  -- would bypass the UPDATE-only authority and hierarchy gates.
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'APPROVED' THEN
      RAISE EXCEPTION 'STAKEHOLDER_APPLICATION_MUST_START_PENDING';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'APPROVED' AND OLD.status IS DISTINCT FROM 'APPROVED' THEN
    IF NEW.reviewed_by_identity_id IS NULL THEN
      RAISE EXCEPTION 'Stakeholder approval requires a reviewing platform authority';
    END IF;

    IF NEW.reviewed_by_identity_id = NEW.identity_id THEN
      RAISE EXCEPTION 'Stakeholder applications cannot be self-approved';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM public.identities reviewer
        JOIN public.organization_memberships om
          ON om.identity_id = reviewer.id
         AND om.status = 'VERIFIED'
        JOIN public.roles r
          ON r.id = om.role_id
         AND r.organization_id = om.organization_id
        JOIN public.organizations authority_org
          ON authority_org.id = om.organization_id
         AND authority_org.status = 'VERIFIED'
         AND authority_org.organization_type = 'PLATFORM_AUTHORITY'
       WHERE reviewer.id = NEW.reviewed_by_identity_id
         AND reviewer.status = 'VERIFIED'
         AND reviewer.suspended_at IS NULL
         AND r.name IN ('platform_admin', 'super_admin')
         AND jsonb_typeof(r.permissions) = 'array'
         AND r.permissions @> '["admin:users"]'::jsonb
    ) THEN
      RAISE EXCEPTION 'Stakeholder approval requires an active verified PLATFORM_AUTHORITY member with admin:users permission';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.prevent_unauthorized_stakeholder_approval() IS
  'Fail-closed stakeholder approval guard: reviewer identity must be active and VERIFIED, membership and organization VERIFIED, organization type PLATFORM_AUTHORITY, role platform_admin/super_admin, and explicit admin:users permission. Role labels alone never grant authority.';
