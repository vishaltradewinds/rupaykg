-- Unified, subject-bound verifier authorization for APPROVED and REJECTED decisions.
-- Role names never confer authority. Exactly one verified permission-bearing membership
-- in the subject organization is required and is snapshotted on the decision.

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

CREATE OR REPLACE FUNCTION public.enforce_verification_independence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  -- Authorization, evidence binding and self-review are enforced once by
  -- prevent_invalid_verification() below. The historical global-membership
  -- trigger is removed in this migration to avoid a second weaker policy path.
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_invalid_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  v_activity_id uuid;
  v_activity_actor uuid;
  v_activity_org uuid;
  v_activity_geography uuid;
  v_activity_as_of timestamptz;
  v_identity_status public.record_status;
  v_suspended_at timestamptz;
  v_org_verification_status text;
  v_membership_count integer;
  v_membership_id uuid;
  v_role_id uuid;
  v_permissions jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'verification decisions are immutable; append a superseding decision';
  END IF;

  v_activity_id := NEW.activity_id;

  IF NEW.evidence_id IS NOT NULL THEN
    SELECT evidence.activity_id
      INTO v_activity_id
      FROM public.evidence evidence
     WHERE evidence.id = NEW.evidence_id;

    IF v_activity_id IS NULL THEN
      RAISE EXCEPTION 'verification evidence must be bound to an activity';
    END IF;

    IF NEW.activity_id IS NOT NULL AND NEW.activity_id IS DISTINCT FROM v_activity_id THEN
      RAISE EXCEPTION 'verification activity must match the evidence activity';
    END IF;

    NEW.activity_id := v_activity_id;
  END IF;

  IF v_activity_id IS NULL THEN
    RAISE EXCEPTION 'verification decision requires a subject activity';
  END IF;

  SELECT activity.actor_identity_id,
         activity.organization_id,
         activity.geography_id,
         coalesce(activity.occurred_at, activity.created_at)
    INTO v_activity_actor, v_activity_org, v_activity_geography, v_activity_as_of
    FROM public.activities activity
   WHERE activity.id = v_activity_id;

  IF v_activity_org IS NULL OR v_activity_geography IS NULL THEN
    RAISE EXCEPTION 'verification decision requires an activity with organization and geography';
  END IF;

  SELECT organization.verification_status
    INTO v_org_verification_status
    FROM public.organizations organization
   WHERE organization.id = v_activity_org;

  IF v_org_verification_status IS DISTINCT FROM 'VERIFIED' THEN
    RAISE EXCEPTION 'verification decision requires a verified subject organization';
  END IF;

  SELECT identity.status, identity.suspended_at
    INTO v_identity_status, v_suspended_at
    FROM public.identities identity
   WHERE identity.id = NEW.verifier_identity_id;

  IF v_identity_status IS DISTINCT FROM 'VERIFIED'::public.record_status
     OR v_suspended_at IS NOT NULL THEN
    RAISE EXCEPTION 'verification decision requires an active verified identity';
  END IF;

  IF v_activity_actor IS NOT NULL AND v_activity_actor = NEW.verifier_identity_id THEN
    RAISE EXCEPTION 'activity actor cannot verify its own evidence';
  END IF;

  IF NOT public.organization_has_geography_scope_at(
    v_activity_org, v_activity_geography, v_activity_as_of
  ) THEN
    RAISE EXCEPTION 'verification decision is outside verified, effective geography scope';
  END IF;

  SELECT count(*)::integer
    INTO v_membership_count
    FROM public.organization_memberships membership
    JOIN public.roles role
      ON role.id = membership.role_id
     AND role.organization_id = v_activity_org
   WHERE membership.identity_id = NEW.verifier_identity_id
     AND membership.organization_id = v_activity_org
     AND membership.status = 'VERIFIED'
     AND EXISTS (
       SELECT 1
         FROM pg_catalog.jsonb_array_elements_text(role.permissions) permission(value)
        WHERE permission.value IN (
          'VERIFY_EVIDENCE', 'verification:approve', 'verification.approve'
        )
     );

  IF v_membership_count <> 1 THEN
    RAISE EXCEPTION 'verification requires exactly one verified permission-bearing membership in the subject organization';
  END IF;

  SELECT membership.id, role.id, role.permissions
    INTO v_membership_id, v_role_id, v_permissions
    FROM public.organization_memberships membership
    JOIN public.roles role
      ON role.id = membership.role_id
     AND role.organization_id = v_activity_org
   WHERE membership.identity_id = NEW.verifier_identity_id
     AND membership.organization_id = v_activity_org
     AND membership.status = 'VERIFIED'
     AND EXISTS (
       SELECT 1
         FROM pg_catalog.jsonb_array_elements_text(role.permissions) permission(value)
        WHERE permission.value IN (
          'VERIFY_EVIDENCE', 'verification:approve', 'verification.approve'
        )
     );

  NEW.authorization_membership_id := v_membership_id;
  NEW.authorization_role_id := v_role_id;
  NEW.authorization_permissions_snapshot := v_permissions;
  NEW.authorization_checked_at := statement_timestamp();

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS verification_independence_guard ON public.verifications;
DROP TRIGGER IF EXISTS verifications_integrity_guard ON public.verifications;

CREATE TRIGGER verifications_integrity_guard
BEFORE INSERT ON public.verifications
FOR EACH ROW EXECUTE FUNCTION public.prevent_invalid_verification();

CREATE OR REPLACE FUNCTION public.reject_verification_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  RAISE EXCEPTION 'verification decisions are immutable; append a superseding decision';
END;
$function$;

DROP TRIGGER IF EXISTS verifications_immutable_guard ON public.verifications;
CREATE TRIGGER verifications_immutable_guard
BEFORE UPDATE OR DELETE ON public.verifications
FOR EACH ROW EXECUTE FUNCTION public.reject_verification_mutation();

COMMENT ON FUNCTION public.prevent_invalid_verification() IS
  'Enforces active identity, one exact subject-organization permission membership, verified subject organization, effective geography, no self-review, evidence/activity binding and authorization snapshots for every decision.';
